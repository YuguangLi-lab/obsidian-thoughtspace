import test from 'node:test';import assert from 'node:assert/strict';
import {emptyBoard,expandedSelection,tidyBoard,clone,Card} from '../src/model';
import {alignSelection} from '../src/board-tools';

function fixture(size:number){const b=emptyBoard();b.nodes=Array.from({length:size},(_,i):Card=>({id:String(i),kind:'card',file:`${i}.md`,x:i%40*380,y:Math.floor(i/40)*330,width:280,height:220,color:'sand'}));return b;}
function countIds(board:ReturnType<typeof fixture>){let reads=0;for(const node of board.nodes){const id=node.id;Object.defineProperty(node,'id',{get(){reads++;return id},enumerable:true});}return()=>reads;}
test('expanding 1200 selected loose cards visits identity a bounded number of times',()=>{
 const b=fixture(1200),ids=new Set(b.nodes.map(n=>n.id)),reads=countIds(b);
 assert.equal(expandedSelection(b,ids).size,1200);assert.ok(reads()<1200*20,`ID reads ${reads()}`);
});
test('aligning 1200 loose cards does not repeatedly expand the whole board',()=>{
 const b=fixture(1200),ids=new Set(b.nodes.map(n=>n.id)),reads=countIds(b);alignSelection(b,ids,'left');
 assert.ok(reads()<1200*30,`ID reads ${reads()}`);assert.ok(b.nodes.every(n=>n.x===0));
});
test('tidying 1200 loose cards does not rescan membership for every card',()=>{
 const b=fixture(1200),ids=new Set(b.nodes.map(n=>n.id)),reads=countIds(b);tidyBoard(b,ids);
 assert.ok(reads()<1200*30,`ID reads ${reads()}`);assert.equal(new Set(b.nodes.map(n=>`${n.x},${n.y}`)).size,1200);
});
test('tidy preserves a folded movement unit when a hidden descendant is locked',()=>{
 const b=fixture(4);b.version=3;b.nodes[0].branchFolded=true;b.nodes[0].x=420;b.nodes[0].y=100;b.nodes[1].locked=true;
 b.edges=[{id:'branch',kind:'branch',from:'0',to:'1',label:''}];const before=clone(b);
 tidyBoard(b);assert.deepEqual(b.nodes.slice(0,2),before.nodes.slice(0,2));assert.deepEqual(b.edges,before.edges);
});
test('tidy preserves locked groups and their internal geometry',()=>{
 const b=fixture(3);const group:Card={id:'frame',kind:'section',x:300,y:-20,width:430,height:280,color:'blue',locked:true};b.nodes.push(group);
 const before=clone(b);tidyBoard(b);assert.deepEqual(b.nodes[1],before.nodes[1]);assert.deepEqual(group,before.nodes[3]);
});
test('selection expansion preserves flat frame ownership and folded out-of-frame descendants',()=>{
 const b=fixture(5);b.version=3;b.nodes[0].branchFolded=true;
 b.nodes.push({id:'outer',kind:'section',x:-20,y:-20,width:700,height:600,color:'blue'},{id:'inner',kind:'section',x:-10,y:-10,width:310,height:280,color:'green'});
 b.edges=[{id:'branch',kind:'branch',from:'0',to:'4',label:''}];
 assert.deepEqual([...expandedSelection(b,new Set(['outer','missing']))].sort(),['0','1','4','outer'].sort());
 // Every operation gets a fresh index: structural edits and undo never reuse stale membership.
 b.nodes[0].branchFolded=false;b.nodes[1].x=2000;
 assert.deepEqual([...expandedSelection(b,new Set(['outer']))].sort(),['0','outer'].sort());
});
test('frame expansion retains board ordering independently of selection order',()=>{
 const b=fixture(3);b.nodes.push({id:'first',kind:'section',x:-20,y:-20,width:340,height:270,color:'blue'},{id:'second',kind:'section',x:350,y:-20,width:340,height:270,color:'green'});
 assert.deepEqual([...expandedSelection(b,new Set(['second','first']))],['second','first','0','1']);
});
test('tidy keeps an unlocked frame pinned when one contained card is locked',()=>{
 const b=fixture(4);b.nodes[1].locked=true;b.nodes.push({id:'frame',kind:'section',x:350,y:-20,width:340,height:270,color:'blue'});
 const before=clone(b);tidyBoard(b);assert.deepEqual(b.nodes[1],before.nodes[1]);assert.deepEqual(b.nodes[4],before.nodes[4]);
});
