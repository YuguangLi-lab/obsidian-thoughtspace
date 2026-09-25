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
  +take('  private displayBoard()', '  private renderEdges(')
  +take('  private clearCanvasGesture(', '  private syncCanvasControls(')
  +take('  private contextMenu(', '  /** Compact native context menu;')
  +take('  private pointerDown(', '  private matches(');

class Element {
  style:Record<string,string>={};dataset:Record<string,string>={};removed=false;
  classes=new Set<string>();
  classList={contains:(name:string)=>this.classes.has(name),toggle:(name:string,on:boolean)=>this.toggleClass(name,on)};
  constructor(readonly selectors:Record<string,Element>={}){}
  closest(selector:string){return this.selectors[selector]||null;}
  getAttribute(name:string){return name==='data-id'?this.dataset.id:name==='data-edge'?this.dataset.edge:null;}
  toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
  addClass(name:string){this.classes.add(name);}
  removeClass(name:string){this.classes.delete(name);}
  querySelectorAll(){return [];}
  remove(){this.removed=true;}
}

const node=(id:string,x:number,y=20,patch:Partial<model.Card>={}):model.Card=>({id,kind:'card',file:`${id}.md`,x,y,width:80,height:60,color:'sand',...patch});
function fixture(nodes:model.Card[]=[node('a',20),node('b',150),node('old',500)]){
  const frames=new Map<number,()=>void>();let frameId=0,now=1000;
  const calls={inspector:0,controls:0,render:0,schedule:0,persist:0,writes:0,history:0,menus:0,focus:0};
  const menus:{node?:string;edge?:string;position?:{x:number;y:number}}[]=[];
  class Menu {onHide(){}hide(){}showAtMouseEvent(){calls.menus++;}}
  const deps={...model,...mindmap,...boardTools,...dragDraft,...dragTargets,...experience,validSectionRect,
    Menu,
    Date:{now:()=>now},
    PointerEvent:class {constructor(_type:string,fields:Record<string,unknown>){Object.assign(this,fields);}},
    requestAnimationFrame:(fn:()=>void)=>{frames.set(++frameId,fn);return frameId;},
    cancelAnimationFrame:(id:number)=>frames.delete(id)};
  const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
  const view=new View(),board={...model.emptyBoard(),nodes,viewport:{x:0,y:0,zoom:1}};
  const capture=new Set<number>(),boxes:Element[]=[];
  const stage=Object.assign(new Element(),{ownerDocument:{defaultView:deps},clientWidth:1000,clientHeight:700,focus(){calls.focus++;},
    setPointerCapture:(id:number)=>capture.add(id),hasPointerCapture:(id:number)=>capture.has(id),releasePointerCapture:(id:number)=>capture.delete(id)});
  Object.assign(view,{session:{board,blocked:false,persist(){calls.persist++;},change(fn:(b:model.Board)=>void){calls.writes++;fn(board);}},
    selected:new Set(['old']),selectionTool:true,space:false,mode:'select',pointerFrame:0,dragging:false,
    stage,world:{createDiv(){const box=new Element();boxes.push(box);return box;}},svg:new Element(),
    positions:new Map(nodes.map(n=>[n.id,new Element()])),pendingFits:new Map(),nodeFitQueue:{schedule(){}},
    plugin:{settings:{axisLock:true,alignmentGuides:false,gridStep:24}},viewTrail:{remember(){calls.history++;}},
    point(x:number,y:number){const v=board.viewport;return {x:(x-v.x)/v.zoom,y:(y-v.y)/v.zoom};},
    syncCanvasControls(){calls.controls++;},renderInspector(){calls.inspector++;},renderBoard(){calls.render++;},scheduleRender(){calls.schedule++;},
    cancelConnection(){view.mode='select';view.connectFrom=undefined;},previewGridLanding(){},drawAlignmentGuides(){},setSectionTool(){},
    renderObjectActions(_menu:Menu,n?:model.Card,e?:model.Edge,position?:{x:number;y:number}){menus.push({node:n?.id,edge:e?.id,position});}});
  function event(x=0,y=0,extra:Record<string,unknown>={}){return {pointerId:1,button:0,clientX:x,clientY:y,target:new Element(),shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,preventDefault(){},stopPropagation(){},...extra};}
  function flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}
  return {view,board,calls,capture,boxes,frames,menus,event,flush,advance(ms:number){now+=ms;}};
}
const ids=(view:any)=>[...view.selected].sort();

test('blank-canvas left drag pans without modifiers, retaining selection and leaving object geometry unchanged',()=>{
  const f=fixture();f.view.selectionTool=false;f.view.selectedEdge='selected-edge';const before=structuredClone(f.board.nodes);f.view.pointerDown(f.event());
  assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture.pan,true);
  f.view.pointerMove(f.event(240,100));f.flush();f.view.pointerUp(f.event(240,100));
  assert.deepEqual(ids(f.view),['old']);assert.equal(f.view.selectedEdge,'selected-edge');assert.deepEqual(f.board.viewport,{x:240,y:100,zoom:1});
  assert.deepEqual(f.board.nodes,before);assert.equal(f.calls.persist,1);assert.equal(f.calls.writes,0);assert.equal(f.capture.size,0);
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
  const f=fixture();f.view.selectionTool=false;f.view.selectedEdge='edge';f.view.pointerDown(f.event(300,200));assert.deepEqual(ids(f.view),['old']);f.view.pointerUp(f.event(300,200));
  assert.deepEqual(ids(f.view),[]);assert.equal(f.view.selectedEdge,undefined);
  assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});assert.equal(f.calls.persist,0);assert.equal(f.calls.writes,0);
});

test('right drag from blank canvas selects at final release without moving the camera or nodes',()=>{
  const f=fixture();f.view.selectionTool=false;const before=structuredClone(f.board.nodes);
  f.view.pointerDown(f.event(0,0,{button:2}));assert.equal(f.view.marquee,undefined);assert.deepEqual(ids(f.view),['old']);assert.equal(f.calls.focus,1,'the pending gesture must receive Escape even if another editor was focused');
  f.view.pointerUp(f.event(240,100,{button:2}));
  assert.deepEqual(ids(f.view),['a','b']);assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});assert.deepEqual(f.board.nodes,before);
  f.view.contextMenu(f.event(240,100,{button:2}));assert.equal(f.calls.menus,0);assert.deepEqual(ids(f.view),['a','b']);assert.equal(f.capture.size,0);
});

test('contextmenu delivered on press is held until right click or drag is known',()=>{
  for(const dragged of [false,true]){
    const f=fixture();f.view.selectionTool=false;f.view.pointerDown(f.event(0,0,{button:2}));
    f.view.contextMenu(f.event(0,0,{button:2}));assert.equal(f.calls.menus,0);assert.deepEqual(ids(f.view),['old']);
    if(dragged){f.view.pointerMove(f.event(240,100,{button:2}));f.flush();}
    f.view.pointerUp(f.event(dragged?240:1,dragged?100:1,{button:2}));
    assert.equal(f.calls.menus,dragged?0:1);assert.deepEqual(ids(f.view),dragged?['a','b']:[]);
    f.view.contextMenu(f.event(dragged?240:1,dragged?100:1,{button:2}));assert.equal(f.calls.menus,dragged?0:1,'late native contextmenu must not duplicate the menu');
  }
});

test('right click with sub-threshold jitter shows one menu even when contextmenu arrives after release',()=>{
  const f=fixture();f.view.selectionTool=false;f.view.pointerDown(f.event(0,0,{button:2}));f.view.pointerMove(f.event(2,2,{button:2}));f.flush();
  assert.equal(f.view.marquee,undefined);assert.equal(f.capture.size,0);assert.deepEqual(ids(f.view),['old']);
  f.view.pointerUp(f.event(2,2,{button:2}));f.view.contextMenu(f.event(2,2,{button:2}));
  assert.equal(f.calls.menus,1);assert.equal(f.calls.persist,0);assert.equal(f.calls.writes,0);
});

test('a fresh right click after a right drag is not swallowed, including a card menu',()=>{
  const f=fixture();f.view.pointerDown(f.event(0,0,{button:2}));f.view.pointerUp(f.event(240,100,{button:2}));
  f.view.contextMenu(f.event(240,100,{button:2}));assert.equal(f.calls.menus,0);
  const card=new Element();card.dataset.id='a';const target=new Element({'[data-id]':card});
  f.view.pointerDown(f.event(30,30,{button:2,target}));f.view.contextMenu(f.event(30,30,{button:2,target}));
  assert.equal(f.calls.menus,1);assert.equal(f.menus[0].node,'a');assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture,undefined);
});

test('macOS Control-click after a right marquee opens its menu without starting another gesture',()=>{
  const f=fixture();f.view.pointerDown(f.event(0,0,{button:2}));f.view.pointerUp(f.event(240,100,{button:2}));
  f.view.contextMenu(f.event(240,100,{button:2}));assert.equal(f.calls.menus,0);
  const card=new Element();card.dataset.id='a';const target=new Element({'[data-id]':card});
  f.view.pointerDown(f.event(30,30,{button:0,ctrlKey:true,target}));
  assert.equal(f.view.rightMarquee,undefined);assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture,undefined);
  f.view.contextMenu(f.event(30,30,{button:2,ctrlKey:true,target}));
  assert.equal(f.calls.menus,1);assert.equal(f.menus[0].node,'a');assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});
});

test('right dragging on a card never starts an object move or moves its geometry',()=>{
  const f=fixture(),card=new Element();card.dataset.id='a';const before=structuredClone(f.board.nodes),target=new Element({'[data-id]':card});
  f.view.pointerDown(f.event(30,30,{button:2,target}));f.view.pointerMove(f.event(240,100,{button:2,target}));f.flush();f.view.pointerUp(f.event(240,100,{button:2,target}));
  assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture,undefined);assert.deepEqual(f.board.nodes,before);assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});
});

test('Escape restores the previous selection for pending and active right marquees and suppresses release menus',()=>{
  for(const dragged of [false,true]){
    const f=fixture();f.view.selectedEdge='edge';f.view.pointerDown(f.event(0,0,{button:2}));
    if(dragged){f.view.pointerMove(f.event(240,100,{button:2}));f.flush();assert.deepEqual(ids(f.view),['a','b']);}
    f.view.key({key:'Escape',target:new Element(),preventDefault(){}});
    f.view.pointerUp(f.event(240,100,{button:2}));f.view.contextMenu(f.event(240,100,{button:2}));
    assert.deepEqual(ids(f.view),['old']);assert.equal(f.view.selectedEdge,'edge');assert.equal(f.calls.menus,0);assert.equal(f.capture.size,0);assert.equal(f.frames.size,0);
  }
});

test('holding the right button after Escape cannot revive a cancelled menu when eventually released',()=>{
  const f=fixture();f.view.pointerDown(f.event(0,0,{button:2}));f.view.pointerMove(f.event(240,100,{button:2}));f.flush();
  f.view.key({key:'Escape',target:new Element(),preventDefault(){}});f.advance(5000);
  f.view.pointerUp(f.event(240,100,{button:2}));f.view.contextMenu(f.event(240,100,{button:2}));
  assert.equal(f.calls.menus,0);assert.deepEqual(ids(f.view),['old']);
  f.view.pointerDown(f.event(300,200,{button:2}));f.view.pointerUp(f.event(300,200,{button:2}));f.view.contextMenu(f.event(300,200,{button:2}));
  assert.equal(f.calls.menus,1,'a new physical click restores the ordinary menu');
});

test('pointer cancellation and lost capture cancel right selection once without accepting or showing a menu',()=>{
  for(const lost of [false,true]){
    const f=fixture();f.view.pointerDown(f.event(0,0,{button:2}));f.view.pointerMove(f.event(240,100,{button:2}));f.flush();
    if(lost){f.capture.clear();f.view.pointerCaptureLost(f.event(240,100,{button:2}));}else f.view.finishMarqueeFromDocument(f.event(240,100,{button:2}),true);
    f.view.pointerUp(f.event(240,100,{button:2}));f.view.contextMenu(f.event(240,100,{button:2}));
    assert.deepEqual(ids(f.view),['old']);assert.equal(f.view.marquee,undefined);assert.equal(f.view.rightMarquee,undefined);assert.equal(f.calls.menus,0);assert.equal(f.capture.size,0);
  }
});

test('right marquee retains Shift additive selection and board-space geometry at non-default zoom',()=>{
  const f=fixture();Object.assign(f.board.viewport,{x:400,y:200,zoom:.5});
  f.view.pointerDown(f.event(520,250,{button:2,shiftKey:true}));f.view.finishMarqueeFromDocument(f.event(400,200,{button:2,shiftKey:true}));
  assert.deepEqual(ids(f.view),['a','b','old']);assert.deepEqual(f.board.viewport,{x:400,y:200,zoom:.5});assert.equal(f.calls.writes,0);assert.equal(f.calls.persist,0);
});

test('touch left dragging pans by default while the explicit selection tool and Shift keep marquee access',()=>{
  const f=fixture();f.view.selectionTool=false;f.view.pointerDown(f.event(0,0,{pointerType:'touch'}));f.view.pointerUp(f.event(50,70,{pointerType:'touch'}));
  assert.deepEqual(f.board.viewport,{x:50,y:70,zoom:1});
  const explicit=fixture();explicit.view.pointerDown(explicit.event());explicit.view.pointerUp(explicit.event(240,100));assert.deepEqual(ids(explicit.view),['a','b']);
  const shift=fixture();shift.view.selectionTool=false;shift.view.pointerDown(shift.event(0,0,{shiftKey:true}));shift.view.pointerUp(shift.event(110,100,{shiftKey:true}));assert.deepEqual(ids(shift.view),['a','old']);
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

for(const [button,key] of [[0,'leftDrag'],[1,'middleDrag'],[2,'rightDrag']] as const){
 for(const action of ['pan','select','none'])test(`${key} can map blank-canvas dragging to ${action}`,()=>{
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings[key]=action;const before=structuredClone(f.board.nodes);
  f.view.pointerDown(f.event(0,0,{button}));f.view.pointerMove(f.event(240,100,{button,buttons:button===0?1:button===1?4:2}));f.flush();f.view.pointerUp(f.event(240,100,{button}));
  assert.deepEqual(f.board.nodes,before);assert.equal(f.calls.writes,0);assert.equal(f.capture.size,0);
  assert.deepEqual(f.board.viewport,action==='pan'?{x:240,y:100,zoom:1}:{x:0,y:0,zoom:1});
  assert.deepEqual(ids(f.view),action==='select'?['a','b']:['old']);
  assert.equal(f.calls.persist,action==='pan'?1:0);
 });
}

test('blank-canvas custom bindings preserve node left drag, resize, and right menus',()=>{
 for(const leftDrag of ['pan','select','none']){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings.leftDrag=leftDrag;f.view.plugin.settings.rightDrag='pan';
  const card=new Element();card.dataset.id='a';const target=new Element({'[data-id]':card,'.ts-resize':card});
  f.view.pointerDown(f.event(30,30,{target}));assert.equal(f.view.gesture.pan,false);assert.equal(f.view.gesture.resize,'a');
  f.view.pointerUp(f.event(30,30,{target}),true);
  f.view.pointerDown(f.event(30,30,{button:2,target}));assert.equal(f.view.rightMarquee,undefined);assert.equal(f.view.gesture,undefined);
  f.view.contextMenu(f.event(30,30,{button:2,target}));assert.equal(f.calls.menus,1);assert.equal(f.menus[0].node,'a');
 }
});

test('middle mapping never becomes a node move or resize; pan still works over nodes',()=>{
 for(const middleDrag of ['pan','select','none']){
  const f=fixture();f.view.plugin.settings.middleDrag=middleDrag;
  const card=new Element();card.dataset.id='a';const target=new Element({'[data-id]':card,'.ts-resize':card});
  f.view.pointerDown(f.event(30,30,{button:1,target}));
  assert.equal(f.view.marquee,undefined);assert.equal(f.view.gesture?.pan,middleDrag==='pan'?true:undefined);
  if(f.view.gesture)f.view.pointerUp(f.event(30,30,{button:1,target}),true);
 }
});

test('Space, Shift and explicit tools override disabled left dragging on blank canvas',()=>{
 for(const override of ['space','shift','select','section']){
  const f=fixture();f.view.plugin.settings.leftDrag='none';f.view.selectionTool=override==='select';f.view.space=override==='space';f.view.sectionTool=override==='section';
  f.view.pointerDown(f.event(0,0,{shiftKey:override==='shift'}));
  if(override==='space')assert.equal(f.view.gesture.pan,true);
  else assert.ok(f.view.marquee);
  if(override==='section')assert.equal(f.view.marquee.section,true);
 }
});

test('right pan preserves stationary context-menu timing and suppresses menus after a real drag',()=>{
 for(const dragged of [false,true]){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings.rightDrag='pan';f.view.pointerDown(f.event(0,0,{button:2}));
  f.view.contextMenu(f.event(0,0,{button:2}));assert.equal(f.calls.menus,0);
  f.view.pointerUp(f.event(dragged?240:2,dragged?100:2,{button:2}));f.view.contextMenu(f.event(240,100,{button:2}));
  assert.equal(f.calls.menus,dragged?0:1);assert.equal(f.calls.history,dragged?1:0);assert.equal(f.calls.persist,dragged?1:0);
  assert.equal(f.view.rightMarquee,undefined);
 }
});

test('right pan uses original screen coordinates and finishes once through document release',()=>{
 const f=fixture();f.view.selectionTool=false;f.view.plugin.settings.rightDrag='pan';Object.assign(f.board.viewport,{x:400,y:200,zoom:.5});
 f.view.pointerDown(f.event(20,30,{button:2}));f.view.pointerMove(f.event(70,100,{button:2,buttons:2}));f.flush();
 assert.deepEqual(f.board.viewport,{x:450,y:270,zoom:.5});assert.deepEqual(ids(f.view),['old']);assert.equal(f.calls.persist,0);
 const release=f.event(120,140,{button:2});f.view.finishMarqueeFromDocument(release);const after={...f.calls};f.view.pointerUp(release);
 assert.deepEqual(f.board.viewport,{x:500,y:310,zoom:.5});assert.deepEqual(f.calls,after);assert.equal(f.calls.persist,1);assert.equal(f.calls.history,1);assert.equal(f.capture.size,0);
});

test('Escape, pointer cancellation and lost capture restore a right-pan viewport',()=>{
 for(const cancellation of ['escape','pointer','capture']){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings.rightDrag='pan';f.view.selectedEdge='keep';
  f.view.pointerDown(f.event(0,0,{button:2}));f.view.pointerMove(f.event(100,80,{button:2,buttons:2}));f.flush();
  assert.deepEqual(f.board.viewport,{x:100,y:80,zoom:1});
  if(cancellation==='escape')f.view.key({key:'Escape',target:new Element(),preventDefault(){}});
  else if(cancellation==='pointer')f.view.finishMarqueeFromDocument(f.event(100,80,{button:2}),true);
  else f.view.pointerCaptureLost(f.event(100,80,{button:2}));
  f.view.pointerUp(f.event(100,80,{button:2}));f.view.contextMenu(f.event(100,80,{button:2}));
  assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});assert.deepEqual(ids(f.view),['old']);assert.equal(f.view.selectedEdge,'keep');
  assert.equal(f.calls.history,0);assert.equal(f.calls.menus,0);assert.equal(f.capture.size,0);assert.equal(f.frames.size,0);assert.equal(f.view.rightMarquee,undefined);
 }
});

test('malformed or missing drag preferences retain existing defaults',()=>{
 for(const invalid of [undefined,null,'invalid',{},0])for(const [button,key] of [[0,'leftDrag'],[1,'middleDrag'],[2,'rightDrag']] as const){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings[key]=invalid;
  f.view.pointerDown(f.event(0,0,{button}));f.view.pointerUp(f.event(240,100,{button}));
  assert.deepEqual(f.board.viewport,button===2?{x:0,y:0,zoom:1}:{x:240,y:100,zoom:1});
  assert.deepEqual(ids(f.view),button===2?['a','b']:['old']);
 }
});

test('a high custom threshold keeps pan and right selection still until the pointer crosses it',()=>{
 for(const [button,action] of [[0,'pan'],[1,'pan'],[2,'pan'],[2,'select']] as const){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings.dragThreshold=12;f.view.plugin.settings.rightDrag=action;
  const before=structuredClone(f.board.nodes);f.view.pointerDown(f.event(0,0,{button}));
  f.view.pointerMove(f.event(6,6,{button,buttons:button===0?1:button===1?4:2}));f.flush();
  assert.deepEqual(f.board.viewport,{x:0,y:0,zoom:1});assert.deepEqual(ids(f.view),['old']);assert.equal(f.view.marquee,undefined);assert.equal(f.capture.size,0);assert.equal(f.calls.persist,0);
  f.view.pointerMove(f.event(13,4,{button,buttons:button===0?1:button===1?4:2}));f.flush();assert.equal(f.capture.size,1);
  if(action==='pan')assert.deepEqual(f.board.viewport,{x:13,y:4,zoom:1});else{assert.equal(f.view.rightMarquee.moved,true);assert.ok(f.view.marquee);}
  f.view.pointerUp(f.event(13,4,{button}));assert.equal(f.capture.size,0);assert.equal(f.calls.persist,action==='pan'?1:0);assert.deepEqual(f.board.nodes,before);
 }
});
test('node dragging uses screen-pixel threshold before applying zoom-scaled geometry',()=>{
 const f=fixture();f.view.selectionTool=false;f.view.plugin.settings.dragThreshold=12;f.board.viewport.zoom=.5;
 f.view.positionNode=()=>{};f.view.renderEdges=()=>{};
 const card=new Element();card.dataset.id='a';const target=new Element({'[data-id]':card});
 f.view.pointerDown(f.event(0,0,{target}));f.view.pointerMove(f.event(8,0,{target,buttons:1}));f.flush();
 assert.equal(f.view.gesture.draft.get('a').x,20);assert.equal(f.capture.size,0);assert.equal(f.calls.writes,0);
 f.view.pointerMove(f.event(14,0,{target,buttons:1}));f.flush();assert.equal(f.view.gesture.draft.get('a').x,48);assert.equal(f.board.nodes[0].x,20);
 f.view.pointerUp(f.event(14,0,{target}));assert.equal(f.board.nodes[0].x,48);assert.equal(f.calls.writes,1);assert.equal(f.capture.size,0);
});

test('release coalesces pending motion into one final geometry update for every blank drag action',()=>{
 for(const [button,action] of [[0,'pan'],[0,'select'],[1,'pan'],[2,'pan'],[2,'select']] as const){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings[button===0?'leftDrag':button===1?'middleDrag':'rightDrag']=action;
  f.view.pointerDown(f.event(0,0,{button}));
  const apply=f.view.applyPointerMove.bind(f.view),points:number[][]=[];f.view.applyPointerMove=(e:any,force:boolean)=>{points.push([e.clientX,e.clientY]);apply(e,force);};
  for(let i=0;i<120;i++)f.view.pointerMove(f.event(110+i/1000,100,{button,buttons:button===0?1:button===1?4:2}));
  f.view.pointerUp(f.event(240,100,{button,buttons:0}));
  assert.deepEqual(points,[[240,100]],`${button}/${action} must skip the superseded pointer-move`);
  assert.deepEqual(ids(f.view),action==='select'?['a','b']:['old']);
  assert.deepEqual(f.board.viewport,action==='pan'?{x:240,y:100,zoom:1}:{x:0,y:0,zoom:1});
  assert.equal(f.frames.size,0);assert.equal(f.capture.size,0);
 }
});

test('a foreign release or cancellation leaves the owner pointer frame untouched',()=>{
 for(const cancelled of [false,true])for(const action of ['pan','select']){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings.leftDrag=action;
  f.view.pointerDown(f.event());f.view.pointerMove(f.event(110,100,{buttons:1}));
  const queued=f.view.pendingPointer,before={...f.calls};f.view.pointerUp(f.event(800,500,{pointerId:2}),cancelled);
  assert.equal(f.frames.size,1);assert.equal(f.view.pendingPointer,queued);assert.deepEqual(f.calls,before);
  f.flush();f.view.pointerUp(f.event(240,100));assert.deepEqual(ids(f.view),action==='select'?['a','b']:['old']);
 }
});

test('returning near the press before release remains a drag when queued motion already crossed the threshold',()=>{
 for(const [button,action] of [[0,'pan'],[2,'pan'],[2,'select']] as const){
  const f=fixture();f.view.selectionTool=false;f.view.plugin.settings[button===0?'leftDrag':'rightDrag']=action;
  f.view.pointerDown(f.event(0,0,{button}));f.view.pointerMove(f.event(110,100,{button,buttons:button===0?1:2}));
  f.view.pointerUp(f.event(1,1,{button,buttons:0}));
  assert.deepEqual(ids(f.view),action==='pan'?['old']:[],'a completed drag must not become a click');
  assert.deepEqual(f.board.viewport,action==='pan'?{x:1,y:1,zoom:1}:{x:0,y:0,zoom:1});
  assert.equal(f.calls.menus,0);assert.equal(f.frames.size,0);
 }
});

test('a release commits only final card geometry and skips a queued intermediate resize or move',()=>{
 for(const resize of [false,true]){
  const f=fixture();f.view.selectionTool=false;const card=new Element();card.dataset.id='a';
  const target=new Element({'[data-id]':card,...(resize?{'.ts-resize':card}:{})});let paints=0;
  f.view.positionNode=()=>paints++;f.view.renderEdges=()=>{};
  f.view.pointerDown(f.event(0,0,{target}));f.view.pointerMove(f.event(20,15,{target,buttons:1}));
  f.view.pointerUp(f.event(40,30,{target,buttons:0}));
  assert.equal(paints,1);assert.equal(f.calls.writes,1);assert.equal(f.frames.size,0);
  assert.equal(f.board.nodes[0].x,resize?20:60);assert.equal(f.board.nodes[0].y,resize?20:50);
 }
});
