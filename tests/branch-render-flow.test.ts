import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {branchState,visibleBranchBoard} from '../src/mindmap';
import {branchRenderSnapshot} from '../src/branch-render';
import {sectionDisplayNode} from '../src/sections';
import {visibleNodes,viewportRect,intersects} from '../src/rendering';
import {visibleGridSize} from '../src/canvas-controls';
import {inlineDisplayBoard} from '../src/inline-geometry';
import {emptyBoard,type Board,type Card} from '../src/model';

// Execute all four production methods together. Nodes are outside the viewport,
// so DOM/renderer boundaries can be stubbed without replacing visibility work.
const source=readFileSync(process.env.BRANCH_RENDER_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const methods=take('  private renderBoard(', '  private pdfTotals=')
 +take('  private updateBackToContent(', '  private transform()')
 +take('  private renderEdges(', '  private labelEdge(')
 +take('  private renderMinimap(', '  private async importBoardAttachments(');
const deps={branchState,branchRenderSnapshot,visibleBranchBoard,sectionDisplayNode,visibleNodes,viewportRect,intersects,visibleGridSize,inlineDisplayBoard};
const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
const card=(id:string,patch:Partial<Card>={}):Card=>({id,kind:'text',text:'node',x:10000+Number(id)*250,y:10000,width:200,height:100,color:'sand',...patch});
function fixture(size=4){
 const board=emptyBoard();board.version=3;board.nodes=Array.from({length:size},(_,i)=>card(String(i)));board.nodes[0].branchFolded=true;
 const counts={edgeKinds:0,displayBoards:0};
 board.edges=board.nodes.slice(1).map((node,i)=>({id:'e'+i,from:String(i),to:node.id,label:'',get kind(){counts.edgeKinds++;return 'branch' as const;}}));
 const classes=new Set<string>(),svg={},edgeBoards:Board[]=[],mapBoards:Board[]=[],view=new View();
 Object.assign(view,{session:{board,blocked:false},world:{style:{}},svg,stage:{clientWidth:1000,clientHeight:700,style:{}},contentEl:{toggleClass(){}},zoomLabel:{setText(){}},
  selected:new Set(),positions:new Map(),nodeScopes:new Map(),nodeKeys:new Map(),endpointPorts:new Map(),
  plugin:{settings:{gridStep:24,previewLimit:20,detailZoom:.4,showMinimap:true}},
  backToContent:{classList:{contains:(key:string)=>classes.has(key)},toggleClass(key:string,on:boolean){if(on)classes.add(key);else classes.delete(key);}},
  minimap:{empty(){},createSpan(){},toggleClass(){}},edgeLayer:{root:svg,render(display:Board){edgeBoards.push(display);}},
  displayBoard(){counts.displayBoards++;return view.displaySource||view.session.board;},
  syncCanvasControls(){},updateObjectFilter(){},renderSaveStatus(){},renderNavigation(){},renderInspector(){},
  mapPreview(_host:unknown,display:Board){mapBoards.push(display);view.mapViewport=()=>{};}
 });
 return{view,board,counts,edgeBoards,mapBoards,classes,reset(){counts.edgeKinds=counts.displayBoards=0;edgeBoards.length=mapBoards.length=0;}};
}
const ids=(board:Board)=>board.nodes.map(node=>node.id);

test('120 full and camera frames scan each folded branch once across all render consumers',t=>{
 for(const viewportOnly of [false,true]){
  const f=fixture(1200),before=structuredClone(f.board);f.view.renderBoard();f.reset();
  for(let frame=0;frame<120;frame++){f.board.viewport.x=frame;f.view.renderBoard(viewportOnly);}
  t.diagnostic(`${viewportOnly?'camera':'full'}: ${f.counts.edgeKinds} branch edge reads / 120 frames`);
  assert.equal(f.counts.edgeKinds,1199*120,'back-to-content, nodes, edges and minimap share current topology');
  assert.equal(f.counts.displayBoards,120,'edge rendering reuses this frame\'s display geometry');
  assert.equal(f.edgeBoards.length,120);assert.ok(f.edgeBoards.every(board=>board.edges.length===0));
  assert.deepEqual(f.board.nodes,before.nodes);assert.deepEqual(f.board.edges,before.edges);
 }
});

test('a full render shares the exact projection and the next render starts fresh',()=>{
 const f=fixture();f.view.renderBoard();assert.equal(f.edgeBoards[0],f.mapBoards[0]);assert.deepEqual(ids(f.edgeBoards[0]),['0']);
 const first=f.edgeBoards[0];f.view.renderBoard();assert.notEqual(f.edgeBoards[1],first);
 delete f.board.nodes[0].branchFolded;f.view.renderBoard();assert.deepEqual(ids(f.edgeBoards.at(-1)!),['0','1','2','3']);
 assert.equal(f.edgeBoards.at(-1),f.board,'unfolded boards retain the existing no-projection fast path');
});

test('in-place folds, reconnection, deletion and undo-style replacement are fresh on every frame',()=>{
 const f=fixture();delete f.board.nodes[0].branchFolded;f.board.nodes[1].branchFolded=true;f.view.renderBoard();assert.deepEqual(ids(f.edgeBoards.at(-1)!),['0','1']);
 f.board.edges[1].from='0';f.view.renderBoard(true);assert.deepEqual(ids(f.edgeBoards.at(-1)!),['0','1','2','3']);
 f.board.nodes[0].branchFolded=true;f.board.edges.splice(1,1);f.view.renderBoard(true);assert.deepEqual(ids(f.edgeBoards.at(-1)!),['0','2','3']);
 const restored=structuredClone(f.board);restored.edges.push({id:'restored',kind:'branch',from:'0',to:'2',label:''});f.view.session.board=restored;
 f.view.renderBoard();assert.deepEqual(ids(f.edgeBoards.at(-1)!),['0']);assert.equal(f.edgeBoards.at(-1),f.mapBoards.at(-1));
});

test('moving material out of a folded frame changes containment without stale membership',()=>{
 const f=fixture(1),frame=card('frame',{kind:'section',x:10000,y:10000,width:1000,height:1000,sectionFolded:true}),material=card('material',{x:10100,y:10100});
 f.board.nodes=[frame,material];f.view.renderBoard();assert.deepEqual(ids(f.edgeBoards.at(-1)!),['frame']);assert.equal(f.edgeBoards.at(-1)!.nodes[0].height,72);
 material.x=12000;f.view.renderBoard(true);assert.deepEqual(ids(f.edgeBoards.at(-1)!),['frame','material']);
 material.x=10100;f.view.renderBoard(true);assert.deepEqual(ids(f.edgeBoards.at(-1)!),['frame']);
 assert.equal(frame.height,1000,'render projections must not rewrite logical frame bounds');
});

test('saved and display boards retain separate frame membership within the same render',()=>{
 const f=fixture(1),frame=card('frame',{kind:'section',x:10000,y:10000,width:1000,height:1000,sectionFolded:true}),material=card('material',{x:10100,y:10100});
 f.board.nodes=[frame,material];f.view.displaySource={...f.board,nodes:[frame,{...material,x:12000}]};
 f.view.renderBoard();assert.deepEqual(ids(f.mapBoards.at(-1)!),['frame']);assert.deepEqual(ids(f.edgeBoards.at(-1)!),['frame','material']);
 assert.equal(material.x,10100);assert.notEqual(f.mapBoards.at(-1),f.edgeBoards.at(-1));
});

test('inline size overlays get their own visibility and standalone edge refreshes stay live',()=>{
 const f=fixture(1),frame=card('frame',{kind:'section',x:10000,y:10000,width:500,height:1000,sectionFolded:true}),material=card('material',{x:10100,y:10100,width:200});
 f.board.nodes=[frame,material];const snapshot=branchRenderSnapshot();assert.deepEqual(ids(snapshot.visible(f.board)),['frame']);
 f.view.inlineTarget='material';f.view.inlineGeometry={id:'material',width:600,height:100};f.view.renderEdges(snapshot,f.board);
 assert.deepEqual(ids(f.edgeBoards.at(-1)!),['frame','material']);assert.equal(f.edgeBoards.at(-1)!.nodes[1].width,600);assert.equal(material.width,200);
 f.view.inlineGeometry=undefined;f.view.renderEdges();assert.deepEqual(ids(f.edgeBoards.at(-1)!),['frame']);
 material.x=12000;f.view.renderEdges();assert.deepEqual(ids(f.edgeBoards.at(-1)!),['frame','material']);
});

test('direct minimap and back-to-content calls observe changes without a render snapshot',()=>{
 const f=fixture(2);f.view.renderMinimap();f.view.updateBackToContent();assert.deepEqual(ids(f.mapBoards.at(-1)!),['0']);assert.ok(f.classes.has('is-visible'));
 f.board.nodes[1].x=0;f.board.nodes[1].y=0;delete f.board.nodes[0].branchFolded;
 f.view.renderMinimap();f.view.updateBackToContent();assert.deepEqual(ids(f.mapBoards.at(-1)!),['0','1']);assert.equal(f.classes.has('is-visible'),false);
});

test('unfolded projection lookup never builds a branch index until state is requested',()=>{
 const f=fixture();delete f.board.nodes[0].branchFolded;const snapshot=branchRenderSnapshot();f.reset();
 assert.equal(snapshot.visible(f.board),f.board);assert.equal(snapshot.visible(f.board),f.board);assert.equal(f.counts.edgeKinds,0);
 snapshot.state(f.board);snapshot.state(f.board);assert.equal(f.counts.edgeKinds,3);
});
