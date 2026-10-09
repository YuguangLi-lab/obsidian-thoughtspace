import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const BRIDGE=Symbol.for('thoughtspace.native-editor-reload-bridge.v1');
const production=transformSync(readFileSync('src/board-editor-ownership.ts','utf8'),{loader:'ts',format:'cjs'}).code;
class File {constructor(public path:string){}}
interface Tracking {owners:Map<File,Set<unknown>>;waiting:Set<File>;listeners:Set<unknown>;timer?:number;clock?:unknown;}
interface Api {hasNativeBoardEditor:(app:unknown,file:File)=>boolean;assertBoardEditorOwnership:(app:unknown,file:File)=>void;clearNativeBoardEditorTracking:(app:unknown)=>void;subscribeNativeBoardEditorDrains:(app:unknown,callback:(file:File)=>void)=>()=>void;__state:(app:unknown)=>Tracking|undefined;}
interface WeakEntry {file:WeakRef<File>;view:WeakRef<object>;}

function fixture(){
 const realm:Record<symbol,unknown>={},timers=new Map<number,()=>void>();let timerId=0,saves=0,reads=0,getters=0;
 const clock=Object.assign(realm,{setTimeout:(run:()=>void)=>{timers.set(++timerId,run);return timerId;},clearTimeout:(id:number)=>timers.delete(id)});
 const file=new File('Boards/Synthetic.md'),files=new Map([[file.path,file]]);
 class MarkdownView {
  file:File|null=file;saving=false;saveAgain=false;
  getViewData(){reads++;throw Error('a retired buffer must never be read');}
  async save(){saves++;throw Error('a retired buffer must never be saved');}
 }
 const view=new MarkdownView(),leaf={view,isDeferred:false,getViewState:()=>({type:'markdown',state:{file:file.path}})},leaves=[leaf];
 const app={workspace:{containerEl:{ownerDocument:{defaultView:clock}},getLeavesOfType:()=>leaves},vault:{getAbstractFileByPath:(path:string)=>files.get(path)}};
 const load=():Api=>{
  const module={exports:{} as Api};
  // Each call evaluates an independent production bundle. They share only the
  // same workspace owner Window/App and actual host object identities, as plugin
  // reload does. The owner Window also supplies the real tracking clock boundary.
  new Function('require','module','exports',production+'\nmodule.exports.__state=app=>tracking.get(app);')(()=>({MarkdownView}),module,module.exports);
  return module.exports;
 };
 const api=load(),observe=()=>assert.equal(api.hasNativeBoardEditor(app,file),true);
 const close=()=>{leaves.length=0;view.file=null;};
 const advance=()=>{const due=[...timers.entries()];for(const [id,run]of due)if(timers.delete(id))run();};
 const unknown=(key:'saving'|'saveAgain',kind:'missing'|'accessor'|'wrong-type')=>{
  if(kind==='missing')delete(view as Partial<typeof view>)[key];
  else if(kind==='accessor')Object.defineProperty(view,key,{configurable:true,get:()=>{getters++;return false;}});
  else Object.defineProperty(view,key,{configurable:true,writable:true,value:'false'});
 };
 const settle=()=>{Object.defineProperties(view,{saving:{configurable:true,writable:true,value:false},saveAgain:{configurable:true,writable:true,value:false}});};
 return{api,app,file,files,view,leaves,realm,timers,load,observe,close,advance,unknown,settle,counts:()=>({saves,reads,getters})};
}

test('control: unloading still clears timers/listeners/strong state and a completed old host save releases ownership',()=>{
 const f=fixture(),drains:File[]=[];f.api.subscribeNativeBoardEditorDrains(f.app,file=>drains.push(file));f.view.saving=true;f.observe();f.close();
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);const old=f.api.__state(f.app)!;assert(f.timers.size>0);
 f.api.clearNativeBoardEditorTracking(f.app);
 assert.equal(f.timers.size,0);assert.equal(old.timer,undefined);assert.equal(old.clock,undefined);assert.equal(old.owners.size,0);assert.equal(old.waiting.size,0);assert.equal(old.listeners.size,0);assert.equal(f.api.__state(f.app),undefined);
 f.settle();f.advance();assert.deepEqual(drains,[]);const next=f.load();assert.equal(next.hasNativeBoardEditor(f.app,f.file),false);assert.equal(f.timers.size,0);assert.deepEqual(f.counts(),{saves:0,reads:0,getters:0});
});

test('a reloaded production bundle rediscovers a retired still-saving editor for the same App',()=>{
 const f=fixture();f.view.saving=true;f.observe();f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);
 f.api.clearNativeBoardEditorTracking(f.app);assert.equal(f.timers.size,0);const next=f.load();
 assert.equal(next.hasNativeBoardEditor(f.app,f.file),true,'unload cannot erase a host buffer whose save is still pending');
 assert.throws(()=>next.assertBoardEditorOwnership(f.app,f.file),/原生|保存|Markdown/);assert.deepEqual(f.counts(),{saves:0,reads:0,getters:0});
 f.settle();next.clearNativeBoardEditorTracking(f.app);
});

test('an observed clean live editor can start its closing save while the plugin is unloaded and remains protected after reload',()=>{
 const f=fixture();f.observe();assert.equal(f.view.saving,false);assert.equal(f.view.saveAgain,false);
 f.api.clearNativeBoardEditorTracking(f.app);assert.equal(f.timers.size,0);
 // Native lifecycle can run between old-plugin cleanup and new-plugin startup.
 // The host continues holding its actual view for this new save, without a
 // plugin listener or live Markdown leaf left for rediscovery.
 f.view.saving=true;f.close();const next=f.load();
 assert.equal(next.hasNativeBoardEditor(f.app,f.file),true,'weak export must retain an observed live identity even if it was clean at plugin unload');
 assert.throws(()=>next.assertBoardEditorOwnership(f.app,f.file),/原生|保存|Markdown/);assert.deepEqual(f.counts(),{saves:0,reads:0,getters:0});
 f.settle();assert.equal(next.hasNativeBoardEditor(f.app,f.file),false);next.clearNativeBoardEditorTracking(f.app);
});

test('reload subscription retains an observed still-live clean editor until its later closing save drains',()=>{
 const f=fixture(),drains:File[]=[];f.observe();f.api.clearNativeBoardEditorTracking(f.app);const next=f.load();
 // Subscribe is the first tracking lookup in production onload, before its later
 // asynchronous startup and layout/workspace hooks. A currently live editor is
 // not a completed retired owner, even when both save flags happen to be false.
 next.subscribeNativeBoardEditorDrains(f.app,file=>drains.push(file));assert.equal(f.leaves.length,1);
 f.view.saving=true;f.close();assert.equal(next.hasNativeBoardEditor(f.app,f.file),true,'consuming the reload bridge cannot forget a still-live editor before its later close');
 assert.deepEqual(drains,[]);f.settle();f.advance();assert.equal(next.hasNativeBoardEditor(f.app,f.file),false);assert.deepEqual(drains,[f.file]);assert.equal(f.timers.size,0);
});

test('a saveAgain tail survives reload while saving is temporarily false',()=>{
 const f=fixture();f.observe();f.close();f.view.saveAgain=true;f.api.hasNativeBoardEditor(f.app,f.file);f.api.clearNativeBoardEditorTracking(f.app);const next=f.load();
 assert.equal(next.hasNativeBoardEditor(f.app,f.file),true);f.view.saveAgain=false;assert.equal(next.hasNativeBoardEditor(f.app,f.file),false);assert.equal(f.timers.size,0);
});

for(const key of ['saving','saveAgain'] as const)for(const kind of ['missing','accessor','wrong-type'] as const)test(`reload conservatively preserves an unknown ${kind} ${key} flag without invoking its getter`,()=>{
 const f=fixture();f.observe();f.close();f.unknown(key,kind);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);f.api.clearNativeBoardEditorTracking(f.app);const next=f.load();
 assert.equal(next.hasNativeBoardEditor(f.app,f.file),true);f.advance();assert.equal(next.hasNativeBoardEditor(f.app,f.file),true);assert.deepEqual(f.counts(),{saves:0,reads:0,getters:0});
 f.settle();assert.equal(next.hasNativeBoardEditor(f.app,f.file),false);next.clearNativeBoardEditorTracking(f.app);
});

test('unload exports only WeakRefs to the actual host File and MarkdownView and releases all old strong references',()=>{
 const f=fixture();f.view.saving=true;f.observe();f.close();f.api.hasNativeBoardEditor(f.app,f.file);const old=f.api.__state(f.app)!;f.api.clearNativeBoardEditorTracking(f.app);
 assert.equal(f.timers.size,0);assert.equal(old.timer,undefined);assert.equal(old.clock,undefined);assert.equal(old.owners.size,0);assert.equal(old.waiting.size,0);assert.equal(old.listeners.size,0);assert.equal(f.api.__state(f.app),undefined);
 const bridge=f.realm[BRIDGE];assert(bridge instanceof WeakMap,'the reload bridge must have weak App keys');
 const entries=bridge.get(f.app) as Set<WeakEntry>|undefined;assert(entries instanceof Set);assert.equal(entries.size,1);
 const [entry]=entries;assert.deepEqual(Object.keys(entry).sort(),['file','view']);assert(entry.file instanceof WeakRef);assert(entry.view instanceof WeakRef);
 assert.equal(entry.file.deref(),f.file);assert.equal(entry.view.deref(),f.view,'WeakRef must target the actual pending host view, never a short-lived wrapper');
 assert.deepEqual(f.counts(),{saves:0,reads:0,getters:0});f.settle();const next=f.load();assert.equal(next.hasNativeBoardEditor(f.app,f.file),false);
});

test('reload resumes polling without another workspace event and only the new subscriber receives the drain once',()=>{
 const f=fixture(),oldDrains:File[]=[],newDrains:File[]=[];f.api.subscribeNativeBoardEditorDrains(f.app,file=>oldDrains.push(file));f.view.saving=true;f.observe();f.close();f.api.hasNativeBoardEditor(f.app,f.file);f.api.clearNativeBoardEditorTracking(f.app);const next=f.load();
 next.subscribeNativeBoardEditorDrains(f.app,file=>newDrains.push(file));assert(f.timers.size>0,'a reload subscriber must restart retired-save polling without needing a live leaf');
 f.settle();f.advance();assert.deepEqual(newDrains,[f.file]);assert.deepEqual(oldDrains,[]);assert.equal(next.hasNativeBoardEditor(f.app,f.file),false);f.advance();assert.deepEqual(newDrains,[f.file]);assert.equal(f.timers.size,0);
});

test('retired ownership follows the same renamed File identity across two reloads without crossing App profiles',()=>{
 const f=fixture();f.view.saving=true;f.observe();f.close();f.api.hasNativeBoardEditor(f.app,f.file);f.api.clearNativeBoardEditorTracking(f.app);
 f.files.delete(f.file.path);f.file.path='Moved/Renamed.md';f.files.set(f.file.path,f.file);const next=f.load();
 const otherApp={workspace:f.app.workspace,vault:f.app.vault};assert.equal(next.hasNativeBoardEditor(otherApp,f.file),false,'even sharing a host File in a fixture cannot cross the App weak key');
 assert.equal(next.hasNativeBoardEditor(f.app,f.file),true);next.clearNativeBoardEditorTracking(f.app);assert.equal(f.timers.size,0);const final=f.load();
 assert.equal(final.hasNativeBoardEditor(f.app,f.file),true);f.settle();assert.equal(final.hasNativeBoardEditor(f.app,f.file),false);assert.equal(f.timers.size,0);
});
