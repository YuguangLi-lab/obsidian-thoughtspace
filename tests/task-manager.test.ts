import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeTask,groupTasks,planTasks,restoreTaskLine,selectTasks} from '../src/task-planner-model';
const parse=(s:string,p='Notes/工作.md')=>planTasks(s,p,'Diary');
test('Completed history includes older tasks while selected-day completion stays scoped',()=>{
 const tasks=parse('- [x] older 📅 2026-09-01\n- [x] current 📅 2026-09-08\n- [ ] open');
 assert.equal(selectTasks(tasks,'2026-09-08','completed').length,2);
 assert.deepEqual(selectTasks(tasks,'2026-09-08','done').map(t=>t.title),['current']);
});
test('Grouping never loses or duplicates tasks and uses full source paths',()=>{
 const tasks=[...parse('- [ ] alpha ⏫ 📅 2026-09-08\n- [ ] beta'),...parse('- [ ] gamma 📅 2026-09-08','Other/工作.md')];
 for(const by of ['source','date','priority','none'] as const)assert.equal(groupTasks(tasks,by).flatMap(g=>g.tasks).length,3);
 assert.deepEqual(groupTasks(tasks,'source').map(g=>g.label),['Notes/工作.md','Other/工作.md']);
 assert.equal(groupTasks(tasks,'date').find(g=>g.label==='2026-09-08')?.tasks.length,2);
 assert.equal(groupTasks(tasks,'priority').find(g=>g.label==='高优先级')?.tasks[0].title,'alpha');
});
test('Task content editing preserves checklist syntax, CRLF, state and unrelated lines',()=>{
 const raw='Intro\r\n  2. [x] old #标签 📅 2026-09-08\r\nTail';const task=parse(raw)[0];
 assert.equal(changeTask(raw,task,{content:'new #研究 📅 2026-09-09'}),'Intro\r\n  2. [x] new #研究 📅 2026-09-09\r\nTail');
 assert.throws(()=>changeTask(raw,task,{content:'\n'}));assert.throws(()=>changeTask(raw,task,{content:'a\nb'}));
});
test('Undo restores only the edited task line and protects intervening changes',()=>{
 const raw='Intro\n- [ ] item\nTail',task=parse(raw)[0],updated=changeTask(raw,task,{checked:true});
 assert.equal(restoreTaskLine(updated+' edited',1,'- [x] item',task.source),raw+' edited');
 assert.throws(()=>restoreTaskLine('Intro\n- [x] externally edited\nTail',1,'- [x] item',task.source),/无法安全撤销/);
});
