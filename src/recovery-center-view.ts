import {Modal,type App} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {bindBoardModalViewport} from './board-modal-viewport';
import {recoveryStorageLabel,validateRecoveryItems,type RecoveryCenterItem} from './recovery-center';
export class RecoveryCenterModal extends Modal {
 private alive=false;private run=0;private stop?:()=>void;
 constructor(app:App,private readonly list:(current:()=>boolean)=>Promise<RecoveryCenterItem[]>,private readonly document?:Document){super(app);}
 onOpen(){if(this.document&&this.containerEl.ownerDocument!==this.document)this.document.body.appendChild(this.containerEl);this.alive=true;themeSurface(this.modalEl);this.modalEl.addClass('ts-recovery-center');this.titleEl.setText('恢复中心');this.stop=bindBoardModalViewport(this.containerEl);
  this.contentEl.createEl('p',{text:'集中查看现有草稿与检查点。不会自动合并、清理或写回笔记；内存副本不能保证重启恢复。含截图的媒体草稿请通过原恢复入口处理附件。'});
  const refresh=this.contentEl.createEl('button',{text:'刷新列表'});refresh.onclick=()=>{void this.refresh();};void this.refresh();
 }
 private async refresh(){const run=++this.run,current=()=>this.alive&&run===this.run;this.contentEl.querySelectorAll('[data-recovery-row], [data-recovery-status]').forEach(el=>el.remove());const status=this.contentEl.createEl('p',{text:'正在读取现有恢复记录…',attr:{role:'status','data-recovery-status':'true'}});
  try{const raw=await this.list(current);if(!current())return;const items=validateRecoveryItems(raw);status.setText(items.length?`${items.length} 条恢复记录${raw.length>items.length?'（本次显示有上限，仍有其他记录）':''}；请逐条核对存储状态。`:'当前未发现可列出的草稿；这不保证没有尚未提交的编辑器输入。');
   for(const item of items){if(!current())return;const row=this.contentEl.createEl('details',{attr:{'data-recovery-row':item.id}});row.createEl('summary',{text:item.kind+' · '+item.title+' · '+recoveryStorageLabel(item.storage)});row.createEl('p',{text:item.description});const text=row.createEl('textarea',{attr:{readonly:'true','aria-label':'恢复内容：'+item.title,rows:'5'}});text.setCssStyles({width:'100%',maxHeight:'240px'});const feedback=row.createEl('p',{attr:{role:'status','aria-live':'polite'}});let busy=false;
    let readRun=0;
    const read=async()=>{const request=++readRun;if(!current()||!row.isConnected)return;const value=await item.read();if(!current()||!row.isConnected||request!==readRun)return;if(value.length>2200000)throw Error('恢复内容过大，请从原模块核对');text.value=value;return value;};
    row.ontoggle=()=>{if(!row.open){readRun++;return;}const request=readRun+1;void read().catch(error=>{if(current()&&request===readRun)feedback.setText(String(error));});};
    const copy=row.createEl('button',{text:'复制当前全文'});copy.onclick=async()=>{if(busy||!current())return;busy=true;const request=readRun+1;try{const value=await read();if(value===undefined)return;const clipboard=row.ownerDocument.defaultView?.navigator.clipboard;if(!clipboard)throw Error('剪贴板不可用');await clipboard.writeText(value);if(current()&&request===readRun)feedback.setText('已复制，请粘贴到可靠位置保存。');}catch(error){if(current()&&request===readRun){row.open=true;text.focus();text.select();feedback.setText('请手动复制已显示内容。'+String(error));}}finally{busy=false;}};
    if(item.open){const open=row.createEl('button',{text:'打开原处理入口'});open.onclick=async()=>{if(busy||!current())return;busy=true;open.disabled=true;try{await item.open!();if(current())this.close();}catch(error){if(current())feedback.setText(String(error));}finally{busy=false;if(current())open.disabled=false;}};}
   }
  }catch(error){if(current())status.setText('部分恢复记录无法读取，原始材料未删除：'+String(error));}
 }
 onClose(){this.alive=false;this.run++;this.stop?.();this.contentEl.empty();}
}
