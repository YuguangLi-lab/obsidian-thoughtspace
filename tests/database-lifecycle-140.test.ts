import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {createRequire} from 'node:module';
import {isRecord,isUnknownArray} from '../src/value-guards';
import * as database from '../src/database';
import * as custom from '../src/database-custom';
import {libraryFiles,noteExcerpt} from '../src/workspace';
import {setUiFeedback} from '../src/ui-feedback';
const parseYaml=createRequire(import.meta.url)('js-yaml').load;
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
class Element{
 children:Element[]=[];dataset:Record<string,string>={};value='';text='';disabled=false;onclick?:()=>unknown;attributes:Record<string,string>={};writes=0;textWrites:{text:string;feedback?:string}[]=[];
 constructor(options:any={}){this.value=options.value||'';this.text=options.text||'';this.attributes=options.attr||{};}
 createEl(_tag:string,options:any={}){const el=new Element(options);this.children.push(el);return el;}createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}empty(){this.writes++;this.children=[];this.text='';}setText(text:string){this.writes++;this.text=text;this.children=[];this.textWrites.push({text,feedback:this.dataset.feedback});}addClass(){}setAttribute(){}
}
function moduleFixture(){
 const modals:Modal[]=[],notices:string[]=[];
 class Modal{modalEl=new Element();contentEl=new Element();titleEl=new Element();closed=false;constructor(readonly app:any){modals.push(this);}open(){}close(){this.closed=true;}}
 const deps={Modal,Component:class{},Notice:class{constructor(text:string){notices.push(text);}},TFile:class{},window:{clearTimeout,setTimeout},setUiFeedback,setIcon:()=>{},themeSurface:()=>{},isRecord,isUnknownArray,parseYaml,libraryFiles,noteExcerpt,getAllTags:(cache:any)=>cache.tags||[],...database,...custom};
 const source=readFileSync('src/database-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const parsed=new Function(...Object.keys(deps),transformSync(source+'\nreturn {DatabaseModal,parseRecord};',{loader:'ts'}).code)(...Object.values(deps));
 return{...parsed,modals,notices};
}
const current:custom.SavedDatabaseView={id:'v',name:'项目资料',source:'vault',layout:'table',filter:{query:'',tag:'#项目/进行中',status:'',priority:'',overdue:false,sort:'updated',today:'2026-09-27'},conditions:[]};

test('I140-5 database property reader accepts YAML document-end markers without exposing body as properties',()=>{
 const {parseRecord}=moduleFixture();for(const eol of ['\n','\r\n'])for(const closing of ['...','...  ','---  '])assert.deepEqual(parseRecord(['---','thoughtspace_status: active','tags: [项目]',closing,'# 正文'].join(eol)),{thoughtspace_status:'active',tags:['项目']});
 assert.throws(()=>parseRecord('---\na: [broken\n...\n正文'));
});

test('I140-6 saved tag filters with temporarily empty results never broaden to every note during reload',async()=>{
 const {DatabaseModal}=moduleFixture();const file={path:'Notes/Other.md',basename:'Other',stat:{mtime:1}};
 const modal=Object.create(DatabaseModal.prototype);Object.assign(modal,{active:true,run:0,busy:false,source:'vault',filter:{...current.filter},host:{cardFolder:'Cards'},app:{vault:{getMarkdownFiles:()=>[file],cachedRead:async()=> '正文'},metadataCache:{getFileCache:()=>({tags:['#其他']})}},tags:new Element(),message:new Element(),render(){}});
 await modal.load();assert.equal(modal.filter.tag,'#项目/进行中');assert.equal(modal.tags.value,'#项目/进行中');assert.equal(database.filterRows(modal.rows,modal.filter).length,0);
 assert.ok(modal.tags.children.some((el:Element)=>el.value==='#项目/进行中'));
});

function saveFixture(){
 const f=moduleFixture(),saved=structuredClone(current),preferences={fields:[],views:[saved]},modal=Object.create(f.DatabaseModal.prototype);
 Object.assign(modal,{app:{},host:{preferences},savedSelect:{value:'v'},currentView:(name:string)=>({...structuredClone(current),name,id:'new'}),persist:async()=>{},renderSaved(){}});
 modal.saveView();const dialog=f.modals.at(-1)!,button=dialog.contentEl.children.find((el:Element)=>el.attributes['aria-label']==='保存')!;
 return{...f,modal,saved,preferences,dialog,button};
}

test('I140-7 open saved-view dialogs refuse to overwrite a view changed or removed in a second window',async()=>{
 for(const removed of [false,true]){const f=saveFixture();if(removed)f.preferences.views=[];else f.preferences.views[0]={...f.saved,name:'另一个窗口的新名称'};const before=structuredClone(f.preferences);f.button.onclick!();await tick();assert.deepEqual(f.preferences,before);assert.equal(f.dialog.closed,false);assert.ok(f.notices.some((message:string)=>/变化|移除/.test(message)));}
});

test('I140-7 repeated Save activation while settings IO is pending submits the reviewed view once',async()=>{
 const f=saveFixture();let resolve!:()=>void,count=0;const pending=new Promise<void>(done=>resolve=done);f.modal.persist=async()=>{count++;await pending;};f.button.onclick!();f.button.onclick!();await tick();assert.equal(count,1);resolve();await tick();assert.equal(f.dialog.closed,true);
});

test('saved-view dialog checks in-place changes and rolls back only its own failed settings write',async()=>{
 const stale=saveFixture();stale.saved.name='原位修改';const before=structuredClone(stale.preferences);stale.button.onclick!();await tick();assert.deepEqual(stale.preferences,before);assert.equal(stale.dialog.closed,false);
 const failed=saveFixture();const prior=structuredClone(failed.preferences);failed.modal.persist=async()=>{throw Error('disk full');};failed.button.onclick!();await tick();assert.deepEqual(failed.preferences,prior);assert.equal(failed.dialog.closed,false);assert.equal(failed.button.disabled,false);
});

test('an unchanged saved-view dialog updates its original id and closes once',async()=>{
 const f=saveFixture();f.dialog.contentEl.children[0].value='新的视图名';f.button.onclick!();await tick();assert.equal(f.preferences.views.length,1);assert.equal(f.preferences.views[0].id,'v');assert.equal(f.preferences.views[0].name,'新的视图名');assert.equal(f.dialog.closed,true);assert.deepEqual(f.notices,[]);
});

function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

function lifecycleFixture(){
 const f=moduleFixture(),file={path:'Notes/fixture.md',basename:'fixture',extension:'md',stat:{mtime:1,size:100}},modal=Object.create(f.DatabaseModal.prototype);
 let reader=()=>Promise.resolve('---\nthoughtspace_status: active\n---\n正文'),unloads=0,renders=0,reads=0;
 Object.assign(modal,{active:true,run:0,busy:false,source:'vault',rows:[],filter:{...current.filter,tag:''},host:{cardFolder:'Cards'},app:{vault:{getMarkdownFiles:()=>[file],cachedRead:()=>{reads++;return reader();}},metadataCache:{getFileCache:()=>({tags:[]})}},tags:new Element(),message:new Element(),contentEl:new Element(),lifecycle:{unload(){unloads++;}},render(){renders++;}});
 return{...f,modal,file,setReader:(next:()=>Promise<string>)=>{reader=next;},get unloads(){return unloads;},get renders(){return renders;},get reads(){return reads;}};
}

test('real database warning clears both message and severity after a successful reload',async()=>{
 const f=lifecycleFixture();f.setReader(async()=>{throw Error('invalid fixture');});await f.modal.load();
 assert.equal(f.modal.message.dataset.feedback,'warning');assert.match(f.modal.message.text,/已跳过/);assert.equal(f.modal.rows.length,0);
 f.setReader(async()=>'正文');await f.modal.load();
 assert.equal(f.modal.message.text,'');assert.equal(f.modal.message.dataset.feedback,undefined);assert.equal(f.modal.rows.length,1);
 assert.deepEqual(f.modal.message.textWrites.map((write:{feedback?:string})=>write.feedback),['warning',undefined]);
});

test('real database outer load error restores its existing empty message on a later successful load',async()=>{
 const f=lifecycleFixture(),original=f.modal.app.vault.getMarkdownFiles;f.modal.app.vault.getMarkdownFiles=()=>{throw Error('fixture discovery failure');};
 await f.modal.load();assert.equal(f.modal.message.dataset.feedback,'error');assert.equal(f.modal.message.text,'Error: fixture discovery failure');
 f.modal.app.vault.getMarkdownFiles=original;await f.modal.load();
 assert.equal(f.modal.message.text,'');assert.equal(f.modal.message.dataset.feedback,undefined);assert.equal(f.modal.rows.length,1);
});

test('late successful and rejected database record reads cannot replace a newer message or rows',async()=>{
 for(const oldFails of [false,true])for(const latestFails of [false,true]){
  const f=lifecycleFixture(),first=deferred<string>(),second=deferred<string>();let call=0;f.setReader(()=>call++===0?first.promise:second.promise);
  const old=f.modal.load(),latest=f.modal.load();
  if(latestFails)second.reject(Error('latest fixture invalid'));else second.resolve('最新正文');await latest;
  const rows=f.modal.rows,feedback=f.modal.message.dataset.feedback,text=f.modal.message.text,writes=f.modal.message.writes,renders=f.renders;
  assert.equal(feedback,latestFails?'warning':undefined);
  if(oldFails)first.reject(Error('stale fixture invalid'));else first.resolve('旧正文');await old;
  assert.equal(f.modal.rows,rows);assert.equal(f.modal.message.dataset.feedback,feedback);assert.equal(f.modal.message.text,text);assert.equal(f.modal.message.writes,writes);assert.equal(f.renders,renders);
  if(!latestFails)assert.equal(f.modal.rows[0].raw,'最新正文');
 }
});

test('database close invalidates pending record reads without updating the removed message',async()=>{
 for(const fails of [false,true]){
  const f=lifecycleFixture(),read=deferred<string>();f.setReader(()=>read.promise);const operation=f.modal.load();f.modal.onClose();
  const writes=f.modal.message.writes,feedback=f.modal.message.dataset.feedback;
  if(fails)read.reject(Error('closed fixture invalid'));else read.resolve('迟到正文');await operation;
  assert.equal(f.modal.active,false);assert.equal(f.modal.message.writes,writes);assert.equal(f.modal.message.dataset.feedback,feedback);assert.equal(f.modal.rows.length,0);assert.equal(f.unloads,1);assert.equal(f.renders,0);
 }
});

test('database save callers preserve reload ordering and final success/error feedback precedence',async()=>{
 for(const succeeds of [false,true]){
  const f=lifecycleFixture();await f.modal.load();const row=f.modal.rows[0],pending=deferred(),calls:unknown[][]=[];
  f.modal.store={update:async(...args:unknown[])=>{calls.push(args);await pending.promise;}};f.setReader(async()=>{throw Error('reload fixture invalid');});
  const operation=f.modal.update(row,'status','done');assert.equal(f.modal.busy,true);assert.equal(f.modal.message.dataset.feedback,'loading');assert.equal(f.modal.message.text,'正在保存…');
  assert.equal(calls.length,1);assert.deepEqual(calls[0],[row.file,'status','done',row.raw]);
  if(succeeds)pending.resolve();else pending.reject(Error('write refused'));await operation;
  assert.equal(f.modal.busy,false);assert.equal(f.modal.message.dataset.feedback,succeeds?'success':'error');assert.equal(f.modal.message.text,succeeds?'已保存':'write refused');
  assert.deepEqual(f.modal.message.textWrites.slice(-3).map((write:{feedback?:string})=>write.feedback),['loading','warning',succeeds?'success':'error']);
  assert.equal(calls.length,1);assert.equal(f.notices.length,succeeds?0:1);
 }
});

test('closing database during a property write does not cancel or duplicate IO and suppresses terminal message',async()=>{
 for(const succeeds of [false,true]){
  const f=lifecycleFixture();await f.modal.load();const row=f.modal.rows[0],pending=deferred();let writes=0;
  f.modal.store={update:async()=>{writes++;await pending.promise;}};const operation=f.modal.update(row,'status','done');
  f.modal.onClose();const messageWrites=f.modal.message.writes,readCount=f.reads,feedback=f.modal.message.dataset.feedback;
  if(succeeds)pending.resolve();else pending.reject(Error('closed write refused'));await operation;
  assert.equal(writes,1);assert.equal(f.modal.busy,false);assert.equal(f.modal.message.writes,messageWrites);assert.equal(f.modal.message.dataset.feedback,feedback);assert.equal(f.reads,readCount);assert.equal(f.unloads,1);
 }
});
