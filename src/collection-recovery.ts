/** Saving belongs to one collection composer session. The host owns its journal
 * file and exact note / board identities; this controller has no Obsidian or Node
 * dependency and never modifies an existing note. */
export interface CollectionAttachment {path:string;label:string;}
export interface CollectionTarget {key:string;title:string;groups:readonly {id:string;title:string}[];groupId?:string;}
export interface CollectionDraft {body:string;tags:string;attachments:CollectionAttachment[];target?:CollectionTarget;}
export type CollectionPhase='prepared'|'creating'|'created'|'delivering'|'completed';
export interface CollectionAttempt {id:string;createdAt:string;path:string;markdown:string;phase:CollectionPhase;}
export interface CollectionResult {id:string;createdAt:string;path:string;}
export type CollectionProbe={kind:'found';path:string}|{kind:'absent'}|{kind:'unknown';message:string};
export type CollectionJournalRead=string|null|{serialized:string;blockedReason:string};
export interface CollectionRecoveryHost {
 readJournal:()=>Promise<CollectionJournalRead>;
 /** Replace the session journal atomically where supported. Never merge it with
  * another composer session or drop an earlier failed write silently. */
 writeJournal:(serialized:string)=>Promise<void>;
 newId:()=>string;
 now:()=>string;
 /** Validation and link/source construction only: no file creation or mutation. */
 prepare:(draft:Readonly<CollectionDraft>,identity:Readonly<{id:string;createdAt:string}>)=>Promise<{path:string;markdown:string}>;
 /** Exclusive create at attempt.path, respecting current() before mutations. */
 create:(attempt:Readonly<CollectionAttempt>,current:()=>boolean)=>Promise<{path:string}>;
 /** A found result proves this unique capture's identity, including after a
  * rename. Merely finding a file with the expected name is not proof. An absent
  * result is positive proof of absence; read failures must return unknown. */
 probe:(attempt:Readonly<CollectionAttempt>)=>Promise<CollectionProbe>;
 /** Retain a runtime placement receipt before awaiting board persistence. Retry
  * that receipt; reject if its save cannot be positively confirmed. */
 deliver?:(attempt:Readonly<CollectionAttempt>,target:Readonly<CollectionTarget>,current:()=>boolean)=>Promise<void>;
 deliveryLocked?:()=>boolean;
}
export interface CollectionRecoverySnapshot {
 draft:CollectionDraft;attempt?:CollectionAttempt;busy:boolean;locked:boolean;
 targetLocked:boolean;canSubmit:boolean;status:string;error?:string;
 needsTargetSelection:boolean;
}
interface Journal {version:1;draft:CollectionDraft;attempt?:CollectionAttempt;}
const blankDraft=():CollectionDraft=>({body:'',tags:'',attachments:[]});
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
function notePath(value:unknown):value is string {
 return text(value,4096)&&value.length>0&&!value.startsWith('/')&&!value.includes('\\')&&!Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)&&!value.split('/').some(part=>!part||part==='.'||part==='..')&&/\.md$/i.test(value);
}
function target(value:unknown):value is CollectionTarget {
 return object(value)&&text(value.key,4096)&&!!value.key&&text(value.title,4096)&&Array.isArray(value.groups)&&value.groups.length<=10000&&value.groups.every(group=>object(group)&&text(group.id,4096)&&text(group.title,4096))&&(value.groupId===undefined||text(value.groupId,4096));
}
function draft(value:unknown):value is CollectionDraft {
 return object(value)&&text(value.body,100000)&&text(value.tags,10000)&&Array.isArray(value.attachments)&&value.attachments.length<=100&&value.attachments.every(item=>object(item)&&text(item.path,4096)&&!!item.path&&text(item.label,4096))&&(value.target===undefined||target(value.target));
}
function attempt(value:unknown):value is CollectionAttempt {
 return object(value)&&text(value.id,256)&&!!value.id&&text(value.createdAt,40)&&Number.isFinite(Date.parse(value.createdAt))&&new Date(value.createdAt).toISOString()===value.createdAt&&notePath(value.path)&&text(value.markdown,1000000)&&['prepared','creating','created','delivering','completed'].includes(String(value.phase));
}
function copy<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}
function parseJournal(serialized:string):Journal {
 if(serialized.length>2000000)throw Error('收集恢复文件过大，请核对原文件');
 const value:unknown=JSON.parse(serialized);
 if(!object(value)||value.version!==1||!draft(value.draft)||(value.attempt!==undefined&&!attempt(value.attempt)))throw Error('收集恢复文件格式无法确认，请保留原文件并核对');
 return{version:1,draft:copy(value.draft),attempt:value.attempt===undefined?undefined:copy(value.attempt)};
}
export function isCollectionJournalSource(serialized:string):boolean {try{parseJournal(serialized);return true;}catch{return false;}}

export class CollectionRecovery {
 readonly ready:Promise<void>;
 private state:Journal={version:1,draft:blankDraft()};
 private loaded=false;
 private disposed=false;
 private pending?:Promise<CollectionResult>;
 private writes:Promise<void>=Promise.resolve();
 private queuedDraft?:{serialized:string;work:Promise<void>};
 private draftTask=0;
 private dirty=false;
 private fatal?:string;
 private operationError?:string;
 private persistenceError?:string;
 private reselect=false;
 private readonly listeners=new Set<(snapshot:CollectionRecoverySnapshot)=>void>();
 constructor(private readonly host:CollectionRecoveryHost){this.ready=this.load();}
 private async load(){
  try{const saved=await this.host.readJournal();if(saved!==null){this.state=parseJournal(typeof saved==='string'?saved:saved.serialized);if(typeof saved!=='string')this.fatal=saved.blockedReason;}this.reselect=!!this.state.draft.target&&this.state.attempt?.phase!=='completed';}
  catch(error){this.fatal=`无法读取收集恢复文件：${message(error)}。原文件未改动`;} 
  finally{this.loaded=true;this.emit();}
 }
 get snapshot():CollectionRecoverySnapshot {
  const saved=this.state.attempt,busy=!!this.pending,blocked=!this.loaded||!!this.fatal||this.disposed;
  const locked=blocked||busy||!!saved&&saved.phase!=='prepared';
  const targetLocked=blocked||busy||saved?.phase==='creating'||saved?.phase==='completed'||!!this.host.deliveryLocked?.();
  const error=this.fatal||this.persistenceError||this.operationError;
  let status=!this.loaded?'正在恢复输入':saved?.phase==='completed'?'这条记录已保存；确认后可继续记录':saved?.phase==='creating'?'创建结果待核对；重试会先检查原记录，不会另建笔记':saved?'输入已保留，请完成这条记录':'输入会自动保存在本机';
  if(saved&&(saved.phase==='created'||saved.phase==='delivering'))status=`笔记已保留：${saved.path}；重试不会重复创建`;
  if(this.reselect)status+='；请重新选择目标白板，或取消投递';
  if(busy)status='正在保存；请稍候';
  return{draft:copy(this.state.draft),attempt:saved?copy(saved):undefined,busy,locked,targetLocked,canSubmit:!blocked&&!busy&&!!(saved||this.state.draft.body.trim()||this.state.draft.attachments.length)&&(!this.reselect||saved?.phase==='creating'||saved?.phase==='completed'),status,error,needsTargetSelection:this.reselect};
 }
 subscribe(listener:(snapshot:CollectionRecoverySnapshot)=>void){this.listeners.add(listener);listener(this.snapshot);return()=>{this.listeners.delete(listener);};}
 private emit(){const snapshot=this.snapshot;for(const listener of this.listeners){try{listener(snapshot);}catch{/* UI observers cannot change persistence results. */}}}
 private ensureAvailable(){if(!this.loaded)throw Error('收集输入仍在恢复');if(this.fatal)throw Error(this.fatal);if(this.disposed)throw Error('收集页已关闭；输入已保留');}
 private ensureCurrent(current:()=>boolean){this.ensureAvailable();if(!current())throw Error('收集页或当前位置已变化；本条记录及输入已保留');}
 private journal(){return copy(this.state);}
 private cancelScheduledDraft(){this.draftTask++;}
 private write(value:Journal,coalesceDraft=false):Promise<void> {
  const serialized=JSON.stringify(value);
  // Only an ordinary draft that has not entered the adapter may be replaced.
  // Transaction checkpoints (including the final empty journal) are barriers;
  // later typing must never change a snapshot before such a checkpoint.
  const ordinary=coalesceDraft&&!value.attempt;
  if(ordinary&&this.queuedDraft){this.queuedDraft.serialized=serialized;return this.queuedDraft.work;}
  this.queuedDraft=undefined;
  const entry={serialized,work:Promise.resolve()};
  const work=this.writes.catch(()=>undefined).then(()=>{
   if(this.queuedDraft===entry)this.queuedDraft=undefined;
   return this.host.writeJournal(entry.serialized);
  });
  entry.work=work;if(ordinary)this.queuedDraft=entry;
  this.writes=work;
  void work.then(()=>{this.persistenceError=undefined;this.emit();},error=>{this.persistenceError=`无法保存收集恢复信息：${message(error)}；输入仍在本页，请重试`;this.emit();});
  return work;
 }
 private persist(){this.cancelScheduledDraft();this.dirty=false;return this.write(this.journal(),true);}
 /** UI edits are coalesced until their ordinary draft write starts. flushDraft() is available
  * for blur/close and is awaited before any note creation. */
 updateDraft(patch:Partial<CollectionDraft>){
  this.ensureAvailable();
  const snapshot=this.snapshot,content=['body','tags','attachments'].some(key=>Object.prototype.hasOwnProperty.call(patch,key)),changingTarget=Object.prototype.hasOwnProperty.call(patch,'target');
  if(content&&snapshot.locked)throw Error('这条记录已开始保存；不能覆盖已创建或待核对的笔记');
  if(changingTarget&&snapshot.targetLocked)throw Error('目标投递正在保存或等待核对；请先确认原投递');
  const next={...this.state.draft,...patch};
  if(!draft(next))throw Error('收集输入格式无效或内容过长');
  this.state.draft=copy(next);
  if(content&&this.state.attempt?.phase==='prepared')this.state.attempt=undefined;
  if(changingTarget)this.reselect=false;
  this.operationError=undefined;this.dirty=true;const task=++this.draftTask;
  // Coalesce synchronous edits, then serialize IO independently of any window.
  void Promise.resolve().then(()=>{if(task===this.draftTask&&this.dirty)void this.persist().catch(()=>undefined);});
  this.emit();
 }
 async flushDraft(){
  await this.ready;if(this.fatal)throw Error(this.fatal);
  for(;;){
   const work=this.dirty||this.persistenceError?this.persist():this.writes;
   await work;
   if(work===this.writes&&!this.dirty)return;
  }
 }
 private async checkAttempt(saved:CollectionAttempt,allowAbsent:boolean){
  let result:CollectionProbe;
  try{result=await this.host.probe(copy(saved));}catch(error){throw Error(`无法确认原笔记：${message(error)}；请核对后重试，不会另建笔记`);}
  if(result.kind==='unknown')throw Error(`${result.message}；创建结果待核对，不会另建笔记`);
  if(result.kind==='absent'){
   if(!allowAbsent)throw Error(`已保存的笔记被移动、删除或身份无法确认：${saved.path}；不会重新创建`);
   saved.phase='prepared';await this.persist();return false;
  }
  if(!notePath(result.path))throw Error('核对返回的笔记路径无效；不会重新创建');
  saved.path=result.path;if(saved.phase==='creating')saved.phase='created';await this.persist();return true;
 }
 private async create(saved:CollectionAttempt,current:()=>boolean){
  saved.phase='creating';await this.persist();this.ensureCurrent(current);
  let created:{path:string};
  try{created=await this.host.create(copy(saved),()=>!this.disposed&&current());}
  catch(error){
   // A thrown create may have already written the file. Prove its identity or
   // absence before permitting another create, including after cancellation.
   const found=await this.checkAttempt(saved,true);
   if(found)return;
   throw Error(`${message(error)}；创建未完成，输入已保留`);
  }
  if(!notePath(created.path))throw Error('创建返回的笔记路径无效；请核对原记录');
  // Retain the result before checking navigation/disposal or awaiting journal IO.
  saved.path=created.path;saved.phase='created';await this.persist();
 }
 /** Reentrant calls share exactly one promise. current() must permanently become
  * false for this invocation after closing or navigating away (even if returning). */
 submit(current:()=>boolean=()=>true):Promise<CollectionResult> {
  if(this.pending)return this.pending;
  const work=Promise.resolve().then(async()=>{
   await this.ready;this.ensureCurrent(current);await this.flushDraft();this.ensureCurrent(current);this.operationError=undefined;
   let saved=this.state.attempt;
   if(saved?.phase==='creating')await this.checkAttempt(saved,true);
   else if(saved&&saved.phase!=='prepared')await this.checkAttempt(saved,false);
   this.ensureCurrent(current);
   if(this.reselect&&saved?.phase!=='completed')throw Error('恢复的目标需要重新选择；原笔记与输入已保留，也可取消投递');
   if(!saved){
    const identity={id:this.host.newId(),createdAt:this.host.now()};
    const prepared=await this.host.prepare(copy(this.state.draft),Object.freeze(identity));this.ensureCurrent(current);
    saved={...identity,...prepared,phase:'prepared'};
    if(!attempt(saved))throw Error('收集保存信息无效；尚未创建笔记');
    this.state.attempt=saved;await this.persist();
   }
   this.ensureCurrent(current);
   if(saved.phase==='prepared')await this.create(saved,current);
   this.ensureCurrent(current);
   if(saved.phase!=='completed'){
    if(this.state.draft.target){
     if(!this.host.deliver)throw Error('当前无法向白板投递；笔记已保留，可取消投递后继续');
     saved.phase='delivering';await this.persist();this.ensureCurrent(current);
     try{await this.host.deliver(copy(saved),copy(this.state.draft.target),()=>!this.disposed&&current());}
     catch(error){if(!this.host.deliveryLocked?.()){saved.phase='created';await this.persist();}throw error;}
    }
    saved.phase='completed';await this.persist();
   }
   this.ensureCurrent(current);
   const result:CollectionResult={id:saved.id,createdAt:saved.createdAt,path:saved.path},empty:Journal={version:1,draft:blankDraft()};
   // Clear only after both the note/delivery and empty journal are confirmed.
   // If navigation happens during this final write, retain the completed receipt
   // for the next invocation rather than letting a late callback clear its UI.
   await this.write(empty);
   if(this.disposed||!current()){await this.persist();this.ensureCurrent(current);}
   this.state=empty;this.reselect=false;this.operationError=undefined;this.emit();return result;
  }).catch((error:unknown)=>{this.operationError=message(error);this.emit();throw error instanceof Error?error:new Error(message(error));}).finally(()=>{if(this.pending===work)this.pending=undefined;this.emit();});
  this.pending=work;this.emit();return work;
 }
 /** A closing page cannot receive a successful late submit. Pending creation is
  * still recorded, and the latest editable draft is flushed without erasing it. */
 dispose(){this.disposed=true;this.cancelScheduledDraft();if(this.dirty)void this.persist().catch(()=>undefined);this.listeners.clear();}
}
