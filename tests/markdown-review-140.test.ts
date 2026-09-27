import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownEdit} from '../src/markdown-edit';
import {selectionNoteTitle} from '../src/selection-note';

test('clear formatting handles an indented paragraph continuation without treating it as block code',()=>{
 const text='Intro **bold**\n    continuation **bold**';
 assert.equal(markdownEdit(text,0,text.length,'clear').text,'Intro bold\n    continuation bold');
});

test('clear formatting still preserves a real indented code block separated from the paragraph',()=>{
 const text='Intro **bold**\n\n    literal **bold**';
 assert.equal(markdownEdit(text,0,text.length,'clear').text,'Intro bold\n\n    literal **bold**');
});

test('Markdown link titles may contain unmatched parentheses without exposing their destination to formatting',()=>{
 const text='[source](folder/a*b*c.md "Title (part one")';
 assert.equal(markdownEdit(text,0,text.length,'clear').text,text);
});

test('new-note extraction protects the destination of a Markdown link with an unmatched title parenthesis',()=>{
 const text='[source](folder/note.md "Title (part one")',start=text.indexOf('note.md');
 assert.throws(()=>selectionNoteTitle({text,start,end:start+7}),/链接/);
});

test('an unfinished link title cannot expose a later complete link destination to formatting',()=>{
 const text='[unfinished](note "unfinished title\n[good](real*file*.md)';
 assert.equal(markdownEdit(text,0,text.length,'clear').text,text);
});


test('clear formatting handles a selected tail of a multiline indented paragraph using preceding document context',()=>{
 const text='Intro **bold**\n    first **bold**\n\tsecond **bold**';
 const start=text.indexOf('first'),end=text.length;
 assert.equal(markdownEdit(text,start,end,'clear').text,'Intro **bold**\n    first bold\n\tsecond bold');
});

test('clear formatting distinguishes paragraph continuation from blocks after headings or fenced code',()=>{
 for(const prefix of ['# Heading','---','```\ncode\n```']){
  const text=prefix+'\n    literal **bold**';
  assert.equal(markdownEdit(text,text.indexOf('literal'),text.length,'clear').text,text);
 }
});

test('clear formatting preserves CRLF while clearing indented paragraph continuation',()=>{
 const text='Intro **bold**\r\n    continuation **bold**';
 assert.equal(markdownEdit(text,0,text.length,'clear').text,'Intro bold\r\n    continuation bold');
});

test('angle-delimited Markdown destinations protect unbalanced literal parentheses',()=>{
 const text='[source](<folder/part(one.md>)',start=text.indexOf('one.md');
 assert.throws(()=>selectionNoteTitle({text,start,end:start+6}),/链接/);
 const styled='[source](<folder/a*b*c(one.md>)';assert.equal(markdownEdit(styled,0,styled.length,'clear').text,styled);
});

test('unfinished link title and angle containers cannot hide a later complete link',()=>{
 for(const unfinished of ['[unfinished](note "unfinished title','[unfinished](<unfinished']){
  const text=unfinished+'\n[good](real*file*.md)',start=text.indexOf('real');
  assert.equal(markdownEdit(text,0,text.length,'clear').text,text);
  assert.throws(()=>selectionNoteTitle({text,start,end:start+4}),/链接/);
 }
});
