import {App,Component,MarkdownRenderer,Modal,setIcon} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {referenceReading} from './reference-reading';

export class ReferenceReadingModal extends Modal {
 private renderScope=new Component();
 private closed=false;
 private busy=false;
 private prose?:HTMLElement;
 private error?:HTMLElement;
 private actions:HTMLButtonElement[]=[];
 constructor(app:App,private sourcePath:string,private content:ReturnType<typeof referenceReading>,private done:()=>void,private insert?:(embed:boolean)=>Promise<void>,private preferredEmbed=false){super(app);}
 onOpen(){
  themeSurface(this.modalEl);this.modalEl.addClass('ts-reference-reading');this.titleEl.setText('引用原文');
  const head=this.contentEl.createDiv('ts-reference-reading-head');head.createEl('strong',{text:this.content.label});head.createEl('small',{text:`${this.sourcePath} · 第 ${this.content.line} 行起`});
  this.prose=this.contentEl.createDiv({cls:'ts-reference-reading-prose markdown-rendered'});
  if(this.content.truncated)this.contentEl.createDiv({cls:'ts-reference-reading-limit',text:'内容较长，当前展示前 40,000 字符；插入的链接仍指向完整引用范围。'});
  this.error=this.contentEl.createDiv({cls:'ts-reference-reading-error',attr:{role:'alert'}});
  const footer=this.contentEl.createDiv('ts-reference-reading-footer');
  footer.createSpan({text:this.insert?'引用当前范围 · 保留原生双链与撤销':'只读预览 · 关闭后继续选择引用'});
  const actions=footer.createDiv('ts-reference-reading-actions');
  const back=actions.createEl('button',{text:'返回引用'});back.onclick=()=>this.close();
  if(this.insert){
   for(const [embed,label,icon] of [[false,'插入链接','link'],[true,'嵌入正文','panel-top']] as const){
    const button=actions.createEl('button',{cls:embed===this.preferredEmbed?'mod-cta':'',attr:{'aria-label':label,title:embed?'嵌入当前引用范围，正文随原笔记更新':'用当前范围的链接替换原选中文字'}});
    setIcon(button.createSpan(),icon);button.createSpan({text:label});button.onclick=()=>void this.submit(embed);this.actions.push(button);
   }
  }
  this.renderScope.load();this.renderScope.registerDomEvent(this.prose,'click',e=>{if((e.target as Element).closest('input[type=checkbox]')){e.preventDefault();e.stopPropagation();}},true);void this.render();
 }
 private async submit(embed:boolean){
  if(this.closed||this.busy||!this.insert)return;
  this.busy=true;this.error?.empty();this.actions.forEach(b=>b.disabled=true);
  try{await this.insert(embed);if(!this.closed)this.close();}
  catch(e){if(!this.closed)this.error?.setText(e instanceof Error?e.message:String(e));}
  finally{this.busy=false;if(!this.closed)this.actions.forEach(b=>b.disabled=false);}
 }
 private async render(){const prose=this.prose!;try{await MarkdownRenderer.render(this.app,this.content.markdown,prose,this.sourcePath,this.renderScope);if(this.closed){this.renderScope.unload();return;}prose.querySelectorAll<HTMLInputElement>('input').forEach(input=>input.disabled=true);prose.querySelectorAll<HTMLElement>('[contenteditable]').forEach(el=>el.setAttribute('contenteditable','false'));}catch(e){if(!this.closed)prose.createDiv({text:'原文预览暂不可用：'+String(e)});}}
 onClose(){this.closed=true;this.renderScope.unload();this.content.markdown='';this.contentEl.empty();this.prose=undefined;this.error=undefined;this.actions=[];this.insert=undefined;this.done();}
}
