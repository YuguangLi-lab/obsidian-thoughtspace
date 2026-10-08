import {Component,ItemView,MarkdownRenderer,Notice,TFile,WorkspaceLeaf,setIcon,type ViewStateResult} from 'obsidian';
import {applyWorkspaceDensity} from './workspace-density';
import type {MediaMoment} from './media-notes';
import {mediaClock,parseMediaTime,validMediaTime} from './media-source';
import type {MediaPlacement} from './media-workspace-view';
import {parseOnlineSource,type OnlineState,type OnlineAction,type OnlineSource} from './online-platform';

export const ONLINE_WORKSPACE='thoughtspace-online-player';
export interface OnlineWorkspaceHost {
 accent?():string;
 density?():string;
 pick(placement:MediaPlacement):void;
 mount(host:HTMLElement,source:string):()=>void;
 open(source:string,placement:MediaPlacement,time?:number,note?:string):Promise<unknown>;
 state():OnlineState|undefined;
 subscribe(fn:(state:OnlineState)=>void):()=>void;
 command(source:string,action:OnlineAction,value?:number):Promise<unknown>;
 capture(source:string):Promise<{blob:Blob;time:number}>;
 adopt(source:string,placement:MediaPlacement):Promise<unknown>;
 notes(source:string,note?:string):Promise<{note?:TFile;entries:MediaMoment[]}>;
 save(source:string,data:{id:string;time:number;text:string;image?:Blob},note?:string):Promise<{note:TFile}>;
 send(source:string,time?:number,text?:string,image?:string):Promise<unknown>;
 openNote(file:TFile):Promise<unknown>;
}
export interface OnlineWorkspaceState extends Record<string,unknown>{source?:string;note?:string;placement?:MediaPlacement;time?:number}
interface Draft {id:string;time:number;text:string;mode:'synced'|'manual';image?:Blob;locked?:boolean}
interface Capture {owner:symbol;source:string;invalid:boolean}
interface Memory {draft?:Draft;manualTime?:number;pending?:symbol;capture?:Capture;editor?:symbol;note?:TFile;listeners:Set<(refresh:boolean)=>void>}
const memories=new WeakMap<OnlineWorkspaceHost,Map<string,Memory>>();
function memoryFor(host:OnlineWorkspaceHost,source:string,note?:string):Memory {
 let entries=memories.get(host);if(!entries){entries=new Map();memories.set(host,entries);}
 const key=JSON.stringify([source,note||'']);let memory=entries.get(key);
 if(!memory){memory={listeners:new Set()};entries.set(key,memory);}return memory;
}
const notify=(memory:Memory,refresh=false)=>{for(const fn of memory.listeners)fn(refresh);};
// Older platform WebViews report composition with legacy key code 229.
const compositionKey=(event:{isComposing:boolean;keyCode?:number})=>event.isComposing||event.keyCode===229;
const errorText=(error:unknown)=>{
 const value=error instanceof Error?error.message:typeof error==='string'?error:'';
 return Array.from(value,char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127?' ':char).join('').replace(/\s+/g,' ').trim().slice(0,400)||'请稍后重试';
};
function rememberNote(host:OnlineWorkspaceHost,source:string,memory:Memory,note?:TFile){
 memory.note=note;if(!note)return;
 const entries=memories.get(host),key=JSON.stringify([source,note.path]),existing=entries?.get(key);
 if(!existing||existing===memory)entries?.set(key,memory);
}
function notePath(value:unknown):string|undefined {
 if(typeof value!=='string'||value.length>8192||!value.endsWith('.md')||value.trim()!==value||/[\\\r\n]/.test(value)||value.startsWith('/')||/^[a-z][a-z\d+.-]*:/i.test(value))return;
 if(value.split('/').some(part=>!part||part==='.'||part==='..')||Array.from(value).some(char=>char.charCodeAt(0)<32))return;
 return value;
}

/** The official platform owns the video; this view owns notes and explicit controls. */
export class OnlineWorkspaceView extends ItemView {
 private source?:OnlineSource;
 private note?:string;
 private placement:MediaPlacement='tab';
 private requestedTime?:number;
 private memory?:Memory;
 private live?:OnlineState;
 private entries:MediaMoment[]=[];
 private generation=0;
 private timelineRun=0;
 private page=0;
 private opened=false;
 private closed=false;
 private composing=false;
 private subscription?:()=>void;
 private releaseMemory?:()=>void;
 private releaseMount?:()=>void;
 private readonly editor=Symbol('online-workspace-editor');
 private input?:HTMLTextAreaElement;
 private status?:HTMLElement;
 private connection?:HTMLElement;
 private playerError?:HTMLElement;
 private loadButton?:HTMLButtonElement;
 private timeLabel?:HTMLElement;
 private draftTime?:HTMLElement;
 private candidateBox?:HTMLElement;
 private candidateLabel?:HTMLElement;
 private adoptButton?:HTMLButtonElement;
 private playButton?:HTMLButtonElement;
 private backButton?:HTMLButtonElement;
 private forwardButton?:HTMLButtonElement;
 private rate?:HTMLSelectElement;
 private seek?:HTMLInputElement;
 private seekButton?:HTMLButtonElement;
 private manual?:HTMLInputElement;
 private manualFallback?:HTMLDetailsElement;
 private confirmButton?:HTMLButtonElement;
 private timestampButton?:HTMLButtonElement;
 private captureButton?:HTMLButtonElement;
 private imageBox?:HTMLElement;
 private imageEl?:HTMLImageElement;
 private imageLabel?:HTMLElement;
 private removeImageButton?:HTMLButtonElement;
 private previewBlob?:Blob;
 private previewUrl?:string;
 private previewUrlAPI?:typeof URL;
 private saveButton?:HTMLButtonElement;
 private clearButton?:HTMLButtonElement;
 private noteButton?:HTMLButtonElement;
 private timeline?:HTMLElement;
 private timelineScope?:Component;
 private count?:HTMLElement;
 private pageLabel?:HTMLElement;
 private previousButton?:HTMLButtonElement;
 private nextButton?:HTMLButtonElement;
 private positionButtons=new Map<MediaPlacement,HTMLButtonElement>();

 constructor(leaf:WorkspaceLeaf,private host:OnlineWorkspaceHost){super(leaf);}
 applyPreferences(){applyWorkspaceDensity(this.contentEl,this.host.density?.());this.contentEl.dataset.accent=this.host.accent?.()||'forest';}
 getViewType(){return ONLINE_WORKSPACE;}
 getDisplayText(){return this.source?`${this.source.name} · 在线视频笔记`:'在线视频笔记';}
 getIcon(){return 'clapperboard';}
 currentSource(){return this.source;}
 currentNote(){return this.memory?.note?.path||this.note;}
 private verified():OnlineState|undefined {
  const state=this.live;
  return this.source&&state?.available&&!state.closed&&state.sourcePath===this.source.path&&state.status!=='source-changed'&&(!state.candidate||state.candidate.path===this.source.path)&&validMediaTime(state.time)?state:undefined;
 }
 getState():OnlineWorkspaceState {
  const time=this.verified()?.time;
  return {source:this.source?.path,note:this.currentNote(),placement:this.placement,...(time!==undefined?{time}:{})};
 }
 canMove(){
  if(this.memory?.capture){new Notice('截图处理中，请稍候再切换视频或工作区位置');return false;}
  if(this.memory?.draft||this.memory?.pending){new Notice('请先保存或取消当前摘录，再切换视频或工作区位置');return false;}
  return !this.closed;
 }
 async onOpen(){
  if(this.opened||this.closed)return;this.opened=true;
  this.subscription=this.host.subscribe(state=>{if(this.closed)return;this.live=state;this.invalidateCapture();this.paintPlayback();this.paintComposer();});
  this.live=this.host.state();if(!this.input)this.render();else{this.paintPlayback();this.paintComposer();}
 }
 async setState(state:OnlineWorkspaceState,result?:ViewStateResult){
  if(this.closed)return;
  const source=typeof state.source==='string'?parseOnlineSource(state.source):undefined;
  const note=state.note===undefined&&source?.path===this.source?.path?this.currentNote():notePath(state.note),placement=state.placement==='sidebar'||state.placement==='window'?state.placement:'tab';
  if(state.source&&!source){this.message('视频链接无效，请重新选择。');return;}
  if(state.note&&!note){this.message('摘录笔记路径无效，请重新选择。');return;}
  const same=source?.path===this.source?.path&&(note||'')===(this.currentNote()||'');
  if((!same||placement!==this.placement)&&!this.canMove())return;
  if(same&&this.memory){
   this.placement=placement;this.requestedTime=validMediaTime(state.time)?state.time:this.requestedTime;
   this.contentEl.dataset.placement=placement;this.paintPositions();this.live=this.host.state();this.invalidateCapture();this.paintPlayback();this.paintComposer();
   this.app.workspace.requestSaveLayout();if(result)result.history=true;return;
  }
  this.release();this.generation++;this.timelineRun++;this.source=source;this.note=note;this.placement=placement;
  this.requestedTime=validMediaTime(state.time)?state.time:source?.initialTime;this.entries=[];this.page=0;
  this.memory=source?memoryFor(this.host,source.path,note):undefined;
  if(this.memory){
   const owned=this.memory,listener=(refresh:boolean)=>{if(this.closed||this.memory!==owned)return;this.paintComposer();if(refresh)void this.refreshNotes();};
   owned.listeners.add(listener);this.releaseMemory=()=>owned.listeners.delete(listener);
  }
  this.live=this.host.state();this.render();this.app.workspace.requestSaveLayout();if(result)result.history=true;
  await this.refreshNotes();
 }
 private release(){
  this.releasePlayer();this.releasePreview();this.releaseTimeline();if(this.memory?.capture?.owner===this.editor)this.memory.capture.invalid=true;
  this.releaseMemory?.();this.releaseMemory=undefined;
  if(this.memory?.editor===this.editor){this.memory.editor=undefined;notify(this.memory);}
 }
 private action(parent:HTMLElement,label:string,icon:string,run:()=>unknown,compact=false){
  const generation=this.generation;
  const button=parent.createEl('button',{cls:'ts-online-workspace__action',attr:{type:'button','aria-label':label,title:label}});
  setIcon(button.createSpan(),icon);if(!compact)button.createSpan({text:label});
  const failed=(error:unknown)=>{if(this.generation===generation)this.failure(label,error);};
  button.onclick=()=>{if(this.closed||this.generation!==generation)return;try{void Promise.resolve(run()).catch(failed);}catch(error){failed(error);}};return button;
 }
 private message(value:string){if(!this.closed&&this.status)this.status.textContent=value;}
 private failure(action:string,error:unknown){console.error(`[ThoughtSpace online] ${action}`,error);this.message(`${action}失败：${errorText(error)}；当前摘录仍保留。`);}
 private releasePlayer(){const release=this.releaseMount;this.releaseMount=undefined;try{release?.();}catch(error){this.failure('关闭播放器',error);}}
 private render(){
  const generation=this.generation,current=()=>!this.closed&&this.generation===generation;
  this.releasePlayer();this.releasePreview();this.releaseTimeline();
  const root=this.contentEl;root.empty();root.addClass('ts-online-workspace');this.applyPreferences();root.dataset.placement=this.placement;this.positionButtons.clear();
  const header=root.createDiv('ts-online-workspace__header'),heading=header.createDiv('ts-online-workspace__heading');
  heading.createEl('strong',{cls:'ts-online-workspace__title',text:this.source?.name||'在线视频笔记'});
  heading.createSpan({cls:'ts-online-workspace__source',text:this.source?.path||'选择视频，开始记录',attr:{title:this.source?.path||''}});
  this.action(header,'选择视频','folder-open',()=>{if(this.canMove())this.host.pick(this.placement);},true);
  const positions=root.createDiv('ts-online-workspace__positions');
  for(const [placement,label,icon]of [['tab','主页面','panel-top'],['sidebar','右侧栏','panel-right'],['window','独立窗口','picture-in-picture-2']]as const)this.positionButtons.set(placement,this.action(positions,label,icon,()=>this.move(placement)));
  const layout=root.createDiv('ts-online-workspace__layout'),player=layout.createDiv('ts-online-workspace__player');
  const playerHeading=player.createDiv('ts-online-workspace__section-heading');playerHeading.createEl('strong',{text:'视频播放器'});
  this.connection=playerHeading.createSpan({cls:'ts-online-workspace__connection'});
  this.loadButton=this.action(playerHeading,'加载视频 / 重试','refresh-cw',()=>this.openPlatform(),true);
  const embed=player.createDiv({cls:'ts-online-workspace__embed',attr:{'aria-label':'在线视频播放器'}});
  if(!this.source)embed.createDiv({cls:'ts-online-workspace__empty',text:'选择一个视频开始播放'});
  this.playerError=player.createDiv({cls:'ts-online-workspace__player-error',attr:{role:'status','aria-live':'polite'}});
  this.candidateBox=player.createDiv('ts-online-workspace__candidate');this.candidateLabel=this.candidateBox.createSpan();
  this.adoptButton=this.action(this.candidateBox,'切换到当前视频','arrow-right-left',()=>this.adopt());
  const transport=player.createDiv('ts-online-workspace__transport');
  this.backButton=this.action(transport,'后退 10 秒','rotate-ccw',()=>this.seekBy(-10),true);
  this.playButton=this.action(transport,'播放或暂停','play',()=>this.command('toggle'),true);
  this.forwardButton=this.action(transport,'前进 10 秒','rotate-cw',()=>this.seekBy(10),true);
  this.timeLabel=transport.createSpan({cls:'ts-online-workspace__clock'});
  this.rate=transport.createEl('select',{attr:{'aria-label':'播放速度',title:'播放速度'}});
  for(const value of [.5,.75,1,1.25,1.5,1.75,2])this.rate.createEl('option',{text:`${value} 倍`,value:String(value)});
  this.rate.onchange=()=>{if(current()&&this.rate)void this.command('rate',Number(this.rate.value)).catch(error=>{if(current())this.failure('调整播放速度',error);});};
  const seekRow=player.createDiv('ts-online-workspace__time-row');
  this.seek=seekRow.createEl('input',{type:'text',attr:{'aria-label':'跳转时间',placeholder:'分:秒，例如 12:30',inputmode:'decimal'}});
  this.seekButton=this.action(seekRow,'跳转','corner-down-right',()=>this.seekTo());
  const composer=layout.createDiv('ts-online-workspace__composer'),composerHeading=composer.createDiv('ts-online-workspace__section-heading');
  composerHeading.createEl('strong',{text:'记录摘录'});this.draftTime=composerHeading.createSpan({cls:'ts-online-workspace__draft-time'});
  const captureActions=composer.createDiv('ts-online-workspace__capture-actions');
  this.timestampButton=this.action(captureActions,'记下此刻','bookmark-plus',()=>this.rememberTimestamp());
  this.captureButton=this.action(captureActions,'快速截图','camera',()=>this.takeScreenshot());this.captureButton.title='截取平台中已加载的视频画面，并记录对应时间';
  this.manualFallback=composer.createEl('details',{cls:'ts-online-workspace__manual-fallback'});
  this.manualFallback.createEl('summary',{text:'手动时间（备用）'});
  const manualRow=this.manualFallback.createDiv('ts-online-workspace__time-row');
  this.manual=manualRow.createEl('input',{type:'text',attr:{'aria-label':'手动摘录时间',placeholder:'未同步时，输入分:秒',inputmode:'decimal'}});
  this.confirmButton=this.action(manualRow,'确认时间','check',()=>this.confirmTime());
  this.imageBox=composer.createDiv('ts-online-workspace__draft-attachment');
  this.imageEl=this.imageBox.createEl('img',{cls:'ts-online-workspace__draft-image',attr:{alt:'当前摘录截图'}});
  this.imageLabel=this.imageBox.createSpan({cls:'ts-online-workspace__image-label'});
  this.removeImageButton=this.action(this.imageBox,'移除截图','image-minus',()=>this.removeScreenshot(),true);
  this.input=composer.createEl('textarea',{cls:'ts-online-workspace__input',attr:{'aria-label':'摘录内容',placeholder:'记录想法，支持 Markdown。首次输入时固定摘录时间。'}});
  this.composing=false;this.input.oninput=()=>{if(current())this.edit();};this.input.addEventListener('compositionstart',()=>{if(current())this.composing=true;});this.input.addEventListener('compositionend',()=>{if(current())this.composing=false;});
  this.input.onkeydown=event=>{if(current()&&(event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!compositionKey(event)&&!this.composing){event.preventDefault();void this.saveDraft().catch(error=>{if(current())this.failure('保存摘录',error);});}};
  const actions=composer.createDiv('ts-online-workspace__composer-actions');actions.createSpan({cls:'ts-online-workspace__hint',text:'⌘ / Ctrl + Enter 保存'});
  this.clearButton=this.action(actions,'取消摘录','x',()=>this.cancelDraft());this.saveButton=this.action(actions,'保存摘录','check',()=>this.saveDraft());this.saveButton.addClass('mod-cta');
  const records=layout.createDiv('ts-online-workspace__records'),recordsHeading=records.createDiv('ts-online-workspace__section-heading');
  recordsHeading.createEl('strong',{text:'摘录时间线'});this.count=recordsHeading.createSpan({cls:'ts-online-workspace__count'});
  this.noteButton=this.action(recordsHeading,'打开笔记','file-text',()=>this.openNote(),true);
  this.action(recordsHeading,'刷新摘录','refresh-cw',()=>this.refreshNotes(),true).disabled=!this.source;
  this.timeline=records.createDiv('ts-online-workspace__timeline');
  const pagination=records.createDiv('ts-online-workspace__pagination');
  this.previousButton=this.action(pagination,'上一页','chevron-left',()=>{if(this.page>0){this.page--;this.renderTimeline();}},true);
  this.pageLabel=pagination.createSpan();
  this.nextButton=this.action(pagination,'下一页','chevron-right',()=>{if((this.page+1)*50<this.entries.length){this.page++;this.renderTimeline();}},true);
  this.status=root.createDiv({cls:'ts-online-workspace__status',attr:{role:'status','aria-live':'polite'}});
  this.paintPositions();this.paintPlayback();this.paintComposer();this.renderTimeline();
  if(this.source)this.releaseMount=this.host.mount(embed,this.source.path);
 }
 private paintPositions(){for(const [placement,button]of this.positionButtons)button.setAttribute('aria-pressed',String(placement===this.placement));}
 private paintPlayback(){
  const state=this.verified(),candidate=this.candidate(),own=this.live?.sourcePath===this.source?.path?this.live:undefined;
  if(this.connection)this.connection.textContent=state?'时间已同步':own?.closed?'播放器已关闭':candidate?'视频已切换':own?.status==='loading'?'视频正在加载':own?.status==='error'||own?.status==='blocked'?'视频暂不可同步':'等待视频同步';
  if(this.playerError){const error=!state&&own?.error?errorText(own.error):'';this.playerError.textContent=error;this.playerError.hidden=!error;}
  if(this.timeLabel)this.timeLabel.textContent=state?`${mediaClock(state.time)}${validMediaTime(state.duration)&&state.duration>0?' / '+mediaClock(state.duration):''}`:'时间未同步';
  for(const button of [this.playButton,this.backButton,this.forwardButton,this.seekButton])if(button)button.disabled=!state;
  if(this.seek)this.seek.disabled=!state;
  if(this.rate){this.rate.disabled=!state;if(state&&Number.isFinite(state.rate)&&state.rate)this.rate.value=String(state.rate);}
  if(this.playButton){setIcon(this.playButton.children[0] as HTMLElement,state&&!state.paused?'pause':'play');this.playButton.setAttribute('aria-pressed',String(!!state&&!state.paused));}
  if(this.candidateBox)this.candidateBox.hidden=!candidate;
  if(this.candidateLabel)this.candidateLabel.textContent=candidate?`平台正在播放：${candidate.name}`:'';
  if(this.adoptButton)this.adoptButton.disabled=!candidate||!!(this.memory?.draft||this.memory?.pending||this.memory?.capture);
 }
 private candidate(){
  const candidate=this.live?.sourcePath===this.source?.path&&this.live?.candidate?parseOnlineSource(this.live.candidate.path):undefined;
  return candidate&&candidate.path!==this.source?.path?candidate:undefined;
 }
 private captureTime():{time:number;mode:'synced'|'manual'}|undefined {
  if(this.memory?.manualTime!==undefined)return {time:this.memory.manualTime,mode:'manual'};
  const state=this.verified();return state?{time:state.time,mode:'synced'}:undefined;
 }
 private paintComposer(){
  const memory=this.memory,draft=memory?.draft,pending=!!(memory?.pending||memory?.capture),other=!!memory?.editor&&memory.editor!==this.editor,time=draft||this.captureTime();
  if(this.input){if(this.input.value!==(draft?.text||''))this.input.value=draft?.text||'';this.input.readOnly=!memory||pending||other||!time||!!draft?.locked;}
  if(this.draftTime)this.draftTime.textContent=time?`${mediaClock(time.time)} · ${draft?(draft.mode==='manual'?'手动已固定':'已固定'):time.mode==='manual'?'手动已确认':'随播放同步'}`:'请先同步或确认时间';
  if(this.saveButton)this.saveButton.disabled=!draft||pending||other;
  if(this.clearButton)this.clearButton.disabled=!draft&&memory?.manualTime===undefined||pending||other;
  if(this.manual)this.manual.disabled=!memory||!!draft||pending||other||!!this.verified();
  if(this.manualFallback)this.manualFallback.hidden=!memory||!!this.verified();
  if(this.confirmButton)this.confirmButton.disabled=!memory||!!draft||pending||other||!!this.verified();
  if(this.timestampButton)this.timestampButton.disabled=!memory||!!draft||pending||other||!this.captureTime();
  if(this.captureButton){this.captureButton.disabled=!memory||pending||other||!!draft?.locked||!this.verified();this.captureButton.setAttribute('aria-busy',String(!!memory?.capture));}
  if(this.loadButton)this.loadButton.disabled=!this.source||pending;
  if(this.removeImageButton)this.removeImageButton.disabled=!draft?.image||pending||other||!!draft.locked;
  if(this.noteButton)this.noteButton.disabled=!memory?.note;
  if(this.adoptButton)this.adoptButton.disabled=!this.candidate()||!!draft||pending;
  this.paintImage();
 }
 private edit(){
  const memory=this.memory,input=this.input;if(this.closed||!memory||!input)return;
  if(memory.pending||memory.capture||memory.draft?.locked||memory.editor&&memory.editor!==this.editor){this.paintComposer();return;}
  if(!memory.draft){const time=this.captureTime();if(!time){this.paintComposer();this.message('请先同步平台时间，或输入并确认手动时间。');return;}if(!input.value)return;
   memory.draft={id:crypto.randomUUID(),time:time.time,text:input.value,mode:time.mode};
  }else memory.draft.text=input.value;
  memory.editor=this.editor;notify(memory);
 }
 private rememberTimestamp(){
  const memory=this.memory,time=this.captureTime();
  if(this.closed||!memory||!time||memory.draft||memory.pending||memory.capture||memory.editor&&memory.editor!==this.editor)return;
  memory.draft={id:crypto.randomUUID(),time:time.time,text:'',mode:time.mode};memory.editor=this.editor;
  notify(memory);this.message('时间戳已固定，可以直接保存，也可以继续填写摘录。');this.input?.focus();
 }
 private invalidateCapture(){
  const capture=this.memory?.capture;if(capture&&capture.source===this.source?.path&&!this.verified())capture.invalid=true;
 }
 private async takeScreenshot(){
  const source=this.source,memory=this.memory;
  if(this.closed||!source||!memory||!this.verified()||memory.pending||memory.capture||memory.draft?.locked||memory.editor&&memory.editor!==this.editor)return;
  const generation=this.generation,original=memory.draft,capture:Capture={owner:this.editor,source:source.path,invalid:false};
  memory.capture=capture;memory.editor=this.editor;notify(memory);this.message('正在截取已加载的视频画面…');
  try{
   const result=await this.host.capture(source.path);
   if(this.closed||this.generation!==generation||this.memory!==memory||this.source?.path!==source.path||memory.capture!==capture||memory.editor!==this.editor||memory.draft!==original)return;
   this.live=this.host.state();this.invalidateCapture();
   if(capture.invalid||!this.verified()){this.message('视频来源或播放状态已变化，请重新截图；原摘录仍保留。');return;}
   if(!validMediaTime(result.time)||result.time>864000||result.blob?.type!=='image/png'||!Number.isFinite(result.blob.size)||result.blob.size<=0||result.blob.size>20*1024*1024)throw Error('截图数据无效');
   memory.draft={id:original?.id||crypto.randomUUID(),time:result.time,text:original?.text||'',mode:'synced',image:result.blob};memory.manualTime=undefined;
   this.message('截图已加入草稿；可以直接保存，也可以补充文字。');this.input?.focus();
  }catch(error){if(!this.closed&&this.memory===memory&&this.generation===generation)this.failure('截图',error);}
  finally{
   if(memory.capture===capture){memory.capture=undefined;if(!memory.draft&&memory.editor===this.editor)memory.editor=undefined;notify(memory);}
  }
 }
 private removeScreenshot(){
  const memory=this.memory;
  if(this.closed||!memory?.draft?.image||memory.pending||memory.capture||memory.draft.locked||memory.editor&&memory.editor!==this.editor)return;
  memory.draft.image=undefined;memory.editor=this.editor;notify(memory);this.message('已移除截图，文字与时间戳仍保留。');
 }
 private releasePreview(){
  if(this.previewUrl){try{this.previewUrlAPI?.revokeObjectURL(this.previewUrl);}catch{/* Its owning window may already be closed. */}}
  this.previewUrl=undefined;this.previewBlob=undefined;this.previewUrlAPI=undefined;this.imageEl?.removeAttribute('src');
 }
 private paintImage(){
  const image=this.memory?.draft?.image;if(this.imageBox)this.imageBox.hidden=!image;
  if(!image){this.releasePreview();return;}
  if(this.previewBlob===image)return;
  this.releasePreview();this.previewBlob=image;
  try{
   const api=this.contentEl.ownerDocument.defaultView?.URL;if(!api)throw Error('预览不可用');
   this.previewUrl=api.createObjectURL(image);this.previewUrlAPI=api;this.imageEl?.setAttribute('src',this.previewUrl);
   if(this.imageEl)this.imageEl.hidden=false;if(this.imageLabel)this.imageLabel.textContent='截图已加入此摘录';
  }catch{if(this.imageEl)this.imageEl.hidden=true;if(this.imageLabel)this.imageLabel.textContent='截图已保留，预览暂不可用；可以直接保存';}
 }
 private confirmTime(){
  const memory=this.memory;if(this.closed||!memory||this.verified()||memory.pending||memory.capture||memory.draft||memory.editor&&memory.editor!==this.editor)return;
  const time=parseMediaTime(this.manual?.value||'');if(time===undefined){this.message('请输入有效时间，例如 90 或 1:30。');return;}
  memory.manualTime=time;notify(memory);this.message(`已确认手动时间 ${mediaClock(time)}；首次输入后固定。`);this.input?.focus();
 }
 private cancelDraft(){
  const memory=this.memory;if(this.closed||!memory||memory.pending||memory.capture||memory.editor&&memory.editor!==this.editor)return;
  memory.draft=undefined;memory.manualTime=undefined;memory.editor=undefined;if(this.manual)this.manual.value='';notify(memory);this.message('已取消当前摘录。');
 }
 private async saveDraft(){
  const source=this.source,memory=this.memory,draft=memory?.draft;
  if(this.closed||!source||!memory||!draft||memory.pending||memory.capture||memory.editor&&memory.editor!==this.editor)return;
  memory.editor=this.editor;draft.locked=true;const pending=Symbol('online-note-save');memory.pending=pending;notify(memory);this.message('正在保存摘录…');
  try{
   const result=await this.host.save(source.path,{id:draft.id,time:draft.time,text:draft.text,...(draft.image?{image:draft.image}:{})},this.currentNote());
   if(memory.pending!==pending)return;
   rememberNote(this.host,source.path,memory,result.note);if(memory.draft===draft){memory.draft=undefined;memory.manualTime=undefined;memory.editor=undefined;}
   if(!this.closed&&this.memory===memory){this.note=result.note.path;this.message('摘录已保存。');this.app.workspace.requestSaveLayout();}
   notify(memory,true);
  }catch(error){if(!this.closed&&this.memory===memory)this.failure('保存摘录',error);}
  finally{if(memory.pending===pending){memory.pending=undefined;notify(memory);}}
 }
 private async refreshNotes(){
  const source=this.source,memory=this.memory;if(!source||!memory||this.closed)return;
  const generation=this.generation,run=++this.timelineRun;
  try{const result=await this.host.notes(source.path,this.currentNote());
   if(this.closed||this.generation!==generation||this.timelineRun!==run||this.memory!==memory)return;
   rememberNote(this.host,source.path,memory,result.note);this.entries=result.entries.filter(entry=>typeof entry.id==='string'&&validMediaTime(entry.time)&&typeof entry.text==='string').sort((a,b)=>a.time-b.time);
   this.paintComposer();this.renderTimeline();
  }catch(error){if(!this.closed&&this.generation===generation&&this.timelineRun===run)this.failure('读取摘录',error);}
 }
 private renderTimeline(){
  this.releaseTimeline();if(!this.timeline)return;this.timeline.empty();const pages=Math.max(1,Math.ceil(this.entries.length/50));this.page=Math.min(this.page,pages-1);
  if(this.count)this.count.textContent=String(this.entries.length);
  if(this.pageLabel)this.pageLabel.textContent=`${this.page+1} / ${pages}`;
  if(this.previousButton)this.previousButton.disabled=this.page===0;
  if(this.nextButton)this.nextButton.disabled=this.page+1>=pages;
  if(!this.entries.length){this.timeline.createDiv({cls:'ts-online-workspace__empty',text:'还没有摘录。记录下第一条想法。'});return;}
  const source=this.source?.path,generation=this.generation;
  for(const entry of this.entries.slice(this.page*50,(this.page+1)*50)){
   const row=this.timeline.createDiv('ts-online-workspace__moment');
   this.action(row,mediaClock(entry.time),'play',()=>{if(source&&this.generation===generation)return this.host.open(source,this.placement,entry.time,this.currentNote());});
   const body=row.createDiv('ts-online-workspace__moment-body');body.createDiv({cls:'ts-online-workspace__moment-text',text:entry.text});
   if(entry.image){
    const image=body.createDiv({cls:'ts-online-workspace__moment-image',attr:{'aria-label':'已保存的摘录截图'}});
    if(!this.timelineScope){this.timelineScope=new Component();this.timelineScope.load();}const scope=this.timelineScope;
    void MarkdownRenderer.render(this.app,entry.image,image,this.currentNote()||'',scope).catch(()=>{if(!this.closed&&this.timelineScope===scope&&this.generation===generation)image.textContent='截图预览暂不可用，请打开笔记查看。';});
   }
   this.action(row,'发送到白板','panels-top-left',()=>{if(source&&this.generation===generation)return this.host.send(source,entry.time,entry.text,entry.image);},true);
  }
 }
 private releaseTimeline(){this.timelineScope?.unload();this.timelineScope=undefined;}
 private async openPlatform(){
  if(!this.source||this.memory?.pending||this.memory?.capture)return;
  if(this.live?.sourcePath===this.source.path&&!this.live.closed)await this.host.command(this.source.path,'reload');
  else await this.host.open(this.source.path,this.placement,this.verified()?.time??this.requestedTime??this.source.initialTime,this.currentNote());
 }
 private async openNote(){const note=this.memory?.note;if(note)await this.host.openNote(note);}
 private async move(placement:MediaPlacement){if(this.source&&this.canMove())await this.host.open(this.source.path,placement,this.verified()?.time,this.currentNote());}
 private async adopt(){const candidate=this.candidate();if(candidate&&this.canMove())await this.host.adopt(candidate.path,this.placement);}
 private async command(action:OnlineAction,value?:number){if(this.source&&this.verified())await this.host.command(this.source.path,action,value);}
 private async seekBy(delta:number){const state=this.verified();if(!state)return;await this.command('seek',Math.max(0,Math.min(validMediaTime(state.duration)&&state.duration>0?state.duration:100000000,state.time+delta)));}
 private async seekTo(){const time=parseMediaTime(this.seek?.value||'');if(time===undefined){this.message('请输入有效的跳转时间。');return;}await this.command('seek',time);}
 async onClose(){if(this.closed)return;this.closed=true;this.generation++;this.timelineRun++;this.subscription?.();this.subscription=undefined;this.release();this.contentEl.empty();}
}
