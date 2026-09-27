import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownEdit,markdownActive} from '../src/markdown-edit';
import {inlineCodeRanges} from '../src/markdown-literals';

test('numbered task conversion removes the checkbox when choosing ordinary bullets or numbering',()=>{
 for(const checked of [' ','x','X']){
  const text=`1. [${checked}] 任务`;
  assert.equal(markdownEdit(text,0,text.length,'bullet').text,'- 任务');
  assert.equal(markdownEdit(text,0,text.length,'ordered').text,'1. 任务');
 }
 const mixed='1. [x] 完成\n2. 正文';
 assert.equal(markdownEdit(mixed,0,mixed.length,'task').text,'- [ ] 完成\n- [ ] 正文');
});

test('escaped closing emphasis stays literal when formatting, clearing or reading toolbar state',()=>{
 for(const [command,mark] of [['bold','**'],['italic','*'],['strike','~~'],['highlight','==']] as const){
  const text=mark+'literal\\'+mark;
  const result=markdownEdit(text,0,text.length,command);
  assert.equal(result.text.slice(result.start,result.end),text,command+' must not strip an escaped closer');
  const bodyStart=mark.length,bodyEnd=text.length-mark.length;
  assert.equal(markdownActive(text,bodyStart,bodyEnd).has(command),false);
  assert.equal(markdownEdit(text,bodyStart,bodyEnd,'clear').text,text);
 }
 for(const mark of ['__','_']){
  const text=mark+'literal\\'+mark;
  assert.equal(markdownActive(text,mark.length,text.length-mark.length).has(mark==='__'?'bold':'italic'),false);
 }
 const code='`literal\\`';assert.equal(markdownActive(code,1,code.length-1).has('code'),true,'backslashes stay literal inside code');
});

test('frontmatter with whitespace after its closing delimiter remains protected',()=>{
 for(const ending of ['---  ','...\t'])for(const eol of ['\n','\r\n']){
  const text=['---','title: 重点',ending,'正文'].join(eol),start=text.indexOf('重点');
  assert.equal(markdownEdit(text,start,start+2,'bold').text,text);
  const body=text.indexOf('正文');assert.equal(markdownEdit(text,body,body+2,'bold').text,text.slice(0,body)+'**正文**');
 }
});

test('empty frontmatter ends at its first delimiter and cannot protect later body text by mistake',()=>{
 for(const closing of ['---','...','---  ','...\t'])for(const eol of ['\n','\r\n']){
  const text=['---',closing,'# A','','Evidence A','','... ','Tail A'].join(eol),start=text.indexOf('Evidence A');
  assert.equal(markdownEdit(text,start,start+10,'bold').text,text.slice(0,start)+'**Evidence A**'+text.slice(start+10));
  const delimiter=text.indexOf(closing,eol.length+3);
  assert.equal(markdownEdit(text,delimiter,delimiter+3,'bold').text,text,'the empty frontmatter delimiter stays protected');
 }
 const unclosed='---\ntitle: unfinished\nBody';
 assert.equal(markdownEdit(unclosed,4,9,'bold').text,'---\n**title**: unfinished\nBody','an unclosed block retains the existing editing behavior');
});

test('unmatched backticks in separate paragraphs cannot delete paragraph breaks when clearing formatting',()=>{
 for(const gap of ['\n\n','\r\n \t\r\n']){
  const text='`first'+gap+'second`';
  assert.deepEqual(inlineCodeRanges(text),[]);
  assert.equal(markdownEdit(text,0,text.length,'clear').text,text);
  assert.equal(markdownEdit(text,1,text.length-1,'clear').text,text);
 }
 assert.deepEqual(inlineCodeRanges('`first\nsecond`'),[{from:0,to:14}]);
});
