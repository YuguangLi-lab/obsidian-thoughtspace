import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {foldCards} from '../src/board-tools';
import {sectionContains,sectionDisplayNode} from '../src/sections';
import {reflowReadingContent} from '../src/expansion-reading-state';

// Exercise the production Session transaction and rollback boundary. Only vault
// writes are substituted; the fixture never opens or modifies a user vault.
const source=readFileSync('src/main.ts','utf8'),from=source.indexOf('class Session {'),to=source.indexOf('\nexport default class ThoughtSpace',from);
assert(from>=0&&to>from);
const deps={...model,...mindmap,reflowReadingContent,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(from,to)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
function initialBoard():model.Board{
 return{...model.emptyBoard(),version:3,nodes:[
  {id:'group',kind:'section',title:'Group',x:0,y:0,width:700,height:700,color:'green'},
  {id:'a',kind:'card',file:'A.md',x:40,y:70,width:180,height:150,color:'blue',mindmapRules:{layout:'right',density:'standard',automatic:false}},
  {id:'b',kind:'card',file:'B.md',x:40,y:300,width:180,height:200,color:'blue'}
 ],edges:[{id:'edge',from:'a',to:'b',kind:'branch',label:''}]};
}
function fixture(board=initialBoard()){
 const session=new Session({app:{vault:{process:async()=>{}}}},{path:'Synthetic.thoughtspace'},JSON.stringify(board));
 session.persist=()=>{};return session;
}
const at=(board:model.Board,id:string)=>board.nodes.find(n=>n.id===id)!;
const geometry=(board:model.Board)=>board.nodes.map(({id,x,y,width,height})=>({id,x,y,width,height}));
function tighten(s:ReturnType<typeof fixture>,width=230,height=350){
 s.change((board:model.Board)=>foldCards(board,new Set(['a','b']),true));
 s.change((board:model.Board)=>Object.assign(at(board,'group'),{width,height}));
 return model.clone(s.board) as model.Board;
}
function fold(s:ReturnType<typeof fixture>,id:string,closed:boolean){s.change((board:model.Board)=>foldCards(board,new Set([id]),closed));}
function visibleContains(board:model.Board,groupId:string,id:string){return sectionContains(at(board,groupId),sectionDisplayNode(at(board,id)));}

test('folded members remain in a manually tightened frame when unfolded one at a time',()=>{
 const s=fixture();
 const baseline=tighten(s);
 for(const id of ['a','b'])assert(sectionContains(at(s.board,'group'),sectionDisplayNode(at(s.board,id))));
 for(const id of ['a','b']){
  assert.doesNotThrow(()=>s.change((board:model.Board)=>foldCards(board,new Set([id]),false)),`opening ${id} must grow the frame instead of rejecting its original visible members`);
  assert(sectionContains(at(s.board,'group'),at(s.board,id)));
 }
 assert(at(s.board,'group').height>350);
 for(const id of ['a','b'])s.change((board:model.Board)=>foldCards(board,new Set([id]),true));
 assert.deepEqual(geometry(s.board),geometry(baseline),'collapse returns to the user-sized frame, not the original oversized frame');
});

for(const linked of [false,true])test(`tightening both dimensions preserves wide folded members with branch=${linked}`,()=>{
 const board=initialBoard();for(const n of board.nodes)if(n.kind==='card')n.width=280;
 if(!linked){board.edges=[];delete at(board,'a').mindmapRules;}
 const s=fixture(board),baseline=tighten(s,250,350);
 for(const id of ['a','b']){fold(s,id,false);assert(sectionContains(at(s.board,'group'),at(s.board,id)));}
 assert(at(s.board,'group').width>250);assert(at(s.board,'group').height>350);
 fold(s,'b',true);assert.equal(at(s.board,'a').collapsed,undefined,'the other reading card remains open');
 assert(sectionContains(at(s.board,'group'),at(s.board,'a')));
 fold(s,'a',true);assert.deepEqual(geometry(s.board),geometry(baseline));
});

test('save/reload after shrinking and after expansion retains the new frame recovery baseline',()=>{
 const s=fixture(),baseline=tighten(s),resized=fixture(model.parseBoard(JSON.stringify(s.board)));
 fold(resized,'b',false);fold(resized,'a',false);
 const reading=fixture(model.parseBoard(JSON.stringify(resized.board)));
 fold(reading,'b',true);assert.equal(at(reading.board,'a').collapsed,undefined);
 fold(reading,'a',true);assert.deepEqual(geometry(reading.board),geometry(baseline));
 const collapsed=model.clone(reading.board);reading.undo();assert.equal(at(reading.board,'a').collapsed,undefined);
 reading.undo(true);assert.deepEqual(reading.board,collapsed);
});

test('delayed note growth preserves compact membership and recovers neighbors while keeping the newest height',()=>{
 const board=initialBoard();board.edges=[];delete at(board,'a').mindmapRules;at(board,'a').autoFit=true;
 board.nodes.push({id:'outside',kind:'text',text:'Outside',x:40,y:740,width:180,height:100,color:'rose'});
 const s=fixture(board),baseline=tighten(s);
 fold(s,'a',false);
 s.change((draft:model.Board)=>{at(draft,'a').height=900;},undefined,false,false,true);
 assert(visibleContains(s.board,'group','a'));assert(visibleContains(s.board,'group','b'));
 assert(at(s.board,'outside').y>at(baseline,'outside').y);assert(!visibleContains(s.board,'group','outside'));
 const a=sectionDisplayNode(at(s.board,'a')),b=sectionDisplayNode(at(s.board,'b'));assert(a.y+a.height<=b.y||b.y+b.height<=a.y);
 fold(s,'a',true);assert.deepEqual(geometry(s.board),geometry(baseline));assert.equal(at(s.board,'a').expandedHeight,900);
});

test('an outside folded card is displaced without becoming a member of the growing frame',()=>{
 const board=initialBoard();board.edges=[];delete at(board,'a').mindmapRules;
 board.nodes.push({id:'outside',kind:'card',file:'Outside.md',collapsed:true,expandedHeight:300,x:40,y:500,width:280,height:72,color:'rose'});
 const s=fixture(board),baseline=tighten(s);fold(s,'b',false);
 assert(!visibleContains(s.board,'group','outside'));
 assert.equal(at(s.board,'outside').collapsed,true);assert.equal(at(s.board,'outside').expandedHeight,300);
 fold(s,'b',true);assert.deepEqual(geometry(s.board),geometry(baseline));
});

test('a locked compact frame still rejects expansion atomically when there is no room',()=>{
 const s=fixture();tighten(s);s.change((board:model.Board)=>{at(board,'group').locked=true;});
 const before=model.clone(s.board);
 assert.throws(()=>fold(s,'b',false),/锁定分组没有足够空间/);
 assert.deepEqual(s.board,before);
});

test('a truly external branch member is not adopted merely because its sibling expands',()=>{
 const s=fixture();tighten(s,230,210);const before=model.clone(s.board);
 assert(!visibleContains(s.board,'group','b'));
 assert.throws(()=>fold(s,'a',false),/共享或重叠分组/);assert.deepEqual(s.board,before);
});

test('folded nested frames retain their full membership bounds instead of joining by title alone',()=>{
 const board=initialBoard();board.edges=[];delete at(board,'a').mindmapRules;
 board.nodes.push({id:'nested',kind:'section',title:'Independent frame',x:250,y:70,width:350,height:500,sectionFolded:true,color:'rose'});
 const s=fixture(board);tighten(s,450,400);
 assert(sectionContains(at(s.board,'group'),sectionDisplayNode(at(s.board,'nested'))));
 assert(!sectionContains(at(s.board,'group'),at(s.board,'nested')));
 fold(s,'a',false);assert(!sectionContains(at(s.board,'group'),at(s.board,'nested')));
});

test('a later manual resize supersedes the reading recovery frame',()=>{
 const s=fixture();tighten(s);fold(s,'b',false);
 s.change((board:model.Board)=>Object.assign(at(board,'group'),{width:500,height:650}));
 fold(s,'b',true);assert.equal(at(s.board,'group').width,500);assert.equal(at(s.board,'group').height,650);
});
