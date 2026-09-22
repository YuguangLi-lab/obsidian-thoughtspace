/** Original B01–B11 audit reproductions, retained as regression coverage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {extractTasks} from '../src/model';
import {planTasks,changeTask,taskMatches} from '../src/task-planner-model';
import {setTaskQuadrant} from '../src/task-quadrants';
import {journalRecords} from '../src/day-timeline-model';
import {markdownEdit} from '../src/markdown-edit';
import {markdownPreview} from '../src/rendering';
import {syncCreatedNotes,CREATED_START,CREATED_END} from '../src/journal-links-model';
test('B01 hidden comments must not create actionable tasks or timeline records',()=>{
 assert.deepEqual({tasks:extractTasks('<!--\n- [ ] hidden\n-->\n- [ ] real').map(t=>t.text),records:journalRecords('<!--\n- 09:00 hidden\n-->\n- 10:00 real','D.md').map(t=>t.title)},{tasks:['real'],records:['real']});
});
test('B02 native callout checkboxes must appear in task index',()=>{assert.deepEqual(extractTasks('> [!todo]\n> - [ ] real').map(t=>t.text),['real']);});
test('B03 date and quadrant changes must retain the native block anchor',()=>{
 const raw='- [ ] 发布报告 ^task-123',task=planTasks(raw,'T.md','Daily')[0];
 assert.deepEqual({date:/\^task-123$/.test(changeTask(raw,task,{due:'2026-09-11'})),quadrant:/\^task-123$/.test(changeTask(raw,task,{content:setTaskQuadrant(task.text,'q1')}))},{date:true,quadrant:true});
});
test('B04 completed-today must use the explicit completion date',()=>{const t=planTasks('- [x] 完成报告 📅 2026-09-09 ✅ 2026-09-10','T.md','Daily')[0];assert.equal(taskMatches(t,'2026-09-10','done'),true);});
test('B05 clear formatting must preserve literal intraword underscores',()=>{const t='snake_case_field';assert.equal(markdownEdit(t,0,t.length,'clear').text,t);});
test('B06 toggling a generated multi-backtick code span must remove its whole delimiter',()=>{
 const original='a`b',wrapped=markdownEdit(original,0,original.length,'code').text;assert.equal(wrapped,'``a`b``');assert.equal(markdownEdit(wrapped,0,wrapped.length,'code').text,original);
});
test('B07 preview truncation must retain a long first paragraph',()=>{assert.equal(markdownPreview('a'.repeat(16001)).startsWith('a'.repeat(100)),true);});
test('B08 a language-bearing backtick line is not a closing fence',()=>{assert.deepEqual(extractTasks('```text\n```js\n- [ ] fake\n```'),[]);});
test('B09 created-note sync must not overwrite literal markers in a fenced example',()=>{
 const original='```md\n'+CREATED_START+'\n用户在示例中保留的文字\n'+CREATED_END+'\n```';assert.equal(syncCreatedNotes(original,['New.md']).startsWith(original),true);
});
test('B10 a horizontal rule must not suppress subsequent timeline entries',()=>{assert.deepEqual(journalRecords('---\n- 10:00 real','D.md').map(t=>t.title),['real']);});
test('B11 ordered conversion must restart numbering for the nested list',()=>{const text='a\n    b\nc';assert.equal(markdownEdit(text,0,text.length,'ordered').text,'1. a\n    1. b\n2. c');});
