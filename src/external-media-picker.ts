import {App, Modal, Setting, TFile} from 'obsidian';

/** Only a small reference is saved in the vault; the selected media stays in place. */
export class ExternalMediaPicker extends Modal {
 private closed=false;
 private busy=false;
 constructor(app:App,private link:(input:string)=>Promise<TFile>,private done:(file:TFile)=>unknown,private kind?:'audio'|'video'){super(app);}
 onOpen(){
  this.closed=false;this.modalEl.addClass('ts-prompt-modal');
  this.setTitle(this.kind==='audio'?'链接仓库外的音频':'链接仓库外的视频');
  this.contentEl.createEl('p',{text:'粘贴电脑上的完整文件路径或 file:// 链接。视频留在原位置，仓库只保存引用、播放进度和摘录。'});
  const input=this.contentEl.createEl('input',{cls:'ts-wide',type:'text',attr:{'aria-label':'本地媒体路径或链接',placeholder:'/Users/你的名字/Movies/视频.mp4',spellcheck:'false'}});
  this.contentEl.createEl('small',{text:'支持 .mp4、.webm、.mov 及常见音频格式。原文件移动后，需要重新关联。'});
  const status=this.contentEl.createDiv({attr:{role:'status','aria-live':'polite'}});
  let submitButton:HTMLButtonElement;
  const submit=async()=>{
   if(this.closed||this.busy||!input.value.trim())return;
   this.busy=true;input.disabled=true;submitButton.disabled=true;status.textContent='正在检查文件…';
   try{const file=await this.link(input.value.trim());if(this.closed)return;await this.done(file);if(!this.closed)this.close();}
   catch(error){if(!this.closed){status.textContent=error instanceof Error?error.message:'无法连接文件，请检查路径。';input.disabled=false;submitButton.disabled=false;input.focus();}}
   finally{this.busy=false;}
  };
  new Setting(this.contentEl).addButton(button=>{button.setButtonText('链接文件').setCta().onClick(()=>void submit());submitButton=button.buttonEl;});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();void submit();}});
  input.focus();
 }
 onClose(){this.closed=true;this.contentEl.empty();}
}
