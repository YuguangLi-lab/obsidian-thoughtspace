export interface SearchRange {from:number;to:number;}
export interface EditorSearchOptions {caseSensitive:boolean;wholeWord:boolean;range?:SearchRange;}
const word=(s:string|undefined)=>!!s&&/[\p{L}\p{N}\p{M}_]/u.test(s);
/** Literal matches retain original UTF-16 offsets, including case folds of different lengths. */
export function editorMatches(text:string,query:string,options:EditorSearchOptions){
 if(text.length>2000000)throw Error('当前内容超过 2,000,000 字符，请使用 Obsidian 原生查找');
 if(query.length>1000)throw Error('查找文字请控制在 1,000 字符以内');
 const {from=0,to=text.length}=options.range||{};
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>text.length)throw Error('查找范围已变化，请重新打开');
 const matches:SearchRange[]=[];if(!query)return matches;
 const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),re=new RegExp(escaped,options.caseSensitive?'gu':'giu');
 re.lastIndex=from;let m:RegExpExecArray|null;
 while((m=re.exec(text))){const end=m.index+m[0].length;if(end>to)break;
  if(options.wholeWord){
   const before=Array.from(text.slice(Math.max(0,m.index-2),m.index)).at(-1),after=Array.from(text.slice(end,end+2))[0];
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
 let previous=-1;for(const m of matches){if(!Number.isInteger(m.from)||!Number.isInteger(m.to)||m.from<0||m.to<=m.from||m.to>text.length||m.from<previous)throw Error('匹配范围无效，请重新查找');previous=m.to;}
 const delta=matches.reduce((n,m)=>n+replacement.length-(m.to-m.from),0);
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
