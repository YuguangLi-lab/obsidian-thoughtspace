import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as state from '@codemirror/state';
import * as guards from '../src/value-guards';
import {releaseEditorResource} from '../src/editor-cleanup';

function fixture(path:string){
 const textNode={nodeType:3},tool={nodeType:1},attributes:Record<string,string>={};
 const contentDOM=Object.assign(new EventTarget(),{nodeType:1,contains:(target:unknown)=>target===textNode||target===contentDOM,setAttribute:(key:string,value:string)=>{attributes[key]=value;}});
 let owner:any,engine:any,hostWrites=0,unloads=0,destroys=0;
 class EditorView {state=state.EditorState.create({doc:''});contentDOM=contentDOM;dispatch(spec:state.TransactionSpec){this.state=this.state.update(spec).state;}focus(){}requestMeasure(){}}
 class Base {
  cm=new EditorView();editor={getValue:()=>this.cm.state.doc.toString(),undo(){},redo(){}};sourceMode=true;
  constructor(_app?:unknown,_parent?:unknown,context?:unknown){if(context){owner=context;engine=this;}}
  getDynamicExtensions(){return [];}load(){}set(value:string){this.cm.state=state.EditorState.create({doc:value});}show(){}unload(){unloads++;}destroy(){destroys++;}
  onUpdate(){hostWrites++;}
 }
 class ProbeEditor extends Base {}
 const probe={editable:false,editMode:new ProbeEditor(),showEditor(){},unload(){}};
 const app={embedRegistry:{embedByExtension:{md:()=>probe}}};
 const host=Object.assign(new EventTarget(),{style:{},remove(){},ownerDocument:{}});
 const parent={createDiv:(name?:string)=>name?host:{remove(){}}};
 const module={exports:{} as any};
 new Function('require','module','exports',transformSync(readFileSync('src/native-markdown-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='@codemirror/state'?state:name==='@codemirror/view'?{EditorView}:name==='./value-guards'?guards:name==='./editor-cleanup'?{releaseEditorResource}:{},module,module.exports);
 const file={path},draft=new module.exports.NativeMarkdownDraft(app,parent,'$x^2$\n\n| A | B |',file,'编辑文本 Markdown · 实时预览');
 return{draft,file,owner,engine,textNode,tool,contentDOM,attributes,counts:()=>({hostWrites,unloads,destroys})};
}

test('a board context supplies native link resolution without becoming a saving file view',()=>{
 const f=fixture('白板/研究.thoughtspace');assert.equal(f.owner.file,f.file);assert.equal(f.owner.getMode(),'source');assert.equal(f.engine.sourceMode,false);
 assert.equal(f.attributes['aria-label'],'编辑文本 Markdown · 实时预览');assert.equal(f.draft.value,'$x^2$\n\n| A | B |');
 let inputs=0;f.draft.addEventListener('input',()=>inputs++);
 const transaction=f.engine.cm.state.update({changes:{from:0,to:5,insert:'$y^2$'}});f.engine.cm.state=transaction.state;
 f.engine.onUpdate({state:transaction.state,docChanged:true,selectionSet:false,transactions:[transaction]});
 assert.equal(f.draft.value,'$y^2$\n\n| A | B |');assert.equal(inputs,1);assert.equal(f.counts().hostWrites,0,'unsaved text never invokes native file update');
 assert.equal('save' in f.owner,false);assert.equal('requestSave' in f.owner,false);f.draft.dispose();assert.deepEqual(f.counts(),{hostWrites:0,unloads:1,destroys:1});
});

test('only the native content body owns topic keyboard events',()=>{
 const f=fixture('notes/example.md');assert.equal(f.draft.ownsKeyTarget(f.contentDOM),true);assert.equal(f.draft.ownsKeyTarget(f.textNode),true);
 for(const target of [f.tool,null,new EventTarget()])assert.equal(f.draft.ownsKeyTarget(target),false);
 f.draft.dispose();assert.equal(f.draft.ownsKeyTarget(f.contentDOM),false);
});
