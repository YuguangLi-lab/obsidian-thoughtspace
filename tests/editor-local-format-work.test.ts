import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as literals from '../src/markdown-literals';
import * as context from '../src/markdown-context';
import {planMarkdownEdit,type MarkdownCommand} from '../src/markdown-edit';
import {editorMatches,editorReplacement} from '../src/editor-search';

function formatting(){
 const scans:number[]=[],module={exports:{} as {planMarkdownEdit:typeof planMarkdownEdit}};
 new Function('require','module','exports',transformSync(readFileSync('src/markdown-edit.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='./markdown-literals'?{...literals,inlineCodeRanges:(text:string)=>{scans.push(text.length);return literals.inlineCodeRanges(text);}}:context,module,module.exports);
 return{plan:module.exports.planMarkdownEdit,scans};
}

test('formatting a plain phrase as code does not parse unrelated code spans in the complete note',()=>{
 const f=formatting(),text='chosen\n'+'`tail` material\n'.repeat(30000),result=f.plan(text,0,6,'code');
 assert.deepEqual(result.change,{from:0,to:6,text:'`chosen`'});assert.equal(result.text,'`chosen`'+text.slice(6));
 assert.equal(f.scans.reduce((sum,n)=>sum+n,0),0);
});

test('clearing a short prose selection parses selected literals without rescanning the full note',()=>{
 const f=formatting(),text='**chosen**\n'+'`tail` material\n'.repeat(30000),result=f.plan(text,2,8,'clear');
 assert.deepEqual(result.change,{from:0,to:10,text:'chosen'});assert.equal(result.text,'chosen'+text.slice(10));
 assert.deepEqual(f.scans,[6]);
});

test('code toggles and clear formatting still recognize complete, inner, and padded multi-tick selections',()=>{
 for(const [body,from,to] of [['`word`',0,6],['`word`',1,5],['`` `word` ``',3,9],['`` `word` ``',2,10],['`   `',1,4],['`\nword\n`',1,7]] as const){
  const f=formatting(),text='before '+body+' after',result=f.plan(text,7+from,7+to,'code');
  assert.equal(result.change?.from,7);assert.equal(result.change?.to,7+body.length);assert.equal(result.change?.text,body==='`   `'?'   ':body.includes('``')?'`word`':'word');
  assert.ok(f.scans.includes(text.length),'eligible code needs the real full context');
 }
 for(const [body,from,to] of [['`word`',1,5],['`` `word` ``',3,9],['`   `',1,4]] as const){const text='before '+body+' after';assert.equal(planMarkdownEdit(text,7+from,7+to,'clear').text,'before '+(body==='`   `'?'   ':body.includes('``')?'`word`':'word')+' after');}
});

test('code eligibility keeps greedy outer spans, escaping, and partial selections unchanged',()=>{
 const source='`` earlier `target` later ``',from=source.indexOf('target');
 assert.equal(planMarkdownEdit(source,from,from+6,'code').text,'`` earlier ``target`` later ``');
 assert.equal(planMarkdownEdit(source,from,from+6,'clear').text,'`` earlier target later ``');
 const escaped='\\`target`';assert.equal(planMarkdownEdit(escaped,2,8,'code').text,'\\``target``');
 assert.equal(planMarkdownEdit('`word`',2,4,'code').text,'`w`or`d`');
});

test('inline Markdown and color commands do not inspect the whole note to choose a newline style',t=>{
 const text='chosen\n'+'ordinary body\n'.repeat(30000)+'tail\r\n',includes=String.prototype.includes;let inspected=0;
 const mock=t.mock.method(String.prototype,'includes',function(this:string,...args:Parameters<typeof includes>){if(String(this)===text&&args[0]==='\r\n')inspected+=this.length;return Reflect.apply(includes,this,args);});
 const commands:(MarkdownCommand|{color:string;background?:boolean})[]=['bold','italic','strike','highlight','code','link','image','wikilink','underline','sup','sub','clear','comment','math',{color:'#123456'},{color:'#abcdef',background:true}];
 const results=commands.map(command=>planMarkdownEdit(text,0,6,command));mock.mock.restore();
 assert.ok(results.every(result=>result.change&&result.text.endsWith(text.slice(6))));assert.equal(inspected,0);
});

test('block commands still inherit CRLF from outside the selected text and preserve YAML protection',()=>{
 const text='one\ntwo\r\nlast';
 assert.equal(planMarkdownEdit(text,0,3,'bullet').change?.text,'- one');
 assert.equal(planMarkdownEdit(text,0,7,'ordered').change?.text,'1. one\r\n2. two');
 assert.equal(planMarkdownEdit(text,0,3,'codeblock').change?.text,'```\r\none\r\n```\r\n\r\n');
 assert.equal(planMarkdownEdit(text,0,7,'indent').change?.text,'    one\r\n    two');
 assert.equal(planMarkdownEdit('---\r\ntitle: chosen\r\n---\r\nbody',12,18,'code').change,undefined);
});

test('whole-word literal search avoids temporary Unicode arrays for every potential match',t=>{
 const text='😀word 𐐀word word\u0301 word.\n'.repeat(1500),from=Array.from;let arrays=0;
 const mock=t.mock.method(Array,'from',function(...args:unknown[]){arrays++;return Reflect.apply(from,Array,args);});
 const matches=editorMatches(text,'word',{wholeWord:true,caseSensitive:false});mock.mock.restore();
 assert.equal(matches.length,3000);assert.ok(matches.every(match=>text.slice(match.from,match.to)==='word'));assert.equal(arrays,0);
});

test('whole-word search sees astral letters and combining marks beyond selected range boundaries',()=>{
 const o={wholeWord:true,caseSensitive:false};
 for(const value of ['𐐀','\u0301','猫','_','7']){assert.deepEqual(editorMatches(value+'word','word',{...o,range:{from:value.length,to:value.length+4}}),[]);assert.deepEqual(editorMatches('word'+value,'word',{...o,range:{from:0,to:4}}),[]);}
 for(const value of ['😀','\ud800','\udfff',' ']){assert.deepEqual(editorMatches(value+'word'+value,'word',o),[{from:value.length,to:value.length+4}]);}
 assert.deepEqual(editorMatches('word\nword','word',o),[{from:0,to:4},{from:5,to:9}]);
});

test('replacement validation accumulates length changes without rereading every range a second time',t=>{
 const text='aa '.repeat(1000);let reads=0;
 const matches=Array.from({length:1000},(_,i)=>({get from(){reads++;return i*3;},get to(){reads++;return i*3+2;}}));
 const result=editorReplacement(text,matches,'z')!;const count=reads;
 assert.equal(text.slice(0,result.from)+result.text+text.slice(result.to),'z '.repeat(1000));assert.equal(result.delta,-1000);assert.equal(result.count,1000);
 t.diagnostic(`replacement: ${count} range coordinate reads`);assert.ok(count<=11000,`read ${count} coordinates`);
});

test('replacement validates all ranges before size errors and retains literal replacement text',()=>{
 const text='a'.repeat(2000000);assert.throws(()=>editorReplacement(text,[{from:0,to:1},{from:2,to:2}],'xx'),/匹配范围无效/);
 assert.throws(()=>editorReplacement(text,[{from:0,to:1}],'xx'),/替换后内容超过/);
 assert.deepEqual(editorReplacement('a gap b',[{from:0,to:1},{from:6,to:7}],'$&'),{from:0,to:7,text:'$& gap $&',delta:2,count:2});
 assert.equal(editorReplacement('unchanged',[],'x'),undefined);
});
