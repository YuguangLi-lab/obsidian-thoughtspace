import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as model from '../src/collection-model';
import * as json from '../src/collection-json-store';
import * as markdown from '../src/markdown-context';
import * as literals from '../src/markdown-literals';
import * as excerpts from '../src/excerpt-sources';
import {paragraphLink} from '../src/paragraph-card';
import type {App,CachedMetadata,TFile as NativeFile} from 'obsidian';
import type {CollectionLibrary} from '../src/collection-library';
import type {CollectionNoteTarget,CollectionNoteExportReceipt} from '../src/collection-note-export';

const yaml=createRequire(import.meta.url)('js-yaml') as {load:(source:string)=>unknown};
class TFile {
 stat={mtime:1,ctime:1,size:1};constructor(public path:string){}
 get name(){return this.path.split('/').at(-1)!;}get extension(){return this.name.split('.').at(-1)!;}get basename(){return this.name.replace(/\.[^.]+$/,'');}
}
class TFolder {constructor(public path:string){}}
class MarkdownView {
 editor={getValue:()=>this.value};
 constructor(public file:TFile,public value:string,private readonly saveAction:(text:string)=>void){}
 getMode(){return'source';}async save(){this.saveAction(this.value);}
}
function load<T>(path:string,dependencies:Record<string,unknown>):T{
 const module={exports:{}};
 new Function('require','module','exports',transformSync(readFileSync(path,'utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
  assert.ok(Object.hasOwn(dependencies,name),`unexpected dependency ${name}`);return dependencies[name];
 },module,module.exports);
 return module.exports as T;
}
const native=load<typeof import('../src/native-note-state')>('src/native-note-state.ts',{obsidian:{MarkdownView}});
const exports=load<typeof import('../src/collection-note-export')>('src/collection-note-export.ts',{
 obsidian:{TFile,TFolder,parseYaml:yaml.load},'./collection-model':model,'./collection-json-store':json,
 './native-note-state':native,'./markdown-context':markdown,'./markdown-literals':literals,'./excerpt-sources':excerpts,'./paragraph-card':{paragraphLink},
});
const identity={id:'capture-export-12345678',createdAt:'2026-10-20T12:00:00.000Z'};
const directory='.obsidian/plugins/thoughtspace/collection-library/note-exports';
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
async function waitForEntry(signal:Promise<void>,pending:Promise<CollectionNoteExportReceipt>,boundary:'process'|'create'){
 // WebCrypto may still be pending after hundreds of event-loop turns on CI.
 // Wait for the fixture's actual storage boundary without hiding early failure.
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  await Promise.race([
   signal,
   pending.then(receipt=>{throw Error(`commit finished before ${boundary} entry: ${receipt.status}${receipt.message?`: ${receipt.message}`:''}`);},cause=>{throw Error(`commit rejected before ${boundary} entry`,{cause});}),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(`timed out after 5000ms waiting for ${boundary} entry`)),5000);}),
  ]);
 }finally{clearTimeout(timer);}
}
function position(raw:string,start:number,end:number){
 const point=(offset:number)=>({offset,line:raw.slice(0,offset).split('\n').length-1,col:offset-(raw.lastIndexOf('\n',offset-1)+1)});
 return{start:point(start),end:point(end)};
}
function metadata(raw:string):CachedMetadata {
 const header=/^---\n([\s\S]*?)\n---\n/.exec(raw);
 const headings=[...raw.matchAll(/^(#{1,6}) (.*)$/gm)].map(match=>({heading:match[2].trim(),level:match[1].length,position:position(raw,match.index,match.index+match[0].length)}));
 const cache:CachedMetadata={frontmatter:header?yaml.load(header[1]) as CachedMetadata['frontmatter']:undefined,headings,links:[],embeds:[]};
 for(const match of raw.matchAll(/!?\[\[([^\]\n]+)\]\]|!?\[([^\]\n]*)\]\(([^)\n]+)\)/g)){
  const original=match[0],embed=original.startsWith('!'),link=match[1]?.split('|')[0]||match[3],displayText=match[1]?.includes('|')?match[1].split('|').slice(1).join('|'):match[2];
  (embed?cache.embeds!:cache.links!).push({original,link,displayText,position:position(raw,match.index,match.index+original.length)});
 }
 return cache;
}
function fixture(body='保留正文\n\n- [ ] 待办',targetText='---\r\nkeep: &id [a, b] # exact\r\ncopy: *id\r\n---\r\n# Overview\r\nfirst\r\n## Same\r\nold A\r\n## Same\r\nold B\r\n# End\r\ntail'){
 const files=new Map<string,TFile|TFolder>(),disk=new Map<TFile,string>(),journals=new Map<string,string>(),cache=new Map<TFile,CachedMetadata>();
 const root=new TFolder('');files.set('',root);files.set('Inbox',new TFolder('Inbox'));files.set('Notes',new TFolder('Notes'));files.set('Assets',new TFolder('Assets'));
 let serial=0,active=true,targetWrites=0,processes=0,creates=0,ensures=0,journalWrites=0;
 const processEntered=deferred(),createEntered=deferred();
 const views:MarkdownView[]=[];
 const controls:{
  processGate?:Promise<void>;createGate?:Promise<void>;beforeProcess?:()=>void;afterWrite?:()=>void;
  failure?:'before'|'after';readbackFailure?:boolean;skipProcess?:boolean;damage?:(text:string)=>string;
  journalFail?:'intent'|'receipt';afterIntent?:()=>void;resolveOverride?:(path:string)=>TFile|null;shortLinks?:boolean;
 }={};
 const listeners=new Map<string,Set<(...args:unknown[])=>void>>();
 const on=(name:string,callback:(...args:unknown[])=>void)=>{const set=listeners.get(name)||new Set();set.add(callback);listeners.set(name,set);return{name,callback};};
 const offref=(ref:{name:string;callback:(...args:unknown[])=>void})=>listeners.get(ref.name)?.delete(ref.callback);
 const emit=(name:string,...args:unknown[])=>{for(const callback of listeners.get(name)||[])callback(...args);};
 const put=(path:string,text:string)=>{const file=new TFile(path);file.stat.size=new TextEncoder().encode(text).byteLength;files.set(path,file);disk.set(file,text);cache.set(file,metadata(text));return file;};
 const source=put('Inbox/Capture.md',model.collectionNoteSource({...identity,body,tags:['测试']})),target=put('Notes/Target.md',targetText);
 const setText=(file:TFile,text:string,notify=true)=>{disk.set(file,text);file.stat.size=new TextEncoder().encode(text).byteLength;file.stat.mtime++;if(notify)emit('modify',file);};
 const adapter:json.CollectionJsonAdapter={
  exists:async path=>files.has(path)||journals.has(path),
  list:async path=>({files:[...journals.keys()].filter(name=>name.startsWith(path+'/'))}),
  stat:async path=>journals.has(path)?{size:new TextEncoder().encode(journals.get(path)!).byteLength}:null,
  read:async path=>{if(!journals.has(path))throw Error('absent');return journals.get(path)!;},
  write:async(path,text)=>{journals.set(path,text);},
  copy:async(from,to)=>{if(journals.has(to))throw Error('already exists');const text=journals.get(from)!;if(controls.journalFail==='intent')throw Error('intent refused');journals.set(to,text);journalWrites++;controls.afterIntent?.();},
  process:async(path,change)=>{if(controls.journalFail==='receipt')throw Error('receipt refused');const next=change(journals.get(path)!);journals.set(path,next);journalWrites++;return next;},
  remove:async path=>{journals.delete(path);},
 };
 const app={
  workspace:{getLeavesOfType:()=>views.map(view=>({view})),containerEl:{ownerDocument:{defaultView:{setTimeout}}}},
  vault:{
   adapter,on,offref,getRoot:()=>root,getAbstractFileByPath:(path:string)=>files.get(path),
   getFiles:()=>[...files.values()].filter((file):file is TFile=>file instanceof TFile),getMarkdownFiles:()=>[...disk.keys()].filter(file=>file.extension==='md'),
   read:async(file:TFile)=>{if(controls.readbackFailure&&targetWrites&&file!==source)throw Error('readback unavailable');const text=disk.get(file);if(text===undefined)throw Error('absent');return text;},
   process:async(file:TFile,change:(text:string)=>string)=>{processes++;processEntered.resolve();await controls.processGate;controls.beforeProcess?.();if(controls.failure==='before')throw Error('write refused');if(controls.skipProcess)return;
    const next=change(disk.get(file)!);setText(file,controls.damage?.(next)??next);targetWrites++;controls.afterWrite?.();if(controls.failure==='after')throw Error('lost response');return next;},
   create:async(path:string,text:string)=>{creates++;createEntered.resolve();await controls.createGate;if(files.has(path))throw Error('already exists');if(controls.failure==='before')throw Error('create refused');
    const file=put(path,controls.damage?.(text)??text);emit('create',file);targetWrites++;controls.afterWrite?.();if(controls.failure==='after')throw Error('lost create response');return file;},
  },
  metadataCache:{
   getFileCache:(file:TFile)=>cache.get(file),
   getFirstLinkpathDest:(path:string,sourcePath:string)=>{
    if(controls.resolveOverride)return controls.resolveOverride(path);
    // Native 1.14.4 resolves an exact vault path before current-folder suffixes.
    // Short names without an exact root file still prefer a nearby candidate.
    for(const p of [path,path+'.md']){const found=files.get(p);if(found instanceof TFile)return found;}
    const pieces=sourcePath.split('/').slice(0,-1);
    for(const piece of path.split('/')){if(piece==='..')pieces.pop();else if(piece!=='.'&&piece)pieces.push(piece);}
    const relative=pieces.join('/');
    for(const p of [relative,relative+'.md']){const found=files.get(p);if(found instanceof TFile)return found;}
    return [...disk.keys()].find(file=>file.path.endsWith('/'+path)||file.path.endsWith('/'+path+'.md'))||null;
   },
  },
  fileManager:{generateMarkdownLink:(file:TFile,_sourcePath:string,subpath='',alias?:string)=>`[[${(controls.shortLinks?file.name:file.path).replace(/\.md$/,'')}${subpath}${alias===undefined?'':'|'+alias}]]`},
 } as unknown as App;
 const library={
  resolve:async(record:typeof identity,path:string)=>{const file=files.get(path);return file instanceof TFile&&model.collectionNoteBody(disk.get(file)!,yaml.load,record)!==undefined?file:undefined;},
  watchIdentity:()=>{let invalid=false,released=false;const changed=()=>{invalid=true;};const refs=['modify','create','rename','delete'].map(name=>on(name,changed));
   return{current:(file:TFile)=>!released&&!invalid&&files.get(file.path)===file,release:()=>{released=true;refs.forEach(offref);}};},
 } as unknown as CollectionLibrary;
 const bridge={directory,newId:()=>`token-${++serial}`,isBoardFile:(file:NativeFile)=>file.path.endsWith('.thoughtspace.md'),ensureJournalDirectory:async(path:string)=>{assert.equal(path,directory);ensures++;files.set(path,new TFolder(path));}};
 const service=()=>new exports.CollectionNoteExporter(app,library,bridge),exporter=service();
 const record={...identity,path:source.path},current=()=>active;
 const prepare=(destination:CollectionNoteTarget={kind:'append',path:target.path})=>exporter.prepare(record,destination,current);
 return{source,target,files,disk,journals,cache,views,controls,app,exporter,service,current,record,prepare,put,setText,emit,
  processEntered:processEntered.promise,createEntered:createEntered.promise,
  cancel:()=>{active=false;},counts:()=>({targetWrites,processes,creates,ensures,journalWrites}),
  nativeView:(file=target)=>{const view=new MarkdownView(file,disk.get(file)!,text=>setText(file,text,false));views.push(view);return view;},
 };
}

test('preview is immutable, read-only and appends exact source body with native provenance',async()=>{
 const f=fixture(),source=f.disk.get(f.source),target=f.disk.get(f.target),p=await f.prepare();
 assert.equal(Object.isFrozen(p),true);assert.equal(Object.isFrozen(p.source),true);assert.equal(Object.isFrozen(p.target),true);
 assert.match(p.markdown,/保留正文\n\n- \[ \] 待办/);assert.match(p.markdown,/> 来源：\[\[Inbox\/Capture\.md\]\]/);
 assert.equal(f.journals.size,0);assert.equal(f.counts().targetWrites,0);assert.equal(f.counts().ensures,0);
 const result=await f.exporter.commit(p,f.current);assert.equal(result.status,'confirmed');
 assert.ok(f.disk.get(f.target)!.startsWith(target!));assert.equal(f.disk.get(f.source),source);assert.doesNotMatch(f.disk.get(f.source)!,/thoughtspace_archived/);
 assert.equal(JSON.parse(f.journals.get(p.journalPath)!).phase,'receipt');
});
test('duplicate headings are selected by exact offset and level, preserving all other bytes and frontmatter',async()=>{
 const f=fixture(),before=f.disk.get(f.target)!,headings=await f.exporter.headings(f.target.path,f.current);
 const same=headings.filter(item=>item.title==='Same\r'||item.title==='Same');assert.equal(same.length,2);
 const p=await f.prepare({kind:'append',path:f.target.path,heading:same[1]});assert.equal(p.heading!.offset,same[1].offset);
 const result=await f.exporter.commit(p,f.current);assert.equal(result.status,'confirmed');const after=f.disk.get(f.target)!;
 assert.ok(after.startsWith(before.slice(0,before.indexOf('# End'))));assert.ok(after.endsWith('# End\r\ntail'));
 assert.ok(after.indexOf('old B')<after.indexOf(p.markdown));assert.equal(after.split('thoughtspace-note-export:').length,2);
});
test('new note requires an existing folder, creates once and keeps original capture metadata solely in source',async()=>{
 const f=fixture(),p=await f.prepare({kind:'new',path:'Notes/New.md'}),result=await f.exporter.commit(p,f.current);
 assert.equal(result.status,'confirmed');const file=f.files.get('Notes/New.md') as TFile;assert.equal(f.disk.get(file),p.markdown);
 assert.doesNotMatch(f.disk.get(file)!,/thoughtspace_capture:/);assert.equal(f.counts().creates,1);
 await assert.rejects(f.prepare({kind:'new',path:'Absent/New.md'}),/已经存在/);
 await assert.rejects(f.prepare({kind:'new',path:'Notes/New.md'}),/文件已存在/);
});
for(const path of ['../out.md','/absolute.md','.obsidian/x.md','Notes/../x.md','Notes/Hidden/.new.md','Notes/not-json.canvas','Inbox/Capture.md'])test(`unsafe or self target ${path} is rejected`,async()=>{
 const f=fixture();await assert.rejects(f.prepare({kind:'new',path}));assert.equal(f.counts().targetWrites,0);assert.equal(f.journals.size,0);
});
test('board target is rejected',async()=>{const f=fixture();f.put('Notes/board.thoughtspace.md','text');await assert.rejects(f.prepare({kind:'append',path:'Notes/board.thoughtspace.md'}),/普通/);});
test('source attachments, aliases, embedded subpaths and self anchors retain explicit native file references',async()=>{
 const f=fixture('![预览](../Assets/photo.png)\n[[../Notes/Linked#Heading|别名]]\n![[../Notes/Linked#^block|200]]\n[[#Local]]\n[外部](https://example.com/a)');
 f.put('Assets/photo.png','image');f.put('Notes/Linked.md','# Heading\nbody');
 const p=await f.prepare({kind:'new',path:'Notes/Result.md'});
 assert.match(p.markdown,/!\[\[Assets\/photo.png\|预览\]\]/);assert.match(p.markdown,/\[\[Notes\/Linked\.md#Heading\|别名\]\]/);
 assert.match(p.markdown,/!\[\[Notes\/Linked\.md#\^block\|200\]\]/);assert.match(p.markdown,/\[\[Inbox\/Capture\.md#Local\]\]/);
 assert.match(p.markdown,/\[外部\]\(https:\/\/example.com\/a\)/);
});
test('code, external links and escaped examples stay byte-for-byte unchanged',async()=>{
 const body='```md\n![[missing.png]]\n```\n`[[inline]]`\n\\[[escaped]]\n[external](https://example.com/x)';
 const f=fixture(body),cache=f.cache.get(f.source)!;
 cache.links=cache.links!.filter(item=>item.link.startsWith('https:'));cache.embeds=[];
 const p=await f.prepare();assert.ok(p.markdown.includes(body));
});
test('unresolved, ambiguous, stale, overlapping and omitted local references fail closed',async()=>{
 const missing=fixture('![[missing.png]]');await assert.rejects(missing.prepare(),/尚未解析/);
 const ambiguous=fixture('[[Linked]]');const a=ambiguous.put('A/Linked.md','A');ambiguous.put('B/Linked.md','B');ambiguous.controls.resolveOverride=()=>a;await assert.rejects(ambiguous.prepare(),/歧义/);
 const stale=fixture('[[../Notes/Target]]');stale.cache.get(stale.source)!.links![0].original='[[wrong]]';await assert.rejects(stale.prepare(),/索引/);
 const overlap=fixture('[[../Notes/Target]]');overlap.cache.get(overlap.source)!.links!.push({...overlap.cache.get(overlap.source)!.links![0]});await assert.rejects(overlap.prepare(),/重叠/);
 const omitted=fixture('[[../Notes/Target]]');omitted.cache.get(omitted.source)!.links=[];await assert.rejects(omitted.prepare(),/未确认/);
});
test('two simultaneous commits share one target operation and later retry is already-present',{timeout:10000},async t=>{
 const f=fixture(),gate=deferred(),p=await f.prepare();f.controls.processGate=gate.promise;
 t.after(gate.resolve);
 const a=f.exporter.commit(p,f.current),b=f.exporter.commit(p,f.current);
 try{
  assert.equal(a,b);await waitForEntry(f.processEntered,a,'process');assert.equal(f.counts().processes,1);gate.resolve();
  assert.equal((await a).status,'confirmed');assert.equal((await b).status,'confirmed');
  assert.equal((await f.exporter.commit(p,f.current)).status,'already-present');assert.equal(f.counts().targetWrites,1);
 }finally{gate.resolve();}
});
for(const mode of ['append','new'] as const)test(`${mode} failure after a completed write is confirmed from exact readback`,async()=>{
 const f=fixture(),p=await f.prepare(mode==='new'?{kind:'new',path:'Notes/New.md'}:undefined);f.controls.failure='after';
 const receipt=await f.exporter.commit(p,f.current);assert.equal(receipt.status,'confirmed');assert.equal(receipt.recoveredAfterError,true);assert.equal(f.counts().targetWrites,1);
});
for(const mode of ['append','new'] as const)test(`${mode} failure before writing never archives source or retries target`,async()=>{
 const f=fixture(),before=f.disk.get(f.source),p=await f.prepare(mode==='new'?{kind:'new',path:'Notes/New.md'}:undefined);f.controls.failure='before';
 assert.equal((await f.exporter.commit(p,f.current)).status,'not-written');assert.equal(f.counts().targetWrites,0);assert.equal(f.disk.get(f.source),before);
 await f.exporter.commit(p,f.current);assert.equal(f.counts().processes+f.counts().creates,1);
});
for(const damage of ['source-body','source-rename','source-replacement','target-body','target-rename','target-replacement','native-input','closed-page'] as const)test(`queued ${damage} invalidates preview at atomic callback`,async()=>{
 const f=fixture(),view=damage==='native-input'?f.nativeView():undefined,p=await f.prepare(),beforeSource=f.disk.get(f.source);
 f.controls.beforeProcess=()=>{
  if(damage==='source-body')f.setText(f.source,beforeSource+'\nnew');
  else if(damage==='target-body')f.setText(f.target,f.disk.get(f.target)+'\nnew',false);
  else if(damage==='closed-page')f.cancel();
  else if(damage==='native-input')view!.value+='unsaved';
  else {const file=damage.startsWith('source')?f.source:f.target;if(damage.endsWith('rename')){const old=file.path;f.files.delete(old);file.path='Notes/Moved.md';f.files.set(file.path,file);f.emit('rename',file,old);}else f.files.set(file.path,new TFile(file.path));}
 };
 assert.equal((await f.exporter.commit(p,f.current)).status,'not-written');assert.equal(f.counts().targetWrites,0);
});
test('source bytes changed without metadata events are caught before intent persistence',async()=>{
 const f=fixture(),p=await f.prepare();f.disk.set(f.source,f.disk.get(f.source)+' silent change');
 assert.equal((await f.exporter.commit(p,f.current)).status,'not-written');assert.equal(f.journals.size,0);
});
test('native Properties edits and divergent native windows block preview',async()=>{
 const f=fixture(),one=f.nativeView(),two=f.nativeView();two.value+='different';await assert.rejects(f.prepare(),/多个/);
 f.views.splice(1,1);const metadataContainer={},active={isContentEditable:true,closest:()=>({closest:()=>metadataContainer})};
 Object.assign(one,{containerEl:{ownerDocument:{activeElement:active},contains:()=>true}});
 await assert.rejects(f.prepare(),/属性正在编辑/);
});
test('closed page after write retains confirmed receipt and never touches source',async()=>{
 const f=fixture(),p=await f.prepare(),source=f.disk.get(f.source);f.controls.afterWrite=f.cancel;
 assert.equal((await f.exporter.commit(p,f.current)).status,'confirmed');assert.equal(f.disk.get(f.source),source);
});
for(const mode of ['readback','replacement','rename','damage'] as const)test(`post-write ${mode} is unknown and further commits cannot replay`,async()=>{
 const f=fixture(),p=await f.prepare();f.controls.failure='after';
 if(mode==='readback')f.controls.readbackFailure=true;
 else if(mode==='damage')f.controls.damage=text=>text.replace('保留正文','truncated');
 else f.controls.afterWrite=()=>{if(mode==='replacement')f.files.set(f.target.path,new TFile(f.target.path));else{const old=f.target.path;f.files.delete(old);f.target.path='Notes/Renamed.md';f.files.set(f.target.path,f.target);f.emit('rename',f.target,old);}};
 assert.equal((await f.exporter.commit(p,f.current)).status,'unknown');assert.equal((await f.exporter.commit(p,f.current)).status,'unknown');assert.equal(f.counts().targetWrites,1);
});
test('an occupied new filename is never overwritten at create boundary',{timeout:10000},async t=>{
 const f=fixture(),p=await f.prepare({kind:'new',path:'Notes/New.md'}),gate=deferred();f.controls.createGate=gate.promise;
 t.after(gate.resolve);
 const pending=f.exporter.commit(p,f.current);
 try{
  await waitForEntry(f.createEntered,pending,'create');assert.equal(f.counts().creates,1);const other=f.put('Notes/New.md','someone else');gate.resolve();
  assert.equal((await pending).status,'unknown');assert.equal(f.disk.get(other),'someone else');assert.equal(f.counts().targetWrites,0);
 }finally{gate.resolve();}
});
test('journal intent failure stops before any target write',async()=>{
 const f=fixture(),p=await f.prepare();f.controls.journalFail='intent';assert.equal((await f.exporter.commit(p,f.current)).status,'not-written');assert.equal(f.counts().targetWrites,0);
});
test('receipt failure preserves intent, reports unknown and reopened history confirms via marker without writing',async()=>{
 const f=fixture(),p=await f.prepare();f.controls.journalFail='receipt';assert.equal((await f.exporter.commit(p,f.current)).status,'unknown');
 const writes=f.counts(),reopened=f.service(),history=await reopened.inspect(p.operationId);
 assert.equal(history.readOnly,true);assert.equal(history.journal!.phase,'intent');assert.equal(history.receipt!.status,'confirmed');assert.deepEqual(f.counts(),writes);
 assert.equal((await reopened.commit(p,f.current)).status,'not-written');assert.deepEqual(f.counts(),writes);
});
test('interrupted unknown history is read-only and cannot authorize source archival or another target',async()=>{
 const f=fixture(),p=await f.prepare();f.controls.readbackFailure=true;f.controls.journalFail='receipt';
 assert.equal((await f.exporter.commit(p,f.current)).status,'unknown');const writes=f.counts(),history=await f.service().inspect(p.operationId);
 assert.equal(history.receipt!.status,'unknown');assert.equal(history.readOnly,true);assert.deepEqual(f.counts(),writes);
});
test('missing or corrupt history is retained and readonly',async()=>{
 const f=fixture();assert.deepEqual(await f.service().inspect('export-absent'),{readOnly:true,journal:null,blocked:undefined});
 const p=await f.prepare();await f.exporter.commit(p,f.current);f.journals.set(p.journalPath,'{');
 const before=new Map(f.journals),result=await f.service().inspect(p.operationId);assert.ok(result.blocked);assert.deepEqual(f.journals,before);
});
test('discarded preview and forged immutable copies cannot write',async()=>{
 const f=fixture(),p=await f.prepare();assert.equal((await f.exporter.commit(Object.freeze({...p}),f.current)).status,'not-written');
 f.exporter.discard(p);assert.equal((await f.exporter.commit(p,f.current)).status,'not-written');assert.equal(f.journals.size,0);
});
test('size limits stop oversized bodies and target files without journaling',async()=>{
 const f=fixture();f.disk.set(f.source,model.collectionNoteSource({...identity,body:'x'.repeat(100000),tags:[]})+'more');await assert.rejects(f.prepare(),/100,000/);
 const large=fixture();large.target.stat.size=2*1024*1024+1;await assert.rejects(large.prepare(),/2 MiB/);assert.equal(large.journals.size,0);
});
test('unknown results lock this source across a fresh exporter and a different proposed destination',async()=>{
 const f=fixture(),p=await f.prepare();f.controls.readbackFailure=true;
 assert.equal((await f.exporter.commit(p,f.current)).status,'unknown');
 await assert.rejects(f.service().prepare(f.record,{kind:'new',path:'Notes/Different.md'},f.current),/待核对/);
 assert.equal(f.counts().targetWrites,1);
});
test('persisted pending lock blocks another preview before first target completes',{timeout:10000},async t=>{
 const f=fixture(),gate=deferred(),p=await f.prepare();f.controls.processGate=gate.promise;
 t.after(gate.resolve);
 const first=f.exporter.commit(p,f.current);
 try{
  await waitForEntry(f.processEntered,first,'process');assert.equal(f.counts().processes,1);
  await assert.rejects(f.service().prepare(f.record,{kind:'new',path:'Notes/Other.md'},f.current),/待核对/);
  gate.resolve();assert.equal((await first).status,'confirmed');assert.equal(f.counts().targetWrites,1);
 }finally{gate.resolve();}
});
test('two previously prepared independent previews cannot bypass the shared source lock',{timeout:10000},async t=>{
 const f=fixture(),other=f.service(),p=await f.prepare(),q=await other.prepare(f.record,{kind:'new',path:'Notes/Other.md'},f.current);
 const gate=deferred();f.controls.processGate=gate.promise;
 t.after(gate.resolve);
 const first=f.exporter.commit(p,f.current);
 try{
  await waitForEntry(f.processEntered,first,'process');assert.equal(f.counts().processes,1);
  assert.equal((await other.commit(q,f.current)).status,'not-written');assert.equal(f.counts().creates,0);
  gate.resolve();assert.equal((await first).status,'confirmed');
 }finally{gate.resolve();}
});
test('a confirmed source permits another explicit preview while history remains read-only',async()=>{
 const f=fixture(),p=await f.prepare();await f.exporter.commit(p,f.current);
 const before=new Map(f.journals),history=await f.service().history();assert.equal(history.items.length,1);assert.equal(history.items[0].receipt!.status,'confirmed');assert.deepEqual(f.journals,before);
 const q=await f.service().prepare(f.record,{kind:'new',path:'Notes/Another.md'},f.current);assert.notEqual(p.operationId,q.operationId);
});
test('history limits reads to the latest 20 canonical operations and deduplicates recovery materials',async()=>{
 const f=fixture(),p=await f.prepare();await f.exporter.commit(p,f.current);const base=JSON.parse(f.journals.get(p.journalPath)!);
 f.journals.clear();
 for(let index=0;index<25;index++){
  const operationId=`export-${1900000000000+index}-test`,journalPath=`${directory}/${operationId}.json`;
  const entry={...base,operationId,markdown:base.markdown.replace(p.operationId,operationId),receipt:{...base.receipt,operationId,journalPath}};
  f.journals.set(journalPath,JSON.stringify(entry));f.journals.set(journalPath+'.pending-extra.tmp','keep');
 }
 const before=new Map(f.journals),history=await f.service().history();
 assert.equal(history.items.length,20);assert.ok(history.warning);assert.equal(history.items[0].journal!.operationId,'export-1900000000024-test');
 assert.equal(history.items.at(-1)!.journal!.operationId,'export-1900000000005-test');assert.deepEqual(f.journals,before);
});
test('unclosed source or target code and local reference-style links stop at preview',async()=>{
 const source=fixture('```\nunfinished');await assert.rejects(source.prepare(),/尚未闭合/);
 const target=fixture('body','```\nunfinished');await assert.rejects(target.prepare(),/尚未闭合/);
 const references=fixture('[picture]\n\n[picture]: ../Assets/photo.png');await assert.rejects(references.prepare(),/引用式/);
});
test('stale missing and moved headings stop instead of inserting into a different section',async()=>{
 const missing=fixture();missing.cache.get(missing.target)!.headings=[];await assert.rejects(missing.prepare({kind:'append',path:missing.target.path,heading:{offset:0,level:1}}),/标题索引/);
 const moved=fixture(),headings=await moved.exporter.headings(moved.target.path,moved.current);const heading=headings[1];
 moved.disk.set(moved.target,'new intro\n'+moved.disk.get(moved.target));await assert.rejects(moved.prepare({kind:'append',path:moved.target.path,heading}),/标题索引|索引尚未同步/);
});
test('same-length heading rename with a stale cache cannot label a different destination section',async()=>{
 const f=fixture(),headings=await f.exporter.headings(f.target.path,f.current),heading=headings[1];
 f.disk.set(f.target,f.disk.get(f.target)!.replace('## Same','## Else'));
 await assert.rejects(f.prepare({kind:'append',path:f.target.path,heading}),/标题索引/);assert.equal(f.counts().targetWrites,0);
});
test('orphan pending source lock is visible in read-only history after intent journal loss',async()=>{
 const f=fixture(),p=await f.prepare();f.controls.journalFail='receipt';await f.exporter.commit(p,f.current);
 for(const key of [...f.journals.keys()])if(key.startsWith(p.journalPath))f.journals.delete(key);
 const before=new Map(f.journals),history=await f.service().history();
 assert.equal(history.items.length,1);assert.equal(history.items[0].receipt!.operationId,p.operationId);assert.equal(history.items[0].receipt!.status,'unknown');
 assert.match(history.items[0].receipt!.message!,/完整操作日志尚未确认/);assert.deepEqual(f.journals,before);
 await assert.rejects(f.service().prepare(f.record,{kind:'new',path:'Notes/Other.md'},f.current),/待核对/);
});
test('an unknown persisted receipt can be rechecked without changing journal or source lock',async()=>{
 const f=fixture(),p=await f.prepare();f.controls.readbackFailure=true;assert.equal((await f.exporter.commit(p,f.current)).status,'unknown');
 f.controls.readbackFailure=false;const before=new Map(f.journals),history=await f.service().inspect(p.operationId);
 assert.equal(history.journal!.receipt!.status,'unknown');assert.equal(history.receipt!.status,'confirmed');assert.deepEqual(f.journals,before);
 await assert.rejects(f.service().prepare(f.record,{kind:'new',path:'Notes/Other.md'},f.current),/待核对/);assert.equal(f.counts().targetWrites,1);
});
const resolvedExportLink=(f:ReturnType<typeof fixture>,link:string,targetPath:string)=>{
 const parts=excerpts.sourceLinkParts(link.replace(/^!/,''));assert.ok(parts.length,'generated link parses');
 return{file:f.app.metadataCache.getFirstLinkpathDest(parts[0].path,targetPath),subpath:parts[0].subpath};
};
for(const [sourcePath,targetPath] of [
 ['Inbox/Capture.md','Notes/Capture.md'],
 ['Capture.md','Notes/Capture.md'],
 ['Inbox/Capture.md','Inbox/Capture-整理.md'],
] as const)test(`provenance stays on exact ${sourcePath} after creating ${targetPath}`,async()=>{
 const f=fixture(),oldPath=f.source.path;f.files.delete(oldPath);f.source.path=sourcePath;f.files.set(sourcePath,f.source);f.record.path=sourcePath;f.controls.shortLinks=true;
 const before=f.disk.get(f.source),short=f.app.fileManager.generateMarkdownLink(f.source as NativeFile,targetPath);
 const p=await f.prepare({kind:'new',path:targetPath}),link=p.markdown.split('> 来源：')[1].trim();
 assert.equal(link,`[[${sourcePath}]]`);assert.equal(resolvedExportLink(f,link,targetPath).file,f.source);
 assert.equal((await f.exporter.commit(p,f.current)).status,'confirmed');
 const created=f.files.get(targetPath) as TFile;assert.equal(f.disk.get(created),p.markdown);assert.equal(f.disk.get(f.source),before);
 assert.equal(resolvedExportLink(f,link,targetPath).file,f.source);
 if(sourcePath==='Inbox/Capture.md'&&targetPath==='Notes/Capture.md')assert.equal(resolvedExportLink(f,short,targetPath).file,created,'native shortest link would now point to new note');
});
test('a new note sharing a related note basename cannot redirect links, aliases or embedded subpaths',async()=>{
 const f=fixture('[[../Knowledge/Shared#Heading|别名]]\n![[../Knowledge/Shared#^block|200]]'),related=f.put('Knowledge/Shared.md','# Heading\nbody ^block');
 f.controls.shortLinks=true;const source=f.disk.get(f.source),targetPath='Notes/Shared.md',p=await f.prepare({kind:'new',path:targetPath});
 assert.ok(p.markdown.includes('[[Knowledge/Shared.md#Heading|别名]]'));assert.ok(p.markdown.includes('![[Knowledge/Shared.md#^block|200]]'));
 assert.equal((await f.exporter.commit(p,f.current)).status,'confirmed');
 assert.deepEqual(resolvedExportLink(f,'[[Knowledge/Shared.md#Heading|别名]]',targetPath),{file:related,subpath:'#Heading'});
 assert.deepEqual(resolvedExportLink(f,'![[Knowledge/Shared.md#^block|200]]',targetPath),{file:related,subpath:'#^block'});
 assert.equal(f.disk.get(f.source),source);assert.equal(f.disk.get(f.files.get(targetPath) as TFile),p.markdown);
});
test('attachment and future Markdown target sharing a stem retain the exact attachment path and embed alias',async()=>{
 const f=fixture('[[../Assets/receipt.txt|相对附件]]\n![[../Assets/receipt.txt|附件预览]]'),attachment=f.put('Assets/receipt.txt','original attachment');
 f.controls.shortLinks=true;const targetPath='Notes/receipt.txt.md';
 const p=await f.prepare({kind:'new',path:targetPath});assert.ok(p.markdown.includes('[[Assets/receipt.txt|相对附件]]'));assert.ok(p.markdown.includes('![[Assets/receipt.txt|附件预览]]'));
 assert.equal((await f.exporter.commit(p,f.current)).status,'confirmed');
 assert.equal(resolvedExportLink(f,'[[Assets/receipt.txt|相对附件]]',targetPath).file,attachment);
 assert.equal(resolvedExportLink(f,'![[Assets/receipt.txt|附件预览]]',targetPath).file,attachment);assert.equal(f.disk.get(attachment),'original attachment');
});
test('explicit path encoding retains special attachment filenames, page fragments and Markdown alias',async()=>{
 const f=fixture('![PDF alias](../Assets/file%20%231%20%5Bdraft%5D.pdf#page=2)'),attachment=f.put('Assets/file #1 [draft].pdf','pdf');
 const targetPath='Notes/Copy.md',p=await f.prepare({kind:'new',path:targetPath}),link=p.markdown.split('\n')[1];
 assert.ok(link.startsWith('![PDF alias](<Assets/'));assert.ok(link.includes('%23'));assert.ok(/%5b/i.test(link));
 assert.equal((await f.exporter.commit(p,f.current)).status,'confirmed');
 assert.deepEqual(resolvedExportLink(f,link,targetPath),{file:attachment,subpath:'#page=2'});assert.equal(f.disk.get(f.files.get(targetPath) as TFile),p.markdown);
});
