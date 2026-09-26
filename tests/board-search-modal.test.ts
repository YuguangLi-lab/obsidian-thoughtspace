import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,colors,colorNames,type Board,type Card} from '../src/model';
import {boardSearchIndex,searchBoard,searchKinds,searchExcerpt,searchDirectory} from '../src/board-search';

type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string;value?:string};
class Element{
 children:Element[]=[];classes=new Set<string>();attributes:Record<string,string>={};disabled=false;value='';checked=false;scrolls=0;classWrites=0;emptyCalls=0;
 private text='';
 onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;onkeydown?:(event:any)=>void;onpointerenter?:()=>void;onpointermove?:(event:{clientX:number;clientY:number})=>void;onfocus?:()=>void;
 constructor(readonly tagName:string,readonly ownerDocument:{activeElement?:Element},readonly win:Clock,options:Options|string={}){
  const opts=typeof options==='string'?{cls:options}:options;for(const cls of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(cls);
  this.text=opts.text||'';this.attributes={...opts.attr};this.value=opts.value||'';if(opts.type)this.attributes.type=opts.type;
 }
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 get options(){return this.children.filter(child=>child.tagName==='OPTION');}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag.toUpperCase(),this.ownerDocument,this.win,options);this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}
 createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(...classes:string[]){for(const cls of classes)this.classes.add(cls);}
 toggleClass(cls:string,enabled:boolean){this.classWrites++;if(enabled)this.classes.add(cls);else this.classes.delete(cls);}
 setAttribute(key:string,value:string){this.attributes[key]=value;}
 removeAttribute(key:string){delete this.attributes[key];}
 getAttribute(key:string){return this.attributes[key]??null;}
 setText(text:string){this.text=text;this.children=[];}
 appendText(text:string){this.text+=text;}
 empty(){this.emptyCalls++;this.children=[];this.text='';}
 matches(selector:string){return selector.startsWith('.')?this.classes.has(selector.slice(1)):this.tagName===selector.toUpperCase();}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 scrollIntoView(){this.scrolls++;}
 focus(){this.ownerDocument.activeElement=this;this.onfocus?.();}
 click(){if(!this.disabled)this.onclick?.();}
}
class Clock{
 next=1;pending=new Map<number,{run:()=>void;delay:number}>();
 setTimeout(run:()=>void,delay:number){const id=this.next++;this.pending.set(id,{run,delay});return id;}
 clearTimeout(id?:number){if(id!==undefined)this.pending.delete(id);}
 flush(delay=Infinity){for(const [id,timer] of [...this.pending])if(timer.delay<=delay){this.pending.delete(id);timer.run();}}
}
class Modal{
 readonly document:{activeElement?:Element}={};readonly clock=new Clock();readonly modalEl=new Element('DIV',this.document,this.clock);
 readonly titleEl=this.modalEl.createEl('h2');readonly contentEl=this.modalEl.createDiv();closeCount=0;
 constructor(readonly app:any){}
 close(){this.closeCount++;(this as any).onClose();}
}
class TFile{
 extension='md';stat={size:20};basename:string;
 constructor(readonly path:string){this.basename=path.split('/').pop()!.replace(/\.md$/,'');}
}
const source=readFileSync('src/board-search-view.ts','utf8').replace(/^import .*;\n/gm,'');
let searches=0,excerpts=0;const clipboard:string[]=[];
const BoardSearchModal=new Function('Modal','TFile','Notice','setIcon','getAllTags','themeSurface','colors','colorNames','boardSearchIndex','searchBoard','searchKinds','searchExcerpt','searchDirectory','navigator',transformSync(source.replace(/^export /gm,'')+'\nreturn BoardSearchModal;',{loader:'ts'}).code)(Modal,TFile,class{},()=>{},()=>[],()=>{},colors,colorNames,boardSearchIndex,(...args:Parameters<typeof searchBoard>)=>{searches++;return searchBoard(...args);},searchKinds,(...args:Parameters<typeof searchExcerpt>)=>{excerpts++;return searchExcerpt(...args);},searchDirectory,{clipboard:{writeText:async(text:string)=>{clipboard.push(text);}}});
const node=(id:string,kind:Card['kind']='text'):Card=>({id,kind,title:id,text:`正文 ${id}`,x:1000,y:0,width:100,height:80,color:'green',...(kind==='card'?{file:`notes/${id}.md`}:{})});
function fixture(nodes:Card[]=[node('alpha'),node('beta','card'),node('gamma')],read?:(file:TFile)=>Promise<string>){
 const board:Board={...emptyBoard(),nodes};const located:string[]=[],opened:string[]=[],reads:string[]=[],files=new Map(nodes.filter(n=>n.file).map(n=>[n.file!,new TFile(n.file!)]));
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),cachedRead:async(file:TFile)=>{reads.push(file.path);return read?read(file):`完整正文 ${file.basename}`;}},metadataCache:{getFileCache:()=>({headings:[{heading:'基础层级'}]})}};
 const host={title:'测试白板',board:()=>board,locate:async(id:string)=>{located.push(id);},open:async(id:string)=>{opened.push(id);},link:(id:string)=>`obsidian://open?id=${id}`};
 const modal=new BoardSearchModal(app,host);modal.onOpen();const input=modal.contentEl.querySelector('input') as Element,list=modal.contentEl.querySelector('.ts-board-search-results') as Element;
 return{modal,input,list,board,host,located,opened,reads,files,clock:modal.clock as Clock};
}
function key(el:Element,key:string,options:Record<string,unknown>={}){const event={key,isComposing:false,keyCode:0,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,defaultPrevented:false,target:el,preventDefault(){this.defaultPrevented=true;},...options};el.onkeydown?.(event);return event;}
const current=(list:Element)=>list.querySelector('.is-active')?.getAttribute('data-search-node');
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

test('ordinary arrow navigation updates only two existing rows without searching or rebuilding',()=>{
 const {input,list}=fixture(Array.from({length:400},(_,i)=>node(`n${i}`)));const before=list.children.slice(),emptyCalls=list.emptyCalls,searchCount=searches;
 for(const row of before)row.classWrites=0;key(input,'ArrowDown');
 assert.equal(current(list),'n1');assert.equal(list.emptyCalls,emptyCalls);assert.deepEqual(list.children,before);assert.equal(searches,searchCount);
 assert.equal(before.reduce((total,row)=>total+row.classWrites,0),2);
});
test('legacy IME 229 never navigates or invokes the current result',async()=>{
 for(const pressed of ['ArrowDown','ArrowUp','Enter']){const {input,list,located,modal}=fixture(),event=key(input,pressed,{keyCode:229});await tick();assert.equal(event.defaultPrevented,false,pressed);assert.equal(current(list),'alpha');assert.deepEqual(located,[]);assert.equal(modal.closeCount,0);}
});
test('row focus and pointer current agree and row arrow navigation preserves focus',()=>{
 const {input,list,modal}=fixture(),rows=list.querySelectorAll('.ts-board-search-row'),picks=list.querySelectorAll('.ts-board-search-pick');
 rows[2].onpointermove?.({clientX:100,clientY:200});assert.equal(current(list),'gamma');picks[0].focus();assert.equal(current(list),'alpha');
 const event=key(picks[0],'ArrowDown');assert.equal(event.defaultPrevented,true);assert.equal(current(list),'beta');assert.equal(modal.document.activeElement,picks[1]);
 input.focus();assert.equal(current(list),'beta');
});
test('Cmd or Ctrl Enter opens a note on the right and never locates a non-note',async()=>{
 for(const modifier of ['metaKey','ctrlKey']){const {input,opened,located,modal}=fixture();key(input,'ArrowDown');key(input,'Enter',{[modifier]:true});await tick();assert.deepEqual(opened,['beta']);assert.deepEqual(located,[]);assert.equal(modal.closeCount,1);}
 const {input,opened,located,modal}=fixture();key(input,'Enter',{ctrlKey:true});await tick();assert.deepEqual(opened,[]);assert.deepEqual(located,[]);assert.equal(modal.closeCount,0);
});

test('composition and modified navigation keep native editing and Home End do not move input selection',async()=>{
 const {input,list,located,opened}=fixture(),before=current(list);
 for(const pressed of ['ArrowDown','ArrowUp','Enter'])assert.equal(key(input,pressed,{isComposing:true}).defaultPrevented,false);
 for(const pressed of ['Home','End'])assert.equal(key(input,pressed).defaultPrevented,false);
 for(const modifier of ['ctrlKey','metaKey','altKey','shiftKey'])for(const pressed of ['ArrowDown','ArrowUp'])assert.equal(key(input,pressed,{[modifier]:true}).defaultPrevented,false);
 for(const modifier of ['altKey','shiftKey'])assert.equal(key(input,'Enter',{[modifier]:true}).defaultPrevented,false);
 assert.equal(key(input,'Enter',{ctrlKey:true,metaKey:true}).defaultPrevented,false);await tick();assert.equal(current(list),before);assert.deepEqual(located,[]);assert.deepEqual(opened,[]);
});
test('debounced queries coalesce and immediate Enter flushes the latest query exactly once',async()=>{
 const {input,list,clock,located,modal}=fixture(),initialSearches=searches;
 input.value='gam';input.oninput?.();input.value='beta';input.oninput?.();assert.equal(clock.pending.size,1);assert.equal(searches,initialSearches);
 key(input,'Enter');key(input,'Enter');assert.deepEqual(located,['beta']);assert.equal(searches,initialSearches+1);assert.equal(clock.pending.size,0);await tick();assert.equal(modal.closeCount,1);assert.equal(list.children.length,1);
 const delayed=fixture();delayed.input.value='gamma';delayed.input.oninput?.();delayed.clock.flush(89);assert.equal(current(delayed.list),'alpha');delayed.clock.flush(90);assert.equal(current(delayed.list),'gamma');
});
test('an arrow flushes a pending query then navigates the new result set',()=>{
 const {input,list,clock}=fixture([node('alpha'),node('beta-one'),node('beta-two')]);input.value='beta';input.oninput?.();key(input,'ArrowDown');assert.equal(current(list),'beta-two');assert.equal(clock.pending.size,0);assert.equal(list.querySelectorAll('.ts-board-search-row').length,2);
});
test('query or filter changes update cached results, reset selection, and retain one current marker',()=>{
 const {input,list,modal,clock}=fixture();key(input,'ArrowDown');assert.equal(current(list),'beta');
 const [kind,group,color]=modal.contentEl.querySelectorAll('select') as Element[];
 kind.value='text';kind.onchange?.();assert.equal(current(list),'alpha');assert.equal(list.querySelectorAll('.ts-board-search-row').length,2);
 key(input,'ArrowDown');assert.equal(current(list),'gamma');group.value=':none';group.onchange?.();assert.equal(current(list),'alpha');
 color.value='rose';color.onchange?.();assert.equal(current(list),undefined);color.value='';color.onchange?.();
 input.value='gamma';input.oninput?.();clock.flush();assert.equal(current(list),'gamma');assert.equal(list.querySelectorAll('.ts-board-search-pick').filter(p=>p.getAttribute('aria-current')==='true').length,1);
});
test('pagination renders only at boundaries and preserves keyboard focus on the next page',()=>{
 const {input,list,modal}=fixture(Array.from({length:85},(_,i)=>node(`n${i}`))),initialEmpty=list.emptyCalls;
 for(let i=0;i<39;i++)key(input,'ArrowDown');assert.equal(current(list),'n39');assert.equal(list.emptyCalls,initialEmpty);assert.equal(list.querySelectorAll('.ts-board-search-row').length,40);
 const lastPick=list.querySelectorAll('.ts-board-search-pick')[39];lastPick.focus();key(lastPick,'ArrowDown');assert.equal(current(list),'n40');assert.equal(list.emptyCalls,initialEmpty+1);assert.equal(list.querySelectorAll('.ts-board-search-row').length,80);assert.equal(modal.document.activeElement,list.querySelectorAll('.ts-board-search-pick')[40]);
 const before=list.emptyCalls;key(list.querySelectorAll('.ts-board-search-pick')[40],'ArrowUp');assert.equal(current(list),'n39');assert.equal(list.emptyCalls,before);
 assert.equal(key(list.querySelectorAll('.ts-board-search-pick')[39],'End').defaultPrevented,false);assert.equal(current(list),'n39');assert.equal(list.querySelectorAll('.ts-board-search-row').length,80);
 for(let i=0;i<46;i++)key(input,'ArrowDown');assert.equal(current(list),'n84');assert.equal(list.querySelectorAll('.ts-board-search-row').length,85);key(input,'ArrowDown');assert.equal(current(list),'n84');key(input,'Home');assert.equal(current(list),'n84');
});
test('show more moves focus to the newly revealed result',()=>{
 const {list,modal}=fixture(Array.from({length:81},(_,i)=>node(`n${i}`)));list.querySelector('.ts-board-search-more')!.click();assert.equal(current(list),'n40');assert.equal(list.querySelectorAll('.ts-board-search-row').length,80);assert.equal(modal.document.activeElement,list.querySelectorAll('.ts-board-search-pick')[40]);
});
test('clear removes all constraints immediately while preserving the full text option',async()=>{
 const {input,list,modal,clock}=fixture();const [kind,group,color]=modal.contentEl.querySelectorAll('select') as Element[],full=modal.contentEl.querySelectorAll('input')[1] as Element;
 full.checked=true;full.onchange?.();kind.value='card';group.value=':none';color.value='rose';input.value='missing';input.oninput?.();
 const clear=modal.contentEl.querySelector('.ts-board-search-clear') as Element;assert.equal(clear.disabled,false);clear.click();assert.equal(input.value,'');assert.equal(kind.value,'');assert.equal(group.value,'');assert.equal(color.value,'');assert.equal(full.checked,true);assert.equal(clock.pending.size,0);assert.equal(current(list),'alpha');assert.equal(modal.document.activeElement,input);assert.equal(clear.disabled,true);
 input.value='missing';input.oninput?.();clock.flush();assert.equal(current(list),undefined);list.querySelector('.ts-board-search-empty-clear')!.click();assert.equal(current(list),'alpha');assert.equal(full.checked,true);modal.close();await tick();
});
test('copy uses the complete cached result set and disables the action for an empty result',async()=>{
 clipboard.length=0;const {input,list,modal,clock}=fixture(Array.from({length:81},(_,i)=>node(`n${i}`))),copy=modal.contentEl.querySelector('.ts-board-search-copy') as Element;
 assert.equal(list.querySelectorAll('.ts-board-search-row').length,40);copy.click();await tick();assert.equal(clipboard.length,1);assert.equal(clipboard[0].trim().split('\n').length,81);
 input.value='missing';input.oninput?.();copy.click();await tick();assert.equal(copy.disabled,true);assert.equal(clipboard.length,1);assert.ok(list.querySelector('.ts-board-search-empty-clear'));
 list.querySelector('.ts-board-search-empty-clear')!.click();assert.equal(copy.disabled,false);input.value='n80';input.oninput?.();clock.flush();copy.click();await tick();assert.equal(clipboard.length,2);assert.match(clipboard[1],/id=n80/);assert.equal(clipboard[1].trim().split('\n').length,1);
});
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fullText(modal:any,enabled=true){const full=modal.contentEl.querySelectorAll('input')[1] as Element;full.checked=enabled;full.onchange?.();return full;}
async function drain(clock:Clock){for(let i=0;i<8;i++){await tick();clock.flush(0);}await tick();}

test('full text refresh reads each on-board note once and refreshes filters using the current query',async()=>{
 const {input,list,modal,clock,reads}=fixture([node('note','card'),{...node('duplicate','card'),file:'notes/note.md'},node('plain')]);
 input.value='完整正文';input.oninput?.();clock.flush();assert.equal(current(list),undefined);fullText(modal);await drain(clock);assert.deepEqual(reads,['notes/note.md']);assert.equal(list.querySelectorAll('.ts-board-search-row').length,2);assert.match(modal.contentEl.querySelector('.ts-board-search-index-status').textContent,/已索引 1 篇正文/);
 const refresh=modal.contentEl.querySelectorAll('button').find((b:Element)=>b.getAttribute('aria-label')==='刷新搜索索引');refresh.click();await drain(clock);assert.deepEqual(reads,['notes/note.md','notes/note.md']);assert.equal(list.querySelectorAll('.ts-board-search-row').length,2);
});
test('overlapping refreshes serialize file reads and only the newest generation populates bodies',async()=>{
 const requests:{path:string;task:ReturnType<typeof deferred<string>>}[]=[];
 const {modal,input,list,clock,reads}=fixture([node('one','card'),node('two','card')],file=>{const task=deferred<string>();requests.push({path:file.path,task});return task.promise;});
 fullText(modal);await tick();assert.equal(requests.length,1);
 const refresh=modal.contentEl.querySelectorAll('button').find((b:Element)=>b.getAttribute('aria-label')==='刷新搜索索引');refresh.click();refresh.click();await tick();assert.equal(requests.length,1,'do not start another read while a previous generation is awaiting IO');
 requests[0].task.resolve('staleOnly');await tick();assert.equal(requests.length,2);assert.equal(requests[1].path,'notes/one.md');requests[1].task.resolve('freshOnly');await drain(clock);assert.equal(requests.length,3);assert.equal(requests[2].path,'notes/two.md');requests[2].task.resolve('freshOnly');await drain(clock);
 input.value='staleOnly';input.oninput?.();clock.flush();assert.equal(current(list),undefined);input.value='freshOnly';input.oninput?.();clock.flush();assert.equal(list.querySelectorAll('.ts-board-search-row').length,2);assert.deepEqual(reads,['notes/one.md','notes/one.md','notes/two.md']);
});
test('disabling full text invalidates pending reads without repopulating stale results',async()=>{
 const task=deferred<string>(),{modal,input,list,clock,reads}=fixture([node('one','card'),node('two','card')],()=>task.promise);
 fullText(modal);await tick();fullText(modal,false);input.value='staleOnly';input.oninput?.();clock.flush();const status=modal.contentEl.querySelector('.ts-board-search-index-status') as Element,before=status.textContent;
 task.resolve('staleOnly');await drain(clock);assert.equal(status.textContent,before);assert.equal(current(list),undefined);assert.deepEqual(reads,['notes/one.md']);
});
test('closing cancels the query and pending indexing cannot change state or execute stale controls',async()=>{
 const task=deferred<string>(),{modal,input,list,clock,reads,located,opened}=fixture([node('one','card'),node('two','card')],()=>task.promise);
 fullText(modal);await tick();const pick=list.querySelector('.ts-board-search-pick')!,open=list.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='在右侧打开原笔记')!;
 input.value='body';input.oninput?.();modal.close();assert.equal(clock.pending.size,0);task.resolve('body');await drain(clock);pick.click();open.click();key(input,'Enter');await tick();assert.equal(modal.contentEl.children.length,0);assert.deepEqual(reads,['notes/one.md']);assert.deepEqual(located,[]);assert.deepEqual(opened,[]);assert.equal(modal.closeCount,1);
});
test('pending locate or open prevents duplicate execution, and a failed action can be retried',async()=>{
 for(const side of [false,true]){const {modal,input,list,host,located,opened}=fixture([node('note','card')]),task=deferred<void>();if(side)host.open=async(id:string)=>{opened.push(id);return task.promise;};else host.locate=async(id:string)=>{located.push(id);return task.promise;};
  key(input,'Enter',{ctrlKey:side});key(input,'Enter',{ctrlKey:!side});list.querySelector('.ts-board-search-pick')!.click();assert.equal(list.getAttribute('aria-busy'),'true');assert.equal(located.length+opened.length,1);assert.equal(modal.closeCount,0);
  task.reject(new Error('retry'));await tick();assert.equal(list.getAttribute('aria-busy'),'false');assert.equal(list.querySelector('.ts-board-search-pick')!.disabled,false);
  host.locate=async(id:string)=>{located.push(id);};key(input,'Enter');await tick();assert.equal(modal.closeCount,1);assert.equal(located.length+opened.length,2);
 }
});
test('refresh preserves an existing selection and its focus and removes deleted group filters',async()=>{
 const {modal,input,list,board}=fixture([node('alpha'),node('beta'),{...node('group','section'),title:'分组'}]);const group=(modal.contentEl.querySelectorAll('select') as Element[])[1];key(input,'ArrowDown');list.querySelectorAll('.ts-board-search-pick')[1].focus();
 const refresh=modal.contentEl.querySelectorAll('button').find((b:Element)=>b.getAttribute('aria-label')==='刷新搜索索引');refresh.click();await tick();assert.equal(current(list),'beta');assert.equal(modal.document.activeElement,list.querySelectorAll('.ts-board-search-pick')[1]);
 group.value='group';group.onchange?.();board.nodes=board.nodes.filter(n=>n.id!=='group');refresh.click();await tick();assert.equal(group.value,'');assert.equal(list.querySelectorAll('.ts-board-search-row').length,2);
});

test('native result buttons cannot locate non-notes with Cmd Ctrl Enter or protected confirmation',async()=>{
 for(const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{metaKey:true,ctrlKey:true},{isComposing:true},{keyCode:229}]){
  const {list,located,opened,modal}=fixture(),pick=list.querySelector('.ts-board-search-pick')!;pick.focus();const event=key(pick,'Enter',options);
  if(!event.defaultPrevented)pick.click();await tick();assert.deepEqual(located,[],JSON.stringify(options));assert.deepEqual(opened,[]);assert.equal(modal.closeCount,0);
 }
 const {list,located}=fixture(),pick=list.querySelector('.ts-board-search-pick')!;key(pick,'Enter');await tick();assert.deepEqual(located,['alpha']);
});
test('arrow movement including pagination does not rewrite the live result count',()=>{
 const {input,list,modal}=fixture(Array.from({length:41},(_,i)=>node(`n${i}`))),status=modal.contentEl.querySelector('.ts-board-search-options').querySelectorAll('span').find((e:Element)=>e.getAttribute('role')==='status') as Element;
 let updates=0;const original=status.setText.bind(status);status.setText=(value:string)=>{updates++;original(value);};for(let i=0;i<40;i++)key(input,'ArrowDown');assert.equal(current(list),'n40');assert.equal(updates,0);
});

test('a focused result button remains the keyboard origin after pointer hover moves current',async()=>{
 const {list,located}=fixture(),rows=list.querySelectorAll('.ts-board-search-row'),picks=list.querySelectorAll('.ts-board-search-pick');picks[0].focus();rows[2].onpointermove?.({clientX:100,clientY:200});assert.equal(current(list),'gamma');key(picks[0],'Enter');await tick();assert.deepEqual(located,['alpha']);
 const second=fixture(),secondRows=second.list.querySelectorAll('.ts-board-search-row'),secondPicks=second.list.querySelectorAll('.ts-board-search-pick');secondPicks[0].focus();secondRows[2].onpointermove?.({clientX:100,clientY:200});key(secondPicks[0],'ArrowDown');assert.equal(current(second.list),'beta');assert.equal(second.modal.document.activeElement,secondPicks[1]);
});

test('full text completion restores the focused node after pointer hover moves current',async()=>{
 const task=deferred<string>(),{modal,list,clock}=fixture([node('alpha','card'),node('beta'),node('gamma')],()=>task.promise);
 fullText(modal);await tick();const rows=list.querySelectorAll('.ts-board-search-row'),picks=list.querySelectorAll('.ts-board-search-pick');picks[0].focus();rows[2].onpointermove?.({clientX:100,clientY:200});assert.equal(current(list),'gamma');assert.equal(modal.document.activeElement,picks[0]);
 task.resolve('完整正文');await drain(clock);const refreshedPicks=list.querySelectorAll('.ts-board-search-pick');assert.equal(modal.document.activeElement.getAttribute('aria-label'),'定位 alpha');assert.equal(modal.document.activeElement,refreshedPicks[0]);assert.equal(current(list),'alpha');
});

test('full text completion returns focus to search if the focused result was removed',async()=>{
 const task=deferred<string>(),{modal,input,list,clock,board}=fixture([node('alpha','card'),node('beta')],()=>task.promise);
 fullText(modal);await tick();list.querySelectorAll('.ts-board-search-pick')[0].focus();board.nodes=board.nodes.filter(n=>n.id!=='alpha');task.resolve('完整正文');await drain(clock);
 assert.equal(modal.document.activeElement,input);assert.equal(current(list),'beta');assert.equal(list.querySelectorAll('.ts-board-search-pick').length,1);
});


test('body indexing preserves the focused row action instead of dropping keyboard focus',async()=>{
 for(const action of ['复制内容定位链接','在右侧打开原笔记']){
  const task=deferred<string>(),{modal,list,clock,opened}=fixture([node('note','card')],()=>task.promise);
  fullText(modal);await tick();const original=list.querySelectorAll('button').find(b=>b.getAttribute('aria-label')===action)!;original.focus();
  task.resolve('完整正文');await drain(clock);const updated=list.querySelectorAll('button').find(b=>b.getAttribute('aria-label')===action)!;
  assert.notEqual(original,updated);assert.equal(modal.document.activeElement,updated,action);assert.equal(current(list),'note');
  if(action==='在右侧打开原笔记'){updated.click();await tick();assert.deepEqual(opened,['note']);}
 }
});
test('removing the focused row action returns focus to the surviving result or search',async()=>{
 const {modal,list,board,input}=fixture([node('note','card')]);
 const refresh=modal.contentEl.querySelectorAll('button').find((b:Element)=>b.getAttribute('aria-label')==='刷新搜索索引');
 list.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='在右侧打开原笔记')!.focus();board.nodes[0].kind='text';refresh.click();await tick();
 assert.equal(modal.document.activeElement,list.querySelector('.ts-board-search-pick'));
 list.querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='复制内容定位链接')!.focus();board.nodes=[];refresh.click();await tick();assert.equal(modal.document.activeElement,input);
});
test('pagination reuses displayed excerpts but a changed query and refreshed body produce current snippets',async()=>{
 const before=excerpts,{modal,list,input,clock,board}=fixture(Array.from({length:85},(_,i)=>({...node(`n${i}`),text:'prefix '.repeat(100)+'firstNeedle '+'middle '.repeat(100)+'secondNeedle'})));
 assert.equal(excerpts-before,40);list.querySelector('.ts-board-search-more')!.click();assert.equal(excerpts-before,80);list.querySelector('.ts-board-search-more')!.click();assert.equal(excerpts-before,85);
 input.value='secondNeedle';input.oninput?.();clock.flush();assert.equal(list.querySelectorAll('.ts-board-search-row').length,40);
 for(const excerpt of list.querySelectorAll('.ts-board-search-excerpt'))assert.match(excerpt.textContent,/secondNeedle/);
 const refresh=modal.contentEl.querySelectorAll('button').find((b:Element)=>b.getAttribute('aria-label')==='刷新搜索索引');board.nodes[0].text='secondNeedle changed body';refresh.click();await tick();assert.equal(list.querySelector('.ts-board-search-excerpt')!.textContent,'secondNeedle changed body');
 modal.close();
});
test('one search rebuild resolves repeated file metadata once but the next rebuild reads current metadata',()=>{
 const {modal,board,files}=fixture(Array.from({length:200},(_,i)=>({...node('n'+i,'card'),file:'notes/shared.md'})));let lookups=0,caches=0,heading='FirstHeading';
 const lookup=modal.app.vault.getAbstractFileByPath;modal.app.vault.getAbstractFileByPath=(path:string)=>{lookups++;return lookup(path);};modal.app.metadataCache.getFileCache=()=>{caches++;return{headings:[{heading}]};};
 modal.refresh();assert.equal(lookups,1);assert.equal(caches,1);assert.equal(searchBoard(modal.entries,{query:'firstheading',kind:'',group:'',color:''}).length,200);
 heading='SecondHeading';board.nodes[0].title='LocalAlias';modal.refresh();assert.equal(lookups,2);assert.equal(caches,2);assert.equal(searchBoard(modal.entries,{query:'firstheading',kind:'',group:'',color:''}).length,0);assert.equal(searchBoard(modal.entries,{query:'localalias secondheading',kind:'',group:'',color:''}).length,1);
 files.delete('notes/shared.md');modal.refresh();assert.equal(lookups,3);assert.equal(caches,2);assert.equal(searchBoard(modal.entries,{query:'secondheading',kind:'',group:'',color:''}).length,0);modal.close();
});

test('search workbench labels native filters and keeps the query and results in separate regions',()=>{
 const {modal,input,list}=fixture(),content=modal.contentEl,workbench=content.querySelector('.ts-board-search-workbench')!,refine=workbench.querySelector('.ts-board-search-refine')!,matches=workbench.querySelector('.ts-board-search-matches')!;
 assert.ok(content.children.includes(content.querySelector('.ts-board-search-bar')));assert.ok(workbench.children.includes(refine));assert.ok(workbench.children.includes(matches));assert.ok(matches.children.includes(list));
 assert.equal(refine.getAttribute('aria-label'),'搜索筛选');assert.equal(list.getAttribute('role'),'region');assert.equal(list.getAttribute('aria-label'),'白板搜索结果');
 const fields=refine.querySelectorAll('.ts-board-search-filter');assert.equal(fields.length,3);
 for(const [i,label]of ['对象类型','所属分组','对象颜色'].entries()){assert.equal(fields[i].tagName,'LABEL');assert.equal(fields[i].querySelector('span')!.textContent,label);assert.equal(fields[i].querySelector('select')!.getAttribute('aria-label'),label);}
 assert.equal(refine.querySelector('.ts-board-search-fulltext')!.tagName,'LABEL');assert.equal(refine.querySelectorAll('input').length,1);assert.ok(refine.querySelector('.ts-board-search-index-status'));assert.equal(modal.document.activeElement,input);
});

test('result context exposes complete plain titles and paths without converting source text into markup',async()=>{
 const title='<img src=x onerror=alert(1)> 长标题 & 研究计划',path='笔记/很长的来源目录/研究 & 方法 <draft>.md',entry={...node('literal','card'),title,file:path};const {modal,list,opened}=fixture([entry]);
 const row=list.querySelector('.ts-board-search-row')!,pick=row.querySelector('.ts-board-search-pick')!;
 assert.equal(row.getAttribute('role'),'group');assert.equal(row.getAttribute('aria-label'),`笔记 · ${title}`);assert.equal(pick.getAttribute('aria-label'),`定位 ${title}`);assert.equal(row.querySelector('strong')!.textContent,title);
 assert.equal(row.querySelector('.ts-board-search-path')!.textContent,path);assert.equal(row.querySelector('.ts-board-search-path')!.getAttribute('title'),path);assert.equal(row.querySelectorAll('img').length,0);
 assert.equal(row.querySelector('.ts-board-search-heading')!.querySelector('span')!.getAttribute('aria-hidden'),'true');const open=row.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='在右侧打开原笔记')!;assert.equal(open.querySelector('.ts-board-search-action-label')!.textContent,'打开');open.click();await tick();assert.deepEqual(opened,['literal']);assert.equal(modal.closeCount,1);
});

test('empty search has a distinct explanation and an operable reset inside the result viewport',()=>{
 const {modal,input,list,clock}=fixture();input.value='没有这个内容';input.oninput?.();clock.flush();const empty=list.querySelector('.ts-board-search-empty')!;
 assert.equal(empty.querySelector('strong')!.textContent,'没有匹配的内容');assert.match(empty.textContent,/清除类型、分组与颜色筛选/);assert.equal(empty.querySelector('.ts-board-search-empty-icon')!.getAttribute('aria-hidden'),'true');empty.querySelector('.ts-board-search-empty-clear')!.click();assert.equal(current(list),'alpha');assert.equal(modal.document.activeElement,input);
});

test('stationary pointer boundary events cannot replace a keyboard-selected result',()=>{
 const {input,list}=fixture(),rows=list.querySelectorAll('.ts-board-search-row');key(input,'ArrowDown');assert.equal(current(list),'beta');
 rows[2].onpointerenter?.();assert.equal(current(list),'beta','scrolling a row under a stationary pointer must not replace keyboard selection');
 rows[2].onpointermove?.({clientX:100,clientY:200});assert.equal(current(list),'gamma');key(input,'ArrowUp');assert.equal(current(list),'beta');
 rows[2].onpointermove?.({clientX:100,clientY:200});assert.equal(current(list),'beta','a synthetic stationary move also leaves keyboard selection alone');
 rows[2].onpointermove?.({clientX:101,clientY:200});assert.equal(current(list),'gamma','real movement retains pointer selection');
});
