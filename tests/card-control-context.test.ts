import test from 'node:test';
import assert from 'node:assert/strict';
import {CardControlContext,syncCardPortTabStops} from '../src/card-control-context';

class Events extends EventTarget {
 // Node 22 clears currentTarget between listeners; preserve browser semantics.
 override dispatchEvent(event:Event){Object.defineProperty(event,'currentTarget',{value:this,configurable:true});try{return super.dispatchEvent(event);}finally{Object.defineProperty(event,'currentTarget',{value:null,configurable:true});}}
 listeners=new Map<string,Set<EventListenerOrEventListenerObject>>();
 override addEventListener(type:string,listener:EventListenerOrEventListenerObject|null,options?:AddEventListenerOptions|boolean){if(listener){const set=this.listeners.get(type)||new Set();set.add(listener);this.listeners.set(type,set);}super.addEventListener(type,listener,options);}
 override removeEventListener(type:string,listener:EventListenerOrEventListenerObject|null,options?:EventListenerOptions|boolean){if(listener)this.listeners.get(type)?.delete(listener);super.removeEventListener(type,listener,options);}
 count(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
class Doc extends Events {
 activeElement:El|null=null;focused=true;onBlur?:()=>void;frames=new Map<number,FrameRequestCallback>();serial=0;
 defaultView=Object.assign(new Events(),{requestAnimationFrame:(fn:FrameRequestCallback)=>{this.frames.set(++this.serial,fn);return this.serial;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)});
 createElement(tag:string){return new El(this,tag);}
 createComment(_text:string){return new El(this,'#comment');}
 hasFocus(){return this.focused;}
 frame(){const frames=[...this.frames.values()];this.frames.clear();for(const run of frames)run(0);}
}
class El extends Events {
 migrations=new Set<()=>unknown>();
 onWindowMigrated(listener:()=>unknown){this.migrations.add(listener);return()=>this.migrations.delete(listener);}
 children:El[]=[];parentNode:El|null=null;dataset:Record<string,string>={};attrs:Record<string,string>={};className='';textContent='';title='';hidden=false;disabled=false;tabIndex=0;root=false;focusCalls=0;
 constructor(public ownerDocument:Doc,public tagName:string){super();}
 get classList(){return{contains:(name:string)=>this.className.split(' ').includes(name)};}
 get isConnected():boolean{return this.root||!!this.parentNode?.isConnected;}
 append(...children:El[]){for(const child of children){child.remove();child.parentNode=this;this.children.push(child);}}
 before(child:El){const parent=this.parentNode!;child.remove();child.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,child);}
 replaceWith(child:El){const parent=this.parentNode!;child.remove();child.parentNode=parent;parent.children.splice(parent.children.indexOf(this),1,child);this.parentNode=null;}
 remove(){if(!this.parentNode)return;const active=this.ownerDocument.activeElement,blur=!!active&&this.contains(active);this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;if(blur){this.ownerDocument.activeElement=null;this.ownerDocument.onBlur?.();}}
 contains(target:unknown):boolean{return target===this||this.children.some(child=>child.contains(target));}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 focus(){this.focusCalls++;this.ownerDocument.activeElement=this;}
 closest(selector:string):El|null{if(selector==='button'&&this.tagName==='button')return this;if(selector.split(',').some(s=>s.startsWith('.')&&this.classList.contains(s.slice(1))))return this;return this.parentNode?.closest(selector)||null;}
 querySelectorAll(selector:string):El[]{
  if(selector===':scope > .ts-branch-controls')return this.children.filter(el=>el.classList.contains('ts-branch-controls'));
  if(selector===':scope > .ts-connect-port')return this.children.filter(el=>el.classList.contains('ts-connect-port'));
  if(selector.startsWith(':scope > .ts-card-actions'))return this.children.flatMap(el=>el.classList.contains('ts-card-actions')?[el]:el.classList.contains('ts-compact-fold-row')?el.children.filter(child=>child.classList.contains('ts-compact-actions')||child.classList.contains('ts-compact-inline-unfold')):[]);
  assert.equal(selector,'button:not(:disabled)');return this.children.flatMap(el=>[...(el.tagName==='button'&&!el.disabled?[el]:[]),...el.querySelectorAll(selector)]);
 }
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
}
function adopt(root:El,next:Doc){const elements:El[]=[];const walk=(el:El)=>{el.ownerDocument=next;elements.push(el);el.children.forEach(walk);};walk(root);for(const el of elements)for(const callback of [...el.migrations])callback();}

function fixture(compact=false){
 const doc=new Doc(),root=doc.createElement('div'),host=doc.createElement('div'),card=doc.createElement('div');root.root=true;root.append(card,host);
 const before=doc.createElement('span'),actions=doc.createElement('div'),after=doc.createElement('span'),edit=doc.createElement('button'),read=doc.createElement('button');
 actions.className=compact?'ts-compact-actions':'ts-card-actions';edit.className='ts-card-quick-edit';read.className='ts-card-quick-read';actions.append(edit,read);
 const row=compact?doc.createElement('div'):card;if(compact){row.className='ts-compact-fold-row';card.append(row);}row.append(before,actions,after);
 const unfold=compact?doc.createElement('button'):undefined;if(unfold){unfold.className='ts-compact-inline-unfold';row.append(unfold);}
 const original=[...row.children],owner={},state={current:true,changes:0};let clicks=0;read.addEventListener('click',()=>clicks++);
 const context=new CardControlContext(host as unknown as HTMLElement,()=>state.changes++),target={owner,card:card as unknown as HTMLElement,label:'所选：中文长标题 / 2026',current:()=>state.current};
 const event=(type:string,el:El,id=1)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{target:{value:el},pointerId:{value:id}});el.ownerDocument.dispatchEvent(e);return e;};
 return{doc,root,host,card,row,actions,edit,read,unfold,original,state,context,target,event,clicks:()=>clicks};
}
for(const compact of [false,true])test(`original ${compact?'folded':'expanded'} buttons return to exact anchors, keep listeners and order`,()=>{
 const f=fixture(compact);f.context.update(f.target);assert.equal(f.context.owns(f.target.card),true);assert.equal(f.card.dataset.controlContext,'true');assert.equal(f.host.hidden,false);
 assert.equal(f.context.first(f.target.card),f.edit);assert.equal(f.context.contains(f.target.card,f.read as unknown as Node),true);
 f.read.dispatchEvent(new Event('click'));assert.equal(f.clicks(),1);assert.equal(f.row.children.includes(f.actions),false);
 f.context.update();assert.deepEqual(f.row.children,f.original);assert.equal(f.host.hidden,true);assert.equal(f.card.dataset.controlContext,undefined);f.context.dispose();
});
test('moving a focused original and resizing same selection preserve the exact element without invoking it',()=>{
 const f=fixture();f.read.focus();f.context.update(f.target);assert.equal(f.doc.activeElement,f.read);const count=f.read.focusCalls;
 f.context.update({...f.target,label:'所选：重命名'});assert.equal(f.doc.activeElement,f.read);assert.equal(f.read.focusCalls,count);assert.equal(f.clicks(),0);
 f.context.update(undefined,true);assert.equal(f.doc.activeElement,f.read);assert.deepEqual(f.row.children,f.original);f.context.dispose();
});
test('blur reentry during a DOM move is deferred and does not recursively remount controls',()=>{
 const f=fixture();f.read.focus();f.doc.onBlur=()=>f.context.update(f.target);f.context.update(f.target);assert.equal(f.doc.activeElement,f.read);f.doc.frame();assert.equal(f.context.owns(f.target.card),true);assert.equal(f.state.changes,1);f.context.dispose();
});
test('pressed original is not moved until after pointer release and its click',()=>{
 const f=fixture();f.context.update(f.target);f.event('pointerdown',f.read);f.context.update(undefined,true);assert.equal(f.context.owns(f.target.card),true);
 f.event('pointerup',f.read);assert.equal(f.context.owns(f.target.card),true);f.read.dispatchEvent(new Event('click'));assert.equal(f.clicks(),1);f.doc.frame();assert.equal(f.context.owns(f.target.card),false);assert.deepEqual(f.row.children,f.original);f.context.dispose();
});
test('owner invalidation blocks a late click and cannot steal focus on release',()=>{
 const f=fixture();f.context.update(f.target);f.read.focus();f.event('pointerdown',f.read);f.state.current=false;f.context.update();
 const event=new Event('click',{cancelable:true});f.host.dispatchEvent(event);assert.equal(event.defaultPrevented,true);const count=f.read.focusCalls;
 f.event('pointerup',f.read);f.doc.frame();assert.equal(f.read.focusCalls,count);assert.equal(f.host.hidden,true);f.context.dispose();
});
test('clear during held input restores synchronously and queued callbacks cannot revive old controls',()=>{
 const f=fixture();f.context.update(f.target);f.event('pointerdown',f.read);f.context.update();f.event('pointerup',f.read);const queued=[...f.doc.frames.values()];f.context.clear();assert.deepEqual(f.row.children,f.original);assert.equal(f.doc.frames.size,0);
 f.card.remove();for(const callback of queued)callback(0);assert.equal(f.host.hidden,true);assert.equal(f.context.owns(f.target.card),false);f.context.dispose();
});
test('foreign document, disconnected card and stale owner cannot claim a context',()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>{f.card.ownerDocument=new Doc();},(f:ReturnType<typeof fixture>)=>f.card.remove(),(f:ReturnType<typeof fixture>)=>{f.state.current=false;}]){
  const f=fixture();mutate(f);f.context.update(f.target);assert.equal(f.host.hidden,true);assert.equal(f.context.owns(f.target.card),false);assert.deepEqual(f.row.children,f.original);f.context.dispose();
 }
});
test('an unfocused native document never receives focus during move or return',()=>{
 const f=fixture();f.read.focus();f.doc.focused=false;const count=f.read.focusCalls;f.context.update(f.target);f.context.update(undefined,true);assert.equal(f.read.focusCalls,count);f.context.dispose();
});
test('dispose removes listeners and frames exactly once even with a pressed pending target',()=>{
 const f=fixture();f.context.update(f.target);f.event('pointerdown',f.read);f.context.update();f.context.dispose();f.context.dispose();assert.equal(f.doc.count()+f.doc.defaultView.count()+f.host.count()+f.doc.frames.size,0);assert.deepEqual(f.row.children,f.original);f.context.update(f.target);assert.equal(f.host.hidden,true);
});
test('port tab eligibility changes only tabIndex; original events, disabled and identity remain',()=>{
 const f=fixture(),ports=[1,2,3,4].map(()=>{const el=f.doc.createElement('button');el.className='ts-connect-port';return el;});f.card.append(...ports);ports[2].disabled=true;let calls=0;ports[0].addEventListener('click',()=>calls++);
 syncCardPortTabStops(f.target.card,false);assert.deepEqual(ports.map(el=>el.tabIndex),[-1,-1,-1,-1]);syncCardPortTabStops(f.target.card,true);assert.deepEqual(ports.map(el=>el.tabIndex),[0,0,0,0]);assert.equal(ports[2].disabled,true);ports[0].dispatchEvent(new Event('click'));assert.equal(calls,1);f.context.dispose();
});

test('clear during blur invalidates the in-progress borrow and returns every original without an orphaned host',()=>{
 const f=fixture(true);f.read.focus();f.doc.onBlur=()=>f.context.clear();f.context.update(f.target);
 assert.equal(f.context.owns(f.target.card),false);assert.equal(f.host.hidden,true);assert.equal(f.card.dataset.controlContext,undefined);assert.deepEqual(f.row.children,f.original);assert.equal(f.host.contains(f.read),false);f.context.dispose();assert.equal(f.host.contains(f.read),false);
});
test('dispose during blur cannot continue a borrow or leave context listeners',()=>{
 const f=fixture();f.read.focus();f.doc.onBlur=()=>f.context.dispose();f.context.update(f.target);assert.equal(f.host.hidden,true);assert.deepEqual(f.row.children,f.original);assert.equal(f.host.contains(f.read),false);assert.equal(f.doc.count()+f.doc.defaultView.count()+f.host.count()+f.doc.frames.size,0);
});
for(const returning of [false,true])test(`a native blur handler's deliberate new focus is retained during ${returning?'return':'borrow'}`,()=>{
 const f=fixture(),input=f.doc.createElement('input');f.root.append(input);if(returning)f.context.update(f.target);f.read.focus();f.doc.onBlur=()=>input.focus();
 if(returning)f.context.update(undefined,true);else f.context.update(f.target);
 assert.equal(f.doc.activeElement,input);f.context.dispose();
});
test('clear prevents a blur callback from borrowing the same soon-to-be-removed card again',()=>{
 const f=fixture();f.context.update(f.target);f.read.focus();f.doc.onBlur=()=>f.context.update(f.target);f.context.clear();f.doc.frame();assert.equal(f.context.owns(f.target.card),false);assert.equal(f.host.hidden,true);assert.deepEqual(f.row.children,f.original);f.context.dispose();
});

function branchFixture(compact=false,media=false){const f=fixture(compact);f.card.className='ts-node ts-card';if(media)f.card.dataset.mediaBranches='[1,0,false,false]';const group=f.doc.createElement('div'),toggle=f.doc.createElement('button'),menu=f.doc.createElement('button');group.className='ts-branch-controls';toggle.className='ts-branch-toggle';menu.className='ts-branch-menu';group.append(toggle,menu);f.card.append(group);let toggles=0,menus=0;toggle.addEventListener('click',()=>toggles++);menu.addEventListener('click',()=>menus++);return{...f,group,toggle,menu,toggles:()=>toggles,menus:()=>menus};}
for(const compact of [false,true])test(`ordinary ${compact?'folded':'expanded'} branch group follows original primary actions and returns exact order`,()=>{const f=branchFixture(compact),before=[...f.card.children];f.context.update(f.target);assert.equal(f.context.first(f.target.card),f.edit);assert.equal(f.host.contains(f.group),true);assert.equal(f.group.parentNode!.children.at(-1),f.group);f.toggle.dispatchEvent(new Event('click'));f.menu.dispatchEvent(new Event('click'));assert.equal(f.toggles(),1);assert.equal(f.menus(),1);f.context.update();assert.deepEqual(f.card.children,before);assert.equal(f.group.children[1],f.menu);f.context.dispose();});
test('stable media/online groups share the exact context lease and return original anchors',()=>{const f=branchFixture(false,true),before=[...f.card.children];f.context.update(f.target);assert.equal(f.host.contains(f.group),true);f.context.update(f.target);f.context.clear();assert.deepEqual(f.card.children,before);assert.equal(f.group.parentNode,f.card);f.context.dispose();});
test('focused branch node survives borrow/return without invoking either action',()=>{const f=branchFixture();f.menu.focus();f.context.update(f.target);assert.equal(f.doc.activeElement,f.menu);f.context.update(undefined,true);assert.equal(f.doc.activeElement,f.menu);assert.equal(f.menus()+f.toggles(),0);f.context.dispose();});
test('held branch pointer delays return until after the original click',()=>{const f=branchFixture();f.context.update(f.target);f.event('pointerdown',f.menu);f.context.update(undefined,true);assert.equal(f.host.contains(f.menu),true);f.event('pointerup',f.menu);f.menu.dispatchEvent(new Event('click'));assert.equal(f.menus(),1);f.doc.frame();assert.equal(f.group.parentNode,f.card);f.context.dispose();});
test('branch disabled state and owner invalidation remain enforced',()=>{const f=branchFixture();f.toggle.disabled=true;f.context.update(f.target);assert.equal(f.toggle.disabled,true);f.state.current=false;const click=new Event('click',{cancelable:true});f.host.dispatchEvent(click);assert.equal(click.defaultPrevented,true);f.context.clear();assert.equal(f.group.parentNode,f.card);f.context.dispose();});

for(const kind of ['text','image','pdf','board','section'])test(`${kind} direct branch borrows originals; section header stays in flow`,()=>{
 const f=branchFixture(kind==='section');f.card.className='ts-node ts-'+kind+(kind==='section'?' is-compact-fold':'');const before=[...f.card.children];
 f.context.update(f.target);assert.equal(f.host.contains(f.group),true);assert.equal(f.context.first(f.target.card),f.edit);f.menu.dispatchEvent(new Event('click'));assert.equal(f.menus(),1);
 f.context.update(undefined,true);assert.deepEqual(f.card.children,before);assert.equal(f.group.parentNode,f.card);f.context.dispose();
});
for(const kind of ['audio','video','text'])test(`${kind} stable live branch group follows primary actions and retains their held input`,()=>{
 const f=branchFixture(false,true);f.card.className='ts-node ts-'+kind;const before=[...f.card.children];f.context.update(f.target);assert.equal(f.host.contains(f.group),true);assert.equal(f.host.contains(f.actions),true);
 f.event('pointerdown',f.read);f.context.update(undefined,true);f.context.invalidateControl(f.group as unknown as HTMLElement);f.doc.frame();assert.equal(f.host.contains(f.read),true);f.event('pointerup',f.read);f.doc.frame();assert.deepEqual(f.card.children,before);f.context.dispose();
});
test('expanded section inline header branch is never borrowed from its header',()=>{
 const f=branchFixture();f.card.className='ts-node ts-section';const header=f.doc.createElement('div');header.className='ts-node-header';f.card.append(header);header.append(f.group);
 f.context.update(f.target);assert.equal(f.group.parentNode,header);assert.equal(f.host.contains(f.group),false);f.context.dispose();
});

test('original nonmedia context survives native adoption without node moves or focus restoration',()=>{
 const f=branchFixture(),next=new Doc();f.context.update(f.target);const parent=f.group.parentNode,children=[...f.card.children],focus=f.read.focusCalls;adopt(f.root,next);
 assert.equal(f.group.parentNode,parent);assert.deepEqual(f.card.children,children);assert.equal(f.context.owns(f.target.card),true);assert.equal(f.read.focusCalls,focus);assert.equal(f.doc.count()+f.doc.defaultView.count(),0);assert.equal(next.count()+next.defaultView.count(),6);
 const click=new Event('click',{cancelable:true});f.host.dispatchEvent(click);assert.equal(click.defaultPrevented,false);
 f.event('pointerdown',f.read);f.context.update(undefined,true);assert.equal(f.host.contains(f.read),true);f.event('pointerup',f.read);next.frame();assert.equal(f.group.parentNode,f.card);f.context.dispose();assert.equal(next.count()+next.defaultView.count()+f.host.migrations.size,0);
});
test('native adoption cancels old-window pending frames and held input before new input',()=>{
 const f=branchFixture(),next=new Doc();f.context.update(f.target);f.event('pointerdown',f.menu);f.context.update();f.event('pointerup',f.menu);const callbacks=[...f.doc.frames.values()];adopt(f.root,next);assert.equal(f.doc.frames.size,0);assert.equal(f.host.contains(f.menu),true);
 f.event('pointerdown',f.menu);f.context.update();for(const run of callbacks)run(0);assert.equal(f.host.contains(f.menu),true);f.event('pointerup',f.menu);next.frame();assert.equal(f.group.parentNode,f.card);f.context.dispose();
});
test('partial or stale-owner adoption never accepts a foreign context click',()=>{
 for(const stale of [false,true]){const f=branchFixture(),next=new Doc();f.context.update(f.target);if(stale)f.state.current=false;adopt(f.host,next);const click=new Event('click',{cancelable:true});f.host.dispatchEvent(click);assert.equal(click.defaultPrevented,true);assert.equal(f.doc.count()+f.doc.defaultView.count(),0);assert.equal(next.count()+next.defaultView.count(),0);f.context.dispose();}
});
test('migration callback retained after dispose cannot rebind listeners or borrow controls',()=>{
 const f=fixture(),next=new Doc(),callback=[...f.host.migrations][0];f.context.update(f.target);f.context.dispose();adopt(f.root,next);callback();f.context.update(f.target);assert.equal(next.count()+next.defaultView.count(),0);assert.equal(f.host.hidden,true);assert.deepEqual(f.row.children,f.original);
});
test('adoption during an in-progress focused borrow retires that lease without orphaned controls',()=>{
 const f=branchFixture(),next=new Doc();f.read.focus();f.doc.onBlur=()=>adopt(f.root,next);f.context.update(f.target);assert.equal(f.host.hidden,true);assert.equal(f.context.owns(f.target.card),false);assert.equal(f.group.parentNode,f.card);assert.equal(f.actions.parentNode,f.card);assert.equal(f.doc.count()+f.doc.defaultView.count(),0);f.context.dispose();assert.equal(next.count()+next.defaultView.count(),0);
});
test('original primary held click is retired by migration until a new actual pointer press',()=>{
 const f=fixture(),next=new Doc();f.context.update(f.target);f.event('pointerdown',f.read,7);adopt(f.root,next);
 const click=(id:number,detail=1,view?:{document:Doc})=>{const event=new Event('click',{cancelable:true});Object.defineProperties(event,{target:{value:f.read},pointerId:{value:id},detail:{value:detail},view:{value:view}});f.host.dispatchEvent(event);return event;};
 assert.equal(click(7).defaultPrevented,true);assert.equal(click(7,0).defaultPrevented,false);assert.equal(click(8,0,{document:f.doc}).defaultPrevented,true);f.event('pointerdown',f.read,7);f.event('pointerup',f.read,7);assert.equal(click(7).defaultPrevented,false);f.context.dispose();
});
test('full native adoption retires an obsolete selection and accepts the next legitimate owner',()=>{
 const f=branchFixture(),next=new Doc();f.context.update(f.target);f.state.current=false;adopt(f.root,next);assert.equal(f.group.parentNode,f.card);assert.equal(f.host.hidden,true);
 const card=next.createElement('div'),actions=next.createElement('div'),button=next.createElement('button');actions.className='ts-card-actions';actions.append(button);card.append(actions);f.root.append(card);
 f.context.update({owner:{},card:card as unknown as HTMLElement,label:'新的合法选择',current:()=>true});assert.equal(f.context.owns(card as unknown as HTMLElement),true);assert.equal(f.host.contains(button),true);assert.equal(f.group.parentNode,f.card);assert.equal(f.read.focusCalls+button.focusCalls,0);f.context.dispose();assert.equal(next.count()+next.defaultView.count(),0);
});
test('obsolete migrated lease with a missing original anchor is not silently returned or adopted',()=>{
 const f=branchFixture(),next=new Doc();f.context.update(f.target);f.state.current=false;f.card.children.find(el=>el.tagName==='#comment')!.remove();adopt(f.root,next);const click=new Event('click',{cancelable:true});f.host.dispatchEvent(click);assert.equal(click.defaultPrevented,true);assert.equal(next.count()+next.defaultView.count(),0);f.context.dispose();
});


test('retired pointer gate follows an original primary returned to its card and excludes unrelated UI',()=>{
 const f=fixture(),next=new Doc(),icon=f.doc.createElement('span');f.read.append(icon);f.context.update(f.target);f.event('pointerdown',icon,9);f.state.current=false;adopt(f.root,next);assert.equal(f.read.parentNode,f.actions);assert.equal(f.actions.parentNode,f.card);
 const other=next.createElement('button');f.root.append(other);
 const click=(target:El,detail=1)=>{const event=new Event('click',{cancelable:true});Object.defineProperties(event,{target:{value:target},pointerId:{value:9},detail:{value:detail}});next.dispatchEvent(event);return event;};
 assert.equal(click(f.read).defaultPrevented,true);assert.equal(click(other).defaultPrevented,false);assert.equal(click(f.read,0).defaultPrevented,false);f.event('pointerdown',f.read,9);assert.equal(click(f.read).defaultPrevented,false);f.context.dispose();assert.equal(next.count()+next.defaultView.count(),0);
});
