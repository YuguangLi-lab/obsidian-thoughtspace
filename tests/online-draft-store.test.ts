import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineDraftStore,IndexedOnlineDraftStorage,onlineDraftDatabaseName,validOnlineDraft,type OnlineDraftStorage,type StoredOnlineDraft,type OnlineDraftStamp,type OnlineDraftSnapshot} from '../src/online-draft-store';
const source='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const other='https://www.youtube.com/watch?v=abcdefghijk';
const clock={setTimeout:()=>1,clearTimeout:()=>{}};
const deferred=<T,>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const data=(patch:Partial<OnlineDraftSnapshot>={}):OnlineDraftSnapshot=>({id:'draft-one',source,time:83,text:'第一行\n第二行\n',mode:'manual',phase:'editing',...patch});
class Storage implements OnlineDraftStorage {
 rows=new Map<string,unknown>();writes:StoredOnlineDraft[]=[];deletes:string[]=[];closed=0;
 readError=false;writeError=false;deleteError=false;writeGate?:ReturnType<typeof deferred<void>>;
 async read(){if(this.readError)throw Error('read failed');return [...this.rows.values()].map(value=>structuredClone(value));}
 async replace(value:StoredOnlineDraft,expected?:OnlineDraftStamp){
  if(this.writeGate){const gate=this.writeGate;this.writeGate=undefined;await gate.promise;}
  if(this.writeError)throw Error('write failed');const current=this.rows.get(value.id) as StoredOnlineDraft|undefined;
  assert.deepEqual(current?{revision:current.revision,lease:current.lease}:undefined,expected,'transaction compares current revision and lease');
  if([...this.rows.values()].some(row=>(row as StoredOnlineDraft).id!==value.id&&(row as StoredOnlineDraft).key===value.key))throw Error('unique source/note slot');
  this.rows.set(value.id,structuredClone(value));this.writes.push(structuredClone(value));
 }
 async remove(id:string,expected?:OnlineDraftStamp){
  if(this.deleteError)throw Error('delete failed');const current=this.rows.get(id) as StoredOnlineDraft|undefined;
  assert.deepEqual(current?{revision:current.revision,lease:current.lease}:undefined,expected,'remove owns exact revision and lease');
  this.rows.delete(id);this.deletes.push(id);
 }
 close(){this.closed++;}
}
const store=(storage:Storage)=>new OnlineDraftStore(storage,()=>{},clock);
async function stored(storage=new Storage(),value=data()){const s=store(storage);await s.load();s.stage(value);await s.flush();return{storage,s};}
test('editing Blob/text/time survive a separate store and exact source/note binding',async()=>{
 const image=new Blob(['PNG'],{type:'image/png'}),{storage,s}=await stored(undefined,data({image,note:'中文/原始笔记.md'}));
 const next=store(storage);await next.load();const restored=next.recover(source,'中文/原始笔记.md')!;
 assert.equal(restored.phase,'editing');assert.equal(restored.text,'第一行\n第二行\n');assert.equal(restored.time,83);assert.equal(await restored.image!.text(),'PNG');assert.equal(next.recover(other,'中文/原始笔记.md'),undefined);assert.equal(next.recover(source,'其他.md'),undefined);await s.dispose().catch(()=>{});
});
test('load pending cannot stage or overwrite the existing slot',async()=>{
 const storage=new Storage(),held=deferred<unknown[]>();storage.read=()=>held.promise;const s=store(storage),loading=s.load();assert.throws(()=>s.stage(data()),/尚未就绪/);assert.equal(storage.writes.length,0);held.resolve([]);await loading;
});
test('held old flush cannot overwrite a newer queued snapshot',async()=>{
 const {storage,s}=await stored(),held=deferred<void>();storage.writeGate=held;s.stage(data({text:'old'}));const first=s.flush();await Promise.resolve();await Promise.resolve();s.stage(data({text:'newest',time:91}));held.resolve();await first;await s.flush();assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).text,'newest');assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).time,91);
});
test('failed write retains newest revision for retry, not the failed older text',async()=>{
 const {storage,s}=await stored();storage.writeError=true;s.stage(data({text:'failed'}));await assert.rejects(s.flush());s.stage(data({text:'retry latest'}));storage.writeError=false;await s.flush();assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).text,'retry latest');
});
test('new host lease rejects late old-host cleanup and write',async()=>{
 const {storage,s}=await stored(),next=store(storage);await next.load();next.stage(data({text:'new host'}));await next.flush();await assert.rejects(s.discard('draft-one'));s.stage(data({text:'stale'}));await assert.rejects(s.flush());assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).text,'new host');assert.equal(storage.deletes.length,0);
});
test('same source different note drafts remain isolated; alias collision never overwrites',async()=>{
 const {storage,s}=await stored(undefined,data({note:'A.md'}));s.stage(data({id:'draft-two',note:'B.md',text:'second'}));await s.flush();assert.throws(()=>s.stage(data({note:'B.md'})),/另一草稿/);assert.equal((storage.rows.get('draft-two') as StoredOnlineDraft).text,'second');assert.equal(s.recover(source,'A.md')!.id,'draft-one');
});
test('unbound record can bind confirmed note without changing draft id',async()=>{
 const {storage,s}=await stored();s.stage(data({phase:'committed',note:'真实笔记.md'}));await s.flush();assert.equal(s.recover(source),undefined);assert.equal(s.recover(source,'真实笔记.md')!.id,'draft-one');await s.discard('draft-one');assert.equal(storage.rows.size,0);
});
test('cancel deletion failure retains original text/image/id and succeeds only after retry',async()=>{
 const {storage,s}=await stored(undefined,data({image:new Blob(['PNG'],{type:'image/png'})}));storage.deleteError=true;await assert.rejects(s.discard('draft-one'));assert.equal(s.recover(source)!.id,'draft-one');assert.equal(await s.recover(source)!.image!.text(),'PNG');storage.deleteError=false;await s.discard('draft-one');assert.equal(s.recover(source),undefined);assert.throws(()=>s.stage(data()),/结束/);
});
test('unknown schema and invalid Blob/path records are retained untouched',async()=>{
 const {storage,s}=await stored();await s.dispose();const invalid=[{id:'future',version:9}, {...storage.rows.get('draft-one') as StoredOnlineDraft,id:'bad',note:'../escape.md'}, {...storage.rows.get('draft-one') as StoredOnlineDraft,id:'badimage',image:{type:'image/png',size:5}}];for(const row of invalid)storage.rows.set(row.id,row);
 const next=store(storage);await next.load();for(const row of invalid)assert.deepEqual(storage.rows.get(row.id),row);assert.match(next.error,/版本/);assert.equal(storage.deletes.length,0);
});
test('read failure is not protected and does not overwrite unknown records',async()=>{
 const {storage}=await stored();storage.readError=true;const s=store(storage);await s.load();assert.match(s.error,/read failed/);assert.throws(()=>s.stage(data({id:'new-id',text:'memory'})));await assert.rejects(s.flush());assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).text,data().text);
});
test('failed prepared preserves disk editing and next session restores editing',async()=>{
 const {storage,s}=await stored();storage.writeError=true;s.stage(data({phase:'prepared'}));await assert.rejects(s.flush());storage.writeError=false;const next=store(storage);await next.load();assert.equal(next.recover(source)!.phase,'editing');
});
test('prepared and committed persist their phase and exact note for recovery',async()=>{
 for(const phase of ['prepared','committed']as const){const {storage}=await stored(undefined,data({phase,note:phase==='committed'?'A.md':undefined}));const next=store(storage);await next.load();const recovered=next.recover(source,phase==='committed'?'A.md':undefined)!;assert.equal(recovered.phase,phase);assert.equal(recovered.id,'draft-one');}
});
test('dispose refuses new staging and rejects late discard without touching a new host row',async()=>{
 const {storage,s}=await stored();await s.dispose();assert.throws(()=>s.stage(data()));await assert.rejects(s.discard('draft-one'));assert.equal(storage.deletes.length,0);assert.equal(storage.closed,1);
});
test('public vault namespace is durable, checked, and never rewrites an unknown value',()=>{
 let value:unknown;const app={loadLocalStorage:()=>value,saveLocalStorage:(_key:string,next:unknown)=>{value=next;}};
 assert.equal(onlineDraftDatabaseName(app,()=> 'vault-one'),'thoughtspace-online-drafts-v1:vault-one');assert.equal(onlineDraftDatabaseName(app,()=>{throw Error('must not regenerate');}),'thoughtspace-online-drafts-v1:vault-one');value={unknown:true};assert.throws(()=>onlineDraftDatabaseName(app));assert.deepEqual(value,{unknown:true});assert.throws(()=>onlineDraftDatabaseName({loadLocalStorage:()=>undefined,saveLocalStorage:()=>{}},()=> 'not-saved'),/未保存/);
});
test('validator rejects source aliases, path escapes, invalid times and forged Blob objects',async()=>{
 const {storage}=await stored(),row=storage.rows.get('draft-one') as StoredOnlineDraft;assert.equal(validOnlineDraft(row),true);
 for(const patch of [{source:source+'&t=20'},{time:NaN},{time:-1},{mode:'other'},{mode:['synced']},{phase:['editing']},{revision:0},{note:'/x.md'},{note:'a/../b.md'},{phase:'committed'},{image:{type:'image/png',size:2}},{version:2}])assert.equal(validOnlineDraft({...row,...patch}),false,JSON.stringify(patch));
});
test('IDB transaction completion, rather than request success, acknowledges writes; abort rejects',async()=>{
 // Exercise the actual adapter against only the IDB event boundary, without touching a browser or disk.
 let tx:any,request:any,open:any;const current={revision:4,lease:'old'};
 const db={onversionchange:null,close(){},transaction(){tx={oncomplete:null,onabort:null,onerror:null,error:null,abort(){this.onabort();},objectStore(){return{get(){request={result:current,onsuccess:null};return request;},put(){return{};},delete(){return{};}};}};return tx;}};
 const factory={open(){open={onsuccess:null,onupgradeneeded:null,onerror:null,onblocked:null,result:db};return open;}};
 const adapter=new IndexedOnlineDraftStorage(factory as unknown as IDBFactory,'synthetic');let settled=false;const next={...data(),version:1,key:JSON.stringify([source,'']),revision:5,lease:'new',updatedAt:1} as StoredOnlineDraft;
 const write=adapter.replace(next,{revision:4,lease:'old'}).then(()=>{settled=true;});open.onsuccess();await Promise.resolve();await Promise.resolve();request.onsuccess();await Promise.resolve();assert.equal(settled,false);tx.oncomplete();await write;assert.equal(settled,true);
 const rejected=adapter.remove(next.id,{revision:999,lease:'other'});await Promise.resolve();await Promise.resolve();request.onsuccess();await assert.rejects(rejected,/接管/);
});
test('an exact saved draft id recovers its bound note when layout lags, but never another explicit note',async()=>{
 const {storage}=await stored(undefined,data({note:'saved.md',phase:'committed'})),next=store(storage);await next.load();assert.equal(next.recover(source,undefined,'draft-one')!.note,'saved.md');assert.equal(next.recover(source,'wrong.md','draft-one'),undefined);assert.equal(next.recover(other,undefined,'draft-one'),undefined);
});
test('failed or blocked IDB open can retry; a late abandoned connection is closed',async()=>{
 const requests:any[]=[];let closes=0;
 const db={onversionchange:null,close(){closes++;},transaction(){const tx:any={oncomplete:null,onabort:null,onerror:null,error:null,objectStore(){return{getAll(){queueMicrotask(()=>tx.oncomplete());return{result:[],error:null};}};}};return tx;}};
 const adapter=new IndexedOnlineDraftStorage({open(){const request={result:db,error:Error('temporary'),onsuccess:null,onerror:null,onblocked:null};requests.push(request);return request;}} as unknown as IDBFactory,'synthetic');
 const first=adapter.read();requests[0].onerror();await assert.rejects(first,/temporary/);const second=adapter.read();assert.equal(requests.length,2);requests[1].onblocked();await assert.rejects(second,/占用/);requests[1].onsuccess();assert.equal(closes,1);
 const third=adapter.read();assert.equal(requests.length,3);requests[2].onsuccess();assert.deepEqual(await third,[]);
});
test('read retry after temporary storage failure saves only current staged data',async()=>{
 const storage=new Storage();storage.readError=true;const s=store(storage);await s.load();assert.throws(()=>s.stage(data({text:'latest unprotected'})));storage.readError=false;await s.flush();assert.equal(s.state('draft-one'),'saved');assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).text,'latest unprotected');
});
test('claim failure marks recovered content as unprotected rather than indefinitely pending',async()=>{
 const {storage}=await stored();storage.writeError=true;const next=store(storage);await next.load();assert.equal(next.recover(source)!.text,data().text);assert.equal(next.state('draft-one'),'error');assert.throws(()=>next.stage(data()),/write failed/);await assert.rejects(next.flush());assert.equal(storage.deletes.length,0);
});
test('targeted prepared flush preserves the other draft debounce and eventually stores both',async()=>{
 let sequence=0;const tasks=new Map<number,()=>void>(),timers={setTimeout:(fn:()=>void)=>{tasks.set(++sequence,fn);return sequence;},clearTimeout:(id:number)=>{tasks.delete(id);}};const storage=new Storage(),s=new OnlineDraftStore(storage,()=>{},timers);await s.load();s.stage(data({id:'first',note:'A.md',phase:'prepared'}));s.stage(data({id:'second',note:'B.md',text:'other window text'}));await s.flush('first');assert.equal(s.state('second'),'pending');assert.equal(tasks.size,1);assert.equal(storage.rows.has('second'),false);for(const [id,task]of tasks){tasks.delete(id);task();}await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(s.state('second'),'saved');assert.equal((storage.rows.get('second') as StoredOnlineDraft).text,'other window text');assert.equal(tasks.size,0);
});
test('a full flush failure marks every unwritten draft as error and never starts an automatic retry loop',async()=>{
 let sequence=0;const tasks=new Map<number,()=>void>(),timers={setTimeout:(fn:()=>void)=>{tasks.set(++sequence,fn);return sequence;},clearTimeout:(id:number)=>{tasks.delete(id);}};const storage=new Storage(),s=new OnlineDraftStore(storage,()=>{},timers);await s.load();s.stage(data({id:'first',note:'A.md'}));s.stage(data({id:'second',note:'B.md'}));storage.writeError=true;await assert.rejects(s.flush());assert.equal(s.state('first'),'error');assert.equal(s.state('second'),'error');assert.equal(tasks.size,0);assert.equal(storage.rows.size,0);storage.writeError=false;await s.flush();assert.equal(storage.rows.size,2);
});
test('debounced failure reports once, keeps exact error and draft, and still reports a later failure after recovery',async()=>{
 for(const error of [Error('quota'), 'storage string rejection', {name:'UnknownError'}]){
  let scheduled:()=>void=()=>{},calls:{error:unknown;ids?:readonly string[]}[]=[];
  const storage=new Storage(),original=storage.replace.bind(storage),s=new OnlineDraftStore(storage,(error,ids)=>calls.push({error,ids}),{setTimeout:fn=>{scheduled=fn;return 1;},clearTimeout:()=>{}});
  await s.load();storage.replace=async()=>{throw error;};s.stage(data());scheduled();await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);assert.equal(calls[0].error,error);assert.deepEqual(calls[0].ids,['draft-one']);assert.equal(s.state('draft-one'),'error');assert.equal(storage.rows.size,0);
  storage.replace=original;await s.flush();assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).text,data().text);
  storage.replace=async()=>{throw error;};s.stage(data({text:'new failure'}));scheduled();await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(calls.length,2,'same underlying Error may fail again after successful recovery');
 }
});
test('timer catches an otherwise unreported disposed flush failure once',async()=>{
 let scheduled:()=>void=()=>{};const calls:unknown[]=[],storage=new Storage(),s=new OnlineDraftStore(storage,error=>calls.push(error),{setTimeout:fn=>{scheduled=fn;return 1;},clearTimeout:()=>{}});
 await s.load();s.stage(data());const pendingTimer=scheduled;await s.dispose();pendingTimer();await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.match((calls[0] as Error).message,/会话已结束/);assert.equal((storage.rows.get('draft-one') as StoredOnlineDraft).text,data().text);
});
test('write feedback names all affected drafts; load failures have no view-specific coverage',async()=>{
 const storage=new Storage(),calls:(readonly string[]|undefined)[]=[],s=new OnlineDraftStore(storage,(_error,ids)=>calls.push(ids),clock);await s.load();s.stage(data({id:'first',note:'A.md'}));s.stage(data({id:'second',note:'B.md'}));storage.writeError=true;await assert.rejects(s.flush());assert.deepEqual(calls[0],['first','second']);assert.equal(calls.length,1);assert.equal(storage.rows.size,0);
 await assert.rejects(s.flush('second'));assert.deepEqual(calls.at(-1),['second']);const unreadable=new Storage();unreadable.readError=true;const next=new OnlineDraftStore(unreadable,(_error,ids)=>calls.push(ids),clock);await next.load();assert.equal(calls.at(-1),undefined);
});

test('recovery center snapshots do not write, claim leases or label pending input as durable',async()=>{
 const {storage,s}=await stored(),writes=storage.writes.length;s.stage(data({text:'volatile new text'}));
 const entries=s.recoverySnapshot();assert.equal(storage.writes.length,writes);assert.deepEqual(entries.map(v=>[v.storage,v.text]),[['memory','volatile new text'],['checkpoint','第一行\n第二行\n']]);
 storage.writeError=true;await assert.rejects(s.flush());assert.equal(s.recoverySnapshot()[0].storage,'memory');assert.equal(storage.deletes.length,0);
});
