import type {CollectionJsonStore,CollectionJsonRead} from './collection-json-store';
import type {CollectionSearchOptions} from './collection-search';
import {isCollectionTaskFilter} from './collection-tasks';

export const COLLECTION_SAVED_FILTER_LIMIT=20;
export const COLLECTION_SAVED_FILTER_NAME_LIMIT=80;
export const COLLECTION_SAVED_FILTER_QUERY_LIMIT=4096;
export interface SavedCollectionFilter {id:string;name:string;options:CollectionSearchOptions;}
export interface CollectionSavedFiltersDocument {version:1;filters:SavedCollectionFilter[];}
export interface CollectionSavedFiltersList {filters:readonly SavedCollectionFilter[];warning?:string;}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));
const nameKey=(name:string)=>name.trim().normalize('NFC');
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/.test(id);
const validDate=(value:unknown)=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00');return Number.isFinite(date.getTime())&&date.getFullYear()===Number(value.slice(0,4))&&date.getMonth()+1===Number(value.slice(5,7))&&date.getDate()===Number(value.slice(8,10));
};
export function isCollectionSavedFilterOptions(value:unknown):value is CollectionSearchOptions {
 if(!object(value)||!keys(value,['query','includeBody','scope','pinnedOnly','since','until','tasks'])||typeof value.query!=='string'||value.query.length>COLLECTION_SAVED_FILTER_QUERY_LIMIT)return false;
 for(const key of ['includeBody','pinnedOnly'])if(Object.hasOwn(value,key)&&typeof value[key]!=='boolean')return false;
 if(Object.hasOwn(value,'scope')&&(typeof value.scope!=='string'||!['all','unplaced','placed','archived'].includes(value.scope)))return false;
 if(Object.hasOwn(value,'tasks')&&!isCollectionTaskFilter(value.tasks))return false;
 for(const key of ['since','until'])if(Object.hasOwn(value,key)&&!validDate(value[key]))return false;
 return!(typeof value.since==='string'&&typeof value.until==='string'&&value.since>value.until);
}
/** Persisted JSON is untrusted. No body, result, target or execution lease is
 * accepted, including unknown future fields which this version cannot preserve. */
export function isCollectionSavedFiltersDocument(value:unknown):value is CollectionSavedFiltersDocument {
 if(!object(value)||Object.keys(value).length!==2||value.version!==1||!Array.isArray(value.filters)||value.filters.length>COLLECTION_SAVED_FILTER_LIMIT)return false;
 const ids=new Set<string>(),names=new Set<string>();
 for(const item of value.filters){
  if(!object(item)||Object.keys(item).length!==3||!keys(item,['id','name','options'])||!validId(item.id)||typeof item.name!=='string'||!item.name||item.name.length>COLLECTION_SAVED_FILTER_NAME_LIMIT||nameKey(item.name)!==item.name||!isCollectionSavedFilterOptions(item.options)||ids.has(item.id)||names.has(item.name))return false;
  ids.add(item.id);names.add(item.name);
 }
 return true;
}
/** Metadata-only commands; this module has no search, note or body reader. */
export class CollectionSavedFilters {
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private readonly store:Pick<CollectionJsonStore<CollectionSavedFiltersDocument>,'read'|'write'>,private readonly newId:()=>string){}
 private enqueue<R>(run:()=>Promise<R>):Promise<R>{const next=this.queue.catch(()=>undefined).then(run);this.queue=next.catch(()=>undefined);return next;}
 private document(result:CollectionJsonRead<CollectionSavedFiltersDocument>){if(result.blocked)throw Error(result.blocked);return result.value||{version:1 as const,filters:[]};}
 list():Promise<CollectionSavedFiltersList>{return this.enqueue(async()=>{const result=await this.store.read();return{filters:result.value?.filters||[],...(result.blocked?{warning:result.blocked}:{})};});}
 save(name:string,options:CollectionSearchOptions,current:()=>boolean,id?:string):Promise<SavedCollectionFilter>{
  // Do not trim or rewrite query grammar. Optional undefined fields are common
  // in the live UI, but they never enter the strictly validated JSON document.
  const savedName=typeof name==='string'?nameKey(name):'';
  if(!savedName||savedName.length>COLLECTION_SAVED_FILTER_NAME_LIMIT)return Promise.reject(Error('筛选名称需为 1 至 80 个字符'));
  if(!object(options)||!keys(options,['query','includeBody','scope','pinnedOnly','since','until','tasks']))return Promise.reject(Error('筛选条件无效'));
  const frozen=Object.fromEntries(Object.entries(options).filter(([,value])=>value!==undefined));
  if(!isCollectionSavedFilterOptions(frozen))return Promise.reject(Error('筛选条件、范围或日期无效'));
  // The default adds no constraint; retain the existing beta.3 JSON shape.
  if(frozen.tasks==='all')delete frozen.tasks;
  if(id!==undefined&&!validId(id))return Promise.reject(Error('保存筛选标识无效'));
  return this.enqueue(async()=>{
   if(!current())throw Error('页面或操作已变化，保存筛选已取消');
   const document=this.document(await this.store.read()),at=id===undefined?-1:document.filters.findIndex(item=>item.id===id);
   if(id!==undefined&&at<0)throw Error('原保存筛选已移除，请刷新后重试');
   if(document.filters.some(item=>item.name===savedName&&item.id!==id))throw Error('已有同名筛选，请换一个名称或明确更新原筛选');
   if(at<0&&document.filters.length>=COLLECTION_SAVED_FILTER_LIMIT)throw Error('最多保存 20 个筛选，请先删除不再需要的筛选');
   const selectedId=id??this.newId();if(!validId(selectedId)||at<0&&document.filters.some(item=>item.id===selectedId))throw Error('保存筛选标识冲突，原列表未改动');
   const filter:SavedCollectionFilter={id:selectedId,name:savedName,options:{...frozen}},filters=document.filters.map(item=>({...item,options:{...item.options}}));
   if(at<0)filters.push(filter);else filters[at]=filter;
   await this.store.write({version:1,filters},current);return{...filter,options:{...filter.options}};
  });
 }
 remove(id:string,current:()=>boolean):Promise<void>{return this.enqueue(async()=>{
  if(!validId(id))throw Error('保存筛选标识无效');if(!current())throw Error('页面或操作已变化，删除已取消');
  const document=this.document(await this.store.read());if(!document.filters.some(item=>item.id===id))throw Error('原保存筛选已移除，请刷新后重试');
  await this.store.write({version:1,filters:document.filters.filter(item=>item.id!==id)},current);
 });}
}
