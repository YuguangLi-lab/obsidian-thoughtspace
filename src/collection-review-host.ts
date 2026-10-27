import {isRecord} from './value-guards';
import {type App,type TFile} from 'obsidian';
import {nativeSource,assertIdentity,sameNativeValue} from './collection-organize';
import {assertNativeNoteUnchanged,readCurrentNativeNote} from './native-note-state';
import {readCollectionReview,REVIEW_ON,REVIEW_VERSION} from './collection-review';
import {parseCollectionDay} from './collection-calendar';
import type {CollectionIdentity} from './collection-model';
/** Explicit one-record action. Never backfill, change global property types, or retry an uncertain write. */
export async function setCollectionReview(app:App,file:TFile,identity:CollectionIdentity,on:string|undefined,current:()=>boolean,expected?:string){
 if(on!==undefined&&!parseCollectionDay(on))throw Error('回顾日期无效');
 const path=file.path;
 const ensure=()=>{if(!current()||file.path!==path||app.vault.getAbstractFileByPath(path)!==file)throw Error('页面或原记录已变化，回顾安排已取消');};
 ensure();const baseline=await readCurrentNativeNote(app,file);ensure();
 const original=nativeSource(baseline);assertIdentity(original.properties,identity);
 const before=readCollectionReview(original.properties);if(before.issue)throw Error(before.issue);
 if(before.on!==expected)throw Error('回顾日期已被其他窗口修改，请刷新后重试');
 if(before.on===on)return;
 let prepared=false,properties:Record<string,unknown>|undefined,error:unknown;
 try{await app.fileManager.processFrontMatter(file,(value:unknown)=>{
  if(!isRecord(value))throw Error('原生属性格式无法确认');const fm=value;
  ensure();assertNativeNoteUnchanged(app,file,baseline);assertIdentity(fm,identity);
  if(prepared||!sameNativeValue(fm,original.properties))throw Error('原生属性已变化，未覆盖');
  prepared=true;if(on===undefined){delete fm[REVIEW_ON];delete fm[REVIEW_VERSION];}else{fm[REVIEW_VERSION]=1;fm[REVIEW_ON]=on;}
  properties=structuredClone(fm);
 });}catch(cause){error=cause;}
 if(!prepared||!properties)throw error instanceof Error?error:Error('宿主未确认回顾属性写入');
 if(file.path!==path||app.vault.getAbstractFileByPath(path)!==file)throw Error('回顾写入结果待核对：原记录已变化，未自动重试');
 const written=nativeSource(await app.vault.read(file));
 if(app.vault.getAbstractFileByPath(path)!==file||file.path!==path||!sameNativeValue(written.properties,properties)||written.body!==original.body)throw Error('回顾写入结果待核对，请打开原笔记检查；未自动重试');
 assertIdentity(written.properties,identity);
}
