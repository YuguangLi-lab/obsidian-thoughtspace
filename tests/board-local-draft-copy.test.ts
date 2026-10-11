import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import * as geometry from '../src/relation-geometry-checkpoint';
import {createHandwritingBoard,isHandwritingBoard} from '../src/handwriting-board';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {renderBoardSaveFeedback} from '../src/board-save-feedback';
import type {InkStroke} from '../src/ink-model';

class Element {
 children:Element[]=[];parent?:Element;value='';readOnly=false;disabled=false;textContent='';title='';selected=0;focused=0;
 onclick?:()=>void;dataset:Record<string,string>={};classes=new Set<string>();attrs=new Map<string,string>();props=new Map<string,string>();
 style={setProperty:(key:string,value:string)=>this.props.set(key,value)};
 classList={toggle:(name:string,on:boolean)=>{if(on)this.classes.add(name);else this.classes.delete(name);}};
 constructor(public ownerDocument:Doc,readonly tag='div'){}
 get isConnected():boolean{return this.tag==='body'||!!this.parent?.isConnected;}
 private adopt(doc:Doc){this.ownerDocument=doc;for(const child of this.children)child.adopt(doc);}
 appendChild(child:Element){child.remove();child.parent=this;child.adopt(this.ownerDocument);this.children.push(child);return child;}
 createEl(tag:string,options:{cls?:string;text?:string;attr?:Record<string,string>}|string={}){const el=new Element(this.ownerDocument,tag);if(typeof options==='string')el.addClass(options);else{if(options.cls)el.addClass(options.cls);el.textContent=options.text||'';for(const [key,value]of Object.entries(options.attr||{}))el.setAttribute(key,value);}this.appendChild(el);return el;}
 createDiv(options?:Parameters<Element['createEl']>[1]){return this.createEl('div',options);}
 createSpan(options?:Parameters<Element['createEl']>[1]){return this.createEl('span',options);}
 addClass(...names:string[]){for(const name of names.flatMap(value=>value.split(' ')))this.classes.add(name);}
 setText(text:string){this.textContent=text;}
 setAttribute(key:string,value:string){this.attrs.set(key,value);}
 contains(child:Element):boolean{return this===child||this.children.some(value=>value.contains(child));}
 empty(){for(const child of [...this.children])child.remove();}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 focus(_options?:unknown){this.focused++;}
 select(){this.selected++;}
}
class Doc {
 body=new Element(this,'body');clipboard:string[]=[];copyFailure=true;
 defaultView={closed:false,navigator:{clipboard:{writeText:async(text:string)=>{this.clipboard.push(text);if(this.copyFailure)throw Error('Synthetic clipboard denied');}}}};
}
const main=readFileSync('src/main.ts','utf8'),take=(from:string,to:string)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)));
const parseYaml=(raw:string)=>raw.includes('thoughtspace: board')?{thoughtspace:'board'}:{};
const deps={...model,...mindmap,...documents,...geometry,reflowReadingContent,isHandwritingBoard,parseYaml,Notice:class{},EXT:'thoughtspace',report:()=>{},
 hasNativeBoardEditor:(app:{nativeOpen:boolean})=>app.nativeOpen,assertBoardEditorOwnership:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(take('class Session {','\nexport default class ThoughtSpace')+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const sample:InkStroke={id:'ink-1',color:'#315e9b',width:3,points:[[1,2,.5],[40,80,.8]]};
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
async function fixture(format:'md'|'thoughtspace'='md',popout=false){
 const doc=new Doc(),sourceDoc=popout?new Doc():doc,board=createHandwritingBoard(),file={path:`Synthetic.${format}`,extension:String(format),basename:'Synthetic',parent:{path:''}};
 const original=format==='md'?documents.createMarkdownBoardDocument(board,'Synthetic').replace('thoughtspace: board','thoughtspace: board\nuser_property: preserved\nunknown:\n  nested: untouched')+'\nUser Markdown body\n':JSON.stringify(board,null,2);
 let disk=original,writes=0,backups=0,active:any;const refs=new Map<()=>void,string>(),modals:any[]=[],viewportRoots:Element[]=[],viewportDisposals:Element[]=[];
 const app={document:doc,nativeOpen:false,workspace:{getActiveViewOfType:()=>active?.view,on:(event:string,callback:()=>void)=>{const ref=()=>callback();refs.set(ref,event);return ref;},offref:(ref:()=>void)=>refs.delete(ref)},vault:{getAbstractFileByPath:(path:string)=>path===file.path?file:undefined,process:async()=>{writes++;throw Error('Synthetic primary storage offline');}}};
 const plugin={app,createUnique:async()=>{backups++;throw Error('Synthetic recovery storage full');}};
 const session=new Session(plugin,file,disk);session.change((value:model.Board)=>value.ink!.strokes.push(sample));session.changeHandwritingViewport({x:125,y:-70,zoom:.6});await session.flush();
 class Modal {containerEl:Element;modalEl:Element;contentEl:Element;titleEl:Element;closed=false;constructor(_app:unknown){modals.push(this);this.containerEl=doc.body.createDiv();this.modalEl=this.containerEl.createDiv();this.titleEl=this.modalEl.createDiv();this.contentEl=this.modalEl.createDiv();}open(){(this as any).onOpen();}close(){if(this.closed)return;this.closed=true;(this as any).onClose();this.containerEl.remove();}}
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/board-local-draft-copy.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
  if(name==='obsidian')return{Modal};if(name==='./mobile-viewport')return{bindMobileViewport:(root:Element)=>{viewportRoots.push(root);return()=>viewportDisposals.push(root);}};if(name==='./ui-tokens')return{themeSurface:()=>{}};throw Error(`Unexpected dependency ${name}`);
 },module,module.exports);
 const CopyModal=module.exports.BoardLocalDraftCopyModal;
 const View=new Function('View','nativeBoardEditorLeaves','NativeBoardEditorPicker','report','MarkdownView','BoardLocalDraftCopyModal','renderBoardSaveFeedback','act',transformSync('class BoardView{'+take('  private renderSaveStatus(){','  private scheduleRender(')+'};return BoardView',{loader:'ts'}).code)(class{},()=>[],class{},()=>{},class{},CopyModal,renderBoardSaveFeedback,(run:()=>unknown)=>{void run();});
 const view=new View(),leaf={view};Object.assign(view,{app,plugin,session,file,leaf,contentEl:sourceDoc.body.createDiv(),status:sourceDoc.body.createDiv(),closed:false,closing:false});active=leaf;
 const navigate=(next:any)=>{if(next?.view)next.view.leaf=next;active=next;for(const [ref,event]of [...refs])if(event==='active-leaf-change')ref();};
 const fileOpen=()=>{for(const [ref,event]of [...refs])if(event==='file-open')ref();};
 const modal=()=>{assert.equal(modals.length,1);return modals[0] as Modal;};
 const textarea=()=>{const value=modal().contentEl.all().find(el=>el.tag==='textarea');assert.ok(value);return value;};
 const button=(text:string)=>{const value=modal().contentEl.all().find(el=>el.tag==='button'&&el.textContent===text);assert.ok(value,text);return value;};
 return{view,session,file,doc,sourceDoc,refs,modals,leaf,viewportRoots,viewportDisposals,original,modal,textarea,button,navigate,fileOpen,disk:()=>disk,writes:()=>writes,backups:()=>backups,run:()=>view.runSaveFeedbackAction('copy-local-draft') as Promise<void>};
}

for(const format of ['md','thoughtspace'] as const)test(`${format} double storage failure opens a real complete read-only copy surface without touching files or clipboard`,async()=>{
 const f=await fixture(format),pending=f.run(),textarea=f.textarea();assert.equal(textarea.readOnly,true);assert.equal(textarea.value,f.session.localDraftSource());assert.equal(f.sourceDoc.clipboard.length,0);
 const copied=documents.readBoardDocument(textarea.value,format,parseYaml).board;assert.deepEqual(copied.ink,{version:1,strokes:[sample]});assert.deepEqual(copied.viewport,{x:125,y:-70,zoom:.6});
 if(format==='md'){assert.match(textarea.value,/user_property: preserved\nunknown:\n  nested: untouched/);assert.match(textarea.value,/User Markdown body/);}
 assert.equal(f.disk(),f.original);assert.equal(f.session.blocked,true);assert.equal(f.writes(),1);assert.equal(f.backups(),1);f.button('关闭').onclick!();await pending;assert.equal(f.refs.size,0);assert.equal(f.writes(),1);assert.equal(f.backups(),1);assert.equal(f.session.blocked,true);
});

test('explicit clipboard rejection retains selectable text and allows a later explicit retry in its own popout window',async()=>{
 const f=await fixture('md',true),pending=f.run(),textarea=f.textarea(),source=textarea.value;assert.equal(f.modal().containerEl.ownerDocument,f.sourceDoc);assert.equal(f.viewportRoots[0].ownerDocument,f.sourceDoc);
 f.button('复制内容').onclick!();await tick();assert.deepEqual(f.sourceDoc.clipboard,[source]);assert.deepEqual(f.doc.clipboard,[]);assert.equal(textarea.value,source);assert.equal(f.button('复制内容').disabled,false);assert.ok(f.modal().contentEl.all().some(el=>/复制失败.*手动复制/.test(el.textContent)));
 f.button('选择全部').onclick!();assert.equal(textarea.selected,1);assert.equal(textarea.focused,1);f.sourceDoc.copyFailure=false;f.button('复制内容').onclick!();await tick();assert.deepEqual(f.sourceDoc.clipboard,[source,source]);assert.equal(f.disk(),f.original);assert.equal(f.session.blocked,true);
 f.modal().close();await pending;assert.equal(f.viewportDisposals.length,1);assert.equal(f.refs.size,0);
});

for(const boundary of ['navigation-and-back','owner','file','window','closed','cancel'] as const)test(`copy modal ${boundary} invalidates old controls without late clipboard or file writes`,async()=>{
 const f=await fixture(),pending=f.run(),copy=f.button('复制内容').onclick!,select=f.button('选择全部').onclick!,textarea=f.textarea();
 if(boundary==='navigation-and-back'){f.navigate({view:{}});f.navigate(f.leaf);}else if(boundary==='owner'){f.view.session={};f.fileOpen();}else if(boundary==='file'){f.file.path='Newer.md';f.fileOpen();}else if(boundary==='window'){f.sourceDoc.defaultView.closed=true;f.fileOpen();}else if(boundary==='closed'){f.view.closed=true;f.fileOpen();}else f.view.cancelSaveFeedbackNavigation();
 await pending;copy();select();await tick();assert.deepEqual(f.sourceDoc.clipboard,[]);assert.equal(textarea.selected,0);assert.equal(f.disk(),f.original);assert.equal(f.writes(),1);assert.equal(f.backups(),1);assert.equal(f.session.blocked,true);assert.equal(f.refs.size,0);
});

test('rapid copy requests share one modal and closing it releases the request guard',async()=>{
 const f=await fixture(),first=f.run();await f.run();assert.equal(f.modals.length,1);f.modal().close();await first;assert.equal(f.view.saveFeedbackPending,false);const retry=f.run();assert.equal(f.modals.length,2);f.modals[1].close();await retry;assert.deepEqual(f.sourceDoc.clipboard,[]);assert.equal(f.refs.size,0);
});

test('an old status button cannot copy a replacement session even when its feedback action has the same kind',async()=>{
 const f=await fixture();f.view.renderSaveStatus();const old=f.view.status.all().find((el:Element)=>el.tag==='button');assert.ok(old);let reads=0;
 f.view.session={saveFeedback:{action:{kind:'copy-local-draft'}},localDraftSource:()=>{reads++;return'new source';}};old.onclick({stopPropagation(){}});await tick();assert.equal(reads,0);assert.equal(f.modals.length,0);assert.deepEqual(f.sourceDoc.clipboard,[]);
});

for(const boundary of ['inactive','closing','window','action'] as const)test(`copy ${boundary} before activation does not open a modal`,async()=>{
 const f=await fixture();if(boundary==='inactive')f.navigate({view:{}});else if(boundary==='closing')f.view.closing=true;else if(boundary==='window')f.sourceDoc.defaultView.closed=true;else f.session.blocked=false;
 await f.run();assert.equal(f.modals.length,0);assert.deepEqual(f.sourceDoc.clipboard,[]);assert.equal(f.refs.size,0);
});
