import {Component,ItemView,MarkdownRenderer,Scope,setIcon,type KeymapEventHandler,type ViewStateResult,type WorkspaceLeaf} from 'obsidian';
import {bindMobileViewport} from './mobile-viewport';
import {applyWorkspaceDensity} from './workspace-density';

export const COLLECTION_VIEW_TYPE='thoughtspace-collection';
/** One physical native-note card; the opaque key belongs to its indexed TFile. */
export interface CollectionBoardReference {key:string;boardPath:string;boardTitle:string;nodeId:string;nodeTitle:string;}
export interface CollectionRecord {
 id:string;path:string;title:string;createdAt:string;tags:readonly string[];
 /** Unknown indexing results must never be represented as unplaced. */
 inBoard:boolean|'unknown';
 placements?:readonly CollectionBoardReference[];
 placementsComplete?:boolean;
}
export interface CollectionTarget {key:string;title:string;groups:readonly {id:string;title:string}[];groupId?:string;}
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
 ready:()=>Promise<void>;sessionId:()=>string;setSessionId:(id:string)=>Promise<void>;
 draft:()=>CollectionViewDraft;updateDraft:(patch:CollectionDraftPatch)=>void;
 submit:(current:()=>boolean)=>Promise<void>;
 subscribe:(listener:(kind?:'draft'|'records')=>void)=>()=>void;
 list:()=>Promise<readonly CollectionRecord[]>;
 /** Return the verified record body without its collection metadata. */
 readBody:(record:CollectionRecord)=>Promise<string>;
 pickAttachment:(current:()=>boolean)=>Promise<CollectionAttachment|undefined>;
 pickTarget:(current:()=>boolean)=>Promise<CollectionTarget|undefined>;
 deliver:(record:CollectionRecord,target:CollectionTarget,current:()=>boolean)=>Promise<{added:number}>;
 openNote:(record:CollectionRecord)=>Promise<void>|void;
 showOccurrences:(record:CollectionRecord)=>Promise<void>|void;
 locateBoard?:(record:CollectionRecord,reference:CollectionBoardReference)=>Promise<void>|void;
 openLegacyInbox:()=>Promise<void>|void;release?:()=>void;
}
export type CollectionFilter='all'|'unplaced';
export function filterCollectionRecords(records:readonly CollectionRecord[],scope:CollectionFilter,tag:string,query:string):CollectionRecord[] {
 const fold=(value:string)=>value.normalize('NFC').toLocaleLowerCase(),chosen=fold(tag.replace(/^#/,''));
 const terms=fold(query.trim()).split(/\s+/).filter(Boolean);
 return records.filter(record=>{
  if(scope==='unplaced'&&record.inBoard!==false)return false;
  const tags=record.tags.map(value=>fold(value.replace(/^#/,'')));
  const tagged=(value:string)=>tags.some(item=>item===value||item.startsWith(value+'/'));
  return(!chosen||tagged(chosen))&&terms.every(term=>term.startsWith('#')?tagged(term.slice(1)):fold(record.title).includes(term)||tags.some(item=>item.includes(term)));
 }).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
}
const PAGE_SIZE=24,PREVIEW_LIMIT=1400,EXPANDED_LIMIT=30000;
type CardPreview={record:CollectionRecord;row:HTMLElement;body:HTMLElement;placements?:HTMLElement;scope:Component;expanded:boolean;loaded:boolean;reading:boolean;text?:string;toggle?:HTMLButtonElement;previewReady?:Promise<void>;finishPreview?:()=>void};
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
 private targetLabel?:HTMLElement;private groupSelect?:HTMLSelectElement;private groupField?:HTMLElement;private targetButton?:HTMLButtonElement;private clearTarget?:HTMLButtonElement;
 private attachButton?:HTMLButtonElement;private submitButton?:HTMLButtonElement;private status?:HTMLElement;private search?:HTMLInputElement;
 private drawerButton?:HTMLButtonElement;private refreshButton?:HTMLButtonElement;private feed?:HTMLElement;private feedStatus?:HTMLElement;private pagination?:HTMLElement;
 private allButton?:HTMLButtonElement;private unplacedButton?:HTMLButtonElement;private tagHeading?:HTMLElement;private liveMessage='';private draftMessage='';
 private submitHotkey?:KeymapEventHandler;
 private located?:{id:string;createdAt:string;origin:CollectionBrowseLocation};private membershipEpoch=0;private membershipTimer?:ReturnType<typeof setTimeout>;
 private restoreEpoch=0;
 constructor(leaf:WorkspaceLeaf,private readonly host:CollectionViewHost){super(leaf);this.scope=new Scope(this.app.scope);}
 getViewType(){return COLLECTION_VIEW_TYPE;}
 getDisplayText(){return '收集';}
 getIcon(){return 'notebook-pen';}
 getState(){return{collectionSession:this.host.sessionId()};}
 async setState(raw:unknown,_result?:ViewStateResult){
  const id=raw&&typeof raw==='object'&&'collectionSession'in raw?raw.collectionSession:undefined;
  if(typeof id!=='string'||!id||id.length>200)return;
  const epoch=++this.stateEpoch;this.preparing=true;this.syncDraft();
  try{await this.host.setSessionId(id);if(epoch!==this.stateEpoch)return;this.app.workspace.requestSaveLayout();}
  catch(error){if(epoch===this.stateEpoch)this.report(error);}
  finally{if(epoch===this.stateEpoch){this.preparing=false;this.syncDraft();}}
 }
 applyPreferences(){applyWorkspaceDensity(this.contentEl,this.host.density?.());this.contentEl.dataset.accent=this.host.accent?.()||'forest';}
 async onOpen(){
  this.alive=true;this.contentEl.empty();this.contentEl.addClass('ts-collection-content');this.applyPreferences();
  this.bindSubmitHotkey();
  const root=this.root=this.contentEl.createDiv({cls:'ts-collection',attr:{'aria-label':'收集'}});
  const layout=root.createDiv('ts-collection-layout');
  this.backdrop=this.button(layout,'关闭筛选','close-drawer',()=>this.setDrawer(false));this.backdrop.addClass('ts-collection-backdrop');this.backdrop.tabIndex=-1;
  this.nav=layout.createEl('aside',{cls:'ts-collection-nav',attr:{'aria-label':'收集筛选'}});
  this.buildNavigation();
  this.main=layout.createEl('main',{cls:'ts-collection-main'});
  for(const event of ['wheel','touchstart','pointerdown'] as const)this.registerDomEvent(this.main,event,()=>{this.restoreEpoch++;});
  const header=this.main.createEl('header',{cls:'ts-collection-header'});
  this.drawerButton=this.button(header,'筛选','drawer',()=>this.setDrawer(!root.classList.contains('is-drawer-open')),'panel-left');
  this.drawerButton.setAttribute('aria-expanded','false');
  const heading=header.createDiv('ts-collection-heading');heading.createSpan({cls:'ts-collection-eyebrow',text:'THOUGHTSPACE'});heading.createEl('h2',{text:'收集'});heading.createSpan({cls:'ts-collection-subtitle',text:'留住一闪而过的念头。'});
  this.refreshButton=this.button(header,'刷新','refresh',()=>{void this.refreshRecords();},'refresh-cw');
  this.buildComposer(this.main);
  const feedHeading=this.main.createDiv('ts-collection-feed-heading');
  this.tagHeading=feedHeading.createEl('h3',{text:'全部记录'});
  this.feedStatus=feedHeading.createSpan({cls:'ts-collection-feed-status',attr:{role:'status','aria-live':'polite'}});
  this.feed=this.main.createDiv({cls:'ts-collection-feed',attr:{'aria-label':'收集记录'}});
  this.pagination=this.main.createDiv('ts-collection-pagination');
  this.unbindViewport=bindMobileViewport(root);
  this.registerDomEvent(root,'keydown',event=>this.keydown(event));
  this.registerEvent(this.app.workspace.on('active-leaf-change',leaf=>{if(leaf!==this.leaf){this.navigationEpoch++;this.setDrawer(false,false);}}));
  this.unsubscribe=this.host.subscribe(kind=>{
   if(!this.alive)return;this.syncDraft();
   if(kind==='records'){this.stale=true;this.syncRefresh();this.membershipEpoch++;if(this.membershipTimer)clearTimeout(this.membershipTimer);this.membershipTimer=setTimeout(()=>{this.membershipTimer=undefined;void this.refreshMembership();},80);}
  });
  this.syncDraft();
  const stateEpoch=this.stateEpoch;
  try{await this.host.ready();if(!this.alive)return;if(stateEpoch===this.stateEpoch)this.preparing=false;this.syncDraft();this.app.workspace.requestSaveLayout();await this.refreshRecords();}
  catch(error){if(stateEpoch===this.stateEpoch)this.preparing=false;this.report(error);this.syncDraft();}
 }
 async onClose(){
  this.alive=false;this.stateEpoch++;this.navigationEpoch++;this.listEpoch++;this.renderEpoch++;this.restoreEpoch++;
  if(this.membershipTimer)clearTimeout(this.membershipTimer);this.membershipTimer=undefined;this.membershipEpoch++;
  this.unsubscribe?.();this.unsubscribe=undefined;this.unbindViewport?.();this.unbindViewport=undefined;
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
 async restoreCollectionLocation(location:CollectionBrowseLocation,current:()=>boolean){
  if(!this.current()||!current())return;
  const epoch=++this.restoreEpoch;let render=this.renderEpoch;const valid=()=>this.current()&&current()&&epoch===this.restoreEpoch&&render===this.renderEpoch;
  if(this.page!==location.page){this.page=location.page;this.renderFeed();}
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
  const epoch=++this.restoreEpoch;let render=this.renderEpoch;const valid=()=>this.current()&&current()&&epoch===this.restoreEpoch&&render===this.renderEpoch,records=await this.host.list();if(!valid())return;
  const found=records.filter(record=>record.id===identity.id&&record.createdAt===identity.createdAt);
  if(found.length!==1)throw Error(found.length?'收集标识有重复，请先核对原笔记':'原记录已移除或收集属性已变化');
  this.located={...identity,origin:this.located?.origin||this.captureCollectionLocation()};this.records=records;
  const filtered=filterCollectionRecords(records,this.filter,this.tag,this.query),index=filtered.indexOf(found[0]);if(index>=0)this.page=Math.floor(index/PAGE_SIZE);
  this.setDrawer(false,false);this.renderNavigation();this.renderFeed();
  render=this.renderEpoch;
  const card=this.cards.find(item=>item.record===found[0]);await this.preparePosition(card);if(card&&valid()){
   card.row.focus({preventScroll:true});if(this.main)this.main.scrollTop=Math.max(0,this.main.scrollTop+card.row.getBoundingClientRect().top-this.main.getBoundingClientRect().top-12);
  }
 }
 private async dismissLocated(){const origin=this.located?.origin,current=this.invocation();this.located=undefined;if(origin)this.page=origin.page;this.renderFeed();if(origin)await this.restoreCollectionLocation(origin,current);}
 private async refreshMembership(){
  const epoch=++this.membershipEpoch;
  try{const records=await this.host.list();if(!this.current()||epoch!==this.membershipEpoch)return;
   this.records=records;
   for(const card of this.cards){const matches=records.filter(record=>record.id===card.record.id&&record.createdAt===card.record.createdAt);const record=matches.length===1?matches[0]:matches.find(item=>item.path===card.record.path);if(record){card.record=record;card.row.dataset.path=record.path;this.renderPlacements(card);}else if(card.placements){card.placements.empty();card.placements.createSpan({text:'原记录已移除 · 刷新查看'});}}
  }catch{/* Keep the last verified list and its visible refresh prompt. */}
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
  const nav=this.nav!;const navHead=nav.createDiv('ts-collection-nav-heading');navHead.createEl('h3',{text:'浏览收集'});
  this.button(navHead,'关闭筛选','close-drawer',()=>this.setDrawer(false),'x');
  const scope=nav.createDiv({cls:'ts-collection-scopes',attr:{role:'group','aria-label':'记录范围'}});
  this.allButton=this.button(scope,'全部','filter-all',()=>this.changeFilter('all'),'layers');this.allButton.dataset.collectionFilter='all';
  this.unplacedButton=this.button(scope,'未放入白板','filter-unplaced',()=>this.changeFilter('unplaced'),'inbox');this.unplacedButton.dataset.collectionFilter='unplaced';
  const searchLabel=nav.createEl('label',{cls:'ts-collection-search-label'});searchLabel.createSpan({text:'搜索'});
  this.search=searchLabel.createEl('input',{type:'search',attr:{placeholder:'标题或 #标签','aria-label':'搜索收集标题或标签','data-collection-search':'true'}});
  this.search.oninput=()=>{this.query=this.search!.value;this.page=0;this.renderFeed();};
  this.search.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){this.setDrawer(false,false);this.tagHeading?.focus({preventScroll:true});}});
  const tags=nav.createDiv('ts-collection-tag-browser');tags.createEl('h4',{text:'标签'});this.tagsList=tags.createDiv('ts-collection-tag-list');
  const tail=nav.createDiv('ts-collection-nav-tail');
  this.button(tail,'旧收件箱','legacy-inbox',()=>this.runAction(()=>this.host.openLegacyInbox()),'archive');
  tail.createEl('p',{text:'旧收件箱保留原来的笔记范围。这里记录新的收集。'});
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
   const controls=Array.from(this.nav.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')).filter(element=>element.getClientRects().length>0);
   const first=controls[0],last=controls[controls.length-1],active=this.contentEl.ownerDocument.activeElement;
   if(first&&(!this.nav.contains(active)||event.shiftKey&&active===first||!event.shiftKey&&active===last)){event.preventDefault();(event.shiftKey?last:first).focus({preventScroll:true});}
  }
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
 private changeFilter(filter:CollectionFilter){this.filter=filter;this.tag='';this.page=0;this.setDrawer(false);this.renderNavigation();this.renderFeed();}
 private chooseTag(tag:string){this.tag=tag;this.page=0;this.setDrawer(false);this.renderNavigation();this.renderFeed();}
 private renderNavigation(){
  this.allButton?.setAttribute('aria-pressed',String(this.filter==='all'));this.unplacedButton?.setAttribute('aria-pressed',String(this.filter==='unplaced'));
  this.allButton?.toggleClass('is-active',this.filter==='all');this.unplacedButton?.toggleClass('is-active',this.filter==='unplaced');
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
 private async refreshRecords(){
  const epoch=++this.listEpoch;this.indexBusy=true;this.syncRefresh();this.feedStatus?.setText('正在读取记录…');
  try{
   const records=await this.host.list();if(!this.alive||epoch!==this.listEpoch)return;
   this.records=records;this.stale=false;this.renderNavigation();this.renderFeed();
  }catch(error){if(this.alive&&epoch===this.listEpoch){this.feedStatus?.setText('记录暂时无法读取，请重试。');this.report(error);}}
  finally{if(this.alive&&epoch===this.listEpoch){this.indexBusy=false;this.syncRefresh();}}
 }
 private disposeCards(){this.observer?.disconnect();this.observer=undefined;this.readQueue=[];for(const card of this.cards){card.scope.unload();card.finishPreview?.();}this.cards=[];}
 private renderFeed(){
  if(!this.feed||!this.alive)return;
  const epoch=++this.renderEpoch,scroll=this.main?.scrollTop||0;this.disposeCards();this.feed.empty();this.pagination?.empty();
  const filtered=filterCollectionRecords(this.records,this.filter,this.tag,this.query),located=this.located&&this.records.find(record=>record.id===this.located!.id&&record.createdAt===this.located!.createdAt),hiddenLocated=located&&!filtered.includes(located);
  this.page=Math.min(this.page,Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1));
  this.tagHeading?.setText((this.filter==='unplaced'?'未放入白板':'全部记录')+(this.tag?' · '+this.tag:''));
  if(this.tagHeading)this.tagHeading.tabIndex=-1;
  const unknown=this.records.some(record=>record.inBoard==='unknown');
  this.feedStatus?.setText(`${filtered.length} 条${unknown&&this.filter==='unplaced'?' · 部分白板未完成索引':''}`);
  if(this.located){const banner=this.feed.createDiv('ts-collection-return-banner');banner.createEl('p',{text:hiddenLocated?'这条记录被当前筛选隐藏，已临时展示。原筛选仍保留。':'已定位原记录，原筛选仍保留。'});this.button(banner,'返回原浏览位置','return-browse',()=>{void this.dismissLocated();},'arrow-left');}
  if(!filtered.length){const empty=this.feed.createDiv('ts-collection-empty');setIcon(empty.createDiv(),'notebook-pen');empty.createEl('h3',{text:this.query||this.tag?'没有匹配的记录':this.filter==='unplaced'?'这里暂时没有待投递记录':'从一个念头开始'});empty.createEl('p',{text:this.query||this.tag?'试试其他标题或标签。':'写在上方，保存后就会出现在这里。'});}
  const win=this.contentEl.ownerDocument.defaultView as(Window&{IntersectionObserver?:typeof IntersectionObserver})|null;
  if(win?.IntersectionObserver)this.observer=new win.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const card=this.cards.find(item=>item.row===entry.target);if(card)this.enqueueRead(card);this.observer?.unobserve(entry.target);}},{root:this.main,rootMargin:'280px'});
  const pageRecords=filtered.slice(this.page*PAGE_SIZE,(this.page+1)*PAGE_SIZE);if(hiddenLocated)pageRecords.unshift(located);
  for(const record of pageRecords){
   const row=this.feed.createEl('article',{cls:'ts-collection-card',attr:{'data-collection-id':record.id,'data-path':record.path,tabindex:'-1'}});row.toggleClass('is-revealed',record===located);
   const body=row.createDiv({cls:'ts-collection-card-body markdown-rendered',attr:{'aria-label':record.title||'记录内容'}});body.createEl('p',{cls:'ts-collection-preview-placeholder',text:'正在载入内容…'});
   const scope=new Component();scope.load();const card:CardPreview={record,row,body,scope,expanded:false,loaded:false,reading:false};this.cards.push(card);
   card.previewReady=new Promise(resolve=>{card.finishPreview=resolve;});
   const foot=row.createDiv('ts-collection-card-footer'),meta=foot.createDiv('ts-collection-card-meta');
   const date=new Date(record.createdAt);meta.createEl('time',{text:Number.isFinite(date.getTime())?date.toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'时间未知',attr:{datetime:record.createdAt,title:Number.isFinite(date.getTime())?date.toLocaleString():record.createdAt}});
   card.placements=meta.createDiv('ts-collection-placements');this.renderPlacements(card);
   const tools=foot.createDiv('ts-collection-card-tools');
   const actions=row.createDiv('ts-collection-card-actions');actions.hidden=true;
   const more=this.button(tools,'更多','more',()=>{actions.hidden=!actions.hidden;more.setAttribute('aria-expanded',String(!actions.hidden));},'ellipsis');more.setAttribute('aria-expanded','false');
   if(record.tags.length){const tags=row.createDiv('ts-collection-card-tags');for(const tag of record.tags.slice(0,20)){const button=this.button(tags,tag.startsWith('#')?tag:'#'+tag,'tag',()=>this.chooseTag(tag));button.dataset.collectionTag=tag;}if(record.tags.length>20)tags.createSpan({text:`另有 ${record.tags.length-20} 个标签`});}
   this.button(actions,'打开笔记','open',()=>this.runAction(()=>this.host.openNote(record)),'file-text');
   this.button(actions,'送往白板或分组…','deliver',()=>{void this.beginDelivery(card,actions,epoch);},'panels-top-left');
   this.button(actions,'定位引用','occurrences',()=>this.runAction(()=>this.host.showOccurrences(record)),'locate-fixed');
   this.observer?this.observer.observe(row):this.enqueueRead(card);
  }
  if(this.pagination&&filtered.length){
   const previous=this.button(this.pagination,'上一页','previous',()=>{this.page--;this.renderFeed();this.scrollToFeed();},'chevron-left');previous.disabled=this.page===0;
   this.pagination.createSpan({text:`第 ${this.page+1} / ${Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))} 页`});
   const next=this.button(this.pagination,'下一页','next',()=>{this.page++;this.renderFeed();this.scrollToFeed();},'chevron-right');next.disabled=(this.page+1)*PAGE_SIZE>=filtered.length;
  }
  if(this.main)this.main.scrollTop=scroll;
 }
 private scrollToFeed(){if(this.main&&this.tagHeading){this.main.scrollTop=Math.max(0,this.main.scrollTop+this.tagHeading.getBoundingClientRect().top-this.main.getBoundingClientRect().top-12);}}
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
 private async beginDelivery(card:CardPreview,actions:HTMLElement,epoch:number){
  if(actions.dataset.pending==='true')return;const currentBase=this.invocation(),current=()=>currentBase()&&epoch===this.renderEpoch&&this.cards.includes(card);
  actions.dataset.pending='true';actions.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=true;});
  try{
   const target=await this.host.pickTarget(current);if(!current()||!target)return;
   actions.querySelector('.ts-collection-delivery')?.remove();const panel=actions.createDiv('ts-collection-delivery');
   panel.createEl('p',{text:'放到 '+target.title});
   const group=panel.createEl('select',{attr:{'aria-label':'投递目标分组','data-collection-delivery-group':'true'}});group.createEl('option',{value:'',text:'白板空白处'});for(const item of target.groups)group.createEl('option',{value:item.id,text:item.title});group.value=target.groupId||'';
   const feedback=panel.createEl('p',{attr:{role:'status','aria-live':'polite'}});let busy=false;
   const confirm=this.button(panel,'确认投递','confirm-delivery',()=>{
    if(busy||!current())return;busy=true;actions.dataset.pending='true';actions.querySelectorAll<HTMLButtonElement>(':scope > button').forEach(button=>{button.disabled=true;});confirm.disabled=true;group.disabled=true;cancel.disabled=true;feedback.setText('正在确认保存…');
    void this.host.deliver(card.record,{...target,groupId:group.value||undefined},current).then(result=>{
     if(!current())return;feedback.setText(result.added?'已放入白板；记录仍保留在收集流。':'这张白板已有引用，未重复添加。');confirm.hidden=true;group.disabled=true;this.stale=true;this.syncRefresh();
    }).catch(error=>{if(current())feedback.setText(error instanceof Error?error.message:String(error));}).finally(()=>{busy=false;actions.dataset.pending='false';actions.querySelectorAll<HTMLButtonElement>(':scope > button').forEach(button=>{button.disabled=false;});if(current()){confirm.disabled=false;cancel.disabled=false;/* Retrying keeps the exact group receipt in the host. */}else panel.remove();});
   },'check');
   const cancel=this.button(panel,'收起','cancel-delivery',()=>{if(!busy)panel.remove();},'x');
  }catch(error){if(current())this.report(error);}
  finally{if(this.alive&&epoch===this.renderEpoch&&this.cards.includes(card)){actions.dataset.pending='false';actions.querySelectorAll<HTMLButtonElement>(':scope > button').forEach(button=>{button.disabled=false;});}}
 }
 private runAction(action:()=>Promise<void>|void){if(!this.current())return;try{void Promise.resolve(action()).catch(error=>this.report(error));}catch(error){this.report(error);}}
}
