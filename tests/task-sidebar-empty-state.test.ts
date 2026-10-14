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
const source=readFileSync(process.env.TASK_SIDEBAR_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const methods=take('  private clearSidebarFilters()', '  private async exportCanvas(');
const buttonSource=take('function button(', '\nclass Prompt ');
type Options={text?:string;cls?:string;attr?:Record<string,string>;value?:string;type?:string};
class File{extension='md';stat={mtime:1};constructor(public path:string,public basename=path.split('/').at(-1)!.replace(/\.md$/,'')){};}
class Element{
 children:Element[]=[];parent?:Element;tag='div';text='';value='';hidden=false;checked=false;disabled=false;scrollTop=0;dataset:Record<string,string>={};attributes=new Map<string,string>();classes=new Set<string>();
 onclick?:()=>unknown;onchange?:()=>unknown;focusCalls=0;
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
 matches(selector:string){return selector==='[aria-label]'?this.attributes.has('aria-label'):selector.startsWith('.')?this.classes.has(selector.slice(1)):false;}
 querySelector<T extends Element=Element>(selector:string){return this.all().slice(1).find(el=>el.matches(selector)) as T|undefined;}
 querySelectorAll(selector:string){return this.all().slice(1).filter(el=>el.matches(selector));}
 closest(selector:string):Element|null{return selector.startsWith('.')&&(this.classes.has(selector.slice(1)))?this:this.parent?.closest(selector)||null;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this);this.parent=undefined;}
 replaceChildren(...children:Element[]){for(const child of this.children)child.parent=undefined;this.children=children;for(const child of children)child.parent=this;}
}
class DocumentMock{activeElement:Element|null=null;defaultView={HTMLElement:Element};createDocumentFragment(){return new Element(this);}}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(content='- [ ] 整理参考文献\n- [x] 完成资料备份'){
 const doc=new DocumentMock(),sidebar=new Element(doc),search=sidebar.createEl('input',{cls:'ts-search'}),clear=sidebar.createEl('button',{cls:'ts-search-clear'}),list=sidebar.createDiv('ts-library');
 const files=[new File('Notes/项目.md')],bodies=new Map(files.map(file=>[file,content])),timers=new Map<number,()=>void>(),jobs:Promise<unknown>[]=[];let next=0,reads=0,processes=0;
 const window={setTimeout(fn:()=>void){const id=++next;timers.set(id,fn);return id;},clearTimeout(id:number){timers.delete(id);}};
 const act=(callback:()=>unknown)=>{const result=callback();if(result&&typeof (result as Promise<unknown>).then==='function')jobs.push(Promise.resolve(result));return result;};
 const deps={window,act,setIcon(){},TFile:File,extractTasks,toggleTask,taskSummary,visibleTasks,isWorkspaceFile,replaceSidebarContents};
 const View=new Function(...Object.keys(deps),transformSync(`${buttonSource}\nreturn class View{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View(),board={...emptyBoard(),nodes:[{id:'note',kind:'card',file:files[0].path,color:'sand',x:0,y:0,width:300,height:180}]};
 Object.assign(view,{sidebar,list,file:{path:'Fixture.thoughtspace'},session:{board},closed:false,tab:'tasks',query:'',tag:'#保留',boardScope:'spaces',boardSort:'title',libraryScope:'cards',librarySort:'updated',taskScope:'board',taskFilter:'all',outlineKind:'all',sidebarRun:0,
  app:{vault:{getAbstractFileByPath:(path:string)=>files.find(f=>f.path===path),getMarkdownFiles:()=>files,cachedRead:async(file:File)=>{reads++;return bodies.get(file)||'';},process:async(file:File,fn:(raw:string)=>string)=>{processes++;bodies.set(file,fn(bodies.get(file)||''));}},workspace:{getLeaf:()=>({openFile(){}})}}});
 const setQuery=(query:string)=>{view.query=query;search.value=query;clear.hidden=!query;};
 async function advance(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}await Promise.all(jobs.splice(0));}
 return{view,doc,sidebar,list,search,clear,files,bodies,timers,setQuery,advance,refresh:()=>view.populateSidebar(),get reads(){return reads;},get processes(){return processes;}};
}
const empty=(f:ReturnType<typeof fixture>)=>f.list.all().find(el=>el.classes.has('ts-sidebar-empty'));
const control=(f:ReturnType<typeof fixture>,label:string)=>{const el=f.list.all().find(el=>el.getAttribute('aria-label')===label);assert.ok(el?.onclick,`actual callback ${label}`);return el;};
const taskRows=(f:ReturnType<typeof fixture>)=>f.list.all().filter(el=>el.classes.has('ts-task'));

test('task search with no matches gives search recovery instead of claiming there are no tasks',async()=>{
 const f=fixture();f.setQuery('不存在的检索词');await f.refresh();
 console.log(JSON.stringify({probe:'search-no-match',text:empty(f)?.textContent,actualTasks:extractTasks(f.bodies.get(f.files[0])!).length}));
 assert.equal(taskRows(f).length,0);assert.match(empty(f)!.textContent,/没有匹配的任务/);assert.doesNotMatch(empty(f)!.textContent,/还没有任务/);control(f,'清除搜索');
});
test('a genuinely empty current task scope keeps the Markdown task creation guidance',async()=>{
 const f=fixture('只有研究资料，尚未写入任务。');await f.refresh();
 console.log(JSON.stringify({probe:'genuine-empty',text:empty(f)?.textContent,actualTasks:0}));
 assert.match(empty(f)!.textContent,/还没有任务/);assert.match(empty(f)!.textContent,/- \[ \] 待办事项/);assert.equal(f.list.all().some(el=>el.getAttribute('aria-label')==='清除搜索'),false);
});
test('an empty completion-state filter is distinguished from a genuinely empty task scope',async()=>{
 for(const [content,filter]of [['- [x] 已完成资料备份','todo'],['- [ ] 核对引用来源','done']] as const){const f=fixture(content);f.view.taskFilter=filter;await f.refresh();
  console.log(JSON.stringify({probe:'status-no-match',filter,text:empty(f)?.textContent,actualTasks:1}));
  assert.equal(taskRows(f).length,0);assert.doesNotMatch(empty(f)!.textContent,/还没有任务/);assert.match(empty(f)!.textContent,/当前筛选/);
 }
});
test('task filter buttons expose their selected state without replacing native button activation',async()=>{
 for(const selected of ['all','todo','done']){const f=fixture();f.view.taskFilter=selected;await f.refresh();for(const [id,label]of [['all','全部'],['todo','未完成'],['done','已完成']]){const b=control(f,label);assert.equal(b.getAttribute('aria-pressed'),String(id===selected));assert.equal(b.classes.has('is-active'),id===selected);assert.equal(b.tag,'button');}}
});

test('actual Clear search callback preserves task and unrelated library filters and focuses the original search input',async()=>{
 for(const taskScope of ['board','vault'])for(const taskFilter of ['all','todo','done']){const f=fixture();Object.assign(f.view,{taskScope,taskFilter});f.setQuery('不存在的检索词');await f.refresh();
  const before={taskScope,taskFilter,tag:f.view.tag,libraryScope:f.view.libraryScope},source=f.bodies.get(f.files[0]);
  control(f,'清除搜索').onclick!();assert.equal(f.view.query,'');assert.equal(f.search.value,'');assert.equal(f.clear.hidden,true);assert.equal(f.doc.activeElement,f.search);assert.equal(f.search.focusCalls,1);
  assert.deepEqual({taskScope:f.view.taskScope,taskFilter:f.view.taskFilter,tag:f.view.tag,libraryScope:f.view.libraryScope},before);assert.equal(f.processes,0);assert.equal(f.bodies.get(f.files[0]),source);
  await f.advance();assert.equal(taskRows(f).length,taskFilter==='all'?2:1);assert.equal(empty(f),undefined);assert.equal(f.doc.activeElement,f.search);
 }
});
test('actual Show all tasks callback changes only the completion filter and preserves a newer query',async()=>{
 for(const [content,taskFilter]of [['- [x] 完成资料备份','todo'],['- [ ] 核对资料来源','done']] as const){const f=fixture(content);Object.assign(f.view,{taskFilter,taskScope:'vault'});await f.refresh();
  const action=control(f,'查看全部任务');f.setQuery('资料');const before={query:f.view.query,taskScope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden};
  action.onclick!();assert.equal(f.view.taskFilter,'all');assert.deepEqual({query:f.view.query,taskScope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden},before);
  await f.advance();assert.equal(taskRows(f).length,1);assert.equal(control(f,'全部').getAttribute('aria-pressed'),'true');assert.equal(f.bodies.get(f.files[0]),content);assert.equal(f.processes,0);
 }
});
test('empty-state actions from a replaced task page cannot reset another sidebar page',async()=>{
 for(const status of [false,true]){const f=fixture(status?'- [x] 已完成':'- [ ] 待办');if(status)f.view.taskFilter='todo';else f.setQuery('不存在');await f.refresh();const action=control(f,status?'查看全部任务':'清除搜索');
  f.view.tab='library';const before={query:f.view.query,taskFilter:f.view.taskFilter,tag:f.view.tag,libraryScope:f.view.libraryScope};action.onclick!();
  assert.deepEqual({query:f.view.query,taskFilter:f.view.taskFilter,tag:f.view.tag,libraryScope:f.view.libraryScope},before);assert.equal(f.timers.size,0);
 }
});
test('activating real task filter buttons updates rows and selected semantics while preserving scope',async()=>{
 const f=fixture();f.view.taskScope='vault';await f.refresh();control(f,'已完成').onclick!();await f.advance();assert.equal(f.view.taskScope,'vault');assert.equal(taskRows(f).length,1);assert.match(taskRows(f)[0].textContent,/完成资料备份/);assert.equal(control(f,'已完成').getAttribute('aria-pressed'),'true');assert.equal(control(f,'全部').getAttribute('aria-pressed'),'false');
 control(f,'未完成').onclick!();await f.advance();assert.equal(f.view.taskScope,'vault');assert.equal(taskRows(f).length,1);assert.match(taskRows(f)[0].textContent,/整理参考文献/);assert.equal(control(f,'未完成').getAttribute('aria-pressed'),'true');assert.equal(f.processes,0);
});
test('deferred task reads keep the published list until a complete query result is ready',async()=>{
 const f=fixture(),gate=deferred<string>();f.setQuery('不存在');f.list.createSpan({text:'原有列表'});f.view.app.vault.cachedRead=()=>gate.promise;
 const pending=f.refresh();assert.equal(f.list.textContent,'原有列表');assert.equal(f.list.getAttribute('aria-busy'),'true');assert.equal(empty(f),undefined);
 gate.resolve('- [ ] 已有任务');await pending;assert.equal(f.list.getAttribute('aria-busy'),null);assert.equal(empty(f)?.querySelector('.ts-task-empty-title')?.text,'没有匹配的任务');assert.equal(empty(f)?.querySelector('.ts-task-empty-copy')?.tag,'span');assert.equal(empty(f)?.querySelector('.ts-task-empty-title')?.tag,'strong');
});
test('a failed deferred task read retains the existing list and original retry feedback',async()=>{
 const f=fixture(),gate=deferred<string>();f.list.createSpan({text:'原有列表'});f.view.app.vault.cachedRead=()=>gate.promise;
 const pending=f.refresh();gate.reject(Error('fixture read failure'));await assert.rejects(pending,/fixture read failure/);assert.match(f.list.textContent,/原有列表/);assert.match(f.list.textContent,/列表更新失败，已保留原内容/);assert.equal(f.list.getAttribute('aria-busy'),null);assert.equal(empty(f),undefined);control(f,'重试');
});
test('an old delayed task query cannot publish over newer completed results',async()=>{
 const f=fixture(),gate=deferred<string>();let reads=0;f.setQuery('不存在');f.view.app.vault.cachedRead=()=>++reads===1?gate.promise:Promise.resolve('- [x] 完成资料备份');const old=f.refresh();
 f.setQuery('资料备份');f.view.renderSidebar();await f.advance();const published=f.list.children;assert.equal(taskRows(f).length,1);assert.equal(empty(f),undefined);
 gate.resolve('- [ ] 旧任务');await old;assert.equal(f.list.children,published);assert.match(taskRows(f)[0].textContent,/完成资料备份/);assert.equal(f.list.getAttribute('aria-busy'),null);
});
test('closing, replacing the owner or changing the target list rejects a delayed task publication',async()=>{
 for(const change of ['closed','owner','target']){const f=fixture(),gate=deferred<string>();f.list.createSpan({text:'原有列表'});f.view.app.vault.cachedRead=()=>gate.promise;const pending=f.refresh();
  if(change==='closed')f.view.closed=true;else if(change==='owner')f.view.session={board:emptyBoard()};else{f.view.list=new Element(f.doc);f.view.list.createSpan({text:'新目标列表'});}
  gate.resolve('- [ ] 迟到任务');await pending;assert.equal(f.list.textContent,'原有列表',change);assert.equal(empty(f),undefined,change);if(change==='target')assert.equal(f.view.list.textContent,'新目标列表');
 }
});
test('task display cap and original source-backed checkbox process remain unchanged',async()=>{
 const capped=fixture(Array.from({length:205},(_,i)=>`- [ ] 任务 ${i+1}`).join('\n'));await capped.refresh();assert.equal(taskRows(capped).length,200);assert.match(capped.list.textContent,/显示前 200 条匹配任务，请搜索缩小范围/);assert.match(capped.list.textContent,/已完成 0 \/ 205/);assert.equal(empty(capped),undefined);assert.equal(capped.processes,0);
 const f=fixture('- [ ] 核对来源\n\n原始说明保持不变。');f.view.taskFilter='todo';await f.refresh();const checkbox=taskRows(f)[0].children.find(el=>el.tag==='input');assert.ok(checkbox?.onchange);checkbox.checked=true;await checkbox.onchange();assert.equal(f.processes,1);assert.equal(f.bodies.get(f.files[0]),'- [x] 核对来源\n\n原始说明保持不变。');await f.advance();assert.equal(taskRows(f).length,0);assert.match(empty(f)!.textContent,/当前范围的任务都已完成/);
});

for(const [content,taskFilter]of [['- [ ] 核对资料来源','done'],['- [x] 完成资料备份','todo']] as const)test(`a matching task query with zero ${taskFilter} rows explains completion filtering and preserves the query on recovery`,async()=>{
 const f=fixture(content);f.view.taskScope='vault';f.view.taskFilter=taskFilter;f.setQuery('资料');await f.refresh();
 console.log(JSON.stringify({probe:'query-matches-status-empty',filter:taskFilter,query:f.view.query,text:empty(f)?.textContent,actualTasks:1}));
 assert.equal(taskRows(f).length,0);assert.equal(empty(f)?.querySelector('.ts-task-empty-title')?.text,'当前筛选下没有任务');assert.doesNotMatch(empty(f)!.textContent,/试试其他关键词|清除搜索/);
 assert.equal(f.list.all().some(el=>el.getAttribute('aria-label')==='清除搜索'),false);const before={query:f.view.query,taskScope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden};
 control(f,'查看全部任务').onclick!();assert.equal(f.view.taskFilter,'all');assert.deepEqual({query:f.view.query,taskScope:f.view.taskScope,tag:f.view.tag,libraryScope:f.view.libraryScope,search:f.search.value,hidden:f.clear.hidden},before);
 await f.advance();assert.equal(taskRows(f).length,1);assert.match(taskRows(f)[0].textContent,/资料/);assert.equal(empty(f),undefined);assert.equal(f.bodies.get(f.files[0]),content);assert.equal(f.processes,0);
});

for(const [matched,other,taskFilter]of [['- [x] 完成资料备份','- [ ] 整理研究问题','todo'],['- [ ] 核对资料来源','- [x] 已完成研究问题整理','done']] as const)test(`a mixed two-note scope limits the ${taskFilter} empty explanation to tasks matching the search`,async()=>{
 const f=fixture(matched),second=new File('Notes/另一项目.md');f.files.push(second);f.bodies.set(second,other);f.view.taskScope='vault';f.view.taskFilter=taskFilter;f.setQuery('资料');await f.refresh();
 console.log(JSON.stringify({probe:'mixed-scope-query-status-empty',filter:taskFilter,query:f.view.query,text:empty(f)?.textContent,scopeTasks:2,queryTasks:1}));
 assert.equal(f.reads,2);assert.equal(taskRows(f).length,0);assert.equal(empty(f)?.querySelector('.ts-task-empty-title')?.text,'当前筛选下没有任务');assert.match(empty(f)!.querySelector('.ts-task-empty-copy')!.text,/匹配当前搜索的任务/);assert.doesNotMatch(empty(f)!.querySelector('.ts-task-empty-copy')!.text,/当前范围/);
 control(f,'查看全部任务').onclick!();assert.equal(f.view.query,'资料');assert.equal(f.view.taskScope,'vault');await f.advance();assert.equal(taskRows(f).length,1);assert.match(taskRows(f)[0].textContent,/资料/);assert.doesNotMatch(f.list.textContent,/研究问题/);assert.equal(f.bodies.get(f.files[0]),matched);assert.equal(f.bodies.get(second),other);assert.equal(f.processes,0);
});
