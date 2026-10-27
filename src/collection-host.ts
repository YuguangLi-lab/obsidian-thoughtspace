import {findCollectionDuplicates} from './collection-duplicates';
import {App,Component,FuzzySuggestModal,TFile,WorkspaceLeaf,normalizePath} from 'obsidian';
import {CollectionRecovery,isCollectionJournalSource,type CollectionDraft,type CollectionJournalRead} from './collection-recovery';
import {collectionNoteSource,collectionTitle} from './collection-model';
import {CollectionContext} from './collection-context';
import {CollectionNoteExporter} from './collection-note-export';
import type {CollectionIdentity} from './collection-model';
import type {CollectionBoardDeliveryResult,CollectionBoardReceiptHistory} from './collection-board-receipts';
import {CollectionLibrary} from './collection-library';
import {CollectionJournalStore,collectionJournalCanonical} from './collection-journal-store';
import {normalizeNativeTags} from './native-tags';
import {isWorkspaceFile} from './workspace';
import {bindBoardModalViewport} from './board-modal-viewport';
import {setCollectionReview} from './collection-review-host';
import {setCollectionFlag} from './collection-organize';
import {CollectionJsonStore,collectionJsonCanonical} from './collection-json-store';
import {CollectionSavedFilters,isCollectionSavedFiltersDocument} from './collection-saved-filters';
import {CollectionBatchCoordinator,CollectionBatchExecutionError,isCollectionBatchJournal,type CollectionBatchJournal,type CollectionBatchReport} from './collection-batch';
import type {CollectionAttachment,CollectionRecord,CollectionTarget,CollectionViewHost} from './collection-view';
import type {BoardBackground} from './board-background';

export interface CollectionBridge {
 accent?():string;density?():string;
 background?():BoardBackground;backgroundResource?:(path:string)=>string;
 openRecoveryCenter?:()=>void;
 openBackground?:(anchor:HTMLElement,current:()=>boolean)=>void;
 directory:string;
 folder():string;
 newId():string;
 ensureFolder(path:string):Promise<unknown>;
 pickTarget(document:Document,current:()=>boolean):{result:Promise<CollectionTarget|undefined>;close():void};
 deliver(session:string,file:TFile,target:CollectionTarget,current:()=>boolean,beforeStage?:()=>void):Promise<CollectionBoardDeliveryResult>;
 deliveryReceipts?(identity:CollectionIdentity):Promise<CollectionBoardReceiptHistory>;
 isBoardFile?(file:TFile):boolean;
 deliveryLocked(session:string):boolean;
 openNote(file:TFile,current:()=>boolean,document:Document):Promise<unknown>;
 openRelated?(file:TFile,source:CollectionRecord,current:()=>boolean,document:Document):Promise<unknown>;
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
 private organizing=new Set<string>();
 private filters?:CollectionSavedFilters;
 private exporter?:CollectionNoteExporter;
 private libraryListeners=new Set<(kind:'filters'|'batches')=>void>();
 private batchRunning=false;
 private stopped=false;
 constructor(private readonly app:App,readonly library:CollectionLibrary,private readonly bridge:CollectionBridge){super();}
 onunload(){this.stopped=true;this.exporter?.dispose();for(const recovery of this.sessions.values())recovery.dispose();this.owners.clear();this.libraryListeners.clear();}
 private libraryDirectory(){return normalizePath(`${this.bridge.directory}/collection-library`);}
 private noteExporter(){return this.exporter??=new CollectionNoteExporter(this.app,this.library,{directory:`${this.libraryDirectory()}/note-exports`,newId:()=>this.bridge.newId(),ensureJournalDirectory:path=>this.ensureDirectory(path),isBoardFile:file=>this.bridge.isBoardFile?.(file)===true});}
 private savedFilters(){return this.filters??=new CollectionSavedFilters(new CollectionJsonStore(this.app.vault.adapter,`${this.libraryDirectory()}/saved-filters.json`,()=>this.bridge.newId(),isCollectionSavedFiltersDocument),()=>this.bridge.newId());}
 private notifyLibrary(kind:'filters'|'batches'){for(const notify of this.libraryListeners)try{notify(kind);}catch{/* A view cannot turn a confirmed save into a reported write failure. */}}
 private batchStore(id:string){return new CollectionJsonStore<CollectionBatchJournal>(this.app.vault.adapter,`${this.libraryDirectory()}/batches/batch-${id}.json`,()=>this.bridge.newId(),isCollectionBatchJournal);}
 private async batchReports():Promise<{reports:readonly CollectionBatchReport[];warning?:string}>{
  const directory=`${this.libraryDirectory()}/batches`,reports:CollectionBatchReport[]=[],warnings:string[]=[];
  try{
   if(!await this.app.vault.adapter.exists(directory))return{reports};
   const listing=await this.app.vault.adapter.list(directory);
   // Host-created names begin with epoch milliseconds so bounded history can
   // list the latest batches without reading every journal or a separate index.
   const ids=[...new Set(listing.files.flatMap(path=>{
    const canonical=collectionJsonCanonical(path);if(!canonical?.startsWith(directory+'/'))return[];
    const match=/^batch-([A-Za-z0-9_-]{8,120})\.json$/.exec(canonical.slice(directory.length+1));
    return match?[match[1]]:[];
   }))].sort().reverse().slice(0,20);
   for(const id of ids){const result=await new CollectionBatchCoordinator(this.batchStore(id)).load();if(result.report)reports.push(result.report);if(result.warning)warnings.push(result.warning);}
  }catch(error){warnings.push(error instanceof Error?error.message:String(error));}
  return{reports:reports.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),...(warnings.length?{warning:`部分批次记录需要核对：${warnings.join('；')}`}:{})};
 }
 private journal(id:string){if(!validSession(id))throw Error('收集草稿标识无效');return normalizePath(`${this.bridge.directory}/collection-drafts/${id}.json`);}
 private async ensureDirectory(directory=normalizePath(`${this.bridge.directory}/collection-drafts`)){
  const parts=directory.split('/');let current='';
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
 async recoveryEntries(current:()=>boolean){
  const entries:{id:string;title:string;storage:'memory'|'checkpoint'|'unknown';text:string;description:string}[]=[];
  const describe=(value:{body:string;tags:string;attachments:readonly {path:string}[]})=>value.body+(value.tags?'\n\n标签：'+value.tags:'')+(value.attachments.length?'\n\n附件：\n'+value.attachments.map(a=>a.path).join('\n'):'');
  for(const[id,recovery]of this.sessions){if(!current())return entries;const state=recovery.snapshot;if(state.draft.body||state.draft.tags||state.draft.attachments.length||state.attempt)entries.push({id:id+':memory',title:id,storage:'memory',text:describe(state.draft),description:'当前会话输入；'+state.status+(state.error?'；'+state.error:'')});}
  const directory=normalizePath(`${this.bridge.directory}/collection-drafts`);if(!await this.app.vault.adapter.exists(directory))return entries;
  const files=(await this.app.vault.adapter.list(directory)).files,paths=[...new Set(files.map(collectionJournalCanonical).filter((p):p is string=>!!p&&p.startsWith(directory+'/')))];
  for(const path of paths.slice(0,500)){if(!current())return entries;const id=path.slice(path.lastIndexOf('/')+1).replace(/\.json$/,'');if(!validSession(id))continue;
   try{let canonical:string|undefined;try{canonical=await this.app.vault.adapter.read(path);}catch{/* The existing store handles missing/damaged canonical files and previous checkpoints. */}
    const raw:CollectionJournalRead=canonical!==undefined&&isCollectionJournalSource(canonical)?canonical:await new CollectionJournalStore(this.app.vault.adapter,path,()=>this.bridge.newId()).read();
    if(raw===null)continue;const serialized=typeof raw==='string'?raw:raw.serialized;if(!isCollectionJournalSource(serialized))throw Error('恢复检查点格式无法确认');const data:unknown=JSON.parse(serialized);
    if(!data||typeof data!=='object'||!('draft'in data)||!data.draft||typeof data.draft!=='object'||!('body'in data.draft)||typeof data.draft.body!=='string')continue;
    const draft=data.draft as CollectionDraft;if(!draft.body&&!draft.tags&&!draft.attachments.length&&!('attempt'in data&&data.attempt))continue;
    entries.push({id:id+':checkpoint',title:id,storage:typeof raw==='string'?'checkpoint':'unknown',text:describe(draft),description:typeof raw==='string'?'已读取并校验的会话检查点；与当前内存输入可能不同。':raw.blockedReason});
   }catch(error){entries.push({id:id+':unknown',title:id,storage:'unknown',text:'',description:'恢复材料无法确认，请从收集原入口核对：'+String(error)});}
  }
  if(paths.length>500)entries.push({id:'collection-limit',title:'还有更多恢复材料',storage:'unknown',text:'',description:'本次最多检查500个会话，请从原收集入口核对剩余材料。'});return entries;
 }
 private draftBody(draft:Pick<CollectionDraft,'body'|'attachments'>,path:string){
    const references=draft.attachments.map(attachment=>{
     const file=this.app.vault.getAbstractFileByPath(attachment.path);if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('所选附件已移动或删除，请重新选择');
     const link=this.app.fileManager.generateMarkdownLink(file,path);
     return /^(png|jpe?g|gif|webp|avif|bmp|svg|pdf|mp3|m4a|wav|ogg|mp4|webm|mov)$/i.test(file.extension)?`!${link}`:link;
    });
    return draft.body+(references.length?`${draft.body?'\n\n':''}${references.join('\n')}`:'');
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
    const body=this.draftBody(draft,path);
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
  let context:CollectionContext|undefined;const contexts=()=>context??=new CollectionContext(this.app,this.library);
  const owner=Symbol('collection-view');let session=`session-${this.bridge.newId()}`,recovery=this.recovery(session),released=false,sessionEpoch=0;
  const listeners=new Set<(kind?:'draft'|'records'|'filters'|'batches')=>void>();let detach=()=>{};
  const libraryChanged=(kind:'filters'|'batches')=>{for(const listener of listeners)listener(kind);};this.libraryListeners.add(libraryChanged);
  this.owners.set(session,owner);
  const bind=()=>{detach();detach=recovery.subscribe(()=>{for(const listener of listeners)listener('draft');});};bind();
  const offLibrary=this.library.subscribe(()=>{for(const listener of listeners)listener('records');});
  const live=()=>!this.stopped&&!released&&leaf.view.containerEl.isConnected&&!leaf.view.containerEl.ownerDocument.defaultView?.closed;
  const scoped=async<T>(fn:(current:()=>boolean)=>Promise<T>,outer:()=>boolean=()=>true):Promise<T>=>{
   let valid=live()&&outer()&&this.app.workspace.activeLeaf===leaf;
   const changed=()=>{if(this.app.workspace.activeLeaf!==leaf)valid=false;};
   const ref=this.app.workspace.on('active-leaf-change',changed);
   try{return await fn(()=>valid&&live()&&outer());}finally{this.app.workspace.offref(ref);}
  };
  const file=async(record:CollectionRecord,strict=false)=>{const result=await this.library.resolve(record,record.path);if(!result||strict&&result.path!==record.path)throw Error('原笔记已变化，请刷新后重试');return result;};
  const locked=async<T>(record:CollectionIdentity,work:()=>Promise<T>):Promise<T>=>{
   const key=JSON.stringify([record.id,record.createdAt]);
   if(this.organizing.has(key))throw Error('这条记录正在更新，请稍候');
   this.organizing.add(key);
   try{return await work();}finally{this.organizing.delete(key);this.library.invalidate();}
  };
  const flagRecord=(record:CollectionRecord,flag:'pinned'|'archived',value:boolean,active:()=>boolean,invoke?:()=>void)=>locked(record,async()=>{
   let watch:ReturnType<CollectionLibrary['watchIdentity']>|undefined;
   try{
    watch=this.library.watchIdentity(record);const source=await file(record,true);
    if(!active())throw Error('页面已变化，整理操作已取消');
    const current=()=>active()&&watch?.current(source)===true&&source.path===record.path;
    invoke?.();
    return await setCollectionFlag(this.app,source,record,flag==='pinned'?'thoughtspace_pinned':'thoughtspace_archived',value,current,record[flag]===true);
   }finally{watch?.release();}
  });
  const deliverRecord=(record:CollectionRecord,target:CollectionTarget,active:()=>boolean,staged?:()=>void,resumePending=false)=>locked(record,async()=>{
   let watch:ReturnType<CollectionLibrary['watchIdentity']>|undefined;
   try{
    // Only an explicit single-record retry may follow a verified native rename.
    // The bridge still requires the exact pending TFile and destination receipt;
    // new deliveries and frozen batch selections retain strict path matching.
    const pending=resumePending&&this.bridge.deliveryLocked(`record:${record.id}`);
    watch=this.library.watchIdentity(record,{allowSourceChanges:false});const source=await file(record,!pending),path=source.path;
    const exact=()=>active()&&source.path===path&&this.app.vault.getAbstractFileByPath(path)===source;
    if(!exact()||!watch.current(source))throw Error('原笔记或页面已变化，投递已取消');
    // The bridge calls this synchronously immediately before staging its exact
    // destination. Afterwards the source TFile/path remains guarded; its own
    // target-board write must not invalidate a source duplicate-index watcher.
    const beforeStage=()=>{if(!exact()||!watch?.current(source))throw Error('原笔记身份已变化，投递已取消');watch.release();watch=undefined;staged?.();};
    return await this.bridge.deliver(`record:${record.id}`,source,target,exact,beforeStage);
   }finally{watch?.release();}
  });
  const pickAttachment=(current:()=>boolean,notes=false)=>new Promise<CollectionAttachment|undefined>(resolve=>{
   if(!current()){resolve(undefined);return;}
   const app=this.app,doc=leaf.view.containerEl.ownerDocument;let done=false,unbind=()=>{};
   const finish=(value?:CollectionAttachment)=>{if(!done){done=true;resolve(value);}};
   class AttachmentPicker extends FuzzySuggestModal<TFile>{
    getItems(){return app.vault.getFiles().filter(isWorkspaceFile).filter(file=>notes?file.extension==='md'&&!isBoard(file):file.extension!=='md'&&file.extension!=='thoughtspace');}
    getItemText(file:TFile){return file.path;}
    onChooseItem(file:TFile){finish(current()?{path:file.path,label:file.name}:undefined);}
    onOpen(){void Promise.resolve(super.onOpen()).catch(()=>{finish();this.close();});if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);unbind=bindBoardModalViewport(this.containerEl);}
    // Obsidian closes a chosen suggestion before calling onChooseItem. Give
    // that synchronous callback priority; a plain close still cancels once.
    onClose(){unbind();super.onClose();queueMicrotask(()=>finish());}
   }
   const picker=new AttachmentPicker(app);picker.setPlaceholder(notes?'选择要追加的 Markdown 笔记…':'引用库内附件…');picker.open();
  });
  const isBoard=(file:TFile)=>this.bridge.isBoardFile?.(file)===true;
  return{
   accent:()=>this.bridge.accent?.()||'forest',density:()=>this.bridge.density?.()||'comfortable',
   background:this.bridge.background?()=>this.bridge.background!():undefined,backgroundResource:this.bridge.backgroundResource,
   openBackground:this.bridge.openBackground?(anchor,current)=>this.bridge.openBackground!(anchor,()=>live()&&current()):undefined,
   openRecoveryCenter:this.bridge.openRecoveryCenter,
   sessionId:()=>session,
   setSessionId:async id=>{
    const epoch=++sessionEpoch;
    if(!validSession(id)||id===session)return;
    await recovery.flushDraft();
    if(released||epoch!==sessionEpoch)return;
    if(this.owners.get(session)===owner)this.owners.delete(session);
    session=this.owners.has(id)?`session-${this.bridge.newId()}`:id;
    this.owners.set(session,owner);recovery=this.recovery(session);bind();await recovery.ready;
   },
   ready:async()=>{await recovery.ready;},
   draft:()=>{const state=recovery.snapshot;return{...state.draft,busy:state.busy,locked:state.locked,targetLocked:state.targetLocked,canSubmit:state.canSubmit,status:[state.error,state.status].filter(Boolean).join('；')};},
   updateDraft:patch=>recovery.updateDraft({...patch,...('target'in patch?{target:patch.target||undefined}:{}),...('attachments'in patch?{attachments:patch.attachments?[...patch.attachments]:[]}:{} )} as Partial<CollectionDraft>),
   flushDraft:()=>recovery.flushDraft(),
   submit:current=>scoped(async active=>{await recovery.submit(active);this.library.invalidate();},current),
   subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
   checkDuplicates:async(body,current,attachments=[])=>{const rendered=this.draftBody({body,attachments:[...attachments]},normalizePath(this.bridge.folder())+'/capture-duplicate-check.md');const records=await this.library.list();return findCollectionDuplicates(records,rendered,async record=>{const source=await file(record,true);if(source.stat.size>1024*1024)throw Error('记录过大，未检查');return this.library.readBody(record);},()=>live()&&current());},
   setReview:(record,on,current)=>scoped(active=>locked(record,async()=>{const source=await file(record,true);const watch=this.library.watchIdentity(record);try{await setCollectionReview(this.app,source,record,on,()=>active()&&watch.current(source),record.reviewOn);}finally{watch.release();}}),current),
   list:()=>this.library.list(),readBody:record=>this.library.readBody(record),
   inspectContext:(record,current)=>contexts().inspect(record,()=>live()&&current()),
   attachmentPage:async(query,current)=>contexts().attachments(await this.library.list(),query,()=>live()&&current()),
   validateContext:async(record,item,current)=>{await contexts().resolveTarget(record,item,()=>live()&&current());},
   openContext:(record,item,current)=>scoped(async active=>{const model=contexts(),target=await model.resolveTarget(record,item,active),exact=()=>active()&&model.isCurrent(record,item);if(!exact())throw Error('引用已变化，请刷新后重试');if(this.bridge.openRelated)await this.bridge.openRelated(target,record,exact,leaf.view.containerEl.ownerDocument);else await this.bridge.openNote(target,exact,leaf.view.containerEl.ownerDocument);},current),
   pickNote:current=>scoped(async active=>(await pickAttachment(active,true))?.path,current),
   noteHeadings:(path,current)=>scoped(active=>this.noteExporter().headings(path,active),current),
   prepareNote:(record,target,current)=>scoped(active=>this.noteExporter().prepare(record,target,active),current),
   commitNote:(preview,current)=>scoped(active=>locked(preview.source,()=>this.noteExporter().commit(preview,active)),current),
   discardNote:preview=>this.noteExporter().discard(preview),
   inspectNote:id=>this.noteExporter().inspect(id),noteHistory:()=>this.noteExporter().history(),
   openNotePath:(path,current)=>scoped(async active=>{const target=this.app.vault.getAbstractFileByPath(path);if(!(target instanceof TFile)||!isWorkspaceFile(target)||target.extension!=='md'||isBoard(target))throw Error('目标笔记已变化，请从文件列表核对');const exact=()=>active()&&target.path===path&&this.app.vault.getAbstractFileByPath(path)===target;await this.bridge.openNote(target,exact,leaf.view.containerEl.ownerDocument);},current),
   deliveryReceipts:this.bridge.deliveryReceipts?record=>this.bridge.deliveryReceipts!(record):undefined,
   search:(options,current,progress)=>this.library.search(options,()=>live()&&current(),progress),
   setFlag:(record,flag,value,current)=>scoped(async active=>{await flagRecord(record,flag,value,active);},current),
   savedFilters:()=>this.savedFilters().list(),
   saveFilter:(name,options,current,id)=>scoped(async active=>{if(!active())throw Error('页面已变化，保存筛选已取消');const store=this.savedFilters();await this.ensureDirectory(this.libraryDirectory());const result=await store.save(name,options,active,id);this.notifyLibrary('filters');return result;},current),
   deleteFilter:(id,current)=>scoped(async active=>{await this.savedFilters().remove(id,active);this.notifyLibrary('filters');},current),
   batchReports:()=>this.batchReports(),
   batch:(request,current,onProgress)=>{
    // Copy before the first await. UI selection and opaque destination authority
    // never come from a restored diagnostic journal.
    const items=request.items.map(record=>({...record,tags:[...record.tags]})),operation=request.operation,target=request.target?{...request.target,duplicate:undefined,groups:request.target.groups.map(group=>({...group}))}:undefined;
    return scoped(async active=>{
     if(this.batchRunning)throw Error('另一批整理仍在执行，请先等待结果');
     if(!active())throw Error('页面已变化，批量操作已取消');
     if(operation==='deliver'&&(!target?.path||target.groupId!==undefined&&!target.groups.some(group=>group.id===target.groupId)))throw Error('请重新选择有效的目标白板与分组');
     this.batchRunning=true;
     try{
      const id=`${Date.now()}-${this.bridge.newId()}`,coordinator=new CollectionBatchCoordinator(this.batchStore(id));
      await this.ensureDirectory(`${this.libraryDirectory()}/batches`);
      await coordinator.start({id,createdAt:new Date().toISOString(),operation,...(operation==='deliver'&&target?{target:{name:target.title,path:target.path!,...(target.groupId!==undefined?{groupId:target.groupId,groupName:target.groups.find(group=>group.id===target.groupId)!.title}:{})}}:{}),items:items.map(record=>({id:record.id,createdAt:record.createdAt,path:record.path,title:record.title,expectedArchived:record.archived===true}))},active,onProgress);
      return await coordinator.run(async(_source,index)=>{
       const record=items[index];let entered=false,wasPending=false;
       try{
        if(operation==='deliver'){
         wasPending=this.bridge.deliveryLocked(`record:${record.id}`);
         // Unknown earlier delivery belongs to its original single-record flow;
         // a new batch must not silently retry that pending write.
         if(wasPending)throw new CollectionBatchExecutionError('unknown','这条记录有尚未确认的投递，请先核对原白板与恢复草稿');
         const receipt=await deliverRecord(record,target!,active,()=>{entered=true;});
         return{status:receipt.added?'confirmed':'already-present',message:receipt.added?'引用已确认保存':'目标白板已有该引用；未改变其分组或位置'};
        }
        const receipt=await flagRecord(record,'archived',operation==='archive',active,()=>{entered=true;});
        return{status:receipt.changed?'confirmed':'already-present',message:receipt.changed?'原生归档属性已确认保存':'原记录已处于所选状态'};
       }catch(error){
        if(error instanceof CollectionBatchExecutionError)throw error;
        const outcome=operation!=='deliver'&&error&&typeof error==='object'&&'outcome'in error&&(error.outcome==='not-written'||error.outcome==='unknown')?error.outcome:entered||wasPending?'unknown':'not-written';
        throw new CollectionBatchExecutionError(outcome,error instanceof Error?error.message:String(error));
       }
      },active,onProgress);
     }finally{this.batchRunning=false;this.notifyLibrary('batches');}
    },current);
   },
   pickAttachment:current=>scoped(active=>pickAttachment(active),current),
   pickTarget:current=>scoped(async active=>{const picker=this.bridge.pickTarget(leaf.view.containerEl.ownerDocument,active);try{return await picker.result;}finally{picker.close();}},current),
   deliver:(record,target,current)=>scoped(active=>deliverRecord(record,target,active,undefined,true),current),
   openNote:record=>scoped(async active=>{const source=await file(record);if(active())await this.bridge.openNote(source,active,leaf.view.containerEl.ownerDocument);}),
   showOccurrences:record=>scoped(async active=>{const source=await file(record);if(active())this.bridge.occurrences(source);}),
   locateBoard:(record,reference)=>scoped(async active=>{const source=await file(record),board=this.library.referenceFile(reference);if(!active())return;if(!board)throw Error('所在白板已改名、移除或替换，请刷新记录');this.bridge.locateBoard?.(source,board,reference.nodeId);}),
   openLegacyInbox:()=>{if(live())this.bridge.legacyInbox();},
   release:()=>{released=true;sessionEpoch++;context?.dispose();context=undefined;detach();offLibrary();this.libraryListeners.delete(libraryChanged);listeners.clear();if(this.owners.get(session)===owner)this.owners.delete(session);void recovery.flushDraft().catch(()=>undefined);},
  };
 }
}
