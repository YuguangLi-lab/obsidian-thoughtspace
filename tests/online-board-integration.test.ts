import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,History,parseBoard,type Board} from '../src/model';
import {webCard} from '../src/web-card';
import {parseOnlineSource} from '../src/online-platform';
import {onlinePlayerUrl,parseOnlinePlayerUrl} from '../src/online-media-notes';
import {mediaTime,mediaClock} from '../src/media-source';
import {foldCards} from '../src/board-tools';

const main=readFileSync('src/main.ts','utf8');
function method(start:string){
 const at=main.indexOf(start);assert.ok(at>=0,`Missing production method ${start}`);
 const tail=main.slice(at+start.length),next=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(tail);
 assert.ok(next);return main.slice(at,at+start.length+next.index);
}
const source='https://www.bilibili.com/video/BV1xx411c7mD/?p=2';
function fixture(){
 let sequence=0;const notices:string[]=[],saves:unknown[]=[],history=new History();
 const methods=['  private requireOwner(','  private async captureOnlineBoardMoment(','  async seekOnlineSource('].map(method).join('\n');
 const deps={parseOnlineSource,onlinePlayerUrl,mediaTime,mediaClock,foldCards,uid:()=>`generated-${++sequence}`,Notice:class{constructor(message:string){notices.push(message);}}};
 const View=new Function(...Object.keys(deps),transformSync(`class View {${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const node=webCard(source,'video',{x:100,y:200});
 const owner={board:{...emptyBoard(),version:3,nodes:[node]} as Board,file:{path:'Boards/course.thoughtspace'},blocked:false,refreshNativeEditing(){},change(run:(board:Board)=>void){const before=structuredClone(this.board);run(this.board);parseBoard(JSON.stringify(this.board));history.push(before);}};
 const view=new View(),seeks:number[]=[],revealed:string[]=[];let renderCount=0;
 const note={path:'Notes/video.md'},moment={id:'capture-1',time:12.875,text:'',line:1};
 let save=async(_source:string,data:unknown)=>{saves.push(data);return {note,moment};};
 Object.assign(view,{session:owner,file:owner.file,closed:false,selected:new Set(),onlineBoardPlayers:new Map([['video',{seek:async(time:number)=>{seeks.push(time);}}]]),onlineBoardStates:new Map(),nodeKeys:new Map(),
  app:{vault:{getName:()=> 'Vault'}},plugin:{settings:{defaultTextSize:18,defaultEdgeStyle:'curve',detailZoom:.5},saveOnlineBoardMoment:(path:string,data:unknown)=>save(path,data)},
  updateSelection(){},revealNode(id:string){revealed.push(id);},renderBoard(){renderCount++;}});
 return{view,owner,node,moment,note,saves,seeks,notices,history,revealed,setSave:(fn:typeof save)=>{save=fn;},renders:()=>renderCount};
}
test('board online timestamp saves its source note and appends one linked adjacent card without moving playback or camera',async()=>{
 const f=fixture(),before=structuredClone(f.owner.board);
 await f.view.captureOnlineBoardMoment('video',source,f.moment,f.owner);
 assert.equal(f.saves.length,1);assert.equal(f.owner.board.nodes.length,2);assert.equal(f.history.undoStack.length,1);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.deepEqual(f.seeks,[]);
 const excerpt=f.owner.board.nodes[1];assert.equal(excerpt.id,'online-capture-1');assert.ok(excerpt.x>=f.node.x+f.node.width);
 const href=/\]\((obsidian:\/\/thoughtspace-online-player[^)]+)\)/.exec(excerpt.text!)?.[1];assert.ok(href);assert.deepEqual(parseOnlinePlayerUrl(href),{vault:'Vault',source,time:12.875,note:f.note.path});
 assert.deepEqual(f.owner.board.edges.map(edge=>[edge.from,edge.to,edge.label]),[['video',excerpt.id,'0:12']]);
 assert.deepEqual(f.history.undo(f.owner.board),before);
});
test('a screenshot uses the persisted attachment and retry never duplicates a board card',async()=>{
 const f=fixture(),moment={...f.moment,image:'![视频截图](Attachments/frame.png)'};
 f.setSave(async()=>({note:f.note,moment}));
 const draft={...f.moment,image:new Blob(['png'],{type:'image/png'})};
 await f.view.captureOnlineBoardMoment('video',source,draft,f.owner);await f.view.captureOnlineBoardMoment('video',source,draft,f.owner);
 assert.equal(f.owner.board.nodes.length,2);assert.equal(f.owner.board.edges.length,1);assert.match(f.owner.board.nodes[1].text!,/Attachments\/frame\.png/);
});
test('new excerpts avoid existing cards in the adjacent column',async()=>{
 const f=fixture();f.owner.board.nodes.push({id:'existing',kind:'text',text:'keep',x:f.node.x+f.node.width+56,y:f.node.y,width:350,height:500,color:'blue'});
 await f.view.captureOnlineBoardMoment('video',source,f.moment,f.owner);assert.ok(f.owner.board.nodes[2].y>=f.node.y+524);
});
test('locked, rebound and stale boards cannot start a capture save',async()=>{
 for(const change of ['locked','rebound','switched','closed','blocked']){
  const f=fixture();if(change==='locked')f.node.locked=true;if(change==='rebound')f.node.webUrl='https://www.bilibili.com/video/BV1xx411c7mD/';if(change==='switched')f.view.session={};if(change==='closed')f.view.closed=true;if(change==='blocked')f.owner.blocked=true;
  await assert.rejects(f.view.captureOnlineBoardMoment('video',source,f.moment,f.owner));assert.equal(f.saves.length,0,change);assert.equal(f.owner.board.nodes.length,1,change);
 }
});
test('a board change during persistence keeps the saved note but cannot append to another board or source',async()=>{
 for(const change of ['locked','rebound','deleted','switched','closed','blocked']){
  const f=fixture();f.setSave(async()=>{if(change==='locked')f.node.locked=true;if(change==='rebound')f.node.webUrl='https://www.bilibili.com/video/BV1xx411c7mD/';if(change==='deleted')f.owner.board.nodes=[];if(change==='switched')f.view.session={};if(change==='closed')f.view.closed=true;if(change==='blocked')f.owner.blocked=true;return{note:f.note,moment:f.moment};});
  await f.view.captureOnlineBoardMoment('video',source,f.moment,f.owner);assert.equal(f.owner.board.edges.length,0,change);assert.equal(f.notices.some(value=>value.includes(f.note.path)),true,change);
 }
});
test('a save failure leaves the board untouched and can retry the same capture',async()=>{
 const f=fixture(),before=structuredClone(f.owner.board);f.setSave(async()=>{throw Error('disk');});
 await assert.rejects(f.view.captureOnlineBoardMoment('video',source,f.moment,f.owner),/disk/);assert.deepEqual(f.owner.board,before);
 f.setSave(async()=>({note:f.note,moment:f.moment}));await f.view.captureOnlineBoardMoment('video',source,f.moment,f.owner);assert.equal(f.owner.board.nodes.length,2);
});
test('timestamp backtracking seeks the source card on the same board',async()=>{
 const f=fixture();await f.view.captureOnlineBoardMoment('video',source,f.moment,f.owner);await f.view.seekOnlineSource(source,4.125,'online-capture-1');
 assert.deepEqual(f.seeks,[4.125]);assert.deepEqual(f.revealed,['video']);assert.equal(f.renders(),1);
 await assert.rejects(f.view.seekOnlineSource('https://www.bilibili.com/video/BV1xx411c7mD/',3));assert.deepEqual(f.seeks,[4.125]);
});
