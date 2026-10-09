import {isBrainBoard} from '../src/brain-board';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';
const source=readFileSync(process.env.SESSION_CACHE_SOURCE||'src/main.ts','utf8'),start=source.indexOf('  async session(file:'),end=source.indexOf('\n  async readBoard(',start);
class Session{listeners=new Set();board={nodes:[]};blocked=false;flush=async()=>{};constructor(_host:unknown,public file:unknown,public raw:string){}}
const Host=new Function('Session',transformSync('class Host{'+source.slice(start,end)+'};return Host',{loader:'ts'}).code)(Session);
function fixture(){const host=new Host();let reads=0;host.sessions=new Map();host.app={vault:{read:async()=>{reads++;return 'board'}}};return{host,file:{path:'board.thoughtspace'},reads:()=>reads};}
test('releasing a retired session does not evict the newer live session for the same file',async()=>{const f=fixture(),old=await f.host.session(f.file);await f.host.release(old);const current=await f.host.session(f.file);current.listeners.add(()=>{});await f.host.release(old);assert.equal(await f.host.session(f.file),current);assert.equal(f.reads(),2);});
test('an older delayed release cannot evict a replacement session',async()=>{const f=fixture(),old=await f.host.session(f.file);let resolve!:()=>void;old.flush=()=>new Promise<void>(r=>resolve=r);const first=f.host.release(old);old.flush=async()=>{};await f.host.release(old);const current=await f.host.session(f.file);resolve();await first;assert.equal(await f.host.session(f.file),current);});
test('a listener attached while flushing preserves the shared session',async()=>{const f=fixture(),s=await f.host.session(f.file);s.flush=async()=>{s.listeners.add(()=>{})};await f.host.release(s);assert.equal(await f.host.session(f.file),s);});
test('unused sessions are evicted and failed reads remain retryable',async()=>{const f=fixture(),s=await f.host.session(f.file);await f.host.release(s);assert.equal(f.host.sessions.size,0);f.host.app.vault.read=async()=>{throw Error('read')};await assert.rejects(f.host.session(f.file),/read/);assert.equal(f.host.sessions.size,0);f.host.app.vault.read=async()=> 'retry';assert.equal((await f.host.session(f.file)).raw,'retry');});
test('an older rejected read cannot remove a newer cache entry',async()=>{const f=fixture();let reject!:(e:Error)=>void;f.host.app.vault.read=()=>new Promise<string>((_,r)=>reject=r);const old=f.host.session(f.file),replacement=Promise.resolve(new Session({},f.file,'new'));f.host.sessions.set(f.file,replacement);reject(Error('old read'));await assert.rejects(old,/old read/);assert.equal(f.host.sessions.get(f.file),replacement);});
test('reopening while the last view releases keeps the newly acquired session cached',async()=>{
 const f=fixture(),original=await f.host.session(f.file);
 const releasing=f.host.release(original);
 const opening=f.host.session(f.file).then((s:any)=>{s.listeners.add(()=>{});return s;});
 const [,opened]=await Promise.all([releasing,opening]);
 assert.equal(await f.host.session(f.file),opened);
 assert.equal(f.reads(),1);
});
for(const turns of [1,2,3])test(`reopening after ${turns} release microtasks keeps a single live session`,async()=>{
 const f=fixture(),original=await f.host.session(f.file),releasing=f.host.release(original);
 for(let i=0;i<turns;i++)await Promise.resolve();
 const opened=await f.host.session(f.file);opened.listeners.add(()=>{});await releasing;
 assert.equal(await f.host.session(f.file),opened);
 assert.equal(f.reads(),turns<3?1:2);
});

for(const turns of [0,1,2])test(`release after ${turns} acquire microtasks keeps the opening view subscribed`,async()=>{
 const f=fixture(),original=await f.host.session(f.file);
 const opening=f.host.session(f.file).then((s:any)=>{s.listeners.add(()=>{});return s;});
 for(let i=0;i<turns;i++)await Promise.resolve();
 await f.host.release(original);const opened=await opening;
 assert.equal(await f.host.session(f.file),opened);assert.equal(f.reads(),1);
});

test('concurrent cached acquisitions retain one session and its last release still clears the cache',async()=>{
 const f=fixture(),original=await f.host.session(f.file),releasing=f.host.release(original);
 await Promise.resolve();
 const acquired=await Promise.all(Array.from({length:20},()=>f.host.session(f.file)));await releasing;
 assert(acquired.every(s=>s===original));assert.equal(await f.host.session(f.file),original);assert.equal(f.reads(),1);
 await f.host.release(original);assert.equal(f.host.sessions.size,0);
 assert.notEqual(await f.host.session(f.file),original);assert.equal(f.reads(),2);
});

test('a rejected shared read cleans its renewed cache entry and all concurrent callers can retry',async()=>{
 const f=fixture();let reject!:(error:Error)=>void,reads=0;
 f.host.app.vault.read=()=>{reads++;return new Promise<string>((_,fail)=>reject=fail);};
 const waiting=Array.from({length:4},()=>f.host.session(f.file));reject(Error('temporary disk error'));
 const results=await Promise.allSettled(waiting);
 assert(results.every(result=>result.status==='rejected'));assert.equal(reads,1);assert.equal(f.host.sessions.size,0);
 f.host.app.vault.read=async()=>{reads++;return 'recovered';};
 const retry=await Promise.all(Array.from({length:4},()=>f.host.session(f.file)));
 assert(retry.every(s=>s===retry[0]));assert.equal(retry[0].raw,'recovered');assert.equal(reads,2);
 await f.host.release(retry[0]);assert.equal(f.host.sessions.size,0);
});

const loadStart=source.indexOf('  async onLoadFile(file:'),loadEnd=source.indexOf('\n  private point(',loadStart);
const View=new Function('isBrainBoard','act','report','fitTextNode',transformSync('class BoardView{'+source.slice(loadStart,loadEnd)+'};return BoardView',{loader:'ts'}).code)(isBrainBoard,(run:()=>unknown)=>{void run();},()=>{},()=>{});
test('production onLoadFile attaches to the cached session after a previous view starts releasing it',async()=>{
 const f=fixture(),original=await f.host.session(f.file),view=new View();let releaseDock!:()=>void;
 const dock=new Promise<void>(resolve=>releaseDock=resolve);
 Object.assign(f.host,{provisionalBoardGeometry:new WeakMap(),ensureDock:()=>dock,refreshDock(){},clearMaterialDrag(){}});
 Object.assign(view,{cancelSaveFeedbackNavigation(){},plugin:f.host,closed:false,file:f.file,dialogEpoch:0,sidebarRun:0,renderFrame:0,blankClicks:{cancel(){}},finishMarquee(){},setSectionTool(){},syncSelectionTool(){},viewTrail:{clear(){}},outlineCollapsed:new Set(),clearNodes(){},selected:new Set(),stage:{removeClass(){}},svg:{isConnected:true},contentEl:{querySelectorAll:()=>[],ownerDocument:{defaultView:{cancelAnimationFrame(){}}}},app:{workspace:{getActiveViewOfType:()=>view}},paint(){},finishInlineForNavigation:async()=>{},clearBrainBoard(){},clearCanvasGesture(){}});
 const releasing=f.host.release(original);await Promise.resolve();const loading=view.onLoadFile(f.file);
 await releasing;releaseDock();await loading;
 assert.equal(view.session,original);assert.equal(original.listeners.size,1);
 assert.equal(await f.host.session(f.file),view.session);assert.equal(f.reads(),1);
 await view.onClose();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(original.listeners.size,0);assert.equal(f.host.sessions.size,0);
});
