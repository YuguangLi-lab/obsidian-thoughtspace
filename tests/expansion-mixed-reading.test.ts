import test from 'node:test';
import assert from 'node:assert/strict';
import {foldCards} from '../src/board-tools';
import {reflowExpandedContent} from '../src/expansion-layout';
import {branchState,visibleBranchBoard} from '../src/mindmap';
import {clone,emptyBoard,parseBoard,type Board,type Card} from '../src/model';
import {nodeFitChanges,type NodeFit} from '../src/node-fit-batch';
import {foldSections,sectionContains,sectionFoldState} from '../src/sections';

const memberIds=['reading','image','audio','file','table','pdf'];
const foldedMediaIds=['image','audio','file'];

// Representative mixed-reading geometry; no real vault files or old screenshot
// state are loaded. A frame intentionally contains its cards and is not an
// obstacle in the visible-card overlap oracle.
function mixedReadingBoard():Board {
  return {...emptyBoard(),version:3,nodes:[
    {id:'group',kind:'section',title:'混合阅读资料',x:0,y:0,width:700,height:1100,color:'green',transparent:true},
    {id:'reading',kind:'card',file:'notes/透明长文.md',x:40,y:60,width:600,height:72,color:'blue',transparent:true,fillColor:'none',autoFit:true,collapsed:true,expandedHeight:620},
    {id:'image',kind:'image',file:'attachments/示意图.png',x:40,y:190,width:280,height:72,color:'rose',collapsed:true,expandedHeight:300},
    {id:'audio',kind:'audio',file:'attachments/讲解.mp3',x:360,y:190,width:280,height:72,color:'purple',collapsed:true,expandedHeight:140,mediaStart:12},
    {id:'file',kind:'card',file:'notes/附件说明.md',x:40,y:310,width:280,height:72,color:'sand',autoFit:true,collapsed:true,expandedHeight:220},
    {id:'table',kind:'text',text:'| 项目 | 结果 |\n| --- | --- |\n| 图像 | 待核对 |\n| 音频 | 已记录 |',x:40,y:430,width:600,height:200,color:'teal',transparent:true,textAutoHeight:true},
    {id:'pdf',kind:'pdf',file:'attachments/原文.pdf',pdfPage:2,x:40,y:680,width:600,height:280,color:'orange'},
    {id:'outside',kind:'text',text:'分组之外的卡片',x:40,y:1170,width:600,height:100,color:'slate'},
    {id:'unrelated',kind:'text',text:'另一列保持原位',x:1000,y:60,width:280,height:100,color:'blue'}
  ]};
}

function at(board:Board,id:string):Card {
  const node=board.nodes.find(item=>item.id===id);
  assert(node,`missing fixture node ${id}`);
  return node;
}

function change(board:Board,edit:(draft:Board)=>void):Board {
  const before=clone(board);
  edit(board);
  reflowExpandedContent(board,before);
  return before;
}

function noVisibleOverlaps(board:Board):void {
  const visible=visibleBranchBoard(board).nodes.filter(node=>node.kind!=='section');
  for(let i=0;i<visible.length;i++)for(const b of visible.slice(i+1)) {
    const a=visible[i];
    const overlap=a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
    assert.equal(overlap,false,`${a.id} overlaps visible ${b.id}`);
  }
}

function membershipAndStyle(board:Board,before:Board):void {
  const frame=at(board,'group');
  assert.deepEqual(board.nodes.filter(node=>sectionContains(frame,node)).map(node=>node.id).sort(),[...memberIds].sort());
  assert.deepEqual(at(board,'unrelated'),at(before,'unrelated'));
  assert.equal(at(board,'reading').transparent,true);
  assert.equal(at(board,'reading').fillColor,'none');
  assert.equal(at(board,'table').transparent,true);
  assert.deepEqual(board.edges,before.edges);
  for(const node of board.nodes) {
    const old=at(before,node.id);
    assert.equal(node.x,old.x,`${node.id} changed column`);
    assert.equal(node.file,old.file,`${node.id} changed source`);
    assert.equal(node.text,old.text,`${node.id} changed text`);
    assert.equal(node.pdfPage,old.pdfPage);
    assert.equal(node.mediaStart,old.mediaStart);
  }
}

function remainingFolds(board:Board,before:Board,except:ReadonlySet<string>=new Set()):void {
  for(const old of before.nodes)if(!except.has(old.id)) {
    const next=at(board,old.id);
    assert.equal(next.collapsed,old.collapsed,`${old.id} changed collapsed flag`);
    assert.equal(next.expandedHeight,old.expandedHeight,`${old.id} lost remembered height`);
    assert.equal(next.branchFolded,old.branchFolded);
    assert.equal(next.sectionFolded,old.sectionFolded);
  }
}

function reload(board:Board):Board {
  const restored=parseBoard(JSON.stringify(board));
  assert.deepEqual(restored,board);
  assert.deepEqual([...sectionFoldState(restored).hidden].sort(),[...sectionFoldState(board).hidden].sort());
  assert.deepEqual(visibleBranchBoard(restored),visibleBranchBoard(board));
  return restored;
}

test('mixed reading expansion preserves transparent styles, compact media, group ownership and outside cards',()=>{
  const board=mixedReadingBoard(),baseline=clone(board);
  parseBoard(JSON.stringify(board));
  noVisibleOverlaps(board);
  change(board,draft=>foldCards(draft,new Set(['reading']),false));

  assert.equal(at(board,'reading').height,620);
  assert.equal(at(board,'reading').collapsed,undefined);
  assert.equal(at(board,'reading').expandedHeight,undefined);
  assert(at(board,'group').height>at(baseline,'group').height);
  assert(at(board,'outside').y>at(baseline,'outside').y,'the outside card must clear the growing group');
  remainingFolds(board,baseline,new Set(['reading']));
  membershipAndStyle(board,baseline);
  noVisibleOverlaps(board);
  reload(board);
});

test('delayed markdown and table measurements still grow mixed reading content without reopening folded attachments',async()=>{
  const board=mixedReadingBoard(),baseline=clone(board);
  change(board,draft=>foldCards(draft,new Set(['reading']),false));
  const firstExpansion=clone(board);

  // Deliver a later renderer measurement through the production fit filter.
  // This exercises the geometry path, not browser measurement or Session timing.
  await Promise.resolve();
  const fits=new Map<string,NodeFit>([
    ['reading',{width:600,height:1550,key:'reading-expanded'}],
    ['table',{width:600,height:340,key:'table-current'}],
    ['image',{width:280,height:520,key:'image-current'}],
    ['file',{width:280,height:600,key:'file-current'}]
  ]);
  const keys=new Map([...fits].map(([id,fit])=>[id,fit.key]));
  const changes=nodeFitChanges(board.nodes,fits,keys,new Set());
  assert.deepEqual([...changes.keys()],['reading','table']);
  change(board,draft=>{for(const [id,size]of changes)Object.assign(at(draft,id),size);});

  assert.equal(at(board,'reading').height,1550);
  assert.equal(at(board,'table').height,340);
  assert(at(board,'pdf').y>at(firstExpansion,'pdf').y,'delayed growth must clear the PDF preview');
  remainingFolds(board,baseline,new Set(['reading']));
  membershipAndStyle(board,baseline);
  noVisibleOverlaps(board);
  const restored=reload(board);
  assert.equal(nodeFitChanges(restored.nodes,fits,keys,new Set()).size,0,'equal measurements are idempotent after reload');
});

test('each folded image, audio and file can expand without clearing sibling folds',()=>{
  for(const id of foldedMediaIds) {
    const board=mixedReadingBoard(),baseline=clone(board);
    change(board,draft=>foldCards(draft,new Set(['reading']),false));
    const before=clone(board),height=at(board,id).expandedHeight;
    change(board,draft=>foldCards(draft,new Set([id]),false));
    assert.equal(at(board,id).height,height);
    assert.equal(at(board,id).collapsed,undefined);
    remainingFolds(board,before,new Set([id]));
    membershipAndStyle(board,baseline);
    noVisibleOverlaps(board);
    reload(board);
  }
});

test('folding and reopening the mixed group restores visibility while keeping individual attachment folds',()=>{
  const board=mixedReadingBoard(),baseline=clone(board);
  change(board,draft=>foldCards(draft,new Set(['reading']),false));
  const expanded=clone(board);
  change(board,draft=>foldSections(draft,new Set(['group']),true));
  assert.deepEqual([...sectionFoldState(board).hidden].sort(),[...memberIds].sort());
  assert.deepEqual([...branchState(board).hidden].sort(),[...memberIds].sort());
  assert.deepEqual(visibleBranchBoard(board).nodes.filter(node=>node.kind!=='section').map(node=>node.id).sort(),['outside','unrelated']);
  remainingFolds(board,expanded,new Set(['group']));
  noVisibleOverlaps(board);

  const restored=reload(board);
  change(restored,draft=>foldSections(draft,new Set(['group']),false));
  assert.equal(sectionFoldState(restored).hidden.size,0);
  assert.deepEqual(restored,expanded,'reopening an undisturbed group should recover the same logical geometry');
  membershipAndStyle(restored,baseline);
  noVisibleOverlaps(restored);
  reload(restored);
});

test('repeated mixed reading collapse is stable but retains the first expansion displacement',t=>{
  const board=mixedReadingBoard(),baseline=clone(board);
  change(board,draft=>foldCards(draft,new Set(['reading']),false));
  const expanded=clone(board);
  change(board,draft=>foldCards(draft,new Set(['reading']),true));
  const collapsed=clone(board);

  // Current behavior / reproducible limitation: collapsing does not reclaim the
  // space created by the prior expansion. It must not compound that drift.
  assert(at(board,'table').y>at(baseline,'table').y);
  assert.equal(at(board,'table').y,at(expanded,'table').y);
  assert.equal(at(board,'group').height,at(expanded,'group').height);
  t.diagnostic(JSON.stringify({
    retainedTableDisplacement:at(board,'table').y-at(baseline,'table').y,
    retainedGroupHeightGrowth:at(board,'group').height-at(baseline,'group').height,
    retainedOutsideDisplacement:at(board,'outside').y-at(baseline,'outside').y
  }));
  for(let cycle=0;cycle<5;cycle++) {
    change(board,draft=>foldCards(draft,new Set(['reading']),false));
    noVisibleOverlaps(board);
    change(board,draft=>foldCards(draft,new Set(['reading']),true));
    assert.deepEqual(board,collapsed);
  }
  remainingFolds(board,baseline);
  membershipAndStyle(board,baseline);
  reload(board);
});
