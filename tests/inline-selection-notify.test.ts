import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as state from '@codemirror/state';
import {releaseEditorResource} from '../src/editor-cleanup';

const source=readFileSync(process.env.INLINE_STATE_SOURCE||'src/inline-node-editor.ts','utf8');
const module={exports:{} as any};
new Function('require','module','exports',transformSync(source,{loader:'ts',format:'cjs'}).code)((name:string)=>name==='./editor-cleanup'?{releaseEditorResource}:name==='obsidian'?{setIcon(){}}:{},module,module.exports);
const eventsStart=source.indexOf("  this.input.addEventListener('input',"),eventsEnd=source.indexOf("  this.el.addEventListener('keydown',",eventsStart);
assert.ok(eventsStart>=0&&eventsEnd>eventsStart);
const bindEvents=new Function(transformSync(source.slice(eventsStart,eventsEnd),{loader:'ts'}).code);

function fixture(suppliedInput?:any,original='原文'){
 const editor=Object.create(module.exports.InlineNodeEditor.prototype),classes=new Set<string>(),input=suppliedInput||Object.assign(new EventTarget(),{value:original,selectionCount:1,selectionStart:0,selectionEnd:0,readOnly:false});
 const calls={layout:0,focus:0},seen:{state:string;label:string;locked:boolean}[]=[];
 const element={dataset:{} as Record<string,string>,setAttribute(){},hasClass:(name:string)=>classes.has(name),addClass:(name:string)=>classes.add(name),removeClass:(name:string)=>classes.delete(name),classList:{toggle(name:string,on:boolean){if(on)classes.add(name);else classes.delete(name);}}};
 const text=()=>({textContent:'',setText(value:string){this.textContent=value;},title:''});
 Object.assign(editor,{input,options:{value:original,save:async()=>{}},el:element,status:text(),badge:text(),actions:Array.from({length:3},()=>({disabled:false,title:'',setAttribute(){}})),commandHint:{hidden:true},selectionCount:1,textSelected:false,headerKey:'',retryIcon:false,
  scheduleLayout(){calls.layout++;},checkFocus(){calls.focus++;},flushLayout(){}
 });
 // Constructor listeners precede toolbar subscribers in the real editor.
 bindEvents.call(editor);
 input.addEventListener('select',()=>seen.push({state:element.dataset.state,label:editor.badge.textContent,locked:input.readOnly}));
 const emit=(type:string)=>input.dispatchEvent(new Event(type));
 return{editor,input,classes,calls,seen,emit};
}

function nativeInput(value:string){
 const native={exports:{} as any};
 new Function('require','module','exports',transformSync(readFileSync('src/native-markdown-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='@codemirror/state'?state:{},native,native.exports);
 const input:any=new EventTarget();Object.setPrototypeOf(input,native.exports.NativeMarkdownDraft.prototype);
 let reads=0;
 const cm:any={state:state.EditorState.create({doc:value,extensions:[state.EditorState.allowMultipleSelections.of(true)]}),contentDOM:Object.assign(new EventTarget(),{contentEditable:'true'}),dispatch(spec:any){
  const apply=(incoming:any)=>{const tr=incoming instanceof state.Transaction?incoming:cm.state.update(incoming);cm.state=tr.state;input.editorUpdated({state:cm.state,docChanged:tr.docChanged,selectionSet:!!tr.selection,transactions:[tr]});};
  input.dispatchNative(apply,spec);
 }};
 Object.assign(input,{ready:true,host:{style:{}},engine:{cm,editor:{getValue(){reads++;return cm.state.doc.toString();}}}});
 return{input,cm,reads:()=>reads};
}

test('one selection event reaches subscribers once when switching single and multiple cursors',t=>{
 const f=fixture();
 for(let index=0;index<120;index++){f.input.selectionCount=index%2?1:2;f.emit('select');}
 t.diagnostic(`120 cursor-mode changes deliver ${f.seen.length} selection notifications`);
 assert.equal(f.seen.length,120);
 for(const [index,seen] of f.seen.entries())assert.deepEqual(seen,{state:index%2?'editing':'multiselect',label:index%2?'编辑中':'2 个选区',locked:false});
 assert.equal(f.calls.layout,0);
});

test('selection-only native updates reuse the immutable document without another full-text read',()=>{
 const text='长篇 Markdown 正文 '.repeat(10000),native=nativeInput(text),f=fixture(native.input,text);
 assert.equal(native.input.value,text);assert.equal(native.reads(),1);
 for(let index=0;index<120;index++)native.cm.dispatch({selection:index%2?state.EditorSelection.single(1):state.EditorSelection.create([state.EditorSelection.cursor(1),state.EditorSelection.cursor(10)]),userEvent:'select'});
 assert.equal(native.reads(),1,'cursor changes must not flatten the unchanged document');assert.equal(f.seen.length,120);assert.equal(f.calls.layout,0);
});

test('select listeners update text-selection styling without adding another selection event',()=>{
 const f=fixture();f.input.selectionEnd=2;f.emit('select');assert.ok(f.classes.has('has-text-selection'));
 f.input.selectionCount=2;f.emit('select');assert.equal(f.classes.has('has-text-selection'),false);
 f.input.selectionCount=1;f.emit('select');assert.ok(f.classes.has('has-text-selection'));
 f.input.selectionStart=2;f.emit('select');assert.equal(f.classes.has('has-text-selection'),false);
 assert.equal(f.seen.length,4);
});

test('input and composition state changes continue notifying subscribers and preserving the draft',()=>{
 const f=fixture();f.input.value='新的草稿';f.emit('input');assert.equal(f.seen.at(-1)!.label,'未保存');assert.equal(f.calls.layout,1);
 f.emit('compositionstart');assert.equal(f.seen.at(-1)!.state,'composing');assert.equal(f.seen.at(-1)!.label,'输入中');
 f.input.value+='输入';f.emit('input');assert.equal(f.seen.at(-1)!.state,'composing');assert.equal(f.calls.layout,1);
 f.emit('compositionend');assert.equal(f.seen.at(-1)!.state,'editing');assert.equal(f.seen.at(-1)!.label,'未保存');assert.equal(f.calls.layout,2);assert.equal(f.calls.focus,1);
 assert.equal(f.seen.length,4);assert.equal(f.input.value,'新的草稿输入');
});

test('normal save and recovery both publish locked and unlocked states exactly once',async()=>{
 for(const recovery of [false,true]){
  const f=fixture();f.input.value='保留草稿';f.input.selectionCount=2;
  let release!:()=>void,saved='';const gate=new Promise<void>(resolve=>release=resolve),save=async(value:string)=>{saved=value;await gate;};
  f.editor.options.save=save;const pending=recovery?f.editor.backup(save):f.editor.commit();await Promise.resolve();
  assert.equal(saved,'保留草稿');assert.equal(f.input.readOnly,true);assert.deepEqual(f.seen,[{state:recovery?'recovering':'saving',label:recovery?'备份中':'保存中',locked:true}]);
  release();assert.equal(await pending,true);assert.equal(f.input.readOnly,false);assert.deepEqual(f.seen.at(-1),{state:'multiselect',label:'2 个选区',locked:false});assert.equal(f.seen.length,2);
 }
});

test('failed save keeps its retry notification and editable content',async()=>{
 const f=fixture();f.input.value='未保存正文';f.editor.options.save=async()=>{throw Error('来源已变化');};
 assert.equal(await f.editor.commit(),false);assert.deepEqual(f.seen.map(seen=>seen.state),['saving','error']);assert.equal(f.seen.at(-1)!.locked,false);assert.match(f.editor.status.textContent,/来源已变化/);assert.equal(f.input.value,'未保存正文');
 f.editor.options.save=async()=>{};assert.equal(await f.editor.commit(),true);assert.deepEqual(f.seen.slice(-2).map(seen=>seen.state),['saving','editing']);assert.equal(f.classes.has('has-error'),false);
});

test('native edits during multiple selection remain dirty when returning to one cursor',()=>{
 const native=nativeInput('原文'),f=fixture(native.input);
 native.cm.dispatch({selection:state.EditorSelection.create([state.EditorSelection.cursor(0),state.EditorSelection.cursor(2)]),userEvent:'select'});
 native.cm.dispatch({changes:{from:0,to:1,insert:'新'},userEvent:'input'});
 assert.equal(f.seen.at(-1)!.state,'multiselect');
 native.cm.dispatch({selection:state.EditorSelection.single(0),userEvent:'select'});
 assert.equal(f.seen.at(-1)!.label,'未保存');assert.equal(native.input.value,'新文');
});

test('disposed editors neither recompute state nor rebroadcast late input and select events',()=>{
 const f=fixture();f.editor.disposed=true;
 Object.defineProperty(f.input,'selectionCount',{get(){throw Error('disposed selection read');}});
 for(const type of ['input','select','compositionstart','compositionend'])f.emit(type);
 f.editor.updateState();f.editor.updateState(false);
 assert.equal(f.seen.length,1,'the externally dispatched select itself still reaches its observer');assert.equal(f.seen[0].state,undefined);assert.equal(f.calls.layout,0);assert.equal(f.calls.focus,0);assert.equal(f.editor.headerKey,'');
});
