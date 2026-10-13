import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import * as state from '../src/board-mindmap';
import * as geometry from '../src/relation-geometry-checkpoint';
import {supportsLocalRelations} from '../src/local-relations';
import {foldCards} from '../src/board-tools';
import {reflowReadingContent} from '../src/expansion-reading-state';

// Execute the production Session and embedded-mindmap host together. These
// controlled DOM/vault doubles cover the first-paint ownership boundary; real
// Obsidian mounting, geometry and native menus remain separate native QA.
const source=readFileSync('src/main.ts','utf8');
const ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function declaration(name:string){const result=ast.statements.find((node):node is ts.ClassDeclaration=>ts.isClassDeclaration(node)&&node.name?.text===name);assert(result,name);return result;}
function methods(name:string,names:string[]){return declaration(name).members.filter(node=>ts.isMethodDeclaration(node)&&names.includes(node.name.getText(ast))).map(node=>node.getText(ast)).join('\n');}
function compile(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
const parseYaml=createRequire(import.meta.url)('js-yaml').load as (raw:string)=>unknown;
class TFile {stat={mtime:1,size:1,ctime:1};parent={path:'Boards'};constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}}
class Element {
 isConnected=true;classes=new Set<string>();ownerDocument={defaultView:{closed:false}};
 addClass(value:string){this.classes.add(value);}closest(){return null;}
}
class Mounted {constructor(public app:unknown,public el:Element,public host:any){}}
class Scope {children:Mounted[]=[];cleanups:(()=>void)[]=[];addChild(child:Mounted){this.children.push(child);}register(run:()=>void){this.cleanups.push(run);}}
type Mode='editable'|'handoff'|'native-open'|'native-pending'|'native-reload'|'write-blocked'|'locked';
function fixture(mode:Mode='handoff'){
 const file=new TFile('Boards/Embedded.md'),note=new TFile('Notes/Source.md'),other=new TFile('Notes/Other.md'),files=new Map([[file.path,file],[note.path,note],[other.path,other]]);
 const board:model.Board={version:3,viewport:{x:12,y:34,zoom:.85},edges:[],nodes:[
  {id:'a',kind:'card',file:note.path,x:20,y:40,width:280,height:180,color:'sand'},
  {id:'b',kind:'card',file:other.path,x:340,y:40,width:280,height:180,color:'sand'},
  {id:'map',kind:'mindmap',title:'Embedded',x:20,y:260,width:780,height:340,color:'slate',mindmap:state.createBoardMindmapState('a'),...(mode==='locked'?{locked:true}:{})}
 ]};
 const original=documents.createMarkdownBoardDocument(board,'Embedded').replace('thoughtspace: board','thoughtspace: board\nowner: native-properties')+'\nOriginal native body.\n';
 let disk=original,writes=0;const errors:unknown[]=[],notices:string[]=[],opens:{id:string;current:()=>boolean}[]=[],menus:unknown[][]=[],returns:{file:TFile;current:()=>boolean}[]=[];
 const ownership={open:mode==='native-open'||mode==='native-reload'?1:0,pending:mode==='native-pending'?1:0};
 const hooks:{read?:()=>Promise<string>}={};
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:()=>hooks.read?.()||Promise.resolve(disk),process:async(_file:TFile,change:(raw:string)=>string)=>{disk=change(disk);writes++;}},workspace:{getLeavesOfType:()=>[],trigger:(...args:unknown[])=>menus.push(args)}};
 const nativeBoardTransitions=new Set(mode==='handoff'?[file]:[]);
 const plugin={app,nativeBoardTransitions,nativeBoardEditorStatus:()=>ownership,addCollectionReturn:(_menu:unknown,target:TFile,current:()=>boolean)=>returns.push({file:target,current}),createUnique:async()=>{throw Error('Unexpected recovery creation');}};
 const Notice=class{constructor(value:string){notices.push(value);}};
 const Session=compile(declaration('Session').getText(ast)+';return Session;',{...model,...mindmap,...documents,...geometry,parseYaml,Notice,report:(error:unknown)=>errors.push(error),reflowReadingContent,hasNativeBoardEditor:()=>ownership.open>0||ownership.pending>0,assertBoardEditorOwnership:()=>{if(ownership.open||ownership.pending)throw Error('Native document is still owned');}});
 const View=compile('class BoardView{'+methods('BoardView',['requireOwner','mountBoardMindmap','foldBoardMindmap','boardMindmapRelation'])+'};return BoardView;',{...model,...state,foldCards,supportsLocalRelations,TFile,BoardMindmapView:Mounted,VIEW:'board',Notice});
 const owner=new Session(plugin,file,disk),view=new View(),leaf={view},el=new Element(),scope=new Scope();
 if(mode==='native-reload'){ownership.open=0;owner.refreshNativeEditing();}
 if(mode==='write-blocked')owner.blocked=true;
 Object.assign(view,{app,plugin,file,session:owner,leaf,closed:false,closing:false,positions:new Map([['map',el]]),boardMindmaps:new Map(),selected:new Set(),updateSelection:()=>{},mindmapSource:()=>({available:true}),mindmapNative:()=>({}),openLocalRelationSource:async(id:string,current:()=>boolean)=>{opens.push({id,current});}});
 const mount=()=>{view.mountBoardMindmap(owner.board.nodes.find((node:model.Card)=>node.id==='map'),el,scope);return view.boardMindmaps.get('map') as Mounted|undefined;};
 const unchanged=()=>({board:model.clone(owner.board),disk,history:JSON.stringify(owner.history),writes});
 return{file,note,files,owner,view,leaf,el,scope,ownership,plugin,hooks,mount,opens,menus,returns,errors,notices,original,unchanged,writes:()=>writes,disk:()=>disk,nativeSave:(raw:string)=>{disk=raw;}};
}

for(const mode of ['handoff','native-open','native-pending','native-reload','write-blocked'] as const)test(`first embedded mount during ${mode} remains visible and denies every layout write`,async()=>{
 const f=fixture(mode),previous=model.clone(f.owner.board);previous.nodes[2].mindmap=state.createBoardMindmapState('b');f.owner.history.push(previous);const before=f.unchanged();
 const mounted=f.mount();assert(mounted);assert.equal(f.scope.children[0],mounted);assert.equal(mounted.host.snapshot().readOnly,true);assert.equal(f.owner.blocked,true);
 assert.throws(()=>f.view.requireOwner(),/暂停写入/,'global write ownership stays strict');
 for(const action of [{type:'center',id:'b'},{type:'expand',id:'a'},{type:'pin',id:'a'}] as const){
  mounted.host.change(state.updateBoardMindmapState(f.owner.board.nodes[2].mindmap,action,f.owner.board.nodes));
 }
 assert.throws(()=>mounted.host.fold(),/暂停写入/);
 assert.throws(()=>mounted.host.relate('a','child',()=>true),/暂停写入/);
 assert.equal(mounted.host.shortcut({key:'z',metaKey:true,target:new Element()}),true);
 f.owner.undo();
 await f.owner.flush();assert.deepEqual(f.unchanged(),before);
 // Reading and exact-source return remain usable while the board is read-only.
 await mounted.host.open('a',()=>true);mounted.host.fileMenu({},'a');
 assert.equal(f.opens.length,1);assert.equal(f.opens[0].current(),true);assert.equal(f.returns[0].file,f.note);assert.equal(f.returns[0].current(),true);assert.equal(f.menus[0][0],'file-menu');
 assert.deepEqual(f.unchanged(),before);assert.deepEqual(f.errors,[]);
});

test('a native page opened after mounting is rechecked before a host change can mutate the board',async()=>{
 const f=fixture('editable'),mounted=f.mount()!,before=f.unchanged();assert.equal(mounted.host.snapshot().readOnly,false);
 // No ownership notification has reached this view yet. Session.change must
 // still refresh the live native owner before touching the board or history.
 f.ownership.open=1;mounted.host.change(state.createBoardMindmapState('b'));await f.owner.flush();
 assert.equal(mounted.host.snapshot().readOnly,true);assert.deepEqual(f.unchanged(),before);assert.deepEqual(f.errors,[]);
});

test('a locked embedded container mounts read-only without changing its graph or camera',async()=>{
 const f=fixture('locked'),before=f.unchanged(),mounted=f.mount()!;assert.equal(mounted.host.snapshot().readOnly,true);
 mounted.host.change(state.createBoardMindmapState('b'));mounted.host.fold();mounted.host.relate('a','child',()=>true);
 await f.owner.flush();assert.deepEqual(f.unchanged(),before);assert.deepEqual(f.errors,[]);
});

test('handoff mounting keeps the lock until the latest read, then the same host can save without altering native text',async()=>{
 const f=fixture(),mounted=f.mount()!,reads:ReturnType<typeof deferred<string>>[]=[];
 f.hooks.read=()=>{const read=deferred<string>();reads.push(read);return read.promise;};
 f.plugin.nativeBoardTransitions.delete(f.file);f.owner.refreshNativeEditing();assert.equal(mounted.host.snapshot().readOnly,true);
 let completed=false;const returning=f.owner.settleExternalUpdate().then(()=>{completed=true;});await tick();assert.equal(reads.length,1);
 const newer=f.owner.externalUpdate();await tick();assert.equal(reads.length,2);
 reads[0].resolve(f.original);await tick();assert.equal(completed,false);assert.equal(mounted.host.snapshot().readOnly,true);assert.equal(f.writes(),0);
 const latest=f.original.replace('owner: native-properties','owner: latest-native-properties').replace('Original native body.','Latest native body.');
 f.nativeSave(latest);reads[1].resolve(latest);await Promise.all([returning,newer]);assert.equal(mounted.host.snapshot().readOnly,false);assert.equal(f.view.boardMindmaps.get('map'),mounted);assert.equal(f.owner.baseline,latest);assert.equal(f.writes(),0);
 mounted.host.change(state.createBoardMindmapState('b'));await f.owner.flush();
 assert.equal(f.writes(),1);const saved=documents.readBoardDocument(f.disk(),'md',parseYaml);
 assert.equal(saved.board.nodes[2].mindmap?.centerId,'b');assert.match(f.disk(),/owner: latest-native-properties/);assert.match(f.disk(),/Latest native body\./);assert.deepEqual(saved.board.viewport,{x:12,y:34,zoom:.85});assert.deepEqual(f.errors,[]);
});

for(const mode of ['read-error','new-native-owner','same-path-replacement'] as const)test(`readonly embedded mounting cannot unlock after ${mode}`,async()=>{
 const f=fixture(),mounted=f.mount()!,gate=deferred<string>(),before=f.unchanged();f.hooks.read=()=>gate.promise;
 f.plugin.nativeBoardTransitions.delete(f.file);const reading=f.owner.settleExternalUpdate();await tick();
 if(mode==='new-native-owner')f.ownership.open=1;
 if(mode==='same-path-replacement')f.files.set(f.file.path,new TFile(f.file.path));
 if(mode==='read-error')gate.reject(Error('Controlled latest read failure'));else gate.resolve(f.original);
 await reading;assert.equal(mounted.host.snapshot().readOnly,true);assert.equal(f.owner.blocked,true);
 mounted.host.change(state.createBoardMindmapState('b'));assert.throws(()=>mounted.host.fold(),/暂停写入/);await f.owner.flush();
 assert.deepEqual(f.owner.board,before.board);assert.equal(f.disk(),before.disk);assert.equal(f.writes(),0);assert.equal(JSON.stringify(f.owner.history),before.history);
 if(mode==='read-error')assert.equal(f.errors.length,1);else assert.deepEqual(f.errors,[]);
});

for(const mode of ['owner-replaced','leaf-replaced','element-replaced','removed','detached','closing','closed'] as const)test(`an embedded ${mode} host rejects stale actions after a readonly mount`,async()=>{
 const f=fixture(),mounted=f.mount()!;
 await mounted.host.open('a',()=>true);mounted.host.fileMenu({},'a');const priorOpen=f.opens[0],priorReturn=f.returns[0];
 if(mode==='owner-replaced')f.view.session={};else if(mode==='leaf-replaced')f.leaf.view={};else if(mode==='element-replaced')f.view.positions.set('map',new Element());else if(mode==='removed')f.owner.board.nodes=f.owner.board.nodes.filter((node:model.Card)=>node.id!=='map');else if(mode==='detached')f.el.isConnected=false;else f.view[mode]=true;
 const before=f.unchanged();assert.equal(mounted.host.snapshot(),undefined);assert.equal(priorOpen.current(),false);assert.equal(priorReturn.current(),false);
 mounted.host.change(state.createBoardMindmapState('b'));mounted.host.fold();mounted.host.relate('a','child',()=>true);mounted.host.select();mounted.host.fileMenu({},'a');await mounted.host.open('a',()=>true);
 assert.equal(mounted.host.shortcut({key:'z',metaKey:true,target:new Element()}),false);
 await f.owner.flush();assert.deepEqual(f.unchanged(),before);assert.equal(f.opens.length,1);assert.equal(f.returns.length,1);assert.equal(f.menus.length,1);assert.equal(f.view.selected.size,0);assert.deepEqual(f.errors,[]);
});

for(const mode of ['missing-owner','closing','closed'] as const)test(`mount does nothing for an already ${mode} view`,()=>{
 const f=fixture();if(mode==='missing-owner')f.view.session=undefined;else f.view[mode]=true;
 assert.equal(f.mount(),undefined);assert.equal(f.scope.children.length,0);assert.equal(f.el.classes.size,0);assert.equal(f.writes(),0);
});
