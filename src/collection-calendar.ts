export interface CollectionCalendarRecord {path:string;createdAt:string;archived?:boolean;}
export interface CollectionHeatmapDay {count:number;archived:number;}
export interface CollectionHeatmap {
 days:ReadonlyMap<string,CollectionHeatmapDay>;
 years:readonly number[];
 total:number;
 /** Unique physical records with missing/invalid time; never inferred from mtime. */
 ignored:number;
}
export interface CollectionCalendarDay {key:string;weekday:number;month:number;day:number;}

const dayKey=(year:number,month:number,day:number)=>`${year.toString().padStart(4,'0')}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
const calendarYear=(year:number)=>Number.isInteger(year)&&year>=0&&year<=9999;

/** Device-local calendar date, shared with the inclusive collection date filter. */
export function collectionLocalDay(date:Date):string {
 return Number.isFinite(date.getTime())?dayKey(date.getFullYear(),date.getMonth()+1,date.getDate()):'';
}

/** Local noon avoids midnight transitions. A normalized or nonexistent day is
 * rejected instead of silently selecting a different day in the date filter. */
export function parseCollectionDay(key:string):Date|undefined {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return;
 const date=new Date(key+'T12:00:00');
 if(Number.isFinite(date.getTime())&&collectionLocalDay(date)===key)return date;
}

/** Move the civil day label first, then skip a nonexistent local date in the
 * requested direction. Local setDate can normalize a backward move to the same
 * date when a timezone skipped a whole day (Apia, 2011-12-30). */
export function shiftCollectionDay(key:string,delta:number):string|undefined {
 if(!Number.isSafeInteger(delta))return;
 const local=parseCollectionDay(key);if(!local)return;
 const date=new Date(0);date.setUTCFullYear(local.getFullYear(),local.getMonth(),local.getDate());date.setUTCHours(12,0,0,0);date.setUTCDate(date.getUTCDate()+delta);
 // Keep a small hard bound so malformed dates can never turn keyboard
 // navigation into a scan beyond the immediate calendar neighborhood.
 for(let skipped=0;skipped<=7;skipped++){
  if(!Number.isFinite(date.getTime())||!calendarYear(date.getUTCFullYear()))return;
  const target=dayKey(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());
  if(parseCollectionDay(target))return target;
  if(delta===0)return;
  date.setUTCDate(date.getUTCDate()+Math.sign(delta));
 }
}

/** One pass over the current metadata snapshot, including archived records and
 * independent of every browse filter. Identity duplicates at distinct paths are
 * distinct notes; repeated rows for the same physical path count only once.
 * The canonical UTC format is the existing collection identity contract. */
export function collectionHeatmap(records:readonly CollectionCalendarRecord[]):CollectionHeatmap {
 const days=new Map<string,CollectionHeatmapDay>(),years=new Set<number>(),seen=new Set<string>();let total=0,ignored=0;
 for(const record of records){
  if(!record.path||seen.has(record.path))continue;seen.add(record.path);
  const value=record.createdAt;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)){ignored++;continue;}
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())||date.toISOString()!==value||!calendarYear(date.getFullYear())){ignored++;continue;}
  const key=collectionLocalDay(date),previous=days.get(key)||{count:0,archived:0};
  days.set(key,{count:previous.count+1,archived:previous.archived+Number(record.archived===true)});years.add(date.getFullYear());total++;
 }
 return{days,years:[...years].sort((a,b)=>a-b),total,ignored};
}

/** At most 366 Gregorian cells, never a range expanded from record timestamps.
 * UTC is used only to enumerate civil day labels/weekday positions, not to
 * assign records to days. weekday follows Date: Sunday=0 through Saturday=6. */
export function collectionCalendarDays(year:number):readonly CollectionCalendarDay[] {
 if(!calendarYear(year))return[];
 const result:CollectionCalendarDay[]=[],date=new Date(0);date.setUTCFullYear(year,0,1);date.setUTCHours(12,0,0,0);
 while(date.getUTCFullYear()===year){
  const month=date.getUTCMonth()+1,day=date.getUTCDate();result.push({key:dayKey(year,month,day),weekday:date.getUTCDay(),month,day});date.setUTCDate(day+1);
 }
 return result;
}
