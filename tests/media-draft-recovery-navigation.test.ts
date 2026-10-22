import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {MediaDraftStore,type StoredMediaDraft} from '../src/media-draft-store';
import {isVaultMediaPath,mediaClock} from '../src/media-source';

// Real recovery modal, real host restore method and real draft store. Only the
// native document/leaf/loading boundary is synthetic; no application is started.
const main=readFileSync('src/main.ts','utf8'),start=main.indexOf('  private async restoreMediaDraft('),end=main.indexOf('\n  openMediaWorkspace(',start);
assert(start>=0&&end>start);
function compile(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
function deferred(){let resolve!:()=>void,reject!:(error:unknown)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
class TFile {stat={mtime:17,size:100};constructor(public path:string){}}
class Element {
 children:Element[]=[];isConnected=true;disabled=false;textContent='';value='';readOnly=false;onclick?:()=>void;
 constructor(readonly ownerDocument:any,readonly tag='div',options:any={}){this.textContent=options.text||'';}
 createEl(tag:string,options:any={}){const e=new Element(this.ownerDocument,tag,options);this.children.push(e);return e;}
 createDiv(options:any={}){return this.createEl('div',options);}addClass(){}
 empty(){for(const e of this.all())e.isConnected=false;this.children=[];}
 all():Element[]{return this.children.flatMap(e=>[e,...e.all()]);}
 click(){if(!this.disabled)this.onclick?.();}
}
async function fixture(){
 const doc={defaultView:{closed:false}},otherDoc={defaultView:{closed:false}},media=new TFile('media/recovery.wav'),note=new TFile('notes/origin.md'),replacement=new TFile('notes/new.md'),files=new Map([media,note,replacement].map(f=>[f.path,f]));
 const stored:StoredMediaDraft={version:1,id:'saved-recovery',updatedAt:1,time:8.5,text:'未保存 **摘录**',source:{path:media.path,...media.stat}},disk=new Map([[stored.id,structuredClone(stored)]]),store=new MediaDraftStore({read:async()=>[...disk.values()],put:async value=>{disk.set(value.id,structuredClone(value));},remove:async id=>{disk.delete(id);}},()=>{}, {setTimeout:()=>1,clearTimeout(){}});await store.load();
 const listeners=new Map<string,Set<()=>void>>(),leaves:Leaf[]=[],mounts:{leaf:Leaf;state:any}[]=[],focuses:Leaf[]=[],detached:Leaf[]=[],reveals:Leaf[]=[],notices:string[]=[],jobs:Promise<void>[]=[],hooks:{mount?:(leaf:Leaf)=>Promise<void>;allocationDoc?:typeof doc;activateAllocation?:boolean}={};let expanded=0;
 const emit=(name:string)=>{for(const listener of [...listeners.get(name)||[]])listener();};
 class View {containerEl:any;session={};file?:TFile;constructor(public leaf:Leaf,document=doc){this.containerEl={ownerDocument:document,isConnected:true};}}
 class MediaWorkspaceView extends View {blocked=false;currentFile(){return this.file;}getState(){return this.leaf.state.state;}canMove(){return!this.blocked;}}
 class Leaf {
  view:View;state:any={type:'empty',state:{}};attached=true;
  constructor(document=doc){this.view=new View(this,document);leaves.push(this);}
  getViewState(){return this.state;}
  async setViewState(state:any){mounts.push({leaf:this,state});const old=this.view;this.state=state;if(!(old instanceof MediaWorkspaceView)){old.containerEl.isConnected=false;this.view=new MediaWorkspaceView(this,old.containerEl.ownerDocument);}this.view.file=files.get(state.state.file);emit('file-open');if(state.active)activate(this);await hooks.mount?.(this);}
  // Native detach can retain activeLeaf until a later layout event.
  detach(){this.attached=false;this.view.containerEl.isConnected=false;detached.push(this);emit('active-leaf-change');}
 }
 const origin=new Leaf();origin.view.file=note;origin.state={type:'markdown',state:{file:note.path}};const other=new Leaf();other.view.file=replacement;other.state={type:'markdown',state:{file:replacement.path}};let active:Leaf|undefined=origin;
 function activate(leaf:Leaf){active=leaf;emit('active-leaf-change');}
 const workspace={getActiveViewOfType:(Type:typeof View)=>active?.view instanceof Type?active.view:undefined,getLeavesOfType:(type:string)=>leaves.filter(l=>l.attached&&l.getViewState().type===type),getLeaf:()=>{const leaf=new Leaf(hooks.allocationDoc||doc);if(hooks.activateAllocation)activate(leaf);return leaf;},createLeafBySplit:(origin:Leaf)=>{const leaf=new Leaf(origin.view.containerEl.ownerDocument);if(hooks.activateAllocation)activate(leaf);return leaf;},on:(name:string,callback:()=>void)=>{let set=listeners.get(name);if(!set)listeners.set(name,set=new Set());set.add(callback);return{name,callback};},offref:({name,callback}:{name:string;callback:()=>void})=>listeners.get(name)?.delete(callback),setActiveLeaf:(leaf:Leaf)=>{focuses.push(leaf);activate(leaf);},revealLeaf:async(leaf:Leaf)=>{reveals.push(leaf);activate(leaf);},rightSplit:{expand:()=>{expanded++;}}};
 const app={workspace,vault:{getAbstractFileByPath:(path:string)=>files.get(path)}};
 const Plugin=compile('class Plugin{'+main.slice(start,end)+'};return Plugin;',{View,TFile,MediaWorkspaceView,MEDIA_WORKSPACE:'thoughtspace-media-player',isVaultMediaPath}),plugin=new Plugin();Object.assign(plugin,{app,mediaDrafts:store,mediaClosed:false});
 class Modal {containerEl=new Element(doc);modalEl=this.containerEl.createDiv();contentEl=this.modalEl.createDiv();closing=false;constructor(readonly app:unknown){}close(){this.closing=true;}finishClose(){(this as any).onClose();this.containerEl.isConnected=false;}}
 const module={exports:{} as Record<string,any>},code=transformSync(readFileSync('src/media-draft-recovery.ts','utf8'),{loader:'ts',format:'cjs'}).code;
 new Function('require','module','exports',code)((name:string)=>name==='obsidian'?{Modal,TFile,Notice:class{constructor(message:string){notices.push(message);}}}:name==='./media-source'?{mediaClock}:name==='./board-modal-viewport'?{bindBoardModalViewport:()=>()=>{}}:name==='./ui-tokens'?{themeSurface(){}}:{},module,module.exports);
 const modal=new module.exports.MediaDraftRecoveryModal(app,store,(draft:any,request:any)=>{const job=plugin.restoreMediaDraft(draft,request);jobs.push(job);return job;});modal.onOpen();
 const button=(name:string)=>{const found=modal.contentEl.all().find((e:Element)=>e.tag==='button'&&e.textContent===name);assert(found,name);return found;};
 const restore=()=>button('恢复草稿').click(),drain=async()=>{await Promise.allSettled(jobs);await tick();};
 const existing=(document=doc,placement='tab')=>{const leaf=new Leaf(document);leaf.view=new MediaWorkspaceView(leaf,document);leaf.view.file=media;leaf.state={type:'thoughtspace-media-player',state:{file:media.path,placement,time:2}};return leaf;};
 const reuse=(leaf:Leaf)=>{leaf.view.containerEl.isConnected=false;leaf.view=new View(leaf);leaf.view.file=replacement;leaf.state={type:'markdown',state:{file:replacement.path}};emit('file-open');};
 return{doc,otherDoc,media,note,replacement,files,stored,disk,store,workspace,plugin,modal,button,restore,drain,origin,other,leaves,mounts,focuses,detached,reveals,notices,jobs,hooks,listeners,emit,activate,existing,reuse,active:()=>active,expanded:()=>expanded};
}
test('normal recovery activates the exact retained draft after passive load in its owned document',async()=>{
 const f=await fixture();f.restore();await f.drain();assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].state.active,false);assert.equal(f.store.activeFor(f.media.path)?.text,f.stored.text);assert.equal(f.focuses.length,1);assert.equal(f.active()?.view.containerEl.ownerDocument,f.doc);assert.equal(f.reveals.length,0);assert.deepEqual(f.disk.get(f.stored.id),f.stored);assert([...f.listeners.values()].every(set=>!set.size));
});
test('close revokes a pending restore before native close animation calls onClose',async()=>{
 const f=await fixture(),gate=deferred();f.hooks.mount=()=>gate.promise;f.restore();await tick();f.modal.close();assert(f.modal.containerEl.isConnected);f.activate(f.other);gate.resolve();await f.drain();assert.equal(f.active(),f.other);assert.equal(f.focuses.length,0);assert.equal(f.store.activeFor(f.media.path),undefined);assert.equal(f.store.pending().length,1);assert.deepEqual(f.disk.get(f.stored.id),f.stored);
});
test('leaving and returning while the same modal is live permanently revokes the older restore',async()=>{
 const f=await fixture(),gate=deferred();f.hooks.mount=()=>gate.promise;f.restore();await tick();f.activate(f.other);f.activate(f.origin);gate.resolve();await f.drain();assert.equal(f.active(),f.origin);assert.equal(f.focuses.length,0);assert.equal(f.store.pending().length,1);
});
test('a pending target reused for a new note is neither changed, detached nor focused by recovery',async()=>{
 const f=await fixture(),gate=deferred();f.hooks.mount=()=>gate.promise;f.restore();await tick();const target=f.mounts[0].leaf;f.reuse(target);f.activate(target);const replacementView=target.view;gate.resolve();await f.drain();assert.equal(target.view,replacementView);assert.equal(target.view.file,f.replacement);assert.equal(f.detached.length,0);assert.equal(f.focuses.length,0);assert.equal(f.store.pending().length,1);
});
for(const change of ['rename','replace','mtime','size','delete','origin-view','origin-session','owner-window','store-replaced'] as const)test('restore rechecks exact identity after asynchronous load: '+change,async()=>{
 const f=await fixture(),gate=deferred();f.hooks.mount=()=>gate.promise;f.restore();await tick();
 if(change==='rename')f.media.path='media/moved.wav';if(change==='replace')f.files.set(f.media.path,new TFile(f.media.path));if(change==='mtime')f.media.stat.mtime++;if(change==='size')f.media.stat.size++;if(change==='delete')f.files.delete(f.media.path);if(change==='origin-view')f.reuse(f.origin);if(change==='origin-session')f.origin.view.session={};if(change==='owner-window')f.doc.defaultView.closed=true;if(change==='store-replaced')f.plugin.mediaDrafts={};
 gate.resolve();await f.drain();assert.equal(f.focuses.length,0);assert.equal(f.store.pending().length,1);assert.deepEqual(f.disk.get(f.stored.id),f.stored);
});
test('a real loader failure after close remains visible while all stored recovery bytes remain',async()=>{
 const f=await fixture(),gate=deferred();f.hooks.mount=()=>gate.promise;f.restore();await tick();f.modal.close();f.activate(f.other);gate.reject(Error('synthetic media load failure'));await f.drain();assert(f.notices.some(message=>message.includes('synthetic media load failure')));assert.equal(f.active(),f.other);assert.equal(f.store.pending().length,1);assert.equal(f.detached.length,0);assert.deepEqual(f.disk.get(f.stored.id),f.stored);
});
test('same-window existing sidebar preserves placement and is selected without asynchronous reveal',async()=>{
 const f=await fixture(),target=f.existing(f.doc,'sidebar');f.restore();await f.drain();assert.equal(f.mounts[0].leaf,target);assert.equal(f.mounts[0].state.state.placement,'sidebar');assert.equal(f.expanded(),1);assert.equal(f.active(),target);assert.equal(f.reveals.length,0);
});
test('an existing unsaved media draft or pending capture cannot be displaced or seeked by recovery',async()=>{
 const f=await fixture(),target=f.existing(f.doc,'sidebar');(target.view as any).blocked=true;f.restore();await f.drain();assert.equal(f.mounts.length,0);assert.equal(f.focuses.length,0);assert.equal(target.getViewState().state.time,2);assert.equal(f.store.pending().length,1);
});
test('another active draft for the same source is rejected before changing any media view',async()=>{
 const f=await fixture();f.store.stage({...f.stored,id:'different-active',text:'Keep this active draft'});f.restore();await f.drain();assert.equal(f.mounts.length,0);assert.equal(f.focuses.length,0);assert.equal(f.store.activeFor(f.media.path)?.id,'different-active');assert.equal(f.store.pending().length,1);assert.deepEqual(f.disk.get(f.stored.id),f.stored);
});
test('another window’s media view is not reused and host-routed empty tabs fall back beside the origin',async()=>{
 const f=await fixture(),foreign=f.existing(f.otherDoc,'window');f.hooks.allocationDoc=f.otherDoc;f.hooks.activateAllocation=true;f.restore();await f.drain();assert.equal(f.mounts.length,1);assert.notEqual(f.mounts[0].leaf,foreign);assert.equal(f.mounts[0].leaf.view.containerEl.ownerDocument,f.doc);assert.equal(foreign.getViewState().state.placement,'window');assert(!f.detached.includes(foreign));assert.equal(f.detached.length,1);assert.equal(f.active(),f.mounts[0].leaf);
});
for(const location of ['origin','same-window'] as const)test('native getLeaf reuse converts only the proven unchanged empty page: '+location,async()=>{
 const f=await fixture(),empty=location==='origin'?f.origin:f.other;empty.view.file=undefined;empty.state={type:'empty',state:{}};f.workspace.getLeaf=()=>{f.activate(empty);return empty;};const view=empty.view,originView=f.origin.view;f.restore();await f.drain();assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].leaf,empty);assert.notEqual(empty.view,view);assert.equal(empty.view.file,f.media);assert(!f.detached.includes(empty));if(location==='same-window')assert.equal(f.origin.view,originView);assert.equal(f.active(),empty);assert.equal(f.store.activeFor(f.media.path)?.id,f.stored.id);
});
test('a pre-existing foreign empty page stays intact while recovery opens in its original document',async()=>{
 const f=await fixture(),empty=f.other;empty.view.file=undefined;empty.state={type:'empty',state:{}};empty.view.containerEl.ownerDocument=f.otherDoc;f.hooks.activateAllocation=true;f.workspace.getLeaf=()=>{f.activate(empty);return empty;};const view=empty.view;f.restore();await f.drain();assert.equal(f.mounts.length,1);assert.notEqual(f.mounts[0].leaf,empty);assert.equal(empty.view,view);assert.equal(empty.state.type,'empty');assert(!f.detached.includes(empty));assert.equal(f.mounts[0].leaf.view.containerEl.ownerDocument,f.doc);assert.equal(f.store.activeFor(f.media.path)?.id,f.stored.id);
});
test('phone fallback can reuse the unchanged empty origin when native splitting is unavailable',async()=>{
 const f=await fixture();f.origin.view.file=undefined;f.origin.state={type:'empty',state:{}};f.hooks.allocationDoc=f.otherDoc;f.hooks.activateAllocation=true;f.workspace.createLeafBySplit=origin=>{f.activate(origin);return origin;};f.restore();await f.drain();assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].leaf,f.origin);assert.equal(f.active(),f.origin);assert.equal(f.origin.view.file,f.media);assert.equal(f.detached.length,1);assert.notEqual(f.detached[0],f.origin);assert.equal(f.store.activeFor(f.media.path)?.id,f.stored.id);
});
for(const change of ['close','reuse','leave-return'] as const)test('controlled empty-origin conversion retains cancellation and navigation protection: '+change,async()=>{
 const f=await fixture(),gate=deferred();f.origin.view.file=undefined;f.origin.state={type:'empty',state:{}};f.workspace.getLeaf=()=>f.origin;f.hooks.mount=()=>gate.promise;f.restore();await tick();assert.equal(f.mounts[0].leaf,f.origin);
 if(change==='close')f.modal.close();if(change==='reuse')f.reuse(f.origin);if(change==='leave-return'){f.activate(f.other);f.activate(f.origin);}const view=f.origin.view;gate.resolve();await f.drain();assert.equal(f.origin.view,view);assert.equal(f.focuses.length,0);assert.equal(f.detached.length,0);assert.equal(f.store.pending().length,1);assert.deepEqual(f.disk.get(f.stored.id),f.stored);
});
test('an old empty page changed during host allocation is not claimed as the recovery target',async()=>{
 const f=await fixture(),empty=f.other;empty.view.file=undefined;empty.state={type:'empty',state:{}};f.workspace.getLeaf=()=>{empty.state={type:'empty',state:{note:'changed'}};return empty;};const view=empty.view;f.restore();await f.drain();assert.equal(f.mounts.length,0);assert.equal(empty.view,view);assert.equal(f.detached.length,0);assert.equal(f.store.pending().length,1);
});
test('a host-returned reused note tab is rejected without replacing or detaching its content',async()=>{
 const f=await fixture();f.workspace.getLeaf=()=>f.other;const view=f.other.view;f.restore();await f.drain();assert.equal(f.mounts.length,0);assert.equal(f.detached.length,0);assert.equal(f.other.view,view);assert.equal(f.other.view.file,f.replacement);assert.equal(f.store.pending().length,1);
});
test('an already loaded source can restore while playback time changes without losing its file/session identity',async()=>{
 const f=await fixture(),target=f.existing(),gate=deferred();f.activate(target);f.hooks.mount=()=>gate.promise;f.restore();await tick();target.state.state.time=37;f.emit('file-open');gate.resolve();await f.drain();assert.equal(f.active(),target);assert.equal(f.focuses.length,1);assert.equal(f.store.activeFor(f.media.path)?.id,f.stored.id);
});
test('reopening the recovery modal gives it a new generation and old completion cannot unlock the new operation',async()=>{
 const f=await fixture(),first=deferred(),second=deferred();let calls=0;f.hooks.mount=()=>calls++?second.promise:first.promise;f.restore();await tick();f.modal.close();f.modal.onOpen();f.restore();await tick();first.resolve();await tick();assert.equal(f.modal.busy,true);assert.equal(f.button('恢复草稿').disabled,true);second.resolve();await f.drain();assert.equal(f.modal.busy,false);assert.equal(f.focuses.length,1);assert.equal(f.store.activeFor(f.media.path)?.id,f.stored.id);
});
