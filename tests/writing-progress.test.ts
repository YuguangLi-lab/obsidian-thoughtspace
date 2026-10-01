import test from 'node:test';
import assert from 'node:assert/strict';
import {manuscriptSections,pruneWritingCompleted,writingAssemblyStamp} from '../src/writing-progress';
import {emptyBoard,parseBoard,clone,Card} from '../src/model';
import {writingReferenceMarkdown,writingReferenceRanges} from '../src/writing-reference';

test('manuscript directory reads actual headings with exact CRLF and unicode offsets',()=>{
 const text='---\r\nx: heading\r\n---\r\n# 文章\r\n中文 abc\r\n\r\n## 重复\r\n证据\r\n\r\n## 重复\r\nOther\r\n';const s=manuscriptSections(text);assert.deepEqual(s.map(s=>s.title),['文章','重复','重复']);assert.equal(s[0].words,3);assert.equal(s[1].from,text.indexOf('## 重复'));assert.notEqual(s[1].key,s[2].key);
});
test('directory ignores fenced, indented, quoted, list-nested and commented headings; handles Setext',()=>{
 const text='# Main\n\n```md\n# code\n```\n    # indented\n> # quote\n- list\n  ## nested\n\n<!--\n# hidden\n-->\n%% # secret %%\n\nSection\n=======\nbody\n\nSub\n---\n';assert.deepEqual(manuscriptSections(text).map(s=>s.title),['Main','Section','Sub']);
});
test('completion follows unique sections across reorder and resets on change, rename or deletion',()=>{
 const a='## A\nAlpha\n\n',b='## B\nBeta\n\n',keys=manuscriptSections(a+b).map(s=>s.key);assert.deepEqual(pruneWritingCompleted(b+a,keys),keys);assert.deepEqual(pruneWritingCompleted(a.replace('Alpha','Changed')+b,keys),[keys[1]]);assert.deepEqual(pruneWritingCompleted(a.replace('## A','## Rename')+b,keys),[keys[1]]);assert.deepEqual(pruneWritingCompleted(b,keys),[keys[1]]);
});
test('identical duplicate headings and body have separate status, ambiguous duplicate removal resets',()=>{
 const a='## Same\nContent\n\n',s=manuscriptSections(a+a);assert.notEqual(s[0].key,s[1].key);assert.deepEqual(pruneWritingCompleted(a,[s[1].key]),[]);
});
const node=(id:string,text=id):Card=>({id,kind:'text',text,x:0,y:0,width:100,height:100,color:'sand'});
test('assembly stamp ignores manuscript/navigation/layout but detects semantic order/options/material changes',()=>{
 const b=emptyBoard();b.nodes=[node('a'),node('b')];b.writing={title:'Title',order:['a','b']};const stamp=writingAssemblyStamp(b);b.viewport.x=500;b.nodes[0].x=123;b.writing.manuscript='my rewrite';b.writing.referenceId='b';b.writing.completedSections=[];assert.equal(writingAssemblyStamp(b),stamp);
 for(const change of [(v:typeof b)=>v.writing!.order.reverse(),(v:typeof b)=>v.writing!.options={a:{excluded:true}},(v:typeof b)=>v.writing!.options={a:{level:3}},(v:typeof b)=>v.writing!.options={a:{note:'new'}},(v:typeof b)=>v.nodes[0].text='new']){const v=clone(b);change(v);assert.notEqual(writingAssemblyStamp(v),stamp);}
});
test('writing metadata survives round trip and rejects malformed progress',()=>{
 const b=emptyBoard();b.writing={title:'A',order:[],manuscript:'# A\n正文',assemblyStamp:writingAssemblyStamp(b),completedSections:manuscriptSections('# A\n正文').map(s=>s.key)};assert.deepEqual(parseBoard(JSON.stringify(b)),b);
 for(const patch of [{assemblyStamp:7},{assemblyStamp:'bad'},{completedSections:['bad']},{completedSections:[b.writing.completedSections![0],b.writing.completedSections![0]]}])assert.throws(()=>parseBoard(JSON.stringify({...b,writing:{...b.writing,...patch}})));
});
test('reference ranges reuse native unique anchors and exact paragraph offsets without inventing anchors',()=>{
 const raw='# Topic\n\nParagraph [[note]]\n\nSecond ^block\n';const cache={headings:[{heading:'Topic',level:1,position:{start:{offset:0},end:{offset:7}}}],blocks:{block:{id:'block',position:{start:{offset:raw.indexOf('Second')},end:{offset:raw.length-1}}}}};const ranges=writingReferenceRanges(raw,cache);assert.equal(ranges[0].subpath,'#Topic');assert.equal(raw.slice(ranges[1].from,ranges[1].to),'Second ^block');assert.ok(ranges.some(r=>!r.subpath&&raw.slice(r.from,r.to)==='Paragraph [[note]]'));
});
test('quoted selection is static with line citation; embeds require an existing anchor; links keep supplied identity',()=>{
 const raw='first\r\n中文\r\nlast',range={label:'selection',from:raw.indexOf('中文'),to:raw.indexOf('中文')+2},link='[[folder/source#^id]]';assert.match(writingReferenceMarkdown('quote',raw,range,link,'中文'),/^> 中文\n\n来源：\[\[folder\/source#\^id\]\] · 第 2–2 行（静态摘录）$/);assert.throws(()=>writingReferenceMarkdown('embed',raw,range,link,'中文'));assert.equal(writingReferenceMarkdown('embed',raw,{...range,subpath:'#^id'},link,'中文'),'!'+link);assert.equal(writingReferenceMarkdown('link',raw,range,link,'中文'),link);
});
test('duplicate headings cannot silently become an ambiguous embedded reference',()=>{
 const raw='# Same\nA\n# Same\nB',cache={headings:[{heading:'Same',level:1,position:{start:{offset:0},end:{offset:6}}},{heading:'Same',level:1,position:{start:{offset:9},end:{offset:15}}}]};assert.ok(writingReferenceRanges(raw,cache).every(r=>!r.subpath));
});

test('multiline underlined paragraphs remain body text, matching native Obsidian headings',()=>{
 const text='# Main\r\n\r\nFirst line\r\n中文 second line\r\n---\r\nBody\r\n';const sections=manuscriptSections(text);assert.deepEqual(sections.map(s=>s.title),['Main']);
});
test('single-line Setext headings start after paragraph and thematic boundaries',()=>{
 const text='# Main\n\n---\nFirst\nSecond\n===\n\n***\nNext\n---\n';const sections=manuscriptSections(text);assert.deepEqual(sections.map(s=>s.title),['Main','Next']);assert.equal(sections[1].from,text.indexOf('Next'));
});
