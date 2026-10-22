import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {CardControlContext} from '../src/card-control-context';
import type {BranchControlsOptions} from '../src/branch-controls';
class Events extends EventTarget {
 // Node 22 clears currentTarget between listeners; preserve browser semantics.
 override dispatchEvent(event:Event){Object.defineProperty(event,'currentTarget',{value:this,configurable:true});try{return super.dispatchEvent(event);}finally{Object.defineProperty(event,'currentTarget',{value:null,configurable:true});}}
 listeners=new Map<string,Set<EventListenerOrEventListenerObject>>();
 override addEventListener(type:string,fn:EventListenerOrEventListenerObject|null,options?:AddEventListenerOptions|boolean){if(fn){const set=this.listeners.get(type)||new Set();set.add(fn);this.listeners.set(type,set);}super.addEventListener(type,fn,options);}
 override removeEventListener(type:string,fn:EventListenerOrEventListenerObject|null,options?:EventListenerOptions|boolean){if(fn)this.listeners.get(type)?.delete(fn);super.removeEventListener(type,fn,options);}
 count(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
class Doc extends Events {
 activeElement:El|null=null;focused=true;onBlur?:()=>void;frames=new Map<number,FrameRequestCallback>();serial=0;
 defaultView=Object.assign(new Events(),{requestAnimationFrame:(fn:FrameRequestCallback)=>{this.frames.set(++this.serial,fn);return this.serial;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)});
 createElement(tag:string){return new El(this,tag);}createComment(){return new El(this,'#comment');}hasFocus(){return this.focused;}
 frame(){for(const [id,run] of [...this.frames]){this.frames.delete(id);run(0);}}
}
type Options={cls?:string;attr?:Record<string,string>;text?:string};
class El extends Events {
 migrations=new Set<()=>unknown>();
 onWindowMigrated(listener:()=>unknown){this.migrations.add(listener);return()=>this.migrations.delete(listener);}
 children:El[]=[];parentNode:El|null=null;dataset:Record<string,string>={};attrs:Record<string,string>={};className='';textContent='';title='';disabled=false;hidden=false;root=false;focusCalls=0;icon='';
 onclick:((event:MouseEvent)=>void)|null=null;onpointerdown:((event:Event)=>void)|null=null;ondblclick:((event:Event)=>void)|null=null;
 constructor(public ownerDocument:Doc,public tagName:string) {super();}
 get classList(){return{contains:(name:string)=>this.className.split(' ').includes(name),toggle:(name:string,on:boolean)=>{const classes=new Set(this.className.split(' ').filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.className=[...classes].join(' ');}};}
 get isConnected():boolean{return this.root||!!this.parentNode?.isConnected;}
 getClientRects():object[]{return this.isConnected&&!this.hidden&&(!this.parentNode||this.parentNode.getClientRects().length)?[{}]:[];}
 append(...children:El[]){for(const child of children){child.remove();child.parentNode=this;this.children.push(child);}}
 before(child:El){const parent=this.parentNode!;child.remove();child.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,child);}
 replaceWith(child:El){const parent=this.parentNode!;child.remove();child.parentNode=parent;parent.children.splice(parent.children.indexOf(this),1,child);this.parentNode=null;}
 remove(){if(!this.parentNode)return;const focus=this.ownerDocument.activeElement,blur=!!focus&&this.contains(focus);this.parentNode.children=this.parentNode.children.filter(e=>e!==this);this.parentNode=null;if(blur){this.ownerDocument.activeElement=null;this.ownerDocument.onBlur?.();}}
 contains(target:unknown):boolean{return target===this||this.children.some(e=>e.contains(target));}
 setAttribute(name:string,value:string){this.attrs[name]=value;}removeAttribute(name:string){delete this.attrs[name];}
 focus(){this.focusCalls++;this.ownerDocument.activeElement=this;this.ownerDocument.dispatchEvent(new Event('focusin'));}
 createEl(tag:string,options:Options={}){const child=new El(this.ownerDocument,tag);child.className=options.cls||'';child.attrs={...options.attr};child.textContent=options.text||'';this.append(child);return child;}
 createDiv(options:Options){return this.createEl('div',options);}createSpan(options:Options){return this.createEl('span',options);}
 querySelectorAll(selector:string):El[]{
  if(selector===':scope > .ts-branch-controls')return this.children.filter(e=>e.classList.contains('ts-branch-controls'));
  if(selector.startsWith(':scope > .ts-card-actions'))return this.children.filter(e=>e.classList.contains('ts-card-actions'));
  if(selector==='button:not(:disabled)')return this.children.flatMap(e=>[...(e.tagName==='button'&&!e.disabled?[e]:[]),...e.querySelectorAll(selector)]);
  throw Error(selector);
 }
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
 find(cls:string):El|undefined{return this.children.find(e=>e.classList.contains(cls))||this.children.map(e=>e.find(cls)).find(Boolean);}
}
const module={exports:{} as typeof import('../src/live-branch-controls')};
new Function('require','module','exports',transformSync(readFileSync('src/live-branch-controls.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{assert.equal(name,'obsidian');return{setIcon:(e:El,icon:string)=>{e.icon=icon;}};},module,module.exports);
const {mountLiveBranchControls,updateLiveBranchControls}=module.exports;
function adopt(root:El,next:Doc){const elements:El[]=[];const walk=(el:El)=>{el.ownerDocument=next;elements.push(el);el.children.forEach(walk);};walk(root);for(const el of elements)for(const callback of [...el.migrations])callback();}

function fixture(initial:Partial<BranchControlsOptions>={}){
 const doc=new Doc(),root=doc.createElement('div'),host=doc.createElement('div'),contextHost=doc.createElement('div');root.root=true;root.append(host,contextHost);host.dataset.mediaBranches='live';
 const player=host.createEl('video'),actions=host.createDiv({cls:'ts-card-actions'}),fold=actions.createEl('button',{cls:'ts-content-fold'}),outside=root.createEl('input');
 const playback={time:32.4,paused:false,native:player},calls:{name:string;count:number}[]=[],state={current:true,canAct:true,selected:true,invalidated:0,redirect:false,invalidateOwner:false};
 const context=new CardControlContext(contextHost as unknown as HTMLElement,()=>{}),target={owner:{},card:host as unknown as HTMLElement,label:'所选：媒体',current:()=>state.current&&state.selected};
 const options=(overrides:Partial<BranchControlsOptions>={}):BranchControlsOptions=>{const value={count:3,candidates:0,folded:false,disabled:false,group:false,...overrides};return{...value,onToggle:()=>calls.push({name:'toggle',count:value.count}),onMenu:()=>calls.push({name:'menu',count:value.count})};};
 const dispose=mountLiveBranchControls(host as unknown as HTMLElement,options(initial),{current:()=>state.current,canAct:()=>state.canAct&&(!host.dataset.controlContext||state.selected),invalidate:group=>{state.invalidated++;context.invalidateControl(group);if(state.redirect)outside.focus();if(state.invalidateOwner)state.current=false;},fallbackFocus:()=>context.first(target.card)||fold as unknown as HTMLElement});
 const group=host.find('ts-branch-controls')!,toggle=group.find('ts-branch-toggle')!,menu=group.find('ts-branch-menu')!;
 const event=(type:string,el:El,id=1)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{target:{value:el},pointerId:{value:id}});el.ownerDocument.dispatchEvent(e);if(type==='pointerdown'&&group.contains(el))group.dispatchEvent(e);return e;};
 const key=(type:string,el:El,extra:Partial<KeyboardEvent>={})=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,Object.fromEntries(Object.entries({target:el,key:' ',...extra}).map(([name,value])=>[name,{value}])));if(type==='keydown')group.dispatchEvent(e);else el.ownerDocument.dispatchEvent(e);return e;};
 const click=(button:El,id=1,detail=1)=>button.onclick?.({stopPropagation(){},pointerId:id,detail} as unknown as MouseEvent);
 const update=(overrides:Partial<BranchControlsOptions>)=>updateLiveBranchControls(host as unknown as HTMLElement,options(overrides));
 const cleanup=()=>{context.dispose();dispose();};
 return{doc,root,host,contextHost,player,actions,fold,outside,playback,calls,state,context,target,group,toggle,menu,event,key,click,update,dispose,cleanup};
}
test('live group and original buttons update through a context lease without touching the player',()=>{
 const f=fixture(),before=[...f.host.children],playback={...f.playback};f.context.update(f.target);
 for(const count of [5,0,4]){assert.equal(f.update({count,candidates:count?0:2}),true);assert.equal(f.contextHost.contains(f.group),true);assert.equal(f.group.find('ts-branch-toggle'),f.toggle);assert.equal(f.group.find('ts-branch-menu'),f.menu);assert.equal(f.player.parentNode,f.host);assert.deepEqual(f.playback,playback);}
 f.click(f.menu,1,0);assert.deepEqual(f.calls,[{name:'menu',count:4}]);f.context.update();assert.deepEqual(f.host.children,before);f.cleanup();
});
test('empty-at-mount group is stable and becomes available inside the original context',()=>{const f=fixture({count:0,candidates:0});assert.equal(f.group.hidden,true);assert.equal(f.toggle.disabled,true);f.context.update(f.target);f.update({count:2});assert.equal(f.contextHost.contains(f.group),true);assert.equal(f.group.hidden,false);assert.equal(f.menu.hidden,false);f.click(f.menu,1,0);assert.deepEqual(f.calls,[{name:'menu',count:2}]);f.cleanup();});
test('update invalidates a held gesture even when its replacement options are enabled again',()=>{const f=fixture();f.context.update(f.target);f.event('pointerdown',f.menu,9);f.update({count:7});assert.equal(f.menu.disabled,true);f.event('pointerup',f.menu,9);assert.equal(f.menu.disabled,false);f.click(f.menu,9);assert.deepEqual(f.calls,[]);f.event('pointerdown',f.menu,9);f.event('pointerup',f.menu,9);f.click(f.menu,9);assert.deepEqual(f.calls,[{name:'menu',count:7}]);f.cleanup();});
test('count-zero removal cannot dispatch a stale held menu after becoming established again',()=>{const f=fixture();f.event('pointerdown',f.menu,7);f.update({count:0,candidates:0});assert.equal(f.group.hidden,true);f.update({count:2});f.event('pointerup',f.menu,7);f.click(f.menu,7);assert.deepEqual(f.calls,[]);f.click(f.menu,7,0);assert.deepEqual(f.calls,[{name:'menu',count:2}]);f.cleanup();});
test('invalidating branch-held input lets pending context return finish without moving the player',()=>{const f=fixture();f.context.update(f.target);f.event('pointerdown',f.menu,3);f.context.update(undefined,true);assert.equal(f.contextHost.contains(f.group),true);f.update({count:0,candidates:0});f.doc.frame();assert.equal(f.group.parentNode,f.host);assert.equal(f.player.parentNode,f.host);f.event('pointerup',f.menu,3);f.click(f.menu,3);assert.deepEqual(f.calls,[]);f.cleanup();});
test('an unrelated held primary action still delays context return during a branch update',()=>{const f=fixture();f.context.update(f.target);f.event('pointerdown',f.fold,4);f.context.update(undefined,true);f.update({count:2});f.doc.frame();assert.equal(f.contextHost.contains(f.fold),true);f.event('pointerup',f.fold,4);f.doc.frame();assert.equal(f.group.parentNode,f.host);f.cleanup();});
test('borrowed controls cannot act on a new selection but still receive current option updates',()=>{const f=fixture();f.context.update(f.target);f.state.selected=false;assert.equal(f.update({count:8}),true);f.click(f.menu,1,0);assert.deepEqual(f.calls,[]);f.context.update();f.click(f.menu,1,0);assert.deepEqual(f.calls,[{name:'menu',count:8}]);f.cleanup();});
test('hiding the focused menu moves focus only to the still-valid same-group toggle',()=>{const f=fixture();f.context.update(f.target);f.menu.focus();f.update({count:0,candidates:2});assert.equal(f.doc.activeElement,f.toggle);assert.equal(f.menu.hidden,true);assert.equal(f.toggle.hidden,false);assert.deepEqual(f.calls,[]);f.cleanup();});
test('hiding the last focused action returns to the existing primary action',()=>{const f=fixture();f.context.update(f.target);f.menu.focus();f.update({count:0,candidates:0});assert.equal(f.doc.activeElement,f.fold);assert.equal(f.group.hidden,true);assert.deepEqual(f.calls,[]);f.cleanup();});
for(const type of ['unfocused-document','new-input-focus','changed-selection'])test('hidden-menu update does not steal '+type,()=>{const f=fixture();f.context.update(f.target);f.menu.focus();if(type==='unfocused-document')f.doc.focused=false;if(type==='new-input-focus')f.state.redirect=true;if(type==='changed-selection')f.state.selected=false;f.update({count:0,candidates:2});assert.equal(f.toggle.focusCalls,0);if(type==='new-input-focus')assert.equal(f.doc.activeElement,f.outside);f.cleanup();});
test('disabled and count/candidate contracts update without obsolete first-render closures',()=>{const f=fixture();f.update({count:0,candidates:2});assert.equal(f.menu.hidden,true);assert.equal(f.toggle.attrs['aria-expanded'],undefined);f.click(f.toggle,1,0);assert.deepEqual(f.calls,[{name:'toggle',count:0}]);f.update({count:8,disabled:true});assert.equal(f.toggle.disabled,true);assert.equal(f.menu.disabled,true);f.click(f.menu,1,0);assert.equal(f.calls.length,1);f.cleanup();});
test('same owner lost to navigation or document adoption does not update or run callbacks',()=>{for(const change of [(f:ReturnType<typeof fixture>)=>{f.state.current=false;},(f:ReturnType<typeof fixture>)=>{f.host.ownerDocument=new Doc();}]){const f=fixture();change(f);assert.equal(f.update({count:9}),false);f.click(f.menu,1,0);assert.deepEqual(f.calls,[]);f.cleanup();}});
test('dispose removes only group input lifecycle; stale updater and captured callback cannot revive it',()=>{const f=fixture(),oldClick=f.menu.onclick!;const baseline=f.doc.count()+f.doc.defaultView.count();f.event('pointerdown',f.menu,5);assert.ok(f.doc.count()+f.doc.defaultView.count()>baseline);f.dispose();f.dispose();assert.equal(f.doc.count()+f.doc.defaultView.count(),baseline);assert.equal(f.update({count:9}),false);oldClick({stopPropagation(){},detail:0} as MouseEvent);assert.deepEqual(f.calls,[]);assert.equal(f.player.parentNode,f.host);f.context.dispose();assert.equal(f.doc.count()+f.doc.defaultView.count(),0);});
test('blur invalidates held gesture and releases only temporary global listeners',()=>{const f=fixture(),baseline=f.doc.count()+f.doc.defaultView.count();f.event('pointerdown',f.menu,6);f.doc.defaultView.dispatchEvent(new Event('blur'));assert.equal(f.doc.count()+f.doc.defaultView.count(),baseline);f.click(f.menu,6);assert.deepEqual(f.calls,[]);f.event('pointerdown',f.menu,6);f.event('pointerup',f.menu,6);f.click(f.menu,6);assert.deepEqual(f.calls,[{name:'menu',count:3}]);f.cleanup();});

test('owner invalidation during synchronous control invalidation stops further presentation updates',()=>{const f=fixture();const before=f.toggle.attrs['aria-label'];f.state.invalidateOwner=true;assert.equal(f.update({count:99}),false);assert.equal(f.toggle.attrs['aria-label'],before);f.click(f.menu,1,0);assert.deepEqual(f.calls,[]);f.cleanup();});
test('duplicate live mounting cannot create a second group or overwrite the exact host record',()=>{const f=fixture(),before=[...f.host.children];assert.throws(()=>mountLiveBranchControls(f.host as unknown as HTMLElement,{} as BranchControlsOptions,{current:()=>true,canAct:()=>true,invalidate:()=>{},fallbackFocus:()=>null}),/already mounted/);assert.deepEqual(f.host.children,before);assert.equal(f.update({count:4}),true);f.cleanup();});

test('Space activates the exact focused original button once on release',()=>{const f=fixture();f.menu.focus();const baseline=f.doc.count()+f.doc.defaultView.count();assert.equal(f.key('keydown',f.menu).defaultPrevented,true);assert.deepEqual(f.calls,[]);assert.equal(f.key('keydown',f.menu,{repeat:true}).defaultPrevented,true);assert.equal(f.key('keyup',f.menu).defaultPrevented,true);assert.deepEqual(f.calls,[{name:'menu',count:3}]);assert.equal(f.doc.count()+f.doc.defaultView.count(),baseline);f.cleanup();});
test('Space held across an option update cannot invoke replacement options; a fresh press can',()=>{const f=fixture();f.menu.focus();f.key('keydown',f.menu);f.update({count:8});assert.equal(f.menu.disabled,true);assert.equal(f.key('keyup',f.menu).defaultPrevented,true);assert.equal(f.menu.disabled,false);assert.deepEqual(f.calls,[]);f.key('keydown',f.menu);f.key('keyup',f.menu);assert.deepEqual(f.calls,[{name:'menu',count:8}]);f.cleanup();});
test('Space held across removal and reappearance stays invalid through release',()=>{const f=fixture();f.menu.focus();f.key('keydown',f.menu);f.update({count:0,candidates:0});f.update({count:9});f.menu.focus();assert.equal(f.key('keyup',f.menu).defaultPrevented,true);assert.deepEqual(f.calls,[]);f.click(f.menu,1,0);assert.deepEqual(f.calls,[{name:'menu',count:9}]);f.cleanup();});
test('Space press loses ownership on element blur even if the same button regains focus',()=>{const f=fixture();f.menu.focus();f.key('keydown',f.menu);const blur=new Event('focusout');Object.defineProperty(blur,'target',{value:f.menu});f.group.dispatchEvent(blur);f.outside.focus();f.menu.focus();f.key('keyup',f.menu);assert.deepEqual(f.calls,[]);f.key('keydown',f.menu);f.key('keyup',f.menu);assert.deepEqual(f.calls,[{name:'menu',count:3}]);f.cleanup();});
test('window blur and disposal release Space listeners and reject a late release',()=>{for(const close of ['blur','dispose']){const f=fixture();f.menu.focus();const baseline=f.doc.count()+f.doc.defaultView.count();f.key('keydown',f.menu);if(close==='blur')f.doc.defaultView.dispatchEvent(new Event('blur'));else f.dispose();assert.equal(f.doc.count()+f.doc.defaultView.count(),baseline);f.key('keyup',f.menu);assert.deepEqual(f.calls,[]);f.cleanup();}});
test('AT and Enter detail-zero clicks remain independent actions after a cancelled Space press',()=>{const f=fixture();f.menu.focus();f.key('keydown',f.menu);f.update({count:4});f.key('keyup',f.menu);assert.equal(f.key('keydown',f.menu,{key:'Enter'}).defaultPrevented,false);f.click(f.menu,1,0);f.click(f.menu,1,0);assert.deepEqual(f.calls,[{name:'menu',count:4},{name:'menu',count:4}]);f.cleanup();});
test('Space ownership excludes IME, modified, already-prevented, and nonfocused input',()=>{for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true}]){const f=fixture();f.menu.focus();assert.equal(f.key('keydown',f.menu,extra).defaultPrevented,false);f.key('keyup',f.menu);assert.deepEqual(f.calls,[]);f.cleanup();}const f=fixture();f.outside.focus();assert.equal(f.key('keydown',f.menu).defaultPrevented,false);f.key('keyup',f.menu);assert.deepEqual(f.calls,[]);f.cleanup();});
test('Space release rechecks current owner, selected context, focus and cancellation',()=>{for(const change of [(f:ReturnType<typeof fixture>)=>{f.state.current=false;},(f:ReturnType<typeof fixture>)=>{f.state.selected=false;},(f:ReturnType<typeof fixture>)=>{f.outside.focus();},(f:ReturnType<typeof fixture>)=>{f.doc.focused=false;}]){const f=fixture();f.context.update(f.target);f.menu.focus();f.key('keydown',f.menu);change(f);f.key('keyup',f.menu);assert.deepEqual(f.calls,[]);f.cleanup();}});

test('media originals adopt the actual new document with their context and player intact',()=>{
 const f=fixture(),next=new Doc();f.context.update(f.target);const parent=f.group.parentNode,playback={...f.playback},focus=f.menu.focusCalls;adopt(f.root,next);
 assert.equal(f.group.parentNode,parent);assert.equal(f.player.parentNode,f.host);assert.deepEqual(f.playback,playback);assert.equal(f.menu.focusCalls,focus);assert.equal(f.doc.count()+f.doc.defaultView.count(),0);assert.equal(f.update({count:6}),true);
 f.menu.focus();f.key('keydown',f.menu);f.key('keyup',f.menu);assert.deepEqual(f.calls,[{name:'menu',count:6}]);const click=new Event('click',{cancelable:true});f.contextHost.dispatchEvent(click);assert.equal(click.defaultPrevented,false);f.cleanup();assert.equal(next.count()+next.defaultView.count()+f.host.migrations.size+f.contextHost.migrations.size,0);
});
test('migration retires old held pointer and Space without reviving either in the new document',()=>{
 const f=fixture(),next=new Doc();f.context.update(f.target);f.menu.focus();f.key('keydown',f.menu);f.event('pointerdown',f.menu,11);const oldKey=[...f.doc.listeners.get('keyup')!],oldUp=[...f.doc.listeners.get('pointerup')!];adopt(f.root,next);
 assert.equal(f.doc.count()+f.doc.defaultView.count(),0);f.click(f.menu,11);f.menu.focus();f.key('keyup',f.menu);assert.deepEqual(f.calls,[]);
 f.key('keydown',f.menu);for(const fn of [...oldKey,...oldUp])if(typeof fn==='function')fn(new Event('keyup'));assert.deepEqual(f.calls,[]);f.key('keyup',f.menu);assert.deepEqual(f.calls,[{name:'menu',count:3}]);f.event('pointerdown',f.menu,11);f.event('pointerup',f.menu,11);f.click(f.menu,11);assert.equal(f.calls.length,2);f.cleanup();
});
test('late migration callback cannot revive disposed live group and changed scope cannot adopt',()=>{
 for(const disposed of [false,true]){const f=fixture(),next=new Doc(),callback=[...f.host.migrations][0];if(disposed)f.dispose();else f.state.current=false;adopt(f.root,next);callback();assert.equal(f.update({count:9}),false);f.click(f.menu,1,0);assert.deepEqual(f.calls,[]);f.cleanup();assert.equal(f.doc.count()+f.doc.defaultView.count()+next.count()+next.defaultView.count(),0);}
});


test('actual Board media update advances its key only after a successful current-owner update',()=>{
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('if(isMedia&&old.dataset.mediaBranches!==mediaBranchKey'),end=source.indexOf("old.toggleClass('is-selected'",start);assert.ok(start>=0&&end>start);
 const run=new Function('old','isMedia','mediaBranchKey','branchOptions','childCount','n','updateLiveBranchControls',source.slice(start,end));
 const classes:{name:string;value:boolean}[]=[],old={dataset:{mediaBranches:'previous'},classList:{toggle:(name:string,value:boolean)=>classes.push({name,value})}},options={count:2},node={branchFolded:true};let accepted=false,calls=0;
 const update=(host:unknown,received:unknown)=>{assert.equal(host,old);assert.equal(received,options);calls++;return accepted;};
 run(old,true,'next',options,2,node,update);assert.equal(old.dataset.mediaBranches,'previous');assert.deepEqual(classes,[]);accepted=true;run(old,true,'next',options,2,node,update);assert.equal(old.dataset.mediaBranches,'next');assert.deepEqual(classes,[{name:'has-folded-branches',value:true}]);run(old,true,'next',options,2,node,update);assert.equal(calls,2);
 assert.ok(source.includes("if(isMedia)el.dataset.mediaBranches='';"),'initial marker does not claim an unverified successful update');
});
