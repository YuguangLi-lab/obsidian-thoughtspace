import {maskInlineLiterals} from './markdown-literals';
export type TimeSlot={start:number;end?:number;label:string;title:string;invalidRange?:boolean;endInput?:string};
export const clockLabel=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
const clock='(?:[01]?\\d|2[0-3]):[0-5]\\d';
const minutes=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
/** Times must be separated from prose; a date or URL must never become a schedule. */
export function timeSlot(text:string):TimeSlot|undefined{
 const match=new RegExp(`(?:^|\\s)(${clock})(?:\\s*[-–—~～]\\s*(${clock}))?(?=\\s|$|[·])`).exec(maskInlineLiterals(text));
 if(!match)return;const start=minutes(match[1]),finish=match[2]?minutes(match[2]):undefined,end=finish!==undefined&&finish>start?finish:undefined;
 return {start,end,endInput:match[2]?clockLabel(finish!):undefined,label:clockLabel(start)+(end!==undefined?'–'+clockLabel(end):''),title:(text.slice(0,match.index)+' '+text.slice(match.index+match[0].length)).replace(/^\s*[·]\s*/,'').trim(),invalidRange:finish!==undefined&&end===undefined};
}
export function scheduleText(title:string,start:string,end=''){
 const clean=title.trim();if(!clean||/[\r\n]/.test(clean))throw Error('请填写一行事项内容');
 if(!new RegExp(`^${clock}$`).test(start)||end&&!new RegExp(`^${clock}$`).test(end))throw Error('请输入有效时间');
 if(end&&minutes(end)<=minutes(start))throw Error('结束时间须晚于开始时间；跨日事项请拆成两天');
 return `${clockLabel(minutes(start))}${end?' - '+clockLabel(minutes(end)):''} ${clean}`;
}
