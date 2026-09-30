import {App,Modal,Notice,setIcon,Setting} from 'obsidian';
import {BoardPreferences,applyBoardMousePreset,defaultBoardPreferences,resetBoardInputPreferences,resetBoardPagePreferences} from './board-experience';
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
type PreferenceControlOptions={language?:'zh-CN'|'en';hideReset?:boolean};
function preferenceControls(el:HTMLElement,settings:BoardPreferences,persist:()=>Promise<void>,options:PreferenceControlOptions){
 const t=(zh:string,en:string)=>options.language==='en'?en:zh;
 const failed=(error:unknown)=>new Notice(`${t('保存设置失败','Could not save preferences')}: ${String(error)}`);
 const keys=new Set<keyof BoardPreferences>();
 const heading=(text:string)=>el.createEl('h3',{cls:'ts-settings-section',text});
 const dropdown=(name:string,desc:string,key:keyof BoardPreferences,values:Record<string,string>)=>{
  keys.add(key);
  const current=String(settings[key]);
  // Cleaned preferences may contain a valid value between the offered presets.
  const choices=typeof settings[key]==='number'&&!(current in values)?{...values,[current]:t(`当前值 · ${current}`,`Current: ${current}`)}:values;
  const row=new Setting(el).setName(name).setDesc(desc);row.settingEl.dataset.settingKey=key;
  return row.addDropdown(d=>d.addOptions(choices).setValue(current).onChange(value=>{Object.assign(settings,{[key]:typeof settings[key]==='number'?Number(value):value});void persist().catch(failed);}));
 };
 const toggle=(name:string,key:keyof BoardPreferences,desc:string)=>{
  keys.add(key);
  const row=new Setting(el).setName(name).setDesc(desc);row.settingEl.dataset.settingKey=key;
  return row.addToggle(control=>control.setValue(!!settings[key]).onChange(value=>{Object.assign(settings,{[key]:value});void persist().catch(failed);}));
 };
 return{t,failed,keys,heading,dropdown,toggle};
}
export function mousePreferenceControls(el:HTMLElement,settings:BoardPreferences,persist:()=>Promise<void>,openHotkeys?:()=>void,options:PreferenceControlOptions={}){
 const {t,failed,heading,dropdown,toggle}=preferenceControls(el,settings,persist,options);
 const refresh=()=>{el.empty();mousePreferenceControls(el,settings,persist,openHotkeys,options);};
 const presets=new Setting(el).setName(t('常用鼠标方案','Mouse presets')).setDesc(t('只调整鼠标按钮、滚轮、速度、缩放中心和防误触距离，保留键盘及其他偏好。','Adjust mouse buttons, scrolling, speed, zoom anchor and drag threshold. Keyboard and other preferences are preserved.'));
 for(const [preset,zh,en]of [['default','默认方案','Default'],['leftSelect','左键框选','Left-drag selection'],['trackpad','触控板','Trackpad']] as const)presets.addButton(button=>button.setButtonText(t(zh,en)).onClick(()=>{applyBoardMousePreset(settings,preset);void persist().then(refresh).catch(failed);}));
 heading(t('鼠标按钮','Mouse buttons'));
 el.createEl('p',{cls:'ts-muted',text:t('三个鼠标按钮的操作分工只影响空白画布；拖动卡片、文本和其他对象仍然移动对象。','These actions apply to empty canvas areas. Dragging a card, text or another object still moves that object.')});
 const dragActions={pan:t('平移画布','Pan canvas'),select:t('框选对象','Select objects'),none:t('不执行操作','No action')};
 dropdown(t('左键拖动空白画布','Left-drag on empty canvas'),t('按住 Shift + 左键临时框选；按住空格 + 左键临时平移。','Hold Shift to temporarily select, or Space to temporarily pan.'),'leftDrag',dragActions);
 dropdown(t('右键拖动空白画布','Right-drag on empty canvas'),t('只改变按住右键拖动的操作；右键单击仍打开菜单。','Only changes the drag action. A right click still opens the context menu.'),'rightDrag',dragActions);
 dropdown(t('中键拖动空白画布','Middle-drag on empty canvas'),t('按住鼠标中键或滚轮拖动时使用此操作。','Action when dragging with the middle mouse button or scroll wheel pressed.'),'middleDrag',dragActions);
 dropdown(t('拖动防误触距离','Drag threshold'),t('移动超过此距离后才开始平移、移动对象或右键框选。提高可减少误拖；左键框选与调整尺寸不受影响。','Minimum movement before panning, moving objects or right-drag selection. Left-drag selection and resizing are unaffected.'),'dragThreshold',{'4':t('4 像素 · 标准','4 px · Standard'),'6':'6 px','8':'8 px','12':t('12 像素 · 更稳妥','12 px · Deliberate')});
 heading(t('滚轮与触控板','Scroll wheel and trackpad'));
 dropdown(t('滚轮操作','Scroll action'),t('平移模式下使用 Ctrl / ⌘ + 滚轮缩放；触控板捏合保持缩放。','In pan mode, Ctrl / Cmd + scroll zooms. Trackpad pinch always zooms.'),'wheelMode',{zoom:t('滚轮缩放','Zoom'),pan:t('滚轮平移','Pan')});
 dropdown(t('滚轮平移速度','Scroll pan speed'),t('只影响滚轮或触控板平移，不改变按住鼠标拖动画布的距离。','Applies to scrolling and trackpad panning, not mouse-drag distance.'),'panSpeed',{'0.5':t('慢速 · 0.5 倍','Slow · 0.5x'),'1':t('标准 · 1 倍','Standard · 1x'),'1.5':t('快速 · 1.5 倍','Fast · 1.5x'),'2':t('更快 · 2 倍','Faster · 2x')});
 toggle(t('反转滚轮平移方向','Reverse scroll pan'),'reverseWheelPan',t('反转滚轮或触控板平移的水平与垂直方向，不改变缩放方向。','Reverse horizontal and vertical scrolling without changing zoom direction.'));
 dropdown(t('缩放灵敏度','Zoom sensitivity'),t('改变滚轮缩放速度；缩放位置由下方“缩放中心”决定。','Scroll zoom speed. The zoom anchor controls where zooming is centered.'),'zoomSpeed',{'0.5':t('慢速','Slow'),'1':t('标准','Standard'),'1.5':t('快速','Fast')});
 dropdown(t('缩放中心','Zoom anchor'),t('鼠标位置便于查看指向的内容；画布中心保持当前视野中心稳定。','Use the pointer to focus on pointed content, or the canvas center to keep the view centered.'),'zoomAnchor',{pointer:t('鼠标位置','Pointer'),center:t('画布中心','Canvas center')});
 toggle(t('反转滚轮缩放方向','Reverse scroll zoom'),'reverseWheelZoom',t('交换滚轮向上与向下的缩放方向，不改变平移方向。','Reverse scroll zoom direction without changing pan direction.'));
 heading(t('键盘','Keyboard'));
 toggle(t('启用白板快捷按键','Board quick keys'),'boardQuickKeys',t('控制未编辑文字时的 F、Shift + F、F2 和普通白板 Enter 快捷操作。思维导图的 Tab / Enter、Esc、空格及自行绑定的命令快捷键不受影响。','Enable F, Shift + F, F2 and regular-board Enter outside text editing. Mind map Tab / Enter, Esc, Space and custom command hotkeys are unaffected.'));
 toggle(t('方向键移动对象','Arrow keys move objects'),'arrowNudge',t('允许方向键微调普通白板对象的位置；关闭后仍可用方向键在思维导图主题之间导航。','Nudge regular-board objects with arrow keys. Mind map keyboard navigation remains available when disabled.'));
 dropdown(t('方向键步长','Arrow-key step'),t('启用方向键移动对象时，每次移动的距离。','Distance per arrow-key press when object nudging is enabled.'),'nudgeStep',{'1':'1 px','2':'2 px','5':'5 px','10':'10 px'});
 dropdown(t('快速移动步长','Fast arrow-key step'),t('Shift + 方向键每次移动的距离。','Distance per Shift + arrow-key press.'),'fastNudge',{'10':'10 px','20':'20 px','50':'50 px','100':'100 px'});
 toggle(t('删除键移除对象','Delete keys remove objects'),'deleteKeys',t('允许未编辑文字时按 Delete / Backspace 移除选中对象；关闭后仍可通过菜单或自行绑定的命令删除。','Allow Delete / Backspace to remove selected objects outside text editing. Menus and custom delete commands remain available.'));
 const hotkeys=new Setting(el).setName(t('自定义白板快捷键','Custom board hotkeys')).setDesc(t('在 Obsidian 的“快捷键”设置中搜索本插件名称，可绑定新建、撤销、复制、删除、主题、搜索、整理、阅读和视角操作。新命令不会占用默认快捷键。','Configure ThoughtSpace commands in Obsidian hotkey settings. New commands have no default key bindings.'));
 if(openHotkeys)hotkeys.addButton(button=>button.setButtonText(t('打开快捷键设置','Open hotkey settings')).onClick(openHotkeys));
 if(!options.hideReset)new Setting(el).setName(t('恢复鼠标与键盘默认值','Reset mouse and keyboard')).setDesc(t('只恢复本页的鼠标、滚轮和快捷按键设置，保留白板内容及其他偏好。','Restore only mouse, scroll and keyboard preferences. Board content and other preferences are preserved.')).addButton(button=>button.setButtonText(t('恢复默认','Restore defaults')).onClick(()=>{resetBoardInputPreferences(settings);void persist().then(refresh).catch(failed);}));
}
export function boardPreferenceControls(el:HTMLElement,settings:BoardPreferences,persist:()=>Promise<void>,options:PreferenceControlOptions&{includeMouse?:boolean;section?:'board'|'cards'}={}){
 const {t,failed,keys,heading,dropdown,toggle}=preferenceControls(el,settings,persist,options);
 if(options.section!=='cards'){
  heading(t('操作与导航','Navigation and alignment'));
  dropdown(t('顶部工具栏密度','Toolbar density'),t('调整顶部悬浮编辑栏的控件高度与间距；创建工具保留在侧边。','Height and spacing of the floating toolbar. Creation tools remain at the side.'),'toolbarDensity',{compact:t('紧凑 · 32 px','Compact · 32 px'),comfortable:t('舒适 · 38 px','Comfortable · 38 px')});
  if(options.includeMouse!==false){
   dropdown(t('滚轮操作','Scroll action'),t('平移模式下使用 Ctrl / ⌘ + 滚轮缩放；触控板捏合保持缩放。','In pan mode, Ctrl / Cmd + scroll zooms. Trackpad pinch always zooms.'),'wheelMode',{zoom:t('滚轮缩放','Zoom'),pan:t('滚轮平移','Pan')});
   dropdown(t('缩放灵敏度','Zoom sensitivity'),t('改变滚轮缩放速度。','Scroll zoom speed.'),'zoomSpeed',{'0.5':t('慢速','Slow'),'1':t('标准','Standard'),'1.5':t('快速','Fast')});
  }
  dropdown(t('网格间距','Grid spacing'),t('同时用于画布参照线和开启吸附后的拖动落点。','Spacing for canvas grid lines and snap-to-grid positions.'),'gridStep',{'8':'8 px','16':'16 px','24':'24 px','32':'32 px','48':'48 px','64':'64 px'});
  if(options.includeMouse!==false){
   dropdown(t('方向键步长','Arrow-key step'),t('直接按方向键移动选中对象。','Distance per arrow-key press for selected objects.'),'nudgeStep',{'1':'1 px','2':'2 px','5':'5 px','10':'10 px'});
   dropdown(t('快速移动步长','Fast arrow-key step'),t('Shift + 方向键移动。','Distance per Shift + arrow-key press.'),'fastNudge',{'10':'10 px','20':'20 px','50':'50 px','100':'100 px'});
  }
  toggle(t('拖动对齐辅助线','Alignment guides'),'alignmentGuides',t('拖动时吸附附近对象的边缘与中心；按住 Alt 临时自由移动。','Snap to nearby object edges and centers. Hold Alt for free movement.'));
  toggle(t('Shift 拖动锁定方向','Shift-drag axis lock'),'axisLock',t('拖动开始后按住 Shift，沿水平或垂直方向移动。','Hold Shift after starting a drag to lock movement horizontally or vertically.'));
  toggle(t('Shift 缩放保持比例','Shift-resize aspect lock'),'aspectLock',t('调整对象尺寸时按住 Shift，保持原宽高比。','Hold Shift while resizing to preserve the original aspect ratio.'));
 }
 if(options.section!=='board'){
  heading(t('新对象默认值','New object defaults'));
  dropdown(t('新卡片宽度','New card width'),t('只影响新引用的卡片；自动适配时作为最小宽度，不改动已有卡片。','Applies to newly referenced cards and sets their minimum auto-fit width. Existing cards are unchanged.'),'defaultCardWidth',{'240':'240 px','300':'300 px','360':'360 px','420':'420 px','520':'520 px'});
  dropdown(t('新文本字号','New text size'),t('只影响之后添加的文本框。','Applies only to text boxes created afterward.'),'defaultTextSize',{'12':'12','14':'14','16':'16','20':'20','24':'24','32':'32'});
  dropdown(t('新连线路径','New connection path'),t('只影响之后创建的普通连线。','Applies only to regular connections created afterward.'),'defaultEdgeStyle',{curve:t('平滑曲线','Curve'),straight:t('直线','Straight'),elbow:t('直角折线','Elbow')});
  dropdown(t('新连线箭头','New connection arrows'),t('思维导图分支继续使用原有规则。','Mind map branches keep their existing arrow rules.'),'defaultEdgeDirection',{forward:t('单向','One-way'),both:t('双向','Both ends'),none:t('无箭头','None')});
 }
 if(options.section!=='cards'){
  heading(t('显示与性能','Display and performance'));
  dropdown(t('详细预览数量','Detailed preview limit'),t('超过数量的可见卡片显示轻量标题；选中对象优先。','Visible cards beyond this limit show lightweight titles. Selected objects take priority.'),'previewLimit',{'20':t('20 张','20 cards'),'50':t('50 张','50 cards'),'100':t('100 张','100 cards'),'160':t('160 张','160 cards')});
  dropdown(t('详细预览缩放阈值','Detailed preview zoom threshold'),t('小于此比例时显示标题，减轻缩略状态的渲染负担。','Show titles below this zoom level to reduce rendering work while zoomed out.'),'detailZoom',{'0.25':'25%','0.45':'45%','0.65':'65%','0.85':'85%'});
  toggle(t('显示卡片标签','Show card tags'),'showCardTags',t('隐藏卡片底部标签，不删除笔记标签。','Show tags at the bottom of cards. Hiding them does not delete note tags.'));
  toggle(t('显示连线端点','Show connection ports'),'showPorts',t('关闭悬浮 + 端点后，仍可使用侧边连线工具。','Show connection ports on hover. The side connection tool remains available when hidden.'));
  toggle(t('显示白板操作提示','Show board hints'),'showBoardHints',t('控制底部快捷键提示文字。','Show keyboard hints at the bottom of the board.'));
 }
 if(!options.hideReset)new Setting(el).setName(options.section==='cards'?t('恢复新对象默认值','Reset new object defaults'):t('恢复白板偏好默认值','Reset board preferences')).setDesc(t('只恢复本页选项，保留白板内容、文件目录和外观主题。','Restore this page only. Board content, file folders and appearance are preserved.')).addButton(button=>button.setButtonText(t('恢复默认','Restore defaults')).onClick(()=>{
  if(options.section){for(const key of keys)Object.assign(settings,{[key]:defaultBoardPreferences[key]});}
  else resetBoardPagePreferences(settings,options.includeMouse!==false);
  void persist().then(()=>{el.empty();boardPreferenceControls(el,settings,persist,options);}).catch(failed);
 }));
}
