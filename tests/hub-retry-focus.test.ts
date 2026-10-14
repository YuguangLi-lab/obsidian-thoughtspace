import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {defaultHubFilter,hubIndex,hubResults,summarizeBoard} from '../src/space-hub';
import {setUiFeedback,clearUiFeedback} from '../src/ui-feedback';

// Follow the real action -> load -> results -> empty renderer. Geometry and
// trusted keyboard input are checked by the independent whole-modal browser.
const source=readFileSync(process.env.FOLIO_HUB_RETRY_SOURCE||'src/space-hub-view.ts','utf8');
function fragment(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const methods=fragment('  private action(','  private file(')+fragment('  onClose(){','  private renderMetrics()')+fragment('  private renderResults(','  private async openItem(');
type Options=string|{cls?:string;text?:string;attr?:Record<string,string>;value?:string};
type Document={body:Element;activeElement:Element|null};
class Element {
  children:Element[]=[];attrs:Record<string,string>={};dataset:Record<string,string>={};disabled=false;isConnected=true;
  value='';checked=false;text='';focusOptions:unknown[]=[];onclick?:(event?:{detail:number})=>unknown;
  constructor(readonly doc:Document,readonly tag='div',o:Options={}){if(typeof o==='string')o={cls:o};this.attrs={...o.attr,class:o.cls||''};this.text=o.text||'';this.value=o.value||'';}
  get ownerDocument(){return this.doc;}
  createEl(tag:string,o:Options={}){const e=new Element(this.doc,tag,o);this.children.push(e);return e;}
  createDiv(o:Options={}){return this.createEl('div',o);}
  createSpan(o:Options={}){return this.createEl('span',o);}
  createSvg(tag:string,o:Options={}){return this.createEl(tag,o);}
  setText(v:string){this.text=v;}
  setAttribute(k:string,v:string){this.attrs[k]=v;}
  toggleClass(_name:string,_on:boolean){}
  contains(e:unknown):boolean{return e===this||this.children.some(c=>c.contains(e));}
  disconnect(){if(this.contains(this.doc.activeElement))this.doc.activeElement=this.doc.body;this.isConnected=false;for(const c of this.children)c.disconnect();}
  empty(){for(const c of this.children)c.disconnect();this.children=[];this.text='';}
  all():Element[]{return this.children.flatMap(c=>[c,...c.all()]);}
  querySelector(selector:string){return this.all().find(c=>selector.startsWith('.')?c.attrs.class.split(' ').includes(selector.slice(1)):selector.startsWith('option[value=')?c.value===selector.split('"')[1]:c.tag===selector)||null;}
  focus(options?:unknown){assert.ok(this.isConnected&&!this.disabled);this.doc.activeElement=this;this.focusOptions.push(options);}
}
class File{extension='thoughtspace';basename='研究';stat={mtime:1,size:1};path='研究.thoughtspace';}
const View=new Function('isWorkspaceFile','getAllTags','summarizeBoard','hubIndex','hubResults','defaultHubFilter','scopes','palette','setIcon','CSS','setUiFeedback','clearUiFeedback','Notice',transformSync(`class View{${methods}}return View`,{loader:'ts'}).code)(isWorkspaceFile,()=>[],summarizeBoard,hubIndex,hubResults,defaultHubFilter,[{id:'boards',label:'白板'}],{},()=>{},{escape:(s:string)=>s},setUiFeedback,clearUiFeedback,class{});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return{promise,resolve};}
function fixture(){
  const doc={activeElement:null,body:null} as unknown as Document;doc.body=new Element(doc,'body');
  const modal=doc.body.createDiv(),content=modal.createDiv(),main=content.createDiv(),search=content.createEl('input'),tag=content.createEl('select'),external=doc.body.createEl('button');
  const file=new File(),read=deferred<Board>();let fatal=true,reads=0,unloads=0;
  const view=new View();
  Object.assign(view,{active:true,loaded:false,busy:false,generation:0,changes:0,index:hubIndex([],[]),filter:{...defaultHubFilter,query:'研究'},selected:new Set<string>(),page:0,main,search,tag,scopeTitle:content.createEl('h3'),scopeCount:content.createSpan(),modalEl:modal,viewButtons:new Map(),state:content.createDiv(),refreshButton:content.createEl('button'),contentEl:content,life:{unload(){unloads++;}},app:{vault:{getFiles:()=>{if(fatal)throw Error('owned initial index failure');return[file];}},metadataCache:{getFileCache:()=>({})}},host:{journalFolder:'日记',isBoardFile:()=>true,readBoard:()=>{reads++;return read.promise;},preferences:()=>({view:'list',saved:[],recent:[]}),favorites:()=>[]},renderMetrics(){},renderNav(){},renderDetail(){},renderFooter(){}});
  search.value='研究';
  const retry=()=>{const e=main.all().find(c=>c.tag==='button'&&c.attrs['aria-label']==='重试索引');assert.ok(e);return e;};
  return{view,doc,main,search,external,read,retry,get reads(){return reads;},get unloads(){return unloads;},recover:()=>{fatal=false;},fail:()=>{fatal=true;}};
}
async function failed(){const f=fixture();await f.view.load();assert.equal(f.view.loaded,false);assert.equal(f.view.busy,false);assert.equal(f.view.state.dataset.feedback,'error');assert.equal(f.reads,0);f.retry();return f;}
async function settle(){await new Promise<void>(resolve=>setImmediate(resolve));}

test('keyboard retry transfers focus before the actual pending load removes its focused button',async()=>{
  const f=await failed(),button=f.retry();f.recover();button.focus();button.onclick!({detail:0});
  assert.equal(button.isConnected,false);assert.equal(f.view.busy,true);assert.equal(f.reads,1);
  assert.equal(f.doc.activeElement,f.search);assert.deepEqual(f.search.focusOptions,[{preventScroll:true}]);
  f.read.resolve(emptyBoard());await settle();assert.equal(f.view.loaded,true);assert.equal(f.view.busy,false);assert.equal(f.doc.activeElement,f.search);assert.equal(f.view.results.length,1);assert.equal(f.view.filter.query,'研究');assert.equal(f.search.value,'研究');
});
test('another failed keyboard retry retains the same stable search focus and an actionable error',async()=>{
  const f=await failed(),button=f.retry();button.focus();button.onclick!({detail:0});await settle();
  assert.equal(f.doc.activeElement,f.search);assert.equal(f.view.busy,false);assert.equal(f.view.loaded,false);assert.equal(f.view.state.dataset.feedback,'error');assert.notEqual(f.retry(),button);
});
test('pointer retry does not actively redirect focus to search',async()=>{
  const f=await failed(),button=f.retry();f.recover();button.focus();button.onclick!({detail:1});assert.equal(f.search.focusOptions.length,0);assert.equal(f.doc.activeElement,f.doc.body);
  f.read.resolve(emptyBoard());await settle();assert.equal(f.view.loaded,true);assert.equal(f.search.focusOptions.length,0);
});
test('zero-detail activation does not steal focus from another element',async()=>{
  const f=await failed(),button=f.retry();f.recover();f.external.focus();button.onclick!({detail:0});assert.equal(f.doc.activeElement,f.external);f.read.resolve(emptyBoard());await settle();assert.equal(f.doc.activeElement,f.external);assert.equal(f.search.focusOptions.length,0);
});
test('an eventless programmatic retry does not redirect focus',async()=>{
  const f=await failed(),button=f.retry();f.recover();button.focus();button.onclick!();assert.equal(f.search.focusOptions.length,0);f.read.resolve(emptyBoard());await settle();assert.equal(f.search.focusOptions.length,0);
});
test('user focus moved outside during the actual board read is preserved on completion',async()=>{
  const f=await failed(),button=f.retry();f.recover();button.focus();button.onclick!({detail:0});f.external.focus();f.read.resolve(emptyBoard());await settle();assert.equal(f.doc.activeElement,f.external);assert.equal(f.view.loaded,true);
});
test('user input made while the retry reads is preserved without a second search focus call',async()=>{
  const f=await failed(),button=f.retry();f.recover();button.focus();button.onclick!({detail:0});f.search.focus();f.search.value='继续编辑';f.view.filter.query=f.search.value;const focused=f.search.focusOptions.length;f.read.resolve(emptyBoard());await settle();assert.equal(f.doc.activeElement,f.search);assert.equal(f.search.focusOptions.length,focused);assert.equal(f.search.value,'继续编辑');assert.equal(f.view.filter.query,'继续编辑');
});
test('closing during retry prevents late rendering or focus restoration',async()=>{
  const f=await failed(),button=f.retry();f.recover();button.focus();button.onclick!({detail:0});f.view.onClose();f.external.focus();f.read.resolve(emptyBoard());await settle();assert.equal(f.doc.activeElement,f.external);assert.equal(f.view.loaded,false);assert.equal(f.main.isConnected,false);assert.equal(f.unloads,1);
});
test('a retry action from a closed modal does not focus its removed search',async()=>{
  const f=await failed(),button=f.retry();f.view.onClose();f.external.focus();button.onclick!({detail:0});await settle();assert.equal(f.doc.activeElement,f.external);assert.equal(f.search.focusOptions.length,0);
});
