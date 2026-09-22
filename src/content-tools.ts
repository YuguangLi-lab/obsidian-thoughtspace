import { themeSurface } from './ui-tokens';
import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile } from 'obsidian';
import { Edge, clone, colorNames } from './model';
import { isWorkspaceFile } from './workspace';
export const isImage=(path:string)=>/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(path);
export class ImagePicker extends FuzzySuggestModal<TFile>{
  constructor(app:App,private pick:(file:TFile)=>unknown){super(app);this.setPlaceholder('搜索仓库图片 · PNG / JPEG / GIF / WebP / AVIF / BMP');}
  getItems(){return this.app.vault.getFiles().filter(isWorkspaceFile).filter(f=>isImage(f.path));}
  getItemText(f:TFile){return f.path;}
  onChooseItem(f:TFile){Promise.resolve().then(()=>this.pick(f)).catch(e=>new Notice(String(e)));}
}
export class TextModal extends Modal{
  constructor(app:App,private heading:string,private initial:string,private save:(text:string)=>unknown){super(app);}
  onOpen(){this.titleEl.setText(this.heading);this.modalEl.addClass('ts-text-modal');themeSurface(this.modalEl);const input=this.contentEl.createEl('textarea',{cls:'ts-editor',attr:{'aria-label':this.heading,placeholder:'写下想法，支持多行文本…'}});input.value=this.initial;
    const save=this.contentEl.createEl('button',{text:'保存',cls:'mod-cta'});save.onclick=async()=>{if(!input.value.trim())return;save.disabled=true;try{await this.save(input.value);this.close();}catch(e){new Notice(String(e));}finally{save.disabled=false;}};
    this.contentEl.createDiv({cls:'ts-muted',text:'⌘ / Ctrl + Enter 保存 · Esc 取消'});input.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();save.click();}};input.focus();}
  onClose(){this.contentEl.empty();}
}
export class EdgeModal extends Modal{
  constructor(app:App,private edge:Edge,private save:(edge:Edge)=>unknown){super(app);}
  onOpen(){this.titleEl.setText('连线样式');const draft=clone(this.edge);
    new Setting(this.contentEl).setName('关系说明').addText(t=>t.setValue(draft.label).onChange(v=>draft.label=v));
    const select=(name:string,key:'style'|'direction'|'color'|'fromSide'|'toSide',options:Record<string,string>,fallback:string)=>new Setting(this.contentEl).setName(name).addDropdown(d=>d.addOptions(options).setValue(draft[key]||fallback).onChange(v=>{if(v==='auto')delete draft[key];else Object.assign(draft,{[key]:v});}));
    select('路径','style',{curve:'平滑曲线',elbow:'直角折线',straight:'直线'},'curve');
    select('箭头','direction',{forward:'单向',both:'双向',none:'无箭头'},'forward');
    select('颜色','color',{auto:'跟随主题',...colorNames},'auto');
    const anchors={auto:'自动选择',top:'顶部',right:'右侧',bottom:'底部',left:'左侧'};select('起点','fromSide',anchors,'auto');select('终点','toSide',anchors,'auto');
    new Setting(this.contentEl).setName('虚线').addToggle(t=>t.setValue(!!draft.dashed).onChange(v=>draft.dashed=v));
    const button=this.contentEl.createEl('button',{text:'应用样式',cls:'mod-cta'});button.onclick=async()=>{try{await this.save(draft);this.close();}catch(e){new Notice(String(e));}};
  }
  onClose(){this.contentEl.empty();}
}
