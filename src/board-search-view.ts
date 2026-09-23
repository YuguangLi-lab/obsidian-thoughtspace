import {App,Modal,Notice,TFile,getAllTags,setIcon} from 'obsidian';
import {Board,Card,colors,colorNames} from './model';
import {BoardSearchEntry,boardSearchIndex,searchBoard,searchKinds,searchExcerpt,searchDirectory} from './board-search';
import {themeSurface} from './ui-tokens';
export interface BoardSearchHost{title:string;board:()=>Board;locate:(id:string)=>Promise<void>;open:(id:string)=>Promise<void>;link:(id:string)=>string;}
export class BoardSearchModal extends Modal{
 private entries:BoardSearchEntry[]=[];private input!:HTMLInputElement;private kind!:HTMLSelectElement;private group!:HTMLSelectElement;private color!:HTMLSelectElement;private list!:HTMLElement;private status!:HTMLElement;private indexStatus!:HTMLElement;
 private bodies=new Map<string,string>();private generation=0;private closed=false;private active=0;private limit=40;private timer?:number;private full=false;private busy=false;
 constructor(app:App,private host:BoardSearchHost){super(app);}
 private run(action:()=>unknown){try{Promise.resolve(action()).catch(e=>new Notice(String(e)));}catch(e){new Notice(String(e));}}
 private button(el:HTMLElement,label:string,icon:string,run:()=>unknown){const b=el.createEl('button',{attr:{'aria-label':label,title:label}});setIcon(b,icon);b.onclick=()=>this.run(run);return b;}
 onOpen(){themeSurface(this.modalEl);this.modalEl.addClass('ts-board-search');this.titleEl.setText('搜索白板');this.titleEl.createEl('small',{text:this.host.title});
  const bar=this.contentEl.createDiv('ts-board-search-bar');setIcon(bar.createSpan(),'search');this.input=bar.createEl('input',{type:'search',attr:{placeholder:'标题、文本、#标签、分组或文件路径…','aria-label':'搜索白板内容'}});this.input.oninput=()=>{this.active=0;this.limit=40;this.contentEl.win.clearTimeout(this.timer);this.timer=this.contentEl.win.setTimeout(()=>this.reset(),90);};this.input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();this.contentEl.win.clearTimeout(this.timer);this.active=Math.max(0,Math.min(this.filtered().length-1,this.active+(e.key==='ArrowDown'?1:-1)));this.limit=Math.max(this.limit,this.active+1);this.render();this.list.querySelector('.is-active')?.scrollIntoView({block:'nearest'});}else if(e.key==='Enter'){e.preventDefault();const entry=this.filtered()[this.active];if(entry)this.run(()=>this.locate(entry.id));}};
  this.button(bar,'刷新搜索索引','refresh-cw',()=>this.refresh());
  const filters=this.contentEl.createDiv('ts-board-search-filters');const select=(label:string,options:Record<string,string>)=>{const s=filters.createEl('select',{attr:{'aria-label':label}});for(const [value,text]of Object.entries(options))s.createEl('option',{value,text});s.onchange=()=>this.reset();return s;};
  this.kind=select('对象类型',{'':'全部类型',...searchKinds});this.group=select('所属分组',{'':'全部分组',':none':'未分组'});this.color=select('对象颜色',{'':'全部颜色',...Object.fromEntries(colors.map(c=>[c,colorNames[c]]))});
  const options=this.contentEl.createDiv('ts-board-search-options'),label=options.createEl('label'),full=label.createEl('input',{type:'checkbox'});label.createSpan({text:'包含笔记正文'});full.onchange=()=>{this.full=full.checked;this.run(()=>this.refresh());};this.status=options.createSpan({attr:{role:'status','aria-live':'polite'}});
  this.list=this.contentEl.createDiv('ts-board-search-results');this.indexStatus=this.contentEl.createDiv({cls:'ts-board-search-index-status',attr:{role:'status'}});
  const footer=this.contentEl.createDiv('ts-board-search-footer');footer.createSpan({text:'↑ ↓ 选择 · Enter 定位 · Esc 返回'});const copy=this.button(footer,'复制搜索结果为定位目录','list-tree',()=>{const entries=this.filtered();if(!entries.length)return;return navigator.clipboard.writeText(searchDirectory(entries,id=>this.host.link(id))).then(()=>new Notice(`已复制 ${entries.length} 项定位目录`));});copy.appendText(' 复制结果');
  this.run(()=>this.refresh());this.input.focus();
 }
 private metadata(n:Card){const f=n.file?this.app.vault.getAbstractFileByPath(n.file):null;if(!(f instanceof TFile))return{};const cache=this.app.metadataCache.getFileCache(f);return {title:f.basename,tags:getAllTags(cache||{})||[],headings:cache?.headings?.map(h=>h.heading),body:this.bodies.get(f.path)};}
 private rebuild(){this.entries=boardSearchIndex(this.host.board(),n=>this.metadata(n));}
 private async refresh(){const generation=++this.generation;this.bodies.clear();this.rebuild();const previous=this.group.value;this.group.empty();this.group.createEl('option',{value:'',text:'全部分组'});this.group.createEl('option',{value:':none',text:'未分组'});for(const e of this.entries.filter(e=>e.kind==='section'))this.group.createEl('option',{value:e.id,text:e.title});this.group.value=Array.from(this.group.options).some(o=>o.value===previous)?previous:'';this.reset();
  this.indexStatus.setText('搜索标题、文本、标签与笔记标题层级；勾选后读取正文。');if(!this.full)return;
  const paths=[...new Set(this.entries.filter(e=>e.kind==='card').map(e=>e.path).filter(Boolean))];let used=0,skipped=0,read=0;
  for(let i=0;i<paths.length;i++){if(this.closed||generation!==this.generation)return;const path=paths[i],file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile)||file.extension!=='md'||file.stat.size>2000000||used+file.stat.size>20000000){skipped++;continue;}
   used+=file.stat.size;try{const raw=await this.app.vault.cachedRead(file);if(this.closed||generation!==this.generation)return;if(file.path!==path||raw.length>2000000){skipped++;continue;}this.bodies.set(path,raw);read++;}catch{skipped++;}
   if(i%20===0){this.indexStatus.setText(`正在索引正文 · ${i+1} / ${paths.length}`);await new Promise(resolve=>this.contentEl.win.setTimeout(resolve,0));}
  }
  if(this.closed||generation!==this.generation)return;this.rebuild();this.reset();this.indexStatus.setText(`已索引 ${read} 篇正文${skipped?` · ${skipped} 篇未读取（失效或超限）`:''} · 单篇 2 MB / 总计 20 MB 上限；修改原文后可刷新`);
 }
 private filtered(){return searchBoard(this.entries,{query:this.input.value,kind:this.kind.value,group:this.group.value,color:this.color.value});}
 private reset(){this.active=0;this.limit=40;this.render();}
 private async locate(id:string){if(this.busy)return;this.busy=true;try{await this.host.locate(id);this.close();}finally{this.busy=false;}}
 private render(){if(this.closed)return;const entries=this.filtered();this.status.setText(`${entries.length} / ${this.entries.length} 项`);this.list.empty();
  if(!entries.length){this.list.createDiv({cls:'ts-board-search-empty',text:'没有匹配内容，试试更短的关键词或清除筛选。'});return;}
  for(const [i,e]of entries.slice(0,this.limit).entries()){const row=this.list.createDiv({cls:'ts-board-search-row',attr:{'data-search-node':e.id}});row.toggleClass('is-active',i===this.active);const pick=row.createEl('button',{cls:'ts-board-search-pick',attr:{'aria-label':`定位 ${e.title}`}});pick.onclick=()=>this.run(()=>this.locate(e.id));
   const head=pick.createDiv('ts-board-search-heading');setIcon(head.createSpan(),{card:'file-text',text:'type',image:'image',pdf:'file-text',section:'group',board:'panels-top-left'}[e.kind]);head.createEl('strong',{text:e.title});head.createEl('small',{text:searchKinds[e.kind]});const location=pick.createDiv({cls:'ts-board-search-location',text:e.groups.map(g=>g.title).join(' / ')||'未分组'});if(e.hidden)location.appendText(' · 折叠分支内');
   const excerpt=searchExcerpt(e,this.input.value);if(excerpt)pick.createDiv({cls:'ts-board-search-excerpt',text:excerpt});if(e.path)pick.createDiv({cls:'ts-board-search-path',text:e.path});const actions=row.createDiv('ts-board-search-row-actions');this.button(actions,'复制内容定位链接','link',()=>navigator.clipboard.writeText(this.host.link(e.id)).then(()=>new Notice('已复制定位链接')));if(e.kind==='card')this.button(actions,'在右侧打开原笔记','panel-right',async()=>{await this.host.open(e.id);this.close();});
  }
  if(entries.length>this.limit){const more=this.button(this.list,'显示更多结果','chevron-down',()=>{this.limit+=40;this.render();});more.addClass('ts-board-search-more');more.appendText(` 再显示 40 项 · 剩余 ${entries.length-this.limit}`);}
 }
 onClose(){this.closed=true;this.generation++;this.contentEl.win.clearTimeout(this.timer);this.entries=[];this.bodies.clear();this.contentEl.empty();}
}
