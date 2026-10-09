import {resolveSourceLink} from '../src/excerpt-sources';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,History,parseBoard,type Board} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {mediaCard,mediaClock,mediaKind,mediaTime} from '../src/media-source';
import {mediaPlayerUrl} from '../src/media-notes';

const source=readFileSync('src/main.ts','utf8');
function method(start:string){const at=source.indexOf(start);assert.ok(at>=0,start);const rest=source.slice(at+start.length),end=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(rest);assert.ok(end,`end: ${start}`);return source.slice(at,at+start.length+end.index);}
class TFile {stat={mtime:1,size:100};constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}}
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
type Placement='tab'|'sidebar'|'window';
function opening(){
 const a=new TFile('media/A.mp4'),b=new TFile('media/B.mp3'),files=new Map([a,b].map(file=>[file.path,file]));
 const leaves:Leaf[]=[],onlineLeaves:OnlineLeaf[]=[],shared=new Map<string,number>(),calls={create:[] as string[],set:[] as string[],reveal:[] as Leaf[],activate:[] as {leaf:Leaf;focus:boolean}[],pause:0,expand:0,onlineStop:0};
 let active:View|OnlineView|undefined,activeFile:TFile|undefined;
 let beforeSet:((leaf:Leaf,state:any)=>Promise<void>)|undefined,beforeReveal:((leaf:Leaf)=>Promise<void>)|undefined;
 class View {
  file?:TFile;placement:Placement='tab';time=0;paused=true;blocked=false;resumes=0;closed=false;states:any[]=[];
  containerEl={querySelector:()=>this.file?{paused:this.paused}:undefined};
  constructor(public leaf:Leaf){}
  currentFile(){return this.file;}
  getState(){return{file:this.file?.path,placement:this.placement,time:this.time};}
  canMove(){return!this.blocked;}
  async setState(state:any){this.states.push({...state});const next=files.get(state.file);this.time=state.time??(this.file===next?this.time:shared.get(state.file)||0);this.file=next;this.placement=state.placement;}
  resumePlayback(){this.resumes++;this.paused=false;}
 }
 class Leaf {
  view:View;attached=true;detaches=0;
  constructor(public where:Placement){this.view=new View(this);leaves.push(this);}
  async setViewState(state:any){calls.set.push(state.state.file||'empty');await beforeSet?.(this,state);await this.view.setState(state.state);if(state.active)active=this.view;}
  detach(){this.detaches++;this.attached=false;this.view.closed=true;if(active===this.view)active=undefined;}
 }
 class OnlineView {
  blocked=false;closed=false;draft='';
  constructor(public leaf:OnlineLeaf){}
  canMove(){return!this.blocked;}
 }
 class OnlineLeaf {
  view:OnlineView;attached=true;detaches=0;loads=0;
  constructor(){this.view=new OnlineView(this);onlineLeaves.push(this);}
  async loadIfDeferred(){this.loads++;}
  detach(){this.detaches++;this.attached=false;this.view.closed=true;if(active===this.view)active=undefined;}
 }
 const workspace={
  getLeavesOfType:(type:string)=>type==='thoughtspace-media-player'?leaves.filter(leaf=>leaf.attached):type==='thoughtspace-online-player'?onlineLeaves.filter(leaf=>leaf.attached):[],getActiveViewOfType:(Type:typeof View)=>active instanceof Type?active:undefined,getActiveFile:()=>activeFile,
  getLeaf:(where:Placement)=>{calls.create.push(where);return new Leaf(where);},getRightLeaf:()=>{calls.create.push('sidebar');return new Leaf('sidebar');},
  rightSplit:{expand:()=>calls.expand++},revealLeaf:async(leaf:Leaf)=>{calls.reveal.push(leaf);await beforeReveal?.(leaf);},
  setActiveLeaf:(leaf:Leaf,options:{focus:boolean})=>{calls.activate.push({leaf,focus:options.focus});active=leaf.view;},
 };
 const deps={MediaWorkspaceView:View,MEDIA_WORKSPACE:'thoughtspace-media-player',OnlineWorkspaceView:OnlineView,ONLINE_WORKSPACE:'thoughtspace-online-player',TFile,isWorkspaceFile,mediaKind,mediaTime};
 const Plugin=new Function(...Object.keys(deps),transformSync(`class Plugin{${method('  openMediaWorkspace(')}};return Plugin`,{loader:'ts'}).code)(...Object.values(deps));
 const plugin=new Plugin();Object.assign(plugin,{mediaOpening:Promise.resolve(),mediaClosed:false,app:{workspace,vault:{getAbstractFileByPath:(path:string)=>files.get(path)}},onlinePlatform:{stop:()=>{calls.onlineStop++;}},mediaWorkspace:{playback:{pauseAll:()=>{calls.pause++;for(const leaf of leaves.filter(leaf=>leaf.attached)){const v=leaf.view;if(v.file)shared.set(v.file.path,v.time);v.paused=true;}}}}});
 const existing=(file:TFile|undefined=a,placement:Placement='tab',time=24)=>{const leaf=new Leaf(placement);leaf.view.file=file;leaf.view.placement=placement;leaf.view.time=time;active=leaf.view;return leaf;};
 const online=()=>{const leaf=new OnlineLeaf();active=leaf.view;return leaf;};
 return{a,b,files,leaves,onlineLeaves,calls,plugin,existing,online,get activeView(){return active;},setActiveView:(view?:View)=>{active=view;},setActiveFile:(file:TFile)=>{activeFile=file;},setBeforeSet:(fn:typeof beforeSet)=>{beforeSet=fn;},setBeforeReveal:(fn:typeof beforeReveal)=>{beforeReveal=fn;}};
}

for(const placement of ['tab','sidebar','window'] as const)test(`opening ${placement} uses its native leaf and never autoplays the first open`,async()=>{
 const f=opening();await f.plugin.openMediaWorkspace(f.a,placement);assert.deepEqual(f.calls.create,[placement]);assert.equal(f.leaves[0].view.file,f.a);assert.equal(f.leaves[0].view.placement,placement);assert.equal(f.leaves[0].view.resumes,0);assert.equal(f.calls.expand,placement==='sidebar'?1:0);
});
test('same media and placement reuse the view without resetting its current timestamp',async()=>{
 const f=opening(),leaf=f.existing(f.a,'sidebar',39.125);await f.plugin.openMediaWorkspace(undefined,'sidebar');assert.equal(f.calls.create.length,0);assert.equal(f.calls.pause,0);assert.equal(leaf.view.time,39.125);assert.equal(leaf.view.states.length,0);assert.equal(f.calls.expand,1);
 await f.plugin.openMediaWorkspace(f.a,'sidebar',6.25);assert.equal(leaf.view.time,6.25);assert.equal(leaf.view.states.length,1);assert.equal(leaf.detaches,0);
});
test('a timestamp link to an existing hidden media tab explicitly activates it after seeking',async()=>{
 const f=opening(),leaf=f.existing(f.a,'tab',4);f.setActiveView();f.setActiveFile(new TFile('Boards/current.thoughtspace'));
 await f.plugin.openMediaWorkspace(f.a,'tab',7.25);
 assert.equal(leaf.view.time,7.25);assert.equal(f.activeView,leaf.view);assert.deepEqual(f.calls.activate,[{leaf,focus:true}]);assert.deepEqual(f.calls.reveal,[leaf]);assert.equal(f.calls.create.length,0);assert.equal(f.calls.pause,0);
});
for(const closing of ['plugin','leaf'] as const)test(`closing the ${closing} while revealing an existing media tab does not focus it afterward`,async()=>{
 const f=opening(),leaf=f.existing(f.a,'tab',4),entered=deferred(),resume=deferred();f.setActiveView();
 f.setBeforeReveal(async()=>{entered.resolve();await resume.promise;});const pending=f.plugin.openMediaWorkspace(f.a,'tab',7.25);await entered.promise;
 if(closing==='plugin')f.plugin.mediaClosed=true;else leaf.detach();resume.resolve();await pending;
 assert.equal(f.calls.activate.length,0);assert.equal(f.activeView,undefined);assert.equal(f.calls.create.length,0);
});
test('tab to sidebar to popout transfers the current file and position and resumes only an already-playing source',async()=>{
 const f=opening(),old=f.existing(f.a,'tab',44.5);old.view.paused=false;await f.plugin.openMediaWorkspace(undefined,'sidebar');const sidebar=f.leaves.at(-1)!;
 assert.equal(old.detaches,1);assert.equal(sidebar.view.time,44.5);assert.equal(sidebar.view.resumes,1);
 await f.plugin.openMediaWorkspace(undefined,'window');const window=f.leaves.at(-1)!;assert.equal(sidebar.detaches,1);assert.equal(window.view.time,44.5);assert.equal(window.view.resumes,1);assert.equal(f.leaves.filter(leaf=>leaf.attached).length,1);
});
test('a different media in the same placement uses a temporary leaf without inheriting playback',async()=>{
 const f=opening(),old=f.existing(f.a,'tab',30);old.view.paused=false;await f.plugin.openMediaWorkspace(f.b,'tab');const next=f.leaves.at(-1)!;assert.deepEqual(f.calls.create,['tab']);assert.equal(old.detaches,1);assert.equal(old.view.file,f.a);assert.equal(next.view.file,f.b);assert.equal(next.view.resumes,0);assert.equal(next.view.time,0);
});
test('explicit seek overrides remembered time when moving between placements',async()=>{
 const f=opening();f.existing(f.a,'tab',55);await f.plugin.openMediaWorkspace(f.a,'window',3);assert.equal(f.leaves.at(-1)!.view.time,3);assert.equal(f.leaves.at(-1)!.view.resumes,0);
});
test('unsaved drafts block media and placement changes before any decoder pause or leaf allocation',async()=>{
 const f=opening(),old=f.existing();old.view.blocked=true;await f.plugin.openMediaWorkspace(f.b,'tab');await f.plugin.openMediaWorkspace(f.a,'window');assert.deepEqual(f.calls.create,[]);assert.equal(f.calls.pause,0);assert.equal(old.view.file,f.a);assert.equal(old.detaches,0);
});
test('parallel open requests serialize rather than creating competing destination windows',async()=>{
 const f=opening(),gate=deferred();let first=true;f.setBeforeSet(async()=>{if(first){first=false;await gate.promise;}});
 const a=f.plugin.openMediaWorkspace(f.a,'sidebar'),b=f.plugin.openMediaWorkspace(f.b,'window');await turn();assert.deepEqual(f.calls.create,['sidebar']);gate.resolve();await Promise.all([a,b]);
 assert.deepEqual(f.calls.create,['sidebar','window']);assert.equal(f.leaves.filter(leaf=>leaf.attached).length,1);assert.equal(f.leaves.at(-1)!.view.file,f.b);
});
test('failed destination setup preserves and resumes the previous playing view, then the queue recovers',async()=>{
 const f=opening(),old=f.existing();old.view.paused=false;f.setBeforeSet(async()=>{throw Error('window setup failed');});await assert.rejects(f.plugin.openMediaWorkspace(f.a,'window'));
 assert.equal(old.attached,true);assert.equal(old.detaches,0);assert.equal(old.view.resumes,1);assert.equal(f.leaves.at(-1)!.attached,false);
 f.setBeforeSet(undefined);await f.plugin.openMediaWorkspace(f.a,'sidebar');assert.equal(f.leaves.at(-1)!.attached,true);assert.equal(old.detaches,1);
});
test('failed reveal preserves the previous view and closes the incomplete destination',async()=>{
 const f=opening(),old=f.existing();old.view.paused=false;f.setBeforeReveal(async()=>{throw Error('reveal failed');});await assert.rejects(f.plugin.openMediaWorkspace(f.a,'window'));assert.equal(old.detaches,0);assert.equal(old.attached,true);assert.equal(old.view.resumes,1);assert.equal(f.leaves.at(-1)!.detaches,1);
});
test('same-placement partial setup then failed reveal preserves the original source and position',async()=>{
 const f=opening(),old=f.existing(f.a,'tab',42);old.view.paused=false;f.setBeforeReveal(async()=>{throw Error('failed reveal after B mounted');});await assert.rejects(f.plugin.openMediaWorkspace(f.b,'tab'));
 assert.equal(old.attached,true);assert.equal(old.view.file,f.a);assert.equal(old.view.time,42);assert.equal(old.detaches,0);assert.equal(old.view.resumes,1);assert.equal(f.leaves.at(-1)!.view.file,f.b);assert.equal(f.leaves.at(-1)!.attached,false);
});
test('unloading during a rejected setup or reveal cannot restart the previous decoder',async()=>{
 for(const phase of ['setup','reveal']){const f=opening(),old=f.existing();old.view.paused=false;const fail=async()=>{f.plugin.mediaClosed=true;throw Error('unloaded');};if(phase==='setup')f.setBeforeSet(fail);else f.setBeforeReveal(fail);await assert.rejects(f.plugin.openMediaWorkspace(f.b,'tab'));assert.equal(old.view.resumes,0,phase);assert.equal(old.detaches,0,phase);assert.equal(f.leaves.at(-1)!.attached,false,phase);}
});
test('queued requests revalidate exact file identity and reject renamed or replaced media',async()=>{
 for(const change of ['rename','replace','delete']){const f=opening(),gate=deferred();f.plugin.mediaOpening=gate.promise;const pending=f.plugin.openMediaWorkspace(f.a,'window');if(change==='rename')f.a.path='media/moved.mp4';if(change==='replace')f.files.set(f.a.path,new TFile(f.a.path));if(change==='delete')f.files.delete(f.a.path);gate.resolve();await assert.rejects(pending,change);assert.deepEqual(f.calls.create,[]);}
});
test('plugin close before processing or during destination setup cannot resume or replace the old leaf',async()=>{
 const closed=opening();closed.plugin.mediaClosed=true;await closed.plugin.openMediaWorkspace(closed.a,'tab');assert.deepEqual(closed.calls.create,[]);
 const f=opening(),old=f.existing();old.view.paused=false;f.setBeforeSet(async()=>{f.plugin.mediaClosed=true;});await f.plugin.openMediaWorkspace(f.a,'window');assert.equal(old.detaches,0);assert.equal(f.leaves.at(-1)!.detaches,1);assert.equal(f.leaves.at(-1)!.view.resumes,0);
});
test('plugin close during reveal must not retire the old leaf or resume the new player',async()=>{
 const f=opening(),old=f.existing();old.view.paused=false;f.setBeforeReveal(async()=>{f.plugin.mediaClosed=true;});await f.plugin.openMediaWorkspace(f.a,'window');assert.equal(old.detaches,0);assert.equal(f.leaves.at(-1)!.view.resumes,0);assert.equal(f.leaves.at(-1)!.attached,false);
});

test('an online draft prevents a new local player from pausing playback, allocating a leaf or stopping its window',async()=>{
 const f=opening(),online=f.online();online.view.blocked=true;online.view.draft='保留在线摘录';
 await f.plugin.openMediaWorkspace(f.a,'tab');
 assert.deepEqual(f.calls.create,[]);assert.equal(f.calls.pause,0);assert.equal(f.calls.onlineStop,0);assert.equal(online.attached,true);assert.equal(online.view.draft,'保留在线摘录');assert.equal(f.activeView,online.view);
});
test('a deferred online workspace must load before its draft guard can allow local navigation',async()=>{
 const f=opening(),online=f.online(),restored=online.view;restored.blocked=true;restored.draft='恢复的在线草稿';
 online.view={} as typeof restored;online.loadIfDeferred=async()=>{online.loads++;online.view=restored;};
 await f.plugin.openMediaWorkspace(f.a,'tab');
 assert.equal(online.loads,1);assert.deepEqual(f.calls.create,[]);assert.equal(f.calls.onlineStop,0);assert.equal(online.attached,true);assert.equal(restored.draft,'恢复的在线草稿');
});
test('an online draft also blocks revealing and seeking an already open local player',async()=>{
 const f=opening(),local=f.existing(f.a,'tab',24),online=f.online();online.view.blocked=true;online.view.draft='保留在线摘录';
 await f.plugin.openMediaWorkspace(f.a,'tab',77);
 assert.equal(local.view.time,24);assert.deepEqual(f.calls.reveal,[]);assert.deepEqual(f.calls.activate,[]);assert.equal(f.calls.onlineStop,0);assert.equal(f.activeView,online.view);assert.equal(online.view.draft,'保留在线摘录');
});
for(const placement of ['tab','sidebar','window']as const)test(`switching an online workspace to a new local ${placement} stops the platform only after reveal succeeds`,async()=>{
 const f=opening(),online=f.online();f.setBeforeReveal(async()=>{assert.equal(f.calls.onlineStop,0);});
 await f.plugin.openMediaWorkspace(f.a,placement);
 assert.equal(f.calls.onlineStop,1);assert.equal(f.leaves.at(-1)!.view.file,f.a);assert.equal(f.leaves.at(-1)!.attached,true);assert.equal(online.attached,true);assert.equal(online.view.closed,false);
});
test('switching back to an existing local tab stops the online platform without rebuilding the local player',async()=>{
 const f=opening(),local=f.existing(f.a,'tab',31),online=f.online();
 await f.plugin.openMediaWorkspace(f.a,'tab');
 assert.equal(f.calls.onlineStop,1);assert.deepEqual(f.calls.create,[]);assert.equal(f.calls.pause,0);assert.equal(local.view.time,31);assert.equal(local.view.states.length,0);assert.equal(f.activeView,local.view);assert.equal(online.attached,true);
});
for(const phase of ['setup','reveal']as const)test(`a failed local ${phase} leaves the online window and notes available`,async()=>{
 const f=opening(),online=f.online(),fail=async()=>{throw Error('local opening failed');};if(phase==='setup')f.setBeforeSet(fail);else f.setBeforeReveal(fail);
 await assert.rejects(f.plugin.openMediaWorkspace(f.a,'window'));
 assert.equal(f.calls.onlineStop,0);assert.equal(online.attached,true);assert.equal(online.detaches,0);assert.equal(f.leaves.at(-1)!.attached,false);
});
for(const phase of ['setup','reveal']as const)test(`an online draft started during local ${phase} keeps the platform and retires the temporary player`,async()=>{
 const f=opening(),online=f.online(),startDraft=async()=>{online.view.blocked=true;online.view.draft='打开过程中新增的摘录';};if(phase==='setup')f.setBeforeSet(startDraft);else f.setBeforeReveal(startDraft);
 await f.plugin.openMediaWorkspace(f.a,'window');
 assert.equal(f.calls.onlineStop,0);assert.equal(online.attached,true);assert.equal(online.view.draft,'打开过程中新增的摘录');assert.equal(f.leaves.at(-1)!.attached,false);
});

function board(){
 let id=0,changes=0;const media=new TFile('media/clip #[1].mp4'),files=new Map([[media.path,media]]),history=new History();
 const owner={board:{...emptyBoard(),version:3 as const,viewport:{x:33,y:44,zoom:.75}} as Board,blocked:false,refreshNativeEditing(){},change(fn:(board:Board)=>void){const before=structuredClone(this.board);fn(this.board);parseBoard(JSON.stringify(this.board));history.push(before);changes++;}};
 const deps={resolveSourceLink,mediaKind,isWorkspaceFile,mediaTime,mediaCard,mediaClock,mediaPlayerUrl,uid:()=>`new-${++id}`};
 const View=new Function(...Object.keys(deps),transformSync(`class View{${method('  private refreshMediaReferences(')}\n${method('  async addWorkspaceMedia(')}\n${method('  private requireOwner(')}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View();Object.assign(view,{session:owner,closed:false,selected:new Set(['old']),selectedEdge:'old-edge',point:()=>({x:400,y:250}),updateSelection:()=>{},app:{vault:{getName:()=> 'vault',getAbstractFileByPath:(path:string)=>files.get(path)}},plugin:{settings:{defaultCardWidth:320,defaultTextSize:18,defaultEdgeStyle:'curve'},mediaWorkspace:{identity:(file:TFile)=>file.path,playback:{get:()=>({time:8,rate:1,volume:1})}}}});
 return{view,owner,media,files,history,changes:()=>changes};
}
test('adding media with an excerpt is one undoable transaction without moving the camera',async()=>{
 const f=board(),before=structuredClone(f.owner.board),camera=f.owner.board.viewport;await f.view.addWorkspaceMedia(f.media,{id:'moment',time:12.125,text:'**note**',image:'![[frame.png]]',line:1});
 assert.equal(f.changes(),1);assert.equal(f.owner.board.viewport,camera);assert.deepEqual(camera,before.viewport);assert.equal(f.owner.board.nodes.length,2);assert.equal(f.owner.board.edges.length,1);
 assert.equal(f.owner.board.nodes[0].mediaStart,12.125);assert.match(f.owner.board.nodes[1].text!,/!\[\[frame.png\]\][\s\S]*\*\*note\*\*[\s\S]*thoughtspace-player/);assert.equal(f.view.selectedEdge,undefined);assert.deepEqual(f.history.undo(f.owner.board),before);
});
test('a repeated media selection adds no card or undo item and clears stale edge selection',async()=>{
 const f=board();await f.view.addWorkspaceMedia(f.media);const id=f.owner.board.nodes[0].id;f.view.selectedEdge='old-edge';await f.view.addWorkspaceMedia(f.media);assert.equal(f.owner.board.nodes.length,1);assert.equal(f.changes(),1);assert.deepEqual([...f.view.selected],[id]);assert.equal(f.view.selectedEdge,undefined);
});
test('an excerpt reuses an existing media card and leaves its source timestamp unchanged',async()=>{
 const f=board();await f.view.addWorkspaceMedia(f.media);const node=f.owner.board.nodes[0];await f.view.addWorkspaceMedia(f.media,{id:'moment',time:70,text:'later',line:1});assert.equal(f.owner.board.nodes.filter(n=>n.kind==='video').length,1);assert.equal(node.mediaStart,8);assert.equal(f.owner.board.edges[0].from,node.id);assert.equal(f.owner.board.edges[0].label,'1:10');
});
test('inline conflicts and failed commits make no board or selection changes',async()=>{
 for(const failure of ['conflict','throw']){const f=board(),before=structuredClone(f.owner.board);f.view.inline={commit:async()=>{if(failure==='throw')throw Error('conflict');return false;}};if(failure==='throw')await assert.rejects(f.view.addWorkspaceMedia(f.media));else await f.view.addWorkspaceMedia(f.media);assert.deepEqual(f.owner.board,before);assert.equal(f.changes(),0);assert.deepEqual([...f.view.selected],['old']);}
});
test('media insertion revalidates file and owner after an asynchronous inline commit',async()=>{
 for(const change of ['switched','closed','blocked','rename','replace','delete','mtime','size']){const f=board(),before=structuredClone(f.owner.board),gate=deferred<boolean>();f.view.inline={commit:()=>gate.promise};const adding=f.view.addWorkspaceMedia(f.media);
  if(change==='switched')f.view.session={};if(change==='closed')f.view.closed=true;if(change==='blocked')f.owner.blocked=true;if(change==='rename')f.media.path='media/moved.mp4';if(change==='replace')f.files.set(f.media.path,new TFile(f.media.path));if(change==='delete')f.files.delete(f.media.path);if(change==='mtime')f.media.stat.mtime++;if(change==='size')f.media.stat.size++;
  gate.resolve(true);await assert.rejects(adding,change);assert.deepEqual(f.owner.board,before,change);assert.equal(f.changes(),0,change);
 }
});


test('moving the same media keeps layout preferences without copying stale playback time',async()=>{
 const f=opening(),old=f.existing(f.a,'tab',44);const state=old.view.getState.bind(old.view);
 old.view.getState=()=>({...state(),time:2,focusPlayer:false,recordPanel:'timeline',compactPlayer:true,viewerRatio:64,recordDensity:'compact'});
 await f.plugin.openMediaWorkspace(f.a,'sidebar');const next=f.leaves.at(-1)!.view;
 assert.equal(next.time,44);assert.equal(next.states[0].time,undefined);
 for(const[key,value]of Object.entries({focusPlayer:false,recordPanel:'timeline',compactPlayer:true,viewerRatio:64,recordDensity:'compact'}))assert.equal(next.states[0][key],value,key);
});
test('opening another media does not inherit the previous file focused or collapsed layout',async()=>{
 const f=opening(),old=f.existing(f.a,'tab',44);const state=old.view.getState.bind(old.view);
 old.view.getState=()=>({...state(),compactPlayer:true,viewerRatio:64,focusPlayer:true});await f.plugin.openMediaWorkspace(f.b,'sidebar');
 const next=f.leaves.at(-1)!.view;assert.equal(next.states[0].compactPlayer,undefined);assert.equal(next.states[0].focusPlayer,undefined);assert.equal(next.time,0);
});

test('saved excerpt reference stores only a native embed and repeated insertion selects the same node',async()=>{
 const f=board(),moment={id:'saved',time:12,text:'should not be copied',image:'![[frame.png]]',line:1},reference='![[notes/media.md#^thoughtspace-media-saved]]';
 await f.view.addWorkspaceMedia(f.media,moment,reference);assert.equal(f.owner.board.nodes[1].text,reference);assert.equal(f.owner.board.nodes[1].text!.includes(moment.text),false);
 const count=f.changes(),id=f.owner.board.nodes[1].id;await f.view.addWorkspaceMedia(f.media,moment,reference);assert.equal(f.changes(),count);assert.equal(f.owner.board.nodes.length,2);assert.deepEqual([...f.view.selected],[id]);
});


test('source metadata refresh invalidates only matching media block previews without board writes',()=>{
 const f=board(),note=new TFile('notes/source.md');f.owner.board.nodes=[{id:'linked',kind:'text',text:'![[notes/source.md#^thoughtspace-media-record]]',x:0,y:0,width:300,height:180,color:'slate'},{id:'other',kind:'text',text:'![[notes/other.md#^thoughtspace-media-record]]',x:0,y:0,width:300,height:180,color:'slate'}];
 f.view.file={path:'board.thoughtspace'};f.view.nodeKeys=new Map([['linked','old'],['other','keep']]);let renders=0;f.view.scheduleRender=()=>{renders++;};f.view.app.metadataCache={getFirstLinkpathDest:(path:string)=>path===note.path?note:undefined};
 f.view.refreshMediaReferences(note);assert.equal(f.view.nodeKeys.has('linked'),false);assert.equal(f.view.nodeKeys.get('other'),'keep');assert.equal(renders,1);assert.equal(f.changes(),0);f.view.gesture={};f.view.nodeKeys.set('linked','old');f.view.refreshMediaReferences(note);assert.equal(f.view.nodeKeys.has('linked'),false);assert.equal(renders,1);
});
