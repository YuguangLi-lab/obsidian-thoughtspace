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
 value='';text='';disabled=false;hidden=false;checked=false;scrollTop=0;writes=0;
 onclick?:()=>unknown;oninput?:()=>unknown;onchange?:()=>unknown;
 constructor(readonly tag='div',options:any={}) {
  if(typeof options==='string')options={cls:options};
  this.value=options.value||'';this.text=options.text||'';this.attributes={...options.attr};
  for(const cls of (options.cls||'').split(' ').filter(Boolean))this.classes.add(cls);
 }
 createEl(tag:string,options:any={}){const el=new Element(tag,options);this.children.push(el);this.writes++;return el;}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 empty(){this.children=[];this.text='';this.writes++;}
 setText(text:string){this.text=text;this.children=[];this.writes++;}
 addClass(...classes:string[]){classes.forEach(cls=>this.classes.add(cls));}
 removeClass(...classes:string[]){classes.forEach(cls=>this.classes.delete(cls));}
 toggleClass(cls:string,enabled:boolean){if(enabled)this.classes.add(cls);else this.classes.delete(cls);}
 setAttribute(key:string,value:string){this.attributes[key]=value;this.writes++;}
 getAttribute(key:string){return this.attributes[key]??null;}
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

test('I336 real controls never announce no matching notes while the matching file read is pending',async t=>{
 const f=fixture(),pending=deferred<string>();f.setReader(()=>pending.promise);const operation=f.startRead();
 f.controlRender();const before=f.snapshot(),definiteEmpty=f.definiteEmpty().length,placeholder=Boolean(f.findClass('ts-db-load-title')&&f.findClass('ts-db-load-copy')),table=Boolean(f.findClass('ts-db-table')),kanban=Boolean(f.findClass('ts-kanban'));
 t.diagnostic(JSON.stringify({phase:'read pending',...before}));pending.resolve(raw);await operation;t.diagnostic(JSON.stringify({phase:'same matching read completed',...f.snapshot()}));
 assert.equal(before.eligibleFiles,1);assert.equal(before.reads,1);assert.equal(before.readCompleted,0);assert.deepEqual(f.snapshot().renderedPaths,[file.path]);
 assert.equal(definiteEmpty,0,'a real matching file exists but its cachedRead has not completed');
 assert.equal(before.resultsBusy,'true');assert.ok(placeholder);assert.equal(table,false);assert.equal(kanban,false);assert.doesNotMatch(before.count,/^0 篇/);
 assert.equal(f.modal.results.getAttribute('aria-busy'),'false');assert.equal(f.definiteEmpty().length,0);assert.deepEqual(f.snapshot().renderedPaths,[file.path]);assert.equal(f.writes,0);
});

test('I336 true empty scope and completed nonmatching filter retain the existing definite empty message',async t=>{
 const empty=fixture([]);await empty.startRead();t.diagnostic(JSON.stringify({cause:'no eligible files',...empty.snapshot()}));
 const filtered=fixture();await filtered.startRead();filtered.controlRender('确实不匹配');t.diagnostic(JSON.stringify({cause:'completed nonmatching filter',...filtered.snapshot()}));
 assert.equal(empty.definiteEmpty().length,1);assert.match(empty.definiteEmpty()[0].textContent,/没有匹配笔记/);assert.equal(empty.modal.results.getAttribute('aria-busy'),'false');
 assert.equal(filtered.readCompleted,1);assert.equal(filtered.definiteEmpty().length,1);assert.equal(filtered.modal.results.getAttribute('aria-busy'),'false');
});

test('I336 table and kanban native buttons preserve their original active class and expose matching pressed state',async()=>{
 const f=fixture(),pending=deferred<string>();f.setReader(()=>pending.promise);const operation=f.startRead();
 for(const [selected,other]of [['资料表','进度看板'],['进度看板','资料表'],['资料表','进度看板']]){
  f.label(selected).onclick!();assert.equal(f.label(selected).classes.has('is-active'),true);assert.equal(f.label(other).classes.has('is-active'),false);
  assert.equal(f.label(selected).getAttribute('aria-pressed'),'true');assert.equal(f.label(other).getAttribute('aria-pressed'),'false');
  assert.equal(f.definiteEmpty().length,0);assert.equal(f.findClass('ts-kanban'),undefined);
 }
 pending.resolve(raw);await operation;f.label('进度看板').onclick!();assert.ok(f.findClass('ts-kanban'));assert.equal(f.label('进度看板').getAttribute('aria-pressed'),'true');
});

test('I336 refresh keeps the last readable rows while indicating the result snapshot is still being refreshed',async()=>{
 const f=fixture();await f.startRead();const oldRows=f.modal.rows,pending=deferred<string>();f.setReader(()=>pending.promise);const operation=f.startRead();
 assert.equal(f.modal.rows,oldRows);assert.deepEqual(f.snapshot().renderedPaths,[file.path]);assert.equal(f.modal.results.getAttribute('aria-busy'),'true');
 assert.match(f.findClass('ts-db-read-status').textContent,/刷新.*上次结果/);
 f.controlRender();assert.deepEqual(f.snapshot().renderedPaths,[file.path]);assert.match(f.modal.count.textContent,/上次结果/);
 pending.resolve(raw.replace('active','done'));await operation;assert.notEqual(f.modal.rows,oldRows);assert.equal(f.modal.rows[0].props.status,'done');assert.equal(f.modal.results.getAttribute('aria-busy'),'false');assert.equal(f.writes,0);
});

test('I336 a formerly empty result does not masquerade as a completed current result during refresh',async()=>{
 const f=fixture([]);await f.startRead();assert.equal(f.definiteEmpty().length,1);
 const pending=deferred<string>();f.app.vault.getMarkdownFiles=()=>[file];f.setReader(()=>pending.promise);const operation=f.startRead();f.controlRender('');
 assert.equal(f.definiteEmpty().length,0);assert.equal(f.modal.results.getAttribute('aria-busy'),'true');assert.match(f.findClass('ts-db-load-copy').textContent,/刷新|读取/);
 pending.resolve(raw);await operation;assert.deepEqual(f.snapshot().renderedPaths,[file.path]);
});

test('I336 discovery error and incomplete record reads cannot be represented as a fully read empty scope',async()=>{
 for(const discoveryFails of [false,true]){
  const f=fixture();if(discoveryFails)f.app.vault.getMarkdownFiles=()=>{throw Error('fixture discovery failed');};else f.setReader(async()=>{throw Error('fixture cachedRead failed');});
  await f.startRead();f.controlRender('');assert.equal(f.definiteEmpty().length,0);assert.ok(f.findClass('ts-db-load-state'));
  assert.equal(f.modal.results.getAttribute('aria-busy'),'false');assert.match(f.modal.message.textContent,discoveryFails?/discovery failed/:/已跳过/);
  f.app.vault.getMarkdownFiles=()=>[file];f.setReader(async()=>raw);await f.startRead();assert.deepEqual(f.snapshot().renderedPaths,[file.path]);assert.equal(f.findClass('ts-db-load-state'),undefined);
 }
});

test('I336 a failed refresh preserves the last rows and identifies them as old results',async()=>{
 const f=fixture();await f.startRead();const rows=f.modal.rows;f.app.vault.getMarkdownFiles=()=>{throw Error('fixture discovery failed');};await f.startRead();
 assert.equal(f.modal.rows,rows);assert.deepEqual(f.snapshot().renderedPaths,[file.path]);assert.equal(f.modal.results.getAttribute('aria-busy'),'false');
 assert.match(f.findClass('ts-db-read-status').textContent,/未完成.*上次结果/);assert.match(f.modal.message.textContent,/fixture discovery failed/);
});

test('I336 late or closed reads do not overwrite newer presentation state or detached DOM',async()=>{
 for(const oldFails of [false,true]){
  const f=fixture(),first=deferred<string>(),second=deferred<string>();let call=0;f.setReader(()=>call++===0?first.promise:second.promise);
  const old=f.startRead(),latest=f.startRead();second.resolve(raw);await latest;const snapshot=f.snapshot(),statusWrites=f.findClass('ts-db-read-status').writes;
  if(oldFails)first.reject(Error('late fixture failure'));else first.resolve('旧正文');await old;assert.deepEqual(f.snapshot(),{...snapshot,readCompleted:snapshot.readCompleted+(oldFails?0:1)});assert.equal(f.findClass('ts-db-read-status').writes,statusWrites);
 }
 for(const fails of [false,true]){
  const f=fixture(),pending=deferred<string>();f.setReader(()=>pending.promise);const operation=f.startRead();const results=f.modal.results,status=f.findClass('ts-db-read-status');f.modal.onClose();
  const writes=[results.writes,status.writes,f.modal.message.writes];if(fails)pending.reject(Error('closed fixture failure'));else pending.resolve(raw);await operation;
  assert.deepEqual([results.writes,status.writes,f.modal.message.writes],writes);assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.unloads,1);assert.equal(f.timers.size,0);
 }
});

test('I336 save busy remains independent from read state, executes once and retains final feedback precedence',async()=>{
 for(const succeeds of [false,true]){
  const f=fixture();await f.startRead();const pending=deferred<void>(),row=f.modal.rows[0];let calls=0;
  f.modal.store={update:async(...args:unknown[])=>{calls++;assert.deepEqual(args,[row.file,'status','done',row.raw]);await pending.promise;}};
  const operation=f.modal.update(row,'status','done');assert.equal(f.modal.busy,true);assert.equal(f.modal.message.textContent,'正在保存…');assert.equal(f.modal.message.dataset.feedback,'loading');
  f.controlRender();assert.equal(f.modal.message.textContent,'正在保存…');assert.equal(f.findClass('ts-db-read-status').hidden,true);await f.modal.load();assert.equal(calls,1);
  if(succeeds)pending.resolve();else pending.reject(Error('fixture write refused'));await operation;await tick();
  assert.equal(calls,1);assert.equal(f.modal.busy,false);assert.equal(f.modal.message.dataset.feedback,succeeds?'success':'error');assert.equal(f.modal.message.textContent,succeeds?'已保存':'fixture write refused');assert.equal(f.modal.results.getAttribute('aria-busy'),'false');
 }
});
