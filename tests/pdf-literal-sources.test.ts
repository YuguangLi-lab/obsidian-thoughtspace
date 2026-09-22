import test from 'node:test';
import assert from 'node:assert/strict';
import {excerptNoteMarkdown,pdfLiteralText} from '../src/materials';
import {excerptPresentation} from '../src/excerpt-sources';
import {mergeTexts} from '../src/board-studio';
import {rebaseReuseSources} from '../src/board-reuse';
import {emptyBoard,Card} from '../src/model';
const citation='> 来源：[[paper.pdf#page=2]] · PDF 第 2 页';
for(const [name,body] of [['separator','---\n**literal**'],['backticks','```r\n- example'],['tildes','~~~\n# literal'],['HTML','<!--\n[example]']] as const){
 test(`PDF ${name} keeps literal text and source when converted`,()=>{
  assert.equal(excerptNoteMarkdown(body+'\n\n'+citation),pdfLiteralText(body)+'\n\n'+citation+'\n');
 });
 test(`PDF ${name} source rebases without changing literal body or CRLF`,()=>{
  const raw=body.replace(/\n/g,'\r\n')+'\r\n\r\n'+citation+'\r\n';
  assert.equal(rebaseReuseSources(raw,()=> '[[Library/paper.pdf#page=2]]'),raw.replace('[[paper.pdf#page=2]]','[[Library/paper.pdf#page=2]]'));
 });
}
test('merging literal PDF excerpts keeps both source footers after the body',()=>{
 const b=emptyBoard();b.nodes=['---\nfirst','```\nsecond'].map((text,i)=>({id:String(i),kind:'text',text:text+'\n\n'+citation.replaceAll('2',String(i+1)),x:0,y:i*100,width:200,height:80,color:'sand'} as Card));
 mergeTexts(b,new Set(['0','1']));
 assert.equal(b.nodes[0].text,'---\nfirst\n\n```\nsecond\n\n'+citation.replaceAll('2','1')+'\n\n'+citation);
});
test('ordinary Markdown frontmatter and unfinished code still retain citation samples',()=>{
 for(const prefix of ['---','```md','~~~']){const raw=prefix+'\n\n'+citation;assert.equal(excerptPresentation(raw).body,raw);assert.equal(excerptPresentation(raw).sources.length,0);}
});
test('literal conversion preserves citation samples inside a closed code block',()=>{
 const body='```md\n'+citation+'\n```';
 assert.equal(excerptNoteMarkdown(body+'\n\n'+citation),pdfLiteralText(body)+'\n\n'+citation+'\n');
});
