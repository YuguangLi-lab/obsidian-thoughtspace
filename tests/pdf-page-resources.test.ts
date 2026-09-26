import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPdfThumbnail} from '../src/pdf-card';
import {PdfDocumentPool,type PdfDocumentProxy,type PdfPageProxy} from '../src/pdf-document-pool';

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
async function tick(){for(let i=0;i<24;i++)await Promise.resolve();}
function fixture(options:{delayedPage?:boolean;pendingRender?:boolean;cleanupThrows?:boolean}={}){
 let created=0,destroyed=0,cleanupCalls=0,timerId=0,peak=0;
 const pages=new Map<number,PdfPageProxy>(),resources=new Set<number>(),active=new Map<number,number>(),requestedCleanup=new Set<number>();
 const pageGates:ReturnType<typeof deferred<PdfPageProxy>>[]=[],renders:{page:number;gate:ReturnType<typeof deferred<void>>;cancelled:boolean}[]=[];
 const free=(page:number)=>{if(!active.get(page)&&requestedCleanup.has(page)){resources.delete(page);requestedCleanup.delete(page);}};
 const page=(id:number)=>{let value=pages.get(id);if(!value){value={getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>{
  resources.add(id);peak=Math.max(peak,resources.size);active.set(id,(active.get(id)||0)+1);const gate=deferred<void>(),job={page:id,gate,cancelled:false};renders.push(job);
  const promise=gate.promise.finally(()=>{active.set(id,active.get(id)!-1);free(id);});if(!options.pendingRender)gate.resolve();
  return{promise,cancel:()=>{job.cancelled=true;gate.reject(Error('cancelled'));}};
 },cleanup:()=>{cleanupCalls++;if(options.cleanupThrows)throw Error('page cleanup failed');requestedCleanup.add(id);free(id);}};pages.set(id,value);}return value;};
 const document:PdfDocumentProxy={numPages:100,getPage:id=>{if(options.delayedPage){const gate=deferred<PdfPageProxy>();pageGates.push(gate);return gate.promise;}return Promise.resolve(page(id));}};
 const load=async()=>({getDocument:()=>{created++;return{promise:Promise.resolve(document),destroy:async()=>{destroyed++;resources.clear();}};}});
 const idleTimers=new Map<number,()=>void>(),pool=new PdfDocumentPool(load,{set:fn=>{idleTimers.set(++timerId,fn);return timerId;},clear:id=>{idleTimers.delete(id);}});
 const host=()=>{let connected=true,dispose=()=>{},appended=0;const sizes:{width:number;height:number}[]=[],timers=new Map<number,()=>void>(),canvas={width:0,height:0,setAttribute(){},getContext:()=>({}),remove(){}};
  const element={ownerDocument:{defaultView:{setTimeout:(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:(id:number)=>{timers.delete(id);}},createElement:()=>canvas},replaceChildren(){appended++;}} as unknown as HTMLElement;
  return{run:(id=1)=>renderPdfThumbnail({host:element,src:'same.pdf',page:id,load,pool,register:fn=>{dispose=fn;},alive:()=>connected,onSize:size=>sizes.push(size)}),dispose:()=>{connected=false;dispose();},timers,canvas,sizes,get appended(){return appended;}};
 };
 return{pool,page,pageGates,renders,host,resources,stats:()=>({created,destroyed,cleanupCalls,peak})};
}

test('continuous PDF page flips release page caches while retaining one warm document',async t=>{
 const f=fixture();try{for(let page=1;page<=30;page++){const host=f.host();assert.deepEqual(await host.run(page),{page,total:100});assert.deepEqual(host.sizes,[{width:600,height:800}]);assert.equal(host.canvas.width,600);assert.equal(host.canvas.height,800);host.dispose();}
  t.diagnostic(`30 rendered pages: ${f.resources.size} retained page caches, peak ${f.stats().peak}`);assert.equal(f.resources.size,0);assert.equal(f.stats().peak,1);assert.deepEqual(f.stats(),{created:1,destroyed:0,cleanupCalls:30,peak:1});
 }finally{f.pool.clear();}
});

test('same-page cleanup waits for the other card render and never destroys its document',async()=>{
 const f=fixture({pendingRender:true}),a=f.host(),b=f.host();try{const first=a.run(),second=b.run();await tick();assert.equal(f.renders.length,2);f.renders[0].gate.resolve();await first;assert.equal(f.stats().cleanupCalls,1);assert.equal(f.resources.size,1);assert.equal(f.stats().destroyed,0);assert.equal(b.appended,0);f.renders[1].gate.resolve();await second;assert.equal(f.resources.size,0);assert.equal(f.stats().cleanupCalls,2);assert.equal(b.appended,1);}finally{a.dispose();b.dispose();f.pool.clear();}
});

for(const outcome of ['cancel','failure','timeout'] as const)test(`PDF ${outcome} releases page resources without waiting for scope teardown`,async()=>{
 const f=fixture({pendingRender:true}),host=f.host(),pending=host.run();try{await tick();assert.equal(f.resources.size,1);
  if(outcome==='cancel')host.dispose();else if(outcome==='failure')f.renders[0].gate.reject(Error('render failed'));else for(const fire of [...host.timers.values()])fire();
  if(outcome==='cancel')assert.equal(await pending,undefined);else await assert.rejects(pending,outcome==='failure'?/render failed/:/超时/);
  await tick();assert.equal(f.stats().cleanupCalls,1);assert.equal(f.resources.size,0);assert.equal(host.appended,0);assert.equal(host.canvas.width,0);assert.equal(host.timers.size,0);
 }finally{host.dispose();f.pool.clear();}
});

for(const outcome of ['cancel','timeout'] as const)test(`a page arriving after PDF ${outcome} is cleaned without render or late append`,async()=>{
 const f=fixture({delayedPage:true}),host=f.host(),pending=host.run();try{await tick();assert.equal(f.pageGates.length,1);if(outcome==='cancel')host.dispose();else for(const fire of [...host.timers.values()])fire();
  if(outcome==='cancel')assert.equal(await pending,undefined);else await assert.rejects(pending,/超时/);assert.equal(f.stats().cleanupCalls,0);
  f.pageGates[0].resolve(f.page(1));await tick();assert.equal(f.stats().cleanupCalls,1);assert.equal(f.renders.length,0);assert.equal(host.appended,0);assert.equal(host.timers.size,0);
 }finally{host.dispose();f.pool.clear();}
});

test('optional failing PDF page cleanup cannot lose a finished canvas or pooled lease',async()=>{
 const f=fixture({cleanupThrows:true}),host=f.host();try{assert.deepEqual(await host.run(),{page:1,total:100});assert.equal(f.stats().cleanupCalls,1);assert.equal(host.appended,1);assert.equal(host.canvas.width,600);host.dispose();assert.equal(f.stats().cleanupCalls,1);f.pool.clear();assert.equal(f.stats().destroyed,1);}finally{host.dispose();f.pool.clear();}
});
