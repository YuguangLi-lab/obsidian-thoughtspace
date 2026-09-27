/** Protected link envelopes, with balanced labels/targets and Markdown escapes.
 * Pair delimiters once so unmatched brackets cannot trigger quadratic rescans. */
export function markdownLinkRanges(text:string):{from:number;to:number}[]{
 const pairs=new Map<number,number>(),squares:number[]=[],rounds:number[]=[],targets:number[]=[],labelEnds=new Set<number>();
 // Pre-index possible title/destination closers once. An unfinished title must
 // not hide a later valid link, and failed candidates must not rescan the tail.
 const containers=new Map<number,number>(),quotes=new Map<string,number>();let angleStart=-1;
 for(let i=0;i<text.length;i++){
  const char=text[i];if(char==='\\'){i++;continue;}
  if(char==='\n'){angleStart=-1;let next=i+1;while(text[next]===' '||text[next]==='\t'||text[next]==='\r')next++;if(text[next]==='\n')quotes.clear();continue;}
  if(char==='"'||char==="'"){const previous=quotes.get(char);if(previous!==undefined)containers.set(previous,i);quotes.set(char,i);}
  else if(char==='<')angleStart=i;else if(char==='>'&&angleStart>=0){containers.set(angleStart,i);angleStart=-1;}
 }
 for(let i=0;i<text.length;i++){
  const char=text[i];if(char==='\\'){i++;continue;}
  if(char==='\n'){let next=i+1;while(text[next]===' '||text[next]==='\t'||text[next]==='\r')next++;if(text[next]==='\n'){squares.length=0;rounds.length=0;targets.length=0;}continue;}
  // A quoted title or angle-delimited destination can contain literal brackets
  // and parentheses. Only enter these contexts inside a Markdown link target.
  if(targets.at(-1)===rounds.length){
   const close=containers.get(i);
   if(close!==undefined&&(char==='"'||char==="'")&&/\s/.test(text[i-1]||'')){
    let after=close+1;while(/\s/.test(text[after]||''))after++;
    if(text[after]===')'){i=close;continue;}
   }
   if(close!==undefined&&char==='<'&&(text[i-1]==='('||/\s/.test(text[i-1]||''))){i=close;continue;}
  }
  if(char==='[')squares.push(i);else if(char===']'&&squares.length){pairs.set(squares.pop()!,i);labelEnds.add(i);}
  else if(char==='('){rounds.push(i);if(labelEnds.has(i-1))targets.push(rounds.length);}
  else if(char===')'&&rounds.length){pairs.set(rounds.pop()!,i);if((targets.at(-1)||0)>rounds.length)targets.pop();}
 }
 const ranges:{from:number;to:number}[]=[];
 for(let i=0;i<text.length;i++){
  if(text[i]==='\\'){i++;continue;}if(text[i]!=='[')continue;
  const end=pairs.get(i);if(end===undefined)continue;
  let to:number|undefined;
  if(text[i+1]==='['&&text[end-1]===']')to=end+1;
  else if(text[end+1]==='('||text[end+1]==='['){const target=pairs.get(end+1);if(target!==undefined)to=target+1;}
  if(to!==undefined){ranges.push({from:i,to});i=to-1;}
 }
 return ranges;
}
