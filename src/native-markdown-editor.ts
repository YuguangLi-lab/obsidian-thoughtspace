import {App,TFile,Editor} from 'obsidian';
import {Annotation,Transaction,TransactionSpec,EditorSelection} from '@codemirror/state';
import {ViewUpdate,EditorView} from '@codemirror/view';
import {releaseEditorResource} from './editor-cleanup';
import {isRecord} from './value-guards';

/** The small draft surface shared by a textarea and Obsidian's live editor. */
export interface DraftInput extends EventTarget {
 value:string;readonly selectionCount?:number;readonly selectionStart:number;readonly selectionEnd:number;readOnly:boolean;
 readonly style:CSSStyleDeclaration;readonly ownerDocument:Document;
 focus(options?:FocusOptions):void;setSelectionRange(start:number,end:number):void;
 setRangeText(text:string,start:number,end:number,mode?:SelectionMode):void;
}

// Obsidian has no public embedded-editor constructor. Isolate that boundary here,
// discover it once per App, and fall back to a textarea if a future host changes it.
// Constructor discovery follows the MIT-licensed EmbeddedMarkdownEditor by
// Matthew Meyers / Fevol; see THIRD_PARTY_NOTICES.md.
interface DraftOwner {app:App;file:TFile|null;getMode():string;onMarkdownScroll():void;syncScroll():void;editMode?:NativeEditorEngine;editor?:NativeEditorEngine['editor'];}
interface NativeEditorEngine {getDynamicExtensions():unknown;cm:EditorView;editor:Pick<Editor,'getValue'|'undo'|'redo'>;sourceMode:boolean;load():void;set(value:string,clear:boolean):void;show():void;unload():void;destroy():void;}
interface NativeEditorConstructor {new(app:App,host:HTMLElement,owner:DraftOwner):NativeEditorEngine;prototype:{getDynamicExtensions():unknown};}
interface MarkdownProbe {editable:boolean;editMode:unknown;showEditor():void;unload():void;}
type EmbedFactory=(options:{app:App;containerEl:HTMLElement},file:null,subpath:string)=>unknown;
function isEmbedFactory(value:unknown):value is EmbedFactory{return typeof value==='function';}
function isProbe(value:unknown):value is MarkdownProbe{return isRecord(value)&&typeof value.showEditor==='function'&&typeof value.unload==='function';}
function isNativeConstructor(value:unknown):value is NativeEditorConstructor{
 if(typeof value!=='function')return false;
 const prototype:unknown=Object.getOwnPropertyDescriptor(value,'prototype')?.value;
 return isRecord(prototype)&&typeof prototype.getDynamicExtensions==='function';
}
function isNativeEngine(value:unknown):value is NativeEditorEngine{
 if(!isRecord(value)||!(value.cm instanceof EditorView)||!isRecord(value.editor))return false;const editor=value.editor;
 return ['getValue','undo','redo'].every(key=>typeof editor[key]==='function')&&['load','set','show','unload','destroy'].every(key=>typeof value[key]==='function');
}
function isTransactionArray(value:unknown):value is readonly Transaction[]{return Array.isArray(value)&&value.every((item:unknown)=>item instanceof Transaction);}
const constructors=new WeakMap<App,NativeEditorConstructor>();
const localDraftEdit=Annotation.define<boolean>();
function editorConstructor(app:App,parent:HTMLElement){
 const cached=constructors.get(app);if(cached)return cached;
 if(!isRecord(app)||!isRecord(app.embedRegistry)||!isRecord(app.embedRegistry.embedByExtension)||!isEmbedFactory(app.embedRegistry.embedByExtension.md))throw Error('Embedded Markdown editor unavailable');
 const containerEl=parent.createDiv();containerEl.remove();
 const probe=app.embedRegistry.embedByExtension.md({app,containerEl},null,'');
 if(!isProbe(probe))throw Error('Embedded Markdown editor unavailable');
 try{probe.editable=true;probe.showEditor();if(!isRecord(probe.editMode))throw Error('Embedded Markdown editor unavailable');
  const first:unknown=Object.getPrototypeOf(probe.editMode),second:unknown=isRecord(first)?Object.getPrototypeOf(first):undefined,Base=isRecord(second)?second.constructor:undefined;
  if(!isNativeConstructor(Base))throw Error('Embedded Markdown editor unavailable');
  constructors.set(app,Base);return Base;
 }finally{probe.unload();}
}

/** A native CM6 live-preview instance owning an unsaved draft, never a file view. */
export class NativeMarkdownDraft extends EventTarget implements DraftInput {
 readonly host:HTMLElement;private engine!:NativeEditorEngine;private ready=false;private disposed=false;private locked=false;private intendedSelection?:{from:number;to:number;nativeFrom?:number;nativeTo?:number};private stopEvents?:()=>void;
 private valueCache?:{engine:NativeEditorEngine;cm:EditorView;editor:NativeEditorEngine['editor'];read:NativeEditorEngine['editor']['getValue'];doc:EditorView['state']['doc'];value:string};
 constructor(app:App,parent:HTMLElement,value:string,file?:TFile,label='编辑 Markdown · 实时预览'){
  super();const Base=editorConstructor(app,parent);this.host=parent.createDiv('ts-inline-native');
  const updated=(update:ViewUpdate)=>this.editorUpdated(update),events:(()=>void)[]=[];
  const listen=(type:string,handler:EventListener,capture=false)=>{this.host.addEventListener(type,handler,capture);events.push(()=>this.host.removeEventListener(type,handler,capture));};
  this.stopEvents=()=>{for(const remove of events.splice(0))releaseEditorResource('native draft event',remove);};
  class DraftEditor extends Base {
   // Do not broadcast editor-change for an unsaved draft or invoke a file save.
   onUpdate(update:ViewUpdate){updated(update);}
  }
  const owner:DraftOwner={app,file:file||null,getMode:()=>'source',onMarkdownScroll:()=>{},syncScroll:()=>{}};
  try{
   this.engine=new DraftEditor(app,this.host,owner);if(!isNativeEngine(this.engine))throw Error('Embedded Markdown editor unavailable');owner.editMode=this.engine;owner.editor=this.engine.editor;
   // The host's live-preview plugin schedules selection normalization on a
   // timer. A shrink/disposal can make that old range invalid before it runs.
   // Guard this instance only: never discard content-changing transactions.
   const cm=this.engine.cm,dispatch=cm.dispatch.bind(cm);
   cm.dispatch=(...specs:(Transaction|readonly Transaction[]|TransactionSpec)[])=>this.dispatchNative(dispatch,...specs);
   this.engine.sourceMode=false;this.engine.load();this.engine.set(value,true);this.engine.show();
   this.engine.cm.contentDOM.setAttribute('aria-label',label);
   for(const type of ['compositionstart','compositionend','keyup','mouseup'])listen(type,()=>this.emit(type));
   // Live preview may expand native ranges to include hidden syntax. Retain the
   // toolbar's logical text range until the user types or chooses a new range.
   for(const type of ['pointerdown','keydown','beforeinput'])listen(type,()=>{this.intendedSelection=undefined;},true);
   this.ready=true;
  }catch(e){this.dispose();throw e;}
 }
 private dispatchNative(dispatch:EditorView['dispatch'],...specs:(Transaction|readonly Transaction[]|TransactionSpec)[]){
  if(this.disposed)return;
  const cm=this.engine.cm,spec=specs.length===1?specs[0]:undefined;
  if(spec&&!Array.isArray(spec)&&!(spec instanceof Transaction)&&'selection' in spec&&spec.selection&&!spec.changes){
   const ranges=spec.selection instanceof EditorSelection?spec.selection.ranges:[spec.selection],length=cm.state.doc.length;
   if(ranges.some(r=>r.anchor<0||r.anchor>length||(r.head??r.anchor)<0||(r.head??r.anchor)>length))return;
  }
  // Host capture-phase shortcuts can run before our DOM key handler. Protect
  // the document transaction itself while a save owns the captured draft.
  if(this.locked){
   const transactions=spec instanceof Transaction?[spec]:isTransactionArray(spec)?spec: [cm.state.update(...specs.filter((value):value is TransactionSpec=>!(value instanceof Transaction)&&!Array.isArray(value)))];
   if(transactions.every(transaction=>!transaction.docChanged)){if(transactions.length===1)dispatch(transactions[0]);else dispatch(transactions);}
   return;
  }
  if(spec instanceof Transaction)dispatch(spec);else if(Array.isArray(spec))dispatch(spec);else dispatch(...specs.filter((value):value is TransactionSpec=>!(value instanceof Transaction)&&!Array.isArray(value)));
 }
 private editorUpdated(update:ViewUpdate){
  if(!this.ready||this.disposed)return;
  const local=update.transactions.length>0&&update.transactions.every(t=>t.annotation(localDraftEdit));
  if(update.docChanged&&!local)this.intendedSelection=undefined;
  if(update.selectionSet){
   const main=update.state.selection.main,range=this.intendedSelection;
   const explicit=update.transactions.some(t=>!!t.selection&&(t.scrollIntoView||!!t.annotation(Transaction.userEvent)));
   if(update.state.selection.ranges.length>1||!local&&explicit)this.intendedSelection=undefined;
   else if(range){
    // Unannotated, overlapping selection changes can be Live Preview marker fixes.
    if(local||main.from<(range.nativeTo??range.to)&&main.to>(range.nativeFrom??range.from)){range.nativeFrom=main.from;range.nativeTo=main.to;}
    else this.intendedSelection=undefined;
   }
  }
  if(update.docChanged)this.emit('input');
  if(update.selectionSet)this.emit('select');
  if(update.heightChanged||update.geometryChanged)this.emit('layout');
 }
 private selection(){
  if(this.disposed)return{from:0,to:0};
  const selection=this.engine.cm.state.selection,range=this.intendedSelection,main=selection.main;
  if(selection.ranges.length===1&&range&&main.from===range.nativeFrom&&main.to===range.nativeTo)return range;
  this.intendedSelection=undefined;return main;
 }
 private edit(spec:TransactionSpec,from:number,to:number){
  this.intendedSelection={from,to};
  try{this.engine.cm.dispatch({...spec,annotations:localDraftEdit.of(true)});}
  catch(error){this.intendedSelection=undefined;throw error;}
 }
 private emit(type:string){if(this.ready&&!this.disposed)super.dispatchEvent(new Event(type));}
 override dispatchEvent(event:Event):boolean{
  if(this.disposed)return false;
  if(['keydown','keyup','compositionstart','compositionend'].includes(event.type))return this.engine.cm.contentDOM.dispatchEvent(event);
  return super.dispatchEvent(event);
 }
 get style(){return this.host.style;}get ownerDocument(){return this.host.ownerDocument;}
 /** A toolbar, search widget or modal inside the host is not the editing body. */
 ownsKeyTarget(target:EventTarget|null){
  if(this.disposed||!target||typeof (target as Node).nodeType!=='number')return false;
  return this.engine.cm.contentDOM.contains(target as Node);
 }
 get value():string{
  if(this.disposed)return '';
  const engine=this.engine,cm=engine.cm,editor=engine.editor,doc=cm?.state?.doc,read=editor.getValue,cached=this.valueCache;
  // Native getValue flattens CM's immutable document. Status, sizing and toolbar
  // consumers can share that string until the document or native adapter changes.
  if(doc&&cached?.engine===engine&&cached.cm===cm&&cached.editor===editor&&cached.read===read&&cached.doc===doc)return cached.value;
  const value=read.call(editor);
  if(doc&&!this.disposed&&this.engine===engine&&engine.cm===cm&&cm.state.doc===doc&&engine.editor===editor&&editor.getValue===read)this.valueCache={engine,cm,editor,read,doc,value};
  else this.valueCache=undefined;
  return value;
 }
 set value(value:string){if(!this.disposed)this.setRangeText(value,0,this.value.length);}
 get selectionCount():number{return this.disposed?1:this.engine.cm.state.selection.ranges.length;}
 get selectionStart():number{return this.selection().from;}
 get selectionEnd():number{return this.selection().to;}
 get readOnly(){return this.locked;}
 set readOnly(value:boolean){this.locked=value;if(!this.disposed){this.engine.cm.contentDOM.contentEditable=String(!value);this.host.style.pointerEvents=value?'none':'auto';}}
 focus(){if(!this.disposed)this.engine.cm.focus();}
 setSelectionRange(start:number,end:number){if(this.disposed)return;this.edit({selection:{anchor:start,head:end},scrollIntoView:true},Math.min(start,end),Math.max(start,end));}
 setRangeText(text:string,start:number,end:number,mode:SelectionMode='end'){
  if(this.disposed||this.locked)return;
  const anchor=mode==='start'?start:start+text.length;
  const from=mode==='select'?start:anchor;
  this.edit({changes:{from:start,to:end,insert:text},selection:{anchor:from,head:anchor},scrollIntoView:true,userEvent:'input'},from,anchor);
 }
 /** Apply text and its final logical selection as one native undo transaction. */
 replaceFormatted(text:string,from:number,to:number,start:number,end:number){
  if(this.disposed||this.locked)return;
  this.edit({changes:{from,to,insert:text},selection:{anchor:start,head:end},scrollIntoView:true,userEvent:'input'},start,end);
 }
 history(redo:boolean){if(!this.disposed&&!this.locked){this.intendedSelection=undefined;this.engine.editor[redo?'redo':'undo']();}}
 /** Intrinsic CM document height excludes the current viewport's min-height. */
 intrinsicHeight():number|undefined{
  if(this.disposed)return;const cm=this.engine.cm,content=cm.contentHeight;if(!Number.isFinite(content)||content<0)return;
  const scale=Number.isFinite(cm.scaleY)&&cm.scaleY>0?cm.scaleY:1;
  const style=this.host.ownerDocument.defaultView!.getComputedStyle(this.host),padding=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
  return content/scale+padding;
 }
 resize(){if(!this.disposed)this.engine.cm.requestMeasure();}
 dispose(){if(this.disposed)return;this.disposed=true;this.ready=false;
  this.valueCache=undefined;
  const events=this.stopEvents;this.stopEvents=undefined;this.intendedSelection=undefined;
  releaseEditorResource('native draft events',events);
  releaseEditorResource('native editor subscriptions',()=>this.engine?.unload());
  releaseEditorResource('native editor view',()=>this.engine?.destroy());
  releaseEditorResource('native editor surface',()=>this.host.remove());
 }
}
