import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownRows} from '../src/markdown-context';
import {writingWordCount} from '../src/writing';
import {fragmentMatches,fragmentSearchSelection,type NoteFragment} from '../src/note-fragments';

test('long hidden comments preserve offsets without allocating a per-character mask array',()=>{
 const text='before <!--'+'隐藏😀'.repeat(30000)+'--> after',split=String.prototype.split;let slots=0;
 String.prototype.split=function(separator:unknown,limit?:number){const out=Reflect.apply(split,this,[separator,limit]) as string[];if(separator==='')slots+=out.length;return out;};
 try{const row=markdownRows(text).next().value!;assert.equal(row.visible,'before '+' '.repeat(text.length-13)+' after');assert.equal(row.visible.length,text.length);}finally{String.prototype.split=split;}
 assert.equal(slots,0);
});

test('possible comment markers inside code or escapes retain the unchanged source',()=>{
 for(const text of ['prefix `<!-- literal -->` suffix','`` %% literal %% ``',String.raw`before \<!-- escaped --> after`,String.raw`before \%% escaped \%% after`])assert.equal(markdownRows(text).next().value!.visible,text);
});

test('multiple and multiline comment masks retain source columns and parser state',()=>{
 const text='😀 <!--a--> text %%b%% end\r\n<!--\r\n😀 hidden\r\n--> visible\r\n> ```\r\n> %% literal %%\r\n> ```',rows=[...markdownRows(text)];
 assert.equal(rows[0].visible,'😀 '+' '.repeat(8)+' text '+' '.repeat(5)+' end');
 assert.equal(rows[2].visible,' '.repeat('😀 hidden'.length));assert.equal(rows[3].visible,'    visible');assert.equal(rows[3].commentBefore,true);
 assert.deepEqual(rows.slice(4).map(r=>r.code),[true,true,true]);assert.deepEqual(rows.map(r=>r.source),text.split('\n'));
});

test('writing word count does not create a spaced copy of the complete CJK manuscript',()=>{
 const text='AI写作2026かなカナ '.repeat(20000),replace=String.prototype.replace;let addedCharacters=0;
 String.prototype.replace=function(pattern:unknown,replacement:unknown){const out=Reflect.apply(replace,this,[pattern,replacement]) as string;if(pattern instanceof RegExp&&pattern.source.includes('Script=Han'))addedCharacters+=out.length-this.length;return out;};
 try{assert.equal(writingWordCount(text),8*20000);}finally{String.prototype.replace=replace;}
 assert.equal(addedCharacters,0);
});

test('writing word estimates retain supplementary CJK, combining marks and mixed runs',()=>{
 for(const [text,count]of [['',0],['AI写作2026',4],['かなカナ',4],['😀 𰻞 𐐀𐐨',2],['a\u0301b',2],['hello_world 2026.5',4],['مرحبا १२३ русский',3],['中文、English12かな',5]] as const)assert.equal(writingWordCount(text),count,text);
});

function normalizations(run:()=>void){const lower=String.prototype.toLocaleLowerCase;let calls=0;String.prototype.toLocaleLowerCase=function(...args:Parameters<typeof lower>){calls++;return Reflect.apply(lower,this,args) as string;};try{run();}finally{String.prototype.toLocaleLowerCase=lower;}return calls;}
const fragments=():NoteFragment[]=>Array.from({length:2000},(_,i)=>({subpath:'#'+i,title:'Alpha Beta',kind:'heading',preview:'Gamma Delta'}));

test('fragment selection compiles the query once and stops once the current match is confirmed',()=>{
 const parts=fragments(),saved=structuredClone(parts),calls=normalizations(()=>assert.deepEqual(fragmentSearchSelection(parts,'ALPHA beta gamma delta','#2'),{subpath:'#2',empty:false}));
 assert.ok(calls<=4,`observed ${calls} normalizations for an existing third result`);assert.deepEqual(parts,saved);
});

test('fragment selection fallback normalizes only the query and each candidate once',()=>{
 const parts=fragments(),calls=normalizations(()=>assert.deepEqual(fragmentSearchSelection(parts,'ALPHA beta gamma delta','#missing'),{subpath:'#0',empty:false}));assert.ok(calls<=parts.length+1,`observed ${calls} normalizations`);
});

test('fragment choice keeps blank queries, empty results, Unicode and fresh source ordering',()=>{
 const parts:NoteFragment[]=[{subpath:'#first',title:'É 猫',kind:'heading',preview:'😀 Alpha'},{subpath:'#second',title:'ALPHA',kind:'block',preview:'猫'}];
 assert.equal(fragmentMatches(parts[0],'é 😀'),true);assert.equal(fragmentMatches(parts[0],'absent'),false);assert.deepEqual(fragmentSearchSelection(parts,' \n ','#unknown'),{subpath:'#unknown',empty:false});
 assert.deepEqual(fragmentSearchSelection(parts,'alpha 猫','#second'),{subpath:'#second',empty:false});parts[1].preview='other';assert.deepEqual(fragmentSearchSelection(parts,'alpha 猫','#second'),{subpath:'#first',empty:false});
 parts.reverse();assert.deepEqual(fragmentSearchSelection(parts,'alpha','#missing'),{subpath:'#second',empty:false});assert.deepEqual(fragmentSearchSelection(parts,'missing','#first'),{subpath:'',empty:true});
});
