import assert from 'node:assert/strict';
import test from 'node:test';
import {mountCardControlHover} from '../src/card-control-hover';
import {cardControlLayout} from '../src/card-control-layout';

type Rect={left:number;top:number;right:number;bottom:number;width:number;height:number};
const rect=(left:number,top:number,width:number,height:number):Rect=>({left,top,right:left+width,bottom:top+height,width,height});
const inside=(r:Rect,x:number,y:number)=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
class Events extends EventTarget {
 listeners=new Map<string,Set<EventListenerOrEventListenerObject>>();
 override addEventListener(type:string,fn:EventListenerOrEventListenerObject|null,options?:AddEventListenerOptions|boolean){if(fn){const set=this.listeners.get(type)||new Set();set.add(fn);this.listeners.set(type,set);}super.addEventListener(type,fn,options);}
 override removeEventListener(type:string,fn:EventListenerOrEventListenerObject|null,options?:EventListenerOptions|boolean){if(fn)this.listeners.get(type)?.delete(fn);super.removeEventListener(type,fn,options);}
 count(){return[...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
class El extends Events {
 parentElement:El|null=null;children:El[]=[];isConnected=true;reads=0;classes=new Set<string>();
 ownerDocument!:Doc;
 classList={contains:(name:string)=>this.classes.has(name),add:(name:string)=>{this.classes.add(name);},remove:(name:string)=>{this.classes.delete(name);}};
 constructor(public bounds:Rect,public isNode=false){super();}
 append(child:El){child.parentElement=this;child.ownerDocument=this.ownerDocument;this.children.push(child);}
 contains(target:unknown):boolean{return target===this||this.children.some(child=>child.contains(target));}
 closest(selector:string):El|null{assert.equal(selector,'.ts-node');return this.isNode?this:this.parentElement?.closest(selector)||null;}
 getBoundingClientRect(){this.reads++;return this.bounds;}
 querySelectorAll(){return this.children.filter(child=>child.classes.has('ts-card-actions')||child.classes.has('ts-compact-actions'));}
 get childElementCount(){return this.children.length;}
}
class Doc extends Events {defaultView!:Events&{requestAnimationFrame:(fn:FrameRequestCallback)=>number;cancelAnimationFrame:(id:number)=>void;setTimeout:(fn:()=>void,ms:number)=>number;clearTimeout:(id:number)=>void};visibilityState='visible';}
function fixture(zoom=1,options:{top?:number;compact?:boolean;stageWidth?:number;topReserve?:number;mount?:boolean}={}){
 const board={x:300,y:options.top??300,width:options.compact?180:300,height:options.compact?40:220},viewport={x:0,y:0,zoom};
 const size={width:options.compact?36:236,height:36,topReserve:options.topReserve??60};
 const position=cardControlLayout(board,viewport,options.stageWidth??1200,800,options.compact?1:5,size);
 const body=rect(board.x*zoom,board.y*zoom,board.width*zoom,board.height*zoom);
 const dockBounds=rect(body.right-position.right*zoom-size.width*position.scale*zoom,body.top+position.top*zoom,size.width*position.scale*zoom,size.height*position.scale*zoom);
 const doc=new Doc(),view=new Events();let now=0,serial=0;const frames=new Map<number,FrameRequestCallback>(),timers=new Map<number,{at:number;run:()=>void}>();
 doc.defaultView=Object.assign(view,{requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:(id:number)=>{frames.delete(id);},setTimeout:(run:()=>void,ms:number)=>{timers.set(++serial,{at:now+ms,run});return serial;},clearTimeout:(id:number)=>{timers.delete(id);}});
 const node=new El(body,true),dock=new El(dockBounds),button=new El(dockBounds),canvas=new El(rect(0,0,1200,800)),other=new El(rect(950,650,150,100),true),port=new El(rect(body.left+body.width/2-15*zoom,body.top-15*zoom,30*zoom,30*zoom));
 for(const el of [node,dock,button,canvas,other,port])el.ownerDocument=doc;
 dock.classes.add(options.compact?'ts-compact-actions':'ts-card-actions');node.append(dock);dock.append(button);node.append(port);
 let hovered=false,focus:El|null=null;const dispose=options.mount===false?()=>{}:mountCardControlHover(node as unknown as HTMLElement);
 const frame=()=>{const batch=[...frames.values()];frames.clear();for(const run of batch)run(now);};
 const tick=(ms:number)=>{now+=ms;for(const[id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.run();}frame();};
 const event=(type:string,target:El,point:{x:number;y:number},pointerType='mouse',buttons=0,relatedTarget:El|null=null)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{target:{value:target},clientX:{value:point.x},clientY:{value:point.y},pointerType:{value:pointerType},buttons:{value:buttons},relatedTarget:{value:relatedTarget}});return e;};
 const visible=()=>node.classes.has('is-control-hover')||hovered||node.contains(focus)||node.classes.has('is-selected');
 const move=(x:number,y:number,settings:{type?:string;buttons?:number;target?:El;flush?:boolean}={})=>{
  // Real source/dock hit testing drives enter/leave; tests never force a hover class.
  const target=settings.target||(inside(port.bounds,x,y)?port:inside(dock.bounds,x,y)&&visible()?button:inside(node.bounds,x,y)?node:inside(other.bounds,x,y)?other:canvas);
  const next=node.contains(target),type=settings.type||'mouse';
  // Browser boundary events target the node being entered/left, then the move
  // targets the actual hit element. Layout changes can emit only the boundary.
  if(next!==hovered){hovered=next;node.dispatchEvent(event(next?'pointerenter':'pointerleave',node,{x,y},type,settings.buttons||0,target));}
  const e=event('pointermove',target,{x,y},type,settings.buttons||0);doc.dispatchEvent(e);if(next)node.dispatchEvent(e);
  if(settings.flush!==false)frame();return{target,event:e};
 };
 return{node,dock,button,canvas,other,port,doc,view,frames,timers,move,tick,frame,dispose,visible,focus:(el:El|null)=>{focus=el;},
  center:(r:Rect)=>({x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}),
  travel(){const start=this.center(node.bounds),end=this.center(dock.bounds);move(start.x,start.y);for(let step=1;step<=24;step++){move(start.x+(end.x-start.x)*step/24,start.y+(end.y-start.y)*step/24);tick(1000);assert.equal(visible(),true,`dock disappeared at path step ${step}`);}return move(end.x,end.y);}
 };
}

for(const zoom of [.5,1,2])for(const compact of [false,true])test(`slow body-to-dock path remains clickable at zoom ${zoom}, compact ${compact}`,()=>{
 const f=fixture(zoom,{compact});assert.equal(f.travel().target,f.button);f.dispose();
});

test('top-reserved and viewport-shifted docks retain diagonal approaches, then close away from the corridor',()=>{
 for(const options of [{top:100,topReserve:126},{top:100,topReserve:126,stageWidth:760},{top:10,topReserve:180,stageWidth:680}]){
  const f=fixture(1,options);assert.equal(f.travel().target,f.button);f.move(20,740);f.tick(500);assert.equal(f.visible(),false);f.dispose();
 }
});

test('a short excursion cancels dismissal when the pointer returns through the corridor',()=>{
 const f=fixture();f.travel();f.move(20,740);f.tick(50);const p=f.center(f.dock.bounds);f.move(p.x,p.y);f.tick(1000);assert.equal(f.visible(),true);f.dispose();
});

test('another card replaces stale hover immediately and does not need to steal a click',()=>{
 const f=fixture();f.travel();f.move(1000,700);assert.equal(f.node.classes.has('is-control-hover'),false);assert.equal(f.timers.size,0);f.dispose();
});

test('geometry follows dock relocation while the pointer is crossing the gap',()=>{
 const f=fixture();const start=f.center(f.node.bounds);f.move(start.x,start.y);f.move(540,290);f.tick(1000);assert.equal(f.visible(),true);
 f.dock.bounds=rect(620,270,236,36);f.button.bounds=f.dock.bounds;f.move(610,290);f.tick(1000);assert.equal(f.visible(),true);f.move(700,286);assert.equal(f.visible(),true);f.dispose();
});

test('the corridor creates no hit layer and never intercepts connection-port events',()=>{
 const f=fixture(),children=[...f.node.children];const start=f.center(f.node.bounds);f.move(start.x,start.y);const p=f.center(f.port.bounds),hit=f.move(p.x,p.y);
 assert.equal(hit.target,f.port);assert.equal(hit.event.defaultPrevented,false);assert.equal(hit.event.cancelBubble,false);assert.deepEqual(f.node.children,children);f.dispose();
});

test('selected and keyboard-focused controls remain visible independently of pointer cleanup',()=>{
 const f=fixture();f.node.classes.add('is-selected');f.move(20,740);f.tick(1000);assert.equal(f.visible(),true);
 f.node.classes.delete('is-selected');f.focus(f.button);assert.equal(f.visible(),true);f.view.dispatchEvent(new Event('blur'));assert.equal(f.visible(),true);f.focus(null);assert.equal(f.visible(),false);f.dispose();
});

test('touch and captured drags do not leave a persistent hover dock',()=>{
 for(const settings of [{type:'touch'},{buttons:1}]){const f=fixture();const p=f.center(f.node.bounds);f.move(p.x,p.y,settings);f.move(20,740,settings);f.tick(1000);assert.equal(f.node.classes.has('is-control-hover'),false);f.dispose();}
 const f=fixture();f.travel();f.move(20,740,{buttons:1});assert.equal(f.node.classes.has('is-control-hover'),false);f.dispose();
});

test('gap pointer bursts share one frame and inactive nodes do not listen globally',()=>{
 const f=fixture();assert.equal(f.doc.count()+f.view.count(),0);const start=f.center(f.node.bounds);f.move(start.x,start.y);const reads=f.node.reads+f.dock.reads;
 for(let i=0;i<50;i++)f.move(540,290,{flush:false});assert.equal(f.frames.size,1);assert.equal(f.node.reads+f.dock.reads,reads);f.frame();assert.ok(f.node.reads+f.dock.reads>reads);f.dispose();
});

test('cancel, blur and document hiding clear timers/listeners and permit a later hover',()=>{
 for(const cancel of [(f:ReturnType<typeof fixture>)=>f.view.dispatchEvent(new Event('blur')),(f:ReturnType<typeof fixture>)=>f.doc.dispatchEvent(new Event('pointercancel')),(f:ReturnType<typeof fixture>)=>{f.doc.visibilityState='hidden';f.doc.dispatchEvent(new Event('visibilitychange'));}]){
  const f=fixture();f.travel();f.move(540,290,{flush:false});cancel(f);assert.equal(f.node.classes.has('is-control-hover'),false);assert.equal(f.frames.size+f.timers.size+f.doc.count()+f.view.count(),0);f.move(20,740);f.doc.visibilityState='visible';const p=f.center(f.node.bounds);f.move(p.x,p.y);assert.equal(f.node.classes.has('is-control-hover'),true);f.dispose();
 }
});

test('dispose is idempotent and queued callbacks cannot revive disconnected or replaced nodes',()=>{
 const f=fixture();f.travel();f.move(20,740,{flush:false});const pending=[...f.frames.values()];f.dispose();f.dispose();f.node.isConnected=false;
 for(const run of pending)run(0);f.tick(1000);assert.equal(f.node.classes.has('is-control-hover'),false);assert.equal(f.node.count()+f.doc.count()+f.view.count()+f.frames.size+f.timers.size,0);
});

test('a detached source or zero-sized dock cannot keep an empty corridor active',()=>{
 for(const invalidate of [(f:ReturnType<typeof fixture>)=>{f.node.isConnected=false;},(f:ReturnType<typeof fixture>)=>{f.dock.bounds=rect(0,0,0,0);},(f:ReturnType<typeof fixture>)=>{f.dock.bounds=rect(Infinity,0,36,36);}]){
  const f=fixture();f.travel();invalidate(f);f.move(540,290);f.tick(500);assert.equal(f.node.classes.has('is-control-hover'),false);f.dispose();
 }
});

test('nodes without actionable docks never install lifecycle listeners',()=>{
 const f=fixture(1,{mount:false});f.dock.children=[];const dispose=mountCardControlHover(f.node as unknown as HTMLElement);
 assert.equal(f.node.count()+f.doc.count()+f.view.count(),0);dispose();dispose();
});

test('a viewport layout change can leave the node without a subsequent pointermove',()=>{
 const f=fixture(),point=f.center(f.node.bounds);f.move(point.x,point.y);
 // Wheel pan/zoom changes the hit target underneath a stationary pointer.
 f.node.bounds=rect(900,300,300,220);f.dock.bounds=rect(964,244,236,36);
 const leave=new Event('pointerleave');Object.defineProperties(leave,{clientX:{value:point.x},clientY:{value:point.y},pointerType:{value:'mouse'},buttons:{value:0},relatedTarget:{value:f.canvas}});
 f.node.dispatchEvent(leave);f.frame();f.tick(500);
 assert.equal(f.node.classes.has('is-control-hover'),false,'a departed node must not retain its dock after the viewport moves away');f.dispose();
});

test('returning from window blur can resume a dock approach without leaving and reentering the card',()=>{
 const f=fixture(),point=f.center(f.node.bounds);f.move(point.x,point.y);f.view.dispatchEvent(new Event('blur'));
 assert.equal(f.node.classes.has('is-control-hover'),false);
 // A window can regain focus with the pointer still in this card. Moving inside
 // its existing hover chain emits pointermove, not a second pointerenter.
 f.move(point.x+1,point.y);f.move(540,290);f.tick(1000);
 assert.equal(f.visible(),true,'the first approach after returning to the window must keep its dock');f.dispose();
});

test('releasing a held pointer inside a card rearms the next dock approach',()=>{
 const f=fixture(),point=f.center(f.node.bounds);f.move(point.x,point.y,{buttons:1});
 // Mouse-up may leave the same unselected card under the pointer; there is no
 // boundary event to restart hover after the gesture has ended.
 const up=new Event('pointerup');Object.defineProperties(up,{clientX:{value:point.x},clientY:{value:point.y},pointerType:{value:'mouse'},buttons:{value:0}});
 f.node.dispatchEvent(up);f.move(540,290);f.tick(1000);
 assert.equal(f.visible(),true,'a completed gesture must not disable the following dock approach');f.dispose();
});

test('a captured release outside the card cannot rearm its dock',()=>{
 const f=fixture(),up=new Event('pointerup');Object.defineProperties(up,{clientX:{value:20},clientY:{value:740},pointerType:{value:'mouse'},buttons:{value:0}});
 f.node.dispatchEvent(up);f.tick(1000);assert.equal(f.node.classes.has('is-control-hover'),false);assert.equal(f.doc.count()+f.view.count(),0);f.dispose();
});
