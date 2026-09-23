import {App,Modal,Notice,setIcon,Setting} from 'obsidian';
import {BoardPreferences,applyBoardMousePreset,resetBoardInputPreferences,resetBoardPagePreferences} from './board-experience';
import {themeSurface} from './ui-tokens';
export interface BoardAction{label:string;group:string;icon:string;hint?:string;disabled?:boolean;run:()=>unknown}
/** Native controls with a searchable list, keyboard navigation and explicit disabled state. */
export class BoardActionModal extends Modal{
 private readonly groups=['查找与选择','关系','导图','内容','样式与排列','视角'];
 private readonly searchIndex:{action:BoardAction;group:string;searchText:string}[];
 constructor(app:App,actions:BoardAction[]){
  super(app);
  const ranks=new Map(this.groups.map((group,index)=>[group,index]));
  this.searchIndex=actions.map(action=>{
   const group=action.group;
   if(!ranks.has(group)){ranks.set(group,this.groups.length);this.groups.push(group);}
   return{action,group,searchText:this.normalize(`${action.label} ${group} ${action.hint||''}`)};
  }).sort((a,b)=>ranks.get(a.group)!-ranks.get(b.group)!);
 }
 private normalize(text:string){return text.normalize('NFKC').toLocaleLowerCase();}
 onOpen(){
  themeSurface(this.modalEl);this.modalEl.addClass('ts-board-action-modal');this.titleEl.setText('白板操作');
  const searchRow=this.contentEl.createDiv('ts-action-search-row');
  const search=searchRow.createEl('input',{type:'search',cls:'ts-board-action-search',attr:{placeholder:'搜索操作，例如：样式、筛选、分组…','aria-label':'搜索白板操作'}});
  const available=searchRow.createEl('button',{text:'仅可用',cls:'ts-action-available',attr:{type:'button','aria-pressed':'false','aria-label':'仅显示当前可用的操作'}});
  const tabs=this.contentEl.createDiv({cls:'ts-action-tabs',attr:{'aria-label':'操作分类',role:'group'}});
  const count=this.contentEl.createDiv({cls:'ts-action-count',attr:{role:'status','aria-live':'polite','aria-atomic':'true'}});
  const list=this.contentEl.createDiv('ts-board-action-list'),footer=this.contentEl.createDiv('ts-action-footer');
  let index=-1,buttons:HTMLButtonElement[]=[],enabledActions:BoardAction[]=[],current:BoardAction|undefined,category='全部',onlyAvailable=false,executing=false;
  let currentButton:HTMLButtonElement|undefined;
  const activate=(i:number,scroll=true)=>{
   index=buttons.length?Math.max(0,Math.min(i,buttons.length-1)):-1;current=enabledActions[index];
   const next=buttons[index];
   if(currentButton!==next){
    currentButton?.toggleClass('is-current',false);currentButton?.removeAttribute('aria-current');
    next?.toggleClass('is-current',true);next?.setAttribute('aria-current','true');currentButton=next;
   }
   if(scroll)next?.scrollIntoView({block:'nearest'});
  };
  const render=()=>{
   const previous=current;list.empty();buttons=[];enabledActions=[];let group='';
   const words=this.normalize(search.value).trim().split(/\s+/).filter(Boolean);
   const matches=this.searchIndex.filter(entry=>(category==='全部'||category===entry.group)&&(!onlyAvailable||!entry.action.disabled)&&words.every(word=>entry.searchText.includes(word)));
   for(const entry of matches){
    const a=entry.action;
    if(group!==entry.group){group=entry.group;list.createDiv({cls:'ts-board-action-group',text:group});}
    const b=list.createEl('button',{attr:{type:'button','aria-label':a.label}});b.disabled=!!a.disabled;
    setIcon(b.createSpan(),a.icon);b.createSpan({text:a.label});if(a.hint)b.createEl('kbd',{text:a.hint});
    b.onclick=()=>{if(executing||a.disabled||b.disabled)return;executing=true;this.close();Promise.resolve().then(a.run).catch(e=>new Notice(String(e)));};
    if(!b.disabled){buttons.push(b);enabledActions.push(a);const i=buttons.length-1;b.onpointerenter=()=>activate(i,false);b.onfocus=()=>activate(i,false);}
   }
   if(!matches.length){
    const empty=list.createDiv('ts-action-empty');empty.createDiv({text:'没有匹配的操作'});
    const reset=empty.createEl('button',{text:'清除筛选',attr:{type:'button'}});
    reset.onclick=()=>{search.value='';category='全部';onlyAvailable=false;render();search.focus();};
   }
   count.setText(`显示 ${matches.length} 项 · ${buttons.length} 项可用`);
   footer.setText(buttons.length?'↑ ↓ 选择 · Enter 执行 · Esc 关闭':'当前没有可执行的操作 · Esc 关闭');
   tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===category)));
   available.setAttribute('aria-pressed',String(onlyAvailable));available.toggleClass('is-active',onlyAvailable);
   activate(previous?enabledActions.indexOf(previous):0,!!previous);
  };
  for(const name of ['全部',...this.groups]){const b=tabs.createEl('button',{text:name,attr:{type:'button'}});b.onclick=()=>{category=name;render();search.focus();};}
  available.onclick=()=>{onlyAvailable=!onlyAvailable;render();search.focus();};
  // Some IMEs send their final confirmation with keyCode 229 after isComposing has cleared.
  const navigationKey=(event:KeyboardEvent)=>!event.isComposing&&event.keyCode!==229&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey;
  search.oninput=render;
  search.onkeydown=e=>{
   if(!navigationKey(e)||!buttons.length)return;
   if(e.key==='Enter'){e.preventDefault();buttons[index]?.click();}
   else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();activate(index+(e.key==='ArrowDown'?1:-1));}
  };
  list.onkeydown=e=>{
   if(!navigationKey(e)||!buttons.includes(e.target as HTMLButtonElement)||(e.key!=='ArrowDown'&&e.key!=='ArrowUp'))return;
   e.preventDefault();activate(index+(e.key==='ArrowDown'?1:-1));buttons[index]?.focus({preventScroll:true});
  };
  render();search.focus();
 }
}
export function mousePreferenceControls(el:HTMLElement,settings:BoardPreferences,persist:()=>Promise<void>,openHotkeys?:()=>void){
 const heading=(text:string)=>el.createEl('h3',{cls:'ts-settings-section',text});
 const dropdown=(name:string,desc:string,key:keyof BoardPreferences,values:Record<string,string>)=>new Setting(el).setName(name).setDesc(desc).addDropdown(d=>d.addOptions(values).setValue(String(settings[key])).onChange(value=>{Object.assign(settings,{[key]:typeof settings[key]==='number'?Number(value):value});void persist().catch(e=>new Notice(String(e)));}));
 const toggle=(name:string,key:keyof BoardPreferences,desc:string)=>new Setting(el).setName(name).setDesc(desc).addToggle(t=>t.setValue(!!settings[key]).onChange(value=>{Object.assign(settings,{[key]:value});void persist().catch(e=>new Notice(String(e)));}));
 const refresh=()=>{el.empty();mousePreferenceControls(el,settings,persist,openHotkeys);};
 const presets=new Setting(el).setName('常用鼠标方案').setDesc('只调整鼠标按钮、滚轮、速度、缩放中心和防误触距离，保留键盘及其他偏好。');
 for(const [preset,label]of [['default','默认方案'],['leftSelect','左键框选'],['trackpad','触控板']] as const)presets.addButton(b=>b.setButtonText(label).onClick(()=>{applyBoardMousePreset(settings,preset);void persist().then(refresh).catch(e=>new Notice(String(e)));}));
 heading('鼠标按钮');el.createEl('p',{cls:'ts-muted',text:'三个鼠标按钮的操作分工只影响空白画布；拖动卡片、文本和其他对象仍然移动对象。'});
 const dragActions={pan:'平移画布',select:'框选对象',none:'不执行操作'};
 dropdown('左键拖动空白画布','按住 Shift + 左键临时框选；按住空格 + 左键临时平移。','leftDrag',dragActions);
 dropdown('右键拖动空白画布','只改变按住右键拖动的操作；右键单击仍打开菜单。','rightDrag',dragActions);
 dropdown('中键拖动空白画布','按住鼠标中键或滚轮拖动时使用此操作。','middleDrag',dragActions);
 dropdown('拖动防误触距离','移动超过此距离后才开始平移、移动对象或右键框选。提高可减少误拖；左键框选与调整尺寸不受影响。','dragThreshold',{'4':'4 像素 · 标准','6':'6 像素','8':'8 像素','12':'12 像素 · 更稳妥'});
 heading('滚轮与触控板');dropdown('滚轮操作','平移模式下使用 Ctrl / ⌘ + 滚轮缩放；触控板捏合保持缩放。','wheelMode',{zoom:'滚轮缩放',pan:'滚轮平移'});
 dropdown('滚轮平移速度','只影响滚轮或触控板平移，不改变按住鼠标拖动画布的距离。','panSpeed',{'0.5':'慢速 · 0.5 倍','1':'标准 · 1 倍','1.5':'快速 · 1.5 倍','2':'更快 · 2 倍'});
 toggle('反转滚轮平移方向','reverseWheelPan','反转滚轮或触控板平移的水平与垂直方向，不改变缩放方向。');
 dropdown('缩放灵敏度','改变滚轮缩放速度；缩放位置由下方“缩放中心”决定。','zoomSpeed',{'0.5':'慢速','1':'标准','1.5':'快速'});
 dropdown('缩放中心','鼠标位置便于查看指向的内容；画布中心保持当前视野中心稳定。','zoomAnchor',{pointer:'鼠标位置',center:'画布中心'});
 toggle('反转滚轮缩放方向','reverseWheelZoom','交换滚轮向上与向下的缩放方向，不改变平移方向。');
 heading('键盘');toggle('启用白板快捷按键','boardQuickKeys','控制未编辑文字时的 F、Shift + F、F2 和普通白板 Enter 快捷操作。思维导图的 Tab / Enter、Esc、空格及自行绑定的命令快捷键不受影响。');
 toggle('方向键移动对象','arrowNudge','允许方向键微调普通白板对象的位置；关闭后仍可用方向键在思维导图主题之间导航。');
 dropdown('方向键步长','启用方向键移动对象时，每次移动的距离。','nudgeStep',{'1':'1 像素','2':'2 像素','5':'5 像素','10':'10 像素'});
 dropdown('快速移动步长','Shift + 方向键每次移动的距离。','fastNudge',{'10':'10 像素','20':'20 像素','50':'50 像素','100':'100 像素'});
 toggle('删除键移除对象','deleteKeys','允许未编辑文字时按 Delete / Backspace 移除选中对象；关闭后仍可通过菜单或自行绑定的命令删除。');
 const hotkeys=new Setting(el).setName('自定义白板快捷键').setDesc('在 Obsidian 的“快捷键”设置中搜索本插件名称，可绑定新建、撤销、复制、删除、主题、搜索、整理、阅读和视角操作。新命令不会占用默认快捷键。');
 if(openHotkeys)hotkeys.addButton(b=>b.setButtonText('打开快捷键设置').onClick(openHotkeys));
 new Setting(el).setName('恢复鼠标与键盘默认值').setDesc('只恢复本页的鼠标、滚轮和快捷按键设置，保留白板内容及其他偏好。').addButton(b=>b.setButtonText('恢复默认').onClick(()=>{resetBoardInputPreferences(settings);void persist().then(refresh).catch(e=>new Notice(String(e)));}));
}
export function boardPreferenceControls(el:HTMLElement,settings:BoardPreferences,persist:()=>Promise<void>,options:{includeMouse?:boolean}={}){
 const heading=(text:string)=>el.createEl('h3',{cls:'ts-settings-section',text});
 const dropdown=(name:string,desc:string,key:keyof BoardPreferences,values:Record<string,string>)=>new Setting(el).setName(name).setDesc(desc).addDropdown(d=>d.addOptions(values).setValue(String(settings[key])).onChange(value=>{Object.assign(settings,{[key]:typeof settings[key]==='number'?Number(value):value});void persist().catch(e=>new Notice(String(e)));}));
 const toggle=(name:string,key:keyof BoardPreferences,desc:string)=>new Setting(el).setName(name).setDesc(desc).addToggle(t=>t.setValue(!!settings[key]).onChange(value=>{Object.assign(settings,{[key]:value});void persist().catch(e=>new Notice(String(e)));}));
 heading('操作与导航');dropdown('顶部工具栏密度','紧凑模式缩小图标间距，格式工具仍与新建卡片保持一行。','toolbarDensity',{compact:'紧凑 · 32 px',comfortable:'舒适 · 38 px'});
 if(options.includeMouse!==false){dropdown('滚轮操作','平移模式下使用 Ctrl / ⌘ + 滚轮缩放；触控板捏合保持缩放。','wheelMode',{zoom:'滚轮缩放',pan:'滚轮平移'});dropdown('缩放灵敏度','改变滚轮缩放速度。','zoomSpeed',{'0.5':'慢速','1':'标准','1.5':'快速'});}
 dropdown('网格间距','同时用于画布参照线和开启吸附后的拖动落点。','gridStep',{'8':'8 px','16':'16 px','24':'24 px','32':'32 px','48':'48 px','64':'64 px'});
 if(options.includeMouse!==false){dropdown('方向键步长','直接按方向键移动选中对象。','nudgeStep',{'1':'1 px','2':'2 px','5':'5 px','10':'10 px'});dropdown('快速移动步长','Shift + 方向键移动。','fastNudge',{'10':'10 px','20':'20 px','50':'50 px','100':'100 px'});}
 toggle('拖动对齐辅助线','alignmentGuides','拖动时吸附附近对象的边缘与中心；按住 Alt 临时自由移动。');
 toggle('Shift 拖动锁定方向','axisLock','拖动开始后按住 Shift，沿水平或垂直方向移动。');toggle('Shift 缩放保持比例','aspectLock','调整对象尺寸时按住 Shift，保持原宽高比。');
 heading('新对象默认值');dropdown('新卡片宽度','只影响新引用的卡片；自动适配时作为最小宽度，不改动已有卡片。','defaultCardWidth',{'240':'240 px','300':'300 px','360':'360 px','420':'420 px','520':'520 px'});dropdown('新文本字号','只影响之后添加的文本框。','defaultTextSize',{'12':'12','14':'14','16':'16','20':'20','24':'24','32':'32'});
 dropdown('新连线路径','只影响之后创建的普通连线。','defaultEdgeStyle',{curve:'平滑曲线',straight:'直线',elbow:'直角折线'});dropdown('新连线箭头','思维导图分支继续使用原有规则。','defaultEdgeDirection',{forward:'单向',both:'双向',none:'无箭头'});
 heading('显示与性能');dropdown('详细预览数量','超过数量的可见卡片显示轻量标题；选中对象优先。','previewLimit',{'20':'20 张','50':'50 张','100':'100 张','160':'160 张'});dropdown('详细预览缩放阈值','小于此比例时显示标题，减轻缩略状态的渲染负担。','detailZoom',{'0.25':'25%','0.45':'45%','0.65':'65%','0.85':'85%'});
 toggle('显示卡片标签','showCardTags','隐藏卡片底部标签，不删除笔记标签。');toggle('显示连线端点','showPorts','关闭悬浮 + 端点后，仍可使用顶部连线工具。');toggle('显示白板操作提示','showBoardHints','控制底部快捷键提示文字。');
 new Setting(el).setName('恢复白板偏好默认值').setDesc('只恢复本页选项，保留白板内容、文件目录和外观主题。').addButton(b=>b.setButtonText('恢复默认').onClick(()=>{
  resetBoardPagePreferences(settings,options.includeMouse!==false);
  void persist().then(()=>{el.empty();boardPreferenceControls(el,settings,persist,options);}).catch(e=>new Notice(String(e)));
 }));
}
