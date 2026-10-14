import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';

// The same behavioral tests can load the frozen pre-fix production module.
// DOM/layout is an explicit substitute; native disabled blur was independently
// reproduced with trusted Shift+Tab/Enter in an isolated browser component.
const source=process.env.FOLIO_TOOLBAR_OVERFLOW_SOURCE||path.resolve('src/toolbar-overflow.ts');
const {installToolbarOverflow}=createRequire(path.resolve('package.json'))(source) as typeof import('../src/toolbar-overflow');

function fixture(options:{rtl?:boolean;reduced?:boolean}={}){
 const frames=new Map<number,()=>void>(),observers:{run:()=>void;disconnected:boolean}[]=[],calls:ScrollToOptions[]=[],focusCalls:{name:string;options:unknown}[]=[];
 let id=0,width=300,content=900,left=200,afterWrite:(()=>void)|undefined;
 const body={},editor={},external={},doc:any={body,activeElement:body};
 class Events{
  listeners=new Map<string,Set<(event?:any)=>void>>();
  addEventListener(type:string,run:(event?:any)=>void){let s=this.listeners.get(type);if(!s)this.listeners.set(type,s=new Set());s.add(run)}
  removeEventListener(type:string,run:(event?:any)=>void){this.listeners.get(type)?.delete(run)}
  dispatch(type:string,event?:any){for(const f of this.listeners.get(type)||[])f(event)}
 }
 class Control extends Events{
  ownerDocument=doc;parentElement:any=null;isConnected=true;focusVisible=false;cssHidden=false;inert=false;ariaDisabled=false;tagName='BUTTON';tabIndex=0;
  private _hidden=false;private _disabled=false;attributes=new Map<string,string>();clientWidth=40;scrollWidth=40;
  constructor(public name:string,public position=0){super()}
  private blurIfUnavailable(){if((this.hidden||this.disabled)&&doc.activeElement===this)doc.activeElement=body;afterWrite?.()}
  get hidden(){return this._hidden}set hidden(v:boolean){this._hidden=v;this.blurIfUnavailable()}
  get disabled(){return this._disabled}set disabled(v:boolean){this._disabled=v;this.blurIfUnavailable()}
  getAttribute(k:string){return this.attributes.get(k)??null}setAttribute(k:string,v:string){this.attributes.set(k,v)}
  matches(selector:string){if(selector===':focus-visible')return this.focusVisible;return(selector.includes(':disabled')&&this.disabled)||(selector.includes('[hidden]')&&this.hidden)||(selector.includes('[aria-disabled')&&this.ariaDisabled)}
  getClientRects(){return this.isConnected&&!this.hidden&&!this.cssHidden?[this.getBoundingClientRect()]:[]}
  getBoundingClientRect(){const x=options.rtl?100+scroller.clientWidth-40-this.position-left:100+this.position-left;return{left:x,right:x+40,width:40,top:10,bottom:40,height:30}}
  closest(selector:string){if(selector.includes('[inert]')&&this.inert)return this;if(selector.includes('[hidden]')&&this.hidden)return this;return null}
  focus(opts?:unknown){focusCalls.push({name:this.name,options:opts});doc.activeElement=this;this.focusVisible=true}
 }
 const previous=new Control('previous'),next=new Control('next'),first=new Control('first',0),middle=new Control('middle',400),last=new Control('last',860),controls=[first,middle,last];
 const shell:any={ownerDocument:doc,isConnected:true,classList:{toggle(){}},get clientWidth(){return width},contains:(el:unknown)=>el===scroller||controls.includes(el as Control)||el===previous||el===next};
 const scroller:any=Object.assign(new Events(),{ownerDocument:doc,parentElement:shell,isConnected:true,clientLeft:0,scrollTop:23,getBoundingClientRect:()=>({left:100,right:100+scroller.clientWidth,width:scroller.clientWidth}),contains:(el:unknown)=>el===scroller||controls.includes(el as Control),closest:(s:string)=>s.includes('[role=')?scroller:null,querySelectorAll:()=>controls,scrollTo:(opts:ScrollToOptions)=>{calls.push(opts);left=Number(opts.left)}});
 Object.defineProperties(scroller,{clientWidth:{get:()=>width-(previous.hidden?0:30)-(next.hidden?0:30)},offsetWidth:{get:()=>scroller.clientWidth},scrollWidth:{get:()=>content},scrollLeft:{get:()=>left,set:v=>{left=v}}});
 for(const c of controls)c.parentElement=scroller;previous.parentElement=next.parentElement=shell;
 class Observer{disconnected=false;constructor(public run:()=>void){observers.push(this)}observe(){}disconnect(){this.disconnected=true}}
 const view=Object.assign(new Events(),{requestAnimationFrame:(f:()=>void)=>{frames.set(++id,f);return id},cancelAnimationFrame:(n:number)=>frames.delete(n),ResizeObserver:Observer,MutationObserver:Observer,getComputedStyle:(el:any)=>({paddingLeft:'0',paddingRight:'0',direction:options.rtl?'rtl':'ltr',overflowX:el===scroller?'auto':'visible',overflowY:'visible'}),matchMedia:()=>({matches:!!options.reduced})});doc.defaultView=view;
 if(options.rtl)left=-200;
 const dispose=installToolbarOverflow(shell,scroller,previous as unknown as HTMLButtonElement,next as unknown as HTMLButtonElement);
 return{doc,body,editor,external,shell,scroller,previous,next,first,middle,last,controls,frames,observers,calls,focusCalls,dispose,
  focus(c:Control,keyboard=true){doc.activeElement=c;c.focusVisible=keyboard},
  scroll(v:number){left=v;scroller.dispatch('scroll')},resize(v:number){width=v;observers[0].run()},replace(v:number){content=v;observers[1].run()},
  afterWrite(fn:()=>void){afterWrite=fn},flush(){const pending=[...frames.values()];frames.clear();pending.forEach(f=>f())},left:()=>left};
}

test('keyboard next arrow hands focus to the last usable command when disabled at the end',()=>{
 const f=fixture();f.focus(f.next);f.scroll(660);f.flush();assert.equal(f.next.disabled,true);assert.equal(f.doc.activeElement,f.last);assert.deepEqual(f.focusCalls,[{name:'last',options:{preventScroll:true}}]);assert.equal(f.scroller.scrollTop,23);f.dispose();
});
test('keyboard previous arrow hands focus to the first usable command at the beginning',()=>{
 const f=fixture();f.focus(f.previous);f.scroll(0);f.flush();assert.equal(f.previous.disabled,true);assert.equal(f.doc.activeElement,f.first);assert.deepEqual(f.focusCalls,[{name:'first',options:{preventScroll:true}}]);f.dispose();
});
test('fitting content hides focused arrows but retains focus on the corresponding command',()=>{
 for(const side of ['previous','next'] as const){const f=fixture();f.focus(f[side]);f.replace(280);f.flush();assert.equal(f[side].hidden,true);assert.equal(f.doc.activeElement,side==='previous'?f.first:f.last);f.dispose()}
});
test('hidden, disabled, aria-disabled and inert edge commands are not restoration targets',()=>{
 for(const state of ['hidden','disabled','ariaDisabled','inert','cssHidden'] as const){const f=fixture();f.last[state]=true;f.focus(f.next);f.scroll(660);f.flush();assert.equal(f.doc.activeElement,f.middle,state);f.dispose()}
});
test('no available command does not focus the shell, editor or an unavailable command',()=>{
 const f=fixture();f.controls.forEach(c=>c.disabled=true);f.focus(f.next);f.scroll(660);f.flush();assert.equal(f.doc.activeElement,f.body);assert.equal(f.focusCalls.length,0);f.dispose();
});
test('editor and outside focus are never restored into the toolbar',()=>{
 for(const active of ['editor','external'] as const){const f=fixture();f.doc.activeElement=f[active];f.scroll(660);f.flush();assert.equal(f.doc.activeElement,f[active]);assert.equal(f.focusCalls.length,0);f.dispose()}
});
test('pointer-focused arrow is not treated as keyboard intent',()=>{
 const f=fixture();f.focus(f.next,false);f.scroll(660);f.flush();assert.equal(f.doc.activeElement,f.body);assert.equal(f.focusCalls.length,0);f.dispose();
});
test('a real pointer activation does not restore even when Chrome retains focus-visible from an earlier key',()=>{
 const f=fixture({reduced:true});f.scroll(620);f.flush();f.focus(f.next);f.next.dispatch('click',{detail:1});f.flush();assert.equal(f.next.disabled,true);assert.equal(f.doc.activeElement,f.body);assert.equal(f.focusCalls.length,0);f.dispose();
});
test('keyboard activation with detail zero restores at the end and preserves reduced-motion scrolling',()=>{
 const f=fixture({reduced:true});f.scroll(620);f.flush();f.focus(f.next);f.next.dispatch('click',{detail:0});f.flush();assert.equal(f.doc.activeElement,f.last);assert.equal(f.calls.at(-1)?.behavior,'auto');f.dispose();
});
test('an enabled keyboard arrow retains focus while it continues to scroll',()=>{
 const f=fixture();f.focus(f.next);f.next.dispatch('click',{detail:0});f.flush();assert.equal(f.next.disabled,false);assert.equal(f.doc.activeElement,f.next);assert.equal(f.focusCalls.length,0);assert.equal(f.calls.at(-1)?.behavior,'smooth');f.dispose();
});
test('focus that moves before a scheduled refresh is not stolen',()=>{
 const f=fixture();f.focus(f.next);f.scroll(660);f.doc.activeElement=f.external;f.flush();assert.equal(f.doc.activeElement,f.external);assert.equal(f.focusCalls.length,0);f.dispose();
});
test('focus moved during hidden/disabled writes is not overwritten',()=>{
 const f=fixture();f.focus(f.next);f.afterWrite(()=>{f.doc.activeElement=f.external});f.scroll(660);f.flush();assert.equal(f.doc.activeElement,f.external);assert.equal(f.focusCalls.length,0);f.dispose();
});
test('detached shell or moved scroller cannot restore old toolbar focus',()=>{
 for(const boundary of ['shell','scroller','moved'] as const){const f=fixture();f.focus(f.next);f.scroll(660);if(boundary==='moved')f.shell.contains=()=>false;else f[boundary].isConnected=false;f.flush();assert.equal(f.focusCalls.length,0);f.dispose()}
});
test('RTL selects the logical beginning/end while keeping native negative scroll behavior',()=>{
 const f=fixture({rtl:true});f.focus(f.next);f.scroll(-660);f.flush();assert.equal(f.doc.activeElement,f.last);f.focus(f.previous);f.scroll(0);f.flush();assert.equal(f.doc.activeElement,f.first);f.dispose();
});
test('burst notifications still coalesce and disposed/late callbacks cannot restore focus',()=>{
 const f=fixture();f.focus(f.next);f.scroll(660);for(let i=0;i<100;i++){f.observers[0].run();f.observers[1].run()}assert.equal(f.frames.size,1);f.dispose();assert.equal(f.frames.size,0);f.observers.forEach(o=>{assert.equal(o.disconnected,true);o.run()});f.scroller.dispatch('scroll');assert.equal(f.focusCalls.length,0);assert.equal(f.frames.size,0);
});
