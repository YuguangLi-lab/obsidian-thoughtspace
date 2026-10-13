import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as documents from '../src/board-document';
import * as mindmap from '../src/mindmap';
import * as geometry from '../src/relation-geometry-checkpoint';
import * as brain from '../src/brain-board';
import * as state from '../src/board-mindmap';
import * as positions from '../src/brain-reading-positions';
import {brainPositionLink,boardLink,parseBoardLink} from '../src/deeplinks';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {supportsLocalRelations} from '../src/local-relations';
import {isBoardPath} from '../src/board-path';
import {isWorkspaceFile} from '../src/workspace';
import {SharedOpen} from '../src/view-opening';

// Execute the production Session, manager controller, navigation lease, codec,
// board opener and protocol router. Native windows/Modals/Vault are boundaries;
// no product source is rewritten or regular-expression implementation asserted.
const source=readFileSync('src/main.ts','utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function declaration(name:string){const node=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===name);assert(node&&ts.isClassDeclaration(node));return node;}
function methods(name:string,names:string[]){return declaration(name).members.filter(node=>ts.isMethodDeclaration(node)&&node.body&&names.includes(node.name.getText(ast))).map(node=>node.getText(ast)).join('\n');}
const parseYaml=createRequire(import.meta.url)('js-yaml').load,VIEW='thoughtspace-board',EXT='thoughtspace';
class TFile {stat={mtime:1,size:100,ctime:1};parent={path:'Boards'};constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}}
class View {leaf:any;containerEl:any;}
class FileView extends View {constructor(public file:TFile){super();}}
class MarkdownView extends FileView {}
class BrainReadingPositionsModal {
 static opened:BrainReadingPositionsModal[]=[];modalEl={isConnected:false};closed=0;
 constructor(_app:unknown,readonly host:any){BrainReadingPositionsModal.opened.push(this);}open(){this.modalEl.isConnected=true;}onClose(){}close(){this.closed++;this.modalEl.isConnected=false;this.onClose();}
}
function gate(){let release!:()=>void,enter!:()=>void;return{wait:new Promise<void>(resolve=>release=resolve),started:new Promise<void>(resolve=>enter=resolve),release:()=>release(),enter:()=>enter()};}
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function compile(code:string,dependencies:Record<string,unknown>){return new Function(...Object.keys(dependencies),transformSync(code,{loader:'ts'}).code)(...Object.values(dependencies));}
function board():model.Board {
 const value: model.Board={...brain.createBrainBoard('a'),brainViewport:{x:10.125,y:-8.5,zoom:.72},nodes:['a','b','c'].map((id,index)=>({id,kind:'card',file:`Notes/${id}.md`,title:'标题 '+id,x:index*350,y:index*80,width:300,height:200,color:'slate'})),edges:[{id:'ab',from:'a',to:'b',label:'关系',kind:'branch'},{id:'bc',from:'b',to:'c',label:'关系',kind:'branch'}]};
 positions.addBrainReadingPosition(value,'p-b','证据 B',{version:1,centerId:'b',expandedIds:['b'],depth:3,viewport:{x:44.125,y:-30.25,zoom:.37}});positions.addBrainReadingPosition(value,'p-c','证据 C',{version:1,centerId:'c',expandedIds:['a','c'],depth:5,viewport:{x:-255.25,y:178.125,zoom:1.25}});return value;
}
function fixture(format='thoughtspace',existing=true){
 const notices:string[]=[],errors:unknown[]=[],copies:string[]=[],files=new Map<string,TFile>(),disk=new Map<TFile,string>(),leaves:any[]=[],events:any[][]=[],listeners=new Map<string,Set<(...args:any[])=>void>>(),windowEvents=new Map<string,Set<()=>void>>();let active:any,nativeBusy=false,writes=0;
 const win={closed:false,navigator:{clipboard:{writeText:async(value:string)=>{copies.push(value);}}},requestAnimationFrame:(fn:()=>void)=>fn(),addEventListener:(name:string,run:()=>void)=>{let set=windowEvents.get(name);if(!set){set=new Set();windowEvents.set(name,set);}set.add(run);},removeEventListener:(name:string,run:()=>void)=>windowEvents.get(name)?.delete(run)},doc={defaultView:win,hasFocus:()=>true};
 const Notice=class{constructor(message:string){notices.push(message);}};
 const common={...model,...documents,...mindmap,...geometry,...brain,...state,...positions,ConvenienceNavigationLease,brainPositionLink,parseBoardLink,isBoardPath,isWorkspaceFile,parseYaml,TFile,VIEW,EXT,View,FileView,MarkdownView,BrainReadingPositionsModal,Notice,window:globalThis,reflowReadingContent,report:(error:unknown)=>errors.push(error),hasNativeBoardEditor:()=>nativeBusy,assertBoardEditorOwnership:()=>{if(nativeBusy)throw Error('原生页面尚未保存');}};
 const Session=compile(declaration('Session').getText(ast)+';return Session;',common);
 const BoardView=compile(`return class BoardView extends FileView {closed=false;closing=false;get isClosing(){return this.closing;} ${methods('BoardView',['requireOwner','captureConvenienceLocation','restoreConvenienceLocation','restoreBrainReadingPosition','openBrainReadingPositions','revealNode'])}}`,{...common,supportsLocalRelations});
 const Host=compile(`return class Host {${methods('ThoughtSpace',['convenienceOrigin','openDeepLink','openBoard','readBoard'])}}`,{...common,BoardView});const host=new Host();
 const emit=(name:string,...args:any[])=>{for(const run of [...listeners.get(name)||[]])run(...args);};
 const put=(path:string,raw:string)=>{const file=new TFile(path);files.set(path,file);disk.set(file,raw);return file;};
 const workspace={containerEl:{ownerDocument:doc},get activeLeaf(){return active;},getMostRecentLeaf:()=>active,getLeavesOfType:(type:string)=>leaves.filter(leaf=>leaf.type===type),getActiveViewOfType:(Type:any)=>active?.view instanceof Type?active.view:null,
  getLeaf:()=>{const leaf=makeLeaf();workspace.setActiveLeaf(leaf);return leaf;},revealLeaf:async()=>{},setActiveLeaf:(leaf:any)=>{active=leaf;events.push(['focus',leaf]);emit('active-leaf-change',leaf);},trigger:()=>{},
  on:(name:string,run:(...args:any[])=>void)=>{let set=listeners.get(name);if(!set){set=new Set();listeners.set(name,set);}set.add(run);return{name,run};},offref:(ref:{name:string;run:(...args:any[])=>void})=>listeners.get(ref.name)?.delete(ref.run)};
 const app:any={workspace,vault:{getName:()=> 'Reading Test',getAbstractFileByPath:(path:string)=>files.get(path),read:async(file:TFile)=>disk.get(file)!,cachedRead:async(file:TFile)=>disk.get(file)!,process:async(file:TFile,change:(raw:string)=>string)=>{disk.set(file,change(disk.get(file)!));writes++;}}};
 Object.assign(host,{app,sessions:new Map(),boardOpening:new SharedOpen(),boardOpeningNavigation:new Set(),provisionalBoardGeometry:new WeakMap(),createUnique:async(folder:string,name:string,extension:string,raw:string)=>put(`${folder}/${name}.${extension}`,raw)});
 function attach(leaf:any,file:TFile){
  const view=new BoardView(file),session=new Session(host,file,disk.get(file)!);Object.assign(view,{app,plugin:host,session,leaf,selected:new Set(['a']),contentEl:{ownerDocument:doc,isConnected:true},containerEl:{ownerDocument:doc,isConnected:true},revealCalls:[],prepareVideoBridge:async()=>{},resumeAutomaticGeometry(){},clearCanvasGesture(){},updateSelection(){},transform(){}});
  view.brainBoardView={prepares:0,captureReadingPosition:()=>positions.captureBrainReadingPosition(session.board,session.board.brainViewport??{x:0,y:0,zoom:1}),prepareReadingPositionRestore(){this.prepares++;},revealRelation(){},focusNode(id:string){view.revealCalls.push(id);}};leaf.view=view;return view;
 }
 function makeLeaf(type='empty',file?:TFile){const leaf:any={type,isDeferred:false,state:{type,state:file?{file:file.path}:{}},view:new View(),getViewState:()=>leaf.state,loadIfDeferred:async()=>{},detach:()=>{leaves.splice(leaves.indexOf(leaf),1);if(active===leaf)workspace.setActiveLeaf(leaves.at(-1));},
  setViewState:async(next:any)=>{leaf.type=next.type;leaf.state=next;const file=files.get(next.state.file)!;leaf.view=next.type===VIEW?attach(leaf,file):new MarkdownView(file);leaf.view.leaf=leaf;leaf.view.containerEl={ownerDocument:doc,isConnected:true};emit('file-open',file);},openFile:async(file:TFile)=>leaf.setViewState({type:file.extension===EXT?VIEW:'markdown',state:{file:file.path}})};
  if(file)leaf.view=type===VIEW?attach(leaf,file):new MarkdownView(file);leaf.view.leaf=leaf;leaf.view.containerEl??={ownerDocument:doc,isConnected:true};leaves.push(leaf);return leaf;
 }
 const initial=board(),raw=format==='md'?documents.createMarkdownBoardDocument(initial,'脑图').replace('thoughtspace: board','thoughtspace: board\ncustom-native: 保留\nlist: [one, two]')+'\n原生正文 **完整保留**\n':JSON.stringify(initial);
 const file=put('Boards/Brain.'+format,raw),target=existing?makeLeaf(VIEW,file):undefined,origin=makeLeaf('markdown',put('Notes/Origin.md','# Origin\n'));active=target??origin;
 const nodeParams=(id?:string)=>Object.fromEntries(new URL(boardLink('Reading Test',file.path,id)).searchParams),positionParams=(id='p-b')=>Object.fromEntries(new URL(brainPositionLink('Reading Test',file.path,id)).searchParams);
 const clean=()=>{assert([...listeners.values()].every(set=>set.size===0));assert([...windowEvents.values()].every(set=>set.size===0));assert.equal(host.boardOpeningNavigation.size,0);assert.equal(host.deepLinkOpening,undefined);};
 return{host,app,Session,BoardView,file,target,origin,doc,win,files,disk,put,makeLeaf,attach,emit,events,notices,errors,copies,nodeParams,positionParams,clean,raw,writes:()=>writes,setNativeBusy:(value:boolean)=>nativeBusy=value,active:()=>active,setActive:(leaf:any)=>workspace.setActiveLeaf(leaf),closeWindow:()=>{win.closed=true;for(const run of [...windowEvents.get('unload')||[]])run();}};
}

test('root manager keeps the first departure across sequential positions and restores once through actual Session history',async()=>{
 const f=fixture(),view=f.target.view,owner=view.session,origin=positions.captureBrainReadingPosition(owner.board,owner.board.brainViewport),before=model.clone(owner.board),first=view.openBrainReadingPositions();
 await first.host.restore('p-b',positions.brainReadingPositionStamp(owner.board.brainReadingPositions[0]),()=>true);first.close();assert.equal(owner.history.undoStack.length,1);assert.deepEqual(view.brainReadingReturn.state,origin);assert.equal(owner.board.brain.centerId,'b');
 const second=view.openBrainReadingPositions();await second.host.restore('p-c',positions.brainReadingPositionStamp(owner.board.brainReadingPositions[1]),()=>true);second.close();assert.equal(owner.history.undoStack.length,2);assert.deepEqual(view.brainReadingReturn.state,origin);assert.equal(owner.board.brain.centerId,'c');
 const back=view.openBrainReadingPositions();assert(back.host.canReturn());await back.host.returnOrigin(()=>true);back.close();assert.equal(owner.history.undoStack.length,3);assert.deepEqual(positions.captureBrainReadingPosition(owner.board,owner.board.brainViewport),origin);assert.deepEqual(owner.board.nodes,before.nodes);assert.deepEqual(owner.board.edges,before.edges);assert.deepEqual(owner.board.brain.history.entries,['a','b','c','a']);owner.undo();assert.equal(owner.board.brain.centerId,'c');await owner.flush();f.clean();
});
for(const format of ['md','thoughtspace'])test(`root save/rename/remove writes one transaction per action and preserves native ${format} source`,async()=>{
 const f=fixture(format),view=f.target.view,owner=view.session,modal=view.openBrainReadingPositions(),before=model.clone(owner.board),initialDocument=documents.readBoardDocument(f.raw,format,parseYaml);
 await modal.host.commit((board:model.Board)=>positions.addBrainReadingPosition(board,'new','新位置',positions.captureBrainReadingPosition(board,board.brainViewport!)),()=>true);assert.equal(owner.history.undoStack.length,1);
 await modal.host.commit((board:model.Board)=>positions.renameBrainReadingPosition(board,'new','重命名',positions.brainReadingPositionStamp(board.brainReadingPositions!.at(-1)!)),()=>true);assert.equal(owner.history.undoStack.length,2);
 await modal.host.copyLink('new',()=>true);assert.equal(owner.history.undoStack.length,2);assert.deepEqual(parseBoardLink(Object.fromEntries(new URL(f.copies[0]).searchParams),'Reading Test'),{file:f.file.path,readingPosition:'new'});
 await modal.host.commit((board:model.Board)=>positions.removeBrainReadingPosition(board,'new'),()=>true);assert.equal(owner.history.undoStack.length,3);assert.deepEqual(owner.board,before);const saved=documents.readBoardDocument(f.disk.get(f.file)!,format,parseYaml);assert.deepEqual(saved.board,before);
 if(format==='md'){assert.equal(saved.source.slice(0,saved.layoutStart),initialDocument.source.slice(0,initialDocument.layoutStart));assert.equal(saved.source.slice(saved.layoutEnd),initialDocument.source.slice(initialDocument.layoutEnd));}
 modal.close();assert.equal(f.errors.length,0);f.clean();
});
for(const change of ['away-return','rename','owner','window','readonly'])test(`root manager refuses ${change} before mutation`,async()=>{
 const f=fixture('md'),view=f.target.view,owner=view.session,modal=view.openBrainReadingPositions(),before=model.clone(owner.board);
 if(change==='away-return'){f.setActive(f.origin);f.setActive(f.target);}if(change==='rename'){f.file.path='Boards/Renamed.md';f.emit('file-open',f.file);}if(change==='owner'){view.session={};f.emit('file-open',f.file);}if(change==='window')f.closeWindow();if(change==='readonly')f.setNativeBusy(true);
 await assert.rejects(modal.host.commit((board:model.Board)=>positions.renameBrainReadingPosition(board,'p-b','拒绝'),()=>true));assert.deepEqual(owner.board,before);assert.equal(owner.history.undoStack.length,0);modal.close();for(const stop of [...f.host.boardOpeningNavigation])stop();f.clean();
});
test('root manager respects a closed modal current callback and stale named revision',async()=>{
 const f=fixture(),view=f.target.view,owner=view.session,modal=view.openBrainReadingPositions(),before=model.clone(owner.board);await assert.rejects(modal.host.restore('p-b','stale',()=>true),/已变化/);assert.deepEqual(owner.board,before);assert.equal(owner.history.undoStack.length,0);
 assert.equal(view.brainReadingReturn,undefined,'a rejected revision must not start a return journey');await assert.rejects(modal.host.restore('missing','missing',()=>true),/变化|移除/);assert.equal(view.brainReadingReturn,undefined);
 await assert.rejects(modal.host.commit((board:model.Board)=>positions.removeBrainReadingPosition(board,'p-b'),()=>false),/取消/);assert.deepEqual(owner.board,before);modal.close();view.brainReadingReturn?.scope.stop();f.clean();
});
test('root commit rechecks navigation inside the actual Session transaction after native ownership refresh',async()=>{
 const f=fixture('md'),view=f.target.view,owner=view.session,modal=view.openBrainReadingPositions(),before=model.clone(owner.board);let reads=0;f.host.nativeBoardEditorStatus=()=>{if(++reads===2)f.setActive(f.origin);return{open:0,pending:0};};
 await assert.rejects(modal.host.commit((board:model.Board)=>positions.renameBrainReadingPosition(board,'p-b','不得迟到修改'),()=>true),/取消/);assert(reads>=2);assert.deepEqual(owner.board,before);assert.equal(owner.history.undoStack.length,0);modal.close();f.clean();
});
test('an old return continuation cannot clear a new journey created while its disk flush is pending',async()=>{
 const f=fixture(),view=f.target.view,owner=view.session,first=view.openBrainReadingPositions();await first.host.restore('p-b',positions.brainReadingPositionStamp(owner.board.brainReadingPositions[0]),()=>true);first.close();const back=view.openBrainReadingPositions(),hold=gate(),process=f.app.vault.process;
 f.app.vault.process=async(file:TFile,edit:(raw:string)=>string)=>{if(file===f.file){hold.enter();await hold.wait;}return process(file,edit);};const pending=back.host.returnOrigin(()=>true),settled=Promise.allSettled([pending]);await hold.started;
 const nextFile=f.put('Boards/Next.thoughtspace',JSON.stringify(board())),nextOwner=new f.Session(f.host,nextFile,f.disk.get(nextFile)!);view.session=nextOwner;view.file=nextFile;view.brainBoardView={captureReadingPosition:()=>positions.captureBrainReadingPosition(nextOwner.board,nextOwner.board.brainViewport),prepareReadingPositionRestore(){}};f.target.state={type:VIEW,state:{file:nextFile.path}};f.emit('file-open',nextFile);back.close();
 const next=view.openBrainReadingPositions();await next.host.restore('p-c',positions.brainReadingPositionStamp(nextOwner.board.brainReadingPositions[1]),()=>true);next.close();const newer=view.brainReadingReturn;assert(newer&&newer.owner===nextOwner);hold.release();await settled;assert.equal(view.brainReadingReturn,newer,'old continuation must not erase a newer departure');newer.scope.stop();view.brainReadingReturn=undefined;await owner.flush();f.clean();
});

for(const [first,latest]of [['position','node'],['node','position'],['position','other-position']] as const)test(`same-file link ${first} to ${latest} resolves only the latest target after the shared frame`,async()=>{
 const f=fixture(),hold=gate(),frames:Array<()=>void>=[];f.setActive(f.origin);f.win.requestAnimationFrame=(fn:()=>void)=>{frames.push(fn);hold.enter();};
 const older=f.host.openDeepLink(first==='node'?f.nodeParams('b'):f.positionParams('p-b'));await hold.started;const newer=f.host.openDeepLink(latest==='node'?f.nodeParams('c'):f.positionParams(latest==='other-position'?'p-c':'p-b'));await settle();assert.equal(frames.length,1);frames[0]();await Promise.all([older,newer]);const view=f.target.view;
 assert.equal(view.session.board.brain.centerId,latest==='node'||latest==='other-position'?'c':'b');assert.equal(view.revealCalls.length,latest==='node'?1:0);assert.equal(view.session.history.undoStack.length,1);if(latest!=='node')assert.deepEqual(view.session.board.brainViewport,latest==='other-position'?{x:-255.25,y:178.125,zoom:1.25}:{x:44.125,y:-30.25,zoom:.37});await view.session.flush();f.clean();
});
for(const change of ['away-return','window-unload','owner-replaced','closing','new-file'])test(`reading-position link cancels safely at frame for ${change}`,async()=>{
 const f=fixture(),hold=gate(),frames:Array<()=>void>=[];f.setActive(f.origin);f.win.requestAnimationFrame=(fn:()=>void)=>{frames.push(fn);hold.enter();};const work=f.host.openDeepLink(f.positionParams());await hold.started;const view=f.target.view,owner=view.session,before=model.clone(owner.board);
 if(change==='away-return'){f.setActive(f.origin);f.setActive(f.target);}if(change==='window-unload')f.closeWindow();if(change==='owner-replaced'){view.session={...owner};f.emit('file-open',f.file);}if(change==='closing'){view.closing=true;f.emit('file-open',f.file);}if(change==='new-file'){const latest=f.put('Boards/New.thoughtspace',JSON.stringify(board())),request=Object.fromEntries(new URL(boardLink('Reading Test',latest.path,'c')).searchParams),newer=f.host.openDeepLink(request);await settle();assert.equal(frames.length,2);frames[1]();await newer;}
 const completed=await Promise.race([work.then(()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),100))]);assert(completed,'cancel must settle even if original frame never executes');frames[0]();await work;assert.deepEqual(owner.board,before);assert.equal(owner.history.undoStack.length,0);assert.equal(view.revealCalls.length,0);f.clean();
});
test('a newer whole-board link clears a pending reading position without waiting for its abandoned frame',async()=>{
 const f=fixture(),hold=gate();f.setActive(f.origin);f.win.requestAnimationFrame=()=>{hold.enter();};const older=f.host.openDeepLink(f.positionParams());await hold.started;const newer=f.host.openDeepLink(f.nodeParams());const completed=await Promise.race([Promise.all([older,newer]).then(()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),100))]);assert(completed);assert.equal(f.target.view.session.board.brain.centerId,'a');assert.equal(f.target.view.session.history.undoStack.length,0);f.clean();
});
for(const latest of ['node','position','board-only'] as const)test(`reading-position link superseded by ${latest} during disk flush leaves the latest accepted intent`,async()=>{
 const f=fixture(),hold=gate(),process=f.app.vault.process;let first=true;f.setActive(f.origin);f.app.vault.process=async(file:TFile,edit:(raw:string)=>string)=>{if(file===f.file&&first){first=false;hold.enter();await hold.wait;}return process(file,edit);};
 const older=f.host.openDeepLink(f.positionParams('p-b'));await hold.started;const newer=f.host.openDeepLink(latest==='position'?f.positionParams('p-c'):f.nodeParams(latest==='node'?'c':undefined));hold.release();const result=await Promise.allSettled([older,newer]);assert(result.every(entry=>entry.status==='fulfilled'),'superseded continuation settles quietly');
 const owner=f.target.view.session;assert.equal(owner.board.brain.centerId,latest==='board-only'?'b':'c');assert.equal(owner.history.undoStack.length,latest==='board-only'?1:2);assert.deepEqual(owner.board.brain.history.entries,latest==='board-only'?['a','b']:['a','b','c']);if(latest==='position')assert.deepEqual(owner.board.brainViewport,{x:-255.25,y:178.125,zoom:1.25});assert.equal(f.notices.some(message=>/停止定位|已取消/.test(message)),false);await owner.flush();f.clean();
});
test('navigation during an already accepted position save cannot focus or locate after its flush',async()=>{
 const f=fixture(),hold=gate(),process=f.app.vault.process;f.setActive(f.origin);f.app.vault.process=async(file:TFile,edit:(raw:string)=>string)=>{if(file===f.file){hold.enter();await hold.wait;}return process(file,edit);};
 const older=f.host.openDeepLink(f.positionParams('p-b'));await hold.started;f.setActive(f.origin);const focusCount=f.events.filter(event=>event[0]==='focus').length;hold.release();await older;assert.equal(f.active(),f.origin);assert.equal(f.events.filter(event=>event[0]==='focus').length,focusCount);assert.equal(f.target.view.revealCalls.length,0);assert.equal(f.target.view.session.board.brain.centerId,'b','accepted pre-navigation transaction remains');f.clean();
});
for(const format of ['md','thoughtspace'])test(`missing reading-position link preserves ${format} owner history and source`,async()=>{
 const f=fixture(format),owner=f.target.view.session,before=model.clone(owner.board),raw=f.disk.get(f.file);f.setActive(f.origin);await assert.rejects(f.host.openDeepLink(f.positionParams('deleted-position')),/移除/);assert.deepEqual(owner.board,before);assert.equal(owner.history.undoStack.length,0);assert.equal(f.disk.get(f.file),raw);f.clean();
});
test('a reading-position link cannot write a Markdown board while its native editor owns it',async()=>{
 const f=fixture('md'),owner=f.target.view.session,before=model.clone(owner.board),raw=f.disk.get(f.file);f.setNativeBusy(true);f.setActive(f.origin);await assert.rejects(f.host.openDeepLink(f.positionParams()),/暂停写入|切换/);assert.deepEqual(owner.board,before);assert.equal(owner.history.undoStack.length,0);assert.equal(f.disk.get(f.file),raw);assert.equal(f.target.view.revealCalls.length,0);f.clean();
});
