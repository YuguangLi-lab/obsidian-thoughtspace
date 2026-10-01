import {App,Modal} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {WritingRange,WritingReferenceMode} from './writing-reference';
/** Read-only source selection. No generated anchors and no writes to the original note. */
export class WritingReferenceModal extends Modal {
 private closed=false;private busy=false;private chosen?:WritingRange;
 constructor(app:App,private source:string,private raw:string,private ranges:WritingRange[],private insert:(mode:WritingReferenceMode,range:WritingRange)=>Promise<void>,private restore:()=>void,private literal=false){super(app);}
 onOpen(){
  themeSurface(this.modalEl);this.modalEl.addClass('ts-writing-reference-picker');this.titleEl.setText('选段引用');
  this.contentEl.createEl('small',{text:this.source,attr:{title:this.source}});
  const label=this.contentEl.createEl('label',{text:'标题、块或段落'}),select=label.createEl('select',{attr:{'aria-label':'引用范围'}});
  select.createEl('option',{text:'在下方选择文字…',value:''});this.ranges.forEach((r,i)=>select.createEl('option',{text:r.label,value:String(i)}));
  const input=this.contentEl.createEl('textarea',{value:this.raw,attr:{'aria-label':'只读来源，选择要引用的文字',readonly:'true',spellcheck:'false'}});input.value=this.raw;
  const hint=this.contentEl.createEl('p',{cls:'ts-writing-reference-hint',text:(this.literal?'文本卡片按字面文字引用，格式和链接可回原卡片查看。':'')+'引用原文是静态副本；嵌入随来源更新，仅使用已有标题或块。自由选段的来源链接指向原文件，不会新建块标识。'});
  const error=this.contentEl.createDiv({attr:{role:'alert'}}),buttons=this.contentEl.createDiv('ts-writing-reference-buttons');
  const actions:HTMLButtonElement[]=[];
  const selection=()=>{const from=input.selectionStart,to=input.selectionEnd;return this.chosen?.from===from&&this.chosen.to===to?this.chosen:{label:'选中文字',from,to};};
  const sync=()=>{const r=selection();actions.forEach((b,i)=>b.disabled=this.busy||r.from===r.to||i===1&&!r.subpath);hint.dataset.hasAnchor=String(!!r.subpath);};
  for(const [mode,text] of [['quote','引用原文'],['embed','嵌入'],['link','仅来源链接']] as const){const b=buttons.createEl('button',{text});actions.push(b);b.onclick=async()=>{if(this.busy||this.closed)return;this.busy=true;sync();error.empty();try{const range=selection();await this.insert(mode,range);if(!this.closed)this.close();}catch(e){if(!this.closed)error.setText(e instanceof Error?e.message:String(e));}finally{this.busy=false;if(!this.closed)sync();}};}
  select.onchange=()=>{this.chosen=select.value===''?undefined:this.ranges[Number(select.value)];if(this.chosen){input.focus();input.setSelectionRange(this.chosen.from,this.chosen.to);}sync();};
  input.addEventListener('select',sync);input.addEventListener('keyup',sync);input.addEventListener('pointerup',sync);sync();select.focus();
 }
 isCurrent(){return !this.closed&&this.modalEl.isConnected;}
 onClose(){this.closed=true;this.raw='';this.ranges=[];this.contentEl.empty();this.modalEl.win.setTimeout(()=>this.restore(),0);}
}
