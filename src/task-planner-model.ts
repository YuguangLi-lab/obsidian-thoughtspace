import {markdownRows} from './markdown-context';
import {maskInlineLiterals,outsideInlineLiterals,stripInlineComments,inlineLiteralRanges} from './markdown-literals';
import {clockLabel,timeSlot,scheduleText} from './task-time';
import {stripQuadrant} from './task-quadrants';
import {extractTasks, taskCheckbox, Task} from './model';
import {dateOf, shiftDay} from './calendar-tools';
export type PlannedTask=Task & {path:string;day?:string;due?:string;scheduled?:string;completedOn?:string;priority:number;title:string;tags:string[];time?:string;recurring:boolean};
export type TaskFilter='today'|'unfinished'|'overdue'|'upcoming'|'inbox'|'done'|'timeline'|'completed';
const priorities=['🔺','⏫','🔼','','🔽','⏬'];
function validDay(value?:string){if(!value)return;try{dateOf(value);return value;}catch{return;}}
export function planTasks(text:string,path:string,journalRoot:string):PlannedTask[]{
 const day=path.startsWith(journalRoot+'/')?validDay(path.split('/').pop()?.replace(/\.md$/i,'')):undefined;
 return extractTasks(text).filter(t=>t.text.trim()).map(t=>{
  const prose=maskInlineLiterals(t.text),due=validDay(prose.match(/📅\s*(\d{4}-\d{2}-\d{2})(?![\d-])/)?.[1]),scheduled=validDay(prose.match(/⏳\s*(\d{4}-\d{2}-\d{2})(?![\d-])/)?.[1]);
  const completedOn=validDay(prose.match(/✅\s*(\d{4}-\d{2}-\d{2})(?![\d-])/)?.[1]);
  const priority=priorities.findIndex(p=>p&&prose.includes(p));
  return {...t,path,day,due,scheduled,completedOn,priority:priority<0?3:priority,title:outsideInlineLiterals(stripInlineComments(stripQuadrant(t.text)),prose=>prose.replace(/(?:📅|⏳|✅)\s*\d{4}-\d{2}-\d{2}(?![\d-])/g,'').replace(/[🔺⏫🔼🔽⏬]/gu,'').replace(/\s+/g,' ')).trim(),tags:[...new Set(prose.match(/#[\p{L}\p{N}_/-]+/gu)||[])],time:timeSlot(t.text)?clockLabel(timeSlot(t.text)!.start):undefined,recurring:prose.includes('🔁')};
 });
}
export function taskDate(t:PlannedTask){return t.scheduled||t.due||t.day;}
export function isToday(t:PlannedTask,day:string){return t.scheduled===day||t.due===day||(!t.scheduled&&!t.due&&t.day===day);}
export function taskMatches(t:PlannedTask,day:string,filter:TaskFilter){
 if(filter==='completed')return t.checked;
 if(filter==='done')return t.checked&&(t.completedOn?t.completedOn===day:isToday(t,day));
 if(t.checked)return false;
 if(filter==='today'||filter==='timeline')return isToday(t,day)&&(filter!=='timeline'||!!t.time);
 if(filter==='unfinished')return true;
 if(filter==='overdue')return !!t.due&&t.due<day;
 if(filter==='inbox')return !t.due&&!t.scheduled&&!t.day;
 const end=shiftDay(day,7),dates=t.scheduled||t.due?[t.scheduled,t.due]:[t.day];return dates.some(date=>!!date&&date>day&&date<=end);
}
export function selectTasks(tasks:PlannedTask[],day:string,filter:TaskFilter,query='',tag='',sort:'priority'|'date'|'source'|'time'='priority'){
 const q=query.trim().toLocaleLowerCase();return tasks.filter(t=>taskMatches(t,day,filter)&&(!tag||t.tags.includes(tag))&&(!q||`${t.text} ${t.path}`.toLocaleLowerCase().includes(q))).sort((a,b)=>{
  if(filter==='timeline')return (a.time||'').localeCompare(b.time||'')||a.path.localeCompare(b.path)||a.line-b.line;
  const p=a.priority-b.priority,d=(taskDate(a)||'9999').localeCompare(taskDate(b)||'9999'),s=a.path.localeCompare(b.path)||a.line-b.line;
  const time=(a.time||'99:99').localeCompare(b.time||'99:99');
  return sort==='time'?d||time||p||s:sort==='source'?s:sort==='date'?d||p||s:p||d||s;
 });
}
/** Do not append real metadata inside a comment that continues onto the next line. */
function appendMetadata(line:string,value:string){
 const last=inlineLiteralRanges(line).at(-1);
 if(last?.comment&&last.to===line.length){const raw=line.slice(last.from),html=raw.startsWith('<!--'),closed=html?raw.endsWith('-->'):raw.length>=4&&raw.endsWith('%%');if(!closed)return line.slice(0,last.from).trimEnd()+' '+value+' '+raw;}
 return line+' '+value;
}
/** Exact-line optimistic concurrency: never apply a stale task action to a different row. */
export function changeTask(text:string,task:PlannedTask,change:{checked?:boolean;due?:string;scheduled?:string;completedOn?:string;priority?:number;content?:string;time?:{start:string;end?:string}|null}):string{
 const lines=text.split('\n');if(lines[task.line]!==task.source)throw Error('任务原文已变化，请刷新后再操作');
 if(task.recurring&&change.checked!==undefined)throw Error('重复任务请在原文使用 Tasks 插件完成，以保留其重复规则');
 let line=task.source;const cr=line.endsWith('\r')?'\r':'';line=line.replace(/\r$/,'');
 const at=taskCheckbox(task);if(at<0||!/^\[[ xX]\]/.test(line.slice(at)))throw Error('任务格式无法识别，请打开原文检查');
 const prefixEnd=at+3+(line.slice(at+3).match(/^[ \t]*/)?.[0].length||0),prefix=line.slice(0,prefixEnd);
 const originalId=line.match(/\s+\^[A-Za-z0-9-]+\s*$/)?.[0];
 let body=line.slice(prefixEnd);
 if(change.content!==undefined){body=change.content.trim();if(!body||/[\r\n]/.test(body))throw Error('任务内容须为非空的一行');}
 const suppliedId=body.match(/\s+\^[A-Za-z0-9-]+\s*$/)?.[0],blockId=originalId||suppliedId;
 if(suppliedId)body=body.slice(0,-suppliedId.length);
 if(change.time!==undefined){body=timeSlot(body)?.title??body;if(!body.trim())throw Error('请保留任务内容');if(change.time!==null)body=scheduleText(body,change.time.start,change.time.end);}
 line=prefix+body;
 if(change.checked!==undefined)line=line.slice(0,at)+(change.checked?'[x]':'[ ]')+line.slice(at+3);
 for(const [key,icon] of [['due','📅'],['scheduled','⏳'],['completedOn','✅']] as const){const value=key==='completedOn'?(change.completedOn??(change.checked===false?'':undefined)):change[key];if(value===undefined)continue;if(value&&!validDay(value))throw Error('日期无效');line=outsideInlineLiterals(line,prose=>prose.replace(new RegExp('\\s*'+icon+'\\s*\\d{4}-\\d{2}-\\d{2}(?![\\d-])','g'),''));if(value)line=appendMetadata(line,`${icon} ${value}`);}
 if(change.priority!==undefined){if(!Number.isInteger(change.priority)||change.priority<0||change.priority>5)throw Error('优先级无效');line=outsideInlineLiterals(line,prose=>prose.replace(/\s*[🔺⏫🔼🔽⏬]/gu,''));if(priorities[change.priority])line=appendMetadata(line,priorities[change.priority]);}
 lines[task.line]=line+(blockId||'')+cr;return lines.join('\n');
}
export type TaskGrouping='none'|'source'|'date'|'priority';
/** Stable grouping retains each task's current filtered/sorted order inside its group. */
export function groupTasks(tasks:PlannedTask[],by:TaskGrouping):{label:string;tasks:PlannedTask[]}[]{
 if(by==='none')return [{label:'',tasks}];
 const groups=new Map<string,PlannedTask[]>();
 for(const task of tasks){const key=by==='source'?task.path:by==='date'?(taskDate(task)||'未安排'):String(task.priority);const list=groups.get(key)||[];list.push(task);groups.set(key,list);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b,'zh-CN')).map(([key,tasks])=>({label:by==='priority'?['最高优先级','高优先级','中优先级','普通优先级','低优先级','最低优先级'][Number(key)]:key,tasks}));
}
export function restoreTaskLine(text:string,line:number,expected:string,original:string){
 const lines=text.split('\n');if(lines[line]!==expected)throw Error('任务在操作后已变化，无法安全撤销，请打开原文检查');lines[line]=original;return lines.join('\n');
}
export function journalTaskBlock(text:string,day:string){dateOf(day);if([...markdownRows(text)].some(r=>'fenceOpening' in r&&r.fenceOpening&&/^ {0,3}`{3,}thoughtspace-tasks\s*$/.test(r.source)))return text;return text+(text.endsWith('\n\n')?'':text.endsWith('\n')?'\n':'\n\n')+'## 待办与未完成\n\n```thoughtspace-tasks\n'+day+'\n```\n';}
