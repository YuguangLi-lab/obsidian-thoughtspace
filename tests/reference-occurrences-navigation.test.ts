import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {ReferenceOccurrenceTrail,referenceOccurrenceGroups,type ReferenceOccurrence} from '../src/reference-occurrences';

type Rect={left:number;top:number;right:number;bottom:number;width:number;height:number};
const rect=(left:number,top:number,width:number,height:number):Rect=>({left,top,width,height,right:left+width,bottom:top+height});
class Events {
 listeners=new Map<string,Map<(event:any)=>void,unknown>>();
 removals:Array<{type:string;capture:boolean}>=[];
 addEventListener(type:string,callback:(event:any)=>void,options?:unknown){let entries=this.listeners.get(type);if(!entries)this.listeners.set(type,entries=new Map());entries.set(callback,options);}
 removeEventListener(type:string,callback:(event:any)=>void,options?:unknown){const capture=(value:unknown)=>typeof value==='boolean'?value:!!(value as {capture?:boolean}|undefined)?.capture;this.removals.push({type,capture:capture(options)});const entries=this.listeners.get(type);if(entries?.has(callback)&&capture(entries.get(callback))===capture(options))entries.delete(callback);}
 emit(type:string,event:any={}){for(const callback of this.listeners.get(type)?.keys()||[])callback(event);}
}
class Box extends Events {
 children:Box[]=[];parentElement?:Box;hidden=false;visible=true;disabled=false;text='';style:Record<string,any>={removeProperty(key:string){delete this[key];}};attributes=new Map<string,string>();classes=new Set<string>();
 clientLeft=0;clientTop=0;scrollLeft=0;scrollTop=0;clientWidth:number;clientHeight:number;scrollHeight=0;onclick?:()=>void;
 classList={toggle:(key:string,on:boolean)=>{if(on)this.classes.add(key);else this.classes.delete(key);},remove:(key:string)=>this.classes.delete(key)};
 constructor(public ownerDocument:Doc,public box:Rect,private root=false){super();this.clientWidth=box.width;this.clientHeight=box.height;}
 get isConnected():boolean{return this.root||!!this.parentElement?.isConnected;}
 get offsetParent():Box|undefined{return this.hidden?undefined:this.ownerDocument.positioned||this.parentElement;}
 getBoundingClientRect(){this.ownerDocument.layoutRead?.();return this.box;}
 getClientRects(){return this.isConnected&&this.visible&&!this.hidden?[this.box]:[];}
 contains(target:unknown):boolean{return target===this||this.children.some(child=>child.contains(target));}
 createDiv(options:string|{cls?:string;attr?:Record<string,string>}={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createSpan(options:unknown={}){return this.createEl('span',options as any);}
 createEl(_tag:string,options:{cls?:string;attr?:Record<string,string>;text?:string}={}){const child=new Box(this.ownerDocument,rect(0,0,0,0));child.parentElement=this;if(options.cls)child.classes.add(options.cls);for(const [key,value]of Object.entries(options.attr||{}))child.setAttribute(key,value);child.text=options.text||'';this.children.push(child);return child;}
 setAttribute(key:string,value:string){this.attributes.set(key,value);}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 setText(value:string){this.text=value;}
 querySelectorAll(_selector:string):Box[]{return this.children.flatMap(child=>[...(child.attributes.has('type')?[child]:[]),...child.querySelectorAll(_selector)]);}
 querySelector(selector:string){const label=selector.match(/aria-label="([^"]+)"/)?.[1];return this.querySelectorAll('button').find(button=>button.attributes.get('aria-label')===label);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 dispatch(type:string){const event={stopped:false,defaultPrevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.defaultPrevented=true;}};let target:Box|undefined=this;while(target){target.emit(type,event);if(event.stopped)break;target=target.parentElement;}return event;}
}
class Resize {
 targets=new Set<Box>();removed:Box[]=[];disconnected=false;
 constructor(public callback:()=>void){}
 observe(target:Box){this.targets.add(target);}
 unobserve(target:Box){this.targets.delete(target);this.removed.push(target);}
 disconnect(){this.disconnected=true;this.targets.clear();}
}
class Mutation {
 targets=new Map<Box,MutationObserverInit>();disconnected=false;
 constructor(public callback:(records:any[])=>void){}
 observe(target:Box,options:MutationObserverInit){this.disconnected=false;this.targets.set(target,options);}
 disconnect(){this.disconnected=true;this.targets.clear();}
 emit(target:Box,type:'childList'|'attributes'){for(const [root,options]of this.targets)if((target===root||options.subtree&&root.contains(target))&&(type==='childList'?options.childList:options.attributes))this.callback([{target,type}]);}
}
class Doc {
 positioned?:Box;resizes:Resize[]=[];mutations:Mutation[]=[];frames=new Map<number,()=>void>();counter=0;layoutRead?:()=>void;
 viewport=Object.assign(new Events(),{offsetLeft:0,offsetTop:0,width:1200,height:1200});
 defaultView=Object.assign(new Events(),{closed:false,innerWidth:1200,innerHeight:1200,visualViewport:this.viewport,
  requestAnimationFrame:(callback:()=>void)=>{const id=++this.counter;this.frames.set(id,callback);return id;},cancelAnimationFrame:(id:number)=>this.frames.delete(id),
  ResizeObserver:class extends Resize{constructor(callback:()=>void){super(callback);docForObserver!.resizes.push(this);}},
  MutationObserver:class extends Mutation{constructor(callback:(records:any[])=>void){super(callback);docForObserver!.mutations.push(this);}}
 });
 flush(){const callbacks=[...this.frames.values()];this.frames.clear();for(const callback of callbacks)callback();}
 mutate(target:Box,type:'childList'|'attributes'){for(const observer of this.mutations)observer.emit(target,type);}
}
// Constructors are injected from the owner window, matching popout ownership.
let docForObserver:Doc|undefined;
class Component {
 callbacks:Array<()=>void>=[];
 register(callback:()=>void){this.callbacks.push(callback);}
 registerDomEvent(element:Events,type:string,callback:(event:any)=>void,options?:unknown){element.addEventListener(type,callback,options);this.register(()=>element.removeEventListener(type,callback));}
 load(){(this as any).onload();}
 unload(){(this as any).onunload();for(const cleanup of this.callbacks.splice(0))cleanup();}
}
const source=readFileSync('src/reference-occurrences-view.ts','utf8').replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
const View=new Function('Component','Notice','setIcon','referenceOccurrenceGroups',transformSync(source+'\nreturn ReferenceOccurrenceNavigation;',{loader:'ts'}).code)(Component,class{},()=>{},referenceOccurrenceGroups);
function fixture(){
 const doc=new Doc();docForObserver=doc;const positioned=new Box(doc,rect(40,20,600,1000),true);positioned.clientLeft=positioned.clientTop=2;positioned.clientWidth=596;positioned.clientHeight=996;positioned.scrollLeft=14;positioned.scrollTop=26;doc.positioned=positioned;
 const container=new Box(doc,rect(100,80,390,764));container.parentElement=positioned;positioned.children.push(container);let bounds:Box|null|undefined=container.createDiv();bounds.box=rect(100,160,390,530);const initial=bounds;
 const items:ReferenceOccurrence[]=[0,1].map(index=>({key:String(index),boardPath:'Board.md',boardTitle:'Board',nodeId:'node-'+index,nodeTitle:'Node '+index,sourcePath:'notes/source.md',nodeStamp:'stamp',usages:[],groupIds:[],groupPaths:[]}));const trail=new ReferenceOccurrenceTrail(items,0,{current:()=>true,locate:async()=>{},returnToOrigin:async()=>{}});
 let rails:Box[]=[];const host={bounds:()=>bounds,rails:()=>rails,insets:()=>({top:56,bottom:72})},view=new View(container,trail,host);view.load();const element=view.element as Box;
 return{doc,positioned,container,initial,trail,host,view,element,setBounds:(value:Box|null|undefined)=>{bounds=value;},setRails:(value:Box[])=>{rails=value;},get bounds(){return bounds;}};
}
function ordinaryRailFixture(){
 const f=fixture();f.setBounds(undefined);f.container.box=rect(44,84,346,296);Object.assign(f.doc.viewport,{width:390,height:380});f.view.layout();
 const rail=(box:Rect,orientation='vertical')=>{const element=f.container.createDiv({cls:'ts-board-rail',attr:{'aria-orientation':orientation}});element.box=box;element.clientWidth=box.width;element.clientHeight=box.height;return element;};
 const left=()=>42-14+Number.parseFloat(f.element.style.left),right=()=>42+596-14-Number.parseFloat(f.element.style.right);return{...f,rail,left,right};
}
test('production bar stays mounted in contentEl and its whole height is constrained above the brain selection row',()=>{
 const f=fixture();assert.equal(f.element.parentElement,f.container);assert.equal(f.element.hidden,false);assert.equal(f.element.style.left,'84px');assert.equal(f.element.style.right,'146px');assert.equal(f.element.style.bottom,'314px');assert.equal(f.element.style.maxHeight,'506px');
 // Translate the CSS offsets back to viewport coordinates using the real
 // positioned border/scroll origin: the bottom is 12px above stage bottom.
 assert.equal(22+996-26-parseFloat(f.element.style.bottom),678);assert.equal(42-14+parseFloat(f.element.style.left),112);assert.equal(42+596-14-parseFloat(f.element.style.right),478);
 assert.equal(678-parseFloat(f.element.style.maxHeight),172);assert.equal(f.trail.index,0);assert(f.trail.active);
});
test('viewport offsets and keyboard clipping intersect both the stage and the split content box',()=>{
 const f=fixture();Object.assign(f.doc.viewport,{offsetLeft:130,offsetTop:190,width:250,height:250});f.doc.viewport.emit('resize');f.doc.viewport.emit('scroll');f.doc.defaultView.emit('resize');assert.equal(f.doc.frames.size,1);f.doc.flush();
 assert.equal(f.element.style.left,'114px');assert.equal(f.element.style.right,'256px');assert.equal(f.element.style.bottom,'564px');assert.equal(f.element.style.maxHeight,'226px');assert.equal(22+996-26-564,428);assert.equal(428-226,202);
});
for(const height of [44,52,64,100])test(`a ${height}px visible stage slice preserves a 44px scroll target without overlapping the controls`,()=>{
 const f=fixture();Object.assign(f.doc.viewport,{offsetTop:160,height});f.doc.viewport.emit('resize');f.doc.flush();assert.equal(f.element.hidden,false);const maxHeight=Number.parseFloat(f.element.style.maxHeight);assert(maxHeight>=44);assert(maxHeight<=height);assert.equal(f.element.classes.has('is-stage-compact'),maxHeight<64);
 const screenBottom=22+996-26-Number.parseFloat(f.element.style.bottom);assert(screenBottom<=160+height);assert(screenBottom-maxHeight>=160);
});
test('a stage slice below 44px hides temporarily and visualViewport recovery restores the same navigation trail',()=>{
 const f=fixture();Object.assign(f.doc.viewport,{offsetTop:160,height:43});f.doc.viewport.emit('resize');f.doc.flush();assert(f.element.hidden);assert.equal(f.element.offsetParent,undefined);Object.assign(f.doc.viewport,{height:500});f.doc.viewport.emit('resize');f.doc.flush();assert(!f.element.hidden);assert.equal(f.element.offsetParent,f.positioned);assert.equal(f.element.style.bottom,'344px');assert.equal(f.element.style.left,'84px');assert.equal(f.trail.index,0);assert(f.trail.active);
});
test('a narrow 44px stage scrollport removes horizontal chrome without shrinking its buttons',()=>{
 const f=fixture();f.initial.box=rect(100,160,44,530);f.doc.resizes[0].callback();f.doc.flush();assert(!f.element.hidden);assert(f.element.classes.has('is-stage-compact'));const left=42-14+Number.parseFloat(f.element.style.left),right=42+596-14-Number.parseFloat(f.element.style.right);assert.equal(left,100);assert.equal(right,144);
});
test('a too narrow or clipped-away stage never borrows space from toolbar, zoom or footer',()=>{
 const f=fixture();f.initial.box=rect(100,160,43,530);f.doc.resizes[0].callback();f.doc.flush();assert(f.element.hidden);f.initial.box=rect(100,160,390,530);Object.assign(f.doc.viewport,{offsetTop:700,height:144});f.doc.viewport.emit('scroll');f.doc.flush();assert(f.element.hidden);
});
test('stage replacement is discovered structurally and replaces ResizeObserver ownership without observing scene attributes',()=>{
 const f=fixture(),resize=f.doc.resizes[0];assert(resize.targets.has(f.initial));const replacement=f.container.createDiv();replacement.box=rect(110,180,370,300);f.initial.remove();f.setBounds(replacement);f.doc.mutate(f.container,'childList');assert.equal(f.doc.frames.size,1);f.doc.flush();assert(resize.targets.has(replacement));assert(!resize.targets.has(f.initial));assert(resize.removed.includes(f.initial));assert.equal(f.element.style.bottom,'524px');assert.equal(f.element.style.maxHeight,'276px');
 const scene=replacement.createDiv();f.doc.mutate(scene,'attributes');assert.equal(f.doc.frames.size,0);assert.deepEqual([...f.doc.mutations[0].targets.values()],[{childList:true,subtree:true}]);
 // Own description/status changes cannot produce a perpetual layout loop.
 f.doc.mutate(f.element.children[0],'childList');assert.equal(f.doc.frames.size,0);
});
test('selection wrapping changes the observed stage height and moves the bar in one guarded frame',()=>{
 const f=fixture();f.initial.box=rect(100,160,390,370);f.doc.resizes[0].callback();f.doc.resizes[0].callback();assert.equal(f.doc.frames.size,1);f.doc.flush();assert.equal(f.element.style.bottom,'474px');assert.equal(f.element.style.maxHeight,'346px');
});
test('overflow-hidden shell scrollIntoView changes only offsets and a captured scroll updates navigation above the 44px selection tools',()=>{
 const f=fixture();f.container.box=rect(100,0,390,260);const shell=f.container.createDiv('ts-brain-shell');shell.box=rect(100,0,390,260);shell.clientHeight=260;shell.scrollHeight=329;f.initial.remove();f.initial.parentElement=shell;shell.children.push(f.initial);f.initial.box=rect(100,133,390,100);f.initial.clientHeight=100;const selection=shell.createDiv();selection.box=rect(100,233,390,96);f.view.layout();
 const screenBottom=()=>22+996-26-Number.parseFloat(f.element.style.bottom),screenTop=()=>screenBottom()-Number.parseFloat(f.element.style.maxHeight);assert.equal(screenTop(),145);assert.equal(screenBottom(),221);assert.deepEqual([...f.doc.defaultView.listeners.get('scroll')!.values()],[true]);
 // Native scrollIntoView can scroll overflow:hidden without any size mutation,
 // ResizeObserver, structural mutation or visualViewport resize/scroll event.
 shell.scrollTop=69;f.initial.box=rect(100,64,390,100);selection.box=rect(100,164,390,96);f.doc.defaultView.emit('scroll',{target:shell});assert.equal(f.doc.frames.size,1);f.doc.flush();
 assert.equal(shell.clientHeight,260);assert.equal(shell.scrollHeight,329);assert.equal(f.initial.clientHeight,100);assert.equal(screenTop(),76);assert.equal(screenBottom(),152);assert(screenBottom()<=selection.box.top);assert.equal(f.trail.index,0);assert(f.trail.active);
});
test('capture also follows an ancestor of contentEl and coalesces scroll-only changes with other layout notifications',()=>{
 const f=fixture();Object.assign(f.doc.viewport,{offsetTop:120,height:500});f.view.layout();assert.equal(f.element.style.bottom,'384px');f.positioned.scrollTop=95;f.container.box=rect(100,11,390,764);f.initial.box=rect(100,91,390,530);
 f.doc.defaultView.emit('scroll',{target:f.positioned});f.doc.defaultView.emit('scroll',{target:f.positioned});f.doc.viewport.emit('scroll');f.doc.defaultView.emit('resize');assert.equal(f.doc.frames.size,1);f.doc.flush();assert.equal(f.element.style.bottom,'315px');assert.equal(f.element.style.maxHeight,'476px');assert.equal(22+996-95-315,608);assert.equal(f.initial.box.height,530);assert.equal(f.container.box.height,764);
});
test('null, detached, foreign-document and hidden brain targets stay hidden instead of falling back onto controls',()=>{
 for(const kind of ['null','detached','foreign','hidden'] as const){const f=fixture();if(kind==='null')f.setBounds(null);else if(kind==='detached')f.initial.remove();else if(kind==='foreign')f.initial.ownerDocument=new Doc();else f.initial.visible=false;f.doc.resizes[0].callback();f.doc.flush();assert(f.element.hidden,kind);assert(f.trail.active,kind);}
});
test('ordinary and handwriting undefined bounds retain the established inset strategy after a brain transition',()=>{
 const f=fixture();f.setBounds(undefined);f.doc.mutate(f.container,'attributes');f.doc.flush();assert.equal(f.element.style.left,undefined);assert.equal(f.element.style.right,undefined);assert.equal(f.element.style.bottom,'260px');assert.equal(f.element.style.maxHeight,'612px');assert(!f.element.classes.has('is-stage-compact'));assert(!f.doc.resizes[0].targets.has(f.initial));
 Object.assign(f.doc.viewport,{offsetTop:80,height:160});f.doc.viewport.emit('resize');f.doc.flush();assert.equal(f.element.style.bottom,'792px');assert.equal(f.element.style.maxHeight,'80px');
});
test('the actual 50px ordinary left rail cannot cover a wrapped navigation button and old vertical clearance stays exact',()=>{
 const f=ordinaryRailFixture(),rail=f.rail(rect(52,96,50,199)),bottom=f.element.style.bottom,height=f.element.style.maxHeight;f.setRails([rail]);f.view.layout();assert.equal(f.left(),114);assert.equal(f.right(),378);assert(f.left()>rail.box.right);assert.equal(f.right()-f.left(),264);assert.equal(f.element.style.bottom,bottom);assert.equal(f.element.style.maxHeight,height);assert.equal(1020-Number.parseFloat(bottom),296);assert.equal(height,'144px');assert.equal(296-Number.parseFloat(height),152);assert(!f.element.hidden);assert(f.doc.resizes[0].targets.has(rail));assert(f.doc.mutations[1].targets.has(rail));assert.equal(f.trail.index,0);
});
test('right and simultaneous left/right rails reserve their actual rectangles rather than raising navigation above them',()=>{
 const f=ordinaryRailFixture(),left=f.rail(rect(52,96,50,199)),right=f.rail(rect(332,96,50,199));f.setRails([right]);f.view.layout();assert.equal(f.left(),56);assert.equal(f.right(),320);f.setRails([left,right]);f.view.layout();assert.equal(f.left(),114);assert.equal(f.right(),320);assert(f.left()>=left.box.right);assert(f.right()<=right.box.left);assert(!f.element.hidden);
});
test('a rail excludes the entire possible navigation height so wrapping cannot create a second-row overlap',()=>{
 const f=ordinaryRailFixture(),rail=f.rail(rect(52,150,50,44));f.setRails([rail]);f.view.layout();assert.equal(f.left(),114);assert.equal(f.right(),378);assert.equal(f.element.style.maxHeight,'144px');assert.equal(1020-Number.parseFloat(f.element.style.bottom)-144,152);
 // This rail is above the old 78.8px bar top (217.2), but within the taller
 // wrapped scroll area (152..296): the new row must still avoid its width.
 assert(f.left()>rail.box.right);
});
test('a rail-constrained keyboard layout keeps a full 44px scrollport and the established ordinary bottom inset',()=>{
 const f=ordinaryRailFixture(),rail=f.rail(rect(52,96,50,199));Object.assign(f.doc.viewport,{height:160});f.setRails([rail]);f.doc.viewport.emit('resize');f.doc.flush();assert.equal(f.element.style.maxHeight,'44px');assert.equal(1020-Number.parseFloat(f.element.style.bottom),148);assert.equal(f.left(),114);assert(f.element.classes.has('is-stage-compact'));assert(!f.element.hidden);
});
for(const height of [300,160])test(`ordinary self-scroll at visualViewport ${height}px never expands the wrapping lane or drops compact chrome during a layout read`,()=>{
 const f=ordinaryRailFixture(),rail=f.rail(rect(52,96,50,height===300?119:199));f.setRails([rail]);Object.assign(f.doc.viewport,{height});f.doc.viewport.emit('resize');f.doc.flush();
 const maxHeight=height===300?64:44,compact=height===160,requested=compact?66.796875:61,reads:Array<{width:number;compact:boolean;maxScroll:number}>=[];
 assert.equal(f.element.style.maxHeight,maxHeight+'px');assert.equal(f.right()-f.left(),264);assert.equal(f.element.classes.has('is-stage-compact'),compact);
 // A native layout read resolves flex wrapping and clamps scrollTop to the new
 // scroll range. The recorded 64px case has 123/62px scroll/client heights;
 // temporarily restoring the 330px default lane makes one row and clamps to15.
 f.doc.layoutRead=()=>{const width=f.element.style.left===undefined||f.element.style.right===undefined?330:f.right()-f.left(),small=f.element.classes.has('is-stage-compact'),border=small?0:1,padding=small?0:6,rows=width-2*(border+padding)>=288?1:2;
  f.element.clientHeight=maxHeight-2*border;f.element.scrollHeight=Math.ceil(16.796875+4+rows*44+(rows-1)*2+2*padding);const maxScroll=f.element.scrollHeight-f.element.clientHeight;f.element.scrollTop=Math.min(f.element.scrollTop,maxScroll);reads.push({width,compact:small,maxScroll});};
 f.element.scrollTop=requested;f.doc.defaultView.emit('scroll',{target:f.element});f.doc.flush();f.doc.defaultView.emit('scroll',{target:f.element});f.doc.flush();
 assert.equal(f.element.scrollTop,requested);assert(reads.length>0);assert(reads.every(read=>read.width===264&&read.compact===compact));assert.equal(f.doc.frames.size,0);
 const bottom=1020-Number.parseFloat(f.element.style.bottom),top=bottom-maxHeight,border=compact?0:1,padding=compact?0:6,targetTop=top+border+padding+16.796875+4+46-f.element.scrollTop,effective=Math.min(targetTop+44,bottom-border)-Math.max(targetTop,top+border);
 assert.equal(effective,44);assert.equal(f.trail.index,0);assert(f.trail.active);
});
test('a 44px lane between rails remains scrollable and a smaller lane hides without shrinking controls or canceling its trail',()=>{
 const f=ordinaryRailFixture(),left=f.rail(rect(52,96,148,199)),right=f.rail(rect(244,96,138,199));f.setRails([left,right]);f.view.layout();assert.equal(f.left(),200);assert.equal(f.right(),244);assert(f.element.classes.has('is-stage-compact'));assert(!f.element.hidden);left.box=rect(52,96,153,199);f.doc.resizes[0].callback();f.doc.flush();assert(f.element.hidden);assert(f.trail.active);left.box=rect(52,96,148,199);f.doc.resizes[0].callback();f.doc.flush();assert(!f.element.hidden);assert.equal(f.element.offsetParent,f.positioned);assert.equal(f.right()-f.left(),44);
});
test('horizontal, hidden, detached, foreign and vertically unrelated rails preserve the no-rail positioning policy',()=>{
 for(const kind of ['horizontal','hidden','detached','foreign','above','below'] as const){const f=ordinaryRailFixture(),rail=f.rail(kind==='above'?rect(52,96,50,40):kind==='below'?rect(52,319,50,53):rect(52,96,50,199));if(kind==='horizontal')rail.setAttribute('aria-orientation','horizontal');else if(kind==='hidden')rail.hidden=true;else if(kind==='detached')rail.remove();else if(kind==='foreign')rail.ownerDocument=new Doc();f.setRails([rail]);f.view.layout();assert.equal(f.element.style.left,undefined,kind);assert.equal(f.element.style.right,undefined,kind);assert.equal(f.element.style.maxHeight,'144px',kind);assert.equal(f.element.style.bottom,'724px',kind);assert(!f.element.hidden,kind);}
});
test('rails with a client rectangle but no positive area do not consume navigation width',()=>{
 for(const box of [rect(52,170,0,199),rect(52,170,50,0)]){const f=ordinaryRailFixture(),rail=f.rail(box);assert.equal(rail.getClientRects().length,1);f.setRails([rail]);f.view.layout();assert.equal(f.element.style.left,undefined);assert.equal(f.element.style.right,undefined);assert.equal(f.element.style.bottom,'724px');assert.equal(f.element.style.maxHeight,'144px');assert(!f.element.hidden);}
});
test('rails lacking orientation use actual aspect ratio and duplicate rail references cannot accumulate exclusion',()=>{
 const f=ordinaryRailFixture(),vertical=f.rail(rect(52,96,50,199)),horizontal=f.rail(rect(52,150,280,44));vertical.attributes.delete('aria-orientation');horizontal.attributes.delete('aria-orientation');f.setRails([vertical,vertical,horizontal]);f.view.layout();assert.equal(f.left(),114);assert.equal(f.right(),378);assert.equal(f.doc.resizes[0].targets.size,4);assert(f.doc.resizes[0].targets.has(horizontal));
});
test('rail resize, pure side movement and visibility changes refresh exclusion without listening to scene attributes',()=>{
 const f=ordinaryRailFixture(),rail=f.rail(rect(52,96,50,199));f.setRails([rail]);f.view.layout();rail.box=rect(52,96,70,199);f.doc.resizes[0].callback();f.doc.flush();assert.equal(f.left(),134);rail.box=rect(316,96,70,199);f.doc.mutate(rail,'attributes');assert.equal(f.doc.frames.size,1);f.doc.flush();assert.equal(f.left(),56);assert.equal(f.right(),304);rail.hidden=true;f.doc.mutate(rail,'attributes');f.doc.flush();assert.equal(f.element.style.left,undefined);assert.equal(f.element.style.right,undefined);const scene=f.container.createDiv();f.doc.mutate(scene,'attributes');assert.equal(f.doc.frames.size,0);
});
test('rail replacement retires old ResizeObserver and direct-attribute targets and unload releases the replacement',()=>{
 const f=ordinaryRailFixture(),old=f.rail(rect(52,96,50,199));f.setRails([old]);f.view.layout();const replacement=f.rail(rect(316,96,66,199));old.remove();f.setRails([replacement]);f.doc.mutate(f.container,'childList');f.doc.flush();assert(!f.doc.resizes[0].targets.has(old));assert(f.doc.resizes[0].removed.includes(old));assert(f.doc.resizes[0].targets.has(replacement));assert(!f.doc.mutations[1].targets.has(old));assert(f.doc.mutations[1].targets.has(replacement));f.doc.mutate(old,'attributes');assert.equal(f.doc.frames.size,0);f.doc.mutate(replacement,'attributes');assert.equal(f.doc.frames.size,1);f.view.unload();assert.equal(f.doc.frames.size,0);assert(f.doc.mutations[1].disconnected);assert.equal(f.doc.mutations[1].targets.size,0);assert(f.doc.resizes[0].disconnected);
});
test('rail avoidance respects visualViewport horizontal offsets and captured ancestor scrolling with border coordinates',()=>{
 const f=ordinaryRailFixture(),rail=f.rail(rect(52,96,50,199));f.setRails([rail]);Object.assign(f.doc.viewport,{offsetLeft:60,width:300});f.doc.viewport.emit('resize');f.doc.flush();assert.equal(f.left(),114);assert.equal(f.right(),348);f.positioned.scrollLeft=30;f.doc.defaultView.emit('scroll',{target:f.positioned});f.doc.flush();assert.equal(42-30+Number.parseFloat(f.element.style.left),114);assert.equal(42+596-30-Number.parseFloat(f.element.style.right),348);
});
test('brain stage bounds remain authoritative even when old ordinary rails still exist in the same contentEl',()=>{
 const f=fixture(),rail=f.container.createDiv({cls:'ts-board-rail',attr:{'aria-orientation':'vertical'}});rail.box=rect(100,160,90,530);let reads=0;f.host.rails=()=>{reads++;return[rail];};const styles={...f.element.style};f.view.layout();assert.deepEqual(f.element.style,styles);assert.equal(reads,0);assert(!f.doc.resizes[0].targets.has(rail));assert(!f.doc.mutations[1].targets.has(rail));
});
test('wheel and touch/pointer gestures keep default scrolling but never bubble into the board canvas',()=>{
 const f=fixture();for(const type of ['wheel','touchstart','touchmove','touchend','touchcancel','pointerdown','pointermove','pointerup','pointercancel']){let parent=0;f.container.addEventListener(type,()=>parent++);const event=f.element.dispatch(type);assert(event.stopped,type);assert(!event.defaultPrevented,type);assert.equal(parent,0,type);if(type==='wheel'||type.startsWith('touch'))assert.deepEqual([...f.element.listeners.get(type)!.values()],[{passive:true}]);}
});
test('unload cancels a pending layout and removes window/VV, trail, ResizeObserver and structural observers permanently',()=>{
 const f=fixture(),capturedScroll=[...f.doc.defaultView.listeners.get('scroll')!.keys()][0];f.doc.defaultView.emit('scroll',{target:f.positioned});assert.equal(f.doc.frames.size,1);const resize=f.doc.resizes[0],mutations=[...f.doc.mutations];f.view.unload();assert.equal(f.doc.frames.size,0);assert(!f.element.isConnected);assert(resize.disconnected);assert(mutations.every(observer=>observer.disconnected));assert.equal((f.trail as any).listeners.size,0);assert.equal(f.doc.defaultView.listeners.get('resize')?.size,0);assert.equal(f.doc.defaultView.listeners.get('scroll')?.size,0);assert(f.doc.defaultView.removals.some(value=>value.type==='scroll'&&value.capture));assert.equal(f.doc.viewport.listeners.get('resize')?.size,0);assert.equal(f.doc.viewport.listeners.get('scroll')?.size,0);resize.callback();mutations[0].callback([{target:f.container}]);capturedScroll({target:f.positioned});f.doc.defaultView.emit('scroll');f.doc.viewport.emit('resize');assert.equal(f.doc.frames.size,0);assert(f.trail.active);
});
test('a closing owner window hides the existing bar and cannot issue new layout work after unload',()=>{
 const f=fixture();f.doc.defaultView.closed=true;f.doc.defaultView.emit('resize');f.doc.flush();assert(f.element.hidden);f.view.unload();f.doc.defaultView.emit('resize');assert.equal(f.doc.frames.size,0);
});
test('production CSS keeps the stage compact scrollport, hidden rule and 44px target floor',()=>{
 const css=readFileSync('src/reference-occurrences.css','utf8');assert.match(css,/\.ts-reference-navigation\[hidden\]\s*\{display:none\}/);assert.match(css,/\.ts-reference-navigation > \*\s*\{flex:none\}/);assert.match(css,/\.ts-reference-navigation\.is-stage-compact\s*\{padding:0;border-width:0\}/);assert.match(css,/\.ts-reference-navigation-actions button\s*\{[^}]*min-height:44px;min-width:44px/);assert.match(css,/overflow:auto;overscroll-behavior:contain;touch-action:pan-y/);
});
