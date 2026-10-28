import {cleanMediaStudy,newMediaStudy,canResumeMedia,mediaRecordKey,type MediaStudyState,type MediaImportSelection,type MediaResumeTicket,type MediaStudyReference} from './media-study-state';
import type {MediaStudyHost} from './media-study-workspace';
import {Component,ItemView,MarkdownRenderer,Notice,Scope,TFile,WorkspaceLeaf,setIcon,type KeymapEventHandler,type ViewStateResult} from 'obsidian';
import {applyWorkspaceDensity} from './workspace-density';
import {bindMobileViewport} from './mobile-viewport';
import {bindBoardHostInset} from './board-chrome';
import {bindOnlineComposerLayout} from './online-composer-layout';
import type {OnlineDraftStore,OnlineDraftSnapshot} from './online-draft-store';
import type {MediaMoment} from './media-notes';
import {mediaClock,parseMediaTime,validMediaTime} from './media-source';
import type {MediaPlacement} from './media-workspace-view';
import {parseOnlineSource,type OnlineState,type OnlineAction,type OnlineSource} from './online-platform';

export const ONLINE_WORKSPACE='thoughtspace-online-player';
export interface OnlineWorkspaceHost {
 study?:MediaStudyHost;
 drafts?:OnlineDraftStore;
 playbackAvailable?():boolean;
 openExternal?(source:string):Promise<unknown>;
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
 send(source:string,time?:number,text?:string,image?:string,reference?:MediaStudyReference):Promise<unknown>;
 openNote(file:TFile):Promise<unknown>;
}
type OnlinePanel='player'|'compose'|'timeline';
export interface OnlineWorkspaceState extends Record<string,unknown>{study?:MediaStudyState;source?:string;note?:string;placement?:MediaPlacement;time?:number;panel?:OnlinePanel;draftId?:string}
interface Draft {id:string;time:number;text:string;mode:'synced'|'manual';image?:Blob;locked?:boolean}
interface Capture {owner:symbol;source:string;invalid:boolean}
interface Memory {source:string;phase?:OnlineDraftSnapshot['phase'];recovered?:boolean;persistedNote?:string;persistenceWarning?:string;restoreBlocked?:boolean;draft?:Draft;manualTime?:number;pending?:symbol;capture?:Capture;editor?:symbol;note?:TFile;listeners:Set<(refresh:boolean)=>void>}
const memories=new WeakMap<OnlineWorkspaceHost,Map<string,Memory>>();
const busyMemory=(memory:Memory)=>!!(memory.draft||memory.pending||memory.capture||memory.editor)||memory.manualTime!==undefined;
function memoryFor(host:OnlineWorkspaceHost,source:string,note?:string,id?:string):Memory {
 let entries=memories.get(host);if(!entries){entries=new Map();memories.set(host,entries);}
 const key=JSON.stringify([source,note||'']),existing=entries.get(key),fresh=():Memory=>({source,listeners:new Set(),persistedNote:note});
 let saved:OnlineDraftSnapshot|undefined;
 try{saved=host.drafts?.recover(source,note,id);}
 catch(error){if(existing)return existing;const blocked={...fresh(),restoreBlocked:true,persistenceWarning:errorText(error)};entries.set(key,blocked);return blocked;}
 if(!saved){if(existing)return existing;const memory=fresh();entries.set(key,memory);return memory;}
 // Resolve synchronously before any notes request. A lagging layout and an exact
 // note alias must share one original draft object and one editor lease.
 const savedId=saved.id,storedKey=JSON.stringify([source,saved.note||'']),stored=entries.get(storedKey);
 const owned=[...new Set(entries.values())].find(memory=>memory.source===source&&memory.draft?.id===savedId);
 const boundNote=owned?.note?.path||owned?.persistedNote;
 if(note!==undefined&&boundNote!==undefined&&note!==boundNote)return {...fresh(),restoreBlocked:true,persistenceWarning:'当前草稿已绑定另一笔记；未切换笔记或替换草稿，请从原笔记重新打开'};
 const memory=owned||stored||existing||fresh();
 const conflicts=[existing,stored,memory].some(value=>value&&value!==owned&&busyMemory(value)&&value.draft?.id!==savedId);
 if(conflicts)return {...fresh(),restoreBlocked:true,persistenceWarning:'此来源或笔记已有正在编辑的草稿；当前内容与原暂存均保留。请先处理已有草稿，再重新打开此摘录'};
 if(!memory.draft){memory.draft={id:saved.id,time:saved.time,text:saved.text,mode:saved.mode,image:saved.image,locked:saved.phase!=='editing'};memory.phase=saved.phase;memory.recovered=saved.phase!=='editing';memory.persistedNote=saved.note;memory.restoreBlocked=false;}
 if(note!==undefined&&memory.persistedNote===undefined&&!memory.note){
  memory.persistedNote=note;const draft=memory.draft;
  try{host.drafts?.stage({id:draft.id,source,note,time:draft.time,text:draft.text,mode:draft.mode,image:draft.image,phase:memory.phase||'editing'});memory.persistenceWarning=undefined;}
  catch(error){memory.persistenceWarning=errorText(error);}
 }
 for(const alias of new Set([key,storedKey])){
  const previous=entries.get(alias);
  if(previous&&previous!==memory){previous.restoreBlocked=true;previous.persistenceWarning='此草稿已在另一视图恢复；请重新打开当前视图以使用同一编辑会话';for(const listener of previous.listeners)listener(false);}
  entries.set(alias,memory);
 }
 for(const listener of memory.listeners)listener(false);
 return memory;
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
 study=newMediaStudy();
 private resumeAfterSave?:MediaResumeTicket;
 private recordHotkey?:KeymapEventHandler;
 private recording=false;
 private source?:OnlineSource;
 private note?:string;
 private placement:MediaPlacement='tab';
 private requestedTime?:number;
 private memory?:Memory;
 private live?:OnlineState;
 private entries:MediaMoment[]=[];
 private generation=0;
 private stateRun=0;
 private timelineRun=0;
 private page=0;
 private opened=false;
 private closed=false;
 private composing=false;
 private panel:OnlinePanel='compose';
 private panelButtons=new Map<OnlinePanel,HTMLButtonElement>();
 private subscription?:()=>void;
 private releaseMemory?:()=>void;
 private releaseMount?:()=>void;
 private readonly editor=Symbol('online-workspace-editor');
 private input?:HTMLTextAreaElement;
 private status?:HTMLElement;
 private statusMessage='';
 private stopDrafts?:()=>void;
 private exportImageButton?:HTMLButtonElement;
 private retryDraftButton?:HTMLButtonElement;
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
 private stopViewport?:()=>void;
 private stopInset?:()=>void;
 private composerLayout?:ReturnType<typeof bindOnlineComposerLayout>;
 private rebindLayout?:()=>void;
 private submitHotkey?:KeymapEventHandler;

 async configureStudy(selection:MediaImportSelection){this.study={...this.study,enabled:true,id:this.study.id||crypto.randomUUID(),title:selection.title,board:selection.board};this.studyChanged();await this.host.study?.show(this,'notes');}
 studyCurrent(){return !this.closed&&!!this.source&&this.leaf.view===this;}
 studyNote(){return this.memory?.note;}
 studyChanged(){this.contentEl.toggleClass('is-study-paired',this.study.enabled);const title=this.contentEl.querySelector<HTMLElement>('.ts-online-workspace__title');if(title)title.textContent=this.study.title||this.source?.name||'在线视频';const destination=this.contentEl.querySelector<HTMLElement>('[data-study-target]');if(destination)destination.textContent=this.study.board||'尚未选择白板';this.contentEl.querySelectorAll<HTMLElement>('[data-study-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studyMode===this.study.mode)));this.app.workspace.requestSaveLayout();}
 private studyControls(root:HTMLElement){if(!this.host.study||!this.source)return;const bar=root.createDiv('ts-media-study-tools');for(const [mode,label]of [['notes','笔记'],['board','白板']]as const){const b=this.action(bar,label,mode==='notes'?'notebook-pen':'panels-top-left',async()=>{this.study.enabled=true;this.study.id ||=crypto.randomUUID();await this.host.study!.show(this,mode);});b.dataset.studyMode=mode;b.setAttribute('aria-pressed',String(this.study.enabled&&this.study.mode===mode));}this.action(bar,'暂停并记下 · M','bookmark-plus',()=>this.studyRecord()).addClass('mod-cta');const more=bar.createEl('details');more.createEl('summary',{text:'更多'});const panel=more.createDiv('ts-media-study-more');const destination=panel.createEl('p',{attr:{'data-study-target':''},text:this.study.board||'尚未选择白板'});destination.title='发送目标';this.action(panel,'发送末条摘录','arrow-up-right',async()=>{const source=this.source,generation=this.generation,pair=this.study.id;if(!source)return;const current=()=>this.studyCurrent()&&this.source===source&&this.generation===generation&&this.study.id===pair&&this.app.workspace.getActiveViewOfType(OnlineWorkspaceView)===this;if(!this.study.board){await this.host.study!.show(this,'board');this.message('目标已选择，请核对后再次点击发送。');return;}await this.host.study!.show(this,'board');if(!current())return;await this.refreshNotes();if(!current())return;const entry=this.entries.at(-1),note=this.currentNote();if(this.source&&entry&&note)await this.host.send(this.source.path,entry.time,entry.text,entry.image,{id:entry.id,note,board:this.study.board});});const ratio=panel.createEl('input',{type:'range',attr:{min:'38',max:'70','aria-label':'视频与内容比例'}});ratio.value=String(this.study.ratio);ratio.oninput=()=>this.host.study?.ratio(this,Number(ratio.value));}
 private recordKey(event:KeyboardEvent){if(this.closed||!this.opened)return false;const target=this.contentEl.ownerDocument.activeElement;if(this.app.workspace.getActiveViewOfType(OnlineWorkspaceView)!==this||target&&target!==this.contentEl.ownerDocument.body&&!this.contentEl.contains(target)||!mediaRecordKey(event,!!target?.closest('input,textarea,select,button,a,[contenteditable],video,audio')))return false;event.preventDefault();event.stopPropagation();void this.studyRecord().catch(e=>this.failure('记下此刻',e));return true;}
 async studyRecord(){const source=this.source,memory=this.memory,state=this.verified(),generation=this.generation;if(!source||!memory||!this.studyCurrent()||memory.draft||memory.pending||memory.capture||this.composing||this.recording)return;const time=this.captureTime();if(!time){this.message('请先同步平台时间，或确认手动时间。');return;}this.recording=true;try{const playing=!!state&&!state.paused;if(state){const paused=await this.host.command(source.path,'pause');if(paused===false)throw Error('未确认暂停，未创建新的记录');}if(this.closed||this.generation!==generation||this.memory!==memory||this.source!==source||memory.draft||state&&!this.verified())return;this.rememberTimestamp();const draft=this.memory?.draft;if(!draft)return;this.resumeAfterSave=playing?{source:source.path,draft:draft.id,generation,time:draft.time}:undefined;this.app.workspace.setActiveLeaf(this.leaf,{focus:true});this.input?.focus();}finally{this.recording=false;}}

 getRecoveryCenterDraft(){
  if(this.closed)return;const draft=this.memory?.draft,text=this.input?.value??draft?.text??'';
  if(!text&&!draft?.image)return;return {text,path:this.source?.path||this.memory?.source||'未选来源',time:draft?.time||0,hasImage:!!draft?.image};
 }
 constructor(leaf:WorkspaceLeaf,private host:OnlineWorkspaceHost){super(leaf);this.scope=new Scope(this.app.scope);this.stopViewport=bindMobileViewport(this.contentEl);}
 applyPreferences(){applyWorkspaceDensity(this.contentEl,this.host.density?.());this.contentEl.dataset.accent=this.host.accent?.()||'forest';}
 getViewType(){return ONLINE_WORKSPACE;}
 getDisplayText(){return this.source?`${this.source.name} · 在线视频笔记`:'在线视频笔记';}
 getIcon(){return 'clapperboard';}
 onWindowMigrated(){if(!this.closed)this.rebindLayout?.();}
 currentSource(){return this.source;}
 currentNote(){return this.memory?.note?.path||this.memory?.persistedNote||this.note;}
 private verified():OnlineState|undefined {
  if(this.host.playbackAvailable?.()===false)return;
  const state=this.live;
  return this.source&&state?.available&&!state.closed&&state.sourcePath===this.source.path&&state.status!=='source-changed'&&(!state.candidate||state.candidate.path===this.source.path)&&validMediaTime(state.time)?state:undefined;
 }
 getState():OnlineWorkspaceState {
  const time=this.verified()?.time;
  return {source:this.source?.path,note:this.currentNote(),placement:this.placement,panel:this.panel,...(this.study?.enabled?{study:{...this.study}}:{}),...(this.memory?.draft?{draftId:this.memory.draft.id}:{}),...(time!==undefined?{time}:{})};
 }
 canMove(){
  if(this.composing){new Notice('请先完成当前输入，再切换视频或工作区位置');return false;}
  if(this.memory?.capture){new Notice('截图处理中，请稍候再切换视频或工作区位置');return false;}
  if(this.memory?.draft||this.memory?.pending){new Notice('请先保存或取消当前摘录，再切换视频或工作区位置');return false;}
  return !this.closed;
 }
 async onOpen(){
  if(this.opened||this.closed)return;this.opened=true;
  this.bindSubmitHotkey();this.recordHotkey=this.scope?.register([],'m',event=>{if(this.recordKey(event))return false;});this.registerDomEvent(this.contentEl.ownerDocument,'keydown',event=>this.recordKey(event),{capture:true});
  this.stopDrafts=this.host.drafts?.subscribe(()=>{if(!this.closed)this.paintComposer();});
  this.subscription=this.host.subscribe(state=>{if(this.closed)return;this.live=state;if(this.resumeAfterSave&&(state.sourcePath!==this.source?.path||state.status==='source-changed'||state.candidate&&state.candidate.path!==this.source?.path||Math.abs(state.time-this.resumeAfterSave.time)>.5))this.resumeAfterSave=undefined;this.invalidateCapture();this.paintPlayback();this.paintComposer();});
  this.live=this.host.state();if(!this.input)this.render();else{this.paintPlayback();this.paintComposer();}
 }
 async setState(state:OnlineWorkspaceState,result?:ViewStateResult){
  if(this.closed)return;
  const generation=this.generation,run=++this.stateRun;if(this.host.drafts)await this.host.drafts.load();if(this.closed||this.generation!==generation||this.stateRun!==run)return;
  const source=typeof state.source==='string'?parseOnlineSource(state.source):undefined;
  const note=state.note===undefined&&source?.path===this.source?.path?this.currentNote():notePath(state.note),placement=state.placement==='sidebar'||state.placement==='window'?state.placement:'tab';
  if(state.source&&!source){this.message('视频链接无效，请重新选择。');return;}
  if(state.note&&!note){this.message('摘录笔记路径无效，请重新选择。');return;}
  const same=source?.path===this.source?.path&&(note||'')===(this.currentNote()||'');
  if((!same||placement!==this.placement)&&!this.canMove())return;
  if(same&&this.memory){
   if(state.study)this.study=cleanMediaStudy(state.study);this.studyChanged();
   if(state.panel==='player'||state.panel==='compose'||state.panel==='timeline')this.setPanel(state.panel);
   this.placement=placement;this.requestedTime=validMediaTime(state.time)?state.time:this.requestedTime;
   this.contentEl.dataset.placement=placement;this.paintPositions();this.live=this.host.state();this.invalidateCapture();this.paintPlayback();this.paintComposer();
   this.app.workspace.requestSaveLayout();if(result)result.history=true;return;
  }
  this.resumeAfterSave=undefined;this.host.study?.release(this);this.study=cleanMediaStudy(state.study);this.release();this.generation++;this.timelineRun++;this.source=source;this.note=note;this.placement=placement;
  this.panel=state.panel==='player'||state.panel==='timeline'?state.panel:'compose';
  this.requestedTime=validMediaTime(state.time)?state.time:source?.initialTime;this.entries=[];this.page=0;
  this.memory=source?memoryFor(this.host,source.path,note,typeof state.draftId==='string'?state.draftId:undefined):undefined;
  if(this.memory){
   if(note===undefined&&this.memory.persistedNote)this.note=this.memory.persistedNote;
   const owned=this.memory,listener=(refresh:boolean)=>{if(this.closed||this.memory!==owned)return;this.paintComposer();if(refresh)void this.refreshNotes();};
   owned.listeners.add(listener);this.releaseMemory=()=>owned.listeners.delete(listener);
  }
  this.live=this.host.state();this.render();this.studyChanged();this.app.workspace.requestSaveLayout();if(result)result.history=true;
  await this.refreshNotes();if(this.study.enabled)this.app.workspace.onLayoutReady(()=>{if(this.studyCurrent())void this.host.study?.show(this,this.study.mode).catch(error=>this.message(String(error)));});
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
 private message(value:string){this.statusMessage=value;this.paintDraftStatus();}
 /** Only this active view's exact write failure can replace a transient toast. */
 showDraftStorageFailure(store:OnlineDraftStore,draftIds:readonly string[]){
  const memory=this.memory,draft=memory?.draft,root=this.contentEl,doc=root.ownerDocument,win=doc.defaultView;
  if(this.closed||this.host.drafts!==store||this.leaf.view!==this||this.app.workspace.getActiveViewOfType(OnlineWorkspaceView)!==this||!draft||draftIds.length!==1||draftIds[0]!==draft.id||memory.source!==this.source?.path||memory.restoreBlocked||memory.recovered||store.state(draft.id)!=='error'||!root.isConnected||!win||win.closed||!doc.hasFocus()||doc.visibilityState==='hidden')return false;
  this.paintComposer();
  const status=this.status,summary=memory.phase==='committed'?'笔记已保存；本机暂存尚未清理。':'本机备份不可用';if(!status?.isConnected||status.ownerDocument!==doc||!root.contains(status)||!status.getClientRects().length||!status.textContent?.startsWith(summary))return false;
  status.scrollTop=0;
  const rect=status.getBoundingClientRect(),viewport=win.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||win.innerWidth,height=viewport?.height||win.innerHeight,style=win.getComputedStyle(status);
  const hit=doc.elementFromPoint(rect.left+rect.width/2,rect.top+Math.min(rect.height/2,12));
  return style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0&&rect.left>=left&&rect.top>=top&&rect.right<=left+width&&rect.bottom<=top+height&&!!hit&&status.contains(hit);
 }
 private paintDraftStatus(){
  if(this.closed||!this.status)return;
  const memory=this.memory,store=this.host.drafts,draft=memory?.draft;
  let detail='';
  if(memory?.restoreBlocked)detail=`暂存恢复未完成：${memory.persistenceWarning||'请重新打开工作区'}。原记录未删除。`;
  else if(memory?.recovered)detail='已恢复本机草稿，上次保存结果尚未确认。保存按钮只核对原回执，不新增笔记。可选择复制全文、导出截图；时间戳保持原值。';
  else if(draft&&memory?.phase==='committed')detail='笔记已保存；本机暂存尚未清理。再次保存只重试清理，不重复写入笔记。';
  else if(store&&(memory?.persistenceWarning||store.state(draft?.id||'')==='error'||store.error&&!draft))detail='本机备份不可用，当前内容仍在内存，尚未开始新的笔记写入。可复制全文、导出截图，或重试暂存；请勿依赖跨重启恢复。';
  else if(draft&&store)detail=store.state(draft.id)==='saved'?'草稿已暂存到本机；不跨设备同步。':'正在暂存本机草稿…';
  this.status.textContent=(draft&&store?.state(draft.id)==='error'?[detail,this.statusMessage]:[this.statusMessage,detail]).filter(Boolean).join('\n');
 }
 private stageDraft(memory:Memory,source:string){
  const draft=memory.draft,store=this.host.drafts;if(!draft||!store)return true;
  try{store.stage({id:draft.id,source,note:memory.persistedNote,time:draft.time,text:draft.text,mode:draft.mode,image:draft.image,phase:memory.phase||'editing'});memory.persistenceWarning=undefined;}
  catch(error){memory.persistenceWarning=errorText(error);this.paintDraftStatus();return false;}
  this.app.workspace.requestSaveLayout();this.paintDraftStatus();return true;
 }
 private failure(action:string,error:unknown){console.error(`[ThoughtSpace online] ${action}`,error);this.message(`${action}失败：当前摘录仍保留。\n${errorText(error)}`);}
 private releasePlayer(){const release=this.releaseMount;this.releaseMount=undefined;try{release?.();}catch(error){this.failure('关闭播放器',error);}}
 private setPanel(panel:OnlinePanel){
  this.panel=panel;this.contentEl.dataset.panel=panel;
  for(const[key,button]of this.panelButtons)button.setAttribute('aria-pressed',String(key===panel));
  this.composerLayout?.refresh();this.app.workspace.requestSaveLayout();
 }
 private render(){
  const generation=this.generation,current=()=>!this.closed&&this.generation===generation;
  this.composerLayout?.dispose();this.composerLayout=undefined;this.stopInset?.();this.stopInset=undefined;this.rebindLayout=undefined;
  this.releasePlayer();this.releasePreview();this.releaseTimeline();
  const root=this.contentEl;delete root.dataset.onlineShort;root.empty();root.addClass('ts-online-workspace');this.applyPreferences();root.dataset.placement=this.placement;root.dataset.playbackAvailable=String(this.host.playbackAvailable?.()!==false);this.positionButtons.clear();this.panelButtons.clear();
  const header=root.createDiv('ts-online-workspace__header'),heading=header.createDiv('ts-online-workspace__heading');
  heading.createEl('strong',{cls:'ts-online-workspace__title',text:this.source?.name||'在线视频笔记'});
  heading.createSpan({cls:'ts-online-workspace__source',text:this.source?.path||'选择视频，开始记录',attr:{title:this.source?.path||''}});
  this.action(header,'选择视频','folder-open',()=>{if(this.canMove())this.host.pick(this.placement);},true);
  const positions=root.createDiv('ts-online-workspace__positions');
  for(const [placement,label,icon]of [['tab','主页面','panel-top'],['sidebar','右侧栏','panel-right'],['window','独立窗口','picture-in-picture-2']]as const)this.positionButtons.set(placement,this.action(positions,label,icon,()=>this.move(placement)));
  const switcher=root.createDiv({cls:'ts-online-workspace__panel-switcher',attr:{role:'group','aria-label':'工作区显示内容'}});
  for(const[panel,label,icon]of [['player','播放','play'],['compose','写摘录','square-pen'],['timeline','时间轴','list-video']]as const)this.panelButtons.set(panel,this.action(switcher,label,icon,()=>this.setPanel(panel)));
  this.setPanel(this.panel);
  this.studyControls(root);
  const layout=root.createDiv('ts-online-workspace__layout'),player=layout.createDiv('ts-online-workspace__player');
  const playerHeading=player.createDiv('ts-online-workspace__section-heading');playerHeading.createEl('strong',{text:'视频播放器'});
  this.connection=playerHeading.createSpan({cls:'ts-online-workspace__connection'});
  this.loadButton=this.action(playerHeading,'加载视频 / 重试','refresh-cw',()=>this.openPlatform(),true);
  if(this.host.openExternal)this.action(playerHeading,'在浏览器打开视频','external-link',()=>this.source&&this.host.openExternal?.(this.source.path),true).disabled=!this.source;
  const embed=player.createDiv({cls:'ts-online-workspace__embed',attr:{'aria-label':'在线视频播放器'}});
  if(!this.source)embed.createDiv({cls:'ts-online-workspace__empty',text:'选择一个视频开始播放'});
  else if(this.host.playbackAvailable?.()===false)embed.createDiv({cls:'ts-online-workspace__empty',text:'此设备使用浏览器播放视频；在“写摘录”中确认手动时间，继续记录文字。',attr:{role:'status'}});
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
  const composer=layout.createDiv('ts-online-workspace__composer'),details=composer.createEl('details',{cls:'ts-online-workspace__composer-details'});details.open=true;const summary=details.createEl('summary',{text:'时间与更多选项'});summary.hidden=true;const tools=details.createDiv('ts-online-workspace__composer-tools'),composerHeading=tools.createDiv('ts-online-workspace__section-heading');
  composerHeading.createEl('strong',{text:'记录摘录'});this.draftTime=composerHeading.createSpan({cls:'ts-online-workspace__draft-time'});
  const captureActions=tools.createDiv('ts-online-workspace__capture-actions');
  this.timestampButton=this.action(captureActions,'记下此刻','bookmark-plus',()=>this.rememberTimestamp());
  this.captureButton=this.action(captureActions,'快速截图','camera',()=>this.takeScreenshot());this.captureButton.title='截取平台中已加载的视频画面，并记录对应时间';
  this.manualFallback=tools.createEl('details',{cls:'ts-online-workspace__manual-fallback'});
  this.manualFallback.createEl('summary',{text:'手动时间（备用）'});
  if(this.host.playbackAvailable?.()===false)this.manualFallback.createDiv({cls:'ts-online-workspace__manual-explanation',text:'此设备在浏览器播放视频。确认手动时间后可在此记录文字；同步播放与截图暂不可用。'});
  const manualRow=this.manualFallback.createDiv('ts-online-workspace__time-row');
  this.manual=manualRow.createEl('input',{type:'text',attr:{'aria-label':'手动摘录时间',placeholder:'未同步时，输入分:秒',inputmode:'decimal'}});
  this.confirmButton=this.action(manualRow,'确认时间','check',()=>this.confirmTime());
  this.imageBox=tools.createDiv('ts-online-workspace__draft-attachment');
  this.imageEl=this.imageBox.createEl('img',{cls:'ts-online-workspace__draft-image',attr:{alt:'当前摘录截图'}});
  this.imageLabel=this.imageBox.createSpan({cls:'ts-online-workspace__image-label'});
  this.exportImageButton=this.action(this.imageBox,'导出截图','download',()=>this.exportScreenshot(),true);
  this.removeImageButton=this.action(this.imageBox,'移除截图','image-minus',()=>this.removeScreenshot(),true);
  this.input=composer.createEl('textarea',{cls:'ts-online-workspace__input',attr:{'aria-label':'摘录内容',placeholder:'记录想法，支持 Markdown。首次输入时固定摘录时间。'}});
  this.composing=false;this.input.oninput=()=>{if(current())this.edit();};this.input.addEventListener('compositionstart',()=>{if(!current()||this.input?.readOnly)return;this.composing=true;if(this.memory&&!this.memory.editor){this.memory.editor=this.editor;notify(this.memory);}else this.paintComposer();});this.input.addEventListener('compositionend',()=>{if(current()){this.composing=false;this.edit();this.paintComposer();}});
  const input=this.input;input.onkeydown=event=>{if(current()&&this.input===input)this.handleSubmitHotkey(event);};
  const actions=composer.createDiv('ts-online-workspace__composer-actions'),hint=actions.createSpan({cls:'ts-online-workspace__hint',text:'⌘ / Ctrl + Enter 保存'});
  this.retryDraftButton=this.action(actions,'重试暂存','refresh-cw',()=>this.retryDraftStorage());
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
  const status=this.status,time=this.draftTime;this.rebindLayout=()=>{if(!current())return;this.composerLayout?.dispose();this.stopInset?.();this.stopViewport?.();this.stopViewport=bindMobileViewport(root);this.composerLayout=bindOnlineComposerLayout({root,composer,details,summary,panel:tools,heading:composerHeading,time,input,actions,hint,positions,switcher,ready:()=>!!(this.memory?.draft||this.captureTime()),composing:()=>this.composing});this.stopInset=bindBoardHostInset(root,status,()=>this.composerLayout?.refresh());};
  this.paintPositions();this.paintPlayback();this.paintComposer();this.rebindLayout();this.renderTimeline();
  if(this.source&&this.host.playbackAvailable?.()!==false)this.releaseMount=this.host.mount(embed,this.source.path);
 }
 private paintPositions(){for(const [placement,button]of this.positionButtons)button.setAttribute('aria-pressed',String(placement===this.placement));}
 private paintPlayback(){
  const state=this.verified(),candidate=this.candidate(),own=this.live?.sourcePath===this.source?.path?this.live:undefined;
  if(this.connection)this.connection.textContent=this.host.playbackAvailable?.()===false?'手动摘录模式':state?'时间已同步':own?.closed?'播放器已关闭':candidate?'视频已切换':own?.status==='loading'?'视频正在加载':own?.status==='error'||own?.status==='blocked'?'视频暂不可同步':'等待视频同步';
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
  this.contentEl.dataset.studyDraft=String(!!this.memory?.draft);
  const memory=this.memory,draft=memory?.draft,pending=!!(memory?.pending||memory?.capture||memory?.restoreBlocked),other=!!memory?.editor&&memory.editor!==this.editor,time=draft||this.captureTime();
  if(this.input){if(!this.composing&&this.input.value!==(draft?.text||''))this.input.value=draft?.text||'';this.input.readOnly=!memory||pending||other||!time||!!draft?.locked;}
  if(this.draftTime)this.draftTime.textContent=time?`${mediaClock(time.time)} · ${draft?(draft.mode==='manual'?'手动已固定':'已固定'):time.mode==='manual'?'手动已确认':'随播放同步'}`:'请先同步或确认时间';
  if(this.saveButton){this.saveButton.disabled=this.composing||!draft||pending||other;this.saveButton.setAttribute('aria-busy',String(pending));}
  if(this.clearButton)this.clearButton.disabled=this.composing||!draft&&memory?.manualTime===undefined||pending||other;
  if(this.manual)this.manual.disabled=!memory||!!draft||pending||other||!!this.verified();
  if(this.manualFallback){this.manualFallback.hidden=!memory||!!this.verified();if(memory&&this.host.playbackAvailable?.()===false)this.manualFallback.open=true;}
  if(this.confirmButton)this.confirmButton.disabled=!memory||!!draft||pending||other||!!this.verified();
  if(this.timestampButton)this.timestampButton.disabled=!memory||!!draft||pending||other||!this.captureTime();
  if(this.captureButton){this.captureButton.disabled=this.composing||!memory||pending||other||!!draft?.locked||!this.verified();this.captureButton.setAttribute('aria-busy',String(!!memory?.capture));}
  if(this.loadButton)this.loadButton.disabled=this.host.playbackAvailable?.()===false||!this.source||pending;
  if(this.removeImageButton)this.removeImageButton.disabled=!draft?.image||pending||other||!!draft.locked;
  if(this.noteButton)this.noteButton.disabled=!memory?.note;
  if(this.adoptButton)this.adoptButton.disabled=!this.candidate()||!!draft||pending;
  if(this.exportImageButton)this.exportImageButton.disabled=!draft?.image;
  if(this.retryDraftButton){this.retryDraftButton.hidden=!draft||!this.host.drafts||!memory?.persistenceWarning&&this.host.drafts.state(draft.id)!=='error';this.retryDraftButton.disabled=this.composing||pending||other;}
  this.paintImage();this.paintDraftStatus();this.composerLayout?.refresh();
 }
 private edit(){
  const memory=this.memory,input=this.input;if(this.closed||!memory||!input)return;
  if(memory.pending||memory.capture||memory.draft?.locked||memory.editor&&memory.editor!==this.editor){this.paintComposer();return;}
  if(!memory.draft){const time=this.captureTime();if(!time){this.paintComposer();this.message('请先同步平台时间，或输入并确认手动时间。');return;}if(!input.value)return;
   memory.draft={id:crypto.randomUUID(),time:time.time,text:input.value,mode:time.mode};
  }else memory.draft.text=input.value;
  memory.editor=this.editor;this.stageDraft(memory,this.source!.path);notify(memory);
 }
 private rememberTimestamp(){
  const memory=this.memory,time=this.captureTime();
  if(this.closed||!memory||!time||memory.draft||memory.pending||memory.capture||memory.editor&&memory.editor!==this.editor)return;
  memory.draft={id:crypto.randomUUID(),time:time.time,text:'',mode:time.mode};memory.editor=this.editor;
  this.stageDraft(memory,this.source!.path);notify(memory);this.setPanel('compose');this.message('时间戳已固定，可以直接保存，也可以继续填写摘录。');this.composerLayout?.revealComposer();this.input?.focus();
 }
 private invalidateCapture(){
  const capture=this.memory?.capture;if(capture&&capture.source===this.source?.path&&!this.verified())capture.invalid=true;
 }
 private async takeScreenshot(){
  const source=this.source,memory=this.memory;
  if(this.composing||this.closed||!source||!memory||!this.verified()||memory.pending||memory.capture||memory.draft?.locked||memory.editor&&memory.editor!==this.editor)return;
  const generation=this.generation,original=memory.draft,capture:Capture={owner:this.editor,source:source.path,invalid:false};
  memory.capture=capture;memory.editor=this.editor;notify(memory);this.message('正在截取已加载的视频画面…');
  try{
   const result=await this.host.capture(source.path);
   if(this.closed||this.generation!==generation||this.memory!==memory||this.source?.path!==source.path||memory.capture!==capture||memory.editor!==this.editor||memory.draft!==original)return;
   this.live=this.host.state();this.invalidateCapture();
   if(capture.invalid||!this.verified()){this.message('视频来源或播放状态已变化，请重新截图；原摘录仍保留。');return;}
   if(!validMediaTime(result.time)||result.time>864000||result.blob?.type!=='image/png'||!Number.isFinite(result.blob.size)||result.blob.size<=0||result.blob.size>20*1024*1024)throw Error('截图数据无效');
   memory.draft={id:original?.id||crypto.randomUUID(),time:result.time,text:original?.text||'',mode:'synced',image:result.blob};memory.manualTime=undefined;this.stageDraft(memory,source.path);
   this.setPanel('compose');this.message('截图已加入草稿；可以直接保存，也可以补充文字。');this.composerLayout?.revealComposer();this.input?.focus();
  }catch(error){if(!this.closed&&this.memory===memory&&this.generation===generation)this.failure('截图',error);}
  finally{
   if(memory.capture===capture){memory.capture=undefined;if(!memory.draft&&memory.editor===this.editor)memory.editor=undefined;notify(memory);}
  }
 }
 private removeScreenshot(){
  const memory=this.memory;
  if(this.closed||!memory?.draft?.image||memory.pending||memory.capture||memory.draft.locked||memory.editor&&memory.editor!==this.editor)return;
  memory.draft.image=undefined;memory.editor=this.editor;this.stageDraft(memory,this.source!.path);notify(memory);this.message('已移除截图，文字与时间戳仍保留。');
 }
 private exportScreenshot(){
  const draft=this.memory?.draft;if(this.closed||!draft?.image||!this.previewUrl)throw Error('截图导出暂不可用，原图仍保留');
  const link=this.contentEl.createEl('a',{attr:{href:this.previewUrl,download:`thoughtspace-online-${draft.id}.png`}});
  try{link.click();}finally{link.remove();}
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
  memory.manualTime=time;notify(memory);this.setPanel('compose');this.message(`已确认手动时间 ${mediaClock(time)}；首次输入后固定。`);this.composerLayout?.revealComposer();this.input?.focus();
 }
 private async retryDraftStorage(){
  const memory=this.memory,draft=memory?.draft,store=this.host.drafts,source=this.source;if(this.closed||this.composing||!memory||!draft||!store||!source||memory.pending||memory.capture||memory.editor&&memory.editor!==this.editor)return;
  const pending=Symbol('online-draft-retry');memory.pending=pending;notify(memory);
  try{await store.flush(draft.id);if(memory.pending!==pending||memory.draft!==draft)return;if(!this.stageDraft(memory,source.path))throw Error(memory.persistenceWarning||'当前内容无法暂存');await store.flush(draft.id);if(memory.pending!==pending||memory.draft!==draft)return;memory.persistenceWarning=undefined;if(!this.closed&&this.memory===memory)this.message('本机暂存已重试；未新增或修改笔记。');}
  catch(error){memory.persistenceWarning=errorText(error);if(!this.closed&&this.memory===memory)this.failure('重试暂存',error);}
  finally{if(memory.pending===pending){memory.pending=undefined;notify(memory);}}
 }
 private async cancelDraft(){
  this.resumeAfterSave=undefined;
  const memory=this.memory;if(this.composing||this.closed||!memory||memory.pending||memory.capture||memory.editor&&memory.editor!==this.editor)return;
  const draft=memory.draft,pending=Symbol('online-draft-cancel');memory.pending=pending;notify(memory);
  try{
   if(draft&&this.host.drafts)await this.host.drafts.discard(draft.id);
   if(memory.pending!==pending||memory.draft!==draft)return;
   memory.draft=undefined;memory.manualTime=undefined;memory.editor=undefined;memory.phase=undefined;memory.recovered=false;memory.persistenceWarning=undefined;
   if(!this.closed&&this.memory===memory){if(this.manual)this.manual.value='';this.message('已取消当前摘录。');this.app.workspace.requestSaveLayout();}notify(memory);
  }catch(error){if(!this.closed&&this.memory===memory)this.failure('取消摘录',error);}
  finally{if(memory.pending===pending){memory.pending=undefined;notify(memory);}}
 }
 private bindSubmitHotkey(){
  if(this.submitHotkey||!this.scope)return;
  // Native view scopes run before the host's capture shortcuts. Keep the
  // textarea listener as a fallback for events that still reach the DOM.
  this.submitHotkey=this.scope.register(['Mod'],'Enter',event=>{
   if(this.handleSubmitHotkey(event))return false;
  });
 }
 private handleSubmitHotkey(event:KeyboardEvent):boolean {
  if(event.defaultPrevented||compositionKey(event)||this.composing||event.key!=='Enter'||!(event.metaKey||event.ctrlKey)||event.altKey||event.shiftKey)return false;
  const input=this.input,doc=this.contentEl.ownerDocument,owner=doc.defaultView;
  // The active view API includes sidebars; the most recent root leaf does not.
  if(this.closed||!this.opened||!input||input.ownerDocument!==doc||doc.activeElement!==input||!input.isConnected||!input.getClientRects().length||!owner||owner.closed||this.app.workspace.getActiveViewOfType(OnlineWorkspaceView)!==this)return false;
  const target=event.target as Node|null,eventDocument=target?.ownerDocument||(target?.nodeType===9?target:null);
  if(event.view&&event.view!==owner||eventDocument&&eventDocument!==doc)return false;
  event.preventDefault();event.stopPropagation();
  // Consume pending/locked keys as well; saveDraft retains ownership of the
  // exact snapshot, pending/capture protection and explicit failed-save retry.
  const generation=this.generation;
  if(!event.repeat)void this.saveDraft().catch(error=>{if(!this.closed&&this.generation===generation)this.failure('保存摘录',error);});
  return true;
 }
 private async saveDraft(){
  const source=this.source,memory=this.memory,draft=memory?.draft;
  if(this.composing||this.closed||!source||!memory||!draft||memory.pending||memory.capture||memory.editor&&memory.editor!==this.editor)return;
  const generation=this.generation,document=this.contentEl.ownerDocument,activeView=this.app.workspace.getActiveViewOfType(OnlineWorkspaceView),targetNote=this.currentNote(),previousPhase=memory.phase,previousLocked=!!draft.locked;
  memory.editor=this.editor;draft.locked=true;const pending=Symbol('online-note-save');memory.pending=pending;notify(memory);this.message('正在保存摘录…');
  try{
   const store=this.host.drafts,ensure=()=>{if(store&&!store.active)throw Error('在线草稿会话已结束，原始内容仍保留');};ensure();
   let note:TFile;
   if(memory.recovered||memory.phase==='committed'){
    const result=await this.host.notes(source.path,memory.persistedNote||this.currentNote());ensure();
    if(!result.note||memory.persistedNote&&result.note.path!==memory.persistedNote||!result.entries.some(entry=>entry.id===draft.id))throw Error('上次保存结果未确认；未新建或追加笔记。请保留并复制正文、导出截图，待原笔记可读取后重试核对');
    note=result.note;
   }else{
    memory.phase='prepared';memory.persistedNote=targetNote;
    try{if(!this.stageDraft(memory,source.path))throw Error(memory.persistenceWarning||'草稿暂存失败');if(store)await store.flush(draft.id);}
    catch(error){draft.locked=previousLocked;memory.phase=previousPhase||'editing';this.stageDraft(memory,source.path);throw Error(`${previousLocked?'重试暂存失败，本次未再次写入笔记；保留原始草稿，等待核对或重试。':'暂存失败，尚未写笔记；可继续编辑或重试。'}${errorText(error)}`);}
    ensure();
    if(this.closed||this.generation!==generation||this.memory!==memory||this.source!==source||this.contentEl.ownerDocument!==document||this.leaf.view!==this||this.app.workspace.getActiveViewOfType(OnlineWorkspaceView)!==activeView||this.currentNote()!==targetNote)throw Error('工作区已切换，未开始笔记写入；暂存仍保留，请在原工作区重试');
    note=(await this.host.save(source.path,{id:draft.id,time:draft.time,text:draft.text,...(draft.image?{image:draft.image}:{})},targetNote)).note;ensure();
   }
   if(memory.pending!==pending||memory.draft!==draft)return;
   if(!notePath(note.path))throw Error('保存回执的笔记路径无效；原草稿仍保留');
   memory.phase='committed';memory.persistedNote=note.path;memory.recovered=false;rememberNote(this.host,source.path,memory,note);
   if(!this.closed&&this.memory===memory){this.note=note.path;this.app.workspace.requestSaveLayout();}
   if(!this.stageDraft(memory,source.path))throw Error(memory.persistenceWarning||'已保存，但暂存回执未更新；原草稿仍保留');
   if(store){await store.flush(draft.id);ensure();await store.discard(draft.id);ensure();}
   if(memory.pending!==pending||memory.draft!==draft)return;
   memory.draft=undefined;memory.manualTime=undefined;memory.editor=undefined;memory.phase=undefined;memory.persistenceWarning=undefined;
   if(!this.closed&&this.memory===memory){this.message('摘录已保存。');this.app.workspace.requestSaveLayout();}
   notify(memory,true);void this.host.study?.sync(this).catch(()=>this.message('摘录已保存；连续笔记页尚未打开，可点“笔记”重试。'));
   const ticket=this.resumeAfterSave;this.resumeAfterSave=undefined;const playback=this.verified();if(playback&&canResumeMedia(ticket,{source:source.path,draft:draft.id,generation:this.generation,time:playback.time,active:this.studyCurrent()&&this.app.workspace.getActiveViewOfType(OnlineWorkspaceView)===this,paused:playback.paused}))void this.host.command(source.path,'toggle').catch(()=>this.message('摘录已保存，播放尚未恢复，可手动播放。'));
  }catch(error){if(!this.closed&&this.memory===memory)this.failure('保存摘录',error);}
  finally{if(memory.pending===pending){memory.pending=undefined;notify(memory);}}
 }
 private async refreshNotes(){
  const source=this.source,memory=this.memory;if(!source||!memory||this.closed)return;
  const generation=this.generation,run=++this.timelineRun,targetNote=this.currentNote();
  try{const result=await this.host.notes(source.path,targetNote);
   if(this.closed||this.generation!==generation||this.timelineRun!==run||this.memory!==memory||this.currentNote()!==targetNote)return;
   rememberNote(this.host,source.path,memory,result.note);void this.host.study?.sync(this).catch(()=>{});if(result.note&&memory.draft&&!memory.recovered&&!memory.pending){memory.persistedNote=result.note.path;this.stageDraft(memory,source.path);}this.entries=result.entries.filter(entry=>typeof entry.id==='string'&&validMediaTime(entry.time)&&typeof entry.text==='string').sort((a,b)=>a.time-b.time);
   this.paintComposer();this.renderTimeline();
  }catch(error){if(!this.closed&&this.generation===generation&&this.timelineRun===run&&this.memory===memory&&this.currentNote()===targetNote)this.failure('读取摘录',error);}
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
   this.action(row,'发送到白板','panels-top-left',()=>{if(source&&this.generation===generation)return this.host.send(source,entry.time,entry.text,entry.image,this.study.enabled&&this.currentNote()?{id:entry.id,note:this.currentNote()!,board:this.study.board}:undefined);},true);
  }
 }
 private releaseTimeline(){this.timelineScope?.unload();this.timelineScope=undefined;}
 private async openPlatform(){
  if(this.host.playbackAvailable?.()===false||!this.source||this.memory?.pending||this.memory?.capture)return;
  if(this.live?.sourcePath===this.source.path&&!this.live.closed)await this.host.command(this.source.path,'reload');
  else await this.host.open(this.source.path,this.placement,this.verified()?.time??this.requestedTime??this.source.initialTime,this.currentNote());
 }
 private async openNote(){const note=this.memory?.note;if(note)await this.host.openNote(note);}
 private async move(placement:MediaPlacement){if(this.source&&this.canMove())await this.host.open(this.source.path,placement,this.verified()?.time,this.currentNote());}
 private async adopt(){const candidate=this.candidate();if(candidate&&this.canMove())await this.host.adopt(candidate.path,this.placement);}
 private async command(action:OnlineAction,value?:number){if(this.source&&this.verified())await this.host.command(this.source.path,action,value);}
 private async seekBy(delta:number){const state=this.verified();if(!state)return;await this.command('seek',Math.max(0,Math.min(validMediaTime(state.duration)&&state.duration>0?state.duration:100000000,state.time+delta)));}
 private async seekTo(){const time=parseMediaTime(this.seek?.value||'');if(time===undefined){this.message('请输入有效的跳转时间。');return;}await this.command('seek',time);}
 async onClose(){if(this.closed)return;this.resumeAfterSave=undefined;this.host.study?.release(this);if(this.recordHotkey)this.scope?.unregister(this.recordHotkey);this.recordHotkey=undefined;this.stopDrafts?.();this.stopDrafts=undefined;if(this.composing)this.edit();if(this.submitHotkey)this.scope?.unregister(this.submitHotkey);this.submitHotkey=undefined;this.composerLayout?.dispose();this.composerLayout=undefined;this.stopInset?.();this.stopInset=undefined;this.rebindLayout=undefined;this.stopViewport?.();this.stopViewport=undefined;this.closed=true;this.generation++;this.timelineRun++;this.subscription?.();this.subscription=undefined;this.release();this.contentEl.empty();try{await this.host.drafts?.flush();}catch{/* Same-host memory and the existing persisted record remain; no restart guarantee. */}}
}
