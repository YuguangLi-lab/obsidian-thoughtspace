import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const code=transformSync(readFileSync('src/media-draft-recovery.ts','utf8'),{loader:'ts',format:'cjs'}).code;
class File {stat={mtime:1,size:1};constructor(public path:string){}}
function fixture(entries:any[]=[],popout=false){
 const listeners=new Set<(event:any)=>void>();let focusedWindow=true;
 const doc:any={defaultView:{closed:false},activeElement:null,hasFocus:()=>focusedWindow,addEventListener:(type:string,fn:(event:any)=>void)=>{assert.equal(type,'focusin');listeners.add(fn);},removeEventListener:(_type:string,fn:(event:any)=>void)=>listeners.delete(fn)};
 const other:any={defaultView:{closed:false},activeElement:null,hasFocus:()=>false,addEventListener(){},removeEventListener(){}};
 class Element {
  children:Element[]=[];parent?:Element;isConnected=true;disabled=false;shown=true;textContent='';value='';readOnly=false;onclick?:()=>void;attrs:Record<string,string>={};focuses=0;
  constructor(readonly tag='div',public ownerDocument=doc,options:any={}){this.textContent=options.text||'';this.attrs=options.attr||{};}
  createEl(tag:string,options:any={}){const child=new Element(tag,this.ownerDocument,options);child.parent=this;this.children.push(child);return child;}
  createDiv(options:any={}){return this.createEl('div',options);}addClass(){}
  all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}
  contains(other:unknown):boolean{return this===other||this.children.some(child=>child.contains(other));}
  getClientRects(){return this.isConnected&&this.shown?[{}]:[];}
  focus(){if(!this.isConnected||this.disabled)return;this.focuses++;doc.activeElement=this;for(const fn of [...listeners])fn({target:this});}
  click(){if(!this.disabled)this.onclick?.();}
  detach(){for(const item of [this,...this.all()])item.isConnected=false;if(this.contains(doc.activeElement))doc.activeElement=doc.body;}
  empty(){for(const child of this.children)child.detach();this.children=[];}
  adopt(document:any){for(const e of [this,...this.all()])e.ownerDocument=document;}
 }
 doc.body=new Element('body');doc.activeElement=doc.body;other.body=new Element('body',other);other.activeElement=other.body;
 const container=new Element(),opener=container.createEl('button'),outside=doc.body.createEl('input'),file=new File('原页面.md'),media=new File('音频.wav');
 class View {containerEl=container;file=file;session={};leaf:any;}
 const view=new View(),leaf={view},fallback:any[]=[];view.leaf=leaf;
 const workspace:any={activeLeaf:leaf,getActiveViewOfType:(Type:typeof View)=>workspace.activeLeaf?.view instanceof Type?workspace.activeLeaf.view:null,setActiveLeaf:(target:unknown)=>{fallback.push(target);container.focus();}};
 const app={workspace,vault:{getAbstractFileByPath:(path:string)=>path===media.path?media:null}};
 let pending=entries,discarded:string[]=[],stops=0;
 const store={pending:()=>pending,discard:async(id:string)=>{discarded.push(id);pending=pending.filter(entry=>entry.id!==id);}};
 class Modal {
  shouldRestoreSelection=true;savedFocus:any;hostRestoreCalls=0;
  containerEl=new Element('div',popout?other:doc);modalEl=this.containerEl.createDiv();contentEl=this.modalEl.createDiv();delayed=false;
  constructor(readonly app:unknown){}
  open(){this.savedFocus=doc.activeElement;this.containerEl.adopt(doc);this.containerEl.isConnected=true;doc.activeElement=doc.body;(this as any).onOpen();}
  close(){if(this.delayed)this.restoreHost();else this.finishClose();}
  finishClose(){this.containerEl.detach();(this as any).onClose();if(!this.delayed)this.restoreHost();}
  restoreHost(){if(this.shouldRestoreSelection&&this.savedFocus?.isConnected){this.hostRestoreCalls++;this.savedFocus.focus();}}
 }
 const module={exports:{} as Record<string,any>};
 new Function('require','module','exports',code)((name:string)=>name==='obsidian'?{Modal,View,TFile:File,Notice:class{}}:name==='./board-modal-viewport'?{bindBoardModalViewport:()=>()=>{stops++;}}:name==='./ui-tokens'?{themeSurface(){}}:name==='./media-source'?{mediaClock:()=> '00:00'}:{},module,module.exports);
 const modal=new module.exports.MediaDraftRecoveryModal(app,store,async()=>{});
 const button=(name:string)=>{const found=modal.contentEl.all().find((e:Element)=>e.tag==='button'&&e.textContent===name);assert(found,'Real rendered button '+name);return found as Element;};
 return{doc,modal,opener,outside,view,leaf,workspace,file,media,container,fallback,listeners,discarded,button,setWindowFocus:(value:boolean)=>focusedWindow=value,stops:()=>stops};
}
test('empty recovery opens with one visible named Close button focused and closing returns to its exact opener',()=>{const f=fixture();f.opener.focus();f.modal.open();const close=f.button('关闭');assert.equal(close.attrs.type,'button');assert.equal(close.disabled,false);assert.equal(close.getClientRects().length,1);assert.equal(f.doc.activeElement,close);close.click();assert.equal(f.doc.activeElement,f.opener);assert.equal(f.opener.focuses,2);assert.equal(f.listeners.size,0);assert.equal(f.stops(),1);});
test('command entry without a control restores only its unchanged owner leaf',()=>{const f=fixture();f.modal.open();assert.equal(f.doc.activeElement,f.button('关闭'));f.modal.close();assert.deepEqual(f.fallback,[f.leaf]);});
test('empty workspace still gets the named Close button without inventing an owner',()=>{const f=fixture();f.workspace.activeLeaf=null;f.modal.open();assert.equal(f.doc.activeElement,f.button('关闭'));f.modal.close();assert.equal(f.fallback.length,0);});
for(const change of ['leaf','view','file','path','session','document','window','background'] as const)test('close never steals focus after owner changed: '+change,()=>{const f=fixture();f.opener.focus();f.modal.open();if(change==='leaf')f.workspace.activeLeaf={view:{}};if(change==='view')f.leaf.view={} as never;if(change==='file')f.view.file=new File('另一页面.md');if(change==='path')f.file.path='移动.md';if(change==='session')f.view.session={};if(change==='document')(f.container as any).ownerDocument={};if(change==='window')f.doc.defaultView.closed=true;if(change==='background')f.setWindowFocus(false);f.modal.close();assert.equal(f.opener.focuses,1);assert.equal(f.fallback.length,0);assert.equal(f.listeners.size,0);});
test('an intentional focus transfer remains revoked even if focus later becomes body',()=>{const f=fixture();f.opener.focus();f.modal.open();f.outside.focus();f.doc.activeElement=f.doc.body;f.modal.close();assert.equal(f.opener.focuses,1);assert.equal(f.fallback.length,0);});
test('a focus transfer during native close animation is not overwritten by late onClose',()=>{const f=fixture();f.opener.focus();f.modal.open();f.modal.delayed=true;f.modal.close();f.outside.focus();f.modal.finishClose();assert.equal(f.doc.activeElement,f.outside);assert.equal(f.opener.focuses,1);assert.equal(f.listeners.size,0);});
test('removed opener falls back only to its still-current owned view',()=>{const f=fixture();f.opener.focus();f.modal.open();f.opener.detach();f.modal.close();assert.deepEqual(f.fallback,[f.leaf]);});
test('repeated onClose neither restores twice nor keeps a focus listener',()=>{const f=fixture();f.opener.focus();f.modal.open();f.modal.close();f.modal.onClose();assert.equal(f.opener.focuses,2);assert.equal(f.listeners.size,0);assert.equal(f.stops(),1);});
test('discarding the last draft keeps focus on a real surviving modal action',async()=>{const entry={id:'draft',text:'保留文字',time:0,updatedAt:1,source:{path:'音频.wav',mtime:1,size:1}},f=fixture([entry]);f.opener.focus();f.modal.open();f.button('丢弃草稿').focus();f.button('丢弃草稿').click();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.discarded,['draft']);assert.equal(f.doc.activeElement,f.button('关闭'));assert.equal(f.button('关闭').isConnected,true);});
test('rerender does not take focus back from an outside field',()=>{const f=fixture();f.opener.focus();f.modal.open();f.outside.focus();f.modal.render();assert.equal(f.doc.activeElement,f.outside);f.modal.close();assert.equal(f.doc.activeElement,f.outside);});

test('recovery disables the public host restore so native post-onClose restoration cannot bypass revocation',()=>{const f=fixture();f.opener.focus();f.modal.open();assert.equal(f.modal.shouldRestoreSelection,false);f.outside.focus();f.modal.close();assert.equal(f.doc.activeElement,f.outside);assert.equal(f.modal.hostRestoreCalls,0);});

test('recovery captures its actual popout owner before native adoption and restores only that opener',()=>{const f=fixture([],true);f.opener.focus();f.modal.open();assert.equal(f.doc.activeElement,f.button('关闭'));assert.equal(f.modal.containerEl.ownerDocument,f.doc);f.modal.close();assert.equal(f.doc.activeElement,f.opener);assert.equal(f.modal.hostRestoreCalls,0);assert.equal(f.listeners.size,0);});
