import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import type {BoardAction} from '../src/board-experience-view';

type Options={cls?:string; text?:string; attr?:Record<string,string>;type?:string};
class Element{
 children:Element[]=[];classes=new Set<string>();attributes:Record<string,string>={};disabled=false;value='';scrolls=0;classWrites=0;
 private text='';
 onclick?:()=>void;oninput?:()=>void;onkeydown?:(event:any)=>void;onpointerenter?:()=>void;onfocus?:()=>void;
 constructor(readonly tagName:string,readonly ownerDocument:{activeElement?:Element},options:Options|string={}){
  const opts=typeof options==='string'?{cls:options}:options;
  for(const cls of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(cls);
  this.text=opts.text||'';this.attributes={...opts.attr};
 }
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag.toUpperCase(),this.ownerDocument,options);this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}
 createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(cls:string){this.classes.add(cls);}
 toggleClass(cls:string,enabled:boolean){this.classWrites++;if(enabled)this.classes.add(cls);else this.classes.delete(cls);}
 setAttribute(key:string,value:string){this.attributes[key]=value;}
 removeAttribute(key:string){delete this.attributes[key];}
 getAttribute(key:string){return this.attributes[key]??null;}
 setText(text:string){this.text=text;this.children=[];}
 empty(){this.children=[];this.text='';}
 matches(selector:string){return selector.startsWith('.')?this.classes.has(selector.slice(1)):this.tagName===selector.toUpperCase();}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 scrollIntoView(){this.scrolls++;}
 focus(){this.ownerDocument.activeElement=this;this.onfocus?.();}
 click(){if(!this.disabled)this.onclick?.();}
}
class Modal{
 readonly document:{activeElement?:Element}={};readonly modalEl=new Element('DIV',this.document);
 readonly titleEl=this.modalEl.createEl('h2');readonly contentEl=this.modalEl.createDiv();closeCount=0;
 close(){this.closeCount++;}
}
const source=readFileSync('src/board-experience-view.ts','utf8');
const start=source.indexOf('export class BoardActionModal'),end=source.indexOf('export function mousePreferenceControls',start);
const BoardActionModal=new Function('Modal','themeSurface','setIcon','Notice',transformSync(source.slice(start,end).replace('export class','class')+'\nreturn BoardActionModal;',{loader:'ts'}).code)(Modal,()=>{},()=>{},class{});
function fixture(actions?:BoardAction[]){
 const runs:string[]=[];
 const provided=actions||[
  {label:'复制样式',group:'样式与排列',icon:'copy',run:()=>runs.push('copy')},
  {label:'锁定对象',group:'样式与排列',icon:'lock',disabled:true,run:()=>runs.push('locked')},
  {label:'粘贴样式',group:'样式与排列',icon:'clipboard',run:()=>runs.push('paste')}
 ];
 const modal=new BoardActionModal({},provided);modal.onOpen();
 const search=modal.contentEl.querySelector('.ts-board-action-search') as Element,list=modal.contentEl.querySelector('.ts-board-action-list') as Element;
 return{modal,search,list,runs,actions:provided};
}
function key(el:Element,key:string,options:Record<string,unknown>={}){
 const event={key,isComposing:false,keyCode:0,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,defaultPrevented:false,target:el,preventDefault(){this.defaultPrevented=true;},...options};
 el.onkeydown?.(event);return event;
}
const current=(list:Element)=>list.querySelector('.is-current')?.getAttribute('aria-label');

test('IME candidate confirmation and arrows do not execute or navigate actions',async()=>{
 for(const pressed of ['Enter','ArrowDown','ArrowUp']){
  const {modal,search,list,runs}=fixture(),before=current(list),event=key(search,pressed,{isComposing:true});
  await Promise.resolve();assert.equal(event.defaultPrevented,false,pressed);assert.equal(current(list),before,pressed);assert.equal(modal.closeCount,0,pressed);assert.deepEqual(runs,[],pressed);
 }
});
test('legacy IME keyCode 229 leaves composition confirmation untouched',async()=>{
 const {modal,search,runs}=fixture(),event=key(search,'Enter',{keyCode:229});
 await Promise.resolve();assert.equal(event.defaultPrevented,false);assert.equal(modal.closeCount,0);assert.deepEqual(runs,[]);
});

test('Home, End and modified arrows retain native text editing behavior',()=>{
 const {search,list}=fixture(),before=current(list);
 for(const pressed of ['Home','End'])assert.equal(key(search,pressed).defaultPrevented,false);
 for(const modifier of ['shiftKey','ctrlKey','metaKey','altKey']){
  for(const pressed of ['ArrowUp','ArrowDown','Enter'])assert.equal(key(search,pressed,{[modifier]:true}).defaultPrevented,false,`${modifier} ${pressed}`);
 }
 assert.equal(current(list),before);
});

test('keyboard selection skips disabled actions, clamps at ends and executes once',async()=>{
 const {modal,search,list,runs}=fixture();assert.equal(current(list),'复制样式');
 key(search,'ArrowUp');assert.equal(current(list),'复制样式');
 key(search,'ArrowDown');assert.equal(current(list),'粘贴样式');
 key(search,'ArrowDown');assert.equal(current(list),'粘贴样式');
 assert.equal(list.querySelector('.is-current')?.getAttribute('aria-current'),'true');
 assert.equal(list.querySelectorAll('button').filter(button=>button.getAttribute('aria-current')==='true').length,1);
 key(search,'Enter');key(search,'Enter');await Promise.resolve();
 assert.equal(modal.closeCount,1);assert.deepEqual(runs,['paste']);
});

test('pointer and keyboard focus agree with the action selected from search',async()=>{
 const {modal,search,list,runs}=fixture(),buttons=list.querySelectorAll('button');
 buttons[2].onpointerenter?.();assert.equal(current(list),'粘贴样式');
 buttons[0].focus();assert.equal(current(list),'复制样式');
 const event=key(list,'ArrowDown',{target:buttons[0]});
 assert.equal(event.defaultPrevented,true);assert.equal(modal.document.activeElement,buttons[2]);assert.equal(current(list),'粘贴样式');
 assert.equal(key(list,'ArrowUp',{target:buttons[2],isComposing:true}).defaultPrevented,false);
 search.focus();key(search,'Enter');await Promise.resolve();assert.deepEqual(runs,['paste']);
});

test('available filter combines with categories and query and resets from an empty result',()=>{
 const {modal,search,list}=fixture();
 const count=modal.contentEl.querySelector('.ts-action-count') as Element,available=modal.contentEl.querySelector('.ts-action-available') as Element,tabs=modal.contentEl.querySelector('.ts-action-tabs') as Element;
 assert.equal(count.textContent,'显示 3 项 · 2 项可用');assert.equal(count.getAttribute('aria-live'),'polite');
 available.click();assert.equal(available.getAttribute('aria-pressed'),'true');assert.equal(available.classes.has('is-active'),true);
 assert.equal(count.textContent,'显示 2 项 · 2 项可用');assert.equal(list.querySelectorAll('button').some(button=>button.disabled),false);
 search.value='粘贴';search.oninput?.();assert.equal(count.textContent,'显示 1 项 · 1 项可用');assert.equal(current(list),'粘贴样式');
 const contentTab=tabs.querySelectorAll('button').find(button=>button.textContent==='内容')!;contentTab.click();
 assert.equal(contentTab.getAttribute('aria-pressed'),'true');assert.equal(count.textContent,'显示 0 项 · 0 项可用');assert.equal(current(list),undefined);
 list.querySelector('.ts-action-empty')!.querySelector('button')!.click();
 assert.equal(search.value,'');assert.equal(modal.document.activeElement,search);assert.equal(available.getAttribute('aria-pressed'),'false');
 assert.equal(tabs.querySelectorAll('button')[0].getAttribute('aria-pressed'),'true');assert.equal(count.textContent,'显示 3 项 · 2 项可用');
});

test('filter refresh retains a still-visible selection and picks the first enabled replacement',()=>{
 const {modal,search,list}=fixture();key(search,'ArrowDown');assert.equal(current(list),'粘贴样式');
 const tabs=modal.contentEl.querySelector('.ts-action-tabs').querySelectorAll('button') as Element[];
 tabs.find(button=>button.textContent==='样式与排列')!.click();assert.equal(current(list),'粘贴样式');
 tabs.find(button=>button.textContent==='全部')!.click();assert.equal(current(list),'粘贴样式');
 search.value='样式';search.oninput?.();assert.equal(current(list),'粘贴样式');
 modal.contentEl.querySelector('.ts-action-available').click();assert.equal(current(list),'粘贴样式');
 search.value='复制';search.oninput?.();assert.equal(current(list),'复制样式');
 search.value='没有此操作';search.oninput?.();assert.equal(current(list),undefined);
 search.value='';search.oninput?.();assert.equal(current(list),'复制样式');
});

test('an all-disabled result has no current item and cannot close or execute the modal',async()=>{
 let runs=0;const {modal,search,list}=fixture([{label:'需要选中对象',group:'内容',icon:'file',disabled:true,run:()=>runs++}]);
 assert.equal(current(list),undefined);assert.equal(modal.contentEl.querySelector('.ts-action-count').textContent,'显示 1 项 · 0 项可用');
 for(const pressed of ['Enter','ArrowDown','ArrowUp'])assert.equal(key(search,pressed).defaultPrevented,false);
 list.querySelector('button')!.click();await Promise.resolve();assert.equal(modal.closeCount,0);assert.equal(runs,0);
});

test('an action becoming unavailable after rendering is rejected at execution time',async()=>{
 const {modal,search,actions,runs}=fixture();actions[0].disabled=true;key(search,'Enter');
 await Promise.resolve();assert.equal(modal.closeCount,0);assert.deepEqual(runs,[]);
});

test('a pointer click followed by repeated click or Enter still executes exactly once',async()=>{
 const {modal,search,list,runs}=fixture(),button=list.querySelector('button')!;
 button.click();button.click();key(search,'Enter');await Promise.resolve();
 assert.equal(modal.closeCount,1);assert.deepEqual(runs,['copy']);
});

test('search normalizes full-width text and case and intersects label, group and hint tokens',()=>{
 const {search,list}=fixture([
  {label:'ＡＢＣ 样式',group:'内容',hint:'Ctrl Shift V',icon:'file',run(){}},
  {label:'ABC 样式',group:'视角',hint:'Ctrl V',icon:'eye',run(){}}
 ]);
 search.value='ａｂｃ　内容 shift';search.oninput?.();
 assert.deepEqual(list.querySelectorAll('button').map(button=>button.getAttribute('aria-label')),['ＡＢＣ 样式']);
});

test('group ordering is stable, includes added groups and does not mutate caller actions',()=>{
 const actions:BoardAction[]=[
  {label:'extra first',group:'扩展',icon:'file',run(){}},
  {label:'view first',group:'视角',icon:'eye',run(){}},
  {label:'find',group:'查找与选择',icon:'search',run(){}},
  {label:'view second',group:'视角',icon:'eye',run(){}},
  {label:'extra second',group:'扩展',icon:'file',run(){}}
 ];
 const before=actions.slice(),{modal,list}=fixture(actions);
 assert.deepEqual(actions,before);
 assert.deepEqual(list.querySelectorAll('button').map(button=>button.getAttribute('aria-label')),['find','view first','view second','extra first','extra second']);
 const extraTab=modal.contentEl.querySelector('.ts-action-tabs').querySelectorAll('button').find((button:Element)=>button.textContent==='扩展');
 extraTab.click();assert.deepEqual(list.querySelectorAll('button').map(button=>button.getAttribute('aria-label')),['extra first','extra second']);
});

test('repeated filtering uses the prebuilt index without rereading action search metadata',()=>{
 let reads=0;const actions:BoardAction[]=Array.from({length:400},(_,i)=>({
  get label(){reads++;return `操作 ${i}`;},get group(){reads++;return '内容';},get hint(){reads++;return 'Ctrl K';},icon:'file',run(){}
 }));
 const {search,list}=fixture(actions);reads=0;
 for(const query of ['missing','another missing','no match here']){search.value=query;search.oninput?.();assert.equal(current(list),undefined);}
 assert.equal(reads,0,'search must not normalize the full action catalog again on each keystroke');
});

test('moving the current action updates only the old and new rows in a large catalog',()=>{
 const {search,list}=fixture(Array.from({length:400},(_,i)=>({label:`操作 ${i}`,group:'内容',icon:'file',run(){}})));
 const buttons=list.querySelectorAll('button');for(const button of buttons)button.classWrites=0;
 key(search,'ArrowDown');assert.equal(current(list),'操作 1');
 assert.equal(buttons.reduce((sum,button)=>sum+button.classWrites,0),2);
});
