import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board,type Card,type Edge} from '../src/model';
import {inlineDisplayBoard} from '../src/inline-geometry';
import {visibleBranchBoard} from '../src/mindmap';
import {selectionEdges} from '../src/selection-edges';
import {connectionSides} from '../src/connections';
import {sectionDisplayNode} from '../src/sections';

// Run the actual controller method, with an SVG boundary stub so the endpoint
// lookup count is distinct from EdgeLayer's necessary visible-edge traversal.
const source=readFileSync(process.env.EDGE_ENDPOINT_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('  private renderEdges('),end=source.indexOf('  private labelEdge(',start);
assert.ok(start>=0&&end>start);
const deps={inlineDisplayBoard,visibleBranchBoard,selectionEdges,connectionSides,sectionDisplayNode};
const View=new Function(...Object.keys(deps),transformSync(`return class View{${source.slice(start,end)}}`,{loader:'ts'}).code)(...Object.values(deps));

class Port {
 classes=new Set<string>();attributes=new Map<string,string>();adds=0;removes=0;
 addClass(name:string){this.adds++;this.classes.add(name);}
 removeClass(name:string){this.removes++;this.classes.delete(name);}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}
}
function fixture(count=3){
 const nodes:Card[]=Array.from({length:count},(_,index)=>({id:'n'+index,kind:'text',text:'node',x:index*250,y:0,width:150,height:90,color:'sand'}));
 const board:Board={...emptyBoard(),version:3,nodes,edges:Array.from({length:count-1},(_,index)=>({id:'e'+index,from:'n'+index,to:'n'+(index+1),label:''}))};
 const stats={findCalls:0,predicates:0};
 const watchEdges=(edges:Edge[])=>{
  Object.defineProperty(edges,'find',{configurable:true,value:function(predicate:(edge:Edge,index:number,edges:Edge[])=>boolean){
   stats.findCalls++;return Array.prototype.find.call(this,(edge:Edge,index:number)=>{stats.predicates++;return predicate(edge,index,this);});
  }});board.edges=edges;
 };
 watchEdges(board.edges);
 const ports=new Map<string,Port>(),positions=new Map<string,{querySelector(selector:string):Port|undefined}>();
 for(const node of nodes){
  for(const side of ['top','right','bottom','left'])ports.set(node.id+':'+side,new Port());
  positions.set(node.id,{querySelector:selector=>ports.get(node.id+':'+selector.match(/data-side="([^"]+)"/)?.[1])});
 }
 const svg={},renders:{board:Board;selected?:string;batch?:ReadonlySet<string>;focus?:ReadonlySet<string>}[]=[],view=new View();
 Object.assign(view,{session:{board},svg,stage:{clientWidth:1000,clientHeight:800},selected:new Set<string>(),positions,endpointPorts:new Map(),
  edgeLayer:{root:svg,render(display:Board,_width:number,_height:number,selected?:string,focus?:ReadonlySet<string>,batch?:ReadonlySet<string>){renders.push({board:display,selected,batch,focus});}},
  displayBoard:()=>board
 });
 const port=(id:string,side:string)=>ports.get(id+':'+side)!;
 return{board,view,stats,renders,positions,ports,port,watchEdges,render:()=>view.renderEdges()};
}
function expectNeutral(port:Port){assert.equal(port.classes.has('ts-endpoint-port'),false);assert.equal(port.attributes.get('title'),'拖动到目标建立连线，也可依次点击两端');}

test('camera frames without a direct edge selection skip every endpoint lookup',t=>{
 const f=fixture(1200);
 for(let frame=0;frame<120;frame++){f.board.viewport.x=frame;f.board.viewport.zoom=frame%2?.8:1;f.render();}
 t.diagnostic(`120 camera frames / 1199 edges: ${JSON.stringify(f.stats)}`);
 assert.deepEqual(f.stats,{findCalls:0,predicates:0});
 assert.equal(f.renders.length,120,'edge geometry still renders every requested frame');
 assert.equal(f.view.endpointPorts.size,0);
});

test('direct selection tracks current endpoint sides and clears old ports on reconnect',()=>{
 const f=fixture();f.view.selectedEdge='e0';f.render();
 const from=f.port('n0','right'),oldTo=f.port('n1','left');
 assert.equal(from.attributes.get('title'),'拖动重接起点');assert.equal(oldTo.attributes.get('title'),'拖动重接终点');
 assert.equal(f.view.endpointPorts.size,2);assert.equal(f.stats.findCalls,1);
 f.render();assert.equal(from.adds,1);assert.equal(oldTo.adds,1,'unchanged selected endpoints are not rewritten');
 Object.assign(f.board.edges[0],{to:'n2',fromSide:'bottom',toSide:'top'});f.render();
 expectNeutral(from);expectNeutral(oldTo);assert.equal(f.port('n0','bottom').classes.has('ts-endpoint-port'),true);assert.equal(f.port('n2','top').classes.has('ts-endpoint-port'),true);
});

test('clearing or deleting a selected edge removes endpoint affordances',()=>{
 for(const action of ['clear','delete'] as const){
  const f=fixture();f.view.selectedEdge='e0';f.render();
  if(action==='clear')f.view.selectedEdge=undefined;else f.board.edges.splice(0,1);
  const previous=f.stats.findCalls;f.render();
  assert.equal(f.view.endpointPorts.size,0);expectNeutral(f.port('n0','right'));expectNeutral(f.port('n1','left'));
  assert.equal(f.stats.findCalls-previous,action==='clear'?0:1);
 }
});

test('offscreen or missing selected endpoints release old DOM references',()=>{
 for(const action of ['unmount','remove'] as const){
  const f=fixture();f.view.selectedEdge='e0';f.render();
  if(action==='unmount')f.positions.clear();else f.board.nodes.splice(1,1);
  f.render();assert.equal(f.view.endpointPorts.size,0);expectNeutral(f.port('n0','right'));expectNeutral(f.port('n1','left'));
 }
});

test('folding a branch and clearing its hidden edge selection removes ports without a scan',()=>{
 const f=fixture();f.board.edges[0].kind='branch';f.view.selectedEdge='e0';f.render();
 f.board.nodes[0].branchFolded=true;f.positions.delete('n1');
 // foldBranches/setSelectionFold clear direct selection when either end hides.
 f.view.selectedEdge=undefined;const previous=f.stats.findCalls;f.render();
 assert.equal(f.stats.findCalls,previous);assert.equal(f.view.endpointPorts.size,0);
 expectNeutral(f.port('n0','right'));expectNeutral(f.port('n1','left'));
 assert.equal(f.renders.at(-1)!.board.nodes.some(node=>node.id==='n1'),false);
 assert.equal(f.renders.at(-1)!.board.edges.some(edge=>edge.id==='e0'),false);
});

test('batch edge rendering keeps its live scope and lock filtering without direct lookup',()=>{
 const f=fixture();f.view.batchFormatTarget='edges';f.view.selected=new Set(['n0','n1']);f.view.batchEdgeScope='internal';f.render();
 assert.deepEqual([...f.renders.at(-1)!.batch!],['e0']);assert.equal(f.view.endpointPorts.size,0);
 f.view.batchEdgeScope='connected';f.render();assert.deepEqual([...f.renders.at(-1)!.batch!],['e0','e1']);
 f.board.nodes[2].locked=true;f.render();assert.deepEqual([...f.renders.at(-1)!.batch!],['e0']);
 f.view.selectedEdge='e0';f.render();assert.equal(f.view.endpointPorts.size,2);assert.equal(f.renders.at(-1)!.selected,'e0');
 f.view.selectedEdge=undefined;f.view.selected.clear();f.render();
 assert.equal(f.stats.findCalls,1,'only the single directly selected frame needs endpoint lookup');assert.equal(f.renders.at(-1)!.batch,undefined);assert.equal(f.view.endpointPorts.size,0);
});

test('inline display geometry and immutable undo data remain live for endpoint selection',()=>{
 const f=fixture();f.view.inlineTarget='n0';f.view.inlineGeometry={id:'n0',width:500,height:200};f.view.selectedEdge='e0';f.render();
 assert.equal(f.renders.at(-1)!.board.nodes[0].width,500);assert.equal(f.board.nodes[0].width,150,'draft geometry never changes persisted nodes');
 const previous=f.board.edges.map(edge=>({...edge}));
 f.watchEdges(f.board.edges.map(edge=>edge.id==='e0'?{...edge,from:'n2',to:'n1',fromSide:'top',toSide:'bottom'}:edge));f.render();
 assert.equal(f.port('n2','top').classes.has('ts-endpoint-port'),true);assert.equal(f.port('n1','bottom').classes.has('ts-endpoint-port'),true);
 f.watchEdges(previous);f.view.inlineTarget=undefined;f.view.inlineGeometry=undefined;f.render();
 expectNeutral(f.port('n2','top'));expectNeutral(f.port('n1','bottom'));
 assert.equal(f.port('n0','right').classes.has('ts-endpoint-port'),true);assert.equal(f.port('n1','left').classes.has('ts-endpoint-port'),true);
 assert.equal(f.renders.at(-1)!.board.nodes[0].width,150);
});
