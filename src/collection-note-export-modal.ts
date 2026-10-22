import {Modal,type App} from 'obsidian';
import {bindBoardModalViewport} from './board-modal-viewport';
import {themeSurface} from './ui-tokens';
import {applyWorkspaceDensity} from './workspace-density';
import type {CollectionNoteTarget,CollectionNoteHeading,CollectionNotePreview,CollectionNoteExportReceipt,CollectionNoteExportHistory} from './collection-note-export';

export interface CollectionNoteExportModalHost {
 current():boolean;accent?():string;density?():string;
 sourceTitle:string;sourcePath:string;
 pick(current:()=>boolean):Promise<string|undefined>;
 headings(path:string,current:()=>boolean):Promise<readonly CollectionNoteHeading[]>;
 prepare(target:CollectionNoteTarget,current:()=>boolean):Promise<CollectionNotePreview>;
 commit(preview:CollectionNotePreview,current:()=>boolean):Promise<CollectionNoteExportReceipt>;
 discard(preview:CollectionNotePreview):void;
 inspect(id:string):Promise<CollectionNoteExportHistory>;
 history():Promise<{items:readonly CollectionNoteExportHistory[];warning?:string}>;
 open(path:string,current:()=>boolean):Promise<void>;
 watchCurrent?(invalidate:()=>void):()=>void;closed?():void;
}
/** Confirmation belongs to an immutable preview. Editing its destination,
 * closing, or navigating away cannot authorize that older insertion. */
export class CollectionNoteExportModal extends Modal {
 private alive=false;private closedOnce=false;private epoch=0;private historyEpoch=0;private busy=false;private unbind?:()=>void;private unwatch?:()=>void;
 private readonly consumed=new WeakSet<CollectionNotePreview>();private previewForm='';private uncertain=false;
 private preview?:CollectionNotePreview;private mode?:HTMLSelectElement;private path?:HTMLInputElement;private heading?:HTMLSelectElement;
 private headings:readonly CollectionNoteHeading[]=[];private headingPath='';private status?:HTMLElement;private content?:HTMLElement;private actions?:HTMLElement;private historyEl?:HTMLElement;
 constructor(app:App,private readonly document:Document,private readonly host:CollectionNoteExportModalHost){super(app);}
 private current(){return this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===this.document&&!this.document.defaultView?.closed&&this.host.current();}
 onOpen(){
  if(this.closedOnce||this.alive)return;
  if(!this.host.current()){this.close();return;}if(this.containerEl.ownerDocument!==this.document)this.document.body.appendChild(this.containerEl);
  this.alive=true;this.modalEl.addClass('ts-collection-note-export','ts-collection-content');this.modalEl.dataset.collectionNoteExport='true';
  themeSurface(this.modalEl,{accent:this.host.accent?.()});applyWorkspaceDensity(this.modalEl,this.host.density?.());this.unbind=bindBoardModalViewport(this.containerEl);
  this.contentEl.createEl('h2',{text:'沉淀为笔记'});
  this.contentEl.createEl('p',{cls:'ts-collection-export-intro',text:`把「${this.host.sourceTitle}」放进长期笔记。来源记录和引用关系会保留。`});
  const form=this.contentEl.createDiv('ts-collection-export-fields');
  const mode=form.createEl('label');mode.createSpan({text:'保存方式'});this.mode=mode.createEl('select',{attr:{'data-collection-export-mode':'true','aria-label':'保存方式'}});
  this.mode.createEl('option',{value:'new',text:'新建 Markdown 笔记'});this.mode.createEl('option',{value:'append',text:'追加到已有笔记'});
  const target=form.createEl('label');target.createSpan({text:'目标路径'});this.path=target.createEl('input',{type:'text',attr:{'data-collection-export-path':'true','aria-label':'目标笔记路径',placeholder:'文件夹/笔记.md',maxlength:'4096'}});
  const title=this.host.sourceTitle.replace(/[\\/:*?"<>|#[\]]/g,' ').trim().slice(0,60)||'整理记录';
  const slash=this.host.sourcePath.lastIndexOf('/');this.path.value=(slash>=0?this.host.sourcePath.slice(0,slash+1):'')+title+'-整理.md';
  this.button(form,'选择已有笔记…','pick',()=>{void this.choose();});
  const section=form.createEl('label');section.createSpan({text:'追加位置'});this.heading=section.createEl('select',{attr:{'data-collection-export-heading':'true','aria-label':'追加位置'}});this.resetHeadings();
  this.button(form,'读取标题','headings',()=>{void this.loadHeadings();});
  form.createEl('small',{text:'新建路径需位于已有文件夹；已有同名文件不会被覆盖。追加前可选择标题，并预览实际内容。'});
  this.mode.onchange=()=>{this.invalidate();this.resetHeadings();this.sync();};this.path.oninput=()=>{this.invalidate();this.resetHeadings();};this.heading.onchange=()=>this.invalidate();
  this.status=this.contentEl.createEl('p',{attr:{role:'status','aria-live':'polite','data-collection-export-status':'true'}});
  this.content=this.contentEl.createDiv({cls:'ts-collection-export-preview',attr:{'data-collection-export-preview':'true'}});
  this.actions=this.modalEl.createDiv('ts-collection-export-actions');
  this.button(this.actions,'预览内容','preview',()=>{void this.prepare();});this.button(this.actions,'取消','cancel',()=>this.close());
  const history=this.contentEl.createEl('details',{cls:'ts-collection-export-history'});history.createEl('summary',{text:'最近的沉淀记录'});
  this.historyEl=history.createDiv();history.addEventListener('toggle',()=>{if(history.open)void this.loadHistory();});
  this.unwatch=this.host.watchCurrent?.(()=>this.close());this.document.defaultView?.addEventListener('unload',this.windowClosed,{once:true});this.sync();
 }
 private readonly windowClosed=()=>this.close();
 private button(parent:HTMLElement,label:string,action:string,run:()=>void){
  const button=parent.createEl('button',{text:label,attr:{type:'button','data-collection-export-action':action,'aria-label':label}});button.onclick=run;return button;
 }
 private invalidate(){this.epoch++;if(this.preview)this.host.discard(this.preview);this.preview=undefined;this.previewForm='';this.content?.empty();this.actions?.querySelector('[data-collection-export-action=confirm]')?.remove();this.message('');}
 private resetHeadings(){this.headings=[];this.headingPath='';this.heading?.empty();this.heading?.createEl('option',{value:'',text:'笔记末尾'});if(this.heading)this.heading.value='';}
 private formKey(){return JSON.stringify([this.mode?.value,this.path?.value.trim(),this.heading?.value]);}
 private message(text:string){this.status?.setText(text);}
 private sync(){
  this.modalEl.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button').forEach(control=>{
   const action=control.getAttribute('data-collection-export-action');
   control.disabled=action==='cancel'?false:this.busy||this.uncertain&&['preview','confirm'].includes(action||'');
  });
  const append=this.mode?.value==='append';if(this.heading)this.heading.disabled=this.busy||!append;
  for(const action of ['pick','headings']){const button=this.contentEl.querySelector<HTMLButtonElement>(`[data-collection-export-action=${action}]`);if(button)button.hidden=!append;}
  const label=this.heading?.parentElement;if(label)label.hidden=!append;
 }
 private async choose(){
  if(this.busy||!this.current()||this.mode?.value!=='append')return;this.invalidate();const epoch=this.epoch,current=()=>this.current()&&epoch===this.epoch;this.busy=true;this.sync();let selected=false;
  try{const path=await this.host.pick(current);if(path&&current()){this.path!.value=path;this.resetHeadings();selected=true;}}
  catch(error){if(current())this.message(String(error instanceof Error?error.message:error));}
  finally{this.busy=false;if(this.current())this.sync();}
  if(selected&&current()&&this.path?.value)await this.loadHeadings();
 }
 private async loadHeadings(){
  if(this.busy||!this.current()||this.mode?.value!=='append')return;this.invalidate();this.resetHeadings();const epoch=this.epoch,path=this.path!.value.trim(),current=()=>this.current()&&epoch===this.epoch&&this.mode?.value==='append'&&this.path?.value.trim()===path;this.busy=true;this.sync();
  try{const items=await this.host.headings(path,current);if(!current())return;this.resetHeadings();this.headings=items;this.headingPath=path;const occurrences=new Map<string,number>();
   for(const item of items){const number=(occurrences.get(item.title)||0)+1;occurrences.set(item.title,number);const duplicate=items.some(other=>other!==item&&other.title===item.title);
    this.heading!.createEl('option',{value:`${item.offset}:${item.level}`,text:`${'　'.repeat(item.level-1)}${item.title}${duplicate?` · 同名标题 ${number}`:''}`});}
   this.message(items.length?'可选择标题下的末尾，或整个笔记末尾。':'没有标题，将追加到笔记末尾。');}
  catch(error){if(current())this.message(error instanceof Error?error.message:String(error));}
  finally{this.busy=false;if(this.current())this.sync();}
 }
 private async prepare(){
  if(this.busy||this.uncertain||!this.current())return;this.invalidate();const epoch=this.epoch,form=this.formKey(),current=()=>this.current()&&epoch===this.epoch&&this.formKey()===form,path=this.path!.value.trim(),selected=this.heading?.value;
  const heading=this.mode?.value==='append'&&selected!==''?this.headings.find(item=>`${item.offset}:${item.level}`===selected):undefined;
  if(this.mode?.value==='append'&&selected!==''&&(!heading||this.headingPath!==path)){this.message('目标或标题已变化，请重新读取标题。');return;}
  const target:CollectionNoteTarget=this.mode?.value==='append'?{kind:'append',path,...(heading?{heading:{offset:heading.offset,level:heading.level}}:{})}:{kind:'new',path};
  this.busy=true;this.message('正在核对来源和目标…');this.sync();
  try{
   const preview=await this.host.prepare(target,current);if(!current()){this.host.discard(preview);return;}this.preview=preview;this.previewForm=form;
   this.content!.createEl('h3',{text:(target.kind==='new'?'新建：':'追加：')+preview.target.path});
   this.content!.createEl('p',{text:preview.heading?`位置：${preview.heading.title} 下的末尾`:'位置：笔记末尾'});
   this.content!.createEl('pre',{text:preview.markdown,attr:{tabindex:'0','aria-label':'将写入笔记的 Markdown'}});
   this.button(this.actions!,'确认写入','confirm',()=>{void this.commit(preview,epoch);}).addClass('mod-cta');this.message('确认后仅写入以上目标，来源记录保留。');
  }catch(error){if(current())this.message(error instanceof Error?error.message:String(error));}
  finally{this.busy=false;if(this.current())this.sync();}
 }
 private async commit(preview:CollectionNotePreview,epoch:number){
  const current=()=>this.current()&&this.preview===preview&&epoch===this.epoch&&this.formKey()===this.previewForm;if(this.busy||this.uncertain||this.consumed.has(preview)||!current())return;
  this.consumed.add(preview);
  this.busy=true;this.message('正在写入并核对结果…');this.sync();
  try{const receipt=await this.host.commit(preview,current);if(current()){this.uncertain=receipt.status==='unknown';this.renderReceipt(this.content!,receipt,true);}}
  catch(error){if(current()){this.uncertain=true;this.message(`整理结果尚未确认：${error instanceof Error?error.message:String(error)}。请从最近的沉淀记录核对，不能自动重试。`);}}
  finally{this.busy=false;if(this.current()){this.actions?.querySelector('[data-collection-export-action=confirm]')?.remove();this.sync();}}
 }
 private renderReceipt(parent:HTMLElement,receipt:CollectionNoteExportReceipt,announce=false){
  const labels={confirmed:'已确认写入', 'already-present':'已存在，不再重复写入',unknown:'保存状态待核对','not-written':'未写入目标'};
  const box=parent.createDiv({cls:'ts-collection-export-receipt',attr:{'data-collection-export-receipt':receipt.operationId,'data-collection-export-state':receipt.status}});
  box.createEl('p',{text:`${labels[receipt.status]} · ${receipt.targetPath}`});if(receipt.message)box.createEl('p',{text:receipt.message});
  box.createEl('small',{text:'来源记录保留，未自动归档。'});
  if(receipt.status==='confirmed'||receipt.status==='already-present')this.button(box,'打开目标笔记','open',()=>{void this.openTarget(receipt.targetPath);});
  else this.button(box,'核对保存状态','inspect',()=>{void this.inspect(receipt.operationId,box);});
  if(announce)this.message(labels[receipt.status]+'。');
 }
 private async openTarget(path:string){
  if(this.busy||!this.current())return;this.busy=true;this.sync();
  try{await this.host.open(path,()=>this.current());if(this.alive)this.close();}
  catch(error){if(this.current())this.message(error instanceof Error?error.message:String(error));}
  finally{this.busy=false;if(this.current())this.sync();}
 }
 private async inspect(id:string,parent:HTMLElement){
  if(!this.current()||this.busy)return;this.busy=true;this.sync();
  try{const result=await this.host.inspect(id);if(!this.current()||!parent.isConnected)return;parent.empty();if(result.receipt)this.renderReceipt(parent,result.receipt);else parent.createEl('p',{text:result.blocked||'保存日志暂不可读取。'});}
  catch(error){if(this.current()&&parent.isConnected)parent.createEl('p',{text:error instanceof Error?error.message:String(error)});}
  finally{this.busy=false;if(this.current())this.sync();}
 }
 private async loadHistory(){
  if(!this.current())return;const container=this.historyEl!,epoch=++this.historyEpoch,current=()=>this.current()&&epoch===this.historyEpoch;
  try{const history=await this.host.history();if(!current())return;container.empty();if(history.warning)container.createEl('p',{text:history.warning});if(!history.items.length)container.createEl('p',{text:'尚无沉淀记录。'});
   for(const item of history.items){const row=container.createDiv();if(item.receipt)this.renderReceipt(row,item.receipt);else if(item.journal){row.createEl('p',{text:`待核对 · ${item.journal.target.path}`});this.button(row,'核对保存状态','inspect',()=>{void this.inspect(item.journal!.operationId,row);});}else if(item.blocked)row.createEl('p',{text:item.blocked});}
   this.sync();
  }catch(error){if(current())container.setText(error instanceof Error?error.message:String(error));}
 }
 onClose(){
  if(this.closedOnce)return;this.closedOnce=true;this.alive=false;this.epoch++;this.historyEpoch++;if(this.preview)this.host.discard(this.preview);this.preview=undefined;
  this.unbind?.();this.unbind=undefined;this.unwatch?.();this.unwatch=undefined;this.document.defaultView?.removeEventListener('unload',this.windowClosed);this.contentEl.empty();this.actions?.remove();this.host.closed?.();
 }
}
