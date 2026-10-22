/** Vault adapter capabilities only. copy must reject an existing destination,
 * as Obsidian's DataAdapter does; rename is not a substitute for that promise. */
export interface CollectionJsonAdapter {
 exists(path:string):Promise<boolean>;
 list(path:string):Promise<{files:string[]}>;
 read(path:string):Promise<string>;
 write(path:string,source:string):Promise<void>;
 copy?:(from:string,to:string)=>Promise<void>;
 process?:(path:string,change:(source:string)=>string)=>Promise<string>;
 remove?:(path:string)=>Promise<void>;
 stat?:(path:string)=>Promise<{size:number}|null>;
}
export interface CollectionJsonRead<T> {value:T|null;blocked?:string;}
export class CollectionJsonStoreError extends Error {
 constructor(message:string,readonly outcome:'not-written'|'unknown',cause?:unknown){super(message,{cause});this.name='CollectionJsonStoreError';}
}
export const COLLECTION_JSON_MAX_BYTES=2*1024*1024;
const previousFormat='thoughtspace-collection-json-previous';
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

/** Fixed host-owned paths only, never paths derived from filter names or JSON. */
export function isCollectionJsonPath(path:string):boolean {
 return typeof path==='string'&&path.length<=4096&&!path.startsWith('/')&&!path.includes('\\')&&!path.includes(':')&&
  !Array.from(path).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)&&
  path.split('/').every(part=>!!part&&part!=='.'&&part!=='..')&&/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(path.slice(path.lastIndexOf('/')+1));
}
/** Discover an original document even when only its strict recovery materials
 * remain. This identifies a path, not a confirmed value or write authority. */
export function collectionJsonCanonical(path:string):string|undefined {
 const match=/^(.+?\.json)(?:\.previous-(\d{12,16})-[A-Za-z0-9_-]{1,160}\.json|\.pending-[A-Za-z0-9_-]{1,160}\.tmp)$/.exec(path);
 if(match)return isCollectionJsonPath(match[1])&&(match[2]===undefined||Number.isSafeInteger(Number(match[2])))?match[1]:undefined;
 return isCollectionJsonPath(path)?path:undefined;
}

/** A small validated JSON document with logical CAS and verified recovery
 * materials. It does not claim a physical power-loss durability guarantee.
 * All calls serialize; callers get copies and cannot mutate a confirmed value.
 * A corrupt/conflicting/uncertain canonical file remains untouched and locks
 * this store instance. A new instance may inspect it, never auto-replay writes. */
export class CollectionJsonStore<T> {
 private baseline:string|null|undefined;
 private confirmed:T|null=null;
 private blocked?:string;
 private queue:Promise<unknown>=Promise.resolve();
 private serial=0;private sequence=Date.now();
 private readonly directory:string;
 private readonly previous=new Map<string,string>();
 constructor(private readonly adapter:CollectionJsonAdapter,readonly path:string,private readonly newToken:()=>string,private readonly validate:(value:unknown)=>value is T){
  if(!isCollectionJsonPath(path))throw Error('收集数据文件路径无效');
  this.directory=path.slice(0,path.lastIndexOf('/'));
 }
 private enqueue<R>(run:()=>Promise<R>):Promise<R>{const next=this.queue.catch(()=>undefined).then(run);this.queue=next.catch(()=>undefined);return next;}
 private result():CollectionJsonRead<T>{return{value:copy(this.confirmed),...(this.blocked?{blocked:this.blocked}:{})};}
 private fail(reason:string,outcome:'not-written'|'unknown'='not-written',cause?:unknown):never {
  this.blocked=`${reason}；原文件和恢复材料已保留，请先核对`;
  throw new CollectionJsonStoreError(this.blocked,outcome,cause);
 }
 private within(source:string,limit=COLLECTION_JSON_MAX_BYTES){
  if(source.length>limit||new TextEncoder().encode(source).byteLength>limit)throw Error('收集数据文件超过大小限制');
  return source;
 }
 private async text(path:string,limit=COLLECTION_JSON_MAX_BYTES){
  if(this.adapter.stat){const stat=await this.adapter.stat(path);if(stat&&stat.size>limit)throw Error('收集数据文件超过大小限制');}
  return this.within(await this.adapter.read(path),limit);
 }
 private parse(source:string):T {
  const value:unknown=JSON.parse(this.within(source));if(!this.validate(value))throw Error('收集数据格式无法确认');return value;
 }
 private async contents():Promise<string|null>{return await this.adapter.exists(this.path)?this.text(this.path):null;}
 private material(path:string):{kind:'previous'|'pending';sequence:number}|undefined {
  if(!path.startsWith(this.path+'.'))return;
  const suffix=path.slice(this.path.length),previous=/^\.previous-(\d{12,16})-[A-Za-z0-9_-]{1,160}\.json$/.exec(suffix);
  if(previous){const sequence=Number(previous[1]);if(Number.isSafeInteger(sequence))return{kind:'previous',sequence};}
  if(/^\.pending-[A-Za-z0-9_-]{1,160}\.tmp$/.test(suffix))return{kind:'pending',sequence:0};
 }
 private async materials(){
  if(!this.directory||!await this.adapter.exists(this.directory))return[];
  return(await this.adapter.list(this.directory)).files.flatMap(path=>{const found=this.material(path);return found?[{path,...found}]:[];}).sort((a,b)=>b.sequence-a.sequence||b.path.localeCompare(a.path));
 }
 private async fallback(materials:Awaited<ReturnType<CollectionJsonStore<T>['materials']>>){
  for(const item of materials){
   if(item.kind!=='previous')continue;
   try{
    const value:unknown=JSON.parse(await this.text(item.path,COLLECTION_JSON_MAX_BYTES*2+16384));
    if(!object(value)||Object.keys(value).length!==5||value.format!==previousFormat||value.version!==1||value.path!==this.path||value.sequence!==item.sequence||typeof value.source!=='string')continue;
    this.confirmed=this.parse(value.source);return item.path;
   }catch{/* Unreadable or invalid materials stay on disk and never authorize writes. */}
  }
 }
 read():Promise<CollectionJsonRead<T>> {return this.enqueue(async()=>{
  if(this.blocked)return this.result();
  let source:string|null=null,error:unknown;
  try{source=await this.contents();if(source!==null)this.parse(source);}catch(caught){error=caught;}
  if(this.baseline!==undefined){
   if(error!==undefined||source!==this.baseline){this.blocked=`收集数据被其他操作更改或无法读取；最后确认的数据仅供查看，原文件已保留${error===undefined?'':`：${message(error)}`}`;}
   return this.result();
  }
  if(error===undefined&&source!==null){this.baseline=source;this.confirmed=this.parse(source);return this.result();}
  let materials:Awaited<ReturnType<CollectionJsonStore<T>['materials']>>=[];
  try{materials=await this.materials();}catch(caught){error=error??caught;}
  for(const item of materials)this.sequence=Math.max(this.sequence,item.sequence);
  if(error===undefined&&source===null&&!materials.length){this.baseline=null;return this.result();}
  const recovered=await this.fallback(materials);
  this.blocked=`收集数据缺失、损坏或写入尚未确认；${recovered?`已显示最后确认材料 ${recovered}`:'没有可确认的数据'}，请先核对，原文件与材料已保留${error===undefined?'':`：${message(error)}`}`;
  return this.result();
 });}
 private ensure(current:()=>boolean){if(!current())throw new CollectionJsonStoreError('页面或操作已变化，保存已取消','not-written');}
 private async unique(kind:'pending'|'previous'){
  // A restarted instance or a clock adjustment must not put its newer confirmed
  // backup behind an older instance's materials in recovery order.
  if(kind==='previous')for(const item of await this.materials())this.sequence=Math.max(this.sequence,item.sequence);
  for(let attempt=0;attempt<8;attempt++){
   const token=`${this.newToken()}-${++this.serial}`;if(!/^[A-Za-z0-9_-]{1,160}$/.test(token))throw Error('收集恢复材料标识无效');
   if(kind==='previous'&&!Number.isSafeInteger(this.sequence+1))throw Error('收集恢复材料序号无效，已有材料未改动');
   const suffix=kind==='pending'?`.pending-${token}.tmp`:`.previous-${String(++this.sequence).padStart(12,'0')}-${token}.json`,path=this.path+suffix;
   if(!await this.adapter.exists(path))return{path,sequence:this.sequence};
  }
  throw Error('收集恢复材料路径冲突，已有材料未改动');
 }
 private async verifiedWrite(path:string,source:string,current:()=>boolean){
  this.ensure(current);let error:unknown;try{await this.adapter.write(path,source);}catch(caught){error=caught;}
  if(await this.text(path,COLLECTION_JSON_MAX_BYTES*2+16384)!==source)throw Error('收集恢复材料写入未能确认',{cause:error});
 }
 private async removeOwned(path:string,source:string){
  if(!this.adapter.remove)return;
  try{if(await this.adapter.exists(path)&&await this.text(path,COLLECTION_JSON_MAX_BYTES*2+16384)===source)await this.adapter.remove(path);}catch{/* Cleanup cannot change a confirmed result. */}
 }
 private async confirm(source:string,temporary:string,latestPrevious?:string){
  this.baseline=source;this.confirmed=this.parse(source);
  await this.removeOwned(temporary,source);
  for(const[path,serialized]of this.previous)if(path!==latestPrevious){await this.removeOwned(path,serialized);this.previous.delete(path);}
 }
 write(value:T,current:()=>boolean):Promise<void> {
  // Freeze before enqueueing, so later caller mutation cannot change the command.
  let source:string;
  try{if(!this.validate(value))throw Error('收集数据格式无效');source=this.within(JSON.stringify(value));this.parse(source);}catch(error){return Promise.reject(new CollectionJsonStoreError(message(error),'not-written',error));}
  return this.enqueue(async()=>{
   if(this.blocked)throw new CollectionJsonStoreError(this.blocked,'not-written');
   if(this.baseline===undefined)throw new CollectionJsonStoreError('收集数据尚未读取，不能保存','not-written');
   this.ensure(current);
   let actual:string|null;try{actual=await this.contents();}catch(error){this.fail(`无法核对原收集数据：${message(error)}`,'not-written',error);}
   if(actual!==this.baseline)this.fail('收集数据同时发生变化，未覆盖');
   if(actual===source){this.ensure(current);return;}
   if(actual===null&&!this.adapter.copy)throw new CollectionJsonStoreError('当前存储不支持独占创建，未保存收集数据','not-written');
   if(actual!==null&&!this.adapter.process)throw new CollectionJsonStoreError('当前存储不支持原子更新，未覆盖收集数据','not-written');
   const temporary=await this.unique('pending');await this.verifiedWrite(temporary.path,source,current);
   let attempted=false;
   try{
   let latestPrevious:string|undefined;
   if(actual!==null){
    const previous=await this.unique('previous');latestPrevious=previous.path;
    const serialized=JSON.stringify({format:previousFormat,version:1,path:this.path,sequence:previous.sequence,source:actual});
    await this.verifiedWrite(previous.path,serialized,current);this.previous.set(previous.path,serialized);
   }
   this.ensure(current);
   let before:string|null;try{before=await this.contents();}catch(error){this.fail(`无法再次核对收集数据：${message(error)}`,'not-written',error);}
   if(before!==actual)this.fail('收集数据在准备保存期间变化，未覆盖');
   this.ensure(current);let failure:unknown;
   try{
    if(actual===null){attempted=true;await this.adapter.copy!(temporary.path,this.path);}
    else await this.adapter.process!(this.path,raw=>{this.ensure(current);if(raw!==actual)this.fail('收集数据在原子更新前变化，未覆盖');attempted=true;return source;});
   }catch(error){failure=error;}
   let observed:string|null;
   try{observed=await this.contents();}catch(error){this.fail(`收集数据写入结果无法核对：${message(error)}`,attempted?'unknown':'not-written',error);}
   if(attempted&&observed===source){await this.confirm(source,temporary.path,latestPrevious);return;}
   if(observed!==actual)this.fail('收集数据写入结果不一致',attempted?'unknown':'not-written',failure);
   throw new CollectionJsonStoreError(failure===undefined?'宿主未确认收集数据写入':message(failure),'not-written',failure);
   }catch(error){
    // An explicitly cancelled first creation has never touched its canonical.
    // Remove only this invocation's verified bytes; foreign, damaged or unknown
    // write materials must remain available to the read-only recovery path.
    if(actual===null&&!attempted&&!this.blocked&&!current())await this.removeOwned(temporary.path,source);
    throw error;
   }
  });
 }
}
