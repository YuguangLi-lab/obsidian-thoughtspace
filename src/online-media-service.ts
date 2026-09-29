import {TFile,type App} from 'obsidian';
import {parseOnlineSource} from './online-platform';
import {onlineNoteSource,onlineNoteDocument,appendOnlineMoment,readOnlineMoments} from './online-media-notes';
import {isWorkspaceFile} from './workspace';
import {yingjianNotePath} from './yingjian';
import type {MediaMoment} from './media-notes';

/** Online identities remain URLs. A note is created only when the user saves. */
export class OnlineMediaService {
 private queues=new Map<string,Promise<unknown>>();
 private known=new Map<string,{file:TFile;path:string}>();
 private uncertainCreations=new Set<string>();
 private closed=false;
 private attachments=new Map<string,{image:TFile;blob:Blob}>();
 constructor(private app:App,private create:(title:string,body:string)=>Promise<TFile>,private vaultId:()=>string){}
 dispose(){this.closed=true;this.known.clear();this.uncertainCreations.clear();this.attachments.clear();}
 private source(input:string){const source=parseOnlineSource(input);if(this.closed)throw Error('在线视频笔记已关闭');if(!source)throw Error('在线视频来源无效');return source;}
 private alive(file:TFile){return !this.closed&&isWorkspaceFile(file)&&this.app.vault.getAbstractFileByPath(file.path)===file;}
 private async read(file:TFile,source:string){
  if(!this.alive(file)||file.extension!=='md'||file.stat.size>2000000)throw Error('在线视频笔记已变化、删除或过大');
  const path=file.path,mtime=file.stat.mtime,size=file.stat.size,raw=await this.app.vault.read(file);
  if(!this.alive(file)||file.path!==path||file.stat.mtime!==mtime||file.stat.size!==size||raw.length>500000||onlineNoteSource(raw)!==source)throw Error('在线视频笔记来源已变化，请重新打开');
  return raw;
 }
 async notes(input:string,pinned?:string):Promise<{note?:TFile;entries:MediaMoment[]}>{
  const source=this.source(input),candidates=new Set<TFile>();let unindexed=false;
  if(pinned){
   const path=yingjianNotePath(pinned),file=path&&this.app.vault.getAbstractFileByPath(path);
   if(!(file instanceof TFile))throw Error('来源笔记已移动或删除，请重新打开');
   candidates.add(file);
  }else{
   const known=this.known.get(source.path);
   if(known){if(!this.alive(known.file)||known.file.path!==known.path)throw Error('原在线视频笔记已移动或删除，请重新打开原笔记；不会新建替代笔记');candidates.add(known.file);}
   for(const file of this.app.vault.getMarkdownFiles()){
    if(!isWorkspaceFile(file))continue;
    const cache=this.app.metadataCache.getFileCache(file);if(!cache){unindexed=true;continue;}const meta=cache.frontmatter;
    const raw:unknown=meta?.thoughtspace_online_video??meta?.source;
    const tags:unknown=meta?.tags,tagged=(Array.isArray(tags)?tags:typeof tags==='string'?tags.replace(/[[\],"']/g,' ').split(/\s+/):[]).some((tag:unknown)=>typeof tag==='string'&&tag.replace(/^#/,'')==='影笺');
    if(typeof raw==='string'&&parseOnlineSource(raw)?.path===source.path&&(meta?.thoughtspace_online_video||meta?.['video-note-id']||meta?.['yingjian-capture-id']||tagged))candidates.add(file);
    if(candidates.size>=100)break;
   }
  }
  for(const note of candidates){
   // A failed candidate is not evidence that no note exists. In particular, a
   // stale metadata cache must never turn an unreadable old note into a new one.
   const raw=await this.read(note,source.path);this.known.set(source.path,{file:note,path:note.path});this.uncertainCreations.delete(source.path);
   return {note,entries:readOnlineMoments(raw,source.path,this.app.vault.getName(),this.vaultId())};
  }
  this.source(input);
  if(unindexed)throw Error('部分笔记尚未完成索引，请稍后重试，或从原笔记重新打开视频');
  if(this.uncertainCreations.has(source.path))throw Error('上次创建笔记的结果尚未确认，请等待索引更新或重新打开已创建的笔记');return {entries:[]};
 }
 save(input:string,data:{id:string;time:number;text:string;image?:Blob},pinned?:string):Promise<{note:TFile}>{
  const source=this.source(input),snapshot={id:data.id,time:data.time,text:data.text},imageBlob=data.image,previous=this.queues.get(source.path)||Promise.resolve();
  if(imageBlob&&(imageBlob.type!=='image/png'||imageBlob.size<=0||imageBlob.size>16*1024*1024))throw Error('截图不是有效 PNG 或超过 16 MB');
  const pinnedPath=pinned?yingjianNotePath(pinned):undefined,pinnedFile=pinnedPath?this.app.vault.getAbstractFileByPath(pinnedPath):undefined;
  if(pinned&&!(pinnedFile instanceof TFile))throw Error('来源笔记已移动或删除，请重新打开');
  const fresh=onlineNoteDocument(source.path);
  // Snapshot and validate before queueing, so the caller cannot mutate a queued
  // operation and malformed input cannot create even an empty note.
  appendOnlineMoment(fresh,snapshot,source.path,this.app.vault.getName(),pinned||'在线视频.md');
  const job=previous.catch(()=>undefined).then(async()=>{
   this.source(input);
   if(pinned&&(!(pinnedFile instanceof TFile)||pinnedFile.path!==pinnedPath||!this.alive(pinnedFile)))throw Error('排队保存期间原笔记已移动、删除或被替换，请重新打开');
   const found=await this.notes(source.path,pinned);let {note}=found;
   this.source(input);
   // Acknowledgment may fail after a successful write; never upload the same frame twice.
   if(note&&found.entries.some(entry=>entry.id===snapshot.id)){this.attachments.delete(source.path+'\n'+snapshot.id);return {note};}
   let image:string|undefined;
   if(imageBlob){
    const key=source.path+'\n'+snapshot.id;let cached=this.attachments.get(key);
    if(cached&&cached.blob!==imageBlob)throw Error('此截图草稿已绑定其他画面，请重新创建摘录');
    if(!cached||!this.alive(cached.image)){
     const bytes=await imageBlob.arrayBuffer();this.source(input);
     const view=new DataView(bytes),signature=[137,80,78,71,13,10,26,10];
     if(bytes.byteLength<24||!signature.every((value,i)=>view.getUint8(i)===value)||view.getUint32(12)!==0x49484452||view.getUint32(16)<1||view.getUint32(20)<1||view.getUint32(16)*view.getUint32(20)>16000000)throw Error('截图数据无效或分辨率过大');
     const path=await this.app.fileManager.getAvailablePathForAttachment('在线视频截图-'+snapshot.id+'.png',note?.path||'');this.source(input);
     const file=await this.app.vault.createBinary(path,bytes);cached={image:file,blob:imageBlob};this.attachments.set(key,cached);this.source(input);
    }
    const encoded=cached.image.path.split('/').map(part=>encodeURIComponent(part).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16))).join('/');
    image='![视频截图]('+encoded+')';
   }
   const moment={...snapshot,...(image?{image}:{})};
   if(!note){
    const before=new Set(this.app.vault.getMarkdownFiles());
    try{note=await this.create(source.name,appendOnlineMoment(fresh,moment,source.path,this.app.vault.getName()));}
    catch(error){if(!this.closed&&this.app.vault.getMarkdownFiles().some(file=>!before.has(file)))this.uncertainCreations.add(source.path);throw error;}
    this.source(input);this.known.set(source.path,{file:note,path:note.path});
    await this.read(note,source.path);this.attachments.delete(source.path+'\n'+snapshot.id);return {note};
   }
   const target=note,path=target.path;
   if(!this.alive(target))throw Error('在线视频笔记已变化');
   await this.app.vault.process(target,raw=>{
    if(!this.alive(target)||target.path!==path)throw Error('在线视频笔记已移动或删除');
    return appendOnlineMoment(raw,moment,source.path,this.app.vault.getName(),path);
   });
   if(!this.alive(target)||target.path!==path)throw Error('在线视频笔记已关闭、移动或删除；请重新打开确认保存结果');
   await this.read(target,source.path);this.attachments.delete(source.path+'\n'+snapshot.id);this.known.set(source.path,{file:target,path});return {note:target};
  });
  this.queues.set(source.path,job);void job.finally(()=>{if(this.queues.get(source.path)===job)this.queues.delete(source.path);}).catch(()=>undefined);return job;
 }
}
