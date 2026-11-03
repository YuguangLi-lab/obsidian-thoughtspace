import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {mermaidMarkdown} from '../src/mermaid-card';
import {releaseEditorResource} from '../src/editor-cleanup';

class El {
 children:El[]=[];parentElement?:El;value='';text='';disabled=false;dataset:Record<string,string>={};attrs:Record<string,string>={};classes=new Set<string>();listeners=new Map<string,Set<()=>void>>();onclick?:()=>void;oninput?:()=>void;onkeydown?:(event:any)=>void;
 constructor(readonly ownerDocument:any,readonly tag='div',options:any={}){if(typeof options==='string')options={cls:options};this.text=options.text||'';this.attrs=options.attr||{};for(const name of(options.cls||'').split(' '))this.classes.add(name);}
 get isConnected():boolean{return this===this.ownerDocument.body||!!this.parentElement?.isConnected;}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:any={}){const child=new El(this.ownerDocument,tag,options);child.parentElement=this;this.children.push(child);return child;}
 createDiv(options:any={}){return this.createEl('div',options);}
 addClass(name:string){this.classes.add(name);}setText(text:string){this.empty();this.text=text;}setAttribute(key:string,value:string){this.attrs[key]=value;}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];this.text='';}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 querySelector(selector:string):El|undefined{for(const child of this.children){if(selector.startsWith('.')?child.classes.has(selector.slice(1)):child.tag===selector)return child;const inner=child.querySelector(selector);if(inner)return inner;}}
 addEventListener(name:string,listener:()=>void){const all=this.listeners.get(name)||new Set();all.add(listener);this.listeners.set(name,all);}
 removeEventListener(name:string,listener:()=>void){this.listeners.get(name)?.delete(listener);}emit(name:string){for(const listener of this.listeners.get(name)||[])listener();}
 focus(){this.ownerDocument.activeElement=this;}
}
class Scope {
 loaded=false;callbacks:(()=>void)[]=[];register(fn:()=>void){this.callbacks.push(fn);}load(){this.loaded=true;}unload(){this.loaded=false;for(const callback of this.callbacks.splice(0))callback();}
}
class Modal {
 containerEl:El;modalEl:El;titleEl:El;contentEl:El;
 constructor(readonly app:any){this.containerEl=app.doc.body.createDiv();this.modalEl=this.containerEl.createDiv();this.titleEl=this.modalEl.createDiv();this.contentEl=this.modalEl.createDiv();}
 close(){(this as any).onClose();this.containerEl.remove();}
}
function deferred(){let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(save:(source:string)=>Promise<void>=async()=>{}){
 const timers=new Map<number,{callback:()=>void;ms:number}>(),observers:{callback:()=>void;active:boolean}[]=[],jobs:{app:unknown;markdown:string;root:El;path:string;scope:Scope;gate:ReturnType<typeof deferred>}[]=[];let serial=0,closed=0,released=0;
 const win={setTimeout:(callback:()=>void,ms:number)=>{timers.set(++serial,{callback,ms});return serial;},clearTimeout:(id:number)=>timers.delete(id),MutationObserver:class{entry:{callback:()=>void;active:boolean};constructor(callback:()=>void){this.entry={callback,active:true};observers.push(this.entry);}observe(){}disconnect(){this.entry.active=false;}}};
 const doc:any={defaultView:win};doc.body=new El(doc,'body');
 const imports:Record<string,unknown>={obsidian:{Modal,Component:Scope,MarkdownRenderer:{render:(app:unknown,markdown:string,root:El,path:string,scope:Scope)=>{const gate=deferred();jobs.push({app,markdown,root,path,scope,gate});return gate.promise;}}},'./mermaid-card':{mermaidMarkdown},'./ui-tokens':{themeSurface(){}},'./board-modal-viewport':{bindBoardModalViewport:()=>()=>released++},'./editor-cleanup':{releaseEditorResource}};
 function load(file:string){const module={exports:{}as any};new Function('require','module','exports',transformSync(readFileSync(file,'utf8'),{loader:'ts',format:'cjs'}).code)((id:string)=>{assert.ok(id in imports,id);return imports[id];},module,module.exports);return module.exports;}
 imports['./preview-render-scope']=load('src/preview-render-scope.ts');const View=load('src/mermaid-editor-modal.ts').MermaidEditorModal,app={doc},modal=new View(app,{source:'flowchart TD\n A-->B',sourcePath:'QA/Board.thoughtspace',onSave:save,onClosed:()=>closed++});modal.onOpen();
 const input=()=>modal.contentEl.querySelector('textarea')as El,status=()=>modal.contentEl.querySelector('.ts-mermaid-editor-status')as El,preview=()=>modal.contentEl.querySelector('.ts-mermaid-editor-preview')as El;
 const edit=(source:string)=>{input().value=source;input().oninput!();};
 const runTimers=(ms:number)=>{for(const[id,timer]of[...timers])if(timer.ms===ms){timers.delete(id);timer.callback();}};
 return{modal,app,jobs,timers,observers,input,status,preview,edit,runTimers,counts:()=>({closed,released}),notify:()=>observers.filter(o=>o.active).forEach(o=>o.callback())};
}

test('preview uses an attached native root, board path and owned scope; rendering never saves',async()=>{
 const saved:string[]=[],f=fixture(async source=>{saved.push(source);});const job=f.jobs[0];assert.equal(job.root.isConnected,true);assert.equal(job.path,'QA/Board.thoughtspace');assert.equal(job.app,f.app);assert.equal(job.scope.loaded,true);assert.equal(job.markdown,mermaidMarkdown(f.input().value));assert.deepEqual(saved,[]);
 job.root.createEl('svg');job.gate.resolve();await tick();assert.equal(f.preview().dataset.renderStatus,'ready');assert.equal(f.preview().attrs['aria-busy'],'false');f.modal.close();assert.equal(job.scope.loaded,false);assert.equal(f.observers[0].active,false);assert.deepEqual(f.counts(),{closed:1,released:1});
});

test('edits debounce and immediately revoke stale renders; late results cannot replace new preview',async()=>{
 const f=fixture(),old=f.jobs[0];f.edit('first draft');f.edit('latest draft');assert.equal(old.scope.loaded,false);assert.equal(old.root.isConnected,false);assert.equal(f.jobs.length,1);f.runTimers(200);assert.equal(f.jobs.length,2);const current=f.jobs[1];assert.equal(current.markdown,mermaidMarkdown('latest draft'));current.root.createEl('svg');current.gate.resolve();await tick();old.root.createDiv('pele-error');old.gate.reject(Error('late error'));await tick();assert.equal(f.preview().dataset.renderStatus,'ready');assert.equal(f.status().text,'预览已更新');f.modal.close();
});

test('cancel pending preview keeps draft local and releases timers and late processor resources',async()=>{
 let saves=0;const f=fixture(async()=>{saves++;}),old=f.jobs[0];f.edit('discard this');f.modal.close();await tick();assert.equal(saves,0);assert.equal(f.timers.size,0);assert.equal(old.scope.loaded,false);let cleanup=0;old.scope.register(()=>cleanup++);assert.equal(cleanup,1);old.gate.resolve();await tick();assert.equal(f.modal.contentEl.children.length,0);assert.deepEqual(f.counts(),{closed:1,released:1});
});

test('Pele DOM syntax errors remain visible and can be saved as source without silent loss',async()=>{
 const saved:string[]=[],f=fixture(async source=>{saved.push(source);});const job=f.jobs[0];job.root.createDiv('pele-error');job.gate.resolve();await tick();assert.equal(f.preview().dataset.renderStatus,'error');assert.match(f.status().text,/语法有误/);const original=f.input().value;await f.modal.submit();assert.deepEqual(saved,[original]);assert.equal(f.counts().closed,1);
});

test('save is single-flight, freezes input and closing, and rejected writes retain exact draft',async()=>{
 const gate=deferred(),saved:string[]=[],f=fixture(async source=>{saved.push(source);await gate.promise;});const source='flowchart TD\n A["未保存"]-->B\n\n';f.edit(source);const first=f.modal.submit();void f.modal.submit();f.modal.close();assert.equal(f.input().disabled,true);assert.equal(f.counts().closed,0);assert.deepEqual(saved,[source]);gate.reject(Error('board changed'));await first;assert.equal(f.input().value,source);assert.equal(f.input().disabled,false);assert.match(f.modal.contentEl.querySelector('.ts-mermaid-editor-error')!.text,/board changed/);f.modal.close();assert.equal(f.counts().closed,1);
});

test('owner close disposes a pending save and failed completion cannot restore the orphan dialog',async()=>{
 const gate=deferred(),saved:string[]=[],f=fixture(async source=>{saved.push(source);await gate.promise;}),job=f.jobs[0];
 const saving=f.modal.submit();f.modal.close();assert.equal(f.counts().closed,0,'ordinary cancellation stays blocked while saving');
 f.modal.closeForOwner();assert.equal(f.modal.containerEl.isConnected,false);assert.equal(job.scope.loaded,false);assert.equal(f.observers[0].active,false);assert.equal(f.timers.size,0);assert.deepEqual(f.counts(),{closed:1,released:1});
 gate.reject(Error('owner changed and flush failed'));await saving;job.gate.resolve();await tick();
 assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.modal.containerEl.isConnected,false);assert.equal(saved.length,1);f.modal.closeForOwner();assert.deepEqual(f.counts(),{closed:1,released:1});
});

test('composition defers preview and keyboard saving until composition ends',async()=>{
 const saved:string[]=[],f=fixture(async source=>{saved.push(source);});f.input().emit('compositionstart');f.edit('flowchart TD\n A["输入"]');f.runTimers(200);assert.equal(f.jobs.length,1);f.input().onkeydown!({metaKey:true,key:'Enter',isComposing:true,preventDefault(){}});assert.deepEqual(saved,[]);f.input().emit('compositionend');f.runTimers(200);assert.equal(f.jobs.length,2);f.input().onkeydown!({ctrlKey:true,key:'Enter',preventDefault(){}});await tick();assert.equal(saved.length,1);assert.equal(f.counts().closed,1);
});

test('renderer timeout releases native resources and cannot mutate after late resolution',async()=>{
 const f=fixture(),job=f.jobs[0];f.runTimers(8000);await tick();assert.equal(job.scope.loaded,false);assert.equal(job.root.isConnected,false);assert.equal(f.preview().dataset.renderStatus,'error');assert.match(f.status().text,/源码仍可保存/);job.root.createEl('svg');job.gate.resolve();await tick();assert.equal(f.preview().dataset.renderStatus,'error');f.modal.close();
});
