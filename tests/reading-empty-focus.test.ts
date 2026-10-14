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


test('last filtered review leaves focus mode before returning reader focus to the now-visible search',async()=>{
 const f=fixture([node('alpha')]);await tick();
 f.host.ids.add('alpha');f.modal.options={query:'alpha',status:'later',sort:'title',onlySelected:true,kind:'text',connection:'isolated'};
 const before=JSON.stringify(f.modal.options),search=label(f.modal,'搜索阅读内容');search.value='alpha';f.modal.renderList();await tick();
 const focus=label(f.modal,'专注正文');focus.click();assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),true);assert.equal(focus.getAttribute('aria-pressed'),'true');
 const focusSearch=search.focus.bind(search);let focusCalls=0;search.focus=()=>{focusCalls++;assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),false,'search must be shown before receiving focus');focusSearch();};
 const finish=find(f.modal,'[data-reading-finish]');finish.focus();finish.click();await tick();
 assert.equal(f.board.nodes[0].review,'done');assert.equal(f.commits.length,1);assert.equal(JSON.stringify(f.modal.options),before);assert.equal(search.value,'alpha');assert.deepEqual([...f.host.ids],['alpha']);
 assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),false);assert.equal(focus.getAttribute('aria-pressed'),'false');assert.equal(f.modal.document.activeElement,search);assert.equal(focusCalls,1);
 assert.equal(f.modal.commandBar.hidden,true);assert.equal(f.modal.pageNav.hidden,true);assert.match(find(f.modal,'.ts-reading-blank').textContent,/没有匹配/);f.modal.close();
});
test('an empty rerender does not steal focus already moved to a visible footer control',async()=>{
 const f=fixture([node('alpha')]);await tick();const focus=label(f.modal,'专注正文');focus.click();const font=label(f.modal,'本次阅读字号');font.focus();
 f.modal.options.query='no-match';const before=JSON.stringify(f.modal.options);f.modal.renderList();await tick();
 assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),false);assert.equal(focus.getAttribute('aria-pressed'),'false');assert.equal(f.modal.document.activeElement,font);assert.equal(JSON.stringify(f.modal.options),before);assert.equal(f.commits.length,0);f.modal.close();
});
test('an empty rerender preserves focus outside this reading modal',async()=>{
 const f=fixture([node('alpha')]);await tick();const focus=label(f.modal,'专注正文');focus.click();const elsewhere=new Element('INPUT',f.modal.document);elsewhere.focus();
 f.modal.options.query='no-match';f.modal.renderList();await tick();
 assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),false);assert.equal(focus.getAttribute('aria-pressed'),'false');assert.equal(f.modal.document.activeElement,elsewhere);assert.equal(f.commits.length,0);f.modal.close();
});
test('nonempty filtered review retains focus mode and the active reader control',async()=>{
 const f=fixture([node('alpha'),node('beta')]);await tick();f.modal.options.status='later';f.modal.renderList();await tick();const focus=label(f.modal,'专注正文');focus.click();const finish=find(f.modal,'[data-reading-finish]');finish.focus();finish.click();await tick();
 assert.equal(f.modal.activeId,'beta');assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),true);assert.equal(focus.getAttribute('aria-pressed'),'true');assert.equal(f.modal.document.activeElement,finish);assert.equal(f.modal.commandBar.hidden,false);assert.equal(f.modal.options.status,'later');assert.equal(f.commits.length,1);f.modal.close();
});
test('repeated empty renders preserve footer focus after the initial reader recovery',async()=>{
 const f=fixture([node('alpha')]);await tick();const focus=label(f.modal,'专注正文');focus.click();find(f.modal,'[data-reading-finish]').focus();f.modal.options.query='no-match';f.modal.renderList();await tick();
 const search=label(f.modal,'搜索阅读内容');assert.equal(f.modal.document.activeElement,search);const font=label(f.modal,'本次阅读字号');font.focus();for(let i=0;i<3;i++)f.modal.renderList();await tick();
 assert.equal(f.modal.document.activeElement,font);assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),false);assert.equal(focus.getAttribute('aria-pressed'),'false');assert.equal(f.commits.length,0);f.modal.close();
});
