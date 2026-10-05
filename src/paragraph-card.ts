import {createHash} from 'crypto';
import {excerptPresentation,type ExcerptSource} from './excerpt-sources';
import {selectionFragment} from './materials';
import {writingReferenceRanges,type WritingRange} from './writing-reference';
import {hasAsciiControl,isRecord} from './value-guards';
export type ParagraphOrigin={path:string;subpath:string;mode:'embed'}|{path:string;from:number;to:number;quote:string;hash:string;subpath?:string;mode:'snapshot'}
export const paragraphHash=(raw:string)=>createHash('sha256').update(raw).digest('hex');
export function validParagraphOrigin(value:unknown):value is ParagraphOrigin{
 if(!isRecord(value))return false;
 if(typeof value.path!=='string'||value.path.length>2048||!/\.md$/i.test(value.path)||hasAsciiControl(value.path)||value.path.includes('\\')||/^[/\\]|^[a-z][\w+.-]*:/i.test(value.path)||value.path.split('/').some(p=>p==='..'||p==='.')||!(value.subpath===undefined||typeof value.subpath==='string'&&value.subpath.startsWith('#')&&value.subpath.length<=2048&&!hasAsciiControl(value.subpath)))return false;
 if(value.mode==='embed')return typeof value.subpath==='string'&&value.subpath.length>1;
 return value.mode==='snapshot'&&typeof value.quote==='string'&&!!value.quote.trim()&&value.quote.length<=100000&&typeof value.hash==='string'&&/^[a-f0-9]{64}$/.test(value.hash)&&Number.isSafeInteger(value.from)&&Number.isSafeInteger(value.to)&&(value.from as number)>=0&&(value.to as number)-(value.from as number)===value.quote.length;
}
export function paragraphRange(raw:string,from:number,to:number,ranges:WritingRange[]):WritingRange{
 if(from!==to){selectionFragment(raw,from,to);return ranges.find(r=>r.from===from&&r.to===to&&r.subpath)||{label:'选中文字',from,to};}
 const anchored=ranges.find(r=>r.subpath?.startsWith('#^')&&r.from<=from&&r.to>=from)||ranges.find(r=>r.subpath&&r.from<=from&&from<=(raw.indexOf('\n',r.from)<0?raw.length:raw.indexOf('\n',r.from)));if(anchored)return anchored;
 const paragraph=ranges.find(r=>!r.subpath&&r.from<=from&&r.to>=from);if(!paragraph)throw Error('请在正文段落内放置光标或选择文字');return paragraph;
}
export function paragraphOrigin(path:string,raw:string,range:WritingRange,mode:'snapshot'):Extract<ParagraphOrigin,{mode:'snapshot'}>;
export function paragraphOrigin(path:string,raw:string,range:WritingRange,mode:'embed'):Extract<ParagraphOrigin,{mode:'embed'}>;
export function paragraphOrigin(path:string,raw:string,range:WritingRange,mode:ParagraphOrigin['mode']):ParagraphOrigin;
export function paragraphOrigin(path:string,raw:string,range:WritingRange,mode:ParagraphOrigin['mode']):ParagraphOrigin{
 selectionFragment(raw,range.from,range.to);if(mode==='embed'){const native={path,subpath:range.subpath,mode};if(!validParagraphOrigin(native))throw Error('动态引用需要已有且唯一的标题或块');return native;}const origin={path,from:range.from,to:range.to,quote:raw.slice(range.from,range.to),hash:paragraphHash(raw),...(range.subpath?{subpath:range.subpath}:{}),mode};
 if(!validParagraphOrigin(origin))throw Error('动态引用需要已有且唯一的标题或块，普通选段请使用静态摘录');return origin;
}
export function locateParagraph(origin:ParagraphOrigin,raw:string,cache:Parameters<typeof writingReferenceRanges>[1]){
 if(origin.mode==='embed'){
  const range=writingReferenceRanges(raw,cache).find(r=>r.subpath===origin.subpath);
  return range?{from:range.from,to:range.to,status:'已核验现有标题或块 · 动态引用'}:{status:'标题或块已变化，无法确认位置'};
 }
 if(paragraphHash(raw)===origin.hash&&raw.slice(origin.from,origin.to)===origin.quote)return{from:origin.from,to:origin.to,status:'已核验原始选区 · 静态摘录'};
 const from=raw.indexOf(origin.quote);
 if(from>=0&&raw.indexOf(origin.quote,from+1)<0)return{from,to:from+origin.quote.length,status:'来源已变化，按唯一原文重新定位 · 静态摘录'};
 return{status:from<0?'原文已变化，无法确认位置':'存在重复原文，无法唯一确认位置'};
}
export function sameParagraph(a:ParagraphOrigin|undefined,b:ParagraphOrigin){
 if(!a||a.path!==b.path||a.mode!==b.mode||a.subpath!==b.subpath)return false;
 if(a.mode==='embed'||b.mode==='embed')return true;
 return a.from===b.from&&a.to===b.to&&a.quote===b.quote&&a.hash===b.hash;
}

/** Provenance stays outside selected Markdown, including an unfinished code fence. */
export function paragraphPresentation(text:string,origin:ParagraphOrigin,link:string){
 const at=text.lastIndexOf('\n\n> 来源：'),tail=at>=0?text.slice(at+2):'',parsed=tail&&!tail.includes('\n')?excerptPresentation(tail).sources[0]:undefined;
 const location=parsed?.location||(origin.mode==='embed'?'动态引用 · 回源时核验':'静态摘录 · 回源时核验');
 const source:ExcerptSource={link,location,citation:`来源：${link} · ${location}`};
 return {body:parsed?text.slice(0,at):text,sources:[source]};
}

/** Native links use full vault paths so a new same-named file cannot retarget an embed. */
export function paragraphLink(path:string,subpath='',label?:string){
 if(!/[#[\]|]/.test(path)&&!/[[\]|]/.test(subpath)&&(!label||!/[[\]|\n\r]/.test(label)))return `[[${path}${subpath}${label?'|'+label:''}]]`;
 const target=encodeURI(path).replace(/[()#^[\]|]/g,c=>'%'+c.charCodeAt(0).toString(16))+(subpath?'#'+encodeURIComponent(subpath.slice(1)):'');
 return `[${(label||path.split('/').pop()!).replace(/[\\[\]]/g,'\\$&')}](<${target}>)`;
}
