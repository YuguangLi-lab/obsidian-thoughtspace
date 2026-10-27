import {Modal,TFile,type App} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {bindBoardModalViewport} from './board-modal-viewport';
import {assertNativeNoteUnchanged} from './native-note-state';
import {compareWritingSource,writingSourceComparator,type WritingSourceCheck} from './writing-source-check';
export class WritingSourceCheckModal extends Modal {
 private alive=false;private run=0;private stopViewport?:()=>void;
 constructor(app:App,private readonly entries:readonly WritingSourceCheck[],private readonly manuscript:()=>string,private readonly readText:(id:string)=>string|undefined,private readonly current:()=>boolean,private readonly document?:Document){super(app);}
 onOpen(){if(this.document&&this.containerEl.ownerDocument!==this.document)this.document.body.appendChild(this.containerEl);this.alive=true;themeSurface(this.modalEl);this.modalEl.addClass('ts-writing-source-check');this.stopViewport=bindBoardModalViewport(this.containerEl);this.titleEl.setText('静态引用来源检查');
  this.contentEl.createEl('p',{text:'只比较已记录的来源版本，不修改来源或文章。旧引用没有基线时不会猜测；动态嵌入继续由 Obsidian 更新。原文未保存的编辑不计入此对照。'});
  if(!this.entries.length)this.contentEl.createEl('p',{text:'暂无可信基线。后续新编排的材料和新插入的静态摘录会记录来源版本。'});
  const refresh=this.contentEl.createEl('button',{text:'重新检查'});refresh.onclick=()=>{void this.check();};void this.check();
 }
 private async check(){const run=++this.run;this.contentEl.querySelectorAll('[data-source-check-row]').forEach(el=>el.remove());
  const win=this.contentEl.ownerDocument.defaultView;if(!win)return;
  const cache=new Map<TFile,{raw:string;stamp:string;compare:ReturnType<typeof writingSourceComparator>}>();let cachedChars=0,index=0;
  for(const entry of this.entries){
   if(!this.alive||!this.current()||run!==this.run||win.closed)return;
   if(index++&&index%8===0)await new Promise<void>(resolve=>win.setTimeout(resolve,0));
   if(!this.alive||!this.current()||run!==this.run)return;
   const row=this.contentEl.createEl('details',{attr:{'data-source-check-row':entry.id}}),summary=row.createEl('summary',{text:entry.path}),status=row.createEl('p',{attr:{role:'status'}});
   try{let raw:string,ctime=entry.ctime,compare:ReturnType<typeof writingSourceComparator>|undefined;
    if(entry.kind==='text'){const text=this.readText(entry.nodeId);if(text===undefined)throw Error('来源卡片已移除或更换');raw=text;}
    else{const file=this.app.vault.getAbstractFileByPath(entry.path);if(!(file instanceof TFile)||file.extension!=='md')throw Error('来源路径已改名、移除或不再是笔记，未猜测新来源');if(file.stat.size>2*1024*1024)throw Error('来源过大，请在原笔记核对');const path=file.path,stamp=file.stat.ctime+':'+file.stat.mtime+':'+file.stat.size,cached=cache.get(file);
     if(cached?.stamp===stamp){raw=cached.raw;compare=cached.compare;}
     else{raw=await this.app.vault.read(file);if(this.app.vault.getAbstractFileByPath(path)!==file||file.path!==path||stamp!==file.stat.ctime+':'+file.stat.mtime+':'+file.stat.size)throw Error('读取期间来源已变化，请重试');compare=writingSourceComparator(raw,file.stat.ctime);
      if(cached){cachedChars-=cached.raw.length;cache.delete(file);}while(cache.size&&(cache.size>=8||cachedChars+raw.length>2000000)){const oldest=cache.keys().next().value!;cachedChars-=cache.get(oldest)!.raw.length;cache.delete(oldest);}if(raw.length<=2000000){cache.set(file,{raw,stamp,compare});cachedChars+=raw.length;}
     }
     assertNativeNoteUnchanged(this.app,file,raw);ctime=file.stat.ctime;
    }
    if(!this.alive||!this.current()||run!==this.run)return;
    const manuscript=this.manuscript(),result=compare?compare(entry,manuscript):compareWritingSource(entry,raw,ctime,manuscript);summary.setText(entry.path+' · '+result.label);status.setText(entry.to-entry.from>2000?'选段较长，下方仅显示前 2,000 字符；完整静态引用仍在文章中。':'此处只读，位置变化时请回原材料重新选段。');
    for(const[label,text]of [['引用时的原文',entry.preview],['原区间现内容',result.current]]){row.createEl('p',{text:label});const box=row.createEl('textarea',{attr:{readonly:'true','aria-label':label,rows:'5'}});box.value=text;box.setCssStyles({width:'100%',maxHeight:'240px'});}
   }catch(error){if(this.alive&&run===this.run)status.setText(error instanceof Error?error.message:String(error));}
  }
 }
 onClose(){this.alive=false;this.run++;this.stopViewport?.();this.contentEl.empty();}
}
