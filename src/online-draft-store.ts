import {parseOnlineSource} from './online-platform';

export interface OnlineDraftSnapshot {
 id:string;source:string;note?:string;time:number;text:string;mode:'synced'|'manual';image?:Blob;
 phase:'editing'|'prepared'|'committed';
}
export interface StoredOnlineDraft extends OnlineDraftSnapshot {
 version:1;key:string;revision:number;lease:string;updatedAt:number;
}
export interface OnlineDraftStamp {revision:number;lease:string}
export interface OnlineDraftStorage {
 read():Promise<unknown[]>;
 replace(value:StoredOnlineDraft,expected?:OnlineDraftStamp):Promise<void>;
 remove(id:string,expected?:OnlineDraftStamp):Promise<void>;
 close?():void;
}
export interface OnlineDraftClock {setTimeout(callback:()=>void,delay:number):number;clearTimeout(id:number):void}
const key=(source:string,note?:string)=>JSON.stringify([source,note||'']);
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object';
const identifier=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
export function onlineDraftNotePath(value:unknown):value is string {
 return typeof value==='string'&&value.length<=8192&&value.endsWith('.md')&&value.trim()===value&&!value.includes('\\')&&!Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)&&!value.startsWith('/')&&!/^[a-z][a-z\d+.-]*:/i.test(value)&&!value.split('/').some(part=>!part||part==='.'||part==='..');
}
export function validOnlineDraft(value:unknown):value is StoredOnlineDraft {
 if(!isObject(value)||value.version!==1||!identifier(value.id)||!identifier(value.lease)||!Number.isSafeInteger(value.revision)||(value.revision as number)<1||!Number.isFinite(value.updatedAt)||typeof value.source!=='string'||parseOnlineSource(value.source)?.path!==value.source)return false;
 if(value.note!==undefined&&!onlineDraftNotePath(value.note)||value.key!==key(value.source,value.note))return false;
 if(typeof value.text!=='string'||value.text.length>100000||typeof value.time!=='number'||!Number.isFinite(value.time)||value.time<0||value.time>864000||typeof value.mode!=='string'||!['synced','manual'].includes(value.mode)||typeof value.phase!=='string'||!['editing','prepared','committed'].includes(value.phase))return false;
 if(value.phase==='committed'&&!value.note)return false;
 const image=value.image;
 return image===undefined||isObject(image)&&Object.prototype.toString.call(image)==='[object Blob]'&&image.type==='image/png'&&typeof image.size==='number'&&Number.isFinite(image.size)&&image.size>0&&image.size<=20*1024*1024;
}
const stamp=(value:StoredOnlineDraft|undefined):OnlineDraftStamp|undefined=>value?{revision:value.revision,lease:value.lease}:undefined;
const sameStamp=(value:unknown,expected:OnlineDraftStamp|undefined)=>expected?isObject(value)&&value.revision===expected.revision&&value.lease===expected.lease:value===undefined;

/** Browser storage only. A single transaction checks both the previous owner and the source/note slot. */
export class IndexedOnlineDraftStorage implements OnlineDraftStorage {
 private opening?:Promise<IDBDatabase>;
 constructor(private factory:IDBFactory|undefined,private name:string){}
 private database():Promise<IDBDatabase>{
  if(this.opening)return this.opening;
  const opening=new Promise<IDBDatabase>((resolve,reject)=>{
   if(!this.factory){reject(Error('此设备没有可用的本地草稿暂存'));return;}
   let abandoned=false;const request=this.factory.open(this.name,1);
   request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'id'}).createIndex('sourceNote','key',{unique:true});
   request.onerror=()=>{abandoned=true;reject(request.error||Error('无法打开在线草稿暂存'));};
   request.onblocked=()=>{abandoned=true;reject(Error('在线草稿暂存被另一窗口占用'));};
   request.onsuccess=()=>{const db=request.result;if(abandoned){db.close();return;}db.onversionchange=()=>{db.close();if(this.opening===opening)this.opening=undefined;};resolve(db);};
  });
  this.opening=opening;void opening.catch(()=>{if(this.opening===opening)this.opening=undefined;});return opening;
 }
 async read():Promise<unknown[]>{
  const db=await this.database();return new Promise((resolve,reject)=>{
   const tx=db.transaction('drafts','readonly'),request=tx.objectStore('drafts').getAll();
   tx.oncomplete=()=>resolve(request.result as unknown[]);tx.onabort=tx.onerror=()=>reject(tx.error||request.error||Error('在线草稿读取失败'));
  });
 }
 private async mutate(id:string,expected:OnlineDraftStamp|undefined,next?:StoredOnlineDraft){
  const db=await this.database();await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),request=store.get(id);let failure:Error|undefined;
   request.onsuccess=()=>{
    if(!sameStamp(request.result as unknown,expected)){failure=Error('在线草稿已由另一会话接管；原内容仍保留');tx.abort();return;}
    if(next)store.put(next);else store.delete(id);
   };
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(failure||tx.error||request.error||Error('在线草稿暂存失败'));
  });
 }
 replace(value:StoredOnlineDraft,expected?:OnlineDraftStamp){return this.mutate(value.id,expected,value);}
 remove(id:string,expected?:OnlineDraftStamp){return this.mutate(id,expected);}
 close(){void this.opening?.then(db=>db.close()).catch(()=>{});}
}

/** Public vault-local app storage supplies a namespace; paths and credentials never enter it. */
export function onlineDraftDatabaseName(app:{loadLocalStorage(key:string):unknown;saveLocalStorage(key:string,value:unknown):void},uuid:()=>string=()=>crypto.randomUUID()):string {
 const setting='thoughtspace-online-drafts-namespace-v1',old=app.loadLocalStorage(setting);
 if(old!==null&&old!==undefined&&!identifier(old))throw Error('在线草稿本机标识无效；已有暂存未修改');
 const id=old??uuid();if(!identifier(id))throw Error('无法建立在线草稿本机标识');
 if(old===null||old===undefined)app.saveLocalStorage(setting,id);
 if(app.loadLocalStorage(setting)!==id)throw Error('在线草稿本机标识未保存');
 return `thoughtspace-online-drafts-v1:${id}`;
}

/** Same-host views share memory. Revisions and a new load lease reject old-host late writes/removals. */
export class OnlineDraftStore {
 private persisted=new Map<string,StoredOnlineDraft>();
 private dirty=new Map<string,StoredOnlineDraft>();
 private removed=new Set<string>();
 private blocked=new Set<string>();
 private states=new Map<string,'pending'|'saved'|'error'>();
 private listeners=new Set<()=>void>();
 private queue:Promise<unknown>=Promise.resolve();
 private loading?:Promise<void>;
 private loaded=false;
 private writable=false;
 private closing=false;
 private disposed=false;
 private timer?:number;
 private lastError='';
 private unscopedFailure=false;
 private failedDrafts=new Set<string>();
 private readonly lease=crypto.randomUUID();
 private reportedFailures=new WeakSet<object>();
 private reportedPrimitive?:{value:unknown};
 constructor(private storage:OnlineDraftStorage,private failed:(error:unknown,draftIds?:readonly string[])=>void=()=>{},private clock:OnlineDraftClock=window){}
 recoverySnapshot(){
  const ids=new Set([...this.persisted.keys(),...this.dirty.keys()]);
  return [...ids].filter(id=>!this.removed.has(id)).flatMap(id=>{const checkpoint=this.persisted.get(id),latest=this.dirty.get(id)||checkpoint;if(!latest||latest.phase==='committed')return[];
   const saved=!!checkpoint&&!this.dirty.has(id)&&this.states.get(id)==='saved'&&!this.blocked.has(id);
   const item={id:JSON.stringify([id,'latest']),source:latest.source,note:latest.note,text:latest.text,time:latest.time,hasImage:!!latest.image,storage:saved?'checkpoint' as const:'memory' as const};
   return [item,...(!saved&&checkpoint&&checkpoint.phase!=='committed'?[{id:JSON.stringify([id,'checkpoint']),source:checkpoint.source,note:checkpoint.note,text:checkpoint.text,time:checkpoint.time,hasImage:!!checkpoint.image,storage:'checkpoint' as const}]:[])];
  });
 }
 get error(){return this.unscopedFailure||this.failedDrafts.size?this.lastError:'';}
 get isLoaded(){return this.loaded;}
 get active(){return !this.closing&&!this.disposed;}
 state(id:string){return this.states.get(id);}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 private notify(){for(const listener of this.listeners)listener();}
 private reported(error:unknown){return error!==null&&(typeof error==='object'||typeof error==='function')?this.reportedFailures.has(error):!!this.reportedPrimitive&&Object.is(this.reportedPrimitive.value,error);}
 private failure(error:unknown,draftIds?:readonly string[]){
  if(error!==null&&(typeof error==='object'||typeof error==='function'))this.reportedFailures.add(error);else this.reportedPrimitive={value:error};
  if(draftIds)for(const id of draftIds)this.failedDrafts.add(id);else this.unscopedFailure=true;
  this.lastError=error instanceof Error?error.message:'在线草稿暂存失败';this.failed(error,draftIds);this.notify();
 }
 load():Promise<void>{return this.loading??=this.loadRecords();}
 private async loadRecords(){
  try{
   const rows=await this.storage.read();if(this.closing||this.disposed)return;
   const valid=rows.filter(validOnlineDraft),counts=new Map<string,number>();for(const row of valid)counts.set(row.key,(counts.get(row.key)||0)+1);
   this.writable=true;
   for(const row of valid){
    if(this.closing||this.disposed)return;
    this.persisted.set(row.id,row);
    if(counts.get(row.key)!==1){this.blocked.add(row.id);this.states.set(row.id,'error');this.failure(Error('同一视频和笔记有多条暂存；原记录保留，未自动选择'));continue;}
    const claimed={...row,revision:row.revision+1,lease:this.lease};
    try{await this.storage.replace(claimed,stamp(row));if(this.closing||this.disposed)return;this.persisted.set(row.id,claimed);this.states.set(row.id,'saved');}
    catch(error){this.blocked.add(row.id);this.states.set(row.id,'error');this.failure(error);}
   }
   if(valid.length!==rows.length)this.failure(Error('部分在线草稿格式或版本无法读取；原始记录未删除'));else if(!this.blocked.size)this.unscopedFailure=false;
  }catch(error){this.writable=false;this.failure(error);}
  finally{this.loaded=true;this.notify();}
 }
 recover(source:string,note?:string,id?:string):StoredOnlineDraft|undefined {
  if(!this.loaded)throw Error('在线草稿仍在读取，请稍候');
  const matches=[...this.persisted.values()].filter(row=>row.source===source&&!this.removed.has(row.id)&&(id?row.id===id&&(note===undefined||row.note===note||row.note===undefined):row.note===note));
  if(matches.length>1)throw Error('同一来源有多条草稿，原记录保留，未自动选择');
  return matches[0]?{...matches[0]}:undefined;
 }
 stage(draft:OnlineDraftSnapshot){
  if(!this.active||!this.loaded||this.removed.has(draft.id))throw Error('在线草稿会话已结束或尚未就绪');
  const previous=this.persisted.get(draft.id),value:StoredOnlineDraft={...draft,version:1,key:key(draft.source,draft.note),revision:(previous?.revision||0)+1,lease:this.lease,updatedAt:Date.now()};
  if(!validOnlineDraft(value)||previous?.source&&previous.source!==value.source)throw Error('在线草稿过大或身份无效，当前内容仅保留在内存');
  if([...this.persisted.values(),...this.dirty.values()].some(row=>row.id!==value.id&&row.key===value.key&&!this.removed.has(row.id)))throw Error('目标笔记已有另一草稿，原记录未覆盖');
  this.dirty.set(value.id,value);this.states.set(value.id,'pending');this.notify();
  if(!this.writable||this.blocked.has(value.id)){this.states.set(value.id,'error');throw Error(this.lastError||'暂存不可用；当前内容仅保留在内存');}
  if(this.timer!==undefined)this.clock.clearTimeout(this.timer);
  this.timer=this.clock.setTimeout(()=>{this.timer=undefined;void this.flush().catch(error=>{if(!this.reported(error))this.failure(error);});},350);
 }
 private enqueue<T>(job:()=>Promise<T>){const next=this.queue.then(job);this.queue=next.catch(()=>{});return next;}
 async flush(onlyId?:string){
  if(!onlyId){if(this.timer!==undefined)this.clock.clearTimeout(this.timer);this.timer=undefined;}
  await this.enqueue(async()=>{
   if(this.disposed)throw Error('在线草稿会话已结束');
   if(!this.writable)await this.loadRecords();
   for(const [id,value]of [...this.dirty]){
    if(this.removed.has(id)||onlyId&&id!==onlyId)continue;
    if(!this.writable||this.blocked.has(id))throw Error(this.lastError||'在线草稿暂存不可用');
    const previous=this.persisted.get(id),next={...value,revision:(previous?.revision||0)+1};
    try{await this.storage.replace(next,stamp(previous));if(this.disposed)return;this.persisted.set(id,next);if(this.dirty.get(id)===value){this.dirty.delete(id);this.failedDrafts.delete(id);}this.states.set(id,this.dirty.has(id)?'pending':'saved');this.notify();}
    catch(error){const affected:string[]=[];for(const dirtyId of this.dirty.keys())if(!this.removed.has(dirtyId)&&(!onlyId||dirtyId===id)){this.states.set(dirtyId,'error');affected.push(dirtyId);}this.failure(error,affected);throw error;}
   }
  });
 }
 async discard(id:string){
  if(!this.active||!this.loaded)throw Error('在线草稿会话已结束或尚未就绪');
  await this.enqueue(async()=>{
   if(!this.active)throw Error('在线草稿会话已结束');
   if(!this.writable||this.blocked.has(id))throw Error(this.lastError||'无法确认本地暂存已移除；当前草稿仍保留');
   await this.storage.remove(id,stamp(this.persisted.get(id)));if(!this.active)throw Error('在线草稿会话已更换；未清理当前视图');
   this.removed.add(id);this.persisted.delete(id);this.dirty.delete(id);this.states.delete(id);this.failedDrafts.delete(id);this.notify();
  });
 }
 async dispose(){
  if(this.closing||this.disposed)return;this.closing=true;
  try{await this.flush();}finally{this.disposed=true;this.listeners.clear();this.storage.close?.();}
 }
}
