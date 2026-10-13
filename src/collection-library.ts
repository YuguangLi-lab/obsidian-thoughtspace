import {App,Component,TFile,getAllTags,parseYaml} from 'obsidian';
import type {Board} from './model';
import {collectionNoteBody,readCollectionIdentity,type CollectionIdentity} from './collection-model';
import type {CollectionRecord,CollectionBoardReference} from './collection-view';
import {isWorkspaceFile} from './workspace';

export interface CollectionLibraryHost {
 isBoardFile(file:TFile):boolean;
 readBoard(file:TFile):Promise<Board>;
}
/** Metadata-only discovery. Bodies are read for visible cards and explicit
 * recovery, never retained in the whole-vault index. Original files stay native. */
export class CollectionLibrary extends Component {
 private listeners=new Set<()=>void>();
 private revision=0;
 private pending?:{revision:number;work:Promise<readonly CollectionRecord[]>};
 private boards=new Map<TFile,{stamp:string;references:CollectionBoardReference[];paths:string[]}>();
 private boardKeys=new WeakMap<TFile,string>();private nextBoardKey=0;
 private known=new Map<TFile,CollectionIdentity>();
 constructor(private readonly app:App,private readonly host:CollectionLibraryHost){super();}
 onload(){
  const changed=(file?:unknown)=>{
   if(file instanceof TFile)this.boards.delete(file);
   this.invalidate();
  };
  this.registerEvent(this.app.vault.on('create',changed));
  this.registerEvent(this.app.vault.on('modify',changed));
  this.registerEvent(this.app.vault.on('delete',changed));
  this.registerEvent(this.app.vault.on('rename',changed));
  this.registerEvent(this.app.metadataCache.on('changed',(file)=>{this.known.delete(file);changed(file);}));
 }
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 invalidate(){this.revision++;for(const listener of this.listeners)listener();}
 remember(file:TFile,identity:CollectionIdentity){this.known.set(file,identity);this.invalidate();}
 private identity(file:TFile){return readCollectionIdentity(this.app.metadataCache.getFileCache(file)?.frontmatter)||this.known.get(file);}
 identityForFile(file:TFile){return this.identity(file);}
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
   return[{...identity,path:file.path,title:file.basename,tags:[...new Set(getAllTags(this.app.metadataCache.getFileCache(file)||{})||[])],placements:(usage.get(file.path)||[]).sort((a,b)=>a.boardPath.localeCompare(b.boardPath)||a.nodeId.localeCompare(b.nodeId)),placementsComplete:known,inBoard:usage.has(file.path)?true:known?false:'unknown' as const}];
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.path.localeCompare(b.path));
 }
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
