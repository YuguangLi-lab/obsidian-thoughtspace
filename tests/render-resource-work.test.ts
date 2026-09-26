import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionPath} from '../src/connections';
import {nodeRenderKey} from '../src/node-render-key';
import {PdfDocumentPool,type PdfApi} from '../src/pdf-document-pool';
import type {Card} from '../src/model';

const node=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,x,y,width:200,height:120,color:'blue'});
test('moving elbow routes collect unique segments without intermediate filter, slice and map arrays',t=>{
 const a=node('a'),b=node('b',450,300),original={filter:Array.prototype.filter,slice:Array.prototype.slice,map:Array.prototype.map};
 const calls={filter:0,slice:0,map:0};
 for(const key of ['filter','slice','map'] as const)Object.defineProperty(Array.prototype,key,{value:function(this:unknown[],...args:unknown[]){calls[key]++;return Reflect.apply(original[key],this,args);}});
 try{for(let frame=0;frame<120;frame++){b.x+=.125;const route=connectionPath(a,b,{style:'elbow',fromSide:'right',toSide:'left'});assert.ok(!/NaN|Infinity/.test(route.path));}}
 finally{for(const key of ['filter','slice','map'] as const)Object.defineProperty(Array.prototype,key,{value:original[key]});}
 t.diagnostic(`120 moving elbow routes: ${JSON.stringify(calls)}`);assert.deepEqual(calls,{filter:0,slice:0,map:0});
});

test('render keys do not read fields which only affect position and independent paint',t=>{
 const source:Card={...node('note'),kind:'card',file:'note.md',fillColor:'none',transparent:true,textColor:'rose',customBorder:true,borderStyle:'dashed'};
 const omitted=new Set(['x','y','width','height','color','fillColor','transparent','textColor','customBorder','borderStyle']);let reads=0;
 const watched=new Proxy(source,{get(target,key,receiver){if(omitted.has(String(key)))reads++;return Reflect.get(target,key,receiver);}});
 for(let frame=0;frame<120;frame++)assert.equal(nodeRenderKey(watched,[true]),'[{"id":"note","kind":"card","text":"note","file":"note.md"},true]');
 t.diagnostic(`120 fixed-note key builds: ${reads} unused property reads`);assert.equal(reads,0);
});

test('render keys preserve enumerable own fields, property order and nested metadata',()=>{
 const source=Object.assign(Object.create({inherited:'ignore'}),node('n'),{text:'正文',properties:{x:12,color:'must keep'},sectionFill:'blue'});
 Object.defineProperty(source,'__proto__',{value:{safe:'own'},enumerable:true});Object.defineProperty(source,'hidden',{value:'ignore',enumerable:false});
 const context=[{x:1,color:'blue'},undefined,source.properties];
 const actual=JSON.parse(nodeRenderKey(source,context));
 assert.deepEqual(actual,[{id:'n',kind:'text',text:'正文',width:200,height:120,properties:{x:12,color:'must keep'},sectionFill:'blue',...JSON.parse('{"__proto__":{"safe":"own"}}')},{x:1,color:'blue'},null,{x:12,color:'must keep'}]);
 assert.equal(Object.hasOwn(actual[0],'inherited'),false);assert.equal(Object.hasOwn(actual[0],'hidden'),false);assert.equal(Object.getPrototypeOf(source).inherited,'ignore');
});

function poolFixture(limit=2){
 let clock=0;const destroyed:string[]=[],created:string[]=[],timers=new Map<number,()=>void>();
 const api:PdfApi={getDocument:({url})=>{created.push(url);return{promise:Promise.resolve({numPages:2,getPage:async()=>{throw Error('unused');}}),destroy:async()=>{destroyed.push(url);}};}};
 const pool=new PdfDocumentPool(async()=>api,{set(fn){timers.set(++clock,fn);return clock;},clear(id){timers.delete(id);}},limit);
 return{pool,destroyed,created,timers};
}
test('PDF acquisition skips eviction scans while every document is actively leased',async t=>{
 const f=poolFixture(),iterator=Map.prototype[Symbol.iterator];let visits=0;
 Object.defineProperty(Map.prototype,Symbol.iterator,{value:function*(this:Map<unknown,unknown>){for(const item of Reflect.apply(iterator,this,[]) as Iterable<[unknown,unknown]>){visits++;yield item;}}});
 let leases:ReturnType<PdfDocumentPool['acquire']>[]=[];
 try{leases=Array.from({length:128},(_,i)=>f.pool.acquire('page'+i+'.pdf'));await Promise.all(leases.map(lease=>lease.document));}
 finally{Object.defineProperty(Map.prototype,Symbol.iterator,{value:iterator});}
 const premature=f.destroyed.length;for(const lease of leases)lease.release();f.pool.clear();
 t.diagnostic(`128 active PDF documents: ${visits} eviction candidates visited`);assert.equal(visits,0);assert.equal(premature,0);assert.equal(f.destroyed.length,128);assert.equal(f.timers.size,0);
});

test('PDF release and reacquire preserve original LRU order when releases arrive out of order',async()=>{
 const f=poolFixture(),a=f.pool.acquire('a'),b=f.pool.acquire('b'),c=f.pool.acquire('c');await Promise.all([a.document,b.document,c.document]);
 c.release();assert.deepEqual(f.destroyed,['c']);b.release();a.release();assert.equal(f.timers.size,2);
 const again=f.pool.acquire('a');await again.document;again.release();const d=f.pool.acquire('d');await d.document;assert.deepEqual(f.destroyed,['c','b']);
 d.release();assert.equal(f.timers.size,2);for(const fire of [...f.timers.values()])fire();assert.deepEqual(f.destroyed,['c','b','a','d']);assert.equal(f.timers.size,0);
 const e=f.pool.acquire('e');await e.document;e.release();f.pool.clear();assert.deepEqual(f.destroyed,['c','b','a','d','e']);
});

test('retired idle PDF generations cannot disturb replacement eviction accounting',async()=>{
 const f=poolFixture(),old=f.pool.acquire('same');await old.document;old.release();old.retire();assert.deepEqual(f.destroyed,['same']);assert.equal(f.timers.size,0);
 const next=f.pool.acquire('same'),other=f.pool.acquire('other');await Promise.all([next.document,other.document]);old.retire();old.release();next.retire();next.release();assert.deepEqual(f.destroyed,['same','same']);
 const fresh=f.pool.acquire('same');await fresh.document;other.release();fresh.release();const third=f.pool.acquire('third');await third.document;assert.deepEqual(f.destroyed,['same','same','other']);third.release();f.pool.clear();assert.equal(f.destroyed.length,5);assert.equal(f.timers.size,0);
});
