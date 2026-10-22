import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionSearchSnippet,filterCollectionSearchRecords,searchCollectionRecords,type CollectionSearchOptions,type CollectionSearchProgress} from '../src/collection-search';
import type {CollectionRecord} from '../src/collection-view';

const record=(n:number,patch:Partial<CollectionRecord>={}):CollectionRecord=>({id:`capture-search-${n}`,createdAt:'2026-10-13T12:00:00.000Z',path:`材料/条目-${n}.md`,title:`条目 ${n}`,tags:['#研究/阅读'],inBoard:false,...patch});
const options:CollectionSearchOptions={query:''};
test('actual shared metadata filter combines path, title, native tags and negative parent tags',()=>{
 const records=[record(1,{title:'Alpha CAFÉ'}),record(2,{title:'Alpha',tags:['#研究/阅读','#排除/以后']}),record(3,{title:'Alpha',tags:['#研究者']})];
 assert.deepEqual(filterCollectionSearchRecords(records,{query:'alpha 材料 cafe\u0301 #研究 -#排除'}).map(item=>item.id),[records[0].id]);
 assert.deepEqual(filterCollectionSearchRecords(records,{query:'#研究 -#排除'}).map(item=>item.id),[records[0].id]);
 assert.equal(filterCollectionSearchRecords(records,{query:'#'}).length,0);assert.equal(filterCollectionSearchRecords(records,{query:'-#'}).length,0);
});
test('scope, pin and inclusive local date filters compose without mutating native records',()=>{
 const date=new Date(2026,9,13,0,0,0).toISOString(),end=new Date(2026,9,13,23,59,59).toISOString();
 const records=[record(1,{createdAt:date,pinned:true}),record(2,{createdAt:end,inBoard:true}),record(3,{archived:true,pinned:true}),record(4,{inBoard:'unknown'}),record(5,{createdAt:new Date(2026,9,14,0,0,0).toISOString()})];
 const before=JSON.stringify(records),filter={query:'',since:'2026-10-13',until:'2026-10-13'};
 assert.deepEqual(filterCollectionSearchRecords(records,{...filter,scope:'unplaced'}).map(item=>item.id),[records[0].id]);
 assert.deepEqual(filterCollectionSearchRecords(records,{...filter,scope:'placed'}).map(item=>item.id),[records[1].id]);
 assert.deepEqual(filterCollectionSearchRecords(records,{...options,pinnedOnly:true}).map(item=>item.id),[records[0].id]);
 assert.deepEqual(filterCollectionSearchRecords(records,{...options,scope:'archived',pinnedOnly:true}).map(item=>item.id),[records[2].id]);
 assert.equal(JSON.stringify(records),before);
 for(const patch of [{since:'2026-02-30'},{until:'2026-1-01'},{since:'2026-10-14',until:'2026-10-13'}])assert.throws(()=>filterCollectionSearchRecords(records,{...options,...patch}),/日期/);
});
test('metadata-only, blank and tag-only searches never read a body, even with explicit body option',async()=>{
 const records=[record(1),record(2,{archived:true})];let reads=0;
 for(const query of [{query:'材料 条目'},{query:''},{query:'   ',includeBody:true},{query:'#研究 -#排除',includeBody:true},{query:'正文',includeBody:false}]){
  const result=await searchCollectionRecords(records,query,{current:()=>true,readBody:async()=>{reads++;throw Error('must not read');}});
  assert.equal(result.total,0);assert.equal(result.scanned,0);assert.equal(result.unread,0);assert.equal(result.cancelled,false);
 }
 assert.equal(reads,0);
});
test('body-only words combine across metadata and full body after structural narrowing',async()=>{
 const records=[record(1,{title:'项目 Alpha'}),record(2,{tags:['#排除/待办']}),record(3,{archived:true}),record(4,{inBoard:true}),record(5,{title:'项目 Alpha 正文目标'})],read:number[]=[],progress:CollectionSearchProgress[]=[];
 const result=await searchCollectionRecords(records,{query:'alpha 材料 #研究 -#排除 正文目标',includeBody:true,scope:'unplaced'},{current:()=>true,onProgress:p=>progress.push(p),readBody:async item=>{read.push(Number(item.id.split('-').at(-1)));return '起始\n\n正文目标 <img src=x onerror=alert(1)> [[原生链接]]';}});
 assert.deepEqual(read,[1]);assert.deepEqual(result.hits.map(hit=>hit.record.id),[records[0].id,records[4].id]);assert.equal(result.total,1);assert.equal(result.scanned,1);assert.equal(result.unread,0);
 const snippet=result.hits[0].snippet!;assert.ok(snippet.text.includes('<img'));assert.ok(snippet.ranges.some(range=>snippet.text.slice(range.start,range.end)==='正文目标'));
 assert.deepEqual(progress,[{scanned:0,total:1,unread:0},{scanned:1,total:1,unread:0}]);
});
test('partial native read failures remain visible and do not suppress successful matches',async()=>{
 const records=[record(1),record(2),record(3)];
 const result=await searchCollectionRecords(records,{query:'needle',includeBody:true},{current:()=>true,readBody:async item=>{if(item===records[1])throw Error('storage unavailable');return item===records[0]?'needle':'unrelated';}});
 assert.deepEqual(result.hits.map(hit=>hit.record.id),[records[0].id]);assert.deepEqual([result.scanned,result.total,result.unread],[3,3,1]);
});
test('cancelled scans stop after at most two in-flight reads and publish no stale hits or progress',async()=>{
 let active=true,reads=0;const gates:(()=>void)[]=[],progress:CollectionSearchProgress[]=[];
 const search=searchCollectionRecords(Array.from({length:100},(_,i)=>record(i)),{query:'needle',includeBody:true},{current:()=>active,onProgress:p=>progress.push(p),readBody:async()=>{reads++;await new Promise<void>(resolve=>gates.push(resolve));return 'needle';}});
 assert.equal(reads,2);active=false;gates.forEach(resolve=>resolve());const result=await search;
 assert.equal(result.cancelled,true);assert.deepEqual(result.hits,[]);assert.equal(reads,2);assert.deepEqual(progress,[{scanned:0,total:100,unread:0}]);
});
test('newer search stays independent when an older cancelled body read returns late',async()=>{
 let oldCurrent=true,finish!:()=>void;const records=[record(1),record(2)];
 const old=searchCollectionRecords(records.slice(0,1),{query:'old',includeBody:true},{current:()=>oldCurrent,readBody:async()=>{await new Promise<void>(resolve=>{finish=resolve;});return 'old';}});
 oldCurrent=false;finish();assert.equal((await old).cancelled,true);
 const current=await searchCollectionRecords(records,{query:'条目 2'},{current:()=>true,readBody:async()=>{throw Error('unneeded');}});
 assert.deepEqual(current.hits.map(hit=>hit.record.id),[records[1].id]);
});
test('snippets are bounded plain text with valid merged offsets after Unicode folding',()=>{
 const body='prefix '.repeat(100)+'İ CAFE\u0301 😀 needle needle <script>x</script>'+' suffix'.repeat(100);
 const snippet=collectionSearchSnippet(body,['i\u0307','café','needle','<script>']);assert.ok(snippet.text.length<=400);assert.ok(snippet.ranges.length>=4);
 for(const range of snippet.ranges){assert.ok(range.start>=0&&range.end<=snippet.text.length&&range.start<range.end);assert.ok(!/[\uD800-\uDBFF]$/u.test(snippet.text.slice(range.start,range.end)));}
 assert.ok(snippet.ranges.some(range=>snippet.text.slice(range.start,range.end)==='İ'));
 const greek=collectionSearchSnippet('Before ΟΣ after',['ος']);assert.equal(greek.ranges.length,1);assert.equal(greek.text.slice(greek.ranges[0].start,greek.ranges[0].end),'ΟΣ');
 const lithuanian=collectionSearchSnippet('J\u0301 abc',['abc']);assert.deepEqual(lithuanian.ranges,[{start:3,end:6}]);assert.equal(lithuanian.text.slice(lithuanian.ranges[0].start,lithuanian.ranges[0].end),'abc');
 const bounded=collectionSearchSnippet('x'.repeat(500)+'😀needle😀'+'y'.repeat(500),['needle']);assert.ok(bounded.text.length<=400);assert.ok(bounded.ranges.every(range=>Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.end<=bounded.text.length));
});
test('ten thousand real service candidates have bounded concurrency and one read each',async()=>{
 const records=Array.from({length:10001},(_,i)=>record(i));let reads=0,inFlight=0,peak=0;
 const result=await searchCollectionRecords(records,{query:'needle',includeBody:true},{current:()=>true,readBody:async item=>{reads++;inFlight++;peak=Math.max(peak,inFlight);await Promise.resolve();inFlight--;return item===records.at(-1)?'needle':'other';}});
 assert.deepEqual(result.hits.map(hit=>hit.record.id),[records.at(-1)!.id]);assert.equal(reads,10001);assert.equal(peak,2);assert.equal(result.scanned,10001);assert.equal(result.total,10001);assert.equal(result.unread,0);
});
test('native task conditions compose with metadata filters and do not classify unknown as no tasks',()=>{
 const records=[record(1,{tasks:{total:2,done:1},pinned:true}),record(2,{tasks:{total:2,done:2}}),record(3,{tasks:{total:0,done:0}}),record(4),record(5,{tasks:{total:2,done:0},archived:true})],before=JSON.stringify(records);
 const ids=(tasks:CollectionSearchOptions['tasks'])=>filterCollectionSearchRecords(records,{query:'#研究',tasks}).map(item=>item.id);
 assert.deepEqual(ids('todo'),[records[0].id]);assert.deepEqual(ids('done'),[records[1].id]);assert.deepEqual(ids('none'),[records[2].id]);assert.deepEqual(ids('any'),[records[0].id,records[1].id]);assert.equal(ids('all').length,4);
 assert.deepEqual(filterCollectionSearchRecords(records,{query:'',tasks:'todo',scope:'archived'}).map(item=>item.id),[records[4].id]);
 assert.deepEqual(filterCollectionSearchRecords(records,{query:'',tasks:'todo',pinnedOnly:true,scope:'unplaced',since:'2026-10-13',until:'2026-10-13'}).map(item=>item.id),[records[0].id]);
 assert.equal(JSON.stringify(records),before);
 for(const tasks of ['',null,'completed',false,{}])assert.throws(()=>filterCollectionSearchRecords(records,{query:'',tasks} as unknown as CollectionSearchOptions),/任务筛选/);
});
test('task filtering never scans bodies and narrows explicitly enabled body scans before reading',async()=>{
 const records=[record(1,{tasks:{total:1,done:0}}),record(2,{tasks:{total:1,done:1}}),record(3,{tasks:{total:0,done:0}}),record(4)],read:string[]=[];
 const reader={current:()=>true,readBody:async(item:CollectionRecord)=>{read.push(item.id);return 'needle';}};
 for(const query of ['', '#研究']){const result=await searchCollectionRecords(records,{query,includeBody:true,tasks:'todo'},reader);assert.deepEqual(result.hits.map(hit=>hit.record.id),[records[0].id]);assert.equal(result.scanned,0);}
 assert.deepEqual(read,[]);
 const result=await searchCollectionRecords(records,{query:'needle',includeBody:true,tasks:'todo'},reader);assert.deepEqual(read,[records[0].id]);assert.equal(result.total,1);assert.equal(result.hits.length,1);
 await assert.rejects(searchCollectionRecords(records,{query:'needle',tasks:'bad'} as unknown as CollectionSearchOptions,reader),/任务筛选/);assert.equal(read.length,1);
});
