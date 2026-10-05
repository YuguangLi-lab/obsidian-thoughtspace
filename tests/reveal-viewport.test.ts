import {isBrainBoard} from '../src/brain-board';
import {sectionDisplayNode} from '../src/sections';
import {minimapInsets} from '../src/minimap-avoidance';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {branchState,unfoldAncestors,visibleBranchBoard} from '../src/mindmap';
import {boardSearchIndex,searchBoard} from '../src/board-search';
import * as viewportFit from '../src/viewport-fit';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,`Missing method range: ${start}`);
 return source.slice(a,b);
}
const methods=take('  findOnBoard()','  async copyDeepLink(')
 +take('  private fitContent(','  private updateBackToContent(');

// Real reveal, board-search locate callback and fit methods; host/UI rendering
// are substitutes. Insets match the measured 1000x360 Chromium split fixture.
function fixture({zoom=1,kind='text',width=280,height=80,selected=true}={}){
 const calls={remember:0,transform:0,persist:0,active:0,focus:0,selection:0};
 const node={id:'note',kind,text:'Weekly planning notes',x:1200,y:700,width,height};
 const board={version:3,mode:'free',nodes:[node],edges:[],viewport:{x:0,y:0,zoom}};
 let selectedVisible=selected;
 const rect=(left:number,top:number,right:number,bottom:number)=>({left,top,right,bottom,width:right-left,height:bottom-top});
 const control=(bounds:ReturnType<typeof rect>,visible=()=>true,orientation?:'vertical'|'horizontal')=>({getClientRects:()=>visible()?[bounds]:[],getBoundingClientRect:()=>bounds,getAttribute:(name:string)=>name==='aria-orientation'?orientation??null:null});
 const controls:Record<string,ReturnType<typeof control>>={
  '.ts-floating-formatbar':control(rect(216,14,784,109),()=>selectedVisible),
  '.ts-board-rail':control(rect(14,120,66,260),()=>true,'vertical'),
  '.ts-footer':control(rect(14,304,986,346)),
 };
 class BoardSearchModal{
  modalEl={isConnected:false};
  constructor(_app:unknown,readonly host:any){}
  open(){}
 }
 const deps={isBrainBoard,sectionDisplayNode,minimapInsets,...viewportFit,branchState,unfoldAncestors,visibleBranchBoard,BoardSearchModal};
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View(),owner={board,file:{basename:'QA board'},blocked:false,change:(fn:(board:any)=>void)=>fn(board),persist:()=>calls.persist++};
 Object.assign(view,{measureMinimap(){},session:owner,selected:new Set(selected?[node.id]:[]),selectedEdge:'edge',mode:'connect',connectFrom:'other',connectSide:'right',
  stage:{clientWidth:1000,clientHeight:360,getBoundingClientRect:()=>rect(0,0,1000,360),parentElement:{querySelector:(selector:string)=>controls[selector]},removeClass(){},focus:()=>calls.focus++},
  app:{workspace:{setActiveLeaf:()=>calls.active++}},leaf:{},requireOwner:()=>owner,clearCanvasGesture(){},
  rememberViewport:()=>calls.remember++,transform:()=>calls.transform++,updateSelection:()=>{calls.selection++;selectedVisible=true;},
 });
 const screen=()=>({left:node.x*board.viewport.zoom+board.viewport.x,top:node.y*board.viewport.zoom+board.viewport.y,width:node.width*board.viewport.zoom,height:node.height*board.viewport.zoom});
 return{view,owner,board,node,calls,screen};
}

for(const options of [{zoom:1,kind:'text',width:280,height:80},{zoom:.8,kind:'card',width:300,height:160}])test(`revealing ordinary ${options.kind} in a short split clears controls and preserves zoom`,()=>{
 const f=fixture(options),camera=f.board.viewport;
 f.view.revealNode(f.node.id);
 const screen=f.screen();
 assert.ok(screen.top>=121,`revealed top ${screen.top} must clear the format bar plus padding`);
 assert.ok(screen.top+screen.height<=292,'ordinary object fits above the footer plus padding');
 assert.equal(screen.left+screen.width/2,539);
 assert.equal(screen.top+screen.height/2,206.5);
 assert.equal(f.board.viewport,camera);assert.equal(f.board.viewport.zoom,options.zoom);
 assert.deepEqual([...f.view.selected],[f.node.id]);assert.equal(f.view.selectedEdge,undefined);
 assert.equal(f.view.mode,'select');assert.equal(f.view.connectFrom,undefined);assert.equal(f.view.connectSide,undefined);
 assert.equal(f.calls.remember,1);assert.equal(f.calls.transform,1);assert.equal(f.calls.persist,1);assert.equal(f.calls.active,1);assert.equal(f.calls.focus,1);
});

test('searching after fit keeps the small result outside the format bar at its fitted zoom',async()=>{
 const f=fixture();f.view.fit();const camera=f.board.viewport,zoom=camera.zoom,before=f.screen();
 assert.ok(before.top>=121);
 const modal=f.view.findOnBoard(),result=searchBoard(boardSearchIndex(f.board as any),{query:'Weekly planning',kind:'',group:'',color:''})[0];
 assert.equal(result.id,f.node.id);await modal.host.locate(result.id);
 assert.equal(f.board.viewport,camera);assert.equal(f.board.viewport.zoom,zoom);
 assert.ok(f.screen().top>=121,'search locate must not undo the safe fit center');
 assert.deepEqual(f.view.objectFilter,{kind:'',color:'',query:''});
});

test('reveal measures the selected format bar after the selected state is rendered',()=>{
 const f=fixture({selected:false});f.view.revealNode(f.node.id,false);
 assert.ok(f.screen().top>=121,'newly visible toolbar must participate in reveal positioning');
 assert.equal(f.calls.active,0);assert.equal(f.calls.focus,0);assert.equal(f.calls.persist,1);
});

test('missing or blocked reveal does not change the camera or selected state',()=>{
 for(const blocked of [false,true]){
  const f=fixture(),camera={...f.board.viewport};f.owner.blocked=blocked;
  f.view.revealNode(blocked?f.node.id:'missing');
  assert.deepEqual(f.board.viewport,camera);assert.equal(f.calls.remember,0);assert.equal(f.calls.transform,0);assert.equal(f.calls.persist,0);
 }
});
