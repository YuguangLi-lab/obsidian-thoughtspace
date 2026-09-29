import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve as resolvePath} from 'node:path';
import {transformSync} from 'esbuild';
import {isRecord} from '../src/value-guards';
import {isWorkspaceFile} from '../src/workspace';
import {yingjianNotePath,yingjianLink,parseYingjianLink} from '../src/yingjian';
import {isVaultMediaPath,mediaKind,mediaTime} from '../src/media-source';
import {mediaNoteSource} from '../src/media-notes';
import {parseOnlineSource} from '../src/online-platform';
import {onlineNoteDocument,onlineNoteSource} from '../src/online-media-notes';

const main=readFileSync('src/main.ts','utf8'),parseYaml=createRequire(import.meta.url)('js-yaml').load;
const source='https://www.bilibili.com/video/BV1xx411c7mD/?p=2',other='https://www.bilibili.com/video/BV1xx411c7mD/';
const youtube='https://www.youtube.com/watch?v=dQw4w9WgXcQ',vaultId='abcdef0123456789abcd';
const MEDIA_WORKSPACE='local',ONLINE_WORKSPACE='online';
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const deferred=<T=void>()=>{let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
class TFile {stat={mtime:1,size:100};constructor(public path='课程.md'){}get extension(){return this.path.split('.').at(-1)!;}}
class FileSystemAdapter {getBasePath(){return '/Vault';}}
class OnlineWorkspaceView {
 leaf:any;movable=true;checks=0;state:any;constructor(path=source,placement='tab',note?:string){this.state={source:path,placement,note};}
 currentSource(){return parseOnlineSource(this.state.source);}currentNote(){return this.state.note;}getState(){return this.state;}canMove(){this.checks++;return this.movable;}
}
class MediaWorkspaceView {
 leaf:any;movable=true;checks=0;state:any;containerEl={querySelector:()=>undefined};
 constructor(public file=new TFile('clip.mp4'),placement='tab'){this.state={file:file.path,placement};}
 currentFile(){return this.file;}getState(){return this.state;}canMove(){this.checks++;return this.movable;}async setState(state:any){this.state=state;}resumePlayback(){}
}
const entryMethods=main.slice(main.indexOf('  private resolveLegacyMedia('),main.indexOf('  async openExcerptNote('));
const onlineMethod=main.slice(main.indexOf('  openOnlineWorkspace('),main.indexOf('  async sendOnlineToBoard('));
const localMethod=main.slice(main.indexOf('  openMediaWorkspace('),main.indexOf('  async sendMediaToBoard('));
const deps={parseYingjianLink,yingjianNotePath,TFile,isWorkspaceFile,isRecord,parseYaml,isVaultMediaPath,mediaKind,mediaTime,FileSystemAdapter,resolvePath,mediaNoteSource,parseOnlineSource,onlineNoteSource,OnlineWorkspaceView,MediaWorkspaceView,MEDIA_WORKSPACE,ONLINE_WORKSPACE,window:{setTimeout:(fn:()=>void)=>setTimeout(fn,0)}};
const compile=(methods:string)=>new Function(...Object.keys(deps),transformSync('class Harness {'+methods+'}\nreturn Harness;',{loader:'ts'}).code)(...Object.values(deps));
const Entry=compile(entryMethods),Workspace=compile(onlineMethod+localMethod);
function entryFixture(path=source){
 const file=new TFile(),contents=new Map([[file,`---\nsource: ${JSON.stringify(path)}\nvideo-note-id: course\n---\n`]]),files=new Map([[file.path,file]]),calls:any[][]=[],plugin=new Entry();
 plugin.app={vault:{adapter:new FileSystemAdapter(),read:async(f:TFile)=>contents.get(f)||'',getName:()=> 'Vault',getFiles:()=>[...files.values()],getAbstractFileByPath:(path:string)=>files.get(path)}};
 plugin.yingjianVaultId=()=>vaultId;plugin.openOnlineWorkspace=async(...args:any[])=>{calls.push(args);};
 plugin.resolveLegacyMedia=()=>{throw Error('Online sources must not become local TFiles');};plugin.openMediaWorkspace=()=>{throw Error('Online source must not enter local playback');};
 return{plugin,file,files,contents,calls};
}
function workspaceFixture(){
 const plugin=new Workspace(),leaves:any[]=[],created:any[]=[],events:any[][]=[],files=new Map<string,TFile>();let active:any;
 const makeLeaf=(view?:OnlineWorkspaceView|MediaWorkspaceView)=>{
  const leaf:any={view,type:view instanceof MediaWorkspaceView?MEDIA_WORKSPACE:ONLINE_WORKSPACE,detached:false,loadIfDeferred:async()=>{},setViewState:async(state:any)=>{
   events.push(['state',state]);leaf.type=state.type;leaf.view=state.type===ONLINE_WORKSPACE?new OnlineWorkspaceView(state.state.source,state.state.placement,state.state.note):new MediaWorkspaceView(files.get(state.state.file),state.state.placement);leaf.view.leaf=leaf;leaf.view.state=state.state;
  },detach:()=>{leaf.detached=true;const index=leaves.indexOf(leaf);if(index>=0)leaves.splice(index,1);events.push(['detach',leaf]);}};
  if(view)view.leaf=leaf;leaves.push(leaf);return leaf;
 };
 const workspace={getLeavesOfType:(type:string)=>leaves.filter(leaf=>leaf.type===type),getActiveViewOfType:(kind:any)=>active instanceof kind?active:undefined,getActiveFile:()=>undefined,
  getLeaf:(placement:string)=>{events.push(['create',placement]);const leaf=makeLeaf();created.push(leaf);return leaf;},getRightLeaf:()=>{events.push(['create','sidebar']);const leaf=makeLeaf();created.push(leaf);return leaf;},
  rightSplit:{expand:()=>events.push(['expand'])},revealLeaf:async(leaf:any)=>{events.push(['reveal',leaf]);},setActiveLeaf:(leaf:any,options:any)=>{active=leaf.view;events.push(['active',leaf,options]);}};
 plugin.app={workspace,vault:{getName:()=> 'Vault',getAbstractFileByPath:(path:string)=>files.get(path)}};plugin.mediaOpening=Promise.resolve();plugin.mediaClosed=false;
 plugin.mediaWorkspace={playback:{pauseAll:()=>events.push(['pause'])}};plugin.onlineMedia={notes:async(...args:any[])=>{events.push(['notes',...args]);return[];}};
 plugin.onlinePlatform={open:(...args:any[])=>{events.push(['open',...args]);plugin.onlineState={sourcePath:args[0],closed:false};},command:async(...args:any[])=>{events.push(['command',...args]);return true;},stop:()=>events.push(['stop'])};
 return{plugin,workspace,events,created,leaves,files,makeLeaf,setActive:(view:any)=>active=view};
}

test('legacy online note entry routes Bilibili and YouTube into online workspace with original note identity',async()=>{
 for(const path of [source,youtube]){const f=entryFixture(path);await f.plugin.openYingjian(f.file);assert.deepEqual(f.calls,[[path,'tab',undefined,f.file.path]]);}
 const f=entryFixture();f.contents.set(f.file,onlineNoteDocument(source));await f.plugin.openYingjian(f.file);assert.deepEqual(f.calls,[[source,'tab',undefined,f.file.path]]);
});
test('legacy online timestamp routes fractional time into online workspace without local file resolution',async()=>{
 for(const path of [source,youtube]){const f=entryFixture(path);await f.plugin.playYingjianTimestamp(yingjianLink(path,14.25,f.file.path,vaultId));assert.deepEqual(f.calls,[[path,'tab',14.25,f.file.path]]);}
});
test('legacy online timestamps retain note/vault provenance checks before routing',async()=>{
 for(const bad of ['vault','source','duplicate','replacement'] as const){
  const f=entryFixture(),url=yingjianLink(source,14,f.file.path,bad==='vault'?'11111111111111111111':vaultId);
  if(bad==='source')f.contents.set(f.file,onlineNoteDocument(other));
  if(bad==='replacement')f.plugin.app.vault.read=async()=>{f.files.set(f.file.path,new TFile(f.file.path));return f.contents.get(f.file);};
  await assert.rejects(f.plugin.playYingjianTimestamp(bad==='duplicate'?url+'&t=1':url));assert.equal(f.calls.length,0,bad);
 }
});
test('online first launch validates the note, opens one workspace and pauses local media',async()=>{
 const f=workspaceFixture();await f.plugin.openOnlineWorkspace(source,'sidebar',14.25,'课程.md');
 assert.equal(f.created.length,1);assert.deepEqual(f.created[0].view.state,{source,placement:'sidebar',note:'课程.md',time:14.25});
 assert.deepEqual(f.events.filter(e=>['notes','pause','open','expand'].includes(e[0])),[['notes',source,'课程.md'],['expand'],['pause'],['open',source,14.25]]);
 assert(f.events.findIndex(e=>e[0]==='reveal')<f.events.findIndex(e=>e[0]==='open'),'showing the pane must complete before changing playback');
});
test('same source focus preserves draft and player position without recreating the leaf',async()=>{
 const f=workspaceFixture(),view=new OnlineWorkspaceView(source,'tab','课程.md'),leaf=f.makeLeaf(view);view.movable=false;f.setActive(view);f.plugin.onlineState={sourcePath:source,closed:false};
 await f.plugin.openOnlineWorkspace(source);
 assert.equal(f.created.length,0);assert.equal(leaf.detached,false);assert.equal(view.checks,0);
 assert.deepEqual(f.events.filter(e=>e[0]==='command'),[['command',source,'focus']]);assert.equal(f.events.at(-1)?.[0],'active');
});
test('explicit fractional seek and share-link time use the existing window without reopening it',async()=>{
 for(const [input,time,expected] of [[source,0,0],[source,12.25,12.25],[source+'&t=1m2s',undefined,62]] as const){
  const f=workspaceFixture(),view=new OnlineWorkspaceView();f.makeLeaf(view);f.plugin.onlineState={sourcePath:source,closed:false};await f.plugin.openOnlineWorkspace(input,'tab',time);
  assert.deepEqual(f.events.filter(e=>e[0]==='command'),[['command',source,'seek',expected],['command',source,'focus']]);assert.equal(f.events.some(e=>e[0]==='open'),false);
 }
});
test('closed official window is reopened even when its note workspace already exists',async()=>{
 const f=workspaceFixture();f.makeLeaf(new OnlineWorkspaceView());f.plugin.onlineState={sourcePath:source,closed:true};await f.plugin.openOnlineWorkspace(source);
 assert.deepEqual(f.events.filter(e=>e[0]==='open'),[['open',source,0]]);assert.equal(f.created.length,0);
});
test('source, note and placement changes cannot abandon an online draft',async()=>{
 for(const [path,placement,note] of [[other,'tab',undefined],[source,'sidebar',undefined],[source,'tab','另一笔记.md']] as const){
  const f=workspaceFixture(),view=new OnlineWorkspaceView(source,'tab','课程.md');view.movable=false;f.makeLeaf(view);await f.plugin.openOnlineWorkspace(path,placement,undefined,note);
  assert.equal(f.created.length,0);assert.equal(f.events.length,0);assert.equal(view.checks,1);
 }
});
test('a deferred local draft is loaded and blocks online mode before playback mutates',async()=>{
 const f=workspaceFixture(),leaf=f.makeLeaf(new MediaWorkspaceView());leaf.view={};leaf.loadIfDeferred=async()=>{leaf.view=new MediaWorkspaceView();leaf.view.movable=false;};
 await f.plugin.openOnlineWorkspace(source);assert.equal(f.created.length,0);assert.equal(f.events.length,0);assert.equal(leaf.view.checks,1);
});
test('local opening of a new media source honors existing online draft guards',async()=>{
 const f=workspaceFixture(),view=new OnlineWorkspaceView(),file=new TFile('clip.mp4');view.movable=false;f.makeLeaf(view);f.files.set(file.path,file);
 await f.plugin.openMediaWorkspace(file);assert.equal(f.created.length,0);assert.equal(f.events.length,0);assert.equal(view.checks,1);
});
test('queued online requests serialize leaf creation and recover after earlier launch failure',async()=>{
 const f=workspaceFixture(),gate=deferred(),getLeaf=f.workspace.getLeaf;let first=true;
 f.workspace.getLeaf=(placement:string)=>{const leaf=getLeaf(placement);if(first){first=false;const setState=leaf.setViewState;leaf.setViewState=async(state:any)=>{await gate.promise;await setState(state);};}return leaf;};
 const a=f.plugin.openOnlineWorkspace(source),b=f.plugin.openOnlineWorkspace(youtube);await tick();assert.equal(f.created.length,1);assert.equal(f.events.some(e=>e[0]==='open'),false);
 gate.resolve();await Promise.all([a,b]);assert.deepEqual(f.events.filter(e=>e[0]==='open'),[['open',source,0],['open',youtube,0]]);assert.equal(f.created[0].detached,true);
 const failed=workspaceFixture();failed.plugin.onlinePlatform.open=()=>{throw Error('window launch failure');};await assert.rejects(failed.plugin.openOnlineWorkspace(source),/window launch failure/);assert.equal(failed.created[0].detached,true);
 failed.plugin.onlinePlatform.open=(...args:any[])=>failed.events.push(['open',...args]);await failed.plugin.openOnlineWorkspace(youtube);assert.deepEqual(failed.events.filter(e=>e[0]==='open'),[['open',youtube,0]]);
});
test('failed note validation and invalid explicit times leave player state unchanged',async()=>{
 const f=workspaceFixture();f.plugin.onlineMedia.notes=async()=>{throw Error('note changed');};await assert.rejects(f.plugin.openOnlineWorkspace(source,'tab',1,'课程.md'),/note changed/);assert.equal(f.events.length,0);
 for(const time of [-1,NaN,Infinity,864001]){const f=workspaceFixture();await assert.rejects(f.plugin.openOnlineWorkspace(source,'tab',time));assert.equal(f.events.length,0);}
});
test('draft changes during new pane setup preserve the old note and cancel platform launch',async()=>{
 const f=workspaceFixture(),view=new OnlineWorkspaceView(),old=f.makeLeaf(view),getLeaf=f.workspace.getLeaf;
 f.workspace.getLeaf=(placement:string)=>{const leaf=getLeaf(placement),setState=leaf.setViewState;leaf.setViewState=async(state:any)=>{await setState(state);view.movable=false;};return leaf;};
 await f.plugin.openOnlineWorkspace(other);assert.equal(f.created[0].detached,true);assert.equal(old.detached,false);assert.equal(f.events.some(e=>['pause','open','command'].includes(e[0])),false);
});
test('a local draft entered while online note validation waits blocks the mode switch',async()=>{
 const f=workspaceFixture(),view=new MediaWorkspaceView();f.makeLeaf(view);const gate=deferred();
 f.plugin.onlineMedia.notes=()=>gate.promise;
 const pending=f.plugin.openOnlineWorkspace(source,'tab',12,'课程.md');await tick();view.movable=false;gate.resolve();await pending;
 assert.equal(f.events.some(e=>['pause','open','command'].includes(e[0])),false);assert.equal(f.created.every(leaf=>leaf.detached),true);
});
test('an online draft entered while pane reveal waits keeps its original workspace alive',async()=>{
 const f=workspaceFixture(),view=new OnlineWorkspaceView(),old=f.makeLeaf(view),gate=deferred();
 f.workspace.revealLeaf=()=>gate.promise;
 const pending=f.plugin.openOnlineWorkspace(other);await tick();view.movable=false;gate.resolve();await pending;
 assert.equal(old.detached,false);assert.equal(f.created[0].detached,true);
});
test('plugin close during pane creation detaches provisional panes without launching media',async()=>{
 const f=workspaceFixture(),getLeaf=f.workspace.getLeaf;f.workspace.getLeaf=(placement:string)=>{const leaf=getLeaf(placement),setState=leaf.setViewState;leaf.setViewState=async(state:any)=>{await setState(state);f.plugin.mediaClosed=true;};return leaf;};
 await assert.rejects(f.plugin.openOnlineWorkspace(source),/已关闭/);assert.equal(f.created[0].detached,true);assert.equal(f.events.some(e=>['pause','open','command'].includes(e[0])),false);
});
test('adoption focuses the newly mounted player without resetting the adopted timestamp',async()=>{
 const f=workspaceFixture();f.plugin.onlineState={sourcePath:source,closed:false};await f.plugin.openOnlineWorkspace(source,'tab',12,undefined,true);assert.equal(f.events.some(e=>e[0]==='open'),false);assert.deepEqual(f.events.filter(e=>e[0]==='command'),[['command',source,'focus']]);
 const changed=workspaceFixture();changed.plugin.onlineState={sourcePath:other,closed:false};await assert.rejects(changed.plugin.openOnlineWorkspace(source,'tab',12,undefined,true),/已变化/);assert.equal(changed.created[0].detached,true);
});
