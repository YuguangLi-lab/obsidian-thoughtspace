import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';

// Exercise the production Session, including its actual persistence queue and history.
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const deps={...model,...mindmap,reflowReadingContent,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 let disk=JSON.stringify(model.emptyBoard(),null,2);
 const original=disk,recovered:string[]=[],writes:{release:()=>void}[]=[],events:{kind:string;status:string;blocked:boolean}[]=[];
 const plugin={app:{vault:{
  process:async(_file:unknown,edit:(raw:string)=>string)=>{await new Promise<void>(resolve=>writes.push({release:resolve}));disk=edit(disk);},
  read:async()=>disk
 }},createUnique:async(_folder:string,_name:string,_extension:string,raw:string)=>{recovered.push(raw);return{path:'恢复草稿.thoughtspace'};}};
 const session=new Session(plugin,{path:'board.thoughtspace',basename:'board'},disk);
 session.listeners.add((kind:string)=>events.push({kind,status:session.status,blocked:session.blocked}));
 return{session,writes,events,recovered,original,disk:()=>disk,external:(raw:string)=>{disk=raw;}};
}

test('rapid viewport saves coalesce disk writes without flashing 保存中 before the delay',async()=>{
 const f=fixture(),s=f.session;s.board.viewport.x=100;s.persist();await tick();
 for(let i=0;i<5000;i++){s.board.viewport.x=i;s.persist();}
 assert.equal(f.events.length,0);
 let finished=false;const flushing=s.flush().then(()=>{finished=true;});
 f.writes[0].release();await tick();
 assert.equal(f.writes.length,2);assert.equal(finished,false);
 assert(!f.events.some(e=>e.status==='已保存'));
 f.writes[1].release();await flushing;
 assert.equal(JSON.parse(f.disk()).viewport.x,4999);assert.equal(s.baseline,f.disk());
 assert.equal(s.blocked,false);assert.equal(s.status,'已保存');
 assert.equal(f.events.at(-1)?.kind,'status');assert.equal(f.events.at(-1)?.status,'已保存');
});

test('coalesced save notifications preserve every content edit and real undo/redo history',async()=>{
 const f=fixture(),s=f.session;
 s.change((b:model.Board)=>b.viewport.x=100);await tick();
 s.change((b:model.Board)=>b.viewport.x=200);s.undo();assert.equal(s.board.viewport.x,100);s.undo(true);assert.equal(s.board.viewport.x,200);
 assert.equal(f.events.filter(e=>e.kind==='board').length,4);
 assert.equal(f.events.filter(e=>e.kind==='status').length,0);
 assert.equal(s.history.undoStack.length,2);assert.equal(s.history.redoStack.length,0);
 f.writes[0].release();await tick();assert.equal(f.writes.length,2);
 f.writes[1].release();await s.flush();
 assert.equal(JSON.parse(f.disk()).viewport.x,200);assert.equal(s.status,'已保存');
 assert.equal(f.events.at(-1)?.kind,'status');assert.equal(f.events.at(-1)?.status,'已保存');
});

test('delete on a paused board does not clear the selection',()=>{
 const start=source.indexOf('  private deleteSelection()');assert.ok(start>0);
 const rest=source.slice(start+'  private deleteSelection()'.length),mark=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(rest);assert.ok(mark);
 const View=new Function(transformSync('class View{'+source.slice(start,start+'  private deleteSelection()'.length+mark.index)+'};return View',{loader:'ts'}).code)();
 const view=new View();let changed=false;view.session={blocked:true};view.selected=new Set(['a']);view.selectedEdge='e';view.mutate=()=>{changed=true;};view.renderBoard=()=>{changed=true;};
 view.deleteSelection();
 assert.equal(changed,false);assert.deepEqual([...view.selected],['a']);assert.equal(view.selectedEdge,'e');
});

test('undo and redo of a card keep a camera move made after the edit',()=>{
 const f=fixture(),s=f.session;
 s.change((b:model.Board)=>{b.nodes.push({id:'a',kind:'text',text:'林荫',x:10,y:20,width:200,height:80,color:'sand'});});
 s.board.viewport={x:80,y:-40,zoom:1.5};
 s.undo();
 assert.equal(s.board.nodes.length,0);
 assert.deepEqual(s.board.viewport,{x:80,y:-40,zoom:1.5});
 s.undo(true);
 assert.equal(s.board.nodes.length,1);
 assert.equal(s.board.nodes[0].x,10);
 assert.deepEqual(s.board.viewport,{x:80,y:-40,zoom:1.5});
});

test('a conflict retains the latest recovery draft and terminal error notification without overwriting disk',async()=>{
 const f=fixture(),s=f.session;s.board.viewport.x=100;s.persist();await tick();
 s.board.viewport.x=200;s.persist();
 const external=JSON.stringify({...model.emptyBoard(),viewport:{x:900,y:60,zoom:1}},null,2);f.external(external);
 f.writes[0].release();await s.flush();
 assert.equal(f.writes.length,1);assert.equal(f.disk(),external);assert.equal(s.baseline,f.original);
 assert.equal(f.recovered.length,1);assert.equal(JSON.parse(f.recovered[0]).viewport.x,200);
 assert.equal(s.blocked,true);assert.match(s.status,/恢复草稿/);
 assert.equal(f.events.filter(e=>e.status==='已保存').length,0);
 assert.equal(f.events.at(-1)?.kind,'board');assert.equal(f.events.at(-1)?.blocked,true);
 const terminal=f.events.length;s.persist();await s.flush();assert.equal(f.events.length,terminal);assert.match(s.status,/恢复草稿/);
});

test('unchanged persistence does not flash and a slow save shows 保存中 only after about 500ms',async()=>{
 const f=fixture(),s=f.session;for(let i=0;i<25;i++)s.persist();await s.flush();
 assert.equal(f.writes.length,0);assert.equal(f.disk(),f.original);assert.equal(s.status,'已保存');assert.equal(f.events.length,0);
 s.board.viewport.x=300;s.persist();await tick();assert.notEqual(s.status,'保存中…');
 await new Promise(resolve=>setTimeout(resolve,520));assert.equal(s.status,'保存中…');
 const late=[s.status];s.listeners.add(()=>late.push(s.status));
 f.writes[0].release();await s.flush();assert.deepEqual(late,['保存中…','已保存']);
 assert.equal(JSON.parse(f.disk()).viewport.x,300);
});
