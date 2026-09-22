import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dayTimeline,journalRecords,scheduleText,timeSlot} from '../src/day-timeline-model';
import {changeTask,planTasks} from '../src/task-planner-model';
const day='2026-09-09',path='Journal/2026/09/2026-09-09.md';
test('Timeline accepts single times and ranges and rejects false clock matches',()=>{
 assert.equal(timeSlot('9:05 - 10:30 写作')?.end,630);assert.equal(timeSlot('09:00 阅读')?.title,'阅读');assert.equal(timeSlot('#work 09:00–10:00 阅读')?.title,'#work  阅读');
 for(const text of ['25:00 错误','109:00 错误','https://x:09:00/a','2026-09-09','09:65 错误'])assert.equal(timeSlot(text),undefined);
 assert.equal(timeSlot('23:00 - 01:00 跨日')?.invalidRange,true);
});
test('Timeline sorts selected day only and can retain or hide completed tasks',()=>{
 const tasks=planTasks('- [ ] 14:00 写作\n- [x] 09:00 阅读\n- [ ] 未定时间\n- [ ] 08:00 明天 ⏳ 2026-09-10',path,'Journal');
 const result=dayTimeline(tasks,day);assert.deepEqual(result.items.map(i=>i.slot.start),[540,840]);assert.equal(result.untimed.length,1);assert.equal(dayTimeline(tasks,day,[],true).items.length,1);assert.equal(dayTimeline(tasks,'2026-09-10').items.length,1);
});
test('Timeline includes tasks scheduled from other notes and retains stable source lines',()=>{
 const tasks=planTasks('- [ ] 10:00 外部 ⏳ 2026-09-09\n- [ ] 10:00 未安排','Notes/a.md','Journal');const result=dayTimeline(tasks,day);assert.equal(result.items.length,1);assert.equal(result.items[0].line,0);assert.equal(result.items[0].path,'Notes/a.md');
});
test('Time conflict detection handles nesting, adjacency and completed tasks',()=>{
 const tasks=planTasks('- [ ] 09:00 - 12:00 A\n- [ ] 09:30 - 10:00 B\n- [ ] 11:00 - 11:30 C\n- [ ] 12:00 - 13:00 D\n- [x] 12:15 - 12:45 E',path,'Journal');
 const items=dayTimeline(tasks,day).items;assert.deepEqual(items.map(i=>!!i.conflict),[true,true,true,false,false]);assert.equal(tasks[0].title,'09:00 - 12:00 A');
});
test('Journal records skip frontmatter fenced examples and checkbox tasks',()=>{
 const text='---\n- 08:00 metadata\n---\n### 09:00 · 随记\nhello\n- 10:00 电话\n- [ ] 11:00 待办\n```md\n### 12:00 示例\n```\n~~~\n- 13:00 示例\n~~~';
 const records=journalRecords(text,path);assert.deepEqual(records.map(r=>[r.line,r.title]),[[3,'随记'],[5,'电话']]);
});
test('Schedule edits preserve tags priority quadrant and exact-line conflict protection',()=>{
 const text='- [ ] 09:00 - 10:00 阅读 #work ⏫ <!-- thoughtspace:quadrant=q2 -->';const task=planTasks(text,path,'Journal')[0];const title=timeSlot(task.text)!.title;
 const update=scheduleText(title,'11:00','12:00');const next=changeTask(text,task,{content:update});assert.ok(next.includes('#work ⏫ <!-- thoughtspace:quadrant=q2 -->'));assert.ok(next.startsWith('- [ ] 11:00 - 12:00'));assert.throws(()=>changeTask(text+' changed',task,{content:update}),/原文已变化/);
});
test('Schedule form validates boundaries empty title and multiline injection',()=>{
 assert.equal(scheduleText('  阅读  ','9:00','10:00'),'09:00 - 10:00 阅读');for(const args of [['','09:00','10:00'],['a\nb','09:00',''],['a','25:00',''],['a','09:00','08:00'],['a','09:00','09:00']])assert.throws(()=>scheduleText(args[0],args[1],args[2]));
});
test('Free slots use merged explicit ranges and ignore unknown end times',async()=>{
 const {timelineGaps}=await import('../src/day-timeline-model');const tasks=planTasks('- [ ] 09:00 - 11:00 A\n- [ ] 09:30 - 10:00 Nested\n- [ ] 11:30 - 12:00 B\n- [ ] 13:00 Unknown\n- [ ] 14:00 - 15:00 C',path,'Journal');
 assert.deepEqual(timelineGaps(dayTimeline(tasks,day).items),[{start:660,end:690},{start:720,end:780}]);assert.deepEqual(timelineGaps(dayTimeline(tasks.slice(-2),day).items),[]);
});
