import {TFile,TFolder,parseYaml,type App,type CachedMetadata,type HeadingCache} from 'obsidian';
import {collectionNoteBody,readCollectionIdentity,type CollectionIdentity} from './collection-model';
import type {CollectionLibrary,CollectionIdentityWatch} from './collection-library';
import {CollectionJsonStore,COLLECTION_JSON_MAX_BYTES,isCollectionJsonPath,collectionJsonCanonical} from './collection-json-store';
import {assertNativeNoteUnchanged,readCurrentNativeNote} from './native-note-state';
import {markdownRows} from './markdown-context';
import {maskInlineCode} from './markdown-literals';
import {sourceLinkParts} from './excerpt-sources';
import {paragraphLink} from './paragraph-card';

export interface CollectionNoteHeading {readonly offset:number;readonly level:number;readonly title:string;}
export type CollectionNoteTarget=
 |{readonly kind:'new';readonly path:string}
 |{readonly kind:'append';readonly path:string;readonly heading?:Pick<CollectionNoteHeading,'offset'|'level'>};
export interface CollectionNotePreview {
 readonly operationId:string;
 readonly source:Readonly<CollectionIdentity&{path:string}>;
 readonly target:Readonly<CollectionNoteTarget>;
 /** The exact insertion, including provenance and the recovery marker. */
 readonly markdown:string;
 readonly heading?:CollectionNoteHeading;
 readonly journalPath:string;
}
export type CollectionNoteExportStatus='confirmed'|'already-present'|'unknown'|'not-written';
export interface CollectionNoteExportReceipt {
 readonly operationId:string;readonly status:CollectionNoteExportStatus;
 readonly targetPath:string;readonly journalPath:string;
 readonly message?:string;readonly recoveredAfterError?:boolean;
}
export interface CollectionNoteExportBridge {
 /** A fixed plugin-owned journal directory, e.g. collection-library/note-exports. */
 directory:string;
 newId():string;
 ensureJournalDirectory(path:string):Promise<unknown>;
 isBoardFile(file:TFile):boolean;
}
export interface CollectionNoteExportJournal {
 version:1;operationId:string;source:CollectionIdentity&{path:string};
 target:CollectionNoteTarget;markdown:string;expectedHash:string;
 phase:'intent'|'receipt';receipt?:CollectionNoteExportReceipt;
}
export interface CollectionNoteExportHistory {
 readonly readOnly:true;readonly journal:CollectionNoteExportJournal|null;
 readonly receipt?:CollectionNoteExportReceipt;readonly blocked?:string;
}
type SourceRecord=CollectionIdentity&{path:string};
type SourceLock={version:1;source:CollectionIdentity&{path:string};targetPath:string;operationId:string;status:'pending'|CollectionNoteExportStatus};
type ReferenceProof={file:TFile;path:string};
type Prepared={
 preview:CollectionNotePreview;source:TFile;sourceText:string;target?:TFile;targetText:string|null;
 folder:TFolder;after:string;watch:CollectionIdentityWatch;references:ReferenceProof[];
 store:CollectionJsonStore<CollectionNoteExportJournal>;cancelled:boolean;
 pending?:Promise<CollectionNoteExportReceipt>;receipt?:CollectionNoteExportReceipt;
};
const maxBody=100000;
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const validId=(value:unknown):value is string=>typeof value==='string'&&/^export-[A-Za-z0-9_-]{1,140}$/.test(value);
const safePath=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=4096&&
 !/[\\:]/.test(value)&&!Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)&&
 value.split('/').every(part=>!!part&&part!=='.'&&part!=='..'&&!part.startsWith('.'))&&/\.md$/i.test(value);
const marker=(id:string)=>`<!-- thoughtspace-note-export:${id} -->`;
const bounded=(text:string,limit=COLLECTION_JSON_MAX_BYTES)=>{if(text.length>limit||new TextEncoder().encode(text).byteLength>limit)throw Error('笔记超过 2 MiB 整理限制');return text;};
const validHeading=(value:unknown):boolean=>object(value)&&Number.isSafeInteger(value.offset)&&Number(value.offset)>=0&&Number.isInteger(value.level)&&Number(value.level)>=1&&Number(value.level)<=6;
const validTarget=(value:unknown):value is CollectionNoteTarget=>object(value)&&safePath(value.path)&&(value.kind==='new'&&value.heading===undefined||value.kind==='append'&&(value.heading===undefined||validHeading(value.heading)));
const validStatus=(value:unknown)=>['confirmed','already-present','unknown','not-written'].includes(String(value));
export function isCollectionNoteExportJournal(value:unknown):value is CollectionNoteExportJournal {
 if(!object(value)||value.version!==1||!validId(value.operationId)||!object(value.source)||!safePath(value.source.path)||!validTarget(value.target)||
  typeof value.markdown!=='string'||value.markdown.length>maxBody+8192||!value.markdown.includes(marker(value.operationId))||
  typeof value.expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(value.expectedHash)||!['intent','receipt'].includes(String(value.phase)))return false;
 const identity=readCollectionIdentity({thoughtspace_capture:value.source.id,thoughtspace_created:value.source.createdAt});
 if(!identity)return false;
 if(value.phase==='intent')return value.receipt===undefined;
 const receipt=value.receipt;
 return object(receipt)&&receipt.operationId===value.operationId&&receipt.targetPath===value.target.path&&validStatus(receipt.status)&&
  typeof receipt.journalPath==='string'&&isCollectionJsonPath(receipt.journalPath)&&(receipt.message===undefined||typeof receipt.message==='string')&&
  (receipt.recoveredAfterError===undefined||typeof receipt.recoveredAfterError==='boolean');
}
async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join('');}
function validSourceLock(value:unknown):value is SourceLock {
 return object(value)&&value.version===1&&object(value.source)&&safePath(value.source.path)&&safePath(value.targetPath)&&!!readCollectionIdentity({thoughtspace_capture:value.source.id,thoughtspace_created:value.source.createdAt})&&
  validId(value.operationId)&&(value.status==='pending'||validStatus(value.status));
}
function exactFile(app:App,file:TFile,path:string){return file.path===path&&app.vault.getAbstractFileByPath(path)===file;}
function ensureActive(current:()=>boolean){if(!current())throw Error('页面或整理预览已关闭，请重新预览');}
function offsetLines(raw:string){const result=[0];for(let at=raw.indexOf('\n');at>=0;at=raw.indexOf('\n',at+1))result.push(at+1);return result;}
function verifiedPosition(raw:string,position:HeadingCache['position'],offsets:number[]){
 const {start,end}=position;
 if(![start.offset,end.offset,start.line,end.line,start.col,end.col].every(Number.isSafeInteger)||
  start.offset<0||end.offset<start.offset||end.offset>raw.length||
  offsets[start.line]+start.col!==start.offset||offsets[end.line]+end.col!==end.offset)throw Error('原生笔记索引尚未同步，请稍后重新预览');
}
/** Mask code/comments without changing source offsets; cache entries may never edit them. */
function visibleSource(raw:string):string{
 if(raw.startsWith('\uFEFF'))return ' '+visibleSource(raw.slice(1));
 return [...markdownRows(raw)].map(row=>row.code?' '.repeat(row.source.length):maskInlineCode(row.visible)+(row.source.endsWith('\r')?'\r':'')).join('\n');
}
function closedMarkdown(raw:string){
 let open=false;for(const row of markdownRows(raw.replace(/^\uFEFF/,'')))open=!!row.openBlock;
 if(open)throw Error('笔记末尾的代码块或注释尚未闭合，请先在原生笔记中完成后重新预览');
}
function verifiedHeadings(raw:string,cache:CachedMetadata):CollectionNoteHeading[]{
 const offsets=offsetLines(raw),visible=visibleSource(raw),result:CollectionNoteHeading[]=[];
 for(const item of cache.headings||[]){
  verifiedPosition(raw,item.position,offsets);
  const offset=item.position.start.offset,end=raw.indexOf('\n',offset),line=raw.slice(offset,end<0?raw.length:end).replace(/\r$/,'');
  const atx=/^ {0,3}(#{1,6})[ \t]+/.exec(line);
  const next=end<0?'':raw.slice(end+1,raw.indexOf('\n',end+1)<0?raw.length:raw.indexOf('\n',end+1)).replace(/\r$/,'');
  const setext=/^ {0,3}(=+|-+)[ \t]*$/.exec(next);
  const level=atx?.[1].length||(setext?(setext[1][0]==='='?1:2):0);
  const title=(atx?line.slice(atx[0].length).replace(/[ \t]+#+[ \t]*$/,''):line).trim();
  if(level!==item.level||title!==item.heading||!visible.slice(offset,offset+line.length).trim())throw Error('目标标题索引尚未同步，请稍后重新预览');
  result.push({offset,level:item.level,title:item.heading});
 }
 result.sort((a,b)=>a.offset-b.offset);
 if(result.some((heading,i)=>i>0&&heading.offset===result[i-1].offset))throw Error('目标标题索引重复，请重新预览');
 // Detect a common stale-cache omission rather than append into the wrong section.
 for(const match of visible.matchAll(/^ {0,3}(#{1,6})[ \t]+[^\n]*/gm)){
  if(!result.some(item=>item.offset===match.index&&item.level===match[1].length))throw Error('目标标题索引尚未同步，请稍后重新预览');
 }
 for(const match of visible.matchAll(/^([^\n]+)\n {0,3}(=+|-+)[ \t\r]*$/gm)){
  if(match[1].trim()&&!result.some(item=>item.offset===match.index&&item.level===(match[2][0]==='='?1:2)))throw Error('目标标题索引尚未同步，请稍后重新预览');
 }
 return result;
}
function relativePath(sourcePath:string,link:string){
 const parts=sourcePath.split('/').slice(0,-1);
 for(const part of link.split('/')){if(part==='.'||!part)continue;if(part==='..'){if(!parts.length)return;parts.pop();}else parts.push(part);}
 return parts.join('/');
}
function uniqueDestination(app:App,path:string,source:TFile):TFile {
 if(!path)return source;
 const resolved=app.metadataCache.getFirstLinkpathDest(path,source.path);
 if(!(resolved instanceof TFile))throw Error(`链接尚未解析：${path}`);
 const exact=[path,relativePath(source.path,path)].filter((candidate):candidate is string=>candidate!==undefined);
 if(exact.some(candidate=>resolved.path===candidate||resolved.path===candidate+'.md'))return resolved;
 const matches=app.vault.getFiles().filter(file=>file.path===path||file.path===path+'.md'||file.path.endsWith('/'+path)||file.path.endsWith('/'+path+'.md'));
 if(matches.length!==1||matches[0]!==resolved)throw Error(`链接存在同名歧义：${path}`);
 return resolved;
}
const external=(link:string)=>/^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(link);
/** Only exact, source-indexed native links are rewritten. Unindexed syntax fails closed. */
function rebase(app:App,source:TFile,raw:string,body:string,cache:CachedMetadata){
 const bodyOffset=raw.length-body.length,offsets=offsetLines(raw),visible=visibleSource(raw);
 for(const reference of cache.referenceLinks||[])if(!external(reference.link))throw Error('本地引用式链接暂不能安全移动，请先改为直接链接后重新预览');
 for(const match of visible.slice(bodyOffset).matchAll(/^ {0,3}\[[^\]\n]+\]:[ \t]*(\S+)/gm))if(!external(match[1].replace(/^<|>$/g,'')))throw Error('本地引用式链接暂不能安全移动，请先改为直接链接后重新预览');
 const edits:{start:number;end:number;text:string}[]=[],references:ReferenceProof[]=[];
 for(const item of [...cache.links||[],...cache.embeds||[]]){
  verifiedPosition(raw,item.position,offsets);
  const start=item.position.start.offset,end=item.position.end.offset;
  if(raw.slice(start,end)!==item.original)throw Error('原文链接索引尚未同步，请重新预览');
  if(start<bodyOffset)continue;
  if(!visible.slice(start,end).trim()||visible[start]!==raw[start])throw Error('原文链接索引与代码区域不一致，请重新预览');
  const embed=item.original.startsWith('!'),link=embed?item.original.slice(1):item.original;
  const parts=sourceLinkParts(link);
  if(!parts.length)throw Error('暂不支持此原生链接格式，请先在原笔记中改为直接链接');
  if(external(parts[0].path))continue;
  let destination:TFile|undefined,chosen:typeof parts[number]|undefined,error:unknown;
  for(const part of parts){try{destination=uniqueDestination(app,part.path,source);chosen=part;break;}catch(caught){error=caught;}}
  if(!destination||!chosen)throw error instanceof Error?error:Error('无法确认原文链接');
  references.push({file:destination,path:destination.path});
  const alias=item.displayText??(link.startsWith('[[')?undefined:/^\[([\s\S]*?)\]\(/.exec(link)?.[1]);
  // The output note may not exist yet. Native shortest-link generation cannot
  // account for its future basename, so pin every reference to the exact vault
  // path (including extension), as paragraph provenance already does.
  const generated=paragraphLink(destination.path,chosen.subpath,alias);
  edits.push({start,end,text:(embed?'!':'')+generated});
 }
 edits.sort((a,b)=>a.start-b.start);
 if(edits.some((item,i)=>i>0&&item.start<edits[i-1].end))throw Error('原文链接索引重叠，请重新预览');
 // Every remaining local wiki/inline/reference link must have a verified native
 // entry. This also catches an empty/stale cache without rewriting code examples.
 let remaining=visible.slice(bodyOffset);
 for(const item of [...cache.links||[],...cache.embeds||[]]){
  const start=item.position.start.offset-bodyOffset,end=item.position.end.offset-bodyOffset;
  if(start>=0)remaining=remaining.slice(0,start)+' '.repeat(end-start)+remaining.slice(end);
 }
 for(const match of remaining.matchAll(/!?\[\[[^\n]*?\]\]|!?\[[^\n]*?\](?:\([^\n]*?\)|\[[^\n]*?\])/g)){
  const link=match[0].replace(/^!/,'');const parts=sourceLinkParts(link);
  if(parts.length&&external(parts[0].path))continue;
  const preceding=remaining.slice(0,match.index),slashes=/\\+$/.exec(preceding)?.[0].length||0;
  if(slashes%2)continue;
  throw Error('原文仍有未确认的本地链接，请等待原生索引同步或改为直接链接');
 }
 let text=body;
 for(const item of [...edits].reverse())text=text.slice(0,item.start-bodyOffset)+item.text+text.slice(item.end-bodyOffset);
 return{text,references};
}
function insertAt(source:string,offset:number,addition:string){
 const before=source.slice(0,offset),after=source.slice(offset),separator=source.includes('\r\n')?'\r\n':'\n';
 return before+(before&&!before.endsWith(separator+separator)?before.endsWith(separator)?separator:separator+separator:'')+addition+
  (after&&!addition.endsWith(separator+separator)?addition.endsWith(separator)?separator:separator+separator:'')+after;
}

/** Preview authority lives only in this instance. Journals are recovery evidence,
 * never commands to replay. No operation here changes or archives the source. */
export class CollectionNoteExporter {
 private readonly prepared=new Map<CollectionNotePreview,Prepared>();
 constructor(private readonly app:App,private readonly library:CollectionLibrary,private readonly bridge:CollectionNoteExportBridge){}
 private journalPath(id:string){if(!validId(id))throw Error('整理操作标识无效');const path=`${this.bridge.directory}/${id}.json`;if(!isCollectionJsonPath(path))throw Error('整理历史目录无效');return path;}
 private store(id:string){return new CollectionJsonStore(this.app.vault.adapter,this.journalPath(id),()=>this.bridge.newId(),isCollectionNoteExportJournal);}
 private async sourceStore(identity:CollectionIdentity){
  const key=await digest(JSON.stringify([identity.id,identity.createdAt]));
  return new CollectionJsonStore(this.app.vault.adapter,`${this.bridge.directory}/source-${key}.json`,()=>this.bridge.newId(),validSourceLock);
 }
 private async availableSource(store:CollectionJsonStore<SourceLock>,identity:CollectionIdentity){
  const previous=await store.read();
  if(previous.blocked)throw Error(previous.blocked);
  if(previous.value){
   if(previous.value.source.id!==identity.id||previous.value.source.createdAt!==identity.createdAt)throw Error('整理来源历史标识不一致，请先核对');
   if(previous.value.status==='pending'||previous.value.status==='unknown')throw Error(`此收集仍有待核对的整理 ${previous.value.operationId}；请先查看整理历史与目标，不能自动重试`);
  }
 }
 private ordinary(path:string):TFile {
  if(!safePath(path))throw Error('请选择资料库内的普通 Markdown 笔记');
  const file=this.app.vault.getAbstractFileByPath(path);
  if(!(file instanceof TFile)||file.extension.toLowerCase()!=='md'||this.bridge.isBoardFile(file))throw Error('目标必须是已有普通 Markdown 笔记');
  if(file.stat.size>COLLECTION_JSON_MAX_BYTES)throw Error('目标笔记超过 2 MiB 整理限制');
  return file;
 }
 async headings(path:string,current:()=>boolean):Promise<readonly CollectionNoteHeading[]>{
  ensureActive(current);const file=this.ordinary(path),text=bounded(await readCurrentNativeNote(this.app,file));ensureActive(current);
  if(!exactFile(this.app,file,path))throw Error('目标笔记已移动或替换');
  const cache=this.app.metadataCache.getFileCache(file);if(!cache)throw Error('目标笔记索引尚未就绪');
  return Object.freeze(verifiedHeadings(text,cache).map(item=>Object.freeze(item)));
 }
 async prepare(record:SourceRecord,target:CollectionNoteTarget,current:()=>boolean):Promise<CollectionNotePreview>{
  ensureActive(current);
  if(!validTarget(target)||target.path===record.path)throw Error('整理目标不能是原收集笔记，且必须是普通 Markdown 路径');
  const identity=Object.freeze({id:record.id,createdAt:record.createdAt,path:record.path});
  await this.availableSource(await this.sourceStore(identity),identity);ensureActive(current);
  const targetCopy:CollectionNoteTarget=target.kind==='new'?{kind:'new',path:target.path}:{kind:'append',path:target.path,...(target.heading?{heading:Object.freeze({...target.heading})}:{})};
  const source=await this.library.resolve(identity,identity.path);ensureActive(current);
  if(!source||!exactFile(this.app,source,identity.path)||this.bridge.isBoardFile(source))throw Error('原收集笔记已移动或替换');
  const sourceText=bounded(await readCurrentNativeNote(this.app,source));ensureActive(current);
  closedMarkdown(sourceText);
  const body=collectionNoteBody(sourceText,parseYaml,identity);
  if(body===undefined||body.length>maxBody)throw Error('原收集身份已变化或正文超过 100,000 字符');
  let file:TFile|undefined,targetText:string|null=null,heading:CollectionNoteHeading|undefined,offset=0;
  const folderPath=targetCopy.path.includes('/')?targetCopy.path.slice(0,targetCopy.path.lastIndexOf('/')):'';
  const folder=folderPath?this.app.vault.getAbstractFileByPath(folderPath):this.app.vault.getRoot();
  if(!(folder instanceof TFolder))throw Error('请选择已经存在的目标文件夹');
  if(targetCopy.kind==='new'){
   if(this.app.vault.getAbstractFileByPath(targetCopy.path)||await this.app.vault.adapter.exists(targetCopy.path))throw Error('目标文件已存在，请明确选择其他文件名后重新预览');
  }else{
   file=this.ordinary(targetCopy.path);
   if(file===source)throw Error('不能整理到原收集笔记本身');
   targetText=bounded(await readCurrentNativeNote(this.app,file));closedMarkdown(targetText);offset=targetText.length;
   if(targetCopy.heading){
    const cache=this.app.metadataCache.getFileCache(file);if(!cache)throw Error('目标标题索引尚未就绪');
    const headings=verifiedHeadings(targetText,cache);
    heading=headings.find(item=>item.offset===targetCopy.heading!.offset&&item.level===targetCopy.heading!.level);
    if(!heading)throw Error('目标标题已变化，请重新选择');
    offset=headings.find(item=>item.offset>heading!.offset&&item.level<=heading!.level)?.offset??targetText.length;
   }
  }
  ensureActive(current);
  if(!exactFile(this.app,source,identity.path)||file&&!exactFile(this.app,file,targetCopy.path))throw Error('笔记在预览期间移动或替换');
  assertNativeNoteUnchanged(this.app,source,sourceText);if(file)assertNativeNoteUnchanged(this.app,file,targetText!);
  const cache=this.app.metadataCache.getFileCache(source);if(!cache)throw Error('原收集笔记链接索引尚未就绪');
  if(collectionNoteBody(sourceText,parseYaml,identity)===undefined)throw Error('原收集身份已变化');
  const rebased=rebase(this.app,source,sourceText,body,cache);
  const operationId=`export-${Date.now()}-${this.bridge.newId()}`,journalPath=this.journalPath(operationId);
  const markdown=`${marker(operationId)}\n${rebased.text}${rebased.text.endsWith('\n')?'':'\n'}\n> 来源：${paragraphLink(source.path)}\n`;
  if(markdown.length>maxBody+8192)throw Error('整理正文与链接超过大小限制');
  const after=bounded(targetText===null?markdown:insertAt(targetText,offset,markdown));
  const preview=Object.freeze({operationId,source:identity,target:Object.freeze(targetCopy),markdown,...(heading?{heading:Object.freeze(heading)}:{}),journalPath});
  const watch=this.library.watchIdentity(identity,{allowSourceChanges:false});
  if(!watch.current(source)){watch.release();throw Error('原收集身份或索引已变化，请重新预览');}
  this.prepared.set(preview,{preview,source,sourceText,target:file,targetText,folder,after,watch,references:rebased.references,store:this.store(operationId),cancelled:false});
  return preview;
 }
 discard(preview:CollectionNotePreview){const entry=this.prepared.get(preview);if(!entry)return;entry.cancelled=true;if(!entry.pending){entry.watch.release();this.prepared.delete(preview);}}
 dispose(){for(const preview of this.prepared.keys())this.discard(preview);}
 commit(preview:CollectionNotePreview,current:()=>boolean):Promise<CollectionNoteExportReceipt>{
  const entry=this.prepared.get(preview);
  if(!entry)return Promise.resolve(Object.freeze({operationId:preview.operationId,status:'not-written',targetPath:preview.target.path,journalPath:preview.journalPath,message:'整理预览已失效，请重新预览；历史记录不能重放'}));
  if(entry.pending)return entry.pending;
  if(entry.receipt)return Promise.resolve(entry.receipt.status==='confirmed'?Object.freeze({...entry.receipt,status:'already-present'}):entry.receipt);
  entry.pending=this.execute(entry,current).then(receipt=>{entry.receipt=receipt;return receipt;}).finally(()=>{
   entry.watch.release();entry.pending=undefined;
   entry.sourceText='';entry.targetText=null;entry.after='';entry.references=[];
   if(entry.cancelled)this.prepared.delete(preview);
  });
  return entry.pending;
 }
 private guard(entry:Prepared,current:()=>boolean){
  ensureActive(()=>!entry.cancelled&&current());
  const {source,sourceText,preview,target,targetText,folder}=entry;
  if(!exactFile(this.app,source,preview.source.path)||!entry.watch.current(source))throw Error('原收集笔记或身份已变化，请重新预览');
  assertNativeNoteUnchanged(this.app,source,sourceText);
  const folderPath=preview.target.path.includes('/')?preview.target.path.slice(0,preview.target.path.lastIndexOf('/')):'';
  if((folderPath?this.app.vault.getAbstractFileByPath(folderPath):this.app.vault.getRoot())!==folder)throw Error('目标文件夹已变化');
  if(target){if(!exactFile(this.app,target,preview.target.path)||this.bridge.isBoardFile(target))throw Error('目标笔记已移动或替换');assertNativeNoteUnchanged(this.app,target,targetText!);}
  else if(this.app.vault.getAbstractFileByPath(preview.target.path))throw Error('目标文件已存在，未覆盖');
  for(const reference of entry.references)if(!exactFile(this.app,reference.file,reference.path))throw Error('原文附件或关联笔记已移动或替换，请重新预览');
 }
 private receipt(entry:Prepared,status:CollectionNoteExportStatus,message?:string,recoveredAfterError?:boolean):CollectionNoteExportReceipt {
  return Object.freeze({operationId:entry.preview.operationId,status,targetPath:entry.preview.target.path,journalPath:entry.preview.journalPath,...(message?{message}:{}),...(recoveredAfterError?{recoveredAfterError}: {})});
 }
 private async execute(entry:Prepared,current:()=>boolean):Promise<CollectionNoteExportReceipt>{
  let intent:CollectionNoteExportJournal|undefined,attempted=false,failure:unknown,created:TFile|undefined,creationAmbiguous=false;
  let sourceStore:CollectionJsonStore<SourceLock>|undefined,sourceLock:SourceLock|undefined;
  let receipt:CollectionNoteExportReceipt;
  try{
   this.guard(entry,current);
   if(bounded(await this.app.vault.read(entry.source))!==entry.sourceText)throw Error('原收集正文已变化，请重新预览');
   this.guard(entry,current);
   if(entry.target&&bounded(await this.app.vault.read(entry.target))!==entry.targetText)throw Error('目标笔记正文已变化，请重新预览');
   this.guard(entry,current);
   await this.bridge.ensureJournalDirectory(this.bridge.directory);this.guard(entry,current);
   sourceStore=await this.sourceStore(entry.preview.source);await this.availableSource(sourceStore,entry.preview.source);this.guard(entry,current);
   const lock:SourceLock={version:1,source:{...entry.preview.source},targetPath:entry.preview.target.path,operationId:entry.preview.operationId,status:'pending'};
   await sourceStore.write(lock,()=>!entry.cancelled&&current());sourceLock=lock;this.guard(entry,current);
   const previous=await entry.store.read();if(previous.blocked||previous.value)throw Error(previous.blocked||'已有同标识整理历史，未重放');
   intent={version:1,operationId:entry.preview.operationId,source:{...entry.preview.source},target:entry.preview.target,markdown:entry.preview.markdown,expectedHash:await digest(entry.after),phase:'intent'};
   await entry.store.write(intent,()=>!entry.cancelled&&current());this.guard(entry,current);
   if(entry.target){
    try{await this.app.vault.process(entry.target,raw=>{
     this.guard(entry,current);
     if(attempted)throw Error('宿主重复调用整理写入，已停止');
     if(raw!==entry.targetText)throw Error('目标笔记同时有其他编辑，未覆盖');
     attempted=true;return entry.after;
    });}catch(error){failure=error;}
   }else{
    if(await this.app.vault.adapter.exists(entry.preview.target.path))throw Error('目标文件已存在，未覆盖');
    this.guard(entry,current);
    const observed=this.app.vault.on('create',file=>{if(file.path===entry.preview.target.path){if(!(file instanceof TFile)||created&&created!==file)creationAmbiguous=true;else created=file;}});
    const renamed=this.app.vault.on('rename',(file,oldPath)=>{if(file===created||oldPath===entry.preview.target.path||file.path===entry.preview.target.path)creationAmbiguous=true;});
    try{attempted=true;const result=await this.app.vault.create(entry.preview.target.path,entry.after);if(created&&created!==result)creationAmbiguous=true;created=result;}
    catch(error){failure=error;}
    finally{this.app.vault.offref(observed);this.app.vault.offref(renamed);}
   }
   // Deliberately independent of page lifetime after the atomic write was entered.
   const file=entry.target||created,path=entry.preview.target.path,atPath=this.app.vault.getAbstractFileByPath(path);
   if(attempted&&file&&!creationAmbiguous&&exactFile(this.app,file,path)){
    const raw=bounded(await this.app.vault.read(file));
    if(!exactFile(this.app,file,path))throw Error('写入后目标笔记已移动或替换');
    if(raw===entry.after&&raw.split(marker(entry.preview.operationId)).length===2)receipt=this.receipt(entry,'confirmed',undefined,failure!==undefined);
    else if(entry.target&&raw===entry.targetText)receipt=this.receipt(entry,'not-written',failure===undefined?'宿主未完成目标写入':errorText(failure));
    else receipt=this.receipt(entry,'unknown','目标写入结果与预览不一致，请先核对；不会自动重试');
   }else if(!attempted)receipt=this.receipt(entry,'not-written',failure===undefined?'宿主未执行目标写入':errorText(failure));
   else if(!entry.target&&!atPath&&!await this.app.vault.adapter.exists(path))receipt=this.receipt(entry,'not-written',failure===undefined?'未发现目标文件':errorText(failure));
   else receipt=this.receipt(entry,'unknown','目标写入身份无法确认，请先核对；不会自动重试');
  }catch(error){receipt=this.receipt(entry,attempted?'unknown':'not-written',errorText(error));}
  if(intent){
   try{await entry.store.write({...intent,phase:'receipt',receipt},()=>true);}
   catch(error){receipt=this.receipt(entry,attempted?'unknown':'not-written',`${receipt.message?receipt.message+'；':''}整理回执保存未确认：${errorText(error)}。原收集记录保留，请核对历史与目标后再操作`);}
  }
  if(sourceLock&&sourceStore){
   try{await sourceStore.write({...sourceLock,status:receipt.status},()=>true);}
   catch(error){receipt=this.receipt(entry,attempted?'unknown':'not-written',`${receipt.message?receipt.message+'；':''}来源整理状态保存未确认：${errorText(error)}。请先核对历史，不能自动重试`);}
  }
  return receipt;
 }
 async history():Promise<{items:CollectionNoteExportHistory[];warning?:string}>{
  const adapter=this.app.vault.adapter;
  if(!await adapter.exists(this.bridge.directory))return{items:[]};
  const listed=await adapter.list(this.bridge.directory),canonical=new Set<string>(),sourceLocks=new Set<string>();
  for(const path of listed.files){
   const value=collectionJsonCanonical(path);
   if(value?.startsWith(this.bridge.directory+'/')&&value.slice(this.bridge.directory.length+1).match(/^export-[A-Za-z0-9_-]+\.json$/))canonical.add(value);
   if(value?.startsWith(this.bridge.directory+'/')&&/^source-[a-f0-9]{64}\.json$/.test(value.slice(this.bridge.directory.length+1)))sourceLocks.add(value);
  }
  const paths=[...canonical].sort((a,b)=>b.localeCompare(a)),items:CollectionNoteExportHistory[]=[];
  for(const path of paths.slice(0,20)){
   const id=path.slice(this.bridge.directory.length+1,-5);
   try{items.push(await this.inspect(id));}catch(error){items.push({readOnly:true,journal:null,blocked:errorText(error)});}
  }
  // A process can stop after locking a source but before creating its operation
  // journal. Surface that evidence as well; reading it never unlocks the source.
  for(const path of [...sourceLocks].sort().slice(0,64)){
   try{
    const read=await new CollectionJsonStore(adapter,path,()=>this.bridge.newId(),validSourceLock).read(),lock=read.value;
    if(read.blocked){items.push({readOnly:true,journal:null,blocked:`来源整理状态待核对：${read.blocked}（${path}）`});continue;}
    if(lock&&(lock.status==='pending'||lock.status==='unknown')&&!canonical.has(this.journalPath(lock.operationId)))items.push({
     readOnly:true,journal:null,receipt:{operationId:lock.operationId,status:'unknown',targetPath:lock.targetPath,journalPath:this.journalPath(lock.operationId),
      message:`来源 ${lock.source.path} 的整理已保留待核对状态，但完整操作日志尚未确认。原收集与锁文件保留；不会自动解锁或重试。`},
    });
   }catch(error){items.push({readOnly:true,journal:null,blocked:`来源整理状态无法核对：${errorText(error)}`});}
  }
  items.sort((a,b)=>(b.journal?.operationId||b.receipt?.operationId||'~').localeCompare(a.journal?.operationId||a.receipt?.operationId||'~'));
  const warning=[...(paths.length>20||items.length>20?['仅显示最近 20 次整理；更早的历史与恢复材料仍保留在插件目录']:[]),
   ...(sourceLocks.size>64?['来源状态核对达到 64 项上限；未列出的来源仍由各自状态锁保护，当前历史列表可能不完整']:[])].join('。');
  return{items:items.slice(0,20),...(warning?{warning}:{})};
 }
 /** Loading history never recreates preview authority or updates any file. */
 async inspect(operationId:string):Promise<CollectionNoteExportHistory>{
  const result=await this.store(operationId).read(),journal=result.value;
  if(!journal||result.blocked)return{readOnly:true,journal,blocked:result.blocked};
  const journalPath=this.journalPath(operationId);
  if(journal.operationId!==operationId||journal.receipt&&journal.receipt.journalPath!==journalPath)return{readOnly:true,journal,blocked:'整理历史标识或路径不一致，仅供核对'};
  if(journal.phase==='receipt'&&journal.receipt?.status!=='unknown')return{readOnly:true,journal,receipt:Object.freeze({...journal.receipt!})};
  const receiptBase={operationId,targetPath:journal.target.path,journalPath};
  try{
   const file=this.ordinary(journal.target.path),text=bounded(await this.app.vault.read(file));
   if(exactFile(this.app,file,journal.target.path)&&text.split(marker(operationId)).length===2&&text.includes(journal.markdown)&&await digest(text)===journal.expectedHash)
    return{readOnly:true,journal,receipt:Object.freeze({...receiptBase,status:'confirmed',message:'从目标文件只读核对完成；历史不会自动重放'})};
  }catch{/* An interrupted intent never authorizes another write. */}
  return{readOnly:true,journal,receipt:Object.freeze({...receiptBase,status:'unknown',message:'这次整理尚无可确认回执，请人工核对原收集与目标；历史不会重放'})};
 }
}
