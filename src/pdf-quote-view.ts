import {App,Modal} from 'obsidian';
import {themeSurface} from './ui-tokens';
import type {PdfQuotePlan} from './pdf-quote';
export class PdfQuoteModal extends Modal {
 private closed=false;
 constructor(app:App,private initial:string,private plan:(text:string,source:string)=>PdfQuotePlan,private save:(plan:PdfQuotePlan)=>void){super(app);}
 onOpen(){
  this.modalEl.addClass('ts-pdf-quote-modal');themeSurface(this.modalEl);this.titleEl.setText('粘贴 PDF / PDF++ 引用');
  this.contentEl.createEl('p',{text:'粘贴已复制的链接或摘录。只添加白板卡片；保留原始引用，不修改 PDF 或来源笔记。',cls:'ts-muted'});
  const sourceLabel=this.contentEl.createEl('label',{text:'来源笔记路径（从 Markdown 笔记复制相对链接时填写）'}),source=sourceLabel.createEl('input',{cls:'ts-wide',attr:{type:'text','aria-label':'来源笔记路径',placeholder:'例如：Notes/阅读笔记.md'}});
  const input=this.contentEl.createEl('textarea',{cls:'ts-editor',attr:{'aria-label':'PDF 引用内容',placeholder:'粘贴 PDF 链接、引文或矩形嵌入…',rows:'8'}});input.value=this.initial;input.after(sourceLabel);
  const status=this.contentEl.createDiv({cls:'ts-pdf-quote-status',attr:{role:'status','aria-live':'polite'}});
  this.contentEl.createEl('p',{cls:'ts-muted',text:'高亮、批注和矩形嵌入的显示取决于 PDF++。未启用时可从卡片来源选择“仅打开 PDF 页”。'});
  const actions=this.contentEl.createDiv('ts-pdf-quote-actions'),cancel=actions.createEl('button',{text:'取消'}),save=actions.createEl('button',{text:'加入白板',cls:'mod-cta'});cancel.onclick=()=>this.close();
  let current:PdfQuotePlan|undefined;
  const refresh=()=>{current=undefined;save.disabled=true;try{current=this.plan(input.value,source.value.trim());status.setText(current.links.map(link=>`${link.path} · 第 ${link.page} 页 · ${link.kind}`).join('\n'));save.disabled=false;}catch(error){status.setText(String(error).replace(/^Error: /,''));}};
  source.oninput=input.oninput=refresh;
  save.onclick=()=>{if(this.closed||save.disabled||!current)return;save.disabled=true;try{const latest=this.plan(input.value,source.value.trim());this.save(latest);this.close();}catch(error){status.setText(String(error).replace(/^Error: /,''));save.disabled=false;}};
  input.onkeydown=e=>{if(!e.isComposing&&(e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();save.click();}};
  refresh();input.focus();
 }
 onClose(){this.closed=true;this.contentEl.empty();}
}
