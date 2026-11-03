/** Mermaid cards remain ordinary Markdown text nodes for older board readers. */
export const DEFAULT_MERMAID_SOURCE='flowchart TD\n    A["开始"] --> B["整理想法"]\n    B --> C["下一步"]';

/** Only a complete, standalone fenced diagram opts into the diagram editor.
 * Mixed Markdown and unclosed fences must keep the ordinary text editor. */
export function mermaidSource(text:string):string|undefined {
 const opening=/^(?:[ \t]*\r?\n)* {0,3}(`{3,}|~{3,})[ \t]*mermaid[ \t]*\r?\n/.exec(text);
 if(!opening)return undefined;
 const fence=opening[1],start=opening[0].length;
 let cursor=start;
 while(cursor<=text.length){
  const newline=text.indexOf('\n',cursor),end=newline<0?text.length:newline;
  const line=text.slice(cursor,end).replace(/\r$/,'');
  const closing=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  if(closing&&closing[1][0]===fence[0]&&closing[1].length>=fence.length){
   if(!/^[ \t\r\n]*$/.test(text.slice(end)))return undefined;
   return text.slice(start,cursor).replace(/\r?\n$/,'');
  }
  if(newline<0)break;
  cursor=end+1;
 }
 return undefined;
}

/** A source line containing backticks can never close the generated wrapper. */
export function mermaidMarkdown(source:string):string {
 let length=3;
 for(const run of source.matchAll(/`+/g))length=Math.max(length,run[0].length+1);
 const fence='`'.repeat(length);
 return `${fence}mermaid\n${source}\n${fence}`;
}
