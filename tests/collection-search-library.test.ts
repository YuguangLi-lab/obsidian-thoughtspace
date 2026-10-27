import * as reviewFeature from '../src/collection-review';
import * as duplicateFeature from '../src/collection-duplicates';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as model from '../src/collection-model';
import * as search from '../src/collection-search';
import * as tasks from '../src/collection-tasks';
import * as workspace from '../src/workspace';

const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:(text:string)=>unknown}).load;
class Component {registerEvent(_ref:unknown){} }
class TFile {
 stat={mtime:1,size:1,ctime:1};constructor(public path:string){}
 get name(){return this.path.split('/').at(-1)!;}get extension(){return this.name.split('.').at(-1)!;}get basename(){return this.name.replace(/\.[^.]+$/,'');}
}
const module={exports:{}},dependencies:Record<string,unknown>={
 obsidian:{Component,TFile,parseYaml,getAllTags:(cache:{frontmatter?:{tags?:string[]}})=>cache.frontmatter?.tags||[]},
 './collection-model':model,'./collection-review':reviewFeature,'./collection-duplicates':duplicateFeature,'./collection-review-host':{setCollectionReview:async()=>{throw Error('review write not provided by this fixture');}},'./collection-search':search,'./collection-tasks':tasks,'./workspace':workspace,
};
new Function('require','module','exports',transformSync(readFileSync('src/collection-library.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{assert.ok(name in dependencies,`mock ${name}`);return dependencies[name];},module,module.exports);
const {CollectionLibrary}=module.exports as typeof import('../src/collection-library');
function fixture(){
 const files=new Map<string,TFile>(),metadata=new Map<TFile,{frontmatter:Record<string,unknown>;listItems?:{task?:string}[]}>(),disk=new Map<TFile,string>(),listeners=new Map<string,((...args:unknown[])=>void)[]>();
 let reads=0,enumerations=0,cacheReads=0,activeReads=0,peakReads=0;const control:{beforeRead?:(file:TFile)=>Promise<void>;afterRead?:(file:TFile)=>void}={};
 const on=(name:string,fn:(...args:unknown[])=>void)=>{listeners.set(name,[...(listeners.get(name)||[]),fn]);return{name,fn};};
 const offref=(ref:{name:string;fn:(...args:unknown[])=>void})=>{listeners.set(ref.name,(listeners.get(ref.name)||[]).filter(fn=>fn!==ref.fn));};
 const emit=(name:string,file:TFile)=>{for(const fn of listeners.get(name)||[])fn(file);};
 const app={workspace:{containerEl:{ownerDocument:{defaultView:{setTimeout,clearTimeout}}}},vault:{configDir:'.obsidian',on:(name:string,fn:(...args:unknown[])=>void)=>on('vault-'+name,fn),offref,getFiles:()=>[...files.values()],getMarkdownFiles:()=>{enumerations++;return[...files.values()];},getAbstractFileByPath:(path:string)=>files.get(path),read:async(file:TFile)=>{reads++;activeReads++;peakReads=Math.max(peakReads,activeReads);try{await control.beforeRead?.(file);const source=disk.get(file);control.afterRead?.(file);if(source===undefined)throw Error('missing');return source;}finally{activeReads--;}}},metadataCache:{on:(name:string,fn:(...args:unknown[])=>void)=>on('metadata-'+name,fn),offref,getFileCache:(file:TFile)=>{cacheReads++;return metadata.get(file);}}};
 const library=new CollectionLibrary(app as never,{isBoardFile:()=>false,readBoard:async()=>{throw Error('not a board');}});library.onload();
 const add=(n:number,body='正文 needle',patch:Record<string,unknown>={},path=`Notes/Record-${n}.md`)=>{const file=new TFile(path),identity={id:`capture-search-${n}`,createdAt:'2026-10-13T12:00:00.000Z'},source=model.collectionNoteSource({...identity,body,tags:['研究/阅读']});file.stat.size=Buffer.byteLength(source);files.set(file.path,file);disk.set(file,source);metadata.set(file,{frontmatter:{thoughtspace_capture:identity.id,thoughtspace_created:identity.createdAt,tags:['#研究/阅读'],...patch}});library.invalidate();return file;};
 return{library,files,metadata,disk,control,emit,add,counts:()=>({reads,enumerations,cacheReads,activeReads,peakReads}),listenerCount:()=>[...listeners.values()].reduce((sum,list)=>sum+list.length,0)};
}
test('production library derives only strict true flags and metadata queries perform zero native reads',async()=>{
 const f=fixture();f.add(1,'needle',{thoughtspace_pinned:true});f.add(2,'needle',{thoughtspace_pinned:'true',thoughtspace_archived:'true'});f.add(3,'needle',{thoughtspace_archived:true});
 const records=await f.library.list();assert.equal(records.find(r=>r.id==='capture-search-1')?.pinned,true);assert.equal(records.find(r=>r.id==='capture-search-2')?.pinned,false);assert.equal(records.find(r=>r.id==='capture-search-2')?.archived,false);
 const result=await f.library.search({query:'Notes #研究'},()=>true);assert.equal(result.hits.length,2);assert.equal(f.counts().reads,0);assert.equal(f.counts().enumerations,0);
 await f.library.search({query:'',includeBody:true},()=>true);assert.equal(f.counts().reads,0);assert.equal(f.counts().enumerations,0);
});
test('production task summaries use native cached list items and update after native metadata changes without reads',async()=>{
 const f=fixture(),mixed=f.add(1,'body is irrelevant'),empty=f.add(2,'- [x] not used without host task metadata'),unknown=f.add(3);
 f.metadata.get(mixed)!.listItems=[{task:' '},{task:'x'},{task:'X'},{task:'/'},{}];
 f.library.remember(unknown as never,{id:'capture-search-3',createdAt:'2026-10-13T12:00:00.000Z'});f.metadata.delete(unknown);
 let records=await f.library.list();assert.deepEqual(records.find(record=>record.path===mixed.path)?.tasks,{total:4,done:2});assert.deepEqual(records.find(record=>record.path===empty.path)?.tasks,{total:0,done:0});assert.equal(records.find(record=>record.path===unknown.path)?.tasks,undefined);
 const result=await f.library.search({query:'',tasks:'none',includeBody:true},()=>true);assert.deepEqual(result.hits.map(hit=>hit.record.path),[empty.path]);assert.equal(f.counts().reads,0);
 f.metadata.get(mixed)!.listItems=[{task:'x'},{task:'x'},{task:'X'},{task:'X'}];f.emit('metadata-changed',mixed);
 records=await f.library.list();assert.deepEqual(records.find(record=>record.path===mixed.path)?.tasks,{total:4,done:4});
 assert.deepEqual((await f.library.search({query:'',tasks:'done'},()=>true)).hits.map(hit=>hit.record.path),[mixed.path]);assert.equal(f.counts().reads,0);assert.equal(f.counts().enumerations,0);
});
test('production library reads each body once using one whole-library identity map',async()=>{
 const f=fixture();for(let i=0;i<10001;i++)f.add(i,i===10000?'unique needle':'other');
 const result=await f.library.search({query:'needle',includeBody:true},()=>true);assert.equal(result.hits.length,1);assert.equal(result.hits[0].record.id,'capture-search-10000');
 assert.equal(f.counts().reads,10001);assert.equal(f.counts().enumerations,1);assert.ok(f.counts().cacheReads<=6*10001,'metadata lookup stays linear');assert.equal(result.unread,0);
});
test('duplicate identities and oversized files are unread without any body read',async()=>{
 const f=fixture();f.add(1);f.add(1,'duplicate',{},'Notes/Duplicate.md');const large=f.add(2);large.stat.size=2*1024*1024+1;
 const result=await f.library.search({query:'needle',includeBody:true},()=>true);assert.deepEqual(result.hits,[]);assert.equal(result.unread,3);assert.equal(result.scanned,3);assert.equal(f.counts().reads,0);assert.equal(f.counts().enumerations,1);
});
for(const reason of ['object','path','stamp','metadata','source'] as const)test(`body search rejects a changed ${reason} after its one native read`,async()=>{
 const f=fixture(),file=f.add(1);f.control.afterRead=()=>{
  if(reason==='object')f.files.set(file.path,new TFile(file.path));
  if(reason==='path')file.path='Notes/Renamed.md';
  if(reason==='stamp')file.stat.mtime++;
  if(reason==='metadata')f.metadata.get(file)!.frontmatter.thoughtspace_capture='capture-other-identity';
 };
 if(reason==='source')f.disk.set(file,f.disk.get(file)!.replace('capture-search-1','capture-other-identity'));
 const result=await f.library.search({query:'needle',includeBody:true},()=>true);assert.equal(result.hits.length,0);assert.equal(result.unread,1);assert.equal(f.counts().reads,1);
});
for(const event of ['modify','rename','delete'] as const)test(`a native ${event} event cancels an outstanding whole search`,async()=>{
 const f=fixture(),file=f.add(1);let finish!:()=>void,started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});
 f.control.beforeRead=async()=>{started();await new Promise<void>(resolve=>{finish=resolve;});};
 const work=f.library.search({query:'needle',includeBody:true},()=>true);await pending;f.emit('vault-'+event,file);finish();const result=await work;assert.equal(result.cancelled,true);assert.deepEqual(result.hits,[]);
});
test('an externally cancelled invocation cannot publish metadata-only results',async()=>{
 const f=fixture();f.add(1);const result=await f.library.search({query:'Record'},()=>false);assert.equal(result.cancelled,true);assert.deepEqual(result.hits,[]);assert.equal(f.counts().reads,0);
});
test('an index change between list resolution and continuation cannot attach stale metadata to a new revision',async()=>{
 const f=fixture(),file=f.add(1);const before=await f.library.list();
 f.library.list=()=>{const result=Promise.resolve(before);queueMicrotask(()=>{f.metadata.get(file)!.frontmatter.thoughtspace_archived=true;f.emit('metadata-changed',file);});return result;};
 const result=await f.library.search({query:'Record'},()=>true);assert.equal(result.cancelled,true);assert.deepEqual(result.hits,[]);assert.equal(f.counts().reads,0);
});
const expectedIdentity={id:'capture-search-1',createdAt:'2026-10-13T12:00:00.000Z'};
test('identity watch refuses a late copy before metadata indexing and the queued callback writes nothing',async()=>{
 const f=fixture(),file=f.add(1),original=f.disk.get(file),watch=f.library.watchIdentity(expectedIdentity);
 assert.equal(await f.library.resolve(expectedIdentity,file.path),file);assert.equal(watch.current(file as never),true);
 let finish!:()=>void,writes=0;const gate=new Promise<void>(resolve=>{finish=resolve;});
 const queued=(async()=>{await gate;if(!watch.current(file as never))return false;writes++;return true;})();
 const copied=f.add(1,'duplicate',{},'Notes/Not-indexed-yet.md');f.metadata.delete(copied);f.emit('vault-create',copied);finish();
 assert.equal(await queued,false);assert.equal(writes,0);assert.equal(f.disk.get(file),original);watch.release();
});
test('identity watch starts before delayed resolution and catches a duplicate created during that read',async()=>{
 const f=fixture(),file=f.add(1),watch=f.library.watchIdentity(expectedIdentity);let finish!:()=>void,started!:()=>void;
 const began=new Promise<void>(resolve=>{started=resolve;});f.control.beforeRead=async()=>{started();await new Promise<void>(resolve=>{finish=resolve;});};
 const resolving=f.library.resolve(expectedIdentity,file.path);await began;const copy=f.add(1,'duplicate',{},'Notes/Late-copy.md');f.metadata.delete(copy);f.emit('vault-create',copy);finish();
 assert.equal(await resolving,file);assert.equal(watch.current(file as never),false);watch.release();
});
test('identity watch synchronously rejects existing duplicates and a stale target identity even without an event',()=>{
 const f=fixture(),file=f.add(1),watch=f.library.watchIdentity(expectedIdentity);assert.equal(watch.current(file as never),true);
 const copy=f.add(1,'duplicate',{},'Notes/Copy.md');assert.equal(watch.current(file as never),false);f.files.delete(copy.path);
 f.metadata.get(file)!.frontmatter.thoughtspace_created='2026-10-13T13:00:00.000Z';assert.equal(watch.current(file as never),false);watch.release();
});
test('identity watch allows only selected-file modify and metadata events and releases every temporary listener',()=>{
 const f=fixture(),file=f.add(1),baseline=f.listenerCount(),watch=f.library.watchIdentity(expectedIdentity);assert.equal(f.listenerCount(),baseline+5);
 f.emit('vault-modify',file);f.emit('metadata-changed',file);assert.equal(watch.current(file as never),true);
 watch.release();watch.release();assert.equal(f.listenerCount(),baseline);assert.equal(watch.current(file as never),false);
});
for(const event of ['vault-modify','metadata-changed'] as const)test(`identity watch rejects another Markdown file's ${event} while a write waits`,()=>{
 const f=fixture(),file=f.add(1),other=f.add(2),watch=f.library.watchIdentity(expectedIdentity);f.emit(event,other);assert.equal(watch.current(file as never),false);watch.release();
});
for(const event of ['vault-rename','vault-delete','vault-create'] as const)test(`identity watch does not exempt selected-file ${event}`,()=>{
 const f=fixture(),file=f.add(1),watch=f.library.watchIdentity(expectedIdentity);f.emit(event,file);assert.equal(watch.current(file as never),false);watch.release();
});
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function bounded<T>(work:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('cancelled search must settle before native reads finish')),500);})]);}finally{if(timer)clearTimeout(timer);}}
test('five overlapping queries share two native slots and cancelled queued queries never read',async()=>{
 const f=fixture();f.add(1,'needle latest');f.add(2,'needle latest');let current=0;
 const gates:(()=>void)[]=[];f.control.beforeRead=()=>new Promise<void>(resolve=>gates.push(resolve));
 const work:Promise<search.CollectionSearchResult>[]=[];
 for(let i=0;i<5;i++){current=i;work.push(f.library.search({query:i===4?'latest':'needle',includeBody:true},()=>current===i));await settle();}
 assert.equal(f.counts().reads,2);assert.equal(f.counts().peakReads,2);
 const cancelled=await bounded(Promise.all(work.slice(0,4)));assert.ok(cancelled.every(result=>result.cancelled&&result.hits.length===0));assert.equal(f.counts().reads,2,'waiting cancelled readers never enter Vault.read');
 gates.splice(0).forEach(resolve=>resolve());await settle();assert.equal(f.counts().reads,4);assert.equal(f.counts().peakReads,2);
 gates.splice(0).forEach(resolve=>resolve());const latest=await bounded(work[4]);assert.equal(latest.cancelled,false);assert.equal(latest.hits.length,2);assert.equal(f.counts().activeReads,0);
});
test('two view searches share the full-text quota and cancelling one frees its caller while native reads remain in flight',async()=>{
 const f=fixture();f.add(1);f.add(2);const gates:(()=>void)[]=[];let firstCurrent=true;
 f.control.beforeRead=()=>new Promise<void>(resolve=>gates.push(resolve));
 const first=f.library.search({query:'needle',includeBody:true},()=>firstCurrent);await settle();const second=f.library.search({query:'needle',includeBody:true},()=>true);await settle();
 assert.equal(f.counts().reads,2);firstCurrent=false;assert.equal((await bounded(first)).cancelled,true);assert.equal(f.counts().activeReads,2);
 gates.splice(0).forEach(resolve=>resolve());await settle();assert.equal(f.counts().reads,4);assert.equal(f.counts().peakReads,2);
 gates.splice(0).forEach(resolve=>resolve());assert.equal((await bounded(second)).hits.length,2);assert.equal(f.counts().activeReads,0);
});
test('library unload cancels waiting clients and releases identity listeners without admitting more reads',async()=>{
 const f=fixture(),file=f.add(1),baseline=f.listenerCount(),watch=f.library.watchIdentity(expectedIdentity);let finish!:()=>void;
 f.control.beforeRead=()=>new Promise<void>(resolve=>{finish=resolve;});const work=f.library.search({query:'needle',includeBody:true},()=>true);await settle();f.library.onunload();
 assert.equal((await bounded(work)).cancelled,true);assert.equal(f.listenerCount(),baseline);assert.equal(watch.current(file as never),false);finish();await settle();assert.equal(f.counts().activeReads,0);
});
test('native per-file resolve invalidates subscribers and cached metadata without body reads',async()=>{
 const f=fixture(),file=f.add(1);await f.library.list();let changed=0;const off=f.library.subscribe(()=>changed++);
 f.metadata.get(file)!.listItems=[{task:'x'}];f.emit('metadata-resolve',file);assert.equal(changed,1);assert.deepEqual((await f.library.list())[0].tasks,{total:1,done:1});assert.equal(f.counts().reads,0);off();
});
