import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Card,clone,emptyBoard,expandedSelection,History,parseBoard} from '../src/model';
import {foldSections,sectionContains,sectionDisplayNode,sectionFoldState} from '../src/sections';
import {branchState,unfoldAncestors,visibleBranchBoard} from '../src/mindmap';
import {alignSelection,foldCards,marqueeSelection,moveSelection} from '../src/board-tools';
import {visibleNodes} from '../src/rendering';
import {connectionPath} from '../src/connections';
import {alignmentIndex} from '../src/alignment-guides';

const text=(id:string,x:number,y:number):Card=>({id,kind:'text',text:id,x,y,width:100,height:60,color:'blue'});
const frame=(id:string,x:number,y:number,width=600,height=500):Card=>({id,kind:'section',title:id,x,y,width,height,color:'blue'});
const fixture=()=>{const b=emptyBoard();b.version=3;b.nodes=[frame('outer',0,0),frame('inner',50,100,350,280),text('inside',80,170),text('other',430,320),text('outside',800,150)];b.edges=[{id:'internal',from:'inside',to:'other',label:'内部'},{id:'crossing',from:'inside',to:'outside',label:'跨组'},{id:'frame-edge',from:'outer',to:'outside',label:'分组'}];return b;};

test('section folds round-trip while retaining exact logical geometry, contents and edges',()=>{
 const b=fixture(),before=clone(b);foldSections(b,new Set(['outer']),true);
 assert.equal(b.nodes[0].sectionFolded,true);assert.equal(b.nodes[0].height,500);
 assert.deepEqual(b.nodes.slice(1),before.nodes.slice(1));assert.deepEqual(b.edges,before.edges);
 assert.deepEqual(parseBoard(JSON.stringify(b)),b);
 foldSections(b,new Set(['outer']),true);foldSections(b,new Set(['outer']),false);
 assert.deepEqual(b,before);
});

test('only sections in version 3 accept a boolean fold flag',()=>{
 const legacy=emptyBoard();legacy.nodes=[frame('s',0,0)];foldSections(legacy,new Set(['s']),true);
 assert.equal(legacy.version,3);assert.equal(parseBoard(JSON.stringify(legacy)).nodes[0].sectionFolded,true);
 for(const [kind,value,version]of [['section','yes',3],['section',true,2],['text',true,3]] as const){
  const b=fixture();Object.assign(b.nodes[0],{kind,sectionFolded:value});Object.assign(b,{version});
  assert.throws(()=>parseBoard(JSON.stringify(b)));
 }
});

test('locked frames and unselected frames ignore fold commands',()=>{
 const b=fixture();b.nodes[0].locked=true;const before=clone(b);
 foldSections(b,new Set(['outer','inside']),true);assert.deepEqual(b,before);
 foldSections(b,new Set(['inner']),true);assert.equal(b.nodes[1].sectionFolded,true);
 assert.equal(b.nodes[0].sectionFolded,undefined);
});

test('nested folds hide all contained objects and retain inner fold on outer expansion',()=>{
 const b=fixture();foldSections(b,new Set(['inner','outer']),true);
 assert.deepEqual([...sectionFoldState(b).hidden].sort(),['inner','inside','other']);
 let view=visibleBranchBoard(b);assert.deepEqual(view.nodes.map(n=>n.id),['outer','outside']);
 assert.deepEqual(view.edges.map(e=>e.id),['frame-edge']);assert.equal(view.nodes[0].height,72);
 assert.equal(b.nodes[0].height,500);assert.notEqual(view.nodes[0],b.nodes[0]);
 foldSections(b,new Set(['outer']),false);view=visibleBranchBoard(b);
 assert.deepEqual(view.nodes.map(n=>n.id),['outer','inner','other','outside']);
 assert.equal(view.nodes.find(n=>n.id==='inner')!.height,72);
 foldSections(b,new Set(['inner']),false);assert.equal(visibleBranchBoard(b),b);
});

test('overlap uses full containment, and coincident frames cannot hide each other',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[frame('a',0,0,400,400),frame('same',0,0,400,400),frame('overlap',300,0,400,400),text('contained',320,100),text('partial',650,100)];
 foldSections(b,new Set(['a','same','overlap']),true);
 assert.equal(sectionContains(b.nodes[0],b.nodes[1]),false);
 assert.equal(sectionContains(b.nodes[1],b.nodes[0]),false);
 assert.equal(sectionContains(b.nodes[0],b.nodes[2]),false);
 assert.deepEqual([...sectionFoldState(b).hidden],['contained']);
 assert.deepEqual(visibleBranchBoard(b).nodes.map(n=>n.id),['a','same','overlap','partial']);
});

test('section and branch visibility compose without hiding geometrically outside descendants',()=>{
 const b=fixture();b.nodes.push(text('branch-hidden',900,260));b.nodes[4].branchFolded=true;
 b.edges.push({id:'branch',from:'outside',to:'branch-hidden',label:'',kind:'branch'}, {id:'outward',from:'inside',to:'outside',label:'',kind:'branch'});
 foldSections(b,new Set(['outer']),true);
 assert.deepEqual([...branchState(b).hidden].sort(),['branch-hidden','inner','inside','other']);
 assert.deepEqual(visibleBranchBoard(b).nodes.map(n=>n.id),['outer','outside']);
 unfoldAncestors(b,'branch-hidden');assert.equal(b.nodes[4].branchFolded,undefined);
 assert.equal(b.nodes[0].sectionFolded,true);
 unfoldAncestors(b,'inside');assert.equal(b.nodes[0].sectionFolded,undefined);
});

test('revealing nested contents opens enclosing frames without opening sibling frames',()=>{
 const b=fixture();b.nodes.push(frame('sibling',700,50,400,350));
 foldSections(b,new Set(['outer','inner','sibling']),true);unfoldAncestors(b,'inside');
 assert.equal(b.nodes[0].sectionFolded,undefined);assert.equal(b.nodes[1].sectionFolded,undefined);
 assert.equal(b.nodes.at(-1)!.sectionFolded,true);assert.equal(branchState(b).hidden.has('inside'),false);
});

test('folded group movement carries nested boundaries and hidden contents exactly once',()=>{
 const b=fixture();foldSections(b,new Set(['outer','inner']),true);const before=clone(b);
 assert.deepEqual([...expandedSelection(b,new Set(['outer']))].sort(),['inner','inside','other','outer']);
 moveSelection(b,new Set(['outer','inner']),35,-20);
 for(let i=0;i<4;i++){assert.equal(b.nodes[i].x,before.nodes[i].x+35);assert.equal(b.nodes[i].y,before.nodes[i].y-20);assert.equal(b.nodes[i].width,before.nodes[i].width);assert.equal(b.nodes[i].height,before.nodes[i].height);}
 assert.deepEqual(b.nodes[4],before.nodes[4]);assert.deepEqual(b.edges,before.edges);
 foldSections(b,new Set(['outer','inner']),false);assert.equal(b.nodes[0].height,500);assert.equal(b.nodes[1].height,280);
});

test('locked hidden content pins a folded frame without changing open-frame behavior',()=>{
 const b=fixture();b.nodes[2].locked=true;foldSections(b,new Set(['outer']),true);const before=clone(b);
 moveSelection(b,new Set(['outer']),50,50);assert.deepEqual(b,before);
 foldSections(b,new Set(['outer']),false);moveSelection(b,new Set(['outer']),50,50);
 assert.equal(b.nodes[0].x,50);assert.equal(b.nodes[2].x,before.nodes[2].x);
});

test('alignment cannot detach a folded frame from its locked hidden member',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[{...frame('group',0,0),sectionFolded:true},{...text('locked',100,100),locked:true},text('outside',900,100)];
 const before=clone(b);assert.throws(()=>alignSelection(b,new Set(['group','outside']),'right'),/至少选择两个/);
 assert.deepEqual(b,before);assert.ok(branchState(b).hidden.has('locked'));
 b.nodes.push(text('second',1100,300));alignSelection(b,new Set(['group','outside','second']),'right');
 assert.deepEqual(b.nodes[0],before.nodes[0]);assert.deepEqual(b.nodes[1],before.nodes[1]);
 assert.equal(b.nodes[2].x,1100);assert.equal(b.nodes[3].x,1100);assert.ok(branchState(b).hidden.has('locked'));
});

test('folded group culling uses the heading and undo restores visibility and geometry',()=>{
 const b=fixture(),before=clone(b),history=new History();history.push(b);foldSections(b,new Set(['outer']),true);
 const view=visibleBranchBoard(b);assert.equal(visibleNodes(view.nodes,{x:0,y:250,width:400,height:100}).length,0);
 assert.ok(visibleNodes(view.nodes,{x:0,y:0,width:400,height:100}).some(n=>n.id==='outer'));
 assert.equal(sectionDisplayNode(b.nodes[4]),b.nodes[4]);
 const restored=history.undo(b)!;assert.deepEqual(restored,before);assert.equal(visibleBranchBoard(restored),restored);
 const foldedAgain=history.redo(restored)!;assert.equal(foldedAgain.nodes[0].sectionFolded,true);assert.equal(foldedAgain.nodes[0].height,500);
});

test('compact group projection shares 320px bounds across marquee, culling, alignment and edges',()=>{
 const b=fixture();b.nodes[0].width=805;const before=clone(b);foldSections(b,new Set(['outer']),true);
 const view=visibleBranchBoard(b),group=view.nodes.find(n=>n.id==='outer')!,outside=view.nodes.find(n=>n.id==='outside')!;
 assert.deepEqual([group.x,group.y,group.width,group.height],[0,0,320,72]);
 assert.deepEqual([b.nodes[0].width,b.nodes[0].height],[805,500]);
 assert.deepEqual([...marqueeSelection(view.nodes,{x:-1,y:-1,width:322,height:74})],['outer']);
 assert.equal(visibleNodes(view.nodes,{x:350,y:0,width:400,height:70}).length,0);
 assert.equal(alignmentIndex(view.nodes,new Set(['outer']))!.bounds.width,320);
 assert.deepEqual(connectionPath(group,outside,{fromSide:'right',toSide:'left'}).from,{x:320,y:36});
 assert.equal(sectionDisplayNode({...frame('narrow',0,0,140,160),sectionFolded:true}).width,140);
 foldSections(b,new Set(['outer']),false);assert.deepEqual(b,before);
});

test('compact group projection preserves existing card, nested group and branch folds',()=>{
 const b=fixture();b.nodes[2]={...b.nodes[2],kind:'card',file:'inside.md',height:200};b.nodes.push(text('branch-child',1000,260));
 b.edges.push({id:'branch',from:'outside',to:'branch-child',label:'',kind:'branch'});
 foldCards(b,new Set(['inside']),true);foldSections(b,new Set(['inner']),true);b.nodes[4].branchFolded=true;
 const before=clone(b);foldSections(b,new Set(['outer']),true);
 assert.deepEqual(visibleBranchBoard(b).nodes.map(n=>[n.id,n.width,n.height]),[['outer',320,72],['outside',100,60]]);
 assert.deepEqual(b.nodes.slice(1),before.nodes.slice(1));
 foldSections(b,new Set(['outer']),false);assert.deepEqual(b,before);
 const view=visibleBranchBoard(b);assert.equal(view.nodes.find(n=>n.id==='inner')!.width,320);assert.ok(!view.nodes.some(n=>n.id==='inside'||n.id==='branch-child'));
});

test('1200 members and deeply nested groups require no recursive traversal or geometry rewrite',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[frame('outer',0,0,20000,20000),...Array.from({length:1200},(_,i)=>text('n'+i,100+i%30*150,100+Math.floor(i/30)*100)),...Array.from({length:200},(_,i)=>({...frame('s'+i,10+i,10+i,19000-2*i,19000-2*i),sectionFolded:true}))];
 const geometry=b.nodes.map(n=>[n.x,n.y,n.width,n.height]);foldSections(b,new Set(['outer']),true);
 assert.equal(branchState(b).hidden.size,1400);assert.equal(visibleBranchBoard(b).nodes.length,1);
 assert.deepEqual(b.nodes.map(n=>[n.x,n.y,n.width,n.height]),geometry);
 assert.equal(parseBoard(JSON.stringify(b)).nodes.length,1401);
});

test('many disjoint folds query either coordinate axis without losing boundary members',()=>{
 for(const vertical of [false,true]){
  const b=emptyBoard();b.version=3;
  for(let i=0;i<80;i++){
   const x=vertical?-300:-500+i*220,y=vertical?-500+i*220:-300;
   b.nodes.push({...frame('s'+i,x,y,140,150),sectionFolded:true},text('n'+i,x+40,y+90),text('outside'+i,x+90,y+130));
  }
  const before=clone(b),state=sectionFoldState(b);
  assert.equal(state.hidden.size,80);for(let i=0;i<80;i++)assert.ok(state.hidden.has('n'+i));
  assert.equal(visibleBranchBoard(b).nodes.length,160);assert.deepEqual(b,before);
 }
});
