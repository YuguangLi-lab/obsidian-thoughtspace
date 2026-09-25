import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleMarqueeSelection,marqueeSelection} from '../src/board-tools';
import {emptyBoard,type Board,type Card} from '../src/model';

const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:100,height:80,color:'sand',...extra});

test('unfolded marquee frames scan live board nodes once for fold flags and geometric hits',()=>{
 let reads=0;const nodes=Array.from({length:1200},(_,i)=>node('n'+i,i*200)),live=new Proxy(nodes,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});
 const board:Board={...emptyBoard(),nodes:live};
 for(let frame=0;frame<120;frame++)assert.deepEqual([...visibleMarqueeSelection(board,{x:199,y:-1,width:102+frame/1000,height:82})],['n1']);
 assert.equal(reads,120*1200);
});

test('partial folded-frame intersection with no selectable objects needs no branch traversal',()=>{
 const board:Board={...emptyBoard(),nodes:[node('frame',0,0,{kind:'section',sectionFolded:true,width:600,height:500}),node('outside',900)]};
 Object.defineProperty(board,'edges',{get(){throw Error('no selectable geometry should need topology');}});
 assert.deepEqual([...visibleMarqueeSelection(board,{x:20,y:10,width:40,height:40})],[]);
});

test('folded display geometry, hidden candidates, ID order and changed containment stay live',()=>{
 const board:Board={...emptyBoard(),nodes:[node('frame',0,0,{kind:'section',sectionFolded:true,width:600,height:500}),node('hidden',30,100),node('root',800,0,{branchFolded:true}),node('child',1000),node('visible',1200)],edges:[{id:'branch',from:'root',to:'child',kind:'branch',label:''}]};
 const all={x:-1,y:-1,width:1500,height:600};assert.deepEqual([...visibleMarqueeSelection(board,all)],['frame','root','visible']);
 assert.deepEqual([...visibleMarqueeSelection(board,{x:-1,y:-1,width:322,height:74})],['frame']);
 assert.deepEqual([...visibleMarqueeSelection(board,{x:400,y:200,width:100,height:100})],[]);
 board.nodes[1]={...board.nodes[1],x:650};board.nodes[2].branchFolded=false;
 assert.deepEqual([...visibleMarqueeSelection(board,all)],['frame','hidden','root','child','visible']);
 board.nodes.reverse();assert.deepEqual([...visibleMarqueeSelection(board,all)],['visible','child','root','hidden','frame']);
});

test('marquee retains strict contact rules, duplicate-ID order and degenerate fold broad-phase behavior',()=>{
 const nodes=[node('same',0),node('touching',100),node('same',20),node('frame',0,0,{kind:'section',width:100,height:80})],rect={x:0,y:0,width:100,height:80};
 assert.deepEqual([...marqueeSelection(nodes,rect)],['same','frame']);
 for(const area of [{...rect,width:0},{...rect,height:0}])assert.deepEqual([...visibleMarqueeSelection({...emptyBoard(),nodes},area)],[]);
 // Preserve the previous broad-phase behavior even for geometry that is smaller
 // than the coordinate's floating-point spacing and is outside parsed UI norms.
 const huge=node('huge',1e308,1e308,{kind:'section',width:100,height:80,branchFolded:true});
 assert.deepEqual([...visibleMarqueeSelection({...emptyBoard(),nodes:[huge]},{x:1e308,y:1e308,width:100,height:80})],[]);
});
