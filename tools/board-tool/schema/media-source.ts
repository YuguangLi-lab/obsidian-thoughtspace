import type {Card} from './model';
import {hasAsciiControl} from './value-guards';
import {isBoardPath} from './board-path';

export type MediaKind='audio'|'video';
export const maximumMediaTime=100000000;
/** Extensions identify attachment types; they do not promise browser codec support. */
export function mediaKind(path:string):MediaKind|undefined {
 if(/\.(mp4|webm|mov|m4v|ogv|tsvideo)$/i.test(path))return 'video';
 if(/\.(mp3|m4a|wav|ogg|oga|flac|aac|opus|tsaudio)$/i.test(path))return 'audio';
}
/** Retain literal percent signs and hashes. URL decoding belongs only at the URL boundary. */
export function isVaultMediaPath(path:unknown):path is string{return isVaultPath(path)&&mediaKind(path)!==undefined;}
function isVaultPath(path:unknown):path is string {
 return typeof path==='string'&&path.length>0&&path.length<=8192&&path.trim()===path&&!hasControl(path)&&!path.includes('\\')&&!/^([a-z][a-z\d+.-]*:|\/)/i.test(path)&&path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');
}
function hasControl(value:string):boolean{return hasAsciiControl(value)||value.includes('\u007f');}
export function validMediaTime(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=maximumMediaTime;}
export function mediaTime(value:number=0):number {if(!validMediaTime(value))throw Error('媒体时间必须介于 0 与 100000000 秒之间');return value;}
/** Accept seconds or a conventional m:ss / h:mm:ss clock, including fractional seconds. */
export function parseMediaTime(text:string):number|undefined {
 const value=text.trim();if(!value)return;
 if(/^\d+(?:\.\d+)?$/.test(value)){const seconds=Number(value);return validMediaTime(seconds)?seconds:undefined;}
 const parts=value.split(':');if(parts.length<2||parts.length>3||!/^\d+$/.test(parts[0])||!parts.slice(1,-1).every(part=>/^\d{2}$/.test(part)&&Number(part)<60)||!/^\d{2}(?:\.\d+)?$/.test(parts.at(-1)!)||Number(parts.at(-1))>=60)return;
 const seconds=parts.reduce((total,part)=>total*60+Number(part),0);return validMediaTime(seconds)?seconds:undefined;
}
export function mediaClock(value:number):string {
 const seconds=Math.floor(mediaTime(value)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),tail=String(seconds%60).padStart(2,'0');
 return hours?`${hours}:${String(minutes).padStart(2,'0')}:${tail}`:`${minutes}:${tail}`;
}
export function mediaCard(id:string,file:string,x:number,y:number,width=320,start=0):Card {
 if(!isVaultMediaPath(file))throw Error('请选择仓库中的音频或视频');
 if(!id.trim()||![x,y,width].every(Number.isFinite)||width<80)throw Error('媒体卡片尺寸无效');
 const kind=mediaKind(file)!;width=Math.max(220,Math.min(1600,width));
 return{id,kind,file,mediaStart:mediaTime(start),x:x-width/2,y:y-70,width,height:kind==='video'?Math.round(width*9/16)+72:140,color:'slate'};
}

export interface MediaSource {vault:string;board:string;node:string;file:string;time:number}
function validLabel(value:unknown):value is string{return typeof value==='string'&&!!value.trim()&&value.length<=1000&&!hasControl(value);}
function validSource(source:MediaSource):boolean{return validLabel(source.vault)&&isVaultPath(source.board)&&isBoardPath(source.board)&&validLabel(source.node)&&isVaultMediaPath(source.file)&&validMediaTime(source.time);}
/** A backlink identifies a concrete board node and attachment, preventing silent retargeting. */
export function mediaSourceUrl(source:MediaSource):string {
 if(!validSource(source))throw Error('媒体来源链接无效');
 const params=new URLSearchParams({vault:source.vault,board:source.board,node:source.node,file:source.file,t:String(source.time)});
 // Obsidian decodes URI fields without converting form-encoded '+' to a space.
 return 'obsidian://thoughtspace-media?'+params.toString().replace(/\+/g,'%20');
}
/** Handles both a full link and Obsidian's already-decoded protocol callback values. */
export function parseMediaSourceUrl(input:string|URLSearchParams|Readonly<Record<string,unknown>>):MediaSource|undefined {
 let params:URLSearchParams;
 if(typeof input==='string'){
  if(hasControl(input)||input.includes(' ')||/%(?![0-9a-f]{2})/i.test(input))return;
  let url:URL;try{url=new URL(input);}catch{return;}
  if(url.protocol!=='obsidian:'||url.hostname!=='thoughtspace-media'||url.pathname&&url.pathname!=='/'||url.username||url.password||url.port||url.hash)return;
  try{decodeURIComponent(url.search);}catch{return;}
  params=url.searchParams;
 }else if(input instanceof URLSearchParams)params=input;
 else {
  params=new URLSearchParams();
  for(const [key,value] of Object.entries(input)){if(typeof value!=='string')return;params.append(key,value);}
 }
 const keys=['vault','board','node','file','t'];
 for(const key of params.keys())if(!keys.includes(key)&&key!=='action')return;
 if(keys.some(key=>params.getAll(key).length!==1)||params.getAll('action').length>1||params.has('action')&&params.get('action')!=='thoughtspace-media')return;
 const timeText=params.get('t')!;if(!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(timeText))return;
 const source:MediaSource={vault:params.get('vault')!,board:params.get('board')!,node:params.get('node')!,file:params.get('file')!,time:Number(timeText)};
 return validSource(source)?source:undefined;
}
export function mediaSourceMarkdown(source:MediaSource,label=`${source.file.split('/').at(-1)} · ${mediaClock(source.time)}`):string {
 const title=label.replace(/[\r\n]+/g,' ').replace(/[\\[\]*_`<>]/g,'\\$&');
 return `[${title}](${mediaSourceUrl(source)})`;
}
/** Markdown exports refer to attachments without ever reading binary contents as text. */
export function mediaFileMarkdown(file:string,time=0):string {
 if(!isVaultMediaPath(file))throw Error('媒体文件路径无效');mediaTime(time);
 const label=`${file.split('/').at(-1)} · ${mediaClock(time)}`.replace(/[\\[\]*_`<>]/g,'\\$&');
 const path=file.split('/').map(part=>encodeURIComponent(part).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16))).join('/');
 return `[${label}](${path}#t=${time})`;
}
