import {App, Component, Modal, Notice, TFile, getAllTags, setIcon} from 'obsidian';
import {Board} from './model';
import {themeSurface} from './ui-tokens';
import {isWorkspaceFile} from './workspace';
import {HubPreferences, HubFilter, HubIndex, HubBoard, HubNote, HubScope, cleanHubFilter, defaultHubFilter, hubIndex, hubResults, summarizeBoard, saveHubFilter} from './space-hub';

interface HubHost {
  preferences:()=>HubPreferences;save:(prefs:HubPreferences)=>Promise<void>;favorites:()=>string[];
  journalFolder:string;readBoard:(file:TFile)=>Promise<Board>;
  openBoard:(file:TFile)=>Promise<void>;openNote:(file:TFile)=>unknown;favorite:(file:TFile)=>Promise<void>;
  capture:()=>void;createBoard:()=>void;calendar:()=>unknown;
  target?:{title:string;add:(paths:string[])=>Promise<number>};
}
const scopes:{id:HubScope;label:string;icon:string}[]=[{id:'boards',label:'全部白板',icon:'panels-top-left'},{id:'favorites',label:'收藏白板',icon:'star'},{id:'recent',label:'最近打开',icon:'history'},{id:'notes',label:'全部笔记',icon:'files'},{id:'inbox',label:'笔记收件箱',icon:'inbox'},{id:'shared',label:'跨白板笔记',icon:'network'}];
const palette={sand:'#d9c68c',blue:'#9dc8df',green:'#a8cdbb',rose:'#dfb3c1',purple:'#b9a9d4',orange:'#dcad79',red:'#d68e89',teal:'#83bdb0',cyan:'#91c7d0',lime:'#b9c98b',slate:'#a9b5c4',brown:'#b69c87'};
/** Indexes geometry and metadata only. Full Markdown bodies are not retained. */
export class SpaceHubModal extends Modal {
  private life=new Component();private generation=0;private active=false;private changes=0;private busy=false;
  private index:HubIndex=hubIndex([],[]);private filter:HubFilter={...defaultHubFilter};private page=0;
  private selected=new Set<string>();private focused?:string;private results:(HubBoard|HubNote)[]=[];
  private nav!:HTMLElement;private main!:HTMLElement;private detail!:HTMLElement;private footer!:HTMLElement;private state!:HTMLElement;private metrics!:HTMLElement;
  private search!:HTMLInputElement;private tag!:HTMLSelectElement;private sort!:HTMLSelectElement;private journals!:HTMLInputElement;
  private refreshButton!:HTMLButtonElement;private loaded=false;
  private scopeTitle!:HTMLElement;private scopeCount!:HTMLElement;private viewButtons=new Map<string,HTMLButtonElement>();private detailReturnFocus?:HTMLElement;
  constructor(app:App,private host:HubHost){super(app);}
  private action(parent:HTMLElement,label:string,icon:string,fn:()=>unknown,cls=''){
    const b=parent.createEl('button',{cls:`ts-hub-button ${cls}`,attr:{'aria-label':label,title:label}});if(icon)setIcon(b.createSpan(),icon);b.createSpan({text:label});b.onclick=()=>{try{Promise.resolve(fn()).catch(e=>this.error(e));}catch(e){this.error(e);}};return b;
  }
  private error(e:unknown){if(this.active)this.state.setText(e instanceof Error?e.message:String(e));new Notice(String(e));}
  private file(path:string){const f=this.app.vault.getAbstractFileByPath(path);if(!(f instanceof TFile)||!isWorkspaceFile(f))throw Error('文件已移动或删除，请刷新总览');return f;}
  onOpen(){
    this.active=true;this.life.load();this.modalEl.addClass('ts-space-hub');themeSurface(this.modalEl);this.titleEl.setText('空间总览');
    const body=this.contentEl.createDiv('ts-hub-body');this.nav=body.createEl('nav',{cls:'ts-hub-nav',attr:{'aria-label':'空间总览导航'}});
    const workspace=body.createDiv('ts-hub-workspace');
    const heading=workspace.createDiv('ts-hub-heading'),headingCopy=heading.createDiv('ts-hub-heading-copy');
    this.scopeTitle=headingCopy.createEl('h3',{text:'全部白板'});this.scopeCount=headingCopy.createSpan('ts-hub-scope-count');
    const actions=heading.createDiv('ts-hub-quick');this.action(actions,'收集笔记','plus',()=>{this.close();this.host.capture();},'is-primary');this.action(actions,'新建白板','panels-top-left',()=>{this.close();this.host.createBoard();});
    const tools=workspace.createDiv('ts-hub-tools'),searchField=tools.createDiv('ts-hub-search-field');setIcon(searchField.createSpan(),'search');
    this.search=searchField.createEl('input',{type:'search',attr:{placeholder:'搜索标题、路径、#标签…','aria-label':'搜索空间总览',maxlength:'200'}});this.search.oninput=()=>{this.filter.query=this.search.value;this.page=0;this.renderResults();};
    const filterDisclosure=tools.createEl('details',{cls:'ts-hub-filter-disclosure'});filterDisclosure.createEl('summary',{text:'筛选与排序'});const filters=filterDisclosure.createDiv('ts-hub-filters');
    const tagLabel=filters.createEl('label',{text:'标签'});this.tag=tagLabel.createEl('select',{attr:{'aria-label':'按标签筛选'}});this.tag.onchange=()=>{this.filter.tag=this.tag.value;this.page=0;this.renderResults();};
    const sortLabel=filters.createEl('label',{text:'排序'});this.sort=sortLabel.createEl('select',{attr:{'aria-label':'总览排序'}});for(const[v,t]of [['updated','最近修改'],['title','名称排序'],['size','内容 / 使用次数']])this.sort.createEl('option',{value:v,text:t});this.sort.onchange=()=>{this.filter.sort=this.sort.value as HubFilter['sort'];this.page=0;this.renderResults();};
    const label=filters.createEl('label',{cls:'ts-hub-journal-toggle'});this.journals=label.createEl('input',{type:'checkbox'});label.createSpan({text:'包含日记'});this.journals.onchange=()=>{this.filter.includeJournals=this.journals.checked;this.page=0;this.renderResults();};
    const views=tools.createDiv({cls:'ts-hub-view-switch',attr:{role:'group','aria-label':'内容展示方式'}});
    for(const [view,label,icon]of [['gallery','画廊视图','layout-grid'],['list','列表视图','list']] as const)this.viewButtons.set(view,this.action(views,label,icon,async()=>{if(this.busy)return;await this.host.save({...this.host.preferences(),view});if(this.active)this.renderResults();},'ts-hub-icon'));
    this.refreshButton=this.action(views,'刷新索引','refresh-cw',()=>this.load(),'ts-hub-icon');
    this.state=workspace.createDiv({cls:'ts-hub-state',attr:{role:'status','aria-live':'polite'}});
    this.main=workspace.createDiv('ts-hub-results');this.detail=body.createEl('aside',{cls:'ts-hub-detail',attr:{'aria-label':'内容详情'}});this.detail.hidden=true;
    this.footer=this.contentEl.createDiv('ts-hub-footer');
    const dirty=()=>{if(!this.active)return;this.changes++;if(this.loaded&&!this.busy)this.state.setText('资料已变化，点击刷新索引获取最新内容。');};this.life.registerEvent(this.app.vault.on('create',dirty));this.life.registerEvent(this.app.vault.on('modify',dirty));this.life.registerEvent(this.app.vault.on('delete',dirty));this.life.registerEvent(this.app.vault.on('rename',dirty));
    this.life.registerEvent(this.app.metadataCache.on('changed',dirty));this.renderNav();this.renderDetail();void this.load();this.search.focus();
  }
  onClose(){this.active=false;this.generation++;this.life.unload();this.contentEl.empty();}
  async load(){
    const run=++this.generation,changes=this.changes;this.busy=true;this.refreshButton.disabled=true;this.state.setText('正在整理白板与笔记索引…');
    try{
      const all=this.app.vault.getFiles().filter(isWorkspaceFile),paths=new Set(all.map(f=>f.path));
      const notes:HubNote[]=all.filter(f=>f.extension==='md').map(f=>({path:f.path,title:f.basename,mtime:f.stat.mtime,tags:[...new Set(getAllTags(this.app.metadataCache.getFileCache(f)||{})||[])],journal:f.path.startsWith(this.host.journalFolder+'/')}));
      const byPath=new Map(notes.map(n=>[n.path,n])),files=all.filter(f=>f.extension==='thoughtspace'),boards:HubBoard[]=[],errors:HubIndex['errors']=[];let cursor=0;
      await Promise.all(Array.from({length:Math.min(4,files.length)},async()=>{while(cursor<files.length&&this.active&&run===this.generation){const f=files[cursor++];try{if(f.stat.size>8*1024*1024)throw Error('超过 8 MB，未加入总览索引');const board=await this.host.readBoard(f);if(!this.active||run!==this.generation)return;boards.push(summarizeBoard(f.path,f.basename,f.stat.mtime,board,byPath,p=>paths.has(p)));}catch(e){errors.push({path:f.path,message:e instanceof Error?e.message:String(e)});}}}));
      if(!this.active||run!==this.generation)return;this.index=hubIndex(boards,notes,errors);this.loaded=true;this.selected=new Set([...this.selected].filter(p=>byPath.has(p)));
      this.tag.empty();this.tag.createEl('option',{value:'',text:'全部标签'});for(const tag of [...new Set(notes.flatMap(n=>n.tags))].sort())this.tag.createEl('option',{value:tag,text:tag});if(this.filter.tag&&!this.tag.querySelector(`option[value="${CSS.escape(this.filter.tag)}"]`))this.tag.createEl('option',{value:this.filter.tag,text:this.filter.tag});this.tag.value=this.filter.tag;
      this.state.setText(errors.length?`${errors.length} 张白板无法索引；收件箱暂不判定未归属。`:this.changes!==changes?'资料在索引期间发生变化，请刷新后核对。':'搜索标题、路径和 #标签');if(errors.length)this.action(this.state,'查看索引问题','info',()=>{this.showDetail();this.renderDetail();const issues=this.detail.querySelector('details');if(issues)issues.open=true;this.detail.querySelector<HTMLElement>('summary')?.focus();},'ts-hub-state-action');this.renderMetrics();this.renderNav();this.renderResults();this.renderDetail();
    }catch(e){if(run===this.generation&&this.active)this.error(e);}finally{if(run===this.generation&&this.active){this.busy=false;this.refreshButton.disabled=false;this.renderFooter();}}
  }
  private renderMetrics(){if(!this.metrics)return;this.metrics.empty();for(const[number,label]of [[this.index.boards.length,'白板'],[this.index.notes.length,'笔记'],[this.index.errors.length?'—':this.index.notes.filter(n=>!n.journal&&!this.index.usage.has(n.path)).length,'待整理'],[this.index.notes.filter(n=>(this.index.usage.get(n.path)?.length||0)>1).length,'跨白板笔记']]){const cell=this.metrics.createDiv();cell.createEl('strong',{text:String(number)});cell.createSpan({text:String(label)});}}
  private renderNav(){this.nav.empty();this.nav.createDiv({cls:'ts-hub-nav-label',text:'知识空间'});for(const scope of scopes){const b=this.action(this.nav,scope.label,scope.icon,()=>{this.filter.scope=scope.id;this.page=0;this.focused=undefined;this.closeDetail(false);this.renderNav();this.renderResults();this.renderDetail();});b.toggleClass('is-active',this.filter.scope===scope.id);b.setAttribute('aria-pressed',String(this.filter.scope===scope.id));if(this.loaded)b.createSpan({cls:'ts-hub-nav-count',text:String(hubResults(this.index,{...defaultHubFilter,scope:scope.id},this.host.preferences(),new Set(this.host.favorites())).length)});}
    const saved=this.nav.createDiv('ts-hub-saved');saved.createEl('h3',{text:'常用筛选'});for(const s of this.host.preferences().saved){const row=saved.createDiv('ts-hub-saved-row');this.action(row,s.name,'bookmark',()=>{this.filter=cleanHubFilter(s.filter);this.page=0;this.search.value=this.filter.query;if(this.filter.tag&&!Array.from(this.tag.options).some(o=>o.value===this.filter.tag))this.tag.createEl('option',{value:this.filter.tag,text:this.filter.tag+'（暂无笔记）'});this.tag.value=this.filter.tag;this.sort.value=this.filter.sort;this.journals.checked=this.filter.includeJournals;this.closeDetail(false);this.renderNav();this.renderResults();});this.action(row,'管理 '+s.name,'ellipsis',()=>this.saveFilterPanel(s.id));}
    this.action(saved,'保存当前筛选','bookmark-plus',()=>this.saveFilterPanel());
    const tail=this.nav.createDiv('ts-hub-nav-tail');this.metrics=tail.createDiv('ts-hub-metrics');this.renderMetrics();this.action(tail,'日历与日记','calendar-days',()=>{this.close();return this.host.calendar();});
  }
  private saveFilterPanel(id?:string){this.showDetail();this.detail.empty();this.detailHeader('常用筛选');const old=this.host.preferences().saved.find(s=>s.id===id);this.detail.createEl('h3',{text:old?'管理筛选':'保存当前筛选'});const input=this.detail.createEl('input',{type:'text',value:old?.name||'',attr:{'aria-label':'筛选名称',placeholder:'例如：研究材料',maxlength:'50'}});this.detail.createEl('p',{text:old?'修改名称保留原筛选条件；删除不会改动笔记。':'保存当前分类、搜索、标签、排序和日记开关。'});this.action(this.detail,old?'保存名称':'保存筛选','check',async()=>{await this.host.save(saveHubFilter(this.host.preferences(),input.value,old?.filter||this.filter,old?.id||crypto.randomUUID()));if(this.active){this.renderNav();this.renderDetail();}},'is-primary');if(old)this.action(this.detail,'删除筛选','trash-2',async()=>{await this.host.save({...this.host.preferences(),saved:this.host.preferences().saved.filter(s=>s.id!==id)});if(this.active){this.renderNav();this.renderDetail();}});input.focus();}
  private renderResults(){
    this.results=hubResults(this.index,this.filter,this.host.preferences(),new Set(this.host.favorites()));this.page=Math.min(this.page,Math.max(0,Math.ceil(this.results.length/48)-1));this.main.empty();const noteMode=['notes','inbox','shared'].includes(this.filter.scope);this.main.dataset.view=noteMode?'list':this.host.preferences().view;this.scopeTitle.setText(scopes.find(s=>s.id===this.filter.scope)?.label||'知识空间');this.scopeCount.setText(`${this.results.length} 项`);for(const [view,b]of this.viewButtons){b.disabled=noteMode;b.setAttribute('aria-pressed',String(this.main.dataset.view===view));}this.modalEl.toggleClass('has-query',!!this.filter.query||!!this.filter.tag);
    if(!this.results.length){const empty=this.main.createDiv('ts-hub-empty');setIcon(empty.createDiv(),'search');empty.createEl('h3',{text:!this.loaded?'正在准备空间':this.filter.scope==='inbox'&&this.index.errors.length?'暂时无法判定收件箱':'这里还没有匹配内容'});empty.createEl('p',{text:this.filter.scope==='recent'?'从总览打开白板后，会出现在这里。':'可以调整搜索与标签，或收集一条新笔记。'});this.action(empty,'清除搜索条件','rotate-ccw',()=>{this.filter={...defaultHubFilter,scope:this.filter.scope};this.search.value='';this.tag.value='';this.sort.value='updated';this.journals.checked=false;this.renderResults();});}
    for(const item of this.results.slice(this.page*48,(this.page+1)*48)){
      const board='objects'in item,row=this.main.createDiv({cls:`ts-hub-result ${board?'is-board':'is-note'}`});row.dataset.path=item.path;row.toggleClass('is-focused',this.focused===item.path);
      if(board&&this.main.dataset.view==='gallery'){const visual=this.action(row,'查看 '+item.title,'',()=>this.focus(item.path),'ts-hub-thumbnail');visual.tabIndex=-1;const svg=visual.createSvg('svg',{attr:{viewBox:'0 0 300 140','aria-hidden':'true'}});for(const n of item.preview)svg.createSvg('rect',{attr:{x:String(n.x),y:String(n.y),width:String(n.width),height:String(n.height),rx:'3',fill:palette[n.color],opacity:'.82'}});if(!item.preview.length)visual.createSpan({text:'空白画布'});}
      const info=row.createDiv('ts-hub-result-info');if(!board){const select=info.createEl('input',{type:'checkbox',attr:{'aria-label':'选择 '+item.title}});select.checked=this.selected.has(item.path);select.onchange=()=>{if(select.checked&&this.selected.size>=100){select.checked=false;this.error('一次最多选择 100 篇笔记');return;}if(select.checked)this.selected.add(item.path);else this.selected.delete(item.path);this.renderFooter();};}
      const title=this.action(info,item.title,board?'panels-top-left':'file-text',()=>this.focus(item.path),'ts-hub-result-title');title.setAttribute('aria-pressed',String(this.focused===item.path));info.createDiv({cls:'ts-hub-result-meta',text:board?`${item.objects} 个对象 · ${item.notes.length} 篇笔记 · ${item.edges} 条连线`:`${this.index.usage.get(item.path)?.length||0} 张已索引白板 · ${new Date(item.mtime).toLocaleDateString('zh-CN')}`});info.createDiv({cls:'ts-hub-result-path',text:item.path});
      this.action(row,board?'打开白板':'右侧打开笔记','arrow-up-right',()=>this.openItem(item.path,board),'ts-hub-open-direct ts-hub-icon');
      if(item.tags.length){const tags=info.createDiv('ts-hub-tags');for(const tag of item.tags.slice(0,3))this.action(tags,tag,'',()=>{this.filter.tag=tag;this.tag.value=tag;this.page=0;this.renderResults();});}
    }
    this.renderFooter();
  }
  private async openItem(path:string,board:boolean){const f=this.file(path);this.close();if(board)await this.host.openBoard(f);else await this.host.openNote(f);}
  private showDetail(){
    const active=this.modalEl.ownerDocument.activeElement;if(active instanceof HTMLElement&&!this.detail.contains(active))this.detailReturnFocus=active;
    this.detail.hidden=false;this.modalEl.addClass('has-detail');
  }
  private closeDetail(restoreFocus=true){
    this.detail.hidden=true;this.modalEl.removeClass('has-detail');
    if(restoreFocus){const target=this.detailReturnFocus?.isConnected?this.detailReturnFocus:this.search;target.focus({preventScroll:true});}
    this.detailReturnFocus=undefined;
  }
  private detailHeader(label:string){const head=this.detail.createDiv('ts-hub-detail-heading');head.createSpan({text:label});this.action(head,'返回结果','x',()=>this.closeDetail(),'ts-hub-icon');}
  private focus(path:string){
    this.focused=path;this.showDetail();
    for(const row of Array.from(this.main.querySelectorAll<HTMLElement>('.ts-hub-result'))){const selected=row.dataset.path===path;row.toggleClass('is-focused',selected);row.querySelector('.ts-hub-result-title')?.setAttribute('aria-pressed',String(selected));}
    this.renderDetail();const heading=this.detail.querySelector<HTMLElement>('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  private renderDetail(){
    this.detail.empty();this.detailHeader('内容详情');const item=this.index.boards.find(b=>b.path===this.focused)||this.index.notes.find(n=>n.path===this.focused);
    if(!item){this.detail.createEl('h3',{text:'给材料找到位置'});this.detail.createEl('p',{text:'选择一张白板查看内容概况，或选择笔记查看它在哪些白板中使用。'});if(this.host.target)this.detail.createDiv({cls:'ts-hub-target',text:'当前白板\n'+this.host.target.title});}
    else{const board='objects'in item;this.detail.createEl('h3',{text:item.title});this.detail.createDiv({cls:'ts-hub-detail-path',text:item.path});this.action(this.detail,board?'打开白板':'右侧打开笔记',board?'arrow-up-right':'panel-right',()=>this.openItem(item.path,board),'is-primary');
      if(board){this.action(this.detail,this.host.favorites().includes(item.path)?'取消收藏':'收藏白板','star',async()=>{await this.host.favorite(this.file(item.path));if(this.active){this.renderResults();this.renderDetail();}});this.detail.createEl('p',{text:`${item.objects} 个内容对象，${item.edges} 条连接；缩略图显示前 80 个对象。`});this.references('上级白板',this.index.boards.filter(b=>b.children.includes(item.path)));this.references('子白板',this.index.boards.filter(b=>item.children.includes(b.path)));if(item.missing.length){this.detail.createEl('h4',{text:'缺失引用'});for(const path of item.missing.slice(0,30))this.detail.createDiv({cls:'ts-hub-warning',text:path});}}
      else{this.detail.createEl('p',{text:'只统计白板的直接笔记引用；原生笔记反向链接可在 Obsidian 中查看。'});this.references('使用这篇笔记的白板',this.index.usage.get(item.path)||[]);if(this.host.target)this.action(this.detail,'放入当前白板','file-plus-2',()=>this.add([item.path]));}
    }
    if(this.index.errors.length){const issues=this.detail.createEl('details',{cls:'ts-hub-issues'});issues.createEl('summary',{text:`索引问题 · ${this.index.errors.length}`});for(const e of this.index.errors.slice(0,50)){issues.createDiv({text:e.path,cls:'ts-hub-detail-path'});issues.createEl('p',{text:e.message});}}
  }
  private references(label:string,boards:HubBoard[]){this.detail.createEl('h4',{text:label});if(!boards.length)this.detail.createEl('p',{text:'没有已索引的直接引用'});for(const board of boards.slice(0,50))this.action(this.detail,board.title,'panels-top-left',()=>this.focus(board.path),'ts-hub-reference');if(boards.length>50)this.detail.createEl('p',{text:'显示前 50 张；可在全部白板中搜索更多。'});}
  private async add(paths:string[]){if(!this.host.target)throw Error('请先打开目标白板');if(this.busy)return;this.busy=true;this.renderFooter();try{for(const path of paths)this.file(path);const added=await this.host.target.add(paths);if(!this.active)return;this.selected.clear();this.state.setText(`已放入 ${added} 篇笔记；跳过 ${paths.length-added} 个已有引用。可在白板撤销。`);await this.load();this.state.setText(`已放入 ${added} 篇笔记；跳过 ${paths.length-added} 个已有引用。可在白板撤销。`);}finally{this.busy=false;if(this.active)this.renderFooter();}}
  private renderFooter(){this.footer.empty();this.footer.createSpan({text:`${this.results.length} 项结果 · 第 ${this.page+1} / ${Math.max(1,Math.ceil(this.results.length/48))} 页`});this.action(this.footer,'上一页','chevron-left',()=>{this.page--;this.renderResults();},'ts-hub-icon').disabled=this.page===0;this.action(this.footer,'下一页','chevron-right',()=>{this.page++;this.renderResults();},'ts-hub-icon').disabled=(this.page+1)*48>=this.results.length;
    if(['notes','inbox','shared'].includes(this.filter.scope)){this.action(this.footer,'选择本页','check-check',()=>{const next=new Set([...this.selected,...this.results.slice(this.page*48,(this.page+1)*48).map(n=>n.path)]);if(next.size>100)throw Error('跨页选择超过 100 篇，请先清空选择');this.selected=next;this.renderResults();});}
    if(this.selected.size){this.action(this.footer,'清空选择','x',()=>{this.selected.clear();this.renderResults();});const b=this.action(this.footer,`放入 ${this.selected.size} 篇笔记`,'file-plus-2',()=>this.add([...this.selected]),'is-primary');b.disabled=this.busy||!this.host.target;this.footer.createSpan({cls:'ts-hub-batch-hint',text:this.host.target?`目标：${this.host.target.title} · 选择包含其他页`:'请先打开目标白板'});}
  }
}
