import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {brainRelationLabels} from '../src/brain-board-create';
import {safeName} from '../src/model';

type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string;value?:string};
class Element {
 children:Element[]=[];attributes:Record<string,string>={};classes=new Set<string>();value='';disabled=false;hidden=false;isConnected=true;writes=0;text='';
 onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;onkeydown?:((event:any)=>void);focusCount=0;
 constructor(readonly tagName:string,public ownerDocument:any,options:Options|string={}){const opts=typeof options==='string'?{cls:options}:options;this.text=opts.text||'';this.value=opts.value||'';this.attributes={...opts.attr};for(const cls of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(cls);}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag.toUpperCase(),this.ownerDocument,options);this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(name:string){this.classes.add(name);}setText(text:string){this.writes++;this.text=text;this.children=[];}setAttribute(name:string,value:string){this.attributes[name]=value;}empty(){this.children=[];this.text='';}appendChild(child:Element){child.ownerDocument=this.ownerDocument;this.children.push(child);}focus(){this.focusCount++;this.ownerDocument.activeElement=this;}
 click(){if(!this.disabled&&!this.hidden)this.onclick?.();}all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}
}
class Modal {
 readonly containerEl:Element;readonly modalEl:Element;readonly contentEl:Element;closeCount=0;
 constructor(app:{document:any}){this.containerEl=new Element('DIV',app.document);this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();}
 open(){(this as unknown as {onOpen:()=>void}).onOpen();}close(){this.closeCount++;(this as unknown as {onClose:()=>void}).onClose();this.containerEl.isConnected=false;}
}
const source=readFileSync('src/brain-board-create-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const BrainRelationCreateModal=new Function('Modal','brainRelationLabels','safeName',transformSync(source+'\nreturn BrainRelationCreateModal;',{loader:'ts'}).code)(Modal,brainRelationLabels,safeName);
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function deferred(){let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(){
 const doc:any={defaultView:{closed:false,requestAnimationFrame:()=>1,cancelAnimationFrame(){}},activeElement:null};doc.body=new Element('BODY',doc);
 let current=true,canRetry=false;const commits:any[]=[],retries:any[]=[],pending:ReturnType<typeof deferred>[]=[];
 const host:any={document:doc,center:'Original idea',folder:'Notes/Chosen',convert:true,current:()=>current,pick:()=>{throw Error('Unexpected picker');},canRetry:()=>canRetry,commit:(target:any,live:()=>boolean)=>{commits.push({target,live});const d=deferred();pending.push(d);return d.promise;},retry:(live:()=>boolean)=>{retries.push(live);const d=deferred();pending.push(d);return d.promise;}};
 const modal=new BrainRelationCreateModal({document:doc},host);modal.open();const root=modal.contentEl as Element;
 const name=root.all().find(e=>e.attributes['aria-label']==='笔记名称')!,folder=root.all().find(e=>e.attributes['aria-label']==='目标文件夹')!,status=root.all().find(e=>e.attributes.role==='status')!,save=root.all().find(e=>e.textContent==='确定')!,cancel=root.all().find(e=>e.textContent==='取消')!;
 name.value='User chosen name';name.oninput?.();folder.value='Notes/User target';folder.oninput?.();
 return{modal,root,host,name,folder,status,save,cancel,commits,retries,pending,setCurrent:(v:boolean)=>{current=v;},setRetry:(v:boolean)=>{canRetry=v;}};
}

test('native conversion dialog shows a write failure even after its owner becomes read-only, retaining all input',async()=>{
 const f=fixture();f.save.click();f.setCurrent(false);f.setRetry(true);f.pending[0].reject(Error('Board save failed: recovery retained'));await tick();
 assert.match(f.status.textContent,/Board save failed/);assert.equal(f.name.value,'User chosen name');assert.equal(f.folder.value,'Notes/User target');assert.equal(f.save.textContent,'重试保存');assert.equal(f.save.disabled,false);assert.equal(f.cancel.disabled,false);assert.equal(f.name.disabled,true);assert.equal(f.modal.closeCount,0);
});

test('retry-save uses the dedicated persistence callback once and never repeats native note creation',async()=>{
 const f=fixture();f.save.click();f.setCurrent(false);f.setRetry(true);f.pending[0].reject(Error('Write failed'));await tick();f.save.click();f.save.click();assert.equal(f.commits.length,1);assert.equal(f.retries.length,1);assert.equal(f.retries[0](),true);assert.match(f.status.textContent,/正在重试保存/);f.setRetry(false);f.pending[1].resolve();await tick();assert.equal(f.modal.closeCount,1);
});

test('a second save failure remains visible and retryable without discarding the name or target folder',async()=>{
 const f=fixture();f.save.click();f.setCurrent(false);f.setRetry(true);f.pending[0].reject(Error('First failure'));await tick();f.save.click();f.pending[1].reject(Error('Second failure'));await tick();assert.equal(f.status.textContent,'Second failure');assert.equal(f.save.textContent,'重试保存');assert.equal(f.save.disabled,false);assert.equal(f.name.value,'User chosen name');assert.equal(f.folder.value,'Notes/User target');f.cancel.click();assert.equal(f.modal.closeCount,1);
});

test('cancel during an asynchronous retry invalidates its live callback and prevents late error/focus updates',async()=>{
 const f=fixture();f.save.click();f.setCurrent(false);f.setRetry(true);f.pending[0].reject(Error('Failure'));await tick();f.save.click();f.cancel.click();const writes=f.status.writes,focus=f.name.focusCount;assert.equal(f.retries[0](),false);f.pending[1].reject(Error('Late failure'));await tick();assert.equal(f.status.writes,writes);assert.equal(f.name.focusCount,focus);assert.equal(f.root.children.length,0);assert.equal(f.modal.closeCount,1);
});

test('uncommitted native-note creation failure allows an ordinary retry with the same preserved target',async()=>{
 const f=fixture();f.save.click();f.pending[0].reject(Error('Cannot create file'));await tick();assert.equal(f.save.textContent,'重试');assert.equal(f.name.disabled,false);assert.equal(f.folder.disabled,false);f.save.click();assert.equal(f.commits.length,2);assert.deepEqual(f.commits[1].target,f.commits[0].target);assert.equal(f.retries.length,0);f.pending[1].resolve();await tick();assert.equal(f.modal.closeCount,1);
});

test('an invalid owner without a safe retry still exposes the error and leaves cancellation available',async()=>{
 const f=fixture();f.save.click();f.setCurrent(false);f.pending[0].reject(Error('Owner changed; no overwrite'));await tick();assert.equal(f.status.textContent,'Owner changed; no overwrite');assert.equal(f.save.disabled,true);assert.equal(f.cancel.disabled,false);assert.equal(f.name.value,'User chosen name');f.cancel.click();assert.equal(f.modal.closeCount,1);
});

const renameSource=readFileSync('src/brain-board-rename-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const RenameModal=new Function('Modal',transformSync(renameSource+'\nreturn BrainNodeRenameModal;',{loader:'ts'}).code)(Modal);
function renameFixture(){
 const doc:any={defaultView:{closed:false,requestAnimationFrame:()=>1,cancelAnimationFrame(){}},activeElement:null};doc.body=new Element('BODY',doc);(Element.prototype as any).select=function(){};
 let current=true,retry=false;const pending:ReturnType<typeof deferred>[]=[];const commits:any[]=[];
 const modal=new RenameModal({document:doc},{document:doc,title:'重命名想法',name:'Original',description:'保留关系',current:()=>current,retrying:()=>retry,commit:(name:string,live:()=>boolean)=>{commits.push({name,live});const d=deferred();pending.push(d);return d.promise;}});modal.open();
 const all=modal.contentEl.all(),name=all.find((e:Element)=>e.attributes['aria-label']==='新名称'),save=all.find((e:Element)=>e.text==='确定'),cancel=all.find((e:Element)=>e.text==='取消'),status=all.find((e:Element)=>e.attributes.role==='status');return{modal,name,save,cancel,status,commits,pending,setCurrent:(v:boolean)=>current=v,setRetry:(v:boolean)=>retry=v};
}
test('rename modal disables empty names, invalidates cancel and leaves a collision visible for corrected retry',async()=>{
 const f=renameFixture();f.name.value=' ';f.name.oninput();assert(f.save.disabled);f.name.value='Conflict';f.name.oninput();f.save.click();assert.equal(f.commits.length,1);f.pending[0].reject(Error('同名文件'));await tick();assert.equal(f.status.textContent,'同名文件');assert.equal(f.name.disabled,false);assert.equal(f.save.textContent,'重试');f.name.value='New';f.name.oninput();f.save.click();assert.equal(f.commits[1].name,'New');f.cancel.click();assert(!f.commits[1].live());f.pending[1].resolve();await tick();assert.equal(f.modal.closeCount,1);
});
test('committed rename save failure freezes the original name and exposes persistence retry',async()=>{const f=renameFixture();f.save.click();f.setRetry(true);f.pending[0].reject(Error('保存失败'));await tick();assert(f.name.disabled);assert.equal(f.save.textContent,'重试保存');assert.equal(f.save.disabled,false);f.save.click();assert.equal(f.commits.length,2);assert.equal(f.commits[1].name,'Original');f.pending[1].resolve();await tick();assert.equal(f.modal.closeCount,1);});
test('board creation dialog uses the existing two board types and preserves separate target folders',()=>{
 const f=fixture();f.host.convert=false;f.host.initial='board';f.host.boardFolder='Boards';const modal=new BrainRelationCreateModal({document:f.host.document},f.host);modal.open();const all=modal.contentEl.all(),mode=all.find((e:Element)=>e.attributes['aria-label']==='笔记来源')!,type=all.find((e:Element)=>e.attributes['aria-label']==='白板类型')!,folder=all.find((e:Element)=>e.attributes['aria-label']==='目标文件夹')!,name=all.find((e:Element)=>e.attributes['aria-label']==='白板名称')!,save=all.find((e:Element)=>e.text==='确定')!;
 assert.equal(mode.value,'board');assert.equal(type.value,'board');assert.deepEqual(type.children.map((e:Element)=>e.value),['board','brain']);assert.equal(folder.value,'Boards');assert(save.disabled);name.value='Board';name.oninput!();type.value='brain';save.click();assert.deepEqual(f.commits[0].target,{kind:'board',name:'Board',folder:'Boards',presentation:'brain'});
});
test('idea organization offers explicit body-preserving existing-note association and submits the captured source identity',async()=>{
 const f=fixture(),mode=f.root.all().find(e=>e.attributes['aria-label']==='笔记来源')!;assert.equal(mode.hidden,false);assert.deepEqual(mode.children.map(e=>e.value),['new','existing']);assert.match(mode.children[1].textContent,/保留想法并关联/);
 let choose!:(file:any)=>void;f.host.pick=(callback:any)=>{choose=callback;const picker=new Modal({document:f.host.document});Object.assign(picker,{onOpen(){},onClose(){}});return picker;};mode.value='existing';mode.onchange!();const select=f.root.all().find(e=>e.tagName==='BUTTON'&&e.textContent==='选择已有笔记…')!;assert.equal(f.name.hidden,true);assert.equal(f.folder.hidden,true);assert.equal(f.save.disabled,true);assert.match(f.root.textContent,/正文.*不变/);select.click();const file={path:'Notes/Existing.md'};choose(file);f.save.click();assert.deepEqual(f.commits[0].target,{kind:'existing',file,path:file.path});f.pending[0].resolve();await tick();assert.equal(f.modal.closeCount,1);
});
test('existing-note relation confirmation starts with the picked file and offers only association placement',()=>{
 const f=fixture(),file={path:'Notes/Chosen.md'};f.host.convert=false;f.host.side='right';f.host.initialExisting={file,path:file.path};f.host.chooseAssociationSide=true;const modal=new BrainRelationCreateModal({document:f.host.document},f.host);modal.open();const all=modal.contentEl.all(),mode=all.find((e:Element)=>e.attributes['aria-label']==='笔记来源')!,side=all.find((e:Element)=>e.attributes['aria-label']==='关联位置')!,save=all.find((e:Element)=>e.text==='确定')!;assert.equal(mode.value,'existing');assert.equal(mode.hidden,true);assert.deepEqual(side.children.map((e:Element)=>e.value),['left','right']);side.value='left';side.onchange!();save.click();assert.deepEqual(f.commits[0].target,{kind:'existing',file,path:file.path,side:'left'});
});
