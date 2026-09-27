import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,History,movableSelection,parseBoard,tidyBoard,type Board,type Card} from '../src/model';
import {alignSelection,moveSelection} from '../src/board-tools';
import {branchState} from '../src/mindmap';

const node=(id:string,x:number,patch:Partial<Card>={}):Card=>({id,kind:'text',text:id,title:id,x,y:100,width:100,height:80,color:'green',...patch});
function fixture():Board{return {...emptyBoard(),version:3,nodes:[node('group',0,{kind:'section',y:0,width:500,height:400}),node('root',50,{branchFolded:true}),node('child',700,{locked:true}),node('loose',250),node('other',1500)],edges:[{id:'edge',from:'root',to:'child',kind:'branch',label:''}]};}
const positions=(b:Board,ids:string[])=>ids.map(id=>{const n=b.nodes.find(n=>n.id===id)!;return [n.id,n.x,n.y];});

test('open group drag and nudge retain a pinned folded subtree while moving ordinary unlocked members',()=>{
 const b=fixture(),before=clone(b),history=new History();history.push(b);
 assert.deepEqual([...movableSelection(b,new Set(['group']))],['group','loose']);
 moveSelection(b,new Set(['group']),35,-20);
 assert.deepEqual(positions(b,['root','child','other']),positions(before,['root','child','other']));
 assert.deepEqual(positions(b,['group','loose']),[['group',35,-20],['loose',285,80]]);
 assert.deepEqual(parseBoard(JSON.stringify(b)),b);assert.deepEqual(history.undo(b),before);
});
test('open group alignment retains a pinned folded subtree instead of filtering only its locked child',()=>{
 const b=fixture(),before=clone(b);alignSelection(b,new Set(['group','other']),'right');
 assert.deepEqual(positions(b,['root','child']),positions(before,['root','child']));
 assert.equal(b.nodes[0].x,1100);assert.equal(b.nodes[3].x,1350);
});
for(const operation of ['move','align'] as const)test(`open group ${operation} cannot detach a hidden child from a folded root outside the frame`,()=>{
 const b=fixture();b.nodes[1].x=-300;b.nodes[2].x=50;delete b.nodes[2].locked;const before=clone(b);
 assert.equal(branchState(b).hidden.has('child'),true);
 if(operation==='move')moveSelection(b,new Set(['group']),35,-20);else alignSelection(b,new Set(['group','other']),'right');
 assert.deepEqual(positions(b,['root','child']),positions(before,['root','child']));
 assert.notDeepEqual(positions(b,['group','loose']),positions(before,['group','loose']));
});
test('open group movement still carries an unlocked folded subtree outside the frame exactly once',()=>{
 const b=fixture();delete b.nodes[2].locked;const before=clone(b);
 moveSelection(b,new Set(['group','root']),35,-20);
 for(const id of ['group','root','child','loose']){const current=b.nodes.find(n=>n.id===id)!,old=before.nodes.find(n=>n.id===id)!;assert.deepEqual([current.x,current.y],[old.x+35,old.y-20]);}
 assert.deepEqual(b.nodes[4],before.nodes[4]);assert.deepEqual(b.edges,before.edges);
});
test('board tidying cannot detach an overlapping hidden member from an external folded root',()=>{
 const b=fixture();b.nodes[1].x=-300;b.nodes[2].x=50;delete b.nodes[2].locked;b.nodes[4].x=-600;b.nodes[4].y=-100;const before=clone(b);
 tidyBoard(b,new Set(['group','other']));
 assert.deepEqual(positions(b,['root','child']),positions(before,['root','child']));assert.notDeepEqual(positions(b,['group']),positions(before,['group']));
});
function sharedFold():Board{const b=fixture();delete b.nodes[2].locked;b.nodes[2].x=750;b.nodes.push(node('external',700,{kind:'section',y:0,width:500,height:400,sectionFolded:true}));return b;}
for(const operation of ['move','align','tidy'] as const)test(`open group ${operation} retains a folded branch sharing hidden material with a stationary folded frame`,()=>{
 const b=sharedFold();if(operation==='tidy'){b.nodes[4].x=-600;b.nodes[4].y=-100;}const before=clone(b),history=new History();history.push(b);
 assert.deepEqual(parseBoard(JSON.stringify(b)),b);
 if(operation==='move')moveSelection(b,new Set(['group']),1000,0);
 else if(operation==='align')alignSelection(b,new Set(['group','other']),'right');
 else tidyBoard(b,new Set(['group','other']));
 assert.deepEqual(positions(b,['root','child','external']),positions(before,['root','child','external']));
 assert.notDeepEqual(positions(b,['group','loose']),positions(before,['group','loose']));
 assert.deepEqual(parseBoard(JSON.stringify(b)),b);assert.deepEqual(history.undo(b),before);
});
test('shared folded units move together exactly once when both owners are selected',()=>{
 const b=sharedFold(),before=clone(b);moveSelection(b,new Set(['group','external']),35,-20);
 for(const id of ['group','root','child','loose','external']){const current=b.nodes.find(n=>n.id===id)!,old=before.nodes.find(n=>n.id===id)!;assert.deepEqual([current.x,current.y],[old.x+35,old.y-20]);}
 assert.deepEqual(b.nodes[4],before.nodes[4]);assert.deepEqual(b.edges,before.edges);
});
test('a directly selected fold also retains material belonging to a stationary overlapping fold',()=>{
 const b=sharedFold(),before=clone(b);moveSelection(b,new Set(['root']),1000,0);assert.deepEqual(b,before);
});
test('a stationary fold pins connected overlapping selected units regardless of board order',()=>{
 for(const reverse of [false,true]){const b=sharedFold();b.nodes.push(node('bridge',1100),node('stationary',1050,{kind:'section',y:0,width:500,height:400,sectionFolded:true}));if(reverse)b.nodes.reverse();const before=clone(b);
  assert.deepEqual(parseBoard(JSON.stringify(b)),b);moveSelection(b,new Set(['group','external']),1000,0);
  assert.deepEqual(positions(b,['root','child','external','bridge','stationary']),positions(before,['root','child','external','bridge','stationary']));
  assert.notDeepEqual(positions(b,['group','loose']),positions(before,['group','loose']));
 }
});
for(const selected of [['root','other'],['group','external']])test(`alignment cannot independently shift shared folded owners selected as ${selected.join(', ')}`,()=>{
 const b=sharedFold(),before=clone(b);assert.throws(()=>alignSelection(b,new Set(selected),'left'),/至少选择两个|重叠/);assert.deepEqual(b,before);
});
for(const selected of [['root','other'],['group','external']])test(`tidying cannot independently shift shared folded owners selected as ${selected.join(', ')}`,()=>{
 const b=sharedFold(),before=clone(b);tidyBoard(b,new Set(selected));assert.deepEqual(b,before);
});
for(const operation of ['align','tidy'] as const)test(`shared-fold checks reuse batch memberships during ${operation}`,()=>{
 const b:Board={...emptyBoard(),version:3},selected=new Set<string>();let reads=0;
 for(let i=0;i<64;i++){const root=`root-${i}`,child=`child-${i}`;selected.add(root);b.nodes.push(node(root,i*400,{branchFolded:true}),node(child,i*400+150));b.edges.push(new Proxy({id:`edge-${i}`,from:root,to:child,kind:'branch' as const,label:''},{get(target,key,receiver){if(key==='kind')reads++;return Reflect.get(target,key,receiver);}}));}
 if(operation==='align')alignSelection(b,selected,'right');else tidyBoard(b,selected);
 assert.ok(reads<=b.edges.length*2,`${reads} branch reads repeated the per-operation traversal`);
 for(let i=0;i<64;i++)assert.equal(b.nodes[i*2+1].x-b.nodes[i*2].x,150);
 b.nodes.push(node('loose-a',30000),node('loose-b',31000));reads=0;
 if(operation==='align')alignSelection(b,new Set(['loose-a','loose-b']),'left');else tidyBoard(b,new Set(['loose-a','loose-b']));
 assert.equal(reads,b.edges.length,'ordinary targets must not expand unrelated folds');
});
