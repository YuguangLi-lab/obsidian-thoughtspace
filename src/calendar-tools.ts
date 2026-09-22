import {stripInlineComments} from './markdown-literals';
import {markdownRows} from './markdown-context';
import { journalFolder, localDay } from './filing';
/** Calendar arithmetic uses local noon so DST does not turn a day into its neighbour. */
export function dateOf(day:string):Date {journalFolder(day);return new Date(`${day}T12:00:00`);}
export function shiftDay(day:string,amount:number):string {const d=dateOf(day);d.setDate(d.getDate()+amount);return localDay(d);}
export function shiftMonth(month:string,amount:number):string {const d=dateOf(`${month}-01`);d.setMonth(d.getMonth()+amount);return localDay(d).slice(0,7);}
export function weekDays(day:string):string[] {const d=dateOf(day),start=shiftDay(day,-((d.getDay()+6)%7));return Array.from({length:7},(_,i)=>shiftDay(start,i));}
export function monthGrid(month:string):string[] {const start=weekDays(`${month}-01`)[0];return Array.from({length:42},(_,i)=>shiftDay(start,i));}
/** Display complete weeks only through the last day of this month. */
export function monthDisplayGrid(month:string):string[] {const dates=monthGrid(month);let last=0;dates.forEach((day,i)=>{if(day.slice(0,7)===month)last=i;});return dates.slice(0,(Math.floor(last/7)+1)*7);}
export function monthDays(month:string):string[] {dateOf(`${month}-01`);const end=shiftMonth(month,1);const result:string[]=[];for(let day=`${month}-01`;day.slice(0,7)!==end;day=shiftDay(day,1))result.push(day);return result;}
export function journalPaths(day:string,root:string):string[]{return [`${journalFolder(day,root)}/${day}.md`,`${root}/${day}.md`];}
export function reviewContent(title:string,entries:{day:string;path:string}[]):string {
  return `# ${title}\n\n## 日记索引\n\n${entries.length?entries.map(e=>`- [[${e.path}|${e.day}]]`).join('\n'):'本阶段还没有日记。'}\n\n## 进展与收获\n\n\n## 遇到的问题\n\n\n## 下一步\n\n- [ ] \n`;
}
/** Insert into the real daily-task section, preserving unrelated Markdown byte for byte. */
export function appendJournalTask(text:string,task:string):string {
  const clean=task.trim();if(!clean||/[\r\n]/.test(clean))throw Error('请输入一行待办内容');
  const newline=text.includes('\r\n')?'\r\n':'\n';
  const headings:{start:number;end:number;level:number;title:string}[]=[];
  let offset=0,fence=false,frontmatter=/^---\r?\n[^\n]+:[^\n]*/.test(text)&&!/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.test(text),comment=false;
  for(const row of markdownRows(text)){
    const start=offset;offset+=row.source.length+(offset+row.source.length<text.length?1:0);
    fence='openBlock' in row&&!!row.openBlock;
    if(row.code||!row.topLevel||row.commentBefore)continue;
    const heading=row.visible.replace(/\r$/,'').match(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/);
    if(heading)headings.push({start,end:offset,level:heading[1].length,title:(heading[2]||'').replace(/[ \t]+#+[ \t]*$/,'').trim()});
  }
  const section=headings.find(h=>h.level===2&&h.title==='今日任务');
  const boundary=section?headings.find(h=>h.start>=section.end&&h.level<=2)?.start:undefined;
  if(section){
    const end=boundary??text.length,body=text.slice(section.end,end);
    // Reuse the empty checkbox supplied by the diary template, leaving later placeholders alone.
    const placeholder=body.match(/^(?:[ \t]*\r?\n)*([ \t]{0,3}[-*+] \[ \])[ \t]*(?=\r?\n|$)/);
    if(placeholder){const at=section.end+placeholder[0].length;return text.slice(0,at).replace(/[ \t]*$/,'')+' '+clean+text.slice(at);}
    if(boundary===undefined&&(fence||frontmatter||comment))throw Error('日记中有未闭合的代码块或注释，请先在原文中补齐');
    const at=section.end+body.search(/\s*$/),prefix=text.slice(0,at),suffix=text.slice(at);
    const separator=prefix.endsWith('\n')||/^ {0,3}[-*+] \[[ xX]\]/.test(prefix.split(/\r?\n/).pop()||'')?newline:newline+newline;
    return prefix+separator+'- [ ] '+clean+(suffix.startsWith('\n')||suffix.startsWith('\r\n')?'':newline)+suffix;
  }
  if(fence||frontmatter||comment)throw Error('日记中有未闭合的代码块或注释，请先在原文中补齐');
  const at=headings.find(h=>h.level===2&&h.title==='阅读与关联')?.start??text.length;
  const prefix=text.slice(0,at),suffix=text.slice(at);
  return prefix+(prefix.endsWith(newline+newline)?'':prefix.endsWith('\n')?newline:prefix?newline+newline:'')+'## 今日任务'+newline+newline+'- [ ] '+clean+newline+(suffix?newline:'')+suffix;
}
/** ISO weeks are Monday-first; the Thursday determines the week-numbering year. */
export function isoWeek(day:string):{year:number;week:number}{const local=dateOf(day),d=new Date(Date.UTC(local.getFullYear(),local.getMonth(),local.getDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const year=d.getUTCFullYear();return {year,week:Math.ceil(((d.getTime()-Date.UTC(year,0,1))/86400000+1)/7)};}
export function periodSpec(kind:'week'|'month'|'year',anchor:string){
  dateOf(anchor);const month=anchor.slice(0,7),year=anchor.slice(0,4),days=kind==='week'?weekDays(anchor):kind==='month'?monthDays(month):Array.from({length:12},(_,i)=>monthDays(`${year}-${String(i+1).padStart(2,'0')}`)).flat();
  const week=isoWeek(anchor),title=kind==='week'?`${week.year}-W${String(week.week).padStart(2,'0')} 周记`:kind==='month'?`${month} 月记`:`${year} 年记`;
  return {days,title,year:kind==='week'?String(week.year):year,legacyTitle:kind==='week'?`${days[0]} 周回顾`:kind==='month'?`${month} 月回顾`:undefined};
}

/** A readable preview: keep note labels, never show auto-index HTML comments. */
export function journalExcerpt(text:string):string {
  return stripInlineComments(text).replace(/(?:^## 待办与未完成\r?\n\s*)?```thoughtspace-tasks[^\n]*\n[\s\S]*?```\r?\n?/gm,'').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').replace(/^# \d{4}-\d{2}-\d{2}\r?\n/,'')
    .replace(/^#{1,6} .+$/gm,'').replace(/^\s*-\s*\[[ xX]\]\s*$/gm,'').replace(/<!--[\s\S]*?-->/g,'').replace(/!?\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,(_match,path:string,label?:string)=>label||path.split('/').pop()!.replace(/\.md$/i,''))
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*`\[\]]/g,'').replace(/\s+/g,' ').trim().slice(0,140);
}

/** Month/year keyboard movement clamps the date instead of overflowing into March. */
export function calendarKeyDay(day:string,key:string,shift=false):string|undefined {
  const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(key in offsets)return shiftDay(day,offsets[key]);
  if(key==='Home')return weekDays(day)[0];
  if(key==='End')return weekDays(day)[6];
  if(key==='PageUp'||key==='PageDown'){
    const month=shiftMonth(day.slice(0,7),(key==='PageUp'?-1:1)*(shift?12:1));
    return month+'-'+String(Math.min(Number(day.slice(8)),monthDays(month).length)).padStart(2,'0');
  }
}
/** Valid known journal dates only; never probe arbitrary dates or create missing notes. */
export function adjacentJournalDay(days:Iterable<string>,day:string,direction:-1|1):string|undefined {
  const sorted=[...new Set(days)].filter(d=>{try{dateOf(d);return true;}catch{return false;}}).sort();
  return direction===1?sorted.find(d=>d>day):sorted.reverse().find(d=>d<day);
}
