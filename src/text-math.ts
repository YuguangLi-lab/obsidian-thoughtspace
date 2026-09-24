export type TextMathPart = {kind:'text';text:string}|{kind:'math';text:string;source:string;display:boolean};
const escaped=(text:string,index:number)=>{let slashes=0;while(index>0&&text[--index]==='\\')slashes++;return slashes%2===1;};
/** Formula-only parsing keeps ordinary text literal; code, escaped dollars and currency stay untouched. */
export function textMathParts(text:string):TextMathPart[]{
 const parts:TextMathPart[]=[];let cursor=0,literal=0,fence:{char:string;length:number}|undefined;
 while(cursor<text.length){
  if(cursor===0||text[cursor-1]==='\n'){
   const end=text.indexOf('\n',cursor),line=text.slice(cursor,end<0?undefined:end),match=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
   if(fence){if(match&&match[1][0]===fence.char&&match[1].length>=fence.length&&!match[2].trim())fence=undefined;cursor=end<0?text.length:end+1;continue;}
   if(match&&(match[1][0]!=='`'||!match[2].includes('`'))){fence={char:match[1][0],length:match[1].length};cursor=end<0?text.length:end+1;continue;}
  }
  if(text[cursor]==='`'&&!escaped(text,cursor)){
   let end=cursor+1;while(text[end]==='`')end++;const ticks=text.slice(cursor,end);let close=text.indexOf(ticks,end);
   while(close>=0&&(text[close-1]==='`'||text[close+ticks.length]==='`'))close=text.indexOf(ticks,close+ticks.length);
   if(close>=0){cursor=close+ticks.length;continue;}cursor=end;continue;
  }
  if(text[cursor]!=='$'||escaped(text,cursor)){cursor++;continue;}
  let run=1;while(text[cursor+run]==='$')run++;if(run>2){cursor+=run;continue;}
  const display=run===2,start=cursor+run;
  if(!display&&(!text[start]||/\s/.test(text[start]))){cursor++;continue;}
  let close=start,restart=-1;
  while(close<text.length){
   if(!display&&text[close]==='\n'){close=-1;break;}
   if(text[close]==='$'&&!escaped(text,close)){
    let count=1;while(text[close+count]==='$')count++;
    if(count===run&&(display||close>start&&!/\s/.test(text[close-1])&&!/\d/.test(text[close+1]||'')))break;
    // An invalid inline closer is a possible new opener. Do not rescan a long currency line.
    if(!display){restart=close;break;}
    close+=count;continue;
   }close++;
  }
  if(restart>=0){cursor=restart;continue;}
  if(close<0||close>=text.length||!text.slice(start,close).trim()){cursor=start;continue;}
  if(cursor>literal)parts.push({kind:'text',text:text.slice(literal,cursor)});
  parts.push({kind:'math',text:text.slice(cursor,close+run),source:text.slice(start,close),display});cursor=close+run;literal=cursor;
 }
 if(literal<text.length)parts.push({kind:'text',text:text.slice(literal)});
 return parts;
}
