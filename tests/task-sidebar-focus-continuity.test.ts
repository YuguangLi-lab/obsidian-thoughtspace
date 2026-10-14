import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,extractTasks,toggleTask} from '../src/model';
import {taskSummary,visibleTasks} from '../src/navigation';
import {isWorkspaceFile} from '../src/workspace';
import {replaceSidebarContents} from '../src/sidebar-content';

// The original methods and button callback execute. Only host I/O, timers and
// DOM are substitutes; task extraction, filtering and publication stay real.
const source=readFileSync(process.env.TASK_SIDEBAR_FOCUS_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const methods=take('  private clearSidebarFilters()', '  private async exportCanvas(');
const selectTab=take('  selectTab(', '  refreshNavigation()');
const buttonSource=take('function button(', '\nclass Prompt ');
type Options={text?:string;cls?:string;attr?:Record<string,string>;value?:string;type?:string};
class File{extension='md';stat={mtime:1};constructor(public path:string,public basename=path.split('/').at(-1)!.replace(/\.md$/,'')){};}
class Element{
 children:Element[]=[];parent?:Element;tag='div';text='';value='';hidden=false;checked=false;disabled=false;scrollTop=0;dataset:Record<string,string>={};attributes=new Map<string,string>();classes=new Set<string>();
 onclick?:(event?:{detail:number})=>unknown;onchange?:()=>unknown;focusCalls=0;
 constructor(readonly ownerDocument:DocumentMock,options:Options={}){this.text=options.text||'';this.value=options.value||'';this.classes=new Set((options.cls||'').split(/\s+/).filter(Boolean));for(const [name,value]of Object.entries(options.attr||{}))this.setAttribute(name,value);}
 createEl(tag:string,options:Options={}){const child=new Element(this.ownerDocument,options);child.tag=tag;child.parent=this;this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createSpan(options:Options|string={}){return this.createEl('span',typeof options==='string'?{cls:options}:options);}
 setText(text:string){this.text=text;this.children=[];}empty(){this.text='';this.children=[];}
 setAttribute(name:string,value:string){this.attributes.set(name,String(value));}getAttribute(name:string){return this.attributes.get(name)??null;}removeAttribute(name:string){this.attributes.delete(name);}
 toggleClass(name:string,value:boolean){if(value)this.classes.add(name);else this.classes.delete(name);}
 addEventListener(){}focus(){this.ownerDocument.activeElement=this;this.focusCalls++;}
 get childNodes(){return this.children;}get childElementCount(){return this.children.length;}get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 contains(element:Element|null){return !!element&&this.all().includes(element);}
 matches(selector:string):boolean{
  if(selector===':focus-visible')return this.ownerDocument.keyboard&&this.ownerDocument.activeElement===this;
  if(selector.includes(','))return selector.split(',').some(s=>this.matches(s.trim()));
  if(selector.includes(' > ')){const [parent,child]=selector.split(' > ');return this.matches(child)&&!!this.parent?.matches(parent);}
  const attributes=[...selector.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g)];
  if(attributes.some(([,name,value])=>value===undefined?!this.attributes.has(name):this.getAttribute(name)!==value))return false;
  const plain=selector.replace(/\[[^\]]+\]/g,''),tag=plain.match(/^[a-z]+/i)?.[0];if(tag&&this.tag!==tag)return false;
  return [...plain.matchAll(/\.([\w-]+)/g)].every(([,name])=>this.classes.has(name));
 }
 querySelector<T extends Element=Element>(selector:string){return this.all().slice(1).find(el=>el.matches(selector)) as T|undefined;}
 querySelectorAll(selector:string){return this.all().slice(1).filter(el=>el.matches(selector));}
 closest(selector:string):Element|null{return selector.startsWith('.')&&(this.classes.has(selector.slice(1)))?this:this.parent?.closest(selector)||null;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this);this.parent=undefined;}
 replaceChildren(...children:Element[]){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;for(const child of this.children)child.parent=undefined;this.children=children;for(const child of children)child.parent=this;}
}
class DocumentMock{keyboard=false;body=new Element(this);activeElement:Element|null=this.body;defaultView={HTMLElement:Element};createDocumentFragment(){return new Element(this);}}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(content='- [ ] 整理参考文献\n- [x] 完成资料备份'){
 const doc=new DocumentMock(),sidebar=new Element(doc),search=sidebar.createEl('input',{cls:'ts-search'}),clear=sidebar.createEl('button',{cls:'ts-search-clear'}),list=sidebar.createDiv('ts-library');
 const files=[new File('Notes/项目.md')],bodies=new Map(files.map(file=>[file,content])),timers=new Map<number,()=>void>(),jobs:Promise<unknown>[]=[];let next=0,reads=0,processes=0;
 const window={setTimeout(fn:()=>void){const id=++next;timers.set(id,fn);return id;},clearTimeout(id:number){timers.delete(id);}};
 const act=(callback:()=>unknown)=>{const result=callback();if(result&&typeof (result as Promise<unknown>).then==='function')jobs.push(Promise.resolve(result));return result;};
 const deps={window,act,setIcon(){},TFile:File,extractTasks,toggleTask,taskSummary,visibleTasks,isWorkspaceFile,replaceSidebarContents};
 const View=new Function(...Object.keys(deps),transformSync(`${buttonSource}\nreturn class View{${methods}\n${selectTab}}`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View(),board={...emptyBoard(),nodes:[{id:'note',kind:'card',file:files[0].path,color:'sand',x:0,y:0,width:300,height:180}]};
 Object.assign(view,{sidebar,list,sidebarQueries:new Map(),plugin:{ensureDock(){}},file:{path:'Fixture.thoughtspace'},session:{board},closed:false,tab:'tasks',query:'',tag:'#保留',boardScope:'spaces',boardSort:'title',libraryScope:'cards',librarySort:'updated',taskScope:'board',taskFilter:'all',outlineKind:'all',sidebarRun:0,
  app:{vault:{getAbstractFileByPath:(path:string)=>files.find(f=>f.path===path),getMarkdownFiles:()=>files,cachedRead:async(file:File)=>{reads++;return bodies.get(file)||'';},process:async(file:File,fn:(raw:string)=>string)=>{processes++;bodies.set(file,fn(bodies.get(file)||''));}},workspace:{getLeaf:()=>({openFile(){}})}}});
 const setQuery=(query:string)=>{view.query=query;search.value=query;clear.hidden=!query;};
 async function advance(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}await Promise.all(jobs.splice(0));}
 return{view,doc,sidebar,list,search,clear,files,bodies,timers,setQuery,advance,refresh:()=>view.populateSidebar(),get reads(){return reads;},get processes(){return processes;}};
}

const control=(f:ReturnType<typeof fixture>,label:string)=>{const b=f.list.all().find(el=>el.getAttribute('aria-label')===label);assert.ok(b?.onclick,`actual button ${label}`);return b;};
const rows=(f:ReturnType<typeof fixture>)=>f.list.all().filter(el=>el.classes.has('ts-task'));
const keyboardActivate=(f:ReturnType<typeof fixture>,label:string)=>{const b=control(f,label);f.doc.keyboard=true;b.focus();b.onclick!({detail:0});return b;};

test('a keyboard-focused completion filter regains focus on its replacement after the actual asynchronous task refresh',async()=>{
 const f=fixture();await f.refresh();const original=keyboardActivate(f,'已完成');await f.advance();
 const replacement=control(f,'已完成');console.log(JSON.stringify({probe:'keyboard-filter-focus',activeLabel:f.doc.activeElement?.getAttribute('aria-label'),bodyFocus:f.doc.activeElement===f.doc.body,originalReplaced:replacement!==original,rows:rows(f).length}));
 assert.notEqual(replacement,original);assert.equal(f.doc.activeElement===replacement,true,'focus follows the replacement selected filter');assert.equal(replacement.matches(':focus-visible'),true);assert.equal(replacement.getAttribute('aria-pressed'),'true');assert.equal(rows(f).length,1);assert.equal(f.processes,0);
});


test('Show all returns keyboard focus to All while preserving a matching query and mixed two-note scope',async()=>{
 const f=fixture('- [x] 完成资料备份'),second=new File('Notes/研究问题.md');f.files.push(second);f.bodies.set(second,'- [ ] 整理研究问题');f.view.taskScope='vault';f.view.taskFilter='todo';f.setQuery('资料');await f.refresh();
 const before={query:f.view.query,scope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden};keyboardActivate(f,'查看全部任务');await f.advance();
 const selected=control(f,'全部');console.log(JSON.stringify({probe:'keyboard-show-all-focus',activeLabel:f.doc.activeElement?.getAttribute('aria-label'),bodyFocus:f.doc.activeElement===f.doc.body,query:f.view.query,rows:rows(f).length}));
 assert.equal(f.doc.activeElement===selected,true,'Show all focuses its replacement All filter');assert.equal(selected.matches(':focus-visible'),true);assert.equal(f.view.taskFilter,'all');assert.equal(selected.getAttribute('aria-pressed'),'true');assert.deepEqual({query:f.view.query,scope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden},before);assert.equal(rows(f).length,1);assert.match(rows(f)[0].textContent,/资料/);assert.equal(f.processes,0);
});

test('successive focused state activations preserve selected semantics, rows and scope',async()=>{
 const f=fixture();f.view.taskScope='vault';await f.refresh();
 for(const [label,count]of [['已完成',1],['未完成',1],['全部',2]] as const){keyboardActivate(f,label);await f.advance();const b=control(f,label);assert.equal(f.doc.activeElement===b,true);assert.equal(b.matches(':focus-visible'),true);assert.equal(b.getAttribute('aria-pressed'),'true');assert.equal(rows(f).length,count);assert.equal(f.view.taskScope,'vault');assert.equal(f.view.query,'');assert.equal(f.processes,0);}
});
test('an unfocused or pointer-focused callback does not acquire keyboard focus for its replacement',async()=>{
 for(const pointer of [false,true]){const f=fixture();await f.refresh();const b=control(f,'已完成');if(pointer){f.doc.keyboard=false;b.focus();}else{f.doc.keyboard=true;f.search.focus();}b.onclick!();await f.advance();const replacement=control(f,'已完成');assert.equal(replacement.focusCalls,0);assert.equal(f.doc.activeElement===replacement,false);assert.equal(pointer?f.doc.activeElement===f.doc.body:f.doc.activeElement===f.search,true);assert.equal(rows(f).length,1);assert.equal(f.processes,0);}
});
test('moving focus to search or another owned control during a deferred read is respected at publication',async()=>{
 for(const destination of ['search','outside']){const f=fixture(),gate=deferred<string>();await f.refresh();f.view.app.vault.cachedRead=()=>gate.promise;keyboardActivate(f,'已完成');const pending=f.advance();const moved=destination==='search'?f.search:f.doc.body.createEl('button',{attr:{'aria-label':'另一控件'}});moved.focus();gate.resolve('- [ ] 核对资料\n- [x] 完成备份');await pending;assert.equal(f.doc.activeElement===moved,true);assert.equal(control(f,'已完成').focusCalls,0);assert.equal(rows(f).length,1);assert.equal(f.processes,0);}
});
test('closed views, replaced owners or targets, expired runs and actual tab changes cannot revive a task focus intent',async()=>{
 for(const change of ['closed','owner','target','run','tab']){const f=fixture(),gate=deferred<string>();await f.refresh();f.view.app.vault.cachedRead=()=>gate.promise;const trigger=keyboardActivate(f,'已完成');const pending=f.advance();
  if(change==='closed')f.view.closed=true;else if(change==='owner')f.view.session={board:emptyBoard()};else if(change==='target'){f.view.list=new Element(f.doc);f.view.list.createSpan({text:'另一目标'});}else if(change==='run')f.view.sidebarRun++;else f.view.selectTab('library');
  gate.resolve('- [x] 完成备份');await pending;f.timers.clear();assert.equal(trigger.focusCalls,1,change);assert.equal(f.list.all().filter(e=>e!==trigger&&e.tag==='button').every(e=>e.focusCalls===0),true,change);assert.equal(f.processes,0);if(change==='target')assert.equal(f.view.list.textContent,'另一目标');if(change==='tab')assert.equal(f.view.tab,'library');
 }
});
test('a later filter completion retains its own focus when an older filter read resolves last',async()=>{
 const f=fixture(),gate=deferred<string>();await f.refresh();let reads=0;f.view.app.vault.cachedRead=()=>++reads===1?gate.promise:Promise.resolve('- [ ] 整理参考文献\n- [x] 完成资料备份');keyboardActivate(f,'已完成');const older=f.advance();keyboardActivate(f,'未完成');await f.advance();const selected=control(f,'未完成');assert.equal(f.doc.activeElement===selected,true);assert.match(rows(f)[0].textContent,/整理参考文献/);
 gate.resolve('- [x] 迟到完成项');await older;assert.equal(f.doc.activeElement===selected,true);assert.equal(control(f,'未完成')===selected,true);assert.equal(f.view.taskFilter,'todo');assert.equal(f.processes,0);
});
test('a newer real search refresh supersedes an in-flight filter focus request without losing search focus',async()=>{
 const f=fixture(),gate=deferred<string>();await f.refresh();let reads=0;f.view.app.vault.cachedRead=()=>++reads===1?gate.promise:Promise.resolve('- [ ] 整理参考文献\n- [x] 完成资料备份');keyboardActivate(f,'已完成');const older=f.advance();f.setQuery('资料备份');f.search.focus();f.view.renderSidebar();await f.advance();const published=f.list.children;
 gate.resolve('- [x] 旧完成项');await older;assert.equal(f.doc.activeElement===f.search,true);assert.equal(f.list.children===published,true);assert.equal(f.view.query,'资料备份');assert.equal(control(f,'已完成').focusCalls,0);assert.match(rows(f)[0].textContent,/完成资料备份/);assert.equal(f.processes,0);
});
test('a failed read preserves its focused original control and previous results without focusing a replacement',async()=>{
 const f=fixture(),gate=deferred<string>();await f.refresh();f.view.app.vault.cachedRead=()=>gate.promise;const original=keyboardActivate(f,'已完成'),pending=f.advance(),failed=assert.rejects(pending,/owned read failure/);gate.reject(Error('owned read failure'));await failed;
 assert.equal(f.doc.activeElement===original,true);assert.equal(original.focusCalls,1);assert.equal(rows(f).length,2);assert.match(f.list.textContent,/列表更新失败，已保留原内容/);assert.equal(f.processes,0);
});
test('a focus change made during DOM replacement is not overwritten by task focus restoration',async()=>{
 const f=fixture();await f.refresh();const replace=f.list.replaceChildren.bind(f.list);f.list.replaceChildren=(...children:Element[])=>{replace(...children);f.search.focus();};keyboardActivate(f,'已完成');await f.advance();assert.equal(f.doc.activeElement===f.search,true);assert.equal(control(f,'已完成').focusCalls,0);assert.equal(rows(f).length,1);assert.equal(f.processes,0);
});
test('an obsolete task button callback cannot change the replacement page or take its focus',async()=>{
 const f=fixture();await f.refresh();const obsolete=control(f,'全部');keyboardActivate(f,'已完成');await f.advance();const current=control(f,'已完成');obsolete.onclick!();await f.advance();assert.equal(f.view.taskFilter,'done');assert.equal(f.doc.activeElement===current,true);assert.equal(control(f,'已完成')===current,true);assert.equal(f.processes,0);
});


test('a genuine pointer click changing filter while retaining a keyboard ring does not restore its replacement',async()=>{
 const f=fixture();await f.refresh();keyboardActivate(f,'全部');await f.advance();const pointerTarget=control(f,'已完成');f.doc.keyboard=true;pointerTarget.focus();
 assert.equal(f.doc.activeElement===pointerTarget,true);assert.equal(pointerTarget.matches(':focus-visible'),true);
 pointerTarget.onclick!({detail:1});await f.advance();const replacement=control(f,'已完成');
 assert.notEqual(replacement,pointerTarget);assert.equal(replacement.focusCalls,0,'pointer activation must not create a keyboard restoration intent');assert.equal(f.doc.activeElement===f.doc.body,true);assert.equal(f.view.taskFilter,'done');assert.equal(rows(f).length,1);assert.equal(f.processes,0);
});
test('pointer Show all does not restore focus when its trigger still has a keyboard-visible ring',async()=>{
 const f=fixture('- [x] 完成资料备份');f.view.taskFilter='todo';f.setQuery('资料');await f.refresh();const trigger=control(f,'查看全部任务');f.doc.keyboard=true;trigger.focus();assert.equal(trigger.matches(':focus-visible'),true);
 const before={query:f.view.query,scope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden};trigger.onclick!({detail:1});await f.advance();
 assert.equal(control(f,'全部').focusCalls,0,'pointer Show all must not focus the replacement All filter');assert.equal(f.doc.activeElement===f.doc.body,true);assert.equal(f.view.taskFilter,'all');assert.deepEqual({query:f.view.query,scope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden},before);assert.equal(rows(f).length,1);assert.equal(f.processes,0);
});

test('same-context pointer refresh retains the pre-existing unique-control preservation contract',async()=>{
 const f=fixture();await f.refresh();keyboardActivate(f,'已完成');await f.advance();const trigger=control(f,'已完成');trigger.onclick!({detail:1});await f.advance();const replacement=control(f,'已完成');
 assert.notEqual(replacement,trigger);assert.equal(f.doc.activeElement===replacement,true);assert.equal(replacement.focusCalls,1,'existing same-key publication preserves an identifiable control');assert.equal(f.view.taskFilter,'done');assert.equal(rows(f).length,1);assert.equal(f.processes,0);
});
