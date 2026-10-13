import {Modal,type App} from 'obsidian';
import {uid,type Board} from './model';
import {bindBoardModalViewport} from './board-modal-viewport';
import {themeSurface} from './ui-tokens';
import {addBrainReadingPosition,brainReadingPositionStamp,renameBrainReadingPosition,removeBrainReadingPosition,updateBrainReadingPosition,type BrainReadingPositionState} from './brain-reading-positions';

export interface BrainReadingPositionsHost {
 document:Document;
 snapshot:()=>{board:Board;path:string;key?:object;readOnly?:boolean}|undefined;
 /** Must stay false after navigation away, including a subsequent return. */
 current:()=>boolean;
 watchInvalidation?:(invalidate:()=>void)=>()=>void;
 capture:()=>BrainReadingPositionState;
 commit:(edit:(board:Board)=>void,current:()=>boolean)=>Promise<void>;
 restore:(id:string,expected:string,current:()=>boolean)=>Promise<void>;
 copyLink:(id:string,current:()=>boolean)=>Promise<void>;
 canReturn?:()=>boolean;
 returnOrigin?:(current:()=>boolean)=>Promise<void>;
}
/** Only explicit actions mutate the board. Local name drafts survive failures,
 * while a closed or stale modal can never authorize an asynchronous write. */
export class BrainReadingPositionsModal extends Modal {
 private alive=false;private invalidated=false;private busy=false;private frame=0;
 private unbind?:()=>void;private unwatch?:()=>void;private owner?:object;private path='';
 private status!:HTMLElement;private body!:HTMLElement;private name!:HTMLInputElement;private save!:HTMLButtonElement;
 constructor(app:App,private readonly host:BrainReadingPositionsHost){super(app);}
 onOpen(){
  const doc=this.host.document,snapshot=this.host.snapshot();if(!this.host.current()||!snapshot||snapshot.board.presentation!=='brain'||!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;this.owner=snapshot.key;this.path=snapshot.path;themeSurface(this.modalEl);this.modalEl.addClass('ts-brain-reading-positions');this.unbind=bindBoardModalViewport(this.containerEl);
  this.contentEl.createEl('h2',{text:'脑图阅读位置'});
  const scroll=this.contentEl.createDiv('ts-brain-position-scroll');
  scroll.createEl('p',{cls:'setting-item-description',text:'保存中心节点、展开状态、显示层级和镜头。不会覆盖对象内容、关系或固定节点。'});
  const toolbar=scroll.createDiv('ts-brain-position-create'),label=toolbar.createEl('label');label.createSpan({text:'新位置名称'});this.name=label.createEl('input',{type:'text',attr:{'aria-label':'新位置名称',maxlength:'100',placeholder:'例如：论文证据链'}});
  this.save=this.button(toolbar,'保存当前位置',()=>{const value=this.host.capture(),id=uid(),title=this.name.value;return this.host.commit(board=>addBrainReadingPosition(board,id,title,value),()=>this.current()).then(()=>{if(this.live())this.name.value='';});},true);
  this.name.oninput=()=>this.updateControls();this.name.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();this.save.click();}};
  this.body=scroll.createDiv({cls:'ts-brain-position-body',attr:{'aria-label':'已保存脑图阅读位置'}});
  this.status=this.contentEl.createDiv({cls:'ts-brain-position-status',attr:{role:'status','aria-live':'polite'}});
  const footer=this.contentEl.createDiv('ts-brain-position-footer');
  this.button(footer,'刷新列表',async()=>{this.render();});
  if(this.host.returnOrigin)this.button(footer,'返回出发位置',async()=>{await this.host.returnOrigin!(()=>this.current());if(this.live())this.close();},false,'return');
  const close=footer.createEl('button',{text:'关闭',attr:{type:'button'}});close.onclick=()=>this.close();
  this.unwatch=this.host.watchInvalidation?.(()=>{this.invalidated=true;this.updateControls();if(this.alive)this.status.setText('白板或页面已变化，请关闭后重新打开。输入的名称仍保留在此处。');});
  this.render();this.frame=doc.defaultView.requestAnimationFrame(()=>{this.frame=0;if(this.current())this.name.focus();});
 }
 private live(){const doc=this.host.document;return this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===doc&&!!doc.defaultView&&!doc.defaultView.closed;}
 private current(){const snapshot=this.host.snapshot();if(!this.live()||!this.host.current()||!snapshot||snapshot.key!==this.owner||snapshot.path!==this.path||snapshot.board.presentation!=='brain')this.invalidated=true;return !this.invalidated&&this.live()&&!!snapshot&&!snapshot.readOnly;}
 private button(parent:HTMLElement,title:string,run:()=>Promise<void>,cta=false,kind?:string){
  const button=parent.createEl('button',{text:title,cls:cta?'mod-cta':'',attr:{type:'button','data-brain-position-action':kind??title}});
  button.onclick=()=>{if(button.disabled||this.busy||!this.current()){this.updateControls();return;}this.busy=true;this.updateControls();this.status.setText('正在处理…');
   void Promise.resolve().then(()=>{if(!this.current())throw Error('此操作已取消，白板或页面已变化');return run();}).then(()=>{if(this.current()){this.status.setText('');this.render();}}).catch(error=>{if(this.live())this.status.setText(error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;if(this.live())this.updateControls();});
  };return button;
 }
 private updateControls(){
  if(!this.alive)return;const current=this.current();for(const button of Array.from(this.contentEl.querySelectorAll<HTMLButtonElement>('[data-brain-position-action]')))button.disabled=this.busy||!current||(button.dataset.brainPositionAction==='return'&&!this.host.canReturn?.());
  if(this.save)this.save.disabled=this.busy||!current||!this.name.value.trim();
  for(const input of Array.from(this.contentEl.querySelectorAll<HTMLInputElement>('input')))input.disabled=this.busy||!current;
 }
 private render(){
  if(!this.live())return;const snapshot=this.host.snapshot();this.body.empty();
  if(!snapshot||snapshot.board.presentation!=='brain'){this.updateControls();return;}
  const positions=snapshot.board.brainReadingPositions??[];if(!positions.length)this.body.createEl('p',{cls:'setting-item-description',text:'还没有保存的阅读位置。先移动到常看的关系，再输入名称保存。'});
  const nodes=new Map(snapshot.board.nodes.map(node=>[node.id,node]));
  for(const position of positions){
   const expected=brainReadingPositionStamp(position),row=this.body.createDiv('ts-brain-position-row');row.dataset.brainReadingPositionId=position.id;
   const node=nodes.get(position.centerId),label=node?.title||node?.file||'中心节点已移除';row.createEl('p',{cls:'ts-brain-position-meta',text:`${label} · ${position.depth} 层 · ${Math.round(position.viewport.zoom*100)}%`});
   const nameLabel=row.createEl('label');nameLabel.createSpan({text:'位置名称'});const input=nameLabel.createEl('input',{type:'text',value:position.name,attr:{'aria-label':`位置名称：${position.name}`,maxlength:'100'}});
   const actions=row.createDiv('ts-brain-position-actions');
   this.button(actions,'定位',async()=>{await this.host.restore(position.id,expected,()=>this.current());if(this.live())this.close();},true);
   this.button(actions,'保存名称',()=>this.host.commit(board=>renameBrainReadingPosition(board,position.id,input.value,expected),()=>this.current()));
   this.button(actions,'用当前位置更新',()=>{const state=this.host.capture();return this.host.commit(board=>updateBrainReadingPosition(board,position.id,state,expected),()=>this.current());});
   this.button(actions,'复制位置链接',()=>this.host.copyLink(position.id,()=>this.current()));
   this.button(actions,'移除',()=>this.host.commit(board=>removeBrainReadingPosition(board,position.id,expected),()=>this.current()));
  }
  this.updateControls();
 }
 onClose(){this.alive=false;this.invalidated=true;this.unwatch?.();this.unwatch=undefined;this.unbind?.();this.unbind=undefined;if(this.frame)this.host.document.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;this.contentEl.empty();}
}
