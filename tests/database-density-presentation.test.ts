import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {createRequire} from 'node:module';
import {isRecord,isUnknownArray} from '../src/value-guards';
import * as database from '../src/database';
import * as custom from '../src/database-custom';
import {libraryFiles,noteExcerpt} from '../src/workspace';
import {localDay} from '../src/filing';
import {setUiFeedback} from '../src/ui-feedback';

// Run the actual Modal constructor, onOpen, load and render. Only Obsidian's
// DOM/framework boundary and IO are substituted; this is not a native UI test.
class Element {
 children:Element[]=[];dataset:Record<string,string>={};attributes:Record<string,string>={};classes=new Set<string>();
 value='';text='';disabled=false;hidden=false;checked=false;open=false;scrollTop=0;writes=0;parentElement?:Element;
 onclick?:()=>unknown;oninput?:()=>unknown;onchange?:()=>unknown;
 constructor(readonly tag='div',options:any={}) {
  if(typeof options==='string')options={cls:options};
  this.value=options.value||'';this.text=options.text||'';this.attributes={...options.attr};
  for(const cls of (options.cls||'').split(' ').filter(Boolean))this.classes.add(cls);
 }
 createEl(tag:string,options:any={}){const el=new Element(tag,options);el.parentElement=this;this.children.push(el);this.writes++;return el;}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 empty(){this.children=[];this.text='';this.writes++;}
 setText(text:string){this.text=text;this.children=[];this.writes++;}
 addClass(...classes:string[]){classes.forEach(cls=>this.classes.add(cls));}
 removeClass(...classes:string[]){classes.forEach(cls=>this.classes.delete(cls));}
 toggleClass(cls:string,enabled:boolean){if(enabled)this.classes.add(cls);else this.classes.delete(cls);}
 setAttribute(key:string,value:string){this.attributes[key]=value;this.writes++;}
 getAttribute(key:string){return this.attributes[key]??null;}
 querySelector(selector:string):Element|undefined{return this.querySelectorAll(selector)[0];}
 querySelectorAll(selector:string):Element[]{
  const matches=(el:Element,part:string)=>{const attr=part.match(/\[aria-label="?([^"\]]+)"?\]/);if(attr&&el.attributes['aria-label']!==attr[1])return false;
   const cls=part.match(/\.([\w-]+)/);if(cls&&!el.classes.has(cls[1]))return false;const tag=part.match(/^[a-z]+/);return!tag||el.tag===tag[0];};
  const parts=selector.split(' ');return this.all().filter(el=>{if(!matches(el,parts.at(-1)!))return false;if(parts.length===1)return true;
   for(let parent=el.parentElement;parent;parent=parent.parentElement)if(matches(parent,parts[0]))return true;return false;});
 }
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(el=>el!==this);}
 get textContent():string{return this.text+this.children.map(el=>el.textContent).join('');}
 all():Element[]{return this.children.flatMap(el=>[el,...el.all()]);}
}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const raw='---\nthoughtspace_status: active\n---\n# 存在的资料\n已经存在的正文';
const file={path:'Cards/存在的资料.md',basename:'存在的资料',extension:'md',stat:{mtime:1,size:100}};
function fixture(files=[file]) {
 const timers=new Map<number,()=>unknown>();let timer=0,unloads=0,reads=0,readCompleted=0,writes=0;
 let reader:()=>Promise<string>=async()=>raw;
 const notices:string[]=[];
 class Component{load(){}registerEvent(){}unload(){unloads++;}}
 class Modal{modalEl=new Element();contentEl=new Element();titleEl=new Element();constructor(readonly app:any){}close(){(this as any).onClose();}open(){}}
 const deps={Modal,Component,Notice:class{constructor(text:string){notices.push(text);}},TFile:class{},window:{setTimeout(fn:()=>unknown){const id=++timer;timers.set(id,fn);return id;},clearTimeout(id:number){timers.delete(id);}},
  setUiFeedback,setIcon:()=>{},themeSurface:()=>{},isRecord,isUnknownArray,parseYaml:createRequire(import.meta.url)('js-yaml').load,
  libraryFiles,noteExcerpt,localDay,getAllTags:(cache:any)=>cache.tags||[],...database,...custom};
 const source=readFileSync('src/database-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const {DatabaseModal}=new Function(...Object.keys(deps),transformSync(source+'\nreturn {DatabaseModal};',{loader:'ts'}).code)(...Object.values(deps));
 const app={vault:{getMarkdownFiles:()=>files,cachedRead:async()=>{reads++;const value=await reader();readCompleted++;return value;},on:()=>({}),
  create(){writes++;throw Error('no fixture writes permitted');},createFolder(){writes++;throw Error('no fixture writes permitted');}},metadataCache:{getFileCache:()=>({tags:[]}),on:()=>({})}};
 const host={cardFolder:'Cards',preferences:{fields:[],views:[]},savePreferences:async()=>{writes++;throw Error('no preferences writes permitted');},preview:()=>{throw Error('preview must not open');}};
 const store={update:async()=>{writes++;throw Error('unexpected property write');},updateCustom:async()=>{writes++;throw Error('unexpected custom write');}};
 const modal=new DatabaseModal(app,host,store);modal.onOpen();
 const find=(predicate:(el:Element)=>boolean)=>modal.contentEl.all().find(predicate) as Element;
 const label=(value:string)=>find(el=>el.attributes['aria-label']===value);
 const findClass=(cls:string)=>find(el=>el.classes.has(cls));
 const controlRender=(query='存在的资料')=>{const input=label('资料搜索');input.value=query;input.oninput!();};
 const startRead=()=>{timers.clear();return modal.load() as Promise<void>;};
 return{modal,app,host,store,label,findClass,controlRender,startRead,timers,notices,
  setReader(next:()=>Promise<string>){reader=next;},get reads(){return reads;},get readCompleted(){return readCompleted;},get writes(){return writes;},get unloads(){return unloads;},
  definiteEmpty:()=>modal.contentEl.all().filter((el:Element)=>el.classes.has('ts-db-empty')&&!el.classes.has('ts-db-load-state')),
  snapshot:()=>({eligibleFiles:libraryFiles(files,'cards','updated','Cards',new Set()).length,reads,readCompleted,query:modal.filter.query,
   emptyMessages:modal.contentEl.all().filter((el:Element)=>el.classes.has('ts-db-empty')).map((el:Element)=>el.textContent),
   renderedPaths:modal.contentEl.all().filter((el:Element)=>el.attributes['data-note-path']).map((el:Element)=>el.attributes['data-note-path']),
   resultsBusy:modal.results.attributes['aria-busy']??null,count:modal.count.textContent})};
}

// Native details/summary behavior is intentionally not emulated here. These
// source-renderer tests verify semantic hosts, unchanged handlers/state, and
// disclosure summaries; actual keyboard/geometry belongs to browser/native QA.
function inside(el:Element|undefined,parent:Element|undefined){for(let current=el;current;current=current.parentElement)if(current===parent)return true;return false;}
function options(f:ReturnType<typeof fixture>){return f.findClass('ts-db-options');}
function summary(f:ReturnType<typeof fixture>){return f.findClass('ts-db-active-conditions');}
function initialAnnouncement(f:ReturnType<typeof fixture>){return f.modal.contentEl.all().filter((el:Element)=>el.attributes.role==='status'||el.attributes['aria-live']==='polite');}

test('I337 initial reading has one visible headline, no unread count and a single polite feedback host',async t=>{
 const f=fixture(),pending=deferred<string>();f.setReader(()=>pending.promise);const operation=f.startRead();f.controlRender('');
 const before={countHidden:f.modal.count.hidden,count:f.modal.count.textContent,readStatus:f.findClass('ts-db-read-status').textContent,quiet:f.findClass('ts-db-read-status').classes.has('ts-db-read-status-quiet'),
  liveHosts:initialAnnouncement(f).map((el:Element)=>({classes:[...el.classes],role:el.attributes.role,live:el.attributes['aria-live']}))};t.diagnostic(JSON.stringify(before));
 const status=f.findClass('ts-db-read-status'),feedback=f.findClass('ts-db-feedback');
 pending.resolve(raw);await operation;
 assert.equal(before.countHidden,true,'count is unknown until one snapshot completes');assert.equal(before.liveHosts.length,1);
 assert.equal(feedback.getAttribute('role'),'status');assert.equal(feedback.getAttribute('aria-live'),'polite');assert.equal(feedback.getAttribute('aria-atomic'),'true');
 assert.equal(before.quiet,true);assert.ok(inside(status,feedback));assert.ok(inside(f.modal.message,feedback));
 assert.equal(f.modal.message.getAttribute('role'),null);assert.equal(status.getAttribute('role'),null);
 assert.equal(f.modal.count.hidden,false);assert.match(f.modal.count.textContent,/1 篇笔记/);assert.equal(f.modal.results.getAttribute('aria-busy'),'false');
 assert.equal(f.writes,0);
});

test('I337 primary filters and refresh stay outside one initially collapsed native disclosure, while all tools remain inside',()=>{
 const f=fixture(),disclosure=options(f),before=JSON.stringify(f.host.preferences);
 assert.ok(disclosure,'existing secondary controls must be grouped under a native disclosure');assert.equal(disclosure.tag,'details');assert.equal(disclosure.open,false);
 assert.equal(disclosure.children[0].tag,'summary');assert.match(disclosure.children[0].textContent,/视图、条件与工具/);assert.equal(disclosure.children[0].onclick,undefined);
 for(const name of ['资料搜索','资料范围','资料标签','资料状态','资料优先级','刷新资料']){assert.ok(f.label(name));assert.equal(inside(f.label(name),disclosure),false,name);}
 for(const name of ['保存的筛选视图','保存筛选视图','删除此视图','资料排序','自定义字段','打开 Bases','导出 CSV']){assert.ok(f.label(name));assert.equal(inside(f.label(name),disclosure),true,name);}
 assert.equal(inside(f.findClass('ts-db-overdue-filter'),disclosure),true);assert.equal(inside(f.findClass('ts-db-custom-filters'),disclosure),true);
 disclosure.open=true;disclosure.open=false;assert.equal(JSON.stringify(f.host.preferences),before);assert.equal(f.writes,0);
});

test('I337 collapsed summary exposes all active hidden custom conditions, overdue, sorting and selected-view label as plain text',()=>{
 const f=fixture();f.host.preferences.fields=[{key:'作者',type:'text'},{key:'评分',type:'number'},{key:'审核',type:'checkbox'}] as any;
 f.host.preferences.views=[{id:'v',name:'长中文项目 <研究> 视图'}] as any;f.modal.renderSaved();f.modal.savedSelect.value='v';
 f.modal.conditions=[{key:'作者',op:'contains',value:'<明确作者>'},{key:'评分',op:'gte',value:'8'},{key:'审核',op:'eq',value:'true'}];
 f.modal.filter.overdue=true;f.modal.filter.sort='due';f.modal.renderCustomFilters();f.modal.render();const content=summary(f);
 assert.ok(content);for(const piece of ['作者','包含','<明确作者>','评分','不小于','8','审核','等于','是','仅逾期','截止日期','长中文项目 <研究> 视图'])assert.ok(content.textContent.includes(piece),piece);
 assert.equal(content.children.length,0,'user-controlled values are text, never HTML');assert.equal(options(f).open,false);assert.equal(f.modal.conditions.length,3);assert.equal(f.writes,0);
});

test('I337 existing custom filter handlers keep collapsed summaries current through add/change/remove without preference writes',()=>{
 const f=fixture();f.host.preferences.fields=[{key:'作者',type:'text'}] as any;f.modal.renderCustomFilters();
 const add=f.label('添加属性筛选');add.value='作者';add.onchange!();assert.equal(f.modal.conditions.length,1);assert.match(summary(f).textContent,/作者.*未填写/);
 const op=f.label('字段比较方式');op.value='contains';op.onchange!();const value=f.label('作者 筛选值');value.value='某位作者';value.onchange!();
 assert.match(summary(f).textContent,/作者.*包含.*某位作者/);assert.equal(options(f).open,false);
 f.label('移除条件').onclick!();assert.equal(f.modal.conditions.length,0);assert.doesNotMatch(summary(f).textContent,/某位作者|作者/);assert.equal(f.writes,0);
});

test('I337 saved-view application preserves its original filter/source/layout semantics and immediately exposes hidden conditions while closed',()=>{
 const f=fixture();f.host.preferences.fields=[{key:'作者',type:'text'}] as any;
 const saved={id:'fixture-view',name:'已选长中文视图',source:'vault',layout:'kanban',filter:{query:'原搜索',tag:'#项目',status:'active',priority:'high',overdue:true,sort:'title',today:'2026-10-14'},conditions:[{key:'作者',op:'contains',value:'目标作者'}]};
 f.host.preferences.views=[saved] as any;f.modal.renderSaved();const before=JSON.stringify(f.host.preferences);f.modal.savedSelect.value=saved.id;f.modal.savedSelect.onchange();
 assert.equal(f.modal.source,'vault');assert.equal(f.modal.view,'kanban');for(const key of ['query','tag','status','priority','sort','overdue'])assert.equal(f.modal.filter[key],saved.filter[key as keyof typeof saved.filter]);
 assert.deepEqual(f.modal.conditions,saved.conditions);assert.equal(f.label('资料搜索').value,'原搜索');assert.equal(f.label('资料范围').value,'vault');
 for(const piece of ['已选长中文视图','作者','包含','目标作者','仅逾期','标题排序'])assert.ok(summary(f).textContent.includes(piece),piece);
 assert.equal(options(f).open,false);assert.equal(JSON.stringify(f.host.preferences),before);assert.equal(f.definiteEmpty().length,0);assert.equal(f.writes,0);
});

test('I337 retained refresh and failure remain clearly labeled without hiding the original rows or adding live channels',async()=>{
 const f=fixture();await f.startRead();const oldRows=f.modal.rows,pending=deferred<string>();f.setReader(()=>pending.promise);const operation=f.startRead();
 assert.deepEqual(f.snapshot().renderedPaths,[file.path]);assert.equal(f.modal.rows,oldRows);assert.equal(f.findClass('ts-db-read-status').classes.has('ts-db-read-status-quiet'),false);
 assert.match(f.findClass('ts-db-read-status').textContent,/刷新.*上次结果/);f.controlRender();assert.match(f.modal.count.textContent,/上次结果/);assert.equal(initialAnnouncement(f).length,1);
 pending.resolve(raw);await operation;f.app.vault.getMarkdownFiles=()=>{throw Error('owned index error');};await f.startRead();
 assert.deepEqual(f.snapshot().renderedPaths,[file.path]);assert.match(f.findClass('ts-db-read-status').textContent,/未完成.*上次结果/);assert.match(f.modal.message.textContent,/owned index error/);assert.equal(initialAnnouncement(f).length,1);assert.equal(f.modal.results.getAttribute('aria-busy'),'false');
});

test('I337 busy property writes keep terminal feedback priority inside the sole live region',async()=>{
 const f=fixture();await f.startRead();const row=f.modal.rows[0],pending=deferred<void>();let calls=0;
 f.modal.store={update:async()=>{calls++;await pending.promise;}};const operation=f.modal.update(row,'status','done');f.controlRender();
 assert.equal(f.modal.message.textContent,'正在保存…');assert.equal(f.findClass('ts-db-read-status').hidden,true);assert.equal(initialAnnouncement(f).length,1);
 pending.resolve();await operation;assert.equal(calls,1);assert.equal(f.modal.message.textContent,'已保存');assert.equal(f.modal.message.dataset.feedback,'success');assert.equal(initialAnnouncement(f).length,1);
});
