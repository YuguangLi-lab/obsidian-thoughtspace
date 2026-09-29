import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setImmediate} from 'node:timers/promises';
import test,{type TestContext} from 'node:test';
import {createOnlineController,type OnlineState,type PlatformFrame,type WindowOptions} from '../src/online-platform/online-controller.mjs';
import type {MediaSnapshot} from '../src/online-platform/online-page.mjs';

const bili='https://www.bilibili.com/video/BV1p5Yg6JEzR/';
type Snapshot=Partial<MediaSnapshot>&{reason?:string};
const captureIdentity=()=>({token:'12345678-1234-4234-8234-123456789abc',seekRevision:0});
function png(width=640,height=360,length=32){const bytes=new Uint8Array(length);bytes.set([137,80,78,71,13,10,26,10]);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;}
function fixture(t:TestContext){
 const states:OnlineState[]=[],calls:{frame:Frame;action:string;value:number}[]=[],windows:Window[]=[],ticks=new Set<()=>void>();
 const native={zoom:1,empty:false,size:{width:640,height:360},bytes:png(),captures:[] as {x:number;y:number;width:number;height:number}[],failure:'',beforeDraw:undefined as undefined|(()=>void),beforeCapture:undefined as undefined|(()=>Promise<void>|void)};
 class Frame implements PlatformFrame {
  framesInSubtree:Frame[]=[];
  snapshot:Snapshot={time:20,duration:120,paused:true,rate:1,media:'blob:private-media-token',capture:captureIdentity()};
  defer?:()=>Promise<Snapshot>;rejectRate=false;
  constructor(public url=''){}
  async executeJavaScript(script:string){
   const args=JSON.parse(script.match(/\)\(\.\.\.(\[.*\])\)$/s)![1]) as [string,string,string,number];
   const [,,action,value]=args;calls.push({frame:this,action,value});
   if(this.defer)return this.defer();
   if(action==='seek')this.snapshot.time=Math.min(value,this.snapshot.duration??0);
   if(action==='rate'&&!this.rejectRate)this.snapshot.rate=value;
   if(action==='pause')this.snapshot.paused=true;
   if(action==='toggle')this.snapshot.paused=!this.snapshot.paused;
   if(action==='capture'){
    if(native.failure)return {reason:native.failure};
    native.beforeDraw?.();const sampled={...this.snapshot,capture:this.snapshot.capture?{...this.snapshot.capture}:undefined};
    await native.beforeCapture?.();
    return{...sampled,...(native.empty?{}:{frame:{width:native.size.width,height:native.size.height,dataUrl:'data:image/png;base64,'+Buffer.from(native.bytes).toString('base64')}})};
   }
   return{...this.snapshot,capture:this.snapshot.capture?{...this.snapshot.capture}:undefined};
  }
 }
 class Contents extends EventEmitter {
  mainFrame=new Frame();popup?:(details:{url:string})=>{action:'deny'};reloads=0;
  constructor(){super();this.mainFrame.framesInSubtree=[this.mainFrame];}
  getURL(){return this.mainFrame.url;}
  getZoomFactor(){return native.zoom;}
  async capturePage(rect:{x:number;y:number;width:number;height:number}){native.captures.push({...rect});await native.beforeCapture?.();return{isEmpty:()=>native.empty,getSize:()=>native.size,toPNG:()=>native.bytes};}
  setWindowOpenHandler(handler:(details:{url:string})=>{action:'deny'}){this.popup=handler;}
  reload(){this.reloads++;}
 }
 class Window extends EventEmitter {
  destroyed=false;webContents=new Contents();loads:string[]=[];
  constructor(public options:WindowOptions){super();windows.push(this);}
  async loadURL(url:string){this.loads.push(url);this.webContents.mainFrame.url=url;}
  isDestroyed(){return this.destroyed;}
  destroy(){this.destroyed=true;this.emit('closed');}
  setMenuBarVisibility(){}show(){}focus(){}
 }
 class Session extends EventEmitter {
  check?:(contents:unknown,permission:string)=>boolean;
  request?:(contents:unknown,permission:string,done:(allowed:boolean)=>void)=>void;
  setPermissionRequestHandler(callback:NonNullable<Session['request']>){this.request=callback;}
  setPermissionCheckHandler(callback:NonNullable<Session['check']>){this.check=callback;}
 }
 const session=new Session(),external:string[]=[],partitions:string[]=[];
 const player=createOnlineController({BrowserWindow:Window,session:{fromPartition:partition=>{partitions.push(partition);return session;}},shell:{openExternal:async url=>{external.push(url);}},
  getHost:()=>({isDestroyed:()=>false,webContents:{send:(_channel,state)=>states.push(state)}}),every:callback=>{ticks.add(callback);return callback;},cancel:callback=>ticks.delete(callback as ()=>void)});
 t.after(()=>player.stop());
 return{player,windows,states,calls,session,external,partitions,native,frame:(url:string)=>new Frame(url),async tick(){for(const tick of ticks)tick();await setImmediate();await setImmediate();}};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}

test('official Bilibili window publishes actual time/rate without leaking media URLs',async t=>{
 const f=fixture(t);f.player.open(bili,12.5);await f.tick();await f.tick();
 assert.equal(f.states.at(-1)?.time,12.5);assert.equal(f.states.at(-1)?.available,true);
 assert.doesNotMatch(JSON.stringify(f.states),/private-media-token|blob:/);
 await f.player.command(bili,'rate',1.5);await f.tick();assert.equal(f.states.at(-1)?.rate,1.5);
 f.windows[0].webContents.mainFrame.rejectRate=true;
 await assert.rejects(f.player.command(bili,'rate',2),/未接受此倍速/);
 await assert.rejects(f.player.command(bili,'rate',9),/无效/);
});
test('malformed frame results cannot become verified time or playback state',async t=>{
 const f=fixture(t);f.player.open(bili);const frame=f.windows[0].webContents.mainFrame;
 for(const patch of [{time:'20'},{time:NaN},{duration:Infinity},{duration:0},{paused:'false'},{rate:NaN},{media:123}]){
  frame.defer=async()=>({...frame.snapshot,...patch}) as unknown as Snapshot;
  await f.tick();assert.equal(f.states.at(-1)?.available,false);assert.equal(f.states.at(-1)?.time,0);assert.match(f.states.at(-1)?.error??'',/有效的播放状态/);
 }
 frame.defer=undefined;await f.tick();await f.tick();assert.equal(f.states.at(-1)?.available,true);
});
test('YouTube opens the official watch page and synchronizes timestamp commands',async t=>{
 const f=fixture(t),url='https://www.youtube.com/watch?v=M7lc1UVf-VE';
 f.player.open(url,62);await f.tick();await f.tick();assert.equal(f.windows[0].loads[0],url);
 assert.equal(f.states.at(-1)?.time,62);await f.player.command(url,'seek',8.5);await f.tick();
 assert.equal(f.states.at(-1)?.time,8.5);assert.equal(f.windows.length,1);
});
test('SPA part changes require adoption and preserve the existing platform window',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();
 const main=f.windows[0].webContents.mainFrame;main.url=bili+'?p=2&spm_id_from=tracking';main.snapshot.time=42;
 await f.tick();assert.equal(f.states.at(-1)?.available,false);assert.equal(f.states.at(-1)?.candidate?.path,bili+'?p=2');
 await assert.rejects(f.player.command(bili,'seek',5),/确认当前视频/);
 const source=await f.player.adopt(bili);assert.equal(source.path,bili+'?p=2');assert.equal(source.initialTime,42);
 await f.tick();assert.equal(f.states.at(-1)?.sourcePath,source.path);assert.equal(f.states.at(-1)?.time,42);
 assert.equal(f.windows.length,1);assert.equal(f.windows[0].loads.length,1);
});
test('untrusted frames, ambiguous visible players and advertisements never sync',async t=>{
 const f=fixture(t);f.player.open(bili);const main=f.windows[0].webContents.mainFrame,other=f.frame('https://attacker.test/frame');
 main.framesInSubtree.push(other);await f.tick();await f.tick();assert.equal(f.calls.some(call=>call.frame===other),false);
 const official=f.frame('https://player.bilibili.com/player.html');main.framesInSubtree.push(official);await f.tick();
 assert.equal(f.states.at(-1)?.available,false);assert.match(f.states.at(-1)?.error??'',/多个播放器/);
 official.snapshot={reason:'广告期间请在播放器操作'};await f.tick();assert.equal(f.states.at(-1)?.available,false);assert.match(f.states.at(-1)?.error??'',/广告/);
});
test('Baidu directory cannot sync until a concrete official file is explicitly adopted',async t=>{
 const f=fixture(t),folder='https://pan.baidu.com/s/1sample',file='https://pan.baidu.com/play/video?fsid=12&path=%2Fcourse.mp4';
 f.player.open(folder);await f.tick();assert.equal(f.calls.length,0);await assert.rejects(f.player.adopt(folder),/尚未找到/);
 f.windows[0].webContents.mainFrame.url=file;await f.tick();assert.equal(f.states.at(-1)?.candidate?.path,file);
 await f.player.adopt(folder);await f.tick();assert.equal(f.states.at(-1)?.available,true);
});
test('old-window samples cannot update a newly opened course',async t=>{
 const f=fixture(t);f.player.open(bili);const gate=deferred<Snapshot>();f.windows[0].webContents.mainFrame.defer=()=>gate.promise;
 await f.tick();const next=bili+'?p=2';f.player.open(next,4);await f.tick();await f.tick();const count=f.states.length;
 gate.resolve({time:99,duration:120,paused:false,rate:1});await setImmediate();assert.equal(f.states.length,count);assert.equal(f.states.at(-1)?.sourcePath,next);
});
test('navigation away and back to the same URL invalidates a pending sample',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const win=f.windows[0],main=win.webContents.mainFrame,gate=deferred<Snapshot>();
 main.defer=()=>gate.promise;await f.tick();
 win.webContents.emit('did-start-navigation',{},bili+'?p=2',true,true);main.url=bili+'?p=2';
 win.webContents.emit('did-start-navigation',{},bili,true,true);main.url=bili;
 const count=f.states.length;gate.resolve({...main.snapshot,time:99});await setImmediate();assert.equal(f.states.length,count);assert.equal(f.states.at(-1)?.available,false);
});
test('reload immediately invalidates a pending sample even before navigation events arrive',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame,gate=deferred<Snapshot>();
 main.defer=()=>gate.promise;await f.tick();await f.player.command(bili,'reload');const count=f.states.length;
 gate.resolve({...main.snapshot,time:99});await setImmediate();assert.equal(f.states.length,count);assert.equal(f.states.at(-1)?.status,'loading');
});
test('a newer explicit seek cancels a pending resume sample instead of seeking back',async t=>{
 const f=fixture(t);f.player.open(bili,12);const main=f.windows[0].webContents.mainFrame,gate=deferred<Snapshot>();
 main.defer=()=>gate.promise;await f.tick();main.defer=undefined;
 await f.player.command(bili,'seek',90);gate.resolve({...main.snapshot,time:20});await setImmediate();await f.tick();
 assert.equal(main.snapshot.time,90);assert.deepEqual(f.calls.filter(call=>call.action==='seek').map(call=>call.value),[90]);assert.equal(f.states.at(-1)?.time,90);
});
test('queued loading seeks replace pending intent without rebuilding or crossing source identity',async t=>{
 const f=fixture(t);f.player.open(bili,12);const win=f.windows[0],main=win.webContents.mainFrame;
 main.url='about:blank';assert.equal(f.player.queueSeek(bili,31.25),true);assert.equal(f.player.queueSeek(bili,42.5),true);assert.equal(f.windows.length,1);
 for(const value of [-1,NaN,Infinity,864001])assert.throws(()=>f.player.queueSeek(bili,value),/无效/);
 main.url=bili+'?p=2';assert.equal(f.player.queueSeek(bili,99),false);assert.equal(f.player.queueSeek(bili+'?p=2',99),false);
 main.url=bili;await f.tick();await f.tick();assert.equal(main.snapshot.time,42.5);assert.equal(f.states.at(-1)?.time,42.5);
 assert.deepEqual(f.calls.filter(call=>call.action==='seek').map(call=>call.value),[42.5]);
});
test('queued seek invalidates an older in-flight resume sample',async t=>{
 const f=fixture(t);f.player.open(bili,12);const main=f.windows[0].webContents.mainFrame,gate=deferred<Snapshot>();
 main.defer=()=>gate.promise;await f.tick();assert.equal(f.player.queueSeek(bili,88),true);main.defer=undefined;gate.resolve({...main.snapshot});await setImmediate();
 await f.tick();await f.tick();assert.equal(main.snapshot.time,88);assert.deepEqual(f.calls.filter(call=>call.action==='seek').map(call=>call.value),[88]);
});
test('newer same-source open cannot be overwritten by an older in-flight command',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame,gate=deferred<Snapshot>();
 main.defer=()=>gate.promise;const pending=f.player.command(bili,'seek',90);await setImmediate();
 f.player.open(bili,5);main.defer=undefined;gate.resolve({...main.snapshot});await assert.rejects(pending,/操作已取消/);
 await f.tick();await f.tick();assert.equal(main.snapshot.time,5);assert.equal(f.windows.length,1);
});
test('navigation during command lookup rejects before mutating the wrong video',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame,gate=deferred<Snapshot>();
 main.defer=()=>gate.promise;const pending=f.player.command(bili,'seek',90);await setImmediate();main.url=bili+'?p=2';gate.resolve({...main.snapshot});
 await assert.rejects(pending,/操作已取消/);assert.equal(main.snapshot.time,0);
});
test('navigation during adoption cannot attach stale time to a newly loaded same-URL video',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const win=f.windows[0],main=win.webContents.mainFrame,gate=deferred<Snapshot>();
 main.url=bili+'?p=2';main.defer=()=>gate.promise;const pending=f.player.adopt(bili);await setImmediate();
 win.webContents.emit('did-start-navigation',{},main.url,false,true);gate.resolve({...main.snapshot,time:42});
 await assert.rejects(pending,/页面已切换/);assert.equal(f.states.at(-1)?.sourcePath,bili);
});
test('official windows preserve sandbox, navigation, permissions and download boundaries',async t=>{
 const f=fixture(t);f.player.open(bili);const win=f.windows[0],prefs=win.options.webPreferences;
 assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.webSecurity,true);assert.equal('preload' in prefs,false);
 assert.deepEqual(f.partitions,['persist:thoughtspace-online-bilibili']);assert.equal(f.session.check?.(null,'media'),false);assert.equal(f.session.check?.(null,'fullscreen'),true);
 let denied=false;f.session.emit('will-download',{preventDefault(){denied=true;}});assert.equal(denied,true);
 assert.deepEqual(win.webContents.popup?.({url:'yingjian://open?video=secret'}),{action:'deny'});assert.equal(win.webContents.getURL(),bili);
 for(const event of ['will-navigate','will-redirect','will-attach-webview']){denied=false;win.webContents.emit(event,{preventDefault(){denied=true;}},'https://attacker.test/');assert.equal(denied,true);}
 await assert.rejects(f.player.command('https://www.youtube.com.attacker.test/watch?v=M7lc1UVf-VE','external'));
 assert.equal(f.external.length,0);f.player.stop();assert.equal(win.isDestroyed(),true);assert.equal(f.states.at(-1)?.closed,true);
});
test('capture returns decoded video PNG bytes and the canvas sample time without page compositor access',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame;main.snapshot.time=14.25;
 f.native.beforeDraw=()=>{main.snapshot.time=14.3;};
 const result=await f.player.capture(bili);assert.equal(result.time,14.3);assert.deepEqual(result.bytes,f.native.bytes);assert.deepEqual(f.native.captures,[]);
 assert.equal(f.calls.filter(call=>call.action==='capture').length,1);assert.equal(f.calls.filter(call=>call.action==='capture-probe').length,2);assert.equal(f.calls.filter(call=>['toggle','pause'].includes(call.action)).length,0);assert.doesNotMatch(JSON.stringify(f.states),/capture|private-media-token|data:image/);
});
test('browser zoom and changing CSS crop or viewport do not alter actual video frame capture',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame;
 f.native.zoom=1.25;Object.assign(main.snapshot.capture!,{rect:{x:-20.3,y:30.2,width:0,height:0},viewport:{width:1,height:1}});
 f.native.beforeCapture=()=>{f.native.zoom=2;Object.assign(main.snapshot.capture!,{rect:{x:5000,y:5000,width:100000,height:100000},viewport:{width:100,height:100}});};
 const result=await f.player.capture(bili);assert.deepEqual(result.bytes,f.native.bytes);assert.deepEqual(f.native.captures,[]);
});
test('unsynced, nested and invalid capture identities never request video-frame encoding',async t=>{
 const f=fixture(t);f.player.open(bili);await assert.rejects(f.player.capture(bili),/同步/);await f.tick();await f.tick();
 const main=f.windows[0].webContents.mainFrame;
 for(const patch of [{token:''},{token:'bad-token'},{seekRevision:-1},{seekRevision:NaN},{seekRevision:1.5}]){
  main.snapshot.capture={...captureIdentity(),...patch};await assert.rejects(f.player.capture(bili),/视频帧身份/);
 }
 main.snapshot={reason:'等待视频'};main.framesInSubtree.push(f.frame('https://player.bilibili.com/player.html'));await f.tick();await assert.rejects(f.player.capture(bili),/嵌套播放器/);assert.equal(f.calls.filter(call=>call.action==='capture').length,0);assert.equal(f.native.captures.length,0);
});
test('navigation, reload, seek, stop and source replacement cancel in-flight frame delivery',async t=>{
 for(const change of ['navigation','reload','seek','stop','replacement'] as const){
  const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame;
  f.native.beforeCapture=async()=>{if(change==='navigation'){f.windows[0].webContents.emit('did-start-navigation',{},bili+'?p=2',true,true);main.url=bili+'?p=2';}else if(change==='stop')f.player.stop();else if(change==='replacement')f.player.open(bili+'?p=2');else await f.player.command(bili,change,change==='seek'?50:undefined);};
  await assert.rejects(f.player.capture(bili),/切换或跳转/);assert.equal(f.calls.filter(call=>call.action==='capture').length,1);assert.equal(f.native.captures.length,0);
 }
});
test('native seeking, element replacement, media changes and implausible time changes reject encoded bytes',async t=>{
 for(const change of ['seeking','element','media','duration','time','ad'] as const){
  const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame;
  f.native.beforeCapture=()=>{if(change==='seeking')main.snapshot.capture!.seekRevision++;else if(change==='element')main.snapshot.capture!.token='12345678-1234-4234-8234-123456789def';else if(change==='media')main.snapshot.media='blob:other-video';else if(change==='duration')main.snapshot.duration=121;else if(change==='time')main.snapshot.time=99;else main.snapshot={reason:'广告期间请在播放器操作'};};
  await assert.rejects(f.player.capture(bili),/变化|跳转|广告/);assert.equal(f.calls.filter(call=>call.action==='capture').length,1,change);assert.equal(f.native.captures.length,0);
 }
});
test('decoded PNG metadata, byte and pixel limits are checked before delivery',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();
 f.native.empty=true;await assert.rejects(f.player.capture(bili),/未提供/);f.native.empty=false;
 f.native.size={width:5000,height:5000};await assert.rejects(f.player.capture(bili),/1600/);f.native.size={width:640,height:360};
 f.native.bytes=png(5000,5000);await assert.rejects(f.player.capture(bili),/1600/);
 f.native.bytes=png(320,180);await assert.rejects(f.player.capture(bili),/尺寸/);
 f.native.bytes=png(640,360,16*1024*1024+1);await assert.rejects(f.player.capture(bili),/16 MB/);
 f.native.bytes=new Uint8Array(32);await assert.rejects(f.player.capture(bili),/无效/);
 f.native.bytes=png();assert.deepEqual((await f.player.capture(bili)).bytes,f.native.bytes,'a rejected capture releases the capture lock');assert.equal(f.native.captures.length,0);
});
test('not-ready, DRM and CORS guest failures retain actionable reasons and never fall back to a page screenshot',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();
 for(const reason of ['视频画面尚未就绪或正在跳转，请稍后截图','当前视频受 DRM 保护，平台不允许读取视频帧截图','浏览器禁止读取此视频帧：跨域 CORS 或受保护内容不允许截图']){
  f.native.failure=reason;await assert.rejects(f.player.capture(bili),error=>error instanceof Error&&error.message===reason);assert.equal(f.native.captures.length,0);
 }
 f.native.failure='';assert.deepEqual((await f.player.capture(bili)).bytes,f.native.bytes);
});
test('concurrent captures encode once and preserve the actual canvas sample time across asynchronous delivery',async t=>{
 const f=fixture(t);f.player.open(bili);await f.tick();await f.tick();const main=f.windows[0].webContents.mainFrame,gate=deferred<void>();main.snapshot.time=14.25;
 f.native.beforeCapture=()=>gate.promise;const first=f.player.capture(bili);await setImmediate();await assert.rejects(f.player.capture(bili),/正在进行/);main.snapshot.time=14.5;gate.resolve();const result=await first;
 assert.equal(result.time,14.25);assert.equal(f.calls.filter(call=>call.action==='capture').length,1);assert.equal(f.native.captures.length,0);
});
