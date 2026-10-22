import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as hub from '../src/space-hub';
import {emptyBoard,clone,type Board,type Card} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {isHandwritingBoard} from '../src/handwriting-board';
import {planCaptureReferences} from '../src/capture-reference-placement';
import {applyDefaultCardStyle} from '../src/card-style';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';

type Options=string|{cls?:string;text?:string;attr?:Record<string,string>;value?:string;type?:string};
/** Host DOM boundary only. Delivery, chooser, close and plugin receipt methods
 * below execute the actual source; no production operation is copied here. */
class Element extends EventTarget {
 children:Element[]=[];attrs:Record<string,string>={};classes=new Set<string>();dataset:Record<string,string>={};value='';text='';hidden=false;disabled=false;checked=false;isConnected=true;scrollTop=0;
 onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;
 constructor(public ownerDocument:any,readonly tag='div',options:Options={}){super();if(typeof options==='string')options={cls:options};this.text=options.text||'';this.value=options.value||'';this.attrs={...options.attr,...(options.type?{type:options.type}:{})};for(const cls of (options.cls||'').split(/\s+/))if(cls)this.classes.add(cls);}
 createEl(tag:string,options:Options={}){const el=new Element(this.ownerDocument,tag,options);this.children.push(el);return el;}createDiv(options:Options={}){return this.createEl('div',options);}createSpan(options:Options={}){return this.createEl('span',options);}
 addClass(cls:string){this.classes.add(cls);}removeClass(cls:string){this.classes.delete(cls);}toggleClass(cls:string,on:boolean){if(on)this.addClass(cls);else this.removeClass(cls);}setAttribute(k:string,v:string){this.attrs[k]=v;}
 setText(text:string){this.empty();this.text=text;}empty(){this.children.forEach(el=>el.disconnect());this.children=[];this.text='';}disconnect(){this.isConnected=false;this.children.forEach(el=>el.disconnect());}
 appendChild(el:Element){const adopt=(node:Element)=>{node.ownerDocument=this.ownerDocument;for(const child of node.children)adopt(child);};adopt(el);this.children.push(el);return el;}
 all():Element[]{return this.children.flatMap(el=>[el,...el.all()]);}contains(el:unknown):boolean{return el===this||this.all().includes(el as Element);}querySelector(selector:string){return this.all().find(el=>selector==='input[type=search]'?el.tag==='input'&&el.attrs.type==='search':el.tag===selector)||null;}
 focus(){this.ownerDocument.activeElement=this;}click(){if(!this.disabled&&this.isConnected)this.onclick?.();}
 get textContent():string{return this.text+this.children.map(el=>el.textContent).join('');}
}
class Component {
 private disposers:Array<()=>void>=[];
 load(){}unload(){for(const dispose of this.disposers.splice(0).reverse())dispose();}registerEvent(_ref:unknown){}
 registerDomEvent(el:EventTarget,type:string,callback:EventListener,options?:boolean|AddEventListenerOptions){el.addEventListener(type,callback,options);this.disposers.push(()=>el.removeEventListener(type,callback,options));}
}
class Modal {
 containerEl:Element;modalEl:Element;contentEl:Element;titleEl:Element;closeCount=0;
 constructor(readonly app:any){this.containerEl=new Element(app.document);this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();this.titleEl=this.modalEl.createDiv();}
 open(){this.modalEl.isConnected=true;(this as unknown as {onOpen:()=>void}).onOpen();}
 close(){this.closeCount++;(this as unknown as {onClose:()=>void}).onClose();this.containerEl.disconnect();}
}
class File {extension='md';basename:string;stat={mtime:1,size:30};constructor(public path:string,readonly raw='# Native note\r\n\r\nBody exact\n'){this.basename=path.split('/').pop()!.replace(/\.md$/,'');}}
const notices:string[]=[];
const viewportBindings:{root:Element;disposed:number}[]=[];
const hubSource=readFileSync('src/space-hub-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const bindings={...hub,Modal,Component,TFile:File,Notice:class{constructor(value:string){notices.push(value);}},setIcon(){},themeSurface(){},isWorkspaceFile,getAllTags:()=>[],bindBoardModalViewport(root:Element){const binding={root,disposed:0};viewportBindings.push(binding);return()=>binding.disposed++;}};
const Hub=new Function(...Object.keys(bindings),transformSync(hubSource+'\nreturn SpaceHubModal;',{loader:'ts'}).code)(...Object.values(bindings));
const mainSource=readFileSync('src/main.ts','utf8');
function method(start:string,end:string){const a=mainSource.indexOf(start),b=mainSource.indexOf(end,a);assert.ok(a>=0&&b>a,`Missing actual method ${start}`);return mainSource.slice(a,b);}
const pluginMethods=method('  openSpaceHub(','  refreshStyleClipboard()')+method('  private validateCaptureDestination(', '  private captureDestinationPicker(');
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function tick(){for(let i=0;i<30;i++)await Promise.resolve();}
const frame=(id:string,title:string):Card=>({id,kind:'section',title,x:100,y:100,width:1200,height:2400,color:'green'});

function fixture(){
 const mainDocument={activeElement:null as unknown},document:any={activeElement:null as unknown,defaultView:{closed:false}};document.body=new Element(document,'body');const files=new Map<string,File>(),noteFiles=Array.from({length:70},(_,i)=>new File(`Notes/Note${i+1}.md`));for(const file of noteFiles)files.set(file.path,file);
 const boardFile=new File('Boards/Current.md'),otherFile=new File('Boards/Other.md');files.set(boardFile.path,boardFile);files.set(otherFile.path,otherFile);
 const app={document:mainDocument,vault:{getAbstractFileByPath:(path:string)=>files.get(path),on:()=>({})},metadataCache:{on:()=>({})}};
 let locationValid=true,leaseCleanup=0;const leases:ConvenienceNavigationLease[]=[],pickerRequests:any[]=[],flushes:any[]=[],stages:any[]=[];let flushGate:ReturnType<typeof deferred<void>>|undefined,flushFailure=false,ids=0,saveWrites=0;
 const owner=(file:File,board:Board)=>({file,board,blocked:false,nativeEditingPaused:false,edits:0,disk:JSON.stringify(board),refreshNativeEditing(){},change(edit:()=>void){this.edits++;edit();},async retryCaptureSave(stamp:string,current:()=>boolean){flushes.push({owner:this,stamp,current});assert.ok(current(),'persistence begins only in current scope');await flushGate?.promise;if(flushFailure){this.blocked=true;throw Error('disk unavailable');}this.disk=stamp;this.blocked=false;saveWrites++;}});
 const initialOwner=owner(boardFile,{...emptyBoard(),version:3,nodes:[frame('current-group','研究材料'),{...frame('locked','Locked'),x:3000,locked:true}]}),otherOwner=owner(otherFile,{...emptyBoard(),version:3,nodes:[frame('other-group','其他研究')]}),initialView={file:boardFile,session:initialOwner,closed:false,isClosing:false},otherView={file:otherFile,session:otherOwner,closed:false,isClosing:false};
 const destination={key:otherFile.path,title:otherFile.basename,pathSnapshot:otherFile.path,target:{file:otherFile,path:otherFile.path,owner:otherOwner,view:otherView},groups:[{id:'other-group',title:'其他研究'}]};
 const renders=new WeakMap<object,{footer:number;detail:number;results:number;loads:number}>();
 function HubConstructor(app:unknown,host:unknown){const modal=new Hub(app,host),trace={footer:0,detail:0,results:0,loads:0},footer=modal.renderFooter.bind(modal);renders.set(modal,trace);modal.renderFooter=()=>{trace.footer++;footer();};modal.renderNav=()=>{};modal.renderMetrics=()=>{};modal.renderDetail=()=>{trace.detail++;};modal.renderResults=()=>{trace.results++;};modal.load=async()=>{trace.loads++;};return modal;}
 const deps={SpaceHubModal:HubConstructor,TFile:File,isHandwritingBoard,isWorkspaceFile,isBoardFile:()=>false,uid:()=>`reference-${++ids}`,planCaptureReferences,applyDefaultCardStyle};
 const Plugin=new Function(...Object.keys(deps),transformSync(`class Plugin{${pluginMethods}}return Plugin;`,{loader:'ts'}).code)(...Object.values(deps)),plugin=new Plugin();
 Object.assign(plugin,{app,currentBoard:initialView,nativeBoardTransitions:new Set(),settings:{hub:hub.cleanHubPreferences(undefined),favoriteBoards:[],defaultCardWidth:280,defaultCardStyle:'paper'},journalRoot:'Journal',
  convenienceOrigin(){const lease=new ConvenienceNavigationLease(()=>locationValid,()=>leaseCleanup++);leases.push(lease);return{document,current:()=>lease.current(),watch:(invalidate:()=>void)=>lease.watch(invalidate),stop:()=>lease.stop()};},
  captureDestinationPicker(pickerDoc:unknown,current:()=>boolean){const result=deferred<any>(),picker={document:pickerDoc,current,result:result.promise,resolve:result.resolve,reject:result.reject,closes:0,deferClose:false,close(){this.closes++;if(!this.deferClose)result.resolve(undefined);}};pickerRequests.push(picker);return picker;},
  readBoard:async()=>emptyBoard(),saveData:async()=>{},openBoard:async()=>{},recordBoardVisit:async()=>{},openNoteInSidebar(){},toggleFavorite:async()=>{},quickCapture(){},promptNewBoard(){},ensureCalendar(){},openNativeRelations(){}
 });
 const stage=plugin.stageCaptureReferences.bind(plugin);plugin.stageCaptureReferences=(...args:any[])=>{const receipt=stage(...args);stages.push({args,receipt});return receipt;};
 const modal=plugin.openSpaceHub();modal.filter={...hub.defaultHubFilter,scope:'inbox',query:'论文 Material',tag:'#研究',sort:'title',includeJournals:true};modal.search.value=modal.filter.query;modal.tag.value=modal.filter.tag;modal.sort.value=modal.filter.sort;modal.journals.checked=true;modal.page=1;modal.focused=noteFiles[49].path;modal.selected=new Set([noteFiles[0].path,noteFiles[49].path]);modal.results=noteFiles.map(file=>({path:file.path,title:file.basename,mtime:1,tags:[],journal:false}));modal.main.createDiv({text:'existing selected result DOM'});modal.main.scrollTop=279;modal.renderFooter();
 const button=(label:string)=>{const b=modal.footer.all().find((el:Element)=>el.tag==='button'&&el.attrs['aria-label']===label);assert.ok(b,`Missing actual UI button ${label}`);return b;};
 const group=()=>{const select=modal.footer.all().find((el:Element)=>el.tag==='select'&&el.attrs['aria-label']==='总览目标分组');assert.ok(select);return select;};
 const uiState=()=>({selection:[...modal.selected],filter:clone(modal.filter),page:modal.page,focused:modal.focused,query:modal.search.value,tag:modal.tag.value,sort:modal.sort.value,journals:modal.journals.checked,mainChildren:modal.main.children,mainScroll:modal.main.scrollTop});
 return{plugin,modal,button,group,uiState,files,noteFiles,boardFile,otherFile,initialOwner,otherOwner,initialView,otherView,destination,document,mainDocument,pickerRequests,flushes,stages,trace:renders.get(modal)!,leases,
  failSave:(value=true)=>flushFailure=value,gateSave:()=>flushGate=deferred<void>(),counts:()=>({saveWrites,leaseCleanup}),moveAway(){locationValid=false;for(const lease of leases)lease.observe();},moveBack(){locationValid=true;},choose(){button('更换目标白板…').click();return pickerRequests.at(-1);}
 };
}

test('canceling actual board picker preserves selected notes, query, page, result DOM and selected group',async()=>{
 const f=fixture();f.group().value='current-group';f.group().onchange!();const state=f.uiState(),target=f.modal.host.target,detail=f.trace.detail,picker=f.choose();assert.equal(picker.document,f.document);assert.equal(picker.current(),true);picker.close();await tick();assert.deepEqual(f.uiState(),state);assert.equal(f.modal.host.target,target);assert.equal(f.group().value,'current-group');assert.equal(f.trace.detail,detail);assert.equal(f.stages.length,0);assert.equal(f.button('更换目标白板…').disabled,false);
});
test('choosing another board changes only target/group choices while selection and search continue',async()=>{
 const f=fixture();f.group().value='current-group';f.group().onchange!();const state=f.uiState(),picker=f.choose();picker.resolve(f.destination);await tick();assert.deepEqual(f.uiState(),state);assert.equal(f.modal.host.target.title,'Other');assert.equal(f.group().value,'');assert.deepEqual(f.group().children.map((el:Element)=>el.value),['','other-group']);assert.equal(f.trace.results,0);assert.equal(f.trace.detail,2);assert.equal(f.stages.length,0);
});
test('actual group control reaches the staging transaction and both stage/save receive the current guard',async()=>{
 const f=fixture();f.choose().resolve(f.destination);await tick();f.group().value='other-group';f.group().onchange!();const rawNotes=f.noteFiles.map(file=>file.raw);f.button('放入 2 篇笔记').click();await tick();assert.equal(f.stages.length,1);assert.equal(f.stages[0].args[1].groupId,'other-group');assert.equal(typeof f.stages[0].args[3],'function');assert.equal(f.stages[0].args[3](),true);assert.equal(f.flushes[0].current(),true);assert.equal(f.otherOwner.edits,1);assert.equal(f.initialOwner.edits,0);assert.deepEqual(f.otherOwner.board.nodes.filter(n=>n.kind==='card').map(n=>n.file),[f.noteFiles[0].path,f.noteFiles[49].path]);assert.deepEqual(f.noteFiles.map(file=>file.raw),rawNotes);assert.equal(f.modal.selected.size,0);assert.match(f.modal.state.textContent,/已放入 2 篇笔记/);
 f.modal.close();assert.equal(f.stages[0].args[3](),false);assert.equal(f.flushes[0].current(),false);
});
test('failed persistence keeps selection/filter/page and retries the same pending receipt without a second placement',async()=>{
 const f=fixture(),before=f.uiState();f.failSave();f.button('放入 2 篇笔记').click();await tick();assert.deepEqual(f.uiState(),before);assert.match(f.modal.state.textContent,/disk unavailable/);assert.equal(f.modal.busy,false);assert.equal(f.initialOwner.edits,1);assert.equal(f.stages.length,1);assert.equal(f.flushes.length,1);const receipt=f.stages[0].receipt;f.failSave(false);f.button('放入 2 篇笔记').click();await tick();assert.equal(f.stages.length,1);assert.equal(f.initialOwner.edits,1);assert.equal(f.flushes.length,2);assert.equal(f.flushes[0].stamp,receipt.stamp);assert.equal(f.flushes[1].stamp,receipt.stamp);assert.equal(f.initialOwner.board.nodes.filter(n=>n.kind==='card').length,2);assert.equal(f.counts().saveWrites,1);assert.equal(f.modal.selected.size,0);
});
test('the same notes reselected in another order retry the canonical pending receipt without a second stage',async()=>{
 const f=fixture();f.failSave();f.button('放入 2 篇笔记').click();await tick();const receipt=f.stages[0].receipt,paths=[...f.modal.selected] as string[];f.modal.selected=new Set(paths.reverse());f.modal.renderFooter();f.failSave(false);f.button('放入 2 篇笔记').click();await tick();assert.equal(f.stages.length,1);assert.equal(f.initialOwner.edits,1);assert.equal(f.flushes.length,2);assert.equal(f.flushes[1].stamp,receipt.stamp);assert.equal(f.modal.selected.size,0);assert.match(f.modal.state.textContent,/已放入 2 篇笔记/);
});
test('selecting the next page during an awaited save retains all newly selected notes that were not delivered',async()=>{
 const f=fixture(),gate=f.gateSave(),submitted=[...f.modal.selected] as string[],before=f.uiState();f.button('放入 2 篇笔记').click();f.button('选择本页').click();const newlySelected=([...f.modal.selected] as string[]).filter(path=>!submitted.includes(path));assert.equal(newlySelected.length,21);gate.resolve(undefined);await tick();assert.deepEqual([...f.modal.selected],newlySelected);assert.deepEqual(f.initialOwner.board.nodes.filter(n=>n.kind==='card').map(n=>n.file),submitted);assert.deepEqual(f.modal.filter,before.filter);assert.equal(f.modal.page,before.page);assert.equal(f.modal.search.value,before.query);assert.equal(f.stages.length,1);assert.equal(f.button('放入 21 篇笔记').disabled,false);
});
test('a failed pending receipt blocks retargeting and mismatched group/selection while preserving the original retry',async()=>{
 const f=fixture();f.failSave();f.button('放入 2 篇笔记').click();await tick();const receipt=f.stages[0].receipt;f.choose();await tick();assert.equal(f.pickerRequests.length,0);assert.match(f.modal.state.textContent,/上次投递保存/);assert.equal(f.modal.selected.size,2);
 f.group().value='current-group';f.group().onchange!();f.button('放入 2 篇笔记').click();await tick();assert.match(f.modal.state.textContent,/上次投递尚未确认保存/);assert.equal(f.stages.length,1);assert.equal(f.flushes.length,1);f.group().value='';f.group().onchange!();f.failSave(false);f.button('放入 2 篇笔记').click();await tick();assert.equal(f.flushes.at(-1)!.stamp,receipt.stamp);assert.equal(f.modal.selected.size,0);
});
test('double activation while persistence is pending cannot create a second receipt or chooser',async()=>{
 const f=fixture(),gate=f.gateSave(),button=f.button('放入 2 篇笔记');button.click();button.onclick!();f.modal.chooseTarget();assert.equal(f.stages.length,1);assert.equal(f.flushes.length,1);assert.equal(f.pickerRequests.length,0);assert.equal(f.button('放入 2 篇笔记').disabled,true);assert.equal(f.group().disabled,true);gate.resolve(undefined);await tick();assert.equal(f.initialOwner.edits,1);assert.equal(f.counts().saveWrites,1);
});
test('while choosing, delivery and repeated chooser callbacks make no writes and leave selection intact',async()=>{
 const f=fixture(),picker=f.choose(),before=f.uiState();f.modal.chooseTarget();f.button('放入 2 篇笔记').onclick!();await tick();assert.equal(f.pickerRequests.length,1);assert.equal(f.stages.length,0);assert.deepEqual(f.uiState(),before);assert.equal(f.group().disabled,true);picker.close();await tick();assert.equal(f.button('放入 2 篇笔记').disabled,false);
});
test('closed picker owner ignores late success, releases its native picker and cannot be revived by returning to origin',async()=>{
 const f=fixture(),before=f.uiState(),target=f.modal.host.target,picker=f.choose(),detail=f.trace.detail;picker.deferClose=true;f.modal.close();assert.equal(picker.closes,1);assert.equal(picker.current(),false);assert.equal(f.plugin.spaceHub,undefined);f.moveBack();picker.resolve(f.destination);await tick();assert.equal(f.modal.host.target,target);assert.deepEqual([...f.modal.selected],before.selection);assert.deepEqual(f.modal.filter,before.filter);assert.equal(f.modal.page,before.page);assert.equal(f.trace.detail,detail);assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.modal.active,false);assert.equal(f.modal.host.current(),false);assert.equal(f.stages.length,0);
});
test('navigation watch closes pending chooser monotonically; a fresh hub never receives the old result',async()=>{
 const f=fixture(),old=f.modal,picker=f.choose();picker.deferClose=true;f.moveAway();assert.equal(old.active,false);assert.equal(picker.closes,1);assert.equal(picker.current(),false);f.moveBack();const fresh=f.plugin.openSpaceHub();assert.notEqual(fresh,old);assert.equal(fresh.active,true);picker.resolve(f.destination);await tick();assert.equal(fresh.host.target.title,'Current');assert.equal(f.plugin.spaceHub,fresh);assert.equal(old.host.current(),false);assert.equal(old.contentEl.children.length,0);fresh.close();
});
test('late successful save after closing never clears selection, refreshes closed UI or returns through a stale guard',async()=>{
 const f=fixture(),before=f.uiState(),gate=f.gateSave();f.button('放入 2 篇笔记').click();const footer=f.trace.footer,loads=f.trace.loads;f.modal.close();f.moveBack();gate.resolve(undefined);await tick();assert.deepEqual([...f.modal.selected],before.selection);assert.equal(f.trace.footer,footer);assert.equal(f.trace.loads,loads);assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.flushes[0].current(),false);assert.equal(f.counts().saveWrites,1);assert.equal(f.initialOwner.edits,1);assert.equal(f.modal.active,false);
});
test('chooser rejection reports an error without discarding selection or leaving controls busy',async()=>{
 const f=fixture(),before=f.uiState(),target=f.modal.host.target;f.choose().reject(Error('picker unavailable'));await tick();assert.deepEqual(f.uiState(),before);assert.equal(f.modal.host.target,target);assert.equal(f.modal.choosingTarget,false);assert.equal(f.button('更换目标白板…').disabled,false);assert.match(f.modal.state.textContent,/picker unavailable/);assert.equal(f.stages.length,0);
});
test('closed/deleted/renamed destinations and removed/locked groups refuse staging without losing user selection',async()=>{
 const mutations=[(f:ReturnType<typeof fixture>)=>{f.initialView.closed=true;},(f:ReturnType<typeof fixture>)=>{f.files.delete(f.boardFile.path);},(f:ReturnType<typeof fixture>)=>{f.boardFile.path='Boards/Renamed.md';},(f:ReturnType<typeof fixture>)=>{f.initialOwner.board.nodes=f.initialOwner.board.nodes.filter(n=>n.id!=='current-group');},(f:ReturnType<typeof fixture>)=>{f.initialOwner.board.nodes[0].locked=true;}];
 for(const mutate of mutations){const f=fixture();f.group().value='current-group';f.group().onchange!();const before=f.uiState();mutate(f);f.button('放入 2 篇笔记').click();await tick();assert.deepEqual(f.uiState(),before);assert.equal(f.stages.length,0);assert.equal(f.flushes.length,0);assert.equal(f.initialOwner.edits,0);assert.match(f.modal.state.textContent,/目标|分组/);assert.equal(f.modal.busy,false);}
});
test('missing selected note refuses before staging and leaves cross-page selection available to correct',async()=>{
 const f=fixture(),before=f.uiState();f.files.delete(f.noteFiles[49].path);f.button('放入 2 篇笔记').click();await tick();assert.deepEqual(f.uiState(),before);assert.equal(f.stages.length,0);assert.equal(f.flushes.length,0);assert.equal(f.initialOwner.edits,0);assert.match(f.modal.state.textContent,/文件已移动或删除/);
});
test('the hub adopts its origin document, binds that container viewport and releases it once on close',()=>{
 const f=fixture(),binding=viewportBindings.at(-1)!;assert.equal(f.modal.host.document,f.document);assert.notEqual(f.document,f.mainDocument);assert.equal(f.modal.containerEl.ownerDocument,f.document);assert.equal(f.modal.search.ownerDocument,f.document);assert.ok(f.document.body.children.includes(f.modal.containerEl));assert.equal(binding.root,f.modal.containerEl);f.modal.close();assert.equal(binding.disposed,1);assert.equal(f.counts().leaseCleanup,1);f.modal.close();assert.equal(binding.disposed,1);assert.equal(f.counts().leaseCleanup,1);assert.equal(f.modal.viewport,undefined);
});
test('a closed origin document refuses opening before viewport binding or result UI creation',()=>{
 const f=fixture(),before=viewportBindings.length;let closed=0;const rejected=new Hub(f.plugin.app,{...f.modal.host,document:{defaultView:{closed:true}},current:()=>true,closed:()=>closed++});rejected.open();assert.equal(rejected.active,false);assert.equal(rejected.closeCount,1);assert.equal(rejected.contentEl.children.length,0);assert.equal(viewportBindings.length,before);assert.equal(closed,1);f.modal.close();
});

test('actual Hub lifecycle registers its modal key listener and removes it on close',()=>{
 const f=fixture(),event=new Event('keydown');let calls=0;
 f.modal.keepTabInside=(received:Event)=>{assert.equal(received,event);calls++;};
 f.modal.modalEl.dispatchEvent(event);assert.equal(calls,1);
 f.modal.close();f.modal.modalEl.dispatchEvent(event);assert.equal(calls,1);
 f.modal.close();f.modal.modalEl.dispatchEvent(event);assert.equal(calls,1);
});
