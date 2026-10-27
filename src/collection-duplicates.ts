import type {CollectionRecord} from './collection-view';
export interface CollectionDuplicateResult {matches:CollectionRecord[];unread:number;scanned:number;cancelled:boolean;}
/** Exact text bytes, or an entire identical HTTP(S) URL with surrounding whitespace removed.
 * Never canonicalize query parameters, fragments, case, or links inside different prose. */
export function collectionDuplicateValue(body:string):string|undefined {
 if(!body.trim())return;
 const url=body.trim();if(/^https?:\/\/[^\s<>]+$/u.test(url))try{const parsed=new URL(url);if(parsed.protocol==='http:'||parsed.protocol==='https:')return 'url:'+url;}catch{/* Not a URL: retain literal text semantics. */}
 return 'text:'+body;
}
export async function findCollectionDuplicates(records:readonly CollectionRecord[],body:string,read:(record:CollectionRecord)=>Promise<string>,current:()=>boolean):Promise<CollectionDuplicateResult>{
 const wanted=collectionDuplicateValue(body),matches:CollectionRecord[]=[];let cursor=0,unread=0,scanned=0;
 if(wanted)await Promise.all(Array.from({length:Math.min(2,records.length)},async()=>{
  while(current()&&cursor<records.length){const record=records[cursor++];try{const text=await read(record);if(current()&&collectionDuplicateValue(text)===wanted)matches.push({...record,tags:[...record.tags]});}catch{if(current())unread++;}if(current())scanned++;}
 }));
 return {matches:current()?matches.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.path.localeCompare(b.path)):[],unread,scanned,cancelled:!current()};
}
