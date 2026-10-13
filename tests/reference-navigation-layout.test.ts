import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync('src/reference-occurrences-view.ts','utf8');
function method(start:string,end:string){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,`shipped ${start}`);return source.slice(from,to);}
const methods=method(' onload(){',' private button(')+method(' private layout(){',' onunload(){');
const View=new Function(transformSync('class View{'+methods+'};return View;',{loader:'ts'}).code)();
interface Bounds {top:number;bottom:number;}
function fixture(options:{container:Bounds;parent?:Bounds;viewport?:{offsetTop:number;height:number};height?:number;insets?:{top?:number;bottom?:number}}){
 const containerBounds={...options.container},parentBounds=options.parent?{...options.parent}:undefined;
 const style:{bottom?:string;maxHeight?:string;removeProperty:(name:string)=>void}={removeProperty:()=>{}},parent=parentBounds?{getBoundingClientRect:()=>parentBounds}:undefined;
 const win={innerHeight:options.height??844,visualViewport:options.viewport},container={ownerDocument:{defaultView:win},isConnected:true,getBoundingClientRect:()=>containerBounds};
 const element={style,offsetParent:parent,classList:{remove:()=>{}}},view=new View();Object.assign(view,{stopped:false,observed:new Set(),attributeTargets:new Set(),container,element,host:options.insets?{insets:()=>options.insets}:{}});
 const layout=()=>view.layout(),barBottom=()=> (parentBounds?.bottom??containerBounds.bottom)-parseFloat(style.bottom!),barTop=(height=74)=>barBottom()-Math.min(height,parseFloat(style.maxHeight!));
 return {view,style,parentBounds,containerBounds,win,layout,barBottom,barTop};
}
test('native keyboard regression uses the positioned ancestor and places the bar above the 380px visible bottom',()=>{
 const f=fixture({container:{top:40,bottom:380},parent:{top:0,bottom:844},viewport:{offsetTop:0,height:380},insets:{top:56,bottom:72}});f.layout();assert.equal(f.style.bottom,'548px');assert.equal(f.barBottom(),296);assert.ok(f.barTop()>=40);assert.ok(f.barBottom()<=380);
});
test('desktop ordinary board with the same positioned parent keeps its previous toolbar clearance',()=>{
 const f=fixture({container:{top:40,bottom:844},parent:{top:40,bottom:844},height:844,insets:{top:56,bottom:72}});f.layout();assert.equal(f.style.bottom,'84px');assert.equal(f.barBottom(),760);assert.equal(f.style.maxHeight,'652px');assert.ok(f.barTop()>=40);
});
test('full tablet brain board without explicit insets retains default bottom-tool clearance',()=>{
 const f=fixture({container:{top:60,bottom:1024},parent:{top:60,bottom:1024},height:1024});f.layout();assert.equal(f.style.bottom,'88px');assert.equal(f.barBottom(),936);assert.ok(f.barTop()>=60);assert.ok(f.barBottom()<1024);
});
test('split pane and a scrolled visual viewport use their actual intersection',()=>{
 const f=fixture({container:{top:120,bottom:690},parent:{top:0,bottom:690},viewport:{offsetTop:80,height:550},insets:{top:56,bottom:72}});f.layout();assert.equal(f.style.bottom,'144px');assert.equal(f.barBottom(),546);assert.equal(f.style.maxHeight,'358px');assert.ok(f.barTop()>=120);assert.ok(f.barBottom()<=630);
});
test('short keyboard viewport drops the toolbar reserve while keeping navigable height inside the visible area',()=>{
 const f=fixture({container:{top:40,bottom:180},parent:{top:0,bottom:844},viewport:{offsetTop:0,height:180},insets:{top:56,bottom:72}});f.layout();assert.equal(f.style.bottom,'676px');assert.equal(f.style.maxHeight,'60px');assert.equal(f.barBottom(),168);assert.equal(f.barTop(100),108);assert.ok(f.barTop(100)>=40);
});
test('a nonzero visual viewport offset keeps the short bar above the shifted keyboard boundary',()=>{
 const f=fixture({container:{top:40,bottom:380},parent:{top:0,bottom:844},viewport:{offsetTop:160,height:140},insets:{top:56,bottom:72}});f.layout();assert.equal(f.style.bottom,'556px');assert.equal(f.barBottom(),288);assert.ok(f.barTop(100)>=160);assert.ok(f.barBottom()<=300);
});
test('missing offsetParent safely falls back to the container bounds and stopped layout leaves styles intact',()=>{
 const f=fixture({container:{top:40,bottom:380},viewport:{offsetTop:0,height:380},insets:{top:56,bottom:72}});f.layout();assert.equal(f.style.bottom,'84px');assert.equal(f.barBottom(),296);f.view.stopped=true;f.containerBounds.bottom=250;f.layout();assert.equal(f.style.bottom,'84px');
});
test('the shipped onload observes a different positioned parent and coalesces its resize into one fresh-bounds layout',()=>{
 const containerBounds={top:40,bottom:380},parentBounds={top:0,bottom:844},observed:unknown[]=[],cleanups:(()=>void)[]=[],frames=new Map<number,()=>void>();let serial=0,layoutCount=0,resize:()=>void=()=>{},disconnected=false;
 const eventSurface=()=>({addEventListener:()=>{},removeEventListener:()=>{}}),viewport={...eventSurface(),offsetTop:0,height:380};
 class Observer {constructor(callback:()=>void){resize=callback;}observe(target:unknown){observed.push(target);}unobserve(){}disconnect(){disconnected=true;}}
 const win={...eventSurface(),closed:false,innerHeight:844,visualViewport:viewport,ResizeObserver:Observer,requestAnimationFrame:(fn:()=>void)=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:(id:number)=>frames.delete(id)};
 const parent={getBoundingClientRect:()=>parentBounds},doc={defaultView:win},box=():{createDiv:()=>unknown;style:Record<string,unknown>;classList:{remove:()=>void}}=>({createDiv:()=>box(),style:{removeProperty:()=>{}},classList:{remove:()=>{}}}),element={...box(),offsetParent:parent};
 const container={ownerDocument:doc,isConnected:true,getBoundingClientRect:()=>containerBounds,createDiv:()=>element},view=new View(),actualLayout=view.layout;
 Object.assign(view,{container,observed:new Set(),attributeTargets:new Set(),trail:{subscribe:()=>()=>{}},host:{insets:()=>({top:56,bottom:72})},frame:0,register:(cleanup:()=>void)=>cleanups.push(cleanup),registerDomEvent:()=>{},render:()=>{},button:()=>({disabled:false}),layout:()=>{layoutCount++;actualLayout.call(view);}});
 view.onload();assert.deepEqual(observed,[container,parent]);assert.equal(layoutCount,1);assert.equal(element.style.bottom,'548px');parentBounds.bottom=900;containerBounds.bottom=350;viewport.height=350;
 resize();resize();assert.equal(frames.size,1);assert.equal(layoutCount,1);const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();assert.equal(layoutCount,2);assert.equal(element.style.bottom,'634px');assert.equal(parentBounds.bottom-parseFloat(element.style.bottom),266);
 resize();assert.equal(frames.size,1);for(const cleanup of cleanups)cleanup();assert.equal(frames.size,0);assert.equal(disconnected,true);
});
