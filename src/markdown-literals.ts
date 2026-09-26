/** Code-span ranges use UTF-16 offsets so callers can edit the original source exactly. */
export function inlineCodeRanges(text:string):{from:number;to:number}[]{
 const runs:{from:number;to:number;escaped:boolean;next:number}[]=[],last=new Map<number,number>();
 for(let i=text.indexOf('`');i>=0;i=text.indexOf('`',i)){const from=i;while(text[i]==='`')i++;let slash=from;while(slash>0&&text[slash-1]==='\\')slash--;runs.push({from,to:i,escaped:(from-slash)%2===1,next:-1});}
 for(let i=runs.length-1;i>=0;i--){const n=runs[i].to-runs[i].from;runs[i].next=last.get(n)??-1;last.set(n,i);}
 const ranges:{from:number;to:number}[]=[];
 for(let i=0;i<runs.length;i++){const run=runs[i];if(run.escaped||run.next<0)continue;ranges.push({from:run.from,to:runs[run.next].to});i=run.next;}
 return ranges;
}
export function outsideInlineCode(text:string,transform:(prose:string)=>string){let at=0,result='';for(const range of inlineCodeRanges(text)){result+=transform(text.slice(at,range.from))+text.slice(range.from,range.to);at=range.to;}return result+transform(text.slice(at));}
/** Non-whitespace placeholders prevent metadata regexes from spanning a protected code fragment. */
export function maskInlineCode(text:string){let at=0,result='';for(const range of inlineCodeRanges(text)){result+=text.slice(at,range.from)+'\ufffc'.repeat(range.to-range.from);at=range.to;}return result+text.slice(at);}

/** A forward-only query: each delimiter search advances independently through the source. */
export function commentTokenQuery(text:string){
 let html:number|undefined,percent:number|undefined;
 return(from:number)=>{
  if(html===undefined||html>=0&&html<from)html=text.indexOf('<!--',from);
  if(percent===undefined||percent>=0&&percent<from)percent=text.indexOf('%%',from);
  return html<0?percent:percent<0?html:Math.min(html,percent);
 };
}

/** Preserve inline code and hidden comments while reading or changing task metadata.
 * Offsets are UTF-16; unclosed comments protect the remainder of the task line.
 */
export function inlineLiteralRanges(text:string):{from:number;to:number;comment:boolean}[]{
 const code=inlineCodeRanges(text),ranges:{from:number;to:number;comment:boolean}[]=[];let next=0;
 // Most task lines contain no comments; their code ranges are already complete.
 if(!text.includes('<!--')&&!text.includes('%%'))return code.map(range=>({...range,comment:false}));
 const nextComment=commentTokenQuery(text);
 for(let i=0;i<text.length;){
  // A span whose opener was consumed by a comment is no longer code context.
  while(next<code.length&&code[next].from<i)next++;
  const at=nextComment(i);
  if(next<code.length&&(at<0||code[next].from<=at)){ranges.push({...code[next],comment:false});i=code[next++].to;continue;}
  if(at<0)break;i=at;
  const token=text.startsWith('<!--',i)?'<!--':'%%';
  let slash=i;while(slash>0&&text[slash-1]==='\\')slash--;if((i-slash)%2===0){const endToken=token==='<!--'?'-->':'%%',end=text.indexOf(endToken,i+token.length),to=end<0?text.length:end+endToken.length;ranges.push({from:i,to,comment:true});i=to;continue;}
  i++;
 }return ranges;
}
export function outsideInlineLiterals(text:string,transform:(prose:string)=>string){let at=0,result='';for(const r of inlineLiteralRanges(text)){result+=transform(text.slice(at,r.from))+text.slice(r.from,r.to);at=r.to;}return result+transform(text.slice(at));}
export function maskInlineLiterals(text:string){let at=0,result='';for(const r of inlineLiteralRanges(text)){result+=text.slice(at,r.from)+'\ufffc'.repeat(r.to-r.from);at=r.to;}return result+text.slice(at);}
export function stripInlineComments(text:string){if(!text.includes('<!--')&&!text.includes('%%'))return text;let at=0,result='';for(const r of inlineLiteralRanges(text).filter(r=>r.comment)){result+=text.slice(at,r.from)+' ';at=r.to;}return result+text.slice(at);}
