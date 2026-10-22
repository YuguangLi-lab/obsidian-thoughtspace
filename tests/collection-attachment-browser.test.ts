import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

type Listener=(event:any)=>void;
class Events {
 listeners=new Map<string,Set<Listener>>();
 addEventListener(name:string,listener:Listener){const set=this.listeners.get(name)||new Set();set.add(listener);this.listeners.set(name,set);}
 removeEventListener(name:string,listener:Listener){this.listeners.get(name)?.delete(listener);}
 emit(name:string,event:any={}){for(const listener of this.listeners.get(name)||[])listener(event);}
}
class Win extends Events {
 closed=false;timers=new Map<number,()=>void>();frames=new Map<number,()=>void>();next=1;
 setTimeout(fn:()=>void){const id=this.next++;this.timers.set(id,fn);return id;}clearTimeout(id:number){this.timers.delete(id);}
 requestAnimationFrame(fn:()=>void){const id=this.next++;this.frames.set(id,fn);return id;}cancelAnimationFrame(id:number){this.frames.delete(id);}
 flushTimers(){const timers=[...this.timers];this.timers.clear();for(const[,fn]of timers)fn();}
}
class El extends Events {
 children:El[]=[];parent?:El;attrs:Record<string,string>={};dataset:Record<string,string>={};classes=new Set<string>();
 isConnected=true;disabled=false;hidden=false;value='';text='';scrollTop=0;
 onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;
 constructor(public ownerDocument:any,public tag='div',options:any={}){super();if(typeof options==='string')options={cls:options};this.text=options.text||'';this.value=options.value||'';for(const cls of(options.cls||'').split(' ').filter(Boolean))this.classes.add(cls);for(const[name,value]of Object.entries(options.attr||{}))this.setAttribute(name,String(value));}
 createEl(tag:string,options:any={}){const element=new El(this.ownerDocument,tag,options);element.parent=this;this.children.push(element);return element;}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 addClass(...names:string[]){for(const name of names)this.classes.add(name);}
 setText(value:string){this.text=value;this.children=[];}empty(){this.children=[];this.text='';}
 setAttribute(name:string,value:string){this.attrs[name]=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase())]=value;}
 appendChild(child:El){child.parent=this;const adopt=(node:El)=>{node.ownerDocument=this.ownerDocument;for(const c of node.children)adopt(c);};adopt(child);this.children.push(child);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;this.isConnected=false;}
 focus(){this.ownerDocument.activeElement=this;}click(){if(!this.disabled&&!this.hidden)this.onclick?.();}
 all():El[]{return this.children.flatMap(child=>[child,...child.all()]);}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
}
class Modal {
 containerEl:El;modalEl:El;contentEl:El;closeCount=0;
 constructor(app:{document:any}){this.containerEl=new El(app.document);this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();}
 open(){(this as any).onOpen();}
 close(){this.closeCount++;(this as any).onClose();this.containerEl.isConnected=false;}
}
const source=readFileSync('src/collection-attachment-browser.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
let bindings=0,released=0;
const CollectionAttachmentBrowser=new Function('Modal','setIcon','bindBoardModalViewport','themeSurface','applyWorkspaceDensity',transformSync(source+'\nreturn CollectionAttachmentBrowser;',{loader:'ts'}).code)(Modal,()=>{},()=>{bindings++;return()=>released++;},(el:El,options:any)=>{el.dataset.accent=options.accent;},(el:El,density:string)=>{el.dataset.density=density;});
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let index=0;index<25;index++)await Promise.resolve();};
const item=(index=0)=>({key:`key${index}`,direction:'attachment',kind:'image',path:`Files/${index}.png`,title:`Image ${index}`,count:1,source:{id:`capture-source-${index}`,createdAt:'2026-10-20T00:00:00.000Z',title:`Source ${index}`,path:`Notes/${index}.md`,tags:[],inBoard:false}});
const page=(items:any[]=[item()],extra:any={})=>({items,total:items.length,unknown:0,unresolved:0,offset:0,limit:24,truncated:false,scanned:1,...extra});
function fixture(){
 const makeDoc=()=>{const doc:any={defaultView:new Win(),activeElement:null};doc.body=new El(doc);return doc;};
 const main=makeDoc(),origin=makeDoc();let active=true,closed=0,offIndex=0,offCurrent=0,changed=()=>{},invalidated=()=>{};
 const requests:Array<{options:any,current:()=>boolean,gate:ReturnType<typeof deferred<any>>}>=[],opened:any[]=[],returned:any[]=[];
 let navigation:ReturnType<typeof deferred>|undefined;
 const host={current:()=>active,accent:()=> 'rose',density:()=> 'compact',
  list:(options:any,current:()=>boolean)=>{const gate=deferred<any>();requests.push({options,current,gate});return gate.promise;},
  open:async(value:any,current:()=>boolean)=>{assert.equal(current(),true);opened.push({value,current});await navigation?.promise;},
  source:async(value:any,current:()=>boolean)=>{assert.equal(current(),true);returned.push({value,current});await navigation?.promise;},
  subscribe:(fn:()=>void)=>{changed=fn;return()=>offIndex++;},watchCurrent:(fn:()=>void)=>{invalidated=fn;return()=>offCurrent++;},closed:()=>closed++,
 };
 const modal=new CollectionAttachmentBrowser({document:main},origin,host);
 const action=(name:string)=>modal.modalEl.all().find((el:El)=>el.attrs['data-collection-attachment-action']===name) as El;
 const control=(name:string)=>modal.modalEl.all().find((el:El)=>el.attrs['data-collection-attachment-'+name]) as El;
 return{modal,main,origin,host,requests,opened,returned,action,control,counts:()=>({closed,offIndex,offCurrent}),change:()=>changed(),stop:()=>{active=false;invalidated();},inactive:()=>{active=false;},gateNavigation:()=>navigation=deferred()};
}

test('browser belongs to originating window and shares appearance without creating eager media',async()=>{
 const f=fixture(),before=bindings;f.modal.open();assert.equal(f.modal.containerEl.ownerDocument,f.origin);assert.equal(f.modal.modalEl.dataset.accent,'rose');assert.equal(f.modal.modalEl.dataset.density,'compact');assert.equal(bindings,before+1);
 assert.deepEqual(f.requests[0].options,{query:'',kind:'all',offset:0,limit:24});f.requests[0].gate.resolve(page());await tick();
 assert.equal(f.control('count').text,'1 项附件引用');assert.ok(f.modal.modalEl.textContent.includes('来源：Source 0'));assert.ok(f.modal.modalEl.textContent.includes('Notes/0.md'));assert.equal(f.modal.modalEl.all().some((el:El)=>['img','iframe','video','audio'].includes(el.tag)),false);assert.equal(f.action('open').disabled,false);f.modal.close();
});
test('new input revokes an earlier request before debounce and ignores its late result',async()=>{
 const f=fixture();f.modal.open();f.control('search').value='different';f.control('search').oninput?.();assert.equal(f.requests[0].current(),false);
 f.requests[0].gate.resolve(page([item(0)]));await tick();assert.equal(f.action('open'),undefined);
 f.origin.defaultView.flushTimers();assert.equal(f.requests[1].options.query,'different');f.requests[1].gate.resolve(page([item(1)]));await tick();assert.ok(f.modal.modalEl.textContent.includes('Image 1'));assert.ok(!f.modal.modalEl.textContent.includes('Image 0'));f.modal.close();
});
test('composition does not issue queries until the final value is committed',async()=>{
 const f=fixture();f.modal.open();f.requests[0].gate.resolve(page());await tick();
 f.control('search').emit('compositionstart');f.control('search').value='来源';f.control('search').oninput?.();f.origin.defaultView.flushTimers();assert.equal(f.requests.length,1);assert.equal(f.action('open').disabled,true);
 let prevented=0;f.control('search').emit('keydown',{key:'Enter',isComposing:true,preventDefault(){prevented++;}});assert.equal(prevented,0);assert.equal(f.requests.length,1);
 f.control('search').emit('compositionend');f.origin.defaultView.flushTimers();assert.equal(f.requests.length,2);assert.equal(f.requests[1].options.query,'来源');f.modal.close();
});
test('type changes cancel pending requests, reset offset and never widen query silently',async()=>{
 const f=fixture();f.modal.open();f.requests[0].gate.resolve(page(Array.from({length:24},(_,i)=>item(i)),{total:50}));await tick();f.action('next').click();
 assert.equal(f.requests[1].options.offset,24);f.control('kind').value='pdf';f.control('kind').onchange?.();assert.equal(f.requests[1].current(),false);assert.deepEqual(f.requests[2].options,{query:'',kind:'pdf',offset:0,limit:24});f.modal.close();
});
test('previous/next pagination uses bounded metadata pages with clear partial-index warnings',async()=>{
 const f=fixture();f.modal.open();f.requests[0].gate.resolve(page(Array.from({length:24},(_,i)=>item(i)),{total:25,unknown:2,unresolved:3,truncated:true}));await tick();
 assert.equal(f.action('previous').disabled,true);assert.equal(f.action('next').disabled,false);assert.match(f.control('count').text,/至少 25/);assert.match(f.control('status').text,/2 条.*3 处.*上限/);assert.match(f.control('page').text,/1 \/ 2.*部分索引/);
 f.action('next').click();f.requests[1].gate.resolve(page([item(24)],{offset:24,total:25}));await tick();assert.equal(f.action('next').disabled,true);assert.equal(f.action('previous').disabled,false);f.action('previous').click();assert.equal(f.requests[2].options.offset,0);f.modal.close();
});
test('index updates disable visible authority until a deliberate refresh',async()=>{
 const f=fixture();f.modal.open();f.requests[0].gate.resolve(page());await tick();f.change();assert.equal(f.action('open').disabled,true);assert.equal(f.action('source').disabled,true);assert.match(f.control('status').text,/有更新.*刷新/);assert.equal(f.requests.length,1);
 f.action('refresh').click();f.requests[1].gate.resolve(page([item(2)]));await tick();assert.equal(f.action('open').disabled,false);assert.ok(f.modal.modalEl.textContent.includes('Image 2'));f.modal.close();
});
test('an index event during query prevents stale response from re-enabling file actions',async()=>{
 const f=fixture();f.modal.open();f.change();assert.equal(f.requests[0].current(),false);f.requests[0].gate.resolve(page());await tick();assert.equal(f.modal.modalEl.dataset.attachmentState,'stale');assert.equal(f.action('open'),undefined);f.modal.close();
});
test('open uses exact displayed item once, and closes after confirmed intentional leaf navigation',async()=>{
 const f=fixture(),gate=f.gateNavigation(),value=item();f.modal.open();f.requests[0].gate.resolve(page([value]));await tick();
 f.action('open').click();f.action('open').click();assert.equal(f.opened.length,1);assert.equal(f.opened[0].value,value);assert.equal(f.action('source').disabled,true);assert.equal(f.action('close').disabled,false);f.inactive();gate.resolve(undefined);await tick();assert.equal(f.counts().closed,1);
});
test('source navigation is distinct from opening the attachment and retains the exact record',async()=>{
 const f=fixture(),value=item(7);f.modal.open();f.requests[0].gate.resolve(page([value]));await tick();f.action('source').click();await tick();assert.equal(f.opened.length,0);assert.equal(f.returned[0].value.source,value.source);assert.equal(f.counts().closed,1);
});
test('failed native navigation is visible and allows a deliberate retry',async()=>{
 const f=fixture(),gate=f.gateNavigation();f.modal.open();f.requests[0].gate.resolve(page());await tick();f.action('open').click();gate.reject(Error('附件已替换，请刷新'));await tick();assert.equal(f.counts().closed,0);assert.match(f.control('status').text,/附件已替换/);assert.equal(f.action('open').disabled,false);f.modal.close();
});
test('closing during navigation revokes its continuation and a late success does not close twice',async()=>{
 const f=fixture(),gate=f.gateNavigation();f.modal.open();f.requests[0].gate.resolve(page());await tick();f.action('source').click();f.action('close').click();assert.equal(f.returned[0].current(),false);gate.resolve(undefined);await tick();assert.equal(f.modal.closeCount,1);assert.equal(f.counts().closed,1);assert.equal(f.modal.contentEl.children.length,0);
});
test('failed listing discards old rows, exposes retry and preserves query',async()=>{
 const f=fixture();f.modal.open();f.requests[0].gate.resolve(page());await tick();f.control('search').value='report';f.control('search').oninput?.();f.origin.defaultView.flushTimers();f.requests[1].gate.reject(Error('原生索引已变化'));await tick();assert.equal(f.action('open'),undefined);assert.equal(f.action('refresh').disabled,false);assert.equal(f.control('search').value,'report');assert.match(f.control('status').text,/原生索引已变化/);f.modal.close();
});
test('owner navigation, close and window cleanup cancel all owned subscriptions and pending work once',async()=>{
 const f=fixture(),before=released;f.modal.open();f.control('search').value='later';f.control('search').oninput?.();f.stop();assert.equal(f.requests[0].current(),false);f.requests[0].gate.resolve(page());f.origin.defaultView.flushTimers();await tick();
 assert.equal(f.requests.length,1);assert.equal(released,before+1);assert.deepEqual(f.counts(),{closed:1,offIndex:1,offCurrent:1});assert.equal(f.origin.defaultView.frames.size,0);assert.equal(f.origin.defaultView.listeners.get('unload')?.size,0);f.modal.close();assert.equal(released,before+1);assert.deepEqual(f.counts(),{closed:1,offIndex:1,offCurrent:1});
});
