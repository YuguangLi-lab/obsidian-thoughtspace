import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {defaultHubFilter,hubIndex,hubResults,type HubScope,type HubBoard,type HubNote} from '../src/space-hub';

// Execute the production result/empty renderer with identity-aware DOM helpers.
// Indexing, geometry, paint and real browser input have separate checks.
const source=readFileSync(process.env.FOLIO_HUB_EMPTY_SOURCE||'src/space-hub-view.ts','utf8');
const a=source.indexOf('  private action('),b=source.indexOf('  private error(',a);
const r=source.indexOf('  private renderResults('),end=source.indexOf('  private async openItem(',r);
assert.ok(a>=0&&b>a&&r>=0&&end>r);
type Options=string|{cls?:string;text?:string;attr?:Record<string,string>};
class Element {
  children:Element[]=[];attrs:Record<string,string>={};dataset:Record<string,string>={};disabled=false;
  isConnected=true;value='';checked=false;text='';focusOptions:unknown[]=[];
  onclick?:()=>unknown;
  constructor(readonly doc:{body:Element;activeElement:Element|null},readonly tag='div',o:Options={}){
    if(typeof o==='string')o={cls:o};this.attrs={...o.attr, class:o.cls||''};this.text=o.text||'';
  }
  get ownerDocument(){return this.doc;}
  createEl(tag:string,o:Options={}){const child=new Element(this.doc,tag,o);this.children.push(child);return child;}
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
  querySelector(selector:string){return this.all().find(c=>selector.startsWith('.')?c.attrs.class.split(' ').includes(selector.slice(1)):selector.startsWith('[data-hub-nav-key=')?c.attrs['data-hub-nav-key']===selector.split('"')[1]:c.tag===selector)||null;}
  focus(options?:unknown){assert.ok(this.isConnected&&!this.disabled);this.doc.activeElement=this;this.focusOptions.push(options);}
}
const scopes=['boards','favorites','recent','notes','inbox','shared'].map(id=>({id,label:id}));
const View=new Function('hubResults','defaultHubFilter','scopes','palette','setIcon',transformSync(`class View{${source.slice(a,b)}${source.slice(r,end)}}return View`,{loader:'ts'}).code)(hubResults,defaultHubFilter,scopes,{},()=>{});
const board=(path='Board.thoughtspace',notes:string[]=[]):HubBoard=>({path,title:'研究白板',mtime:1,objects:0,edges:0,notes,children:[],missing:[],tags:[],preview:[]});
const note=(path='研究.md',journal=false):HubNote=>({path,title:'阅读材料',mtime:1,tags:['#研究'],journal});
function fixture(scope:HubScope='boards',boards:HubBoard[]=[],notes:HubNote[]=[],errors:{path:string;message:string}[]=[]){
  const doc={activeElement:null,body:null} as unknown as {body:Element;activeElement:Element|null};doc.body=new Element(doc,'body');
  const modal=new Element(doc),main=modal.createDiv(),nav=modal.createDiv(),search=modal.createEl('input'),tag=modal.createEl('select'),sort=modal.createEl('select'),journals=modal.createEl('input'),scopeCount=modal.createSpan();
  const events:string[]=[],failure:unknown[]=[],view=new View(),prefs={view:'list',saved:[],recent:[]} as const;
  Object.assign(view,{active:true,loaded:true,index:hubIndex(boards,notes,errors),filter:{...defaultHubFilter,scope},selected:new Set<string>(),page:0,main,nav,detail:modal.createDiv(),modalEl:modal,search,tag,sort,journals,scopeCount,scopeTitle:modal.createEl('h3'),viewButtons:new Map(),host:{preferences:()=>prefs,favorites:()=>[],createBoard:()=>events.push('create'),capture:()=>events.push('capture')},close:()=>events.push('close'),error:(e:unknown)=>failure.push(e),renderFooter(){},closeDetail:(restore:boolean)=>events.push('close-detail:'+restore),renderDetail:()=>events.push('detail'),showDetail:()=>events.push('show-detail'),renderNav(){nav.empty();for(const s of scopes)nav.createEl('button',{attr:{'data-hub-nav-key':'scope:'+s.id}});}});
  view.renderNav();events.length=0;
  const render=()=>view.renderResults(),empty=()=>{const e=main.querySelector('.ts-hub-empty');assert.ok(e);return e;},title=()=>empty().querySelector('h3')?.text,description=()=>empty().querySelector('p')?.text;
  const button=(label:string)=>{const e=empty().all().find(c=>c.tag==='button'&&c.attrs['aria-label']===label);assert.ok(e,'Missing actual empty-state action '+label);return e;};
  const activate=(label:string)=>{const e=button(label);e.focus();e.onclick!();};
  return{view,doc,main,nav,search,tag,sort,journals,scopeCount,events,failure,render,empty,title,description,button,activate};
}
test('unloaded scope explains preparation without a reset action or false zero count',()=>{
  const f=fixture('inbox');f.view.loaded=false;f.view.busy=true;f.render();assert.equal(f.title(),'正在准备空间');assert.equal(f.empty().all().filter(c=>c.tag==='button').length,0);assert.equal(f.scopeCount.text,'读取中…');
});
test('unavailable initial index is not described as loading and retry preserves the current constraints',()=>{
  const f=fixture('inbox');f.view.loaded=false;f.view.busy=false;f.view.filter.query='研究';f.search.value='研究';f.view.load=()=>f.events.push('retry');f.render();assert.equal(f.title(),'空间索引未就绪');assert.equal(f.scopeCount.text,'索引未就绪');assert.match(f.description()||'',/刷新/);f.activate('重试索引');assert.equal(f.view.filter.query,'研究');assert.equal(f.view.filter.scope,'inbox');assert.deepEqual(f.events,['retry']);assert.deepEqual(f.failure,[]);
});
test('a truly empty board index explains the first board and runs only the explicit host action',()=>{
  const f=fixture();f.render();assert.equal(f.title(),'还没有白板');f.activate('新建第一张白板');assert.deepEqual(f.events,['close','create']);assert.deepEqual(f.failure,[]);
});
for(const scope of ['favorites','recent'] as const)test(`${scope} absence explains that scope and provides board navigation`,()=>{
  const f=fixture(scope,[board()]);f.render();assert.equal(f.title(),scope==='favorites'?'还没有收藏的白板':'暂无最近打开的白板');assert.ok(f.description()?.includes(scope==='favorites'?'收藏':'总览'));f.activate('查看全部白板');assert.equal(f.view.filter.scope,'boards');assert.equal(f.view.results.length,1);assert.equal(f.doc.activeElement,f.nav.querySelector('[data-hub-nav-key="scope:boards"]'));assert.deepEqual(f.failure,[]);
});
test('notes absence offers collection instead of a useless reset',()=>{
  const f=fixture('notes');f.render();assert.equal(f.title(),'还没有笔记');f.activate('收集第一条笔记');assert.deepEqual(f.events,['close','capture']);
});
test('a journal-only index explains the exclusion and preserves sorting when showing journals',()=>{
  const f=fixture('notes',[],[note('日记/今天.md',true)]);f.view.filter.sort='title';f.render();assert.equal(f.title(),'当前未包含日记');f.activate('显示日记');assert.equal(f.view.filter.includeJournals,true);assert.equal(f.journals.checked,true);assert.equal(f.view.filter.sort,'title');assert.equal(f.view.results.length,1);assert.equal(f.doc.activeElement,f.search);assert.deepEqual(f.failure,[]);
});
test('known empty inbox offers the complete note scope without claiming a failed index is complete',()=>{
  const f=fixture('inbox',[board('B.thoughtspace',['研究.md'])],[note()]);f.render();assert.equal(f.title(),'暂无待整理笔记');f.activate('查看全部笔记');assert.equal(f.view.filter.scope,'notes');assert.equal(f.view.results.length,1);
});
test('cross-board absence explains the actual usage requirement',()=>{
  const f=fixture('shared',[board('B.thoughtspace',['研究.md'])],[note()]);f.render();assert.equal(f.title(),'还没有跨白板笔记');assert.match(f.description()||'',/两张或更多/);f.button('查看全部笔记');
});
test('partial indexing cannot claim there are no cross-board notes',()=>{
  const f=fixture('shared',[],[note()],[{path:'坏.thoughtspace',message:'坏'}]);f.render();assert.equal(f.title(),'已索引白板中没有跨白板笔记');assert.match(f.description()||'',/索引问题/);
});
for(const scope of ['inbox','boards','favorites','recent'] as const)test(`${scope} unavailable indexing offers issues rather than a fake empty/reset`,()=>{
  const f=fixture(scope,[],[note()],[{path:'坏.thoughtspace',message:'坏'}]);f.render();assert.equal(f.title(),scope==='inbox'?'暂时无法判定收件箱':scope==='favorites'?'收藏白板暂未完整索引':scope==='recent'?'最近白板暂未完整索引':'白板暂不可用');f.activate('查看索引问题');assert.deepEqual(f.events,['show-detail','detail']);
});
test('search or tag mismatch clears only those constraints and preserves scope, sort, journals and selection',()=>{
  const f=fixture('notes',[],[note()]);f.view.filter={scope:'notes',query:'找不到',tag:'#未知',sort:'title',includeJournals:true};f.search.value='找不到';f.tag.value='#未知';f.sort.value='title';f.journals.checked=true;const selection=new Set(['研究.md']);f.view.selected=selection;f.render();assert.equal(f.title(),'没有匹配的内容');f.activate('清除搜索和标签');assert.deepEqual(f.view.filter,{scope:'notes',query:'',tag:'',sort:'title',includeJournals:true});assert.equal(f.sort.value,'title');assert.equal(f.journals.checked,true);assert.equal(f.view.selected,selection);assert.equal(f.view.results.length,1);assert.equal(f.doc.activeElement,f.search);
});
test('whitespace query is not presented as an active narrowing filter',()=>{
  const f=fixture();f.view.filter.query='   ';f.render();assert.equal(f.title(),'还没有白板');f.button('新建第一张白板');
});
test('a query in a genuinely empty scope does not promise clearing it will reveal content',()=>{
  const f=fixture();f.view.filter.query='研究';f.render();assert.equal(f.title(),'还没有白板');f.button('新建第一张白板');
});
for(const scope of ['favorites','recent'] as const)test(`${scope} partial indexing stays uncertain even when another board is valid`,()=>{
  const f=fixture(scope,[board()],[],[{path:'坏.thoughtspace',message:'坏'}]);f.render();assert.equal(f.title(),scope==='favorites'?'收藏白板暂未完整索引':'最近白板暂未完整索引');f.button('查看索引问题');
});
test('journal visibility preserves a nonmatching search and then explains the filter mismatch',()=>{
  const f=fixture('notes',[],[note('日记/今天.md',true)]);f.view.filter.query='不存在';f.search.value='不存在';f.render();assert.match(f.description()||'',/保留当前搜索和标签/);f.activate('显示日记');assert.equal(f.view.filter.query,'不存在');assert.equal(f.title(),'没有匹配的内容');assert.deepEqual(f.failure,[]);
});
test('a partial index filter mismatch only describes successfully indexed content',()=>{
  const f=fixture('boards',[board()],[],[{path:'坏.thoughtspace',message:'坏'}]);f.view.filter.query='不存在';f.render();assert.equal(f.title(),'已索引内容中没有匹配');f.button('清除搜索和标签');
});
