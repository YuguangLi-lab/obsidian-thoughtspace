import * as density from '../src/workspace-density';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as mediaSource from '../src/media-source';
import * as previewSource from '../src/media-preview-source';
import {MediaDraftStore,type StoredMediaDraft} from '../src/media-draft-store';
import type {MediaCardState} from '../src/media-card-player';

class TFile {
 stat={mtime:100,size:1000};
 constructor(public path:string){}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
 get extension(){return this.path.split('.').at(-1)!;}
}
let nextDocument=0;
class ObjectURLs {
 private documentId=++nextDocument;
 created:{url:string;blob:Blob}[]=[];revoked:string[]=[];active=new Map<string,Blob>();failCreate=false;
 createObjectURL(blob:Blob){if(this.failCreate)throw Error('URL allocation failed');const url=`blob:test-${this.documentId}-${this.created.length}`;this.created.push({url,blob});this.active.set(url,blob);return url;}
 revokeObjectURL(url:string){this.revoked.push(url);this.active.delete(url);}
}
class Element {
 children:Element[]=[];dataset:Record<string,string>={};attributes=new Map<string,string>();
 parentElement?:Element;
 ownerDocument:{defaultView:{setTimeout:typeof setTimeout;clearTimeout:typeof clearTimeout;URL:ObjectURLs};activeElement?:Element;body?:Element}={defaultView:{setTimeout,clearTimeout,URL:new ObjectURLs()}};
 className='';textContent='';title='';value='';readOnly=false;scrollTop=0;connectedRoot=false;focusVisible=true;focusCalls:unknown[]=[];
 private disabledValue=false;private hiddenValue=false;
 get disabled(){return this.disabledValue;}set disabled(value:boolean){this.disabledValue=value;if(value&&this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=this.ownerDocument.body;}
 get hidden(){return this.hiddenValue;}set hidden(value:boolean){this.hiddenValue=value;if(value&&this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=this.ownerDocument.body;}
 get isConnected():boolean{return this.connectedRoot||!!this.parentElement?.isConnected;}
 matches(selector:string){return selector===':focus-visible'&&this.focusVisible;}
 scrollCalls:unknown[]=[];style={values:new Map<string,string>(),setProperty(key:string,value:string){this.values.set(key,value);},getPropertyValue(key:string){return this.values.get(key)||'';}};
 get src(){return this.attributes.get('src')||'';}set src(value:string){this.attributes.set('src',value);}
 onclick?:(event?:any)=>unknown;oninput?:()=>unknown;onkeydown?:(event:unknown)=>unknown;
 rect={left:0,right:32,top:0,bottom:32,width:32,height:32};open=false;
 listeners=new Map<string,((event?:any)=>void)[]>();
 addEventListener(type:string,fn:(event?:any)=>void){this.listeners.set(type,[...this.listeners.get(type)||[],fn]);}
 dispatch(type:string,event?:unknown){for(const fn of this.listeners.get(type)||[])fn(event);}
 click(event?:unknown){if(!this.disabled)return this.onclick?.(event);}
 getBoundingClientRect(){return this.rect;}
 createDiv(options?:unknown){return this.createEl('div',options);}
 createSpan(options?:unknown){return this.createEl('span',options);}
 createEl(tag:string,options?:unknown){const node=new Element();node.parentElement=this;node.ownerDocument=this.ownerDocument;node.attributes.set('tag',tag);if(typeof options==='string')node.className=options;else if(options&&typeof options==='object'){const o=options as {cls?:string;text?:string;value?:string;type?:string;attr?:Record<string,string>};node.className=o.cls||'';node.textContent=o.text||'';node.value=o.value||'';if(o.type)node.setAttribute('type',o.type);for(const[k,v]of Object.entries(o.attr||{}))node.setAttribute(k,v);}this.children.push(node);return node;}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 contains(node:Element){return this.all().includes(node);}
 querySelector(selector:string){return this.all().find(node=>selector.startsWith('.')?node.className.split(' ').includes(selector.slice(1)):node.attributes.get('tag')===selector);}
 querySelectorAll(selector:string){return selector==='.ts-media-workspace__positions button'?(this.querySelector('.ts-media-workspace__positions')?.children||[]):[];}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];this.textContent='';}
 append(...nodes:Element[]){for(const node of nodes){node.remove();node.parentElement=this;node.ownerDocument=this.ownerDocument;this.children.push(node);}}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 addClass(name:string){this.className+=' '+name;}
 removeClass(name:string){this.className=this.className.split(' ').filter(part=>part!==name).join(' ');}
 setAttribute(key:string,value:string){this.attributes.set(key,value);}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 removeAttribute(key:string){this.attributes.delete(key);}
 focus(options?:unknown){if(this.hidden||this.disabled)return;this.focusCalls.push(options);this.ownerDocument.activeElement=this;}
 scrollIntoView(options:unknown){this.scrollCalls.push(options);}
}
type Moment={id:string;time:number;text:string;line:number;image?:string;key?:string;notePath?:string};
function button(root:Element,label:string){const found=root.all().find(node=>node.attributes.get('tag')==='button'&&node.attributes.get('aria-label')===label);assert.ok(found,`button ${label} exists`);return found;}
function rows(view:any):Element[]{return view.timeline.children.filter((el:Element)=>el.className==='ts-media-workspace__moment');}
type Hooks={initialState?:MediaCardState;state:(state:MediaCardState)=>void;capture:(time:number)=>Promise<unknown>;frame:(blob:Blob,time:number)=>Promise<unknown>;frameCaptureState?:(busy:boolean,time:number)=>void};
type Draft={id:string;time:number;text:string;image?:Blob;source?:{path:string;mtime:number;size:number}};
async function frame(hooks:Hooks,image:Blob,time:number){try{hooks.frameCaptureState?.(true,time);await hooks.frame(image,time);}finally{hooks.frameCaptureState?.(false,time);}}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const notices:string[]=[];
class ItemView {
 app:any;contentEl=new Element();containerEl=new Element();events:unknown[]=[];
 constructor(leaf:{app:unknown}){this.app=leaf.app;this.contentEl.connectedRoot=true;const body=new Element();body.connectedRoot=true;body.attributes.set('tag','body');body.ownerDocument=this.contentEl.ownerDocument;this.contentEl.ownerDocument.body=body;this.contentEl.ownerDocument.activeElement=body;}
 registerEvent(event:unknown){this.events.push(event);}
}
class Modal {
 modalEl=new Element();contentEl=new Element();opened=false;closed=false;
 constructor(public app:any){app.modals.push(this);}
 onOpen(){}onClose(){}
 open(){if(this.app.failModalOpen)throw Error('Modal unavailable');this.opened=true;this.onOpen();}
 close(){if(this.closed)return;this.closed=true;this.onClose();}
}
class MenuItem {
 title='';icon:string|null=null;checked:boolean|null=null;disabled=false;callback?:(event?:unknown)=>unknown;
 setTitle(value:string){this.title=value;return this;}setIcon(value:string|null){this.icon=value;return this;}setChecked(value:boolean|null){this.checked=value;return this;}setDisabled(value:boolean){this.disabled=value;return this;}
 onClick(callback:(event?:unknown)=>unknown){this.callback=callback;return this;}
 activate(event?:unknown){if(!this.disabled)return this.callback?.(event);}
}
class Menu {
 static instances:Menu[]=[];
 useNativeMenu=true;
 items:MenuItem[]=[];separators=0;parent?:Element;mouseEvent?:unknown;position?:{x:number;y:number};document?:unknown;hidden=false;hideCount=0;
 constructor(){Menu.instances.push(this);}
 setUseNativeMenu(value:boolean){this.useNativeMenu=value;return this;}
 setParentElement(parent:Element){this.parent=parent;return this;}
 addItem(fn:(item:MenuItem)=>unknown){const item=new MenuItem();this.items.push(item);fn(item);return this;}
 addSeparator(){this.separators++;return this;}
 showAtMouseEvent(event:unknown){this.mouseEvent=event;return this;}
 showAtPosition(position:{x:number;y:number},document:unknown){this.position=position;this.document=document;return this;}
 hide(){this.hidden=true;this.hideCount++;return this;}
}
function more(view:any,event?:unknown){const before=Menu.instances.length;button(view.contentEl,'更多媒体操作').click(event);assert.equal(Menu.instances.length,before+1);const menu=Menu.instances.at(-1)!;assert.equal(menu.useNativeMenu,false);return menu;}
function menuItem(menu:Menu,title:string){const item=menu.items.find(value=>value.title===title);assert.ok(item,`menu item ${title} exists`);return item;}
async function settled(){await new Promise<void>(resolve=>setImmediate(resolve));}
const compiled=transformSync(readFileSync(process.env.MEDIA_TIMELINE_READ_TEST_SOURCE||'src/media-workspace-view.ts','utf8'),{loader:'ts',format:'cjs'}).code;
const module={exports:{}};
new Function('require','module','exports',compiled)((name:string)=>name==='obsidian'?{ItemView,Menu,Modal,TFile,setIcon:()=>{},Notice:class{constructor(text:string){notices.push(text);}}}:name==='./workspace-density'?density:name==='./media-source'?mediaSource:name==='./media-preview-source'?previewSource:undefined,module,module.exports);
const {MediaWorkspaceView} = module.exports as {MediaWorkspaceView:new(leaf:unknown,host:unknown)=>any};
function fixture(drafts?:MediaDraftStore){
 const a=new TFile('media/A.mp4'),b=new TFile('media/B.mp3'),noteA=new TFile('notes/A.md'),noteB=new TFile('notes/B.md');
 const files=new Map([a,b,noteA,noteB].map(file=>[file.path,file]));
 const events=new Map<string,((...args:any[])=>void)[]>();
 const resourceReads:TFile[]=[];let layoutSaves=0;
 const app={modals:[] as Modal[],failModalOpen:false,vault:{getAbstractFileByPath:(path:string)=>files.get(path),getResourcePath:(file:TFile)=>{resourceReads.push(file);return`app://vault/${encodeURIComponent(file.path)}`;},on:(type:string,fn:(...args:any[])=>void)=>{const list=events.get(type)||[];list.push(fn);events.set(type,list);return{type,fn};}},workspace:{requestSaveLayout:()=>{layoutSaves++;}}};
 const mounts:{file:TFile;hooks:Hooks;disposed:number;plays:number;seeks:number[]}[]=[],saves:{file:TFile;data:Draft}[]=[],opens:unknown[][]=[],sent:{file:TFile;moment?:Moment}[]=[];
 let pick:((file:TFile)=>void)|undefined,pickCount=0;
 let read=(file:TFile):Promise<{note?:TFile;entries:Moment[];warnings?:string[]}>=>(Promise.resolve({entries:[],note:file===a?noteA:noteB}));
 let write=async(file:TFile,_data:Draft)=>({note:file===a?noteA:noteB});
 const host={
  drafts,recoverDrafts:undefined as (()=>void)|undefined,
  open:async(...args:unknown[])=>{opens.push(args);},pick:(done:(file:TFile)=>void)=>{pick=done;pickCount++;},
  mount:(_el:unknown,file:TFile,hooks:Hooks)=>{const mount={file,hooks,disposed:0,plays:0,seeks:[] as number[]};mounts.push(mount);return{dispose:()=>{mount.disposed++;hooks.frameCaptureState?.(false,0);hooks.state({time:33,rate:1.5,volume:.4});},seek:(time:number)=>{mount.seeks.push(time);hooks.state({...hooks.initialState||{rate:1,volume:1},time} as MediaCardState);},play:()=>mount.plays++,pause:()=>{}};},
  moments:(file:TFile)=>read(file),saveMoment:(file:TFile,data:Draft)=>{saves.push({file,data});return write(file,data);},openNote:async()=>{},sendToBoard:async(file:TFile,moment?:Moment)=>{sent.push({file,moment});},
 };
 const view=()=>new MediaWorkspaceView({app},host);
 return{a,b,noteA,noteB,app,files,events,host,view,mounts,saves,opens,sent,resourceReads,get layoutSaves(){return layoutSaves;},get pickCount(){return pickCount;},choose:(file:TFile)=>pick?.(file),setRead:(fn:typeof read)=>{read=fn;},setWrite:(fn:typeof write)=>{write=fn;}};
}

// New read-presentation contracts execute the complete production view. The
// explicit source override pins the frozen baseline for reproducible RED only.
function feedback(v:any){return v.contentEl.querySelector('.ts-media-workspace__read-feedback') as Element|undefined;}
function feedbackText(v:any){return v.contentEl.querySelector('.ts-media-workspace__read-feedback-text') as Element|undefined;}
function noFalseEmpty(v:any){assert.equal(v.timeline.querySelector('.ts-media-workspace__no-records'),undefined);assert.equal(v.pageInfo.textContent,'');assert.equal(v.timelineCount.textContent,'');assert.equal(v.panelCount.textContent,'');}
const records:Moment[]=[{id:'known',time:2,text:'资料中的已有摘录',line:1}];

test('first deferred read with existing records exposes loading outside the busy list and no definite zero',async()=>{const f=fixture(),d=deferred<{entries:Moment[]}>();f.setRead(()=>d.promise);const v=f.view(),opening=v.setState({file:f.a.path});assert.equal(v.timeline.getAttribute('aria-busy'),'true');noFalseEmpty(v);const live=feedback(v)!;assert.ok(live);assert.equal(live.hidden,false);assert.match(feedbackText(v)!.textContent,/正在读取时间轴/);assert.equal(live.getAttribute('aria-live'),'polite');assert.equal(v.timeline.contains(live),false);assert.equal(v.busy,false);d.resolve({entries:records});await opening;assert.equal(rows(v).length,1);assert.equal(v.pageInfo.textContent,'1–1 / 1');assert.equal(feedback(v)!.hidden,true);assert.equal(v.timeline.getAttribute('aria-busy'),null);await v.onClose();});

test('only a successfully read empty result presents the real empty state and zero count',async()=>{const f=fixture(),v=f.view();await v.setState({file:f.a.path});assert.ok(v.timeline.querySelector('.ts-media-workspace__no-records'));assert.equal(v.pageInfo.textContent,'0 条摘录');assert.ok(feedback(v));assert.equal(feedback(v)!.hidden,true);assert.equal(v.timelineLoaded,true);await v.onClose();});

test('initial failure presents no false empty and the retry button uses the existing read path',async()=>{const f=fixture(),v=f.view();let reads=0;f.setRead(async()=>{reads++;if(reads===1)throw Error('owned failure');return{note:f.noteA,entries:records};});await v.setState({file:f.a.path});noFalseEmpty(v);assert.equal(feedback(v)!.hidden,false);assert.match(feedbackText(v)!.textContent,/读取失败/);assert.equal(feedback(v)!.dataset.readState,'error');assert.equal(v.timeline.getAttribute('aria-busy'),null);button(v.contentEl,'重新读取时间轴').click();await settled();assert.equal(reads,2);assert.equal(rows(v).length,1);assert.equal(feedback(v)!.hidden,true);assert.equal(v.note,f.noteA);assert.equal(f.saves.length,0);assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].plays,0);await v.onClose();});

test('refresh pending and failed retains existing row nodes/counts with explicit update feedback',async()=>{const f=fixture(),v=f.view();f.setRead(async()=>({entries:records}));await v.setState({file:f.a.path});const original=rows(v)[0],d=deferred<{entries:Moment[]}>();f.setRead(()=>d.promise);const refresh=v.refreshMoments();assert.equal(rows(v)[0],original);assert.equal(v.pageInfo.textContent,'1–1 / 1');assert.match(feedbackText(v)!.textContent,/正在更新时间轴/);assert.equal(v.timeline.getAttribute('aria-busy'),'true');d.reject(Error('refresh failed'));await refresh;assert.equal(rows(v)[0],original);assert.equal(v.pageInfo.textContent,'1–1 / 1');assert.match(feedbackText(v)!.textContent,/更新失败.*已有摘录/);assert.equal(v.timeline.getAttribute('aria-busy'),null);await v.onClose();});

test('successful refresh clears its feedback and applies only the received replacement rows',async()=>{const f=fixture(),v=f.view();f.setRead(async()=>({entries:records}));await v.setState({file:f.a.path});const d=deferred<{entries:Moment[]}>();f.setRead(()=>d.promise);const job=v.refreshMoments();assert.match(feedbackText(v)!.textContent,/更新/);d.resolve({entries:[{id:'new',time:3,text:'新摘录',line:2}]});await job;assert.equal(v.entries[0].id,'new');assert.equal(feedback(v)!.hidden,true);assert.equal(feedbackText(v)!.textContent,'');assert.equal(v.timeline.getAttribute('aria-busy'),null);await v.onClose();});

for(const outcome of ['resolve','reject'] as const)test('stale previous-source '+outcome+' cannot overwrite current pending feedback or clear busy',async()=>{const f=fixture(),v=f.view(),a=deferred<{entries:Moment[]}>(),b=deferred<{entries:Moment[]}>();f.setRead(file=>file===f.a?a.promise:b.promise);const first=v.setState({file:f.a.path}),second=v.setState({file:f.b.path});const current=feedbackText(v);assert.ok(current);const text=current!.textContent;if(outcome==='resolve')a.resolve({entries:records});else a.reject(Error('stale error'));await first;assert.equal(feedbackText(v),current);assert.equal(current!.textContent,text);assert.equal(v.timeline.getAttribute('aria-busy'),'true');noFalseEmpty(v);b.resolve({entries:[]});await second;assert.equal(feedback(v)!.hidden,true);assert.equal(v.timeline.getAttribute('aria-busy'),null);assert.equal(f.saves.length,0);await v.onClose();});

test('a superseded same-source request cannot finalize the newer busy read',async()=>{const f=fixture(),v=f.view();await v.setState({file:f.a.path});const a=deferred<{entries:Moment[]}>(),b=deferred<{entries:Moment[]}>();let reads=0;f.setRead(()=>++reads===1?a.promise:b.promise);const older=v.refreshMoments(),newer=v.refreshMoments();a.resolve({entries:records});await older;assert.equal(v.timeline.getAttribute('aria-busy'),'true');assert.match(feedbackText(v)!.textContent,/更新/);assert.deepEqual(v.entries,[]);b.resolve({entries:records});await newer;assert.equal(v.timeline.getAttribute('aria-busy'),null);assert.equal(feedback(v)!.hidden,true);await v.onClose();});

for(const outcome of ['resolve','reject'] as const)test('closing a pending '+outcome+' cannot later write feedback or rebuild detached content',async()=>{const f=fixture(),v=f.view(),d=deferred<{entries:Moment[]}>();f.setRead(()=>d.promise);const opening=v.setState({file:f.a.path}),status=feedbackText(v);assert.ok(status);const text=status!.textContent;await v.onClose();if(outcome==='resolve')d.resolve({entries:records});else d.reject(Error('closed error'));await opening;assert.equal(status!.textContent,text);assert.equal(v.contentEl.children.length,0);assert.equal(f.saves.length,0);assert.equal(f.mounts[0].disposed,1);});

test('controls rendering during the first read never reintroduces definite filter-empty copy',async()=>{const f=fixture(),v=f.view(),d=deferred<{entries:Moment[]}>();f.setRead(()=>d.promise);const opening=v.setState({file:f.a.path});v.query='no-matching-fixture';v.recordFilter='image';v.renderTimeline();noFalseEmpty(v);assert.match(feedbackText(v)!.textContent,/读取/);d.resolve({entries:records});await opening;assert.ok(v.timeline.querySelector('.ts-media-workspace__no-records'));assert.equal(v.pageInfo.textContent,'0 条摘录');await v.onClose();});

test('timeline failure does not overwrite the independent save-result feedback',async()=>{const f=fixture(),v=f.view();await v.setState({file:f.a.path});v.message('保存未完成，文字、截图与记录时间已保留，可重试。');f.setRead(async()=>{throw Error('timeline failed')});await v.refreshMoments();assert.equal(v.status.textContent,'保存未完成，文字、截图与记录时间已保留，可重试。');assert.match(feedbackText(v)!.textContent,/更新失败/);assert.equal(v.busy,false);assert.equal(f.saves.length,0);await v.onClose();});


async function failedRetryFixture(){const f=fixture(),v=f.view();f.setRead(async()=>{throw Error('first read error');});await v.setState({file:f.a.path});const retry=button(v.contentEl,'重新读取时间轴'),d=deferred<{entries:Moment[]}>();f.setRead(()=>d.promise);return{f,v,retry,d,doc:v.contentEl.ownerDocument};}

test('keyboard retry transfers lost launcher focus to the stable search during loading, with no late focus steal',async()=>{const{v,retry,d,doc}=await failedRetryFixture();retry.focus();retry.click({detail:0});assert.equal(retry.hidden,true);assert.equal(retry.disabled,true);assert.equal(doc.activeElement,v.searchInput);assert.deepEqual(v.searchInput.focusCalls.at(-1),{preventScroll:true});assert.equal(v.timeline.getAttribute('aria-busy'),'true');const external=new Element();external.ownerDocument=doc;external.focus();d.resolve({entries:records});await settled();assert.equal(doc.activeElement,external);assert.equal(rows(v).length,1);await v.onClose();});

test('pointer retry never redirects even a focus-visible launcher to search',async()=>{const{v,retry,d,doc}=await failedRetryFixture();retry.focus();retry.click({detail:1});assert.equal(doc.activeElement,doc.body);assert.equal(v.searchInput.focusCalls.length,0);d.resolve({entries:records});await settled();assert.equal(doc.activeElement,doc.body);await v.onClose();});

test('a zero-detail action without visible keyboard focus does not restore a pointer launcher',async()=>{const{v,retry,d,doc}=await failedRetryFixture();retry.focusVisible=false;retry.focus();retry.click({detail:0});assert.equal(doc.activeElement,doc.body);assert.equal(v.searchInput.focusCalls.length,0);d.resolve({entries:records});await settled();await v.onClose();});

test('programmatic retry leaves existing composer focus untouched',async()=>{const{v,retry,d,doc}=await failedRetryFixture();v.input.focus();retry.click({detail:0});assert.equal(doc.activeElement,v.input);assert.equal(v.searchInput.focusCalls.length,0);d.resolve({entries:records});await settled();assert.equal(doc.activeElement,v.input);await v.onClose();});

test('a synchronous read callback that focuses another control wins over keyboard retry restoration',async()=>{const{f,v,retry,d,doc}=await failedRetryFixture();const external=new Element();external.ownerDocument=doc;f.setRead(()=>{external.focus();return d.promise;});retry.focus();retry.click({detail:0});assert.equal(doc.activeElement,external);assert.equal(v.searchInput.focusCalls.length,0);d.resolve({entries:records});await settled();assert.equal(doc.activeElement,external);await v.onClose();});

test('keyboard retry does not focus a search detached synchronously by its read callback',async()=>{const{f,v,retry,d,doc}=await failedRetryFixture();const search=v.searchInput;f.setRead(()=>{search.remove();return d.promise;});retry.focus();retry.click({detail:0});assert.equal(doc.activeElement,doc.body);assert.equal(search.focusCalls.length,0);d.resolve({entries:records});await settled();await v.onClose();});

test('keyboard retry does not restore after the read callback changes the source generation',async()=>{const{f,v,retry,d,doc}=await failedRetryFixture();f.setRead(()=>{v.generation++;return d.promise;});retry.focus();retry.click({detail:0});assert.equal(doc.activeElement,doc.body);assert.equal(v.searchInput.focusCalls.length,0);d.resolve({entries:records});await settled();await v.onClose();});

test('keyboard retry does not restore after the read callback closes the view',async()=>{const{f,v,retry,d,doc}=await failedRetryFixture();const search=v.searchInput;f.setRead(()=>{void v.onClose();return d.promise;});retry.focus();retry.click({detail:0});assert.equal(doc.activeElement,doc.body);assert.equal(search.focusCalls.length,0);d.resolve({entries:records});await settled();assert.equal(v.contentEl.children.length,0);});
