import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrainBoard} from '../src/brain-board';
import {brainAssociationSides,planBrainNoteRelation,type BrainRelationSide} from '../src/brain-board-create';
import {captureLocalRelationEdit} from '../src/local-relations-edit';
import {clone,parseBoard,type Board} from '../src/model';
import {localRelationMatches} from '../src/local-relations';
import {brainBoardLayout} from '../src/brain-board-layout';

function fixture():Board{return{...createBrainBoard('center'),nodes:[{id:'center',kind:'card',file:'Notes/Center.md',x:20,y:30,width:320,height:240,color:'slate'}]};}
function add(board:Board,side:BrainRelationSide,path='Notes/Target.md',suffix='target'){return planBrainNoteRelation(board,'center',path,side,suffix,'edge-'+suffix,captureLocalRelationEdit(board,['center']));}
for(const side of ['top','bottom','left','right'] as const)test(`${side} creates the correct native-note relation and survives serialized reopen`,()=>{
 const board=fixture(),before=clone(board),result=add(board,side),edge=result.board.edges[0],associated=side==='left'||side==='right';assert.deepEqual(board,before);assert.equal(result.board.nodes.length,2);assert.equal(result.board.brain!.centerId,'center');assert.equal(edge.from,side==='top'?'target':'center');assert.equal(edge.to,side==='top'?'center':'target');assert.equal(edge.kind,associated?undefined:'branch');assert.equal(edge.direction,associated?'both':'forward');assert.deepEqual(parseBoard(JSON.stringify(result.board)),result.board);
 const matches=localRelationMatches(result.board,'center');assert.equal(matches.groups.find(group=>group.kind===(side==='top'?'parents':side==='bottom'?'children':'associated'))!.items[0].id,'target');assert.equal(matches.groups.find(group=>group.kind==='siblings')!.items.length,0);
 const layout=brainBoardLayout(matches,{associationSides:brainAssociationSides(result.board,'center')}),center=layout.nodes.find(node=>node.id==='center')!,target=layout.nodes.find(node=>node.id==='target')!;if(side==='left')assert(target.x<center.x);if(side==='right')assert(target.x>center.x);if(side==='top')assert(target.y<center.y);if(side==='bottom')assert(target.y>center.y);
});
test('existing references retain identity and geometry; duplicate and self relations do not add a second node',()=>{
 const board=fixture();board.nodes.push({...clone(board.nodes[0]),id:'existing',file:'Notes/Target.md',x:888});const result=add(board,'right');assert.equal(result.added,false);assert.equal(result.nodeId,'existing');assert.deepEqual(result.board.nodes,board.nodes);assert.throws(()=>add(result.board,'left','Notes/Target.md','duplicate'),/已存在/);assert.throws(()=>add(board,'left','Notes/Center.md'),/不同/);assert.equal(board.edges.length,0);
});
test('preflight rejects stale center, locks, second parents and branch cycles without mutating input',()=>{
 const board=fixture(),expected=captureLocalRelationEdit(board,['center']);board.nodes[0].title='Renamed';assert.throws(()=>planBrainNoteRelation(board,'center','Notes/A.md','bottom','a','ea',expected),/中心节点已变化/);board.nodes[0].locked=true;assert.throws(()=>add(board,'bottom'),/解锁/);delete board.nodes[0].locked;const parent=add(board,'top').board,before=clone(parent);assert.throws(()=>add(parent,'top','Notes/Other.md','other'),/父/);assert.deepEqual(parent,before);
 const cycle=add(fixture(),'bottom').board;assert.throws(()=>add(cycle,'top','Notes/Target.md','cycle'),/循环|父|分支/);
});
test('right association hints preserve actual shared-parent siblings and paged newly created neighbors',()=>{
 let board=add(fixture(),'top','Notes/Parent.md','parent').board;board.nodes.push({...clone(board.nodes[0]),id:'sibling',file:'Notes/Sibling.md'});board.edges.push({id:'parent-sibling',from:'parent',to:'sibling',kind:'branch',label:''});board=add(board,'right','Notes/Sibling.md','unused').board;
 const matches=localRelationMatches(board,'center'),layout=brainBoardLayout(matches,{associationSides:brainAssociationSides(board,'center')});assert.equal(layout.nodes.find(node=>node.id==='sibling')!.role,'siblings');assert(layout.links.some(link=>link.role==='siblings'&&link.from==='parent'&&link.to==='sibling'));assert(!layout.links.some(link=>link.role==='siblings'&&link.from==='center'));
 for(let i=0;i<19;i++)board=add(board,i%2?'left':'right',`Notes/Many-${i}.md`,`many-${i}`).board;
 const page=brainBoardLayout(localRelationMatches(board,'center'),{pageSize:4,revealId:'many-18',associationSides:brainAssociationSides(board,'center')});assert(page.pages>1);assert(page.nodes.some(node=>node.id==='many-18'));assert.equal(page.nodes.find(node=>node.id==='many-18')!.role,'associated');assert.equal(brainAssociationSides(board,'many-18').get('center'),'left');
});

for(const side of ['top','bottom','left','right'] as const)test(`${side} can link a native ThoughtSpace whiteboard without changing relationship kinds`,()=>{
 const b=fixture(),r=planBrainNoteRelation(b,'center','Boards/Child.thoughtspace',side,'child','e-board',captureLocalRelationEdit(b,['center']),undefined,'board');
 assert.equal(r.board.nodes.at(-1)!.kind,'board');assert.equal(r.board.nodes.at(-1)!.file,'Boards/Child.thoughtspace');assert.equal(r.board.edges[0].kind,side==='left'||side==='right'?undefined:'branch');assert.equal(r.board.edges[0].direction,side==='left'||side==='right'?'both':'forward');assert.deepEqual(parseBoard(JSON.stringify(r.board)),r.board);assert.equal(b.nodes.length,1);
 assert.throws(()=>planBrainNoteRelation(b,'center','Note.txt',side,'child','e',captureLocalRelationEdit(b,['center']),undefined,'board'));
});
