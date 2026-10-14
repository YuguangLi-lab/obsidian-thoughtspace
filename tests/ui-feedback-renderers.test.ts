import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {setUiFeedback,clearUiFeedback} from '../src/ui-feedback';
import {planPdfQuote} from '../src/pdf-quote';
import {referenceReading} from '../src/reference-reading';

/**
 * Execute the production modal methods, replacing only the Obsidian framework.
 * This deliberately small DOM/event fixture is not a Markdown parser, browser,
 * native Modal implementation, geometry test, or persistence integration test.
 * All app access is denied. Completion/rejection comes from owned in-memory
 * callbacks; nothing opens a vault, writes data, or connects to Obsidian.
 */
class OwnedDocument {
 activeElement?:OwnedElement;
 readonly timers:(()=>void)[]=[];
 readonly body=new OwnedElement(this,'body');
 readonly win={setTimeout:(fn:()=>void)=>{this.timers.push(fn);return this.timers.length;}};
 constructor(){this.body.connectedRoot=true;}
 flushTimers(){for(const fn of this.timers.splice(0))fn();}
}
class OwnedElement {
 children:OwnedElement[]=[];
 parentElement?:OwnedElement;
 connectedRoot=false;
 className='';
 dataset:Record<string,string>={};
 attributes:Record<string,string>={};
 ownText='';
 value='';
 readOnly=false;
 disabled=false;
 selectionStart=0;
 selectionEnd=0;
 writes=0;
 onclick?:(event?:any)=>unknown;
 oninput?:(event?:any)=>unknown;
 onchange?:(event?:any)=>unknown;
 onkeydown?:(event?:any)=>unknown;
 readonly listeners=new Map<string,{fn:(event:any)=>void;capture:boolean}[]>();
 readonly classList={
  add:(...names:string[])=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
  contains:(name:string)=>this.className.split(/\s+/).includes(name),
 };
 readonly tagName:string;
 constructor(readonly ownerDocument:OwnedDocument,tag='div'){this.tagName=tag.toUpperCase();}
 get win(){return this.ownerDocument.win;}
 get isConnected():boolean{return this.connectedRoot||!!this.parentElement?.isConnected;}
 get textContent():string{return this.ownText+this.children.map(c=>c.textContent).join('');}
 setText(text:string){this.empty();this.ownText=String(text);}
 empty(){this.writes++;for(const child of this.children)child.parentElement=undefined;this.children=[];this.ownText='';}
 addClass(...names:string[]){this.classList.add(...names);}
 setAttribute(key:string,value:string){this.attributes[key]=String(value);if(key==='readonly')this.readOnly=true;}
 getAttribute(key:string){return this.attributes[key]??null;}
 appendChild(child:OwnedElement){child.remove();this.children.push(child);child.parentElement=this;return child;}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(c=>c!==this);this.parentElement=undefined;}}
 after(child:OwnedElement){assert.ok(this.parentElement,'after() needs an owned parent');const parent=this.parentElement;child.remove();parent.children.splice(parent.children.indexOf(this)+1,0,child);child.parentElement=parent;}
 createEl(tag:string,options:any={}){const el=new OwnedElement(this.ownerDocument,tag);if(typeof options==='string')options={cls:options};if(options.cls)el.addClass(...options.cls.split(/\s+/));if(options.text!==undefined)el.setText(options.text);if(options.value!==undefined)el.value=options.value;for(const [key,value] of Object.entries(options.attr||{}))el.setAttribute(key,String(value));return this.appendChild(el);}
 createDiv(options:any={}){return this.createEl('div',options);}
 createSpan(options:any={}){return this.createEl('span',options);}
 focus(){this.ownerDocument.activeElement=this;}
 setSelectionRange(from:number,to:number){this.selectionStart=from;this.selectionEnd=to;}
 addEventListener(event:string,fn:(event:any)=>void,capture=false){const list=this.listeners.get(event)||[];list.push({fn,capture});this.listeners.set(event,list);}
 dispatch(event:string,data:any={}){for(const {fn} of this.listeners.get(event)||[])fn(data);}
 click(){if(!this.disabled)return this.onclick?.();}
 matches(selector:string){
  const match=/^([\w-]+)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:=([^\]]+))?\])?$/.exec(selector);
  assert.ok(match,'Fixture does not implement this selector: '+selector);
  const [,tag,cls,attr,value]=match;
  return (!tag||this.tagName===tag.toUpperCase())&&(!cls||this.classList.contains(cls))&&(!attr||attr in this.attributes)&&(value===undefined||this.attributes[attr]===value.replace(/^['"]|['"]$/g,''));
 }
 closest(selector:string):OwnedElement|null{return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
 querySelectorAll(selector:string):OwnedElement[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
}
class FrameworkModal {
 readonly document=new OwnedDocument();
 readonly modalEl=this.document.body.createDiv('modal');
 readonly titleEl=this.modalEl.createDiv('modal-title');
 readonly contentEl=this.modalEl.createDiv('modal-content');
 closeCount=0;closeAttempts=0;
 constructor(readonly app:unknown){}
 onClose(){}
 close(){this.closeAttempts++;if(this.closeCount)return;this.closeCount++;this.onClose();this.modalEl.remove();}
}
class FrameworkComponent {
 loads=0;unloads=0;
 load(){this.loads++;}
 unload(){this.unloads++;}
 registerDomEvent(el:OwnedElement,event:string,fn:(event:any)=>void,capture=false){el.addEventListener(event,fn,capture);}
}
const forbidden:string[]=[];
const deniedApp=new Proxy({}, {get:(_target,key)=>{forbidden.push(String(key));throw Error('App/vault/persistence access is forbidden: '+String(key));}});
const sourceFiles=['pdf-quote-view','writing-reference-view','reference-reading-view'] as const;
function productionClass(file:typeof sourceFiles[number],name:string,extra:Record<string,unknown>={}){
 // Only module imports/exports are replaced. The real class, method bodies,
 // state guards, hook calls, labels, and handlers are transpiled unchanged.
 const source=readFileSync(new URL('../src/'+file+'.ts',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export class '+name,'class '+name);
 const deps={Modal:FrameworkModal,Component:FrameworkComponent,themeSurface:()=>{},setIcon:(el:OwnedElement,name:string)=>el.setAttribute('data-framework-icon',name),setUiFeedback,clearUiFeedback,...extra};
 return new Function(...Object.keys(deps),transformSync(source+'\nreturn '+name+';',{loader:'ts',target:'es2022'}).code)(...Object.values(deps));
}
const PdfQuoteModal=productionClass('pdf-quote-view','PdfQuoteModal');
const WritingReferenceModal=productionClass('writing-reference-view','WritingReferenceModal');
const resolve=(path:string)=>path;
function required(root:OwnedElement,selector:string){const el=root.querySelector(selector);assert.ok(el,'Missing production node '+selector);return el;}
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function settle(){for(let i=0;i<5;i++)await Promise.resolve();}
const original='# 原始参考\n\n长中文引用保持完整，不能改写原笔记。\n';
function writingFixture(insert:(mode:string,range:any)=>Promise<void>){
 let restores=0;
 const ranges=[{label:'标题 原始参考',from:0,to:original.length,subpath:'#原始参考'}];
 const modal=new WritingReferenceModal(deniedApp,'Notes/原始参考.md',original,ranges,insert,()=>restores++);
 modal.onOpen();
 const input=required(modal.contentEl,'textarea'),select=required(modal.contentEl,'select'),error=required(modal.contentEl,'.ts-writing-reference-error');
 select.value='0';select.onchange!();
 const actions=required(modal.contentEl,'.ts-writing-reference-buttons').querySelectorAll('button');
 return {modal,input,select,error,actions,ranges,restores:()=>restores};
}
function readingFixture(render:(app:unknown,markdown:string,prose:OwnedElement,path:string,scope:FrameworkComponent)=>Promise<void>,insert?:(embed:boolean)=>Promise<void>,truncated=false){
 const Reading=productionClass('reference-reading-view','ReferenceReadingModal',{MarkdownRenderer:{render}});
 let done=0;
 const content=referenceReading(truncated?'长'.repeat(40001):original,null,'');
 const modal=new Reading(deniedApp,'Notes/原始参考.md',content,()=>done++,insert);
 modal.onOpen();
 return {modal,content,prose:required(modal.contentEl,'.ts-reference-reading-prose'),error:required(modal.contentEl,'.ts-reference-reading-error'),actions:required(modal.contentEl,'.ts-reference-reading-actions').querySelectorAll('button'),done:()=>done};
}

test('PDF quote: invalid → valid info → save rejection keeps the original input and controls',()=>{
 let saves=0;const planCalls:string[][]=[];
 const plan=(text:string,source:string)=>{planCalls.push([text,source]);return planPdfQuote(text,source,resolve);};
 const modal=new PdfQuoteModal(deniedApp,'无效引文',plan,()=>{saves++;throw Error('Owned save rejected');});modal.onOpen();
 const input=required(modal.contentEl,'textarea'),source=required(modal.contentEl,'input'),status=required(modal.contentEl,'.ts-pdf-quote-status'),save=modal.contentEl.querySelectorAll('button').find((b:OwnedElement)=>b.textContent==='加入白板')!;
 assert.equal(status.dataset.feedback,'error');assert.equal(save.disabled,true);assert.equal(status.getAttribute('role'),'status');assert.equal(status.getAttribute('aria-live'),'polite');
 const raw='> 摘录原文\r\n[[资料/论文.pdf#page=2&annotation=ABC]]\r\n';input.value=raw;source.value='  Notes/阅读.md  ';input.oninput!();
 assert.equal(status.dataset.feedback,'info');assert.match(status.textContent,/资料\/论文\.pdf · 第 2 页 · 批注/);assert.equal(save.disabled,false);assert.equal(input.value,raw);
 save.click();assert.equal(saves,1);assert.equal(planCalls.length,3,'Save must revalidate the latest input');assert.deepEqual(planCalls.at(-1),[raw,'Notes/阅读.md']);assert.equal(status.dataset.feedback,'error');assert.equal(status.textContent,'Owned save rejected');assert.equal(save.disabled,false);assert.equal(modal.closeCount,0);assert.equal(input.value,raw);
 input.oninput!();assert.equal(status.dataset.feedback,'info');assert.equal(save.disabled,false);
 modal.close();const before=saves;save.onclick!();assert.equal(saves,before,'Detached save handler must honor closed');
});

test('PDF quote: composition shortcut does not submit; success closes only this modal',()=>{
 let saves=0,prevented=0;const modal=new PdfQuoteModal(deniedApp,'[[owned.pdf#page=1]]',(t:string,s:string)=>planPdfQuote(t,s,resolve),()=>saves++);modal.onOpen();const input=required(modal.contentEl,'textarea');
 input.onkeydown!({isComposing:true,metaKey:true,key:'Enter',preventDefault:()=>prevented++});assert.equal(saves,0);assert.equal(prevented,0);
 input.onkeydown!({isComposing:false,ctrlKey:true,key:'Enter',preventDefault:()=>prevented++});assert.equal(saves,1);assert.equal(prevented,1);assert.equal(modal.closeCount,1);assert.equal(modal.modalEl.isConnected,false);
});

test('Writing reference: rejection → pending retry clears both feedback/text and preserves read-only selection',async()=>{
 const retry=deferred();let calls=0;const seen:any[]=[];
 const f=writingFixture(async(mode,range)=>{seen.push([mode,{...range}]);if(++calls===1)throw Error('Owned insertion rejected');await retry.promise;});
 assert.equal(f.input.readOnly,true);assert.equal(f.input.value,original);assert.equal(f.error.getAttribute('role'),'alert');assert.ok(f.actions.every(b=>!b.disabled));
 await f.actions[0].click();assert.equal(f.error.dataset.feedback,'error');assert.equal(f.error.textContent,'Owned insertion rejected');assert.ok(f.actions.every(b=>!b.disabled));
 const pending=f.actions[0].click();assert.equal(f.error.dataset.feedback,undefined);assert.equal(f.error.textContent,'');assert.ok(f.actions.every(b=>b.disabled));
 await f.actions[0].onclick!();assert.equal(calls,2,'busy handler must reject duplicate submissions');assert.equal(f.input.value,original);assert.equal(f.input.selectionEnd,original.length);assert.equal(f.input.getAttribute('readonly'),'true');assert.deepEqual(seen[0],['quote',f.ranges[0]]);
 retry.resolve();await pending;assert.equal(f.modal.closeCount,1);assert.equal(f.modal.isCurrent(),false);assert.equal(f.restores(),0);f.modal.document.flushTimers();assert.equal(f.restores(),1);
});

test('Writing reference: a free selection does not enable anchored embed or fabricate a source anchor',()=>{
 const f=writingFixture(async()=>{});f.select.value='';f.select.onchange!();f.input.setSelectionRange(2,7);f.input.dispatch('select');
 assert.deepEqual(f.actions.map(b=>b.disabled),[false,true,false]);assert.equal(required(f.modal.contentEl,'.ts-writing-reference-hint').dataset.hasAnchor,'false');assert.equal(f.input.value,original);f.modal.close();f.modal.document.flushTimers();
});

for(const outcome of ['resolve','reject'] as const)test(`Writing reference: close before late ${outcome} prevents new feedback/close/selection writes`,async()=>{
 const op=deferred();const f=writingFixture(()=>op.promise);const pending=f.actions[0].click();f.modal.close();const writes=f.error.writes;
 if(outcome==='resolve')op.resolve();else op.reject(Error('Late owned failure'));await pending;
 assert.equal(f.error.writes,writes);assert.equal(f.error.dataset.feedback,undefined);assert.equal(f.modal.closeCount,1);assert.equal(f.modal.closeAttempts,1);assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.input.value,original);f.modal.document.flushTimers();assert.equal(f.restores(),1);
});

test('Reference reading: controlled Markdown completion keeps native post-render controls read-only',async()=>{
 const op=deferred();let received:any[]=[];let checkbox!:OwnedElement,editable!:OwnedElement;
 const f=readingFixture(async(app,markdown,prose,path,scope)=>{received=[app,markdown,path,scope];checkbox=prose.createEl('input',{attr:{type:'checkbox'}});editable=prose.createDiv({attr:{contenteditable:'true'}});await op.promise;});
 assert.equal(received[0],deniedApp);assert.equal(received[1],original);assert.equal(received[2],'Notes/原始参考.md');assert.equal(received[3].loads,1);assert.equal(f.prose.getAttribute('role'),'region');assert.equal(f.prose.getAttribute('aria-label'),'引用正文');
 op.resolve();await settle();assert.equal(checkbox.disabled,true);assert.equal(editable.getAttribute('contenteditable'),'false');
 let prevented=0,stopped=0;f.prose.dispatch('click',{target:checkbox,preventDefault:()=>prevented++,stopPropagation:()=>stopped++});assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(f.prose.listeners.get('click')?.[0].capture,true);assert.equal(f.content.markdown,original);
 f.modal.close();assert.equal(f.done(),1);assert.equal(received[3].unloads,1);
});

test('Reference reading: insertion error → retry clears the alert while disabling only its actions',async()=>{
 const op=deferred();let calls=0;
 const f=readingFixture(async()=>{},async()=>{if(++calls===1)throw Error('Owned insert rejected');await op.promise;});await settle();
 assert.equal(f.error.getAttribute('role'),'alert');f.actions[0].click();await settle();assert.equal(f.error.dataset.feedback,'error');assert.equal(f.error.textContent,'Owned insert rejected');assert.ok(f.actions.every(b=>!b.disabled));
 f.actions[1].click();assert.equal(f.error.dataset.feedback,undefined);assert.equal(f.error.textContent,'');assert.ok(f.actions.every(b=>b.disabled));f.actions[0].onclick!();assert.equal(calls,2);
 assert.equal(required(f.modal.contentEl,'.ts-reference-reading-back').disabled,false,'The original cancel action remains available');assert.equal(f.content.markdown,original);
 op.resolve();await settle();assert.equal(f.modal.closeCount,1);assert.equal(f.done(),1);
});

for(const outcome of ['resolve','reject'] as const)test(`Reference reading: close before insertion ${outcome} cannot update the detached alert or close twice`,async()=>{
 const op=deferred();const f=readingFixture(async()=>{},()=>op.promise);await settle();f.actions[0].click();f.modal.close();const writes=f.error.writes;
 if(outcome==='resolve')op.resolve();else op.reject(Error('Late owned failure'));await settle();
 assert.equal(f.error.writes,writes);assert.equal(f.error.dataset.feedback,undefined);assert.equal(f.modal.closeCount,1);assert.equal(f.modal.closeAttempts,1);assert.equal(f.done(),1);assert.equal(f.modal.contentEl.children.length,0);
});

test('Reference reading: Markdown rejection appends an explicitly typed child instead of replacing rendered text',async()=>{
 const op=deferred();let existing!:OwnedElement;
 const f=readingFixture(async(_app,_markdown,prose)=>{existing=prose.createEl('p',{text:'已完成的自有原文段落'});await op.promise;},undefined,true);
 const limit=required(f.modal.contentEl,'.ts-reference-reading-limit');assert.equal(limit.dataset.feedback,undefined,'Existing truncated explanatory text is unchanged');
 op.reject(Error('Owned Markdown rendering failed'));await settle();const error=required(f.prose,'.ts-reference-render-error');assert.equal(error.dataset.feedback,'error');assert.match(error.textContent,/原文预览暂不可用：Error: Owned Markdown/);assert.equal(existing.parentElement,f.prose);assert.equal(existing.textContent,'已完成的自有原文段落');assert.equal(f.prose.children.length,2);assert.equal(f.error.textContent,'');assert.equal(f.error.dataset.feedback,undefined);
 f.modal.close();assert.equal(f.done(),1);
});

for(const outcome of ['resolve','reject'] as const)test(`Reference reading: late Markdown ${outcome} after close adds no error/readonly mutation`,async()=>{
 const op=deferred();let scope!:FrameworkComponent;let checkbox!:OwnedElement;
 const f=readingFixture(async(_app,_markdown,prose,_path,component)=>{scope=component;checkbox=prose.createEl('input',{attr:{type:'checkbox'}});await op.promise;});f.modal.close();const children=f.prose.children.length,writes=f.prose.writes;
 if(outcome==='resolve')op.resolve();else op.reject(Error('Late Markdown failure'));await settle();assert.equal(f.prose.children.length,children);assert.equal(f.prose.writes,writes);assert.equal(f.prose.querySelector('.ts-reference-render-error'),null);assert.equal(checkbox.disabled,false);assert.ok(scope.unloads>=1);assert.equal(f.done(),1);
});

test('Renderer fixtures accessed no app/vault/workspace/persistence member',()=>assert.deepEqual(forbidden,[]));
