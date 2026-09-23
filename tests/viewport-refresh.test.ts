import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';
const source=readFileSync(process.env.VIEWPORT_SOURCE||'src/main.ts','utf8');
const method=(a:string,b:string)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(){
 const frames=new Map<number,()=>void>();let id=0,writes=0;const calls:boolean[]=[];
 const View=new Function('requestAnimationFrame','cancelAnimationFrame','visibleGridSize',transformSync('class View{'+method('  private scheduleRender(', '  private clearNodes(')+method('  private transform()', '  private sourcePopover')+'};return View',{loader:'ts'}).code)((fn:()=>void)=>{frames.set(++id,fn);return id},(n:number)=>frames.delete(n),()=>20);
 const ownerWindow={requestAnimationFrame:(fn:()=>void)=>{frames.set(++id,fn);return id},cancelAnimationFrame:(n:number)=>frames.delete(n)};
 const v=new View();v.contentEl={ownerDocument:{defaultView:ownerWindow}};v.renderFrame=0;v.viewportOnlyRender=true;v.closed=false;v.session={board:{viewport:{x:0,y:0,zoom:1}}};
 v.world={style:new Proxy({}, {set(t,k,value){writes++;return Reflect.set(t,k,value)}})};v.stage={style:{},ownerDocument:{defaultView:ownerWindow}};v.plugin={settings:{gridStep:20}};v.zoomLabel={textContent:'100%',setText(){writes++}};v.mapViewport=()=>writes++;
 v.renderBoard=(only=false)=>calls.push(only);
 return {v,frames,calls,writes:()=>writes,flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}};
}
test('120 camera inputs schedule one viewport-only frame without synchronous DOM writes',()=>{const f=fixture();for(let i=0;i<120;i++){f.v.session.board.viewport.x=i;f.v.transform();}assert.equal(f.frames.size,1);assert.equal(f.writes(),0);f.flush();assert.deepEqual(f.calls,[true]);assert.equal(f.v.session.board.viewport.x,119);});
test('content refresh upgrades a pending camera frame and cannot be downgraded',()=>{const f=fixture();f.v.scheduleRender(true);f.v.scheduleRender();f.v.scheduleRender(true);f.flush();assert.deepEqual(f.calls,[false]);f.v.scheduleRender(true);f.flush();assert.deepEqual(f.calls,[false,true]);});
test('closed boards do not enqueue viewport work',()=>{const f=fixture();f.v.closed=true;f.v.transform();assert.equal(f.frames.size,0);assert.equal(f.writes(),0);});
test('multiple content notifications still coalesce into a single full refresh',()=>{const f=fixture();for(let i=0;i<50;i++)f.v.scheduleRender();f.flush();assert.deepEqual(f.calls,[false]);});
test('active mindmap editor uses the replaced live viewport when restoring a view',()=>{
 const View=new Function('dragDisplayBoard',transformSync('class View{'+method('  private displayBoard()', '  private renderEdges(')+'};return View',{loader:'ts'}).code)((b:unknown)=>b);
 const v=new View(),live={x:200,y:100,zoom:.8};v.session={board:{viewport:live}};v.inlineTarget='editing';v.inlineLayout={nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}};
 assert.equal(v.displayBoard().viewport,live);
});
test('panning paints in the existing pointer frame rather than waiting another frame',()=>{
 const f=fixture();const methods=new Function('requestAnimationFrame','cancelAnimationFrame',transformSync('class View{'+method('  private pointerMove(', '  private pointerUp(')+'};return View.prototype',{loader:'ts'}).code)((fn:()=>void)=>{f.frames.set(99,fn);return 99},(id:number)=>f.frames.delete(id));
 for(const name of ['pointerMove','flushPointer','applyPointerMove'])f.v[name]=methods[name];
 Object.assign(f.v,{mode:'select',pointerFrame:0,gesture:{id:1,x:0,y:0,pan:true,before:{viewport:{x:0,y:0,zoom:1}}}});f.v.stage.setPointerCapture=()=>{};
 f.v.pointerMove({pointerId:1,clientX:40,clientY:50});f.flush();assert.deepEqual(f.calls,[true]);assert.equal(f.frames.size,0);assert.deepEqual(f.v.session.board.viewport,{x:40,y:50,zoom:1});
});
