import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,movableSelection,selectionMemberships,type Card} from '../src/model';
import {dragCommitChanges} from '../src/drag-draft';

const node=(id:string,x=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y:0,width:120,height:80,color:'sand',...extra});
function fixture(count=1200){const b=emptyBoard();b.version=3;const nodes=Array.from({length:count},(_,i)=>node('n'+i,i*150));let reads=0;b.nodes=new Proxy(nodes,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});return{b,nodes,reads:()=>reads};}

test('ordinary layout units do not inspect unrelated board nodes for membership',()=>{
 const f=fixture();for(let i=0;i<120;i++){const result=selectionMemberships(f.b,[f.nodes[1],f.nodes[1199]]);assert.deepEqual([...result],[['n1',[]],['n1199',[]]]);}
 assert.equal(f.reads(),0);
});
test('ordinary movement skips the unused expansion index and final rescan',t=>{
 const f=fixture(),selected=new Set(['n1199','n0','missing']);for(let i=0;i<120;i++)assert.deepEqual([...movableSelection(f.b,selected)],['n0','n1199']);
 t.diagnostic(`120 ordinary move selections: ${f.reads()} node reads`);assert.equal(f.reads(),288000);
});
test('empty movement and empty commit do not scan the board',()=>{
 const f=fixture();assert.equal(movableSelection(f.b,new Set()).size,0);assert.equal(dragCommitChanges(f.b,new Map(),new Map()).size,0);assert.equal(f.reads(),0);
});
test('movement observes live folds, locks and nested group membership',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[node('group',0,{kind:'section',width:800,height:400}),node('nested',20,{kind:'section',y:20,width:500,height:200}),node('a',40,{y:40}),node('b',900),node('locked',180,{y:40,locked:true})];b.edges=[{id:'e',kind:'branch',from:'group',to:'b',label:''}];
 assert.deepEqual([...movableSelection(b,new Set(['b','a']))],['a','b']);
 b.nodes[0].branchFolded=true;b.nodes[0].sectionFolded=true;assert.equal(movableSelection(b,new Set(['group','a','b'])).size,0);
 b.nodes[4].locked=false;assert.deepEqual([...movableSelection(b,new Set(['group']))],['group','nested','a','b','locked']);
 delete b.nodes[0].branchFolded;delete b.nodes[0].sectionFolded;b.nodes[1].sectionFolded=true;assert.equal(movableSelection(b,new Set(['a'])).size,0);
 b.nodes[1].sectionFolded=false;assert.deepEqual([...movableSelection(b,new Set(['a']))],['a']);
 const membership=selectionMemberships(b,[b.nodes[0]]);assert.deepEqual(membership.get('group')!.map(n=>n.id),['locked','a']);
 b.nodes[2].x=1200;assert.deepEqual(selectionMemberships(b,[b.nodes[0]]).get('group')!.map(n=>n.id),['locked']);
});
test('batch drag commits compare geometry without per-object entry arrays',t=>{
 const f=fixture(),originals=new Map(f.nodes.map(n=>[n.id,{...n}])),drafts=new Map(f.nodes.map(n=>[n.id,{...n,x:n.x+35,y:20}]));let entries=0;const original=Object.entries;
 const mock=t.mock.method(Object,'entries',function(value:object){entries++;return original(value);});
 const changes=dragCommitChanges(f.b,originals,drafts);mock.mock.restore();
 assert.equal(changes.size,1200);assert.deepEqual(changes.get('n1199'),{x:f.nodes[1199].x+35,y:20});assert.equal(entries,0);assert.equal(f.nodes[0].x,0);
});
test('drag conflict validation stays atomic and preserves concurrent content',()=>{
 for(const change of [(n:Card)=>n.x++,(n:Card)=>n.height++,(n:Card)=>n.locked=true,(n:Card)=>n.kind='image',(n:Card)=>n.autoFit=true]){
  const f=fixture(2),originals=new Map(f.nodes.map(n=>[n.id,{...n}])),drafts=new Map(f.nodes.map(n=>[n.id,{...n,width:240,height:160,autoFit:false}]));change(f.nodes[1]);const before=clone(f.b);assert.throws(()=>dragCommitChanges(f.b,originals,drafts,true),/已改变/);assert.deepEqual(f.b,before);
 }
 const f=fixture(2),originals=new Map(f.nodes.map(n=>[n.id,{...n}])),drafts=new Map(f.nodes.map(n=>[n.id,{...n,x:n.x+30}]));f.nodes[0].text='Live edit';const patch=dragCommitChanges(f.b,originals,drafts);assert.equal(patch.get('n0')!.text,undefined);f.nodes.pop();assert.throws(()=>dragCommitChanges(f.b,originals,drafts),/已被移除/);
});
test('unchanged resize avoids a commit but retains optional flag transitions',()=>{
 const f=fixture(1),n=f.nodes[0],originals=new Map([[n.id,{...n}]]),draft={...n};assert.equal(dragCommitChanges(f.b,originals,new Map([[n.id,draft]]),true).size,0);
 draft.autoFit=false;assert.deepEqual(dragCommitChanges(f.b,originals,new Map([[n.id,draft]]),true).get(n.id),{width:120,height:80,autoSize:undefined,autoFit:false});
});
