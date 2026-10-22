import {themePluginMenu} from '../src/ui-tokens';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

class Document {
 activeElement?:Element|{isConnected:boolean};body={isConnected:true};listeners=new Set<(event:any)=>void>();resizeListeners=new Set<()=>void>();documentListeners=new Map<string,Set<()=>void>>();tasks=new Map<number,()=>void>();frames=new Map<number,()=>void>();nextTask=0;
 defaultView={closed:false,addEventListener:(type:string,listener:(event:any)=>void)=>type==='keydown'?this.listeners.add(listener):this.resizeListeners.add(listener as ()=>void),removeEventListener:(type:string,listener:(event:any)=>void)=>type==='keydown'?this.listeners.delete(listener):this.resizeListeners.delete(listener as ()=>void),setTimeout:(callback:()=>void)=>{this.tasks.set(++this.nextTask,callback);return this.nextTask;},clearTimeout:(id:number)=>this.tasks.delete(id),requestAnimationFrame:(callback:()=>void)=>{this.frames.set(++this.nextTask,callback);return this.nextTask;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)};
 addEventListener(type:string,listener:()=>void){if(!this.documentListeners.has(type))this.documentListeners.set(type,new Set());this.documentListeners.get(type)!.add(listener);}
 removeEventListener(type:string,listener:()=>void){this.documentListeners.get(type)?.delete(listener);}
 emit(type:string){for(const listener of this.documentListeners.get(type)||[])listener();}
 key(event:any){for(const listener of [...this.listeners]){listener(event);if(event.stopped)break;}}
 flushTasks(){for(const [id,callback]of [...this.tasks]){this.tasks.delete(id);callback();}}
 resize(){for(const listener of this.resizeListeners)listener();for(const [id,callback]of [...this.frames]){this.frames.delete(id);callback();}}
}
class Element {
 children:Element[]=[];parentElement?:Element;attrs:Record<string,string>={};dataset:Record<string,string>={};className='';text='';title='';action?:()=>unknown;
 ownerDocument=new Document();isConnected=true;visible=true;scrollRequests:unknown[]=[];clipped=false;scrollMovements=0;
 constructor(options:string|{cls?:string;text?:string;attr?:Record<string,string>}={}){if(typeof options==='string')this.className=options;else{this.className=options.cls||'';this.text=options.text||'';this.attrs={...options.attr};}}
 createDiv(options:string|{cls?:string;text?:string;attr?:Record<string,string>}={}){const el=new Element(options);this.appendChild(el);return el;}
 createEl(_tag:string,options:{cls?:string;text?:string;attr?:Record<string,string>}={}){return this.createDiv(options);}
 appendChild(el:Element){el.parentElement=this;el.ownerDocument=this.ownerDocument;this.children.push(el);return el;}
 addClass(...names:string[]){this.className+=' '+names.join(' ');}
 setAttribute(key:string,value:string){this.attrs[key]=value;}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];}
 getBoundingClientRect(){return {left:15,bottom:70};}
 getClientRects(){return this.isConnected&&this.visible?[{}]:[];}
 focus(){this.ownerDocument.activeElement=this;this.ownerDocument.emit('focusin');}
 scrollIntoView(options:unknown){this.scrollRequests.push(options);if(this.clipped){this.clipped=false;this.scrollMovements++;}}
 all():Element[]{return this.children.flatMap(c=>[c,...c.all()]);}
}
class Menu {
 static items:Menu[]=[];entries:{title:string;action:()=>unknown}[]=[];hideCallback?:()=>void;hidden=false;position?:{x:number;y:number};document?:Document;parent?:Element;
 constructor(){Menu.items.push(this);}
 setUseNativeMenu(_native:boolean){return this;}
 setParentElement(parent:Element){this.parent=parent;return this;}
 addItem(config:(item:unknown)=>void){const entry={title:'',action:()=>{}};const item={setTitle(v:string){entry.title=v;return item;},setIcon(_v:string){return item;},onClick(fn:()=>void){entry.action=fn;return item;}};config(item);this.entries.push(entry);return this;}
 addSeparator(){return this;}
 onHide(fn:()=>void){this.hideCallback=fn;}
 hide(){if(this.hidden)return this;this.hidden=true;this.hideCallback?.();return this;}
 showAtPosition(position:{x:number;y:number},document:Document){this.position=position;this.document=document;}
}
function fixture(){
 const calls:{name:string;value?:unknown}[]=[],errors:unknown[]=[],vault={on:()=>({}),getFiles:()=>[]};
 const plugin={settings:{surfaceStyle:'soft',glassEffects:false,accent:'forest',density:'comfortable',favoriteBoards:[]},app:{vault},currentBoard:undefined,boardForDocument:()=>undefined,openCollection:()=>calls.push({name:'collection'}),quickCapture:()=>calls.push({name:'capture'}),promptBoard:()=>calls.push({name:'legacy'}),promptNewBoard:()=>calls.push({name:'new'}),promptBrainBoard:()=>calls.push({name:'brain'}),promptMarkdownBoard:(brain=false)=>calls.push({name:brain?'markdown-brain':'markdown'}),openSpaceHub:()=>calls.push({name:'hub'}),openExcerptNote:():unknown=>calls.push({name:'excerpt'}),openBoardOrganizer:(value:unknown)=>calls.push({name:'organize',value}),openSectionCatalog:(value:unknown)=>calls.push({name:'sections',value})};
 class ItemView {contentEl=new Element();app={vault};registerEvent(_event:unknown){};}
 class TemplatePicker {constructor(_app:unknown,_plugin:unknown){}open(){calls.push({name:'template'});}}
 const button=(parent:Element,label:string,_icon:string,action:()=>unknown,cls='')=>{const b=parent.createDiv({cls:'ts-button '+cls,text:label,attr:{'aria-label':label}});b.action=action;return b;};
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class NavigatorView extends'),end=source.indexOf('\nclass MaterialsView',start);
 assert.ok(start>=0&&end>start);
 const act=(action:()=>unknown)=>{try{Promise.resolve(action()).catch(error=>errors.push(error));}catch(error){errors.push(error);}};
 const View=new Function('themePluginMenu','ItemView','Menu','button','TemplatePicker','DOCK','isWorkspaceFile','EXT','act',transformSync(source.slice(start,end)+'\nreturn NavigatorView;',{loader:'ts'}).code)(themePluginMenu,ItemView,Menu,button,TemplatePicker,'dock',()=>true,'thoughtspace',act);
 const view=new View({},plugin),find=(label:string)=>view.contentEl.all().find((e:Element)=>e.attrs['aria-label']===label) as Element;
 return{view,find,calls,plugin,errors};
}
test('named creation menu retains new-board and template actions and closes with its navigator',async()=>{
 const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板');assert.equal(create.attrs['aria-haspopup'],'menu');assert.equal(create.attrs['aria-expanded'],'false');
 create.action?.();const first=Menu.items.at(-1)!;assert.deepEqual(first.entries.map(e=>e.title),['新建白板或脑图…','从模板新建']);assert.deepEqual(first.position,{x:15,y:74});assert.equal(create.attrs['aria-expanded'],'true');
 for(const item of first.entries)item.action();assert.deepEqual(f.calls.map(c=>c.name),['new','template']);
 create.action?.();const second=Menu.items.at(-1)!;assert(first.hidden);first.hideCallback?.();assert.equal(create.attrs['aria-expanded'],'true','an old menu cannot collapse the current menu state');
 await f.view.onClose();assert(second.hidden);assert.equal(create.attrs['aria-expanded'],'false');
});
test('collection and named workspace entries remain directly reachable',async()=>{
 const f=fixture();await f.view.onOpen();for(const name of ['收集','空间总览','打开笔记摘录'])f.find(name).action?.();assert.deepEqual(f.calls.map(c=>c.name),['collection','hub','excerpt']);
 const children=f.view.contentEl.all() as Element[];assert(children.findIndex(e=>e.className==='ts-dock-host')<children.findIndex(e=>e.className==='ts-dock-workspace-tools'),'board tools follow the working list in DOM and keyboard order');
});
test('short-height tools menu retains every secondary action and resolves the current board at activation',async()=>{
 const f=fixture();await f.view.onOpen();const more=f.find('空间与白板工具'),create=f.find('新建白板或使用模板');assert.equal(more.attrs['aria-haspopup'],'menu');create.action?.();const old=Menu.items.at(-1)!;more.action?.();assert(old.hidden);assert.equal(create.attrs['aria-expanded'],'false');assert.equal(more.attrs['aria-expanded'],'true');
 const menu=Menu.items.at(-1)!;assert.deepEqual(menu.entries.map(e=>e.title),['空间总览','笔记摘录','整理当前白板','分组预览']);const first={closed:false},second={closed:false};f.view.bound=first;menu.entries[0].action();menu.entries[1].action();menu.entries[2].action();f.view.bound=second;menu.entries[3].action();assert.deepEqual(f.calls.map(c=>c.name),['hub','excerpt','organize','sections']);assert.equal(f.calls[2].value,first);assert.equal(f.calls[3].value,second);more.focus();const doc=more.ownerDocument;menu.hide();await Promise.resolve();doc.key(key());doc.flushTasks();assert.equal(doc.activeElement,more);assert.equal(more.attrs['aria-expanded'],'false');
});
test('height changes retain the focused secondary action through its visible tools entry',async()=>{
 for(const name of ['空间总览','打开笔记摘录','整理白板','分组预览']){
  const f=fixture();await f.view.onOpen();const action=f.find(name),more=f.find('空间与白板工具'),doc=more.ownerDocument;more.visible=false;action.focus();action.visible=false;more.visible=true;doc.resize();assert.equal(doc.activeElement,more);
  more.action?.();const menu=Menu.items.at(-1)!;more.visible=false;action.visible=true;doc.resize();assert.equal(doc.activeElement,action);assert(menu.hidden,'a menu whose responsive entry disappeared must close');assert.equal(doc.listeners.size,0);
 }
});
test('height focus handoff handles browser body fallback without taking search or editor focus',async()=>{
 for(const destination of ['body','search','editor','pointer'] as const){
  const f=fixture();await f.view.onOpen();const action=f.find('整理白板'),more=f.find('空间与白板工具'),doc=more.ownerDocument;more.visible=false;action.focus();action.visible=false;more.visible=true;
  let expected:unknown=more;
  if(destination==='body'){doc.activeElement=doc.body;doc.emit('focusin');}
  else if(destination==='pointer'){doc.emit('pointerdown');doc.activeElement=doc.body;expected=doc.body;}
  else{const input=f.view.contentEl.createEl(destination==='search'?'input':'textarea');input.focus();expected=input;}
  doc.resize();assert.equal(doc.activeElement,expected);
 }
});
test('navigator resize resources retire on close and reopen and never move focus across documents',async()=>{
 const f=fixture();await f.view.onOpen();const action=f.find('整理白板'),more=f.find('空间与白板工具'),doc=more.ownerDocument;action.focus();action.visible=false;more.visible=true;more.ownerDocument=new Document();doc.resize();assert.equal(doc.activeElement,action);
 await f.view.onOpen();assert.equal(doc.resizeListeners.size,1);assert.equal(doc.documentListeners.get('focusin')?.size,1);for(const listener of doc.resizeListeners)listener();assert.equal(doc.frames.size,1);await f.view.onClose();assert.equal(doc.frames.size,0);assert.equal(doc.resizeListeners.size,0);assert.equal([...doc.documentListeners.values()].reduce((n,set)=>n+set.size,0),0);
});
test('menu actions preserve reported failures and reject retired or foreign document entries',async()=>{
 const f=fixture();await f.view.onOpen();const more=f.find('空间与白板工具');f.plugin.openSpaceHub=()=>{throw Error('hub unavailable');};f.plugin.openExcerptNote=()=>Promise.reject(Error('note unavailable'));more.action?.();let menu=Menu.items.at(-1)!;menu.entries[0].action();menu.entries[1].action();await Promise.resolve();assert.deepEqual(f.errors.map(error=>(error as Error).message),['hub unavailable','note unavailable']);
 more.ownerDocument=new Document();menu.entries[2].action();assert.equal(f.calls.length,0);await f.view.onOpen();f.find('空间与白板工具').action?.();menu=Menu.items.at(-1)!;await f.view.onClose();menu.entries[3].action();assert.equal(f.calls.length,0);
});
const key=(patch:Record<string,unknown>={})=>({key:'Escape',isComposing:false,keyCode:27,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...patch});
test('host-first Escape survives the native microtask checkpoint and consumes workspace navigation fallback',async()=>{
 const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板'),doc=create.ownerDocument;create.focus();create.action?.();const menu=Menu.items.at(-1)!;assert.equal(menu.document,doc);assert.equal(menu.parent,f.view.contentEl);
 const event=key();assert.equal(menu.hide(),menu,'native Menu hide returns the Menu, not false');await Promise.resolve();assert.equal(doc.listeners.size,1,'native callback checkpoint must not retire the later window observer');doc.key(event);assert(event.defaultPrevented&&event.stopped,'workspace bubble Escape cannot switch to a navigation leaf');assert.equal(doc.tasks.size,1);doc.flushTasks();assert.equal(doc.activeElement,create);assert.equal(doc.listeners.size,0);assert.equal(create.attrs['aria-expanded'],'false');
});
test('observer-first Escape hides the live menu and restores its exact opener on the next task',async()=>{
 const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板'),doc=create.ownerDocument;create.focus();create.action?.();const menu=Menu.items.at(-1)!,event=key();doc.key(event);assert(menu.hidden);assert(event.defaultPrevented&&event.stopped);await Promise.resolve();assert.equal(doc.listeners.size,1);doc.flushTasks();assert.equal(doc.activeElement,create);assert.equal(doc.listeners.size,0);
});
test('Escape reveals an already focused clipped opener with nearest scrolling and preserves a visible opener position',async()=>{
 for(const clipped of [true,false]){
  const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板'),doc=create.ownerDocument;create.focus();create.action?.();create.clipped=clipped;
  doc.key(key());doc.flushTasks();assert.equal(doc.activeElement,create);assert.equal(create.clipped,false);assert.equal(create.scrollMovements,clipped?1:0);assert.deepEqual(create.scrollRequests,[{block:'nearest',inline:'nearest',behavior:'instant'}]);
 }
});
test('menu selection and pointer dismissal do not refocus an old opener',async()=>{
 for(const activate of [true,false]){const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板'),doc=create.ownerDocument,other=f.find('空间总览');create.action?.();const menu=Menu.items.at(-1)!;menu.hide();if(activate)menu.entries[0].action();other.focus();doc.flushTasks();assert.equal(doc.activeElement,other);assert.equal(doc.listeners.size,0);}
});
test('IME and modified Escape are not consumed by the navigator observer',async()=>{
 for(const patch of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{key:'ArrowDown'}]){const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板'),doc=create.ownerDocument,other=f.find('空间总览');create.action?.();other.focus();const event=key(patch);doc.key(event);assert.equal(event.defaultPrevented,false);Menu.items.at(-1)!.hide();doc.flushTasks();assert.equal(doc.activeElement,other);assert.equal(doc.listeners.size,0);}
});
test('replaced menus, close, reopened view and newer focus prevent stale Escape restoration',async()=>{
 for(const change of ['replace','close','reopen','new-focus','document','window'] as const){const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板'),doc=create.ownerDocument,other=f.find('空间总览');create.focus();create.action?.();const menu=Menu.items.at(-1)!;doc.key(key());assert(menu.hidden);
  if(change==='replace'){create.action?.();Menu.items.at(-1)!.hide();}if(change==='close')await f.view.onClose();if(change==='reopen')await f.view.onOpen();if(change==='new-focus')other.focus();if(change==='document')create.ownerDocument=new Document();if(change==='window')doc.defaultView.closed=true;
  const before=doc.activeElement;doc.flushTasks();assert.equal(doc.activeElement,before);assert.equal(create.scrollRequests.length,0);assert.equal(doc.listeners.size,0);assert.equal(doc.tasks.size,0);
 }
});
test('the original quick capture command still invokes its separate modal workflow',()=>{
 const f=fixture(),source=readFileSync('src/main.ts','utf8'),registration=source.split('\n').find(line=>line.includes("{id:'quick-capture'"));assert.ok(registration,'existing quick-capture command registration remains present');
 const commands:{id:string;name:string;callback:()=>void}[]=[];
 const install=new Function(transformSync(`return function(){${registration}}`,{loader:'ts'}).code)();
 install.call({...f.plugin,addCommand:(command:{id:string;name:string;callback:()=>void})=>commands.push(command)});
 assert.equal(commands.length,1);assert.equal(commands[0].id,'quick-capture');assert.equal(commands[0].name,'快速收集一条笔记');commands[0].callback();assert.deepEqual(f.calls.map(call=>call.name),['capture']);
});
test('persistent board tools follow the latest bound board instead of the board at creation',async()=>{
 const f=fixture();await f.view.onOpen();const board=()=>({closed:false,session:{},sidebar:new Element(),refreshNavigation(){}}),first=board(),second=board();
 f.view.bind(first);f.find('整理白板').action?.();f.view.bind(second);f.find('分组预览').action?.();second.closed=true;f.find('整理白板').action?.();
 assert.equal(f.calls[0].value,first);assert.equal(f.calls[1].value,second);assert.equal(f.calls[2].value,null);
});
