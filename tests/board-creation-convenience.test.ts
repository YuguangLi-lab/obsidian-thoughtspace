import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import {cleanPluginSettings} from '../src/plugin-settings';

const source=readFileSync('src/main.ts','utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function methods(names:string[]){const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='ThoughtSpace');assert(declaration&&ts.isClassDeclaration(declaration));return declaration.members.filter(node=>ts.isMethodDeclaration(node)&&names.includes(node.name.getText(ast))).map(node=>node.getText(ast)).join('\n');}
function execute(code:string,deps:Record<string,unknown>={}){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}

test('the common creation entry has its own runtime handler while explicit format commands remain available',()=>{
 const Host=execute(`class Host {${methods(['promptNewBoard'])}}; return Host;`);
 assert.equal(typeof Host.prototype.promptNewBoard,'function');
 for(const id of ['new-board','new-brain-board','new-markdown-board','new-markdown-brain-board'])assert(source.includes(`id: '${id}'`)||source.includes(`id:'${id}'`));
});
test('creation defaults round-trip both presentation and format without changing existing settings',()=>{
 const saved={boardCreation:{presentation:'brain',format:'markdown'},accent:'rose',favoriteBoards:['Boards/Keep.thoughtspace']};
 const clean=cleanPluginSettings(saved) as any;assert.deepEqual(clean.boardCreation,saved.boardCreation);assert.equal(clean.accent,'rose');assert.deepEqual(clean.favoriteBoards,saved.favoriteBoards);
});
test('space overview and material destination use the common format-aware entry',()=>{
 assert.match(methods(['openSpaceHub']),/createBoard:\(\)=>this\.promptNewBoard\(\)/);
 assert.match(methods(['materialAdapter']),/新建白板[\s\S]*this\.promptNewBoard\(\)/);
});

import * as model from '../src/model';
import {createBrainBoard,isBrainBoard} from '../src/brain-board';
import {createMarkdownBoardDocument,readBoardDocument} from '../src/board-document';
import {cleanBoardCreationPreferences,TemplateCreationIncompleteError} from '../src/board-creation';
import {boardTemplates} from '../src/navigation';
import {applyDefaultCardStyle} from '../src/card-style';
import {isBoardPath} from '../src/board-path';
import {isWorkspaceFile} from '../src/workspace';
import {SharedOpen} from '../src/view-opening';
import {createRequire} from 'node:module';
const parseYaml=createRequire(import.meta.url)('js-yaml').load;
type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string;value?:string};
class Element {
 children:Element[]=[];attributes:Record<string,string>={};value='';disabled=false;isConnected=true;text='';focused=false;selected=false;
 onclick?:()=>void;oninput?:()=>void;onkeydown?:(event:any)=>void;change?:(value:string)=>void;
 constructor(readonly tag:string,public ownerDocument:any,options:Options|string={}){const o=typeof options==='string'?{cls:options}:options;this.text=o.text||'';this.value=o.value||'';this.attributes={...o.attr};}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag,this.ownerDocument,options);this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(){}setText(text:string){this.text=text;}setAttribute(name:string,value:string){this.attributes[name]=value;}empty(){this.children=[];this.text='';}
 focus(){this.focused=true;this.ownerDocument.activeElement=this;}select(){this.selected=true;}click(){if(!this.disabled)this.onclick?.();}
 all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}
}
const modals:any[]=[];
class View {containerEl={isConnected:true};leaf:any;constructor(leaf:any){this.leaf=leaf;leaf.view=this;}}
class FileView extends View {file:any;}
class BoardView extends FileView {session:any;resumeAutomaticGeometry(){}fit(){}}
class Modal {
 containerEl:Element;modalEl:Element;contentEl:Element;titleEl:Element;closed=false;
 constructor(readonly app:any){this.containerEl=new Element('div',app.document);this.modalEl=this.containerEl.createDiv();this.titleEl=this.modalEl.createDiv();this.contentEl=this.modalEl.createDiv();}
 open(){modals.push(this);(this as any).onOpen();}close(){this.closed=true;(this as any).onClose();this.containerEl.isConnected=false;this.app.active=this.app.invoker;}
}
class Setting {
 row:Element;constructor(parent:Element){this.row=parent.createDiv();}
 setName(name:string){this.row.createDiv({text:name});return this;}
 addDropdown(make:(dropdown:any)=>void){const selectEl=this.row.createEl('select'),control:any={selectEl,
  addOption(value:string,text:string){selectEl.createEl('option',{value,text});return control;},setValue(value:string){selectEl.value=value;return control;},
  onChange(change:(value:string)=>void){selectEl.change=(value:string)=>{if(selectEl.disabled)return;selectEl.value=value;change(value);};return control;},setDisabled(value:boolean){selectEl.disabled=value;return control;}};make(control);return this;}
}
const modalSource=readFileSync(process.env.CREATION_MODAL_SOURCE||'src/board-creation-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const BoardCreationModal=execute(modalSource+'\nreturn BoardCreationModal;',{Modal,Setting,View,cleanBoardCreationPreferences,TemplateCreationIncompleteError});
const notices:string[]=[];
const Host=execute(`class Host {${methods(['folder','createUnique','promptNewBoard','promptTemplateBoard','finishBoardCreation','rememberBoardCreation','createFromTemplate','openBoard','readBoard'])}};return Host;`,{...model,BoardCreationModal,BoardView,FileView,isBoardPath,isWorkspaceFile,readBoardDocument,parseYaml,cleanBoardCreationPreferences,TemplateCreationIncompleteError,emptyBoard:model.emptyBoard,createBrainBoard,createMarkdownBoardDocument,boardTemplates,applyDefaultCardStyle,normalizePath:(path:string)=>path.replace(/\/+/g,'/'),ROOT:'ThoughtSpace',EXT:'thoughtspace',VIEW:'thoughtspace-board',themeSurface(){},Notice:class{constructor(message:string){notices.push(message);}}});
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function deferred(){let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(initial:unknown=null){
 const files=new Map<string,{path:string;body:string}>(),folders=new Set<string>(),opened:string[]=[],writes:any[]=[],events:string[]=[],frames=new Map<number,()=>void>();let frame=0;
 const hooks:{create?:(path:string,body:string)=>Promise<void>;open?:()=>Promise<void>;allocate?:boolean;save?:()=>Promise<void>}={};
 const doc:any={activeElement:null,defaultView:{requestAnimationFrame:(run:()=>void)=>{frames.set(++frame,run);return frame;},cancelAnimationFrame:(id:number)=>frames.delete(id)}};
 const invoker:any={id:'Invoker'},target:any={id:'Created'},activations:any[]=[],listeners=new Set<(leaf:any)=>void>(),fileListeners=new Set<(file:any)=>void>();new View(invoker);new View(target);invoker.view.containerEl.ownerDocument=doc;target.view.containerEl.ownerDocument=doc;
 const app:any={document:doc,invoker,target,active:invoker,workspace:{getActiveViewOfType:(type:any)=>app.active.view instanceof type?app.active.view:null,on:(name:string,run:(leaf:any)=>void)=>{(name==='file-open'?fileListeners:listeners).add(run);return run;},offref:(run:(leaf:any)=>void)=>{listeners.delete(run);fileListeners.delete(run);},setActiveLeaf:(leaf:any)=>{app.active=leaf;activations.push(leaf);}},vault:{getAbstractFileByPath:(path:string)=>files.get(path)||(folders.has(path)?{path}:undefined),createFolder:async(path:string)=>{folders.add(path);},create:async(path:string,body:string)=>{events.push('create-start');await hooks.create?.(path,body);const file={path,body,get extension(){return this.path.split('.').at(-1)!;}};files.set(path,file);events.push('create-complete');return file;}}};
 let active=invoker;Object.defineProperty(app,'active',{get:()=>active,set:(value:unknown)=>{active=value;for(const run of listeners)run(value);}});
 const host=new Host();Object.assign(host,{app,settings:cleanPluginSettings(initial),boardCreationStopped:false,boardCreationPreferenceQueue:Promise.resolve(),openBoard:async(file:any,_fit:boolean,current:()=>boolean=()=>true,_provisional=false,navigation?:any)=>{events.push('open');if(hooks.allocate){const create=()=>{app.active=target;return target;};const own=navigation?navigation.acquire(create):create();navigation?.target(own);}else navigation?.target(target);await hooks.open?.();if(current()){opened.push(file.path);target.view.file=file;app.active=target;}},saveData:async(settings:any)=>{events.push('save-preferences');writes.push(structuredClone(settings));await hooks.save?.();}});
 const modal=()=>modals.at(-1)!,all=()=>modal().contentEl.all() as Element[],find=(label:string)=>all().find(element=>element.attributes['aria-label']===label)!,button=(label:string)=>all().find(element=>element.tag==='button'&&element.text===label)!;
 const choice=(presentation='board',format='legacy')=>{find('白板类型').change?.(presentation);find('文件格式').change?.(format);};
 const name=(value:string)=>{find('白板名称').value=value;find('白板名称').oninput?.();};
 const decode=(file=[...files.values()].at(-1)!)=>readBoardDocument(file.body,file.path.split('.').at(-1)!,parseYaml).board;
 const fireFrame=()=>{const current=[...frames.values()];frames.clear();for(const run of current)run();};
 return{host,app,files,folders,opened,writes,events,frames,listeners,fileListeners,hooks,modal,all,find,button,choice,name,decode,fireFrame,activations};
}

/** Execute the actual creation -> openBoard -> readBoard methods together.
 * The boundary leaf reproduces getLeaf('tab') consuming an existing empty tab,
 * disconnecting its old view and mounting the target file in a new BoardView. */
function productionOpening(f:ReturnType<typeof fixture>,reuseOrigin=true){
 const leaf=reuseOrigin?f.app.invoker:f.app.target;leaf.type='empty';leaf.getViewState=()=>({type:leaf.type,state:leaf.view.file?{file:leaf.view.file.path}:{}});
 leaf.detach=()=>{leaf.detached=true;};leaf.setViewState=async(state:any)=>{leaf.type=state.type;leaf.view.containerEl.isConnected=false;const next=new BoardView(leaf);(next.containerEl as any).ownerDocument=f.app.document;next.file=f.files.get(state.state.file);next.session={board:await f.host.readBoard(next.file)};};
 leaf.openFile=async(file:any)=>leaf.setViewState({type:'thoughtspace-board',state:{file:file.path}});
 Object.assign(f.app.workspace,{getMostRecentLeaf:()=>f.app.active,getLeavesOfType:(type:string)=>leaf.type===type?[leaf]:[],getLeaf:()=>{f.app.active=leaf;return leaf;},revealLeaf:async()=>{}});
 Object.assign(f.app.vault,{read:async(file:any)=>file.body,cachedRead:async(file:any)=>{await f.hooks.open?.();return file.body;}});
 Object.assign(f.host,{openBoard:Host.prototype.openBoard,sessions:new Map(),boardOpening:new SharedOpen(),boardOpeningNavigation:new Set(),provisionalBoardGeometry:new WeakMap()});return leaf;
}

test('untrusted creation preference values use conservative defaults and valid fields round-trip independently',()=>{
 for(const invalid of [null,[],false,'markdown',5,{}])assert.deepEqual(cleanBoardCreationPreferences(invalid),{presentation:'board',format:'legacy'});
 for(const invalid of ['Brain','md','',[],{},false,1])assert.deepEqual(cleanBoardCreationPreferences({presentation:invalid,format:invalid}),{presentation:'board',format:'legacy'});
 assert.deepEqual(cleanBoardCreationPreferences({presentation:'brain',format:'invalid'}),{presentation:'brain',format:'legacy'});
 assert.deepEqual(cleanBoardCreationPreferences({presentation:'invalid',format:'markdown'}),{presentation:'board',format:'markdown'});
});
for(const presentation of ['board','brain'])for(const format of ['legacy','markdown'])test(`common creation ${presentation}/${format} writes the chosen codec then saves only the successful selection`,async()=>{
 const f=fixture();f.host.promptNewBoard();f.choice(presentation,format);f.name('  Shared choice  ');f.button('创建').click();await tick();
 assert.equal(f.files.size,1);assert.deepEqual(f.opened,[`ThoughtSpace/白板/Shared choice.${format==='markdown'?'md':'thoughtspace'}`]);assert.equal(isBrainBoard(f.decode()),presentation==='brain');
 assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].boardCreation,{presentation,format});assert.deepEqual(f.events,['create-start','create-complete','open','save-preferences']);assert(f.modal().closed);assert.equal(f.app.active.id,'Created');
 f.host.promptNewBoard();assert.equal(f.find('白板类型').value,presentation);assert.equal(f.find('文件格式').value,format);assert.equal(f.find('白板名称').value,presentation==='brain'?'新的脑图':'新的研究主题');f.button('取消').click();
});
test('the common modal uses native dropdowns, has one primary action and keeps naming focus after native modal autofocus',()=>{
 const f=fixture({boardCreation:{presentation:'brain',format:'markdown'}});f.host.promptNewBoard();assert.equal(f.modal().titleEl.text,'新建白板');assert.equal(f.all().filter(element=>element.tag==='select').length,2);assert.equal(f.all().filter(element=>element.tag==='button').length,2);assert.equal(f.find('白板名称').selected,true);f.find('白板名称').focused=false;f.fireFrame();assert.equal(f.find('白板名称').focused,true);assert.equal(f.writes.length,0);
});
test('cancel, blank name, IME Enter and a cancelled next-frame name focus create no files or preferences',async()=>{
 const f=fixture();f.host.promptNewBoard();f.choice('brain','markdown');f.name('   ');assert(f.button('创建').disabled);f.button('创建').click();await tick();assert.equal(f.files.size,0);
 f.name('Composition');const input=f.find('白板名称');for(const extra of [{isComposing:true},{keyCode:229},{defaultPrevented:true}])input.onkeydown!({key:'Enter',keyCode:13,isComposing:false,defaultPrevented:false,preventDefault(){},...extra});await tick();assert.equal(f.files.size,0);
 const focus=input.focused;f.button('取消').click();f.fireFrame();assert.equal(input.focused,focus);assert.equal(f.frames.size,0);assert.equal(f.files.size,0);assert.equal(f.folders.size,0);assert.equal(f.writes.length,0);assert.deepEqual(f.host.settings.boardCreation,{presentation:'board',format:'legacy'});
});
test('a double click and repeated Enter hold name and both choices while one vault create is pending',async()=>{
 const f=fixture(),gate=deferred();f.hooks.create=()=>gate.promise;f.host.promptNewBoard();f.choice('brain','markdown');f.name('Pending');const save=f.button('创建'),input=f.find('白板名称'),type=f.find('白板类型'),format=f.find('文件格式');
 save.click();save.click();input.onkeydown!({key:'Enter',defaultPrevented:false,isComposing:false,keyCode:13,preventDefault(){}});await tick();assert.equal(f.events.filter(event=>event==='create-start').length,1);assert(save.disabled&&input.disabled&&type.disabled&&format.disabled);assert.equal(f.writes.length,0);
 gate.resolve();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,1);assert.equal(f.writes.length,1);
});
test('a failed file write keeps choices and name, never writes a preference and permits one corrected retry',async()=>{
 const f=fixture();f.hooks.create=async()=>{throw Error('Synthetic vault write failure');};f.host.promptNewBoard();f.choice('brain','markdown');f.name('Retry');f.button('创建').click();await tick();
 assert.equal(f.files.size,0);assert.equal(f.writes.length,0);assert(!f.modal().closed);assert.match(f.all().find(element=>element.attributes.role==='status')!.text,/vault write failure/);assert.equal(f.find('白板名称').value,'Retry');assert.equal(f.find('文件格式').value,'markdown');assert.equal(f.find('白板类型').value,'brain');assert(!f.button('重试').disabled);
 f.hooks.create=undefined;f.button('重试').click();f.button('重试').click();await tick();assert.equal(f.files.size,1);assert.equal(f.writes.length,1);assert(f.modal().closed);
});
test('closing before the deferred submit starts cancels without creating folders',async()=>{
 const f=fixture();f.host.promptNewBoard();f.button('创建').click();f.button('取消').click();await tick();assert.equal(f.files.size,0);assert.equal(f.folders.size,0);assert.equal(f.writes.length,0);assert.equal(f.opened.length,0);
});
test('cancel during an already-started vault write preserves the completed file without late navigation or preference changes',async()=>{
 const f=fixture(),gate=deferred();f.hooks.create=()=>gate.promise;f.host.promptNewBoard();f.choice('brain','markdown');f.name('Durable cancelled');f.button('创建').click();await tick();f.button('取消').click();gate.resolve();await tick();
 assert.equal(f.files.size,1);assert(isBrainBoard(f.decode()));assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);assert.equal(f.app.active.id,'Invoker');assert.equal(f.frames.size,0);
});
test('opening another common dialog invalidates a pending old request but keeps the latest choices and result',async()=>{
 const f=fixture(),gate=deferred();f.hooks.create=()=>gate.promise;f.host.promptNewBoard();f.name('Old request');const previous=f.modal();f.button('创建').click();await tick();f.host.promptNewBoard();assert(previous.closed);f.hooks.create=undefined;f.choice('brain','markdown');f.name('Latest request');f.button('创建').click();await tick();gate.resolve();await tick();
 assert.equal(f.files.size,2);assert.deepEqual(f.opened,['ThoughtSpace/白板/Latest request.md']);assert.equal(f.writes.length,1);assert.deepEqual(f.host.settings.boardCreation,{presentation:'brain',format:'markdown'});
});
test('a created file whose opening fails closes the creation modal with an honest notice and cannot be recreated by Retry',async()=>{
 const f=fixture();f.hooks.open=async()=>{throw Error('Synthetic opening failure');};f.host.promptNewBoard();f.choice('brain','markdown');f.name('Saved but unopened');f.button('创建').click();await tick();
 assert.equal(f.files.size,1);assert(f.modal().closed);assert.equal(f.writes.length,0);assert.equal(f.opened.length,0);assert.match(notices.at(-1)!,/白板已创建.*Saved but unopened\.md.*暂未打开.*Synthetic opening failure/);assert.deepEqual(f.host.settings.boardCreation,{presentation:'board',format:'legacy'});
});
test('preference failure rolls back only its own choice after creation, preserves unrelated fields and does not expose creation Retry',async()=>{
 const f=fixture({accent:'blue'});f.hooks.save=async()=>{f.host.settings.accent='rose';throw Error('Synthetic preferences failure');};f.host.promptNewBoard();f.choice('brain','markdown');f.name('Already created');f.button('创建').click();await tick();
 assert.equal(f.files.size,1);assert.equal(f.opened.length,1);assert(f.modal().closed);assert.equal(f.writes.length,1);assert.deepEqual(f.host.settings.boardCreation,{presentation:'board',format:'legacy'});assert.equal(f.host.settings.accent,'rose');assert.match(notices.at(-1)!,/白板已创建；类型与格式偏好未保存.*Synthetic preferences failure/);
});
test('creation preference commits are serialized and recover after an older preference save fails',async()=>{
 const f=fixture(),first=deferred();let writes=0;f.hooks.save=()=>++writes===1?first.promise:Promise.resolve();const firstSave=f.host.rememberBoardCreation({presentation:'brain',format:'markdown'},()=>true),settled=Promise.allSettled([firstSave]);await tick();
 const next=f.host.rememberBoardCreation({presentation:'board',format:'markdown'},()=>true);assert.equal(f.writes.length,1);first.reject(Error('First save failure'));await settled;await next;
 assert.equal(f.writes.length,2);assert.deepEqual(f.host.settings.boardCreation,{presentation:'board',format:'markdown'});assert.deepEqual(f.writes[1].boardCreation,{presentation:'board',format:'markdown'});
});
test('an invalidated queued preference never changes defaults',async()=>{
 const f=fixture();await f.host.rememberBoardCreation({presentation:'brain',format:'markdown'},()=>false);assert.equal(f.writes.length,0);assert.deepEqual(f.host.settings.boardCreation,{presentation:'board',format:'legacy'});
});
test('plugin unload invalidates pending creation and refuses further common dialogs',async()=>{
 const f=fixture(),gate=deferred();f.hooks.create=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();f.host.boardCreationStopped=true;f.modal().close();const count=modals.length;assert.equal(f.host.promptNewBoard(),undefined);assert.equal(modals.length,count);gate.resolve();await tick();assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);
});
for(const format of ['legacy','markdown'])test(`template creation explicitly selects ${format}, preserving all four source files, node IDs and relationships`,async()=>{
 const f=fixture({boardCreation:{presentation:'brain',format}});let closed=0;const template=boardTemplates[0];f.host.promptTemplateBoard(template.id,'Template board',()=>closed++);assert.equal(f.all().filter(element=>element.tag==='select').length,1);assert.equal(f.find('文件格式').value,format);assert.equal(f.find('白板名称').value,'Template board');f.button('创建').click();await tick();
 assert.equal(f.files.size,5);assert.equal(f.opened.length,1);const board=f.decode();assert.equal(board.nodes.length,4);assert.equal(board.edges.length,2);assert.equal(new Set(board.nodes.map(node=>node.id)).size,4);assert(board.edges.every(edge=>board.nodes.some(node=>node.id===edge.from)&&board.nodes.some(node=>node.id===edge.to)));assert(board.nodes.every(node=>node.file&&f.files.has(node.file)));assert(!isBrainBoard(board));assert.equal(closed,1);assert.deepEqual(f.host.settings.boardCreation,{presentation:'brain',format});
});
test('legacy direct template callers remain legacy even when common creation remembers Markdown',async()=>{
 const f=fixture({boardCreation:{presentation:'brain',format:'markdown'}});const file=await f.host.createFromTemplate(boardTemplates[0].id,'Explicit legacy');assert.match(file.path,/\.thoughtspace$/);assert.equal(f.writes.length,0);assert.equal(f.opened.length,1);
});
test('template cancellation and unknown template never save a preference or create files',async()=>{
 const f=fixture();f.host.promptTemplateBoard(boardTemplates[0].id,'Cancelled');f.find('文件格式').change?.('markdown');f.button('取消').click();await tick();assert.equal(f.files.size,0);assert.equal(f.writes.length,0);await assert.rejects(f.host.createFromTemplate('not-a-template','Bad'),/未知白板模板/);assert.equal(f.files.size,0);
});

test('a newer navigation during the actual opening await wins without late focus or preference persistence',async()=>{
 const f=fixture(),gate=deferred();f.hooks.open=()=>gate.promise;f.host.promptNewBoard();f.name('Saved during navigation');f.button('创建').click();await tick();
 const other:any={id:'Newer navigation'};new View(other);f.app.active=other;gate.resolve();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);assert.equal(f.app.active,other);assert.equal(f.activations.length,0);
});
test('changing the originating view file during a create await invalidates the request even without an active-leaf event',async()=>{
 const f=fixture(),gate=deferred(),original={path:'Source.md'};f.app.invoker.view.file=original;f.hooks.create=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();f.app.invoker.view.file={path:'Other.md'};gate.resolve();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);
});
test('a partially created template does not let Retry duplicate its already completed native files',async()=>{
 const f=fixture();let calls=0;f.hooks.create=async()=>{if(++calls===3)throw Error('Third template file fails');};f.host.promptTemplateBoard(boardTemplates[0].id,'Partial template');f.button('创建').click();await tick();assert.equal(f.files.size,2);assert.equal(f.writes.length,0);
 f.hooks.create=undefined;const save=f.all().find(element=>element.tag==='button'&&element.text!=='取消')!;assert(save.disabled);save.click();await tick();assert.equal(f.files.size,2);assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);const status=f.all().find(element=>element.attributes.role==='status')!.text;for(const path of f.files.keys())assert(status.includes(path));
});

test('leaving then returning to the original leaf still invalidates a pending creation and unregisters navigation on close',async()=>{
 const f=fixture(),gate=deferred();f.hooks.create=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();const other:any={id:'Other'};new View(other);f.app.active=other;f.app.active=f.app.invoker;gate.resolve();await tick();assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);assert.equal(f.listeners.size,1);f.button('取消').click();assert.equal(f.listeners.size,0);
});
for(const replacement of ['file-identity','file-rename','session','window','detached'] as const)test(`origin ${replacement} change cancels pending creation without late navigation`,async()=>{
 const f=fixture(),gate=deferred(),file={path:'Origin.md'};f.app.invoker.view.file=file;f.app.invoker.view.session={id:'owner'};f.hooks.create=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();
 if(replacement==='file-identity')f.app.invoker.view.file={path:file.path};else if(replacement==='file-rename')file.path='Moved.md';else if(replacement==='session')f.app.invoker.view.session={id:'new owner'};else if(replacement==='window')f.app.invoker.view.containerEl.ownerDocument={defaultView:{}};else f.app.invoker.view.containerEl.isConnected=false;
 gate.resolve();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);
});
test('a template failure before any completed write remains safely retryable',async()=>{
 const f=fixture();f.hooks.create=async()=>{throw Error('First file fails');};f.host.promptTemplateBoard(boardTemplates[0].id,'Retry empty');f.button('创建').click();await tick();assert.equal(f.files.size,0);assert(!f.button('重试').disabled);f.hooks.create=undefined;f.button('重试').click();await tick();assert.equal(f.files.size,5);assert.equal(f.writes.length,1);
});
test('a template board-file failure lists its completed cards and cannot automatically rerun them',async()=>{
 const f=fixture();let calls=0;f.hooks.create=async()=>{if(++calls===5)throw Error('Board file fails');};f.host.promptTemplateBoard(boardTemplates[0].id,'Completed cards');f.button('创建').click();await tick();assert.equal(f.files.size,4);assert(f.button('创建已停止').disabled);const status=f.all().find(element=>element.attributes.role==='status')!.text;for(const file of f.files.values())assert(status.includes(file.path));assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);
});
test('after completed creation, a preference write already submitted to the host may finish after Cancel and does not create a second file',async()=>{
 const f=fixture(),gate=deferred();f.hooks.save=()=>gate.promise;f.host.promptNewBoard();f.choice('brain','markdown');f.button('创建').click();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,1);assert.equal(f.writes.length,1);f.button('取消').click();gate.resolve();await tick();assert.equal(f.files.size,1);assert.deepEqual(f.host.settings.boardCreation,{presentation:'brain',format:'markdown'});assert.equal(f.activations.length,0);
});

test('the host activating its own newly allocated empty leaf preserves the approved creation through file mounting',async()=>{
 const f=fixture();f.hooks.allocate=true;f.host.promptNewBoard();f.choice('brain','markdown');f.button('创建').click();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,1);assert.equal(f.writes.length,1);assert.equal(f.app.active.id,'Created');assert(f.modal().closed);
});

test('a different empty leaf during own allocation or file mounting cancels creation rather than sharing a broad empty-leaf allowance',async()=>{
 const f=fixture(),gate=deferred();f.hooks.allocate=true;f.hooks.open=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();const other:any={id:'Other empty'};new View(other);other.view.containerEl.ownerDocument=f.app.document;f.app.active=other;gate.resolve();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);assert.equal(f.app.active,other);
});
test('a same-file page on a different leaf is newer navigation and cannot acquire the creation request',async()=>{
 const f=fixture(),gate=deferred();f.hooks.allocate=true;f.hooks.open=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();const other:any={id:'Other same file'};new View(other);other.view.containerEl.ownerDocument=f.app.document;other.view.file=[...f.files.values()][0];f.app.active=other;gate.resolve();await tick();assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);assert.equal(f.app.active,other);
});

test('after own empty-leaf activation, returning to the origin is newer navigation and cannot resurrect the held creation',async()=>{
 const f=fixture(),gate=deferred();f.hooks.allocate=true;f.hooks.open=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();f.app.active=f.app.invoker;gate.resolve();await tick();assert.equal(f.files.size,1);assert.equal(f.opened.length,0);assert.equal(f.writes.length,0);assert.equal(f.app.active,f.app.invoker);
});

for(const format of ['legacy','markdown'])test(`actual ${format} opening may consume the origin empty view only for its exact requested file`,async()=>{
 const f=fixture(),leaf=productionOpening(f),origin=leaf.view;f.host.promptNewBoard();f.choice('brain',format);f.button('创建').click();await tick();await tick();assert.equal(f.files.size,1);assert.notEqual(leaf.view,origin);assert.equal(origin.containerEl.isConnected,false);assert.equal(leaf.view.file,[...f.files.values()][0]);assert.equal(f.app.active,leaf);assert(f.modal().closed);assert.equal(f.writes.length,1);assert.deepEqual(f.host.settings.boardCreation,{presentation:'brain',format});
});

test('actual origin-leaf reuse still cancels a newer same-leaf file while the board read waits',async()=>{
 const f=fixture(),leaf=productionOpening(f),gate=deferred();f.hooks.open=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();const other={path:'Newer.md'};leaf.view.file=other;f.app.active=leaf;gate.resolve();await tick();assert.equal(f.files.size,1);assert.equal(leaf.view.file,other);assert.equal(f.writes.length,0);assert(!f.modal().closed);
});

test('a user replacing the reused origin with a different empty view is not the approved file mount',async()=>{
 const f=fixture(),leaf=productionOpening(f),gate=deferred();f.hooks.open=()=>gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();leaf.view.containerEl.isConnected=false;const other=new View(leaf);(other.containerEl as any).ownerDocument=f.app.document;f.app.active=leaf;gate.resolve();await tick();assert.equal(leaf.view,other);assert.equal(f.writes.length,0);assert(!f.modal().closed);
});

test('after own origin consumption, same-leaf file navigation away and back permanently cancels queued preference persistence',async()=>{
 const f=fixture(),leaf=productionOpening(f),gate=deferred();f.host.boardCreationPreferenceQueue=gate.promise;f.host.promptNewBoard();f.button('创建').click();await tick();await tick();const created=leaf.view.file;assert.equal(created,[...f.files.values()][0]);leaf.view.file={path:'Newer.md'};for(const run of f.fileListeners)run(leaf.view.file);leaf.view.file=created;for(const run of f.fileListeners)run(created);gate.resolve();await tick();await tick();assert.equal(f.writes.length,0);assert.equal(f.app.active,leaf);f.button('取消').click();assert.equal(f.listeners.size,0);assert.equal(f.fileListeners.size,0);
});
