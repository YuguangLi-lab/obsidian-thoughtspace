import test from 'node:test';
import assert from 'node:assert/strict';
import {bindWritingModeFocus,syncWritingPaneHeight} from '../src/writing-chrome';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

function fixture(){
 const listeners=new Map<string,Set<()=>void>>(),frames=new Map<number,()=>void>();let id=0,stopped=0;
 const emitter=(prefix:string)=>({addEventListener:(type:string,fn:()=>void)=>{const key=prefix+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key)!.add(fn);},removeEventListener:(type:string,fn:()=>void)=>listeners.get(prefix+type)?.delete(fn)});
 const win={...emitter('window:'),visualViewport:emitter('viewport:'),requestAnimationFrame:(fn:()=>void)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key),ResizeObserver:class{constructor(_fn:()=>void){}observe(){}disconnect(){stopped++;}},MutationObserver:class{constructor(_fn:()=>void){}observe(){}disconnect(){stopped++;}}};
 const body={matches:()=>false},doc:any={...emitter('doc:'),body,defaultView:win,activeElement:body};
 const control=(visible:boolean,isMode=true)=>({visible,isConnected:true,matches:(selector:string)=>isMode&&selector==='.ts-writing-switch [data-article-mode]',getClientRects(){return this.visible?[{}]:[];},focus(){doc.activeElement=this;for(const fn of listeners.get('doc:focusin')||[])fn();}});
 const regular=control(true),trigger=control(false),editor=control(true,false),options=control(true,false),assembly={...control(true,false),matches:(selector:string)=>selector==='.ts-writing-assembly>.ts-writing-button'},root={ownerDocument:doc,height:600,dataset:{} as Record<string,string>,getBoundingClientRect(){return{height:this.height};},getAttribute(name:string){return this.dataset[name==='data-writing-short'?'writingShort':name]??null;},setAttribute(name:string,value:string){this.dataset[name==='data-writing-short'?'writingShort':name]=value;},removeAttribute(name:string){delete this.dataset[name==='data-writing-short'?'writingShort':name];},querySelector:()=>options,contains:(el:unknown)=>[regular,trigger,editor,options,assembly].includes(el as any)};
 const dispose=bindWritingModeFocus(root as unknown as HTMLElement,trigger as unknown as HTMLButtonElement,()=>regular as unknown as HTMLButtonElement);
 const resize=()=>{for(const fn of listeners.get('window:resize')!)fn();for(const fn of [...frames.values()])fn();frames.clear();};
 return{regular,trigger,editor,options,assembly,doc,root,listeners,frames,dispose,resize,stopped:()=>stopped};
}
test('resize keeps mode focus on its visible representation in both directions',()=>{
 const f=fixture();f.regular.focus();f.regular.visible=false;f.trigger.visible=true;f.resize();assert.equal(f.doc.activeElement,f.trigger);
 f.regular.visible=true;f.trigger.visible=false;f.resize();assert.equal(f.doc.activeElement,f.regular);
});
test('browser body fallback after hiding a mode control restores it without taking editor focus',()=>{
 const f=fixture();f.regular.focus();f.regular.visible=false;f.trigger.visible=true;f.doc.activeElement=f.doc.body;f.resize();assert.equal(f.doc.activeElement,f.trigger);
 f.editor.focus();f.regular.visible=true;f.trigger.visible=false;f.resize();assert.equal(f.doc.activeElement,f.editor);
});
test('intentional pointer movement clears remembered focus and dispose releases owner resources',()=>{
 const f=fixture();f.regular.focus();for(const fn of f.listeners.get('doc:pointerdown')!)fn();f.doc.activeElement=f.doc.body;f.regular.visible=false;f.trigger.visible=true;f.resize();assert.equal(f.doc.activeElement,f.doc.body);
 for(const fn of f.listeners.get('window:resize')!)fn();assert.equal(f.frames.size,1);f.dispose();f.dispose();assert.equal(f.frames.size,0);assert.equal(f.stopped(),2);assert.equal([...f.listeners.values()].reduce((n,set)=>n+set.size,0),0);
});

function menuFixture(popup=false){
 const source=readFileSync('src/writing-view.ts','utf8'),start=source.indexOf(' private ownWritingMenu('),end=source.indexOf('\n private setArticleMode(',start),listeners=new Set<(e:any)=>void>(),mainListeners=new Set<(e:any)=>void>(),notices:string[]=[],tasks:Array<()=>void>=[];let focuses=0;
 class Scope{
  keys:Array<{modifiers:string[]|null;key:string|null;fn:(e:any)=>unknown}>=[];win:unknown=null;constructor(readonly parent?:Scope){}register(modifiers:string[]|null,key:string|null,fn:(e:any)=>unknown){const entry={modifiers,key,fn};this.keys.push(entry);return entry;}unregister(entry:unknown){this.keys=this.keys.filter(e=>e!==entry);}handle(event:any):unknown{for(const entry of this.keys){if(entry.key!==null&&entry.key!==event.key)continue;if(entry.modifiers!==null){const pressed=[['Ctrl',event.ctrlKey],['Meta',event.metaKey],['Alt',event.altKey],['Shift',event.shiftKey]].filter(([,on])=>on).map(([name])=>name);if(pressed.length!==entry.modifiers.length||pressed.some(name=>!entry.modifiers!.includes(name as string)))continue;}const result=entry.fn(event);if(result!==undefined||entry.key!==null||entry.modifiers!==null)return result;}return this.parent?.handle(event);}
 }
 class Menu{
  scope=new Scope();originalScope=this.scope;loadedScope:Scope|null=null;loads:Scope[]=[];unloads:Scope[]=[];constructor(){this.scope.register([], 'Escape',()=>this.hide());this.scope.register([], 'ArrowDown',()=>{this.arrowMoves++;return false;});this.scope.register([], 'Enter',()=>{this.enters++;return false;});}arrowMoves=0;enters=0;
  items:any[]=[];hidden=false;hideCallback=()=>{};setUseNativeMenu(){return this;}setParentElement(){return this;}
  addItem(fn:(item:any)=>void){const item:any={disabled:false,setTitle(value:any){this.title=value.textContent??value;return this},setIcon(){return this},setChecked(value:boolean){this.checked=value;return this},setDisabled(value:boolean){this.disabled=value;return this},onClick(value:()=>void){this.click=()=>{if(!this.disabled)value();};return this}};fn(item);this.items.push(item);return this;}
  addSeparator(){return this;}onHide(fn:()=>void){this.hideCallback=fn;}hide(){if(this.hidden)return this;this.hidden=true;if(this.loadedScope){this.unloads.push(this.scope);assert.equal(this.loadedScope,this.scope);this.loadedScope=null;}this.hideCallback();return this;}showAtPosition(){this.loadedScope=this.scope;this.loads.push(this.scope);}showAtMouseEvent(){this.showAtPosition();}
 }
 const fragment=()=>({textContent:'',createSpan(value:any){this.textContent+=value.text;return value;}}),win={createFragment:fragment,setTimeout:(fn:()=>void)=>tasks.push(fn),addEventListener:(_key:string,fn:(e:any)=>void)=>listeners.add(fn),removeEventListener:(_key:string,fn:(e:any)=>void)=>listeners.delete(fn)};
 const mainWin=popup?{setTimeout:(fn:()=>void)=>tasks.push(fn),addEventListener:(_key:string,fn:(e:any)=>void)=>mainListeners.add(fn),removeEventListener:(_key:string,fn:(e:any)=>void)=>mainListeners.delete(fn)}:win;
 const doc:any={defaultView:win,win,createDocumentFragment:fragment,activeElement:null};
 const trigger={ownerDocument:doc,isConnected:true,visible:true,getClientRects(){return this.visible?[{}]:[];},getBoundingClientRect:()=>({left:0,bottom:44}),setAttribute(){},focus(){focuses++;doc.activeElement=this;}};
 const method=(name:string)=>{const a=source.indexOf(' private '+name+'(');return source.slice(a,source.indexOf('\n private ',a+1));};
 const View=new Function('Menu','Scope','Notice','window',transformSync('class WritingView{'+method('runAction')+source.slice(start,end)+method('newChapter')+method('bindDockDismissal')+method('closeDock')+method('toggleDock')+'};return WritingView',{loader:'ts'}).code)(Menu,Scope,class{constructor(message:string){notices.push(message);}},mainWin),view=new View(),leaf={view};Object.assign(view,{leaf,app:{workspace:{activeLeaf:leaf,getActiveViewOfType(type:any){const view=this.activeLeaf?.view;return view instanceof type?view:null;}}},contentEl:{ownerDocument:doc,querySelector:()=>trigger},owner:{},generation:1,mode:'write',closed:false,history:[],future:[],state:()=>({}),setArticleMode(mode:string){this.mode=mode;}});view.openModeMenu();
 // Actual native callbacks finish with a microtask checkpoint before the
 // next listener. Menu.hide returns the menu, so the host keymap does not
 // preventDefault or stopPropagation; the workspace's bubble listener can
 // select a navigation leaf unless the retained observer consumes Escape.
 const escape=async(patch:Record<string,unknown>={},hostFirst=true)=>{
  const event={target:trigger,key:'Escape',isComposing:false,keyCode:27,prevented:false,stopped:false,propagationStopped:false,navigationSelected:false,listenersAfterHostMicrotask:0,order:[] as string[],preventDefault(){this.prevented=true;this.order.push('observer-prevent');},stopPropagation(){this.propagationStopped=true;},stopImmediatePropagation(){this.stopped=true;this.order.push('observer-stop');},...patch};
  const host=async()=>{if(event.key==='Escape'&&view.modeMenu){event.order.push('host-hide');view.modeMenu.hide();}await Promise.resolve();event.listenersAfterHostMicrotask=listeners.size;};
  if(hostFirst)await host();for(const fn of [...listeners]){if(!listeners.has(fn))continue;fn(event);await Promise.resolve();if(event.stopped)break;}if(!hostFirst&&!event.stopped)await host();
  if(event.key==='Escape'&&!event.prevented&&!event.propagationStopped&&!event.stopped){event.navigationSelected=true;event.order.push('workspace-navigation');}
  return event;
 };
 return{view,menu:view.modeMenu as Menu,trigger,doc,mainWin,listeners,mainListeners,notices,escape,flushTasks(){while(tasks.length)tasks.shift()!();},focuses:()=>focuses};
}
test('native host callback checkpoint retains the observer before workspace Escape navigation',async()=>{
 const f=menuFixture();assert.deepEqual(f.menu.items.map(item=>item.checked),[true,false,false]);const event=await f.escape();assert.equal(event.listenersAfterHostMicrotask,1);assert.deepEqual(event.order,['host-hide','observer-prevent','observer-stop']);assert.equal(event.propagationStopped,false);assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(event.navigationSelected,false);assert.equal(f.listeners.size,1);assert.equal(f.focuses(),0);f.flushTasks();assert.equal(f.focuses(),1);assert.equal(f.doc.activeElement,f.trigger);assert.equal(f.listeners.size,0);assert.equal(f.view.modeMenu,undefined);
});
test('options Escape ignores the replaced mode observer and prevents workspace navigation',async()=>{
 const f=menuFixture();f.view.openOptionsMenu(f.trigger,{detail:0});const options=f.view.modeMenu;assert.equal(f.listeners.size,2);const event=await f.escape();assert.equal(options.hidden,true);assert.equal(event.prevented,true);assert.equal(event.navigationSelected,false);assert.deepEqual(event.order,['host-hide','observer-prevent','observer-stop']);f.flushTasks();assert.equal(f.listeners.size,0);assert.equal(f.focuses(),1);assert.equal(f.doc.activeElement,f.trigger);
});
test('Escape also closes and restores when the host leaves a live menu for the observer',async()=>{
 const f=menuFixture(),event=await f.escape({},false);assert.equal(event.prevented,true);assert.equal(f.menu.hidden,true);assert.equal(event.navigationSelected,false);f.flushTasks();assert.equal(f.focuses(),1);assert.equal(f.listeners.size,0);
});
test('mode selection returns focus whether host hides the menu before or after its callback',async()=>{
 for(const first of [true,false]){const f=menuFixture();if(first)f.menu.hide();f.menu.items[1].click();if(!first)f.menu.hide();await Promise.resolve();assert.equal(f.view.mode,'outline');assert.equal(f.focuses(),1);f.flushTasks();assert.equal(f.focuses(),1);assert.equal(f.listeners.size,0);}
});
test('pointer dismissal, changed owner, closed view and replaced menus do not steal focus',async()=>{
 const pointer=menuFixture();pointer.menu.hide();await Promise.resolve();assert.equal(pointer.focuses(),0);pointer.flushTasks();assert.equal(pointer.focuses(),0);assert.equal(pointer.listeners.size,0);
 for(const invalidate of [(v:any)=>v.owner={},(v:any)=>v.closed=true,(v:any)=>v.generation++,(v:any)=>{v.openModeMenu();v.modeMenu.hide();}]){const f=menuFixture();await f.escape();invalidate(f.view);f.flushTasks();assert.equal(f.focuses(),0);assert.equal(f.listeners.size,0);}
});
test('IME Escape is left to the host without custom consumption or focus restoration',async()=>{
 for(const patch of [{isComposing:true},{keyCode:229}]){const f=menuFixture(),event=await f.escape(patch);assert.equal(f.menu.hidden,true);assert.equal(event.prevented,false);assert.equal(event.stopped,false);f.flushTasks();assert.equal(f.focuses(),0);assert.equal(f.listeners.size,0);}
 const f=menuFixture(),event=await f.escape({key:'Enter'});assert.equal(event.prevented,false);assert.equal(f.view.modeMenu,f.menu);f.menu.hide();await Promise.resolve();f.flushTasks();assert.equal(f.focuses(),0);
});
test('short-menu new chapter retains the actual editor selection and focus',async()=>{
 const f=menuFixture(),input={value:'Existing',selectionStart:3,selectionEnd:3,setRangeText(value:string,start:number,end:number){this.value=this.value.slice(0,start)+value+this.value.slice(end);},setSelectionRange(start:number,end:number){this.selectionStart=start;this.selectionEnd=end;},focus(){f.doc.activeElement=this;}};
 f.view.manuscriptInput=input;f.view.manuscriptNative={};f.view.openOptionsMenu(f.trigger,{detail:0});const menu=f.view.modeMenu;menu.hide();menu.items.find((item:any)=>item.title==='新建章节').click();await Promise.resolve();f.flushTasks();assert.equal(input.value,'Exi\n\n## 新章节\n\nsting');assert.equal(input.value.slice(input.selectionStart,input.selectionEnd),'新章节');assert.equal(f.doc.activeElement,input);assert.equal(f.focuses(),0);
});
test('short-menu actions preserve disabled draft state and visible sync/async errors',async()=>{
 const f=menuFixture();let draftOpens=0;f.view.openDraft=async()=>{draftOpens++;throw Error('file unavailable');};f.view.openOptionsMenu(f.trigger,{detail:0});let menu=f.view.modeMenu,draft=menu.items.find((item:any)=>item.title==='打开上次草稿');assert.equal(draft.disabled,true);draft.click();assert.equal(draftOpens,0);
 f.view.state=()=>({draftPath:'saved.md'});f.view.openOptionsMenu(f.trigger,{detail:0});menu=f.view.modeMenu;draft=menu.items.find((item:any)=>item.title==='打开上次草稿');assert.equal(draft.disabled,false);draft.click();await Promise.resolve();assert.equal(draftOpens,1);assert.match(f.notices[0],/file unavailable/);
 f.view.newChapter=()=>{throw Error('chapter limit');};menu.items.find((item:any)=>item.title==='新建章节').click();assert.match(f.notices[1],/chapter limit/);menu.hide();await Promise.resolve();f.flushTasks();assert.equal(f.focuses(),0);
});
test('short-menu dock toggle closes an open dock and Escape restores its visible entry',async()=>{
 const f=menuFixture(),toggle={visible:false,getClientRects(){return this.visible?[{}]:[];},focus(){f.doc.activeElement=this;}},options=f.trigger;
 f.view.contentEl.clientWidth=320;f.view.contentEl.querySelector=(selector:string)=>selector==='.ts-writing-dock-toggle'?toggle:options;f.view.dock={hidden:false,contains:()=>false};f.view.dockOpen=true;f.view.compactDockRequested=true;f.view.syncDock=()=>{f.view.dock.hidden=!f.view.dockOpen;};f.view.app={workspace:{activeLeaf:f.view.leaf,getActiveViewOfType(type:any){const view=this.activeLeaf?.view;return view instanceof type?view:null;},requestSaveLayout(){}}};f.view.bindDockDismissal();
 f.view.contentEl.onpointerdown({target:{closest:(selector:string)=>selector.split(',').includes('.ts-writing-options')?options:null}});assert.equal(f.view.dock.hidden,false);
 f.view.openOptionsMenu(options,{detail:0});const menu=f.view.modeMenu;menu.hide();menu.items.find((item:any)=>item.title==='显示或收起资料栏').click();await Promise.resolve();f.flushTasks();assert.equal(f.view.dock.hidden,true);assert.equal(f.doc.activeElement,options);
 for(const visible of [false,true]){toggle.visible=visible;f.view.toggleDock();f.view.dock.onkeydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(f.view.dock.hidden,true);assert.equal(f.doc.activeElement,visible?toggle:options);}
 f.view.toggleDock();for(const patch of [{isComposing:true},{keyCode:229}]){let consumed=false;f.view.dock.onkeydown({key:'Escape',...patch,preventDefault(){consumed=true;},stopPropagation(){}});assert.equal(f.view.dock.hidden,false);assert.equal(consumed,false);}
 f.view.contentEl.onpointerdown({target:{closest:()=>null}});assert.equal(f.view.dock.hidden,true);
});


test('short chrome follows actual pane height instead of window width or height',()=>{
 const root={height:340,dataset:{} as Record<string,string>,getBoundingClientRect(){return{height:this.height};}};
 for(const [height,short]of [[340,true],[450,true],[451,false],[700,false],[0,false],[NaN,false]] as const){root.height=height;assert.equal(syncWritingPaneHeight(root as unknown as HTMLElement),short);assert.equal(root.dataset.writingShort,String(short));}
});
test('short resize keeps editor focus and releases only its layout attribute',()=>{
 const f=fixture();assert.equal(f.root.dataset.writingShort,'false');f.editor.focus();f.root.height=340;f.resize();assert.equal(f.root.dataset.writingShort,'true');assert.equal(f.doc.activeElement,f.editor);f.root.height=700;f.resize();assert.equal(f.root.dataset.writingShort,'false');assert.equal(f.doc.activeElement,f.editor);f.dispose();assert.equal(f.root.dataset.writingShort,undefined);
});
test('host onResize refreshes the actual pane before native measure and ignores closed views',()=>{
 const source=readFileSync('src/writing-view.ts','utf8'),start=source.indexOf(' onResize(){'),end=source.indexOf('\n private ',start),calls:string[]=[];
 const View=new Function('syncWritingPaneHeight',transformSync('class View{'+source.slice(start,end)+'};return View',{loader:'ts'}).code)((root:unknown)=>{assert.equal(root,view.contentEl);calls.push('actual pane');});
 const view=new View();Object.assign(view,{closed:false,contentEl:{},refreshOwnerBindings:()=>calls.push('owner bindings'),syncDock:()=>calls.push('dock'),manuscriptNative:{resize:()=>calls.push('native measure')}});view.onResize();assert.deepEqual(calls,['owner bindings','actual pane','dock','native measure']);view.closed=true;view.onResize();assert.equal(calls.length,4);
});
test('short-pane rebuild action remains in the real options menu with safe execution',()=>{
 const f=menuFixture();let rebuilds=0;f.view.rebuildManuscript=()=>{rebuilds++;};f.view.openOptionsMenu(f.trigger,{detail:0});const item=f.view.modeMenu.items.find((item:any)=>item.title==='从编排重建正文（先另存当前正文）');assert.ok(item&&!item.disabled);item.click();assert.equal(rebuilds,1);f.view.modeMenu.hide();f.flushTasks();
});

test('a focused duplicate rebuild control transfers to visible options when compacted, without taking editor focus',()=>{
 for(const bodyFallback of [false,true]){const f=fixture();f.assembly.focus();f.assembly.visible=false;f.root.height=340;if(bodyFallback)f.doc.activeElement=f.doc.body;f.resize();assert.equal(f.doc.activeElement,f.options);f.editor.focus();f.root.height=700;f.assembly.visible=true;f.resize();assert.equal(f.doc.activeElement,f.editor);f.dispose();}
});


function adoptedFixture(){
 const f=fixture(),body={matches:()=>false},outside={matches:()=>false},popupDoc:any={body,activeElement:body};
 const adopt=()=>{
  f.root.ownerDocument=popupDoc;f.doc.activeElement=f.doc.body;
  // DOM focus after adoption belongs to the current document. The original
  // document's focus listeners do not receive this popup's focus events.
  for(const el of [f.regular,f.trigger,f.editor,f.options,f.assembly])el.focus=()=>{popupDoc.activeElement=el;};
 };
 return{...f,popupDoc,outside,adopt};
}
test('native adoption cannot use original assembly focus memory to take popup editor focus',()=>{
 const f=adoptedFixture();f.assembly.focus();f.adopt();f.editor.focus();f.root.height=340;f.assembly.visible=false;f.resize();
 assert.equal(f.root.dataset.writingShort,'true');assert.equal(f.popupDoc.activeElement,f.editor);assert.equal(f.doc.activeElement,f.doc.body);f.dispose();
});
test('native adoption drops old mode and assembly body fallback memory',()=>{
 for(const control of ['regular','assembly'] as const){for(const outsideFocus of [false,true]){const f=adoptedFixture();f[control].focus();f.adopt();f[control].visible=false;f.trigger.visible=true;if(outsideFocus)f.popupDoc.activeElement=f.outside;f.resize();assert.equal(f.popupDoc.activeElement,outsideFocus?f.outside:f.popupDoc.body);assert.equal(f.root.dataset.writingShort,'false');f.dispose();}}
});
test('a currently focused popup control may transfer to its visible entry after adoption',()=>{
 for(const control of ['regular','assembly'] as const){const f=adoptedFixture();f.adopt();f[control].focus();f[control].visible=false;f.trigger.visible=true;f.root.height=340;f.resize();assert.equal(f.popupDoc.activeElement,control==='assembly'?f.options:f.trigger);f.editor.focus();f.resize();assert.equal(f.popupDoc.activeElement,f.editor);f.dispose();}
});
test('original-document focus events after adoption cannot resurrect old memory',()=>{
 const f=adoptedFixture();f.assembly.focus();f.adopt();f.assembly.visible=false;f.doc.activeElement=f.assembly;
 for(const fn of f.listeners.get('doc:focusin')||[])fn();f.resize();assert.equal(f.popupDoc.activeElement,f.popupDoc.body);
 f.editor.focus();for(const fn of f.listeners.get('doc:focusin')||[])fn();f.resize();assert.equal(f.popupDoc.activeElement,f.editor);f.dispose();f.resize();assert.equal(f.popupDoc.activeElement,f.editor);
});

// Obsidian's popup capture listener synchronously dispatches a cloned event
// on the main Window before later popup listeners. Its prevent/stop methods
// forward to the original event, and its target remains the original node.
function relayEscape(f:ReturnType<typeof menuFixture>,patch:Record<string,unknown>={}){
 const order:string[]=[],original:any={target:f.trigger,key:'Escape',isComposing:false,keyCode:27,prevented:false,stopped:false,...patch},relayed:any={...original,isRelayed:true};
 original.preventDefault=()=>{original.prevented=true;};original.stopImmediatePropagation=()=>{original.stopped=true;};
 relayed.preventDefault=()=>{relayed.prevented=true;original.preventDefault();order.push('main-prevent');};relayed.stopImmediatePropagation=()=>{relayed.stopped=true;original.stopImmediatePropagation();order.push('main-stop');};
 order.push('popup-relay');if(f.view.modeMenu){order.push('main-host-keymap');const result=f.view.modeMenu.scope.handle(relayed);if(result===false)relayed.preventDefault();}
 // Direct relay to Window runs its existing target listeners in registration
 // order. Workspace precedes the plugin capture listener in the actual trace.
 if(!relayed.prevented&&!relayed.stopped){order.push('main-workspace-navigation');f.view.app.workspace.activeLeaf={view:{navigation:true}};}
 if(!relayed.stopped)for(const fn of [...f.mainListeners]){if(!f.mainListeners.has(fn))continue;fn(relayed);if(relayed.stopped)break;}
 if(!original.stopped)for(const fn of [...f.listeners]){if(!f.listeners.has(fn))continue;order.push('popup-late-observer');fn(original);if(original.stopped)break;}
 return{original,relayed,order};
}
test('popup mode and options Escape is consumed by the early menu scope before Window target navigation',()=>{
 for(const options of [false,true]){const f=menuFixture(true);if(options)f.view.openOptionsMenu(f.trigger,{detail:1});const menu=f.view.modeMenu,event=relayEscape(f);
  assert.deepEqual(event.order,['popup-relay','main-host-keymap','main-prevent','main-stop','main-prevent']);assert.equal(event.original.prevented,true);assert.equal(event.original.stopped,true);assert.equal(event.relayed.prevented,true);assert.equal(f.view.app.workspace.activeLeaf,f.view.leaf);assert.equal(menu.hidden,true);assert.equal(f.focuses(),0);
  f.flushTasks();assert.equal(f.focuses(),1);assert.equal(f.doc.activeElement,f.trigger);assert.equal(f.mainListeners.size,0);assert.equal(f.listeners.size,0);
 }
});
test('the original default menu scope navigates before late Window target listeners',()=>{
 const f=menuFixture(true);f.menu.scope=f.menu.originalScope;f.menu.loadedScope=f.menu.scope;f.mainListeners.clear();const event=relayEscape(f);assert.equal(event.order.includes('main-workspace-navigation'),true);assert.notEqual(f.view.app.workspace.activeLeaf,f.view.leaf);assert.equal(f.focuses(),0);f.flushTasks();assert.equal(f.focuses(),0);
});
test('main-window observer ignores another document and leaves foreign Escape untouched',()=>{
 for(const target of [{ownerDocument:{}},null,{}]){const f=menuFixture(true),event:any={target,key:'Escape',isComposing:false,keyCode:27,preventDefault(){assert.fail('foreign default consumed');},stopImmediatePropagation(){assert.fail('foreign propagation consumed');}};
  for(const fn of f.mainListeners)fn(event);assert.equal(f.menu.hidden,false);assert.equal(f.focuses(),0);f.menu.hide();f.flushTasks();assert.equal(f.mainListeners.size,0);assert.equal(f.listeners.size,0);
 }
});
test('new navigation before a relay prevents custom consumption and focus restoration',()=>{
 const f=menuFixture(true),other={view:{navigation:true}};f.view.app.workspace.activeLeaf=other;
 const event:any={target:f.trigger,key:'Escape',isComposing:false,keyCode:27,preventDefault(){assert.fail('new navigation consumed');},stopImmediatePropagation(){assert.fail('new navigation stopped');}};
 f.menu.hide();for(const fn of f.mainListeners)fn(event);f.flushTasks();assert.equal(f.view.app.workspace.activeLeaf,other);assert.equal(f.focuses(),0);assert.equal(f.listeners.size+f.mainListeners.size,0);
});
test('navigation after accepted Escape cancels deferred trigger focus without switching leaves back',()=>{
 const f=menuFixture(true);relayEscape(f);const other={view:{navigation:true}};f.view.app.workspace.activeLeaf=other;f.flushTasks();assert.equal(f.view.app.workspace.activeLeaf,other);assert.equal(f.focuses(),0);assert.equal(f.listeners.size+f.mainListeners.size,0);
});
test('adoption, replacement view and closure cancel retained relay ownership',()=>{
 for(const invalidate of [(f:any)=>{f.view.contentEl.ownerDocument={};},(f:any)=>{f.trigger.ownerDocument={};},(f:any)=>{f.view.leaf.view={};},(f:any)=>{f.view.closed=true;}]){
  const f=menuFixture(true);relayEscape(f);invalidate(f);f.flushTasks();assert.equal(f.focuses(),0);assert.equal(f.listeners.size+f.mainListeners.size,0);
 }
});
test('popup IME Escape remains host-owned and does not restore trigger focus',()=>{
 for(const patch of [{isComposing:true},{keyCode:229}]){const f=menuFixture(true),event=relayEscape(f,patch);assert.equal(event.original.prevented,false);assert.equal(event.relayed.prevented,false);f.flushTasks();assert.equal(f.focuses(),0);assert.equal(f.listeners.size+f.mainListeners.size,0);}
});
test('a main-window menu installs only one capture observer',()=>{
 const f=menuFixture();assert.equal(f.listeners.size,1);assert.equal(f.mainListeners.size,0);f.menu.hide();f.flushTasks();assert.equal(f.listeners.size,0);
});

test('popup closure cannot strand the main-window relay observer on a dead popup timer',()=>{
 const f=menuFixture(true);f.doc.defaultView.setTimeout=()=>{assert.fail('popup timer may not clean a main-window listener');};relayEscape(f);f.view.closed=true;f.flushTasks();assert.equal(f.focuses(),0);assert.equal(f.listeners.size+f.mainListeners.size,0);
});

test('owned Menu scope keeps native navigation and Enter handlers on its original parent',()=>{
 const f=menuFixture(true),scope=f.menu.scope;assert.notEqual(scope,f.menu.originalScope);assert.equal(scope.parent,f.menu.originalScope);
 for(const key of ['ArrowDown','Enter']){const event:any={target:f.trigger,key,isComposing:false,keyCode:40,preventDefault(){assert.fail('non Escape consumed');},stopImmediatePropagation(){assert.fail('non Escape stopped');}};assert.equal(scope.handle(event),false);}
 assert.equal(f.menu.arrowMoves,1);assert.equal(f.menu.enters,1);f.menu.hide();assert.deepEqual(f.menu.loads,[scope]);assert.deepEqual(f.menu.unloads,[scope]);f.flushTasks();assert.equal(f.mainListeners.size,0);
});
test('wildcard scope preserves default host behavior for IME and every invalid owner predicate',()=>{
 const invalidators=[(f:any)=>f.view.owner={},(f:any)=>f.view.generation++,(f:any)=>f.view.writingMenuOwner={},(f:any)=>f.view.closed=true,(f:any)=>f.view.contentEl.ownerDocument={},(f:any)=>f.trigger.ownerDocument={},(f:any)=>f.view.app.workspace.activeLeaf={},(f:any)=>f.view.leaf.view={}];
 for(const invalidate of invalidators){const f=menuFixture(true);invalidate(f);const event=relayEscape(f);assert.equal(event.original.prevented,false);assert.equal(event.order.includes('main-workspace-navigation'),true);assert.equal(f.menu.hidden,true);f.flushTasks();assert.equal(f.focuses(),0);}
 for(const patch of [{isComposing:true},{keyCode:229}]){const f=menuFixture(true);const event=relayEscape(f,patch);assert.equal(event.original.prevented,false);assert.equal(f.menu.hidden,true);f.flushTasks();assert.equal(f.focuses(),0);}
});
test('unsupported or nonwritable private scope boundary leaves the exact original field untouched',()=>{
 for(const kind of ['readonly','foreign','accessor']){const f=menuFixture(),menu=new (f.menu.constructor as any)();let reads=0;const original=kind==='foreign'?{}:menu.scope;
  if(kind==='accessor')Object.defineProperty(menu,'scope',{configurable:true,get(){reads++;return original;}});else Object.defineProperty(menu,'scope',{value:original,writable:kind!=='readonly',configurable:true});
  f.view.ownWritingMenu(menu,f.trigger);assert.equal(reads,0);assert.equal(menu.scope,original);menu.hide();f.flushTasks();assert.equal(f.focuses(),0);
 }
});
test('successive menus each load and unload their own exact scope without manual keymap stack changes',()=>{
 const f=menuFixture(true);for(const options of [false,true,false,true]){const old=f.view.modeMenu;if(options)f.view.openOptionsMenu(f.trigger,{detail:0});else f.view.openModeMenu();const menu=f.view.modeMenu;assert.ok(!old||old.hidden);const event=relayEscape(f);assert.equal(event.original.prevented,true);assert.equal(f.view.app.workspace.activeLeaf,f.view.leaf);f.flushTasks();assert.deepEqual(menu.loads,[menu.scope]);assert.deepEqual(menu.unloads,[menu.scope]);assert.equal(f.mainListeners.size,0);assert.equal(f.listeners.size,0);}
});
test('actual Window relay target-order model retains the original failure when scope boundary is unavailable',()=>{
 const f=menuFixture(true);f.menu.scope=f.menu.originalScope;f.menu.loadedScope=f.menu.scope;const event=relayEscape(f);assert.equal(event.order.indexOf('main-workspace-navigation')>event.order.indexOf('main-host-keymap'),true);assert.notEqual(f.view.app.workspace.activeLeaf,f.view.leaf);assert.equal(event.original.prevented,false);f.flushTasks();assert.equal(f.focuses(),0);
});

test('modified Escape delegates to the original root shortcut and leaves the writing menu untouched',()=>{
 for(const modifiers of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{ctrlKey:true,shiftKey:true}]){const f=menuFixture(true),parent=new (f.menu.scope.constructor as any)();let delegated=0;parent.register(null,null,()=>{delegated++;return 'root-shortcut';});(f.menu.originalScope as any).parent=parent;const event:any={target:f.trigger,key:'Escape',isComposing:false,keyCode:27,...modifiers,preventDefault(){assert.fail('modified Escape consumed');},stopImmediatePropagation(){assert.fail('modified Escape stopped');}};assert.equal(f.menu.scope.handle(event),'root-shortcut');for(const fn of f.mainListeners)fn(event);assert.equal(delegated,1);assert.equal(f.menu.hidden,false);f.menu.hide();f.flushTasks();assert.equal(f.focuses(),0);}
});
test('scope installation verifies assignment and readback, retaining the original on refusal or ignored writes',()=>{
 for(const accepted of [false,true]){const f=menuFixture(),originalMenu=new (f.menu.constructor as any)(),originalScope=originalMenu.scope;let writes=0;const menu=new Proxy(originalMenu,{set(target,key,value){if(key==='scope'){writes++;return accepted;}return Reflect.set(target,key,value);}});f.view.ownWritingMenu(menu,f.trigger);assert.equal(menu.scope,originalScope);assert.equal(writes,2);menu.hide();f.flushTasks();assert.equal(f.focuses(),0);}
});

test('public active-view lookup keeps exact writing instance, leaf attachment and stale popup focus gates',()=>{
 for(const popup of [false,true])for(const kind of ['null','different-writing','other-view','detached-leaf']){
  const f=menuFixture(popup),workspace=f.view.app.workspace;
  if(kind==='null')workspace.activeLeaf=null;
  else if(kind==='different-writing')workspace.activeLeaf={view:new f.view.constructor()};
  else if(kind==='other-view')workspace.activeLeaf={view:{}};
  else f.view.leaf.view={};
  const event=relayEscape(f);assert.equal(event.original.prevented,false);assert.equal(event.original.stopped,false);f.flushTasks();assert.equal(f.focuses(),0);
 }
});
