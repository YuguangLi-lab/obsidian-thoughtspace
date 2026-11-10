import {isRecord} from './value-guards';
import {validMediaTime} from './media-source';

export const highlightKeys={kind:'thoughtspace_highlight',source:'thoughtspace_source',page:'thoughtspace_page',endPage:'thoughtspace_end_page',time:'thoughtspace_time'} as const;
export type HighlightKind='pdf'|'audio'|'video';
export interface HighlightAnchor {kind:HighlightKind;source:string;page?:number;endPage?:number;time?:number}

const vaultPath=(value:string)=>!!value&&value.length<=2048&&value===value.trim()&&!value.startsWith('/')&&!value.includes('\\')&&!value.split('/').some(part=>part===''||part==='.'||part==='..');
function yaml(value:string){return JSON.stringify(value);}
function pageOf(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=1?value:undefined;}

/** Read a highlight anchor from Obsidian Properties. The quote itself stays in the note body. */
export function parseHighlight(frontmatter:unknown):HighlightAnchor|undefined{
 if(!isRecord(frontmatter))return;
 const kind=frontmatter[highlightKeys.kind],source=frontmatter[highlightKeys.source];
 if((kind!=='pdf'&&kind!=='audio'&&kind!=='video')||typeof source!=='string'||!vaultPath(source))return;
 if(kind==='pdf'){
  if(!/\.pdf$/i.test(source))return;
  const page=pageOf(frontmatter[highlightKeys.page])||1,end=pageOf(frontmatter[highlightKeys.endPage])||page;
  if(end<page)return;
  return {kind,source,page,endPage:end};
 }
 const time=frontmatter[highlightKeys.time];
 if(typeof time!=='number'||!validMediaTime(time))return;
 return {kind,source,time};
}

/** A normal Markdown note. Boards store only its path. */
export function highlightMarkdown(anchor:HighlightAnchor,body:string,title:string):string{
 if(!vaultPath(anchor.source)||!title.trim())throw Error('高亮来源无效');
 const quote=body.replace(/\r\n?/g,'\n').trim();
 if(!quote||quote.length>100000)throw Error('高亮正文无效');
 const lines=['---',`${highlightKeys.kind}: ${anchor.kind}`,`${highlightKeys.source}: ${yaml(anchor.source)}`];
 if(anchor.kind==='pdf'){
  const page=anchor.page||1,end=anchor.endPage||page;
  if(end<page)throw Error('PDF 页码无效');
  lines.push(`${highlightKeys.page}: ${page}`,`${highlightKeys.endPage}: ${end}`);
 }else if(typeof anchor.time!=='number'||!validMediaTime(anchor.time))throw Error('媒体时间无效');
 else lines.push(`${highlightKeys.time}: ${anchor.time}`);
 const sourceLink=anchor.kind==='pdf'?`[[${anchor.source}#page=${anchor.page||1}]]`:`[[${anchor.source}]]`;
 lines.push('---','',`# ${title.trim().slice(0,80)}`,'',quote,'',`来源：${sourceLink}`,'');
 return lines.join('\n');
}

export function highlightJump(anchor:HighlightAnchor):{path:string;page?:number;time?:number}{
 return {path:anchor.source,page:anchor.page,time:anchor.time};
}
