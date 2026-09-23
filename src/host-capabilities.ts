import type {TFile} from 'obsidian';
import {isRecord} from './value-guards';

/** Optional, undocumented host capabilities must be checked before they are used. */
export function hostPlugin(app:unknown,id:string):unknown {
 if(!isRecord(app)||!isRecord(app.plugins)||!isRecord(app.plugins.plugins))return;
 return app.plugins.plugins[id];
}
interface FileExplorer {revealInFolder(file:TFile):unknown}
export function fileExplorer(value:unknown):FileExplorer|undefined {
 return isFileExplorer(value)?value:undefined;
}
function isFileExplorer(value:unknown):value is FileExplorer {
 return isRecord(value)&&typeof value.revealInFolder==='function';
}
interface HostSettings {open():void;openTabById(id:string):void}
function isHostSettings(value:unknown):value is HostSettings {
 return isRecord(value)&&typeof value.open==='function'&&typeof value.openTabById==='function';
}
export function hostSettings(app:unknown):HostSettings|undefined {
 return isRecord(app)&&isHostSettings(app.setting)?app.setting:undefined;
}
export function workspaceLeafId(leaf:unknown):string|undefined {
 return isRecord(leaf)&&typeof leaf.id==='string'?leaf.id:undefined;
}
