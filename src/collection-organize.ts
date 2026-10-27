import {parseYaml,type App,type TFile} from 'obsidian';
import {readCollectionIdentity,type CollectionIdentity} from './collection-model';
import {assertNativeNoteUnchanged,readCurrentNativeNote} from './native-note-state';
import {isRecord} from './value-guards';

export type CollectionFlagField='thoughtspace_pinned'|'thoughtspace_archived';
export interface CollectionFlags {pinned:boolean;archived:boolean;}
export interface CollectionFlagReceipt extends CollectionIdentity {
 confirmed:true;path:string;field:CollectionFlagField;value:boolean;previous:boolean;
 changed:boolean;recoveredAfterError:boolean;
}
/** The outcome concerns this flag operation, not native saves drained beforehand. */
export class CollectionFlagWriteError extends Error {
 constructor(message:string,readonly outcome:'not-written'|'unknown',cause?:unknown){super(message,{cause});this.name='CollectionFlagWriteError';}
}

/** Missing properties mean false. Invalid native values require explicit repair. */
export function readCollectionFlags(frontmatter:unknown):CollectionFlags {
 if(!isRecord(frontmatter))throw Error('记录属性格式无效，请在原生笔记中核对');
 const read=(field:CollectionFlagField)=>{
  if(!Object.hasOwn(frontmatter,field))return false;
  const value=frontmatter[field];if(typeof value!=='boolean')throw Error(`收集属性 ${field} 必须为布尔值，请先在原生笔记中核对`);
  return value;
 };
 return{pinned:read('thoughtspace_pinned'),archived:read('thoughtspace_archived')};
}
function flagValue(flags:CollectionFlags,field:CollectionFlagField){return field==='thoughtspace_pinned'?flags.pinned:flags.archived;}
export function nativeSource(source:string){
 const header=/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source);
 if(!header)throw Error('原记录的收集属性已移除，请刷新后核对');
 const properties:unknown=parseYaml(header[1]);if(!isRecord(properties))throw Error('记录属性格式无效，请在原生笔记中核对');
 return{properties,body:source.slice(header[0].length)};
}
export function assertIdentity(properties:unknown,expected:CollectionIdentity){
 const actual=readCollectionIdentity(properties);
 if(!actual||actual.id!==expected.id||actual.createdAt!==expected.createdAt)throw Error('收集记录身份已变化，请刷新后核对');
}
/** Compare native YAML values without serializing or rebuilding the document.
 * Alias topology is not a semantic difference; cycles remain bounded. */
export function sameNativeValue(a:unknown,b:unknown,seen=new WeakMap<object,WeakSet<object>>()):boolean {
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(a instanceof Date||b instanceof Date)return a instanceof Date&&b instanceof Date&&Object.is(a.getTime(),b.getTime());
 if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b)){
  if(!ArrayBuffer.isView(a)||!ArrayBuffer.isView(b)||a.byteLength!==b.byteLength)return false;
  const left=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),right=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);
  return left.every((value,index)=>value===right[index]);
 }
 if(Array.isArray(a)!==Array.isArray(b))return false;
 if(seen.get(a)?.has(b))return true;
 const pairs=seen.get(a)||new WeakSet<object>();pairs.add(b);seen.set(a,pairs);
 const left=Object.keys(a),right=Object.keys(b);
 return left.length===right.length&&left.every(key=>Object.hasOwn(b,key)&&sameNativeValue(Reflect.get(a,key),Reflect.get(b,key),seen));
}

/** Change one explicitly requested native property. The caller resolves duplicate
 * identities and owns the per-record UI lock; this operation freezes its TFile and
 * path, checks native drafts and CAS at the host write callback, and never retries.
 * A confirmed receipt may outlive navigation; callers must gate their UI on current. */
export async function setCollectionFlag(app:App,file:TFile,identity:CollectionIdentity,field:CollectionFlagField,value:boolean,current:()=>boolean,expectedFlag?:boolean):Promise<CollectionFlagReceipt> {
 const path=file.path,expectedIdentity={id:identity.id,createdAt:identity.createdAt};
 let prepared=false;
 const sameFile=()=>{if(file.path!==path||app.vault.getAbstractFileByPath(path)!==file)throw Error('原记录已移动、删除或被替换，请刷新后核对');};
 const ensure=()=>{if(!current())throw Error('收集页面已变化，操作已取消');sameFile();};
 try{
  if((field!=='thoughtspace_pinned'&&field!=='thoughtspace_archived')||typeof value!=='boolean'||expectedFlag!==undefined&&typeof expectedFlag!=='boolean')throw Error('收集状态操作参数无效');
  ensure();if(file.extension.toLowerCase()!=='md')throw Error('只能整理原生 Markdown 收集记录');
  const baseline=await readCurrentNativeNote(app,file);ensure();
  const source=nativeSource(baseline);assertIdentity(source.properties,expectedIdentity);
  const previous=flagValue(readCollectionFlags(source.properties),field),expected=expectedFlag??previous;
  if(previous!==expected)throw Error('收集状态已被其他窗口修改，请刷新后重试');
  const receipt=(changed:boolean,recoveredAfterError:boolean):CollectionFlagReceipt=>({confirmed:true,...expectedIdentity,path,field,value,previous,changed,recoveredAfterError});
  if(previous===value){ensure();assertNativeNoteUnchanged(app,file,baseline);return receipt(false,false);}
  let properties:Record<string,unknown>|undefined,operationError:unknown,failed=false;
  try{
   await app.fileManager.processFrontMatter(file,(frontmatter:unknown)=>{
    ensure();assertNativeNoteUnchanged(app,file,baseline);
    if(prepared)throw Error('宿主重复执行属性写入，结果需要核对');
    assertIdentity(frontmatter,expectedIdentity);
    const flags=readCollectionFlags(frontmatter);
    if(flagValue(flags,field)!==expected)throw Error('收集状态已被其他窗口修改，请刷新后重试');
    if(!isRecord(frontmatter))throw Error('记录属性格式无效');
    properties=structuredClone(frontmatter);properties[field]=value;
    frontmatter[field]=value;prepared=true;
   });
  }catch(error){failed=true;operationError=error;}
  if(!prepared||!properties)throw operationError instanceof Error?operationError:Error(failed?`宿主拒绝属性写入：${String(operationError)}`:'宿主未确认属性写入，原记录未改动',{cause:operationError});
  // Even after cancellation or a rejected API result, inspect only this exact
  // file. Never follow a rename or mutate a replacement to manufacture success.
  sameFile();const observed=await app.vault.read(file);sameFile();
  const written=nativeSource(observed);assertIdentity(written.properties,expectedIdentity);
  if(flagValue(readCollectionFlags(written.properties),field)!==value||written.body!==source.body||!sameNativeValue(written.properties,properties))throw Error('收集属性或原生内容与预期不一致');
  return receipt(true,failed);
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  throw new CollectionFlagWriteError(prepared?`收集状态写入结果待核对；未自动重试：${message}`:message,prepared?'unknown':'not-written',error);
 }
}
