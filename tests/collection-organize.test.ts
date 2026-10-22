import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as model from '../src/collection-model';
import * as guards from '../src/value-guards';
import type {App,TFile} from 'obsidian';
import type {CollectionFlagField,CollectionFlagWriteError} from '../src/collection-organize';

const yaml=createRequire(import.meta.url)('js-yaml') as {load:(source:string)=>unknown;dump:(value:unknown)=>string};
const identity={id:'capture-fixture-12345678',createdAt:'2026-10-13T12:00:00.000Z'};
const body='首行正文\r\n\r\n---\r\nnot_frontmatter: keep\r\n---\r\n末尾不补换行';
const original=`\uFEFF---\r\nthoughtspace_capture: ${identity.id}\r\nthoughtspace_created: "${identity.createdAt}"\r\nunknown: &custom\r\n  title: "原生: 属性" # comment may be normalized by the host\r\n  nested: [true, 12, null]\r\n  day: 2026-10-13\r\ncopy: *custom\r\ntags: [研究, 阅读/摘录]\r\n---\r\n${body}`;
function parse(source:string){
 const header=/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source)!;
 return{properties:yaml.load(header[1]) as Record<string,unknown>,body:source.slice(header[0].length)};
}
function serialize(properties:Record<string,unknown>,text=body){return`---\n${yaml.dump(properties)}---\n${text}`;}
class File {constructor(public path='Notes/收集.md'){}get extension(){return this.path.split('.').at(-1)!;}}
class MarkdownView {
 constructor(public file:File,public value:string,private readonly saveAction:(value:string)=>void){}
 editor={getValue:()=>this.value};getMode(){return'source';}
 async save(){this.saveAction(this.value);}
}
function load<T>(path:string,dependencies:Record<string,unknown>):T {
 const module={exports:{}};
 new Function('require','module','exports',transformSync(readFileSync(path,'utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
  assert.ok(Object.hasOwn(dependencies,name),`unexpected dependency ${name}`);return dependencies[name];
 },module,module.exports);
 return module.exports as T;
}
const native=load<typeof import('../src/native-note-state')>('src/native-note-state.ts',{'obsidian':{MarkdownView}});
const organize=load<typeof import('../src/collection-organize')>('src/collection-organize.ts',{'obsidian':{parseYaml:yaml.load},'./collection-model':model,'./native-note-state':native,'./value-guards':guards});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
async function until(condition:()=>boolean){for(let i=0;i<100&&!condition();i++)await Promise.resolve();assert.ok(condition(),'reached asynchronous host boundary');}
function fixture(source=original){
 const file=new File(),files=new Map<string,File>([[file.path,file]]),views:MarkdownView[]=[];
 let disk=source,active=true,reads=0,processes=0,writes=0,nativeSaves=0;
 const control:{readGate?:Promise<void>;propertiesGate?:Promise<void>;beforeProperties?:()=>void;afterProperties?:()=>void;failure?:'before'|'after';verificationReadFailure?:boolean;transform?:(source:string)=>string;skipCallback?:boolean}={};
 const app={
  workspace:{getLeavesOfType:()=>views.map(view=>({view})),containerEl:{ownerDocument:{defaultView:{setTimeout}}}},
  vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>{reads++;await control.readGate;if(writes&&control.verificationReadFailure)throw Error('verification unavailable');return disk;}},
  fileManager:{processFrontMatter:async(_file:File,change:(properties:unknown)=>void)=>{
   processes++;await control.propertiesGate;control.beforeProperties?.();if(control.failure==='before')throw Error('host refused write');
   if(control.skipCallback)return;
   const current=parse(disk);change(current.properties);const next=serialize(current.properties,current.body);
   disk=control.transform?control.transform(next):next;writes++;control.afterProperties?.();if(control.failure==='after')throw Error('host lost response');
  }},
 } as unknown as App;
 const set=(field:CollectionFlagField='thoughtspace_pinned',value=true,expectedFlag?:boolean)=>organize.setCollectionFlag(app,file as TFile,identity,field,value,()=>active,expectedFlag);
 return{app,file,files,views,control,set,source:()=>disk,replaceSource:(value:string)=>{disk=value;},cancel:()=>{active=false;},counts:()=>({reads,processes,writes,nativeSaves}),
  nativeView:(value=disk)=>{const view=new MarkdownView(file,value,next=>{nativeSaves++;disk=next;});views.push(view);return view;}};
}
function outcome(value:'not-written'|'unknown',message?:RegExp){return(error:unknown)=>{assert.ok(error instanceof organize.CollectionFlagWriteError);assert.equal((error as CollectionFlagWriteError).outcome,value);if(message)assert.match((error as Error).message,message);return true;};}

test('native collection flags default to false and accept only actual booleans',()=>{
 assert.deepEqual(organize.readCollectionFlags({}),{pinned:false,archived:false});
 assert.deepEqual(organize.readCollectionFlags({thoughtspace_pinned:true,thoughtspace_archived:false}),{pinned:true,archived:false});
 for(const field of ['thoughtspace_pinned','thoughtspace_archived'])for(const value of [undefined,null,'false',0,1,[],{}])assert.throws(()=>organize.readCollectionFlags({[field]:value}),/必须为布尔值/);
});
test('pin changes exactly one native property and preserves rich YAML semantics and CRLF body bytes',async()=>{
 const f=fixture(),receipt=await f.set('thoughtspace_pinned',true,false),after=parse(f.source()),before=parse(original);
 assert.deepEqual(receipt,{confirmed:true,...identity,path:f.file.path,field:'thoughtspace_pinned',value:true,previous:false,changed:true,recoveredAfterError:false});
 assert.equal(after.body,body);assert.deepEqual(after.properties,{...before.properties,thoughtspace_pinned:true});assert.deepEqual(f.counts(),{reads:2,processes:1,writes:1,nativeSaves:0});
});
test('archiving does not pin, change creation time, remove tags or copy the record',async()=>{
 const f=fixture(),receipt=await f.set('thoughtspace_archived',true,false),after=parse(f.source());
 assert.equal(receipt.field,'thoughtspace_archived');assert.equal(after.properties.thoughtspace_capture,identity.id);assert.equal(after.properties.thoughtspace_created,identity.createdAt);
 assert.deepEqual(after.properties.tags,['研究','阅读/摘录']);assert.equal(Object.hasOwn(after.properties,'thoughtspace_pinned'),false);assert.equal(f.files.size,1);
});
test('unpin uses explicit false while an absent false operation performs no write',async()=>{
 const empty=fixture();assert.equal((await empty.set('thoughtspace_pinned',false,false)).changed,false);assert.equal(empty.source(),original);assert.equal(empty.counts().processes,0);
 const f=fixture(serialize({...parse(original).properties,thoughtspace_pinned:true}));await f.set('thoughtspace_pinned',false,true);assert.equal(parse(f.source()).properties.thoughtspace_pinned,false);
});
test('visible flag CAS and malformed native flags reject before writing',async()=>{
 const stale=fixture();await assert.rejects(stale.set('thoughtspace_pinned',true,true),outcome('not-written',/其他窗口/));assert.equal(stale.counts().processes,0);
 const malformed=fixture(serialize({...parse(original).properties,thoughtspace_archived:'false'}));await assert.rejects(malformed.set(),outcome('not-written',/必须为布尔值/));assert.equal(malformed.counts().processes,0);
});
test('latest single native draft is saved first and its body is preserved by the flag write',async()=>{
 const f=fixture(),latest=serialize(parse(original).properties,'原生最新输入\r\n');f.nativeView(latest);
 await f.set();assert.equal(parse(f.source()).body,'原生最新输入\r\n');assert.equal(f.counts().nativeSaves,1);
});
test('divergent native windows reject before draining either editor or changing properties',async()=>{
 const f=fixture();f.nativeView(original);f.nativeView(serialize(parse(original).properties,'另一个窗口草稿'));
 await assert.rejects(f.set(),outcome('not-written',/多个笔记窗口/));assert.equal(f.source(),original);assert.equal(f.counts().nativeSaves,0);assert.equal(f.counts().processes,0);
});
for(const mutation of ['navigation','rename','replace','native-input','flag','identity','malformed'] as const)test(`queued native property write revalidates ${mutation} at its callback`,async()=>{
 const f=fixture(),gate=deferred();f.control.propertiesGate=gate.promise;
 const view=mutation==='native-input'?f.nativeView():undefined;
 const pending=f.set('thoughtspace_pinned',true,false);await until(()=>f.counts().processes===1);
 if(mutation==='navigation')f.cancel();
 else if(mutation==='rename'){f.files.delete(f.file.path);f.file.path='Notes/renamed.md';f.files.set(f.file.path,f.file);}
 else if(mutation==='replace')f.files.set(f.file.path,new File(f.file.path));
 else if(view)view.value=serialize(parse(original).properties,'尚未保存的原生输入');
 else {const properties=parse(f.source()).properties;if(mutation==='flag')properties.thoughtspace_pinned=true;else if(mutation==='identity')properties.thoughtspace_capture='capture-other-12345678';else properties.thoughtspace_archived=1;f.replaceSource(serialize(properties));}
 const before=f.source();gate.resolve();await assert.rejects(pending,outcome('not-written'));assert.equal(f.source(),before);assert.equal(f.counts().writes,0);
});
test('a rename during the initial native read cannot redirect the flag write',async()=>{
 const f=fixture(),gate=deferred();f.control.readGate=gate.promise;const pending=f.set();await until(()=>f.counts().reads===1);
 f.files.delete(f.file.path);f.file.path='Notes/renamed.md';f.files.set(f.file.path,f.file);gate.resolve();await assert.rejects(pending,outcome('not-written',/移动/));assert.equal(f.counts().processes,0);
});
test('native property changes queued before the callback remain present in the confirmed result',async()=>{
 const f=fixture();f.control.beforeProperties=()=>f.replaceSource(serialize({...parse(f.source()).properties,new_native_property:{keep:'最新属性'}}));
 await f.set();assert.deepEqual(parse(f.source()).properties.new_native_property,{keep:'最新属性'});
});
test('API failure before its callback is a non-write and is not retried',async()=>{
 const f=fixture();f.control.failure='before';await assert.rejects(f.set(),outcome('not-written',/host refused/));assert.equal(f.source(),original);assert.equal(f.counts().processes,1);assert.equal(f.counts().writes,0);
});
test('API failure after writing earns success only from a read-only confirmation',async()=>{
 const f=fixture();f.control.failure='after';const receipt=await f.set();assert.equal(receipt.recoveredAfterError,true);assert.equal(receipt.confirmed,true);assert.equal(f.counts().processes,1);assert.equal(f.counts().writes,1);
});
test('navigation after a completed write retains the confirmed receipt without a second write',async()=>{
 const f=fixture();f.control.afterProperties=()=>f.cancel();const receipt=await f.set();assert.equal(receipt.confirmed,true);assert.equal(f.counts().writes,1);
});
for(const damage of ['body','unknown-property','identity','target-flag','verification-read','rename','replace'] as const)test(`post-write ${damage} prevents a false success and never automatically retries`,async()=>{
 const f=fixture();f.control.failure='after';
 if(damage==='verification-read')f.control.verificationReadFailure=true;
 else if(damage==='rename'||damage==='replace')f.control.afterProperties=()=>{if(damage==='replace')f.files.set(f.file.path,new File(f.file.path));else{f.files.delete(f.file.path);f.file.path='Notes/moved.md';f.files.set(f.file.path,f.file);}};
 else f.control.transform=source=>{const value=parse(source);if(damage==='body')return serialize(value.properties,'truncated');if(damage==='unknown-property')delete value.properties.unknown;else if(damage==='identity')value.properties.thoughtspace_created='2026-10-13T13:00:00.000Z';else value.properties.thoughtspace_pinned=false;return serialize(value.properties,value.body);};
 await assert.rejects(f.set(),outcome('unknown',/待核对/));assert.equal(f.counts().processes,1);assert.equal(f.counts().writes,1);
});
test('an API that does not execute its callback cannot produce a confirmed receipt',async()=>{
 const f=fixture();f.control.skipCallback=true;await assert.rejects(f.set(),outcome('not-written',/未确认/));assert.equal(f.source(),original);
});
