import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board,type Card,type Edge} from '../src/model';
import * as boardTools from '../src/board-tools';
import * as mindmap from '../src/mindmap';

// Execute the production pointer method. The previous public projection +
// marquee composition remains the independent selection-behavior oracle.
const source=readFileSync(process.env.MARQUEE_PROJECTION_SOURCE||'src/main.ts','utf8');
const a=source.indexOf('  private applyPointerMove('),b=source.indexOf('  private pointerUp(',a);assert.ok(a>=0&&b>a);
const deps={...boardTools,...mindmap};
const View=new Function(...Object.keys(deps),transformSync(`return class View{${source.slice(a,b)}}`,{loader:'ts'}).code)(...Object.values(deps));
const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:150,height:100,color:'sand',...extra});
function fixture(nodes:Card[],edges:Edge[]=[]){
 const board:Board={...emptyBoard(),version:3,nodes,edges},view=new View(),stats={updates:0};
 Object.assign(view,{session:{board},selected:new Set<string>(),point:(x:number,y:number)=>({x,y}),
  marquee:{id:1,start:{x:-50,y:-50},base:new Set<string>(),box:{style:{},dataset:{}}},updateSelection(){stats.updates++;}});
 const select=(rect:boardTools.Rect)=>{view.marquee.start={x:rect.x,y:rect.y};view.applyPointerMove({pointerId:1,clientX:rect.x+rect.width,clientY:rect.y+rect.height});return[...view.selected] as string[];};
 return{board,view,stats,select};
}
function chain(rootAtOrigin=false){
 const counts={kind:0,from:0,to:0},nodes=Array.from({length:1200},(_,i)=>node(String(i),10000+i*200,10000,{branchFolded:i===0||undefined}));
 if(rootAtOrigin){nodes[0].x=0;nodes[0].y=0;}
 const edges:Edge[]=nodes.slice(1).map((n,i)=>({id:'e'+i,label:'',get kind(){counts.kind++;return 'branch' as const;},get from(){counts.from++;return String(i);},get to(){counts.to++;return n.id;}}));
 return{...fixture(nodes,edges),counts};
}

for(const zeroArea of [false,true])test(`${zeroArea?'zero-area':'empty-space'} marquee frames never resolve unrelated folded branches`,t=>{
  const f=chain();for(let i=0;i<120;i++)f.select({x:-50,y:-50,width:zeroArea?0:100+i/100,height:100});
  t.diagnostic(`${zeroArea?'zero-area':'empty'}: ${JSON.stringify(f.counts)}`);
  assert.deepEqual(f.counts,{kind:0,from:0,to:0});assert.equal(f.stats.updates,0);assert.equal(f.view.selected.size,0);
});

test('a visible hit resolves current folds once without filtering an unused edge projection',t=>{
 const f=chain(true);for(let i=0;i<120;i++)f.select({x:-50,y:-50,width:100+i/100,height:100});
 t.diagnostic(JSON.stringify(f.counts));
 assert.equal(f.counts.kind,1199*120);assert.equal(f.counts.from,1199*120*3);assert.equal(f.counts.to,1199*120*2);
 assert.deepEqual([...f.view.selected],['0']);assert.equal(f.stats.updates,1);
});

test('folded frame display bounds, nested group branches and collapsed cards retain selection behavior',()=>{
 const nodes=[node('outer',0,0,{kind:'section',width:600,height:400,sectionFolded:true}),node('inner',50,90,{kind:'section',width:300,height:250}),node('inside',90,140),
  node('linked',900,0,{kind:'section',width:300,height:200}),node('linked-content',920,60),node('folded-parent',1400,0,{branchFolded:true}),node('hidden-child',1650,0),
  node('collapsed-card',700,0,{kind:'card',file:'card.md',collapsed:true,height:72,expandedHeight:300})];
 const edges:Edge[]=[{id:'groups',kind:'branch',from:'inner',to:'linked',label:''},{id:'topics',kind:'branch',from:'folded-parent',to:'hidden-child',label:''}];
 const f=fixture(nodes,edges),saved=structuredClone(f.board);
 for(const rect of [{x:-1,y:-1,width:322,height:74},{x:100,y:0,width:50,height:70},{x:499,y:249,width:22,height:22},{x:699,y:-1,width:152,height:74},{x:1300,y:-1,width:600,height:150},{x:-1,y:-1,width:2000,height:500}]){
  assert.deepEqual(f.select(rect),[...boardTools.marqueeSelection(mindmap.visibleBranchBoard(f.board).nodes,rect)]);
 }
 assert.deepEqual(f.select({x:-1,y:-1,width:322,height:74}),['outer']);
 assert.deepEqual(f.select({x:100,y:0,width:50,height:70}),[],'partial frame overlap does not select the frame');
 assert.deepEqual(f.board,saved);
});

test('filter and relationship scopes preserve explicit Shift base while folds and containment stay live',()=>{
 const f=fixture([node('frame',0,0,{kind:'section',width:600,height:400,sectionFolded:true}),node('inside',100,100),node('visible',700,0),node('filtered',900,0,{locked:true})]);
 f.view.marquee.base=new Set(['inside','base-missing']);f.view.marquee.box.dataset.additive='true';f.view.filterMatches=new Set(['visible','filtered']);f.view.relatedFocus=new Set(['visible']);
 assert.deepEqual(f.select({x:-1,y:-1,width:1200,height:500}),['inside','base-missing','visible']);
 f.view.marquee.box.dataset.additive='false';assert.deepEqual(f.select({x:-1,y:-1,width:1200,height:500}),['visible']);
 f.view.filterMatches=undefined;f.view.relatedFocus=undefined;f.board.nodes[0].sectionFolded=false;
 assert.deepEqual(f.select({x:90,y:90,width:180,height:150}),['inside']);
 f.board.nodes[0].sectionFolded=true;assert.deepEqual(f.select({x:90,y:90,width:180,height:150}),[]);
 f.board.nodes[1].x=1200;assert.deepEqual(f.select({x:1190,y:90,width:180,height:150}),['inside']);
 const replacement=structuredClone(f.board);replacement.nodes[1].x=100;f.view.session.board=replacement;
 assert.deepEqual(f.select({x:90,y:90,width:180,height:150}),[],'replacement/undo geometry is resolved afresh');
});

test('unfolded hits need no edge traversal and zero-area Shift selection retains its base',()=>{
 const f=fixture([node('a'),node('locked',250,0,{locked:true})]);
 Object.defineProperty(f.board,'edges',{get(){throw Error('unfolded marquee should not read edges');}});
 assert.deepEqual(f.select({x:-1,y:-1,width:500,height:200}),['a','locked']);
 f.view.marquee.base=new Set(['a']);f.view.marquee.box.dataset.additive='true';
 assert.deepEqual(f.select({x:-1,y:-1,width:0,height:200}),['a']);
});

test('10000 deterministic mixed-board rectangles match the previous projection-based selection',()=>{
 let seed=172903;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),integer=(n:number)=>Math.floor(random()*n);
 for(let sample=0;sample<500;sample++){
  const nodes=Array.from({length:10+integer(60)},(_,i)=>node(String(i),integer(1500)-500,integer(1500)-500,{kind:random()<.2?'section':'text',width:80+integer(800),height:60+integer(500)})),edges:Edge[]=[];
  for(let i=0;i<nodes.length;i++){
   const n=nodes[i];if(n.kind==='section'&&random()<.3)n.sectionFolded=true;if(random()<.25)n.branchFolded=true;
   if(n.kind!=='section'&&random()<.15){n.collapsed=true;n.expandedHeight=n.height;n.height=72;}
   if(i&&random()<.65)edges.push({id:'b'+i,from:String(integer(i)),to:String(i),kind:'branch',label:''});
   if(i&&random()<.3)edges.push({id:'r'+i,from:String(integer(i)),to:String(i),label:''});
  }
  const f=fixture(nodes,edges),before=JSON.stringify(f.board);
  for(let index=0;index<20;index++){
   const rect={x:integer(1600)-500,y:integer(1600)-500,width:index===0?0:integer(1000),height:index===1?0:integer(1000)};
   assert.deepEqual(f.select(rect),[...boardTools.marqueeSelection(mindmap.visibleBranchBoard(f.board).nodes,rect)],`board ${sample}, rectangle ${index}`);
  }
  assert.equal(JSON.stringify(f.board),before);
 }
});
