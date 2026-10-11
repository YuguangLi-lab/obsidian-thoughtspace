import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {discardWritingRecovery,rememberWritingRecovery,writingRecoveryEntries} from '../src/writing-draft-recovery';

test('concurrent failed writing windows retain independent snapshots and saving one cannot remove another',()=>{
 const host={},file={},first=rememberWritingRecovery(host,file,'Draft','first window'),second=rememberWritingRecovery(host,file,'Draft','second window');
 assert.equal(rememberWritingRecovery(host,file,'Draft','first window'),first);assert.equal(writingRecoveryEntries(host,file).length,2);
 discardWritingRecovery(host,file,first.id);assert.deepEqual(writingRecoveryEntries(host,file),[second]);assert.deepEqual(writingRecoveryEntries({},file),[]);assert.deepEqual(writingRecoveryEntries(host,{}),[]);
});

test('peer manuscript updates never replace text or native selection during composition',()=>{
 const source=readFileSync('src/writing-view.ts','utf8'),start=source.indexOf(' private syncManuscript('),end=source.indexOf('\n private async insertMaterial(',start);
 const View=new Function(transformSync('class View{'+source.slice(start,end)+'};return View',{loader:'ts'}).code)();
 const value={text:'peer body'},input={value:'baseline',selectionStart:2,selectionEnd:4,setSelectionRange(a:number,b:number){this.selectionStart=a;this.selectionEnd=b;}};
 const view=Object.assign(new View(),{manuscriptInput:input,manuscriptBaseline:'baseline',composing:true,state:()=>({manuscript:value.text})});view.syncManuscript();assert.equal(input.value,'baseline');assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,4);
 input.value='baseline 中文输入';view.composing=false;view.syncManuscript();assert.equal(input.value,'baseline 中文输入');assert.equal(view.manuscriptBaseline,'baseline');
 input.value='baseline';view.syncManuscript();assert.equal(input.value,'peer body');assert.equal(view.manuscriptBaseline,'peer body');assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,4);
});
