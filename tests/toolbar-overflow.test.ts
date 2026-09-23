import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installToolbarOverflow} from '../src/toolbar-overflow';

class Events{
 listeners=new Map<string,Set<()=>void>>();
 addEventListener(type:string,run:()=>void){let listeners=this.listeners.get(type);if(!listeners)this.listeners.set(type,listeners=new Set());listeners.add(run);}
 removeEventListener(type:string,run:()=>void){this.listeners.get(type)?.delete(run);}
 dispatch(type:string){for(const run of this.listeners.get(type)||[])run();}
 listenerCount(){let count=0;for(const listeners of this.listeners.values())count+=listeners.size;return count;}
}
function fixture(options:{width?:number;content?:number;left?:number;reduced?:boolean;hidden?:boolean;padding?:number}={}){
 let width=options.width??300,content=options.content??900,left=options.left??0,hidden=options.hidden??false,reduced=options.reduced??false;
 let nextFrame=0,requests=0,measurements=0,writes=0;
 const frames=new Map<number,()=>void>(),calls:ScrollToOptions[]=[],observers:Observer[]=[];
 class Observer{
  targets:unknown[]=[];options?:MutationObserverInit;disconnected=false;
  constructor(public run:()=>void){observers.push(this);}
  observe(target:unknown,options?:MutationObserverInit){this.targets.push(target);this.options=options;}
  disconnect(){this.disconnected=true;}
 }
 class Control extends Events{
  private _hidden=false;disabled=false;attributes=new Map<string,string>();
  get hidden(){return this._hidden;}set hidden(value:boolean){writes++;this._hidden=value;}
  getAttribute(key:string){return this.attributes.get(key)??null;}
  setAttribute(key:string,value:string){writes++;this.attributes.set(key,value);}
 }
 const previous=new Control(),next=new Control(),classes=new Set<string>(),editor={};
 const view=Object.assign(new Events(),{
  requestAnimationFrame:(run:()=>void)=>{requests++;frames.set(++nextFrame,run);return nextFrame;},
  cancelAnimationFrame:(id:number)=>{frames.delete(id);},
  getComputedStyle:()=>({paddingLeft:String(options.padding??0),paddingRight:String(options.padding??0)}),
  matchMedia:(query:string)=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return{matches:reduced};},
  ResizeObserver:Observer,MutationObserver:Observer,
 });
 const doc={defaultView:view,activeElement:editor};
 const shell={ownerDocument:doc,get clientWidth(){measurements++;return hidden?0:width;},classList:{toggle:(name:string,enabled:boolean)=>{writes++;if(enabled)classes.add(name);else classes.delete(name);}}};
 const scroller=Object.assign(new Events(),{
  ownerDocument:doc,
  scrollTo:(options:ScrollToOptions)=>{calls.push(options);left=Number(options.left);},
 });
 Object.defineProperties(scroller,{
  clientWidth:{get:()=>{measurements++;return hidden?0:Math.max(0,width-2*(options.padding??0)-(previous.hidden?0:30)-(next.hidden?0:30));}},
  scrollWidth:{get:()=>{measurements++;return content;}},
  scrollLeft:{get:()=>left,set:(value:number)=>{left=value;}},
 });
 const dispose=installToolbarOverflow(shell as unknown as HTMLElement,scroller as unknown as HTMLElement,previous as unknown as HTMLButtonElement,next as unknown as HTMLButtonElement);
 return{shell,scroller,previous,next,view,doc,editor,classes,frames,calls,observers,dispose,
  resize(value:number){width=value;observers[0].run();},
  replace(value:number){content=value;observers[1].run();},
  hide(value:boolean){hidden=value;observers[0].run();},
  scroll(value:number){left=value;scroller.dispatch('scroll');},
  reduce(value:boolean){reduced=value;},
  flush(){const pending=Array.from(frames.values());frames.clear();for(const run of pending)run();},
  state:()=>({left,requests,measurements,writes}),
 };
}
function visibility(f:ReturnType<typeof fixture>,visible:boolean){
 for(const control of [f.previous,f.next]){assert.equal(control.hidden,!visible);assert.equal(control.getAttribute('aria-hidden'),String(!visible));}
 assert.equal(f.classes.has('ts-toolbar-overflowing'),visible);
}

test('overflow arrows appear only for actual overflow and disable the corresponding end',()=>{
 const f=fixture();visibility(f,true);assert.equal(f.previous.disabled,true);assert.equal(f.next.disabled,false);
 f.scroll(200);f.flush();assert.equal(f.previous.disabled,false);assert.equal(f.next.disabled,false);
 f.scroll(660);f.flush();assert.equal(f.previous.disabled,false);assert.equal(f.next.disabled,true);
 f.scroll(900);f.flush();assert.equal(f.next.disabled,true);f.dispose();
});
test('fitting, empty and hidden toolbars hide and disable both controls',()=>{
 for(const options of [{content:250},{content:0},{hidden:true},{width:0},{content:301}]){
  const f=fixture(options);visibility(f,false);assert.equal(f.previous.disabled,true);assert.equal(f.next.disabled,true);f.dispose();
 }
 const f=fixture({hidden:true});f.hide(false);f.flush();visibility(f,true);f.hide(true);f.flush();visibility(f,false);
 f.previous.dispatch('click');f.next.dispatch('click');assert.equal(f.calls.length,0);f.dispose();
});
test('narrow to wide resize removes arrows without a self-sustaining reduced viewport',()=>{
 const f=fixture({width:300,content:350});visibility(f,true);
 // At 370 px the content fits the shell but not the 310 px viewport with arrows.
 f.resize(370);f.flush();visibility(f,false);assert.equal(f.previous.disabled,true);assert.equal(f.next.disabled,true);
 f.resize(300);f.flush();visibility(f,true);f.dispose();
 const padded=fixture({width:320,content:305,padding:10});visibility(padded,true);padded.resize(330);padded.flush();visibility(padded,false);padded.dispose();
});
test('selection content replacements update end state without resetting scroll or editor focus',()=>{
 const f=fixture({left:400});f.replace(640);f.flush();visibility(f,true);assert.equal(f.next.disabled,true);assert.equal(f.state().left,400);
 f.replace(1100);f.flush();assert.equal(f.next.disabled,false);assert.equal(f.state().left,400);
 f.replace(180);f.flush();visibility(f,false);assert.equal(f.calls.length,0);assert.equal(f.doc.activeElement,f.editor);f.dispose();
});
test('clicks move three quarters of the actual viewport and clamp to each boundary',()=>{
 const f=fixture();f.next.dispatch('click');assert.deepEqual(f.calls.at(-1),{left:180,behavior:'smooth'});f.flush();
 f.scroll(620);f.flush();f.next.dispatch('click');assert.deepEqual(f.calls.at(-1),{left:660,behavior:'smooth'});f.flush();assert.equal(f.next.disabled,true);
 f.scroll(30);f.flush();f.previous.dispatch('click');assert.deepEqual(f.calls.at(-1),{left:0,behavior:'smooth'});f.flush();assert.equal(f.previous.disabled,true);
 assert.equal(f.doc.activeElement,f.editor);assert.equal(f.scroller.listeners.has('wheel'),false);assert.equal(f.scroller.listeners.has('keydown'),false);f.dispose();
});
test('reduced motion preference is respected including changes while the toolbar is open',()=>{
 const f=fixture({reduced:true});f.next.dispatch('click');assert.equal(f.calls.at(-1)?.behavior,'auto');
 f.reduce(false);f.next.dispatch('click');assert.equal(f.calls.at(-1)?.behavior,'smooth');f.dispose();
});
test('scroll, resize and mutation bursts share one frame in the toolbar owner window',()=>{
 const f=fixture(),before=f.state();
 for(let i=0;i<100;i++){f.scroller.dispatch('scroll');f.view.dispatch('resize');f.observers[0].run();f.observers[1].run();}
 assert.equal(f.frames.size,1);assert.equal(f.state().requests-before.requests,1);assert.equal(f.state().measurements,before.measurements);
 f.flush();assert.equal(f.frames.size,0);assert.ok(f.state().measurements>before.measurements);
 assert.deepEqual(f.observers[0].targets,[f.shell,f.scroller]);assert.deepEqual(f.observers[1].targets,[f.scroller]);
 assert.equal(f.observers[1].options?.subtree,true);assert.equal(f.observers[1].options?.characterData,true);f.dispose();
});
test('disposing cancels queued work and all local observers and listeners, including late callbacks',()=>{
 const f=fixture();f.scroll(80);const stale=Array.from(f.frames.values())[0];f.dispose();f.dispose();const before=f.state();
 assert.equal(f.frames.size,0);assert.ok(f.observers.every(observer=>observer.disconnected));
 assert.equal(f.scroller.listenerCount()+f.view.listenerCount()+f.previous.listenerCount()+f.next.listenerCount(),0);
 stale();for(const observer of f.observers)observer.run();f.view.dispatch('resize');f.scroller.dispatch('scroll');f.next.dispatch('click');
 assert.deepEqual(f.state(),before);assert.equal(f.frames.size,0);assert.equal(f.calls.length,0);
});
