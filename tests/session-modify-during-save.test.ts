import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const deps={...model,...mindmap,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(ownModify=false){
 let disk=JSON.stringify(model.emptyBoard(),null,2),reads=0,attempts=0,s:any;
 const writes:Array<()=>void>=[],notifications:Promise<void>[]=[],recovered:string[]=[],events:string[]=[];
 const plugin={app:{vault:{process:async(_file:unknown,edit:(raw:string)=>string)=>{attempts++;disk=edit(disk);if(ownModify)notifications.push(s.externalUpdate());await new Promise<void>(resolve=>writes.push(resolve));},read:async()=>{reads++;return disk;}}},createUnique:async(_folder:string,_name:string,_extension:string,raw:string)=>{recovered.push(raw);return{path:'恢复草稿.thoughtspace'};}};
 s=new Session(plugin,{path:'board.thoughtspace',basename:'board'},disk);s.listeners.add((kind:string)=>events.push(kind));
 return{s,writes,notifications,recovered,events,stats:()=>({reads,attempts,disk}),external:(x:number|string)=>{disk=typeof x==='string'?x:JSON.stringify({...model.emptyBoard(),viewport:{x,y:0,zoom:1}},null,2);}};
}

test('one external modify delivered before a local save settles is applied after the write',async()=>{
 const f=fixture();f.s.board.viewport.x=100;f.s.persist();await tick();f.external(900);const update=f.s.externalUpdate();f.writes[0]();await Promise.all([update,f.s.flush()]);
 assert.equal(f.s.board.viewport.x,900);assert.equal(f.s.baseline,f.stats().disk);assert.equal(f.s.status,'已同步外部修改');assert.equal(f.s.blocked,false);assert.equal(f.stats().reads,1);assert.equal(f.stats().attempts,1);
});

test('own modify events and a burst during saving coalesce into one read without a write loop or history reset',async()=>{
 const f=fixture(true),history=f.s.history,board=f.s.board;f.s.change((b:model.Board)=>b.viewport.x=100);await tick();
 for(let i=0;i<100;i++)f.notifications.push(f.s.externalUpdate());f.writes[0]();await Promise.all([...f.notifications,f.s.flush()]);await tick();
 assert.deepEqual(f.stats(),{reads:1,attempts:1,disk:f.s.baseline});assert.equal(f.s.board,board);assert.equal(f.s.history,history);assert.equal(history.undoStack.length,1);assert.equal(f.s.status,'已保存');assert.equal(f.events.filter(kind=>kind==='board').length,1);
});

test('modify revalidation waits for every queued local save and still reads only the final disk once',async()=>{
 const f=fixture(true);f.s.change((b:model.Board)=>b.viewport.x=100);await tick();f.s.change((b:model.Board)=>b.viewport.x=200);f.writes[0]();await tick();assert.equal(f.writes.length,2);assert.equal(f.stats().reads,0);f.writes[1]();await f.s.flush();await Promise.all(f.notifications);
 assert.equal(f.s.board.viewport.x,200);assert.equal(JSON.parse(f.stats().disk).viewport.x,200);assert.equal(f.stats().attempts,2);assert.equal(f.stats().reads,1);assert.equal(f.s.history.undoStack.length,2);
});

test('queued local edits still detect external conflicts and retain the latest recovery draft',async()=>{
 const f=fixture(true);f.s.board.viewport.x=100;f.s.persist();await tick();f.s.board.viewport.x=200;f.s.persist();f.external(900);const update=f.s.externalUpdate();f.writes[0]();await Promise.all([update,f.s.flush()]);await Promise.all(f.notifications);
 assert.equal(f.s.blocked,true);assert.equal(JSON.parse(f.stats().disk).viewport.x,900);assert.equal(f.recovered.length,1);assert.equal(JSON.parse(f.recovered[0]).viewport.x,200);assert.equal(f.stats().reads,0);assert.equal(f.stats().attempts,2);assert.match(f.s.status,/恢复草稿/);
});

test('an invalid external modify received during saving pauses writes after the pending save completes',async()=>{
 const f=fixture();f.s.board.viewport.x=100;f.s.persist();await tick();f.external('incomplete external JSON');const update=f.s.externalUpdate();f.writes[0]();await Promise.all([update,f.s.flush()]);
 assert.equal(f.s.blocked,true);assert.equal(f.s.board.viewport.x,100);assert.equal(f.stats().disk,'incomplete external JSON');assert.equal(f.stats().reads,1);assert.match(f.s.status,/外部文件格式错误/);
});
