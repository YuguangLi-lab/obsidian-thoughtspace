import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrainBoard,isBrainBoard} from '../src/brain-board';
import {BOARD_MINDMAP_HISTORY_LIMIT,createBoardMindmapState,supportsBoardMindmapTarget,updateBoardMindmapState} from '../src/board-mindmap';
import {assertBoardGeometry,clone,emptyBoard,extractSubboard,History,parseBoard,removeNodes,type Board,type Card} from '../src/model';

const card=(id:string,patch:Partial<Card>={}):Card=>clone({id,kind:'card',file:`Notes/${id}.md`,x:30,y:70,width:300,height:200,color:'sand',...patch});
const fixture=()=>{
 const board=createBrainBoard('parent');
 board.nodes=[card('parent',{x:-450,y:-240}),card('child',{x:120,y:140}),card('group',{kind:'section',file:undefined,title:'资料分组',x:-200,y:10,width:900,height:600}),card('subboard',{kind:'board',file:'Nested.thoughtspace'})];
 board.edges=[{id:'branch',from:'parent',to:'child',kind:'branch',label:'依据'},{id:'association',from:'child',to:'subboard',direction:'both',label:'参考'}];
 return board;
};
const reopen=(board:unknown)=>parseBoard(JSON.stringify(board));

test('dedicated brain boards are explicit independent empty documents without a container node',()=>{
 const first=createBrainBoard(),second=createBrainBoard();
 assert.deepEqual(first,{...emptyBoard(),version:3,presentation:'brain',brain:createBoardMindmapState()});
 assert(isBrainBoard(first));assert.equal(first.nodes.length,0);assert.equal(first.brainViewport,undefined);
 first.brain.expandedIds.push('local-id');first.viewport.x=100;
 assert.deepEqual(second,createBrainBoard());assert.deepEqual(reopen(second),second);
});

test('only the new explicit presentation is recognized; legacy mindmap mode and containers remain ordinary boards',()=>{
 const plain=emptyBoard(),traditional:Board={...emptyBoard(),version:3,mode:'mindmap'},embedded:Board={...emptyBoard(),version:3,nodes:[card('map',{kind:'mindmap',file:undefined,mindmap:createBoardMindmapState()})]};
 for(const board of [plain,traditional,embedded]){assert.equal(isBrainBoard(board),false);assert.deepEqual(reopen(board),board);}
 assert.equal(isBrainBoard(undefined),false);assert.equal(isBrainBoard(null),false);
 const dedicated=fixture();dedicated.mode='mindmap';assert.deepEqual(reopen(dedicated),dedicated);assert(isBrainBoard(dedicated));
});

test('dedicated documents require version 3 and valid bounded top-level state',()=>{
 const valid=createBrainBoard('missing-but-saved');assert.deepEqual(reopen(valid),valid);
 for(const version of [1,2,4])assert.throws(()=>reopen({...valid,version}),/版本|展示模式/);
 for(const presentation of ['',null,'free','mindmap',true,1])assert.throws(()=>reopen({...valid,presentation}),/展示模式/);
 for(const brain of [undefined,null,{},[],{...valid.brain,centerId:'different'},{...valid.brain,extra:'field'}])assert.throws(()=>reopen({...valid,brain}),/脑图白板状态/);
 assert.equal(isBrainBoard({...valid,brain:undefined}),false);
 assert.equal(isBrainBoard({...valid,version:2}),false);
});

test('brain state and camera cannot leak onto ordinary or legacy boards',()=>{
 for(const version of [1,2,3] as const)for(const fields of [{brain:createBoardMindmapState()},{brainViewport:{x:0,y:0,zoom:1}},{brain:createBoardMindmapState(),brainViewport:{x:0,y:0,zoom:1}}]){
  assert.throws(()=>reopen({...emptyBoard(),version,...fields}),/脑图白板状态|脑图白板视口/);
 }
});

test('brain viewport is separate, optional, finite, bounded and preserved exactly on reopen',()=>{
 const board=fixture();board.brainViewport={x:-140.25,y:400.5,zoom:.65};board.viewport={x:82,y:-47,zoom:1.2};
 assert.deepEqual(reopen(board),board);assert.doesNotThrow(()=>assertBoardGeometry(board));
 for(const zoom of [.15,2.5])assert.doesNotThrow(()=>reopen({...board,brainViewport:{x:0,y:0,zoom}}));
 for(const brainViewport of [null,{},[],{x:0,y:0},{x:0,y:0,zoom:0},{x:0,y:0,zoom:2.50001},{x:0,y:0,zoom:.14999},{x:NaN,y:0,zoom:1},{x:0,y:Infinity,zoom:1},{x:0,y:0,zoom:'1'},{x:0,y:0,zoom:1,hidden:true}]){
  assert.throws(()=>reopen({...board,brainViewport}),/脑图白板视口/);
  assert.throws(()=>assertBoardGeometry({...board,brainViewport} as Board),/脑图白板视口/);
 }
});

test('opening or navigating a dedicated board preserves all source objects, legacy data and stored geometry',()=>{
 const board=fixture();
 board.nodes.push(card('text',{kind:'text',file:undefined,text:'仅兼容保留，不进入脑图',height:40}),card('embedded',{kind:'mindmap',file:undefined,mindmap:createBoardMindmapState('child')}));
 const original=clone(board),geometry=JSON.stringify(board.nodes);
 for(const id of ['group','subboard','child'])board.brain=updateBoardMindmapState(board.brain,{type:'center',id},board.nodes);
 assert.equal(JSON.stringify(board.nodes),geometry);assert.deepEqual(reopen(board).nodes,original.nodes);assert.deepEqual(reopen(board).edges,original.edges);
 assert.deepEqual(board.nodes.filter(supportsBoardMindmapTarget).map(node=>node.id),['parent','child','group','subboard']);
 for(const id of ['text','embedded'])assert.throws(()=>updateBoardMindmapState(board.brain,{type:'center',id},board.nodes),/不支持脑图/);
 assert.equal(reopen(board).nodes.length,original.nodes.length);
});

test('dedicated center history remains bounded and repeated visits preserve back and forward navigation across reopen',()=>{
 const board=fixture();
 for(let i=0;i<120;i++)board.brain=updateBoardMindmapState(board.brain,{type:'center',id:i%2?'parent':'child'},board.nodes);
 assert.equal(board.brain.history.entries.length,BOARD_MINDMAP_HISTORY_LIMIT);assert.equal(board.brain.history.index,BOARD_MINDMAP_HISTORY_LIMIT-1);
 const before=clone(board.brain);board.brain=updateBoardMindmapState(board.brain,{type:'history',direction:'back'},board.nodes);
 const saved=reopen(board);assert(isBrainBoard(saved));assert.equal(saved.brain.centerId,'child');
 saved.brain=updateBoardMindmapState(saved.brain,{type:'history',direction:'forward'},saved.nodes);assert.deepEqual(saved.brain,before);
 const same=updateBoardMindmapState(saved.brain,{type:'center',id:saved.brain.centerId!},saved.nodes);assert.deepEqual(same,saved.brain);
});

test('normal board undo restores dedicated view state and camera without changing source geometry',()=>{
 const board=fixture(),history=new History(),before=clone(board);history.push(board);
 board.brain=updateBoardMindmapState(board.brain,{type:'center',id:'subboard'},board.nodes);board.brainViewport={x:10,y:20,zoom:.75};
 const after=clone(board),undone=history.undo(board)!;assert.deepEqual(undone,before);assert.deepEqual(history.redo(undone),after);
 assert.deepEqual(after.nodes,before.nodes);assert.deepEqual(after.edges,before.edges);assert.deepEqual(reopen(after),after);
});

test('renaming and losing a source preserve saved IDs so undo or restored sources can recover the center',()=>{
 const board=fixture();board.brain=updateBoardMindmapState(board.brain,{type:'center',id:'child'},board.nodes);
 const state=clone(board.brain);board.nodes[1].file='Notes/Renamed.md';assert.deepEqual(reopen(board).brain,state);
 removeNodes(board,new Set(['child']));const read=reopen(board);assert(isBrainBoard(read));assert.deepEqual(read.brain,state);assert.equal(read.nodes.some(node=>node.id==='child'),false);
 assert.throws(()=>updateBoardMindmapState(read.brain,{type:'center',id:'child'},read.nodes),/已移除/);
 read.nodes.push(card('child'));assert.deepEqual(updateBoardMindmapState(read.brain,{type:'center',id:'child'},read.nodes),state);
});

test('extracting an ordinary subboard does not copy dedicated presentation or references from its parent',()=>{
 const board=fixture(),before=clone(board),{parent,child}=extractSubboard(board,new Set(['child']),'Extracted.thoughtspace','子白板','portal');
 assert(isBrainBoard(parent));assert.deepEqual(parent.brain,before.brain);assert.equal(child.presentation,undefined);assert.equal(child.brain,undefined);assert.equal(child.brainViewport,undefined);
 assert.deepEqual(reopen(parent),parent);assert.deepEqual(reopen(child),child);assert.deepEqual(board,before);
});
