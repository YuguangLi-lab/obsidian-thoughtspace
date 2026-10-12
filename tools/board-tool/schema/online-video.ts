import {hasAsciiControl} from './value-guards';

export interface OnlineVideo {provider:'youtube'|'bilibili';label:string;id:string;url:string;embedUrl:string;start:number;page?:number}
const youtubeHosts=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com']);
const youtubeEmbedHosts=new Set(['youtube-nocookie.com','www.youtube-nocookie.com']);
const bilibiliHosts=new Set(['bilibili.com','www.bilibili.com','m.bilibili.com']);
const youtubeId=/^[A-Za-z0-9_-]{11}$/;
const bilibiliId=/^(?:BV[A-Za-z0-9]{10}|av[1-9][0-9]*)$/;
const maxStart=7*24*60*60;

/** null means absent; undefined means duplicated or conflicting aliases. */
function singleParameter(params:URLSearchParams,names:string[]):string|null|undefined {
 const values=names.flatMap(name=>params.getAll(name));return values.length===0?null:values.length===1?values[0]:undefined;
}
function startTime(url:URL,units:boolean):number|undefined {
 const query=singleParameter(url.searchParams,units?['t','start','time_continue']:['t']);
 const hash=singleParameter(new URLSearchParams(url.hash.slice(1)),['t']);
 if(query===undefined||hash===undefined||query!==null&&hash!==null)return;
 const raw=query??hash;if(raw===null)return 0;
 if(/^\d+(?:\.\d+)?$/.test(raw))return Math.min(maxStart,Math.floor(Number(raw)));
 const parts=units&&raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
 if(!parts||!raw)return;
 return Math.min(maxStart,Number(parts[1]||0)*3600+Number(parts[2]||0)*60+Number(parts[3]||0));
}
/** Parse only official, single-video URLs; no network lookup or short-link redirect. */
export function onlineVideo(input:unknown):OnlineVideo|undefined {
 if(typeof input!=='string'||input.length>8192||hasAsciiControl(input)||input.includes('\u007f'))return;
 const raw=input.trim();if(!raw||/[\s\\<>]/.test(raw)||/%(?![0-9a-f]{2})/i.test(raw))return;
 // Check the literal authority too: URL normalizes default ports and encoded hosts.
 const authority=raw.match(/^https?:\/\/([a-z0-9.-]+)(?=\/|[?#]|$)/i);if(!authority)return;
 let source:URL;try{source=new URL(raw);}catch{return;}
 if(source.username||source.password||source.port)return;
 const host=source.hostname,path=source.pathname;
 const literalPath=raw.slice(authority[0].length).split(/[?#]/,1)[0]||'/';if(path!==literalPath)return;
 const params=source.searchParams;
 if(youtubeHosts.has(host)||youtubeEmbedHosts.has(host)||host==='youtu.be'){
  let id:string|null|undefined;
  if(host==='youtu.be')id=path.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  else if(youtubeHosts.has(host)&&/^\/watch\/?$/.test(path))id=singleParameter(params,['v']);
  else id=path.match(youtubeEmbedHosts.has(host)?/^\/embed\/([A-Za-z0-9_-]{11})\/?$/:/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  if(!id||!youtubeId.test(id)||!/^\/watch\/?$/.test(path)&&params.has('v'))return;
  const start=startTime(source,true);if(start===undefined)return;
  const url=new URL('https://www.youtube.com/watch');url.searchParams.set('v',id);if(start)url.searchParams.set('t',`${start}s`);
  const embed=new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  embed.searchParams.set('autoplay','0');embed.searchParams.set('rel','0');embed.searchParams.set('playsinline','1');if(start)embed.searchParams.set('start',String(start));
  return {provider:'youtube',label:'YouTube',id,url:url.href,embedUrl:embed.href,start};
 }
 if(!bilibiliHosts.has(host)&&host!=='player.bilibili.com')return;
 let id:string|undefined;
 if(host==='player.bilibili.com'){
  if(path!=='/player.html'||params.has('episodeId')||params.has('seasonId'))return;
  const bvid=singleParameter(params,['bvid']),aid=singleParameter(params,['aid']);
  if(bvid===undefined||aid===undefined||bvid!==null&&aid!==null||bvid!==null&&!/^BV[A-Za-z0-9]{10}$/.test(bvid))return;
  id=bvid??(aid!==null?`av${aid}`:undefined);
 }else{
  if(params.has('bvid')||params.has('aid'))return;
  id=path.match(/^\/video\/(BV[A-Za-z0-9]{10}|av[1-9][0-9]*)\/?$/)?.[1];
 }
 if(!id||!bilibiliId.test(id))return;
 const rawPage=singleParameter(params,['p','page']);if(rawPage===undefined||rawPage!==null&&!/^\d+$/.test(rawPage))return;
 const page=rawPage===null?1:Number(rawPage);if(page<1||page>10000)return;
 const start=startTime(source,false);if(start===undefined)return;
 const url=new URL(`https://www.bilibili.com/video/${id}/`);if(page>1)url.searchParams.set('p',String(page));if(start)url.searchParams.set('t',String(start));
 const embed=new URL('https://player.bilibili.com/player.html');embed.searchParams.set(id.startsWith('BV')?'bvid':'aid',id.startsWith('BV')?id:id.slice(2));
 // The official player documents p (rather than the legacy page parameter).
 embed.searchParams.set('p',String(page));embed.searchParams.set('autoplay','0');embed.searchParams.set('danmaku','0');if(start)embed.searchParams.set('t',String(start));
 return {provider:'bilibili',label:'哔哩哔哩',id,url:url.href,embedUrl:embed.href,start,page};
}
