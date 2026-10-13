import {App,Component,FuzzySuggestModal,TFile,WorkspaceLeaf,normalizePath} from 'obsidian';
import {CollectionRecovery,type CollectionDraft} from './collection-recovery';
import {collectionNoteSource,collectionTitle} from './collection-model';
import {CollectionLibrary} from './collection-library';
import {CollectionJournalStore,collectionJournalCanonical} from './collection-journal-store';
import {normalizeNativeTags} from './native-tags';
import {isWorkspaceFile} from './workspace';
import {bindBoardModalViewport} from './board-modal-viewport';
import type {CollectionAttachment,CollectionRecord,CollectionTarget,CollectionViewHost} from './collection-view';

export interface CollectionBridge {
 accent?():string;density?():string;
 directory:string;
 folder():string;
 newId():string;
 ensureFolder(path:string):Promise<unknown>;
 pickTarget(document:Document,current:()=>boolean):{result:Promise<CollectionTarget|undefined>;close():void};
 deliver(session:string,file:TFile,target:CollectionTarget,current:()=>boolean):Promise<{added:number}>;
 deliveryLocked(session:string):boolean;
 openNote(file:TFile,current:()=>boolean,document:Document):Promise<unknown>;
 occurrences(file:TFile):void;
 locateBoard?(file:TFile,board:TFile,nodeId:string):void;
 legacyInbox():void;
}
const validSession=(id:unknown):id is string=>typeof id==='string'&&/^session-[A-Za-z0-9_-]{8,120}$/.test(id);
const safeName=(name:string)=>name.replace(/[\\/:*?"<>|#[\]]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||'记录';
/** Per-view journals use the plugin's own directory. No settings, note body,
 * existing YAML or other whiteboard's recovery state is rewritten. */
export class CollectionWorkspace extends Component {
 private sessions=new Map<string,CollectionRecovery>();
 private owners=new Map<string,symbol>();
 constructor(private readonly app:App,readonly library:CollectionLibrary,private readonly bridge:CollectionBridge){super();}
 onunload(){for(const recovery of this.sessions.values())recovery.dispose();this.owners.clear();}
 private journal(id:string){if(!validSession(id))throw Error('收集草稿标识无效');return normalizePath(`${this.bridge.directory}/collection-drafts/${id}.json`);}
 private async ensureDirectory(){
  const directory=normalizePath(`${this.bridge.directory}/collection-drafts`),parts=directory.split('/');let current='';
  for(const part of parts){current=current?`${current}/${part}`:part;if(!await this.app.vault.adapter.exists(current))try{await this.app.vault.adapter.mkdir(current);}catch(error){if(!await this.app.vault.adapter.exists(current))throw error;}}
 }
 async recoverableSession():Promise<string|undefined>{
  for(const[id,recovery]of this.sessions)if(!this.owners.has(id)&&(recovery.snapshot.draft.body||recovery.snapshot.draft.tags||recovery.snapshot.draft.attachments.length||recovery.snapshot.draft.target||recovery.snapshot.attempt))return id;
  const directory=normalizePath(`${this.bridge.directory}/collection-drafts`);
  if(!await this.app.vault.adapter.exists(directory))return;
  const listing=await this.app.vault.adapter.list(directory);
  const candidates=[...new Set(listing.files.map(path=>collectionJournalCanonical(path)).filter((path):path is string=>!!path))].sort();
  for(const path of candidates){
   const id=path.slice(path.lastIndexOf('/')+1).replace(/\.json$/,'');if(!validSession(id)||this.owners.has(id))continue;
   let text:string|null;try{const saved=await new CollectionJournalStore(this.app.vault.adapter,path,()=>this.bridge.newId()).read();if(saved&&typeof saved!=='string')return id;text=saved;}catch{return id;}
   if(text===null)continue;if(text.length>2000000)return id;
   try{const data:unknown=JSON.parse(text);if(data&&typeof data==='object'&&('attempt'in data&&data.attempt||'draft'in data&&data.draft&&typeof data.draft==='object'&&(('body'in data.draft&&data.draft.body)||('tags'in data.draft&&data.draft.tags)||('attachments'in data.draft&&Array.isArray(data.draft.attachments)&&data.draft.attachments.length)||('target'in data.draft&&data.draft.target))))return id;}catch{return id;/* The recovery controller surfaces the preserved damaged journal. */}
  }
 }
 private recovery(id:string):CollectionRecovery{
  const prior=this.sessions.get(id);if(prior)return prior;
  const journal=this.journal(id),adapter=this.app.vault.adapter,store=new CollectionJournalStore(adapter,journal,()=>this.bridge.newId()),provedAbsent=new Set<string>(),notStarted=new Set<string>();
  const recovery=new CollectionRecovery({
   readJournal:async()=>{
    const source=await store.read();if(typeof source!=='string')return source;
    try{const value:unknown=JSON.parse(source);if(value&&typeof value==='object'&&'attempt'in value&&value.attempt&&typeof value.attempt==='object'&&'phase'in value.attempt&&value.attempt.phase==='prepared'&&'id'in value.attempt&&typeof value.attempt.id==='string')notStarted.add(value.attempt.id);}catch{/* The coordinator reports and preserves invalid journals. */}
    return source;
   },
   writeJournal:async serialized=>{await this.ensureDirectory();await store.write(serialized);},
   newId:()=>`capture-${this.bridge.newId()}`,now:()=>new Date().toISOString(),
   prepare:async(draft,identity)=>{
    const folder=normalizePath(this.bridge.folder());
    if(!folder||folder.startsWith('/')||folder.split('/').some(part=>part==='.'||part==='..'||part.startsWith('.')))throw Error('请先设置有效的卡片文件夹');
    const path=normalizePath(`${folder}/${safeName(collectionTitle(draft.body))}-${identity.id.slice(-8)}.md`);
    const references=draft.attachments.map(attachment=>{
     const file=this.app.vault.getAbstractFileByPath(attachment.path);if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('所选附件已移动或删除，请重新选择');
     const link=this.app.fileManager.generateMarkdownLink(file,path);
     return /^(png|jpe?g|gif|webp|avif|bmp|svg|pdf|mp3|m4a|wav|ogg|mp4|webm|mov)$/i.test(file.extension)?`!${link}`:link;
    });
    const body=draft.body+(references.length?`${draft.body?'\n\n':''}${references.join('\n')}`:'');
    const markdown=collectionNoteSource({...identity,body,tags:normalizeNativeTags(draft.tags)});
    notStarted.add(identity.id);return{path,markdown};
   },
   create:async(attempt,current)=>{
    notStarted.add(attempt.id);
    if(!current())throw Error('页面已变化，输入已保留');
    const folder=attempt.path.slice(0,attempt.path.lastIndexOf('/'));await this.bridge.ensureFolder(folder);
    if(!current())throw Error('页面已变化，输入已保留');
    if(await adapter.exists(attempt.path)||this.app.vault.getAbstractFileByPath(attempt.path))throw Error('记录路径已存在，请先核对保存状态');
    if(!current())throw Error('页面已变化，输入已保留');
    notStarted.delete(attempt.id);
    const observed=new Set<TFile>();
    const created=this.app.vault.on('create',file=>{if(file instanceof TFile&&file.path===attempt.path)observed.add(file);});
    const renamed=this.app.vault.on('rename',(file,oldPath)=>{if(file instanceof TFile&&(oldPath===attempt.path||file.path===attempt.path||observed.has(file)))observed.add(file);});
    try{
     // Absence established after an earlier rejection says nothing about this
     // new write. An uncertain result must earn a fresh absence proof.
     provedAbsent.delete(attempt.id);
     const file=await this.app.vault.create(attempt.path,attempt.markdown);provedAbsent.delete(attempt.id);this.library.remember(file,attempt);return{path:file.path};
    }catch(error){
     // An API error can follow a completed write. Retain the unique record;
     // only a settled create plus successful absence checks permits retry.
     let file=await this.library.resolve(attempt,attempt.path);
     for(const candidate of observed){
      const verified=await this.library.resolve(attempt,candidate.path);
      if(verified&&file&&verified!==file)throw Error('发现重复的收集标识，请先核对原笔记');
      if(verified)file=verified;
     }
     if(file){this.library.remember(file,attempt);return{path:file.path};}
     if(!observed.size&&!await adapter.exists(attempt.path)&&!this.app.vault.getAbstractFileByPath(attempt.path))provedAbsent.add(attempt.id);
     throw error;
    }finally{this.app.vault.offref(created);this.app.vault.offref(renamed);}
   },
   probe:async attempt=>{
    try{
     const file=await this.library.resolve(attempt,attempt.path);if(file){this.library.remember(file,attempt);return{kind:'found',path:file.path};}
     if(await adapter.exists(attempt.path))return{kind:'unknown',message:'原保存路径存在其他内容，请打开原笔记核对；输入仍保留'};
     // A missing old path after restart cannot prove that a renamed record is
     // absent before metadata indexing has completed. Never create a new copy.
     if(attempt.phase==='creating'&&(provedAbsent.has(attempt.id)||notStarted.has(attempt.id)))return{kind:'absent'};
     if(attempt.phase==='creating'||attempt.phase==='created'||attempt.phase==='delivering'||attempt.phase==='completed')return{kind:'unknown',message:'尚未确认这条记录的位置；请等待索引完成后重试或核对原笔记。输入仍保留'};
     return{kind:'absent'};
    }catch(error){return{kind:'unknown',message:error instanceof Error?error.message:String(error)};}
   },
   deliver:async(attempt,target,current)=>{const file=await this.library.resolve(attempt,attempt.path);if(!file)throw Error('已保存记录已移动或删除，请核对原笔记');if(!current())throw Error('页面已变化，记录已保留');await this.bridge.deliver(id,file,target,current);this.library.invalidate();},
   deliveryLocked:()=>this.bridge.deliveryLocked(id),
  });
  this.sessions.set(id,recovery);return recovery;
 }
 host(leaf:WorkspaceLeaf):CollectionViewHost{
  const owner=Symbol('collection-view');let session=`session-${this.bridge.newId()}`,recovery=this.recovery(session),released=false;
  const listeners=new Set<(kind?:'draft'|'records')=>void>();let detach=()=>{};
  this.owners.set(session,owner);
  const bind=()=>{detach();detach=recovery.subscribe(()=>{for(const listener of listeners)listener('draft');});};bind();
  const offLibrary=this.library.subscribe(()=>{for(const listener of listeners)listener('records');});
  const live=()=>!released&&leaf.view.containerEl.isConnected&&!leaf.view.containerEl.ownerDocument.defaultView?.closed;
  const scoped=async<T>(fn:(current:()=>boolean)=>Promise<T>,outer:()=>boolean=()=>true):Promise<T>=>{
   let valid=live()&&outer()&&this.app.workspace.activeLeaf===leaf;
   const changed=()=>{if(this.app.workspace.activeLeaf!==leaf)valid=false;};
   const ref=this.app.workspace.on('active-leaf-change',changed);
   try{return await fn(()=>valid&&live()&&outer());}finally{this.app.workspace.offref(ref);}
  };
  const file=async(record:CollectionRecord)=>{const result=await this.library.resolve(record,record.path);if(!result)throw Error('原笔记已变化，请刷新后重试');return result;};
  const pickAttachment=(current:()=>boolean)=>new Promise<CollectionAttachment|undefined>(resolve=>{
   if(!current()){resolve(undefined);return;}
   const app=this.app,doc=leaf.view.containerEl.ownerDocument;let done=false,unbind=()=>{};
   const finish=(value?:CollectionAttachment)=>{if(!done){done=true;resolve(value);}};
   class AttachmentPicker extends FuzzySuggestModal<TFile>{
    getItems(){return app.vault.getFiles().filter(isWorkspaceFile).filter(file=>file.extension!=='md'&&file.extension!=='thoughtspace');}
    getItemText(file:TFile){return file.path;}
    onChooseItem(file:TFile){finish(current()?{path:file.path,label:file.name}:undefined);}
    onOpen(){void Promise.resolve(super.onOpen()).catch(()=>{finish();this.close();});if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);unbind=bindBoardModalViewport(this.containerEl);}
    // Obsidian closes a chosen suggestion before calling onChooseItem. Give
    // that synchronous callback priority; a plain close still cancels once.
    onClose(){unbind();super.onClose();queueMicrotask(()=>finish());}
   }
   const picker=new AttachmentPicker(app);picker.setPlaceholder('引用库内附件…');picker.open();
  });
  return{
   accent:()=>this.bridge.accent?.()||'forest',density:()=>this.bridge.density?.()||'comfortable',
   sessionId:()=>session,
   setSessionId:async id=>{
    if(!validSession(id)||id===session)return;
    if(this.owners.get(session)===owner)this.owners.delete(session);
    session=this.owners.has(id)?`session-${this.bridge.newId()}`:id;
    this.owners.set(session,owner);recovery=this.recovery(session);bind();await recovery.ready;
   },
   ready:async()=>{await recovery.ready;},
   draft:()=>{const state=recovery.snapshot;return{...state.draft,busy:state.busy,locked:state.locked,targetLocked:state.targetLocked,canSubmit:state.canSubmit,status:[state.error,state.status].filter(Boolean).join('；')};},
   updateDraft:patch=>recovery.updateDraft({...patch,...('target'in patch?{target:patch.target||undefined}:{}),...('attachments'in patch?{attachments:patch.attachments?[...patch.attachments]:[]}:{} )} as Partial<CollectionDraft>),
   submit:current=>scoped(async active=>{await recovery.submit(active);this.library.invalidate();},current),
   subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
   list:()=>this.library.list(),readBody:record=>this.library.readBody(record),
   pickAttachment:current=>scoped(active=>pickAttachment(active),current),
   pickTarget:current=>scoped(async active=>{const picker=this.bridge.pickTarget(leaf.view.containerEl.ownerDocument,active);try{return await picker.result;}finally{picker.close();}},current),
   deliver:(record,target,current)=>scoped(async active=>{const source=await file(record);if(!active())throw Error('页面已变化，投递已取消');const result=await this.bridge.deliver(`record:${record.id}`,source,target,active);this.library.invalidate();return result;},current),
   openNote:record=>scoped(async active=>{const source=await file(record);if(active())await this.bridge.openNote(source,active,leaf.view.containerEl.ownerDocument);}),
   showOccurrences:record=>scoped(async active=>{const source=await file(record);if(active())this.bridge.occurrences(source);}),
   locateBoard:(record,reference)=>scoped(async active=>{const source=await file(record),board=this.library.referenceFile(reference);if(!active())return;if(!board)throw Error('所在白板已改名、移除或替换，请刷新记录');this.bridge.locateBoard?.(source,board,reference.nodeId);}),
   openLegacyInbox:()=>{if(live())this.bridge.legacyInbox();},
   release:()=>{released=true;detach();offLibrary();listeners.clear();if(this.owners.get(session)===owner)this.owners.delete(session);void recovery.flushDraft().catch(()=>undefined);},
  };
 }
}
