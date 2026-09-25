import {inlineCodeRanges} from './markdown-literals';
export const markdownColumns=(s:string,initial=0)=>{let col=initial;for(const c of s)col=c==='\t'?col+4-col%4:col+1;return col;};
/** Read-only source context. Offsets remain UTF-16 offsets into the unmodified line. */
export function* markdownRows(text:string){
 const sources=text.split('\n'),frontEnd=/^---\r?\n/.test(text)?sources.findIndex((s,i)=>i>0&&/^(---|\.\.\.)\s*$/.test(s)):-1;
 let fence='',quoteDepth=0,comment='',lists:number[]=[];
 for(let line=0;line<sources.length;line++){
  const source=sources[line],raw=source.replace(/\r$/,'');
  if(frontEnd>=0&&line<=frontEnd){yield {source,line,visible:'',code:true,topLevel:false,commentBefore:false};continue;}
  const prefix=/^(?: {0,3}>[ \t]?)+/.exec(raw)?.[0]||'',depth=(prefix.match(/>/g)||[]).length;
  if(depth!==quoteDepth&&!(fence&&quoteDepth===0)) {fence='';lists=[];quoteDepth=depth;}
  const content=raw.slice(prefix.length),indentText=/^[ \t]*/.exec(content)![0],indent=markdownColumns(indentText),body=content.slice(indentText.length);
  const commentBefore=!!comment;
  if(fence){const close=/^(`{3,}|~{3,})[ \t]*$/.exec(body);if(close&&indent-(lists.at(-1)||0)<4&&depth===quoteDepth&&close[1][0]===fence[0]&&close[1].length>=fence.length)fence='';yield {source,line,visible:'',code:true,topLevel:false,commentBefore,openBlock:!!fence};continue;}
  if(body.trim())while(lists.length&&indent<lists[lists.length-1])lists.pop();
  const indented=indent-(lists.at(-1)||0)>=4;
  const marker=/^(`{3,}|~{3,})(.*)$/.exec(body);
  if(!comment&&(indented||marker&&!(marker[1][0]==='`'&&marker[2].includes('`')))){
   if(!indented)fence=marker![1];yield {source,line,visible:'',code:true,topLevel:false,commentBefore,fenceOpening:!indented,openBlock:!!fence};continue;
  }
  const topLevel=!prefix&&!lists.length&&indent<4;
  // Ordinary lines need no masking. Active comments and possible delimiters
  // still use code-span protection and preserve original UTF-16 offsets.
  let visible=raw;
  if(comment||raw.includes('<!--')||raw.includes('%%')){
   const ranges=inlineCodeRanges(raw),chars=raw.split('');let range=0;
   for(let i=0;i<raw.length;){
    if(comment){const end=raw.indexOf(comment,i),to=end<0?raw.length:end+comment.length;for(let j=i;j<to;j++)chars[j]=' ';i=to;if(end>=0)comment='';continue;}
    while(range<ranges.length&&ranges[range].to<=i)range++;
    if(range<ranges.length&&ranges[range].from===i){i=ranges[range].to;continue;}
    if(raw.startsWith('<!--',i)||raw.startsWith('%%',i)){
     const token=raw.startsWith('<!--',i)?'<!--':'%%';let slash=i;while(slash>0&&raw[slash-1]==='\\')slash--;
     if((i-slash)%2){i++;continue;}
     comment=token==='<!--'?'-->':'%%';for(let j=i;j<i+token.length;j++)chars[j]=' ';i+=token.length;continue;
    }i++;
   }
   visible=chars.join('');
  }
  const item=/^([-*+]|\d+[.)])([ \t]+)(.*)$/.exec(visible.slice(prefix.length+indentText.length));
  if(item){const pad=markdownColumns(item[2],indent+item[1].length)-indent-item[1].length;lists.push(indent+item[1].length+(pad>4?1:pad));}
  yield {source,line,visible,code:false,topLevel,commentBefore,openBlock:!!comment};
 }
}
