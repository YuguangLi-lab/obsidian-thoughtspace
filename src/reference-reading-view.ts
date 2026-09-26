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
  const head=this.contentEl.createDiv('ts-reference-reading-head');
  setIcon(head.createSpan({cls:'ts-reference-reading-source-icon',attr:{'aria-hidden':'true'}}),'file-text');
  const source=head.createDiv('ts-reference-reading-source');
  source.createEl('strong',{text:this.sourcePath.split('/').pop()?.replace(/\.md$/i,'')||'原笔记',attr:{title:this.sourcePath}});
  source.createEl('small',{text:this.sourcePath,attr:{title:this.sourcePath}});
  const range=head.createDiv('ts-reference-reading-range');
  setIcon(range.createSpan({cls:'ts-reference-reading-range-icon',attr:{'aria-hidden':'true'}}),'quote');
  range.createSpan({cls:'ts-reference-reading-range-label',text:this.content.label,attr:{title:this.content.label}});
  range.createSpan({cls:'ts-reference-reading-line',text:`第 ${this.content.line} 行起`});
  this.prose=this.contentEl.createDiv({cls:'ts-reference-reading-prose markdown-rendered',attr:{role:'region','aria-label':'引用正文',tabindex:'0'}});
  if(this.content.truncated)this.contentEl.createDiv({cls:'ts-reference-reading-limit',text:'内容较长，当前展示前 40,000 字符；插入的链接仍指向完整引用范围。'});
  this.error=this.contentEl.createDiv({cls:'ts-reference-reading-error',attr:{role:'alert'}});
  const footer=this.contentEl.createDiv('ts-reference-reading-footer');
  const back=footer.createEl('button',{cls:'ts-reference-reading-back',attr:{'aria-label':'返回引用选择',title:'返回引用选择'}});
  setIcon(back.createSpan({'attr':{'aria-hidden':'true'}}),'arrow-left');back.createSpan({text:'返回'});back.onclick=()=>this.close();
  footer.createSpan({cls:'ts-reference-reading-readonly',text:'只读预览',attr:{title:this.insert?'插入的引用保留原生双链':'关闭后继续选择引用'}});
  const actions=footer.createDiv('ts-reference-reading-actions');
  if(this.insert){
   for(const [embed,label,icon] of [[false,'插入链接','link'],[true,'嵌入正文','panel-top']] as const){
    const button=actions.createEl('button',{cls:embed===this.preferredEmbed?'mod-cta':'',attr:{'aria-label':label,title:embed?'嵌入当前引用范围，正文随原笔记更新':'用当前范围的链接替换原选中文字'}});
    setIcon(button.createSpan({attr:{'aria-hidden':'true'}}),icon);button.createSpan({text:label});button.onclick=()=>void this.submit(embed);this.actions.push(button);
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
