import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import test,{type TestContext} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {OnlinePlatform,type OnlineState} from '../src/online-platform';
import {createWebviewWindow,type OnlineWebviewRuntime} from '../src/online-platform-webview';
import type {OnlineController,PlatformContents,WindowOptions} from '../src/online-platform/online-controller.mjs';

const bili='https://www.bilibili.com/video/BV1p5Yg6JEzR/';
const options:WindowOptions={width:1060,height:760,minWidth:700,minHeight:480,title:'test',backgroundColor:'#000',webPreferences:{partition:'persist:thoughtspace-online-bilibili',sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false}};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
function fixture(){
 let nextId=0,lookups=0;const guests:Guest[]=[],natives=new Map<number,Contents>();
 class Contents extends EventEmitter{
  popup?:(details:{url:string})=>{action:'deny'};
  time=0;actions:Array<{action:string;value:number}>=[];
  surfaceReady=true;surfaceCalls:string[]=[];surfaceGate?:Promise<{applied:boolean;ready:boolean}>;
  mainFrame={url:'about:blank',executeJavaScript:async(script:string)=>{if(script.includes('thoughtspace.online.player-surface')){this.surfaceCalls.push(script);return this.surfaceGate??{applied:true,ready:this.surfaceReady};}const [,,action,value]=JSON.parse(script.match(/\)\(\.\.\.(\[.*\])\)$/s)![1]) as [string,string,string,number];this.actions.push({action,value});if(action==='seek')this.time=value;return{time:this.time,duration:120,paused:true,rate:1,media:'blob:private'};}};
  getURL(){return this.mainFrame.url;}getZoomFactor(){return 1;}reload(){}
  capturePage(){throw Error('This lifecycle fixture never captures pixels');}
  setWindowOpenHandler(handler:NonNullable<Contents['popup']>){this.popup=handler;}
 }
 class Host{
  isConnected=true;children:Array<Guest|Label>=[];
  ownerDocument={createElement:(tag:string)=>{if(tag==='div')return new Label();assert.equal(tag,'webview');return new Guest();}};
  appendChild(guest:Guest|Label){this.children.push(guest);guest.parent=this;return guest;}
 }
 class Label{parent?:Host;classList={add:()=>undefined};textContent='';hidden=false;setAttribute(){}remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}}
 class Guest extends EventTarget{
  id=++nextId;attrs=new Map<string,string>();style={};classList={add:()=>undefined};parent?:Host;loads:string[]=[];focused=0;removed=false;native=new Contents();loadGate?:Promise<void>;
  constructor(){super();guests.push(this);natives.set(this.id,this.native);}
  setAttribute(key:string,value:string){this.attrs.set(key,value);}
  setCssProps(properties:Record<string,string>){Object.assign(this.style,properties);}
  getWebContentsId(){return this.id;}
  async loadURL(url:string){assert.ok(this.native.popup,'popup guard precedes official navigation');assert.ok(this.native.listenerCount('will-navigate'),'navigation guard precedes official navigation');this.loads.push(url);this.native.mainFrame.url=url;this.native.emit('did-start-navigation',{},url,false,true);await this.loadGate;}
  remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
  focus(){this.focused++;}
  ready(){this.dispatchEvent(new Event('dom-ready'));}
 }
 class Session extends EventEmitter{setPermissionRequestHandler(){}setPermissionCheckHandler(){}}
 const session=new Session(),external:string[]=[];
 const runtime:OnlineWebviewRuntime={webContents:{fromId(id){lookups++;return natives.get(id) as unknown as PlatformContents|undefined;}},session:{fromPartition:()=>session},shell:{openExternal:async url=>{external.push(url);}}};
 const host=()=>new Host() as unknown as HTMLElement;
 return{runtime,host,guests,external,get lookups(){return lookups;}};
}
function platformFixture(t:TestContext){const f=fixture(),states:OnlineState[]=[];let runtimeLoads=0;const player=new OnlinePlatform(state=>states.push(state),()=>{runtimeLoads++;return f.runtime;});t.after(()=>player.dispose());return{...f,player,states,get runtimeLoads(){return runtimeLoads;}};}

test('embedded guest queues official navigation until all native guards are installed',async()=>{
 const f=fixture(),host=f.host(),Embedded=createWebviewWindow(()=>host,f.runtime),guestHost=new Embedded(options);
 try{
  let prevented=false;guestHost.webContents.on('will-navigate',(event:{preventDefault():void})=>event.preventDefault());
  guestHost.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  const opening=guestHost.loadURL(bili),guest=f.guests[0];
  assert.equal(guest.attrs.get('src'),'about:blank');assert.equal(guest.attrs.get('partition'),options.webPreferences.partition);
  assert.match(guest.attrs.get('webpreferences')??'',/sandbox=yes,contextIsolation=yes,nodeIntegration=no/);
  for(const attribute of ['nodeintegration','nodeintegrationinsubframes','preload','disablewebsecurity','allowpopups'])assert.equal(guest.attrs.has(attribute),false);
  assert.deepEqual(guest.loads,[]);assert.equal(f.lookups,0);
  guest.ready();await opening;assert.deepEqual(guest.loads,[bili]);
  guest.ready();assert.equal(f.lookups,1,'same guest dom-ready after real navigation reuses its native binding');assert.equal(guest.native.listenerCount('will-navigate'),1);
  guest.native.emit('will-navigate',{preventDefault(){prevented=true;}},'https://attacker.test');assert.equal(prevented,true);
  assert.deepEqual(guest.native.popup?.({url:'https://attacker.test'}),{action:'deny'});
 }finally{guestHost.destroy();}
});
test('closing before dom-ready cancels queued navigation without resolving a native guest',async()=>{
 const f=fixture(),Embedded=createWebviewWindow(f.host,f.runtime),host=new Embedded(options),opening=host.loadURL(bili);
 const rejected=assert.rejects(opening,/关闭/);host.destroy();f.guests[0].ready();await rejected;
 assert.equal(f.lookups,0);assert.deepEqual(f.guests[0].loads,[]);assert.equal(f.guests[0].removed,true);
});
test('newer navigation supersedes an earlier queued initial URL',async()=>{
 const f=fixture(),Embedded=createWebviewWindow(f.host,f.runtime),host=new Embedded(options);
 try{const first=host.loadURL(bili),rejected=assert.rejects(first,/已取消/),second=host.loadURL(bili+'?p=2');f.guests[0].ready();await Promise.all([rejected,second]);assert.deepEqual(f.guests[0].loads,[bili+'?p=2']);}finally{host.destroy();}
});
test('native destruction rejects in-flight loading and removes all forwarded listeners',async()=>{
 const f=fixture(),Embedded=createWebviewWindow(f.host,f.runtime),host=new Embedded(options),gate=deferred<void>(),guest=f.guests[0];guest.loadGate=gate.promise;
 const opening=host.loadURL(bili),rejected=assert.rejects(opening,/已取消/);guest.ready();await setImmediate();guest.native.emit('destroyed');gate.resolve();await rejected;
 assert.equal(host.isDestroyed(),true);assert.equal(guest.removed,true);for(const event of ['will-navigate','destroyed','did-start-navigation'])assert.equal(guest.native.listenerCount(event),0);
});
test('OnlinePlatform requires a connected matching ItemView before loading Electron',t=>{
 const f=platformFixture(t);assert.throws(()=>f.player.open(bili),/插件内/);assert.equal(f.runtimeLoads,0);
 const host=f.host(),release=f.player.mount(host,bili+'?p=2');assert.throws(()=>f.player.open(bili),/来源/);assert.equal(f.runtimeLoads,0);release();
 (host as unknown as {isConnected:boolean}).isConnected=false;f.player.mount(host,bili);assert.throws(()=>f.player.open(bili),/插件内/);assert.equal(f.runtimeLoads,0);assert.equal(f.guests.length,0);
});
test('mount registration is side-effect free and only committed focus moves the player',async t=>{
 const f=platformFixture(t),first=f.host(),second=f.host(),releaseFirst=f.player.mount(first,bili);
 assert.equal(f.guests.length,0);f.player.open(bili,12);f.guests[0].ready();await setImmediate();
 const old=f.guests[0],releaseSecond=f.player.mount(second,bili);assert.equal(old.removed,false);releaseFirst();assert.equal(old.removed,false);
 await f.player.command(bili,'focus');assert.equal(old.removed,true);assert.equal(f.guests.length,2);f.guests[1].ready();await setImmediate();
 releaseFirst();assert.equal(f.guests[1].removed,false);releaseSecond();assert.equal(f.guests[1].removed,true);assert.equal(f.states.at(-1)?.closed,true);
});
test('same-host replacement lease preserves the guest and stale cleanup cannot close it',async t=>{
 const f=platformFixture(t),host=f.host(),old=f.player.mount(host,bili);f.player.open(bili);f.guests[0].ready();await setImmediate();
 const current=f.player.mount(host,bili);old();await f.player.command(bili,'focus');assert.equal(f.guests.length,1);assert.equal(f.guests[0].removed,false);assert.equal(f.guests[0].focused,1);current();assert.equal(f.guests[0].removed,true);
});
test('release and dispose before dom-ready never start the delayed official page',async t=>{
 const f=platformFixture(t),release=f.player.mount(f.host(),bili);f.player.open(bili);release();f.guests[0].ready();await setImmediate();assert.deepEqual(f.guests[0].loads,[]);
 f.player.mount(f.host(),bili);f.player.open(bili);f.player.dispose();f.guests[1].ready();await setImmediate();assert.deepEqual(f.guests[1].loads,[]);assert.throws(()=>f.player.mount(f.host(),bili),/已关闭/);
});
test('native guest loss publishes closed state and explicit focus creates a fresh guest',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili);f.guests[0].ready();await setImmediate();f.guests[0].native.emit('render-process-gone');
 assert.equal(f.states.at(-1)?.closed,true);await f.player.command(bili,'focus');assert.equal(f.guests.length,2);f.guests[1].ready();await setImmediate();assert.deepEqual(f.guests[1].loads,[bili]);
});
test('moving before the first verified poll preserves the requested timestamp',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili,73.25);f.guests[0].ready();await setImmediate();
 f.player.mount(f.host(),bili);await f.player.command(bili,'focus');f.guests[1].ready();await setImmediate();
 await new Promise(resolve=>setTimeout(resolve,1050));
 assert.deepEqual(f.guests[1].native.actions.filter(item=>item.action==='seek'),[{action:'seek',value:73.25}]);
 assert.equal(f.guests[0].native.actions.length,0,'the released guest is never polled after the move');
});
test('source-mismatched actions and detached mounts cannot control the old guest',async t=>{
 const f=platformFixture(t),host=f.host();f.player.mount(host,bili);f.player.open(bili);f.guests[0].ready();await setImmediate();
 f.player.mount(f.host(),bili+'?p=2');await assert.rejects(f.player.command(bili,'focus'),/来源/);await assert.rejects(f.player.capture(bili),/来源/);assert.equal(f.guests.length,1);
 (host as unknown as {isConnected:boolean}).isConnected=false;f.player.mount(host,bili);await assert.rejects(f.player.command(bili,'focus'),/插件内/);
});
test('a new mount lease cancels PNG delivery even before its focus transaction begins',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili);f.guests[0].ready();await setImmediate();
 const controller=(f.player as unknown as {controller:OnlineController}).controller,gate=deferred<{bytes:Uint8Array;time:number}>();controller.capture=()=>gate.promise;
 const pending=f.player.capture(bili),rejected=assert.rejects(pending,/面板已切换/);
 f.player.mount(f.host(),bili);assert.equal(f.guests[0].removed,false,'mount only registers until the view transaction commits');gate.resolve({bytes:new Uint8Array([1,2,3]),time:42});await rejected;
});
test('tab to sidebar move accepts its explicit live time before focusing the new host',async t=>{
 const f=platformFixture(t),releaseTab=f.player.mount(f.host(),bili);f.player.open(bili);f.guests[0].ready();await setImmediate();
 f.player.mount(f.host(),bili);await f.player.command(bili,'seek',46.75);await f.player.command(bili,'focus');releaseTab();
 assert.equal(f.guests.length,2);f.guests[1].ready();await new Promise(resolve=>setTimeout(resolve,1050));
 assert.deepEqual(f.guests[1].native.actions.filter(item=>item.action==='seek'),[{action:'seek',value:46.75}]);assert.equal(f.guests[1].removed,false);
});
test('timestamp route can replace a pending seek before the same guest becomes ready',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili,4);
 await f.player.command(bili,'seek',91.5);await f.player.command(bili,'seek',102.25);await f.player.command(bili,'focus');
 assert.equal(f.guests.length,1,'a timestamp request must not repeatedly create guests while loading');
 f.guests[0].ready();await new Promise(resolve=>setTimeout(resolve,1050));
 assert.deepEqual(f.guests[0].native.actions.filter(item=>item.action==='seek'),[{action:'seek',value:102.25}]);
});
test('timestamp route from a sidebar to a new tab preserves the requested note time',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili,8);f.guests[0].ready();await setImmediate();
 f.player.mount(f.host(),bili);await f.player.command(bili,'seek',138.5);await f.player.command(bili,'focus');assert.equal(f.guests.length,2);
 f.guests[1].ready();await new Promise(resolve=>setTimeout(resolve,1050));assert.deepEqual(f.guests[1].native.actions.filter(item=>item.action==='seek'),[{action:'seek',value:138.5}]);
});
test('invalid seek values never migrate a staged host or replace a pending time',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili,8);f.player.mount(f.host(),bili);
 for(const value of [undefined,-1,NaN,Infinity,864001])await assert.rejects(f.player.command(bili,'seek',value),/无效/);
 assert.equal(f.guests.length,1);assert.equal(f.guests[0].removed,false);
});
test('cancelling an uncommitted destination restores the old mounted guest without stopping playback',async t=>{
 const f=platformFixture(t),releaseOld=f.player.mount(f.host(),bili);f.player.open(bili,36);f.guests[0].ready();await setImmediate();const old=f.guests[0];
 const releaseDestination=f.player.mount(f.host(),bili),statesBefore=f.states.length;releaseDestination();
 assert.equal(old.removed,false);assert.equal(f.states.length,statesBefore,'rollback emits no closed state or playback action');
 await f.player.command(bili,'focus');assert.equal(f.guests.length,1);assert.equal(old.focused,1);assert.deepEqual(old.native.actions,[]);
 releaseOld();assert.equal(old.removed,true,'the restored original release remains effective');
});
test('cancelling a different-source destination restores the original source lease',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili);f.guests[0].ready();await setImmediate();
 const releaseDestination=f.player.mount(f.host(),bili+'?p=2');releaseDestination();await f.player.command(bili,'focus');
 assert.equal(f.guests.length,1);assert.equal(f.guests[0].removed,false);await assert.rejects(f.player.command(bili+'?p=2','focus'),/来源/);
});
test('a committed destination never rolls back to its destroyed former player',async t=>{
 const f=platformFixture(t),releaseOld=f.player.mount(f.host(),bili);f.player.open(bili);f.guests[0].ready();await setImmediate();
 const releaseDestination=f.player.mount(f.host(),bili);await f.player.command(bili,'focus');f.guests[1].ready();await setImmediate();releaseDestination();
 assert.equal(f.guests[0].removed,true);assert.equal(f.guests[1].removed,true);await assert.rejects(f.player.command(bili,'focus'),/插件内/);releaseOld();assert.equal(f.guests.length,2);
});
test('rollback cannot revive a released or disconnected former host',async t=>{
 for(const unavailable of ['released','disconnected']as const){
  const f=platformFixture(t),host=f.host(),releaseOld=f.player.mount(host,bili);f.player.open(bili);f.guests[0].ready();await setImmediate();const releaseDestination=f.player.mount(f.host(),bili);
  if(unavailable==='released')releaseOld();else(host as unknown as {isConnected:boolean}).isConnected=false;
  releaseDestination();assert.equal(f.guests[0].removed,true);await assert.rejects(f.player.command(bili,'focus'),/插件内/);
 }
});
test('multiple staged destinations retain only the live owner as their rollback target',async t=>{
 const f=platformFixture(t);f.player.mount(f.host(),bili);f.player.open(bili);f.guests[0].ready();await setImmediate();
 const releaseFirst=f.player.mount(f.host(),bili),releaseSecond=f.player.mount(f.host(),bili);releaseFirst();releaseSecond();
 await f.player.command(bili,'focus');assert.equal(f.guests.length,1);assert.equal(f.guests[0].removed,false);
});
test('guest stays hidden until a measured player-only surface is ready',async()=>{
 const f=fixture(),Embedded=createWebviewWindow(f.host,f.runtime),host=new Embedded(options),guest=f.guests[0];
 try{
  guest.native.surfaceReady=false;const opening=host.loadURL(bili);assert.equal((guest.style as {visibility:string}).visibility,'hidden');guest.ready();await opening;guest.ready();await setImmediate();
  assert.equal((guest.style as {visibility:string}).visibility,'hidden');guest.native.surfaceReady=true;guest.ready();await setImmediate();assert.equal((guest.style as {visibility:string}).visibility,'visible');
 }finally{host.destroy();}
});
test('a late ready result cannot expose a navigated site and SPA cleanup is source-bound',async()=>{
 const f=fixture(),Embedded=createWebviewWindow(f.host,f.runtime),host=new Embedded(options),guest=f.guests[0],gate=deferred<{applied:boolean;ready:boolean}>();
 try{
  const opening=host.loadURL(bili);guest.ready();await opening;guest.native.surfaceGate=gate.promise;guest.ready();
  guest.native.mainFrame.url='https://www.bilibili.com/';guest.dispatchEvent(new Event('did-navigate-in-page'));gate.resolve({applied:true,ready:true});await setImmediate();
  assert.equal((guest.style as {visibility:string}).visibility,'hidden');assert.match(guest.native.surfaceCalls.at(-1)??'',/state\?\.source===/);assert.ok(guest.native.surfaceCalls.at(-1)?.includes(bili));
  guest.native.surfaceGate=undefined;const calls=guest.native.surfaceCalls.length;guest.native.mainFrame.url='https://passport.bilibili.com/login';guest.ready();await setImmediate();
  assert.equal((guest.style as {visibility:string}).visibility,'visible','official authentication remains accessible');assert.equal(guest.native.surfaceCalls.length,calls,'no player script is installed into a fresh login document');
 }finally{host.destroy();}
});
