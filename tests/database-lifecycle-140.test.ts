import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {createRequire} from 'node:module';
import {isRecord,isUnknownArray} from '../src/value-guards';
import * as database from '../src/database';
import * as custom from '../src/database-custom';
import {libraryFiles,noteExcerpt} from '../src/workspace';
const parseYaml=createRequire(import.meta.url)('js-yaml').load;
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
class Element{
 children:Element[]=[];value='';text='';disabled=false;onclick?:()=>unknown;attributes:Record<string,string>={};
 constructor(options:any={}){this.value=options.value||'';this.text=options.text||'';this.attributes=options.attr||{};}
 createEl(_tag:string,options:any={}){const el=new Element(options);this.children.push(el);return el;}createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}empty(){this.children=[];}setText(text:string){this.text=text;}addClass(){}setAttribute(){}
}
function moduleFixture(){
 const modals:Modal[]=[],notices:string[]=[];
 class Modal{modalEl=new Element();contentEl=new Element();titleEl=new Element();closed=false;constructor(readonly app:any){modals.push(this);}open(){}close(){this.closed=true;}}
 const deps={Modal,Component:class{},Notice:class{constructor(text:string){notices.push(text);}},TFile:class{},setIcon:()=>{},themeSurface:()=>{},isRecord,isUnknownArray,parseYaml,libraryFiles,noteExcerpt,getAllTags:(cache:any)=>cache.tags||[],...database,...custom};
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
