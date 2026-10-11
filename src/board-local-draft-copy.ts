import {Modal,type App} from 'obsidian';
import {bindMobileViewport} from './mobile-viewport';
import {themeSurface} from './ui-tokens';

export interface BoardLocalDraftCopyHost {
 document:Document;name:string;source:string;current():boolean;closed():void;
}

/** An explicit copy surface for a protected in-memory board. Never writes files. */
export class BoardLocalDraftCopyModal extends Modal {
 private alive=false;private busy=false;private completed=false;private viewport?:()=>void;
 private textarea?:HTMLTextAreaElement;private status?:HTMLElement;private copyButton?:HTMLButtonElement;
 constructor(app:App,private readonly host:BoardLocalDraftCopyHost){super(app);}
 private current(){const doc=this.host.document;return this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===doc&&!!doc.defaultView&&!doc.defaultView.closed&&this.host.current();}
 onOpen(){
  const doc=this.host.document;if(!this.host.current()||!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;themeSurface(this.modalEl);this.modalEl.addClass('ts-prompt-modal','ts-local-draft-copy-modal');this.titleEl.setText('复制未保存白板');
  this.viewport=bindMobileViewport(this.modalEl);
  this.contentEl.createEl('p',{text:`${this.host.name} 的完整本地副本。复制后可粘贴到同一格式的新文件保存；原白板仍暂停写入。`});
  const textarea=this.contentEl.createEl('textarea',{cls:'ts-wide',attr:{readonly:'',rows:'14','aria-label':'完整未保存白板内容'}});textarea.readOnly=true;textarea.value=this.host.source;this.textarea=textarea;
  const status=this.contentEl.createDiv({attr:{role:'status','aria-live':'polite'}});this.status=status;
  status.setText('内容仅在此处显示。可手动选择复制，或点击“复制内容”。');
  const actions=this.contentEl.createDiv('modal-button-container');
  const select=actions.createEl('button',{text:'选择全部',attr:{type:'button'}});select.onclick=()=>{if(!this.current())return;textarea.focus({preventScroll:true});textarea.select();};
  const copy=actions.createEl('button',{cls:'mod-cta',text:'复制内容',attr:{type:'button'}});this.copyButton=copy;copy.onclick=()=>{void this.copy();};
  actions.createEl('button',{text:'关闭',attr:{type:'button'}}).onclick=()=>this.close();
 }
 private async copy(){
  if(this.busy||!this.current())return;
  this.busy=true;this.copyButton!.disabled=true;
  try{
   const clipboard=this.host.document.defaultView?.navigator.clipboard;
   if(!clipboard?.writeText)throw Error('当前窗口无法访问剪贴板');
   await clipboard.writeText(this.host.source);
   if(this.current())this.status!.setText('已复制完整白板内容，请粘贴到独立文件保存。');
  }catch(error){if(this.current())this.status!.setText(`复制失败：${error instanceof Error?error.message:String(error)}。内容仍在文本框中，请点击“选择全部”后手动复制。`);}
  finally{this.busy=false;if(this.current())this.copyButton!.disabled=false;}
 }
 onClose(){
  this.alive=false;this.viewport?.();this.viewport=undefined;this.contentEl.empty();this.textarea=undefined;this.status=undefined;this.copyButton=undefined;
  if(!this.completed){this.completed=true;this.host.closed();}
 }
}
