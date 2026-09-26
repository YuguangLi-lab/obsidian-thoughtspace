import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Board,type Card} from '../src/model';
import {relationSelection,shortestRelationPath} from '../src/graph-navigation';
import {mindmapNavigation} from '../src/mindmap-navigation';
import {discloseBranches} from '../src/branch-disclosure';
import {branchState} from '../src/mindmap';

const node=(id:string):Card=>({id,kind:'text',text:id,x:0,y:0,width:100,height:60,color:'blue'});
function graph(size=2000){
 let edgeReads=0,edgeIds=0;
 const board:Board={...emptyBoard(),version:3,nodes:Array.from({length:size},(_,i)=>node('n'+i)),edges:Array.from({length:size-1},(_,i)=>new Proxy({id:'e'+i,from:'n'+i,to:'n'+(i+1),label:''},{get(e,k,r){edgeReads++;if(k==='id')edgeIds++;return Reflect.get(e,k,r);}}))};
 return{board,reads:()=>({edgeReads,edgeIds})};
}
test('zero-depth and empty or stale relation selections avoid the edge index',()=>{
 for(const [seeds,depth,result]of [[new Set(['n4','missing','n2']),0,['n4','n2']],[new Set<string>(),Infinity,[]],[new Set(['missing']),Infinity,[]]] as const){
  const f=graph();assert.deepEqual([...relationSelection(f.board,seeds,'connected',depth)],result);assert.equal(f.reads().edgeReads,0);
 }
});
test('relation selection traverses node IDs without reading unused edge identifiers',()=>{
 const f=graph();assert.equal(relationSelection(f.board,new Set(['n0']),'downstream').size,2000);assert.equal(f.reads().edgeIds,0);
});
test('shortest path skips adjacency for missing endpoints and identical endpoints',()=>{
 for(const [from,to,wanted]of [['missing','n0',undefined],['n0','missing',undefined],['n0','n0',{nodes:['n0'],edges:[]}]] as const){const f=graph();assert.deepEqual(shortestRelationPath(f.board,from,to),wanted);assert.equal(f.reads().edgeReads,0);}
});
test('bounded breadth-first traversal preserves seed, edge, direction and cycle order',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:['a','b','c','d','e','frame'].map(node),edges:[['a','c'],['a','b'],['c','e'],['b','d'],['d','a']].map(([from,to],i)=>({id:'e'+i,from,to,label:''}))};b.nodes[5].kind='section';
 b.edges.push({id:'both',from:'e',to:'b',label:'',direction:'both'},{id:'frame',from:'frame',to:'a',label:''},{id:'missing',from:'a',to:'missing',label:''});
 assert.deepEqual([...relationSelection(b,new Set(['a','frame','missing']),'downstream',2)],['a','c','b','e','d']);
 assert.deepEqual([...relationSelection(b,new Set(['e','a']),'connected',1)],['e','a','c','b','d']);
 assert.deepEqual(shortestRelationPath(b,'a','e'),{nodes:['a','c','e'],edges:['e0','e2']});
 for(const depth of [-1,1.2,NaN])assert.throws(()=>relationSelection(b,new Set(),'connected',depth),/非负整数/);
});
test('very wide navigation and branch disclosure do not exhaust the argument stack',()=>{
 const count=160000,b:Board={...emptyBoard(),version:3,nodes:[node('root')],edges:[]};
 for(let i=0;i<count;i++){const n=node('n'+i);n.x=200+i;b.nodes.push(n);b.edges.push({id:'e'+i,from:'root',to:n.id,kind:'branch',label:''});}
 assert.equal(mindmapNavigation(b,'root','right'),'n0');
 b.nodes[0].branchFolded=true;discloseBranches(b,new Set(['root']),'all');assert.equal(b.nodes[0].branchFolded,undefined);
 discloseBranches(b,new Set(['root']),'level');assert.equal(b.nodes.length,count+1);assert.equal(b.edges.length,count);
});
test('wide folded branches and hidden-group frontiers remain navigable without argument spread',()=>{
 // An extreme algorithmic stress case, not a claim that this many objects render interactively.
 const count=160000,b:Board={...emptyBoard(),version:3,nodes:[node('root')],edges:[]};
 for(let i=0;i<count;i++){const n=node('n'+i);n.x=10000+i;b.nodes.push(n);b.edges.push({id:'e'+i,from:'root',to:n.id,kind:'branch',label:''});}
 b.nodes[0].branchFolded=true;assert.equal(mindmapNavigation(b,'root','right'),undefined);assert.equal(branchState(b).hidden.size,count);
 discloseBranches(b,new Set(['root']),'level');assert.equal(mindmapNavigation(b,'root','right'),'n0');
 const parent={...node('parent'),branchFolded:true,x:-1000};b.nodes.unshift(parent);b.edges.unshift({id:'parent-root',from:'parent',to:'root',kind:'branch',label:''});
 assert.equal(mindmapNavigation(b,'root','right'),undefined);assert.equal(branchState(b).hidden.size,count+1);
 b.nodes.shift();b.edges.shift();b.nodes[0].kind='section';b.nodes[0].title='Inner';
 const outer:Card={...node('outer'),kind:'section',title:'Outer',width:500,height:500,x:-100,y:-100,sectionFolded:true};b.nodes.unshift(outer);
 assert.equal(mindmapNavigation(b,'n0','left'),undefined);assert.equal(branchState(b).hidden.size,count+1);
 delete outer.sectionFolded;b.nodes.unshift(parent);b.edges.unshift({id:'parent-outer',from:'parent',to:'outer',kind:'branch',label:''});
 assert.equal(mindmapNavigation(b,'n0','left'),undefined);assert.equal(branchState(b).hidden.size,count+2);
 discloseBranches(b,new Set(['parent']),'all');assert.equal(branchState(b).hidden.size,0);assert.equal(b.nodes[1].sectionFolded,undefined);
});
