import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {planMarkdownEdit,insertedPosition} from '../src/markdown-edit';
function fixture(){
 const imports:Record<string,unknown>={obsidian:{Component:class{}},'./markdown-edit':{planMarkdownEdit,insertedPosition},'./markdown-toolbar':{},'@codemirror/state':{Transaction:{userEvent:{}}}};
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/note-markdown-toolbar.ts','utf8')+'\nexport {NoteToolbar};',{loader:'ts',format:'cjs'}).code)((n:string)=>imports[n],module,module.exports);
 const b=Object.create(module.exports.NoteToolbar.prototype),state={text:'前重点后',from:1,to:3,transactions:0,focus:0,reads:0,undo:0,redo:0,selections:1,activate:()=>{},onFocus:()=>{}},file={};
 const editor={hasFocus:()=>false,getValue:()=>{state.reads++;return state.text;},getCursor:(side:string)=>({line:0,ch:side==='from'?state.from:state.to}),posToOffset:(p:any)=>p.ch,offsetToPos:(offset:number)=>({line:0,ch:offset}),listSelections:()=>Array.from({length:state.selections},()=>({})),focus:()=>{state.focus++;state.onFocus();},transaction:(tx:any)=>{state.transactions++;const c=tx.changes[0];state.text=state.text.slice(0,c.from.ch)+c.text+state.text.slice(c.to.ch);state.from=tx.selection.from.ch;state.to=tx.selection.to.ch;},undo:()=>state.undo++,redo:()=>state.redo++};
 Object.assign(b,{file,editor,app:{workspace:{setActiveLeaf:()=>state.activate()}},view:{file,editor,getMode:()=>'source',leaf:{}},notice:{textContent:'',setText(text:string){this.textContent=text;}},sync:()=>{},notify:()=>{}});
 return{b,state,editor};
}
test('unchanged native note applies one local formatting transaction',()=>{
 const {b,state}=fixture();b.format('bold');assert.equal(state.text,'前**重点**后');assert.equal(state.transactions,1);assert.equal(state.focus,1);assert.deepEqual([b.range.from,b.range.to],[3,5]);
});
test('focus edits cannot be overwritten by a formatting plan using stale offsets',()=>{
 const {b,state}=fixture();state.onFocus=()=>{state.text='新前缀'+state.text;};b.format('bold');assert.equal(state.text,'新前缀前重点后');assert.equal(state.transactions,0);assert.equal(b.notice.textContent,'请确认后重试');
 state.onFocus=()=>{};state.from=4;state.to=6;b.format('bold');assert.equal(state.text,'新前缀前**重点**后');assert.equal(state.transactions,1);assert.equal(b.notice.textContent,'');
});
test('same-length content changes during activation also invalidate a command',()=>{
 const {b,state}=fixture();state.activate=()=>{state.text='新内容后';};b.format('bold');assert.equal(state.text,'新内容后');assert.equal(state.transactions,0);assert.equal(state.focus,0);
});
test('a file switch during activation cannot focus or edit the old binding',()=>{
 const {b,state}=fixture();state.activate=()=>{b.view.file={};};b.format('bold');assert.equal(state.focus,0);assert.equal(state.transactions,0);assert.equal(state.text,'前重点后');
});
test('changed native selection is detected even when a logical formatting range is cached',()=>{
 const {b,state}=fixture();b.range={text:state.text,from:1,to:3};state.onFocus=()=>{state.from=0;state.to=1;};b.format('italic');assert.equal(state.transactions,0);assert.equal(state.text,'前重点后');assert.equal(b.range,undefined);
});
test('composition or multiple selections starting during focus block formatting',()=>{
 for(const change of ['ime','multi']){const {b,state}=fixture();state.onFocus=()=>{if(change==='ime')b.composing=true;else state.selections=2;};b.format('bold');assert.equal(state.transactions,0,change);}
});
test('history never undoes an edit that arrives while activating the note',()=>{
 for(const redo of [false,true]){const {b,state}=fixture();state.onFocus=()=>{state.text+='新的输入';};b.history(redo);assert.equal(state.undo+state.redo,0);assert.equal(state.text,'前重点后新的输入');}
});
test('history keeps native multi-selection behavior when text remains stable',()=>{
 const {b,state}=fixture();state.selections=2;state.onFocus=()=>{state.from=0;state.to=0;};b.history();b.history(true);assert.equal(state.undo,1);assert.equal(state.redo,1);assert.equal(b.notice.textContent,'');
});
test('disposal during activation stops the command before touching a stale editor',()=>{
 const {b,state}=fixture();state.activate=()=>{b.disposed=true;};b.format('bold');assert.equal(state.focus,0);assert.equal(state.transactions,0);assert.equal(b.notice.textContent,'');
});

test('an already focused editor does not receive a redundant focus request',()=>{
 const {b,state,editor}=fixture();editor.hasFocus=()=>true;b.format('bold');assert.equal(state.focus,0);assert.equal(state.text,'前**重点**后');assert.equal(state.reads,2);
});
test('sequential formatting in a focused note keeps one activation check per command',()=>{
 const {b,state,editor}=fixture();editor.hasFocus=()=>true;b.format('bold');b.format('italic');
 assert.equal(state.text,'前***重点***后');assert.equal(state.transactions,2);assert.equal(state.focus,0);assert.equal(state.reads,4);
});
test('an already focused editor still rejects content or selection changes during activation',()=>{
 for(const change of ['text','selection']){
  const {b,state,editor}=fixture();editor.hasFocus=()=>true;
  state.activate=()=>{if(change==='text')state.text='新内容后';else{state.from=0;state.to=1;}};
  b.format('bold');assert.equal(state.transactions,0,change);assert.equal(state.focus,0,change);assert.equal(state.reads,2,change);assert.equal(b.notice.textContent,'请确认后重试',change);
 }
});
test('an actual focus request rechecks both text and selection before formatting',()=>{
 for(const change of ['text','selection']){
  const {b,state}=fixture();state.onFocus=()=>{if(change==='text')state.text='新内容后';else{state.from=0;state.to=1;}};
  b.format('bold');assert.equal(state.transactions,0,change);assert.equal(state.focus,1,change);assert.equal(state.reads,3,change);assert.equal(b.notice.textContent,'请确认后重试',change);
 }
});

test('programmatic selection changes invalidate a previous formatting range',()=>{
 const {b,state}=fixture();state.text='甲方观点 乙方观点';state.from=0;state.to=4;b.format('bold');state.from=9;state.to=13;
 assert.equal(b.snapshot().text.slice(b.snapshot().start,b.snapshot().end),'乙方观点');b.format('italic');assert.equal(state.text,'**甲方观点** *乙方观点*');
});
test('collapsed programmatic cursor cannot leave color targeting old selected text',()=>{
 const {b,state}=fixture();b.format('bold');state.from=state.to=state.text.length;const snapshot=b.snapshot();assert.equal(snapshot.start,state.text.length);assert.equal(snapshot.end,snapshot.start);assert.equal(b.range,undefined);
});
test('returning from multiple selections cannot reuse a cached single range',()=>{
 const {b,state}=fixture();b.format('bold');state.selections=2;b.snapshot();assert.equal(b.range,undefined);state.selections=1;state.from=0;state.to=1;b.format('italic');assert.equal(state.text,'*前***重点**后');
});
test('unchanged native selection preserves logical range through sequential formatting',()=>{
 const {b,state}=fixture();b.format('bold');b.format('italic');assert.equal(state.text,'前***重点***后');assert.equal(state.transactions,2);
});

function selectionUpdate(from:number,to:number,explicit=false){return{docChanged:false,selectionSet:true,state:{selection:{main:{from,to},ranges:[{}]}},transactions:[{selection:{},scrollIntoView:explicit,annotation:()=>undefined}]};}
test('native live-preview marker adjustment preserves the logical phrase',()=>{
 const {b,state}=fixture();b.format('bold');state.from=1;state.to=7;b.editorUpdated(selectionUpdate(1,7));const snapshot=b.snapshot();assert.deepEqual([snapshot.start,snapshot.end],[3,5]);b.format('italic');assert.equal(state.text,'前***重点***后');
});
test('explicit overlapping selections discard the old logical phrase',()=>{
 const {b,state}=fixture();b.format('bold');state.from=1;state.to=7;b.editorUpdated(selectionUpdate(1,7,true));assert.equal(b.range,undefined);assert.deepEqual([b.snapshot().start,b.snapshot().end],[1,7]);
});
test('unannotated selection outside the phrase cannot inherit its formatting range',()=>{
 const {b,state}=fixture();b.format('bold');state.from=0;state.to=1;b.editorUpdated(selectionUpdate(0,1));assert.equal(b.range,undefined);
});
test('late editor update after closure is inert',()=>{
 const {b,state}=fixture();b.format('bold');b.disposed=true;b.editorUpdated(selectionUpdate(0,1,true));assert.equal(state.transactions,1);
});
