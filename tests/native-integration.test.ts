import{test}from'node:test';import assert from'node:assert/strict';import{normalizeNativeTags,suggestedNoteName}from'../src/native-tags';
test('Native tag input strips hashes and accepts Chinese nested tags',()=>assert.deepEqual(normalizeNativeTags('#研究/阅读，#bridge/native test-tag'),['研究/阅读','bridge/native','test-tag']));
test('Empty input clears property tags and duplicate tags collapse',()=>{assert.deepEqual(normalizeNativeTags('   '),[]);assert.deepEqual(normalizeNativeTags('topic topic TOPIC'),['TOPIC']);});
test('Invalid tags are rejected before touching notes',()=>{for(const value of ['12345','tag.name','a//b','a/','a:b','a#b'])assert.throws(()=>normalizeNativeTags(value));});
test('Text conversion suggests a filename without changing body',()=>{assert.equal(suggestedNoteName('\n# 我的笔记\n\n正文'),'我的笔记');assert.equal(suggestedNoteName(''), '未命名笔记');});
