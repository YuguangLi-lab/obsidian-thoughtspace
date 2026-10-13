import {FuzzySuggestModal,Modal,type App,type TFile} from 'obsidian';
import {assertBoardEditorOwnership} from './board-editor-ownership';
import {type InkData} from './ink-model';
import {isWorkspaceFile} from './workspace';
import {themeSurface} from './ui-tokens';
import {HandwritingExportOperation,handwritingExportFilename,type HandwritingExportResult} from './handwriting-export';
import {bindBoardModalViewport} from './board-modal-viewport';

export interface HandwritingExportModalHost {
 source:TFile;ink:InkData;current:()=>boolean;
 document?:Document;isTargetAllowed?:(file:TFile)=>boolean;
 notice:(message:string)=>void;
 onExported?:(result:HandwritingExportResult<TFile>)=>void;
 closed?:(pointer?:{clientX:number;clientY:number;pointerType:string})=>void;
}
class HandwritingExportNotePicker extends FuzzySuggestModal<TFile> {
 private viewport?:()=>void;
 constructor(app:App,private readonly document:Document,private readonly allowed:(file:TFile)=>boolean,private readonly choose:(file:TFile)=>void,private readonly closed:()=>void){super(app);this.setPlaceholder('选择插入手写 SVG 的原生笔记…');}
 onOpen(){if(this.containerEl.ownerDocument!==this.document)this.document.body.appendChild(this.containerEl);this.viewport=bindBoardModalViewport(this.containerEl);return super.onOpen();}
 getItems(){return this.app.vault.getMarkdownFiles().filter(this.allowed);}
 getItemText(file:TFile){return file.path;}
 onChooseItem(file:TFile){this.choose(file);}
 onClose(){this.viewport?.();this.viewport=undefined;super.onClose();this.closed();}
}

/** Uses only native Vault/FileManager APIs. A note's open native page (including
 * Properties and a retired save buffer) owns it until that page is fully closed. */
export class HandwritingExportModal extends Modal {
 private alive=false;private choosing=false;private picker?:HandwritingExportNotePicker;private closedNotified=false;
 private viewport?:()=>void;private footer?:HTMLElement;
 private dismissPointer?:{clientX:number;clientY:number;pointerType:string};
 private readonly rememberPointer=(event:PointerEvent)=>{if(['mouse','touch','pen'].includes(event.pointerType)&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY))this.dismissPointer={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType};};
 private readonly clearDismissPointer=()=>{this.dismissPointer=undefined;};
 private status?:HTMLElement;private targetLabel?:HTMLElement;
 private chooseButton?:HTMLButtonElement;private exportButton?:HTMLButtonElement;private insertButton?:HTMLButtonElement;
 private readonly operation:HandwritingExportOperation<TFile>;
 constructor(app:App,private readonly host:HandwritingExportModalHost){
  super(app);
  this.operation=new HandwritingExportOperation({
   source:host.source,ink:host.ink,current:()=>this.alive&&host.current(),
   getFile:path=>app.vault.getAbstractFileByPath(path),read:file=>app.vault.read(file),
   availablePath:(filename,sourcePath)=>app.fileManager.getAvailablePathForAttachment(filename,sourcePath),
   create:(path,source)=>app.vault.create(path,source),process:(file,change)=>app.vault.process(file,change),
   link:(file,path)=>app.fileManager.generateMarkdownLink(file,path),
   assertTarget:file=>{try{assertBoardEditorOwnership(app,file);}catch{throw Error('目标笔记仍被原生编辑、阅读、属性页或旧页保存保护。请保存并关闭这些页面后再插入。');}},targetAllowed:file=>this.allowed(file),
   yieldControl:()=>new Promise<void>(resolve=>(app.workspace.containerEl.ownerDocument.defaultView||(host.document||this.contentEl.ownerDocument).defaultView)!.setTimeout(resolve,0)),
   progress:(done,total)=>{if(this.alive)this.status?.setText(`正在生成 SVG · ${Math.round(done/total*100)}%`);}
  });
 }
 private allowed(file:TFile){return file!==this.host.source&&file.extension.toLowerCase()==='md'&&isWorkspaceFile(file)&&(!this.host.isTargetAllowed||this.host.isTargetAllowed(file));}
 open(){
  const doc=this.host.document||this.contentEl.ownerDocument,win=doc.defaultView,previous=doc.activeElement;
  // Modal.open applies the host's default focus after onOpen. Select the primary
  // action only after that synchronous step, without a late focus callback.
  super.open();
  const target=this.exportButton,active=doc.activeElement;
  if(!this.alive||!this.host.current()||!win||win.closed||doc.defaultView!==win||!doc.hasFocus()||this.containerEl.ownerDocument!==doc||!this.containerEl.isConnected||!this.modalEl.getClientRects().length||!target||target.ownerDocument!==doc||!target.isConnected||!target.getClientRects().length||target.disabled||this.operation.busy||this.choosing)return;
  if(active!==previous&&active!==doc.body&&(!active||!this.modalEl.contains(active)))return;
  target.focus({preventScroll:true});
 }
 onOpen(){
  if(!this.host.current()){this.close();return;}
  const doc=this.host.document||this.contentEl.ownerDocument;
  if(!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;this.modalEl.addClass('ts-handwriting-export-modal');themeSurface(this.modalEl);this.viewport=bindBoardModalViewport(this.containerEl);
  this.containerEl.addEventListener('pointerdown',this.rememberPointer,true);this.containerEl.addEventListener('keydown',this.clearDismissPointer,true);
  this.contentEl.createEl('h2',{cls:'ts-handwriting-export-title',text:'导出手写 SVG'});
  this.contentEl.createEl('p',{cls:'ts-handwriting-export-intro',text:'将笔迹保存为可缩放的 SVG 附件，也可放入已有笔记。'});
  const file=this.contentEl.createDiv('ts-handwriting-export-section');
  file.createEl('h3',{text:'保存的附件'});
  file.createEl('p',{cls:'ts-handwriting-export-filename',attr:{'data-ink-export-name':'true'},text:handwritingExportFilename(this.host.source.basename)});
  file.createEl('p',{cls:'ts-handwriting-export-help',text:'同名附件会自动编号，原白板笔迹保留。'});
  const destination=this.contentEl.createDiv('ts-handwriting-export-section');
  destination.createEl('h3',{text:'插入到笔记 · 可选'});
  this.targetLabel=destination.createEl('p',{cls:'ts-handwriting-export-target',attr:{'data-ink-export-target':'true'},text:'尚未选择笔记'});
  destination.createEl('p',{cls:'ts-handwriting-export-help',text:'追加笔迹与白板回链，笔记原有内容保留。'});
  const footer=this.footer=this.modalEl.createDiv('ts-handwriting-export-footer');
  this.status=footer.createEl('p',{cls:'setting-item-description',attr:{role:'status','aria-live':'polite','data-ink-export-status':'true'}});
  const actions=footer.createDiv('ts-handwriting-export-actions');
  const button=(parent:HTMLElement,label:string,action:string,click:()=>void,primary=false)=>{
   const element=parent.createEl('button',{cls:`ts-handwriting-export-button${primary?' mod-cta':''}`,text:label,attr:{type:'button','aria-label':label,'data-ink-export-action':action}});
   element.onclick=click;return element;
  };
  this.chooseButton=button(destination,'选择笔记…','choose-target',()=>this.choose());
  button(actions,'取消','cancel',()=>this.close());
  this.exportButton=button(actions,'仅保存 SVG','export',()=>this.run(false));
  this.insertButton=button(actions,'插入到笔记','insert',()=>this.run(true),true);
  this.render();
 }
 private render(){
  if(!this.alive)return;
  const disabled=this.operation.busy||this.choosing||!this.host.current();
  if(this.chooseButton)this.chooseButton.disabled=disabled;
  if(this.exportButton)this.exportButton.disabled=disabled;
  if(this.insertButton)this.insertButton.disabled=disabled||!this.operation.target;
  this.targetLabel?.setText(this.operation.target?this.operation.target.path:'尚未选择笔记');
 }
 private choose(){
  if(!this.alive||this.operation.busy||this.choosing||!this.host.current())return;
  this.choosing=true;this.render();
  let selected=false;
  const picker=new HandwritingExportNotePicker(this.app,this.host.document||this.contentEl.ownerDocument,file=>this.allowed(file),file=>{
   selected=true;
   if(!this.alive||!this.host.current())return;
   this.status?.setText('正在核对笔记…');
   let accepted=false;
   void this.operation.chooseTarget(file).then(()=>{accepted=true;if(this.alive)this.status?.setText('已选择笔记，可以插入笔迹。');}).catch(error=>{if(this.alive)this.status?.setText(error instanceof Error?error.message:String(error));}).finally(()=>{this.choosing=false;if(this.alive){this.render();if(this.host.current())(accepted?this.insertButton:this.chooseButton)?.focus({preventScroll:true});}});
  },()=>{if(this.picker===picker)this.picker=undefined;if(!selected){this.choosing=false;this.render();if(this.alive&&this.host.current())this.chooseButton?.focus({preventScroll:true});}});
  this.picker=picker;picker.open();
 }
 private run(insert:boolean){
  if(!this.alive||this.operation.busy||this.choosing||!this.host.current())return;
  this.status?.setText('正在导出…');
  const pending=this.operation.run(insert);this.render();
  void pending.then(result=>{
   this.host.notice(result.target?`手写 SVG 已插入：${result.target.path}；附件：${result.attachment.path}`:`手写 SVG 已保存：${result.attachment.path}`);
   if(this.alive&&this.host.current())this.host.onExported?.(result);
   if(this.alive)this.close();
  }).catch(error=>{
   const message=error instanceof Error?error.message:String(error);
   if(this.alive){this.status?.setText(message);this.render();}else this.host.notice(message);
  });
 }
 onClose(){
  this.containerEl.removeEventListener('pointerdown',this.rememberPointer,true);this.containerEl.removeEventListener('keydown',this.clearDismissPointer,true);
  this.viewport?.();this.viewport=undefined;
  this.alive=false;this.operation.cancel();this.picker?.close();this.picker=undefined;this.choosing=false;
  this.contentEl.empty();this.footer?.remove();this.footer=undefined;this.status=undefined;this.targetLabel=undefined;
  if(!this.closedNotified){this.closedNotified=true;this.host.closed?.(this.dismissPointer);}this.dismissPointer=undefined;
 }
}
export function openHandwritingExport(app:App,host:HandwritingExportModalHost):HandwritingExportModal {
 const modal=new HandwritingExportModal(app,host);modal.open();return modal;
}
