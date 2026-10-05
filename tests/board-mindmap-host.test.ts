import {isBrainBoard} from '../src/brain-board';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as state from '../src/board-mindmap';
import * as edits from '../src/local-relations-edit';
import * as geometry from '../src/relation-geometry-checkpoint';
import {supportsLocalRelations,localRelationNode} from '../src/local-relations';
import {sectionContains} from '../src/sections';
import {foldCards} from '../src/board-tools';
import {reflowReadingContent} from '../src/expansion-reading-state';

// Exercise the production host and Session methods. Obsidian's window, Markdown
// renderer and picker adapters are controlled doubles; native UI QA is separate.
const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert(from>=0&&to>from,start);return source.slice(from,to);}
function compile(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{resolve,reject,promise};}
async function settled(){for(let i=0;i<12;i++)await Promise.resolve();}
class TFile {stat={mtime:10,size:100,ctime:1};parent={path:'Boards'};constructor(public path:string){}get basename(){return this.path.split('/').pop()!.replace(/\.[^.]+$/,'');}get extension(){return this.path.split('.').pop()!;}}
type Doc={defaultView:{closed:boolean}};
class Element {
 isConnected=true;children:Element[]=[];textContent='';title='';attrs=new Map<string,string>();classes=new Set<string>();onclick?:()=>unknown;matches=new Map<string,Element>();listeners=new Map<string,Set<(event:any)=>unknown>>();classList={contains:(value:string)=>this.classes.has(value)};
 constructor(public ownerDocument:Doc,public tagName='DIV'){}
 createEl(tag:string,options?:{text?:string;cls?:string;attr?:Record<string,string>}){const child=new Element(this.ownerDocument,tag.toUpperCase());child.textContent=options?.text||'';if(options?.cls)child.addClass(options.cls);for(const[key,value]of Object.entries(options?.attr||{}))child.setAttribute(key,value);this.children.push(child);return child;}
 createDiv(options?:string|{text?:string;cls?:string;attr?:Record<string,string>}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 empty(){this.children=[];this.textContent='';}setText(text:string){this.empty();this.textContent=text;}addClass(value:string){this.classes.add(value);}setAttribute(key:string,value:string){this.attrs.set(key,value);}getAttribute(key:string){return this.attrs.get(key)??null;}querySelector():Element|null{return null;}closest(selector:string){return this.matches.get(selector)??null;}
 addEventListener(type:string,callback:(event:any)=>unknown){let callbacks=this.listeners.get(type);if(!callbacks)this.listeners.set(type,callbacks=new Set());callbacks.add(callback);}removeEventListener(type:string,callback:(event:any)=>unknown){this.listeners.get(type)?.delete(callback);}emit(type:string,event:any){for(const callback of this.listeners.get(type)||[])callback(event);}
 text():string{return this.textContent+this.children.map(child=>child.text()).join('');}
}
class Component {
 children:Component[]=[];cleanups:(()=>unknown)[]=[];closed=false;
 addChild<T extends Component>(child:T){this.children.push(child);return child;}register(cleanup:()=>unknown){this.cleanups.push(cleanup);}registerDomEvent(el:Element,type:string,callback:(event:any)=>unknown){el.addEventListener(type,callback);this.register(()=>el.removeEventListener(type,callback));}unload(){if(this.closed)return;this.closed=true;for(const child of this.children)child.unload();for(const cleanup of this.cleanups)cleanup();}
}
class Mounted extends Component {constructor(public app:unknown,public el:Element,public host:any){super();}}
class Picker {opened=false;closed=false;placeholder='';constructor(public app:unknown){}setPlaceholder(value:string){this.placeholder=value;}open(){this.opened=true;}close(){this.closed=true;}}
const card=(id:string,patch:Partial<model.Card>={}):model.Card=>({id,kind:'card',file:`Notes/${id}.md`,x:id==='a'?20:420,y:60,width:220,height:160,color:'sand',...patch});
const frame=(id='map'):model.Card=>({id,kind:'mindmap',title:'脑图',mindmap:state.createBoardMindmapState('a'),x:0,y:0,width:780,height:520,color:'slate'});
const board=():model.Board=>model.clone({version:3,nodes:[card('a'),card('b'),card('group',{kind:'section',title:'分组',file:undefined,x:0,y:0,width:760,height:400}),card('text',{kind:'text',text:'standalone',file:undefined}),card('child',{kind:'board',file:'Child.thoughtspace',x:1000}),frame()],edges:[],viewport:{x:45,y:28,zoom:.8}});
function fixture(initial=board()){
 const docs:Doc[]=[{defaultView:{closed:false}},{defaultView:{closed:false}}],file=new TFile('Boards/Canvas.thoughtspace'),files=new Map<string,TFile>([[file.path,file]]);for(const node of initial.nodes)if(node.file)files.set(node.file,new TFile(node.file));
 let disk=JSON.stringify(initial),writes=0,reflows=0,nextId=0;const notices:string[]=[],errors:unknown[]=[],actions:Promise<unknown>[]=[],previewCalls:any[]=[],jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[],revealed:string[]=[],maps:model.Board[]=[],events:unknown[][]=[],opens:any[]=[],leaves:{view:any}[]=[],pickers:Picker[]=[],links:unknown[][]=[],tabs:unknown[][]=[];
 const hooks:{process?:()=>Promise<void>;readBoard?:(file:TFile)=>Promise<model.Board>}={};
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),process:async(_file:TFile,change:(raw:string)=>string)=>{await hooks.process?.();disk=change(disk);writes++;},read:async()=>disk},metadataCache:{resolvedLinks:{},getFileCache:()=>null},workspace:{trigger:(...args:unknown[])=>events.push(args),getLeavesOfType:(type:string)=>type==='board'?leaves:[],openLinkText:async(...args:unknown[])=>{links.push(args);}}};
 const plugin={app,readBoard:(file:TFile)=>hooks.readBoard?.(file)||Promise.resolve({...model.emptyBoard(),version:3 as const}),createUnique:async()=>({path:'Recovery.thoughtspace'})};
 const Notice=class{constructor(message:string){notices.push(message);}};
 const Session=compile(take('class Session {','\ntype BoardGraph=')+';return Session',{...model,...mindmap,...geometry,EXT:'thoughtspace',Notice,report:(e:unknown)=>errors.push(e),reflowReadingContent:(...args:Parameters<typeof reflowReadingContent>)=>{reflows++;return reflowReadingContent(...args);}});
 const viewSource=take('  private requireOwner(','  private canCreateBlankText(')+take('  addMindmap(','  localRelationSource(');
 const TrackingPicker=class extends Picker{constructor(app:unknown){super(app);pickers.push(this);}};
 const View=compile('class BoardView{'+viewSource+'};return BoardView',{isBrainBoard,...model,...state,...edits,supportsLocalRelations,localRelationNode,sectionContains,foldCards,TFile,Notice,VIEW:'board',Keymap:{isModEvent:(event:any)=>event.metaKey||event.ctrlKey?'tab':false},BoardMindmapView:Mounted,FuzzySuggestModal:TrackingPicker,uid:()=>`new-${++nextId}`,renderCardPreview:(options:unknown)=>previewCalls.push(options),nativeLocalRelations:()=>({relations:[],tagsByNode:new Map(),pendingPaths:[]}),parseLinktext:(link:string)=>({path:link,subpath:''}),getAllTags:()=>[],button:(parent:Element,label:string,_icon:string,run:()=>unknown)=>{const child=parent.createEl('button',{text:label});child.onclick=run;return child;},act:(run:()=>unknown)=>{const work=Promise.resolve().then(run);actions.push(work);void work.catch(error=>errors.push(error));}});
 const owner=new Session(plugin,file,disk),view=new View(),leaf={view},el=new Element(docs[0]);Object.assign(view,{app,plugin,session:owner,file,leaf,closed:false,closing:false,contentEl:el,selected:new Set(['a']),positions:new Map(),boardMindmaps:new Map(),mindmapFileIds:new WeakMap(),mindmapFileSequence:0,previewQueue:{add:(alive:()=>boolean,run:()=>Promise<void>)=>jobs.push({alive,run})},point:()=>({x:50,y:80}),updateSelection:()=>{},revealNode:(id:string)=>revealed.push(id),mapPreview:(_el:Element,child:model.Board)=>maps.push(child),openLocalRelationSource:async(...args:unknown[])=>{opens.push(args);}});
 leaves.push(leaf);view.selectTab=(...args:unknown[])=>tabs.push(args);
 const otherView=(session=owner)=>{const other=new View();Object.assign(other,{app,plugin,session,file,closed:false,closing:false,contentEl:new Element(docs[1]),selected:new Set(),positions:new Map()});const otherLeaf={view:other};other.leaf=otherLeaf;leaves.push(otherLeaf);return other;};
 const mount=(id='map')=>{const node=owner.board.nodes.find((n:model.Card)=>n.id===id)!,element=new Element(docs[0]),scope=new Component();view.positions.set(id,element);view.mountBoardMindmap(node,element,scope);const mounted=view.boardMindmaps.get(id) as Mounted;return{element,scope,mounted,host:mounted.host};};
 const drain=async()=>{await Promise.allSettled(actions);await owner.flush();await settled();};
 return{view,owner,file,files,docs,app,plugin,hooks,Session,mount,otherView,leaves,pickers,links,tabs,previewCalls,jobs,revealed,maps,events,opens,errors,notices,drain,writes:()=>writes,reflows:()=>reflows,disk:()=>disk};
}

test('adding a real container saves and undoes without changing referenced nodes, edges or camera',async()=>{
 const f=fixture(),before=model.clone(f.owner.board),id=f.view.addMindmap({x:120,y:240},'b');await f.owner.flush();const added=f.owner.board.nodes.find((n:model.Card)=>n.id===id)!;assert.equal(added.kind,'mindmap');assert.equal(added.x,120);assert.equal(added.y,240);assert.equal(added.mindmap.centerId,'b');assert.deepEqual(f.owner.board.nodes.slice(0,-1),before.nodes);assert.deepEqual(f.owner.board.edges,before.edges);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.deepEqual([...f.view.selected],[id]);assert.equal(f.reflows(),0);assert.equal(f.writes(),1);assert.equal(f.owner.history.undoStack.length,1);
 const saved=model.clone(f.owner.board);f.owner.undo();await f.owner.flush();assert.deepEqual(f.owner.board,before);f.owner.undo(true);await f.owner.flush();assert.deepEqual(f.owner.board,saved);assert.deepEqual(new f.Session(f.plugin,f.file,f.disk()).board,saved);
});
test('an empty board containing only unsupported text starts a container with no fabricated center',async()=>{
 const initial=board();initial.nodes=initial.nodes.filter(n=>n.kind==='text');const f=fixture(initial),id=f.view.addMindmap();await f.owner.flush();const added=f.owner.board.nodes.find((n:model.Card)=>n.id===id);assert.deepEqual(added.mindmap,state.createBoardMindmapState());assert.equal(added.x+added.width/2,50);assert.equal(added.y+added.height/2,80);assert.equal(f.owner.board.nodes.filter((n:model.Card)=>n.kind==='text').length,1);
});
for(const mode of ['inline','gesture','closing','blocked'] as const)test(`adding while ${mode} cannot mutate or save the board`,async()=>{
 const f=fixture(),before=model.clone(f.owner.board);if(mode==='blocked')f.owner.blocked=true;else f.view[mode]={};assert.throws(()=>f.view.addMindmap());await f.owner.flush();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);
});
test('mounted state changes are cloned, isolated per container, saveable and undoable',async()=>{
 const initial=board();initial.nodes.push(frame('second'));const f=fixture(initial),a=f.mount(),b=f.mount('second'),before=model.clone(f.owner.board),next=state.updateBoardMindmapState(a.host.snapshot().container.mindmap,{type:'center',id:'b'},f.owner.board.nodes);a.host.change(next);next.history.entries.push('corrupt-caller-copy');await f.owner.flush();assert.equal(a.host.snapshot().container.mindmap.centerId,'b');assert.equal(b.host.snapshot().container.mindmap.centerId,'a');assert.deepEqual(f.owner.board.nodes.filter((n:model.Card)=>n.id!=='map'),before.nodes.filter((n:model.Card)=>n.id!=='map'));assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.reflows(),0);
 const changed=model.clone(f.owner.board);f.owner.undo();await f.owner.flush();assert.deepEqual(f.owner.board,before);assert.equal(a.host.snapshot().container.mindmap.centerId,'a');f.owner.undo(true);await f.owner.flush();assert.deepEqual(f.owner.board,changed);assert.deepEqual(new f.Session(f.plugin,f.file,f.disk()).board,changed);
});
test('a repeated state is a true Session no-op and malformed primary state is rejected',async()=>{
 const f=fixture(),m=f.mount(),before=model.clone(f.owner.board);f.owner.history.redoStack=['unrelated redo'];m.host.change(model.clone(m.host.snapshot().container.mindmap));assert.throws(()=>m.host.change({version:1}),/脑图状态无效/);await f.owner.flush();assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);assert.deepEqual(f.owner.history.redoStack,['unrelated redo']);assert.deepEqual(f.owner.board,before);
});
for(const mode of ['locked','blocked','removed','owner-replaced','element-replaced','detached','closed'] as const)test(`a mounted ${mode} container cannot receive a stale state update`,async()=>{
 const f=fixture(),m=f.mount(),next=state.createBoardMindmapState('b');if(mode==='locked')f.owner.board.nodes.find((n:model.Card)=>n.id==='map').locked=true;else if(mode==='blocked')f.owner.blocked=true;else if(mode==='removed')f.owner.board.nodes=f.owner.board.nodes.filter((n:model.Card)=>n.id!=='map');else if(mode==='owner-replaced')f.view.session={};else if(mode==='element-replaced')f.view.positions.set('map',new Element(f.docs[0]));else if(mode==='detached')m.element.isConnected=false;else f.view.closed=true;const before=model.clone(f.owner.board);m.host.change(next);await f.owner.flush();assert.deepEqual(f.owner.board,before);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes(),0);
});
test('host fold changes only the outer frame and uses real Session undo and redo',async()=>{
 const f=fixture(),m=f.mount(),before=model.clone(f.owner.board);m.host.fold();await f.owner.flush();assert.equal(m.host.snapshot().container.collapsed,true);assert.equal(m.host.snapshot().container.height,72);assert.equal(m.host.snapshot().container.expandedHeight,520);assert.deepEqual(f.owner.board.nodes.filter((n:model.Card)=>n.id!=='map'),before.nodes.filter((n:model.Card)=>n.id!=='map'));assert.deepEqual(m.host.snapshot().container.mindmap,before.nodes.at(-1)!.mindmap);assert.equal(f.reflows(),0);
 f.owner.undo();await f.owner.flush();assert.deepEqual(f.owner.board,before);f.owner.undo(true);await f.owner.flush();assert.equal(m.host.snapshot().container.height,72);m.host.fold();await f.owner.flush();assert.deepEqual(f.owner.board,before);
});
test('locked frames cannot fold and independent node opens retain their captured target',async()=>{
 const f=fixture(),m=f.mount();f.owner.board.nodes.find((n:model.Card)=>n.id==='map').locked=true;const before=model.clone(f.owner.board);m.host.fold();assert.deepEqual(f.owner.board,before);await m.host.open('b',()=>true);assert.equal(f.opens.length,1);assert.equal(f.opens[0][0],'b');assert.equal(f.opens[0][2],f.view.leaf);await m.host.open('group',()=>true);assert.deepEqual(f.revealed,['group']);await m.host.open('text',()=>true);await m.host.open('a',()=>false);assert.equal(f.opens.length,1);assert.equal(f.writes(),0);
});
test('native file-menu delegation is per target and leaves groups and unsupported nodes alone',()=>{
 const f=fixture(),m=f.mount(),menu={};m.host.fileMenu(menu,'b');m.host.fileMenu(menu,'group');m.host.fileMenu(menu,'text');assert.equal(f.events.length,1);assert.deepEqual(f.events[0],['file-menu',menu,f.files.get('Notes/b.md'),'thoughtspace',f.view.leaf]);
});
test('file source stamps detect same-path replacement and unavailable targets do not invent sources',()=>{
 const f=fixture(),m=f.mount(),before=m.host.source('a');f.files.set('Notes/a.md',new TFile('Notes/a.md'));assert.notEqual(m.host.source('a').stamp,before.stamp);f.files.delete('Notes/a.md');assert.equal(m.host.source('a').available,false);assert.equal(m.host.source('text').available,false);assert.equal(m.host.source('group').available,true);
});

test('sub-board preview reads only the chosen board, filters unsupported nodes and caps displayed objects',async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component();let reads=0;const child: model.Board={...model.emptyBoard(),version:3,nodes:Array.from({length:30},(_,i)=>card('child-'+i)).concat([card('text-child',{kind:'text',text:'private',file:undefined}),frame('nested-container')]),edges:[{id:'in',from:'child-0',to:'child-1',label:''},{id:'out',from:'child-0',to:'child-29',label:''}]};f.hooks.readBoard=async file=>{reads++;assert.equal(file.path,'Child.thoughtspace');return child;};const before=model.clone(f.owner.board);f.view.previewBoardMindmap(f.owner,'child',body,scope,()=>true);await settled();assert.equal(reads,1);assert.equal(f.maps.length,1);assert.equal(f.maps[0].nodes.length,24);assert.deepEqual(f.maps[0].edges,[child.edges[0]]);assert.match(body.text(),/30 个/);assert.match(body.text(),/前 24 项/);assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});
for(const mode of ['request-cancelled','scope-unloaded','detached','document-changed','window-closed','owner-replaced','source-replaced','source-renamed','source-modified','node-reassociated'] as const)test(`late sub-board preview ${mode} cannot replace current content`,async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component(),gate=deferred<model.Board>();let current=true;f.hooks.readBoard=()=>gate.promise;f.view.previewBoardMindmap(f.owner,'child',body,scope,()=>current);assert.match(body.text(),/正在读取/);
 if(mode==='request-cancelled')current=false;else if(mode==='scope-unloaded')scope.unload();else if(mode==='detached')body.isConnected=false;else if(mode==='document-changed')body.ownerDocument=f.docs[1];else if(mode==='window-closed')f.docs[0].defaultView.closed=true;else if(mode==='owner-replaced')f.view.session={};else if(mode==='source-replaced')f.files.set('Child.thoughtspace',new TFile('Child.thoughtspace'));else if(mode==='source-renamed')f.files.get('Child.thoughtspace')!.path='Moved.thoughtspace';else if(mode==='source-modified')f.files.get('Child.thoughtspace')!.stat.mtime++;else f.owner.board.nodes.find((n:model.Card)=>n.id==='child').file='Other.thoughtspace';
 body.setText('new owned content');gate.resolve({...model.emptyBoard(),version:3,nodes:[card('late')]});await settled();assert.equal(body.text(),'new owned content');assert.equal(f.maps.length,0);assert.equal(f.writes(),0);
});
test('a cancelled rejected board preview does not replace the newer status with an old error',async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component(),gate=deferred<model.Board>();f.hooks.readBoard=()=>gate.promise;f.view.previewBoardMindmap(f.owner,'child',body,scope,()=>true);scope.unload();body.setText('cancelled');gate.reject(Error('late read failure'));await settled();assert.equal(body.text(),'cancelled');assert.equal(f.errors.length,0);
});
test('queued Markdown rendering is dropped after scope unload without starting its renderer',async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component();f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>true);assert.equal(f.previewCalls.length,1);const call=f.previewCalls[0];assert.equal(call.file,f.files.get('Notes/a.md'));let ran=0;call.enqueue(()=>true,async()=>{ran++;});assert.equal(f.jobs[0].alive(),true);scope.unload();assert.equal(f.jobs[0].alive(),false);await f.jobs[0].run();assert.equal(ran,0);call.ready(true);call.error();assert.equal(body.text(),'');assert.equal(f.writes(),0);
});
test('group preview lists real local members without reading files or treating text as a brain node',()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component();f.view.previewBoardMindmap(f.owner,'group',body,scope,()=>true);assert.match(body.text(),/2 个笔记、分组或子白板/);assert.equal(body.children.filter(child=>child.tagName==='BUTTON').length,2);body.children.find(child=>child.tagName==='BUTTON')!.onclick!();assert.deepEqual(f.revealed,['a']);scope.unload();body.children.find(child=>child.tagName==='BUTTON')!.onclick!();assert.deepEqual(f.revealed,['a']);assert.equal(f.previewCalls.length,0);assert.equal(f.maps.length,0);
});
test('expanded excerpt notes retain the existing native source badge after Markdown rendering',()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component(),badges:unknown[][]=[];f.view.addSourceBadge=(...args:unknown[])=>badges.push(args);f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>true);
 const sources=[{link:'[[Original#Heading]]',location:'第 2–4 行',line:2,citation:'来源：[[Original#Heading]] · 第 2–4 行'}],call=f.previewCalls[0];call.sources(sources);call.ready(false);assert.equal(badges.length,1);assert.equal(badges[0][1],f.files.get('Notes/a.md'));assert.deepEqual(badges[0][2],sources);assert.equal(badges[0][3],scope);assert.equal(f.writes(),0);
 scope.unload();call.ready(false);assert.equal(badges.length,1);
});
test('cancelled excerpt rendering cannot append a late source badge to the next preview',()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component();let badges=0;f.view.addSourceBadge=()=>badges++;f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>true);const call=f.previewCalls[0];call.sources([{link:'[[Original]]',line:1,location:'第 1–2 行',citation:'source'}]);scope.unload();body.setText('next preview');call.ready(false);assert.equal(badges,0);assert.equal(body.text(),'next preview');
});

for(const kind of ['child','parent','associate'] as const)test(`${kind} picker writes one real edge with no source geometry or layout side effects`,async()=>{
 const f=fixture(),before=model.clone(f.owner.board),picker=f.view.boardMindmapRelation(f.owner,'map','a',kind,()=>true);assert(picker?.opened);assert(picker.getItems().every((n:model.Card)=>supportsLocalRelations(n)&&n.id!=='a'&&!n.locked));picker.onChooseItem(picker.getItems().find((n:model.Card)=>n.id==='b'));await f.drain();assert.equal(f.errors.length,0);assert.equal(f.owner.board.edges.length,1);const edge=f.owner.board.edges[0];assert.equal(edge.from,kind==='parent'?'b':'a');assert.equal(edge.to,kind==='parent'?'a':'b');assert.equal(edge.kind,kind==='associate'?undefined:'branch');assert.equal(edge.direction,kind==='associate'?'both':'forward');assert.deepEqual(f.owner.board.nodes,before.nodes);assert.deepEqual(f.owner.board.viewport,before.viewport);assert.equal(f.reflows(),0);assert.equal(f.owner.history.undoStack.length,1);
 const saved=model.clone(f.owner.board);f.owner.undo();await f.owner.flush();assert.deepEqual(f.owner.board,before);f.owner.undo(true);await f.owner.flush();assert.deepEqual(f.owner.board,saved);
});
test('removing a selected parallel edge retains its sibling and ignores unsupported/text edges',async()=>{
 const initial=board();initial.edges=[{id:'one',from:'a',to:'b',label:'one'},{id:'two',from:'a',to:'b',label:'two'},{id:'text-edge',from:'a',to:'text',label:'text'}];const f=fixture(initial),before=model.clone(f.owner.board),picker=f.view.boardMindmapRelation(f.owner,'map','a','remove',()=>true);assert.deepEqual(picker.getItems().map((e:model.Edge)=>e.id),['one','two']);picker.onChooseItem(picker.getItems()[1]);await f.drain();assert.deepEqual(f.owner.board.edges,[before.edges[0],before.edges[2]]);assert.deepEqual(f.owner.board.nodes,before.nodes);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.reflows(),0);
});
test('closing a picker without choosing anything is a complete relation cancellation',async()=>{
 const f=fixture(),before=model.clone(f.owner.board),picker=f.view.boardMindmapRelation(f.owner,'map','a','associate',()=>true);picker.close();await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);
});
for(const mode of ['request-cancelled','container-locked','container-removed','owner-replaced','busy','source-changed'] as const)test(`relation ${mode} while previous saves drain cannot commit the captured request`,async()=>{
 const f=fixture(),gate=deferred(),original=f.owner.flush.bind(f.owner);let current=true,entered=false;f.owner.flush=async()=>{if(!entered){entered=true;await gate.promise;}return original();};const picker=f.view.boardMindmapRelation(f.owner,'map','a','associate',()=>current);picker.onChooseItem(picker.getItems().find((n:model.Card)=>n.id==='b'));await settled();assert(entered);
 if(mode==='request-cancelled')current=false;else if(mode==='container-locked')f.owner.board.nodes.find((n:model.Card)=>n.id==='map').locked=true;else if(mode==='container-removed')f.owner.board.nodes=f.owner.board.nodes.filter((n:model.Card)=>n.id!=='map');else if(mode==='owner-replaced')f.view.session={};else if(mode==='busy')f.view.inline={};else f.owner.board.nodes.find((n:model.Card)=>n.id==='b').file='Changed.md';const before=model.clone(f.owner.board);gate.resolve();await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);if(mode==='source-changed')assert.equal(f.errors.length,1);
});
test('removal cannot apply to an edge that changed after the picker captured it',async()=>{
 const initial=board();initial.edges=[{id:'one',from:'a',to:'b',label:'before'}];const f=fixture(initial),picker=f.view.boardMindmapRelation(f.owner,'map','a','remove',()=>true);f.owner.board.edges[0].label='external';picker.onChooseItem(picker.getItems()[0]);await f.drain();assert.equal(f.errors.length,1);assert.equal(f.owner.board.edges[0].label,'external');assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);
});
test('unmount closes a pending relation picker and removes only its owned container registration',()=>{
 const f=fixture(),m=f.mount();m.host.relate('a','associate',()=>true);const original=f.view.boardMindmaps.get('map');assert.equal(original,m.mounted);assert.equal(f.pickers[0].closed,false);m.scope.unload();assert.equal(f.pickers[0].closed,true);assert.equal(f.view.boardMindmaps.has('map'),false);assert.equal(m.mounted.closed,true);
 const a=f.mount(),b=f.mount();a.scope.unload();assert.equal(f.view.boardMindmaps.get('map'),b.mounted);b.scope.unload();assert.equal(f.view.boardMindmaps.has('map'),false);
});

for(const mode of ['inline','inlineTarget','gesture','marquee','rightMarquee','linkDrag','title','closing','converting'] as const)test(`a second window's ${mode} blocks relations in the shared Session without committing its draft`,async()=>{
 const f=fixture(),other=f.otherView(),draft={text:'unsaved popup draft'};
 if(mode==='converting')f.owner.convertingTexts.add('b');else if(mode==='title')other.contentEl.querySelector=()=>new Element(f.docs[1]);else other[mode]=draft;
 const before=model.clone(f.owner.board);assert.throws(()=>f.view.boardMindmapRelation(f.owner,'map','a','associate',()=>true),/草稿已保留/);await f.drain();assert.deepEqual(f.owner.board,before);assert.equal(f.pickers.length,0);assert.equal(f.writes(),0);assert.equal(f.owner.history.undoStack.length,0);if(mode!=='title'&&mode!=='converting')assert.equal(other[mode],draft);
});
test('a busy view of another Session does not block this board relation',async()=>{
 const f=fixture(),other=f.otherView(new f.Session(f.plugin,new TFile('Other.thoughtspace'),f.disk()));other.inline={text:'other board draft'};const picker=f.view.boardMindmapRelation(f.owner,'map','a','associate',()=>true);picker.onChooseItem(picker.getItems().find((n:model.Card)=>n.id==='b'));await f.drain();assert.equal(f.errors.length,0);assert.equal(f.owner.board.edges.length,1);assert.equal(other.session.history.undoStack.length,0);assert.equal(other.inline.text,'other board draft');
});
test('an edit begun in another window during flush cancels the queued relation without committing the draft',async()=>{
 const f=fixture(),other=f.otherView(),gate=deferred(),original=f.owner.flush.bind(f.owner);let entered=false;f.owner.flush=async()=>{if(!entered){entered=true;await gate.promise;}return original();};const picker=f.view.boardMindmapRelation(f.owner,'map','a','associate',()=>true);picker.onChooseItem(picker.getItems().find((n:model.Card)=>n.id==='b'));await settled();assert(entered);const draft={text:'popup draft'};other.inline=draft;gate.resolve();await f.drain();assert.equal(f.owner.board.edges.length,0);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes(),0);assert.equal(other.inline,draft);
});
function shortcut(target:Element,patch:Record<string,unknown>={}){return{target,key:'z',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,isComposing:false,...patch};}
test('container shortcuts undo and redo the captured board Session while preserving referenced geometry',async()=>{
 const f=fixture(),m=f.mount(),before:model.Board=model.clone(f.owner.board);m.host.change(state.createBoardMindmapState('b'));await f.owner.flush();const changed=model.clone(f.owner.board);assert.equal(m.host.shortcut(shortcut(m.element)),true);await f.owner.flush();assert.deepEqual(f.owner.board,before);assert.equal(m.host.shortcut(shortcut(m.element,{metaKey:false,ctrlKey:true,key:'y'})),true);await f.owner.flush();assert.deepEqual(f.owner.board,changed);assert.equal(m.host.shortcut(shortcut(m.element)),true);assert.equal(m.host.shortcut(shortcut(m.element,{shiftKey:true})),true);await f.owner.flush();assert.deepEqual(f.owner.board,changed);assert.equal(f.reflows(),0);
});
for(const mode of ['input','composing','alt','no-modifier','other-key','stale'] as const)test(`container shortcut leaves ${mode} events to their native owner`,async()=>{
 const f=fixture(),m=f.mount();m.host.change(state.createBoardMindmapState('b'));await f.owner.flush();const before=model.clone(f.owner.board),event=shortcut(m.element);
 if(mode==='input')m.element.matches.set('input,textarea,select,[contenteditable]:not([contenteditable=false])',new Element(f.docs[0],'INPUT'));else if(mode==='composing')event.isComposing=true;else if(mode==='alt')event.altKey=true;else if(mode==='no-modifier')event.metaKey=false;else if(mode==='other-key')event.key='p';else f.view.positions.set('map',new Element(f.docs[0]));assert.equal(m.host.shortcut(event),false);assert.deepEqual(f.owner.board,before);assert.equal(f.owner.history.undoStack.length,1);
});
test('container undo is consumed safely when another shared-window editor owns a draft',async()=>{
 const f=fixture(),m=f.mount(),other=f.otherView();m.host.change(state.createBoardMindmapState('b'));await f.owner.flush();const before=model.clone(f.owner.board),draft={text:'popup draft'};other.inline=draft;assert.equal(m.host.shortcut(shortcut(m.element)),true);assert.deepEqual(f.owner.board,before);assert.equal(other.inline,draft);assert.equal(f.owner.history.undoStack.length,1);assert.match(f.notices[0],/草稿已保留/);
});
function click(target:Element,patch:Record<string,unknown>={}){return{target,defaultPrevented:false,stopped:false,metaKey:false,ctrlKey:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...patch};}
function anchor(doc:Doc,kind:string,href:string){const link=new Element(doc,'A');link.addClass(kind);link.setAttribute('data-href',href);link.matches.set('a',link);return link;}
test('Markdown internal links resolve from the actual referenced note path and retain subpath',async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component(),link=anchor(f.docs[0],'internal-link','Sibling#Heading');f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>true);const event=click(link);body.emit('click',event);await f.drain();assert.deepEqual(f.links,[['Sibling#Heading','Notes/a.md','tab']]);assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(f.writes(),0);
});
for(const mode of ['unloaded','cancelled','moved','embedded','handled'] as const)test(`Markdown ${mode} link callbacks do not open a stale or separately owned target`,async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component(),link=anchor(f.docs[0],'internal-link','Sibling#^block');let current=true;f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>current);const event=click(link);
 if(mode==='unloaded')scope.unload();else if(mode==='cancelled')current=false;else if(mode==='moved')f.files.get('Notes/a.md')!.path='Other/a.md';else if(mode==='embedded')link.matches.set('.markdown-embed,.internal-embed',new Element(f.docs[0]));else event.defaultPrevented=true;body.emit('click',event);await f.drain();assert.equal(f.links.length,0);assert.equal(f.writes(),0);
});
test('Markdown navigation cancelled after its click but before the scheduled action never opens a file',async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component(),link=anchor(f.docs[0],'internal-link','Sibling');f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>true);body.emit('click',click(link));scope.unload();await f.drain();assert.equal(f.links.length,0);
});
test('Markdown tag navigation reuses the library filter without changing board state',async()=>{
 const f=fixture(),body=new Element(f.docs[0]),scope=new Component(),link=anchor(f.docs[0],'tag','#topic');link.textContent=' #topic ';const before=model.clone(f.owner.board);f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>true);const event=click(link);body.emit('click',event);await f.drain();assert.equal(f.view.tag,'#topic');assert.deepEqual(f.tabs,[['library','']]);assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});
test('dedicated brain Markdown tags delegate to native search with the captured preview lifetime guard',async()=>{
 const initial=board();initial.presentation='brain';initial.brain=state.createBoardMindmapState('a');const f=fixture(initial),body=new Element(f.docs[0]),scope=new Component(),link=anchor(f.docs[0],'tag','#topic');link.textContent=' #topic/child ';const before=model.clone(f.owner.board),searches:{tag:string;valid:()=>boolean}[]=[];f.view.openBrainTagSearch=async(tag:string,valid:()=>boolean)=>{searches.push({tag,valid});};
 f.view.previewBoardMindmap(f.owner,'a',body,scope,()=>true);const event=click(link);body.emit('click',event);await f.drain();assert.equal(searches.length,1);assert.equal(searches[0].tag,'#topic/child');assert.equal(searches[0].valid(),true);scope.unload();assert.equal(searches[0].valid(),false);assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.deepEqual(f.tabs,[]);assert.equal(f.view.tag,undefined);assert.deepEqual(f.owner.board,before);assert.equal(f.writes(),0);
});
test('container undo is held while asynchronous text conversion owns the shared Session',async()=>{
 const f=fixture(),m=f.mount();m.host.change(state.createBoardMindmapState('b'));await f.owner.flush();const before=model.clone(f.owner.board);f.owner.convertingTexts.add('text');assert.equal(m.host.shortcut(shortcut(m.element)),true);assert.deepEqual(f.owner.board,before);assert.equal(f.owner.history.undoStack.length,1);assert.match(f.notices[0],/草稿已保留/);f.owner.convertingTexts.delete('text');assert.equal(m.host.shortcut(shortcut(m.element)),true);assert.equal(m.host.snapshot().container.mindmap.centerId,'a');await f.owner.flush();
});
test('container relations retain automatic source dimensions across undo, redo and a fresh Session',async()=>{
 const initial=board();for(const node of initial.nodes)if(node.id==='a'||node.id==='b')node.autoFit=true;const f=fixture(initial),before=model.clone(f.owner.board.nodes),picker=f.view.boardMindmapRelation(f.owner,'map','a','associate',()=>true);picker.onChooseItem(picker.getItems().find((n:model.Card)=>n.id==='b'));await f.drain();assert.deepEqual(f.owner.board.nodes,before);assert.deepEqual(f.owner.board.relationGeometry.entries.map((entry:geometry.RelationGeometryEntry)=>entry.id),['a','b']);assert.equal(f.reflows(),0);
 for(const redo of [false,true]){f.owner.undo(redo);await f.owner.flush();assert.deepEqual(f.owner.board.nodes,before);assert.equal(f.owner.relationGeometryHeld(f.owner.board.nodes[0]),true);assert.equal(f.owner.relationGeometryHeld(f.owner.board.nodes[1]),true);}
 const saved=f.disk(),reopened=new f.Session(f.plugin,f.file,saved);assert.deepEqual(reopened.board.nodes,before);assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[0]),true);assert.equal(reopened.relationGeometryHeld(reopened.board.nodes[1]),true);assert.equal(reopened.history.undoStack.length,0);await reopened.flush();assert.equal(f.disk(),saved);
});
