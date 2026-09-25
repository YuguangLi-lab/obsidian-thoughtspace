export interface ExcerptSource {link:string;location:string;line?:number;page?:number;citation:string}
/** Only recognized excerpt citation lines leave the card preview. The Markdown file is never changed. */
export function excerptPresentation(raw:string,onSource?:(line:number,source:ExcerptSource)=>void){
 // Every recognized citation contains this marker. Ordinary Markdown still
 // receives the same newline normalization, without allocating a line array.
 if(!raw.includes('来源：'))return{body:raw.replace(/\r\n/g,'\n'),sources:[] as ExcerptSource[]};
 const sources:ExcerptSource[]=[],out:string[]=[];let fence='',frontmatter=false;
 const lines=raw.split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(i===0&&line==='---'){frontmatter=true;out.push(line);continue;}
  if(frontmatter){out.push(line);if(/^(---|\.\.\.)\s*$/.test(line))frontmatter=false;continue;}
  const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence='';out.push(line);continue;}
  const match=!fence&&line.match(/^(?:> )?来源：(\[\[[^\n]+?\]\]|\[[^\n]*?\]\([^\n]+?\)) · ((?:第 (\d+)[–-](\d+) 行(?: · .+)?)|(?:PDF 第 (\d+)(?:[–-](\d+))? 页))\s*$/);
  if(match){const lineNumber=match[3]?Number(match[3]):undefined,page=match[5]?Number(match[5]):undefined;if((lineNumber||page||0)<1){out.push(line);continue;}sources.push({link:match[1],location:match[2],line:lineNumber,page,citation:line.replace(/^> /,'')});onSource?.(i,sources[sources.length-1]);continue;}
  out.push(line);
 }
 return{body:out.join('\n'),sources};
}
/** PDF text nodes contain literal text followed by generated, quoted source footers.
 * Read that terminal envelope before Markdown parsing: a PDF's literal opening fence
 * or separator must not swallow its provenance. Markdown note parsing stays unchanged.
 */
export function textExcerptPresentation(raw:string,onSource?:(line:number,source:ExcerptSource,literalTail?:boolean)=>void){
 if(!raw.includes('来源：'))return{body:raw.replace(/\r\n/g,'\n'),sources:[] as ExcerptSource[]};
 const lines=raw.split(/\r?\n/),tail:{index:number;source:ExcerptSource}[]=[];
 let end=lines.length;
 while(end>0){
  let index=end-1;while(index>=0&&!lines[index].trim())index--;
  if(index<0||!lines[index].startsWith('> 来源：'))break;
  const source=excerptPresentation(lines[index]).sources[0];
  if(!source?.page)break;
  // Generated footers are separated from content by a blank line.
  if(index>0&&lines[index-1].trim())break;
  tail.unshift({index,source});end=index;
 }
 if(!tail.length)return excerptPresentation(raw,onSource);
 const result=excerptPresentation(lines.slice(0,end).join('\n'),onSource);
 for(const {index,source} of tail){result.sources.push(source);onSource?.(index,source,true);}
 return result;
}
export function sourceLinkTarget(link:string){
 if(link.startsWith('[['))return link.slice(2,-2).split('|')[0];
 const match=link.match(/^\[[^\n]*?\]\((.+)\)$/);if(!match)return '';
 let target=match[1].replace(/^<|>$/g,'');try{target=decodeURIComponent(target);}catch{/* Keep literal percent escapes when the target is not URI-encoded. */}return target;
}
export function conceptDocument(title:string,notes:{title:string;link:string;body:string}[]){
 const heading=title.replace(/[\r\n]/g,' ').trim().slice(0,100);if(!heading||notes.length<2||notes.length>50)throw Error('请选择 2–50 篇笔记并填写概念名称');
 if(notes.reduce((n,s)=>n+s.body.length,0)>500000)throw Error('合并内容超过 500,000 字符，请分组整理');
 return `# ${heading}\n\n## 我的理解\n\n\n## 证据与摘录\n\n${notes.map(n=>`### ${n.title.replace(/[\r\n]/g,' ')}\n\n原卡片：${n.link}\n\n${n.body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').replace(/^# [^\n]*\n/,'').trim()}`).join('\n\n---\n\n')}\n`;
}
