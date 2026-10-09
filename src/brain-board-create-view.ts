import {Modal,type App,type TFile} from 'obsidian';
import {brainRelationLabels,type BrainRelationSide} from './brain-board-create';
import {safeName} from './model';

export type BrainNoteTarget={kind:'new';name:string;folder?:string}|{kind:'board';name:string;folder?:string;presentation:'board'|'brain'}|{kind:'idea';name:string}|{kind:'existing';file:TFile;path:string;side?:'left'|'right'};
export interface BrainRelationCreateHost {
 document:Document;side?:BrainRelationSide;center:string;folder:string;boardFolder?:string;initial?:'board';current:()=>boolean;convert?:boolean;
 initialExisting?:{file:TFile;path:string};chooseAssociationSide?:boolean;
 canRetry?:()=>boolean;retry?:(current:()=>boolean)=>Promise<void>;
 decorate?:(el:HTMLElement)=>void;pick:(choose:(file:TFile)=>void)=>Modal;
 commit:(target:BrainNoteTarget,current:()=>boolean)=>Promise<void>;
}

/** Native modal, explicit name/target and confirmation. Closing invalidates the
 * pending request; the host owns safe cleanup before its board transaction. */
export class BrainRelationCreateModal extends Modal {
 private alive=false;private busy=false;private picker?:Modal;private focusFrame=0;
 constructor(app:App,private readonly host:BrainRelationCreateHost){super(app);}
 onOpen(){
  const doc=this.host.document;
  if(!this.host.current()||!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;this.modalEl.addClass('ts-brain-create-modal');this.host.decorate?.(this.modalEl);
  this.contentEl.createEl('h2',{text:this.host.convert?'整理成笔记':this.host.chooseAssociationSide?'关联已有笔记':this.host.side?brainRelationLabels[this.host.side]:'添加知识节点'});
  const meaning=this.contentEl.createEl('p',{cls:'setting-item-description'});
  const modeLabel=this.contentEl.createEl('label',{cls:'ts-brain-field-label',text:'节点来源',attr:{for:'ts-brain-create-source'}});
  const mode=this.contentEl.createEl('select',{cls:'dropdown ts-wide',attr:{id:'ts-brain-create-source','aria-label':'笔记来源'}});
  if(!this.host.convert)mode.createEl('option',{value:'idea',text:'先记想法'});
  mode.createEl('option',{value:'new',text:'新建笔记'});mode.createEl('option',{value:'existing',text:this.host.convert?'保留想法并关联已有笔记':'引用已有笔记'});if(!this.host.convert)mode.createEl('option',{value:'board',text:'新建白板'});
  mode.value=this.host.initialExisting?'existing':this.host.convert?'new':this.host.initial||'idea';mode.hidden=!!this.host.initialExisting;
  const sideLabel=this.contentEl.createEl('label',{cls:'ts-brain-field-label',text:'关联位置',attr:{for:'ts-brain-create-side'}});
  const side=this.contentEl.createEl('select',{cls:'dropdown ts-wide',attr:{id:'ts-brain-create-side','aria-label':'关联位置'}});
  side.createEl('option',{value:'left',text:'左侧 · 双向关联'});side.createEl('option',{value:'right',text:'右侧 · 双向关联'});side.value=this.host.side==='left'?'left':'right';side.hidden=sideLabel.hidden=!this.host.chooseAssociationSide;
  const typeLabel=this.contentEl.createEl('label',{cls:'ts-brain-field-label',text:'白板类型',attr:{for:'ts-brain-create-type'}});
  const boardType=this.contentEl.createEl('select',{cls:'dropdown ts-wide',attr:{id:'ts-brain-create-type','aria-label':'白板类型'}});
  boardType.createEl('option',{value:'board',text:'普通白板'});boardType.createEl('option',{value:'brain',text:'脑图白板'});boardType.value='board';
  const row=this.contentEl.createDiv('ts-brain-create-target');
  const nameLabel=row.createEl('label',{cls:'ts-brain-field-label',attr:{for:'ts-brain-create-name'}});
  const input=row.createEl('input',{cls:'ts-wide',type:'text',value:this.host.convert?this.host.center:'',attr:{id:'ts-brain-create-name','aria-label':'节点名称',placeholder:'输入节点名称',maxlength:'160'}});
  const folders={new:this.host.folder,board:this.host.boardFolder||'ThoughtSpace/白板'};
  let folderKind:'new'|'board'=mode.value==='board'?'board':'new';
  const folderLabel=this.contentEl.createEl('label',{cls:'ts-brain-field-label',text:'目标文件夹',attr:{for:'ts-brain-create-folder'}});
  const folder=this.contentEl.createEl('input',{cls:'ts-wide',type:'text',value:folders[folderKind],attr:{id:'ts-brain-create-folder','aria-label':'目标文件夹'}});
  const choose=row.createEl('button',{cls:'ts-wide',text:'选择已有笔记…',attr:{type:'button'}});
  const destination=this.contentEl.createEl('p',{cls:'setting-item-description'});
  const status=this.contentEl.createDiv({attr:{role:'status','aria-live':'polite'}});
  const actions=this.contentEl.createDiv('modal-button-container');
  const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}}),save=actions.createEl('button',{cls:'mod-cta',text:'确定',attr:{type:'button'}});
  let selected=this.host.initialExisting,retrySave=false,failed=false;
  const connected=()=>this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===doc&&!doc.defaultView?.closed;
  const current=()=>connected()&&this.host.current();
  const render=()=>{
   const existing=mode.value==='existing',idea=mode.value==='idea',board=mode.value==='board';modeLabel.hidden=!!this.host.initialExisting;typeLabel.hidden=!board;nameLabel.hidden=existing;nameLabel.setText(idea?'想法名称':board?'白板名称':'笔记名称');folderLabel.hidden=existing||idea;input.hidden=existing;choose.hidden=!existing;folder.hidden=existing||idea;boardType.hidden=!board;input.setAttribute('aria-label',idea?'想法名称':board?'白板名称':'笔记名称');
   meaning.setText(this.host.convert?existing?'原想法节点、正文与已有关系留在脑图中，仅添加双向关联；目标笔记正文不变。撤销还原本次引用与关联。':'生成原生笔记并保留此节点与关系。撤销仅恢复想法引用，已生成笔记会保留。':!this.host.side?'先命名记录想法，也可引用或新建笔记。':this.host.side==='top'?`父节点 → ${this.host.center}`:this.host.side==='bottom'?`${this.host.center} → 子节点`:`${this.host.center} ↔ 关联节点${this.host.chooseAssociationSide?' · 目标笔记正文不变':''}`);
   choose.setText(selected?.path||'选择已有笔记…');
   destination.setText(idea?'仅存于此脑图，不创建笔记文件':existing?selected?`引用：${selected.path}`:'选择后只添加本板关系':`将创建于：${folder.value}/${input.value.trim()?safeName(input.value.trim()):board?'白板名称':'笔记名称'}.${board?'thoughtspace':'md'}（同名时自动编号）`);
   save.setText(retrySave?'重试保存':failed?'重试':'确定');
   save.disabled=this.busy||(retrySave?!this.host.canRetry?.():!current())||(existing?!selected:!input.value.trim());mode.disabled=this.busy||retrySave;side.disabled=this.busy||retrySave;boardType.disabled=this.busy||retrySave;input.disabled=this.busy||retrySave;choose.disabled=this.busy||retrySave;folder.disabled=this.busy||retrySave;
  };
  mode.onchange=()=>{folders[folderKind]=folder.value;folderKind=mode.value==='board'?'board':'new';folder.value=folders[folderKind];render();(mode.value==='existing'?choose:input).focus();};side.onchange=render;input.oninput=render;folder.oninput=render;
  choose.onclick=()=>{if(this.busy||!current())return;this.picker?.close();const picker=this.host.pick(file=>{if(!current()||this.busy)return;selected={file,path:file.path};render();save.focus({preventScroll:true});});this.picker=picker;picker.open();};
  cancel.onclick=()=>this.close();
  save.onclick=()=>{
   if(this.busy||save.disabled||!(retrySave?connected():current()))return;
   const target:BrainNoteTarget=mode.value==='existing'?{kind:'existing',...selected!,...(this.host.chooseAssociationSide?{side:side.value==='left'?'left' as const:'right' as const}:{})}:mode.value==='idea'?{kind:'idea',name:input.value.trim()}:mode.value==='board'?{kind:'board',name:input.value.trim(),folder:folder.value,presentation:boardType.value==='brain'?'brain':'board'}:{kind:'new',name:input.value.trim(),folder:folder.value};
   this.busy=true;status.setText(retrySave?'正在重试保存…':'正在添加…');render();
   const submit=retrySave&&this.host.retry?this.host.retry(connected):this.host.commit(target,current);
   void submit.then(()=>{if(this.alive)this.close();}).catch(error=>{if(connected()){failed=true;retrySave=!!this.host.retry&&!!this.host.canRetry?.();status.setText(error instanceof Error?error.message:String(error));}}).finally(()=>{this.busy=false;if(this.alive)render();});
  };
  input.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();save.click();}};
  render();(mode.value==='existing'?save:input).focus();
  // Obsidian focuses the first native control after onOpen. Focus the name on
  // the originating window's next frame, and cancel it when the modal closes.
  this.focusFrame=doc.defaultView.requestAnimationFrame(()=>{this.focusFrame=0;if(current())(mode.value==='existing'?(selected?save:choose):input).focus({preventScroll:true});});
 }
 onClose(){this.alive=false;if(this.focusFrame)this.host.document.defaultView?.cancelAnimationFrame(this.focusFrame);this.focusFrame=0;this.picker?.close();this.picker=undefined;this.contentEl.empty();}
}
