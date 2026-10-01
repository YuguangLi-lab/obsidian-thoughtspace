import {extractFragments,selectionFragment} from './materials';
import {noteFragments} from './note-fragments';
import {referenceReading} from './reference-reading';
export interface WritingRange {label:string;from:number;to:number;subpath?:string}
export type WritingReferenceMode='quote'|'embed'|'link';
export function writingReferenceRanges(raw:string,cache:Parameters<typeof noteFragments>[1]):WritingRange[]{
 const ranges:WritingRange[]=[];const lines=[0];for(let i=raw.indexOf('\n');i>=0;i=raw.indexOf('\n',i+1))lines.push(i+1);
 for(const part of noteFragments(raw,cache)){
  const content=referenceReading(raw,cache as Parameters<typeof referenceReading>[1],part.subpath);
  if(content.truncated)continue;
  const from=part.kind==='block'?cache!.blocks![part.subpath.slice(2)].position.start.offset:cache!.headings!.find(h=>'#'+h.heading===part.subpath)!.position.start.offset;ranges.push({label:(part.kind==='block'?'块 ':'标题 ')+part.title,from,to:from+content.markdown.length,subpath:part.subpath});
 }
 for(const f of extractFragments(raw).fragments){const from=lines[f.start-1],to=(lines[f.end]??raw.length+1)-1;ranges.push({label:'段落 '+f.title,from,to});}
 return ranges;
}
export function writingReferenceMarkdown(mode:WritingReferenceMode,raw:string,range:WritingRange,link:string,body:string){
 const fragment=selectionFragment(raw,range.from,range.to);
 if(mode==='embed'){if(!range.subpath)throw Error('嵌入需要已有且唯一的标题或块标识；不会自动修改原文');return '!'+link;}
 if(mode==='link')return link;
 return body.replace(/\r\n?/g,'\n').split('\n').map(line=>'> '+line).join('\n')+'\n\n来源：'+link+` · 第 ${fragment.start}–${fragment.end} 行（静态摘录）`;
}
