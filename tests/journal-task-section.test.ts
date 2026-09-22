import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {appendJournalTask} from '../src/calendar-tools';

test('Calendar capture fills the diary template checkbox instead of the reading section',()=>{
 const prefix='# 2026-09-08\n\n## 今日想法\n\n想法保留\n\n## 今日任务\n\n';
 const suffix='\n\n## 阅读与关联\n\n- [ ] 原有任务\n\n<!-- thoughtspace:created-notes:start -->\n## 当日新建笔记\n- [[资料]]\n<!-- thoughtspace:created-notes:end -->\n';
 assert.equal(appendJournalTask(prefix+'- [ ] '+suffix,' 新建待办 '),prefix+'- [ ] 新建待办'+suffix);
});
test('Further captures stay in daily tasks and preserve order and later sections',()=>{
 const text='## 今日任务\n\n- [x] 已完成\n- [ ] 已有待办\n\n## 阅读与关联\n原文\n';
 assert.equal(appendJournalTask(text,'第二项'),'## 今日任务\n\n- [x] 已完成\n- [ ] 已有待办\n- [ ] 第二项\n\n## 阅读与关联\n原文\n');
});
test('A missing daily-task section is inserted before reading without rewriting user text',()=>{
 const before='---\ntags: [日记]\n---\n\n# 日记\n\n## 今日想法\n内容  \n\n',after='## 阅读与关联\n[[资料]]\n';
 assert.equal(appendJournalTask(before+after,'检查'),before+'## 今日任务\n\n- [ ] 检查\n\n'+after);
});
test('CRLF and a heading at end of file are supported',()=>{
 assert.equal(appendJournalTask('## 今日任务\r\n\r\n- [ ] \r\n\r\n## 阅读与关联\r\n','任务'),'## 今日任务\r\n\r\n- [ ] 任务\r\n\r\n## 阅读与关联\r\n');
 assert.equal(appendJournalTask('## 今日任务','任务'),'## 今日任务\n\n- [ ] 任务\n');
});
test('Code, comments and frontmatter cannot impersonate the task section',()=>{
 const prefix='---\nexample: |\n  ## 今日任务\n---\n\n```md\n## 今日任务\n- [ ] \n```\n\n<!--\n## 今日任务\n-->\n\n';
 const text=prefix+'## 今日任务\n\n~~~md\n## 不是段落边界\n~~~\n\n## 阅读与关联\n';
 const result=appendJournalTask(text,'真实任务');
 assert.ok(result.startsWith(prefix+'## 今日任务\n\n~~~md\n## 不是段落边界\n~~~\n\n- [ ] 真实任务\n\n## 阅读与关联\n'));
});
test('Unclosed code or comments never silently swallow a new task',()=>{
 for(const text of ['```md\n## 今日任务\n','## 今日任务\n\n<!-- 未闭合','---\ntitle: 日记'])assert.throws(()=>appendJournalTask(text,'任务'),/未闭合/);
});
