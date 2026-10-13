import {Modal,type App} from 'obsidian';
import {bindBoardModalViewport} from './board-modal-viewport';
import {themeSurface} from './ui-tokens';
import {CaptureDeliveryOperation,type CaptureDeliveryHost,type CaptureDestination,type CaptureDraft,type CaptureFile,type CaptureResult} from './capture-delivery';

export interface CaptureDestinationPicker<T> {
 result:Promise<CaptureDestination<T>|undefined>;close:()=>void;
}
export interface CaptureDeliveryModalHost<F extends CaptureFile,T,P> extends CaptureDeliveryHost<F,T,P> {
 document:Document;draft:CaptureDraft<F,T,P>;
 /** Existing current/recent destinations, with ready validated Session handles. */
 destinations:()=>Promise<readonly CaptureDestination<T>[]>;
 /** Reuse the native board picker, bound to document and current(). Closing must
  * settle result with undefined; never leave a plugin-level pending picker. */
 pickDestination:(current:()=>boolean)=>CaptureDestinationPicker<T>;
 returnToOrigin:(current:()=>boolean)=>Promise<void>;
 openNote?:(file:F,current:()=>boolean)=>Promise<void>;
 notice:(message:string)=>void;closed?:()=>void;
 /** Origin navigation invalidates monotonically, including away-and-return. */
 watchCurrent?:(invalidate:()=>void)=>()=>void;
}

/** The modal never clears the plugin-owned draft on cancel, failure or a late
 * async result. All creation/delivery goes through the single coordinator. */
export class CaptureDeliveryModal<F extends CaptureFile,T,P> extends Modal {
 private alive=false;private choosing=false;private loading=false;private navigating=false;private closedNotified=false;
 private picker?:CaptureDestinationPicker<T>;private viewport?:()=>void;private stopCurrent?:()=>void;
 private focusFrame=0;private choices:CaptureDestination<T>[]=[];
 private titleInput?:HTMLInputElement;private bodyInput?:HTMLTextAreaElement;
 private destinationSelect?:HTMLSelectElement;private groupSelect?:HTMLSelectElement;private groupLabel?:HTMLElement;
 private targetPath?:HTMLElement;private status?:HTMLElement;private footer?:HTMLElement;
 private chooseButton?:HTMLButtonElement;private submit?:HTMLButtonElement;private sidebar?:HTMLButtonElement;
 private another?:HTMLButtonElement;private closeButton?:HTMLButtonElement;
 private readonly operation:CaptureDeliveryOperation<F,T,P>;
 constructor(app:App,private readonly host:CaptureDeliveryModalHost<F,T,P>){
  super(app);this.operation=new CaptureDeliveryOperation(host.draft,{...host,current:()=>this.current()});
 }
 private current(){return this.alive&&this.host.current()&&!!this.host.document.defaultView&&!this.host.document.defaultView.closed;}
 private fail(error:unknown){if(this.alive)this.status?.setText(error instanceof Error?error.message:String(error));}
 onOpen(){
  const doc=this.host.document;if(!this.host.current()||!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;this.modalEl.addClass('ts-capture-delivery');themeSurface(this.modalEl);this.viewport=bindBoardModalViewport(this.containerEl);
  this.contentEl.createEl('h2',{text:'快速收集'});
  this.contentEl.createEl('p',{cls:'setting-item-description',text:'写下笔记并指定白板落点；笔记原文共用，取消会保留本次输入。'});
  const titleLabel=this.contentEl.createEl('label',{cls:'ts-capture-field'});titleLabel.createSpan({text:'标题'});
  this.titleInput=titleLabel.createEl('input',{type:'text',value:this.host.draft.title,attr:{'aria-label':'收集笔记标题',maxlength:'100','data-capture-title':'true'}});
  const bodyLabel=this.contentEl.createEl('label',{cls:'ts-capture-field'});bodyLabel.createSpan({text:'正文'});
  this.bodyInput=bodyLabel.createEl('textarea',{attr:{'aria-label':'收集笔记正文',maxlength:'100000',rows:'5','data-capture-body':'true'}});
  // Obsidian createEl's value option is an attribute. A textarea's live value
  // must be restored explicitly when opening a retained draft.
  this.bodyInput.value=this.host.draft.body;
  const input=()=>{try{this.operation.setContent(this.titleInput!.value,this.bodyInput!.value);this.render();}catch(error){this.fail(error);}};
  this.titleInput.oninput=input;this.bodyInput.oninput=input;
  const destination=this.contentEl.createEl('label',{cls:'ts-capture-field'});destination.createSpan({text:'放到哪里'});
  const row=destination.createDiv('ts-capture-destination-row');
  this.destinationSelect=row.createEl('select',{attr:{'aria-label':'收集目标白板','data-capture-destination':'true'}});
  this.destinationSelect.onchange=()=>{try{const selected=this.choices.find(choice=>choice.key===this.destinationSelect!.value);this.operation.selectDestination(selected);this.renderGroups();this.render();}catch(error){this.fail(error);this.renderChoices();}};
  this.chooseButton=row.createEl('button',{text:'其他白板…',attr:{'aria-label':'选择其他目标白板','data-capture-action':'choose'}});this.chooseButton.onclick=()=>this.choose();
  this.targetPath=this.contentEl.createEl('p',{cls:'ts-capture-target-path',attr:{'data-capture-target-path':'true'}});
  this.groupLabel=this.contentEl.createEl('label',{cls:'ts-capture-field'});this.groupLabel.createSpan({text:'目标分组'});
  this.groupSelect=this.groupLabel.createEl('select',{attr:{'aria-label':'收集目标分组','data-capture-group':'true'}});
  this.groupSelect.onchange=()=>{try{const destination=this.host.draft.destination;if(!destination)return;this.operation.selectDestination({...destination,groupId:this.groupSelect!.value||undefined});this.render();}catch(error){this.fail(error);this.renderGroups();}};
  const footer=this.footer=this.modalEl.createDiv('ts-capture-footer');
  this.status=footer.createEl('p',{attr:{role:'status','aria-live':'polite','data-capture-status':'true'}});
  const actions=footer.createDiv('ts-capture-actions');
  this.submit=this.button(actions,'收集并返回','submit',()=>this.run('return'),true);
  if(this.host.openNote)this.sidebar=this.button(actions,'在侧栏继续','sidebar',()=>this.run('sidebar'));
  this.another=this.button(actions,'新的一条','another',()=>{try{this.operation.startAnother();this.titleInput!.value='';this.bodyInput!.value='';this.status?.setText('');this.render();this.titleInput?.focus({preventScroll:true});}catch(error){this.fail(error);}});
  this.closeButton=this.button(actions,'暂存并关闭','cancel',()=>this.close());
  this.contentEl.addEventListener('keydown',this.submitKey);
  this.stopCurrent=this.host.watchCurrent?.(()=>{if(this.alive)this.close();});
  this.renderChoices();this.renderGroups();this.render();
  this.focusFrame=doc.defaultView.requestAnimationFrame(()=>{this.focusFrame=0;if(this.current())(this.operation.contentLocked?this.submit:this.titleInput)?.focus({preventScroll:true});});
  // Reopening while an earlier canceled create is completing keeps inputs and
  // buttons locked until the shared retained draft is safe to resume.
  void this.host.draft.pending?.catch(()=>{}).finally(()=>{if(this.alive){this.renderChoices();this.renderGroups();this.render();}});
  void this.loadDestinations();
 }
 private readonly submitKey=(event:KeyboardEvent)=>{
  if(event.isComposing||event.keyCode===229||event.defaultPrevented)return;
  if((event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&event.key==='Enter'){
   event.preventDefault();if(!this.submit?.disabled)this.submit?.click();
  }
 };
 private button(parent:HTMLElement,label:string,action:string,click:()=>void,primary=false){
  const button=parent.createEl('button',{text:label,cls:primary?'mod-cta':'',attr:{'aria-label':label,'data-capture-action':action}});button.onclick=click;return button;
 }
 private async loadDestinations(){
  this.loading=true;this.render();
  try{const choices=await this.host.destinations();if(!this.current())return;const seen=new Set<string>();this.choices=choices.filter(choice=>{if(!choice.key||seen.has(choice.key))return false;seen.add(choice.key);return true;});this.renderChoices();this.renderGroups();}
  catch(error){this.fail(error);}finally{this.loading=false;if(this.alive)this.render();}
 }
 private renderChoices(){
  const select=this.destinationSelect;if(!select)return;select.empty();select.createEl('option',{value:'',text:'仅存入笔记收件箱'});
  const selected=this.host.draft.destination,choices=[...this.choices];if(selected&&!choices.some(choice=>choice.key===selected.key))choices.unshift(selected);
  for(const choice of choices)select.createEl('option',{value:choice.key,text:choice.title+(choice.hint?` · ${choice.hint}`:'')});
  // The selected handle is retained. Refreshing the list must never silently
  // switch a previously captured TFile/Session identity to a replacement.
  if(selected){this.choices=choices.map(choice=>choice.key===selected.key?selected:choice);select.value=selected.key;}else select.value='';
 }
 private renderGroups(){
  const select=this.groupSelect;if(!select)return;select.empty();select.createEl('option',{value:'',text:'白板空白处'});
  const destination=this.host.draft.destination;for(const group of destination?.groups||[])select.createEl('option',{value:group.id,text:group.title});
  if(destination?.groupId&&!destination.groups.some(group=>group.id===destination.groupId))select.createEl('option',{value:destination.groupId,text:'原分组已变化 · 请重新选择'});
  select.value=destination?.groupId||'';if(this.groupLabel)this.groupLabel.hidden=!destination;
 }
 private render(){
  if(!this.alive)return;
  const busy=this.operation.busy||this.choosing||this.navigating,invalid=!this.current();
  if(this.titleInput)this.titleInput.disabled=busy||this.operation.contentLocked||invalid;
  if(this.bodyInput)this.bodyInput.disabled=busy||this.operation.contentLocked||invalid;
  if(this.destinationSelect)this.destinationSelect.disabled=busy||this.loading||this.operation.destinationLocked||invalid;
  if(this.groupSelect)this.groupSelect.disabled=busy||this.operation.destinationLocked||invalid;
  if(this.chooseButton)this.chooseButton.disabled=busy||this.operation.destinationLocked||invalid;
  if(this.submit)this.submit.disabled=busy||invalid||!this.host.draft.title.trim()||!!this.host.draft.attempt?.creationUnconfirmed;
  if(this.sidebar)this.sidebar.disabled=this.submit?.disabled??true;
  if(this.another){this.another.hidden=!this.operation.completed;this.another.disabled=busy||invalid;}
  if(this.closeButton)this.closeButton.disabled=this.navigating;
  this.targetPath?.setText(this.host.draft.destination?.pathSnapshot||'笔记先留在收件箱，之后可批量投递到白板。');
  if(this.submit)this.submit.setText(this.operation.completed?'返回收集前位置':this.operation.createdFile?'继续确认投递':'收集并返回');
  if(this.host.draft.attempt?.creationUnconfirmed&&this.status&&!this.status.textContent)this.status.setText(this.host.draft.attempt.creationUnconfirmed+'；输入已保留，请先核对仓库中的创建结果。');
  if(this.operation.createdFile&&this.status&&!this.status.textContent)this.status.setText(this.operation.completed?`已保存：${this.operation.createdFile.path}`:`已创建：${this.operation.createdFile.path}；继续会沿用这篇笔记。`);
 }
 private choose(){
  if(!this.current()||this.operation.destinationLocked||this.choosing)return;
  this.choosing=true;this.render();
  try{
   const picker=this.picker=this.host.pickDestination(()=>this.current());
   void picker.result.then(destination=>{if(!this.current()||this.picker!==picker||!destination)return;this.operation.selectDestination(destination);this.renderChoices();this.renderGroups();this.status?.setText('');}).catch(error=>this.fail(error)).finally(()=>{if(this.picker===picker)this.picker=undefined;this.choosing=false;if(this.alive){this.render();this.chooseButton?.focus({preventScroll:true});}});
  }catch(error){this.choosing=false;this.fail(error);this.render();}
 }
 private run(mode:'return'|'sidebar'){
  if(!this.current()||this.operation.busy||this.choosing||this.navigating)return;
  this.status?.setText(this.operation.createdFile?'正在确认保存…':'正在收集…');
  const work=this.operation.run();this.render();
  void work.then(result=>this.navigate(result,mode)).catch(error=>{if(this.alive)this.fail(error);else if(this.operation.createdFile)this.host.notice(`收集窗口已关闭；笔记已保留：${this.operation.createdFile.path}。重开收集可核对投递，未继续导航。`);}).finally(()=>{this.navigating=false;if(this.alive)this.render();});
 }
 private async navigate(result:CaptureResult<F,T,P>,mode:'return'|'sidebar'){
  if(!this.current())return;
  this.navigating=true;this.render();this.host.notice(result.destination?`已收集到 ${result.destination.title}：${result.file.path}`:`笔记已收集：${result.file.path}`);
  if(mode==='sidebar'&&this.host.openNote)await this.host.openNote(result.file,()=>this.current());
  else await this.host.returnToOrigin(()=>this.current());
  if(this.alive)this.close();
 }
 onClose(){
  this.alive=false;this.operation.cancel();this.stopCurrent?.();this.stopCurrent=undefined;
  if(this.focusFrame)this.host.document.defaultView?.cancelAnimationFrame(this.focusFrame);this.focusFrame=0;
  this.picker?.close();this.picker=undefined;this.viewport?.();this.viewport=undefined;
  this.contentEl.removeEventListener('keydown',this.submitKey);this.footer?.remove();this.footer=undefined;this.contentEl.empty();if(!this.closedNotified){this.closedNotified=true;this.host.closed?.();}
 }
}
