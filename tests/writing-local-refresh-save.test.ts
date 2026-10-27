import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,clone} from '../src/model';
import {writingItems,writingOrder,writingParts,writingName} from '../src/writing';

const source=readFileSync('src/writing-view.ts','utf8');
function method(start:string,end='\n private '){const a=source.indexOf(start);assert.ok(a>=0,start);const b=source.indexOf(end,a+start.length);return source.slice(a,b<0?source.lastIndexOf('\n}'):b);}
function viewClass(code:string,globals:Record<string,unknown>={}){return new Function(...Object.keys(globals),transformSync('class View{'+code+'};return View',{loader:'ts'}).code)(...Object.values(globals));}
class Element extends EventTarget {
 children:Element[]=[];parent?:Element;value='';textContent='';open=false;disabled=false;checked=false;selected=false;focused=false;dataset:Record<string,string>={};
 constructor(public tag='div',public cls=''){super();}
 createDiv(options:any=''){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createEl(tag:string,options:any={}){const el=new Element(tag,options.cls||'');el.parent=this;el.value=options.value||'';el.textContent=options.text||'';this.children.push(el);return el;}
 createSpan(options:any={}){return this.createEl('span',options);}
 setText(text:string){this.textContent=text;}
 empty(){this.children=[];}
 toggleClass(){}
 setAttribute(){}
 focus(){this.focused=true;}
 select(){this.selected=true;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 insertBefore(el:Element,before:Element){this.children=this.children.filter(c=>c!==el);this.children.splice(this.children.indexOf(before),0,el);el.parent=this;}
 querySelector(selector:string):Element|null{for(const child of this.children){if(selector.startsWith('.')&&child.cls.split(' ').includes(selector.slice(1))||child.tag===selector)return child;const result=child.querySelector(selector);if(result)return result;}return null;}
}
class Input extends EventTarget {value='baseline';selectionStart=2;selectionEnd=5;}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};}

const MaterialsView=viewClass(method(' private matching(')+method(' private renderMaterials('),{writingItems,writingOrder,writingParts,writingName,setIcon(){},icons:{text:'type'},kinds:{text:'文本'}});
function materialsFixture(){
 const board=emptyBoard();board.nodes=Array.from({length:205},(_,i)=>({id:'m'+i,kind:'text',text:i===0?'needle':'material '+i,x:0,y:0,width:10,height:10,color:'sand'}));board.writing={title:'Draft',order:[],chapters:[{id:'chapter',title:'Chapter',body:'baseline'}]};
 const input=new Input(),root={ownerDocument:{activeElement:input}},pending=new Map([['chapterbody',()=>{throw Error('must not commit');}]]),actions=new Map<string,()=>void>();
 const list=new Element(),view=Object.assign(new MaterialsView(),{owner:{board,blocked:false},list,contentEl:root,entryInputs:[input],entryEditors:[{dispose(){throw Error('must not dispose');}}],pendingFields:pending,query:'',filter:'all',mode:'outline',limit:100,composing:true,state:()=>board.writing,dragRow(){},action(parent:Element,label:string,fn:()=>void){actions.set(label,fn);return parent.createEl('button',{text:label});},flushFields(){throw Error('must not flush');},renderLists(){throw Error('must not rebuild outline');}});
 return{view,input,root,pending,actions,list};
}
test('actual search/filter/pagination handlers retain chapter identity, focus, selection, IME and pending edits',()=>{
 const f=materialsFixture(),input=f.input;input.value='章节组字尚未提交';
 const callback=source.slice(source.indexOf('  search.oninput='),source.indexOf('\n  const filters=',source.indexOf('  search.oninput=')));
 const search:any={value:'needle'};new Function('search',transformSync(callback,{loader:'ts'}).code).call(f.view,search);search.oninput();
 assert.equal(f.list.children.length,1);assert.equal(f.view.entryInputs[0],input);assert.equal(f.root.ownerDocument.activeElement,input);assert.equal(input.value,'章节组字尚未提交');assert.deepEqual([input.selectionStart,input.selectionEnd],[2,5]);assert.equal(f.view.composing,true);assert.equal(f.pending.size,1);
 const filterStart=source.indexOf('  const applyFilter='),filterEnd=source.indexOf('\n  for(const [key,label]',filterStart),type={value:''};
 const applyFilter=new Function('filterButtons','type',transformSync(source.slice(filterStart,filterEnd)+';return applyFilter',{loader:'ts'}).code).call(f.view,[],type);f.view.query='';applyFilter('all');assert.equal(f.list.children.length,101);f.actions.get('加载更多 · 106')!();assert.equal(f.view.limit,200);assert.equal(f.list.children.length,201);assert.equal(f.view.entryInputs[0],input);assert.equal(f.pending.size,1);
});
test('material search remains local and readable when board persistence is blocked',()=>{const f=materialsFixture();f.view.owner.blocked=true;f.view.query='needle';f.view.renderMaterials();assert.equal(f.list.children.length,1);assert.equal(f.view.composing,true);assert.equal(f.pending.size,1);});

const notices:string[]=[];
const SaveView=viewClass(method(' private currentWritingSnapshot(')+method(' private renderSaveWarning(')+method(' private async retryWritingSave(')+method(' private flushFields()'),{Notice:class{constructor(text:string){notices.push(text);}}});
function saveFixture(){
 const file={path:'board.md',basename:'board'},board=emptyBoard();board.writing={title:'Draft',order:[],manuscript:'saved body',chapters:[{id:'chapter',title:'Chapter',body:'saved chapter'}]};
 const owner:any={file,board,blocked:false,status:'已保存',saveFeedback:{state:'saved',text:'已保存'},flush:async()=>{}};
 const root:any=new Element();root.ownerDocument={defaultView:{navigator:{clipboard:{writeText:async(text:string)=>{root.copied=text;}}}}};root.createDiv('ts-writing-layout');
 const input=new Input();input.value='live chapter';const actions=new Map<string,{el:Element;fn:()=>Promise<unknown>|unknown}>();
 const view=Object.assign(new SaveView(),{owner,file,generation:1,closed:false,pendingFields:new Map(),entryInputs:[input],entryDrafts:new Map([[input,{id:'chapter',custom:true,name:'Chapter',title:{value:'Live chapter title'}}]]),titleInput:{value:'Live article title'},manuscriptInput:{value:'live manuscript'},contentEl:root,containerEl:{win:{clearTimeout(){}}},app:{vault:{getAbstractFileByPath:()=>file}},state:()=>owner.board.writing,renderStatus(){view.renderSaveWarning();},action(parent:Element,label:string,fn:()=>unknown,_icon?:string,_iconOnly?:boolean,cls=''){const el=parent.createEl('button',{text:label,cls});actions.set(label,{el,fn});return el;}});
 return{view,root,input,owner,file,actions};
}
test('failed field commit keeps a persistent warning and copy reads every current writing buffer',async()=>{
 const f=saveFixture();f.view.pendingFields.set('chapterbody',()=>{throw Error('disk failure');});assert.throws(()=>f.view.flushFields(),/disk failure/);
 const warning=f.root.querySelector('.ts-writing-save-warning');assert.ok(warning);assert.equal(f.view.pendingFields.size,1);assert.equal(f.view.entryInputs[0],f.input);
 f.view.pendingFields.set('chapterbody',()=>{});f.view.flushFields();f.view.renderSaveWarning();assert.equal(f.root.querySelector('.ts-writing-save-warning'),warning,'local memory commit alone does not dismiss the disk warning');
 await f.actions.get('复制全文')!.fn();assert.match(f.root.copied,/^# Live article title/);assert.match(f.root.copied,/live manuscript/);assert.match(f.root.copied,/## Live chapter title\n\nlive chapter/);assert.doesNotMatch(f.root.copied,/saved chapter/);
 f.view.renderSaveWarning();assert.equal(f.root.querySelector('.ts-writing-save-warning'),warning,'status refresh retains the warning controls');
});
test('copy denial exposes a selected read-only snapshot without writing the board',async()=>{
 const f=saveFixture();f.owner.blocked=true;f.root.ownerDocument.defaultView.navigator.clipboard.writeText=async()=>{throw Error('denied');};f.view.renderSaveWarning();await f.actions.get('复制全文')!.fn();const details=f.root.querySelector('details'),text=f.root.querySelector('textarea');assert.equal(details.open,true);assert.equal(text.selected,true);assert.match(text.value,/live chapter/);assert.equal(f.owner.board.writing.chapters[0].body,'saved chapter');
});
test('retry waits for the verified disk acknowledgement and leaves live chapter input intact',async()=>{
 const f=saveFixture(),gate=deferred();f.owner.blocked=true;f.owner.saveFeedback={state:'error',text:'disk failed'};f.owner.retryWritingSave=async(expected:string,current:()=>boolean)=>{assert.equal(expected,JSON.stringify(f.owner.board));assert.equal(current(),true);await gate.promise;f.owner.blocked=false;f.owner.saveFeedback={state:'saved',text:'已保存'};};
 f.view.fieldError='pending chapter';f.view.saveFailure='disk failed';f.view.pendingFields.set('chapterbody',()=>{f.owner.board.writing.chapters[0].body=f.input.value;});f.view.renderSaveWarning();const warning=f.root.querySelector('.ts-writing-save-warning'),pending=f.view.retryWritingSave();assert.equal(f.root.querySelector('.ts-writing-save-warning'),warning);assert.equal(f.actions.get('重试保存')!.el.disabled,true);gate.resolve();await pending;assert.equal(f.owner.board.writing.chapters[0].body,'live chapter');assert.equal(f.root.querySelector('.ts-writing-save-warning'),null);assert.equal(f.view.entryInputs[0],f.input);assert.equal(f.view.retryingSave,false);
});
for(const state of ['blocked','saving','changed','new input'])test('retry retains warning when final acknowledgement is '+state,async()=>{
 const f=saveFixture();f.view.saveFailure='disk failed';f.owner.flush=async()=>{if(state==='blocked')f.owner.blocked=true;if(state==='saving'){f.owner.status='保存中…';f.owner.saveFeedback={state:'saving',text:'保存中…'};}if(state==='changed')f.owner.board.writing.title='peer edit';if(state==='new input')f.input.value='typed while awaiting disk';};await assert.rejects(f.view.retryWritingSave());assert.ok(f.root.querySelector('.ts-writing-save-warning'));assert.equal(f.view.entryInputs[0],f.input);
});
test('old retry completion cannot clear or alter the next owning view',async()=>{
 const f=saveFixture(),gate=deferred();f.view.saveFailure='old failure';f.owner.flush=()=>gate.promise;const pending=f.view.retryWritingSave();f.view.owner={...f.owner,board:clone(f.owner.board)};f.view.generation++;f.view.saveFailure='new owner failure';gate.resolve();await pending;assert.equal(f.view.saveFailure,'new owner failure');assert.equal(f.view.entryInputs[0],f.input);
});
test('a removed chapter still appears in the recovery snapshot from its live editor',()=>{const f=saveFixture();f.owner.board.writing.chapters=[];const snapshot=f.view.currentWritingSnapshot();assert.match(snapshot.text,/Live chapter title/);assert.match(snapshot.text,/live chapter/);assert.equal(snapshot.name,'Live article title-未保存正文');});

const EntryView=viewClass(method(' private renderEntryEditor('),{writingName,writingParts});
test('callbacks from a disposed chapter cannot queue edits or change composition in its replacement',()=>{
 const board=emptyBoard();board.writing={title:'Draft',order:[],chapters:[{id:'chapter',title:'Chapter',body:'old'}]};const input=new Input(),owner={board},pending=new Map();
 const view=Object.assign(new EntryView(),{owner,entryInputs:[],entryDrafts:new Map(),state:()=>board.writing,ensure:()=>owner,markdownInput:()=>input,queueField:(key:string,fn:unknown)=>pending.set(key,fn),flushFieldsSafely(){throw Error('stale blur');}});
 const row=new Element();view.renderEntryEditor(row,{id:'chapter',kind:'text',text:'old'},true);view.entryInputs=[];view.composing=false;input.dispatchEvent(new Event('compositionstart'));input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('compositionend'));row.querySelector('input')!.dispatchEvent(new Event('input'));assert.equal(pending.size,0);assert.equal(view.composing,false);
});

const ManuscriptView=viewClass(method(' private async openManuscript('));
test('late events from a disposed whole manuscript cannot edit or compose into another owner',async()=>{
 const input=new Input(),owner={board:{writing:{title:'Draft',manuscript:'body'}}},pending=new Map();
 const view=Object.assign(new ManuscriptView(),{owner,manuscriptRun:0,manuscriptHost:new Element(),state:()=>owner.board.writing,ensure:()=>owner,markdownInput:()=>input,queueField:(key:string,fn:unknown)=>pending.set(key,fn),refreshWritingContext(){},flushFieldsSafely(){throw Error('stale blur');}});
 await view.openManuscript();view.owner={board:{writing:{title:'New',manuscript:'new body'}}};view.composing=false;input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('compositionstart'));input.dispatchEvent(new Event('compositionend'));assert.equal(pending.size,0);assert.equal(view.composing,false);assert.equal(view.owner.board.writing.manuscript,'new body');
});

const ExportView=viewClass(method(' async generate(){','\n async onClose(){'),{clone,Notice:class{constructor(text:string){notices.push(text);}}});
function exportFixture(){
 const board=emptyBoard();board.writing={title:'Draft',order:[],manuscript:'# Original\n\nBody'};const draft={path:'ThoughtSpace/草稿/Original.md'},opened:unknown[]=[],owner:any={board,file:{basename:'Original board'},blocked:false,change(fn:any){fn(board);},flush:async()=>{}};
 const root:any=new Element();root.addClass=root.removeClass=()=>{};
 const view=Object.assign(new ExportView(),{owner,file:owner.file,generation:1,closed:false,contentEl:root,commitFields(){},ensure:()=>owner,state:()=>owner.board.writing,host:{createUnique:async()=>draft},app:{workspace:{getLeaf:()=>({openFile:async(file:unknown)=>{opened.push(file);}})}},renderStatus(){},pinNativeReference:async()=>{}});
 return{view,owner,draft,opened};
}
test('an independent Markdown export remains successful when recording its board path fails',async()=>{
 const f=exportFixture();f.owner.flush=async()=>{f.owner.blocked=true;};const result=await f.view.generate();assert.equal(result,f.draft);assert.deepEqual(f.opened,[f.draft]);assert.match(f.view.saveFailure,/独立草稿已导出/);assert.match(notices.at(-1)!,/不会自动同步/);assert.match(notices.at(-1)!,/白板保存失败/);
});
test('export completion records only its original owner and does not navigate a replacement view',async()=>{
 const f=exportFixture(),gate=deferred();f.view.host.createUnique=async()=>{await gate.promise;return f.draft;};const pending=f.view.generate();const next:any={board:{writing:{title:'Next',order:[]}},file:{basename:'Next'}};f.view.owner=next;f.view.file=next.file;f.view.generation++;gate.resolve();assert.equal(await pending,f.draft);assert.equal(f.owner.board.writing.draftPath,f.draft.path);assert.equal(next.board.writing.draftPath,undefined);assert.deepEqual(f.opened,[]);
});

test('export action and guides consistently say independent Markdown export',()=>{
 assert.match(source,/this\.action\(actions,'导出 Markdown 草稿'/);assert.match(source,/ts-writing-generate-short',text:'导出'/);assert.match(source,/不会自动同步/);assert.doesNotMatch(source,/'生成草稿'/);
 for(const file of ['docs/USER-GUIDE.zh-CN.md','docs/USER-GUIDE.md']){const guide=readFileSync(file,'utf8');assert.match(guide,/导出 Markdown 草稿/);assert.doesNotMatch(guide,/\*\*生成草稿\*\*/);}
});
