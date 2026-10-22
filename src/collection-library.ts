import {App,Component,TFile,getAllTags,parseYaml} from 'obsidian';
import type {Board} from './model';
import {collectionNoteBody,readCollectionIdentity,type CollectionIdentity} from './collection-model';
import type {CollectionRecord,CollectionBoardReference} from './collection-view';
import {isWorkspaceFile} from './workspace';
import {searchCollectionRecords,type CollectionSearchOptions,type CollectionSearchProgress,type CollectionSearchResult} from './collection-search';
import {collectionTaskSummary} from './collection-tasks';

export interface CollectionLibraryHost {
 isBoardFile(file:TFile):boolean;
 readBoard(file:TFile):Promise<Board>;
}
export interface CollectionIdentityWatch {current(file:TFile):boolean;release():void;}
type SearchRead={file?:TFile;current?:()=>boolean;resolve?:(source:string)=>void;reject?:(error:Error)=>void;};
/** Metadata-only discovery. Explicit body searches and visible previews read
 * native notes on demand; bodies are never retained in the whole-vault index. */
export class CollectionLibrary extends Component {
 private listeners=new Set<()=>void>();
 private revision=0;
 private pending?:{revision:number;work:Promise<readonly CollectionRecord[]>};
 private boards=new Map<TFile,{stamp:string;references:CollectionBoardReference[];paths:string[]}>();
 private boardKeys=new WeakMap<TFile,string>();private nextBoardKey=0;
 private known=new Map<TFile,CollectionIdentity>();
 private searchReads=new Set<SearchRead>();private searchQueue:SearchRead[]=[];private activeSearchReads=0;
 private searchTimer?:{clock:Window;id:number};
 private searchDisposed=false;private identityWatches=new Set<()=>void>();
 constructor(private readonly app:App,private readonly host:CollectionLibraryHost){super();}
 onload(){
  this.searchDisposed=false;
  const changed=(file?:unknown)=>{
   if(file instanceof TFile)this.boards.delete(file);
   this.invalidate();
  };
  this.registerEvent(this.app.vault.on('create',changed));
  this.registerEvent(this.app.vault.on('modify',changed));
  this.registerEvent(this.app.vault.on('delete',changed));
  this.registerEvent(this.app.vault.on('rename',changed));
  this.registerEvent(this.app.metadataCache.on('changed',(file)=>{this.known.delete(file);changed(file);}));
  this.registerEvent(this.app.metadataCache.on('resolve',changed));
 }
 onunload(){
  this.searchDisposed=true;
  for(const release of this.identityWatches)release();
  for(const read of this.searchReads)this.finishSearchRead(read,undefined,Error('搜索已取消'));
  this.searchQueue=[];this.clearSearchTimer();
 }
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 invalidate(){this.revision++;for(const listener of this.listeners)listener();}
 remember(file:TFile,identity:CollectionIdentity){this.known.set(file,identity);this.invalidate();}
 private identity(file:TFile){return readCollectionIdentity(this.app.metadataCache.getFileCache(file)?.frontmatter)||this.known.get(file);}
 identityForFile(file:TFile){return this.identity(file);}
 /** Keep duplicate-identity discovery valid across queued native writes. New
  * files can precede their metadata cache entry, so events are part of the proof.
  * Flag writes may drain the selected file's native save and separately check
  * its body/properties at the callback. Reference delivery has no such source
  * write, so it rejects every source event, including stale-cache same-stat edits. */
 watchIdentity(expected:CollectionIdentity,options:{allowSourceChanges?:boolean}={}):CollectionIdentityWatch {
  const identity={id:expected.id,createdAt:expected.createdAt},modified=new Set<TFile>();
  let released=false,invalid=false;
  const changed=(file:unknown,kind:'create'|'modify'|'delete'|'rename'|'metadata')=>{
   if(released)return;
   // Generated search indexes and installation backups are outside discovery,
   // resolution and duplicate checks. Their background file/folder events
   // cannot introduce a workspace identity. A rename into the workspace is
   // evaluated at its new path; a source leaving it fails current(file).
   if(file&&typeof file==='object'&&'path'in file&&typeof file.path==='string'&&(!isWorkspaceFile({path:file.path})||file.path==='ThoughtSpace/白板搜索'))return;
   if(!(file instanceof TFile)){invalid=true;return;}
   if(file.extension.toLowerCase()!=='md')return;
   if(kind==='modify'||kind==='metadata')modified.add(file);else invalid=true;
  };
  const remove:(()=>void)[]=[];
  const vaultRefs=[this.app.vault.on('create',file=>changed(file,'create')),this.app.vault.on('modify',file=>changed(file,'modify')),this.app.vault.on('delete',file=>changed(file,'delete')),this.app.vault.on('rename',file=>changed(file,'rename'))];
  for(const ref of vaultRefs)remove.push(()=>this.app.vault.offref(ref));
  const metadata=this.app.metadataCache.on('changed',file=>changed(file,'metadata'));remove.push(()=>this.app.metadataCache.offref(metadata));
  const release=()=>{if(released)return;released=true;for(const off of remove)off();modified.clear();this.identityWatches.delete(release);};this.identityWatches.add(release);
  return{
   current:file=>{
    if(released||invalid||options.allowSourceChanges===false&&modified.size>0||[...modified].some(changedFile=>changedFile!==file)||!isWorkspaceFile(file)||file.extension.toLowerCase()!=='md'||this.app.vault.getAbstractFileByPath(file.path)!==file)return false;
    const actual=this.identity(file);if(actual?.id!==identity.id||actual.createdAt!==identity.createdAt)return false;
    let found=false;
    for(const candidate of this.app.vault.getMarkdownFiles()){
     if(!isWorkspaceFile(candidate))continue;const candidateIdentity=this.identity(candidate);
     if(candidateIdentity?.id!==identity.id)continue;
     if(found||candidate!==file||candidateIdentity.createdAt!==identity.createdAt)return false;
     found=true;
    }
    return found;
   },
   release,
  };
 }
 /** The file object must still be the one that produced the visible chip. */
 referenceFile(reference:CollectionBoardReference):TFile|undefined {
  const file=this.app.vault.getAbstractFileByPath(reference.boardPath);
  if(file instanceof TFile&&reference.key===JSON.stringify([this.boardKeys.get(file),reference.nodeId]))return file;
 }
 list():Promise<readonly CollectionRecord[]>{
  if(this.pending?.revision===this.revision)return this.pending.work;
  const revision=this.revision,work=this.index().then(records=>revision===this.revision?records:this.list());this.pending={revision,work};
  return work;
 }
 private async index():Promise<readonly CollectionRecord[]>{
  const files=this.app.vault.getFiles().filter(isWorkspaceFile),live=new Set(files);
  for(const file of this.boards.keys())if(!live.has(file))this.boards.delete(file);
  for(const file of this.known.keys())if(!live.has(file))this.known.delete(file);
  const boardFiles=files.filter(file=>this.host.isBoardFile(file));
  const usage=new Map<string,CollectionBoardReference[]>();let known=true,cursor=0;
  await Promise.all(Array.from({length:Math.min(4,boardFiles.length)},async()=>{
   while(cursor<boardFiles.length){
    const file=boardFiles[cursor++],stamp=`${file.path}:${file.stat.mtime}:${file.stat.size}`;
    try{
     if(file.stat.size>8*1024*1024)throw Error('白板过大');
     let cached=this.boards.get(file);
     if(!cached||cached.stamp!==stamp){const board=await this.host.readBoard(file);
      if(this.app.vault.getAbstractFileByPath(file.path)!==file||stamp!==`${file.path}:${file.stat.mtime}:${file.stat.size}`)throw Error('白板索引已变化');
      let key=this.boardKeys.get(file);if(!key){key=String(++this.nextBoardKey);this.boardKeys.set(file,key);}
      const cards=board.presentation==='handwriting'?[]:board.nodes.filter(node=>node.kind==='card'&&!!node.file);
      cached={stamp,paths:cards.map(node=>node.file!),references:cards.map(node=>({key:JSON.stringify([key,node.id]),boardPath:file.path,boardTitle:file.basename,nodeId:node.id,nodeTitle:node.title||'笔记卡片'}))};this.boards.set(file,cached);}
     for(let index=0;index<cached.paths.length;index++){const path=cached.paths[index],items=usage.get(path)||[];items.push(cached.references[index]);usage.set(path,items);}
    }catch{known=false;}
   }
  }));
  return files.flatMap(file=>{
   if(file.extension!=='md'||this.host.isBoardFile(file))return[];
   const identity=this.identity(file);if(!identity)return[];
   const cache=this.app.metadataCache.getFileCache(file),frontmatter=cache?.frontmatter;
   return[{...identity,path:file.path,title:file.basename,tags:[...new Set(getAllTags(cache||{})||[])],tasks:collectionTaskSummary(cache),pinned:frontmatter?.thoughtspace_pinned===true,archived:frontmatter?.thoughtspace_archived===true,placements:(usage.get(file.path)||[]).sort((a,b)=>a.boardPath.localeCompare(b.boardPath)||a.nodeId.localeCompare(b.nodeId)),placementsComplete:known,inBoard:usage.has(file.path)?true:known?false:'unknown' as const}];
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.path.localeCompare(b.path));
 }
 async search(options:CollectionSearchOptions,current:()=>boolean,onProgress?:(progress:CollectionSearchProgress)=>void):Promise<CollectionSearchResult>{
  const revision=this.revision,records=await this.list(),valid=()=>!this.searchDisposed&&current()&&revision===this.revision;
  let identities:Map<string,TFile[]>|undefined;
  return searchCollectionRecords(records,options,{current:valid,onProgress,readBody:async record=>{
   if(!valid())throw Error('搜索已取消');
   if(!identities){
    identities=new Map();
    for(const file of this.app.vault.getMarkdownFiles()){
     if(!isWorkspaceFile(file))continue;const identity=this.identity(file);if(!identity)continue;
     const candidates=identities.get(identity.id)||[];candidates.push(file);identities.set(identity.id,candidates);
    }
   }
   const candidates=identities.get(record.id)||[];
   if(candidates.length!==1)throw Error(candidates.length?'发现重复的收集标识':'原笔记已变化');
   const file=candidates[0],path=file.path,stamp=`${file.stat.mtime}:${file.stat.size}`;
   const identity=this.identity(file);
   if(path!==record.path||this.app.vault.getAbstractFileByPath(path)!==file||identity?.id!==record.id||identity.createdAt!==record.createdAt)throw Error('原笔记已移动或替换');
   if(file.stat.size>2*1024*1024)throw Error('记录超过正文搜索大小限制');
   const source=await this.readSearchSource(file,valid);
   if(!valid())throw Error('搜索已取消');
   const after=this.identity(file);
   if(file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file||stamp!==`${file.stat.mtime}:${file.stat.size}`||after?.id!==record.id||after.createdAt!==record.createdAt)throw Error('原笔记在搜索期间变化');
   if(source.length>2*1024*1024)throw Error('记录超过正文搜索大小限制');
   const body=collectionNoteBody(source,parseYaml,record);if(body===undefined)throw Error('收集身份已变化');return body;
  }});
 }
 /** Two native reads across all full-text searches in this library, including
  * separate views and superseded searches. Vault reads cannot be aborted; an
  * abandoned in-flight read keeps its slot but releases its caller promptly. */
 private readSearchSource(file:TFile,current:()=>boolean):Promise<string>{
  return new Promise((resolve,reject)=>{
   if(!current()){reject(Error('搜索已取消'));return;}
   const read:SearchRead={file,current,resolve,reject};this.searchReads.add(read);this.searchQueue.push(read);this.drainSearchQueue();this.scheduleSearchCheck();
  });
 }
 private finishSearchRead(read:SearchRead,source?:string,error?:unknown){
  if(!this.searchReads.delete(read))return;
  const resolve=read.resolve,reject=read.reject,current=read.current?.()===true;
  read.file=undefined;read.current=undefined;read.resolve=undefined;read.reject=undefined;
  if(!current)reject?.(Error('搜索已取消'));else if(error!==undefined)reject?.(error instanceof Error?error:Error('正文暂时无法读取',{cause:error}));else resolve?.(source!);
  if(!this.searchReads.size)this.clearSearchTimer();
 }
 private drainSearchQueue(){
  while(this.activeSearchReads<2&&this.searchQueue.length){
   const read=this.searchQueue.shift()!;
   if(!read.current?.()){this.finishSearchRead(read,undefined,Error('搜索已取消'));continue;}
   const file=read.file!;read.file=undefined;this.activeSearchReads++;
   const finish=(source?:string,error?:unknown)=>{this.activeSearchReads--;this.finishSearchRead(read,source,error);this.drainSearchQueue();};
   try{void this.app.vault.read(file).then(source=>finish(source),error=>finish(undefined,error));}
   catch(error){finish(undefined,error);}
  }
 }
 private scheduleSearchCheck(){
  if(this.searchTimer||!this.searchReads.size)return;
  // The shared library belongs to the main workspace clock, not a pop-out
  // which can disappear while a native storage promise is still pending.
  const clock=this.app.workspace.containerEl.ownerDocument.defaultView||window;
  this.searchTimer={clock,id:clock.setTimeout(()=>{
   this.searchTimer=undefined;
   for(const read of this.searchReads)if(!read.current?.())this.finishSearchRead(read,undefined,Error('搜索已取消'));
   this.searchQueue=this.searchQueue.filter(read=>this.searchReads.has(read));
   this.drainSearchQueue();this.scheduleSearchCheck();
  },25)};
 }
 private clearSearchTimer(){if(this.searchTimer){this.searchTimer.clock.clearTimeout(this.searchTimer.id);this.searchTimer=undefined;}}
 async resolve(identity:CollectionIdentity,path?:string):Promise<TFile|undefined>{
  const candidates=new Set(this.app.vault.getMarkdownFiles().filter(file=>isWorkspaceFile(file)&&this.identity(file)?.id===identity.id));
  const atPath=path?this.app.vault.getAbstractFileByPath(path):undefined;
  if(atPath instanceof TFile)candidates.add(atPath);
  let found:TFile|undefined;
  for(const file of candidates){
   if(file.stat.size>2*1024*1024)throw Error('记录超过预览大小限制，请打开原笔记核对');
   const source=await this.app.vault.read(file);
   if(this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('原笔记已移除或替换，请刷新后重试');
   if(collectionNoteBody(source,parseYaml,identity)===undefined)continue;
   if(found&&found!==file)throw Error('发现重复的收集标识，请先核对原笔记');
   found=file;
  }
  return found;
 }
 async readBody(record:CollectionRecord):Promise<string>{
  const file=await this.resolve(record,record.path);if(!file)throw Error('记录已移动、删除或更改收集属性，请刷新后核对');
  const body=collectionNoteBody(await this.app.vault.read(file),parseYaml,record);
  if(body===undefined)throw Error('记录已变化，请重新打开');
  return body;
 }
}
