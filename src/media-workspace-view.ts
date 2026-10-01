import {ItemView,Menu,Modal,Notice,TFile,WorkspaceLeaf,setIcon,type App,type ViewStateResult} from 'obsidian';
import type {MediaCardHandle,MediaCardState} from './media-card-player';
import type {MediaDraft,MediaDraftStore} from './media-draft-store';
import type {MediaMoment} from './media-notes';
import {mediaPreviewPath} from './media-preview-source';
import type {MediaIdentity} from './media-playback';
import {isVaultMediaPath,mediaClock,mediaKind,validMediaTime} from './media-source';

export const MEDIA_WORKSPACE='thoughtspace-media-player';
export type MediaPlacement='tab'|'sidebar'|'window';
export interface MediaWorkspaceHost {
 drafts?:MediaDraftStore;
 recoverDrafts?():void;
 open(file:TFile|undefined,placement:MediaPlacement,time?:number):Promise<unknown>;
 pick(done:(file:TFile)=>void):void;
 pickExternal?(done:(file:TFile)=>unknown):void;
 pickOnline?(placement:MediaPlacement):void;
 mount(host:HTMLElement,file:TFile,hooks:{initialState?:MediaCardState;state:(state:MediaCardState)=>void;capture:(time:number)=>Promise<unknown>;frame:(blob:Blob,time:number)=>Promise<unknown>;frameCaptureState?:(busy:boolean,time:number)=>void}):MediaCardHandle;
 moments(file:TFile):Promise<{note?:TFile;entries:MediaMoment[];warnings?:string[]}>;
 saveMoment(file:TFile,data:{id:string;time:number;text:string;image?:Blob;source?:MediaIdentity}):Promise<{note:TFile}>;
 openNote(file:TFile):Promise<unknown>;
 sendToBoard(file:TFile,moment?:MediaMoment):Promise<unknown>;
}
export interface MediaWorkspaceState extends Record<string,unknown>{file?:string;time?:number;placement?:MediaPlacement;playback?:MediaCardState;focusPlayer?:boolean;recordPanel?:RecordPanel;compactPlayer?:boolean;viewerRatio?:number;recordDensity?:RecordDensity;composerRatio?:number}
type Draft=MediaDraft;
type WorkspaceMoment=MediaMoment & {key?:string;notePath?:string};
type RecordPanel='compose'|'timeline';
type RecordFilter='all'|'text'|'image';
type RecordDensity='comfortable'|'compact';
interface Memory {source:MediaIdentity;state:MediaCardState;draft?:Draft;pending?:Promise<unknown>;listeners:Set<(refresh:boolean)=>void>;focusPlayer?:boolean;editor?:symbol;capturePending?:symbol}
// A closed view releases its decoder, while unsaved text and images remain owned
// by this plugin host. Nothing is written to a user's note merely by opening it.
const memories=new WeakMap<MediaWorkspaceHost,Map<TFile,Memory>>();
function memoryFor(host:MediaWorkspaceHost,file:TFile):Memory {
 let files=memories.get(host);if(!files){files=new Map();memories.set(host,files);}
 let value=files.get(file);if(!value){value={source:sourceIdentity(file),state:{time:0,rate:1,volume:1},listeners:new Set()};files.set(file,value);}
 // A TFile survives in-place edits even while no view is watching this media.
 if(value.source.mtime!==file.stat.mtime||value.source.size!==file.stat.size)value.state={time:0,rate:value.state.rate,volume:value.state.volume};
 if(!value.draft)value.draft=host.drafts?.activeFor(file.path);
 value.source=sourceIdentity(file);
 return value;
}
function playback(value:MediaCardState|undefined,fallback:MediaCardState):MediaCardState {
 if(!value)return{...fallback};
 const loopA=validMediaTime(value.loopA)?value.loopA:undefined,loopB=loopA!==undefined&&validMediaTime(value.loopB)&&value.loopB>=loopA+.5?value.loopB:undefined;
 return{time:validMediaTime(value.time)?value.time:fallback.time,rate:Number.isFinite(value.rate)&&value.rate>0&&value.rate<=4?value.rate:fallback.rate,volume:Number.isFinite(value.volume)?Math.min(1,Math.max(0,value.volume)):fallback.volume,...(loopA!==undefined?{loopA}:{}),...(loopB!==undefined?{loopB}:{})};
}
const sourceIdentity=(file:TFile):MediaIdentity=>({path:file.path,mtime:file.stat.mtime,size:file.stat.size});
const matchesSource=(file:TFile,source:MediaIdentity|undefined)=>!!source&&file.path===source.path&&file.stat.mtime===source.mtime&&file.stat.size===source.size;
const broadcast=(memory:Memory,refresh=false)=>{for(const notify of memory.listeners)notify(refresh);};
export class MediaWorkspaceView extends ItemView {
 private file?:TFile;
 private note?:TFile;
 private placement:MediaPlacement='tab';
 private memory?:Memory;
 private player?:MediaCardHandle;
 private generation=0;
 private timelineRun=0;
 private closed=false;
 private opened=false;
 private entries:WorkspaceMoment[]=[];
 private recordPanel:RecordPanel='compose';
 private recordFilter:RecordFilter='all';
 private expandedRecords=new Set<string>();
 private panelButtons=new Map<RecordPanel,HTMLButtonElement>();
 private filterButtons=new Map<RecordFilter,HTMLButtonElement>();
 private searchInput?:HTMLInputElement;
 private clearSearchButton?:HTMLButtonElement;
 private inputCount?:HTMLElement;
 private query='';
 private limit=50;
 private pageStart=0;
 private timelineOrder:WorkspaceMoment[]=[];
 private pageInfo?:HTMLElement;
 private previousPageButton?:HTMLButtonElement;
 private nextPageButton?:HTMLButtonElement;
 private recordDensity:RecordDensity='comfortable';
 private densityButton?:HTMLButtonElement;
 private moreButton?:HTMLButtonElement;
 private contextMenu?:Menu;
 private renderedMoments=new Map<string,{entry:WorkspaceMoment;row:HTMLElement}>();
 private compactPlayer=false;
 private compactButton?:HTMLButtonElement;
 private viewerRatio=56;
 private composerRatio=40;
 private composerRange?:HTMLInputElement;
 private draftStatus?:HTMLElement;
 private saveTarget?:HTMLElement;
 private panelCount?:HTMLElement;
 private layoutRange?:HTMLInputElement;
 private draftAttachment?:HTMLElement;
 private draftImage?:HTMLButtonElement;
 private draftImageEl?:HTMLImageElement;
 private previewBlob?:Blob;
 private previewUrl?:string;
 private previewUrlAPI?:typeof URL;
 private previews=new Set<MediaImagePreview>();
 private unsubscribe?:()=>void;
 private refreshTimer?:number;
 private refreshWindow?:Window;
 private input?:HTMLTextAreaElement;
 private timeLabel?:HTMLElement;
 private saveButton?:HTMLButtonElement;
 private clearButton?:HTMLButtonElement;
 private imageLabel?:HTMLElement;
 private status?:HTMLElement;
 private recoveryButton?:HTMLButtonElement;
 private timeline?:HTMLElement;
 private timelineCount?:HTMLElement;
 private openNoteButton?:HTMLButtonElement;
 private busy=false;
 private initialSeek?:number;
 private focusPlayer=false;
 private focusButton?:HTMLButtonElement;
 private sourceIdentity?:MediaIdentity;
 private readonly editorKey=Symbol('media-draft-editor');
 private composing=false;
 private unsubscribeDrafts?:()=>void;
 private recoveryPrompt=false;

 constructor(leaf:WorkspaceLeaf,private host:MediaWorkspaceHost){super(leaf);this.unsubscribeDrafts=host.drafts?.subscribe(()=>{
  if(this.file&&this.memory&&!this.closed){if(!this.memory.draft)this.memory.draft=host.drafts?.activeFor(this.file.path);this.paintComposer();}
 });}
 getViewType(){return MEDIA_WORKSPACE;}
 getDisplayText(){return this.file?`${this.file.basename} · 媒体笔记`:'媒体笔记';}
 getIcon(){return 'clapperboard';}
 currentFile(){return this.file;}
 currentPlayback():MediaCardState{const state=playback(this.player?.getState?.(),this.memory?.state||{time:0,rate:1,volume:1});if(this.memory)this.memory.state=state;return{...state};}
 resumePlayback(){this.player?.play();}
 getState():MediaWorkspaceState{const state=this.currentPlayback();return{file:this.file?.path,time:this.memory?state.time:undefined,placement:this.placement,focusPlayer:this.focusPlayer,recordPanel:this.recordPanel,compactPlayer:this.compactPlayer,viewerRatio:this.viewerRatio,recordDensity:this.recordDensity,composerRatio:this.composerRatio,...(this.memory?{playback:state}:{})};}
 hasPendingDraft(){return!!(this.memory?.draft||this.memory?.pending||this.memory?.capturePending);}
 canMove(){if(this.hasPendingDraft()){new Notice('请先保存或清空当前摘录，再切换媒体或播放位置');return false;}return!this.closed;}
 async onOpen(){
  if(this.opened)return;this.opened=true;
  this.registerEvent(this.app.vault.on('modify',file=>{if(file===this.note)this.scheduleRefresh();if(file===this.file)this.sourceChanged();}));
  this.registerEvent(this.app.vault.on('rename',file=>{if(file===this.note)this.scheduleRefresh();if(file===this.file)this.sourceChanged();}));
  this.registerEvent(this.app.vault.on('delete',file=>{if(file===this.note)this.scheduleRefresh();if(file===this.file){this.disposePlayer();this.message('媒体文件已移除，未保存的摘录仍保留在此窗口。');}}));
  if(!this.contentEl.querySelector('.ts-media-workspace__header'))this.render();
 }
 async setState(state:MediaWorkspaceState,result?:ViewStateResult){
  if(this.closed)return;
  const candidate=state.file&&this.app.vault.getAbstractFileByPath(state.file);
  const next=candidate instanceof TFile&&isVaultMediaPath(candidate.path)?candidate:undefined;
  const placement=state.placement==='sidebar'||state.placement==='window'?state.placement:'tab';
  if((next!==this.file||placement!==this.placement)&&this.hasPendingDraft()){this.canMove();return;}
  const changed=!!next&&next===this.file&&!matchesSource(next,this.sourceIdentity);
  if(changed&&this.hasPendingDraft()){this.disposePlayer();this.paintComposer();this.message('媒体来源已更新，当前摘录仍保留；请先清空草稿后重新选择媒体。');return;}
  if(next===this.file&&this.memory&&!changed){
   if(next&&!this.memory.draft)this.memory.draft=this.host.drafts?.activeFor(next.path);this.paintComposer();
   this.placement=placement;this.contentEl.dataset.placement=placement;
   if(typeof state.focusPlayer==='boolean')this.setFocusPlayer(state.focusPlayer);
   if(state.recordPanel==='compose'||state.recordPanel==='timeline')this.setRecordPanel(state.recordPanel);
   if(typeof state.compactPlayer==='boolean')this.setCompactPlayer(state.compactPlayer);
   if(typeof state.composerRatio==='number')this.setComposerRatio(state.composerRatio);
   if(typeof state.viewerRatio==='number')this.setViewerRatio(state.viewerRatio);
   if(state.recordDensity==='compact'||state.recordDensity==='comfortable')this.setRecordDensity(state.recordDensity);
   this.contentEl.querySelectorAll<HTMLButtonElement>('.ts-media-workspace__positions button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.placement===placement)));
   if(validMediaTime(state.time)){this.memory.state.time=state.time;this.player?.seek(state.time);}
   this.app.workspace.requestSaveLayout();if(result)result.history=true;return;
  }
  // dispose emits the final playback snapshot before its generation is retired.
  const contentChanged=changed&&!!this.sourceIdentity&&(next.stat.mtime!==this.sourceIdentity.mtime||next.stat.size!==this.sourceIdentity.size);
  this.disposePlayer();this.releasePreview();this.closePreviews();this.unsubscribe?.();this.unsubscribe=undefined;this.releaseEditor();
  this.generation++;this.timelineRun++;this.cancelRefresh();
  this.file=next;this.placement=placement;this.note=undefined;this.entries=[];this.query='';this.limit=50;this.pageStart=0;this.recordFilter='all';this.expandedRecords.clear();
  this.recordPanel=state.recordPanel==='timeline'?'timeline':'compose';
  this.recordDensity=state.recordDensity==='compact'?'compact':'comfortable';
  if(typeof state.compactPlayer==='boolean')this.compactPlayer=state.compactPlayer;
  if(typeof state.composerRatio==='number'&&Number.isFinite(state.composerRatio))this.composerRatio=Math.max(35,Math.min(65,state.composerRatio));
  if(typeof state.viewerRatio==='number'&&Number.isFinite(state.viewerRatio))this.viewerRatio=Math.max(38,Math.min(70,state.viewerRatio));
  this.sourceIdentity=next?sourceIdentity(next):undefined;
  this.memory=next?memoryFor(this.host,next):undefined;
  this.focusPlayer=typeof state.focusPlayer==='boolean'?state.focusPlayer:this.memory?.focusPlayer??false;
  if(this.memory)this.memory.focusPlayer=this.focusPlayer;
  if(this.memory){
   this.memory.state=playback(state.playback,contentChanged?{time:0,rate:this.memory.state.rate,volume:this.memory.state.volume}:this.memory.state);
   this.initialSeek=validMediaTime(state.time)?state.time:undefined;
   if(this.initialSeek!==undefined)this.memory.state.time=this.initialSeek;
   const owned=this.memory,notify=(refresh:boolean)=>{if(this.closed||this.memory!==owned)return;this.paintComposer();if(refresh&&!owned.pending)this.scheduleRefresh();};
   owned.listeners.add(notify);this.unsubscribe=()=>owned.listeners.delete(notify);
  }
  this.render();if(state.file&&!next)this.message('找不到这份音视频文件，请重新选择。');
  this.app.workspace.requestSaveLayout();if(result)result.history=true;
  await this.refreshMoments();
 }
 private action(parent:HTMLElement,label:string,icon:string,fn:(event?:MouseEvent)=>unknown,iconOnly=false){
  const button=parent.createEl('button',{cls:'ts-media-workspace__action',attr:{type:'button','aria-label':label,title:label}});
  setIcon(button.createSpan(),icon);if(!iconOnly)button.createSpan({text:label});
  button.onclick=event=>{try{void Promise.resolve(fn(event)).catch(()=>this.message('操作未完成，请重试；当前摘录会保留。'));}catch{this.message('操作未完成，请重试；当前摘录会保留。');}};
  return button;
 }
 private message(text:string){if(!this.closed&&this.status){this.status.textContent=text;this.status.title=text;}}
 private renderTitle(){
  const title=this.contentEl.querySelector<HTMLElement>('.ts-media-workspace__title');
  if(title){title.textContent=this.file?.basename||'媒体工作区';title.title=this.file?.path||'选择音频或视频开始';}
  const kind=this.contentEl.querySelector<HTMLElement>('.ts-media-workspace__file-kind');
  if(kind){kind.textContent=this.file?(['tsvideo','tsaudio'].includes(this.file.extension.toLowerCase())?'本地引用':this.file.extension.toUpperCase()):'';kind.hidden=!this.file;}
  const source=this.contentEl.querySelector<HTMLElement>('.ts-media-workspace__source');
  if(source){source.textContent=this.file?.path||'播放 · 摘录 · 思考';source.title=this.file?.path||'';}
 }
 private setRecordPanel(panel:RecordPanel){
  this.recordPanel=panel;this.contentEl.dataset.recordPanel=panel;
  for(const[key,button]of this.panelButtons)button.setAttribute('aria-pressed',String(key===panel));
  this.app.workspace.requestSaveLayout();
 }
 private setRecordFilter(filter:RecordFilter){
  this.recordFilter=filter;this.limit=50;this.pageStart=0;
  for(const[key,button]of this.filterButtons)button.setAttribute('aria-pressed',String(key===filter));
  this.renderTimeline();
 }
 private clearSearch(){if(this.searchInput)this.searchInput.value='';this.query='';this.limit=50;this.pageStart=0;this.renderTimeline();this.searchInput?.focus();}

 private setRecordDensity(value:RecordDensity){
  this.recordDensity=value;this.contentEl.dataset.recordDensity=value;
  if(this.densityButton){const compact=value==='compact',label=compact?'舒展显示摘录':'紧凑显示摘录';this.densityButton.setAttribute('aria-label',label);this.densityButton.title=label;this.densityButton.setAttribute('aria-pressed',String(compact));setIcon(this.densityButton.children[0] as HTMLElement,compact?'rows-2':'rows-3');}
  this.app.workspace.requestSaveLayout();
 }
 private showMore(event?:MouseEvent){
  this.contextMenu?.hide();
  const menu=this.contextMenu=new Menu(),file=this.file,generation=this.generation;
  menu.setParentElement(this.contentEl);
  const current=()=>!this.closed&&this.generation===generation&&this.file===file;
  const failed=()=>{if(current())this.message('操作未完成，请重试；当前摘录会保留。');};
  const run=(fn:()=>unknown)=>()=>{if(!current())return;try{void Promise.resolve(fn()).catch(failed);}catch{failed();}};
  menu.addItem(item=>item.setTitle('选择音频或视频').setIcon('folder-open').onClick(run(()=>this.pick())));
  if(this.host.pickOnline)menu.addItem(item=>item.setTitle('打开 B 站 / YouTube 在线视频').setIcon('globe').onClick(run(()=>{if(this.canMove())this.host.pickOnline?.(this.placement);})));
  if(this.host.pickExternal)menu.addItem(item=>item.setTitle('链接仓库外的视频或音频').setIcon('link').onClick(run(()=>this.pickExternal())));
  menu.addItem(item=>item.setTitle('将媒体加入白板').setIcon('panels-top-left').setDisabled(!file).onClick(run(()=>file&&this.isCurrent(file,generation)&&this.host.sendToBoard(file))));
  menu.addSeparator();
  menu.addItem(item=>item.setTitle(this.focusPlayer?'显示记录面板':'专注播放').setIcon('maximize-2').setChecked(this.focusPlayer).setDisabled(!file).onClick(run(()=>this.setFocusPlayer(!this.focusPlayer))));
  menu.addItem(item=>item.setTitle(this.compactPlayer?'展开画面':'收起画面').setIcon('panel-top').setChecked(this.compactPlayer).setDisabled(!file).onClick(run(()=>this.setCompactPlayer(!this.compactPlayer))));
  menu.addSeparator();
  for(const[placement,label,icon]of [['tab','在主页面打开','panel-top'],['sidebar','在右侧栏打开','panel-right'],['window','在独立窗口打开','picture-in-picture-2']]as const)menu.addItem(item=>item.setTitle(label).setIcon(icon).setChecked(this.placement===placement).onClick(run(()=>this.move(placement))));
  if(event&&event.detail>0)menu.showAtMouseEvent(event);
  else{const rect=this.moreButton?.getBoundingClientRect();menu.showAtPosition({x:rect?.left??0,y:rect?.bottom??0},this.contentEl.ownerDocument);}
 }
 private setCompactPlayer(value:boolean){
  if(value&&this.focusPlayer)this.setFocusPlayer(false);
  this.compactPlayer=value;this.contentEl.dataset.compactPlayer=String(value);
  if(this.compactButton){const label=value?'展开画面':'收起画面';this.compactButton.setAttribute('aria-label',label);this.compactButton.title=label;this.compactButton.setAttribute('aria-pressed',String(value));setIcon(this.compactButton.children[0] as HTMLElement,value?'panel-top-open':'panel-top-close');}
  this.app.workspace.requestSaveLayout();
 }
 private setComposerRatio(value:number){
  if(!Number.isFinite(value))return;
  this.composerRatio=Math.max(35,Math.min(65,value));this.contentEl.style.setProperty('--ts-mw-composer',`${this.composerRatio}%`);
  this.contentEl.querySelector('.ts-media-workspace__composer-divider')?.setAttribute('aria-valuenow',String(Math.round(this.composerRatio)));
  if(this.composerRange){this.composerRange.value=String(this.composerRatio);this.composerRange.setAttribute('aria-valuetext',`编辑区 ${this.composerRatio}%`);}
  this.app.workspace.requestSaveLayout();
 }
 private setViewerRatio(value:number){
  if(!Number.isFinite(value))return;
  this.viewerRatio=Math.max(38,Math.min(70,value));this.contentEl.style.setProperty('--ts-mw-viewer',`${this.viewerRatio}%`);
  if(this.layoutRange){this.layoutRange.value=String(this.viewerRatio);this.layoutRange.setAttribute('aria-valuetext',`观看区 ${this.viewerRatio}%`);}
  this.app.workspace.requestSaveLayout();
 }
 private releasePreview(){
  if(this.previewUrl){try{this.previewUrlAPI?.revokeObjectURL(this.previewUrl);}catch{/* Already released by its window. */}}
  this.previewBlob=undefined;this.previewUrl=undefined;this.previewUrlAPI=undefined;
  this.draftImageEl?.removeAttribute('src');
 }
 private closePreviews(){for(const modal of [...this.previews])modal.close();this.previews.clear();}
 private openPreview(source:Blob|TFile,time:number){
  if(this.closed)return;
  let url:string,release:()=>void=()=>{};
  if(source instanceof TFile){if(this.app.vault.getAbstractFileByPath(source.path)!==source)return;url=this.app.vault.getResourcePath(source);}
  else{const api=this.contentEl.ownerDocument.defaultView?.URL;if(!api)return;url=api.createObjectURL(source);release=()=>api.revokeObjectURL(url);}
  let modal:MediaImagePreview|undefined,released=false;
  const done=()=>{if(released)return;released=true;try{release();}finally{if(modal)this.previews.delete(modal);}};
  try{modal=new MediaImagePreview(this.app,url,`${this.file?.basename||'媒体截图'} · ${mediaClock(time)}`,done);this.previews.add(modal);modal.open();}
  catch(error){try{modal?.close();}finally{done();}throw error;}
 }
 private paintDraftImage(image:Blob|undefined){
  if(image!==this.previewBlob){
   this.releasePreview();
   if(image){const api=this.contentEl.ownerDocument.defaultView?.URL;try{if(api){this.previewUrl=api.createObjectURL(image);this.previewUrlAPI=api;this.previewBlob=image;}}catch{/* Text and the original frame remain available for saving. */}}
  }
  if(this.draftImage){this.draftImage.hidden=!this.previewUrl;if(this.previewUrl&&this.draftImageEl&&this.draftImageEl.src!==this.previewUrl)this.draftImageEl.src=this.previewUrl;}
 }
 private filteredEntries(){const words=this.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return this.entries.filter(entry=>(this.recordFilter==='all'||(this.recordFilter==='image'?!!entry.image:!entry.image))&&words.every(word=>`${entry.text} ${mediaClock(entry.time)}`.toLocaleLowerCase().includes(word)));}
 private momentKey(entry:WorkspaceMoment){return entry.key||JSON.stringify([entry.id,entry.line,entry.time,entry.text,entry.image]);}
 private locateMoment(mode:'current'|'last'){
  const rows=this.filteredEntries();if(!rows.length){this.message('当前筛选下没有可定位的摘录。');return;}
  let index=rows.length-1;
  if(mode==='current'){const time=this.currentPlayback().time;index=0;for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].time-time)<Math.abs(rows[index].time-time))index=i;}
  this.pageStart=Math.floor(index/50)*50;this.limit=50;this.setRecordPanel('timeline');this.renderTimeline();
  this.renderedMoments.get(this.momentKey(rows[index]))?.row.scrollIntoView({block:'nearest'});
 }
 private highlightPlayback(time:number){
  // Search the complete filtered chronology, but update only the mounted page.
  let low=0,high=this.timelineOrder.length;
  while(low<high){const mid=(low+high)>>>1;if(this.timelineOrder[mid].time<=time)low=mid+1;else high=mid;}
  const key=low?this.momentKey(this.timelineOrder[low-1]):undefined;
  for(const[itemKey,item]of this.renderedMoments){const current=String(itemKey===key);if(item.row.dataset.current!==current)item.row.dataset.current=current;}
 }

 private render(){
  this.contextMenu?.hide();this.contextMenu=undefined;
  const el=this.contentEl;el.empty();el.addClass('ts-media-workspace');el.dataset.placement=this.placement;this.containerEl.addClass('ts-media-workspace-leaf');
  this.panelButtons.clear();this.filterButtons.clear();
  el.dataset.mediaKind=this.file?mediaKind(this.file.path)||'video':'empty';
  const header=el.createDiv('ts-media-workspace__header');
  const identity=header.createDiv('ts-media-workspace__identity');
  const sourceButton=this.action(identity,'选择音频或视频','folder-open',()=>this.pick(),true);sourceButton.addClass('ts-media-workspace__source-button');
  const names=identity.createDiv('ts-media-workspace__names');
  names.createSpan({cls:'ts-media-workspace__eyebrow',text:'媒体工作区'});
  const nameLine=names.createDiv('ts-media-workspace__name-line');
  nameLine.createEl('strong',{cls:'ts-media-workspace__title'});
  nameLine.createSpan({cls:'ts-media-workspace__file-kind'});
  names.createSpan({cls:'ts-media-workspace__source'});this.renderTitle();
  const headerActions=header.createDiv('ts-media-workspace__header-actions');
  this.focusButton=this.action(headerActions,'专注播放','maximize-2',()=>this.setFocusPlayer(!this.focusPlayer),true);this.focusButton.addClass('ts-media-workspace__secondary-action');this.focusButton.disabled=!this.file;this.paintFocus();
  this.compactButton=this.action(headerActions,'收起画面','panel-top-close',()=>this.setCompactPlayer(!this.compactPlayer),true);this.compactButton.addClass('ts-media-workspace__secondary-action');this.compactButton.disabled=!this.file;this.setCompactPlayer(this.compactPlayer);
  const layoutOptions=headerActions.createEl('details',{cls:'ts-media-workspace__layout-options'});
  const layoutSummary=layoutOptions.createEl('summary',{attr:{'aria-label':'调整工作区布局',title:'调整工作区布局'}});setIcon(layoutSummary.createSpan(),'columns-2');layoutSummary.createSpan({text:'布局'});
  const layoutControl=layoutOptions.createDiv('ts-media-workspace__layout-control');
  layoutControl.createSpan({text:'观看区宽度'});
  this.layoutRange=layoutControl.createEl('input',{cls:'ts-media-workspace__layout-range',type:'range',attr:{min:'38',max:'70',step:'2','aria-label':'观看区宽度','title':'调整左侧观看区与右侧记录区宽度'}});
  this.layoutRange.oninput=()=>this.setViewerRatio(Number(this.layoutRange!.value));this.setViewerRatio(this.viewerRatio);
  this.action(layoutControl,'恢复均衡布局','rotate-ccw',()=>{this.setViewerRatio(56);this.setComposerRatio(40);},true);
  const heightLabel=layoutControl.createEl('label',{cls:'ts-media-workspace__layout-choice'});heightLabel.createSpan({text:'右侧编辑区高度'});
  this.composerRange=heightLabel.createEl('input',{cls:'ts-media-workspace__layout-range',type:'range',attr:{min:'35',max:'65',step:'1','aria-label':'右侧编辑区高度'}});
  this.composerRange.oninput=()=>this.setComposerRatio(Number(this.composerRange!.value));this.setComposerRatio(this.composerRatio);
  layoutOptions.addEventListener('keydown',event=>{if(event.key==='Escape'){layoutOptions.open=false;layoutSummary.focus();event.stopPropagation();}});
  el.onpointerdown=event=>{if(layoutOptions.open&&!layoutOptions.contains(event.target as Node))layoutOptions.open=false;};
  this.moreButton=this.action(headerActions,'更多媒体操作','ellipsis',event=>{layoutOptions.open=false;this.showMore(event);},true);
  const messageArea=header.createDiv('ts-media-workspace__message-area');
  this.status=messageArea.createDiv({cls:'ts-media-workspace__status',attr:{role:'status','aria-live':'polite'}});
  if(this.host.recoverDrafts){this.recoveryButton=this.action(messageArea,'恢复 / 丢弃','history',()=>this.host.recoverDrafts?.());this.recoveryButton.hidden=true;this.recoveryButton.title='查看暂存草稿，选择恢复或丢弃；恢复不会自动写入笔记。';}
  if(!this.file){const empty=el.createDiv('ts-media-workspace__empty');setIcon(empty.createDiv('ts-media-workspace__empty-icon'),'clapperboard');empty.createSpan({cls:'ts-media-workspace__eyebrow',text:'从一段声音或影像开始'});empty.createEl('h2',{text:'把值得留下的瞬间，写成笔记'});empty.createEl('p',{text:'打开仓库中的音视频，或链接电脑上的外部文件，边播放边摘录。文字、画面与时间点保存在同一份笔记里。'});this.action(empty,'选择媒体','folder-open',()=>this.pick());if(this.host.pickOnline)this.action(empty,'B 站 / YouTube','globe',()=>this.host.pickOnline?.(this.placement));return;}
  const layout=el.createDiv('ts-media-workspace__layout'),main=layout.createDiv('ts-media-workspace__main');
  const playerHost=main.createDiv('ts-media-workspace__player');
  const desk=layout.createDiv('ts-media-workspace__desk');
  const switcher=layout.createDiv({cls:'ts-media-workspace__panel-switcher',attr:{role:'group','aria-label':'记录区显示内容'}});
  for(const[panel,label,icon]of [['compose','写摘录','square-pen'],['timeline','时间轴','list-video']]as const){
   const button=this.action(switcher,label,icon,()=>this.setRecordPanel(panel));this.panelButtons.set(panel,button);if(panel==='timeline')this.panelCount=button.createSpan({cls:'ts-media-workspace__panel-count',attr:{'aria-hidden':'true'}});
  }
  this.setRecordPanel(this.recordPanel);
  const composer=layout.createDiv('ts-media-workspace__composer'),heading=composer.createDiv('ts-media-workspace__composer-heading');
  const headingName=heading.createDiv('ts-media-workspace__section-title');
  setIcon(headingName.createSpan(),'square-pen');headingName.createEl('strong',{text:'当前草稿'});
  this.timeLabel=heading.createSpan('ts-media-workspace__draft-time');
  const divider=composer.createDiv({cls:'ts-media-workspace__composer-divider',attr:{role:'separator',tabindex:'0','aria-label':'调整编辑区与摘录列表高度','aria-orientation':'horizontal','aria-valuemin':'35','aria-valuemax':'65','aria-valuenow':String(this.composerRatio)}});
  let resizing=false;
  divider.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();resizing=true;divider.setPointerCapture(event.pointerId);};
  divider.onpointermove=event=>{if(!resizing)return;const bounds=layout.getBoundingClientRect();this.setComposerRatio((event.clientY-bounds.top)/bounds.height*100);divider.setAttribute('aria-valuenow',String(Math.round(this.composerRatio)));};
  divider.onpointerup=divider.onpointercancel=()=>{resizing=false;};
  divider.onkeydown=event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();this.setComposerRatio(this.composerRatio+(event.key==='ArrowUp'?-2:2));divider.setAttribute('aria-valuenow',String(Math.round(this.composerRatio)));};
  const captureActions=composer.createDiv({cls:'ts-media-workspace__capture-actions',attr:{role:'group','aria-label':'摘录操作'}});
  const editor=composer.createDiv('ts-media-workspace__editor');
  const editorLabel=editor.createDiv('ts-media-workspace__editor-label');editorLabel.createSpan({text:'Markdown'});
  this.inputCount=editorLabel.createSpan('ts-media-workspace__input-count');
  this.input=editor.createEl('textarea',{cls:'ts-media-workspace__input',attr:{rows:'5',maxlength:'20000','aria-label':'摘录 Markdown 正文',placeholder:'这段内容带来了什么想法？\n支持 Markdown，输入时固定当前时间点。'}});
  this.draftAttachment=composer.createDiv('ts-media-workspace__attachment');this.draftAttachment.hidden=true;
  this.draftImage=this.draftAttachment.createEl('button',{cls:'ts-media-workspace__draft-image',attr:{type:'button','aria-label':'放大当前截图'}});this.draftImage.hidden=true;
  this.draftImageEl=this.draftImage.createEl('img',{attr:{alt:'当前摘录的视频截图',decoding:'async'}});
  this.draftImage.onclick=()=>{const draft=this.memory?.draft;if(draft?.image)this.openPreview(draft.image,draft.time);};
  this.input.onfocus=()=>{if(this.memory&&!this.memory.editor&&!this.memory.pending&&!this.memory.draft?.locked){this.memory.editor=this.editorKey;broadcast(this.memory);}};
  this.input.onblur=()=>{if(this.memory&&!this.memory.draft&&!this.memory.pending&&!this.memory.capturePending)this.releaseEditor();};
  this.input.addEventListener('compositionstart',()=>{try{this.beginDraft(this.currentPlayback().time);this.composing=true;if(this.memory)broadcast(this.memory);}catch{this.paintComposer();}});
  this.input.addEventListener('compositionend',()=>{this.composing=false;this.updateDraftInput();});
  this.input.oninput=()=>this.updateDraftInput();
  this.input.onkeydown=event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!event.isComposing){event.preventDefault();event.stopPropagation();void this.saveDraft().catch(()=>{});}};
  const attachmentInfo=this.draftAttachment.createDiv('ts-media-workspace__attachment-info');
  attachmentInfo.createEl('strong',{text:'画面已附加'});
  this.imageLabel=attachmentInfo.createDiv('ts-media-workspace__image-label');
  const footer=composer.createDiv('ts-media-workspace__savebar');
  const saveMeta=footer.createDiv('ts-media-workspace__save-meta');
  this.saveTarget=saveMeta.createSpan('ts-media-workspace__save-target');this.draftStatus=saveMeta.createSpan({cls:'ts-media-workspace__draft-status',attr:{role:'status','aria-live':'polite'}});
  const actions=footer.createDiv('ts-media-workspace__composer-actions');
  actions.createSpan({cls:'ts-media-workspace__save-hint',text:'Ctrl / ⌘ + Enter 保存'});
  if(this.host.recoverDrafts)this.action(actions,'处理暂存草稿','history',()=>this.host.recoverDrafts?.(),true);
  this.clearButton=this.action(actions,'清空草稿','x',()=>this.clearDraft(),true);
  // saveDraft reports its specific retention/source error, as for the keyboard entry.
  this.saveButton=this.action(actions,'保存摘录','check',()=>this.saveDraft().catch(()=>{}));this.saveButton.addClass('mod-cta');
  const aside=desk.createDiv('ts-media-workspace__records'),recordHeader=aside.createDiv('ts-media-workspace__records-heading');
  const recordName=recordHeader.createDiv('ts-media-workspace__section-title');setIcon(recordName.createSpan(),'list-video');recordName.createEl('strong',{text:'时间轴'});
  this.timelineCount=recordName.createSpan('ts-media-workspace__timeline-count');
  this.densityButton=this.action(recordHeader,'紧凑显示摘录','rows-3',()=>this.setRecordDensity(this.recordDensity==='compact'?'comfortable':'compact'),true);this.setRecordDensity(this.recordDensity);
  this.openNoteButton=this.action(recordHeader,'打开 Markdown 笔记','file-text',()=>this.note&&this.host.openNote(this.note),true);
  const searchRow=aside.createDiv('ts-media-workspace__search-row');setIcon(searchRow.createSpan(),'search');
  const search=this.searchInput=searchRow.createEl('input',{cls:'ts-media-workspace__search',type:'search',attr:{placeholder:'搜索摘录或时间','aria-label':'搜索全部摘录'}});
  search.oninput=()=>{this.query=search.value;this.limit=50;this.pageStart=0;this.renderTimeline();};
  this.clearSearchButton=this.action(searchRow,'清空搜索','x',()=>this.clearSearch(),true);
  const filters=aside.createDiv({cls:'ts-media-workspace__filters',attr:{role:'group','aria-label':'摘录类型'}});
  for(const[filter,label,icon]of [['all','全部','layers'],['text','文字','text'],['image','截图','image']]as const){const button=this.action(filters,label,icon,()=>this.setRecordFilter(filter));this.filterButtons.set(filter,button);button.setAttribute('aria-pressed',String(this.recordFilter===filter));}
  const navigation=aside.createDiv('ts-media-workspace__timeline-tools');
  this.action(navigation,'定位当前时间','locate-fixed',()=>this.locateMoment('current'));
  this.action(navigation,'最后一条','list-end',()=>this.locateMoment('last'));
  this.timeline=aside.createDiv('ts-media-workspace__timeline');
  const pagination=aside.createDiv({cls:'ts-media-workspace__pagination',attr:{role:'group','aria-label':'摘录翻页'}});
  this.previousPageButton=this.action(pagination,'前 50 条','chevron-left',()=>{this.pageStart=Math.max(0,this.pageStart-50);this.renderTimeline();this.timeline!.scrollTop=0;});
  this.pageInfo=pagination.createSpan({cls:'ts-media-workspace__page-info',attr:{'aria-live':'polite'}});
  this.nextPageButton=this.action(pagination,'后 50 条','chevron-right',()=>{this.pageStart+=50;this.renderTimeline();this.timeline!.scrollTop=0;});
  this.paintComposer();this.renderTimeline();
  const file=this.file,memory=this.memory!,generation=this.generation,captureToken=Symbol('media-frame');let reservedDraft:Draft|undefined;
  try{
   this.player=this.host.mount(playerHost,file,{initialState:{...memory.state},
    state:value=>{if(this.isCurrent(file,generation)){memory.state=playback(value,memory.state);this.paintComposer();this.highlightPlayback(memory.state.time);}},
    capture:async time=>{if(!this.isCurrent(file,generation))return;this.beginDraft(time);this.stashDraft();this.setRecordPanel('compose');this.setFocusPlayer(false);broadcast(memory);this.input?.focus();},
    frameCaptureState:(busy,time)=>{
     if(!busy){if(memory.capturePending===captureToken){memory.capturePending=undefined;reservedDraft=undefined;broadcast(memory);}return;}
     if(!this.isCurrent(file,generation)||memory.capturePending)throw Error('媒体或截图状态已变化');
     const draft=this.beginDraft(time);if(draft.image)throw Error('请先保存或清空当前截图');
     draft.time=time;reservedDraft=draft;memory.capturePending=captureToken;this.setRecordPanel('compose');this.setFocusPlayer(false);broadcast(memory);this.message('正在生成截图，文字可继续编辑，请稍候保存。');
    },
    frame:async(image,time)=>{if(!this.isCurrent(file,generation)||memory.capturePending!==captureToken||memory.draft!==reservedDraft)return;const draft=reservedDraft!;if(!matchesSource(file,draft.source)||draft.time!==time)throw Error('截图来源已变化');draft.image=image;this.stashDraft();broadcast(memory);this.input?.focus();this.message('画面已附到摘录，可补充文字后保存。');},
   });
   // Reparent the actual controls so loading/disabled states and handlers stay
   // owned by the mounted player. Capture belongs to the draft, not the viewer.
   for(const selector of ['.ts-media-card__capture','.ts-media-card__frame']){const button=playerHost.querySelector<HTMLElement>(selector);if(button)captureActions.append(button);}
   const more=playerHost.querySelector<HTMLElement>('.ts-media-card__more-toggle');if(more)playerHost.querySelector('.ts-media-card__transport')?.append(more);
   if(this.initialSeek!==undefined){this.player.seek(this.initialSeek);this.initialSeek=undefined;}
  }catch{this.message('播放器暂时无法打开，请重新选择媒体；已有摘录保持不变。');}
 }
 private setFocusPlayer(value:boolean){if(value&&this.compactPlayer)this.setCompactPlayer(false);this.focusPlayer=value;if(this.memory)this.memory.focusPlayer=value;this.paintFocus();this.app.workspace.requestSaveLayout();}
 private paintFocus(){
  this.contentEl.dataset.focusPlayer=String(this.focusPlayer);
  if(this.focusButton){const label=this.focusPlayer?'显示记录面板':'专注播放';this.focusButton.setAttribute('aria-label',label);this.focusButton.setAttribute('title',label);this.focusButton.setAttribute('aria-pressed',String(this.focusPlayer));setIcon(this.focusButton.children[0] as HTMLElement,this.focusPlayer?'minimize-2':'maximize-2');}
 }
 private isCurrent(file:TFile,generation=this.generation){return!this.closed&&this.generation===generation&&this.file===file&&matchesSource(file,this.sourceIdentity)&&this.app.vault.getAbstractFileByPath(file.path)===file;}
 private sourceChanged(){
  if(!this.file||this.closed||matchesSource(this.file,this.sourceIdentity))return;
  this.renderTitle();const state=this.getState();
  if(this.hasPendingDraft()){this.disposePlayer();this.paintComposer();this.message('媒体来源已更新，当前摘录仍保留；请先清空草稿后重新选择媒体。');return;}
  const sameContent=this.sourceIdentity?.mtime===this.file.stat.mtime&&this.sourceIdentity?.size===this.file.stat.size;
  if(!sameContent){state.time=0;state.playback={time:0,rate:state.playback?.rate||1,volume:state.playback?.volume??1};}
  void this.setState(state).catch(()=>this.message('媒体已更新，请重新选择媒体。'));
 }
 private claimEditor(){if(!this.memory||this.memory.editor&&this.memory.editor!==this.editorKey)return false;this.memory.editor=this.editorKey;return true;}
 private releaseEditor(){this.composing=false;if(this.memory?.editor===this.editorKey){this.memory.editor=undefined;broadcast(this.memory);}}
 private updateDraftInput(){
  if(!this.input||!this.file||!this.memory||this.memory.pending||this.memory.draft?.locked||!this.claimEditor())return;
  try{const draft=this.beginDraft(this.currentPlayback().time);draft.text=this.input.value;this.stashDraft();broadcast(this.memory);}catch{this.paintComposer();this.message('媒体来源已更新，当前摘录已保留，请重新选择媒体。');}
 }
 private stashDraft(){
  const draft=this.memory?.draft;if(!draft||!this.host.drafts)return;
  try{this.host.drafts.stage(draft);}catch{this.message('本机暂存失败，草稿仍在当前会话中，请保存摘录或复制文字。');new Notice('媒体草稿未能暂存到本机，请及时保存摘录或复制文字。',10000);}
 }
 private async clearDraft(){
  const memory=this.memory;if(!memory||memory.pending||memory.capturePending||memory.editor&&memory.editor!==this.editorKey)return;
  const draft=memory.draft;if(!draft)return;
  const job=this.host.drafts?.discard(draft.id);if(job){memory.pending=job;broadcast(memory);try{await job;}catch{this.message('无法删除本机暂存，草稿仍保留，请重试。');throw Error('暂存删除失败');}finally{if(memory.pending===job)memory.pending=undefined;broadcast(memory);}}
  if(memory.draft===draft)memory.draft=undefined;memory.editor=undefined;this.composing=false;broadcast(memory);this.message('草稿已清空。');this.sourceChanged();
 }
 private beginDraft(time:number):Draft {
  if(!this.file||!this.isCurrent(this.file)||!this.memory||this.memory.pending||this.memory.draft?.locked||!this.claimEditor())throw Error('请先完成或清空当前摘录');
  if(this.host.drafts?.pendingFor(this.file.path))throw Error('请先恢复或丢弃此媒体的暂存草稿');
  if(!validMediaTime(time))throw Error('媒体时间无效');
  if(this.memory.draft&&!matchesSource(this.file,this.memory.draft.source))throw Error('媒体来源已更新，当前摘录已保留');
  return this.memory.draft??={id:crypto.randomUUID(),time,text:'',source:{...this.sourceIdentity!}};
 }
 private paintComposer(){
  if(!this.input)return;
  const draft=this.memory?.draft,pending=!!this.memory?.pending,capturing=!!this.memory?.capturePending,elsewhere=!!this.memory?.editor&&this.memory.editor!==this.editorKey,stale=!!this.file&&(!this.isCurrent(this.file)||!!draft&&!matchesSource(this.file,draft.source));
  if(!this.composing&&this.input.value!==(draft?.text||''))this.input.value=draft?.text||'';
  const recovery=!!this.file&&!!this.host.drafts?.pendingFor(this.file.path);
  if(this.recoveryButton)this.recoveryButton.hidden=!recovery;
  if(recovery)this.message('此媒体有未保存的本机草稿');
  else if(this.recoveryPrompt)this.message(stale?'媒体来源已变化，恢复内容仅供查看或复制；请清空后重新选择媒体。':'本机暂存已处理；恢复的摘录仍需显式保存。');
  this.recoveryPrompt=recovery;
  this.input.readOnly=recovery||pending||!!draft?.locked||elsewhere||stale;
  this.input.setAttribute('aria-description',elsewhere?'此媒体的草稿正在另一个窗口编辑。':'');
  if(this.timeLabel){this.timeLabel.textContent=(draft?'摘录 ':'播放 ')+mediaClock(draft?.time??this.currentPlayback().time);this.timeLabel.dataset.fixed=String(!!draft);this.timeLabel.title=draft?'本条摘录的固定时间点':'输入时固定当前时间点';}
  const localState=draft?this.host.drafts?.state(draft.id):undefined;
  if(this.draftStatus){this.draftStatus.textContent=recovery?'待恢复 / 丢弃':pending?'正在保存…':localState==='error'?'暂存失败 · 请重试保存':localState==='pending'?'正在暂存到本机…':draft?(localState==='saved'?'已暂存本机 · 尚未写入笔记':'尚未保存'):'开始输入以创建摘录';this.draftStatus.dataset.state=localState||'empty';}
  if(this.saveTarget){this.saveTarget.textContent=this.note?`保存到 ${this.note.basename}.md`:'保存时创建媒体 Markdown 笔记';this.saveTarget.title=this.note?.path||'首次保存时创建媒体笔记';}
  if(this.inputCount)this.inputCount.textContent=draft?.text?`${draft.text.length.toLocaleString()} 字符`:'';
  if(this.panelButtons.get('compose'))this.panelButtons.get('compose')!.dataset.hasDraft=String(!!draft);
  this.paintDraftImage(draft?.image);
  if(this.draftAttachment)this.draftAttachment.hidden=!draft?.image;
  if(this.imageLabel){this.imageLabel.textContent=draft?.image?(this.previewUrl?'点击缩略图预览 · 随摘录保存':'截图将随摘录保存'):'';this.imageLabel.hidden=!draft?.image;}
  if(this.clearButton)this.clearButton.disabled=pending||capturing||elsewhere||!draft;
  if(this.saveButton){this.saveButton.disabled=pending||capturing||elsewhere||stale||!draft;this.saveButton.setAttribute('aria-busy',String(pending||capturing));}
 }
 private async saveDraft(){
  const file=this.file,memory=this.memory,draft=memory?.draft;
  if(!file||!memory||!draft||memory.pending||memory.capturePending||this.composing||!this.claimEditor())return;
  if(!this.isCurrent(file)||!matchesSource(file,draft.source)){this.message('媒体来源已更新，摘录未保存；文字和截图仍保留。');throw Error('媒体文件已变化，摘录尚未保存');}
  // Once a save has started, retries must carry exactly the same id and data.
  // A failed receipt may still correspond to a committed Markdown entry.
  draft.locked=true;
  const data={id:draft.id,time:draft.time,text:draft.text,source:{...draft.source},...(draft.image?{image:draft.image}:{})};
  const job=Promise.resolve().then(async()=>{if(this.host.drafts){this.host.drafts.stage(draft);await this.host.drafts.flush();}if(!matchesSource(file,data.source)||this.app.vault.getAbstractFileByPath(data.source.path)!==file)throw Error('媒体来源已变化');return this.host.saveMoment(file,data);});
  memory.pending=job;broadcast(memory);this.message('正在保存摘录…');
  try{
   const result=await job;
   if(this.host.drafts)await this.host.drafts.discard(draft.id);
   if(memory.draft===draft){memory.draft=undefined;memory.editor=undefined;}
   if(this.isCurrent(file)){this.note=result.note;this.message('摘录已保存到 Markdown 笔记。');}
  }catch(error){if(this.isCurrent(file))this.message('保存未完成，文字、截图与记录时间已保留，可重试。');throw error;}
  finally{if(memory.pending===job)memory.pending=undefined;broadcast(memory,true);}
 }
 private pickExternal(){if(!this.canMove()||!this.host.pickExternal)return;const generation=this.generation;this.host.pickExternal(file=>{if(this.closed||generation!==this.generation||!this.canMove())return;return this.host.open(file,this.placement);});}
 private pick(){if(!this.canMove())return;const generation=this.generation;this.host.pick(file=>{if(this.closed||generation!==this.generation||!this.canMove())return;void this.host.open(file,this.placement).catch(()=>this.message('暂时无法切换媒体，请重试。'));});}
 private async move(placement:MediaPlacement){if(this.busy||placement===this.placement||!this.canMove())return;this.busy=true;try{await this.host.open(this.file,placement,this.currentPlayback().time);}finally{this.busy=false;}}
 private cancelRefresh(){if(this.refreshTimer!==undefined)this.refreshWindow?.clearTimeout(this.refreshTimer);this.refreshTimer=undefined;this.refreshWindow=undefined;}
 private scheduleRefresh(){this.cancelRefresh();this.timelineRun++;const owner=this.contentEl.ownerDocument.defaultView;if(this.closed||!owner)return;this.refreshWindow=owner;this.refreshTimer=owner.setTimeout(()=>{this.refreshTimer=undefined;this.refreshWindow=undefined;void this.refreshMoments();},100);}
 private async refreshMoments(){
  const file=this.file,generation=this.generation,run=++this.timelineRun;if(!file||this.closed)return;
  this.timeline?.setAttribute('aria-busy','true');
  try{
   const result=await this.host.moments(file);
   if(!this.isCurrent(file,generation)||run!==this.timelineRun)return;
   this.note=result.note;this.entries=result.entries;this.renderTimeline();this.paintComposer();if(result.warnings?.length)this.message(result.warnings.join(' '));
  }catch{if(this.isCurrent(file,generation)&&run===this.timelineRun)this.message('暂时无法读取时间轴；当前播放和草稿不受影响。');}
  finally{if(this.isCurrent(file,generation)&&run===this.timelineRun)this.timeline?.removeAttribute('aria-busy');}
 }
 private renderTimeline(){
  if(!this.timeline)return;
  const el=this.timeline,scroll=el.scrollTop;el.empty();
  if(this.openNoteButton)this.openNoteButton.disabled=!this.note;
  const rows=this.filteredEntries();this.timelineOrder=[...rows].sort((a,b)=>a.time-b.time);this.renderedMoments.clear();
  this.limit=50;this.pageStart=Math.max(0,Math.min(this.pageStart,Math.max(0,Math.ceil(rows.length/50)-1)*50));
  if(this.pageInfo)this.pageInfo.textContent=rows.length?`${this.pageStart+1}–${Math.min(rows.length,this.pageStart+50)} / ${rows.length}`:'0 条摘录';
  if(this.previousPageButton)this.previousPageButton.disabled=this.pageStart===0;
  if(this.nextPageButton)this.nextPageButton.disabled=this.pageStart+50>=rows.length;
  if(this.panelCount)this.panelCount.textContent=String(this.entries.length);
  if(this.timelineCount){this.timelineCount.textContent=String(rows.length);this.timelineCount.title=`共 ${this.entries.length} 条摘录`;}
  if(this.clearSearchButton)this.clearSearchButton.disabled=!this.query;
  el.dataset.filtered=String(!!this.query||this.recordFilter!=='all');
  if(!rows.length){el.createDiv({cls:'ts-media-workspace__no-records',text:this.query?'没有找到这条摘录，试试其他文字或时间。':this.recordFilter!=='all'?'还没有这一类摘录。':'还没有摘录。播放时记下一个时间点，它会留在这里。'});return;}
  for(const entry of rows.slice(this.pageStart,this.pageStart+50)){
   const file=this.file!,generation=this.generation,row=el.createDiv('ts-media-workspace__moment');
   const key=this.momentKey(entry),expanded=this.expandedRecords.has(key);this.renderedMoments.set(key,{entry,row});
   row.dataset.expanded=String(expanded);
   row.dataset.detailed=String(!!entry.image||entry.text.length>60||entry.text.includes('\n')||entry.time>=3600);
   const rail=row.createDiv('ts-media-workspace__moment-rail');
   const jump=this.action(rail,mediaClock(entry.time),'play',()=>{if(this.isCurrent(file,generation)){this.player?.seek(entry.time);this.memory!.state.time=entry.time;this.paintComposer();this.highlightPlayback(entry.time);}});jump.addClass('ts-media-workspace__moment-time');
   const body=row.createDiv('ts-media-workspace__moment-body');
   const path=mediaPreviewPath(entry.image),asset=path&&this.app.vault.getAbstractFileByPath(path);
   if(asset instanceof TFile&&asset.stat.size<=25*1024*1024){
    const preview=body.createEl('button',{cls:'ts-media-workspace__moment-preview',attr:{type:'button','aria-label':`放大 ${mediaClock(entry.time)} 截图`}});
    const img=preview.createEl('img',{attr:{src:this.app.vault.getResourcePath(asset),alt:`${mediaClock(entry.time)} 视频截图`,loading:'lazy',decoding:'async'}});
    img.onerror=()=>{preview.hidden=true;};preview.onclick=()=>{if(this.isCurrent(file,generation))this.openPreview(asset,entry.time);};
   }
   const text=body.createDiv('ts-media-workspace__moment-text');text.textContent=entry.text||(entry.image?'画面摘录':'时间点');
   const footer=row.createDiv('ts-media-workspace__moment-footer');
   if(entry.image){const badge=footer.createSpan('ts-media-workspace__moment-image');setIcon(badge.createSpan(),'image');badge.createSpan({text:'含截图'});}
   if(entry.text.trim()){const toggle=this.action(footer,expanded?'收起摘录':'展开摘录',expanded?'chevron-up':'chevron-down',()=>{if(this.expandedRecords.has(key))this.expandedRecords.delete(key);else this.expandedRecords.add(key);row.dataset.expanded=String(this.expandedRecords.has(key));const label=this.expandedRecords.has(key)?'收起摘录':'展开摘录';toggle.setAttribute('aria-label',label);toggle.title=label;(toggle.children[1] as HTMLElement).textContent=label;toggle.setAttribute('aria-expanded',String(this.expandedRecords.has(key)));setIcon(toggle.children[0] as HTMLElement,this.expandedRecords.has(key)?'chevron-up':'chevron-down');});toggle.setAttribute('aria-expanded',String(expanded));}
   this.action(footer,'将这条摘录送到白板','arrow-up-right',()=>this.isCurrent(file,generation)&&this.host.sendToBoard(file,entry),true);
  }
  this.highlightPlayback(this.currentPlayback().time);el.scrollTop=scroll;
 }
 private disposePlayer(){const player=this.player;try{if(player&&this.memory)this.memory.state=playback(player.getState?.(),this.memory.state);}finally{this.player=undefined;player?.dispose();}}
 async onClose(){
  if(this.closed)return;
  this.contextMenu?.hide();this.contextMenu=undefined;
  try{this.disposePlayer();}finally{
   this.releasePreview();this.closePreviews();this.unsubscribe?.();this.unsubscribe=undefined;this.unsubscribeDrafts?.();this.unsubscribeDrafts=undefined;this.releaseEditor();this.closed=true;this.generation++;this.timelineRun++;this.cancelRefresh();
   if(this.memory?.draft){
    try{if(this.host.drafts){this.host.drafts.stage(this.memory.draft);await this.host.drafts.flush();new Notice('未保存的媒体摘录已暂存到本机，重启后可选择恢复。');}else new Notice('未保存的媒体摘录已保留在本次会话中，重启前请保存。');}
    catch{new Notice('本机暂存失败，草稿仅保留在当前会话，请重新打开并保存。',10000);}
   }
   this.timelineOrder=[];this.renderedMoments.clear();this.contentEl.onpointerdown=null;this.contentEl.empty();this.containerEl.removeClass('ts-media-workspace-leaf');
  }
 }
}

class MediaImagePreview extends Modal {
 private released=false;
 constructor(app:App,private src:string,private caption:string,private done:()=>void){super(app);}
 onOpen(){this.modalEl.addClass('ts-media-image-modal');this.contentEl.createEl('img',{cls:'ts-media-image-modal__image',attr:{src:this.src,alt:this.caption}});this.contentEl.createDiv({cls:'ts-media-image-modal__caption',text:this.caption});}
 onClose(){this.contentEl.empty();if(!this.released){this.released=true;this.done();}}
}
