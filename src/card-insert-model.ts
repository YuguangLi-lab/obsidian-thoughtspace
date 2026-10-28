import {writingReferenceRanges,type WritingRange} from './writing-reference';
import {hasAsciiControl} from './value-guards';
export type CardInsertMode='link'|'embed'|'body'|'title-body';
export interface CardInsertRange extends WritingRange {title:string;whole?:boolean}
export function cardInsertRanges(raw:string,title:string,cache:Parameters<typeof writingReferenceRanges>[1]):CardInsertRange[]{
 if(raw.length>500000)throw Error('材料超过 500,000 字符，请先选段整理');
 const front=/^---\r?\n(?:[\s\S]*?\r?\n)??(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(raw);
 return [{label:'整篇',title,from:front?.[0].length||0,to:raw.length,whole:true},...writingReferenceRanges(raw,cache).filter(r=>r.subpath?.startsWith('#')&&!r.subpath.startsWith('#^')).slice(0,200).map(r=>({...r,title:r.label.replace(/^标题 /,'')}))];
}
export function cardInsertMarkdown(mode:CardInsertMode,range:CardInsertRange,body:string,link:string){
 if(!range.whole&&!range.subpath)throw Error('章节锚点无法确认，请重新选择');
 if(mode==='link')return link;if(mode==='embed')return '!'+link;
 const title=range.title.replace(/[\r\n]+/g,' ').replace(/^#+\s*/,'').trim();if(!title||hasAsciiControl(title))throw Error('材料标题无效');
 const first=/^ {0,3}#{1,6}[ \t]+([^\r\n]*?)[ \t]*#*[ \t]*(?:\r?\n|$)/.exec(body);
 if(first&&(!range.whole||first[1].trim()===title))body=body.slice(first[0].length);
 return (mode==='title-body'?'## '+title+'\n\n':'')+body.trim();
}
/** This operation never searches for another insertion point after an edit. */
export function cardInsertChange(before:string,position:number,markdown:string){
 if(!Number.isSafeInteger(position)||position<0||position>before.length||before.length+markdown.length>1000000)throw Error('插入位置或正文长度无效');
 const prefix=position&&before[position-1]!=='\n'?'\n\n':'',suffix=position<before.length&&before[position]!=='\n'?'\n\n':'';
 return {from:position,to:position,insert:prefix+markdown+suffix};
}
