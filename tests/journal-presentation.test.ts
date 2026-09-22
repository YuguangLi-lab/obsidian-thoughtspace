import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journalPresentation} from '../src/journal-presentation';
import {CREATED_START as A,CREATED_END as B} from '../src/journal-links-model';
test('Presentation isolates managed links and preserves user text exactly',()=>{const before='# 日记\n\n手写内容\n',after='\n\n后续想法\n',text=before+A+'\n## 当日新建笔记\n\n- [[笔记]]\n'+B+after;assert.deepEqual(journalPresentation(text),{body:before+after,links:'- [[笔记]]'});});
test('User-authored section with the same title remains in body',()=>{const text='## 当日新建笔记\n\n自定义列表';assert.deepEqual(journalPresentation(text),{body:text,links:undefined});});
test('Broken or duplicate index markers are never silently removed',()=>{for(const text of [A+'x',B+'x',B+A,A+'x'+A+B,A+'x'+B+B])assert.deepEqual(journalPresentation(text),{body:text,links:undefined});});
test('Managed links retain Markdown and CRLF content',()=>{assert.equal(journalPresentation(A+'\r\n## 当日新建笔记\r\n\r\n- [报告](a%20b.md)\r\n- [[原文|名称]]\r\n'+B).links,'- [报告](a%20b.md)\r\n- [[原文|名称]]');});
