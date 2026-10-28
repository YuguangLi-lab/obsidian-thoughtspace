import test from 'node:test';
import assert from 'node:assert/strict';
import {cardInsertChange,cardInsertMarkdown,cardInsertRanges} from '../src/card-insert-model';
test('card insertion excludes YAML and separates links, embeds, body and titled copies',()=>{
 const raw='---\nprivate: keep-at-source\n---\n# Material\n\n正文 [[link]]\n',ranges=cardInsertRanges(raw,'Material',null),range=ranges[0],body=raw.slice(range.from,range.to);
 assert.ok(!body.includes('private:'));assert.equal(cardInsertMarkdown('link',range,body,'[[Material]]'),'[[Material]]');assert.equal(cardInsertMarkdown('embed',range,body,'[[Material]]'),'![[Material]]');assert.equal(cardInsertMarkdown('body',range,body,''),'正文 [[link]]');assert.equal(cardInsertMarkdown('title-body',range,body,''),'## Material\n\n正文 [[link]]');assert.equal(raw.includes('private: keep-at-source'),true);
});
test('trusted chapter range includes children but excludes next sibling and duplicate anchors',()=>{
 const raw='## One\nA\n### Child\nB\n## Two\nC\n',heads=[['One',2,0,6],['Child',3,9,18],['Two',2,21,27]].map(([heading,level,start,end])=>({heading:heading as string,level:level as number,position:{start:{offset:start as number},end:{offset:end as number}}}));const ranges=cardInsertRanges(raw,'File',{headings:heads}),one=ranges.find(r=>r.subpath==='#One');assert.ok(one);assert.equal(raw.slice(one.from,one.to),'## One\nA\n### Child\nB\n');assert.equal(cardInsertMarkdown('title-body',one,raw.slice(one.from,one.to),'x'),'## One\n\nA\n### Child\nB');
 const dup='## Same\nA\n## Same\nB\n',cache={headings:[{heading:'Same',level:2,position:{start:{offset:0},end:{offset:7}}},{heading:'Same',level:2,position:{start:{offset:10},end:{offset:17}}}]};assert.equal(cardInsertRanges(dup,'F',cache).length,1);
});
test('drop changes retain the exact start, middle or end, and reject invalid ranges and excessive text',()=>{
 const before='开始\n中间\n末尾';for(const at of [0,4,before.length]){const change=cardInsertChange(before,at,'资料');assert.equal(change.from,at);assert.equal(change.to,at);const after=before.slice(0,at)+change.insert+before.slice(at);assert.equal(after.slice(0,at)+after.slice(at+change.insert.length),before);}
 for(const p of [-1,NaN,99,.5])assert.throws(()=>cardInsertChange(before,p,'x'));assert.throws(()=>cardInsertRanges('x'.repeat(500001),'x',null));
});
