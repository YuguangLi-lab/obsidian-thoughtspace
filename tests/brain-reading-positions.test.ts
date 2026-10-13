import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,History,parseBoard,type Board,type Card} from '../src/model';
import {createBoardMindmapState,updateBoardMindmapState,validBoardMindmapState} from '../src/board-mindmap';
import * as positions from '../src/brain-reading-positions';
import {boardLink,brainPositionLink,parseBoardLink} from '../src/deeplinks';
const card=(id:string):Card=>({id,kind:'card',file:`Notes/${id}.md`,title:id,x:10,y:20,width:120,height:80,color:'sand'});
function fixture():Board{return{...emptyBoard(),version:3,presentation:'brain',brain:createBoardMindmapState('a'),nodes:['a','b','c'].map(card),edges:[{id:'ab',from:'a',to:'b',kind:'branch',label:'保留关系'}],brainViewport:{x:30.125,y:-70.25,zoom:.37},savedViews:[{id:'ordinary',name:'普通视角',viewport:{x:100,y:200,zoom:1}}]};}
const capture=(board:Board)=>positions.captureBrainReadingPosition(board,board.brainViewport!);

test('named brain reading locations own compact exact state without content or recursive histories',()=>{
 const board=fixture();board.brain!.expandedIds=['a','c'];board.brain!.descendantDepth=4;board.brain!.pins=['b'];const before=clone(board),state=capture(board);
 positions.addBrainReadingPosition(board,'reading-a','  证据链  ',state);const position=board.brainReadingPositions![0];assert.equal(position.name,'证据链');assert.deepEqual(Object.keys(position).sort(),['centerId','depth','expandedIds','id','name','version','viewport']);
 state.viewport.x=999;state.expandedIds.splice(0);assert.equal(position.viewport.x,30.125);assert.deepEqual(position.expandedIds,['a','c']);assert.deepEqual(board.nodes,before.nodes);assert.deepEqual(board.edges,before.edges);assert.deepEqual(board.brain,before.brain);assert.deepEqual(board.savedViews,before.savedViews);assert.deepEqual(board.brainViewport,before.brainViewport);
 assert.deepEqual(parseBoard(JSON.stringify(board)).brainReadingPositions,board.brainReadingPositions);
});
test('restoring a named position keeps pins and existing navigation history and one normal transaction undoes once',()=>{
 const board=fixture();board.brain!.expandedIds=['a'];board.brain!.descendantDepth=3;positions.addBrainReadingPosition(board,'reading','论证',capture(board));
 board.brain=updateBoardMindmapState(board.brain!,{type:'center',id:'b'},board.nodes);board.brain=updateBoardMindmapState(board.brain,{type:'center',id:'c'},board.nodes);board.brain!.pins=['c'];board.brain!.expandedIds=['b'];board.brainViewport={x:777,y:888,zoom:1.2};const before=clone(board),history=new History();
 history.push(before);const result=positions.restoreBrainReadingPosition(board,'reading',positions.brainReadingPositionStamp(board.brainReadingPositions![0]));assert.deepEqual(result,{degraded:false,centerId:'a'});assert.deepEqual(board.brain!.history,{entries:['a','b','c','a'],index:3});assert.deepEqual(board.brain!.pins,['c']);assert.deepEqual(board.brain!.expandedIds,['a']);assert.equal(board.brain!.descendantDepth,3);assert.deepEqual(board.brainViewport,{x:30.125,y:-70.25,zoom:.37});assert(validBoardMindmapState(board.brain));
 assert.deepEqual(history.undo(board),before);assert.equal(history.undoStack.length,0);
});
test('returning an origin is compact reading state rather than reset of later graph or navigation history',()=>{
 const board=fixture(),origin=capture(board);board.brain=updateBoardMindmapState(board.brain!,{type:'center',id:'b'},board.nodes);board.nodes[0].title='更名后的原中心';board.nodes[1].x=555;board.edges[0].label='后续编辑';board.brain!.pins=['c'];board.brainViewport={x:400,y:500,zoom:2.5};
 positions.applyBrainReadingPosition(board,origin);assert.equal(board.brain!.centerId,'a');assert.deepEqual(board.brain!.history.entries,['a','b','a']);assert.equal(board.brain!.descendantDepth,undefined);assert.equal(board.nodes[0].title,'更名后的原中心');assert.equal(board.nodes[1].x,555);assert.equal(board.edges[0].label,'后续编辑');assert.deepEqual(board.brain!.pins,['c']);assert.deepEqual(board.brainViewport,origin.viewport);
});
test('node rename preserves identity while missing expanded references are pruned only on explicit restore',()=>{
 const board=fixture();board.brain!.expandedIds=['a','c'];positions.addBrainReadingPosition(board,'r','阅读',capture(board));board.nodes[0].file='Renamed/A.md';board.nodes[0].title='新标题';board.nodes=board.nodes.filter(node=>node.id!=='c');const persisted=clone(board.brainReadingPositions);
 const result=positions.restoreBrainReadingPosition(board,'r');assert(result.degraded);assert.match(result.reason!,/部分展开/);assert.equal(board.brain!.centerId,'a');assert.deepEqual(board.brain!.expandedIds,['a']);assert.deepEqual(board.brainReadingPositions,persisted);assert.deepEqual(board.brainViewport,{x:30.125,y:-70.25,zoom:.37});
});
for(const currentAvailable of [true,false])test('deleted saved center safely resolves '+(currentAvailable?'current center':'first available target'),()=>{
 const board=fixture();positions.addBrainReadingPosition(board,'r','已删除中心',capture(board));board.brain=updateBoardMindmapState(board.brain!,{type:'center',id:'c'},board.nodes);board.nodes=board.nodes.filter(node=>node.id!=='a'&&(currentAvailable||node.id!=='c'));board.edges=[];
 assert(positions.validBrainReadingPositions(board.brainReadingPositions));const result=positions.restoreBrainReadingPosition(board,'r');assert(result.degraded);assert.equal(board.brain!.centerId,currentAvailable?'c':'b');assert.equal(board.brainViewport,undefined);assert(validBoardMindmapState(board.brain));
});
test('no remaining targets retains meaningful old navigation entries and drops incompatible camera',()=>{
 const board=fixture();positions.addBrainReadingPosition(board,'r','原中心',capture(board));board.nodes=[];board.edges=[];const result=positions.restoreBrainReadingPosition(board,'r');assert(result.degraded);assert.equal(result.centerId,undefined);assert.equal(board.brainViewport,undefined);assert(validBoardMindmapState(board.brain));assert.deepEqual(board.brain!.history.entries,['a']);
});
test('rename, update, removal and stale revision checks leave unrelated fields intact',()=>{
 const board=fixture();positions.addBrainReadingPosition(board,'a','第一个',capture(board));positions.addBrainReadingPosition(board,'b','第二个',capture(board));const second=clone(board.brainReadingPositions![1]),before=clone({...board,brainReadingPositions:undefined}),stamp=positions.brainReadingPositionStamp(board.brainReadingPositions![0]);
 positions.renameBrainReadingPosition(board,'a','  新名称  ',stamp);assert.equal(board.brainReadingPositions![0].name,'新名称');
 for(const change of [()=>positions.renameBrainReadingPosition(board,'a','过期',stamp),()=>positions.updateBrainReadingPosition(board,'a',capture(board),stamp),()=>positions.removeBrainReadingPosition(board,'a',stamp),()=>positions.restoreBrainReadingPosition(board,'a',stamp)]){const current=JSON.stringify(board);assert.throws(change,/已变化/);assert.equal(JSON.stringify(board),current);}
 const valid=positions.brainReadingPositionStamp(board.brainReadingPositions![0]),updated={...capture(board),depth:5,viewport:{x:5,y:6,zoom:2.5}};positions.updateBrainReadingPosition(board,'a',updated,valid);assert.equal(board.brainReadingPositions![0].depth,5);assert.deepEqual(board.brainReadingPositions![1],second);assert.deepEqual(clone({...board,brainReadingPositions:undefined}),before);
 positions.removeBrainReadingPosition(board,'a');assert.deepEqual(board.brainReadingPositions,[second]);assert.throws(()=>positions.restoreBrainReadingPosition(board,'a'),/已移除/);
});
test('invalid captures, names, duplicate IDs and exhausted capacity cannot mutate data',()=>{
 const board=fixture();positions.addBrainReadingPosition(board,'a','有效',capture(board));for(const mutate of [()=>positions.addBrainReadingPosition(board,'a','重复',capture(board)),()=>positions.addBrainReadingPosition(board,'b',' ',capture(board)),()=>positions.renameBrainReadingPosition(board,'a','x'.repeat(101)),()=>positions.updateBrainReadingPosition(board,'a',{...capture(board),depth:6}),()=>positions.updateBrainReadingPosition(board,'a',{...capture(board),viewport:{x:NaN,y:0,zoom:1}})]){const before=JSON.stringify(board);assert.throws(mutate);assert.equal(JSON.stringify(board),before);}
 for(let i=1;i<50;i++)positions.addBrainReadingPosition(board,'a'+i,'阅读 '+i,capture(board));assert.throws(()=>positions.addBrainReadingPosition(board,'51','溢出',capture(board)),/50/);assert.equal(board.brainReadingPositions!.length,50);
 assert.throws(()=>positions.captureBrainReadingPosition(emptyBoard(),{x:0,y:0,zoom:1}),/不支持/);const empty=fixture();empty.nodes=[];assert.throws(()=>capture(empty),/可用/);
});
test('strict bounded validation rejects corrupt or recursive named payloads and old absent field remains absent',()=>{
 const board=fixture();positions.addBrainReadingPosition(board,'r','正常',capture(board));const position=board.brainReadingPositions![0];assert(positions.validBrainReadingPositions([position]));assert(!positions.validBrainReadingPositions(undefined));assert.equal(parseBoard(JSON.stringify({...board,brainReadingPositions:undefined})).brainReadingPositions,undefined);
 for(const invalid of [null,{},[position,position],Array.from({length:51},(_,i)=>({...position,id:String(i)})),[{...position,id:'\n'}],[{...position,name:'  未规范  '}],[{...position,name:'换\n行'}],[{...position,version:2}],[{...position,centerId:''}],[{...position,expandedIds:Array(9).fill('a')}],[{...position,expandedIds:['a','a']}],[{...position,depth:0}],[{...position,depth:1.5}],[{...position,history:{entries:['a'],index:0}}],[{...position,viewport:{...position.viewport,x:Infinity}}],[{...position,viewport:{...position.viewport,zoom:.01}}],[{...position,viewport:{...position.viewport,hidden:'unsafe'}}]])assert(!positions.validBrainReadingPositions(invalid),JSON.stringify(invalid));
});
test('brain reading links round trip encoded names and stable IDs alongside existing object links',()=>{
 const vault='研究 & 我的库',file='研究/脑图 + %20.md',id='阅读 /?& #';const url=new URL(brainPositionLink(vault,file,id));assert.deepEqual(parseBoardLink(Object.fromEntries(url.searchParams),vault),{file,readingPosition:id});const node=new URL(boardLink(vault,file,'card/a'));assert.deepEqual(parseBoardLink(Object.fromEntries(node.searchParams),vault),{file,node:'card/a'});
 for(const readingPosition of ['', ' ', '\n', 'x'.repeat(257)]){assert.throws(()=>brainPositionLink(vault,file,readingPosition));assert.throws(()=>parseBoardLink({space:vault,file,readingPosition},vault));}assert.throws(()=>parseBoardLink({space:vault,file,node:'a',readingPosition:'r'},vault),/无效/);assert.throws(()=>parseBoardLink({space:'other',file,readingPosition:'r'},vault));
});
