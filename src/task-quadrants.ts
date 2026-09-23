import {inlineLiteralRanges} from './markdown-literals';
import type {PlannedTask} from './task-planner-model';
export type TaskQuadrant='q1'|'q2'|'q3'|'q4';
export const TASK_QUADRANTS:{id:TaskQuadrant;label:string;hint:string}[]=[
 {id:'q1',label:'重要且紧急',hint:'优先处理'},
 {id:'q2',label:'重要不紧急',hint:'安排计划'},
 {id:'q3',label:'紧急不重要',hint:'尽快处理或委托'},
 {id:'q4',label:'不重要不紧急',hint:'稍后考虑'}
];
const quadrantRanges=(text:string)=>inlineLiteralRanges(text).filter(r=>r.comment&&/^<!--\s*thoughtspace:quadrant=q[1-4]\s*-->$/.test(text.slice(r.from,r.to)));
export function quadrantOverride(text:string):TaskQuadrant|undefined{const r=quadrantRanges(text)[0];return r?text.slice(r.from,r.to).match(/=(q[1-4])/)![1] as TaskQuadrant:undefined;}
export function stripQuadrant(text:string){let result='',at=0;for(const r of quadrantRanges(text)){result+=text.slice(at,r.from).replace(/[ \t]*$/,'');at=r.to;}return result+text.slice(at);}
/** Classification is relative to the selected calendar day, never today's wall clock. */
export function taskQuadrant(task:PlannedTask,day:string):TaskQuadrant{
 const explicit=quadrantOverride(task.text);if(explicit)return explicit;
 const important=task.priority<=1,urgent=!!task.due&&task.due<=day;
 return important?(urgent?'q1':'q2'):(urgent?'q3':'q4');
}
/** Manual classification preserves dates, priorities, tags and recurrence rules. */
export function setTaskQuadrant(text:string,target:TaskQuadrant|'auto'){
 if(target!=='auto'&&!TASK_QUADRANTS.some(q=>q.id===target))throw Error('任务象限无效');
 const id=text.match(/\s+\^[A-Za-z0-9-]+\s*$/)?.[0]||'',body=id?text.slice(0,-id.length):text;
 const clean=stripQuadrant(body).trimEnd();if(target==='auto')return clean+id;
 const last=inlineLiteralRanges(clean).at(-1),raw=last?clean.slice(last.from):'',open=last?.comment&&(raw.startsWith('<!--')?!raw.endsWith('-->'):raw.length<4||!raw.endsWith('%%'));
 const marker=`<!-- thoughtspace:quadrant=${target} -->`;
 return (open?clean.slice(0,last.from).trimEnd()+' '+marker+' '+raw:clean+' '+marker)+id;
}
