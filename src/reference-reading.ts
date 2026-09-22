import {noteFragments} from './note-fragments';
interface Position {start:{offset:number};end:{offset:number};}
interface Cache {headings?:{heading:string;level:number;position:Position}[];blocks?:Record<string,{id:string;position:Position}>;}
/** Read the complete section including child headings, but not its next sibling. */
export function referenceReading(text:string,cache:Cache|null|undefined,subpath:string){
 let start=0,end=text.length,label='整篇笔记';
 if(subpath){const item=noteFragments(text,cache).find(p=>p.subpath===subpath);if(!item)throw Error('引用位置已变化，请刷新后重新选择');label=item.title;
  if(item.kind==='block'){const b=cache!.blocks![subpath.slice(2)];start=b.position.start.offset;end=b.position.end.offset;}
  else{const headings=cache!.headings!,index=headings.findIndex(h=>'#'+h.heading===subpath),h=headings[index];start=h.position.start.offset;end=headings.slice(index+1).find(n=>n.level<=h.level)?.position.start.offset??text.length;}
 }else{const front=/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(text);if(front)start=front[0].length;}
 if(start<0||end<start||end>text.length)throw Error('引用范围已变化，请刷新后重新选择');
 const limit=40000;return {markdown:text.slice(start,Math.min(end,start+limit)),label,line:text.slice(0,start).split('\n').length,truncated:end-start>limit};
}
