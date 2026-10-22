import test from 'node:test';
import {OnlineDraftStore,type OnlineDraftStorage,type StoredOnlineDraft,type OnlineDraftStamp} from '../src/online-draft-store';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as onlinePlatform from '../src/online-platform';
import * as mediaSource from '../src/media-source';
import * as density from '../src/workspace-density';
import * as viewport from '../src/mobile-viewport';
import {bindOnlineComposerLayout as actualComposerLayout} from '../src/online-composer-layout';
import type {OnlineSource,OnlineState} from '../src/online-platform';

// The view runs against the same small Obsidian DOM surface it uses in production.
// No browser, platform window, network request or vault write is needed here.
let documentId=0,realComposerLayout=false;
const layoutBindings:{root:Element;document:unknown;disposed:number;refreshes:number;reveals:number}[]=[],insetBindings:{root:Element;document:unknown;disposed:number}[]=[],viewportBindings:{root:Element;document:unknown;disposed:number}[]=[];
class ObjectURLs {
 private id=++documentId;
 created:{url:string;blob:Blob}[]=[];revoked:string[]=[];active=new Map<string,Blob>();
 createObjectURL(blob:Blob){const url=`blob:online-${this.id}-${this.created.length}`;this.created.push({url,blob});this.active.set(url,blob);return url;}
 revokeObjectURL(url:string){this.revoked.push(url);this.active.delete(url);}
}
class Element {
 children:Element[]=[];parentElement?:Element;dataset:Record<string,string>={};attributes=new Map<string,string>();
 ownerDocument:{nodeType?:number;defaultView:{setTimeout:typeof setTimeout;clearTimeout:typeof clearTimeout;URL:ObjectURLs;Blob:typeof Blob;closed:boolean};activeElement?:Element}={defaultView:{setTimeout,clearTimeout,URL:new ObjectURLs(),Blob,closed:false}};
 connected=true;visible=true;
 get isConnected():boolean{return this.parentElement?this.parentElement.isConnected:this.connected;}
 getClientRects(){if(!this.isConnected||!this.visible)return[];if(realComposerLayout)for(let node:Element|undefined=this;node;node=node.parentElement){if(node.hidden)return[];const parent=node.parentElement;if(parent?.attributes.get('tag')==='details'&&!parent.open&&node.attributes.get('tag')!=='summary')return[];}return[{}];}
 box={width:1000,height:700,top:0};scrollTop=0;scrollLeft=0;selectionStart=0;selectionEnd=0;
 getBoundingClientRect(){return this.box;}
 get firstChild(){return this.children[0]??null;}
 className='';textContent='';value='';title='';placeholder='';type='';disabled=false;readOnly=false;hidden=false;open=false;
 listeners=new Map<string,((event:any)=>unknown)[]>();
 onclick?:((event:any)=>unknown)|null;oninput?:((event:any)=>unknown)|null;onchange?:((event:any)=>unknown)|null;onkeydown?:((event:any)=>unknown)|null;
 style={setProperty:()=>{},removeProperty:()=>{}};
 get src(){return this.getAttribute('src')||'';}set src(value:string){this.setAttribute('src',value);}
 createDiv(options?:unknown){return this.createEl('div',options);}
 createSpan(options?:unknown){return this.createEl('span',options);}
 createEl(tag:string,options?:unknown){
  const node=new Element();node.connected=false;node.parentElement=this;node.ownerDocument=this.ownerDocument;node.attributes.set('tag',tag);
  if(typeof options==='string')node.className=options;
  else if(options&&typeof options==='object'){
   const data=options as {cls?:string;text?:string;value?:string;type?:string;attr?:Record<string,string>};
   node.className=data.cls||'';node.textContent=data.text||'';node.value=data.value||'';
   if(data.type)node.setAttribute('type',data.type);for(const[key,value]of Object.entries(data.attr||{}))node.setAttribute(key,value);
  }
  this.children.push(node);return node;
 }
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 matches(selector:string){
  if(selector.endsWith(':not(:disabled)')){if(this.disabled)return false;selector=selector.slice(0,-15);}
  const attribute=/\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
  if(attribute){if(!this.attributes.has(attribute[1])||attribute[2]!==undefined&&this.attributes.get(attribute[1])!==attribute[2])return false;selector=selector.slice(0,attribute.index);}
  const[tag,...classes]=selector.split('.');return(!tag||this.attributes.get('tag')===tag)&&classes.every(value=>this.className.split(' ').includes(value));
 }
 querySelectorAll(selector:string):Element[]{
  if(selector.includes(','))return this.all().slice(1).filter(node=>selector.split(',').some(part=>node.matches(part.trim())));
  const parts=selector.trim().split(/\s+/);let nodes:Element[]=[this];
  for(const part of parts)nodes=nodes.flatMap(node=>node.all().slice(1).filter(candidate=>candidate.matches(part)));
  return[...new Set(nodes)];
 }
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
 contains(node:Element){return this.all().includes(node);}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];this.textContent='';}
 append(...nodes:Element[]){for(const node of nodes){node.remove();node.parentElement=this;node.ownerDocument=this.ownerDocument;this.children.push(node);}}
 insertBefore(node:Element,before:Element|null){if(node===before)return;node.remove();const index=before?this.children.indexOf(before):this.children.length;assert.ok(index>=0);node.parentElement=this;node.ownerDocument=this.ownerDocument;this.children.splice(index,0,node);}
 remove(){if(realComposerLayout&&this.parentElement&&this.contains(this.ownerDocument.activeElement!))this.ownerDocument.activeElement=(this.ownerDocument as any).body;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 addClass(...names:string[]){this.className=[...new Set([...this.className.split(' '),...names])].filter(Boolean).join(' ');}
 removeClass(...names:string[]){this.className=this.className.split(' ').filter(value=>!names.includes(value)).join(' ');}
 toggleClass(name:string,on:boolean){if(on)this.addClass(name);else this.removeClass(name);}
 setAttribute(key:string,value:string){this.attributes.set(key,String(value));if(key==='type')this.type=String(value);}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 removeAttribute(key:string){this.attributes.delete(key);}
 addEventListener(type:string,fn:(event:any)=>unknown){this.listeners.set(type,[...this.listeners.get(type)||[],fn]);}
 removeEventListener(type:string,fn:(event:any)=>unknown){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==fn));}
 dispatch(type:string,event:Record<string,unknown>={}){
  const data={target:this,currentTarget:this,preventDefault:()=>{},stopPropagation:()=>{},...event};
  const handler=this['on'+type as 'oninput'];handler?.(data);for(const fn of this.listeners.get(type)||[])fn(data);
 }
 click(){if(!this.disabled)this.dispatch('click');}
 focus(){this.ownerDocument.activeElement=this;}
}
class TFile {
 constructor(public path:string){}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
 get extension(){return this.path.split('.').at(-1)!;}
}
type ShortcutHandler={modifiers:string[];key:string;func:(event:any)=>unknown};
class Scope {
 handlers:ShortcutHandler[]=[];
 constructor(readonly parent?:Scope){}
 register(modifiers:string[],key:string,func:ShortcutHandler['func']){const handler={modifiers,key,func};this.handlers.push(handler);return handler;}
 unregister(handler:ShortcutHandler){this.handlers=this.handlers.filter(value=>value!==handler);}
 dispatch(event:any):unknown {
  for(const handler of this.handlers)if(handler.key===event.key&&handler.modifiers.includes('Mod')&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&handler.func(event)===false)return false;
  return this.parent?.dispatch(event);
 }
}
class ItemView {
 app:any;contentEl=new Element();containerEl=new Element();
 constructor(public leaf:{app:unknown}){this.app=leaf.app;}
 registerEvent(_event:unknown){}
 registerDomEvent(el:Element,type:string,callback:(event:any)=>unknown){el.addEventListener(type,callback);}
}
class Component {
 loads=0;unloads=0;
 load(){this.loads++;}
 unload(){this.unloads++;}
}
const markdownRenders:{text:string;holder:Element;path:string;component:Component}[]=[];
class MarkdownRenderer {
 static async render(_app:unknown,text:string,holder:Element,path:string,component:Component){markdownRenders.push({text,holder,path,component});holder.createSpan({text});}
}
const notices:string[]=[];
const errorsLogged:unknown[][]=[];
const compiled=transformSync(readFileSync('src/online-workspace-view.ts','utf8'),{loader:'ts',format:'cjs'}).code;
const module={exports:{}};
new Function('require','module','exports','console',compiled)((name:string)=>{
 if(name==='obsidian')return{ItemView,Scope,TFile,Component,MarkdownRenderer,setIcon:()=>{},Notice:class{constructor(message:string){notices.push(message);}}};
 if(name==='./online-platform')return onlinePlatform;
 if(name==='./media-source')return mediaSource;
 if(name==='./workspace-density')return density;
 if(name==='./mobile-viewport')return{...viewport,bindMobileViewport:(root:Element)=>{if(!realComposerLayout)return viewport.bindMobileViewport(root as any);const record={root,document:root.ownerDocument,disposed:0};viewportBindings.push(record);return()=>{record.disposed++;};}};
 if(name==='./board-chrome')return{bindBoardHostInset:(root:Element)=>{const record={root,document:root.ownerDocument,disposed:0};insetBindings.push(record);return()=>{record.disposed++;};}};
 if(name==='./online-composer-layout')return{bindOnlineComposerLayout:(parts:any)=>{const record={root:parts.root,document:parts.root.ownerDocument,disposed:0,refreshes:0,reveals:0},actual=realComposerLayout?actualComposerLayout(parts):undefined;layoutBindings.push(record);return{refresh(){record.refreshes++;actual?.refresh();},revealComposer(){record.reveals++;actual?.revealComposer();},dispose(){record.disposed++;actual?.dispose();}};}};
 throw Error(`Unexpected runtime dependency: ${name}`);
},module,module.exports,{error:(...values:unknown[])=>errorsLogged.push(values)});
const {OnlineWorkspaceView}=module.exports as {OnlineWorkspaceView:new(leaf:unknown,host:unknown)=>any};
const source=(path:string)=>{const result=onlinePlatform.parseOnlineSource(path);assert.ok(result);return result;};
const youtube=source('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
const another=source('https://www.youtube.com/watch?v=abcdefghijk');
const biliOne=source('https://www.bilibili.com/video/BV1xx411c7mD/?p=1');
const biliTwo=source('https://www.bilibili.com/video/BV1xx411c7mD/?p=2');
function find(root:Element,tag:string,label:string){const node=root.all().find(el=>el.attributes.get('tag')===tag&&el.getAttribute('aria-label')===label);assert.ok(node,`${tag} with label ${label} exists`);return node;}
const button=(view:any,label:string)=>find(view.contentEl,'button',label);
const editor=(view:any)=>{const node=view.contentEl.querySelector('textarea');assert.ok(node,'draft editor exists');return node as Element;};
async function settle(){await new Promise<void>(resolve=>setImmediate(resolve));}
async function click(view:any,label:string){button(view,label).click();await settle();}
function type(node:Element,value:string){assert.equal(node.disabled||node.readOnly,false,'input is editable');node.focus();node.value=value;node.dispatch('input');}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
type Moment={id:string;time:number;text:string;line:number;image?:string};
type Draft={id:string;time:number;text:string;image?:Blob};
type Capture={blob:Blob;time:number};
type Timeline={note?:TFile;entries:Moment[];warnings?:string[]};
const synchronized=(value:OnlineSource,time=12.5):OnlineState=>({sourcePath:value.path,available:true,closed:false,time,duration:600,paused:false,rate:1,status:'synced'});
function fixture(){
 const noteA=new TFile('notes/A.md'),noteB=new TFile('notes/B.md');
 let live:OnlineState|undefined,layoutSaves=0;
 const listeners=new Set<(state:OnlineState)=>void>(),subscriptions:((state:OnlineState)=>void)[]=[];
 const saves:{source:string;data:Draft;note?:string}[]=[],commands:{source:string;action:string;value?:number}[]=[],opens:{source:string;placement:string;time?:number;note?:string}[]=[],reads:{source:string;note?:string}[]=[],adoptions:{source:string;placement:string}[]=[],captures:string[]=[],sent:{source:string;time?:number;text?:string;image?:string}[]=[];
 const mounts:{host:Element;source:string;released:number}[]=[],mountEvents:string[]=[];
 let read=async(_source:string,_note?:string):Promise<Timeline>=>({entries:[]});
 let write=async(_source:string,_data:Draft,_note?:string)=>({note:noteA});
 let capture=async(_source:string):Promise<Capture>=>({blob:new Blob(['PNG'],{type:'image/png'}),time:live?.time??0});
 const host={
  mount:(host:Element,source:string)=>{const mounted={host,source,released:0};mounts.push(mounted);mountEvents.push(`mount:${source}`);return()=>{mounted.released++;mountEvents.push(`release:${source}`);};},
  pick:()=>{},open:async(source:string,placement:string,time?:number,note?:string)=>{opens.push({source,placement,time,note});},
  state:()=>live,subscribe:(fn:(state:OnlineState)=>void)=>{listeners.add(fn);subscriptions.push(fn);return()=>listeners.delete(fn);},
  command:async(source:string,action:string,value?:number)=>{commands.push({source,action,value});},adopt:async(source:string,placement:string)=>{adoptions.push({source,placement});},
  notes:(source:string,note?:string)=>{reads.push({source,note});return read(source,note);},
  save:(source:string,data:Draft,note?:string)=>{saves.push({source,data:{...data},note});return write(source,data,note);},
  capture:(source:string)=>{captures.push(source);return capture(source);},
  send:async(source:string,time?:number,text?:string,image?:string)=>{sent.push({source,time,text,image});},openNote:async()=>{},
 };
 const app={scope:new Scope(),workspace:{activeLeaf:undefined as unknown,mostRecentLeaf:undefined as unknown,getMostRecentLeaf(){return this.mostRecentLeaf;},getActiveViewOfType(type:new(...args:any[])=>any){const view=(this.activeLeaf as {view?:unknown}|undefined)?.view;return view instanceof type?view:null;},requestSaveLayout:()=>{layoutSaves++;}}};
 const view=()=>{const leaf:{app:typeof app;view?:unknown}={app};app.workspace.activeLeaf=leaf;app.workspace.mostRecentLeaf=leaf;const instance=new OnlineWorkspaceView(leaf,host);leaf.view=instance;return instance;};
 const publish=(state:OnlineState)=>{live=state;for(const fn of listeners)fn(state);};
 return{view,app,host,publish,noteA,noteB,saves,commands,opens,reads,adoptions,captures,sent,subscriptions,listeners,mounts,mountEvents,
  get layoutSaves(){return layoutSaves;},setRead:(fn:typeof read)=>{read=fn;},setWrite:(fn:typeof write)=>{write=fn;},setCapture:(fn:typeof capture)=>{capture=fn;}};
}
async function open(f:ReturnType<typeof fixture>,value=youtube,state:Record<string,unknown>={}){const view=f.view();await view.onOpen();await view.setState({source:value.path,...state});return view;}
const rows=(view:any):Element[]=>(view.contentEl as Element).querySelectorAll('.ts-online-workspace__moment');
const status=(view:any)=>(view.contentEl as Element).querySelector('.ts-online-workspace__status')!.textContent;
const urls=(view:any):ObjectURLs=>(view.contentEl as Element).ownerDocument.defaultView.URL;
const preview=(view:any):Element|null=>(view.contentEl as Element).querySelector('.ts-online-workspace__draft-image');

async function shortcutFixture(placement:'tab'|'sidebar'|'window'='tab'){
 const f=fixture();let nativeEffects=0;
 Object.assign(f.host,{playbackAvailable:()=>false});
 f.app.scope.register(['Mod'],'Enter',event=>{nativeEffects++;event.preventDefault();event.stopPropagation();return false;});
 const v=await open(f,youtube,{placement});type(find(v.contentEl,'input','手动摘录时间'),'1:23');await click(v,'确认时间');type(editor(v),'把这一段里的城市观察，留给下一次散步。');
 const event=(patch:Record<string,unknown>={})=>({key:'Enter',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,keyCode:13,defaultPrevented:false,stopped:false,target:v.input,view:v.contentEl.ownerDocument.defaultView,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...patch});
 const dispatch=(key:ReturnType<typeof event>)=>{const result=v.scope.dispatch(key);if(!key.stopped)v.input.onkeydown(key);return result;};
 return{...f,v,event,dispatch,nativeEffects:()=>nativeEffects};
}
for(const modifier of ['metaKey','ctrlKey'])test(`online scope saves manual 83-second draft with ${modifier}+Enter before the native parent shortcut`,async()=>{
 const f=await shortcutFixture(),input=f.v.input,key=f.event({metaKey:false,[modifier]:true}),draft={...f.v.memory.draft};
 assert.equal(f.v.scope.parent,f.app.scope);assert.equal(f.dispatch(key),false);assert.equal(key.defaultPrevented,true);assert.equal(key.stopped,true);assert.equal(f.nativeEffects(),0);
 input.onkeydown(key);await settle();assert.equal(f.saves.length,1);assert.deepEqual(f.saves[0],{source:youtube.path,data:{id:draft.id,time:83,text:draft.text},note:undefined});assert.equal(input.value,'');assert.equal(input.ownerDocument.activeElement,input);assert.equal(f.mounts.length,0);assert.deepEqual(f.opens,[]);assert.deepEqual(f.commands,[]);assert.equal(f.captures.length,0);await f.v.onClose();
});
for(const entry of ['scope','dom'])test(`online sidebar ${entry} shortcut uses the actual focused view while mostRecentLeaf remains main`,async()=>{
 const f=await shortcutFixture('sidebar'),main={view:{}},key=f.event();f.app.workspace.mostRecentLeaf=main;
 assert.equal(f.app.workspace.activeLeaf,f.v.leaf);assert.equal(f.app.workspace.getMostRecentLeaf(),main);
 if(entry==='scope')assert.equal(f.dispatch(key),false);else f.v.input.onkeydown(key);
 await settle();assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.time,83);assert.equal(f.nativeEffects(),0);assert.equal(key.defaultPrevented,true);await f.v.onClose();
});
for(const target of ['document','missing'])test(`online scope accepts ${target} event target with exact owned textarea focus`,async()=>{
 const f=await shortcutFixture(),doc=f.v.contentEl.ownerDocument;doc.nodeType=9;f.dispatch(f.event({target:target==='document'?doc:null}));await settle();assert.equal(f.saves.length,1);assert.equal(f.nativeEffects(),0);await f.v.onClose();
});
test('online DOM fallback independently saves and consumes a valid event',async()=>{
 const f=await shortcutFixture(),key=f.event();f.v.input.onkeydown(key);await settle();assert.equal(f.saves.length,1);assert.equal(key.defaultPrevented,true);assert.equal(key.stopped,true);await f.v.onClose();
});
for(const reason of ['save-button','manual-time','other-textarea','other-leaf','foreign-target','foreign-event-window','foreign-input-document','closed-window','hidden-input','detached-input','event-ime','legacy-ime','view-ime','prevented','alt','shift','plain-enter'])test(`online scope leaves ${reason} untouched without altering its draft`,async()=>{
 const f=await shortcutFixture(),v=f.v,key=f.event(),draft=v.memory.draft,handler=v.scope.handlers[0];
 if(reason==='save-button')v.saveButton.focus();if(reason==='manual-time')v.manual.focus();if(reason==='other-textarea')v.contentEl.createEl('textarea').focus();
 if(reason==='other-leaf')f.app.workspace.activeLeaf={};if(reason==='foreign-target')key.target=new Element();if(reason==='foreign-event-window')key.view=new Element().ownerDocument.defaultView;if(reason==='foreign-input-document')v.input.ownerDocument=new Element().ownerDocument;
 if(reason==='closed-window')v.contentEl.ownerDocument.defaultView.closed=true;if(reason==='hidden-input')v.input.visible=false;if(reason==='detached-input')v.input.remove();
 if(reason==='event-ime')key.isComposing=true;if(reason==='legacy-ime')key.keyCode=229;if(reason==='view-ime')v.composing=true;if(reason==='prevented')key.defaultPrevented=true;if(reason==='alt')key.altKey=true;if(reason==='shift')key.shiftKey=true;if(reason==='plain-enter')key.metaKey=false;
 assert.equal(handler.func(key),undefined);assert.equal(key.stopped,false);assert.equal(key.defaultPrevented,reason==='prevented');await settle();assert.equal(f.saves.length,0);assert.equal(v.memory.draft,draft);assert.equal(draft.time,83);await v.onClose();
});
test('online pending save and repeated keys stay consumed without creating another attempt',async()=>{
 const f=await shortcutFixture(),gate=deferred<{note:TFile}>();f.setWrite(()=>gate.promise);
 const held=f.event({repeat:true});assert.equal(f.dispatch(held),false);await settle();assert.equal(f.saves.length,0,'holding a key cannot start a fresh save');
 f.dispatch(f.event());await settle();assert.equal(f.saves.length,1);assert.equal(f.v.input.readOnly,true);const draft=f.v.memory.draft;
 for(const repeat of [false,true]){const key=f.event({repeat});assert.equal(f.dispatch(key),false);assert.equal(key.defaultPrevented,true);assert.equal(key.stopped,true);}
 await settle();assert.equal(f.saves.length,1);assert.equal(f.v.memory.draft,draft);assert.equal(f.nativeEffects(),0);gate.resolve({note:f.noteA});await settle();assert.equal(f.v.input.value,'');await f.v.onClose();
});
test('online capture and another editor retain saveDraft ownership while consuming the focused shortcut',async()=>{
 for(const blocked of ['capture','editor']){
  const f=await shortcutFixture(),draft=f.v.memory.draft;if(blocked==='capture')f.v.memory.capture={owner:Symbol('capture'),source:youtube.path,invalid:false};else f.v.memory.editor=Symbol('another editor');f.v.paintComposer();
  const key=f.event();assert.equal(f.dispatch(key),false);await settle();assert.equal(f.saves.length,0);assert.equal(f.v.memory.draft,draft);assert.equal(f.nativeEffects(),0);assert.equal(key.defaultPrevented,true);f.v.memory.capture=undefined;f.v.memory.editor=undefined;await f.v.onClose();
 }
});
test('online failed shortcut saves retain and retry the exact locked snapshot without DOM duplicate',async()=>{
 const f=await shortcutFixture(),image=new Blob(['owned fixture frame'],{type:'image/png'});f.v.memory.draft.image=image;const draft=f.v.memory.draft,snapshot={id:draft.id,time:draft.time,text:draft.text,image};let attempts=0;
 f.setWrite(async()=>{if(++attempts===1)throw Error('controlled storage failure');return{note:f.noteA};});const failedEvent=f.event();f.dispatch(failedEvent);await settle();
 assert.equal(f.v.memory.draft,draft);assert.equal(draft.locked,true);assert.equal(f.v.input.readOnly,true);assert.match(status(f.v),/controlled storage failure/);f.v.input.onkeydown(failedEvent);await settle();assert.equal(f.saves.length,1,'same event cannot retry after failure');
 f.dispatch(f.event({repeat:true}));await settle();assert.equal(f.saves.length,1);f.dispatch(f.event());await settle();assert.equal(f.saves.length,2);assert.deepEqual(f.saves.map(save=>save.data),[snapshot,snapshot]);assert.equal(f.v.memory.draft,undefined);assert.equal(f.nativeEffects(),0);await f.v.onClose();
});
test('closing online view unregisters its scope and retained native or DOM callbacks cannot save',async()=>{
 const f=await shortcutFixture(),input=f.v.input,handler=f.v.scope.handlers[0];await f.v.onOpen();assert.equal(f.v.scope.handlers.length,1);await f.v.onClose();assert.equal(f.v.scope.handlers.length,0);
 const key=f.event();assert.equal(handler.func(key),undefined);input.onkeydown(key);await settle();assert.equal(f.saves.length,0);assert.equal(key.defaultPrevented,false);await f.v.onOpen();assert.equal(f.v.scope.handlers.length,0);
});
test('old online DOM key callback cannot submit a newly selected source generation',async()=>{
 const f=await shortcutFixture(),oldInput=f.v.input;await click(f.v,'取消摘录');await f.v.setState({source:another.path});type(f.v.manual,'2:10');await click(f.v,'确认时间');type(f.v.input,'新的来源摘录');const draft=f.v.memory.draft,key=f.event();
 oldInput.onkeydown(key);await settle();assert.equal(f.saves.length,0);assert.equal(key.defaultPrevented,false);assert.equal(f.v.memory.draft,draft);f.dispatch(key);await settle();assert.equal(f.saves.length,1);assert.equal(f.saves[0].source,another.path);assert.equal(f.saves[0].data.time,130);assert.equal(f.saves[0].data.text,'新的来源摘录');await f.v.onClose();
});
test('a foreign window shortcut cannot consume or save another online view draft',async()=>{
 const a=await shortcutFixture(),b=await shortcutFixture('window'),key=b.event();assert.equal(a.v.scope.handlers[0].func(key),undefined);assert.equal(key.defaultPrevented,false);b.dispatch(key);await settle();assert.equal(a.saves.length,0);assert.equal(b.saves.length,1);assert.notEqual(a.v.memory,b.v.memory);assert.equal(a.v.input.value,'把这一段里的城市观察，留给下一次散步。');await a.v.onClose();await b.v.onClose();
});
test('online shortcut in a second view cannot take the original shared editor ownership',async()=>{
 const f=await shortcutFixture(),owner=f.v.memory.editor,draft=f.v.memory.draft,other=await open(f,youtube,{placement:'sidebar'});other.input.focus();assert.equal(other.input.readOnly,true);
 const key=f.event({target:other.input,view:other.contentEl.ownerDocument.defaultView});assert.equal(other.scope.handlers[0].func(key),false);await settle();assert.equal(f.saves.length,0);assert.equal(other.memory.editor,owner);assert.equal(other.memory.draft,draft);assert.equal(key.defaultPrevented,true);await other.onClose();await f.v.onClose();
});
test('online DOM shortcut before onOpen leaves the prepared draft untouched',async()=>{
 const f=fixture(),v=f.view();await v.setState({source:youtube.path});f.publish(synchronized(youtube));v.live=synchronized(youtube);v.paintComposer();type(editor(v),'尚未打开的来源草稿');const input=editor(v);let prevented=false;
 input.onkeydown?.({key:'Enter',metaKey:true,target:input,view:input.ownerDocument.defaultView,preventDefault(){prevented=true;},stopPropagation(){}});await settle();assert.equal(f.saves.length,0);assert.equal(prevented,false);assert.equal(v.scope.handlers.length,0);await v.onClose();
});

test('changing online workspace accent and density preserves the player, draft and subscription',async()=>{
 const f=fixture();let accent='blue',density='compact';Object.assign(f.host,{accent:()=>accent,density:()=>density});
 const v=await open(f);f.publish(synchronized(youtube));type(editor(v),'保留在线草稿');const input=editor(v),draft=v.memory.draft;
 assert.equal(v.contentEl.dataset.accent,'blue');accent='rose';density='comfortable';v.applyPreferences();
 assert.equal(v.contentEl.dataset.accent,'rose');assert.equal(v.contentEl.dataset.density,'comfortable');assert.equal(editor(v),input);assert.equal(v.memory.draft,draft);
 assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].released,0);assert.equal(f.listeners.size,1);await v.onClose();
});

test('the embedded player mounts into its connected view only after selecting a source and never launches itself',async()=>{
 const f=fixture(),v=f.view();await v.onOpen();assert.equal(f.mounts.length,0);
 await v.setState({source:youtube.path});assert.equal(f.mounts.length,1);
 const mount=f.mounts[0];assert.equal(mount.source,youtube.path);assert.equal(mount.host.className,'ts-online-workspace__embed');assert.equal(v.contentEl.contains(mount.host),true);
 assert.equal(mount.host.parentElement?.className,'ts-online-workspace__player');assert.deepEqual(f.opens,[]);assert.deepEqual(f.commands,[]);
 assert.equal(v.contentEl.all().some((node:Element)=>node.textContent.includes('平台窗口')),false);
 await v.onClose();assert.equal(mount.released,1);
});

test('same source state, placement updates, timeline refreshes and playback ticks preserve the embedded player',async()=>{
 const f=fixture(),v=await open(f),embed=f.mounts[0].host;
 await v.setState({source:youtube.path,time:77});await v.setState({source:youtube.path,placement:'sidebar'});
 for(let tick=0;tick<20;tick++)f.publish(synchronized(youtube,tick*.4));await click(v,'刷新摘录');
 assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].released,0);assert.equal(v.contentEl.querySelector('.ts-online-workspace__embed'),embed);
 assert.equal(v.getState().placement,'sidebar');assert.equal(f.opens.length,0);await v.onClose();assert.equal(f.mounts[0].released,1);
});

test('source replacement releases the previous embed before mounting the new one and close releases once',async()=>{
 const f=fixture(),v=await open(f);await v.setState({source:another.path});
 assert.deepEqual(f.mountEvents,[`mount:${youtube.path}`,`release:${youtube.path}`,`mount:${another.path}`]);
 assert.equal(f.mounts[0].released,1);assert.equal(f.mounts[1].released,0);assert.equal(v.contentEl.contains(f.mounts[0].host),false);
 await v.onClose();await v.onClose();assert.equal(f.mounts[1].released,1);assert.equal(f.mounts[0].released,1);
});

test('re-rendering for a different note releases its old player and an older view cannot release a newer mount',async()=>{
 const f=fixture(),first=await open(f,youtube,{note:f.noteA.path});await first.setState({source:youtube.path,note:f.noteB.path});
 assert.equal(f.mounts.length,2);assert.equal(f.mounts[0].released,1);
 const next=await open(f,youtube,{note:f.noteB.path});assert.equal(f.mounts.length,3);await first.onClose();
 assert.equal(f.mounts[1].released,1);assert.equal(f.mounts[2].released,0);assert.equal(next.contentEl.contains(f.mounts[2].host),true);
 await next.onClose();assert.equal(f.mounts[2].released,1);
});

test('loading uses the mounted source and retry reloads it without remounting or opening another view',async()=>{
 const f=fixture(),v=await open(f,youtube,{time:42});await click(v,'加载视频 / 重试');
 assert.deepEqual(f.opens,[{source:youtube.path,placement:'tab',time:42,note:undefined}]);assert.equal(f.mounts.length,1);
 f.publish({...synchronized(youtube),available:false,status:'error',error:'视频加载失败'});await click(v,'加载视频 / 重试');
 assert.deepEqual(f.commands,[{source:youtube.path,action:'reload',value:undefined}]);assert.equal(f.opens.length,1);assert.equal(f.mounts.length,1);
 await v.onClose();
});

test('platform errors are visible only for the selected source and clear when synchronization recovers',async()=>{
 const f=fixture(),v=await open(f),error=v.contentEl.querySelector('.ts-online-workspace__player-error');assert.equal(error.hidden,true);
 f.publish({...synchronized(youtube),available:false,status:'blocked',error:'请在播放器内登录后重试'});
 assert.equal(error.hidden,false);assert.equal(error.textContent,'请在播放器内登录后重试');
 f.publish({...synchronized(another),available:false,status:'error',error:'不应显示其他视频错误'});assert.equal(error.hidden,true);assert.equal(error.textContent,'');
 f.publish(synchronized(youtube));assert.equal(error.hidden,true);await v.onClose();
});

test('action failures retain a bounded plain-text reason instead of replacing it with a generic error',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));f.host.command=async()=>{throw Error('需要登录\u0000\n<script>nothing</script>'+'.'.repeat(700));};
 await click(v,'播放或暂停');assert.match(status(v),/^播放或暂停失败：当前摘录仍保留。\n需要登录 <script>nothing<\/script>/);assert.doesNotMatch(status(v),/操作未完成/);
 assert.ok(status(v).length<450);assert.ok(errorsLogged.at(-1)?.[1] instanceof Error);
 assert.equal(v.contentEl.querySelectorAll('script').length,0);await v.onClose();
});

test('specific screenshot, save and note-read errors survive their UI catch paths',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));type(editor(v),'keep my draft');
 f.setCapture(async()=>{throw Error('请将页面缩放恢复到 100%');});await click(v,'快速截图');assert.match(status(v),/^截图失败：当前摘录仍保留。\n请将页面缩放恢复到 100%/);
 f.setWrite(async()=>{throw Error('原笔记已移动，请重新打开');});await click(v,'保存摘录');assert.match(status(v),/^保存摘录失败：当前摘录仍保留。\n原笔记已移动，请重新打开/);assert.equal(editor(v).value,'keep my draft');
 f.setRead(async()=>{throw Error('部分笔记尚未完成索引');});await click(v,'刷新摘录');assert.match(status(v),/^读取摘录失败：当前摘录仍保留。\n部分笔记尚未完成索引/);
 await v.onClose();
});

test('capture and save reservations also block the player reload action',async()=>{
 const f=fixture(),v=await open(f),capture=deferred<Capture>(),save=deferred<{note:TFile}>();f.publish(synchronized(youtube));f.setCapture(()=>capture.promise);
 await click(v,'快速截图');assert.equal(button(v,'加载视频 / 重试').disabled,true);await click(v,'加载视频 / 重试');assert.equal(f.commands.length,0);
 capture.resolve({blob:new Blob(['frame'],{type:'image/png'}),time:12});await settle();assert.equal(button(v,'加载视频 / 重试').disabled,false);
 f.setWrite(()=>save.promise);await click(v,'保存摘录');assert.equal(button(v,'加载视频 / 重试').disabled,true);await click(v,'加载视频 / 重试');assert.equal(f.commands.length,0);
 save.resolve({note:f.noteA});await settle();assert.equal(button(v,'加载视频 / 重试').disabled,false);await v.onClose();
});

test('manual time stays in a collapsed fallback and is hidden and disabled while video time is synchronized',async()=>{
 const f=fixture(),v=await open(f),fallback=v.contentEl.querySelector('details.ts-online-workspace__manual-fallback'),manual=find(v.contentEl,'input','手动摘录时间');
 assert.ok(fallback);assert.equal(fallback.hidden,false);assert.equal(fallback.open,false);assert.equal(fallback.contains(manual),true);
 assert.equal(fallback.querySelector('summary').textContent,'手动时间（备用）');assert.equal(editor(v).readOnly,true);
 f.publish(synchronized(youtube,31));assert.equal(fallback.hidden,true);assert.equal(manual.disabled,true);assert.equal(button(v,'确认时间').disabled,true);
 manual.value='999';button(v,'确认时间').dispatch('click');await settle();await click(v,'记下此刻');await click(v,'保存摘录');assert.equal(f.saves[0].data.time,31);
 f.publish({...synchronized(youtube),available:false,status:'waiting'});assert.equal(fallback.hidden,false);assert.equal(fallback.open,false);assert.equal(manual.disabled,false);
 await v.onClose();
});

test('manually confirmed fallback time and disclosure choice survive synchronization without changing a frozen draft',async()=>{
 const f=fixture(),v=await open(f),fallback=v.contentEl.querySelector('details.ts-online-workspace__manual-fallback'),manual=find(v.contentEl,'input','手动摘录时间');
 fallback.open=true;type(manual,'1:15');await click(v,'确认时间');await click(v,'记下此刻');
 assert.equal(button(v,'快速截图').disabled,true);f.publish(synchronized(youtube,300));assert.equal(fallback.hidden,true);assert.equal(fallback.open,true);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,75);assert.equal(f.saves[0].data.text,'');
 f.publish({...synchronized(youtube),available:false});assert.equal(fallback.hidden,false);assert.equal(fallback.open,true);await v.onClose();
});

test('only an available, open, matching source enables playback controls or exposes its time',async()=>{
 const f=fixture(),v=await open(f);
 const controls=['播放或暂停','后退 10 秒','前进 10 秒','跳转'];
 assert.equal(v.getViewType(),'thoughtspace-online-player');assert.equal(Object.hasOwn(v.getState(),'time'),false);
 for(const patch of [{available:false},{closed:true},{sourcePath:another.path},{time:NaN},{time:Infinity},{time:-1}]){
  f.publish({...synchronized(youtube,61.25),...patch});
  for(const label of controls){assert.equal(button(v,label).disabled,true,JSON.stringify(patch));button(v,label).click();}
  assert.equal(find(v.contentEl,'select','播放速度').disabled,true);
  assert.equal(editor(v).readOnly,true);assert.equal(Object.hasOwn(v.getState(),'time'),false);
  assert.equal(v.contentEl.querySelector('.ts-online-workspace__clock').textContent,'时间未同步');
 }
 assert.deepEqual(f.commands,[]);f.publish(synchronized(youtube,61.25));
 for(const label of controls)assert.equal(button(v,label).disabled,false);
 assert.equal(v.getState().time,61.25);await click(v,'播放或暂停');
 assert.deepEqual(f.commands,[{source:youtube.path,action:'toggle',value:undefined}]);await v.onClose();
});

test('requested, stale, and wrong-part timestamps never enter layout state as verified playback',async()=>{
 const f=fixture(),v=await open(f,biliOne,{time:99});
 assert.equal(Object.hasOwn(v.getState(),'time'),false);
 f.publish(synchronized(biliOne,7));assert.equal(v.getState().time,7);
 for(const next of [{...synchronized(biliOne,88),available:false},{...synchronized(biliOne,88),closed:true},synchronized(biliTwo,88)]){
  f.publish(next);assert.equal(Object.hasOwn(v.getState(),'time'),false);assert.equal(editor(v).readOnly,true);
 }
 await v.onClose();
});

test('the first input freezes an exact timestamp and draft blocks source or placement changes',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,12.125));
 type(editor(v),'first thought');f.publish(synchronized(youtube,75));type(editor(v),'first thought\n**more detail**');
 assert.equal(v.canMove(),false);await v.setState({source:another.path});await click(v,'独立窗口');
 assert.equal(v.currentSource().path,youtube.path);assert.equal(v.getState().placement,'tab');assert.equal(f.opens.length,0);
 assert.match(v.contentEl.querySelector('.ts-online-workspace__draft-time').textContent,/0:12.*已固定/);
 await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.time,12.125);
 assert.equal(f.saves[0].data.text,'first thought\n**more detail**');assert.match(f.saves[0].data.id,/^[\w-]+$/);assert.equal(v.canMove(),true);await v.onClose();
});

test('draft text and its original time survive close and reopen without requiring playback',async()=>{
 const f=fixture(),first=await open(f);f.publish(synchronized(youtube,17.75));type(editor(first),'keep after closing');await first.onClose();
 f.publish({...synchronized(youtube,280),available:false,closed:true});const restored=await open(f);
 assert.equal(editor(restored).value,'keep after closing');assert.equal(restored.canMove(),false);assert.equal(button(restored,'保存摘录').disabled,false);
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,17.75);assert.equal(f.saves[0].data.text,'keep after closing');await restored.onClose();
});

test('discovering a note aliases the original draft so saved layout restores it with the note path',async()=>{
 const f=fixture();f.setRead(async()=>({note:f.noteA,entries:[]}));const first=await open(f);f.publish(synchronized(youtube,31.5));type(editor(first),'draft before layout restore');
 const layout=first.getState();assert.equal(layout.note,f.noteA.path);await first.onClose();
 const restored=await open(f,youtube,layout);assert.equal(editor(restored).value,'draft before layout restore');assert.equal(restored.canMove(),false);
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,31.5);assert.equal(f.saves[0].note,f.noteA.path);await restored.onClose();
});

test('two note destinations for one video keep their drafts separate',async()=>{
 const f=fixture();f.setRead(async(_source,note)=>({note:note===f.noteB.path?f.noteB:f.noteA,entries:[]}));
 const first=await open(f,youtube,{note:f.noteA.path});f.publish(synchronized(youtube,3));type(editor(first),'first destination');await first.onClose();
 const second=await open(f,youtube,{note:f.noteB.path});assert.equal(editor(second).value,'');f.publish(synchronized(youtube,5));type(editor(second),'second destination');await second.onClose();
 const restored=await open(f,youtube,{note:f.noteA.path});assert.equal(editor(restored).value,'first destination');await click(restored,'保存摘录');assert.equal(f.saves[0].note,f.noteA.path);assert.equal(f.saves[0].data.time,3);await restored.onClose();
});

test('manual time must be explicitly confirmed before typing or saving an unsynchronized draft',async()=>{
 const f=fixture(),v=await open(f,youtube,{time:555});const input=editor(v),manual=find(v.contentEl,'input','手动摘录时间');
 type(manual,'1:30');assert.equal(input.readOnly,true);assert.equal(button(v,'保存摘录').disabled,true);
 input.value='premature input';input.dispatch('input');assert.equal(input.value,'');assert.equal(v.canMove(),true);
 await click(v,'保存摘录');assert.equal(f.saves.length,0);
 await click(v,'确认时间');assert.equal(input.readOnly,false);type(input,'manual observation');
 f.publish(synchronized(youtube,300));await click(v,'保存摘录');assert.equal(f.saves[0].data.time,90);assert.equal(f.saves[0].data.text,'manual observation');
 await v.onClose();
});

test('invalid manual time does not authorize input and cancel clears a confirmed timestamp',async()=>{
 const f=fixture(),v=await open(f),manual=find(v.contentEl,'input','手动摘录时间');
 for(const value of ['','nonsense','-1','1:99']){type(manual,value);await click(v,'确认时间');assert.equal(editor(v).readOnly,true);}
 type(manual,'42');await click(v,'确认时间');assert.equal(editor(v).readOnly,false);
 await click(v,'取消摘录');assert.equal(editor(v).readOnly,true);assert.equal(manual.value,'');assert.equal(v.canMove(),true);await v.onClose();
});

test('IME composition and key code 229 suppress Cmd/Ctrl-Enter saving until composition ends',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));const input=editor(v);type(input,'中文摘录');
 input.dispatch('compositionstart');input.dispatch('keydown',{key:'Enter',metaKey:true});input.dispatch('compositionend');
 input.dispatch('keydown',{key:'Enter',ctrlKey:true,isComposing:true});input.dispatch('keydown',{key:'Enter',metaKey:true,keyCode:229});
 await settle();assert.equal(f.saves.length,0);
 input.dispatch('keydown',{key:'Enter',metaKey:true,isComposing:false,keyCode:13});await settle();assert.equal(f.saves.length,1);await v.onClose();
});

test('pending save blocks cancellation, duplicate submits, edits and switching',async()=>{
 const f=fixture(),pending=deferred<{note:TFile}>(),v=await open(f);f.setWrite(()=>pending.promise);f.publish(synchronized(youtube,33));type(editor(v),'immutable pending save');
 await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(button(v,'取消摘录').disabled,true);assert.equal(button(v,'保存摘录').disabled,true);assert.equal(editor(v).readOnly,true);
 await click(v,'取消摘录');await click(v,'保存摘录');await v.setState({source:another.path});await click(v,'右侧栏');
 editor(v).value='must not replace';editor(v).dispatch('input');editor(v).dispatch('keydown',{key:'Enter',ctrlKey:true});
 await settle();assert.equal(editor(v).value,'immutable pending save');assert.equal(v.currentSource().path,youtube.path);assert.equal(f.opens.length,0);assert.equal(f.saves.length,1);assert.equal(v.canMove(),false);
 pending.resolve({note:f.noteA});await settle();assert.equal(editor(v).value,'');assert.equal(v.canMove(),true);await v.onClose();
});

test('a late save after close clears only its original draft and leaves another source untouched',async()=>{
 const f=fixture(),pending=deferred<{note:TFile}>(),old=await open(f);f.setWrite(()=>pending.promise);f.publish(synchronized(youtube,9));type(editor(old),'A draft');await click(old,'保存摘录');await old.onClose();
 const current=await open(f,another);f.publish(synchronized(another,81));type(editor(current),'B draft');
 pending.resolve({note:f.noteA});await settle();assert.equal(current.currentSource().path,another.path);assert.equal(current.currentNote(),undefined);assert.equal(editor(current).value,'B draft');assert.equal(current.canMove(),false);
 await current.onClose();const restoredA=await open(f);assert.equal(editor(restoredA).value,'');assert.equal(restoredA.canMove(),true);await restoredA.onClose();
 const restoredB=await open(f,another);assert.equal(editor(restoredB).value,'B draft');f.setWrite(async()=>({note:f.noteB}));await click(restoredB,'保存摘录');assert.equal(f.saves[1].data.time,81);await restoredB.onClose();
});

test('reopening a source during save cannot duplicate it and observes the eventual completion',async()=>{
 const f=fixture(),pending=deferred<{note:TFile}>(),old=await open(f);f.setWrite(()=>pending.promise);f.publish(synchronized(youtube,8));type(editor(old),'one save');await click(old,'保存摘录');await old.onClose();
 const reopened=await open(f);assert.equal(editor(reopened).value,'one save');assert.equal(editor(reopened).readOnly,true);await click(reopened,'保存摘录');assert.equal(f.saves.length,1);
 pending.resolve({note:f.noteA});await settle();assert.equal(editor(reopened).value,'');assert.equal(reopened.canMove(),true);await reopened.onClose();
});

test('failed save retains exact identity, text and time for a safe retry after reopening',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,28.25));type(editor(v),'retry this');f.setWrite(async()=>{throw Error('disk full');});
 await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(editor(v).value,'retry this');assert.equal(editor(v).readOnly,true);assert.equal(v.canMove(),false);await v.onClose();
 const reopened=await open(f);assert.equal(editor(reopened).readOnly,true);editor(reopened).value='different retry body';editor(reopened).dispatch('input');assert.equal(editor(reopened).value,'retry this');
 f.setWrite(async()=>({note:f.noteA}));await click(reopened,'保存摘录');assert.deepEqual(f.saves[1].data,f.saves[0].data);assert.equal(reopened.canMove(),true);await reopened.onClose();
});

test('400 ms playback state updates preserve the editor, focus, timeline rows and draft',async()=>{
 const f=fixture();f.setRead(async()=>({entries:[{id:'one',time:2,text:'existing note',line:1}]}));const v=await open(f);
 f.publish(synchronized(youtube,10));const input=editor(v),timeline=v.contentEl.querySelector('.ts-online-workspace__timeline'),row=rows(v)[0];
 type(input,'ongoing typing');input.focus();const reads=f.reads.length;
 for(let tick=1;tick<=25;tick++)f.publish(synchronized(youtube,10+tick*.4));
 assert.equal(editor(v),input);assert.equal(input.ownerDocument.activeElement,input);assert.equal(input.value,'ongoing typing');
 assert.equal(v.contentEl.querySelector('.ts-online-workspace__timeline'),timeline);assert.equal(rows(v)[0],row);assert.equal(f.reads.length,reads);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,10);await v.onClose();
});

test('different Bilibili parts retain independent drafts across close and reopen',async()=>{
 const f=fixture(),first=await open(f,biliOne);f.publish(synchronized(biliOne,11));type(editor(first),'P1 note');await first.onClose();
 const second=await open(f,biliTwo);assert.equal(editor(second).value,'');assert.equal(editor(second).readOnly,true);f.publish(synchronized(biliTwo,22));type(editor(second),'P2 note');await second.onClose();
 const restoredOne=await open(f,biliOne);assert.equal(editor(restoredOne).value,'P1 note');await click(restoredOne,'保存摘录');await restoredOne.onClose();
 const restoredTwo=await open(f,biliTwo);assert.equal(editor(restoredTwo).value,'P2 note');await click(restoredTwo,'保存摘录');await restoredTwo.onClose();
 assert.deepEqual(f.saves.map(save=>[save.source,save.data.time,save.data.text]),[[biliOne.path,11,'P1 note'],[biliTwo.path,22,'P2 note']]);
});

test('timeline shows at most fifty sorted entries per page and retains access to the last page',async()=>{
 const f=fixture();f.setRead(async()=>({entries:Array.from({length:120},(_,index)=>({id:String(index),time:119-index,text:`entry-${119-index}`,line:index+1}))}));
 const v=await open(f);assert.equal(rows(v).length,50);assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'entry-0');
 assert.equal(button(v,'上一页').disabled,true);await click(v,'下一页');assert.equal(rows(v).length,50);assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'entry-50');
 await click(v,'下一页');assert.equal(rows(v).length,20);assert.equal(rows(v)[19].querySelector('.ts-online-workspace__moment-text')!.textContent,'entry-119');assert.equal(button(v,'下一页').disabled,true);await v.onClose();
});

test('late timeline results and state callbacks cannot mutate a different or closed source',async()=>{
 const f=fixture(),slow=deferred<Timeline>();f.setRead(path=>path===youtube.path?slow.promise:Promise.resolve({note:f.noteB,entries:[{id:'b',time:3,text:'B only',line:1}]}));
 const v=f.view();await v.onOpen();const old=v.setState({source:youtube.path});await v.setState({source:another.path});
 slow.resolve({note:f.noteA,entries:[{id:'a',time:1,text:'stale A',line:1}]});await old;
 assert.equal(v.currentNote(),f.noteB.path);assert.equal(rows(v).length,1);assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'B only');
 f.publish(synchronized(youtube,199));assert.equal(Object.hasOwn(v.getState(),'time'),false);assert.equal(button(v,'播放或暂停').disabled,true);
 const callback=f.subscriptions[0];await v.onClose();callback(synchronized(another,300));assert.equal(v.contentEl.children.length,0);assert.equal(f.listeners.size,0);
});

test('an older failed timeline refresh cannot replace a newer successful refresh',async()=>{
 const f=fixture(),v=await open(f),slow=deferred<Timeline>();f.setRead(()=>slow.promise);await click(v,'刷新摘录');
 f.setRead(async()=>({entries:[{id:'fresh',time:5,text:'fresh result',line:1}]}));await click(v,'刷新摘录');slow.reject(Error('old failure'));await settle();
 assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'fresh result');assert.doesNotMatch(status(v),/无法读取/);await v.onClose();
});

test('adopting a changed platform video requires a matching candidate and no pending draft',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,14));type(editor(v),'belongs to A');
 f.publish({...synchronized(youtube,20),available:false,status:'source-changed',candidate:another});
 const adopt=button(v,'切换到当前视频');assert.equal(adopt.disabled,true);assert.equal(v.contentEl.querySelector('.ts-online-workspace__candidate').hidden,false);
 adopt.dispatch('click');await settle();assert.deepEqual(f.adoptions,[]);assert.equal(editor(v).value,'belongs to A');
 await click(v,'取消摘录');assert.equal(adopt.disabled,false);await click(v,'切换到当前视频');assert.deepEqual(f.adoptions,[{source:another.path,placement:'tab'}]);
 f.publish({...synchronized(another),available:false,status:'source-changed',candidate:biliOne});
 assert.equal(adopt.disabled,true);assert.equal(v.contentEl.querySelector('.ts-online-workspace__candidate').hidden,true);adopt.dispatch('click');await settle();assert.equal(f.adoptions.length,1);await v.onClose();
});

test('events from detached controls cannot edit, cancel, save or control the newly selected source',async()=>{
 const f=fixture();f.setRead(async()=>({entries:[{id:'record',time:2,text:'record',line:1}]}));const v=await open(f);f.publish(synchronized(youtube,7));
 const oldInput=editor(v),oldRate=find(v.contentEl,'select','播放速度'),oldConfirm=button(v,'确认时间'),oldPlay=button(v,'播放或暂停'),oldCancel=button(v,'取消摘录'),oldSave=button(v,'保存摘录'),oldMoment=button(v,'0:02');
 await v.setState({source:another.path});f.publish(synchronized(another,82));const fresh=editor(v);find(v.contentEl,'input','手动摘录时间').value='15';
 oldInput.value='detached text';oldInput.dispatch('input');oldInput.dispatch('compositionstart');oldRate.value='2';oldRate.dispatch('change');oldConfirm.click();oldPlay.click();oldMoment.click();
 await settle();assert.equal(fresh.value,'');assert.equal(v.canMove(),true);assert.deepEqual(f.commands,[]);assert.deepEqual(f.opens,[]);
 type(fresh,'new source draft');oldCancel.dispatch('click');oldSave.dispatch('click');oldInput.dispatch('keydown',{key:'Enter',metaKey:true});await settle();
 assert.equal(fresh.value,'new source draft');assert.equal(f.saves.length,0);fresh.dispatch('keydown',{key:'Enter',metaKey:true});await settle();
 assert.equal(f.saves.length,1);assert.equal(f.saves[0].source,another.path);assert.equal(f.saves[0].data.time,82);assert.equal(f.saves[0].data.text,'new source draft');await v.onClose();
});

test('remembering the verified current moment creates a savable timestamp without requiring text',async()=>{
 const f=fixture(),v=await open(f);assert.equal(button(v,'记下此刻').disabled,true);assert.equal(button(v,'保存摘录').disabled,true);
 f.publish(synchronized(youtube,12.875));await click(v,'记下此刻');assert.equal(editor(v).value,'');assert.equal(v.canMove(),false);assert.equal(button(v,'保存摘录').disabled,false);
 f.publish(synchronized(youtube,90));await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.time,12.875);assert.equal(f.saves[0].data.text,'');assert.equal(f.saves[0].data.image,undefined);assert.equal(f.captures.length,0);await v.onClose();
});

test('confirmed manual time permits a timestamp-only record and never fabricates a screenshot',async()=>{
 const f=fixture(),v=await open(f),manual=find(v.contentEl,'input','手动摘录时间');type(manual,'1:30');
 assert.equal(button(v,'记下此刻').disabled,true);await click(v,'确认时间');await click(v,'记下此刻');
 assert.equal(button(v,'快速截图').disabled,true);button(v,'快速截图').dispatch('click');await settle();assert.equal(f.captures.length,0);assert.equal(urls(v).created.length,0);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,90);assert.equal(f.saves[0].data.text,'');assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('a picture-only draft uses the exact returned frame timestamp and releases its preview after save',async()=>{
 const f=fixture(),v=await open(f),blob=new Blob(['frame'],{type:'image/png'});f.setCapture(async()=>({blob,time:19.625}));f.publish(synchronized(youtube,18));
 await click(v,'快速截图');assert.deepEqual(f.captures,[youtube.path]);assert.equal(editor(v).value,'');assert.equal(button(v,'保存摘录').disabled,false);
 const url=preview(v)!.src;assert.equal(urls(v).active.get(url),blob);assert.equal(urls(v).created.length,1);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.image,blob);assert.equal(f.saves[0].data.time,19.625);assert.equal(f.saves[0].data.text,'');assert.deepEqual(urls(v).revoked,[url]);assert.equal(urls(v).active.size,0);assert.equal(v.canMove(),true);
 await v.onClose();assert.deepEqual(urls(v).revoked,[url]);
});

test('adding a screenshot preserves existing Markdown but moves its draft time to the captured frame',async()=>{
 const f=fixture(),v=await open(f),blob=new Blob(['precise frame'],{type:'image/png'});f.publish(synchronized(youtube,7));type(editor(v),'**already typed**\nsecond line');
 f.setCapture(async()=>({blob,time:33.125}));f.publish(synchronized(youtube,32));await click(v,'快速截图');
 assert.equal(editor(v).value,'**already typed**\nsecond line');await click(v,'保存摘录');assert.equal(f.saves[0].data.time,33.125);assert.equal(f.saves[0].data.text,'**already typed**\nsecond line');assert.equal(f.saves[0].data.image,blob);await v.onClose();
});

test('capture requires a currently synchronized matching source even when manual time is confirmed',async()=>{
 const f=fixture(),v=await open(f,biliOne);type(find(v.contentEl,'input','手动摘录时间'),'42');await click(v,'确认时间');
 for(const state of [{...synchronized(biliOne),available:false},{...synchronized(biliOne),closed:true},synchronized(biliTwo),{...synchronized(biliOne),available:false,status:'source-changed' as const,candidate:biliTwo}]){
  f.publish(state);assert.equal(button(v,'快速截图').disabled,true);button(v,'快速截图').dispatch('click');await settle();
 }
 assert.equal(f.captures.length,0);assert.equal(urls(v).created.length,0);
 f.publish(synchronized(biliOne,80));const blob=new Blob(['real synced frame'],{type:'image/png'});f.setCapture(async()=>({blob,time:81.25}));await click(v,'快速截图');await click(v,'保存摘录');
 assert.equal(f.saves[0].data.time,81.25);assert.equal(f.saves[0].data.image,blob);await v.onClose();
});

test('pending capture reserves the draft against save, cancel, source switching and concurrent editors',async()=>{
 const f=fixture(),v=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,4));type(editor(v),'keep while capturing');f.setCapture(()=>pending.promise);await click(v,'快速截图');
 assert.equal(v.canMove(),false);assert.equal(editor(v).readOnly,true);for(const label of ['快速截图','保存摘录','取消摘录','记下此刻'])assert.equal(button(v,label).disabled,true,label);
 button(v,'快速截图').dispatch('click');button(v,'保存摘录').dispatch('click');button(v,'取消摘录').dispatch('click');await v.setState({source:another.path});await click(v,'独立窗口');
 assert.equal(v.currentSource().path,youtube.path);assert.equal(f.opens.length,0);assert.equal(f.saves.length,0);assert.equal(f.captures.length,1);assert.equal(editor(v).value,'keep while capturing');
 const otherEditor=await open(f);assert.equal(editor(otherEditor).readOnly,true);assert.equal(button(otherEditor,'快速截图').disabled,true);button(otherEditor,'快速截图').dispatch('click');await settle();assert.equal(f.captures.length,1);
 pending.resolve({blob:new Blob(['frame'],{type:'image/png'}),time:5.5});await settle();assert.equal(editor(v).value,'keep while capturing');assert.equal(editor(otherEditor).readOnly,true);await otherEditor.onClose();await v.onClose();
});

test('a capture started without a draft blocks switching and releases its reservation after failure',async()=>{
 const f=fixture(),v=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,4));f.setCapture(()=>pending.promise);assert.equal(v.canMove(),true);await click(v,'快速截图');
 assert.equal(editor(v).value,'');assert.equal(v.canMove(),false);await v.setState({source:another.path});assert.equal(v.currentSource().path,youtube.path);
 const otherEditor=await open(f);assert.equal(editor(otherEditor).readOnly,true);assert.equal(button(otherEditor,'快速截图').disabled,true);
 pending.reject(Error('no frame available'));await settle();assert.equal(v.canMove(),true);assert.equal(otherEditor.canMove(),true);assert.equal(editor(otherEditor).readOnly,false);assert.equal(button(v,'保存摘录').disabled,true);assert.equal(urls(v).created.length,0);
 await v.onClose();await otherEditor.onClose();
});

test('an editor owned by another open view cannot start a screenshot or replace its timestamp',async()=>{
 const f=fixture(),owner=await open(f);f.publish(synchronized(youtube,6));type(editor(owner),'owned text');const otherEditor=await open(f);
 assert.equal(button(otherEditor,'快速截图').disabled,true);assert.equal(button(otherEditor,'记下此刻').disabled,true);
 button(otherEditor,'快速截图').dispatch('click');button(otherEditor,'记下此刻').dispatch('click');await settle();assert.equal(f.captures.length,0);assert.equal(editor(owner).value,'owned text');
 await click(owner,'保存摘录');assert.equal(f.saves[0].data.time,6);await owner.onClose();await otherEditor.onClose();
});

for(const invalidation of ['unavailable','closed','other-source','other-part','candidate']as const)test(`a capture result after ${invalidation} is rejected without discarding existing text`,async()=>{
 const f=fixture(),v=await open(f,biliOne),pending=deferred<Capture>();f.publish(synchronized(biliOne,8));type(editor(v),'original text');f.setCapture(()=>pending.promise);await click(v,'快速截图');
 const state=invalidation==='other-source'?synchronized(youtube,20):invalidation==='other-part'?synchronized(biliTwo,20):{...synchronized(biliOne,20),available:invalidation==='closed',closed:invalidation==='closed',...(invalidation==='candidate'?{status:'source-changed' as const,candidate:biliTwo}:{})};
 f.publish(state);pending.resolve({blob:new Blob(['stale frame'],{type:'image/png'}),time:19.875});await settle();
 assert.equal(editor(v).value,'original text');assert.equal(urls(v).created.length,0);assert.equal(preview(v)?.src||'','');assert.equal(button(v,'保存摘录').disabled,false);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.text,'original text');assert.equal(f.saves[0].data.time,8);assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('losing then regaining source synchronization still rejects the earlier in-flight frame',async()=>{
 const f=fixture(),v=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,8));type(editor(v),'before sync loss');f.setCapture(()=>pending.promise);await click(v,'快速截图');
 f.publish({...synchronized(youtube,30),available:false});f.publish(synchronized(youtube,31));pending.resolve({blob:new Blob(['stale'],{type:'image/png'}),time:30.5});await settle();
 assert.equal(urls(v).created.length,0);assert.equal(editor(v).value,'before sync loss');await click(v,'保存摘录');assert.equal(f.saves[0].data.time,8);assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('a failed host capture keeps the original editable text and timestamp and clears its reservation',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,10.25));type(editor(v),'capture can fail');f.setCapture(async()=>{throw Error('capture unavailable');});await click(v,'快速截图');
 assert.equal(editor(v).value,'capture can fail');assert.equal(editor(v).readOnly,false);assert.equal(urls(v).created.length,0);assert.equal(button(v,'快速截图').disabled,false);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,10.25);assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('closing during capture rejects the old result after the same source reopens and preserves its text',async()=>{
 const f=fixture(),first=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,11.5));type(editor(first),'survive pending close');f.setCapture(()=>pending.promise);await click(first,'快速截图');
 await first.onClose();const restored=await open(f);assert.equal(editor(restored).value,'survive pending close');
 pending.resolve({blob:new Blob(['closed view frame'],{type:'image/png'}),time:12});await settle();assert.equal(urls(first).created.length,0);assert.equal(urls(restored).created.length,0);assert.equal(editor(restored).value,'survive pending close');assert.equal(editor(restored).readOnly,false);
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,11.5);assert.equal(f.saves[0].data.image,undefined);await restored.onClose();
});

test('closing during capture cannot add a frame to a different reopened source or clear either draft',async()=>{
 const f=fixture(),first=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,10));type(editor(first),'source A');f.setCapture(()=>pending.promise);await click(first,'快速截图');await first.onClose();
 const current=await open(f,another);f.publish(synchronized(another,40));type(editor(current),'source B');pending.resolve({blob:new Blob(['A stale frame'],{type:'image/png'}),time:11});await settle();
 assert.equal(editor(current).value,'source B');assert.equal(urls(current).created.length,0);await click(current,'保存摘录');assert.equal(f.saves[0].source,another.path);assert.equal(f.saves[0].data.time,40);assert.equal(f.saves[0].data.image,undefined);await current.onClose();
 const restored=await open(f);assert.equal(editor(restored).value,'source A');assert.equal(urls(restored).created.length,0);await restored.onClose();
});

test('image blobs survive close and reopen while each view owns and releases its own preview URL',async()=>{
 const f=fixture(),first=await open(f),blob=new Blob(['persisted frame'],{type:'image/png'});f.publish(synchronized(youtube,20));type(editor(first),'caption');f.setCapture(async()=>({blob,time:21.5}));await click(first,'快速截图');
 const oldURL=preview(first)!.src;assert.equal(urls(first).active.get(oldURL),blob);for(let tick=0;tick<10;tick++)f.publish(synchronized(youtube,22+tick*.4));assert.equal(urls(first).created.length,1);
 await first.onClose();assert.deepEqual(urls(first).revoked,[oldURL]);const restored=await open(f),newURL=preview(restored)!.src;
 assert.notEqual(newURL,oldURL);assert.equal(urls(restored).active.get(newURL),blob);assert.equal(editor(restored).value,'caption');assert.equal(f.captures.length,1);
 await click(restored,'移除截图');assert.deepEqual(urls(restored).revoked,[newURL]);assert.equal(preview(restored)?.src||'','');assert.equal(editor(restored).value,'caption');
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,21.5);assert.equal(f.saves[0].data.image,undefined);await restored.onClose();assert.deepEqual(urls(restored).revoked,[newURL]);
});

test('canceling an image draft releases its preview and does not restore the canceled image on reopen',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));await click(v,'快速截图');const url=preview(v)!.src;
 await click(v,'取消摘录');assert.deepEqual(urls(v).revoked,[url]);assert.equal(urls(v).active.size,0);assert.equal(v.canMove(),true);await v.onClose();assert.deepEqual(urls(v).revoked,[url]);
 const restored=await open(f);assert.equal(preview(restored)?.src||'','');assert.equal(urls(restored).created.length,0);assert.equal(button(restored,'保存摘录').disabled,true);await restored.onClose();
});

test('failed image save locks the original blob, id and frame time for a retry without recapturing',async()=>{
 const f=fixture(),v=await open(f),blob=new Blob(['retry frame'],{type:'image/png'});f.publish(synchronized(youtube,18));type(editor(v),'frame caption');f.setCapture(async()=>({blob,time:18.75}));await click(v,'快速截图');
 const oldURL=preview(v)!.src;f.setWrite(async()=>{throw Error('save acknowledgement failed');});await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.image,blob);assert.equal(urls(v).active.get(oldURL),blob);assert.equal(editor(v).readOnly,true);
 for(const label of ['快速截图','记下此刻','移除截图'])assert.equal(button(v,label).disabled,true,label);await v.onClose();assert.deepEqual(urls(v).revoked,[oldURL]);
 const restored=await open(f);assert.equal(urls(restored).active.get(preview(restored)!.src),blob);assert.equal(editor(restored).readOnly,true);f.setWrite(async()=>({note:f.noteA}));await click(restored,'保存摘录');
 assert.equal(f.captures.length,1);assert.deepEqual(f.saves[1].data,f.saves[0].data);assert.equal(f.saves[1].data.image,blob);assert.equal(urls(restored).active.size,0);assert.equal(restored.canMove(),true);await restored.onClose();
});

test('timeline screenshots render through MarkdownRenderer with the source note path and forward their image',async()=>{
 const f=fixture(),entry:Moment={id:'picture',time:9.75,text:'picture caption',image:'![[frames/截图.png]]',line:4},start=markdownRenders.length;
 f.setRead(async()=>({note:f.noteA,entries:[entry]}));const v=await open(f);await settle();const renders=markdownRenders.slice(start);assert.equal(renders.length,1);
 assert.equal(renders[0].text,entry.image);assert.equal(renders[0].path,f.noteA.path);assert.equal(renders[0].component.loads,1);assert.equal(renders[0].component.unloads,0);assert.equal(rows(v)[0].contains(renders[0].holder),true);
 await click(v,'发送到白板');assert.deepEqual(f.sent,[{source:youtube.path,time:entry.time,text:entry.text,image:entry.image}]);await v.onClose();assert.equal(renders[0].component.unloads,1);
});

test('timeline image components are released on refresh and close without being rebuilt by playback state',async()=>{
 const f=fixture(),start=markdownRenders.length;f.setRead(async()=>({note:f.noteA,entries:[{id:'one',time:1,text:'one',image:'![[one.png]]',line:1},{id:'two',time:2,text:'two',image:'![[two.png]]',line:2}]}));
 const v=await open(f);await settle();const first=markdownRenders.slice(start),firstScopes=[...new Set(first.map(render=>render.component))];assert.equal(first.length,2);
 for(let tick=0;tick<10;tick++)f.publish(synchronized(youtube,tick*.4));assert.equal(markdownRenders.length,start+2);for(const scope of firstScopes)assert.equal(scope.unloads,0);
 await click(v,'刷新摘录');const refreshed=markdownRenders.slice(start+2),nextScopes=[...new Set(refreshed.map(render=>render.component))];assert.equal(refreshed.length,2);
 for(const scope of firstScopes)assert.equal(scope.unloads,1);for(const scope of nextScopes){assert.equal(scope.loads,1);assert.equal(scope.unloads,0);assert.ok(!firstScopes.includes(scope));}
 await v.onClose();for(const scope of [...firstScopes,...nextScopes])assert.equal(scope.unloads,1);
});

test('timeline screenshots render only the current fifty-entry page and release earlier page components',async()=>{
 const f=fixture(),start=markdownRenders.length;f.setRead(async()=>({note:f.noteA,entries:Array.from({length:51},(_,index)=>({id:String(index),time:index,text:`image ${index}`,image:`![[frame-${index}.png]]`,line:index+1}))}));
 const v=await open(f);await settle();const first=markdownRenders.slice(start);assert.equal(first.length,50);assert.equal(rows(v).length,50);
 await click(v,'下一页');const last=markdownRenders.slice(start+50);assert.equal(last.length,1);assert.equal(last[0].text,'![[frame-50.png]]');assert.equal(rows(v).length,1);
 for(const scope of new Set(first.map(render=>render.component)))assert.equal(scope.unloads,1);await v.onClose();assert.equal(last[0].component.unloads,1);
});

test('narrow online panels retain mount, IME draft and editor selection while restoring view state',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));const input=v.input;input.value='draft';input.dispatch('input');input.dispatch('compositionstart');input.value='draft 正在输入';input.selectionStart=2;input.selectionEnd=5;const draft=v.memory.draft,mount=f.mounts[0];
 for(const label of ['写摘录','时间轴','播放','写摘录'])await click(v,label);assert.equal(v.getState().panel,'compose');assert.equal(v.input,input);assert.equal(v.memory.draft,draft);assert.equal(input.value,'draft 正在输入');assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,5);assert.equal(v.composing,true);assert.equal(f.mounts.length,1);assert.equal(mount.released,0);
 await v.setState({...v.getState(),panel:'timeline'});assert.equal(v.getState().panel,'timeline');assert.equal(v.input,input);assert.equal(mount.released,0);input.dispatch('compositionend');await v.onClose();const next=await open(f,youtube,{panel:'compose'});assert.equal(next.getState().panel,'compose');assert.equal(next.input.value,'draft 正在输入');await next.onClose();
});

test('mobile manual recording never mounts or controls the desktop player and keeps failed saves across panel restoration',async()=>{
 const f=fixture(),external:string[]=[];Object.assign(f.host,{playbackAvailable:()=>false,openExternal:async(path:string)=>{external.push(path);}});f.setWrite(async()=>{throw Error('mobile storage unavailable');});
 const v=await open(f,youtube,{panel:'player'});f.publish(synchronized(youtube,80));assert.equal(f.mounts.length,0);assert.equal(v.getState().time,undefined);assert.equal(button(v,'加载视频 / 重试').disabled,true);assert.equal(button(v,'快速截图').disabled,true);assert.equal(v.manualFallback.open,true);
 await click(v,'在浏览器打开视频');assert.deepEqual(external,[youtube.path]);assert.deepEqual(f.commands,[]);assert.deepEqual(f.opens,[]);
 await click(v,'写摘录');v.manual.value='1:23';await click(v,'确认时间');type(editor(v),'mobile draft');const original={...v.memory.draft};await click(v,'保存摘录');assert.equal(v.memory.draft.text,original.text);assert.match(status(v),/mobile storage unavailable/);await click(v,'时间轴');const state=v.getState();await v.onClose();
 const next=await open(f,youtube,state);assert.equal(next.getState().panel,'timeline');assert.equal(next.input.value,'mobile draft');assert.equal(next.memory.draft.id,original.id);assert.equal(next.memory.draft.time,83);assert.equal(f.mounts.length,0);assert.deepEqual(f.commands,[]);await next.onClose();
});

test('IME close without compositionend retains the visible online draft and blocks touch save or cancellation',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));const input=editor(v);type(input,'before');input.dispatch('compositionstart');input.value='before 中文合成';await click(v,'保存摘录');await click(v,'取消摘录');assert.equal(f.saves.length,0);assert.equal(input.value,'before 中文合成');await v.onClose();
 const next=await open(f);assert.equal(editor(next).value,'before 中文合成');await next.onClose();
});

test('composition owns the empty online editor across concurrent views until it is closed',async()=>{
 const f=fixture(),first=await open(f);f.publish(synchronized(youtube));first.input.dispatch('compositionstart');first.input.value='首个窗口合成';const other=await open(f);assert.equal(other.input.readOnly,true);await first.onClose();assert.equal(other.input.value,'首个窗口合成');assert.equal(other.input.readOnly,false);await other.onClose();
});


// Real view + actual composition-layout controller. Viewport/inset helpers are
// recorded lifecycle dependencies here; these are DOM contracts, not geometry.
function layoutDocument(){
 const document:any=new Element().ownerDocument,frames=new Map<number,()=>void>(),listeners=new Map<string,Set<()=>void>>();let sequence=0;
 document.body=new Element();document.body.ownerDocument=document;document.activeElement=document.body;
 Object.assign(document.defaultView,{Node:Element,requestAnimationFrame:(fn:()=>void)=>{frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:(id:number)=>frames.delete(id),addEventListener:(type:string,fn:()=>void)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type)!.add(fn);},removeEventListener:(type:string,fn:()=>void)=>listeners.get(type)?.delete(fn)});
 return{document,frames,listeners,resize(){for(const fn of listeners.get('resize')??[])fn();const queued=[...frames.values()];frames.clear();for(const fn of queued)fn();}};
}
async function layoutView(f:ReturnType<typeof fixture>,width=316,height=302){const env=layoutDocument(),v=f.view();v.contentEl.ownerDocument=env.document;v.contentEl.box={width,height,top:0};await v.onOpen();await v.setState({source:youtube.path,panel:'compose'});return{...env,v,root:v.contentEl as Element,details:v.contentEl.querySelector('.ts-online-workspace__composer-details') as Element,summary:v.contentEl.querySelector('.ts-online-workspace__composer-details summary') as Element};}
for(const mode of ['manual','timestamp','screenshot'] as const)test(`actual view ${mode} action reveals the same textarea after fixing time`,async()=>{
 realComposerLayout=true;let v:any;
 try{const f=fixture();if(mode==='manual')Object.assign(f.host,{playbackAvailable:()=>false});const x=await layoutView(f);v=x.v;const input=editor(v),binding=layoutBindings.at(-1)!;
  assert.equal(x.details.open,true);if(mode==='manual'){type(v.manual,'1:23');await click(v,'确认时间');}else{f.publish(synchronized(youtube,83));x.details.open=true;button(v,mode==='timestamp'?'记下此刻':'快速截图').focus();await click(v,mode==='timestamp'?'记下此刻':'快速截图');}
  assert.equal(editor(v),input);assert.equal(x.details.open,false);assert.equal(binding.reveals,1);assert.equal(x.document.activeElement,input);assert.equal(input.readOnly,false);assert.equal(input.getClientRects().length,1);assert.equal(v.memory.draft?.time??v.memory.manualTime,83);await v.onClose();assert.equal(binding.disposed,1);
 }finally{await v?.onClose();realComposerLayout=false;}
});
test('actual view migration rebinds layout to current document without recreating textarea or mount',async()=>{
 realComposerLayout=true;let v:any;
 try{const f=fixture(),x=await layoutView(f);v=x.v;f.publish(synchronized(youtube,40));type(editor(v),'中文 עברית preserved');const input=editor(v),mount=f.mounts[0],old=layoutBindings.at(-1)!,oldInset=insetBindings.at(-1)!,oldViewport=viewportBindings.at(-1)!,next=layoutDocument();input.selectionStart=2;input.selectionEnd=5;input.scrollTop=23;
  for(const node of x.root.all())node.ownerDocument=next.document;next.document.activeElement=input;v.onWindowMigrated();
  const rebound=layoutBindings.at(-1)!;assert.notEqual(rebound,old);assert.equal(old.disposed,1);assert.equal(oldInset.disposed,1);assert.equal(oldViewport.disposed,1);assert.equal(rebound.document,next.document);assert.equal(editor(v),input);assert.equal(input.value,'中文 עברית preserved');assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,5);assert.equal(input.scrollTop,23);assert.equal(next.document.activeElement,input);assert.equal(f.mounts[0],mount);assert.equal(mount.released,0);assert.equal(x.listeners.get('resize')?.size,0);
  await v.onClose();const count=layoutBindings.length;v.onWindowMigrated();assert.equal(layoutBindings.length,count);assert.equal(rebound.disposed,1);assert.equal(next.listeners.get('resize')?.size,0);assert.equal(mount.released,1);
 }finally{await v?.onClose();realComposerLayout=false;}
});
test('actual view source rerender disposes prior layout and leaves only current metadata controller',async()=>{
 realComposerLayout=true;let v:any;
 try{const f=fixture(),x=await layoutView(f);v=x.v;const old=layoutBindings.at(-1)!,oldDetails=x.details;await v.setState({source:another.path,panel:'compose'});const current=layoutBindings.at(-1)!;
  assert.equal(old.disposed,1);assert.notEqual(current,old);assert.notEqual(editor(v).parentElement,oldDetails.parentElement);oldDetails.dispatch('toggle');assert.equal(current.disposed,0);assert.equal(x.listeners.get('resize')?.size,1);await v.onClose();assert.equal(current.disposed,1);
 }finally{await v?.onClose();realComposerLayout=false;}
});
test('actual view normal-layout summary handoff chooses visible manual input or editor',async()=>{
 realComposerLayout=true;let v:any;
 try{const f=fixture();Object.assign(f.host,{playbackAvailable:()=>false});const x=await layoutView(f);v=x.v;x.summary.focus();x.root.box={width:1000,height:700,top:0};x.resize();assert.equal(x.document.activeElement,v.manual);assert.equal(v.manual.getClientRects().length,1);
  type(v.manual,'1:23');await click(v,'确认时间');x.root.box={width:316,height:302,top:0};x.resize();x.summary.focus();x.root.box={width:1000,height:700,top:0};x.resize();assert.equal(x.document.activeElement,editor(v));assert.equal(editor(v).getClientRects().length,1);await v.onClose();
 }finally{await v?.onClose();realComposerLayout=false;}
});

test('actual unsynchronized desktop fallback keeps inner details closed and transfers summary focus to its visible summary',async()=>{
 realComposerLayout=true;let v:any;
 try{const f=fixture(),x=await layoutView(f);v=x.v;const fallback=v.contentEl.querySelector('.ts-online-workspace__manual-fallback') as Element,manualSummary=fallback.querySelector('summary');assert.equal(fallback.open,false);assert.equal(v.manual.getClientRects().length,0);x.summary.focus();x.root.box={width:1000,height:700,top:0};x.resize();assert.equal(fallback.open,false);assert.equal(x.document.activeElement,manualSummary);assert.equal(manualSummary!.getClientRects().length,1);assert.equal(v.manual.getClientRects().length,0);await v.onClose();
 }finally{await v?.onClose();realComposerLayout=false;}
});

test('fresh ready source render starts metadata collapsed instead of inheriting the new details default open',async()=>{
 realComposerLayout=true;let v:any;
 try{const f=fixture(),x=await layoutView(f);v=x.v;f.publish(synchronized(youtube,30));const old=x.details;old.open=false;old.dispatch('toggle');assert.equal(old.open,false);f.publish(synchronized(another,40));await v.setState({source:another.path,panel:'compose'});const details=v.contentEl.querySelector('.ts-online-workspace__composer-details');assert.notEqual(details,old);assert.equal(details.open,false);assert.equal(v.contentEl.dataset.onlineShort,'true');await v.onClose();
 }finally{await v?.onClose();realComposerLayout=false;}
});
test('same-node migration retains deliberately open metadata when summary owns focus',async()=>{
 realComposerLayout=true;let v:any;
 try{const f=fixture(),x=await layoutView(f);v=x.v;f.publish(synchronized(youtube,30));x.details.open=true;x.details.dispatch('toggle');x.summary.focus();const next=layoutDocument();for(const node of x.root.all())node.ownerDocument=next.document;next.document.activeElement=x.summary;v.onWindowMigrated();assert.equal(v.contentEl.querySelector('.ts-online-workspace__composer-details'),x.details);assert.equal(x.details.open,true);assert.equal(next.document.activeElement,x.summary);await v.onClose();
 }finally{await v?.onClose();realComposerLayout=false;}
});

// Actual view + real persistence store across distinct host identities; no browser, real vault or network.
class OnlineStorageFixture implements OnlineDraftStorage {
 rows=new Map<string,StoredOnlineDraft>();failWrite=false;failDelete=false;readFailure=false;
 gate?:ReturnType<typeof deferred<void>>;writes=0;removed=0;
 async read(){if(this.readFailure)throw Error('read storage failed');return [...this.rows.values()].map(value=>structuredClone(value));}
 async replace(value:StoredOnlineDraft,expected?:OnlineDraftStamp){
  if(this.gate){const gate=this.gate;this.gate=undefined;await gate.promise;}
  if(this.failWrite)throw Error('backup unavailable');const old=this.rows.get(value.id);
  assert.deepEqual(old?{revision:old.revision,lease:old.lease}:undefined,expected,'storage owner is exact');
  if([...this.rows.values()].some(row=>row.id!==value.id&&row.key===value.key))throw Error('alias slot occupied');
  this.rows.set(value.id,structuredClone(value));this.writes++;
 }
 async remove(id:string,expected?:OnlineDraftStamp){
  if(this.failDelete)throw Error('cleanup unavailable');const old=this.rows.get(id);assert.deepEqual(old?{revision:old.revision,lease:old.lease}:undefined,expected,'remove owner is exact');this.rows.delete(id);this.removed++;
 }
}
async function persistenceFixture(storage=new OnlineStorageFixture()){
 const f=fixture(),drafts=new OnlineDraftStore(storage,()=>{},{setTimeout:()=>1,clearTimeout:()=>{}});await drafts.load();Object.assign(f.host,{drafts});f.publish(synchronized(youtube,83));return{...f,drafts,storage};
}
async function persistedView(storage?:OnlineStorageFixture){const f=await persistenceFixture(storage),v=await open(f);type(editor(v),'重启保留\n原始正文与标点。\n');await f.drafts.flush();return{...f,v};}
function visibleFailureStatus(v:any){Object.assign(v.contentEl.ownerDocument,{hasFocus:()=>true,visibilityState:'visible',elementFromPoint:()=>v.status});Object.assign(v.contentEl.ownerDocument.defaultView,{innerWidth:360,innerHeight:380,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})});v.status.box={left:0,top:290,right:360,bottom:380,width:360,height:90};}
test('exact active draft failure paints durable inline feedback before the store subscriber and preserves retry data',async()=>{
 const f=fixture(),storage=new OnlineStorageFixture();let view:any,covered=false;
 const drafts=new OnlineDraftStore(storage,(_error,ids)=>{covered=view.showDraftStorageFailure(drafts,ids!);assert.match(status(view),/本机备份不可用/);},{setTimeout:()=>1,clearTimeout:()=>{}});await drafts.load();Object.assign(f.host,{drafts});view=await open(f);visibleFailureStatus(view);f.publish(synchronized(youtube,83));type(editor(view),'original retry text');const original={...view.memory.draft};storage.failWrite=true;await assert.rejects(drafts.flush());assert.equal(covered,true);assert.equal(button(view,'重试暂存').hidden,false);assert.deepEqual(view.memory.draft,original);assert.equal(storage.rows.size,0);assert.equal(f.saves.length,0);storage.failWrite=false;await click(view,'重试暂存');assert.equal(button(view,'重试暂存').hidden,true);assert.match(status(view),/草稿已暂存到本机/);assert.equal(editor(view).value,original.text);assert.equal(f.saves.length,0);await view.onClose();
});
test('inline feedback never covers another store, background draft, hidden/foreign status or different safety branch',async()=>{
 const f=await persistenceFixture(),v=await open(f);visibleFailureStatus(v);type(editor(v),'owner');f.storage.failWrite=true;await assert.rejects(f.drafts.flush());const id=v.memory.draft.id;
 assert.equal(v.showDraftStorageFailure(f.drafts,[id]),true);assert.equal(v.showDraftStorageFailure(new OnlineDraftStore(new OnlineStorageFixture(),()=>{},{setTimeout:()=>1,clearTimeout:()=>{}}),[id]),false);assert.equal(v.showDraftStorageFailure(f.drafts,['other']),false);assert.equal(v.showDraftStorageFailure(f.drafts,[id,'background']),false);
 for(const field of ['restoreBlocked','recovered']){v.memory[field]=true;assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);v.memory[field]=false;}
 v.memory.phase='committed';assert.equal(v.showDraftStorageFailure(f.drafts,[id]),true);assert.match(status(v),/^笔记已保存；本机暂存尚未清理/);assert.doesNotMatch(status(v),/尚未开始新的笔记写入/);v.memory.phase='editing';
 f.app.workspace.activeLeaf={view:{}};assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);f.app.workspace.activeLeaf=v.leaf;
 v.status.visible=false;assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);v.status.visible=true;
 v.status.box.bottom=430;assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);visibleFailureStatus(v);
 const doc=v.status.ownerDocument;v.status.ownerDocument=new Element().ownerDocument;assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);v.status.ownerDocument=doc;
 doc.defaultView.closed=true;assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);doc.defaultView.closed=false;
 Object.assign(doc,{hasFocus:()=>false});assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);Object.assign(doc,{hasFocus:()=>true,visibilityState:'hidden'});assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);Object.assign(doc,{visibilityState:'visible',elementFromPoint:()=>new Element()});assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);visibleFailureStatus(v);
 v.contentEl.connected=false;assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);v.contentEl.connected=true;await v.onClose();assert.equal(v.showDraftStorageFailure(f.drafts,[id]),false);
});
test('short status shows current failure first without changing editor focus or body scrolling',async()=>{
 const f=await persistenceFixture(),v=await open(f);visibleFailureStatus(v);type(editor(v),'retained');v.statusMessage='旧的手动时间确认';v.status.box={left:0,top:352,right:360,bottom:380,width:360,height:28};v.status.scrollTop=40;const focus=v.contentEl.ownerDocument.activeElement;f.storage.failWrite=true;await assert.rejects(f.drafts.flush());assert.equal(v.showDraftStorageFailure(f.drafts,[v.memory.draft.id]),true);assert.match(status(v),/^本机备份不可用/);assert.equal(v.status.scrollTop,0);assert.equal(v.contentEl.ownerDocument.activeElement,focus);assert.equal(editor(v).value,'retained');await v.onClose();
});
test('shared draft in a second window only covers feedback through the current exact view and owner document',async()=>{
 const f=await persistenceFixture(),first=await open(f);visibleFailureStatus(first);type(editor(first),'shared across windows');f.storage.failWrite=true;await assert.rejects(f.drafts.flush());const id=first.memory.draft.id,second=await open(f);visibleFailureStatus(second);assert.notEqual(first.contentEl.ownerDocument,second.contentEl.ownerDocument);assert.equal(second.memory,first.memory);assert.equal(first.showDraftStorageFailure(f.drafts,[id]),false);assert.equal(second.showDraftStorageFailure(f.drafts,[id]),true);await first.onClose();await second.onClose();
});
const receipt=(f:ReturnType<typeof fixture>,draft:Draft)=>({note:f.noteA,entries:[{id:draft.id,time:draft.time,text:draft.text,line:1}]});
test('persisted editing draft reopens on a different host editable with original id/time/Blob',async()=>{
 const f=await persistedView();await click(f.v,'快速截图');await f.drafts.flush();const draft={...f.v.memory.draft},state=f.v.getState();await f.v.onClose();await f.drafts.dispose();
 const next=await persistenceFixture(f.storage),v=await open(next,youtube,state);assert.equal(v.memory.draft.id,draft.id);assert.equal(editor(v).value,draft.text);assert.equal(v.memory.draft.time,83);assert.equal(await v.memory.draft.image.text(),await draft.image.text());assert.equal(editor(v).readOnly,false);type(editor(v),'恢复后继续');await next.drafts.flush();assert.equal(next.storage.rows.get(draft.id)!.text,'恢复后继续');await v.onClose();
});
test('prepared storage rejection performs zero note calls, restores editing, and retries exact id',async()=>{
 const f=await persistedView(),id=f.v.memory.draft.id;f.storage.failWrite=true;await click(f.v,'保存摘录');assert.equal(f.saves.length,0);assert.equal(editor(f.v).readOnly,false);assert.equal(f.v.memory.phase,'editing');assert.match(status(f.v),/尚未写笔记/);type(editor(f.v),'仍可编辑');assert.equal(f.v.memory.draft.id,id);f.storage.failWrite=false;await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.id,id);assert.equal(f.v.memory.draft,undefined);assert.equal(f.storage.rows.size,0);await f.v.onClose();
});
test('failed prepared transaction leaves prior disk editing recoverable after a full new host',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft},state=f.v.getState();f.storage.failWrite=true;await click(f.v,'保存摘录');assert.equal(f.saves.length,0);assert.equal(f.storage.rows.get(draft.id)!.phase,'editing');await f.v.onClose();await f.drafts.dispose().catch(()=>{});f.storage.failWrite=false;
 const next=await persistenceFixture(f.storage),v=await open(next,youtube,state);assert.equal(v.memory.recovered,false);assert.equal(editor(v).readOnly,false);assert.equal(v.memory.draft.id,draft.id);await v.onClose();
});
for(const change of ['closed','other-leaf','new-host']as const)test(`prepared held across ${change} cannot start a late note write`,async()=>{
 const f=await persistedView(),draft=f.v.memory.draft,gate=deferred<void>();f.storage.gate=gate;f.v.saveButton.click();await settle();assert.equal(f.saves.length,0);
 let closing:Promise<void>|undefined;
 if(change==='closed')closing=f.v.onClose();if(change==='other-leaf')f.app.workspace.activeLeaf={view:{}};if(change==='new-host')closing=f.drafts.dispose();
 gate.resolve();await settle();await closing;assert.equal(f.saves.length,0);assert.equal(f.v.memory.draft,draft);assert.equal(f.storage.rows.get(draft.id)!.phase,'prepared');
});
for(const phase of ['prepared','committed']as const)test(`recovered ${phase} queries only exact receipt and never creates a note on unknown result`,async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.drafts.stage({id:draft.id,source:youtube.path,note:phase==='committed'?f.noteA.path:undefined,time:draft.time,text:draft.text,mode:'synced',image:draft.image,phase});await f.drafts.flush();await f.v.onClose();await f.drafts.dispose();
 const next=await persistenceFixture(f.storage),v=await open(next,youtube,{note:phase==='committed'?f.noteA.path:undefined,draftId:draft.id});await click(v,'保存摘录');assert.equal(next.saves.length,0);assert.equal(editor(v).value,draft.text);assert.equal(editor(v).readOnly,true);assert.match(status(v),/上次保存结果未确认/);assert.equal(next.storage.rows.size,1);
 next.setRead(async()=>receipt(next,draft));await click(v,'保存摘录');assert.equal(next.saves.length,0);assert.equal(next.storage.rows.size,0);assert.equal(v.memory.draft,undefined);await v.onClose();
});
test('successful note followed by committed-write and delete failures cannot save again; restart verifies same receipt',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.setWrite(async()=>{f.storage.failWrite=true;f.storage.failDelete=true;return{note:f.noteA};});await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.v.memory.phase,'committed');assert.equal(f.storage.rows.get(draft.id)!.phase,'prepared');assert.match(status(f.v),/笔记已保存/);
 f.setRead(async()=>receipt(f,draft));await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.v.memory.draft.id,draft.id);const state=f.v.getState();await f.v.onClose();await f.drafts.dispose().catch(()=>{});f.storage.failWrite=false;f.storage.failDelete=false;
 const next=await persistenceFixture(f.storage);next.setRead(async()=>receipt(next,draft));const v=await open(next,youtube,state);await click(v,'保存摘录');assert.equal(next.saves.length,0);assert.equal(next.storage.rows.size,0);assert.equal(v.currentNote(),next.noteA.path);await v.onClose();
});
test('note success and cleanup failure persists exact note; next host cleanup writes no second receipt',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.storage.failDelete=true;await click(f.v,'保存摘录');assert.equal(f.saves.length,1);const row=f.storage.rows.get(draft.id)!;assert.equal(row.phase,'committed');assert.equal(row.note,f.noteA.path);const state=f.v.getState();await f.v.onClose();await f.drafts.dispose();f.storage.failDelete=false;
 const next=await persistenceFixture(f.storage);next.setRead(async()=>receipt(next,draft));const v=await open(next,youtube,state);await click(v,'保存摘录');assert.equal(next.saves.length,0);assert.equal(next.storage.rows.size,0);await v.onClose();
});
test('known current-host note failure retries the locked original id after preparation',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.setWrite(async()=>{throw Error('note failed before receipt');});await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.v.memory.recovered,undefined);assert.equal(editor(f.v).readOnly,true);f.setWrite(async()=>({note:f.noteA}));await click(f.v,'保存摘录');assert.equal(f.saves.length,2);assert.equal(f.saves[1].data.id,draft.id);assert.equal(f.storage.rows.size,0);await f.v.onClose();
});
test('cancel failure preserves entire current draft and reports no success',async()=>{
 const f=await persistedView();await click(f.v,'快速截图');await f.drafts.flush();const draft=f.v.memory.draft;f.storage.failDelete=true;await click(f.v,'取消摘录');assert.equal(f.v.memory.draft,draft);assert.match(status(f.v),/取消摘录失败/);assert.doesNotMatch(status(f.v),/已取消当前摘录/);assert.equal(await draft.image.text(),'PNG');assert.equal(button(f.v,'导出截图').disabled,false);const oldNodes=f.v.contentEl.all().length;await click(f.v,'导出截图');assert.equal(f.v.contentEl.all().length,oldNodes);f.storage.failDelete=false;await click(f.v,'取消摘录');assert.equal(f.v.memory.draft,undefined);await f.v.onClose();
});
test('two same-host alias leaves retain one draft and one pending transaction',async()=>{
 const f=await persistenceFixture();f.setRead(async()=>({note:f.noteA,entries:[]}));const a=await open(f);type(editor(a),'shared');await f.drafts.flush();const b=await open(f,youtube,{note:f.noteA.path}),draft=a.memory.draft;assert.equal(b.memory,a.memory);const held=deferred<{note:TFile}>();f.setWrite(()=>held.promise);f.app.workspace.activeLeaf=a.leaf;a.saveButton.click();await settle();b.saveButton.click();await settle();assert.equal(f.saves.length,1);held.resolve({note:f.noteA});await settle();assert.equal(a.memory.draft,undefined);assert.equal(b.input.value,'');assert.equal(f.saves[0].data.id,draft.id);await a.onClose();await b.onClose();
});
test('old host pending note completion cannot clear the new host recovered record',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft},held=deferred<{note:TFile}>();f.setWrite(()=>held.promise);f.v.saveButton.click();await settle();assert.equal(f.saves.length,1);await f.drafts.dispose();const next=await persistenceFixture(f.storage),v=await open(next,youtube,{draftId:draft.id});held.resolve({note:f.noteA});await settle();assert.equal(v.memory.draft.id,draft.id);assert.equal(next.storage.rows.get(draft.id)!.phase,'prepared');assert.equal(next.storage.removed,0);await v.onClose();
});
test('unavailable backup blocks new note writes but preserves editable text and exportable image without protection claim',async()=>{
 const storage=new OnlineStorageFixture();storage.readFailure=true;const f=await persistenceFixture(storage),v=await open(f);type(editor(v),'未受保护但仍在内存');await click(v,'快速截图');await click(v,'保存摘录');assert.equal(f.saves.length,0);assert.equal(editor(v).readOnly,false);assert.equal(v.memory.draft.text,'未受保护但仍在内存');assert.equal(await v.memory.draft.image.text(),'PNG');assert.match(status(v),/暂存失败，尚未写笔记/);assert.doesNotMatch(status(v),/草稿已暂存到本机/);assert.equal(button(v,'导出截图').disabled,false);await v.onClose();
});
test('wrong receipt id or pinned note cannot clear a recovered pending snapshot',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.drafts.stage({id:draft.id,source:youtube.path,note:f.noteA.path,time:83,text:draft.text,mode:'manual',phase:'prepared'});await f.drafts.flush();await f.v.onClose();await f.drafts.dispose();
 const next=await persistenceFixture(f.storage);next.setRead(async()=>({note:next.noteB,entries:receipt(next,draft).entries}));const v=await open(next,youtube,{note:next.noteA.path,draftId:draft.id});await click(v,'保存摘录');assert.equal(next.saves.length,0);assert.equal(next.storage.rows.size,1);next.setRead(async()=>({note:next.noteA,entries:[{...receipt(next,draft).entries[0],id:'wrong'}]}));await click(v,'保存摘录');assert.equal(next.storage.rows.size,1);assert.equal(v.memory.draft.id,draft.id);await v.onClose();
});
test('committed backup failure never deletes the previous prepared row even when deletion would succeed',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.setWrite(async()=>{f.storage.failWrite=true;return{note:f.noteA};});await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.storage.removed,0);assert.equal(f.storage.rows.get(draft.id)!.phase,'prepared');assert.equal(f.v.memory.phase,'committed');assert.match(status(f.v),/笔记已保存/);f.storage.failWrite=false;f.setRead(async()=>receipt(f,draft));await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.storage.removed,1);await f.v.onClose();
});
test('lagging unbound layout restores committed exact-id note without writing another note',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft},oldState=f.v.getState();f.storage.failDelete=true;await click(f.v,'保存摘录');await f.v.onClose();await f.drafts.dispose();f.storage.failDelete=false;const next=await persistenceFixture(f.storage);next.setRead(async()=>receipt(next,draft));const v=await open(next,youtube,oldState);assert.equal(v.memory.draft.id,draft.id);assert.equal(v.currentNote(),next.noteA.path);assert.equal(editor(v).readOnly,true);await click(v,'保存摘录');assert.equal(next.saves.length,0);assert.equal(next.storage.rows.size,0);await v.onClose();
});
test('explicit retry after read failure saves the current text and image without writing a note',async()=>{
 const storage=new OnlineStorageFixture();storage.readFailure=true;const f=await persistenceFixture(storage),v=await open(f);type(editor(v),'备份恢复后仍是完整中文正文');await click(v,'快速截图');assert.equal(button(v,'重试暂存').hidden,false);storage.readFailure=false;await click(v,'重试暂存');assert.equal(f.saves.length,0);const row=storage.rows.get(v.memory.draft.id)!;assert.equal(row.text,'备份恢复后仍是完整中文正文');assert.equal(await row.image!.text(),'PNG');assert.equal(row.time,83);assert.match(status(v),/草稿已暂存到本机/);assert.equal(button(v,'重试暂存').hidden,true);assert.equal(f.drafts.error,'','complete clean reread resolves the prior read failure');await click(v,'取消摘录');assert.equal(status(v),'已取消当前摘录。');await v.onClose();
});
test('retry never claims invalid current text was protected by an older saved snapshot',async()=>{
 const f=await persistedView(),previous=f.v.memory.draft.text;type(editor(f.v),'x'.repeat(100001));await click(f.v,'重试暂存');assert.equal(f.storage.rows.get(f.v.memory.draft.id)!.text,previous);assert.equal(editor(f.v).value.length,100001);assert.match(status(f.v),/重试暂存失败/);assert.doesNotMatch(status(f.v),/草稿已暂存到本机/);assert.equal(f.saves.length,0);await f.v.onClose();
});
test('concurrent source navigation during initial persistence load keeps the latest requested source',async()=>{
 const storage=new OnlineStorageFixture(),gate=deferred<StoredOnlineDraft[]>();storage.read=()=>gate.promise;const f=fixture(),drafts=new OnlineDraftStore(storage,()=>{},{setTimeout:()=>1,clearTimeout:()=>{}});Object.assign(f.host,{drafts});const v=f.view();await v.onOpen();const a=v.setState({source:youtube.path}),b=v.setState({source:another.path});gate.resolve([]);await Promise.all([a,b]);assert.equal(v.getState().source,another.path);assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].source,another.path);await v.onClose();
});
test('a later backup failure never unlocks an earlier uncertain note attempt or changes its receipt identity',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.setWrite(async()=>{throw Error('acknowledgment unknown');});await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(editor(f.v).readOnly,true);f.storage.failWrite=true;await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(editor(f.v).readOnly,true);assert.equal(f.v.memory.phase,'prepared');assert.equal(f.v.memory.draft.text,draft.text);assert.equal(f.v.memory.draft.id,draft.id);assert.match(status(f.v),/本次未再次写入笔记/);f.storage.failWrite=false;f.setWrite(async()=>({note:f.noteA}));await click(f.v,'保存摘录');assert.equal(f.saves.length,2);assert.equal(f.saves[1].data.id,draft.id);assert.equal(f.saves[1].data.text,draft.text);await f.v.onClose();
});

// Independent reviewer reproduction, retained verbatim.
test('independent: lagging and explicit note aliases share one editor before asynchronous receipt settles',async()=>{
 const storage=new OnlineStorageFixture(),seed=await persistenceFixture(storage);
 seed.drafts.stage({id:'alias-recovery',source:youtube.path,note:seed.noteA.path,time:83,text:'protected original',mode:'manual',phase:'editing'});await seed.drafts.flush();await seed.drafts.dispose();
 const f=await persistenceFixture(storage),pending=deferred<Timeline>();f.setRead(()=>pending.promise);
 const a=f.view();await a.onOpen();const openingA=a.setState({source:youtube.path,draftId:'alias-recovery'});await settle();
 const b=f.view();await b.onOpen();const openingB=b.setState({source:youtube.path,note:f.noteA.path,draftId:'alias-recovery'});await settle();
 const shared=a.memory===b.memory;type(editor(a),'first leaf text');const secondReadOnly=editor(b).readOnly;
 if(!secondReadOnly)type(editor(b),'second leaf overwrote first');await f.drafts.flush();
 const savedText=storage.rows.get('alias-recovery')!.text;pending.resolve({note:f.noteA,entries:[]});await Promise.all([openingA,openingB]);await a.onClose();await b.onClose();
 assert.equal(shared,true,JSON.stringify({shared,secondReadOnly,savedText,a:a.memory?.draft?.text,b:b.memory?.draft?.text}));
 assert.equal(secondReadOnly,true,'same-host editor lease must guard the second alias');
});
for(const reverse of [false,true])for(const phase of ['editing','prepared','committed']as const)test(`recovered ${phase} aliases synchronously share one memory with reverse=${reverse}`,async()=>{
 const storage=new OnlineStorageFixture(),seed=await persistenceFixture(storage),image=new Blob(['original frame'],{type:'image/png'});seed.drafts.stage({id:'recovered-alias',source:youtube.path,note:seed.noteA.path,time:83,text:'original',mode:'manual',phase,image});await seed.drafts.flush();await seed.drafts.dispose();
 const f=await persistenceFixture(storage),held=deferred<Timeline>();f.setRead(()=>held.promise);const states=[{source:youtube.path,draftId:'recovered-alias'},{source:youtube.path,note:f.noteA.path,draftId:'recovered-alias'}];if(reverse)states.reverse();const a=f.view();await a.onOpen();const openingA=a.setState(states[0]);await settle();const b=f.view();await b.onOpen();const openingB=b.setState(states[1]);await settle();assert.equal(a.memory,b.memory);assert.equal(a.memory.draft,b.memory.draft);assert.equal(a.memory.draft.time,83);assert.equal(await a.memory.draft.image.text(),'original frame');
 if(phase==='editing'){type(editor(a),'one editing owner');assert.equal(editor(b).readOnly,true);await f.drafts.flush();assert.equal(storage.rows.get('recovered-alias')!.text,'one editing owner');}else{assert.equal(editor(a).readOnly,true);assert.equal(editor(b).readOnly,true);assert.equal(f.saves.length,0);}
 held.resolve({note:f.noteA,entries:[]});await Promise.all([openingA,openingB]);await a.onClose();if(phase==='editing'){assert.equal(editor(b).readOnly,false);type(editor(b),'owner after first close');await f.drafts.flush();assert.equal(storage.rows.get('recovered-alias')!.text,'owner after first close');}await b.onClose();
});
test('recovery alias collision preserves the active different draft and original stored draft',async()=>{
 const storage=new OnlineStorageFixture(),seed=await persistenceFixture(storage);seed.drafts.stage({id:'stored-note-draft',source:youtube.path,note:seed.noteA.path,time:83,text:'stored original',mode:'manual',phase:'editing'});await seed.drafts.flush();await seed.drafts.dispose();const f=await persistenceFixture(storage),held=deferred<Timeline>();f.setRead(()=>held.promise);
 const a=f.view();await a.onOpen();const openingA=a.setState({source:youtube.path});await settle();type(editor(a),'unbound active text');const original=a.memory,draft=original.draft;await f.drafts.flush();const b=f.view();await b.onOpen();const openingB=b.setState({source:youtube.path,draftId:'stored-note-draft'});await settle();assert.equal(a.memory,original);assert.equal(a.memory.draft,draft);assert.equal(editor(a).value,'unbound active text');assert.equal(editor(b).readOnly,true);assert.equal(b.memory.restoreBlocked,true);assert.equal(b.memory.draft,undefined);assert.equal(storage.rows.get('stored-note-draft')!.text,'stored original');assert.equal(storage.rows.get(draft.id)!.text,'unbound active text');held.resolve({entries:[]});await Promise.all([openingA,openingB]);await a.onClose();await b.onClose();
});

// Second independent identity boundary, retained verbatim.
test('independent: recovered unbound draft cannot let a second explicit note retarget the first editor',async()=>{
 const storage=new OnlineStorageFixture(),seed=await persistenceFixture(storage);
 seed.drafts.stage({id:'unbound-recovery',source:youtube.path,time:83,text:'unbound original',mode:'manual',phase:'editing'});await seed.drafts.flush();await seed.drafts.dispose();
 const f=await persistenceFixture(storage);f.setRead(async(_source,note)=>({note:note===f.noteB.path?f.noteB:f.noteA,entries:[]}));
 const a=await open(f,youtube,{note:f.noteA.path,draftId:'unbound-recovery'});assert.equal(a.currentNote(),f.noteA.path);
 const b=await open(f,youtube,{note:f.noteB.path,draftId:'unbound-recovery'});
 const observation={aNote:a.currentNote(),bNote:b.currentNote(),sameMemory:a.memory===b.memory,aSavedBinding:a.memory.persistedNote,bBlocked:!!b.memory.restoreBlocked};
 await a.onClose();await b.onClose();assert.equal(observation.aNote,f.noteA.path,JSON.stringify(observation));
 assert.ok(observation.bBlocked||a.memory!==b.memory,'different explicit note must not reuse active recovered draft: '+JSON.stringify(observation));
});

test('transient read failure never replaces an existing disk draft with new memory content',async()=>{
 const storage=new OnlineStorageFixture(),seed=await persistenceFixture(storage);seed.drafts.stage({id:'existing-disk-draft',source:youtube.path,time:39,text:'original disk text',mode:'manual',phase:'editing',image:new Blob(['disk image'],{type:'image/png'})});await seed.drafts.flush();await seed.drafts.dispose();storage.readFailure=true;
 const f=await persistenceFixture(storage),v=await open(f);type(editor(v),'new unprotected memory text');const newId=v.memory.draft.id;assert.notEqual(newId,'existing-disk-draft');storage.readFailure=false;await click(v,'重试暂存');assert.equal(storage.rows.size,1);assert.equal(storage.rows.get('existing-disk-draft')!.text,'original disk text');assert.equal(await storage.rows.get('existing-disk-draft')!.image!.text(),'disk image');assert.equal(v.memory.draft.text,'new unprotected memory text');assert.equal(editor(v).readOnly,false);assert.match(status(v),/重试暂存失败/);assert.doesNotMatch(status(v),/草稿已暂存到本机/);assert.equal(f.saves.length,0);
 await click(v,'取消摘录');assert.equal(storage.rows.has('existing-disk-draft'),true);await v.onClose();const restored=await open(f);assert.equal(restored.memory.draft.id,'existing-disk-draft');assert.equal(editor(restored).value,'original disk text');assert.equal(restored.memory.draft.time,39);assert.equal(await restored.memory.draft.image.text(),'disk image');await restored.onClose();
});
test('synchronous explicit binding rejects a different note before the first note lookup returns',async()=>{
 const storage=new OnlineStorageFixture(),seed=await persistenceFixture(storage);seed.drafts.stage({id:'binding-pending',source:youtube.path,time:83,text:'unbound',mode:'manual',phase:'editing'});await seed.drafts.flush();await seed.drafts.dispose();const f=await persistenceFixture(storage),held=deferred<Timeline>();f.setRead(()=>held.promise);
 const a=f.view();await a.onOpen();const openingA=a.setState({source:youtube.path,note:f.noteA.path,draftId:'binding-pending'});await settle();const b=f.view();await b.onOpen();const openingB=b.setState({source:youtube.path,note:f.noteB.path,draftId:'binding-pending'});await settle();assert.equal(a.currentNote(),f.noteA.path);assert.equal(b.currentNote(),f.noteB.path);assert.equal(b.memory.restoreBlocked,true);assert.equal(b.memory.draft,undefined);assert.equal(editor(b).readOnly,true);await f.drafts.flush();assert.equal(storage.rows.get('binding-pending')!.note,f.noteA.path);held.resolve({entries:[]});await Promise.all([openingA,openingB]);await a.onClose();await b.onClose();
});
for(const outcome of ['note','error'])test(`an old unbound ${outcome} cannot overwrite a newer shared explicit binding`,async()=>{
 const storage=new OnlineStorageFixture(),seed=await persistenceFixture(storage);seed.drafts.stage({id:'binding-order',source:youtube.path,time:83,text:'fixed content',mode:'manual',phase:'editing'});await seed.drafts.flush();await seed.drafts.dispose();const f=await persistenceFixture(storage),unbound=deferred<Timeline>(),bound=deferred<Timeline>();f.setRead((_source,note)=>note?bound.promise:unbound.promise);
 const a=f.view();await a.onOpen();const openingA=a.setState({source:youtube.path,draftId:'binding-order'});await settle();const b=f.view();await b.onOpen();const openingB=b.setState({source:youtube.path,note:f.noteA.path,draftId:'binding-order'});await settle();assert.equal(a.memory,b.memory);assert.equal(a.currentNote(),f.noteA.path);if(outcome==='error')unbound.reject(Error('obsolete unbound lookup failed'));else unbound.resolve({note:f.noteB,entries:[]});await openingA;assert.doesNotMatch(status(a),/读取摘录失败/);assert.equal(a.currentNote(),f.noteA.path);assert.equal(b.currentNote(),f.noteA.path);assert.notEqual(a.memory.note,f.noteB);bound.resolve({note:f.noteA,entries:[]});await openingB;await f.drafts.flush();assert.equal(storage.rows.get('binding-order')!.note,f.noteA.path);assert.equal(storage.rows.get('binding-order')!.text,'fixed content');assert.equal(f.saves.length,0);await a.onClose();await b.onClose();
});


test('resolved committed storage failure leaves only saved success after exact cleanup',async()=>{
 const f=await persistedView(),draft={...f.v.memory.draft};f.setWrite(async()=>{f.storage.failWrite=true;return{note:f.noteA};});await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.v.memory.phase,'committed');assert.match(status(f.v),/^笔记已保存；本机暂存尚未清理。/);assert.notEqual(f.drafts.error,'');
 f.storage.failWrite=false;f.setRead(async()=>receipt(f,draft));await click(f.v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.storage.rows.size,0);assert.equal(f.v.memory.draft,undefined);assert.equal(f.drafts.error,'');assert.equal(status(f.v),'摘录已保存。');assert.equal(button(f.v,'重试暂存').hidden,true);await f.v.onClose();
});
test('one resolved draft cannot clear another failure or a newer dirty snapshot',async()=>{
 const f=await persistenceFixture(),base={source:youtube.path,time:83,text:'retained',mode:'manual' as const,phase:'editing' as const},first={...base,id:'current',note:'current.md'},second={...base,id:'background',note:'background.md'};
 f.drafts.stage(first);f.drafts.stage(second);f.storage.failWrite=true;await assert.rejects(f.drafts.flush());assert.notEqual(f.drafts.error,'');f.storage.failWrite=false;await f.drafts.flush(first.id);await f.drafts.discard(first.id);assert.notEqual(f.drafts.error,'','other failed draft remains unprotected');
 f.drafts.stage({...second,text:'older retry'});const held=deferred<void>();f.storage.gate=held;const saving=f.drafts.flush(second.id);await settle();f.drafts.stage({...second,text:'newest retained'});held.resolve();await saving;assert.notEqual(f.drafts.error,'','late older success cannot resolve the newer dirty draft');assert.equal(f.drafts.state(second.id),'pending');await f.drafts.flush(second.id);assert.equal(f.drafts.error,'');assert.equal(f.storage.rows.get(second.id)!.text,'newest retained');await f.drafts.dispose();
});
for(const kind of ['invalid','duplicate','claim']as const)test(`current draft cleanup preserves unresolved ${kind} load warning`,async()=>{
 const storage=new OnlineStorageFixture(),row:StoredOnlineDraft={id:'blocked',source:youtube.path,note:'blocked.md',time:83,text:'original',mode:'manual',phase:'editing',version:1,key:JSON.stringify([youtube.path,'blocked.md']),revision:1,lease:'seed',updatedAt:1};
 if(kind==='invalid')storage.rows.set('future',{id:'future',version:9} as unknown as StoredOnlineDraft);else{storage.rows.set(row.id,row);if(kind==='duplicate')storage.rows.set('other',{...row,id:'other'});else storage.failWrite=true;}
 const f=await persistenceFixture(storage);assert.notEqual(f.drafts.error,'');storage.failWrite=false;f.drafts.stage({id:'current',source:youtube.path,note:'current.md',time:83,text:'current',mode:'manual',phase:'editing'});await f.drafts.flush('current');await f.drafts.discard('current');assert.notEqual(f.drafts.error,'','successful current cleanup cannot dismiss unreadable or blocked original records');assert.equal(storage.rows.has('current'),false);assert.equal(storage.rows.size,kind==='duplicate'?2:1);if(kind!=='invalid')assert.deepEqual(storage.rows.get(row.id),row);await f.drafts.dispose();
});
