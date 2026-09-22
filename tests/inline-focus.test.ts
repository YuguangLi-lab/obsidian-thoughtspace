import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {planMarkdownEdit} from '../src/markdown-edit';
function fixture(){
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/inline-node-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='./markdown-edit'?{planMarkdownEdit}:{},module,module.exports);
 const e=Object.create(module.exports.InlineNodeEditor.prototype),state={focus:0,changes:0,undos:0,layout:0,feedback:'',onFocus:()=>{}};
 const input={value:'前重点后',selectionStart:1,selectionEnd:3,readOnly:false,ownerDocument:{activeElement:null},focus:()=>{state.focus++;state.onFocus();}};
 Object.assign(e,{input,options:{markdown:true},el:{contains:()=>false},feedback:(message:string)=>state.feedback=message,commandHint:{hidden:true},scheduleLayout:()=>state.layout++,native:{host:{contains:()=>false},replaceFormatted:(text:string,from:number,to:number,start:number,end:number)=>{state.changes++;input.value=input.value.slice(0,from)+text+input.value.slice(to);input.selectionStart=start;input.selectionEnd=end;},history:()=>state.undos++}});
 return{e,input,state};
}
test('inline formatting preserves input inserted while focusing',()=>{const {e,input,state}=fixture();state.onFocus=()=>{input.value='新前缀'+input.value;};e.format('bold');assert.equal(input.value,'新前缀前重点后');assert.equal(state.changes,0);});
test('inline formatting rejects equal-length replacement during focus',()=>{const {e,input,state}=fixture();state.onFocus=()=>{input.value='新内容后';};e.format('italic');assert.equal(input.value,'新内容后');assert.equal(state.changes,0);});
test('inline formatting does not use a selection changed by focus handlers',()=>{const {e,input,state}=fixture();state.onFocus=()=>{input.selectionStart=0;input.selectionEnd=1;};e.format('bold');assert.equal(input.value,'前重点后');assert.equal(state.changes,0);});
test('disposing or locking during focus prevents stale formatting and layout',()=>{for(const change of ['disposed','pending','composing']){const {e,state}=fixture();state.onFocus=()=>{e[change]=true;};e.format('bold');assert.equal(state.changes,0,change);assert.equal(state.layout,0,change);}});
test('inline history cannot undo newly arrived focus-time input',()=>{for(const redo of [false,true]){const {e,input,state}=fixture();state.onFocus=()=>{input.value+='新的输入';};e.history(redo);assert.equal(state.undos,0);assert.equal(input.value,'前重点后新的输入');}});
test('normal inline format stays one transaction and history stays native',()=>{const {e,input,state}=fixture();e.format('bold');assert.equal(input.value,'前**重点**后');assert.equal(state.changes,1);assert.equal(state.layout,1);e.history();assert.equal(state.undos,1);});
test('a focused draft skips repeated focus callbacks',()=>{const {e,input,state}=fixture();input.ownerDocument.activeElement=input as any;e.format('bold');assert.equal(state.focus,0);assert.equal(input.value,'前**重点**后');});
test('a rejected command shows a small hint and a confirmed retry clears it',()=>{const {e,input,state}=fixture();state.onFocus=()=>{input.value='新内容后';};e.format('bold');assert.equal(e.commandHint.hidden,false);state.onFocus=()=>{};input.selectionStart=0;input.selectionEnd=3;e.format('bold');assert.equal(input.value,'**新内容**后');assert.equal(e.commandHint.hidden,true);});
test('locking the native input while focusing blocks history and formatting',()=>{for(const command of ['format','history']){const {e,input,state}=fixture();state.onFocus=()=>{input.readOnly=true;};e[command]('bold');assert.equal(state.changes+state.undos,0);}});
test('multiple native selections are preserved instead of formatting only the main range',()=>{const {e,input,state}=fixture();Object.assign(input,{selectionCount:2});e.format('bold');assert.equal(input.value,'前重点后');assert.equal(state.changes,0);assert.equal(state.focus,0);assert.equal(e.snapshot().busy,false);assert.match(e.snapshot().disabledReason,/多光标/);});
test('additional selections created during focus also block formatting',()=>{const {e,input,state}=fixture();state.onFocus=()=>Object.assign(input,{selectionCount:2});e.format('bold');assert.equal(state.changes,0);assert.equal(input.value,'前重点后');});
test('returning to a single range resumes normal formatting',()=>{const {e,input,state}=fixture();Object.assign(input,{selectionCount:2});e.format('bold');Object.assign(input,{selectionCount:1});e.format('bold');assert.equal(state.changes,1);assert.equal(input.value,'前**重点**后');assert.equal(e.snapshot().disabledReason,undefined);});
test('native history remains available with multiple selections',()=>{const {e,input,state}=fixture();Object.assign(input,{selectionCount:3});e.history();e.history(true);assert.equal(state.undos,2);});
