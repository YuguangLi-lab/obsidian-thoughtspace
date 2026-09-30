import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Card} from '../src/model';
import {visibleBranchBoard} from '../src/mindmap';
import {dragCommitChanges,dragDisplayBoard} from '../src/drag-draft';
import {resizedSection,sectionAtPoint,type SectionResizeEdge} from '../src/section-resize';

const frame=(id='frame',patch:Partial<Card>={}):Card=>({id,kind:'section',title:id,x:50,y:80,width:400,height:300,color:'blue',...patch});
const rect=({x,y,width,height}:Card)=>({x,y,width,height});
const edges:SectionResizeEdge[]=['top','right','bottom','left'];

for(const edge of edges)test(`${edge} clamps at its minimum while keeping the opposite edge and the other axis`,()=>{
 const original=frame(),before=structuredClone(original);
 const next=resizedSection(original,edge==='left'?10000:-10000,edge==='top'?10000:-10000,edge);
 if(edge==='left'||edge==='right'){
  assert.equal(next.width,180);assert.equal(next.height,300);assert.equal(next.y,80);
  assert.equal(edge==='left'?next.x+next.width:next.x,edge==='left'?450:50);
 }else{
  assert.equal(next.height,100);assert.equal(next.width,400);assert.equal(next.x,50);
  assert.equal(edge==='top'?next.y+next.height:next.y,edge==='top'?380:80);
 }
 assert.deepEqual(original,before,'resizing must not mutate the original gesture snapshot');
});

for(const edge of edges)test(`${edge} keeps an old 80 by 60 frame unchanged on a click or further inward drag`,()=>{
 const original=frame('small',{width:80,height:60});
 assert.deepEqual(resizedSection(original,0,0,edge),rect(original));
 assert.deepEqual(resizedSection(original,edge==='left'?1000:-1000,edge==='top'?1000:-1000,edge),rect(original));
});

test('left/top expansion retains fractional opposite edges and supports negative board coordinates',()=>{
 const original=frame('negative',{x:-125.5,y:-87.25,width:240.75,height:155.5});
 const left=resizedSection(original,-300.25,999,'left');
 assert.deepEqual(left,{x:-425.75,y:-87.25,width:541,height:155.5});
 assert.equal(left.x+left.width,original.x+original.width);
 const top=resizedSection(original,999,-225.75,'top');
 assert.deepEqual(top,{x:-125.5,y:-313,width:240.75,height:381.25});
 assert.equal(top.y+top.height,original.y+original.height);
});

for(const invalid of [NaN,Infinity,-Infinity])test(`non-finite movement ${invalid} leaves every edge unchanged`,()=>{
 const original=frame();
 for(const edge of edges){
  assert.deepEqual(resizedSection(original,invalid,1,edge),rect(original));
  assert.deepEqual(resizedSection(original,1,invalid,edge),rect(original));
 }
});

test('finite movement that overflows the result is ignored without corrupting the snapshot',()=>{
 const original=frame('huge',{width:1e308,height:1e308});
 assert.deepEqual(resizedSection(original,1e308,0,'right'),rect(original));
 assert.deepEqual(resizedSection(original,0,1e308,'bottom'),rect(original));
});

test('left edge drafts update only the frame position and dimensions, leaving nested frames and notes unchanged',()=>{
 const outer=frame(),inner=frame('inner',{x:100,y:130,width:220,height:150}),note={...frame('note'),kind:'text' as const,text:'Body',x:130,y:160,width:120,height:80};
 const board={...emptyBoard(),version:3 as const,nodes:[outer,inner,note]},before=structuredClone(board);
 const draft={...outer,...resizedSection(outer,-40,0,'left')},drafts=new Map([[outer.id,draft]]),originals=new Map(board.nodes.map(n=>[n.id,{...n}]));
 const display=dragDisplayBoard(board,drafts,true),changes=dragCommitChanges(board,originals,drafts,true);
 assert.deepEqual(rect(display.nodes[0]),{x:10,y:80,width:440,height:300});
 assert.equal(changes.size,1);assert.equal(changes.get(outer.id)?.x,10);
 assert.deepEqual(display.nodes.slice(1),before.nodes.slice(1));assert.deepEqual(board,before);
});

test('the innermost open frame wins regardless of node order',()=>{
 const outer=frame('outer'),inner=frame('inner',{x:80,y:110,width:180,height:140});
 for(const nodes of [[outer,inner],[inner,outer]])assert.equal(sectionAtPoint(nodes,{x:100,y:130}),inner);
});

test('equally sized overlapping frames use the last painted hit',()=>{
 const first=frame('first'),last=frame('last');
 assert.equal(sectionAtPoint([first,last],{x:100,y:130}),last);
 assert.equal(sectionAtPoint([last,first],{x:100,y:130}),first);
});

test('locked frames remain hits, including the innermost locked frame',()=>{
 const outer=frame('outer'),locked=frame('locked',{x:80,y:110,width:180,height:140,locked:true});
 assert.equal(sectionAtPoint([outer,locked],{x:100,y:130}),locked);
 assert.equal(sectionAtPoint([locked],{x:100,y:130}),locked);
});

test('the exact frame boundary is inside and a point just beyond it is outside',()=>{
 const node=frame();
 for(const point of [{x:50,y:80},{x:450,y:80},{x:50,y:380},{x:450,y:380}])assert.equal(sectionAtPoint([node],point),node);
 for(const point of [{x:49.999,y:80},{x:450.001,y:80},{x:50,y:79.999},{x:50,y:380.001}])assert.equal(sectionAtPoint([node],point),undefined);
});

for(const key of ['collapsed','branchFolded','sectionFolded'] as const)test(`${key} frames cannot be selected through their hidden body`,()=>{
 const node=frame('folded',{[key]:true});assert.equal(sectionAtPoint([node],{x:100,y:130}),undefined);
});

test('an expanded child hidden by an enclosing folded group is not hit through the production visibility projection',()=>{
 const outer=frame('outer',{sectionFolded:true}),inner=frame('inner',{x:80,y:110,width:180,height:140});
 const board={...emptyBoard(),version:3 as const,nodes:[outer,inner]};
 assert.equal(sectionAtPoint(visibleBranchBoard(board).nodes,{x:100,y:130}),undefined);
});

test('a frame hidden by a folded branch is not hit through the production visibility projection',()=>{
 const root={...frame('root'),kind:'text' as const,text:'Parent',branchFolded:true,x:600},child=frame('child');
 const board={...emptyBoard(),version:3 as const,nodes:[root,child],edges:[{id:'edge',from:'root',to:'child',kind:'branch' as const,label:''}]};
 assert.equal(sectionAtPoint(visibleBranchBoard(board).nodes,{x:100,y:130}),undefined);
});

test('non-section nodes and empty areas do not intercept the blank double-click',()=>{
 const card={...frame('card'),kind:'text' as const,text:'Not a group'};
 assert.equal(sectionAtPoint([card],{x:100,y:130}),undefined);
 assert.equal(sectionAtPoint([],{x:100,y:130}),undefined);
});

test('non-finite pointer coordinates never identify a frame',()=>{
 const node=frame();
 for(const invalid of [NaN,Infinity,-Infinity]){
  assert.equal(sectionAtPoint([node],{x:invalid,y:130}),undefined);
  assert.equal(sectionAtPoint([node],{x:100,y:invalid}),undefined);
 }
});
