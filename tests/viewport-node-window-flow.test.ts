import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board,type Card} from '../src/model';
import {branchState,visibleBranchBoard} from '../src/mindmap';
import {branchRenderSnapshot} from '../src/branch-render';
import {sectionDisplayNode} from '../src/sections';
import {visibleNodes,viewportRect,intersects} from '../src/rendering';
import {visibleGridSize} from '../src/canvas-controls';
import {inlineDisplayBoard} from '../src/inline-geometry';

// Execute the actual camera render, edge controller and offscreen indicator.
// Already-mounted DOM and the final SVG renderer isolate controller work from
// host preview rendering; preview-reuse-flow covers entering/remounted nodes.
const source=readFileSync(process.env.VIEWPORT_NODE_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const methods=take('  private renderBoard(','  private pdfTotals=')
 +take('  private updateBackToContent(','  private transform()')
 +take('  private renderEdges(','  private labelEdge(');
const deps={branchState,visibleBranchBoard,branchRenderSnapshot,sectionDisplayNode,visibleNodes,viewportRect,intersects,visibleGridSize,inlineDisplayBoard};
const View=new Function(...Object.keys(deps),transformSync(`return class View{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
type Stats={nodeIds:number;positionGets:number;titleQueries:number;edgeKinds:number;edgeFrames:number;positioned:number;mapFrames:number;unloads:number;inlineSyncs:number;};
class Element {
 parent?:Element;children:Element[]=[];titleInput?:Element;classes=new Set<string>();style:Record<string,string>={};
 constructor(readonly stats:Stats){}
 classList={contains:(name:string)=>this.classes.has(name)};
 querySelector(selector:string){assert.equal(selector,'.ts-card-title-input');this.stats.titleQueries++;return this.titleInput||null;}
 contains(other:Element):boolean{return this===other||this.children.some(child=>child.contains(other));}
 get nextElementSibling():Element|null{const list=this.parent?.children;return list?.[list.indexOf(this)+1]||null;}
 get nextSibling():Element|null{return this.nextElementSibling;}
 insertBefore(el:Element,next:Element|null){el.remove();el.parent=this;const index=next?this.children.indexOf(next):-1;if(index<0)this.children.push(el);else this.children.splice(index,0,el);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this);this.parent=undefined;}
}
function fixture(size=1200,mounted=12){
 const stats:Stats={nodeIds:0,positionGets:0,titleQueries:0,edgeKinds:0,edgeFrames:0,positioned:0,mapFrames:0,unloads:0,inlineSyncs:0};
 const nodes:Card[]=Array.from({length:size},(_,i)=>({get id(){stats.nodeIds++;return 'n'+i;},kind:'text',text:'node',x:i<mounted?i%4*200:10000+i*200,y:i<mounted?Math.floor(i/4)*160:10000,width:150,height:100,color:'sand'}));
 const board:Board={...emptyBoard(),version:3,nodes,edges:Array.from({length:size-1},(_,i)=>({id:'e'+i,from:'n'+i,to:'n'+(i+1),label:'',get kind(){stats.edgeKinds++;return 'branch' as const;}})),viewport:{x:0,y:0,zoom:1}};
 class Positions extends Map<string,Element>{get(id:string){stats.positionGets++;return super.get(id);}}
 const positions=new Positions(),world=new Element(stats),svg=new Element(stats),view=new View(),edgeBoards:Board[]=[],positioned:{node:Card;element:Element}[]=[];
 svg.parent=world;world.children.push(svg);const nodeScopes=new Map<string,{unload():void}>();
 const mount=(id:string,title=false)=>{const el=new Element(stats);if(title)el.titleInput=new Element(stats);positions.set(id,el);world.insertBefore(el,null);nodeScopes.set(id,{unload(){stats.unloads++;}});return el;};
 for(let i=0;i<mounted;i++)mount('n'+i);
 const classes=new Set<string>();
 Object.assign(view,{session:{board,blocked:false},world,svg,stage:{clientWidth:1000,clientHeight:700,style:{}},contentEl:{toggleClass(){}},zoomLabel:{setText(){}},
  selected:new Set(),positions,nodeScopes,nodeKeys:new Map(),endpointPorts:new Map(),plugin:{settings:{gridStep:24,previewLimit:20,detailZoom:.4,showMinimap:true}},
  backToContent:{classList:{contains:(name:string)=>classes.has(name)},toggleClass(name:string,on:boolean){if(on)classes.add(name);else classes.delete(name);}},
  edgeLayer:{root:svg,render(display:Board){stats.edgeFrames++;edgeBoards.push(display);}},displayBoard:()=>view.session.board,
  positionNode(node:Card,element:Element){stats.positioned++;positioned.push({node,element});},syncInlineAppearance(){stats.inlineSyncs++;},
  mapKey:'already-rendered',mapViewport(){stats.mapFrames++;}
 });
 const reset=()=>{for(const key of Object.keys(stats) as (keyof Stats)[])stats[key]=0;positioned.length=edgeBoards.length=0;};
 const render=()=>view.renderBoard(true);
 return{view,board,nodes,stats,positions,world,svg,nodeScopes,edgeBoards,positioned,mount,reset,render};
}

test('120 camera frames inspect only mounted DOM and skip unused branch topology',t=>{
 const f=fixture(),saved=JSON.stringify(f.board),elements=[...f.positions.values()];f.reset();
 for(let frame=0;frame<120;frame++){f.board.viewport.x=frame/100;f.render();}
 t.diagnostic(JSON.stringify(f.stats));
 assert.ok(f.stats.nodeIds<=18000,`full-board identity scans: ${f.stats.nodeIds}`);
 assert.equal(f.stats.positionGets,12*3*120);assert.equal(f.stats.titleQueries,12*120);assert.equal(f.stats.edgeKinds,0);
 assert.equal(f.stats.positioned,12*120);assert.equal(f.stats.edgeFrames,120);assert.equal(f.stats.mapFrames,120);assert.equal(f.stats.unloads,0);
 assert.deepEqual([...f.positions.values()],elements);f.board.viewport.x=0;assert.equal(JSON.stringify(f.board),saved);
});

test('an entirely offscreen camera frame does not search undefined editor IDs or build unused topology',()=>{
 const f=fixture(1200,0);f.reset();f.render();
 assert.equal(f.stats.nodeIds,0);assert.equal(f.stats.positionGets,0);assert.equal(f.stats.titleQueries,0);assert.equal(f.stats.edgeKinds,0);
 assert.equal(f.stats.edgeFrames,1);assert.equal(f.stats.mapFrames,1);
});

test('offscreen title editors are preserved in board order and queried once per frame',()=>{
 const f=fixture(8,2),last=f.mount('n7',true),earlier=f.mount('n5',true),input=last.titleInput;
 f.reset();f.render();assert.equal(f.stats.titleQueries,4);assert.equal(f.stats.unloads,0);
 assert.deepEqual(f.view.connectionCandidates.map((n:Card)=>n.id),['n0','n1','n5','n7']);
 assert.deepEqual(f.world.children,[f.svg,f.positions.get('n0'),f.positions.get('n1'),earlier,last]);assert.equal(last.titleInput,input);
 const first=f.board.nodes[5],second=f.board.nodes[7];f.board.nodes[5]=second;f.board.nodes[7]=first;f.reset();f.render();
 assert.deepEqual(f.view.connectionCandidates.map((n:Card)=>n.id),['n0','n1','n7','n5']);assert.equal(f.stats.titleQueries,4);assert.equal(f.stats.unloads,0);
});

test('title editing ends, deleted objects and replacement DOM are reflected on the next frame',()=>{
 const f=fixture(6,2),editor=f.mount('n5',true);f.render();editor.titleInput=undefined;f.reset();f.render();
 assert.equal(f.positions.has('n5'),false);assert.equal(editor.parent,undefined);assert.equal(f.stats.unloads,1);
 const replacement=f.mount('n5',true);f.reset();f.render();assert.equal(f.positions.get('n5'),replacement);assert.equal(f.stats.unloads,0);
 f.board.nodes=f.board.nodes.filter(n=>n.id!=='n5');f.reset();f.render();assert.equal(f.positions.has('n5'),false);assert.equal(replacement.parent,undefined);assert.equal(f.stats.unloads,1);
});

test('offscreen inline ID and target remain pinned without duplicate candidates',()=>{
 const f=fixture(6,2),host=f.mount('n5'),editor=new Element(f.stats);host.children.push(editor);editor.parent=host;
 f.view.inlineId='n5';f.view.inlineTarget='n5';f.view.inline={el:editor};f.reset();f.render();
 assert.equal(f.positions.has('n5'),true);assert.equal(f.stats.inlineSyncs,1);assert.equal(f.stats.unloads,0);
 assert.deepEqual(f.view.connectionCandidates.map((n:Card)=>n.id),['n0','n1','n5']);
 f.view.inline=undefined;f.view.inlineId=undefined;f.view.inlineTarget=undefined;f.reset();f.render();assert.equal(f.positions.has('n5'),false);assert.equal(f.stats.unloads,1);
});

test('folded boards still resolve visibility once per frame and keep active title drafts',()=>{
 const f=fixture(12,12),editor=f.positions.get('n5')!;editor.titleInput=new Element(f.stats);f.board.nodes[0].branchFolded=true;
 f.reset();f.render();assert.equal(f.stats.edgeKinds,11);assert.deepEqual(f.view.connectionCandidates.map((n:Card)=>n.id),['n0','n5']);
 assert.deepEqual(f.edgeBoards[0].nodes.map(n=>n.id),['n0']);assert.equal(f.stats.unloads,10);assert.equal(f.positions.get('n5'),editor);
 f.reset();f.render();assert.equal(f.stats.edgeKinds,11);assert.equal(f.stats.titleQueries,2);assert.equal(f.stats.unloads,0);
 editor.titleInput=undefined;f.reset();f.render();assert.equal(f.positions.has('n5'),false);assert.equal(f.stats.unloads,1);
});

test('replacement board records supply current geometry to a preserved title editor',()=>{
 const f=fixture(5,2),editor=f.mount('n4',true);f.render();
 const replacement=structuredClone(f.board);replacement.nodes[4]={...replacement.nodes[4],x:16000,y:17000,width:260,text:'current shared content'};
 f.view.session.board=replacement;f.reset();f.render();
 assert.equal(f.positions.get('n4'),editor);assert.equal(f.positioned.find(entry=>entry.element===editor)?.node,replacement.nodes[4]);assert.equal(f.stats.unloads,0);
});
