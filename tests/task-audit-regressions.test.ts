import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeTask,planTasks,selectTasks} from '../src/task-planner-model';
const parse=(text:string)=>planTasks(text,'Diary/2026-09-08.md','Diary');
test('completing an older task records actual completion day for the done filter',()=>{
 const raw='- [ ] Old task ⏳ 2026-09-08 ^keep';
 const next=changeTask(raw,parse(raw)[0],{checked:true,completedOn:'2026-09-10'});
 assert.equal(parse(next)[0].completedOn,'2026-09-10');
 assert.equal(selectTasks(parse(next),'2026-09-10','done').length,1);
 assert.match(next,/\^keep$/);
});
test('task metadata inside hidden comments never schedules, prioritizes or tags the task',()=>{
 for(const comment of ['<!-- 09:30 📅 2026-09-10 ⏫ #hidden 🔁 every day -->','%% 09:30 📅 2026-09-10 ⏫ #hidden 🔁 every day %%']){
  const t=parse('- [ ] Visible task '+comment)[0];
  assert.equal(t.time,undefined);assert.equal(t.due,undefined);assert.equal(t.priority,3);assert.deepEqual(t.tags,[]);assert.equal(t.recurring,false);
 }
});
test('task date and priority edits preserve hidden comment source exactly',()=>{
 for(const comment of ['<!-- archived 📅 2026-09-08 ⏫ -->','%% archived 📅 2026-09-08 ⏫ %%']){
  const raw='- [ ] Visible '+comment+' 📅 2026-09-09 ⏫ ^keep';
  const next=changeTask(raw,parse(raw)[0],{due:'2026-09-10',priority:3});
  assert.ok(next.includes(comment));assert.match(next,/📅 2026-09-10 \^keep$/);
 }
});
test('time edits ignore hidden clocks and preserve comment and code examples',()=>{
 const raw='- [ ] 10:00 Work <!-- 08:00 secret --> %% 07:00 old %% `09:00 sample` ^keep';
 const next=changeTask(raw,parse(raw)[0],{time:{start:'11:00'}});
 assert.equal(next,'- [ ] 11:00 Work <!-- 08:00 secret --> %% 07:00 old %% `09:00 sample` ^keep');
 assert.equal(parse(next)[0].time,'11:00');
});
test('completion replacement and reopening preserve hidden examples and reject invalid dates',()=>{
 const raw='> - [x] Work `✅ 2026-09-01` <!-- ✅ 2026-09-02 --> ✅ 2026-09-03 ^keep\r\n';
 const next=changeTask(raw,parse(raw)[0],{checked:false});
 assert.equal(next,'> - [ ] Work `✅ 2026-09-01` <!-- ✅ 2026-09-02 --> ^keep\r\n');
 assert.throws(()=>changeTask(raw,parse(raw)[0],{completedOn:'2026-02-30'}),/日期无效/);
});
test('adding metadata before an unclosed comment remains visible without rewriting the comment',()=>{
 for(const token of ['<!--','%%']){
  const raw='- [ ] Work '+token+' hidden\nend '+(token==='<!--'?'-->':'%%');
  const next=changeTask(raw,parse(raw)[0],{due:'2026-09-10'});
  assert.equal(parse(next)[0].due,'2026-09-10');assert.ok(next.endsWith(token+' hidden\nend '+(token==='<!--'?'-->':'%%')));
 }
});
