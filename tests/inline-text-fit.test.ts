import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';
import {textFitsContent} from '../src/text-sizing';
import {type Card,nodeMinimumHeight} from '../src/model';

function fixture(options:{size?:{width:number;height:number};math?:boolean|'container';setupFailure?:'load'|'holder'|'clone';topic?:boolean}={}){
 const jobs:{resolve:()=>void;reject:(error:Error)=>void;scope:Scope;value:string}[]=[],mathJobs:{resolve:()=>void;reject:(error:Error)=>void}[]=[],holders:{removed:boolean;appendChild:()=>void;remove:()=>void}[]=[],applied:{width:number;height:number}[]=[],scopes:Scope[]=[];
 const size=options.size||{width:300,height:180},timers=new Map<number,()=>void>(),timerDelays=new Map<number,number>();let timerId=0,measurements=0;
 let node:Card|undefined={id:'text-1',kind:'text',text:'old',width:120,height:80,x:0,y:0,color:'green',autoSize:true,...(options.topic?{topic:true}:{textAutoHeight:true})};
 const win={setTimeout:(run:()=>void,delay:number)=>{assert.ok(delay===120||delay===1000);const id=timerId++;timers.set(id,run);timerDelays.set(id,delay);return id;},clearTimeout:(id:number)=>{timers.delete(id);timerDelays.delete(id);}};
 const content=()=>({querySelector:(selector:string)=>(options.math==='container'?selector==='mjx-container':options.math&&selector==='.math')?{}:null});
 const preview={isConnected:true,ownerDocument:{defaultView:win},cloneNode:()=>{if(options.setupFailure==='clone')throw Error('clone failed');return{dataset:{},createDiv:content};},parentElement:{createDiv:()=>{if(options.setupFailure==='holder')throw Error('host detached');const holder={removed:false,appendChild:()=>{},remove(){this.removed=true;}};holders.push(holder);return holder;}}};
 class Scope{loaded=false;unloadCount=0;cleanups:(()=>void)[]=[];children:Scope[]=[];constructor(){scopes.push(this);}register(fn:()=>void){this.cleanups.push(fn);}addChild(child:Scope){this.children.push(child);if(this.loaded)child.load();return child;}load(){this.loaded=true;if(options.setupFailure==='load')throw Error('load failed');}unload(){this.unloadCount++;this.loaded=false;for(const child of this.children.splice(0))child.unload();for(const fn of this.cleanups.splice(0))fn();}}
 const imports:Record<string,unknown>={
  './model':{nodeMinimumHeight},
  './editor-cleanup':{releaseEditorResource},
  './text-sizing':{textFitsContent},
  './excerpt-sources':{textExcerptPresentation:(body:string)=>({body:body.replace(/\n<!-- sources -->$/,'')})},
  './text-tools':{fitTextNode:(draft:Card)=>{measurements++;const width=draft.textAutoHeight===true||draft.autoSize===false?draft.width:size.width;Object.assign(draft,{...size,width});}},
  obsidian:{Component:Scope,MarkdownRenderer:{render:(_:unknown,value:string,_content:unknown,path:string,scope:Scope)=>{assert.equal(path,'boards/test.thoughtspace');return new Promise<void>((resolve,reject)=>jobs.push({resolve,reject,scope,value}));}},finishRenderMath:()=>new Promise<void>((resolve,reject)=>mathJobs.push({resolve,reject}))}
 };
 const scopeModule={exports:{}};new Function('require','module','exports',transformSync(readFileSync('src/preview-render-scope.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],scopeModule,scopeModule.exports);imports['./preview-render-scope']=scopeModule.exports;
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/inline-text-fit.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports);
 const fit=new module.exports.InlineTextFit({},preview,'boards/test.thoughtspace',()=>node,(value:{width:number;height:number})=>{applied.push(value);if(node)Object.assign(node,value);});
 return{fit,jobs,mathJobs,holders,applied,scopes,size,timers,timerDelays,preview,get node(){return node;},set node(value:Card|undefined){node=value;},get measurements(){return measurements;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('ordinary text with no opt-in or an explicit opt-out creates no duplicate Markdown measurement',async()=>{
 for(const flag of [undefined,false]){const f=fixture();f.node!.textAutoHeight=flag;f.fit.schedule('changed text');const pending=f.fit.flush();try{assert.equal(f.jobs.length,0);assert.equal(f.scopes.length,0);assert.equal(f.holders.length,0);assert.equal(f.measurements,0);assert.deepEqual([f.node!.width,f.node!.height],[120,80]);}finally{f.fit.dispose();await pending;}}
});
test('mind-map topics retain width and height auto-sizing without the new flag',async()=>{
 const f=fixture({topic:true});f.fit.schedule('topic grows');const pending=f.fit.flush();assert.equal(f.jobs.length,1);f.jobs[0].resolve();await pending;assert.deepEqual(f.applied,[{width:300,height:180}]);f.fit.dispose();
});
test('explicit height auto-sizing preserves the width while updating draft height',async()=>{
 const f=fixture();f.fit.schedule('more text');const pending=f.fit.flush();f.jobs[0].resolve();await pending;assert.deepEqual(f.applied,[{width:120,height:180}]);f.fit.dispose();
});
test('text draft fitting accepts the 40-pixel boundary and rejects smaller results',async()=>{
 for(const height of [40,39.9]){const f=fixture({size:{width:300,height}});f.fit.schedule('one line');const pending=f.fit.flush();f.jobs[0].resolve();await pending;assert.deepEqual(f.applied,height===40?[{width:120,height:40}]:[]);f.fit.dispose();}
});
test('turning off height auto-sizing during rendering discards the result before typesetting',async()=>{
 const f=fixture({math:true});f.fit.schedule('$x$');const pending=f.fit.flush();f.node!.textAutoHeight=false;f.jobs[0].resolve();await tick();try{assert.equal(f.mathJobs.length,0);assert.equal(f.measurements,0);assert.equal(f.applied.length,0);}finally{f.fit.dispose();await pending;}
});
test('turning off height auto-sizing cancels a stalled draft and flush stays optional',async()=>{
 const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();f.node!.textAutoHeight=false;f.fit.schedule('draft',true);await f.fit.flush();await pending;assert.equal(f.jobs.length,1);assert.equal(f.applied.length,0);assert.equal(f.scopes[0].unloadCount,1);assert.equal(f.holders[0].removed,true);assert.equal(f.timers.size,0);f.jobs[0].resolve();await tick();assert.equal(f.applied.length,0);f.fit.dispose();
});
test('a width change during opted-in height measurement rejects the stale wrapped height',async()=>{
 const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();f.node!.width=420;f.jobs[0].resolve();await pending;assert.equal(f.measurements,0);assert.equal(f.applied.length,0);assert.equal(f.node!.width,420);f.fit.dispose();
});
test('a sizing-mode change during topic rendering cannot publish old dimensions',async()=>{
 const f=fixture({topic:true});f.fit.schedule('draft');const pending=f.fit.flush();f.node!.textAutoHeight=true;f.jobs[0].resolve();await pending;assert.equal(f.measurements,0);assert.equal(f.applied.length,0);f.fit.dispose();
});
test('a width change or opt-out during native typesetting cannot publish stale height',async()=>{
 for(const mutation of ['width','opt-out']){const f=fixture({math:true});f.fit.schedule('$x$');const pending=f.fit.flush();f.jobs[0].resolve();await tick();assert.equal(f.mathJobs.length,1);if(mutation==='width')f.node!.width=420;else f.node!.textAutoHeight=false;f.mathJobs[0].resolve();await pending;assert.equal(f.measurements,0,mutation);assert.equal(f.applied.length,0,mutation);f.fit.dispose();}
});
test('re-enabling height sizing measures unchanged text after a fixed-frame edit',async()=>{
 const f=fixture();f.node!.textAutoHeight=false;f.fit.schedule('same');await f.fit.flush();assert.equal(f.jobs.length,0);f.node!.textAutoHeight=true;f.fit.schedule('same');const pending=f.fit.flush();assert.equal(f.jobs.length,1);f.jobs[0].resolve();await pending;assert.equal(f.applied.length,1);f.fit.dispose();
});

test('text measurements await direct MathJax containers before reading geometry',async()=>{
 const f=fixture({math:'container'});f.fit.schedule('$x$');const pending=f.fit.flush();f.jobs[0].resolve();await tick();assert.equal(f.mathJobs.length,1);assert.equal(f.measurements,0);f.mathJobs[0].resolve();await pending;assert.equal(f.measurements,1);assert.equal(f.applied.length,1);f.fit.dispose();
});

test('text draft changes debounce on the preview owner window, including timer id zero',async()=>{
 const f=fixture();f.fit.schedule('a');assert.equal(f.timers.size,1);f.fit.schedule('b');assert.equal(f.timers.size,1);assert.equal(f.jobs.length,0);
 const pending=f.fit.flush();assert.deepEqual([...f.timerDelays.values()],[1000]);assert.equal(f.jobs[0].value,'b');f.jobs[0].resolve();await pending;f.fit.dispose();
});
test('newer draft serializes behind an old renderer and only the latest result resizes',async()=>{
 const f=fixture();f.fit.schedule('old');const pending=f.fit.flush();f.fit.schedule('new');const concurrent=f.fit.flush();assert.equal(f.jobs.length,1);
 f.jobs[0].resolve();await tick();assert.equal(f.jobs.length,2);assert.equal(f.applied.length,0);f.jobs[1].resolve();await Promise.all([pending,concurrent]);
 assert.deepEqual(f.applied,[{width:120,height:180}]);assert.ok(f.holders.every(holder=>holder.removed));f.fit.dispose();
});
test('identical source skips rendering, but explicit appearance changes remeasure',async()=>{
 const f=fixture();f.fit.schedule('same');let pending=f.fit.flush();f.jobs[0].resolve();await pending;f.fit.schedule('same');await f.fit.flush();assert.equal(f.jobs.length,1);
 f.fit.schedule('same',true);pending=f.fit.flush();f.jobs[1].resolve();await pending;assert.equal(f.jobs.length,2);assert.equal(f.applied.length,1);f.fit.dispose();
});
test('an old font render is superseded even when the text does not change',async()=>{
 const f=fixture();f.fit.schedule('same');const pending=f.fit.flush();f.node!.fontSize=24;f.fit.schedule('same',true);f.jobs[0].resolve();await tick();assert.equal(f.applied.length,0);f.jobs[1].resolve();await pending;assert.equal(f.applied.length,1);f.fit.dispose();
});
test('math measurement waits for native typesetting before measuring',async()=>{
 const f=fixture({math:true});f.fit.schedule('$$x$$');const pending=f.fit.flush();f.jobs[0].resolve();await tick();assert.equal(f.mathJobs.length,1);assert.equal(f.measurements,0);
 f.mathJobs[0].resolve();await pending;assert.equal(f.measurements,1);assert.equal(f.applied.length,1);f.fit.dispose();
});
test('dispose releases scope and DOM and settles flush without waiting for a stuck renderer',async()=>{
 const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();assert.equal(f.scopes[0].loaded,true);f.fit.dispose();f.fit.dispose();await pending;
 assert.equal(f.scopes[0].loaded,false);assert.equal(f.scopes[0].unloadCount,1);assert.equal(f.holders[0].removed,true);assert.equal(f.applied.length,0);assert.equal(f.timers.size,0);
 f.jobs[0].resolve();await tick();assert.equal(f.applied.length,0);f.fit.schedule('later');await f.fit.flush();assert.equal(f.jobs.length,1);
});
test('closing during typesetting settles optional fit and cannot reopen or resize the draft',async()=>{
 const f=fixture({math:true});f.fit.schedule('$x$');const pending=f.fit.flush();f.jobs[0].resolve();await tick();f.fit.dispose();await pending;assert.equal(f.holders[0].removed,true);assert.equal(f.measurements,0);f.mathJobs[0].resolve();await tick();assert.equal(f.applied.length,0);
});
test('detached preview does not create a renderer or measurement surface',async()=>{
 const f=fixture();f.preview.isConnected=false;f.fit.schedule('draft');await f.fit.flush();assert.equal(f.jobs.length,0);assert.equal(f.scopes.length,0);f.fit.dispose();
});
test('preview detach or reparent during rendering discards its stale dimensions',async()=>{
 for(const action of ['detach','reparent']){const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();if(action==='detach')f.preview.isConnected=false;else f.preview.parentElement={createDiv:()=>{throw Error('unexpected');}};f.jobs[0].resolve();await pending;assert.equal(f.applied.length,0);assert.ok(f.holders[0].removed);f.fit.dispose();}
});
test('removed, replaced, folded or locked nodes reject an old renderer result',async()=>{
 for(const mutation of ['removed','different','folded','locked','nontext']){const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();if(mutation==='removed')f.node=undefined;else if(mutation==='different')f.node!.id='other';else if(mutation==='folded')f.node!.collapsed=true;else if(mutation==='locked')f.node!.locked=true;else f.node!.kind='card';f.jobs[0].resolve();await pending;assert.equal(f.applied.length,0,mutation);f.fit.dispose();}
});
test('unscheduled appearance mutation does not apply dimensions computed for the previous style',async()=>{
 const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();f.node!.fontSize=32;f.jobs[0].resolve();await pending;assert.equal(f.applied.length,0);f.fit.dispose();
});
test('setup and renderer failures remain contained and release every created resource',async()=>{
 for(const setupFailure of ['load','holder','clone'] as const){const f=fixture({setupFailure});f.fit.schedule('draft');await f.fit.flush();assert.equal(f.applied.length,0);assert.ok(f.scopes.every(scope=>!scope.loaded&&scope.unloadCount===1));assert.ok(f.holders.every(holder=>holder.removed));f.fit.dispose();}
 const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();f.jobs[0].reject(Error('renderer failed'));await pending;assert.equal(f.applied.length,0);assert.equal(f.holders[0].removed,true);f.fit.dispose();
});
test('failed math is optional and never publishes a partial measurement',async()=>{
 const f=fixture({math:true});f.fit.schedule('$x$');const pending=f.fit.flush();f.jobs[0].resolve();await tick();f.mathJobs[0].reject(Error('math failed'));await pending;assert.equal(f.applied.length,0);assert.equal(f.measurements,0);assert.equal(f.holders[0].removed,true);f.fit.dispose();
});
test('invalid dimensions never leave the optional fit boundary',async()=>{
 for(const size of [{width:NaN,height:100},{width:300,height:Infinity},{width:0,height:180},{width:300,height:0}]){const f=fixture({size,topic:true});f.fit.schedule('draft');const pending=f.fit.flush();f.jobs[0].resolve();await pending;assert.equal(f.applied.length,0);f.fit.dispose();}
});
test('cleanup failure still removes the measurement surface exactly once',async(t)=>{
 t.mock.method(console,'warn',()=>{});const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush();let unloads=0;f.scopes[0].unload=()=>{unloads++;throw Error('bad host cleanup');};f.fit.dispose();await pending;assert.equal(unloads,1);assert.equal(f.holders[0].removed,true);f.jobs[0].resolve();await tick();assert.equal(unloads,1);
});
test('a previously measured size can restore a frame changed since that measurement',async()=>{
 const f=fixture({topic:true});f.fit.schedule('one');let pending=f.fit.flush();f.jobs[0].resolve();await pending;f.node!.width=100;f.fit.schedule('two');pending=f.fit.flush();f.jobs[1].resolve();await pending;assert.equal(f.applied.length,2);f.fit.dispose();
});


test('manual-width text remains eligible for height measurement, but a newer manual width wins',async()=>{
 const f=fixture();f.node!.autoSize=false;f.fit.schedule('draft');let pending=f.fit.flush();f.jobs[0].resolve();await pending;assert.equal(f.applied.length,1);
 f.fit.schedule('newer');pending=f.fit.flush();f.node!.width=420;f.jobs[1].resolve();await pending;assert.equal(f.applied.length,1);f.fit.dispose();
});


test('a stalled Markdown render times out without blocking Save or applying a later result',async()=>{
 const f=fixture();f.fit.schedule('draft');const pending=f.fit.flush(),deadline=[...f.timerDelays].find(([,delay])=>delay===1000)![0];f.timers.get(deadline)!();await pending;
 assert.equal(f.applied.length,0);assert.equal(f.holders[0].removed,true);assert.equal(f.scopes[0].loaded,false);assert.equal(f.timers.size,0);f.jobs[0].resolve();await tick();assert.equal(f.applied.length,0);f.fit.dispose();
});
test('native math shares the same one-second budget instead of delaying Save for another second',async()=>{
 const f=fixture({math:true});f.fit.schedule('$x$');const pending=f.fit.flush(),deadline=[...f.timerDelays].find(([,delay])=>delay===1000)![0];f.jobs[0].resolve();await tick();assert.deepEqual([...f.timerDelays.keys()],[deadline]);f.timers.get(deadline)!();await pending;
 assert.equal(f.applied.length,0);assert.equal(f.measurements,0);assert.equal(f.holders[0].removed,true);f.mathJobs[0].resolve();await tick();assert.equal(f.applied.length,0);f.fit.dispose();
});
