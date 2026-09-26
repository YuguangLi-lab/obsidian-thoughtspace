import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Card} from '../src/model';
import {selectionEdges,patchSelectionEdges} from '../src/selection-edges';
function fixture(){const board=emptyBoard();board.version=3;const nodes:Card[]=Array.from({length:1200},(_,i)=>({id:'n'+i,kind:'text',text:'Topic',x:i*350,y:0,width:300,height:180,color:'sand'}));nodes[0].branchFolded=true;let reads=0;board.nodes=new Proxy(nodes,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});board.edges=[{id:'branch',from:'n0',to:'n1',kind:'branch',label:''}];return{board,nodes,reads:()=>reads};}
test('selection with no candidate edges skips full-board endpoint and visibility indexing',()=>{
 const f=fixture();for(let i=0;i<120;i++){assert.deepEqual(selectionEdges(f.board,new Set(['n1100','n1199'])),[]);assert.deepEqual(selectionEdges(f.board,new Set(['n1100']),'connected'),[]);}
 assert.equal(f.reads(),0);
});
test('stale edge patch skips endpoint indexing but still validates malformed controls',()=>{
 const f=fixture();for(let i=0;i<120;i++)assert.equal(patchSelectionEdges(f.board,new Set(['deleted']),{color:'red'}),0);assert.equal(f.reads(),0);
 assert.throws(()=>patchSelectionEdges(f.board,new Set(['deleted']),{color:'invalid' as any}),/样式无效/);
});
test('first candidate checks fresh folds, locks, endpoints and patch clearing',()=>{
 const f=fixture(),ids=new Set(['n0','n1']);assert.deepEqual(selectionEdges(f.board,ids),[]);delete f.nodes[0].branchFolded;
 assert.deepEqual(selectionEdges(f.board,ids),f.board.edges);f.nodes[1].locked=true;assert.equal(patchSelectionEdges(f.board,new Set(['branch']),{color:'red'}),0);delete f.nodes[1].locked;
 assert.equal(patchSelectionEdges(f.board,new Set(['branch']),{color:'red',dashed:true}),1);assert.equal(f.board.edges[0].color,'red');assert.equal(patchSelectionEdges(f.board,new Set(['branch']),{color:undefined,dashed:undefined}),1);assert.equal(Object.hasOwn(f.board.edges[0],'color'),false);assert.equal(Object.hasOwn(f.board.edges[0],'dashed'),false);
 f.nodes.splice(1,1);assert.deepEqual(selectionEdges(f.board,ids),[]);
});
