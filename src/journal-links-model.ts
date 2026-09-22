import {markdownRows} from './markdown-context';
import {inlineCodeRanges,maskInlineCode} from './markdown-literals';
import {localDay} from './filing';
import {isWorkspaceFile} from './workspace';
export const CREATED_START='<!-- thoughtspace:created-notes:start -->';
export const CREATED_END='<!-- thoughtspace:created-notes:end -->';
export function createdNoteDay(file:{path:string;stat:{ctime:number}},journalRoot:string):string|undefined {
  if(!/\.md$/i.test(file.path)||!isWorkspaceFile(file)||file.path.startsWith(journalRoot+'/'))return;
  const time=file.stat.ctime;if(!Number.isFinite(time)||time<=0)return;
  return localDay(new Date(time));
}
export function createdNoteLink(path:string):string {
  const name=path.split('/').pop()!.replace(/\.md$/i,'');
  // Obsidian's wikilink delimiters cannot represent these legal filename characters.
  if(/[\[\]#^|\r\n]/.test(path))return `[${name.replace(/[\\\[\]]/g,'\\$&')}](${encodeURI(path).replace(/[()#^|\[\]]/g,c=>'%'+c.charCodeAt(0).toString(16))})`;
  return `[[${path}|${name}]]`;
}
/** Export existing paths safely while retaining compact wikilinks for ordinary names. */
export function fileReference(path:string){return /[\[\]#^|\r\n]/.test(path)?createdNoteLink(path):`[[${path}]]`;}
/** Only the explicitly managed block changes. Everything outside it is byte-preserved. */
export function syncCreatedNotes(text:string,paths:string[]):string {
  const starts:number[]=[],ends:number[]=[],literals=inlineCodeRanges(text);let offset=0,literal=0;
  for(const row of markdownRows(text)){
    if(!row.code&&row.topLevel&&!row.commentBefore){
      const prose=maskInlineCode(row.source),trimmed=prose.trim();
      while(literal<literals.length&&literals[literal].to<=offset)literal++;
      if(literal<literals.length&&literals[literal].from<offset&&literals[literal].to>=offset+row.source.trimEnd().length){offset+=row.source.length+1;continue;}
      if(prose.includes(CREATED_START)||prose.includes(CREATED_END)){
        if(trimmed!==CREATED_START&&trimmed!==CREATED_END)throw Error('当日新建笔记索引标记须独占一行，请检查日记中的 ThoughtSpace 注释');
        (trimmed===CREATED_START?starts:ends).push(offset+prose.indexOf(trimmed));
      }
    }offset+=row.source.length+1;
  }
  const start=starts[0]??-1,end=ends[0]??-1;
  if(starts.length!==ends.length||starts.length>1||end<start)throw Error('当日新建笔记索引标记不完整，请检查日记中的 ThoughtSpace 注释');
  const unique=[...new Set(paths)].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  if(start<0&&!unique.length)return text;
  const block=`${CREATED_START}\n## 当日新建笔记\n\n${unique.length?unique.map(path=>'- '+createdNoteLink(path)).join('\n'):'当天还没有新建笔记。'}\n${CREATED_END}`;
  return start>=0?text.slice(0,start)+block+text.slice(end+CREATED_END.length):text+(text.endsWith('\n\n')?'':text.endsWith('\n')?'\n':'\n\n')+block+'\n';
}
