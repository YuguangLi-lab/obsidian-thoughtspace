import {bindBoardModalViewport} from '../src/board-modal-viewport';
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
 document:{activeElement?:Element}={};modalEl=new Element('DIV',this.document);containerEl=new Element('DIV',this.document);titleEl=this.modalEl.createEl('h2');contentEl=this.modalEl.createDiv();closed=0;
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
 const deps={Modal,Component,TFile,Notice:class{constructor(message:string){notices.push(message);}},setIcon:()=>{},themeSurface:()=>{},bindBoardModalViewport,bindReadingCompactLayout:()=>({dispose(){},revealPage(){return false;}}),remoteImageUrl:()=>undefined,...reading,MarkdownRenderer:{render:async(_app:unknown,text:string,el:Element,source:string)=>{sources.push(source);renders.push(text);if(options.render)await options.render(text,el);else{el.createEl('h1',{text:text.split('\n')[0].replace(/^# /,'')});el.createEl('p',{text});}}},navigator:{clipboard:{writeText:async()=>{}}}};
 const source=readFileSync('src/reading-desk-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const Desk=new Function(...Object.keys(deps),transformSync(source+'\nreturn ReadingDesk;',{loader:'ts'}).code)(...Object.values(deps));
 const modal=new Desk(app,host);modal.onOpen();
 return{modal,board,host,files,reads,renders,notices,scopes,opened,revealed,commits,sources,emit:(name:string,file:TFile)=>{for(const run of vaultEvents.get(name)||[])run(file);}};
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


test('I140-8 reading board text resolves relative links and embeds from the board location',async()=>{
 const f=fixture([{...node('alpha'),text:'[[./References/Paper]]\n![[./Assets/plot.png]]'}]);await tick();assert.deepEqual(f.sources,['Boards/Research.thoughtspace']);
 f.modal.close();const note=fixture([node('alpha','card')]);await tick();assert.deepEqual(note.sources,['notes/alpha.md']);note.modal.close();
});

test('I140-9 reading a deleted or restored note refreshes its content and original-file controls',async()=>{
 const f=fixture([node('alpha','card')]);await tick();const file=f.files.get('notes/alpha.md')!;
 f.files.delete(file.path);f.emit('delete',file);await tick();assert.match(find(f.modal,'.ts-reading-prose').textContent,/找不到原笔记/);assert.equal(find(f.modal,'[data-reading-open]').hidden,true);
 const restored=new TFile(file.path);f.files.set(restored.path,restored);f.emit('create',restored);await tick();assert.match(find(f.modal,'.ts-reading-prose').textContent,/笔记正文/);assert.equal(find(f.modal,'[data-reading-open]').hidden,false);assert.equal(f.reads.length,2);f.modal.close();
});

test('I140-8 reading text invalidates its cached relative-link context after moving the board',async()=>{
 const f=fixture([{...node('alpha'),text:'[[./References/Paper]]'}]);await tick();
 f.host.sourcePath=()=> 'Archive/Research.thoughtspace';f.modal.renderList();await tick();
 assert.deepEqual(f.sources,['Boards/Research.thoughtspace','Archive/Research.thoughtspace']);
 f.modal.close();
});

test('PDF queue uses native embeds and shares review controls without reading binary content',async()=>{
 const pdf={...node('PDF','pdf'),file:'Sources/Evidence.pdf',pdfPage:3},f=fixture([pdf]);await tick();assert.deepEqual(f.reads,[]);assert.deepEqual(f.renders,['![[Sources/Evidence.pdf#page=3]]']);assert.equal(label(f.modal,'当前阅读状态').value,'later');
 const status=label(f.modal,'当前阅读状态');status.value='done';status.onchange?.();await tick();assert.equal(f.board.nodes[0].review,'done');assert.equal(f.renders.length,1);assert.equal(label(f.modal,'当前阅读状态').value,'done');
 const kind=label(f.modal,'阅读内容类型');kind.value='pdf';kind.onchange?.();assert.equal(f.modal.items().length,1);f.board.nodes[0].pdfPage=5;f.modal.renderList();await tick();assert.equal(f.renders.at(-1),'![[Sources/Evidence.pdf#page=5]]');f.modal.close();
});

test('compact command controls remain current after moving outside the reader',async()=>{
 const f=fixture([node('alpha','card'),node('beta')]);await tick();const command=f.modal.commandBar,reader=f.modal.reader;reader.children.splice(reader.children.indexOf(command),1);const panel=f.modal.contentEl.createDiv();panel.children.push(command);command.parentElement=panel;
 f.modal.activeId='beta';f.board.nodes[1].locked=true;f.board.nodes[1].review='done';f.modal.renderList();await tick();assert.equal(label(f.modal,'当前阅读状态').disabled,true);assert.equal(label(f.modal,'当前阅读状态').value,'done');assert.equal(find(f.modal,'[data-reading-finish]').disabled,true);assert.equal(find(f.modal,'[data-reading-open]').hidden,true);
 f.modal.activeId='alpha';f.modal.renderList();await tick();assert.equal(label(f.modal,'当前阅读状态').disabled,false);assert.equal(find(f.modal,'[data-reading-open]').hidden,false);f.modal.close();
});
test('compact queue, relation and outline activation reveal the page before focus or scrolling',async()=>{
 for(const kind of ['queue','relations','outline']){const f=fixture();await tick();let hidden=true,reveals=0,jumps=0;f.modal.compactLayout={dispose(){},revealPage(){hidden=false;reveals++;return true;}};
 const focus=f.modal.page.focus.bind(f.modal.page);f.modal.page.focus=()=>{assert.equal(hidden,false);focus();};
 if(kind==='queue'){find(f.modal,'[data-node="beta"]').click();await tick();assert.equal(f.modal.activeId,'beta');assert.equal(f.modal.document.activeElement,f.modal.page);}
 else if(kind==='relations'){f.board.edges=[{id:'edge',from:'alpha',to:'beta',label:''}];f.modal.asideTab='relations';f.modal.renderCompanion();find(f.modal,'.ts-reading-relation').click();await tick();assert.equal(f.modal.activeId,'beta');}
 else{const heading=f.modal.headings[0];heading.scrollIntoView=()=>{assert.equal(hidden,false);jumps++;};heading.focus=()=>{assert.equal(hidden,false);f.modal.document.activeElement=heading;};f.modal.asideTab='outline';f.modal.renderCompanion();find(f.modal,'.ts-reading-heading-link').click();assert.equal(jumps,1);assert.equal(f.modal.document.activeElement,heading);}
 assert.equal(reveals,1);f.modal.close();}
});
test('empty results return moved command focus to the visible navigation search',async()=>{
 const f=fixture([node('alpha')]);await tick();const command=f.modal.commandBar,reader=f.modal.reader;reader.children.splice(reader.children.indexOf(command),1);const panel=f.modal.contentEl.createDiv();panel.children.push(command);command.parentElement=panel;f.modal.options.status='later';f.modal.renderList();await tick();const finish=find(f.modal,'[data-reading-finish]');finish.focus();finish.click();await tick();assert.equal(f.modal.activeId,undefined);assert.equal(f.modal.document.activeElement,label(f.modal,'搜索阅读内容'));f.modal.close();
});


test('compact focus action reveals and focuses the page while normal action keeps its original mode toggle',async()=>{
 const f=fixture();await tick();let hidden=true;f.modal.compactLayout={dispose(){},revealPage(){hidden=false;return true;}};const focus=f.modal.page.focus.bind(f.modal.page);f.modal.page.focus=()=>{assert.equal(hidden,false);focus();};label(f.modal,'专注正文').click();assert.equal(f.modal.document.activeElement,f.modal.page);assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),false);f.modal.compactLayout.revealPage=()=>false;label(f.modal,'专注正文').click();assert.equal(f.modal.modalEl.classList.contains('ts-reading-focused'),true);f.modal.close();
});

test('compact disclosure retains the complete current title and source when the duplicated page header is hidden',async()=>{
 const title='沿河散步与城市记忆：'+('混合中文与 Latin 2026、标点。'.repeat(14)),path='研究材料/城市观察/完整来源.md',n={...node('alpha','card'),title,file:path},f=fixture([n]);await tick();
 const details=find(f.modal,'.ts-reading-compact-controls'),summary=details.querySelector('summary')!,current=find(f.modal,'.ts-reading-compact-current'),identity=find(f.modal,'.ts-reading-compact-article');
 assert.equal(current.textContent,title);assert.equal(summary.getAttribute('aria-label'),'目录与阅读选项 · 当前文章：'+title);assert.equal(identity.querySelector('strong')!.textContent,title);assert.equal(find(f.modal,'.ts-reading-compact-source').textContent,path);
 assert.equal(summary.parentElement,details);assert.equal(identity.parentElement?.classes.has('ts-reading-compact-panel'),true);assert.deepEqual(f.commits,[]);assert.deepEqual(f.renders,[`# ${path}\n\n笔记正文`]);f.modal.close();
});
test('compact identity follows actual paging and emptiness without leaving a stale article label or moving search focus',async()=>{
 const f=fixture([node('alpha','card'),node('beta','card')]);await tick();const summary=find(f.modal,'.ts-reading-compact-controls').querySelector('summary')!,current=find(f.modal,'.ts-reading-compact-current'),search=label(f.modal,'搜索阅读内容');
 find(f.modal,'[data-reading-next]').click();await tick();assert.equal(current.textContent,'beta');assert.equal(find(f.modal,'.ts-reading-compact-source').textContent,'notes/beta.md');assert.equal(summary.getAttribute('aria-label'),'目录与阅读选项 · 当前文章：beta');
 search.focus();search.value='no such article';search.oninput?.();await tick();assert.equal(current.textContent,'没有匹配内容');assert.equal(find(f.modal,'.ts-reading-compact-source').textContent,'');assert.equal(f.modal.document.activeElement,search);
 search.value='';search.oninput?.();await tick();assert.equal(current.textContent,'alpha');assert.equal(find(f.modal,'.ts-reading-compact-controls').querySelector('summary'),summary);assert.equal(f.modal.document.activeElement,search);assert.deepEqual(f.commits,[]);f.modal.close();
});
test('a superseded async article cannot overwrite compact identity and cached review preserves prose and scroll',async()=>{
 const pending=deferred<string>(),f=fixture([node('alpha','card'),node('beta','card')],{read:file=>file.path.includes('alpha')?pending.promise:Promise.resolve('# 最新正文\n\n文字')});
 f.modal.activeId='beta';f.modal.renderList();await tick();const content=find(f.modal,'.ts-reading-prose');f.modal.page.scrollTop=123;f.board.nodes[1].review='reading';f.modal.renderList();await tick();pending.resolve('# 旧正文');await tick();
 assert.equal(find(f.modal,'.ts-reading-compact-current').textContent,'beta');assert.equal(find(f.modal,'.ts-reading-compact-source').textContent,'notes/beta.md');assert.equal(find(f.modal,'.ts-reading-prose'),content);assert.equal(f.modal.page.scrollTop,123);assert.deepEqual(f.renders,['# 最新正文\n\n文字']);f.modal.close();
});
test('real outline action focuses the original authored heading without rewriting its text or creating another heading',async()=>{
 const f=fixture([node('alpha')]);await tick();const heading=f.modal.headings[0],text=heading.textContent;f.modal.asideTab='outline';f.modal.renderCompanion();const action=find(f.modal,'.ts-reading-heading-link');action.click();
 assert.equal(f.modal.document.activeElement,heading);assert.equal(heading.getAttribute('tabindex'),'-1');assert.equal(heading.textContent,text);assert.equal(f.modal.headings.length,1);assert.equal(find(f.modal,'.ts-reading-prose').querySelector('h1'),heading);assert.deepEqual(f.commits,[]);f.modal.close();
});
