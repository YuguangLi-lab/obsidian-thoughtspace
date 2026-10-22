import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {collectionCalendarDays,collectionHeatmap,collectionLocalDay,parseCollectionDay,shiftCollectionDay,type CollectionCalendarRecord} from '../src/collection-calendar';
import {filterCollectionSearchRecords} from '../src/collection-search';
import type {CollectionRecord} from '../src/collection-view';

const record=(path:string,createdAt='2026-10-14T12:00:00.000Z',archived=false):CollectionCalendarRecord=>({path,createdAt,archived});
const snapshot=(records:readonly CollectionCalendarRecord[])=>{const value=collectionHeatmap(records);return{...value,days:[...value.days]};};

test('empty metadata snapshot has no fabricated years, days or records',()=>{
 assert.deepEqual(snapshot([]),{days:[],years:[],total:0,ignored:0});
 assert.equal(collectionLocalDay(new Date('invalid')),'');
});

test('heatmap includes archived notes and counts physical paths, not repeated collection identities',()=>{
 const first={...record('收集/原笔记.md'),id:'capture-duplicate',pinned:true,inBoard:true},second={...record('收集/副本.md',first.createdAt,true),id:first.id};
 const value=collectionHeatmap([first,first,second,{...first,archived:true}]);
 assert.equal(value.total,2);assert.equal(value.ignored,0);
 assert.deepEqual(value.days.get(collectionLocalDay(new Date(first.createdAt))),{count:2,archived:1});
 assert.equal(value.years.length,1);
});

test('renaming, pinning, delivery and body edits do not create activity; archive/restore only changes archived subtotal',()=>{
 const originals=[record('one.md'),record('two.md')],initial=snapshot(originals);
 const renamed=[{...originals[0],path:'renamed.md',pinned:true,inBoard:true,mtime:Date.now(),body:'edited'},originals[1]];
 assert.deepEqual(snapshot(renamed),initial);
 const archived=collectionHeatmap([{...renamed[0],archived:true},renamed[1]]);
 assert.equal(archived.total,initial.total);assert.deepEqual([...archived.days.values()],[{count:2,archived:1}]);
 assert.deepEqual(snapshot([{...renamed[0],archived:false},renamed[1]]),initial);
 // Each call is a fresh current snapshot: external created-time changes move,
 // rather than append, the original record; deletion removes it altogether.
 const moved=collectionHeatmap([{...renamed[0],createdAt:'2025-01-02T12:00:00.000Z'},renamed[1]]);
 assert.equal(moved.total,2);assert.equal(moved.days.size,2);assert.deepEqual(moved.years,[2025,2026]);
 assert.equal(collectionHeatmap(renamed.slice(1)).total,1);
});

test('missing, normalized, ambiguous or extended timestamps are ignored without mtime inference',()=>{
 const invalid=['','invalid','2026-02-30T12:00:00.000Z','2026-13-01T12:00:00.000Z','2026-10-14','2026-10-14T12:00:00','2026-10-14T12:00:00Z','2026-10-14T12:00:00.000+00:00','2026-10-14T24:00:00.000Z','2026-10-14T12:60:00.000Z','+010000-01-01T00:00:00.000Z'];
 const records=invalid.map((createdAt,index)=>({...record(`invalid-${index}.md`,createdAt),mtime:Date.now()}));
 const value=collectionHeatmap([...records,records[0],record('good.md')]);
 assert.equal(value.total,1);assert.equal(value.ignored,invalid.length);assert.equal(value.days.size,1);
 const missing=record('missing.md');delete (missing as Partial<CollectionCalendarRecord>).createdAt;
 assert.equal(collectionHeatmap([missing]).ignored,1);
 assert.equal(collectionHeatmap([record('')]).total,0);
 // Same-path conflicting snapshots never select the more convenient date.
 assert.equal(collectionHeatmap([record('same.md','bad'),record('same.md')]).ignored,1);
});

test('aggregation reads only required metadata, never note bodies or unrelated mutable fields',()=>{
 const original=Object.freeze({...record('immutable.md'),get body():string{throw Error('must not read body');},get mtime():number{throw Error('must not infer from mtime');},get tags():string[]{throw Error('must not filter');},get id():string{throw Error('must not deduplicate by identity');}});
 const records=Object.freeze([original]);assert.equal(collectionHeatmap(records).total,1);assert.equal(original.archived,false);
});

test('calendar labels include Gregorian leap day, weekday and bounded outlier years',()=>{
 const leap=collectionCalendarDays(2024);assert.equal(leap.length,366);assert.deepEqual(leap.find(day=>day.key==='2024-02-29'),{key:'2024-02-29',weekday:4,month:2,day:29});
 assert.equal(leap[0].key,'2024-01-01');assert.equal(leap.at(-1)!.key,'2024-12-31');assert.equal(new Set(leap.map(day=>day.key)).size,366);
 assert.equal(collectionCalendarDays(2023).length,365);assert.equal(collectionCalendarDays(1900).length,365);assert.equal(collectionCalendarDays(2000).length,366);
 assert.equal(collectionCalendarDays(0)[0].key,'0000-01-01');assert.equal(collectionCalendarDays(99)[0].key,'0099-01-01');assert.equal(collectionCalendarDays(9999).length,365);
 for(const year of [-1,10000,1e12,NaN,Infinity,2024.5])assert.deepEqual(collectionCalendarDays(year),[]);
 const range=collectionHeatmap([record('old.md','0001-06-15T12:00:00.000Z'),record('future.md','9998-06-15T12:00:00.000Z')]);assert.deepEqual(range.years,[1,9998]);assert.equal(range.days.size,2);
});

test('strict day parsing and calendar shifts reject rollover, malformed and unsafe values',()=>{
 for(const day of ['','2023-02-29','2024-02-30','2026-13-01','2026-01-32','2026-1-01','26-01-01','2026-01-01T00:00:00','10000-01-01',' 2026-01-01'])assert.equal(parseCollectionDay(day),undefined,day);
 assert.equal(collectionLocalDay(parseCollectionDay('2024-02-29')!),'2024-02-29');
 assert.equal(parseCollectionDay('0099-01-01')!.getFullYear(),99);
 assert.equal(shiftCollectionDay('2023-12-31',1),'2024-01-01');assert.equal(shiftCollectionDay('2024-01-01',-1),'2023-12-31');
 assert.equal(shiftCollectionDay('2024-02-28',1),'2024-02-29');assert.equal(shiftCollectionDay('2024-02-29',1),'2024-03-01');assert.equal(shiftCollectionDay('2023-02-28',1),'2023-03-01');
 assert.equal(shiftCollectionDay('2024-01-01',0),'2024-01-01');assert.equal(shiftCollectionDay('invalid',1),undefined);
 assert.equal(shiftCollectionDay('0000-01-01',-1),undefined);assert.equal(shiftCollectionDay('9999-12-31',1),undefined);
 for(const delta of [NaN,Infinity,.5,Number.MAX_SAFE_INTEGER+1])assert.equal(shiftCollectionDay('2026-01-01',delta),undefined);
});

test('one thousand metadata records aggregate once each and remain independent of search results',()=>{
 let timestampsRead=0;const records=Array.from({length:1000},(_,index)=>{
  const createdAt=new Date(2026,0,index%31+1,12).toISOString();return Object.freeze({path:`bulk-${index}.md`,get createdAt(){timestampsRead++;return createdAt;},archived:index%5===0});
 });
 const result=collectionHeatmap(records);assert.equal(timestampsRead,1000);assert.equal(result.total,1000);assert.equal(result.days.size,31);assert.equal(result.ignored,0);
 assert.equal([...result.days.values()].reduce((sum,day)=>sum+day.count,0),1000);assert.equal([...result.days.values()].reduce((sum,day)=>sum+day.archived,0),200);
 const rows:CollectionRecord[]=records.map((value,index)=>({...value,id:`capture-record-${index}`,title:index%2?'other':'needle',tags:[],inBoard:false,pinned:index%3===0}));
 const date=[...result.days.keys()][0],options={query:'needle',since:date,until:date,pinnedOnly:true};
 const active=filterCollectionSearchRecords(rows,options),archived=filterCollectionSearchRecords(rows,{...options,scope:'archived'});
 assert.ok(active.length+archived.length<result.days.get(date)!.count);assert.equal(collectionHeatmap(rows).total,1000);
});

for(const zone of ['UTC','Asia/Shanghai','America/New_York'])test(`local day/search parity and DST calendar arithmetic in ${zone}`,()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const code=`
  import assert from 'node:assert/strict';
  import {collectionCalendarDays,collectionHeatmap,collectionLocalDay,parseCollectionDay,shiftCollectionDay} from './src/collection-calendar.ts';
  import {filterCollectionSearchRecords} from './src/collection-search.ts';
  const zone=${JSON.stringify(zone)};
  const stamps=['2026-01-01T00:30:00.000Z','2025-12-31T17:00:00.000Z','2024-02-29T04:30:00.000Z'];
  const expected=zone==='UTC'?['2026-01-01','2025-12-31','2024-02-29']:zone==='Asia/Shanghai'?['2026-01-01','2026-01-01','2024-02-29']:['2025-12-31','2025-12-31','2024-02-28'];
  stamps.forEach((stamp,index)=>assert.equal(collectionLocalDay(new Date(stamp)),expected[index]));
  const rows=stamps.map((createdAt,index)=>({path:'record-'+index+'.md',id:'capture-zone-'+index,createdAt,title:'record',tags:[],archived:false,inBoard:false}));
  const map=collectionHeatmap(rows);
  for(const [day,value] of map.days)assert.equal(filterCollectionSearchRecords(rows,{query:'',since:day,until:day}).length,value.count);
  for(const key of ['2026-03-07','2026-03-08','2026-10-31','2026-11-01']){const next=shiftCollectionDay(key,1);assert.equal(shiftCollectionDay(next,-1),key);assert.equal(parseCollectionDay(next).getHours(),12);}
  assert.equal(shiftCollectionDay('2026-03-08',1),'2026-03-09');assert.equal(shiftCollectionDay('2026-11-01',1),'2026-11-02');
  const spring=(parseCollectionDay('2026-03-08').getTime()-parseCollectionDay('2026-03-07').getTime())/3600000;
  const fall=(parseCollectionDay('2026-11-01').getTime()-parseCollectionDay('2026-10-31').getTime())/3600000;
  assert.equal(spring,zone==='America/New_York'?23:24);assert.equal(fall,zone==='America/New_York'?25:24);
  const transitions=['2026-03-08T06:59:59.999Z','2026-03-08T07:00:00.000Z','2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z'];
  const values=collectionHeatmap(transitions.map((createdAt,index)=>({path:'transition-'+index,createdAt})));
  assert.equal(values.days.get('2026-03-08').count,2);assert.equal(values.days.get('2026-11-01').count,2);
  const localStart=new Date(2026,9,14,0,0,0,0),localEnd=new Date(2026,9,14,23,59,59,999);
  const edges=collectionHeatmap([localStart,localEnd,new Date(localEnd.getTime()+1)].map((date,index)=>({path:'edge-'+index,createdAt:date.toISOString()})));
  assert.equal(edges.days.get('2026-10-14').count,2);assert.equal(edges.days.get('2026-10-15').count,1);
  const bounds=collectionHeatmap([{path:'maximum',createdAt:'9999-12-31T23:59:59.999Z'},{path:'minimum',createdAt:'0000-01-01T00:00:00.000Z'}]);
  assert.ok(bounds.years.every(year=>year>=0&&year<=9999));assert.equal(bounds.total+bounds.ignored,2);
  assert.equal(bounds.ignored,zone==='UTC'?0:1);
  assert.equal(collectionCalendarDays(2024).length,366);
  console.log('verified '+zone);
 `;
 const run=spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',code],{cwd:root,env:{...process.env,TZ:zone},encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
 assert.equal(run.error,undefined);assert.equal(run.signal,null);assert.equal(run.status,0,run.stderr||run.stdout);assert.match(run.stdout,/verified/);
});

test('Apia whole-day skip advances both directions and adjusts missing week targets without sticking',()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const code=`
  import assert from 'node:assert/strict';
  import {collectionCalendarDays,collectionHeatmap,parseCollectionDay,shiftCollectionDay} from './src/collection-calendar.ts';
  assert.equal(parseCollectionDay('2011-12-30'),undefined);
  assert.equal(shiftCollectionDay('2011-12-29',1),'2011-12-31');
  assert.equal(shiftCollectionDay('2011-12-31',-1),'2011-12-29');
  assert.equal(shiftCollectionDay('2011-12-23',7),'2011-12-31');
  assert.equal(shiftCollectionDay('2012-01-06',-7),'2011-12-29');
  assert.equal(shiftCollectionDay('2011-12-29',2),'2011-12-31');
  assert.equal(shiftCollectionDay('2011-12-31',-2),'2011-12-29');
  assert.equal(shiftCollectionDay('2011-12-31',0),'2011-12-31');
  assert.equal(shiftCollectionDay('2011-12-30',1),undefined);
  assert.equal(shiftCollectionDay('2011-12-30',-1),undefined);
  assert.equal(shiftCollectionDay('2011-12-31',1),'2012-01-01');
  assert.equal(shiftCollectionDay('2012-01-01',-1),'2011-12-31');
  assert.equal(shiftCollectionDay('0000-01-01',-1),undefined);
  assert.equal(shiftCollectionDay('9999-12-31',1),undefined);
  assert.equal(shiftCollectionDay('2011-12-31',Number.MAX_SAFE_INTEGER),undefined);
  assert.equal(shiftCollectionDay('2011-12-31',-Number.MAX_SAFE_INTEGER),undefined);
  const days=collectionCalendarDays(2011);assert.equal(days.length,365);assert.ok(days.some(day=>day.key==='2011-12-30'));
  const model=collectionHeatmap([{path:'before',createdAt:'2011-12-30T09:59:59.999Z'},{path:'after',createdAt:'2011-12-30T10:00:00.000Z'}]);
  assert.deepEqual([...model.days],[['2011-12-29',{count:1,archived:0}],['2011-12-31',{count:1,archived:0}]]);
  console.log('verified Apia skipped day');
 `;
 const run=spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',code],{cwd:root,env:{...process.env,TZ:'Pacific/Apia'},encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
 assert.equal(run.error,undefined);assert.equal(run.signal,null);assert.equal(run.status,0,run.stderr||run.stdout);assert.match(run.stdout,/verified Apia skipped day/);
});
