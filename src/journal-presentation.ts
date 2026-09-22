import {markdownRows} from './markdown-context';
import {CREATED_START,CREATED_END} from './journal-links-model';
/** Extract only the plugin-owned index; malformed or duplicate markers stay visible. */
export function journalPresentation(text:string){
 const starts:number[]=[],ends:number[]=[];let offset=0;
 for(const row of markdownRows(text)){const trimmed=row.source.trim();if(!row.code&&row.topLevel&&!row.commentBefore){if(trimmed===CREATED_START)starts.push(offset+row.source.indexOf(CREATED_START));if(trimmed===CREATED_END)ends.push(offset+row.source.indexOf(CREATED_END));}offset+=row.source.length+1;}
 const start=starts[0]??-1,end=ends[0]??-1;
 if(starts.length!==1||ends.length!==1||end<start)return {body:text,links:undefined};
 return {body:text.slice(0,start)+text.slice(end+CREATED_END.length),links:text.slice(start+CREATED_START.length,end).replace(/^\s*## 当日新建笔记\s*\r?\n/,'').trim()};
}
