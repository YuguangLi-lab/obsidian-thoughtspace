import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markdownActive} from '../src/markdown-edit';
test('block hints do not inherit the following line through blank whitespace',()=>{
 for(const blank of ['', '  ', '\t', '\r', '\u00a0', '\ufeff'])for(const body of ['## 标题','- [x] 任务','1. 有序','> 引用']){
  const text=blank+'\n'+body;assert.equal(markdownActive(text,0,0).size,0,JSON.stringify(text));
 }
});
test('heading and task hints preserve long and Unicode indentation',()=>{
 for(const indent of [' '.repeat(3000),'\u00a0\t\u2003\ufeff','\u2028\u2029']){
  assert.ok(markdownActive(indent+'###### 标题',indent.length,indent.length).has('h6'));
  assert.ok(markdownActive(indent+'- [X] 任务',indent.length,indent.length).has('task'));
 }
});
test('list hints distinguish bullets, numbering and complete task markers',()=>{
 for(const marker of ['- ','+ ','* ']){assert.ok(markdownActive(marker+'正文',2,2).has('bullet'));const task=markdownActive(marker+'[x] 正文',6,6);assert.ok(task.has('task'));assert.ok(!task.has('bullet'));}
 for(const marker of ['1. ','12) ','12345678901234567890. '])assert.ok(markdownActive(marker+'正文',0,0).has('ordered'));
 for(const text of ['1.正文','-正文','123 正文','> - [x] 任务'])assert.ok(!markdownActive(text,0,0).has('ordered')&&!markdownActive(text,0,0).has('task'));
});
test('long line tails do not change local heading, list or emphasis hints',()=>{
 const tail='正文🙂'.repeat(200000);
 for(const prefix of ['###### ','- [ ] ','1. ','> ','**重点** ']){
  assert.deepEqual([...markdownActive(prefix+tail,0,0)],[...markdownActive(prefix+'尾部',0,0)]);
 }
});
