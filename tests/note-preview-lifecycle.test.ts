import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

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
 const rendered:string[]=[],scopes:{loaded:boolean}[]=[];let scans=0;
 class Component{loaded=false;constructor(){scopes.push(this)}load(){this.loaded=true}unload(){this.loaded=false}}
 class Modal{modalEl=new El();titleEl=new El();contentEl=new El();constructor(public app:any){}close(){(this as any).onClose();this.contentEl.connected=false}}
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class NotePreview extends Modal'),end=source.indexOf('/** 一个文件共用',start);
 const factory=new Function('Modal','Component','themeSurface','button','MarkdownRenderer','isWorkspaceFile','EXT','TFile','getFrontMatterInfo',transformSync(source.slice(start,end)+'\nreturn NotePreview',{loader:'ts'}).code);
 const Preview=factory(Modal,Component,()=>{},(el:El,label:string,_icon:string,fn:()=>unknown)=>{const b=el.createEl('button',{text:label});b.onclick=fn;return b},{render:async(_a:any,text:string)=>{rendered.push(text);await options.render?.()}},()=>true,'thoughtspace',class{},()=>({exists:false,contentStart:0}));
 const app={vault:{read:options.read||(()=>Promise.resolve('# 正文标题\n\n保留全部内容')),getFiles:()=>Array.from({length:options.boards??2},(_,i)=>({path:`b${i}.thoughtspace`,basename:`b${i}`,extension:'thoughtspace'})),getAbstractFileByPath:()=>undefined},metadataCache:{resolvedLinks:{}}};
 const modal=new Preview(app,{path:'文件名.md',basename:'文件名'},{readBoard:async()=>{scans++;return options.readBoard?options.readBoard():{nodes:[]}}});
 return{modal,rendered,scopes,scans:()=>scans};
}
test('eye preview preserves the first Markdown heading even when different from filename',async()=>{const f=fixture();await f.modal.onOpen();assert.match(f.rendered[0],/^# 正文标题/)});
test('opening a note does not read every board; related boards load once on demand',async()=>{const f=fixture({boards:1200});await f.modal.onOpen();assert.equal(f.scans(),0);const details=f.modal.contentEl.all().find((el:El)=>el.className.includes('ts-preview-relations'));assert.ok(details);details.open=true;await details.ontoggle();assert.equal(f.scans(),1200);details.open=false;await details.ontoggle();details.open=true;await details.ontoggle();assert.equal(f.scans(),1200);f.modal.close()});
test('read failure is contained and retry restores the note',async()=>{let reads=0;const f=fixture({read:async()=>{if(!reads++)throw Error('read failed');return '# 重试成功'}});await assert.doesNotReject(()=>f.modal.onOpen());const retry=f.modal.contentEl.all().find((el:El)=>el.textContent==='重试');assert.ok(retry);await retry.onclick();assert.equal(f.rendered[0],'# 重试成功');f.modal.close();assert.ok(f.scopes.every(s=>!s.loaded))});
test('closing while reading prevents late rendering and contains a delayed read error',async()=>{const wait=deferred<string>(),f=fixture({read:()=>wait.promise});const opened=f.modal.onOpen();f.modal.close();wait.reject(Error('late failure'));await assert.doesNotReject(()=>opened);assert.equal(f.rendered.length,0);assert.ok(f.scopes.every(s=>!s.loaded))});
test('closing while Markdown renders releases components again after renderer completion',async()=>{const wait=deferred<void>(),f=fixture({render:()=>wait.promise});const opened=f.modal.onOpen();await Promise.resolve();f.modal.close();wait.resolve();await opened;assert.ok(f.scopes.every(s=>!s.loaded));assert.equal(f.scans(),0)});
test('closing during related-board lookup stops further reads',async()=>{const wait=deferred<any>();let armed=false;const f=fixture({readBoard:()=>armed?wait.promise:Promise.resolve({nodes:[]})});await f.modal.onOpen();armed=true;const details=f.modal.contentEl.all().find((el:El)=>el.className.includes('ts-preview-relations'));assert.ok(details);details.open=true;const lookup=details.ontoggle();assert.equal(f.scans(),1);f.modal.close();wait.resolve({nodes:[]});await lookup;assert.equal(f.scans(),1)});
