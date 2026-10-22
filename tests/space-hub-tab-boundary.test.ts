import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../src/space-hub-view.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
function take(text:string,start:string,end:string){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a);return text.slice(a,b);}
const method=take(source,'  private keepTabInside(', '  async load(');
const Hub=new Function(transformSync(`class Hub {${method}} return Hub;`,{loader:'ts'}).code)();
function fixture(){
 let focused=true,current=true;const events:string[]=[],listeners=new Set<(event:any)=>void>();
 const doc:any={hasFocus:()=>focused,activeElement:null,overlays:[],querySelectorAll:()=>doc.overlays,addEventListener:(_name:string,fn:(event:any)=>void)=>listeners.add(fn),removeEventListener:(_name:string,fn:(event:any)=>void)=>listeners.delete(fn)};
 const win:any={closed:false,getComputedStyle:(el:Element)=>({visibility:el.visibility})};doc.defaultView=win;
 class Element {
  ownerDocument=doc;isConnected=true;tabIndex=0;disabled=false;inert=false;rects=true;visibility='visible';tag='button';open=true;isModal=false;children:Element[]=[];parentElement:Element|null=null;focuses=0;
  constructor(public name:string,parent?:Element){if(parent){this.parentElement=parent;parent.children.push(this);}}
  contains(el:unknown):boolean{return this===el||this.children.some(child=>child.contains(el));}
  matches(selector:string):boolean{return selector===':disabled'?this.disabled:selector==='[inert]'?this.inert:selector==='.modal'?this.isModal:selector==='details:not([open])'?this.tag==='details'&&!this.open:false;}
  closest(selector:string):Element|null{return this.matches(selector)?this:this.parentElement?.closest(selector)??null;}
  querySelector(selector:string){assert.equal(selector,':scope > summary');return this.children.find(el=>el.tag==='summary')??null;}
  querySelectorAll():Element[]{return this.children.flatMap(el=>[el,...el.querySelectorAll()]).filter(el=>el.tag!=='div'&&el.tag!=='details');}
  getClientRects(){return this.isConnected&&this.rects?[{width:44,height:44}]:[];}
  focus(){this.focuses++;doc.activeElement=this;events.push(this.name);for(const fn of [...listeners])fn({target:this});}
 }
 const body=new Element('BODY');body.tag='div';doc.body=body;
 const outside=new Element('Navigator 收集',body),container=new Element('modal-container',body);container.tag='div';
 const modal=new Element('modal',container);modal.tag='div';modal.isModal=true;
 const first=new Element('全部白板',modal),middle=new Element('搜索空间总览',modal),last=new Element('选择本页',modal);middle.tag='input';
 const hub=new Hub();Object.assign(hub,{active:true,modalEl:modal,containerEl:container,host:{document:doc,current:()=>current}});
 const event:any={isTrusted:true,key:'Tab',shiftKey:false,defaultPrevented:false,isComposing:false,altKey:false,ctrlKey:false,metaKey:false,view:win,target:last,preventDefault(){this.defaultPrevented=true;}};
 doc.activeElement=last;
 const run=()=>hub.keepTabInside(event);
 const select=(el:Element)=>{doc.activeElement=el;event.target=el;};
 return{hub,doc,win,body,outside,container,modal,first,middle,last,event,events,listeners,Element,run,select,setFocused:(value:boolean)=>{focused=value;},setCurrent:(value:boolean)=>{current=value;}};
}
test('forward boundary wraps synchronously inside the exact Hub before the native default can escape',()=>{const f=fixture();f.run();assert.equal(f.event.defaultPrevented,true);assert.equal(f.doc.activeElement,f.first);assert.deepEqual(f.events,['全部白板']);});
test('ShiftTab from first returns to the exact last enabled control',()=>{const f=fixture();f.select(f.first);f.event.shiftKey=true;f.run();assert.equal(f.event.defaultPrevented,true);assert.equal(f.doc.activeElement,f.last);});
for(const reverse of [false,true])test(`internal ${reverse?'ShiftTab':'Tab'} is left to native traversal`,()=>{const f=fixture();f.select(f.middle);f.event.shiftKey=reverse;f.run();assert.equal(f.event.defaultPrevented,false);assert.deepEqual(f.events,[]);});
for(const cause of ['synthetic','other-key','prevented','composing','alt','ctrl','meta','foreign-window','background','closed-window','closed-hub','navigation','detached-modal','moved-container','moved-host','outside-focus','different-target','nested-modal'])test(`no boundary handling for ${cause}`,()=>{
 const f=fixture();
 if(cause==='synthetic')f.event.isTrusted=false;
 if(cause==='other-key')f.event.key='Escape';
 if(cause==='prevented')f.event.defaultPrevented=true;
 if(cause==='composing')f.event.isComposing=true;
 if(cause==='alt')f.event.altKey=true;
 if(cause==='ctrl')f.event.ctrlKey=true;
 if(cause==='meta')f.event.metaKey=true;
 if(cause==='foreign-window')f.event.view={};
 if(cause==='background')f.setFocused(false);
 if(cause==='closed-window')f.win.closed=true;
 if(cause==='closed-hub')f.hub.active=false;
 if(cause==='navigation')f.setCurrent(false);
 if(cause==='detached-modal')f.modal.isConnected=false;
 if(cause==='moved-container')f.container.ownerDocument={};
 if(cause==='moved-host')f.hub.host.document={};
 if(cause==='outside-focus')f.select(f.outside);
 if(cause==='different-target')f.event.target=f.middle;
 if(cause==='nested-modal'){const nested=new f.Element('nested',f.modal);nested.tag='div';nested.isModal=true;const child=new f.Element('nested-last',nested);f.select(child);}
 f.run();assert.deepEqual(f.events,[]);assert.equal(f.event.defaultPrevented,cause==='prevented');
});
for(const cause of ['disabled','negative-tabindex','no-rect','visibility-hidden','inert-self','inert-ancestor','closed-details-body','nested-modal-control'])test(`boundary skips ${cause} trailing controls`,()=>{
 const f=fixture();let parent=f.modal;
 if(cause==='inert-ancestor'){parent=new f.Element('inert parent',f.modal);parent.tag='div';parent.inert=true;}
 if(cause==='closed-details-body'){parent=new f.Element('closed details',f.modal);parent.tag='details';parent.open=false;}
 if(cause==='nested-modal-control'){parent=new f.Element('nested modal',f.modal);parent.tag='div';parent.isModal=true;}
 const skipped=new f.Element('excluded',parent);
 if(cause==='disabled')skipped.disabled=true;
 if(cause==='negative-tabindex')skipped.tabIndex=-1;
 if(cause==='no-rect')skipped.rects=false;
 if(cause==='visibility-hidden')skipped.visibility='hidden';
 if(cause==='inert-self')skipped.inert=true;
 f.run();assert.equal(f.event.defaultPrevented,true);assert.equal(f.doc.activeElement,f.first);assert.equal(skipped.focuses,0);
});
test('closed disclosure summary stays in the Tab sequence while its body does not',()=>{const f=fixture();const details=new f.Element('details',f.modal);details.tag='details';details.open=false;const summary=new f.Element('筛选与排序',details);summary.tag='summary';new f.Element('hidden select',details);f.select(summary);f.run();assert.equal(f.doc.activeElement,f.first);assert.equal(f.event.defaultPrevented,true);});
test('a summary inside another closed disclosure body is not tabbable',()=>{const f=fixture();const outer=new f.Element('outer',f.modal);outer.tag='details';outer.open=false;const inner=new f.Element('inner',outer);inner.tag='details';inner.open=false;const summary=new f.Element('inner summary',inner);summary.tag='summary';f.run();assert.equal(f.doc.activeElement,f.first);assert.equal(summary.focuses,0);});
test('positive tabindex order precedes stable DOM order for zero tabindex',()=>{const f=fixture();f.middle.tabIndex=2;f.last.tabIndex=1;f.select(f.first);f.run();assert.equal(f.event.defaultPrevented,true);assert.equal(f.doc.activeElement,f.last);const g=fixture();g.middle.tabIndex=2;g.last.tabIndex=1;g.select(g.last);g.event.shiftKey=true;g.run();assert.equal(g.doc.activeElement,g.first);});
test('a single visible control remains its own Tab boundary',()=>{const f=fixture();f.first.disabled=true;f.middle.rects=false;f.run();assert.equal(f.event.defaultPrevented,true);assert.equal(f.doc.activeElement,f.last);});
test('no eligible controls leaves the original event untouched',()=>{const f=fixture();for(const el of [f.first,f.middle,f.last])el.disabled=true;f.run();assert.equal(f.event.defaultPrevented,false);assert.deepEqual(f.events,[]);});
test('ordinary host with no optional ownership hook uses the same local boundary',()=>{const f=fixture();f.hub.host={};f.run();assert.equal(f.doc.activeElement,f.first);});
function launchFixture(){
 const f=fixture(),open=take(main,'  openSpaceHub(', '  refreshStyleClipboard(');
 const Plugin=new Function('SpaceHubModal',transformSync(`class Plugin {${open}} return Plugin;`,{loader:'ts'}).code)(function(_app:unknown,host:unknown){f.hub.host=host;return f.hub;});
 const origin=new f.Element('空间总览',f.body),more=new f.Element('更多',f.body);more.rects=false;origin.focus();
 const plugin=new Plugin();Object.assign(plugin,{app:{},settings:{hub:{},favoriteBoards:[]},journalRoot:'Journal',convenienceOrigin:()=>({document:f.doc,current:()=>true,watch:()=>()=>{},stop:()=>{}})});
 f.hub.open=()=>{f.first.focus();};f.hub.close=()=>{f.modal.isConnected=false;f.doc.activeElement=f.body;f.hub.host.closed();};
 plugin.openSpaceHub(undefined,{origin,more,current:()=>true});f.select(f.last);f.events.length=0;
 return{...f,origin,more,plugin};
}
test('real launch guard survives boundary Tab and restores the exact responsive More on close',()=>{const f=launchFixture();f.run();assert.equal(f.event.defaultPrevented,true);assert.deepEqual(f.events,['全部白板']);f.origin.rects=false;f.more.rects=true;f.hub.close();assert.equal(f.doc.activeElement,f.more);assert.equal(f.listeners.size,0);});
test('real launch guard still permanently revokes a genuine outside visit that later returns inside',()=>{const f=launchFixture();f.outside.focus();f.first.focus();f.select(f.last);f.run();f.hub.close();assert.equal(f.doc.activeElement,f.body);assert.equal(f.origin.focuses,1);assert.equal(f.more.focuses,0);assert.equal(f.listeners.size,0);});
test('listener belongs to the existing modal lifecycle; the global launch guard is unchanged',()=>{assert.ok(source.includes("this.life.registerDomEvent(this.modalEl,'keydown',event=>this.keepTabInside(event))"));assert.ok(source.includes('this.life.unload()'));assert.ok(main.includes('if(event.target!==doc.body&&!modal.containerEl.contains(event.target as Node))displaced=true;'));assert.ok(!method.includes('setTimeout'));assert.ok(!method.includes('stopPropagation'));});
