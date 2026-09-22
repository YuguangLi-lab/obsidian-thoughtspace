import {markdownRows} from './markdown-context';
import {maskInlineCode} from './markdown-literals';
import type {Fragment} from './materials';
export function videoSource(value:unknown):string|undefined{
 if(typeof value!=='string'||!value||value.length>8192||/[\r\n\0]/.test(value))return;
 if(value.startsWith('/')&&!value.startsWith('//')&&/\.(mp4|mov|m4v|webm|ogv|mkv|ogg|mp3|m4a|wav)$/i.test(value))return value;
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.bilibili.com','bilibili.com','pan.baidu.com'].includes(u.hostname))return value;}catch{}
}
export function yingjianLink(video:string,time:number,note?:string,vault?:string){
 if(!videoSource(video)||!Number.isFinite(time)||time<0||time>100000000)throw Error('视频来源或时间无效');
 const u=new URL('yingjian://open');u.searchParams.set('video',video);u.searchParams.set('t',String(time));if(note)u.searchParams.set('note',note);if(vault)u.searchParams.set('vault',vault);
 return u.toString().replace(/\+/g,'%20').replace(/\(/g,'%28').replace(/\)/g,'%29');
}
export function parseYingjianLink(link:string,source?:string){
 try{const u=new URL(link);if(u.protocol!=='yingjian:'||u.hostname!=='open'||u.username||u.password||u.port||!['','/'].includes(u.pathname))return;
 const video=videoSource(u.searchParams.get('video')),t=u.searchParams.get('t');if(!video||!t||!/^\d+(?:\.\d+)?$/.test(t)||source&&video!==source)return;const time=Number(t);if(time>100000000)return;return{video,time};}catch{}
}
export interface VideoMoment {id:string;time:number;label:string;link:string;fragment:Fragment;}
function videoRows(text:string){const lines=text.split('\n'),safe=[...lines];let fence='';
 // Mask top-level fenced examples before the context parser sees quoted example lines.
 // This keeps quote depth inside a code block from changing the surrounding Markdown state.
 const frontEnd=lines[0]==='---'?lines.findIndex((s,i)=>i>0&&/^(---|\.\.\.)\s*$/.test(s)):-1;
 for(const row of markdownRows(text)){if(row.line<=frontEnd)continue;const marker=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[row.line]);
  if(fence){safe[row.line]='';if(marker&&marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence='';continue;}
  if(marker&&!row.commentBefore&&!(marker[1][0]==='`'&&marker[2].includes('`'))){fence=marker[1];safe[row.line]='';}
 }
 return markdownRows(safe.join('\n'));
}
/** Read the player's existing Markdown format; never write to its notes or workspace. */
export function yingjianMoments(raw:string,source?:string){
 if(raw.length>500000)throw Error('视频笔记超过 500,000 字符，请先在原笔记中选择章节');
 const text=raw.replace(/\r\n?/g,'\n'),lines=text.split('\n'),moments:VideoMoment[]=[];let truncated=false;
 for(const row of videoRows(text)){const line=lines[row.line];if(row.code)continue;const visible=maskInlineCode(row.visible),match=/\[((?:\d{1,3}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?)\]\((yingjian:\/\/open\?[^)\s]+)\)/.exec(visible);if(!match)continue;
  const data=parseYingjianLink(match[2],source);if(!data||!videoSource(data.video)||data.time>100000000)continue;
  if(moments.length>=500){truncated=true;break;}let end=row.line+1;
  if(/^\s*>/.test(line)){while(end<lines.length&&/^\s*>/.test(lines[end])&&!/\]\(yingjian:/.test(lines[end]))end++;let block=end;while(block<lines.length&&!lines[block].trim())block++;if(/^\^video-t-[\w-]+\s*$/.test(lines[block]||''))end=block+1;}
  const body=lines.slice(row.line,end).join('\n'),id=`${row.line+1}:${end}`;
  moments.push({id,time:data.time,label:match[1],link:match[2],fragment:{id,kind:/^\s*>/.test(line)?'quote':'paragraph',title:`${match[1]} · 视频摘录`,heading:'时间轴笔记',body,start:row.line+1,end}});
 }return{moments,truncated};
}

export function yingjianNotePath(value:unknown):string|undefined {
 if(typeof value!=='string'||!value||value.length>4096||/[\\\r\n\0]/.test(value)||value.startsWith('/')||/^[a-z]:/i.test(value)||!value.endsWith('.md'))return;
 if(value.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.')))return;
 return value;
}

/** Display valid player timestamps as compact links, preserving literal code examples. */
export function yingjianTextParts(text:string):{text:string;link?:string}[]{
 if(!text.includes('](yingjian://open?'))return[{text}];
 const parts:{text:string;link?:string}[]=[];const lines=text.split('\n');let cursor=0,offset=0;
 for(const row of videoRows(text)){
  if(!row.code)for(const m of maskInlineCode(row.visible).matchAll(/\[((?:\d{1,3}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?)\]\((yingjian:\/\/open\?[^)\s]+)\)/g)){
   if(!parseYingjianLink(m[2]))continue;const start=offset+m.index!;if(start>cursor)parts.push({text:text.slice(cursor,start)});parts.push({text:m[1],link:m[2]});cursor=start+m[0].length;
  }offset+=lines[row.line].length+1;
 }
 if(cursor<text.length)parts.push({text:text.slice(cursor)});return parts;
}
