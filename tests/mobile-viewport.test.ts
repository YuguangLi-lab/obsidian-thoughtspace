import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMobileViewport,mobileViewportLayout} from '../src/mobile-viewport';

test('keyboard intersection respects host header, scroll offset and browser zoom',()=>{
 assert.deepEqual(mobileViewportLayout(84,844,{height:470,offsetTop:36,scale:1},true),{visibleHeight:422,keyboard:true});
 assert.deepEqual(mobileViewportLayout(84,844,{height:470,offsetTop:36,scale:2},true),{visibleHeight:422,keyboard:false});
 assert.deepEqual(mobileViewportLayout(84,844,undefined,true),{visibleHeight:760,keyboard:false});
 assert.deepEqual(mobileViewportLayout(600,844,{height:470,offsetTop:36,scale:1}),{visibleHeight:0,keyboard:false});
});

test('viewport changes stay in owning window, coalesce and release every listener',()=>{
 const listeners=new Map<string,Set<()=>void>>(),frames=new Map<number,()=>void>();let id=0,disconnected=false;
 const emitter=(prefix:string)=>({addEventListener:(type:string,fn:()=>void)=>{const key=prefix+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key)!.add(fn);},removeEventListener:(type:string,fn:()=>void)=>listeners.get(prefix+type)?.delete(fn)});
 const viewport={...emitter('viewport:'),height:800,offsetTop:0,scale:1};
 const win={...emitter('window:'),visualViewport:viewport,innerHeight:800,requestAnimationFrame:(fn:()=>void)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key),ResizeObserver:class{constructor(_fn:()=>void){}observe(){}disconnect(){disconnected=true;}}};
 const active={closest:()=>({})},doc={...emitter('doc:'),defaultView:win,activeElement:active};
 const values=new Map([['--ts-visible-height','original']]),attrs=new Map<string,string>();
 const root={ownerDocument:doc,dataset:{} as Record<string,string>,style:{getPropertyValue:(key:string)=>values.get(key)||'',setProperty:(key:string,value:string)=>values.set(key,value),removeProperty:(key:string)=>values.delete(key)},getAttribute:(key:string)=>attrs.get(key)??null,setAttribute:(key:string,value:string)=>attrs.set(key,value),removeAttribute:(key:string)=>attrs.delete(key),contains:(el:unknown)=>el===active,getBoundingClientRect:()=>({top:70,width:390})};
 const release=bindMobileViewport(root as unknown as HTMLElement);
 assert.equal(values.get('--ts-visible-height'),'730px');viewport.height=430;
 for(let n=0;n<5;n++)for(const fn of listeners.get('viewport:resize')!)fn();
 assert.equal(frames.size,1);for(const fn of frames.values())fn();frames.clear();
 assert.equal(values.get('--ts-visible-height'),'360px');assert.equal(root.dataset.tsKeyboard,'true');
 release();release();assert.equal(disconnected,true);assert.equal([...listeners.values()].reduce((n,set)=>n+set.size,0),0);assert.equal(values.get('--ts-visible-height'),'original');
});
