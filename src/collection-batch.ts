import type {CollectionJsonStore} from './collection-json-store';

export type CollectionBatchOperation='deliver'|'archive'|'restore';
export type CollectionBatchItemStatus='not-started'|'running'|'confirmed'|'already-present'|'not-written'|'unknown';
export type CollectionBatchPhase='prepared'|'running'|'completed'|'stopped'|'cancelled'|'review-required';
export interface CollectionBatchSource {id:string;createdAt:string;path:string;title:string;expectedArchived:boolean;}
/** Diagnostics only. Live board ownership/token must stay in the executor's closure. */
export interface CollectionBatchTarget {name:string;path:string;groupId?:string;groupName?:string;}
export interface CollectionBatchManifest {id:string;createdAt:string;operation:CollectionBatchOperation;target?:CollectionBatchTarget;items:readonly CollectionBatchSource[];}
export interface CollectionBatchItem {source:CollectionBatchSource;status:CollectionBatchItemStatus;message?:string;}
export interface CollectionBatchJournal {version:1;id:string;createdAt:string;operation:CollectionBatchOperation;target?:CollectionBatchTarget;items:CollectionBatchItem[];phase:CollectionBatchPhase;}
export interface CollectionBatchReport extends CollectionBatchJournal {
 readOnly:boolean;journalConfirmed:boolean;counts:Record<CollectionBatchItemStatus,number>;warning?:string;
}
export interface CollectionBatchReceipt {status:'confirmed'|'already-present';message?:string;}
export interface CollectionBatchLoad {report:CollectionBatchReport|null;warning?:string;}
export type CollectionBatchExecutor=(source:Readonly<CollectionBatchSource>,index:number)=>Promise<CollectionBatchReceipt>;
export type CollectionBatchProgress=(report:CollectionBatchReport)=>void;
export class CollectionBatchExecutionError extends Error {
 constructor(readonly outcome:'not-written'|'unknown',message:string){super(message);this.name='CollectionBatchExecutionError';}
}
type Store=Pick<CollectionJsonStore<CollectionBatchJournal>,'read'|'write'>;
const statuses:CollectionBatchItemStatus[]=['not-started','running','confirmed','already-present','not-written','unknown'];
const phases:CollectionBatchPhase[]=['prepared','running','completed','stopped','cancelled','review-required'];
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
const stamp=(value:unknown):value is string=>text(value,24)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function relativePath(value:unknown):value is string {
 return text(value,4096)&&!!value&&!value.startsWith('/')&&!value.includes('\\')&&!/^[a-z][a-z\d+.-]*:/i.test(value)&&!Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)&&!value.split('/').some(part=>!part||part==='.'||part==='..');
}
function source(value:unknown):value is CollectionBatchSource {
 return object(value)&&keys(value,['id','createdAt','path','title','expectedArchived'])&&text(value.id,120)&&value.id.length>=12&&/^capture-[A-Za-z0-9_-]+$/.test(value.id)&&stamp(value.createdAt)&&relativePath(value.path)&&/\.md$/i.test(value.path)&&text(value.title,512)&&typeof value.expectedArchived==='boolean';
}
function target(value:unknown):value is CollectionBatchTarget {
 return object(value)&&keys(value,['name','path','groupId','groupName'])&&text(value.name,512)&&relativePath(value.path)&&(value.groupId===undefined||text(value.groupId,256))&&(value.groupName===undefined||text(value.groupName,512));
}
const success=(status:CollectionBatchItemStatus)=>status==='confirmed'||status==='already-present';
/** Bounded schema intentionally rejects body text, live tokens and unknown fields. */
export function isCollectionBatchJournal(value:unknown):value is CollectionBatchJournal {
 if(!object(value)||!keys(value,['version','id','createdAt','operation','target','items','phase'])||value.version!==1||!text(value.id,120)||!/^[A-Za-z0-9_-]+$/.test(value.id)||!stamp(value.createdAt)||!['deliver','archive','restore'].includes(String(value.operation))||!phases.includes(value.phase as CollectionBatchPhase))return false;
 if(value.operation==='deliver'?!target(value.target):value.target!==undefined)return false;
 if(!Array.isArray(value.items)||!value.items.length||value.items.length>24)return false;
 const identities=new Set<string>(),paths=new Set<string>(),itemStatuses:CollectionBatchItemStatus[]=[];let suffix=false,terminal=false,running=0;
 for(const item of value.items){
  if(!object(item)||!keys(item,['source','status','message'])||!source(item.source)||!statuses.includes(item.status as CollectionBatchItemStatus)||(item.message!==undefined&&!text(item.message,240)))return false;
  itemStatuses.push(item.status as CollectionBatchItemStatus);
  if(identities.has(item.source.id)||paths.has(item.source.path))return false;identities.add(item.source.id);paths.add(item.source.path);
  if(item.status==='not-started'){suffix=true;continue;}
  if(suffix||terminal)return false;
  if(item.status==='running'){running++;terminal=true;}
  if(item.status==='not-written'||item.status==='unknown')terminal=true;
 }
 if(running>1||running&&value.phase!=='running')return false;
 if(value.phase==='prepared'&&!itemStatuses.every(status=>status==='not-started'))return false;
 if(value.phase==='completed'&&!itemStatuses.every(success))return false;
 return true;
}
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const diagnostic=(error:unknown)=>Array.from((error instanceof Error?error.message:typeof error==='string'?error:'操作未返回可确认结果').slice(0,240).replace(/[\uD800-\uDBFF]$/u,'')).join('');

/** One controller owns one fresh journal path and can execute only the batch it
 * created in this session. Loading a journal is always observational. */
export class CollectionBatchCoordinator {
 private journal?:CollectionBatchJournal;
 private initialized=false;private initializing=false;private runnable=false;
 private readOnly=true;private journalConfirmed=false;private warning?:string;
 private pending?:Promise<CollectionBatchReport>;
 constructor(private readonly store:Store){}
 get report():CollectionBatchReport|null {
  if(!this.journal)return null;
  const counts:Record<CollectionBatchItemStatus,number>={'not-started':0,running:0,confirmed:0,'already-present':0,'not-written':0,unknown:0};
  for(const item of this.journal.items)counts[item.status]++;
  return{...copy(this.journal),readOnly:this.readOnly,journalConfirmed:this.journalConfirmed,counts,...(this.warning?{warning:this.warning}:{})};
 }
 private emit(progress?:CollectionBatchProgress){const report=this.report;if(report&&progress)try{progress(report);}catch{/* Observers cannot interrupt durable receipts. */}}
 private initialize(){if(this.initialized||this.initializing)throw Error('此批次协调器已使用，请保留原报告并新建批次');this.initializing=true;this.initialized=true;}
 private restore(value:CollectionBatchJournal,blocked?:string){
  this.journal=copy(value);this.readOnly=true;this.runnable=false;this.journalConfirmed=!blocked;this.warning=blocked;
  if(this.journal.items.some(item=>item.status==='running')){
   this.journal.items=this.journal.items.map(item=>item.status==='running'?{...item,status:'unknown',message:'上次操作已开始，结果待核对；不会自动重试'}:item);
   this.journal.phase='review-required';this.warning=[blocked,'上次操作结果待核对，本报告只读，不会恢复执行'].filter(Boolean).join('；');
  }
 }
 async load():Promise<CollectionBatchLoad>{
  this.initialize();
  try{
   const saved=await this.store.read();
   if(saved.value!==null){if(!isCollectionBatchJournal(saved.value))throw Error('批次日志格式无法确认');this.restore(saved.value,saved.blocked);}
   else this.warning=saved.blocked;
  }catch(error){this.warning=`无法读取批次日志：${diagnostic(error)}；未执行任何操作`;}
  finally{this.initializing=false;}
  return{report:this.report,...(this.warning?{warning:this.warning}:{})};
 }
 async start(manifest:CollectionBatchManifest,current:()=>boolean,progress?:CollectionBatchProgress):Promise<CollectionBatchReport>{
  this.initialize();
  try{
   const journal:CollectionBatchJournal={version:1,id:manifest.id,createdAt:manifest.createdAt,operation:manifest.operation,phase:'prepared',
    ...(manifest.target?{target:{name:manifest.target.name,path:manifest.target.path,...(manifest.target.groupId!==undefined?{groupId:manifest.target.groupId}:{}),...(manifest.target.groupName!==undefined?{groupName:manifest.target.groupName}:{})}}:{}),
    items:manifest.items.map(item=>({source:{id:item.id,createdAt:item.createdAt,path:item.path,title:item.title,expectedArchived:item.expectedArchived},status:'not-started'}))};
   if(!isCollectionBatchJournal(journal))throw Error('批次必须包含 1 至 24 条有效且不重复的冻结记录');
   this.journal=journal;
   const saved=await this.store.read();
   if(saved.value!==null){if(!isCollectionBatchJournal(saved.value))throw Error('已有批次日志格式无法确认');this.restore(saved.value,saved.blocked);this.warning=[this.warning,'此路径已有批次日志，未覆盖或开始新操作'].filter(Boolean).join('；');}
   else if(saved.blocked)throw Error(saved.blocked);
   else if(!current()){this.journal.phase='cancelled';this.warning='批次已取消，未开始任何操作';}
   else{await this.store.write(copy(journal),current);this.journalConfirmed=true;this.readOnly=false;this.runnable=true;}
  }catch(error){
   if(!this.journal)throw error;
   this.readOnly=true;this.runnable=false;this.journalConfirmed=false;this.warning=`批次日志未确认：${diagnostic(error)}；未开始任何操作`;
   this.journal.phase='review-required';
  }finally{this.initializing=false;this.emit(progress);}
  return this.report!;
 }
 run(execute:CollectionBatchExecutor,current:()=>boolean,progress?:CollectionBatchProgress):Promise<CollectionBatchReport>{
  if(this.initializing)return Promise.reject(Error('批次日志仍在准备'));
  if(this.pending)return this.pending;
  if(!this.journal)return Promise.reject(Error('请先创建或读取批次日志'));
  if(!this.runnable||this.readOnly)return Promise.resolve(this.report!);
  this.runnable=false;
  this.pending=this.execute(execute,current,progress).finally(()=>{this.pending=undefined;});
  return this.pending;
 }
 private async persist(next:CollectionBatchJournal,progress?:CollectionBatchProgress):Promise<boolean>{
  // Once started, navigation may stop actions but must not discard their receipts.
  try{await this.store.write(copy(next),()=>true);this.journal=next;this.journalConfirmed=true;this.emit(progress);return true;}
  catch(error){this.journalConfirmed=false;this.readOnly=true;this.warning=`批次日志未确认：${diagnostic(error)}；已停止后续操作，重开后请核对原记录`;return false;}
 }
 private async execute(execute:CollectionBatchExecutor,current:()=>boolean,progress?:CollectionBatchProgress):Promise<CollectionBatchReport>{
  try{
   for(let index=0;index<this.journal!.items.length;index++){
    if(!current()){const cancelled={...copy(this.journal!),phase:'cancelled' as const};await this.persist(cancelled,progress);this.journal=cancelled;break;}
    const running=copy(this.journal!);running.phase='running';running.items[index].status='running';
    if(!await this.persist(running,progress)){this.journal!.phase='review-required';break;}
    // Cancellation during journal IO leaves this item unstarted; no external call.
    if(!current()){
     const cancelled=copy(this.journal!);cancelled.phase='cancelled';cancelled.items[index].status='not-started';
     await this.persist(cancelled,progress);this.journal=cancelled;break;
    }
    let result:CollectionBatchItem;
    try{
     const receipt=await execute(Object.freeze({...running.items[index].source}),index);
     if(!receipt||!['confirmed','already-present'].includes(receipt.status))throw Error('操作未返回可确认的回执');
     result={source:running.items[index].source,status:receipt.status,...(receipt.message?{message:diagnostic(receipt.message)}:{})};
    }catch(error){result={source:running.items[index].source,status:error instanceof CollectionBatchExecutionError?error.outcome:'unknown',message:diagnostic(error)};}
    const finished=copy(this.journal!);finished.items[index]=result;
    finished.phase=result.status==='unknown'?'review-required':result.status==='not-written'?'stopped':index===finished.items.length-1?'completed':'running';
    if(!await this.persist(finished,progress)){this.journal=finished;this.journal.phase='review-required';break;}
    if(!success(result.status))break;
   }
  }finally{this.readOnly=true;this.emit(progress);}
  return this.report!;
 }
}
