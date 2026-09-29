import test from 'node:test';
import assert from 'node:assert/strict';
import {reflowExpandedContent} from '../src/expansion-layout';
import {branchState} from '../src/mindmap';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {sectionContains} from '../src/sections';

const node=(id:string,x:number,y:number,width=200,height=80,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width,height,color:'blue',...extra});
const frame=(id:string,x:number,y:number,width:number,height:number,extra:Partial<Card>={})=>node(id,x,y,width,height,{kind:'section',title:id,...extra});
const board=(...nodes:Card[]):Board=>({...emptyBoard(),version:3,nodes});
const at=(value:Board,id:string)=>value.nodes.find(n=>n.id===id)!;

test('replay can activate a remaining open source whose dimensions no longer change',()=>{
 const baseline=board(frame('group',0,0,400,320),node('reading',30,60,300,72,{collapsed:true,expandedHeight:400}),node('tail',30,180,300));
 const candidate=clone(baseline);Object.assign(at(candidate,'reading'),{height:400,collapsed:undefined,expandedHeight:undefined});
 const before=clone(candidate);at(before,'tail').y=484;at(before,'group').height=594;
 reflowExpandedContent(candidate,before,{forcedSources:new Set(['reading']),ownershipReference:baseline});
 assert.equal(at(candidate,'reading').height,400);
 assert.equal(at(candidate,'tail').y,484);
 assert.equal(at(candidate,'group').height,594);
 assert(sectionContains(at(candidate,'group'),at(candidate,'reading')));
});

test('forced sources bypass the ordinary no-growth gate without requiring an ownership reference',()=>{
 const candidate=board(node('reading',0,0,200,300),node('tail',0,150)),before=clone(candidate);
 reflowExpandedContent(candidate,before,{forcedSources:new Set(['reading'])});
 assert.equal(at(candidate,'tail').y,324);
});

test('closing a group fits its hidden expanded content without exposing it as a collision source',()=>{
 const baseline=board(frame('group',0,0,400,300),node('reading',30,60,300,72,{collapsed:true,expandedHeight:500}),node('tail',30,170,300),node('outside',300,400));
 const candidate=clone(baseline);at(candidate,'group').sectionFolded=true;Object.assign(at(candidate,'reading'),{height:500,collapsed:undefined,expandedHeight:undefined});
 reflowExpandedContent(candidate,baseline,{forcedSources:new Set(['reading']),ownershipReference:baseline});
 assert.equal(at(candidate,'group').height,590);
 assert.equal(at(candidate,'tail').y,170);
 assert.deepEqual(at(candidate,'outside'),at(baseline,'outside'));
 assert.deepEqual([...branchState(candidate).hidden].sort(),['reading','tail']);
});

test('hidden nested frames fit retained expanded dimensions from the inside out',()=>{
 const baseline=board(frame('outer',0,0,650,400,{sectionFolded:true}),frame('inner',30,60,500,280),node('reading',60,120,300,72,{collapsed:true,expandedHeight:600}),node('tail',60,230,300));
 const candidate=clone(baseline);Object.assign(at(candidate,'reading'),{height:600,collapsed:undefined,expandedHeight:undefined});
 reflowExpandedContent(candidate,baseline,{forcedSources:new Set(),ownershipReference:baseline});
 assert.equal(at(candidate,'inner').height,690);
 assert.equal(at(candidate,'outer').height,780);
 assert.equal(at(candidate,'tail').y,230);
 assert.deepEqual([...branchState(candidate).hidden].sort(),['inner','reading','tail']);
});

test('replay with no active source still rejects an external object captured by restored geometry',()=>{
 const baseline=board(frame('group',0,0,400,300),node('member',30,60),node('outside',600,160));
 const candidate=clone(baseline);at(candidate,'outside').x=50;
 assert.throws(()=>reflowExpandedContent(candidate,clone(candidate),{forcedSources:new Set(),ownershipReference:baseline}),/改变分组归属/);
});

test('replay does not repair pre-existing overlaps without an active source',()=>{
 const baseline=board(frame('group',0,0,400,300),node('one',30,60),node('two',30,110)),candidate=clone(baseline);
 reflowExpandedContent(candidate,baseline,{forcedSources:new Set(),ownershipReference:baseline});
 assert.deepEqual(candidate,baseline);
});

test('a locked folded frame cannot be enlarged to fit replayed hidden content',()=>{
 const baseline=board(frame('group',0,0,400,300,{locked:true,sectionFolded:true}),node('reading',30,60,300,72,{collapsed:true,expandedHeight:500}));
 const candidate=clone(baseline);Object.assign(at(candidate,'reading'),{height:500,collapsed:undefined,expandedHeight:undefined});
 assert.throws(()=>reflowExpandedContent(candidate,baseline,{ownershipReference:baseline}),/锁定分组/);
});

test('replayed logical frame growth must not acquire an unrelated external card',()=>{
 const baseline=board(frame('group',0,0,400,300,{sectionFolded:true}),node('reading',30,60,300,72,{collapsed:true,expandedHeight:500}),node('outside',30,400));
 const candidate=clone(baseline);Object.assign(at(candidate,'reading'),{height:500,collapsed:undefined,expandedHeight:undefined});
 assert.throws(()=>reflowExpandedContent(candidate,baseline,{ownershipReference:baseline}),/改变分组归属/);
});
