import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as literals from '../src/markdown-literals';
import {markdownRows} from '../src/markdown-context';
import {editorMatches} from '../src/editor-search';

function countRows(text:string){
 let codeScans=0,characterArrays=0;const module={exports:{} as {markdownRows:typeof markdownRows}};
 new Function('require','module','exports',transformSync(readFileSync('src/markdown-context.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({...literals,inlineCodeRanges:(value:string)=>{codeScans++;return literals.inlineCodeRanges(value);}}),module,module.exports);
 const split=String.prototype.split;
 String.prototype.split=function(separator:any,limit?:number){if(separator==='')characterArrays++;return Reflect.apply(split,this,[separator,limit]);};
 try{return{rows:[...module.exports.markdownRows(text)],counts:()=>({codeScans,characterArrays})};}finally{String.prototype.split=split;}
}

test('source lines without possible comments need no inline-code scan or character masking array',()=>{
 const text='Ordinary words 😀 with `inline code` and **formatting**\r\n'.repeat(1000),f=countRows(text);
 assert.deepEqual(f.counts(),{codeScans:0,characterArrays:0});assert.equal(f.rows.length,1001);
 assert(f.rows.slice(0,-1).every(row=>row.visible==='Ordinary words 😀 with `inline code` and **formatting**'&&!row.code&&!row.commentBefore&&row.topLevel));
});

test('active HTML and percent comments still mask ordinary continuation lines and resume visible parsing',()=>{
 for(const [open,close]of [['<!--','-->'],['%%','%%']]){
  const text=`before ${open}hidden\nordinary 😀 content\n${close} after\nplain`,rows=[...markdownRows(text)];
  assert.equal(rows[0].visible,'before '+' '.repeat(open.length+6));assert.equal(rows[1].visible,' '.repeat('ordinary 😀 content'.length));assert.equal(rows[2].visible,' '.repeat(close.length)+' after');assert.equal(rows[3].visible,'plain');
  assert.deepEqual(rows.map(row=>row.commentBefore),[false,true,true,false]);assert.deepEqual(rows.map(row=>'openBlock'in row&&row.openBlock),[true,true,false,false]);
 }
});

test('potential comment markers inside code and odd escapes still use literal protection',()=>{
 for(const text of ['`<!-- literal -->` tail','`` %% literal %% ``','\\<!-- escaped','\\%% escaped'])assert.equal([...markdownRows(text)][0].visible,text);
 const rows=[...markdownRows('```md\n<!-- literal\n```\nplain')];assert.deepEqual(rows.map(row=>row.code),[true,true,true,false]);assert.equal(rows[3].visible,'plain');assert.equal(rows[3].commentBefore,false);
});

test('the shortcut preserves nested-list and quoted-fence metadata and CRLF sources',()=>{
 const text='- parent\r\n  - child\r\n    continuation\r\n> ```md\r\n> literal\r\n> ```\r\nplain';
 const rows=[...markdownRows(text)];assert.deepEqual(rows.map(row=>row.source),text.split('\n'));assert.deepEqual(rows.map(row=>row.code),[false,false,false,true,true,true,false]);assert.equal(rows.at(-1)!.visible,'plain');
});

function countBoundaries(run:()=>unknown){const from=Array.from;let calls=0;Array.from=function(...args:unknown[]){calls++;return Reflect.apply(from,Array,args);} as typeof Array.from;try{return{result:run(),calls:()=>calls};}finally{Array.from=from;}}
test('ordinary literal search skips Unicode word-boundary allocations for every result',()=>{
 const text='alpha 猫😀 alpha.\n'.repeat(3000),options={wholeWord:false,caseSensitive:false},f=countBoundaries(()=>editorMatches(text,'alpha',options));
 assert.equal(f.calls(),0);const matches=f.result as {from:number;to:number}[];assert.equal(matches.length,6000);assert(matches.every(match=>text.slice(match.from,match.to)==='alpha'));assert.deepEqual(options,{wholeWord:false,caseSensitive:false});
});

test('whole-word search keeps neighboring Unicode checks outside a selected range',()=>{
 const text='😀alpha 猫alpha alpha\u0301 alpha.',options={wholeWord:true,caseSensitive:false,range:{from:2,to:text.length}},before=JSON.stringify(options);
 const f=countBoundaries(()=>editorMatches(text,'alpha',options));assert.equal(f.calls(),0);assert.deepEqual(f.result,[{from:2,to:7},{from:22,to:27}]);assert.equal(JSON.stringify(options),before);
 assert.deepEqual(editorMatches('xalpha y','alpha',{wholeWord:true,caseSensitive:true,range:{from:1,to:6}}),[]);
});

test('range validation and match limits preserve errors before exposing partial search output',()=>{
 assert.throws(()=>editorMatches('alpha','alpha',{wholeWord:false,caseSensitive:true,range:{from:1,to:9}}),/查找范围已变化/);
 for(const wholeWord of [false,true])assert.throws(()=>editorMatches('alpha '.repeat(10001),'alpha',{wholeWord,caseSensitive:false}),/10,000/);
 assert.deepEqual(editorMatches('alpha','',{wholeWord:false,caseSensitive:false}),[]);
});
