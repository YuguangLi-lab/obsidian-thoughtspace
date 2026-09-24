import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowsReadOnlyKey,isSimpleTopicContinuation} from '../src/inline-editor-keys';
const key=(key:string,mods={})=>allowsReadOnlyKey({key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...mods});
test('pending writes allow copy and select-all on both desktop shortcut conventions',()=>{for(const mod of ['metaKey','ctrlKey'])for(const value of ['a','A','c','C'])assert.equal(key(value,{[mod]:true}),true);assert.equal(key('Insert',{ctrlKey:true}),true);});
test('pending writes allow keyboard selection and toolbar traversal',()=>{for(const value of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Tab'])for(const shiftKey of [false,true])assert.equal(key(value,{shiftKey}),true);});
test('pending writes keep mutating and alternative commands blocked',()=>{for(const value of ['v','x','z','y','b','i','Enter','Backspace','Delete','Escape'])for(const mods of [{},{ctrlKey:true},{metaKey:true}])assert.equal(key(value,mods),false,value);assert.equal(key('Insert',{shiftKey:true}),false);assert.equal(key('c',{metaKey:true,shiftKey:true}),false);assert.equal(key('a',{metaKey:true,altKey:true}),false);});

test('simple one-line topics continue only with a single caret at the end',()=>{
 for(const value of ['', '研究问题', '普通题目 1.2'])assert.equal(isSimpleTopicContinuation(value,value.length,value.length),true);
 assert.equal(isSimpleTopicContinuation('研究问题',2,2),false);
 assert.equal(isSimpleTopicContinuation('研究问题',0,4),false);
 assert.equal(isSimpleTopicContinuation('研究问题',4,4,2),false);
});
test('Markdown block and partial syntax keep native Enter and Tab',()=>{
 for(const value of ['# 标题','> 引文','- 任务','+ 列表','1. 第一点','1) 第一点','- [ ] 任务','    缩进代码','```','~~~','| 名称 | 值 |','名称 | 值','$x^2$','$$','\\[x^2\\]','**强调**','[[内部链接]]','<!--注释-->','---'])assert.equal(isSimpleTopicContinuation(value,value.length,value.length),false,value);
});
test('all multiline documents including blank final lines retain native editing',()=>{
 for(const value of ['第一行\n第二行','| 项目 |\n| --- |\n| 值 |','$$\nx^2\n$$','```js\na();\n```','- 一\n- 二\n','正文\n','标题\r正文'])assert.equal(isSimpleTopicContinuation(value,value.length,value.length),false,value);
});
