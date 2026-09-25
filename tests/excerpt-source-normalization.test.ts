import test from 'node:test';
import assert from 'node:assert/strict';
import {excerptPresentation,textExcerptPresentation} from '../src/excerpt-sources';

for(const [name,present] of [['note',excerptPresentation],['text',textExcerptPresentation]] as const){
 test(`${name} source-free presentation preserves content and only normalizes CRLF`,()=>{
  for(const raw of ['', '\r\n', '正文\r\n第二行\n\r末尾\r', '🐈\r\n\u2028\u2029', '---\r\ntitle: Test\r\n---\r\n# 正文\r\n', '```md\r\ncode\r\n```\r\n', '来源: [[example]]\r\n> Source: example']){
   let callbacks=0;assert.deepEqual(present(raw,()=>callbacks++),{body:raw.replace(/\r\n/g,'\n'),sources:[]},JSON.stringify(raw));assert.equal(callbacks,0);
  }
 });
 test(`${name} misleading citation markers keep their original parsing behavior`,()=>{
  const citation='来源：[[paper.pdf]] · PDF 第 2 页';
  for(const raw of ['普通来源：说明', '`'+citation+'`', '```md\r\n'+citation+'\r\n```', '---\nexample: '+citation+'\n---', '    '+citation, '> 来源：[[invalid.pdf]] · PDF 第 0 页', '来源：[[book]] · 第 0–3 行']){
   let callbacks=0;assert.deepEqual(present(raw,()=>callbacks++),{body:raw.replace(/\r\n/g,'\n'),sources:[]});assert.equal(callbacks,0);
  }
 });
}

test('multiple citation kinds preserve extraction order, source line numbers and text-tail ownership',()=>{
 const raw='正文\r\n\r\n来源：[原文](note.md) · 第 2–4 行\r\n\r\n> 来源：[[paper.pdf]] · PDF 第 3 页\r\n\r\n> 来源：[[other.pdf]] · PDF 第 8–9 页\r\n';
 for(const present of [excerptPresentation,textExcerptPresentation]){
  const seen:{line:number;link:string;tail?:boolean}[]=[];const output=present(raw,(line,source,tail?:boolean)=>seen.push({line,link:source.link,tail}));
  assert.deepEqual(output.sources.map(source=>source.link),['[原文](note.md)','[[paper.pdf]]','[[other.pdf]]']);assert.deepEqual(seen.map(source=>source.line),[2,4,6]);assert.equal(output.body.includes('来源：'),false);
  assert.deepEqual(seen.map(source=>source.tail),present===textExcerptPresentation?[undefined,true,true]:[undefined,undefined,undefined]);
 }
});
