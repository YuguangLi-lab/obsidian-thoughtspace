import * as ideas from '../src/brain-board-idea';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as state from '../src/board-mindmap';
import * as brain from '../src/brain-board';
import * as creation from '../src/brain-board-create';
import * as relationEdits from '../src/local-relations-edit';
import * as geometry from '../src/relation-geometry-checkpoint';
import {supportsLocalRelations,localRelationNode} from '../src/local-relations';
import {sectionContains} from '../src/sections';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {boardInputCommands,type BoardInputAction} from '../src/board-input-commands';

// Real Session transactions and BoardView host methods; native window rendering,
// source opening and pickers are boundary doubles, separately covered by native QA.
const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert(from>=0&&to>from,start);return source.slice(from,to);}
function compile(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
function deferred<T=void>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return{promise,resolve};}
async function settled(){for(let i=0;i<12;i++)await Promise.resolve();}
class TFile {stat={mtime:10,size:100,ctime:1};parent={path:'Boards'};constructor(public path:string){}get basename(){return this.path.split('/').pop()!.replace(/\.[^.]+$/,'');}get extension(){return this.path.split('.').pop()!;}}
class Element {
 isConnected=true;children:Element[]=[];classes=new Set<string>();matches=new Map<string,Element>();textContent='';
 constructor(public ownerDocument:{defaultView:{closed:boolean};activeElement?:Element}={defaultView:{closed:false}}){}
 createDiv(cls:string){const child=new Element(this.ownerDocument);child.addClass(cls);this.children.push(child);return child;}
 addClass(name:string){this.classes.add(name);}removeClass(name:string){this.classes.delete(name);}setText(text:string){this.textContent=text;}remove(){this.isConnected=false;}querySelector():Element|null{return null;}closest(selector:string){return this.matches.get(selector)??null;}contains(other:Element):boolean{return this===other||this.children.some(child=>child.contains(other));}
}
const card=(id:string,patch:Partial<model.Card>={}):model.Card=>model.clone({id,kind:'card',file:`Notes/${id}.md`,x:id==='a'?20:420,y:60,width:220,height:160,color:'sand',...patch});
function initialBoard(dedicated=true):model.Board {
 return{...(dedicated?brain.createBrainBoard('a'):{...model.emptyBoard(),version:3 as const}),nodes:[card('a'),card('b'),card('group',{kind:'section',title:'分组',file:undefined,x:-100,y:-100,width:1000,height:500}),card('text',{kind:'text',file:undefined,text:'兼容保留'}),card('child',{kind:'board',file:'Child.thoughtspace'})],edges:[{id:'edge',from:'a',to:'b',label:'现有关系'}],viewport:{x:45,y:28,zoom:.8}};
}
function fixture(initial=initialBoard()){
 const file=new TFile('Boards/Brain.thoughtspace'),files=new Map<string,TFile>([[file.path,file]]);for(const node of initial.nodes)if(node.file)files.set(node.file,new TFile(node.file));
 let disk=JSON.stringify(initial),writes=0,reflows=0,boardClones=0,nextId=0;const notices:string[]=[],errors:unknown[]=[],opens:any[]=[],leaves:{view:any}[]=[],focused:unknown[]=[],pickers:any[]=[],created:unknown[][]=[],nesting:unknown[][]=[],actions:Promise<unknown>[]=[],views:any[]=[];
 const hooks:{create?:()=>Promise<TFile>;nest?:()=>Promise<void>}={};
 const noteBytes=new Map<string,string>(),trashed:string[]=[];
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async(target:TFile)=>target===file?disk:noteBytes.get(target.path)??'',process:async(_file:TFile,change:(raw:string)=>string)=>{disk=change(disk);writes++;}},fileManager:{trashFile:async(file:TFile)=>{trashed.push(file.path);files.delete(file.path);noteBytes.delete(file.path);}},workspace:{getLeavesOfType:()=>leaves,setActiveLeaf:(leaf:unknown)=>focused.push(leaf),trigger:()=>{}}};
 const plugin={app,settings:{cardFolder:'Notes'},createUnique:async(...args:unknown[])=>{created.push(args);return hooks.create?.()||new TFile('Notes/New.md');},hierarchy:async(run:()=>Promise<void>)=>run(),assertCanNestReachable:async(...args:unknown[])=>{nesting.push(args);await hooks.nest?.();}};
 const Notice=class{constructor(message:string){notices.push(message);}};
 class Picker {opened=false;closed=false;onClose(){}open(){this.opened=true;}close(){this.closed=true;this.onClose();}constructor(){pickers.push(this);}}
 class NotePicker extends Picker {constructor(_app:unknown,public pick:(file:TFile)=>unknown){super();}}
 class BoardPicker extends Picker {constructor(_app:unknown,public current:TFile,public pick:(file:TFile)=>unknown){super();}}
 class Prompt extends Picker {constructor(_app:unknown,public title:string,public initial:string,public submit:(value:string)=>unknown){super();}}
 class ActionPicker extends Picker {constructor(_app:unknown,public title:string,public items:{title:string;run:()=>unknown}[]){super();}}
 class BrainNodeRenameModal extends Picker {constructor(_app:unknown,public host:any){super();}commit(name:string){return this.host.commit(name,()=>!this.closed);}}
 class BrainRelationCreateModal extends Picker {constructor(_app:unknown,public host:any){super();}commit(target:unknown){return this.host.commit(target,()=>!this.closed&&this.host.current());}}
 class MarkdownView {}
 class BrainBoardView {refreshes=0;searches=0;fits=0;resets=0;closed=false;focused:string[]=[];revealed:string[]=[];constructor(_app:unknown,public el:Element,public host:any){}refresh(){this.refreshes++;}revealRelation(id:string){this.revealed.push(id);}focusNode(id:string){this.focused.push(id);}focusSearch(){this.searches++;}fitToCanvas(){this.fits++;}resetZoom(){this.resets++;}unload(){this.closed=true;}}
 const Session=compile(take('class Session {','\ntype BoardGraph=')+';return Session',{...model,...mindmap,...geometry,...state,...brain,clone:(value:any)=>{if(Array.isArray(value?.nodes)&&Array.isArray(value?.edges))boardClones++;return model.clone(value);},EXT:'thoughtspace',Notice,report:(error:unknown)=>errors.push(error),reflowReadingContent:(...args:Parameters<typeof reflowReadingContent>)=>{reflows++;return reflowReadingContent(...args);}});
 const methods=take('  private requireOwner(','  private canCreateBlankText(')+take('  showAsBrainBoard(){','  addMindmap(')+take('  private mindmapSource(','  private mindmapNative(')+take('  get localRelationSelectedId(){','  localRelationSource(')+take('  findOnBoard()','  async copyDeepLink(')+take('  private paint =','  private scheduleRender(')+take('  private renderBoard(','  private pdfTotals=')+take('  inputCommandTarget():','  private setSelectionFold(');
 const View=compile('class BoardView{'+methods+'};return BoardView',{...ideas,...model,...brain,...state,...creation,...relationEdits,localRelationNode,supportsLocalRelations,sectionContains,BrainBoardView,BrainRelationCreateModal,BrainNodeRenameModal,MarkdownView,TFile,Notice,NotePicker,BoardPicker,Prompt,ActionPicker,themeSurface:()=>{},VIEW:'board',ROOT:'ThoughtSpace',EXT:'thoughtspace',uid:()=>`new-${++nextId}`,act:(run:()=>unknown)=>{const action=Promise.resolve().then(run);actions.push(action);void action.catch(error=>errors.push(error));}});
 const owner=new Session(plugin,file,disk);
 function makeView(session=owner){
  const view=new View(),contentEl=new Element(),leaf={view};
  Object.assign(view,{app,plugin,session,file:session.file,leaf,contentEl,nativeHeader:new Element(contentEl.ownerDocument),fileTitle:new Element(contentEl.ownerDocument),selected:new Set(['a']),dialogEpoch:0,brainObjectEpoch:0,closed:false,closing:false,mindmapFileIds:new WeakMap(),mindmapFileSequence:0,clears:0,
   world:{},clearCanvasGesture(){},clearNodes(){view.clears++;},renderSidebar(){},renderBoard(){if(brain.isBrainBoard(view.session?.board))View.prototype.renderBoard.call(view);else view.clearBrainBoard();},
   applyBoardBackground(){},addChild:(child:BrainBoardView)=>child,removeChild:(child:BrainBoardView)=>child.unload(),mindmapNative:()=>({relations:[],tagsByNode:new Map(),pendingPaths:[]}),
   openLocalRelationSource:async(...args:unknown[])=>{opens.push(args);},renameBoard:()=>{},copyDeepLink:async()=>{},
  });leaves.push(leaf);views.push(view);session.listeners.add(view.paint);if(brain.isBrainBoard(session.board))view.renderBrainBoard();return view;
 }
 const view=makeView(),mount=()=>{if(!view.brainBoardView)view.renderBrainBoard();return view.brainBoardView as BrainBoardView;};
 const drain=async()=>{await Promise.allSettled(actions);await owner.flush();await settled();};
 return{view,owner,Session,plugin,app,files,file,hooks,pickers,created,nesting,focused,opens,notices,errors,views,noteBytes,trashed,makeView,mount,drain,writes:()=>writes,reflows:()=>reflows,boardClones:()=>boardClones,disk:()=>disk};
}

test('confirmed directional creation saves note reference and edge as one independent undo transaction',async()=>{
 const f=fixture(),before=model.clone(f.owner.board);f.hooks.create=async()=>{const note=new TFile('Notes/Explicit.md');f.files.set(note.path,note);return note;};
 f.mount().host.createRelation('a','right',()=>true);const modal=f.pickers.at(-1);assert.equal(modal.host.side,'right');assert.equal(modal.host.document,f.view.contentEl.ownerDocument);assert.equal(f.created.length,0);
 await modal.commit({kind:'new',name:'Explicit'});await f.drain();assert.deepEqual(f.created,[['Notes','Explicit','md','']]);assert.equal(f.owner.board.brain.centerId,'a');assert.equal(f.owner.board.nodes.length,before.nodes.length+1);const edge=f.owner.board.edges.at(-1);assert.equal(edge.from,'a');assert.equal(edge.direction,'both');assert.equal(edge.kind,undefined);assert.equal(edge.fromSide,'right');assert.equal(f.owner.history.undoStack.length,1);assert.deepEqual(f.owner.board.nodes.slice(0,before.nodes.length),before.nodes);
 const saved=model.clone(f.owner.board);f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);assert(f.files.has('Notes/Explicit.md'));f.owner.undo(true);await f.drain();assert.deepEqual(new f.Session(f.plugin,f.file,f.disk()).board,saved);assert.deepEqual(f.trashed,[]);
});
test('existing-note confirmation reuses its board node without writing its source or copying body',async()=>{
 const f=fixture(),source=f.files.get('Notes/b.md')!;f.owner.board.edges=[];f.noteBytes.set(source.path,'Untouched source');f.mount().host.createRelation('a','left',()=>true);await f.pickers.at(-1).commit({kind:'existing',file:source,path:source.path});await f.drain();assert.equal(f.owner.board.nodes.length,5);assert.equal(f.owner.board.edges.length,1);assert.equal(f.owner.board.edges[0].to,'b');assert.equal(f.owner.board.edges[0].fromSide,'left');assert.equal(f.noteBytes.get(source.path),'Untouched source');assert.equal(f.created.length,0);assert.equal(f.owner.board.brain.centerId,'a');
});
test('closing before confirm and double confirmation cannot create extra notes or transactions',async()=>{
 const f=fixture(),gate=deferred<TFile>(),entered=deferred();f.hooks.create=async()=>{entered.resolve();return gate.promise;};f.mount().host.createRelation('a','bottom',()=>true);f.pickers.at(-1).close();assert.equal(f.created.length,0);
 f.mount().host.createRelation('a','bottom',()=>true);const modal=f.pickers.at(-1),first=modal.commit({kind:'new',name:'Only once'});await entered.promise;await modal.commit({kind:'new',name:'Duplicate'});const file=new TFile('Notes/Once.md');f.files.set(file.path,file);gate.resolve(file);await first;await f.drain();assert.equal(f.created.length,1);assert.equal(f.owner.board.nodes.length,6);assert.equal(f.owner.history.undoStack.length,1);
});
for(const stale of ['cancel','rename','center','replace','readonly','document','closed-window','close'])test(`new note in flight cleans up only its empty run-owned source after ${stale}`,async()=>{
 const f=fixture(),gate=deferred<TFile>(),entered=deferred();f.hooks.create=async()=>{entered.resolve();return gate.promise;};const before=model.clone(f.owner.board);f.mount().host.createRelation('a','bottom',()=>true);const modal=f.pickers.at(-1),pending=modal.commit({kind:'new',name:'Canceled'});await entered.promise;
 if(stale==='cancel')modal.close();if(stale==='rename')f.file.path='Boards/Renamed.thoughtspace';if(stale==='center')f.owner.board.brain.centerId='b';if(stale==='replace')f.owner.board=model.clone(f.owner.board);if(stale==='readonly')f.owner.blocked=true;if(stale==='document')f.view.contentEl.ownerDocument=new Element().ownerDocument;if(stale==='closed-window')f.view.contentEl.ownerDocument.defaultView.closed=true;if(stale==='close')f.view.closed=true;
 const file=new TFile('Notes/Canceled.md');f.files.set(file.path,file);gate.resolve(file);await assert.rejects(pending,/取消/);await f.drain();assert.equal(f.files.has(file.path),false);assert.deepEqual(f.trashed,[file.path]);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.edges,before.edges);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.view.brainRelationCreating,false);
});
test('canceled creation preserves a new note that acquired content, and unlocks a failed cleanup',async()=>{
 for(const cleanupFailure of [false,true]){
  const f=fixture(),gate=deferred<TFile>(),entered=deferred();f.hooks.create=async()=>{entered.resolve();return gate.promise;};f.mount().host.createRelation('a','right',()=>true);const modal=f.pickers.at(-1),pending=modal.commit({kind:'new',name:'Keep'});await entered.promise;modal.close();const file=new TFile('Notes/Keep.md');f.files.set(file.path,file);
  if(cleanupFailure)f.app.fileManager.trashFile=async()=>{throw Error('trash unavailable');};else f.noteBytes.set(file.path,'User content');gate.resolve(file);await assert.rejects(pending,cleanupFailure?/trash unavailable/:/取消/);assert(f.files.has(file.path));assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.view.brainRelationCreating,false);
 }
});
test('different window and board cannot retarget a pending confirmation or source identity',async()=>{
 const f=fixture(),original=f.files.get('Notes/b.md')!,otherOwner=new f.Session(f.plugin,new TFile('Boards/B.thoughtspace'),f.disk()),other=f.makeView(otherOwner);f.owner.board.edges=[];
 f.mount().host.createRelation('a','right',()=>true);const modal=f.pickers.at(-1),otherBefore=model.clone(otherOwner.board);f.view.session=otherOwner;await assert.rejects(modal.commit({kind:'existing',file:original,path:original.path}),/目标白板/);assert.deepEqual(otherOwner.board,otherBefore);assert.equal(f.created.length,0);
 f.view.session=f.owner;f.mount().host.createRelation('a','right',()=>true);const fresh=f.pickers.at(-1);f.files.set(original.path,new TFile(original.path));await assert.rejects(fresh.commit({kind:'existing',file:original,path:original.path}),/来源已变化/);assert.equal(f.owner.board.edges.length,0);assert.equal(other.session,otherOwner);
});

test('brain state and camera replacements avoid whole-board clones while retaining complete independent undo snapshots',async()=>{
 const f=fixture(),host=f.mount().host,original=model.clone(f.owner.board),next=state.updateBoardMindmapState(original.brain!,{type:'center',id:'b'},original.nodes),nodes=f.owner.board.nodes,edges=f.owner.board.edges;
 const camera={x:70,y:-25,zoom:.72};host.change(next);next.expandedIds.push('a');next.history.entries[0]='child';host.viewport(camera);camera.x=999;await host.open('group',()=>true);await f.drain();
 assert.equal(f.boardClones(),0);assert.equal(f.owner.board.nodes,nodes);assert.equal(f.owner.board.edges,edges);assert.deepEqual(f.owner.board.brain.expandedIds,['group']);assert.equal(f.owner.board.brain.history.entries[0],'a');
 const navigated=model.clone(f.owner.board),snapshots=[...f.owner.history.undoStack];
 f.owner.change((board:model.Board)=>{board.nodes.find(node=>node.id==='a')!.title='独立内容更新';board.edges[0].label='独立关系更新';},undefined,false,true,false,true);
 assert.equal(f.boardClones(),1);assert.deepEqual(f.owner.history.undoStack.slice(0,snapshots.length),snapshots);assert.deepEqual(JSON.parse(f.owner.history.undoStack.at(-1)),navigated);
 f.owner.undo();assert.deepEqual(f.owner.board,navigated);f.owner.undo();assert.equal(f.owner.board.brain.centerId,'b');assert.deepEqual(f.owner.board.brain.expandedIds,[]);assert.deepEqual(f.owner.board.brainViewport,navigated.brainViewport);
 f.owner.undo();assert.deepEqual(f.owner.board,original);f.owner.undo(true);f.owner.undo(true);f.owner.undo(true);await f.drain();
 const reopened=new f.Session(f.plugin,f.file,f.disk());assert.equal(reopened.board.nodes.find((node:model.Card)=>node.id==='a').title,'独立内容更新');assert.equal(reopened.board.edges[0].label,'独立关系更新');assert.deepEqual(reopened.board.brainViewport,{x:70,y:-25,zoom:.72});assert.deepEqual(reopened.board.brain.expandedIds,['group']);assert.equal(f.errors.length,0);
});

test('first default dialog creates a named idea without Markdown and supports one undo/redo',async()=>{
 const b=brain.createBrainBoard(),f=fixture(b);f.mount();f.view.addBrainObject();const picker=f.pickers.at(-1);await picker.commit({kind:'idea',name:'先记录研究方向'});await f.drain();const n=f.owner.board.nodes[0];assert(n.brainIdea);assert.equal(n.kind,'text');assert.equal(n.file,undefined);assert.equal(f.owner.board.brain.centerId,n.id);assert.equal(f.created.length,0);assert.equal(f.owner.history.undoStack.length,1);f.owner.undo();assert.equal(f.owner.board.nodes.length,0);f.owner.undo(true);await f.drain();assert.equal(f.owner.board.nodes[0].id,n.id);assert.equal(model.parseBoard(f.disk()).brain?.centerId,n.id);
});
test('idea seed cancellation, read-only and graph change preserve source-free state',async()=>{
 const f=fixture(brain.createBrainBoard());f.mount();f.view.addBrainObject();const p=f.pickers.at(-1);p.close();await assert.rejects(p.commit({kind:'idea',name:'取消'}));assert.equal(f.owner.board.nodes.length,0);f.owner.blocked=true;assert.throws(()=>f.view.addBrainObject());assert.equal(f.created.length,0);
});
test('four-direction ideas preserve center and participate in native branch semantics',async()=>{
 for(const side of ['top','bottom','left','right']){const f=fixture();f.mount().host.createRelation('a',side,()=>true);await f.pickers.at(-1).commit({kind:'idea',name:'Idea '+side});await f.drain();const n=f.owner.board.nodes.at(-1),e=f.owner.board.edges.at(-1);assert(n.brainIdea);assert.equal(f.owner.board.brain.centerId,'a');assert.equal(e.from,side==='top'?n.id:'a');assert.equal(e.to,side==='top'?'a':n.id);assert.equal(e.kind,['top','bottom'].includes(side)?'branch':undefined);assert.equal(f.created.length,0);}
});
test('explicit idea conversion keeps every relation and native file survives undo',async()=>{
 const b=initialBoard();b.nodes[0]=ideas.brainIdeaNode('a','Original idea');b.brain!.descendantDepth=5;const f=fixture(b);f.mount();f.plugin.createUnique=async(...args:unknown[])=>{f.created.push(args);const file=new TFile('Notes/Converted.md');f.files.set(file.path,file);f.noteBytes.set(file.path,String(args[3]));return file;};f.view.openBrainSeed('a');await f.pickers.at(-1).commit({kind:'new',name:'Converted'});await f.drain();assert.equal(f.owner.board.nodes[0].kind,'card');assert.deepEqual(f.owner.board.edges,b.edges);assert.equal(f.owner.board.brain.descendantDepth,5);f.owner.undo();assert(f.owner.board.nodes[0].brainIdea);assert(f.files.has('Notes/Converted.md'));assert.equal(f.trashed.length,0);f.owner.undo(true);assert.equal(f.owner.board.nodes[0].file,'Notes/Converted.md');
});
test('failed note creation leaves idea, graph and history untouched',async()=>{
 const b=initialBoard();b.nodes[0]=ideas.brainIdeaNode('a','Keep idea');const f=fixture(b),before=model.clone(f.owner.board);f.mount();f.plugin.createUnique=async()=>{throw Error('Disk full');};f.view.openBrainSeed('a');await assert.rejects(f.pickers.at(-1).commit({kind:'new',name:'Name'}),/Disk full/);assert.deepEqual(f.owner.board,before);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.owner.board.nodes[0].brainIdea,true);
});
test('conversion board write failure retains idea, relationships and generated note',async()=>{
 const b=initialBoard();b.nodes[0]=ideas.brainIdeaNode('a','Keep on write failure');const f=fixture(b);f.mount();f.plugin.createUnique=async(...args:unknown[])=>{const file=new TFile('Notes/Failed-save.md');f.files.set(file.path,file);f.noteBytes.set(file.path,String(args[3]));return file;};f.app.vault.process=async()=>{throw Error('Board disk unavailable');};f.view.openBrainSeed('a');await assert.rejects(f.pickers.at(-1).commit({kind:'new',name:'Name'}),/想法与关系已保留/);assert(f.owner.blocked);assert(f.owner.board.nodes[0].brainIdea);assert.deepEqual(f.owner.board.edges,b.edges);assert(f.files.has('Notes/Failed-save.md'));assert.equal(f.trashed.length,0);assert.equal(f.owner.history.undoStack.length,0);
});

test('brain field replacement keeps state and geometry validation, rollback and no-op redo protection',async()=>{
 const f=fixture(),host=f.mount().host,original=model.clone(f.owner.board);
 assert.throws(()=>host.change({...f.owner.board.brain,expandedIds:Array.from({length:9},(_,i)=>'invalid-'+i)}),/脑图状态无效/);assert.deepEqual(f.owner.board,original);
 assert.throws(()=>host.viewport({x:0,y:0,zoom:1,extra:true}),/视口无效/);assert.deepEqual(f.owner.board,original);assert.equal(f.owner.history.undoStack.length,0);
 host.viewport({x:NaN,y:0,zoom:1});host.viewport({x:0,y:0,zoom:3});assert.deepEqual(f.owner.board,original);
 host.change(state.updateBoardMindmapState(f.owner.board.brain,{type:'center',id:'b'},f.owner.board.nodes));f.owner.undo();const redo=[...f.owner.history.redoStack];host.change(model.clone(f.owner.board.brain));assert.deepEqual(f.owner.history.redoStack,redo);assert.equal(f.boardClones(),0);
 f.owner.board.nodes[0].x=Infinity;const before=f.owner.board.brain;assert.throws(()=>host.change(state.createBoardMindmapState('b')),/尺寸无效/);assert.equal(f.owner.board.brain,before);assert.equal(f.owner.board.nodes[0].x,Infinity);f.owner.board.nodes[0].x=original.nodes[0].x;await f.drain();assert.equal(f.errors.length,0);assert.equal(JSON.parse(f.disk()).brain.centerId,'a');
});

test('saving a brain navigation intent repaints each shared view once and status-only saves do not rebuild the graph',async()=>{
 const f=fixture(),second=f.makeView(),first=f.mount(),other=second.brainBoardView;
 const before=[first.refreshes,other.refreshes];let statusUpdates=0;
 f.view.renderSaveStatus=()=>statusUpdates++;second.renderSaveStatus=()=>statusUpdates++;
 first.host.change(state.updateBoardMindmapState(f.owner.board.brain,{type:'center',id:'b'},f.owner.board.nodes));await f.drain();
 assert.deepEqual([first.refreshes-before[0],other.refreshes-before[1]],[1,1]);
 assert.equal(f.writes(),1);assert.equal(first.host.snapshot().board.brain.centerId,'b');assert.equal(other.host.snapshot().board.brain.centerId,'b');assert(statusUpdates>=4);assert.equal(f.focused.length,0);
 const saved=[first.refreshes,other.refreshes];f.owner.persist();await f.drain();
 assert.deepEqual([first.refreshes,other.refreshes],saved);assert.equal(f.writes(),1);
});

test('failed brain save still repaints shared views as read-only and retains recovery protection',async()=>{
 const f=fixture(),second=f.makeView(),first=f.mount(),other=second.brainBoardView,original=f.disk(),before=[first.refreshes,other.refreshes];
 f.app.vault.process=async()=>{throw Error('外部写入冲突');};
 first.host.change(state.updateBoardMindmapState(f.owner.board.brain,{type:'center',id:'b'},f.owner.board.nodes));await f.drain();
 assert.deepEqual([first.refreshes-before[0],other.refreshes-before[1]],[2,2]);assert.equal(first.host.snapshot().readOnly,true);assert.equal(other.host.snapshot().readOnly,true);
 assert.equal(f.disk(),original);assert.equal(f.created.length,1);assert.match(String(f.created[0][1]),/恢复草稿/);
 const frozen=model.clone(f.owner.board);first.host.change(state.createBoardMindmapState('a'));first.host.viewport({x:9,y:9,zoom:1});await f.drain();assert.deepEqual(f.owner.board,frozen);assert.equal(f.writes(),0);
});

test('shared brain intents and undo during an in-flight save drain to the latest state and reopen exactly',async()=>{
 const f=fixture(),first=f.mount(),second=f.makeView().brainBoardView,original=model.clone(f.owner.board),gate=deferred(),entered=deferred(),process=f.app.vault.process;
 let calls=0;f.app.vault.process=async(file,change)=>{if(++calls===1){entered.resolve();await gate.promise;}return process(file,change);};
 const change=(host:any,action:state.BoardMindmapAction)=>host.change(state.updateBoardMindmapState(f.owner.board.brain,action,f.owner.board.nodes));
 change(first.host,{type:'center',id:'b'});await entered.promise;assert.equal(f.owner.saving,true);
 change(second.host,{type:'expand',id:'b'});change(first.host,{type:'center',id:'group'});change(second.host,{type:'history',direction:'back'});
 assert.equal(first.host.shortcut({target:first.el,key:'z',metaKey:true}),true);assert.equal(second.host.shortcut({target:second.el,key:'z',metaKey:true,shiftKey:true}),true);const expected=model.clone(f.owner.board);assert.equal(expected.brain!.centerId,'b');assert.deepEqual(expected.brain!.expandedIds,['b']);
 assert.deepEqual(JSON.parse(f.disk()),original);gate.resolve();await f.drain();
 assert.deepEqual(JSON.parse(f.disk()),expected);assert.deepEqual(new f.Session(f.plugin,f.file,f.disk()).board,expected);assert.equal(f.owner.blocked,false);assert.equal(f.owner.saving,false);assert.equal(f.owner.status,'已保存');assert.equal(f.writes(),2);assert.deepEqual(f.errors,[]);
 assert.deepEqual(first.host.snapshot().board,expected);assert.deepEqual(second.host.snapshot().board,expected);assert.deepEqual(expected.nodes,original.nodes);assert.deepEqual(expected.edges,original.edges);assert.deepEqual(f.focused,[]);
});

test('a failed in-flight save recovers the latest shared brain intents once and never overwrites original bytes',async()=>{
 const f=fixture(),first=f.mount(),second=f.makeView().brainBoardView,original=f.disk(),gate=deferred(),entered=deferred();let calls=0;
 f.app.vault.process=async()=>{calls++;entered.resolve();await gate.promise;throw Error('isolated queued write failure');};
 first.host.change(state.updateBoardMindmapState(f.owner.board.brain,{type:'center',id:'b'},f.owner.board.nodes));await entered.promise;
 second.host.change(state.updateBoardMindmapState(f.owner.board.brain,{type:'expand',id:'b'},f.owner.board.nodes));first.host.change(state.updateBoardMindmapState(f.owner.board.brain,{type:'center',id:'group'},f.owner.board.nodes));second.host.viewport({x:31,y:-12,zoom:.85});
 const expected=model.clone(f.owner.board);gate.resolve();await f.drain();
 assert.equal(calls,1);assert.equal(f.disk(),original);assert.equal(f.writes(),0);assert.equal(f.created.length,1);assert.match(String(f.created[0][1]),/恢复草稿/);assert.deepEqual(JSON.parse(String(f.created[0][3])),expected);assert.equal(first.host.snapshot().readOnly,true);assert.equal(second.host.snapshot().readOnly,true);assert.equal(f.owner.saving,false);assert.match(f.owner.status,/已另存恢复草稿/);
 first.host.change(state.createBoardMindmapState('a'));second.host.viewport({x:0,y:0,zoom:1});f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,expected);assert.equal(f.created.length,1);assert.equal(f.errors.length,1);assert.match(String(f.errors[0]),/isolated queued write failure/);
});

test('explicit conversion and undo preserve ordinary geometry, edges, legacy mode and the original camera',async()=>{
 const initial=initialBoard(false);initial.mode='mindmap';const f=fixture(initial),before=model.clone(f.owner.board);f.view.showAsBrainBoard();await f.drain();
 assert(brain.isBrainBoard(f.owner.board));assert.equal(f.owner.board.brain.centerId,'a');assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.edges,before.edges);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.owner.board.mode,'mindmap');assert.equal(f.reflows(),0);
 f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.view.brainBoardView,undefined);assert.equal(f.view.contentEl.classes.has('ts-brain-board'),false);
 f.owner.undo(true);await f.drain();assert(brain.isBrainBoard(new f.Session(f.plugin,f.file,f.disk()).board));
});

test('converting a shared board preserves another window inline draft without clearing either view or saving',async()=>{
 const f=fixture(initialBoard(false)),other=f.makeView(),draft={text:'Unsaved native-window draft'},before=model.clone(f.owner.board);other.inline=draft;
 assert.throws(()=>f.view.showAsBrainBoard(),/编辑|草稿|转换/);await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(other.inline,draft);assert.equal(f.view.clears,0);assert.equal(other.clears,0);assert.equal(f.view.brainBoardView,undefined);assert.equal(other.brainBoardView,undefined);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes(),0);
});

test('converting a board waits for its pending asynchronous text conversion to finish',async()=>{
 const f=fixture(initialBoard(false)),before=model.clone(f.owner.board);f.owner.convertingTexts.add('text');assert.throws(()=>f.view.showAsBrainBoard(),/编辑|草稿|转换/);await f.drain();assert.deepEqual(f.owner.board,before);assert.deepEqual([...f.owner.convertingTexts],['text']);assert.equal(f.view.clears,0);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes(),0);
});

test('converting one board leaves an unrelated board window and its inline draft untouched',async()=>{
 const f=fixture(initialBoard(false)),otherOwner=new f.Session(f.plugin,new TFile('Other.thoughtspace'),JSON.stringify(initialBoard(false))),other=f.makeView(otherOwner),draft={text:'Another board draft'},before=model.clone(otherOwner.board);other.inline=draft;
 f.view.showAsBrainBoard();await f.drain();assert(brain.isBrainBoard(f.owner.board));assert.deepEqual(otherOwner.board,before);assert.equal(other.inline,draft);assert.equal(other.clears,0);assert.equal(otherOwner.history.undoStack.length,0);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.writes(),1);
});

test('rendering, source inspection and repeated refresh mount one canvas and never save or focus a window',async()=>{
 const f=fixture(),before=model.clone(f.owner.board),mounted=f.mount();for(let i=0;i<12;i++){f.view.renderBoard();mounted.host.snapshot();mounted.host.source('a');}await f.drain();
 assert.equal(f.view.brainBoardView,mounted);assert.equal(f.view.clears,1);assert.equal(mounted.refreshes,12);assert.equal(f.writes(),0);assert.deepEqual(f.focused,[]);assert.deepEqual(mounted.focused,[]);assert.deepEqual(f.owner.board,before);assert.equal(f.reflows(),0);
});

test('captured state changes save with no source or camera movement and update a second window without stealing focus',async()=>{
 const f=fixture(),first=f.mount(),other=f.makeView();other.renderBrainBoard();const second=other.brainBoardView,before=model.clone(f.owner.board),next=state.createBoardMindmapState('b');
 first.host.change(next);next.history.entries.push('caller mutation');await f.drain();assert.equal(first.host.snapshot().board.brain.centerId,'b');assert.equal(second.host.snapshot().board.brain.centerId,'b');assert(second.refreshes>0);assert.deepEqual(second.focused,[]);assert.deepEqual(f.focused,[]);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.edges,before.edges);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.reflows(),0);
 const changed=model.clone(f.owner.board),writes=f.writes();first.host.change(model.clone(f.owner.board.brain));await f.drain();assert.equal(f.writes(),writes);assert.equal(f.owner.history.undoStack.length,1);
 f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);f.owner.undo(true);await f.drain();assert.deepEqual(new f.Session(f.plugin,f.file,f.disk()).board,changed);
});

test('dedicated reveal changes only the center and focuses only when the caller explicitly requests it',async()=>{
 const f=fixture(),mounted=f.mount(),before=model.clone(f.owner.board);f.view.revealNode('b',false);await f.drain();assert.equal(f.owner.board.brain.centerId,'b');assert.deepEqual(f.focused,[]);assert.deepEqual(mounted.focused,[]);
 f.view.revealNode('group');await f.drain();assert.equal(f.owner.board.brain.centerId,'group');assert.deepEqual(f.focused,[f.view.leaf]);assert.deepEqual(mounted.focused,['group']);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.edges,before.edges);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.reflows(),0);
 const writes=f.writes();f.view.revealNode('text');f.view.revealNode('missing');await f.drain();assert.equal(f.writes(),writes);assert.equal(f.owner.board.brain.centerId,'group');
});

test('native source open retains its owning leaf, edit intent and cancellation guard without changing geometry',async()=>{
 const f=fixture(),mounted=f.mount(),before=model.clone(f.owner.board);let current=true;await mounted.host.open('b',()=>current,true);assert.equal(f.opens.length,1);const [id,valid,leaf,options]=f.opens[0];assert.equal(id,'b');assert.equal(leaf,f.view.leaf);assert.deepEqual(options,{edit:true});assert.equal(valid(),true);
 current=false;assert.equal(valid(),false);await mounted.host.open('a',()=>false);assert.equal(f.opens.length,1);assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

test('opening a group centers and expands it in one undoable transaction without changing its contents or geometry',async()=>{
 const f=fixture(),mounted=f.mount(),before=model.clone(f.owner.board);await mounted.host.open('group',()=>true);await f.drain();assert.equal(f.owner.board.brain.centerId,'group');assert.deepEqual(f.owner.board.brain.expandedIds,['group']);assert.equal(f.owner.history.undoStack.length,1);assert.deepEqual(mounted.focused,['group']);assert.equal(f.opens.length,0);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.edges,before.edges);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.reflows(),0);
 const writes=f.writes();await mounted.host.open('group',()=>true);await f.drain();assert.equal(f.writes(),writes);assert.equal(f.owner.history.undoStack.length,1);f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);
});

test('native command eligibility excludes hidden free-board editing, text creation and layout actions',async()=>{
 const f=fixture(),target=f.view.inputCommandTarget(),before=model.clone(f.owner.board);
 const disallowed:BoardInputAction[]=['newText','tidy','edit','selection','connect','focus','fold','expand','duplicate','remove','childTopic','siblingTopic','parentTopic','read'];
 for(const action of disallowed){assert.equal(target.canRun(action),false,action);target.run(action);}
 for(const action of ['newCard','insertNote','newSection','find','fit','reset','undo','redo'])assert.equal(target.canRun(action),true,action);
 await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.pickers.length,0);assert.equal(f.writes(),0);assert.equal(f.opens.length,0);
});

test('native commands route new notes, existing notes and groups to dedicated pickers and leave the board unchanged until selection',async()=>{
 const f=fixture(),commands=boardInputCommands(()=>f.view.inputCommandTarget()),before=model.clone(f.owner.board);
 for(const [id,label]of [['new-card','新建脑图笔记'],['insert-note',undefined],['new-section','新建分组节点']] as const){
  const command=commands.find(item=>item.id==='board-input-'+id)!;assert.equal(command.checkCallback!(true),true);assert.equal(command.checkCallback!(false),true);await f.drain();const picker=f.pickers.at(-1);assert.equal(picker.opened,true);assert.equal(picker.title,label);assert.equal(typeof(id==='insert-note'?picker.pick:picker.submit),'function');picker.close();
 }
 assert.equal(f.pickers.length,3);assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);assert.equal(f.created.length,0);
});

test('native search, fit and reset commands use the dedicated canvas instead of the ordinary board camera',async()=>{
 const f=fixture(),mounted=f.mount(),target=f.view.inputCommandTarget(),before=model.clone(f.owner.board);target.run('find');target.run('fit');target.run('reset');await f.drain();assert.equal(mounted.searches,1);assert.equal(mounted.fits,1);assert.equal(mounted.resets,1);f.view.findOnBoard();assert.equal(mounted.searches,2);assert.equal(f.view.searchModal,undefined);assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

test('native command scope leaves the focused search input and local inline drafts to their editor',async()=>{
 const f=fixture(),input=f.view.contentEl.createDiv('search');input.matches.set('input,textarea,select,[contenteditable=true]',input);f.view.contentEl.ownerDocument.activeElement=input;const commands=boardInputCommands(()=>f.view.inputCommandTarget());assert.equal(f.view.inputCommandTarget().editing,true);
 for(const command of commands)assert.equal(command.checkCallback!(false),false,command.id);await f.drain();assert.equal(f.pickers.length,0);assert.equal(f.writes(),0);
 f.view.contentEl.ownerDocument.activeElement=undefined;f.view.inline={text:'local draft'};assert.equal(f.view.inputCommandTarget().editing,true);assert.equal(commands.find(item=>item.id==='board-input-undo')!.checkCallback!(false),false);
});

test('native command undo preserves another window draft, then restores dedicated state when the draft is released',async()=>{
 const f=fixture(),mounted=f.mount(),other=f.makeView();mounted.host.change(state.createBoardMindmapState('b'));await f.drain();const target=f.view.inputCommandTarget(),before=model.clone(f.owner.board),draft={text:'native editor draft'};other.inline=draft;target.run('undo');await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(other.inline,draft);other.inline=undefined;target.run('undo');await f.drain();assert.equal(f.owner.board.brain.centerId,'a');target.run('redo');await f.drain();assert.deepEqual(f.owner.board,before);
});

test('captured native command target rechecks the current owner before opening or changing another board',async()=>{
 const f=fixture(),target=f.view.inputCommandTarget(),before=model.clone(f.owner.board);f.view.session=new f.Session(f.plugin,new TFile('Other.thoughtspace'),JSON.stringify(initialBoard()));assert.equal(target.canRun('newSection'),false);target.run('newSection');target.run('undo');await f.drain();assert.equal(f.pickers.length,0);assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

for(const mode of ['owner','removed','closed','closing','presentation','leaf'] as const)test(`stale ${mode} brain hosts cannot change, navigate, or save a replacement board`,async()=>{
 const f=fixture(),mounted=f.mount();if(mode==='owner')f.view.session={};else if(mode==='removed')mounted.el.isConnected=false;else if(mode==='presentation'){delete f.owner.board.presentation;delete f.owner.board.brain;}else if(mode==='leaf')f.view.leaf.view={};else f.view[mode]=true;
 const before=model.clone(f.owner.board);assert.equal(mounted.host.snapshot(),undefined);mounted.host.change(state.createBoardMindmapState('b'));mounted.host.viewport({x:100,y:200,zoom:1.2});await mounted.host.open('b',()=>true);await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.opens.length,0);assert.equal(f.writes(),0);
});

test('read-only brain hosts reject mutation and addition while source reading remains available',async()=>{
 const f=fixture(),mounted=f.mount(),before=model.clone(f.owner.board);f.owner.blocked=true;assert.equal(mounted.host.snapshot().readOnly,true);mounted.host.change(state.createBoardMindmapState('b'));mounted.host.viewport({x:1,y:2,zoom:.5});assert.throws(()=>f.view.addBrainObject('note'),/暂停/);assert.equal(mounted.host.source('a').available,true);await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

test('brain camera has a separate validated transaction and no ordinary geometry or history changes',async()=>{
 const f=fixture(),mounted=f.mount(),before=model.clone(f.owner.board);mounted.host.viewport({x:19.5,y:-23,zoom:.75});await f.drain();assert.deepEqual(f.owner.board.brainViewport,{x:19.5,y:-23,zoom:.75});assert.deepEqual(f.owner.board.viewport,before.viewport);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.reflows(),0);
 const writes=f.writes();for(const camera of [{x:NaN,y:0,zoom:1},{x:0,y:0,zoom:3},{x:0,y:0,zoom:0}])mounted.host.viewport(camera);await f.drain();assert.equal(f.writes(),writes);
});

test('shared-window draft blocks undo while a draft belonging to another board does not',async()=>{
 const f=fixture(),mounted=f.mount(),other=f.makeView(),event={target:mounted.el,key:'z',metaKey:true};mounted.host.change(state.createBoardMindmapState('b'));await f.drain();const before=model.clone(f.owner.board),draft={text:'popup draft'};other.inline=draft;assert.equal(mounted.host.shortcut(event),true);assert.deepEqual(f.owner.board,before);assert.equal(other.inline,draft);assert.match(f.notices.at(-1)!,/草稿已保留/);
 other.session=new f.Session(f.plugin,new TFile('Other.thoughtspace'),JSON.stringify(initialBoard()));assert.equal(mounted.host.shortcut(event),true);await f.drain();assert.equal(f.owner.board.brain.centerId,'a');assert.equal(other.inline,draft);
});

for(const kind of ['note','section','board'] as const)test(`${kind} insertion uses existing object references, can be undone, and preserves every existing coordinate`,async()=>{
 const f=fixture(),before=model.clone(f.owner.board);f.view.addBrainObject(kind);const picker=f.pickers.at(-1);if(kind==='section')picker.submit('研究分组');else await picker.pick(f.files.get(kind==='note'?'Notes/b.md':'Child.thoughtspace'));await f.drain();
 assert.equal(f.owner.board.nodes.length,before.nodes.length+1);assert.deepEqual(f.owner.board.nodes.slice(0,-1),before.nodes);assert.deepEqual(f.owner.board.edges,before.edges);assert.deepEqual(f.owner.board.viewport,before.viewport);const added=f.owner.board.nodes.at(-1);assert.equal(added.kind,kind==='note'?'card':kind);assert.equal(f.owner.board.brain.centerId,added.id);assert.equal(f.created.length,0);if(kind==='board')assert.equal(f.nesting.length,1);assert.equal(f.reflows(),0);
 f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);
});

for(const kind of ['note','section','board'] as const)test(`first ${kind} in a newly created empty brain becomes its saved center and undo restores the empty board`,async()=>{
 const f=fixture(brain.createBrainBoard()),before=model.clone(f.owner.board),file=new TFile(kind==='note'?'Notes/Knowledge.md':'Boards/Knowledge.thoughtspace');f.files.set(file.path,file);
 f.view.addBrainObject(kind);const picker=f.pickers.at(-1);if(kind==='section')picker.submit('知识分组');else await picker.pick(file);await f.drain();
 const added=f.owner.board.nodes[0];assert.equal(f.owner.board.nodes.length,1);assert.equal(added.kind,kind==='note'?'card':kind);assert.equal(f.owner.board.brain.centerId,added.id);assert.equal(f.owner.board.presentation,'brain');assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.created.length,0);assert.equal(f.reflows(),0);assert.deepEqual(f.owner.board.edges,[]);
 const saved=model.clone(f.owner.board),reopened=new f.Session(f.plugin,f.file,f.disk());assert.deepEqual(reopened.board,saved);assert.equal(reopened.board.brain.centerId,added.id);
 f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);f.owner.undo(true);await f.drain();assert.deepEqual(f.owner.board,saved);
});

for(const kind of ['note','new-note','section','board'] as const)test(`cancelled ${kind} picker never creates, inserts, focuses or saves anything`,async()=>{
 const f=fixture(),before=model.clone(f.owner.board);f.view.addBrainObject(kind);f.pickers.at(-1).close();await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.created.length,0);assert.equal(f.writes(),0);assert.equal(f.focused.length,0);assert.equal(f.opens.length,0);
});

for(const mode of ['owner','epoch','blocked','source'] as const)test(`note picker refuses a ${mode} change before accepting its captured source`,async()=>{
 const f=fixture();f.view.addBrainObject('note');const picker=f.pickers.at(-1),file=f.files.get('Notes/b.md')!;if(mode==='owner')f.view.session={};else if(mode==='epoch')f.view.dialogEpoch++;else if(mode==='blocked')f.owner.blocked=true;else f.files.set(file.path,new TFile(file.path));const before=model.clone(f.owner.board);assert.throws(()=>picker.pick(file),/来源或白板已变化/);await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

test('sub-board insertion rechecks the owner and file identity after asynchronous nesting validation',async()=>{
 const f=fixture(),gate=deferred(),before=model.clone(f.owner.board);f.hooks.nest=()=>gate.promise;f.view.addBrainObject('board');const file=f.files.get('Child.thoughtspace')!,pending=f.pickers.at(-1).pick(file);await settled();f.files.set(file.path,new TFile(file.path));gate.resolve();await pending;await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

test('new note creation that outlives its owning file keeps the created note without adding a stale reference or opening it',async()=>{
 const f=fixture(),gate=deferred<TFile>(),before=model.clone(f.owner.board);f.hooks.create=()=>gate.promise;f.view.addBrainObject('new-note');const pending=f.pickers.at(-1).submit('Note');await settled();f.view.dialogEpoch++;gate.resolve(new TFile('Notes/Retained.md'));await pending;await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.created.length,1);assert.equal(f.writes(),0);assert.equal(f.opens.length,0);assert.match(f.notices.at(-1)!,/笔记已创建.*未添加引用/);
});

test('closing an in-flight new-note prompt cancels board insertion and source opening',async()=>{
 const f=fixture(),gate=deferred<TFile>(),before=model.clone(f.owner.board);f.hooks.create=()=>gate.promise;f.view.addBrainObject('new-note');const prompt=f.pickers.at(-1),pending=prompt.submit('Note');await settled();prompt.close();gate.resolve(new TFile('Notes/Cancelled.md'));await pending;await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);assert.equal(f.opens.length,0);
});

test('replacing an in-flight sub-board picker cancels its late insertion',async()=>{
 const f=fixture(),gate=deferred(),before=model.clone(f.owner.board);f.hooks.nest=()=>gate.promise;f.view.addBrainObject('board');const previous=f.pickers.at(-1),pending=previous.pick(f.files.get('Child.thoughtspace'));await settled();f.view.addBrainObject('section');assert.equal(previous.closed,true);gate.resolve();await pending;await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

test('clearing a brain view closes its owned dialog, unloads its component and invalidates captured callbacks',async()=>{
 const f=fixture(),mounted=f.mount(),before=model.clone(f.owner.board);f.view.addBrainObject('note');const picker=f.pickers.at(-1);f.view.clearBrainBoard();assert.equal(picker.closed,true);assert.equal(mounted.closed,true);assert.equal(mounted.el.isConnected,false);assert.equal(mounted.host.snapshot(),undefined);mounted.host.change(state.createBoardMindmapState('b'));await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});

const NestingHost=compile('class Host{'+take('  async assertCanNestReachable(','  private assertCanNestGraph(')+'};return Host',{TFile,EXT:'thoughtspace',boardLinks:model.boardLinks});
function nestingFixture(graph:Record<string,string[]>){
 const files=new Map(Object.keys(graph).map(path=>[path,new TFile(path)])),reads:string[]=[],host=new NestingHost();let current=true,readHook:((file:TFile)=>Promise<void>)|undefined;
 host.app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),getFiles:()=>{throw Error('Must not scan the vault');}}};
 host.readBoard=async(file:TFile)=>{reads.push(file.path);await readHook?.(file);return{...model.emptyBoard(),version:3,nodes:(graph[file.path]||[]).map((path,i)=>card('child-'+i,{kind:'board',file:path}))};};
 host.boardGraph=()=>{throw Error('Must not build a vault-wide graph');};
 return{files,reads,host,run:(parent='Parent.thoughtspace',child='Child.thoughtspace')=>host.assertCanNestReachable(files.get(parent),files.get(child),()=>current),cancel:()=>{current=false;},readHook:(next:typeof readHook)=>{readHook=next;}};
}

test('nesting validation reads only the chosen sub-board and its reachable descendants, once per file',async()=>{
 const f=nestingFixture({'Parent.thoughtspace':[],'Child.thoughtspace':['Left.thoughtspace','Right.thoughtspace'],'Left.thoughtspace':['Shared.thoughtspace'],'Right.thoughtspace':['Shared.thoughtspace'],'Shared.thoughtspace':[],'Unrelated.thoughtspace':[]});
 await f.run();assert.deepEqual(new Set(f.reads),new Set(['Child.thoughtspace','Left.thoughtspace','Right.thoughtspace','Shared.thoughtspace']));assert.equal(f.reads.length,4);
});

test('reachable nesting blocks self-links and a parent appearing anywhere beneath the selected child',async()=>{
 const graphs:Record<string,string[]>[]=[{'Parent.thoughtspace':[],'Child.thoughtspace':['Parent.thoughtspace']},{'Parent.thoughtspace':[],'Child.thoughtspace':['Grandchild.thoughtspace'],'Grandchild.thoughtspace':['Parent.thoughtspace']}];
 for(const graph of graphs){
  const f=nestingFixture(graph);await assert.rejects(f.run(),/循环嵌套/);assert.equal(f.reads.includes('Parent.thoughtspace'),false);
 }
 const f=nestingFixture({'Parent.thoughtspace':[]});await assert.rejects(f.run('Parent.thoughtspace','Parent.thoughtspace'),/循环嵌套/);assert.deepEqual(f.reads,[]);
});

test('missing nested sources fail closed without reading unrelated boards',async()=>{
 const f=nestingFixture({'Parent.thoughtspace':[],'Child.thoughtspace':['Missing.thoughtspace'],'Unrelated.thoughtspace':[]});await assert.rejects(f.run(),/无法读取/);assert.deepEqual(f.reads,['Child.thoughtspace']);
});

for(const mode of ['cancelled','replaced','renamed','modified'] as const)test(`reachable nesting rejects a ${mode} source during an asynchronous read`,async()=>{
 const f=nestingFixture({'Parent.thoughtspace':[],'Child.thoughtspace':[]}),gate=deferred(),file=f.files.get('Child.thoughtspace')!;f.readHook(()=>gate.promise);const pending=f.run();await settled();
 if(mode==='cancelled')f.cancel();else if(mode==='replaced')f.files.set(file.path,new TFile(file.path));else if(mode==='renamed')file.path='Renamed.thoughtspace';else file.stat.mtime++;
 gate.resolve();await assert.rejects(pending,/已取消|已变化/);assert.deepEqual(f.reads,['Child.thoughtspace']);
});

test('reachable nesting enforces its bounded work limit without scanning unrelated files',async()=>{
 const graph:Record<string,string[]>={'Parent.thoughtspace':[],'Child.thoughtspace':['N0.thoughtspace']};for(let i=0;i<1001;i++)graph[`N${i}.thoughtspace`]=i<1000?[`N${i+1}.thoughtspace`]:[];
 const f=nestingFixture(graph);await assert.rejects(f.run(),/层级过大/);assert.equal(f.reads.length,1000);assert.equal(f.reads.includes('Parent.thoughtspace'),false);
});

// Scope registration executes the real FileView constructor. The Scope double
// records only public register calls and rejects any attempted global push.
function scopeFixture(){
 const scopes:{parent:unknown;registrations:{modifiers:string[];key:string;run:(event:any)=>unknown}[]}[]=[],parentScope={},focuses:any[]=[];let activeView:any,visible=true;
 class Scope {
  registrations:{modifiers:string[];key:string;run:(event:any)=>unknown}[]=[];
  constructor(public parent:unknown){scopes.push(this);}
  register(modifiers:string[],key:string,run:(event:any)=>unknown){this.registrations.push({modifiers,key,run});}
 }
 const app={scope:parentScope,keymap:{pushScope:()=>{throw Error('A board must not push a global scope');}},workspace:{getActiveViewOfType:(type:unknown)=>{assert.equal(type,View);return activeView;}}};
 class FileView {app=app;contentEl:Element;constructor(public leaf:{contentEl:Element}){this.contentEl=leaf.contentEl;}}
 const constructor=take('  constructor(leaf: WorkspaceLeaf, private plugin: ThoughtSpace) {','  getViewType()');
 const View=compile('class BoardView extends FileView{'+constructor+'};return BoardView',{FileView,Scope,isBrainBoard:brain.isBrainBoard});
 const doc={defaultView:{closed:false},activeElement:undefined as Element|undefined,body:new Element()},contentEl=new Element(doc);doc.body.ownerDocument=doc;const target=contentEl.createDiv('node');doc.activeElement=target;
 Object.assign(contentEl,{getClientRects:()=>visible?[{}]:[]});const view=new View({contentEl},{});Object.assign(view,{session:{board:brain.createBrainBoard()},brainBoardView:{focusSearch:()=>focuses.push(view)},closed:false,closing:false});activeView=view;
 const event=(patch:Record<string,unknown>={})=>({target,isComposing:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...patch});
 return{view,View,doc,target,contentEl,scopes,focuses,parentScope,event,activate:(value:unknown)=>{activeView=value;},hide:()=>{visible=false;},run:(event:unknown,index=0)=>scopes[0].registrations[index].run(event)};
}

test('the real board constructor attaches Mod+K and Ctrl+K to its own public Scope without pushing a global scope',()=>{
 const f=scopeFixture();assert.equal(f.scopes.length,1);assert.equal(f.view.scope,f.scopes[0]);assert.equal(f.scopes[0].parent,f.parentScope);assert.deepEqual(f.scopes[0].registrations.map(({modifiers,key})=>({modifiers,key})),[{modifiers:['Mod'],key:'k'},{modifiers:['Ctrl'],key:'k'}]);
 const other=new f.View({contentEl:new Element()},{});assert.equal(f.scopes.length,2);assert.notEqual(other.scope,f.view.scope);assert.equal(other.scope.parent,f.parentScope);assert.deepEqual(f.focuses,[]);
});

for(const modifier of ['Mod','Ctrl'] as const)test(`native ${modifier}+K focuses only the visible active brain board and consumes the shortcut`,()=>{
 const f=scopeFixture(),event=f.event();assert.equal(f.run(event,modifier==='Mod'?0:1),false);assert.equal(event.defaultPrevented,true);assert.deepEqual(f.focuses,[f.view]);
});

test('native brain search accepts focus on its own search field or its document body',()=>{
 const f=scopeFixture(),query=f.contentEl.createDiv('ts-brain-query');f.doc.activeElement=query;assert.equal(f.run(f.event({target:query})),false);f.doc.activeElement=f.doc.body;assert.equal(f.run(f.event({target:f.doc.body})),false);assert.deepEqual(f.focuses,[f.view,f.view]);
});

for(const mode of ['ordinary','missing-session','invalid-state','missing-renderer','hidden','closed','closing','composing','handled','inactive-view','other-window-target','native-editor','external-focus','external-target'] as const)test(`native brain search leaves ${mode} shortcuts untouched`,()=>{
 const f=scopeFixture(),event=f.event();
 if(mode==='ordinary')f.view.session.board=model.emptyBoard();else if(mode==='missing-session')f.view.session=undefined;else if(mode==='invalid-state')f.view.session.board.brain={version:1};else if(mode==='missing-renderer')f.view.brainBoardView=undefined;else if(mode==='hidden')f.hide();else if(mode==='closed'||mode==='closing')f.view[mode]=true;else if(mode==='composing')event.isComposing=true;else if(mode==='handled')event.defaultPrevented=true;else if(mode==='inactive-view')f.activate({});else if(mode==='other-window-target')event.target=new Element();else if(mode==='native-editor')f.target.matches.set('textarea,select,.cm-editor,[contenteditable=true],input:not(.ts-brain-query)',f.target);else if(mode==='external-focus')f.doc.activeElement=new Element(f.doc);else event.target=f.doc.body.createDiv('outside-board');
 const prevented=event.defaultPrevented;assert.equal(f.run(event),undefined);assert.equal(event.defaultPrevented,prevented);assert.deepEqual(f.focuses,[]);
});

test('a scope captured from the first window cannot focus it after another window becomes active',()=>{
 const first=scopeFixture(),second=scopeFixture();first.activate(second.view);const event=first.event();assert.equal(first.run(event),undefined);assert.equal(event.defaultPrevented,false);assert.deepEqual(first.focuses,[]);const next=second.event();assert.equal(second.run(next),false);assert.deepEqual(second.focuses,[second.view]);
});

function tagSearchFixture(){
 const doc={defaultView:{closed:false}},otherDoc={defaultView:{closed:false}},owner={},searches:any[]=[],created:any[]=[],opened:{leaf:any;state:any}[]=[],focused:any[]=[],expanded:any[]=[];let active:any,current=true,load:((leaf:any)=>Promise<void>)|undefined;
 class NativeView {}
 const app={workspace:{getActiveViewOfType:(type:unknown)=>{assert.equal(type,NativeView);return active?.view;},getLeavesOfType:(type:string)=>{assert.equal(type,'search');return searches;},setActiveLeaf:(leaf:any,options:unknown)=>{focused.push({leaf,options});active=leaf;}}};
 const View=compile('class BoardView{'+take('  private async openBrainTagSearch(','  private boardMindmapRelation(')+'};return BoardView',{View:NativeView,expandLocalRelationPane:(_app:unknown,leaf:any)=>{assert.equal(_app,app);expanded.push(leaf);}});
 function makeLeaf(document=doc,pinned=false,type='search'){
  const leaf:any={doc:document,pinned,type,getContainer(){return{doc:this.doc,win:this.doc.defaultView};},getViewState(){return{type:this.type,pinned:this.pinned};},async setViewState(state:any){opened.push({leaf:this,state});await load?.(this);this.type=state.type;}};
  leaf.view={leaf,getViewType:()=>leaf.forcedType||leaf.type};return leaf;
 }
 const view=new View(),navigation=makeLeaf(doc,false,'thoughtspace');navigation.view=view;Object.assign(view,{app,leaf:navigation,session:owner,closed:false,closing:false,contentEl:{ownerDocument:doc},createLocalRelationLeaf:(leaf:any,valid:()=>boolean,activate:boolean)=>{assert.equal(leaf,navigation);assert.equal(valid(),true);assert.equal(activate,false);const child=makeLeaf(doc,false,'empty');created.push(child);return child;}});active=navigation;
 return{view,doc,otherDoc,owner,navigation,searches,created,opened,focused,expanded,makeLeaf,run:(tag='#主题')=>view.openBrainTagSearch(tag,()=>current),cancel:()=>{current=false;},activate:(leaf:any)=>{active=leaf;},load:(next:(leaf:any)=>Promise<void>)=>{load=next;}};
}

test('brain tags reuse an unpinned native search leaf in the source document and load without premature focus',async()=>{
 const f=tagSearchFixture(),leaf=f.makeLeaf(),gate=deferred();f.searches.push(leaf);f.load(()=>gate.promise);const pending=f.run('#主题/资料');await settled();assert.equal(f.opened.length,1);assert.equal(f.opened[0].leaf,leaf);assert.deepEqual(f.opened[0].state,{type:'search',state:{query:'tag:"#主题/资料"'},active:false});assert.equal(f.created.length,0);assert.deepEqual(f.focused,[]);assert.deepEqual(f.expanded,[]);
 gate.resolve();await pending;assert.deepEqual(f.expanded,[leaf]);assert.deepEqual(f.focused,[{leaf,options:{focus:true}}]);
});

test('pinned and other-window search leaves remain untouched while a local inactive leaf is created',async()=>{
 const f=tagSearchFixture(),pinned=f.makeLeaf(f.doc,true),other=f.makeLeaf(f.otherDoc);f.searches.push(pinned,other);await f.run();assert.equal(f.created.length,1);assert.deepEqual(f.opened.map(item=>item.leaf),f.created);assert.equal(f.opened[0].state.active,false);assert.deepEqual(f.expanded,f.created);assert.equal(f.focused[0].leaf,f.created[0]);assert.equal(pinned.type,'search');assert.equal(other.type,'search');
});

test('tag text is encoded as one literal native query value instead of injecting query syntax',async()=>{
 const f=tagSearchFixture(),tag='#研究"\\OR(path:Secret)';await f.run(tag);const query=f.opened[0].state.state.query;assert.equal(query,'tag:'+JSON.stringify(tag));assert.equal(JSON.parse(query.slice(4)),tag);
});

test('native editor activated while tag search loads keeps its focus and does not expand the stale target pane',async()=>{
 const f=tagSearchFixture(),gate=deferred();f.load(()=>gate.promise);const pending=f.run();await settled();const editor=f.makeLeaf(f.doc,false,'markdown');f.activate(editor);gate.resolve();await pending;assert.equal(f.opened.length,1);assert.deepEqual(f.focused,[]);assert.deepEqual(f.expanded,[]);
});

for(const mode of ['cancelled','owner','closed','closing','source-document','source-window','window-closed','source-leaf','search-document','search-view'] as const)test(`tag search ${mode} while loading cannot activate or expand a stale native leaf`,async()=>{
 const f=tagSearchFixture(),gate=deferred();f.load(()=>gate.promise);const pending=f.run();await settled();const destination=f.created[0];
 if(mode==='cancelled')f.cancel();else if(mode==='owner')f.view.session={};else if(mode==='closed'||mode==='closing')f.view[mode]=true;else if(mode==='source-document')f.view.contentEl.ownerDocument=f.otherDoc;else if(mode==='source-window')f.doc.defaultView={closed:false};else if(mode==='window-closed')f.doc.defaultView.closed=true;else if(mode==='source-leaf')f.navigation.view={};else if(mode==='search-document')destination.doc=f.otherDoc;else destination.forcedType='markdown';
 gate.resolve();await pending;assert.equal(f.opened.length,1);assert.deepEqual(f.focused,[]);assert.deepEqual(f.expanded,[]);
});

test('invalid or already-cancelled tag requests never create or load a native leaf',async()=>{
 const f=tagSearchFixture();for(const tag of ['', '#', 'topic', ' #topic', '#two words', '##topic', '#one#two', '#line\nbreak'])await f.run(tag);f.cancel();await f.run('#valid');assert.deepEqual(f.created,[]);assert.deepEqual(f.opened,[]);assert.deepEqual(f.focused,[]);
});

// Guarded retries exercise real Session disk comparison and history, rather than
// repeating the creation command or writing over changed native documents.
function saveRetryFixture(initial?:model.Board){
 const b=initial??initialBoard();if(!initial)b.nodes[0]={...ideas.brainIdeaNode('a','Original retry idea'),text:'Nonempty body\n\nSecond paragraph.'};
 const f=fixture(b),process=f.app.vault.process;let failures=1;
 f.app.vault.process=async(file:TFile,edit:(raw:string)=>string)=>{if(failures>0){failures--;throw Error('Transient board write failure');}return process(file,edit);};
 f.plugin.createUnique=async(...args:unknown[])=>{f.created.push(args);const [folder,name,ext,body]=args as string[];let path=`${folder}/${name}.${ext}`,n=1;while(f.files.has(path))path=`${folder}/${name} ${++n}.${ext}`;const file=new TFile(path);f.files.set(path,file);f.noteBytes.set(path,body);return file;};
 return{...f,failWrites:(count:number)=>{failures=count;},originalProcess:process,markdownCreates:()=>f.created.filter(args=>args[2]==='md').length};
}
async function failConversion(f:ReturnType<typeof saveRetryFixture>){f.mount();f.view.openBrainSeed('a');const modal=f.pickers.at(-1);await assert.rejects(modal.commit({kind:'new',name:'Retained note',folder:'Notes'}),/想法与关系已保留/);assert.equal(modal.host.canRetry(),true);return modal;}

test('conversion save retry reuses one native note and produces one undo transaction with exact body and geometry',async()=>{
 const f=saveRetryFixture(),before=model.clone(f.owner.board),modal=await failConversion(f);assert.equal(f.markdownCreates(),1);assert(f.owner.blocked);await modal.host.retry(()=>!modal.closed);await f.drain();
 assert.equal(f.owner.blocked,false);assert.equal(f.markdownCreates(),1);assert.equal(f.owner.board.nodes[0].file,'Notes/Retained note.md');assert.equal(f.noteBytes.get('Notes/Retained note.md'),'# Original retry idea\n\nNonempty body\n\nSecond paragraph.');assert.deepEqual(f.owner.board.edges,before.edges);for(const k of ['id','x','y','width','height'] as const)assert.equal(f.owner.board.nodes[0][k],before.nodes[0][k]);assert.equal(f.owner.history.undoStack.length,1);assert.equal(modal.host.canRetry(),false);
 f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);assert(f.files.has('Notes/Retained note.md'));f.owner.undo(true);await f.drain();assert.equal(model.parseBoard(f.disk()).nodes[0].file,'Notes/Retained note.md');assert.deepEqual(f.trashed,[]);
});

test('repeated conversion retry failures retain the idea and permit another retry without duplicate native notes',async()=>{
 const f=saveRetryFixture(),before=model.clone(f.owner.board),modal=await failConversion(f);f.failWrites(1);await assert.rejects(modal.host.retry(()=>true),/重试保存失败/);assert(f.owner.blocked);assert.deepEqual(f.owner.board,before);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.markdownCreates(),1);assert.equal(modal.host.canRetry(),true);await modal.host.retry(()=>true);await f.drain();assert.equal(f.owner.blocked,false);assert.equal(f.markdownCreates(),1);assert.equal(f.owner.history.undoStack.length,1);
});

for(const external of ['board','note','note-rename','note-replace'] as const)test(`save retry refuses changed ${external} bytes/identity without overwriting them`,async()=>{
 const f=saveRetryFixture(),modal=await failConversion(f),before=model.clone(f.owner.board),note=f.files.get('Notes/Retained note.md')!;
 if(external==='board')await f.originalProcess(f.file,raw=>raw+'\n');
 if(external==='note')f.noteBytes.set(note.path,'External note edit');
 if(external==='note-rename')note.path='Notes/User-renamed.md';
 if(external==='note-replace')f.files.set(note.path,new TFile(note.path));
 const disk=f.disk(),noteBytes=new Map(f.noteBytes);await assert.rejects(modal.host.retry(()=>true),/外部修改|正文已被修改|笔记已变化/);assert(f.owner.blocked);assert.equal(f.disk(),disk);assert.deepEqual(f.noteBytes,noteBytes);assert.deepEqual(f.owner.board,before);assert.equal(f.markdownCreates(),1);assert.equal(f.owner.history.undoStack.length,0);assert.deepEqual(f.trashed,[]);
});

for(const stale of ['cancel','owner','epoch','board-edit'] as const)test(`save retry stops ${stale} arriving during its native board read`,async()=>{
 const f=saveRetryFixture(),modal=await failConversion(f),gate=deferred<string>(),entered=deferred(),originalRead=f.app.vault.read,before=model.clone(f.owner.board);
 f.app.vault.read=async file=>{if(file===f.file){entered.resolve();return gate.promise;}return originalRead(file);};const retry=modal.host.retry(()=>!modal.closed);await entered.promise;
 if(stale==='cancel')modal.close();if(stale==='owner')f.view.session={};if(stale==='epoch')f.view.brainObjectEpoch++;if(stale==='board-edit')f.owner.board.nodes[1].title='Another edit';gate.resolve(f.disk());await assert.rejects(retry,/已取消|已变化/);assert(f.owner.blocked);assert.equal(f.markdownCreates(),1);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.owner.board.nodes[0].brainIdea,true);if(stale!=='board-edit')assert.deepEqual(f.owner.board,before);assert.deepEqual(f.trashed,[]);
});

test('two retry confirmations cannot start concurrent writes or create another note',async()=>{
 const f=saveRetryFixture(),modal=await failConversion(f),gate=deferred<string>(),entered=deferred(),originalRead=f.app.vault.read;f.app.vault.read=async file=>{if(file===f.file){entered.resolve();return gate.promise;}return originalRead(file);};const retry=modal.host.retry(()=>true);await entered.promise;await assert.rejects(modal.host.retry(()=>true),/正在重试/);gate.resolve(f.disk());await retry;await f.drain();assert.equal(f.markdownCreates(),1);assert.equal(f.owner.history.undoStack.length,1);
});

for(const kind of ['idea','new','existing'] as const)test(`directional ${kind} save retry persists the already committed relation exactly once`,async()=>{
 const f=saveRetryFixture();f.mount().host.createRelation('a','bottom',()=>true);const modal=f.pickers.at(-1),source=new TFile('Notes/Existing retry.md');f.files.set(source.path,source);f.noteBytes.set(source.path,'Existing body');
 const target=kind==='existing'?{kind,file:source,path:source.path}:kind==='new'?{kind,name:'Directional retry',folder:'Notes'}:{kind,name:'Directional idea'};await assert.rejects(modal.commit(target),/保存失败/);const pending=model.clone(f.owner.board),transactions=f.owner.history.undoStack.length;assert.equal(modal.host.canRetry(),true);await modal.host.retry(()=>true);await f.drain();assert.deepEqual(f.owner.board,pending);assert.deepEqual(model.parseBoard(f.disk()),pending);assert.equal(f.owner.history.undoStack.length,transactions);assert.equal(f.owner.board.edges.length,2);assert.equal(f.markdownCreates(),kind==='new'?1:0);assert.equal(f.noteBytes.get(source.path),'Existing body');assert.equal(f.owner.blocked,false);
});

for(const kind of ['idea','new','existing'] as const)test(`first ${kind} save retry persists its existing ID and center without repeating creation`,async()=>{
 const f=saveRetryFixture(brain.createBrainBoard());f.mount();f.view.addBrainObject();const modal=f.pickers.at(-1),source=new TFile('Notes/First existing.md');f.files.set(source.path,source);f.noteBytes.set(source.path,'Existing first body');const target=kind==='existing'?{kind,file:source,path:source.path}:kind==='new'?{kind,name:'First retry',folder:'Notes'}:{kind,name:'First idea'};
 await assert.rejects(modal.commit(target),/保存失败/);const pending=model.clone(f.owner.board);await modal.host.retry(()=>true);await f.drain();assert.deepEqual(f.owner.board,pending);assert.equal(f.owner.board.nodes.length,1);assert.equal(f.owner.board.brain.centerId,pending.brain?.centerId);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.markdownCreates(),kind==='new'?1:0);assert.equal(f.owner.blocked,false);
});

test('retry keeps an external board edit arriving after preflight through the Session atomic disk comparison',async()=>{
 const f=saveRetryFixture(),modal=await failConversion(f),read=f.app.vault.read,note=f.files.get('Notes/Retained note.md')!;let external='';
 f.app.vault.read=async file=>{if(file===note){external=f.disk()+'\n';await f.originalProcess(f.file,()=>external);}return read(file);};
 await assert.rejects(modal.host.retry(()=>true),/重试保存失败/);assert.equal(f.disk(),external);assert(f.owner.blocked);assert(f.owner.board.nodes[0].brainIdea);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.markdownCreates(),1);assert.equal(f.noteBytes.get(note.path),'# Original retry idea\n\nNonempty body\n\nSecond paragraph.');
});

for(const presentation of ['board','brain'] as const)test(`directional new ${presentation} whiteboard preserves parent, reference, relation, undo/redo and saved bytes`,async()=>{
 const f=fixture(),before=model.clone(f.owner.board);(f.plugin as any).assertCanNest=async()=>{};
 f.hooks.create=async()=>{const file=new TFile('Boards/New.thoughtspace');f.files.set(file.path,file);f.noteBytes.set(file.path,String(f.created.at(-1)![3]));return file;};
 f.mount().host.createRelation('a','bottom',()=>true,'board');const modal=f.pickers.at(-1);assert.equal(modal.host.initial,'board');await modal.commit({kind:'board',name:'New',folder:'Boards',presentation});await f.drain();
 assert.equal(f.created.length,1);assert.equal(f.created[0][2],'thoughtspace');assert.equal(model.parseBoard(String(f.created[0][3])).presentation,presentation==='brain'?'brain':undefined);assert.equal(f.owner.board.nodes.at(-1).kind,'board');assert.equal(f.owner.board.edges.at(-1).from,'a');assert.equal(f.owner.board.edges.at(-1).kind,'branch');const saved=model.clone(f.owner.board);f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);f.owner.undo(true);await f.drain();assert.deepEqual(new f.Session(f.plugin,f.file,f.disk()).board,saved);assert.deepEqual(f.trashed,[]);
});
test('whiteboard cancel before confirmation creates neither file nor relationship',()=>{const f=fixture();f.mount().host.createRelation('a','bottom',()=>true,'board');f.pickers.at(-1).close();assert.equal(f.created.length,0);assert.equal(f.owner.history.undoStack.length,0);});
test('idea rename commits the name alone, allows duplicate titles, and saves/reopens and undoes without losing edges',async()=>{
 const b=brain.createBrainBoard('idea');b.nodes=[ideas.brainIdeaNode('idea','Before'),ideas.brainIdeaNode('other','After')];b.edges=[{id:'e',from:'idea',to:'other',direction:'both',label:'保持'}];const f=fixture(b),before=model.clone(b);
 f.mount().host.renameNode('idea',()=>true);const modal=f.pickers.at(-1);await assert.rejects(modal.commit(' '),/名称/);assert.equal(f.owner.history.undoStack.length,0);await modal.commit('After');await f.drain();assert.equal(f.owner.board.nodes[0].title,'After');assert.equal(f.owner.board.nodes[0].id,'idea');assert.deepEqual(f.owner.board.edges,before.edges);assert.equal(f.created.length,0);assert.equal(new f.Session(f.plugin,f.file,f.disk()).board.nodes[0].title,'After');f.owner.undo();await f.drain();assert.deepEqual(f.owner.board,before);
});
test('rename cancellation and stale node stamps cannot rename a later source or alter relations',async()=>{
 const b=brain.createBrainBoard('idea');b.nodes=[ideas.brainIdeaNode('idea','Original')];const f=fixture(b);f.mount().host.renameNode('idea',()=>true);const modal=f.pickers.at(-1);modal.close();await assert.rejects(modal.commit('Canceled'),/取消/);assert.equal(f.owner.board.nodes[0].title,'Original');f.mount().host.renameNode('idea',()=>true);const next=f.pickers.at(-1);f.owner.board.nodes[0].title='Concurrent';await assert.rejects(next.commit('Stale'),/变化/);assert.equal(f.owner.board.nodes[0].title,'Concurrent');
});
