import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownRows} from '../src/markdown-context';
import {selectionNoteTitle} from '../src/selection-note';
import {editorMatches} from '../src/editor-search';

function newlineSplits(run:()=>void){
 const split=String.prototype.split;let count=0;
 String.prototype.split=function(separator:unknown,limit?:number){if(separator==='\n')count++;return Reflect.apply(split,this,[separator,limit]) as string[];};
 try{run();}finally{String.prototype.split=split;}return count;
}
function searchInputs(query:string,run:()=>void){
 const exec=RegExp.prototype.exec;const lengths:number[]=[];
 RegExp.prototype.exec=function(value:string){if(this.source===query&&this.global)lengths.push(value.length);return Reflect.apply(exec,this,[value]) as RegExpExecArray|null;};
 try{run();}finally{RegExp.prototype.exec=exec;}return lengths;
}
const options={caseSensitive:false,wholeWord:false};

test('partial Markdown context reads do not materialize a long source line array',()=>{
 const text='First concept\n'+'Unvisited tail\r\n'.repeat(40000);
 const count=newlineSplits(()=>{const rows=markdownRows(text);assert.equal(rows.next().value?.visible,'First concept');rows.return();});
 assert.equal(count,0,'consuming the first row must not split the entire source');
});

test('concept eligibility walks only the needed rows without repeated source splitting',()=>{
 const text='Intro\r\n- context\r\n  Target\r\n'+'Unvisited tail\n'.repeat(40000),start=text.indexOf('Target');
 assert.equal(newlineSplits(()=>assert.equal(selectionNoteTitle({text,start,end:start+6}),'Target')),0);
});

test('source iteration retains empty last rows, CRLF and frontmatter closure rules',()=>{
 for(const text of ['', '\n', 'a\r\nb\n', '---\nname: a\n---\nbody', '---\r\nname: a\r\n...\r\nbody', '---\nname: a\nmissing']){
  const rows=[...markdownRows(text)];assert.deepEqual(rows.map(row=>row.source),text.split('\n'));assert.deepEqual(rows.map(row=>row.line),rows.map((_,i)=>i));
  if(text.includes('body'))assert.deepEqual(rows.map(row=>row.code),[true,true,true,false]);
  if(text.includes('missing'))assert(rows.every(row=>!row.code));
 }
});

test('bounded concept parsing keeps top-level fences, comments and UTF-16 source positions',()=>{
 for(const text of ['---\ntitle: Target\n---\nbody','```markdown\n> Target\n```','~~~\nTarget\n~~~~','> ```\n> Target\n> ```','<!--\nTarget\n-->','%%\nTarget\n%%']){
  const start=text.indexOf('Target');assert.throws(()=>selectionNoteTitle({text,start,end:start+6}));
 }
 for(const text of ['😀 Intro\r\nTarget\r\nlast','```\n> fenced\n```\nTarget','---\ntitle: Target\nno close','- context\n  Target','<!-- hidden --> Target']){
  const start=text.indexOf('Target');assert.equal(selectionNoteTitle({text,start,end:start+6}),'Target');
 }
});

test('selected-range literal search cannot scan the unselected document tail',()=>{
 const query='needle-Ω',text='prefix selected text\n'+'tail '.repeat(300000)+query,to=20;
 const lengths=searchInputs(query,()=>assert.deepEqual(editorMatches(text,query,{...options,range:{from:7,to}}),[]));
 assert.ok(lengths.length>0);assert.ok(lengths.every(length=>length<=to+1),`search input lengths: ${lengths}`);
});

test('scoped search keeps matches, metacharacters and boundaries in original coordinates',()=>{
 const text='😀 a.*\r\nCat cats 猫cat cat. tail',from=text.indexOf('a.*'),to=text.indexOf(' tail');
 assert.deepEqual(editorMatches(text,'a.*',{...options,range:{from,to}}),[{from,to:from+3}]);
 const expected=[text.indexOf('Cat'),text.lastIndexOf('cat.')].map(from=>({from,to:from+3}));
 assert.deepEqual(editorMatches(text,'cat',{...options,wholeWord:true,range:{from,to}}),expected);
 assert.deepEqual(editorMatches('xcaty tail','cat',{...options,wholeWord:true,range:{from:1,to:4}}),[]);
});

test('range ends inside surrogate pairs do not manufacture a literal match',()=>{
 assert.deepEqual(editorMatches('😀 tail','\ud83d',{...options,range:{from:0,to:1}}),[]);
 assert.deepEqual(editorMatches('\ud83d tail','\ud83d',{...options,range:{from:0,to:1}}),[{from:0,to:1}]);
 assert.deepEqual(editorMatches('😀 tail','😀',{...options,range:{from:0,to:1}}),[]);
});

test('range starts inside surrogate pairs never return a match before the selection',()=>{
 assert.deepEqual(editorMatches('😀 😀','😀',{...options,range:{from:1,to:5}}),[{from:3,to:5}]);
 assert.deepEqual(editorMatches('𐐀 𐐨','𐐨',{...options,range:{from:1,to:5}}),[{from:3,to:5}]);
});

test('empty selected ranges keep validation and return without searching the document',()=>{
 assert.deepEqual(searchInputs('target',()=>assert.deepEqual(editorMatches('target tail','target',{...options,range:{from:2,to:2}}),[])),[]);
 assert.throws(()=>editorMatches('target','',{...options,range:{from:0,to:10}}),/查找范围/);
});
