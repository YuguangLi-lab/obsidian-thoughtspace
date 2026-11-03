import {type App,MarkdownRenderer,Modal} from 'obsidian';
import {bindBoardModalViewport} from './board-modal-viewport';
import {mermaidMarkdown} from './mermaid-card';
import {PreviewRenderScope} from './preview-render-scope';
import {themeSurface} from './ui-tokens';

export interface MermaidEditorOptions {
 source:string;
 sourcePath:string;
 title?:string;
 onSave:(source:string)=>Promise<void>;
 onClosed?:()=>void;
}

/** Draft ownership stays inside the modal until the explicit save callback. */
export class MermaidEditorModal extends Modal {
 private viewport?:()=>void;
 private input?:HTMLTextAreaElement;
 private preview?:HTMLElement;
 private status?:HTMLElement;
 private error?:HTMLElement;
 private saveButton?:HTMLButtonElement;
 private cancelButton?:HTMLButtonElement;
 private renderScope?:PreviewRenderScope;
 private timer?:number;
 private revision=0;
 private closed=false;
 private busy=false;
 private composing=false;
 private inputCleanup?:()=>void;
 constructor(app:App,private options:MermaidEditorOptions){super(app);}

 onOpen(){
  this.viewport=bindBoardModalViewport(this.containerEl);
  themeSurface(this.modalEl);this.modalEl.addClass('ts-mermaid-editor');
  this.titleEl.setText(this.options.title||'编辑 Mermaid 图表');
  this.contentEl.createEl('p',{cls:'ts-mermaid-editor-hint',text:'编辑源码后自动预览。保存将更新图表，取消保留原内容。'});
  const columns=this.contentEl.createDiv('ts-mermaid-editor-columns');
  const source=columns.createDiv('ts-mermaid-editor-pane');
  const label=source.createEl('label',{cls:'ts-mermaid-editor-label',text:'Mermaid 源码'});
  const input=this.input=label.createEl('textarea',{cls:'ts-mermaid-editor-source',attr:{'aria-label':'Mermaid 源码',spellcheck:'false',autocapitalize:'off',autocomplete:'off'}});
  input.value=this.options.source;
  input.oninput=()=>{this.error?.empty();this.queuePreview();};
  const compositionStart=()=>{this.composing=true;this.stopPreview();};
  const compositionEnd=()=>{this.composing=false;this.queuePreview();};
  input.addEventListener('compositionstart',compositionStart);input.addEventListener('compositionend',compositionEnd);
  this.inputCleanup=()=>{input.removeEventListener('compositionstart',compositionStart);input.removeEventListener('compositionend',compositionEnd);};
  input.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!e.isComposing&&!this.composing){e.preventDefault();void this.submit();}};
  const previewPane=columns.createDiv('ts-mermaid-editor-pane');
  previewPane.createDiv({cls:'ts-mermaid-editor-label',text:'预览'});
  this.preview=previewPane.createDiv({cls:'ts-mermaid-editor-preview markdown-rendered',attr:{role:'region','aria-label':'Mermaid 预览',tabindex:'0'}});
  this.status=this.contentEl.createDiv({cls:'ts-mermaid-editor-status',attr:{role:'status','aria-live':'polite'}});
  this.error=this.contentEl.createDiv({cls:'ts-mermaid-editor-error',attr:{role:'alert'}});
  const footer=this.contentEl.createDiv('ts-mermaid-editor-actions');
  const cancel=this.cancelButton=footer.createEl('button',{text:'取消'});cancel.onclick=()=>this.close();
  const save=this.saveButton=footer.createEl('button',{text:'保存',cls:'mod-cta'});save.onclick=()=>void this.submit();
  this.queuePreview(true);input.focus();
 }

 private stopPreview(){
  this.revision++;
  const win=this.contentEl.ownerDocument.defaultView;
  if(this.timer!==undefined)win?.clearTimeout(this.timer);
  this.timer=undefined;
  this.renderScope?.unload();this.renderScope=undefined;
 }

 private queuePreview(immediate=false){
  this.stopPreview();
  if(this.closed||!this.input||!this.preview||!this.status)return;
  this.preview.empty();this.preview.dataset.renderStatus='pending';this.preview.setAttribute('aria-busy','true');this.status.setText('正在预览…');
  if(this.composing)return;
  const revision=this.revision,source=this.input.value;
  const run=()=>{this.timer=undefined;void this.renderPreview(source,revision);};
  if(immediate)run();else this.timer=this.contentEl.ownerDocument.defaultView?.setTimeout(run,200);
 }

 private async renderPreview(source:string,revision:number){
  if(this.closed||revision!==this.revision||!this.preview)return;
  const preview=this.preview,win=preview.ownerDocument.defaultView;
  if(!win)return;
  // Attach before rendering: Obsidian 1.15 defers off-document Pele mounts.
  const rendered=preview.createDiv('ts-mermaid-editor-rendered');
  const scope=this.renderScope=new PreviewRenderScope();scope.load();
  const alive=()=>!this.closed&&revision===this.revision&&this.renderScope===scope;
  const inspect=()=>{
   if(!alive())return;
   // Pele reports parse errors in the DOM without rejecting MarkdownRenderer.
   const invalid=rendered.querySelector('.pele-error')||rendered.querySelector('.mermaid-error')||rendered.querySelector('.error-icon');
   if(invalid){this.status?.setText('图表语法有误，请检查源码。仍可保存源码后继续修改。');preview.dataset.renderStatus='error';preview.setAttribute('aria-busy','false');}
   else if(rendered.querySelector('svg')){this.status?.setText('预览已更新');preview.dataset.renderStatus='ready';preview.setAttribute('aria-busy','false');}
  };
  const Observer=win.MutationObserver;
  const observer=new Observer(inspect);observer.observe(rendered,{childList:true,subtree:true,attributes:true});scope.register(()=>observer.disconnect());
  let deadline:number|undefined;
  const cancelled=new Promise<void>(resolve=>scope.register(resolve));
  const budget=new Promise<never>((_,reject)=>{deadline=win.setTimeout(()=>reject(Error('预览超时')),8000);});
  scope.register(()=>{if(deadline!==undefined)win.clearTimeout(deadline);});
  try{
   await Promise.race([MarkdownRenderer.render(this.app,mermaidMarkdown(source),rendered,this.options.sourcePath,scope),budget,cancelled]);
   if(!alive())return;
   inspect();
   if(!source.trim()){this.status?.setText('输入 Mermaid 源码以预览图表');preview.setAttribute('aria-busy','false');}
  }catch(error){
   if(!alive())return;
   this.status?.setText(`预览暂不可用，源码仍可保存。${error instanceof Error?error.message:String(error)}`);
   preview.dataset.renderStatus='error';preview.setAttribute('aria-busy','false');
   scope.unload();this.renderScope=undefined;rendered.remove();
  }finally{if(deadline!==undefined)win.clearTimeout(deadline);}
 }

 private async submit(){
  if(this.closed||this.busy||this.composing||!this.input)return;
  const source=this.input.value;this.busy=true;this.error?.empty();this.updateBusy();
  try{await this.options.onSave(source);this.busy=false;if(!this.closed)this.close();}
  catch(error){if(!this.closed)this.error?.setText(`保存失败：${error instanceof Error?error.message:String(error)}`);}
  finally{this.busy=false;if(!this.closed)this.updateBusy();}
 }

 private updateBusy(){
  if(this.input)this.input.disabled=this.busy;
  if(this.saveButton){this.saveButton.disabled=this.busy;this.saveButton.setText(this.busy?'正在保存…':'保存');}
  if(this.cancelButton)this.cancelButton.disabled=this.busy;
 }

 override close(){if(!this.busy)super.close();}
 /** Owner navigation must dispose the UI even while its save is finishing.
  * The save callback and owning board session retain write/recovery ownership. */
 closeForOwner(){if(!this.closed)super.close();}
 onClose(){
  if(this.closed)return;this.closed=true;this.stopPreview();this.viewport?.();this.viewport=undefined;
  this.inputCleanup?.();this.inputCleanup=undefined;
  if(this.input){this.input.oninput=null;this.input.onkeydown=null;}
  this.contentEl.empty();this.input=undefined;this.preview=undefined;this.options.onClosed?.();
 }
}
