import {isCollectionJournalSource,type CollectionJournalRead} from './collection-recovery';

/** Native adapter capabilities only; no desktop filesystem or Node dependency. */
export interface CollectionJournalAdapter {
 exists(path:string):Promise<boolean>;
 list(path:string):Promise<{files:string[]}>;
 read(path:string):Promise<string>;
 write(path:string,source:string):Promise<void>;
 rename(from:string,to:string):Promise<void>;
 process?:(path:string,change:(source:string)=>string)=>Promise<string>;
 remove?:(path:string)=>Promise<void>;
}
interface Previous {path:string;serialized:string;source:string;sequence:number;}
const previousFormat='thoughtspace-collection-previous';
const errorMessage=(error:unknown)=>error instanceof Error?error.message:String(error);

/** Map only our strict journal/material names back to their original session.
 * A previous or temporary file never becomes an independent composer session. */
export function collectionJournalCanonical(path:string):string|undefined {
 if(path.startsWith('/')||path.includes('\\')||path.split('/').some(part=>part==='.'||part==='..'))return;
 return /^(.+\/session-[A-Za-z0-9_-]{8,120}\.json)(?:\.previous-\d{12,16}-[A-Za-z0-9_-]{1,160}\.json|\.pending-[A-Za-z0-9_-]{1,160}\.tmp)?$/.exec(path)?.[1];
}

/** Keep the last confirmed journal independently of the write being attempted.
 * The adapter's process API supplies logical CAS, not a claimed physical power
 * loss guarantee. Verified previous snapshots remain available if an adapter
 * still leaves a partial canonical file. Fallback recovery is always locked. */
export class CollectionJournalStore {
 private baseline:string|null|undefined;
 private uncertain?:string;
 private sequence=0;
 private serial=0;
 private readonly ownPrevious=new Map<string,string>();
 private readonly directory:string;
 constructor(private readonly adapter:CollectionJournalAdapter,readonly path:string,private readonly newToken:()=>string){
  if(collectionJournalCanonical(path)!==path)throw Error('收集恢复文件路径无效');
  this.directory=path.slice(0,path.lastIndexOf('/'));
 }
 private async contents():Promise<string|null>{return await this.adapter.exists(this.path)?this.adapter.read(this.path):null;}
 private parsePrevious(path:string,serialized:string):Previous|undefined {
  const suffix=path.slice(this.path.length),match=/^\.previous-(\d{12,16})-[A-Za-z0-9_-]{1,160}\.json$/.exec(suffix);
  if(!match||serialized.length>5000000)return;
  let value:unknown;try{value=JSON.parse(serialized);}catch{return;}
  if(!value||typeof value!=='object'||!('format'in value)||value.format!==previousFormat||!('version'in value)||value.version!==1||!('journal'in value)||value.journal!==this.path||!('sequence'in value)||value.sequence!==Number(match[1])||!Number.isSafeInteger(value.sequence)||!('source'in value)||typeof value.source!=='string'||!isCollectionJournalSource(value.source))return;
  return{path,serialized,source:value.source,sequence:value.sequence};
 }
 private async materials(){
  if(!await this.adapter.exists(this.directory))return{previous:[] as Previous[],temporary:[] as string[]};
  const paths=(await this.adapter.list(this.directory)).files,previous:Previous[]=[],temporary:string[]=[];
  for(const path of paths){
   if(collectionJournalCanonical(path)!==this.path||path===this.path)continue;
   if(path.endsWith('.tmp')){temporary.push(path);continue;}
   try{const parsed=this.parsePrevious(path,await this.adapter.read(path));if(parsed)previous.push(parsed);}catch{/* Preserve unreadable materials; they cannot authorize a write. */}
  }
  previous.sort((a,b)=>b.sequence-a.sequence||b.path.localeCompare(a.path));return{previous,temporary};
 }
 async read():Promise<CollectionJournalRead>{
  let canonical:string|null=null,readError:unknown;
  try{canonical=await this.contents();}catch(error){readError=error;}
  const materials=await this.materials();this.sequence=materials.previous[0]?.sequence||0;
  if(readError===undefined&&canonical!==null&&isCollectionJournalSource(canonical)){this.baseline=canonical;return canonical;}
  const previous=materials.previous[0];
  if(previous){
   return{serialized:previous.source,blockedReason:`收集恢复文件缺失、损坏或暂时无法读取；已显示上一份已确认草稿，请先核对保存结果。旧检查点不会用于再次创建笔记。保留材料：${previous.path}`};
  }
  if(readError!==undefined)throw readError instanceof Error?readError:new Error(errorMessage(readError));
  if(canonical!==null)return canonical; // Let the coordinator preserve/report invalid JSON.
  if(materials.temporary.length)throw Error(`正式收集恢复文件尚未确认；临时材料已保留，请先核对：${materials.temporary[0]}`);
  this.baseline=null;return null;
 }
 private token(){const value=`${this.newToken()}-${++this.serial}`;if(!/^[A-Za-z0-9_-]{1,160}$/.test(value))throw Error('收集临时文件标识无效');return value;}
 private async unique(kind:'pending'|'previous'){
  for(let count=0;count<8;count++){
   const suffix=kind==='pending'?`.pending-${this.token()}.tmp`:`.previous-${String(++this.sequence).padStart(12,'0')}-${this.token()}.json`,path=this.path+suffix;
   if(!await this.adapter.exists(path))return path;
  }
  throw Error('收集恢复材料路径冲突；已有文件保持不变');
 }
 private async writeVerified(path:string,source:string){
  await this.adapter.write(path,source);
  if(await this.adapter.read(path)!==source)throw Error(`收集临时写入未能确认；原文件与材料已保留：${path}`);
 }
 private async removeOwned(path:string,source:string){
  if(!this.adapter.remove)return;
  try{if(await this.adapter.exists(path)&&await this.adapter.read(path)===source)await this.adapter.remove(path);}catch{/* A successful journal commit does not depend on cleanup; preserve its material. */}
 }
 private async confirm(source:string,temporary:string,latestPrevious?:string){
  this.baseline=source;this.uncertain=undefined;
  await this.removeOwned(temporary,source);
  // Only retire snapshots created and verified by this exact store instance.
  // A concurrent/restarted store's snapshots and damaged materials are kept.
  for(const[path,serialized]of this.ownPrevious)if(path!==latestPrevious){await this.removeOwned(path,serialized);this.ownPrevious.delete(path);}
 }
 async write(source:string):Promise<void>{
  if(this.baseline===undefined)throw Error('收集恢复文件尚未确认，不能覆盖；请保留输入并核对');
  if(!isCollectionJournalSource(source))throw Error('收集恢复内容无效，原文件保持不变');
  const actual=await this.contents();
  if(this.uncertain!==undefined&&actual===this.uncertain){this.baseline=actual;this.uncertain=undefined;}
  if(actual!==this.baseline)throw Error('收集恢复文件被其他操作更改；未覆盖，请保留输入并核对');
  if(actual===source)return;
  const temporary=await this.unique('pending');await this.writeVerified(temporary,source);
  let latestPrevious:string|undefined;
  if(actual!==null){
   if(!isCollectionJournalSource(actual))throw Error('原收集恢复文件无效，未覆盖');
   latestPrevious=await this.unique('previous');
   const previous=JSON.stringify({format:previousFormat,version:1,journal:this.path,sequence:this.sequence,source:actual});
   await this.writeVerified(latestPrevious,previous);this.ownPrevious.set(latestPrevious,previous);
  }
  // Recheck after asynchronous material writes. The process callback checks the
  // baseline again at the adapter's read/modify boundary.
  if(await this.contents()!==actual)throw Error('收集恢复文件同时发生变化；原内容与临时材料已保留');
  this.uncertain=source;
  try{
   if(actual!==null&&this.adapter.process){
    await this.adapter.process(this.path,raw=>{if(raw!==actual)throw Error('收集恢复文件同时发生变化，未覆盖');return source;});
   }else{
    // First creation needs no overwrite. Older adapters without process may
    // support replacement rename; a refusal preserves canonical + materials.
    await this.adapter.rename(temporary,this.path);
   }
  }catch(error){
   try{if(await this.contents()===source){await this.confirm(source,temporary,latestPrevious);return;}}catch{/* Unknown outcome stays pending and cannot authorize note creation. */}
   throw Error(`${errorMessage(error)}；收集恢复写入未确认，旧草稿与临时材料已保留`);
  }
  if(await this.contents()!==source)throw Error('收集恢复写入结果不一致；旧草稿与临时材料已保留，请核对');
  await this.confirm(source,temporary,latestPrevious);
 }
}
