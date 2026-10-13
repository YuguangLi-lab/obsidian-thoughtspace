import test from 'node:test';
import assert from 'node:assert/strict';
import {bindBoardModalViewport} from '../src/board-modal-viewport';

function fixture(){
 const listeners=new Map<string,Set<()=>void>>(),frames=new Map<number,()=>void>();let id=0;
 const emitter=(prefix:string)=>({addEventListener:(type:string,fn:()=>void)=>{const key=prefix+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key)!.add(fn);},removeEventListener:(type:string,fn:()=>void)=>listeners.get(prefix+type)?.delete(fn)});
 const viewport={...emitter('viewport:'),height:800,offsetTop:0,scale:1},win={...emitter('window:'),visualViewport:viewport,innerHeight:800,requestAnimationFrame:(fn:()=>void)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key)};
 const doc={...emitter('doc:'),defaultView:win,activeElement:undefined},values=new Map([['--ts-visible-height','prior-height'],['--ts-modal-visible-top','prior-top']]),attrs=new Map<string,string>(),classes=new Set<string>();
 const root={ownerDocument:doc,dataset:{},classList:{contains:(name:string)=>classes.has(name),add:(name:string)=>classes.add(name),remove:(name:string)=>classes.delete(name)},style:{getPropertyValue:(key:string)=>values.get(key)||'',setProperty:(key:string,value:string)=>values.set(key,value),removeProperty:(key:string)=>values.delete(key)},getAttribute:(key:string)=>attrs.get(key)??null,setAttribute:(key:string,value:string)=>attrs.set(key,value),removeAttribute:(key:string)=>attrs.delete(key),contains:()=>false,getBoundingClientRect:()=>({top:parseFloat(values.get('--ts-modal-visible-top')||'0'),width:360})};
 const event=(name:string)=>{for(const fn of listeners.get(name)||[])fn();};const flush=()=>{const tasks=[...frames.values()];frames.clear();for(const fn of tasks)fn();};
 return{root,viewport,values,classes,frames,listeners,event,flush};
}
test('export centering follows visible keyboard height and scroll offset without repeated shrinkage',()=>{
 const f=fixture(),release=bindBoardModalViewport(f.root as unknown as HTMLElement);
 assert.equal(f.values.get('--ts-visible-height'),'800px');f.viewport.height=300;f.event('viewport:resize');f.flush();assert.equal(f.values.get('--ts-visible-height'),'300px');
 for(const offset of [80,0,120,0]){f.viewport.offsetTop=offset;f.event('viewport:scroll');f.flush();assert.equal(f.values.get('--ts-modal-visible-top'),offset+'px');assert.equal(f.values.get('--ts-visible-height'),'300px');}
 release();
});
test('export viewport release cancels pending frames, removes owning-window listeners and restores prior state',()=>{
 const f=fixture(),release=bindBoardModalViewport(f.root as unknown as HTMLElement);f.viewport.height=300;f.event('viewport:resize');assert.equal(f.frames.size,2);release();release();
 assert.equal(f.frames.size,0);assert.equal([...f.listeners.values()].reduce((count,set)=>count+set.size,0),0);assert.equal(f.values.get('--ts-visible-height'),'prior-height');assert.equal(f.values.get('--ts-modal-visible-top'),'prior-top');assert.equal(f.classes.has('ts-board-modal-viewport'),false);
});
