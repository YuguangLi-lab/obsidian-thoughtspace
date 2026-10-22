import {TFile,parseLinktext,type App,type CachedMetadata,type EventRef} from 'obsidian';
import {readCollectionIdentity,type CollectionIdentity} from './collection-model';
import {isWorkspaceFile} from './workspace';
import type {CollectionRecord} from './collection-view';

export type CollectionAttachmentKind='image'|'pdf'|'audio'|'video'|'other';
export interface CollectionContextItem {
 key:string;direction:'outgoing'|'incoming'|'attachment';path:string;title:string;
 kind:'note'|CollectionAttachmentKind|'missing';count:number;missing?:true;
 collection?:CollectionIdentity;subpath?:string;
}
export interface CollectionAttachmentItem extends CollectionContextItem {
 direction:'attachment';kind:CollectionAttachmentKind;source:CollectionRecord;
}
export interface CollectionRecordContext {
 outgoing:CollectionContextItem[];incoming:CollectionContextItem[];attachments:CollectionContextItem[];
 total:{outgoing:number;incoming:number;attachments:number};metadataReady:boolean;truncated:boolean;unknown:number;
}
export interface CollectionAttachmentQuery {query?:string;kind?:'all'|CollectionAttachmentKind;offset?:number;limit?:number;}
export interface CollectionAttachmentPage {
 items:CollectionAttachmentItem[];total:number;unknown:number;unresolved:number;offset:number;limit:number;truncated:boolean;scanned:number;
}
export interface CollectionContextLibrary {identityForFile(file:TFile):CollectionIdentity|undefined;}
type ReferenceGroup={file?:TFile;path:string;title:string;count:number;subpath?:string;};
type References={groups:ReferenceGroup[];truncated:boolean;};
type Proof={
 source:TFile;sourcePath:string;identity:CollectionIdentity;sourceStamp:string;sourceRevision:number;
 target:TFile;targetPath:string;targetStamp:string;targetRevision:number;direction:CollectionContextItem['direction'];
 targetIdentity?:CollectionIdentity;subpath?:string;
};
const SECTION_LIMIT=100,REFERENCE_LIMIT=5000,RECORD_LIMIT=10000,PAGE_LIMIT=48;
const kinds:readonly CollectionAttachmentKind[]=['image','pdf','audio','video','other'];
const fold=(value:string)=>value.normalize('NFC').toLocaleLowerCase();
const stamp=(file:TFile)=>`${file.stat.ctime}:${file.stat.mtime}:${file.stat.size}`;

/** Classify only a host-resolved native file. An unresolved suffix is never
 * guessed to be an attachment and no URL or binary file is loaded here. */
export function collectionAttachmentKind(extension:string):CollectionAttachmentKind {
 const ext=extension.toLowerCase();
 if(['png','jpg','jpeg','gif','webp','avif','bmp','svg','heic','heif'].includes(ext))return'image';
 if(ext==='pdf')return'pdf';
 if(['mp3','wav','ogg','oga','m4a','aac','flac','opus','aiff'].includes(ext))return'audio';
 if(['mp4','m4v','mov','webm','ogv','mkv'].includes(ext))return'video';
 return'other';
}

/** Per-view, read-only native metadata service. Returned object identity is its
 * navigation capability; strings copied from data attributes are not authority.
 * The WeakMap retains neither old pages nor an unbounded token registry. */
export class CollectionContext {
 private proofs=new WeakMap<CollectionContextItem,Proof>();
 private revisions=new WeakMap<TFile,number>();
 private dirty=new WeakSet<TFile>();
 private off:(()=>void)[]=[];
 private disposed=false;private serial=0;private revision=0;
 constructor(private readonly app:App,private readonly library:CollectionContextLibrary){
  const bump=(file:unknown)=>{this.revision++;if(file instanceof TFile)this.revisions.set(file,(this.revisions.get(file)||0)+1);};
  const edited=(file:unknown)=>{bump(file);if(file instanceof TFile&&file.extension.toLowerCase()==='md')this.dirty.add(file);};
  const cached=(file:TFile)=>{bump(file);this.dirty.delete(file);};
  const vault=(ref:EventRef)=>this.off.push(()=>this.app.vault.offref(ref));
  const metadata=(ref:EventRef)=>this.off.push(()=>this.app.metadataCache.offref(ref));
  vault(app.vault.on('create',edited));vault(app.vault.on('modify',edited));
  vault(app.vault.on('delete',bump));vault(app.vault.on('rename',bump));
  metadata(app.metadataCache.on('changed',cached));metadata(app.metadataCache.on('deleted',bump));
  metadata(app.metadataCache.on('resolve',bump));
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const off of this.off)off();this.off=[];
  this.proofs=new WeakMap();this.revisions=new WeakMap();this.dirty=new WeakSet();
 }
 private active(current:()=>boolean){if(this.disposed||!current())throw Error('页面已变化，请重新打开引用或附件');}
 private native(file:unknown):file is TFile {
  if(!(file instanceof TFile)||this.app.vault.getAbstractFileByPath(file.path)!==file||!isWorkspaceFile(file))return false;
  const config=this.app.vault.configDir;
  if(file.path===config||file.path.startsWith(config+'/'))return false;
  return !['thoughtspace','canvas'].includes(file.extension.toLowerCase());
 }
 private identities():Map<string,number>{
  const counts=new Map<string,number>();
  for(const file of this.app.vault.getMarkdownFiles()){
   if(!this.native(file))continue;
   const identity=this.library.identityForFile(file);
   if(identity)counts.set(identity.id,(counts.get(identity.id)||0)+1);
  }
  return counts;
 }
 private source(record:CollectionRecord,identities=this.identities()):TFile {
  const file=this.app.vault.getAbstractFileByPath(record.path);
  if(!this.native(file)||file.extension.toLowerCase()!=='md')throw Error('原记录已移动、删除或替换，请刷新后重试');
  const cached=this.app.metadataCache.getFileCache(file);
  // A remembered identity only bridges a genuinely unavailable native cache.
  // It cannot override an indexed removal or invalidation of the properties.
  const identity=cached?readCollectionIdentity(cached.frontmatter):this.library.identityForFile(file);
  if(identity?.id!==record.id||identity.createdAt!==record.createdAt)throw Error('原记录收集身份已变化，请刷新后重试');
  if(identities.get(record.id)!==1)throw Error('发现重复的收集标识，请先核对原笔记');
  return file;
 }
 private cache(file:TFile):CachedMetadata|null {
  if(this.dirty.has(file))return null;
  return this.app.metadataCache.getFileCache(file);
 }
 private references(file:TFile,cache:CachedMetadata):References {
  const groups=new Map<string,ReferenceGroup>();
  let seen=0,truncated=false;
  // Native metadata already excludes code blocks and distinguishes Markdown
  // reference destinations. Resolve paths using the host, never a path guess.
  const sources=[cache.links,cache.embeds,cache.frontmatterLinks];
  outer:for(const references of sources){
   for(const reference of references||[]){
    if(++seen>REFERENCE_LIMIT){truncated=true;break outer;}
    const link=reference.link;
    if(typeof link!=='string'||!link.trim()||/^[a-z][a-z\d+.-]*:|^\/\//iu.test(link.trim()))continue;
    const parsed=parseLinktext(link),target=parsed.path?this.app.metadataCache.getFirstLinkpathDest(parsed.path,file.path):parsed.subpath?file:null;
    if(target&&!this.native(target))continue;
    const targetPath=target?.path||parsed.path;
    if(!targetPath)continue;
    const key=(target?'file:':'missing:')+targetPath;
    const previous=groups.get(key),subpath=parsed.subpath||undefined;
    if(previous){previous.count++;if(previous.subpath!==subpath)previous.subpath=undefined;continue;}
    groups.set(key,{file:target||undefined,path:targetPath,title:target?.name||targetPath,count:1,subpath});
   }
  }
  return{groups:[...groups.values()],truncated};
 }
 private item(record:CollectionRecord,source:TFile,group:ReferenceGroup,direction:CollectionContextItem['direction']):CollectionContextItem {
  const target=group.file,kind=target?target.extension.toLowerCase()==='md'?'note':collectionAttachmentKind(target.extension):'missing';
  const collection=target?.extension.toLowerCase()==='md'?readCollectionIdentity(this.cache(target)?.frontmatter):undefined;
  const item:CollectionContextItem={key:`context-${++this.serial}`,direction,path:group.path,title:group.title,kind,count:group.count,
   ...(target?{}:{missing:true}),...(collection?{collection}:{}),...(group.subpath?{subpath:group.subpath}:{})};
  if(target)this.proofs.set(item,{
   source,sourcePath:source.path,identity:{id:record.id,createdAt:record.createdAt},sourceStamp:stamp(source),sourceRevision:this.revisions.get(source)||0,
   target,targetPath:target.path,targetStamp:stamp(target),targetRevision:this.revisions.get(target)||0,direction,targetIdentity:collection,subpath:group.subpath,
  });
  return item;
 }
 async inspect(record:CollectionRecord,current:()=>boolean=()=>true):Promise<CollectionRecordContext>{
  this.active(current);const source=this.source(record),cache=this.cache(source);
  const result:CollectionRecordContext={outgoing:[],incoming:[],attachments:[],total:{outgoing:0,incoming:0,attachments:0},metadataReady:!!cache,truncated:false,unknown:0};
  if(!cache){result.unknown=1;return result;}
  const references=this.references(source,cache);result.truncated=references.truncated;
  for(const group of references.groups){
   const attachment=!!group.file&&group.file.extension.toLowerCase()!=='md',section=attachment?'attachments':'outgoing';
   result.total[section]++;
   if(result[section].length<SECTION_LIMIT)result[section].push(this.item(record,source,group,attachment?'attachment':'outgoing'));
   else result.truncated=true;
  }
  const resolved=this.app.metadataCache.resolvedLinks;
  if(!resolved||typeof resolved!=='object'){result.unknown++;return result;}
  let scanned=0;
  for(const path in resolved){
   if(!Object.hasOwn(resolved,path))continue;
   if(++scanned>RECORD_LIMIT){result.truncated=true;break;}
   this.active(current);
   const targets=resolved[path];
   if(!(targets?.[source.path]>0)||path===source.path)continue;
   const target=this.app.vault.getAbstractFileByPath(path);
   if(!this.native(target)||target.extension.toLowerCase()!=='md')continue;
   const targetCache=this.cache(target);
   if(!targetCache){result.unknown++;continue;}
   const back=this.references(target,targetCache);result.truncated||=back.truncated;
   const relationship=back.groups.find(group=>group.file===source);
   // A stale reverse index alone cannot authorize a jump. The source's native
   // cached links must still resolve to this exact collection file as well.
   if(!relationship)continue;
   result.total.incoming++;
   if(result.incoming.length<SECTION_LIMIT)result.incoming.push(this.item(record,source,{file:target,path:target.path,title:target.basename,count:relationship.count},'incoming'));
   else result.truncated=true;
  }
  this.active(current);return result;
 }
 async attachments(records:readonly CollectionRecord[],options:CollectionAttachmentQuery={},current:()=>boolean=()=>true):Promise<CollectionAttachmentPage>{
  this.active(current);
  const {query='',kind='all',offset=0,limit=24}=options;
  if(typeof query!=='string'||kind!=='all'&&!kinds.includes(kind)||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1)throw Error('附件筛选参数无效');
  const result:CollectionAttachmentPage={items:[],total:0,unknown:0,unresolved:0,offset,limit:Math.min(limit,PAGE_LIMIT),truncated:records.length>RECORD_LIMIT,scanned:0};
  const revision=this.revision,terms=fold(query.trim()).split(/\s+/u).filter(Boolean),identities=this.identities(),seen=new Set<string>();
  for(const record of records.slice(0,RECORD_LIMIT)){
   this.active(current);if(revision!==this.revision)throw Error('附件索引有更新，请刷新后重试');
   if(seen.has(record.path))continue;seen.add(record.path);result.scanned++;
   let source:TFile;
   try{source=this.source(record,identities);}catch{result.unknown++;continue;}
   const cache=this.cache(source);
   if(!cache){result.unknown++;continue;}
   const references=this.references(source,cache);result.truncated||=references.truncated;
   for(const group of references.groups){
    if(!group.file){result.unresolved++;continue;}
    if(group.file.extension.toLowerCase()==='md')continue;
    const attachmentKind=collectionAttachmentKind(group.file.extension);
    if(kind!=='all'&&attachmentKind!==kind)continue;
    const text=fold(`${group.path} ${group.title} ${record.title} ${record.path} ${record.tags.join(' ')}`);
    if(!terms.every(term=>text.includes(term)))continue;
    const index=result.total++;
    if(index<offset||result.items.length>=result.limit)continue;
    const item=this.item(record,source,group,'attachment') as CollectionAttachmentItem;
    item.source={...record,tags:[...record.tags]};result.items.push(item);
   }
   // Yield to native events and navigation instead of blocking a large library.
   if(result.scanned%32===0){
    const clock=this.app.workspace.containerEl.ownerDocument.defaultView||window;
    await new Promise<void>(resolve=>clock.setTimeout(resolve,0));
   }
  }
  this.active(current);if(revision!==this.revision)throw Error('附件索引有更新，请刷新后重试');return result;
 }
 /** Synchronous final guard for the native open queue, including same-stat
  * edits observed before the host has updated its cached links. */
 isCurrent(record:CollectionRecord,item:CollectionContextItem):boolean {
  if(this.disposed)return false;
  const proof=this.proofs.get(item);
  if(!proof||record.id!==proof.identity.id||record.createdAt!==proof.identity.createdAt||record.path!==proof.sourcePath)return false;
  if(item.path!==proof.targetPath||item.direction!==proof.direction||item.subpath!==proof.subpath)return false;
  if(proof.source.path!==proof.sourcePath||proof.target.path!==proof.targetPath||!this.native(proof.source)||!this.native(proof.target))return false;
  if(stamp(proof.source)!==proof.sourceStamp||stamp(proof.target)!==proof.targetStamp||
   (this.revisions.get(proof.source)||0)!==proof.sourceRevision||(this.revisions.get(proof.target)||0)!==proof.targetRevision)return false;
  try{if(this.source(record)!==proof.source)return false;}catch{return false;}
  const cache=this.cache(proof.source),identity=readCollectionIdentity(cache?.frontmatter);
  if(identity?.id!==record.id||identity.createdAt!==record.createdAt)return false;
  const targetIdentity=proof.target.extension.toLowerCase()==='md'?readCollectionIdentity(this.cache(proof.target)?.frontmatter):undefined;
  if(targetIdentity?.id!==proof.targetIdentity?.id||targetIdentity?.createdAt!==proof.targetIdentity?.createdAt)return false;
  if(proof.direction==='incoming'){
   const targetCache=this.cache(proof.target);
   return !!targetCache&&this.app.metadataCache.resolvedLinks?.[proof.targetPath]?.[proof.sourcePath]>0&&
    this.references(proof.target,targetCache).groups.some(group=>group.file===proof.source);
  }
  return !!cache&&this.references(proof.source,cache).groups.some(group=>group.file===proof.target&&group.subpath===proof.subpath);
 }
 async resolveTarget(record:CollectionRecord,item:CollectionContextItem,current:()=>boolean=()=>true):Promise<TFile>{
  this.active(current);
  if(!this.isCurrent(record,item))throw Error('引用、附件或原记录已变化，请刷新后重新选择');
  return this.proofs.get(item)!.target;
 }
}
