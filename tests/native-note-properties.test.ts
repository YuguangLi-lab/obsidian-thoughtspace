import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

class Doc {activeElement:El|null=null;}
class El {
 parentElement:El|null=null;isContentEditable=false;disabled=false;readOnly=false;type='text';
 constructor(readonly ownerDocument:Doc,readonly tagName='DIV',readonly classes:string[]=[]){ }
 append(child:El){child.parentElement=this;return child;}
 contains(child:El){for(let current:El|null=child;current;current=current.parentElement)if(current===this)return true;return false;}
 matches(selectors:string){return selectors.split(',').some(value=>{
  const selector=value.trim();
  if(selector.startsWith('.'))return this.classes.includes(selector.slice(1));
  if(selector===':disabled')return this.disabled;
  if(selector==='[readonly]')return this.readOnly;
  const type=/^input\[type="([^"]+)"\]$/.exec(selector);
  return type?this.tagName==='INPUT'&&this.type===type[1]:this.tagName.toLowerCase()===selector;
 });}
 closest(selector:string):El|null{for(let current:El|null=this;current;current=current.parentElement)if(current.matches(selector))return current;return null;}
 focus(){this.ownerDocument.activeElement=this;}
}
function fixture(mode='preview'){
 const file={path:'note.md'},mainDocument=new Doc(),popupDocument=new Doc();
 let source='原文\r\n逐字节保留\r\n',reads=0,saves=0,processes=0,writes=0;
 const control:{read?:()=>void|Promise<void>;save?:()=>void|Promise<void>;process?:()=>void|Promise<void>}={};
 class MarkdownView {
  file=file;mode=mode;containerEl:El|undefined=new El(popupDocument);value=source;
  editor={getValue:()=>this.value};getMode(){return this.mode;}
  async save(){saves++;await control.save?.();}
 }
 const view=new MarkdownView(),views:unknown[]=[view],root=view.containerEl!;
 const metadata=root.append(new El(popupDocument,'DIV',['metadata-container']));
 const property=metadata.append(new El(popupDocument,'DIV',['metadata-property']));
 const input=property.append(new El(popupDocument,'DIV',['metadata-input-longtext']));input.isContentEditable=true;
 mainDocument.activeElement=new El(mainDocument,'BUTTON');
 const app={workspace:{activeLeaf:{view:{containerEl:new El(mainDocument)}},getLeavesOfType:()=>views.map(view=>({view}))},vault:{
  read:async()=>{reads++;await control.read?.();return source;},
  process:async(_file:unknown,transform:(raw:string)=>string)=>{processes++;await control.process?.();source=transform(source);writes++;},
 }};
 const module={exports:{} as typeof import('../src/native-note-state')};
 new Function('require','module','exports',transformSync(readFileSync('src/native-note-state.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView}),module,module.exports);
 const expected=source;
 return{view,views,root,metadata,property,input,popupDocument,mainDocument,file,control,app,
  read:()=>module.exports.readCurrentNativeNote(app as never,file as never),
  assertUnchanged:()=>module.exports.assertNativeNoteUnchanged(app as never,file as never,expected),
  write:()=>module.exports.writeNativeNoteDraft(app as never,file as never,expected,'草稿',()=>{}),
  source:()=>source,expected,counts:()=>({reads,saves,processes,writes}),
 };
}

for(const mode of ['preview','source'])test(`${mode} native Properties edit blocks reads and writes before saving or touching disk`,async()=>{
 const f=fixture(mode);f.input.focus();
 await assert.rejects(f.read(),/请先完成原生属性编辑再试/);
 assert.throws(f.assertUnchanged,/请先完成原生属性编辑再试/);
 await assert.rejects(f.write(),/请先完成原生属性编辑再试/);
 assert.deepEqual(f.counts(),{reads:0,saves:0,processes:0,writes:0});assert.equal(f.source(),f.expected);
 assert.equal(f.popupDocument.activeElement,f.input,'the guard never blurs or submits the native control');
});
test('a preview popout retains its guard while global activeLeaf belongs to another document',async()=>{
 const f=fixture();f.input.focus();
 assert.notEqual(f.app.workspace.activeLeaf.view.containerEl.ownerDocument,f.popupDocument);
 assert.equal(f.mainDocument.activeElement?.tagName,'BUTTON');
 await assert.rejects(f.read(),/原生属性编辑/);assert.equal(f.counts().saves,0);
});
for(const tag of ['INPUT','TEXTAREA','SELECT'])test(`editable native ${tag} property controls are guarded`,async()=>{
 const f=fixture(),input=f.property.append(new El(f.popupDocument,tag));input.focus();
 await assert.rejects(f.read(),/原生属性编辑/);assert.deepEqual(f.counts(),{reads:0,saves:0,processes:0,writes:0});
});
for(const kind of ['input','contenteditable','metadata-like-body'])test(`ordinary ${kind} note content is not a native Properties edit`,async()=>{
 const f=fixture(),body=f.root.append(new El(f.popupDocument,'DIV',kind==='metadata-like-body'?['metadata-container']:[]));
 const input=body.append(new El(f.popupDocument,kind==='input'?'INPUT':'DIV'));input.isContentEditable=kind!=='input';input.focus();
 assert.equal(await f.read(),f.expected);f.assertUnchanged();assert.equal(f.counts().saves,0);
});
for(const kind of ['disabled','readonly','button'])test(`non-editable ${kind} property control does not block`,async()=>{
 const f=fixture(),input=f.property.append(new El(f.popupDocument,kind==='button'?'BUTTON':'INPUT'));
 input.disabled=kind==='disabled';input.readOnly=kind==='readonly';input.focus();
 assert.equal(await f.read(),f.expected);f.assertUnchanged();
});
test('an editable property for another TFile, including a same-path replacement, does not block this file',async()=>{
 const f=fixture();f.view.file={path:f.file.path};f.input.focus();
 assert.notEqual(f.view.file,f.file);assert.equal(await f.read(),f.expected);f.assertUnchanged();
});
test('an editable property in another view of the same document is not attributed to this view',async()=>{
 const f=fixture(),other=new El(f.popupDocument),metadata=other.append(new El(f.popupDocument,'DIV',['metadata-container']));
 const property=metadata.append(new El(f.popupDocument,'DIV',['metadata-property'])),input=property.append(new El(f.popupDocument));input.isContentEditable=true;input.focus();
 assert.equal(await f.read(),f.expected);f.assertUnchanged();
});
test('a non-Markdown view with matching file and property DOM is not a native note editor',async()=>{
 const f=fixture();f.views[0]={file:f.file,containerEl:f.root};f.input.focus();
 assert.equal(await f.read(),f.expected);f.assertUnchanged();
});
for(const missing of ['container','active-element','contains'])test(`missing ${missing} DOM remains compatible with existing source save checks`,async()=>{
 const f=fixture('source');
 if(missing==='container')f.view.containerEl=undefined;
 else if(missing==='contains')Object.defineProperty(f.root,'contains',{value:undefined});
 assert.equal(await f.read(),f.expected);assert.deepEqual(f.counts(),{reads:1,saves:1,processes:0,writes:0});
});
test('a native property entered while the disk read is pending prevents returning a stale baseline',async()=>{
 const f=fixture();f.control.read=()=>{f.input.focus();};
 await assert.rejects(f.read(),/原生属性编辑/);assert.deepEqual(f.counts(),{reads:1,saves:0,processes:0,writes:0});
});
for(const mode of ['preview','source'])test(`${mode} property focus arriving after enqueue is rejected at the atomic write boundary`,async()=>{
 const f=fixture(mode);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});f.control.process=()=>gate;
 const work=f.write();assert.equal(f.counts().processes,1);f.input.focus();release();
 await assert.rejects(work,/原生属性编辑/);assert.equal(f.counts().writes,0);assert.equal(f.source(),f.expected);assert.equal(f.popupDocument.activeElement,f.input);
});
test('finishing property editing permits an unchanged read and write without forcing a native property save',async()=>{
 const f=fixture();f.input.focus();assert.throws(f.assertUnchanged,/原生属性编辑/);
 f.root.focus();assert.equal(await f.read(),f.expected);await f.write();
 assert.deepEqual(f.counts(),{reads:1,saves:0,processes:1,writes:1});assert.equal(f.source(),'草稿');
});
