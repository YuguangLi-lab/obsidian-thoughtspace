import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {markdownActive,planMarkdownEdit,type MarkdownCommand} from '../src/markdown-edit';
import type {MarkdownToolbarState} from '../src/markdown-toolbar';

type Options={cls?:string;attr?:Record<string,string>;text?:string;value?:string;type?:string};
function fixture(options:{link?:boolean;commit?:boolean;batched?:boolean}={}){
 const frames=new Map<number,()=>void>();let nextFrame=0,dispose:undefined|(()=>void),activeReads=0,navigationDisposals=0,iconWrites=0;
 const doc={defaultView:{requestAnimationFrame:(run:()=>void)=>{frames.set(++nextFrame,run);return nextFrame;},cancelAnimationFrame:(id:number)=>frames.delete(id)}};
 class Element extends EventTarget{
  ownerDocument=doc;parentElement:Element|null=null;children:Element[]=[];classes=new Set<string>();dataset:Record<string,string>={};attrs:Record<string,string>={};
  value='';text='';title='';ariaLabel='';disabled=false;isConnected=true;onclick?:()=>void;onchange?:()=>void;onmousedown?:(event:{preventDefault:()=>void})=>void;
  properties=new Map<string,string>();style={setProperty:(key:string,value:string)=>this.properties.set(key,value)};
  classList={contains:(name:string)=>this.classes.has(name),toggle:(name:string,on?:boolean)=>{const use=on??!this.classes.has(name);if(use)this.classes.add(name);else this.classes.delete(name);return use;}};
  constructor(public tagName='DIV'){super();}
  createEl(tag:string,options:Options={}){const el=new Element(tag.toUpperCase());el.value=options.value||'';el.text=options.text||'';for(const name of (options.cls||'').split(' ').filter(Boolean))el.addClass(name);for(const[key,value]of Object.entries(options.attr||{}))el.setAttribute(key,value);this.children.push(el);el.parentElement=this;return el;}
  createDiv(options:Options|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
  createSpan(options:Options|string={}){return this.createEl('span',typeof options==='string'?{cls:options}:options);}
  addClass(name:string){this.classes.add(name);}setText(value:string){this.text=value;}
  setAttribute(key:string,value:string){this.attrs[key]=value;if(key==='aria-label')this.ariaLabel=value;if(key==='title')this.title=value;}
  getAttribute(key:string){return this.attrs[key]??null;}
  matches(selector:string){return selector.startsWith('.')?this.classes.has(selector.slice(1)):selector==='[data-command]'?!!this.dataset.command:selector==='[data-busy-action]'?!!this.dataset.busyAction:this.tagName===selector.toUpperCase();}
  querySelectorAll(selector:string):Element[]{return this.children.flatMap(el=>[...(selector.split(',').some(s=>el.matches(s))?[el]:[]),...el.querySelectorAll(selector)]);}
  querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
  get options(){return this.children;}
 }
 const input=new EventTarget(),host=new Element(),calls:{format:Array<MarkdownCommand|{color:string;background?:boolean}>;history:boolean[];link:number;find:number;commit:number}={format:[],history:[],link:0,find:0,commit:0};
 let state:MarkdownToolbarState={text:'选中文字',start:0,end:4};
 const imports:Record<string,unknown>={obsidian:{setIcon:(el:Element,icon:string)=>{el.dataset.icon=icon;iconWrites++;},Notice:class{}},'./markdown-edit':{markdownActive:(...args:Parameters<typeof markdownActive>)=>{activeReads++;return markdownActive(...args);}},'./toolbar-navigation':{toolbarNavigation:()=>()=>{navigationDisposals++;}}};
 const module={exports:{} as {markdownToolbar:(host:unknown,editor:unknown)=>void}};
 new Function('require','module','exports',transformSync(readFileSync('src/markdown-toolbar.ts','utf8'),{loader:'ts',format:'cjs'}).code)((key:string)=>imports[key],module,module.exports);
 module.exports.markdownToolbar(host,{updatesBatched:!!options.batched,input,snapshot:()=>({...state}),
  format:(command:MarkdownCommand|{color:string;background?:boolean})=>{calls.format.push(command);state={...state,...planMarkdownEdit(state.text,state.start,state.end,command)};},
  canLinkNote:options.link!==false,linkNote:()=>calls.link++,findText:()=>calls.find++,history:(redo=false)=>calls.history.push(redo),
  commit:options.commit===false?undefined:()=>{calls.commit++;return Promise.resolve();},replaceToolbar:(callback:()=>void)=>dispose=callback});
 const row=host.children[0],control=(label:string)=>{const result=row.querySelectorAll('button,select,input').find(el=>el.ariaLabel===label);assert.ok(result,`Missing toolbar control ${label}`);return result;};
 const pick=(label:string,value:string)=>{const el=control(label);el.value=value;el.onchange?.();};
 const event=(name='input')=>input.dispatchEvent(new Event(name));
 const paint=()=>{const pending=[...frames.values()];frames.clear();for(const run of pending)run();};
 return{host,row,control,pick,event,paint,calls,frames,dispose:()=>dispose?.(),get state(){return state;},set state(value:MarkdownToolbarState){state=value;},get activeReads(){return activeReads;},get navigationDisposals(){return navigationDisposals;},get iconWrites(){return iconWrites;}};
}

const commands:MarkdownCommand[]=['bold','italic','strike','highlight','code','link','image','wikilink','bullet','ordered','task','quote','paragraph','h1','h2','h3','h4','h5','h6','codeblock','table','rule','callout','underline','sup','sub','indent','outdent','clear','comment','math','mathblock'];
test('compact Markdown toolbar keeps every existing command reachable in at most twenty controls',()=>{
 const f=fixture(),controls=f.row.querySelectorAll('button,select,input');
 const reachable=new Set<string>(controls.flatMap(el=>el.tagName==='SELECT'?el.options.map(option=>option.value).filter(Boolean):el.dataset.command?[el.dataset.command]:[]));
 assert.deepEqual([...reachable].sort(),[...commands].sort());assert.ok(controls.length<=20,`Unexpected ${controls.length} visible controls`);
 assert.deepEqual(f.row.children.map(group=>group.dataset.mdGroup),['paragraph','emphasis','blocks','insert','colors','more','history','finish']);
 assert.deepEqual(f.row.children[1].children.map(el=>el.dataset.command),['bold','italic','highlight']);
 for(const id of ['underline','strike','code','indent','outdent','clear'])assert.ok(!controls.some(el=>el.dataset.command===id),'Secondary command remains in more menu');
});

test('all native menu choices format the existing draft and selected range, then reset the menu',()=>{
 for(const label of ['标题','列表','插入内容','更多格式']){
  const reference=fixture();
  for(const option of reference.control(label).options.filter(item=>item.value)){
   const f=fixture(),before={...f.state},expected=planMarkdownEdit(before.text,before.start,before.end,option.value as MarkdownCommand);
   f.pick(label,option.value);assert.deepEqual(f.calls.format,[option.value]);assert.equal(f.state.text,expected.text);assert.equal(f.state.start,expected.start);assert.equal(f.state.end,expected.end);assert.equal(f.control(label).value,'');
  }
 }
});

test('button formatting preserves editor focus and active format state',()=>{
 const f=fixture(),bold=f.control('加粗 · ⌘/Ctrl+B');let prevented=false;
 bold.onmousedown?.({preventDefault:()=>prevented=true});assert.equal(prevented,true);
 bold.onclick?.();assert.equal(f.state.text,'**选中文字**');assert.equal(bold.getAttribute('aria-pressed'),'true');
 bold.onclick?.();assert.equal(f.state.text,'选中文字');assert.equal(bold.getAttribute('aria-pressed'),'false');
});

test('heading and list menus report the latest draft without losing native command choices',()=>{
 const f=fixture();f.state={text:'### 标题\n1. 清单',start:4,end:6};f.event('select');f.paint();assert.equal(f.control('标题').options[0].text,'H3');
 f.state={...f.state,start:10,end:12};f.event('select');f.paint();assert.equal(f.control('标题').options[0].text,'正文');assert.equal(f.control('列表').options[0].text,'有序列表');
 f.pick('列表','task');assert.equal(f.control('列表').options[0].text,'任务列表');assert.equal(f.control('任务列表').getAttribute('aria-pressed'),'true');
});

test('events coalesce at one paint and unchanged state performs no format scans or icon writes',()=>{
 const f=fixture(),reads=f.activeReads,writes=f.iconWrites;
 for(const event of ['input','select','keyup','mouseup'])f.event(event);
 assert.equal(f.frames.size,1);f.paint();assert.equal(f.activeReads,reads);assert.equal(f.iconWrites,writes);
 f.state={text:'新版草稿',start:0,end:2};for(let i=0;i<4;i++)f.event();assert.equal(f.frames.size,1);f.paint();assert.equal(f.activeReads,reads+1);
});

test('already batched note-editor updates do not schedule a second animation frame',()=>{
 const f=fixture({batched:true});f.state={text:'## 第二级',start:3,end:6};f.event();assert.equal(f.frames.size,0);assert.equal(f.control('标题').options[0].text,'H2');
});

for(const reason of ['输入法组字中','正在保存'])test(`${reason} blocks actions even before a scheduled toolbar refresh`,()=>{
 for(const action of ['bold','menu','color','link','history','commit','find']){
  const f=fixture();f.state={...f.state,busy:true,disabledReason:reason};
  if(action==='bold')f.control('加粗 · ⌘/Ctrl+B').onclick?.();
  if(action==='menu')f.pick('更多格式','clear');
  if(action==='color')f.pick('选中文字颜色','#123abc');
  if(action==='link')f.control('选中文字创建或关联笔记').onclick?.();
  if(action==='history')f.control('撤销输入').onclick?.();
  if(action==='commit')f.control('保存 Markdown').onclick?.();
  if(action==='find')f.control('查找与替换').onclick?.();
  assert.deepEqual(f.calls,{format:[],history:[],link:0,find:0,commit:0});assert.equal(f.row.getAttribute('aria-busy'),'true');
  assert.ok(f.row.querySelectorAll('button,select,input').every(control=>control.disabled));
 }
});

test('format lock preserves history and completion for a live multi-cursor draft',()=>{
 const f=fixture();f.state={...f.state,disabledReason:'多光标编辑中，请保留一个选区后设置格式'};f.event();f.paint();
 assert.equal(f.control('加粗 · ⌘/Ctrl+B').disabled,true);assert.equal(f.control('更多格式').disabled,true);
 f.control('撤销输入').onclick?.();f.control('重做输入').onclick?.();f.control('保存 Markdown').onclick?.();assert.deepEqual(f.calls.history,[false,true]);assert.equal(f.calls.commit,1);
});

test('color and note linking require a fresh selection and never change a collapsed draft',()=>{
 for(const label of ['选中文字颜色','选中文字背景色','选中文字创建或关联笔记']){
  const f=fixture();f.state={...f.state,start:2,end:2};const el=f.control(label);el.value='#123abc';if(el.onchange)el.onchange();else el.onclick?.();
  assert.equal(f.calls.format.length,0);assert.equal(f.calls.link,0);assert.equal(el.disabled,true);
 }
 const f=fixture();f.pick('选中文字背景色','#abcdef');assert.deepEqual(f.calls.format,[{color:'#abcdef',background:true}]);f.control('选中文字创建或关联笔记').onclick?.();assert.equal(f.calls.link,1);
 assert.ok(!fixture({link:false}).row.querySelectorAll('button').some(el=>el.ariaLabel==='选中文字创建或关联笔记'));
});

test('unknown native menu values cannot dispatch unlisted commands',()=>{
 const f=fixture();f.pick('更多格式','not-a-command');assert.deepEqual(f.calls.format,[]);assert.equal(f.control('更多格式').value,'');
 f.pick('选中文字颜色','invalid');assert.deepEqual(f.calls.format,[]);
});

for(const detached of [false,true])test(`${detached?'detached':'disposed'} controls cannot mutate the editor`,()=>{
 const f=fixture();f.event();if(detached)f.row.isConnected=false;else f.dispose();
 f.control('加粗 · ⌘/Ctrl+B').onclick?.();f.pick('更多格式','clear');f.pick('选中文字颜色','#123abc');f.control('保存 Markdown').onclick?.();f.control('撤销输入').onclick?.();f.control('选中文字创建或关联笔记').onclick?.();
 assert.deepEqual(f.calls,{format:[],history:[],link:0,find:0,commit:0});
 if(!detached){assert.equal(f.frames.size,0);assert.equal(f.navigationDisposals,1);f.event();assert.equal(f.frames.size,0);}
});

test('moving a selection preserves link availability without repeating identical DOM property writes',()=>{
 const f=fixture({batched:true});f.state={text:'普通文字 '.repeat(100),start:0,end:3};f.event('select');
 const link=f.control('选中文字创建或关联笔记');let writes=0;
 for(const key of ['disabled','title'] as const){let value=link[key];Object.defineProperty(link,key,{get:()=>value,set:next=>{value=next;writes++;}});}
 for(let i=1;i<=240;i++){f.state={...f.state,start:i,end:i+3};f.event('select');}
 assert.equal(link.disabled,false);assert.equal(link.title,'选中文字创建或关联笔记');assert.equal(writes,0);
 link.onclick?.();assert.equal(f.calls.link,1);
});

test('link controls still reflect collapsed selections, composition and recovered availability',()=>{
 const f=fixture({batched:true}),link=f.control('选中文字创建或关联笔记');
 f.state={...f.state,start:2,end:2};f.event('select');assert.equal(link.disabled,true);assert.equal(link.title,'请先选择一个概念或短语');link.onclick?.();assert.equal(f.calls.link,0);
 f.state={...f.state,start:0,end:2,busy:true,disabledReason:'输入法组字中'};f.event('select');assert.equal(link.disabled,true);assert.equal(link.title,'输入法组字中');link.onclick?.();assert.equal(f.calls.link,0);
 f.state={...f.state,busy:false,disabledReason:undefined};f.event('select');assert.equal(link.disabled,false);assert.equal(link.title,'选中文字创建或关联笔记');link.onclick?.();assert.equal(f.calls.link,1);
 f.state={...f.state,disabledReason:'多个选区'};f.event('select');assert.equal(link.disabled,true);assert.equal(link.title,'多个选区');link.onclick?.();assert.equal(f.calls.link,1);
});
