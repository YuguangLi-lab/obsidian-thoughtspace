import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {boardHostDeps} from './board-host-deps';

// Execute the production modal lifecycle with only Obsidian's host boundary replaced.
class El {
 children:El[]=[];parent?:El;connected=true;textContent='';className='';attrs:Record<string,string>={};open=false;ontoggle?:()=>void;onclick?:()=>unknown;
 get isConnected():boolean{return this.connected&&(!this.parent||this.parent.isConnected)}
 createEl(_tag:string,options:any={}){const el=new El();el.parent=this;el.className=options.cls||'';el.textContent=options.text||'';Object.assign(el.attrs,options.attr);this.children.push(el);return el}
 createDiv(options:any={}){return this.createEl('div',typeof options==='string'?{cls:options}:options)}
 createSpan(options:any={}){return this.createEl('span',options)}
 addClass(cls:string){this.className+=' '+cls}setText(text:string){this.textContent=text}
 setAttribute(k:string,v:string){this.attrs[k]=v}removeAttribute(k:string){delete this.attrs[k]}
 empty(){for(const el of this.children)el.connected=false;this.children=[];this.textContent=''}
 remove(){this.connected=false;if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this)}
 querySelectorAll(_selector:string){return []}
 all():El[]{return [this,...this.children.flatMap(el=>el.all())]}
}
function deferred<T>(){let resolve!:(v:T)=>void,reject!:(e:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(options:{read?:()=>Promise<string>;render?:()=>Promise<void>;boards?:number;readBoard?:()=>Promise<any>}={}){
 const rendered:string[]=[],scopes:{loaded:boolean}[]=[],openedRelations:{file:unknown;focused:boolean}[]=[];let scans=0;
 class Component{loaded=false;constructor(){scopes.push(this)}load(){this.loaded=true}unload(){this.loaded=false}}
 class Modal{modalEl=new El();titleEl=new El();contentEl=new El();constructor(public app:any){}close(){(this as any).onClose();this.contentEl.connected=false}}
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class NotePreview extends Modal'),end=source.indexOf('/** 一个文件共用',start);
 const factory=new Function('Modal','Component','themeSurface','button','MarkdownRenderer','isWorkspaceFile','EXT','TFile','getFrontMatterInfo',...Object.keys(boardHostDeps).filter(key=>key!=='isWorkspaceFile'),transformSync(source.slice(start,end)+'\nreturn NotePreview',{loader:'ts'}).code);
 const Preview=factory(Modal,Component,()=>{},(el:El,label:string,_icon:string,fn:()=>unknown)=>{const b=el.createEl('button',{text:label});b.onclick=fn;return b},{render:async(_a:any,text:string)=>{rendered.push(text);await options.render?.()}},boardHostDeps.isWorkspaceFile,'thoughtspace',class{},()=>({exists:false,contentStart:0}),...Object.entries(boardHostDeps).filter(([key])=>key!=='isWorkspaceFile').map(([,value])=>value));
 const file={path:'文件名.md',basename:'文件名'};let currentFile:typeof file|undefined=file;
 const app={vault:{read:options.read||(()=>Promise.resolve('# 正文标题\n\n保留全部内容')),getFiles:()=>Array.from({length:options.boards??2},(_,i)=>({path:`b${i}.thoughtspace`,basename:`b${i}`,extension:'thoughtspace'})),getAbstractFileByPath:(path:string)=>currentFile?.path===path?currentFile:undefined},metadataCache:{resolvedLinks:{}}};
 const modal=new Preview(app,file,{readBoard:async()=>{scans++;return options.readBoard?options.readBoard():{nodes:[]}},openNativeRelations:(file:unknown,focused:boolean)=>{openedRelations.push({file,focused});}});
 return{modal,file,rendered,scopes,openedRelations,scans:()=>scans,replaceFile:()=>{currentFile={...file};}};
}
const referenceButtonLabel='查看每张卡片及分组位置';
function relationDetails(modal:any){const details=modal.contentEl.all().find((el:El)=>el.className.includes('ts-preview-relations'));assert.ok(details);return details as El;}
function referenceButton(details:El){const found=details.all().find(el=>el.textContent===referenceButtonLabel);assert.ok(found);return found;}
async function lateClick(button:El){try{await button.onclick?.();}catch(error){assert.match(String(error),/变化|关闭|取消/);}}
test('eye preview preserves the first Markdown heading even when different from filename',async()=>{const f=fixture();await f.modal.onOpen();assert.match(f.rendered[0],/^# 正文标题/)});
test('opening or expanding a note never scans every board; explicit button opens exact occurrence panel once',async()=>{const f=fixture({boards:1200});await f.modal.onOpen();assert.equal(f.scans(),0);const details=relationDetails(f.modal);details.open=true;await details.ontoggle?.();assert.equal(f.scans(),0);assert.equal(f.openedRelations.length,0);details.open=false;await details.ontoggle?.();details.open=true;await details.ontoggle?.();assert.equal(f.scans(),0);assert.equal(details.all().filter(el=>el.textContent===referenceButtonLabel).length,1);const locate=referenceButton(details);await locate.onclick?.();assert.equal(f.openedRelations.length,1);assert.equal(f.openedRelations[0].file,f.file);assert.equal(f.openedRelations[0].focused,true);assert.equal(f.scans(),0);assert.ok(f.scopes.every(s=>!s.loaded));await lateClick(locate);assert.equal(f.openedRelations.length,1)});
test('read failure is contained and retry restores the note',async()=>{let reads=0;const f=fixture({read:async()=>{if(!reads++)throw Error('read failed');return '# 重试成功'}});await assert.doesNotReject(()=>f.modal.onOpen());const retry=f.modal.contentEl.all().find((el:El)=>el.textContent==='重试');assert.ok(retry);await retry.onclick();assert.equal(f.rendered[0],'# 重试成功');f.modal.close();assert.ok(f.scopes.every(s=>!s.loaded))});
test('closing while reading prevents late rendering and contains a delayed read error',async()=>{const wait=deferred<string>(),f=fixture({read:()=>wait.promise});const opened=f.modal.onOpen();f.modal.close();wait.reject(Error('late failure'));await assert.doesNotReject(()=>opened);assert.equal(f.rendered.length,0);assert.ok(f.scopes.every(s=>!s.loaded))});
test('closing while Markdown renders releases components again after renderer completion',async()=>{const wait=deferred<void>(),f=fixture({render:()=>wait.promise});const opened=f.modal.onOpen();await Promise.resolve();f.modal.close();wait.resolve();await opened;assert.ok(f.scopes.every(s=>!s.loaded));assert.equal(f.scans(),0)});
test('closing after relation expansion prevents a retained late button from scanning or opening',async()=>{const wait=deferred<any>(),f=fixture({boards:1200,readBoard:()=>wait.promise});await f.modal.onOpen();const details=relationDetails(f.modal);details.open=true;await details.ontoggle?.();assert.equal(f.scans(),0);const locate=referenceButton(details);f.modal.close();wait.resolve({nodes:[]});await lateClick(locate);assert.equal(f.scans(),0);assert.equal(f.openedRelations.length,0);assert.ok(f.scopes.every(s=>!s.loaded))});
test('same-path source replacement refuses an old preview relation button without touching the source',async()=>{const f=fixture();await f.modal.onOpen();const details=relationDetails(f.modal);details.open=true;await details.ontoggle?.();const locate=referenceButton(details);f.replaceFile();await lateClick(locate);assert.equal(f.openedRelations.length,0);assert.equal(f.scans(),0);assert.match(f.rendered[0],/^# 正文标题/);f.modal.close();assert.ok(f.scopes.every(s=>!s.loaded))});
test('collapsed relation details do not dispatch a hidden action',async()=>{const f=fixture();await f.modal.onOpen();const details=relationDetails(f.modal);details.open=true;await details.ontoggle?.();const locate=referenceButton(details);details.open=false;await details.ontoggle?.();await lateClick(locate);assert.equal(f.openedRelations.length,0);assert.equal(f.scans(),0);details.open=true;await details.ontoggle?.();assert.equal(details.all().filter(el=>el.textContent===referenceButtonLabel).length,1);await locate.onclick?.();assert.equal(f.openedRelations.length,1);assert.equal(f.openedRelations[0].file,f.file)});
test('refreshing preview invalidates the prior relation button and preserves renderer/component cleanup',async()=>{const f=fixture();await f.modal.onOpen();const details=relationDetails(f.modal);details.open=true;await details.ontoggle?.();const old=referenceButton(details),body=f.modal.contentEl.all().find((el:El)=>el.className==='ts-preview-body');assert.ok(body);await f.modal.loadPreview(body);await lateClick(old);assert.equal(f.openedRelations.length,0);assert.equal(f.scans(),0);assert.equal(f.rendered.length,2);assert.ok(f.scopes.slice(0,-1).every(s=>!s.loaded));const current=relationDetails(f.modal);current.open=true;await current.ontoggle?.();await referenceButton(current).onclick?.();assert.equal(f.openedRelations.length,1);assert.equal(f.openedRelations[0].file,f.file);assert.ok(f.scopes.every(s=>!s.loaded))});
