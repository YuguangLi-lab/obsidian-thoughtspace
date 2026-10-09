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
import {cleanBoardCreationPreferences} from '../src/board-creation';
import {boardTemplates} from '../src/navigation';
import {applyDefaultCardStyle} from '../src/card-style';
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
const modalSource=readFileSync('src/board-creation-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const BoardCreationModal=execute(modalSource+'\nreturn BoardCreationModal;',{Modal,Setting,View,cleanBoardCreationPreferences});
const notices:string[]=[];
const Host=execute(`class Host {${methods(['folder','createUnique','promptNewBoard','promptTemplateBoard','finishBoardCreation','rememberBoardCreation','createFromTemplate'])}};return Host;`,{...model,BoardCreationModal,cleanBoardCreationPreferences,emptyBoard:model.emptyBoard,createBrainBoard,createMarkdownBoardDocument,boardTemplates,applyDefaultCardStyle,normalizePath:(path:string)=>path.replace(/\/+/g,'/'),ROOT:'ThoughtSpace',EXT:'thoughtspace',themeSurface(){},Notice:class{constructor(message:string){notices.push(message);}}});
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function deferred(){let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(initial:unknown=null){
 const files=new Map<string,{path:string;body:string}>(),folders=new Set<string>(),opened:string[]=[],writes:any[]=[],events:string[]=[],frames=new Map<number,()=>void>();let frame=0;
 const hooks:{create?:(path:string,body:string)=>Promise<void>;open?:()=>Promise<void>;save?:()=>Promise<void>}={};
 const doc:any={activeElement:null,defaultView:{requestAnimationFrame:(run:()=>void)=>{frames.set(++frame,run);return frame;},cancelAnimationFrame:(id:number)=>frames.delete(id)}};
 const invoker:any={id:'Invoker'},target:any={id:'Created'},activations:any[]=[];new View(invoker);new View(target);
 const app:any={document:doc,invoker,active:invoker,workspace:{getActiveViewOfType:(type:any)=>app.active.view instanceof type?app.active.view:null,setActiveLeaf:(leaf:any)=>{app.active=leaf;activations.push(leaf);}},vault:{getAbstractFileByPath:(path:string)=>files.get(path)||(folders.has(path)?{path}:undefined),createFolder:async(path:string)=>{folders.add(path);},create:async(path:string,body:string)=>{events.push('create-start');await hooks.create?.(path,body);const file={path,body};files.set(path,file);events.push('create-complete');return file;}}};
 const host=new Host();Object.assign(host,{app,settings:cleanPluginSettings(initial),boardCreationStopped:false,boardCreationPreferenceQueue:Promise.resolve(),openBoard:async(file:any,_fit:boolean,current:()=>boolean=()=>true)=>{events.push('open');await hooks.open?.();if(current()){opened.push(file.path);app.active=target;}},saveData:async(settings:any)=>{events.push('save-preferences');writes.push(structuredClone(settings));await hooks.save?.();}});
 const modal=()=>modals.at(-1)!,all=()=>modal().contentEl.all() as Element[],find=(label:string)=>all().find(element=>element.attributes['aria-label']===label)!,button=(label:string)=>all().find(element=>element.tag==='button'&&element.text===label)!;
 const choice=(presentation='board',format='legacy')=>{find('白板类型').change?.(presentation);find('文件格式').change?.(format);};
 const name=(value:string)=>{find('白板名称').value=value;find('白板名称').oninput?.();};
 const decode=(file=[...files.values()].at(-1)!)=>readBoardDocument(file.body,file.path.split('.').at(-1)!,parseYaml).board;
 const fireFrame=()=>{const current=[...frames.values()];frames.clear();for(const run of current)run();};
 return{host,app,files,folders,opened,writes,events,frames,hooks,modal,all,find,button,choice,name,decode,fireFrame,activations};
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
