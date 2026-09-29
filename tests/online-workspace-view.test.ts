import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as onlinePlatform from '../src/online-platform';
import * as mediaSource from '../src/media-source';
import type {OnlineSource,OnlineState} from '../src/online-platform';

// The view runs against the same small Obsidian DOM surface it uses in production.
// No browser, platform window, network request or vault write is needed here.
let documentId=0;
class ObjectURLs {
 private id=++documentId;
 created:{url:string;blob:Blob}[]=[];revoked:string[]=[];active=new Map<string,Blob>();
 createObjectURL(blob:Blob){const url=`blob:online-${this.id}-${this.created.length}`;this.created.push({url,blob});this.active.set(url,blob);return url;}
 revokeObjectURL(url:string){this.revoked.push(url);this.active.delete(url);}
}
class Element {
 children:Element[]=[];parentElement?:Element;dataset:Record<string,string>={};attributes=new Map<string,string>();
 ownerDocument:{defaultView:{setTimeout:typeof setTimeout;clearTimeout:typeof clearTimeout;URL:ObjectURLs;Blob:typeof Blob};activeElement?:Element}={defaultView:{setTimeout,clearTimeout,URL:new ObjectURLs(),Blob}};
 className='';textContent='';value='';title='';placeholder='';type='';disabled=false;readOnly=false;hidden=false;open=false;
 listeners=new Map<string,((event:any)=>unknown)[]>();
 onclick?:((event:any)=>unknown)|null;oninput?:((event:any)=>unknown)|null;onchange?:((event:any)=>unknown)|null;onkeydown?:((event:any)=>unknown)|null;
 style={setProperty:()=>{},removeProperty:()=>{}};
 get src(){return this.getAttribute('src')||'';}set src(value:string){this.setAttribute('src',value);}
 createDiv(options?:unknown){return this.createEl('div',options);}
 createSpan(options?:unknown){return this.createEl('span',options);}
 createEl(tag:string,options?:unknown){
  const node=new Element();node.parentElement=this;node.ownerDocument=this.ownerDocument;node.attributes.set('tag',tag);
  if(typeof options==='string')node.className=options;
  else if(options&&typeof options==='object'){
   const data=options as {cls?:string;text?:string;value?:string;type?:string;attr?:Record<string,string>};
   node.className=data.cls||'';node.textContent=data.text||'';node.value=data.value||'';
   if(data.type)node.setAttribute('type',data.type);for(const[key,value]of Object.entries(data.attr||{}))node.setAttribute(key,value);
  }
  this.children.push(node);return node;
 }
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 matches(selector:string){
  const attribute=/\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
  if(attribute){if(!this.attributes.has(attribute[1])||attribute[2]!==undefined&&this.attributes.get(attribute[1])!==attribute[2])return false;selector=selector.slice(0,attribute.index);}
  const[tag,...classes]=selector.split('.');return(!tag||this.attributes.get('tag')===tag)&&classes.every(value=>this.className.split(' ').includes(value));
 }
 querySelectorAll(selector:string):Element[]{
  const parts=selector.trim().split(/\s+/);let nodes:Element[]=[this];
  for(const part of parts)nodes=nodes.flatMap(node=>node.all().slice(1).filter(candidate=>candidate.matches(part)));
  return[...new Set(nodes)];
 }
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
 contains(node:Element){return this.all().includes(node);}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];this.textContent='';}
 append(...nodes:Element[]){for(const node of nodes){node.remove();node.parentElement=this;node.ownerDocument=this.ownerDocument;this.children.push(node);}}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 addClass(...names:string[]){this.className=[...new Set([...this.className.split(' '),...names])].filter(Boolean).join(' ');}
 removeClass(...names:string[]){this.className=this.className.split(' ').filter(value=>!names.includes(value)).join(' ');}
 toggleClass(name:string,on:boolean){if(on)this.addClass(name);else this.removeClass(name);}
 setAttribute(key:string,value:string){this.attributes.set(key,String(value));if(key==='type')this.type=String(value);}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 removeAttribute(key:string){this.attributes.delete(key);}
 addEventListener(type:string,fn:(event:any)=>unknown){this.listeners.set(type,[...this.listeners.get(type)||[],fn]);}
 removeEventListener(type:string,fn:(event:any)=>unknown){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==fn));}
 dispatch(type:string,event:Record<string,unknown>={}){
  const data={target:this,currentTarget:this,preventDefault:()=>{},stopPropagation:()=>{},...event};
  const handler=this['on'+type as 'oninput'];handler?.(data);for(const fn of this.listeners.get(type)||[])fn(data);
 }
 click(){if(!this.disabled)this.dispatch('click');}
 focus(){this.ownerDocument.activeElement=this;}
}
class TFile {
 constructor(public path:string){}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
 get extension(){return this.path.split('.').at(-1)!;}
}
class ItemView {
 app:any;contentEl=new Element();containerEl=new Element();
 constructor(public leaf:{app:unknown}){this.app=leaf.app;}
 registerEvent(_event:unknown){}
 registerDomEvent(el:Element,type:string,callback:(event:any)=>unknown){el.addEventListener(type,callback);}
}
class Component {
 loads=0;unloads=0;
 load(){this.loads++;}
 unload(){this.unloads++;}
}
const markdownRenders:{text:string;holder:Element;path:string;component:Component}[]=[];
class MarkdownRenderer {
 static async render(_app:unknown,text:string,holder:Element,path:string,component:Component){markdownRenders.push({text,holder,path,component});holder.createSpan({text});}
}
const notices:string[]=[];
const errorsLogged:unknown[][]=[];
const compiled=transformSync(readFileSync('src/online-workspace-view.ts','utf8'),{loader:'ts',format:'cjs'}).code;
const module={exports:{}};
new Function('require','module','exports','console',compiled)((name:string)=>{
 if(name==='obsidian')return{ItemView,TFile,Component,MarkdownRenderer,setIcon:()=>{},Notice:class{constructor(message:string){notices.push(message);}}};
 if(name==='./online-platform')return onlinePlatform;
 if(name==='./media-source')return mediaSource;
 throw Error(`Unexpected runtime dependency: ${name}`);
},module,module.exports,{error:(...values:unknown[])=>errorsLogged.push(values)});
const {OnlineWorkspaceView}=module.exports as {OnlineWorkspaceView:new(leaf:unknown,host:unknown)=>any};
const source=(path:string)=>{const result=onlinePlatform.parseOnlineSource(path);assert.ok(result);return result;};
const youtube=source('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
const another=source('https://www.youtube.com/watch?v=abcdefghijk');
const biliOne=source('https://www.bilibili.com/video/BV1xx411c7mD/?p=1');
const biliTwo=source('https://www.bilibili.com/video/BV1xx411c7mD/?p=2');
function find(root:Element,tag:string,label:string){const node=root.all().find(el=>el.attributes.get('tag')===tag&&el.getAttribute('aria-label')===label);assert.ok(node,`${tag} with label ${label} exists`);return node;}
const button=(view:any,label:string)=>find(view.contentEl,'button',label);
const editor=(view:any)=>{const node=view.contentEl.querySelector('textarea');assert.ok(node,'draft editor exists');return node as Element;};
async function settle(){await new Promise<void>(resolve=>setImmediate(resolve));}
async function click(view:any,label:string){button(view,label).click();await settle();}
function type(node:Element,value:string){assert.equal(node.disabled||node.readOnly,false,'input is editable');node.value=value;node.dispatch('input');}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
type Moment={id:string;time:number;text:string;line:number;image?:string};
type Draft={id:string;time:number;text:string;image?:Blob};
type Capture={blob:Blob;time:number};
type Timeline={note?:TFile;entries:Moment[];warnings?:string[]};
const synchronized=(value:OnlineSource,time=12.5):OnlineState=>({sourcePath:value.path,available:true,closed:false,time,duration:600,paused:false,rate:1,status:'synced'});
function fixture(){
 const noteA=new TFile('notes/A.md'),noteB=new TFile('notes/B.md');
 let live:OnlineState|undefined,layoutSaves=0;
 const listeners=new Set<(state:OnlineState)=>void>(),subscriptions:((state:OnlineState)=>void)[]=[];
 const saves:{source:string;data:Draft;note?:string}[]=[],commands:{source:string;action:string;value?:number}[]=[],opens:{source:string;placement:string;time?:number;note?:string}[]=[],reads:{source:string;note?:string}[]=[],adoptions:{source:string;placement:string}[]=[],captures:string[]=[],sent:{source:string;time?:number;text?:string;image?:string}[]=[];
 const mounts:{host:Element;source:string;released:number}[]=[],mountEvents:string[]=[];
 let read=async(_source:string,_note?:string):Promise<Timeline>=>({entries:[]});
 let write=async(_source:string,_data:Draft,_note?:string)=>({note:noteA});
 let capture=async(_source:string):Promise<Capture>=>({blob:new Blob(['PNG'],{type:'image/png'}),time:live?.time??0});
 const host={
  mount:(host:Element,source:string)=>{const mounted={host,source,released:0};mounts.push(mounted);mountEvents.push(`mount:${source}`);return()=>{mounted.released++;mountEvents.push(`release:${source}`);};},
  pick:()=>{},open:async(source:string,placement:string,time?:number,note?:string)=>{opens.push({source,placement,time,note});},
  state:()=>live,subscribe:(fn:(state:OnlineState)=>void)=>{listeners.add(fn);subscriptions.push(fn);return()=>listeners.delete(fn);},
  command:async(source:string,action:string,value?:number)=>{commands.push({source,action,value});},adopt:async(source:string,placement:string)=>{adoptions.push({source,placement});},
  notes:(source:string,note?:string)=>{reads.push({source,note});return read(source,note);},
  save:(source:string,data:Draft,note?:string)=>{saves.push({source,data:{...data},note});return write(source,data,note);},
  capture:(source:string)=>{captures.push(source);return capture(source);},
  send:async(source:string,time?:number,text?:string,image?:string)=>{sent.push({source,time,text,image});},openNote:async()=>{},
 };
 const app={workspace:{requestSaveLayout:()=>{layoutSaves++;}}};
 const view=()=>new OnlineWorkspaceView({app},host);
 const publish=(state:OnlineState)=>{live=state;for(const fn of listeners)fn(state);};
 return{view,host,publish,noteA,noteB,saves,commands,opens,reads,adoptions,captures,sent,subscriptions,listeners,mounts,mountEvents,
  get layoutSaves(){return layoutSaves;},setRead:(fn:typeof read)=>{read=fn;},setWrite:(fn:typeof write)=>{write=fn;},setCapture:(fn:typeof capture)=>{capture=fn;}};
}
async function open(f:ReturnType<typeof fixture>,value=youtube,state:Record<string,unknown>={}){const view=f.view();await view.onOpen();await view.setState({source:value.path,...state});return view;}
const rows=(view:any):Element[]=>(view.contentEl as Element).querySelectorAll('.ts-online-workspace__moment');
const status=(view:any)=>(view.contentEl as Element).querySelector('.ts-online-workspace__status')!.textContent;
const urls=(view:any):ObjectURLs=>(view.contentEl as Element).ownerDocument.defaultView.URL;
const preview=(view:any):Element|null=>(view.contentEl as Element).querySelector('.ts-online-workspace__draft-image');

test('the embedded player mounts into its connected view only after selecting a source and never launches itself',async()=>{
 const f=fixture(),v=f.view();await v.onOpen();assert.equal(f.mounts.length,0);
 await v.setState({source:youtube.path});assert.equal(f.mounts.length,1);
 const mount=f.mounts[0];assert.equal(mount.source,youtube.path);assert.equal(mount.host.className,'ts-online-workspace__embed');assert.equal(v.contentEl.contains(mount.host),true);
 assert.equal(mount.host.parentElement?.className,'ts-online-workspace__player');assert.deepEqual(f.opens,[]);assert.deepEqual(f.commands,[]);
 assert.equal(v.contentEl.all().some((node:Element)=>node.textContent.includes('平台窗口')),false);
 await v.onClose();assert.equal(mount.released,1);
});

test('same source state, placement updates, timeline refreshes and playback ticks preserve the embedded player',async()=>{
 const f=fixture(),v=await open(f),embed=f.mounts[0].host;
 await v.setState({source:youtube.path,time:77});await v.setState({source:youtube.path,placement:'sidebar'});
 for(let tick=0;tick<20;tick++)f.publish(synchronized(youtube,tick*.4));await click(v,'刷新摘录');
 assert.equal(f.mounts.length,1);assert.equal(f.mounts[0].released,0);assert.equal(v.contentEl.querySelector('.ts-online-workspace__embed'),embed);
 assert.equal(v.getState().placement,'sidebar');assert.equal(f.opens.length,0);await v.onClose();assert.equal(f.mounts[0].released,1);
});

test('source replacement releases the previous embed before mounting the new one and close releases once',async()=>{
 const f=fixture(),v=await open(f);await v.setState({source:another.path});
 assert.deepEqual(f.mountEvents,[`mount:${youtube.path}`,`release:${youtube.path}`,`mount:${another.path}`]);
 assert.equal(f.mounts[0].released,1);assert.equal(f.mounts[1].released,0);assert.equal(v.contentEl.contains(f.mounts[0].host),false);
 await v.onClose();await v.onClose();assert.equal(f.mounts[1].released,1);assert.equal(f.mounts[0].released,1);
});

test('re-rendering for a different note releases its old player and an older view cannot release a newer mount',async()=>{
 const f=fixture(),first=await open(f,youtube,{note:f.noteA.path});await first.setState({source:youtube.path,note:f.noteB.path});
 assert.equal(f.mounts.length,2);assert.equal(f.mounts[0].released,1);
 const next=await open(f,youtube,{note:f.noteB.path});assert.equal(f.mounts.length,3);await first.onClose();
 assert.equal(f.mounts[1].released,1);assert.equal(f.mounts[2].released,0);assert.equal(next.contentEl.contains(f.mounts[2].host),true);
 await next.onClose();assert.equal(f.mounts[2].released,1);
});

test('loading uses the mounted source and retry reloads it without remounting or opening another view',async()=>{
 const f=fixture(),v=await open(f,youtube,{time:42});await click(v,'加载视频 / 重试');
 assert.deepEqual(f.opens,[{source:youtube.path,placement:'tab',time:42,note:undefined}]);assert.equal(f.mounts.length,1);
 f.publish({...synchronized(youtube),available:false,status:'error',error:'视频加载失败'});await click(v,'加载视频 / 重试');
 assert.deepEqual(f.commands,[{source:youtube.path,action:'reload',value:undefined}]);assert.equal(f.opens.length,1);assert.equal(f.mounts.length,1);
 await v.onClose();
});

test('platform errors are visible only for the selected source and clear when synchronization recovers',async()=>{
 const f=fixture(),v=await open(f),error=v.contentEl.querySelector('.ts-online-workspace__player-error');assert.equal(error.hidden,true);
 f.publish({...synchronized(youtube),available:false,status:'blocked',error:'请在播放器内登录后重试'});
 assert.equal(error.hidden,false);assert.equal(error.textContent,'请在播放器内登录后重试');
 f.publish({...synchronized(another),available:false,status:'error',error:'不应显示其他视频错误'});assert.equal(error.hidden,true);assert.equal(error.textContent,'');
 f.publish(synchronized(youtube));assert.equal(error.hidden,true);await v.onClose();
});

test('action failures retain a bounded plain-text reason instead of replacing it with a generic error',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));f.host.command=async()=>{throw Error('需要登录\u0000\n<script>nothing</script>'+'.'.repeat(700));};
 await click(v,'播放或暂停');assert.match(status(v),/播放或暂停失败：需要登录 <script>nothing<\/script>/);assert.doesNotMatch(status(v),/操作未完成/);
 assert.ok(status(v).length<450);assert.ok(errorsLogged.at(-1)?.[1] instanceof Error);
 assert.equal(v.contentEl.querySelectorAll('script').length,0);await v.onClose();
});

test('specific screenshot, save and note-read errors survive their UI catch paths',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));type(editor(v),'keep my draft');
 f.setCapture(async()=>{throw Error('请将页面缩放恢复到 100%');});await click(v,'快速截图');assert.match(status(v),/截图失败：请将页面缩放恢复到 100%/);
 f.setWrite(async()=>{throw Error('原笔记已移动，请重新打开');});await click(v,'保存摘录');assert.match(status(v),/保存摘录失败：原笔记已移动，请重新打开/);assert.equal(editor(v).value,'keep my draft');
 f.setRead(async()=>{throw Error('部分笔记尚未完成索引');});await click(v,'刷新摘录');assert.match(status(v),/读取摘录失败：部分笔记尚未完成索引/);
 await v.onClose();
});

test('capture and save reservations also block the player reload action',async()=>{
 const f=fixture(),v=await open(f),capture=deferred<Capture>(),save=deferred<{note:TFile}>();f.publish(synchronized(youtube));f.setCapture(()=>capture.promise);
 await click(v,'快速截图');assert.equal(button(v,'加载视频 / 重试').disabled,true);await click(v,'加载视频 / 重试');assert.equal(f.commands.length,0);
 capture.resolve({blob:new Blob(['frame'],{type:'image/png'}),time:12});await settle();assert.equal(button(v,'加载视频 / 重试').disabled,false);
 f.setWrite(()=>save.promise);await click(v,'保存摘录');assert.equal(button(v,'加载视频 / 重试').disabled,true);await click(v,'加载视频 / 重试');assert.equal(f.commands.length,0);
 save.resolve({note:f.noteA});await settle();assert.equal(button(v,'加载视频 / 重试').disabled,false);await v.onClose();
});

test('manual time stays in a collapsed fallback and is hidden and disabled while video time is synchronized',async()=>{
 const f=fixture(),v=await open(f),fallback=v.contentEl.querySelector('details.ts-online-workspace__manual-fallback'),manual=find(v.contentEl,'input','手动摘录时间');
 assert.ok(fallback);assert.equal(fallback.hidden,false);assert.equal(fallback.open,false);assert.equal(fallback.contains(manual),true);
 assert.equal(fallback.querySelector('summary').textContent,'手动时间（备用）');assert.equal(editor(v).readOnly,true);
 f.publish(synchronized(youtube,31));assert.equal(fallback.hidden,true);assert.equal(manual.disabled,true);assert.equal(button(v,'确认时间').disabled,true);
 manual.value='999';button(v,'确认时间').dispatch('click');await settle();await click(v,'记下此刻');await click(v,'保存摘录');assert.equal(f.saves[0].data.time,31);
 f.publish({...synchronized(youtube),available:false,status:'waiting'});assert.equal(fallback.hidden,false);assert.equal(fallback.open,false);assert.equal(manual.disabled,false);
 await v.onClose();
});

test('manually confirmed fallback time and disclosure choice survive synchronization without changing a frozen draft',async()=>{
 const f=fixture(),v=await open(f),fallback=v.contentEl.querySelector('details.ts-online-workspace__manual-fallback'),manual=find(v.contentEl,'input','手动摘录时间');
 fallback.open=true;type(manual,'1:15');await click(v,'确认时间');await click(v,'记下此刻');
 assert.equal(button(v,'快速截图').disabled,true);f.publish(synchronized(youtube,300));assert.equal(fallback.hidden,true);assert.equal(fallback.open,true);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,75);assert.equal(f.saves[0].data.text,'');
 f.publish({...synchronized(youtube),available:false});assert.equal(fallback.hidden,false);assert.equal(fallback.open,true);await v.onClose();
});

test('only an available, open, matching source enables playback controls or exposes its time',async()=>{
 const f=fixture(),v=await open(f);
 const controls=['播放或暂停','后退 10 秒','前进 10 秒','跳转'];
 assert.equal(v.getViewType(),'thoughtspace-online-player');assert.equal(Object.hasOwn(v.getState(),'time'),false);
 for(const patch of [{available:false},{closed:true},{sourcePath:another.path},{time:NaN},{time:Infinity},{time:-1}]){
  f.publish({...synchronized(youtube,61.25),...patch});
  for(const label of controls){assert.equal(button(v,label).disabled,true,JSON.stringify(patch));button(v,label).click();}
  assert.equal(find(v.contentEl,'select','播放速度').disabled,true);
  assert.equal(editor(v).readOnly,true);assert.equal(Object.hasOwn(v.getState(),'time'),false);
  assert.equal(v.contentEl.querySelector('.ts-online-workspace__clock').textContent,'时间未同步');
 }
 assert.deepEqual(f.commands,[]);f.publish(synchronized(youtube,61.25));
 for(const label of controls)assert.equal(button(v,label).disabled,false);
 assert.equal(v.getState().time,61.25);await click(v,'播放或暂停');
 assert.deepEqual(f.commands,[{source:youtube.path,action:'toggle',value:undefined}]);await v.onClose();
});

test('requested, stale, and wrong-part timestamps never enter layout state as verified playback',async()=>{
 const f=fixture(),v=await open(f,biliOne,{time:99});
 assert.equal(Object.hasOwn(v.getState(),'time'),false);
 f.publish(synchronized(biliOne,7));assert.equal(v.getState().time,7);
 for(const next of [{...synchronized(biliOne,88),available:false},{...synchronized(biliOne,88),closed:true},synchronized(biliTwo,88)]){
  f.publish(next);assert.equal(Object.hasOwn(v.getState(),'time'),false);assert.equal(editor(v).readOnly,true);
 }
 await v.onClose();
});

test('the first input freezes an exact timestamp and draft blocks source or placement changes',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,12.125));
 type(editor(v),'first thought');f.publish(synchronized(youtube,75));type(editor(v),'first thought\n**more detail**');
 assert.equal(v.canMove(),false);await v.setState({source:another.path});await click(v,'独立窗口');
 assert.equal(v.currentSource().path,youtube.path);assert.equal(v.getState().placement,'tab');assert.equal(f.opens.length,0);
 assert.match(v.contentEl.querySelector('.ts-online-workspace__draft-time').textContent,/0:12.*已固定/);
 await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.time,12.125);
 assert.equal(f.saves[0].data.text,'first thought\n**more detail**');assert.match(f.saves[0].data.id,/^[\w-]+$/);assert.equal(v.canMove(),true);await v.onClose();
});

test('draft text and its original time survive close and reopen without requiring playback',async()=>{
 const f=fixture(),first=await open(f);f.publish(synchronized(youtube,17.75));type(editor(first),'keep after closing');await first.onClose();
 f.publish({...synchronized(youtube,280),available:false,closed:true});const restored=await open(f);
 assert.equal(editor(restored).value,'keep after closing');assert.equal(restored.canMove(),false);assert.equal(button(restored,'保存摘录').disabled,false);
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,17.75);assert.equal(f.saves[0].data.text,'keep after closing');await restored.onClose();
});

test('discovering a note aliases the original draft so saved layout restores it with the note path',async()=>{
 const f=fixture();f.setRead(async()=>({note:f.noteA,entries:[]}));const first=await open(f);f.publish(synchronized(youtube,31.5));type(editor(first),'draft before layout restore');
 const layout=first.getState();assert.equal(layout.note,f.noteA.path);await first.onClose();
 const restored=await open(f,youtube,layout);assert.equal(editor(restored).value,'draft before layout restore');assert.equal(restored.canMove(),false);
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,31.5);assert.equal(f.saves[0].note,f.noteA.path);await restored.onClose();
});

test('two note destinations for one video keep their drafts separate',async()=>{
 const f=fixture();f.setRead(async(_source,note)=>({note:note===f.noteB.path?f.noteB:f.noteA,entries:[]}));
 const first=await open(f,youtube,{note:f.noteA.path});f.publish(synchronized(youtube,3));type(editor(first),'first destination');await first.onClose();
 const second=await open(f,youtube,{note:f.noteB.path});assert.equal(editor(second).value,'');f.publish(synchronized(youtube,5));type(editor(second),'second destination');await second.onClose();
 const restored=await open(f,youtube,{note:f.noteA.path});assert.equal(editor(restored).value,'first destination');await click(restored,'保存摘录');assert.equal(f.saves[0].note,f.noteA.path);assert.equal(f.saves[0].data.time,3);await restored.onClose();
});

test('manual time must be explicitly confirmed before typing or saving an unsynchronized draft',async()=>{
 const f=fixture(),v=await open(f,youtube,{time:555});const input=editor(v),manual=find(v.contentEl,'input','手动摘录时间');
 type(manual,'1:30');assert.equal(input.readOnly,true);assert.equal(button(v,'保存摘录').disabled,true);
 input.value='premature input';input.dispatch('input');assert.equal(input.value,'');assert.equal(v.canMove(),true);
 await click(v,'保存摘录');assert.equal(f.saves.length,0);
 await click(v,'确认时间');assert.equal(input.readOnly,false);type(input,'manual observation');
 f.publish(synchronized(youtube,300));await click(v,'保存摘录');assert.equal(f.saves[0].data.time,90);assert.equal(f.saves[0].data.text,'manual observation');
 await v.onClose();
});

test('invalid manual time does not authorize input and cancel clears a confirmed timestamp',async()=>{
 const f=fixture(),v=await open(f),manual=find(v.contentEl,'input','手动摘录时间');
 for(const value of ['','nonsense','-1','1:99']){type(manual,value);await click(v,'确认时间');assert.equal(editor(v).readOnly,true);}
 type(manual,'42');await click(v,'确认时间');assert.equal(editor(v).readOnly,false);
 await click(v,'取消摘录');assert.equal(editor(v).readOnly,true);assert.equal(manual.value,'');assert.equal(v.canMove(),true);await v.onClose();
});

test('IME composition and key code 229 suppress Cmd/Ctrl-Enter saving until composition ends',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));const input=editor(v);type(input,'中文摘录');
 input.dispatch('compositionstart');input.dispatch('keydown',{key:'Enter',metaKey:true});input.dispatch('compositionend');
 input.dispatch('keydown',{key:'Enter',ctrlKey:true,isComposing:true});input.dispatch('keydown',{key:'Enter',metaKey:true,keyCode:229});
 await settle();assert.equal(f.saves.length,0);
 input.dispatch('keydown',{key:'Enter',metaKey:true,isComposing:false,keyCode:13});await settle();assert.equal(f.saves.length,1);await v.onClose();
});

test('pending save blocks cancellation, duplicate submits, edits and switching',async()=>{
 const f=fixture(),pending=deferred<{note:TFile}>(),v=await open(f);f.setWrite(()=>pending.promise);f.publish(synchronized(youtube,33));type(editor(v),'immutable pending save');
 await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(button(v,'取消摘录').disabled,true);assert.equal(button(v,'保存摘录').disabled,true);assert.equal(editor(v).readOnly,true);
 await click(v,'取消摘录');await click(v,'保存摘录');await v.setState({source:another.path});await click(v,'右侧栏');
 editor(v).value='must not replace';editor(v).dispatch('input');editor(v).dispatch('keydown',{key:'Enter',ctrlKey:true});
 await settle();assert.equal(editor(v).value,'immutable pending save');assert.equal(v.currentSource().path,youtube.path);assert.equal(f.opens.length,0);assert.equal(f.saves.length,1);assert.equal(v.canMove(),false);
 pending.resolve({note:f.noteA});await settle();assert.equal(editor(v).value,'');assert.equal(v.canMove(),true);await v.onClose();
});

test('a late save after close clears only its original draft and leaves another source untouched',async()=>{
 const f=fixture(),pending=deferred<{note:TFile}>(),old=await open(f);f.setWrite(()=>pending.promise);f.publish(synchronized(youtube,9));type(editor(old),'A draft');await click(old,'保存摘录');await old.onClose();
 const current=await open(f,another);f.publish(synchronized(another,81));type(editor(current),'B draft');
 pending.resolve({note:f.noteA});await settle();assert.equal(current.currentSource().path,another.path);assert.equal(current.currentNote(),undefined);assert.equal(editor(current).value,'B draft');assert.equal(current.canMove(),false);
 await current.onClose();const restoredA=await open(f);assert.equal(editor(restoredA).value,'');assert.equal(restoredA.canMove(),true);await restoredA.onClose();
 const restoredB=await open(f,another);assert.equal(editor(restoredB).value,'B draft');f.setWrite(async()=>({note:f.noteB}));await click(restoredB,'保存摘录');assert.equal(f.saves[1].data.time,81);await restoredB.onClose();
});

test('reopening a source during save cannot duplicate it and observes the eventual completion',async()=>{
 const f=fixture(),pending=deferred<{note:TFile}>(),old=await open(f);f.setWrite(()=>pending.promise);f.publish(synchronized(youtube,8));type(editor(old),'one save');await click(old,'保存摘录');await old.onClose();
 const reopened=await open(f);assert.equal(editor(reopened).value,'one save');assert.equal(editor(reopened).readOnly,true);await click(reopened,'保存摘录');assert.equal(f.saves.length,1);
 pending.resolve({note:f.noteA});await settle();assert.equal(editor(reopened).value,'');assert.equal(reopened.canMove(),true);await reopened.onClose();
});

test('failed save retains exact identity, text and time for a safe retry after reopening',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,28.25));type(editor(v),'retry this');f.setWrite(async()=>{throw Error('disk full');});
 await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(editor(v).value,'retry this');assert.equal(editor(v).readOnly,true);assert.equal(v.canMove(),false);await v.onClose();
 const reopened=await open(f);assert.equal(editor(reopened).readOnly,true);editor(reopened).value='different retry body';editor(reopened).dispatch('input');assert.equal(editor(reopened).value,'retry this');
 f.setWrite(async()=>({note:f.noteA}));await click(reopened,'保存摘录');assert.deepEqual(f.saves[1].data,f.saves[0].data);assert.equal(reopened.canMove(),true);await reopened.onClose();
});

test('400 ms playback state updates preserve the editor, focus, timeline rows and draft',async()=>{
 const f=fixture();f.setRead(async()=>({entries:[{id:'one',time:2,text:'existing note',line:1}]}));const v=await open(f);
 f.publish(synchronized(youtube,10));const input=editor(v),timeline=v.contentEl.querySelector('.ts-online-workspace__timeline'),row=rows(v)[0];
 type(input,'ongoing typing');input.focus();const reads=f.reads.length;
 for(let tick=1;tick<=25;tick++)f.publish(synchronized(youtube,10+tick*.4));
 assert.equal(editor(v),input);assert.equal(input.ownerDocument.activeElement,input);assert.equal(input.value,'ongoing typing');
 assert.equal(v.contentEl.querySelector('.ts-online-workspace__timeline'),timeline);assert.equal(rows(v)[0],row);assert.equal(f.reads.length,reads);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,10);await v.onClose();
});

test('different Bilibili parts retain independent drafts across close and reopen',async()=>{
 const f=fixture(),first=await open(f,biliOne);f.publish(synchronized(biliOne,11));type(editor(first),'P1 note');await first.onClose();
 const second=await open(f,biliTwo);assert.equal(editor(second).value,'');assert.equal(editor(second).readOnly,true);f.publish(synchronized(biliTwo,22));type(editor(second),'P2 note');await second.onClose();
 const restoredOne=await open(f,biliOne);assert.equal(editor(restoredOne).value,'P1 note');await click(restoredOne,'保存摘录');await restoredOne.onClose();
 const restoredTwo=await open(f,biliTwo);assert.equal(editor(restoredTwo).value,'P2 note');await click(restoredTwo,'保存摘录');await restoredTwo.onClose();
 assert.deepEqual(f.saves.map(save=>[save.source,save.data.time,save.data.text]),[[biliOne.path,11,'P1 note'],[biliTwo.path,22,'P2 note']]);
});

test('timeline shows at most fifty sorted entries per page and retains access to the last page',async()=>{
 const f=fixture();f.setRead(async()=>({entries:Array.from({length:120},(_,index)=>({id:String(index),time:119-index,text:`entry-${119-index}`,line:index+1}))}));
 const v=await open(f);assert.equal(rows(v).length,50);assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'entry-0');
 assert.equal(button(v,'上一页').disabled,true);await click(v,'下一页');assert.equal(rows(v).length,50);assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'entry-50');
 await click(v,'下一页');assert.equal(rows(v).length,20);assert.equal(rows(v)[19].querySelector('.ts-online-workspace__moment-text')!.textContent,'entry-119');assert.equal(button(v,'下一页').disabled,true);await v.onClose();
});

test('late timeline results and state callbacks cannot mutate a different or closed source',async()=>{
 const f=fixture(),slow=deferred<Timeline>();f.setRead(path=>path===youtube.path?slow.promise:Promise.resolve({note:f.noteB,entries:[{id:'b',time:3,text:'B only',line:1}]}));
 const v=f.view();await v.onOpen();const old=v.setState({source:youtube.path});await v.setState({source:another.path});
 slow.resolve({note:f.noteA,entries:[{id:'a',time:1,text:'stale A',line:1}]});await old;
 assert.equal(v.currentNote(),f.noteB.path);assert.equal(rows(v).length,1);assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'B only');
 f.publish(synchronized(youtube,199));assert.equal(Object.hasOwn(v.getState(),'time'),false);assert.equal(button(v,'播放或暂停').disabled,true);
 const callback=f.subscriptions[0];await v.onClose();callback(synchronized(another,300));assert.equal(v.contentEl.children.length,0);assert.equal(f.listeners.size,0);
});

test('an older failed timeline refresh cannot replace a newer successful refresh',async()=>{
 const f=fixture(),v=await open(f),slow=deferred<Timeline>();f.setRead(()=>slow.promise);await click(v,'刷新摘录');
 f.setRead(async()=>({entries:[{id:'fresh',time:5,text:'fresh result',line:1}]}));await click(v,'刷新摘录');slow.reject(Error('old failure'));await settle();
 assert.equal(rows(v)[0].querySelector('.ts-online-workspace__moment-text')!.textContent,'fresh result');assert.doesNotMatch(status(v),/无法读取/);await v.onClose();
});

test('adopting a changed platform video requires a matching candidate and no pending draft',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,14));type(editor(v),'belongs to A');
 f.publish({...synchronized(youtube,20),available:false,status:'source-changed',candidate:another});
 const adopt=button(v,'切换到当前视频');assert.equal(adopt.disabled,true);assert.equal(v.contentEl.querySelector('.ts-online-workspace__candidate').hidden,false);
 adopt.dispatch('click');await settle();assert.deepEqual(f.adoptions,[]);assert.equal(editor(v).value,'belongs to A');
 await click(v,'取消摘录');assert.equal(adopt.disabled,false);await click(v,'切换到当前视频');assert.deepEqual(f.adoptions,[{source:another.path,placement:'tab'}]);
 f.publish({...synchronized(another),available:false,status:'source-changed',candidate:biliOne});
 assert.equal(adopt.disabled,true);assert.equal(v.contentEl.querySelector('.ts-online-workspace__candidate').hidden,true);adopt.dispatch('click');await settle();assert.equal(f.adoptions.length,1);await v.onClose();
});

test('events from detached controls cannot edit, cancel, save or control the newly selected source',async()=>{
 const f=fixture();f.setRead(async()=>({entries:[{id:'record',time:2,text:'record',line:1}]}));const v=await open(f);f.publish(synchronized(youtube,7));
 const oldInput=editor(v),oldRate=find(v.contentEl,'select','播放速度'),oldConfirm=button(v,'确认时间'),oldPlay=button(v,'播放或暂停'),oldCancel=button(v,'取消摘录'),oldSave=button(v,'保存摘录'),oldMoment=button(v,'0:02');
 await v.setState({source:another.path});f.publish(synchronized(another,82));const fresh=editor(v);find(v.contentEl,'input','手动摘录时间').value='15';
 oldInput.value='detached text';oldInput.dispatch('input');oldInput.dispatch('compositionstart');oldRate.value='2';oldRate.dispatch('change');oldConfirm.click();oldPlay.click();oldMoment.click();
 await settle();assert.equal(fresh.value,'');assert.equal(v.canMove(),true);assert.deepEqual(f.commands,[]);assert.deepEqual(f.opens,[]);
 type(fresh,'new source draft');oldCancel.dispatch('click');oldSave.dispatch('click');oldInput.dispatch('keydown',{key:'Enter',metaKey:true});await settle();
 assert.equal(fresh.value,'new source draft');assert.equal(f.saves.length,0);fresh.dispatch('keydown',{key:'Enter',metaKey:true});await settle();
 assert.equal(f.saves.length,1);assert.equal(f.saves[0].source,another.path);assert.equal(f.saves[0].data.time,82);assert.equal(f.saves[0].data.text,'new source draft');await v.onClose();
});

test('remembering the verified current moment creates a savable timestamp without requiring text',async()=>{
 const f=fixture(),v=await open(f);assert.equal(button(v,'记下此刻').disabled,true);assert.equal(button(v,'保存摘录').disabled,true);
 f.publish(synchronized(youtube,12.875));await click(v,'记下此刻');assert.equal(editor(v).value,'');assert.equal(v.canMove(),false);assert.equal(button(v,'保存摘录').disabled,false);
 f.publish(synchronized(youtube,90));await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.time,12.875);assert.equal(f.saves[0].data.text,'');assert.equal(f.saves[0].data.image,undefined);assert.equal(f.captures.length,0);await v.onClose();
});

test('confirmed manual time permits a timestamp-only record and never fabricates a screenshot',async()=>{
 const f=fixture(),v=await open(f),manual=find(v.contentEl,'input','手动摘录时间');type(manual,'1:30');
 assert.equal(button(v,'记下此刻').disabled,true);await click(v,'确认时间');await click(v,'记下此刻');
 assert.equal(button(v,'快速截图').disabled,true);button(v,'快速截图').dispatch('click');await settle();assert.equal(f.captures.length,0);assert.equal(urls(v).created.length,0);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,90);assert.equal(f.saves[0].data.text,'');assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('a picture-only draft uses the exact returned frame timestamp and releases its preview after save',async()=>{
 const f=fixture(),v=await open(f),blob=new Blob(['frame'],{type:'image/png'});f.setCapture(async()=>({blob,time:19.625}));f.publish(synchronized(youtube,18));
 await click(v,'快速截图');assert.deepEqual(f.captures,[youtube.path]);assert.equal(editor(v).value,'');assert.equal(button(v,'保存摘录').disabled,false);
 const url=preview(v)!.src;assert.equal(urls(v).active.get(url),blob);assert.equal(urls(v).created.length,1);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.image,blob);assert.equal(f.saves[0].data.time,19.625);assert.equal(f.saves[0].data.text,'');assert.deepEqual(urls(v).revoked,[url]);assert.equal(urls(v).active.size,0);assert.equal(v.canMove(),true);
 await v.onClose();assert.deepEqual(urls(v).revoked,[url]);
});

test('adding a screenshot preserves existing Markdown but moves its draft time to the captured frame',async()=>{
 const f=fixture(),v=await open(f),blob=new Blob(['precise frame'],{type:'image/png'});f.publish(synchronized(youtube,7));type(editor(v),'**already typed**\nsecond line');
 f.setCapture(async()=>({blob,time:33.125}));f.publish(synchronized(youtube,32));await click(v,'快速截图');
 assert.equal(editor(v).value,'**already typed**\nsecond line');await click(v,'保存摘录');assert.equal(f.saves[0].data.time,33.125);assert.equal(f.saves[0].data.text,'**already typed**\nsecond line');assert.equal(f.saves[0].data.image,blob);await v.onClose();
});

test('capture requires a currently synchronized matching source even when manual time is confirmed',async()=>{
 const f=fixture(),v=await open(f,biliOne);type(find(v.contentEl,'input','手动摘录时间'),'42');await click(v,'确认时间');
 for(const state of [{...synchronized(biliOne),available:false},{...synchronized(biliOne),closed:true},synchronized(biliTwo),{...synchronized(biliOne),available:false,status:'source-changed' as const,candidate:biliTwo}]){
  f.publish(state);assert.equal(button(v,'快速截图').disabled,true);button(v,'快速截图').dispatch('click');await settle();
 }
 assert.equal(f.captures.length,0);assert.equal(urls(v).created.length,0);
 f.publish(synchronized(biliOne,80));const blob=new Blob(['real synced frame'],{type:'image/png'});f.setCapture(async()=>({blob,time:81.25}));await click(v,'快速截图');await click(v,'保存摘录');
 assert.equal(f.saves[0].data.time,81.25);assert.equal(f.saves[0].data.image,blob);await v.onClose();
});

test('pending capture reserves the draft against save, cancel, source switching and concurrent editors',async()=>{
 const f=fixture(),v=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,4));type(editor(v),'keep while capturing');f.setCapture(()=>pending.promise);await click(v,'快速截图');
 assert.equal(v.canMove(),false);assert.equal(editor(v).readOnly,true);for(const label of ['快速截图','保存摘录','取消摘录','记下此刻'])assert.equal(button(v,label).disabled,true,label);
 button(v,'快速截图').dispatch('click');button(v,'保存摘录').dispatch('click');button(v,'取消摘录').dispatch('click');await v.setState({source:another.path});await click(v,'独立窗口');
 assert.equal(v.currentSource().path,youtube.path);assert.equal(f.opens.length,0);assert.equal(f.saves.length,0);assert.equal(f.captures.length,1);assert.equal(editor(v).value,'keep while capturing');
 const otherEditor=await open(f);assert.equal(editor(otherEditor).readOnly,true);assert.equal(button(otherEditor,'快速截图').disabled,true);button(otherEditor,'快速截图').dispatch('click');await settle();assert.equal(f.captures.length,1);
 pending.resolve({blob:new Blob(['frame'],{type:'image/png'}),time:5.5});await settle();assert.equal(editor(v).value,'keep while capturing');assert.equal(editor(otherEditor).readOnly,true);await otherEditor.onClose();await v.onClose();
});

test('a capture started without a draft blocks switching and releases its reservation after failure',async()=>{
 const f=fixture(),v=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,4));f.setCapture(()=>pending.promise);assert.equal(v.canMove(),true);await click(v,'快速截图');
 assert.equal(editor(v).value,'');assert.equal(v.canMove(),false);await v.setState({source:another.path});assert.equal(v.currentSource().path,youtube.path);
 const otherEditor=await open(f);assert.equal(editor(otherEditor).readOnly,true);assert.equal(button(otherEditor,'快速截图').disabled,true);
 pending.reject(Error('no frame available'));await settle();assert.equal(v.canMove(),true);assert.equal(otherEditor.canMove(),true);assert.equal(editor(otherEditor).readOnly,false);assert.equal(button(v,'保存摘录').disabled,true);assert.equal(urls(v).created.length,0);
 await v.onClose();await otherEditor.onClose();
});

test('an editor owned by another open view cannot start a screenshot or replace its timestamp',async()=>{
 const f=fixture(),owner=await open(f);f.publish(synchronized(youtube,6));type(editor(owner),'owned text');const otherEditor=await open(f);
 assert.equal(button(otherEditor,'快速截图').disabled,true);assert.equal(button(otherEditor,'记下此刻').disabled,true);
 button(otherEditor,'快速截图').dispatch('click');button(otherEditor,'记下此刻').dispatch('click');await settle();assert.equal(f.captures.length,0);assert.equal(editor(owner).value,'owned text');
 await click(owner,'保存摘录');assert.equal(f.saves[0].data.time,6);await owner.onClose();await otherEditor.onClose();
});

for(const invalidation of ['unavailable','closed','other-source','other-part','candidate']as const)test(`a capture result after ${invalidation} is rejected without discarding existing text`,async()=>{
 const f=fixture(),v=await open(f,biliOne),pending=deferred<Capture>();f.publish(synchronized(biliOne,8));type(editor(v),'original text');f.setCapture(()=>pending.promise);await click(v,'快速截图');
 const state=invalidation==='other-source'?synchronized(youtube,20):invalidation==='other-part'?synchronized(biliTwo,20):{...synchronized(biliOne,20),available:invalidation==='closed',closed:invalidation==='closed',...(invalidation==='candidate'?{status:'source-changed' as const,candidate:biliTwo}:{})};
 f.publish(state);pending.resolve({blob:new Blob(['stale frame'],{type:'image/png'}),time:19.875});await settle();
 assert.equal(editor(v).value,'original text');assert.equal(urls(v).created.length,0);assert.equal(preview(v)?.src||'','');assert.equal(button(v,'保存摘录').disabled,false);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.text,'original text');assert.equal(f.saves[0].data.time,8);assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('losing then regaining source synchronization still rejects the earlier in-flight frame',async()=>{
 const f=fixture(),v=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,8));type(editor(v),'before sync loss');f.setCapture(()=>pending.promise);await click(v,'快速截图');
 f.publish({...synchronized(youtube,30),available:false});f.publish(synchronized(youtube,31));pending.resolve({blob:new Blob(['stale'],{type:'image/png'}),time:30.5});await settle();
 assert.equal(urls(v).created.length,0);assert.equal(editor(v).value,'before sync loss');await click(v,'保存摘录');assert.equal(f.saves[0].data.time,8);assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('a failed host capture keeps the original editable text and timestamp and clears its reservation',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube,10.25));type(editor(v),'capture can fail');f.setCapture(async()=>{throw Error('capture unavailable');});await click(v,'快速截图');
 assert.equal(editor(v).value,'capture can fail');assert.equal(editor(v).readOnly,false);assert.equal(urls(v).created.length,0);assert.equal(button(v,'快速截图').disabled,false);
 await click(v,'保存摘录');assert.equal(f.saves[0].data.time,10.25);assert.equal(f.saves[0].data.image,undefined);await v.onClose();
});

test('closing during capture rejects the old result after the same source reopens and preserves its text',async()=>{
 const f=fixture(),first=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,11.5));type(editor(first),'survive pending close');f.setCapture(()=>pending.promise);await click(first,'快速截图');
 await first.onClose();const restored=await open(f);assert.equal(editor(restored).value,'survive pending close');
 pending.resolve({blob:new Blob(['closed view frame'],{type:'image/png'}),time:12});await settle();assert.equal(urls(first).created.length,0);assert.equal(urls(restored).created.length,0);assert.equal(editor(restored).value,'survive pending close');assert.equal(editor(restored).readOnly,false);
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,11.5);assert.equal(f.saves[0].data.image,undefined);await restored.onClose();
});

test('closing during capture cannot add a frame to a different reopened source or clear either draft',async()=>{
 const f=fixture(),first=await open(f),pending=deferred<Capture>();f.publish(synchronized(youtube,10));type(editor(first),'source A');f.setCapture(()=>pending.promise);await click(first,'快速截图');await first.onClose();
 const current=await open(f,another);f.publish(synchronized(another,40));type(editor(current),'source B');pending.resolve({blob:new Blob(['A stale frame'],{type:'image/png'}),time:11});await settle();
 assert.equal(editor(current).value,'source B');assert.equal(urls(current).created.length,0);await click(current,'保存摘录');assert.equal(f.saves[0].source,another.path);assert.equal(f.saves[0].data.time,40);assert.equal(f.saves[0].data.image,undefined);await current.onClose();
 const restored=await open(f);assert.equal(editor(restored).value,'source A');assert.equal(urls(restored).created.length,0);await restored.onClose();
});

test('image blobs survive close and reopen while each view owns and releases its own preview URL',async()=>{
 const f=fixture(),first=await open(f),blob=new Blob(['persisted frame'],{type:'image/png'});f.publish(synchronized(youtube,20));type(editor(first),'caption');f.setCapture(async()=>({blob,time:21.5}));await click(first,'快速截图');
 const oldURL=preview(first)!.src;assert.equal(urls(first).active.get(oldURL),blob);for(let tick=0;tick<10;tick++)f.publish(synchronized(youtube,22+tick*.4));assert.equal(urls(first).created.length,1);
 await first.onClose();assert.deepEqual(urls(first).revoked,[oldURL]);const restored=await open(f),newURL=preview(restored)!.src;
 assert.notEqual(newURL,oldURL);assert.equal(urls(restored).active.get(newURL),blob);assert.equal(editor(restored).value,'caption');assert.equal(f.captures.length,1);
 await click(restored,'移除截图');assert.deepEqual(urls(restored).revoked,[newURL]);assert.equal(preview(restored)?.src||'','');assert.equal(editor(restored).value,'caption');
 await click(restored,'保存摘录');assert.equal(f.saves[0].data.time,21.5);assert.equal(f.saves[0].data.image,undefined);await restored.onClose();assert.deepEqual(urls(restored).revoked,[newURL]);
});

test('canceling an image draft releases its preview and does not restore the canceled image on reopen',async()=>{
 const f=fixture(),v=await open(f);f.publish(synchronized(youtube));await click(v,'快速截图');const url=preview(v)!.src;
 await click(v,'取消摘录');assert.deepEqual(urls(v).revoked,[url]);assert.equal(urls(v).active.size,0);assert.equal(v.canMove(),true);await v.onClose();assert.deepEqual(urls(v).revoked,[url]);
 const restored=await open(f);assert.equal(preview(restored)?.src||'','');assert.equal(urls(restored).created.length,0);assert.equal(button(restored,'保存摘录').disabled,true);await restored.onClose();
});

test('failed image save locks the original blob, id and frame time for a retry without recapturing',async()=>{
 const f=fixture(),v=await open(f),blob=new Blob(['retry frame'],{type:'image/png'});f.publish(synchronized(youtube,18));type(editor(v),'frame caption');f.setCapture(async()=>({blob,time:18.75}));await click(v,'快速截图');
 const oldURL=preview(v)!.src;f.setWrite(async()=>{throw Error('save acknowledgement failed');});await click(v,'保存摘录');assert.equal(f.saves.length,1);assert.equal(f.saves[0].data.image,blob);assert.equal(urls(v).active.get(oldURL),blob);assert.equal(editor(v).readOnly,true);
 for(const label of ['快速截图','记下此刻','移除截图'])assert.equal(button(v,label).disabled,true,label);await v.onClose();assert.deepEqual(urls(v).revoked,[oldURL]);
 const restored=await open(f);assert.equal(urls(restored).active.get(preview(restored)!.src),blob);assert.equal(editor(restored).readOnly,true);f.setWrite(async()=>({note:f.noteA}));await click(restored,'保存摘录');
 assert.equal(f.captures.length,1);assert.deepEqual(f.saves[1].data,f.saves[0].data);assert.equal(f.saves[1].data.image,blob);assert.equal(urls(restored).active.size,0);assert.equal(restored.canMove(),true);await restored.onClose();
});

test('timeline screenshots render through MarkdownRenderer with the source note path and forward their image',async()=>{
 const f=fixture(),entry:Moment={id:'picture',time:9.75,text:'picture caption',image:'![[frames/截图.png]]',line:4},start=markdownRenders.length;
 f.setRead(async()=>({note:f.noteA,entries:[entry]}));const v=await open(f);await settle();const renders=markdownRenders.slice(start);assert.equal(renders.length,1);
 assert.equal(renders[0].text,entry.image);assert.equal(renders[0].path,f.noteA.path);assert.equal(renders[0].component.loads,1);assert.equal(renders[0].component.unloads,0);assert.equal(rows(v)[0].contains(renders[0].holder),true);
 await click(v,'发送到白板');assert.deepEqual(f.sent,[{source:youtube.path,time:entry.time,text:entry.text,image:entry.image}]);await v.onClose();assert.equal(renders[0].component.unloads,1);
});

test('timeline image components are released on refresh and close without being rebuilt by playback state',async()=>{
 const f=fixture(),start=markdownRenders.length;f.setRead(async()=>({note:f.noteA,entries:[{id:'one',time:1,text:'one',image:'![[one.png]]',line:1},{id:'two',time:2,text:'two',image:'![[two.png]]',line:2}]}));
 const v=await open(f);await settle();const first=markdownRenders.slice(start),firstScopes=[...new Set(first.map(render=>render.component))];assert.equal(first.length,2);
 for(let tick=0;tick<10;tick++)f.publish(synchronized(youtube,tick*.4));assert.equal(markdownRenders.length,start+2);for(const scope of firstScopes)assert.equal(scope.unloads,0);
 await click(v,'刷新摘录');const refreshed=markdownRenders.slice(start+2),nextScopes=[...new Set(refreshed.map(render=>render.component))];assert.equal(refreshed.length,2);
 for(const scope of firstScopes)assert.equal(scope.unloads,1);for(const scope of nextScopes){assert.equal(scope.loads,1);assert.equal(scope.unloads,0);assert.ok(!firstScopes.includes(scope));}
 await v.onClose();for(const scope of [...firstScopes,...nextScopes])assert.equal(scope.unloads,1);
});

test('timeline screenshots render only the current fifty-entry page and release earlier page components',async()=>{
 const f=fixture(),start=markdownRenders.length;f.setRead(async()=>({note:f.noteA,entries:Array.from({length:51},(_,index)=>({id:String(index),time:index,text:`image ${index}`,image:`![[frame-${index}.png]]`,line:index+1}))}));
 const v=await open(f);await settle();const first=markdownRenders.slice(start);assert.equal(first.length,50);assert.equal(rows(v).length,50);
 await click(v,'下一页');const last=markdownRenders.slice(start+50);assert.equal(last.length,1);assert.equal(last[0].text,'![[frame-50.png]]');assert.equal(rows(v).length,1);
 for(const scope of new Set(first.map(render=>render.component)))assert.equal(scope.unloads,1);await v.onClose();assert.equal(last[0].component.unloads,1);
});
