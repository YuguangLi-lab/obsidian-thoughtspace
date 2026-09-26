import test from 'node:test';
import assert from 'node:assert/strict';
import {PdfDocumentPool,type PdfApi} from '../src/pdf-document-pool';

test('closing PDF cards in reverse order examines only idle eviction candidates',async t=>{
 let clock=0;const destroyed:string[]=[],timers=new Map<number,()=>void>();
 const api:PdfApi={getDocument:({url})=>({promise:Promise.resolve({numPages:1,getPage:async()=>{throw Error('unused');}}),destroy:async()=>{destroyed.push(url);}})};
 const pool=new PdfDocumentPool(async()=>api,{set:fn=>{timers.set(++clock,fn);return clock;},clear:id=>{timers.delete(id);}});
 const leases=Array.from({length:128},(_,i)=>pool.acquire('doc-'+i));await Promise.all(leases.map(lease=>lease.document));
 const iterator=Map.prototype[Symbol.iterator];let visits=0;
 Object.defineProperty(Map.prototype,Symbol.iterator,{value:function*(this:Map<unknown,unknown>){for(const entry of Reflect.apply(iterator,this,[]) as Iterable<[unknown,unknown]>){visits++;yield entry;}}});
 try{for(let i=leases.length-1;i>=0;i--)leases[i].release();}finally{Object.defineProperty(Map.prototype,Symbol.iterator,{value:iterator});}
 assert.deepEqual(destroyed,Array.from({length:126},(_,i)=>'doc-'+(127-i)));assert.equal(timers.size,2);pool.clear();assert.equal(timers.size,0);assert.equal(destroyed.length,128);
 t.diagnostic(`128 reverse PDF releases: ${visits} eviction candidates`);assert.ok(visits<=256,`visited ${visits} candidates instead of only idle entries`);
});

test('idle candidates keep acquisition LRU rather than release order',async()=>{
 const destroyed:string[]=[],created:string[]=[];let timer=0;
 const pool=new PdfDocumentPool(async()=>({getDocument:({url})=>{created.push(url);return{promise:Promise.resolve({numPages:1,getPage:async()=>{throw Error('unused');}}),destroy:async()=>{destroyed.push(url);}};}}),{set:()=>++timer,clear:()=>{}},4);
 const a=pool.acquire('a'),b=pool.acquire('b'),c=pool.acquire('c'),d=pool.acquire('d');await Promise.all([a.document,b.document,c.document,d.document]);d.release();b.release();c.release();
 const e=pool.acquire('e');await e.document;assert.deepEqual(destroyed,['b']);
 const again=pool.acquire('c');await again.document;again.release();const f=pool.acquire('f');await f.document;assert.deepEqual(destroyed,['b','d']);assert.equal(created.filter(name=>name==='c').length,1);
 a.release();e.release();f.release();pool.clear();assert.equal(new Set(destroyed).size,6);assert.equal(destroyed.length,6);
});
