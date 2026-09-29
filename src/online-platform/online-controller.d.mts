import {EventEmitter} from 'node:events';
import type {ParsedOnlineSource} from './online-video.mjs';
export interface OnlineState {
 sourcePath:string;available:boolean;closed:boolean;time:number;duration:number;paused:boolean;rate?:number;
 status?:'loading'|'waiting'|'synced'|'source-changed'|'blocked'|'error'|'closed';error?:string;candidate?:ParsedOnlineSource|null;
}
export type OnlineAction='toggle'|'pause'|'seek'|'rate'|'focus'|'reload'|'external';
export interface PlatformFrame {url:string;framesInSubtree?:PlatformFrame[];executeJavaScript(script:string,userGesture?:boolean):Promise<unknown>}
export interface PlatformContents extends EventEmitter {
 mainFrame:PlatformFrame;getURL():string;reload():void;
 setWindowOpenHandler(handler:(details:{url:string})=>{action:'deny'}):void;
}
export interface PlatformWindow extends EventEmitter {
 webContents:PlatformContents;loadURL(url:string):Promise<unknown>;isDestroyed():boolean;destroy():void;setMenuBarVisibility(visible:boolean):void;show():void;focus():void;
}
export interface WindowOptions {
 width:number;height:number;minWidth:number;minHeight:number;title:string;backgroundColor:string;
 webPreferences:{partition:string;sandbox:boolean;contextIsolation:boolean;nodeIntegration:boolean;webSecurity:boolean;allowRunningInsecureContent:boolean};
}
export interface PlatformSession extends EventEmitter {
 setPermissionRequestHandler(handler:(contents:unknown,permission:string,done:(allowed:boolean)=>void)=>void):void;
 setPermissionCheckHandler(handler:(contents:unknown,permission:string)=>boolean):void;
}
export interface ControllerDependencies {
 BrowserWindow:new(options:WindowOptions)=>PlatformWindow;
 session:{fromPartition(partition:string):PlatformSession};shell:{openExternal(url:string):Promise<unknown>};
 getHost:()=>{isDestroyed():boolean;webContents:{send(channel:string,state:OnlineState):void}}|null;
 every?:(callback:()=>void,milliseconds:number)=>unknown;cancel?:(handle:unknown)=>void;
}
export interface OnlineController {
 open(input:string,time?:number):ParsedOnlineSource;
 command(sourcePath:string,action:OnlineAction,value?:number):Promise<boolean>;
 queueSeek(sourcePath:string,time:number):boolean;
 adopt(expectedSourcePath:string):Promise<ParsedOnlineSource>;
 position(sourcePath:string):Promise<number>;
 capture(sourcePath:string):Promise<{bytes:Uint8Array;time:number}>;
 stop():void;
}
export function createOnlineController(dependencies:ControllerDependencies):OnlineController;
