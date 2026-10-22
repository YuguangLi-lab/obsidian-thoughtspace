import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

// Execute the real command and its real appearance/viewport bindings; only the
// Obsidian/DOM boundary is synthetic. Native layout and Tab traversal stay pending.
function localModule(name:string,dependencies:Record<string,any>={}){
 const module={exports:{} as Record<string,any>};
 new Function('require','module','exports',transformSync(readFileSync('src/'+name+'.ts','utf8'),{loader:'ts',format:'cjs'}).code)((key:string)=>{assert(key in dependencies,'Unexpected dependency '+key);return dependencies[key];},module,module.exports);
 return module.exports;
}
const mobile=localModule('mobile-viewport'),viewport=localModule('board-modal-viewport',{'./mobile-viewport':mobile}),density=localModule('workspace-density'),theme=localModule('ui-tokens',{'./workspace-density':density,'./interface-style-tokens':localModule('interface-style-tokens'),'./liquid-glass-runtime':localModule('liquid-glass-runtime',{'./glass-lens-map':localModule('glass-lens-map')})});
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async fileAllCards() {'),end=source.indexOf('\n  async fileOldJournals(',start);
assert(start>=0&&end>start,'Locate actual filing command');
const command=transformSync('class Plugin {'+source.slice(start,end)+'};return Plugin;',{loader:'ts'}).code;
class File {constructor(public path:string){}}
function fixture(failures=1,popout=false){
 class Events {
  listeners=new Map<string,Set<(event:any)=>void>>();
  addEventListener(type:string,fn:(event:any)=>void){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type)!.add(fn);}
  removeEventListener(type:string,fn:(event:any)=>void){this.listeners.get(type)?.delete(fn);}
  emit(type:string,event:any={}){for(const fn of [...this.listeners.get(type)||[]])fn(event);}
  count(){return [...this.listeners.values()].reduce((sum,set)=>sum+set.size,0);}
 }
 const frames=new Map<number,()=>void>();let nextFrame=0,windowFocused=true,throwOpen=false;
 const vv=Object.assign(new Events(),{height:380,offsetTop:17,scale:1});
 const win=Object.assign(new Events(),{closed:false,innerHeight:844,visualViewport:vv,requestAnimationFrame:(fn:()=>void)=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:(id:number)=>frames.delete(id)});
 const doc:any=Object.assign(new Events(),{defaultView:win,activeElement:null,hasFocus:()=>windowFocused,querySelector:()=>appearance});
 const other:any={defaultView:{closed:false},activeElement:null,hasFocus:()=>false,addEventListener(){},removeEventListener(){}};
 class Element {
  children:Element[]=[];parent?:Element;isConnected=true;disabled=false;shown=true;textContent='';attrs:Record<string,string>={};dataset:Record<string,string>={};focuses=0;lastFocusOptions?:FocusOptions;onclick?:()=>void;scrollTop=0;clientHeight=200;
  classes=new Set<string>();classList={add:(s:string)=>this.classes.add(s),remove:(s:string)=>this.classes.delete(s),contains:(s:string)=>this.classes.has(s)};
  properties=new Map<string,string>();style={getPropertyValue:(s:string)=>this.properties.get(s)||'',setProperty:(s:string,v:string)=>this.properties.set(s,v),removeProperty:(s:string)=>this.properties.delete(s)};
  constructor(readonly tag='div',public ownerDocument=doc,options:any={}){this.textContent=options.text||'';this.attrs={...options.attr};if(options.cls)this.addClass(options.cls);}
  createEl(tag:string,options:any={}){const e=new Element(tag,this.ownerDocument,options);e.parent=this;this.children.push(e);return e;}
  createDiv(options:any={}){return this.createEl('div',options);}addClass(s:string){for(const cls of s.split(' '))this.classes.add(cls);}setText(s:string){this.textContent=s;}
  all():Element[]{return this.children.flatMap(e=>[e,...e.all()]);}contains(e:unknown):boolean{return this===e||this.children.some(child=>child.contains(e));}
  getClientRects(){return this.isConnected&&this.shown?[this.getBoundingClientRect()]:[];}
  getBoundingClientRect(){return{top:0,left:0,right:390,bottom:this.clientHeight,width:390,height:this.clientHeight};}
  get scrollHeight(){return this.children.reduce((n,e)=>n+(e.tag==='p'?60:44),0);}
  closest(_selector:string){return null;}
  getAttribute(key:string){if(key.startsWith('data-'))return this.dataset[key.slice(5).replace(/-([a-z])/g,(_,v:string)=>v.toUpperCase())]??null;return this.attrs[key]??null;}
  setAttribute(key:string,value:string){if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,v:string)=>v.toUpperCase())]=value;else this.attrs[key]=value;}
  removeAttribute(key:string){if(key.startsWith('data-'))delete this.dataset[key.slice(5).replace(/-([a-z])/g,(_,v:string)=>v.toUpperCase())];else delete this.attrs[key];}
  focus(options?:FocusOptions){if(!this.isConnected||this.disabled)return;this.focuses++;this.lastFocusOptions=options;doc.activeElement=this;doc.emit('focusin',{target:this});if(!options?.preventScroll){let parent=this.parent;while(parent){if(parent.scrollHeight>parent.clientHeight)parent.scrollTop=parent.scrollHeight-parent.clientHeight;parent=parent.parent;}}}
  click(){if(!this.disabled)this.onclick?.();}
  detach(){for(const e of [this,...this.all()])e.isConnected=false;if(this.contains(doc.activeElement))doc.activeElement=doc.body;}
  empty(){for(const e of this.children)e.detach();this.children=[];}
  adopt(document:any){for(const e of [this,...this.all()])e.ownerDocument=document;}
 }
 doc.body=new Element('body');doc.activeElement=doc.body;other.body=new Element('body',other);other.activeElement=other.body;
 const appearance=new Element();appearance.dataset={density:'compact',surface:'paper',accent:'terracotta',glass:'false'};
 const owner=new Element(),opener=owner.createEl('button'),outside=doc.body.createEl('input'),file=new File('原白板.md');
 class View {containerEl=owner;file=file;session={};leaf:any;}
 const view=new View(),leaf={view},fallback:any[]=[];view.leaf=leaf;
 const workspace:any={activeLeaf:leaf,getActiveViewOfType:(Type:typeof View)=>workspace.activeLeaf?.view instanceof Type?workspace.activeLeaf.view:null,setActiveLeaf:(target:unknown,options:unknown)=>{fallback.push({target,options});owner.focus();}};
 const cards=[new File('卡片/移动.md'),new File('卡片/保留.md'),...Array.from({length:failures},(_,i)=>new File('卡片/失败'+i+'.md')),new File('其他/不处理.md')],files=new Map([file,...cards].map(f=>[f.path,f])),calls:string[]=[],notices:any[]=[],modals:Modal[]=[];
 const app={workspace,vault:{getMarkdownFiles:()=>cards,getAbstractFileByPath:(path:string)=>files.get(path)??null},metadataCache:{getFileCache:(card:File)=>({tags:card.path==='卡片/移动.md'?['#标签']:[]})}};
 class Modal {
  shouldRestoreSelection=true;savedFocus:any;hostRestoreCalls=0;
  containerEl=new Element('div',popout?other:doc);modalEl=this.containerEl.createDiv();titleEl=this.modalEl.createEl('h2');contentEl=this.modalEl.createDiv();delayed=false;
  constructor(readonly app:unknown){modals.push(this);this.containerEl.style.setProperty('--ts-modal-visible-top','5px');this.containerEl.style.setProperty('--ts-visible-height','700px');this.containerEl.dataset.tsKeyboard='previous';}
  onOpen(){}onClose(){}
  open(){this.savedFocus=doc.activeElement;this.containerEl.adopt(doc);doc.activeElement=doc.body;this.onOpen();if(throwOpen)throw Error('open failed');}
  close(){if(this.delayed)this.restoreHost();else this.finishClose();}
  finishClose(){this.containerEl.detach();this.onClose();if(!this.delayed)this.restoreHost();}
  restoreHost(){if(this.shouldRestoreSelection&&this.savedFocus?.isConnected){this.hostRestoreCalls++;this.savedFocus.focus();}}
 }
 const Plugin=new Function('Modal','View','TFile','Notice','isWorkspaceFile','getAllTags','themeSurface','bindBoardModalViewport',command)(Modal,View,File,class{constructor(text:string,timeout:number){notices.push({text,timeout});}},()=>true,(cache:any)=>cache.tags,theme.themeSurface,viewport.bindBoardModalViewport);
 const plugin=new Plugin();plugin.app=app;plugin.settings={cardFolder:'卡片'};
 plugin.fileCard=async(card:File,tag:string)=>{calls.push('fileCard '+card.path+' '+tag);return true;};plugin.serializeFiling=async(run:()=>Promise<boolean>)=>{calls.push('serialize');return run();};plugin.moveFiled=async(card:File,destination:string)=>{calls.push('moveFiled '+card.path+' '+destination);if(card.path.includes('失败'))throw Error('磁盘失败');return false;};
 const close=()=>{const button=modals[0].contentEl.all().find(e=>e.tag==='button'&&e.textContent==='关闭');assert(button,'Real named close control');return button;};
 const flush=()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn();}};
 return{plugin,doc,win,vv,frames,flush,owner,opener,outside,file,view,leaf,workspace,fallback,files,calls,notices,modals,close,appearance,setWindowFocus:(v:boolean)=>windowFocused=v,setThrowOpen:()=>throwOpen=true};
}
async function opened(){const f=fixture();f.opener.focus();const result=await f.plugin.fileAllCards();return{...f,result};}
test('real filing command preserves data sequence/counts and presents every failure with a real focused Close',async()=>{const f=await opened();assert.deepEqual(f.result,{moved:1,skipped:1,failed:['卡片/失败0.md：Error: 磁盘失败']});assert.deepEqual(f.calls,['fileCard 卡片/移动.md #标签','serialize','moveFiled 卡片/保留.md 卡片/未分类','serialize','moveFiled 卡片/失败0.md 卡片/未分类']);assert.deepEqual(f.notices,[{text:'卡片整理完成：移动 1，保留 1，失败 1',timeout:8000}]);assert.equal(f.modals.length,1);assert.equal(f.modals[0].titleEl.textContent,'以下文件未完成归档');assert.deepEqual(f.modals[0].contentEl.children.filter(e=>e.tag==='p').map(e=>e.textContent),f.result.failed);assert.equal(f.close().attrs.type,'button');assert.equal(f.close().disabled,false);assert.equal(f.doc.activeElement,f.close());assert.equal(f.close().getClientRects().length,1);});
test('Close returns to exact opener, leaves data unchanged, and releases actual viewport/focus bindings',async()=>{const f=await opened(),before=[...f.calls];f.close().click();assert.equal(f.doc.activeElement,f.opener);assert.equal(f.opener.focuses,2);assert.deepEqual(f.opener.lastFocusOptions,{preventScroll:true});assert.deepEqual(f.calls,before);assert.equal(f.doc.count(),0);assert.equal(f.win.count(),0);assert.equal(f.vv.count(),0);assert.equal(f.frames.size,0);});
test('command entry without a control returns only to unchanged owner',async()=>{const f=fixture();await f.plugin.fileAllCards();f.close().click();assert.deepEqual(f.fallback,[{target:f.leaf,options:{focus:true}}]);});
test('empty workspace has a usable Close and creates no owner return',async()=>{const f=fixture();f.workspace.activeLeaf=null;await f.plugin.fileAllCards();assert.equal(f.doc.activeElement,f.close());f.close().click();assert.equal(f.fallback.length,0);});
for(const change of ['leaf','view','file','path','session','document','window','background','deletedFile','detachedOwner'] as const)test('late close cannot steal focus after '+change,async()=>{const f=await opened();if(change==='leaf')f.workspace.activeLeaf={view:{}};if(change==='view')f.leaf.view={} as never;if(change==='file')f.view.file=new File('新.md');if(change==='path')f.file.path='移动.md';if(change==='session')f.view.session={};if(change==='document')f.owner.ownerDocument={};if(change==='window')f.win.closed=true;if(change==='background')f.setWindowFocus(false);if(change==='deletedFile')f.files.delete(f.file.path);if(change==='detachedOwner')f.owner.detach();f.close().click();assert.equal(f.opener.focuses,1);assert.equal(f.fallback.length,0);assert.equal(f.doc.count(),0);assert.equal(f.vv.count(),0);});
test('intentional outside focus revokes return even when it later becomes BODY',async()=>{const f=await opened();f.outside.focus();f.doc.activeElement=f.doc.body;f.close().click();assert.equal(f.opener.focuses,1);assert.equal(f.fallback.length,0);});
test('outside focus during delayed native close remains untouched',async()=>{const f=await opened();f.modals[0].delayed=true;f.close().click();f.outside.focus();f.modals[0].finishClose();assert.equal(f.doc.activeElement,f.outside);assert.equal(f.opener.focuses,1);});
test('deleted or hidden original control does not invent a fallback focus',async()=>{for(const removed of [true,false]){const f=await opened();if(removed)f.opener.detach();else f.opener.shown=false;f.close().click();assert.equal(f.opener.focuses,1);assert.equal(f.fallback.length,0);}});
test('repeated close is inert after disposal',async()=>{const f=await opened();f.close().click();f.modals[0].onClose();assert.equal(f.opener.focuses,2);assert.equal(f.doc.count(),0);assert.equal(f.frames.size,0);});
test('real theme and visualViewport binding affect only this modal and restore prior attributes/styles',async()=>{const f=await opened(),modal=f.modals[0],hostBefore={...f.appearance.dataset};assert(modal.modalEl.classes.has('ts-filing-failures-modal'));assert(modal.modalEl.classes.has('ts-ui-modal'));assert.deepEqual(modal.modalEl.dataset,{density:'compact',surface:'paper',accent:'terracotta',glass:'false'});assert.equal(modal.containerEl.style.getPropertyValue('--ts-modal-visible-top'),'17px');assert.equal(modal.containerEl.style.getPropertyValue('--ts-visible-height'),'380px');f.vv.offsetTop=38;f.vv.height=320;f.vv.emit('resize');f.flush();assert.equal(modal.containerEl.style.getPropertyValue('--ts-modal-visible-top'),'38px');assert.equal(modal.containerEl.style.getPropertyValue('--ts-visible-height'),'320px');f.vv.emit('scroll');assert(f.frames.size>0);f.close().click();assert.equal(modal.containerEl.style.getPropertyValue('--ts-modal-visible-top'),'5px');assert.equal(modal.containerEl.style.getPropertyValue('--ts-visible-height'),'700px');assert.equal(modal.containerEl.dataset.tsKeyboard,'previous');assert.equal(modal.containerEl.getAttribute('data-ts-compact'),null);assert(!modal.containerEl.classes.has('ts-board-modal-viewport'));assert.deepEqual(f.appearance.dataset,hostBefore);assert(!f.owner.classes.has('ts-ui-modal'));assert.equal(f.vv.count()+f.win.count()+f.doc.count()+f.frames.size,0);});
test('long failure list permits browser focus reveal instead of forcing an offscreen focused Close',async()=>{const f=fixture(80);await f.plugin.fileAllCards();const modal=f.modals[0];assert.equal(modal.contentEl.children.filter(e=>e.tag==='p').length,80);assert(modal.contentEl.scrollHeight>modal.contentEl.clientHeight);assert.equal(f.doc.activeElement,f.close());assert.equal(f.close().lastFocusOptions?.preventScroll,undefined);assert.equal(modal.contentEl.scrollTop,modal.contentEl.scrollHeight-modal.contentEl.clientHeight);});
test('zero failures retains the command result without any modal or listeners',async()=>{const f=fixture(0);assert.deepEqual(await f.plugin.fileAllCards(),{moved:1,skipped:1,failed:[]});assert.equal(f.modals.length,0);assert.equal(f.doc.count()+f.vv.count()+f.win.count(),0);});
test('opening failure propagates while releasing bindings already installed by onOpen',async()=>{const f=fixture();f.setThrowOpen();await assert.rejects(f.plugin.fileAllCards(),/open failed/);assert.equal(f.doc.count()+f.vv.count()+f.win.count()+f.frames.size,0);});

test('filing failures disable native post-onClose restoration before opening',async()=>{const f=await opened();assert.equal(f.modals[0].shouldRestoreSelection,false);f.outside.focus();f.close().click();assert.equal(f.doc.activeElement,f.outside);assert.equal(f.modals[0].hostRestoreCalls,0);});

test('filing failures capture their actual popout owner before native adoption and restore only that opener',async()=>{const f=fixture(1,true);f.opener.focus();await f.plugin.fileAllCards();assert.equal(f.doc.activeElement,f.close());assert.equal(f.modals[0].containerEl.ownerDocument,f.doc);f.close().click();assert.equal(f.doc.activeElement,f.opener);assert.equal(f.modals[0].hostRestoreCalls,0);assert.equal(f.doc.count()+f.win.count()+f.vv.count(),0);});
