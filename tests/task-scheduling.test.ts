import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeTask,planTasks,restoreTaskLine,selectTasks} from '../src/task-planner-model';
import {dayTimeline} from '../src/day-timeline-model';
import {timeSlot} from '../src/task-time';
import {setTaskQuadrant} from '../src/task-quadrants';
const day='2026-09-09',parse=(text:string)=>planTasks(text,'Diary/'+day+'.md','Diary');
test('atomic scheduling preserves original Markdown structure, CRLF and metadata',()=>{
 const source='Before\r\n  2. [ ] Research #工作 ⏫ 📅 2026-09-12 🔁 every week <!-- thoughtspace:quadrant=q2 --> ^task1\r\nAfter';
 const next=changeTask(source,parse(source)[0],{time:{start:'9:05',end:'10:20'},scheduled:day});
 assert.match(next,/  2\. \[ \] 09:05 - 10:20 Research #工作 ⏫ 📅 2026-09-12 🔁 every week <!-- thoughtspace:quadrant=q2 --> ⏳ 2026-09-09 \^task1\r\nAfter$/);
 assert.equal(parse(next)[0].time,'09:05');assert.equal(dayTimeline(parse(next),day).items[0].slot.end,620);
});
test('replacing a schedule does not accumulate duplicate times',()=>{
 const source='- [ ] 9:05–10:20 Research #tag ⏳ '+day;
 const next=changeTask(source,parse(source)[0],{time:{start:'14:00',end:'15:00'}});
 assert.equal(next,'- [ ] 14:00 - 15:00 Research #tag ⏳ '+day);
});
test('clear only time and retain dates, tags, quadrant, completion and priority',()=>{
 const source='- [x] 09:00 - 10:00 Work #tag ⏫ ⏳ '+day+' <!-- thoughtspace:quadrant=q1 -->';
 const next=changeTask(source,parse(source)[0],{time:null});
 assert.equal(next,source.replace('09:00 - 10:00 ',''));assert.equal(parse(next)[0].scheduled,day);
});
test('start only and 23:59 valid, reversed and cross-day ranges rejected atomically',()=>{
 const source='- [ ] Work';const task=parse(source)[0];
 assert.equal(changeTask(source,task,{time:{start:'23:59'}}),'- [ ] 23:59 Work');
 for(const time of [{start:'10:00',end:'09:00'},{start:'23:00',end:'01:00'},{start:'09:00',end:'09:00'},{start:'25:00'},{start:''}])assert.throws(()=>changeTask(source,task,{scheduled:day,time}));
});
test('stale snapshot rejects time update and undo protects externally changed rows',()=>{
 const source='- [ ] Work',task=parse(source)[0];const next=changeTask(source,task,{time:{start:'09:00'}});
 assert.throws(()=>changeTask(source+' edited',task,{time:{start:'10:00'}}),/变化/);
 assert.equal(restoreTaskLine(next,0,next,source),source);
 assert.throws(()=>restoreTaskLine(next+' edited',0,next,source),/变化/);
});
test('quadrant and date changes keep the complete scheduled interval',()=>{
 const source='- [ ] 09:00 - 10:30 Work #tag ⏫ ⏳ '+day;
 const quadrant=changeTask(source,parse(source)[0],{content:setTaskQuadrant(parse(source)[0].text,'q3')});
 const moved=changeTask(quadrant,parse(quadrant)[0],{scheduled:'2026-09-10'});
 assert.equal(timeSlot(parse(moved)[0].text)?.label,'09:00–10:30');assert.match(moved,/quadrant=q3/);
 assert.equal(dayTimeline(parse(moved),'2026-09-10').items.length,1);assert.equal(dayTimeline(parse(moved),day).items.length,0);
});
test('time parser is shared between task filters and timeline, including single digit hours',()=>{
 const tasks=parse('- [ ] 9:05–10:10 Early\n- [ ] 16:30 Later\n- [ ] Untimed\n- [ ] https://host/09:20 Not a clock');
 assert.deepEqual(selectTasks(tasks,day,'timeline').map(t=>t.time),['09:05','16:30']);
 assert.deepEqual(dayTimeline(tasks,day).items.map(t=>t.slot.start),[545,990]);
});
test('time sort puts timed tasks first within date, keeps untimed and source tie breaks',()=>{
 const tasks=parse('- [ ] Untimed\n- [ ] 15:00 Later\n- [ ] 09:00 Earlier\n- [ ] 08:00 Tomorrow ⏳ 2026-09-10');
 assert.deepEqual(selectTasks(tasks,day,'unfinished','','','time').map(t=>t.time),['09:00','15:00',undefined,'08:00']);
});
test('invalid explicit end stays available for editing rather than silently disappearing',()=>{
 const slot=timeSlot('14:00 - 13:00 Work');assert.equal(slot?.invalidRange,true);assert.equal(slot?.endInput,'13:00');
 const source='- [ ] 14:00 - 13:00 Work';assert.equal(changeTask(source,parse(source)[0],{time:{start:'14:00',end:'15:00'}}),'- [ ] 14:00 - 15:00 Work');
});
test('editing content and time together uses new content, preserving other mentioned clocks',()=>{
 const source='- [ ] 09:00 Work';const next=changeTask(source,parse(source)[0],{content:'10:00 New content, review at 15:00 #tag',time:{start:'11:00',end:'12:00'}});
 assert.equal(next,'- [ ] 11:00 - 12:00 New content, review at 15:00 #tag');
});
