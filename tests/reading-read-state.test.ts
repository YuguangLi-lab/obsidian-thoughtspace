import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Card} from '../src/model';
import * as reading from '../src/reading-desk';

type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string;value?:string};
class Element{
 children:Element[]=[];parentElement?:Element;attributes:Record<string,string>={};dataset:Record<string,string>={};classes=new Set<string>();disabled=false;hidden=false;value='';scrollTop=0;emptyCalls=0;connected=true;style={setProperty:(_name:string,_value:string)=>{}};private text='';
 onclick?:()=>unknown;oninput?:()=>unknown;onchange?:()=>unknown;onkeydown?:(e:any)=>unknown;events=new Map<string,(e:any)=>unknown>();
 classList={toggle:(name:string)=>{const active=!this.classes.has(name);this.toggleClass(name,active);return active;},contains:(name:string)=>this.classes.has(name)};
 constructor(readonly tagName:string,readonly ownerDocument:{activeElement?:Element},options:Options|string={}){const opts=typeof options==='string'?{cls:options}:options;for(const c of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(c);this.text=opts.text||'';this.value=opts.value||'';for(const [k,v]of Object.entries(opts.attr||{}))this.setAttribute(k,v);if(opts.type)this.setAttribute('type',opts.type);}
 get textContent():string{return this.text+this.children.map(c=>c.textContent).join('');}
 get isConnected():boolean{return this.connected&&(!this.parentElement||this.parentElement.isConnected);}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag.toUpperCase(),this.ownerDocument,options);child.parentElement=this;this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(...names:string[]){for(const name of names)this.classes.add(name);}removeClass(...names:string[]){for(const name of names)this.classes.delete(name);}toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
 setAttribute(name:string,value:string){this.attributes[name]=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase())]=value;}
 getAttribute(name:string){if(name.startsWith('data-'))return this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase())]??null;return this.attributes[name]??null;}removeAttribute(name:string){delete this.attributes[name];}
 setText(text:string){this.empty();this.text=text;}appendText(text:string){this.text+=text;}
 empty(){this.emptyCalls++;if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=undefined;for(const child of this.children)child.connected=false;this.children=[];this.text='';}
 matches(selector:string){return selector.split(',').some(part=>{part=part.trim();const attr=part.match(/^(\w+)?\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/);if(attr)return(!attr[1]||this.tagName===attr[1].toUpperCase())&&(attr[3]===undefined?this.getAttribute(attr[2])!==null:this.getAttribute(attr[2])===attr[3]);return part.startsWith('.')?this.classes.has(part.slice(1)):this.tagName===part.toUpperCase();});}
 closest(selector:string):Element|undefined{return this.matches(selector)?this:this.parentElement?.closest(selector);}
 contains(el?:Element):boolean{return !!el&&(el===this||this.children.some(child=>child.contains(el)));}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 focus(){this.ownerDocument.activeElement=this;}scrollIntoView(){}addEventListener(name:string,fn:(e:any)=>unknown){this.events.set(name,fn);}removeEventListener(name:string){this.events.delete(name);}
 click(){if(!this.disabled)this.onclick?.();}
}
class TFile{stat={size:20,mtime:1};constructor(readonly path:string){}}
class Modal{
 document:{activeElement?:Element}={};modalEl=new Element('DIV',this.document);titleEl=this.modalEl.createEl('h2');contentEl=this.modalEl.createDiv();closed=0;
 constructor(readonly app:any){}close(){this.closed++;(this as any).onClose();}
}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const node=(id:string,kind:Card['kind']='text'):Card=>({id,kind,text:`# ${id}\n\n正文 ${id}`,title:id,x:0,y:0,width:200,height:100,color:'green',...(kind==='card'?{file:`notes/${id}.md`}:{})});
function fixture(nodes:Card[]=[node('alpha'),node('beta'),node('gamma')],options:{read?:(file:TFile)=>Promise<string>;render?:(text:string,el:Element)=>Promise<void>}={}){
 const board={...emptyBoard(),nodes},reads:string[]=[],renders:string[]=[],notices:string[]=[],scopes:{loaded:boolean}[]=[],opened:string[]=[],revealed:string[]=[],commits:string[]=[],sources:string[]=[],vaultEvents=new Map<string,((file:TFile)=>unknown)[]>();
 class Component{loaded=false;disposers:(()=>void)[]=[];constructor(){scopes.push(this);}load(){this.loaded=true;}unload(){this.loaded=false;for(const dispose of this.disposers.splice(0))dispose();}registerDomEvent(el:Element,name:string,fn:(e:any)=>unknown){el.addEventListener(name,fn);this.disposers.push(()=>el.removeEventListener(name));}registerEvent(){}register(fn:()=>void){this.disposers.push(fn);}}
 const files=new Map(nodes.filter(n=>n.file).map(n=>[n.file!,new TFile(n.file!)]));
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),cachedRead:async(file:TFile)=>{reads.push(file.path);return options.read?options.read(file):`# ${file.path}\n\n笔记正文`;},on:(name:string,run:(file:TFile)=>unknown)=>{const callbacks=vaultEvents.get(name)||[];callbacks.push(run);vaultEvents.set(name,callbacks);return{};},getResourcePath:(file:TFile)=>file.path},workspace:{openLinkText:async()=>{}},fileManager:{generateMarkdownLink:(file:TFile,_source:string,subpath='')=>`[[${file.path}${subpath}]]`}};
 const host={sourcePath:()=> 'Boards/Research.thoughtspace',board:()=>board,ids:new Set<string>(),title:'阅读测试白板',settings:{surfaceStyle:'glass',readingSize:16,readingWidth:'comfortable'},commit:(edit:(b:typeof board)=>void)=>{commits.push('edit');edit(board);},reveal:(id:string)=>revealed.push(id),open:async(file:TFile)=>{opened.push(file.path);}};
 const deps={Modal,Component,TFile,Notice:class{constructor(message:string){notices.push(message);}},setIcon:()=>{},themeSurface:()=>{},remoteImageUrl:()=>undefined,...reading,MarkdownRenderer:{render:async(_app:unknown,text:string,el:Element,source:string)=>{sources.push(source);renders.push(text);if(options.render)await options.render(text,el);else{el.createEl('h1',{text:text.split('\n')[0].replace(/^# /,'')});el.createEl('p',{text});}}},navigator:{clipboard:{writeText:async()=>{}}}};
 const source=readFileSync('src/reading-desk-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const Desk=new Function(...Object.keys(deps),transformSync(source+'\nreturn ReadingDesk;',{loader:'ts'}).code)(...Object.values(deps));
 const modal=new Desk(app,host);modal.onOpen();
 return{modal,board,host,files,reads,renders,notices,scopes,opened,revealed,commits,sources,emit:(name:string,file:TFile)=>{for(const run of vaultEvents.get(name)||[])run(file);}};
}
const find=(modal:any,selector:string):Element=>{const el=modal.modalEl.querySelector(selector);assert.ok(el,selector);return el;};
const label=(modal:any,value:string)=>find(modal,`[aria-label="${value}"]`);
function key(modal:any,key:string,options:Record<string,unknown>={}){const event={target:modal.modalEl,key,altKey:true,ctrlKey:false,metaKey:false,shiftKey:false,isComposing:false,keyCode:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...options};modal.modalEl.events.get('keydown')?.(event);return event;}


const feedback=(modal:any)=>find(modal,'.ts-reading-read-status');
const prose=(modal:any)=>find(modal,'.ts-reading-prose');
test('an actual pending card read presents one loading status and marks only the prose busy',async()=>{
 const pending=deferred<string>(),f=fixture([node('alpha','card')],{read:()=>pending.promise});await tick();
 assert.equal(f.reads.length,1);const status=feedback(f.modal),body=prose(f.modal);assert.equal(status.hidden,false);assert.match(status.textContent,/正在读取笔记/);assert.equal(status.getAttribute('role'),'status');assert.equal(status.getAttribute('aria-live'),'polite');assert.equal(status.getAttribute('aria-atomic'),'true');assert.equal(body.getAttribute('aria-busy'),'true');assert.equal(status.parentElement,body.parentElement);assert.equal(body.contains(status),false);assert.equal(f.modal.commandBar.hidden,false);assert.equal(find(f.modal,'[data-reading-finish]').disabled,false);
 pending.resolve('# 已读正文');await tick();f.modal.close();
});
test('cached read and Markdown completion each keep the current busy state until the whole article is ready',async()=>{
 const read=deferred<string>(),render=deferred<void>(),f=fixture([node('alpha','card')],{read:()=>read.promise,render:async(text,el)=>{await render.promise;el.createEl('h1',{text});}});await tick();assert.equal(f.reads.length,1);read.resolve('# 测试文章');await tick();
 const status=feedback(f.modal),body=prose(f.modal);assert.match(status.textContent,/正在呈现正文/);assert.equal(status.hidden,false);assert.equal(body.getAttribute('aria-busy'),'true');f.modal.renderList();await tick();assert.equal(f.reads.length,1);assert.equal(f.renders.length,1);
 render.resolve();await tick();assert.equal(body.getAttribute('aria-busy'),'false');assert.equal(status.hidden,true);assert.equal(status.textContent,'');assert.match(body.textContent,/测试文章/);assert.equal(f.modal.pageKey.length>0,true);f.modal.close();
});
test('current cached read failure exposes the existing error text once and remains retryable',async()=>{
 let fail=true;const f=fixture([node('alpha','card')],{read:async()=>{if(fail)throw Error('owned disk rejection');return '# 重试成功';}});await tick();const status=feedback(f.modal),body=prose(f.modal);
 assert.equal(status.hidden,false);assert.equal(status.getAttribute('role'),'alert');assert.equal(status.getAttribute('aria-live'),'assertive');assert.equal(status.textContent,'笔记暂时无法读取，请重试或打开原文。');assert.equal(body.textContent,'');assert.equal(body.getAttribute('aria-busy'),'false');assert.equal(f.notices.length,0);assert.equal(f.modal.pageKey,'');
 fail=false;await f.modal.renderPage(f.board.nodes[0]);await tick();assert.equal(f.reads.length,2);assert.match(prose(f.modal).textContent,/重试成功/);assert.equal(feedback(f.modal).hidden,true);assert.equal(feedback(f.modal).textContent,'');assert.equal(prose(f.modal).getAttribute('aria-busy'),'false');f.modal.close();
});
for(const outcome of ['resolve','reject'] as const)test(`superseded ${outcome} never clears the newer article feedback or busy state`,async()=>{
 const a=deferred<string>(),b=deferred<string>(),f=fixture([node('alpha','card'),node('beta','card')],{read:file=>file.path.includes('alpha')?a.promise:b.promise});await tick();f.modal.activeId='beta';f.modal.renderList();await tick();const status=feedback(f.modal),body=prose(f.modal);assert.equal(f.reads.length,2);assert.equal(body.getAttribute('aria-busy'),'true');
 if(outcome==='resolve')a.resolve('# 过期文章');else a.reject(Error('过期失败'));await tick();assert.equal(feedback(f.modal),status);assert.equal(prose(f.modal),body);assert.equal(status.hidden,false);assert.match(status.textContent,/正在读取笔记/);assert.equal(body.getAttribute('aria-busy'),'true');assert.deepEqual(f.renders,[]);assert.equal(f.notices.length,0);
 b.resolve('# 当前正文');await tick();assert.match(body.textContent,/当前正文/);assert.equal(body.getAttribute('aria-busy'),'false');assert.equal(status.hidden,true);f.modal.close();
});
for(const outcome of ['resolve','reject'] as const)test(`closing during a pending ${outcome} causes no later feedback or aria writes`,async()=>{
 const pending=deferred<string>(),f=fixture([node('alpha','card')],{read:()=>pending.promise});await tick();const status=feedback(f.modal),body=prose(f.modal),writes:string[]=[];const setText=status.setText.bind(status),setAttribute=body.setAttribute.bind(body);status.setText=(value:string)=>{writes.push('status');setText(value);};body.setAttribute=(name:string,value:string)=>{writes.push(name);setAttribute(name,value);};
 f.modal.close();if(outcome==='resolve')pending.resolve('# 不应呈现');else pending.reject(Error('关闭后失败'));await tick();assert.deepEqual(writes,[]);assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.renders.length,0);assert.equal(f.notices.length,0);assert.equal(f.scopes.filter(s=>s.loaded).length,0);
});
test('Markdown failure adds local readable feedback while preserving the original Notice and retry guard',async()=>{
 let fail=true;const f=fixture([node('alpha','card')],{render:async(text,el)=>{if(fail)throw Error('owned Markdown rejection');el.createEl('p',{text});}});await tick();
 const status=feedback(f.modal);assert.equal(status.hidden,false);assert.equal(status.getAttribute('role'),'alert');assert.equal(status.textContent,'正文暂时无法呈现，请重试或打开原文。');assert.equal(prose(f.modal).getAttribute('aria-busy'),'false');assert.equal(f.notices.length,1);assert.match(f.notices[0],/owned Markdown rejection/);assert.equal(f.modal.pageKey,'');
 fail=false;await f.modal.renderPage(f.board.nodes[0]);await tick();assert.equal(f.renders.length,2);assert.equal(feedback(f.modal).hidden,true);assert.equal(prose(f.modal).getAttribute('aria-busy'),'false');f.modal.close();
});
test('filtering to an empty result discards the old pending read without rebuilding feedback',async()=>{
 const pending=deferred<string>(),f=fixture([node('alpha','card')],{read:()=>pending.promise});await tick();const status=feedback(f.modal),body=prose(f.modal),writes:string[]=[];status.setText=()=>writes.push('status');body.setAttribute=()=>writes.push('aria');
 const search=label(f.modal,'搜索阅读内容');search.value='no-match';search.oninput?.();await tick();assert.ok(find(f.modal,'.ts-reading-blank'));pending.resolve('# 过期文章');await tick();assert.deepEqual(writes,[]);assert.equal(f.modal.page.querySelector('.ts-reading-read-status'),undefined);assert.equal(f.renders.length,0);assert.equal(f.modal.commandBar.hidden,true);f.modal.close();
});
