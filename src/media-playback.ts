import type {MediaCardHandle,MediaCardState} from './media-card-player';
import {isVaultMediaPath,validMediaTime} from './media-source';
import {isRecord} from './value-guards';

export interface MediaIdentity {path:string;mtime:number;size:number}
interface ResumeEntry extends MediaIdentity {state:MediaCardState}
interface Registration {file:MediaIdentity}
function identityKey(file:MediaIdentity){return JSON.stringify([file.path,file.mtime,file.size]);}
function validIdentity(file:MediaIdentity){return isVaultMediaPath(file.path)&&Number.isFinite(file.mtime)&&file.mtime>=0&&Number.isFinite(file.size)&&file.size>=0;}
export function cleanMediaPlaybackState(input:unknown):MediaCardState|undefined{
 if(!isRecord(input)||!validMediaTime(input.time)||typeof input.rate!=='number'||!Number.isFinite(input.rate)||input.rate<.25||input.rate>4||typeof input.volume!=='number'||!Number.isFinite(input.volume)||input.volume<0||input.volume>1)return;
 const state:MediaCardState={time:input.time,rate:input.rate,volume:input.volume};
 if(validMediaTime(input.loopA)){state.loopA=input.loopA;if(validMediaTime(input.loopB)&&input.loopB>=input.loopA+.5)state.loopB=input.loopB;}
 return state;
}
/** Small shared resume memory. Decoder ownership remains with the mounted view. */
export class MediaPlayback {
 private entries=new Map<string,ResumeEntry>();
 private handles=new Map<MediaCardHandle,Registration>();
 private owners=new Map<string,MediaCardHandle>();
 private activation=0;
 private limit:number;
 constructor(private changed:()=>void=()=>{},limit=80){this.limit=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,1000):80;}
 get(file:MediaIdentity):MediaCardState|undefined{const entry=this.entries.get(file.path);return entry&&identityKey(entry)===identityKey(file)?{...entry.state}:undefined;}
 remember(file:MediaIdentity,raw:MediaCardState,handle?:MediaCardHandle){
  const state=cleanMediaPlaybackState(raw);if(!state||!validIdentity(file))return;
  const owner=this.owners.get(file.path),registered=handle?this.handles.get(handle):undefined;
  if(handle&&(!registered||identityKey(registered.file)!==identityKey(file)||owner&&owner!==handle))return;
  if(!handle&&owner&&identityKey(this.handles.get(owner)!.file)!==identityKey(file))return;
  if(handle&&!owner)this.owners.set(file.path,handle);
  const old=this.entries.get(file.path);if(old&&identityKey(old)===identityKey(file)&&JSON.stringify(old.state)===JSON.stringify(state))return;
  this.entries.delete(file.path);this.entries.set(file.path,{...file,state});while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value!);this.changed();
 }
 register(file:MediaIdentity,handle:MediaCardHandle){
  if(!validIdentity(file))throw Error('媒体来源无效');
  const previous=this.handles.get(handle);if(previous&&this.owners.get(previous.file.path)===handle)this.owners.delete(previous.file.path);
  const registration={file:{...file}},owner=this.owners.get(file.path),owned=owner?this.handles.get(owner):undefined;
  if(owned&&identityKey(owned.file)!==identityKey(file))this.retire(file.path);
  this.handles.set(handle,registration);
  if(!owned||identityKey(owned.file)!==identityKey(file))this.owners.set(file.path,handle);
  let active=true;
  return()=>{if(!active)return;active=false;if(this.handles.get(handle)!==registration)return;this.handles.delete(handle);if(this.owners.get(file.path)===handle)this.owners.delete(file.path);};
 }
 activate(handle:MediaCardHandle){
  const registration=this.handles.get(handle);if(!registration)return;
  const activation=++this.activation;this.owners.set(registration.file.path,handle);
  let failure:Error|undefined;
  for(const other of [...this.handles.keys()]){if(activation!==this.activation)return;if(other!==handle&&this.handles.has(other))try{other.pause();}catch(error){failure??=error instanceof Error?error:Error('播放器无法暂停');}}
  if(failure){try{handle.pause();}catch{/* Do not leave the newly requested player running after a failed handoff. */}throw failure;}
 }
 pauseAll(){let failure:Error|undefined;for(const handle of [...this.handles.keys()])try{handle.pause();}catch(error){failure??=error instanceof Error?error:Error('播放器无法暂停');}if(failure)throw failure;}
 recent(){return [...this.entries.keys()].reverse();}
 private retire(path:string){this.owners.delete(path);for(const[handle,registration]of [...this.handles])if(registration.file.path===path){this.handles.delete(handle);try{handle.pause();}catch{/* File lifecycle cleanup must continue for every mounted instance. */}}}
 remove(path:string){const changed=this.entries.delete(path);this.retire(path);if(changed)this.changed();}
 rename(from:string,to:string){if(from===to||!isVaultMediaPath(to))return;const current=this.entries.get(from);this.entries.delete(from);this.retire(from);if(current){this.entries.set(to,{...current,path:to});this.changed();}}
 export(){return {version:1,entries:[...this.entries.values()].map(entry=>({...entry,state:{...entry.state}}))};}
 import(raw:unknown){
  if(!isRecord(raw)||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>this.limit)return;
  const loaded=new Map<string,ResumeEntry>();
  for(const value of raw.entries){if(!isRecord(value)||!isVaultMediaPath(value.path)||typeof value.mtime!=='number'||!Number.isFinite(value.mtime)||value.mtime<0||typeof value.size!=='number'||!Number.isFinite(value.size)||value.size<0)continue;const state=cleanMediaPlaybackState(value.state);if(state)loaded.set(value.path,{path:value.path,mtime:value.mtime,size:value.size,state});}
  // A slow disk read must never replace progress already changed in this session.
  for(const[path,entry]of this.entries){loaded.delete(path);loaded.set(path,entry);}while(loaded.size>this.limit)loaded.delete(loaded.keys().next().value!);this.entries=loaded;
 }
}
