import test from 'node:test';
import assert from 'node:assert/strict';
import {PdfDocumentPool,type PdfApi,type PdfDocumentProxy} from '../src/pdf-document-pool';

const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const document=(numPages:number):PdfDocumentProxy=>({numPages,getPage:async()=>{throw Error('unused');}});
function fixture(){
 let created=0,clock=0;const destroyed:number[]=[],gates:Array<ReturnType<typeof deferred<PdfDocumentProxy>>>=[],timers=new Map<number,()=>void>();
 const pool=new PdfDocumentPool(async()=>({getDocument(){const id=++created,gate=deferred<PdfDocumentProxy>();gates.push(gate);return{promise:gate.promise,destroy:async()=>{destroyed.push(id);}};}}),{set:fn=>{timers.set(++clock,fn);return clock;},clear:id=>{timers.delete(id);}});
 return{pool,gates,timers,destroyed,created:()=>created};
}

test('retiring a stuck document allows an immediate fresh attempt and rejects late cache resurrection',async()=>{
 const f=fixture(),old=f.pool.acquire('same.pdf');await tick();old.retire();old.release();old.retire();old.release();assert.deepEqual(f.destroyed,[1]);assert.equal(f.timers.size,0);
 const retry=f.pool.acquire('same.pdf');await tick();assert.equal(f.created(),2);const replacement=document(2);f.gates[1].resolve(replacement);assert.equal(await retry.document,replacement);
 f.gates[0].resolve(document(1));await old.document;const later=f.pool.acquire('same.pdf');assert.equal(await later.document,replacement);assert.equal(f.created(),2);
 later.release();retry.release();f.pool.clear();assert.deepEqual(f.destroyed,[1,2]);
});

test('retirement preserves every active old lease until its final release without evicting the replacement',async()=>{
 const f=fixture(),a=f.pool.acquire('same.pdf'),b=f.pool.acquire('same.pdf');await tick();a.retire();a.release();assert.deepEqual(f.destroyed,[]);
 const replacement=f.pool.acquire('same.pdf');await tick();assert.equal(f.created(),2);const oldDoc=document(1),newDoc=document(2);f.gates[0].resolve(oldDoc);f.gates[1].resolve(newDoc);
 assert.equal(await b.document,oldDoc);assert.equal(await replacement.document,newDoc);assert.deepEqual(f.destroyed,[]);b.release();assert.deepEqual(f.destroyed,[1]);
 const reused=f.pool.acquire('same.pdf');assert.equal(await reused.document,newDoc);assert.equal(f.created(),2);reused.release();replacement.release();f.pool.clear();assert.deepEqual(f.destroyed,[1,2]);
});

test('a retired document late rejection destroys only its own task and leaves the replacement cached',async()=>{
 const f=fixture(),old=f.pool.acquire('same.pdf');await tick();old.retire();const replacement=f.pool.acquire('same.pdf');await tick();f.gates[1].resolve(document(2));await replacement.document;
 const rejected=assert.rejects(old.document,/late worker failure/);f.gates[0].reject(Error('late worker failure'));await rejected;assert.deepEqual(f.destroyed,[1]);old.release();
 const reused=f.pool.acquire('same.pdf');assert.equal((await reused.document).numPages,2);assert.equal(f.created(),2);reused.release();replacement.release();f.pool.clear();assert.deepEqual(f.destroyed,[1,2]);
});

test('a retired API load with no remaining lease never starts a late worker',async()=>{
 const loads:Array<ReturnType<typeof deferred<PdfApi>>>=[];let created=0,destroyed=0;const api:PdfApi={getDocument(){created++;return{promise:Promise.resolve(document(2)),destroy:async()=>{destroyed++;}};}};
 const pool=new PdfDocumentPool(()=>{const gate=deferred<PdfApi>();loads.push(gate);return gate.promise;},{set:()=>1,clear:()=>{}});
 const old=pool.acquire('same.pdf');old.retire();old.release();const replacement=pool.acquire('same.pdf');loads[1].resolve(api);await replacement.document;loads[0].resolve(api);await assert.rejects(old.document,/取消/);assert.equal(created,1);
 replacement.release();pool.clear();assert.equal(destroyed,1);
});

test('pool clear covers multiple retired generations and remains idempotent despite worker teardown faults',async()=>{
 let created=0;const destroyed:number[]=[];const pool=new PdfDocumentPool(async()=>({getDocument(){const id=++created;return{promise:Promise.resolve(document(id)),destroy(){destroyed.push(id);if(id===2)throw Error('worker shutdown');return new Promise<void>(()=>{});}};}}),{set:()=>1,clear:()=>{}});
 const first=pool.acquire('same.pdf');await first.document;first.retire();const second=pool.acquire('same.pdf');await second.document;second.retire();const current=pool.acquire('same.pdf');await current.document;
 assert.doesNotThrow(()=>pool.clear());assert.deepEqual([...destroyed].sort(),[1,2,3]);pool.clear();first.release();second.release();current.release();first.retire();assert.equal(destroyed.length,3);assert.throws(()=>pool.acquire('same.pdf'),/已关闭/);
});

test('retiring an already idle lease removes its timer and destroys it immediately',async()=>{
 const f=fixture(),old=f.pool.acquire('same.pdf');await tick();f.gates[0].resolve(document(1));await old.document;old.release();assert.equal(f.timers.size,1);old.retire();assert.equal(f.timers.size,0);assert.deepEqual(f.destroyed,[1]);f.pool.clear();assert.deepEqual(f.destroyed,[1]);
});
