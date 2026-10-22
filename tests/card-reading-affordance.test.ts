import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountCardReadingAffordance} from '../src/card-reading-affordance';

// Production DOM/lifecycle logic with owner-window clocks and measured geometry
// supplied by the host boundary. Native focus and rendered pill placement need UI QA.
function fixture(options:{height?:number;full?:number;top?:number;busy?:string;content?:boolean;overflow?:string;reduced?:boolean;touch?:boolean;scale?:number;portScale?:number;width?:number}={}){
 let height=options.height??200,full=options.full??800,top=options.top??0,reduced=options.reduced??false,overflow=options.overflow??'auto';
 let hostSize=260,previewTop=0,previewSize=height,scale=options.scale??1,portScale=options.portScale??1,width=options.width??280;
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
  get clientHeight(){reads++;const reserved=host.children.find(child=>child.className==='ts-card-reading-footer'&&!child.hidden);return this===preview?height-(reserved?Number.parseFloat(reserved.style.height)||0:0):hostSize;}
  get clientWidth(){return width;}
  get offsetHeight(){reads++;return this===host?hostSize:this.className==='ts-card-reading-footer'?(this.hidden?0:Number.parseFloat(this.style.height)||0):previewSize;}
  get offsetTop(){reads++;return this===preview?previewTop:0;}
  get scrollHeight(){reads++;return full;}
  get scrollTop(){reads++;return top;}
  set scrollTop(value:number){top=value;}
  classList={contains:(name:string)=>this.className.split(/\s+/).includes(name)};
  setAttribute(name:string,value:string){writes++;this.attributes.set(name,value);}
  getAttribute(name:string){return this.attributes.get(name)??null;}
  append(...children:El[]){for(const child of children){child.parent=this;this.children.push(child);}}
  after(child:El){assert.ok(this.parent);const index=this.parent.children.indexOf(this);child.parent=this.parent;this.parent.children.splice(index+1,0,child);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;this.connected=false;}
  querySelector(selector:string){assert.equal(selector,':scope > .ts-card-preview-content');return this.children.find(child=>child.classList.contains('ts-card-preview-content'))??null;}
  scrollBy(value:ScrollToOptions){scrolls.push(value);top=Math.max(0,Math.min(full-this.clientHeight,top+(value.top??0)));}
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
  getComputedStyle:()=>({overflowY:overflow,getPropertyValue:(name:string)=>{assert.ok(['--ts-control-scale','--ts-port-scale'].includes(name));return String(name==='--ts-control-scale'?scale:portScale);}}),
  matchMedia:(query:string)=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return{matches:reduced};},
  ResizeObserver:Observer,MutationObserver:Observer
 });
 const doc={defaultView:view,createElement:(tag:string)=>{assert.ok(['button','div'].includes(tag));return new El();}};
 const host=new El(),preview=new El(),content=new El(),meta=new El();
 content.className='ts-card-preview-content';preview.className='ts-card-preview';preview.id='preview-note';meta.className='ts-card-meta';
 host.className='ts-card is-fixed-reading';host.dataset.touchControls=String(options.touch??false);
 preview.setAttribute('aria-busy',options.busy??'false');if(options.content!==false)preview.append(content);host.append(preview,meta);
 const originalChildren=[...preview.children],originalStyle={...preview.style};
 const dispose=mountCardReadingAffordance(preview as unknown as HTMLElement,host as unknown as HTMLElement);
 const footer=host.children.find(child=>child.className==='ts-card-reading-footer');assert.ok(footer);const button=footer.children[0];assert.ok(button);
 return{host,preview,content,meta,footer,button,view,observers,frames,scrolls,dispose,originalChildren,originalStyle,
  flush(){const pending=[...frames.values()];frames.clear();for(const run of pending)run();},
  zoom(value:number){scale=value;observers[1].notify();},
  controls(touch:boolean,nextScale:number,nextPortScale:number){host.dataset.touchControls=String(touch);scale=nextScale;portScale=nextPortScale;observers[1].notify();},
  resize(visible:number,all=full){height=visible;previewSize=visible;full=all;observers[0].notify();},
  layout(hostHeight:number,previewOffset:number,previewHeight:number){hostSize=hostHeight;previewTop=previewOffset;previewSize=previewHeight;observers[0].notify();},
  scroll(value:number){top=value;preview.dispatchEvent(new Event('scroll'));},
  load(all:number){full=all;preview.dispatchEvent(new Event('load'));},
  reduced(value:boolean){reduced=value;},overflow(value:string){overflow=value;},
  stats:()=>({requests,reads,writes,top})
 };
}

test('ready overflowing notes gain a sibling continue-reading button in a reserved footer without changing original content or model geometry',()=>{
 const f=fixture();assert.equal(f.button.hidden,true);f.flush();
 assert.equal(f.button.hidden,false);assert.equal(f.button.disabled,false);assert.equal(f.button.type,'button');
 assert.equal(f.button.textContent,'↓ 继续阅读');assert.match(f.button.getAttribute('aria-label')!,/继续阅读.*0%/);
 assert.equal(f.button.getAttribute('aria-controls'),'preview-note');
 assert.deepEqual(f.preview.children,f.originalChildren);assert.deepEqual(f.preview.style,f.originalStyle);
 assert.deepEqual(f.host.children,[f.preview,f.footer,f.meta]);assert.equal(f.scrolls.length,0);f.dispose();
});

test('fitting, hidden, unscrollable, pending and placeholder/error surfaces do not advertise reading',()=>{
 for(const options of [{full:200},{full:201},{height:0},{full:0},{full:NaN},{full:Infinity},{height:Infinity},{overflow:'hidden'},{overflow:'visible'},{busy:'true'},{content:false}]){
  const f=fixture(options);f.flush();assert.equal(f.button.hidden,true,JSON.stringify(options));assert.equal(f.button.disabled,true);
  f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.scrolls,[]);f.dispose();
 }
});

test('scroll progress updates and the footer stays at the bottom including fractional overshoot without a scrollport jump',()=>{
 const f=fixture();f.flush();f.scroll(325);f.flush();
 assert.equal(f.button.hidden,false);assert.match(f.button.getAttribute('aria-label')!,/50%/);
 for(const top of [649.5,650,700]){f.scroll(top);f.flush();assert.equal(f.button.hidden,false);assert.equal(f.button.disabled,true);assert.equal(f.footer.hidden,false);assert.equal(f.preview.clientHeight,150);}
 f.scroll(-20);f.flush();assert.equal(f.button.hidden,false);assert.match(f.button.getAttribute('aria-label')!,/0%/);f.dispose();
});

test('click scrolls three quarters of the preview height and clamps the final page',()=>{
 const f=fixture();f.flush();f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.scrolls.at(-1),{top:112.5,behavior:'smooth'});f.flush();
 f.scroll(610);f.flush();f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.scrolls.at(-1),{top:40,behavior:'smooth'});f.flush();
 assert.equal(f.button.hidden,false);assert.equal(f.button.disabled,true);const count=f.scrolls.length;f.button.dispatchEvent(new Event('click'));assert.equal(f.scrolls.length,count);f.dispose();
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

test('the independent footer reserves space, stays before metadata and does not sustain observer writes',()=>{
 const f=fixture();f.flush();assert.equal(f.footer.style.height,'50px');assert.equal(f.preview.clientHeight,150);
 assert.equal(f.button.style.bottom,'');assert.deepEqual(f.host.children,[f.preview,f.footer,f.meta]);
 const writes=f.stats().writes;for(let i=0;i<30;i++)f.observers[0].notify();f.flush();
 assert.equal(f.stats().writes,writes);assert.deepEqual(f.preview.style,f.originalStyle);assert.deepEqual(f.preview.children,f.originalChildren);f.dispose();
});

test('an existing footer cannot cause its own overflow when content shrinks to the unreserved height',()=>{
 const f=fixture();f.flush();f.load(190);f.flush();assert.equal(f.footer.hidden,true);assert.equal(f.preview.clientHeight,200);
 f.observers[0].notify();f.flush();assert.equal(f.footer.hidden,true);f.dispose();
});

test('touch footer reserves the real inverse-scaled 44px button and separate body space',()=>{
 for(const scale of [.5,1,2]){const f=fixture({touch:true,scale,height:600,width:600});f.flush();
  assert.equal(f.footer.style.height,`${Math.ceil(52*scale+Math.max(8*scale,16))}px`);assert.ok(f.preview.clientHeight>=44*scale);
  assert.equal(f.footer.hidden,false);f.dispose();}
});

test('tiny zoom or card capacity suppresses the supplemental footer instead of overlapping the body',()=>{
 for(const options of [{touch:true,scale:4},{touch:true,height:100},{touch:true,width:100}]){
  const f=fixture(options);f.flush();assert.equal(f.footer.hidden,true);assert.equal(f.button.disabled,true);assert.equal(f.preview.clientHeight,options.height??200);f.dispose();
 }
 const f=fixture({touch:true});f.flush();assert.equal(f.footer.hidden,false);f.zoom(4);f.flush();assert.equal(f.footer.hidden,true);
 f.zoom(1);f.flush();assert.equal(f.footer.hidden,false);f.dispose();
});

test('inline editing removes the reservation and keeps original preview content untouched',()=>{
 const f=fixture();f.flush();f.host.className='ts-card is-fixed-reading is-inline-editing';f.observers[1].notify();f.flush();
 assert.equal(f.footer.hidden,true);assert.equal(f.preview.clientHeight,200);assert.deepEqual(f.preview.children,f.originalChildren);
 f.host.className='ts-card is-fixed-reading';f.observers[1].notify();f.flush();assert.equal(f.footer.hidden,false);f.dispose();
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

test('automatic card sizing never gains footer geometry',()=>{const f=fixture();f.host.className='ts-card';f.flush();assert.equal(f.footer.hidden,true);assert.equal(f.preview.clientHeight,200);f.dispose();});

// The native ZG failure occurred at zoom .5: a transparent 30px bottom port
// intercepted the reading button's lower-left point. Keep both full targets.
test('footer CSS uses the same port clearance for right placement and bounded width',()=>{
 const css=readFileSync(new URL('../src/card-surfaces.css',import.meta.url),'utf8');
 assert.ok(css.includes('--ts-reading-edge-inset:max(calc(8px * var(--ts-reading-scale)),calc(16px * var(--ts-port-scale,1)))'));
 assert.ok(css.includes('right:var(--ts-reading-edge-inset)'));
 assert.ok(css.includes('max-width:calc((100% - var(--ts-reading-edge-inset) - var(--ts-reading-edge-inset)) / var(--ts-reading-scale))'));
});
test('touch and fine-pointer footer reservations clear bottom and right ports at zoom .25/.5/1/2/3',()=>{
 for(const touch of [false,true])for(const zoom of [.25,.5,1,2,3]){
  const scale=touch?1/zoom:1,portScale=1/Math.min(1,zoom),f=fixture({touch,scale,portScale,height:1200,width:1200,full:3000});f.flush();assert.equal(f.footer.hidden,false);
  const row=Number.parseFloat(f.footer.style.height),button=(touch?44:26)*scale,top=8*scale,gutter=Math.max(8*scale,16*portScale),radius=15*portScale;
  assert.ok(row-top-button>=radius+portScale,'full bottom port remains separate from reading hit area');
  assert.ok(gutter>=radius+portScale,'full right port remains separate from reading hit area');
  assert.ok(gutter>=12*Math.max(.4,Math.min(2,1/zoom)),'right/bottom gutter also clears the resize handle');
  if(touch)assert.equal(button*zoom,44);
  assert.equal(f.preview.clientHeight,1200-row);assert.ok(f.preview.clientHeight>=(touch?44:28)*scale);
  assert.deepEqual(f.preview.children,f.originalChildren);assert.deepEqual(f.preview.style,f.originalStyle);f.dispose();
 }
});
test('extra port clearance hides only the supplemental footer when useful body or width cannot fit',()=>{
 for(const touch of [false,true])for(const zoom of [.25,.5,1,2,3]){
  const scale=touch?1/zoom:1,portScale=1/Math.min(1,zoom),gutter=Math.max(8*scale,16*portScale);
  const row=Math.ceil((touch?52:34)*scale+gutter),body=(touch?44:28)*scale,width=(touch?96:72)*scale+2*gutter;
  for(const options of [{height:row+body-1,width:1200},{height:1200,width:width-1}]){const f=fixture({touch,scale,portScale,full:3000,...options});f.flush();assert.equal(f.footer.hidden,true);assert.equal(f.preview.clientHeight,options.height);assert.deepEqual(f.preview.children,f.originalChildren);f.dispose();}
  const fit=fixture({touch,scale,portScale,full:3000,height:row+body,width});fit.flush();assert.equal(fit.footer.hidden,false);assert.ok(Math.abs(fit.preview.clientHeight-body)<1e-9);fit.dispose();
 }
});

test('the existing host observer refreshes one mounted footer through touch zoom and fine-pointer restoration',()=>{
 const f=fixture({touch:true,height:1200,width:1200,full:3000});f.flush();
 const originalFooter=f.footer,originalButton=f.button;
 for(const touch of [true,false,true])for(const zoom of [1,.5,.25,1,2,3]){
  const scale=touch?1/zoom:1,portScale=1/Math.min(1,zoom),before=f.stats();
  for(let i=0;i<10;i++)f.controls(touch,scale,portScale);
  assert.equal(f.frames.size,1);assert.equal(f.stats().requests-before.requests,1);
  f.flush();const row=Math.ceil((touch?52:34)*scale+Math.max(8*scale,16*portScale));
  assert.equal(f.footer.style.height,`${row}px`);assert.equal(f.footer.hidden,false);
  assert.equal(f.preview.clientHeight,1200-row);assert.equal(f.footer,originalFooter);assert.equal(f.button,originalButton);
  assert.deepEqual(f.preview.children,f.originalChildren);assert.deepEqual(f.preview.style,f.originalStyle);
 }
 f.dispose();
});
