import {createOnlineController,type OnlineController,type OnlineState as ControllerState} from './online-platform/online-controller.mjs';
import {parseOnlineVideo,type ParsedOnlineSource} from './online-platform/online-video.mjs';
import {resolveOnlineVideo,type RedirectFetcher} from './online-platform/online-resolver.mjs';
import {createWebviewWindow,type OnlineWebviewRuntime} from './online-platform-webview';

export type OnlineSource=Omit<ParsedOnlineSource,'mediaUrl'>;
export type {OnlineAction} from './online-platform/online-controller.mjs';
export type OnlineState=Omit<ControllerState,'candidate'>&{candidate?:OnlineSource|null};
const source=(parsed:ParsedOnlineSource):OnlineSource=>({kind:'online',provider:parsed.provider,path:parsed.path,name:parsed.name,initialTime:parsed.initialTime});
interface MountLease {host:HTMLElement;path:string;released:boolean;previous?:MountLease}

/** Pure URL parsing: importing this module never loads Electron or starts I/O. */
export function parseOnlineSource(input:string):OnlineSource|undefined {
 try{return source(parseOnlineVideo(input));}catch{return;}
}

/** The resolver reads redirect headers only; it never downloads a page body. */
export async function resolveOnlineSource(input:string):Promise<OnlineSource> {
 const redirects:RedirectFetcher=(url,options)=>new Promise((resolve,reject)=>{
  const https=require('node:https') as typeof import('node:https');
  const request=https.get(url,{signal:options.signal},response=>{
   response.destroy();
   resolve({status:response.statusCode??0,headers:{get:name=>name.toLowerCase()==='location'?response.headers.location||null:null},body:null});
  });
  request.on('error',reject);
 });
 return source(await resolveOnlineVideo(input,redirects));
}

/** Owns one isolated guest inside its ItemView; it never creates a window. */
export class OnlinePlatform {
 private controller?:OnlineController;
 private disposed=false;
 private mounted?:MountLease;
 private activeLease?:MountLease;
 private activeHost?:HTMLElement;
 private activePath?:string;
 private state?:OnlineState;
 private resume?:{path:string;time:number};
 constructor(private readonly notify:(state:OnlineState)=>void,private readonly loadRuntime?:()=>OnlineWebviewRuntime){}
 mount(host:HTMLElement,sourcePath:string):()=>void {
  if(this.disposed)throw Error('在线视频播放器已关闭，请重新打开');
  const parsed=parseOnlineSource(sourcePath);if(!parsed)throw Error('无效的在线视频来源');
  // Keep only the actual owner, never a chain of speculative destinations.
  const lease:MountLease={host,path:parsed.path,released:false,previous:this.activeLease};this.mounted=lease;
  // Registering a destination does not interrupt the old view before the main
  // navigation transaction commits. open/focus performs the actual migration.
  return()=>{
   if(lease.released)return;lease.released=true;
   if(this.mounted!==lease)return;
   const previous=lease.previous;lease.previous=undefined;
   if(previous&&!previous.released&&previous===this.activeLease&&previous.host.isConnected&&this.activeHost===previous.host&&this.activePath===previous.path){this.mounted=previous;return;}
   this.mounted=undefined;this.stop();
  };
 }
 private requireMount(path:string):MountLease {
  if(this.disposed)throw Error('在线视频播放器已关闭，请重新打开');
  const mounted=this.mounted;
  if(!mounted||!mounted.host.isConnected)throw Error('请先打开插件内的视频面板');
  if(mounted.path!==path)throw Error('视频面板来源已变化，请重新选择视频');
  return mounted;
 }
 private getController():OnlineController {
  if(this.disposed)throw Error('在线视频播放器已关闭，请重新打开');
  if(this.controller)return this.controller;
  // These desktop-only modules are loaded only for an explicit playback action.
  let runtime:OnlineWebviewRuntime;
  try {
   if(this.loadRuntime)runtime=this.loadRuntime();
   else{
    const remote=require('@electron/remote') as Pick<OnlineWebviewRuntime,'webContents'|'session'>;
    const electron=require('electron') as Pick<OnlineWebviewRuntime,'shell'>;
    runtime={webContents:remote.webContents,session:remote.session,shell:electron.shell};
   }
   if(typeof runtime.webContents?.fromId!=='function'||typeof runtime.session?.fromPartition!=='function'||typeof runtime.shell?.openExternal!=='function')throw Error('Unavailable');
  }catch{throw Error('此 Obsidian 安装器不支持插件内播放器，请更新桌面安装器后重试');}
  const EmbeddedWindow=createWebviewWindow(()=>{if(!this.mounted)throw Error('请先打开插件内的视频面板');return this.mounted.host;},runtime);
  this.controller=createOnlineController({BrowserWindow:EmbeddedWindow,session:runtime.session,shell:runtime.shell,getHost:()=>({isDestroyed:()=>this.disposed,webContents:{send:(_channel,state)=>{
   if(!this.disposed){this.state={...state,...(state.candidate?{candidate:source(state.candidate)}:{})};if(state.available)this.resume={path:state.sourcePath,time:state.time};this.notify(this.state);}
  }}})});
  return this.controller;
 }
 open(path:string,time=0):OnlineSource {
  const parsed=parseOnlineSource(path);if(!parsed)throw Error('无效的在线视频来源');
  if(!Number.isFinite(time)||time<0||time>864000)throw Error('时间无效');
  const mounted=this.requireMount(parsed.path),controller=this.getController();
  if(this.activeHost&&this.activeHost!==mounted.host)controller.stop();
  const result=source(controller.open(parsed.path,time));this.activeHost=mounted.host;this.activePath=result.path;this.activeLease=mounted;mounted.previous=undefined;this.resume={path:result.path,time};return result;
 }
 async command(path:string,action:import('./online-platform/online-controller.mjs').OnlineAction,value?:number):Promise<boolean>{
  if(action!=='external'){
   const mounted=this.requireMount(path);
   if(action==='seek'){
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>864000)throw Error('无效的播放参数');
    if(this.activeHost!==mounted.host||this.activePath!==path||this.state?.closed){this.open(path,value);return true;}
    if(!this.state?.available&&this.getController().queueSeek(path,value)){this.activeLease=mounted;mounted.previous=undefined;this.resume={path,time:value};return true;}
   }
   if(action==='focus'&&(this.activeHost!==mounted.host||this.activePath!==path||this.state?.closed)){
    const time=this.resume?.path===path?this.resume.time:0;this.open(path,time);return true;
   }
   if(this.activeHost!==mounted.host)throw Error('视频面板正在切换，请稍后重试');
   if(action==='focus'){const result=await this.getController().command(path,action,value);if(this.mounted===mounted){this.activeLease=mounted;mounted.previous=undefined;}return result;}
  }
  return this.getController().command(path,action,value);
 }
 async adopt(path:string):Promise<OnlineSource>{const mounted=this.requireMount(path);const result=source(await this.getController().adopt(path));if(this.mounted!==mounted)throw Error('视频面板已切换，本次操作已取消');this.activePath=result.path;this.resume={path:result.path,time:result.initialTime??0};return result;}
 async position(path:string):Promise<number>{
  const mounted=this.requireMount(path);
  if(this.activeHost!==mounted.host||this.activePath!==path||this.activeLease!==mounted)throw Error('视频面板正在切换，请稍后重试');
  const time=await this.getController().position(path);
  if(this.disposed||this.mounted!==mounted||mounted.released||!mounted.host.isConnected||this.activeHost!==mounted.host||this.activePath!==path||this.activeLease!==mounted)throw Error('读取时间戳期间视频面板已切换，本次记录已取消');
  return time;
 }
 async capture(path:string):Promise<{bytes:Uint8Array;time:number}>{const mounted=this.requireMount(path);if(this.activeHost!==mounted.host)throw Error('视频面板正在切换，请稍后重试');const result=await this.getController().capture(path);if(this.mounted!==mounted||this.activeHost!==mounted.host)throw Error('截图期间视频面板已切换，本次截图已取消');return result;}
 stop():void{this.controller?.stop();this.activeHost=undefined;this.activePath=undefined;this.activeLease=undefined;}
 dispose():void{if(this.disposed)return;this.disposed=true;this.stop();this.mounted=undefined;this.controller=undefined;}
}
