import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {collectionNoteBody,collectionNoteSource,collectionTitle,filterCollectionEntries,readCollectionIdentity,type CollectionEntry,type CollectionFilter,type CollectionInput} from '../src/collection-model';

const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:(yaml:string)=>unknown}).load;
const identity={id:'capture-record_123',createdAt:'2026-10-13T06:10:20.123Z'};
const metadata={thoughtspace_capture:identity.id,thoughtspace_created:identity.createdAt};
const input=(body='第一条记录',tags:string[]=[]):CollectionInput=>({...identity,body,tags});
const filter:CollectionFilter={query:'',tag:'',unplaced:false};
function entry(path:string,createdAt=identity.createdAt,tags=['#研究/阅读']):CollectionEntry{return{...identity,path,title:path.split('/').pop()!.replace(/\.md$/,''),createdAt,tags,mtime:1};}

test('source writes minimal quoted metadata, omits empty tags and preserves every body byte',()=>{
 const body='  第一条记录 👩🏽‍💻\r\n\n---\nthoughtspace_capture: forged\ntags: [evil]\n---\n```\n';
 const source=collectionNoteSource(input(body));
 assert.equal(source,`---\nthoughtspace_capture: "${identity.id}"\nthoughtspace_created: "${identity.createdAt}"\n---\n${body}`);
 assert.equal(collectionNoteBody(source,parseYaml),body);
 assert.equal(collectionNoteBody(collectionNoteSource(input('末尾没有换行')),parseYaml),'末尾没有换行');
});

test('body metadata-looking content cannot override collection identity',()=>{
 const body=`---\nthoughtspace_capture: "capture-other_123"\nthoughtspace_created: "2020-01-01T00:00:00.000Z"\n---\n# 内文`;
 const source=collectionNoteSource(input(body));
 assert.equal(collectionNoteBody(source,parseYaml,identity),body);
 assert.equal(collectionNoteBody(source,parseYaml,{...identity,id:'capture-other_123'}),undefined);
});

test('Unicode hierarchical tags reuse native validation and do not mutate caller input',()=>{
 const value=input('记录',['#研究/阅读','Research','research','cafe\u0301','#标签-2']);
 Object.freeze(value.tags);Object.freeze(value);
 const source=collectionNoteSource(value),header=parseYaml(source.split('\n---\n')[0].slice(4)) as Record<string,unknown>;
 assert.deepEqual(header.tags,['研究/阅读','research','cafe\u0301','标签-2']);
 assert.deepEqual(readCollectionIdentity(header),identity);
 assert.deepEqual(value.tags,['#研究/阅读','Research','research','cafe\u0301','#标签-2']);
});

test('body validation permits whitespace around content and rejects empty or oversized input',()=>{
 for(const body of ['', ' \t\r\n', '\u2003'])assert.throws(()=>collectionNoteSource(input(body)),/先写下/);
 assert.equal(collectionNoteBody(collectionNoteSource(input(' '+ '字'.repeat(99998)+' ')),parseYaml)?.length,100000);
 assert.throws(()=>collectionNoteSource(input('x'.repeat(100001))),/100,000/);
});

test('source rejects metadata and tag injection without touching original body',()=>{
 for(const id of ['capture-ok\nextra: true','capture-中文12345','capture-../evil','short','plain-safe-id-123'])assert.throws(()=>collectionNoteSource({...input(),id}),/标识/);
 for(const tag of ['ok\nextra: true','x"]\nmalicious: true','<script>','12','a//b','a/'])assert.throws(()=>collectionNoteSource(input('原文',[tag])),/标签/);
 assert.throws(()=>collectionNoteSource({...input(),tags:[1] as unknown as string[]}),/标签/);
});

test('read identity requires own explicit collection fields and returns only copied identity',()=>{
 const value={...metadata,unrelated:true,tags:['研究']};Object.freeze(value);
 assert.deepEqual(readCollectionIdentity(value),identity);
 const result=readCollectionIdentity(value)!;result.id='capture-different';assert.equal(value.thoughtspace_capture,identity.id);
 for(const raw of [undefined,null,true,1,'string',[],{},Object.create(metadata),{thoughtspace_capture:identity.id},{thoughtspace_created:identity.createdAt}])assert.equal(readCollectionIdentity(raw),undefined);
});

test('identity enforces ASCII capture prefix and the complete 12 to 120 character limit',()=>{
 for(const id of ['capture-'+ 'a'.repeat(4),'capture-'+ 'A0_-'.repeat(28)])assert.ok(readCollectionIdentity({...metadata,thoughtspace_capture:id}));
 for(const id of ['capture-abc','capture-'+ 'a'.repeat(113),'Capture-valid123','capture-valid\u0000id','capture-valíd123','capture-valid123 ','capture-valid123\n','abcdefghijklm',0,{},['capture-valid123']])assert.equal(readCollectionIdentity({...metadata,thoughtspace_capture:id}),undefined);
});

test('created date is a valid canonical UTC ISO string, not a coerced date or normalized invalid day',()=>{
 for(const date of ['2024-02-29T23:59:59.999Z','2000-01-01T00:00:00.000Z'])assert.ok(readCollectionIdentity({...metadata,thoughtspace_created:date}));
 for(const date of ['2026-02-29T06:10:20.123Z','2026-02-30T06:10:20.123Z','2026-10-13','2026-10-13T06:10:20Z','2026-10-13T06:10:20.123+00:00','2026-10-13T24:10:20.123Z','2026-10-13T06:10:60.123Z','2026-13-13T06:10:20.123Z','2026-10-13T06:10:20.123z',new Date(identity.createdAt),0,null]){
  assert.equal(readCollectionIdentity({...metadata,thoughtspace_created:date}),undefined);
  assert.throws(()=>collectionNoteSource({...input(),createdAt:date as string}),/标识/);
 }
});

test('body reader accepts native edited legal YAML, CRLF and unrelated properties without rewriting',()=>{
 const source=`\uFEFF---\r\nunrelated:\r\n  nested: retained\r\nthoughtspace_capture: '${identity.id}'\r\nthoughtspace_created: '${identity.createdAt}'\r\ntags:\r\n  - 研究/阅读\r\n---\r\n\r\n保持正文\r\n`;
 assert.equal(collectionNoteBody(source,parseYaml,identity),'\r\n保持正文\r\n');
 assert.equal(collectionNoteBody(collectionNoteSource(input('内容')).replace('\n---\n内容','\n...\n内容'),parseYaml),'内容');
 assert.equal(collectionNoteBody(collectionNoteSource(input('内容')),parseYaml,{...identity,createdAt:'2026-10-14T06:10:20.123Z'}),undefined);
});

test('body reader refuses legacy notes, malformed or duplicate YAML and non-top-level markers',()=>{
 const valid=collectionNoteSource(input());
 for(const source of ['# 旧笔记','---\ntags: [研究]\n---\n正文','\n'+valid,'Intro\n'+valid,valid.replace('\n---\n第一条记录','\n第一条记录'),valid.replace('thoughtspace_capture:', 'wrapper:\n  thoughtspace_capture:'),valid.replace('---\n',`---\nthoughtspace_capture: "${identity.id}"\n`),valid.replace('thoughtspace_capture:', 'thoughtspace_capture: [')])assert.equal(collectionNoteBody(source,parseYaml),undefined);
 assert.equal(collectionNoteBody(valid,()=>{throw Error('Invalid YAML');}),undefined);
});

test('display title derives a bounded first nonempty line and never changes Markdown',()=>{
 const body='\n   \n## 第一行 **保留格式**\r\n第二行';assert.equal(collectionTitle(body),'第一行 **保留格式**');assert.equal(body,'\n   \n## 第一行 **保留格式**\r\n第二行');
 assert.equal(collectionTitle('#正文标签\n内容'),'#正文标签');assert.equal(collectionTitle(' \n '),'未命名笔记');
 assert.equal(collectionTitle('a'.repeat(79)+'😀末尾'),'a'.repeat(79));
 assert.equal(collectionTitle('第一\u0000行\u007f内容'),'第一 行 内容');
 assert.ok(collectionTitle('文'.repeat(100)).length<=80);
});

test('entries sort by creation time, then stable path; changing mtime never promotes old records',()=>{
 const old=entry('Old.md','2026-10-01T00:00:00.000Z'),a=entry('A.md'),b=entry('B.md');old.mtime=Number.MAX_SAFE_INTEGER;a.mtime=99999;
 const records=[old,b,a];Object.freeze(records);for(const record of records){Object.freeze(record.tags);Object.freeze(record);}
 assert.deepEqual(filterCollectionEntries(records,filter,new Set(),true).map(x=>x.path),['A.md','B.md','Old.md']);
 assert.deepEqual(records.map(x=>x.path),['Old.md','B.md','A.md']);
 assert.equal(filterCollectionEntries(records,filter,new Set(),true)[0],a);
});

test('query composes title, path and exact or nested Unicode native tags',()=>{
 const records=[entry('材料/Alpha.md'),entry('材料/Beta.md',identity.createdAt,['#研究者']),entry('Draft/Alpha.md',identity.createdAt,['#Work/Project'])];
 const matches=(query:string,tag='')=>filterCollectionEntries(records,{...filter,query,tag},new Set(),true).map(x=>x.path);
 assert.deepEqual(matches('alpha 材料 #研究'),['材料/Alpha.md']);
 assert.deepEqual(matches('ALPHA',' #研究/阅读 '),['材料/Alpha.md']);
 assert.deepEqual(matches('#work'),['Draft/Alpha.md']);
 assert.deepEqual(matches('','#研'),[]);assert.deepEqual(matches('#'),[]);assert.deepEqual(matches('alpha missing'),[]);
});

test('delivery affects only the unplaced filter; uncertain indexing never invents unplaced records',()=>{
 const records=[entry('Placed.md'),entry('Unplaced.md')],usage=new Set(['Placed.md']);const before=JSON.stringify(records);
 assert.equal(filterCollectionEntries(records,filter,usage,true).length,2);
 assert.deepEqual(filterCollectionEntries(records,{...filter,unplaced:true},usage,true).map(x=>x.path),['Unplaced.md']);
 assert.deepEqual(filterCollectionEntries(records,{...filter,unplaced:true},usage,false),[]);
 assert.equal(filterCollectionEntries(records,filter,usage,false).length,2);
 assert.equal(JSON.stringify(records),before);assert.deepEqual([...usage],['Placed.md']);
});

test('unmarked old inbox notes cannot enter the collection through filtering',()=>{
 const records=[entry('Collection.md'),{...entry('Old inbox.md'),id:'old-note'},{path:'Legacy.md',title:'Legacy',mtime:1,tags:[]} as unknown as CollectionEntry];
 assert.deepEqual(filterCollectionEntries(records,{...filter,unplaced:true},new Set(),true).map(x=>x.path),['Collection.md']);
});

test('large collection filtering keeps all matching metadata for caller pagination',()=>{
 const records=Array.from({length:10001},(_,i)=>entry(`Notes/${i.toString().padStart(5,'0')}.md`));
 const result=filterCollectionEntries(records,filter,new Set(),true);
 assert.equal(result.length,10001);assert.equal(result[10000].path,'Notes/10000.md');assert.equal(result.slice(10000,10048).length,1);
});
