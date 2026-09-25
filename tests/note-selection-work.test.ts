import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionNoteTitle,sameNoteSelection,type NoteSelection} from '../src/selection-note';
import {fragmentMatches,fragmentSearchSelection,type NoteFragment} from '../src/note-fragments';

const selection=(text:string,phrase:string):NoteSelection=>({text,start:text.indexOf(phrase),end:text.indexOf(phrase)+phrase.length});
function countRows(run:()=>void){const replace=String.prototype.replace;let count=0;
 String.prototype.replace=function(this:string,pattern:unknown,replacement:unknown){if(pattern instanceof RegExp&&pattern.source==='\\r$'&&this.startsWith('plain-row-'))count++;return Reflect.apply(replace,this,[pattern,replacement]) as string;};
 try{run();}finally{String.prototype.replace=replace;}return count;
}
function countNormalizations(run:()=>void){const lower=String.prototype.toLocaleLowerCase;let count=0;
 String.prototype.toLocaleLowerCase=function(this:string,...args:Parameters<typeof lower>){count++;return Reflect.apply(lower,this,args) as string;};
 try{run();}finally{String.prototype.toLocaleLowerCase=lower;}return count;
}

test('concept selection stops context parsing at its source row',()=>{
 const lines=Array.from({length:5000},(_,i)=>`plain-row-${i} ${i===0?'Target':i===2?'Second':'body'}`),text=lines.join('\n');
 assert.ok(countRows(()=>assert.equal(selectionNoteTitle(selection(text,'Target')),'Target'))<=1);
 assert.ok(countRows(()=>assert.equal(selectionNoteTitle(selection(text,'Second')),'Second'))<=3);
 assert.equal(selectionNoteTitle({text,start:text.lastIndexOf('body'),end:text.lastIndexOf('body')+4}),'body');
});

test('bounded context consumption retains full-document frontmatter lookahead and fence protection',()=>{
 for(const text of ['---\ntitle: Target\nother: value\n---\nbody','---\r\ntitle: Target\r\n...\r\nbody','```markdown\n> Target\n```','> ~~~~\n> Target\n> ~~~~','<!--\nTarget\n-->','%%\nTarget\n%%'])assert.throws(()=>selectionNoteTitle(selection(text,'Target')));
 for(const text of ['---\ntitle: Target\nno closing marker','```\ncode\n```\n😀 Target\r\nlast','<!-- hidden --> Target\nnext','- item\n  Target\nnext'])assert.equal(selectionNoteTitle(selection(text,'Target')),'Target');
});

test('selection eligibility is fresh and keeps read-only range and composition guards',()=>{
 const original=Object.freeze(selection('Target\nother','Target'));assert.equal(selectionNoteTitle(original),'Target');
 const changed=selection('`Target`\nother','Target');assert.throws(()=>selectionNoteTitle(changed));assert.equal(sameNoteSelection(original,changed),false);
 for(const disabledReason of ['组字中','多光标'])assert.throws(()=>selectionNoteTitle({...original,disabledReason}),new RegExp(disabledReason));
 assert.throws(()=>selectionNoteTitle({...original,end:100}),/请先选择/);assert.equal(selectionNoteTitle(original),'Target');
});

test('fragment search normalizes each candidate once for a multiword query',()=>{
 const parts:NoteFragment[]=Array.from({length:1000},(_,i)=>({subpath:'#'+i,title:'Alpha Beta',kind:'heading',preview:'Gamma Delta'})),saved=structuredClone(parts);
 const calls=countNormalizations(()=>assert.deepEqual(fragmentSearchSelection(parts,'ALPHA beta gamma delta','#17'),{subpath:'#17',empty:false}));
 assert.ok(calls<=2000,`at most one query and one candidate normalization per fragment; observed ${calls}`);assert.deepEqual(parts,saved);
});

test('blank fragment search preserves its selection without filtering candidates',()=>{
 const parts:NoteFragment[]=Array.from({length:1000},(_,i)=>({subpath:'#'+i,title:'Alpha',kind:'heading',preview:'Body'}));
 assert.equal(countNormalizations(()=>assert.deepEqual(fragmentSearchSelection(parts,' \t\r\n ','#not-in-list'),{subpath:'#not-in-list',empty:false})),0);
 assert.deepEqual(fragmentSearchSelection([],'',''),{subpath:'',empty:false});assert.deepEqual(fragmentSearchSelection([],'missing','#old'),{subpath:'',empty:true});
});

test('fragment matching preserves Unicode, result order and fresh same-anchor replacements',async()=>{
 const parts:NoteFragment[]=[{subpath:'#second',title:'😀 É Alpha',kind:'heading',preview:'Beta [literal]'}, {subpath:'#first',title:'ALPHA',kind:'block',preview:'beta'}];
 assert.equal(fragmentMatches(parts[0],'😀 é [literal]'),true);assert.equal(fragmentMatches(parts[0],'missing alpha'),false);
 assert.deepEqual(fragmentSearchSelection(parts,'alpha beta','#old'),{subpath:'#second',empty:false});assert.deepEqual(fragmentSearchSelection(parts,'alpha beta','#first'),{subpath:'#first',empty:false});
 await Promise.resolve();parts[0]={...parts[0],title:'Replacement',preview:''};assert.deepEqual(fragmentSearchSelection(parts,'alpha beta','#second'),{subpath:'#first',empty:false});
 parts.reverse();assert.deepEqual(fragmentSearchSelection(parts,'alpha','#old'),{subpath:'#first',empty:false});
});
