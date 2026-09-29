import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {foldCards} from '../src/board-tools';
import {sectionContains,sectionDisplayNode} from '../src/sections';
import {nodeFitChanges} from '../src/node-fit-batch';
import {reflowExpandedContent} from '../src/expansion-layout';
import {planGroupMove,applyGroupMove} from '../src/group-organizer';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){
 const from=source.indexOf(start),to=source.indexOf(end,from);
 assert(from>=0&&to>from,`production method boundary: ${start}`);
 return source.slice(from,to);
}
const deps={...model,...mindmap,reflowExpandedContent,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(take('class Session {','\nexport default class ThoughtSpace')+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const fits=take('  private queueNodeFit(','\n  private refreshFontMetrics(')+take('  private flushNodeFits(','\n\n  saveView(');
const FitView=new Function('nodeFitChanges','clone',transformSync('class FitView{'+fits+'};return FitView',{loader:'ts'}).code)(nodeFitChanges,model.clone);

function groupedBoard():model.Board{
 return{...model.emptyBoard(),version:3,nodes:[
  {id:'frame',kind:'section',title:'Course',x:0,y:0,width:700,height:700,color:'green'},
  {id:'note',kind:'card',file:'Course.md',autoFit:true,collapsed:true,expandedHeight:500,x:40,y:70,width:280,height:72,color:'blue'},
  {id:'image',kind:'image',file:'Figure.png',x:40,y:260,width:280,height:180,color:'rose'},
  {id:'audio',kind:'audio',file:'Lecture.mp3',x:40,y:500,width:280,height:90,color:'purple'}
 ]};
}
function fixture(board=groupedBoard()){
 let disk=JSON.stringify(board),writes=0;
 const plugin={app:{vault:{process:async(_file:unknown,edit:(raw:string)=>string)=>{disk=edit(disk);writes++;}}}};
 const session=new Session(plugin,{path:'Course.thoughtspace',basename:'Course'},disk),view=new FitView();
 Object.assign(view,{session,pendingFits:new Map(),nodeKeys:new Map([['note','expanded-preview']]),nodeFitQueue:{schedule(){}},closed:false});
 return{session,view,disk:()=>JSON.parse(disk) as model.Board,writes:()=>writes};
}
function node(board:model.Board,id:string):model.Card{return board.nodes.find(n=>n.id===id)!;}
function noOverlap(a:model.Card,b:model.Card){
 const left=sectionDisplayNode(a),right=sectionDisplayNode(b);
 assert(left.x+left.width<=right.x||right.x+right.width<=left.x||left.y+left.height<=right.y||right.y+right.height<=left.y,`${a.id} must not cover ${b.id}`);
}
function separatedGroup(board:model.Board){
 const frame=node(board,'frame'),members=['note','image','audio'].map(id=>node(board,id));
 for(const member of members)assert(sectionContains(frame,member),`frame must retain ${member.id}`);
 for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)noOverlap(members[i],members[j]);
}

test('expansion and delayed auto-fit move grouped media in one undoable Session transaction',async()=>{
 const {session:s,view,disk}=fixture(),before=model.clone(s.board);
 s.change((board:model.Board)=>foldCards(board,new Set(['note']),false));
 assert.equal(node(s.board,'note').height,500);separatedGroup(s.board);
 assert.notDeepEqual(node(s.board,'image'),node(before,'image'),'expanding the note must make room for its image neighbor');
 assert.equal(s.history.undoStack.length,1);

 view.queueNodeFit(node(s.board,'note'),{width:280,height:900});
 assert.equal(view.pendingFits.size,1);view.flushNodeFits();
 assert.equal(node(s.board,'note').height,900);separatedGroup(s.board);
 assert(node(s.board,'frame').height>node(before,'frame').height,'the original group must grow with its content');
 assert.equal(s.history.undoStack.length,1,'renderer measurements must not create a second undo step');
 const expanded=model.clone(s.board);await s.flush();assert.deepEqual(disk(),expanded);

 s.undo();assert.deepEqual(s.board,before);await s.flush();assert.deepEqual(disk(),before);
 assert.equal(s.history.undoStack.length,0);assert.equal(s.history.redoStack.length,1);
 s.undo(true);assert.deepEqual(s.board,expanded);await s.flush();assert.deepEqual(disk(),expanded);
});

test('Session restores locked source geometry before considering expansion',async()=>{
 const board=groupedBoard();node(board,'note').locked=true;
 const {session:s,writes}=fixture(board),before=model.clone(s.board);
 s.change((draft:model.Board)=>{
  const note=node(draft,'note');Object.assign(note,{x:-300,y:-300,width:1200,height:900});delete note.collapsed;delete note.expandedHeight;
 });
 assert.deepEqual(s.board,before,'restored locked geometry must not displace neighbors or grow the group');
 assert.equal(s.history.undoStack.length,0);await s.flush();assert.equal(writes(),0);
});

test('expansion makes room without moving a locked media neighbor',async()=>{
 const board=groupedBoard();node(board,'image').locked=true;
 const {session:s}=fixture(board),locked=model.clone(node(board,'image'));
 s.change((draft:model.Board)=>foldCards(draft,new Set(['note']),false));
 assert.deepEqual(model.clone(node(s.board,'image')),locked);separatedGroup(s.board);
 assert.equal(node(s.board,'note').collapsed,undefined);assert.equal(node(s.board,'note').height,500);
 await s.flush();assert.equal(s.blocked,false);
});

test('an expansion that cannot fit a locked group rolls back the entire transaction',async()=>{
 const board=groupedBoard();node(board,'frame').locked=true;node(board,'note').expandedHeight=1500;
 const {session:s,writes}=fixture(board),before=model.clone(s.board);
 assert.throws(()=>s.change((draft:model.Board)=>foldCards(draft,new Set(['note']),false)));
 assert.deepEqual(s.board,before);assert.equal(s.history.undoStack.length,0);assert.equal(s.history.redoStack.length,0);
 await s.flush();assert.equal(writes(),0);assert.equal(s.blocked,false);
});

test('ordinary movement and shrinking preserve intentionally overlapping freeboard positions',async()=>{
 for(const change of [(n:model.Card)=>{n.x+=20;},(n:model.Card)=>{n.height=350;}]){
  const board=groupedBoard();foldCards(board,new Set(['note']),false);
  const {session:s}=fixture(board),expected=model.clone(board);change(node(expected,'note'));
  s.change((draft:model.Board)=>change(node(draft,'note')));
  assert.deepEqual(s.board,expected,'non-expanding edits must not tidy or resize existing content');
  assert.equal(s.history.undoStack.length,1);await s.flush();
 }
});

test('an explicit move into a growing group retains the accepted destination and undo history',async()=>{
 const board:model.Board={...model.emptyBoard(),version:3,nodes:[
  {id:'frame',kind:'section',title:'Course',x:0,y:0,width:400,height:300,color:'green'},
  {id:'existing',kind:'text',text:'Existing',x:30,y:60,width:280,height:100,color:'blue'},
  {id:'moving',kind:'text',text:'Moving',x:600,y:0,width:280,height:200,color:'rose'}
 ]};
 const {session:s,disk}=fixture(board),before=model.clone(s.board),plan=planGroupMove(s.board,new Set(['moving']),'frame');
 assert.equal(plan.expanded,true);
 s.change((draft:model.Board)=>applyGroupMove(draft,plan));
 assert.equal(node(s.board,'frame').height,422);assert.equal(node(s.board,'moving').y,192);
 assert(sectionContains(node(s.board,'frame'),node(s.board,'moving')),'the move command must leave its selected node inside the destination group');
 assert.equal(s.history.undoStack.length,1);const moved=model.clone(s.board);await s.flush();assert.deepEqual(disk(),moved);
 s.undo();assert.deepEqual(s.board,before);s.undo(true);assert.deepEqual(s.board,moved);await s.flush();assert.deepEqual(disk(),moved);
});

test('a queued measurement cannot reopen or repack a note after undo collapses it',async()=>{
 const {session:s,view,disk,writes}=fixture(),before=model.clone(s.board);
 s.change((board:model.Board)=>foldCards(board,new Set(['note']),false));
 const expanded=model.clone(s.board);
 view.queueNodeFit(node(s.board,'note'),{width:280,height:900});assert.equal(view.pendingFits.size,1);
 s.undo();await s.flush();const saved=writes();
 view.flushNodeFits();await s.flush();
 assert.equal(view.pendingFits.size,0);assert.deepEqual(s.board,before);assert.deepEqual(disk(),before);
 assert.equal(writes(),saved);assert.equal(s.history.undoStack.length,0);assert.equal(s.history.redoStack.length,1);
 s.undo(true);assert.deepEqual(s.board,expanded);await s.flush();
});

test('an old preview key cannot apply delayed growth to a still-open note restored by undo',async()=>{
 const board=groupedBoard();foldCards(board,new Set(['note']),false);
 const {session:s,view,writes}=fixture(board),before=model.clone(s.board);
 s.change((draft:model.Board)=>{node(draft,'note').height=600;});
 const expanded=model.clone(s.board);
 view.queueNodeFit(node(s.board,'note'),{width:280,height:900});assert.equal(view.pendingFits.size,1);
 s.undo();view.nodeKeys.set('note','restored-preview');await s.flush();const saved=writes();
 view.flushNodeFits();await s.flush();
 assert.deepEqual(s.board,before);assert.equal(writes(),saved);
 assert.equal(s.history.undoStack.length,0);assert.equal(s.history.redoStack.length,1);
 s.undo(true);assert.deepEqual(s.board,expanded);await s.flush();
});
