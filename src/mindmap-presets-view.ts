import {createTopicPreviewLabel} from './mindmap-preview-label';
import {fitTextNode} from './text-tools';
import {App,Modal} from 'obsidian';
import {Board} from './model';
import {MindmapLayout} from './mindmap';
import {mindmapLayouts,mindmapPlan} from './mindmap-studio';
import {mindmapPresets,presetMindmap} from './mindmap-presets';
import {topicSvg} from './mindmap-content';
import {themeSurface} from './ui-tokens';
export function renderPresetGallery(host:HTMLElement,action:string,apply:(board:Board)=>Promise<void>|void){
 const gallery=host.createDiv('ts-mm-presets'),grid=gallery.createDiv('ts-mm-preset-grid'),detail=gallery.createDiv('ts-mm-preset-detail');
 let selected:string=mindmapPresets[0].id,previousName:string=mindmapPresets[0].name,current:Board|undefined,busy=false;
 const title=detail.createEl('input',{attr:{'aria-label':'模板中心主题',maxlength:'200'}});title.value=previousName;
 const layout=detail.createEl('select',{attr:{'aria-label':'模板布局'}});for(const [value,text]of Object.entries(mindmapLayouts))layout.createEl('option',{value,text});layout.value=mindmapPresets[0].layout;
 const preview=detail.createDiv('ts-mm-preset-preview'),status=detail.createEl('p',{cls:'ts-mm-preset-status',attr:{role:'status'}}),confirm=detail.createEl('button',{text:action,cls:'mod-cta'});
 const draw=()=>{try{current=presetMindmap(selected,title.value,undefined,n=>fitTextNode(n,host));current=mindmapPlan(current,current.nodes[0].id,{layout:layout.value as MindmapLayout,density:'standard',depth:'all',rainbow:true}).board;preview.empty();const svg=new DOMParser().parseFromString(topicSvg(current,current.nodes[0].id),'image/svg+xml').documentElement;const scene=host.ownerDocument.importNode(svg,true) as unknown as SVGSVGElement;scene.querySelectorAll('text').forEach(el=>el.remove());for(const n of current.nodes)createTopicPreviewLabel(scene,n);preview.append(scene);status.setText(`${current.nodes.length} 个主题 · ${mindmapLayouts[layout.value as MindmapLayout]} · 自动尺寸与排版`);confirm.disabled=false;}catch(e){current=undefined;status.setText(String(e));confirm.disabled=true;}};
 for(const preset of mindmapPresets){const button=grid.createEl('button',{cls:'ts-mm-preset-card',attr:{'aria-pressed':String(preset.id===selected),'data-preset':preset.id}});button.createEl('small',{text:preset.category});button.createEl('strong',{text:preset.name});button.createSpan({text:preset.description});button.onclick=()=>{if(busy)return;if(title.value===previousName||!title.value.trim())title.value=preset.name;previousName=preset.name;selected=preset.id;layout.value=preset.layout;grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));draw();};}
 title.oninput=draw;layout.onchange=draw;
 confirm.onclick=async()=>{if(busy||!current)return;busy=true;const board=current;gallery.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select').forEach(el=>el.disabled=true);status.setText('正在创建…');try{await apply(board);}catch(e){if(host.isConnected){status.setText(String(e));gallery.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select').forEach(el=>el.disabled=false);}}finally{busy=false;}};draw();return gallery;
}
export class MindmapPresetsModal extends Modal{
 constructor(app:App,private create:(board:Board)=>Promise<void>){super(app);}
 onOpen(){themeSurface(this.modalEl);this.modalEl.addClass('ts-mindmap-presets-modal');this.titleEl.setText('从一个好结构开始');this.contentEl.createEl('p',{text:'选择结构即可开始。节点按文字自动伸展，分支随编辑保持整齐。',cls:'ts-mm-intro'});renderPresetGallery(this.contentEl,'创建思维导图',async board=>{await this.create(board);this.close();});}
 onClose(){this.contentEl.empty();}
}
