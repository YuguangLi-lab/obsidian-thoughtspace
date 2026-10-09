import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {resumeRecentBoard} from '../src/recent-board';
import {isBrainBoard} from '../src/brain-board';
import {createBrainBoard} from '../src/brain-board';

const source=readFileSync(process.env.CONVENIENCE_COMMAND_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a,start);return source.slice(a,b);}
class View {containerEl:any;}
class FileView extends View {file?:TFile;}
class BoardView extends FileView {session?:unknown;closed=false;}
class TFile {constructor(public path:string,public valid=true){}}
const notices:string[]=[];
class Notice {constructor(message:string){notices.push(message);}}
const Plugin=new Function('resumeRecentBoard','isBoardFile','View','FileView','BoardView','TFile','Notice',transformSync(`return class Plugin{${take('  openRecentBoard():','  openSpaceHub()')}}`,{loader:'ts'}).code)(resumeRecentBoard,(_app:unknown,file:TFile)=>file.valid,View,FileView,BoardView,TFile,Notice);
const CommandView=new Function('isBrainBoard','BoardView','VIEW',transformSync(`return class CommandView extends BoardView{${take('  brainRelationCommandTarget(checking','  inputCommandTarget():')}}`,{loader:'ts'}).code)(isBrainBoard,BoardView,'board');
function deferred(){let resolve!:()=>void;return{promise:new Promise<void>(done=>{resolve=done;}),resolve:()=>resolve()};}
function fixture(){
 const files=new Map<string,TFile>(),origin=new FileView(),doc={hasFocus:()=>true,defaultView:{closed:false}},opened:string[]=[],visits:string[]=[];origin.containerEl={ownerDocument:doc};origin.file=new TFile('Initial.md');
 let active:View=origin,fallback=0;
 const plugin=new Plugin();Object.assign(plugin,{settings:{hub:{recent:[]}},app:{vault:{getAbstractFileByPath:(path:string)=>files.get(path)},workspace:{containerEl:{ownerDocument:doc},getActiveViewOfType:(Type:typeof View)=>active instanceof Type?active:null}},
  openBoard:async(file:TFile,fit:boolean,current:()=>boolean)=>{assert.equal(fit,false);if(!current())return;if(file.path==='damaged')throw Error('invalid layout');opened.push(file.path);const board=new BoardView();board.file=file;board.session={};board.containerEl={ownerDocument:doc};active=board;},
  recordBoardVisit:async(file:TFile)=>visits.push(file.path),openSpaceHub:()=>{fallback++;}
 });notices.length=0;
 const recent=(paths:string[])=>{plugin.settings.hub.recent=paths.map(path=>({path,at:1}));};
 const file=(path:string,valid=true)=>{const value=new TFile(path,valid);files.set(path,value);return value;};
 return{plugin,origin,doc,files,file,recent,opened,visits,setActive:(view:View)=>{active=view;},active:()=>active,fallback:()=>fallback};
}
test('real resume host skips deleted, plain Markdown and damaged files without fitting the saved camera',async()=>{
 const f=fixture();f.file('plain.md',false);f.file('damaged');f.file('Brain.md');f.recent(['deleted','plain.md','damaged','Brain.md']);await f.plugin.openRecentBoard();
 assert.deepEqual(f.opened,['Brain.md']);assert.deepEqual(f.visits,['Brain.md']);assert.equal(f.fallback(),0);assert.equal(notices.length,1);assert.match(notices[0],/3/);
});
test('real resume host shares continuous invocations, clears inflight state and can retry after completion',async()=>{
 const f=fixture(),gate=deferred();f.file('Board.thoughtspace');f.recent(['Board.thoughtspace']);const original=f.plugin.openBoard;
 f.plugin.openBoard=async(...args:unknown[])=>{await gate.promise;return original(...args);};
 const first=f.plugin.openRecentBoard();assert.equal(f.plugin.openRecentBoard(),first);gate.resolve();await first;assert.deepEqual(f.opened,['Board.thoughtspace']);assert.equal(f.plugin.recentBoardOpening,undefined);
 await f.plugin.openRecentBoard();assert.equal(f.opened.length,2);
});
test('new navigation, window blur and unload while opening cancel without history updates or fallback',async()=>{
 for(const cancel of [(f:ReturnType<typeof fixture>)=>f.setActive(new View()),(f:ReturnType<typeof fixture>)=>{f.doc.hasFocus=()=>false;},(f:ReturnType<typeof fixture>)=>{f.plugin.recentBoardNavigationStopped=true;}]){
  const f=fixture(),gate=deferred();f.file('Board.md');f.recent(['Board.md']);const original=f.plugin.openBoard;f.plugin.openBoard=async(...args:unknown[])=>{await gate.promise;return original(...args);};
  const work=f.plugin.openRecentBoard();cancel(f);gate.resolve();await work;assert.deepEqual(f.opened,[]);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),0);assert.equal(notices.length,0);
 }
});
test('identity deletion or replacement during pending navigation does not open an unrelated board',async()=>{
 for(const replace of [false,true]){
  const f=fixture(),gate=deferred();f.file('Board.md');f.file('Other.md');f.recent(['Board.md','Other.md']);const original=f.plugin.openBoard;f.plugin.openBoard=async(...args:unknown[])=>{await gate.promise;return original(...args);};
  const work=f.plugin.openRecentBoard();if(replace)f.file('Board.md');else f.files.delete('Board.md');gate.resolve();await work;assert.deepEqual(f.opened,[]);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),0);
 }
});
test('same-view file navigation while the recent board is opening cancels activation and history writes',async()=>{
 const f=fixture(),gate=deferred();f.file('Board.md');f.recent(['Board.md']);const original=f.plugin.openBoard;f.plugin.openBoard=async(...args:unknown[])=>{await gate.promise;return original(...args);};
 const work=f.plugin.openRecentBoard();f.origin.file=new TFile('Latest navigation.md');gate.resolve();await work;assert.deepEqual(f.opened,[]);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),0);
});
test('all invalid records and empty history give an explicit hub fallback without file creation',async()=>{
 for(const paths of [[],['deleted','plain.md','damaged']]){const f=fixture();f.file('plain.md',false);f.file('damaged');f.recent(paths);await f.plugin.openRecentBoard();assert.deepEqual(f.opened,[]);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),1);assert.equal(notices.length,1);assert.match(notices[0],/空间总览/);}
});
test('a failed board mount is skipped while an error saving recent preferences never changes the successful target',async()=>{
 const f=fixture();f.file('mount-failed');f.file('Good.md');f.recent(['mount-failed','Good.md']);const original=f.plugin.openBoard;f.plugin.openBoard=async(file:TFile,...args:unknown[])=>{if(file.path==='mount-failed')return;return original(file,...args);};
 await f.plugin.openRecentBoard();assert.deepEqual(f.opened,['Good.md']);
 f.plugin.recordBoardVisit=async()=>{throw Error('preferences failed');};await assert.rejects(f.plugin.openRecentBoard(),/preferences failed/);assert.deepEqual(f.opened,['Good.md','Good.md']);assert.equal(f.fallback(),0);
});
function brainFixture(){
 const view=new CommandView(),doc={},owner={board:createBrainBoard('center'),blocked:false},calls:string[]=[],target={editing:false,canRun:()=>true,run:(side:string)=>calls.push(side)},brain={relationCommandTarget:()=>target},leaf={view};
 let active:unknown=view;const leaves=[leaf];
 Object.assign(view,{session:owner,brainBoardView:brain,contentEl:{ownerDocument:doc},leaf,app:{workspace:{getActiveViewOfType:()=>active,getLeavesOfType:()=>leaves}}});
 return{view,owner,brain,doc,leaf,leaves,target,calls,setActive:(next:unknown)=>{active=next;}};
}
test('real brain host suppresses active dialogs, gesture/inline state, readonly, stale owners and cross-window editors',()=>{
 const f=brainFixture(),target=f.view.brainRelationCommandTarget();assert.ok(target);
 for(const key of ['closed','closing','inline','inlineTarget','gesture','marquee','rightMarquee','linkDrag','brainRelationCreating','localRelationEditBusy','localRelationEditing']){
  f.view[key]=true;assert.equal(target.canRun('top'),false,key);target.run('top');f.view[key]=false;
 }
 f.view.brainBoardDialog={containerEl:{isConnected:true}};assert.equal(target.canRun('top'),false);delete f.view.brainBoardDialog;
 f.owner.blocked=true;assert.equal(target.canRun('top'),false);f.owner.blocked=false;f.setActive({});assert.equal(target.canRun('top'),false);f.setActive(f.view);
 const other=new BoardView();Object.assign(other,{session:f.owner,localRelationEditing:true});f.leaves.push({view:other});assert.equal(target.canRun('top'),false);f.leaves.pop();
 f.view.session={...f.owner};assert.equal(target.canRun('top'),false);f.view.session=f.owner;
 target.run('right');assert.deepEqual(f.calls,['right']);
});
test('ordinary whiteboards never receive independent brain command targets',()=>{
 const f=brainFixture();delete (f.owner.board as {presentation?:string}).presentation;assert.equal(f.view.brainRelationCommandTarget(),undefined);
});
