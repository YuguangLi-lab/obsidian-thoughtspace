export interface SearchRange {from:number;to:number;}
export interface EditorSearchOptions {caseSensitive:boolean;wholeWord:boolean;range?:SearchRange;}
const word=(s:string|undefined)=>!!s&&/[\p{L}\p{N}\p{M}_]/u.test(s);
/** Literal matches retain original UTF-16 offsets, including case folds of different lengths. */
export function editorMatches(text:string,query:string,options:EditorSearchOptions){
 if(text.length>2000000)throw Error('当前内容超过 2,000,000 字符，请使用 Obsidian 原生查找');
 if(query.length>1000)throw Error('查找文字请控制在 1,000 字符以内');
 const {from=0,to=text.length}=options.range||{};
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>text.length)throw Error('查找范围已变化，请重新打开');
 const matches:SearchRange[]=[];if(!query||from===to)return matches;
 const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),re=new RegExp(escaped,options.caseSensitive?'gu':'giu');
 // Bound literal matching to the requested end, but keep a split surrogate pair
 // intact so truncation cannot invent a match for an otherwise paired surrogate.
 const endSplitsPair=to>0&&text.charCodeAt(to-1)>=0xd800&&text.charCodeAt(to-1)<=0xdbff&&text.charCodeAt(to)>=0xdc00&&text.charCodeAt(to)<=0xdfff;
 const source=to<text.length?text.slice(0,to+(endSplitsPair?1:0)):text;
 re.lastIndex=from;let m:RegExpExecArray|null;
 while((m=re.exec(source))){const end=m.index+m[0].length;if(end>to)break;if(m.index<from)continue;
  if(options.wholeWord){
   // Read one neighboring code point, preserving isolated surrogates and checks outside the selected range.
   let prior=m.index-1;const unit=text.charCodeAt(prior),lead=text.charCodeAt(prior-1);
   if(unit>=0xdc00&&unit<=0xdfff&&lead>=0xd800&&lead<=0xdbff)prior--;
   const before=text.slice(Math.max(0,prior),m.index),after=text.slice(end,end+((text.codePointAt(end)??0)>0xffff?2:1));
   if(word(before)||word(after))continue;
  }
  matches.push({from:m.index,to:end});
  if(matches.length>10000)throw Error('匹配超过 10,000 处，请缩小范围或使用更长的查找文字');
 }
 return matches;
}
export function editorReplacement(text:string,matches:readonly SearchRange[],replacement:string){
 if(replacement.length>10000)throw Error('替换文字请控制在 10,000 字符以内');
 if(!matches.length)return undefined;
 let previous=-1,delta=0;for(const m of matches){const from=m.from,to=m.to;if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<=from||to>text.length||from<previous)throw Error('匹配范围无效，请重新查找');previous=to;delta+=replacement.length-(to-from);}
 if(text.length+delta>2000000)throw Error('替换后内容超过 2,000,000 字符，请减少替换范围');
 const from=matches[0].from,to=matches.at(-1)!.to;let cursor=from,result='';
 for(const m of matches){result+=text.slice(cursor,m.from)+replacement;cursor=m.to;}
 result+=text.slice(cursor,to);
 return {from,to,text:result,delta,count:matches.length};
}

/** Compute line numbers once per match index, retaining only one number per result. */
export function editorMatchLines(text:string,matches:readonly SearchRange[]){
 let cursor=0,line=1,next=text.indexOf('\n');const lines:number[]=[];
 for(const match of matches){while(next>=0&&next<match.from){line++;cursor=next+1;next=text.indexOf('\n',cursor);}lines.push(line);}
 return lines;
}
/** A single-line search field must not silently join selected paragraphs. */
export function editorSearchSeed(text:string,from:number,to:number){const value=text.slice(from,to);return value.length<=1000&&!/[\r\n]/.test(value)?value:'';}
