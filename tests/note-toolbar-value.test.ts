import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {EditorState,Transaction,ChangeSet,type ChangeSpec} from '@codemirror/state';
import {planMarkdownEdit,insertedPosition} from '../src/markdown-edit';
import {releaseEditorResource} from '../src/editor-cleanup';

const source=readFileSync('src/note-markdown-toolbar.ts','utf8');
const imports:Record<string,unknown>={obsidian:{Component:class{}},'@codemirror/state':{Transaction},'./markdown-edit':{planMarkdownEdit,insertedPosition},'./editor-cleanup':{releaseEditorResource}};
const module={exports:{} as any};
new Function('require','module','exports',transformSync(source+'\nexport {NoteToolbar};',{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name]||{},module,module.exports);

function fixture(text='原生笔记正文'){
 const binding=Object.create(module.exports.NoteToolbar.prototype),cm={state:EditorState.create({doc:text})},file={};
 let reads=0,formatTransactions=0,activate=()=>{};
 const undo:ChangeSet[]=[],redo:ChangeSet[]=[];
 const notify=(tr:Transaction)=>binding.editorUpdated({view:cm,state:cm.state,transactions:[tr],selectionSet:!!tr.selection,docChanged:tr.docChanged});
 const apply=(changes:ChangeSpec,record=true,notification=true)=>{const tr=cm.state.update({changes});if(record){undo.push(tr.changes.invert(cm.state.doc));redo.length=0;}cm.state=tr.state;if(notification)notify(tr);};
 const position=(offset:number)=>{const line=cm.state.doc.lineAt(offset);return{line:line.number-1,ch:offset-line.from};};
 const editor={
  getValue(){reads++;return cm.state.doc.toString();},getCursor(side:string){return position(side==='from'?cm.state.selection.main.from:cm.state.selection.main.to);},
  posToOffset(pos:{line:number;ch:number}){return cm.state.doc.line(pos.line+1).from+pos.ch;},offsetToPos:position,listSelections:()=>cm.state.selection.ranges,hasFocus:()=>true,focus(){},
  transaction(){formatTransactions++;},
  undo(){const changes=undo.pop();if(changes){redo.push(changes.invert(cm.state.doc));apply(changes,false);}},
  redo(){const changes=redo.pop();if(changes){undo.push(changes.invert(cm.state.doc));apply(changes,false);}}
 };
 Object.assign(binding,{editor,file,view:{file,editor,getMode:()=> 'source',leaf:{},contentEl:{removeClass(){}}},app:{workspace:{setActiveLeaf:()=>activate()}},notice:{textContent:'',setText(text:string){this.textContent=text;}},host:{remove(){},ownerDocument:{defaultView:{cancelAnimationFrame(){}}}},notify(){},sync(){}});
 const select=(from:number,to=from)=>{const tr=cm.state.update({selection:{anchor:from,head:to}});cm.state=tr.state;notify(tr);};
 return{binding,cm,editor,apply,select,reads:()=>reads,formatTransactions:()=>formatTransactions,onActivate:(run:()=>void)=>{activate=run;}};
}

test('native note toolbar flattens unchanged CodeMirror text once across 240 selection snapshots',()=>{
 const text='原生 Markdown 段落内容\n'.repeat(50000),f=fixture(text);
 for(let i=0;i<240;i++){f.select(i*100);const snapshot=f.binding.snapshot();assert.equal(snapshot.text,text);assert.equal(snapshot.start,i*100);}
 assert.equal(f.reads(),1);
});

test('equal-length changes are fresh even before their update listener runs',()=>{
 const f=fixture('甲方观点');f.select(1);assert.equal(f.binding.snapshot().text,'甲方观点');
 f.apply({from:0,to:2,insert:'乙方'},true,false);assert.equal(f.binding.snapshot().text,'乙方观点');assert.equal(f.binding.snapshot().text,'乙方观点');
 assert.equal(f.reads(),2);
});

test('native undo and redo invalidate snapshots through immutable document identity',()=>{
 const f=fixture('正文');f.select(0);assert.equal(f.binding.snapshot().text,'正文');f.apply({from:2,insert:'补充'});assert.equal(f.binding.snapshot().text,'正文补充');
 f.editor.undo();assert.equal(f.binding.snapshot().text,'正文');f.editor.redo();assert.equal(f.binding.snapshot().text,'正文补充');
 assert.equal(f.binding.snapshot().text,'正文补充');assert.equal(f.reads(),4);
});

test('missing CodeMirror identity and replaced native readers stay conservative',()=>{
 const f=fixture('正文');f.binding.snapshot();f.binding.snapshot();assert.equal(f.reads(),2);
 f.select(0);assert.equal(f.binding.snapshot().text,'正文');assert.equal(f.binding.snapshot().text,'正文');assert.equal(f.reads(),3);
 f.editor.getValue=()=> '新适配器正文';assert.equal(f.binding.snapshot().text,'新适配器正文');
 const oldEditor=f.editor;f.binding.view.editor={...oldEditor};assert.equal(f.binding.snapshot().disabledReason,'编辑器已关闭或切换');
});

test('replaced CodeMirror views cannot reuse a previous view cache even with the same document',()=>{
 const f=fixture('正文');f.select(0);f.binding.snapshot();
 const replacement={state:f.cm.state},tr=f.cm.state.update({selection:{anchor:1}});replacement.state=tr.state;
 f.binding.editorUpdated({view:replacement,state:replacement.state,transactions:[tr],selectionSet:true,docChanged:false});
 f.binding.snapshot();f.binding.snapshot();assert.equal(f.reads(),2);
});

test('cached display text never bypasses the direct focus-time conflict check',()=>{
 const f=fixture('前重点后');f.select(1,3);f.binding.snapshot();
 f.onActivate(()=>f.apply({from:0,to:4,insert:'新内容后'},true,false));
 f.binding.format('bold');assert.equal(f.formatTransactions(),0);assert.equal(f.cm.state.doc.toString(),'新内容后');assert.equal(f.binding.notice.textContent,'请确认后重试');
 assert.equal(f.binding.snapshot().text,'新内容后');
});

test('selection, IME, and multiple-cursor state remain live while sharing only text',()=>{
 const f=fixture('一二三四');f.select(0,2);assert.equal(f.binding.snapshot().end,2);f.select(2,4);assert.equal(f.binding.snapshot().start,2);
 f.binding.composing=true;assert.equal(f.binding.snapshot().disabledReason,'输入法组字中');f.binding.composing=false;
 f.editor.listSelections=()=>[{} as any,{} as any];assert.match(f.binding.snapshot().disabledReason,/多光标/);assert.equal(f.reads(),1);
});

test('a document changed inside getValue does not seed an obsolete snapshot cache',()=>{
 const f=fixture('原文');f.select(0);let reads=0;
 f.editor.getValue=()=>{reads++;const value=f.cm.state.doc.toString();if(reads===1)f.apply({from:0,to:2,insert:'新文'},true,false);return value;};
 assert.equal(f.binding.snapshot().text,'原文');assert.equal(f.binding.snapshot().text,'新文');assert.equal(f.binding.snapshot().text,'新文');assert.equal(reads,2);
});

test('unloading releases the cached text and CodeMirror reference and ignores late updates',()=>{
 const f=fixture('正文');f.select(1);f.binding.snapshot();assert.ok(f.binding.snapshotCache);assert.ok(f.binding.snapshotView);
 f.binding.onunload();assert.equal(f.binding.snapshotCache,undefined);assert.equal(f.binding.snapshotView,undefined);
 f.select(0);assert.equal(f.binding.snapshotView,undefined);assert.equal(f.binding.snapshot().disabledReason,'编辑器已关闭或切换');
});
