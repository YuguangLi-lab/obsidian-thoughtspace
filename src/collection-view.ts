import {Component,ItemView,MarkdownRenderer,Scope,setIcon,type KeymapEventHandler,type ViewStateResult,type WorkspaceLeaf} from 'obsidian';
import {bindMobileViewport} from './mobile-viewport';
import {applyWorkspaceDensity} from './workspace-density';
import {cleanCollectionBackground,collectionBackgroundStyles} from './collection-background';
import type {BoardBackground} from './board-background';
import {filterCollectionSearchRecords,type CollectionSearchOptions,type CollectionSearchProgress,type CollectionSearchResult} from './collection-search';
import {parseCollectionDay} from './collection-calendar';
import {CollectionHeatmapView} from './collection-heatmap-view';
import {CollectionAttachmentBrowser} from './collection-attachment-browser';
import {CollectionNoteExportModal} from './collection-note-export-modal';
import type {CollectionNoteTarget,CollectionNoteHeading,CollectionNotePreview,CollectionNoteExportReceipt,CollectionNoteExportHistory} from './collection-note-export';
import type {CollectionBoardDeliveryResult,CollectionBoardReceiptHistory} from './collection-board-receipts';
import type {CollectionContextItem,CollectionRecordContext,CollectionAttachmentQuery,CollectionAttachmentPage} from './collection-context';
import type {CollectionTaskSummary,CollectionTaskFilter} from './collection-tasks';
import type {SavedCollectionFilter} from './collection-saved-filters';
import type {CollectionBatchOperation,CollectionBatchReport} from './collection-batch';

export const COLLECTION_VIEW_TYPE='thoughtspace-collection';
/** One physical native-note card; the opaque key belongs to its indexed TFile. */
export interface CollectionBoardReference {key:string;boardPath:string;boardTitle:string;nodeId:string;nodeTitle:string;}
export interface CollectionRecord {
 id:string;path:string;title:string;createdAt:string;tags:readonly string[];
 /** Unknown indexing results must never be represented as unplaced. */
 inBoard:boolean|'unknown';
 placements?:readonly CollectionBoardReference[];
 placementsComplete?:boolean;
 pinned?:boolean;archived?:boolean;tasks?:CollectionTaskSummary;
}
export interface CollectionTarget {key:string;title:string;path?:string;groups:readonly {id:string;title:string}[];groupId?:string;duplicate?:'allow';}
export interface CollectionBatchRequest {items:readonly CollectionRecord[];operation:CollectionBatchOperation;target?:CollectionTarget;}
export interface CollectionAttachment {path:string;label:string;}
export interface CollectionViewDraft {
 body:string;tags:string;attachments:readonly CollectionAttachment[];target?:CollectionTarget;
 busy:boolean;locked:boolean;targetLocked?:boolean;canSubmit?:boolean;status?:string;
}
export interface CollectionDraftPatch {body?:string;tags?:string;attachments?:readonly CollectionAttachment[];target?:CollectionTarget|null;}
/** Each view owns one host session. The host journals the draft and atomically
 * clears it only after confirmed creation/delivery. UI teardown never discards it. */
export interface CollectionViewHost {
 accent?():string;density?():string;
 background?():BoardBackground;backgroundResource?:(path:string)=>string;
 openBackground?:(anchor:HTMLElement,current:()=>boolean)=>void;
 ready:()=>Promise<void>;sessionId:()=>string;setSessionId:(id:string)=>Promise<void>;
 draft:()=>CollectionViewDraft;updateDraft:(patch:CollectionDraftPatch)=>void;
 submit:(current:()=>boolean)=>Promise<void>;
 subscribe:(listener:(kind?:'draft'|'records'|'filters'|'batches')=>void)=>()=>void;
 list:()=>Promise<readonly CollectionRecord[]>;
 inspectContext?:(record:CollectionRecord,current:()=>boolean)=>Promise<CollectionRecordContext>;
 attachmentPage?:(query:CollectionAttachmentQuery,current:()=>boolean)=>Promise<CollectionAttachmentPage>;
 openContext?:(record:CollectionRecord,item:CollectionContextItem,current:()=>boolean)=>Promise<void>;
 validateContext?:(record:CollectionRecord,item:CollectionContextItem,current:()=>boolean)=>Promise<void>;
 pickNote?:(current:()=>boolean)=>Promise<string|undefined>;
 noteHeadings?:(path:string,current:()=>boolean)=>Promise<readonly CollectionNoteHeading[]>;
 prepareNote?:(record:CollectionRecord,target:CollectionNoteTarget,current:()=>boolean)=>Promise<CollectionNotePreview>;
 commitNote?:(preview:CollectionNotePreview,current:()=>boolean)=>Promise<CollectionNoteExportReceipt>;
 discardNote?:(preview:CollectionNotePreview)=>void;
 inspectNote?:(id:string)=>Promise<CollectionNoteExportHistory>;
 noteHistory?:()=>Promise<{items:readonly CollectionNoteExportHistory[];warning?:string}>;
 openNotePath?:(path:string,current:()=>boolean)=>Promise<void>;
 deliveryReceipts?:(record:CollectionRecord)=>Promise<CollectionBoardReceiptHistory>;
 search?:(options:CollectionSearchOptions,current:()=>boolean,onProgress?:(progress:CollectionSearchProgress)=>void)=>Promise<CollectionSearchResult>;
 setFlag?:(record:CollectionRecord,flag:'pinned'|'archived',value:boolean,current:()=>boolean)=>Promise<void>;
 savedFilters?:()=>Promise<{filters:readonly SavedCollectionFilter[];warning?:string}>;
 saveFilter?:(name:string,options:CollectionSearchOptions,current:()=>boolean,id?:string)=>Promise<SavedCollectionFilter>;
 deleteFilter?:(id:string,current:()=>boolean)=>Promise<void>;
 batch?:(request:CollectionBatchRequest,current:()=>boolean,onProgress:(report:CollectionBatchReport)=>void)=>Promise<CollectionBatchReport>;
 batchReports?:()=>Promise<{reports:readonly CollectionBatchReport[];warning?:string}>;
 /** Return the verified record body without its collection metadata. */
 readBody:(record:CollectionRecord)=>Promise<string>;
 pickAttachment:(current:()=>boolean)=>Promise<CollectionAttachment|undefined>;
 pickTarget:(current:()=>boolean)=>Promise<CollectionTarget|undefined>;
 deliver:(record:CollectionRecord,target:CollectionTarget,current:()=>boolean)=>Promise<CollectionBoardDeliveryResult>;
 openNote:(record:CollectionRecord)=>Promise<void>|void;
 showOccurrences:(record:CollectionRecord)=>Promise<void>|void;
 locateBoard?:(record:CollectionRecord,reference:CollectionBoardReference)=>Promise<void>|void;
 openLegacyInbox:()=>Promise<void>|void;release?:()=>void;
}
export type CollectionFilter='all'|'unplaced'|'placed'|'archived';
export function filterCollectionRecords(records:readonly CollectionRecord[],scope:CollectionFilter,tag:string,query:string):CollectionRecord[] {
 const fold=(value:string)=>value.normalize('NFC').toLocaleLowerCase(),chosen=fold(tag.replace(/^#/,''));
 const terms=fold(query.trim()).split(/\s+/).filter(Boolean);
 return records.filter(record=>{
  if(scope==='archived'?!record.archived:record.archived)return false;
  if(scope==='unplaced'&&record.inBoard!==false)return false;
  if(scope==='placed'&&record.inBoard!==true)return false;
  const tags=record.tags.map(value=>fold(value.replace(/^#/,'')));
  const tagged=(value:string)=>tags.some(item=>item===value||item.startsWith(value+'/'));
  return(!chosen||tagged(chosen))&&terms.every(term=>term.startsWith('-#')?!tagged(term.slice(2)):term.startsWith('#')?tagged(term.slice(1)):fold(record.title+' '+record.path).includes(term)||tags.some(item=>item.includes(term)));
 }).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id)||a.path.localeCompare(b.path));
}
const PAGE_SIZE=24,PREVIEW_LIMIT=1400,EXPANDED_LIMIT=30000;
type CardPreview={record:CollectionRecord;row:HTMLElement;body:HTMLElement;placements?:HTMLElement;taskProgress?:HTMLElement;scope:Component;expanded:boolean;loaded:boolean;reading:boolean;text?:string;toggle?:HTMLButtonElement;previewReady?:Promise<void>;finishPreview?:()=>void};
export interface CollectionBrowseLocation {page:number;scroll:number;focus?:HTMLElement;recordId?:string;action?:string;nodeId?:string;boardPath?:string;anchorId?:string;anchorOffset?:number;expanded?:readonly string[];}

/** The composer is never rebuilt by index refreshes, tag filters or body renders.
 * Only one bounded page of metadata and visible Markdown previews is mounted. */
export class CollectionView extends ItemView {
 private alive=false;private stateEpoch=0;private navigationEpoch=0;private listEpoch=0;private renderEpoch=0;
 private records:readonly CollectionRecord[]=[];private filter:CollectionFilter='all';private tag='';private query='';private page=0;
 private preparing=true;private choosing=false;private submitting=false;private composing=false;private indexBusy=false;private stale=false;
 private unsubscribe?:()=>void;private unbindViewport?:()=>void;private observer?:IntersectionObserver;
 private cards:CardPreview[]=[];private readQueue:CardPreview[]=[];private activeReads=0;
 private root?:HTMLElement;private main?:HTMLElement;private nav?:HTMLElement;private tagsList?:HTMLElement;private backdrop?:HTMLButtonElement;
 private bodyInput?:HTMLTextAreaElement;private tagInput?:HTMLInputElement;private options?:HTMLDetailsElement;private attachments?:HTMLElement;
 private bodySizeValue?:string;private bodySizeWidth=0;
 private targetLabel?:HTMLElement;private groupSelect?:HTMLSelectElement;private groupField?:HTMLElement;private targetButton?:HTMLButtonElement;private clearTarget?:HTMLButtonElement;
 private attachButton?:HTMLButtonElement;private submitButton?:HTMLButtonElement;private status?:HTMLElement;private search?:HTMLInputElement;
 private drawerButton?:HTMLButtonElement;private refreshButton?:HTMLButtonElement;private feed?:HTMLElement;private feedStatus?:HTMLElement;private pagination?:HTMLElement;
 private allButton?:HTMLButtonElement;private unplacedButton?:HTMLButtonElement;private tagHeading?:HTMLElement;private liveMessage='';private draftMessage='';
 private submitHotkey?:KeymapEventHandler;
 private located?:{id:string;createdAt:string;origin:CollectionBrowseLocation};private membershipEpoch=0;private membershipTimer?:ReturnType<typeof setTimeout>;
 private restoreEpoch=0;private backgroundRefreshEpoch?:number;
 private heatmap?:CollectionHeatmapView;private attachmentBrowser?:CollectionAttachmentBrowser;
 private noteExport?:CollectionNoteExportModal;
 private organizingMenu?:HTMLDetailsElement;private reviewPanel?:HTMLElement;private reviewStart?:HTMLButtonElement;
 private reviewIdentityEpoch=0;
 private review?:{items:readonly CollectionRecord[];index:number;origin:CollectionBrowseLocation;outcomes:Map<string,string>;busy:boolean;confirmArchive:boolean};
 private searchEpoch=0;private searchTimer?:number;private searchTimerWindow?:Window;private searchComposing=false;private searchBusy=false;
 private includeBody=false;private pinnedOnly=false;private since='';private until='';private taskFilter:CollectionTaskFilter='all';private taskSelect?:HTMLSelectElement;
 private searchProgress?:CollectionSearchProgress;private searchMessage='';private searchResult?:{epoch:number;key:string;value:CollectionSearchResult};
 private searchPanel?:HTMLElement;private searchFeedback?:HTMLElement;private cancelSearchButton?:HTMLButtonElement;private retrySearchButton?:HTMLButtonElement;
 private placedButton?:HTMLButtonElement;private archivedButton?:HTMLButtonElement;private bodySearchToggle?:HTMLInputElement;private pinnedToggle?:HTMLInputElement;private sinceInput?:HTMLInputElement;private untilInput?:HTMLInputElement;
 private browseMessage='';private browseEpoch=0;private browseNotice?:HTMLElement;
 private saved:readonly SavedCollectionFilter[]=[];private savedWarning='';private savedMessage='';private savedBusy=false;private savedEpoch=0;
 private savedList?:HTMLElement;private savedStatus?:HTMLElement;private savedForm?:HTMLElement;private savedName?:HTMLInputElement;private savedSave?:HTMLButtonElement;private savedEntry?:HTMLButtonElement;
 private appliedFilterId?:string;private deletingFilterId?:string;private manualBodyMode=false;private bodyAwaitingStart=false;private startSearchButton?:HTMLButtonElement;
 private selectionMode=false;private selected=new Map<string,CollectionRecord>();private selectionEpoch=0;
 private selectionBar?:HTMLElement;private selectionTools?:HTMLElement;private selectionStatus?:HTMLElement;private selectModeButton?:HTMLButtonElement;
 private batchReview?:{items:CollectionRecord[];operation:CollectionBatchOperation;target?:CollectionTarget;epoch:number};
 private batchPanel?:HTMLElement;private batchEpoch=0;private batchRunning=false;private batchStopRequested=false;private batchChoosing=false;
 private batchReport?:CollectionBatchReport;private batchHistory:readonly CollectionBatchReport[]=[];private batchHistoryWarning='';private batchMessage='';private historyEpoch=0;

 constructor(leaf:WorkspaceLeaf,private readonly host:CollectionViewHost){super(leaf);this.scope=new Scope(this.app.scope);}
 getViewType(){return COLLECTION_VIEW_TYPE;}
 getDisplayText(){return '收集';}
 getIcon(){return 'notebook-pen';}
 getState(){return{collectionSession:this.host.sessionId()};}
 async setState(raw:unknown,_result?:ViewStateResult){
  const id=raw&&typeof raw==='object'&&'collectionSession'in raw?raw.collectionSession:undefined;
  if(typeof id!=='string'||!id||id.length>200)return;
  // Layout restoration may repeat the current session after onOpen has already
  // rendered its records. That is not a new navigation or search invocation.
  if(id===this.host.sessionId())return;
  const epoch=++this.stateEpoch;this.clearSelection(true);this.cancelSearch();const searchEpoch=this.searchEpoch;this.preparing=true;this.syncDraft();let restored=false;
  try{await this.host.setSessionId(id);if(epoch!==this.stateEpoch)return;restored=true;this.app.workspace.requestSaveLayout();}
  catch(error){if(epoch===this.stateEpoch)this.report(error);}
  finally{if(epoch===this.stateEpoch){this.preparing=false;this.syncDraft();}}
  if(!restored||!this.current()||epoch!==this.stateEpoch||searchEpoch!==this.searchEpoch)return;
  // The latest session restore owns startup when it supersedes onOpen. Rebuild
  // the cheap metadata result, but never restart a body scan implicitly or
  // overwrite a newer query/cancellation made while the journal was loading.
  if(this.includeBody){this.cancelSearch('草稿会话已恢复，正文搜索请重试。');this.renderFeed();}
  else await this.refreshRecords(true);
 }
 applyPreferences(){
  applyWorkspaceDensity(this.contentEl,this.host.density?.());this.contentEl.dataset.accent=this.host.accent?.()||'forest';
  if(this.root){const background=cleanCollectionBackground(this.host.background?.());this.root.dataset.collectionBackground=background.canvasBackground;this.root.setCssProps(collectionBackgroundStyles(background,this.host.accent?.(),this.host.backgroundResource?.(background.backgroundImagePath)));}
 }
 async onOpen(){
  this.alive=true;this.bodySizeValue=undefined;this.bodySizeWidth=0;this.contentEl.empty();this.contentEl.addClass('ts-collection-content');this.applyPreferences();
  this.bindSubmitHotkey();
  const root=this.root=this.contentEl.createDiv({cls:'ts-collection',attr:{'aria-label':'收集'}});
  this.applyPreferences();
  const layout=root.createDiv('ts-collection-layout');
  this.backdrop=this.button(layout,'关闭筛选','close-drawer',()=>this.setDrawer(false));this.backdrop.addClass('ts-collection-backdrop');this.backdrop.tabIndex=-1;
  this.nav=layout.createEl('aside',{cls:'ts-collection-nav',attr:{'aria-label':'收集筛选'}});
  this.buildNavigation();
  this.main=layout.createEl('main',{cls:'ts-collection-main'});
  for(const event of ['wheel','touchstart','pointerdown'] as const)this.registerDomEvent(this.main,event,()=>{this.restoreEpoch++;});
  const header=this.main.createEl('header',{cls:'ts-collection-header'});
  this.drawerButton=this.button(header,'筛选','drawer',()=>this.setDrawer(!root.classList.contains('is-drawer-open')),'panel-left');
  this.drawerButton.setAttribute('aria-expanded','false');
  const heading=header.createDiv('ts-collection-heading');heading.createEl('h2',{text:'收集'});
  if(this.host.openBackground){const entry=this.button(header,'收集背景','background',()=>this.host.openBackground?.(entry,()=>this.current()),'palette');entry.setAttribute('aria-haspopup','menu');entry.setAttribute('aria-expanded','false');}
  this.refreshButton=this.button(header,'刷新','refresh',()=>{this.clearSelection(true);void this.refreshRecords();},'refresh-cw');
  this.buildComposer(this.main);
  const feedTools=this.main.createDiv('ts-collection-feed-tools');
  const feedHeading=feedTools.createDiv('ts-collection-feed-heading');
  this.tagHeading=feedHeading.createEl('h3',{text:'收集记录'});
  this.feedStatus=feedHeading.createSpan({cls:'ts-collection-feed-status',attr:{role:'status','aria-live':'polite'}});
  this.heatmap=new CollectionHeatmapView(this.main,{onSelectDay:day=>this.changeHeatmapDate(day),onClearDates:()=>this.changeHeatmapDate(),onCalendarContextChange:()=>this.changeCalendarContext()},feedTools);
  this.searchPanel=this.main.createDiv({cls:'ts-collection-search-progress'});
  this.searchFeedback=this.searchPanel.createEl('p',{attr:{role:'status','aria-live':'polite','data-collection-search-status':'true'}});
  this.cancelSearchButton=this.button(this.searchPanel,'取消搜索','cancel-search',()=>{this.clearSelection(true);this.cancelSearch('搜索已取消，可重试。');if(this.manualBodyMode&&this.includeBody)this.bodyAwaitingStart=true;this.renderFeed();this.syncSearchFeedback();},'x');
  this.retrySearchButton=this.button(this.searchPanel,'重试','retry-search',()=>{this.clearSelection(true);void this.refreshRecords(true,true);},'refresh-cw');
  this.startSearchButton=this.button(this.searchPanel,'开始搜索','start-search',()=>this.requestSearch(0,true),'search');
  this.syncSearchFeedback();
  this.browseNotice=this.main.createEl('p',{cls:'ts-collection-browse-notice',attr:{role:'status','aria-live':'polite','data-collection-browse-status':'true'}});this.browseNotice.hidden=true;
  this.buildSelection(this.main,feedTools);
  this.batchPanel=this.main.createEl('section',{cls:'ts-collection-batch',attr:{'aria-label':'批量操作'}});this.batchPanel.hidden=true;
  this.feed=this.main.createDiv({cls:'ts-collection-feed',attr:{'aria-label':'收集记录'}});
  this.pagination=this.main.createDiv('ts-collection-pagination');
  this.unbindViewport=bindMobileViewport(root);
  this.registerDomEvent(root,'keydown',event=>this.keydown(event));
  this.registerEvent(this.app.workspace.on('active-leaf-change',leaf=>{if(leaf!==this.leaf){this.navigationEpoch++;this.clearSelection(true);if(this.searchBusy||this.searchTimer){this.cancelSearch('搜索已暂停，可重试。');this.renderFeed();}this.setDrawer(false,false);}}));
  this.unsubscribe=this.host.subscribe(kind=>{
   if(!this.alive)return;
   if(kind==='batches'){void this.loadBatchReports();return;}
   this.syncDraft();
   if(kind==='filters'){void this.loadSavedFilters();return;}
   if(kind==='records'){if(!this.batchRunning)this.clearSelection(false);this.stale=true;this.syncRefresh();if(this.searchBusy||this.searchTimer){this.cancelSearch('记录有更新，请重新搜索。');this.renderFeed();}this.membershipEpoch++;if(this.membershipTimer)clearTimeout(this.membershipTimer);this.membershipTimer=setTimeout(()=>{this.membershipTimer=undefined;void this.refreshMembership();},80);}
  });
  this.syncDraft();
  const stateEpoch=this.stateEpoch;
  try{await this.host.ready();if(this.current()){void this.loadSavedFilters();void this.loadBatchReports();}if(!this.alive||stateEpoch!==this.stateEpoch)return;this.preparing=false;this.syncDraft();this.app.workspace.requestSaveLayout();await this.refreshRecords();}
  catch(error){if(stateEpoch===this.stateEpoch)this.preparing=false;this.report(error);this.syncDraft();}
 }
 onResize(){this.fitBodyInput();}
 async onClose(){
  this.batchStopRequested=true;this.batchEpoch++;this.savedEpoch++;this.historyEpoch++;this.alive=false;this.stateEpoch++;this.navigationEpoch++;this.listEpoch++;this.renderEpoch++;this.restoreEpoch++;
  this.cancelSearch();
  if(this.membershipTimer)clearTimeout(this.membershipTimer);this.membershipTimer=undefined;this.membershipEpoch++;
  this.unsubscribe?.();this.unsubscribe=undefined;this.unbindViewport?.();this.unbindViewport=undefined;
  this.attachmentBrowser?.close();this.attachmentBrowser=undefined;this.noteExport?.close();this.noteExport=undefined;this.review=undefined;this.heatmap?.destroy();this.heatmap=undefined;
  if(this.submitHotkey)this.scope?.unregister(this.submitHotkey);this.submitHotkey=undefined;
  this.disposeCards();this.host.release?.();this.contentEl.removeClass('ts-collection-content');this.contentEl.empty();
 }
 private current(){return this.alive&&this.contentEl.isConnected&&!!this.contentEl.ownerDocument.defaultView&&!this.contentEl.ownerDocument.defaultView.closed;}
 /** Retain filters and the actual focused control; no note or draft changes. */
 captureCollectionLocation():CollectionBrowseLocation {
  const active=this.contentEl.ownerDocument.activeElement as HTMLElement|null,card=active?.closest<HTMLElement>('[data-collection-id]');
  const top=this.main?.getBoundingClientRect().top||0,anchor=this.cards.find(item=>item.row.getBoundingClientRect().bottom>top);
  return{page:this.page,scroll:this.main?.scrollTop||0,focus:active&&this.contentEl.contains(active)?active:undefined,recordId:card?.dataset.collectionId,action:active?.dataset.collectionAction,nodeId:active?.dataset.collectionNode,boardPath:active?.dataset.collectionBoard,anchorId:anchor?.record.id,anchorOffset:anchor?anchor.row.getBoundingClientRect().top-top:undefined,expanded:this.cards.filter(item=>item.expanded).map(item=>item.record.id)};
 }
 async restoreCollectionLocation(location:CollectionBrowseLocation,current:()=>boolean,preserveBatch=false){
  if(!this.current()||!current())return;
  const epoch=++this.restoreEpoch;let render=this.renderEpoch;const valid=()=>this.current()&&current()&&epoch===this.restoreEpoch&&render===this.renderEpoch;
  if(this.page!==location.page){this.clearSelection(!preserveBatch);this.page=location.page;this.renderFeed();}
  render=this.renderEpoch;
  const expandedRenders:Promise<void>[]=[];for(const card of this.cards)if(location.expanded?.includes(card.record.id)&&!card.expanded){card.expanded=true;if(card.loaded)expandedRenders.push(this.renderBody(card,this.renderEpoch).catch(error=>this.report(error)));}
  if(this.main)this.main.scrollTop=location.scroll;
  const anchor=this.cards.find(item=>item.record.id===location.anchorId);await Promise.all(expandedRenders);await this.preparePosition(anchor);if(!valid())return;
  if(this.main){this.main.scrollTop=location.scroll;if(anchor&&location.anchorOffset!==undefined)this.main.scrollTop+=anchor.row.getBoundingClientRect().top-this.main.getBoundingClientRect().top-location.anchorOffset;}
  const card=this.cards.find(item=>item.record.id===location.recordId),fallback=location.action&&card?Array.from(card.row.querySelectorAll<HTMLElement>('[data-collection-action]')).find(button=>button.dataset.collectionAction===location.action&&(!location.nodeId||button.dataset.collectionNode===location.nodeId&&button.dataset.collectionBoard===location.boardPath)):undefined;
  if(fallback?.closest('details'))(fallback.closest('details') as HTMLDetailsElement).open=true;
  (location.focus?.isConnected&&this.contentEl.contains(location.focus)?location.focus:fallback||card?.row||this.tagHeading)?.focus({preventScroll:true});
 }
 private async preparePosition(anchor?:CardPreview){const prefix=this.cards.slice(0,anchor?this.cards.indexOf(anchor)+1:this.cards.length);for(const card of prefix)this.enqueueRead(card);await Promise.all(prefix.flatMap(card=>card.previewReady?[card.previewReady]:[]));}
 async revealRecord(identity:{id:string;createdAt:string},current:()=>boolean){
  if(!this.current()||!current())return;
  this.clearSelection(true);
  if(this.searchBusy||this.searchTimer)this.cancelSearch('搜索已暂停，可重试。');
  const epoch=++this.restoreEpoch;let render=this.renderEpoch;const valid=()=>this.current()&&current()&&epoch===this.restoreEpoch&&render===this.renderEpoch,records=await this.host.list();if(!valid())return;
  const found=records.filter(record=>record.id===identity.id&&record.createdAt===identity.createdAt);
  if(found.length!==1)throw Error(found.length?'收集标识有重复，请先核对原笔记':'原记录已移除或收集属性已变化');
  const reviewing=this.review?.items[this.review.index];if(this.review&&(!reviewing||!this.sameRecord(reviewing,found[0]))){this.review=undefined;this.noteExport?.close();this.noteExport=undefined;}
  this.located={...identity,origin:this.located?.origin||this.captureCollectionLocation()};this.records=records;
  const filtered=this.filteredRecords(),index=filtered.findIndex(record=>this.sameRecord(record,found[0]));if(index>=0)this.page=Math.floor(index/PAGE_SIZE);
  this.setDrawer(false,false);this.renderNavigation();this.renderFeed();
  render=this.renderEpoch;
  const card=this.cards.find(item=>this.sameRecord(item.record,found[0]));await this.preparePosition(card);if(card&&valid()){
   card.row.focus({preventScroll:true});if(this.main)this.main.scrollTop=Math.max(0,this.main.scrollTop+card.row.getBoundingClientRect().top-this.main.getBoundingClientRect().top-12);
  }
 }
 private async dismissLocated(){this.clearSelection(true);const origin=this.located?.origin,current=this.invocation();this.located=undefined;if(origin)this.page=origin.page;this.renderFeed();if(origin)await this.restoreCollectionLocation(origin,current);}
 private async refreshMembership(){
  const epoch=++this.membershipEpoch,search=this.searchResult,searchEpoch=this.searchEpoch;
  try{const records=await this.host.list();if(!this.current()||epoch!==this.membershipEpoch)return;
   // A native property save can temporarily remove a record from the metadata
   // index. Restoring that identity must refresh the query just like a changed
   // flag; comparing only records present in both snapshots leaves cached hits
   // permanently incomplete. Include every metadata field that affects matching
   // or ordering, while placement-chip-only updates retain their mounted rows.
   const key=(record:CollectionRecord)=>JSON.stringify([record.id,record.createdAt,record.path]),previousRecords=new Map(this.records.map(record=>[key(record),record]));
   const metadataChanged=records.length!==this.records.length||records.some(record=>{const previous=previousRecords.get(key(record));return!previous||previous.title!==record.title||previous.inBoard!==record.inBoard||!!previous.pinned!==!!record.pinned||!!previous.archived!==!!record.archived||previous.tasks?.total!==record.tasks?.total||previous.tasks?.done!==record.tasks?.done||previous.tags.length!==record.tags.length||previous.tags.some((tag,index)=>tag!==record.tags[index]);});
   const flagsChanged=records.some(record=>{const previous=previousRecords.get(key(record));return previous&&(!!previous.pinned!==!!record.pinned||!!previous.archived!==!!record.archived);});
   this.records=records;this.syncHeatmap();
   if(this.review&&this.review.items[this.review.index]&&!this.reviewRecord()){this.reviewIdentityEpoch++;this.noteExport?.close();this.noteExport=undefined;this.renderFeed();return;}
   for(const card of this.cards){const matches=records.filter(record=>record.id===card.record.id&&record.createdAt===card.record.createdAt);const record=matches.length===1?matches[0]:matches.find(item=>item.path===card.record.path);if(record){card.record=record;card.row.dataset.path=record.path;this.renderPlacements(card);this.renderTaskProgress(card);}else if(card.placements){card.placements.empty();card.placements.createSpan({text:'原记录已移除 · 刷新查看'});}}
   const completed=search&&search===this.searchResult&&searchEpoch===this.searchEpoch&&search.epoch===this.searchEpoch&&search.key===this.searchKey();
   // Reconcile only a completed metadata query. A cancelled/in-flight body
   // search still requires explicit retry, and an older membership read must
   // never start another search after the user changes the query.
   // A mounted delivery panel may own a failed-save receipt and its exact
   // target. Refresh its source identity above without invalidating the retry
   // invocation by rebuilding its card. Only an explicit browse action may do
   // that; background metadata changes remain visible as a refresh prompt.
   const deliveryActive=this.cards.some(card=>!!card.row.querySelector('.ts-collection-delivery')||card.row.querySelector<HTMLElement>('.ts-collection-card-actions')?.dataset.deliveryPicking==='true');
   if(metadataChanged&&deliveryActive){this.stale=true;this.syncRefresh();this.searchMessage='记录有更新，当前投递操作已保留。刷新后查看最新结果。';this.syncSearchFeedback();}
   else if(metadataChanged&&completed&&!this.includeBody||!this.host.search&&flagsChanged)await this.refreshRecords(true,false,true);
   else if(metadataChanged&&completed&&this.includeBody){this.stale=true;this.syncRefresh();this.searchMessage='记录有更新，当前显示上次搜索结果。请重试。';this.syncSearchFeedback();}
  }catch{/* Keep the last verified list and its visible refresh prompt. */}
 }
 private openAttachmentBrowser(){
  if(!this.host.attachmentPage||!this.host.openContext||!this.host.validateContext||!this.current())return;
  this.setDrawer(false,false);this.attachmentBrowser?.close();const base=this.invocation();
  const browser=new CollectionAttachmentBrowser(this.app,this.contentEl.ownerDocument,{
   current:base,accent:()=>this.host.accent?.()||'forest',density:()=>this.host.density?.()||'comfortable',
   list:(query,current)=>this.host.attachmentPage!(query,()=>base()&&current()),
   open:(item,current)=>this.host.openContext!(item.source,item,()=>base()&&current()),
   source:async(item,current)=>{await this.host.validateContext!(item.source,item,()=>base()&&current());if(!base()||!current())throw Error('页面已变化，已取消返回');await this.revealRecord(item.source,()=>base()&&current());},
   subscribe:changed=>this.host.subscribe(kind=>{if(kind==='records')changed();}),
   closed:()=>{if(this.attachmentBrowser===browser)this.attachmentBrowser=undefined;},
  });this.attachmentBrowser=browser;browser.open();
 }
 private buildRecordContext(card:CardPreview,render:number){
  if(!this.host.inspectContext)return;
  const detail=card.row.createEl('details',{cls:'ts-collection-record-context',attr:{'data-collection-context':'true'}});detail.createEl('summary',{text:'引用与附件'});
  const body=detail.createDiv('ts-collection-context-body');let request=0;
  const load=async()=>{const epoch=++request,base=this.invocation(),current=()=>base()&&render===this.renderEpoch&&this.cards.includes(card)&&detail.open&&epoch===request;body.empty();body.createEl('p',{text:'正在读取原生链接…',attr:{role:'status'}});
   try{const data=await this.host.inspectContext!(card.record,current);if(!current())return;body.empty();
    if(!data.metadataReady||data.unknown)body.createEl('p',{text:'部分原生索引尚未就绪，结果可能不完整。'});
    const sections=[['outgoing','引用',data.outgoing],['incoming','被引用',data.incoming],['attachments','附件',data.attachments]] as const;
    for(const[kind,label,items]of sections){const section=body.createEl('section',{attr:{'data-collection-context-list':kind}});section.createEl('h4',{text:`${label} · ${data.total[kind]}`});
     if(!items.length)section.createEl('p',{text:'暂无'+label});
     for(const item of items){const row=section.createDiv('ts-collection-context-row');const button=this.button(row,item.title||item.path,'context-open',()=>this.runAction(()=>this.host.openContext?.(card.record,item,current)),item.kind==='note'?'file-text':'paperclip');button.dataset.contextKey=item.key;button.dataset.contextPath=item.path;button.disabled=!!item.missing||!this.host.openContext;button.setAttribute('title',item.path);row.createEl('small',{text:item.missing?'链接尚未解析 · '+item.path:item.path+(item.count>1?` · ${item.count} 处`: '')});}
    }
    if(data.truncated)body.createEl('p',{text:'每组最多显示 100 项；完整内容可在原笔记查看。'});
    this.button(body,'刷新引用','context-refresh',()=>{void load();},'refresh-cw');
   }catch(error){if(current()){body.empty();body.createEl('p',{text:error instanceof Error?error.message:String(error),attr:{role:'status'}});this.button(body,'重试','context-refresh',()=>{void load();},'refresh-cw');}}
  };
  detail.addEventListener('toggle',()=>{if(detail.open)void load();else request++;});
 }
 private renderTaskProgress(card:CardPreview){
  const box=card.taskProgress;if(!box)return;const tasks=card.record.tasks;box.empty();box.hidden=!tasks?.total;if(!tasks?.total)return;
  box.createSpan({text:`任务 ${tasks.done} / ${tasks.total}`,attr:{'data-collection-task-label':'true'}});const progress=box.createEl('progress',{attr:{max:String(tasks.total),value:String(tasks.done),'aria-label':`已完成 ${tasks.done} 项，共 ${tasks.total} 项任务`}});progress.max=tasks.total;progress.value=tasks.done;
 }
 private renderPlacements(card:CardPreview){
  const box=card.placements;if(!box)return;const record=card.record,placements=record.placements||[],signature=JSON.stringify([placements,record.inBoard,record.placementsComplete]);if(box.dataset.signature===signature)return;const active=this.contentEl.ownerDocument.activeElement as HTMLElement|null,hadFocus=!!active&&box.contains(active),node=active?.dataset.collectionNode,board=active?.dataset.collectionBoard,open=box.querySelector('details')?.open;box.dataset.signature=signature;box.empty();
  if(!placements.length){if(record.inBoard!==false)box.createSpan({text:record.inBoard==='unknown'?'白板引用待确认':'已放入白板'});if(hadFocus&&this.app.workspace.activeLeaf===this.leaf)card.row.focus({preventScroll:true});return;}
  const add=(parent:HTMLElement,reference:CollectionBoardReference,index:number)=>{const repeated=placements.filter(item=>item.boardPath===reference.boardPath).length>1,label=reference.boardTitle+(repeated?` · 引用 ${index+1}`:'');const button=this.button(parent,label,'locate-board',()=>this.runAction(()=>this.host.locateBoard?.(card.record,reference)),'panels-top-left');button.setAttribute('title',`${reference.boardPath} · ${reference.nodeTitle}`);button.dataset.collectionBoard=reference.boardPath;button.dataset.collectionNode=reference.nodeId;};
  if(placements.length===1)add(box,placements[0],0);
  else{const details=box.createEl('details',{cls:'ts-collection-placement-list'});details.createEl('summary',{text:`所在白板 · ${placements.length} 处`});const counts=new Map<string,number>();for(const placement of placements.slice(0,8)){const index=counts.get(placement.boardPath)||0;counts.set(placement.boardPath,index+1);add(details,placement,index);}if(placements.length>8)this.button(details,`查看全部 ${placements.length} 处引用`,'occurrences',()=>this.runAction(()=>this.host.showOccurrences(card.record)),'list');}
  if(record.placementsComplete===false)box.createSpan({text:'部分引用待确认'});
  const details=box.querySelector('details');if(details&&open)details.open=true;
  if(hadFocus&&this.app.workspace.activeLeaf===this.leaf){const replacement=Array.from(box.querySelectorAll<HTMLElement>('button')).find(button=>button.dataset.collectionNode===node&&button.dataset.collectionBoard===board);(replacement||card.row).focus({preventScroll:true});}
 }
 private invocation(){const navigation=this.navigationEpoch,state=this.stateEpoch,doc=this.contentEl.ownerDocument;return()=>this.current()&&navigation===this.navigationEpoch&&state===this.stateEpoch&&this.contentEl.ownerDocument===doc;}
 private button(parent:HTMLElement,label:string,action:string,run:()=>void,icon?:string){
  const button=parent.createEl('button',{attr:{type:'button','aria-label':label,'data-collection-action':action}});
  if(icon)setIcon(button.createSpan({cls:'ts-collection-button-icon',attr:{'aria-hidden':'true'}}),icon);
  button.createSpan({text:label});button.onclick=run;return button;
 }
 private buildNavigation(){
  const nav=this.nav!;const navHead=nav.createDiv('ts-collection-nav-heading');navHead.createEl('h3',{text:'筛选'});
  this.button(navHead,'关闭筛选','close-drawer',()=>this.setDrawer(false),'x');
  const scope=nav.createDiv({cls:'ts-collection-scopes',attr:{role:'group','aria-label':'记录范围'}});
  this.allButton=this.button(scope,'收集记录','filter-all',()=>this.changeFilter('all'),'layers');this.allButton.dataset.collectionFilter='all';
  this.unplacedButton=this.button(scope,'未放入白板','filter-unplaced',()=>this.changeFilter('unplaced'),'inbox');this.unplacedButton.dataset.collectionFilter='unplaced';
  this.placedButton=this.button(scope,'已放入白板','filter-placed',()=>this.changeFilter('placed'),'panels-top-left');this.placedButton.dataset.collectionFilter='placed';
  this.archivedButton=this.button(scope,'已归档','filter-archived',()=>this.changeFilter('archived'),'archive');this.archivedButton.dataset.collectionFilter='archived';
  if(this.host.attachmentPage)this.button(scope,'附件','browse-attachments',()=>this.openAttachmentBrowser(),'paperclip');
  const searchLabel=nav.createEl('label',{cls:'ts-collection-search-label'});searchLabel.createSpan({cls:'ts-collection-sr-only',text:'搜索'});
  this.search=searchLabel.createEl('input',{type:'search',attr:{placeholder:'标题、路径或 #标签','aria-label':'搜索收集','data-collection-search':'true',maxlength:'2000'}});
  this.search.oninput=()=>{this.query=this.search!.value;this.page=0;this.requestSearch(200);};
  this.search.addEventListener('compositionstart',()=>{this.searchComposing=true;this.clearSelection(true);this.cancelSearch();if(this.manualBodyMode&&this.includeBody)this.bodyAwaitingStart=true;this.restoreEpoch++;});
  this.search.addEventListener('compositionend',()=>{this.searchComposing=false;this.query=this.search!.value;this.page=0;this.requestSearch(200);});
  this.search.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&Reflect.get(event,'keyCode')!==229&&!this.searchComposing){event.preventDefault();this.requestSearch(0,true);this.setDrawer(false,false);this.tagHeading?.focus({preventScroll:true});}});
  const advanced=nav.createEl('details',{cls:'ts-collection-search-options',attr:{'data-collection-search-options':'true'}});
  advanced.createEl('summary',{text:'组合筛选'});
  const fields=advanced.createDiv('ts-collection-search-fields');
  const bodyLabel=fields.createEl('label',{cls:'ts-collection-check-field'});this.bodySearchToggle=bodyLabel.createEl('input',{type:'checkbox',attr:{'data-collection-include-body':'true'}});bodyLabel.createSpan({text:'包含正文'});
  this.bodySearchToggle.onchange=()=>{this.includeBody=this.bodySearchToggle!.checked;if(!this.includeBody){this.manualBodyMode=false;this.bodyAwaitingStart=false;}this.search?.setAttribute('placeholder',this.includeBody?'正文、标题、路径或 #标签':'标题、路径或 #标签');this.page=0;this.requestSearch();};
  const pinLabel=fields.createEl('label',{cls:'ts-collection-check-field'});this.pinnedToggle=pinLabel.createEl('input',{type:'checkbox',attr:{'data-collection-pinned-only':'true'}});pinLabel.createSpan({text:'仅置顶'});
  this.pinnedToggle.onchange=()=>{this.pinnedOnly=this.pinnedToggle!.checked;this.page=0;this.requestSearch();};
  const taskLabel=fields.createEl('label',{cls:'ts-collection-field'});taskLabel.createSpan({text:'任务'});this.taskSelect=taskLabel.createEl('select',{attr:{'aria-label':'任务筛选','data-collection-task-filter':'true'}});
  for(const[value,text]of [['all','全部记录'],['any','含任务'],['todo','有未完成任务'],['done','任务全部完成'],['none','无任务']])this.taskSelect.createEl('option',{value,text});
  this.taskSelect.onchange=()=>{this.taskFilter=this.taskSelect!.value as CollectionTaskFilter;this.page=0;this.appliedFilterId=undefined;this.renderSavedFilters();if(this.includeBody)this.manualBodyMode=true;this.requestSearch();};
  taskLabel.createEl('small',{text:'按原生任务索引；索引未知的记录不参与任务筛选，自定义状态计为未完成。'});
  const dates=fields.createDiv('ts-collection-search-dates');
  const sinceLabel=dates.createEl('label',{cls:'ts-collection-field'});sinceLabel.createSpan({text:'开始日期'});this.sinceInput=sinceLabel.createEl('input',{type:'date',attr:{'aria-label':'开始日期','data-collection-since':'true'}});
  const untilLabel=dates.createEl('label',{cls:'ts-collection-field'});untilLabel.createSpan({text:'结束日期'});this.untilInput=untilLabel.createEl('input',{type:'date',attr:{'aria-label':'结束日期','data-collection-until':'true'}});
  this.sinceInput.onchange=()=>{this.since=this.sinceInput!.value;this.page=0;this.requestSearch();};this.untilInput.onchange=()=>{this.until=this.untilInput!.value;this.page=0;this.requestSearch();};
  fields.createEl('p',{cls:'ts-collection-search-hint',text:'空格连接多个词；#标签 包含，-#标签 排除。日期包含当天。'});
  this.button(fields,'清除筛选','clear-filters',()=>this.clearFilters(),'x');
  this.buildSavedFilters(nav);
  const tags=nav.createEl('details',{cls:'ts-collection-tag-browser'});tags.createEl('summary',{text:'标签'});this.tagsList=tags.createDiv('ts-collection-tag-list');
  const tail=nav.createDiv('ts-collection-nav-tail');
  this.button(tail,'旧收件箱','legacy-inbox',()=>this.runAction(()=>this.host.openLegacyInbox()),'archive').setAttribute('title','打开原来的收件箱笔记范围');
 }
 private buildSavedFilters(nav:HTMLElement){
  if(!this.host.savedFilters)return;
  const box=nav.createEl('details',{cls:'ts-collection-saved-filters',attr:{'data-collection-saved-filters':'true'}});box.createEl('summary',{text:'已保存的筛选'});
  this.savedEntry=this.button(box,'保存当前筛选…','show-save-filter',()=>{if(this.savedForm){this.savedForm.hidden=false;this.savedName?.focus();}},'bookmark-plus');
  this.savedForm=box.createDiv('ts-collection-save-filter');this.savedForm.hidden=true;
  const label=this.savedForm.createEl('label',{cls:'ts-collection-field'});label.createSpan({text:'筛选名称'});this.savedName=label.createEl('input',{type:'text',attr:{'data-collection-filter-name':'true','aria-label':'筛选名称',maxlength:'80'}});
  this.savedSave=this.button(this.savedForm,'保存','save-filter',()=>{void this.saveCurrentFilter();},'check');
  this.button(this.savedForm,'取消','cancel-save-filter',()=>{if(this.savedForm)this.savedForm.hidden=true;});
  this.savedName.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&Reflect.get(event,'keyCode')!==229){event.preventDefault();void this.saveCurrentFilter();}});
  this.savedStatus=box.createEl('p',{attr:{role:'status','aria-live':'polite','data-collection-filter-status':'true'}});
  this.savedList=box.createDiv('ts-collection-saved-list');this.renderSavedFilters();
 }
 private async loadSavedFilters(){
  if(!this.host.savedFilters)return;const epoch=++this.savedEpoch;
  try{const result=await this.host.savedFilters();if(!this.current()||epoch!==this.savedEpoch)return;this.saved=result.filters;this.savedWarning=result.warning||'';this.renderSavedFilters();}
  catch(error){if(this.current()&&epoch===this.savedEpoch){this.savedWarning=error instanceof Error?error.message:String(error);this.renderSavedFilters();}}
 }
 private renderSavedFilters(){
  if(!this.savedList)return;this.savedList.empty();this.savedStatus?.setText(this.savedWarning||this.savedMessage);
  if(this.savedEntry)this.savedEntry.disabled=!!this.savedWarning||this.savedBusy||!this.host.saveFilter;
  if(this.savedSave)this.savedSave.disabled=!!this.savedWarning||this.savedBusy||!this.host.saveFilter;
  if(this.savedName)this.savedName.disabled=this.savedBusy;
  if(!this.saved.length)this.savedList.createEl('p',{text:'保存常用条件，下次直接应用。'});
  for(const filter of this.saved){
   const row=this.savedList.createDiv({cls:'ts-collection-saved-row',attr:{'data-collection-saved-filter':filter.id}});
   const apply=this.button(row,filter.name,'apply-filter',()=>this.applySavedFilter(filter),'bookmark');apply.setAttribute('aria-pressed',String(this.appliedFilterId===filter.id));
   if(filter.options.includeBody)row.createSpan({cls:'ts-collection-state-badge',text:'含正文 · 应用后手动开始'});
   const remove=this.button(row,'删除筛选','delete-filter',()=>{this.deletingFilterId=filter.id;this.renderSavedFilters();},'trash-2');remove.disabled=!!this.savedWarning||this.savedBusy||!this.host.deleteFilter;
   if(this.deletingFilterId===filter.id){const confirm=row.createDiv('ts-collection-filter-delete');confirm.createEl('p',{text:`删除“${filter.name}”？记录不受影响。`});const button=this.button(confirm,'确认删除','confirm-delete-filter',()=>{void this.deleteSavedFilter(filter.id);});button.disabled=!!this.savedWarning||this.savedBusy;this.button(confirm,'保留','cancel-delete-filter',()=>{this.deletingFilterId=undefined;this.renderSavedFilters();});}
  }
 }
 private async saveCurrentFilter(){
  if(!this.host.saveFilter||this.savedBusy||this.savedWarning||!this.current())return;
  const current=this.invocation(),options=this.searchOptions(),name=this.savedName?.value||'';this.savedBusy=true;this.savedMessage='正在保存筛选…';this.renderSavedFilters();
  try{const saved=await this.host.saveFilter(name,options,current);if(current()){this.appliedFilterId=saved.id;this.savedMessage='筛选已保存。';if(this.savedForm)this.savedForm.hidden=true;if(this.savedName)this.savedName.value='';await this.loadSavedFilters();}}
  catch(error){if(current())this.savedMessage=error instanceof Error?error.message:String(error);}
  finally{this.savedBusy=false;if(this.current())this.renderSavedFilters();}
 }
 private async deleteSavedFilter(id:string){
  if(!this.host.deleteFilter||this.savedBusy||this.savedWarning||!this.current())return;
  const current=this.invocation();this.savedBusy=true;this.savedMessage='正在删除筛选…';this.renderSavedFilters();
  try{await this.host.deleteFilter(id,current);if(current()){if(this.appliedFilterId===id)this.appliedFilterId=undefined;this.deletingFilterId=undefined;this.savedMessage='已删除保存的筛选，当前条件保持不变。';await this.loadSavedFilters();}}
  catch(error){if(current())this.savedMessage=error instanceof Error?error.message:String(error);}
  finally{this.savedBusy=false;if(this.current())this.renderSavedFilters();}
 }
 private applySavedFilter(saved:SavedCollectionFilter){
  const options=saved.options;this.query=options.query;this.tag='';this.filter=options.scope||'all';this.includeBody=!!options.includeBody;this.pinnedOnly=!!options.pinnedOnly;this.since=options.since||'';this.until=options.until||'';this.taskFilter=options.tasks||'all';if(this.taskSelect)this.taskSelect.value=this.taskFilter;this.page=0;this.searchComposing=false;
  this.appliedFilterId=saved.id;this.manualBodyMode=this.includeBody;
  if(this.search){this.search.value=this.query;this.search.setAttribute('placeholder',this.includeBody?'正文、标题、路径或 #标签':'标题、路径或 #标签');}
  if(this.bodySearchToggle)this.bodySearchToggle.checked=this.includeBody;if(this.pinnedToggle)this.pinnedToggle.checked=this.pinnedOnly;if(this.sinceInput)this.sinceInput.value=this.since;if(this.untilInput)this.untilInput.value=this.until;
  this.renderNavigation();this.renderSavedFilters();this.requestSearch();this.setDrawer(false,false);
 }
 private recordKey(record:CollectionRecord){return JSON.stringify([record.id,record.createdAt,record.path]);}
 private selectionRecords(){return this.filteredRecords().slice(this.page*PAGE_SIZE,(this.page+1)*PAGE_SIZE);}
 private canSelect(){return!this.review&&!!this.host.batch&&this.canReview()&&this.selectionRecords().length>0;}
 private canReview(){return!this.batchRunning&&!this.batchChoosing&&!this.stale&&!this.searchBusy&&!this.searchTimer&&!this.searchComposing&&!this.bodyAwaitingStart&&(!this.host.search||!!this.searchResult&&this.searchResult.epoch===this.searchEpoch&&this.searchResult.key===this.searchKey()&&!this.searchResult.value.cancelled&&this.searchResult.value.unread===0)&&this.filteredRecords().length>0;}
 private startReview(){
  if(this.review||!this.current()||!this.canReview())return;
  const items=this.filteredRecords().slice(0,500).map(record=>Object.freeze({...record,tags:Object.freeze([...record.tags])}));
  this.clearSelection(true);this.review={items:Object.freeze(items),index:0,origin:this.captureCollectionLocation(),outcomes:new Map(),busy:false,confirmArchive:false};
  this.located=undefined;if(this.organizingMenu)this.organizingMenu.open=false;this.renderFeed();this.scrollToFeed();this.cards[0]?.row.focus({preventScroll:true});
 }
 private reviewRecord(){
  const frozen=this.review?.items[this.review.index];if(!frozen)return;
  const matches=this.records.filter(record=>record.id===frozen.id&&record.createdAt===frozen.createdAt);
  return matches.length===1&&matches[0].path===frozen.path?matches[0]:undefined;
 }
 private moveReview(delta:number,later=false){
  const review=this.review;if(!review||review.busy)return;
  this.noteExport?.close();this.noteExport=undefined;
  const record=review.items[review.index];if(later&&record)review.outcomes.set(this.recordKey(record),'稍后处理');
  review.index=Math.max(0,Math.min(review.items.length,review.index+delta));review.confirmArchive=false;this.renderFeed();this.scrollToFeed();(this.cards[0]?.row||this.reviewPanel)?.focus({preventScroll:true});
 }
 private async exitReview(){
  const review=this.review;if(!review)return;this.review=undefined;this.noteExport?.close();this.noteExport=undefined;
  this.page=review.origin.page;this.renderFeed();await this.restoreCollectionLocation(review.origin,this.invocation());
 }
 private renderReview(){
  const panel=this.reviewPanel;if(!panel)return;panel.empty();const review=this.review;panel.hidden=!review;if(!review)return;
  panel.tabIndex=-1;panel.dataset.collectionReviewIndex=String(review.index);panel.dataset.collectionReviewCount=String(review.items.length);
  panel.createEl('h3',{text:review.index<review.items.length?`逐条整理 · ${review.index+1} / ${review.items.length}`:'这一轮看完了'});
  panel.createEl('p',{text:'本轮固定开始时的结果。稍后处理只跳过，送往成功后也不会自动归档。'});
  const frozen=review.items[review.index],record=this.reviewRecord(),outcome=frozen&&review.outcomes.get(this.recordKey(frozen));
  if(outcome)panel.createEl('p',{text:outcome,attr:{role:'status','data-collection-review-outcome':'true'}});
  if(frozen&&!record)panel.createEl('p',{text:'这条记录已移动、移除或身份有变化。可跳过，退出后刷新再处理。',attr:{role:'status'}});
  const controls=panel.createDiv('ts-collection-review-controls');
  const previous=this.button(controls,'上一条','review-previous',()=>this.moveReview(-1),'arrow-left');previous.disabled=review.busy||review.index===0;
  const next=this.button(controls,'下一条','review-next',()=>this.moveReview(1),'arrow-right');next.disabled=review.busy||review.index>=review.items.length;
  const skip=this.button(controls,'稍后处理','review-skip',()=>this.moveReview(1,true),'skip-forward');skip.disabled=review.busy||!frozen;
  if(record&&this.host.setFlag&&!record.archived){
   const archive=this.button(controls,'归档…','review-archive',()=>{review.confirmArchive=true;this.renderReview();},'archive');archive.disabled=review.busy;
   if(review.confirmArchive){const confirm=panel.createDiv('ts-collection-review-confirm');confirm.createEl('p',{text:'归档只隐藏这条收集记录，原笔记与引用保留。'});
    this.button(confirm,'确认归档','review-archive-confirm',()=>{void this.archiveReview();},'check').disabled=review.busy;
    this.button(confirm,'保留记录','review-archive-cancel',()=>{review.confirmArchive=false;this.renderReview();}).disabled=review.busy;}
  }
  this.button(controls,'退出整理','review-exit',()=>{void this.exitReview();},'x');
 }
 private async archiveReview(){
  const review=this.review,record=this.reviewRecord();if(!review||!record||review.busy||!review.confirmArchive||!this.host.setFlag)return;
  const index=review.index,identityEpoch=this.reviewIdentityEpoch,base=this.invocation(),current=()=>base()&&this.review===review&&review.index===index&&identityEpoch===this.reviewIdentityEpoch&&!!this.reviewRecord()&&this.sameRecord(this.reviewRecord()!,record);review.busy=true;this.renderReview();
  try{await this.host.setFlag(record,'archived',true,current);if(!current())return;review.outcomes.set(this.recordKey(record),'已归档，原笔记保留');review.busy=false;this.moveReview(1);}
  catch(error){if(current()){review.outcomes.set(this.recordKey(record),error instanceof Error?error.message:String(error));review.confirmArchive=false;}}
  finally{review.busy=false;if(this.review===review)this.renderReview();}
 }
 private buildSelection(parent:HTMLElement,tools=parent){
  this.organizingMenu=tools.createEl('details',{cls:'ts-collection-organize',attr:{'data-collection-organize':'true'}});this.organizingMenu.createEl('summary',{text:'整理'});
  this.reviewStart=this.button(this.organizingMenu,'逐条整理当前结果','review-start',()=>this.startReview(),'book-open');
  this.reviewPanel=parent.createDiv({cls:'ts-collection-review-panel',attr:{'data-collection-review':'true'}});this.reviewPanel.hidden=true;
  this.registerDomEvent(parent,'keydown',event=>{
   if(!this.review||event.defaultPrevented||event.isComposing||Reflect.get(event,'keyCode')===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
   const target=event.target as HTMLElement|null;
   if(!target||target.closest('input,textarea,select,button,a,[contenteditable=true],summary')||(!this.reviewPanel?.contains(target)&&!this.feed?.contains(target)))return;
   if(event.key==='ArrowRight'){event.preventDefault();this.moveReview(1);}else if(event.key==='ArrowLeft'){event.preventDefault();this.moveReview(-1);}else if(event.key==='Escape'){event.preventDefault();void this.exitReview();}
  });
  if(!this.host.batch)return;
  this.selectionBar=this.organizingMenu.createDiv({cls:'ts-collection-selection',attr:{'data-collection-selection':'true'}});
  this.selectModeButton=this.button(this.selectionBar,'选择当前页记录','select-mode',()=>{if(!this.canSelect())return;this.selectionMode=true;this.syncSelection();},'list-checks');
  this.selectionTools=this.selectionBar.createDiv('ts-collection-selection-tools');
  this.selectionStatus=this.selectionTools.createSpan({attr:{role:'status','aria-live':'polite','data-collection-selection-status':'true'}});
  this.button(this.selectionTools,'全选本页','select-page',()=>{if(!this.canSelect())return;this.selectionEpoch++;this.batchReview=undefined;for(const record of this.selectionRecords())this.selected.set(this.recordKey(record),{...record,tags:[...record.tags]});this.syncSelection();this.renderBatchPanel();});
  this.button(this.selectionTools,'取消选择','clear-selection',()=>this.clearSelection(true),'x');
  this.button(this.selectionTools,'送往白板…','batch-deliver',()=>{void this.prepareBatch('deliver');},'panels-top-left');
  this.button(this.selectionTools,'归档…','batch-archive',()=>{void this.prepareBatch('archive');},'archive');
  this.button(this.selectionTools,'恢复…','batch-restore',()=>{void this.prepareBatch('restore');},'archive-restore');
  this.syncSelection();
 }
 private syncSelection(){
  if(this.reviewStart){this.reviewStart.disabled=!!this.review||!this.canReview();const count=this.filteredRecords().length;this.reviewStart.querySelector('span:last-child')?.setText(count>500?'逐条整理前 500 条结果':'逐条整理当前结果');}
  if(!this.selectionBar)return;const available=this.canSelect();
  this.selectionBar.dataset.collectionSelectionState=this.batchRunning?'running':this.selectionMode?'selecting':'idle';
  if(this.selectModeButton){this.selectModeButton.hidden=this.selectionMode;this.selectModeButton.disabled=!available;this.selectModeButton.setAttribute('title',this.searchResult?.value.unread?'部分正文未能读取，重试取得完整结果后可选择。':this.stale?'刷新记录后可选择。':available?'仅选择当前页，最多 24 条。':'请等待完整搜索结果。');}
  if(this.selectionTools)this.selectionTools.hidden=!this.selectionMode;
  this.selectionStatus?.setText(`已选 ${this.selected.size} / ${this.selectionRecords().length} 条 · 仅当前页`);
  this.selectionTools?.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{const action=button.dataset.collectionAction;button.disabled=action==='clear-selection'?false:!available||action?.startsWith('batch-')&&!this.selected.size||false;});
  for(const card of this.cards){const label=card.row.querySelector<HTMLElement>('.ts-collection-selection-check'),check=label?.querySelector<HTMLInputElement>('input');if(label)label.hidden=!this.selectionMode;if(check){check.checked=this.selected.has(this.recordKey(card.record));check.disabled=!available;}card.row.toggleClass('is-selected',this.selected.has(this.recordKey(card.record)));}
 }
 private clearSelection(stopBatch:boolean){
  this.selectionEpoch++;this.selectionMode=false;this.selected.clear();this.batchReview=undefined;
  if(stopBatch&&this.batchRunning){this.batchStopRequested=true;this.batchMessage='正在停止后续操作；已开始的记录仍需等待保存回执。';}
  this.syncSelection();this.renderBatchPanel();
 }
 private selectRecord(record:CollectionRecord,checked:boolean){
  if(!this.selectionMode||!this.canSelect())return;const visible=this.selectionRecords().find(item=>this.sameRecord(item,record));if(!visible)return;
  this.selectionEpoch++;this.batchReview=undefined;
  if(checked&&this.selected.size<PAGE_SIZE)this.selected.set(this.recordKey(record),{...record,tags:[...record.tags]});else if(!checked)this.selected.delete(this.recordKey(record));
  this.syncSelection();this.renderBatchPanel();
 }
 private async prepareBatch(operation:CollectionBatchOperation){
  if(!this.canSelect()||!this.selected.size)return;
  const epoch=++this.selectionEpoch,base=this.invocation(),current=()=>base()&&epoch===this.selectionEpoch&&!this.batchRunning;
  const items=this.selectionRecords().filter(record=>this.selected.has(this.recordKey(record))).map(record=>({...record,tags:[...record.tags]}));
  if(!items.length||items.length>PAGE_SIZE)return;
  this.batchMessage='';this.batchReview=undefined;this.batchChoosing=true;this.syncSelection();
  try{const target=operation==='deliver'?await this.host.pickTarget(current):undefined;if(!current()||operation==='deliver'&&!target)return;this.batchReview={items,operation,target,epoch};this.renderBatchPanel();}
  catch(error){if(current()){this.batchMessage=error instanceof Error?error.message:String(error);this.renderBatchPanel();}}
  finally{this.batchChoosing=false;if(this.current())this.syncSelection();}
 }
 private async confirmBatch(){
  const review=this.batchReview;if(!review||review.epoch!==this.selectionEpoch||this.batchRunning||!this.host.batch||!this.current())return;
  const request:CollectionBatchRequest={items:review.items.map(record=>({...record,tags:[...record.tags]})),operation:review.operation,...(review.target?{target:{...review.target,groups:[...review.target.groups]}}:{})};
  const epoch=++this.batchEpoch,base=this.invocation(),current=()=>base()&&epoch===this.batchEpoch&&!this.batchStopRequested;
  this.batchRunning=true;this.batchStopRequested=false;this.batchMessage='正在准备批量操作…';this.batchReport=undefined;this.batchReview=undefined;this.selectionMode=false;this.selected.clear();this.selectionEpoch++;this.syncSelection();this.renderBatchPanel();
  // A frozen batch outlives its card renders and its own index invalidations.
  // Stop only future items; keep receiving the in-flight item's exact outcome.
  const display=(report:CollectionBatchReport)=>{if(this.current()&&epoch===this.batchEpoch){this.batchReport=report;this.batchMessage=this.batchStopRequested?'正在停止后续操作；已开始的记录仍需等待保存回执。':'';this.renderBatchPanel();}};
  try{display(await this.host.batch(request,current,display));}
  catch(error){if(this.current()&&epoch===this.batchEpoch){this.batchMessage=(error instanceof Error?error.message:String(error))+'；请核对批量报告和原记录，不会自动重试。';}}
  finally{if(epoch===this.batchEpoch){this.batchRunning=false;if(this.batchStopRequested&&this.batchReport)this.batchMessage='后续操作已停止；各条记录以报告中的回执为准。';if(this.current()){this.syncSelection();this.renderBatchPanel();void this.loadBatchReports();}}}
 }
 private async loadBatchReports(){
  if(!this.host.batchReports)return;const epoch=++this.historyEpoch;
  try{const result=await this.host.batchReports();if(!this.current()||epoch!==this.historyEpoch)return;this.batchHistory=result.reports;this.batchHistoryWarning=result.warning||'';this.renderBatchPanel();}
  catch(error){if(this.current()&&epoch===this.historyEpoch){this.batchHistoryWarning=error instanceof Error?error.message:String(error);this.renderBatchPanel();}}
 }
 private renderBatchPanel(){
  const panel=this.batchPanel;if(!panel)return;
  const focus=this.contentEl.ownerDocument.activeElement as HTMLElement|null,focusedAction=focus&&panel.contains(focus)?focus.dataset.collectionAction:undefined;
  panel.empty();panel.hidden=!this.batchReview&&!this.batchReport&&!this.batchHistory.length&&!this.batchMessage&&!this.batchHistoryWarning;
  if(this.batchMessage)panel.createEl('p',{text:this.batchMessage,attr:{role:'status','aria-live':'polite','data-collection-batch-status':'true'}});
  const review=this.batchReview;
  if(review){
   const box=panel.createDiv({cls:'ts-collection-batch-review',attr:{'data-collection-batch-review':'true'}}),verb={deliver:'投递',archive:'归档',restore:'恢复'}[review.operation];
   box.createEl('h4',{text:`确认${verb} ${review.items.length} 条记录`});
   box.createEl('p',{text:review.operation==='deliver'?'逐条保存到下面的目标。遇到第一条失败或结果待核对时停止。':'仅改变收集流中的归档状态，笔记和白板引用保留。遇到第一条失败时停止。'});
   if(review.target){const target=review.target;box.createEl('p',{text:`目标：${target.title}${target.path?' · '+target.path:''}`});const label=box.createEl('label',{cls:'ts-collection-field'});label.createSpan({text:'目标分组'});const group=label.createEl('select',{attr:{'data-collection-batch-group':'true','aria-label':'批量投递分组'}});group.createEl('option',{value:'',text:'白板空白处'});for(const item of target.groups)group.createEl('option',{value:item.id,text:item.title});group.value=target.groupId||'';group.onchange=()=>{if(this.batchReview===review)target.groupId=group.value||undefined;};}
   const list=box.createEl('ol');for(const record of review.items){const item=list.createEl('li');item.createSpan({text:record.title||record.path});item.createEl('small',{text:record.path});}
   this.button(box,`确认${verb} ${review.items.length} 条`,'confirm-batch',()=>{void this.confirmBatch();},'check');
   this.button(box,'返回选择','cancel-batch-review',()=>{this.batchReview=undefined;this.renderBatchPanel();});
  }
  if(this.batchRunning){const stop=this.button(panel,'停止后续','stop-batch',()=>{this.batchStopRequested=true;this.batchMessage='正在停止后续操作；已开始的记录仍需等待保存回执。';this.renderBatchPanel();},'square');stop.disabled=this.batchStopRequested;}
  if(this.batchReport)this.renderBatchReport(panel,this.batchReport,false);
  if(this.batchHistoryWarning)panel.createEl('p',{text:this.batchHistoryWarning,attr:{role:'status','data-collection-batch-history-warning':'true'}});
  const history=this.batchHistory.filter(report=>report.id!==this.batchReport?.id);
  if(history.length){const details=panel.createEl('details',{cls:'ts-collection-batch-history',attr:{'data-collection-batch-history':'true'}});details.createEl('summary',{text:`最近的批量报告 · ${history.length}`});details.createEl('p',{text:'历史报告只供核对，不会恢复执行。'});for(const report of history)this.renderBatchReport(details,report,true);}
  if(focusedAction&&this.app.workspace.activeLeaf===this.leaf){const replacement=Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.dataset.collectionAction===focusedAction&&!button.disabled);replacement?.focus({preventScroll:true});}
 }
 private renderBatchReport(parent:HTMLElement,report:CollectionBatchReport,history:boolean){
  const box=parent.createEl('section',{cls:'ts-collection-batch-report',attr:{'data-collection-batch-report':report.id,'data-collection-batch-phase':report.phase,'data-collection-batch-readonly':String(history||report.readOnly)}}),verb={deliver:'投递',archive:'归档',restore:'恢复'}[report.operation];
  box.createEl('h4',{text:`${verb}报告${history?' · 只读':''}`});
  const counts=report.counts,already=report.operation==='deliver'?'已有引用':'状态已符合';box.createEl('p',{text:`已确认 ${counts.confirmed} · ${already} ${counts['already-present']} · 未写入 ${counts['not-written']} · 待核对 ${counts.unknown} · 未开始 ${counts['not-started']}${counts.running?' · 正在处理 '+counts.running:''}`,attr:{role:'status','aria-live':'polite'}});
  if(report.target)box.createEl('p',{text:`原目标：${report.target.name} · ${report.target.path} · ${report.target.groupName||report.target.groupId||'白板空白处'}`});
  if(report.warning||!report.journalConfirmed)box.createEl('p',{text:report.warning||'日志保存尚未确认。以下为当前回执，重开后请核对原记录。',cls:'ts-collection-batch-warning'});
  const list=box.createEl('ol'),labels={'not-started':'未开始',running:'正在处理',confirmed:'已确认','already-present':already,'not-written':'未写入',unknown:'结果待核对'};
  for(const item of report.items){const row=list.createEl('li',{attr:{'data-collection-batch-item':item.source.id,'data-collection-batch-status':item.status}});row.createSpan({text:item.source.title||item.source.path});row.createEl('small',{text:item.source.path});row.createSpan({cls:'ts-collection-state-badge',text:labels[item.status]});if(item.message)row.createEl('p',{text:item.message});if(item.status==='unknown'||item.status==='not-written'){this.button(row,'打开原笔记核对','batch-inspect',()=>this.runAction(()=>this.host.openNote({id:item.source.id,createdAt:item.source.createdAt,path:item.source.path,title:item.source.title,tags:[],archived:item.source.expectedArchived,inBoard:'unknown'})),'file-text');}}
  if(counts.unknown)box.createEl('p',{text:'待核对条目不会自动重试。请核对原笔记及上方原目标，确认后再按相同目标选择需要处理的记录。'});
 }
 private buildComposer(parent:HTMLElement){
  const composer=parent.createEl('section',{cls:'ts-collection-composer',attr:{'aria-label':'写下一条记录'}});
  const label=composer.createEl('label',{cls:'ts-collection-body-label'});label.createSpan({cls:'ts-collection-sr-only',text:'记录正文'});
  this.bodyInput=label.createEl('textarea',{attr:{'aria-label':'记录正文',placeholder:'写下一点想法…',rows:'2',maxlength:'100000','data-collection-body':'true'}});
  this.bodyInput.oninput=()=>this.patch({body:this.bodyInput!.value});
  this.bodyInput.addEventListener('compositionstart',()=>{this.composing=true;});
  this.bodyInput.addEventListener('compositionend',()=>{this.composing=false;this.patch({body:this.bodyInput!.value});});
  this.options=composer.createEl('details',{cls:'ts-collection-options',attr:{'data-collection-options':'true'}});
  const summary=this.options.createEl('summary');summary.createSpan({text:'标签 · 附件 · 白板'});
  const extras=this.options.createDiv('ts-collection-extras');
  const tags=extras.createEl('label',{cls:'ts-collection-field'});tags.createSpan({text:'标签'});
  this.tagInput=tags.createEl('input',{type:'text',attr:{'aria-label':'记录标签',placeholder:'#想法 #阅读/摘录','data-collection-tags':'true',maxlength:'1000'}});
  this.tagInput.oninput=()=>this.patch({tags:this.tagInput!.value});
  const attachmentArea=extras.createDiv('ts-collection-attachment-area');
  this.attachButton=this.button(attachmentArea,'引用已有附件','attachment',()=>{void this.chooseAttachment();},'paperclip');
  this.attachments=attachmentArea.createDiv('ts-collection-attachments');
  const targetArea=extras.createDiv('ts-collection-target-area');
  const targetRow=targetArea.createDiv('ts-collection-target-row');
  this.targetButton=this.button(targetRow,'放到白板…','target',()=>{void this.chooseTarget();},'panels-top-left');
  this.clearTarget=this.button(targetRow,'仅保存记录','clear-target',()=>this.patch({target:null}),'x');
  this.targetLabel=targetArea.createDiv('ts-collection-target-label');
  this.groupField=targetArea.createEl('label',{cls:'ts-collection-field'});this.groupField.createSpan({text:'目标分组'});
  this.groupSelect=this.groupField.createEl('select',{attr:{'aria-label':'记录目标分组','data-collection-group':'true'}});
  this.groupSelect.onchange=()=>{const target=this.host.draft().target;if(target)this.patch({target:{...target,groupId:this.groupSelect!.value||undefined}});};
  const footer=composer.createDiv('ts-collection-composer-footer');
  footer.createSpan({cls:'ts-collection-shortcut',text:'⌘ / Ctrl + Enter 保存'});
  this.submitButton=this.button(footer,'记录','submit',()=>{void this.submit();},'arrow-up');this.submitButton.addClass('mod-cta');
  this.status=composer.createEl('p',{cls:'ts-collection-status',attr:{role:'status','aria-live':'polite','data-collection-status':'true'}});
 }
 private patch(patch:CollectionDraftPatch){
  if(!this.current()||this.preparing)return;
  try{this.host.updateDraft(patch);this.liveMessage='';this.syncDraft();}
  catch(error){this.report(error);this.syncDraft();}
 }
 private syncDraft(){
  if(!this.alive||!this.bodyInput)return;
  const draft=this.host.draft(),disabled=this.preparing||draft.busy||draft.locked||this.choosing||this.submitting;
  const targetDisabled=this.preparing||draft.busy||!!draft.targetLocked||this.choosing||this.submitting;
  if(!this.composing&&this.bodyInput.value!==draft.body)this.bodyInput.value=draft.body;
  this.fitBodyInput();
  this.bodyInput.disabled=disabled;
  if(this.tagInput){if(this.tagInput.value!==draft.tags)this.tagInput.value=draft.tags;this.tagInput.disabled=disabled;}
  if(this.attachButton)this.attachButton.disabled=disabled;
  if(this.targetButton)this.targetButton.disabled=targetDisabled;
  if(this.clearTarget){this.clearTarget.hidden=!draft.target&&!(draft.locked&&!draft.targetLocked);this.clearTarget.disabled=targetDisabled;}
  this.targetLabel?.setText(draft.target?'目标：'+draft.target.title:'只保存记录，之后也可以送往白板。');
  if(this.groupField)this.groupField.hidden=!draft.target;
  if(this.groupSelect){
   const wanted=[['','白板空白处'],...(draft.target?.groups||[]).map(group=>[group.id,group.title])];
   if(draft.target?.groupId&&!wanted.some(([id])=>id===draft.target!.groupId))wanted.push([draft.target.groupId,'原分组已变化 · 请重新选择']);
   if(JSON.stringify(Array.from(this.groupSelect.options).map(option=>[option.value,option.text]))!==JSON.stringify(wanted)){
    this.groupSelect.empty();for(const[value,text]of wanted)this.groupSelect.createEl('option',{value,text});
   }
   this.groupSelect.value=draft.target?.groupId||'';this.groupSelect.disabled=targetDisabled;
  }
  if(this.attachments){
   const signature=JSON.stringify(draft.attachments);
   if(this.attachments.dataset.signature!==signature){
    this.attachments.dataset.signature=signature;this.attachments.empty();
    for(const attachment of draft.attachments){
     const chip=this.attachments.createDiv('ts-collection-attachment');chip.createSpan({text:attachment.label,attr:{title:attachment.path}});
     this.button(chip,'移除 '+attachment.label,'remove-attachment',()=>this.patch({attachments:this.host.draft().attachments.filter(item=>item.path!==attachment.path)}),'x');
    }
   }
   this.attachments.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=disabled;});
  }
  if(this.submitButton){
   this.submitButton.disabled=this.preparing||draft.busy||this.choosing||this.submitting||!(draft.canSubmit??(!!draft.body.trim()||!!draft.attachments.length));
   this.submitButton.querySelector('span:last-child')?.setText(draft.busy||this.submitting?'正在保存…':draft.locked?'继续确认保存':'记录');
  }
  this.draftMessage=draft.status||'';this.status?.setText(this.liveMessage||this.draftMessage|| (this.preparing?'正在恢复记录草稿…':''));
 }
 /** Grow with the draft without rebuilding the editor or touching its selection.
  * Metadata refreshes at the same width do not reset the textarea's scroll. */
 private fitBodyInput(){
  const input=this.bodyInput;if(!input?.isConnected||!input.style)return;
  const width=input.getBoundingClientRect().width;
  if(!width||this.bodySizeValue===input.value&&this.bodySizeWidth===width)return;
  const previousHeight=input.style.height,scroll=input.scrollTop;
  input.setCssStyles({height:'auto'});
  const height=input.scrollHeight;
  if(height>0){input.style.height=`${height}px`;this.bodySizeValue=input.value;this.bodySizeWidth=width;}
  else input.style.height=previousHeight;
  if(scroll>0)input.scrollTop=scroll;
 }
 private report(error:unknown){if(this.alive){this.liveMessage=error instanceof Error?error.message:String(error);this.status?.setText(this.liveMessage);}}
 private async chooseAttachment(){
  if(this.choosing||this.preparing||this.host.draft().busy||this.host.draft().locked)return;
  const current=this.invocation();this.choosing=true;this.syncDraft();
  try{const attachment=await this.host.pickAttachment(current);if(current()&&attachment){const previous=this.host.draft().attachments;if(!previous.some(item=>item.path===attachment.path))this.patch({attachments:[...previous,attachment]});}}
  catch(error){if(current())this.report(error);}finally{this.choosing=false;if(this.alive)this.syncDraft();}
 }
 private async chooseTarget(){
  if(this.choosing||this.preparing||this.host.draft().busy||this.host.draft().targetLocked)return;
  const current=this.invocation();this.choosing=true;this.syncDraft();
  try{const target=await this.host.pickTarget(current);if(current()&&target)this.patch({target});}
  catch(error){if(current())this.report(error);}finally{this.choosing=false;if(this.alive)this.syncDraft();}
 }
 private async submit(){
  if(this.composing||this.submitButton?.disabled||this.submitting||!this.current())return;
  const current=this.invocation();this.submitting=true;this.liveMessage='';this.syncDraft();
  try{await this.host.submit(current);if(current()){this.liveMessage='已保存，可以继续记录。';await this.refreshRecords();}}
  catch(error){if(current())this.report(error);}
  finally{this.submitting=false;if(this.alive)this.syncDraft();}
 }
 private keydown(event:KeyboardEvent){
  if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))this.restoreEpoch++;
  if(event.isComposing||Reflect.get(event,'keyCode')===229||event.defaultPrevented)return;
  this.handleSubmitHotkey(event);
  if(event.key==='Escape'&&this.root?.classList.contains('is-drawer-open')){event.preventDefault();event.stopPropagation();this.setDrawer(false);}
  if(event.key==='Tab'&&this.root?.classList.contains('is-drawer-open')&&this.root.clientWidth<=680&&this.nav){
   const controls=Array.from(this.nav.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href]')).filter(element=>element.getClientRects().length>0);
   const first=controls[0],last=controls[controls.length-1],active=this.contentEl.ownerDocument.activeElement;
   if(first&&(!this.nav.contains(active)||event.shiftKey&&active===first||!event.shiftKey&&active===last)){event.preventDefault();(event.shiftKey?last:first).focus({preventScroll:true});}
  }
  this.revealKeyboardComposer(event);
 }
 /** Native Tab can reveal only the textarea caret. Keep the whole field in its
  * own scroller without moving the caret, inner scroll or any other pane. */
 private revealKeyboardComposer(event:KeyboardEvent){
  const root=this.root,main=this.main,input=this.bodyInput,doc=this.contentEl.ownerDocument,win=doc.defaultView;
  if(!event.isTrusted||event.key!=='Tab'||event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||!root||!main||!input||!win||event.view&&event.view!==win)return;
  const current=this.invocation(),restore=this.restoreEpoch;
  win.requestAnimationFrame(()=>{
   if(event.defaultPrevented||!current()||restore!==this.restoreEpoch||this.root!==root||this.main!==main||this.bodyInput!==input||this.app.workspace.getActiveViewOfType(CollectionView)!==this||doc.activeElement!==input||!doc.hasFocus())return;
   if(root.ownerDocument!==doc||main.ownerDocument!==doc||input.ownerDocument!==doc||!root.isConnected||!main.isConnected||!input.isConnected||!root.contains(main)||!main.contains(input)||input.disabled||!input.getClientRects().length||win.getComputedStyle(input).visibility!=='visible')return;
   const field=input.getBoundingClientRect(),top=main.getBoundingClientRect().top+main.clientTop,height=main.clientHeight;
   // An oversized field cannot fit; preserve its native caret visibility.
   if(height<=0||field.height<=0||field.height>height)return;
   const delta=field.top<top?field.top-top:field.bottom>top+height?field.bottom-top-height:0;
   if(delta)main.scrollTop+=delta;
  });
 }
 private bindSubmitHotkey(){
  if(this.submitHotkey||!this.scope)return;
  // Obsidian dispatches view scopes before its parent shortcuts in window
  // capture. A bubbling DOM listener alone never receives an intercepted key.
  // View.scope also follows the focused leaf in its own pop-out window.
  this.submitHotkey=this.scope.register(['Mod'],'Enter',event=>{
   if(this.handleSubmitHotkey(event))return false;
  });
 }
 private handleSubmitHotkey(event:KeyboardEvent):boolean {
  if(event.defaultPrevented||event.isComposing||Reflect.get(event,'keyCode')===229||this.composing||event.repeat||event.key!=='Enter'||!(event.metaKey||event.ctrlKey)||event.altKey||event.shiftKey)return false;
  const doc=this.contentEl.ownerDocument,composer=this.root?.querySelector('.ts-collection-composer');
  if(!this.current()||this.app.workspace.activeLeaf!==this.leaf||!composer||!composer.contains(doc.activeElement)||!this.root?.getClientRects().length)return false;
  if(event.view&&event.view!==doc.defaultView||event.target&&event.target!==doc.body&&!composer.contains(event.target as Node))return false;
  event.preventDefault();event.stopPropagation();
  if(!this.submitButton?.disabled)void this.submit();
  return true;
 }
 private setDrawer(open:boolean,focus=true){
  if(!this.root)return;const was=this.root.classList.contains('is-drawer-open');this.root.toggleClass('is-drawer-open',open);this.drawerButton?.setAttribute('aria-expanded',String(open));
  if(focus&&was!==open){if(open)this.search?.focus({preventScroll:true});else if(this.nav?.contains(this.contentEl.ownerDocument.activeElement))this.drawerButton?.focus({preventScroll:true});}
 }
 private changeFilter(filter:CollectionFilter){this.filter=filter;this.page=0;this.setDrawer(false);this.renderNavigation();this.requestSearch();}
 private chooseTag(tag:string){this.tag=tag;this.page=0;this.setDrawer(false);this.renderNavigation();this.requestSearch();}
 private clearFilters(){
  this.manualBodyMode=false;this.bodyAwaitingStart=false;this.appliedFilterId=undefined;this.query='';this.tag='';this.filter='all';this.includeBody=false;this.pinnedOnly=false;this.since='';this.until='';this.taskFilter='all';if(this.taskSelect)this.taskSelect.value='all';this.page=0;this.searchComposing=false;
  if(this.search){this.search.value='';this.search.setAttribute('placeholder','标题、路径或 #标签');}if(this.bodySearchToggle)this.bodySearchToggle.checked=false;if(this.pinnedToggle)this.pinnedToggle.checked=false;if(this.sinceInput)this.sinceInput.value='';if(this.untilInput)this.untilInput.value='';
  this.renderNavigation();this.requestSearch();
 }
 private searchOptions():CollectionSearchOptions{return{query:(this.tag?'#'+this.tag.replace(/^#/,'')+' ':'')+this.query,includeBody:this.includeBody,scope:this.filter,pinnedOnly:this.pinnedOnly,since:this.since||undefined,until:this.until||undefined,...(this.taskFilter!=='all'?{tasks:this.taskFilter}:{})};}
 private syncHeatmap(){this.heatmap?.update(this.records,{since:this.since,until:this.until});}
 private changeCalendarContext(){
  if(!this.current()||!this.since&&!this.until)return;
  this.page=0;if(this.includeBody)this.manualBodyMode=true;
  // A system timezone change invalidates the date query just as changing its
  // bounds does. Whole-body reads still require a new explicit start.
  this.requestSearch();
 }
 private changeHeatmapDate(day?:string){
  if(day!==undefined&&!parseCollectionDay(day))return;
  this.since=day||'';this.until=day||'';this.page=0;this.appliedFilterId=undefined;
  this.renderSavedFilters();
  if(this.sinceInput)this.sinceInput.value=this.since;if(this.untilInput)this.untilInput.value=this.until;
  // A calendar interaction never silently authorizes a whole-body scan.
  // Existing query, tag, archive scope and pin conditions remain in place.
  if(this.includeBody)this.manualBodyMode=true;
  this.requestSearch();
 }
 private searchKey(){return JSON.stringify(this.searchOptions());}
 private sameRecord(a:CollectionRecord,b:CollectionRecord){return a.id===b.id&&a.createdAt===b.createdAt&&a.path===b.path;}
 private filteredRecords():CollectionRecord[]{
  if(!this.host.search){try{return filterCollectionSearchRecords(this.records,this.searchOptions());}catch(error){this.searchMessage=error instanceof Error?error.message:String(error);return[];}}
  return this.searchResult?.epoch===this.searchEpoch&&this.searchResult.key===this.searchKey()?this.searchResult.value.hits.map(hit=>hit.record):[];
 }
 private cancelSearch(message=''){
  this.searchEpoch++;if(this.searchTimer!==undefined)this.searchTimerWindow?.clearTimeout(this.searchTimer);this.searchTimer=undefined;this.searchTimerWindow=undefined;this.searchBusy=false;this.searchProgress=undefined;this.searchResult=undefined;this.searchMessage=message;this.syncSearchFeedback();
 }
 private requestSearch(delay=0,explicit=false){
  this.review=undefined;this.noteExport?.close();this.noteExport=undefined;this.renderReview();
  this.syncHeatmap();
  this.clearSelection(true);this.bodyAwaitingStart=this.manualBodyMode&&this.includeBody&&!explicit;
  this.restoreEpoch++;this.listEpoch++;this.browseEpoch++;this.indexBusy=false;this.browseMessage='';this.syncBrowseMessage();this.syncRefresh();this.cancelSearch();
  if(this.bodyAwaitingStart){this.searchMessage='筛选已就绪。点击开始搜索后读取正文。';this.renderFeed();this.syncSearchFeedback();return;}
  if(!this.host.search){this.renderFeed();this.syncSearchFeedback();return;}
  if(this.searchComposing){this.searchMessage='输入完成后开始搜索。';this.syncSearchFeedback();this.renderFeed();return;}
  this.searchMessage=delay?'等待输入完成…':'';this.renderFeed();this.syncSearchFeedback();
  const window=this.contentEl.ownerDocument.defaultView;
  if(delay&&window){this.searchTimerWindow=window;this.searchTimer=window.setTimeout(()=>{this.searchTimer=undefined;this.searchTimerWindow=undefined;void this.runSearch();},delay);this.syncSearchFeedback();}else void this.runSearch();
 }
 private syncSearchFeedback(){
  const progress=this.searchProgress;
  const text=this.searchBusy?(progress?`正在搜索 · 已检查 ${progress.scanned} / ${progress.total} 条正文${progress.unread?` · ${progress.unread} 条未能读取`:''}`:'正在搜索…'):this.searchMessage;
  this.searchFeedback?.setText(text);if(this.searchPanel)this.searchPanel.hidden=!text;
  if(this.root){this.root.dataset.collectionSearchState=this.searchBusy?'running':this.searchTimer?'pending':this.searchComposing?'composing':this.bodyAwaitingStart?'awaiting-start':this.searchResult?'complete':this.searchMessage?'stopped':'idle';this.root.dataset.collectionSearchEpoch=String(this.searchEpoch);}
  if(this.cancelSearchButton)this.cancelSearchButton.hidden=!this.searchBusy&&!this.searchTimer;
  if(this.retrySearchButton)this.retrySearchButton.hidden=this.bodyAwaitingStart||this.searchBusy||!!this.searchTimer||!this.searchMessage;
  if(this.startSearchButton)this.startSearchButton.hidden=!this.bodyAwaitingStart||this.searchComposing;
  this.syncSelection();
 }
 private syncBrowseMessage(){if(this.browseNotice){this.browseNotice.setText(this.browseMessage);this.browseNotice.hidden=!this.browseMessage;}}
 private async runSearch(location?:CollectionBrowseLocation,restoreEpoch=this.restoreEpoch){
  if(!this.host.search||!this.current()||this.bodyAwaitingStart)return;
  const epoch=++this.searchEpoch,key=this.searchKey(),base=this.invocation(),current=()=>base()&&epoch===this.searchEpoch&&key===this.searchKey();
  this.searchBusy=true;this.searchMessage='';this.searchProgress=undefined;this.searchResult=undefined;this.syncSearchFeedback();this.feedStatus?.setText('正在搜索…');
  try{
   const value=await this.host.search(this.searchOptions(),current,progress=>{if(current()){this.searchProgress=progress;this.syncSearchFeedback();}});
   if(!current())return;
   this.searchBusy=false;
   if(value.cancelled){this.searchMessage='搜索已取消，可重试。';this.renderFeed();this.syncSearchFeedback();return;}
   const restore=!!location?.focus&&location.focus===this.contentEl.ownerDocument.activeElement&&restoreEpoch===this.restoreEpoch;
   this.stale=false;this.syncRefresh();this.searchResult={epoch,key,value};this.searchMessage=value.unread?`${value.unread} 条正文未能读取，结果可能不完整。可重试。`:'';this.renderFeed();this.syncSearchFeedback();
   if(restore&&location&&base())await this.restoreCollectionLocation(location,current,true);
  }catch(error){if(current()){this.searchBusy=false;this.searchMessage=error instanceof Error?error.message:String(error);this.renderFeed();this.syncSearchFeedback();}}
 }
 private renderNavigation(){
  this.syncHeatmap();
  for(const[scope,button]of [['all',this.allButton],['unplaced',this.unplacedButton],['placed',this.placedButton],['archived',this.archivedButton]] as const){button?.setAttribute('aria-pressed',String(this.filter===scope));button?.toggleClass('is-active',this.filter===scope);}
  if(!this.tagsList)return;this.tagsList.empty();
  const all=this.button(this.tagsList,'全部标签','tag-all',()=>this.chooseTag(''));all.setAttribute('aria-pressed',String(!this.tag));all.toggleClass('is-active',!this.tag);
  const tags=[...new Set(this.records.flatMap(record=>[...record.tags]))].sort((a,b)=>a.localeCompare(b));
  const visible=this.tag&&!tags.slice(0,100).includes(this.tag)?[this.tag,...tags.slice(0,99)]:tags.slice(0,100);
  for(const tag of visible){const button=this.button(this.tagsList,tag.startsWith('#')?tag:'#'+tag,'tag',()=>this.chooseTag(tag));button.dataset.collectionTag=tag;button.setAttribute('aria-pressed',String(tag===this.tag));button.toggleClass('is-active',tag===this.tag);}
  if(tags.length>100)this.tagsList.createEl('small',{text:'显示前 100 个标签，可搜索其他标签。'});
 }
 private syncRefresh(){
  if(this.refreshButton){this.refreshButton.disabled=this.indexBusy;this.refreshButton.querySelector('span:last-child')?.setText(this.stale?'有更新 · 刷新':'刷新');}
 }
 private async refreshRecords(preserve=true,explicitBody=false,background=false){
  if(this.manualBodyMode&&this.includeBody){this.bodyAwaitingStart=!explicitBody;if(this.bodyAwaitingStart){this.cancelSearch('筛选已就绪。点击开始搜索后读取正文。');this.renderFeed();return;}}
  const epoch=++this.listEpoch,base=this.invocation(),restoreEpoch=this.restoreEpoch,location=preserve?this.captureCollectionLocation():undefined;this.cancelSearch();this.indexBusy=true;this.syncRefresh();this.feedStatus?.setText('正在读取记录…');if(background)this.backgroundRefreshEpoch=epoch;
  try{
   const records=await this.host.list();if(!base()||epoch!==this.listEpoch)return;
   this.records=records;this.stale=false;this.renderNavigation();if(this.host.search)await this.runSearch(location,restoreEpoch);else this.renderFeed();
  }catch(error){if(base()&&epoch===this.listEpoch){this.searchMessage=error instanceof Error?error.message:String(error);this.syncSearchFeedback();this.feedStatus?.setText('记录暂时无法读取，请重试。');}}
  finally{if(this.backgroundRefreshEpoch===epoch)this.backgroundRefreshEpoch=undefined;if(this.alive&&epoch===this.listEpoch){this.indexBusy=false;this.syncRefresh();}}
 }
 private disposeCards(){this.observer?.disconnect();this.observer=undefined;this.readQueue=[];for(const card of this.cards){card.scope.unload();card.finishPreview?.();}this.cards=[];}
 private renderFeed(){
  if(!this.feed||!this.alive)return;
  const epoch=++this.renderEpoch,scroll=this.main?.scrollTop||0;this.disposeCards();this.feed.empty();this.pagination?.empty();
  const filtered=this.filteredRecords(),located=this.located&&this.records.find(record=>record.id===this.located!.id&&record.createdAt===this.located!.createdAt),hiddenLocated=located&&!filtered.some(record=>this.sameRecord(record,located));
  this.page=Math.min(this.page,Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1));
  this.tagHeading?.setText(({all:'收集记录',unplaced:'未放入白板',placed:'已放入白板',archived:'已归档'}[this.filter])+(this.tag?' · '+this.tag:'')+(this.pinnedOnly?' · 仅置顶':''));
  if(this.tagHeading)this.tagHeading.tabIndex=-1;
  const unknown=this.records.some(record=>record.inBoard==='unknown');
  const complete=!this.host.search||!!this.searchResult,unread=this.searchResult?.value.unread||0;
  this.feedStatus?.setText((complete?`${filtered.length} 条${unread?'已找到 · 结果可能不完整':''}`:this.searchBusy?'正在搜索…':'尚无搜索结果')+(unknown&&(this.filter==='unplaced'||this.filter==='placed')?' · 部分白板未完成索引':''));this.syncBrowseMessage();
  if(this.located){const banner=this.feed.createDiv('ts-collection-return-banner');banner.createEl('p',{text:hiddenLocated?'这条记录被当前筛选隐藏，已临时展示。原筛选仍保留。':'已定位原记录，原筛选仍保留。'});this.button(banner,'返回原浏览位置','return-browse',()=>{void this.dismissLocated();},'arrow-left');}
  if(!filtered.length&&complete){const constrained=!!(this.query||this.tag||this.pinnedOnly||this.since||this.until||this.taskFilter!=='all'),empty=this.feed.createDiv('ts-collection-empty');setIcon(empty.createDiv(),'notebook-pen');empty.createEl('h3',{text:unread?'暂未找到匹配的记录':constrained?'没有匹配的记录':this.filter==='archived'?'这里还没有归档记录':this.filter==='unplaced'?'这里暂时没有待投递记录':this.filter==='placed'?'这里还没有已投递记录':'从一个念头开始'});empty.createEl('p',{text:unread?'部分正文未能读取，请重试后再确认结果。':constrained?'试试其他关键词，或调整组合筛选。':this.filter==='archived'?'归档只隐藏收集流中的记录，可随时恢复。':'写在上方，保存后就会出现在这里。'});}
  const win=this.contentEl.ownerDocument.defaultView as(Window&{IntersectionObserver?:typeof IntersectionObserver})|null;
  if(win?.IntersectionObserver)this.observer=new win.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const card=this.cards.find(item=>item.row===entry.target);if(card)this.enqueueRead(card);this.observer?.unobserve(entry.target);}},{root:this.main,rootMargin:'280px'});
  const reviewRecord=this.reviewRecord(),pageRecords=this.review?(reviewRecord?[reviewRecord]:[]):filtered.slice(this.page*PAGE_SIZE,(this.page+1)*PAGE_SIZE);if(hiddenLocated&&!this.review)pageRecords.unshift(located);
  for(const record of pageRecords){
   const row=this.feed.createEl('article',{cls:'ts-collection-card',attr:{'data-collection-id':record.id,'data-path':record.path,'data-collection-pinned':String(!!record.pinned),'data-collection-archived':String(!!record.archived),tabindex:'-1'}});row.toggleClass('is-revealed',!!located&&this.sameRecord(record,located));
   const recordHeading=row.createDiv('ts-collection-card-heading'),kicker=recordHeading.createDiv('ts-collection-card-kicker'),date=new Date(record.createdAt);
   kicker.createEl('time',{text:Number.isFinite(date.getTime())?date.toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'时间未知',attr:{datetime:record.createdAt,title:Number.isFinite(date.getTime())?date.toLocaleString():record.createdAt}});
   if(this.host.batch&&!(hiddenLocated&&located&&this.sameRecord(record,located))){const label=row.createEl('label',{cls:'ts-collection-check-field ts-collection-selection-check'});label.hidden=!this.selectionMode;const check=label.createEl('input',{type:'checkbox',attr:{'data-collection-select':record.id,'aria-label':'选择 '+(record.title||record.path)}});check.checked=this.selected.has(this.recordKey(record));check.onchange=()=>this.selectRecord(record,check.checked);label.createSpan({text:'选择此记录'});}
   const snippet=this.searchResult?.value.hits.find(hit=>this.sameRecord(hit.record,record))?.snippet;
   if(snippet)this.renderSnippet(row,snippet);
   const body=row.createDiv({cls:'ts-collection-card-body markdown-rendered',attr:{'aria-label':record.title||'记录内容'}});body.createEl('p',{cls:'ts-collection-preview-placeholder',text:'正在载入内容…'});
   const scope=new Component();scope.load();const card:CardPreview={record,row,body,scope,expanded:false,loaded:false,reading:false};this.cards.push(card);
   card.taskProgress=row.createDiv({cls:'ts-collection-task-progress',attr:{'data-collection-task-progress':'true'}});this.renderTaskProgress(card);
   card.previewReady=new Promise(resolve=>{card.finishPreview=resolve;});
   this.buildRecordContext(card,epoch);
   const foot=row.createDiv('ts-collection-card-footer'),meta=foot.createDiv('ts-collection-card-meta');
   if(record.pinned)meta.createSpan({cls:'ts-collection-state-badge',text:'已置顶'});if(record.archived)meta.createSpan({cls:'ts-collection-state-badge',text:'已归档'});
   card.placements=meta.createDiv('ts-collection-placements');this.renderPlacements(card);
   const tools=foot.createDiv('ts-collection-card-tools');
   const actions=row.createDiv('ts-collection-card-actions');actions.hidden=true;
   const more=this.button(tools,'更多','more',()=>{actions.hidden=!actions.hidden;more.setAttribute('aria-expanded',String(!actions.hidden));},'ellipsis');more.setAttribute('aria-expanded','false');
   if(record.tags.length){const tags=row.createDiv('ts-collection-card-tags');for(const tag of record.tags.slice(0,20)){const button=this.button(tags,tag.startsWith('#')?tag:'#'+tag,'tag',()=>this.chooseTag(tag));button.dataset.collectionTag=tag;}if(record.tags.length>20)tags.createSpan({text:`另有 ${record.tags.length-20} 个标签`});}
   this.button(actions,'打开笔记','open',()=>this.runAction(()=>this.host.openNote(card.record)),'file-text');
   this.button(actions,'送往…','deliver',()=>this.showSendMenu(card,actions,epoch),'send');
   this.button(actions,'定位引用','occurrences',()=>this.runAction(()=>this.host.showOccurrences(card.record)),'locate-fixed');
   if(this.host.setFlag){
    this.button(actions,record.pinned?'取消置顶':'置顶',record.pinned?'unpin':'pin',()=>{void this.changeFlag(card,actions,'pinned',!card.record.pinned,epoch);},'pin');
    if(!this.review)this.button(actions,record.archived?'恢复到收集':'归档',record.archived?'restore':'archive',()=>{void this.changeFlag(card,actions,'archived',!card.record.archived,epoch);},record.archived?'archive-restore':'archive');
   }
   if(this.review){actions.hidden=false;more.setAttribute('aria-expanded','true');}
   this.observer?this.observer.observe(row):this.enqueueRead(card);
  }
  if(this.pagination&&filtered.length&&!this.review){
   const previous=this.button(this.pagination,'上一页','previous',()=>{this.clearSelection(true);this.page--;this.renderFeed();this.scrollToFeed();},'chevron-left');previous.disabled=this.page===0;
   this.pagination.createSpan({text:`第 ${this.page+1} / ${Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))} 页`});
   const next=this.button(this.pagination,'下一页','next',()=>{this.clearSelection(true);this.page++;this.renderFeed();this.scrollToFeed();},'chevron-right');next.disabled=(this.page+1)*PAGE_SIZE>=filtered.length;
  }
  if(this.main)this.main.scrollTop=scroll;this.renderReview();this.syncSelection();
 }
 private scrollToFeed(){if(this.main&&this.tagHeading){this.main.scrollTop=Math.max(0,this.main.scrollTop+this.tagHeading.getBoundingClientRect().top-this.main.getBoundingClientRect().top-12);}}
 /** Search highlighting is plain text in its own container. It never rewrites
  * Markdown links, tasks, media or the renderer's interactive descendants. */
 private renderSnippet(parent:HTMLElement,snippet:NonNullable<CollectionSearchResult['hits'][number]['snippet']>){
  const box=parent.createEl('p',{cls:'ts-collection-match-snippet',attr:{'aria-label':'搜索命中片段'}}),text=snippet.text.slice(0,400);let offset=0;
  for(const range of snippet.ranges){
   if(!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<offset||range.end<=range.start||range.start>=text.length)continue;
   if(range.start>offset)box.createSpan({text:text.slice(offset,range.start)});
   const end=Math.min(text.length,range.end);box.createEl('mark',{text:text.slice(range.start,end)});offset=end;
  }
  if(offset<text.length)box.createSpan({text:text.slice(offset)});
 }
 private async changeFlag(card:CardPreview,actions:HTMLElement,flag:'pinned'|'archived',value:boolean,epoch:number){
  if(!this.host.setFlag||actions.dataset.pending==='true')return;
  const base=this.invocation(),browseEpoch=this.browseEpoch,current=()=>base()&&epoch===this.renderEpoch&&this.cards.includes(card);if(!current())return;
  let feedback=actions.querySelector<HTMLElement>('[data-collection-flag-status]');if(!feedback)feedback=actions.createEl('p',{cls:'ts-collection-flag-status',attr:{role:'status','aria-live':'polite','data-collection-flag-status':'true'}});
  actions.dataset.pending='true';actions.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=true;});feedback.hidden=false;feedback.setText('正在保存…');
  try{
   await this.host.setFlag(card.record,flag,value,current);if(!current())return;
   this.browseMessage=flag==='pinned'?(value?'已置顶':'已取消置顶'):(value?'已归档，笔记和白板引用均保留。':'已恢复到收集。');
   feedback.setText(this.browseMessage);await this.refreshRecords(true);
  }catch(error){if(base()&&browseEpoch===this.browseEpoch){const message=error instanceof Error?error.message:String(error);this.browseMessage=message;this.syncBrowseMessage();if(current()){feedback.setText('');feedback.hidden=true;}}}
  finally{if(current()){actions.dataset.pending='false';actions.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=false;});}}
 }
 private enqueueRead(card:CardPreview){if(card.loaded||card.reading||this.readQueue.includes(card))return;this.readQueue.push(card);this.drainReads();}
 private drainReads(){
  while(this.alive&&this.activeReads<2&&this.readQueue.length){const card=this.readQueue.shift()!;if(!this.cards.includes(card))continue;this.activeReads++;card.reading=true;const epoch=this.renderEpoch;
   void this.host.readBody(card.record).then(async text=>{
    if(!this.alive||epoch!==this.renderEpoch||!this.cards.includes(card))return;card.text=text;card.loaded=true;await this.renderBody(card,epoch);
   }).catch(error=>{if(this.alive&&epoch===this.renderEpoch&&this.cards.includes(card)){card.body.empty();card.body.createEl('p',{text:'预览暂时不可用，请打开笔记查看。'});this.button(card.body,'重试预览','retry-preview',()=>{card.loaded=false;this.enqueueRead(card);});card.body.setAttribute('title',error instanceof Error?error.message:String(error));}}).finally(()=>{card.finishPreview?.();this.activeReads--;card.reading=false;this.drainReads();});
  }
 }
 private async renderBody(card:CardPreview,epoch:number){
  if(card.text===undefined)return;
  card.scope.unload();card.scope=new Component();card.scope.load();const scope=card.scope;
  card.body.empty();card.toggle?.remove();card.toggle=undefined;
  const limit=card.expanded?EXPANDED_LIMIT:PREVIEW_LIMIT,text=card.text.slice(0,limit);
  const rendered=card.body.createDiv('ts-collection-rendered-body');
  if(text.trim())await MarkdownRenderer.render(this.app,text,rendered,card.record.path,scope);
  else rendered.createEl('p',{text:'附件记录'});
  if(!this.alive||epoch!==this.renderEpoch||scope!==card.scope||!this.cards.includes(card)){scope.unload();return;}
  card.body.querySelectorAll<HTMLInputElement>('input').forEach(input=>{input.disabled=true;});
  card.body.querySelectorAll<HTMLElement>('[contenteditable]').forEach(element=>element.setAttribute('contenteditable','false'));
  card.body.querySelectorAll<HTMLMediaElement>('audio,video').forEach(media=>{media.preload='none';media.autoplay=false;media.pause();});
  const long=card.text.length>PREVIEW_LIMIT||card.body.scrollHeight>260;card.body.toggleClass('is-collapsed',!card.expanded&&long);
  if(long||card.expanded){card.toggle=this.button(card.row,card.expanded?'收起内容':'展开内容','expand',()=>{card.expanded=!card.expanded;void this.renderBody(card,this.renderEpoch).catch(error=>this.report(error));},card.expanded?'chevron-up':'chevron-down');card.toggle.addClass('ts-collection-expand');card.toggle.setAttribute('aria-expanded',String(card.expanded));}
  if(card.expanded&&card.text.length>EXPANDED_LIMIT)card.body.createEl('p',{cls:'ts-collection-preview-limit',text:'这里预览前 30,000 个字符；打开笔记可阅读完整内容。'});
 }
 private async beginDelivery(card:CardPreview,actions:HTMLElement,epoch:number,allowDuplicate=false){
  if(actions.dataset.pending==='true')return;
  // A membership refresh may already be awaiting its list or search when the
  // user opens the picker. Supersede only that background invocation before
  // capturing this delivery; explicit refreshes keep their normal authority.
  if(this.backgroundRefreshEpoch!==undefined&&this.backgroundRefreshEpoch===this.listEpoch){this.backgroundRefreshEpoch=undefined;this.listEpoch++;this.indexBusy=false;this.stale=true;this.cancelSearch('记录有更新，当前投递操作已保留。刷新后查看最新结果。');this.syncRefresh();}
  const currentBase=this.invocation(),current=()=>currentBase()&&epoch===this.renderEpoch&&this.cards.includes(card)&&(!this.review||!!this.reviewRecord()&&this.sameRecord(this.reviewRecord()!,card.record));
  actions.dataset.pending='true';actions.dataset.deliveryPicking='true';actions.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=true;});
  try{
   const target=await this.host.pickTarget(current);if(!current()||!target)return;
   actions.querySelector('.ts-collection-delivery')?.remove();const panel=actions.createDiv('ts-collection-delivery');
   panel.createEl('p',{text:'放到 '+target.title});
   const group=panel.createEl('select',{attr:{'aria-label':'投递目标分组','data-collection-delivery-group':'true'}});group.createEl('option',{value:'',text:'白板空白处'});for(const item of target.groups)group.createEl('option',{value:item.id,text:item.title});group.value=target.groupId||'';
   const existing=card.record.placements?.filter(item=>item.boardPath===target.path)||[];
   if(existing.length){panel.createEl('p',{text:`此白板已有 ${existing.length} 处引用。可直接定位，默认不会新增。`});this.button(panel,'定位已有卡片','open-existing-delivery',()=>this.runAction(()=>this.host.locateBoard?this.host.locateBoard(card.record,existing[0]):this.host.showOccurrences(card.record)),'locate-fixed');}
   const duplicateLabel=panel.createEl('label',{cls:'ts-collection-check-field'}),duplicate=duplicateLabel.createEl('input',{type:'checkbox',attr:{'data-collection-delivery-duplicate':'true'}});duplicate.checked=allowDuplicate;duplicateLabel.createSpan({text:'明确另建一张卡片，保留已有引用'});
   const feedback=panel.createEl('p',{attr:{role:'status','aria-live':'polite','data-collection-delivery-status':'true'}});let busy=false,intent:CollectionTarget|undefined;
   const confirm=this.button(panel,'确认投递','confirm-delivery',()=>{
    if(busy||!current())return;intent??={...target,groupId:group.value||undefined,...(duplicate.checked?{duplicate:'allow'}:{})};busy=true;actions.dataset.pending='true';actions.querySelectorAll<HTMLButtonElement>(':scope > button').forEach(button=>{button.disabled=true;});confirm.disabled=true;group.disabled=true;duplicate.disabled=true;cancel.disabled=true;feedback.setText('正在确认保存…');
    void this.host.deliver(card.record,intent,current).then(result=>{
     if(!current())return;feedback.setText(result.added?'已放入白板；记录仍保留在收集流。':'这张白板已有引用，未重复添加。');confirm.hidden=true;group.disabled=true;this.stale=true;this.syncRefresh();
     if(result.receipt){panel.dataset.collectionDeliveryReceipt=result.receipt.operationId;panel.dataset.collectionDeliveryState=result.receipt.status;}
     if(!result.added){this.button(panel,'查看已有引用','open-existing-delivery',()=>this.runAction(()=>this.host.showOccurrences(card.record)),'locate-fixed');this.button(panel,'重新选目标并另建…','another-delivery',()=>{if(!busy){panel.remove();void this.beginDelivery(card,actions,epoch,true);}},'copy-plus');}
     if(this.review)this.review.outcomes.set(this.recordKey(card.record),result.added?'已送往 '+target.title+'，来源保留':'目标已有引用，未重复添加');
    }).catch(error=>{if(current())feedback.setText(error instanceof Error?error.message:String(error));}).finally(()=>{busy=false;actions.dataset.pending='false';actions.querySelectorAll<HTMLButtonElement>(':scope > button').forEach(button=>{button.disabled=false;});if(current()){confirm.disabled=false;cancel.disabled=false;/* Retrying keeps the exact group receipt in the host. */}else panel.remove();});
   },'check');
   const cancel=this.button(panel,'收起','cancel-delivery',()=>{if(!busy)panel.remove();},'x');
  }catch(error){if(current())this.report(error);}
  finally{actions.dataset.deliveryPicking='false';if(this.alive&&epoch===this.renderEpoch&&this.cards.includes(card)){actions.dataset.pending='false';actions.querySelectorAll<HTMLButtonElement>(':scope > button').forEach(button=>{button.disabled=false;});}}
 }
 private showSendMenu(card:CardPreview,actions:HTMLElement,epoch:number){
  if(actions.dataset.pending==='true'||epoch!==this.renderEpoch||!this.cards.includes(card))return;
  const old=actions.querySelector('[data-collection-send-menu]');if(old){old.remove();return;}
  const menu=actions.createDiv({cls:'ts-collection-send-menu',attr:{'data-collection-send-menu':'true',role:'group','aria-label':'送往'}});
  this.button(menu,'白板或分组…','send-board',()=>{menu.remove();void this.beginDelivery(card,actions,epoch);},'panels-top-left');
  if(this.host.prepareNote)this.button(menu,'沉淀为笔记…','send-note',()=>{menu.remove();this.openNoteExport(card.record);},'file-pen-line');
  if(this.host.deliveryReceipts)this.button(menu,'查看投递回执','delivery-history',()=>{void this.showDeliveryHistory(card,menu,epoch);},'list-checks');
 }
 private async showDeliveryHistory(card:CardPreview,parent:HTMLElement,epoch:number){
  const base=this.invocation(),current=()=>base()&&epoch===this.renderEpoch&&this.cards.includes(card)&&parent.isConnected;
  try{const history=await this.host.deliveryReceipts!(card.record);if(!current())return;
   parent.querySelector('[data-collection-delivery-history]')?.remove();const box=parent.createDiv({cls:'ts-collection-delivery-history',attr:{'data-collection-delivery-history':'true'}});
   if(history.warning)box.createEl('p',{text:history.warning});
   for(const receipt of history.receipts){box.createEl('p',{text:`${receipt.status==='confirmed'?'已确认':receipt.status==='prepared'?'待核对':'未写入'} · ${receipt.boardPath}${receipt.duplicate?' · 明确另建':''}`,attr:{'data-collection-delivery-receipt':receipt.operationId,'data-collection-delivery-state':receipt.status}});}
   if(!history.receipts.length)box.createEl('p',{text:'尚无投递回执。旧引用仍可从记录下方定位。'});
  }catch(error){if(current())this.report(error);}
 }
 private openNoteExport(record:CollectionRecord){
  const host=this.host;if(!host.pickNote||!host.noteHeadings||!host.prepareNote||!host.commitNote||!host.discardNote||!host.inspectNote||!host.noteHistory||!host.openNotePath)return;
  this.noteExport?.close();const base=this.invocation(),review=this.review,index=review?.index,identityEpoch=this.reviewIdentityEpoch,current=()=>base()&&this.review===review&&review?.index===index&&identityEpoch===this.reviewIdentityEpoch;
  const modal=new CollectionNoteExportModal(this.app,this.contentEl.ownerDocument,{
   sourceTitle:record.title,sourcePath:record.path,current,accent:()=>host.accent?.()||'forest',density:()=>host.density?.()||'comfortable',
   pick:valid=>host.pickNote!(()=>current()&&valid()),headings:(path,valid)=>host.noteHeadings!(path,()=>current()&&valid()),
   prepare:(target,valid)=>host.prepareNote!(record,target,()=>current()&&valid()),commit:(preview,valid)=>host.commitNote!(preview,()=>current()&&valid()),
   discard:preview=>host.discardNote!(preview),inspect:id=>host.inspectNote!(id),history:()=>host.noteHistory!(),open:(path,valid)=>host.openNotePath!(path,()=>current()&&valid()),
   watchCurrent:invalidate=>{const ref=this.app.workspace.on('active-leaf-change',()=>{if(!current())invalidate();});return()=>this.app.workspace.offref(ref);},
   closed:()=>{if(this.noteExport===modal)this.noteExport=undefined;},
  });this.noteExport=modal;modal.open();
 }
 private runAction(action:()=>Promise<void>|void){if(!this.current())return;try{void Promise.resolve(action()).catch(error=>this.report(error));}catch(error){this.report(error);}}
}
