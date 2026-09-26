import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {mergeTexts,nodeName,replacementPreview,replaceText,studioDraft,studioStats} from '../src/board-studio';

const text=(id:string):Card=>({id,kind:'text',text:'Find me',x:0,y:0,width:200,height:100,color:'sand'});
const board=(count:number):Board=>({...emptyBoard(),version:3,nodes:Array.from({length:count},(_,i)=>text('n'+i))});

test('studio transactions serialize a validated draft once and preserve no-op and invalid-change behavior',()=>{
 const b=board(1200),before=clone(b),stringify=JSON.stringify;let snapshots=0;
 JSON.stringify=function(value:unknown,...args:unknown[]){if(value&&typeof value==='object'&&'nodes' in value&&'edges' in value)snapshots++;return Reflect.apply(stringify,JSON,[value,...args]);} as typeof JSON.stringify;
 try{const next=studioDraft(b,d=>{d.nodes[0].text='Changed';});assert.equal(next?.nodes[0].text,'Changed');}finally{JSON.stringify=stringify;}
 assert.ok(snapshots<=3,`Complete draft transaction serialized ${snapshots} boards`);
 assert.deepEqual(b,before);assert.equal(studioDraft(b,()=>{}),undefined);
 assert.throws(()=>studioDraft(b,d=>{d.nodes[0].width=-1;}));assert.deepEqual(b,before);
});

test('literal replacement preview splits each matching text only once',()=>{
 const b=board(600),ids=new Set(b.nodes.map(n=>n.id)),split=String.prototype.split;let splits=0;
 String.prototype.split=function(this:string,separator:unknown,limit?:number){if(separator==='Find')splits++;return Reflect.apply(split,this,[separator,limit]);} as typeof split;
 try{const preview=replacementPreview(b,ids,'Find','$& 😀');assert.equal(preview.length,600);assert.ok(preview.every(p=>p.after==='$& 😀 me'&&p.count===1));}finally{String.prototype.split=split;}
 assert.equal(splits,600);
});

test('batch replacement resolves selected IDs once within the full validated transaction',()=>{
 const b=board(1200),ids=new Set(b.nodes.map(n=>n.id)),preview=replacementPreview(b,ids,'Find','Found');let reads=0;
 const result=studioDraft(b,d=>{d.nodes=d.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));replaceText(d,preview);});
 assert.ok(result?.nodes.every(n=>n.text==='Found me'));assert.ok(b.nodes.every(n=>n.text==='Find me'));
 assert.ok(reads<16000,`Batch replacement plus final validation read ${reads} IDs`);
});

test('small replacement keeps early lookup and stale batches roll back atomically at the transaction boundary',()=>{
 const b=board(1200),p=replacementPreview(b,new Set(['n0']),'Find','Found');let reads=0;
 b.nodes=b.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));replaceText(b,p);assert.equal(reads,1);
 const batch=replacementPreview(b,new Set(['n0','n1199']),'me','us');b.nodes[1199].locked=true;const before=clone(b);
 assert.throws(()=>studioDraft(b,d=>replaceText(d,batch)),/对象已变化/);assert.deepEqual(b,before);
 delete b.nodes[1199].locked;b.nodes[1199].text='Concurrent edit';const changed=clone(b);assert.throws(()=>studioDraft(b,d=>replaceText(d,batch)),/对象已变化/);assert.deepEqual(b,changed);
});

test('replacement preserves sequential duplicate IDs and a fresh lookup on every operation',()=>{
 const b=board(12),preview=Array.from({length:12},(_,i)=>({id:'n0',before:i?'v'+(i-1):'Find me',after:'v'+i,count:1}));
 replaceText(b,preview);assert.equal(b.nodes[0].text,'v11');
 b.nodes[0]={...text('n0'),text:'Fresh'};replaceText(b,[{id:'n0',before:'Fresh',after:'Newest',count:1}]);assert.equal(b.nodes[0].text,'Newest');
 const before=clone(b);assert.throws(()=>studioDraft(b,d=>replaceText(d,[{id:'n0',before:'Newest',after:'x'.repeat(100001),count:1}])));assert.deepEqual(b,before);
});

test('a batch index stops after all requested front-of-board targets are found',()=>{
 const b=board(1200),p=replacementPreview(b,new Set(Array.from({length:9},(_,i)=>'n'+i)),'Find','Found');let reads=0;
 b.nodes=b.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));replaceText(b,p);assert.ok(reads<=9,`Nine nearby targets read ${reads} IDs`);assert.ok(b.nodes.slice(0,9).every(n=>n.text==='Found me'));
});

test('sequential duplicate preview entries do not force indexing unrelated board objects',()=>{
 const b=board(1200),p=Array.from({length:12},(_,i)=>({id:'n0',before:i?'v'+(i-1):'Find me',after:'v'+i,count:1}));let reads=0;
 b.nodes=b.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));replaceText(b,p);assert.ok(reads<=1,`Repeated first target read ${reads} IDs`);assert.equal(b.nodes[0].text,'v11');
});

test('merging ordinary text does not scan the selected set for every unrelated branch',()=>{
 const b=board(800),ids=new Set(b.nodes.map(n=>n.id));let reads=0;
 for(let i=0;i<801;i++)b.nodes.push({...text('t'+i),topic:true,x:i*300,y:300});
 b.edges=Array.from({length:800},(_,i)=>({id:'e'+i,kind:'branch',from:'t'+i,to:'t'+(i+1),label:''}));
 const original=clone(b),result=studioDraft(b,d=>{d.nodes=d.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));assert.equal(mergeTexts(d,ids),'n0');});
 assert.equal(result?.nodes.length,802);assert.equal(result?.edges.length,800);assert.deepEqual(b,original);
 assert.ok(reads<30000,`Merge and final validation read ${reads} IDs`);
 const protectedBoard=board(3);protectedBoard.edges=[{id:'branch',kind:'branch',from:'n1',to:'n2',label:''}];
 assert.throws(()=>studioDraft(protectedBoard,d=>mergeTexts(d,new Set(['n0','n1']))),/思维导图/);
});

test('studio overview counts object kinds in one pass while retaining duplicate file semantics',()=>{
 const b=board(1200);let reads=0;const kinds:Card['kind'][]=['card','text','image','section','board','pdf'];
 b.nodes=b.nodes.map((n,i)=>new Proxy({...n,kind:kinds[i%6],file:i%4?'Shared.md':undefined},{get(target,key,receiver){if(key==='kind')reads++;return Reflect.get(target,key,receiver);}}));
 assert.deepEqual(studioStats(b),{objects:1200,edges:0,notes:200,texts:200,images:200,groups:200,uniqueFiles:1,repeatedReferences:899});assert.equal(reads,1200);
});

test('board labels do not allocate an array for the complete multiline text',()=>{
 const n={...text('a'),text:'Heading\r\n'+'Long body\n'.repeat(50000)},split=String.prototype.split;let rows=0;
 String.prototype.split=function(this:string,separator:unknown,limit?:number){const out=Reflect.apply(split,this,[separator,limit]);if(separator==='\n')rows+=out.length;return out;} as typeof split;
 try{assert.equal(nodeName(n),'Heading\r');}finally{String.prototype.split=split;}
 assert.equal(rows,0);assert.equal(nodeName({...n,title:'Explicit'}),'Explicit');assert.equal(nodeName({...n,file:'Folder/Note.md'}),'Note.md');assert.equal(nodeName({...n,text:'\nbody'}),'未命名对象');
});
