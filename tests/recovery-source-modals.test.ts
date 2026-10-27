import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as recovery from '../src/recovery-center';
import * as sources from '../src/writing-source-check';

class El {
 children:El[]=[];parentElement?:El;value='';textContent='';open=false;disabled=false;readOnly=false;selected=false;onclick?:()=>Promise<void>|void;ontoggle?:()=>void;
 attrs:Record<string,string>={};
 constructor(readonly ownerDocument:any,options:any={}){this.textContent=options.text||'';this.attrs=options.attr||{};this.readOnly='readonly'in this.attrs;}
 get isConnected():boolean{return this===this.ownerDocument.body||!!this.parentElement?.isConnected;}
 createEl(tag:string,options:any={}){const e=new El(this.ownerDocument,options);e.attrs.tag=tag;e.parentElement=this;this.children.push(e);return e;}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 appendChild(e:El){e.remove();e.parentElement=this;this.children.push(e);return e;}
 addClass(){}setCssStyles(){}setText(value:string){this.textContent=value;}focus(){this.ownerDocument.activeElement=this;}select(){this.selected=true;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);this.parentElement=undefined;}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];}
 querySelectorAll(selector:string):El[]{const names=selector.split(',').map(s=>s.trim());return this.children.flatMap(e=>[...(names.some(s=>s.startsWith('[')?s.slice(1,-1)in e.attrs:s===e.attrs.tag)?[e]:[]),...e.querySelectorAll(selector)]);}
}
class Modal {
 containerEl:El;modalEl:El;contentEl:El;titleEl:El;
 constructor(readonly app:any){this.containerEl=app.doc.body.createDiv();this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();this.titleEl=this.modalEl.createDiv();}
 close(){(this as any).onClose();this.containerEl.remove();}
}
class TFile {extension='md';stat={ctime:1,mtime:1,size:20};constructor(public path:string){}}
function load(file:string,name:string,extras:Record<string,unknown>={}){const m={exports:{}as any};new Function('require','module','exports',transformSync(readFileSync(file,'utf8'),{loader:'ts',format:'cjs'}).code)((id:string)=>{
 if(id==='obsidian')return{Modal,TFile};if(id==='./ui-tokens')return{themeSurface(){}};if(id==='./board-modal-viewport')return{bindBoardModalViewport:()=>()=>{}};if(id==='./recovery-center')return recovery;if(id==='./writing-source-check')return sources;if(id==='./native-note-state')return extras;throw Error(id);
 },m,m.exports);return m.exports[name];}
const Center=load('src/recovery-center-view.ts','RecoveryCenterModal');
function doc(){const d:any={defaultView:{setTimeout:(callback:()=>void)=>queueMicrotask(callback),navigator:{clipboard:{writeText:async(_text:string)=>{}}}}};d.body=new El(d);return d;}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const button=(root:El,text:string)=>root.querySelectorAll('button').find(e=>e.textContent===text)!;
const item=(read:()=>string|Promise<string>=()=> 'exact memory')=>({id:'one',kind:'写作',title:'合成',storage:'memory',description:'volatile',read});
test('recovery copy uses the current full payload; denied clipboard provides selectable text without writes',async()=>{
 const d=doc(),copied:string[]=[],sink=async(text:string)=>{copied.push(text);};d.defaultView.navigator.clipboard.writeText=sink;let value='first';const m=new Center({doc:d},async()=>[item(()=>value)]);m.onOpen();await settle();const row=m.contentEl.querySelectorAll('[data-recovery-row]')[0];value='latest unsaved full text';assert.equal(d.defaultView.navigator.clipboard.writeText,sink);assert.equal(Object.getPrototypeOf(d.defaultView.navigator),Object.prototype);await button(row,'复制当前全文').onclick!();assert.deepEqual(copied,[value]);assert.equal(row.querySelectorAll('textarea')[0].readOnly,true);
 d.defaultView.navigator.clipboard.writeText=async()=>{throw Error('denied');};await button(row,'复制当前全文').onclick!();const text=row.querySelectorAll('textarea')[0];assert.equal(text.value,value);assert.equal(text.selected,true);assert.equal(row.open,true);assert.ok(row.querySelectorAll('p').some((e:El)=>e.textContent.includes('手动复制')));m.close();
});
test('closing a recovery center invalidates a pending list without reopening or writing',async()=>{
 const d=doc();let resolve!:(value:any[])=>void;const m=new Center({doc:d},()=>new Promise<any[]>(r=>resolve=r));m.onOpen();m.close();resolve([item()]);await settle();assert.equal(m.contentEl.querySelectorAll('[data-recovery-row]').length,0);
});
test('recovery refresh discards late old list and stale row copies',async()=>{
 const d=doc(),pending:((items:any[])=>void)[]=[];const m=new Center({doc:d},()=>new Promise<any[]>(r=>pending.push(r)));m.onOpen();button(m.contentEl,'刷新列表').onclick!();pending[1]([{...item(),id:'new'}]);await settle();pending[0]([{...item(),id:'old'}]);await settle();assert.deepEqual(m.contentEl.querySelectorAll('[data-recovery-row]').map((e:El)=>e.attrs['data-recovery-row']),['new']);const old=m.contentEl.querySelectorAll('[data-recovery-row]')[0];button(m.contentEl,'刷新列表').onclick!();await button(old,'复制当前全文').onclick!();assert.equal(old.querySelectorAll('textarea')[0].value,'');pending[2]([]);await settle();m.close();
});
test('recovery open failure retains the modal and content; reopen reads providers again',async()=>{
 const d=doc();let calls=0;const list=async()=>{calls++;return[{...item(),open:async()=>{throw Error('source changed');}}];};const first=new Center({doc:d},list);first.onOpen();await settle();const row=first.contentEl.querySelectorAll('[data-recovery-row]')[0];await button(row,'打开原处理入口').onclick!();assert.equal(first.containerEl.isConnected,true);assert.ok(row.querySelectorAll('p').some((e:El)=>e.textContent.includes('source changed')));first.close();const next=new Center({doc:d},list);next.onOpen();await settle();assert.equal(calls,2);next.close();
});
test('a late recovery detail read cannot replace a newer opened preview',async()=>{
 const d=doc(),pending:((text:string)=>void)[]=[],m=new Center({doc:d},async()=>[item(()=>new Promise<string>(r=>pending.push(r)))]);m.onOpen();await settle();const row=m.contentEl.querySelectorAll('[data-recovery-row]')[0];row.open=true;row.ontoggle!();row.open=false;row.ontoggle!();row.open=true;row.ontoggle!();assert.equal(pending.length,2);
 pending[1]('newest preview');await settle();assert.equal(row.querySelectorAll('textarea')[0].value,'newest preview');pending[0]('old delayed preview');await settle();assert.equal(row.querySelectorAll('textarea')[0].value,'newest preview');m.close();
});
test('source checks reject unsaved native input and late responses never repopulate closed modal',async()=>{
 const d=doc(),file=new TFile('Source.md'),raw='original material',check=sources.makeWritingSourceCheck({nodeId:'n',kind:'note',path:file.path,ctime:1},raw,0,raw.length,'quote');let unsaved=true,writes=0,read:()=>Promise<string>=async()=>raw;
 const View=load('src/writing-source-check-view.ts','WritingSourceCheckModal',{assertNativeNoteUnchanged(){if(unsaved)throw Error('native unsaved input');}}),app={doc:d,vault:{getAbstractFileByPath:()=>file,read:()=>read(),modify:()=>{writes++;}}};const m=new View(app,[check],()=> 'quote',()=>undefined,()=>true);m.onOpen();await settle();assert.ok(m.contentEl.querySelectorAll('p').some((e:El)=>e.textContent.includes('native unsaved')));assert.equal(writes,0);
 unsaved=false;let resolve!:(value:string)=>void;read=()=>new Promise<string>(r=>resolve=r);button(m.contentEl,'重新检查').onclick!();m.close();resolve('changed');await settle();assert.equal(m.contentEl.children.length,0);assert.equal(writes,0);
});
test('source snapshots reuse reads within a pass, invalidate stat changes and refresh without trusting unsaved buffers',async()=>{
 const d=doc(),file=new TFile('Source.md'),original='original source material',entries=Array.from({length:12},()=>sources.makeWritingSourceCheck({nodeId:'n',kind:'note',path:file.path,ctime:1},original,0,original.length,'quote'));let raw=original,reads=0,assertions=0,unsaved=false;
 const View=load('src/writing-source-check-view.ts','WritingSourceCheckModal',{assertNativeNoteUnchanged(){if(unsaved)throw Error('unsaved input');if(++assertions===4){raw='changed source material';file.stat.mtime++;}}}),app={doc:d,vault:{getAbstractFileByPath:()=>file,read:async()=>{reads++;return raw;}}};const m=new View(app,entries,()=> 'quote',()=>undefined,()=>true);m.onOpen();for(let i=0;i<8;i++)await settle();assert.equal(reads,2);const summaries=m.contentEl.querySelectorAll('summary');assert.equal(summaries.filter((e:El)=>e.textContent.includes('已落盘来源与引用时相同')).length,4);assert.equal(summaries.filter((e:El)=>e.textContent.includes('来源已变化')).length,8);
 unsaved=true;button(m.contentEl,'重新检查').onclick!();for(let i=0;i<8;i++)await settle();assert.equal(reads,3);assert.equal(m.contentEl.querySelectorAll('p').filter((e:El)=>e.textContent.includes('unsaved input')).length,12);m.close();
});
