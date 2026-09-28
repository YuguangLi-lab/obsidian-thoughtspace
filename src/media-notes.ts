import {markdownRows} from './markdown-context';
import {markdownLinkRanges} from './markdown-links';
import {maskInlineCode} from './markdown-literals';
import {isVaultMediaPath,mediaClock,mediaKind,mediaTime,validMediaTime} from './media-source';
import {hasAsciiControl} from './value-guards';

export interface MediaNoteSource {vault:string;file:string}
export interface MediaPlayerSource extends MediaNoteSource {time:number}
export interface MediaMoment {id:string;time:number;text:string;image?:string;line:number}
export type MediaMomentInput=Omit<MediaMoment,'line'>;
const marker='thoughtspace-media-',maxDocument=500000;
const control=(value:string)=>hasAsciiControl(value)||value.includes('\u007f');
const validSource=(source:MediaNoteSource)=>typeof source.vault==='string'&&!!source.vault.trim()&&source.vault.length<=1000&&!control(source.vault)&&isVaultMediaPath(source.file);
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-z\d][a-z\d_-]{0,127}$/i.test(id);
const escapeLabel=(value:string)=>value.replace(/[\r\n]+/g,' ').replace(/[\\[\]*_`<>]/g,'\\$&');

/** Standalone playback does not depend on a board or on a surviving board node. */
export function mediaPlayerUrl(source:MediaNoteSource,time=0):string {
 if(!validSource(source))throw Error('媒体来源无效');mediaTime(time);
 return 'obsidian://thoughtspace-player?'+new URLSearchParams({vault:source.vault,file:source.file,t:String(time)}).toString();
}
function urlParams(input:string|URLSearchParams|Readonly<Record<string,unknown>>,scheme:string,host:string):URLSearchParams|undefined {
 if(typeof input==='string'){
  if(control(input)||input.includes(' ')||input.includes('#')||/%(?![0-9a-f]{2})/i.test(input)||!new RegExp('^'+scheme+'://'+host+'(?:[/?]|$)','i').test(input))return;
  try {const url=new URL(input);if(url.protocol!==scheme+':'||url.hostname!==host||!['','/'].includes(url.pathname)||url.username||url.password||url.port||url.hash)return;
   decodeURIComponent(url.search);return url.searchParams;
  }catch{return;}
 }
 if(input instanceof URLSearchParams)return input;
 if(!input||typeof input!=='object'||Array.isArray(input))return;
 const params=new URLSearchParams();for(const [key,value] of Object.entries(input)){if(typeof value!=='string')return;params.append(key,value);}return params;
}
function paramsOnly(params:URLSearchParams,required:string[],optional:string[]=[]):boolean {
 return [...params.keys()].every(key=>required.includes(key)||optional.includes(key))&&required.every(key=>params.getAll(key).length===1)&&optional.every(key=>params.getAll(key).length<=1);
}
function parameterTime(value:string|null):number|undefined {
 if(value===null||!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value))return;
 const time=Number(value);return validMediaTime(time)?time:undefined;
}
/** Also accepts Obsidian's already-decoded protocol callback values; never decode twice. */
export function parseMediaPlayerUrl(input:string|URLSearchParams|Readonly<Record<string,unknown>>):MediaPlayerSource|undefined {
 const params=urlParams(input,'obsidian','thoughtspace-player');if(!params||!paramsOnly(params,['vault','file','t'],['action'])||params.has('action')&&params.get('action')!=='thoughtspace-player')return;
 const time=parameterTime(params.get('t')),source={vault:params.get('vault')!,file:params.get('file')!};
 return time!==undefined&&validSource(source)?{...source,time}:undefined;
}

/** Parse only the small top-level scalar subset used by these source properties. */
function scalar(value:string):string|undefined {
 value=value.trim();if(!value)return;
 if(value.startsWith('"')){const match=/^"(?:[^"\\]|\\.)*"/.exec(value);if(!match||!/^\s*(?:#.*)?$/.test(value.slice(match[0].length)))return;try {const result:unknown=JSON.parse(match[0]);return typeof result==='string'?result:undefined;}catch{return;}}
 if(value.startsWith("'")){const match=/^'((?:[^']|'')*)'/.exec(value);return match&&/^\s*(?:#.*)?$/.test(value.slice(match[0].length))?match[1].replace(/''/g,"'"):undefined;}
 if(/^[|>&*!{[\]}]/.test(value))return;
 const plain=value.replace(/\s+#.*$/,'').trimEnd();
 return /^(?:null|~|true|false|[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)$/i.test(plain)?undefined:plain;
}
function noteProperties(raw:string):Map<string,string|undefined> {
 const props=new Map<string,string|undefined>(),lines=raw.replace(/\r\n?/g,'\n').split('\n');if(lines[0]!=='---')return props;
 const end=lines.findIndex((line,index)=>index>0&&/^(---|\.\.\.)\s*$/.test(line));if(end<0)return props;
 let tags=false;
 for(let i=1;i<end;i++){
  const match=/^([\w-]+):(?:[ \t]*(.*))?$/.exec(lines[i]);
  if(match){const key=match[1],value=match[2]||'';if(props.has(key)){props.set(key,undefined);tags=false;continue;}props.set(key,value);tags=key==='tags'&&!value.trim();}
  else if(tags){const item=/^\s+-\s+(.+)$/.exec(lines[i]);if(item){const value=scalar(item[1]);if(value==='影笺'||value==='#影笺')props.set('tags',`${props.get('tags')||''} 影笺`);}else if(lines[i].trim()&&!/^\s*#/.test(lines[i]))tags=false;}
 }
 return props;
}
function legacyMediaPath(value:unknown):value is string {
 if(typeof value!=='string'||value.length>8192||value.trim()!==value||control(value)||!mediaKind(value))return false;
 const path=value.replace(/\\/g,'/');if(!path.startsWith('/')&&!/^[a-z]:\//i.test(path)||path.startsWith('//'))return false;
 const parts=path.replace(/^(?:[a-z]:)?\//i,'').split('/');return parts.every(part=>part!==''&&part!=='.'&&part!=='..');
}
/** Returns the original metadata value. The caller maps legacy absolute paths to its vault. */
export function mediaNoteSource(raw:string):string|undefined {
 if(raw.length>maxDocument)return;
 const props=noteProperties(raw);
 if(props.has('thoughtspace_media')){const source=scalar(props.get('thoughtspace_media')||'');return isVaultMediaPath(source)?source:undefined;}
 const source=scalar(props.get('source')||'');if(!legacyMediaPath(source))return;
 const identified=['video-note-id','yingjian-capture-id'].some(key=>!!scalar(props.get(key)||'')?.trim());
 const tags=(props.get('tags')||'').replace(/[[\],"']/g,' ').split(/\s+/).some(tag=>tag.replace(/^#/,'')==='影笺');
 return identified||tags?source:undefined;
}
export function mediaNoteDocument(file:string):string {
 if(!isVaultMediaPath(file))throw Error('媒体来源无效');
 return `---\nthoughtspace_media: ${JSON.stringify(file)}\n---\n\n# ${escapeLabel(file.split('/').at(-1)!)}\n\n`;
}
function checkDocument(raw:string,source:MediaNoteSource):boolean {
 if(!validSource(source))throw Error('媒体来源无效');
 if(raw.length>maxDocument)throw Error('媒体笔记超过 500,000 字符');
 if(/^---\r?\n/.test(raw)&&!raw.split(/\r?\n/).some((line,index)=>index>0&&/^(---|\.\.\.)\s*$/.test(line)))throw Error('请先闭合笔记开头的属性区域');
 const props=noteProperties(raw);return !props.has('thoughtspace_media')||scalar(props.get('thoughtspace_media')||'')===source.file;
}
function imageMarkup(value:string):boolean {
 if(!value||value.length>16384||control(value))return false;
 let path:string|undefined;
 const wiki=/^!\[\[([^\]\r\n]+)\]\]$/.exec(value);
 if(wiki)path=wiki[1].split('|')[0];
 else {
  const ranges=markdownLinkRanges(value);if(ranges.length!==1||ranges[0].from!==1||ranges[0].to!==value.length||value[0]!=='!')return false;
  const target=/\]\((.*)\)$/.exec(value)?.[1];if(target===undefined)return false;
  const dest=target.startsWith('<')&&target.endsWith('>')?target.slice(1,-1):target;
  try {path=decodeURIComponent(dest.replace(/\\([\\()[\] ])/g,'$1'));}catch{return false;}
 }
 return !!path&&path.trim()===path&&!control(path)&&!path.includes('\\')&&!/^([a-z][a-z\d+.-]*:|\/)/i.test(path)&&path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..')&&/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(path);
}
/** Append only. A visible block ID reserves the entry even after its body has been edited. */
export function appendMediaMoment(raw:string,moment:MediaMomentInput,source:MediaNoteSource):string {
 if(!checkDocument(raw,source))throw Error('笔记属于另一媒体来源');
 if(!validId(moment.id)||typeof moment.text!=='string'||moment.text.length>100000||moment.text.includes('\0')||moment.image!==undefined&&!imageMarkup(moment.image))throw Error('媒体时间点内容无效');
 mediaTime(moment.time);
 const rows=[...markdownRows(raw)],anchor='^'+marker+moment.id,existing=new RegExp('(?:^|\\s)\\^'+marker+moment.id+'\\s*$');
 if(rows.some(row=>!row.code&&existing.test(maskInlineCode(row.visible))))return raw;
 if(rows.at(-1)?.openBlock)throw Error('请先闭合笔记末尾的代码围栏或注释');
 const newline=raw.includes('\r\n')?'\r\n':'\n',body=moment.text.replace(/\r\n?/g,'\n').split('\n');
 const content=[`> [!note] [${mediaClock(moment.time)}](${mediaPlayerUrl(source,moment.time)})`,...body.map(line=>'> '+line),...(moment.image?['>', '> '+moment.image]:[]),'',anchor,''].join(newline);
 if(![...markdownRows(content)].some(row=>!row.code&&row.topLevel&&row.visible.trim()===anchor))throw Error('请先闭合时间点正文中的注释');
 const separator=!raw?'':raw.endsWith(newline+newline)?'':raw.endsWith(newline)?newline:newline+newline;
 if(raw.length+separator.length+content.length>maxDocument)throw Error('媒体笔记超过 500,000 字符');
 return raw+separator+content;
}

type MomentLink={time:number;from:number;to:number};
function timestampLink(visible:string,parse:(url:string)=>number|undefined):MomentLink|undefined {
 const safe=maskInlineCode(visible);
 for(const range of markdownLinkRanges(safe)){
  if(safe[range.from-1]==='!')continue;
  const link=/^\[.*\]\(([^\s]+)\)$/.exec(safe.slice(range.from,range.to));if(!link)continue;
  const time=parse(link[1]);if(time!==undefined)return {time,...range};
 }
}
function momentHeader(visible:string):boolean {
 return /^ {0,3}>[ \t]?\[![^\]]+\]/.test(visible)&&!!timestampLink(visible,url=>/^(obsidian:\/\/thoughtspace-player|yingjian:\/\/open)\?/.test(url)?0:undefined);
}
/** Keep editable body Markdown intact; strip only the record's envelope and optional image. */
function readMoments(raw:string,parse:(url:string)=>number|undefined,prefix:string):MediaMoment[] {
 const lines=raw.replace(/\r\n?/g,'\n').split('\n'),rows=[...markdownRows(lines.join('\n'))],moments:MediaMoment[]=[],seen=new Set<string>();
 for(let index=0;index<rows.length;index++){
  const row=rows[index];if(row.code)continue;const link=timestampLink(row.visible,parse);if(!link)continue;
  const quoted=/^ {0,3}>[ \t]?/.test(lines[index]),callout=/^ {0,3}>[ \t]?\[![^\]]+\][+-]?(?:\s|$)/.test(lines[index]);
  let end=index+1;
  if(quoted)while(end<lines.length&&/^ {0,3}>/.test(lines[end])){
   if(!rows[end].code&&(callout?momentHeader(rows[end].visible):timestampLink(rows[end].visible,parse)))break;end++;
  }
  let block=end;while(block<lines.length&&!lines[block].trim())block++;
  const blockMatch=rows[block]&&!rows[block].code&&rows[block].topLevel?new RegExp('^\\^'+prefix+'([a-z\\d][a-z\\d_-]{0,127})\\s*$','i').exec(rows[block].visible):null;
  const inlineMatch=new RegExp('(?:^|\\s)\\^'+prefix+'([a-z\\d][a-z\\d_-]{0,127})\\s*$','i').exec(maskInlineCode(row.visible));
  const id=blockMatch?.[1]||inlineMatch?.[1]||`line:${index+1}`;
  let first=lines[index].slice(0,link.from)+lines[index].slice(link.to);
  first=first.replace(/^ {0,3}>[ \t]?/,'').replace(/^\[![^\]]+\][+-]?\s*/,'').replace(/^\s*[-*+]\s+/,'');
  if(inlineMatch)first=first.replace(new RegExp('(?:^|\\s)\\^'+prefix+inlineMatch[1]+'\\s*$','i'),'');
  first=first.trim().replace(/^[·]\s*|\s*[·]$/g,'').trim();
  const body=lines.slice(index+1,end).map(line=>quoted?line.replace(/^ {0,3}>[ \t]?/,''):line);if(first)body.unshift(first);
  let image:string|undefined;
  const bodyRows=[...markdownRows(body.join('\n'))];
  for(let i=body.length-1;i>=0;i--)if(!bodyRows[i].code&&bodyRows[i].visible===body[i]&&imageMarkup(body[i].trim())){image=body[i].trim();body.splice(i,1);break;}
  const text=body.join('\n').replace(/^\n+|\n+$/g,'');
  if(!seen.has(id)){moments.push({id,time:link.time,text,...(image?{image}:{}),line:index+1});seen.add(id);}
  index=(blockMatch?block+1:end)-1;
 }
 return moments;
}
export function readMediaMoments(raw:string,source:MediaNoteSource):MediaMoment[] {
 if(!checkDocument(raw,source))return [];
 return readMoments(raw,url=>{const data=parseMediaPlayerUrl(url);return data&&data.vault===source.vault&&data.file===source.file?data.time:undefined;},marker);
}
/** The caller must first map this unchanged absolute source into the requested vault file. */
export function readLegacyMediaMoments(raw:string,source:MediaNoteSource,legacySource:string,legacyVaultId?:string):MediaMoment[] {
 if(!checkDocument(raw,source)||!legacyMediaPath(legacySource)||mediaNoteSource(raw)!==legacySource||legacyVaultId!==undefined&&!/^[a-f\d]{20}$/.test(legacyVaultId))return [];
 return readMoments(raw,url=>{
  const params=urlParams(url,'yingjian','open');if(!params||!paramsOnly(params,['video','t'],['note','vault'])||params.get('video')!==legacySource||params.has('vault')&&params.get('vault')!==source.vault&&params.get('vault')!==legacyVaultId)return;
  return parameterTime(params.get('t'));
 },'video-t-');
}
