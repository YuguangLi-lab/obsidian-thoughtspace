import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

type EventRef={owner:Events;name:string;callback:(...args:any[])=>void};
class Events {
 refs=new Set<EventRef>();
 on(name:string,callback:(...args:any[])=>void){const ref={owner:this,name,callback};this.refs.add(ref);return ref;}
 offref(ref:EventRef){this.refs.delete(ref);}
 emit(name:string,...args:any[]){for(const ref of [...this.refs])if(ref.name===name)ref.callback(...args);}
}
class Component {
 private loaded=false;private callbacks:(()=>void)[]=[];
 load(){if(!this.loaded){this.loaded=true;(this as any).onload?.();}}
 unload(){if(!this.loaded)return;this.loaded=false;(this as any).onunload?.();for(const callback of this.callbacks.splice(0))callback();}
 registerEvent(ref:EventRef){this.callbacks.push(()=>ref.owner.offref(ref));}
}
class Doc {defaultView={closed:false};}
class Element {
 isConnected=true;tabIndex=-1;attrs=new Map<string,string>();listeners=new Map<string,Set<(event:any)=>void>>();nativeClick?:()=>void;
 constructor(public ownerDocument:Doc){}
 setAttribute(name:string,value:string){this.attrs.set(name,value);}getAttribute(name:string){return this.attrs.get(name)??null;}
 addEventListener(type:string,callback:(event:any)=>void,_capture?:boolean){let items=this.listeners.get(type);if(!items){items=new Set();this.listeners.set(type,items);}items.add(callback);}
 removeEventListener(type:string,callback:(event:any)=>void,_capture?:boolean){this.listeners.get(type)?.delete(callback);}
 remove(){this.isConnected=false;}
 click(){this.nativeClick?.();}
 key(key:string,patch:Record<string,unknown>={}){const event={key,defaultPrevented:false,isComposing:false,keyCode:0,repeat:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...patch};for(const callback of this.listeners.get('keydown')||[])callback(event);return event;}
}
class TFile {extension='md';body='native unsaved text';constructor(public path:string){}}
class View {containerEl:Element;leaf:any;center='center-id';constructor(doc:Doc){this.containerEl=new Element(doc);this.leaf={view:this};}}
class MarkdownView extends View {
 actions:Element[]=[];file:TFile|null;
 constructor(doc:Doc,file:TFile){super(doc);this.file=file;Object.assign(this.leaf,{detach:()=>assert.fail('must not close a native page'),openFile:()=>assert.fail('must not navigate a native page')});}
 addAction(_icon:string,title:string,callback:()=>void){const action=new Element(this.containerEl.ownerDocument);action.setAttribute('title',title);action.nativeClick=callback;this.actions.push(action);return action;}
 get editor(){return assert.fail('must not read or change native text, selection or undo');}
 save(){return assert.fail('must not force a save');}clear(){return assert.fail('must not clear native content');}
}
const notices:string[]=[],source=readFileSync('src/local-relations-editor.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const {LocalRelationsEditorReturn,expandLocalRelationPane}=new Function('Component','MarkdownView','Notice','View',transformSync(source+'\nreturn {LocalRelationsEditorReturn,expandLocalRelationPane};',{loader:'ts'}).code)(Component,MarkdownView,class{constructor(message:string){notices.push(message);}},View);
async function settle(){for(let i=0;i<8;i++)await Promise.resolve();}
function sidebar(){return{collapsed:true,expanded:0,parent:undefined as unknown,expand(){this.expanded++;this.collapsed=false;}};}
function fixture(load=true){
 const doc=new Doc(),otherDoc=new Doc(),file=new TFile('Notes/Center.md'),files=new Map([[file.path,file]]),graph=new View(doc),editor=new MarkdownView(doc,file),third=new View(doc),workspace=new Events(),vault=new Events();
 const leftSplit=sidebar(),rightSplit=sidebar();
 const state={context:true,active:editor as View|null,activate:undefined as undefined|(()=>void),revealed:[] as any[],activated:[] as any[]};
 Object.assign(workspace,{leftSplit,rightSplit,getActiveViewOfType:()=>state.active,revealLeaf:(leaf:any)=>{state.revealed.push(leaf);assert.fail('must not schedule an uncancellable asynchronous reveal');},setActiveLeaf:(leaf:any,options:unknown)=>{assert.deepEqual(options,{focus:true});state.activate?.();state.activated.push(leaf);state.active=leaf.view;workspace.emit('active-leaf-change',leaf);}});
 Object.assign(vault,{getAbstractFileByPath:(path:string)=>files.get(path)});
 const app={workspace,vault},manager=new LocalRelationsEditorReturn(app),context=()=>state.context;if(load)manager.load();
 const attach=()=>manager.attach(graph,editor.leaf,file,context) as Element|undefined,action=()=>{const result=attach();assert.ok(result);return result;},active=(view:View|null)=>{state.active=view;workspace.emit('active-leaf-change',view?.leaf);};
 return{doc,otherDoc,file,files,graph,editor,third,workspace,vault,state,manager,context,attach,action,active,app,leftSplit,rightSplit};
}

for(const side of ['leftSplit','rightSplit'] as const)test(`the pane helper expands only the ${side} reached through public parent identities`,()=>{
 const f=fixture();f.graph.leaf.parent={parent:{parent:f[side]}};expandLocalRelationPane(f.app,f.graph.leaf);assert.equal(f[side].expanded,1);assert.equal(f[side==='leftSplit'?'rightSplit':'leftSplit'].expanded,0);expandLocalRelationPane(f.app,f.graph.leaf);assert.equal(f[side].expanded,1);
});
test('the pane helper ignores main and popup parents and terminates cyclic ancestry',()=>{
 const f=fixture(),parent={parent:undefined as unknown},next={parent};parent.parent=next;f.graph.leaf.parent=parent;expandLocalRelationPane(f.app,f.graph.leaf);assert.equal(f.leftSplit.expanded,0);assert.equal(f.rightSplit.expanded,0);f.graph.leaf.parent={};expandLocalRelationPane(f.app,f.graph.leaf);assert.equal(f.leftSplit.expanded,0);assert.equal(f.rightSplit.expanded,0);
});
test('the pane helper stops at its matching sidebar rather than expanding an unrelated ancestor',()=>{
 const f=fixture();f.leftSplit.parent=f.rightSplit;f.graph.leaf.parent=f.leftSplit;expandLocalRelationPane(f.app,f.graph.leaf);assert.equal(f.leftSplit.expanded,1);assert.equal(f.rightSplit.expanded,0);
});
test('return expands the graph sidebar before activation and leaves the other sidebar unchanged',async()=>{
 const f=fixture(),button=f.action();f.graph.leaf.parent={parent:f.rightSplit};f.state.activate=()=>assert.equal(f.rightSplit.collapsed,false);button.click();await settle();assert.deepEqual(f.state.activated,[f.graph.leaf]);assert.equal(f.rightSplit.expanded,1);assert.equal(f.leftSplit.expanded,0);
});
for(const changed of ['context','third-page','third-page-without-event','third-page-and-back'] as const)test(`sidebar expansion rechecks ${changed} before returning to the graph`,async()=>{
 const f=fixture(),button=f.action();f.graph.leaf.parent=f.leftSplit;f.leftSplit.expand=()=>{f.leftSplit.expanded++;f.leftSplit.collapsed=false;if(changed==='context')f.state.context=false;else if(changed==='third-page-without-event')f.state.active=f.third;else{f.active(f.third);if(changed==='third-page-and-back')f.active(f.editor);}};button.click();await settle();assert.equal(f.leftSplit.expanded,1);assert.equal(f.state.activated.length,0);assert.equal(button.isConnected,changed!=='context');
});
test('failed sidebar expansion leaves the native page open and permits another return attempt',async()=>{
 const f=fixture(),button=f.action(),before=notices.length;f.graph.leaf.parent=f.leftSplit;f.leftSplit.expand=()=>{throw Error('sidebar unavailable');};button.click();await settle();assert.equal(notices.length,before+1);assert.equal(f.state.activated.length,0);assert.equal(f.editor.containerEl.isConnected,true);assert.equal(button.getAttribute('aria-busy'),'false');f.leftSplit.expand=()=>{f.leftSplit.collapsed=false;};button.click();await settle();assert.deepEqual(f.state.activated,[f.graph.leaf]);
});

test('the public native action returns to the captured graph without reading or writing either document',async()=>{
 const f=fixture(),button=f.action();assert.equal(button.tabIndex,0);assert.equal(button.getAttribute('role'),'button');assert.equal(button.getAttribute('data-relation-editor-return'),'');assert.match(button.getAttribute('aria-label')!,/原生自动保存，不关闭笔记/);
 button.click();await settle();assert.deepEqual(f.state.revealed,[]);assert.deepEqual(f.state.activated,[f.graph.leaf]);assert.equal(f.graph.center,'center-id');assert.equal(f.file.body,'native unsaved text');assert.equal(f.editor.containerEl.isConnected,true);assert.equal(button.getAttribute('aria-busy'),'false');
});
test('repeated attachment reuses one action while replacing the captured context callback',()=>{
 const f=fixture(),first=f.action();assert.equal(f.attach(),first);let current=true;assert.equal(f.manager.attach(f.graph,f.editor.leaf,f.file,()=>current),first);assert.equal(f.editor.actions.length,1);f.state.context=false;f.manager.prune();assert.equal(first.isConnected,true);current=false;f.manager.prune();assert.equal(first.isConnected,false);
});
test('reattachment to another graph takes over one native leaf and makes old callbacks inert',async()=>{
 const f=fixture(),old=f.action(),newGraph=new View(f.doc),latest=f.manager.attach(newGraph,f.editor.leaf,f.file,()=>true);assert.notEqual(latest,old);assert.equal(old.isConnected,false);old.click();await settle();assert.equal(f.state.revealed.length,0);latest.click();await settle();assert.deepEqual(f.state.activated,[newGraph.leaf]);
});
test('a new native page for the same graph removes the preceding return action',async()=>{
 const f=fixture(),old=f.action(),newEditor=new MarkdownView(f.doc,f.file),latest=f.manager.attach(f.graph,newEditor.leaf,f.file,()=>true);assert.equal(old.isConnected,false);f.active(newEditor);old.click();latest.click();await settle();assert.deepEqual(f.state.activated,[f.graph.leaf]);
});
test('independent editing sessions in two windows retain their own return destinations',async()=>{
 const f=fixture(),first=f.action(),file=new TFile('Notes/Other.md'),graph=new View(f.otherDoc),editor=new MarkdownView(f.otherDoc,file);f.files.set(file.path,file);const second=f.manager.attach(graph,editor.leaf,file,()=>true);assert.ok(second);f.active(editor);first.click();second.click();await settle();assert.deepEqual(f.state.activated,[graph.leaf]);assert.equal(first.isConnected,true);assert.equal(second.isConnected,true);f.active(f.editor);first.click();await settle();assert.deepEqual(f.state.activated,[graph.leaf,f.graph.leaf]);
});
test('returning preserves the current graph center rather than restoring the entry center',async()=>{
 const f=fixture(),button=f.action();f.graph.center='new-center';button.click();await settle();assert.equal(f.graph.center,'new-center');assert.deepEqual(f.state.activated,[f.graph.leaf]);
});
for(const key of ['Enter',' '])test(`${key} activates only the return control and suppresses duplicate native key handling`,async()=>{
 const f=fixture(),button=f.action();const event=button.key(key);assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);button.key(key,{repeat:true});button.click();assert.equal(button.getAttribute('aria-disabled'),'true');await settle();assert.equal(f.state.revealed.length,0);assert.equal(f.state.activated.length,1);
});
for(const [key,patch]of [['a',{}],['Escape',{}],['Tab',{}],['Enter',{ctrlKey:true}],['Enter',{metaKey:true}],['Enter',{altKey:true}],['Enter',{shiftKey:true}],['Enter',{isComposing:true}],['Enter',{keyCode:229}],['Enter',{defaultPrevented:true}]] as const)test(`unowned key ${key} ${JSON.stringify(patch)} is untouched`,()=>{
 const f=fixture(),event=f.action().key(key,patch);assert.equal(event.stopped,false);assert.equal(event.defaultPrevented,'defaultPrevented'in patch);assert.equal(f.state.revealed.length,0);
});
test('repeated pointer activation is coalesced before synchronously activating the graph',async()=>{
 const f=fixture(),button=f.action();button.click();button.click();assert.equal(f.state.activated.length,0);await settle();assert.equal(button.getAttribute('aria-disabled'),'false');assert.equal(f.state.activated.length,1);assert.equal(f.state.revealed.length,0);
});
test('a third active page prevents a stale callback from even revealing the graph',async()=>{
 const f=fixture(),button=f.action();f.active(f.third);button.click();await settle();assert.equal(f.state.revealed.length,0);assert.equal(f.state.active,f.third);
});
test('a third page selected before activation is not overwritten by completion',async()=>{
 const f=fixture(),button=f.action();button.click();f.active(f.third);await settle();assert.equal(f.state.activated.length,0);assert.equal(f.state.active,f.third);assert.equal(button.getAttribute('aria-busy'),'false');
});
test('visiting a third page and returning before completion permanently cancels the old request',async()=>{
 const f=fixture(),button=f.action();button.click();f.active(f.third);f.active(f.editor);await settle();assert.equal(f.state.activated.length,0);button.click();await settle();assert.equal(f.state.activated.length,1);
});
test('an active page change without its event is rechecked at activation',async()=>{
 const f=fixture(),button=f.action();button.click();f.state.active=f.third;await settle();assert.equal(f.state.activated.length,0);
});
test('an unrelated layout notification does not cancel the explicit return',async()=>{
 const f=fixture(),button=f.action();button.click();f.workspace.emit('layout-change');await settle();assert.deepEqual(f.state.activated,[f.graph.leaf]);
});
test('reattachment during a pending return keeps the button but invalidates the old request',async()=>{
 const f=fixture(),button=f.action();button.click();assert.equal(f.attach(),button);await settle();assert.equal(f.state.activated.length,0);button.click();await settle();assert.equal(f.state.activated.length,1);
});
for(const mode of ['context','graph-detached','graph-replaced','graph-leaf','graph-window','graph-deferred','editor-detached','editor-replaced','editor-window','editor-deferred','file-switch','file-replaced','rename','delete','window-closed','window-replaced','action-detached'] as const)test(`${mode} invalidates both the visible action and an in-flight return`,async()=>{
 const f=fixture(),button=f.action();button.click();
 if(mode==='context')f.state.context=false;else if(mode==='graph-detached')f.graph.containerEl.isConnected=false;else if(mode==='graph-replaced')f.graph.leaf.view=f.third;else if(mode==='graph-leaf')f.graph.leaf={view:f.graph};else if(mode==='graph-window')f.graph.containerEl.ownerDocument=f.otherDoc;else if(mode==='graph-deferred')f.graph.leaf.isDeferred=true;else if(mode==='editor-detached')f.editor.containerEl.isConnected=false;else if(mode==='editor-replaced')f.editor.leaf.view=new MarkdownView(f.doc,f.file);else if(mode==='editor-window')f.editor.containerEl.ownerDocument=f.otherDoc;else if(mode==='editor-deferred')f.editor.leaf.isDeferred=true;else if(mode==='file-switch')f.editor.file=new TFile('Other.md');else if(mode==='file-replaced')f.files.set(f.file.path,new TFile(f.file.path));else if(mode==='rename'){f.files.delete(f.file.path);f.file.path='Notes/Renamed.md';f.files.set(f.file.path,f.file);}else if(mode==='delete')f.files.delete(f.file.path);else if(mode==='window-closed')f.doc.defaultView.closed=true;else if(mode==='window-replaced')f.doc.defaultView={closed:false};else button.remove();
 f.workspace.emit('layout-change');assert.equal(button.isConnected,false);assert.equal(button.listeners.get('keydown')?.size,0);await settle();button.click();await settle();assert.equal(f.state.activated.length,0);assert.equal(f.state.revealed.length,0);
});
for(const event of ['file-open','layout-change'] as const)test(`${event} prunes a switched native file, and returning to the old file cannot resurrect the callback`,async()=>{
 const f=fixture(),button=f.action();f.editor.file=new TFile('Other.md');f.workspace.emit(event);f.editor.file=f.file;button.click();await settle();assert.equal(button.isConnected,false);assert.equal(f.state.revealed.length,0);
});
for(const event of ['rename','delete'] as const)test(`vault ${event} prunes the captured file without removing unrelated valid sessions`,()=>{
 const f=fixture(),button=f.action();f.vault.emit(event,new TFile('Unrelated.md'));assert.equal(button.isConnected,true);f.files.delete(f.file.path);f.vault.emit(event,f.file);assert.equal(button.isConnected,false);
});
test('a throwing host context fails closed on attach and on event-driven pruning',()=>{
 const f=fixture();assert.equal(f.manager.attach(f.graph,f.editor.leaf,f.file,()=>{throw Error('stale owner');}),undefined);assert.equal(f.editor.actions.length,0);let failed=false;const button=f.manager.attach(f.graph,f.editor.leaf,f.file,()=>{if(failed)throw Error('stale owner');return true;});failed=true;assert.doesNotThrow(()=>f.workspace.emit('layout-change'));assert.equal(button.isConnected,false);
});
test('unload removes actions and event handlers and makes old pending callbacks inert',async()=>{
 const f=fixture(),button=f.action();assert.equal(f.workspace.refs.size,3);assert.equal(f.vault.refs.size,2);button.click();f.manager.unload();assert.equal(button.isConnected,false);assert.equal(f.workspace.refs.size,0);assert.equal(f.vault.refs.size,0);await settle();button.click();await settle();assert.equal(f.state.activated.length,0);assert.equal(f.attach(),undefined);
});
test('reloading a component creates fresh actions without restoring old bindings',()=>{
 const f=fixture(),old=f.action();f.manager.unload();f.manager.load();const latest=f.action();assert.notEqual(latest,old);assert.equal(old.isConnected,false);assert.equal(f.workspace.refs.size,3);assert.equal(f.vault.refs.size,2);
});
test('a failed activation keeps a valid action usable without writing or closing anything',async()=>{
 const f=fixture(),button=f.action(),before=notices.length;f.state.activate=()=>{throw Error('layout unavailable');};button.click();await settle();assert.equal(notices.length,before+1);assert.equal(button.getAttribute('aria-busy'),'false');assert.equal(f.state.activated.length,0);f.state.activate=undefined;button.click();await settle();assert.equal(f.state.activated.length,1);
});
test('an invalidated return never attempts native activation or displays an error after unload',async()=>{
 const f=fixture(),button=f.action(),before=notices.length;f.state.activate=()=>assert.fail('must not activate after unload');button.click();f.manager.unload();await settle();assert.equal(notices.length,before);assert.equal(f.state.activated.length,0);
});
for(const mode of ['not-loaded','plain-view','wrong-file','missing-file','other-window','closed-window','same-view'] as const)test(`attach rejects ${mode} without modifying native chrome`,()=>{
 const f=fixture(mode!=='not-loaded');let graph=f.graph;if(mode==='plain-view')f.editor.leaf.view=f.third;else if(mode==='wrong-file')f.editor.file=new TFile('Other.md');else if(mode==='missing-file')f.files.clear();else if(mode==='other-window')f.editor.containerEl.ownerDocument=f.otherDoc;else if(mode==='closed-window')f.doc.defaultView.closed=true;else if(mode==='same-view')graph=f.editor;
 assert.equal(f.manager.attach(graph,f.editor.leaf,f.file,f.context),undefined);assert.equal(f.editor.actions.length,0);
});
