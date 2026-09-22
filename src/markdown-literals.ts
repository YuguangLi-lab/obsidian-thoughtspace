/** Code-span ranges use UTF-16 offsets so callers can edit the original source exactly. */
export function inlineCodeRanges(text:string):{from:number;to:number}[]{
 const runs:{from:number;to:number;escaped:boolean;next:number}[]=[],last=new Map<number,number>();
 for(let i=0;i<text.length;){if(text[i]!=='`'){i++;continue;}const from=i;while(text[i]==='`')i++;let slash=from;while(slash>0&&text[slash-1]==='\\')slash--;runs.push({from,to:i,escaped:(from-slash)%2===1,next:-1});}
 for(let i=runs.length-1;i>=0;i--){const n=runs[i].to-runs[i].from;runs[i].next=last.get(n)??-1;last.set(n,i);}
 const ranges:{from:number;to:number}[]=[];
 for(let i=0;i<runs.length;i++){const run=runs[i];if(run.escaped||run.next<0)continue;ranges.push({from:run.from,to:runs[run.next].to});i=run.next;}
 return ranges;
}
export function outsideInlineCode(text:string,transform:(prose:string)=>string){let at=0,result='';for(const range of inlineCodeRanges(text)){result+=transform(text.slice(at,range.from))+text.slice(range.from,range.to);at=range.to;}return result+transform(text.slice(at));}
/** Non-whitespace placeholders prevent metadata regexes from spanning a protected code fragment. */
export function maskInlineCode(text:string){let at=0,result='';for(const range of inlineCodeRanges(text)){result+=text.slice(at,range.from)+'\ufffc'.repeat(range.to-range.from);at=range.to;}return result+text.slice(at);}

/** Preserve inline code and hidden comments while reading or changing task metadata.
 * Offsets are UTF-16; unclosed comments protect the remainder of the task line.
 */
export function inlineLiteralRanges(text:string):{from:number;to:number;comment:boolean}[]{
 const code=inlineCodeRanges(text),ranges:{from:number;to:number;comment:boolean}[]=[];let next=0;
 for(let i=0;i<text.length;){
  while(next<code.length&&code[next].to<=i)next++;
  if(next<code.length&&code[next].from===i){ranges.push({...code[next],comment:false});i=code[next++].to;continue;}
  const token=text.startsWith('<!--',i)?'<!--':text.startsWith('%%',i)?'%%':undefined;
  if(token){let slash=i;while(slash>0&&text[slash-1]==='\\')slash--;if((i-slash)%2===0){const endToken=token==='<!--'?'-->':'%%',end=text.indexOf(endToken,i+token.length),to=end<0?text.length:end+endToken.length;ranges.push({from:i,to,comment:true});i=to;continue;}}
  i++;
 }return ranges;
}
export function outsideInlineLiterals(text:string,transform:(prose:string)=>string){let at=0,result='';for(const r of inlineLiteralRanges(text)){result+=transform(text.slice(at,r.from))+text.slice(r.from,r.to);at=r.to;}return result+transform(text.slice(at));}
export function maskInlineLiterals(text:string){let at=0,result='';for(const r of inlineLiteralRanges(text)){result+=text.slice(at,r.from)+'\ufffc'.repeat(r.to-r.from);at=r.to;}return result+text.slice(at);}
export function stripInlineComments(text:string){let at=0,result='';for(const r of inlineLiteralRanges(text).filter(r=>r.comment)){result+=text.slice(at,r.from)+' ';at=r.to;}return result+text.slice(at);}
