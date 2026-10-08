import {App,Modal,Notice,Plugin,PluginSettingTab,Setting,getLanguage,setIcon} from 'obsidian';
import type {ThoughtSpacePreferences} from './plugin-settings';
import {boardPreferenceControls,mousePreferenceControls} from './board-experience-view';
import {resolveSettingsLanguage,settingsCategoryDefaults,exportSettingsProfile,parseSettingsProfile,type SettingsCategory,type SettingsLanguage} from './settings-preferences';
import {hostSettings} from './host-capabilities';
import {imageHostApi} from './image-host';
import {validateFolders} from './filing';
import {themeSurface} from './ui-tokens';

type Page=SettingsCategory|'filing'|'images'|'profiles';
type Pair=readonly [string,string];
const pages:readonly {id:Page;label:Pair;icon:string}[]=[
 {id:'general',label:['界面','Interface'],icon:'palette'},
 {id:'cards',label:['卡片与笔记','Cards & notes'],icon:'sticky-note'},
 {id:'board',label:['白板','Canvas'],icon:'layout-dashboard'},
 {id:'input',label:['鼠标与键盘','Mouse & keyboard'],icon:'mouse'},
 {id:'reading',label:['阅读','Reading'],icon:'book-open'},
 {id:'filing',label:['文件与归档','Files & filing'],icon:'folders'},
 {id:'images',label:['图片与图床','Images & hosting'],icon:'image'},
 {id:'profiles',label:['偏好配置','Preference profiles'],icon:'settings-2'}
];
export interface SettingsHost extends Plugin {
 settings:ThoughtSpacePreferences;
 journalRoot:string;
 savePreferences:()=>Promise<void>;
 rebuildBoardSearch:()=>void;
 noteToolbar?:{refresh:()=>void};
 openPaperSettings:()=>Modal;
 openBackgroundImageSettings:()=>Modal;
 fileAllCards:()=>Promise<unknown>;
 fileOldJournals:()=>Promise<unknown>;
}
export const settingsLanguage=(settings:ThoughtSpacePreferences)=>resolveSettingsLanguage(settings.settingsLanguage,getLanguage());

class SettingsConfirm extends Modal {
 private closed=false;
 constructor(app:App,private label:string,private detail:string,private confirmLabel:string,private language:SettingsLanguage,private apply:()=>Promise<void>){super(app);}
 onOpen(){
  this.closed=false;
  themeSurface(this.modalEl);this.titleEl.setText(this.label);
  this.contentEl.createEl('p',{text:this.detail});
  const status=this.contentEl.createDiv({attr:{role:'status'}});
  const row=new Setting(this.contentEl);
  row.addButton(b=>b.setButtonText(this.language==='en'?'Cancel':'取消').onClick(()=>this.close()));
  row.addButton(b=>b.setButtonText(this.confirmLabel).setCta().onClick(async()=>{
   if(this.closed)return;b.setDisabled(true);try{await this.apply();if(!this.closed)this.close();}catch{if(this.closed)return;status.setText(this.language==='en'?'Operation failed. Check the result before retrying.':'操作失败，请检查结果后重试。');b.setDisabled(false);}
  }));
 }
 onClose(){this.closed=true;this.contentEl.empty();}
}

/** The same settings surface is shared by Obsidian preferences and the workspace dialog. */
export class ThoughtSpaceSettings extends PluginSettingTab {
 private page:Page='general';private query='';private folderDraft?:string;
 private language:SettingsLanguage='zh-CN';private status?:HTMLElement;
 private panels=new Map<Page,HTMLElement>();private navigation=new Map<Page,HTMLButtonElement>();
 private searchCount?:HTMLElement;private searchInput?:HTMLInputElement;
 private saveTail:Promise<void>=Promise.resolve();
 private pendingWrites=0;private refreshAfterSave=false;
 constructor(app:App,private host:SettingsHost){super(app,host);}
 private t(pair:Pair){return pair[this.language==='en'?1:0];}
 private report(error:unknown){console.error('[ThoughtSpace settings]',error);const message=this.t(['设置未能保存，请重试。','Settings could not be saved. Please try again.']);this.status?.setText(message);new Notice(message);}
 private async persist(){
  this.status?.setText(this.t(['正在保存…','Saving…']));
  try{await this.host.savePreferences();this.status?.setText(this.t(['已保存','Saved']));}catch(error){this.report(error);throw error;}
 }
 private patch(values:Partial<ThoughtSpacePreferences>){
  const next={...values};this.pendingWrites++;
  const run=this.saveTail.catch(()=>{}).then(()=>this.commitPatch(next));this.saveTail=run;
  return run.finally(()=>{this.pendingWrites--;if(!this.pendingWrites&&this.refreshAfterSave){this.refreshAfterSave=false;this.display();}});
 }
 private async commitPatch(values:Partial<ThoughtSpacePreferences>){
  const before:Partial<ThoughtSpacePreferences>={};
  for(const key of Object.keys(values) as (keyof ThoughtSpacePreferences)[])Object.assign(before,{[key]:this.host.settings[key]});
  Object.assign(this.host.settings,values);
  try{await this.persist();}catch(error){
   for(const key of Object.keys(values) as (keyof ThoughtSpacePreferences)[])if(this.host.settings[key]===values[key])Object.assign(this.host.settings,{[key]:before[key]});
   this.host.noteToolbar?.refresh();this.refreshAfterSave=true;throw error;
  }
  if('noteMarkdownToolbar' in values)this.host.noteToolbar?.refresh();
  if('boardSearchEnabled' in values)this.host.rebuildBoardSearch();
  this.containerEl.dataset.accent=this.host.settings.accent;
 }
 private run(work:()=>Promise<unknown>){void work().catch(()=>{});}
 private row(el:HTMLElement,key:string,name:Pair,desc?:Pair){
  const row=new Setting(el).setName(this.t(name));if(desc)row.setDesc(this.t(desc));
  row.settingEl.dataset.settingKey=key;row.settingEl.dataset.search=[...name,...(desc||[])].join(' ').toLowerCase();return row;
 }
 private toggle(el:HTMLElement,key:keyof ThoughtSpacePreferences,name:Pair,desc:Pair,defaultValue=true){
  this.row(el,String(key),name,desc).addToggle(c=>c.setValue(typeof this.host.settings[key]==='boolean'?this.host.settings[key] as boolean:defaultValue).onChange(value=>this.run(()=>this.patch({[key]:value}))));
 }
 private select(el:HTMLElement,key:keyof ThoughtSpacePreferences,name:Pair,desc:Pair,choices:Record<string,Pair>){
  this.row(el,String(key),name,desc).addDropdown(c=>c.addOptions(Object.fromEntries(Object.entries(choices).map(([value,label])=>[value,this.t(label)]))).setValue(String(this.host.settings[key])).onChange(value=>{
   if(!Object.hasOwn(choices,value))return;
   if(key==='canvasBackground'&&value==='image'&&!this.host.settings.backgroundImagePath){c.setValue(this.host.settings.canvasBackground);this.openAppearance('image');return;}
   this.run(()=>this.patch({[key]:key==='readingSize'?Number(value):value}));
  }));
 }
 display(){
  this.language=settingsLanguage(this.host.settings);
  const root=this.containerEl;root.empty();root.addClass('ts-settings','ts-settings-v2');root.dataset.accent=this.host.settings.accent;root.lang=this.language;
  this.panels.clear();this.navigation.clear();
  const header=root.createDiv('ts-settings-header');new Setting(header).setName('ThoughtSpace').setHeading();header.createSpan({cls:'ts-settings-version',text:this.host.manifest.version});
  const language=header.createEl('select',{attr:{'aria-label':this.t(['设置语言','Settings language']),'data-setting-key':'settingsLanguage'}});
  for(const[value,label]of [['auto',this.t(['跟随 Obsidian','Follow Obsidian'])],['zh-CN','简体中文'],['en','English']])language.createEl('option',{value,text:label});
  language.value=this.host.settings.settingsLanguage;language.onchange=()=>{const value=language.value;if(value!=='auto'&&value!=='zh-CN'&&value!=='en')return;this.run(async()=>{await this.patch({settingsLanguage:value});this.display();});};
  const search=root.createDiv('ts-settings-search');setIcon(search.createSpan(),'search');
  this.searchInput=search.createEl('input',{type:'search',value:this.query,attr:{placeholder:this.t(['搜索设置…','Search settings…']),'aria-label':this.t(['搜索全部设置','Search all settings'])}});
  this.searchInput.oninput=()=>{this.query=this.searchInput?.value||'';this.filter();};
  this.searchInput.onkeydown=event=>{if(event.key==='Escape'&&this.query){event.preventDefault();event.stopPropagation();this.query='';this.searchInput!.value='';this.filter();}};
  const clear=search.createEl('button',{cls:'clickable-icon',attr:{'aria-label':this.t(['清除搜索','Clear search']),title:this.t(['清除搜索','Clear search'])}});setIcon(clear,'x');clear.onclick=()=>{this.query='';this.searchInput!.value='';this.filter();this.searchInput!.focus();};
  this.searchCount=root.createDiv({cls:'ts-settings-search-count',attr:{role:'status','aria-live':'polite'}});
  const layout=root.createDiv('ts-settings-layout'),nav=layout.createEl('nav',{cls:'ts-settings-nav',attr:{'aria-label':this.t(['设置分类','Settings categories'])}}),content=layout.createDiv('ts-settings-content');
  for(const item of pages){
   const tab=nav.createEl('button',{attr:{'data-settings-page':item.id}});setIcon(tab.createSpan(),item.icon);tab.createSpan({text:this.t(item.label)});
   tab.onclick=()=>{this.page=item.id;this.query='';this.searchInput!.value='';this.filter();};this.navigation.set(item.id,tab);
   const panel=content.createEl('section',{cls:'ts-settings-panel',attr:{'data-settings-panel':item.id,'aria-label':this.t(item.label)}});this.panels.set(item.id,panel);
   const heading=panel.createDiv('ts-settings-panel-heading');new Setting(heading).setName(this.t(item.label)).setHeading();
   if(['general','cards','board','input','reading'].includes(item.id)){
    const reset=heading.createEl('button',{cls:'clickable-icon',attr:{title:this.t(['恢复本分类默认值','Reset this category']),'aria-label':this.t(['恢复本分类默认值','Reset this category'])}});setIcon(reset,'rotate-ccw');
    reset.onclick=()=>new SettingsConfirm(this.app,this.t(['恢复默认设置','Restore defaults']),this.t([`仅恢复“${this.t(item.label)}”的设置，不修改已有笔记、卡片或文件。`,`Reset only ${this.t(item.label)} preferences. Existing notes, cards and files stay unchanged.`]),this.t(['恢复默认','Restore defaults']),this.language,async()=>{await this.patch(settingsCategoryDefaults(item.id as SettingsCategory));this.display();}).open();
   }
   this.renderPage(item.id,panel);
  }
  this.status=root.createDiv({cls:'ts-settings-save-status',attr:{role:'status','aria-live':'polite'}});
  this.filter();
 }
 private filter(){
  const query=this.query.trim().toLowerCase(),terms=query.split(/\s+/).filter(Boolean);let count=0;
  this.containerEl.toggleClass('is-searching',!!query);
  for(const[id,panel]of this.panels){
   let matches=0;
   for(const row of Array.from(panel.querySelectorAll<HTMLElement>('.setting-item'))){
    if(row.parentElement?.classList.contains('ts-settings-panel-heading'))continue;
    const text=(row.dataset.search||row.textContent||'').toLowerCase();const heading=row.classList.contains('setting-item-heading');
    const visible=!query||!heading&&terms.every(term=>text.includes(term));row.hidden=!visible;if(query&&visible)matches++;
   }
   for(const heading of Array.from(panel.querySelectorAll<HTMLElement>(':scope > h3, .ts-board-preferences > h3, .ts-mouse-preferences > h3')))heading.hidden=!!query;
   panel.hidden=query?!matches:id!==this.page;count+=matches;
   const tab=this.navigation.get(id)!;tab.toggleClass('is-active',!query&&id===this.page);if(!query&&id===this.page)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
  }
  if(this.searchCount){this.searchCount.hidden=!query;this.searchCount.setText(this.t([count?`找到 ${count} 项设置`:'没有匹配的设置',count?`${count} matching settings`:'No matching settings']));}
 }
 private renderPage(page:Page,el:HTMLElement){
  const prefs={...this.host.settings},t=(pair:Pair)=>this.t(pair);let baseline={...prefs};
  // Legacy controls edit a local draft; serialize their differences with other settings writes.
  const persist=()=>{const changes:Partial<ThoughtSpacePreferences>={};for(const key of Object.keys(prefs) as (keyof ThoughtSpacePreferences)[])if(prefs[key]!==baseline[key])Object.assign(changes,{[key]:prefs[key]});baseline={...prefs};return this.patch(changes);};
  if(page==='general'){
   this.select(el,'surfaceStyle',['界面材质','Panel finish'],['柔光使用半透明面板；纸感使用实色面板。','Soft uses translucent panels; paper uses solid surfaces.'],{soft:['柔光','Soft'],paper:['纸感','Paper']});
   this.select(el,'accent',['强调色','Accent color'],['影响按钮与导航，不改变卡片自己的配色。','Changes buttons and navigation, not individual card colors.'],{forest:['森林绿','Forest'],blue:['湖水蓝','Lake'],amber:['暖琥珀','Amber'],rose:['玫瑰色','Rose']});
   this.toggle(el,'glassEffects',['玻璃效果','Glass effects'],['关闭后使用实色界面。','Turn off to use solid interface surfaces.']);
   this.select(el,'density',['界面密度','Interface density'],['统一侧栏、材料库、写作与媒体摘录的控件和条目间距；正文及格式栏密度保持独立。','Controls spacing in sidebars, materials, writing and media excerpts; reading text and formatting toolbar density remain independent.'],{comfortable:['舒适','Comfortable'],compact:['紧凑','Compact']});return;
  }
  if(page==='cards'){
   this.select(el,'defaultCardStyle',['默认卡片样式','Default card style'],['仅用于之后新建或插入的 Markdown 卡片，已有卡片保持原样。','Applies to newly created or inserted Markdown cards. Existing cards stay unchanged.'],{transparent:['透明','Transparent'],solid:['实色','Solid'],band:['色带','Color band'],paper:['纸张','Paper'],index:['索引卡','Index'],sticky:['便签卡','Sticky note']});
   boardPreferenceControls(el.createDiv('ts-board-preferences'),prefs,persist,{includeMouse:false,section:'cards',hideReset:true,language:this.language});
   this.toggle(el,'noteMarkdownToolbar',['笔记 Markdown 工具栏','Note formatting toolbar'],['在普通笔记和侧栏笔记的编辑模式显示格式工具。','Shows formatting tools while editing notes and sidebar notes.']);
   this.toggle(el,'compactDuplicateCardTitles',['精简重复卡片标题','Compact duplicate card titles'],['卡片名与正文首个 H1 相同时，将外壳标题缩为来源行。保留正文和原笔记；关闭即可恢复。','When a card title matches its first H1, show the outer title as a compact source line. Keeps the heading and source note; turn off to restore.'],false);return;
  }
  if(page==='board'){
   this.select(el,'canvasBackground',['画布背景','Canvas background'],['背景只影响画布，不修改卡片内容。','Changes the canvas surface without changing card content.'],{dots:['点阵','Dots'],grid:['网格','Grid'],plain:['纯色','Plain'],paper:['纸张纹理','Paper texture'],image:['自定义图片','Custom image']});
   this.row(el,'paper',['纸张外观','Paper appearance'],['纸色与纹理强度。','Paper color and texture strength.']).addButton(b=>b.setIcon('sliders-horizontal').setButtonText(t(['自定义纸张','Customize paper'])).onClick(()=>this.openAppearance('paper')));
   this.row(el,'backgroundImage',['背景图片','Background image'],['本地图片、显示方式与透明度。','Local image, fit and opacity.']).addButton(b=>b.setIcon('image').setButtonText(t(['设置图片','Choose image'])).onClick(()=>this.openAppearance('image')));
   this.toggle(el,'showMinimap',['显示小地图','Show minimap'],['窄窗格会自动收起。','Automatically hidden in narrow panes.']);
   this.toggle(el,'boardSearchEnabled',['白板原生搜索','Native board search'],['更新 Markdown 搜索索引。关闭后保留已有索引。','Updates the Markdown search index. Existing index files remain when disabled.']);
   boardPreferenceControls(el.createDiv('ts-board-preferences'),prefs,persist,{includeMouse:false,section:'board',hideReset:true,language:this.language});return;
  }
  if(page==='input'){mousePreferenceControls(el.createDiv('ts-board-preferences'),prefs,persist,()=>this.openHostSettings('hotkeys'),{language:this.language,hideReset:true});return;}
  if(page==='reading'){
   this.select(el,'readingSize',['阅读桌字号','Reading desk text size'],['重新打开阅读桌生效，不改变白板对象字号。','Reopen the reading desk to apply. Canvas text sizes stay unchanged.'],{'14':['14 px','14 px'],'16':['16 px','16 px'],'18':['18 px','18 px'],'20':['20 px','20 px']});
   this.select(el,'readingWidth',['阅读桌行宽','Reading desk width'],['重新打开阅读桌生效。','Reopen the reading desk to apply.'],{standard:['标准 · 680 px','Standard · 680 px'],wide:['宽版 · 920 px','Wide · 920 px']});return;
  }
  if(page==='filing'){this.renderFiling(el);return;}
  if(page==='images'){
   let connected=false,ready=false,failed=false;
   try{const api=imageHostApi(this.app);connected=!!api;ready=api?.status().ready===true;}catch{failed=true;}
   this.row(el,'imageHostStatus',['极速图床','Fast Image Bed'],failed?['无法读取图床状态，请检查图床插件。','Hosting status unavailable. Check the hosting plugin.']:connected?(ready?['已连接，COS 上传可用。','Connected. COS upload is available.']:['已连接，请在极速图床中配置 COS。','Connected. Configure COS in Fast Image Bed.']):['需要在同一笔记库启用极速图床 0.9.0 或更新版本。','Enable Fast Image Bed 0.9.0 or newer in this vault.']).addButton(b=>b.setButtonText(t(['图床设置','Hosting settings'])).onClick(()=>this.openHostSettings('fast-image-bed')));
   this.toggle(el,'imageHostEnabled',['新图片上传图床','Upload new images'],['始终保留本地附件，上传失败时回退本地。密钥由极速图床管理。','Keeps a local attachment and falls back to it on upload failure. Credentials are managed by Fast Image Bed.'],false);return;
  }
  this.row(el,'exportProfile',['导出偏好配置','Export preferences'],['仅导出外观与操作偏好，不含目录、图片路径、归档或图床设置。','Includes appearance and interaction preferences only. Excludes folders, image paths, filing and hosting settings.']).addButton(b=>b.setIcon('copy').setButtonText(t(['查看与复制','View & copy'])).onClick(()=>this.profileModal(false)));
  this.row(el,'importProfile',['导入偏好配置','Import preferences'],['先检查 JSON，再确认应用。已有卡片和笔记不变。','Validate JSON before applying. Existing cards and notes stay unchanged.']).addButton(b=>b.setIcon('upload').setButtonText(t(['导入配置','Import profile'])).onClick(()=>this.profileModal(true)));
 }
 private openHostSettings(id:string){const host=hostSettings(this.app);if(!host){new Notice(this.t(['请从 Obsidian 设置中打开对应页面。','Open the corresponding page in Obsidian settings.']));return;}host.open();host.openTabById(id);}
 private openAppearance(kind:'paper'|'image'){
  const modal=kind==='paper'?this.host.openPaperSettings():this.host.openBackgroundImageSettings(),close=modal.onClose.bind(modal);
  modal.onClose=()=>{close();if(this.containerEl.isConnected)this.display();};
 }
 private renderFiling(el:HTMLElement){
  const t=(pair:Pair)=>this.t(pair);
  this.toggle(el,'autoFileCards',['自动按标签归档','Automatically file by tag'],['只管理卡片根目录内的笔记。标签变更会移动文件；多个标签使用第一个。','Only manages notes in the card root. Tag changes move files; the first tag is used when several exist.']);
  this.toggle(el,'cleanupEmptyFolders',['清理空标签文件夹','Clean up empty tag folders'],['仅把归档后为空的标签文件夹放入回收站。','Trashes only tag folders left empty after filing.']);
  this.row(el,'cardFolder',['卡片根目录','Card root folder'],['修改只影响之后的新建与归档，不批量移动旧目录。','Changes future creation and filing only; does not move the old root.']).addText(c=>c.setValue(this.folderDraft??this.host.settings.cardFolder).onChange(value=>{this.folderDraft=value;})).addButton(b=>b.setIcon('save').setButtonText(t(['保存目录','Save folder'])).onClick(()=>this.run(async()=>{
   let next;try{next=validateFolders(this.folderDraft??this.host.settings.cardFolder,this.host.journalRoot);}catch{new Notice(t(['目录必须是库内相对路径，且不能与日记目录互相包含。','Use a vault-relative folder that does not contain or overlap the journal folder.']));return;}
   await this.patch(next);this.folderDraft=undefined;new Notice(t(['目录设置已保存','Folder saved']));
  })));
  this.row(el,'calendar',['日历与日记','Calendar & journals'],['日记目录与任务由独立的 ThoughtSpace 日历与日记插件管理。','Journal folders and tasks are managed by the separate ThoughtSpace Calendar & Journals plugin.']);
  this.row(el,'fileCards',['整理已有卡片','File existing cards'],['移动前备份，同名文件加序号；此操作不属于白板撤销。','Backs up before moving and numbers filename conflicts. Canvas undo does not undo file moves.']).addButton(b=>b.setIcon('folder-input').setButtonText(t(['按标签整理','File by tag'])).onClick(()=>this.confirmFiling(false)));
  this.row(el,'fileJournals',['整理旧日记','File old journals'],['把根目录的日期笔记移至年/月目录，保留同日不同版本。','Moves dated notes into year/month folders, preserving existing versions.']).addButton(b=>b.setIcon('folder-input').setButtonText(t(['整理为年/月','File by month'])).onClick(()=>this.confirmFiling(true)));
  this.row(el,'filingBackup',['归档备份目录','Filing backup folder']).setDesc(`${this.app.vault.configDir}/plugins/thoughtspace/filing-backups/`);
 }
 private confirmFiling(journals:boolean){
  const t=(pair:Pair)=>this.t(pair);
  new SettingsConfirm(this.app,t(journals?['整理旧日记','File old journals']:['整理已有卡片','File existing cards']),t(['这会移动实际文件。继续前请确认仓库备份；白板撤销不会还原文件移动。','This moves files in your vault. Check your vault backup before continuing; canvas undo cannot reverse these moves.']),t(['继续整理','Continue']),this.language,async()=>{try{await(journals?this.host.fileOldJournals():this.host.fileAllCards());}catch(error){this.report(error);throw error;}}).open();
 }
 private profileModal(importing:boolean){
  const modal=new Modal(this.app),t=(pair:Pair)=>this.t(pair);themeSurface(modal.modalEl);modal.modalEl.addClass('ts-settings-profile-modal');modal.titleEl.setText(t(importing?['导入偏好配置','Import preferences']:['导出偏好配置','Export preferences']));
  const input=modal.contentEl.createEl('textarea',{attr:{'aria-label':t(['偏好配置 JSON','Preference profile JSON']),spellcheck:'false'}});input.value=importing?'':exportSettingsProfile(this.host.settings);input.readOnly=!importing;
  const status=modal.contentEl.createDiv({cls:'ts-settings-profile-status',attr:{role:'status','aria-live':'polite'}});
  const actions=new Setting(modal.contentEl);let patch:Partial<ThoughtSpacePreferences>|undefined;let generation=0,closed=false,loading=false,busy=false;let validateButton:HTMLButtonElement;
  modal.onClose=()=>{closed=true;generation++;modal.contentEl.empty();};
  if(importing){
   const file=modal.contentEl.createEl('input',{type:'file',attr:{accept:'.json,application/json','aria-label':t(['选择配置文件','Choose profile file'])}});file.hidden=true;
   file.onchange=()=>{const selected=file.files?.[0];file.value='';if(!selected||busy)return;const run=++generation;patch=undefined;apply.disabled=true;loading=false;validateButton.disabled=false;if(selected.size>65_536){status.setText(t(['配置文件过大。','Profile file is too large.']));return;}loading=true;validateButton.disabled=true;status.setText(t(['正在读取配置…','Reading profile…']));void selected.text().then(text=>{if(closed||run!==generation)return;input.value=text;patch=undefined;apply.disabled=true;status.setText('');}).catch(()=>{if(!closed&&run===generation)status.setText(t(['无法读取文件。','Could not read file.']));}).finally(()=>{if(!closed&&run===generation){loading=false;validateButton.disabled=false;}});};
   actions.addButton(b=>b.setIcon('file-json').setButtonText(t(['选择文件','Choose file'])).onClick(()=>file.click()));
   actions.addButton(b=>{validateButton=b.buttonEl;b.setButtonText(t(['检查配置','Validate'])).onClick(()=>{if(closed||loading||busy)return;try{patch=parseSettingsProfile(input.value);status.setText(t([`已检查 ${Object.keys(patch).length} 项偏好，确认后应用。`,`${Object.keys(patch).length} preferences validated. Apply to confirm.`]));apply.disabled=false;}catch{patch=undefined;apply.disabled=true;status.setText(t(['无效配置。请使用 ThoughtSpace 导出的版本 1 配置，不含额外字段。','Invalid profile. Use a version 1 ThoughtSpace export with no unsupported fields.']));}});});
   const apply=modal.contentEl.createEl('button',{cls:'mod-cta',text:t(['应用配置','Apply profile'])});apply.disabled=true;const applyControl={setDisabled:(disabled:boolean)=>{apply.disabled=disabled;}};
   // Revalidate at the write boundary so edited JSON can never reuse an earlier approval.
   input.oninput=()=>{generation++;loading=false;validateButton.disabled=busy;patch=undefined;apply.disabled=true;status.setText('');};
   apply.onclick=()=>{if(closed||loading||busy||!patch||apply.disabled)return;busy=true;apply.disabled=true;input.readOnly=true;file.disabled=true;validateButton.disabled=true;this.run(async()=>{try{const next=parseSettingsProfile(input.value);await this.patch(next);this.display();if(!closed)modal.close();}catch{if(closed)return;busy=false;input.readOnly=false;file.disabled=false;validateButton.disabled=false;status.setText(t(['未能应用配置，原设置已保留。','Could not apply the profile. Previous settings were kept.']));applyControl.setDisabled(false);}});};
  }else actions.addButton(b=>b.setIcon('copy').setButtonText(t(['复制 JSON','Copy JSON'])).onClick(()=>{void navigator.clipboard.writeText(input.value).then(()=>status.setText(t(['已复制','Copied']))).catch(()=>status.setText(t(['无法访问剪贴板，请选中 JSON 后复制。','Clipboard unavailable. Select the JSON and copy it.'])));}));
  actions.addButton(b=>b.setButtonText(t(['关闭','Close'])).onClick(()=>modal.close()));modal.open();
 }
}
