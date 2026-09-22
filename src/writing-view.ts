import type {SessionUpdate} from './session-events';
import {imageMarkdown,remoteImageUrl} from './image-host';
import {Component,ItemView,MarkdownRenderer,Menu,Notice,TFile,WorkspaceLeaf,parseLinktext,setIcon} from 'obsidian';
import {Board,Card,clone} from './model';
import {WritingState,WritingOption,moveWriting,writingUnits,writingItems,writingOrder,writingParts,writingName,writingMarkdown,writingSignature,writingWordCount} from './writing';
import {rebaseFragment,excerptNoteMarkdown} from './materials';
import {readCurrentNativeNote} from './native-note-state';
import {writingFormatToolbar} from './writing-format-toolbar';
import {DraftInput,NativeMarkdownDraft} from './native-markdown-editor';
import {themeSurface} from './ui-tokens';
export const WRITING='thoughtspace-writing';
interface WritingSession {board:Board;file:TFile;blocked:boolean;status?:string;listeners:Set<(kind:SessionUpdate)=>void>;change:(f:(b:Board)=>void,before?:Board,allowLocked?:boolean,recordHistory?:boolean)=>void;flush:()=>Promise<void>}
export interface WritingHost {session:(file:TFile)=>Promise<WritingSession>;release:(session:any)=>Promise<void>;openBoard:(file:TFile)=>Promise<unknown>;createUnique:(folder:string,name:string,ext:string,text:string)=>Promise<TFile>;openNoteInSidebar:(file:TFile)=>Promise<WorkspaceLeaf>}
const kinds:Record<string,string>={section:'分组',card:'笔记',image:'图片',text:'文本'};
const icons:Record<string,string>={section:'folder-open',card:'file-text',image:'image',text:'type'};
export class WritingView extends ItemView {
 private file?:TFile;
 private owner?:WritingSession;
 private list!:HTMLElement;
 private outline!:HTMLElement;
 private reference!:HTMLElement;
 private tabs!:HTMLElement;
 private paper!:HTMLElement;
 private status!:HTMLElement;
 private totals!:HTMLElement;
 private titleInput!:HTMLTextAreaElement;
 private dock!:HTMLElement;
 private manuscriptHost!:HTMLElement;
 private manuscriptInput?:DraftInput;
 private manuscriptNative?:NativeMarkdownDraft;
 private entryEditors:NativeMarkdownDraft[]=[];
 private entryInputs:DraftInput[]=[];
 private manuscriptToolbar?:()=>void;
 private entryToolbars:(()=>void)[]=[];
 private manuscriptRun=0;
 private manuscriptBaseline?:string;
 private syncingManuscript=false;
 private resourceMode:'library'|'reference'='library';
 private dockOpen=true;
 private compactDockRequested=false;
 private dockWidth=320;
 private dockResize?:HTMLElement;
 private preview?:Component;
 private article?:Component;
 private revision=0;
 private articleRun=0;
 private generation=0;
 private closed=false;
 private dragged?:string;
 private selected?:string;
 private expandedGroups=new Set<string>();
 private query='';
 private filter='all';
 private limit=100;
 private mode:'write'|'outline'|'preview'='write';
 private saving=false;
 private stop?:()=>void;
 private history:WritingState[]=[];
 private future:WritingState[]=[];
 private pendingFields=new Map<string,()=>void>();
 private fieldTimer?:ReturnType<typeof setTimeout>;
 private changing=false;
 private flushing=false;
 private lastSignature='';
 private previewSignature='';
 constructor(leaf:WorkspaceLeaf,private host:WritingHost){super(leaf);}
 getViewType(){return WRITING;}
 getDisplayText(){return (this.file?.basename||'白板')+' · 写作';}
 getIcon(){return 'notebook-pen';}
 getState(){return {board:this.file?.path,resourceMode:this.resourceMode,dockOpen:this.dockOpen,dockWidth:this.dockWidth};}
 async setState(state:{board?:string;resourceMode?:string;dockOpen?:boolean;dockWidth?:number}) {
  if(this.closed)return;
  // Commit while the old editor and owner are still paired. A failed commit keeps both intact.
  this.flushFields();const run=++this.generation;
  this.resourceMode=state.resourceMode==='reference'?'reference':'library';this.dockOpen=state.dockOpen!==false;this.compactDockRequested=false;this.dockWidth=Number.isFinite(state.dockWidth)?Math.max(240,Math.min(520,state.dockWidth!)):320;
  const previous=this.owner;this.owner=undefined;
  this.disposeEditors();this.revision++;this.articleRun++;this.stop?.();this.stop=undefined;
  this.preview?.unload();this.preview=undefined;this.article?.unload();this.article=undefined;
  this.history=[];this.future=[];this.previewSignature='';
  const file=state.board&&this.app.vault.getAbstractFileByPath(state.board);
  this.file=file instanceof TFile?file:undefined;
  this.showTransition('loading','正在准备写作空间…');
  try{
   if(previous)await this.host.release(previous);
   if(this.closed||run!==this.generation)return;
   if(!(file instanceof TFile)){this.showTransition('error','白板已移动或删除，请从白板重新打开写作模式');return;}
   const owner=await this.host.session(file);
   if(this.closed||run!==this.generation){await this.host.release(owner);return;}
   this.file=file;this.owner=owner;this.lastSignature=writingSignature(owner.board);
  const notify=(kind:SessionUpdate='board')=>{if(this.owner!==owner)return;if(kind==='status'){this.renderStatus(true);return;}this.syncManuscript();const signature=writingSignature(owner.board);if(signature===this.lastSignature){this.renderStatus();return;}if(!this.changing){this.history=[];this.future=[];}this.lastSignature=signature;if(this.list&&!this.flushing)this.renderLists();};
  owner.listeners.add(notify);this.stop=()=>owner.listeners.delete(notify);this.contentEl.removeAttribute('aria-busy');this.render();
  }catch(error){if(this.closed||run!==this.generation)return;this.showTransition('error','暂时无法打开写作空间，请重新打开重试');throw error;}
 }
 private showTransition(state:'loading'|'error',message:string){
  const el=this.contentEl;el.empty();themeSurface(el);el.addClass('ts-writing');this.containerEl.addClass('ts-writing-leaf');
  el.setAttribute('aria-busy',String(state==='loading'));
  const status=el.createDiv({cls:'ts-writing-transition',attr:{role:state==='error'?'alert':'status','aria-live':'polite'}});
  setIcon(status.createSpan('ts-writing-transition-icon'),state==='error'?'file-warning':'notebook-pen');
  const text=status.createDiv();text.createEl('strong',{text:this.file?.basename||'白板写作'});text.createSpan({text:message});
 }

 private action(el:HTMLElement,label:string,fn:()=>unknown,icon?:string,iconOnly=false,cls='') {
  const b=el.createEl('button',{cls:('ts-writing-button '+cls+(iconOnly?' is-icon':'')).trim(),attr:{'aria-label':label,title:label,type:'button'}});
  if(icon)setIcon(b.createSpan('ts-writing-icon'),icon);
  if(!iconOnly)b.createSpan({text:label});
  b.onclick=()=>{try{Promise.resolve(fn()).catch(e=>new Notice(String(e)));}catch(e){new Notice(String(e));}};
  return b;
 }
 private ensure(){if(!this.owner||this.owner.blocked||this.app.vault.getAbstractFileByPath(this.file!.path)!==this.file)throw Error('白板不可写，请返回白板检查');return this.owner;}
 private state():WritingState{return this.owner?.board.writing||{title:this.file?.basename||'文章',order:[]};}
 private update(f:(state:WritingState)=>void,remember=true) {
  if(!this.flushing)this.flushFields();const owner=this.ensure(),before=clone(this.state());
  this.changing=true;try{owner.change(board=>{board.writing??={title:this.file!.basename,order:[]};f(board.writing);},undefined,false,remember);}finally{this.changing=false;}
  if(remember&&JSON.stringify(before)!==JSON.stringify(this.state())){this.history.push(before);while(this.history.length>30||this.history.length>1&&this.history.reduce((size,item)=>size+JSON.stringify(item).length,0)>2000000)this.history.shift();this.future=[];}
  this.renderStatus();
 }
 private undo(redo=false) {
  const stack=redo?this.future:this.history,next=stack[stack.length-1];if(!next)return;
  const current=clone(this.state());
  // Reference navigation and the last exported file are not part of article undo.
  const restored={...clone(next),manuscript:current.manuscript,referenceId:current.referenceId,referenceIds:current.referenceIds,draftPath:current.draftPath};
  this.changing=true;try{this.ensure().change(b=>b.writing=restored);}finally{this.changing=false;}
  stack.pop();(redo?this.history:this.future).push(current);this.renderStatus();
 }
 private render() {
  this.flushFields();this.revision++;this.articleRun++;this.preview?.unload();this.article?.unload();this.disposeEditors();const el=this.contentEl;el.empty();themeSurface(el);el.addClass('ts-writing');this.containerEl.addClass('ts-writing-leaf');
  const header=el.createDiv('ts-writing-header');
  const leading=header.createDiv('ts-writing-heading');
  this.action(leading,'返回白板',()=>this.host.openBoard(this.file!),'arrow-left',true);
  const identity=leading.createDiv('ts-writing-identity');identity.createEl('strong',{text:this.file!.basename,attr:{title:this.file!.basename}});identity.createSpan({text:'白板写作'});
  const toolbar=header.createDiv('ts-writing-composer-tools');
  const actions=header.createDiv('ts-writing-header-actions');
  const body=el.createDiv('ts-writing-layout'),middle=body.createDiv('ts-writing-composer');
  this.createDockResize(body);
  this.dock=body.createDiv('ts-writing-dock');
  const dockHead=this.dock.createDiv('ts-writing-dock-head');
  for(const [mode,label,icon] of [['library','材料库','library'],['reference','固定参考','book-open']] as const){const button=this.action(dockHead,label,()=>this.setResourceMode(mode),icon);button.dataset.resourceMode=mode;}
  this.action(dockHead,'收起资料栏',()=>this.closeDock(),'panel-right-close',true);
  const left=this.dock.createDiv('ts-writing-source'),right=this.dock.createDiv('ts-writing-reference');
  const sourceHead=left.createDiv('ts-writing-panel-head');sourceHead.createEl('h3',{text:'来自当前白板'});
  this.action(sourceHead,'加入全部筛选材料',()=>this.addVisible(),'list-plus',true);
  const searchWrap=left.createDiv('ts-writing-search');setIcon(searchWrap.createSpan(),'search');
  const search=searchWrap.createEl('input',{type:'search',value:this.query,attr:{placeholder:'搜索材料…','aria-label':'查找写作材料'}});
  search.oninput=()=>{this.query=search.value;this.limit=100;this.renderLists();};
  const filters=left.createDiv('ts-writing-filters');
  const filterButtons:HTMLButtonElement[]=[];
  const applyFilter=(value:string)=>{this.filter=value;this.limit=100;filterButtons.forEach(button=>{button.toggleClass('is-active',button.dataset.filter===value);button.setAttribute('aria-pressed',String(button.dataset.filter===value));});type.value=['all','unused'].includes(value)?'':value;this.renderLists();};
  for(const [key,label] of [['all','全部'],['unused','未编排']]){const button=this.action(filters,label,()=>applyFilter(key));button.dataset.filter=key;button.toggleClass('is-active',this.filter===key);button.setAttribute('aria-pressed',String(this.filter===key));filterButtons.push(button);}
  const type=filters.createEl('select',{attr:{'aria-label':'材料类型'}});type.createEl('option',{text:'类型',value:''});
  for(const [value,text] of [['section','分组'],['card','笔记'],['text','文本'],['image','图片'],['chapter','章节']])type.createEl('option',{value,text});type.value=['all','unused'].includes(this.filter)?'':this.filter;type.onchange=()=>applyFilter(type.value||'all');
  this.list=left.createDiv('ts-writing-list');left.createDiv({cls:'ts-writing-panel-foot',text:'点击阅读 · ＋ 插入正文 · 拖动编排'});
  const switcher=toolbar.createDiv('ts-writing-switch');
  for(const [key,label,icon] of [['write','写作','pencil-line'],['outline','编排','list-tree'],['preview','预览','book-open']] as const){const button=this.action(switcher,label,()=>this.setArticleMode(key),icon);button.dataset.articleMode=key;button.toggleClass('is-active',key===this.mode);button.setAttribute('aria-pressed',String(key===this.mode));}
  this.action(actions,'新建章节',()=>this.newChapter(),'plus',true);
  const settings=this.action(actions,'写作选项',()=>{},'ellipsis',true);
  settings.onclick=e=>{const menu=new Menu();menu.addItem(i=>i.setTitle('保留材料来源链接').setChecked(this.state().includeSources!==false).onClick(()=>this.update(s=>s.includeSources=s.includeSources===false)));menu.addItem(i=>i.setTitle('撤销编排').setIcon('undo-2').setDisabled(!this.history.length).onClick(()=>this.undo()));menu.addItem(i=>i.setTitle('重做编排').setIcon('redo-2').setDisabled(!this.future.length).onClick(()=>this.undo(true)));menu.addSeparator();menu.addItem(i=>i.setTitle('从编排重建正文（先另存当前正文）').setIcon('files').onClick(()=>this.rebuildManuscript()));menu.showAtMouseEvent(e);};
  this.action(actions,'打开上次草稿',()=>this.openDraft(),'file-pen-line',true,'ts-writing-open-draft');
  this.action(actions,'显示或收起资料栏',()=>this.toggleDock(),'panel-right',true,'ts-writing-dock-toggle');
  this.action(actions,'生成草稿',()=>this.generate(),'arrow-up-right',false,'mod-cta');
  const scroll=middle.createDiv('ts-writing-article-scroll'),intro=scroll.createDiv('ts-writing-article-head');
  intro.createDiv({cls:'ts-writing-eyebrow',text:'文章草稿'});
  this.titleInput=intro.createEl('textarea',{value:this.state().title,attr:{rows:'1',placeholder:'为文章命名','aria-label':'文章标题',maxlength:'160'}});
  this.titleInput.oninput=()=>{this.fitTitle();const title=this.titleInput.value;this.queueField('title',()=>this.update(s=>s.title=title.trim()||this.file!.basename));};this.titleInput.onchange=()=>this.flushFields();
  this.totals=intro.createDiv('ts-writing-totals');
  this.outline=scroll.createDiv({cls:'ts-writing-outline',attr:{'aria-label':'文章顺序'}});
  this.outline.ondragover=e=>{if(this.dragged)e.preventDefault();};
  this.outline.ondrop=e=>{if(!this.dragged)return;e.preventDefault();const id=this.dragged;this.dragged=undefined;this.add(id,writingOrder(this.ensure().board).length);};
  this.manuscriptHost=scroll.createDiv('ts-writing-manuscript');
  this.manuscriptHost.addEventListener('dragover',event=>{if(this.dragged){event.preventDefault();this.manuscriptHost.addClass('is-material-drop');}});
  this.manuscriptHost.addEventListener('dragleave',()=>this.manuscriptHost.removeClass('is-material-drop'));
  this.manuscriptHost.addEventListener('drop',event=>{if(!this.dragged)return;event.preventDefault();event.stopPropagation();const id=this.dragged;this.dragged=undefined;this.manuscriptHost.removeClass('is-material-drop');this.add(id,writingOrder(this.ensure().board).length,true);},true);
  this.paper=scroll.createDiv('ts-writing-paper markdown-rendered');this.outline.hidden=this.mode!=='outline';this.paper.hidden=this.mode!=='preview';this.manuscriptHost.hidden=this.mode!=='write';this.contentEl.dataset.writingMode=this.mode;
  this.status=middle.createDiv('ts-writing-status');

  this.tabs=right.createDiv('ts-writing-reference-tabs');this.reference=right.createDiv('ts-writing-reference-content');
  this.renderLists();this.renderReferenceTabs();
  const ref=this.state().referenceId;
  if(ref&&writingItems(this.ensure().board).some(n=>n.id===ref))void this.showReference(ref,false).catch(e=>new Notice(String(e)));
  else {const empty=this.reference.createDiv('ts-writing-reference-empty');setIcon(empty.createDiv(),'book-open');empty.createEl('h4',{text:'让参考留在身边'});empty.createEl('p',{text:'从材料库选择内容，在这里阅读。固定多份材料后，可随时切换查看。'});}
  this.syncDock();this.fitTitle();if(this.mode==='write')void this.openManuscript();
  if(this.mode==='preview')void this.refreshArticle();
 }
 private createDockResize(parent:HTMLElement){
  const grip=parent.createDiv({cls:'ts-writing-resize',attr:{role:'separator',tabindex:'0','aria-label':'调整参考栏宽度','aria-orientation':'vertical','aria-valuemin':'240','aria-valuemax':'520',title:'拖动调整参考栏 · 双击恢复默认宽度'}});this.dockResize=grip;
  let pointer:number|undefined,start=0,width=0;
  const apply=(value:number)=>{this.dockWidth=Math.max(240,Math.min(520,value));this.contentEl.style.setProperty('--writing-dock-width',this.dockWidth+'px');grip.setAttribute('aria-valuenow',String(this.dockWidth));};
  const finish=()=>{if(pointer===undefined)return;const id=pointer;pointer=undefined;if(grip.hasPointerCapture(id))grip.releasePointerCapture(id);grip.removeClass('is-resizing');this.manuscriptNative?.resize();this.app.workspace.requestSaveLayout();};
  apply(this.dockWidth);
  grip.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;start=e.clientX;width=this.dock.getBoundingClientRect().width;grip.setPointerCapture(pointer);grip.addClass('is-resizing');};
  grip.onpointermove=e=>{if(pointer===e.pointerId)apply(width+start-e.clientX);};
  grip.onpointerup=finish;grip.onpointercancel=finish;grip.onlostpointercapture=finish;
  grip.ondblclick=()=>{apply(320);this.manuscriptNative?.resize();this.app.workspace.requestSaveLayout();};
  grip.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();apply(e.key==='Home'?240:e.key==='End'?520:this.dockWidth+(e.key==='ArrowLeft'?20:-20));this.manuscriptNative?.resize();this.app.workspace.requestSaveLayout();};
 }
 private fitTitle(){if(!this.titleInput?.isConnected)return;this.titleInput.setCssStyles({height:'auto'});this.titleInput.style.height=(this.titleInput.scrollHeight+2)+'px';}
 onResize(){this.syncDock();this.manuscriptNative?.resize();}
 private closeDock(){this.dockOpen=false;this.compactDockRequested=false;this.syncDock();this.app.workspace.requestSaveLayout();}
 private toggleDock(){const open=this.dock.hidden;this.dockOpen=open;this.compactDockRequested=open&&this.contentEl.clientWidth<=900;this.syncDock();this.app.workspace.requestSaveLayout();}
 private syncDock(){
  if(!this.dock)return;const compact=this.contentEl.clientWidth<=900,visible=this.dockOpen&&(!compact||this.compactDockRequested);
  this.contentEl.style.setProperty('--writing-dock-width',this.dockWidth+'px');if(this.dockResize)this.dockResize.hidden=!visible||compact;
  this.dock.hidden=!visible;this.contentEl.toggleClass('is-focus',!visible);
  this.dock.querySelector<HTMLElement>('.ts-writing-source')!.hidden=this.resourceMode!=='library';this.dock.querySelector<HTMLElement>('.ts-writing-reference')!.hidden=this.resourceMode!=='reference';
  this.dock.querySelectorAll<HTMLButtonElement>('[data-resource-mode]').forEach(b=>{b.toggleClass('is-active',b.dataset.resourceMode===this.resourceMode);b.setAttribute('aria-pressed',String(b.dataset.resourceMode===this.resourceMode));});
  const toggle=this.contentEl.querySelector<HTMLButtonElement>('.ts-writing-dock-toggle');toggle?.setAttribute('aria-expanded',String(visible));toggle?.toggleClass('is-active',visible);if(toggle)toggle.title=visible?'收起参考资料，专注写作':'打开参考资料';this.fitTitle();
 }
 private setResourceMode(mode:'library'|'reference'){this.flushFields();this.resourceMode=mode;this.dockOpen=true;this.compactDockRequested=this.contentEl.clientWidth<=900;this.syncDock();}
 private setArticleMode(mode:'write'|'outline'|'preview'){this.flushFields();this.mode=mode;this.outline.hidden=mode!=='outline';this.paper.hidden=mode!=='preview';this.manuscriptHost.hidden=mode!=='write';this.contentEl.dataset.writingMode=mode;this.contentEl.querySelectorAll<HTMLButtonElement>('[data-article-mode]').forEach(button=>{button.toggleClass('is-active',button.dataset.articleMode===mode);button.setAttribute('aria-pressed',String(button.dataset.articleMode===mode));});this.renderLists();if(mode==='preview')void this.refreshArticle();if(mode==='write')void this.openManuscript();}
 private matching() {
  const board=this.ensure().board,used=new Set(writingParts(board).map(p=>p.node.id));
  const chapters=new Set(this.state().chapters?.map(c=>c.id));
  return writingItems(board).filter(n=>(this.filter==='all'||this.filter==='unused'&&!used.has(n.id)||this.filter===n.kind||this.filter==='chapter'&&chapters.has(n.id))&&(writingName(n)+' '+(n.text||'')).toLocaleLowerCase().includes(this.query.toLocaleLowerCase()));
 }
 private addVisible(){const ids=this.matching().map(n=>n.id);if(!ids.length)return;this.update(s=>{s.order=[...new Set([...writingOrder(this.ensure().board),...ids])];for(const id of ids)if(s.options?.[id]?.excluded)s.options={...s.options,[id]:{...s.options[id],excluded:false}};});if(this.mode==='write')void this.insertMaterial(ids).catch(e=>new Notice(String(e)));}
 private add(id:string,index:number,include=false){if(!writingItems(this.ensure().board).some(n=>n.id===id))throw Error('材料已移除');this.update(s=>{s.order=moveWriting(writingOrder(this.ensure().board),id,index);if(include&&s.options?.[id]?.excluded)s.options={...s.options,[id]:{...s.options[id],excluded:false}};});if(include&&this.mode==='write')void this.insertMaterial([id]).catch(e=>new Notice(String(e)));}
 private newChapter(){if(this.mode==='write'&&this.manuscriptInput){const input=this.manuscriptInput,start=input.selectionStart;input.setRangeText('\n\n## 新章节\n\n',start,input.selectionEnd,'end');input.setSelectionRange(start+5,start+8);input.focus();return;}const id='writing-'+crypto.randomUUID();if((this.state().chapters?.length||0)>=500)throw Error('最多 500 个自建章节');this.selected=id;this.mode='outline';this.update(s=>{s.chapters??=[];s.chapters.push({id,title:'新章节',body:''});s.order.push(id);});this.render();const input=this.outline.querySelector<HTMLInputElement>('.ts-writing-editor input');input?.focus();input?.select();}
 private option(id:string,patch:Partial<WritingOption>){this.update(s=>{s.options={...s.options,[id]:{...s.options?.[id],...patch}};});}
 private dragRow(el:HTMLElement,id:string,index?:number){
  el.draggable=true;
  el.ondragstart=e=>{if((e.target as HTMLElement).closest('input,textarea,select')){e.preventDefault();return;}this.dragged=id;if(index===undefined&&this.mode==='preview')this.setArticleMode('outline');e.dataTransfer?.setData('text/x-thoughtspace-writing',id);if(e.dataTransfer)e.dataTransfer.effectAllowed='copyMove';el.addClass('is-dragging');};
  el.ondragend=()=>{this.dragged=undefined;el.removeClass('is-dragging');this.outline.querySelectorAll('.is-drop-before,.is-drop-after').forEach(e=>e.removeClass('is-drop-before','is-drop-after'));};
  if(index===undefined)return;
  el.ondragover=e=>{if(!this.dragged)return;e.preventDefault();e.stopPropagation();const after=e.clientY>el.getBoundingClientRect().top+el.getBoundingClientRect().height/2;el.toggleClass('is-drop-before',!after);el.toggleClass('is-drop-after',after);};
  el.ondragleave=e=>{if(!el.contains(e.relatedTarget as Node)){el.removeClass('is-drop-before','is-drop-after');}};
  el.ondrop=e=>{if(!this.dragged)return;e.preventDefault();e.stopPropagation();const id=this.dragged;this.dragged=undefined;const after=e.clientY>el.getBoundingClientRect().top+el.getBoundingClientRect().height/2;this.add(id,index+(after?1:0));};
 }
 private renderLists(){
  if(!this.owner||!this.list)return;this.flushFields();
  const board=this.owner.board,order=writingOrder(board),nodes=new Map(writingItems(board).map(n=>[n.id,n])),parts=writingParts(board),used=new Set(parts.map(p=>p.node.id));
  const focused=this.contentEl.ownerDocument.activeElement;if(focused!==this.titleInput)this.titleInput.value=this.state().title;this.fitTitle();
  this.entryToolbars.forEach(dispose=>dispose());this.entryToolbars=[];this.entryEditors.forEach(editor=>editor.dispose());this.entryEditors=[];this.entryInputs=[];this.list.empty();this.outline.empty();
  const matches=this.matching();
  for(const n of matches.slice(0,this.limit)){
   const row=this.list.createDiv({cls:'ts-writing-material',attr:{'data-writing-node':n.id}});this.dragRow(row,n.id);row.toggleClass('is-current-reference',this.state().referenceId===n.id);
   setIcon(row.createDiv('ts-writing-material-icon'),icons[n.kind]);
   const name=this.action(row,writingName(n).replace(/[*`]/g,''),()=>this.showReference(n.id),undefined,false,'ts-writing-name');
   name.createEl('small',{text:this.state().chapters?.some(c=>c.id===n.id)?'自建章节':kinds[n.kind]+(n.kind==='section'?' · '+Math.max(0,writingParts(board,[n.id]).length-1)+' 项':'')});
   const included=this.mode!=='write'&&used.has(n.id);const add=this.action(row,included?'已纳入文章':this.mode==='write'?'插入正文':'加入文章',()=>this.add(n.id,order.length,true),included?'check':'plus',true);add.disabled=included;row.toggleClass('is-used',included);
  }
  if(matches.length>this.limit)this.action(this.list,'加载更多 · '+(matches.length-this.limit),()=>{this.limit+=100;this.renderLists();},'chevrons-down');
  if(!matches.length)this.list.createDiv({cls:'ts-writing-small-empty',text:'没有匹配的材料'});
  order.forEach((id,index)=>{
   const n=nodes.get(id);if(!n)return;
   const option=board.writing?.options?.[id],chapter=board.writing?.chapters?.find(c=>c.id===id),name=option?.title||writingName(n);
   const row=this.outline.createDiv({cls:'ts-writing-entry',attr:{'data-writing-node':id}});row.toggleClass('is-excluded',!!option?.excluded);row.toggleClass('is-selected',this.selected===id);this.dragRow(row,id,index);
   const top=row.createDiv('ts-writing-entry-top');top.createSpan({cls:'ts-writing-number',text:String(index+1).padStart(2,'0')});
   const main=this.action(top,name,()=>{this.selected=this.selected===id?undefined:id;this.renderLists();},undefined,false,'ts-writing-entry-name');main.createEl('small',{text:chapter?'自建章节':n.kind==='section'?'分组章节 · '+Math.max(0,writingParts(board,[id]).length-1)+' 份材料':kinds[n.kind]+(option?.excluded?' · 暂不纳入正文':'')});
   const controls=top.createDiv('ts-writing-entry-actions');
   this.action(controls,'参考 '+name,()=>this.showReference(id),'book-open',true);
   this.action(controls,'上移 '+name,()=>this.add(id,index-1),'chevron-up',true).disabled=index===0;
   this.action(controls,'下移 '+name,()=>this.add(id,index+2),'chevron-down',true).disabled=index===order.length-1;
   this.action(controls,'从文章移除 '+name,()=>this.update(s=>s.order=s.order.filter(x=>x!==id)),'x',true);
   if(n.kind==='section'){
    const unfiltered=clone(board);if(unfiltered.writing)unfiltered.writing.options=undefined;
    const children=writingParts(unfiltered,[id]).slice(1),summary=row.createDiv('ts-writing-children');
    for(const child of children.slice(0,this.expandedGroups.has(id)?children.length:4)){
     const button=this.action(summary,board.writing?.options?.[child.node.id]?.title||writingName(child.node),()=>{this.selected=this.selected===child.node.id?undefined:child.node.id;this.renderLists();},undefined,false,'ts-writing-child');
     button.toggleClass('is-excluded',!!board.writing?.options?.[child.node.id]?.excluded);button.toggleClass('is-active',this.selected===child.node.id);
    }
    if(children.length>4)this.action(summary,this.expandedGroups.has(id)?'收起':'＋'+(children.length-4),()=>{this.expandedGroups.has(id)?this.expandedGroups.delete(id):this.expandedGroups.add(id);this.renderLists();});
    const selectedChild=children.find(p=>p.node.id===this.selected);if(selectedChild&&!order.includes(selectedChild.node.id))this.renderEntryEditor(row,selectedChild.node,false);
   }else if(chapter?.body||n.text&&writingName(n)!==n.text)row.createDiv({cls:'ts-writing-snippet',text:(chapter?.body||n.text||'').replace(/[#*`>]/g,'').slice(0,140)});
   if(this.selected===id)this.renderEntryEditor(row,n,chapter!==undefined);
   else if(option?.note)row.createDiv({cls:'ts-writing-note-preview',text:option.note.slice(0,100)});
  });
  if(!order.length){const empty=this.outline.createDiv('ts-writing-empty');setIcon(empty.createDiv(),'list-tree');empty.createEl('h3',{text:'先搭结构，再写正文'});empty.createEl('p',{text:'把分组或卡片拖到这里，排出文章脉络。也可以新建章节，写下你的开场与结论。'});this.action(empty,'新建第一个章节',()=>this.newChapter(),'plus');}
  else this.action(this.outline,'添加章节',()=>this.newChapter(),'plus',false,'ts-writing-add-chapter');
  this.totals.setText(order.length+' 个编排项 · '+parts.filter(p=>p.node.kind!=='section').length+' 份材料');
  this.renderStatus();
 }
 private renderEntryEditor(row:HTMLElement,n:Card,custom:boolean){
  const editor=row.createDiv('ts-writing-editor'),state=this.state(),option=state.options?.[n.id],chapter=state.chapters?.find(c=>c.id===n.id);
  const settings=editor.createEl('details',{cls:'ts-writing-entry-settings'});settings.createEl('summary',{text:'章节设置'});
  const fields=settings.createDiv('ts-writing-editor-fields'),label=fields.createEl('label',{text:'文章中的标题'});
  const title=label.createEl('input',{type:'text',value:option?.title||writingName(n),attr:{maxlength:'160'}});title.oninput=()=>{const value=title.value;this.queueField(n.id+'title',()=>this.option(n.id,{title:value.trim()||writingName(n)}));};title.onchange=()=>this.flushFields();
  const levelLabel=fields.createEl('label',{text:'标题层级'}),level=levelLabel.createEl('select');
  for(const [value,text] of [[0,'正文'],[2,'二级标题'],[3,'三级标题'],[4,'四级标题']] as const)level.createEl('option',{value:String(value),text});level.value=String(option?.level??(n.kind==='text'&&!n.topic?0:writingParts(this.ensure().board).find(p=>p.node.id===n.id)?.depth??2));level.onchange=()=>this.option(n.id,{level:Number(level.value)});
  const contentLabel=editor.createDiv('ts-writing-md-label');contentLabel.setText(custom?'Markdown 正文':'写作批注 · Markdown');
  const surface=editor.createDiv('ts-writing-entry-markdown');
  const input=this.markdownInput(surface,custom?chapter!.body:option?.note||'',false);this.entryInputs.push(input);
  const persist=()=>{const value=input.value;this.queueField(n.id+'body',()=>{if(value.length>(custom?100000:20000))throw Error('章节或批注过长，请拆分后保存；关闭时会另存未保存输入。');return custom?this.update(s=>{const c=s.chapters?.find(c=>c.id===n.id);if(c)c.body=value;}):this.option(n.id,{note:value});});};
  input.addEventListener('input',persist);surface.addEventListener('focusout',()=>this.flushFields());
  const include=settings.createEl('label',{cls:'ts-writing-include'}),check=include.createEl('input',{type:'checkbox'});check.checked=!option?.excluded;include.createSpan({text:'纳入正文'});check.onchange=()=>this.option(n.id,{excluded:!check.checked});
  editor.createEl('small',{text:custom?'章节保存在白板中，随编排一起保存。':'标题、批注和层级只影响文章，原材料内容不变。'});
 }
 private renderStatus(onlySave=false){
  if(!this.status||!this.owner)return;const saveLabel=this.owner.blocked?'写入暂停 · 请返回白板检查':this.owner.status||'编排自动保存';
  if(onlySave){const label=this.status.querySelector<HTMLElement>('.ts-writing-save-label');if(label){if(label.textContent!==saveLabel)label.setText(saveLabel);return;}}
  this.status.empty();
  const left=this.status.createDiv('ts-writing-status-text');setIcon(left.createSpan(),this.owner.blocked?'triangle-alert':'cloud-check');left.createSpan({cls:'ts-writing-save-label',text:saveLabel});
  if(this.mode==='preview'&&this.previewSignature!==this.articleSignature())this.action(this.status,'更新预览',()=>this.refreshArticle(),'refresh-cw');
  if(this.mode==='outline'){this.action(this.status,'撤销编排',()=>this.undo(),'undo-2',true).disabled=!this.history.length;this.action(this.status,'重做编排',()=>this.undo(true),'redo-2',true).disabled=!this.future.length;}
  this.status.createSpan({cls:'ts-writing-status-mode',text:this.mode==='write'?'Markdown · 实时预览':this.mode==='outline'?'拖动调整文章顺序':'Markdown · 阅读预览'});
  const open=this.contentEl.querySelector<HTMLButtonElement>('.ts-writing-open-draft');if(open)open.disabled=!this.state().draftPath;
 }
 private renderReferenceTabs(){
  if(!this.tabs)return;this.tabs.empty();const nodes=new Map(writingItems(this.ensure().board).map(n=>[n.id,n]));
  for(const id of this.state().referenceIds||[]){const n=nodes.get(id);if(!n)continue;const tab=this.tabs.createDiv('ts-writing-reference-tab');tab.toggleClass('is-active',this.state().referenceId===id);this.action(tab,writingName(n),()=>this.showReference(id));this.action(tab,'取消固定 '+writingName(n),()=>{this.update(s=>s.referenceIds=s.referenceIds?.filter(x=>x!==id),false);this.renderReferenceTabs();const active=this.state().referenceId;if(active)void this.showReference(active);},'x',true);}
  this.tabs.hidden=!this.tabs.childElementCount;
 }
 async showReference(id:string,reveal=true){
  const owner=this.ensure(),n=writingItems(owner.board).find(n=>n.id===id);if(!n)return;
  if(reveal)this.setResourceMode('reference');
  this.list.querySelectorAll<HTMLElement>('[data-writing-node]').forEach(row=>row.toggleClass('is-current-reference',row.dataset.writingNode===id));
  if(this.state().referenceId!==id)this.update(s=>s.referenceId=id,false);
  this.renderReferenceTabs();const run=++this.revision;this.preview?.unload();this.reference.empty();
  const scope=new Component();scope.load();this.preview=scope;
  const head=this.reference.createDiv('ts-writing-reference-heading'),identity=head.createDiv('ts-writing-reference-identity');
  const kind=identity.createDiv('ts-writing-reference-kind');setIcon(kind.createSpan(),icons[n.kind]);kind.createSpan({text:owner.board.writing?.chapters?.some(c=>c.id===id)?'自建章节':kinds[n.kind]});
  identity.createEl('h4',{text:writingName(n),attr:{title:writingName(n)}});
  const actions=head.createDiv('ts-writing-reference-actions'),pinned=this.state().referenceIds?.includes(id);
  this.action(actions,pinned?'取消固定':'固定参考',()=>{this.update(s=>{const pins=s.referenceIds||[];if(!pinned&&pins.length>=12)throw Error('最多固定 12 份参考材料');s.referenceIds=pinned?pins.filter(x=>x!==id):[...pins,id];},false);return this.showReference(id);},pinned?'pin-off':'pin',true).setAttribute('aria-pressed',String(!!pinned));
  this.action(actions,'加入文章',()=>this.add(id,writingOrder(owner.board).length,true),'list-plus',true);
  const f=n.file&&this.app.vault.getAbstractFileByPath(n.file);
  if(f instanceof TFile)this.action(actions,'右侧打开原文',async()=>{const leaf=await this.host.openNoteInSidebar(f);leaf.setPinned(true);},'external-link',true);
  const reading=this.reference.createDiv('ts-writing-reference-body');
  let raw=n.kind==='text'?n.text||'':n.kind==='section'?writingParts(owner.board,[id]).slice(1).map(p=>'- '+writingName(p.node)).join('\n'):'';
  try{
   if(n.kind==='image'&&remoteImageUrl(n.imageUrl)&&!(f instanceof TFile))raw=imageMarkdown(n.imageUrl!);
   else if(f instanceof TFile)raw=n.kind==='image'?'!'+this.app.fileManager.generateMarkdownLink(f,this.file!.path):await readCurrentNativeNote(this.app,f);
   if(run!==this.revision)return;
   const content=reading.createDiv('markdown-rendered');await MarkdownRenderer.render(this.app,raw.slice(0,60000),content,f instanceof TFile?f.path:this.file!.path,scope);
   const heading=content.querySelector('h1');if(heading?.textContent?.trim()===writingName(n).trim())heading.remove();
   content.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(input=>input.disabled=true);
   if(raw.length>60000)reading.createEl('small',{text:'预览前 60,000 字符；打开原文查看完整材料。'});
  }catch(e){if(run===this.revision)reading.createEl('p',{text:'无法读取参考材料：'+String(e)});}
 }
 private queueField(key:string,fn:()=>void){this.pendingFields.set(key,fn);if(this.fieldTimer)clearTimeout(this.fieldTimer);this.fieldTimer=setTimeout(()=>{try{this.flushFields();}catch(e){new Notice(String(e));}},250);}
 private flushFields(){if(this.flushing||!this.pendingFields.size)return;if(this.fieldTimer)clearTimeout(this.fieldTimer);this.fieldTimer=undefined;const pending=[...this.pendingFields.values()];this.flushing=true;try{for(const fn of pending)fn();this.pendingFields.clear();}finally{this.flushing=false;}}
 private commitFields(){this.flushFields();const active=this.contentEl.ownerDocument.activeElement;if(active instanceof HTMLElement&&this.contentEl.contains(active))active.blur();const title=this.titleInput.value.trim()||this.file!.basename;if(this.state().title!==title)this.update(s=>s.title=title);}
 private disposeEditors(){this.manuscriptRun++;this.manuscriptToolbar?.();this.manuscriptToolbar=undefined;this.entryToolbars.forEach(dispose=>dispose());this.entryToolbars=[];this.manuscriptNative?.dispose();this.manuscriptNative=undefined;this.manuscriptInput=undefined;this.entryEditors.forEach(editor=>editor.dispose());this.entryEditors=[];}
 private markdownInput(parent:HTMLElement,value:string,whole:boolean):DraftInput{
  try{const native=new NativeMarkdownDraft(this.app,parent,value,this.file);native.host.querySelector('.cm-content')?.setAttribute('aria-label',whole?'文章 Markdown 正文':'章节 Markdown 正文');if(whole)this.manuscriptNative=native;else this.entryEditors.push(native);for(const type of ['dragstart','keydown','paste'])parent.addEventListener(type,e=>e.stopPropagation());this.attachFormatToolbar(parent,native,native,whole);return native;}
  catch(e){parent.createDiv({cls:'ts-writing-small-empty',text:'实时预览暂不可用，已切换为 Markdown 源码编辑。'});const input=parent.createEl('textarea',{value,cls:'ts-writing-source-editor',attr:{'aria-label':'Markdown 源码'}});this.attachFormatToolbar(parent,input,undefined,whole);return input;}
 }
 private attachFormatToolbar(parent:HTMLElement,input:DraftInput,native:NativeMarkdownDraft|undefined,whole:boolean){const dispose=writingFormatToolbar(parent,input,native,()=>!this.owner||this.owner.blocked,message=>new Notice(message));if(whole){this.manuscriptToolbar?.();this.manuscriptToolbar=dispose;}else this.entryToolbars.push(dispose);}
 private articleSignature(){return this.state().manuscript!==undefined?'manuscript:'+this.state().manuscript:writingSignature(this.ensure().board);}
 private async openManuscript(){
  if(this.manuscriptInput){this.manuscriptNative?.resize();return;}
  const run=++this.manuscriptRun,owner=this.ensure();
  this.manuscriptHost.setText('正在打开 Markdown 正文…');
  try{
   let value=this.state().manuscript;
   if(value===undefined){value=writingParts(owner.board).length?(await this.compose()).text:'# '+this.state().title+'\n\n';if(run!==this.manuscriptRun||owner!==this.owner)return;this.update(s=>s.manuscript=value,false);}
   if(run!==this.manuscriptRun||owner!==this.owner)return;
   this.manuscriptHost.empty();this.manuscriptBaseline=value;const input=this.manuscriptInput=this.markdownInput(this.manuscriptHost,value,true);
   input.addEventListener('input',()=>{if(this.syncingManuscript)return;const text=input.value;if(text.length>1000000){this.queueField('manuscript',()=>{throw Error('正文超过 1,000,000 字符，请分篇写作；关闭时会另存当前输入。');});return;}this.queueField('manuscript',()=>{if(this.state().manuscript!==this.manuscriptBaseline&&this.state().manuscript!==text)throw Error('其他窗口已修改正文；当前输入未覆盖它，请先复制当前正文。');this.update(s=>s.manuscript=text,false);this.manuscriptBaseline=text;});});
   this.manuscriptHost.addEventListener('focusout',()=>this.flushFields(),{once:true});
   this.manuscriptNative?.resize();
  }catch(e){if(run===this.manuscriptRun)this.manuscriptHost.setText('无法打开正文：'+String(e));}
 }
 private syncManuscript(){const input=this.manuscriptInput,value=this.state().manuscript;if(this.changing||!input||value===undefined||value===this.manuscriptBaseline||input.value!==this.manuscriptBaseline)return;this.syncingManuscript=true;try{const start=input.selectionStart,end=input.selectionEnd;input.value=value;input.setSelectionRange(Math.min(start,value.length),Math.min(end,value.length));this.manuscriptBaseline=value;}finally{this.syncingManuscript=false;}}
 private async insertMaterial(ids:string[]){
  await this.openManuscript();const input=this.manuscriptInput;if(!input)return;const old=input.value,start=input.selectionStart,end=input.selectionEnd;
  const result=await this.compose(ids);const fragment=result.text.split('\n\n').slice(2).join('\n\n').trim();
  if(this.manuscriptInput!==input||input.value!==old)throw Error('正文已变化，请重新插入材料');
  input.setRangeText('\n\n'+fragment+'\n\n',start,end,'end');input.focus();this.flushFields();
 }
 private async rebuildManuscript(){
  this.commitFields();const owner=this.ensure(),old=this.state().manuscript,result=await this.compose();
  if(old!==undefined){const backup=await this.host.createUnique('ThoughtSpace/草稿',this.state().title+'-正文备份','md',old);new Notice('原正文已另存：'+backup.path);}
  this.commitFields();if(this.owner!==owner||this.state().manuscript!==old)throw Error('正文已变化，未覆盖当前编辑');
  this.manuscriptToolbar?.();this.manuscriptToolbar=undefined;this.manuscriptNative?.dispose();this.manuscriptInput=undefined;this.manuscriptNative=undefined;this.update(s=>s.manuscript=result.text,false);this.setArticleMode('write');
 }
 /** Read a consistent snapshot, preserving native-editor saves and rebasing file links. */
 private async compose(order?:string[]){
  this.commitFields();const owner=this.ensure(),snapshot=clone(owner.board),signature=writingSignature(snapshot),parts=writingParts(snapshot,order);
  if(parts.length>500)throw Error('单篇最多 500 个材料，请分章写作');
  const destination='ThoughtSpace/草稿/草稿.md',rows:{title:string;depth:number;body:string;source?:string}[]=[],reads=new Map<TFile,{raw:string;path:string}>();
  for(const {node:n,depth,note} of parts){
   let body=n.kind==='text'?excerptNoteMarkdown(n.text||''):'',source:string|undefined;
   if(n.kind==='image'&&remoteImageUrl(n.imageUrl)){body=imageMarkdown(n.imageUrl!);source=n.imageUrl;}
   else if(n.file){
    const file=this.app.vault.getAbstractFileByPath(n.file);if(!(file instanceof TFile))throw Error(`材料不存在：${n.file}`);
    source=this.app.fileManager.generateMarkdownLink(file,destination);
    if(n.kind==='image')body='!'+source;
    else{
     const raw=reads.get(file)?.raw??await readCurrentNativeNote(this.app,file);reads.set(file,{raw,path:file.path});
     const cache=this.app.metadataCache.getFileCache(file);
     const references=[...(cache?.links||[]),...(cache?.embeds||[])].flatMap(ref=>{const parsed=parseLinktext(ref.link),target=parsed.path?this.app.metadataCache.getFirstLinkpathDest(parsed.path,file.path):file;if(!target)return[];let replacement=this.app.fileManager.generateMarkdownLink(target,destination,parsed.subpath,ref.displayText);if(ref.original.startsWith('!')&&!replacement.startsWith('!'))replacement='!'+replacement;return[{original:ref.original,replacement,start:ref.position.start,end:ref.position.end}];});
     body=rebaseFragment(raw,{id:'draft',kind:'paragraph',title:'',heading:'',body:raw,start:1,end:raw.split('\n').length},references);
    }
   }
   if(note?.trim())body+='\n\n'+note.trim();
   const explicit=snapshot.writing?.options?.[n.id]?.level;
   rows.push({title:writingName(n),depth:explicit??(n.kind==='text'&&!n.topic?0:depth),body,source:snapshot.writing?.includeSources===false?undefined:source});
  }
  if(this.ensure()!==owner||writingSignature(owner.board)!==signature)throw Error('编排或材料在读取期间发生变化，请重试');
  for(const [file,r] of reads)if(file.path!==r.path||this.app.vault.getAbstractFileByPath(r.path)!==file||await readCurrentNativeNote(this.app,file)!==r.raw)throw Error('材料在读取期间发生变化，请重试');
  if(this.ensure()!==owner||writingSignature(owner.board)!==signature)throw Error('编排在读取期间发生变化，请重试');
  const text=writingMarkdown(snapshot.writing?.title||this.file!.basename,rows,this.app.fileManager.generateMarkdownLink(this.file!,destination));
  return {text,snapshot,owner,signature,destination,words:writingWordCount(rows.map(r=>r.body).join('\n'))};
 }
 async refreshArticle(){
  const run=++this.articleRun;this.article?.unload();this.paper.empty();this.paper.createDiv({cls:'ts-writing-small-empty',text:'正在排版…'});
  try{
   this.commitFields();const result=this.state().manuscript!==undefined?{text:this.state().manuscript!,destination:'ThoughtSpace/草稿/草稿.md',signature:this.articleSignature(),words:writingWordCount(this.state().manuscript!)}:await this.compose();if(run!==this.articleRun||!this.owner)return;
   this.paper.empty();const scope=new Component();scope.load();this.article=scope;
   const summary=this.paper.createDiv('ts-writing-preview-summary');summary.createSpan({text:result.words.toLocaleString()+' 字 / 词 · 约 '+Math.max(1,Math.ceil(result.words/400))+' 分钟阅读'});
   this.action(summary,'刷新正文',()=>this.refreshArticle(),'refresh-cw',true);
   const body=this.paper.createDiv('ts-writing-preview-body');
   await MarkdownRenderer.render(this.app,result.text,body,result.destination,scope);
   if(run!==this.articleRun||!this.owner)return;
   this.contentEl.dataset.previewManuscript=String(this.state().manuscript!==undefined);if(this.state().manuscript===undefined)body.querySelector('h1')?.remove();
   body.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(input=>input.disabled=true);
   if(run!==this.articleRun)return;this.previewSignature=result.signature;this.renderStatus();
  }catch(e){if(run===this.articleRun){this.paper.empty();this.paper.createDiv({cls:'ts-writing-small-empty',text:String(e)});}}
 }
 private async pinNativeReference(board:Board){const n=writingItems(board).find(n=>n.id===board.writing?.referenceId),file=n?.file&&this.app.vault.getAbstractFileByPath(n.file);if(file instanceof TFile&&file.extension==='md'){const leaf=await this.host.openNoteInSidebar(file);leaf.setPinned(true);}}
 async openDraft(){this.commitFields();const path=this.state().draftPath,file=path&&this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile))throw Error('草稿不存在，请先生成草稿');await this.pinNativeReference(this.ensure().board);await this.app.workspace.getLeaf('tab').openFile(file);}
 async generate(){
  if(this.saving)return;this.saving=true;this.contentEl.addClass('is-generating');
  try{
   this.commitFields();const owner=this.ensure();const result=this.state().manuscript!==undefined?{text:this.state().manuscript!,snapshot:clone(owner.board),owner}:await this.compose();
   const draft=await this.host.createUnique('ThoughtSpace/草稿',result.text.match(/^# ([^\n]+)/)?.[1]||result.snapshot.writing?.title||this.file!.basename,'md',result.text);
   // Capture the exporting session: changing/closing the view must not attach a draft to another board.
   result.owner.change(b=>{b.writing??={title:this.file!.basename,order:[]};b.writing.draftPath=draft.path;});
   await result.owner.flush();if(this.owner===result.owner)this.renderStatus();
   await this.pinNativeReference(result.owner.board);await this.app.workspace.getLeaf('tab').openFile(draft);new Notice('已生成独立草稿，使用 Obsidian 原生编辑器继续写作');return draft;
  }finally{this.saving=false;this.contentEl.removeClass('is-generating');}
 }
 async onClose(){
  if(this.closed)return;this.closed=true;this.generation++;this.revision++;this.articleRun++;
  this.containerEl.removeClass('ts-writing-leaf');
  let recovery:{text:string;name:string}|undefined;
  try{this.flushFields();}
  catch(error){const values=[this.manuscriptInput?.value,...this.entryInputs.map(input=>input.value)].filter((value):value is string=>value!==undefined);if(values.length)recovery={text:values.join('\n\n---\n\n'),name:(this.file?.basename||'文章')+'-未保存正文'};else new Notice(String(error));}
  // Detach synchronously: saving/recovery can take time or fail after the view has closed.
  const owner=this.owner;this.owner=undefined;
  this.pendingFields.clear();if(this.fieldTimer)clearTimeout(this.fieldTimer);this.fieldTimer=undefined;
  this.disposeEditors();this.stop?.();this.stop=undefined;this.preview?.unload();this.preview=undefined;this.article?.unload();this.article=undefined;
  this.contentEl.empty();this.contentEl.removeAttribute('aria-busy');
  try{if(recovery){try{const file=await this.host.createUnique('ThoughtSpace/草稿',recovery.name,'md',recovery.text);new Notice('当前正文已另存：'+file.path);}catch(error){new Notice('正文保存失败：'+String(error));}}}
  finally{if(owner)await this.host.release(owner);}
 }
}
