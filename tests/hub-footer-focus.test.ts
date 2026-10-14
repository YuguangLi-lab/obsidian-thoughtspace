import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {defaultHubFilter} from '../src/space-hub';

// Actual production action/runFooterAction/renderFooter execute. The small DOM
// substitute checks identity and removal; browser painting/Tab has separate QA.
const source=readFileSync('src/space-hub-view.ts','utf8');
const start=source.indexOf('  private runFooterAction('),end=source.lastIndexOf('\n}');
assert.ok(start>0&&end>start);
const action=source.slice(source.indexOf('  private action('),source.indexOf('  private error('));
type Doc={activeElement:Element|null;body:Element;keyboard:boolean};
type Options=string|{cls?:string;attr?:Record<string,string>;text?:string};
class Element {
 children:Element[]=[];dataset:Record<string,string>={};attrs:Record<string,string>={};disabled=false;isConnected=true;focusVisible=false;focusOptions:unknown[]=[];textContent='';
 constructor(readonly ownerDocument:Doc,readonly tag='div',options:Options={}){if(typeof options==='string')options={cls:options};this.attrs={...(options.attr||{})};this.textContent=options.text||'';}
 createEl(tag:string,o:Options={}){const child=new Element(this.ownerDocument,tag,o);this.children.push(child);return child;}
 createDiv(o:Options={}){return this.createEl('div',o);}
 createSpan(o:Options={}){return this.createEl('span',o);}
 contains(e:unknown):boolean{return e===this||this.children.some(c=>c.contains(e));}
 matches(s:string){return s===':focus-visible'&&this.focusVisible;}
 querySelector<T extends Element>(s:string):T|null{const key=/^\[data-hub-footer-key="([^"]+)"\]$/.exec(s)?.[1];return(this.children.find(e=>key&&e.dataset.hubFooterKey===key)||null) as T|null;}
 disconnect(){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;this.isConnected=false;for(const c of this.children)c.disconnect();}
 empty(){for(const c of this.children)c.disconnect();this.children=[];}
 focus(options?:unknown){assert.ok(this.isConnected&&!this.disabled,'Focus must target a connected enabled control');this.ownerDocument.activeElement=this;this.focusVisible=this.ownerDocument.keyboard;this.focusOptions.push(options);}
 onclick?:(event?:{detail:number})=>void;
}
const View=new Function('setIcon',transformSync(`class View{${action}${source.slice(start,end)}}return View;`,{loader:'ts'}).code)(()=>{});
function fixture(count=144,page=0,scope='notes',selected=5){
 const document={activeElement:null,body:null,keyboard:true} as unknown as Doc;document.body=new Element(document,'body');
 const modal=new Element(document),footer=modal.createDiv(),search=modal.createEl('input'),errors:unknown[]=[],view=new View();let renders=0,afterRebuild:(()=>void)|undefined;
 Object.assign(view,{active:true,modalEl:modal,footer,search,index:{},filter:{...defaultHubFilter,scope},results:Array.from({length:count},(_,i)=>({path:`Owned/${i}.md`})),page,selected:new Set(Array.from({length:selected},(_,i)=>`Owned/${i}.md`)),busy:false,host:{},error(e:unknown){errors.push(e)},add(){throw Error('No persistent operation allowed')},renderResults(){renders++;view.renderFooter();afterRebuild?.()}});
 view.renderFooter();const button=(key:string)=>{const b=footer.querySelector<Element>(`[data-hub-footer-key="${key}"]`);assert.ok(b,`Missing actual footer key ${key}`);return b};
 const activate=(key:string)=>{const b=button(key);b.focus();b.onclick!();return b};
 return{view,document,modal,footer,search,errors,button,activate,set afterRebuild(f:(()=>void)|undefined){afterRebuild=f},get renders(){return renders}};
}
test('next page retains the equivalent enabled new button',()=>{const f=fixture();const old=f.activate('next');assert.equal(f.view.page,1);assert.equal(f.document.activeElement,f.button('next'));assert.notEqual(old,f.document.activeElement);assert.equal(old.isConnected,false);assert.deepEqual(f.button('next').focusOptions,[{preventScroll:true}]);assert.equal(f.renders,1)});
test('last page next action falls back to the enabled previous button',()=>{const f=fixture(96);f.activate('next');assert.equal(f.view.page,1);assert.equal(f.button('next').disabled,true);assert.equal(f.document.activeElement,f.button('previous'))});
test('first page previous action falls back to next',()=>{const f=fixture(144,1);f.activate('previous');assert.equal(f.view.page,0);assert.equal(f.button('previous').disabled,true);assert.equal(f.document.activeElement,f.button('next'))});
test('clear selection restores select-page after its launcher disappears',()=>{const f=fixture();const old=f.activate('clear-selection');assert.equal(f.view.selected.size,0);assert.equal(old.isConnected,false);assert.equal(f.document.activeElement,f.button('select-page'));assert.equal(f.errors.length,0)});
test('select-page retains its key and the actual 48-item selection semantics',()=>{const f=fixture(50,0,'notes',0);f.activate('select-page');assert.equal(f.view.selected.size,48);assert.equal(f.view.selected.has('Owned/47.md'),true);assert.equal(f.view.selected.has('Owned/48.md'),false);assert.equal(f.document.activeElement,f.button('select-page'))});
test('clear selection outside note scope falls back to search',()=>{const f=fixture(144,0,'boards');f.activate('clear-selection');assert.equal(f.document.activeElement,f.search);assert.deepEqual(f.search.focusOptions,[{preventScroll:true}])});
test('pointer click after keyboard focus-visible does not restore focus',()=>{const f=fixture();const b=f.button('next');b.focus();assert.equal(b.focusVisible,true);b.onclick!({detail:1});assert.equal(f.document.activeElement,f.document.body)});
test('pointer focus does not trigger keyboard restoration',()=>{const f=fixture();f.document.keyboard=false;f.activate('next');assert.equal(f.document.activeElement,f.document.body)});
test('another control focused during rebuilding wins',()=>{const f=fixture();f.afterRebuild=()=>f.search.focus();f.activate('next');assert.equal(f.document.activeElement,f.search);assert.equal(f.button('next').focusOptions.length,0)});
test('modal closure prevents focus restoration',()=>{const f=fixture();f.afterRebuild=()=>{f.view.active=false;f.modal.disconnect()};f.activate('next');assert.equal(f.document.activeElement,f.document.body)});
test('changed index identity prevents restoration',()=>{const f=fixture();f.afterRebuild=()=>f.view.index={};f.activate('next');assert.equal(f.document.activeElement,f.document.body)});
test('changed filter values prevent restoration even with the same object',()=>{const f=fixture();f.afterRebuild=()=>f.view.filter.query='another browse context';f.activate('next');assert.equal(f.document.activeElement,f.document.body)});
test('changed filter identity prevents restoration',()=>{const f=fixture();f.afterRebuild=()=>f.view.filter={...f.view.filter};f.activate('next');assert.equal(f.document.activeElement,f.document.body)});
test('programmatic action while search owns focus does not steal it',()=>{const f=fixture();f.search.focus();f.button('next').onclick!();assert.equal(f.document.activeElement,f.search)});
test('disabled launching control cannot cause restoration',()=>{const f=fixture();const b=f.button('next');b.focus();b.disabled=true;f.view.runFooterAction(b,()=>f.view.renderFooter());assert.equal(f.document.activeElement,f.document.body)});
test('still-connected launching control is never re-focused',()=>{const f=fixture();const b=f.button('next');b.focus();f.view.runFooterAction(b,()=>{});assert.equal(f.document.activeElement,b);assert.equal(b.focusOptions.length,1)});
test('100-item overflow retains selection and launcher without a rebuild',()=>{const f=fixture(144,2,'notes',100);const before=f.view.selected;const b=f.activate('select-page');assert.equal(f.view.selected,before);assert.equal(f.view.selected.size,100);assert.equal(f.document.activeElement,b);assert.equal(f.renders,0);assert.equal(f.errors.length,1);assert.match(String(f.errors[0]),/跨页选择超过 100/)});
