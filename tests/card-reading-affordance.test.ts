import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCardReadingAffordance} from '../src/card-reading-affordance';

// Production DOM/lifecycle logic with owner-window clocks and measured geometry
// supplied by the host boundary. Native focus and rendered pill placement need UI QA.
function fixture(options:{height?:number;full?:number;top?:number;busy?:string;content?:boolean;overflow?:string;reduced?:boolean}={}){
 let height=options.height??200,full=options.full??800,top=options.top??0,reduced=options.reduced??false,overflow=options.overflow??'auto';
 let hostSize=260,previewTop=0,previewSize=height;
 let frameId=0,requests=0,reads=0,writes=0;
 const frames=new Map<number,()=>void>(),scrolls:ScrollToOptions[]=[],observers:Observer[]=[];
 class Observer {
  targets=new Set<unknown>();options?:MutationObserverInit;disconnected=false;
  constructor(readonly notify:()=>void){observers.push(this);}
  observe(target:unknown,options?:MutationObserverInit){this.targets.add(target);this.options=options;}
  unobserve(target:unknown){this.targets.delete(target);}
  disconnect(){this.disconnected=true;this.targets.clear();}
 }
 class El extends EventTarget {
  children:El[]=[];parent?:El;connected=true;className='';textContent='';type='';disabled=false;title='';id='';
  attributes=new Map<string,string>();dataset:Record<string,string>={};style=new Proxy({padding:'0px',height:'200px',bottom:''},{set(target,key,value){writes++;return Reflect.set(target,key,value);}});
  registrations:{type:string;options?:boolean|AddEventListenerOptions}[]=[];listeners=new Map<string,Set<EventListenerOrEventListenerObject>>();
  private _hidden=false;
  get hidden(){return this._hidden;}set hidden(value:boolean){writes++;this._hidden=value;}
  get ownerDocument(){return doc;}
  get isConnected():boolean{return this.connected&&(!this.parent||this.parent.isConnected);}
  get clientHeight(){reads++;return height;}
  get offsetHeight(){reads++;return this===host?hostSize:previewSize;}
  get offsetTop(){reads++;return this===preview?previewTop:0;}
  get scrollHeight(){reads++;return full;}
  get scrollTop(){reads++;return top;}
  set scrollTop(value:number){top=value;}
  classList={contains:(name:string)=>this.className.split(/\s+/).includes(name)};
  setAttribute(name:string,value:string){writes++;this.attributes.set(name,value);}
  getAttribute(name:string){return this.attributes.get(name)??null;}
  append(...children:El[]){for(const child of children){child.parent=this;this.children.push(child);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;this.connected=false;}
  querySelector(selector:string){assert.equal(selector,':scope > .ts-card-preview-content');return this.children.find(child=>child.classList.contains('ts-card-preview-content'))??null;}
  scrollBy(value:ScrollToOptions){scrolls.push(value);top=Math.max(0,Math.min(full-height,top+(value.top??0)));}
  override addEventListener(type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions){
   super.addEventListener(type,listener,options);this.registrations.push({type,options});
   const listeners=this.listeners.get(type)||new Set();listeners.add(listener);this.listeners.set(type,listeners);
  }
  override removeEventListener(type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions){super.removeEventListener(type,listener,options);this.listeners.get(type)?.delete(listener);}
  listenerCount(){return [...this.listeners.values()].reduce((sum,values)=>sum+values.size,0);}
 }
 const view=Object.assign(new El(),{
  requestAnimationFrame:(run:()=>void)=>{requests++;frames.set(++frameId,run);return frameId;},
  cancelAnimationFrame:(id:number)=>{frames.delete(id);},
  getComputedStyle:()=>({overflowY:overflow}),
  matchMedia:(query:string)=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return{matches:reduced};},
  ResizeObserver:Observer,MutationObserver:Observer
 });
 const doc={defaultView:view,createElement:(tag:string)=>{assert.equal(tag,'button');return new El();}};
 const host=new El(),preview=new El(),content=new El(),meta=new El();
 content.className='ts-card-preview-content';preview.className='ts-card-preview';preview.id='preview-note';meta.className='ts-card-meta';
 preview.setAttribute('aria-busy',options.busy??'false');if(options.content!==false)preview.append(content);host.append(preview,meta);
 const originalChildren=[...preview.children],originalStyle={...preview.style};
 const dispose=mountCardReadingAffordance(preview as unknown as HTMLElement,host as unknown as HTMLElement);
 const button=host.children.find(child=>child.className==='ts-card-reading-affordance');assert.ok(button);
 return{host,preview,content,meta,button,view,observers,frames,scrolls,dispose,originalChildren,originalStyle,
  flush(){const pending=[...frames.values()];frames.clear();for(const run of pending)run();},
  resize(visible:number,all=full){height=visible;previewSize=visible;full=all;observers[0].notify();},
  layout(hostHeight:number,previewOffset:number,previewHeight:number){hostSize=hostHeight;previewTop=previewOffset;previewSize=previewHeight;observers[0].notify();},
  scroll(value:number){top=value;preview.dispatchEvent(new Event('scroll'));},
  load(all:number){full=all;preview.dispatchEvent(new Event('load'));},
  reduced(value:boolean){reduced=value;},overflow(value:string){overflow=value;},
  stats:()=>({requests,reads,writes,top})
 };
}

test('ready overflowing notes gain a sibling continue-reading button without changing content or geometry',()=>{
 const f=fixture();assert.equal(f.button.hidden,true);f.flush();
 assert.equal(f.button.hidden,false);assert.equal(f.button.disabled,false);assert.equal(f.button.type,'button');
 assert.equal(f.button.textContent,'↓ 继续阅读');assert.match(f.button.getAttribute('aria-label')!,/继续阅读.*0%/);
 assert.equal(f.button.getAttribute('aria-controls'),'preview-note');
 assert.deepEqual(f.preview.children,f.originalChildren);assert.deepEqual(f.preview.style,f.originalStyle);
 assert.deepEqual(f.host.children,[f.preview,f.meta,f.button]);assert.equal(f.scrolls.length,0);f.dispose();
});

test('fitting, hidden, unscrollable, pending and placeholder/error surfaces do not advertise reading',()=>{
 for(const options of [{full:200},{full:201},{height:0},{full:0},{full:NaN},{full:Infinity},{height:Infinity},{overflow:'hidden'},{overflow:'visible'},{busy:'true'},{content:false}]){
  const f=fixture(options);f.flush();assert.equal(f.button.hidden,true,JSON.stringify(options));assert.equal(f.button.disabled,true);
  f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.scrolls,[]);f.dispose();
 }
});

test('scroll progress updates and the prompt disappears at the bottom including fractional overshoot',()=>{
 const f=fixture();f.flush();f.scroll(300);f.flush();
 assert.equal(f.button.hidden,false);assert.match(f.button.getAttribute('aria-label')!,/50%/);
 for(const top of [599.5,600,650]){f.scroll(top);f.flush();assert.equal(f.button.hidden,true);assert.equal(f.button.disabled,true);}
 f.scroll(-20);f.flush();assert.equal(f.button.hidden,false);assert.match(f.button.getAttribute('aria-label')!,/0%/);f.dispose();
});

test('click scrolls three quarters of the preview height and clamps the final page',()=>{
 const f=fixture();f.flush();f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.scrolls.at(-1),{top:150,behavior:'smooth'});f.flush();
 f.scroll(560);f.flush();f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.scrolls.at(-1),{top:40,behavior:'smooth'});f.flush();
 assert.equal(f.button.hidden,true);const count=f.scrolls.length;f.button.dispatchEvent(new Event('click'));assert.equal(f.scrolls.length,count);f.dispose();
});

test('reduced-motion changes are respected on each click',()=>{
 const f=fixture({reduced:true});f.flush();f.button.dispatchEvent(new Event('click'));assert.equal(f.scrolls.at(-1)?.behavior,'auto');
 f.reduced(false);f.button.dispatchEvent(new Event('click'));assert.equal(f.scrolls.at(-1)?.behavior,'smooth');f.dispose();
});

test('late image loads and content resizing update overflow without a new preview mount',()=>{
 const f=fixture({full:180});f.flush();assert.equal(f.button.hidden,true);
 f.load(900);f.flush();assert.equal(f.button.hidden,false);
 assert.ok(f.observers[0].targets.has(f.preview));assert.ok(f.observers[0].targets.has(f.content));
 f.resize(950);f.flush();assert.equal(f.button.hidden,true);
 const load=f.preview.registrations.find(registration=>registration.type==='load');assert.ok(load);
 assert.ok(load.options===true||typeof load.options==='object'&&load.options.capture);
 f.dispose();
});

test('the pill follows the preview bottom above changing footer height without repeated style writes',()=>{
 const f=fixture();f.flush();assert.equal(f.button.style.bottom,'68px');
 assert.ok(f.observers[0].targets.has(f.host),'host resize must also refresh placement');
 f.layout(260,0,150);f.flush();assert.equal(f.button.style.bottom,'118px','a taller footer raises the pill above metadata');
 f.layout(330,20,200);f.flush();assert.equal(f.button.style.bottom,'118px');
 f.layout(330,40,200);f.flush();assert.equal(f.button.style.bottom,'98px','preview offset participates in the placement');
 const writes=f.stats().writes;
 for(let i=0;i<30;i++)f.observers[0].notify();f.flush();
 assert.equal(f.stats().writes,writes,'unchanged geometry cannot sustain an observer/style loop');
 assert.deepEqual(f.preview.style,f.originalStyle);assert.deepEqual(f.preview.children,f.originalChildren);f.dispose();
});

test('ready changes and replacement error placeholders hide the prompt without stale dimensions',()=>{
 const f=fixture({busy:'true'});f.flush();assert.equal(f.button.hidden,true);
 f.preview.setAttribute('aria-busy','false');f.observers[1].notify();f.flush();assert.equal(f.button.hidden,false);
 f.content.remove();f.observers[1].notify();f.flush();assert.equal(f.button.hidden,true);assert.equal(f.observers[0].targets.has(f.content),false);
 f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.scrolls,[]);f.dispose();
});

test('scroll, resize, image and mutation bursts share one owner-window animation frame',()=>{
 const f=fixture();f.flush();const before=f.stats();
 for(let i=0;i<50;i++){f.scroll(120);f.load(900);f.observers[0].notify();f.observers[1].notify();f.view.dispatchEvent(new Event('resize'));}
 assert.equal(f.frames.size,1);assert.equal(f.stats().requests-before.requests,1);assert.equal(f.stats().reads,before.reads);
 f.flush();assert.ok(f.stats().reads>before.reads);
 const scroll=f.preview.registrations.find(registration=>registration.type==='scroll');assert.equal(typeof scroll?.options==='object'&&scroll.options.passive,true);
 assert.equal(f.observers[1].options?.subtree,true);f.dispose();
});

test('button gestures stop canvas handling without cancelling focus or keyboard defaults',()=>{
 const f=fixture();f.flush();
 for(const type of ['pointerdown','dblclick']){
  let stopped=false;f.button.addEventListener(type,event=>{stopped=event.cancelBubble;});
  const event=new Event(type,{bubbles:true,cancelable:true});f.button.dispatchEvent(event);
  assert.equal(stopped,true);assert.equal(event.defaultPrevented,false);
 }
 const key=new Event('keydown',{bubbles:true,cancelable:true});f.button.dispatchEvent(key);assert.equal(key.defaultPrevented,false);assert.equal(key.cancelBubble,false);
 assert.equal(f.button.getAttribute('tabindex'),null,'native button stays in the tab order');assert.deepEqual(f.scrolls,[]);f.dispose();
});

test('detached previews do not measure, update or scroll even when queued callbacks arrive',()=>{
 const f=fixture();f.flush();f.scroll(80);f.host.connected=false;const before=f.stats();
 f.flush();f.observers[0].notify();f.observers[1].notify();f.preview.dispatchEvent(new Event('load'));f.button.dispatchEvent(new Event('click'));f.flush();
 assert.equal(f.stats().reads,before.reads);assert.equal(f.stats().writes,before.writes);assert.deepEqual(f.scrolls,[]);f.dispose();
});

test('dispose cancels frames, observers and listeners and removes only its pill',()=>{
 const f=fixture();f.flush();f.scroll(80);const stale=[...f.frames.values()][0];f.dispose();f.dispose();const before=f.stats();
 assert.equal(f.frames.size,0);assert.ok(f.observers.every(observer=>observer.disconnected));assert.equal(f.button.isConnected,false);
 assert.deepEqual(f.host.children,[f.preview,f.meta]);assert.deepEqual(f.preview.children,f.originalChildren);
 assert.equal(f.preview.listenerCount()+f.view.listenerCount()+f.button.listenerCount(),0);
 stale();for(const observer of f.observers)observer.notify();f.preview.dispatchEvent(new Event('scroll'));f.button.dispatchEvent(new Event('click'));f.flush();
 assert.deepEqual(f.stats(),before);assert.deepEqual(f.scrolls,[]);
});
