import {App,ItemView,Modal,TFile,setIcon} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {applyWorkspaceDensity} from './workspace-density';
import type {MediaImportSelection} from './media-study-state';

/** Confirmation is local metadata only. Opening the dialog never creates files. */
export class MediaImportModal extends Modal {
 constructor(app:App,private source:{label:string;path:string;title:string;boards:readonly TFile[];accent:string;density:string},private accept:(selection:MediaImportSelection)=>Promise<unknown>,private failure?:(error:unknown)=>void){super(app);}
 close(){const view=this.app.workspace.getActiveViewOfType(ItemView),document=view?.containerEl.ownerDocument;super.close();if(view&&view.leaf.view===view&&view.containerEl.isConnected&&view.containerEl.ownerDocument===document&&!document?.defaultView?.closed)this.app.workspace.setActiveLeaf(view.leaf,{focus:false});}
 onOpen(){
  this.modalEl.addClass('ts-media-import');themeSurface(this.modalEl,{accent:this.source.accent});applyWorkspaceDensity(this.modalEl,this.source.density);this.titleEl.setText('确认视频来源');
  const root=this.contentEl,identity=root.createDiv('ts-media-import-source');setIcon(identity.createSpan(),'clapperboard');identity.createEl('strong',{text:this.source.label});identity.createEl('p',{text:this.source.path});
  const label=root.createEl('label',{text:'标题'}),input=label.createEl('input',{type:'text',value:this.source.title,attr:{'aria-label':'视频标题',maxlength:'160'}});
  const destination=root.createEl('label',{text:'关联白板（可稍后选择）'}),select=destination.createEl('select',{attr:{'aria-label':'视频目标白板'}});select.createEl('option',{value:'',text:'稍后选择，不创建文件'});for(const file of this.source.boards)select.createEl('option',{value:file.path,text:file.path});
  root.createEl('p',{text:'继续使用原媒体与同一份 Markdown 笔记。打开工作区不会创建笔记或移动文件。'});
  const status=root.createDiv({attr:{role:'status'}}),actions=root.createDiv('ts-media-import-actions'),cancel=actions.createEl('button',{text:'取消'}),open=actions.createEl('button',{text:'打开工作区',cls:'mod-cta'});let pending=false,closed=false;
  const original=this.onClose.bind(this);this.onClose=()=>{closed=true;original();};cancel.onclick=()=>this.close();open.onclick=()=>{if(pending)return;const title=input.value.trim();if(!title){status.setText('请填写标题');input.focus();return;}pending=true;open.disabled=true;status.setText('正在打开…');void this.accept({title,...(select.value?{board:select.value}:{})}).then(()=>{if(!closed)this.close();}).catch(e=>{if(!closed)status.setText(e instanceof Error?e.message:String(e));this.failure?.(e);}).finally(()=>{pending=false;if(!closed)open.disabled=false;});};
 }
}

export function chooseMediaStudyBoard(app:App,boards:readonly TFile[],create:(title:string,current:()=>boolean)=>Promise<TFile>,current:()=>boolean):Promise<TFile|undefined>{
 return new Promise(resolve=>{const modal=new Modal(app);let closed=false,pending=false;themeSurface(modal.modalEl);modal.titleEl.setText('选择视频工作区白板');const select=modal.contentEl.createEl('select',{attr:{'aria-label':'并排白板'}});for(const file of boards)select.createEl('option',{text:file.path,value:file.path});const title=modal.contentEl.createEl('input',{type:'text',attr:{placeholder:'新白板名称','aria-label':'新白板名称',maxlength:'100'}}),message=modal.contentEl.createDiv({attr:{role:'status'}});
  const existing=modal.contentEl.createEl('button',{text:'打开所选白板'});existing.disabled=!boards.length;existing.onclick=()=>{const file=boards.find(f=>f.path===select.value);if(file&&current()){resolve(file);modal.close();}};
  const fresh=modal.contentEl.createEl('button',{text:'新建并使用'});fresh.onclick=()=>{if(pending||!current())return;const name=title.value.trim();if(!name){message.setText('请填写白板名称');return;}pending=true;fresh.disabled=existing.disabled=true;void create(name,()=>!closed&&current()).then(file=>{if(!closed&&current())resolve(file);modal.close();}).catch(e=>{if(!closed)message.setText(e instanceof Error?e.message:String(e));}).finally(()=>{pending=false;if(!closed){fresh.disabled=false;existing.disabled=!boards.length;}});};
  modal.contentEl.createEl('button',{text:'取消'}).onclick=()=>modal.close();modal.onClose=()=>{closed=true;resolve(undefined);};modal.open();
 });
}
