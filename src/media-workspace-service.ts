import {App,FileSystemAdapter,TFile} from 'obsidian';
import {resolve as resolvePath} from 'path';
import {createHash} from 'crypto';
import {mountMediaCard,type MediaCardHandle,type MediaCardState} from './media-card-player';
import {MediaPlayback,type MediaIdentity} from './media-playback';
import {mediaKind,mediaTime} from './media-source';
import {appendMediaMoment,mediaNoteDocument,mediaNoteSource,readMediaMoments,readLegacyMediaMoments,type MediaMoment} from './media-notes';
import {isWorkspaceFile} from './workspace';
import {srtToWebVtt} from './media-subtitles';
import {markdownRows} from './markdown-context';
import {markdownLinkRanges} from './markdown-links';
import {maskInlineCode} from './markdown-literals';
import {isExternalMediaReference,readExternalMediaReference,resolveMediaResource,validateExternalMediaReference,validateExternalMediaReferenceSync} from './external-media';

export interface MediaWorkspaceHooks {state:(state:MediaCardState)=>void;capture:(time:number)=>Promise<unknown>;frame:(blob:Blob,time:number)=>Promise<unknown>;frameCaptureState?:(busy:boolean,time:number)=>void;initialState?:MediaCardState}
export interface MediaMomentDraft {id:string;time:number;text:string;image?:Blob;source?:MediaIdentity}
export interface WorkspaceMediaMoment extends MediaMoment {notePath:string;key:string}
interface NoteSnapshot {note:TFile;identity:MediaIdentity;raw:string;priority:number}
interface NoteIssue {priority:number;message:string}
const maxNoteCharacters=500000,maxNoteBytes=2000000,maxNoteReadBytes=8*1024*1024,maxNotes=200,maxMoments=5000;
const encodedImage=(path:string,label='视频截图')=>`![${label}](${path.split('/').map(part=>encodeURIComponent(part).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16))).join('/')})`;
function notePriority(raw:string){
 const front=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(raw)?.[1]||'';
 if(/^thoughtspace_media:/m.test(front))return 0;
 if(/^video-note-id:\s*[^\r\n]+/m.test(front))return 1;
 if(/^yingjian-capture-id:\s*[^\r\n]+/m.test(front))return 2;
 return 3;
}
interface Operations {createNote:(title:string,body:string)=>Promise<TFile>;openFile:(file:TFile)=>Promise<unknown>;onPlay?:()=>void}
/** Own media resume state and append-only notes independently of any board view. */
export class MediaWorkspaceService {
 readonly playback=new MediaPlayback(()=>this.schedule());
 private timer:ReturnType<typeof setTimeout>|undefined;
 private writes:Promise<unknown>=Promise.resolve();
 private noteQueues=new Map<TFile,Promise<unknown>>();
 private notes=new Map<TFile,TFile>();
 private images=new Map<string,{source:TFile;image:TFile}>();
 private drafts=new Map<string,{source:TFile;identity:MediaIdentity}>();
 private mounted=new Set<MediaCardHandle>();
 private disposed=false;
 constructor(private app:App,private statePath:string,private operations:Operations){}
 identity(file:TFile):MediaIdentity{return {path:file.path,mtime:file.stat.mtime,size:file.stat.size};}
 private ensure(file:TFile,path=file.path,mtime=file.stat.mtime,size=file.stat.size){if(this.disposed||this.app.vault.getAbstractFileByPath(path)!==file||file.path!==path||file.stat.mtime!==mtime||file.stat.size!==size||!mediaKind(path)||!isWorkspaceFile(file))throw Error('媒体已移动、删除或更新，请重新选择');}
 resolveResource(file:TFile):string|Promise<string>{
  this.ensure(file);const identity=this.identity(file),result=resolveMediaResource(this.app,file);
  if(typeof result==='string')return result;
  return result.then(url=>{this.ensure(file,identity.path,identity.mtime,identity.size);return url;});
 }
 async validateResource(file:TFile):Promise<void>{await this.resolveResource(file);}
 async load(){try{if(this.disposed)return;if(await this.app.vault.adapter.exists(this.statePath)){if(this.disposed)return;const raw=await this.app.vault.adapter.read(this.statePath);if(!this.disposed&&raw.length<=256000)this.playback.import(JSON.parse(raw));}}catch(error){console.warn('[ThoughtSpace] 媒体进度无法读取，使用新会话',error);}}
 private schedule(){if(this.disposed||this.timer!==undefined)return;this.timer=setTimeout(()=>{this.timer=undefined;void this.flush().catch(error=>console.error('[ThoughtSpace] 媒体进度保存失败',error));},5000);}
 flush(){if(this.timer!==undefined){clearTimeout(this.timer);this.timer=undefined;}const text=JSON.stringify(this.playback.export());const next=this.writes.catch(()=>undefined).then(()=>this.app.vault.adapter.write(this.statePath,text));this.writes=next;return next;}
 async dispose(){if(this.disposed)return;let failure:Error|undefined;try{this.playback.pauseAll();}catch(error){failure=error instanceof Error?error:Error('播放器无法暂停');}for(const handle of [...this.mounted])try{handle.dispose();}catch(error){failure??=error instanceof Error?error:Error('播放器无法关闭');}this.disposed=true;this.notes.clear();this.images.clear();this.drafts.clear();await this.flush();if(failure)throw failure;}
 mount(host:HTMLElement,file:TFile,hooks:MediaWorkspaceHooks):MediaCardHandle{
  this.ensure(file);let closed=false;const identity=this.identity(file),sourceAlive=()=>!this.disposed&&this.app.vault.getAbstractFileByPath(identity.path)===file&&file.path===identity.path&&file.stat.mtime===identity.mtime&&file.stat.size===identity.size,alive=()=>!closed&&host.isConnected&&sourceAlive();
  const dot=file.path.lastIndexOf('.'),base=file.path.slice(0,dot),vtt=this.app.vault.getAbstractFileByPath(base+'.vtt'),srt=this.app.vault.getAbstractFileByPath(base+'.srt'),subtitle=vtt instanceof TFile?vtt:srt instanceof TFile?srt:undefined;
  const subtitleIdentity=subtitle?this.identity(subtitle):undefined;
  const urlApi=host.ownerDocument?.defaultView?.URL||URL,BlobType=host.ownerDocument?.defaultView?.Blob||Blob;
  let subtitleUrl:string|undefined,subtitleRead:Promise<string>|undefined;
  const subtitleSource=()=>{
   const valid=()=>{if(!alive()||!subtitle||!subtitleIdentity||subtitle.path!==subtitleIdentity.path||subtitle.stat.mtime!==subtitleIdentity.mtime||subtitle.stat.size!==subtitleIdentity.size||this.app.vault.getAbstractFileByPath(subtitleIdentity.path)!==subtitle)throw Error('字幕文件已变化，请重新打开媒体');};
   valid();if(subtitle===vtt)return this.app.vault.getResourcePath(subtitle);
   if(subtitleIdentity!.size>1024*1024)throw Error('字幕文件超过 1 MB');
   subtitleRead??=(async()=>{const raw=await this.app.vault.read(subtitle!);valid();if(raw.length>1024*1024)throw Error('字幕文件超过 1 MB');const content=srtToWebVtt(raw);valid();subtitleUrl=urlApi.createObjectURL(new BlobType([content],{type:'text/vtt;charset=utf-8'}));return subtitleUrl;})().catch(error=>{subtitleRead=undefined;throw error;});
   return subtitleRead;
  };
  let handle:MediaCardHandle;
  const validateCapture=async()=>{await this.validateResource(file);if(!alive())throw Error('媒体已移动、删除或更新，请重新选择');};
  handle=mountMediaCard(host,{kind:mediaKind(file.path)!,title:file.basename,src:()=>{this.ensure(file,identity.path,identity.mtime,identity.size);return this.resolveResource(file);},state:this.playback.get(identity)||hooks.initialState,
   suspendWhenHidden:false,onPlay:()=>{this.playback.activate(handle);this.operations.onPlay?.();},
   tracks:subtitle?[{label:'字幕',src:subtitleSource}]:undefined,
   onState:state=>{if(alive()){this.playback.remember(identity,state,handle);hooks.state(state);}},onCapture:async time=>{await validateCapture();return hooks.capture(time);},onCaptureFrame:async(blob,time)=>{await validateCapture();return hooks.frame(blob,time);},onFrameCaptureState:hooks.frameCaptureState,
   onOpen:()=>{this.playback.pauseAll();return this.operations.openFile(file);},alive});
  const unregister=this.playback.register(identity,handle);
  const wrapper:MediaCardHandle={getState:()=>handle.getState(),play:()=>{if(!closed)handle.play();},pause:()=>{if(!closed)handle.pause();},seek:time=>{if(!closed)handle.seek(time);},dispose:()=>{
   if(closed)return;try{if(sourceAlive())this.playback.remember(identity,handle.getState(),handle);}finally{closed=true;try{handle.dispose();}finally{if(subtitleUrl){urlApi.revokeObjectURL(subtitleUrl);subtitleUrl=undefined;}unregister();this.mounted.delete(wrapper);}}
  }};this.mounted.add(wrapper);return wrapper;
 }
 private sourceMatches(source:string|undefined,file:TFile){if(source===file.path)return true;const adapter=this.app.vault.adapter;return typeof source==='string'&&adapter instanceof FileSystemAdapter&&source===resolvePath(adapter.getBasePath(),file.path);}
 private noteAlive(snapshot:Pick<NoteSnapshot,'note'|'identity'>){const{note,identity}=snapshot;return isWorkspaceFile(note)&&note.path===identity.path&&note.stat.mtime===identity.mtime&&note.stat.size===identity.size&&this.app.vault.getAbstractFileByPath(identity.path)===note;}
 /** Read each candidate once. Metadata selects candidates; the actual document remains authoritative. */
 private async readNotes(file:TFile,identity:MediaIdentity){
  const candidates=new Map<TFile,{note:TFile;identity:MediaIdentity;priority:number}>(),issues:NoteIssue[]=[];
  const add=(note:TFile)=>{if(!isWorkspaceFile(note)||this.app.vault.getAbstractFileByPath(note.path)!==note)return;const fm=this.app.metadataCache.getFileCache(note)?.frontmatter;const priority=fm?.thoughtspace_media!==undefined?0:fm?.['video-note-id']?1:fm?.['yingjian-capture-id']?2:3;candidates.set(note,{note,identity:this.identity(note),priority});};
  const cached=this.notes.get(file);if(cached)add(cached);
  for(const note of this.app.vault.getMarkdownFiles()){const fm=this.app.metadataCache.getFileCache(note)?.frontmatter;const source:unknown=fm?.thoughtspace_media??fm?.source;if(typeof source==='string'&&this.sourceMatches(source,file))add(note);}
  // Read smaller documents first within each role so a large capture cannot starve all following notes.
  const ordered=[...candidates.values()].sort((a,b)=>a.priority-b.priority||a.identity.size-b.identity.size||a.identity.path.localeCompare(b.identity.path));
  if(ordered.length>maxNotes)issues.push({priority:Math.min(...ordered.slice(maxNotes).map(note=>note.priority)),message:`关联笔记超过 ${maxNotes} 篇，本次只读取前 ${maxNotes} 篇；其余内容仍保留在原笔记中。`});
  const snapshots:NoteSnapshot[]=[];let bytes=0;
  for(const candidate of ordered.slice(0,maxNotes)){
   const ensure=()=>this.ensure(file,identity.path,identity.mtime,identity.size);ensure();
   if(candidate.identity.size>maxNoteBytes){issues.push({priority:candidate.priority,message:'有笔记超过单篇读取上限（500,000 字符），未载入；请在原笔记查看。'});continue;}
   if(bytes+candidate.identity.size>maxNoteReadBytes){issues.push({priority:candidate.priority,message:'关联笔记总量超过本次 8 MB 读取上限，部分笔记未载入；请在原笔记查看。'});continue;}
   bytes+=candidate.identity.size;
   try{
    if(!this.noteAlive(candidate))throw Error('changed');
    const raw=await this.app.vault.read(candidate.note);ensure();
    if(!this.noteAlive(candidate))throw Error('changed');
    if(raw.length>maxNoteCharacters){issues.push({priority:candidate.priority,message:'有笔记超过 500,000 字符，未载入；请在原笔记查看。'});continue;}
    if(this.sourceMatches(mediaNoteSource(raw),file))snapshots.push({...candidate,raw,priority:notePriority(raw)});
   }catch{ensure();issues.push({priority:candidate.priority,message:'部分关联笔记在读取时已变化或无法读取，未载入；请稍后刷新或打开原笔记。'});}
  }
  const notes=snapshots.filter(snapshot=>{if(this.noteAlive(snapshot))return true;issues.push({priority:snapshot.priority,message:'部分关联笔记在读取时已变化或无法读取，未载入；请稍后刷新或打开原笔记。'});return false;}).sort((a,b)=>a.priority-b.priority||a.identity.path.localeCompare(b.identity.path));
  if(notes[0])this.notes.set(file,notes[0].note);else this.notes.delete(file);
  return {notes,issues};
 }
 private normalizeImages(text:string,notePath:string,warnings:Set<string>){
  return [...markdownRows(text)].map(row=>{
   if(row.code)return row.source;const visible=maskInlineCode(row.visible);let output=row.source;
   for(const range of markdownLinkRanges(visible).reverse()){
    if(visible[range.from-1]!=='!')continue;let slash=range.from-1;while(slash>0&&visible[slash-1]==='\\')slash--;if((range.from-1-slash)%2)continue;
    const markup=row.source.slice(range.from-1,range.to),wiki=/^!\[\[([^\]]+)\]\]$/.exec(markup),markdown=/^!\[(.*)\]\((.*)\)$/.exec(markup);
    let path:string|undefined,label='视频截图';
    if(wiki){const parts=wiki[1].split('|');path=parts[0];if(parts[1])label=/^\d+(?:x\d+)?$/.test(parts[1])?'视频截图|'+parts[1]:parts[1].replace(/[\\[\]]/g,'\\$&');}
    else if(markdown){label=markdown[1];let target=markdown[2];const angle=/^<([^>]*)>(?:\s+["'][\s\S]*["'])?$/.exec(target),plain=/^(.*?)(?:\s+["'][\s\S]*["'])?$/.exec(target);target=angle?.[1]??plain?.[1]??target;try{path=decodeURIComponent(target.replace(/\\([\\()[\] ])/g,'$1'));}catch{continue;}}
    if(!path||!(/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(path))||/^[a-z][a-z\d+.-]*:/i.test(path))continue;
    const target=this.app.metadataCache.getFirstLinkpathDest(path,notePath);
    const valid=target instanceof TFile&&isWorkspaceFile(target)&&this.app.vault.getAbstractFileByPath(target.path)===target;
    const replacement=valid?encodedImage(target.path,label):'（截图未找到，请在原笔记查看）';
    if(!valid)warnings.add('部分截图附件无法解析，已保留提示文字；请在原笔记修复图片链接后刷新。');
    output=output.slice(0,range.from-1)+replacement+output.slice(range.to);
   }
   return output;
  }).join('\n');
 }
 async moments(file:TFile):Promise<{note?:TFile;entries:WorkspaceMediaMoment[];warnings?:string[]}>{
  this.ensure(file);const identity=this.identity(file),result=await this.readNotes(file,identity);this.ensure(file,identity.path,identity.mtime,identity.size);
  const source={vault:this.app.vault.getName(),file:file.path},warnings=new Set(result.issues.map(issue=>issue.message));
  const adapter=this.app.vault.adapter,legacyVaultId=adapter instanceof FileSystemAdapter?createHash('sha256').update(resolvePath(adapter.getBasePath())).digest('hex').slice(0,20):undefined;
  const groups=result.notes.map(snapshot=>{
   const legacy=mediaNoteSource(snapshot.raw),rows=readMediaMoments(snapshot.raw,source);if(legacy)rows.push(...readLegacyMediaMoments(snapshot.raw,source,legacy,legacyVaultId));
   const seen=new Set<string>();return rows.filter(row=>{const key=JSON.stringify([row.id,row.line]);if(seen.has(key))return false;seen.add(key);return true;}).map(row=>({...row,notePath:snapshot.identity.path,key:JSON.stringify([snapshot.identity.path,row.id,row.line])}));
  });
  const entries:WorkspaceMediaMoment[]=[];
  // Round-robin the cap across documents, then order chronologically for display.
  for(let index=0;entries.length<maxMoments&&groups.some(group=>index<group.length);index++)for(const group of groups)if(group[index]&&entries.length<maxMoments)entries.push(group[index]);
  if(groups.reduce((total,group)=>total+group.length,0)>entries.length)warnings.add(`关联摘录超过 ${maxMoments} 条，本次均衡显示各笔记中的前 ${maxMoments} 条；其余摘录仍保留在原笔记中。`);
  for(const entry of entries){entry.text=this.normalizeImages(entry.text,entry.notePath,warnings);if(entry.image){const image=this.normalizeImages(entry.image,entry.notePath,warnings);if(image.startsWith('!'))entry.image=image;else{delete entry.image;entry.text=[entry.text,image].filter(Boolean).join('\n');}}}
  return {note:result.notes[0]?.note,entries:entries.sort((a,b)=>a.time-b.time||a.notePath.localeCompare(b.notePath)||a.line-b.line),...(warnings.size?{warnings:[...warnings]}:{})};
 }
 /** Resolve only an acknowledged, stable note block; never copy a draft into a board. */
 async referenceMoment(file:TFile,requested:MediaMoment&{notePath?:string}){
  this.ensure(file);const identity=this.identity(file),result=await this.readNotes(file,identity);this.ensure(file,identity.path,identity.mtime,identity.size);
  const snapshot=result.notes.find(item=>item.identity.path===requested.notePath);
  const moment=snapshot&&readMediaMoments(snapshot.raw,{vault:this.app.vault.getName(),file:file.path}).find(item=>item.id===requested.id);
  if(!snapshot||!moment||!this.noteAlive(snapshot)||!/^[-a-z0-9]+$/i.test(moment.id))throw Error('找不到这条摘录的稳定笔记块，请刷新时间轴；旧格式摘录可先打开原笔记。');
  const anchor='^thoughtspace-media-'+moment.id;
  if(![...markdownRows(snapshot.raw)].some(row=>!row.code&&row.topLevel&&row.visible.trim()===anchor))throw Error('摘录块已变化，请刷新时间轴后重试');
  return{note:snapshot.note,moment,subpath:'#'+anchor};
 }
 saveMoment(file:TFile,draft:MediaMomentDraft):Promise<{note:TFile}>{
  this.ensure(file);const identity=this.identity(file),snapshot={...draft};mediaTime(snapshot.time);
  if(snapshot.source!==undefined){snapshot.source={...snapshot.source};if(snapshot.source.path!==identity.path||snapshot.source.mtime!==identity.mtime||snapshot.source.size!==identity.size)throw Error('这条草稿的媒体已变化，请重新摘录');}
  if(typeof snapshot.id!=='string'||!/^[a-z\d][a-z\d_-]{0,127}$/i.test(snapshot.id)||typeof snapshot.text!=='string'||snapshot.text.length>100000||snapshot.text.includes('\0')||snapshot.image&&(snapshot.image.type!=='image/png'||snapshot.image.size<=0||snapshot.image.size>20*1024*1024))throw Error('记录内容或截图无效');
  const claimed=this.drafts.get(snapshot.id);if(claimed&&(claimed.source!==file||claimed.identity.path!==identity.path||claimed.identity.mtime!==identity.mtime||claimed.identity.size!==identity.size))throw Error('这条草稿的媒体已变化，请重新摘录');
  this.drafts.set(snapshot.id,{source:file,identity});
  const previous=this.noteQueues.get(file)||Promise.resolve();const task=previous.catch(()=>undefined).then(async()=>{
   const ensure=()=>this.ensure(file,identity.path,identity.mtime,identity.size);ensure();
   const reference=isExternalMediaReference(file.path)?await readExternalMediaReference(this.app,file):undefined;ensure();
   const verify=async()=>{ensure();if(reference)await validateExternalMediaReference(reference);ensure();};
   const found=await this.readNotes(file,identity);await verify();let result:{note:TFile;raw:string}|undefined=found.notes[0];
   if(found.issues.some(issue=>!found.notes[0]||issue.priority<=found.notes[0].priority))throw Error('主媒体笔记未能完整读取，请检查原笔记或稍后重试；草稿保留');
   for(const candidate of found.notes)if(readMediaMoments(candidate.raw,{vault:this.app.vault.getName(),file:file.path}).some(moment=>moment.id===snapshot.id)){this.images.delete(snapshot.id);this.drafts.delete(snapshot.id);return {note:candidate.note};}
   if(!result){const note=await this.operations.createNote(file.basename+' · 音视频笔记',mediaNoteDocument(file.path));this.notes.set(file,note);await verify();result={note,raw:await this.app.vault.read(note)};await verify();}
   const note=result.note,notePath=note.path,source={vault:this.app.vault.getName(),file:file.path};
   if(readMediaMoments(result.raw,source).some(moment=>moment.id===snapshot.id)){this.images.delete(snapshot.id);this.drafts.delete(snapshot.id);return {note};}
   let image:string|undefined;
   if(snapshot.image){let attachment=this.images.get(snapshot.id);if(attachment&&attachment.source!==file)throw Error('截图记录已属于另一媒体');
    if(!attachment||this.app.vault.getAbstractFileByPath(attachment.image.path)!==attachment.image){
     const bytes=await snapshot.image.arrayBuffer();await verify();const path=await this.app.fileManager.getAvailablePathForAttachment(`媒体截图-${snapshot.id}.png`,notePath);await verify();
     const created=await this.app.vault.createBinary(path,bytes);this.images.set(snapshot.id,attachment={source:file,image:created});await verify();
    }
    image=encodedImage(attachment.image.path);
   }
   if(this.app.vault.getAbstractFileByPath(notePath)!==note)throw Error('记录笔记已移动或删除，草稿保留');
   await verify();
   await this.app.vault.process(note,current=>{ensure();if(reference)validateExternalMediaReferenceSync(reference);if(note.path!==notePath||this.app.vault.getAbstractFileByPath(notePath)!==note||!isWorkspaceFile(note)||!this.sourceMatches(mediaNoteSource(current),file))throw Error('记录笔记的媒体来源已变化，草稿保留');return appendMediaMoment(current,{id:snapshot.id,time:snapshot.time,text:snapshot.text,image},source);});
   this.images.delete(snapshot.id);this.drafts.delete(snapshot.id);return {note};
  });this.noteQueues.set(file,task);void task.finally(()=>{if(this.noteQueues.get(file)===task)this.noteQueues.delete(file);}).catch(()=>undefined);return task;
 }
}
