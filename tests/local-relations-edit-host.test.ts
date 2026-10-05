import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as edits from '../src/local-relations-edit';
import * as relationGeometry from '../src/relation-geometry-checkpoint';
import {supportsLocalRelations} from '../src/local-relations';
import {nodeFitChanges} from '../src/node-fit-batch';
import {reflowReadingContent} from '../src/expansion-reading-state';
import type {LocalRelationMutation,LocalRelationValue} from '../src/local-relations-edit';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function compile(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>resolve=yes);return{resolve,promise};}
async function reached(check:()=>boolean){for(let i=0;i<40&&!check();i++)await Promise.resolve();assert.equal(check(),true);}
class TFile{stat={mtime:1,size:100};parent={path:'Boards'};constructor(public path:string){}get basename(){return this.path.split('/').pop()!.replace(/\.[^.]+$/,'');}}
class LocalRelationsView{}
let nextId=0,reflows=0;
const Session=compile(take('class Session {','\ntype BoardGraph=')+';return Session',{...model,...mindmap,...relationGeometry,EXT:'thoughtspace',Notice:class{},report:()=>{},reflowReadingContent:(...args:Parameters<typeof reflowReadingContent>)=>{reflows++;return reflowReadingContent(...args);}});
const BoardView=compile('class BoardView{'+take('  get localRelationSelectedId()','  localRelationSource(')+'};return BoardView',{supportsLocalRelations});
const FitView=compile('class FitView{'+take('  fitCards(','  private queueTextFit(')+take('  private queueNodeFit(','  private refreshFontMetrics(')+take('  private flushNodeFits(','\n\n  saveView(')+'};return FitView',{nodeFitChanges,clone:model.clone});
const Plugin=compile('class Plugin{'+take('  private localRelationsTargets=','  async openMaterialPanel(')+'};return Plugin',{...model,...edits,BoardView,LocalRelationsView,VIEW:'board',EXT:'thoughtspace',uid:()=>`relation-${++nextId}`});
const card=(id:string,patch:Partial<model.Card>={}):model.Card=>({id,kind:'card',file:`Notes/${id}.md`,x:id==='a'?0:500,y:0,width:280,height:180,color:'sand',...patch});
function fixture(){
 const board:model.Board={version:3,nodes:[card('a'),card('b'),card('c',{x:1000}),card('group',{kind:'section',file:undefined,x:1500,title:'Group'})],edges:[],viewport:{x:15,y:25,zoom:.75}},file=new TFile('Boards/Board.thoughtspace'),files=new Map([[file.path,file]]),docs=[{defaultView:{closed:false}},{defaultView:{closed:false}}];let disk=JSON.stringify(board),writes=0;
 const hooks:{process?:()=>Promise<void>}={},recoveries:string[]=[],plugin=new Plugin(),leaves:any[]=[],listeners=new Map<object,()=>void>();
 const app:any={vault:{getAbstractFileByPath:(path:string)=>files.get(path),process:async(target:TFile,edit:(raw:string)=>string)=>{assert.equal(target,file);await hooks.process?.();disk=edit(disk);writes++;},read:async()=>disk,on:(_name:string,fn:()=>void)=>{const key={};listeners.set(key,fn);return key;},offref:(key:object)=>listeners.delete(key)},workspace:{getLeavesOfType:(type:string)=>leaves.filter(leaf=>leaf.type===type&&leaf.view.containerEl.isConnected),setActiveLeaf:()=>{throw Error('Relation editing must not change focus');},revealLeaf:()=>{throw Error('Relation editing must not navigate');}}};
 Object.assign(plugin,{app,settings:{localRelations:{}},createUnique:async(_folder:string,_name:string,_extension:string,raw:string)=>{recoveries.push(raw);return{path:'Boards/Recovery.thoughtspace'};}});
 const owner=new Session(plugin,file,disk),element=(doc=docs[0])=>({ownerDocument:doc,isConnected:true,getClientRects:()=>[{}],querySelector:()=>null});
 const makeBoard=(session=owner,doc=docs[0])=>{const view=new BoardView(),leaf:any={type:'board',view};Object.assign(view,{session,file:session.file,leaf,closed:false,closing:false,selected:new Set(['a']),containerEl:element(doc),contentEl:element(doc)});leaves.push(leaf);return{view,leaf};};
 const origin=makeBoard(),other=makeBoard(owner,docs[1]);
 const bind=(target=origin,doc=docs[0])=>{const view=new LocalRelationsView();Object.assign(view,{containerEl:element(doc)});const leaf:any={type:'relations',view};leaves.push(leaf);plugin.localRelationsTargets.set(leaf,{view:target.view,owner:target.view.session});return{leaf,host:plugin.localRelationsHost(leaf)};};
 const bound=bind();
 const create=(patch:Partial<LocalRelationValue>={}):LocalRelationMutation=>{const value:LocalRelationValue={from:'a',to:'b',label:'related',kind:'ordinary',direction:'forward',...patch};return{action:'create',centerId:'a',value,expected:edits.captureLocalRelationEdit(owner.board,[value.from,value.to])};};
 const existing=(action:'update'|'remove',edgeId:string,patch:Partial<LocalRelationValue>={}):LocalRelationMutation=>{const edge=owner.board.edges.find((edge:model.Edge)=>edge.id===edgeId)!,value:LocalRelationValue={from:edge.from,to:edge.to,label:edge.label,kind:edge.kind==='branch'?'branch':'ordinary',direction:edge.direction||'forward',...patch},expected=edits.captureLocalRelationEdit(owner.board,[value.from,value.to],edgeId);return action==='remove'?{action,centerId:'a',edgeId,expected}:{action,centerId:'a',edgeId,value,expected};};
 return{plugin,app,owner,file,files,docs,origin,other,bind,...bound,hooks,create,existing,recoveries,disk:()=>disk,setDisk:(raw:string)=>{disk=raw;},writes:()=>writes};
}

test('create, update and remove use the real Session save and undo without changing any board geometry',async()=>{
 const f=fixture(),before=model.clone(f.owner.board),beforeReflows=reflows,first=await f.host.editRelation(f.create(),()=>true);assert.equal(first.changed,true);assert.equal(f.owner.history.undoStack.length,1);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.deepEqual(JSON.parse(f.disk()),f.owner.board);
 const created=model.clone(f.owner.board);await f.host.editRelation(f.existing('update',first.edgeId,{label:'renamed',direction:'both'}),()=>true);assert.equal(f.owner.board.edges[0].label,'renamed');assert.equal(f.owner.history.undoStack.length,2);await f.host.editRelation(f.existing('remove',first.edgeId),()=>true);assert.equal(f.owner.board.edges.length,0);assert.equal(f.owner.history.undoStack.length,3);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.viewport,before.viewport);
 f.owner.undo();await f.owner.flush();assert.equal(f.owner.board.edges[0].label,'renamed');f.owner.undo();await f.owner.flush();assert.deepEqual(f.owner.board,created);f.owner.undo();await f.owner.flush();assert.deepEqual(f.owner.board,before);f.owner.undo(true);await f.owner.flush();assert.deepEqual(f.owner.board,created);assert.equal(f.recoveries.length,0);assert.equal(reflows,beforeReflows);
});
test('a successful board save reopens through the existing parser with the exact relation',async()=>{
 const f=fixture();await f.host.editRelation(f.create({kind:'branch'}),()=>true);const reopened=new Session(f.plugin,f.file,f.disk());assert.deepEqual(reopened.board,f.owner.board);assert.equal(reopened.board.edges[0].kind,'branch');assert.equal(reopened.history.undoStack.length,0);
});
test('removing a selected parallel edge leaves every other edge and every source reference untouched',async()=>{
 const f=fixture();f.owner.board.edges=[{id:'first',from:'a',to:'b',label:'one'},{id:'second',from:'a',to:'b',label:'two'}];const before=model.clone(f.owner.board);await f.host.editRelation(f.existing('remove','second'),()=>true);assert.deepEqual(f.owner.board.edges,[before.edges[0]]);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.equal(f.writes(),1);
});
test('an unchanged legacy edge does not write, repaint the Session or clear redo',async()=>{
 const f=fixture();f.owner.board.edges=[{id:'old',from:'a',to:'b',label:'related'}];f.owner.history.redoStack=['saved redo'];let emitted=0;f.owner.listeners.add(()=>emitted++);const result=await f.host.editRelation(f.existing('update','old'),()=>true);assert.equal(result.changed,false);assert.equal(f.writes(),0);assert.equal(emitted,0);assert.deepEqual(f.owner.history.redoStack,['saved redo']);
});
test('invalid endpoints, duplicates, locks and branch cycles fail before history or persistence',async()=>{
 for(const mode of ['text','duplicate','locked','cycle']){const f=fixture(),request=f.create(mode==='cycle'?{kind:'branch'}:{});if(mode==='text')f.owner.board.nodes[1].kind='text';else if(mode==='duplicate')f.owner.board.edges.push({id:'existing',from:'a',to:'b',label:'already'});else if(mode==='locked')f.owner.board.nodes[1].locked=true;else f.owner.board.edges.push({id:'reverse',kind:'branch',from:'b',to:'a',label:''});const before=JSON.stringify(f.owner.board);await assert.rejects(f.host.editRelation(request,()=>true));assert.equal(JSON.stringify(f.owner.board),before,mode);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes(),0);assert.equal(f.host.relationEditing().available,true);}
});
for(const mode of ['inline','inlineTarget','gesture','marquee','rightMarquee','linkDrag','title','converting','closing'] as const)test(`same-session ${mode} work in another window blocks relation editing without committing it`,async()=>{
 const f=fixture(),request=f.create();let commits=0;if(mode==='inline')f.other.view.inline={commit:()=>{commits++;}};else if(mode==='title')f.other.view.contentEl.querySelector=()=>({});else if(mode==='converting')f.owner.convertingTexts.add('a');else f.other.view[mode]=mode==='inlineTarget'?'a':true;assert.equal(f.host.relationEditing().available,false);await assert.rejects(f.host.editRelation(request,()=>true),/草稿已保留/);assert.equal(commits,0);assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);
});
test('unrelated-session drafts do not prevent explicit editing of the captured board',async()=>{
 const f=fixture();f.other.view.session={...f.owner,board:model.clone(f.owner.board)};f.other.view.inline={};await f.host.editRelation(f.create(),()=>true);assert.equal(f.owner.board.edges.length,1);
});
for(const mode of ['cancel','graph-replaced','graph-hidden','graph-moved','graph-window-closed','origin-moved','origin-replaced','board-renamed','board-deleted','owner-replaced','draft','locked','stale-edge'] as const)test(`${mode} while draining previous saves cancels this edit before commit`,async()=>{
 const f=fixture();f.owner.board.edges=[{id:'old',from:'a',to:'b',label:'old'}];const request=f.existing('update','old',{label:'new'}),gate=deferred(),original=f.owner.flush.bind(f.owner);let first=true,current=true;f.owner.flush=async()=>{if(first){first=false;await gate.promise;}return original();};const pending=f.host.editRelation(request,()=>current);await reached(()=>!first);
 if(mode==='cancel')current=false;else if(mode==='graph-replaced')f.leaf.view={containerEl:f.leaf.view.containerEl};else if(mode==='graph-hidden')f.leaf.view.containerEl.getClientRects=()=>[];else if(mode==='graph-moved')f.leaf.view.containerEl.ownerDocument=f.docs[1];else if(mode==='graph-window-closed')f.docs[0].defaultView.closed=true;else if(mode==='origin-moved')f.origin.view.containerEl.ownerDocument=f.docs[1];else if(mode==='origin-replaced')f.origin.leaf.view={};else if(mode==='board-renamed'){f.files.delete(f.file.path);f.file.path='Boards/Renamed.thoughtspace';f.files.set(f.file.path,f.file);}else if(mode==='board-deleted')f.files.delete(f.file.path);else if(mode==='owner-replaced')f.origin.view.session={...f.owner};else if(mode==='draft')f.other.view.inlineTarget='a';else if(mode==='locked')f.owner.board.nodes[0].locked=true;else f.owner.board.edges[0].label='concurrent';const before=JSON.stringify(f.owner.board);gate.resolve();await assert.rejects(pending);assert.equal(JSON.stringify(f.owner.board),before);assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);
});
test('the command is detached before awaiting an existing save',async()=>{
 const f=fixture(),request=f.create(),gate=deferred(),original=f.owner.flush.bind(f.owner);let first=true;f.owner.flush=async()=>{if(first){first=false;await gate.promise;}return original();};const pending=f.host.editRelation(request,()=>true);await reached(()=>!first);if(request.action==='create')request.value.label='later form text';gate.resolve();await pending;assert.equal(f.owner.board.edges[0].label,'related');
});
test('cross-window duplicate submissions are rejected while the shared Session is pending',async()=>{
 const f=fixture(),remote=f.bind(f.other,f.docs[1]),gate=deferred();let writing=false;f.hooks.process=()=>{writing=true;return gate.promise;};const pending=f.host.editRelation(f.create(),()=>true);await reached(()=>writing);assert.equal(remote.host.relationEditing().available,false);await assert.rejects(remote.host.editRelation(f.create({to:'c'}),()=>true),/正在提交/);gate.resolve();await pending;assert.equal(f.owner.board.edges.length,1);assert.equal(f.owner.history.undoStack.length,1);assert.equal(remote.host.relationEditing().available,true);
});
test('cancellation after the synchronous commit does not roll back an authorized save or concurrent edits',async()=>{
 const f=fixture(),gate=deferred();let writing=false,current=true;f.hooks.process=async()=>{if(!writing){writing=true;await gate.promise;}};const pending=f.host.editRelation(f.create(),()=>current);await reached(()=>writing);current=false;f.owner.change((board:model.Board)=>{board.nodes[2].title='Another edit';},undefined,false,true,false,true);gate.resolve();const result=await pending;assert.equal(result.changed,true);assert.equal(f.owner.board.edges.length,1);assert.equal(f.owner.board.nodes[2].title,'Another edit');assert.equal(f.owner.history.undoStack.length,2);assert.deepEqual(JSON.parse(f.disk()),f.owner.board);
});
test('post-commit disk failure reports committed state and retains the Session recovery draft without retrying',async()=>{
 const f=fixture(),before=f.disk();f.hooks.process=async()=>{throw Error('disk offline');};await assert.rejects(f.host.editRelation(f.create(),()=>true),(error:unknown)=>error instanceof edits.LocalRelationEditSaveError&&error.committed);assert.equal(f.disk(),before);assert.equal(f.owner.board.edges.length,1);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.owner.blocked,true);assert.equal(f.recoveries.length,1);assert.deepEqual(JSON.parse(f.recoveries[0]),f.owner.board);assert.equal(f.host.relationEditing().available,false);await assert.rejects(f.host.editRelation(f.create({to:'c'}),()=>true),/暂停/);assert.equal(f.owner.board.edges.length,1);
});
test('a save conflict leaves the external board untouched and marks the local relation as committed',async()=>{
 const f=fixture(),external=JSON.stringify({...f.owner.board,viewport:{x:999,y:333,zoom:1}});f.setDisk(external);await assert.rejects(f.host.editRelation(f.create(),()=>true),(error:unknown)=>error instanceof edits.LocalRelationEditSaveError&&error.committed);assert.equal(f.disk(),external);assert.equal(f.owner.blocked,true);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.recoveries.length,1);
});
test('failure of a previous queued save prevents this relation from entering the Session',async()=>{
 const f=fixture();f.hooks.process=async()=>{throw Error('prior save failed');};f.owner.change((board:model.Board)=>{board.nodes[2].title='Prior edit';},undefined,false,true,false,true);await assert.rejects(f.host.editRelation(f.create(),()=>true),(error:any)=>error.committed!==true);assert.equal(f.owner.board.edges.length,0);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.owner.blocked,true);
});
test('brain history entry points undo and redo the shared whole-board Session history',async()=>{
 const f=fixture(),before=model.clone(f.owner.board);assert.equal(f.host.relationEditing().canUndo,false);assert.deepEqual(await f.host.historyRelation(false,()=>true),{changed:false});await f.host.editRelation(f.create(),()=>true);const created=model.clone(f.owner.board);assert.equal(f.host.relationEditing().canUndo,true);assert.equal(f.host.relationEditing().canRedo,false);assert.deepEqual(await f.host.historyRelation(false,()=>true),{changed:true});assert.deepEqual(f.owner.board,before);assert.equal(f.host.relationEditing().canRedo,true);await f.host.historyRelation(true,()=>true);assert.deepEqual(f.owner.board,created);assert.deepEqual(JSON.parse(f.disk()),created);
 f.owner.change((board:model.Board)=>{board.nodes[2].title='Unrelated board change';},undefined,false,true,false,true);await f.owner.flush();await f.host.historyRelation(false,()=>true);assert.deepEqual(f.owner.board,created,'the button undoes the actual board top, not a separate relation stack');await f.host.historyRelation(true,()=>true);assert.equal(f.owner.board.nodes[2].title,'Unrelated board change');
});
for(const mode of ['undo','redo','replace-history'] as const)test(`history ${mode} rejects a changed stack while earlier saves drain`,async()=>{
 const f=fixture();await f.host.editRelation(f.create(),()=>true);if(mode==='redo'){f.owner.undo();await f.owner.flush();}const gate=deferred(),original=f.owner.flush.bind(f.owner);let first=true;f.owner.flush=async()=>{if(first){first=false;await gate.promise;}return original();};const pending=f.host.historyRelation(mode==='redo',()=>true);await reached(()=>!first);
 if(mode==='replace-history')f.owner.history=new model.History();else f.owner.change((board:model.Board)=>{board.nodes[2].title='Concurrent history';},undefined,false,true,false,true);const before=model.clone(f.owner.board),history=JSON.stringify(f.owner.history);gate.resolve();await assert.rejects(pending,/撤销历史已变化/);assert.deepEqual(f.owner.board,before);assert.equal(JSON.stringify(f.owner.history),history);
});
test('history and relation mutations share the same cross-window pending guard',async()=>{
 const f=fixture(),remote=f.bind(f.other,f.docs[1]);await f.host.editRelation(f.create(),()=>true);const gate=deferred();let writing=false;f.hooks.process=()=>{writing=true;return gate.promise;};const pending=f.host.historyRelation(false,()=>true);await reached(()=>writing);assert.equal(remote.host.relationEditing().available,false);assert.equal(remote.host.relationEditing().canRedo,false);await assert.rejects(remote.host.editRelation(f.create({to:'c'}),()=>true),/正在提交/);await assert.rejects(remote.host.historyRelation(true,()=>true),/正在提交/);gate.resolve();await pending;assert.equal(f.owner.board.edges.length,0);assert.equal(f.owner.history.redoStack.length,1);
});
test('history cancellation before commit preserves the captured board and both history stacks',async()=>{
 const f=fixture();await f.host.editRelation(f.create(),()=>true);const before=model.clone(f.owner.board),history=JSON.stringify(f.owner.history),gate=deferred(),original=f.owner.flush.bind(f.owner);let first=true,current=true;f.owner.flush=async()=>{if(first){first=false;await gate.promise;}return original();};const pending=f.host.historyRelation(false,()=>current);await reached(()=>!first);current=false;gate.resolve();await assert.rejects(pending,/本次未提交/);assert.deepEqual(f.owner.board,before);assert.equal(JSON.stringify(f.owner.history),history);
});
test('history rejects same-board drafts instead of saving or cancelling the editor',async()=>{
 const f=fixture();await f.host.editRelation(f.create(),()=>true);f.other.view.inlineTarget='a';await assert.rejects(f.host.historyRelation(false,()=>true),/草稿已保留/);assert.equal(f.owner.board.edges.length,1);assert.equal(f.owner.history.undoStack.length,1);
});
test('failed undo save reports a committed history operation and preserves its recovery board',async()=>{
 const f=fixture();await f.host.editRelation(f.create(),()=>true);const disk=f.disk();f.hooks.process=async()=>{throw Error('undo disk failure');};await assert.rejects(f.host.historyRelation(false,()=>true),(error:unknown)=>error instanceof edits.LocalRelationEditSaveError&&error.committed);assert.equal(f.owner.board.edges.length,0);assert.equal(f.owner.history.redoStack.length,1);assert.equal(f.disk(),disk);assert.equal(f.owner.blocked,true);assert.deepEqual(JSON.parse(f.recoveries[0]),f.owner.board);
});

function foldedFitFixture(){
 const f=fixture();Object.assign(f.owner.board.nodes[0],{branchFolded:true});Object.assign(f.owner.board.nodes[1],{autoFit:true,width:80,height:60});Object.assign(f.owner.board.nodes[2],{autoFit:true});f.owner.board.edges=[{id:'folded',from:'a',to:'b',kind:'branch',label:''}];const note=new TFile('Notes/b.md');f.files.set(note.path,note);
 const fit=new FitView();Object.assign(fit,{session:f.owner,closed:false,pendingFits:new Map(),nodeKeys:new Map(f.owner.board.nodes.map((n:model.Card)=>[n.id,'preview-'+n.id])),nodeFitQueue:{schedule(){}},positions:new Map(),mutate:(fn:(b:model.Board)=>void)=>f.owner.change(fn,undefined,false,true,false,true)});
 const child=()=>f.owner.board.nodes.find((n:model.Card)=>n.id==='b') as model.Card,measure=(node=child())=>{fit.queueNodeFit(node,{width:385,height:867});fit.flushNodeFits();};return{...f,fit,note,child,measure};
}
test('revealing a folded auto-fit child through relation removal cannot save preview measurements',async()=>{
 const f=foldedFitFixture(),before=model.clone(f.owner.board);await f.host.editRelation(f.existing('remove','folded'),()=>true);assert.equal(mindmap.branchState(f.owner.board).hidden.has('b'),false);const writes=f.writes();for(let i=0;i<3;i++){await Promise.resolve();f.measure();await f.owner.flush();}assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.writes(),writes);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.fit.pendingFits.size,0);
});
test('a queued fit from before relation removal is discarded at flush in every shared view',async()=>{
 const f=foldedFitFixture(),other=new FitView();Object.assign(other,{session:f.owner,closed:false,pendingFits:new Map([['b',{width:600,height:1000,key:'preview-b'}]]),nodeKeys:new Map([['b','preview-b']])});f.fit.pendingFits.set('b',{width:385,height:867,key:'preview-b'});await f.host.editRelation(f.existing('remove','folded'),()=>true);f.fit.flushNodeFits();other.flushNodeFits();await f.owner.flush();assert.equal(f.child().width,80);assert.equal(f.child().height,60);assert.equal(f.writes(),1);assert.equal(f.fit.pendingFits.size,0);assert.equal(other.pendingFits.size,0);
});
test('create, remove, native undo and redo preserve geometry despite delayed old-node callbacks',async()=>{
 const f=foldedFitFixture(),before=model.clone(f.owner.board.nodes),old=f.child();await f.host.editRelation(f.existing('remove','folded'),()=>true);await f.host.editRelation(f.create({kind:'branch',label:''}),()=>true);assert.equal(mindmap.branchState(f.owner.board).hidden.has('b'),true);f.measure(old);f.owner.undo();await f.owner.flush();assert.equal(mindmap.branchState(f.owner.board).hidden.has('b'),false);f.measure({...old,width:999,height:999});f.owner.undo(true);await f.owner.flush();f.measure(old);f.owner.undo();await f.owner.flush();f.measure(old);await f.owner.flush();assert.deepEqual(f.owner.board.nodes,before);assert.equal(f.owner.history.undoStack.length,1);
});
test('converting a folded branch into an ordinary relation preserves the child preview geometry',async()=>{
 const f=foldedFitFixture(),before=model.clone(f.owner.board.nodes);await f.host.editRelation(f.existing('update','folded',{kind:'ordinary'}),()=>true);f.measure();await f.owner.flush();assert.deepEqual(f.owner.board.nodes,before);await f.host.historyRelation(false,()=>true);await f.host.historyRelation(true,()=>true);f.measure();await f.owner.flush();assert.deepEqual(f.owner.board.nodes,before);
});
test('revealing a child group also protects measured descendants whose visibility changed',async()=>{
 const f=foldedFitFixture();Object.assign(f.owner.board.nodes[1],{kind:'section',title:'Nested group',x:500,y:0,width:500,height:500});delete f.owner.board.nodes[1].file;delete f.owner.board.nodes[1].autoFit;const child=card('nested',{file:'Notes/nested.md',x:550,y:100,width:80,height:60,autoFit:true});f.owner.board.nodes.push(child);f.fit.nodeKeys.set(child.id,'preview-nested');const before=model.clone(f.owner.board.nodes);await f.host.editRelation(f.existing('remove','folded'),()=>true);f.measure(child);await f.owner.flush();assert.deepEqual(f.owner.board.nodes,before);assert.equal(f.owner.relationGeometryHeld(child),true);
});
test('a genuine source content modification releases the affected card for normal auto-fit',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);f.measure();assert.equal(f.child().width,80);f.note.stat.mtime++;f.note.stat.size+=25;f.measure();await f.owner.flush();assert.equal(f.child().width,385);assert.equal(f.child().height,867);assert.equal(f.owner.history.undoStack.length,1,'native measurement remains outside undo history');assert.equal(f.writes(),2);
});
test('replacing a source file identity releases auto-fit even if its mtime and size match',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);f.files.set(f.note.path,new TFile(f.note.path));f.measure();await f.owner.flush();assert.equal(f.child().width,385);assert.equal(f.owner.relationGeometryHeld(f.child()),false);
});
for(const setting of ['width','height','fontSize','fontFamily','preferredWidth','cardStyle'] as const)test(`an explicit ${setting} change releases the relation geometry guard`,async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);f.owner.change((board:model.Board)=>{const n=board.nodes.find(n=>n.id==='b')!;if(setting==='fontFamily')n.fontFamily='serif';else if(setting==='cardStyle')n.cardStyle='paper';else n[setting]=setting==='fontSize'?22:160;},undefined,false,true,false,true);f.measure();await f.owner.flush();assert.equal(f.child().width,385);assert.equal(f.child().height,867);
});
test('an explicit auto-fit command releases the guard even when the setting was already enabled',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);assert.equal(f.owner.relationGeometryHeld(f.child()),true);f.fit.fitCards(new Set(['b']),true);f.measure();await f.owner.flush();assert.equal(f.child().width,385);assert.equal(f.child().autoFit,true);
});
test('unrelated nodes keep their normal queued auto-fit while the revealed child is protected',async()=>{
 const f=foldedFitFixture(),other=f.owner.board.nodes.find((n:model.Card)=>n.id==='c');await f.host.editRelation(f.existing('remove','folded'),()=>true);f.measure(other);await f.owner.flush();assert.equal(other.width,385);assert.equal(other.height,867);assert.equal(f.child().width,80);assert.equal(f.owner.relationGeometryHeld(other),false);
});
test('saved relation geometry survives a new Session and is removed with its deleted node',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const saved=f.disk(),reopened=new Session(f.plugin,f.file,saved);assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),true);f.fit.session=reopened;f.measure(reopened.board.nodes[1]);await reopened.flush();assert.equal(f.disk(),saved);assert.equal(reopened.board.nodes[1].width,80);assert.equal(reopened.board.nodes[1].height,60);assert.equal(reopened.board.nodes[1].autoFit,true);assert.equal(reopened.history.undoStack.length,0);
 f.owner.change((board:model.Board)=>{board.nodes=board.nodes.filter(node=>node.id!=='b');},undefined,false,true,false,true);await f.owner.flush();assert.equal(f.owner.relationGeometry.has('b'),false);assert.equal(f.owner.board.relationGeometry,undefined);assert.equal(JSON.parse(f.disk()).relationGeometry,undefined);
});

for(const key of ['mtime','size','ctime'] as const)test(`a ${key} source change while closed releases saved geometry on reopening`,async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const saved=f.disk();(f.note.stat as any)[key]=((f.note.stat as any)[key]||0)+1;const reopened=new Session(f.plugin,f.file,saved);assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),false);f.fit.session=reopened;f.measure(reopened.board.nodes[1]);await reopened.flush();assert.equal(reopened.board.nodes[1].width,385);assert.equal(reopened.board.relationGeometry,undefined);assert.equal(JSON.parse(f.disk()).relationGeometry,undefined);
});
for(const key of ['width','fontSize','fontFamily','file'] as const)test(`a saved ${key} edit invalidates its old checkpoint without changing other nodes`,async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const edited=JSON.parse(f.disk());edited.nodes[1][key]=key==='file'?'Notes/new.md':key==='fontFamily'?'mono':key==='width'?160:22;f.setDisk(JSON.stringify(edited));const reopened=new Session(f.plugin,f.file,f.disk());assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),false);const other=model.clone(reopened.board.nodes[2]);f.fit.session=reopened;f.measure(reopened.board.nodes[1]);await reopened.flush();assert.equal(reopened.board.nodes[1].width,385);assert.deepEqual(reopened.board.nodes[2],other);
});
test('a missing source invalidates the saved source identity on reopening',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);f.files.delete(f.note.path);const reopened=new Session(f.plugin,f.file,f.disk());assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),false);
});
test('same-value explicit fit clears the saved checkpoint even without a size measurement',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const before=f.disk(),history=f.owner.history.undoStack.length;f.fit.fitCards(new Set(['b']),true);await f.owner.flush();assert.notEqual(f.disk(),before);assert.equal(JSON.parse(f.disk()).relationGeometry,undefined);assert.equal(f.owner.history.undoStack.length,history+1);assert.equal(f.child().width,80);assert.equal(f.child().autoFit,true);
 const reopened=new Session(f.plugin,f.file,f.disk());assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),false);f.fit.session=reopened;f.measure(reopened.board.nodes[1]);await reopened.flush();assert.equal(reopened.board.nodes[1].width,385);
 f.owner.undo();assert.equal(f.owner.relationGeometryHeld(f.child()),true);f.owner.undo(true);assert.equal(f.owner.relationGeometryHeld(f.child()),false);
});
test('a same-value fit queued behind an already serialized save remains cleared on disk',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const gate=deferred();let entered=false;f.hooks.process=async()=>{if(!entered){entered=true;await gate.promise;}};f.owner.change((b:model.Board)=>{b.nodes[2].title='Pending unrelated save';});await reached(()=>entered);f.fit.fitCards(new Set(['b']),true);gate.resolve();await f.owner.flush();assert.equal(JSON.parse(f.disk()).nodes[2].title,'Pending unrelated save');assert.equal(JSON.parse(f.disk()).relationGeometry,undefined);const reopened=new Session(f.plugin,f.file,f.disk());assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),false);
});
test('blocked or unrelated explicit fit cannot release the protected card',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const saved=f.disk();f.owner.blocked=true;f.fit.fitCards(new Set(['b']),true);assert.equal(f.owner.relationGeometryHeld(f.child()),true);f.owner.blocked=false;f.fit.fitCards(new Set(['missing']),true);await f.owner.flush();assert.equal(f.disk(),saved);assert.equal(f.owner.relationGeometryHeld(f.child()),true);
});
test('changing a sizing input away and back cannot revive a discarded checkpoint',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);f.owner.change((b:model.Board)=>{b.nodes[1].fontSize=22;});assert.equal(f.owner.relationGeometry.has('b'),false);f.owner.change((b:model.Board)=>{delete b.nodes[1].fontSize;});await f.owner.flush();assert.equal(JSON.parse(f.disk()).relationGeometry,undefined);const reopened=new Session(f.plugin,f.file,f.disk());assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),false);
});
for(const measured of [false,true])test(`undo and redo retain original source stamps after a source change (measured=${measured})`,async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const oldStamp=JSON.parse(f.owner.history.undoStack[0]).relationGeometry.entries.find((e:any)=>e.id==='b').source.mtime;assert.equal(oldStamp,f.note.stat.mtime);f.note.stat.mtime++;f.note.stat.size++;if(measured){f.measure();await f.owner.flush();assert.equal(f.child().width,385);}
 for(const redo of [false,true]){f.owner.undo(redo);await f.owner.flush();assert.equal(f.child().width,redo&&measured?385:80);assert.equal(f.owner.relationGeometryHeld(f.child()),false);assert.equal(f.owner.board.relationGeometry,undefined);const reopened=new Session(f.plugin,f.file,f.disk());assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),false);}
 f.measure();await f.owner.flush();assert.equal(f.child().width,385);
});
for(const mode of ['retain','remove','stale','malformed'] as const)test(`external board update ${mode} hydrates only the incoming geometry checkpoint`,async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const next=JSON.parse(f.disk());next.viewport.x=123;if(mode==='remove')delete next.relationGeometry;else if(mode==='stale')next.relationGeometry.entries[0].source.mtime+=1;else if(mode==='malformed')next.relationGeometry={version:99,entries:[]};f.setDisk(JSON.stringify(next));await f.owner.externalUpdate();assert.equal(f.owner.board.viewport.x,123);assert.equal(f.owner.relationGeometryHeld(f.child()),mode==='retain');const before=f.disk();f.measure();await f.owner.flush();if(mode==='retain')assert.equal(f.disk(),before);else assert.equal(f.child().width,385);
});
test('opening a legacy board with no checkpoint retains ordinary automatic fitting',async()=>{
 const f=foldedFitFixture(),raw=JSON.parse(f.disk());Object.assign(raw.nodes[1],{autoFit:true,width:80,height:60});f.setDisk(JSON.stringify(raw));const reopened=new Session(f.plugin,f.file,f.disk());f.fit.session=reopened;f.measure(reopened.board.nodes[1]);await reopened.flush();assert.equal(reopened.board.nodes[1].width,385);assert.equal(reopened.board.relationGeometry,undefined);
});

test('a failed synchronous fit transaction restores its live and persisted protection',async()=>{
 const f=foldedFitFixture();await f.host.editRelation(f.existing('remove','folded'),()=>true);const before=f.disk(),history=f.owner.history.undoStack.length;assert.throws(()=>f.owner.change((board:model.Board)=>{f.owner.releaseRelationGeometry(new Set(['b']));board.nodes[1].width=NaN;}),/尺寸无效/);assert.equal(f.owner.relationGeometryHeld(f.child()),true);assert.equal(JSON.stringify(f.owner.board),JSON.stringify(JSON.parse(before)));f.measure();await f.owner.flush();assert.equal(f.disk(),before);assert.equal(f.child().width,80);assert.equal(f.owner.history.undoStack.length,history);
});
test('releasing another card cannot refresh the stamp of a stale protected source',async()=>{
 const f=foldedFitFixture(),otherNote=new TFile('Notes/c.md');f.files.set(otherNote.path,otherNote);await f.host.editRelation(f.existing('remove','folded'),()=>true);await f.host.editRelation(f.create({to:'c'}),()=>true);assert.equal(f.owner.relationGeometryHeld(f.owner.board.nodes[2]),true);otherNote.stat.mtime++;f.fit.fitCards(new Set(['b']),true);await f.owner.flush();assert.equal(f.owner.relationGeometry.has('c'),false);assert.equal(JSON.parse(f.disk()).relationGeometry,undefined);const reopened=new Session(f.plugin,f.file,f.disk());assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[2]),false);
});
test('invalid source statistics cannot poison the optional checkpoint or prevent board saving',async()=>{
 const f=foldedFitFixture();f.note.stat.mtime=NaN;await f.host.editRelation(f.existing('remove','folded'),()=>true);assert.equal(f.owner.board.relationGeometry,undefined);assert.doesNotThrow(()=>model.parseBoard(f.disk()));assert.equal(f.child().width,80);
});
