import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as documents from '../src/board-document';
import {isBoardPath} from '../src/board-path';
import {isWorkspaceFile} from '../src/workspace';
import {SharedOpen} from '../src/view-opening';
import {resumeRecentBoard} from '../src/recent-board';

// All three production methods execute together, including the actual disk
// codec, shared-opening coordination, deferred loading, reveal and activation.
// Only the native leaf/file classes are boundary doubles.
const source=readFileSync(process.env.RECENT_ROUTING_SOURCE||'src/main.ts','utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='ThoughtSpace');assert.ok(declaration&&ts.isClassDeclaration(declaration));
const methods=declaration.members.filter(node=>ts.isMethodDeclaration(node)&&node.body&&['openRecentBoard','openBoard','readBoard'].includes(node.name.getText(ast))).map(node=>node.getText(ast)).join('\n');
const helper=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='isBoardFile');assert.ok(helper);
const parseYaml=createRequire(import.meta.url)('js-yaml').load,VIEW='thoughtspace-board',EXT='thoughtspace',notices:string[]=[];
class TFile {stat={mtime:1,size:0};constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}}
class View {leaf:any;containerEl:any;}
class FileView extends View {constructor(public file:TFile){super();}}
class MarkdownView extends FileView {}
class BoardView extends FileView {closed=false;session:any;fits=0;resumeAutomaticGeometry(){}fit(){this.fits++;}}
const deps={...model,...documents,isBoardPath,isWorkspaceFile,parseYaml,resumeRecentBoard,View,FileView,MarkdownView,BoardView,TFile,VIEW,EXT,Notice:class{constructor(value:string){notices.push(value);}},window:globalThis};
const execute=(code:string,extra:Record<string,unknown>={})=>{const values={...deps,...extra};return new Function(...Object.keys(values),transformSync(code,{loader:'ts'}).code)(...Object.values(values));};
const isBoardFile=execute(helper.getText(ast)+';return isBoardFile;');
const Host=execute(`return class Host{${methods}}`,{isBoardFile});
function fixture(){
 const host=new Host(),files=new Map<string,TFile>(),disk=new Map<TFile,string>(),metadata=new Map<TFile,unknown>(),leaves:any[]=[],reads:string[]=[],visits:string[]=[],doc={hasFocus:()=>true,defaultView:{closed:false,requestAnimationFrame:(fn:()=>void)=>fn()}};
 let active:any,fallback=0;notices.length=0;
 const put=(path:string,raw:string,frontmatter?:unknown)=>{const file=new TFile(path);files.set(path,file);disk.set(file,raw);if(frontmatter!==undefined)metadata.set(file,frontmatter);return file;};
 const board=()=>{const value=model.emptyBoard();value.version=3;value.viewport={x:123,y:234,zoom:.7};value.nodes=[{id:'a',kind:'text',text:'Retained idea',x:1,y:2,width:300,height:200,color:'sand'},{id:'b',kind:'card',file:'Existing.md',x:301,y:2,width:300,height:200,color:'slate'}];value.edges=[{id:'ab',from:'a',to:'b',kind:'branch',label:''},{id:'both',from:'a',to:'b',direction:'both',label:''}];return value;};
 const makeLeaf=(type='empty',file?:TFile)=>{
  const leaf:any={type,isDeferred:false,state:{type,state:file?{file:file.path}:{}},view:new View(),getViewState:()=>leaf.state,loadIfDeferred:async()=>{},detach:()=>{const i=leaves.indexOf(leaf);if(i>=0)leaves.splice(i,1);if(active===leaf)workspace.setActiveLeaf(leaves.at(-1));},
   setViewState:async(state:any)=>{leaf.type=state.type;leaf.state=state;const next=files.get(state.state.file)!;leaf.view=state.type===VIEW?new BoardView(next):new MarkdownView(next);leaf.view.leaf=leaf;leaf.view.containerEl={ownerDocument:doc};if(state.type===VIEW)leaf.view.session={board:await host.readBoard(next),blocked:false};emit('file-open',next);},
   openFile:async(next:TFile)=>leaf.setViewState({type:next.extension===EXT?VIEW:'markdown',state:{file:next.path}})
  };if(file){leaf.view=type===VIEW?new BoardView(file):new MarkdownView(file);if(type===VIEW)leaf.view.session={board:board(),blocked:false};}leaf.view.leaf=leaf;leaf.view.containerEl={ownerDocument:doc};leaves.push(leaf);return leaf;
 };
 const listeners=new Map<string,Set<(...args:any[])=>void>>(),emit=(name:string,...args:any[])=>{for(const run of listeners.get(name)||[])run(...args);};
 const workspace={containerEl:{ownerDocument:doc},getActiveViewOfType:(Type:any)=>active?.view instanceof Type?active.view:null,getLeavesOfType:(type:string)=>leaves.filter(leaf=>leaf.type===type),
  getLeaf:()=>{const leaf=makeLeaf();workspace.setActiveLeaf(leaf);return leaf;},revealLeaf:async(_leaf:any)=>{},setActiveLeaf:(leaf:any)=>{active=leaf;emit('active-leaf-change',leaf);},
  on:(name:string,run:(...args:any[])=>void)=>{let set=listeners.get(name);if(!set){set=new Set();listeners.set(name,set);}set.add(run);return{name,run};},offref:(ref:{name:string;run:(...args:any[])=>void})=>listeners.get(ref.name)?.delete(ref.run)
 };
 const app={workspace,metadataCache:{getFileCache:(file:TFile)=>metadata.has(file)?{frontmatter:metadata.get(file)}:null},vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async(file:TFile)=>{reads.push(file.path);return disk.get(file)!;},cachedRead:async(file:TFile)=>disk.get(file)!}};
 Object.assign(host,{app,sessions:new Map(),settings:{hub:{recent:[]}},boardOpening:new SharedOpen(),provisionalBoardGeometry:new WeakMap(),recordBoardVisit:async(file:TFile)=>{visits.push(file.path);},openSpaceHub:()=>{fallback++;}});
 const original=put('Existing.md','# Existing source\n'),origin=makeLeaf('markdown',original);active=origin;
 return{host,app,files,disk,metadata,leaves,reads,visits,doc,put,board,makeLeaf,origin,listeners,emit,active:()=>active,setActive:(leaf:any)=>{workspace.setActiveLeaf(leaf);},fallback:()=>fallback,seed:(paths:string[])=>{host.settings.hub.recent=paths.map(path=>({path,at:1}));}};
}
test('resume opens a valid Markdown board from actual disk even before native frontmatter indexing',async()=>{
 const f=fixture(),value=f.board(),raw=documents.createMarkdownBoardDocument(value,'Fresh'),valid=f.put('Fresh.md',raw);f.seed(['Fresh.md']);
 await f.host.openRecentBoard();assert.equal(f.active().view.file,valid);assert.ok(f.active().view instanceof BoardView);assert.deepEqual(f.active().view.session.board,value);assert.equal(f.active().view.fits,0);assert.deepEqual(f.visits,['Fresh.md']);assert.equal(f.fallback(),0);assert.equal(f.disk.get(valid),raw);
});
test('real recent opening skips deleted, ordinary and corrupt records without trusting stale cached declarations',async()=>{
 const f=fixture(),plain=f.put('Former.md','---\nthoughtspace: note\n---\n\n# Original body\n',{thoughtspace:'board'}),broken=f.put('Broken.thoughtspace','{"version":3,"nodes":'),valid=f.put('Valid.md',documents.createMarkdownBoardDocument(f.board(),'Valid'),{thoughtspace:'note'});f.seed(['Deleted.md',plain.path,broken.path,valid.path]);
 await f.host.openRecentBoard();assert.equal(f.active().view.file,valid);assert.deepEqual(f.visits,['Valid.md']);assert.equal(f.leaves.length,2);assert.equal(f.fallback(),0);assert.match(notices[0],/3/);assert.equal(f.disk.get(plain),'---\nthoughtspace: note\n---\n\n# Original body\n');
});
test('actual opening reuses an existing deferred board and preserves its last camera',async()=>{
 const f=fixture(),file=f.put('Deferred.md',documents.createMarkdownBoardDocument(f.board(),'Deferred'),{thoughtspace:'board'}),leaf=f.makeLeaf('thoughtspace-board');leaf.state={type:VIEW,state:{file:file.path}};leaf.isDeferred=true;let loads=0;
 leaf.loadIfDeferred=async()=>{loads++;await leaf.setViewState(leaf.state);leaf.isDeferred=false;};f.seed([file.path]);await f.host.openRecentBoard();assert.equal(f.active(),leaf);assert.equal(loads,1);assert.equal(f.leaves.length,2);assert.deepEqual(leaf.view.session.board.viewport,f.board().viewport);assert.equal(leaf.view.fits,0);
});
test('legacy recent boards also own the synchronously allocated empty leaf and retain saved geometry',async()=>{
 const f=fixture(),value=f.board(),raw=JSON.stringify(value),file=f.put('Legacy.thoughtspace',raw);f.seed([file.path]);await f.host.openRecentBoard();
 assert.equal(f.active().view.file,file);assert.ok(f.active().view instanceof BoardView);assert.deepEqual(f.active().view.session.board,value);assert.equal(f.active().view.fits,0);assert.deepEqual(f.visits,[file.path]);assert.equal(f.disk.get(file),raw);assert.equal(f.fallback(),0);
});
test('same-leaf native navigation while the actual disk read is pending wins over resume',async()=>{
 const f=fixture(),file=f.put('Slow.md',documents.createMarkdownBoardDocument(f.board(),'Slow'),{thoughtspace:'board'}),next=f.put('Next.md','# New navigation\n');let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),read=f.app.vault.read;
 f.app.vault.read=async(value:TFile)=>{if(value===file)await gate;return read(value);};f.seed([file.path]);const work=f.host.openRecentBoard();await Promise.resolve();await f.origin.openFile(next);release();await work;
 assert.equal(f.active(),f.origin);assert.equal(f.active().view.file,next);assert.equal(f.active().type,'markdown');assert.deepEqual(f.visits,[]);assert.equal(f.leaves.length,1);assert.equal(f.fallback(),0);
});
test('all invalid actual sources return to the hub without creating board leaves or replacing their bodies',async()=>{
 const f=fixture(),raw='# Plain body\n',file=f.put('Plain.md',raw,{thoughtspace:'board'});f.seed(['Missing.md',file.path]);await f.host.openRecentBoard();assert.equal(f.active(),f.origin);assert.equal(f.leaves.length,1);assert.equal(f.fallback(),1);assert.equal(f.disk.get(file),raw);
});
test('leaving the origin and returning while the actual disk read waits permanently cancels the earlier request',async()=>{
 const f=fixture(),file=f.put('Slow.md',documents.createMarkdownBoardDocument(f.board(),'Slow'),{thoughtspace:'board'}),next=f.put('Next.md','# User navigation\n');let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),read=f.app.vault.read;
 f.app.vault.read=async(value:TFile)=>{if(value===file)await gate;return read(value);};f.seed([file.path]);const work=f.host.openRecentBoard();await Promise.resolve();f.origin.view.file=next;f.emit('file-open',next);f.origin.view.file=f.files.get('Existing.md');f.emit('file-open',f.origin.view.file);release();await work;
 assert.equal(f.active(),f.origin);assert.equal(f.leaves.length,1);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),0);assert([...f.listeners.values()].every(set=>set.size===0));
});
test('new navigation after the controlled empty allocation cancels even when returning to the empty leaf',async()=>{
 const f=fixture(),file=f.put('Slow.md',documents.createMarkdownBoardDocument(f.board(),'Slow'),{thoughtspace:'board'});let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;}),read=f.app.vault.cachedRead;
 f.app.vault.cachedRead=async(value:TFile)=>{if(value===file){entered();await gate;}return read(value);};f.seed([file.path]);const work=f.host.openRecentBoard();await started;const allocated=f.active();assert.notEqual(allocated,f.origin);assert.equal(allocated.type,'empty');f.setActive(f.origin);f.setActive(allocated);release();await work;
 assert.equal(f.active(),f.origin);assert.equal(f.leaves.length,1);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),0);assert([...f.listeners.values()].every(set=>set.size===0));
});
test('user navigation repurposing the allocated leaf is preserved when the held board read finishes',async()=>{
 const f=fixture(),file=f.put('Slow.md',documents.createMarkdownBoardDocument(f.board(),'Slow'),{thoughtspace:'board'}),next=f.put('Next.md','# User latest document\n');let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;}),read=f.app.vault.cachedRead;
 f.app.vault.cachedRead=async(value:TFile)=>{if(value===file){entered();await gate;}return read(value);};f.seed([file.path]);const work=f.host.openRecentBoard();await started;const allocated=f.active();await allocated.openFile(next);release();await work;
 assert.equal(f.active(),allocated);assert.equal(allocated.view.file,next);assert.equal(allocated.type,'markdown');assert.equal(f.leaves.length,2);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),0);
});
test('an actual board read failure after user navigation preserves the repurposed native leaf and source',async()=>{
 const f=fixture(),file=f.put('Slow.md',documents.createMarkdownBoardDocument(f.board(),'Slow'),{thoughtspace:'board'}),raw='# User latest document\n',next=f.put('Next.md',raw);let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;}),read=f.app.vault.cachedRead;
 f.app.vault.cachedRead=async(value:TFile)=>{if(value===file){entered();await gate;throw Error('bounded read failure');}return read(value);};f.seed([file.path]);const work=f.host.openRecentBoard();await started;const allocated=f.active();await allocated.openFile(next);release();await work;
 assert.equal(f.active(),allocated);assert.equal(allocated.view.file,next);assert.equal(allocated.type,'markdown');assert.equal(f.leaves.length,2);assert.equal(f.disk.get(next),raw);assert.deepEqual(f.visits,[]);assert.equal(f.fallback(),0);
});
