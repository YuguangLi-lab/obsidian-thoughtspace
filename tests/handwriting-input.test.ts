import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_HANDWRITING_TOOL,HANDWRITING_MAX_POINTS,HandwritingInputController,type HandwritingInputHost,type HandwritingPoint,type HandwritingPointerEvent,type HandwritingState,type HandwritingTool,type HandwritingViewport} from '../src/handwriting-input';

// Fake events and frame/capture delivery are simulations, not iPad device tests.
const pointer=(patch:Partial<HandwritingPointerEvent>={}):HandwritingPointerEvent=>({pointerId:1,pointerType:'pen',clientX:20,clientY:30,button:0,buttons:1,pressure:.5,timeStamp:1,...patch});
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
function fixture(tool:Partial<HandwritingTool>={}){
 const owner={},state:HandwritingState={owner,writable:true,rect:{left:10,top:20,width:600,height:400},viewport:{x:0,y:0,zoom:1}};
 let next=0;const frames=new Map<number,()=>void>(),captures=new Set<number>(),drafts:any[]=[],strokes:{points:readonly HandwritingPoint[];tool:Readonly<HandwritingTool>;owner:unknown}[]=[],erases:{ids:readonly string[];owner:unknown}[]=[],cameras:{viewport:HandwritingViewport;owner:unknown}[]=[],restores:HandwritingViewport[]=[],notices:string[]=[],releases:number[]=[];
 let input:HandwritingInputController;
 const host:HandwritingInputHost={state:()=>state,capture:id=>{captures.add(id);},release:id=>{captures.delete(id);releases.push(id);input.lostCapture(pointer({pointerId:id}));},requestFrame:fn=>{const id=++next;frames.set(id,fn);return id;},cancelFrame:id=>{frames.delete(id);},preview:draft=>drafts.push(draft?clone(draft):null),commitStroke:(points,metadata,capturedOwner)=>{strokes.push({points:clone(points),tool:clone(metadata),owner:capturedOwner});},hitStrokeIds:()=>['stroke-a','stroke-a','stroke-b'],commitErase:(ids,capturedOwner)=>{erases.push({ids:[...ids],owner:capturedOwner});},previewCamera:viewport=>{state.viewport={...viewport};},commitCamera:(viewport,capturedOwner)=>{cameras.push({viewport:{...viewport},owner:capturedOwner});},restoreCamera:viewport=>{restores.push({...viewport});state.viewport={...viewport};},notice:message=>{notices.push(message);}};
 input=new HandwritingInputController(host,tool);
 const tick=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback());};
 return{input,host,state,owner,frames,captures,drafts,strokes,erases,cameras,restores,notices,releases,tick};
}
test('pen buffers all coalesced samples, schedules one preview and commits once on release',()=>{
 const f=fixture();assert.equal(f.input.down(pointer()),true);
 for(let i=0;i<10;i++)f.input.move(pointer({clientX:30+i*2,timeStamp:2+i,getCoalescedEvents:()=>[pointer({clientX:29+i*2,timeStamp:2+i}),pointer({clientX:30+i*2,timeStamp:2+i})]}));
 assert.equal(f.frames.size,1);assert.equal(f.strokes.length,0);f.tick();assert.equal(f.drafts.at(-1).points.length,21);
 f.input.up(pointer({clientX:60,buttons:0,pressure:0,timeStamp:20}));assert.equal(f.strokes.length,1);assert.equal(f.strokes[0].points.length,22);assert.equal(f.strokes[0].points.at(-1)!.x,50);assert.equal(f.frames.size,0);assert.equal(f.captures.size,0);assert.equal(f.drafts.at(-1),null);assert.equal(f.strokes[0].owner,f.owner);
 f.input.lostCapture(pointer());f.input.up(pointer());assert.equal(f.strokes.length,1);
});
test('missing throwing and empty coalescing each use the parent exactly once',()=>{
 for(const getCoalescedEvents of [undefined,()=>{throw Error('unavailable');},()=>[]]){
  const f=fixture();f.input.down(pointer());f.input.move(pointer({clientX:50,getCoalescedEvents}));f.input.up(pointer({clientX:50,buttons:0}));assert.equal(f.strokes[0].points.length,2);
 }
});
test('coordinates use frozen world transform, invalid values are skipped and pressure fallback stays visible',()=>{
 const f=fixture();f.state.viewport={x:4,y:6,zoom:2};f.input.down(pointer({clientX:34,clientY:46,pressure:NaN}));
 f.input.move(pointer({clientX:Infinity,pressure:1}));f.input.move(pointer({clientX:54,clientY:66,pressure:1,timeStamp:2}));f.input.up(pointer({clientX:54,clientY:66,buttons:0,pressure:0,timeStamp:3}));
 assert.equal(f.strokes[0].points.length,2);assert.deepEqual(f.strokes[0].points[0],{x:10,y:10,pressure:.5,time:1});assert.ok(f.strokes[0].points[1].pressure>.5&&f.strokes[0].points[1].pressure<1);assert.ok(f.strokes[0].points.every(p=>Number.isFinite(p.x)&&p.pressure>0));
});
test('mouse primary draws but hover right middle control-click and unknown pointer types do not',()=>{
 const f=fixture();for(const patch of [{pointerType:'mouse',button:1},{pointerType:'mouse',button:2},{pointerType:'mouse',ctrlKey:true},{pointerType:''}])assert.equal(f.input.down(pointer(patch)),false);
 assert.equal(f.input.move(pointer({pointerType:'pen',buttons:0})),false);assert.equal(f.frames.size,0);
 assert.equal(f.input.down(pointer({pointerType:'mouse'})),true);f.input.up(pointer({pointerType:'mouse',buttons:0}));assert.equal(f.strokes.length,1);assert.equal(f.strokes[0].tool.kind,'pen');
});
test('fixed two-finger pair pans and pinches around its world anchor and commits only once',()=>{
 const f=fixture();const a=pointer({pointerType:'touch',pointerId:4,clientX:10,clientY:20}),b=pointer({pointerType:'touch',pointerId:5,clientX:110,clientY:20});
 f.input.down(a);f.input.move({...a,clientX:20});assert.equal(f.frames.size,0);f.input.down(b);f.input.down(pointer({pointerType:'touch',pointerId:6,clientX:90}));
 f.input.move({...a,clientX:-30});f.input.move({...b,clientX:170});assert.equal(f.frames.size,1);assert.equal(f.cameras.length,0);f.tick();
 const centroid=70,anchor=55;assert.ok(Math.abs((centroid-10-f.state.viewport.x)/f.state.viewport.zoom-anchor)<1e-9);
 f.input.up({...a,buttons:0});assert.equal(f.cameras.length,1);f.input.move({...b,clientX:300});f.input.move(pointer({pointerType:'touch',pointerId:6,clientX:450}));f.tick();assert.equal(f.cameras.length,1);assert.equal(f.strokes.length,0);
 f.input.up({...b,buttons:0});f.input.up(pointer({pointerType:'touch',pointerId:6,buttons:0}));assert.equal(f.captures.size,0);
});
test('pen preempts camera and held touch contacts stay quarantined until lifted',()=>{
 const f=fixture(),a=pointer({pointerType:'touch',pointerId:4}),b=pointer({pointerType:'touch',pointerId:5,clientX:120});
 f.input.down(a);f.input.down(b);f.input.move({...b,clientX:140});f.tick();const camera={...f.state.viewport};f.input.down(pointer());assert.equal(f.cameras.length,1);
 f.input.move({...b,clientX:400});f.input.down(pointer({pointerType:'touch',pointerId:6}));f.input.up(pointer({buttons:0}));f.input.move({...a,clientX:400});f.tick();assert.deepEqual(f.state.viewport,camera);assert.equal(f.strokes.length,1);assert.equal(f.cameras.length,1);
 f.input.up({...a,buttons:0});f.input.up({...b,buttons:0});f.input.up(pointer({pointerType:'touch',pointerId:6,buttons:0}));f.input.down({...a});f.input.down({...b});f.input.move({...b,clientX:180});f.input.up({...b,clientX:180,buttons:0});assert.equal(f.cameras.length,2);
});
for(const boundary of ['cancel','lostCapture','owner','blur','leave','tool','dispose'] as const)test(`${boundary} cancels draft and retained frame without any save`,()=>{
 const f=fixture();f.input.down(pointer());f.input.move(pointer({clientX:80}));const stale=[...f.frames.values()];
 if(boundary==='cancel'||boundary==='lostCapture')f.input[boundary](pointer());else if(boundary==='tool')f.input.setTool({kind:'eraser'});else if(boundary==='dispose')f.input.dispose();else f.input.reset(boundary);
 assert.equal(f.frames.size,0);assert.equal(f.captures.size,0);stale.forEach(fn=>fn());f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,0);assert.equal(f.erases.length,0);assert.equal(f.drafts.at(-1),null);
});
test('unrelated cancellation does not finish owner, while owner and save lock are checked again at release',()=>{
 const f=fixture();f.input.down(pointer());assert.equal(f.input.cancel(pointer({pointerId:9})),false);f.input.move(pointer({clientX:40}));f.state.writable=false;f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,0);assert.equal(f.frames.size,0);
 f.state.writable=true;f.input.down(pointer());f.state.owner={};f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,0);
});
test('owner and writable changes before RAF reject late draft projection',()=>{
 for(const change of ['owner','lock','viewport'] as const){const f=fixture();f.input.down(pointer());if(change==='owner')f.state.owner={};if(change==='lock')f.state.writable=false;if(change==='viewport')f.state.viewport.x++;f.tick();assert.equal(f.frames.size,0);assert.equal(f.captures.size,0);assert.equal(f.drafts.at(-1),null);assert.equal(f.strokes.length,0);}
});
test('8192 point limit cancels the entire stroke with explicit feedback and a fresh stroke can recover',()=>{
 const f=fixture();f.input.down(pointer());for(let i=1;i<=HANDWRITING_MAX_POINTS;i++)f.input.move(pointer({clientX:20+i,timeStamp:1+i}));
 assert.equal(f.strokes.length,0);assert.equal(f.frames.size,0);assert.equal(f.notices.length,1);assert.match(f.notices[0],/8192/);assert.match(f.notices[0],/未保存/);f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,0);
 f.input.down(pointer());f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,1);
});
test('eraser commits unique host hit IDs once and mouse pan saves camera rather than ink',()=>{
 const f=fixture({kind:'eraser'});f.input.down(pointer());f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,0);assert.deepEqual(f.erases[0].ids,['stroke-a','stroke-b']);
 f.input.setTool({kind:'pan'});assert.equal(f.input.down(pointer()),false);f.input.down(pointer({pointerType:'mouse'}));f.input.move(pointer({pointerType:'mouse',clientX:80}));f.input.up(pointer({pointerType:'mouse',clientX:80,buttons:0}));assert.equal(f.cameras.length,1);assert.equal(f.cameras[0].viewport.x,60);assert.equal(f.strokes.length,0);
});
test('camera cancel restores original viewport, but stale owner never receives camera restore or save',()=>{
 for(const stale of [false,true]){const f=fixture({kind:'pan'});f.input.down(pointer({pointerType:'mouse'}));f.input.move(pointer({pointerType:'mouse',clientX:80}));f.tick();if(stale)f.state.owner={};f.input.cancel(pointer({pointerType:'mouse'}));assert.equal(f.cameras.length,0);assert.equal(f.restores.length,stale?0:1);if(!stale)assert.deepEqual(f.state.viewport,{x:0,y:0,zoom:1});}
});
test('capture failure and synchronous/asynchronous commit failures surface feedback without retained state',async()=>{
 const f=fixture();f.host.capture=()=>{throw Error('no capture');};f.input.down(pointer());assert.equal(f.frames.size,0);assert.equal(f.strokes.length,0);assert.equal(f.notices.length,1);
 for(const asynchronous of [false,true]){const g=fixture();g.host.commitStroke=()=>{if(asynchronous)return Promise.reject(Error('save failed'));throw Error('save failed');};g.input.down(pointer());g.input.up(pointer({buttons:0}));await Promise.resolve();assert.equal(g.notices.length,1);assert.equal(g.captures.size,0);assert.equal(g.frames.size,0);}
 assert.equal(DEFAULT_HANDWRITING_TOOL.kind,'pen');
});
test('pen preemption projects a pending camera before taking the ink coordinate basis',()=>{
 const f=fixture(),a=pointer({pointerType:'touch',pointerId:4,clientX:10,clientY:20}),b=pointer({pointerType:'touch',pointerId:5,clientX:110,clientY:20});
 f.input.down(a);f.input.down(b);f.input.move({...b,clientX:210});assert.equal(f.frames.size,1);assert.deepEqual(f.state.viewport,{x:0,y:0,zoom:1});
 f.input.down(pointer({clientX:60,clientY:20}));assert.equal(f.cameras.length,1);assert.equal(f.cameras[0].viewport.zoom,2);f.input.up(pointer({clientX:60,clientY:20,buttons:0}));assert.equal(f.strokes.length,1);assert.equal(f.strokes[0].points[0].x,25);
});
test('release and eraser host hooks cannot commit after acquiring a save lock or switching tools',()=>{
 for(const boundary of ['release-lock','release-tool','erase-lock','erase-tool'] as const){
  const f=fixture({kind:boundary.startsWith('erase')?'eraser':'pen'}),release=f.host.release;
  if(boundary.startsWith('release'))f.host.release=id=>{release(id);if(boundary==='release-lock')f.state.writable=false;else f.input.setTool({kind:'eraser'});};
  else f.host.hitStrokeIds=()=>{if(boundary==='erase-lock')f.state.writable=false;else f.input.setTool({kind:'pen'});return['stroke-a'];};
  f.input.down(pointer());f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,0);assert.equal(f.erases.length,0);assert.equal(f.captures.size,0);
 }
});
test('third and later contacts never replace the fixed pair during one touch sequence',()=>{
 const f=fixture();const touch=(id:number,x:number)=>pointer({pointerType:'touch',pointerId:id,clientX:x,clientY:20});
 f.input.down(touch(4,10));f.input.down(touch(5,110));f.input.down(touch(6,80));f.input.up(touch(6,80));f.input.down(touch(7,90));f.input.move(touch(5,140));f.input.up(touch(4,10));assert.equal(f.cameras.length,1);
 f.input.down(touch(8,20));f.input.move(touch(5,200));f.input.move(touch(8,40));f.tick();assert.equal(f.cameras.length,1);assert.equal(f.frames.size,0);
 for(const id of [5,7,8])f.input.up(touch(id,20));assert.equal(f.captures.size,0);
});
test('active hover cancels ink and a zero-distance pair never produces an invalid camera',()=>{
 const f=fixture();f.input.down(pointer());f.input.move(pointer({buttons:0}));f.input.up(pointer({buttons:0}));assert.equal(f.strokes.length,0);assert.equal(f.frames.size,0);
 f.input.down(pointer({pointerType:'touch',pointerId:4}));f.input.down(pointer({pointerType:'touch',pointerId:5}));f.input.move(pointer({pointerType:'touch',pointerId:5,clientX:100}));f.tick();assert.equal(f.cameras.length,0);assert.deepEqual(f.state.viewport,{x:0,y:0,zoom:1});
});
test('an exact-limit stroke can finish at its existing endpoint without being truncated',()=>{
 const f=fixture();f.input.down(pointer());for(let i=1;i<HANDWRITING_MAX_POINTS;i++)f.input.move(pointer({clientX:20+i,timeStamp:1+i}));f.input.up(pointer({clientX:20+HANDWRITING_MAX_POINTS-1,buttons:0,timeStamp:HANDWRITING_MAX_POINTS+1}));assert.equal(f.strokes[0].points.length,HANDWRITING_MAX_POINTS);assert.equal(f.notices.length,0);
});
test('native-like prototype event properties preserve terminal mouse camera coordinates',()=>{
 const f=fixture({kind:'pan'}),values=pointer({pointerType:'mouse',clientX:90,clientY:70,buttons:0});
 const prototype={};for(const key of Object.keys(values))Object.defineProperty(prototype,key,{get:()=>values[key as keyof HandwritingPointerEvent]});
 const release=Object.create(prototype) as HandwritingPointerEvent;assert.deepEqual({...release},{});f.input.down(pointer({pointerType:'mouse'}));f.input.up(release);assert.equal(f.cameras.length,1);assert.deepEqual(f.cameras[0].viewport,{x:70,y:40,zoom:1});
});
test('external camera replacement is preserved when controller detects its stale viewport',()=>{
 const f=fixture({kind:'pan'});f.input.down(pointer({pointerType:'mouse'}));f.input.move(pointer({pointerType:'mouse',clientX:80}));f.tick();f.state.viewport={x:300,y:200,zoom:.5};f.input.move(pointer({pointerType:'mouse',clientX:90}));assert.deepEqual(f.state.viewport,{x:300,y:200,zoom:.5});assert.equal(f.restores.length,0);assert.equal(f.cameras.length,0);assert.equal(f.captures.size,0);
});
test('remaining touch capture lasts until its own release after pair ends',()=>{
 const f=fixture(),a=pointer({pointerType:'touch',pointerId:4,clientX:10}),b=pointer({pointerType:'touch',pointerId:5,clientX:110});f.input.down(a);f.input.down(b);f.input.up(a);assert.equal(f.captures.has(4),false);assert.equal(f.captures.has(5),true);f.input.up(b);assert.equal(f.captures.size,0);
});

for(const [width,height]of [[360,640],[640,360],[390,844],[844,390],[430,932],[932,430],[768,1024],[820,1180],[1180,820],[1024,768],[1024,1366],[1366,1024],[360,280],[512,768]])test(`layout ${width}x${height} retains world ink while rebasing subsequent input`,()=>{
 const f=fixture();f.state.viewport={x:4,y:6,zoom:2};f.input.down(pointer({clientX:34,clientY:46}));f.input.move(pointer({clientX:54,clientY:66}));f.tick();
 const points=clone(f.drafts.at(-1).points);f.state.rect={left:40,top:70,width,height};f.input.reset('resize');
 assert.deepEqual(f.drafts.at(-1).points,points);assert.ok(f.captures.has(1));assert.deepEqual(f.state.viewport,{x:4,y:6,zoom:2});assert.equal(f.strokes.length,0);
 f.input.move(pointer({clientX:124,clientY:156}));f.input.up(pointer({clientX:124,clientY:156,buttons:0}));
 assert.equal(f.strokes.length,1);assert.deepEqual(f.strokes[0].points.map(({x,y})=>[x,y]),[[10,10],[20,20],[40,40]]);assert.equal(f.captures.size,0);
});

test('layout changes detected before RAF preserve drafts without requiring an observer callback',()=>{
 const f=fixture();f.input.down(pointer());f.state.rect.left=15;f.tick();assert.equal(f.captures.size,1);assert.equal(f.drafts.at(-1).points[0].x,10);
 f.input.up(pointer({clientX:25,buttons:0}));assert.equal(f.strokes.length,1);assert.equal(f.strokes[0].points.length,1);
});

test('a temporarily zero-sized stage ignores new samples but preserves already sampled ink on release',()=>{
 const f=fixture();f.input.down(pointer());f.input.move(pointer({clientX:40}));f.state.rect.width=0;f.input.layoutChanged();f.input.move(pointer({clientX:900}));
 assert.ok(f.captures.has(1));f.input.up(pointer({clientX:900,buttons:0}));assert.equal(f.strokes.length,1);assert.equal(f.strokes[0].points.length,2);assert.equal(f.strokes[0].points.at(-1)!.x,30);assert.equal(f.captures.size,0);
});

test('resize rebases a pending pinch without a camera jump and cancellation still restores its original view',()=>{
 for(const cancel of [false,true]){
  const f=fixture(),a=pointer({pointerType:'touch',pointerId:4,clientX:10,clientY:20}),b=pointer({pointerType:'touch',pointerId:5,clientX:110,clientY:20});
  f.input.down(a);f.input.down(b);f.input.move({...b,clientX:210});f.state.rect={left:40,top:70,width:390,height:300};f.input.layoutChanged();
  const projected={...f.state.viewport};assert.equal(projected.zoom,2);assert.equal(f.cameras.length,0);assert.equal(f.captures.size,2);
  f.input.move({...b,clientX:210});f.tick();assert.deepEqual(f.state.viewport,projected);
  if(cancel){f.input.cancel(b);assert.deepEqual(f.state.viewport,{x:0,y:0,zoom:1});assert.equal(f.cameras.length,0);}
  else{f.input.up({...b,clientX:210,buttons:0});assert.deepEqual(f.cameras[0].viewport,projected);assert.equal(f.cameras.length,1);}
  f.input.up({...a,buttons:0});assert.equal(f.captures.size,0);
 }
});

test('finger writing is opt-in and repeated single-finger releases leave no held contact',()=>{
 const f=fixture(),touch=pointer({pointerType:'touch'});f.input.down(touch);f.input.up({...touch,buttons:0});assert.equal(f.strokes.length,0);
 f.input.setTouchWriting(true);
 for(let i=0;i<2;i++){f.input.down(touch);f.input.move({...touch,clientX:40});f.input.up({...touch,clientX:50,buttons:0});assert.equal(f.captures.size,0);}
 assert.equal(f.strokes.length,2);assert.equal(f.cameras.length,0);
 f.input.setTouchWriting(false);f.input.down(touch);f.input.up({...touch,buttons:0});assert.equal(f.strokes.length,2);
});

test('a second finger converts tentative finger ink to a fixed pinch pair without writing the draft',()=>{
 const f=fixture(),a=pointer({pointerType:'touch',pointerId:4,clientX:10,clientY:20}),b=pointer({pointerType:'touch',pointerId:5,clientX:110,clientY:20});
 f.input.setTouchWriting(true);f.input.down(a);f.input.move({...a,clientX:20});f.tick();assert.ok(f.drafts.at(-1));f.input.down(b);assert.equal(f.drafts.at(-1),null);assert.equal(f.captures.size,2);
 f.input.move({...b,clientX:160});f.tick();f.input.up({...b,clientX:160,buttons:0});f.input.up({...a,clientX:20,buttons:0});assert.equal(f.strokes.length,0);assert.equal(f.cameras.length,1);assert.equal(f.captures.size,0);
 f.input.down(a);f.input.up({...a,buttons:0});assert.equal(f.strokes.length,1);
});

test('pen preempts finger ink and touch cancellation or capture loss never writes a partial stroke',()=>{
 for(const boundary of ['cancel','lostCapture','pen'] as const){
  const f=fixture(),touch=pointer({pointerType:'touch',pointerId:4});f.input.setTouchWriting(true);f.input.down(touch);f.input.move({...touch,clientX:50});
  if(boundary==='pen'){f.input.down(pointer());assert.ok(f.captures.has(4),'held preempted finger stays captured until its own release');f.input.up(pointer({buttons:0}));f.input.up({...touch,buttons:0});assert.equal(f.strokes.length,1);assert.equal(f.strokes[0].points.length,1);}
  else{f.input[boundary](touch);f.input.up({...touch,buttons:0});assert.equal(f.strokes.length,0);}
  assert.equal(f.captures.size,0);
 }
});
