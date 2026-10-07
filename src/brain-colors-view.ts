import {Modal,Setting,type App} from 'obsidian';
import {brainColor,brainColorKeys,brainContrast,cleanBrainColors,type BrainColors,type BrainColorKey} from './brain-colors';

export interface BrainColorsHost {
 document:Document;name:string;current:()=>boolean;colors:BrainColors;
 preview:(value:BrainColors|null)=>void;samples:()=>Record<BrainColorKey,string>;
 save:(value:BrainColors)=>Promise<void>;
}
const labels:Record<BrainColorKey,string>={background:'背景',node:'节点底色',border:'节点边框',text:'文字',line:'连线'};
/** One transaction per confirmation; drafts remain local to this view. */
export class BrainColorsModal extends Modal {
 private alive=false;private busy=false;private frame=0;private observer?:MutationObserver;
 constructor(app:App,private readonly host:BrainColorsHost){super(app);}
 onOpen(){
  const doc=this.host.document;if(!this.host.current()||!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;this.modalEl.addClass('ts-brain-colors-modal');
  this.contentEl.createEl('h2',{text:'脑图配色'});
  this.contentEl.createEl('p',{cls:'setting-item-description',text:`仅用于「${this.host.name}」。留空跟随主题，节点边框可单独配色。保留已有背景纹理和图片。`});
  const preview=this.contentEl.createDiv({cls:'ts-brain-colors-preview',attr:{'aria-label':'脑图配色预览'}});
  const scene=preview.createDiv('ts-brain-colors-preview-scene'),center=scene.createSpan({cls:'ts-brain-colors-preview-node is-center',text:'中心节点'}),connector=scene.createSpan({cls:'ts-brain-colors-preview-link',attr:{'aria-hidden':'true'}}),child=scene.createSpan({cls:'ts-brain-colors-preview-node',text:'关联节点'});
  preview.createSpan({cls:'ts-brain-colors-preview-caption',text:'实时预览 · 确定后保存'});
  const draft:Record<BrainColorKey,string>={background:'',node:'',border:'',text:'',line:'',...cleanBrainColors(this.host.colors)};
  const inputs=new Map<BrainColorKey,HTMLInputElement>(),pickers=new Map<BrainColorKey,HTMLInputElement>();
  const warning=this.contentEl.createDiv({cls:'ts-brain-colors-warning',attr:{role:'status','aria-live':'polite'}});
  const status=this.contentEl.createDiv({cls:'ts-brain-colors-error',attr:{role:'alert'}});
  const actions=this.contentEl.createDiv('modal-button-container'),reset=actions.createEl('button',{text:'恢复默认',attr:{type:'button'}}),cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}}),save=actions.createEl('button',{text:'确定',cls:'mod-cta',attr:{type:'button'}});
  const live=()=>this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===doc&&!doc.defaultView?.closed;
  const invalid=()=>brainColorKeys.filter(key=>draft[key].trim()&&!brainColor(draft[key]));
  const update=()=>{
   const bad=invalid();save.disabled=this.busy||!live()||!this.host.current()||!!bad.length;reset.disabled=this.busy;cancel.disabled=this.busy;
   for(const [key,input]of inputs){input.disabled=this.busy;input.setAttribute('aria-invalid',String(bad.includes(key)));pickers.get(key)!.disabled=this.busy;}
   if(bad.length){status.setText(`「${labels[bad[0]]}」请输入 #RGB 或 #RRGGBB，或留空跟随主题。`);return;}
   if(!live())return;if(!this.host.current()){status.setText('脑图或配色已变化，或写入已暂停。请检查白板保存提示并重新打开设置。');return;}status.setText('');
   this.host.preview(cleanBrainColors(draft));
   if(this.frame)doc.defaultView!.cancelAnimationFrame(this.frame);
   this.frame=doc.defaultView!.requestAnimationFrame(()=>{
    this.frame=0;if(!live()||!this.host.current())return;
    const samples=this.host.samples(),canvas=this.contentEl.createEl('canvas',{attr:{hidden:'true'}});canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
    const hex=(color:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle='#000000';ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return '#'+[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');};
    const colors={...samples};for(const key of brainColorKeys){colors[key]=brainColor(draft[key])||hex(samples[key]);if(!draft[key])pickers.get(key)!.value=colors[key];}
    canvas.remove();scene.style.backgroundColor=colors.background;connector.style.backgroundColor=colors.line;for(const node of [center,child]){node.style.backgroundColor=colors.node;node.style.borderColor=colors.border;node.style.color=colors.text;}
    // The real center keeps its theme accent until the node fill is overridden.
    // Leaving border blank must likewise retain the original center outline.
    const customNode=brainColor(draft.node),customBorder=brainColor(draft.border);center.style.backgroundColor=customNode?colors.node:'';center.style.borderColor=customBorder||customNode?colors.border:'';
    const messages:string[]=[];if(brainContrast(colors.text,colors.node)<4.5)messages.push('文字与节点底色对比偏低');if(brainContrast(colors.line,colors.background)<3)messages.push('连线与背景对比偏低');
    warning.setText(messages.length?`${messages.join('；')}，建议调整。仍可保留当前选择。`:'');
   });
  };
  for(const key of brainColorKeys){
   const row=new Setting(this.contentEl).setName(labels[key]);
   if(key==='border')row.setDesc('留空时随主题和节点底色自动调整');
   row.settingEl.dataset.brainColor=key;warning.before(row.settingEl);
   row.addColorPicker(component=>{const input=row.controlEl.querySelector<HTMLInputElement>('input[type=color]')!;input.setAttribute('aria-label',`${labels[key]}颜色选择器`);pickers.set(key,input);component.setValue(draft[key]||'#000000').onChange(value=>{draft[key]=value;inputs.get(key)!.value=value;update();});});
   row.addText(component=>{const input=component.inputEl;inputs.set(key,input);component.setPlaceholder('跟随主题').setValue(draft[key]).onChange(value=>{draft[key]=value;const color=brainColor(value);if(color)pickers.get(key)!.value=color;update();});input.setAttribute('aria-label',`${labels[key]}颜色`);input.setAttribute('spellcheck','false');input.maxLength=32;});
   row.addExtraButton(component=>component.setIcon('rotate-ccw').setTooltip(`${labels[key]}跟随主题`).onClick(()=>{if(this.busy)return;draft[key]='';inputs.get(key)!.value='';update();}));
  }
  reset.onclick=()=>{if(this.busy)return;for(const key of brainColorKeys){draft[key]='';inputs.get(key)!.value='';}update();};cancel.onclick=()=>this.close();
  save.onclick=()=>{if(save.disabled||this.busy||!live())return;if(!this.host.current()){status.setText('脑图或配色已变化，请重新打开配色设置');save.disabled=true;return;}this.busy=true;update();status.setText('正在保存…');void this.host.save(cleanBrainColors(draft)).then(()=>{if(live())this.close();}).catch(error=>{if(live())status.setText(error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;if(live()){save.disabled=!!invalid().length||!this.host.current();reset.disabled=false;cancel.disabled=false;for(const input of [...inputs.values(),...pickers.values()])input.disabled=false;}});};
  this.observer=new MutationObserver(()=>{if(!this.busy)update();});this.observer.observe(doc.body,{attributes:true,attributeFilter:['class']});
  update();inputs.get('border')!.focus();
 }
 onClose(){this.alive=false;this.observer?.disconnect();this.observer=undefined;if(this.frame)this.host.document.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;this.host.preview(null);this.contentEl.empty();}
}
