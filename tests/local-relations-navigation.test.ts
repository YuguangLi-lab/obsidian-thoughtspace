import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {boardUsages} from '../src/board-usage';
import {branchState} from '../src/mindmap';
import {textExcerptPresentation,resolveSourceLink} from '../src/excerpt-sources';
import {locateParagraph,paragraphOrigin} from '../src/paragraph-card';
import type {Card} from '../src/model';
import {supportsLocalRelations} from '../src/local-relations';
import {nativeLocalRelations} from '../src/local-relations-native';
import * as relationState from '../src/local-relations-state';
import * as headingModel from '../src/local-relations-headings';

const source=readFileSync('src/main.ts','utf8');
const editorSource=readFileSync('src/local-relations-editor.ts','utf8');
const expandLocalRelationPane=new Function(transformSync(editorSource.slice(editorSource.indexOf('export function expandLocalRelationPane'),editorSource.indexOf('const returnLabel')).replace('export function','function')+';return expandLocalRelationPane',{loader:'ts'}).code)();
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`production method ${start}`);return source.slice(a,b);}
function deferred<T=void>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>resolve=yes);return{promise,resolve};}
async function reached(check:()=>boolean){for(let n=0;n<30&&!check();n++)await Promise.resolve();assert.equal(check(),true,'reach controlled async boundary');}
class View {}
class TFile{stat={mtime:1};constructor(public path:string){}get extension(){return this.path.split('.').pop()!;}get basename(){return this.path.split('/').pop()!.replace(/\.[^.]+$/,'');}}
class MarkdownView{
 state:Record<string,unknown>={};raw='';selections:unknown[]=[];cursors:unknown[]=[];scrolls:unknown[]=[];containerEl:any;
 file?:TFile;focuses=0;
 constructor(doc:object){this.containerEl={ownerDocument:doc,isConnected:true};}
 getState(){return this.state;}
 getMode(){return this.state.mode||'preview';}
 editor={focus:()=>{this.focuses++;},getValue:()=>this.raw,lineCount:()=>this.raw.split('\n').length,offsetToPos:(offset:number)=>({offset}),setSelection:(from:unknown,to:unknown)=>this.selections.push({from,to}),setCursor:(pos:unknown)=>this.cursors.push(pos),scrollIntoView:(range:unknown)=>this.scrolls.push(range)};
}
class LocalRelationsView{contexts:(string|undefined)[]=[];refreshes=0;containerEl:any;constructor(doc:object){this.containerEl={ownerDocument:doc,isConnected:true};}setContext(id?:string){this.contexts.push(id);}refresh(){this.refreshes++;}}
const parseLinktext=(link:string)=>{const at=link.indexOf('#');return{path:at<0?link:link.slice(0,at),subpath:at<0?'':link.slice(at)};};
const notices:string[]=[],dependencies={...headingModel,View,parseLinktext,TFile,MarkdownView,supportsLocalRelations,expandLocalRelationPane,EXT:'thoughtspace',VIEW:'board',boardUsages,textExcerptPresentation,resolveSourceLink,locateParagraph,pdfSubpath:(page:number)=>`#page=${page}`,assertNativeNoteUnchanged:()=>{},Notice:class{constructor(text:string){notices.push(text);}}};
const BoardView=new Function(...Object.keys(dependencies),transformSync('class BoardView{'+take('  get localRelationSelectedId()','  private sourcePopover?')+take('  private sourceFile(','  async openExcerptSource(')+take('  private async paragraphLocation(','  private addSourceBadge(')+'};return BoardView',{loader:'ts'}).code)(...Object.values(dependencies));
const timers=new Map<number,()=>void>();let timerId=0;
class LocalRelationsEditorReturn {
 calls:{graph:any;leaf:any;file:any;context:()=>boolean}[]=[];prunes=0;
 constructor(_app:unknown){}prune(){this.prunes++;}
 attach(graph:any,leaf:any,file:any,context:()=>boolean){this.calls.push({graph,leaf,file,context});}
}
const pluginDeps={...headingModel,View,EXT:'thoughtspace',VIEW:'board',...relationState,nativeLocalRelations,parseLinktext,TFile,MarkdownView,workspaceLeafId:(leaf:any)=>leaf.id,getAllTags:(cache:any)=>cache.tags?.map((tag:any)=>tag.tag)||[],window:{setTimeout:(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:(id:number)=>timers.delete(id)},report:()=>{},BoardView,LocalRelationsView,LocalRelationsEditorReturn,branchState,supportsLocalRelations,LOCAL_RELATIONS_VIEW:'relations'};
const Plugin=new Function(...Object.keys(pluginDeps),transformSync('class Plugin{'+take('  private localRelationsTargets=','  async openMaterialPanel(')+'installHeadingHooks(){'+take("    this.registerEvent(this.app.vault.on('modify', f =>","    this.registerEvent(this.app.vault.on('delete', file =>")+'}};return Plugin',{loader:'ts'}).code)(...Object.values(pluginDeps));
const card=(id='card',patch:Partial<Card>={}):Card=>({id,kind:'card',file:'Notes/Source.md',x:11,y:22,width:300,height:180,color:'sand',...patch});
function fixture(){
 const main={name:'main',defaultView:{closed:false}},popup={name:'popup',defaultView:{closed:false}},plugin=new Plugin(),files=new Map<string,TFile>(),contents=new Map<TFile,string>(),caches=new Map<TFile,unknown>(),listeners=new Map<object,()=>void>();
 const leaves:any[]=[],created:any[]=[],splits:any[]=[],revealed:any[]=[],activated:any[]=[],explained:TFile[]=[],reads:TFile[]=[],resolved:{path:string;context:string}[]=[];let activeDoc:object=popup;
 const file=(path:string,raw='')=>{const f=new TFile(path);files.set(path,f);contents.set(f,raw);return f;};const note=file('Notes/Source.md','# Heading\n\nA paragraph.\n');
 const hooks:{open?:(leaf:any,file:TFile)=>Promise<void>;reveal?:(leaf:any)=>Promise<void>;state?:(leaf:any)=>Promise<void>;read?:(file:TFile)=>Promise<string>;wrongDoc?:object;splitActivates?:boolean;split?:(leaf:any)=>void}={};
 const makeLeaf=(doc:object)=>{const leaf:any={id:'leaf-'+leaves.length,type:'empty',view:{containerEl:{ownerDocument:doc,isConnected:true}},detached:false,opened:[],ephemeral:[]};leaf.setEphemeralState=(state:any)=>{leaf.ephemeral.push(state);};leaf.getViewState=()=>({type:leaf.type,pinned:!!leaf.pinned,state:leaf.view.getState?.()||{}});leaf.detach=()=>{leaf.detached=true;leaf.view.containerEl.isConnected=false;};leaf.loadIfDeferred=async()=>{};
  leaf.getContainer=()=>({doc:leaf.view.containerEl.ownerDocument,win:leaf.view.containerEl.ownerDocument.defaultView});leaf.states=[];leaf.setViewState=async(state:any)=>{leaf.states.push(state);await hooks.state?.(leaf);leaf.type=state.type;if(state.type==='markdown'&&leaf.view instanceof MarkdownView)leaf.view.state={...state.state};else leaf.view=new LocalRelationsView(doc);};leaf.openFile=async(f:TFile,options:any)=>{leaf.opened.push({file:f,options});await hooks.open?.(leaf,f);if(f.extension==='thoughtspace'){const view=new BoardView(),held=plugin.provisionalBoardGeometry.get(leaf)===f;plugin.provisionalBoardGeometry.delete(leaf);Object.assign(view,{containerEl:{ownerDocument:doc},contentEl:{ownerDocument:doc},file:f,session:{file:f,board:{nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}}},getState:()=>({file:f.path}),closed:false,automaticGeometryDeferred:held,resumed:0,resumeAutomaticGeometry:()=>{view.automaticGeometryDeferred=false;view.resumed++;}});leaf.view=view;leaf.type='board';}else{const view=new MarkdownView(doc);view.state={file:f.path,...options?.state};view.file=f;view.raw=contents.get(f)||'';leaf.view=view;leaf.type=f.extension==='md'?'markdown':f.extension;}};leaves.push(leaf);return leaf;};
 const workspaceEvents=new Map<object,{name:string;callback:()=>void}>();
 const workspace:any={on:(name:string,callback:()=>void)=>{const ref={};workspaceEvents.set(ref,{name,callback});return ref;},offref:(ref:object)=>workspaceEvents.delete(ref),getActiveViewOfType:(type:any)=>{const leaf=workspace.activeLeaf;if(!leaf)return null;if(type!==View&&!(leaf.view instanceof type))return null;leaf.view.leaf=leaf;return leaf.view;},getLeavesOfType:(type:string)=>leaves.filter(l=>l.type===type&&!l.detached),getLeaf:()=>{const leaf=makeLeaf(hooks.wrongDoc||activeDoc);created.push(leaf);return leaf;},setActiveLeaf:(leaf:any,options:any)=>{activeDoc=leaf.view.containerEl.ownerDocument;workspace.activeLeaf=leaf;activated.push({leaf,options});for(const event of workspaceEvents.values())if(event.name==='active-leaf-change')event.callback();},revealLeaf:async(leaf:any)=>{revealed.push(leaf);await hooks.reveal?.(leaf);},createLeafBySplit:(anchor:any,direction:string)=>{assert.equal(direction,'vertical');const leaf=makeLeaf(anchor.view.containerEl.ownerDocument);splits.push({anchor,leaf});if(hooks.splitActivates)workspace.setActiveLeaf(leaf);hooks.split?.(leaf);return leaf;}};
 const app:any={workspace,vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async(f:TFile)=>{reads.push(f);return hooks.read?hooks.read(f):contents.get(f)||'';},getFiles:()=>{throw Error('local navigation must not scan the vault');},on:(_event:string,notify:()=>void)=>{const token={};listeners.set(token,notify);return token;},offref:(token:object)=>listeners.delete(token)},metadataCache:{resolvedLinks:{},getFirstLinkpathDest:(path:string,context:string)=>{resolved.push({path,context});return files.get(path)||files.get(path+'.md')||files.get(context.slice(0,context.lastIndexOf('/')+1)+path+'.md');},getFileCache:(f:TFile)=>caches.get(f)||null}};
 plugin.app=app;plugin.settings={localRelations:{}};plugin.saveData=async()=>{};plugin.provisionalBoardGeometry=new WeakMap();plugin.openNativeRelations=(f:TFile)=>{explained.push(f);};plugin.readUsageTexts=()=>{throw Error('no all-board usage query');};
 const makeBoard=(doc:object,path:string,nodes:Card[]=[card()])=>{const f=file(path),view=new BoardView(),leaf=makeLeaf(doc),owner={file:f,board:{version:3,nodes,edges:[],viewport:{x:50,y:60,zoom:.8}}};leaf.type='board';leaf.view=view;Object.assign(view,{app,plugin,leaf,file:f,session:owner,closed:false,selected:new Set(['card']),contentEl:{ownerDocument:doc},containerEl:{ownerDocument:doc,isConnected:true},located:[]});view.revealNode=(id:string)=>{view.located.push(id);};return{view,leaf,owner,file:f};};
 const board=makeBoard(main,'Boards/Main.thoughtspace'),other=makeBoard(popup,'Boards/Popup.thoughtspace');plugin.currentBoard=other.view;
 const bind=(target=board)=>{const leaf=makeLeaf(target.view.contentEl.ownerDocument);leaf.type='relations';leaf.view=new LocalRelationsView(target.view.contentEl.ownerDocument);plugin.localRelationsTargets.set(leaf,{view:target.view,owner:target.owner});return{leaf,host:plugin.localRelationsHost(leaf)};};
 const rename=(f:TFile,path:string)=>{files.delete(f.path);f.path=path;files.set(path,f);};
 return{plugin,app,main,popup,files,contents,caches,listeners,leaves,created,splits,revealed,activated,explained,reads,resolved,hooks,file,note,makeLeaf,makeBoard,board,other,bind,rename,workspaceEvents};
}

test('opening brain mode twice coalesces one native tab in the originating document without changing board data',async()=>{
 const f=fixture(),before=JSON.stringify(f.board.owner.board),selected=[...f.board.view.selected];await Promise.all([f.plugin.openLocalRelations(f.board.view,'card'),f.plugin.openLocalRelations(f.board.view,'card')]);assert.equal(f.created.length,1);assert.equal(f.created[0].view.containerEl.ownerDocument,f.main);assert.equal(JSON.stringify(f.board.owner.board),before);assert.deepEqual([...f.board.view.selected],selected);assert.deepEqual(f.board.view.located,[]);assert.deepEqual(f.explained,[]);
});

test('main and popup brain tabs keep separate owners despite global currentBoard',async()=>{
 const f=fixture();await f.plugin.openLocalRelations(f.board.view);await f.plugin.openLocalRelations(f.other.view);assert.equal(f.created.length,2);const main=f.created.find(l=>l.view.containerEl.ownerDocument===f.main),popup=f.created.find(l=>l.view.containerEl.ownerDocument===f.popup);assert.equal(f.plugin.localRelationsHost(main).snapshot().key,f.board.file);assert.equal(f.plugin.localRelationsHost(popup).snapshot().key,f.other.file);await f.plugin.openLocalRelations(f.board.view);assert.equal(f.created.length,2);
});

test('an unexpected cross-window getLeaf result is detached instead of receiving the brain mode',async()=>{
 const f=fixture();f.hooks.wrongDoc=f.popup;await assert.rejects(f.plugin.openLocalRelations(f.board.view),/当前窗口/);assert.equal(f.created[0].detached,true);assert.equal(f.created[0].type,'empty');
});

test('a board replaced while brain mode is loading cannot bind the old owner',async()=>{
 const f=fixture(),gate=deferred();f.hooks.state=()=>gate.promise;const opening=f.plugin.openLocalRelations(f.board.view);await reached(()=>f.created.length===1);f.board.view.session={...f.board.owner};gate.resolve();await opening;assert.equal(f.plugin.localRelationsTargets.size,0);assert.equal(f.revealed.length,0);
});

test('latest same-window brain opening wins if an earlier deferred load completes later',async()=>{
 const f=fixture(),next=f.makeBoard(f.main,'Boards/Second.thoughtspace'),{leaf}=f.bind(),gate=deferred();let loads=0;leaf.loadIfDeferred=()=>++loads===1?gate.promise:Promise.resolve();const older=f.plugin.openLocalRelations(f.board.view,'card');await reached(()=>loads===1);await f.plugin.openLocalRelations(next.view,'card');gate.resolve();await older;assert.equal(f.plugin.localRelationsHost(leaf).snapshot().key,next.file);
});

test('host snapshot follows board rename by file identity and retires deleted or replaced owners',()=>{
 const f=fixture(),{host}=f.bind();assert.equal(host.snapshot().selectedId,'card');f.rename(f.board.file,'Boards/Renamed.thoughtspace');assert.equal(host.snapshot().key,f.board.file);assert.equal(host.snapshot().name,'Renamed');f.files.delete(f.board.file.path);assert.equal(host.snapshot(),undefined);
});

test('multiselection is not mistaken for a single centered object and subscriptions clean up',()=>{
 const f=fixture(),{leaf,host}=f.bind();f.board.view.selected.add('another');assert.equal(host.snapshot().selectedId,undefined);let notices=0;const stop=host.subscribe(()=>{notices++;});f.plugin.refreshLocalRelations(f.other.view);assert.equal(notices,0);f.plugin.refreshLocalRelations(f.board.view);assert.equal(notices,1);for(const notify of f.listeners.values())notify();assert.equal(notices,3);stop();assert.equal(f.listeners.size,0);assert.equal(f.plugin.localRelationsTargets.has(leaf),false);
});

test('return to board restores its native tab without card selection or camera changes',async()=>{
 const f=fixture(),{host}=f.bind(),before=JSON.stringify(f.board.owner.board);await host.returnToBoard(()=>true);assert.equal(f.activated.at(-1).leaf,f.board.leaf);assert.deepEqual(f.board.view.located,[]);assert.equal(JSON.stringify(f.board.owner.board),before);assert.deepEqual([...f.board.view.selected],['card']);
});
for(const stale of ['cancel','owner','leaf-view'] as const)test(`return to board ignores ${stale} during reveal`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred();let active=true;f.hooks.reveal=()=>gate.promise;const task=host.returnToBoard(()=>active);await reached(()=>f.revealed.length===1);if(stale==='cancel')active=false;else if(stale==='owner')f.board.view.session={...f.board.owner};else f.board.leaf.view={containerEl:{ownerDocument:f.main}};gate.resolve();await task;assert.equal(f.activated.length,0);assert.deepEqual(f.board.view.located,[]);
});

test('only explicit locate moves to a card and it rejects folded or editing targets',async()=>{
 const f=fixture(),{host}=f.bind();await host.locate('card',()=>true);assert.deepEqual(f.board.view.located,['card']);f.board.view.inlineTarget='card';await assert.rejects(host.locate('card',()=>true),/结束当前卡片编辑/);delete f.board.view.inlineTarget;f.board.owner.board.nodes.push(card('parent',{kind:'text',text:'Parent',file:undefined,branchFolded:true}));(f.board.owner.board.edges as any[]).push({id:'branch',from:'parent',to:'card',kind:'branch',label:''});await assert.rejects(host.locate('card',()=>true),/折叠/);assert.deepEqual(f.board.view.located,['card']);
});

test('source availability distinguishes independent content missing sources and native Markdown explanation',()=>{
 const f=fixture(),{host}=f.bind();assert.equal(host.source('card').canExplain,true);f.files.delete(f.note.path);assert.equal(host.source('card').available,false);assert.match(host.source('card').reason,/移动或删除/);f.board.owner.board.nodes.push(card('text',{kind:'text',file:undefined,text:'No reference'}));assert.equal(host.source('text').label,'独立内容');host.explain('card',()=>true);assert.equal(f.explained.length,0);
});

test('source metadata and brain opening never start all-vault usages; explanation does only on explicit action',async()=>{
 const f=fixture(),{host}=f.bind();host.snapshot();host.source('card');await f.plugin.openLocalRelations(f.board.view);assert.equal(f.explained.length,0);host.explain('card',()=>false);assert.equal(f.explained.length,0);host.explain('card',()=>true);assert.deepEqual(f.explained,[f.note]);
});
for(const doc of ['main','popup'] as const)test(`${doc} source opens beside the captured brain tab, not the globally active window`,async()=>{
 const f=fixture(),target=doc==='main'?f.board:f.other,{host,leaf:graph}=f.bind(target);await host.openSource('card',()=>true);assert.equal(f.splits.length,1);assert.equal(f.splits[0].anchor,graph);assert.equal(f.splits[0].leaf.view.containerEl.ownerDocument,f[doc]);assert.deepEqual(f.splits[0].leaf.opened[0].options,{active:false,eState:undefined});assert.equal(f.activated.at(-1).leaf,f.splits[0].leaf);assert.deepEqual(target.view.located,[]);
});
for(const anchor of ['#Heading','#^existing'])test(`internal legacy embed source helper keeps existing ${anchor} without adding block IDs`,async()=>{
 const f=fixture(),{host}=f.bind();Object.assign(f.board.owner.board.nodes[0],{kind:'text',file:undefined,text:`![[Notes/Source.md${anchor}|Alias]]`});const before=f.contents.get(f.note);await f.board.view.openLocalRelationSource('card',()=>true);assert.equal(f.splits[0].leaf.opened[0].options.eState.subpath,anchor);assert.equal(f.contents.get(f.note),before);assert.deepEqual(f.reads,[]);assert.ok(f.resolved.every(r=>r.context===f.board.file.path));
});

test('paragraph source uses verified native range and leaves source text untouched',async()=>{
 const f=fixture(),{host}=f.bind(),raw=f.contents.get(f.note)!;Object.assign(f.board.owner.board.nodes[0],{kind:'card',file:undefined,text:'quote',paragraphQuote:paragraphOrigin(f.note.path,raw,{label:'paragraph',from:11,to:23},'snapshot')});await host.openSource('card',()=>true);const view=f.splits[0].leaf.view;assert.deepEqual(view.selections,[{from:{offset:11},to:{offset:23}}]);assert.deepEqual(f.reads,[f.note]);assert.equal(f.contents.get(f.note),raw);
});

test('internal legacy source helpers retain native text-line and PDF-page navigation',async()=>{
 const f=fixture(),{host}=f.bind();Object.assign(f.board.owner.board.nodes[0],{kind:'text',file:undefined,text:'Excerpt\n\n> 来源：[[Notes/Source.md]] · 第 3–4 行'});await f.board.view.openLocalRelationSource('card',()=>true);assert.deepEqual(f.splits[0].leaf.view.cursors,[{line:2,ch:0}]);const pdf=f.file('Files/Document.pdf');Object.assign(f.board.owner.board.nodes[0],{kind:'pdf',file:pdf.path,pdfPage:4});await f.board.view.openLocalRelationSource('card',()=>true);assert.equal(f.splits[1].leaf.opened[0].options.eState.subpath,'#page=4');assert.equal(f.board.view.localRelationSource(f.board.owner.board.nodes[0]).file.extension,'pdf');
});

test('missing source refuses navigation without creating a split or a replacement note',async()=>{
 const f=fixture(),{host}=f.bind();f.files.delete(f.note.path);await assert.rejects(host.openSource('card',()=>true),/缺失/);assert.equal(f.splits.length,0);assert.equal(f.files.has(f.note.path),false);
});

test('source cancellation before reading does not acquire a source tab',async()=>{
 const f=fixture(),{host}=f.bind();Object.assign(f.board.owner.board.nodes[0],{paragraphQuote:{path:f.note.path,mode:'embed',subpath:'#Heading'}});await host.openSource('card',()=>false);assert.equal(f.reads.length,0);assert.equal(f.splits.length,0);
});
for(const stage of ['read','open','reveal'] as const)test(`source cancellation during ${stage} prevents stale activation`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred<any>();let active=true,waiting=false;
 if(stage==='read'){Object.assign(f.board.owner.board.nodes[0],{paragraphQuote:{path:f.note.path,mode:'embed',subpath:'#Heading'}});f.hooks.read=()=>{waiting=true;return gate.promise;};}else if(stage==='open')f.hooks.open=()=>{waiting=true;return gate.promise;};else f.hooks.reveal=()=>{waiting=true;return gate.promise;};
 const task=host.openSource('card',()=>active);await reached(()=>waiting);active=false;gate.resolve(stage==='read'?f.contents.get(f.note):undefined);await task;assert.equal(f.activated.length,0);if(stage==='read')assert.equal(f.splits.length,0);if(stage!=='reveal')assert.equal(f.revealed.length,0);
});
for(const change of ['renamed','deleted','node-deleted','node-retargeted','owner'] as const)test(`${change} source while its native tab opens is not revealed or selected`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred();let waiting=false;f.hooks.open=()=>{waiting=true;return gate.promise;};const task=host.openSource('card',()=>true);await reached(()=>waiting);
 if(change==='renamed')f.rename(f.note,'Notes/Moved.md');else if(change==='deleted')f.files.delete(f.note.path);else if(change==='node-deleted')f.board.owner.board.nodes=[];else if(change==='node-retargeted')f.board.owner.board.nodes[0].file=f.file('Other.md').path;else f.board.view.session={...f.board.owner};gate.resolve();await task;assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});

test('source rename updates future requests once the board reference follows the same file',async()=>{
 const f=fixture(),{host}=f.bind();f.rename(f.note,'Moved/Renamed.md');f.board.owner.board.nodes[0].file=f.note.path;assert.equal(host.source('card').path,f.note.path);await host.openSource('card',()=>true);assert.equal(f.splits[0].leaf.opened[0].file,f.note);
});
for(const replacement of ['view','file'] as const)test(`source ${replacement} replacement during reveal cannot activate unrelated content`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred();f.hooks.reveal=()=>gate.promise;const task=host.openSource('card',()=>true);await reached(()=>f.revealed.length===1);const leaf=f.splits[0].leaf;if(replacement==='view'){leaf.view=new MarkdownView(f.main);leaf.view.state={file:'Other.md'};}else leaf.view.state.file='Other.md';gate.resolve();await task;assert.equal(f.activated.length,0);
});

test('changed native editor contents reject paragraph selection without rewriting source',async()=>{
 const f=fixture(),{host}=f.bind(),raw=f.contents.get(f.note)!;Object.assign(f.board.owner.board.nodes[0],{paragraphQuote:paragraphOrigin(f.note.path,raw,{label:'paragraph',from:11,to:23},'snapshot')});f.hooks.open=async()=>{f.contents.set(f.note,'Changed while opening');};await assert.rejects(host.openSource('card',()=>true),/来源在打开时已变化/);assert.deepEqual(f.splits[0].leaf.view.selections,[]);assert.equal(f.revealed.length,0);
});

test('explicitly revealing source may hide brain mode while the captured navigation stays valid',async()=>{
 const f=fixture(),{host}=f.bind();let visible=true,contextValid=true;const flags:boolean[]=[];const current=(allowHidden=false)=>{flags.push(allowHidden);return contextValid&&(allowHidden||visible);};
 f.hooks.reveal=async()=>{visible=false;};await host.openSource('card',current);assert.equal(f.activated.at(-1).leaf,f.splits[0].leaf);assert.equal(flags.at(-1),true);assert.ok(flags.includes(false),'visibility must be validated before permitting the deliberate reveal');contextValid=false;assert.equal(current(true),false);
});
for(const stage of ['read','open'] as const)test(`hiding brain mode during ${stage} is not excused by source reveal permission`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred<any>();let visible=true,waiting=false;const current=(allowHidden=false)=>allowHidden||visible;
 if(stage==='read'){Object.assign(f.board.owner.board.nodes[0],{paragraphQuote:{path:f.note.path,mode:'embed',subpath:'#Heading'}});f.hooks.read=()=>{waiting=true;return gate.promise;};}else f.hooks.open=()=>{waiting=true;return gate.promise;};
 const task=host.openSource('card',current);await reached(()=>waiting);visible=false;gate.resolve(stage==='read'?f.contents.get(f.note):undefined);await task;assert.equal(f.activated.length,0);assert.equal(f.revealed.length,0);if(stage==='read')assert.equal(f.splits.length,0);
});

for(const state of ['deleted','folded','inline','inlineTarget'] as const)test(`locate rechecks ${state} after reveal without unfolding or moving the board`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred();f.hooks.reveal=()=>gate.promise;const task=host.locate('card',()=>true);await reached(()=>f.revealed.length===1);
 if(state==='deleted')f.board.owner.board.nodes=[];else if(state==='folded'){f.board.owner.board.nodes.push(card('parent',{kind:'text',file:undefined,text:'Parent',branchFolded:true}));(f.board.owner.board.edges as any[]).push({id:'branch',from:'parent',to:'card',kind:'branch',label:''});}else f.board.view[state]=state==='inline'?{}:'card';
 const expected=JSON.stringify(f.board.owner.board);gate.resolve();await assert.rejects(task,/状态已变化/);assert.deepEqual(f.board.view.located,[]);assert.equal(JSON.stringify(f.board.owner.board),expected);
});

test('an independently moved brain mode retains its board and opens source in its own window',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind();graph.view.containerEl.ownerDocument=f.popup;assert.equal(host.snapshot().key,f.board.file);assert.equal(host.source('card').available,true);await host.openSource('card',()=>true);assert.equal(f.splits[0].anchor,graph);assert.equal(f.splits[0].leaf.view.containerEl.ownerDocument,f.popup);assert.equal(f.activated.at(-1).leaf,f.splits[0].leaf);
 await host.returnToBoard(()=>true);assert.equal(f.activated.at(-1).leaf,f.board.leaf);assert.deepEqual(f.board.view.located,[]);
});

test('moving the original board later does not retarget the brain mode source to that window',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind();f.board.view.contentEl.ownerDocument=f.popup;f.board.view.containerEl.ownerDocument=f.popup;assert.equal(host.snapshot().key,f.board.file);await host.openSource('card',()=>true);assert.equal(f.splits[0].anchor,graph);assert.equal(f.splits[0].leaf.view.containerEl.ownerDocument,f.main);
});

for(const stage of ['open','reveal'] as const)test(`moving brain mode while its source ${stage} is pending prevents late activation`,async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),gate=deferred();let waiting=false;if(stage==='open')f.hooks.open=()=>{waiting=true;return gate.promise;};else f.hooks.reveal=()=>{waiting=true;return gate.promise;};const task=host.openSource('card',()=>true);await reached(()=>waiting);graph.view.containerEl.ownerDocument=f.popup;gate.resolve();await task;assert.equal(f.activated.length,0);if(stage==='open')assert.equal(f.revealed.length,0);
});

for(const type of ['markdown','pdf'] as const)test(`${type} source reuses a matching same-window native leaf without reopening or replacing its view`,async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),file=type==='pdf'?f.file('Files/Source.pdf'):f.note,existing=f.makeLeaf(f.main);await existing.openFile(file,{});const originalView=existing.view;originalView.state.mode='preview';originalView.state.scroll=37;existing.opened.length=0;let loads=0;existing.loadIfDeferred=async()=>{loads++;};
 if(type==='pdf')Object.assign(f.board.owner.board.nodes[0],{kind:'pdf',file:file.path,pdfPage:7});else Object.assign(f.board.owner.board.nodes[0],{kind:'text',file:undefined,text:'![[Notes/Source.md#Heading]]'});
 await f.board.view.openLocalRelationSource('card',()=>true);await f.board.view.openLocalRelationSource('card',()=>true);assert.equal(f.splits.length,0);assert.equal(existing.view,originalView);assert.equal(existing.opened.length,0);assert.equal(loads,2);assert.equal(originalView.state.mode,'preview');assert.equal(originalView.state.scroll,37);assert.deepEqual(existing.ephemeral,[{subpath:type==='pdf'?'#page=7':'#Heading'},{subpath:type==='pdf'?'#page=7':'#Heading'}]);assert.ok(f.activated.every(item=>item.leaf===existing));
});

for(const type of ['markdown','pdf'] as const)test(`${type} source never reuses the matching leaf in another window`,async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),file=type==='pdf'?f.file('Files/Source.pdf'):f.note,remote=f.makeLeaf(f.popup);await remote.openFile(file,{});remote.opened.length=0;if(type==='pdf')Object.assign(f.board.owner.board.nodes[0],{kind:'pdf',file:file.path,pdfPage:3});await f.board.view.openLocalRelationSource('card',()=>true,graph);assert.equal(f.splits.length,1);assert.equal(f.splits[0].anchor,graph);assert.equal(f.splits[0].leaf.view.containerEl.ownerDocument,f.main);assert.equal(remote.opened.length,0);assert.deepEqual(remote.ephemeral,[]);assert.equal(f.activated.at(-1).leaf,f.splits[0].leaf);
});

test('reusing a deferred source respects cancellation before setting heading state',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),existing=f.makeLeaf(f.main),gate=deferred();await existing.openFile(f.note,{});Object.assign(f.board.owner.board.nodes[0],{kind:'text',file:undefined,text:'![[Notes/Source.md#Heading]]'});let active=true,waiting=false;existing.loadIfDeferred=()=>{waiting=true;return gate.promise;};const task=f.board.view.openLocalRelationSource('card',()=>active);await reached(()=>waiting);active=false;gate.resolve();await task;assert.deepEqual(existing.ephemeral,[]);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});

for(const stale of ['file','document'] as const)test(`reused source ${stale} changed during deferred load receives no stale ephemeral location`,async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),existing=f.makeLeaf(f.main),gate=deferred();await existing.openFile(f.note,{});Object.assign(f.board.owner.board.nodes[0],{kind:'text',file:undefined,text:'![[Notes/Source.md#Heading]]'});let waiting=false;existing.loadIfDeferred=()=>{waiting=true;return gate.promise;};const task=f.board.view.openLocalRelationSource('card',()=>true);await reached(()=>waiting);
 if(stale==='file')existing.view.state.file='Different.md';else existing.view.containerEl.ownerDocument=f.popup;gate.resolve();await task;assert.deepEqual(existing.ephemeral,[]);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});

test('a reused source moved into another window during reveal is not activated there',async()=>{
 const f=fixture(),{host}=f.bind(),existing=f.makeLeaf(f.main),gate=deferred();await existing.openFile(f.note,{});f.hooks.reveal=()=>gate.promise;const task=host.openSource('card',()=>true);await reached(()=>f.revealed.length===1);existing.view.containerEl.ownerDocument=f.popup;gate.resolve();await task;assert.equal(f.activated.length,0);
});

for(const stage of ['create','deferred','reveal'] as const)test(`brain mode rejects a board moved to another document during ${stage}`,async()=>{
 const f=fixture(),gate=deferred();let waiting=false;
 if(stage==='create')f.hooks.state=()=>{waiting=true;return gate.promise;};else{const {leaf}=f.bind();if(stage==='deferred')leaf.loadIfDeferred=()=>{waiting=true;return gate.promise;};else f.hooks.reveal=()=>{waiting=true;return gate.promise;};}
 const opening=f.plugin.openLocalRelations(f.board.view);await reached(()=>waiting);f.board.view.contentEl.ownerDocument=f.popup;f.board.view.containerEl.ownerDocument=f.popup;f.activated.length=0;gate.resolve();await opening;assert.equal(f.activated.length,0);if(stage!=='reveal')assert.equal(f.revealed.length,0);
});


test('a moved brain mode reuses its window source even when the original board also has that file open',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),mainSource=f.makeLeaf(f.main),popupSource=f.makeLeaf(f.popup);await mainSource.openFile(f.note,{});await popupSource.openFile(f.note,{});graph.view.containerEl.ownerDocument=f.popup;mainSource.opened.length=popupSource.opened.length=0;await host.openSource('card',()=>true);assert.equal(f.splits.length,0);assert.equal(f.activated.at(-1).leaf,popupSource);assert.equal(mainSource.opened.length,0);assert.equal(popupSource.opened.length,0);
});

for(const stage of ['open','reveal'] as const)test(`replacing the brain view during source ${stage} cancels its captured navigation`,async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),gate=deferred();let waiting=false;
 if(stage==='open')f.hooks.open=()=>{waiting=true;return gate.promise;};else f.hooks.reveal=()=>{waiting=true;return gate.promise;};
 const task=host.openSource('card',()=>true);await reached(()=>waiting);graph.view=new LocalRelationsView(f.main);gate.resolve();await task;assert.equal(f.activated.length,0);if(stage==='open')assert.equal(f.revealed.length,0);
});

test('brain opening does not focus a replacement brain view after reveal resolves',async()=>{
 const f=fixture(),{leaf}=f.bind(),gate=deferred();f.hooks.reveal=()=>gate.promise;const opening=f.plugin.openLocalRelations(f.board.view,'card');await reached(()=>f.revealed.length===1);leaf.view=new LocalRelationsView(f.main);f.activated.length=0;gate.resolve();await opening;assert.equal(f.activated.length,0);assert.equal(leaf.view.refreshes,0);
});

test('loaded source view replacement with the same file receives no stale location',async()=>{
 const f=fixture(),{host}=f.bind(),existing=f.makeLeaf(f.main),gate=deferred();await existing.openFile(f.note,{});Object.assign(f.board.owner.board.nodes[0],{paragraphQuote:{path:f.note.path,mode:'embed',subpath:'#Heading'}});let waiting=false;existing.isDeferred=false;existing.loadIfDeferred=()=>{waiting=true;return gate.promise;};const task=host.openSource('card',()=>true);await reached(()=>waiting);const replacement=new MarkdownView(f.main);replacement.state={file:f.note.path};existing.view=replacement;gate.resolve();await task;assert.deepEqual(existing.ephemeral,[]);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});

test('the original board leaf being replaced retires the graph host before onClose finishes',()=>{
 const f=fixture(),{host}=f.bind();f.board.leaf.view=new MarkdownView(f.main);assert.equal(host.snapshot(),undefined);
});

for(const kind of ['card','board','section'] as const)test(`brain entry supports ${kind} without changing board geometry, viewport or selection`,async()=>{
 const f=fixture();f.board.owner.board.nodes=[card('supported',{kind,file:undefined})];f.board.view.selected=new Set(['supported']);const before=JSON.stringify(f.board.owner.board);const graph=await f.plugin.openLocalRelations(f.board.view,'supported');assert.deepEqual(graph.contexts,['supported']);assert.equal(JSON.stringify(f.board.owner.board),before);assert.deepEqual([...f.board.view.selected],['supported']);
});
for(const kind of ['text','image','pdf','audio','video'] as const)test(`${kind} cannot enter brain mode or use its host actions`,async()=>{
 const f=fixture();f.board.owner.board.nodes=[card('unsupported',{kind})];f.board.view.selected=new Set(['unsupported']);const {host}=f.bind(),before=JSON.stringify(f.board.owner.board);assert.equal(host.snapshot().selectedId,undefined);assert.equal(host.source('unsupported').available,false);await assert.rejects(f.plugin.openLocalRelations(f.board.view,'unsupported'),/笔记卡片、子白板和分组/);await host.openSource('unsupported',()=>true);await host.locate('unsupported',()=>true);host.explain('unsupported',()=>true);assert.equal(f.created.length,0);assert.equal(f.splits.length,0);assert.equal(f.revealed.length,0);assert.equal(f.explained.length,0);assert.equal(JSON.stringify(f.board.owner.board),before);
});
test('header brain entry ignores a selected unsupported text and picks the first eligible object',async()=>{
 const f=fixture();f.board.owner.board.nodes=[card('text',{kind:'text',file:undefined}),card('group',{kind:'section',file:undefined}),card('note')];f.board.view.selected=new Set(['text']);const graph=await f.plugin.openLocalRelations(f.board.view);assert.deepEqual(graph.contexts,[undefined]);assert.deepEqual([...f.board.view.selected],['text']);
});
for(const stage of ['open','reveal'] as const)test(`cancelled child-board source ${stage} keeps automatic geometry paused`,async()=>{
 const f=fixture(),{host}=f.bind(),child=f.file('Boards/Child.thoughtspace','immutable child board'),gate=deferred();Object.assign(f.board.owner.board.nodes[0],{kind:'board',file:child.path});let active=true,waiting=false,heldBeforeLoad=false;
 f.hooks.open=async leaf=>{heldBeforeLoad=f.plugin.provisionalBoardGeometry.get(leaf)===child;if(stage==='open'){waiting=true;await gate.promise;}};if(stage==='reveal')f.hooks.reveal=async()=>{waiting=true;await gate.promise;};const before=JSON.stringify(f.board.owner.board),raw=f.contents.get(child),task=host.openSource('card',()=>active);await reached(()=>waiting);active=false;gate.resolve();await task;assert.equal(heldBeforeLoad,true);assert.equal(f.splits[0].leaf.view.automaticGeometryDeferred,true);assert.equal(f.splits[0].leaf.view.resumed,0);assert.equal(f.activated.length,0);assert.equal(JSON.stringify(f.board.owner.board),before);assert.equal(f.contents.get(child),raw);
});
test('explicit child-board source commit resumes geometry only after reveal stays current',async()=>{
 const f=fixture(),{host}=f.bind(),child=f.file('Boards/Child.thoughtspace'),gate=deferred();Object.assign(f.board.owner.board.nodes[0],{kind:'board',file:child.path});f.hooks.reveal=()=>gate.promise;const task=host.openSource('card',()=>true);await reached(()=>f.revealed.length===1);const view=f.splits[0].leaf.view;assert.equal(view.automaticGeometryDeferred,true);assert.equal(view.resumed,0);assert.equal(f.activated.length,0);gate.resolve();await task;assert.equal(view.resumed,1);assert.equal(f.activated.at(-1).leaf,f.splits[0].leaf);
});
test('child-board source open error cleans provisional marker and never activates',async()=>{
 const f=fixture(),{host}=f.bind(),child=f.file('Boards/Child.thoughtspace');Object.assign(f.board.owner.board.nodes[0],{kind:'board',file:child.path});f.hooks.open=async()=>{throw Error('Synthetic load failure');};await assert.rejects(host.openSource('card',()=>true),/Synthetic load failure/);assert.equal(f.plugin.provisionalBoardGeometry.has(f.splits[0].leaf),false);assert.equal(f.activated.length,0);assert.equal(f.revealed.length,0);
});
test('child-board source reuses a loaded matching board only in the graph window',async()=>{
 const f=fixture(),{host}=f.bind(),child=f.file('Boards/Child.thoughtspace'),local=f.makeLeaf(f.main),remote=f.makeLeaf(f.popup);await local.openFile(child,{});await remote.openFile(child,{});local.opened.length=remote.opened.length=0;Object.assign(f.board.owner.board.nodes[0],{kind:'board',file:child.path});await host.openSource('card',()=>true);assert.equal(f.splits.length,0);assert.equal(local.opened.length,0);assert.equal(remote.opened.length,0);assert.equal(local.view.resumed,1);assert.equal(remote.view.resumed,0);assert.equal(f.activated.at(-1).leaf,local);
});

for(const cancelled of [true,false])test(`deferred child-board source ${cancelled?'cancellation stays paused':'commit resumes the loaded board'}`,async()=>{
 const f=fixture(),{host}=f.bind(),child=f.file('Boards/Deferred.thoughtspace','immutable deferred child'),existing=f.makeLeaf(f.main),gate=deferred();Object.assign(f.board.owner.board.nodes[0],{kind:'board',file:child.path});existing.type='board';existing.isDeferred=true;existing.view={containerEl:{ownerDocument:f.main},getState:()=>({file:child.path})};let active=true,waiting=false,heldBeforeLoad=false;
 existing.loadIfDeferred=async()=>{heldBeforeLoad=f.plugin.provisionalBoardGeometry.get(existing)===child;waiting=true;await gate.promise;await existing.openFile(child,{active:false});existing.isDeferred=false;};const before=JSON.stringify(f.board.owner.board),raw=f.contents.get(child),task=host.openSource('card',()=>active);await reached(()=>waiting);if(cancelled)active=false;gate.resolve();await task;assert.equal(heldBeforeLoad,true);assert.equal(f.splits.length,0);assert.equal(existing.view.automaticGeometryDeferred,cancelled);assert.equal(existing.view.resumed,cancelled?0:1);assert.equal(f.activated.length,cancelled?0:1);assert.equal(JSON.stringify(f.board.owner.board),before);assert.equal(f.contents.get(child),raw);
});
test('deferred child-board load error clears its own provisional geometry marker',async()=>{
 const f=fixture(),{host}=f.bind(),child=f.file('Boards/Deferred.thoughtspace'),existing=f.makeLeaf(f.main);Object.assign(f.board.owner.board.nodes[0],{kind:'board',file:child.path});existing.type='board';existing.isDeferred=true;existing.view={containerEl:{ownerDocument:f.main},getState:()=>({file:child.path})};existing.loadIfDeferred=async()=>{assert.equal(f.plugin.provisionalBoardGeometry.get(existing),child);throw Error('Synthetic deferred failure');};await assert.rejects(host.openSource('card',()=>true),/Synthetic deferred failure/);assert.equal(f.plugin.provisionalBoardGeometry.has(existing),false);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});

test('deleting the original board while brain mode is being created prevents stale reveal and focus',async()=>{
 const f=fixture(),gate=deferred();let waiting=false;f.hooks.state=()=>{waiting=true;return gate.promise;};const opening=f.plugin.openLocalRelations(f.board.view,'card');await reached(()=>waiting);f.files.delete(f.board.file.path);f.activated.length=0;gate.resolve();await opening;assert.equal(f.plugin.localRelationsTargets.size,0);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});

for(const mode of ['inline','inlineTarget'] as const)for(const action of ['openSource','editSource'] as const)test(`${action} refuses a same-file ${mode} draft without committing or acquiring a tab`,async()=>{
 const f=fixture(),{host}=f.bind();let commits=0;f.other.view.inlineId=mode==='inline'?'card':undefined;f.other.view.inline=mode==='inline'?{commit:()=>{commits++;}}:undefined;f.other.view.inlineTarget=mode==='inlineTarget'?'card':undefined;const before=JSON.stringify(f.other.owner.board);await assert.rejects(host[action]('card',()=>true),/草稿已保留/);assert.equal(commits,0);assert.equal(f.splits.length,0);assert.equal(f.revealed.length,0);assert.equal(JSON.stringify(f.other.owner.board),before);
});
test('editing an unrelated source does not block native note navigation',async()=>{
 const f=fixture(),{host}=f.bind();f.other.owner.board.nodes[0].file=f.file('Different.md').path;f.other.view.inlineId='card';f.other.view.inline={commit:()=>{throw Error('must not commit');}};await host.openSource('card',()=>true);assert.equal(f.activated.length,1);
});
for(const stage of ['open','mode','reveal'] as const)test(`same-file draft appearing during source ${stage} prevents late focus or editor selection`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred();let waiting=false;if(stage==='open')f.hooks.open=()=>{waiting=true;return gate.promise;};else if(stage==='mode')f.hooks.state=()=>{waiting=true;return gate.promise;};else f.hooks.reveal=()=>{waiting=true;return gate.promise;};const task=host[stage==='reveal'?'openSource':'editSource']('card',()=>true).catch(()=>{});await reached(()=>waiting);f.other.view.inlineTarget='card';gate.resolve();await task;assert.equal(f.activated.length,0);assert.equal(f.splits[0].leaf.view.focuses,0);assert.deepEqual(f.splits[0].leaf.view.selections,[]);
});
test('editSource uses native source mode and focuses only its matching current editor',async()=>{
 const f=fixture(),{host}=f.bind(),before=f.contents.get(f.note);await host.editSource('card',()=>true);const leaf=f.splits[0].leaf;assert.equal(leaf.view.getMode(),'source');assert.equal(leaf.states[0].active,false);assert.equal(leaf.view.focuses,1);assert.equal(f.activated.at(-1).leaf,leaf);assert.equal(f.contents.get(f.note),before);
});
test('editSource rejects a non-Markdown child-board source before opening anything',async()=>{
 const f=fixture(),{host}=f.bind();Object.assign(f.board.owner.board.nodes[0],{kind:'board',file:f.file('Child.thoughtspace').path});await assert.rejects(host.editSource('card',()=>true),/Markdown/);assert.equal(f.splits.length,0);
});
for(const change of ['cancel','view','file'] as const)test(`editSource ${change} during native mode change prevents late activation`,async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred();let waiting=false,active=true;f.hooks.state=()=>{waiting=true;return gate.promise;};const task=host.editSource('card',()=>active);await reached(()=>waiting);if(change==='cancel')active=false;else if(change==='view')f.splits[0].leaf.view=new MarkdownView(f.main);else f.board.owner.board.nodes[0].file=f.file('Changed.md').path;gate.resolve();await task;assert.equal(f.activated.length,0);
});

test('host saveState only accepts its live board and clones saved and loaded snapshots',()=>{
 const f=fixture(),{host}=f.bind(),saved=relationState.cleanLocalRelationsState({version:1,center:'card',pins:['card']});host.saveState(f.other.file.path,saved);assert.deepEqual(f.plugin.settings.localRelations,{});host.saveState(f.board.file.path,saved);saved.pins.push('other');assert.deepEqual(f.plugin.settings.localRelations[f.board.file.path].pins,['card']);const loaded=host.loadState(f.board.file.path);loaded.pins.push('mutated');assert.deepEqual(host.loadState(f.board.file.path).pins,['card']);
});
for(const invalid of ['closed','replaced','deleted','unsubscribed'] as const)test(`host rejects stale state saves after its board is ${invalid}`,()=>{
 const f=fixture(),{host}=f.bind(),stop=host.subscribe(()=>{});if(invalid==='closed')f.board.view.closed=true;else if(invalid==='replaced')f.board.leaf.view={};else if(invalid==='deleted')f.files.delete(f.board.file.path);else stop();host.saveState(f.board.file.path,relationState.cleanLocalRelationsState({version:1,center:'stale'}));assert.deepEqual(f.plugin.settings.localRelations,{});
});
test('state persistence serializes writes and keeps the newest snapshot after an in-flight save',async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred(),writes:any[]=[];f.plugin.saveData=async(value:any)=>{writes.push(JSON.parse(JSON.stringify(value)));if(writes.length===1)await gate.promise;};host.saveState(f.board.file.path,relationState.cleanLocalRelationsState({version:1,center:'first'}));const first=f.plugin.flushLocalRelationsSettings();await reached(()=>writes.length===1);host.saveState(f.board.file.path,relationState.cleanLocalRelationsState({version:1,center:'second'}));const second=f.plugin.flushLocalRelationsSettings();await Promise.resolve();assert.equal(writes.length,1);gate.resolve();await Promise.all([first,second]);assert.equal(writes.length,2);assert.equal(writes[0].localRelations[f.board.file.path].center,'first');assert.equal(writes[1].localRelations[f.board.file.path].center,'second');
});
test('state persistence recovers its queue after a save failure without reverting the live snapshot',async()=>{
 const f=fixture(),{host}=f.bind();let writes=0;f.plugin.saveData=async()=>{if(++writes===1)throw Error('Synthetic save failure');};host.saveState(f.board.file.path,relationState.cleanLocalRelationsState({version:1,center:'first'}));await assert.rejects(f.plugin.flushLocalRelationsSettings(),/Synthetic/);host.saveState(f.board.file.path,relationState.cleanLocalRelationsState({version:1,center:'second'}));await f.plugin.flushLocalRelationsSettings();assert.equal(writes,2);assert.equal(host.loadState(f.board.file.path).center,'second');
});

test('workspace restoration rebinds the exact original board leaf across windows without opening files',async()=>{
 const f=fixture(),{host,leaf}=f.bind();leaf.view.containerEl.ownerDocument=f.popup;f.plugin.localRelationsTargets.delete(leaf);f.plugin.openBoard=()=>{throw Error('restore must not load or fit a board');};assert.equal(await host.restoreContext(f.board.file.path,f.board.leaf.id,()=>true),true);assert.equal(host.snapshot().key,f.board.file);assert.equal(f.created.length,0);assert.equal(f.splits.length,0);assert.equal(f.revealed.length,0);
});
test('workspace restoration uses a unique existing local board when no leaf ID is saved',async()=>{
 const f=fixture(),{host,leaf}=f.bind();f.plugin.localRelationsTargets.delete(leaf);assert.equal(await host.restoreContext(f.board.file.path,undefined,()=>true),true);assert.equal(host.snapshot().originLeafId,f.board.leaf.id);
});
for(const invalid of ['ambiguous','closed','wrong-session','missing','cancelled'] as const)test(`workspace restoration refuses ${invalid} ownership without opening a board`,async()=>{
 const f=fixture(),{host,leaf}=f.bind();f.plugin.localRelationsTargets.delete(leaf);if(invalid==='ambiguous'){const duplicate=f.makeBoard(f.main,'Temporary.thoughtspace');duplicate.file=f.board.file;duplicate.owner.file=f.board.file;duplicate.view.file=f.board.file;duplicate.view.session=duplicate.owner;}else if(invalid==='closed')f.board.view.closed=true;else if(invalid==='wrong-session')f.board.view.session={...f.board.owner,file:f.other.file};else if(invalid==='missing')f.files.delete(f.board.file.path);assert.equal(await host.restoreContext(f.board.file.path,undefined,()=>invalid!=='cancelled'),false);assert.equal(host.snapshot(),undefined);assert.equal(f.created.length,0);assert.equal(f.revealed.length,0);
});

test('native host reads only metadata for supported source objects on its captured board',()=>{
 const f=fixture(),{host}=f.bind(),peer=f.file('Notes/Peer.md'),outside=f.file('Outside.md');f.board.owner.board.nodes.push(card('peer',{file:peer.path}));f.caches.set(f.note,{links:[{link:peer.path,position:{start:{line:1}}},{link:outside.path,position:{start:{line:2}}}],tags:[{tag:'#local'}]});f.caches.set(peer,{links:[{link:f.note.path,position:{start:{line:0}}}]});const accessed:string[]=[],original=f.app.metadataCache.getFileCache;f.app.metadataCache.getFileCache=(file:TFile)=>{accessed.push(file.path);return original(file);};const graph=host.native('card');assert.deepEqual(graph.relations.map((row:any)=>[row.nodeId,row.kind]),[['peer','outgoing'],['peer','incoming']]);assert.ok(accessed.every(path=>[f.note.path,peer.path].includes(path)));assert.equal(f.reads.length,0);assert.deepEqual(graph.tagsByNode.get('card'),['#local']);
});
test('activeSource follows only a same-window native note and reports duplicate source ambiguity',async()=>{
 const f=fixture(),{host}=f.bind(),local=f.makeLeaf(f.main),remote=f.makeLeaf(f.popup);await local.openFile(f.note,{});await remote.openFile(f.note,{});f.app.workspace.activeLeaf=remote;assert.deepEqual(host.activeSource(),{});f.app.workspace.activeLeaf=local;assert.deepEqual(host.activeSource(),{ids:['card'],id:'card',ambiguous:false});f.board.owner.board.nodes.push(card('same-source'));assert.deepEqual(host.activeSource(),{ids:['card','same-source'],id:undefined,ambiguous:true});f.app.workspace.activeLeaf=f.board.leaf;assert.deepEqual(host.activeSource(),{});
});

test('native companion split restores the graph, origin board or another-window active leaf before loading',async()=>{
 for(const origin of ['graph','board','other-window']){const f=fixture(),{host,leaf:graph}=f.bind(),previous=origin==='graph'?graph:origin==='board'?f.board.leaf:f.other.leaf,before=JSON.stringify(f.board.owner.board);f.app.workspace.activeLeaf=previous;f.hooks.splitActivates=true;f.hooks.open=async()=>{assert.equal(f.app.workspace.activeLeaf,previous,'restored before openFile awaits');};host.setCompanion(true);await host.syncSource('card',()=>true);assert.deepEqual(f.activated.map(call=>call.leaf),[f.splits[0].leaf,previous]);assert.deepEqual(f.activated[1].options,{focus:false});assert.equal(f.app.workspace.activeLeaf,previous);assert.equal(f.revealed.length,0);assert.equal(JSON.stringify(f.board.owner.board),before);}
});
test('companion creation never restores the old leaf after a synchronous switch to a third page',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),third=f.makeLeaf(f.main);f.app.workspace.activeLeaf=graph;f.hooks.splitActivates=true;f.hooks.split=()=>f.app.workspace.setActiveLeaf(third,{focus:true});host.setCompanion(true);await host.syncSource('card',()=>true);assert.equal(f.app.workspace.activeLeaf,third);assert.deepEqual(f.activated.map(call=>call.leaf),[f.splits[0].leaf,third]);
});
test('companion load completion never repeats the synchronous focus restoration after a user switch',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),third=f.makeLeaf(f.main),gate=deferred();let waiting=false;f.app.workspace.activeLeaf=graph;f.hooks.splitActivates=true;f.hooks.open=()=>{waiting=true;return gate.promise;};host.setCompanion(true);const pending=host.syncSource('card',()=>true);await reached(()=>waiting);assert.equal(f.app.workspace.activeLeaf,graph);f.app.workspace.setActiveLeaf(third,{focus:true});const calls=f.activated.length;gate.resolve();await pending;assert.equal(f.app.workspace.activeLeaf,third);assert.equal(f.activated.length,calls);assert.equal(f.revealed.length,0);
});
test('companion creation does not restore a detached, replaced, moved or closed-window previous view',async()=>{
 for(const change of ['detached','replaced','moved','closed-window']){const f=fixture(),{host}=f.bind(),previous=f.other.leaf;f.app.workspace.activeLeaf=previous;f.hooks.splitActivates=true;f.hooks.split=()=>{if(change==='detached')previous.detach();else if(change==='replaced')previous.view=new MarkdownView(f.popup);else if(change==='moved')previous.view.containerEl.ownerDocument=f.main;else f.popup.defaultView.closed=true;};host.setCompanion(true);await host.syncSource('card',()=>true);assert.equal(f.activated.length,1,change);assert.equal(f.app.workspace.activeLeaf,f.splits[0].leaf,change);}
});
test('companion creation does not restore an old active page once its source context has expired',async()=>{
 for(const change of ['cancelled','source-deleted']){const f=fixture(),{host,leaf:graph}=f.bind();let current=true;f.app.workspace.activeLeaf=graph;f.hooks.splitActivates=true;f.hooks.split=()=>{if(change==='cancelled')current=false;else f.files.delete(f.note.path);};host.setCompanion(true);await host.syncSource('card',()=>current).catch(()=>{});assert.equal(f.activated.length,1,change);assert.equal(f.app.workspace.activeLeaf,f.splits[0].leaf);assert.equal(f.splits[0].leaf.opened.length,0);}
});
test('rapid companion creation keeps one split and one synchronous restoration while the newest source wins',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),other=f.file('Notes/Other.md'),gate=deferred();f.board.owner.board.nodes.push(card('other',{file:other.path}));f.app.workspace.activeLeaf=graph;f.hooks.splitActivates=true;let waiting=false;f.hooks.open=async()=>{if(!waiting){waiting=true;await gate.promise;}};host.setCompanion(true);const older=host.syncSource('card',()=>true);await reached(()=>waiting);const newer=host.syncSource('other',()=>true);gate.resolve();await Promise.all([older,newer]);assert.equal(f.splits.length,1);assert.equal(f.splits[0].leaf.view.file,other);assert.equal(f.app.workspace.activeLeaf,graph);assert.deepEqual(f.activated.map(call=>call.leaf),[f.splits[0].leaf,graph]);assert.equal(host.companion().available,true);
});
test('direct background source creation uses the same synchronous native split restoration',async()=>{
 const f=fixture(),{leaf:graph}=f.bind();f.app.workspace.activeLeaf=graph;f.hooks.splitActivates=true;await f.board.view.openLocalRelationSource('card',()=>true,graph,{activate:false,dedicated:true});assert.equal(f.app.workspace.activeLeaf,graph);assert.deepEqual(f.activated.map(call=>call.leaf),[f.splits[0].leaf,graph]);assert.deepEqual(f.activated[1].options,{focus:false});assert.equal(f.revealed.length,0);
});
test('explicit source opening and editing keep their native activation behavior',async()=>{
 for(const action of ['openSource','editSource']){const f=fixture(),{host,leaf:graph}=f.bind();f.app.workspace.activeLeaf=graph;f.hooks.splitActivates=true;await host[action]('card',()=>true);const native=f.splits[0].leaf;assert.equal(f.app.workspace.activeLeaf,native);assert.ok(f.activated.every(call=>call.leaf===native));assert.equal(f.activated.at(-1).options.focus,true);if(action==='editSource'){assert.equal(native.view.getMode(),'source');assert.equal(native.view.focuses,1);}}
});

test('companion is explicit and creates a dedicated split without commandeering an existing source tab',async()=>{
 const f=fixture(),{host,leaf:graph}=f.bind(),existing=f.makeLeaf(f.main);await existing.openFile(f.note,{});const old=existing.view;existing.opened.length=0;assert.deepEqual(host.companion(),{enabled:false,available:false});await host.syncSource('card',()=>true);assert.equal(f.splits.length,0);host.setCompanion(true);await host.syncSource('card',()=>true);assert.equal(f.splits.length,1);assert.equal(f.splits[0].anchor,graph);assert.notEqual(f.splits[0].leaf,existing);assert.equal(existing.view,old);assert.equal(existing.opened.length,0);assert.equal(f.activated.length,0);assert.equal(f.revealed.length,0);assert.deepEqual(host.companion(),{enabled:true,available:true});
});
test('companion reuses only its own leaf on later centers and disabling preserves its native page',async()=>{
 const f=fixture(),{host}=f.bind(),other=f.file('Notes/Other.md','Other source');f.board.owner.board.nodes.push(card('other',{file:other.path}));host.setCompanion(true);await host.syncSource('card',()=>true);const partner=f.splits[0].leaf;await host.syncSource('other',()=>true);assert.equal(f.splits.length,1);assert.equal(partner.view.file,other);assert.equal(partner.opened.length,2);assert.equal(f.activated.length,0);assert.equal(f.revealed.length,0);host.setCompanion(false);assert.deepEqual(host.companion(),{enabled:false,available:false});assert.equal(partner.detached,false);assert.equal(partner.view.file,other);
});
for(const takeover of ['pinned','moved','replaced','retargeted','closed'] as const)test(`companion stops when its page is ${takeover} without replacing user content`,async()=>{
 const f=fixture(),{host}=f.bind(),other=f.file('Notes/Other.md');f.board.owner.board.nodes.push(card('other',{file:other.path}));host.setCompanion(true);await host.syncSource('card',()=>true);const partner=f.splits[0].leaf;if(takeover==='pinned')partner.pinned=true;else if(takeover==='moved')partner.view.containerEl.ownerDocument=f.popup;else if(takeover==='replaced'){partner.view=new MarkdownView(f.main);partner.view.state={file:f.note.path};}else if(takeover==='retargeted')partner.view.state.file='Unrelated.md';else partner.detach();const before=partner.view,opened=partner.opened.length;await assert.rejects(host.syncSource('other',()=>true),/联动已停止/);assert.equal(partner.view,before);assert.equal(partner.opened.length,opened);assert.equal(host.companion().enabled,false);assert.equal(f.activated.length,0);
});
test('turning companion off while its first native page loads prevents ownership and late focus',async()=>{
 const f=fixture(),{host}=f.bind(),gate=deferred();let waiting=false;f.hooks.open=()=>{waiting=true;return gate.promise;};host.setCompanion(true);const pending=host.syncSource('card',()=>true);await reached(()=>waiting);host.setCompanion(false);gate.resolve();await pending;assert.deepEqual(host.companion(),{enabled:false,available:false});assert.equal(f.activated.length,0);assert.equal(f.revealed.length,0);
});
test('companion does not replace the native page that the user is actively editing',async()=>{
 const f=fixture(),{host}=f.bind(),other=f.file('Notes/Other.md');f.board.owner.board.nodes.push(card('other',{file:other.path}));host.setCompanion(true);await host.syncSource('card',()=>true);const partner=f.splits[0].leaf;f.app.workspace.activeLeaf=partner;partner.view.raw='Uncommitted native draft';await host.syncSource('other',()=>true).catch(()=>{});assert.equal(partner.view.file,f.note);assert.equal(partner.view.raw,'Uncommitted native draft');assert.equal(partner.opened.length,1);assert.equal(f.activated.length,0);
});
test('rapid initial companion center switches keep a single dedicated native leaf',async()=>{
 const f=fixture(),{host}=f.bind(),other=f.file('Notes/Other.md'),gate=deferred();f.board.owner.board.nodes.push(card('other',{file:other.path}));let waiting=false;f.hooks.open=async()=>{if(!waiting){waiting=true;await gate.promise;}};host.setCompanion(true);const older=host.syncSource('card',()=>true);await reached(()=>waiting);const newer=host.syncSource('other',()=>true);gate.resolve();await Promise.all([older,newer]);assert.equal(f.splits.length,1);assert.equal(f.activated.length,0);assert.equal(f.revealed.length,0);
});

function evidenceFixture(kind:'link'|'embed'|'property'|'indexed'='link'){
 const f=fixture(),{host,leaf:graph}=f.bind(),target=f.file('Notes/Target.md'),evidence={id:'proof',kind,sourcePath:f.note.path,targetPath:target.path,subpath:kind==='indexed'?'':'#Heading',...(kind==='indexed'?{}:{line:1}),...(kind==='property'?{property:'related'}:{})};f.contents.set(f.note,'First line\n[[Notes/Target.md#Heading]]\nLast line');const reference={link:target.path+'#Heading',position:{start:{line:1}},...(kind==='property'?{key:'related'}:{})};f.caches.set(f.note,kind==='indexed'?{}:{[kind==='property'?'frontmatterLinks':kind==='embed'?'embeds':'links']:[reference]});f.app.metadataCache.resolvedLinks[f.note.path]={[target.path]:1};return{...f,host,graph,target,evidence};
}
for(const kind of ['link','embed','property','indexed'] as const)test(`${kind} evidence opens its native source and exact cached line without changing text`,async()=>{
 const f=evidenceFixture(kind),before=f.contents.get(f.note);await f.host.openEvidence(f.evidence,()=>true);const leaf=f.splits[0].leaf;assert.equal(leaf.view.file,f.note);assert.deepEqual(leaf.view.cursors,kind==='indexed'?[]:[{line:1,ch:0}]);assert.equal(f.contents.get(f.note),before);assert.equal(f.activated.at(-1).leaf,leaf);
});
for(const mutation of ['cache','mtime','source-deleted','target-retargeted','cancel'] as const)test(`evidence ${mutation} while opening cancels stale cursor and focus`,async()=>{
 const f=evidenceFixture(),gate=deferred();let waiting=false,active=true;f.hooks.open=()=>{waiting=true;return gate.promise;};const pending=f.host.openEvidence(f.evidence,()=>active);await reached(()=>waiting);if(mutation==='cache')f.caches.set(f.note,{links:[]});else if(mutation==='mtime')f.note.stat.mtime++;else if(mutation==='source-deleted')f.files.delete(f.note.path);else if(mutation==='target-retargeted')f.caches.set(f.note,{links:[{link:'Different.md',position:{start:{line:1}}}]});else active=false;gate.resolve();await pending;assert.deepEqual(f.splits[0].leaf.view.cursors,[]);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});
test('evidence source moved to another window during reveal is not activated there',async()=>{
 const f=evidenceFixture(),gate=deferred();f.hooks.reveal=()=>gate.promise;const pending=f.host.openEvidence(f.evidence,()=>true);await reached(()=>f.revealed.length===1);f.splits[0].leaf.view.containerEl.ownerDocument=f.popup;gate.resolve();await pending;assert.equal(f.activated.length,0);
});
test('indexed evidence is rechecked against the current native aggregate before navigation',async()=>{
 const f=evidenceFixture('indexed');f.app.metadataCache.resolvedLinks[f.note.path]={};await f.host.openEvidence(f.evidence,()=>true).catch(()=>{});assert.equal(f.splits.length,0);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});
test('evidence source becoming a same-file inline draft during reveal does not receive late focus',async()=>{
 const f=evidenceFixture(),gate=deferred();f.hooks.reveal=()=>gate.promise;const pending=f.host.openEvidence(f.evidence,()=>true).catch(()=>{});await reached(()=>f.revealed.length===1);f.other.view.inlineTarget='card';gate.resolve();await pending;assert.equal(f.activated.length,0);
});

for(const action of ['openSource','editSource','openEvidence'] as const)test(`${action} does not steal focus after the user switches to a third native page during native handoff`,async()=>{
 const f=evidenceFixture(),third=f.makeLeaf(f.main),other=f.file('Unrelated.md'),gate=deferred();await third.openFile(other,{});f.app.workspace.activeLeaf=f.graph;let waiting=false;const wait=()=>{waiting=true;return gate.promise;};if(action==='editSource')f.hooks.state=wait;else f.hooks.reveal=wait;const pending=action==='openEvidence'?f.host.openEvidence(f.evidence,()=>true):f.host[action]('card',()=>true);await reached(()=>waiting);f.app.workspace.activeLeaf=third;gate.resolve();await pending;assert.equal(f.activated.length,0);assert.equal(f.app.workspace.activeLeaf,third);
});
test('indexed evidence removed during native source loading is not revealed',async()=>{
 const f=evidenceFixture('indexed'),gate=deferred();let waiting=false;f.hooks.open=()=>{waiting=true;return gate.promise;};const pending=f.host.openEvidence(f.evidence,()=>true);await reached(()=>waiting);f.app.metadataCache.resolvedLinks[f.note.path]={};gate.resolve();await pending;assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});
test('indexed evidence with a deleted endpoint cannot open a stale source tab',async()=>{
 const f=evidenceFixture('indexed');f.files.delete(f.target.path);await assert.rejects(f.host.openEvidence(f.evidence,()=>true),/关系来源已变化/);assert.equal(f.splits.length,0);
});
test('rapid changes to an existing companion finish on the newest center after an older load settles',async()=>{
 const f=fixture(),{host}=f.bind(),older=f.file('Notes/Older.md'),latest=f.file('Notes/Latest.md'),gate=deferred();f.board.owner.board.nodes.push(card('older',{file:older.path}),card('latest',{file:latest.path}));host.setCompanion(true);await host.syncSource('card',()=>true);const partner=f.splits[0].leaf;let waiting=false;f.hooks.open=async(_leaf,file)=>{if(file===older){waiting=true;await gate.promise;}};const a=host.syncSource('older',()=>true);await reached(()=>waiting);const b=host.syncSource('latest',()=>true);for(let i=0;i<6;i++)await Promise.resolve();gate.resolve();await Promise.all([a,b]);assert.equal(f.splits.length,1);assert.equal(partner.view.file,latest);assert.equal(host.companion().available,true);assert.equal(f.activated.length,0);
});

function headingFixture(raw='## Same\nBody\n## Same\nEnd\n'){
 const f=fixture(),{host,leaf:graph}=f.bind(),headings=[{heading:'Same',level:2,position:{start:{line:0,col:0,offset:0}}},{heading:'Same',level:2,position:{start:{line:2,col:0,offset:13}}}];f.contents.set(f.note,raw);f.caches.set(f.note,{headings});const tree=host.headings('card');return{...f,host,graph,headings,tree,target:tree.items[1].target};
}
test('heading host uses actual card source metadata without reading body or mutating the board',()=>{
 const f=headingFixture(),before=JSON.stringify(f.board.owner.board);assert.equal(f.tree.status,'ready');assert.equal(f.tree.total,2);assert.deepEqual(f.reads,[]);assert.equal(JSON.stringify(f.board.owner.board),before);assert.notEqual(f.tree.items[0].id,f.tree.items[1].id);
});
for(const kind of ['text','board','section'] as const)test(`heading host excludes ${kind} even if its file looks like Markdown`,async()=>{
 const f=headingFixture();f.board.owner.board.nodes[0].kind=kind;assert.equal(f.host.headings('card').status,'unsupported');await f.host.openHeading('card',f.target,()=>true);assert.equal(f.splits.length,0);assert.deepEqual(f.reads,[]);
});
test('heading host distinguishes missing source from pending native metadata',()=>{
 const f=headingFixture();f.caches.delete(f.note);assert.equal(f.host.headings('card').status,'pending');f.files.delete(f.note.path);assert.equal(f.host.headings('card').status,'missing');assert.deepEqual(f.reads,[]);
});
test('duplicate heading navigation sends exact native ephemeral line and cursor without subpath lookup',async()=>{
 const f=headingFixture(),before=f.contents.get(f.note);Object.assign(f.board.owner.board.nodes[0],{paragraphQuote:{path:f.note.path,mode:'embed',subpath:'#Same'}});await f.host.openHeading('card',f.target,()=>true);const leaf=f.splits[0].leaf;assert.equal(leaf.opened[0].options.eState,undefined);assert.deepEqual(leaf.ephemeral,[{line:2}]);assert.deepEqual(leaf.view.cursors,[{line:2,ch:0}]);assert.deepEqual(leaf.view.selections,[]);assert.deepEqual(f.reads,[]);assert.equal(f.contents.get(f.note),before);assert.equal(f.activated.at(-1).leaf,leaf);
});
test('heading navigation preserves an existing native reading view mode',async()=>{
 const f=headingFixture(),existing=f.makeLeaf(f.main);await existing.openFile(f.note,{state:{mode:'preview'}});const view=existing.view;existing.opened.length=0;await f.host.openHeading('card',f.target,()=>true);assert.equal(f.splits.length,0);assert.equal(existing.view,view);assert.equal(view.getMode(),'preview');assert.equal(existing.opened.length,0);assert.deepEqual(existing.ephemeral,[{line:2}]);
});
test('Setext heading navigation uses the text line from native metadata',async()=>{
 const f=headingFixture('Paragraph\n\nHeading\n---\n'),cache={headings:[{heading:'Heading',level:2,position:{start:{line:2,col:0,offset:11},end:{line:3,col:3,offset:22}}}]};f.caches.set(f.note,cache);const target=f.host.headings('card').items[0].target;await f.host.openHeading('card',target,()=>true);assert.deepEqual(f.splits[0].leaf.ephemeral,[{line:2}]);assert.deepEqual(f.splits[0].leaf.view.cursors,[{line:2,ch:0}]);
});
test('heading targets from a different note are rejected before acquiring a native page',async()=>{
 const f=headingFixture();const wrong={...f.target,sourcePath:'Different.md'};await assert.rejects(f.host.openHeading('card',wrong,()=>true),/标题或来源索引已变化/);assert.equal(f.splits.length,0);assert.deepEqual(f.reads,[]);
});
for(const change of ['mtime','cache-line','cache-heading','pending','source-renamed','source-deleted','node-deleted','cancelled'] as const)test(`heading ${change} while native source opens sends no stale location or focus`,async()=>{
 const f=headingFixture(),gate=deferred();let waiting=false,active=true;f.hooks.open=()=>{waiting=true;return gate.promise;};const pending=f.host.openHeading('card',f.target,()=>active);await reached(()=>waiting);if(change==='mtime')f.note.stat.mtime++;else if(change==='cache-line')f.caches.set(f.note,{headings:[{...f.headings[1],position:{start:{line:3,col:0,offset:21}}}]});else if(change==='cache-heading')f.caches.set(f.note,{headings:[{...f.headings[1],heading:'Changed'}]});else if(change==='pending')f.plugin.localRelationsHeadingPending.add(f.note);else if(change==='source-renamed')f.rename(f.note,'Moved.md');else if(change==='source-deleted')f.files.delete(f.note.path);else if(change==='node-deleted')f.board.owner.board.nodes=[];else active=false;gate.resolve();await pending;assert.deepEqual(f.splits[0].leaf.ephemeral,[]);assert.deepEqual(f.splits[0].leaf.view.cursors,[]);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);
});
for(const raw of ['## Same\nBody\n## Changed\n','## Same\nBody\n','```md\nBody\n## Same\n```\n'])test(`stale cache cannot navigate a mismatched or fenced editor line: ${JSON.stringify(raw)}`,async()=>{
 const f=headingFixture(raw);f.headings[1].position.start.offset=raw.split('\n').slice(0,2).reduce((offset,line)=>offset+line.length+1,0);f.caches.set(f.note,{headings:f.headings});f.target=f.host.headings('card').items[1].target;await assert.rejects(f.host.openHeading('card',f.target,()=>true),/无法安全核实当前标题位置/);assert.deepEqual(f.splits[0].leaf.ephemeral,[]);assert.deepEqual(f.splits[0].leaf.view.cursors,[]);assert.equal(f.activated.length,0);
});
test('an editor heading changed during reveal receives no late activation',async()=>{
 const f=headingFixture(),gate=deferred();f.hooks.reveal=()=>gate.promise;const pending=f.host.openHeading('card',f.target,()=>true);await reached(()=>f.revealed.length===1);f.splits[0].leaf.view.raw='## Same\nBody\n## Changed\n';gate.resolve();await pending;assert.equal(f.activated.length,0);
});
test('a native view replaced by ephemeral heading navigation receives no cursor or focus',async()=>{
 const f=headingFixture(),existing=f.makeLeaf(f.main);await existing.openFile(f.note,{});const old=existing.view;existing.setEphemeralState=(state:any)=>{existing.ephemeral.push(state);existing.view=new MarkdownView(f.main);existing.view.state={file:f.note.path};};await f.host.openHeading('card',f.target,()=>true);assert.deepEqual(old.cursors,[]);assert.deepEqual(existing.view.cursors,[]);assert.equal(f.activated.length,0);
});
test('heading navigation retains same-file inline draft protection',async()=>{
 const f=headingFixture();f.other.view.inlineTarget='card';await assert.rejects(f.host.openHeading('card',f.target,()=>true),/草稿已保留/);assert.equal(f.splits.length,0);assert.deepEqual(f.reads,[]);
});
test('public heading cache remains pending from vault modify until native metadata changed',async()=>{
 const f=headingFixture(),handlers=new Map<string,(...args:any[])=>void>();f.plugin.registerEvent=()=>{};f.plugin.sessions=new Map();f.plugin.knownTags=new Map();f.app.workspace.onLayoutReady=()=>{};f.app.vault.on=(name:string,callback:(...args:any[])=>void)=>{handlers.set('vault:'+name,callback);return{};};f.app.metadataCache.on=(name:string,callback:(...args:any[])=>void)=>{handlers.set('metadata:'+name,callback);return{};};f.plugin.installHeadingHooks();const cached=f.plugin.localRelationHeadingCache(f.note);assert.equal(cached,f.caches.get(f.note));handlers.get('vault:modify')!(f.note);assert.equal(f.plugin.localRelationHeadingCache(f.note),null);assert.equal(f.host.headings('card').status,'pending');await assert.rejects(f.host.openHeading('card',f.target,()=>true),/标题或来源索引已变化/);assert.equal(f.splits.length,0);assert.deepEqual(f.reads,[]);handlers.get('metadata:changed')!(f.note,f.contents.get(f.note),cached);assert.equal(f.plugin.localRelationHeadingCache(f.note),cached);assert.equal(f.host.headings('card').status,'ready');
});

test('heading host reuses one source tree for same-file cards without conflating duplicate titles',()=>{
 const f=headingFixture();f.board.owner.board.nodes.push(card('same-file'));assert.equal(f.host.headings('card'),f.tree);assert.equal(f.host.headings('same-file'),f.tree);assert.equal(f.tree.items[0].heading,f.tree.items[1].heading);assert.notEqual(f.tree.items[0].id,f.tree.items[1].id);assert.equal(f.tree.items[1].target.line,2);assert.deepEqual(f.reads,[]);
});
test('heading host drops its one-source snapshot when notified even if cache was edited in place',()=>{
 const f=headingFixture();let notifications=0;const stop=f.host.subscribe(()=>{notifications++;});const first=f.host.headings('card');f.headings[1].heading='Renamed in native cache';f.plugin.refreshLocalRelations(f.board.view);const fresh=f.host.headings('card');assert.equal(notifications,1);assert.notEqual(fresh,first);assert.equal(fresh.items[1].heading,'Renamed in native cache');assert.equal(first.items[1].heading,'Same');stop();assert.equal(f.host.headings('card').status,'unsupported');
});
test('heading cache replacement, source mtime and rename each retire the old host snapshot',()=>{
 const f=headingFixture();let previous=f.host.headings('card');f.caches.set(f.note,{headings:[...f.headings]});let fresh=f.host.headings('card');assert.notEqual(fresh,previous);previous=fresh;f.note.stat.mtime++;fresh=f.host.headings('card');assert.notEqual(fresh,previous);assert.equal(fresh.items[0].target.mtime,f.note.stat.mtime);previous=fresh;f.rename(f.note,'Moved.md');f.board.owner.board.nodes[0].file=f.note.path;fresh=f.host.headings('card');assert.notEqual(fresh,previous);assert.equal(fresh.sourcePath,'Moved.md');assert.notEqual(fresh.items[0].id,previous.items[0].id);
});

test('uppercase Markdown source headings reuse a same-window native note and navigate the exact line',async()=>{
 const f=headingFixture();f.rename(f.note,'Notes/Source.MD');f.board.owner.board.nodes[0].file=f.note.path;const tree=f.host.headings('card'),target=tree.items[1].target;assert.equal(tree.status,'ready');assert.equal(target.sourcePath,f.note.path);const native=f.makeLeaf(f.main);await native.openFile(f.note,{state:{mode:'preview'}});native.type='markdown';native.opened.length=0;await f.host.openHeading('card',target,()=>true);assert.equal(f.splits.length,0);assert.equal(native.opened.length,0);assert.deepEqual(native.ephemeral,[{line:2}]);assert.deepEqual(native.view.cursors,[{line:2,ch:0}]);assert.equal(native.view.getMode(),'preview');assert.equal(f.activated.at(-1).leaf,native);
});
test('uppercase Markdown modify events hold heading navigation until native metadata catches up',async()=>{
 const f=headingFixture(),handlers=new Map<string,(...args:any[])=>void>();f.rename(f.note,'Notes/Source.MD');f.board.owner.board.nodes[0].file=f.note.path;const target=f.host.headings('card').items[1].target;f.plugin.registerEvent=()=>{};f.plugin.sessions=new Map();f.plugin.knownTags=new Map();f.app.workspace.onLayoutReady=()=>{};f.app.vault.on=(name:string,callback:(...args:any[])=>void)=>{handlers.set('vault:'+name,callback);return{};};f.app.metadataCache.on=(name:string,callback:(...args:any[])=>void)=>{handlers.set('metadata:'+name,callback);return{};};f.plugin.installHeadingHooks();handlers.get('vault:modify')!(f.note);assert.equal(f.plugin.localRelationHeadingCache(f.note),null);assert.equal(f.host.headings('card').status,'pending');await assert.rejects(f.host.openHeading('card',target,()=>true),/标题或来源索引已变化/);assert.equal(f.splits.length,0);assert.deepEqual(f.reads,[]);handlers.get('metadata:changed')!(f.note,f.contents.get(f.note),f.caches.get(f.note));assert.equal(f.host.headings('card').status,'ready');
});

function centerEditFixture(){const f=fixture(),bound=f.bind();f.plugin.addChild=(child:any)=>child;f.app.workspace.activeLeaf=bound.leaf;return{...f,...bound};}
test('explicit center edit opens a native file in source mode and attaches a return action without a body copy or board mutation',async()=>{
 const f=centerEditFixture(),before=JSON.stringify(f.board.owner.board),raw=f.contents.get(f.note);f.host.setCompanion(true);await f.host.editCenter('card',()=>true);
 const editor=f.splits[0].leaf;assert.equal(editor.view.file,f.note);assert.equal(editor.view.getMode(),'source');assert.equal(f.host.companion().enabled,false);assert.equal(f.plugin.localRelationsEditor.calls.length,1);assert.equal(f.plugin.localRelationsEditor.calls[0].graph,f.leaf.view);assert.equal(f.plugin.localRelationsEditor.calls[0].leaf,editor);assert.equal(f.plugin.localRelationsEditor.calls[0].context(),true);assert.equal(f.contents.get(f.note),raw);assert.equal(JSON.stringify(f.board.owner.board),before);assert.deepEqual(f.reads,[]);assert.equal(editor.view.focuses,1);
});
test('center edit reuses a same-window native editor without replacing its unsaved buffer, cursor or undo owner',async()=>{
 const f=centerEditFixture(),editor=f.makeLeaf(f.main);await editor.openFile(f.note,{});const view=editor.view;view.raw='Native buffer that has not reached disk';view.cursors.push({line:7,ch:2});view.state.scroll=99;editor.opened.length=0;await f.host.editCenter('card',()=>true);
 assert.equal(f.splits.length,0);assert.equal(editor.opened.length,0);assert.equal(editor.view,view);assert.equal(view.raw,'Native buffer that has not reached disk');assert.deepEqual(view.cursors,[{line:7,ch:2}]);assert.equal(view.state.scroll,99);assert.equal(f.plugin.localRelationsEditor.calls[0].leaf,editor);
});
test('center edit drains an existing companion open before reusing its leaf and disables further automatic replacement',async()=>{
 const f=centerEditFixture(),gate=deferred();f.host.setCompanion(true);const partner=f.plugin.localRelationsCompanions.get(f.leaf);partner.queue=gate.promise;let settled=false;const task=f.host.editCenter('card',()=>true).then(()=>{settled=true;});await Promise.resolve();assert.equal(partner.enabled,false);assert.equal(f.splits.length,0);assert.equal(settled,false);gate.resolve();await task;assert.equal(f.splits.length,1);assert.equal(f.plugin.localRelationsEditor.calls.length,1);
});
for(const change of ['cancel','retarget','remove','kind','lock','rename','delete','replace-file','graph-replaced','graph-moved','window-closed','owner','inline-draft','companion-reenabled','companion-reset'] as const)test(`center edit rejects ${change} while a previous companion operation drains`,async()=>{
 const f=centerEditFixture(),gate=deferred();f.host.setCompanion(true);f.plugin.localRelationsCompanions.get(f.leaf).queue=gate.promise;let active=true;const task=f.host.editCenter('card',()=>active);await Promise.resolve();
 if(change==='cancel')active=false;else if(change==='retarget')f.board.owner.board.nodes[0].file=f.file('Other.md').path;else if(change==='remove')f.board.owner.board.nodes=[];else if(change==='kind')f.board.owner.board.nodes[0].kind='text';else if(change==='lock')f.board.owner.board.nodes[0].locked=true;else if(change==='rename')f.rename(f.note,'Renamed.md');else if(change==='delete')f.files.delete(f.note.path);else if(change==='replace-file')f.file(f.note.path,'Replacement');else if(change==='graph-replaced')f.leaf.view=new LocalRelationsView(f.main);else if(change==='graph-moved')f.leaf.view.containerEl.ownerDocument=f.popup;else if(change==='window-closed')f.main.defaultView.closed=true;else if(change==='owner')f.board.view.session={...f.board.owner};else if(change==='companion-reenabled')f.host.setCompanion(true);else if(change==='companion-reset')f.host.setCompanion(false);else f.other.view.inlineTarget='card';
 gate.resolve();if(change==='inline-draft')await assert.rejects(task,/草稿已保留/);else await task;assert.equal(f.splits.length,0);assert.equal(f.plugin.localRelationsEditor,undefined);
});
for(const change of ['cancel','retarget','close','third-view','draft'] as const)test(`center edit does not attach a return session after ${change} during native loading`,async()=>{
 const f=centerEditFixture(),gate=deferred();let opening=false,current=true;f.hooks.open=()=>{opening=true;return gate.promise;};const task=f.host.editCenter('card',()=>current);await reached(()=>opening);
 if(change==='cancel')current=false;else if(change==='retarget')f.board.owner.board.nodes[0].file=f.file('Next.md').path;else if(change==='close')f.leaf.view.containerEl.isConnected=false;else if(change==='third-view')f.app.workspace.activeLeaf=f.other.leaf;else f.other.view.inlineTarget='card';gate.resolve();if(change==='draft')await assert.rejects(task,/草稿已保留/);else await task;assert.equal(f.plugin.localRelationsEditor,undefined);assert.equal(f.activated.length,0);
});
for(const kind of ['board','section','text','locked','missing'] as const)test(`center edit does not turn ${kind} into a Markdown editing session`,async()=>{
 const f=centerEditFixture(),node=f.board.owner.board.nodes[0];if(kind==='locked')node.locked=true;else if(kind==='missing')f.files.delete(f.note.path);else node.kind=kind;assert.equal(f.host.source('card')?.canEdit,false);if(kind==='text')await f.host.editCenter('card',()=>true);else await assert.rejects(f.host.editCenter('card',()=>true),kind==='locked'?/解锁/:/Markdown/);assert.equal(f.splits.length,0);assert.equal(f.plugin.localRelationsEditor,undefined);
});
test('uppercase Markdown can use explicit center edit and preserve the same native view',async()=>{
 const f=centerEditFixture();f.rename(f.note,'Notes/Source.MD');f.board.owner.board.nodes[0].file=f.note.path;const editor=f.makeLeaf(f.main);await editor.openFile(f.note,{});editor.type='markdown';editor.opened.length=0;assert.equal(f.host.source('card').canEdit,true);await f.host.editCenter('card',()=>true);assert.equal(f.splits.length,0);assert.equal(editor.opened.length,0);assert.equal(editor.view.getMode(),'source');assert.equal(f.plugin.localRelationsEditor.calls[0].file,f.note);
});
test('return session context retires after source identity or graph changes without rewriting the native note',async()=>{
 const f=centerEditFixture();await f.host.editCenter('card',()=>true);const binding=f.plugin.localRelationsEditor.calls[0],raw=f.contents.get(f.note);f.board.owner.board.nodes[0].file=f.file('Next.md').path;assert.equal(binding.context(),false);f.plugin.refreshLocalRelations();assert.ok(f.plugin.localRelationsEditor.prunes>0);assert.equal(f.contents.get(f.note),raw);assert.equal(f.splits[0].leaf.detached,false);
});
test('center edit cannot use native reveal side effects to reclaim focus from a third page selected during loading',async()=>{
 const f=centerEditFixture(),gate=deferred();let waiting=false;f.hooks.open=()=>{waiting=true;return gate.promise;};f.hooks.reveal=async leaf=>{f.app.workspace.activeLeaf=leaf;};const task=f.host.editCenter('card',()=>true);await reached(()=>waiting);f.app.workspace.activeLeaf=f.other.leaf;gate.resolve();await task;assert.equal(f.app.workspace.activeLeaf,f.other.leaf);assert.equal(f.revealed.length,0);assert.equal(f.activated.length,0);assert.equal(f.plugin.localRelationsEditor,undefined);
});
test('loaded native center editing activates synchronously without starting an uncancellable reveal',async()=>{
 const f=centerEditFixture();f.hooks.reveal=async()=>{throw Error('Editing must not enqueue asynchronous reveal');};await f.host.editCenter('card',()=>true);assert.equal(f.revealed.length,0);assert.equal(f.app.workspace.activeLeaf,f.splits[0].leaf);assert.equal(f.plugin.localRelationsEditor.calls.length,1);
});
test('entering native editing releases a former partner so future following uses a new leaf',async()=>{
 const f=centerEditFixture(),next=f.file('Next.md');f.board.owner.board.nodes.push(card('next',{file:next.path}));f.host.setCompanion(true);await f.host.syncSource('card',()=>true);const original=f.splits[0].leaf,originalView=original.view;f.app.workspace.activeLeaf=f.leaf;await f.host.editCenter('card',()=>true);assert.equal(f.plugin.localRelationsCompanions.get(f.leaf).leaf,undefined);assert.equal(f.plugin.localRelationsEditor.calls[0].leaf,original);originalView.raw='Keep this native draft';f.host.setCompanion(true);await f.host.syncSource('next',()=>true);assert.equal(f.splits.length,2);assert.equal(original.view,originalView);assert.equal(originalView.file,f.note);assert.equal(originalView.raw,'Keep this native draft');assert.equal(f.splits[1].leaf.view.file,next);
});
test('center edit expands only the public sidebar containing its existing native editor',async()=>{
 const f=centerEditFixture(),editor=f.makeLeaf(f.main);await editor.openFile(f.note,{});const side:any={collapsed:true,expands:0,expand(){this.collapsed=false;this.expands++;}};f.app.workspace.rightSplit=side;editor.parent={parent:side};await f.host.editCenter('card',()=>true);assert.equal(side.expands,1);assert.equal(f.app.workspace.activeLeaf,editor);assert.equal(f.revealed.length,0);
});
for(const change of ['third-view','retarget','replace-editor','draft'] as const)test(`center edit rechecks ${change} after native sidebar expansion`,async()=>{
 const f=centerEditFixture(),editor=f.makeLeaf(f.main);await editor.openFile(f.note,{});const side={collapsed:true,expand(){if(change==='third-view')f.app.workspace.activeLeaf=f.other.leaf;else if(change==='retarget')f.board.owner.board.nodes[0].file=f.file('Changed.md').path;else if(change==='replace-editor')editor.view=new MarkdownView(f.main);else f.other.view.inlineTarget='card';}};f.app.workspace.rightSplit=side;editor.parent={parent:side};const task=f.host.editCenter('card',()=>true);if(change==='draft')await assert.rejects(task,/草稿已保留/);else await task;assert.equal(f.activated.length,0);assert.equal(f.plugin.localRelationsEditor,undefined);
});
for(const returnToGraph of [false,true])test(`center edit cancels before a synchronously activating split when focus leaves during partner drain (return=${returnToGraph})`,async()=>{
 const f=centerEditFixture(),gate=deferred(),third=f.makeLeaf(f.main);f.host.setCompanion(true);f.plugin.localRelationsCompanions.get(f.leaf).queue=gate.promise;f.hooks.splitActivates=true;const task=f.host.editCenter('card',()=>true);await Promise.resolve();f.app.workspace.setActiveLeaf(third);if(returnToGraph)f.app.workspace.setActiveLeaf(f.leaf);gate.resolve();await task;assert.equal(f.splits.length,0);assert.equal(f.plugin.localRelationsEditor,undefined);assert.equal(f.app.workspace.activeLeaf,returnToGraph?f.leaf:third);assert.equal(f.workspaceEvents.size,0);
});
test('center edit removes its temporary focus listener even when the partner queue rejects',async()=>{
 const f=centerEditFixture();f.host.setCompanion(true);f.plugin.localRelationsCompanions.get(f.leaf).queue=Promise.reject(Error('Old companion failed'));await f.host.editCenter('card',()=>true);assert.equal(f.workspaceEvents.size,0);assert.equal(f.plugin.localRelationsEditor.calls.length,1);
});
test('a fresh popout companion uses its public container while EmptyView DOM still belongs to the main window',async()=>{
 const f=fixture(),bound=f.bind(f.other);f.app.workspace.activeLeaf=bound.leaf;f.hooks.split=leaf=>{leaf.getContainer=()=>({doc:f.popup,win:f.popup.defaultView});leaf.view.containerEl.ownerDocument=f.main;leaf.view.containerEl.isConnected=false;};bound.host.setCompanion(true);await bound.host.syncSource('card',()=>true);assert.equal(f.splits.length,1);const editor=f.splits[0].leaf;assert.equal(editor.view.containerEl.ownerDocument,f.popup);assert.equal(editor.view.file,f.note);assert.equal(bound.host.companion().available,true);assert.equal(f.app.workspace.activeLeaf,bound.leaf);
});
test('companion rejects a moved public container even when its stale view DOM still looks local',async()=>{
 const f=fixture(),bound=f.bind();f.app.workspace.activeLeaf=bound.leaf;f.hooks.split=leaf=>{leaf.getContainer=()=>({doc:f.popup,win:f.popup.defaultView});};bound.host.setCompanion(true);await assert.rejects(bound.host.syncSource('card',()=>true),/伙伴页已移动或固定/);assert.equal(f.splits[0].leaf.opened.length,0);assert.equal(bound.host.companion().enabled,false);
});
