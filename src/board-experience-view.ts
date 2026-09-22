import {App,Modal,Notice,setIcon,Setting} from 'obsidian';
import {BoardPreferences,defaultBoardPreferences} from './board-experience';
import {themeSurface} from './ui-tokens';
export interface BoardAction{label:string;group:string;icon:string;hint?:string;disabled?:boolean;run:()=>unknown}
/** Native controls with a searchable list, keyboard navigation and explicit disabled state. */
export class BoardActionModal extends Modal{
 constructor(app:App,private actions:BoardAction[]){super(app);}
 onOpen(){
  themeSurface(this.modalEl);this.modalEl.addClass('ts-board-action-modal');this.titleEl.setText('白板操作');
  const search=this.contentEl.createEl('input',{type:'search',cls:'ts-board-action-search',attr:{placeholder:'搜索操作，例如：样式、筛选、分组…','aria-label':'搜索白板操作'}});
  const tabs=this.contentEl.createDiv({cls:'ts-action-tabs',attr:{'aria-label':'操作分类',role:'group'}}),list=this.contentEl.createDiv('ts-board-action-list'),footer=this.contentEl.createDiv('ts-action-footer');
  let index=0,buttons:HTMLButtonElement[]=[],category='全部';const groups=['查找与选择','关系','导图','内容','样式与排列','视角'];
  const activate=(i:number,scroll=true)=>{index=Math.max(0,Math.min(i,buttons.length-1));buttons.forEach((b,j)=>b.toggleClass('is-current',j===index));if(scroll)buttons[index]?.scrollIntoView({block:'nearest'});};
  const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase();
  const render=()=>{list.empty();buttons=[];let group='';const words=normalize(search.value).trim().split(/\s+/).filter(Boolean);const matches=this.actions.filter(a=>(category==='全部'||category===a.group)&&words.every(w=>normalize(`${a.label} ${a.group} ${a.hint||''}`).includes(w))).sort((a,b)=>groups.indexOf(a.group)-groups.indexOf(b.group));
   for(const a of matches){if(group!==a.group){group=a.group;list.createDiv({cls:'ts-board-action-group',text:group});}const b=list.createEl('button',{attr:{'aria-label':a.label}});b.disabled=!!a.disabled;setIcon(b.createSpan(),a.icon);b.createSpan({text:a.label});if(a.hint)b.createEl('kbd',{text:a.hint});b.onclick=()=>{this.close();Promise.resolve().then(a.run).catch(e=>new Notice(String(e)));};if(!b.disabled){buttons.push(b);const i=buttons.length-1;b.onpointerenter=()=>activate(i,false);}}
   if(!matches.length){const empty=list.createDiv('ts-action-empty');empty.createDiv({text:'没有匹配的操作'});const reset=empty.createEl('button',{text:'清除搜索和分类'});reset.onclick=()=>{search.value='';category='全部';render();search.focus();};}
   footer.setText(`${matches.length} 项操作 · ↑ ↓ 选择 · Enter 执行 · Esc 关闭`);tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===category)));activate(0);
  };
  for(const name of ['全部',...groups]){const b=tabs.createEl('button',{text:name});b.onclick=()=>{category=name;render();search.focus();};}
  search.oninput=render;search.onkeydown=e=>{if(['ArrowDown','ArrowUp','Enter','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Enter')buttons[index]?.click();else activate(e.key==='Home'?0:e.key==='End'?buttons.length-1:index+(e.key==='ArrowDown'?1:-1));}};render();search.focus();
 }
}
export function boardPreferenceControls(el:HTMLElement,settings:BoardPreferences,persist:()=>Promise<void>){
 const heading=(text:string)=>el.createEl('h3',{cls:'ts-settings-section',text});
 const dropdown=(name:string,desc:string,key:keyof BoardPreferences,values:Record<string,string>)=>new Setting(el).setName(name).setDesc(desc).addDropdown(d=>d.addOptions(values).setValue(String(settings[key])).onChange(value=>{Object.assign(settings,{[key]:typeof settings[key]==='number'?Number(value):value});void persist().catch(e=>new Notice(String(e)));}));
 const toggle=(name:string,key:keyof BoardPreferences,desc:string)=>new Setting(el).setName(name).setDesc(desc).addToggle(t=>t.setValue(!!settings[key]).onChange(value=>{Object.assign(settings,{[key]:value});void persist().catch(e=>new Notice(String(e)));}));
 heading('操作与导航');dropdown('顶部工具栏密度','紧凑模式缩小图标间距，格式工具仍与新建卡片保持一行。','toolbarDensity',{compact:'紧凑 · 32 px',comfortable:'舒适 · 38 px'});
 dropdown('滚轮操作','平移模式下使用 Ctrl / ⌘ + 滚轮缩放；触控板捏合保持缩放。','wheelMode',{zoom:'滚轮缩放',pan:'滚轮平移'});dropdown('缩放灵敏度','改变滚轮缩放速度，缩放中心保持在鼠标位置。','zoomSpeed',{'0.5':'慢速','1':'标准','1.5':'快速'});
 dropdown('网格间距','同时用于画布参照线和开启吸附后的拖动落点。','gridStep',{'8':'8 px','16':'16 px','24':'24 px','32':'32 px','48':'48 px','64':'64 px'});
 dropdown('方向键步长','直接按方向键移动选中对象。','nudgeStep',{'1':'1 px','2':'2 px','5':'5 px','10':'10 px'});dropdown('快速移动步长','Shift + 方向键移动。','fastNudge',{'10':'10 px','20':'20 px','50':'50 px','100':'100 px'});
 toggle('拖动对齐辅助线','alignmentGuides','拖动时吸附附近对象的边缘与中心；按住 Alt 临时自由移动。');
 toggle('Shift 拖动锁定方向','axisLock','拖动开始后按住 Shift，沿水平或垂直方向移动。');toggle('Shift 缩放保持比例','aspectLock','调整对象尺寸时按住 Shift，保持原宽高比。');
 heading('新对象默认值');dropdown('新卡片宽度','只影响新引用的卡片；自动适配时作为最小宽度，不改动已有卡片。','defaultCardWidth',{'240':'240 px','300':'300 px','360':'360 px','420':'420 px','520':'520 px'});dropdown('新文本字号','只影响之后添加的文本框。','defaultTextSize',{'12':'12','14':'14','16':'16','20':'20','24':'24','32':'32'});
 dropdown('新连线路径','只影响之后创建的普通连线。','defaultEdgeStyle',{curve:'平滑曲线',straight:'直线',elbow:'直角折线'});dropdown('新连线箭头','思维导图分支继续使用原有规则。','defaultEdgeDirection',{forward:'单向',both:'双向',none:'无箭头'});
 heading('显示与性能');dropdown('详细预览数量','超过数量的可见卡片显示轻量标题；选中对象优先。','previewLimit',{'20':'20 张','50':'50 张','100':'100 张','160':'160 张'});dropdown('详细预览缩放阈值','小于此比例时显示标题，减轻缩略状态的渲染负担。','detailZoom',{'0.25':'25%','0.45':'45%','0.65':'65%','0.85':'85%'});
 toggle('显示卡片标签','showCardTags','隐藏卡片底部标签，不删除笔记标签。');toggle('显示连线端点','showPorts','关闭悬浮 + 端点后，仍可使用顶部连线工具。');toggle('显示白板操作提示','showBoardHints','控制底部快捷键提示文字。');
 new Setting(el).setName('恢复白板偏好默认值').setDesc('只恢复本页选项，保留白板内容、文件目录和外观主题。').addButton(b=>b.setButtonText('恢复默认').onClick(()=>{Object.assign(settings,defaultBoardPreferences);void persist().then(()=>{el.empty();boardPreferenceControls(el,settings,persist);}).catch(e=>new Notice(String(e)));}));
}
