import {remoteImageUrl} from './image-host';
import {App,Component,MarkdownRenderer,Modal,Notice,TFile,setIcon} from 'obsidian';
import {Board,Card} from './model';
import {AppearanceSettings} from './workspace';
import {ReadingOptions,readingTitle,readingItems,readingProgress,readingDigest,markReading,reviewLabels,ReviewState,readingRelations,readingWindow} from './reading-desk';
import {themeSurface} from './ui-tokens';
interface ReadingHost{board:()=>Board;ids:Set<string>;title:string;settings:AppearanceSettings;commit:(edit:(b:Board)=>void)=>void;reveal:(id:string)=>void;open:(file:TFile)=>Promise<unknown>;}
export class ReadingDesk extends Modal{
 private options:ReadingOptions={query:'',status:'all',sort:'board',onlySelected:false};private activeId?:string;private list!:HTMLElement;private page!:HTMLElement;private reader!:HTMLElement;private commandBar!:HTMLElement;private pageNav!:HTMLElement;private progress!:HTMLElement;private counter!:HTMLElement;private previewScope?:Component;private lifecycle?:Component;private generation=0;private pageKey='';private alive=false;private statusSelect!:HTMLSelectElement;private filterCaption?:HTMLElement;private companion!:HTMLElement;private asideTab:'queue'|'outline'|'relations'='queue';private asideTabs!:HTMLElement;private headings:HTMLElement[]=[];
 constructor(app:App,private host:ReadingHost){super(app);this.options.onlySelected=host.ids.size>0;}
 private run(fn:()=>unknown){if(!this.alive)return;try{Promise.resolve(fn()).catch(e=>new Notice(String(e)));}catch(e){new Notice(String(e));}}
 private button(el:HTMLElement,label:string,icon:string,fn:()=>unknown){const b=el.createEl('button',{attr:{'aria-label':label,title:label}});if(icon)setIcon(b.createSpan(),icon);b.createSpan({text:label});b.onclick=()=>this.run(fn);return b;}
 private items(){return readingItems(this.host.board(),this.host.ids,this.options);}
 onOpen(){this.alive=true;themeSurface(this.modalEl);this.modalEl.addClass('ts-reading-desk');this.modalEl.dataset.surface=this.host.settings.surfaceStyle;this.modalEl.style.setProperty('--ts-reading-size',`${this.host.settings.readingSize}px`);this.modalEl.dataset.readingWidth=this.host.settings.readingWidth;this.titleEl.empty();
 const heading=this.titleEl.createDiv('ts-reading-heading'),identity=heading.createDiv('ts-reading-identity');setIcon(identity.createSpan('ts-reading-mark'),'book-open');const title=identity.createDiv();title.createDiv({cls:'ts-reading-title',text:'阅读桌'});title.createDiv({cls:'ts-reading-context',text:this.host.title,attr:{title:this.host.title}});this.progress=heading.createDiv('ts-reading-progress');
 const body=this.contentEl.createDiv('ts-reading-layout'),aside=body.createDiv('ts-reading-aside');
 const tools=aside.createDiv('ts-reading-tools'),search=tools.createEl('input',{type:'search',attr:{placeholder:'搜索标题、路径或文本…','aria-label':'搜索阅读内容'}});search.oninput=()=>this.run(()=>{this.options.query=search.value;this.renderList();});
 const filterPanel=tools.createEl('details',{cls:'ts-reading-filter-panel'}),summary=filterPanel.createEl('summary');setIcon(summary.createSpan(),'sliders-horizontal');this.filterCaption=summary.createSpan({text:'筛选与排序'});const filters=filterPanel.createDiv('ts-reading-filter-grid');
 this.statusSelect=filters.createEl('select',{attr:{'aria-label':'阅读状态筛选'}});for(const[value,text]of Object.entries({all:'全部状态',...reviewLabels}))this.statusSelect.createEl('option',{value,text});this.statusSelect.onchange=()=>this.run(()=>{this.options.status=this.statusSelect.value as ReadingOptions['status'];this.renderList();});
 const scope=filters.createEl('select',{attr:{'aria-label':'阅读范围'}});scope.createEl('option',{value:'all',text:'整张白板'});scope.createEl('option',{value:'selected',text:'打开时的选区'});scope.value=this.options.onlySelected?'selected':'all';scope.onchange=()=>this.run(()=>{this.options.onlySelected=scope.value==='selected';this.renderList();});
 const sort=filters.createEl('select',{attr:{'aria-label':'阅读排序'}});sort.createEl('option',{value:'board',text:'白板顺序'});sort.createEl('option',{value:'title',text:'标题排序'});sort.onchange=()=>this.run(()=>{this.options.sort=sort.value as ReadingOptions['sort'];this.renderList();});
 const kind=filters.createEl('select',{attr:{'aria-label':'阅读内容类型'}});for(const [value,text]of Object.entries({all:'全部类型',card:'笔记',text:'文本',image:'图片'}))kind.createEl('option',{value,text});kind.onchange=()=>this.run(()=>{this.options.kind=kind.value as ReadingOptions['kind'];this.renderList();});
 const connection=filters.createEl('select',{attr:{'aria-label':'阅读关联筛选'}});for(const [value,text]of Object.entries({all:'全部关联',connected:'有连线',isolated:'未连接'}))connection.createEl('option',{value,text});connection.onchange=()=>this.run(()=>{this.options.connection=connection.value as ReadingOptions['connection'];this.renderList();});
 const batch=filters.createEl('select',{attr:{'aria-label':'批量标记当前筛选结果'}});batch.createEl('option',{value:'',text:'批量标记…'});for(const [value,text]of Object.entries(reviewLabels))batch.createEl('option',{value,text:'全部设为'+text});batch.onchange=()=>{const status=batch.value as ReviewState;batch.value='';if(!status)return;this.run(()=>{const items=this.items(),ids=new Set(items.filter(n=>!n.locked).map(n=>n.id));if(!ids.size){new Notice('当前范围没有可修改的对象');return;}this.host.commit(board=>markReading(board,ids,status));this.renderList();new Notice(`已标记 ${ids.size} 项${items.length>ids.size?'，已跳过锁定对象':''}`);});};
 this.asideTabs=aside.createDiv({cls:'ts-reading-aside-tabs',attr:{role:'group','aria-label':'阅读导航'}});
 for(const [id,label]of [['queue','内容'],['outline','目录'],['relations','关联']] as const){const tab=this.button(this.asideTabs,label,'',()=>{this.asideTab=id;this.renderCompanion();});tab.dataset.readingTab=id;}
 this.companion=aside.createDiv('ts-reading-companion');this.counter=aside.createDiv('ts-reading-count');this.list=aside.createDiv({cls:'ts-reading-list',attr:{role:'group','aria-label':'阅读列表'}});this.reader=body.createDiv({cls:'ts-reading-reader',attr:{'aria-label':'阅读正文'}});this.commandBar=this.reader.createDiv('ts-reading-commandbar');this.page=this.reader.createDiv({cls:'ts-reading-page',attr:{tabindex:'0','aria-label':'文章内容'}});this.pageNav=this.reader.createDiv('ts-reading-pagination');this.buildReaderControls();
 const footer=this.contentEl.createDiv('ts-reading-footer'),utilities=footer.createDiv('ts-reading-utilities');this.button(utilities,'复制回顾清单','clipboard-list',async()=>{await navigator.clipboard.writeText(readingDigest(this.items(),this.host.title));new Notice('已复制当前筛选范围的回顾清单');});const focus=this.button(utilities,'专注正文','panel-left-close',()=>{const active=this.modalEl.classList.toggle('ts-reading-focused');focus.setAttribute('aria-pressed',String(active));});focus.setAttribute('aria-pressed','false');
 const typography=footer.createDiv('ts-reading-typography');typography.createSpan({text:'字号'});const font=typography.createEl('select',{attr:{'aria-label':'本次阅读字号'}});for(const size of [14,16,18,20])font.createEl('option',{value:String(size),text:`${size} px`});font.value=String(this.host.settings.readingSize);font.onchange=()=>this.modalEl.style.setProperty('--ts-reading-size',`${font.value}px`);
 this.lifecycle=new Component();this.lifecycle.load();this.lifecycle.registerDomEvent(this.list,'focusin',e=>{const target=(e.target as HTMLElement).closest('button');if(target&&this.list.contains(target)&&!this.list.hidden)target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});});this.lifecycle.registerDomEvent(this.modalEl,'keydown',e=>{
  if(e.isComposing||e.keyCode===229||!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowLeft','ArrowRight'].includes(e.key)||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;
  e.preventDefault();e.stopPropagation();this.run(()=>this.step(e.key==='ArrowLeft'?-1:1));
 });this.lifecycle.registerEvent(this.app.vault.on('modify',file=>{if(this.alive){try{const n=this.host.board().nodes.find(n=>n.id===this.activeId);if(n?.file===file.path)this.run(()=>this.renderPage(n,true));}catch{/* Board switched: callbacks remain guarded by the host. */}}}));this.renderList();
 }
 private renderList(){const focused=this.list.ownerDocument.activeElement,queueFocused=!!focused&&this.list.contains(focused),scrollTop=this.list.scrollTop;const filters=[this.options.status!=='all',this.options.onlySelected,this.options.sort!=='board',!!this.options.kind&&this.options.kind!=='all',!!this.options.connection&&this.options.connection!=='all'].filter(Boolean).length;this.filterCaption?.setText(filters?`筛选与排序 · ${filters}`:'筛选与排序');const board=this.host.board(),items=this.items(),all=readingItems(board,this.host.ids,{...this.options,query:'',status:'all',kind:'all',connection:'all'}),progress=readingProgress(all);this.progress.empty();this.progress.createSpan({text:`已读 ${progress.done} / ${progress.total}`});this.progress.createEl('progress',{attr:{value:progress.done,max:Math.max(1,progress.total),'aria-label':'阅读完成进度'}});this.list.empty();if(!items.some(n=>n.id===this.activeId))this.activeId=items[0]?.id;
 const window=readingWindow(items,this.activeId);this.counter.setText(`${items.length} 项内容${items.length>100?` · ${window.start+1}–${window.end}`:''}`);
 for(const n of window.nodes){const b=this.button(this.list,readingTitle(n).slice(0,160),n.kind==='card'?'file-text':n.kind==='image'?'image':'type',()=>{this.activeId=n.id;this.renderList();});b.addClass('ts-reading-item');b.dataset.node=n.id;b.dataset.review=n.review||'later';b.setAttribute('aria-pressed',String(n.id===this.activeId));b.createEl('small',{text:reviewLabels[n.review||'later']});}
 if(items.length>100){const pager=this.list.createDiv('ts-reading-queue-pager');const prev=this.button(pager,'前一组','chevron-left',()=>{this.activeId=items[Math.max(0,window.start-100)]?.id;this.renderList();});prev.disabled=window.start===0;const next=this.button(pager,'后一组','chevron-right',()=>{this.activeId=items[window.end]?.id;this.renderList();});next.disabled=window.end>=items.length;}
 this.list.scrollTop=scrollTop;if(queueFocused){const target=Array.from(this.list.querySelectorAll<HTMLButtonElement>('[data-node]')).find(b=>b.dataset.node===this.activeId);if(target&&!this.list.hidden){target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}else this.asideTabs.querySelector<HTMLButtonElement>('[data-reading-tab=queue]')?.focus({preventScroll:true});}
 if(!items.length){if(focused&&this.reader.contains(focused))this.modalEl.querySelector<HTMLInputElement>('[aria-label="搜索阅读内容"]')?.focus({preventScroll:true});this.headings=[];this.renderCompanion();this.list.createDiv({cls:'ts-reading-empty',text:'没有匹配内容，试试更换状态或范围。'});this.page.empty();this.commandBar.hidden=true;this.pageNav.hidden=true;this.page.createDiv({cls:'ts-reading-blank',text:'没有匹配的阅读内容。调整左侧筛选，继续探索白板。'});this.pageKey='';this.generation++;this.previewScope?.unload();this.previewScope=undefined;return;}
 const n=board.nodes.find(n=>n.id===this.activeId);if(n)this.run(()=>this.renderPage(n));
 }
 private buildReaderControls(){
  const current=()=>this.host.board().nodes.find(node=>node.id===this.activeId);
  const state=this.commandBar.createDiv('ts-reading-state');state.createSpan({text:'阅读状态'});
  const status=state.createEl('select',{attr:{'aria-label':'当前阅读状态','data-reading-review':'true'}});
  for(const [value,text]of Object.entries(reviewLabels))status.createEl('option',{value,text});
  status.onchange=()=>this.run(()=>{const n=current();if(!n||n.locked)return;this.host.commit(board=>markReading(board,new Set([n.id]),status.value as ReviewState));this.renderList();});
  const actions=this.commandBar.createDiv('ts-reading-actions');
  const finish=this.button(actions,'已读并下一篇','check',()=>{const n=current();if(!n||n.locked)return;const items=this.items(),index=items.findIndex(item=>item.id===n.id),next=items[index+1]?.id;this.host.commit(board=>markReading(board,new Set([n.id]),'done'));this.activeId=next||n.id;this.renderList();});finish.dataset.readingFinish='true';finish.addClass('mod-cta');
  const locate=this.button(actions,'定位白板','locate-fixed',()=>{const n=current();if(n){this.host.reveal(n.id);this.close();}});locate.addClass('ts-reading-icon-action');
  const open=this.button(actions,'右侧打开原文','panel-right',async()=>{const n=current(),file=n?.file?this.app.vault.getAbstractFileByPath(n.file):null;if(file instanceof TFile){await this.host.open(file);if(this.alive)this.close();}});open.addClass('ts-reading-icon-action');open.dataset.readingOpen='true';
  const previous=this.button(this.pageNav,'上一篇','arrow-left',()=>this.step(-1));previous.dataset.readingPrevious='true';
  this.pageNav.createSpan({attr:{'data-reading-position':'true'}});
  const next=this.button(this.pageNav,'下一篇','arrow-right',()=>this.step(1));next.dataset.readingNext='true';
 }
 private async renderPage(n:Card,force=false){
 if(!this.alive)return;
 const file=n.file?this.app.vault.getAbstractFileByPath(n.file):null;
 const key=JSON.stringify([n.id,n.kind,readingTitle(n),n.text,n.file,n.imageUrl,file instanceof TFile?[file.path,file.stat.mtime,file.stat.size]:null]);
 if(!force&&key===this.pageKey){this.syncPageControls(n);this.renderCompanion();return;}
 this.pageKey=key;let ready=false;
 const generation=++this.generation;
 try{
 this.previewScope?.unload();const scope=new Component();scope.load();this.previewScope=scope;this.page.empty();this.page.scrollTop=0;this.headings=[];this.renderCompanion();const head=this.page.createDiv('ts-reading-page-head');head.createDiv({cls:'ts-reading-eyebrow',text:n.kind==='card'?'笔记原文':n.kind==='image'?'图像资料':'白板文本'});head.createEl('h2',{text:readingTitle(n).slice(0,160)});if(n.file)head.createDiv({cls:'ts-reading-source',text:n.file});
 const content=this.page.createDiv('ts-reading-prose');this.syncPageControls(n);

 let text=n.text||'',source=n.file||'';
 if(n.kind==='image'){const remote=remoteImageUrl(n.imageUrl),local=file instanceof TFile?this.app.vault.getResourcePath(file):undefined;if(remote||local){const img=content.createEl('img',{attr:{src:(remote||local)!,alt:readingTitle(n),referrerpolicy:'no-referrer'}});let fallback=false;img.onerror=()=>{if(!img.isConnected)return;if(remote&&local&&!fallback){fallback=true;img.src=local;}else content.setText('图片无法显示，请打开原文件检查。');};}else content.setText('原图片不存在，白板引用已保留。');}
 else{if(n.kind==='card'){if(!(file instanceof TFile)){content.setText('找不到原笔记，请重新关联或恢复该文件。');return;}if(file.stat.size>2*1024*1024){content.setText('笔记大于 2 MB，请使用“右侧打开原文”阅读。');return;}try{text=await this.app.vault.cachedRead(file);}catch{if(this.alive&&generation===this.generation)content.setText('笔记暂时无法读取，请重试或打开原文。');return;}}
 if(!this.alive||generation!==this.generation){scope.unload();return;}if(text.length>80000){this.page.createDiv({cls:'ts-reading-empty',text:'当前展示前 80,000 字符，完整内容请打开原文。'});text=text.slice(0,80000);}
 await MarkdownRenderer.render(this.app,text,content,source,scope);if(!this.alive||generation!==this.generation){scope.unload();return;}this.headings=Array.from(content.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));this.renderCompanion();content.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(c=>c.disabled=true);content.addEventListener('click',e=>{const link=(e.target as Element).closest<HTMLElement>('a.internal-link');if(link){e.preventDefault();e.stopPropagation();const target=link.dataset.href||link.getAttribute('href');if(target)this.run(()=>this.app.workspace.openLinkText(target,source,'tab'));}});
 }

 ready=true;
 }finally{if(!ready&&generation===this.generation)this.pageKey='';}
 }
 private syncPageControls(n:Card){
  this.commandBar.hidden=false;this.pageNav.hidden=false;
  const open=this.reader.querySelector<HTMLButtonElement>('[data-reading-open]');if(open)open.hidden=!(n.file&&this.app.vault.getAbstractFileByPath(n.file) instanceof TFile);
  const status=this.reader.querySelector<HTMLSelectElement>('[data-reading-review]');if(status){status.disabled=!!n.locked;status.value=n.review||'later';}
  const finish=this.reader.querySelector<HTMLButtonElement>('[data-reading-finish]');if(finish)finish.disabled=!!n.locked;
  const items=this.items(),index=items.findIndex(item=>item.id===n.id);
  const previous=this.reader.querySelector<HTMLButtonElement>('[data-reading-previous]'),next=this.reader.querySelector<HTMLButtonElement>('[data-reading-next]'),position=this.reader.querySelector<HTMLElement>('[data-reading-position]');
  if(previous)previous.disabled=index<1;if(next)next.disabled=index<0||index>=items.length-1;if(position)position.setText(`${index<0?0:index+1} / ${items.length}`);
 }

 private step(delta:number){const items=this.items(),index=items.findIndex(n=>n.id===this.activeId),next=items[index+delta];if(next){this.activeId=next.id;this.renderList();}}
 private renderCompanion(){
  const queue=this.asideTab==='queue';this.list.hidden=!queue;this.counter.hidden=!queue;this.companion.hidden=queue;
  this.asideTabs.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.readingTab===this.asideTab)));
  this.companion.empty();if(queue)return;
  if(this.asideTab==='outline'){
   if(!this.headings.length)this.companion.createDiv({cls:'ts-reading-empty',text:'当前内容暂无标题目录。'});
   for(const heading of this.headings.slice(0,300)){const button=this.button(this.companion,heading.textContent||'未命名标题','',()=>{heading.scrollIntoView({block:'start',behavior:'instant'});heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});});button.addClass('ts-reading-heading-link');button.style.setProperty('--heading-level',String(Number(heading.tagName.slice(1))-1));}
   return;
  }
  const relations=readingRelations(this.host.board(),this.activeId||'');
  this.companion.createDiv({cls:'ts-reading-context-hint',text:relations.length?`${relations.length} 条白板连线 · 点击关联项会切换为整张白板阅读`:'当前内容尚未与其他笔记、文本或图片连线。'});
  for(const relation of relations.slice(0,100)){
   const button=this.button(this.companion,readingTitle(relation.node),'arrow-up-right',()=>{
    this.options={query:'',status:'all',sort:this.options.sort,onlySelected:false,kind:'all',connection:'all'};
    const search=this.modalEl.querySelector<HTMLInputElement>('[aria-label="搜索阅读内容"]');if(search)search.value='';
    for(const label of ['阅读状态筛选','阅读范围','阅读内容类型','阅读关联筛选']){const select=this.modalEl.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`);if(select)select.value='all';}
    this.activeId=relation.node.id;this.renderList();this.page.focus({preventScroll:true});
   });button.addClass('ts-reading-relation');button.createEl('small',{text:`${relation.direction} · ${relation.label}`});
  }
  if(relations.length>100)this.companion.createDiv({cls:'ts-reading-context-hint',text:'仅显示前 100 条关联，其余请在白板查看。'});
 }
 onClose(){this.alive=false;this.pageKey='';this.generation++;this.previewScope?.unload();this.lifecycle?.unload();this.contentEl.empty();}
}
