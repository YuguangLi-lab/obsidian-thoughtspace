import {Modal,Setting,View,type App} from 'obsidian';
import {cleanBoardCreationPreferences,type BoardCreationPreferences} from './board-creation';

export interface BoardCreationHost {
 initial:BoardCreationPreferences;name?:string;title?:string;template?:boolean;
 current:()=>boolean;decorate?:(element:HTMLElement)=>void;
 submit:(name:string,choice:BoardCreationPreferences,current:()=>boolean)=>Promise<void>;
}
// Some IMEs emit the compatibility 229 code before isComposing becomes true.
const compositionKey=(event:{isComposing:boolean;keyCode?:number})=>event.isComposing||event.keyCode===229;

/** Compact native modal. Closing revokes navigation and preference writes while
 * the host preserves any file whose vault write has already completed. */
export class BoardCreationModal extends Modal {
 private alive=false;private busy=false;private focusFrame=0;
 constructor(app:App,private readonly host:BoardCreationHost){super(app);}
 onOpen(){
  if(!this.host.current()){this.close();return;}
  this.alive=true;this.modalEl.addClass('ts-prompt-modal');this.host.decorate?.(this.modalEl);
  this.titleEl.setText(this.host.title||'新建白板');
  const initial=cleanBoardCreationPreferences(this.host.initial);
  let presentation=initial.presentation,format=initial.format;
  let typeControl:{setDisabled:(disabled:boolean)=>unknown}|undefined;
  if(!this.host.template)new Setting(this.contentEl).setName('白板类型').addDropdown(control=>{
   typeControl=control;control.selectEl.setAttribute('aria-label','白板类型');control.addOption('board','普通白板').addOption('brain','脑图白板').setValue(presentation).onChange(value=>{presentation=value==='brain'?'brain':'board';});
  });
  let formatControl:{setDisabled:(disabled:boolean)=>unknown}|undefined;
  new Setting(this.contentEl).setName('文件格式').addDropdown(control=>{
   formatControl=control;control.selectEl.setAttribute('aria-label','文件格式');control.addOption('legacy','旧格式 (.thoughtspace)').addOption('markdown','Markdown (.md)').setValue(format).onChange(value=>{format=value==='markdown'?'markdown':'legacy';});
  });
  this.contentEl.createEl('p',{cls:'setting-item-description',text:this.host.template?'模板创建独立白板与 Markdown 卡片。成功后记住所选格式。':'成功创建后记住类型与格式；已有文件保持原格式。'});
  const input=this.contentEl.createEl('input',{cls:'ts-wide',type:'text',value:this.host.name||(presentation==='brain'?'新的脑图':'新的研究主题'),attr:{'aria-label':'白板名称'}});
  const status=this.contentEl.createDiv({attr:{role:'status','aria-live':'polite'}}),actions=this.contentEl.createDiv('modal-button-container');
  const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}}),save=actions.createEl('button',{cls:'mod-cta',text:'创建',attr:{type:'button'}});
  const current=()=>this.alive&&this.containerEl.isConnected&&!this.containerEl.ownerDocument.defaultView?.closed&&this.host.current();
  const render=()=>{save.disabled=this.busy||!current()||!input.value.trim();input.disabled=this.busy;typeControl?.setDisabled(this.busy);formatControl?.setDisabled(this.busy);};
  cancel.onclick=()=>this.close();input.oninput=render;
  save.onclick=()=>{
   if(this.busy||save.disabled||!current())return;
   const name=input.value.trim(),choice={presentation:this.host.template?'board' as const:presentation,format};
   this.busy=true;status.setText('正在创建…');render();
   void Promise.resolve().then(()=>this.host.submit(name,choice,current)).then(()=>{
    if(!current())return;const target=this.app.workspace.getActiveViewOfType(View);this.close();
    if(target instanceof View&&target.containerEl.isConnected&&target.leaf?.view===target)this.app.workspace.setActiveLeaf(target.leaf,{focus:true});
   }).catch(error=>{if(current()){status.setText(error instanceof Error?error.message:String(error));save.setText('重试');}}).finally(()=>{this.busy=false;if(this.alive)render();});
  };
  input.onkeydown=event=>{if(event.defaultPrevented||compositionKey(event))return;if(event.key==='Enter'){event.preventDefault();save.click();}};
  render();input.focus();input.select();
  const win=this.containerEl.ownerDocument.defaultView;if(win)this.focusFrame=win.requestAnimationFrame(()=>{this.focusFrame=0;if(current()){input.focus({preventScroll:true});input.select();}});
 }
 onClose(){this.alive=false;if(this.focusFrame)this.containerEl.ownerDocument.defaultView?.cancelAnimationFrame(this.focusFrame);this.focusFrame=0;this.contentEl.empty();}
}
