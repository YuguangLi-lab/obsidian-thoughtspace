import test from 'node:test';
import assert from 'node:assert/strict';
import {CollectionOpener} from '../src/collection-opening';

const TYPE='thoughtspace-collection';
function deferred<T=void>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
function fixture(){
 const main:any={defaultView:{closed:false}},popout:any={defaultView:{closed:false}};
 const left={},right={},roots=new Map<any,object>([[main,{}],[popout,{}]]);
 const leaves:any[]=[],allocations:any[]=[],reveals:any[]=[],focus:any[]=[],recoveries:any[]=[],refs=new Set<any>();
 const hooks:{recover?:()=>Promise<string|undefined>;allocate?:(placement:string,leaf:any)=>any;beforeSet?:(leaf:any)=>Promise<void>;afterSet?:(leaf:any)=>Promise<void>;load?:(leaf:any)=>Promise<void>;reveal?:(leaf:any)=>Promise<void>}={};
 let active:any;
 const emit=(name:string)=>{for(const ref of [...refs])if(ref.name===name)ref.callback();};
 const activate=(leaf:any)=>{active=leaf;emit('active-leaf-change');};
 const add=(type='markdown',doc=main,root=roots.get(doc),domDoc=doc)=>{
  const leaf:any={doc,root,state:{type,state:{}},sets:[],loads:0,detached:false};
  leaf.view={containerEl:{ownerDocument:domDoc,isConnected:true},file:type==='markdown'?{path:'Working note.md',draft:'unsaved text'}:undefined};
  leaf.getContainer=()=>({doc:leaf.doc});leaf.getRoot=()=>leaf.root;leaf.getViewState=()=>leaf.state;
  leaf.setViewState=async(state:any)=>{leaf.sets.push(state);await hooks.beforeSet?.(leaf);leaf.state=state;leaf.view={containerEl:{ownerDocument:leaf.doc,isConnected:true}};await hooks.afterSet?.(leaf);};
  leaf.loadIfDeferred=async()=>{leaf.loads++;await hooks.load?.(leaf);};
  leaf.detach=()=>{leaf.detached=true;leaf.view.containerEl.isConnected=false;};
  leaves.push(leaf);return leaf;
 };
 const note=add(),calendar=add('calendar',main,right);active=note;
 const allocate=(placement:string)=>{
  const leaf=add('empty',placement==='sidebar'?main:active.doc,placement==='sidebar'?right:roots.get(active.doc),main);
  allocations.push({placement,leaf});activate(leaf);
  return hooks.allocate?hooks.allocate(placement,leaf):leaf;
 };
 const workspace:any={containerEl:{ownerDocument:main},leftSplit:left,rightSplit:right,
  get activeLeaf(){return active;},getLeavesOfType:(type:string)=>leaves.filter(leaf=>!leaf.detached&&leaf.state.type===type),
  iterateAllLeaves:(visit:(leaf:any)=>void)=>leaves.filter(leaf=>!leaf.detached).forEach(visit),
  getRightLeaf:(split:boolean)=>{assert.equal(split,false);return allocate('sidebar');},
  getLeaf:(kind:string)=>{assert.equal(kind,'tab');return allocate('page');},
  revealLeaf:async(leaf:any)=>{reveals.push(leaf);await hooks.reveal?.(leaf);},
  setActiveLeaf:(leaf:any,options:any)=>{assert.deepEqual(options,{focus:true});focus.push(leaf);activate(leaf);},
  on:(name:string,callback:()=>void)=>{const ref={name,callback};refs.add(ref);return ref;},offref:(ref:any)=>refs.delete(ref)
 };
 const opener=new CollectionOpener(workspace,TYPE,async()=>{recoveries.push(true);return hooks.recover?hooks.recover():`session-${recoveries.length}`;});
 return{opener,workspace,main,popout,left,right,roots,note,calendar,add,activate,active:()=>active,emit,hooks,leaves,allocations,reveals,focus,recoveries,refs};
}

test('sidebar creates a new right leaf without replacing the main note or Calendar',async()=>{
 const f=fixture(),noteView=f.note.view,calendarView=f.calendar.view;
 await f.opener.open('sidebar');const target=f.allocations[0].leaf;
 assert.equal(f.allocations.length,1);assert.equal(target.root,f.right);assert.equal(f.active(),target);
 assert.equal(f.note.view,noteView);assert.equal(f.note.view.file.draft,'unsaved text');assert.equal(f.calendar.view,calendarView);
 assert.deepEqual(f.note.sets,[]);assert.deepEqual(f.calendar.sets,[]);
 assert.deepEqual(target.state,{type:TYPE,active:false,state:{collectionSession:'session-1'}});
 assert.deepEqual(f.reveals,[target]);assert.equal(f.refs.size,0);
});

test('complete-page and sidebar entry points keep and reuse their own leaves',async()=>{
 const f=fixture();await f.opener.open('sidebar');const side=f.active();
 await f.opener.open();const page=f.active();
 assert.notEqual(page,side);assert.equal(page.root,f.roots.get(f.main));assert.equal(f.allocations.length,2);
 assert.equal(side.state.state.collectionSession,'session-1');assert.equal(page.state.state.collectionSession,'session-2');
 await f.opener.open('sidebar');assert.equal(f.active(),side);
 await f.opener.open('page');assert.equal(f.active(),page);
 assert.equal(f.allocations.length,2);assert.equal(f.recoveries.length,2);assert.equal(side.sets.length,1);assert.equal(page.sets.length,1);
});

test('an existing collection deliberately moved to the left dock is reused',async()=>{
 const f=fixture(),side=f.add(TYPE,f.main,f.left);side.state.state.collectionSession='live-draft';
 await f.opener.open('sidebar');assert.equal(f.active(),side);assert.equal(f.allocations.length,0);assert.equal(f.recoveries.length,0);assert.deepEqual(side.sets,[]);
});

for(const placement of ['page','sidebar'] as const)test(`${placement} double-click shares recovery and allocation`,async()=>{
 const f=fixture(),entered=deferred(),gate=deferred<string|undefined>();f.hooks.recover=()=>{entered.resolve();return gate.promise;};
 const first=f.opener.open(placement),second=f.opener.open(placement);await entered.promise;
 assert.equal(f.recoveries.length,1);assert.equal(f.allocations.length,0);gate.resolve('draft');await Promise.all([first,second]);
 assert.equal(f.allocations.length,1);assert.equal(f.reveals.length,1);assert.equal(f.active().state.state.collectionSession,'draft');assert.equal(f.refs.size,0);
});

test('closing and reopening sidebar asks the existing draft recovery host for its session',async()=>{
 const f=fixture();f.hooks.recover=async()=>'recoverable-draft';await f.opener.open('sidebar');const first=f.active();
 first.detach();f.activate(f.note);await f.opener.open('sidebar');
 assert.notEqual(f.active(),first);assert.equal(f.recoveries.length,2);assert.equal(f.active().state.state.collectionSession,'recoverable-draft');
});

test('a recovery failure does not cache a failed opening or change the current note',async()=>{
 const f=fixture();f.hooks.recover=async()=>{throw Error('draft storage unavailable');};
 await assert.rejects(f.opener.open('sidebar'),/storage unavailable/);assert.equal(f.allocations.length,0);assert.equal(f.active(),f.note);assert.equal(f.refs.size,0);
 f.hooks.recover=async()=>'recovered';await f.opener.open('sidebar');assert.equal(f.allocations.length,1);assert.equal(f.active().state.state.collectionSession,'recovered');
});

test('fresh empty placeholder is removed if mounting fails before a view owns a draft',async()=>{
 const f=fixture();f.hooks.beforeSet=async()=>{throw Error('mount failed');};
 await assert.rejects(f.opener.open('sidebar'),/mount failed/);assert.equal(f.allocations[0].leaf.detached,true);assert.equal(f.reveals.length,0);assert.equal(f.refs.size,0);
 f.activate(f.note);delete f.hooks.beforeSet;await f.opener.open('sidebar');assert.equal(f.allocations.length,2);
});

test('a partially mounted collection survives failure so its draft can be recovered',async()=>{
 const f=fixture();f.hooks.afterSet=async()=>{throw Error('later mount failure');};
 await assert.rejects(f.opener.open('sidebar'),/later mount failure/);const target=f.allocations[0].leaf;
 assert.equal(target.detached,false);assert.equal(target.state.state.collectionSession,'session-1');
 delete f.hooks.afterSet;f.activate(f.note);await f.opener.open('sidebar');assert.equal(f.active(),target);assert.equal(target.sets.length,1);
});

for(const reason of ['away-return','file-away-return','replaced-view','closed-source','closed-window','disposed'] as const)test(`recovery cancels after ${reason}`,async()=>{
 const f=fixture(),entered=deferred(),gate=deferred<string|undefined>();f.hooks.recover=()=>{entered.resolve();return gate.promise;};
 const work=f.opener.open('sidebar');await entered.promise;
 if(reason==='away-return'){f.activate(f.calendar);f.activate(f.note);}
 if(reason==='file-away-return'){const file=f.note.view.file;f.note.view.file={path:'Other.md'};f.emit('file-open');f.note.view.file=file;f.emit('file-open');}
 if(reason==='replaced-view')f.note.view={containerEl:{ownerDocument:f.main,isConnected:true}};
 if(reason==='closed-source')f.note.view.containerEl.isConnected=false;
 if(reason==='closed-window')f.main.defaultView.closed=true;
 if(reason==='disposed')f.opener.dispose();
 gate.resolve('draft');await work;assert.equal(f.allocations.length,0);assert.equal(f.reveals.length,0);assert.equal(f.focus.length,0);assert.equal(f.refs.size,0);
});

test('navigation observed synchronously after the command also cancels its queued start',async()=>{
 const f=fixture(),work=f.opener.open('sidebar');f.activate(f.calendar);f.activate(f.note);await work;
 assert.equal(f.recoveries.length,0);assert.equal(f.allocations.length,0);assert.equal(f.refs.size,0);
});

test('a new command after navigation does not share the previous cancelled opening',async()=>{
 const f=fixture(),entered=deferred(),gate=deferred<string|undefined>();let reads=0;
 f.hooks.recover=()=>++reads===1?(entered.resolve(),gate.promise):Promise.resolve('new-draft');
 const first=f.opener.open('sidebar');await entered.promise;f.activate(f.calendar);
 const next=f.opener.open('sidebar');gate.resolve('old-draft');await Promise.all([first,next]);
 assert.equal(f.recoveries.length,2);assert.equal(f.allocations.length,1);assert.equal(f.active().state.state.collectionSession,'new-draft');assert.equal(f.refs.size,0);
});

test('disposing during recovery immediately releases navigation observers',async()=>{
 const f=fixture(),entered=deferred(),gate=deferred<string|undefined>();f.hooks.recover=()=>{entered.resolve();return gate.promise;};
 const work=f.opener.open('sidebar');await entered.promise;assert.equal(f.refs.size,2);f.opener.dispose();assert.equal(f.refs.size,0);
 gate.resolve('draft');await work;await f.opener.open('sidebar');assert.equal(f.allocations.length,0);assert.equal(f.recoveries.length,1);
});

test('away-and-return during deferred loading cannot reveal or focus a stale opening',async()=>{
 const f=fixture(),target=f.add(TYPE,f.main,f.right),entered=deferred(),gate=deferred();
 f.hooks.load=()=>{entered.resolve();return gate.promise;};const work=f.opener.open('sidebar');await entered.promise;
 f.activate(f.calendar);f.activate(f.note);gate.resolve();await work;
 assert.equal(target.loads,1);assert.equal(f.reveals.length,0);assert.equal(f.focus.length,0);assert.equal(f.refs.size,0);
});

test('closing a new collection while mounting prevents its late reveal',async()=>{
 const f=fixture(),entered=deferred(),gate=deferred();f.hooks.afterSet=()=>{entered.resolve();return gate.promise;};
 const work=f.opener.open('sidebar');await entered.promise;f.allocations[0].leaf.detach();f.activate(f.note);gate.resolve();await work;
 assert.equal(f.reveals.length,0);assert.equal(f.focus.length,0);
});

test('a newer navigation during reveal is not overwritten by late explicit focus',async()=>{
 const f=fixture(),target=f.add(TYPE,f.main,f.right),entered=deferred(),gate=deferred();
 f.hooks.reveal=()=>{entered.resolve();return gate.promise;};const work=f.opener.open('sidebar');await entered.promise;
 f.activate(f.calendar);gate.resolve();await work;assert.equal(f.active(),f.calendar);assert.deepEqual(f.reveals,[target]);assert.equal(f.focus.length,0);
});

test('popout sidebar is explicitly unsupported without creating or revealing a main-window leaf',async()=>{
 const f=fixture(),popNote=f.add('markdown',f.popout);f.activate(popNote);
 await assert.rejects(f.opener.open('sidebar'),/独立窗口.*主窗口/);assert.equal(f.recoveries.length,0);assert.equal(f.allocations.length,0);assert.equal(f.reveals.length,0);assert.equal(f.active(),popNote);assert.equal(f.refs.size,0);
});

test('complete-page opening stays in the popout using its authoritative container document',async()=>{
 const f=fixture(),mainPage=f.add(TYPE),popNote=f.add('markdown',f.popout,f.roots.get(f.popout),f.main);f.activate(popNote);
 await f.opener.open();const page=f.active();assert.notEqual(page,mainPage);assert.equal(page.doc,f.popout);assert.equal(f.allocations.length,1);assert.equal(f.reveals[0],page);
});

test('wrong-window new allocation is removed while existing pages remain untouched',async()=>{
 const f=fixture(),popNote=f.add('markdown',f.popout);f.activate(popNote);
 f.hooks.allocate=(_placement,leaf)=>{leaf.doc=f.main;leaf.root=f.roots.get(f.main);return leaf;};
 await assert.rejects(f.opener.open(),/窗口或区域/);const target=f.allocations[0].leaf;
 assert.equal(target.detached,true);assert.deepEqual(target.sets,[]);assert.equal(f.note.detached,false);assert.equal(popNote.detached,false);assert.equal(f.reveals.length,0);
});

test('an unexpected existing sidebar returned by the host is never overwritten',async()=>{
 const f=fixture();f.workspace.getRightLeaf=()=>f.calendar;
 await assert.rejects(f.opener.open('sidebar'),/已有页面保持不变/);assert.deepEqual(f.calendar.sets,[]);assert.equal(f.calendar.state.type,'calendar');assert.equal(f.calendar.detached,false);assert.equal(f.reveals.length,0);
});

test('no available sidebar yields a recoverable error without touching any view',async()=>{
 const f=fixture();f.workspace.getRightLeaf=()=>null;
 await assert.rejects(f.opener.open('sidebar'),/无法新建收集侧边栏/);assert.equal(f.allocations.length,0);assert.equal(f.active(),f.note);assert.equal(f.refs.size,0);
});
