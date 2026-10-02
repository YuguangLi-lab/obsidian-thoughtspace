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
 ownerDocument:{defaultView:{setTimeout:typeof setTimeout;clearTimeout:typeof clearTimeout;URL:ObjectURLs};activeElement?:Element}={defaultView:{setTimeout,clearTimeout,URL:new ObjectURLs()}};
 className='';textContent='';title='';value='';disabled=false;readOnly=false;hidden=false;scrollTop=0;
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
 focus(){this.ownerDocument.activeElement=this;}
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
 constructor(leaf:{app:unknown}){this.app=leaf.app;}
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
 items:MenuItem[]=[];separators=0;parent?:Element;mouseEvent?:unknown;position?:{x:number;y:number};document?:unknown;hidden=false;hideCount=0;
 constructor(){Menu.instances.push(this);}
 setParentElement(parent:Element){this.parent=parent;return this;}
 addItem(fn:(item:MenuItem)=>unknown){const item=new MenuItem();this.items.push(item);fn(item);return this;}
 addSeparator(){this.separators++;return this;}
 showAtMouseEvent(event:unknown){this.mouseEvent=event;return this;}
 showAtPosition(position:{x:number;y:number},document:unknown){this.position=position;this.document=document;return this;}
 hide(){this.hidden=true;this.hideCount++;return this;}
}
function more(view:any,event?:unknown){const before=Menu.instances.length;button(view.contentEl,'更多媒体操作').click(event);assert.equal(Menu.instances.length,before+1);return Menu.instances.at(-1)!;}
function menuItem(menu:Menu,title:string){const item=menu.items.find(value=>value.title===title);assert.ok(item,`menu item ${title} exists`);return item;}
async function settled(){await new Promise<void>(resolve=>setImmediate(resolve));}
const compiled=transformSync(readFileSync('src/media-workspace-view.ts','utf8'),{loader:'ts',format:'cjs'}).code;
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

test('opening media mounts lazily without creating notes, and only explicit time seeks',async()=>{
 const f=fixture();f.setRead(async()=>({entries:[]}));const v=f.view();await v.onOpen();await v.setState({file:f.a.path,placement:'sidebar'});
 assert.equal(v.getViewType(),'thoughtspace-media-player');assert.equal(v.currentFile(),f.a);assert.equal(f.saves.length,0);assert.deepEqual(f.mounts[0].seeks,[]);assert.equal(f.mounts[0].plays,0);assert.equal(v.openNoteButton.disabled,true);
 await v.setState({file:f.a.path,placement:'sidebar',time:19.25});assert.deepEqual(f.mounts[0].seeks,[19.25]);
 await v.setState({file:f.a.path,placement:'sidebar'});assert.deepEqual(f.mounts[0].seeks,[19.25]);v.resumePlayback();assert.equal(f.mounts[0].plays,1);await v.onClose();
});

test('a timestamp draft freezes capture time while playback updates and saves ordinary Markdown',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(12.125);
 v.input.value='**重点**\n- 一段普通 Markdown';v.input.oninput();f.mounts[0].hooks.state({time:90,rate:1.5,volume:.4});
 assert.equal(v.memory.draft.time,12.125);assert.equal(v.hasPendingDraft(),true);await v.saveDraft();
 assert.equal(f.saves[0].data.time,12.125);assert.equal(f.saves[0].data.text,'**重点**\n- 一段普通 Markdown');assert.match(f.saves[0].data.id,/^[\w-]+$/);assert.equal(v.hasPendingDraft(),false);await v.onClose();
});

test('an unsaved draft blocks media and placement changes and keeps the old decoder',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(7);
 await v.setState({file:f.b.path,placement:'sidebar'});await v.move('window');
 assert.equal(v.currentFile(),f.a);assert.equal(v.getState().placement,'tab');assert.equal(f.mounts[0].disposed,0);assert.equal(f.opens.length,0);assert.match(notices.at(-1)!,/先保存或清空/);await v.onClose();
});

test('Save button preserves the specific failure message and retries the same screenshot draft',async()=>{
 const f=fixture(),v=f.view(),image=new Blob(['PNG'],{type:'image/png'});await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,image,8.75);
 v.input.value='截图说明';v.input.oninput();const draft=v.memory.draft;f.setWrite(async()=>{throw Error('disk failure');});v.saveButton.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(v.status.textContent,'保存未完成，文字、截图与记录时间已保留，可重试。');assert.equal(v.memory.draft,draft);assert.equal(draft.image,image);assert.equal(draft.text,'截图说明');assert.equal(v.input.readOnly,true);
 const first=f.saves[0].data;f.setWrite(async()=>({note:f.noteA}));v.saveButton.click();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.saves[1].data,first);assert.equal(v.hasPendingDraft(),false);await v.onClose();
});

test('Save button preserves source-change guidance without writing the note',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});v.input.value='source-bound draft';v.input.oninput();const draft=v.memory.draft;f.a.stat.mtime++;
 v.saveButton.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(v.status.textContent,'媒体来源已更新，摘录未保存；文字和截图仍保留。');assert.equal(v.memory.draft,draft);assert.equal(f.saves.length,0);await v.onClose();
});

test('failed screenshot saves retain exact id, frame and text through close and reopen',async()=>{
 const f=fixture(),v=f.view(),image=new Blob(['PNG'],{type:'image/png'});await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,image,8.75);
 v.input.value='截图说明';v.input.oninput();f.setWrite(async()=>{throw Error('disk failure');});await assert.rejects(v.saveDraft());
 const first=f.saves[0].data;assert.equal(v.input.readOnly,true);await v.onClose();
 const recovered=f.view();await recovered.setState({file:f.a.path});assert.equal(recovered.memory.draft.image,image);assert.equal(recovered.memory.draft.text,'截图说明');assert.equal(recovered.memory.draft.id,first.id);
 f.setWrite(async()=>({note:f.noteA}));await recovered.saveDraft();assert.deepEqual(f.saves[1].data,first);assert.equal(recovered.hasPendingDraft(),false);await recovered.onClose();
});

test('late timeline responses from a previous media cannot replace the current timeline',async()=>{
 const f=fixture(),v=f.view(),slow=deferred<{note?:TFile;entries:Moment[]}>();
 f.setRead(file=>file===f.a?slow.promise:Promise.resolve({note:f.noteB,entries:[{id:'b',time:2,text:'B',line:1}]}));
 const first=v.setState({file:f.a.path});await v.setState({file:f.b.path});slow.resolve({note:f.noteA,entries:[{id:'a',time:1,text:'A',line:1}]});await first;
 assert.equal(v.note,f.noteB);assert.deepEqual(v.entries.map((entry:Moment)=>entry.id),['b']);assert.equal(f.mounts[0].disposed,1);assert.equal(v.currentPlayback().time,0);await v.onClose();
});

test('late errors from an older timeline refresh cannot replace newer results',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const slow=deferred<{entries:Moment[]}>();f.setRead(()=>slow.promise);const first=v.refreshMoments();
 f.setRead(async()=>({note:f.noteA,entries:[{id:'fresh',time:9,text:'new',line:1}]}));await v.refreshMoments();slow.reject(Error('old failure'));await first;
 assert.equal(v.entries[0].id,'fresh');assert.doesNotMatch(v.status.textContent,/无法读取/);await v.onClose();
});

test('save completing after close clears only its cached draft and updates a reopened view',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(4);const slow=deferred<{note:TFile}>();f.setWrite(()=>slow.promise);const saving=v.saveDraft();await Promise.resolve();await v.onClose();
 const current=f.view();await current.setState({file:f.a.path});assert.equal(current.saveButton.disabled,true);assert.equal(current.hasPendingDraft(),true);await current.saveDraft();assert.equal(f.saves.length,1);
 slow.resolve({note:f.noteA});await saving;assert.equal(current.hasPendingDraft(),false);assert.equal(current.input.value,'');await current.onClose();
});

test('switching disposes before retiring state and closing is idempotent',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await v.setState({file:f.b.path});await v.setState({file:f.a.path});
 assert.deepEqual(f.mounts[2].hooks.initialState,{time:33,rate:1.5,volume:.4});await v.onClose();await v.onClose();assert.equal(f.mounts[2].disposed,1);
 const before=f.mounts.length;await v.setState({file:f.b.path});assert.equal(f.mounts.length,before);
});

test('time axis pagination searches all entries before taking the first 50',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({note:f.noteA,entries:Array.from({length:120},(_,i)=>({id:String(i),time:i,text:`entry-${i}`,line:i+1}))}));await v.setState({file:f.a.path});
 const rows=()=>v.timeline.children.filter((el:Element)=>el.className==='ts-media-workspace__moment');assert.equal(rows().length,50);
 v.query='entry-119';v.renderTimeline();assert.equal(rows().length,1);assert.equal(v.timelineCount.textContent,'1');
 v.query='';v.pageStart=50;v.renderTimeline();assert.equal(rows().length,50);assert.equal(rows()[0].querySelector('.ts-media-workspace__moment-text')!.textContent,'entry-50');await v.onClose();
});

test('delayed file picker selection cannot overwrite a subsequently selected media',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});v.pick();await v.setState({file:f.b.path});f.choose(f.a);assert.equal(f.opens.length,0);await v.onClose();
});

test('only the active source note modification schedules a timeline refresh',async()=>{
 const f=fixture(),v=f.view();await v.onOpen();await v.setState({file:f.a.path});let count=0;v.scheduleRefresh=()=>count++;
 for(const callback of f.events.get('modify')||[]){callback(f.noteB);callback(f.noteA);}assert.equal(count,1);await v.onClose();
});

test('placement movement uses the current timestamp and lets the host sample playback',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});f.mounts[0].hooks.state({time:27.5,rate:1.25,volume:.6});await v.move('window');
 assert.deepEqual(f.opens,[[f.a,'window',27.5]]);assert.equal(f.mounts[0].disposed,0);assert.equal(v.canMove(),true);await v.onClose();
});

test('valid loop state survives getState while invalid loops are omitted',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,playback:{time:10,rate:2,volume:.3,loopA:8,loopB:12}});
 assert.deepEqual(v.getState().playback,{time:10,rate:2,volume:.3,loopA:8,loopB:12});
 v.getState().playback.time=99;assert.equal(v.currentPlayback().time,10);
 f.mounts[0].hooks.state({time:10,rate:1,volume:1,loopA:8,loopB:8.2} as MediaCardState);
 assert.deepEqual(v.currentPlayback(),{time:10,rate:1,volume:1,loopA:8});await v.onClose();
});

test('a source-note modification invalidates the pending read before its debounce fires',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const slow=deferred<{entries:Moment[]}>();f.setRead(()=>slow.promise);
 const reading=v.refreshMoments();v.scheduleRefresh();slow.resolve({entries:[{id:'outdated',time:1,text:'old',line:1}]});await reading;
 assert.deepEqual(v.entries,[]);await v.onClose();
});

test('screenshot freezes its own time and cannot silently replace an existing frame',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(3);
 v.input.value='my thought';v.input.oninput();const id=v.memory.draft.id,image=new Blob(['first']);await frame(f.mounts[0].hooks,image,9.25);
 assert.equal(v.memory.draft.id,id);assert.equal(v.memory.draft.time,9.25);assert.equal(v.memory.draft.text,'my thought');
 await assert.rejects(frame(f.mounts[0].hooks,new Blob(['second']),12));assert.equal(v.memory.draft.image,image);assert.equal(v.memory.draft.time,9.25);await v.onClose();
});

test('replaced media rejects saving and stale player callbacks cannot overwrite the next media',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(5);
 f.files.set(f.a.path,new TFile(f.a.path));await assert.rejects(v.saveDraft());assert.equal(f.saves.length,0);assert.equal(v.memory.draft.time,5);
 v.memory.draft=undefined;await v.setState({file:f.b.path});const before=v.currentPlayback();f.mounts[0].hooks.state({time:99,rate:2,volume:1});assert.deepEqual(v.currentPlayback(),before);await v.onClose();
});

test('typing and layout snapshots read the live media time between timeupdate events',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});v.player.getState=()=>({time:12.345,rate:1.25,volume:.5});
 v.input.value='exact timestamp';v.input.oninput();assert.equal(v.memory.draft.time,12.345);assert.equal(v.getState().time,12.345);assert.equal(v.getState().playback.time,12.345);await v.onClose();
});

test('focus playback hides panels without remounting, clearing drafts or stopping playback',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,new Blob(['frame']),6);
 v.input.value='keep this draft';v.input.oninput();const draft=v.memory.draft,player=v.player;v.setFocusPlayer(true);
 assert.equal(v.contentEl.dataset.focusPlayer,'true');assert.equal(v.getState().focusPlayer,true);assert.equal(v.focusButton.attributes.get('aria-pressed'),'true');assert.equal(v.memory.draft,draft);assert.equal(v.input.value,'keep this draft');assert.equal(v.player,player);assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].disposed,0);
 v.setFocusPlayer(false);assert.equal(v.contentEl.dataset.focusPlayer,'false');assert.equal(v.memory.draft,draft);assert.equal(v.player,player);await v.onClose();
});

test('focus preference restores from view state or the shared host during placement changes',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,focusPlayer:true});assert.equal(v.contentEl.dataset.focusPlayer,'true');await v.onClose();
 const moved=f.view();await moved.setState({file:f.a.path,placement:'window'});assert.equal(moved.getState().focusPlayer,true);await moved.setState({file:f.a.path,placement:'window',focusPlayer:false});assert.equal(moved.getState().focusPlayer,false);assert.equal(f.mounts.length,2);await moved.onClose();
});

test('draft source identity is frozen before first save and rejects in-place replacement or rename',async()=>{
 for(const field of ['mtime','size','path']as const){
  const f=fixture(),v=f.view(),image=new Blob(['original frame']);await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,image,6.5);
  v.input.value='original source text';v.input.oninput();const draft=v.memory.draft,expected={path:f.a.path,mtime:100,size:1000};
  if(field==='path'){f.files.delete(f.a.path);f.a.path='media/renamed.mp4';f.files.set(f.a.path,f.a);}else f.a.stat[field]++;
  await assert.rejects(v.saveDraft());assert.equal(f.saves.length,0);assert.equal(v.memory.draft,draft);assert.equal(draft.image,image);assert.equal(draft.text,'original source text');assert.deepEqual(draft.source,expected);await v.onClose();
 }
});

test('save rechecks the frozen source before deferred host invocation and passes a separate snapshot',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(2);
 const saving=v.saveDraft();f.a.stat.mtime++;await assert.rejects(saving);assert.equal(f.saves.length,0);assert.equal(v.memory.draft.source.mtime,100);await v.onClose();
 const g=fixture(),w=g.view();await w.setState({file:g.a.path});await g.mounts[0].hooks.capture(3);const source=w.memory.draft.source;await w.saveDraft();
 assert.deepEqual(g.saves[0].data.source,{path:g.a.path,mtime:100,size:1000});assert.notEqual(g.saves[0].data.source,source);await w.onClose();
});

test('source modification remounts an idle view and rename preserves live playback time',async()=>{
 const f=fixture(),v=f.view();await v.onOpen();await v.setState({file:f.a.path});v.player.getState=()=>({time:21.125,rate:1.25,volume:.5});
 f.files.delete(f.a.path);f.a.path='media/renamed.mp4';f.files.set(f.a.path,f.a);for(const fn of f.events.get('rename')||[])fn(f.a);await Promise.resolve();
 assert.equal(f.mounts.length,2);assert.equal(f.mounts[0].disposed,1);assert.deepEqual(f.mounts[1].seeks,[21.125]);assert.equal(v.currentPlayback().time,21.125);assert.equal(v.sourceIdentity.path,f.a.path);
 f.a.stat.mtime++;for(const fn of f.events.get('modify')||[])fn(f.a);await Promise.resolve();
 assert.equal(f.mounts.length,3);assert.equal(f.mounts[1].disposed,1);assert.equal(f.mounts[2].hooks.initialState?.time,0);assert.deepEqual(f.mounts[2].seeks,[0]);await v.onClose();
});

test('selecting the same changed TFile remounts and stale callbacks cannot create new drafts',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const old=f.mounts[0];f.a.stat.size++;
 await old.hooks.capture(99);assert.equal(v.memory.draft,undefined);v.input.value='stale input';v.input.oninput();assert.equal(v.memory.draft,undefined);
 await v.setState({file:f.a.path});assert.equal(f.mounts.length,2);assert.equal(old.disposed,1);await f.mounts[1].hooks.capture(4);assert.equal(v.memory.draft.source.size,1001);await v.onClose();
});

for(const departure of ['close','switch'] as const)test(`media changed after ${departure} cannot reuse stale resume time or loops`,async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});
 const memory=v.memory,lastState={time:80,rate:1.5,volume:.4,loopA:20,loopB:30};f.mounts[0].hooks.state(lastState);
 v.player.getState=()=>lastState;v.player.dispose=()=>{f.mounts[0].disposed++;f.mounts[0].hooks.state(lastState);};
 if(departure==='close')await v.onClose();else await v.setState({file:f.b.path});
 assert.deepEqual(memory.state,lastState);
 f.a.stat.mtime++;f.a.stat.size++;
 const reopened=departure==='close'?f.view():v;await reopened.setState({file:f.a.path});
 assert.deepEqual(f.mounts.at(-1)!.hooks.initialState,{time:0,rate:1.5,volume:.4});await reopened.onClose();
});

test('decoder teardown failure still releases view URLs and the shared draft editor',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,new Blob(['PNG'],{type:'image/png'}),8);
 const draft=v.memory.draft,urls=v.contentEl.ownerDocument.defaultView.URL;assert.equal(urls.active.size,1);
 const dispose=v.player.dispose;v.player.dispose=()=>{dispose();throw Error('decoder teardown failed');};
 await assert.rejects(v.onClose(),/decoder teardown failed/);
 assert.equal(urls.active.size,0);assert.equal(v.closed,true);assert.equal(v.memory.editor,undefined);assert.equal(v.memory.listeners.size,0);
 const reopened=f.view();await reopened.setState({file:f.a.path});assert.equal(reopened.memory.draft,draft);assert.equal(reopened.input.readOnly,false);await reopened.onClose();
});

test('source change preserves an existing draft and clearing it recovers a fresh player',async()=>{
 const f=fixture(),v=f.view();await v.onOpen();await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,new Blob(['old']),8);const draft=v.memory.draft;
 f.a.stat.mtime++;for(const fn of f.events.get('modify')||[])fn(f.a);assert.equal(v.memory.draft,draft);assert.equal(f.mounts[0].disposed,1);assert.equal(v.input.readOnly,true);assert.equal(v.saveButton.disabled,true);await assert.rejects(v.saveDraft());
 await v.setState({file:f.a.path});assert.equal(f.mounts.length,1);assert.equal(v.memory.draft,draft);
 v.clearDraft();await Promise.resolve();assert.equal(f.mounts.length,2);assert.equal(v.memory.draft,undefined);await f.mounts[1].hooks.capture(9);await v.saveDraft();assert.equal(f.saves[0].data.source?.mtime,101);await v.onClose();
});

test('shared drafts broadcast input and clear while only one view can edit',async()=>{
 const f=fixture(),a=f.view(),b=f.view();await a.setState({file:f.a.path});await b.setState({file:f.a.path});a.input.value='latest text';a.input.oninput();
 assert.equal(b.input.value,'latest text');assert.equal(b.input.readOnly,true);const draft=a.memory.draft;b.input.value='stale text';b.input.oninput();assert.equal(draft.text,'latest text');await b.saveDraft();assert.equal(f.saves.length,0);b.clearDraft();assert.equal(a.memory.draft,draft);
 a.clearDraft();assert.equal(b.input.value,'');assert.equal(b.input.readOnly,false);b.input.value='next editor';b.input.oninput();assert.equal(a.input.value,'next editor');assert.equal(a.input.readOnly,true);
 await b.onClose();assert.equal(a.input.readOnly,false);a.input.value='continued after close';a.input.oninput();assert.equal(a.memory.draft.text,'continued after close');await a.onClose();
});

test('IME composition is preserved through playback and cross-view paints and cannot save halfway',async()=>{
 const f=fixture(),a=f.view(),b=f.view();await a.setState({file:f.a.path});await b.setState({file:f.a.path});a.input.value='prefix';a.input.oninput();a.input.dispatch('compositionstart');a.input.value='正在输入';
 f.mounts[0].hooks.state({time:10,rate:1,volume:1});b.paintComposer();assert.equal(a.input.value,'正在输入');await a.saveDraft();assert.equal(f.saves.length,0);
 b.input.value='cannot overwrite';b.input.oninput();assert.equal(a.memory.draft.text,'prefix');a.input.dispatch('compositionend');assert.equal(a.memory.draft.text,'正在输入');assert.equal(b.input.value,'正在输入');await a.onClose();await b.onClose();
});

test('frame capture reserves time before encoding and blocks save, clear and moves until attachment',async()=>{
 const f=fixture(),v=f.view(),other=f.view();await v.setState({file:f.a.path});await other.setState({file:f.a.path});const hooks=f.mounts[0].hooks,image=new Blob(['encoded PNG']);
 hooks.frameCaptureState!(true,7.125);const draft=v.memory.draft;v.input.value='typed while encoding';v.input.oninput();hooks.state({time:9,rate:1,volume:1});
 assert.equal(draft.time,7.125);assert.equal(v.input.readOnly,false);assert.equal(v.saveButton.disabled,true);assert.equal(v.clearButton.disabled,true);assert.equal(other.saveButton.disabled,true);assert.equal(other.input.value,'typed while encoding');
 await v.saveDraft();v.input.onkeydown({metaKey:true,key:'Enter',preventDefault(){},stopPropagation(){}});v.clearDraft();await v.setState({file:f.b.path});await v.move('window');
 assert.equal(f.saves.length,0);assert.equal(v.memory.draft,draft);assert.equal(v.currentFile(),f.a);assert.equal(f.opens.length,0);
 await hooks.frame(image,7.125);assert.equal(v.memory.draft,draft);assert.equal(draft.image,image);await v.saveDraft();assert.equal(f.saves.length,0);
 hooks.frameCaptureState!(false,7.125);assert.equal(v.saveButton.disabled,false);await v.saveDraft();assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.id,draft.id);assert.equal(f.saves[0].data.image,image);assert.equal(f.saves[0].data.text,'typed while encoding');assert.equal(f.saves[0].data.time,7.125);assert.equal(other.input.value,'');await v.onClose();await other.onClose();
});

test('disposing a pending capture releases the lock and ignores any late frame',async()=>{
 for(const mode of ['close','replace']as const){
  const f=fixture(),v=f.view();await v.onOpen();await v.setState({file:f.a.path});const hooks=f.mounts[0].hooks;hooks.frameCaptureState!(true,11);const draft=v.memory.draft;
  if(mode==='close')await v.onClose();else{f.a.stat.size++;for(const fn of f.events.get('modify')||[])fn(f.a);}
  assert.equal(v.memory.capturePending,undefined);await hooks.frame(new Blob(['late']),11);hooks.frameCaptureState!(false,11);assert.equal(v.memory.draft,draft);assert.equal(draft.image,undefined);assert.equal(f.saves.length,0);assert.equal(v.contentEl.ownerDocument.defaultView.URL.created.length,0);if(mode!=='close')await v.onClose();
 }
});

test('timeline warnings are shown without discarding readable entries',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({note:f.noteA,entries:[{id:'a',time:1,text:'readable',line:2}],warnings:['一份笔记暂时无法读取。','部分来源需要确认。']}));await v.setState({file:f.a.path});
 assert.equal(v.entries.length,1);assert.match(v.status.textContent,/一份笔记暂时无法读取/);assert.match(v.status.textContent,/部分来源需要确认/);assert.equal(v.openNoteButton.disabled,false);await v.onClose();
});

test('dispose snapshots live playback before releasing a decoder without a final state event',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});let disposed=false;v.player.getState=()=>{assert.equal(disposed,false);return{time:18.375,rate:2,volume:.6,loopA:12,loopB:20};};v.player.dispose=()=>{disposed=true;};await v.onClose();
 const next=f.view();await next.setState({file:f.a.path});assert.deepEqual(f.mounts[1].hooks.initialState,{time:18.375,rate:2,volume:.6,loopA:12,loopB:20});await next.onClose();
});

test('viewer, composer, timeline desk and narrow switcher are independent direct layout children',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const content=v.contentEl as Element,layout=content.querySelector('.ts-media-workspace__layout')!,main=content.querySelector('.ts-media-workspace__main')!,desk=content.querySelector('.ts-media-workspace__desk')!;
 assert.ok(main);assert.ok(desk);assert.equal(main.parentElement,desk.parentElement);assert.ok(main.querySelector('.ts-media-workspace__player'));assert.equal(main.querySelector('.ts-media-workspace__composer'),undefined);
 assert.equal(content.querySelector('.ts-media-workspace__composer')!.parentElement,layout);assert.equal(content.querySelector('.ts-media-workspace__panel-switcher')!.parentElement,layout);assert.equal(desk.querySelector('.ts-media-workspace__composer'),undefined);assert.equal(desk.querySelector('.ts-media-workspace__records')!.parentElement,desk);assert.equal(desk.children.length,1);assert.equal(content.dataset.mediaKind,'video');
 await v.setState({file:f.b.path});assert.equal(content.dataset.mediaKind,'audio');await v.onClose();
});

test('record panel buttons preserve player, draft, editor selection and playback and round-trip view state',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const image=new Blob(['snapshot']);await frame(f.mounts[0].hooks,image,14.125);v.input.value='keep **Markdown**';v.input.oninput();v.input.selectionStart=3;v.input.selectionEnd=8;
 f.mounts[0].hooks.state({time:30,rate:1.75,volume:.4,loopA:20,loopB:40});const editor=v.input,player=v.player,draft=v.memory.draft;
 for(const label of ['时间轴','写摘录','时间轴']){const selected=label==='时间轴'?'timeline':'compose';button(v.contentEl,label).onclick!();assert.equal(v.contentEl.dataset.recordPanel,selected);assert.equal(v.getState().recordPanel,selected);assert.equal(button(v.contentEl,label).attributes.get('aria-pressed'),'true');assert.equal(v.input,editor);assert.equal(v.player,player);assert.equal(v.memory.draft,draft);}
 assert.equal(editor.value,'keep **Markdown**');assert.equal(editor.selectionStart,3);assert.equal(editor.selectionEnd,8);assert.equal(draft.image,image);assert.equal(draft.time,14.125);assert.deepEqual(v.currentPlayback(),{time:30,rate:1.75,volume:.4,loopA:20,loopB:40});assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].disposed,0);
 await v.setState({...v.getState(),recordPanel:'compose',time:undefined});assert.equal(v.input,editor);assert.equal(v.contentEl.dataset.recordPanel,'compose');assert.equal(f.mounts[0].seeks.length,0);
 const state={...v.getState(),recordPanel:'timeline'};await v.onClose();const restored=f.view();await restored.setState(state);assert.equal(restored.contentEl.dataset.recordPanel,'timeline');assert.equal(restored.memory.draft,draft);await restored.onClose();
});

test('capture actions reveal the composer from timeline or focus mode without replacing the player',async()=>{
 for(const mode of ['timestamp','frame']as const){
  const f=fixture(),v=f.view();await v.setState({file:f.a.path,recordPanel:'timeline',focusPlayer:true});const player=v.player,editor=v.input;
  if(mode==='timestamp')await f.mounts[0].hooks.capture(5);else f.mounts[0].hooks.frameCaptureState!(true,5);
  assert.equal(v.contentEl.dataset.recordPanel,'compose');assert.equal(v.contentEl.dataset.focusPlayer,'false');assert.equal(v.player,player);assert.equal(v.input,editor);assert.equal(f.mounts.length,1);assert.equal(v.memory.draft.time,5);assert.equal(button(v.contentEl,'写摘录').dataset.hasDraft,'true');
  if(mode==='frame'){await f.mounts[0].hooks.frame(new Blob(['frame']),5);f.mounts[0].hooks.frameCaptureState!(false,5);}assert.equal(editor.ownerDocument.activeElement,editor);await v.onClose();
 }
});

test('timeline filtering and search precede pagination while clear search keeps the selected type',async()=>{
 const f=fixture(),v=f.view();const entries:Moment[]=Array.from({length:130},(_,index)=>({id:String(index),time:index,text:`entry-${index}`,line:index+1,...(index%2?{image:'![[frame.png]]'}:{})}));f.setRead(async()=>({note:f.noteA,entries}));await v.setState({file:f.a.path});
 button(v.contentEl,'截图').onclick!();assert.equal(rows(v).length,50);assert.equal(v.timelineCount.textContent,'65');assert.equal(v.timelineCount.title,'共 130 条摘录');assert.equal(v.timeline.dataset.filtered,'true');assert.equal(button(v.contentEl,'截图').attributes.get('aria-pressed'),'true');assert.equal(button(v.contentEl,'全部').attributes.get('aria-pressed'),'false');
 button(v.contentEl,'后 50 条').onclick!();assert.equal(rows(v).length,15);assert.equal(v.limit,50);assert.equal(v.pageStart,50);
 v.searchInput.value='ENTRY-129';v.searchInput.oninput();assert.equal(rows(v).length,1);assert.equal(v.limit,50);assert.equal(v.timelineCount.textContent,'1');assert.equal(v.clearSearchButton.disabled,false);assert.equal(rows(v)[0].querySelector('.ts-media-workspace__moment-text')!.textContent,'entry-129');
 v.clearSearchButton.onclick();assert.equal(v.searchInput.value,'');assert.equal(v.query,'');assert.equal(v.recordFilter,'image');assert.equal(v.limit,50);assert.equal(rows(v).length,50);assert.equal(v.clearSearchButton.disabled,true);assert.equal(v.searchInput.ownerDocument.activeElement,v.searchInput);
 button(v.contentEl,'文字').onclick!();assert.equal(v.timelineCount.textContent,'65');assert.equal(rows(v)[0].querySelector('.ts-media-workspace__moment-text')!.textContent,'entry-0');button(v.contentEl,'全部').onclick!();assert.equal(v.timelineCount.textContent,'130');assert.equal(v.timeline.dataset.filtered,'false');assert.equal(f.mounts.length,1);await v.onClose();
});

test('empty filter and search results keep source data available when controls are cleared',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({note:f.noteA,entries:[{id:'one',time:1,text:'plain text',line:1}]}));await v.setState({file:f.a.path});button(v.contentEl,'截图').onclick!();assert.equal(rows(v).length,0);assert.equal(v.entries.length,1);assert.match(v.timeline.querySelector('.ts-media-workspace__no-records').textContent,/这一类/);
 v.searchInput.value='absent';v.searchInput.oninput();assert.match(v.timeline.querySelector('.ts-media-workspace__no-records').textContent,/其他文字或时间/);v.clearSearchButton.onclick();button(v.contentEl,'全部').onclick!();assert.equal(rows(v).length,1);await v.onClose();
});

test('expansion is isolated by source entry key and survives filtering with matching visible labels',async()=>{
 const f=fixture(),v=f.view(),text='Long Markdown **text** <script>literal</script> '.repeat(6),entries:Moment[]=[{id:'duplicate',key:'note-a:duplicate',notePath:'a.md',time:4,text,line:2},{id:'duplicate',key:'note-b:duplicate',notePath:'b.md',time:4,text,line:2}];f.setRead(async()=>({note:f.noteA,entries}));await v.setState({file:f.a.path});
 const first=rows(v)[0],second=rows(v)[1],toggle=button(first,'展开摘录');toggle.onclick!();assert.equal(first.dataset.expanded,'true');assert.equal(second.dataset.expanded,'false');assert.equal(toggle.attributes.get('aria-expanded'),'true');assert.equal(toggle.children[1].textContent,'收起摘录');assert.equal(first.querySelector('.ts-media-workspace__moment-text')!.textContent,text);
 v.searchInput.value='no-match';v.searchInput.oninput();v.clearSearchButton.onclick();assert.equal(rows(v)[0].dataset.expanded,'true');assert.equal(rows(v)[1].dataset.expanded,'false');const collapse=button(rows(v)[0],'收起摘录');collapse.onclick!();assert.equal(collapse.attributes.get('aria-expanded'),'false');assert.equal(collapse.children[1].textContent,'展开摘录');assert.equal(f.mounts.length,1);await v.onClose();
});

test('every nonempty excerpt can expand even when a short string wraps in a narrow pane',async()=>{
 const f=fixture(),v=f.view(),texts=['窄侧栏里不到一百字的中文也可能超过四行，应有完整阅读入口。','https://example.invalid/'+ 'a'.repeat(75),'one\ntwo\nthree\nfour\nfive'];f.setRead(async()=>({entries:texts.map((text,index)=>({id:String(index),time:index,text,line:index+1}))}));await v.setState({file:f.a.path});
 for(const row of rows(v)){const toggle=button(row,'展开摘录');toggle.onclick!();assert.equal(row.dataset.expanded,'true');assert.equal(toggle.attributes.get('aria-expanded'),'true');}await v.onClose();
});

test('asynchronous timeline refresh keeps active filter, search and source-key expansion',async()=>{
 const f=fixture(),v=f.view(),entry:Moment={id:'same',key:'note:same:2',notePath:'note.md',time:3661,text:'matching original',line:2,image:'![[frame.png]]'};f.setRead(async()=>({entries:[entry]}));await v.setState({file:f.a.path});button(v.contentEl,'截图').onclick!();v.searchInput.value='matching';v.searchInput.oninput();button(rows(v)[0],'展开摘录').onclick!();
 const slow=deferred<{entries:Moment[]}>();f.setRead(()=>slow.promise);const refreshing=v.refreshMoments();slow.resolve({entries:[{...entry,text:'matching revised'}, {id:'other',key:'note:other:3',time:2,text:'matching text only',line:3}]});await refreshing;
 assert.equal(v.recordFilter,'image');assert.equal(v.searchInput.value,'matching');assert.equal(rows(v).length,1);assert.equal(rows(v)[0].dataset.expanded,'true');assert.equal(rows(v)[0].querySelector('.ts-media-workspace__moment-text')!.textContent,'matching revised');assert.equal(v.timelineCount.title,'共 2 条摘录');button(rows(v)[0],'1:01:01').onclick!();assert.equal(f.mounts[0].seeks.at(-1),3661);await v.onClose();
});

test('timeline jump and board actions retain the matching entry and leave the in-progress draft frozen',async()=>{
 const f=fixture(),v=f.view(),entry:Moment={id:'later',key:'note:later',time:63.5,text:'later excerpt',line:3};f.setRead(async()=>({note:f.noteA,entries:[entry]}));await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(8);v.input.value='unfinished';v.input.oninput();const draft=v.memory.draft,player=v.player;button(v.contentEl,'时间轴').onclick!();
 button(rows(v)[0],mediaSource.mediaClock(entry.time)).onclick!();assert.equal(f.mounts[0].seeks.at(-1),63.5);assert.equal(draft.time,8);assert.equal(draft.text,'unfinished');button(rows(v)[0],'将这条摘录送到白板').onclick!();assert.deepEqual(f.sent,[{file:f.a,moment:entry}]);assert.equal(v.player,player);assert.equal(v.memory.draft,draft);assert.equal(f.saves.length,0);await v.onClose();
});

test('panel switches during PNG encoding or failed save retain every draft lock and retry payload',async()=>{
 const f=fixture(),v=f.view(),image=new Blob(['pending PNG']);await v.setState({file:f.a.path});const hooks=f.mounts[0].hooks;hooks.frameCaptureState!(true,3.75);v.input.value='encoding text';v.input.oninput();const draft=v.memory.draft;
 button(v.contentEl,'时间轴').onclick!();await v.saveDraft();assert.equal(f.saves.length,0);assert.equal(v.memory.draft,draft);assert.equal(v.saveButton.disabled,true);await hooks.frame(image,3.75);hooks.frameCaptureState!(false,3.75);button(v.contentEl,'写摘录').onclick!();assert.equal(v.memory.draft,draft);assert.equal(draft.image,image);
 f.setWrite(async()=>{throw Error('write failure');});await assert.rejects(v.saveDraft());const payload=f.saves[0].data;button(v.contentEl,'时间轴').onclick!();button(v.contentEl,'写摘录').onclick!();assert.equal(v.input.readOnly,true);assert.equal(v.memory.draft,draft);f.setWrite(async()=>({note:f.noteA}));await v.saveDraft();assert.deepEqual(f.saves[1].data,payload);assert.equal(button(v.contentEl,'写摘录').dataset.hasDraft,'false');assert.equal(f.mounts.length,1);await v.onClose();
});

test('panel and focus switches preserve composition text until the real IME commit',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});v.input.value='prefix';v.input.oninput();v.input.dispatch('compositionstart');v.input.value='未提交的文字';const editor=v.input,draft=v.memory.draft;
 button(v.contentEl,'时间轴').onclick!();v.setFocusPlayer(true);v.setFocusPlayer(false);button(v.contentEl,'写摘录').onclick!();assert.equal(v.input,editor);assert.equal(editor.value,'未提交的文字');assert.equal(draft.text,'prefix');assert.equal(v.composing,true);editor.dispatch('compositionend');assert.equal(draft.text,'未提交的文字');await v.onClose();
});

test('draft thumbnails reuse one window URL through playback paints and release it on clear or save',async()=>{
 for(const finish of ['clear','save']as const){
  const f=fixture(),v=f.view(),image=new Blob(['PNG']);await v.setState({file:f.a.path});const urls=v.contentEl.ownerDocument.defaultView.URL as ObjectURLs;await frame(f.mounts[0].hooks,image,7);
  const url=v.draftImageEl.src;assert.equal(urls.created.length,1);assert.equal(urls.active.get(url),image);assert.equal(v.draftImage.hidden,false);for(let time=8;time<15;time++)f.mounts[0].hooks.state({time,rate:1.25,volume:.5});assert.equal(urls.created.length,1);
  if(finish==='save')await v.saveDraft();else v.clearDraft();assert.deepEqual(urls.revoked,[url]);assert.equal(urls.active.size,0);assert.equal(v.draftImageEl.src,'');assert.equal(v.draftImage.hidden,true);await v.onClose();assert.equal(urls.revoked.length,1);
 }
});

test('replaced thumbnail blobs and close revoke only their own URL while retained drafts reopen safely',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const urls=v.contentEl.ownerDocument.defaultView.URL as ObjectURLs,first=new Blob(['first']),replacement=new Blob(['replacement']);await frame(f.mounts[0].hooks,first,2);const originalUrl=v.previewUrl;
 v.memory.draft.image=replacement;v.paintComposer();const replacementUrl=v.previewUrl;assert.notEqual(replacementUrl,originalUrl);assert.deepEqual(urls.revoked,[originalUrl]);assert.equal(urls.active.get(replacementUrl),replacement);
 await v.onClose();await v.onClose();assert.deepEqual(urls.revoked,[originalUrl,replacementUrl]);const reopened=f.view();await reopened.setState({file:f.a.path});assert.equal(reopened.memory.draft.image,replacement);assert.notEqual(reopened.previewUrl,replacementUrl);assert.equal(urls.active.size,0);await reopened.onClose();
});

test('shared image drafts use independent view URLs and clearing broadcasts cleanup to both windows',async()=>{
 const f=fixture(),a=f.view(),b=f.view();await a.setState({file:f.a.path});await b.setState({file:f.a.path});const aURLs=a.contentEl.ownerDocument.defaultView.URL as ObjectURLs,bURLs=b.contentEl.ownerDocument.defaultView.URL as ObjectURLs,image=new Blob(['shared']);await frame(f.mounts[0].hooks,image,4);
 assert.notEqual(a.previewUrl,b.previewUrl);assert.equal(aURLs.created.length,1);assert.equal(bURLs.created.length,1);assert.equal(aURLs.created[0].blob,image);assert.equal(bURLs.created[0].blob,image);a.clearDraft();assert.equal(aURLs.active.size,0);assert.equal(bURLs.active.size,0);assert.equal(b.draftImage.hidden,true);await a.onClose();await b.onClose();assert.equal(aURLs.revoked.length,1);assert.equal(bURLs.revoked.length,1);
});

test('a screenshot modal owns a separate URL so clearing the draft cannot break its image',async()=>{
 const f=fixture(),v=f.view(),image=new Blob(['modal PNG']);await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,image,61.5);const urls=v.contentEl.ownerDocument.defaultView.URL as ObjectURLs,thumbnail=v.previewUrl;button(v.contentEl,'放大当前截图').onclick!();const modal=f.app.modals[0],full=modal.contentEl.querySelector('img')!;
 assert.equal(modal.opened,true);assert.notEqual(full.src,thumbnail);assert.equal(urls.active.get(full.src),image);assert.match(full.getAttribute('alt')!,/1:01/);v.clearDraft();assert.equal(urls.active.has(thumbnail),false);assert.equal(urls.active.has(full.src),true);
 modal.close();modal.onClose();assert.equal(urls.active.size,0);assert.equal(urls.revoked.filter(url=>url===full.src).length,1);assert.equal(v.previews.size,0);await v.onClose();
});

test('view close releases all image modals and retains the original screenshot for reopening',async()=>{
 const f=fixture(),v=f.view(),image=new Blob(['original']);await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,image,3);v.openPreview(image,3);v.openPreview(image,3);const urls=v.contentEl.ownerDocument.defaultView.URL as ObjectURLs;assert.equal(urls.active.size,3);
 await v.onClose();assert.equal(urls.active.size,0);assert.equal(urls.revoked.length,3);assert.ok(f.app.modals.every(modal=>modal.closed));assert.equal(v.previews.size,0);assert.equal(v.memory.draft.image,image);const created=urls.created.length;v.openPreview(image,3);assert.equal(urls.created.length,created);
});

test('preview URL allocation failure leaves the original frame savable',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const urls=v.contentEl.ownerDocument.defaultView.URL as ObjectURLs;urls.failCreate=true;const image=new Blob(['safe original']);await frame(f.mounts[0].hooks,image,5);assert.equal(v.draftImage.hidden,true);assert.equal(v.memory.draft.image,image);await v.saveDraft();assert.equal(f.saves[0].data.image,image);assert.equal(urls.created.length,0);await v.onClose();
});

test('failed modal opening releases its allocated URL immediately without touching the draft thumbnail',async()=>{
 const f=fixture(),v=f.view(),image=new Blob(['PNG']);await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,image,1);const urls=v.contentEl.ownerDocument.defaultView.URL as ObjectURLs,thumbnail=v.previewUrl;f.app.failModalOpen=true;
 assert.throws(()=>v.openPreview(image,1));assert.deepEqual([...urls.active.keys()],[thumbnail]);assert.equal(v.previews.size,0);assert.equal(v.memory.draft.image,image);await v.onClose();
});

test('timeline thumbnails load only exact local raster files with lazy decoding and respect the size limit',async()=>{
 const f=fixture(),v=f.view(),png=new TFile('assets/frame space.png'),large=new TFile('assets/large.png');large.stat.size=25*1024*1024+1;f.files.set(png.path,png);f.files.set(large.path,large);
 const images=['![frame](assets/frame%20space.png)','![[assets/frame space.png|120]]','![[assets/large.png]]','![[missing.png]]','![remote](https://example.invalid/frame.png)','![data](data:image/png;base64,AAAA)','![[../frame.png]]','![absolute](/Users/private/frame.png)','![[assets/frame.svg]]','![encoded](%2e%2e/frame.png)'];f.setRead(async()=>({entries:images.map((image,index)=>({id:String(index),time:index,text:'caption',line:index+1,image}))}));await v.setState({file:f.a.path});
 const previews=rows(v).map(row=>row.querySelector('.ts-media-workspace__moment-preview'));assert.ok(previews[0]);assert.ok(previews[1]);assert.ok(previews.slice(2).every(value=>!value));assert.deepEqual(f.resourceReads,[png,png]);const img=previews[0]!.querySelector('img')!;assert.equal(img.getAttribute('loading'),'lazy');assert.equal(img.getAttribute('decoding'),'async');assert.equal(img.src,`app://vault/${encodeURIComponent(png.path)}`);assert.equal(v.contentEl.ownerDocument.defaultView.URL.created.length,0);
 previews[0]!.onclick!();assert.equal(f.app.modals[0].contentEl.querySelector('img')!.src,img.src);await v.onClose();assert.equal(f.app.modals[0].closed,true);
});

test('deleted or replaced timeline attachments cannot open stale previews, and image errors stay local',async()=>{
 const f=fixture(),v=f.view(),png=new TFile('assets/frame.png');f.files.set(png.path,png);f.setRead(async()=>({entries:[{id:'one',time:1,text:'still readable',line:1,image:'![[assets/frame.png]]'}]}));await v.setState({file:f.a.path});const preview=rows(v)[0].querySelector('.ts-media-workspace__moment-preview')!,img=preview.querySelector('img')! as Element&{onerror:()=>void};
 f.files.set(png.path,new TFile(png.path));preview.onclick!();assert.equal(f.app.modals.length,0);img.onerror();assert.equal(preview.hidden,true);assert.equal(rows(v)[0].querySelector('.ts-media-workspace__moment-text')!.textContent,'still readable');await v.onClose();img.onerror();assert.equal(f.app.modals.length,0);
});

test('only the current 50-row page creates thumbnail elements and all page controls remain bounded',async()=>{
 const f=fixture(),v=f.view(),png=new TFile('assets/frame.png');f.files.set(png.path,png);f.setRead(async()=>({entries:Array.from({length:123},(_,i)=>({id:String(i),time:i,text:`entry-${i}`,line:i+1,image:'![[assets/frame.png]]'}))}));await v.setState({file:f.a.path});
 assert.equal(rows(v).length,50);assert.equal(f.resourceReads.length,50);assert.equal(v.pageInfo.textContent,'1–50 / 123');button(v.contentEl,'后 50 条').onclick!();assert.equal(v.pageStart,50);assert.equal(rows(v).length,50);assert.equal(v.pageInfo.textContent,'51–100 / 123');button(v.contentEl,'后 50 条').onclick!();assert.equal(v.pageStart,100);assert.equal(rows(v).length,23);assert.equal(v.pageInfo.textContent,'101–123 / 123');assert.equal(f.resourceReads.length,123);
 button(v.contentEl,'前 50 条').onclick!();assert.equal(v.pageStart,50);assert.equal(rows(v).length,50);v.searchInput.value='entry-122';v.searchInput.oninput();assert.equal(v.pageStart,0);assert.equal(rows(v).length,1);assert.equal(v.pageInfo.textContent,'1–1 / 1');v.clearSearchButton.onclick();assert.equal(v.pageStart,0);assert.equal(rows(v).length,50);assert.equal(f.mounts.length,1);await v.onClose();
});

test('locating current time or the last entry changes only the visible page and scroll target',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({entries:Array.from({length:123},(_,i)=>({id:String(i),key:`entry-${i}`,time:i,text:`entry-${i}`,line:i+1}))}));await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(4);v.input.value='draft';v.input.oninput();const draft=v.memory.draft,editor=v.input,player=v.player;f.mounts[0].hooks.state({time:76.25,rate:1.75,volume:.5});button(v.contentEl,'定位当前时间').onclick!();
 assert.equal(v.pageStart,50);assert.equal(rows(v).length,50);assert.equal(v.renderedMoments.get('entry-76').row.scrollCalls.length,1);assert.equal(v.recordPanel,'timeline');assert.deepEqual(f.mounts[0].seeks,[]);assert.equal(draft.time,4);assert.equal(v.input,editor);assert.equal(v.player,player);
 button(v.contentEl,'最后一条').onclick!();assert.equal(v.pageStart,100);assert.equal(rows(v).length,23);assert.equal(v.renderedMoments.get('entry-122').row.scrollCalls.length,1);assert.equal(v.memory.draft,draft);assert.equal(v.currentPlayback().time,76.25);
 v.searchInput.value='no results';v.searchInput.oninput();button(v.contentEl,'最后一条').onclick!();assert.equal(rows(v).length,0);assert.match(v.status.textContent,/没有可定位/);assert.equal(f.mounts.length,1);await v.onClose();
});

test('playback outside the rendered page cannot mark that page last row as the current excerpt',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({entries:Array.from({length:130},(_,i)=>({id:String(i),key:`entry-${i}`,time:i,text:`entry-${i}`,line:i+1}))}));await v.setState({file:f.a.path});f.mounts[0].hooks.state({time:126,rate:1,volume:1});assert.ok(rows(v).every(row=>row.dataset.current!=='true'));button(v.contentEl,'定位当前时间').onclick!();assert.equal(v.renderedMoments.get('entry-126').row.dataset.current,'true');await v.onClose();
});

test('compact view preserves playback, draft image and editor while exposing its persistent state',async()=>{
 const f=fixture(),v=f.view(),image=new Blob(['frame']);await v.setState({file:f.a.path});await frame(f.mounts[0].hooks,image,6);v.input.value='kept';v.input.oninput();const player=v.player,editor=v.input,draft=v.memory.draft,url=v.previewUrl;f.mounts[0].hooks.state({time:12,rate:2,volume:.5,loopA:10,loopB:20});button(v.contentEl,'收起画面').onclick!();
 assert.equal(v.contentEl.dataset.compactPlayer,'true');assert.equal(v.getState().compactPlayer,true);assert.equal(button(v.contentEl,'展开画面').attributes.get('aria-pressed'),'true');assert.equal(v.player,player);assert.equal(v.input,editor);assert.equal(v.memory.draft,draft);assert.equal(v.previewUrl,url);assert.deepEqual(v.currentPlayback(),{time:12,rate:2,volume:.5,loopA:10,loopB:20});assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].disposed,0);
 button(v.contentEl,'展开画面').onclick!();assert.equal(v.contentEl.dataset.compactPlayer,'false');await v.setState({...v.getState(),compactPlayer:true,time:undefined});assert.equal(v.player,player);assert.equal(v.compactPlayer,true);await v.onClose();
});

test('layout ratio uses a labeled native keyboard range, clamps invalid states and never remounts playback',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,viewerRatio:60});const player=v.player,range=v.layoutRange;assert.equal(range.getAttribute('type'),'range');assert.equal(range.getAttribute('min'),'38');assert.equal(range.getAttribute('max'),'70');assert.equal(range.getAttribute('step'),'2');assert.equal(range.getAttribute('aria-label'),'观看区宽度');assert.equal(range.value,'60');
 const saves=f.layoutSaves;range.value='64';range.oninput();assert.equal(v.getState().viewerRatio,64);assert.equal(v.contentEl.style.getPropertyValue('--ts-mw-viewer'),'64%');assert.equal(range.getAttribute('aria-valuetext'),'观看区 64%');assert.ok(f.layoutSaves>saves);v.setViewerRatio(100);assert.equal(v.viewerRatio,70);v.setViewerRatio(-1);assert.equal(v.viewerRatio,38);v.setViewerRatio(NaN);v.setViewerRatio(Infinity);assert.equal(v.viewerRatio,38);assert.equal(v.player,player);assert.equal(f.mounts.length,1);
 const state={...v.getState(),compactPlayer:true};await v.onClose();const restored=f.view();await restored.setState(state);assert.equal(restored.viewerRatio,38);assert.equal(restored.compactPlayer,true);assert.equal(restored.layoutRange.value,'38');await restored.onClose();
});

test('focus and compact controls stay exclusive and conflicting restored states consistently use compact mode',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,compactPlayer:true});const player=v.player;v.setFocusPlayer(true);assert.equal(v.compactPlayer,false);assert.equal(v.focusPlayer,true);assert.equal(v.player,player);await v.setState({file:f.a.path,focusPlayer:true,compactPlayer:true});assert.equal(v.compactPlayer,true);assert.equal(v.focusPlayer,false);await v.onClose();
 const restored=f.view();await restored.setState({file:f.a.path,focusPlayer:true,compactPlayer:true});assert.equal(restored.compactPlayer,true);assert.equal(restored.focusPlayer,false);await restored.onClose();
});

test('more menu preserves the original pointer event and anchors keyboard activation in its own document',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,placement:'sidebar'});const pointer={detail:1,clientX:213,clientY:87,target:v.moreButton};const mouse=more(v,pointer);assert.equal(mouse.parent,v.contentEl);assert.equal(mouse.mouseEvent,pointer);assert.equal(mouse.position,undefined);
 v.moreButton.rect={left:54,right:86,top:72,bottom:104,width:32,height:32};const keyboard=more(v,{detail:0,clientX:0,clientY:0});assert.deepEqual(keyboard.position,{x:54,y:104});assert.equal(keyboard.document,v.contentEl.ownerDocument);assert.equal(keyboard.mouseEvent,undefined);assert.equal(menuItem(keyboard,'在右侧栏打开').checked,true);assert.equal(menuItem(keyboard,'在主页面打开').checked,false);assert.equal(menuItem(keyboard,'在独立窗口打开').checked,false);
 const header=v.contentEl.querySelector('.ts-media-workspace__header-actions') as Element;assert.equal(header.querySelector('.ts-media-workspace__positions'),undefined);assert.equal(header.all().some(node=>node.getAttribute('aria-label')==='将媒体加入白板'),false);assert.ok(button(header,'更多媒体操作'));await v.onClose();
});

test('menu media selection, board insertion and placement actions call the host with the live source',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});let menu=more(v);menuItem(menu,'选择音频或视频').activate();assert.equal(f.pickCount,1);f.choose(f.b);await settled();assert.deepEqual(f.opens,[[f.b,'tab']]);menu=more(v);menuItem(menu,'将媒体加入白板').activate();await settled();assert.deepEqual(f.sent,[{file:f.a,moment:undefined}]);await v.onClose();
 for(const[placement,label]of [['tab','在主页面打开'],['sidebar','在右侧栏打开'],['window','在独立窗口打开']]as const){
  const g=fixture(),w=g.view();await w.setState({file:g.a.path,placement:placement==='tab'?'sidebar':'tab'});w.player.getState=()=>({time:23.875,rate:1.5,volume:.4});menuItem(more(w),label).activate();await settled();assert.deepEqual(g.opens,[[g.a,placement,23.875]]);assert.equal(g.mounts[0].disposed,0);await w.onClose();
 }
});

test('empty workspace menu disables board insertion but keeps media selection available',async()=>{
 const f=fixture(),v=f.view();await v.setState({});const menu=more(v);assert.equal(menuItem(menu,'将媒体加入白板').disabled,true);menuItem(menu,'将媒体加入白板').activate();assert.equal(f.sent.length,0);menuItem(menu,'选择音频或视频').activate();assert.equal(f.pickCount,1);assert.equal(f.mounts.length,0);await v.onClose();
});

test('a draft created after opening the menu blocks later media selection and placement actions',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,placement:'sidebar'});const menu=more(v);await f.mounts[0].hooks.capture(9);v.input.value='draft after menu opened';v.input.oninput();const draft=v.memory.draft,player=v.player;
 menuItem(menu,'选择音频或视频').activate();menuItem(menu,'在独立窗口打开').activate();await settled();assert.equal(f.pickCount,0);assert.equal(f.opens.length,0);assert.equal(v.memory.draft,draft);assert.equal(v.input.value,'draft after menu opened');assert.equal(v.player,player);assert.equal(v.getState().placement,'sidebar');await v.onClose();
});

test('menu callbacks captured by a closed or switched view cannot operate on its next source',async()=>{
 for(const changed of ['closed','switched','overwritten','replaced']as const){
  const f=fixture(),v=f.view();await v.setState({file:f.a.path});const menu=more(v);
  if(changed==='closed')await v.onClose();else if(changed==='switched')await v.setState({file:f.b.path});else if(changed==='overwritten')f.a.stat.mtime++;else f.files.set(f.a.path,new TFile(f.a.path));
  menuItem(menu,'将媒体加入白板').activate();if(changed==='closed'||changed==='switched'){menuItem(menu,'选择音频或视频').activate();menuItem(menu,'在独立窗口打开').activate();}
  await settled();assert.equal(f.sent.length,0);assert.equal(f.pickCount,0);assert.equal(f.opens.length,0);await v.onClose();
 }
});

test('menu callbacks contain synchronous and asynchronous host failures without discarding a draft',async()=>{
 for(const failure of ['synchronous','asynchronous']as const){
  const f=fixture(),v=f.view();await v.setState({file:f.a.path});await f.mounts[0].hooks.capture(3);v.input.value='still here';v.input.oninput();const draft=v.memory.draft;f.host.sendToBoard=failure==='synchronous'?()=>{throw Error('inline conflict');}:async()=>{throw Error('inline conflict');};
  assert.doesNotThrow(()=>menuItem(more(v),'将媒体加入白板').activate());await settled();assert.match(v.status.textContent,/操作未完成/);assert.equal(v.memory.draft,draft);assert.equal(v.input.value,'still here');await v.onClose();
 }
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});f.host.open=async()=>{throw Error('window unavailable');};menuItem(more(v),'在独立窗口打开').activate();await settled();assert.match(v.status.textContent,/操作未完成/);assert.equal(v.busy,false);assert.equal(f.mounts[0].disposed,0);await v.onClose();
});

test('a late failure from an old menu action cannot replace the new source status',async()=>{
 const f=fixture(),v=f.view(),pending=deferred<void>();await v.setState({file:f.a.path});f.host.sendToBoard=()=>pending.promise;menuItem(more(v),'将媒体加入白板').activate();await v.setState({file:f.b.path});v.message('新的媒体已加载');pending.reject(Error('old board failure'));await settled();assert.equal(v.status.textContent,'新的媒体已加载');await v.onClose();
});

test('layout controls live in native details, reset the ratio and return keyboard focus on Escape',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,viewerRatio:68});const options=v.contentEl.querySelector('.ts-media-workspace__layout-options') as Element,summary=options.querySelector('summary')!,range=v.layoutRange,player=v.player,editor=v.input;assert.equal(options.getAttribute('tag'),'details');assert.equal(range.parentElement.parentElement,options);assert.equal(summary.getAttribute('aria-label'),'调整工作区布局');
 options.open=true;button(options,'恢复均衡布局').click();assert.equal(v.viewerRatio,56);assert.equal(range.value,'56');let stopped=0;options.dispatch('keydown',{key:'Escape',stopPropagation(){stopped++;}});assert.equal(options.open,false);assert.equal(stopped,1);assert.equal(options.ownerDocument.activeElement,summary);assert.equal(v.player,player);assert.equal(v.input,editor);assert.equal(f.mounts.length,1);await v.onClose();
});

test('fixed pagination remains outside the scrolling rows and keeps its buttons across boundaries and empty results',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({entries:Array.from({length:75},(_,i)=>({id:String(i),time:i,text:`entry-${i}`,line:i+1}))}));await v.setState({file:f.a.path});const previous=v.previousPageButton as Element,next=v.nextPageButton as Element,info=v.pageInfo as Element,footer=previous.parentElement!,records=v.contentEl.querySelector('.ts-media-workspace__records') as Element;
 assert.equal(footer.parentElement,records);assert.equal(records.children.at(-1),footer);assert.equal(v.timeline.parentElement,records);assert.equal(v.timeline.all().includes(previous),false);assert.equal(previous.disabled,true);assert.equal(next.disabled,false);assert.equal(previous.hidden,false);assert.equal(next.hidden,false);assert.equal(info.getAttribute('aria-live'),'polite');const firstRow=rows(v)[0];previous.click({detail:0});assert.equal(v.pageStart,0);assert.equal(rows(v)[0],firstRow);
 next.click({detail:0});assert.equal(v.pageStart,50);assert.equal(rows(v).length,25);assert.equal(previous.disabled,false);assert.equal(next.disabled,true);assert.equal(v.previousPageButton,previous);assert.equal(v.nextPageButton,next);assert.equal(v.pageInfo,info);const lastRow=rows(v)[0];next.click({detail:0});assert.equal(v.pageStart,50);assert.equal(rows(v)[0],lastRow);
 previous.click({detail:0});assert.equal(v.pageStart,0);v.searchInput.value='no matches';v.searchInput.oninput();assert.equal(previous.disabled,true);assert.equal(next.disabled,true);assert.equal(info.textContent,'0 条摘录');previous.click({detail:0});next.click({detail:0});assert.equal(v.pageStart,0);assert.equal(rows(v).length,0);assert.equal(v.previousPageButton,previous);assert.equal(v.nextPageButton,next);assert.equal(f.mounts.length,1);await v.onClose();
});

test('sidebar density changes only presentation while preserving media, draft, selection, previews and timeline rows',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({entries:Array.from({length:70},(_,i)=>({id:String(i),time:i,text:`entry-${i}`,line:i+1}))}));await v.setState({file:f.a.path,placement:'sidebar'});const image=new Blob(['draft']);await frame(f.mounts[0].hooks,image,7);v.input.value='selection and **draft**';v.input.oninput();v.input.selectionStart=2;v.input.selectionEnd=9;v.nextPageButton.click();const player=v.player,editor=v.input,draft=v.memory.draft,url=v.previewUrl,row=rows(v)[0],pageInfo=v.pageInfo,previous=v.previousPageButton,next=v.nextPageButton;f.mounts[0].hooks.state({time:59.5,rate:2,volume:.4,loopA:55,loopB:65});const beforeSaves=f.layoutSaves;
 button(v.contentEl,'紧凑显示摘录').click();assert.equal(v.getState().recordDensity,'compact');assert.equal(v.contentEl.dataset.recordDensity,'compact');assert.equal(button(v.contentEl,'舒展显示摘录').getAttribute('aria-pressed'),'true');assert.ok(f.layoutSaves>beforeSaves);assert.equal(v.player,player);assert.equal(v.input,editor);assert.equal(editor.selectionStart,2);assert.equal(editor.selectionEnd,9);assert.equal(v.memory.draft,draft);assert.equal(draft.image,image);assert.equal(v.previewUrl,url);assert.equal(rows(v)[0],row);assert.equal(v.pageStart,50);assert.equal(v.pageInfo,pageInfo);assert.equal(v.previousPageButton,previous);assert.equal(v.nextPageButton,next);assert.deepEqual(v.currentPlayback(),{time:59.5,rate:2,volume:.4,loopA:55,loopB:65});assert.equal(f.mounts.length,1);
 button(v.contentEl,'舒展显示摘录').click();assert.equal(v.getState().recordDensity,'comfortable');assert.equal(rows(v)[0],row);assert.equal(v.memory.draft,draft);assert.equal(v.canMove(),false);await v.onClose();
});

test('record density restores from persisted state and same-source setState preserves the editor and page',async()=>{
 const f=fixture(),v=f.view();f.setRead(async()=>({entries:Array.from({length:60},(_,i)=>({id:String(i),time:i,text:`entry-${i}`,line:i+1}))}));await v.setState({file:f.a.path,recordDensity:'compact'});assert.equal(v.recordDensity,'compact');v.nextPageButton.click();const editor=v.input,player=v.player,row=rows(v)[0];await v.setState({file:f.a.path,recordDensity:'comfortable'});assert.equal(v.recordDensity,'comfortable');assert.equal(v.input,editor);assert.equal(v.player,player);assert.equal(rows(v)[0],row);assert.equal(v.pageStart,50);await v.setState({file:f.a.path,recordDensity:'unknown'});assert.equal(v.recordDensity,'comfortable');
 v.setRecordDensity('compact');const state=v.getState();await v.onClose();const restored=f.view();await restored.setState(state);assert.equal(restored.getState().recordDensity,'compact');assert.equal(restored.contentEl.dataset.recordDensity,'compact');assert.equal(restored.densityButton.getAttribute('aria-pressed'),'true');await restored.onClose();
});

test('density and narrow panel switches do not relax screenshot-pending or IME draft protections',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path,placement:'sidebar'});const hooks=f.mounts[0].hooks;hooks.frameCaptureState!(true,11);v.input.value='pending';v.input.oninput();const draft=v.memory.draft,editor=v.input;v.input.dispatch('compositionstart');v.input.value='输入法未提交';button(v.contentEl,'紧凑显示摘录').click();button(v.contentEl,'时间轴').click();button(v.contentEl,'写摘录').click();assert.equal(v.input,editor);assert.equal(editor.value,'输入法未提交');assert.equal(v.composing,true);assert.equal(v.saveButton.disabled,true);assert.equal(v.clearButton.disabled,true);await v.saveDraft();assert.equal(f.saves.length,0);
 editor.dispatch('compositionend');await hooks.frame(new Blob(['frame']),11);hooks.frameCaptureState!(false,11);assert.equal(v.memory.draft,draft);assert.equal(draft.text,'输入法未提交');assert.equal(draft.time,11);await v.saveDraft();assert.equal(f.saves.length,1);await v.onClose();
});

test('opening another menu, changing source and closing the view each retire the previous native menu',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const first=more(v),second=more(v);assert.equal(first.hidden,true);assert.equal(second.hidden,false);assert.equal(v.contextMenu,second);
 await v.setState({file:f.b.path});assert.equal(second.hidden,true);assert.equal(v.contextMenu,undefined);const current=more(v);await v.onClose();assert.equal(current.hidden,true);assert.equal(v.contextMenu,undefined);assert.equal(v.contentEl.onpointerdown,null);assert.ok(Menu.instances.slice(-3).every(menu=>menu.hidden));
});

test('layout details stay open for inside interaction and close for outside clicks or the more menu',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});const options=v.contentEl.querySelector('.ts-media-workspace__layout-options') as Element,player=v.player,editor=v.input;
 options.open=true;v.contentEl.onpointerdown({target:v.layoutRange});assert.equal(options.open,true);v.contentEl.onpointerdown({target:v.input});assert.equal(options.open,false);options.open=true;more(v,{detail:1,clientX:9,clientY:20});assert.equal(options.open,false);assert.equal(v.player,player);assert.equal(v.input,editor);assert.equal(f.mounts.length,1);await v.onClose();assert.equal(v.contentEl.onpointerdown,null);
});

function localDrafts(){
 const rows=new Map<string,StoredMediaDraft>();let failRemove=false,failPut=false;
 const storage={read:async()=>[...rows.values()].map(value=>structuredClone(value)),put:async(value:StoredMediaDraft)=>{if(failPut)throw Error('quota');rows.set(value.id,structuredClone(value));},remove:async(id:string)=>{if(failRemove)throw Error('disk');rows.delete(id);}};
 const create=()=>new MediaDraftStore(storage,()=>{},{setTimeout:()=>1,clearTimeout:()=>{}});
 return{rows,create,failRemove:(v:boolean)=>failRemove=v,failPut:(v:boolean)=>failPut=v};
}
test('local draft survives host replacement, requires a decision, and duplicate restore shares one stable draft',async()=>{
 const disk=localDrafts(),store=disk.create(),first=fixture(store),v=first.view();await v.setState({file:first.a.path});await frame(first.mounts[0].hooks,new Blob(['pixels'],{type:'image/png'}),7.25);v.input.value='跨重启文字';v.input.oninput();const id=v.memory.draft.id;await v.onClose();
 assert.equal(disk.rows.size,1);assert.equal(first.saves.length,0);
 const restarted=disk.create();await restarted.load();const next=fixture(restarted),a=next.view();await a.setState({file:next.a.path});assert.equal(a.input.value,'');assert.equal(a.input.readOnly,true);assert.equal(next.saves.length,0);
 const recovered=restarted.activate(id);assert.equal(a.input.value,'跨重启文字');assert.equal(a.input.readOnly,false);assert.equal(await a.memory.draft.image.text(),'pixels');assert.equal(a.memory.draft.time,7.25);assert.equal(restarted.activate(id),recovered);
 const b=next.view();await b.setState({file:next.a.path});assert.equal(a.memory,b.memory);await a.saveDraft();assert.equal(next.saves.length,1);assert.equal(next.saves[0].data.id,id);assert.equal(disk.rows.size,0);await a.saveDraft();assert.equal(next.saves.length,1);await a.onClose();await b.onClose();
});
test('discarding pending recovery unlocks the composer and never writes a note',async()=>{
 const disk=localDrafts(),s=disk.create(),first=fixture(s),v=first.view();await v.setState({file:first.a.path});v.input.value='discard';v.input.oninput();await v.onClose();const next=disk.create();await next.load();const f=fixture(next),reopen=f.view();await reopen.setState({file:f.a.path});assert.equal(reopen.input.readOnly,true);await next.discard(next.pending()[0].id);assert.equal(reopen.input.readOnly,false);assert.equal(f.saves.length,0);const third=disk.create();await third.load();assert.equal(third.pending().length,0);await reopen.onClose();
});
test('source replacement keeps recovered text and image read-only and refuses note writes',async()=>{
 const disk=localDrafts(),s=disk.create(),first=fixture(s),v=first.view();await v.setState({file:first.a.path});await frame(first.mounts[0].hooks,new Blob(['frame'],{type:'image/png'}),4);v.input.value='source bound';v.input.oninput();await v.onClose();const next=disk.create();await next.load();const f=fixture(next);f.a.stat.mtime++;const reopened=f.view();await reopened.setState({file:f.a.path});next.activate(next.pending()[0].id);assert.equal(reopened.input.readOnly,true);assert.equal(reopened.input.value,'source bound');assert.equal(reopened.saveButton.disabled,true);await assert.rejects(reopened.saveDraft());assert.equal(f.saves.length,0);assert.equal(disk.rows.size,1);await reopened.clearDraft();assert.equal(disk.rows.size,0);await reopened.onClose();
});
test('failed cleanup after a note save retains a locked retry snapshot across restart',async()=>{
 const disk=localDrafts(),s=disk.create(),f=fixture(s),v=f.view();await v.setState({file:f.a.path});v.input.value='saved but receipt uncertain';v.input.oninput();disk.failRemove(true);await assert.rejects(v.saveDraft());assert.equal(f.saves.length,1);assert.equal(v.memory.draft.locked,true);assert.equal(v.input.readOnly,true);assert.equal(disk.rows.values().next().value?.locked,true);await v.onClose();
 const next=disk.create();await next.load();const f2=fixture(next),w=f2.view();await w.setState({file:f2.a.path});next.activate(next.pending()[0].id);disk.failRemove(false);await w.saveDraft();assert.deepEqual(f2.saves[0].data,f.saves[0].data);assert.equal(disk.rows.size,0);await w.onClose();
});
test('failed local removal keeps visible text and pending save blocks edits until cleanup settles',async()=>{
 const disk=localDrafts(),s=disk.create(),f=fixture(s),v=f.view();await v.setState({file:f.a.path});v.input.value='keep';v.input.oninput();await s.flush();disk.failRemove(true);await assert.rejects(v.clearDraft());assert.equal(v.input.value,'keep');assert.equal(disk.rows.size,1);disk.failRemove(false);await v.clearDraft();assert.equal(v.input.value,'');assert.equal(disk.rows.size,0);await v.onClose();
});

test('right editor height changes preserve draft, capture time, DOM selection and player identity',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});assert.equal(v.getState().composerRatio,40);const player=v.player,input=v.input;v.input.value='preserve selection';v.input.oninput();v.input.selectionStart=3;v.input.selectionEnd=8;v.input.focus();const d=v.memory.draft;
 v.composerRange.value='60';v.composerRange.oninput();assert.equal(v.getState().composerRatio,60);assert.equal(v.contentEl.style.getPropertyValue('--ts-mw-composer'),'60%');assert.equal(v.player,player);assert.equal(v.input,input);assert.equal(v.input.selectionStart,3);assert.equal(v.input.selectionEnd,8);assert.equal(v.memory.draft,d);assert.equal(input.ownerDocument.activeElement,input);
 await v.setState({...v.getState(),composerRatio:48,time:undefined});assert.equal(v.getState().composerRatio,48);assert.equal(f.mounts.length,1);const state={...v.getState(),composerRatio:60};await v.onClose();const reopened=f.view();await reopened.setState(state);assert.equal(reopened.getState().composerRatio,60);assert.equal(reopened.memory.draft,d);await reopened.onClose();
});
test('draft footer distinguishes local durability, errors and explicit note persistence',async()=>{
 const disk=localDrafts(),s=disk.create(),f=fixture(s),v=f.view();await v.setState({file:f.a.path});v.input.value='local only';v.input.oninput();assert.match(v.draftStatus.textContent,/正在暂存/);assert.match(v.timeLabel.textContent,/摘录 /);await s.flush();assert.match(v.draftStatus.textContent,/已暂存本机.*尚未写入/);assert.equal(f.saves.length,0);v.input.value='new';v.input.oninput();disk.failPut(true);await assert.rejects(s.flush());assert.match(v.draftStatus.textContent,/暂存失败/);assert.equal(v.input.value,'new');disk.failPut(false);await v.saveDraft();assert.equal(f.saves.length,1);assert.match(v.saveTarget.title,/notes\/A.md/);assert.match(v.timeLabel.textContent,/播放 /);await v.onClose();
});


test('right-hand separator keyboard resizing preserves the current editor and draft',async()=>{
 const f=fixture(),v=f.view();await v.setState({file:f.a.path});v.input.value='keep';v.input.oninput();const input=v.input,draft=v.memory.draft,player=v.player;
 const divider=v.contentEl.querySelector('.ts-media-workspace__composer-divider');let prevented=false;divider.onkeydown({key:'ArrowDown',preventDefault:()=>{prevented=true;}});assert.equal(v.getState().composerRatio,42);assert.equal(divider.getAttribute('aria-valuenow'),'42');assert.equal(prevented,true);assert.equal(v.input,input);assert.equal(v.player,player);assert.equal(v.memory.draft,draft);await v.onClose();
});

test('pending recovery is actionable in the source header and leaves the draft read-only',async()=>{
 const disk=localDrafts();disk.rows.set('header',{version:1,id:'header',text:'pending',time:1,updatedAt:1,source:{path:'media/A.mp4',mtime:100,size:1000}});const store=disk.create();await store.load();const f=fixture(store),v=f.view();let opened=0;f.host.recoverDrafts=()=>{opened++;};await v.setState({file:f.a.path});
 assert.equal(v.contentEl.querySelector('.ts-media-workspace__header').contains(v.status),true);assert.equal(v.recoveryButton.hidden,false);assert.equal(v.input.readOnly,true);assert.equal(v.draftStatus.textContent,'待恢复 / 丢弃');await v.recoveryButton.click();assert.equal(opened,1);await v.onClose();
});
