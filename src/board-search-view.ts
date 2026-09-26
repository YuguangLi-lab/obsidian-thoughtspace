import {App,Modal,Notice,TFile,getAllTags,setIcon} from 'obsidian';
import {Board,Card,colors,colorNames} from './model';
import {BoardSearchEntry,boardSearchIndex,searchBoard,searchKinds,searchExcerpt,searchDirectory} from './board-search';
import {themeSurface} from './ui-tokens';
export interface BoardSearchHost{title:string;board:()=>Board;locate:(id:string)=>Promise<void>;open:(id:string)=>Promise<void>;link:(id:string)=>string;}
export class BoardSearchModal extends Modal{
 private entries:BoardSearchEntry[]=[];private results:BoardSearchEntry[]=[];
 private input!:HTMLInputElement;private kind!:HTMLSelectElement;private group!:HTMLSelectElement;private color!:HTMLSelectElement;private list!:HTMLElement;private status!:HTMLElement;private indexStatus!:HTMLElement;private clearButton!:HTMLButtonElement;private copyButton!:HTMLButtonElement;
 private rows:{row:HTMLElement;pick:HTMLButtonElement;controls:HTMLButtonElement[]}[]=[];private excerptCache=new Map<BoardSearchEntry,string>();private excerptQuery='';private bodies=new Map<string,string>();private generation=0;private closed=false;private active=0;private limit=40;private timer?:number;private full=false;private busy=false;
 // Refreshes invalidate immediately, but their file reads share one serial queue.
 private indexTask:Promise<void>=Promise.resolve();private pointer?:{x:number;y:number};
 constructor(app:App,private host:BoardSearchHost){super(app);}
 private run(action:()=>unknown){try{Promise.resolve(action()).catch(e=>{if(!this.closed)new Notice(String(e));});}catch(e){if(!this.closed)new Notice(String(e));}}
 private button(el:HTMLElement,label:string,icon:string,run:()=>unknown){const b=el.createEl('button',{attr:{'aria-label':label,title:label}});setIcon(b,icon);b.onclick=()=>this.run(run);return b;}
 onOpen(){this.closed=false;themeSurface(this.modalEl);this.modalEl.addClass('ts-board-search');this.titleEl.setText('搜索白板');this.titleEl.createEl('small',{cls:'ts-board-search-scope',text:this.host.title,attr:{title:this.host.title}});
  const bar=this.contentEl.createDiv({cls:'ts-board-search-bar',attr:{role:'search','aria-label':'搜索当前白板'}});setIcon(bar.createSpan({attr:{'aria-hidden':'true'}}),'search');this.input=bar.createEl('input',{type:'search',attr:{placeholder:'标题、文本、#标签、分组或文件路径…','aria-label':'搜索白板内容'}});
  this.input.oninput=()=>{this.cancelQuery();this.clearButton.disabled=!(this.input.value||this.kind.value||this.group.value||this.color.value);this.timer=this.contentEl.win.setTimeout(()=>{this.timer=undefined;this.reset();},90);};this.input.onkeydown=e=>this.keydown(e);
  this.clearButton=this.button(bar,'清除关键词与筛选','x',()=>this.clearFilters());this.clearButton.addClass('ts-board-search-clear','ts-board-search-filter-reset');
  this.button(bar,'刷新搜索索引','refresh-cw',()=>this.refresh());
  const workbench=this.contentEl.createDiv('ts-board-search-workbench'),refine=workbench.createDiv({cls:'ts-board-search-refine',attr:{role:'group','aria-label':'搜索筛选'}});refine.createEl('h3',{text:'筛选范围'});
  const filters=refine.createDiv('ts-board-search-filters');const select=(label:string,options:Record<string,string>)=>{const field=filters.createEl('label',{cls:'ts-board-search-filter'});field.createSpan({text:label});const s=field.createEl('select',{attr:{'aria-label':label}});for(const [value,text]of Object.entries(options))s.createEl('option',{value,text});s.onchange=()=>this.reset();return s;};
  this.kind=select('对象类型',{'':'全部类型',...searchKinds});this.group=select('所属分组',{'':'全部分组',':none':'未分组'});this.color=select('对象颜色',{'':'全部颜色',...Object.fromEntries(colors.map(c=>[c,colorNames[c]]))});
  const label=refine.createEl('label',{cls:'ts-board-search-fulltext'}),full=label.createEl('input',{type:'checkbox'});label.createSpan({text:'包含笔记正文'});full.checked=this.full;full.onchange=()=>{this.full=full.checked;this.run(()=>this.refresh());};
  this.indexStatus=refine.createDiv({cls:'ts-board-search-index-status',attr:{role:'status'}});
  const matches=workbench.createDiv('ts-board-search-matches'),options=matches.createDiv('ts-board-search-options');options.createEl('h3',{text:'搜索结果'});this.status=options.createSpan({attr:{role:'status','aria-live':'polite','aria-atomic':'true'}});
  this.list=matches.createDiv({cls:'ts-board-search-results',attr:{role:'region','aria-label':'白板搜索结果'}});
  const footer=this.contentEl.createDiv('ts-board-search-footer'),shortcuts=footer.createDiv('ts-board-search-shortcuts');
  for(const [keys,description] of [['↑ ↓','选择'],['Enter','定位'],['Cmd/Ctrl+Enter','右侧打开笔记'],['Esc','返回']]){const hint=shortcuts.createSpan();hint.createEl('kbd',{text:keys});hint.createSpan({text:description});}
  this.copyButton=this.button(footer,'复制搜索结果为定位目录','list-tree',()=>{this.flushQuery();if(!this.results.length||this.closed)return;const entries=this.results.slice();return navigator.clipboard.writeText(searchDirectory(entries,id=>this.host.link(id))).then(()=>new Notice(`已复制 ${entries.length} 项定位目录`));});this.copyButton.addClass('ts-board-search-copy');this.copyButton.appendText(' 复制结果');
  this.run(()=>this.refresh());this.input.focus();
 }
 private cancelQuery(){this.contentEl.win.clearTimeout(this.timer);this.timer=undefined;}
 private flushQuery(){if(this.timer!==undefined){this.cancelQuery();this.reset();}}
 private clearFilters(){this.input.value='';this.kind.value='';this.group.value='';this.color.value='';this.reset();this.input.focus();}
 private keydown(e:KeyboardEvent,fromRow=false,rowIndex=this.active){
  if(this.closed)return;
  if(e.isComposing||e.keyCode===229||e.altKey||e.shiftKey){if(fromRow&&e.key==='Enter')e.preventDefault();return;}
  if(e.key==='Enter'){
   if(e.ctrlKey&&e.metaKey){if(fromRow)e.preventDefault();return;}if(fromRow&&this.timer===undefined)this.setActive(rowIndex,false,false);this.flushQuery();const entry=this.results[this.active],side=e.ctrlKey||e.metaKey;
   if(!entry)return;if(side&&entry.kind!=='card'){if(fromRow)e.preventDefault();return;}e.preventDefault();this.run(()=>this.activate(entry,side));return;
  }
  if(e.ctrlKey||e.metaKey)return;
  if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;
  if(fromRow&&this.timer===undefined)this.setActive(rowIndex,false,false);this.flushQuery();if(!this.results.length)return;e.preventDefault();
  const next=this.active+(e.key==='ArrowDown'?1:-1);this.setActive(next,fromRow);
 }
 private setActive(index:number,focus=false,scroll=true){
  if(this.closed||!this.results.length)return;const next=Math.max(0,Math.min(this.results.length-1,index)),previous=this.active;this.active=next;
  if(next>=this.rows.length){this.limit=Math.ceil((next+1)/40)*40;this.render(false);}
  else if(next!==previous){this.markCurrent(previous,false);this.markCurrent(next,true);}
  const current=this.rows[next];if(focus)current?.pick.focus();if(scroll)current?.row.scrollIntoView({block:'nearest'});
 }
 private markCurrent(index:number,current:boolean){const row=this.rows[index];if(!row)return;row.row.toggleClass('is-active',current);if(current)row.pick.setAttribute('aria-current','true');else row.pick.removeAttribute('aria-current');}
 private metadata(n:Card){const f=n.file?this.app.vault.getAbstractFileByPath(n.file):null;if(!(f instanceof TFile))return{};const cache=this.app.metadataCache.getFileCache(f);return {title:f.basename,tags:getAllTags(cache||{})||[],headings:cache?.headings?.map(h=>h.heading),body:this.bodies.get(f.path)};}
 private rebuild(){const metadata=new Map<string,ReturnType<BoardSearchModal['metadata']>>();this.entries=boardSearchIndex(this.host.board(),n=>{if(!n.file)return{};let cached=metadata.get(n.file);if(!cached){cached=this.metadata(n);metadata.set(n.file,cached);}return cached;});}
 private refresh(){
  if(this.closed)return Promise.resolve();const generation=++this.generation;this.bodies.clear();this.rebuild();const previous=this.group.value;this.group.empty();this.group.createEl('option',{value:'',text:'全部分组'});this.group.createEl('option',{value:':none',text:'未分组'});for(const e of this.entries.filter(e=>e.kind==='section'))this.group.createEl('option',{value:e.id,text:e.title});this.group.value=Array.from(this.group.options).some(o=>o.value===previous)?previous:'';this.reset(true);
  this.indexStatus.setText(this.full?'正在索引笔记正文…':'搜索标题、文本、标签与笔记标题层级；勾选后读取正文。');if(!this.full)return Promise.resolve();
  const task=this.indexTask.then(()=>this.indexBodies(generation));this.indexTask=task.catch(()=>{});return task;
 }
 private async indexBodies(generation:number){
  const stale=()=>this.closed||!this.full||generation!==this.generation;if(stale())return;
  const paths=[...new Set(this.entries.filter(e=>e.kind==='card').map(e=>e.path).filter(Boolean))];let used=0,skipped=0,read=0;
  for(let i=0;i<paths.length;i++){
   if(stale())return;const path=paths[i],file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile)||file.extension!=='md'||file.stat.size>2000000||used+file.stat.size>20000000){skipped++;continue;}
   used+=file.stat.size;try{const raw=await this.app.vault.cachedRead(file);if(stale())return;if(file.path!==path||raw.length>2000000){skipped++;continue;}this.bodies.set(path,raw);read++;}catch{skipped++;}
   if(stale())return;if(i%20===0){this.indexStatus.setText(`正在索引正文 · ${i+1} / ${paths.length}`);await new Promise(resolve=>this.contentEl.win.setTimeout(resolve,0));}
  }
  if(stale())return;this.rebuild();this.reset(true);this.indexStatus.setText(`已索引 ${read} 篇正文${skipped?` · ${skipped} 篇未读取（失效或超限）`:''} · 单篇 2 MB / 总计 20 MB 上限；修改原文后可刷新`);
 }
 private reset(preserve=false){
  if(this.closed)return;this.cancelQuery();this.excerptCache.clear();const current=preserve?this.results[this.active]?.id:undefined;
  this.results=searchBoard(this.entries,{query:this.input.value,kind:this.kind.value,group:this.group.value,color:this.color.value});this.active=current?Math.max(0,this.results.findIndex(e=>e.id===current)):0;this.limit=Math.max(40,Math.ceil((this.active+1)/40)*40);this.status.setText(`${this.results.length} / ${this.entries.length} 项`);this.render();
 }
 private async activate(entry:BoardSearchEntry,side=false){
  if(this.closed||this.busy||(side&&entry.kind!=='card'))return;this.busy=true;this.updateBusy();
  try{if(side)await this.host.open(entry.id);else await this.host.locate(entry.id);if(!this.closed)this.close();}finally{this.busy=false;if(!this.closed)this.updateBusy();}
 }
 private updateBusy(){this.list.setAttribute('aria-busy',String(this.busy));for(const button of Array.from(this.list.querySelectorAll('button')))button.disabled=this.busy;this.copyButton.disabled=this.busy||!this.results.length;}
 private render(restoreFocus=true){if(this.closed)return;
  const focused=restoreFocus?this.rows.find(({controls})=>controls.includes(this.contentEl.ownerDocument.activeElement as HTMLButtonElement)):undefined,focusedId=focused?.row.getAttribute('data-search-node'),focusedControl=focused?.controls.indexOf(this.contentEl.ownerDocument.activeElement as HTMLButtonElement)??0,entries=this.results;
  // Cache only the short displayed snippets, not another copy of every note body.
  // Pagination keeps the query/index; filtering and refresh invalidate the cache.
  if(this.excerptQuery!==this.input.value){this.excerptQuery=this.input.value;this.excerptCache.clear();}
  this.clearButton.disabled=!(this.input.value||this.kind.value||this.group.value||this.color.value);this.copyButton.disabled=this.busy||!entries.length;this.list.empty();this.rows=[];
  if(!entries.length){const empty=this.list.createDiv('ts-board-search-empty');setIcon(empty.createSpan({cls:'ts-board-search-empty-icon',attr:{'aria-hidden':'true'}}),'search');empty.createEl('strong',{text:'没有匹配的内容'});empty.createSpan({text:'试试更短的关键词，或清除类型、分组与颜色筛选。'});const actions=empty.createDiv('ts-board-search-empty-actions'),clear=this.button(actions,'清除关键词与筛选','filter-x',()=>this.clearFilters());clear.addClass('ts-board-search-empty-clear','ts-board-search-filter-reset');clear.appendText(' 清除筛选');this.updateBusy();if(focusedId)this.input.focus();return;}
  for(const [i,e]of entries.slice(0,this.limit).entries()){
   const row=this.list.createDiv({cls:'ts-board-search-row',attr:{'data-search-node':e.id,role:'group','aria-label':`${searchKinds[e.kind]} · ${e.title}`}});const pick=row.createEl('button',{cls:'ts-board-search-pick',attr:{'aria-label':`定位 ${e.title}`}});const controls=[pick];this.rows.push({row,pick,controls});this.markCurrent(i,i===this.active);
   // Scrolling and row replacement can fire pointerenter under an unmoving mouse.
   row.onpointermove=event=>{if(this.pointer?.x===event.clientX&&this.pointer.y===event.clientY)return;this.pointer={x:event.clientX,y:event.clientY};this.setActive(i,false,false);};pick.onfocus=()=>this.setActive(i,false,false);pick.onkeydown=event=>this.keydown(event,true,i);pick.onclick=()=>this.run(()=>{this.setActive(i,false,false);return this.activate(e);});
   const head=pick.createDiv('ts-board-search-heading');setIcon(head.createSpan({attr:{'aria-hidden':'true'}}),{card:'file-text',text:'type',image:'image',pdf:'file-text',section:'group',board:'panels-top-left'}[e.kind]);head.createEl('strong',{text:e.title,attr:{title:e.title}});head.createEl('small',{text:searchKinds[e.kind]});
   let excerpt=this.excerptCache.get(e);if(excerpt===undefined){excerpt=searchExcerpt(e,this.input.value);this.excerptCache.set(e,excerpt);}if(excerpt)pick.createDiv({cls:'ts-board-search-excerpt',text:excerpt});
   const meta=pick.createDiv('ts-board-search-meta'),location=meta.createDiv({cls:'ts-board-search-location',text:e.groups.map(g=>g.title).join(' / ')||'未分组'});if(e.hidden)location.appendText(' · 折叠分支内');if(e.path)meta.createDiv({cls:'ts-board-search-path',text:e.path,attr:{title:e.path}});const actions=row.createDiv('ts-board-search-row-actions');const link=this.button(actions,'复制内容定位链接','link',()=>navigator.clipboard.writeText(this.host.link(e.id)).then(()=>new Notice('已复制定位链接')));controls.push(link);link.onfocus=()=>this.setActive(i,false,false);
   if(e.kind==='card'){const open=this.button(actions,'在右侧打开原笔记','panel-right',()=>this.activate(e,true));open.createSpan({cls:'ts-board-search-action-label',text:'打开'});controls.push(open);open.onfocus=()=>this.setActive(i,false,false);}
  }
  if(entries.length>this.limit){const more=this.button(this.list,'显示更多结果','chevron-down',()=>{const next=this.limit;this.limit+=40;this.render();this.setActive(next,true);});more.addClass('ts-board-search-more');more.appendText(` 再显示 40 项 · 剩余 ${entries.length-this.limit}`);}
  this.updateBusy();if(focusedId){const previous=this.rows.find(({row})=>row.getAttribute('data-search-node')===focusedId);if(previous)(previous.controls[focusedControl]||previous.pick).focus();else this.input.focus();}
 }
 onClose(){this.closed=true;this.pointer=undefined;this.generation++;this.cancelQuery();this.entries=[];this.results=[];this.rows=[];this.excerptCache.clear();this.bodies.clear();this.contentEl.empty();}
}
