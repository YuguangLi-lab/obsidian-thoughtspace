import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiquidGlassRuntime,isGlassLensEngineCandidate,liquidGlassSurfaceSelector} from '../src/liquid-glass-runtime';
import {InterfaceStyleDocuments} from '../src/ui-tokens';

class Events {
 listeners=new Map<string,Set<(event:any)=>void>>();options=new Map<string,unknown>();
 addEventListener(name:string,listener:(event:any)=>void,options?:unknown){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name)!.add(listener);this.options.set(name,options);}
 removeEventListener(name:string,listener:(event:any)=>void){this.listeners.get(name)?.delete(listener);}
 emit(name:string,values:Record<string,unknown>={}){for(const listener of [...this.listeners.get(name)??[]])listener({type:name,...values});}
 get listenerCount(){return [...this.listeners.values()].reduce((sum,set)=>sum+set.size,0);}
}
class Style {
 values=new Map<string,{value:string;priority:string}>();position='';pointerEvents='';
 setProperty(name:string,value:string,priority=''){this.values.set(name,{value,priority});}
 getPropertyValue(name:string){return this.values.get(name)?.value??'';}getPropertyPriority(name:string){return this.values.get(name)?.priority??'';}
 removeProperty(name:string){this.values.delete(name);return'';}
}
class Element {
 children:Element[]=[];parentElement?:Element;attributes=new Map<string,string>();style=new Style();dataset:Record<string,string>={};classes=new Set<string>();id='';textContent='';connected=true;surface=false;pane=false;excluded=false;width=240;height=64;left=20;top=30;radius='16px';display='block';visibility='visible';overflowX=0;overflowY=0;
 classList={add:(...names:string[])=>{names.forEach(name=>this.classes.add(name));}};
 constructor(readonly tagName:string,public ownerDocument:DocumentFixture){}
 get isConnected():boolean{return this.connected&&(!this.parentElement||this.parentElement.isConnected);}
 get clientWidth(){return this.width;}get clientHeight(){return this.height;}get scrollWidth(){return this.width+this.overflowX;}get scrollHeight(){return this.height+this.overflowY;}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}getAttribute(name:string){return this.attributes.get(name)??null;}removeAttribute(name:string){this.attributes.delete(name);}
 appendChild(child:Element){child.parentElement?.children.splice(child.parentElement.children.indexOf(child),1);child.parentElement=this;child.adopt(this.ownerDocument);child.connected=true;this.children.push(child);return child;}
 append(...children:Element[]){children.forEach(child=>this.appendChild(child));}
 adopt(doc:DocumentFixture){this.ownerDocument=doc;this.children.forEach(child=>child.adopt(doc));}
 remove(){this.connected=false;if(this.parentElement){this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=undefined;}}
 contains(child:Element):boolean{return child===this||this.children.some(element=>element.contains(child));}
 matches(selector:string){return selector===liquidGlassSurfaceSelector&&this.surface;}
 closest(selector:string):Element|null{
  if(selector===liquidGlassSurfaceSelector){if(this.surface)return this;}
  else if(selector==='[hidden]'){if(this.attributes.has('hidden'))return this;}
  else if(selector.includes('.ts-calendar-plugin')){if(this.excluded)return this;}
  else if(this.pane)return this;
  return this.parentElement?.closest(selector)??null;
 }
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 getClientRects(){return this.isConnected&&!this.closest('[hidden]')&&this.display!=='none'?[this.getBoundingClientRect()]:[];}
 getBoundingClientRect(){return{width:this.width,height:this.height,left:this.left,top:this.top};}
}
class DocumentFixture extends Events {
 visibilityState='visible';activeElement?:Element;body=new Element('body',this);documentElement=this.body;head=new Element('head',this);defaultView:ReturnType<typeof windowFixture>;panes:Element[]=[];mapWrites:{width:number;height:number;data:Uint8ClampedArray}[]=[];canvasFailure=false;queries:string[]=[];observers:FakeObserver[]=[];frames=new Map<number,()=>void>();nextFrame=0;
 constructor(){super();this.defaultView=windowFixture(this);}
 createElement(tag:string){return new Element(tag,this);}
 createElementNS(_namespace:string,tag:string){
  const element=new Element(tag,this);if(tag!=='canvas')return element;
  const canvas=Object.assign(element,{width:0,height:0,getContext:()=>this.canvasFailure?null:{createImageData:(width:number,height:number)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:(pixels:{width:number;height:number;data:Uint8ClampedArray})=>this.mapWrites.push({...pixels,data:pixels.data.slice()}),drawImage:()=>assert.fail('Never read source imagery'),getImageData:()=>assert.fail('Never read page pixels')},toDataURL:()=> 'data:image/png;base64,synthetic-normal-map'});return canvas;
 }
 querySelector(_selector:string){return this.panes.find(pane=>pane.isConnected)??null;}
 querySelectorAll(selector:string){this.queries.push(selector);return this.body.querySelectorAll(selector);}
 get document(){return this as unknown as Document;}
 pane(width=900){const pane=new Element('div',this);pane.pane=true;pane.width=width;this.body.appendChild(pane);this.panes.push(pane);return pane;}
 surface(pane=this.panes[0]??this.pane(),width=240,height=64){const element=new Element('div',this);element.surface=true;element.width=width;element.height=height;pane.appendChild(element);return element;}
 flush(){const callbacks=[...this.frames.values()];this.frames.clear();callbacks.forEach(callback=>callback());}
 resize(){for(const observer of this.observers)observer.callback();this.flush();}
 get filters(){return this.body.children.filter(child=>child.tagName==='svg').flatMap(svg=>svg.children.flatMap(defs=>defs.children));}
 pointer(name:string,element:Element,values:Record<string,unknown>={}){this.emit(name,{target:element,pointerType:'mouse',isPrimary:true,button:0,clientX:element.left+30,clientY:element.top+20,preventDefault:()=>assert.fail('Never cancel a control event'),stopPropagation:()=>assert.fail('Never stop a control event'),...values});}
}
class FakeObserver {
 observed=new Set<Element>();disconnected=false;
 constructor(readonly callback:()=>void){}observe(element:Element){this.observed.add(element);}unobserve(element:Element){this.observed.delete(element);}disconnect(){this.disconnected=true;this.observed.clear();}
}
function windowFixture(doc:DocumentFixture){
 const events=new Events(),queries=new Map<string,Events&{matches:boolean}>();
 return Object.assign(events,{closed:false,innerWidth:1200,navigator:{userAgent:'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',hardwareConcurrency:8,deviceMemory:8},CSS:{supports:():boolean=>true},
  ResizeObserver:class extends FakeObserver {constructor(callback:()=>void){super(callback);doc.observers.push(this);}},
  requestAnimationFrame:(callback:()=>void)=>{doc.frames.set(++doc.nextFrame,callback);return doc.nextFrame;},cancelAnimationFrame:(id:number)=>doc.frames.delete(id),
  getComputedStyle:(element:Element)=>({display:element.display,visibility:element.visibility,borderTopLeftRadius:element.radius}),
  matchMedia:(query:string)=>{if(!queries.has(query))queries.set(query,Object.assign(new Events(),{matches:query==='(pointer:fine) and (hover:hover)'}));return queries.get(query)!;},queries});
}

test('engine eligibility accepts the Chromium host floor and future upgrades without claiming rendered support',()=>{
 for(const agent of ['Electron/34.2 Chrome/132.0.6834.210','Chrome/155.0.0.0','HeadlessChrome/155.0.0.0','Chromium/156.0.0.0','Chrome/200.0.0.0'])assert.equal(isGlassLensEngineCandidate(agent),true);
 for(const agent of ['Firefox/155.0','Version/26.0 Safari/605.1','Chrome/110.0.0.0','Chrome/131.0.0.0','Android Chrome/155.0.0.0','Mobile Chrome/155.0.0.0',''])assert.equal(isGlassLensEngineCandidate(agent),false);
});

test('a bounded initial refresh creates procedural maps, explicit-pixel SVG images and isolated shields',()=>{
 const doc=new DocumentFixture(),elements=Array.from({length:5},()=>doc.surface()),runtime=createLiquidGlassRuntime(doc.document);
 assert.equal(doc.filters.length,3);assert.equal(doc.mapWrites.length,3);assert.deepEqual(doc.queries,[liquidGlassSurfaceSelector]);
 for(const [index,element]of elements.entries()){
  assert.equal(element.getAttribute('data-ts-glass-optics'),index<3?'true':null);
  assert.equal(element.children.filter(child=>child.classes.has('ts-glass-content-shield')).length,index<3?1:0);
 }
 for(const filter of doc.filters){const image=filter.children.find(child=>child.tagName==='feImage')!;assert.equal(image.getAttribute('width'),'240');assert.equal(image.getAttribute('height'),'64');assert.match(image.getAttribute('href')!,/^data:image\/png/);}
 assert.ok(doc.mapWrites.every(map=>map.width<=128&&map.height<=128));assert.equal(doc.frames.size,0,'No idle animation loop');
 runtime.dispose();assert.equal(doc.filters.length,0);assert.equal(doc.listenerCount,0);assert.equal(doc.defaultView.listenerCount,0);assert.ok(doc.observers.every(observer=>observer.disconnected));
});

test('pointer updates coalesce without regenerating maps or changing control event handling',()=>{
 const doc=new DocumentFixture(),element=doc.surface(),runtime=createLiquidGlassRuntime(doc.document),control=new Element('button',doc);element.appendChild(control);
 doc.pointer('pointerover',element);for(let index=0;index<30;index++)doc.pointer('pointermove',control,{clientX:element.left+index,clientY:element.top+19});
 assert.equal(doc.frames.size,1);doc.flush();assert.equal(element.style.getPropertyValue('--ts-glass-x'),'29px');assert.equal(element.style.getPropertyValue('--ts-glass-y'),'19px');assert.equal(doc.mapWrites.length,1);assert.equal(doc.frames.size,0);
 doc.pointer('pointerdown',control);assert.equal(element.getAttribute('data-ts-glass-pressed'),'true');doc.pointer('pointerup',control);assert.equal(element.getAttribute('data-ts-glass-pressed'),'false');
 doc.pointer('pointerout',control,{relatedTarget:null});assert.equal(element.getAttribute('data-ts-glass-active'),'false');assert.equal(element.style.getPropertyValue('--ts-glass-x'),'120px');
 for(const event of ['pointerover','pointermove','pointerout','pointerdown','pointerup','pointercancel'])assert.deepEqual(doc.options.get(event),{passive:true});runtime.dispose();
});

test('keyboard focus lazily registers new owned menus and document adoption retires old filters',()=>{
 const first=new DocumentFixture(),second=new DocumentFixture(),a=createLiquidGlassRuntime(first.document),b=createLiquidGlassRuntime(second.document);
 const menu=first.surface();menu.classes.add('ts-ui-menu');first.activeElement=menu;first.emit('focusin',{target:menu});assert.equal(first.filters.length,1);const old=menu.style.getPropertyValue('--ts-glass-filter');
 second.pane().appendChild(menu);second.activeElement=menu;second.emit('focusin',{target:menu});assert.equal(first.filters.length,0);assert.equal(second.filters.length,1);assert.notEqual(menu.style.getPropertyValue('--ts-glass-filter'),old);assert.equal(menu.getAttribute('data-ts-glass-active'),'true');
 a.dispose();assert.equal(menu.getAttribute('data-ts-glass-optics'),'true');b.dispose();assert.equal(menu.getAttribute('data-ts-glass-optics'),null);
});

test('resize only regenerates changed geometry and hidden, removed or narrow panes release resources',()=>{
 const doc=new DocumentFixture(),pane=doc.pane(),element=doc.surface(pane),runtime=createLiquidGlassRuntime(doc.document);
 doc.resize();assert.equal(doc.mapWrites.length,1);element.width=300;doc.resize();assert.equal(doc.mapWrites.length,2);assert.equal(doc.filters[0].children[0].getAttribute('width'),'300');
 pane.width=680;doc.resize();assert.equal(doc.filters.length,0);assert.equal(element.getAttribute('data-ts-glass-optics'),null);assert.equal(doc.observers[0].observed.size,0);
 pane.width=900;runtime.refresh();assert.equal(doc.filters.length,1);element.setAttribute('hidden','');doc.resize();assert.equal(doc.filters.length,0);
 element.removeAttribute('hidden');runtime.refresh();element.remove();doc.resize();assert.equal(doc.filters.length,0);assert.equal(doc.frames.size,0);runtime.dispose();
});

test('root scrolling falls back to opaque material before its content shield can scroll away',()=>{
 for(const axis of ['overflowX','overflowY'] as const){
  const doc=new DocumentFixture(),element=doc.surface();element[axis]=2;const runtime=createLiquidGlassRuntime(doc.document);
  assert.equal(doc.filters.length,0);assert.equal(doc.mapWrites.length,0);assert.equal(element.getAttribute('data-ts-glass-optics'),null);
  element[axis]=1;runtime.refresh();assert.equal(doc.filters.length,1,'One pixel rounding tolerance is allowed');
  element[axis]=12;doc.resize();assert.equal(doc.filters.length,0);assert.equal(element.children.length,0);assert.equal(element.getAttribute('data-ts-glass-optics'),null);
  element[axis]=0;runtime.refresh();assert.equal(doc.filters.length,1);
  element[axis]=20;doc.emit('scroll',{target:element});doc.flush();assert.equal(doc.filters.length,0);assert.equal(element.style.getPropertyValue('--ts-glass-filter'),'');
  element[axis]=0;runtime.refresh();assert.equal(doc.filters.length,1);runtime.dispose();
 }
});

test('capacity and area budgets bound registration and exclude calendar/native descendants',()=>{
 const doc=new DocumentFixture(),big=doc.surface(undefined,600,300),second=doc.surface(undefined,600,300),excluded=doc.surface();excluded.excluded=true;
 const runtime=createLiquidGlassRuntime(doc.document);assert.equal(doc.filters.length,1);assert.equal(big.getAttribute('data-ts-glass-optics'),'true');assert.equal(second.getAttribute('data-ts-glass-optics'),null);assert.equal(excluded.getAttribute('data-ts-glass-optics'),null);
 doc.pointer('pointerover',second);assert.equal(doc.filters.length,1);assert.equal(big.getAttribute('data-ts-glass-optics'),null);assert.equal(second.getAttribute('data-ts-glass-optics'),'true');runtime.dispose();
});

test('runtime reductions, visibility and viewport changes disable filters and cancel pending frames',()=>{
 const doc=new DocumentFixture(),element=doc.surface(),runtime=createLiquidGlassRuntime(doc.document);
 for(const query of ['(any-pointer:coarse)','(prefers-reduced-motion:reduce)','(prefers-reduced-transparency:reduce)','(prefers-contrast:more)','(forced-colors:active)']){
  const media=doc.defaultView.matchMedia(query);doc.pointer('pointermove',element);assert.equal(doc.frames.size,1);media.matches=true;media.emit('change');assert.equal(doc.filters.length,0);assert.equal(doc.frames.size,0);media.matches=false;media.emit('change');assert.equal(doc.filters.length,1);
 }
 doc.visibilityState='hidden';doc.emit('visibilitychange');assert.equal(doc.filters.length,0);doc.visibilityState='visible';doc.emit('visibilitychange');assert.equal(doc.filters.length,1);
 doc.defaultView.innerWidth=760;doc.defaultView.emit('resize');doc.flush();assert.equal(doc.filters.length,0);runtime.dispose();assert.ok([...doc.defaultView.queries.values()].every(query=>query.listenerCount===0));
});

test('unsupported or low-capability devices remain static without canvas or event registration',()=>{
 for(const configure of [(doc:DocumentFixture)=>{doc.defaultView.navigator.userAgent='Firefox/155.0';},(doc:DocumentFixture)=>{doc.defaultView.navigator.hardwareConcurrency=4;},(doc:DocumentFixture)=>{doc.defaultView.navigator.deviceMemory=2;},(doc:DocumentFixture)=>{doc.defaultView.CSS.supports=()=>false;}]){
  const doc=new DocumentFixture();doc.surface();configure(doc);const runtime=createLiquidGlassRuntime(doc.document);runtime.refresh();assert.equal(doc.mapWrites.length,0);assert.equal(doc.filters.length,0);assert.equal(doc.listenerCount,0);runtime.dispose();
 }
});

test('canvas failure is a static fallback and dispose restores exact preexisting owned values',()=>{
 const broken=new DocumentFixture();broken.surface();broken.canvasFailure=true;const unavailable=createLiquidGlassRuntime(broken.document);unavailable.refresh();assert.equal(broken.filters.length,0);unavailable.dispose();
 const doc=new DocumentFixture(),element=doc.surface();element.setAttribute('data-ts-glass-active','prior');element.style.setProperty('--ts-glass-x','17px','important');const original=new Element('span',doc);element.appendChild(original);
 const runtime=createLiquidGlassRuntime(doc.document);doc.pointer('pointerdown',element);doc.pointer('pointermove',element);runtime.dispose();runtime.dispose();runtime.refresh();doc.flush();
 assert.equal(element.getAttribute('data-ts-glass-active'),'prior');assert.equal(element.getAttribute('data-ts-glass-optics'),null);assert.equal(element.style.getPropertyValue('--ts-glass-x'),'17px');assert.equal(element.style.getPropertyPriority('--ts-glass-x'),'important');assert.deepEqual(element.children,[original]);assert.equal(doc.frames.size,0);assert.equal(doc.listenerCount,0);
});

test('interface document lifecycle enables optics only for saved glass with effects and releases it on style changes',()=>{
 const doc=new DocumentFixture();doc.surface();const styles=new InterfaceStyleDocuments({interfaceStyle:'paper',glassEffects:true});styles.register(doc.document);assert.equal(doc.listenerCount,0);
 styles.update({interfaceStyle:'glass',glassEffects:false});assert.equal(doc.listenerCount,0);styles.update({interfaceStyle:'glass',glassEffects:true});assert.equal(doc.filters.length,1);
 styles.update({interfaceStyle:'editorial',glassEffects:true});assert.equal(doc.filters.length,0);assert.equal(doc.listenerCount,0);styles.update({interfaceStyle:'glass',glassEffects:true});assert.equal(doc.filters.length,1);
 styles.release(doc.document);assert.equal(doc.filters.length,0);assert.equal(doc.listenerCount,0);styles.dispose();
});
