import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planTasks,changeTask} from '../src/task-planner-model';
import {taskQuadrant,setTaskQuadrant,quadrantOverride} from '../src/task-quadrants';
const day='2026-09-08',parse=(s:string)=>planTasks(s,'Notes/任务.md','Diary');
test('Automatic quadrants combine importance and urgency independently',()=>{
 const tasks=parse('- [ ] A ⏫ 📅 2026-09-08\n- [ ] B 🔺 📅 2026-09-09\n- [ ] C 📅 2026-09-07\n- [ ] D\n- [ ] E ⏳ 2026-09-08\n- [ ] F 🔼');
 assert.deepEqual(tasks.map(t=>taskQuadrant(t,day)),['q1','q2','q3','q4','q4','q4']);
});
test('Urgency uses the selected date and does not mutate the task',()=>{
 const task=parse('- [ ] A ⏫ 📅 2026-09-09')[0],before=JSON.stringify(task);
 assert.equal(taskQuadrant(task,day),'q2');assert.equal(taskQuadrant(task,'2026-09-09'),'q1');assert.equal(JSON.stringify(task),before);
});
test('Manual assignment preserves metadata and can return to automatic classification',()=>{
 const text='Read #研究 ⏫ 📅 2026-09-08 ⏳ 2026-09-10 🔁 every week';
 const manual=setTaskQuadrant(text,'q4');assert.ok(manual.startsWith(text));assert.equal(taskQuadrant(parse('- [ ] '+manual)[0],day),'q4');
 assert.equal(setTaskQuadrant(manual,'auto'),text);assert.equal(taskQuadrant(parse('- [ ] '+text)[0],day),'q1');
});
test('Reassignment replaces its marker and does not expose metadata in task titles',()=>{
 const text=setTaskQuadrant(setTaskQuadrant('Read #工作','q1'),'q2');
 assert.equal(text.match(/thoughtspace:quadrant/g)?.length,1);assert.equal(quadrantOverride(text),'q2');assert.equal(parse('- [ ] '+text)[0].title,'Read #工作');
});
test('Quadrant writeback retains completed status, CRLF and other content',()=>{
 const original='Before\r\n2. [x] Read 📅 2026-09-08\r\nAfter';const task=parse(original)[0];
 assert.equal(changeTask(original,task,{content:setTaskQuadrant(task.text,'q3')}),'Before\r\n2. [x] Read 📅 2026-09-08 <!-- thoughtspace:quadrant=q3 -->\r\nAfter');
});
test('Invalid quadrants cannot be written',()=>{assert.throws(()=>setTaskQuadrant('Read','q5' as never));});
