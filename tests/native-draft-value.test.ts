import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as state from '@codemirror/state';
import {releaseEditorResource} from '../src/editor-cleanup';

function fixture(value='原始正文'){
 const m={exports:{} as any};
 new Function('require','module','exports',transformSync(readFileSync('src/native-markdown-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='@codemirror/state'?state:name==='./editor-cleanup'?{releaseEditorResource}:{},m,m.exports);
 const draft:any=new EventTarget();Object.setPrototypeOf(draft,m.exports.NativeMarkdownDraft.prototype);
 let reads=0,failRead=false;
 const cm:any={state:state.EditorState.create({doc:value}),contentDOM:{contentEditable:'true'},dispatch(spec:any){const apply=(incoming:any)=>{const tr=incoming instanceof state.Transaction?incoming:cm.state.update(incoming);cm.state=tr.state;draft.editorUpdated({state:cm.state,docChanged:tr.docChanged,selectionSet:!!tr.selection,transactions:[tr]});};draft.dispatchNative(apply,spec);}};
 const undo:state.ChangeSet[]=[],redo:state.ChangeSet[]=[];
 const change=(changes:state.ChangeSpec)=>{const tr=cm.state.update({changes});undo.push(tr.changes.invert(tr.startState.doc));redo.length=0;cm.dispatch(tr);};
 const editor={getValue(){reads++;if(failRead)throw Error('temporary read error');return cm.state.doc.toString();},undo(){const changes=undo.pop();if(changes){redo.push(changes.invert(cm.state.doc));cm.dispatch({changes});}},redo(){const changes=redo.pop();if(changes){undo.push(changes.invert(cm.state.doc));cm.dispatch({changes});}}};
 Object.assign(draft,{ready:true,engine:{cm,editor,unload(){},destroy(){}},host:{style:{},remove(){}}});
 return{draft,cm,editor,change,reads:()=>reads,fail:(enabled:boolean)=>{failRead=enabled;}};
}

test('native draft reuses one full text read across consumers and selection-only updates',()=>{
 const value='Long Markdown paragraph '.repeat(10000),f=fixture(value);
 for(let i=0;i<120;i++){
  assert.equal(f.draft.value,value);assert.equal(f.draft.value,value);assert.equal(f.draft.value,value);
  f.cm.dispatch({selection:{anchor:i}});
 }
 assert.equal(f.reads(),1);assert.equal(f.draft.selectionStart,119);
});

test('new native content including equal-length edits is visible before input listeners read it',()=>{
 const f=fixture('甲方观点'),seen:string[]=[];assert.equal(f.draft.value,'甲方观点');
 f.draft.addEventListener('input',()=>{seen.push(f.draft.value);assert.equal(f.draft.value,f.cm.state.doc.toString());});
 f.change({from:0,to:2,insert:'乙方'});f.change({from:4,insert:'补充证据'});
 assert.deepEqual(seen,['乙方观点','乙方观点补充证据']);assert.equal(f.reads(),3);
});

test('native undo and redo return the corresponding fresh full text',()=>{
 const f=fixture('正文');assert.equal(f.draft.value,'正文');f.change({from:2,insert:'补充'});assert.equal(f.draft.value,'正文补充');
 f.draft.history(false);assert.equal(f.draft.value,'正文');f.draft.history(true);assert.equal(f.draft.value,'正文补充');
 assert.equal(f.reads(),4);
});

test('formatted transactions and save-time locking never expose cached content from an older document',()=>{
 const f=fixture('正文');assert.equal(f.draft.value,'正文');f.draft.replaceFormatted('**正文**',0,2,2,4);assert.equal(f.draft.value,'**正文**');assert.equal(f.reads(),2);
 f.draft.readOnly=true;f.cm.dispatch({changes:{from:0,insert:'丢弃'}});assert.equal(f.draft.value,'**正文**');assert.equal(f.reads(),2);
 f.draft.readOnly=false;f.cm.dispatch({changes:{from:0,insert:'保留'}});assert.equal(f.draft.value,'保留**正文**');assert.equal(f.reads(),3);
});

test('replaced native engine, CodeMirror instance, or adapter invalidates cached reads',()=>{
 const f=fixture('正文');assert.equal(f.draft.value,'正文');
 f.draft.engine={...f.draft.engine};assert.equal(f.draft.value,'正文');assert.equal(f.reads(),2);
 f.draft.engine.cm={state:f.cm.state};assert.equal(f.draft.value,'正文');assert.equal(f.reads(),3);
 f.draft.engine.editor={...f.editor};assert.equal(f.draft.value,'正文');assert.equal(f.reads(),4);
 f.draft.engine.editor.getValue=()=>{return '新适配器';};assert.equal(f.draft.value,'新适配器');
});

test('a native adapter without a document identity remains uncached',()=>{
 const f=fixture('正文');assert.equal(f.draft.value,'正文');let reads=0;
 f.draft.engine={editor:{getValue:()=>String(++reads)}};
 assert.equal(f.draft.value,'1');assert.equal(f.draft.value,'2');
});

test('a document changed while an adapter reads cannot seed a stale cache',()=>{
 const f=fixture('原文');let reads=0;
 f.editor.getValue=()=>{reads++;const value=f.cm.state.doc.toString();if(reads===1)f.change({from:0,to:2,insert:'新文'});return value;};
 assert.equal(f.draft.value,'原文');assert.equal(f.draft.value,'新文');assert.equal(f.draft.value,'新文');assert.equal(reads,2);
});

test('failed reads can retry and disposed drafts release their cached document',()=>{
 const f=fixture('正文');assert.equal(f.draft.value,'正文');f.change({from:2,insert:'新内容'});f.fail(true);
 assert.throws(()=>f.draft.value,/temporary read error/);f.fail(false);assert.equal(f.draft.value,'正文新内容');assert.equal(f.reads(),3);
 f.draft.dispose();assert.equal(f.draft.valueCache,undefined);
 Object.defineProperty(f.draft,'engine',{get(){throw Error('destroyed engine');}});assert.equal(f.draft.value,'');
});


test('native intrinsic height uses CM document geometry and own-window padding, not viewport scrollHeight',()=>{
 const f=fixture();f.cm.contentHeight=260;f.draft.host.ownerDocument={defaultView:{getComputedStyle:()=>({paddingTop:'14px',paddingBottom:'18px'})}};f.draft.host.scrollHeight=900;
 assert.equal(f.draft.intrinsicHeight(),292);f.draft.host.scrollHeight=1400;assert.equal(f.draft.intrinsicHeight(),292);
 f.cm.scaleY=.5;f.cm.contentHeight=130;assert.equal(f.draft.intrinsicHeight(),292);f.cm.scaleY=2;f.cm.contentHeight=520;assert.equal(f.draft.intrinsicHeight(),292);
 for(const value of [NaN,Infinity,-1]){f.cm.contentHeight=value;assert.equal(f.draft.intrinsicHeight(),undefined);}
 f.draft.disposed=true;Object.defineProperty(f.draft,'engine',{get(){throw Error('closed');}});assert.equal(f.draft.intrinsicHeight(),undefined);
});
test('native height and geometry changes request layout without publishing spurious content edits',()=>{
 const f=fixture(),events:string[]=[];for(const type of ['layout','input','select'])f.draft.addEventListener(type,()=>events.push(type));const update={state:f.cm.state,transactions:[],docChanged:false,selectionSet:false};
 f.draft.editorUpdated({...update,heightChanged:true});f.draft.editorUpdated({...update,geometryChanged:true});f.draft.editorUpdated(update);assert.deepEqual(events,['layout','layout']);
 f.draft.disposed=true;f.draft.editorUpdated({...update,heightChanged:true});assert.deepEqual(events,['layout','layout']);
});
