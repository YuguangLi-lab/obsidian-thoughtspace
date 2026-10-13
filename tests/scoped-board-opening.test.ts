import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {boardHostDeps} from './board-host-deps';
import {emptyBoard} from '../src/model';
import {SharedOpen,SerialOpen} from '../src/view-opening';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
class View {containerEl:any;constructor(doc:any){this.containerEl={ownerDocument:doc,isConnected:true};}}
class FileView extends View {file:any;constructor(doc:any,file:any){super(doc);this.file=file;}}
class BoardView extends FileView {
 session:any={board:emptyBoard()};closed=false;isClosing=false;resumes=0;fits=0;
 async prepareVideoBridge(){}captureConvenienceLocation(){return{camera:'retained'};}async restoreConvenienceLocation(){}
 resumeAutomaticGeometry(){this.resumes++;}fit(){this.fits++;}
}
class CollectionView extends View {
 session='fixture-session';draft='未提交原草稿';filter='unplaced';scroll=1620;restores=0;
 captureCollectionLocation(){return{scroll:this.scroll};}
 async restoreCollectionLocation(value:any,current:()=>boolean){assert.ok(current());assert.equal(value.scroll,this.scroll);this.restores++;}
}
const dependencies={...boardHostDeps,View,FileView,BoardView,CollectionView,SharedOpen,SerialOpen,ConvenienceNavigationLease,VIEW:'board',window:{requestAnimationFrame:(fn:()=>void)=>fn()}};
const Host=new Function(...Object.keys(dependencies),transformSync('class Host{'+take('  convenienceOrigin(){','  private async captureDestination(')+take('  async openBoard(','\n  openBoardOrganizer(')+'};return Host;',{loader:'ts'}).code)(...Object.values(dependencies));
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};};
async function until(check:()=>boolean){for(let i=0;i<150&&!check();i++)await Promise.resolve();assert.ok(check(),'reach controlled asynchronous boundary');}
function document(name:string){const events=new Map<string,Set<()=>void>>();return{name,defaultView:{closed:false,addEventListener(key:string,fn:()=>void){let set=events.get(key);if(!set){set=new Set();events.set(key,set);}set.add(fn);},removeEventListener(key:string,fn:()=>void){events.get(key)?.delete(fn);},requestAnimationFrame:(fn:()=>void)=>fn()},selected:undefined as any};}
function fixture(local=true){
 const main=document('main'),popup=document('popup'),file={path:'Boards/Target.md',extension:'md'},raw=boardHostDeps.createMarkdownBoardDocument(emptyBoard(),'Target');
 const files=new Map<string,any>([[file.path,file]]),leaves:any[]=[],refs=new Set<any>(),tabs:any[]=[],splits:any[]=[],reveals:any[]=[],focus:any[]=[],detached:any[]=[],targets:any[]=[],control:any={};let active:any,next=0;
 const emit=(name:string,...args:any[])=>{for(const ref of [...refs])if(ref.name===name)ref.fn(...args);};
 const activate=(leaf:any)=>{active=leaf;leaf.view.containerEl.ownerDocument.selected=leaf;emit('active-leaf-change',leaf);};
 const make=(doc:any,type:string,target?:any)=>{
  const leaf:any={id:++next,isDeferred:false,previous:doc.selected,state:{type,state:type==='collection'?{collectionSession:'fixture-session'}:target?{file:target.path}:{}},view:type==='board'?new BoardView(doc,target):type==='collection'?new CollectionView(doc):new View(doc)};
  leaf.getViewState=()=>leaf.state;
  leaf.loadIfDeferred=async()=>{await leaf.load?.();if(leaf.isDeferred){leaf.isDeferred=false;leaf.view=new BoardView(doc,target);emit('file-open',target);}};
  leaf.setViewState=async(state:any)=>{await control.mount?.(leaf);leaf.state=state;leaf.view=new BoardView(doc,files.get(state.state.file));emit('file-open',leaf.view.file);};
  leaf.openFile=async(target:any)=>leaf.setViewState({type:'board',state:{file:target.path}});
  leaf.detach=()=>{detached.push(leaf);leaves.splice(leaves.indexOf(leaf),1);leaf.view.containerEl.isConnected=false;if(doc.selected===leaf)doc.selected=leaf.previous;if(active===leaf&&leaf.previous)activate(leaf.previous);};
  leaves.push(leaf);return leaf;
 };
 const mainOrigin=make(main,'collection'),foreign=make(main,'board',file),origin=make(popup,'collection'),own=local?make(popup,'board',file):undefined;
 main.selected=mainOrigin;activate(origin);
 const workspace={containerEl:{ownerDocument:main},get activeLeaf(){return active;},getMostRecentLeaf:()=>active,getLeavesOfType:(type:string)=>leaves.filter(l=>l.state.type===type),
  on:(name:string,fn:any)=>{const ref={name,fn};refs.add(ref);return ref;},offref:(ref:any)=>refs.delete(ref),
  getLeaf:()=>{const leaf=control.tab?.()||make(active.view.containerEl.ownerDocument,'empty');tabs.push(leaf);activate(leaf);control.afterTab?.(leaf);return leaf;},
  createLeafBySplit:(from:any,direction:string)=>{splits.push({from,direction});const leaf=control.allocate?.(from)||make(from.view.containerEl.ownerDocument,'empty');activate(leaf);return leaf;},
  revealLeaf:async(leaf:any)=>{await control.reveal?.(leaf);reveals.push(leaf);activate(leaf);},setActiveLeaf:(leaf:any)=>{focus.push(leaf);activate(leaf);}};
 const host=new Host();Object.assign(host,{app:{workspace,vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>{await control.read?.();return raw;},cachedRead:async()=>{await control.cached?.();return raw;}}},boardOpening:new SharedOpen(),scopedBoardOpening:new WeakMap(),boardOpeningNavigation:new Set(),provisionalBoardGeometry:new WeakMap()});
 const navigation=(from=origin)=>({scope:{document:from.view.containerEl.ownerDocument,origin:from},acquire:(create:()=>any)=>create(),target:(leaf:any)=>{targets.push({from,leaf});assert.equal(leaf.view.containerEl.ownerDocument,from.view.containerEl.ownerDocument);}});
 return{host,main,popup,file,files,leaves,origin,mainOrigin,own,foreign,workspace,tabs,splits,reveals,focus,detached,targets,control,make,activate,active:()=>active,navigation};
}

test('real convenience route chooses popup despite main-first same-file leaf and returns the live Collection',async()=>{
 const f=fixture(),original=f.origin.view,mainState={view:f.mainOrigin.view,selected:f.main.selected,draft:f.mainOrigin.view.draft,filter:f.mainOrigin.view.filter,scroll:f.mainOrigin.view.scroll},scope=f.host.convenienceOrigin();
 assert.equal(await scope.openBoard(f.file,()=>true),f.own.view);assert.deepEqual(f.reveals,[f.own]);assert.equal(f.splits.length,0);assert.equal(f.foreign.view.resumes,0);
 await scope.returnToOrigin(()=>true);assert.equal(f.active(),f.origin);assert.equal(f.origin.view,original);assert.equal(original.restores,1);assert.equal(original.draft,'未提交原草稿');
 assert.deepEqual({view:f.mainOrigin.view,selected:f.main.selected,draft:f.mainOrigin.view.draft,filter:f.mainOrigin.view.filter,scroll:f.mainOrigin.view.scroll},mainState);scope.stop();
});
test('missing popup target prefers a native tab and keeps main board and Collection cache alive',async()=>{
 const f=fixture(false),original=f.origin.view,scope=f.host.convenienceOrigin(),view=await scope.openBoard(f.file,()=>true);
 assert.equal(f.tabs.length,1);assert.equal(f.splits.length,0);assert.equal(view.containerEl.ownerDocument,f.popup);assert.equal(f.origin.view,original);assert.equal(f.foreign.view.containerEl.isConnected,true);assert.equal(f.main.selected,f.mainOrigin);
 await scope.returnToOrigin(()=>true);assert.equal(f.active(),f.origin);assert.equal(original.draft,'未提交原草稿');assert.equal(original.scroll,1620);scope.stop();
});
test('main-window missing target keeps the full-width native-tab route',async()=>{
 const f=fixture(false);f.foreign.detach();f.activate(f.mainOrigin);const original=f.mainOrigin.view,scope=f.host.convenienceOrigin(),view=await scope.openBoard(f.file,()=>true);
 assert.equal(f.tabs.length,1);assert.equal(f.splits.length,0);assert.equal(view.containerEl.ownerDocument,f.main);await scope.returnToOrigin(()=>true);assert.equal(f.mainOrigin.view,original);assert.equal(f.active(),f.mainOrigin);scope.stop();
});
test('foreign new-tab allocation is safely discarded before public same-origin split fallback',async()=>{
 const f=fixture(false);let foreignTab:any;f.control.tab=()=>foreignTab=f.make(f.main,'empty');const scope=f.host.convenienceOrigin(),view=await scope.openBoard(f.file,()=>true);
 assert.deepEqual(f.detached,[foreignTab]);assert.deepEqual(f.splits,[{from:f.origin,direction:'vertical'}]);assert.equal(view.containerEl.ownerDocument,f.popup);assert.equal(f.main.selected,f.mainOrigin);assert.equal(f.origin.view.draft,'未提交原草稿');await scope.returnToOrigin(()=>true);assert.equal(f.active(),f.origin);scope.stop();
});
for(const foreign of [false,true])test(`additional synchronous navigation during ${foreign?'foreign':'local'} tab allocation never opens a fallback or steals focus`,async()=>{
 const f=fixture(false),other=f.make(f.popup,'collection');if(foreign)f.control.tab=()=>f.make(f.main,'empty');f.control.afterTab=()=>f.activate(other);
 const scope=f.host.convenienceOrigin();await assert.rejects(scope.openBoard(f.file,()=>true),/变化|取消|出发窗口|未就绪/);assert.equal(f.active(),other);assert.equal(other.view.containerEl.isConnected,true);assert.equal(f.splits.length,0);assert.equal(f.reveals.length,0);assert.deepEqual(f.detached,f.tabs);scope.stop();
});
test('default unscoped opening still follows the existing global route',async()=>{const f=fixture();await f.host.openBoard(f.file);assert.deepEqual(f.reveals,[f.foreign]);assert.equal(f.splits.length,0);assert.equal(f.own.view.resumes,0);});
test('scoped deferred local leaf loads before reveal and never hydrates the foreign leaf',async()=>{
 const f=fixture(),gate=deferred();let loading=false;f.own.isDeferred=true;f.own.view=new View(f.popup);f.own.load=async()=>{loading=true;await gate.promise;};f.foreign.load=()=>assert.fail('foreign target must not load');
 const scope=f.host.convenienceOrigin(),work=scope.openBoard(f.file,()=>true);await until(()=>loading);assert.equal(f.reveals.length,0);gate.resolve();assert.equal(await work,f.own.view);assert.deepEqual(f.reveals,[f.own]);scope.stop();
});
for(const reason of ['away-and-back','origin-view-replaced','window-closed','target-replaced','target-moved-document'] as const)test(`deferred scoped navigation cancels ${reason} without reveal or focus`,async()=>{
 const f=fixture(),gate=deferred();let loading=false;f.own.load=async()=>{loading=true;await gate.promise;};const scope=f.host.convenienceOrigin(),work=scope.openBoard(f.file,()=>true);await until(()=>loading);
 if(reason==='away-and-back'){const other=f.make(f.popup,'collection');f.activate(other);f.activate(f.origin);}
 if(reason==='origin-view-replaced')f.origin.view=new CollectionView(f.popup);
 if(reason==='window-closed')f.popup.defaultView.closed=true;
 if(reason==='target-replaced')f.files.set(f.file.path,{...f.file});
 if(reason==='target-moved-document')f.own.view.containerEl.ownerDocument=f.main;
 gate.resolve();await assert.rejects(work,/变化|取消|未就绪/);assert.equal(f.reveals.length,0);assert.equal(f.focus.length,0);assert.equal(f.detached.length,0);scope.stop();
});
test('source TFile replacement during allocated-placeholder read cancels and discards only that empty leaf',async()=>{
 const f=fixture(false),sourceFile={path:'Boards/Origin.md',extension:'md'},gate=deferred();f.files.set(sourceFile.path,sourceFile);f.origin.state={type:'board',state:{file:sourceFile.path}};f.origin.view=new BoardView(f.popup,sourceFile);let reading=false;f.control.cached=async()=>{reading=true;await gate.promise;};
 const scope=f.host.convenienceOrigin(),work=scope.openBoard(f.file,()=>true);await until(()=>reading);const allocated=f.active();f.files.set(sourceFile.path,{...sourceFile});gate.resolve();await assert.rejects(work,/变化|取消|未就绪/);assert.deepEqual(f.detached,[allocated]);assert.equal(f.origin.view.file,sourceFile);assert.equal(f.foreign.view.containerEl.isConnected,true);assert.equal(f.reveals.length,0);scope.stop();
});
test('changed placeholder is preserved when the user navigates it during a pending read',async()=>{
 const f=fixture(false),gate=deferred();let reading=false;f.control.cached=async()=>{reading=true;await gate.promise;};const scope=f.host.convenienceOrigin(),work=scope.openBoard(f.file,()=>true);await until(()=>reading);
 const allocated=f.active(),other={path:'User.md'};allocated.state={type:'markdown',state:{file:other.path}};allocated.view=new FileView(f.popup,other);gate.resolve();await assert.rejects(work,/变化|取消|未就绪/);assert.equal(f.detached.length,0);assert.equal(allocated.view.file,other);assert.equal(f.reveals.length,0);scope.stop();
});
test('an allocated empty tab moved to another window during a pending read is preserved',async()=>{
 const f=fixture(false),gate=deferred();let reading=false;f.control.cached=async()=>{reading=true;await gate.promise;};
 const scope=f.host.convenienceOrigin(),work=scope.openBoard(f.file,()=>true);await until(()=>reading);
 const allocated=f.active();allocated.view.containerEl.ownerDocument=f.main;gate.resolve();
 await assert.rejects(work,/变化|取消|未就绪/);assert.equal(f.detached.length,0);assert.equal(allocated.view.containerEl.isConnected,true);assert.equal(allocated.getViewState().type,'empty');assert.equal(f.reveals.length,0);assert.equal(f.splits.length,0);scope.stop();
});
test('an allocated empty tab moved to another tab group survives a later read failure',async()=>{
 const f=fixture(false),gate=deferred();let reading=false;f.control.cached=async()=>{reading=true;await gate.promise;throw Error('read failed after tab move');};
 const scope=f.host.convenienceOrigin(),work=scope.openBoard(f.file,()=>true);await until(()=>reading);
 const allocated=f.active();allocated.parent={group:'user-selected'};gate.resolve();
 await assert.rejects(work,/read failed after tab move/);assert.equal(f.detached.length,0);assert.equal(allocated.view.containerEl.isConnected,true);assert.equal(allocated.getViewState().type,'empty');assert.equal(f.reveals.length,0);scope.stop();
});
test('wrong-document new allocation is rejected and only its unchanged empty leaf is discarded',async()=>{
 const f=fixture(false);let tab:any,bad:any;f.control.tab=()=>tab=f.make(f.main,'empty');f.control.allocate=()=>bad=f.make(f.main,'empty');const scope=f.host.convenienceOrigin();await assert.rejects(scope.openBoard(f.file,()=>true),/另一窗口|出发窗口/);assert.deepEqual(f.detached,[tab,bad]);assert.equal(f.foreign.view.containerEl.isConnected,true);assert.equal(f.reveals.length,0);scope.stop();
});
test('a borrowed preexisting empty leaf is never treated as an owned failed allocation',async()=>{
 const f=fixture(false),borrowed=f.make(f.main,'empty');f.control.tab=()=>borrowed;const scope=f.host.convenienceOrigin();await assert.rejects(scope.openBoard(f.file,()=>true),/页面已变化/);assert.equal(f.detached.length,0);assert.equal(borrowed.view.containerEl.isConnected,true);assert.equal(f.splits.length,0);scope.stop();
});
test('same-document queued requests each bind their target instead of sharing a leader callback',async()=>{
 const f=fixture(),gate=deferred();let loads=0;f.own.load=async()=>{if(++loads===1)await gate.promise;};
 const a=f.host.openBoard(f.file,false,()=>true,false,f.navigation()),b=f.host.openBoard(f.file,false,()=>true,false,f.navigation());await until(()=>loads===1);assert.equal(f.targets.length,1);gate.resolve();await Promise.all([a,b]);assert.equal(loads,2);assert.equal(f.targets.length,2);assert.ok(f.targets.every(v=>v.leaf===f.own));assert.equal(f.splits.length,0);
});
test('a cancelled queued request never binds, reveals or fits after its predecessor',async()=>{
 const f=fixture(),gate=deferred();let loading=false,secondCurrent=true;f.own.load=async()=>{loading=true;await gate.promise;};
 const a=f.host.openBoard(f.file,false,()=>true,false,f.navigation()),b=f.host.openBoard(f.file,true,()=>secondCurrent,false,f.navigation());await until(()=>loading);secondCurrent=false;gate.resolve();await Promise.all([a,b]);assert.equal(f.targets.length,1);assert.deepEqual(f.reveals,[f.own]);assert.equal(f.own.view.fits,0);
});
test('two actual convenience leases never inherit each other\'s synchronous allocation authority',async()=>{
 const f=fixture(false),gate=deferred();let reading=false;f.control.cached=async()=>{reading=true;await gate.promise;};const first=f.host.convenienceOrigin(),second=f.host.convenienceOrigin();
 const a=first.openBoard(f.file,()=>true),b=second.openBoard(f.file,()=>true),result=Promise.allSettled([a,b]);await until(()=>reading);gate.resolve();const settled=await result;
 assert.equal(settled[0].status,'fulfilled');assert.equal(settled[1].status,'rejected');assert.equal(f.tabs.length,1);assert.equal(f.splits.length,0);assert.deepEqual(f.reveals,[f.tabs[0]]);assert.equal(f.main.selected,f.mainOrigin);first.stop();second.stop();
});
test('same-file requests in different documents do not share an in-flight result',async()=>{
 const f=fixture(),gate=deferred();let mainLoading=false,popupDone=false;f.foreign.load=async()=>{mainLoading=true;await gate.promise;};
 const first=f.host.openBoard(f.file,false,()=>true,false,f.navigation(f.mainOrigin));await until(()=>mainLoading);
 const second=f.host.openBoard(f.file,false,()=>true,false,f.navigation()).then(()=>{popupDone=true;});await until(()=>popupDone);assert.deepEqual(f.reveals,[f.own]);gate.resolve();await Promise.all([first,second]);assert.deepEqual(f.targets.map(v=>v.leaf),[f.foreign,f.own]);
});
test('a queued request still runs independently after a prior allocation failure',async()=>{
 const queue=new SerialOpen<string,string>(),gate=deferred(),events:string[]=[];
 const first=queue.run('same',async()=>{events.push('first');await gate.promise;throw Error('first failed');}),second=queue.run('same',async()=>{events.push('second');return'own result';});
 await until(()=>events.length===1);gate.resolve();await assert.rejects(first,/first failed/);assert.equal(await second,'own result');assert.deepEqual(events,['first','second']);assert.equal(await queue.run('same',async()=>'later'),'later');
});
