import test from 'node:test';import assert from 'node:assert/strict';import {noteFragments,fragmentMatches} from '../src/note-fragments';
const pos=(start:number,end:number)=>({start:{offset:start},end:{offset:end}});
test('native headings and block anchors retain order and bounded previews',()=>{const text='# Topic\nEvidence\n\nA block ^id-1';const parts=noteFragments(text,{headings:[{heading:'Topic',position:pos(0,7)}],blocks:{'id-1':{id:'id-1',position:pos(18,text.length)}}});assert.deepEqual(parts.map(p=>p.subpath),['#Topic','#^id-1']);assert.match(parts[0].preview,/Evidence/);});
test('duplicate or unsafe headings are not offered as ambiguous targets',()=>{assert.deepEqual(noteFragments('# A\n# A',{headings:[{heading:'A',position:pos(0,3)},{heading:'A',position:pos(4,7)},{heading:'A|B',position:pos(0,3)}]}),[]);});
test('invalid metadata positions and block ids are rejected',()=>{assert.deepEqual(noteFragments('hello',{headings:[{heading:'X',position:pos(0,99)}],blocks:{x:{id:'a/b',position:pos(0,3)},y:{id:'y',position:pos(-1,3)}}}),[]);});
test('missing metadata and empty note produce no synthetic anchors',()=>{assert.deepEqual(noteFragments('',null),[]);assert.deepEqual(noteFragments('# X'),[]);});
test('large paragraphs have bounded preview and query matches content',()=>{const p=noteFragments('# X\n'+'word '.repeat(10000),{headings:[{heading:'X',position:pos(0,3)}]})[0];assert.equal(p.preview.length,240);assert.ok(fragmentMatches(p,'x WORD'));assert.ok(!fragmentMatches(p,'notfound'));});

test('stale native metadata cannot invent missing anchors',()=>{assert.deepEqual(noteFragments('# New\nnew text',{headings:[{heading:'Old',position:pos(0,5)}],blocks:{old:{id:'old',position:pos(6,14)}}}),[]);});
