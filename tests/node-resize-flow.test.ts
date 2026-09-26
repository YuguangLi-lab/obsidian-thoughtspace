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

// Run the real gesture, commit, and history methods. The DOM/frame clock and vault
// boundary are substitutes; browser hit-testing of the handle is checked natively.
const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing method range: ${start}`);
  return source.slice(a,b);
}
const methods=take('  private pointerDown(', '  private key(')
  +take('  private displayBoard()', '  private renderEdges(')
  +take('  private pointerCaptureLost(', '  private foldSelection(');
const sessionMethods=take('  change(fn:', '  persist() {');
class Element {
  style:Record<string,string>={};dataset:Record<string,string>={};classes=new Set<string>();
  classList={contains:(name:string)=>this.classes.has(name),toggle:(name:string,on:boolean)=>this.toggleClass(name,on)};
  constructor(readonly selectors:Record<string,Element>={}){}
  closest(selector:string){return this.selectors[selector]||null;}
  getAttribute(name:string){return name==='data-id'?this.dataset.id:null;}
  toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
  querySelectorAll(){return [];}
}
const card=(id='card',patch:Partial<model.Card>={}):model.Card=>({id,kind:'card',file:`${id}.md`,x:30,y:50,width:300,height:100,color:'sand',autoFit:true,...patch});
function fixture(nodes:model.Card[]=[card()],zoom=.54,edges:model.Edge[]=[]){
  const frames=new Map<number,()=>void>(),capture=new Set<number>(),notices:string[]=[];
  let frameId=0;
  const calls={persist:0,emit:0,render:0,edges:0,textMeasure:0};
  const deps={...model,...mindmap,...boardTools,...dragDraft,...dragTargets,...experience,
    Notice:class {constructor(message:string){notices.push(message);}},
    requestAnimationFrame:(fn:()=>void)=>{frames.set(++frameId,fn);return frameId;},
    cancelAnimationFrame:(id:number)=>frames.delete(id),
    // Manual resize must not call content measurement or override user height.
    fitTextNode:(node:model.Card)=>{calls.textMeasure++;node.height=86;}};
  const compile=(body:string)=>new Function(...Object.keys(deps),transformSync(body,{loader:'ts'}).code)(...Object.values(deps));
  const View=compile(`class View{${methods}};return View`),Session=compile(`class Session{${sessionMethods}};return Session`);
  const session=new Session();Object.assign(session,{board:{...model.emptyBoard(),nodes,edges,viewport:{x:125,y:75,zoom}},history:new model.History(),blocked:false,
    persist(){calls.persist++;},emit(){calls.emit++;}});
  const view=new View(),positions=new Map(nodes.map(n=>[n.id,new Element()]));
  function position(n:model.Card,el:Element){Object.assign(el.style,{left:`${n.x}px`,top:`${n.y}px`,width:`${n.width}px`,height:`${n.height}px`});}
  const stage=Object.assign(new Element(),{ownerDocument:{defaultView:deps},clientWidth:1000,clientHeight:700,focus(){},
    setPointerCapture:(id:number)=>capture.add(id),hasPointerCapture:(id:number)=>capture.has(id),releasePointerCapture:(id:number)=>capture.delete(id)});
  Object.assign(view,{session,selected:new Set([nodes[0].id]),selectionTool:false,space:false,mode:'select',pointerFrame:0,dragging:false,
    stage,positions,svg:new Element(),contentEl:{},pendingFits:new Map(),nodeFitQueue:{schedule(){}},
    plugin:{settings:{axisLock:true,aspectLock:true,alignmentGuides:false,gridStep:24}},
    syncCanvasControls(){},renderInspector(){},scheduleRender(){},positionNode:position,
    renderBoard(){calls.render++;for(const n of session.board.nodes){const el=positions.get(n.id);if(el)position(n,el);}},
    renderEdges(){calls.edges++;},previewGridLanding(){},drawAlignmentGuides(){}});
  view.renderBoard();calls.render=0;
  function event(dx=0,dy=0,extra:Record<string,unknown>={}){
    const el=new Element();el.dataset.id=nodes[0].id;
    return {pointerId:1,button:0,buttons:1,clientX:400+dx*zoom,clientY:300+dy*zoom,
      target:new Element({'[data-id]':el,'.ts-resize':el}),shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,
      preventDefault(){},stopPropagation(){},...extra};
  }
  function flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}
  const current=()=>session.board.nodes.find((n:model.Card)=>n.id===nodes[0].id) as model.Card;
  return {view,session,calls,capture,frames,positions,notices,event,flush,current};
}
const dimensions=(n:model.Card)=>({width:n.width,height:n.height});
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('a high canvas drag threshold does not delay an explicit resize handle',()=>{
 const f=fixture();f.view.plugin.settings.dragThreshold=12;f.view.pointerDown(f.event());
 f.view.pointerMove(f.event(2,0));f.flush();assert.equal(f.capture.size,0);assert.equal(f.positions.get('card')!.style.width,'300px');
 f.view.pointerMove(f.event(8,0));f.flush();assert.equal(f.capture.size,1);assert.equal(f.positions.get('card')!.style.width,'308px');assert.equal(f.current().width,300);assert.equal(f.calls.persist,0);
 f.view.pointerUp(f.event(8,0));assert.equal(f.current().width,308);assert.equal(f.calls.persist,1);assert.equal(f.capture.size,0);
});

for(const zoom of [.54,1])test(`card resize at zoom ${zoom} previews locally, saves once, and preserves viewport`,()=>{
  const f=fixture([card()],zoom),before=structuredClone(f.session.board);
  f.view.pointerDown(f.event());assert.equal(f.view.gesture.resize,'card');assert.equal(f.capture.size,0);
  for(const dx of [20,40,100])f.view.pointerMove(f.event(dx,50));
  assert.equal(f.frames.size,1,'coalesce multiple moves into one frame');f.flush();
  assert.deepEqual(f.current(),before.nodes[0],'preview must not mutate the saved board');
  assert.equal(f.positions.get('card')!.style.width,'400px');assert.equal(f.calls.edges,1);assert.equal(f.calls.persist,0);
  f.view.pointerUp(f.event(100,50));
  assert.deepEqual(dimensions(f.current()),{width:400,height:150});assert.equal(f.current().autoFit,false);
  assert.deepEqual(f.session.board.viewport,before.viewport);assert.equal(f.calls.persist,1);assert.equal(f.calls.emit,1);
  assert.equal(f.capture.size,0);assert.equal(f.frames.size,0);assert.equal(f.view.gesture,undefined);
  assert.doesNotThrow(()=>model.parseBoard(JSON.stringify(f.session.board)));
});

for(const folded of [false,true])test(`resizing a short parent with branchFolded=${folded} changes only the parent`,()=>{
  const child=card('child',{x:500,y:200,locked:true}),edge:model.Edge={id:'branch',from:'parent',to:'child',kind:'branch',label:''};
  const f=fixture([card('parent',{branchFolded:folded}),child],.54,[edge]);f.view.selected.add('child');
  const expectedChild=structuredClone(child),expectedEdges=structuredClone(f.session.board.edges);
  f.view.pointerDown(f.event());f.view.pointerMove(f.event(80,40));f.flush();f.view.pointerUp(f.event(80,40));
  close(f.current().width,380);close(f.current().height,140);assert.equal(f.current().branchFolded,folded);
  assert.deepEqual(model.clone(f.session.board.nodes[1]),expectedChild);assert.deepEqual(f.session.board.edges,expectedEdges);
  assert.equal(mindmap.branchState(f.session.board).hidden.has('child'),folded);
  f.view.pointerDown(f.event());f.view.pointerUp(f.event(-50,-40));
  close(f.current().width,330);close(f.current().height,100);assert.equal(f.calls.persist,2);
});

test('release coordinates resize even when no animation frame ran; shrink respects card minimums',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(40,20));
  f.view.pointerUp(f.event(100,60));close(f.current().width,400);close(f.current().height,160);assert.equal(f.frames.size,0);
  f.view.pointerDown(f.event());f.view.pointerUp(f.event(-1000,-1000));
  assert.deepEqual(dimensions(f.current()),{width:180,height:100});assert.equal(f.calls.persist,2);f.flush();assert.equal(f.calls.persist,2);
});

test('portal resize preserves its board reference and snap-to-grid does not alter dimensions',()=>{
  const f=fixture([card('portal',{kind:'board',file:'child.thoughtspace',width:320,height:180,autoFit:undefined})],1);
  f.session.board.snapToGrid=true;f.view.pointerDown(f.event());f.view.pointerUp(f.event(37,29));
  assert.deepEqual(dimensions(f.current()),{width:357,height:209});assert.equal(f.current().file,'child.thoughtspace');
  assert.deepEqual({x:f.current().x,y:f.current().y},{x:30,y:50});assert.equal(f.calls.persist,1);
});

for(const kind of ['image','pdf'] as const)test(`${kind} resizing maintains aspect ratio in both directions`,()=>{
  const f=fixture([card(kind,{kind,file:kind==='pdf'?'book.pdf':'photo.png',width:320,height:160,autoFit:undefined})]);
  f.view.pointerDown(f.event());f.view.pointerUp(f.event(80,0));
  close(f.current().width,400);close(f.current().height,200);
  f.view.pointerDown(f.event());f.view.pointerUp(f.event(0,-40));
  close(f.current().width,320);close(f.current().height,160);assert.equal(f.calls.persist,2);
});

test('text resizing preserves both manual dimensions without remeasuring the content',()=>{
  const f=fixture([card('text',{kind:'text',file:'',text:'A wrapped paragraph',autoFit:undefined,autoSize:true})]);
  f.view.pointerDown(f.event());f.view.pointerMove(f.event(100,300));f.flush();
  assert.equal(f.current().autoSize,true);assert.equal(f.calls.textMeasure,0);
  f.view.pointerUp(f.event(100,300));assert.deepEqual(dimensions(f.current()),{width:400,height:400});assert.equal(f.current().autoSize,false);assert.equal(f.current().textAutoHeight,false);
  assert.equal(f.current().text,'A wrapped paragraph');assert.equal(f.calls.persist,1);
});

test('Shift aspect lock applies to card resize without forcing the movement axis lock',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerUp(f.event(150,5,{shiftKey:true}));
  assert.deepEqual(dimensions(f.current()),{width:450,height:150});assert.deepEqual({x:f.current().x,y:f.current().y},{x:30,y:50});
});

for(const lost of [false,true])test(`${lost?'lost capture':'pointer cancel'} restores displayed geometry without saving a pending resize`,()=>{
  const f=fixture(),before=structuredClone(f.session.board);f.view.pointerDown(f.event());f.view.pointerMove(f.event(100,80));f.flush();
  assert.equal(f.positions.get('card')!.style.width,'400px');f.view.pointerMove(f.event(200,120));
  if(lost){f.capture.clear();f.view.pointerCaptureLost(f.event(200,120));}else f.view.pointerUp(f.event(200,120),true);
  f.flush();f.view.pointerUp(f.event(200,120));
  assert.deepEqual(f.session.board,before);assert.equal(f.positions.get('card')!.style.width,'300px');
  assert.equal(f.calls.persist,0);assert.equal(f.frames.size,0);assert.equal(f.capture.size,0);assert.equal(f.view.gesture,undefined);
  f.session.undo();assert.equal(f.calls.persist,0,'cancelled preview must not create an undo entry');
});

test('resize undo and redo restore auto-fit and geometry without losing branch structure or content',()=>{
  const f=fixture([card('parent',{branchFolded:true,text:'retained text'}),card('child',{x:500})],1,[{id:'branch',from:'parent',to:'child',kind:'branch',label:'evidence'}]);
  const before=model.clone(f.session.board);f.view.pointerDown(f.event());f.view.pointerUp(f.event(80,60));const after=model.clone(f.session.board);
  f.session.undo();assert.deepEqual(f.session.board,before);f.session.undo(true);assert.deepEqual(f.session.board,after);
  assert.equal(f.calls.persist,3);assert.equal(f.current().autoFit,false);
});

test('locked nodes cannot be resized even if an old handle is still targeted',()=>{
  const f=fixture([card('card',{locked:true})]),before=structuredClone(f.session.board);
  f.view.pointerDown(f.event());f.view.pointerMove(f.event(100,50));f.flush();f.view.pointerUp(f.event(100,50));
  assert.deepEqual(f.session.board,before);assert.equal(f.calls.persist,0);assert.equal(f.capture.size,0);
});

test('a node locked or resized by another view during a drag rejects the stale geometry',()=>{
  for(const patch of [{locked:true},{width:555}]){
    const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(100,50));f.flush();Object.assign(f.current(),patch);
    const externallyChanged=structuredClone(f.session.board);f.view.pointerUp(f.event(100,50));
    assert.deepEqual(f.session.board,externallyChanged);assert.equal(f.calls.persist,0);assert.equal(f.notices.length,1);
    assert.match(f.notices[0],/本次拖动已取消/);assert.equal(f.capture.size,0);
  }
});

test('sub-threshold clicks and unrelated pointer releases do not commit a resize',()=>{
  const f=fixture();f.view.pointerDown(f.event());f.view.pointerMove(f.event(100,50,{pointerId:2}));f.flush();
  f.view.pointerUp(f.event(100,50,{pointerId:2}));assert.ok(f.view.gesture);assert.equal(f.calls.persist,0);
  f.view.pointerUp(f.event(1,1));assert.equal(f.view.gesture,undefined);assert.deepEqual(dimensions(f.current()),{width:300,height:100});assert.equal(f.calls.persist,0);
});


test('manual resize switches off automatic text height and undo restores the preference',()=>{
 const f=fixture([card('text',{kind:'text',file:'',text:'long content',autoFit:undefined,autoSize:false,textAutoHeight:true})]);
 const before=model.clone(f.session.board);f.view.pointerDown(f.event());f.view.pointerUp(f.event(40,70));
 close(f.current().width,340);close(f.current().height,170);assert.equal(f.current().textAutoHeight,false);assert.equal(f.calls.textMeasure,0);
 const after=model.clone(f.session.board);f.session.undo();assert.deepEqual(f.session.board,before);f.session.undo(true);assert.deepEqual(f.session.board,after);
});

for(const zoom of [.54,1,2])test(`single-line text shrinks to its compact height at zoom ${zoom} and survives history and reload`,()=>{
 const f=fixture([card('text',{kind:'text',file:undefined,text:'123345466',width:206.41015625,height:100,autoFit:undefined,autoSize:false,textAutoHeight:false})],zoom);
 f.session.board.version=3;
 const before=model.clone(f.session.board),expectedViewport={...f.session.board.viewport};
 f.view.pointerDown(f.event());f.view.pointerMove(f.event(0,-80));f.flush();
 assert.equal(f.positions.get('text')!.style.height,'40px','preview follows the upward drag instead of stopping at 100px');
 assert.equal(f.current().height,100,'preview stays local until release');
 f.view.pointerUp(f.event(0,-80));
 assert.deepEqual(dimensions(f.current()),{width:206.41015625,height:40});
 assert.equal(f.current().text,'123345466');assert.equal(f.current().textAutoHeight,false);
 assert.deepEqual(f.session.board.viewport,expectedViewport);assert.equal(f.calls.persist,1);assert.equal(f.calls.textMeasure,0);
 const after=model.clone(f.session.board);assert.deepEqual(model.parseBoard(JSON.stringify(after)).nodes,after.nodes);
 f.session.undo();assert.deepEqual(f.session.board,before);f.session.undo(true);assert.deepEqual(f.session.board,after);
});

for(const topic of [false,true])test(`width-only resize of compact text (topic=${topic}) keeps its short height`,()=>{
 const f=fixture([card('text',{kind:'text',file:undefined,text:'一行文字',width:240,height:40,topic,autoFit:undefined,autoSize:false,textAutoHeight:false})],1);
 f.view.pointerDown(f.event());f.view.pointerUp(f.event(-80,0));
 assert.deepEqual(dimensions(f.current()),{width:160,height:40});
 f.view.pointerDown(f.event());f.view.pointerUp(f.event(-1000,-1000));
 assert.deepEqual(dimensions(f.current()),{width:80,height:40});assert.equal(f.calls.textMeasure,0);
 assert.doesNotThrow(()=>model.assertBoardGeometry(f.session.board));
});

test('Shift resizing compact text preserves its aspect ratio without the note-card minimum height',()=>{
 const f=fixture([card('text',{kind:'text',file:undefined,text:'one line',width:240,height:80,autoFit:undefined,autoSize:false,textAutoHeight:false})],1);
 f.view.pointerDown(f.event());f.view.pointerUp(f.event(-120,-40,{shiftKey:true}));
 assert.deepEqual(dimensions(f.current()),{width:120,height:40});assert.equal(f.current().width/f.current().height,3);
});
test('changing automatic text height in another view cancels an in-flight resize',()=>{
 const f=fixture([card('text',{kind:'text',file:'',autoSize:false,textAutoHeight:false})]);
 f.view.pointerDown(f.event());f.view.pointerMove(f.event(40,70));f.flush();f.current().textAutoHeight=true;
 const before=model.clone(f.session.board);f.view.pointerUp(f.event(40,70));assert.deepEqual(f.session.board,before);assert.equal(f.calls.persist,0);assert.equal(f.notices.length,1);
});
