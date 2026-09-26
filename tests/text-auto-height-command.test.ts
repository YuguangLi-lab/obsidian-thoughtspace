import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {textFitsContent} from '../src/text-sizing';
import {nodeFitChanges} from '../src/node-fit-batch';

// Run the actual command, ownership checks, Session history and persistence.
// Only host storage and synchronous DOM measurement are substituted.
const source=readFileSync(process.env.TEXT_AUTO_HEIGHT_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const methods=take('  async setTextAutoHeight(','  fitCards(')
 +take('  private requireOwner(','  private canCreateBlankText(')
 +take('  private flushNodeFits(','  saveView(');
const deps={...model,...mindmap,textFitsContent,nodeFitChanges,Notice:class{},EXT:'thoughtspace',report:()=>{},
 fitTextNode:(node:model.Card,_host:unknown,body:{measurements:number;height:number})=>{body.measurements++;node.height=body.height;}};
function compile(code:string){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
const View=compile(`class View{${methods}};return View`);
const Session=compile(take('class Session {','\nexport default class ThoughtSpace')+';return Session');
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(patch:Partial<model.Card>={}){
 const board=model.emptyBoard();board.version=3;board.nodes=[{id:'text',kind:'text',text:'Original body',x:20,y:30,width:320,height:140,color:'sand',...patch}];
 let disk=JSON.stringify(board,null,2),failSave=false;const original=disk,writes:string[]=[],recovered:string[]=[],events:string[]=[],queued:string[]=[];
 const plugin={app:{vault:{process:async(_file:unknown,edit:(raw:string)=>string)=>{if(failSave)throw Error('disk unavailable');disk=edit(disk);writes.push(disk);}}},
  createUnique:async(_folder:string,_name:string,_extension:string,raw:string)=>{recovered.push(raw);return{path:'recovery.thoughtspace'};}};
 const owner=new Session(plugin,{path:'board.thoughtspace',basename:'board',parent:{path:''}},disk),view=new View();owner.listeners.add((kind:string)=>events.push(kind));
 const body={dataset:{markdownStatus:'ready'},height:420,measurements:0};
 Object.assign(view,{session:owner,closed:false,positions:new Map([['text',{querySelector:()=>body}]]),pendingFits:new Map(),nodeKeys:new Map([['text','current']]),contentEl:{},
  queueTextFit:(node:model.Card)=>queued.push(node.id)});
 return{view,owner,body,events,writes,recovered,queued,original,disk:()=>disk,node:()=>owner.board.nodes[0] as model.Card,failSave:()=>{failSave=true;}};
}

test('two toggles before a redraw use live state and save explicit false',async()=>{
 for(const textAutoHeight of [undefined,false]){
  const f=fixture({textAutoHeight}),before=model.clone(f.owner.board),first=f.view.setTextAutoHeight('text'),second=f.view.setTextAutoHeight('text');
  assert.equal(f.node().textAutoHeight,false);assert.equal(f.owner.history.undoStack.length,2);
  await Promise.all([first,second]);await f.owner.flush();
  assert.equal(model.parseBoard(f.disk()).nodes[0].textAutoHeight,false);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.node().text,before.nodes[0].text);
  assert.equal(f.body.measurements,1);assert.equal(f.queued.length,1);
 }
});

test('legacy automatic topics toggle off then on without an explicit initial flag',async()=>{
 const f=fixture({topic:true});assert.equal(textFitsContent(f.node()),true);
 await f.view.setTextAutoHeight('text');assert.equal(f.node().textAutoHeight,false);assert.equal(f.body.measurements,0);
 await f.view.setTextAutoHeight('text');assert.equal(f.node().textAutoHeight,true);assert.equal(f.body.measurements,1);await f.owner.flush();
});

test('a toggle derives its direction from the state after the editor saves',async()=>{
 const f=fixture({textAutoHeight:false}),save=deferred<boolean>();f.view.inline={commit:()=>save.promise};
 const pending=f.view.setTextAutoHeight('text');assert.equal(f.owner.history.undoStack.length,0);
 f.owner.change((board:model.Board)=>{board.nodes[0].textAutoHeight=true;board.nodes[0].height=560;});
 save.resolve(true);await pending;await f.owner.flush();
 assert.equal(f.node().textAutoHeight,false);assert.equal(f.node().height,560);assert.equal(f.body.measurements,0);assert.equal(f.queued.length,0);
});

test('two toggles awaiting the same editor save each toggle the latest state',async()=>{
 const f=fixture({textAutoHeight:false}),save=deferred<boolean>();f.view.inline={commit:()=>save.promise};
 const first=f.view.setTextAutoHeight('text'),second=f.view.setTextAutoHeight('text');save.resolve(true);await Promise.all([first,second]);await f.owner.flush();
 assert.equal(f.node().textAutoHeight,false);assert.equal(f.owner.history.undoStack.length,2);assert.equal(f.body.measurements,1);
});

test('a refused or failed inline save leaves state, pending fits and history untouched',async()=>{
 for(const failure of [false,Error('save failed')]){
  const f=fixture({textAutoHeight:true}),before=model.clone(f.owner.board),pending={width:320,height:600,key:'current'};f.view.pendingFits.set('text',pending);
  f.view.inline={commit:async()=>{if(failure instanceof Error)throw failure;return failure;}};
  if(failure instanceof Error)await assert.rejects(f.view.setTextAutoHeight('text'),/save failed/);else await f.view.setTextAutoHeight('text');
  assert.deepEqual(f.owner.board,before);assert.equal(f.view.pendingFits.get('text'),pending);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes.length,0);assert.equal(f.body.measurements,0);
 }
});

test('switching boards, closing or write blocking while saving prevents the toggle',async()=>{
 for(const change of ['switch','closed','blocked']){
  const f=fixture({textAutoHeight:true}),save=deferred<boolean>(),before=model.clone(f.owner.board);f.view.inline={commit:()=>save.promise};
  const pending=f.view.setTextAutoHeight('text');if(change==='switch')f.view.session=fixture().owner;else if(change==='closed')f.view.closed=true;else f.owner.blocked=true;
  save.resolve(true);await assert.rejects(pending,/白板已切换或暂停写入/);
  assert.deepEqual(f.owner.board,before,change);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes.length,0);assert.equal(f.queued.length,0);
 }
});

test('a deleted, locked or converted text after saving is not changed',async()=>{
 for(const change of ['deleted','locked','converted']){
  const f=fixture({textAutoHeight:true}),save=deferred<boolean>();f.view.inline={commit:()=>save.promise};const pending=f.view.setTextAutoHeight('text');
  if(change==='deleted')f.owner.board.nodes=[];else if(change==='locked')f.node().locked=true;else f.node().kind='section';const before=model.clone(f.owner.board);
  save.resolve(true);await pending;assert.deepEqual(f.owner.board,before,change);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.queued.length,0);
 }
});

test('disabling retains the current frame and rejects an old fit arriving afterward',async()=>{
 const f=fixture({textAutoHeight:true,height:560,autoSize:true});f.view.pendingFits.set('text',{width:320,height:900,key:'current'});
 await f.view.setTextAutoHeight('text',false);assert.equal(f.view.pendingFits.size,0);assert.deepEqual([f.node().width,f.node().height],[320,560]);assert.equal(f.body.measurements,0);assert.equal(f.queued.length,0);
 f.view.pendingFits.set('text',{width:320,height:900,key:'current'});f.view.flushNodeFits();await f.owner.flush();
 assert.equal(f.view.pendingFits.size,0);assert.deepEqual([f.node().width,f.node().height],[320,560]);assert.equal(f.owner.history.undoStack.length,1);assert.equal(model.parseBoard(f.disk()).nodes[0].textAutoHeight,false);
});

test('explicit true and false remain idempotent and every actual toggle is undoable',async()=>{
 const f=fixture({textAutoHeight:false}),before=model.clone(f.owner.board);
 await f.view.setTextAutoHeight('text',false);assert.equal(f.owner.history.undoStack.length,0);
 await f.view.setTextAutoHeight('text',true);const enabled=model.clone(f.owner.board);assert.equal(f.node().height,420);
 await f.view.setTextAutoHeight('text',true);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.body.measurements,1);
 await f.view.setTextAutoHeight('text',false);const disabled=model.clone(f.owner.board);
 await f.view.setTextAutoHeight('text',false);assert.equal(f.owner.history.undoStack.length,2);assert.equal(f.body.measurements,1);
 f.owner.undo();assert.deepEqual(f.owner.board,enabled);f.owner.undo();assert.deepEqual(f.owner.board,before);
 f.owner.undo(true);assert.deepEqual(f.owner.board,enabled);f.owner.undo(true);assert.deepEqual(f.owner.board,disabled);await f.owner.flush();assert.deepEqual(model.parseBoard(f.disk()),disabled);
});

test('a disk save failure preserves a recovery draft and blocks later toggles',async()=>{
 const f=fixture({textAutoHeight:false});f.failSave();await f.view.setTextAutoHeight('text');await f.owner.flush();
 assert.equal(f.owner.blocked,true);assert.equal(f.disk(),f.original);assert.equal(f.recovered.length,1);assert.equal(model.parseBoard(f.recovered[0]).nodes[0].textAutoHeight,true);
 const before=model.clone(f.owner.board);await assert.rejects(f.view.setTextAutoHeight('text'),/暂停写入/);assert.deepEqual(f.owner.board,before);assert.equal(f.owner.history.undoStack.length,1);
});
