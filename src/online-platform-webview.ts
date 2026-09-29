import type {ControllerDependencies,PlatformContents,PlatformFrame,WindowOptions} from './online-platform/online-controller.mjs';
import {parseOnlineVideo} from './online-platform/online-video.mjs';
import {onlinePlayerSurface} from './online-player-surface';

/** Electron's guest API is available only after its initial dom-ready event. */
export interface OnlineWebview extends HTMLElement {
 getWebContentsId():number;
 loadURL(url:string):Promise<void>;
}
type Listener=Parameters<PlatformContents['on']>[1];
class Events {
 private listeners=new Map<string|symbol,Set<Listener>>();
 on(event:string|symbol,listener:Listener):this {
  let listeners=this.listeners.get(event);if(!listeners)this.listeners.set(event,listeners=new Set());listeners.add(listener);return this;
 }
 removeListener(event:string|symbol,listener:Listener):this{this.listeners.get(event)?.delete(listener);return this;}
 emit(event:string,...args:unknown[]):void{for(const listener of this.listeners.get(event)??[])listener(...args);}
 clear():void{this.listeners.clear();}
}

/** No privileged object or preload is exposed to the official webpage. */
export interface OnlineWebviewRuntime {
 webContents:{fromId(id:number):PlatformContents|undefined};
 session:ControllerDependencies['session'];
 shell:ControllerDependencies['shell'];
}

const forwardedEvents=['will-navigate','will-redirect','will-attach-webview','did-start-navigation','did-fail-load'] as const;
class GuestContents extends Events {
 private native?:PlatformContents;
 private bindings:Array<{event:string;listener:Listener}>=[];
 private popup?:(details:{url:string})=>{action:'deny'};
 private readonly pendingFrame:PlatformFrame={url:'about:blank',framesInSubtree:[],executeJavaScript:()=>Promise.reject(Error('内嵌播放器正在初始化'))};
 get mainFrame():PlatformFrame{return this.native?.mainFrame??this.pendingFrame;}
 getURL():string{return this.native?.getURL()??'about:blank';}
 reload():void{this.requireNative().reload();}
 setWindowOpenHandler(handler:NonNullable<GuestContents['popup']>):void{this.popup=handler;this.native?.setWindowOpenHandler(handler);}
 private requireNative():PlatformContents{if(!this.native)throw Error('内嵌播放器尚未就绪，请稍后重试');return this.native;}
 bind(native:PlatformContents,onDestroyed:()=>void):void {
  if(this.native===native)return;
  if(this.native)throw Error('内嵌播放器进程已更换，请重新打开视频');
  this.native=native;
  // All guards are registered before loadURL is released from its ready queue.
  native.setWindowOpenHandler(this.popup??(()=>({action:'deny'})));
  for(const event of forwardedEvents){const listener:Listener=(...args:unknown[])=>this.emit(event,...args);native.on(event,listener);this.bindings.push({event,listener});}
  for(const event of ['destroyed','render-process-gone']){const listener:Listener=()=>onDestroyed();native.on(event,listener);this.bindings.push({event,listener});}
 }
 detach():void {if(this.native)for(const {event,listener}of this.bindings)this.native.removeListener(event,listener);this.bindings=[];this.native=undefined;this.clear();}
}

/**
 * Matches the existing controller's host contract, but creates only a DOM guest.
 * The historical BrowserWindow dependency name is an internal compatibility key.
 * Design references: Video Note's ItemView WebviewPlayer and Media Extended v3's
 * WebView provider. This adapter is independently implemented; no upstream code
 * or preload is copied.
 */
export function createWebviewWindow(getHost:()=>HTMLElement,runtime:Pick<OnlineWebviewRuntime,'webContents'>):ControllerDependencies['BrowserWindow'] {
 class EmbeddedWindow extends Events {
  readonly webContents=new GuestContents();
  private readonly element:OnlineWebview;
  private readonly loading:HTMLDivElement;
  private destroyed=false;
  private settled=false;
  private loadRevision=0;
  private nativeId?:number;
  private surfaceSource?:string;
  private surfaceRequest=0;
  private surfaceTimer?:ReturnType<typeof setTimeout>;
  private surfaceDeadline=0;
  private readonly ready:Promise<void>;
  private resolveReady!:()=>void;
  private rejectReady!:(error:Error)=>void;
  private readonly timeout:ReturnType<typeof setTimeout>;
  constructor(options:WindowOptions){
   super();
   const host=getHost();if(!host.isConnected)throw Error('请先显示插件内的视频面板');
   this.loading=host.ownerDocument.createElement('div');this.loading.classList.add('ts-online-workspace__empty');this.loading.textContent='正在加载视频播放器…';this.loading.setAttribute('role','status');
   const element=this.element=host.ownerDocument.createElement('webview') as OnlineWebview;
   element.classList.add('ts-online-platform-webview');
   element.setAttribute('partition',options.webPreferences.partition);
   element.setAttribute('webpreferences','sandbox=yes,contextIsolation=yes,nodeIntegration=no,nodeIntegrationInSubFrames=no,webSecurity=yes,allowRunningInsecureContent=no');
   element.setAttribute('aria-label','官方视频播放器');
   Object.assign(element.style,{display:'inline-flex',width:'100%',height:'100%',visibility:'hidden'});
   this.ready=new Promise<void>((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
   // A close before open() reaches loadURL must never create an unhandled promise.
   void this.ready.catch(()=>undefined);
   element.addEventListener('dom-ready',this.onReady);
   element.addEventListener('did-fail-load',this.onInitialFailure);
   element.addEventListener('did-navigate-in-page',this.installSurface);
   element.addEventListener('did-start-navigation',this.onNavigationStarted);
   this.timeout=setTimeout(()=>this.fail(Error('内嵌播放器初始化超时，请更新 Obsidian 桌面安装器后重试')),10000);
   element.setAttribute('src','about:blank');
   host.appendChild(this.loading);host.appendChild(element);
  }
  private onReady=()=>{
   if(this.destroyed)return;
   try{
    if(typeof this.element.getWebContentsId!=='function'||typeof this.element.loadURL!=='function')throw Error('此 Obsidian 安装器不支持插件内播放器');
    const id=this.element.getWebContentsId();
    if(!Number.isSafeInteger(id)||id<=0)throw Error('未找到内嵌播放器进程');
    if(this.nativeId===id){this.installSurface();return;}
    if(this.nativeId!==undefined)throw Error('内嵌播放器进程已更换，请重新打开视频');
    const native=runtime.webContents.fromId(id);
    if(!native||typeof native.setWindowOpenHandler!=='function'||typeof native.mainFrame?.executeJavaScript!=='function')throw Error('无法连接内嵌播放器进程');
    this.webContents.bind(native,()=>this.destroy());
    this.nativeId=id;
    this.installSurface();
    if(!this.settled){this.settled=true;clearTimeout(this.timeout);this.resolveReady();}
   }catch(error){this.fail(error instanceof Error?error:Error('内嵌播放器初始化失败'));}
  };
  private installSurface=(event?:Event)=>{this.updateSurface('install',event?.type==='did-navigate-in-page');};
  private setVisible(visible:boolean){this.element.setCssProps({visibility:visible?'visible':'hidden'});this.loading.hidden=visible;}
  private onNavigationStarted=(event:Event)=>{if((event as Event&{isMainFrame?:boolean}).isMainFrame){this.setVisible(false);this.surfaceDeadline=Date.now()+30000;this.surfaceRequest++;clearTimeout(this.surfaceTimer);}};
  private clearSurface(source:string){
   // Cleanup is identity-bound so a delayed old request cannot remove a newer
   // video's surface. It creates no layout or observer on non-playback pages.
   const script=`(()=>{const state=window[Symbol.for('thoughtspace.online.player-surface')];if(state?.source===${JSON.stringify(source)})state.dispose();})()`;
   void this.webContents.mainFrame.executeJavaScript(script).catch(()=>undefined);
  }
  private updateSurface(action:'install'|'dispose',sameDocument=false){
   if(this.destroyed||this.nativeId===undefined)return;
   if(sameDocument)this.surfaceDeadline=Date.now()+30000;
   const request=++this.surfaceRequest;clearTimeout(this.surfaceTimer);
   try{
    const url=this.webContents.getURL(),source=parseOnlineVideo(url);
    if(source.provider!=='bilibili'&&source.provider!=='youtube')throw Error('Not a focused playback source');
    if(action==='dispose'){if(this.surfaceSource)this.clearSurface(this.surfaceSource);this.surfaceSource=undefined;return;}
    const args=JSON.stringify([source.provider,source.path,action]);
    this.surfaceSource=source.path;
    void this.webContents.mainFrame.executeJavaScript(`(${onlinePlayerSurface.toString()})(...${args})`).then(result=>{
     if(this.destroyed||request!==this.surfaceRequest)return;
     const ready=!!result&&typeof result==='object'&&'ready'in result&&result.ready===true;
     this.setVisible(ready);
     if(!ready&&Date.now()<this.surfaceDeadline)this.surfaceTimer=setTimeout(()=>this.updateSurface('install'),250);
     else if(!ready)this.loading.textContent='播放器尚未就绪，请点击“加载视频 / 重试”';
    }).catch(()=>{if(!this.destroyed&&request===this.surfaceRequest){this.setVisible(false);this.loading.textContent='播放器暂不可显示，请点击“加载视频 / 重试”';}});
   }catch{
    // A pushState transition need not mutate DOM or emit popstate. Clear a
    // surface left in that same document, while fresh login documents receive
    // no injected layout code at all.
    if(sameDocument&&this.surfaceSource)this.clearSurface(this.surfaceSource);
    this.surfaceSource=undefined;
    // Authentication pages are intentionally presented as official forms;
    // arbitrary site navigation never becomes the embedded player surface.
    try{const url=new URL(this.webContents.getURL());this.setVisible(url.protocol==='https:'&&['passport.bilibili.com','accounts.google.com','consent.google.com','consent.youtube.com'].includes(url.hostname));}catch{this.setVisible(false);}
   }
  }
  private onInitialFailure=(event:Event)=>{if(!this.settled){const data=event as Event&{errorCode?:number};if(data.errorCode!==-3)this.fail(Error('内嵌播放器初始化失败，请重新打开视频'));}};
  private fail(error:Error):void {
   if(this.destroyed)return;
   if(!this.settled){this.settled=true;clearTimeout(this.timeout);this.rejectReady(error);}
   this.webContents.emit('did-fail-load',{},-1,error.message,'about:blank',true);
   this.destroy();
  }
  async loadURL(url:string):Promise<void>{
   const revision=++this.loadRevision;this.setVisible(false);this.loading.textContent='正在加载视频播放器…';this.surfaceDeadline=Date.now()+30000;this.surfaceRequest++;clearTimeout(this.surfaceTimer);await this.ready;
   if(this.destroyed||revision!==this.loadRevision)throw Error('视频已切换，本次加载已取消');
   await this.element.loadURL(url);
   if(this.destroyed||revision!==this.loadRevision)throw Error('视频已切换，本次加载已取消');
  }
  isDestroyed():boolean{return this.destroyed;}
  destroy():void {
   if(this.destroyed)return;this.updateSurface('dispose');this.destroyed=true;this.loadRevision++;this.surfaceRequest++;clearTimeout(this.timeout);clearTimeout(this.surfaceTimer);
   if(!this.settled){this.settled=true;this.rejectReady(Error('内嵌播放器已关闭'));}
   this.element.removeEventListener('dom-ready',this.onReady);this.element.removeEventListener('did-fail-load',this.onInitialFailure);this.element.removeEventListener('did-navigate-in-page',this.installSurface);this.element.removeEventListener('did-start-navigation',this.onNavigationStarted);
   this.webContents.detach();this.element.remove();this.loading.remove();this.emit('closed');this.clear();
  }
  setMenuBarVisibility():void{/* Embedded guests have no menu bar. */}
  show():void{/* The owning ItemView determines visibility. */}
  focus():void{if(!this.destroyed)this.element.focus();}
 }
 // The original controller consumes only the event and host methods above;
 // its declaration retains the fuller EventEmitter shape for native hosts.
 return EmbeddedWindow as unknown as ControllerDependencies['BrowserWindow'];
}
