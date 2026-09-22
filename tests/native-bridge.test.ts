import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeRelations,boardNotePaths,nativeIndex} from '../src/native-bridge';
import {emptyBoard} from '../src/model';
test('native relations distinguish incoming and outgoing and exclude self',()=>{
 const r=nativeRelations('a.md',{'a.md':{'a.md':1,'b.md':2},'c.md':{'a.md':1}}, {},new Set(['a.md','b.md','c.md']));assert.deepEqual(r,{incoming:['c.md'],outgoing:['b.md'],unresolved:[]});
});
test('relations exclude stale and backup paths',()=>{
 assert.deepEqual(nativeRelations('a.md',{'a.md':{'missing.md':1,'ThoughtSpace-plugin-backups/b.md':1}}, {},new Set(['a.md','ThoughtSpace-plugin-backups/b.md'])).outgoing,[]);
});
test('only positive unresolved references are reported',()=>{assert.deepEqual(nativeRelations('a',{}, {a:{z:2,b:0,c:1}},new Set()).unresolved,['c','z']);});
test('missing metadata produces empty relation lists',()=>{assert.deepEqual(nativeRelations('x',{}, {},new Set()),{incoming:[],outgoing:[],unresolved:[]});});
test('board note index deduplicates references but excludes images and text',()=>{
 const b=emptyBoard();b.nodes=[{kind:'card',file:'a.md'},{kind:'card',file:'a.md'},{kind:'image',file:'b.png'},{kind:'text',file:'c.md'},{kind:'board',file:'child.thoughtspace'},{kind:'card',file:'z.md'}] as typeof b.nodes;
 assert.deepEqual(boardNotePaths(b),['a.md','z.md']);
});
test('native index keeps generated links and source intact',()=>{const links=['[[甲]]','[乙](../乙.md)'];const r=nativeIndex('研究','[[研究.thoughtspace]]',links,[]);assert.ok(r.includes('- [[甲]]\n- [乙](../乙.md)'));assert.ok(r.includes('[[研究.thoughtspace]]'));assert.deepEqual(links,['[[甲]]','[乙](../乙.md)']);});
test('empty board index has an explicit empty state',()=>{assert.ok(nativeIndex('空','[[空.thoughtspace]]',[],[]).includes('尚无有效笔记引用'));});
test('missing file names cannot inject unintended wikilinks',()=>{const s=nativeIndex('[[标题]]','[[board.thoughtspace]]',[],['[[Missing]]\n# x']);assert.ok(!s.includes('[[Missing]]'));assert.ok(!s.includes('\n# x'));assert.ok(s.includes('未找到的文件'));});
test('more than a thousand native references survive export',()=>{const links=Array.from({length:1200},(_,i)=>`[[材料${i}]]`);assert.equal(nativeIndex('大白板','[[大.thoughtspace]]',links,[]).split('\n').filter(l=>l.startsWith('- [[')).length,1200);});
