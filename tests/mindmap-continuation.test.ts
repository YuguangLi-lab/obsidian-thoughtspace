import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterMindmap} from '../src/mindmap-studio';
import {editTopic,TopicDraft} from '../src/mindmap-editor';
import {clone} from '../src/model';
import {layoutMindmap,reflowAutomaticMindmaps} from '../src/mindmap';

const fixture=()=>{let i=0;const b=starterMindmap('root',()=>String(++i));b.nodes[0].mindmapRules={automatic:true,layout:'right',density:'standard'};layoutMindmap(b,b.nodes[0].id);return b;};
test('new topics are measured before layout, without moving source geometry',()=>{
 const b=fixture(),before=clone(b),calls:string[]=[];
 const r=editTopic(b,b.nodes[1].id,'child',['tall','short'],undefined,{prepareNode:n=>{calls.push(n.text!);n.width=260;n.height=n.text==='tall'?320:60;}});
 assert.deepEqual(calls,['tall','short']);assert.deepEqual(b,before);
 const expected=clone(r.board);layoutMindmap(expected,r.root);assert.deepEqual(r.board,expected);
 const added=r.board.nodes.slice(-2);assert.equal(added[0].height,320);assert(added[1].y>=added[0].y+added[0].height);
});
test('automatic creation can defer layout to its owning transaction exactly once',()=>{
 const b=fixture();let i=0,j=0;const prepareNode=(n:any)=>{n.width=240;n.height=240;};
 const immediate=editTopic(b,b.nodes[1].id,'child',['new'],()=>`new${++i}`,{prepareNode});
 const deferred=editTopic(b,b.nodes[1].id,'child',['new'],()=>`new${++j}`,{prepareNode,deferAutomaticLayout:true});
 assert.deepEqual(deferred.board.nodes.slice(0,b.nodes.length).map(({id,x,y,width,height})=>({id,x,y,width,height})),b.nodes.map(({id,x,y,width,height})=>({id,x,y,width,height})));
 reflowAutomaticMindmaps(deferred.board,b);assert.deepEqual(deferred.board,immediate.board);
});
test('manual trees still lay out prepared topics when automatic deferral is requested',()=>{
 const b=fixture();b.nodes[0].mindmapRules!.automatic=false;
 const r=editTopic(b,b.nodes[1].id,'child',['new'],undefined,{prepareNode:n=>{n.height=400;},deferAutomaticLayout:true});
 const expected=clone(r.board);layoutMindmap(expected,r.root);assert.deepEqual(r.board,expected);assert.equal(r.board.nodes.at(-1)!.height,400);
});
test('measurement failures and invalid dimensions never alter source data',()=>{
 const b=fixture(),before=clone(b);
 assert.throws(()=>editTopic(b,b.nodes[1].id,'child',['new'],undefined,{prepareNode:()=>{throw Error('measurement failed');}}),/measurement failed/);
 assert.throws(()=>editTopic(b,b.nodes[1].id,'child',['new'],undefined,{prepareNode:n=>{n.width=NaN;},deferAutomaticLayout:true}));assert.deepEqual(b,before);
});
test('locked automatic trees reject deferred creation before measurement or mutation',()=>{
 const b=fixture();b.nodes[2].locked=true;const before=clone(b);let measured=false;
 assert.throws(()=>editTopic(b,b.nodes[1].id,'child',['new'],undefined,{prepareNode:()=>{measured=true;},deferAutomaticLayout:true}),/锁定/);
 assert.equal(measured,false);assert.deepEqual(b,before);
});
test('deferred creation preserves automatic left, bilateral and downward template geometry',()=>{
 for(const direction of ['left','bilateral','down'] as const){
  const b=fixture();b.nodes[0].mindmapRules!.layout=direction;layoutMindmap(b,b.nodes[0].id);b.nodes[1].branchFolded=true;
  let i=0,j=0;const prepareNode=(n:any)=>{n.width=270;n.height=310;};
  const immediate=editTopic(b,b.nodes[1].id,'child',['new'],()=>`new${++i}`,{prepareNode});
  const deferred=editTopic(b,b.nodes[1].id,'child',['new'],()=>`new${++j}`,{prepareNode,deferAutomaticLayout:true});
  reflowAutomaticMindmaps(deferred.board,b);assert.deepEqual(deferred.board,immediate.board);
 }
});
test('confirming unchanged topic text preserves redo and creates no undo entry',()=>{
 const b=fixture(),draft=new TopicDraft(b,b.nodes[1].id),text=draft.board.nodes[1].text!;
 draft.rename(text);assert.equal(draft.canUndo,false);
 draft.rename('changed');draft.undo();assert.equal(draft.canRedo,true);
 let measured=false;draft.rename(text,()=>{measured=true;});assert.equal(measured,false);assert.equal(draft.canUndo,false);assert.equal(draft.canRedo,true);
 draft.redo();assert.equal(draft.board.nodes[1].text,'changed');
});
test('draft history still respects its byte budget after cached snapshot sizing',()=>{
 const b=fixture();b.nodes[0].text='内容'.repeat(250000);const draft=new TopicDraft(b,b.nodes[1].id);
 for(let i=0;i<24;i++)draft.rename(`edit ${i}`);
 let count=0;while(draft.canUndo){draft.undo();count++;}
 assert(count>0&&count<20,'large snapshots must evict history before the entry limit');
 while(draft.canRedo)draft.redo();assert.equal(draft.board.nodes[1].text,'edit 23');
});
