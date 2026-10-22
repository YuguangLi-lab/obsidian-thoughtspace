import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollectionJsonStore,CollectionJsonStoreError,COLLECTION_JSON_MAX_BYTES,isCollectionJsonPath,collectionJsonCanonical,type CollectionJsonAdapter} from '../src/collection-json-store';

const path='.obsidian/plugins/thoughtspace/collection-library/test.json',directory=path.slice(0,path.lastIndexOf('/'));
type Value={version:1;value:string};
const value=(text:string):Value=>({version:1,value:text});
const source=(text:string)=>JSON.stringify(value(text));
const valid=(raw:unknown):raw is Value=>!!raw&&typeof raw==='object'&&Object.keys(raw).length===2&&'version'in raw&&raw.version===1&&'value'in raw&&typeof raw.value==='string';
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
async function until(predicate:()=>boolean){for(let i=0;i<100&&!predicate();i++)await Promise.resolve();assert.ok(predicate());}
function fixture(initial?:string){
 const files=new Map<string,string>();if(initial!==undefined)files.set(path,initial);
 let serial=0,active=true,processes=0,copies=0,reads=0,canonicalWrites=0;const writes:string[]=[],removes:string[]=[];
 const control:{directoryMissing?:boolean;beforeProcess?:()=>void;beforeCopy?:()=>void;afterCanonical?:()=>void;processGate?:Promise<void>;copyGate?:Promise<void>;readFailure?:boolean;failure?:'before'|'after';damage?:string;size?:number;materialWriteFailure?:boolean}={};
 const adapter:CollectionJsonAdapter={
  exists:async name=>name===directory?!control.directoryMissing:files.has(name),
  list:async name=>{assert.equal(name,directory);assert.ok(!control.directoryMissing);return{files:[...files.keys()]};},
  stat:async name=>files.has(name)?{size:control.size??new TextEncoder().encode(files.get(name)!).byteLength}:null,
  read:async name=>{reads++;if(name===path&&control.readFailure)throw Error('read unavailable');if(!files.has(name))throw Error('absent');return files.get(name)!;},
  write:async(name,text)=>{writes.push(name);if(control.materialWriteFailure)throw Error('material refused');files.set(name,text);},
  copy:async(from,to)=>{copies++;await control.copyGate;control.beforeCopy?.();if(files.has(to))throw Error('destination exists');if(control.failure==='before')throw Error('copy refused');files.set(to,control.damage??files.get(from)!);canonicalWrites++;control.afterCanonical?.();if(control.failure==='after')throw Error('lost acknowledgment');},
  process:async(name,change)=>{processes++;await control.processGate;control.beforeProcess?.();if(control.failure==='before')throw Error('process refused');const next=change(files.get(name)!);files.set(name,control.damage??next);canonicalWrites++;control.afterCanonical?.();if(control.failure==='after')throw Error('lost acknowledgment');return next;},
  remove:async name=>{removes.push(name);files.delete(name);},
 };
 const store=()=>new CollectionJsonStore(adapter,path,()=>`token-${++serial}`,valid);
 return{files,adapter,control,store,current:()=>active,cancel:()=>{active=false;},counts:()=>({processes,copies,reads,canonicalWrites,writes,removes})};
}
const outcome=(expected:'not-written'|'unknown')=>(error:unknown)=>{assert.ok(error instanceof CollectionJsonStoreError);assert.equal(error.outcome,expected);return true;};

test('only fixed relative JSON paths are accepted',()=>{
 assert.equal(isCollectionJsonPath(path),true);
 for(const bad of ['/tmp/a.json','C:/x/a.json','../a.json','x/../a.json','x//a.json','x\\a.json','x/./a.json','x/a.json\n','x/a.txt','x/.json'])assert.throws(()=>new CollectionJsonStore(fixture().adapter,bad,()=>'',valid),/路径/);
});
test('strict recovery material discovery returns its original canonical without trusting contents',()=>{
 assert.equal(collectionJsonCanonical(path),path);assert.equal(collectionJsonCanonical(path+'.previous-1000000000001-token.json'),path);assert.equal(collectionJsonCanonical(path+'.pending-token.tmp'),path);
 for(const bad of ['/tmp/test.json.pending-token.tmp','../test.json.previous-1000000000001-token.json',path+'.pending-../token.tmp',path+'.previous-9999999999999999-token.json'])assert.equal(collectionJsonCanonical(bad),undefined);
 assert.notEqual(collectionJsonCanonical(path+'.previous-bad-token.json'),path);
});
test('missing directory read is empty and never creates a directory or file',async()=>{
 const f=fixture();f.control.directoryMissing=true;assert.deepEqual(await f.store().read(),{value:null});assert.equal(f.counts().reads,0);assert.equal(f.counts().writes.length,0);
});
test('write requires a verified initial read and validates its document',async()=>{
 const f=fixture(),s=f.store();await assert.rejects(s.write(value('x'),f.current),outcome('not-written'));
 await s.read();await assert.rejects(s.write({version:2,value:'x'} as unknown as Value,f.current),outcome('not-written'));assert.equal(f.files.size,0);
});
test('first creation exclusively copies a verified temporary and returns isolated data',async()=>{
 const f=fixture(),s=f.store();await s.read();await s.write(value('first'),f.current);
 assert.equal(f.files.get(path),source('first'));assert.equal(f.counts().copies,1);assert.equal(f.counts().processes,0);assert.equal(f.counts().canonicalWrites,1);
 const read=await s.read();read.value!.value='mutated caller';assert.equal((await s.read()).value!.value,'first');assert.deepEqual([...f.files.keys()],[path]);
});
test('copy refuses a canonical created after the absence check without overwriting it',async()=>{
 const f=fixture(),s=f.store();await s.read();f.control.beforeCopy=()=>f.files.set(path,source('other owner'));
 await assert.rejects(s.write(value('mine'),f.current),outcome('unknown'));assert.equal(f.files.get(path),source('other owner'));assert.equal(f.counts().canonicalWrites,0);
 const read=await s.read();assert.equal(read.value,null);assert.ok(read.blocked);assert.ok([...f.files.keys()].some(name=>name.endsWith('.tmp')));
});
test('an existing document updates using callback CAS and retains its confirmed previous material',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();await s.write(value('new'),f.current);
 assert.equal(f.counts().copies,0);assert.equal(f.counts().processes,1);assert.equal(f.files.get(path),source('new'));
 const previous=[...f.files].find(([name])=>name.includes('.previous-'));assert.ok(previous);assert.equal(JSON.parse(previous[1]).source,source('old'));
});
test('changes just before the process callback are rejected without overwriting',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.control.beforeProcess=()=>f.files.set(path,source('external'));
 await assert.rejects(s.write(value('new'),f.current),outcome('not-written'));assert.equal(f.files.get(path),source('external'));assert.equal(f.counts().canonicalWrites,0);
 const read=await s.read();assert.equal(read.value!.value,'old');assert.ok(read.blocked);await assert.rejects(s.write(value('again'),f.current),outcome('not-written'));
});
test('external change found on repeated read locks the last confirmed snapshot',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.files.set(path,source('external'));
 const read=await s.read();assert.equal(read.value!.value,'old');assert.ok(read.blocked);await assert.rejects(s.write(value('next'),f.current));assert.equal(f.counts().canonicalWrites,0);
});
test('store instances never merge or overwrite a stale baseline',async()=>{
 const f=fixture(source('old')),left=f.store(),right=f.store();await Promise.all([left.read(),right.read()]);await left.write(value('left'),f.current);
 await assert.rejects(right.write(value('right'),f.current),outcome('not-written'));assert.equal(f.files.get(path),source('left'));
});
test('queued writes serialize and freeze caller input before their turn',async()=>{
 const f=fixture(source('old')),s=f.store(),gate=deferred();await s.read();f.control.processGate=gate.promise;
 const input=value('second'),first=s.write(value('first'),f.current),second=s.write(input,f.current);input.value='changed after call';await until(()=>f.counts().processes===1);assert.equal(f.counts().canonicalWrites,0);
 gate.resolve();await Promise.all([first,second]);assert.equal(f.files.get(path),source('second'));assert.equal(f.counts().canonicalWrites,2);assert.equal([...f.files.keys()].filter(name=>name.includes('.previous-')).length,1);
});
for(const initial of [undefined,source('old')])test(`lost acknowledgment after ${initial?'update':'create'} is confirmed by exact readback`,async()=>{
 const f=fixture(initial),s=f.store();await s.read();f.control.failure='after';await s.write(value('new'),f.current);assert.equal((await s.read()).value!.value,'new');assert.equal(f.counts().canonicalWrites,1);
});
test('late cancellation after writing does not erase a confirmed successful result',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.control.afterCanonical=f.cancel;await s.write(value('new'),f.current);assert.equal((await s.read()).value!.value,'new');
});
test('cancellation at the queued process callback performs zero canonical writes',async()=>{
 const f=fixture(source('old')),s=f.store(),gate=deferred();await s.read();f.control.processGate=gate.promise;const writing=s.write(value('new'),f.current);await until(()=>f.counts().processes===1);f.cancel();gate.resolve();await assert.rejects(writing,outcome('not-written'));
 assert.equal(f.files.get(path),source('old'));assert.equal(f.counts().canonicalWrites,0);assert.ok([...f.files.keys()].some(name=>name.endsWith('.tmp')));
});
test('early cancellation creates no recovery materials',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.cancel();await assert.rejects(s.write(value('new'),f.current),outcome('not-written'));assert.equal(f.counts().writes.length,0);
});
test('partial canonical writes are unknown and reopen only the last confirmed previous value read-only',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.control.damage='{';await assert.rejects(s.write(value('new'),f.current),outcome('unknown'));
 assert.equal((await s.read()).value!.value,'old');const reopened=f.store(),read=await reopened.read();assert.equal(read.value!.value,'old');assert.ok(read.blocked);await assert.rejects(reopened.write(value('retry'),f.current));assert.equal(f.files.get(path),'{');assert.ok([...f.files.keys()].some(name=>name.endsWith('.tmp')));
});
test('readback failure after a write preserves materials and reports unknown',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.control.afterCanonical=()=>{f.control.readFailure=true;};await assert.rejects(s.write(value('new'),f.current),outcome('unknown'));
 const read=await s.read();assert.equal(read.value!.value,'old');assert.ok(read.blocked);assert.ok([...f.files.keys()].some(name=>name.endsWith('.tmp')));
});
test('corrupt canonical without confirmed materials is read-only and never repaired in place',async()=>{
 const f=fixture('{broken'),s=f.store(),read=await s.read();assert.equal(read.value,null);assert.ok(read.blocked);await assert.rejects(s.write(value('replacement'),f.current));assert.equal(f.files.get(path),'{broken');assert.equal(f.counts().writes.length,0);
});
test('temporary data cannot be promoted into a confirmed value or authorize first creation',async()=>{
 const f=fixture();f.files.set(path+'.pending-foreign-1.tmp',source('unconfirmed'));const s=f.store(),read=await s.read();assert.equal(read.value,null);assert.ok(read.blocked);await assert.rejects(s.write(value('new'),f.current));assert.equal(f.counts().canonicalWrites,0);
});
test('foreign paths and malformed previous envelopes cannot become recovery authority',async()=>{
 const f=fixture('{');f.files.set(path+'.previous-1000000000001-token.json',JSON.stringify({format:'thoughtspace-collection-json-previous',version:1,path:'other.json',sequence:1000000000001,source:source('foreign')}));
 f.files.set(path+'.previous-1000000000002-token.json',JSON.stringify({format:'thoughtspace-collection-json-previous',version:1,path,sequence:1000000000002,source:source('unknown field'),extra:true}));
 const read=await f.store().read();assert.equal(read.value,null);assert.ok(read.blocked);assert.equal(f.counts().canonicalWrites,0);
});
test('restarted stores order new confirmed backups after older materials despite clock reversal',async()=>{
 const f=fixture(source('latest confirmed')),sequence=Date.now()+100000;
 f.files.set(`${path}.previous-${sequence}-earlier.json`,JSON.stringify({format:'thoughtspace-collection-json-previous',version:1,path,sequence,source:source('older confirmed')}));
 const s=f.store();await s.read();f.control.damage='{';await assert.rejects(s.write(value('not confirmed'),f.current),outcome('unknown'));
 const recovered=await f.store().read();assert.equal(recovered.value!.value,'latest confirmed');assert.ok(recovered.blocked);
});
test('oversize metadata rejects before reading and UTF-8 input is also bounded',async()=>{
 const f=fixture(source('old'));f.control.size=COLLECTION_JSON_MAX_BYTES+1;const read=await f.store().read();assert.ok(read.blocked);assert.equal(f.counts().reads,0);
 const small=fixture(),s=small.store();await s.read();await assert.rejects(s.write(value('中'.repeat(COLLECTION_JSON_MAX_BYTES/2)),small.current),outcome('not-written'));assert.equal(small.files.size,0);
});
test('adapters without stat still reject oversized reads without changing canonical data',async()=>{
 const text=source('x'.repeat(COLLECTION_JSON_MAX_BYTES)),f=fixture(text);delete f.adapter.stat;const s=f.store(),read=await s.read();assert.ok(read.blocked);assert.equal(read.value,null);await assert.rejects(s.write(value('small'),f.current));assert.equal(f.files.get(path),text);assert.equal(f.counts().writes.length,0);
});
test('recovery material write failure cannot reach canonical mutation',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.control.materialWriteFailure=true;await assert.rejects(s.write(value('new'),f.current));assert.equal(f.files.get(path),source('old'));assert.equal(f.counts().canonicalWrites,0);assert.equal((await s.read()).value!.value,'old');
});
test('adapters missing copy or process fail closed without using rename or plain overwrite',async()=>{
 for(const initial of [undefined,source('old')]){const f=fixture(initial);if(initial)delete f.adapter.process;else delete f.adapter.copy;const s=f.store();await s.read();await assert.rejects(s.write(value('new'),f.current),outcome('not-written'));assert.equal(f.counts().writes.length,0);assert.equal(f.counts().canonicalWrites,0);}
});
test('a refused canonical update preserves old value and permits an explicit retry',async()=>{
 const f=fixture(source('old')),s=f.store();await s.read();f.control.failure='before';await assert.rejects(s.write(value('new'),f.current),outcome('not-written'));assert.equal((await s.read()).value!.value,'old');
 f.control.failure=undefined;await s.write(value('new'),f.current);assert.equal((await s.read()).value!.value,'new');
});
