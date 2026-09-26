import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';

// Exercise async renderer ownership with a controlled host; no Obsidian runtime in Node.
function fixture(size={width:300,height:180},options:{math?:boolean|'container';setupFailure?:'load'|'holder'|'clone'}={}){
 const jobs:{resolve:()=>void;reject:(error:Error)=>void;scope:Scope;value:string}[]=[],mathJobs:{resolve:()=>void;reject:(error:Error)=>void}[]=[],holders:any[]=[],applied:any[]=[],scopes:Scope[]=[];
 const timers=new Map<number,{run:()=>void;delay:number}>();let timerId=0,measurements=0,globalTimers=0;
 const win={setTimeout:(run:()=>void,delay:number)=>{const id=timerId++;timers.set(id,{run,delay});return id;},clearTimeout:(id:number)=>timers.delete(id)};
 const probe=()=>{if(options.setupFailure==='clone')throw Error('clone failed');return{value:'',querySelectorAll:()=>[],querySelector:(selector:string)=>(options.math==='container'?selector==='mjx-container':options.math&&selector==='.math')?{}:null};};
 const preview={isConnected:true,ownerDocument:{defaultView:win},cloneNode:probe,parentElement:{createDiv:()=>{if(options.setupFailure==='holder')throw Error('holder failed');const holder={removed:false,appendChild:()=>{},remove(){this.removed=true;}};holders.push(holder);return holder;}}};
 class Scope{loaded=false;unloads=0;cleanups:(()=>void)[]=[];children:Scope[]=[];constructor(){scopes.push(this);}register(fn:()=>void){this.cleanups.push(fn);}addChild(child:Scope){this.children.push(child);if(this.loaded)child.load();return child;}load(){this.loaded=true;if(options.setupFailure==='load')throw Error('load failed');}unload(){this.loaded=false;this.unloads++;for(const child of this.children.splice(0))child.unload();for(const fn of this.cleanups.splice(0))fn();}}
 const imports:Record<string,unknown>={'./editor-cleanup':{releaseEditorResource},obsidian:{Component:Scope,MarkdownRenderer:{render:(_:unknown,value:string,node:any,_path:string,scope:Scope)=>{node.value=value;return new Promise<void>((resolve,reject)=>jobs.push({resolve,reject,scope,value}));}},finishRenderMath:()=>new Promise<void>((resolve,reject)=>mathJobs.push({resolve,reject}))},'./excerpt-sources':{excerptPresentation:(body:string)=>({body})},'./rendering':{markdownPreview:(body:string)=>body},'./workspace-tools':{measureNoteCard:()=>{measurements++;return size;}}};
 const scopeModule={exports:{}};new Function('require','module','exports',transformSync(readFileSync('src/preview-render-scope.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],scopeModule,scopeModule.exports);imports['./preview-render-scope']=scopeModule.exports;
 const module={exports:{} as any};new Function('require','module','exports','window',transformSync(readFileSync('src/inline-card-fit.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports,{...win,setTimeout:(run:()=>void,delay:number)=>{globalTimers++;return win.setTimeout(run,delay);}});
 const fit=new module.exports.InlineCardFit({},preview,'note.md',undefined,(size:any)=>applied.push(size));return{fit,jobs,mathJobs,holders,applied,scopes,timers,preview,get measurements(){return measurements;},get globalTimers(){return globalTimers;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('card measurements await direct MathJax containers before reading geometry',async()=>{
 const f=fixture(undefined,{math:'container'});f.fit.schedule('$x$');const pending=f.fit.flush();f.jobs[0].resolve();await tick();assert.equal(f.mathJobs.length,1);assert.equal(f.measurements,0);f.mathJobs[0].resolve();await pending;assert.equal(f.measurements,1);assert.equal(f.applied.length,1);f.fit.dispose();
});

test('stale renderer completion cannot resize the latest draft',async()=>{
 const {fit,jobs,holders,applied}=fixture();fit.schedule('older');const pending=fit.flush();fit.schedule('latest');jobs[0].resolve();await tick();assert.equal(applied.length,0);assert.equal(jobs.length,2);jobs[1].resolve();await pending;assert.deepEqual(applied,[{width:300,height:180}]);assert.ok(holders.every(h=>h.removed));fit.dispose();
});
test('dispose releases render components and detached measurement DOM before renderer resolves',async()=>{
 const {fit,jobs,holders,applied}=fixture();fit.schedule('draft');const pending=fit.flush();assert.equal(jobs[0].scope.loaded,true);fit.dispose();assert.equal(jobs[0].scope.loaded,false);assert.equal(holders[0].removed,true);jobs[0].resolve();await pending;assert.equal(applied.length,0);
});
test('unchanged content avoids a second render and unchanged size avoids a second layout',async()=>{
 const {fit,jobs,applied}=fixture();fit.schedule('one');let pending=fit.flush();jobs[0].resolve();await pending;fit.schedule('one');await fit.flush();assert.equal(jobs.length,1);fit.schedule('two');pending=fit.flush();jobs[1].resolve();await pending;assert.equal(jobs.length,2);assert.equal(applied.length,1);fit.dispose();
});
test('appearance changes invalidate an unchanged draft measurement',async()=>{
 const {fit,jobs,applied}=fixture();fit.schedule('same');let pending=fit.flush();jobs[0].resolve();await pending;
 fit.schedule('same',true);pending=fit.flush();assert.equal(jobs.length,2);jobs[1].resolve();await pending;
 assert.equal(applied.length,1);fit.dispose();
});
test('old font measurement cannot apply after appearance changes during rendering',async()=>{
 const {fit,jobs,applied}=fixture();fit.schedule('same');const pending=fit.flush();fit.schedule('same',true);jobs[0].resolve();await tick();assert.equal(applied.length,0);assert.equal(jobs.length,2);jobs[1].resolve();await pending;assert.equal(applied.length,1);fit.dispose();
});

test('failed measurement scope cleanup still removes its holder and cancels future work',async(t)=>{
 const warnings:unknown[]=[];t.mock.method(console,'warn',(...args:unknown[])=>warnings.push(args));
 const {fit,jobs,holders,applied}=fixture();fit.schedule('draft');const pending=fit.flush();let calls=0;jobs[0].scope.unload=()=>{calls++;throw Error('scope cleanup failed');};fit.schedule('newer');
 fit.dispose();fit.dispose();assert.equal(holders[0].removed,true);assert.equal(fit.timer,undefined);assert.equal(calls,1);assert.equal(warnings.length,1);
 jobs[0].resolve();await pending;assert.equal(calls,1);assert.equal(jobs.length,1);assert.equal(applied.length,0);
});

test('invalid dimensions never leave the async draft measurement boundary',async()=>{for(const size of [{width:300,height:NaN},{width:Infinity,height:180},{width:0,height:180}]){const {fit,jobs,applied}=fixture(size);fit.schedule('draft');const pending=fit.flush();jobs[0].resolve();await pending;assert.equal(applied.length,0);fit.dispose();}});

test('card measurement uses the owner window and cancels timer zero when drafts coalesce',async()=>{
 const f=fixture();f.fit.schedule('one');f.fit.schedule('two');assert.equal(f.timers.size,1);assert.equal(f.globalTimers,0);
 const pending=f.fit.flush();assert.deepEqual([...f.timers.values()].map(t=>t.delay),[1000]);assert.equal(f.jobs[0].value,'two');f.jobs[0].resolve();await pending;assert.equal(f.timers.size,0);f.fit.dispose();
});
test('closing a card settles pending fit without waiting for an unresponsive renderer',async()=>{
 const f=fixture();f.fit.schedule('draft');let settled=false;const pending=f.fit.flush().then(()=>{settled=true;});f.fit.dispose();await tick();const settledBeforeRenderer=settled;
 f.jobs[0].resolve();await pending;assert.equal(settledBeforeRenderer,true);assert.equal(f.applied.length,0);assert.equal(f.scopes[0].unloads,1);assert.equal(f.timers.size,0);
});
test('a superseded card draft releases the queue and ignores its late deadline and result',async()=>{
 const f=fixture();f.fit.schedule('old');const pending=f.fit.flush();
 const deadline=[...f.timers.values()].find(timer=>timer.delay===1000);if(!deadline){f.fit.dispose();f.jobs[0].resolve();await pending;assert.fail('card measurement must have a deadline');}
 f.fit.schedule('latest');const concurrent=f.fit.flush();
 deadline.run();await tick();assert.equal(f.jobs.length,2);assert.equal(f.holders[0].removed,true);assert.equal(f.jobs[1].value,'latest');f.jobs[1].resolve();await Promise.all([pending,concurrent]);
 assert.equal(f.applied.length,1);f.jobs[0].resolve();await tick();assert.equal(f.applied.length,1);assert.ok(f.scopes.every(scope=>scope.unloads===1));assert.equal(f.timers.size,0);f.fit.dispose();
});
test('card formula sizing waits for native typesetting and shares the renderer deadline',async()=>{
 const f=fixture(undefined,{math:true});f.fit.schedule('$$x^2$$');const pending=f.fit.flush();const deadline=[...f.timers.keys()];f.jobs[0].resolve();await tick();
 assert.equal(f.mathJobs.length,1);assert.equal(f.measurements,0);assert.deepEqual([...f.timers.keys()],deadline);f.mathJobs[0].resolve();await pending;assert.equal(f.applied.length,1);assert.equal(f.timers.size,0);f.fit.dispose();
});
test('closing or timing out during card typesetting never applies partial formula dimensions',async()=>{
 for(const mode of ['close','timeout']){const f=fixture(undefined,{math:true});f.fit.schedule('$x$');const pending=f.fit.flush();f.jobs[0].resolve();await tick();
  assert.equal(f.mathJobs.length,1);if(mode==='close')f.fit.dispose();else [...f.timers.values()].find(t=>t.delay===1000)!.run();await pending;assert.equal(f.measurements,0);assert.equal(f.holders[0].removed,true);
  f.mathJobs[0].resolve();await tick();assert.equal(f.applied.length,0);assert.equal(f.timers.size,0);f.fit.dispose();}
});
test('card measurement setup failures release partially acquired resources and allow a later draft',async()=>{
 for(const setupFailure of ['load','holder','clone'] as const){const f=fixture(undefined,{setupFailure});f.fit.schedule('draft');await assert.doesNotReject(f.fit.flush());assert.ok(f.scopes.every(scope=>!scope.loaded&&scope.unloads===1));assert.ok(f.holders.every(holder=>holder.removed));assert.equal(f.applied.length,0);f.fit.dispose();}
 const f=fixture();f.fit.schedule('bad');let pending=f.fit.flush();f.jobs[0].reject(Error('renderer failed'));await pending;f.fit.schedule('good');pending=f.fit.flush();f.jobs[1].resolve();await pending;assert.equal(f.applied.length,1);assert.ok(f.holders.every(holder=>holder.removed));f.fit.dispose();
});
test('detached cards skip measurement and reparented cards reject a stale frame',async()=>{
 const detached=fixture();detached.preview.isConnected=false;detached.fit.schedule('draft');const pending=detached.fit.flush();if(detached.jobs[0])detached.jobs[0].resolve();await pending;assert.equal(detached.jobs.length,0);assert.equal(detached.scopes.length,0);detached.fit.dispose();
 const f=fixture();f.fit.schedule('draft');const measuring=f.fit.flush();f.preview.parentElement={createDiv:()=>{throw Error('unexpected');}};f.jobs[0].resolve();await measuring;assert.equal(f.applied.length,0);assert.equal(f.holders[0].removed,true);f.fit.dispose();
});
