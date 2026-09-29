import test from 'node:test';
import assert from 'node:assert/strict';
import {foldCards} from '../src/board-tools';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {visibleBranchBoard} from '../src/mindmap';
import {clone,emptyBoard,parseBoard,type Board,type Card} from '../src/model';
import {nodeFitChanges} from '../src/node-fit-batch';
import {sectionContains} from '../src/sections';

function mixedBoard():Board {
  return {...emptyBoard(),version:3,nodes:[
    {id:'group',kind:'section',title:'混合阅读',x:0,y:0,width:700,height:1200,color:'green',transparent:true},
    {id:'a',kind:'card',file:'notes/长文A.md',x:40,y:60,width:600,height:72,color:'blue',autoFit:true,transparent:true,collapsed:true,expandedHeight:620},
    {id:'b',kind:'card',file:'notes/长文B.md',x:40,y:190,width:600,height:72,color:'purple',autoFit:true,transparent:true,collapsed:true,expandedHeight:420},
    {id:'image',kind:'image',file:'attachments/图.png',x:40,y:320,width:280,height:72,color:'rose',collapsed:true,expandedHeight:300},
    {id:'audio',kind:'audio',file:'attachments/音频.mp3',x:360,y:320,width:280,height:72,color:'sand',collapsed:true,expandedHeight:140},
    {id:'table',kind:'text',text:'| 项目 | 结果 |\n| --- | --- |\n| 阅读 | 已记录 |',x:40,y:450,width:600,height:200,color:'teal',textAutoHeight:true,transparent:true},
    {id:'pdf',kind:'pdf',file:'attachments/原文.pdf',pdfPage:2,x:40,y:700,width:600,height:300,color:'orange'},
    {id:'outside',kind:'text',text:'分组之外',x:40,y:1260,width:600,height:100,color:'slate'},
    {id:'unrelated',kind:'text',text:'另一列',x:1000,y:60,width:280,height:100,color:'blue'}
  ]};
}

function at(board:Board,id:string):Card {
  const node=board.nodes.find(item=>item.id===id);
  assert(node,`missing node ${id}`);
  return node;
}

function change(board:Board,edit:(draft:Board)=>void,options:{measurement?:boolean}={}):void {
  const before=clone(board);
  edit(board);
  reflowReadingContent(board,before,options);
}

function fold(board:Board,id:string,collapsed:boolean):void {
  change(board,draft=>foldCards(draft,new Set([id]),collapsed));
}

function measure(board:Board,id:string,height:number):void {
  const key=`${id}-current`,node=at(board,id);
  const fits=new Map([[id,{width:node.width,height,key}]]);
  const changes=nodeFitChanges(board.nodes,fits,new Map([[id,key]]),new Set());
  assert.equal(changes.size,1,'the current expanded note accepts its delayed measurement');
  change(board,draft=>{for(const [target,size]of changes)Object.assign(at(draft,target),size);},{measurement:true});
}

function geometry(board:Board) {
  return board.nodes.map(({id,x,y,width,height})=>({id,x,y,width,height})).sort((a,b)=>a.id.localeCompare(b.id));
}

function nodeGeometry(node:Card) {
  const {x,y,width,height}=node;
  return {x,y,width,height};
}

function noVisibleOverlaps(board:Board):void {
  const nodes=visibleBranchBoard(board).nodes.filter(node=>node.kind!=='section');
  for(let i=0;i<nodes.length;i++)for(const b of nodes.slice(i+1)) {
    const a=nodes[i];
    assert.equal(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y,false,`${a.id} overlaps ${b.id}`);
  }
}

function originalMemberships(board:Board,before:Board):void {
  const frame=at(board,'group'),oldFrame=at(before,'group');
  for(const node of board.nodes)assert.equal(sectionContains(frame,node),sectionContains(oldFrame,at(before,node.id)),`membership changed for ${node.id}`);
}

test('closing a mixed-group note after delayed growth restores neighboring positions and original frame dimensions',async()=>{
  const board=mixedBoard(),baseline=clone(board);
  fold(board,'a',false);
  await Promise.resolve();
  measure(board,'a',1550);
  assert.notDeepEqual(nodeGeometry(at(board,'table')),nodeGeometry(at(baseline,'table')));
  assert(at(board,'group').height>at(baseline,'group').height);
  noVisibleOverlaps(board);

  fold(board,'a',true);
  assert.deepEqual(geometry(board),geometry(baseline));
  assert.equal(at(board,'a').expandedHeight,1550,'the latest content measurement survives layout recovery');
  for(const id of ['b','image','audio'])assert.deepEqual(at(board,id),at(baseline,id));
  assert.equal(at(board,'a').transparent,true);
  originalMemberships(board,baseline);
  noVisibleOverlaps(board);
  parseBoard(JSON.stringify(board));
});

test('closing A preserves still-expanded B, and closing both restores the original mixed-group layout',()=>{
  const board=mixedBoard(),baseline=clone(board);
  fold(board,'a',false);
  fold(board,'b',false);
  noVisibleOverlaps(board);

  fold(board,'a',true);
  assert.equal(at(board,'a').collapsed,true);
  assert.equal(at(board,'b').collapsed,undefined);
  assert.equal(at(board,'b').height,420);
  noVisibleOverlaps(board);
  originalMemberships(board,baseline);

  fold(board,'b',true);
  assert.deepEqual(geometry(board),geometry(baseline));
  assert.equal(at(board,'a').expandedHeight,620);
  assert.equal(at(board,'b').expandedHeight,420);
  noVisibleOverlaps(board);
});

test('reopening a recovered note uses its newest measured content height rather than the original remembered height',()=>{
  const board=mixedBoard(),baseline=clone(board);
  fold(board,'a',false);
  measure(board,'a',1700);
  fold(board,'a',true);
  assert.equal(at(board,'a').expandedHeight,1700);
  fold(board,'a',false);
  assert.equal(at(board,'a').height,1700);
  assert.equal(at(board,'a').expandedHeight,undefined);
  noVisibleOverlaps(board);
  fold(board,'a',true);
  assert.deepEqual(geometry(board),geometry(baseline));
});

const manualEdits:{name:string;edit:(board:Board)=>void;check:(board:Board,edited:Board)=>void}[]=[
  {name:'moving a neighboring card',edit:board=>{at(board,'table').x+=30;at(board,'table').y+=17;},check:(board,edited)=>assert.deepEqual(nodeGeometry(at(board,'table')),nodeGeometry(at(edited,'table')))},
  {name:'resizing a neighboring card',edit:board=>{at(board,'table').width-=80;at(board,'table').height-=20;},check:(board,edited)=>assert.deepEqual(nodeGeometry(at(board,'table')),nodeGeometry(at(edited,'table')))},
  {name:'resizing the group frame',edit:board=>{at(board,'group').width+=100;at(board,'group').height+=90;},check:(board,edited)=>assert.deepEqual(nodeGeometry(at(board,'group')),nodeGeometry(at(edited,'group')))},
  {name:'adding a new card',edit:board=>{board.nodes.push({id:'added',kind:'text',text:'新增内容',x:1400,y:300,width:240,height:100,color:'green'});},check:(board,edited)=>assert.deepEqual(at(board,'added'),at(edited,'added'))},
  {name:'deleting a neighboring card',edit:board=>{board.nodes=board.nodes.filter(node=>node.id!=='image');},check:board=>assert.equal(board.nodes.some(node=>node.id==='image'),false)},
  {name:'locking a displaced card',edit:board=>{at(board,'pdf').locked=true;},check:(board,edited)=>assert.deepEqual(at(board,'pdf'),at(edited,'pdf'))},
  {name:'changing branch structure',edit:board=>{board.edges.push({id:'new-branch',from:'a',to:'image',kind:'branch',label:''});},check:(board,edited)=>assert.deepEqual(board.edges,edited.edges)}
];

for(const {name,edit,check}of manualEdits)test(`closing a note does not overwrite the user's ${name}`,()=>{
  const board=mixedBoard();
  fold(board,'a',false);
  change(board,edit);
  const edited=clone(board);
  assert.doesNotThrow(()=>fold(board,'a',true));
  assert.equal(at(board,'a').collapsed,true);
  assert.equal(at(board,'a').height,72);
  check(board,edited);
  parseBoard(JSON.stringify(board));
});

test('ordinary style and text edits survive closing while allowing the original geometry to recover',()=>{
  const board=mixedBoard(),baseline=clone(board);
  fold(board,'a',false);
  change(board,draft=>{at(draft,'a').color='rose';at(draft,'table').text='用户修改后的正文';});
  fold(board,'a',true);
  assert.deepEqual(geometry(board),geometry(baseline));
  assert.equal(at(board,'a').color,'rose');
  assert.equal(at(board,'table').text,'用户修改后的正文');
  noVisibleOverlaps(board);
});

test('JSON save and reload retain enough recovery state to close a measured note back into its original layout',()=>{
  const board=mixedBoard(),baseline=clone(board);
  fold(board,'a',false);
  measure(board,'a',1550);
  const restored=parseBoard(JSON.stringify(board));
  assert.deepEqual(geometry(restored),geometry(board));
  fold(restored,'a',true);
  assert.deepEqual(geometry(restored),geometry(baseline));
  assert.equal(at(restored,'a').expandedHeight,1550);
  originalMemberships(restored,baseline);
  noVisibleOverlaps(restored);
});

test('a note still closes safely when locked new content occupies an original recovery position',()=>{
  const board=mixedBoard(),baseline=clone(board);
  fold(board,'a',false);
  measure(board,'a',1550);
  const originalTable=at(baseline,'table');
  change(board,draft=>draft.nodes.push({id:'locked-new',kind:'text',text:'用户放入的锁定内容',...nodeGeometry(originalTable),locked:true,color:'rose'}));
  const obstacle=clone(at(board,'locked-new'));

  // The full original placement is now unsafe. The public guarantee is that a
  // recovery conflict cannot block collapse or displace the user's locked card.
  assert.doesNotThrow(()=>fold(board,'a',true));
  assert.equal(at(board,'a').collapsed,true);
  assert.equal(at(board,'a').height,72);
  assert.equal(at(board,'a').expandedHeight,1550);
  assert.deepEqual(at(board,'locked-new'),obstacle);
  noVisibleOverlaps(board);
  parseBoard(JSON.stringify(board));
});
