import {Modal,type App} from 'obsidian';

export interface BrainNodeRenameHost {
 document:Document;title:string;name:string;description:string;current:()=>boolean;
 retrying?:()=>boolean;decorate?:(el:HTMLElement)=>void;commit:(name:string,current:()=>boolean)=>Promise<void>;
}
/** Keep failed names editable and visible; closing invalidates pending writes. */
export class BrainNodeRenameModal extends Modal {
 private alive=false;private busy=false;private frame=0;
 constructor(app:App,private readonly host:BrainNodeRenameHost){super(app);}
 onOpen(){
  const doc=this.host.document;if(!this.host.current()||!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;this.modalEl.addClass('ts-brain-rename-modal');this.host.decorate?.(this.modalEl);
  this.contentEl.createEl('h2',{text:this.host.title});this.contentEl.createEl('p',{text:this.host.description,cls:'setting-item-description'});
  const input=this.contentEl.createEl('input',{type:'text',value:this.host.name,cls:'ts-wide',attr:{'aria-label':'新名称',maxlength:'160'}});
  const status=this.contentEl.createDiv({attr:{role:'status','aria-live':'polite'}}),actions=this.contentEl.createDiv('modal-button-container');
  const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}}),save=actions.createEl('button',{text:'确定',cls:'mod-cta',attr:{type:'button'}});
  const live=()=>this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===doc&&!doc.defaultView?.closed;
  const render=()=>{save.disabled=this.busy||!live()||!this.host.current()||!input.value.trim();input.disabled=this.busy||!!this.host.retrying?.();if(this.host.retrying?.())save.setText('重试保存');};
  cancel.onclick=()=>this.close();input.oninput=render;
  save.onclick=()=>{if(save.disabled||this.busy||!live()||!this.host.current())return;this.busy=true;status.setText('正在重命名…');render();void this.host.commit(input.value.trim(),live).then(()=>{if(live())this.close();}).catch(error=>{if(live()){status.setText(error instanceof Error?error.message:String(error));save.setText('重试');}}).finally(()=>{this.busy=false;if(live())render();});};
  input.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();save.click();}};
  render();input.focus();input.select();this.frame=doc.defaultView.requestAnimationFrame(()=>{this.frame=0;if(live()){input.focus();input.select();}});
 }
 onClose(){this.alive=false;if(this.frame)this.host.document.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;this.contentEl.empty();}
}
