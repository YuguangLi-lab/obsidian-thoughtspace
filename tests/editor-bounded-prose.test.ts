import test from 'node:test';
import assert from 'node:assert/strict';
import {planMarkdownEdit} from '../src/markdown-edit';
import {boardSearchIndex,searchExcerpt,type BoardSearchEntry} from '../src/board-search';
import {emptyBoard} from '../src/model';

test('clearing malformed link prose retains valid nested links, escapes and exact change ranges',()=>{
 const selected='[unfinished]( **clear** [safe](a(b)c) [escaped](a\\)b) [broken]( __also__',text='Prefix '+selected+' suffix',from=7,to=from+selected.length;
 const result=planMarkdownEdit(text,from,to,'clear'),expected='[unfinished]( clear [safe](a(b)c) [escaped](a\\)b) [broken]( also';
 assert.deepEqual(result,{text:'Prefix '+expected+' suffix',start:from,end:from+expected.length,change:{from,to,text:expected}});
});
test('clearing repeated unclosed destinations leaves code, URLs and balanced destinations intact',()=>{
 const prefix='[open]( '.repeat(3000),body=prefix+'**clear** `**literal**` https://example.test/**protected** [safe](a(b)c)',result=planMarkdownEdit(body,0,body.length,'clear');
 assert.equal(result.text,prefix+'clear **literal** https://example.test/**protected** [safe](a(b)c)');
});
test('long escaped destinations keep link content unchanged when clearing nearby prose',()=>{
 for(const n of [20000,20001]){const link='[link](target'+'\\'.repeat(n)+')',body=link+' **bold**';assert.equal(planMarkdownEdit(body,0,body.length,'clear').text,link+' bold');}
});

test('indexing long text titles consumes the first nonempty line without splitting the remaining body',t=>{
 const text='\r\n \n  第一行 😀\r\n'+'continuation\n'.repeat(20000),b=emptyBoard();b.version=3;b.nodes=[{id:'text',kind:'text',text,x:0,y:0,width:120,height:80,color:'sand'}];let splitCharacters=0;const split=String.prototype.split;
 const mock=t.mock.method(String.prototype,'split',function(this:string,...args:Parameters<typeof split>){if(String(this)===text)splitCharacters+=this.length;return Reflect.apply(split,this,args);});
 const entries=boardSearchIndex(b);mock.mock.restore();assert.equal(entries[0].title,'  第一行 😀');assert.equal(entries[0].body,text);assert.equal(splitCharacters,0);
});
const entry=(body:string)=>({body} as BoardSearchEntry);
test('empty-query excerpts normalize only a bounded prefix of long note bodies',t=>{
 const body='First paragraph 😀 with words\n'.repeat(30000);let processed=0;const replace=String.prototype.replace;
 const mock=t.mock.method(String.prototype,'replace',function(this:string,...args:Parameters<typeof replace>){if(args[0] instanceof RegExp&&args[0].source==='\\s+')processed+=this.length;return Reflect.apply(replace,this,args);});
 const result=searchExcerpt(entry(body),' \t ');mock.mock.restore();assert.equal(result,body.replace(/\s+/g,' ').trim().slice(0,140)+'…');assert(processed<=512,`normalized ${processed} characters`);
});
test('empty excerpts retain whitespace trimming, UTF-16 slices and exact ellipsis behavior',()=>{
 for(const body of ['', ' \r\n\u2003 ', '\t abc  def\r\n ', '  '+ 'x'.repeat(256)+'\r\n y', 'prefix\n'+' '.repeat(100000), ' '.repeat(100000)+'end', '😀'.repeat(300)])for(const limit of [0,1,3,140,256,500]){
  const normalized=body.replace(/\s+/g,' ').trim();assert.equal(searchExcerpt(entry(body),'',limit),normalized.slice(0,limit)+(normalized.length>limit?'…':''));
 }
 const body='before '.repeat(100)+'Needle after';assert(searchExcerpt(entry(body),'needle').includes('Needle'));
});
