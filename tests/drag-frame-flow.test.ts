import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board,type Card} from '../src/model';
import * as draft from '../src/drag-draft';
import * as targets from '../src/drag-targets';
import * as controls from '../src/canvas-controls';
import * as experience from '../src/board-experience';
import * as inline from '../src/inline-geometry';
import * as mindmap from '../src/mindmap';
import * as sections from '../src/sections';
import * as selections from '../src/selection-edges';
import * as connections from '../src/connections';

// Exercise the actual pointer, projection, snap preview and edge controller.
// Only native DOM writes and the final SVG layer are bounded substitutes.
const source=readFileSync(process.env.DRAG_FRAME_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,`Missing method: ${start}`);return source.slice(a,b);
}
const methods=take('  private displayBoard()','  private labelEdge(')
 +take('  private previewGridLanding(','  private syncSelectionTool(')
 +take('  private applyPointerMove(','  private pointerUp(');
const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:150,height:100,color:'sand',...extra});
function fixture(nodes:Card[],ids:ReadonlySet<string>,snapToGrid=true){
 const stats={displayBuilds:0,projectedNodes:0,edgeFrames:0,textWrites:0,styleWrites:0,classWrites:0};
 const snapBoards:Board[]=[],edgeInputs:Board[]=[],rendered:Board[]=[];
 const deps={...targets,...controls,...experience,...inline,...mindmap,...sections,...selections,...connections,...draft,
  dragDisplayBoard:(board:Board,...args:Parameters<typeof draft.dragDisplayBoard> extends [Board,...infer A]?A:never)=>{
   stats.displayBuilds++;stats.projectedNodes+=board.nodes.length;return draft.dragDisplayBoard(board,...args);
  },
  gridLanding:(board:Board,...args:Parameters<typeof controls.gridLanding> extends [Board,...infer A]?A:never)=>{
   snapBoards.push(board);return controls.gridLanding(board,...args);
  },
  visibleBranchBoard:(board:Board)=>{edgeInputs.push(board);return mindmap.visibleBranchBoard(board);}
 };
 const View=new Function(...Object.keys(deps),transformSync(`return class View{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
 const element=()=>{
  const classes=new Set<string>(),authoredStyle:Record<string,string>={};
  return{authoredStyle,textContent:'',setText(value:string){stats.textWrites++;this.textContent=value;},
   style:new Proxy({} as Record<string,string>,{set(target,key:string,value:string){stats.styleWrites++;authoredStyle[key]=value;target[key]=value.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?(?=px)/gi,n=>String(Number(Number(n).toPrecision(6)))).replace(/,\s*/g,', ');return true;}}),
   classList:{contains:(name:string)=>classes.has(name),toggle(name:string,on:boolean){stats.classWrites++;if(on)classes.add(name);else classes.delete(name);}}
  };
 };
 const board:Board={...emptyBoard(),version:3,snapToGrid,nodes},before=draft.dragStartSnapshot(board),svg={},view=new View();
 Object.assign(view,{session:{board},stage:{clientWidth:1000,clientHeight:800,setPointerCapture(){}},
  plugin:{settings:{dragThreshold:4,axisLock:true,alignmentGuides:false,gridStep:16}},snapTarget:element(),snapReadout:element(),svg,
  edgeLayer:{root:svg,render(display:Board){stats.edgeFrames++;rendered.push(display);}},endpointPorts:new Map(),positions:new Map(),selected:ids,drawAlignmentGuides(){},
  gesture:{id:1,x:0,y:0,before,originals:new Map(before.nodes.map(n=>[n.id,n])),
   draft:new Map(before.nodes.filter(n=>ids.has(n.id)&&!n.locked).map(n=>[n.id,{...n}])),
   idSet:ids,ids:[...ids],targets:targets.dragTargets(board.nodes,ids),pan:false}
 });
 const move=(x:number,y:number,extra:Record<string,unknown>={})=>view.applyPointerMove({pointerId:1,clientX:x,clientY:y,shiftKey:false,altKey:false,...extra});
 return{view,board,stats,snapBoards,edgeInputs,rendered,move};
}

test('120 grid-enabled drag frames share one current display projection per frame',t=>{
 const f=fixture(Array.from({length:1200},(_,i)=>node('n'+i,i%40*200,Math.floor(i/40)*140)),new Set(['n1199']));
 const saved=structuredClone(f.board);
 for(let i=0;i<120;i++)f.move(20+i,30+i);
 t.diagnostic(JSON.stringify(f.stats));
 assert.equal(f.stats.displayBuilds,120);assert.equal(f.stats.projectedNodes,144000);assert.equal(f.stats.edgeFrames,120);
 assert.equal(f.snapBoards.length,120);assert.equal(f.edgeInputs.length,120);
 for(let i=0;i<120;i++){
  assert.equal(f.snapBoards[i],f.edgeInputs[i],'snap and edge geometry must consume the same frame overlay');
  assert.equal(f.snapBoards[i].nodes[1199].x,saved.nodes[1199].x+20+i);
  if(i)assert.notEqual(f.snapBoards[i],f.snapBoards[i-1],'no overlay survives the next frame');
 }
 assert.deepEqual(f.board,saved,'preview never mutates persistent geometry');
});

test('unchanged grid landing writes its DOM once and updates on cells, viewport and visibility changes',t=>{
 const f=fixture([node('a',7786,4060)],new Set(['a']));
 for(let i=0;i<120;i++)f.move(24+i/100,30);
 t.diagnostic(JSON.stringify(f.stats));
 assert.deepEqual({text:f.stats.textWrites,style:f.stats.styleWrites,classes:f.stats.classWrites},{text:1,style:3,classes:2});
 assert.equal(f.view.snapReadout.textContent,'吸附落点  7808, 4096');
 f.move(40,46);assert.equal(f.view.snapReadout.textContent,'吸附落点  7824, 4112');assert.equal(f.stats.textWrites,2);
 const count=f.stats.styleWrites;f.board.viewport={x:20,y:30,zoom:.5};f.move(40,46);
 assert.ok(f.stats.styleWrites>count,'camera changes still position the marker');
 f.board.snapToGrid=false;f.move(50,60);assert.equal(f.view.snapTarget.classList.contains('is-visible'),false);assert.equal(f.view.snapReadout.classList.contains('is-visible'),false);
 const hidden=f.stats.classWrites;f.move(51,61);assert.equal(f.stats.classWrites,hidden);
 f.board.snapToGrid=true;f.move(52,62);assert.equal(f.view.snapTarget.classList.contains('is-visible'),true);
});

test('multi-selection snap keeps live board order, locked objects and folded geometry intact',()=>{
 const nodes=[node('locked',-50,-60,{locked:true}),node('frame',-30,-20,{kind:'section',width:600,height:400,sectionFolded:true}),node('child',40,70)];
 const ids=new Set(['child','locked','frame']),f=fixture(nodes,ids),saved=structuredClone(f.board);
 f.move(25,38);
 const expected=draft.dragDisplayBoard(f.board,f.view.gesture.draft),landing=controls.gridLanding(expected,ids,16)!;
 assert.deepEqual(f.snapBoards[0],expected);assert.equal(f.edgeInputs[0],f.snapBoards[0]);
 assert.equal(f.view.snapReadout.textContent,`吸附落点  ${landing.x}, ${landing.y}`);
 assert.deepEqual([landing.x,landing.y],[-0,16],'first unlocked selected board object remains the anchor');
 const frame=f.rendered[0].nodes.find(n=>n.id==='frame')!;
 assert.deepEqual([frame.width,frame.height],[320,72]);assert.equal(f.rendered[0].nodes.some(n=>n.id==='child'),false);
 assert.deepEqual(f.board,saved);assert.deepEqual(f.snapBoards[0].nodes[0],saved.nodes[0]);
});

test('fractional zoom retains full authored coordinates while text and visibility remain stable',()=>{
 const f=fixture([node('a')],new Set(['a']));f.board.viewport={x:.123456789012,y:1.23456789012,zoom:.7333333333333};
 for(let i=0;i<120;i++)f.move(24+i/100,30);
 assert.deepEqual({text:f.stats.textWrites,classes:f.stats.classWrites},{text:1,classes:2});
 const v=f.board.viewport;assert.equal(f.view.snapTarget.authoredStyle.transform,`translate(${32*v.zoom+v.x}px, ${48*v.zoom+v.y}px)`);
 // CSSOM can round reads, so remaining fractional style writes are allowed;
 // the optimization must not lower the precision that the browser receives.
 assert.equal(f.view.snapTarget.style.transform,'translate(23.5901px, 36.4346px)');
});

test('grid-disabled and Alt-suppressed drag frames still render one fresh overlay',()=>{
 for(const disabled of [true,false]){
  const f=fixture([node('a'),node('b',300)],new Set(['a']),!disabled);
  f.board.edges.push({id:'ab',from:'a',to:'b',label:''});
  f.move(25,35,{altKey:!disabled});f.move(45,55,{altKey:!disabled});
  assert.equal(f.stats.displayBuilds,2);assert.equal(f.stats.edgeFrames,2);assert.equal(f.snapBoards.length,0);
  assert.equal(f.rendered[1].nodes[0].x,45);assert.equal(f.view.snapTarget.classList.contains('is-visible'),false);
 }
});

test('unconnected drag frames skip unused overlays while still positioning live mounted nodes',t=>{
 for(const snap of [false,true]){
  const nodes=Array.from({length:1200},(_,i)=>node('n'+i,i%40*200,Math.floor(i/40)*140)),f=fixture(nodes,new Set(['n1199']),snap),saved=structuredClone(f.board);
  const element={},positions:Card[]=[];f.view.positions.set('n1199',element);f.view.positionNode=(n:Card,el:unknown)=>{assert.equal(el,element);positions.push(n);};
  for(let frame=0;frame<120;frame++)f.move(20+frame,30+frame,{altKey:snap});
  t.diagnostic(`120 empty-edge ${snap?'Alt-suppressed':'free'} frames: ${JSON.stringify(f.stats)}`);
  assert.equal(f.stats.displayBuilds,0);assert.equal(f.stats.projectedNodes,0);assert.equal(f.stats.edgeFrames,120);assert.equal(f.snapBoards.length,0);
  assert.equal(positions.length,120);assert.equal(positions[119].x,saved.nodes[1199].x+139);assert.equal(positions[119].y,saved.nodes[1199].y+149);
  assert.deepEqual(f.board,saved);assert.equal(f.view.snapTarget.classList.contains('is-visible'),false);
 }
});

test('drag projections follow current grid and edge consumers and still clear stale endpoint ports',()=>{
 const f=fixture([node('a'),node('b',300)],new Set(['a']),false),oldPort={removed:0,title:'',removeClass(){this.removed++;},setAttribute(_name:string,value:string){this.title=value;}};
 f.view.selectedEdge='deleted';f.view.endpointPorts.set(oldPort,'拖动重接起点');f.move(20,30);
 assert.equal(f.stats.displayBuilds,0);assert.equal(oldPort.removed,1);assert.equal(oldPort.title,'拖动到目标建立连线，也可依次点击两端');assert.equal(f.view.endpointPorts.size,0);
 f.board.snapToGrid=true;f.move(30,40);assert.equal(f.stats.displayBuilds,1);assert.equal(f.snapBoards.at(-1)?.nodes[0].x,30);
 f.board.snapToGrid=false;f.board.edges.push({id:'ab',from:'a',to:'b',label:''});f.move(40,50);assert.equal(f.stats.displayBuilds,2);assert.equal(f.rendered.at(-1)?.nodes[0].x,40);assert.equal(f.view.snapTarget.classList.contains('is-visible'),false);
 f.board.edges=[];f.move(50,60);assert.equal(f.stats.displayBuilds,2);assert.equal(f.rendered.at(-1)?.edges.length,0);assert.equal(f.stats.edgeFrames,4);
});

test('inline layout edges independently require fresh drag geometry and the current viewport',()=>{
 const f=fixture([node('a'),node('b',300)],new Set(['a']),false);
 f.view.inlineTarget='b';f.view.inlineLayout={...f.board,nodes:[f.board.nodes[0],{...f.board.nodes[1],x:600}],edges:[{id:'ab',from:'a',to:'b',label:''}],viewport:{x:-100,y:-100,zoom:.2}};
 f.board.viewport={x:20,y:30,zoom:2};f.move(40,60);assert.equal(f.stats.displayBuilds,1);assert.equal(f.rendered[0].viewport,f.board.viewport);assert.equal(f.rendered[0].nodes[0].x,20);assert.equal(f.rendered[0].nodes[1].x,600);
 f.view.inlineLayout.edges=[];f.board.viewport={x:30,y:40,zoom:1};f.move(50,60);assert.equal(f.stats.displayBuilds,1);assert.equal(f.rendered[1].viewport,f.board.viewport);assert.equal(f.rendered[1].edges.length,0);
});

test('frame overlays retain inline layout and the current shared viewport',()=>{
 const f=fixture([node('a'),node('b',300)],new Set(['a']));
 f.view.inlineTarget='b';f.view.inlineLayout={...f.board,nodes:[...f.board.nodes.slice(0,1),{...f.board.nodes[1],x:600}],viewport:{x:-100,y:-100,zoom:.2}};
 f.board.viewport={x:20,y:30,zoom:2};f.move(40,60);
 assert.equal(f.snapBoards[0].viewport,f.board.viewport);assert.equal(f.edgeInputs[0],f.snapBoards[0]);
 assert.equal(f.rendered[0].nodes[0].x,20);assert.equal(f.rendered[0].nodes[1].x,600);
});

test('the next frame observes reordered, replaced and newly locked live objects',()=>{
 const f=fixture([node('a'),node('b',300)],new Set(['a','b']));
 f.move(25,35);assert.equal(f.view.snapReadout.textContent,'吸附落点  32, 32');
 f.board.nodes=[{...f.board.nodes[1],text:'latest shared text'},f.board.nodes[0]];
 f.move(40,60);assert.equal(f.view.snapReadout.textContent,'吸附落点  336, 64');
 assert.equal(f.snapBoards[1].nodes[0].text,'latest shared text');assert.equal(f.edgeInputs[1],f.snapBoards[1]);
 f.board.nodes[0].locked=true;f.move(55,75);
 assert.equal(f.view.snapReadout.textContent,'吸附落点  48, 80');
 assert.equal(f.snapBoards[2].nodes[0],f.board.nodes[0],'live locking suppresses that draft geometry');
 assert.equal(f.snapBoards[2].nodes[0].x,300);assert.equal(f.edgeInputs[2],f.snapBoards[2]);
});
