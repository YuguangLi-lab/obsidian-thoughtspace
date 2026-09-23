import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {Board,Card,History,clone,emptyBoard,parseBoard} from '../src/model';
import {branchState,visibleBranchBoard} from '../src/mindmap';
import {discloseBranches} from '../src/branch-disclosure';
import {foldCards} from '../src/board-tools';
import {foldSections} from '../src/sections';

const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('  private setSelectionFold('),end=source.indexOf('  private copyObjectStyle(',start);
assert.ok(start>=0&&end>start,'The tests must exercise the real fold transaction');
const methods=source.slice(start,end);
const text=(id:string,x:number,y:number):Card=>({id,kind:'text',text:`Content ${id}`,x,y,width:140,height:80,color:'blue'});
function fixture(){
 const board:Board={...emptyBoard(),version:3,nodes:[
  {id:'group',kind:'section',title:'Group',x:0,y:0,width:500,height:400,color:'blue'},
  text('inside',50,120),
  {id:'nested',kind:'section',title:'Nested',x:250,y:70,width:200,height:200,color:'green',sectionFolded:true},
  text('nested-child',280,120),
  {id:'card',kind:'card',file:'outside.md',x:650,y:30,width:300,height:200,color:'rose'},
  text('root',1050,30),text('child',1270,130),text('grand',1490,230),text('other',1710,30)
 ],edges:[
  {id:'root-child',from:'root',to:'child',label:'Child',kind:'branch'},
  {id:'child-grand',from:'child',to:'grand',label:'Grandchild',kind:'branch'},
  {id:'inside-other',from:'inside',to:'other',label:'Cross-group'},
  {id:'visible',from:'group',to:'other',label:'Visible relation'}
 ]};
 const notices:string[]=[],history=new History(),calls={writes:0,clears:0,renders:0};
 const View=new Function('foldSections','branchState','discloseBranches','foldCards','Notice',transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(foldSections,branchState,discloseBranches,foldCards,class{constructor(message:string){notices.push(message);}});
 const owner={board,blocked:false,change(fn:(b:Board)=>void){const before=clone(this.board);fn(this.board);parseBoard(JSON.stringify(this.board));history.push(before);calls.writes++;}};
 const v=new View();Object.assign(v,{session:owner,closed:false,positions:new Map(),selected:new Set(['group','inside','root','child','other']),selectedEdge:'inside-other',contextOpen:true,
  requireOwner(){if(this.closed||this.session!==owner||owner.blocked)throw Error('stale owner');return owner;},
  clearCanvasGesture(){calls.clears++;},renderBoard(){calls.renders++;}});
 return{v,owner,board,history,calls,notices};
}
const hidden=(board:Board)=>[...branchState(board).hidden].sort();

test('mixed group, branch and card folding is one undoable transaction preserving references and geometry',()=>{
 const f=fixture(),before=clone(f.board);
 f.v.setSelectionFold(new Set(['group','root','card']),true);
 assert.deepEqual(f.calls,{writes:1,clears:1,renders:1});
 assert.equal(f.board.nodes[0].sectionFolded,true);assert.equal(f.board.nodes[0].height,400);
 assert.equal(f.board.nodes.find(n=>n.id==='root')!.branchFolded,true);
 assert.equal(f.board.nodes.find(n=>n.id==='card')!.collapsed,true);
 assert.equal(f.board.nodes.find(n=>n.id==='card')!.height,72);
 assert.equal(f.board.nodes.find(n=>n.id==='card')!.expandedHeight,200);
 assert.deepEqual(hidden(f.board),['child','grand','inside','nested','nested-child']);
 assert.deepEqual(f.board.edges,before.edges);
 for(const n of f.board.nodes){const original=before.nodes.find(item=>item.id===n.id)!;assert.deepEqual([n.id,n.file,n.text,n.x,n.y,n.width],[original.id,original.file,original.text,original.x,original.y,original.width]);}
 const undo=f.history.undo(f.board)!;assert.deepEqual(undo,before);assert.equal(f.history.undo(undo),undefined);
 const redo=f.history.redo(undo)!;assert.deepEqual(redo,f.board);
});

test('section-only folding preserves inner frame state and does not change cards or branch flags',()=>{
 const f=fixture(),before=clone(f.board);
 f.v.setSelectionFold(new Set(['group']),true,true);
 assert.deepEqual(f.board.nodes.slice(1),before.nodes.slice(1));assert.equal(f.board.nodes[0].sectionFolded,true);
 f.v.setSelectionFold(new Set(['group']),false,true);
 assert.deepEqual(f.board,before);assert.deepEqual(hidden(f.board),['nested-child']);
 assert.equal(visibleBranchBoard(f.board).nodes.find(n=>n.id==='nested')!.height,72);
});

test('fold removes only hidden selected nodes and hidden selected edges',()=>{
 const f=fixture();f.v.setSelectionFold(new Set(['group']),true,true);
 assert.deepEqual([...f.v.selected],['group','root','child','other']);assert.equal(f.v.selectedEdge,undefined);assert.equal(f.v.contextOpen,false);
 const visible=fixture();visible.v.selectedEdge='visible';visible.v.setSelectionFold(new Set(['group']),true,true);
 assert.equal(visible.v.selectedEdge,'visible');assert.ok(visible.board.edges.some(e=>e.id==='inside-other'),'hidden relations remain in the model');
});

for(const editing of ['inline','mounting','title','conflict'])test(`folding refuses to hide ${editing} editing without saving, discarding or changing selection`,()=>{
 const f=fixture(),before=clone(f.board),selected=[...f.v.selected],input={value:'Unsaved title'};
 const editor={dirty:true,saveError:editing==='conflict'?'Save failed':undefined,commit(){assert.fail('folding must not auto-commit');},dispose(){assert.fail('folding must not discard the editor');}};
 if(editing==='title')f.v.positions.set('inside',{querySelector:(selector:string)=>selector==='.ts-card-title-input'?input:null});
 else if(editing==='mounting')f.v.inlineTarget='inside';
 else Object.assign(f.v,{inlineId:'inside',inlineTarget:'inside',inline:editor});
 f.v.setSelectionFold(new Set(['group']),true,true);
 assert.deepEqual(f.board,before);assert.deepEqual([...f.v.selected],selected);assert.equal(f.v.selectedEdge,'inside-other');assert.equal(f.v.contextOpen,true);
 assert.deepEqual(f.calls,{writes:0,clears:0,renders:0});assert.deepEqual(f.notices,['请先完成内容编辑，再折叠分组或卡片']);
 if(editing==='title')assert.equal(f.v.positions.get('inside').querySelector('.ts-card-title-input'),input);
 else if(editing!=='mounting')assert.equal(f.v.inline,editor);
});

test('editing the selected card blocks a mixed fold atomically',()=>{
 const f=fixture(),before=clone(f.board);f.v.inlineId='card';
 f.v.setSelectionFold(new Set(['group','card','root']),true);
 assert.deepEqual(f.board,before);assert.equal(f.calls.writes,0);assert.equal(f.notices.length,1);
});

test('editing a visible unrelated object does not block group folding',()=>{
 const f=fixture();f.v.inlineId='other';f.v.inlineTarget='other';
 f.v.setSelectionFold(new Set(['group']),true,true);
 assert.equal(f.board.nodes[0].sectionFolded,true);assert.equal(f.calls.writes,1);assert.deepEqual(f.notices,[]);
});

test('expanding a group is allowed when it reveals an active member editor',()=>{
 const f=fixture();f.board.nodes[0].sectionFolded=true;f.v.inlineId='inside';f.v.inlineTarget='inside';
 f.v.setSelectionFold(new Set(['group']),false,true);
 assert.equal(f.board.nodes[0].sectionFolded,undefined);assert.equal(hidden(f.board).includes('inside'),false);assert.equal(f.calls.writes,1);assert.deepEqual(f.notices,[]);
});

test('locked groups and cards retain exact state while unlocked selected objects may fold',()=>{
 const f=fixture();f.board.nodes[0].locked=true;f.board.nodes.find(n=>n.id==='card')!.locked=true;const before=clone(f.board);
 f.v.setSelectionFold(new Set(['group','card']),true);
 assert.deepEqual(f.board,before);assert.deepEqual(f.calls,{writes:0,clears:0,renders:0});
 f.v.setSelectionFold(new Set(['group','card','root']),true);
 assert.deepEqual(f.board.nodes[0],before.nodes[0]);assert.deepEqual(f.board.nodes.find(n=>n.id==='card'),before.nodes.find(n=>n.id==='card'));
 assert.equal(f.board.nodes.find(n=>n.id==='root')!.branchFolded,true);assert.equal(f.calls.writes,1);
});

test('empty, absent, unsupported and already-matching selections add no history or redraw',()=>{
 for(const [ids,folded,sectionsOnly] of [[[],true,false],[['missing'],true,false],[['other'],true,false],[['card'],true,true],[['group'],false,true]] as [string[],boolean,boolean][]){
  const f=fixture(),before=clone(f.board);f.v.setSelectionFold(new Set(ids),folded,sectionsOnly);
  assert.deepEqual(f.board,before);assert.deepEqual(f.calls,{writes:0,clears:0,renders:0});assert.deepEqual(f.notices,[]);assert.equal(f.history.undo(f.board),undefined);
 }
 const f=fixture();f.v.setSelectionFold(new Set(['group']),true,true);const once=clone(f.board),calls={...f.calls};
 f.v.setSelectionFold(new Set(['group']),true,true);assert.deepEqual(f.board,once);assert.deepEqual(f.calls,calls);
});

test('closed, switched or blocked owner rejects the fold before draft or selection changes',()=>{
 for(const state of ['closed','switched','blocked']){
  const f=fixture(),before=clone(f.board),selected=[...f.v.selected];
  if(state==='closed')f.v.closed=true;else if(state==='switched')f.v.session={};else f.owner.blocked=true;
  assert.throws(()=>f.v.setSelectionFold(new Set(['group']),true,true),/stale owner/);
  assert.deepEqual(f.board,before);assert.deepEqual([...f.v.selected],selected);assert.deepEqual(f.calls,{writes:0,clears:0,renders:0});
 }
});
