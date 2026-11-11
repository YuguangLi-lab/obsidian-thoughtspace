import {Modal,type App} from 'obsidian';
import {firstSessionSteps} from './first-session';
import {themeSurface} from './ui-tokens';

/** A short explanation of the library views. Dismissing it does not change notes or boards. */
export class FirstSessionModal extends Modal {
 constructor(app:App,private dismiss:()=>void){super(app);}
 onOpen(){
  this.modalEl.addClass('ts-library-welcome');themeSurface(this.modalEl);
  this.titleEl.setText('卡片库可以怎么用');
  const root=this.contentEl;
  root.addClass('ts-library-welcome-content');
  for(const step of firstSessionSteps){
   const block=root.createDiv('ts-library-welcome-step');
   block.createEl('h3',{text:step.title});
   block.createEl('p',{text:step.body});
  }
  const actions=root.createDiv('modal-button-container');
  const stay=actions.createEl('button',{text:'稍后',cls:'ts-button',attr:{type:'button'}});
  stay.onclick=()=>this.close();
  const done=actions.createEl('button',{text:'不再提示',cls:'ts-button mod-cta',attr:{type:'button'}});
  done.onclick=()=>{this.dismiss();this.close();};
 }
 onClose(){this.contentEl.empty();}
}
