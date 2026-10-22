import test from 'node:test';
import assert from 'node:assert/strict';
import {CollectionBatchCoordinator,CollectionBatchExecutionError,isCollectionBatchJournal,type CollectionBatchJournal,type CollectionBatchManifest,type CollectionBatchReport,type CollectionBatchSource} from '../src/collection-batch';
import {CollectionJsonStore,type CollectionJsonAdapter} from '../src/collection-json-store';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const date='2026-10-13T12:00:00.000Z';
const source=(index:number):CollectionBatchSource=>({id:`capture-batch-${index}`,createdAt:date,path:`收集/记录-${index}.md`,title:`记录 ${index}`,expectedArchived:false});
const manifest=(count=3):CollectionBatchManifest=>({id:'batch-fixture',createdAt:date,operation:'archive',items:Array.from({length:count},(_,index)=>source(index))});
class Store {
 confirmed:CollectionBatchJournal|null=null;disk:CollectionBatchJournal|null=null;blocked?:string;
 attempts=0;reads=0;confirmations=0;history:CollectionBatchJournal[]=[];
 modes=new Map<number,'fail-before'|'lost-ack-confirmed'|'unknown-after-write'>();
 beforeRead?:()=>Promise<void>;beforeWrite?:(value:CollectionBatchJournal,number:number)=>Promise<void>;
 async read(){this.reads++;await this.beforeRead?.();return{value:clone(this.confirmed),...(this.blocked?{blocked:this.blocked}:{})};}
 async write(value:CollectionBatchJournal,current:()=>boolean){
  const attempt=++this.attempts;await this.beforeWrite?.(value,attempt);
  if(!current())throw Error('journal cancelled');if(this.blocked)throw Error(this.blocked);
  assert.equal(isCollectionBatchJournal(value),true,'all persistence uses the real bounded schema');
  if(this.modes.get(attempt)==='fail-before')throw Error('journal not written');
  this.disk=clone(value);
  if(this.modes.get(attempt)==='unknown-after-write'){this.blocked='journal result unconfirmed';throw Error(this.blocked);}
  // The store contract resolves after exact readback, including a lost API ack.
  this.confirmations++;this.confirmed=clone(this.disk);this.history.push(clone(value));
 }
}
const statuses=(report:CollectionBatchReport)=>report.items.map(item=>item.status);
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

test('each record runs serially only after its running journal is confirmed, followed by a confirmed result',async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store),calls:number[]=[],progress:CollectionBatchReport[]=[];
 await coordinator.start(manifest(),()=>true,report=>progress.push(report));
 const report=await coordinator.run(async(item,index)=>{
  assert.equal(store.confirmed!.items[index].status,'running');assert.equal(store.confirmations,2+index*2);
  assert.equal(Object.isFrozen(item),true);assert.equal(item.path,source(index).path);calls.push(index);
  return{status:index===1?'already-present':'confirmed'};
 },()=>true,report=>progress.push(report));
 assert.deepEqual(calls,[0,1,2]);assert.deepEqual(statuses(report),['confirmed','already-present','confirmed']);
 assert.equal(report.phase,'completed');assert.equal(report.readOnly,true);assert.equal(report.journalConfirmed,true);
 assert.deepEqual(report.counts,{'not-started':0,running:0,confirmed:2,'already-present':1,'not-written':0,unknown:0});
 assert.equal(store.history.length,7);assert.ok(progress.some(value=>value.items[1].status==='running'));
});
for(const outcome of ['not-written','unknown'] as const)test(`partial success stops at the first typed ${outcome} without touching later records`,async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(),()=>true);let calls=0;
 const report=await coordinator.run(async()=>{if(calls++===0)return{status:'confirmed'};throw new CollectionBatchExecutionError(outcome,'明确的逐条诊断');},()=>true);
 assert.equal(calls,2);assert.deepEqual(statuses(report),['confirmed',outcome,'not-started']);
 assert.equal(report.phase,outcome==='unknown'?'review-required':'stopped');assert.deepEqual(store.confirmed!.items,report.items);
 await coordinator.run(async()=>{throw Error('must never rerun');},()=>true);assert.equal(calls,2);
});
test('an untyped executor rejection or malformed receipt is unknown, never presumed not-written',async()=>{
 for(const malformed of [false,true]){
  const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(),()=>true);
  const report=await coordinator.run(async()=>{if(malformed)return{status:'failed'} as never;throw Error('ack missing');},()=>true);
  assert.deepEqual(statuses(report),['unknown','not-started','not-started']);assert.equal(report.phase,'review-required');
 }
});
test('already-present delivery is a confirmed no-op and retained target diagnostics never contain live tokens',async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);
 const input={...manifest(2),operation:'deliver' as const,target:{name:'目标白板',path:'Boards/target.md',groupId:'group-1',groupName:'收集',key:'live-token'},items:manifest(2).items.map(item=>({...item,body:'must not be persisted'}))};
 await coordinator.start(input,()=>true);const report=await coordinator.run(async()=>({status:'already-present'}),()=>true);
 assert.deepEqual(statuses(report),['already-present','already-present']);assert.equal(JSON.stringify(store.confirmed).includes('live-token'),false);assert.equal(JSON.stringify(store.confirmed).includes('must not be persisted'),false);
 assert.deepEqual(report.target,{name:'目标白板',path:'Boards/target.md',groupId:'group-1',groupName:'收集'});
});
test('a confirmed lost acknowledgement from executor and journal remains confirmed without a second external write',async()=>{
 const store=new Store();store.modes.set(2,'lost-ack-confirmed');store.modes.set(3,'lost-ack-confirmed');
 const coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(1),()=>true);let calls=0;
 const report=await coordinator.run(async()=>{calls++;return{status:'confirmed',message:'已通过只读核对确认原生写入'};},()=>true);
 assert.equal(calls,1);assert.equal(report.items[0].status,'confirmed');assert.equal(report.journalConfirmed,true);assert.equal(store.confirmations,3);
});
test('initial journal failure returns a read-only unstarted report and cannot execute',async()=>{
 const store=new Store();store.modes.set(1,'fail-before');const coordinator=new CollectionBatchCoordinator(store);
 const report=await coordinator.start(manifest(),()=>true);assert.equal(report.readOnly,true);assert.equal(report.journalConfirmed,false);assert.deepEqual(statuses(report),['not-started','not-started','not-started']);
 await coordinator.run(async()=>{throw Error('must not execute');},()=>true);assert.equal(store.disk,null);assert.equal(store.attempts,1);
});
test('failure to confirm the next running marker stops before any external call',async()=>{
 const store=new Store();store.modes.set(2,'unknown-after-write');const coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(),()=>true);
 let calls=0;const report=await coordinator.run(async()=>{calls++;return{status:'confirmed'};},()=>true);
 assert.equal(calls,0);assert.deepEqual(statuses(report),['not-started','not-started','not-started']);assert.equal(report.journalConfirmed,false);
 assert.equal(store.disk!.items[0].status,'running');assert.equal(store.confirmed!.items[0].status,'not-started');assert.ok(report.warning);
});
test('result journal failure retains the observed receipt, stops the batch and reopens the durable running marker as unknown',async()=>{
 const store=new Store();store.modes.set(3,'fail-before');const coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(),()=>true);let calls=0;
 const report=await coordinator.run(async()=>{calls++;return{status:'confirmed'};},()=>true);
 assert.equal(calls,1);assert.deepEqual(statuses(report),['confirmed','not-started','not-started']);assert.equal(report.journalConfirmed,false);assert.equal(report.readOnly,true);assert.ok(report.warning);
 const before=clone(store.disk),reopened=new CollectionBatchCoordinator(store),loaded=await reopened.load();
 assert.deepEqual(statuses(loaded.report!),['unknown','not-started','not-started']);assert.equal(loaded.report!.readOnly,true);
 await reopened.run(async()=>{throw Error('reopen must not execute');},()=>true);assert.deepEqual(store.disk,before);assert.equal(store.attempts,3);
});
test('a journal failure after an already confirmed prefix never restarts or erases that prefix',async()=>{
 const store=new Store();store.modes.set(4,'fail-before');const coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(),()=>true);let calls=0;
 const report=await coordinator.run(async()=>{calls++;return{status:'confirmed'};},()=>true);
 assert.equal(calls,1);assert.deepEqual(statuses(report),['confirmed','not-started','not-started']);assert.equal(store.confirmed!.items[0].status,'confirmed');assert.equal(report.journalConfirmed,false);
});
test('cancellation before run performs no external work and leaves all entries not-started',async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(),()=>true);
 const report=await coordinator.run(async()=>{throw Error('must not execute');},()=>false);
 assert.equal(report.phase,'cancelled');assert.deepEqual(statuses(report),['not-started','not-started','not-started']);assert.equal(store.confirmed!.phase,'cancelled');
});
test('navigation during running-marker persistence prevents that record from starting',async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);let current=true;await coordinator.start(manifest(),()=>current);
 store.beforeWrite=async(_value,attempt)=>{if(attempt===2)current=false;};
 const report=await coordinator.run(async()=>{throw Error('must not execute');},()=>current);
 assert.equal(report.phase,'cancelled');assert.deepEqual(statuses(report),['not-started','not-started','not-started']);assert.equal(store.confirmed!.items[0].status,'not-started');
});
for(const status of ['confirmed','already-present'] as const)test(`cancellation during an external ${status} operation still awaits and journals its real receipt`,async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);let current=true,release!:()=>void,calls=0;const gate=new Promise<void>(resolve=>{release=resolve;});
 await coordinator.start(manifest(),()=>current);
 const work=coordinator.run(async()=>{calls++;await gate;return{status};},()=>current);await tick();assert.equal(calls,1);current=false;
 let finished=false;void work.then(()=>{finished=true;});await tick();assert.equal(finished,false);release();const report=await work;
 assert.equal(calls,1);assert.deepEqual(statuses(report),[status,'not-started','not-started']);assert.equal(report.phase,'cancelled');assert.equal(report.journalConfirmed,true);assert.equal(store.confirmed!.items[0].status,status);
});
test('a failure in the already-started operation remains unknown even when navigation also cancels',async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);let current=true;await coordinator.start(manifest(),()=>true);
 const report=await coordinator.run(async()=>{current=false;throw Error('write result uncertain');},()=>current);
 assert.equal(report.items[0].status,'unknown');assert.equal(report.phase,'review-required');assert.equal(store.confirmed!.items[0].status,'unknown');
});
for(const phase of ['prepared','running','completed'] as const)test(`loading ${phase} logs is read-only and never resumes writes`,async()=>{
 const store=new Store(),original=new CollectionBatchCoordinator(store);await original.start(manifest(1),()=>true);
 if(phase==='running'){store.confirmed!.phase='running';store.confirmed!.items[0].status='running';store.disk=clone(store.confirmed);}
 if(phase==='completed')await original.run(async()=>({status:'confirmed'}),()=>true);
 const before=JSON.stringify(store.disk),writes=store.attempts,reopened=new CollectionBatchCoordinator(store),loaded=await reopened.load();
 assert.equal(loaded.report!.readOnly,true);assert.equal(loaded.report!.items[0].status,phase==='running'?'unknown':phase==='completed'?'confirmed':'not-started');
 await reopened.run(async()=>{throw Error('no automatic retry');},()=>true);assert.equal(JSON.stringify(store.disk),before);assert.equal(store.attempts,writes);
 await assert.rejects(reopened.start(manifest(),()=>true),/已使用/);
});
test('blocked storage exposes its last confirmed report only and does not overwrite it',async()=>{
 const store=new Store(),first=new CollectionBatchCoordinator(store);await first.start(manifest(),()=>true);store.blocked='external canonical conflict';
 const second=new CollectionBatchCoordinator(store),loaded=await second.load();assert.equal(loaded.report!.journalConfirmed,false);assert.match(loaded.warning!,/external/);
 await second.run(async()=>{throw Error('must not execute');},()=>true);assert.equal(store.attempts,1);
});
test('an existing journal path is never reused for a new batch, including an unknown old result',async()=>{
 const store=new Store(),first=new CollectionBatchCoordinator(store);await first.start(manifest(1),()=>true);await first.run(async()=>{throw Error('unknown');},()=>true);
 const before=clone(store.disk),writes=store.attempts,second=new CollectionBatchCoordinator(store),report=await second.start({...manifest(),id:'another-batch'},()=>true);
 assert.equal(report.id,'batch-fixture');assert.equal(report.readOnly,true);assert.match(report.warning!,/未覆盖/);assert.deepEqual(store.disk,before);assert.equal(store.attempts,writes);
});
test('manifest and progress snapshots cannot mutate the frozen identities or later report',async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store),input=manifest(1);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});store.beforeRead=()=>gate;
 const starting=coordinator.start(input,()=>true,report=>{report.items[0].source.path='changed.md';throw Error('observer failure');});
 input.items[0].path='caller-mutated.md';release();await starting;
 const report=await coordinator.run(async item=>{assert.equal(item.path,'收集/记录-0.md');return{status:'confirmed'};},()=>true,()=>{throw Error('observer failure');});
 report.items[0].source.path='returned-mutated.md';assert.equal(coordinator.report!.items[0].source.path,'收集/记录-0.md');assert.equal(store.confirmed!.items[0].source.path,'收集/记录-0.md');
});
test('duplicate run calls share the same in-flight work instead of duplicating execution',async()=>{
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(1),()=>true);let calls=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const executor=async()=>{calls++;await gate;return{status:'confirmed' as const};};
 const first=coordinator.run(executor,()=>true),second=coordinator.run(executor,()=>true);assert.equal(first,second);await tick();assert.equal(calls,1);release();await first;assert.equal(calls,1);
});
test('selection and persisted diagnostics are bounded, unique and free of unknown fields',async()=>{
 for(const input of [manifest(0),manifest(25),{...manifest(2),items:[source(0),source(0)]},{...manifest(1),items:[{...source(0),path:'../escape.md'}]},{...manifest(1),items:[{...source(0),expectedArchived:'false'}]}]){
  const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await assert.rejects(coordinator.start(input as CollectionBatchManifest,()=>true),/有效/);assert.equal(store.attempts,0);
 }
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(24),()=>true);
 const report=await coordinator.run(async()=>{throw new CollectionBatchExecutionError('not-written','诊断'.repeat(1000));},()=>true);
 assert.equal(report.items.length,24);assert.ok(report.items[0].message!.length<=240);
 for(const edit of [(j:CollectionBatchJournal)=>Object.assign(j,{body:'private'}),(j:CollectionBatchJournal)=>Object.assign(j.items[0].source,{body:'private'}),(j:CollectionBatchJournal)=>Object.assign(j,{target:{name:'board',path:'b.md',key:'live-token'}})]){const invalid=clone(store.confirmed!);edit(invalid);assert.equal(isCollectionBatchJournal(invalid),false);}
});
test('astral and boundary-split diagnostics fit the persisted UTF-16 bound without changing a confirmed result',async()=>{
 for(const message of ['😀'.repeat(121),'x'.repeat(239)+'😀', '😀'.repeat(121)+' confirmation']){
  const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(2),()=>true);
  const report=await coordinator.run(async()=>({status:'confirmed',message}),()=>true);
  assert.equal(report.phase,'completed');assert.equal(report.journalConfirmed,true);assert.deepEqual(statuses(report),['confirmed','confirmed']);
  assert.ok(report.items.every(item=>item.message!.length<=240&&!/[\uD800-\uDBFF]$/u.test(item.message!)));
 }
 const store=new Store(),coordinator=new CollectionBatchCoordinator(store);await coordinator.start(manifest(),()=>true);
 const report=await coordinator.run(async()=>{throw new CollectionBatchExecutionError('not-written','😀'.repeat(121));},()=>true);
 assert.equal(report.items[0].status,'not-written');assert.equal(report.journalConfirmed,true);assert.equal(report.items[0].message!.length,240);
});

function nativeStore(){
 const path='.obsidian/qa-batches/batch-fixture.json',directory='.obsidian/qa-batches',files=new Map<string,string>();let copies=0,processes=0,token=0;
 const control:{lostAck?:boolean;failResult?:'before'|'corrupt'}={};
 const adapter:CollectionJsonAdapter={
  exists:async name=>name===directory||files.has(name),list:async()=>({files:[...files.keys()]}),
  read:async name=>{if(!files.has(name))throw Error('missing');return files.get(name)!;},
  write:async(name,raw)=>{files.set(name,raw);},remove:async name=>{files.delete(name);},
  copy:async(from,to)=>{copies++;assert.equal(files.has(to),false);files.set(to,files.get(from)!);if(control.lostAck)throw Error('copy acknowledgement lost');},
  process:async(name,change)=>{
   processes++;if(processes===2&&control.failResult==='before')throw Error('result journal refused');
   const raw=change(files.get(name)!);files.set(name,processes===2&&control.failResult==='corrupt'?'{':raw);
   if(control.lostAck)throw Error('process acknowledgement lost');return raw;
  },
 };
 return{path,files,control,counts:()=>({copies,processes}),store:()=>new CollectionJsonStore(adapter,path,()=>`batch-test-${++token}`,isCollectionBatchJournal)};
}
test('production JSON store exclusively creates and CAS-updates real batch journals, including confirmed lost acknowledgements',async()=>{
 const f=nativeStore();f.control.lostAck=true;const coordinator=new CollectionBatchCoordinator(f.store());await coordinator.start(manifest(2),()=>true);let calls=0;
 const report=await coordinator.run(async(_item,index)=>{calls++;const disk=JSON.parse(f.files.get(f.path)!);assert.equal(disk.items[index].status,'running');return{status:'confirmed',message:'😀'.repeat(121)};},()=>true);
 assert.equal(report.phase,'completed');assert.equal(report.journalConfirmed,true);assert.equal(calls,2);assert.deepEqual(f.counts(),{copies:1,processes:4});
 assert.equal(JSON.parse(f.files.get(f.path)!).items[1].status,'confirmed');
});
for(const failResult of ['before','corrupt'] as const)test(`production JSON result-log ${failResult} failure stops later actions and reopens read-only without replay`,async()=>{
 const f=nativeStore();f.control.failResult=failResult;const coordinator=new CollectionBatchCoordinator(f.store());await coordinator.start(manifest(),()=>true);let calls=0;
 const report=await coordinator.run(async()=>{calls++;return{status:'confirmed'};},()=>true);
 assert.equal(calls,1);assert.equal(report.journalConfirmed,false);assert.deepEqual(statuses(report),['confirmed','not-started','not-started']);
 const disk=f.files.get(f.path),before=[...f.files],reopened=new CollectionBatchCoordinator(f.store()),loaded=await reopened.load();
 assert.equal(loaded.report!.readOnly,true);assert.deepEqual(statuses(loaded.report!),['unknown','not-started','not-started']);
 await reopened.run(async()=>{throw Error('reopen must be read-only');},()=>true);
 assert.equal(f.files.get(f.path),disk);assert.deepEqual([...f.files],before);assert.deepEqual(f.counts(),{copies:1,processes:2});
});
