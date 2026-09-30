import type {MediaIdentity} from './media-playback';
import {isVaultMediaPath,validMediaTime} from './media-source';
import {isRecord,isFiniteNumber} from './value-guards';

export interface MediaDraft {id:string;time:number;text:string;image?:Blob;locked?:boolean;source:MediaIdentity}
export interface StoredMediaDraft extends MediaDraft {version:1;updatedAt:number}
export interface MediaDraftStorage {
 read():Promise<unknown[]>;
 put(draft:StoredMediaDraft):Promise<void>;
 remove(id:string):Promise<void>;
 close?():void;
}
export interface MediaDraftClock {setTimeout(callback:()=>void,delay:number):number;clearTimeout(id:number):void}
export function validStoredMediaDraft(value:unknown):value is StoredMediaDraft {
 if(!isRecord(value)||value.version!==1||typeof value.id!=='string'||!value.id||!validMediaTime(value.time)||typeof value.text!=='string'||value.text.length>20000||!isFiniteNumber(value.updatedAt))return false;
 const source=value.source;
 // A capture can be a Blob from an Obsidian popout's realm.
 const image=value.image,png=isRecord(image)&&Object.prototype.toString.call(image)==='[object Blob]'&&image.type==='image/png'&&isFiniteNumber(image.size)&&image.size<=32*1024*1024;
 return isRecord(source)&&isVaultMediaPath(source.path)&&isFiniteNumber(source.mtime)&&source.mtime>=0&&isFiniteNumber(source.size)&&source.size>=0&&(value.locked===undefined||typeof value.locked==='boolean')&&(image===undefined||png);
}
const snapshot=(draft:MediaDraft):StoredMediaDraft=>({version:1,id:draft.id,time:draft.time,text:draft.text,source:{...draft.source},...(draft.image?{image:draft.image}:{}),...(draft.locked?{locked:true}:{}),updatedAt:Date.now()});

/** Local-only storage: no vault files, sync settings, base64 images or note writes. */
export class IndexedMediaDraftStorage implements MediaDraftStorage {
 private opening?:Promise<IDBDatabase>;
 constructor(private factory:IDBFactory,private name:string){}
 private database(){
  return this.opening??=new Promise<IDBDatabase>((resolve,reject)=>{
   const request=this.factory.open(this.name,1);
   request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'id'});};
   request.onerror=()=>reject(request.error||Error('无法打开本地草稿暂存'));
   request.onblocked=()=>reject(Error('本地草稿暂存被另一窗口占用'));
   request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  });
 }
 private async transaction(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest):Promise<unknown>{
  const db=await this.database();
  return new Promise((resolve,reject)=>{
   const transaction=db.transaction('drafts',mode),request=action(transaction.objectStore('drafts'));
   transaction.oncomplete=()=>resolve(request.result as unknown);
   transaction.onabort=transaction.onerror=()=>reject(transaction.error||request.error||Error('本地草稿暂存失败'));
  });
 }
 async read(){const result=await this.transaction('readonly',store=>store.getAll());if(!Array.isArray(result))throw Error('本地草稿格式无效');return result as unknown[];}
 async put(draft:StoredMediaDraft){await this.transaction('readwrite',store=>store.put(draft));}
 async remove(id:string){await this.transaction('readwrite',store=>store.delete(id));}
 close(){void this.opening?.then(db=>db.close()).catch(()=>{});}
}

/** Coalesce typing, serialize writes/deletions, and retain failed writes for retry. */
export class MediaDraftStore {
 private recovered=new Map<string,StoredMediaDraft>();
 private active=new Map<string,MediaDraft>();
 private dirty=new Map<string,StoredMediaDraft>();
 private removed=new Set<string>();
 private queue:Promise<unknown>=Promise.resolve();
 private timer?:number;
 private disposed=false;
 private listeners=new Set<()=>void>();
 private states=new Map<string,'pending'|'saved'|'error'>();
 constructor(private storage:MediaDraftStorage,private failed:(error:unknown)=>void=()=>{},private clock:MediaDraftClock=window){}
 async load(){
  const values=await this.storage.read();let invalid=0;
  for(const value of values){if(validStoredMediaDraft(value)){this.recovered.set(value.id,value);this.states.set(value.id,'saved');}else invalid++;}
  if(invalid)this.failed(Error(`${invalid} 条暂存记录无法读取，原始数据未删除`));
 }
 pending(){return [...this.recovered.values()].filter(draft=>!this.active.has(draft.id));}
 state(id:string){return this.states.get(id);}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 private notify(){for(const listener of this.listeners)listener();}
 pendingFor(path:string){return this.pending().some(draft=>draft.source.path===path);}
 activeFor(path:string){return [...this.active.values()].find(draft=>draft.source.path===path);}
 activate(id:string){
  const draft=this.recovered.get(id);if(!draft||this.removed.has(id))throw Error('草稿已处理，请刷新');
  const current=this.activeFor(draft.source.path);if(current&&current.id!==id)throw Error('请先处理此媒体的当前草稿');
  if(!this.active.has(id))this.active.set(id,{...draft,source:{...draft.source}});
  this.notify();
  return this.active.get(id)!;
 }
 stage(draft:MediaDraft){
  if(this.disposed||this.removed.has(draft.id))throw Error('草稿暂存已结束');
  const value=snapshot(draft);if(!validStoredMediaDraft(value))throw Error('草稿过大或格式无效，未暂存');
  this.active.set(draft.id,draft);this.dirty.set(draft.id,value);
  this.states.set(draft.id,'pending');this.notify();
  if(this.timer!==undefined)this.clock.clearTimeout(this.timer);
  this.timer=this.clock.setTimeout(()=>{this.timer=undefined;void this.flush().catch(this.failed);},350);
 }
 private enqueue<T>(job:()=>Promise<T>):Promise<T>{const next=this.queue.then(job);this.queue=next.catch(()=>{});return next;}
 async flush(){
  if(this.timer!==undefined)this.clock.clearTimeout(this.timer);this.timer=undefined;
  await this.enqueue(async()=>{
   const batch=[...this.dirty.values()];this.dirty.clear();
   for(const [index,draft] of batch.entries()){
    if(this.removed.has(draft.id))continue;
    try{await this.storage.put(draft);if(!this.removed.has(draft.id))this.states.set(draft.id,this.dirty.has(draft.id)?'pending':'saved');this.notify();}
    catch(error){for(const remaining of batch.slice(index))if(!this.removed.has(remaining.id)){if(!this.dirty.has(remaining.id))this.dirty.set(remaining.id,remaining);this.states.set(remaining.id,'error');}this.notify();throw error;}
   }
  });
 }
 async discard(id:string){
  this.removed.add(id);const pending=this.dirty.get(id);this.dirty.delete(id);
  try{await this.enqueue(()=>this.storage.remove(id));this.recovered.delete(id);this.active.delete(id);this.states.delete(id);this.notify();}
  catch(error){this.removed.delete(id);if(pending)this.dirty.set(id,pending);throw error;}
 }
 async dispose(){await this.flush();this.disposed=true;this.storage.close?.();}
}
