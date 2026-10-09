import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as documents from '../src/board-document';
import {boardLink,parseBoardLink} from '../src/deeplinks';
import {isBoardPath} from '../src/board-path';
import {isWorkspaceFile} from '../src/workspace';
import {SharedOpen} from '../src/view-opening';
import {isBrainBoard} from '../src/brain-board';
import {createBoardMindmapState,updateBoardMindmapState} from '../src/board-mindmap';
import {supportsLocalRelations} from '../src/local-relations';

// Execute the actual protocol helper, disk codec, opener and revealNode together.
// Native files, views, leaves and workspace events are the only boundary doubles.
const source=readFileSync(process.env.DEEP_LINK_ROUTING_SOURCE||'src/main.ts','utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function methods(name:string,names:string[]){const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===name);assert(declaration&&ts.isClassDeclaration(declaration));return declaration.members.filter(node=>ts.isMethodDeclaration(node)&&node.body&&names.includes(node.name.getText(ast))).map(node=>node.getText(ast)).join('\n');}
const parseYaml=createRequire(import.meta.url)('js-yaml').load,VIEW='thoughtspace-board',EXT='thoughtspace';
class TFile {stat={mtime:1,size:0};constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}}
class View {leaf:any;containerEl:any;}
class FileView extends View {constructor(public file:TFile){super();}}
class MarkdownView extends FileView {}
let actualReveal:(this:BoardView,id:string)=>void;
class BoardView extends FileView {app:any;session:any;closed=false;revealCalls=0;resumeAutomaticGeometry(){}revealNode(id:string){this.revealCalls++;actualReveal.call(this,id);}}
const notices:string[]=[],deps={...model,...documents,parseBoardLink,isBoardPath,isWorkspaceFile,parseYaml,View,FileView,MarkdownView,BoardView,TFile,VIEW,EXT,Notice:class{constructor(value:string){notices.push(value);}},window:globalThis};
const execute=(code:string,extra:Record<string,unknown>={})=>{const values={...deps,...extra};return new Function(...Object.keys(values),transformSync(code,{loader:'ts'}).code)(...Object.values(values));};
const Host=execute(`return class Host{${methods('ThoughtSpace',['openDeepLink','openBoard','readBoard'])}}`);
actualReveal=execute(`class ActualView{${methods('BoardView',['revealNode'])}};return ActualView.prototype.revealNode;`,{isBrainBoard,updateBoardMindmapState,supportsLocalRelations});
function gate(){let release!:()=>void,enter!:()=>void;return{wait:new Promise<void>(resolve=>{release=resolve;}),started:new Promise<void>(resolve=>{enter=resolve;}),release:()=>release(),enter:()=>enter()};}
function fixture(format='md',existing=true){
 const windowEvents=new Map<string,Set<()=>void>>(),win={closed:false,requestAnimationFrame:(fn:()=>void)=>fn(),addEventListener:(name:string,run:()=>void)=>{let set=windowEvents.get(name);if(!set){set=new Set();windowEvents.set(name,set);}set.add(run);},removeEventListener:(name:string,run:()=>void)=>windowEvents.get(name)?.delete(run)};
 const host=new Host(),files=new Map<string,TFile>(),disk=new Map<TFile,string>(),leaves:any[]=[],events:any[][]=[],listeners=new Map<string,Set<(...args:any[])=>void>>(),doc={hasFocus:()=>true,defaultView:win};let active:any;notices.length=0;
 const emit=(name:string,...args:any[])=>{for(const run of listeners.get(name)||[])run(...args);};
 const put=(path:string,raw:string)=>{const file=new TFile(path);files.set(path,file);disk.set(file,raw);return file;};
 const owner=(board:model.Board)=>({board,blocked:false,change:(edit:(board:model.Board)=>void)=>edit(board)});
 const makeLeaf=(type='empty',file?:TFile)=>{
  const leaf:any={type,isDeferred:false,state:{type,state:file?{file:file.path}:{}},view:new View(),getViewState:()=>leaf.state,loadIfDeferred:async()=>{},detach:()=>{leaves.splice(leaves.indexOf(leaf),1);if(active===leaf)workspace.setActiveLeaf(leaves.at(-1));},
   setViewState:async(state:any)=>{events.push(['mount',state]);leaf.type=state.type;leaf.state=state;const next=files.get(state.state.file)!;leaf.view=state.type===VIEW?new BoardView(next):new MarkdownView(next);leaf.view.leaf=leaf;leaf.view.containerEl={ownerDocument:doc};leaf.view.app=app;if(state.type===VIEW)leaf.view.session=owner(await host.readBoard(next));emit('file-open',next);},
   openFile:async(next:TFile)=>leaf.setViewState({type:next.extension===EXT?VIEW:'markdown',state:{file:next.path}})
  };if(file){leaf.view=type===VIEW?new BoardView(file):new MarkdownView(file);if(type===VIEW){leaf.view.app=app;leaf.view.session=owner(documents.readBoardDocument(disk.get(file)!,file.extension,parseYaml).board);}}leaf.view.leaf=leaf;leaf.view.containerEl={ownerDocument:doc};leaves.push(leaf);return leaf;
 };
 const workspace={getMostRecentLeaf:()=>active,getLeavesOfType:(type:string)=>leaves.filter(leaf=>leaf.type===type),getActiveViewOfType:(Type:any)=>active?.view instanceof Type?active.view:null,
  getLeaf:()=>{const leaf=makeLeaf();workspace.setActiveLeaf(leaf);return leaf;},revealLeaf:async(_leaf:any)=>{},setActiveLeaf:(leaf:any)=>{active=leaf;events.push(['focus',leaf]);emit('active-leaf-change',leaf);},
  on:(name:string,run:(...args:any[])=>void)=>{let set=listeners.get(name);if(!set){set=new Set();listeners.set(name,set);}set.add(run);return{name,run};},offref:(ref:{name:string;run:(...args:any[])=>void})=>listeners.get(ref.name)?.delete(ref.run)
 };
 const app={workspace,vault:{getName:()=> 'Deep Test',getAbstractFileByPath:(path:string)=>files.get(path),read:async(file:TFile)=>disk.get(file)!,cachedRead:async(file:TFile)=>disk.get(file)!}};
 Object.assign(host,{app,sessions:new Map(),boardOpening:new SharedOpen(),boardOpeningNavigation:new Set(),provisionalBoardGeometry:new WeakMap()});
 const board=model.emptyBoard();board.version=3;board.presentation='brain';board.brain=createBoardMindmapState('b');board.nodes=[{id:'a/#^',kind:'text',brainIdea:true,title:'Alpha',text:'Alpha idea',x:0,y:0,width:300,height:200,color:'sand'},{id:'b',kind:'text',brainIdea:true,title:'Beta',text:'Beta idea',x:400,y:0,width:300,height:200,color:'slate'}];board.edges=[{id:'ab',from:'b',to:'a/#^',kind:'branch',label:''}];
 const file=put('Boards/Deep.'+format,format==='md'?documents.createMarkdownBoardDocument(board,'Deep'):JSON.stringify(board)),target=existing?makeLeaf(VIEW,file):undefined,origin=makeLeaf('markdown',put('Notes/Origin.md','# Origin\n'));active=origin;
 const params=(node:string|undefined='a/#^')=>Object.fromEntries(new URL(boardLink('Deep Test',file.path,node)).searchParams);
 const clean=()=>{assert([...listeners.values()].every(set=>set.size===0));assert([...windowEvents.values()].every(set=>set.size===0));assert.equal(host.boardOpeningNavigation.size,0);assert.equal(host.deepLinkOpening,undefined);};
 return{host,app,files,disk,leaves,events,doc,file,target,origin,put,makeLeaf,emit,params,clean,closeWindow:()=>{win.closed=true;for(const run of windowEvents.get('unload')||[])run();},active:()=>active,setActive:(leaf:any)=>workspace.setActiveLeaf(leaf),notices};
}
for(const change of ['away','same-note-return'])test(`deep-link preflight cancellation (${change}) cannot locate its background brain board`,async()=>{
 const f=fixture(),hold=gate(),read=f.app.vault.read;f.app.vault.read=async(file:TFile)=>{if(file===f.file){hold.enter();await hold.wait;}return read(file);};const work=f.host.openDeepLink(f.params());await hold.started;const board=f.target.view.session.board,eventStart=f.events.length;
 if(change==='away')f.setActive(f.makeLeaf('markdown',f.put('Notes/Newer.md','# Newer\n')));else{const next=f.put('Notes/Newer.md','# Newer\n'),original=f.origin.view.file;f.origin.view.file=next;f.emit('file-open',next);f.origin.view.file=original;f.emit('file-open',original);}const latest=f.active();hold.release();await work;
 assert.equal(f.active(),latest);assert.equal(f.target.view.revealCalls,0);assert.equal(board.brain.centerId,'b');assert.equal(f.events.slice(eventStart).filter(event=>event[0]==='focus'&&event[1]===f.target).length,0);f.clean();
});
for(const format of ['md','thoughtspace'])for(const existing of [false,true])test(`normal ${format} deep-link ${existing?'reuse':'creation'} still opens and centers the exact idea`,async()=>{
 const f=fixture(format,existing);await f.host.openDeepLink(f.params());const target=f.active();assert.equal(target.view.file,f.file);assert.equal(target.view.revealCalls,1);assert.equal(target.view.session.board.brain.centerId,'a/#^');assert.equal(f.leaves.length,2);f.clean();
});
for(const change of ['away-return','native-note','replacement-view','session','file-identity'])test(`deep-link RAF cancellation (${change}) preserves the latest target identity`,async()=>{
 const f=fixture(),hold=gate();let frame!:()=>void;f.doc.defaultView.requestAnimationFrame=(fn:()=>void)=>{frame=fn;hold.enter();};const work=f.host.openDeepLink(f.params());await hold.started;const leaf=f.active(),view=leaf.view,board=view.session.board;
 if(change==='away-return'){f.setActive(f.origin);f.setActive(leaf);}else if(change==='native-note')await leaf.openFile(f.put('Notes/Newer.md','# Newer\n'));else if(change==='replacement-view'){const next=new BoardView(f.file);next.leaf=leaf;next.containerEl={ownerDocument:f.doc};next.app=f.app;next.session=view.session;leaf.view=next;f.emit('file-open',f.file);}else if(change==='session'){view.session={...view.session};f.emit('file-open',f.file);}else f.files.set(f.file.path,new TFile(f.file.path));const latest=leaf.view;frame();await work;
 assert.equal(f.active(),leaf);assert.equal(leaf.view,latest);assert.equal(view.revealCalls,0);assert.equal(board.brain.centerId,'b');f.clean();
});
test('deep links only load their target deferred board',async()=>{
 const f=fixture(),otherFile=f.put('Boards/Unrelated.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Other')),other=f.makeLeaf(VIEW,otherFile);other.isDeferred=true;let unrelatedLoads=0;other.loadIfDeferred=async()=>{unrelatedLoads++;};await f.host.openDeepLink(f.params());assert.equal(unrelatedLoads,0);assert.equal(f.active(),f.target);assert.equal(f.target.view.revealCalls,1);f.clean();
});
test('deep-link RAF completion checks that the linked node still exists',async()=>{
 const f=fixture(),hold=gate();let frame!:()=>void;f.doc.defaultView.requestAnimationFrame=(fn:()=>void)=>{frame=fn;hold.enter();};const work=f.host.openDeepLink(f.params());await hold.started;const view=f.active().view;view.session.board.nodes=view.session.board.nodes.filter((node:model.Board['nodes'][number])=>node.id!=='a/#^');frame();await work;assert.equal(view.revealCalls,0);assert.equal(view.session.board.brain.centerId,'b');f.clean();
});
test('unload cancels a deep-link node continuation and releases listeners',async()=>{
 const f=fixture(),hold=gate();let frame!:()=>void;f.doc.defaultView.requestAnimationFrame=(fn:()=>void)=>{frame=fn;hold.enter();};const work=f.host.openDeepLink(f.params());await hold.started;const view=f.active().view;for(const stop of f.host.boardOpeningNavigation)stop();f.host.boardOpeningNavigation.clear();frame();await work;assert.equal(view.revealCalls,0);assert.equal(view.session.board.brain.centerId,'b');f.clean();
});
test('deep links release listeners after a disk error and allow a normal retry',async()=>{
 const f=fixture(),read=f.app.vault.read;f.app.vault.read=async()=>{throw Error('disk unavailable');};await assert.rejects(f.host.openDeepLink(f.params()),/disk unavailable/);f.clean();assert.equal(f.active(),f.origin);f.app.vault.read=read;await f.host.openDeepLink(f.params());assert.equal(f.target.view.revealCalls,1);f.clean();
});
test('same-file deep links during shared opening center the latest requested node',async()=>{
 const f=fixture('md',false),hold=gate(),read=f.app.vault.cachedRead;let first=true;
 f.app.vault.cachedRead=async(file:TFile)=>{if(file===f.file&&first){first=false;hold.enter();await hold.wait;}return read(file);};const older=f.host.openDeepLink(f.params('a/#^'));await hold.started;const newer=f.host.openDeepLink(f.params('b'));hold.release();await Promise.all([older,newer]);
 const view=f.active().view;assert.equal(view.file,f.file);assert.equal(view.session.board.brain.centerId,'b');assert.equal(view.revealCalls,1);assert.equal(f.leaves.length,2);f.clean();
});
test('same-file deep links awaiting a frame use the latest node without replaying the older one',async()=>{
 const f=fixture(),hold=gate(),frames:Array<()=>void>=[];f.doc.defaultView.requestAnimationFrame=(fn:()=>void)=>{frames.push(fn);hold.enter();};const older=f.host.openDeepLink(f.params('a/#^'));await hold.started;const newer=f.host.openDeepLink(f.params('b'));for(let i=0;i<20;i++)await Promise.resolve();assert.equal(frames.length,1);frames[0]();await Promise.all([older,newer]);assert.equal(f.target.view.revealCalls,1);assert.equal(f.target.view.session.board.brain.centerId,'b');f.clean();
});
test('navigation cancellation finishes a deep-link wait even without a frame callback',async()=>{
 const f=fixture(),hold=gate();f.doc.defaultView.requestAnimationFrame=()=>{hold.enter();};const work=f.host.openDeepLink(f.params());await hold.started;f.setActive(f.origin);const completed=await Promise.race([work.then(()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),100))]);assert.equal(completed,true);assert.equal(f.target.view.revealCalls,0);f.clean();
});
test('target window unload finishes a deep-link wait and releases listeners',async()=>{
 const f=fixture(),hold=gate();f.doc.defaultView.requestAnimationFrame=()=>{hold.enter();};const work=f.host.openDeepLink(f.params());await hold.started;f.closeWindow();const completed=await Promise.race([work.then(()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),100))]);assert.equal(completed,true);assert.equal(f.target.view.revealCalls,0);f.clean();
});
test('a newer board-only link drops the older pending node location',async()=>{
 const f=fixture(),hold=gate();f.doc.defaultView.requestAnimationFrame=()=>{hold.enter();};const older=f.host.openDeepLink(f.params('a/#^'));await hold.started;const params=f.params();delete params.node;const newer=f.host.openDeepLink(params);const completed=await Promise.race([Promise.all([older,newer]).then(()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),100))]);assert.equal(completed,true);assert.equal(f.target.view.revealCalls,0);assert.equal(f.notices.length,0);f.clean();
});
test('a different-file link finishes first without an older pending board mounting or focusing',async()=>{
 const f=fixture('md',false),hold=gate(),read=f.app.vault.cachedRead;let first=true;f.app.vault.cachedRead=async(file:TFile)=>{if(file===f.file&&first){first=false;hold.enter();await hold.wait;}return read(file);};const older=f.host.openDeepLink(f.params());await hold.started;
 const latest=f.put('Boards/Latest.md',f.disk.get(f.file)!),params=Object.fromEntries(new URL(boardLink('Deep Test',latest.path,'b')).searchParams);await f.host.openDeepLink(params);const view=f.active().view;hold.release();await older;
 assert.equal(f.active().view,view);assert.equal(view.file,latest);assert.equal(view.revealCalls,1);assert.equal(view.session.board.brain.centerId,'b');assert.equal(f.events.filter(event=>event[0]==='mount'&&event[1].state.file===f.file.path).length,0);assert.equal(f.events.filter(event=>event[0]==='focus'&&event[1].view.file===f.file).length,0);f.clean();
});
for(const rejects of [false,true])test(`superseded placeholder cleanup cannot cancel the newer different-file preflight (${rejects?'failed':'finished'} read)`,async()=>{
 const f=fixture('md',false),olderRead=gate(),newerRead=gate(),read=f.app.vault.read,cached=f.app.vault.cachedRead,latest=f.put('Boards/Latest.md',f.disk.get(f.file)!);let first=true;
 f.app.vault.cachedRead=async(file:TFile)=>{if(file===f.file&&first){first=false;olderRead.enter();await olderRead.wait;if(rejects)throw Error('Superseded old read fails');}return cached(file);};f.app.vault.read=async(file:TFile)=>{if(file===latest){newerRead.enter();await newerRead.wait;}return read(file);};const older=f.host.openDeepLink(f.params()),settled=Promise.allSettled([older]);await olderRead.started;const newer=f.host.openDeepLink(Object.fromEntries(new URL(boardLink('Deep Test',latest.path,'b')).searchParams));await newerRead.started;olderRead.release();assert.equal((await settled)[0].status,rejects?'rejected':'fulfilled');newerRead.release();await newer;
 assert.equal(f.active().view.file,latest);assert.equal(f.active().view.revealCalls,1);assert.equal(f.active().view.session.board.brain.centerId,'b');assert.equal(f.leaves.length,2);assert.equal(f.events.filter(event=>event[0]==='mount'&&event[1].state.file===f.file.path).length,0);f.clean();
});
test('a different-file link cancels the older frame without overriding its final focus or center',async()=>{
 const f=fixture(),firstFrame=gate(),secondFrame=gate(),frames:Array<()=>void>=[];f.doc.defaultView.requestAnimationFrame=(fn:()=>void)=>{frames.push(fn);if(frames.length===1)firstFrame.enter();if(frames.length===2)secondFrame.enter();};const older=f.host.openDeepLink(f.params());await firstFrame.started;const oldView=f.target.view,latest=f.put('Boards/Latest.md',f.disk.get(f.file)!),newer=f.host.openDeepLink(Object.fromEntries(new URL(boardLink('Deep Test',latest.path,'b')).searchParams));await secondFrame.started;frames[1]();await Promise.all([older,newer]);frames[0]();
 assert.equal(f.active().view.file,latest);assert.equal(f.active().view.revealCalls,1);assert.equal(f.active().view.session.board.brain.centerId,'b');assert.equal(oldView.revealCalls,0);assert.equal(oldView.session.board.brain.centerId,'b');f.clean();
});
for(const rejects of [false,true])test(`a newer different-file link takes ownership when the host reuses the pending empty tab (${rejects?'failed':'finished'} read)`,async()=>{
 const f=fixture('md',false),olderRead=gate(),newerRead=gate(),cached=f.app.vault.cachedRead,create=f.app.workspace.getLeaf,latest=f.put('Boards/Latest.md',f.disk.get(f.file)!);let oldFirst=true,newFirst=true;
 f.app.workspace.getLeaf=()=>f.active().type==='empty'?f.active():create();
 f.app.vault.cachedRead=async(file:TFile)=>{if(file===f.file&&oldFirst){oldFirst=false;olderRead.enter();await olderRead.wait;if(rejects)throw Error('Superseded old read fails');}if(file===latest&&newFirst){newFirst=false;newerRead.enter();await newerRead.wait;}return cached(file);};
 const older=f.host.openDeepLink(f.params()),settled=Promise.allSettled([older]);await olderRead.started;const shared=f.active(),newer=f.host.openDeepLink(Object.fromEntries(new URL(boardLink('Deep Test',latest.path,'b')).searchParams));await newerRead.started;assert.equal(f.active(),shared);olderRead.release();assert.equal((await settled)[0].status,rejects?'rejected':'fulfilled');newerRead.release();await newer;
 assert.equal(f.active(),shared);assert(f.app.workspace.getLeavesOfType(VIEW).includes(shared),'latest board leaf remains attached');assert.equal(shared.view.file,latest);assert.equal(shared.view.revealCalls,1);assert.equal(shared.view.session.board.brain.centerId,'b');assert.equal(f.leaves.length,2);assert.equal(f.events.filter(event=>event[0]==='mount'&&event[1].state.file===f.file.path).length,0);f.clean();
});
