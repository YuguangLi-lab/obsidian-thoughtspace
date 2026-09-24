import {EditorSearchModal} from './editor-search-view';
import {SelectionNoteModal,CreateLinkedNote} from './selection-note-view';
import {sameNoteSelection} from './selection-note';
import {App,Component,Editor,MarkdownView,TFile,editorInfoField} from 'obsidian';
import {EditorView,ViewUpdate} from '@codemirror/view';
import {Transaction} from '@codemirror/state';
import {releaseEditorResource} from './editor-cleanup';
import {MarkdownCommand,planMarkdownEdit,insertedPosition} from './markdown-edit';
import {markdownToolbar,MarkdownToolbarEditor} from './markdown-toolbar';

/** Bind commands to this note's Editor, never to a global active editor or a copy. */
class NoteToolbar extends Component implements MarkdownToolbarEditor {
 readonly updatesBatched=true;
 readonly host:HTMLElement;readonly input:MarkdownToolbarEditor['input'];
 private notice:HTMLElement;private cleanup?:()=>void;private composing=false;private disposed=false;
 private frame?:number;
 private range?:{text:string;from:number;to:number;nativeFrom:number;nativeTo:number};
 constructor(private app:App,readonly view:MarkdownView,readonly file:TFile,readonly editor:Editor,private make:CreateLinkedNote){
  super();this.host=view.contentEl.createDiv({cls:'ts-note-markdown-toolbar',attr:{role:'toolbar','aria-label':'笔记 Markdown 工具栏'}});
  view.contentEl.prepend(this.host);this.notice=this.host.createSpan({cls:'ts-note-edit-notice',attr:{role:'status','aria-live':'polite','aria-atomic':'true',title:'内容或选区已变化，本次操作未执行。请确认后重试。'}});const readValue=()=>this.valid()?editor.getValue():'',readSelection=()=>this.valid()?this.selection():{from:0,to:0};
  this.input=new class extends EventTarget {
   get value(){return readValue();}
   get selectionStart(){return readSelection().from;}
   get selectionEnd(){return readSelection().to;}
  }();
 }
 onload(){
  markdownToolbar(this.host,this);this.sync();
  this.registerEvent(this.app.workspace.on('editor-change',editor=>{if(editor===this.editor){this.showNotice(false);if(this.range&&this.range.text!==editor.getValue())this.range=undefined;this.notify();}}));
  for(const type of ['pointerdown','keydown','beforeinput'] as const)this.registerDomEvent(this.view.contentEl,type,e=>{if(!this.host.contains(e.target as Node)){this.range=undefined;this.showNotice(false);}},true);
  this.registerDomEvent(this.view.contentEl,'compositionstart',()=>{this.composing=true;this.notify();});
  this.registerDomEvent(this.view.contentEl,'compositionend',()=>{this.composing=false;this.notify();});
  this.registerDomEvent(this.view.contentEl,'keyup',()=>this.notify());
  this.registerDomEvent(this.view.contentEl,'mouseup',()=>this.notify());
  this.registerDomEvent(this.host,'keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.editor.focus();}});
  this.registerDomEvent(this.host.ownerDocument,'selectionchange',()=>{if(this.editor.hasFocus())this.notify();});
  const observer=new MutationObserver(()=>this.sync()),source=this.view.contentEl.querySelector('.markdown-source-view');
  if(source)observer.observe(source,{attributes:true,attributeFilter:['class','style']});
  this.register(()=>observer.disconnect());
 }
 private valid(){return !this.disposed&&this.view.file===this.file&&this.view.editor===this.editor&&this.view.getMode()==='source';}
 private selection(text=this.editor.getValue(),native=this.nativeSelection()){
  const range=this.range;
  // A host command can move the selection without a DOM pointer/key event.
  // Logical offsets belong only to the native selection that produced them.
  if(range?.text===text&&this.editor.listSelections().length===1&&native.from===range.nativeFrom&&native.to===range.nativeTo)return range;
  this.range=undefined;return native;
 }
 /** Observe native transactions without replacing Editor methods or dispatch. */
 editorUpdated(update:ViewUpdate){
  if(!this.valid()||(!update.docChanged&&!update.selectionSet))return;
  const main=update.state.selection.main;
  const explicit=update.transactions.some(t=>!!t.selection&&(t.scrollIntoView||!!t.annotation(Transaction.userEvent)));
  if(update.docChanged||update.state.selection.ranges.length!==1||explicit)this.range=undefined;
  else if(this.range){
   // Live Preview can finish an unannotated marker adjustment after formatting.
   // Keep the logical phrase only while that adjustment overlaps its native range.
   const range=this.range;
   if(main.from<range.nativeTo&&main.to>range.nativeFrom){range.nativeFrom=main.from;range.nativeTo=main.to;}
   else this.range=undefined;
  }
  this.notify();
 }
 private nativeSelection(){return{from:this.editor.posToOffset(this.editor.getCursor('from')),to:this.editor.posToOffset(this.editor.getCursor('to'))};}
 private showNotice(show:boolean){if(this.disposed)return;const text=show?'请确认后重试':'';if(this.notice.textContent!==text)this.notice.setText(text);}
 /** Activating a leaf may synchronously run host/plugin edits; never apply offsets from before them. */
 private focusUnchanged(text:string,selection?:{from:number;to:number}){
  const changed=()=>{this.range=undefined;if(!this.disposed){this.showNotice(true);this.sync();}return false;};
  const unchanged=()=>{
   if(!this.valid()||this.composing||this.editor.getValue()!==text)return false;
   if(selection){const current=this.nativeSelection();if(this.editor.listSelections().length>1||current.from!==selection.from||current.to!==selection.to)return false;}
   return true;
  };
  this.app.workspace.setActiveLeaf(this.view.leaf,{focus:true});
  if(!unchanged())return changed();
  if(!this.editor.hasFocus()){
   this.editor.focus();
   if(!unchanged())return changed();
  }
  this.showNotice(false);return true;
 }
 snapshot(){if(!this.valid())return{text:'',start:0,end:0,busy:true,disabledReason:'编辑器已关闭或切换'};const text=this.editor.getValue(),range=this.selection(text);return{text,start:range.from,end:range.to,busy:this.composing,disabledReason:this.composing?'输入法组字中':this.editor.listSelections().length>1?'多光标编辑中，请保留一个选区后设置格式':undefined};}
 private notify(){if(this.disposed||!this.host.isConnected||this.host.hidden||this.frame!==undefined)return;this.frame=this.host.ownerDocument.defaultView!.requestAnimationFrame(()=>{this.frame=undefined;if(!this.disposed&&this.host.isConnected&&!this.host.hidden)this.input.dispatchEvent(new Event('select'));});}
 sync(){if(this.disposed)return;const visible=this.valid();if(this.host.hidden===visible)this.host.hidden=!visible;const content=this.view.contentEl;if(content.classList.contains('ts-note-with-toolbar')!==visible)content.toggleClass('ts-note-with-toolbar',visible);if(visible)this.notify();}
 replaceToolbar(dispose?:()=>void){
  const closed=this.disposed,previous=this.cleanup;this.cleanup=closed?undefined:dispose;
  releaseEditorResource('note formatting toolbar',previous);
  if(closed)releaseEditorResource('late note toolbar',dispose);
 }
 format(command:MarkdownCommand|{color:string;background?:boolean}){
  if(!this.valid()||this.composing||this.editor.listSelections().length>1)return;
  const text=this.editor.getValue(),nativeRange=this.nativeSelection(),range=this.selection(text,nativeRange);
  if(!this.focusUnchanged(text,nativeRange))return;
  const result=planMarkdownEdit(text,range.from,range.to,command);if(!result.change||result.text===text)return;
  const change=result.change,from=this.editor.offsetToPos(change.from);
  this.editor.transaction({changes:[{from,to:this.editor.offsetToPos(change.to),text:change.text}],selection:{from:insertedPosition(from,change.text,result.start-change.from),to:insertedPosition(from,change.text,result.end-change.from)}},'thoughtspace-format');
  // Live preview may extend native selections over hidden syntax after the edit.
  const native=this.nativeSelection();this.range={text:result.text,from:result.start,to:result.end,nativeFrom:native.from,nativeTo:native.to};this.notify();
 }
 private searchDialog?:EditorSearchModal;
 findText(){if(this.searchDialog?.modalEl.isConnected)return;
  const read=()=>{const state=this.snapshot();if(this.app.vault.getAbstractFileByPath(this.file.path)!==this.file)state.disabledReason='原笔记已移除';return state;};
  const modal:EditorSearchModal=new EditorSearchModal(this.app,{read,apply:(expected,change)=>{
   if(read().disabledReason||!this.focusUnchanged(expected)||this.searchDialog!==modal||!modal.modalEl.isConnected)throw Error('编辑内容已变化，请刷新后重试');
   this.range=undefined;const from=this.editor.offsetToPos(change.from);this.editor.transaction({changes:[{from,to:this.editor.offsetToPos(change.to),text:change.text}],selection:{from:insertedPosition(from,change.text,change.text.length)}},'thoughtspace-search-replace');this.notify();
  },locate:(expected,match)=>{if(read().disabledReason||!this.focusUnchanged(expected)||this.searchDialog!==modal||!modal.modalEl.isConnected)throw Error('编辑内容已变化，请刷新后重试');this.range=undefined;const from=this.editor.offsetToPos(match.from),to=this.editor.offsetToPos(match.to);this.editor.setSelection(from,to);this.editor.scrollIntoView({from,to},true);this.notify();}},()=>{this.searchDialog=undefined;});this.searchDialog=modal;modal.open();
 }
 private linkDialog?:SelectionNoteModal;
 linkNote(){if(this.linkDialog?.modalEl.isConnected)return;const native=this.nativeSelection();const modal=new SelectionNoteModal(this.app,{file:this.file,read:()=>this.snapshot(),replace:(expected,link)=>{
   if(!sameNoteSelection(expected,this.snapshot())||!this.focusUnchanged(expected.text,native))throw Error('编辑器内容或选区已变化，未插入链接');
   const from=this.editor.offsetToPos(expected.start);this.range=undefined;this.editor.transaction({changes:[{from,to:this.editor.offsetToPos(expected.end),text:link}],selection:{from:insertedPosition(from,link,link.length)}},'thoughtspace-note-link');this.notify();
  }},this.make,()=>{this.linkDialog=undefined;});this.linkDialog=modal;modal.open();}
 history(redo=false){if(!this.valid()||this.composing||!this.focusUnchanged(this.editor.getValue()))return;this.range=undefined;if(redo)this.editor.redo();else this.editor.undo();this.notify();}
 onunload(){
  if(this.disposed)return;this.disposed=true;this.searchDialog?.close();this.searchDialog=undefined;this.linkDialog?.close();this.linkDialog=undefined;const frame=this.frame;this.frame=undefined;this.range=undefined;
  releaseEditorResource('note toolbar frame',()=>{if(frame!==undefined)this.host.ownerDocument.defaultView?.cancelAnimationFrame(frame);});
  this.replaceToolbar();releaseEditorResource('note toolbar surface',()=>this.host.remove());
  releaseEditorResource('note toolbar layout',()=>this.view.contentEl.removeClass('ts-note-with-toolbar'));
 }
}

/** One toolbar per loaded Markdown leaf, including sidebar and pop-out notes. */
export class NoteMarkdownToolbars extends Component {
 private bindings=new Map<MarkdownView,NoteToolbar>();private timer?:number;private running=false;
 constructor(private app:App,private enabled:()=>boolean,private make:CreateLinkedNote){super();}
 extension(){return EditorView.updateListener.of(update=>{if(!this.running)return;const info=update.state.field(editorInfoField,false);if(info instanceof MarkdownView)this.bindings.get(info)?.editorUpdated(update);});}
 onload(){this.running=true;for(const event of ['layout-change','active-leaf-change','file-open'] as const)this.registerEvent(this.app.workspace.on(event as 'layout-change',()=>this.refresh()));this.app.workspace.onLayoutReady(()=>{if(this.running)this.refresh();});this.refresh();}
 refresh(){if(!this.running||this.timer!==undefined)return;this.timer=window.setTimeout(()=>{this.timer=undefined;this.reconcile();},0);}
 private reconcile(){
  if(!this.running)return;
  const views=new Set(this.app.workspace.getLeavesOfType('markdown').map(l=>l.view).filter((v):v is MarkdownView=>v instanceof MarkdownView&&!!v.file));
  for(const [view,binding] of this.bindings)if(!this.enabled()||!views.has(view)||view.file!==binding.file||view.editor!==binding.editor){this.bindings.delete(view);releaseEditorResource('obsolete note binding',()=>this.removeChild(binding));}
  if(!this.enabled())return;
  for(const view of views){let binding=this.bindings.get(view);if(!binding){binding=new NoteToolbar(this.app,view,view.file!,view.editor,this.make);this.bindings.set(view,binding);this.addChild(binding);}binding.sync();}
 }
 onunload(){
  this.running=false;const timer=this.timer,bindings=[...this.bindings.values()];this.timer=undefined;this.bindings.clear();
  releaseEditorResource('note binding refresh',()=>{if(timer!==undefined)window.clearTimeout(timer);});
  for(const binding of bindings)releaseEditorResource('note binding',()=>this.removeChild(binding));
 }
}
