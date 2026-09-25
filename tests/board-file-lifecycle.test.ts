import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async onLoadFile(file:'),end=source.indexOf('\n  private point(',start);
const View=new Function('act','report','fitTextNode',transformSync('class BoardView{'+source.slice(start,end)+'};return BoardView',{loader:'ts'}).code)((run:()=>unknown)=>{void run();},()=>{},()=>{});
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function session(path:string){return{file:{path},board:{nodes:[]},listeners:new Set<()=>void>(),flush:async()=>{},blocked:false};}
function fixture(){
 const requests:Array<{file:{path:string};gate:ReturnType<typeof deferred<ReturnType<typeof session>>>}>=[],released:ReturnType<typeof session>[]=[],docks:Array<ReturnType<typeof deferred<void>>>=[];
 const counts={paint:0,clear:0,errors:0,refresh:0,current:0};let delayDock=false,current:unknown;
 const view=new View(),plugin={session:(file:{path:string})=>{const gate=deferred<ReturnType<typeof session>>();requests.push({file,gate});return gate.promise;},release:async(s:ReturnType<typeof session>)=>{released.push(s);},ensureDock:()=>{const gate=deferred<void>();docks.push(gate);if(!delayDock)gate.resolve();return gate.promise;},refreshDock(){counts.refresh++;},clearMaterialDrag(){},get currentBoard(){return current;},set currentBoard(value:unknown){current=value;counts.current++;}};
 Object.assign(view,{plugin,closed:false,file:{path:'a.thoughtspace'},dialogEpoch:0,sidebarRun:0,renderFrame:0,blankClicks:{cancel(){}},finishMarquee(){},setSectionTool(){},syncSelectionTool(){},viewTrail:{clear(){}},outlineCollapsed:new Set(),clearNodes(){counts.clear++;},selected:new Set(),stage:{removeClass(){}},svg:{isConnected:true},contentEl:{querySelectorAll:()=>[],ownerDocument:{defaultView:{cancelAnimationFrame(){}}}},app:{workspace:{getActiveViewOfType:()=>view}},paint(){counts.paint++;},finishInlineForNavigation:async()=>{},clearCanvasGesture(){},world:{style:{removeProperty(){}},empty(){},createDiv(){counts.errors++;}},status:{setText(){}}});
 const load=(path:string)=>{view.file={path};const pending=view.onLoadFile(view.file);return{pending,request:requests.at(-1)!};};
 const ready=async(path:string)=>{const loading=load(path),s=session(path);loading.request.gate.resolve(s);await loading.pending;return s;};
 return{view,plugin,requests,released,docks,counts,load,ready,delayDock:()=>{delayDock=true;}};
}

for(const transition of ['onClose','onUnloadFile'] as const)test(`a session arriving after ${transition} is released without attaching or painting`,async()=>{
 const f=fixture(),loading=f.load('a.thoughtspace');await f.view[transition]();const s=session('a.thoughtspace');loading.request.gate.resolve(s);await loading.pending;
 assert.equal(s.listeners.size,0);assert.equal(f.view.session,undefined);assert.equal(f.counts.paint,0);assert.deepEqual(f.released,[s]);
});

test('an older successful load cannot replace the newer file session or retain its listener',async()=>{
 const f=fixture(),old=f.load('a.thoughtspace'),latest=await f.ready('b.thoughtspace'),s=session('a.thoughtspace');old.request.gate.resolve(s);await old.pending;
 assert.equal(f.view.session,latest);assert.equal(latest.listeners.size,1);assert.equal(s.listeners.size,0);assert.equal(f.counts.paint,1);assert.deepEqual(f.released,[s]);
});

test('an obsolete read rejection cannot clear a newer board or report its old error',async()=>{
 const f=fixture(),old=f.load('a.thoughtspace'),latest=await f.ready('b.thoughtspace');old.request.gate.reject(Error('old failed read'));await old.pending;
 assert.equal(f.view.session,latest);assert.equal(latest.listeners.size,1);assert.equal(f.counts.errors,0);
});

for(const failed of [false,true])test(`obsolete dock ${failed?'rejection':'completion'} cannot mutate the replacement board`,async()=>{
 const f=fixture();f.delayDock();const old=f.load('a.thoughtspace'),a=session('a.thoughtspace');old.request.gate.resolve(a);await Promise.resolve();assert.equal(f.docks.length,1);
 const next=f.load('b.thoughtspace'),b=session('b.thoughtspace');next.request.gate.resolve(b);await Promise.resolve();f.docks[1].resolve();await next.pending;const counts={...f.counts};
 if(failed)f.docks[0].reject(Error('old dock error'));else f.docks[0].resolve();await old.pending;
 assert.equal(f.view.session,b);assert.equal(a.listeners.size,0);assert.equal(b.listeners.size,1);assert.deepEqual(f.counts,counts);assert.deepEqual(f.released,[a]);
});

test('a current load failure after subscription releases its acquired session exactly once',async()=>{
 const f=fixture();f.delayDock();const loading=f.load('a.thoughtspace'),s=session('a.thoughtspace');loading.request.gate.resolve(s);await Promise.resolve();f.docks[0].reject(Error('dock error'));await loading.pending;
 assert.equal(s.listeners.size,0);assert.equal(f.view.session,undefined);assert.deepEqual(f.released,[s]);assert.equal(f.counts.errors,1);await f.view.onClose();assert.deepEqual(f.released,[s]);
});

test('unload waiting for draft completion cannot clear the newer session or its subscription',async()=>{
 const f=fixture(),a=await f.ready('a.thoughtspace'),navigation=deferred<void>();f.view.finishInlineForNavigation=()=>navigation.promise;const unloading=f.view.onUnloadFile(),b=await f.ready('b.thoughtspace'),counts={...f.counts};navigation.resolve();await unloading;
 assert.equal(f.view.session,b);assert.equal(a.listeners.size,0);assert.equal(b.listeners.size,1);assert.deepEqual(f.counts,counts);assert.deepEqual(f.released,[a]);
});

test('unload waiting for the original flush never clears a later session',async()=>{
 const f=fixture(),a=await f.ready('a.thoughtspace'),flush=deferred<void>();a.flush=()=>flush.promise;const unloading=f.view.onUnloadFile();await Promise.resolve();const b=await f.ready('b.thoughtspace'),counts={...f.counts};flush.resolve();await unloading;
 assert.equal(f.view.session,b);assert.equal(b.listeners.size,1);assert.deepEqual(f.counts,counts);assert.deepEqual(f.released,[a]);
});

test('closing claims file-load ownership immediately while still allowing the draft exit to finish',async()=>{
 const f=fixture(),navigation=deferred<void>(),loading=f.load('a.thoughtspace');f.view.finishInlineForNavigation=()=>navigation.promise;const closing=f.view.onClose(),blocked=f.view.onLoadFile({path:'b.thoughtspace'});assert.equal(f.requests.length,1);await blocked;
 const s=session('a.thoughtspace');loading.request.gate.resolve(s);await loading.pending;assert.equal(s.listeners.size,0);assert.equal(f.view.closed,false);navigation.resolve();await closing;assert.equal(f.view.closed,true);assert.deepEqual(f.released,[s]);
});

test('failed draft exit keeps the current owner usable and permits closing again without duplicate release',async()=>{
 const f=fixture(),s=await f.ready('a.thoughtspace');f.view.finishInlineForNavigation=async()=>{throw Error('draft recovery failed');};await assert.rejects(f.view.onClose(),/draft recovery failed/);
 assert.equal(f.view.closed,false);assert.equal(f.view.session,s);assert.equal(s.listeners.size,1);f.view.finishInlineForNavigation=async()=>{};await Promise.all([f.view.onClose(),f.view.onClose()]);assert.equal(s.listeners.size,0);assert.deepEqual(f.released,[s]);
});
