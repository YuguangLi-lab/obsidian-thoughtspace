import {Modal,Notice,TFile,View,type App} from 'obsidian';
import type {MediaDraft,MediaDraftStore} from './media-draft-store';
import {mediaClock} from './media-source';
import {themeSurface} from './ui-tokens';
import {bindBoardModalViewport} from './board-modal-viewport';

export interface MediaDraftRecoveryRequest {document:Document;current:()=>boolean}

/** Recovery never creates a note or silently binds a draft to a new source. */
export class MediaDraftRecoveryModal extends Modal {
 private urls:string[]=[];
 private busy=false;
 private closed=false;
 private generation=0;
 private stopViewport?:()=>void;
 private closeButton?:HTMLButtonElement;
 private stopFocus?:()=>void;
 private returnFocus?:()=>void;
 constructor(app:App,private store:MediaDraftStore,private restore:(draft:MediaDraft,request:MediaDraftRecoveryRequest)=>Promise<void>){super(app);this.shouldRestoreSelection=false;}
 open(){
  this.stopFocus?.();this.returnFocus=undefined;
  const view=this.app.workspace.getActiveViewOfType(View),leaf=view?.leaf,doc=view?.containerEl.ownerDocument??this.containerEl.ownerDocument,opener=doc.activeElement;
  const file:unknown=view&&Reflect.get(view,'file'),session:unknown=view&&Reflect.get(view,'session'),filePath=file instanceof TFile?file.path:undefined;
  let displaced=false;
  const current=()=>this.app.workspace.getActiveViewOfType(View)===view&&(!view||!!leaf&&leaf.view===view&&view.containerEl.isConnected&&view.containerEl.ownerDocument===doc&&Reflect.get(view,'file')===file&&Reflect.get(view,'session')===session&&(!(file instanceof TFile)||file.path===filePath))&&!doc.defaultView?.closed&&doc.hasFocus();
  const outside=(event:FocusEvent)=>{if(event.target!==doc.body&&!this.containerEl.contains(event.target as Node))displaced=true;};
  doc.addEventListener('focusin',outside,true);this.stopFocus=()=>doc.removeEventListener('focusin',outside,true);
  this.returnFocus=()=>{
   const active=doc.activeElement;if(displaced||!current()||active&&active!==doc.body&&!this.containerEl.contains(active))return;
   if(opener&&opener!==doc.body&&opener.ownerDocument===doc&&opener.isConnected&&opener.getClientRects().length&&typeof (opener as HTMLElement).focus==='function')(opener as HTMLElement).focus({preventScroll:true});
   else if(leaf)this.app.workspace.setActiveLeaf(leaf,{focus:true});
  };
  super.open();
  if(!this.store.pending().length&&!displaced&&current()&&this.containerEl.isConnected&&(doc.activeElement===doc.body||doc.activeElement===opener||this.containerEl.contains(doc.activeElement)))this.closeButton?.focus({preventScroll:true});
 }
 onOpen(){this.closed=false;this.generation++;this.busy=false;this.stopViewport?.();this.stopViewport=bindBoardModalViewport(this.containerEl);themeSurface(this.modalEl);this.modalEl.addClass('ts-media-draft-recovery-modal');this.render();}
 private render(){
  const doc=this.contentEl.ownerDocument,focused=doc.activeElement,retainFocus=!!focused&&this.contentEl.contains(focused);
  for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];
  const el=this.contentEl;el.empty();el.createEl('h2',{text:'恢复未保存的媒体摘录'});
  el.createEl('p',{text:'这些草稿仅暂存在本机，尚未写入正式笔记。选择恢复后仍需点击“保存摘录”；关闭此窗口会保留暂存。'});
  const entries=this.store.pending();if(!entries.length)el.createEl('p',{text:'没有待处理的暂存草稿。'});
  for(const draft of entries){
   const row=el.createDiv({cls:'ts-media-draft-recovery'});
   row.createEl('h3',{text:`${draft.source.path} · ${mediaClock(draft.time)}`});
   row.createEl('p',{text:`暂存于 ${new Date(draft.updatedAt).toLocaleString()}`});
   const file=this.app.vault.getAbstractFileByPath(draft.source.path),exists=file instanceof TFile;
   const matches=exists&&file.stat.mtime===draft.source.mtime&&file.stat.size===draft.source.size;
   if(!matches)row.createEl('p',{text:exists?'来源已变化。恢复后只可查看、复制文字或清空，不能保存到此媒体的笔记。':'来源已删除或移动。请在此复制文字、保存截图，或将原媒体放回原位置后重试；暂存不会自动删除。'});
   const text=row.createEl('textarea',{attr:{'aria-label':'暂存摘录正文',rows:'4'}});text.value=draft.text;text.readOnly=true;
   if(draft.image){const url=URL.createObjectURL(draft.image);this.urls.push(url);const link=row.createEl('a',{text:'查看或保存暂存截图',attr:{href:url,download:`${draft.id}.png`}});link.createEl('img',{attr:{src:url,alt:'暂存截图',width:'240'}});}
   const status=row.createEl('p',{attr:{role:'status'}});
   const restore=row.createEl('button',{text:'恢复草稿',attr:{type:'button'}}),discard=row.createEl('button',{text:'丢弃草稿',attr:{type:'button'}});
   restore.disabled=!exists;
   const run=async(action:(request:MediaDraftRecoveryRequest)=>Promise<void>)=>{
    if(this.busy||this.closed)return;this.busy=true;restore.disabled=true;discard.disabled=true;
    const generation=this.generation,document=this.containerEl.ownerDocument,win=document.defaultView,current=()=>!this.closed&&this.generation===generation&&this.containerEl.isConnected&&this.containerEl.ownerDocument===document&&!win?.closed;
    try{await action({document,current});if(current())this.render();}
    catch(error){if(current()&&status.isConnected){status.textContent='操作未完成，暂存仍保留，请重试。';restore.disabled=!exists;discard.disabled=false;}else new Notice('操作未完成，暂存仍保留：'+(error instanceof Error?error.message:String(error)));}
    finally{if(this.generation===generation)this.busy=false;}
   };
   restore.onclick=()=>{void run(request=>this.restore(draft,request));};
   discard.onclick=()=>{void run(()=>this.store.discard(draft.id));};
  }
  const actions=el.createDiv('modal-button-container'),close=actions.createEl('button',{text:'关闭',cls:'ts-button',attr:{type:'button'}});close.onclick=()=>this.close();this.closeButton=close;
  if(retainFocus&&(doc.activeElement===doc.body||doc.activeElement===focused&&!focused?.isConnected))close.focus({preventScroll:true});
 }
 close(){this.closed=true;this.generation++;super.close();}
 onClose(){this.closed=true;this.stopViewport?.();this.stopViewport=undefined;this.stopFocus?.();this.stopFocus=undefined;for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];this.contentEl.empty();this.closeButton=undefined;const restore=this.returnFocus;this.returnFocus=undefined;restore?.();}
}
