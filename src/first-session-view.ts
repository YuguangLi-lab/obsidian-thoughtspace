import {Modal,type App} from 'obsidian';
import {firstSessionSteps} from './first-session';

/** A short explanation of the library views. Dismissing it does not change notes or boards. */
export class FirstSessionModal extends Modal {
 constructor(app:App,private dismiss:()=>void){super(app);}
 onOpen(){
  this.modalEl.addClass('ts-database-modal');
  this.titleEl.setText('卡片库可以怎么用');
  const root=this.contentEl;
  root.addClass('ts-database');
  for(const step of firstSessionSteps){
   const block=root.createDiv('ts-db-help');
   block.createEl('strong',{text:step.title});
   block.createDiv({text:step.body});
  }
  const actions=root.createDiv('ts-db-top');
  const stay=actions.createEl('button',{text:'稍后',attr:{type:'button'}});
  stay.onclick=()=>this.close();
  const done=actions.createEl('button',{text:'不再提示',cls:'mod-cta',attr:{type:'button'}});
  done.onclick=()=>{this.dismiss();this.close();};
 }
 onClose(){this.contentEl.empty();}
}
