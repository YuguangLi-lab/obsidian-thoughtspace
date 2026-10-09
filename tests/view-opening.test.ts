import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';
import {boardHostDeps} from './board-host-deps';
import {emptyBoard} from '../src/model';
class View{}
class FileView extends View{file:any;}
class BoardView extends FileView{session:any;closed=false;automaticGeometryDeferred=false;resumeCalls=0;fitCalls=0;fit(){this.fitCalls++}resumeAutomaticGeometry(){this.resumeCalls++;this.automaticGeometryDeferred=false;}}
const source=readFileSync('src/main.ts','utf8');
function method(name:string,next:string,deps:Record<string,unknown>={}){deps={...boardHostDeps,FileView,...deps};const start=source.indexOf('  async '+name+'('),end=source.indexOf('\n  '+next,start);return new Function('BoardView','VIEW','WRITING','window',...Object.keys(deps),transformSync('class Host{'+source.slice(start,end)+'};return Host.prototype.'+name,{loader:'ts'}).code)(BoardView,'board','writing',{requestAnimationFrame:(fn:()=>void)=>fn()},...Object.values(deps));}
// Import remains optional before introducing the in-flight coalescer so the old path can be reproduced.
import {SharedOpen} from '../src/view-opening';
function fixture(){const leaves:any[]=[],file:{path:string;extension?:string}={path:'a.thoughtspace',extension:'thoughtspace'},owner={blocked:false,flush:async()=>{}},board={file,session:owner,prepareWriting:async()=>{},closed:false};let creates=0,active:any;
 const listeners=new Map<string,Set<(...args:any[])=>void>>(),emit=(name:string,...args:any[])=>{for(const run of listeners.get(name)||[])run(...args);};
 const workspace={getMostRecentLeaf:()=>active||null,getLeavesOfType:(type:string)=>leaves.filter(l=>l.getViewState().type===type),getLeaf:()=>{creates++;let state:any={type:'empty',state:{}};const leaf:any={view:new View(),getViewState:()=>state,loadIfDeferred:async()=>{},openFile:async(f:any)=>{const deferred=host.provisionalBoardGeometry.get(leaf)===f;host.provisionalBoardGeometry.delete(leaf);await Promise.resolve();const view=new BoardView();view.file=f;view.session={file:f};view.automaticGeometryDeferred=deferred;leaf.view=view;state={type:'board',state:{file:f.path}};emit('file-open',f);},setViewState:async(s:any)=>{await Promise.resolve();state=s;if(s.type==='board'){const view=new BoardView();view.file=file;leaf.view=view;}},detach:()=>{leaves.splice(leaves.indexOf(leaf),1);if(active===leaf){active=leaves.at(-1);emit('active-leaf-change',active);}}};leaves.push(leaf);active=leaf;emit('active-leaf-change',leaf);return leaf;},revealLeaf:async()=>{},setActiveLeaf:(leaf:any)=>{active=leaf;emit('active-leaf-change',leaf);},
  on:(name:string,run:(...args:any[])=>void)=>{let set=listeners.get(name);if(!set){set=new Set();listeners.set(name,set);}set.add(run);return{name,run};},offref:(ref:{name:string;run:(...args:any[])=>void})=>listeners.get(ref.name)?.delete(ref.run)};
 const host:any={provisionalBoardGeometry:new WeakMap(),boardOpeningNavigation:new Set(),app:{workspace,vault:{getAbstractFileByPath:(path:string)=>path===file.path?file:undefined,read:async()=>JSON.stringify(emptyBoard())}},readBoard:async()=>emptyBoard(),boardOpening:new SharedOpen(),writingOpening:new SharedOpen(),writingPreparation:new SharedOpen(),currentBoard:board};return{host,board,file,leaves,workspace,created:()=>creates};}
test('concurrent requests create one board tab and fit works on an already open board',async()=>{const {host,file,created,leaves}=fixture();host.openBoard=method('openBoard','openBoardOrganizer(',{SharedOpen});await Promise.all([host.openBoard(file),host.openBoard(file),host.openBoard(file)]);assert.equal(created(),1);await host.openBoard(file,true);assert.equal(leaves[0].view.fitCalls,1);});
test('reopening writing reuses the same page without resetting its state',async()=>{const {host,board,created}=fixture();host.openWriting=method('openWriting','async recordBoardVisit(',{SharedOpen});const first=await host.openWriting(board),state=first.getViewState();state.state.resourceMode='reference';const next=await host.openWriting(board);assert.equal(next,first);assert.equal(created(),1);assert.equal(next.getViewState().state.resourceMode,'reference');});
test('concurrent writing requests prepare and create only once',async()=>{const {host,board,created}=fixture();let prepares=0;board.prepareWriting=async()=>{prepares++;await Promise.resolve()};host.openWriting=method('openWriting','async recordBoardVisit(',{SharedOpen});const [a,b]=await Promise.all([host.openWriting(board),host.openWriting(board)]);assert.equal(a,b);assert.equal(prepares,1);assert.equal(created(),1);});
test('switching the source board while preparing writing does not open the wrong document',async()=>{const {host,board,created}=fixture();board.prepareWriting=async()=>{board.file={path:'b.thoughtspace'}};host.openWriting=method('openWriting','async recordBoardVisit(',{SharedOpen});await assert.rejects(host.openWriting(board),/切换/);assert.equal(created(),0);});
test('failed openings are released and a later request can retry',async()=>{const opens=new SharedOpen<string,string>();let attempts=0;const fail=()=>{attempts++;return Promise.reject(Error('open failed'))};await Promise.all([assert.rejects(opens.run('a',fail),/failed/),assert.rejects(opens.run('a',fail),/failed/)]);assert.equal(attempts,1);assert.equal(await opens.run('a',async()=>{attempts++;return 'ready'}),'ready');assert.equal(attempts,2);assert.equal(await opens.run('a',async()=> 'new page'),'new page');});
test('different targets may open independently',async()=>{const opens=new SharedOpen<string,string>();assert.deepEqual(await Promise.all([opens.run('a',async()=> 'A'),opens.run('b',async()=> 'B')]),['A','B']);});
test('saving conflicts stop writing handoff without creating a new page',async()=>{const {host,board,created}=fixture();board.session.flush=async()=>{board.session.blocked=true};host.openWriting=method('openWriting','async recordBoardVisit(',{SharedOpen});await assert.rejects(host.openWriting(board),/暂停/);assert.equal(created(),0);});
test('two views of one board each commit their own draft before sharing the writing page',async()=>{const {host,board,created}=fixture();let first=0,second=0;board.prepareWriting=async()=>{first++};const other={...board,prepareWriting:async()=>{second++}};host.openWriting=method('openWriting','async recordBoardVisit(',{SharedOpen});const [a,b]=await Promise.all([host.openWriting(board),host.openWriting(other)]);assert.equal(a,b);assert.equal(first,1);assert.equal(second,1);assert.equal(created(),1);});

test('cancelled deferred board opening does not reveal or activate its leaf',async()=>{const {host,file,leaves}=fixture();host.openBoard=method('openBoard','openBoardOrganizer(',{SharedOpen});await host.openBoard(file);let resume!:()=>void,active=true,reveals=0,focus=0;leaves[0].loadIfDeferred=()=>new Promise<void>(r=>resume=r);host.app.workspace.revealLeaf=async()=>{reveals++;};host.app.workspace.setActiveLeaf=()=>{focus++;};const pending=host.openBoard(file,false,()=>active);for(let i=0;i<20&&typeof resume!=='function';i++)await Promise.resolve();assert.equal(typeof resume,'function','reach deferred native leaf after source validation');active=false;resume();await pending;assert.equal(reveals,0);assert.equal(focus,0);});

function provisionalFixture(){
 const f=fixture();f.host.openBoard=method('openBoard','openBoardOrganizer(',{SharedOpen});const events:string[]=[];const create=f.workspace.getLeaf;
 f.workspace.getLeaf=()=>{const leaf=create(),open=leaf.openFile;leaf.openFile=async(file:any,options:any)=>{events.push('open');assert.equal(options.active,false);await open(file);};return leaf;};
 const activate=f.workspace.setActiveLeaf;f.workspace.revealLeaf=async()=>{events.push('reveal');};f.workspace.setActiveLeaf=(leaf:any)=>{activate(leaf);events.push('activate');};return{...f,events};
}

test('provisional board loading marks before openFile and prepares without activation or geometry resume',async()=>{
 const f=provisionalFixture(),leaf=await f.host.openBoard(f.file,false,()=>true,true);assert.equal(f.created(),1);assert.equal(leaf,f.leaves[0]);assert.equal(leaf.view.automaticGeometryDeferred,true);assert.equal(leaf.view.resumeCalls,0);assert.deepEqual(f.events,['open']);
 await f.host.openBoard(f.file);assert.equal(f.created(),1);assert.equal(leaf.view.automaticGeometryDeferred,false);assert.equal(leaf.view.resumeCalls,1);assert.deepEqual(f.events,['open','reveal','activate']);
});

test('a provisional lookup does not pause an already loaded normal view',async()=>{
 const f=provisionalFixture();await f.host.openBoard(f.file);const leaf=f.leaves[0],resumes=leaf.view.resumeCalls;f.events.length=0;
 assert.equal(await f.host.openBoard(f.file,false,()=>true,true),leaf);assert.equal(leaf.view.automaticGeometryDeferred,false);assert.equal(leaf.view.resumeCalls,resumes);assert.equal(f.host.provisionalBoardGeometry.has(leaf),false);assert.deepEqual(f.events,[]);
});

test('a cancelled provisional caller cannot re-pause a normal caller sharing the same load',async()=>{
 const f=provisionalFixture();let active=true;const provisional=f.host.openBoard(f.file,false,()=>active,true),normal=f.host.openBoard(f.file);active=false;await Promise.all([provisional,normal]);const leaf=f.leaves[0];
 assert.equal(f.created(),1);assert.equal(leaf.view.automaticGeometryDeferred,false);assert.equal(leaf.view.resumeCalls,1);assert.deepEqual(f.events,['open','reveal','activate']);
});

test('two provisional requests share one load while cancellation never grants geometry permission',async()=>{
 const f=provisionalFixture();let active=true;const first=f.host.openBoard(f.file,false,()=>active,true),second=f.host.openBoard(f.file,false,()=>true,true);active=false;const [cancelled,leaf]=await Promise.all([first,second]);
 assert.equal(cancelled,undefined);assert.equal(leaf,f.leaves[0]);assert.equal(f.created(),1);assert.equal(leaf.view.automaticGeometryDeferred,true);assert.equal(leaf.view.resumeCalls,0);assert.deepEqual(f.events,['open']);
});

test('a provisional join does not change a normal load already authorized by another caller',async()=>{
 const f=provisionalFixture();const normal=f.host.openBoard(f.file),provisional=f.host.openBoard(f.file,false,()=>true,true);const [,leaf]=await Promise.all([normal,provisional]);assert.equal(f.created(),1);assert.equal(leaf.view.automaticGeometryDeferred,false);assert.equal(leaf.view.resumeCalls,1);assert.deepEqual(f.events,['open','reveal','activate']);
});

test('a failed deferred provisional load drops its unconsumed marker',async()=>{
 const f=provisionalFixture(),leaf=f.workspace.getLeaf();await leaf.setViewState({type:'board',state:{file:f.file.path}});leaf.loadIfDeferred=async()=>{assert.equal(f.host.provisionalBoardGeometry.get(leaf),f.file);throw Error('deferred load failed');};
 await assert.rejects(f.host.openBoard(f.file,false,()=>true,true),/deferred load failed/);assert.equal(f.host.provisionalBoardGeometry.has(leaf),false);assert.equal(leaf.view.resumeCalls,0);
});

test('replacing the target file while reveal waits cannot resume or focus the replacement',async()=>{
 const f=provisionalFixture(),leaf=await f.host.openBoard(f.file,false,()=>true,true);f.events.length=0;f.workspace.revealLeaf=async()=>{leaf.view.file={path:'replacement.thoughtspace'};};
 await f.host.openBoard(f.file,true);assert.equal(leaf.view.resumeCalls,0);assert.equal(leaf.view.fitCalls,0);assert.equal(leaf.view.automaticGeometryDeferred,true);assert.deepEqual(f.events,[]);
});

test('cancelling an explicit reveal of a provisional tab preserves its geometry pause',async()=>{
 const f=provisionalFixture(),leaf=await f.host.openBoard(f.file,false,()=>true,true);let active=true;f.events.length=0;f.workspace.revealLeaf=async()=>{active=false;};await f.host.openBoard(f.file,false,()=>active);
 assert.equal(leaf.view.resumeCalls,0);assert.equal(leaf.view.automaticGeometryDeferred,true);assert.deepEqual(f.events,[]);
});
