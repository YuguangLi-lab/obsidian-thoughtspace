import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {transformSync} from 'esbuild';
import * as playback from '../src/media-playback';
import * as mediaSource from '../src/media-source';
import * as notes from '../src/media-notes';
import * as subtitles from '../src/media-subtitles';
import * as markdownContext from '../src/markdown-context';
import * as markdownLinks from '../src/markdown-links';
import * as markdownLiterals from '../src/markdown-literals';
import type {MediaCardOptions,MediaCardState} from '../src/media-card-player';

class TFile {
 stat:{mtime:number;size:number};
 constructor(public path:string,size=100,mtime=1){this.stat={mtime,size};}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
 get extension(){return this.path.split('.').at(-1)!;}
}
class FileSystemAdapter {getBasePath(){return '/vaultroot';}}
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
const timers=new Map<number,()=>void>();let timerId=0;
const compiled=transformSync(readFileSync('src/media-workspace-service.ts','utf8'),{loader:'ts',format:'cjs'}).code,module={exports:{}},nodeRequire=createRequire(import.meta.url);
let mountPlayer:(_host:unknown,options:MediaCardOptions)=>unknown;
new Function('require','module','exports','setTimeout','clearTimeout',compiled)((name:string)=>{
 if(name==='obsidian')return{TFile,FileSystemAdapter};
 if(name==='./media-playback')return playback;
 if(name==='./media-source')return mediaSource;
 if(name==='./media-notes')return notes;
 if(name==='./media-subtitles')return subtitles;
 if(name==='./markdown-context')return markdownContext;
 if(name==='./markdown-links')return markdownLinks;
 if(name==='./markdown-literals')return markdownLiterals;
 if(name==='./media-card-player')return{mountMediaCard:(host:unknown,options:MediaCardOptions)=>mountPlayer(host,options)};
 if(name==='./workspace')return{isWorkspaceFile:(file:TFile)=>!file.path.startsWith('ThoughtSpace-plugin-backups/')&&!file.path.startsWith('ThoughtSpace/白板搜索/')};
 return nodeRequire(name);
},module,module.exports,(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},(id:number)=>timers.delete(id));
const {MediaWorkspaceService}=module.exports as {MediaWorkspaceService:new(app:unknown,path:string,ops:unknown)=>any};
const state=(time:number):MediaCardState=>({time,rate:1.25,volume:.5});
const draft=(id='moment-0001',time=12,text='原始摘录')=>({id,time,text});
function fixture(){
 const source=new TFile('media/A.mp4'),files=new Map<string,TFile>([[source.path,source]]),texts=new Map<TFile,string>(),storage=new Map<string,string>();
 const mounts:{options:MediaCardOptions;state:MediaCardState;plays:number;pauses:number;disposals:number;disposalError?:boolean}[]=[];
 const counters={notes:0,binaries:0,processes:0,links:0,writes:[] as string[],reads:[] as TFile[],urls:[] as {url:string;blob:Blob}[],revoked:[] as string[]};
 const controls={beforeRead:undefined as ((file:TFile)=>Promise<void>|void)|undefined,beforeProcess:undefined as ((file:TFile)=>Promise<void>|void)|undefined,beforeCreate:undefined as (()=>Promise<void>|void)|undefined,beforeWrite:undefined as ((text:string)=>Promise<void>|void)|undefined,beforeStateRead:undefined as (()=>Promise<void>|void)|undefined,processFailures:0,throwAfterCommit:0,attachmentPath:undefined as string|undefined};
 const addNote=(raw:string,path=`notes/existing-${texts.size}.md`)=>{const note=new TFile(path,raw.length);files.set(path,note);texts.set(note,raw);return note;};
 const update=(note:TFile,raw:string)=>{texts.set(note,raw);note.stat.size=raw.length;note.stat.mtime++;};
 const adapter=Object.assign(new FileSystemAdapter(),{
  exists:async(path:string)=>storage.has(path),read:async(path:string)=>{await controls.beforeStateRead?.();return storage.get(path)!;},
  write:async(path:string,text:string)=>{counters.writes.push(text);await controls.beforeWrite?.(text);storage.set(path,text);},
 });
 const app={vault:{adapter,getName:()=> 'vault',getAbstractFileByPath:(path:string)=>files.get(path),getMarkdownFiles:()=>[...files.values()].filter(file=>file.extension==='md'),getResourcePath:(file:TFile)=>'app://'+file.path,
  read:async(file:TFile)=>{counters.reads.push(file);await controls.beforeRead?.(file);if(!texts.has(file))throw Error('missing');return texts.get(file)!;},
  createBinary:async(path:string,bytes:ArrayBuffer)=>{if(files.has(path))throw Error('existing attachment');counters.binaries++;const file=new TFile(path,bytes.byteLength);files.set(path,file);return file;},
  process:async(note:TFile,change:(raw:string)=>string)=>{counters.processes++;await controls.beforeProcess?.(note);if(controls.processFailures>0){controls.processFailures--;throw Error('write failed');}update(note,change(texts.get(note)!));if(controls.throwAfterCommit>0){controls.throwAfterCommit--;throw Error('commit acknowledgement failed');}},
 },metadataCache:{getFileCache:(file:TFile)=>{const raw=texts.get(file)||'',frontmatter:Record<string,string>={};for(const key of ['thoughtspace_media','source','video-note-id','yingjian-capture-id']){const match=new RegExp('^'+key+':\\s*(.+)$','m').exec(raw);if(match){try{frontmatter[key]=JSON.parse(match[1]);}catch{frontmatter[key]=match[1];}}}return{frontmatter};},getFirstLinkpathDest:(path:string,sourcePath:string)=>files.get(posix.normalize(posix.join(posix.dirname(sourcePath),path)))||files.get(path)||[...files.values()].find(file=>file.path.split('/').at(-1)===path)||null},
 fileManager:{getAvailablePathForAttachment:async(name:string)=>controls.attachmentPath||'Attachments/'+name,generateMarkdownLink:()=>{counters.links++;return '[wrong](../ambiguous.png)';}}};
 const operations={createNote:async(_title:string,raw:string)=>{counters.notes++;await controls.beforeCreate?.();return addNote(raw,`notes/new-${counters.notes}.md`);},openFile:async()=>{}};
 mountPlayer=(_host,options)=>{
  const record:typeof mounts[number]={options,state:{...options.state||{time:0,rate:1,volume:1}},plays:0,pauses:0,disposals:0};mounts.push(record);
  return{getState:()=>({...record.state}),play:()=>{record.plays++;options.onPlay?.();},seek:(time:number)=>{record.state.time=time;options.onState({...record.state});},pause:()=>{record.pauses++;options.onState({...record.state});},dispose:()=>{record.disposals++;options.onState({...record.state});if(record.disposalError)throw Error('player unload failed');}};
 };
 const urlApi={createObjectURL:(blob:Blob)=>{const url=`blob:test/${counters.urls.length+1}`;counters.urls.push({url,blob});return url;},revokeObjectURL:(url:string)=>counters.revoked.push(url)};
 const service=new MediaWorkspaceService(app,'plugin/media-state.json',operations),hooks=()=>({state:()=>{},capture:async()=>{},frame:async()=>{}}),host=()=>({isConnected:true,ownerDocument:{defaultView:{URL:urlApi,Blob}}} as unknown as HTMLElement);
 return{service,source,files,texts,storage,controls,counters,mounts,addNote,update,adapter,app,hooks,host};
}

test('same-source mounted players cannot overwrite active progress with old state',async()=>{
 const f=fixture(),first=f.service.mount(f.host(),f.source,f.hooks()),second=f.service.mount(f.host(),f.source,f.hooks());
 f.mounts[0].state=state(5);first.play();f.mounts[1].state=state(40);second.play();second.seek(40);
 f.mounts[0].options.onState(state(6));assert.equal(f.service.playback.get(f.service.identity(f.source)).time,40);
 first.dispose();f.mounts[0].options.onState(state(99));assert.equal(f.service.playback.get(f.service.identity(f.source)).time,40);
 await f.service.dispose();assert.deepEqual(f.mounts.map(m=>m.disposals),[1,1]);assert.equal(timers.size,0);
});
test('service forwards synchronous screenshot reservation and cancellation even after the source is gone',async()=>{
 const f=fixture(),transitions:[boolean,number][]=[];const handle=f.service.mount(f.host(),f.source,{...f.hooks(),frameCaptureState:(busy:boolean,time:number)=>transitions.push([busy,time])});
 f.mounts[0].options.onFrameCaptureState!(true,14);f.files.delete(f.source.path);handle.dispose();f.mounts[0].options.onFrameCaptureState!(false,14);
 assert.deepEqual(transitions,[[true,14],[false,14]]);await f.service.dispose();
});
test('dispose captures final state and unregisters every mounted player even after one teardown fails',async()=>{
 const f=fixture(),a=f.service.mount(f.host(),f.source,f.hooks());f.mounts[0].state=state(14.5);
 const other=new TFile('media/B.mp3');f.files.set(other.path,other);f.service.mount(f.host(),other,f.hooks());f.mounts[1].state=state(25);
 f.mounts[0].disposalError=true;await assert.rejects(f.service.dispose(),/player unload failed/);assert.deepEqual(f.mounts.map(m=>m.disposals),[1,1]);assert.equal(f.service.playback.get(f.service.identity(f.source)).time,14.5);
 a.play();a.seek(100);assert.equal(f.mounts[0].plays,0);f.mounts[0].options.onState(state(100));assert.equal(f.service.playback.get(f.service.identity(f.source)).time,14.5);
 assert.equal(JSON.parse(f.storage.get('plugin/media-state.json')!).entries.length,2);assert.equal(timers.size,0);
});
test('flush serializes overlapping snapshots and a failed write cannot poison later progress',async()=>{
 const f=fixture(),gate=deferred();let calls=0;f.controls.beforeWrite=async()=>{if(++calls===1){await gate.promise;throw Error('disk busy');}};
 f.service.playback.remember(f.service.identity(f.source),state(1));const first=f.service.flush();
 f.service.playback.remember(f.service.identity(f.source),state(2));const second=f.service.flush();
 const failed=assert.rejects(first,/disk busy/);await tick();assert.equal(f.counters.writes.length,1);gate.resolve();await failed;await second;
 assert.equal(JSON.parse(f.storage.get('plugin/media-state.json')!).entries[0].state.time,2);await f.service.dispose();
});
test('a delayed state load cannot replace live progress or revive a disposed service',async()=>{
 for(const dispose of [false,true]){
  const f=fixture(),gate=deferred();f.storage.set('plugin/media-state.json',JSON.stringify({version:1,entries:[{...f.service.identity(f.source),state:state(1)}]}));f.controls.beforeStateRead=()=>gate.promise;
  const loading=f.service.load();await tick();f.service.playback.remember(f.service.identity(f.source),state(30));
  if(dispose)await f.service.dispose();gate.resolve();await loading;assert.equal(f.service.playback.get(f.service.identity(f.source)).time,30);await f.service.dispose();
 }
});
test('concurrent moments create one note and preserve both immutable drafts',async()=>{
 const f=fixture(),first=draft('moment-0001',1,'first');const a=f.service.saveMoment(f.source,first);first.text='changed after dispatch';const b=f.service.saveMoment(f.source,draft('moment-0002',2,'second'));
 const [one,two]=await Promise.all([a,b]);assert.equal(one.note,two.note);assert.equal(f.counters.notes,1);
 const moments=await f.service.moments(f.source);assert.deepEqual(moments.entries.map((entry:any)=>entry.text),['first','second']);await f.service.dispose();
});
test('atomic process appends to the latest human edit and a failed append does not block the next queued moment',async()=>{
 const f=fixture(),note=f.addNote(notes.mediaNoteDocument(f.source.path));let changed=false;
 f.controls.beforeProcess=()=>{if(!changed){changed=true;f.update(note,f.texts.get(note)!+'Human edit\n');}};
 f.controls.processFailures=1;const failed=f.service.saveMoment(f.source,draft('moment-0001')),next=f.service.saveMoment(f.source,draft('moment-0002'));
 await assert.rejects(failed,/write failed/);await next;assert.match(f.texts.get(note)!,/Human edit/);assert.equal((await f.service.moments(f.source)).entries.length,1);await f.service.dispose();
});
test('screenshot retry reuses one attachment with an unambiguous vault-root encoded path',async()=>{
 const f=fixture();f.controls.attachmentPath='Screenshots/课 #1 (raw%).png';f.controls.processFailures=1;
 const snapshot={...draft(),image:new Blob(['PNG'],{type:'image/png'})};await assert.rejects(f.service.saveMoment(f.source,snapshot),/write failed/);
 const result=await f.service.saveMoment(f.source,snapshot),raw=f.texts.get(result.note)!;
 assert.equal(f.counters.binaries,1);assert.equal(f.counters.links,0);assert.ok(raw.includes('![视频截图](Screenshots/%E8%AF%BE%20%231%20%28raw%25%29.png)'));
 const entries=notes.readMediaMoments(raw,{vault:'vault',file:f.source.path});assert.equal(entries.length,1);assert.ok(entries[0].image?.includes('Screenshots/'));assert.ok(!entries[0].image?.includes('../'));
 await f.service.saveMoment(f.source,snapshot);assert.equal(f.counters.binaries,1);assert.equal(notes.readMediaMoments(f.texts.get(result.note)!,{vault:'vault',file:f.source.path}).length,1);await f.service.dispose();
});
test('retry after a committed write with failed acknowledgement cannot duplicate the moment or image',async()=>{
 const f=fixture();f.controls.throwAfterCommit=1;const snapshot={...draft(),image:new Blob(['PNG'],{type:'image/png'})};
 await assert.rejects(f.service.saveMoment(f.source,snapshot),/acknowledgement/);await f.service.saveMoment(f.source,snapshot);
 assert.equal(f.counters.binaries,1);assert.equal((await f.service.moments(f.source)).entries.length,1);await f.service.dispose();
});
test('invalid text and empty screenshot blobs cause no note or attachment side effects',async()=>{
 const f=fixture();for(const invalid of [{...draft(),text:'x'.repeat(100001)},{...draft(),text:'bad\0text'},{...draft(),image:new Blob([],{type:'image/png'})}])assert.throws(()=>f.service.saveMoment(f.source,invalid),/无效/);
 assert.equal(f.counters.notes,0);assert.equal(f.counters.binaries,0);await f.service.dispose();
});
test('a draft frozen before the host call rejects changes to its source path, mtime or size without write side effects',async()=>{
 for(const field of ['path','mtime','size'] as const){
  const f=fixture(),source={...f.service.identity(f.source)};
  if(field==='path'){f.files.delete(f.source.path);f.source.path='media/renamed.mp4';f.files.set(f.source.path,f.source);}else f.source.stat[field]++;
  assert.throws(()=>f.service.saveMoment(f.source,{...draft(),source}),/草稿的媒体已变化/);assert.equal(f.counters.notes,0);assert.equal(f.counters.binaries,0);assert.equal(f.counters.processes,0);await f.service.dispose();
 }
});
test('a queued save snapshots the supplied source identity before its caller mutates the draft object',async()=>{
 const f=fixture(),gate=deferred();f.controls.beforeProcess=()=>gate.promise;
 const first=f.service.saveMoment(f.source,draft('first')),source={...f.service.identity(f.source)},pending=f.service.saveMoment(f.source,{...draft('second',4,'captured text'),source});
 source.path='media/different.mp4';source.mtime+=100;source.size+=100;await tick();gate.resolve();await first;const saved=await pending;
 assert.equal(notes.readMediaMoments(f.texts.get(saved.note)!,{vault:'vault',file:f.source.path}).length,2);assert.ok(f.texts.get(saved.note)!.includes('captured text'));await f.service.dispose();
});
for(const mutation of ['modify','rename','replace'] as const)test(`${mutation} while saving cannot attribute a queued draft to another source incarnation`,async()=>{
 const f=fixture(),note=f.addNote(notes.mediaNoteDocument(f.source.path));f.controls.beforeProcess=()=>{
  if(mutation==='modify')f.source.stat.mtime++;
  if(mutation==='rename'){f.files.delete(f.source.path);f.source.path='media/Renamed.mp4';f.files.set(f.source.path,f.source);}
  if(mutation==='replace')f.files.set(f.source.path,new TFile(f.source.path,f.source.stat.size,f.source.stat.mtime));
 };
 await assert.rejects(f.service.saveMoment(f.source,draft()),/媒体已移动|媒体已.*更新/);assert.equal(f.texts.get(note),notes.mediaNoteDocument('media/A.mp4'));
 if(mutation!=='replace')assert.throws(()=>f.service.saveMoment(f.source,draft()),/媒体已变化/);await f.service.dispose();
});
test('a replaced note is revalidated inside atomic process instead of overwriting its replacement',async()=>{
 const f=fixture(),note=f.addNote(notes.mediaNoteDocument(f.source.path));f.controls.beforeProcess=()=>{const replacement=new TFile(note.path,50);f.files.set(note.path,replacement);f.texts.set(replacement,'Replacement content');};
 await assert.rejects(f.service.saveMoment(f.source,draft()),/记录笔记.*来源已变化/);assert.equal(f.texts.get(f.files.get(note.path)!)!,'Replacement content');await f.service.dispose();
});
test('cached notes moved to plugin backups are never appended to',async()=>{
 const f=fixture(),first=await f.service.saveMoment(f.source,draft());const raw=f.texts.get(first.note);f.files.delete(first.note.path);first.note.path='ThoughtSpace-plugin-backups/protected.md';f.files.set(first.note.path,first.note);
 const next=await f.service.saveMoment(f.source,draft('moment-0002'));assert.notEqual(next.note,first.note);assert.equal(f.texts.get(first.note),raw);await f.service.dispose();
});
test('legacy moments require the exact current vault source and accept only its explicit historical vault id',async()=>{
 const f=fixture(),absolute='/vaultroot/'+f.source.path,hash=createHash('sha256').update('/vaultroot').digest('hex').slice(0,20);
 const link=(video:string,vault:string)=>'yingjian://open?'+new URLSearchParams({video,t:'12.5',vault}).toString();
 f.addNote(`---\nsource: "/elsewhere/media/A.mp4"\nvideo-note-id: wrong\n---\n\n> [0:12](${link('/elsewhere/media/A.mp4',hash)})\n> wrong file\n`,'notes/wrong.md');
 const note=f.addNote(`---\nsource: ${JSON.stringify(absolute)}\nvideo-note-id: real\n---\n\n> [0:12](${link(absolute,hash)})\n> right file\n\n> [0:12](${link(absolute,'wrong-vault')})\n> wrong vault\n`,'notes/right.md');
 const result=await f.service.moments(f.source);assert.equal(result.note,note);assert.equal(result.entries.length,1);assert.equal(result.entries[0].text,'right file');assert.equal(result.entries[0].time,12.5);await f.service.dispose();
});

const legacyNote=(kind:'video-note-id'|'yingjian-capture-id',text:string,time=12)=>`---\nsource: "/vaultroot/media/A.mp4"\n${kind}: old-note\n---\n\n> [0:12](yingjian://open?video=%2Fvaultroot%2Fmedia%2FA.mp4&t=${time})\n> ${text}\n\n^video-t-shared\n`;
test('all exact-source notes are aggregated once with source-qualified keys and a preferred native primary',async()=>{
 const f=fixture(),capture=f.addNote(legacyNote('yingjian-capture-id','capture'),'notes/0-capture.md'),course=f.addNote(legacyNote('video-note-id','course'),'notes/1-course.md');
 const native=f.addNote(notes.appendMediaMoment(notes.mediaNoteDocument(f.source.path),draft('shared',12,'native'),{vault:'vault',file:f.source.path}),'notes/2-native.md');
 const wrong=f.addNote(legacyNote('video-note-id','wrong').replaceAll('/vaultroot/media/A.mp4','/another-vault/media/A.mp4'),'notes/wrong.md');
 const result=await f.service.moments(f.source);assert.equal(result.note,native);assert.equal(result.entries.length,3);assert.equal(new Set(result.entries.map((entry:any)=>entry.key)).size,3);
 assert.deepEqual(new Set(result.entries.map((entry:any)=>entry.notePath)),new Set([capture.path,course.path,native.path]));assert.deepEqual(result.entries.map((entry:any)=>entry.id),['shared','shared','shared']);
 for(const note of[capture,course,native])assert.equal(f.counters.reads.filter(read=>read===note).length,1);assert.ok(!f.counters.reads.includes(wrong));assert.equal(result.warnings,undefined);await f.service.dispose();
});
test('course beats the first capture, and a newly indexed native note supersedes the cached course for saving',async()=>{
 const f=fixture(),capture=f.addNote(legacyNote('yingjian-capture-id','capture'),'notes/0-capture.md'),course=f.addNote(legacyNote('video-note-id','course'),'notes/1-course.md');
 assert.equal((await f.service.moments(f.source)).note,course);assert.equal((await f.service.saveMoment(f.source,draft('first-save'))).note,course);
 const native=f.addNote(notes.mediaNoteDocument(f.source.path),'notes/native.md');assert.equal((await f.service.saveMoment(f.source,draft('second-save'))).note,native);
 assert.ok(!f.texts.get(capture)!.includes('thoughtspace-media-'));assert.ok(f.texts.get(course)!.includes('thoughtspace-media-first-save'));assert.ok(!f.texts.get(course)!.includes('second-save'));assert.equal(f.counters.notes,0);await f.service.dispose();
});
test('a retry finds a committed id in its original note even when the preferred note changes',async()=>{
 const f=fixture(),course=f.addNote(legacyNote('video-note-id','course'));f.controls.throwAfterCommit=1;
 await assert.rejects(f.service.saveMoment(f.source,draft()),/acknowledgement/);const native=f.addNote(notes.mediaNoteDocument(f.source.path));
 assert.equal((await f.service.saveMoment(f.source,draft())).note,course);assert.ok(!f.texts.get(native)!.includes('thoughtspace-media-moment'));await f.service.dispose();
});
for(const mutation of ['modify','rename','replace'] as const)test(`timeline discards a note that ${mutation}s during its read and reports the missing portion`,async()=>{
 const f=fixture(),changed=f.addNote(legacyNote('video-note-id','old'),'notes/course.md'),safe=f.addNote(legacyNote('yingjian-capture-id','safe'),'notes/capture.md'),gate=deferred();
 f.controls.beforeRead=note=>note===changed?gate.promise:undefined;const pending=f.service.moments(f.source);await tick();
 if(mutation==='modify')f.update(changed,legacyNote('video-note-id','new'));
 if(mutation==='rename'){f.files.delete(changed.path);changed.path='notes/moved.md';f.files.set(changed.path,changed);}
 if(mutation==='replace'){const replacement=new TFile(changed.path,changed.stat.size,changed.stat.mtime);f.files.set(changed.path,replacement);f.texts.set(replacement,legacyNote('video-note-id','replacement'));}
 gate.resolve();const result=await pending;assert.equal(result.note,safe);assert.deepEqual(result.entries.map((entry:any)=>entry.text),['safe']);assert.match(result.warnings.join(' '),/变化|无法读取/);await f.service.dispose();
});
test('a previously read note is revalidated after a later note awaited I/O',async()=>{
 const f=fixture(),first=f.addNote(legacyNote('video-note-id','old')),second=f.addNote(legacyNote('yingjian-capture-id','safe')),gate=deferred();
 f.controls.beforeRead=note=>note===second?gate.promise:undefined;const pending=f.service.moments(f.source);await tick();f.update(first,legacyNote('video-note-id','changed'));gate.resolve();
 const result=await pending;assert.deepEqual(result.entries.map((entry:any)=>entry.text),['safe']);assert.ok(result.warnings.length);await f.service.dispose();
});
test('overlong documents are explicitly reported and cannot redirect a save into a lower-priority capture',async()=>{
 const f=fixture();f.addNote(notes.mediaNoteDocument(f.source.path)+'x'.repeat(500001),'notes/primary.md');f.addNote(legacyNote('yingjian-capture-id','safe'));
 const result=await f.service.moments(f.source);assert.deepEqual(result.entries.map((entry:any)=>entry.text),['safe']);assert.match(result.warnings.join(' '),/500,000/);
 await assert.rejects(f.service.saveMoment(f.source,draft()),/主媒体笔记未能完整读取/);assert.equal(f.counters.processes,0);await f.service.dispose();
});
test('candidate and total read budgets warn explicitly instead of silently truncating notes',async()=>{
 for(const kind of ['count','bytes'] as const){
  const f=fixture(),count=kind==='count'?201:19;for(let index=0;index<count;index++)f.addNote(legacyNote('yingjian-capture-id',String(index))+(kind==='bytes'?'x'.repeat(490000):''));
  const result=await f.service.moments(f.source);assert.ok(result.entries.length>0&&result.entries.length<count);assert.match(result.warnings.join(' '),kind==='count'?/200 篇/:/8 MB/);assert.equal(new Set(f.counters.reads).size,f.counters.reads.length);await f.service.dispose();
 }
});
test('the entry cap is shared fairly across notes and leaves an explicit warning',async()=>{
 const f=fixture(),url=notes.mediaPlayerUrl({vault:'vault',file:f.source.path},1),raw=notes.mediaNoteDocument(f.source.path)+Array.from({length:3000},(_,i)=>`> [0:01](${url})\n> row ${i}\n\n`).join('');
 assert.ok(raw.length<500000);const a=f.addNote(raw,'notes/a.md'),b=f.addNote(raw,'notes/b.md'),result=await f.service.moments(f.source);
 assert.equal(result.entries.length,5000);assert.equal(result.entries.filter((entry:any)=>entry.notePath===a.path).length,2500);assert.equal(result.entries.filter((entry:any)=>entry.notePath===b.path).length,2500);assert.match(result.warnings.join(' '),/5000/);await f.service.dispose();
});
test('local short wiki and relative Markdown images resolve against their original note while literals remain intact',async()=>{
 const f=fixture(),local=new TFile('notes/course/frame.png'),wrong=new TFile('elsewhere/frame.png'),relative=new TFile('notes/assets/课 #1.png');for(const file of[wrong,local,relative])f.files.set(file.path,file);
 const text='![相对](../assets/%E8%AF%BE%20%231.png)\n`![[frame.png]]`\n<!-- ![[frame.png]] -->\n```md\n![[frame.png]]\n```';
 const note=f.addNote(notes.appendMediaMoment(notes.mediaNoteDocument(f.source.path),{...draft('images',5,text),image:'![[frame.png|640]]'},{vault:'vault',file:f.source.path}),'notes/course/lesson.md');const original=f.texts.get(note),result=await f.service.moments(f.source),entry=result.entries[0];
 assert.equal(entry.image,'![视频截图|640](notes/course/frame.png)');assert.ok(entry.text.includes('![相对](notes/assets/%E8%AF%BE%20%231.png)'));assert.ok(entry.text.includes('`![[frame.png]]`'));assert.ok(entry.text.includes('<!-- ![[frame.png]] -->'));assert.ok(entry.text.includes('```md\n![[frame.png]]\n```'));assert.equal(f.texts.get(note),original);assert.equal(result.warnings,undefined);await f.service.dispose();
});
test('unresolved local images become visible repair hints instead of ambiguous links on another board',async()=>{
 const f=fixture();f.addNote(notes.appendMediaMoment(notes.mediaNoteDocument(f.source.path),{...draft(),image:'![[missing.png]]'},{vault:'vault',file:f.source.path}));const result=await f.service.moments(f.source);
 assert.equal(result.entries[0].image,undefined);assert.match(result.entries[0].text,/截图未找到/);assert.match(result.warnings.join(' '),/截图附件无法解析/);await f.service.dispose();
});

const srt='1\n00:00:01,000 --> 00:00:02,500\nhello\n';
test('SRT is read only on subtitle demand, converted once and revoked with its mounted owner',async()=>{
 const f=fixture(),subtitle=f.addNote(srt,'media/A.srt'),player=f.service.mount(f.host(),f.source,f.hooks());
 assert.equal(f.counters.reads.length,0);assert.equal(f.counters.urls.length,0);player.play();
 const track=f.mounts[0].options.tracks![0],one=await track.src(),two=await track.src();assert.equal(one,two);
 assert.deepEqual(f.counters.reads,[subtitle]);assert.equal(f.counters.urls.length,1);assert.match(await f.counters.urls[0].blob.text(),/^WEBVTT\n/);assert.match(await f.counters.urls[0].blob.text(),/00:00:01\.000 --> 00:00:02\.500/);
 assert.ok(!f.counters.reads.includes(f.source));player.dispose();assert.deepEqual(f.counters.revoked,[one]);await f.service.dispose();assert.deepEqual(f.counters.revoked,[one]);
});
test('native VTT takes precedence over SRT and requires no text or binary reads',async()=>{
 const f=fixture();f.addNote(srt,'media/A.srt');const vtt=f.addNote('WEBVTT\n','media/A.vtt');f.service.mount(f.host(),f.source,f.hooks());
 assert.equal(await f.mounts[0].options.tracks![0].src(),'app://'+vtt.path);assert.deepEqual(f.counters.reads,[]);assert.deepEqual(f.counters.urls,[]);await f.service.dispose();
});
test('oversized SRT is rejected before reading and invalid SRT creates no Blob URL',async()=>{
 for(const invalid of ['oversized','invalid']){
  const f=fixture(),subtitle=f.addNote(invalid==='invalid'?'not subtitles':srt,'media/A.srt');if(invalid==='oversized')subtitle.stat.size=1024*1024+1;
  f.service.mount(f.host(),f.source,f.hooks());await assert.rejects(async()=>f.mounts[0].options.tracks![0].src());
  assert.equal(f.counters.reads.length,invalid==='oversized'?0:1);assert.deepEqual(f.counters.urls,[]);await f.service.dispose();
 }
});
for(const mutation of ['dispose','modify-subtitle','replace-subtitle','rename-subtitle','replace-media'] as const)test(`${mutation} during SRT loading cannot publish a stale Blob URL`,async()=>{
 const f=fixture(),subtitle=f.addNote(srt,'media/A.srt'),gate=deferred(),player=f.service.mount(f.host(),f.source,f.hooks());
 f.controls.beforeRead=()=>gate.promise;const pending=f.mounts[0].options.tracks![0].src();const rejected=assert.rejects(async()=>pending,/字幕文件已变化/);
 if(mutation==='dispose')player.dispose();
 if(mutation==='modify-subtitle')subtitle.stat.mtime++;
 if(mutation==='replace-subtitle')f.files.set(subtitle.path,new TFile(subtitle.path,subtitle.stat.size,subtitle.stat.mtime));
 if(mutation==='rename-subtitle'){f.files.delete(subtitle.path);subtitle.path='media/elsewhere.srt';f.files.set(subtitle.path,subtitle);}
 if(mutation==='replace-media')f.files.set(f.source.path,new TFile(f.source.path,f.source.stat.size,f.source.stat.mtime));
 gate.resolve();await rejected;assert.deepEqual(f.counters.urls,[]);await f.service.dispose();
});

// A board card is registered with the same coordinator but is not a workspace-owned mount.
test('service unload snapshots and pauses board-owned players before flushing resume state',async()=>{
 const f=fixture(),identity=f.service.identity(f.source);let pauses=0;
 const handle={getState:()=>state(27.25),play(){},seek(){},dispose(){},pause(){pauses++;f.service.playback.remember(identity,state(27.25),handle);}};
 const unregister=f.service.playback.register(identity,handle);await f.service.dispose();
 assert.equal(pauses,1);assert.equal(JSON.parse(f.storage.get('plugin/media-state.json')!).entries[0].state.time,27.25);unregister();
});
