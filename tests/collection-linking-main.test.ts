import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  addCollectionReturn('),end=source.indexOf('  private async deliverCollection(',start);
assert.ok(start>0&&end>start);
class File {constructor(public path:string){} }
class FileView {
 containerEl:any;actions:{dataset:Record<string,string>;removed:boolean;click:()=>unknown;remove:()=>void}[]=[];disposers:(()=>void)[]=[];
 constructor(public file:File,doc:any){this.containerEl={isConnected:true,ownerDocument:doc};}
 addAction(_icon:string,_label:string,click:()=>unknown){const action={dataset:{},removed:false,click,remove(){this.removed=true;}};this.actions.push(action);return action;}
 register(cleanup:()=>void){this.disposers.push(cleanup);}
 close(){this.containerEl.isConnected=false;for(const dispose of this.disposers)dispose();}
}
class BoardView extends FileView {session={};closed=false;isClosing=false;prepare:()=>Promise<void>=async()=>{};prepareVideoBridge(){return this.prepare();}}
class CollectionView {containerEl:any;session='collection-one';revealed:any[]=[];hook:()=>Promise<void>=async()=>{};constructor(doc:any){this.containerEl={isConnected:true,ownerDocument:doc};}getState(){return{collectionSession:this.session};}async revealRecord(identity:any,current:()=>boolean){await this.hook();if(current())this.revealed.push(identity);}}
const Plugin=new Function('FileView','BoardView','CollectionView','ConvenienceNavigationLease','COLLECTION_VIEW_TYPE','VIEW','act',transformSync('class Plugin{'+source.slice(start,end)+'registerRelatedCleanup(){'+source.match(/this\.register\(\(\)=>\{for\(const stop of this\.collectionRelatedReturns[\s\S]*?\}\);/)![0]+'}};return Plugin;',{loader:'ts'}).code)(FileView,BoardView,CollectionView,ConvenienceNavigationLease,'collection','board',(fn:()=>unknown)=>fn());
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{resolve,promise};};
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function fixture(existing=true){
 const doc={defaultView:{closed:false,addEventListener(){},removeEventListener(){}}},otherDoc={defaultView:{closed:false,addEventListener(){},removeEventListener(){}}},note=new File('Notes/Record.md'),board=new File('Boards/A.md'),files=new Map([[note.path,note],[board.path,board]]),identity={id:'capture-native-note',createdAt:'2026-10-13T00:00:00.000Z'};
 const origin={view:new BoardView(board,doc)},own={view:new CollectionView(doc)},foreign={view:new CollectionView(otherDoc)},unrelated={view:new FileView(board,doc)};let active:any=origin;const leaves:any[]=existing?[foreign,own]:[foreign],refs=new Set<any>(),focus:any[]=[],reveals:any[]=[],allocated:any[]=[];
 const control:{resolve?:()=>Promise<void>;reveal?:()=>Promise<void>;create?:()=>Promise<void>;recover?:()=>Promise<void>;resolved?:File;reject?:Error}={};
 const emit=(name:string,...args:any[])=>{for(const ref of [...refs])if(ref.name===name)ref.fn(...args);};const activate=(leaf:any)=>{active=leaf;emit('active-leaf-change',leaf);};
 const workspace={containerEl:{ownerDocument:doc},get activeLeaf(){return active;},getMostRecentLeaf:()=>active,getLeavesOfType:()=>leaves,on:(name:string,fn:any)=>{const ref={name,fn};refs.add(ref);return ref;},offref:(ref:any)=>refs.delete(ref),revealLeaf:async(leaf:any)=>{await control.reveal?.();reveals.push(leaf);activate(leaf);},setActiveLeaf:(leaf:any)=>{focus.push(leaf);activate(leaf);},getLeaf:()=>{const leaf:any={view:{containerEl:{isConnected:true,ownerDocument:active.view.containerEl.ownerDocument}},setViewState:async()=>{await control.create?.();leaf.view=new CollectionView(doc);leaves.push(leaf);},detach:()=>{leaf.detached=true;}};allocated.push(leaf);return leaf;}};
 const plugin=new Plugin();Object.assign(plugin,{collectionReturnEpoch:new WeakMap(),collectionNavigationEpoch:0,boardOpeningNavigation:new Set(),collectionLibrary:{identityForFile:()=>identity,resolve:async()=>{await control.resolve?.();if(control.reject)throw control.reject;return control.resolved||note;}},collectionWorkspace:{recoverableSession:async()=>{await control.recover?.();return undefined;}},app:{workspace,vault:{getAbstractFileByPath:(path:string)=>files.get(path)}}});
 return{plugin,doc,otherDoc,note,board,files,identity,origin,own,foreign,unrelated,workspace,control,refs,focus,reveals,allocated,leaves,activate,activateSilently:(leaf:any)=>{active=leaf;},emit,active:()=>active};
}
test('return resolves the exact native identity and reveals only the existing Collection in its origin window',async()=>{const f=fixture();await f.plugin.openCollectionRecord(f.note);assert.deepEqual(f.own.view.revealed,[f.identity]);assert.deepEqual(f.foreign.view.revealed,[]);assert.equal(f.active(),f.own);assert.equal(f.allocated.length,0);assert.equal(f.refs.size,0);assert.equal(f.plugin.boardOpeningNavigation.size,0);});
test('a missing local collection creates an isolated tab without stealing another window',async()=>{const f=fixture(false);await f.plugin.openCollectionRecord(f.note);assert.equal(f.allocated.length,1);assert.equal(f.active(),f.allocated[0]);assert.deepEqual(f.allocated[0].view.revealed,[f.identity]);assert.deepEqual(f.foreign.view.revealed,[]);});
for(const reason of ['away-return','source-replaced','source-file-switched','target-note-replaced','closed-window'] as const)test(`pending source verification rejects ${reason} before a reveal`,async()=>{const f=fixture(),gate=deferred();f.control.resolve=()=>gate.promise;const work=f.plugin.openCollectionRecord(f.note);if(reason==='away-return'){f.activate(f.unrelated);f.activate(f.origin);}if(reason==='source-replaced')f.origin.view=new BoardView(f.board,f.doc);if(reason==='source-file-switched'){f.origin.view.file=new File('Other.md');f.emit('file-open');}if(reason==='target-note-replaced')f.files.set(f.note.path,new File(f.note.path));if(reason==='closed-window')f.doc.defaultView.closed=true;gate.resolve();await assert.rejects(work,/变化|取消/);assert.equal(f.reveals.length,0);assert.equal(f.focus.length,0);assert.equal(f.refs.size,0);});
test('duplicate identity failure does not create, focus or rewrite a destination',async()=>{const f=fixture(false);f.control.reject=Error('发现重复的收集标识');await assert.rejects(f.plugin.openCollectionRecord(f.note),/重复/);assert.equal(f.allocated.length,0);assert.equal(f.reveals.length,0);assert.equal(f.files.get(f.note.path),f.note);});
test('a later same-window return invalidates the first pending request',async()=>{const f=fixture(),gate=deferred();let calls=0;f.control.resolve=async()=>{if(++calls===1)await gate.promise;};const first=f.plugin.openCollectionRecord(f.note);await f.plugin.openCollectionRecord(f.note);gate.resolve();await assert.rejects(first,/取消/);assert.equal(f.own.view.revealed.length,1);assert.equal(f.focus.length,1);});
test('navigation during source draft preparation cancels before collection opens',async()=>{const f=fixture(),gate=deferred();f.origin.view.prepare=()=>gate.promise;const work=f.plugin.openCollectionRecord(f.note);await settle();f.activate(f.unrelated);gate.resolve();await assert.rejects(work,/取消/);assert.equal(f.reveals.length,0);});
test('target session switch during locate cannot focus a late original record',async()=>{const f=fixture(),gate=deferred();f.own.view.hook=()=>gate.promise;const work=f.plugin.openCollectionRecord(f.note);await settle();f.own.view.session='another-session';gate.resolve();await assert.rejects(work,/取消/);assert.equal(f.own.view.revealed.length,0);});
test('navigation after destination reveal cancels the delayed record lookup',async()=>{const f=fixture(),gate=deferred();f.own.view.hook=()=>gate.promise;const work=f.plugin.openCollectionRecord(f.note);await settle();f.activate(f.unrelated);f.activate(f.own);gate.resolve();await assert.rejects(work,/取消/);assert.equal(f.own.view.revealed.length,0);});
test('file-menu entry preserves existing hide callback and rejects a stale epoch or changed node',()=>{const f=fixture();let click!:()=>unknown,hide=0,current=true;const menu={onHide:()=>{hide++;},addItem:(build:any)=>{const item={setTitle:()=>item,setIcon:()=>item,onClick:(callback:any)=>{click=callback;return item;}};build(item);}};f.plugin.addCollectionReturn(menu,f.note,()=>current);assert.equal(hide,0);f.plugin.collectionNavigationEpoch++;assert.throws(click,/变化/);f.plugin.collectionNavigationEpoch--;current=false;assert.throws(click,/变化/);});
test('returning from a sidebar captures that actual source instead of the most recent main editor',async()=>{
 const f=fixture(),sidebar={view:new FileView(f.note,f.doc)};f.activate(sidebar);f.workspace.getMostRecentLeaf=()=>f.origin;await f.plugin.openCollectionRecord(f.note);assert.equal(f.active(),f.own);assert.deepEqual(f.own.view.revealed,[f.identity]);
});
test('a sidebar Collection destination remains a valid return after reveal while mostRecentLeaf still points at main',async()=>{
 const f=fixture();f.workspace.getMostRecentLeaf=()=>f.origin;await f.plugin.openCollectionRecord(f.note);assert.equal(f.active(),f.own);assert.equal(f.workspace.getMostRecentLeaf(),f.origin);assert.deepEqual(f.own.view.revealed,[f.identity]);
});
test('focus moving from main to a sidebar cancels a delayed return even when mostRecentLeaf never changes',async()=>{
 const f=fixture(),gate=deferred(),sidebar={view:new FileView(f.note,f.doc)};f.workspace.getMostRecentLeaf=()=>f.origin;f.control.resolve=()=>gate.promise;const work=f.plugin.openCollectionRecord(f.note);f.activate(sidebar);f.activate(f.origin);gate.resolve();await assert.rejects(work,/取消/);assert.equal(f.focus.length,0);assert.equal(f.reveals.length,0);
});

function relatedFixture(extension='md',existing=false){
 const f=fixture(),targetFile=new File(`Assets/Related.${extension}`);f.files.set(targetFile.path,targetFile);const origin=f.own;f.activate(origin);
 let valid=true;const target:any={view:new FileView(targetFile,f.doc),isDeferred:false,getViewState:()=>({type:extension==='md'?'markdown':'attachment',state:{file:targetFile.path}}),loadIfDeferred:async()=>{await control.load?.();},detach:()=>{target.view.containerEl.isConnected=false;},openFile:async(file:File)=>{await control.open?.();if(!control.skipOpenView)target.view=new FileView(file,f.doc);}};
 const control=f.control as typeof f.control&{open?:()=>Promise<void>;load?:()=>Promise<void>;skipOpenView?:boolean};
 Object.assign(f.workspace,{getLeavesOfType:(type:string)=>type==='board'?[]:type==='markdown'&&existing?[target]:[],getLeaf:()=>{f.allocated.push(target);return target;}});
 const returned:File[]=[],disposers:(()=>void)[]=[];Object.assign(f.plugin,{noteQueue:Promise.resolve(),openCollectionRecord:async(file:File)=>{returned.push(file);},register:(fn:()=>void)=>{disposers.push(fn);}});f.plugin.registerRelatedCleanup();
 const current=()=>valid,open=()=>f.plugin.openCollectionNote(targetFile,current,f.doc,{...f.identity,path:f.note.path});
 const observe={name:'active-leaf-change',fn:()=>{f.plugin.collectionNavigationEpoch++;if(f.active()!==origin)valid=false;}};f.refs.add(observe);
 return{...f,targetFile,target,control,returned,origin,open,current,cancel:()=>{valid=false;},disposers,baseRefs:1};
}
function nativeTabFocus(f:ReturnType<typeof relatedFixture>){
 // Obsidian changes activeLeaf synchronously and coalesces its workspace
 // events with a zero-delay timer. The initial placeholder may gain focus
 // even when the subsequent openFile requests active:false.
 let pending:ReturnType<typeof setTimeout>|undefined;const events:any[]=[],focusOptions:any[]=[];
 const activate=(leaf:any)=>{f.activateSilently(leaf);clearTimeout(pending);pending=setTimeout(()=>{events.push(f.active());f.emit('active-leaf-change',f.active());},0);};
 f.workspace.getLeaf=()=>{f.allocated.push(f.target);activate(f.target);return f.target;};
 f.workspace.setActiveLeaf=(leaf:any,options?:any)=>{f.focus.push(leaf);focusOptions.push(options);activate(leaf);};
 return{events,focusOptions,flush:()=>new Promise<void>(resolve=>setTimeout(resolve,0))};
}
test('native focusNewTab allocation preserves the source scope before opening and attaches its return action',async()=>{
 const f=relatedFixture(),native=nativeTabFocus(f),gate=deferred();f.control.open=()=>gate.promise;
 const work=f.open();await settle();assert.equal(f.active(),f.origin);await native.flush();
 assert.deepEqual(native.events,[f.origin]);assert.deepEqual(f.focus,[f.origin]);assert.deepEqual(native.focusOptions,[{focus:false}]);assert.equal(f.current(),true);
 gate.resolve();await work;await native.flush();assert.equal(f.active(),f.target);assert.equal(f.plugin.collectionRelatedReturns.size,1);assert.equal(f.target.view.actions[0].removed,false);
 await f.target.view.actions[0].click();assert.deepEqual(f.returned,[f.note]);
});
test('native focusNewTab restoration cannot revive a real away-and-return while opening is pending',async()=>{
 const f=relatedFixture('pdf'),native=nativeTabFocus(f),gate=deferred();f.control.open=()=>gate.promise;
 const work=f.open();await settle();await native.flush();f.activate(f.unrelated);f.activate(f.origin);
 gate.resolve();await assert.rejects(work,/变化|取消/);assert.equal(f.reveals.length,0);assert.equal(f.plugin.collectionRelatedReturns.size,0);assert.deepEqual(f.focus,[f.origin]);
});
test('the verified native target is activated explicitly before a reveal that only exposes its tab',async()=>{
 const f=relatedFixture();
 f.workspace.revealLeaf=async(leaf:any)=>{assert.equal(f.active(),leaf);f.reveals.push(leaf);};
 await f.open();assert.equal(f.active(),f.target);assert.deepEqual(f.focus,[f.target]);assert.equal(f.target.view.actions[0].removed,false);
});
test('completion of a native reveal never reactivates its target after a newer navigation',async()=>{
 const f=relatedFixture(),gate=deferred();
 f.workspace.revealLeaf=async(leaf:any)=>{f.reveals.push(leaf);await gate.promise;};
 const work=f.open();await settle();assert.equal(f.active(),f.target);f.activate(f.unrelated);gate.resolve();await work;
 assert.equal(f.active(),f.unrelated);assert.deepEqual(f.focus,[f.target]);
});
for(const reason of ['other-active','source-replaced','source-closed','source-document','scope-revoked'])test(`tab allocation does not restore focus or open a file after ${reason}`,async()=>{
 const f=relatedFixture();let opens=0;f.control.open=async()=>{opens++;};
 f.workspace.getLeaf=()=>{f.allocated.push(f.target);f.activateSilently(f.target);
  if(reason==='other-active')f.activateSilently(f.unrelated);
  if(reason==='source-replaced')f.origin.view=new CollectionView(f.doc);
  if(reason==='source-closed')f.origin.view.containerEl.isConnected=false;
  if(reason==='source-document')f.origin.view.containerEl.ownerDocument=f.otherDoc;
  if(reason==='scope-revoked')f.cancel();
  return f.target;
 };
 await assert.rejects(f.open(),/变化|取消/);assert.equal(f.focus.length,0);assert.equal(opens,0);assert.equal(f.reveals.length,0);assert.equal(f.plugin.collectionRelatedReturns.size,0);
});
test('a target replacement during synchronous focus restoration is not overwritten',async()=>{
 const f=relatedFixture();let opens=0;f.control.open=async()=>{opens++;};
 f.workspace.getLeaf=()=>{f.allocated.push(f.target);f.activateSilently(f.target);return f.target;};
 f.workspace.setActiveLeaf=(leaf:any)=>{f.activateSilently(leaf);f.target.view=new FileView(new File('Other.md'),f.doc);};
 await assert.rejects(f.open(),/变化|取消/);assert.equal(opens,0);assert.equal(f.reveals.length,0);assert.equal(f.target.view.file.path,'Other.md');
});
test('a newly opened deferred native tab loads its real FileView before attaching the return action',async()=>{
 const f=relatedFixture();let loads=0;
 f.target.openFile=async()=>{f.target.isDeferred=true;f.target.view={containerEl:{isConnected:true,ownerDocument:f.doc}};};
 f.target.loadIfDeferred=async()=>{loads++;f.target.isDeferred=false;f.target.view=new FileView(f.targetFile,f.doc);};
 await f.open();assert.equal(loads,1);assert.equal(f.plugin.collectionRelatedReturns.size,1);assert.equal(f.target.view.actions[0].removed,false);assert.equal(f.active(),f.target);
});
for(const reason of ['away-return','file-replacement'])test(`a newly deferred native tab rejects ${reason} during loading`,async()=>{
 const f=relatedFixture(),gate=deferred();
 f.target.openFile=async()=>{f.target.isDeferred=true;f.target.view={containerEl:{isConnected:true,ownerDocument:f.doc}};};
 f.target.loadIfDeferred=async()=>{await gate.promise;f.target.isDeferred=false;f.target.view=new FileView(f.targetFile,f.doc);};
 const work=f.open();await settle();
 if(reason==='away-return'){f.activate(f.unrelated);f.activate(f.origin);}
 else f.files.set(f.targetFile.path,new File(f.targetFile.path));
 gate.resolve();await assert.rejects(work,/变化|取消/);assert.equal(f.reveals.length,0);assert.equal(f.plugin.collectionRelatedReturns.size,0);
});
for(const extension of ['md','pdf','png','mp3'])test(`related ${extension} opens in the original document and returns to the verified collection source`,async()=>{
 const f=relatedFixture(extension);await f.open();assert.equal(f.active(),f.target);assert.equal(f.target.view.file,f.targetFile);assert.equal(f.target.view.actions.length,1);assert.equal(f.target.view.actions[0].dataset.collectionReturnSource,'true');
 await f.target.view.actions[0].click();assert.deepEqual(f.returned,[f.note]);
});
test('existing native note view is reused and receives just one current source action',async()=>{
 const f=relatedFixture('md',true);await f.open();const first=f.target.view.actions[0];f.plugin.attachCollectionSourceReturn(f.target,f.note,f.identity,f.targetFile);assert.equal(first.removed,true);assert.equal(f.plugin.collectionRelatedReturns.size,1);assert.equal(f.target.view.actions.length,2);assert.equal(f.refs.size,f.baseRefs+2);
});
for(const reason of ['different-file','foreign-document','closed-view'])test(`related native opening rejects ${reason} that arrives while openFile is pending`,async()=>{
 const f=relatedFixture('pdf'),gate=deferred();f.control.open=()=>gate.promise;f.control.skipOpenView=true;const work=f.open();await settle();
 if(reason==='different-file')f.target.view=new FileView(new File('Other.md'),f.doc);
 if(reason==='foreign-document')f.target.view.containerEl.ownerDocument=f.otherDoc;
 if(reason==='closed-view')f.target.view.containerEl.isConnected=false;
 gate.resolve();await assert.rejects(work,/变化|取消|窗口|就绪/);assert.equal(f.reveals.length,0);assert.equal(f.plugin.collectionRelatedReturns.size,0);
});
test('deferred existing view must still show the requested native file after loading',async()=>{
 const f=relatedFixture('md',true),gate=deferred();f.target.isDeferred=true;f.control.load=()=>gate.promise;const work=f.open();await settle();f.target.view.file=new File('Other.md');gate.resolve();await assert.rejects(work,/变化|取消|就绪/);assert.equal(f.reveals.length,0);
});
test('newer navigation while an owned tab opens prevents a late reveal or return action',async()=>{
 const f=relatedFixture('pdf'),gate=deferred();f.control.open=()=>gate.promise;const work=f.open();await settle();f.activate(f.unrelated);f.activate(f.origin);gate.resolve();await assert.rejects(work,/变化|取消/);assert.equal(f.reveals.length,0);assert.equal(f.plugin.collectionRelatedReturns.size,0);
});
test('a queued related opening validates its scope before allocating a tab',async()=>{
 const f=relatedFixture(),gate=deferred();f.plugin.noteQueue=gate.promise;const work=f.open();f.cancel();gate.resolve();await assert.rejects(work,/变化|取消/);assert.equal(f.allocated.length,0);assert.equal(f.reveals.length,0);
});
for(const reason of ['replace','rename','close-window'])test(`related target ${reason} while opening cannot silently rebind`,async()=>{
 const f=relatedFixture('pdf'),gate=deferred();f.control.open=()=>gate.promise;const work=f.open();await settle();
 if(reason==='replace')f.files.set(f.targetFile.path,new File(f.targetFile.path));
 if(reason==='rename'){f.files.delete(f.targetFile.path);f.targetFile.path='Assets/Renamed.pdf';f.files.set(f.targetFile.path,f.targetFile);}
 if(reason==='close-window')f.doc.defaultView.closed=true;
 gate.resolve();await assert.rejects(work,/变化|取消/);assert.equal(f.reveals.length,0);
});
test('return action cancels a delayed source resolution after leaving and returning to its native view',async()=>{
 const f=relatedFixture('pdf');await f.open();const gate=deferred();f.control.resolve=()=>gate.promise;const work=f.target.view.actions[0].click();f.activate(f.unrelated);f.activate(f.target);gate.resolve();await work;assert.deepEqual(f.returned,[]);
});
test('return action rejects replaced or duplicate source identity and does not open an unrelated note',async()=>{
 for(const reason of ['replace','duplicate']){const f=relatedFixture('png');await f.open();if(reason==='replace')f.control.resolved=new File(f.note.path);else f.control.reject=Error('重复的收集标识');await assert.rejects(f.target.view.actions[0].click(),/变化|重复/);assert.deepEqual(f.returned,[]);}
});
for(const kind of ['file-switch','view-close','plugin-unload'])test(`source action releases its DOM and both workspace refs on ${kind}`,async()=>{
 const f=relatedFixture('pdf');await f.open();const action=f.target.view.actions[0];assert.equal(f.refs.size,f.baseRefs+2);
 if(kind==='file-switch'){f.target.view.file=new File('Another.pdf');f.emit('file-open');}else if(kind==='view-close')f.target.view.close();else for(const dispose of f.disposers)dispose();
 assert.equal(action.removed,true);assert.equal(f.refs.size,f.baseRefs);assert.equal(f.plugin.collectionRelatedReturns.size,0);await action.click();assert.deepEqual(f.returned,[]);
});
test('source identity must resolve to the same native file after an awaited related open',async()=>{
 const f=relatedFixture('pdf'),gate=deferred();f.control.open=()=>gate.promise;const work=f.open();await settle();f.control.resolved=new File(f.note.path);gate.resolve();await assert.rejects(work,/来源|变化/);assert.equal(f.reveals.length,0);assert.equal(f.plugin.collectionRelatedReturns.size,0);
});
test('target view cannot change during the second source identity verification',async()=>{
 const f=relatedFixture('pdf'),gate=deferred();let reads=0;f.control.resolve=async()=>{if(++reads===2)await gate.promise;};const work=f.open();await settle();f.target.view.file=new File('Other.pdf');gate.resolve();await assert.rejects(work,/目标|变化/);assert.equal(f.reveals.length,0);assert.equal(f.plugin.collectionRelatedReturns.size,0);
});
for(const reason of ['view-close','plugin-unload'])test(`pending return source lookup is cancelled by ${reason} and releases its refs`,async()=>{
 const f=relatedFixture('pdf');await f.open();const gate=deferred();f.control.resolve=()=>gate.promise;const work=f.target.view.actions[0].click();if(reason==='view-close')f.target.view.close();else for(const dispose of f.disposers)dispose();gate.resolve();await work;assert.deepEqual(f.returned,[]);assert.equal(f.refs.size,f.baseRefs);assert.equal(f.plugin.collectionRelatedReturns.size,0);
});
test('two rapid return-source activations share one pending source lookup',async()=>{
 const f=relatedFixture('pdf');await f.open();const gate=deferred();let reads=0;f.control.resolve=async()=>{reads++;await gate.promise;};const first=f.target.view.actions[0].click(),second=f.target.view.actions[0].click();gate.resolve();await Promise.all([first,second]);assert.equal(reads,1);assert.deepEqual(f.returned,[f.note]);
});
