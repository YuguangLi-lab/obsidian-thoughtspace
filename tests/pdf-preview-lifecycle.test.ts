import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPdfThumbnail} from '../src/pdf-card';
import {PdfDocumentPool,type PdfApi,type PdfDocumentProxy,type PdfPageProxy} from '../src/pdf-document-pool';
import {RenderQueue} from '../src/rendering';

const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(stage:'load'|'document'|'page'|'render'|'destroy'|'ready'='ready'){
 const gate=deferred<never>(),timers=new Map<number,()=>void>();let clock=0,dispose=()=>{},live=true,created=0,cancelled=0,destroyed=0,appended=0;
 const canvas={width:0,height:0,setAttribute(){},getContext(){return {};},remove(){}};
 const page:PdfPageProxy={getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>({promise:stage==='render'?gate.promise:Promise.resolve(),cancel(){cancelled++;}})};
 const document:PdfDocumentProxy={numPages:2,getPage:()=>stage==='page'?gate.promise:Promise.resolve(page)};
 const api:PdfApi={getDocument:()=>{created++;return{promise:stage==='document'?gate.promise:Promise.resolve(document),destroy:()=>{destroyed++;return stage==='destroy'?gate.promise:Promise.resolve();}};}};
 const load=()=>stage==='load'?gate.promise:Promise.resolve(api);
 const host={ownerDocument:{defaultView:{setTimeout(fn:()=>void){timers.set(++clock,fn);return clock;},clearTimeout(id:number){timers.delete(id);}},createElement:()=>canvas},replaceChildren(){appended++;}} as unknown as HTMLElement;
 return{host,load,gate,timers,document,run:(pool?:PdfDocumentPool)=>renderPdfThumbnail({host,src:'test.pdf',page:1,load,pool,register:fn=>{dispose=fn;},alive:()=>live}),dispose:()=>{live=false;dispose();},stats:()=>({created,cancelled,destroyed,appended,width:canvas.width,height:canvas.height})};
}
async function settled(p:Promise<unknown>){let ended=false;void p.then(()=>{ended=true;},()=>{ended=true;});await tick();return ended;}

for(const phase of ['load','document','page','render'] as const)test(`disposing a stuck PDF ${phase} phase releases its queue slot without worker cooperation`,async()=>{
 const f=fixture(phase),pending=f.run();await tick();f.dispose();assert.equal(await settled(pending),true);assert.equal(await pending,undefined);assert.equal(f.timers.size,0);assert.equal(f.stats().appended,0);assert.equal(f.stats().width,0);
 f.gate.reject(Error('late worker rejection'));await tick();assert.equal(f.stats().appended,0);
});
for(const phase of ['load','document','page','render'] as const)test(`a PDF ${phase} deadline settles and releases preview resources`,async()=>{
 const f=fixture(phase),pending=f.run();await tick();assert.equal(f.timers.size,1);for(const fire of [...f.timers.values()])fire();await assert.rejects(pending,/超时/);assert.equal(f.timers.size,0);assert.equal(f.stats().appended,0);assert.equal(f.stats().width,0);f.gate.reject(Error('late'));await tick();
});
test('a non-settling worker destroy cannot block a completed thumbnail or the next preview',async()=>{
 const f=fixture('destroy'),pending=f.run();assert.equal(await settled(pending),true);assert.deepEqual(await pending,{page:1,total:2});assert.equal(f.stats().destroyed,1);f.dispose();assert.equal(f.stats().destroyed,1);assert.equal(f.stats().width,0);f.gate.reject(Error('late destroy'));await tick();
});
test('failed canvas renders promptly release their backing storage before scope unload',async()=>{
 const f=fixture('render'),pending=f.run();await tick();assert.equal(f.stats().width,600);f.gate.reject(Error('render failed'));await assert.rejects(pending,/render failed/);assert.equal(f.stats().width,0);assert.equal(f.stats().height,0);assert.equal(f.stats().destroyed,1);
});
test('cancelled shared document leases cannot block another card or destroy its document',async()=>{
 const base=fixture('document'),a=fixture(),b=fixture();const pool=new PdfDocumentPool(base.load,{set:()=>1,clear:()=>{}});const pa=a.run(pool),pb=b.run(pool);await tick();a.dispose();assert.equal(await settled(pa),true);assert.equal(await settled(pb),false);assert.equal(base.stats().created,1);assert.equal(base.stats().destroyed,0);b.dispose();assert.equal(await settled(pb),true);pool.clear();assert.equal(base.stats().destroyed,1);base.gate.reject(Error('late document'));await tick();
});
test('cancelled PDF jobs actually make room for queued work at the two-job limit',async()=>{
 const queue=new RenderQueue(2),a=fixture('page'),b=fixture('render');let next=0;
 queue.add(()=>true,async()=>{await a.run();});queue.add(()=>true,async()=>{await b.run();});queue.add(()=>true,async()=>{next++;});await tick();assert.equal(next,0);a.dispose();await tick();assert.equal(next,1);b.dispose();await tick();
});
test('PDF pool cleanup continues when one worker throws synchronously',async()=>{
 const destroyed:string[]=[];const pool=new PdfDocumentPool(async()=>({getDocument:({url})=>({promise:Promise.resolve({numPages:1,getPage:async()=>{throw Error('unused');}}),destroy(){destroyed.push(url);if(url==='bad')throw Error('worker shutdown');return Promise.resolve();}})}),{set:()=>1,clear:()=>{}});
 const a=pool.acquire('bad'),b=pool.acquire('good');await Promise.all([a.document,b.document]);assert.doesNotThrow(()=>pool.clear());assert.deepEqual(destroyed,['bad','good']);a.release();b.release();
});
test('timeout retries open a fresh PDF while another active card can finish on its original document',async()=>{
 const stalled=fixture('document'),fresh=fixture(),a=fixture(),b=fixture(),retry=fixture();let loads=0;
 const pool=new PdfDocumentPool(()=>++loads===1?stalled.load():fresh.load(),{set:()=>1,clear:()=>{}});
 const first=a.run(pool),other=b.run(pool);await tick();for(const fire of [...a.timers.values()])fire();await assert.rejects(first,/超时/);
 assert.equal(stalled.stats().destroyed,0);assert.equal(await settled(other),false);
 assert.deepEqual(await retry.run(pool),{page:1,total:2});assert.equal(loads,2);assert.equal(fresh.stats().appended,0);assert.equal(retry.stats().appended,1);
 stalled.gate.resolve(stalled.document as never);assert.deepEqual(await other,{page:1,total:2});assert.equal(b.stats().appended,1);assert.equal(stalled.stats().destroyed,1);assert.equal(b.timers.size,0);
 a.dispose();b.dispose();retry.dispose();pool.clear();assert.equal(fresh.stats().destroyed,1);
});
test('a thumbnail that starts after its owner is gone performs no I/O or timer allocation',async()=>{
 const f=fixture();f.dispose();assert.equal(await f.run(),undefined);assert.equal(f.stats().created,0);assert.equal(f.timers.size,0);
});
