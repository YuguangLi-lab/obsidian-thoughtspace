import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {boardFooterReserve,compactBoardChrome} from '../src/board-chrome';

// Run the actual onOpen measurement/observer block. A hidden ordinary canvas
// represents handwriting, while the owner header still has real layout width.
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('    const refreshChrome=()=>{'),end=source.indexOf('    const scheduleChrome=',start);
assert.ok(start>=0&&end>start);
const compile=new Function('scope','compactBoardChrome','boardFooterReserve','BoardView','ResizeObserver',`
const {main,root,nativeHeader,fallbackActions,coarseChrome,rail,more,workspaceEntry,footer,formatbar,chromeWindow,refreshRailObstacle}=scope;
let chromeFrame=0,railFrame=0;
${transformSync(source.slice(start,end),{loader:'ts'}).code}
return refreshChrome;`);

function fixture(native=true){
 let focusedDocument=true,activeView:unknown;const frames=new Map<number,()=>void>();let frame=0;
 const doc={activeElement:null as Element|null,hasFocus:()=>focusedDocument};
 class Element{
  clientWidth=346;parent?:Element;children:Element[]=[];classes=new Set<string>();values=new Map<string,string>();focuses=0;top=84;bottom=844;
  classList={contains:(name:string)=>this.classes.has(name),toggle:(name:string,value:boolean)=>{if(value)this.classes.add(name);else this.classes.delete(name);return value;}};
  style={getPropertyValue:(name:string)=>this.values.get(name)||'',setProperty:(name:string,value:string)=>{this.values.set(name,value);}};
  ownerDocument=doc;
  add(child:Element){this.children.push(child);child.parent=this;return child;}
  contains(other:Element|null):boolean{return this===other||this.children.some(child=>child.contains(other));}
  closest(selector:string):Element|null{return this.classes.has(selector.slice(1))?this:this.parent?.closest(selector)||null;}
  getClientRects():ReturnType<Element['getBoundingClientRect']>[]{return this.clientWidth>0&&(!this.parent||this.parent.getClientRects().length)?[this.getBoundingClientRect()]:[];}
  getBoundingClientRect(){return this.clientWidth>0?{left:44,right:44+this.clientWidth,top:this.top,bottom:this.bottom,width:this.clientWidth,height:this.bottom-this.top}:{left:0,right:0,top:0,bottom:0,width:0,height:0};}
  getAttribute(name:string){return name==='aria-orientation'?'vertical':null;}
  focus(options?:FocusOptions){assert.deepEqual(options,{preventScroll:true});this.focuses++;doc.activeElement=this;}
 }
 const root=new Element(),main=root.add(new Element()),header=new Element(),fallbackActions=native?undefined:root.add(new Element());
 const rail=main.add(new Element()),more=rail.add(new Element()),secondary=rail.add(new Element());secondary.classes.add('ts-rail-secondary');
 const headerContainer=native?header:fallbackActions!,workspaceEntry=headerContainer.add(new Element()),headerSecondary=headerContainer.add(new Element());headerSecondary.classes.add('ts-header-secondary');
 const footer=main.add(new Element());footer.top=780;footer.bottom=836;
 const formatbar=main.add(new Element());formatbar.clientWidth=0;
 const chromeWindow={requestAnimationFrame:(run:()=>void)=>{frames.set(++frame,run);return frame;},cancelAnimationFrame:(id:number)=>frames.delete(id)};
 const observers:{targets:Set<Element>;run:()=>void;disconnected:boolean}[]=[],cleanup:(()=>void)[]=[];
 class ResizeObserver{targets=new Set<Element>();disconnected=false;constructor(public run:()=>void){observers.push(this);}observe(target:Element){this.targets.add(target);}disconnect(){this.disconnected=true;}}
 const camera={x:47,y:-18,zoom:1.2},view={app:{workspace:{getActiveViewOfType:()=>activeView}},minimap:new Element(),stage:new Element(),measureMinimap(){},cardToolbarReserve:0,scheduleRender(){},register:(stop:()=>void)=>cleanup.push(stop),session:{board:{viewport:camera}},transform(){throw Error('chrome resizing must not transform the camera');}};
 activeView=view;const coarseChrome={matches:false},scope={main,root,nativeHeader:native?header:undefined,fallbackActions,coarseChrome,rail,more,workspaceEntry,footer,formatbar,chromeWindow,refreshRailObstacle(){}};
 const refresh=compile.call(view,scope,compactBoardChrome,boardFooterReserve,class BoardView{},ResizeObserver) as ()=>void;
 const flush=()=>{const queue=[...frames.values()];frames.clear();queue.forEach(run=>run());};
 return{root,main,header:headerContainer,coarseChrome,rail,more,workspaceEntry,secondary,headerSecondary,doc,camera,observers,frames,refresh,flush,dispose:()=>cleanup.forEach(stop=>stop()),setFocused:(value:boolean)=>{focusedDocument=value;},setActive:(value:boolean)=>{activeView=value?view:{};}};
}
test('handwriting keeps a compact native header while its ordinary canvas is hidden',()=>{
 const f=fixture();f.main.clientWidth=0;f.refresh();assert.equal(f.main.classList.contains('ts-compact-chrome'),false);assert.equal(f.header.classList.contains('ts-compact-chrome'),true);assert.deepEqual(f.camera,{x:47,y:-18,zoom:1.2});f.dispose();
});
test('rail and native header independently follow their own widths and coarse thresholds',()=>{
 const f=fixture();f.header.clientWidth=1000;f.refresh();assert.equal(f.main.classList.contains('ts-compact-chrome'),true);assert.equal(f.header.classList.contains('ts-compact-chrome'),false);
 f.main.clientWidth=0;f.header.clientWidth=820;f.refresh();assert.equal(f.header.classList.contains('ts-compact-chrome'),false);f.coarseChrome.matches=true;f.refresh();assert.equal(f.header.classList.contains('ts-compact-chrome'),true);f.header.clientWidth=1000;f.refresh();assert.equal(f.header.classList.contains('ts-compact-chrome'),false);f.dispose();
});
test('header-only resize is observed and moves owned focus to the visible workspace entry',()=>{
 const f=fixture();f.main.clientWidth=0;f.header.clientWidth=1000;f.refresh();f.flush();
 assert.ok(f.observers[0].targets.has(f.header));assert.ok(f.observers[0].targets.has(f.root));
 f.doc.activeElement=f.headerSecondary;f.header.clientWidth=346;f.observers[0].run();f.flush();assert.equal(f.header.classList.contains('ts-compact-chrome'),true);assert.equal(f.doc.activeElement,f.workspaceEntry);assert.equal(f.more.focuses,0);f.dispose();
});
test('hidden-main resize cannot steal focus from a background document or another active leaf',()=>{
 for(const background of ['document','leaf','outside']){
  const f=fixture();f.main.clientWidth=0;f.header.clientWidth=1000;f.refresh();f.doc.activeElement=background==='outside'?f.root:f.headerSecondary;if(background==='document')f.setFocused(false);if(background==='leaf')f.setActive(false);const active=f.doc.activeElement;
  f.header.clientWidth=346;f.refresh();assert.equal(f.header.classList.contains('ts-compact-chrome'),true);assert.equal(f.workspaceEntry.focuses,0,background);assert.equal(f.doc.activeElement,active,background);f.dispose();
 }
});
test('switching ordinary to handwriting does not widen the already compact header or refocus it',()=>{
 const f=fixture();f.refresh();f.doc.activeElement=f.root;f.main.clientWidth=0;f.observers[0].run();f.flush();assert.equal(f.header.classList.contains('ts-compact-chrome'),true);assert.equal(f.workspaceEntry.focuses,0);assert.equal(f.doc.activeElement,f.root);f.dispose();
});
test('fallback header uses the root width rather than its intrinsic action width',()=>{
 const f=fixture(false);f.main.clientWidth=0;f.root.clientWidth=1000;f.header.clientWidth=200;f.refresh();assert.equal(f.header.classList.contains('ts-compact-chrome'),false);f.root.clientWidth=346;f.observers[0].run();f.flush();assert.equal(f.header.classList.contains('ts-compact-chrome'),true);f.dispose();
});
test('new header/root observations and queued chrome work are released on close',()=>{
 const f=fixture();f.observers[0].run();assert.equal(f.frames.size,1);f.dispose();assert.equal(f.frames.size,0);assert.equal(f.observers[0].disconnected,true);
});
