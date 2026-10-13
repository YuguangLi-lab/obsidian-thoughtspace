import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board,type Card} from '../src/model';
import {paragraphOrigin} from '../src/paragraph-card';
import {isWorkspaceFile} from '../src/workspace';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';
import {boardReferenceOccurrences,validateReferenceOccurrence,ReferenceOccurrenceTrail,type ReferenceOccurrence} from '../src/reference-occurrences';
import {applyBrainReadingPosition} from '../src/brain-reading-positions';
import {createBoardMindmapState} from '../src/board-mindmap';

// Execute the shipped methods, rather than a second navigation implementation.
const source=readFileSync('src/main.ts','utf8');
function between(begin:string,end:string){const from=source.indexOf(begin),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,`actual method ${begin}`);return source.slice(from,to);}
const methods=between('  private async referenceCardTexts(','  async exportNativeIndex(')+between('  convenienceOrigin(){','  private async captureDestination(');
const locationMethods=between('  captureConvenienceLocation():','  private brainReadingModal?');
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
class Events {
 readonly refs=new Set<{name:string;fn:(...args:any[])=>void}>();
 on(name:string,fn:(...args:any[])=>void){const ref={name,fn};this.refs.add(ref);return ref;}
 offref(ref:{name:string;fn:(...args:any[])=>void}){this.refs.delete(ref);}
 emit(name:string,...args:any[]){for(const ref of [...this.refs])if(ref.name===name)ref.fn(...args);}
}
class File {
 basename:string;extension:string;stat={mtime:1,size:100};raw='# Native body\n\nUnchanged text.';
 constructor(public path:string,readonly boardFile=false){const name=path.split('/').pop()!;this.extension=name.split('.').pop()!;this.basename=name.slice(0,-this.extension.length-1);}
}
class FileView {
 containerEl:any;contentEl:any;leaf:any;
 constructor(public file:File,doc:any){this.containerEl={ownerDocument:doc,isConnected:true};this.contentEl={ownerDocument:doc,isConnected:true};}
}
const notices:string[]=[];
class Notice {constructor(text:string){notices.push(text);}}
const BoardMethods=new Function('isBrainBoard','applyBrainReadingPosition','Notice',transformSync('class Methods{'+locationMethods+'};return Methods;',{loader:'ts'}).code)((board:Board)=>board.presentation==='brain',applyBrainReadingPosition,Notice);
class BoardView extends FileView {
 closed=false;isClosing=false;closing=false;selected=new Set<string>();revealed:string[]=[];restores=0;clearCount=0;selectionUpdates=0;transforms=0;
 session:any;brainBoardView:any;prepareHook:()=>Promise<void>=async()=>{};
 declare captureConvenienceLocation:any;declare restoreConvenienceLocation:any;
 constructor(file:File,doc:any,board:Board){super(file,doc);const owner={file,board:structuredClone(board),blocked:false,flush:async()=>{},change:(edit:(board:Board)=>void)=>edit(owner.board)};this.session=owner;}
 requireOwner(){if(this.closed||this.isClosing||this.session.blocked)throw Error('owner blocked');return this.session;}
 prepareVideoBridge(){return this.prepareHook();}
 revealNode(id:string){this.revealed.push(id);this.selected=new Set([id]);this.session.board.viewport={x:777,y:888,zoom:this.session.board.viewport.zoom};}
 clearCanvasGesture(){this.clearCount++;}
 updateSelection(){this.selectionUpdates++;}
 transform(){this.transforms++;}
}
BoardView.prototype.captureConvenienceLocation=BoardMethods.prototype.captureConvenienceLocation;
BoardView.prototype.restoreConvenienceLocation=BoardMethods.prototype.restoreConvenienceLocation;
const bars:{container:any;trail:ReferenceOccurrenceTrail;host:any;loaded:boolean;unloaded:number}[]=[];
class Navigation {
 record:{container:any;trail:ReferenceOccurrenceTrail;host:any;loaded:boolean;unloaded:number};
 constructor(container:any,trail:ReferenceOccurrenceTrail,host:any){this.record={container,trail,host,loaded:false,unloaded:0};bars.push(this.record);}
 load(){this.record.loaded=true;}
 unload(){this.record.loaded=false;this.record.unloaded++;}
}
class NativeBridge {
 active=false;focused=false;unwatch?:()=>void;
 constructor(readonly app:any,readonly file:File,readonly host:any){}
 open(){this.active=true;this.unwatch=this.host.watchCurrent?.(()=>this.close());}
 focusOccurrences(){this.focused=true;}
 close(){if(!this.active)return;this.active=false;this.unwatch?.();this.unwatch=undefined;this.host.closed?.();}
}
const Plugin=new Function('TFile','FileView','BoardView','isWorkspaceFile','isBoardFile','boardReferenceOccurrences','validateReferenceOccurrence','ReferenceOccurrenceTrail','ReferenceOccurrenceNavigation','NativeBridgeModal','ConvenienceNavigationLease','Notice',transformSync('class Plugin{'+methods+'};return Plugin;',{loader:'ts'}).code)(File,FileView,BoardView,isWorkspaceFile,(_app:any,file:File)=>file.boardFile,boardReferenceOccurrences,validateReferenceOccurrence,ReferenceOccurrenceTrail,Navigation,NativeBridge,ConvenienceNavigationLease,Notice);
const card=(id:string,file='Sources/A.md',x=0):Card=>({id,kind:'card',file,x,y:0,width:100,height:80,color:'slate'});
const text=(id:string,value:string):Card=>({...card(id),kind:'text',file:undefined,text:value});
function fixture(originBoard=false){
 const plugin=new Plugin(),vault=new Events(),workspace=new Events(),windowEvents=new Events();
 const win={closed:false,addEventListener:(name:string,fn:()=>void)=>windowEvents.on(name,fn),removeEventListener:(name:string,fn:()=>void)=>{for(const ref of windowEvents.refs)if(ref.name===name&&ref.fn===fn)windowEvents.offref(ref);}},doc={defaultView:win};
 const note=new File('Sources/A.md'),excerpt=new File('Cards/excerpt.md');excerpt.raw='Material\n\n> 来源：[[Sources/A.md#First]] · 第 2–3 行';
 const originFile=new File(originBoard?'Boards/origin.md':'Sources/origin.md',originBoard),a=new File('Boards/A.md',true),b=new File('Boards/B.thoughtspace',true);
 const files:File[]=[originFile,note,excerpt,a,b],documents=new Map<File,Board>([[a,{...emptyBoard(),nodes:[card('a1'),card('a2','Sources/A.md',220),text('heading','![[Sources/A.md#First]] ![[Sources/A.md#Second]]'),card('excerpt','Cards/excerpt.md',440)]}],[b,{...emptyBoard(),nodes:[{id:'group',kind:'section',title:'证据',x:-30,y:-50,width:500,height:350,color:'sand'},card('b1'),{...text('snapshot','Copied content'),paragraphQuote:paragraphOrigin(note.path,'first second',{label:'second',from:6,to:12},'snapshot')}]}]]);
 const originalBoard={...emptyBoard(),viewport:{x:123,y:-456,zoom:.65},nodes:[card('original')]} as Board;
 const originView=originBoard?new BoardView(originFile,doc,originalBoard):new FileView(originFile,doc),views=new Map<File,BoardView>();if(originView instanceof BoardView)originView.selected.add('original');
 function leaf(view:FileView){const value={view,getViewState:()=>({type:view instanceof BoardView?'thoughtspace-view':'markdown',state:{file:view.file.path}})};view.leaf=value;return value;}
 const origin=leaf(originView),leaves:any[]=[origin];let active:any=origin,reads=0,opens=0,restored=0;
 let readHook:(file:File)=>Promise<void>=async()=>{},cachedHook:(file:File)=>Promise<void>=async()=>{},openHook:(file:File,ready:()=>boolean)=>Promise<void>=async()=>{},returnHook:()=>Promise<void>=async()=>{};
 function setActive(target:any){active=target;workspace.emit('active-leaf-change',target);workspace.emit('file-open',target?.view?.file);}
 Object.defineProperty(workspace,'activeLeaf',{get:()=>active});
 Object.assign(workspace,{containerEl:{ownerDocument:doc},getMostRecentLeaf:()=>active,getLeavesOfType:()=>leaves.filter(value=>value.view instanceof BoardView),setActiveLeaf:(target:any)=>setActive(target),revealLeaf:async(target:any)=>{await returnHook();restored++;return target;}});
 Object.assign(vault,{getFiles:()=>files,getAbstractFileByPath:(path:string)=>files.find(file=>file.path===path),cachedRead:async(file:File)=>{reads++;await cachedHook(file);return file.raw;}});
 Object.assign(plugin,{app:{vault,workspace,metadataCache:{getFirstLinkpathDest:(path:string)=>files.find(file=>file.path===path||file.basename===path||file.path==='Sources/'+path)}},boardOpeningNavigation:new Set(),readBoard:async(file:File)=>{await readHook(file);const value=documents.get(file);if(!value)throw Error('invalid board');return structuredClone(value);},openBoard:async(file:File,_fit:boolean,ready:()=>boolean,_provisional:boolean,navigation:any)=>{opens++;await openHook(file,ready);if(!ready())return;let view=views.get(file);if(!view){view=new BoardView(file,doc,documents.get(file)!);views.set(file,view);leaves.push(leaf(view));}navigation.target(view.leaf);setActive(view.leaf);},openNoteInSidebar:async()=>{},pickNativeDestination:()=>{}});
 const foreign=leaf(new FileView(new File('Foreign.md'),doc));
 return {plugin,vault,workspace,win,doc,windowEvents,note,excerpt,a,b,files,documents,views,origin,originView,leaves,reads:()=>reads,opens:()=>opens,restored:()=>restored,active:()=>active,setActive,foreign,setReadHook:(next:typeof readHook)=>{readHook=next;},setCachedHook:(next:typeof cachedHook)=>{cachedHook=next;},setOpenHook:(next:typeof openHook)=>{openHook=next;},setReturnHook:(next:typeof returnHook)=>{returnHook=next;}};
}
async function openList(f:ReturnType<typeof fixture>){const modal=f.plugin.openNativeRelations(f.note,true) as NativeBridge;const result=await modal.host.occurrences(f.note,()=>modal.active);return {modal,items:result.items as ReferenceOccurrence[],errors:result.errors as number};}
async function firstLocate(f:ReturnType<typeof fixture>,index=0){const listed=await openList(f);await listed.modal.host.locateOccurrence(listed.items[index],listed.items,()=>listed.modal.active);listed.modal.close();return {...listed,bar:bars.at(-1)!};}

test('root indexes each direct/dynamic/snapshot card and group without ordinary outgoing links',async()=>{
 const f=fixture(),before=f.note.raw,result=await f.plugin.referenceOccurrences(f.note,()=>true);
 assert.equal(result.errors,0);assert.deepEqual(result.items.map((item:ReferenceOccurrence)=>item.nodeId),['a1','a2','heading','excerpt','b1','snapshot']);assert.equal(result.items[2].usages.length,2);assert.deepEqual(result.items[4].groupPaths,[['证据']]);assert.equal(f.note.raw,before);assert.equal(f.reads(),2);
});
test('card-text cache reads a shared native note once without retaining its outgoing links as usages',async()=>{
 const f=fixture();f.note.raw='Ordinary [[Other]] and ![[Other#Header]]';await f.plugin.referenceOccurrences(f.note,()=>true);assert.equal(f.reads(),2);assert.equal(f.note.raw,'Ordinary [[Other]] and ![[Other#Header]]');
});
test('root refuses oversize board/card text explicitly and leaves its bytes untouched',async()=>{
 const f=fixture();f.a.stat.size=9*1024*1024;f.note.stat.size=9*1024*1024;const raw=f.note.raw,result=await f.plugin.referenceOccurrences(f.note,()=>true);assert.equal(result.errors,2);assert.deepEqual(result.items,[]);assert.equal(f.note.raw,raw);
});
test('cancel during board scan propagates without publishing a partial success',async()=>{
 const f=fixture(),read=deferred<void>();let current=true;f.setReadHook(async file=>{if(file===f.a)await read.promise;});const result=f.plugin.referenceOccurrences(f.note,()=>current);current=false;read.resolve();await assert.rejects(result,/取消|变化/);
});
test('a renamed or replaced note read is not reused as valid source-card text',async()=>{
 for(const kind of ['rename','replace'] as const){const f=fixture();f.setCachedHook(async file=>{if(file!==f.note)return;if(kind==='rename')file.path='Moved/A.md';else f.files.splice(f.files.indexOf(file),1,new File(file.path));});await assert.rejects(f.plugin.referenceCardTexts(f.documents.get(f.a),()=>true),/原文已变化/);}
});
test('first modal closes after navigation but permanent trail remains active for next/previous',async()=>{
 const f=fixture(),selected=await firstLocate(f);assert.equal(selected.modal.active,false);assert.equal(selected.bar.trail.active,true);assert.equal(selected.bar.trail.index,0);assert.deepEqual(f.views.get(f.a)!.revealed,['a1']);await selected.bar.trail.go(1);assert.equal(selected.bar.trail.index,1);assert.deepEqual(f.views.get(f.a)!.revealed,['a1','a2']);await selected.bar.trail.go(0);assert.deepEqual(f.views.get(f.a)!.revealed,['a1','a2','a1']);assert.equal(f.note.raw,'# Native body\n\nUnchanged text.');
});
test('cross-board remount unloads old UI while retaining the same live trail and origin',async()=>{
 const f=fixture(),selected=await firstLocate(f),old=selected.bar;await old.trail.go(4);const mounted=bars.at(-1)!;assert.equal(old.loaded,false);assert.ok(old.unloaded>0);assert.equal(mounted.trail,old.trail);assert.equal(mounted.container,f.views.get(f.b)!.contentEl);assert.equal(mounted.trail.active,true);assert.deepEqual(f.views.get(f.b)!.revealed,['b1']);await mounted.trail.returnToOrigin();assert.equal(f.active(),f.origin);assert.equal(mounted.trail.active,false);
});
test('return restores the captured ordinary board viewport/selection and retains Markdown bytes',async()=>{
 const f=fixture(true),before=structuredClone((f.originView as BoardView).session.board.viewport),selected=await firstLocate(f);(f.originView as BoardView).session.board.viewport={x:-1,y:-2,zoom:2};(f.originView as BoardView).selected.clear();await selected.bar.trail.returnToOrigin();assert.equal(f.active(),f.origin);assert.deepEqual((f.originView as BoardView).session.board.viewport,before);assert.deepEqual([...(f.originView as BoardView).selected],['original']);assert.equal(f.note.raw,'# Native body\n\nUnchanged text.');assert.equal(f.plugin.boardOpeningNavigation.size,0);
});
test('closing an untransferred list releases origin listeners and cannot begin a late locate',async()=>{
 const f=fixture(),listed=await openList(f);assert.equal(f.workspace.refs.size,2);listed.modal.close();assert.equal(f.workspace.refs.size,0);assert.equal(f.plugin.boardOpeningNavigation.size,0);await assert.rejects(listed.modal.host.locateOccurrence(listed.items[0],listed.items,()=>listed.modal.active),/已变化/);assert.equal(f.opens(),0);
});
test('closing first modal while exact board read is pending prevents navigation and removes trail listeners',async()=>{
 const f=fixture(),listed=await openList(f),read=deferred<void>();f.setReadHook(async()=>read.promise);const pending=listed.modal.host.locateOccurrence(listed.items[0],listed.items,()=>listed.modal.active);listed.modal.close();read.resolve();await assert.rejects(pending,/变化|取消/);assert.equal(f.opens(),0);assert.equal(f.vault.refs.size,0);assert.equal(f.workspace.refs.size,0);assert.equal(f.plugin.occurrenceScope,undefined);
});
test('unrelated navigation away and back invalidates a permanent trail monotonically',async()=>{
 const f=fixture(),selected=await firstLocate(f),destination=f.active();f.setActive(f.foreign);f.setActive(destination);assert.equal(selected.bar.trail.active,false);assert.equal(selected.bar.loaded,false);assert.equal(f.vault.refs.size,0);assert.equal(f.workspace.refs.size,0);await assert.rejects(selected.bar.trail.go(1),/变化|取消/);assert.deepEqual(f.views.get(f.a)!.revealed,['a1']);
});
test('window unload stops all origin/trail watchers without closing other windows',async()=>{
 const f=fixture(),selected=await firstLocate(f);f.win.closed=true;f.windowEvents.emit('unload');assert.equal(selected.bar.trail.active,false);assert.equal(f.vault.refs.size,0);assert.equal(f.workspace.refs.size,0);assert.equal(f.plugin.boardOpeningNavigation.size,0);
});
test('source/board rename and delete cancel a trail and never rewrite the original source',async()=>{
 for(const [event,which] of [['rename','source'],['rename','board'],['delete','source'],['delete','board']] as const){const f=fixture(),selected=await firstLocate(f),file=which==='source'?f.note:f.b,raw=f.note.raw;if(event==='rename')file.path='Moved/'+file.path;f.vault.emit(event,file);assert.equal(selected.bar.trail.active,false);assert.equal(f.vault.refs.size,0);assert.equal(f.workspace.refs.size,0);assert.equal(f.note.raw,raw);}
});
test('node source changes before first open are rejected by the captured stamp without navigation',async()=>{
 const f=fixture(),listed=await openList(f);f.documents.get(f.a)!.nodes[0].file='Sources/Other.md';await assert.rejects(listed.modal.host.locateOccurrence(listed.items[0],listed.items,()=>listed.modal.active),/引用已变化/);assert.equal(f.opens(),0);assert.equal(listed.modal.active,true);listed.modal.close();
});
test('source stamp is rechecked after open against the current Session instead of trusting the disk snapshot',async()=>{
 const f=fixture(),listed=await openList(f);f.setOpenHook(async file=>{if(file===f.a)f.documents.get(file)!.nodes[0].file='Sources/Other.md';});await assert.rejects(listed.modal.host.locateOccurrence(listed.items[0],listed.items,()=>listed.modal.active),/白板已变化/);assert.deepEqual(f.views.get(f.a)!.revealed,[]);listed.modal.close();
});
test('node deletion during awaited flush prevents reveal and leaves the retry/list available',async()=>{
 const f=fixture(),selected=await firstLocate(f),view=f.views.get(f.a)!;view.session.flush=async()=>{view.session.board.nodes=view.session.board.nodes.filter((node:Card)=>node.id!=='a2');};await assert.rejects(selected.bar.trail.go(1),/引用已变化/);assert.equal(selected.bar.trail.index,0);assert.deepEqual(view.revealed,['a1']);assert.equal(selected.bar.trail.active,true);f.plugin.occurrenceStop();
});
test('native-editor/owner save failure refuses reveal and preserves the navigation index',async()=>{
 const f=fixture(),selected=await firstLocate(f),view=f.views.get(f.a)!;view.prepareHook=async()=>{throw Error('inline draft cannot save');};await assert.rejects(selected.bar.trail.go(1),/inline draft cannot save/);assert.equal(selected.bar.trail.index,0);assert.deepEqual(view.revealed,['a1']);f.plugin.occurrenceStop();
});
test('target owner replacement during awaited preparation invalidates exact destination ownership',async()=>{
 const f=fixture(),selected=await firstLocate(f),view=f.views.get(f.a)!,owner=view.session;view.prepareHook=async()=>{view.session={...owner};};await assert.rejects(selected.bar.trail.go(1),/变化|取消/);assert.deepEqual(view.revealed,['a1']);assert.equal(selected.bar.trail.active,false);
});
test('target TFile replacement before next navigation is refused even at the same path',async()=>{
 const f=fixture(),selected=await firstLocate(f);f.files.splice(f.files.indexOf(f.b),1,new File(f.b.path,true));await assert.rejects(selected.bar.trail.go(4),/替换|移除/);assert.equal(selected.bar.trail.index,0);assert.equal(f.views.has(f.b),false);f.plugin.occurrenceStop();
});
test('cancel during requested target open does not reveal any node or revive a stopped trail',async()=>{
 const f=fixture(),selected=await firstLocate(f),open=deferred<void>();f.setOpenHook(async()=>open.promise);const pending=selected.bar.trail.go(4);await Promise.resolve();await Promise.resolve();selected.bar.trail.cancel();open.resolve();await assert.rejects(pending,/变化|取消|就绪/);assert.equal(selected.bar.trail.index,0);assert.equal(f.views.get(f.b)?.revealed.length??0,0);assert.equal(f.vault.refs.size,0);
});
test('list reopening retains the first origin and replaces the prior trail only when a new row is chosen',async()=>{
 const f=fixture(),selected=await firstLocate(f),first=selected.bar;first.host.showList();const modal=f.plugin.nativeBridge as NativeBridge;assert.equal(modal.focused,true);assert.equal(first.trail.active,true);const read=await modal.host.occurrences(f.note,()=>modal.active);await modal.host.locateOccurrence(read.items[4],read.items,()=>modal.active);modal.close();const next=bars.at(-1)!;assert.equal(first.trail.active,false);assert.notEqual(next.trail,first.trail);assert.equal(next.trail.active,true);await next.trail.returnToOrigin();assert.equal(f.active(),f.origin);
});
test('failed return retains the origin context and allows retry after native draft is resolved',async()=>{
 const f=fixture(),selected=await firstLocate(f),view=f.views.get(f.a)!;view.prepareHook=async()=>{throw Error('save native draft first');};await assert.rejects(selected.bar.trail.returnToOrigin(),/save native draft first/);assert.equal(selected.bar.trail.active,true);assert.equal(f.active(),view.leaf);view.prepareHook=async()=>{};await selected.bar.trail.returnToOrigin();assert.equal(f.active(),f.origin);
});
test('original source editor replacement or closed origin refuses return without opening an invented file',async()=>{
 const f=fixture(),selected=await firstLocate(f);f.origin.view=new FileView(f.originView.file,f.doc);await assert.rejects(selected.bar.trail.returnToOrigin(),/出发页面已关闭或变化/);assert.equal(f.active(),f.views.get(f.a)!.leaf);assert.equal(f.restored(),0);f.plugin.occurrenceStop();
});
test('closing a reopened location list preserves the old trail and original return button',async()=>{
 const f=fixture(),selected=await firstLocate(f);selected.bar.host.showList();const modal=f.plugin.nativeBridge as NativeBridge;assert.equal(modal.focused,true);modal.close();assert.equal(selected.bar.trail.active,true);assert.equal(selected.bar.loaded,true);await selected.bar.trail.returnToOrigin();assert.equal(f.active(),f.origin);assert.equal(f.vault.refs.size,0);assert.equal(f.workspace.refs.size,0);
});
test('a new unrelated association action stops the old trail before capturing a fresh origin',async()=>{
 const f=fixture(),selected=await firstLocate(f);const modal=f.plugin.openNativeRelations(f.note,true) as NativeBridge;assert.equal(selected.bar.trail.active,false);assert.equal(selected.bar.loaded,false);assert.equal(f.vault.refs.size,0);assert.equal(modal.active,true);modal.close();assert.equal(f.workspace.refs.size,0);
});
test('target identity is rechecked after awaited board/citation reads before requesting any open',async()=>{
 const f=fixture(),selected=await firstLocate(f);f.setReadHook(async file=>{if(file===f.b)f.files.splice(f.files.indexOf(file),1,new File(file.path,true));});const opens=f.opens();await assert.rejects(selected.bar.trail.go(4),/变化|替换|移除/);assert.equal(f.opens(),opens);assert.equal(selected.bar.trail.index,0);f.plugin.occurrenceStop();
});
test('final citation await cannot reveal into a view after scope cancellation in the next microtask',async()=>{
 const f=fixture(),selected=await firstLocate(f),view=f.views.get(f.a)!,actual=f.plugin.referenceCardTexts.bind(f.plugin);let reads=0;
 f.plugin.referenceCardTexts=async(...args:any[])=>{const result=await actual(...args);if(++reads===2)queueMicrotask(()=>f.setActive(f.foreign));return result;};
 await assert.rejects(selected.bar.trail.go(1),/变化|取消/);assert.equal(f.active(),f.foreign);assert.deepEqual(view.revealed,['a1']);assert.equal(selected.bar.trail.index,0);assert.equal(selected.bar.trail.active,false);
});
test('navigation after reveal but before persistence completion never mounts a toolbar in the retired view',async()=>{
 const f=fixture(),selected=await firstLocate(f),view=f.views.get(f.a)!,count=bars.length;let flush=0;view.session.flush=async()=>{if(++flush===2)f.setActive(f.foreign);};await assert.rejects(selected.bar.trail.go(1),/定位尚未保存|变化|取消/);assert.equal(bars.length,count);assert.equal(f.active(),f.foreign);assert.equal(selected.bar.loaded,false);assert.equal(f.vault.refs.size,0);
});
test('unrelated navigation during origin reveal prevents a late focus switch back',async()=>{
 const f=fixture(),selected=await firstLocate(f);f.setReturnHook(async()=>{f.setActive(f.foreign);});await assert.rejects(selected.bar.trail.returnToOrigin(),/返回已取消|变化|取消/);assert.equal(f.active(),f.foreign);assert.equal(selected.bar.trail.active,false);
});
test('brain origin returns exact center, expansion, depth and camera with no source-note rewrite',async()=>{
 const f=fixture(true),view=f.originView as BoardView,position={version:1 as const,centerId:'original',expandedIds:['original'],depth:3,viewport:{x:-85,y:42,zoom:.45}};
 view.session.board={...view.session.board,version:3,presentation:'brain',brain:{...createBoardMindmapState('original'),expandedIds:['original'],descendantDepth:3},brainViewport:{...position.viewport}};
 let prepared=0;view.brainBoardView={captureReadingPosition:()=>structuredClone(position),prepareReadingPositionRestore:()=>prepared++};const selected=await firstLocate(f);
 view.session.board.brain=createBoardMindmapState('original');view.session.board.brainViewport={x:100,y:200,zoom:2};await selected.bar.trail.returnToOrigin();assert.equal(f.active(),f.origin);assert.equal(view.session.board.brain.centerId,'original');assert.deepEqual(view.session.board.brain.expandedIds,['original']);assert.equal(view.session.board.brain.descendantDepth,3);assert.deepEqual(view.session.board.brainViewport,position.viewport);assert.equal(prepared,1);assert.equal(f.note.raw,'# Native body\n\nUnchanged text.');
});
test('cross-board native-body budget refuses the next individually valid body before caching it and reports incomplete index',async()=>{
 const f=fixture(),other=new File('Sources/B.md');f.files.push(other);f.note.raw='a'.repeat(5*1024*1024);other.raw='b'.repeat(4*1024*1024);
 f.documents.set(f.a,{...emptyBoard(),nodes:[card('a1')]});f.documents.set(f.b,{...emptyBoard(),nodes:[card('other',other.path),text('source-embed','![[Sources/A.md#First]]')]});
 const cache=new Map<string,string>();await f.plugin.referenceCardTexts(f.documents.get(f.a),()=>true,cache);assert.equal(cache.size,1);
 await assert.rejects(f.plugin.referenceCardTexts(f.documents.get(f.b),()=>true,cache),/本次引用检查原文合计超过/);assert.equal(cache.size,1);assert.equal(cache.has(other.path),false);assert.equal(cache.get(f.note.path),f.note.raw);
 const result=await f.plugin.referenceOccurrences(f.note,()=>true);assert.equal(result.errors,1);assert.deepEqual(result.items.map((item:ReferenceOccurrence)=>item.nodeId),['a1']);assert.equal(f.note.raw.length,5*1024*1024);assert.equal(other.raw.length,4*1024*1024);
});
test('global instance cap retains exactly twenty thousand valid cards and reports the next board without publishing it',async()=>{
 const f=fixture(),third=new File('Boards/C.md',true);f.files.push(third);
 f.documents.set(f.a,{...emptyBoard(),nodes:Array.from({length:10000},(_,index)=>card('a-'+index))});f.documents.set(f.b,{...emptyBoard(),nodes:Array.from({length:10000},(_,index)=>card('b-'+index))});f.documents.set(third,{...emptyBoard(),nodes:[card('over-cap')]});
 const identities=new Map(),result=await f.plugin.referenceOccurrences(f.note,()=>true,identities);assert.equal(result.items.length,20000);assert.equal(result.errors,1);assert.equal(new Set(result.items.map((item:ReferenceOccurrence)=>item.key)).size,20000);assert.equal(result.items.some((item:ReferenceOccurrence)=>item.nodeId==='over-cap'),false);assert.equal(identities.has(f.a.path),true);assert.equal(identities.has(f.b.path),true);assert.equal(identities.has(third.path),false);assert.equal(f.reads(),1);
});
test('whole-query stamp budget reports an over-budget board atomically even when every source board is under eight MiB',async()=>{
 const f=fixture(),others=Array.from({length:3},(_,index)=>new File(`Boards/Long${index}.md`,true));f.files.push(...others);const files=[f.a,f.b,...others],prefix='![[Sources/A.md#First]]\n',content=prefix+'x'.repeat(7*1024*1024-prefix.length);
 for(const [index,file] of files.entries()){const document={...emptyBoard(),version:3 as const,nodes:[text('long-'+index,content)]};f.documents.set(file,document);file.stat.size=Buffer.byteLength(JSON.stringify(document));assert.ok(file.stat.size<8*1024*1024);}
 const identities=new Map(),result=await f.plugin.referenceOccurrences(f.note,()=>true,identities);assert.equal(result.errors,1);assert.deepEqual(result.items.map((item:ReferenceOccurrence)=>item.nodeId),['long-0','long-1','long-2','long-3']);assert.equal(identities.size,4);assert.equal(identities.has(files[4].path),false);assert.ok(result.items.reduce((sum:number,item:ReferenceOccurrence)=>sum+JSON.stringify(item).length,0)<=32*1024*1024);assert.equal(f.reads(),0);
 const alone=boardReferenceOccurrences(f.documents.get(files[4])!,files[4].path,files[4].basename,f.note.path,path=>path);assert.equal(alone.length,1);assert.equal(alone[0].nodeId,'long-4');assert.ok(JSON.stringify(alone[0]).length<8*1024*1024);assert.equal(f.note.raw,'# Native body\n\nUnchanged text.');
});
test('exact occurrence trail captures and returns a sidebar origin even when mostRecentLeaf excludes it',async()=>{
 const f=fixture();Reflect.set(f.workspace,'getMostRecentLeaf',()=>f.foreign);const selected=await firstLocate(f);assert.equal(f.views.get(f.a)?.revealed[0],'a1');await selected.bar.trail.returnToOrigin();assert.equal(f.active(),f.origin);assert.equal(selected.bar.trail.active,false);
});
test('sidebar focus revokes a pending occurrence scan despite unchanged mostRecentLeaf main origin',async()=>{
 const f=fixture(),gate=deferred<void>();Reflect.set(f.workspace,'getMostRecentLeaf',()=>f.origin);f.setReadHook(async()=>gate.promise);const modal=f.plugin.openNativeRelations(f.note,true) as NativeBridge,work=modal.host.occurrences(f.note,()=>modal.active);f.setActive(f.foreign);f.setActive(f.origin);gate.resolve();await assert.rejects(work,/取消|变化/);assert.equal(f.opens(),0);assert.equal(modal.active,false);
});
