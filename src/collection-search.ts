import type {CollectionRecord} from './collection-view';
import {collectionLocalDay,parseCollectionDay} from './collection-calendar';
import {isCollectionTaskFilter,matchesCollectionTasks,type CollectionTaskFilter} from './collection-tasks';

export type CollectionSearchScope='all'|'unplaced'|'placed'|'archived';
export interface CollectionSearchOptions {query:string;includeBody?:boolean;scope?:CollectionSearchScope;pinnedOnly?:boolean;since?:string;until?:string;tasks?:CollectionTaskFilter;}
export interface CollectionSearchSnippet {text:string;ranges:{start:number;end:number}[];}
export interface CollectionSearchHit {record:CollectionRecord;snippet?:CollectionSearchSnippet;}
export interface CollectionSearchProgress {scanned:number;total:number;unread:number;}
export interface CollectionSearchResult extends CollectionSearchProgress {hits:CollectionSearchHit[];cancelled:boolean;}
export interface CollectionSearchReader {
 readBody(record:CollectionRecord):Promise<string>;
 current():boolean;
 onProgress?(progress:CollectionSearchProgress):void;
}
const fold=(text:string)=>text.normalize('NFC').toLowerCase();
const tagged=(record:CollectionRecord,tag:string)=>!!tag&&record.tags.some(value=>{const normalized=fold(value.replace(/^#/,''));return normalized===tag||normalized.startsWith(tag+'/');});
function validateDate(value:string|undefined):string|undefined {
 if(!value)return;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('日期请使用 YYYY-MM-DD 格式');
 if(!parseCollectionDay(value))throw Error('筛选日期无效');
 return value;
}
function compile(options:CollectionSearchOptions){
 const tasks=options.tasks===undefined?'all':options.tasks;
 if(!isCollectionTaskFilter(tasks))throw Error('任务筛选条件无效');
 const since=validateDate(options.since),until=validateDate(options.until);
 if(since&&until&&since>until)throw Error('开始日期不能晚于结束日期');
 const terms=[...new Set(fold(options.query.trim()).split(/\s+/u).filter(Boolean))];
 const required=terms.filter(term=>term.startsWith('#')).map(term=>term.slice(1));
 const excluded=terms.filter(term=>term.startsWith('-#')).map(term=>term.slice(2));
 const text=terms.filter(term=>!term.startsWith('#')&&!term.startsWith('-#'));
 return{since,until,required,excluded,text,tasks};
}
type Query=ReturnType<typeof compile>;
function eligible(record:CollectionRecord,options:CollectionSearchOptions,query:Query):boolean {
 const scope=options.scope||'all';
 if(scope==='archived'?record.archived!==true:record.archived===true)return false;
 if(scope==='placed'&&record.inBoard!==true||scope==='unplaced'&&record.inBoard!==false||options.pinnedOnly&&record.pinned!==true)return false;
 if(!matchesCollectionTasks(record.tasks,query.tasks))return false;
 if(query.since||query.until){const date=new Date(record.createdAt);if(!Number.isFinite(date.getTime()))return false;const day=collectionLocalDay(date);if(query.since&&day<query.since||query.until&&day>query.until)return false;}
 return query.required.every(tag=>tagged(record,tag))&&query.excluded.every(tag=>!!tag&&!tagged(record,tag));
}
function missingTerms(record:CollectionRecord,terms:readonly string[]):string[]{
 const title=fold(record.title),path=fold(record.path),tags=record.tags.map(fold);
 return terms.filter(term=>!title.includes(term)&&!path.includes(term)&&!tags.some(tag=>tag.includes(term)));
}
function compare(a:CollectionRecord,b:CollectionRecord){return Number(b.pinned===true)-Number(a.pinned===true)||Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id)||a.path.localeCompare(b.path);}
/** The synchronous metadata path is shared by the view and the async service.
 * includeBody cannot make an unread body match here; use searchCollectionRecords. */
export function filterCollectionSearchRecords(records:readonly CollectionRecord[],options:CollectionSearchOptions):CollectionRecord[]{
 const query=compile(options);
 return records.filter(record=>eligible(record,options,query)&&!missingTerms(record,query.text).length).sort(compare);
}
/** Snippets are plain text. Offsets address this returned string, never HTML or
 * the original Markdown. Normalizing display text leaves native note bytes alone. */
export function collectionSearchSnippet(body:string,terms:readonly string[]):CollectionSearchSnippet {
 const text=body.normalize('NFC').replace(/\s+/gu,' '),normalized=fold(text),matches=terms.map(term=>normalized.indexOf(term)).filter(index=>index>=0);
 // Lowercasing may expand a code point (for example İ). Map the first match
 // back only as far as needed; do not retain a whole-body character index.
 const first=matches.length?Math.min(...matches):0;let original=0,folded=0;
 for(const point of text){if(folded>=first)break;folded+=fold(point).length;original+=point.length;}
 let start=Math.max(0,original-80);if(start>0&&/[\uDC00-\uDFFF]/u.test(text[start]))start--;
 let end=Math.min(text.length,start+400);if(end<text.length&&/[\uD800-\uDBFF]/u.test(text[end-1]))end--;
 const snippet=text.slice(start,end),search=fold(snippet),starts:number[]=[],ends:number[]=[];let offset=0;
 // Match the whole folded string: Greek final sigma depends on its context.
 // The per-code-point lengths only map offsets back to displayed characters.
 for(const point of snippet){const value=fold(point);for(let i=0;i<value.length;i++){starts.push(offset);ends.push(offset+point.length);}offset+=point.length;}
 const ranges:{start:number;end:number}[]=[];
 for(const term of terms){if(!term)continue;let at=search.indexOf(term);while(at>=0){ranges.push({start:starts[at],end:ends[at+term.length-1]});at=search.indexOf(term,at+Math.max(1,term.length));}}
 ranges.sort((a,b)=>a.start-b.start||a.end-b.end);const merged:typeof ranges=[];
 for(const range of ranges){const previous=merged.at(-1);if(previous&&range.start<=previous.end)previous.end=Math.max(previous.end,range.end);else merged.push({...range});}
 // V8 substring slices can retain a multi-megabyte source backing store.
 // Copy only the bounded display snippet; never copy or cache the whole body.
 return{text:Array.from(snippet).join(''),ranges:merged};
}
/** At most two native reads are in flight. No body is retained after its bounded
 * snippet is produced. A cancelled result never exposes a stale partial list. */
export async function searchCollectionRecords(records:readonly CollectionRecord[],options:CollectionSearchOptions,reader:CollectionSearchReader):Promise<CollectionSearchResult>{
 if(!reader.current())return{hits:[],scanned:0,total:0,unread:0,cancelled:true};
 const query=compile(options),hits:CollectionSearchHit[]=[],queue:{record:CollectionRecord;missing:string[]}[]=[];
 for(const record of records){if(!eligible(record,options,query))continue;const missing=missingTerms(record,query.text);if(!missing.length)hits.push({record});else if(options.includeBody&&query.text.length)queue.push({record,missing});}
 let scanned=0,unread=0,cursor=0;const total=queue.length;
 const progress=()=>{if(reader.current())reader.onProgress?.({scanned,total,unread});};progress();
 await Promise.all(Array.from({length:Math.min(2,total)},async()=>{
  while(reader.current()&&cursor<total){const {record,missing}=queue[cursor++];
   try{const body=await reader.readBody(record);if(!reader.current())return;const value=fold(body);if(missing.every(term=>value.includes(term)))hits.push({record,snippet:collectionSearchSnippet(body,query.text)});}
   catch{if(!reader.current())return;unread++;}
   if(!reader.current())return;scanned++;progress();
  }
 }));
 const cancelled=!reader.current();return{hits:cancelled?[]:hits.sort((a,b)=>compare(a.record,b.record)),scanned,total,unread,cancelled};
}
