import {Modal,TFile,type App} from 'obsidian';
import type {MediaDraft,MediaDraftStore} from './media-draft-store';
import {mediaClock} from './media-source';

/** Recovery never creates a note or silently binds a draft to a new source. */
export class MediaDraftRecoveryModal extends Modal {
 private urls:string[]=[];
 private busy=false;
 private closed=false;
 constructor(app:App,private store:MediaDraftStore,private restore:(draft:MediaDraft)=>Promise<void>){super(app);}
 onOpen(){this.closed=false;this.render();}
 private render(){
  for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];
  const el=this.contentEl;el.empty();el.createEl('h2',{text:'恢复未保存的媒体摘录'});
  el.createEl('p',{text:'这些草稿仅暂存在本机，尚未写入正式笔记。选择恢复后仍需点击“保存摘录”；关闭此窗口会保留暂存。'});
  const entries=this.store.pending();if(!entries.length)el.createEl('p',{text:'没有待处理的暂存草稿。'});
  for(const draft of entries){
   const row=el.createDiv({cls:'ts-media-draft-recovery'});
   row.createEl('h3',{text:`${draft.source.path} · ${mediaClock(draft.time)}`});
   row.createEl('p',{text:`暂存于 ${new Date(draft.updatedAt).toLocaleString()}`});
   const file=this.app.vault.getAbstractFileByPath(draft.source.path),exists=file instanceof TFile;
   const matches=exists&&file.stat.mtime===draft.source.mtime&&file.stat.size===draft.source.size;
   if(!matches)row.createEl('p',{text:exists?'来源已变化。恢复后只可查看、复制文字或清空，不能保存到此媒体的笔记。':'来源已删除或移动。请在此复制文字、保存截图，或将原媒体放回原位置后重试；暂存不会自动删除。'});
   const text=row.createEl('textarea',{attr:{'aria-label':'暂存摘录正文',rows:'4'}});text.value=draft.text;text.readOnly=true;
   if(draft.image){const url=URL.createObjectURL(draft.image);this.urls.push(url);const link=row.createEl('a',{text:'查看或保存暂存截图',attr:{href:url,download:`${draft.id}.png`}});link.createEl('img',{attr:{src:url,alt:'暂存截图',width:'240'}});}
   const status=row.createEl('p',{attr:{role:'status'}});
   const restore=row.createEl('button',{text:'恢复草稿',attr:{type:'button'}}),discard=row.createEl('button',{text:'丢弃草稿',attr:{type:'button'}});
   restore.disabled=!exists;
   const run=async(action:()=>Promise<void>)=>{
    if(this.busy)return;this.busy=true;restore.disabled=true;discard.disabled=true;
    try{await action();if(!this.closed)this.render();}
    catch{status.textContent='操作未完成，暂存仍保留，请重试。';restore.disabled=!exists;discard.disabled=false;}
    finally{this.busy=false;}
   };
   restore.onclick=()=>{void run(async()=>{await this.restore(draft);});};
   discard.onclick=()=>{void run(()=>this.store.discard(draft.id));};
  }
 }
 onClose(){this.closed=true;for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];this.contentEl.empty();}
}
