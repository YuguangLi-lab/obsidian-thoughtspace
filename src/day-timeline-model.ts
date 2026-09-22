import {markdownRows} from './markdown-context';
import {isToday,PlannedTask} from './task-planner-model';
import {timeSlot,TimeSlot} from './task-time';
export {clockLabel,timeSlot,scheduleText,TimeSlot} from './task-time';
export type TimelineItem={id:string;kind:'task'|'record';path:string;line:number;title:string;slot:TimeSlot;task?:PlannedTask;conflict?:boolean};
export function journalRecords(text:string,path:string):TimelineItem[]{
 const rows:TimelineItem[]=[];
 for(const row of markdownRows(text)){
  if(row.code)continue;
  const match=row.visible.match(/^(?:(?: {0,3}>[ \t]?)+)?\s*(?:#{1,6}\s+|[-*+]\s+)(?!\[[ xX]\]\s)(.*)$/);if(!match)continue;
  const slot=timeSlot(match[1]);if(slot)rows.push({id:`record:${path}:${row.line}`,kind:'record',path,line:row.line,title:slot.title||'随记',slot});
 }return rows;
}

export function dayTimeline(tasks:PlannedTask[],day:string,records:TimelineItem[]=[],hideDone=false){
 const selected=tasks.filter(t=>isToday(t,day)&&(!hideDone||!t.checked));const untimed:PlannedTask[]=[],items:TimelineItem[]=[...records];
 for(const task of selected){const slot=timeSlot(task.title);if(!slot){untimed.push(task);continue;}items.push({id:`task:${task.path}:${task.line}`,kind:'task',path:task.path,line:task.line,title:slot.title||'待办',slot,task});}
 items.sort((a,b)=>a.slot.start-b.slot.start||a.path.localeCompare(b.path)||a.line-b.line);
 const scheduled=items.filter(i=>i.task&&!i.task.checked&&i.slot.end!==undefined);let previousEnd=-1;
 scheduled.forEach((item,i)=>{item.conflict=item.slot.start<previousEnd||(scheduled[i+1]?.slot.start??Infinity)<item.slot.end!;previousEnd=Math.max(previousEnd,item.slot.end!);});
 return {items,untimed};
}
/** Gaps are only inferred between explicit time ranges, never before/after the day. */
export function timelineGaps(items:TimelineItem[]){
 const ranges=items.filter(i=>i.task).map(i=>({start:i.slot.start,end:i.slot.end})).sort((a,b)=>a.start-b.start);const gaps:{start:number;end:number}[]=[];let end:number|undefined,known=false;
 for(const range of ranges){if(known&&end!==undefined&&range.start-end>=15)gaps.push({start:end,end:range.start});known=range.end!==undefined;if(range.end!==undefined)end=Math.max(end??range.end,range.end);}return gaps;
}
