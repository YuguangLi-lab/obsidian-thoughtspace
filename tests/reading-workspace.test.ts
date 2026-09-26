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
 const board={...emptyBoard(),nodes},reads:string[]=[],renders:string[]=[],notices:string[]=[],scopes:{loaded:boolean}[]=[],opened:string[]=[],revealed:string[]=[],commits:string[]=[];
 class Component{loaded=false;disposers:(()=>void)[]=[];constructor(){scopes.push(this);}load(){this.loaded=true;}unload(){this.loaded=false;for(const dispose of this.disposers.splice(0))dispose();}registerDomEvent(el:Element,name:string,fn:(e:any)=>unknown){el.addEventListener(name,fn);this.disposers.push(()=>el.removeEventListener(name));}registerEvent(){}register(fn:()=>void){this.disposers.push(fn);}}
 const files=new Map(nodes.filter(n=>n.file).map(n=>[n.file!,new TFile(n.file!)]));
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),cachedRead:async(file:TFile)=>{reads.push(file.path);return options.read?options.read(file):`# ${file.path}\n\n笔记正文`;},on:()=>({}),getResourcePath:(file:TFile)=>file.path},workspace:{openLinkText:async()=>{}}};
 const host={board:()=>board,ids:new Set<string>(),title:'阅读测试白板',settings:{surfaceStyle:'glass',readingSize:16,readingWidth:'comfortable'},commit:(edit:(b:typeof board)=>void)=>{commits.push('edit');edit(board);},reveal:(id:string)=>revealed.push(id),open:async(file:TFile)=>{opened.push(file.path);}};
 const deps={Modal,Component,TFile,Notice:class{constructor(message:string){notices.push(message);}},setIcon:()=>{},themeSurface:()=>{},remoteImageUrl:()=>undefined,...reading,MarkdownRenderer:{render:async(_app:unknown,text:string,el:Element)=>{renders.push(text);if(options.render)await options.render(text,el);else{el.createEl('h1',{text:text.split('\n')[0].replace(/^# /,'')});el.createEl('p',{text});}}},navigator:{clipboard:{writeText:async()=>{}}}};
 const source=readFileSync('src/reading-desk-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const Desk=new Function(...Object.keys(deps),transformSync(source+'\nreturn ReadingDesk;',{loader:'ts'}).code)(...Object.values(deps));
 const modal=new Desk(app,host);modal.onOpen();
 return{modal,board,host,files,reads,renders,notices,scopes,opened,revealed,commits};
}
const find=(modal:any,selector:string):Element=>{const el=modal.modalEl.querySelector(selector);assert.ok(el,selector);return el;};
const label=(modal:any,value:string)=>find(modal,`[aria-label="${value}"]`);
function key(modal:any,key:string,options:Record<string,unknown>={}){const event={target:modal.modalEl,key,altKey:true,ctrlKey:false,metaKey:false,shiftKey:false,isComposing:false,keyCode:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...options};modal.modalEl.events.get('keydown')?.(event);return event;}

test('cached reader updates current review and lock controls without rereading or resetting scroll',async()=>{
 const f=fixture([node('alpha','card'),node('beta','card')]);await tick();f.modal.page.scrollTop=420;const body=find(f.modal,'.ts-reading-prose');
 f.board.nodes[0]={...f.board.nodes[0],review:'reading',locked:true};f.modal.renderList();await tick();
 assert.equal(f.reads.length,1);assert.equal(f.modal.page.scrollTop,420);assert.equal(find(f.modal,'.ts-reading-prose'),body);
 const status=label(f.modal,'当前阅读状态');assert.equal(status.value,'reading');assert.equal(status.disabled,true);assert.equal(find(f.modal,'[data-reading-finish]').disabled,true);
 f.board.nodes[0]={...f.board.nodes[0],locked:false};f.modal.renderList();await tick();assert.equal(find(f.modal,'[data-reading-finish]').disabled,false);f.modal.close();
});
test('superseded note reads cannot replace a later article or its outline',async()=>{
 const pending=deferred<string>(),f=fixture([node('alpha','card'),node('beta','card')],{read:file=>file.path.includes('alpha')?pending.promise:Promise.resolve('# 最新标题\n\n最新正文')});
 f.modal.activeId='beta';f.modal.renderList();await tick();const content=find(f.modal,'.ts-reading-prose'),heading=f.modal.headings[0];pending.resolve('# 过期标题\n\n过期正文');await tick();
 assert.equal(f.modal.activeId,'beta');assert.equal(find(f.modal,'.ts-reading-prose'),content);assert.equal(f.modal.headings[0],heading);assert.equal(heading.textContent,'最新标题');assert.deepEqual(f.renders,['# 最新标题\n\n最新正文']);assert.equal(f.scopes.filter(s=>s.loaded).length,2);f.modal.close();assert.equal(f.scopes.filter(s=>s.loaded).length,0);
});
test('filtering to empty cancels pending Markdown, clears controls, and can recover the article',async()=>{
 const pending=deferred<string>();let first=true;const f=fixture([node('alpha','card')],{read:()=>{if(first){first=false;return pending.promise;}return Promise.resolve('# 恢复正文');}});
 const search=label(f.modal,'搜索阅读内容');search.value='missing';search.oninput?.();assert.equal(f.modal.activeId,undefined);pending.resolve('# 过期正文');await tick();assert.equal(f.modal.headings.length,0);assert.equal(f.renders.length,0);
 search.value='';search.oninput?.();await tick();assert.equal(f.modal.activeId,'alpha');assert.deepEqual(f.renders,['# 恢复正文']);assert.match(find(f.modal,'.ts-reading-prose').textContent,/恢复正文/);f.modal.close();
});
test('closing before IO completes releases scopes and suppresses late rendering',async()=>{
 for(const failed of [false,true]){const pending=deferred<string>(),f=fixture([node('alpha','card')],{read:()=>pending.promise});f.modal.close();if(failed)pending.reject(new Error('late IO'));else pending.resolve('# 不应渲染');await tick();assert.equal(f.renders.length,0);assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.scopes.filter(s=>s.loaded).length,0);assert.equal(f.notices.length,0);}
});
test('closing during Markdown rendering releases its component after completion',async()=>{
 const pending=deferred<void>(),f=fixture([node('alpha')],{render:async(_text,el)=>{await pending.promise;el.createEl('h1',{text:'过期标题'});}});await tick();f.modal.close();pending.resolve();await tick();assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.modal.headings.length,0);assert.equal(f.scopes.filter(s=>s.loaded).length,0);
});
test('relation navigation clears every restrictive filter and aligns visible select values',async()=>{
 const f=fixture();f.board.edges=[{id:'edge',from:'alpha',to:'beta',label:'依据'}];f.modal.options={query:'alpha',status:'later',sort:'title',onlySelected:true,kind:'text',connection:'connected'};f.host.ids.add('alpha');f.modal.renderList();await tick();
 f.modal.asideTab='relations';f.modal.renderCompanion();find(f.modal,'.ts-reading-relation').click();await tick();assert.equal(f.modal.activeId,'beta');assert.deepEqual(f.modal.options,{query:'',status:'all',sort:'title',onlySelected:false,kind:'all',connection:'all'});
 for(const text of ['阅读状态筛选','阅读范围','阅读内容类型','阅读关联筛选'])assert.equal(label(f.modal,text).value,'all');assert.equal(label(f.modal,'搜索阅读内容').value,'');f.modal.close();
});
test('reviewing the current article keeps queue position and updates navigation at filtered boundaries',async()=>{
 const f=fixture();f.modal.options.status='later';f.modal.renderList();await tick();find(f.modal,'[data-reading-finish]').click();await tick();assert.equal(f.board.nodes[0].review,'done');assert.equal(f.modal.activeId,'beta');assert.equal(find(f.modal,'[data-reading-position]').textContent,'1 / 2');assert.equal(find(f.modal,'[data-reading-previous]').disabled,true);assert.equal(find(f.modal,'[data-reading-next]').disabled,false);f.modal.close();
});
test('detached actions cannot mutate, reveal or reopen material after closing',async()=>{
 const f=fixture([node('alpha','card')]);await tick();const finish=find(f.modal,'[data-reading-finish]'),locate=label(f.modal,'定位白板'),open=label(f.modal,'右侧打开原文');f.modal.close();finish.click();locate.click();open.click();await tick();assert.deepEqual(f.commits,[]);assert.deepEqual(f.revealed,[]);assert.deepEqual(f.opened,[]);assert.equal(f.modal.closed,1);
});
test('Alt arrow navigation preserves composition and native field editing',async()=>{
 const f=fixture();await tick();for(const options of [{isComposing:true},{keyCode:229},{target:label(f.modal,'搜索阅读内容')},{target:label(f.modal,'阅读状态筛选')}]){assert.equal(key(f.modal,'ArrowRight',options).defaultPrevented,false);assert.equal(f.modal.activeId,'alpha');}
 assert.equal(key(f.modal,'ArrowRight').defaultPrevented,true);await tick();assert.equal(f.modal.activeId,'beta');assert.equal(key(f.modal,'ArrowLeft').defaultPrevented,true);await tick();assert.equal(f.modal.activeId,'alpha');f.modal.close();
});

test('selecting a queue row preserves keyboard focus on its replacement without stealing search focus',async()=>{
 const f=fixture();await tick();const beta=find(f.modal,'[data-node="beta"]');beta.focus();beta.click();await tick();const selected=find(f.modal,'[data-node="beta"]');assert.notEqual(selected,beta);assert.equal(f.modal.document.activeElement,selected);assert.equal(f.modal.activeId,'beta');
 const search=label(f.modal,'搜索阅读内容');search.focus();search.value='beta';search.oninput?.();await tick();assert.equal(f.modal.document.activeElement,search);assert.equal(f.modal.activeId,'beta');f.modal.close();
});
test('queue keyboard navigation retains focus when crossing a 100 item rendering window',async()=>{
 const f=fixture(Array.from({length:105},(_,i)=>({...node('n'+i),y:i})));f.modal.activeId='n99';f.modal.renderList();await tick();find(f.modal,'[data-node="n99"]').focus();
 key(f.modal,'ArrowRight',{target:f.modal.document.activeElement});await tick();assert.equal(f.modal.activeId,'n100');assert.equal(f.modal.document.activeElement,find(f.modal,'[data-node="n100"]'));assert.equal(f.modal.list.querySelectorAll('.ts-reading-item').length,5);
 key(f.modal,'ArrowLeft',{target:f.modal.document.activeElement});await tick();assert.equal(f.modal.activeId,'n99');assert.equal(f.modal.document.activeElement,find(f.modal,'[data-node="n99"]'));assert.equal(f.modal.list.querySelectorAll('.ts-reading-item').length,100);f.modal.close();
});
test('reader paging and finish controls retain keyboard focus across article changes',async()=>{
 for(const selector of ['[data-reading-next]','[data-reading-finish]']){const f=fixture();await tick();const action=find(f.modal,selector);action.focus();action.click();await tick();assert.equal(f.modal.activeId,'beta');assert.equal(f.modal.document.activeElement,find(f.modal,selector));assert.ok(f.modal.document.activeElement.isConnected);f.modal.close();}
});
test('persistent review actions always resolve the active note and skip locked nodes',async()=>{
 const f=fixture();await tick();const status=label(f.modal,'当前阅读状态'),finish=find(f.modal,'[data-reading-finish]');f.modal.activeId='beta';f.modal.renderList();await tick();
 status.value='reading';status.onchange?.();await tick();assert.equal(f.board.nodes[0].review,undefined);assert.equal(f.board.nodes[1].review,'reading');
 finish.click();await tick();assert.equal(f.board.nodes[1].review,'done');assert.equal(f.modal.activeId,'gamma');f.board.nodes[2].locked=true;f.modal.renderList();await tick();const before=f.commits.length;status.value='done';status.onchange?.();finish.click();await tick();assert.equal(f.commits.length,before);assert.equal(f.board.nodes[2].review,undefined);f.modal.close();
});
test('persistent locate and original-note controls use the new active file after navigation',async()=>{
 for(const action of ['定位白板','右侧打开原文']){const f=fixture([node('alpha','card'),node('beta','card')]);await tick();const button=label(f.modal,action);f.modal.activeId='beta';f.modal.renderList();await tick();button.click();await tick();if(action==='定位白板')assert.deepEqual(f.revealed,['beta']);else assert.deepEqual(f.opened,['notes/beta.md']);assert.equal(f.modal.closed,1);}
});
test('finishing the last filtered article returns focus to search instead of a hidden command',async()=>{
 const f=fixture([node('alpha')]);f.modal.options.status='later';f.modal.renderList();await tick();const finish=find(f.modal,'[data-reading-finish]');finish.focus();finish.click();await tick();assert.equal(f.modal.activeId,undefined);assert.equal(f.modal.commandBar.hidden,true);assert.equal(f.modal.pageNav.hidden,true);assert.equal(f.modal.document.activeElement,label(f.modal,'搜索阅读内容'));f.modal.close();
});
test('following a relation moves focus into the current article instead of a detached relation',async()=>{
 const f=fixture();f.board.edges=[{id:'edge',from:'alpha',to:'beta',label:''}];await tick();f.modal.asideTab='relations';f.modal.renderCompanion();const relation=find(f.modal,'.ts-reading-relation');relation.focus();relation.click();await tick();assert.equal(f.modal.activeId,'beta');assert.equal(f.modal.document.activeElement,f.modal.page);f.modal.close();
});
