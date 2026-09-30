import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';

// Exercise production persistence and pointer release, including their direct camera mutations.
const source=readFileSync(process.env.SESSION_PAN_SOURCE||'src/main.ts','utf8');
const sessionStart=source.indexOf('class Session {'),sessionEnd=source.indexOf('\nexport default class ThoughtSpace',sessionStart);
const deps={...model,...mindmap,reflowReadingContent,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(sessionStart,sessionEnd)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const moveStart=source.indexOf('  private applyPointerMove('),moveEnd=source.indexOf('\n  private updateSelection(',moveStart);
const View=new Function('Notice',transformSync('class View{'+source.slice(moveStart,moveEnd)+'};return View',{loader:'ts'}).code)(class{});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(side:'left'|'right',version:1|2|3=3){
 const initial=model.emptyBoard(),file={path:'board.thoughtspace',basename:'board'};initial.version=version;
 let disk=JSON.stringify(initial,null,2),resolveRead!:(raw:string)=>void,writes=0,recoveries=0;
 const plugin={app:{vault:{read:()=>new Promise<string>(resolve=>resolveRead=resolve),process:async(_file:unknown,edit:(raw:string)=>string)=>{writes++;disk=edit(disk);}}},createUnique:async()=>{recoveries++;return{path:'recovery.thoughtspace'};}};
 const session=new Session(plugin,file,disk),view=new View(),screens:number[]=[],trail:model.Board['viewport'][]=[];
 const gesture={id:1,x:10,y:20,before:{viewport:{...initial.viewport}},pan:true,crossedThreshold:true};
 const captures=new Set<number>();
 Object.assign(view,{session,gesture:side==='left'?gesture:undefined,rightMarquee:side==='right'?{id:1,x:10,y:20,viewport:{...initial.viewport},owner:session,action:'pan',moved:false,crossedThreshold:true}:undefined,dragging:false,mode:'select',pendingFits:new Map(),plugin:{settings:{dragThreshold:4}},stage:{setPointerCapture:(id:number)=>captures.add(id),hasPointerCapture:(id:number)=>captures.has(id),releasePointerCapture:(id:number)=>captures.delete(id)},renderBoard:()=>screens.push(session.board.viewport.x),flushPointer(){},previewGridLanding(){},drawAlignmentGuides(){},cancelConnection(){},setSectionTool(){},viewTrail:{remember:(viewport:model.Board['viewport'])=>trail.push({...viewport})}});
 session.listeners.add((kind:string)=>{if(kind==='board')screens.push(session.board.viewport.x);});
 const external=model.emptyBoard();external.version=3;external.viewport={x:900,y:-120,zoom:.8};external.nodes.push({id:'external',kind:'text',text:'External synchronized content',x:20,y:30,width:200,height:100,color:'sand'});
 const raw=JSON.stringify(external,null,2);
 const event=(clientX:number,buttons=1)=>({pointerId:1,clientX,clientY:20,buttons});
 return{session,view,screens,trail,initial,raw,event,file,external,receive:()=>{disk=raw;return session.externalUpdate();},completeRead:(value=raw)=>resolveRead(value),disk:()=>disk,stats:()=>({writes,recoveries})};
}

for(const side of ['left','right'] as const)for(const cancelled of [false,true])for(const beforeRead of [false,true])test(`${side} pan ${cancelled?'cancellation':'release'} started ${beforeRead?'before':'during'} an external read merges its camera without a jump or lost content`,async()=>{
 const f=fixture(side);if(beforeRead)f.view.applyPointerMove(f.event(110));
 const updating=f.receive();await tick();
 if(!beforeRead)f.view.applyPointerMove(f.event(110));assert.equal(f.session.board.viewport.x,160);
 f.completeRead();await updating;
 assert.equal(f.session.board.viewport.x,160);
 assert.deepEqual(f.screens,[160,160]);
 assert.equal(f.session.board.nodes[0].text,'External synchronized content');
 assert.equal(f.session.baseline,f.raw);assert.equal(f.session.blocked,false);
 assert.deepEqual(f.stats(),{writes:0,recoveries:0});
 f.view.pointerUp(f.event(150,0),cancelled);await f.session.flush();
 const viewport=cancelled?f.initial.viewport:{...f.initial.viewport,x:200};
 assert.deepEqual(f.session.board.viewport,viewport);assert.equal(f.session.blocked,false);
 assert.deepEqual(f.stats(),{writes:1,recoveries:0});
 const reopened=model.parseBoard(f.disk());assert.deepEqual(reopened.viewport,viewport);assert.deepEqual(reopened.nodes,f.external.nodes);
 assert.equal(f.view.gesture,undefined);assert.equal(f.view.rightMarquee,undefined);
 assert.equal(f.trail.length,cancelled?0:1);
});

test('an idle camera still adopts the external viewport and content without writing it back',async()=>{
 const f=fixture('left'),updating=f.receive();await tick();f.completeRead();await updating;
 assert.deepEqual(f.session.board.viewport,f.external.viewport);
 assert.deepEqual(f.session.board.nodes,f.external.nodes);assert.equal(f.session.baseline,f.raw);
 assert.deepEqual(f.stats(),{writes:0,recoveries:0});assert.equal(f.session.status,'已同步外部修改');
});

test('a previously saved local camera adopts the external viewport when it has no unpersisted movement',async()=>{
 const f=fixture('left');f.session.board.viewport={x:320,y:240,zoom:1.2};f.session.persist();await f.session.flush();
 const updating=f.receive();await tick();f.completeRead();await updating;
 assert.deepEqual(f.session.board.viewport,f.external.viewport);
 assert.deepEqual(f.session.board.nodes,f.external.nodes);assert.equal(f.session.baseline,f.raw);
 assert.deepEqual(f.stats(),{writes:1,recoveries:0});assert.equal(f.session.blocked,false);
});

for(const version of [1,2] as const)test(`unpersisted panning merges with external content when the baseline uses schema ${version}`,async()=>{
 const f=fixture('left',version);f.view.applyPointerMove(f.event(110));
 const updating=f.receive();await tick();f.completeRead();await updating;
 assert.equal(f.session.board.viewport.x,160);assert.equal(f.session.board.version,3);
 assert.deepEqual(f.session.board.nodes,f.external.nodes);assert.equal(f.session.baseline,f.raw);
 f.view.pointerUp(f.event(150,0));await f.session.flush();
 const reopened=model.parseBoard(f.disk());assert.equal(reopened.viewport.x,200);assert.deepEqual(reopened.nodes,f.external.nodes);
 assert.deepEqual(f.stats(),{writes:1,recoveries:0});assert.equal(f.session.blocked,false);
});

test('unchanged external file cannot reset the directly moved camera or replace its board and history',async()=>{
 const f=fixture('left'),baseline=f.session.baseline,board=f.session.board,history=f.session.history,updating=f.session.externalUpdate();await tick();
 f.view.applyPointerMove(f.event(110));
 f.completeRead(baseline);await updating;
 assert.equal(f.session.baseline,baseline);assert.equal(f.session.board.viewport.x,160);
 assert.equal(f.session.board,board);assert.equal(f.session.history,history);
 assert.equal(f.session.board.nodes.length,0);assert.equal(f.session.blocked,false);
 assert.deepEqual(f.stats(),{writes:0,recoveries:0});
});
