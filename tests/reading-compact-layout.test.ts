import test from 'node:test';
import assert from 'node:assert/strict';
import {bindReadingCompactLayout} from '../src/reading-compact-layout';

function fixture(width=280,height=364){
 const events=new Map<string,Set<()=>void>>(),frames=new Map<number,()=>void>();let id=0,disconnected=false,generation=1;
 const win={requestAnimationFrame:(fn:()=>void)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key),addEventListener:(type:string,fn:()=>void)=>{if(!events.has(type))events.set(type,new Set());events.get(type)!.add(fn);},removeEventListener:(type:string,fn:()=>void)=>events.get(type)?.delete(fn)};
 const doc:any={defaultView:win,activeElement:null};
 class El{
  children:El[]=[];parentElement:El|null=null;ownerDocument=doc;hidden=false;open=false;isConnected=true;dataset:Record<string,string>={};scrollTop=0;scrollLeft=0;listeners=new Map<string,Set<()=>void>>();selectionStart=7;selectionEnd=12;focuses=0;
  constructor(public name:string){}
  contains(el:unknown):boolean{return el===this||this.children.some(child=>child.contains(el));}
  detach(){if(this.contains(doc.activeElement))doc.activeElement=doc.body;this.parentElement?.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null;}
  append(el:El){el.detach();this.children.push(el);el.parentElement=this;}
  insertBefore(el:El,next:El){el.detach();this.children.splice(this.children.indexOf(next),0,el);el.parentElement=this;}
  getBoundingClientRect(){return{width,height};}
  getClientRects(){for(let el:El|null=this;el;el=el.parentElement)if(el.hidden)return[];return[{}];}
  querySelectorAll<T extends HTMLElement>(_selector:string):T[]{return this.children.flatMap(el=>[el,...el.querySelectorAll('*')]) as unknown as T[];}
  querySelector(){return this.querySelectorAll('*').find((el:any)=>el.name==='input')||null;}
  focus(){this.focuses++;doc.activeElement=this;}
  addEventListener(type:string,fn:()=>void){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type)!.add(fn);}
  removeEventListener(type:string,fn:()=>void){this.listeners.get(type)?.delete(fn);}
  fire(type:string){for(const fn of this.listeners.get(type)||[])fn();}
 }
 const root=new El('root'),content=new El('content'),details=new El('details'),summary=new El('summary'),panel=new El('panel'),body=new El('layout'),aside=new El('aside'),input=new El('input'),list=new El('list'),reader=new El('reader'),page=new El('page'),command=new El('command'),footer=new El('footer');
 doc.body=new El('document-body');doc.activeElement=doc.body;root.append(content);content.append(details);details.append(summary);details.append(panel);content.append(body);body.append(aside);aside.append(input);aside.append(list);body.append(reader);reader.append(command);reader.append(page);content.append(footer);details.hidden=true;
 const original=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){disconnected=true;}} as unknown as typeof ResizeObserver;
 const controller=bindReadingCompactLayout({root,details,summary,panel,body,aside,reader,page,command,footer,pageIdentity:()=>generation} as any);
 const resize=(w:number,h:number)=>{width=w;height=h;for(const fn of events.get('resize')||[])fn();for(const fn of [...frames.values()])fn();frames.clear();};
 return{root,content,details,summary,panel,body,aside,input,list,reader,page,command,footer,doc,frames,resize,controller,nextPage(){generation++;page.scrollTop=0;},disconnected:()=>disconnected,dispose(){controller.dispose();globalThis.ResizeObserver=original;}};
}
test('actual short pane starts with native page and a closed single disclosure',()=>{
 const f=fixture();assert.equal(f.root.dataset.readingCompact,'true');assert.equal(f.details.hidden,false);assert.equal(f.details.open,false);assert.equal(f.body.hidden,false);assert.deepEqual(f.panel.children,[f.aside,f.command,f.footer]);assert.deepEqual(f.reader.children,[f.page]);assert.equal(f.doc.activeElement,f.doc.body);f.dispose();
});
test('wide or tall panes keep original nodes, order and full navigation',()=>{
 for(const [w,h]of [[601,364],[280,581],[0,364],[280,0]]){const f=fixture(w,h);assert.equal(f.root.dataset.readingCompact,'false');assert.equal(f.details.hidden,true);assert.deepEqual(f.body.children,[f.aside,f.reader]);assert.deepEqual(f.reader.children,[f.command,f.page]);assert.equal(f.content.children.at(-1),f.footer);f.dispose();}
});
test('same-mode resize preserves explicit disclosure state and page scroll',()=>{
 const f=fixture();f.page.scrollTop=245;f.details.open=true;f.details.fire('toggle');assert.equal(f.body.hidden,true);f.page.scrollTop=0;f.resize(300,380);assert.equal(f.details.open,true);f.details.fire('toggle');f.details.open=false;f.details.fire('toggle');assert.equal(f.body.hidden,false);assert.equal(f.page.scrollTop,245);f.resize(300,370);assert.equal(f.details.open,false);assert.equal(f.page.scrollTop,245);f.dispose();
});
test('short-long-short changes restore exact node identities and remembered open state',()=>{
 const f=fixture();f.page.scrollTop=271;f.details.open=true;f.details.fire('toggle');f.list.scrollTop=82;f.list.scrollLeft=17;f.resize(900,700);assert.equal(f.details.hidden,true);assert.equal(f.body.hidden,false);assert.equal(f.page.scrollTop,271);assert.equal(f.list.scrollTop,82);assert.equal(f.list.scrollLeft,17);f.resize(280,364);assert.equal(f.details.open,true);assert.equal(f.body.hidden,true);assert.deepEqual(f.panel.children,[f.aside,f.command,f.footer]);f.details.open=false;f.details.fire('toggle');assert.equal(f.page.scrollTop,271);f.dispose();
});
test('closed short page reading position is not reset on returning to the normal layout',()=>{
 const f=fixture();f.page.scrollTop=389;f.resize(900,700);assert.equal(f.page.scrollTop,389);assert.equal(f.body.hidden,false);f.dispose();
});
test('focused navigation input is revealed and only its synchronous reparent blur is restored',()=>{
 const f=fixture(900,700);f.input.focus();f.list.scrollTop=67;f.resize(280,364);assert.equal(f.details.open,true);assert.equal(f.doc.activeElement,f.input);assert.equal(f.input.selectionStart,7);assert.equal(f.input.selectionEnd,12);assert.equal(f.list.scrollTop,67);f.resize(900,700);assert.equal(f.doc.activeElement,f.input);f.dispose();
});
test('page focus and scroll survive compact changes without focusing a navigation control',()=>{
 const f=fixture(900,700);f.page.focus();f.page.scrollTop=201;f.resize(280,364);assert.equal(f.details.open,false);assert.equal(f.doc.activeElement,f.page);assert.equal(f.page.scrollTop,201);assert.equal(f.input.focuses,0);f.resize(900,700);assert.equal(f.doc.activeElement,f.page);assert.equal(f.page.scrollTop,201);f.dispose();
});
test('collapsing a focused panel restores its own visible summary, not an outside control',()=>{
 const f=fixture();f.details.open=true;f.details.fire('toggle');f.input.focus();f.details.open=false;f.details.fire('toggle');assert.equal(f.doc.activeElement,f.summary);f.doc.activeElement=f.doc.body;f.details.fire('toggle');assert.equal(f.doc.activeElement,f.doc.body);f.resize(900,700);assert.equal(f.doc.activeElement,f.doc.body);f.dispose();
});
test('a summary hidden by a normal layout change transfers to the same navigation search',()=>{
 const f=fixture();f.summary.focus();f.resize(900,700);assert.equal(f.doc.activeElement,f.input);f.dispose();
});
test('dispose and document changes prevent late layout writes',()=>{
 const f=fixture();f.root.ownerDocument={} as any;f.resize(900,700);assert.equal(f.root.dataset.readingCompact,'true');f.dispose();f.resize(900,700);assert.equal(f.root.dataset.readingCompact,'true');assert.equal(f.disconnected(),true);assert.equal(f.frames.size,0);
});

test('hidden navigation cannot restore the previous article scroll into a new generation',()=>{
 for(const leaveCompact of [false,true]){const f=fixture();f.page.scrollTop=480;f.details.open=true;f.details.fire('toggle');f.nextPage();if(leaveCompact)f.resize(900,700);else f.controller.revealPage();assert.equal(f.body.hidden,false);assert.equal(f.page.scrollTop,0);f.dispose();}
});
test('explicit page reveal runs synchronously before an outline jump and restores only the same page',()=>{
 const f=fixture();f.page.scrollTop=310;f.details.open=true;f.details.fire('toggle');f.input.focus();assert.equal(f.controller.revealPage(),true);assert.equal(f.body.hidden,false);assert.equal(f.page.scrollTop,310);assert.equal(f.doc.activeElement,f.summary);assert.equal(f.controller.revealPage(),false);f.dispose();assert.equal(f.controller.revealPage(),false);
});


test('current article and pagination focus override remembered navigation when becoming short again',()=>{
 for(const nodeName of ['page','pagination']){const f=fixture();f.details.open=true;f.details.fire('toggle');f.resize(900,700);const node=nodeName==='page'?f.page:new (f.page.constructor as any)('pagination');if(node!==f.page)f.reader.append(node);node.focus();f.page.scrollTop=333;f.resize(280,364);assert.equal(f.details.open,false);assert.equal(f.body.hidden,false);assert.equal(f.doc.activeElement,node);assert.equal(f.page.scrollTop,333);f.dispose();}
});
test('a late details toggle or explicit reveal cannot mutate an adopted owner document',()=>{
 const f=fixture();f.details.open=true;f.details.fire('toggle');const before=f.root.dataset.readingNavigationOpen;f.root.ownerDocument={} as any;f.details.open=false;f.details.fire('toggle');assert.equal(f.body.hidden,true);assert.equal(f.root.dataset.readingNavigationOpen,before);f.details.open=true;assert.equal(f.controller.revealPage(),false);assert.equal(f.details.open,true);f.dispose();
});
