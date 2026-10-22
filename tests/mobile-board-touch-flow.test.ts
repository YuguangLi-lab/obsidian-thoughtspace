import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as drafts from '../src/drag-draft';
import * as targets from '../src/drag-targets';
import * as experience from '../src/board-experience';
import * as sections from '../src/section-resize';
import {boardTouchTarget} from '../src/board-touch';

// Run BoardView's actual pointer lifecycle; only host DOM writes and its frame
// clock are substitutes. Do not replace the touch classifier with a test stub.
const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){
 const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);
}
const methods=take('  private pointerDown(','  private updateSelection(')
 +take('  private clearCanvasGesture(','  private showCanvasBackgroundMenu(')
 +take('  private pointerCaptureLost(','  private cancelRightMarquee(');
type Surface='preview'|'text'|'editor'|'header'|'resize'|'link'|'media'|'iframe'|'blank';
const selectors:Record<Surface,string[]>={preview:['.ts-card-preview'],text:['.ts-text-body'],editor:['.ts-inline-editor','textarea'],header:['.ts-node-header'],resize:['.ts-resize'],link:['.ts-card-preview','a'],media:['.ts-card-preview','.ts-av-player'],iframe:['.ts-card-preview','iframe'],blank:[]};
function target(surface:Surface,id='a'){
 const matches=new Set(selectors[surface]);
 return{dataset:{},getAttribute:(name:string)=>name==='data-id'&&surface!=='blank'?id:null,
  closest(selector:string):unknown{
   if(selector==='[data-id]')return surface==='blank'?null:this;
   return selector.split(',').some(value=>matches.has(value.trim()))?this:null;
  }};
}
function fixture(surface:Surface='preview',pointerType='touch'){
 const frames=new Map<number,()=>void>(),captures=new Set<number>(),notices:string[]=[];let frameId=0;
 const counts={focused:0,prevented:0,updated:0,writes:0,persists:0,renders:0,painted:0,connected:0};
 const clock={requestAnimationFrame(fn:()=>void){frames.set(++frameId,fn);return frameId;},cancelAnimationFrame(id:number){frames.delete(id);}};
 const deps={...model,...drafts,...targets,...experience,...sections,boardTouchTarget,
  Notice:class {constructor(message:string){notices.push(message);}},
  PointerEvent:class {constructor(_type:string,fields:Record<string,unknown>){Object.assign(this,fields);}}
 };
 const View=new Function(...Object.keys(deps),transformSync(`return class View{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View(),board=model.emptyBoard();board.nodes=[{id:'a',kind:'text',text:'saved text',x:20,y:30,width:300,height:300,color:'sand'},{id:'b',kind:'text',text:'peer text',x:500,y:30,width:200,height:200,color:'blue'}];
 const session={board,blocked:false,refreshNativeEditing(){},persist(){counts.persists++;},change(fn:(board:model.Board)=>void){counts.writes++;fn(this.board);}};
 Object.assign(view,{session,selected:new Set(),stage:{clientWidth:390,clientHeight:700,ownerDocument:{defaultView:clock},focus:()=>counts.focused++,setPointerCapture:(id:number)=>captures.add(id),hasPointerCapture:(id:number)=>captures.has(id),releasePointerCapture:(id:number)=>captures.delete(id)},
  plugin:{settings:{dragThreshold:4,axisLock:true,aspectLock:true,alignmentGuides:false}},mode:'select',pendingFits:new Map(),nodeFitQueue:{schedule(){}},positions:new Map([['a',{}]]),viewTrail:{remember(){}},
  point:(x:number,y:number)=>({x:(x-board.viewport.x)/board.viewport.zoom,y:(y-board.viewport.y)/board.viewport.zoom}),
  updateSelection:()=>counts.updated++,cancelConnection(){},cancelRightMarquee(){},finishMarquee(){},setSectionTool(){},previewGridLanding(){},drawAlignmentGuides(){},syncMinimapAvoidance(){},reserveVisibleCardControls(){},renderEdges(){},
  connectNode(){counts.connected++;},positionNode(){counts.painted++;},renderBoard(){counts.renders++;}});
 const event=(extra:Record<string,unknown>={})=>({pointerId:1,pointerType,button:0,buttons:1,clientX:50,clientY:70,target:target(surface),preventDefault:()=>counts.prevented++,...extra});
 const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
 return{view,board,session,event,counts,captures,frames,flush,notices};
}

for(const surface of ['preview','text'] as const)test(`a finger reading ${surface} selects without dragging or taking native scrolling/focus`,()=>{
 const f=fixture(surface),before=structuredClone(f.board);f.view.pointerDown(f.event());
 f.view.pointerMove(f.event({clientY:200}));f.flush();f.view.pointerUp(f.event({clientY:200,buttons:0}),true);
 assert.equal(f.view.gesture,undefined);assert.deepEqual([...f.view.selected],['a']);assert.deepEqual(f.board,before);
 assert.deepEqual({focused:f.counts.focused,prevented:f.counts.prevented,updated:f.counts.updated,writes:f.counts.writes,frames:f.frames.size,captures:f.captures.size},{focused:0,prevented:0,updated:1,writes:0,frames:0,captures:0});
});
for(const surface of ['editor','link','media','iframe'] as const)test(`touching ${surface} leaves its own editing or interactive gesture intact`,()=>{
 const f=fixture(surface),before=structuredClone(f.board);f.view.pointerDown(f.event());
 assert.equal(f.view.gesture,undefined);assert.equal(f.counts.focused,0);assert.equal(f.counts.prevented,0);assert.equal(f.counts.updated,0);assert.deepEqual(f.board,before);
});
test('repeated reading taps reuse selection and a later card tap replaces it without canvas capture',()=>{
 const f=fixture();for(let i=0;i<4;i++){f.view.pointerDown(f.event());f.view.pointerUp(f.event({buttons:0}));}
 assert.equal(f.counts.updated,1);f.view.pointerDown(f.event({target:target('text','b')}));
 assert.deepEqual([...f.view.selected],['b']);assert.equal(f.counts.updated,2);assert.equal(f.counts.prevented,0);assert.equal(f.captures.size,0);
});
test('touch connection mode still connects from the card body',()=>{
 const f=fixture();f.view.mode='connect';f.view.pointerDown(f.event());assert.equal(f.counts.connected,1);assert.equal(f.view.gesture,undefined);
});
test('mouse dragging the card body preserves the draft and final-release commit path',()=>{
 const f=fixture('preview','mouse');f.view.pointerDown(f.event());assert.equal(f.view.gesture.pan,false);assert.equal(f.view.gesture.draft.get('a').text,'saved text');
 assert.equal(f.board.nodes[0].x,20);f.view.pointerUp(f.event({clientX:90,clientY:100,buttons:0}));
 assert.deepEqual([f.board.nodes[0].x,f.board.nodes[0].y],[60,60]);assert.equal(f.counts.writes,1);assert.equal(f.captures.size,0);
});
for(const surface of ['header','resize'] as const)test(`touch ${surface} commits only its intended geometry after threshold crossing`,()=>{
 const f=fixture(surface),before=structuredClone(f.board);f.view.pointerDown(f.event());assert.equal(f.view.gesture.owner,f.session);
 f.view.pointerMove(f.event({clientX:80,clientY:100}));f.flush();assert.deepEqual(f.board,before);assert.equal(f.captures.size,1);
 f.view.pointerUp(f.event({clientX:90,clientY:110,buttons:0}));assert.equal(f.counts.writes,1);assert.equal(f.captures.size,0);
 const n=f.board.nodes[0];assert.deepEqual(surface==='header'?[n.x,n.y]:[n.width,n.height],surface==='header'?[60,70]:[340,340]);
 assert.deepEqual(f.board.nodes[1],before.nodes[1]);assert.equal(n.text,'saved text');
});
for(const queued of [false,true])test(`touch cancellation discards ${queued?'queued':'painted'} geometry and immediately accepts a new tap`,()=>{
 const f=fixture('header'),before=structuredClone(f.board);f.view.pointerDown(f.event());f.view.pointerMove(f.event({clientX:80,clientY:100}));if(!queued)f.flush();
 f.view.pointerUp(f.event({clientX:90,clientY:110}),true);assert.deepEqual(f.board,before);assert.equal(f.counts.writes,0);assert.equal(f.captures.size,0);assert.equal(f.frames.size,0);
 f.view.pointerDown(f.event({target:target('preview','b')}));assert.deepEqual([...f.view.selected],['b']);assert.equal(f.view.gesture,undefined);
});
test('lost pointer capture discards the preview and foreign pointer releases cannot cancel an active touch',()=>{
 const f=fixture('header'),before=structuredClone(f.board);f.view.pointerDown(f.event());f.view.pointerMove(f.event({clientX:80}));f.flush();
 f.view.pointerUp(f.event({pointerId:2}),true);assert.ok(f.view.gesture);f.view.pointerCaptureLost(f.event());assert.equal(f.view.gesture,undefined);assert.deepEqual(f.board,before);assert.equal(f.counts.writes,0);
});
for(const navigation of ['new-session','unload','same-session-reload'] as const)test(`a late touch release after ${navigation} cannot write into a replacement board`,()=>{
 const f=fixture('header');f.view.pointerDown(f.event());f.view.pointerMove(f.event({clientX:80}));f.flush();
 const replacement=structuredClone(f.board);replacement.nodes[0].text='new board';replacement.viewport.x=123;
 let replacementWrites=0;if(navigation==='new-session')f.view.session={board:replacement,blocked:false,change(){replacementWrites++;},persist(){replacementWrites++;}};
 else if(navigation==='unload')f.view.session=undefined;else f.session.board=replacement;
 const before=structuredClone(replacement);f.view.pointerUp(f.event({clientX:90,buttons:0}));
 assert.deepEqual(replacement,before);assert.equal(replacementWrites,0);assert.equal(f.counts.writes,0);assert.equal(f.view.gesture,undefined);assert.equal(f.captures.size,0);
});
test('navigation cleanup cancels a pending drag before a new board accepts touches',()=>{
 const f=fixture('header'),before=structuredClone(f.board);f.view.pointerDown(f.event());f.view.pointerMove(f.event({clientX:90}));f.view.clearCanvasGesture();
 assert.deepEqual(f.board,before);assert.equal(f.frames.size,0);assert.equal(f.view.gesture,undefined);f.view.pointerDown(f.event());assert.ok(f.view.gesture);assert.equal(f.counts.writes,0);
});
for(const surface of ['header','blank'] as const)test(`native Properties ownership appearing during ${surface} touch stops writes and restores only the temporary viewport`,()=>{
 const f=fixture(surface),before=structuredClone(f.board);f.view.pointerDown(f.event());f.view.pointerMove(f.event({clientX:90,clientY:100}));f.flush();
 f.session.refreshNativeEditing=()=>{f.session.blocked=true;};f.view.pointerUp(f.event({clientX:130,clientY:130,buttons:0}));
 assert.deepEqual(f.board,before);assert.equal(f.counts.writes,0);assert.equal(f.counts.persists,0);assert.equal(f.view.gesture,undefined);
});
test('native ownership is refreshed before the next touch can create a drag',()=>{
 const f=fixture('header');f.session.refreshNativeEditing=()=>{f.session.blocked=true;};f.view.pointerDown(f.event());assert.equal(f.view.gesture,undefined);assert.equal(f.counts.prevented,0);
});
test('drag commit preserves shared note content, style and unrelated board state',()=>{
 const f=fixture('header');f.view.pointerDown(f.event());f.board.nodes[0].text='latest shared text';f.board.nodes[0].color='purple';f.board.selectionSets=[{id:'s',name:'Saved selection',ids:['b']}];
 f.view.pointerUp(f.event({clientX:90,buttons:0}));assert.equal(f.counts.writes,1);assert.equal(f.board.nodes[0].text,'latest shared text');assert.equal(f.board.nodes[0].color,'purple');assert.equal(f.board.selectionSets[0].name,'Saved selection');
});
test('another window changing target geometry rejects the drag atomically',()=>{
 const f=fixture('header');f.view.pointerDown(f.event());f.board.nodes[0].height=440;const before=structuredClone(f.board);f.view.pointerUp(f.event({clientX:90,buttons:0}));
 assert.deepEqual(f.board,before);assert.equal(f.counts.writes,0);assert.equal(f.notices.length,1);assert.match(f.notices[0],/拖动已取消/);
});
