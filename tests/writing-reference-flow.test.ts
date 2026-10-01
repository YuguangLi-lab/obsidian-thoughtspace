import {boardLink} from '../src/deeplinks';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {writingReferenceRanges,writingReferenceMarkdown} from '../src/writing-reference';
import {selectionFragment,rebaseFragment,pdfLiteralText} from '../src/materials';
class TFile{extension='md';constructor(public path:string){}}
class Picker{current=true;constructor(_app:unknown,public path:string,public raw:string,public ranges:any[],public insert:(mode:string,r:any)=>Promise<void>,public restore:()=>void){}open(){}isCurrent(){return this.current}}
const source=readFileSync('src/writing-view.ts','utf8'),start=source.indexOf(' private async openReferencePicker('),end=source.indexOf('\n private renderReferenceTabs(',start);
const View=new Function('TFile','WritingReferenceModal','writingItems','writingReferenceRanges','writingReferenceMarkdown','assertNativeNoteUnchanged','selectionFragment','rebaseFragment','parseLinktext','boardLink','pdfLiteralText',transformSync('class View{'+source.slice(start,end)+'};return View',{loader:'ts'}).code)(TFile,Picker,(b:any)=>b.nodes,writingReferenceRanges,writingReferenceMarkdown,()=>{},selectionFragment,rebaseFragment,(link:string)=>({path:link,subpath:''}),boardLink,pdfLiteralText);
function fixture(){
 const file=new TFile('资料/原文 + 空格.md'),boardFile=new TFile('boards/test.thoughtspace'),node={id:'n',kind:'card',file:file.path},board={nodes:[node],writing:{manuscript:'before AFTER'}},owner={board};let raw='# Source\n\nEvidence\n';
 const input={value:board.writing.manuscript,selectionStart:7,selectionEnd:7,focus(){},dispatchEvent(){},setRangeText(text:string,a:number,b:number){this.value=this.value.slice(0,a)+text+this.value.slice(b);this.selectionStart=this.selectionEnd=a+text.length}};
 const view=Object.assign(new View(),{owner,file:boardFile,manuscriptInput:input,manuscriptNative:{},state:()=>board.writing,ensure:()=>owner,flushFields:()=>{board.writing.manuscript=input.value},openManuscript:async()=>{},app:{vault:{read:async()=>raw,getAbstractFileByPath:(p:string)=>p===file.path?file:undefined},metadataCache:{getFileCache:()=>null,getFirstLinkpathDest:()=>file},fileManager:{generateMarkdownLink:(f:TFile,_dest:string,sub?:string)=>'[['+f.path+(sub||'')+']]'}}});
 return{view,file,node,board,input,setRaw:(value:string)=>raw=value,range:{label:'selected',from:10,to:18}};
}
test('reference inserts at captured caret with exact source identity and leaves original untouched',async()=>{const f=fixture();await f.view.openReferencePicker('n');await f.view.referencePicker.insert('quote',f.range);assert.match(f.input.value,/^before \n\n> Evidence/);assert.match(f.input.value,/资料\/原文 \+ 空格.md/);assert.ok(f.input.value.endsWith('AFTER'));assert.equal(f.view.referencePicker.raw,'# Source\n\nEvidence\n');});
test('repeated reference confirmation cannot duplicate an insertion',async()=>{const f=fixture();await f.view.openReferencePicker('n');const picker=f.view.referencePicker;await picker.insert('quote',f.range);const once=f.input.value;await assert.rejects(picker.insert('quote',f.range),/正文已变化/);assert.equal(f.input.value,once);});
for(const type of ['source','moved','deleted','node','manuscript','caret','cancelled','composition'])test(`reference rejects stale ${type} without changing manuscript`,async()=>{
 const f=fixture();await f.view.openReferencePicker('n');const picker=f.view.referencePicker,before=f.input.value;
 if(type==='source')f.setRaw('Changed');if(type==='moved')f.file.path='moved.md';if(type==='deleted')f.view.app.vault.getAbstractFileByPath=()=>undefined;if(type==='node')f.node.file='another.md';if(type==='manuscript')f.board.writing.manuscript='Other window';if(type==='caret')f.input.selectionStart=1;if(type==='cancelled')picker.current=false;if(type==='composition')f.view.composing=true;
 await assert.rejects(picker.insert('quote',f.range));assert.equal(f.input.value,before);
});
test('existing picker is reused rather than opening twice',async()=>{const f=fixture();await f.view.openReferencePicker('n');const picker=f.view.referencePicker;await f.view.openReferencePicker('n');assert.equal(f.view.referencePicker,picker);});
test('failed manuscript persistence keeps inserted text available for recovery',async()=>{const f=fixture();await f.view.openReferencePicker('n');f.view.flushFields=()=>{throw Error('write failed')};await assert.rejects(f.view.referencePicker.insert('quote',f.range),/write failed/);assert.match(f.input.value,/> Evidence/);});

test('source-editor fallback receives full initial Markdown even when DOM factory ignores textarea value option',()=>{
 const a=source.indexOf(' private markdownInput('),b=source.indexOf('\n private attachFormatToolbar(',a),V=new Function('NativeMarkdownDraft',transformSync('class View{'+source.slice(a,b)+'};return View',{loader:'ts'}).code)(class{constructor(){throw Error('not available')}});const text='# Draft\n\n中文 **kept**',input={value:''},v=Object.assign(new V(),{attachFormatToolbar(){}});assert.equal(v.markdownInput({createDiv(){},createEl(){return input}},text,true).value,text);
});

test('reference modal restores editor focus after the host has finished closing it',()=>{
 const modalSource=readFileSync('src/writing-reference-view.ts','utf8'),a=modalSource.indexOf(' onClose(){'),b=modalSource.indexOf('\n}',a);const V=new Function(transformSync('class V{'+modalSource.slice(a,b)+'};return V',{loader:'ts'}).code)();let queued:(()=>void)|undefined,restored=0;const v=Object.assign(new V(),{raw:'source',ranges:[{}],contentEl:{empty(){}},modalEl:{win:{setTimeout(f:()=>void){queued=f}}},restore(){restored++}});v.onClose();assert.equal(restored,0);assert.equal(v.raw,'');assert.ok(v.closed);queued!();assert.equal(restored,1);
});

test('text-card quotations preserve literal relative-link text and link back to the exact board node',async()=>{const f=fixture();Object.assign(f.node,{kind:'text',file:undefined,text:'[relative](../note.md) **literal**'});f.view.app.vault.getName=()=>"QA vault";await f.view.openReferencePicker('n');await f.view.referencePicker.insert('quote',{label:'all',from:0,to:(f.node as any).text.length});assert.ok(f.input.value.includes('\\[relative\\]'));assert.match(f.input.value,/obsidian:\/\/thoughtspace\?/);assert.match(f.input.value,/node=n/);});

test('concurrent picker opens share one pending source read and one modal',async()=>{
 const f=fixture();const pending:((value:string)=>void)[]=[];f.view.app.vault.read=()=>new Promise<string>(r=>pending.push(r));
 const first=f.view.openReferencePicker('n');await Promise.resolve();const second=f.view.openReferencePicker('n');await Promise.resolve();const count=pending.length;for(const resolve of pending)resolve('# Source\n\nEvidence\n');
 await Promise.all([first,second]);assert.equal(count,1,'only one source read may be pending');assert.ok(f.view.referencePicker);
});
test('failed picker source read releases pending guard for a subsequent attempt',async()=>{
 const f=fixture(),read=f.view.app.vault.read;f.view.app.vault.read=async()=>{throw Error('read failed')};await assert.rejects(f.view.openReferencePicker('n'),/read failed/);f.view.app.vault.read=read;await f.view.openReferencePicker('n');assert.ok(f.view.referencePicker);
});
