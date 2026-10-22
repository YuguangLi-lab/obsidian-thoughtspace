import {Modal,setIcon,type App} from 'obsidian';
import {bindBoardModalViewport} from './board-modal-viewport';
import {themeSurface} from './ui-tokens';
import {applyWorkspaceDensity} from './workspace-density';
import type {CollectionAttachmentItem,CollectionAttachmentKind,CollectionAttachmentPage,CollectionAttachmentQuery} from './collection-context';

export interface CollectionAttachmentBrowserHost {
 current():boolean;
 list(options:CollectionAttachmentQuery,current:()=>boolean):Promise<CollectionAttachmentPage>;
 open(item:CollectionAttachmentItem,current:()=>boolean):Promise<void>;
 source(item:CollectionAttachmentItem,current:()=>boolean):Promise<void>;
 accent?():string;density?():string;
 /** Index changes invalidate displayed file handles without silently replacing
  * them beneath the pointer. Refresh is an explicit new read-only query. */
 subscribe?(changed:()=>void):()=>void;
 watchCurrent?(invalidate:()=>void):()=>void;
 closed?():void;
}

const PAGE_SIZE=24;
const kinds:readonly ['all'|CollectionAttachmentKind,string,string][]=[
 ['all','全部类型','files'],['image','图片','image'],['pdf','PDF','file-text'],
 ['audio','音频','audio-lines'],['video','视频','video'],['other','其他附件','file'],
];
/** A metadata-only directory of collection attachments. Native file opening and
 * source-record navigation remain host-owned and must revalidate opaque items. */
export class CollectionAttachmentBrowser extends Modal {
 private alive=false;private epoch=0;private actionEpoch=0;private closedNotified=false;
 private query='';private kind:'all'|CollectionAttachmentKind='all';private offset=0;
 private loading=false;private navigating=false;private composing=false;private stale=false;
 private timer?:number;private focusFrame=0;private unbind?:()=>void;private offIndex?:()=>void;private offCurrent?:()=>void;
 private page?:CollectionAttachmentPage;private search?:HTMLInputElement;private type?:HTMLSelectElement;
 private listEl?:HTMLElement;private status?:HTMLElement;private count?:HTMLElement;private footer?:HTMLElement;
 private refresh?:HTMLButtonElement;private previous?:HTMLButtonElement;private next?:HTMLButtonElement;private pageLabel?:HTMLElement;
 private rowButtons:HTMLButtonElement[]=[];
 constructor(app:App,private readonly document:Document,private readonly host:CollectionAttachmentBrowserHost){super(app);}
 private current(){return this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===this.document&&!!this.document.defaultView&&!this.document.defaultView.closed&&this.host.current();}
 onOpen(){
  const win=this.document.defaultView;if(!this.host.current()||!win||win.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==this.document)this.document.body.appendChild(this.containerEl);
  this.alive=true;this.modalEl.addClass('ts-collection-attachment-browser','ts-collection-content');
  themeSurface(this.modalEl,{accent:this.host.accent?.()});applyWorkspaceDensity(this.modalEl,this.host.density?.());
  this.modalEl.dataset.collectionAttachmentBrowser='true';this.unbind=bindBoardModalViewport(this.containerEl);
  this.contentEl.createEl('h2',{text:'收集附件'});
  this.contentEl.createEl('p',{cls:'ts-attachment-browser-intro',text:'浏览收集记录引用的库内文件，或回到来源记录。'});
  const controls=this.contentEl.createDiv('ts-attachment-browser-controls');
  const searchLabel=controls.createEl('label');searchLabel.createSpan({text:'查找附件'});
  this.search=searchLabel.createEl('input',{type:'search',attr:{placeholder:'文件名、路径或来源记录','aria-label':'查找收集附件','data-collection-attachment-search':'true',maxlength:'2000'}});
  this.search.oninput=()=>{this.query=this.search!.value;this.offset=0;this.queue(180);};
  this.search.addEventListener('compositionstart',()=>{this.composing=true;this.invalidateQuery();this.message('输入完成后搜索附件。');this.sync();});
  this.search.addEventListener('compositionend',()=>{this.composing=false;this.query=this.search!.value;this.offset=0;this.queue(180);});
  this.search.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&Reflect.get(event,'keyCode')!==229&&!this.composing){event.preventDefault();this.queue();}});
  const typeLabel=controls.createEl('label');typeLabel.createSpan({text:'类型'});
  this.type=typeLabel.createEl('select',{attr:{'aria-label':'附件类型','data-collection-attachment-kind':'true'}});
  for(const[value,text]of kinds)this.type.createEl('option',{value,text});this.type.value='all';
  this.type.onchange=()=>{const value=kinds.find(([kind])=>kind===this.type!.value)?.[0];if(!value)return;this.kind=value;this.offset=0;this.queue();};
  const heading=this.contentEl.createDiv('ts-attachment-browser-heading');
  this.count=heading.createSpan({attr:{'data-collection-attachment-count':'true'}});
  this.refresh=this.button(heading,'刷新','refresh',()=>this.queue(),'refresh-cw');
  this.status=this.contentEl.createEl('p',{cls:'ts-attachment-browser-status',attr:{role:'status','aria-live':'polite','data-collection-attachment-status':'true'}});
  this.listEl=this.contentEl.createEl('ul',{cls:'ts-attachment-browser-list',attr:{'aria-label':'收集附件列表'}});
  this.footer=this.modalEl.createDiv('ts-attachment-browser-footer');
  const pagination=this.footer.createDiv('ts-attachment-browser-pages');
  this.previous=this.button(pagination,'上一页','previous',()=>{if(!this.page)return;this.offset=Math.max(0,this.page.offset-PAGE_SIZE);this.queue();},'chevron-left');
  this.pageLabel=pagination.createSpan({attr:{'data-collection-attachment-page':'true'}});
  this.next=this.button(pagination,'下一页','next',()=>{if(!this.page)return;this.offset=this.page.offset+PAGE_SIZE;this.queue();},'chevron-right');
  this.button(this.footer,'关闭','close',()=>this.close());
  this.offIndex=this.host.subscribe?.(()=>this.indexChanged());
  this.offCurrent=this.host.watchCurrent?.(()=>{if(this.alive)this.close();});
  win.addEventListener('unload',this.windowClosed,{once:true});
  this.focusFrame=win.requestAnimationFrame(()=>{this.focusFrame=0;if(this.current())this.search?.focus({preventScroll:true});});
  this.queue();
 }
 private readonly windowClosed=()=>this.close();
 private button(parent:HTMLElement,label:string,action:string,run:()=>void,icon?:string){
  const button=parent.createEl('button',{attr:{type:'button','aria-label':label,'data-collection-attachment-action':action}});
  if(icon)setIcon(button.createSpan({cls:'ts-attachment-browser-icon',attr:{'aria-hidden':'true'}}),icon);
  button.createSpan({text:label});button.onclick=run;return button;
 }
 private message(text:string){this.status?.setText(text);if(this.status)this.status.hidden=!text;}
 private invalidateQuery(){
  this.epoch++;if(this.timer!==undefined)this.document.defaultView?.clearTimeout(this.timer);this.timer=undefined;
  this.loading=false;this.stale=true;
 }
 private indexChanged(){
  if(!this.alive)return;this.invalidateQuery();this.message('记录或附件有更新，请刷新后继续。');this.sync();
 }
 private queue(delay=0){
  if(!this.current()||this.navigating)return;
  this.invalidateQuery();this.message(this.composing?'输入完成后搜索附件。':delay?'等待输入完成…':'正在读取附件索引…');
  if(this.composing){this.sync();return;}
  this.loading=true;this.sync();const epoch=this.epoch;
  if(delay)this.timer=this.document.defaultView!.setTimeout(()=>{this.timer=undefined;void this.load(epoch);},delay);else void this.load(epoch);
 }
 private async load(epoch:number){
  const current=()=>this.current()&&epoch===this.epoch&&!this.composing;
  try{
   const page=await this.host.list({query:this.query,kind:this.kind,offset:this.offset,limit:PAGE_SIZE},current);
   if(!current())return;this.page=page;this.offset=page.offset;this.stale=false;this.loading=false;this.render(page);
   const warnings:string[]=[];
   if(page.unknown)warnings.push(`${page.unknown} 条记录的索引尚未就绪`);
   if(page.unresolved)warnings.push(`${page.unresolved} 处本地链接未解析，暂不计入附件`);
   if(page.truncated)warnings.push('当前索引结果达到上限，数量仅代表已检查范围');
   this.message(warnings.join('；'));
  }catch(error){
   if(!current())return;this.page=undefined;this.loading=false;this.stale=true;this.listEl?.empty();this.rowButtons=[];
   this.message(error instanceof Error?error.message:String(error));this.count?.setText('附件暂时无法读取');
  }finally{if(current())this.sync();}
 }
 private render(page:CollectionAttachmentPage){
  if(!this.listEl)return;this.listEl.empty();this.rowButtons=[];
  this.count?.setText(`${page.truncated?'至少 ':''}${page.total} 项附件引用`);
  if(!page.items.length)this.listEl.createEl('li',{cls:'ts-attachment-browser-empty',text:this.query||this.kind!=='all'?'没有匹配的附件。试试其他文件名或类型。':'这些收集记录尚未引用可用的库内附件。'});
  for(const item of page.items){
   const row=this.listEl.createEl('li',{cls:'ts-attachment-browser-row',attr:{'data-collection-attachment-path':item.path,'data-collection-attachment-source':item.source.path}});
   const visual=row.createDiv('ts-attachment-browser-file-icon');setIcon(visual,kinds.find(([kind])=>kind===item.kind)?.[2]||'file');visual.setAttribute('aria-hidden','true');
   const detail=row.createDiv('ts-attachment-browser-detail');detail.createEl('strong',{text:item.title||item.path});detail.createEl('small',{text:item.path});
   const origin=detail.createEl('p',{text:`来源：${item.source.title||item.source.path}`});origin.setAttribute('title',item.source.path);
   if(item.source.title&&item.source.title!==item.source.path)detail.createEl('small',{cls:'ts-attachment-browser-source-path',text:item.source.path});
   detail.createSpan({cls:'ts-attachment-browser-kind',text:kinds.find(([kind])=>kind===item.kind)?.[1]||'附件'});
   if(item.source.archived)detail.createSpan({cls:'ts-attachment-browser-kind',text:'来源已归档'});
   const actions=row.createDiv('ts-attachment-browser-row-actions');
   this.rowButtons.push(this.button(actions,'打开附件','open',()=>{void this.navigate(item,'open');},'arrow-up-right'));
   this.rowButtons.push(this.button(actions,'来源记录','source',()=>{void this.navigate(item,'source');},'notebook-pen'));
  }
  this.contentEl.scrollTop=0;
 }
 private sync(){
  const blocked=!this.current()||this.loading||this.navigating||this.composing||this.stale;
  if(this.search)this.search.disabled=this.navigating;if(this.type)this.type.disabled=this.navigating;
  if(this.refresh)this.refresh.disabled=this.navigating||this.loading||this.composing;
  for(const button of this.rowButtons)button.disabled=blocked;
  if(this.previous)this.previous.disabled=blocked||!this.page||this.page.offset===0;
  if(this.next)this.next.disabled=blocked||!this.page||this.page.offset+this.page.items.length>=this.page.total;
  this.pageLabel?.setText(this.page?.total?`${Math.floor(this.page.offset/PAGE_SIZE)+1} / ${Math.max(1,Math.ceil(this.page.total/PAGE_SIZE))}${this.page.truncated?' · 部分索引':''}`:'');
  this.listEl?.setAttribute('aria-busy',String(this.loading));
  this.modalEl.dataset.attachmentState=this.navigating?'navigating':this.loading?'loading':this.stale?'stale':'ready';
 }
 private async navigate(item:CollectionAttachmentItem,action:'open'|'source'){
  if(!this.current()||this.loading||this.stale||this.navigating||this.composing||!this.page?.items.includes(item))return;
  const epoch=this.epoch,actionEpoch=++this.actionEpoch,current=()=>this.current()&&epoch===this.epoch&&actionEpoch===this.actionEpoch;
  this.navigating=true;this.message(action==='source'?'正在返回来源记录…':'正在打开附件…');this.sync();
  try{
   await this.host[action](item,current);
   // Successful native navigation may intentionally change the active leaf.
   // Closing is safe only for this invocation; an earlier result cannot close
   // a reopened/newer dialog or trigger a second navigation.
   if(this.alive&&epoch===this.epoch&&actionEpoch===this.actionEpoch)this.close();
  }catch(error){if(current())this.message(error instanceof Error?error.message:String(error));}
  finally{if(this.alive&&actionEpoch===this.actionEpoch){this.navigating=false;this.sync();}}
 }
 onClose(){
  this.alive=false;this.epoch++;this.actionEpoch++;this.document.defaultView?.cancelAnimationFrame(this.focusFrame);this.focusFrame=0;
  if(this.timer!==undefined)this.document.defaultView?.clearTimeout(this.timer);this.timer=undefined;
  this.document.defaultView?.removeEventListener('unload',this.windowClosed);
  this.offIndex?.();this.offIndex=undefined;this.offCurrent?.();this.offCurrent=undefined;this.unbind?.();this.unbind=undefined;
  this.page=undefined;this.rowButtons=[];this.contentEl.empty();this.footer?.remove();this.footer=undefined;
  if(!this.closedNotified){this.closedNotified=true;this.host.closed?.();}
 }
}
