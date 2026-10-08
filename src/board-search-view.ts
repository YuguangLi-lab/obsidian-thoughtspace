import {App,Modal,Notice,TFile,getAllTags,setIcon} from 'obsidian';
import {Board,Card,colors,colorNames,uid} from './model';
import {BoardSearchEntry,boardSearchIndex,searchBoard,searchKinds,searchExcerpt,searchDirectory} from './board-search';
import {addSavedSearch,renameSavedSearch,removeSavedSearch,savedSearchQuery,savedSearchStamp,type SavedSearchQuery} from './saved-searches';
import {markReading,reviewLabels,type ReviewState} from './reading-desk';
import {themeSurface} from './ui-tokens';
export interface BoardSearchHost{title:string;context?:object;board:()=>Board;commit:(edit:(board:Board)=>void)=>void|Promise<void>;locate:(id:string)=>Promise<void>;open:(id:string)=>Promise<void>;link:(id:string)=>string;}
interface SearchContext{query:string;kind:string;group:string;color:string;review:string;full:boolean;saved?:string;active?:string;limit:number;scroll:number;}
// Session identity scopes transient search state across tabs and undo/redo, and
// releases it when that board session closes. Never cache note bodies here.
const searchContexts=new WeakMap<object,SearchContext>();
export class BoardSearchModal extends Modal{
 private entries:BoardSearchEntry[]=[];private results:BoardSearchEntry[]=[];
 private input!:HTMLInputElement;private kind!:HTMLSelectElement;private group!:HTMLSelectElement;private color!:HTMLSelectElement;private review!:HTMLSelectElement;private fullInput!:HTMLInputElement;private list!:HTMLElement;private status!:HTMLElement;private indexStatus!:HTMLElement;private clearButton!:HTMLButtonElement;private copyButton!:HTMLButtonElement;
 private savedSelect!:HTMLSelectElement;private savedName!:HTMLInputElement;private savedCaption!:HTMLElement;private savedStatus!:HTMLElement;private saveButton!:HTMLButtonElement;private renameButton!:HTMLButtonElement;private deleteButton!:HTMLButtonElement;private savedId?:string;private savedStamp?:string;private mutationBusy=false;
 private rows:{row:HTMLElement;pick:HTMLButtonElement;controls:(HTMLButtonElement|HTMLSelectElement)[]}[]=[];private excerptCache=new Map<BoardSearchEntry,string>();private excerptQuery='';private bodies=new Map<string,string>();private generation=0;private closed=false;private active=0;private limit=40;private timer?:number;private full=false;private busy=false;
 // Refreshes invalidate immediately, but their file reads share one serial queue.
 private indexTask:Promise<void>=Promise.resolve();private pointer?:{x:number;y:number};
 private restored?:SearchContext;private restoredActive?:string;
 constructor(app:App,private host:BoardSearchHost){super(app);this.restored=searchContexts.get(host.context||host);this.full=this.restored?.full||false;this.restoredActive=this.restored?.active;this.savedId=this.restored?.saved;}
 private run(action:()=>unknown){try{Promise.resolve(action()).catch(e=>{if(!this.closed)new Notice(String(e));});}catch(e){if(!this.closed)new Notice(String(e));}}
 private button(el:HTMLElement,label:string,icon:string,run:()=>unknown){const b=el.createEl('button',{attr:{'aria-label':label,title:label}});setIcon(b,icon);b.onclick=()=>this.run(run);return b;}
 onOpen(){this.closed=false;themeSurface(this.modalEl);this.modalEl.addClass('ts-board-search');this.titleEl.setText('搜索白板');this.titleEl.createEl('small',{cls:'ts-board-search-scope',text:this.host.title,attr:{title:this.host.title}});
  const bar=this.contentEl.createDiv({cls:'ts-board-search-bar',attr:{role:'search','aria-label':'搜索当前白板'}});setIcon(bar.createSpan({attr:{'aria-hidden':'true'}}),'search');this.input=bar.createEl('input',{type:'search',attr:{placeholder:'标题、文本、#标签、分组或文件路径…','aria-label':'搜索白板内容'}});
  this.input.oninput=()=>{this.cancelQuery();this.clearButton.disabled=!this.hasFilters();this.timer=this.contentEl.win.setTimeout(()=>{this.timer=undefined;this.reset();},90);};this.input.onkeydown=e=>this.keydown(e);
  this.clearButton=this.button(bar,'清除关键词与筛选','x',()=>this.clearFilters());this.clearButton.addClass('ts-board-search-clear','ts-board-search-filter-reset');
  this.button(bar,'刷新搜索索引','refresh-cw',()=>this.refresh());
  const workbench=this.contentEl.createDiv('ts-board-search-workbench'),refine=workbench.createDiv({cls:'ts-board-search-refine',attr:{role:'group','aria-label':'搜索筛选'}});refine.createEl('h3',{text:'筛选范围'});
  const filters=refine.createDiv('ts-board-search-filters');const select=(label:string,options:Record<string,string>)=>{const field=filters.createEl('label',{cls:'ts-board-search-filter'});field.createSpan({text:label});const s=field.createEl('select',{attr:{'aria-label':label}});for(const [value,text]of Object.entries(options))s.createEl('option',{value,text});s.onchange=()=>this.reset();return s;};
  this.kind=select('对象类型',{'':'全部类型',...searchKinds});this.group=select('所属分组',{'':'全部分组',':none':'未分组'});this.color=select('对象颜色',{'':'全部颜色',...Object.fromEntries(colors.map(c=>[c,colorNames[c]]))});this.review=select('阅读状态',{'':'全部状态',...reviewLabels});
  const label=refine.createEl('label',{cls:'ts-board-search-fulltext'}),full=label.createEl('input',{type:'checkbox'});this.fullInput=full;label.createSpan({text:'包含笔记正文'});full.checked=this.full;full.onchange=()=>{this.full=full.checked;this.run(()=>this.refresh());};
  this.indexStatus=refine.createDiv({cls:'ts-board-search-index-status',attr:{role:'status'}});
  this.buildSavedSearches(refine);
  const matches=workbench.createDiv('ts-board-search-matches'),options=matches.createDiv('ts-board-search-options');options.createEl('h3',{text:'搜索结果'});this.status=options.createSpan({attr:{role:'status','aria-live':'polite','aria-atomic':'true'}});
  this.list=matches.createDiv({cls:'ts-board-search-results',attr:{role:'region','aria-label':'白板搜索结果'}});
  const footer=this.contentEl.createDiv('ts-board-search-footer'),shortcuts=footer.createDiv('ts-board-search-shortcuts');
  for(const [keys,description] of [['↑ ↓','选择'],['Enter','定位'],['Cmd/Ctrl+Enter','右侧打开笔记'],['Esc','返回']]){const hint=shortcuts.createSpan();hint.createEl('kbd',{text:keys});hint.createSpan({text:description});}
  this.copyButton=this.button(footer,'复制搜索结果为定位目录','list-tree',()=>{this.flushQuery();if(!this.results.length||this.closed)return;const entries=this.results.slice();return navigator.clipboard.writeText(searchDirectory(entries,id=>this.host.link(id))).then(()=>new Notice(`已复制 ${entries.length} 项定位目录`));});this.copyButton.addClass('ts-board-search-copy');this.copyButton.appendText(' 复制结果');
  if(this.restored){this.input.value=this.restored.query;this.kind.value=this.restored.kind;this.group.value=this.restored.group;this.color.value=this.restored.color;this.review.value=this.restored.review||'';}
  this.run(()=>this.refresh());this.input.focus();
 }
 private cancelQuery(){this.contentEl.win.clearTimeout(this.timer);this.timer=undefined;}
 private flushQuery(){if(this.timer!==undefined){this.cancelQuery();this.reset();}}
 private hasFilters(){return !!(this.input.value||this.kind.value||this.group.value||this.color.value||this.review.value);}
 private criteria():SavedSearchQuery{return {query:this.input.value,kind:this.kind.value,group:this.group.value,color:this.color.value,review:this.review.value,full:this.full};}
 private buildSavedSearches(refine:HTMLElement){
  const panel=refine.createEl('details',{cls:'ts-board-search-saved'}),summary=panel.createEl('summary');setIcon(summary.createSpan({attr:{'aria-hidden':'true'}}),'list-filter');this.savedCaption=summary.createSpan();
  const content=panel.createDiv('ts-board-search-saved-content'),label=content.createEl('label',{cls:'ts-board-search-filter'});label.createSpan({text:'已保存清单'});this.savedSelect=label.createEl('select',{attr:{'aria-label':'已保存材料清单'}});this.savedSelect.onchange=()=>this.run(()=>this.openSavedSearch());
  this.savedName=content.createEl('input',{type:'text',attr:{'aria-label':'材料清单名称',placeholder:'清单名称',maxlength:'100'}});
  const actions=content.createDiv('ts-board-search-saved-actions');this.saveButton=this.button(actions,'保存当前查询为材料清单','bookmark-plus',()=>{this.flushQuery();const id=uid(),criteria=this.criteria(),name=this.savedName.value;return this.mutate(board=>addSavedSearch(board,id,name,criteria),()=>{this.savedId=id;this.renderSavedSearches();this.savedStatus.setText('已保存筛选条件；重开时按当前材料重新计算。');});});this.saveButton.appendText(' 保存查询');
  this.renameButton=this.button(actions,'重命名材料清单','pencil',()=>{const id=this.savedId;if(!id)throw Error('请先选择材料清单');const expected=this.savedStamp,name=this.savedName.value;return this.mutate(board=>renameSavedSearch(board,id,name,expected),()=>{this.renderSavedSearches();this.savedStatus.setText('清单已重命名。');});});
  this.deleteButton=this.button(actions,'删除材料清单','trash-2',()=>{const id=this.savedId;if(!id)throw Error('请先选择材料清单');const expected=this.savedStamp;return this.mutate(board=>removeSavedSearch(board,id,expected),()=>{this.savedId=undefined;this.renderSavedSearches();this.savedStatus.setText('清单已删除，可通过白板撤销恢复。');});});
  this.savedStatus=content.createDiv({cls:'ts-board-search-saved-status',attr:{role:'status','aria-live':'polite'}});this.renderSavedSearches();
 }
 private renderSavedSearches(preserveName=false){if(this.closed)return;const saved=this.host.board().savedSearches||[],selected=saved.find(s=>s.id===this.savedId);if(!selected)this.savedId=undefined;this.savedStamp=selected?savedSearchStamp(selected):undefined;this.savedCaption.setText(`材料清单${saved.length?` · ${saved.length}`:''}`);this.savedSelect.empty();this.savedSelect.createEl('option',{value:'',text:'选择清单…'});for(const item of saved)this.savedSelect.createEl('option',{value:item.id,text:item.name});this.savedSelect.value=this.savedId||'';if(!preserveName)this.savedName.value=selected?.name||`材料清单 ${saved.length+1}`;this.updateSavedBusy();}
 private updateSavedBusy(){if(!this.saveButton)return;this.savedSelect.disabled=this.mutationBusy;this.saveButton.disabled=this.mutationBusy;this.renameButton.disabled=this.mutationBusy||!this.savedId;this.deleteButton.disabled=this.mutationBusy||!this.savedId;}
 private async mutate(edit:(board:Board)=>void,success:()=>void){
  if(this.closed||this.mutationBusy)return;this.mutationBusy=true;this.updateBusy();this.savedStatus.setText('正在保存…');
  try{await this.host.commit(edit);if(this.closed)return;success();this.rebuild();this.reset(true);}
  catch(error){if(!this.closed){try{this.renderSavedSearches(true);this.rebuild();this.reset(true);}catch{/* A paused or replaced session can also reject the recovery read. Keep the original failure and input. */}this.savedStatus.setText(`保存失败：${String(error)}。输入已保留，请处理保存问题后重试。`);}throw error;}
  finally{this.mutationBusy=false;if(!this.closed)this.updateBusy();}
 }
 private openSavedSearch(){
  if(this.closed||this.mutationBusy)return;const id=this.savedSelect.value;if(!id){this.savedId=undefined;this.renderSavedSearches();return;}
  const criteria=savedSearchQuery(this.host.board(),id);this.cancelQuery();this.restored=undefined;this.savedId=id;this.input.value=criteria.query;this.kind.value=criteria.kind;if(criteria.group&&!Array.from(this.group.options).some(o=>o.value===criteria.group))this.group.createEl('option',{value:criteria.group,text:'清单分组'});this.group.value=criteria.group;this.color.value=criteria.color;this.review.value=criteria.review;this.full=criteria.full;this.fullInput.checked=this.full;this.renderSavedSearches();return this.refresh();
 }
 private clearFilters(){this.input.value='';this.kind.value='';this.group.value='';this.color.value='';this.review.value='';this.reset();this.input.focus();}
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
  if(this.closed)return Promise.resolve();const generation=++this.generation;this.bodies.clear();this.rebuild();const previous=this.restored?.group??this.group.value,saved=this.host.board().savedSearches?.find(s=>s.id===this.savedId);this.group.empty();this.group.createEl('option',{value:'',text:'全部分组'});this.group.createEl('option',{value:':none',text:'未分组'});for(const e of this.entries.filter(e=>e.kind==='section'))this.group.createEl('option',{value:e.id,text:e.title});const missing=previous&&!Array.from(this.group.options).some(o=>o.value===previous)&&saved?.query.group===previous;if(missing)this.group.createEl('option',{value:previous,text:'原分组已删除'});this.group.value=Array.from(this.group.options).some(o=>o.value===previous)?previous:'';this.renderSavedSearches(true);this.savedStatus.setText(missing?'原分组已删除，清单暂为空；可调整筛选后另存查询。':saved?'每次重开都按当前白板材料重新计算。':'保存当前筛选，下次继续这份材料清单。');this.reset(true);
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
  if(stale())return;this.rebuild();this.reset(true);this.restoredActive=undefined;this.indexStatus.setText(`已索引 ${read} 篇正文${skipped?` · ${skipped} 篇未读取（失效或超限）`:''} · 单篇 2 MB / 总计 20 MB 上限；修改原文后可刷新`);
 }
 private reset(preserve=false){
  if(this.closed)return;this.cancelQuery();if(!preserve)this.restoredActive=undefined;this.excerptCache.clear();const restored=this.restored,current=preserve?(this.restoredActive||this.results[this.active]?.id):undefined;
  this.results=searchBoard(this.entries,this.criteria());this.active=current?Math.max(0,this.results.findIndex(e=>e.id===current)):0;this.limit=Math.max(restored?.limit||40,Math.ceil((this.active+1)/40)*40);this.status.setText(`${this.results.length} / ${this.entries.length} 项`);this.render();if(restored){this.list.scrollTop=restored.scroll;this.restored=undefined;}if(!this.full)this.restoredActive=undefined;
 }
 private async activate(entry:BoardSearchEntry,side=false){
  if(this.closed||this.busy||this.mutationBusy||(side&&entry.kind!=='card'))return;this.busy=true;this.updateBusy();
  try{if(side)await this.host.open(entry.id);else await this.host.locate(entry.id);if(!this.closed)this.close();}finally{this.busy=false;if(!this.closed)this.updateBusy();}
 }
 private updateBusy(){if(!this.list)return;this.list.setAttribute('aria-busy',String(this.busy||this.mutationBusy));for(const button of Array.from(this.list.querySelectorAll('button')))button.disabled=this.busy||this.mutationBusy;for(const select of Array.from(this.list.querySelectorAll('select')))select.disabled=this.busy||this.mutationBusy||select.getAttribute('data-locked')==='true';this.copyButton.disabled=this.busy||this.mutationBusy||!this.results.length;this.updateSavedBusy();}
 private render(restoreFocus=true){if(this.closed)return;
  const focused=restoreFocus?this.rows.find(({controls})=>controls.includes(this.contentEl.ownerDocument.activeElement as HTMLButtonElement)):undefined,focusedId=focused?.row.getAttribute('data-search-node'),focusedLabel=focused?this.contentEl.ownerDocument.activeElement?.getAttribute('aria-label'):undefined,entries=this.results;
  // Cache only the short displayed snippets, not another copy of every note body.
  // Pagination keeps the query/index; filtering and refresh invalidate the cache.
  if(this.excerptQuery!==this.input.value){this.excerptQuery=this.input.value;this.excerptCache.clear();}
  this.clearButton.disabled=!this.hasFilters();this.copyButton.disabled=this.busy||!entries.length;this.list.empty();this.rows=[];
  if(!entries.length){const empty=this.list.createDiv('ts-board-search-empty');setIcon(empty.createSpan({cls:'ts-board-search-empty-icon',attr:{'aria-hidden':'true'}}),'search');empty.createEl('strong',{text:'没有匹配的内容'});empty.createSpan({text:'试试更短的关键词，或清除类型、分组与颜色筛选。'});const actions=empty.createDiv('ts-board-search-empty-actions'),clear=this.button(actions,'清除关键词与筛选','filter-x',()=>this.clearFilters());clear.addClass('ts-board-search-empty-clear','ts-board-search-filter-reset');clear.appendText(' 清除筛选');this.updateBusy();if(focusedId)this.input.focus();return;}
  for(const [i,e]of entries.slice(0,this.limit).entries()){
   const row=this.list.createDiv({cls:'ts-board-search-row',attr:{'data-search-node':e.id,role:'group','aria-label':`${searchKinds[e.kind]} · ${e.title}`}});const pick=row.createEl('button',{cls:'ts-board-search-pick',attr:{'aria-label':`定位 ${e.title}`}});const controls:(HTMLButtonElement|HTMLSelectElement)[]=[pick];this.rows.push({row,pick,controls});this.markCurrent(i,i===this.active);
   // Scrolling and row replacement can fire pointerenter under an unmoving mouse.
   row.onpointermove=event=>{if(this.pointer?.x===event.clientX&&this.pointer.y===event.clientY)return;this.pointer={x:event.clientX,y:event.clientY};this.setActive(i,false,false);};pick.onfocus=()=>this.setActive(i,false,false);pick.onkeydown=event=>this.keydown(event,true,i);pick.onclick=()=>this.run(()=>{this.setActive(i,false,false);return this.activate(e);});
   const head=pick.createDiv('ts-board-search-heading');setIcon(head.createSpan({attr:{'aria-hidden':'true'}}),{card:'file-text',text:'type',image:'image',pdf:'file-text',audio:'audio-lines',video:'video',section:'group',board:'panels-top-left',mindmap:'network'}[e.kind]);head.createEl('strong',{text:e.title,attr:{title:e.title}});head.createEl('small',{text:searchKinds[e.kind]});
   let excerpt=this.excerptCache.get(e);if(excerpt===undefined){excerpt=searchExcerpt(e,this.input.value);this.excerptCache.set(e,excerpt);}if(excerpt)pick.createDiv({cls:'ts-board-search-excerpt',text:excerpt});
   const meta=pick.createDiv('ts-board-search-meta'),location=meta.createDiv({cls:'ts-board-search-location',text:e.groups.map(g=>g.title).join(' / ')||'未分组'});if(e.hidden)location.appendText(' · 折叠分支内');if(e.path)meta.createDiv({cls:'ts-board-search-path',text:e.path,attr:{title:e.path}});const actions=row.createDiv('ts-board-search-row-actions');const link=this.button(actions,'复制内容定位链接','link',()=>navigator.clipboard.writeText(this.host.link(e.id)).then(()=>new Notice('已复制定位链接')));controls.push(link);link.onfocus=()=>this.setActive(i,false,false);
   if(e.kind==='card'){const open=this.button(actions,'在右侧打开原笔记','panel-right',()=>this.activate(e,true));open.createSpan({cls:'ts-board-search-action-label',text:'打开'});controls.push(open);open.onfocus=()=>this.setActive(i,false,false);}
   if(e.review){const review=actions.createEl('select',{cls:'ts-board-search-review',attr:{'aria-label':`${e.title} 阅读状态`,'data-locked':String(!!e.locked)}});for(const [value,text]of Object.entries(reviewLabels))review.createEl('option',{value,text});review.value=e.review;controls.push(review);review.onfocus=()=>this.setActive(i,false,false);review.onchange=()=>this.run(()=>{const status=review.value as ReviewState;return this.mutate(board=>{const node=board.nodes.find(n=>n.id===e.id);if(!node)throw Error('材料已移除，请刷新后重试');if(node.locked)throw Error('材料已锁定，请先解锁');if((node.review||'later')!==e.review)throw Error('阅读状态已变化，请刷新后重试');markReading(board,new Set([e.id]),status);},()=>this.savedStatus.setText('阅读状态已保存，可通过白板撤销恢复。'));});}
  }
  if(entries.length>this.limit){const more=this.button(this.list,'显示更多结果','chevron-down',()=>{const next=this.limit;this.limit+=40;this.render();this.setActive(next,true);});more.addClass('ts-board-search-more');more.appendText(` 再显示 40 项 · 剩余 ${entries.length-this.limit}`);}
  this.updateBusy();if(focusedId){const previous=this.rows.find(({row})=>row.getAttribute('data-search-node')===focusedId);if(previous)(previous.controls.find(control=>control.getAttribute('aria-label')===focusedLabel)||previous.pick).focus();else this.input.focus();}
 }
 onClose(){if(!this.closed&&this.input)searchContexts.set(this.host.context||this.host,{...this.criteria(),saved:this.savedId,active:this.results[this.active]?.id,limit:this.limit,scroll:this.list.scrollTop||0});this.closed=true;this.pointer=undefined;this.generation++;this.cancelQuery();this.entries=[];this.results=[];this.rows=[];this.excerptCache.clear();this.bodies.clear();this.contentEl.empty();}
}
