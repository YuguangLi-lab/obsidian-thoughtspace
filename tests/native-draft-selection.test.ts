import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as state from '@codemirror/state';
function fixture(){
 const m={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/native-markdown-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='@codemirror/state'?state:{},m,m.exports);
 const n:any=new EventTarget();Object.setPrototypeOf(n,m.exports.NativeMarkdownDraft.prototype);
 const cm:any={state:state.EditorState.create({doc:'甲方观点 乙方观点'}),contentDOM:{contentEditable:'true'},dispatch(...specs:any[]){const apply=(spec:any)=>{const tr=spec instanceof state.Transaction?spec:cm.state.update(spec);cm.state=tr.state;n.editorUpdated?.({state:cm.state,docChanged:tr.docChanged,selectionSet:!!tr.selection,transactions:[tr]});};if(n.dispatchNative)n.dispatchNative(apply,...specs);else apply(specs[0]);}};
 Object.assign(n,{ready:true,engine:{cm,editor:{getValue:()=>cm.state.doc.toString()}},host:{style:{}}});return{n,cm};
}
test('native card honors programmatic selection after its own formatted edit',()=>{const{n,cm}=fixture();n.replaceFormatted('**甲方观点**',0,4,2,6);cm.dispatch({selection:{anchor:9,head:13},scrollIntoView:true});assert.deepEqual([n.selectionStart,n.selectionEnd],[9,13]);});
test('native card releases a cached selection for explicit overlapping selection',()=>{const{n,cm}=fixture();n.replaceFormatted('**甲方观点**',0,4,2,6);cm.dispatch({selection:{anchor:0,head:8},userEvent:'select.search'});assert.deepEqual([n.selectionStart,n.selectionEnd],[0,8]);});
test('live-preview marker normalization keeps the logical phrase',()=>{const{n,cm}=fixture();n.replaceFormatted('**甲方观点**',0,4,2,6);cm.dispatch({selection:{anchor:0,head:8}});assert.deepEqual([n.selectionStart,n.selectionEnd],[2,6]);});
test('unannotated disjoint selection does not inherit the logical phrase',()=>{const{n,cm}=fixture();n.replaceFormatted('**甲方观点**',0,4,2,6);cm.dispatch({selection:{anchor:9,head:13}});assert.deepEqual([n.selectionStart,n.selectionEnd],[9,13]);});
test('native local range operations retain their own final logical selection',()=>{const{n}=fixture();n.setSelectionRange(0,4);assert.deepEqual([n.selectionStart,n.selectionEnd],[0,4]);n.setRangeText('新观点',0,4,'select');assert.equal(n.value,'新观点 乙方观点');assert.deepEqual([n.selectionStart,n.selectionEnd],[0,3]);});
test('nested external selection during an input event overrides the old logical range',()=>{const{n,cm}=fixture();n.addEventListener('input',()=>cm.dispatch({selection:{anchor:9,head:13},scrollIntoView:true}),{once:true});n.replaceFormatted('**甲方观点**',0,4,2,6);assert.deepEqual([n.selectionStart,n.selectionEnd],[9,13]);});
test('failed selection dispatch cannot leave a stale intended selection',()=>{const{n,cm}=fixture();n.setSelectionRange(0,4);const original=cm.dispatch;cm.dispatch=()=>{throw Error('dispatch rejected');};assert.throws(()=>n.setSelectionRange(4,6));cm.dispatch=original;assert.deepEqual([n.selectionStart,n.selectionEnd],[0,4]);});
test('disposed native getters do not access the destroyed editor',()=>{const{n}=fixture();n.disposed=true;Object.defineProperty(n,'engine',{get(){throw Error('dead engine');}});assert.equal(n.value,'');assert.equal(n.selectionStart,0);assert.equal(n.selectionEnd,0);assert.doesNotThrow(()=>{n.value='late';});});

test('saving blocks native changes even when normal transaction filters are disabled',()=>{const{n,cm}=fixture();n.locked=true;cm.dispatch({changes:{from:0,to:4,insert:'错误替换'},filter:false});assert.equal(n.value,'甲方观点 乙方观点');});
test('saving blocks prepared transactions and multiple change specs',()=>{const{n,cm}=fixture();n.locked=true;cm.dispatch(cm.state.update({changes:{from:0,to:4,insert:'错误替换'}}));assert.equal(n.value,'甲方观点 乙方观点');cm.dispatch({changes:{from:0,insert:'x'}},{changes:{from:4,insert:'y'}});assert.equal(n.value,'甲方观点 乙方观点');});
test('saving permits native selection-only transactions',()=>{const{n,cm}=fixture();n.locked=true;cm.dispatch({selection:{anchor:5,head:9},scrollIntoView:true});assert.deepEqual([n.selectionStart,n.selectionEnd],[5,9]);assert.equal(n.value,'甲方观点 乙方观点');});
test('unlock restores native content updates',()=>{const{n,cm}=fixture();n.locked=true;cm.dispatch({changes:{from:0,insert:'x'}});n.locked=false;cm.dispatch({changes:{from:0,insert:'y'}});assert.equal(n.value,'y甲方观点 乙方观点');});
