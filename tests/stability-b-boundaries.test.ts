import test from 'node:test';import assert from 'node:assert/strict';
import {extractTasks,toggleTask} from '../src/model';
import {planTasks,changeTask,taskMatches} from '../src/task-planner-model';
import {journalRecords} from '../src/day-timeline-model';
import {setTaskQuadrant} from '../src/task-quadrants';
import {markdownEdit} from '../src/markdown-edit';
import {markdownPreview} from '../src/rendering';
import {syncCreatedNotes,CREATED_START as S,CREATED_END as E} from '../src/journal-links-model';
const plan=(s:string)=>planTasks(s,'Notes.md','Daily');
test('HTML and Obsidian comments are hidden; literal delimiters in code do not hide following prose',()=>{
 for(const [open,close] of [['<!--','-->'],['%%','%%']]){
  const text=`${open}\r\n- [ ] hidden\r\n- 09:00 hidden\r\n${close}\r\n- [ ] visible\r\n- 10:00 visible`;
  assert.deepEqual(extractTasks(text).map(t=>[t.line,t.text]),[[4,'visible']]);assert.deepEqual(journalRecords(text,'d').map(r=>r.title),['visible']);
  assert.equal(extractTasks('`'+open+'`\n- [ ] yes').length,1);
  assert.equal(extractTasks('```\n'+open+'\n```\n- [ ] yes').length,1);
 }
});
test('nested callout writes preserve prefixes, block IDs, CRLF and unrelated checkbox text',()=>{
 let text='> [!todo]\r\n> > 1. [ ] task `09:00 code` ^ref-id\r\n- [ ] other';let task=plan(text)[0];
 assert.equal(task.line,1);text=changeTask(text,task,{scheduled:'2026-09-11',priority:1,time:{start:'10:30'}});
 assert.match(text,/> > 1\. \[ \] 10:30 task `09:00 code` ⏳ 2026-09-11 ⏫ \^ref-id\r\n/);
 task=plan(text)[0];text=changeTask(text,task,{content:setTaskQuadrant(task.text,'q2')});assert.match(text,/quadrant=q2 --> \^ref-id\r\n/);
 task=plan(text)[0];text=toggleTask(text,task);assert.match(text,/> > 1\. \[x\]/);assert.ok(text.endsWith('- [ ] other'));
 assert.throws(()=>changeTask(text,task,{checked:true}),/变化/);
});
test('all task actions preserve the original block anchor even when content is replaced',()=>{
 for(const change of [{due:'2026-09-11'},{scheduled:'2026-09-11'},{priority:1},{checked:true},{content:'renamed'},{time:{start:'12:00'}}]){
  const text='- [ ] old ^anchor';assert.match(changeTask(text,plan(text)[0],change),/ \^anchor$/);
 }
 assert.equal(setTaskQuadrant('item <!-- thoughtspace:quadrant=q1 --> ^anchor','auto'),'item ^anchor');
});
test('explicit completion date overrides other dates; old tasks fall back to schedule or diary',()=>{
 const task=plan('- [x] done 📅 2026-09-09 ✅ 2026-09-10')[0];assert.equal(taskMatches(task,'2026-09-09','done'),false);assert.equal(taskMatches(task,'2026-09-10','done'),true);
 assert.equal(taskMatches(plan('- [x] done ✅ 2026-02-30 📅 2026-09-10')[0],'2026-09-10','done'),true);
 assert.equal(taskMatches(plan('- [x] literal `✅ 2026-09-09` 📅 2026-09-10')[0],'2026-09-10','done'),true);
 assert.equal(taskMatches(planTasks('- [x] old','Daily/2026-09-10.md','Daily')[0],'2026-09-10','done'),true);
});
test('clear preserves identifiers, escaped markers, paths and code contents',()=>{
 for(const text of ['snake_case_field','中文_变量_名称','path/to_file_name.md',String.raw`\_literal\_`,String.raw`\*literal\*`,'https://site/a_b_c','[[a_b_c]]','[a_b_c](a_b_c.md)'])assert.equal(markdownEdit(text,0,text.length,'clear').text,text);
 const s='snake_case_field';assert.equal(markdownEdit(s,6,10,'clear').text,s);
 for(const [input,out] of [['_em_','em'],['__strong__','strong'],['**snake_case_field**','snake_case_field'],['``a`b_c``','a`b_c']])assert.equal(markdownEdit(input,0,input.length,'clear').text,out);
});
test('code toggle is inverse for generated delimiter lengths, padding and selected body',()=>{
 for(const text of ['a`b','`literal`','a``b',' foo ','   ','中文`a`']){
  const out=markdownEdit(text,0,text.length,'code');
  assert.equal(markdownEdit(out.text,0,out.text.length,'code').text,text);
  assert.equal(markdownEdit(out.text,out.start,out.end,'code').text,text);
 }
});
test('preview preserves a long first paragraph and does not bisect an emoji; clipped fences close',()=>{
 assert.match(markdownPreview('😀'.repeat(9000),16001),/^😀/);assert.equal(/[\uD800-\uDBFF]\n/.test(markdownPreview('😀'.repeat(9000),16001)),false);
 const p=markdownPreview('```md\n```js\n'+('long\n'.repeat(5000)),100);assert.match(p,/\n```\n\n…/);
});
test('managed marker examples in literal contexts survive; only a top-level pair is replaced',()=>{
 const sample=S+'\nsample\n'+E;
 for(const prefix of ['```md\n'+sample+'\n```','    '+sample.replace(/\n/g,'\n    '),'> '+sample.replace(/\n/g,'\n> '),'`'+S+'`','before `example\n'+sample+'\nend`','%%\n'+sample+'\n%%','---\nexample: |\n  '+sample.replace(/\n/g,'\n  ')+'\n---']){
  const actual=syncCreatedNotes(prefix,['one.md']);assert.ok(actual.startsWith(prefix));assert.equal(syncCreatedNotes(actual,['one.md']),actual);
 }
 const original='```md\n'+sample+'\n```\n\n'+S+'\nold\n'+E+'\nTAIL';const out=syncCreatedNotes(original,['new.md']);assert.ok(out.startsWith('```md\n'+sample+'\n```'));assert.ok(out.endsWith('\nTAIL'));assert.ok(!out.includes('\nold\n'));
 assert.throws(()=>syncCreatedNotes(S+'\ntext',['a.md']));
});
test('unpaired leading rule leaves tasks and records visible; paired properties and nested fences remain excluded',()=>{
 assert.equal(extractTasks('---\n- [ ] real').length,1);assert.equal(journalRecords('---\r\n- 10:00 real','d').length,1);
 assert.equal(journalRecords('---\ntitle: x\n---\n- 10:00 real','d').length,1);
 assert.deepEqual(extractTasks('> ```text\n> ```js\n> - [ ] hidden\n> ```\n> - [ ] real').map(t=>t.text),['real']);
});
test('ordered lists maintain independent counters and restart each new child list across CRLF and tabs',()=>{
 const text='a\r\n\tb\r\n\tc\r\nd\r\n\te';assert.equal(markdownEdit(text,0,text.length,'ordered').text,'1. a\r\n\t1. b\r\n\t2. c\r\n2. d\r\n\t1. e');
 const blank='a\n\nb';assert.equal(markdownEdit(blank,0,blank.length,'ordered').text,'1. a\n\n2. b');
});
