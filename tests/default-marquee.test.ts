import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as boardTools from '../src/board-tools';
import * as dragDraft from '../src/drag-draft';
import * as dragTargets from '../src/drag-targets';
import * as experience from '../src/board-experience';
import {validSectionRect} from '../src/sections';

// Exercise BoardView's actual event methods; only the host's DOM and frame clock are fake.
const source=readFileSync(process.env.MARQUEE_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing BoardView method range: ${start}`);
  return source.slice(a,b);
}
const methods=take('  private finishMarqueeFromDocument(', '  private foldSelection(')
  +take('  private pointerDown(', '  private matches(');

class Element {
  style:Record<string,string>={};dataset:Record<string,string>={};removed=false;
  classes=new Set<string>();
  classList={toggle:(name:string,on:boolean)=>this.toggleClass(name,on)};
  constructor(readonly selectors:Record<string,Element>={}){}
  closest(selector:string){return this.selectors[selector]||null;}
  getAttribute(name:string){return name==='data-id'?this.dataset.id:name==='data-edge'?this.dataset.edge:null;}
  toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
  querySelectorAll(){return [];}
  remove(){this.removed=true;}
}

const node=(id:string,x:number,y=20,patch:Partial<model.Card>={}):model.Card=>({id,kind:'card',file:`${id}.md`,x,y,width:80,height:60,color:'sand',...patch});
function fixture(nodes:model.Card[]=[node('a',20),node('b',150),node('old',500)]){
  const frames=new Map<number,()=>void>();let frameId=0;
  const deps={...model,...mindmap,...boardTools,...dragDraft,...dragTargets,...experience,validSectionRect,
    requestAnimationFrame:(fn:()=>void)=>{frames.set(++frameId,fn);return frameId;},
    cancelAnimationFrame:(id:number)=>frames.delete(id)};
  const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
  const view=new View(),board={...model.emptyBoard(),nodes,viewport:{x:0,y:0,zoom:1}};
  const calls={inspector:0,controls:0,render:0,schedule:0,persist:0,writes:0,history:0};
  const capture=new Set<number>(),boxes:Element[]=[];
  const stage=Object.assign(new Element(),{clientWidth:1000,clientHeight:700,focus(){},
    setPointerCapture:(id:number)=>capture.add(id),hasPointerCapture:(id:number)=>capture.has(id),releasePointerCapture:(id:number)=>capture.delete(id)});
  Object.assign(view,{session:{board,blocked:false,persist(){calls.persist++;},change(fn:(b:model.Board)=>void){calls.writes++;fn(board);}},
    selected:new Set(['old']),selectionTool:false,space:false,mode:'select',pointerFrame:0,dragging:false,
    stage,world:{createDiv(){const box=new Element();boxes.push(box);return box;}},svg:new Element(),
    positions:new Map(nodes.map(n=>[n.id,new Element()])),pendingFits:new Map(),nodeFitQueue:{schedule(){}},
    plugin:{settings:{axisLock:true,alignmentGuides:false,gridStep:24}},viewTrail:{remember(){calls.history++;}},
    point(x:number,y:number){const v=board.viewport;return {x:(x-v.x)/v.zoom,y:(y-v.y)/v.zoom};},
    syncCanvasControls(){calls.controls++;},renderInspector(){calls.inspector++;},renderBoard(){calls.render++;},scheduleRender(){calls.schedule++;},
    cancelConnection(){view.mode='select';view.connectFrom=undefined;},previewGridLanding(){},drawAlignmentGuides(){},setSectionTool(){}});
  function event(x=0,y=0,extra:Record<string,unknown>={}){return {pointerId:1,button:0,clientX:x,clientY:y,target:new Element(),shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,preventDefault(){},stopPropagation(){},...extra};}
  function flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}
  return {view,board,calls,capture,boxes,frames,event,flush};
}
const ids=(view:any)=>[...view.selected].sort();

test('blank-canvas left drag selects cards without Shift or the selection tool and leaves the camera still',()=>{
  const f=fixture();f.view.pointerDown(f.event());
  assert.ok(f.view.marquee,'ordinary left drag must start a marquee');assert.equal(f.view.gesture,undefined);
  f.view.pointerMove(f.event(240,100));f.flush();f.view.pointerUp(f.event(240,100));
  assert.deepEqual(ids(f.view),['a','b']);assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});
  assert.equal(f.calls.persist,0);assert.equal(f.calls.writes,0);assert.equal(f.capture.size,0);
});

test('Shift-marquee adds to the existing selection while an ordinary marquee replaces it',()=>{
  for(const shiftKey of [false,true]){
    const f=fixture();f.view.pointerDown(f.event(0,0,{shiftKey}));f.view.pointerUp(f.event(100,100,{shiftKey}));
    assert.deepEqual(ids(f.view),shiftKey?['a','old']:['a']);
  }
});

test('marquee hit testing uses board coordinates at non-default zoom and supports backwards drags',()=>{
  const f=fixture();Object.assign(f.board.viewport,{x:400,y:200,zoom:.5});
  f.view.pointerDown(f.event(520,250));f.view.pointerUp(f.event(400,200));
  assert.deepEqual(ids(f.view),['a','b']);assert.deepEqual(f.board.viewport,{x:400,y:200,zoom:.5});
});

test('Space-left-drag and middle-drag remain panning gestures and preserve selected cards',()=>{
  for(const button of [0,1]){
    const f=fixture();f.view.space=button===0;f.view.pointerDown(f.event(10,15,{button}));
    assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture.pan,true);
    f.view.pointerMove(f.event(60,85,{button}));f.flush();f.view.pointerUp(f.event(60,85,{button}));
    assert.deepEqual(ids(f.view),['old']);assert.deepEqual(f.board.viewport,{x:50,y:70,zoom:1});
    assert.equal(f.calls.persist,1);assert.equal(f.calls.writes,0);
  }
});

test('single clicking empty canvas clears selection without moving or saving the board',()=>{
  const f=fixture();f.view.selectedEdge='edge';f.view.pointerDown(f.event(300,200));f.view.pointerUp(f.event(300,200));
  assert.deepEqual(ids(f.view),[]);assert.equal(f.view.selectedEdge,undefined);
  assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});assert.equal(f.calls.persist,0);assert.equal(f.calls.writes,0);
});

test('right click and macOS Control-click do not begin a marquee or alter selection',()=>{
  for(const extra of [{button:2},{ctrlKey:true}]){
    const f=fixture();f.view.pointerDown(f.event(0,0,extra));
    assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture,undefined);assert.deepEqual(ids(f.view),['old']);
  }
});

test('inputs, native editor content and toolbar buttons retain their normal pointer handling',()=>{
  const f=fixture(),interactive=new Element();
  const target=new Element({'a,input,textarea,select,button,[contenteditable=true],.ts-inline-editor':interactive});
  f.view.pointerDown(f.event(0,0,{target}));assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture,undefined);assert.deepEqual(ids(f.view),['old']);
});

test('Escape cancels the pending pointer frame, removes the marquee and restores the previous selection',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(110,100));f.flush();
  assert.deepEqual(ids(f.view),['a']);f.view.pointerMove(f.event(240,100));
  f.view.key({key:'Escape',target:new Element(),preventDefault(){}});
  assert.deepEqual(ids(f.view),['old']);assert.equal(f.view.marquee,undefined);assert.equal(f.capture.size,0);
  assert.equal(f.frames.size,0);assert.equal(f.boxes[0].removed,true);assert.equal(f.calls.writes,0);
  f.flush();assert.deepEqual(ids(f.view),['old']);
});

test('pointer cancellation restores selection instead of accepting the last rectangle',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(240,100));f.flush();
  f.view.pointerUp(f.event(240,100),true);assert.deepEqual(ids(f.view),['old']);assert.equal(f.capture.size,0);assert.equal(f.view.marquee,undefined);
});

test('cancelling a marquee restores the selected connection and ordinary release clears it',()=>{
  for(const cancelled of [false,true]){
    const f=fixture();f.view.selected.clear();f.view.selectedEdge='existing-edge';f.view.pointerDown(f.event());
    f.view.pointerUp(f.event(240,100),cancelled);
    assert.equal(f.view.selectedEdge,cancelled?'existing-edge':undefined);
    assert.deepEqual(ids(f.view),cancelled?[]:['a','b']);
  }
});

test('connection mode retains its blank-canvas handling rather than starting an accidental marquee',()=>{
  const f=fixture();f.view.mode='connect';f.view.connectFrom='a';f.view.pointerDown(f.event());
  assert.equal(f.view.marquee,undefined);assert.equal(f.view.mode,'connect');assert.equal(f.view.connectFrom,'a');
});

test('marquee preserves existing lock, folded-branch, filter and related-focus policies',()=>{
  const f=fixture([node('root',20,20,{branchFolded:true}),node('hidden',20),node('locked',110,20,{locked:true}),node('filtered',210),node('unrelated',310),node('old',600)]);
  f.board.edges=[{id:'branch',from:'root',to:'hidden',label:'',kind:'branch'}];
  f.view.filterMatches=new Set(['root','hidden','locked','unrelated']);f.view.relatedFocus=new Set(['root','hidden','locked','filtered']);
  f.view.pointerDown(f.event());f.view.pointerUp(f.event(500,100));
  assert.deepEqual(ids(f.view),['locked','root']);assert.equal(f.board.nodes.find(n=>n.id==='locked')?.locked,true);
});

test('partial cards can be selected while a section is selected only when fully enclosed',()=>{
  const f=fixture([node('a',80,20),node('section',0,0,{kind:'section',file:undefined,title:'Group',width:300,height:200})]);
  f.view.pointerDown(f.event());f.view.pointerUp(f.event(100,100));assert.deepEqual(ids(f.view),['a']);
  f.view.pointerDown(f.event(-1,-1));f.view.pointerUp(f.event(301,201));assert.deepEqual(ids(f.view),['a','section']);
});

test('marquee keeps selected outlines responsive but rebuilds editing controls only after release',()=>{
  const f=fixture();f.view.selectionTool=true;f.view.pointerDown(f.event());const initial=f.calls.inspector;
  f.view.pointerMove(f.event(110,100));f.flush();assert.equal(f.view.positions.get('a').classes.has('is-selected'),true);
  f.view.pointerMove(f.event(240,100));f.flush();assert.equal(f.view.positions.get('b').classes.has('is-selected'),true);
  assert.equal(f.calls.inspector,initial,'membership updates must not rebuild editing controls');
  f.view.pointerUp(f.event(240,100));assert.equal(f.calls.inspector,initial+1);
});

test('pointer-move bursts are frame-coalesced and a stable hit set does not refresh selection controls',()=>{
  const f=fixture();f.view.pointerDown(f.event());
  for(let i=0;i<120;i++)f.view.pointerMove(f.event(110+i/1000,100));
  assert.equal(f.frames.size,1);f.flush();assert.deepEqual(ids(f.view),['a']);const initial=f.calls.controls;
  f.view.pointerMove(f.event(120,100));f.flush();assert.equal(f.calls.controls,initial);
  f.view.pointerUp(f.event(240,100));assert.deepEqual(ids(f.view),['a','b'],'pointerup must use final coordinates even if no move was dispatched there');
});

test('a second pointer cannot move or finish another pointer’s marquee',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(240,100,{pointerId:2}));f.flush();
  assert.deepEqual(ids(f.view),[]);f.view.pointerUp(f.event(240,100,{pointerId:2}));assert.ok(f.view.marquee);assert.equal(f.capture.has(1),true);
  f.view.pointerUp(f.event(110,100));assert.deepEqual(ids(f.view),['a']);
});

test('clicking an already selected card still starts an object drag without discarding multiselection',()=>{
  const f=fixture(),card=new Element();card.dataset.id='a';f.view.selected=new Set(['a','b']);
  f.view.pointerDown(f.event(25,25,{target:new Element({'[data-id]':card})}));
  assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture.pan,false);assert.deepEqual(ids(f.view),['a','b']);
  assert.equal(f.capture.size,0,'do not capture clicks before drag threshold; double-click editing needs its original target');
});

test('releasing over a document overlay finishes the marquee even after pointer capture was lost',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(110,100));f.flush();
  f.capture.clear();
  const release=f.event(240,100,{target:new Element()});
  f.view.finishMarqueeFromDocument(release);
  assert.equal(f.view.marquee,undefined);assert.equal(f.boxes[0].removed,true);assert.deepEqual(ids(f.view),['a','b']);
  assert.equal(f.calls.inspector,1,'deferred editing controls appear when the overlay receives release');
  assert.equal(f.calls.writes,0);assert.equal(f.calls.persist,0);
});

test('document capture and stage handlers processing the same release do not finalize twice',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(110,100));
  const release=f.event(240,100);f.view.finishMarqueeFromDocument(release);const after={...f.calls};
  f.view.pointerUp(release);f.view.finishMarqueeFromDocument(release);
  assert.deepEqual(f.calls,after);assert.deepEqual(ids(f.view),['a','b']);assert.equal(f.frames.size,0);assert.equal(f.capture.size,0);
});

test('document cancellation restores selection and a later stage release cannot accept the cancelled rectangle',()=>{
  const f=fixture();f.view.selectedEdge='previous';f.view.pointerDown(f.event());f.view.pointerMove(f.event(110,100));f.flush();
  f.view.pointerMove(f.event(240,100));f.view.finishMarqueeFromDocument(f.event(240,100),true);
  assert.deepEqual(ids(f.view),['old']);assert.equal(f.view.selectedEdge,'previous');assert.equal(f.frames.size,0);
  const after={...f.calls};f.view.pointerUp(f.event(240,100));f.view.finishMarqueeFromDocument(f.event(240,100),true);
  assert.deepEqual(ids(f.view),['old']);assert.deepEqual(f.calls,after);assert.equal(f.view.marquee,undefined);
});

test('the document fallback ignores other pointers and does not take over an ordinary pan',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(110,100));f.flush();const before={...f.calls};
  f.view.finishMarqueeFromDocument(f.event(240,100,{pointerId:2}));
  assert.ok(f.view.marquee);assert.deepEqual(ids(f.view),['a']);assert.deepEqual(f.calls,before);
  f.view.finishMarqueeFromDocument(f.event(110,100));
  const pan=fixture();pan.view.space=true;pan.view.pointerDown(pan.event());pan.view.pointerMove(pan.event(100,80));pan.flush();
  pan.view.finishMarqueeFromDocument(pan.event(100,80));assert.ok(pan.view.gesture);assert.equal(pan.calls.persist,0);
  pan.view.pointerUp(pan.event(100,80));assert.equal(pan.view.gesture,undefined);assert.equal(pan.calls.persist,1);
});

test('a section draft released through document and stage creates at most one section, and cancellation creates none',()=>{
  for(const cancelled of [false,true]){
    const f=fixture(),created:unknown[]=[];f.view.sectionTool=true;f.view.newSection=(_point:unknown,rect:unknown)=>created.push(rect);
    f.view.pointerDown(f.event());const release=f.event(240,180);
    f.view.finishMarqueeFromDocument(release,cancelled);f.view.pointerUp(release,cancelled);
    assert.deepEqual(created,cancelled?[]:[{x:0,y:0,width:240,height:180}]);
    assert.equal(f.view.marquee,undefined);assert.equal(f.calls.inspector,1);
  }
});
