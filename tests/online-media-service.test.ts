import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as onlinePlatform from '../src/online-platform';
import * as onlineNotes from '../src/online-media-notes';
import * as mediaNotes from '../src/media-notes';
import * as workspace from '../src/workspace';
import * as yingjian from '../src/yingjian';

class TFile {
 stat:{mtime:number;size:number};
 constructor(public path:string,size=0){this.stat={mtime:1,size};}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
 get extension(){return this.path.split('.').at(-1)!;}
}
type Moment={id:string;time:number;text:string;image?:Blob};
type Result={note?:TFile;entries:(Moment&{line:number})[]};
interface Service {notes(input:string,pinned?:string):Promise<Result>;save(input:string,data:Moment,pinned?:string):Promise<{note:TFile}>;dispose():void}
const compiled=transformSync(readFileSync('src/online-media-service.ts','utf8'),{loader:'ts',format:'cjs'}).code,module={exports:{}};
new Function('require','module','exports',compiled)((name:string)=>{
 if(name==='obsidian')return{TFile};
 if(name==='./online-platform')return onlinePlatform;
 if(name==='./online-media-notes')return onlineNotes;
 if(name==='./workspace')return workspace;
 if(name==='./yingjian')return yingjian;
 throw Error(`Unexpected runtime dependency: ${name}`);
},module,module.exports);
const {OnlineMediaService}=module.exports as {OnlineMediaService:new(app:unknown,create:(title:string,body:string)=>Promise<TFile>,vaultId:()=>string)=>Service};
const youtube='https://www.youtube.com/watch?v=dQw4w9WgXcQ',other='https://www.youtube.com/watch?v=abcdefghijk';
const biliOne='https://www.bilibili.com/video/BV1xx411c7mD/',biliTwo=biliOne+'?p=2';
const vaultName='我的仓库',vaultId='0123456789abcdefabcd';
const draft=(id='point-one',time=12.5,text='原始摘录'):Moment=>({id,time,text});
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
type Hook=(file:TFile)=>void|Promise<void>;
function fixture(){
 const files=new Map<string,TFile>(),texts=new Map<TFile,string>(),cacheOverrides=new Map<TFile,Record<string,unknown>|null>();
 const reads:TFile[]=[],processes:TFile[]=[],writes:{file:TFile;before:string;after:string}[]=[],creates:{title:string;body:string;file?:TFile}[]=[];
 const controls:{beforeRead?:Hook;beforeProcess?:Hook;afterProcess?:Hook;beforeCreate?:()=>void|Promise<void>;afterCreate?:Hook;readFailures:Set<TFile>;processFailures:number;processAckFailures:number;createAckFailures:number}={readFailures:new Set(),processFailures:0,processAckFailures:0,createAckFailures:0};
 const add=(raw:string,path=`notes/existing-${texts.size}.md`)=>{const file=new TFile(path,Buffer.byteLength(raw));files.set(path,file);texts.set(file,raw);return file;};
 const update=(file:TFile,raw:string)=>{texts.set(file,raw);file.stat.mtime++;file.stat.size=Buffer.byteLength(raw);};
 const rename=(file:TFile,path:string)=>{files.delete(file.path);file.path=path;files.set(path,file);};
 const binaries:{file:TFile;bytes:ArrayBuffer}[]=[];
 const app={fileManager:{getAvailablePathForAttachment:async(name:string)=>'attachments/'+name},vault:{
  createBinary:async(path:string,bytes:ArrayBuffer)=>{const file=new TFile(path,bytes.byteLength);files.set(path,file);binaries.push({file,bytes});return file;},
  getName:()=>vaultName,getMarkdownFiles:()=>[...files.values()].filter(file=>file.extension==='md'),getAbstractFileByPath:(path:string)=>files.get(path),
  read:async(file:TFile)=>{reads.push(file);const snapshot=texts.get(file);await controls.beforeRead?.(file);if(controls.readFailures.has(file))throw Error('read failed');if(snapshot===undefined)throw Error('missing contents');return snapshot;},
  process:async(file:TFile,change:(raw:string)=>string)=>{
   processes.push(file);await controls.beforeProcess?.(file);if(controls.processFailures>0){controls.processFailures--;throw Error('process failed');}
   const before=texts.get(file)!;const after=change(before);update(file,after);writes.push({file,before,after});await controls.afterProcess?.(file);
   if(controls.processAckFailures>0){controls.processAckFailures--;throw Error('write acknowledgement failed');}return after;
  },
 },metadataCache:{getFileCache:(file:TFile)=>{
  if(cacheOverrides.has(file)){const value=cacheOverrides.get(file);return value===null?null:{frontmatter:value};}
  const frontmatter:Record<string,unknown>={};for(const[key,value]of mediaNotes.noteProperties(texts.get(file)||''))if(value!==undefined)frontmatter[key]=mediaNotes.scalar(value)??value;
  return{frontmatter};
 }}};
 const create=async(title:string,body:string)=>{
  const record:{title:string;body:string;file?:TFile}={title,body};creates.push(record);const index=creates.length;await controls.beforeCreate?.();
  const file=add(body,`notes/created-${index}.md`);record.file=file;await controls.afterCreate?.(file);
  if(controls.createAckFailures>0){controls.createAckFailures--;throw Error('create acknowledgement failed');}return file;
 };
 const service=new OnlineMediaService(app,create,()=>vaultId);
 return{service,app,binaries,files,texts,cacheOverrides,controls,reads,processes,writes,creates,add,update,rename};
}
const moments=(f:ReturnType<typeof fixture>,file:TFile,source=youtube)=>onlineNotes.readOnlineMoments(f.texts.get(file)!,source,vaultName,vaultId).map(({id,time,text})=>({id,time,text}));
const legacy=(source=biliTwo)=>[
 '---',`source: ${JSON.stringify(source)}`,'video-note-id: "legacy-course"','tags: [影笺, 学习]','custom: "必须原样保留"','---','',
 '# 原视频课程','',`> [!note] [0:07](${yingjian.yingjianLink(source,7,'notes/legacy.md',vaultId)})`,'> 旧摘录 **正文**','> ![[frames/old.png]]','','^video-t-legacy-one','','普通正文  两个空格。','',
].join('\r\n');

test('opening never creates a note; the first save creates once and same-id retry is idempotent',async()=>{
 const f=fixture();assert.deepEqual(await f.service.notes(youtube),{entries:[]});assert.equal(f.creates.length,0);
 const input=draft(),first=await f.service.save(youtube,input),raw=f.texts.get(first.note)!;
 assert.equal(f.creates.length,1);assert.equal(onlineNotes.onlineNoteSource(raw),youtube);assert.deepEqual(moments(f,first.note),[input]);
 const retry=await f.service.save('https://youtu.be/dQw4w9WgXcQ?t=90',input);assert.equal(retry.note,first.note);assert.equal(f.creates.length,1);assert.equal(f.texts.get(first.note),raw);f.service.dispose();
});

test('invalid input fails before any note is created or processed',async()=>{
 for(const input of [draft('bad id'),draft('ok',NaN),draft('ok',864001),draft('ok',1,'bad\0text'),draft('ok',1,'x'.repeat(100001))]){
  const f=fixture();await assert.rejects(async()=>f.service.save(youtube,input));assert.equal(f.creates.length,0);assert.equal(f.processes.length,0);f.service.dispose();
 }
});

test('retry after a committed process acknowledgement failure does not duplicate the entry',async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube));f.controls.processAckFailures=1;
 await assert.rejects(f.service.save(youtube,draft()),/acknowledgement/);assert.deepEqual(moments(f,note),[draft()]);
 const retry=await f.service.save(youtube,draft());assert.equal(retry.note,note);assert.deepEqual(moments(f,note),[draft()]);assert.equal(f.creates.length,0);f.service.dispose();
});

test('retry after a committed create acknowledgement failure discovers the created note',async()=>{
 const f=fixture();f.controls.createAckFailures=1;await assert.rejects(f.service.save(youtube,draft()),/acknowledgement/);
 assert.equal(f.creates.length,1);const created=f.creates[0].file!;assert.deepEqual(moments(f,created),[draft()]);
 const retry=await f.service.save(youtube,draft());assert.equal(retry.note,created);assert.equal(f.creates.length,1);assert.deepEqual(moments(f,created),[draft()]);f.service.dispose();
});

for(const metadata of [null,{}])test(`a creation acknowledgement failure with ${metadata===null?'unavailable':'empty'} metadata cannot create a duplicate on retry`,async()=>{
 const f=fixture();f.controls.createAckFailures=1;f.controls.afterCreate=file=>{f.cacheOverrides.set(file,metadata);};
 await assert.rejects(f.service.save(youtube,draft()),/acknowledgement/);const created=f.creates[0].file!;
 await assert.rejects(f.service.save(youtube,draft()));assert.equal(f.creates.length,1);assert.equal(f.processes.length,0);assert.deepEqual(moments(f,created),[draft()]);
 f.cacheOverrides.delete(created);assert.equal((await f.service.save(youtube,draft())).note,created);assert.equal(f.creates.length,1);assert.deepEqual(moments(f,created),[draft()]);f.service.dispose();
});

test('a failed creation that leaves no new file permits a later creation retry',async()=>{
 const f=fixture();f.controls.beforeCreate=()=>{throw Error('create failed before commit');};
 await assert.rejects(f.service.save(youtube,draft()),/before commit/);assert.equal(f.files.size,0);f.controls.beforeCreate=undefined;
 const saved=await f.service.save(youtube,draft());assert.equal(f.files.size,1);assert.deepEqual(moments(f,saved.note),[draft()]);f.service.dispose();
});

test('missing metadata for a workspace note prevents assuming that no source note exists',async()=>{
 const f=fixture(),unindexed=f.add('# Awaiting metadata index\n','notes/unindexed.md');f.cacheOverrides.set(unindexed,null);
 await assert.rejects(f.service.notes(youtube));await assert.rejects(f.service.save(youtube,draft()));assert.equal(f.creates.length,0);assert.equal(f.processes.length,0);
 f.cacheOverrides.delete(unindexed);const saved=await f.service.save(youtube,draft());assert.equal(f.creates.length,1);assert.deepEqual(moments(f,saved.note),[draft()]);f.service.dispose();
});

test('known and explicitly pinned notes remain usable while metadata indexes are unavailable',async()=>{
 for(const mode of ['known','pinned']as const){
  const f=fixture(),target=f.add(onlineNotes.onlineNoteDocument(youtube),'notes/target.md'),unindexed=f.add('# Unindexed\n');
  if(mode==='known')assert.equal((await f.service.notes(youtube)).note,target);
  f.cacheOverrides.set(target,null);f.cacheOverrides.set(unindexed,null);const pinned=mode==='pinned'?target.path:undefined;
  assert.equal((await f.service.notes(youtube,pinned)).note,target);assert.equal((await f.service.save(youtube,draft(),pinned)).note,target);assert.equal(f.creates.length,0);assert.deepEqual(moments(f,target),[draft()]);f.service.dispose();
 }
});

test('same-source saves serialize canonical aliases and snapshot arguments at dispatch',async()=>{
 const f=fixture(),gate=deferred();f.controls.beforeCreate=()=>gate.promise;
 const firstData=draft('first',1,'first original'),secondData=draft('second',2,'second original');
 const first=f.service.save(youtube,firstData);firstData.id='mutated-first';firstData.time=999;firstData.text='first mutated';
 const second=f.service.save('https://youtu.be/dQw4w9WgXcQ?t=60',secondData);secondData.text='second mutated';await tick();assert.equal(f.creates.length,1);assert.equal(f.processes.length,0);
 gate.resolve();const[a,b]=await Promise.all([first,second]);assert.equal(a.note,b.note);assert.equal(f.creates.length,1);
 assert.deepEqual(moments(f,a.note),[draft('first',1,'first original'),draft('second',2,'second original')]);f.service.dispose();
});

test('a failed save releases the same-source queue for the next entry',async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube));f.controls.processFailures=1;
 const failed=f.service.save(youtube,draft('failed')),rejected=assert.rejects(failed,/process failed/),next=f.service.save(youtube,draft('next'));
 await rejected;assert.equal((await next).note,note);assert.deepEqual(moments(f,note),[draft('next')]);f.service.dispose();
});

test('a queued pinned save cannot retarget a replacement file at the same path',async()=>{
 const f=fixture(),original=onlineNotes.onlineNoteDocument(youtube),note=f.add(original,'notes/pinned.md'),gate=deferred();f.controls.beforeRead=()=>gate.promise;
 const first=f.service.save(youtube,draft('first')),firstFailure=assert.rejects(first),queued=f.service.save(youtube,draft('queued'),note.path),queuedFailure=assert.rejects(queued);
 await tick();const replacement=f.add(original,note.path);gate.resolve();await Promise.all([firstFailure,queuedFailure]);
 assert.equal(f.processes.length,0);assert.equal(f.creates.length,0);assert.equal(f.texts.get(replacement),original);f.service.dispose();
});

test('different sources make progress concurrently while one source is awaiting a read',async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube)),gate=deferred();f.controls.beforeRead=file=>file===note?gate.promise:undefined;
 let firstDone=false;const first=f.service.save(youtube,draft('a')).then(value=>{firstDone=true;return value;});await tick();
 const second=await f.service.save(other,draft('b'));assert.equal(firstDone,false);assert.equal(onlineNotes.onlineNoteSource(f.texts.get(second.note)!),other);
 gate.resolve();await first;assert.deepEqual(moments(f,note),[draft('a')]);f.service.dispose();
});

test('legacy Yingjian note is appended byte-for-byte and Bilibili parts remain separate',async()=>{
 const f=fixture(),original=legacy(),note=f.add(original,'notes/legacy.md'),partOneRaw=legacy(biliOne),partOne=f.add(partOneRaw,'notes/part-one.md');
 const before=await f.service.notes(biliTwo);assert.equal(before.note,note);assert.equal(before.entries.length,1);assert.equal(before.entries[0].id,'legacy-one');
 const saved=await f.service.save(biliTwo,draft('new',18,'新摘录'));assert.equal(saved.note,note);const after=f.texts.get(note)!;
 assert.equal(after.slice(0,original.length),original);assert.equal(f.texts.get(partOne),partOneRaw);assert.equal(f.creates.length,0);assert.deepEqual(moments(f,note,biliTwo).map(value=>value.id),['legacy-one','new']);
 await f.service.save(biliOne,draft('p1',21));assert.equal(f.texts.get(note),after);assert.deepEqual(moments(f,partOne,biliOne).map(value=>value.id),['legacy-one','p1']);f.service.dispose();
});

test('an explicit pinned note never falls back to another source or creates a replacement',async()=>{
 const f=fixture(),wrong=f.add(onlineNotes.onlineNoteDocument(other),'notes/wrong.md');f.add(onlineNotes.onlineNoteDocument(youtube),'notes/right.md');
 for(const path of [wrong.path,'notes/missing.md','../escape.md']){
  await assert.rejects(f.service.notes(youtube,path));await assert.rejects(async()=>f.service.save(youtube,draft(),path));
 }
 assert.equal(f.creates.length,0);assert.equal(f.processes.length,0);f.service.dispose();
});

test('ordinary video tags do not turn an unrelated note into a legacy Yingjian candidate',async()=>{
 const f=fixture(),original=`---\nsource: ${JSON.stringify(youtube)}\ntags: [视频]\n---\n\nOrdinary bookmark.\n`,ordinary=f.add(original,'notes/bookmark.md');
 f.cacheOverrides.set(ordinary,{source:youtube,tags:['视频']});assert.deepEqual(await f.service.notes(youtube),{entries:[]});
 const saved=await f.service.save(youtube,draft());assert.notEqual(saved.note,ordinary);assert.equal(f.creates.length,1);assert.equal(f.texts.get(ordinary),original);assert.ok(!f.reads.includes(ordinary));f.service.dispose();
});

test('plugin backups are excluded from default discovery and cannot be selected as a pinned target',async()=>{
 const f=fixture(),original=onlineNotes.onlineNoteDocument(youtube),backup=f.add(original,'ThoughtSpace-plugin-backups/online.md');
 assert.deepEqual(await f.service.notes(youtube),{entries:[]});await assert.rejects(f.service.notes(youtube,backup.path));
 await assert.rejects(f.service.save(youtube,draft(),backup.path));assert.equal(f.creates.length,0);assert.equal(f.texts.get(backup),original);f.service.dispose();
});

test('atomic append preserves unrelated human edits made after note discovery',async()=>{
 const f=fixture(),original=onlineNotes.onlineNoteDocument(youtube),note=f.add(original);
 f.controls.beforeProcess=file=>{f.update(file,f.texts.get(file)!+'Human edit between read and process.\n');};
 await f.service.save(youtube,draft());assert.ok(f.texts.get(note)!.startsWith(original+'Human edit between read and process.\n'));assert.deepEqual(moments(f,note),[draft()]);f.service.dispose();
});

for(const failure of ['read','byte-limit','character-limit','source-changed']as const)test(`a discovered candidate with ${failure} cannot be treated as an absent note`,async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube));
 if(failure==='read')f.controls.readFailures.add(note);
 if(failure==='byte-limit')note.stat.size=2000001;
 if(failure==='character-limit')f.update(note,onlineNotes.onlineNoteDocument(youtube)+'x'.repeat(500001));
 if(failure==='source-changed'){f.cacheOverrides.set(note,{thoughtspace_online_video:youtube});f.update(note,onlineNotes.onlineNoteDocument(other));}
 const original=f.texts.get(note);await assert.rejects(f.service.notes(youtube));await assert.rejects(f.service.save(youtube,draft()));
 assert.equal(f.creates.length,0);assert.equal(f.processes.length,0);assert.equal(f.texts.get(note),original);f.service.dispose();
});

for(const mutation of ['delete','rename','replace','source-changed']as const)test(`a cached note that undergoes ${mutation} is protected instead of silently replaced`,async()=>{
 const f=fixture(),note=(await f.service.save(youtube,draft('original'))).note,original=f.texts.get(note)!;
 if(mutation==='delete')f.files.delete(note.path);
 if(mutation==='rename')f.rename(note,'notes/renamed.md');
 if(mutation==='replace')f.add(original,note.path);
 if(mutation==='source-changed')f.update(note,onlineNotes.onlineNoteDocument(other));
 const before=f.texts.get(note);await assert.rejects(f.service.notes(youtube));await assert.rejects(f.service.save(youtube,draft('new')));
 assert.equal(f.creates.length,1);assert.equal(f.processes.length,0);assert.equal(f.texts.get(note),before);f.service.dispose();
});

test('an explicitly selected new path can reclaim a renamed source note after default discovery refuses it',async()=>{
 const f=fixture(),note=(await f.service.save(youtube,draft('before'))).note;f.rename(note,'notes/renamed-explicitly.md');
 await assert.rejects(f.service.notes(youtube));assert.equal((await f.service.notes(youtube,note.path)).note,note);
 assert.equal((await f.service.save(youtube,draft('after'))).note,note);assert.equal(f.creates.length,1);assert.deepEqual(moments(f,note),[draft('before'),draft('after')]);f.service.dispose();
});

for(const mutation of ['source','mtime','rename','delete','replace']as const)test(`${mutation} during a read invalidates both timeline and save discovery`,async()=>{
 for(const operation of ['notes','save']as const){
  const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube)),gate=deferred();f.controls.beforeRead=()=>gate.promise;
  const pending=operation==='notes'?f.service.notes(youtube):f.service.save(youtube,draft()),rejected=assert.rejects(pending);await tick();assert.equal(f.reads.length,1);
  if(mutation==='source')f.update(note,onlineNotes.onlineNoteDocument(other));
  if(mutation==='mtime')note.stat.mtime++;
  if(mutation==='rename')f.rename(note,'notes/moved-during-read.md');
  if(mutation==='delete')f.files.delete(note.path);
  if(mutation==='replace')f.add(onlineNotes.onlineNoteDocument(youtube),note.path);
  gate.resolve();await rejected;assert.equal(f.creates.length,0);assert.equal(f.processes.length,0);f.service.dispose();
 }
});

for(const mutation of ['source','rename','delete','replace']as const)test(`${mutation} before the atomic process callback cannot append to a changed note`,async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube));
 f.controls.beforeProcess=file=>{
  if(mutation==='source')f.update(file,onlineNotes.onlineNoteDocument(other));
  if(mutation==='rename')f.rename(file,'notes/moved-before-write.md');
  if(mutation==='delete')f.files.delete(file.path);
  if(mutation==='replace')f.add(onlineNotes.onlineNoteDocument(other),file.path);
 };
 await assert.rejects(f.service.save(youtube,draft()));assert.equal(f.writes.length,0);assert.equal(f.creates.length,0);assert.doesNotMatch(f.texts.get(note)!,/thoughtspace-online-point-one/);f.service.dispose();
});

test('dispose before queued saves begin prevents all reads, creates and writes',async()=>{
 const f=fixture(),first=f.service.save(youtube,draft('one')),second=f.service.save(youtube,draft('two'));f.service.dispose();
 await Promise.all([assert.rejects(first),assert.rejects(second)]);assert.equal(f.reads.length,0);assert.equal(f.creates.length,0);assert.equal(f.processes.length,0);
 await assert.rejects(async()=>f.service.save(youtube,draft('three')));await assert.rejects(f.service.notes(youtube));
});

test('dispose while reading rejects pending timeline, active save and queued save without creating',async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube)),original=f.texts.get(note),gate=deferred();f.controls.beforeRead=()=>gate.promise;
 const timeline=f.service.notes(youtube),first=f.service.save(youtube,draft('one')),second=f.service.save(youtube,draft('two'));
 const failures=[assert.rejects(timeline),assert.rejects(first),assert.rejects(second)];await tick();f.service.dispose();gate.resolve();await Promise.all(failures);
 assert.equal(f.creates.length,0);assert.equal(f.writes.length,0);assert.equal(f.texts.get(note),original);
});

test('dispose before process callback prevents the write and every later queued save',async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube)),original=f.texts.get(note),gate=deferred();f.controls.beforeProcess=()=>gate.promise;
 const first=f.service.save(youtube,draft('one')),second=f.service.save(youtube,draft('two')),failures=[assert.rejects(first),assert.rejects(second)];await tick();
 assert.equal(f.processes.length,1);f.service.dispose();gate.resolve();await Promise.all(failures);assert.equal(f.writes.length,0);assert.equal(f.processes.length,1);assert.equal(f.texts.get(note),original);
});

test('dispose after create commits but before it returns rejects publication and the queued write',async()=>{
 const f=fixture(),gate=deferred();f.controls.afterCreate=()=>gate.promise;
 const first=f.service.save(youtube,draft('one')),second=f.service.save(youtube,draft('two')),failures=[assert.rejects(first),assert.rejects(second)];await tick();
 assert.equal(f.creates.length,1);assert.ok(f.creates[0].file);f.service.dispose();gate.resolve();await Promise.all(failures);
 assert.equal(f.creates.length,1);assert.equal(f.processes.length,0);assert.deepEqual(moments(f,f.creates[0].file!),[draft('one')]);
});

test('dispose after process commits but before it returns rejects publication and further queue work',async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube)),gate=deferred();f.controls.afterProcess=()=>gate.promise;
 const first=f.service.save(youtube,draft('one')),second=f.service.save(youtube,draft('two')),failures=[assert.rejects(first),assert.rejects(second)];await tick();
 assert.equal(f.writes.length,1);f.service.dispose();gate.resolve();await Promise.all(failures);assert.equal(f.processes.length,1);assert.deepEqual(moments(f,note),[draft('one')]);
});

function frameBlob(){const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);const v=new DataView(bytes.buffer);v.setUint32(12,0x49484452);v.setUint32(16,640);v.setUint32(20,360);return new Blob([bytes],{type:'image/png'});}
test('online frame-only captures preserve actual time and create one attachment on retry',async()=>{
 const f=fixture(),frame={...draft('frame-one',12.25,''),image:frameBlob()};const {note}=await f.service.save(youtube,frame);
 assert.equal(f.binaries.length,1);const entries=onlineNotes.readOnlineMoments(f.texts.get(note)!,youtube,vaultName,vaultId);assert.equal(entries[0].time,12.25);assert.equal(entries[0].text,'');assert.match(entries[0].image!,/attachments.*frame-one.png/);
 await f.service.save(youtube,frame);assert.equal(f.binaries.length,1);assert.equal(f.creates.length,1);
});
test('failed frame-note append reuses the original PNG and does not lose text',async()=>{
 const f=fixture(),note=f.add(onlineNotes.onlineNoteDocument(youtube)),frame={...draft('frame-two'),image:frameBlob()};f.controls.processFailures=1;
 await assert.rejects(f.service.save(youtube,frame,note.path),/process failed/);assert.equal(f.binaries.length,1);
 await f.service.save(youtube,frame,note.path);assert.equal(f.binaries.length,1);assert.match(f.texts.get(note)!,/原始摘录/);
});
test('bad or oversized screenshot data never creates attachments or notes',async()=>{
 for(const image of [new Blob(['x'],{type:'image/jpeg'}),new Blob(['x'],{type:'image/png'}),new Blob([new Uint8Array(16*1024*1024+1)],{type:'image/png'})]){
  const f=fixture();await assert.rejects(async()=>f.service.save(youtube,{...draft(),image}));assert.equal(f.binaries.length,0);assert.equal(f.creates.length,0);
 }
});
test('a timestamp-only note can be saved and read without placeholder prose',async()=>{
 const f=fixture(),{note}=await f.service.save(youtube,draft('timestamp-only',3.25,''));assert.deepEqual(moments(f,note),[draft('timestamp-only',3.25,'')]);assert.equal(f.binaries.length,0);
});
test('disposal during attachment allocation cannot create a frame or note',async()=>{
 const f=fixture();f.app.fileManager.getAvailablePathForAttachment=async()=>{f.service.dispose();return 'frame.png';};await assert.rejects(f.service.save(youtube,{...draft(),image:frameBlob()}),/关闭/);assert.equal(f.binaries.length,0);assert.equal(f.creates.length,0);
});
