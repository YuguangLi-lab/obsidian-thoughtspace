import {imageMarkup,escapeLabel,maxDocument,noteProperties,parameterTime,paramsOnly,readMoments,scalar,urlParams,validId,type MediaMoment} from './media-notes';
import {markdownRows} from './markdown-context';
import {maskInlineCode} from './markdown-literals';
import {mediaClock,validMediaTime} from './media-source';
import {parseOnlineSource} from './online-platform';
import {hasAsciiControl} from './value-guards';
import {yingjianNotePath} from './yingjian';

const marker='thoughtspace-online-',protocol='thoughtspace-online-player';
const control=(value:string)=>hasAsciiControl(value)||value.includes('\u007f');
const validVault=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=1000&&!control(value);
const validTime=(value:unknown):value is number=>validMediaTime(value)&&value<=864000;
const validNote=(value:unknown):value is string=>typeof value==='string'&&value.trim()===value&&!control(value)&&!!yingjianNotePath(value)&&!/^[a-z][a-z\d+.-]*:/i.test(value);
function canonicalSource(value:unknown):string|undefined {
 if(typeof value!=='string'||value.trim()!==value||control(value))return;
 // Metadata and protocol values must be URLs, not pasted prose containing a URL.
 if(!/^https:\/\//.test(value)||/[\s<>"，。]/.test(value))return;
 return parseOnlineSource(value)?.path;
}
function requireSource(value:string):string {
 const source=canonicalSource(value);if(!source)throw Error('在线视频来源无效');return source;
}
function timeValue(value:number):number {
 if(!validTime(value))throw Error('在线视频时间应介于 0 与 864000 秒之间');return value;
}

/** Recognize only closed, unambiguous source metadata; never rewrite a legacy header. */
export function onlineNoteSource(raw:string):string|undefined {
 if(raw.length>maxDocument)return;
 const props=noteProperties(raw);if(props.has('thoughtspace_media'))return;
 if(props.has('thoughtspace_online_video')){
  const source=canonicalSource(scalar(props.get('thoughtspace_online_video')||''));
  if(!source||props.has('source')&&canonicalSource(scalar(props.get('source')||''))!==source)return;
  return source;
 }
 const source=canonicalSource(scalar(props.get('source')||''));if(!source)return;
 const identified=['video-note-id','yingjian-capture-id'].some(key=>!!scalar(props.get(key)||'')?.trim());
 const tags=(props.get('tags')||'').replace(/[[\],"']/g,' ').split(/\s+/).some(tag=>tag.replace(/^#/,'')==='影笺');
 return identified||tags?source:undefined;
}

export function onlineNoteDocument(source:string):string {
 const path=requireSource(source),name=parseOnlineSource(path)!.name;
 return `---\nthoughtspace_online_video: ${JSON.stringify(path)}\n---\n\n# ${escapeLabel(name)}\n\n`;
}
export interface OnlinePlayerSource {vault:string;source:string;time:number;note?:string}
export function onlinePlayerUrl(vault:string,source:string,time:number,note?:string):string {
 if(!validVault(vault)||note!==undefined&&!validNote(note))throw Error('在线视频回看链接的仓库或笔记路径无效');
 const params=new URLSearchParams({vault,source:requireSource(source),t:String(timeValue(time))});if(note!==undefined)params.set('note',note);
 return 'obsidian://'+protocol+'?'+params.toString();
}
/** Accepts both URI text and Obsidian's already-decoded callback fields. */
export function parseOnlinePlayerUrl(input:string|Record<string,string>):OnlinePlayerSource|undefined {
 const params=urlParams(input,'obsidian',protocol);
 if(!params||!paramsOnly(params,['vault','source','t'],['note','action'])||params.has('action')&&params.get('action')!==protocol)return;
 const vault=params.get('vault')!,source=canonicalSource(params.get('source')),time=parameterTime(params.get('t')),note=params.get('note');
 if(!validVault(vault)||!source||!validTime(time)||note!==null&&!validNote(note))return;
 return{vault,source,time,...(note!==null?{note}:{})};
}

export interface OnlineMomentInput {id:string;time:number;text:string;image?:string}
/** Append-only and idempotent across old/new block anchors in an identified source note. */
export function appendOnlineMoment(raw:string,moment:OnlineMomentInput,source:string,vault:string,notePath?:string):string {
 const path=requireSource(source);
 if(raw.length>maxDocument)throw Error('媒体笔记超过 500,000 字符');
 if(/^---\r?\n/.test(raw)&&!raw.split(/\r?\n/).some((line,index)=>index>0&&/^(---|\.\.\.)\s*$/.test(line)))throw Error('请先闭合笔记开头的属性区域');
 if(onlineNoteSource(raw)!==path)throw Error('笔记属于另一在线视频来源，或缺少有效来源属性');
 if(!validId(moment.id)||typeof moment.text!=='string'||moment.text.length>100000||moment.text.includes('\0')||moment.image!==undefined&&!imageMarkup(moment.image))throw Error('在线视频时间点内容无效');
 const url=onlinePlayerUrl(vault,path,moment.time,notePath),rows=[...markdownRows(raw)],anchor='^'+marker+moment.id;
 if(rows.at(-1)?.openBlock)throw Error('请先闭合笔记末尾的代码围栏或注释');
 const existing=new RegExp('(?:^|\\s)\\^(?:'+marker+'|video-t-)'+moment.id+'\\s*$');
 if(rows.some(row=>!row.code&&existing.test(maskInlineCode(row.visible))))return raw;
 const newline=raw.includes('\r\n')?'\r\n':'\n',body=moment.text.replace(/\r\n?/g,'\n').split('\n');
 const content=[`> [!note] [${mediaClock(moment.time)}](${url})`,...body.map(line=>'> '+line),...(moment.image?['>','> '+moment.image]:[]),'',anchor,''].join(newline);
 if(![...markdownRows(content)].some(row=>!row.code&&row.topLevel&&row.visible.trim()===anchor))throw Error('请先闭合时间点正文中的注释');
 const separator=!raw?'':raw.endsWith(newline+newline)?'':raw.endsWith(newline)?newline:newline+newline;
 if(raw.length+separator.length+content.length>maxDocument)throw Error('媒体笔记超过 500,000 字符');
 return raw+separator+content;
}

/** A legacy link must agree with this note's canonical source and the caller's vault. */
export function readOnlineMoments(raw:string,source:string,vault:string,vaultId?:string):MediaMoment[] {
 const path=canonicalSource(source);
 if(!path||!validVault(vault)||onlineNoteSource(raw)!==path||vaultId!==undefined&&!/^[a-f\d]{20}$/.test(vaultId))return [];
 const current=readMoments(raw,url=>{const link=parseOnlinePlayerUrl(url);return link&&link.vault===vault&&link.source===path?link.time:undefined;},marker);
 const legacy=readMoments(raw,url=>{
  const params=urlParams(url,'yingjian','open');if(!params||!paramsOnly(params,['video','t'],['note','vault'])||canonicalSource(params.get('video'))!==path)return;
  if(params.has('vault')&&params.get('vault')!==vault&&params.get('vault')!==vaultId||params.has('note')&&!validNote(params.get('note')))return;
  const time=parameterTime(params.get('t'));return validTime(time)?time:undefined;
 },'video-t-');
 const seen=new Set<string>();return [...current,...legacy].sort((a,b)=>a.line-b.line).filter(moment=>{if(seen.has(moment.id))return false;seen.add(moment.id);return true;});
}
