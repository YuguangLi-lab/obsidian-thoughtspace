import {Modal,Setting,View,type App,type TFile,type EventRef} from 'obsidian';
import {cleanBoardCreationPreferences,TemplateCreationIncompleteError,type BoardCreationPreferences} from './board-creation';

export interface BoardCreationHost {
 initial:BoardCreationPreferences;name?:string;title?:string;template?:boolean;
 current:()=>boolean;decorate?:(element:HTMLElement)=>void;
 submit:(name:string,choice:BoardCreationPreferences,current:()=>boolean,expectDestination:(file:TFile)=>void)=>Promise<void>;
}
// Some IMEs emit the compatibility 229 code before isComposing becomes true.
const compositionKey=(event:{isComposing:boolean;keyCode?:number})=>event.isComposing||event.keyCode===229;

/** Compact native modal. Closing revokes navigation and preference writes while
 * the host preserves any file whose vault write has already completed. */
export class BoardCreationModal extends Modal {
 private alive=false;private busy=false;private focusFrame=0;private navigation?:EventRef;private navigationCancelled=false;
 constructor(app:App,private readonly host:BoardCreationHost){super(app);}
 onOpen(){
  if(!this.host.current()){this.close();return;}
  this.alive=true;this.modalEl.addClass('ts-prompt-modal');this.host.decorate?.(this.modalEl);
  this.titleEl.setText(this.host.title||'新建白板');
  const originDocument=this.app.workspace.getActiveViewOfType(View)?.containerEl.ownerDocument;if(originDocument&&this.containerEl.ownerDocument!==originDocument)originDocument.body.appendChild(this.containerEl);
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
  const origin=this.app.workspace.getActiveViewOfType(View),leaf=origin?.leaf,doc=origin?.containerEl.ownerDocument||this.containerEl.ownerDocument,win=doc.defaultView;
  const sourceFile:unknown=origin?Reflect.get(origin,'file'):undefined,sourcePath:unknown=sourceFile&&typeof sourceFile==='object'?Reflect.get(sourceFile,'path'):undefined,sourceSession:unknown=origin?Reflect.get(origin,'session'):undefined;
  let expectedFile:TFile|undefined,terminal=false;
  const originCurrent=()=>!origin||origin.containerEl.isConnected&&origin.containerEl.ownerDocument===doc&&origin.leaf===leaf&&leaf?.view===origin&&Reflect.get(origin,'file')===sourceFile&&Reflect.get(origin,'session')===sourceSession&&(!sourceFile||typeof sourceFile!=='object'||Reflect.get(sourceFile,'path')===sourcePath);
  const activeCurrent=()=>{const active=this.app.workspace.getActiveViewOfType(View);return active===origin||!!expectedFile&&active instanceof View&&Reflect.get(active,'file')===expectedFile&&active.containerEl.ownerDocument===doc;};
  const current=()=>{const valid=this.alive&&!this.navigationCancelled&&this.containerEl.isConnected&&this.containerEl.ownerDocument===doc&&doc.defaultView===win&&!win?.closed&&originCurrent()&&activeCurrent()&&this.host.current();if(!valid)this.navigationCancelled=true;return valid;};
  this.navigation=this.app.workspace.on('active-leaf-change',()=>{if(!originCurrent()||!activeCurrent())this.navigationCancelled=true;});
  const expectDestination=(file:TFile)=>{if(current())expectedFile=file;};
  const render=()=>{save.disabled=terminal||this.busy||!current()||!input.value.trim();input.disabled=this.busy;typeControl?.setDisabled(this.busy);formatControl?.setDisabled(this.busy);};
  cancel.onclick=()=>this.close();input.oninput=render;
  save.onclick=()=>{
   if(this.busy||save.disabled||!current())return;
   const name=input.value.trim(),choice={presentation:this.host.template?'board' as const:presentation,format};
   this.busy=true;status.setText('正在创建…');render();
   void Promise.resolve().then(()=>this.host.submit(name,choice,current,expectDestination)).then(()=>{
    if(!current())return;const target=this.app.workspace.getActiveViewOfType(View);this.close();
    if(target instanceof View&&target.containerEl.isConnected&&target.leaf?.view===target)this.app.workspace.setActiveLeaf(target.leaf,{focus:true});
   }).catch(error=>{if(current()){terminal=error instanceof TemplateCreationIncompleteError;status.setText(error instanceof Error?error.message:String(error));save.setText(terminal?'创建已停止':'重试');}}).finally(()=>{this.busy=false;if(this.alive)render();});
  };
  input.onkeydown=event=>{if(event.defaultPrevented||compositionKey(event))return;if(event.key==='Enter'){event.preventDefault();save.click();}};
  render();input.focus();input.select();
  if(win)this.focusFrame=win.requestAnimationFrame(()=>{this.focusFrame=0;if(current()){input.focus({preventScroll:true});input.select();}});
 }
 onClose(){this.alive=false;if(this.navigation)this.app.workspace.offref(this.navigation);this.navigation=undefined;if(this.focusFrame)this.containerEl.ownerDocument.defaultView?.cancelAnimationFrame(this.focusFrame);this.focusFrame=0;this.contentEl.empty();}
}
