import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import ts from 'typescript';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {isWorkspaceFile} from '../src/workspace';
import {isBoardPath} from '../src/board-path';

class File {extension='md';constructor(public path:string){}}
interface Leaf {view:unknown;isDeferred:boolean;getViewState:()=>{type:string;state:{file:string}};}
interface Clock {setTimeout:(run:()=>void,delay:number)=>number;clearTimeout:(id:number)=>void;}
interface App {workspace:{containerEl:{ownerDocument:{defaultView:Clock}};getLeavesOfType:(type:string)=>Leaf[]};vault:{getAbstractFileByPath:(path:string)=>File|undefined;read:(file:File)=>Promise<string>};}
interface OwnershipApi {nativeBoardEditorStatus:(app:App,file:File)=>{open:number;pending:number};nativeBoardEditorLeaves:(app:App,file:File)=>Leaf[];hasNativeBoardEditor:(app:App,file:File)=>boolean;assertBoardEditorOwnership:(app:App,file:File)=>void;settleNativeBoardEditor:(app:App,file:File,leaf:Leaf)=>Promise<void>;
 clearNativeBoardEditorTracking:(app:App)=>void;subscribeNativeBoardEditorDrains:(app:App,callback:(file:File)=>void)=>()=>void;}

function fixture(mode='source'){
 const timers=new Map<number,{run:()=>void;delay:number}>();let nextTimer=0,saves=0,reads=0;
 const clock:Clock={setTimeout:(run,delay)=>{timers.set(++nextTimer,{run,delay});return nextTimer;},clearTimeout:id=>{timers.delete(id);}};
 const file=new File('Boards/Synthetic.md'),other=new File('Notes/Other.md'),files=new Map([[file.path,file],[other.path,other]]);
 class MarkdownView {
  file:File|null=file;saving=false;saveAgain=false;mode=mode;value='Synthetic saved Markdown';editor={getValue:()=>this.value};
  getViewData(){return this.value;}getMode(){return this.mode;}async save(){saves++;}
 }
 const view=new MarkdownView(),leaf:Leaf={view,isDeferred:false,getViewState:()=>({type:'markdown',state:{file:view.file?.path||file.path}})},leaves:Leaf[]=[leaf];
 const module={exports:{} as OwnershipApi};
 new Function('require','module','exports',transformSync(readFileSync('src/board-editor-ownership.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView}),module,module.exports);
 const app:App={workspace:{containerEl:{ownerDocument:{defaultView:clock}},getLeavesOfType:type=>type==='markdown'?leaves:[]},vault:{getAbstractFileByPath:path=>files.get(path),read:async()=>{reads++;return view.value;}}};
 const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 const advance=async()=>{
  if(!timers.size){await tick();return;}
  const delay=Math.min(...[...timers.values()].map(timer=>timer.delay)),due:Array<[number,{run:()=>void;delay:number}]>=[];
  for(const [id,timer]of timers){timer.delay-=delay;if(timer.delay<=0)due.push([id,timer]);}
  for(const [id,timer]of due)if(timers.delete(id))timer.run();await tick();
 };
 const advanceSeveral=async(count=12)=>{for(let i=0;i<count&&timers.size;i++)await advance();};
 const observe=()=>assert.equal(module.exports.hasNativeBoardEditor(app,file),true,'observe the original live view identity before closing it');
 const close=()=>{leaves.length=0;view.file=null;};
 return{api:module.exports,app,file,other,files,view,leaf,leaves,MarkdownView,timers,tick,advance,advanceSeveral,observe,close,counts:()=>({saves,reads})};
}

for(const mode of ['source','preview'])test(`a detached ${mode} native view with a pending save still owns its original Markdown file`,()=>{
 const f=fixture(mode);f.view.saving=true;f.observe();f.close();
 assert.deepEqual(f.api.nativeBoardEditorLeaves(f.app,f.file),[],'discovery returns only current leaves, not a phantom closed leaf');
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true,'a disappeared leaf does not prove its old buffer has finished writing');assert.throws(()=>f.api.assertBoardEditorOwnership(f.app,f.file),/原生|保存|Markdown/);
});

test('a saveAgain tail keeps the closed buffer protected across the false-saving phase',async()=>{
 const f=fixture(),drains:File[]=[];f.api.subscribeNativeBoardEditorDrains(f.app,file=>drains.push(file));f.view.saving=true;f.observe();f.close();
 f.view.saving=false;f.view.saveAgain=true;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);await f.advanceSeveral(3);assert.deepEqual(drains,[]);
 f.view.saving=true;f.view.saveAgain=false;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);await f.advanceSeveral(3);assert.deepEqual(drains,[]);
 f.view.saving=false;await f.advanceSeveral();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);assert.deepEqual(drains,[f.file]);assert.equal(f.timers.size,0);
});

test('reusing the same leaf for another Markdown view does not retire the old file while its old view is saving',()=>{
 const f=fixture();f.view.saving=true;f.observe();const newer=new f.MarkdownView();newer.file=f.other;f.leaf.view=newer;f.view.file=null;
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.other),true);assert.deepEqual(f.api.nativeBoardEditorLeaves(f.app,f.file),[]);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);
 f.view.saving=false;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);assert.equal(f.api.hasNativeBoardEditor(f.app,f.other),true,'the new live page remains protected');
});

test('reusing the same native view for another file does not overwrite its recorded old file identity',()=>{
 const f=fixture();f.view.saving=true;f.observe();f.view.file=f.other;
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.other),true);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);
 f.view.saving=false;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);assert.equal(f.api.hasNativeBoardEditor(f.app,f.other),true);
});

test('a tracked closing save follows the same renamed TFile identity without retaining its old path',()=>{
 const f=fixture();f.view.saving=true;f.observe();f.close();f.files.delete(f.file.path);f.file.path='Moved/Synthetic.md';f.files.set(f.file.path,f.file);
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);f.view.saving=false;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);
});

test('one drained old native view cannot release another pending old view for the same file',()=>{
 const f=fixture(),second=new f.MarkdownView(),secondLeaf:Leaf={view:second,isDeferred:false,getViewState:()=>({type:'markdown',state:{file:f.file.path}})};
 f.view.saving=true;second.saving=true;f.leaves.push(secondLeaf);f.observe();f.close();second.file=null;f.view.saving=false;
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);second.saving=false;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);
});

test('a clean closed native view releases ownership without starting a native save or reading the file',()=>{
 const f=fixture();f.observe();f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);assert.doesNotThrow(()=>f.api.assertBoardEditorOwnership(f.app,f.file));assert.deepEqual(f.counts(),{saves:0,reads:0});
});

for(const state of ['missing','accessor','wrong-type'] as const)test(`an unknown ${state} closed native saving descriptor stays protected without executing a getter`,async()=>{
 const f=fixture();let getterReads=0;f.observe();
 if(state==='missing')delete(f.view as Partial<typeof f.view>).saving;
 else if(state==='accessor')Object.defineProperty(f.view,'saving',{get:()=>{getterReads++;return false;}});
 else Object.defineProperty(f.view,'saving',{value:'false'});
 f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);await f.advanceSeveral(45);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);assert.equal(getterReads,0);assert.throws(()=>f.api.assertBoardEditorOwnership(f.app,f.file),/原生|保存|Markdown/);
});

test('an unknown closed saveAgain descriptor also stays protected',()=>{
 const f=fixture();f.observe();delete(f.view as Partial<typeof f.view>).saveAgain;f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);
});

test('closing-save drain notification arrives once for the exact file without any later workspace event',async()=>{
 const f=fixture(),drains:File[]=[];f.api.subscribeNativeBoardEditorDrains(f.app,file=>drains.push(file));f.view.saving=true;f.observe();f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);await f.advanceSeveral(3);assert.deepEqual(drains,[]);
 f.view.saving=false;await f.advanceSeveral();assert.deepEqual(drains,[f.file]);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);await f.advanceSeveral();assert.deepEqual(drains,[f.file]);assert.equal(f.timers.size,0);assert.deepEqual(f.counts(),{saves:0,reads:0});
});

test('drain callbacks still observe ownership when another live native view holds the same file',async()=>{
 const f=fixture(),ownershipAtDrain:boolean[]=[];f.api.subscribeNativeBoardEditorDrains(f.app,file=>ownershipAtDrain.push(f.api.hasNativeBoardEditor(f.app,file)));f.view.saving=true;f.observe();const newer=new f.MarkdownView();f.leaf.view=newer;f.view.file=null;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);
 f.view.saving=false;await f.advanceSeveral();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);assert(ownershipAtDrain.every(Boolean));
 f.leaves.length=0;newer.file=null;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);
});

test('a deferred page delays drain delivery until it closes and cannot orphan the already drained old file',async()=>{
 const f=fixture(),drains:File[]=[];f.api.subscribeNativeBoardEditorDrains(f.app,file=>drains.push(file));f.view.saving=true;f.observe();
 const deferred:Leaf={view:{},isDeferred:true,getViewState:()=>({type:'markdown',state:{file:f.file.path}})};f.leaves.splice(0,1,deferred);f.view.file=null;
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);f.view.saving=false;await f.advanceSeveral();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);assert.deepEqual(drains,[]);
 f.leaves.length=0;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);await f.advanceSeveral();assert.deepEqual(drains,[f.file],'the waiting file must still be reconciled after its owner map entry has been removed');
 f.api.hasNativeBoardEditor(f.app,f.file);await f.advanceSeveral();assert.deepEqual(drains,[f.file]);assert.equal(f.timers.size,0);
});

test('clearing plugin tracking cancels polling and subscriptions and releases retired host objects',async()=>{
 const f=fixture(),drains:File[]=[];f.api.subscribeNativeBoardEditorDrains(f.app,file=>drains.push(file));f.view.saving=true;f.observe();f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);assert(f.timers.size>0);
 f.api.clearNativeBoardEditorTracking(f.app);assert.equal(f.timers.size,0);f.view.saving=false;await f.advanceSeveral();assert.deepEqual(drains,[]);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);
});

test('unsubscribe suppresses drain delivery while ownership still releases safely',async()=>{
 const f=fixture(),drains:File[]=[];const unsubscribe=f.api.subscribeNativeBoardEditorDrains(f.app,file=>drains.push(file));f.view.saving=true;f.observe();f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);unsubscribe();unsubscribe();
 f.view.saving=false;await f.advanceSeveral();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);assert.deepEqual(drains,[]);assert.equal(f.timers.size,0);
});

test('explicit conversion rejects an additional retired saving native view before saving the current native page',async()=>{
 const f=fixture();f.view.saving=true;f.observe();const newer=new f.MarkdownView();f.leaf.view=newer;f.view.file=null;
 await assert.rejects(f.api.settleNativeBoardEditor(f.app,f.file,f.leaf),/其他|原生|保存|交接/);assert.deepEqual(f.counts(),{saves:0,reads:0});
});

test('explicit conversion still rejects another live native page before saving either page',async()=>{
 const f=fixture(),otherView=new f.MarkdownView();f.leaves.push({view:otherView,isDeferred:false,getViewState:()=>({type:'markdown',state:{file:f.file.path}})});
 await assert.rejects(f.api.settleNativeBoardEditor(f.app,f.file,f.leaf),/其他|多个|另一个/);assert.deepEqual(f.counts(),{saves:0,reads:0});
});

test('deferred native ownership is still discovered without loading or inspecting a nonexistent host save state',()=>{
 const f=fixture();let loaded=0;f.leaves.splice(0,1,{view:{loadIfDeferred:()=>loaded++},isDeferred:true,getViewState:()=>({type:'markdown',state:{file:f.file.path}})});
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);assert.equal(loaded,0);f.leaves.length=0;assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);
});

test('the production Session stays read-only until a closed native save drains and then reads its latest metadata before editing',async()=>{
 const f=fixture(),raw=documents.createMarkdownBoardDocument(model.emptyBoard(),'Synthetic');f.view.value=raw;
 const main=readFileSync('src/main.ts','utf8'),start=main.indexOf('class Session {'),end=main.indexOf('\nexport default class ThoughtSpace',start);
 assert(start>=0&&end>start);const parseYaml=(yaml:string)=>yaml.includes('thoughtspace: board')?{thoughtspace:'board'}:{};
 const dependencies={...model,...mindmap,...documents,...f.api,reflowReadingContent,parseYaml,EXT:'thoughtspace',Notice:class{},report:()=>{}};
 const Session=new Function(...Object.keys(dependencies),transformSync(main.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(dependencies));
 let writes=0;Object.assign(f.app.vault,{process:async(_file:File,change:(current:string)=>string)=>{writes++;f.view.value=change(f.view.value);}});
 const plugin={app:f.app,nativeBoardTransitions:new Set<File>(),createUnique:async()=>({path:'Synthetic-recovery.md'})},session=new Session(plugin,f.file,raw);
 assert.equal(session.blocked,true);f.view.saving=true;f.close();await session.externalUpdate();session.change((board:model.Board)=>board.viewport.x=200);session.persist();await session.flush();
 assert.equal(session.blocked,true);assert.equal(session.board.viewport.x,60);assert.equal(writes,0);assert.equal(f.counts().reads,0,'a still-running native buffer must not be treated as a completed fresh read');
 f.view.value=raw.replace('thoughtspace: board','thoughtspace: board\nstatus: native-save-finished');f.view.saving=false;await f.advanceSeveral();await session.externalUpdate();
 assert.equal(session.blocked,false);assert.equal(session.baseline,f.view.value);assert(session.baseline.includes('status: native-save-finished'));
 session.change((board:model.Board)=>board.viewport.x=200);await session.flush();assert.equal(writes,1);assert(f.view.value.includes('status: native-save-finished'));assert.equal(documents.readBoardDocument(f.view.value,'md',parseYaml).board.viewport.x,200);
});

function observationHost(f:ReturnType<typeof fixture>){
 const source=readFileSync('src/main.ts','utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='ThoughtSpace');assert(declaration&&ts.isClassDeclaration(declaration));
 const names=['refreshMarkdownBoardOwnership','openBoardNativeMarkdown','retryPendingBoardReferences'];
 const methods=declaration.members.filter(node=>ts.isMethodDeclaration(node)&&node.body&&names.includes(node.name.getText(ast))).map(node=>node.getText(ast)).join('\n');
 const helper=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='isBoardFile');assert(helper);
 const actStart=source.indexOf('const act ='),actEnd=source.indexOf('\nfunction button(',actStart),execute=(code:string,dependencies:Record<string,unknown>)=>new Function(...Object.keys(dependencies),transformSync(code,{loader:'ts'}).code)(...Object.values(dependencies));
 class BoardView {file?:File;session?:{flush:()=>Promise<void>;blocked:boolean};}
 const dependencies={...documents,...f.api,MarkdownView:f.MarkdownView,TFile:File,BoardView,isWorkspaceFile,isBoardPath,EXT:'thoughtspace',report:()=>{}};
 const act=execute(source.slice(actStart,actEnd)+';return act',dependencies),isBoardFile=execute(helper.getText(ast)+';return isBoardFile',dependencies);
 const Host=execute('class Host {\n'+methods+'\n};return Host',{...dependencies,act,isBoardFile}),host=new Host();
 const ready:Array<()=>unknown>=[],events=new Map<string,()=>unknown>();
 Object.assign(f.app.workspace,{onLayoutReady:(run:()=>unknown)=>ready.push(run),on:(name:string,run:()=>unknown)=>{events.set(name,run);return{name};},offref:()=>{},getMostRecentLeaf:()=>f.leaf,setActiveLeaf:()=>{}});
 Object.assign(f.app,{metadataCache:{getFileCache:(file:File)=>({frontmatter:file===f.file?{thoughtspace:'board'}:{}})}});
 Object.assign(host,{app:f.app,settings:{},sessions:new Map(),nativeBoardTransitions:new Set(),referenceQueue:Promise.resolve(),nativeReferenceRuns:new Map(),registerEvent:()=>{}});
 const onload=declaration.members.find(node=>ts.isMethodDeclaration(node)&&node.name.getText(ast)==='onload');assert(onload&&ts.isMethodDeclaration(onload)&&onload.body);
 const related=(node:ts.Node)=>{let relevant=false;const visit=(part:ts.Node)=>{if(ts.isCallExpression(part)&&ts.isPropertyAccessExpression(part.expression)&&['refreshMarkdownBoardOwnership','retryPendingBoardReferences'].includes(part.expression.name.text))relevant=true;ts.forEachChild(part,visit);};visit(node);return relevant;};
 const hookStatements=onload.body.statements.filter(statement=>related(statement)&&/\.onLayoutReady\(|workspace\.on\(/.test(statement.getText(ast)));
 execute('return function(){\n'+hookStatements.map(statement=>statement.getText(ast)).join('\n')+'\n}',{...dependencies,act,isBoardFile}).call(host);
 return{host,events,ready};
}

test('the real ownership refresh synchronously observes a native-only board before its first Session or reference journal exists',()=>{
 const f=fixture(),{host}=observationHost(f);assert.equal(host.sessions.size,0);assert.equal(host.settings.pendingBoardReferences,undefined);
 f.view.saving=true;host.refreshMarkdownBoardOwnership();f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true,'refresh must capture the native view before any queued work can yield to a close');assert.throws(()=>f.api.assertBoardEditorOwnership(f.app,f.file),/原生|保存|Markdown/);
});

for(const event of ['file-open','layout-change'])test(`the actual ${event} hook observes a native-only board before its leaf disappears`,()=>{
 const f=fixture(),{events}=observationHost(f),run=events.get(event);assert(run,`production ${event} hook is present`);f.view.saving=true;run();f.close();
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);assert.throws(()=>f.api.assertBoardEditorOwnership(f.app,f.file),/原生|保存|Markdown/);
});

test('actual layout-ready restoration observes an existing native-only board without a later file-open event',()=>{
 const f=fixture(),{ready}=observationHost(f);assert(ready.length>0,'extract the production ownership/reference layout-ready hook');f.view.saving=true;for(const run of ready)run();f.close();
 assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true,'a restored native view must be tracked even when no Board Session or pending journal exists');
});

test('native Properties opening registers the new native view before returning even when no workspace event is emitted by the host',async()=>{
 const f=fixture(),{host}=observationHost(f);f.leaves.length=0;f.leaf.view={};
 Object.assign(f.leaf,{setViewState:async(state:{type:string;state:{file:string;mode:string}})=>{assert.equal(state.type,'markdown');f.view.mode=state.state.mode;f.view.file=f.file;f.leaf.view=f.view;f.leaves.push(f.leaf);}});
 await host.openBoardNativeMarkdown(f.file,f.leaf);f.view.saving=true;f.close();assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true,'the opening entry point itself must observe the native buffer before it can close');
});


test('native save feedback counts real pages separately from retired writers and never hydrates or saves them',async()=>{
 const f=fixture();f.observe();assert.deepEqual(f.api.nativeBoardEditorStatus(f.app,f.file),{open:1,pending:0});f.view.saving=true;f.close();assert.deepEqual(f.api.nativeBoardEditorStatus(f.app,f.file),{open:0,pending:1});f.view.saving=false;await f.advanceSeveral();assert.deepEqual(f.api.nativeBoardEditorStatus(f.app,f.file),{open:0,pending:0});assert.deepEqual(f.counts(),{saves:0,reads:0});
});
test('status discovery counts deferred and other-window pages without turning them into editors',()=>{
 const f=fixture(),second={view:new f.MarkdownView(),isDeferred:false,getViewState:()=>({type:'markdown',state:{file:f.file.path}})},deferred={view:{},isDeferred:true,getViewState:()=>({type:'markdown',state:{file:f.file.path}})};f.leaves.push(second,deferred);assert.deepEqual(f.api.nativeBoardEditorStatus(f.app,f.file),{open:3,pending:0});assert.deepEqual(f.counts(),{saves:0,reads:0});f.api.clearNativeBoardEditorTracking(f.app);assert.equal(f.timers.size,0);
});

test('native status keeps unknown retired save descriptors pending without invoking their getter',()=>{
 const f=fixture();f.observe();let getters=0;Object.defineProperty(f.view,'saving',{configurable:true,get(){getters++;return false;}});f.close();assert.deepEqual(f.api.nativeBoardEditorStatus(f.app,f.file),{open:0,pending:1});assert.equal(getters,0);assert.deepEqual(f.counts(),{saves:0,reads:0});f.api.clearNativeBoardEditorTracking(f.app);assert.equal(f.timers.size,0);
});
