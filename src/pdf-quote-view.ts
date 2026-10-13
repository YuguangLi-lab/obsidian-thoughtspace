import {App,Modal} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {bindBoardModalViewport} from './board-modal-viewport';
import type {PdfQuotePlan} from './pdf-quote';
export class PdfQuoteModal extends Modal {
 private closed=false;
 private viewport?:()=>void;
 constructor(app:App,private initial:string,private plan:(text:string,source:string)=>PdfQuotePlan,private save:(plan:PdfQuotePlan)=>void){super(app);}
 onOpen(){
  this.modalEl.addClass('ts-pdf-quote-modal');themeSurface(this.modalEl);this.viewport?.();this.viewport=bindBoardModalViewport(this.containerEl);this.titleEl.setText('添加 PDF 引用');
  this.contentEl.createEl('p',{text:'粘贴 PDF 或 PDF++ 链接与摘录，保留原始引用。',cls:'ts-pdf-quote-intro'});
  const body=this.contentEl.createDiv('ts-pdf-quote-body');
  const quoteLabel=body.createEl('label',{cls:'ts-pdf-quote-field',text:'引用内容'});
  const input=quoteLabel.createEl('textarea',{cls:'ts-editor',attr:{'aria-label':'PDF 引用内容',placeholder:'粘贴 PDF 链接、引文或矩形嵌入…',rows:'6'}});input.value=this.initial;
  const sourceLabel=body.createEl('label',{cls:'ts-pdf-quote-field',text:'来源笔记路径'}),source=sourceLabel.createEl('input',{cls:'ts-wide',attr:{type:'text','aria-label':'来源笔记路径',placeholder:'例如：Notes/阅读笔记.md'}});
  sourceLabel.createEl('small',{text:'从 Markdown 笔记复制相对链接时填写。'});
  const status=this.contentEl.createDiv({cls:'ts-pdf-quote-status',attr:{role:'status','aria-live':'polite'}});
  body.createEl('p',{cls:'ts-pdf-quote-help',text:'高亮、批注和矩形嵌入需要 PDF++；也可从卡片来源选择“仅打开 PDF 页”。'});
  this.contentEl.createEl('p',{cls:'ts-pdf-quote-scope',text:'只添加白板卡片，PDF 与来源笔记保持原样。'});
  const actions=this.contentEl.createDiv('ts-pdf-quote-actions'),cancel=actions.createEl('button',{text:'取消'}),save=actions.createEl('button',{text:'加入白板',cls:'mod-cta'});cancel.onclick=()=>this.close();
  let current:PdfQuotePlan|undefined;
  const refresh=()=>{current=undefined;save.disabled=true;try{current=this.plan(input.value,source.value.trim());status.setText(current.links.map(link=>`${link.path} · 第 ${link.page} 页 · ${link.kind}`).join('\n'));save.disabled=false;}catch(error){status.setText(String(error).replace(/^Error: /,''));}};
  source.oninput=input.oninput=refresh;
  save.onclick=()=>{if(this.closed||save.disabled||!current)return;save.disabled=true;try{const latest=this.plan(input.value,source.value.trim());this.save(latest);this.close();}catch(error){status.setText(String(error).replace(/^Error: /,''));save.disabled=false;}};
  input.onkeydown=e=>{if(!e.isComposing&&(e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();save.click();}};
  refresh();input.focus();
 }
 onClose(){this.closed=true;this.viewport?.();this.viewport=undefined;this.contentEl.empty();}
}
