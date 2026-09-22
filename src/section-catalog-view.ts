import {App,Modal,Notice,setIcon} from 'obsidian';
import {Board,cardFillHex} from './model';
import {SectionEntry,SectionSort,sectionCatalog,sectionDirectory,selectSections} from './section-catalog';
import {themeSurface} from './ui-tokens';
interface Host{board:()=>Board;focus:(id:string)=>Promise<void>;link:(id:string)=>string;}
export class SectionCatalogModal extends Modal{
 private entries:SectionEntry[]=[];private list!:HTMLElement;private count!:HTMLElement;private input!:HTMLInputElement;private sort:SectionSort='position';private empty=false;private limit=24;private closed=false;private busy=false;
 constructor(app:App,private host:Host){super(app);}
 private button(el:HTMLElement,label:string,icon:string,action:()=>void|Promise<void>){const b=el.createEl('button',{attr:{'aria-label':label,title:label}});if(icon)setIcon(b.createSpan(),icon);else b.createSpan();b.createSpan({text:label});b.onclick=()=>{void Promise.resolve().then(action).catch(e=>new Notice(String(e).replace(/^Error: /,'')));};return b;}
 onOpen(){themeSurface(this.modalEl);this.modalEl.addClass('ts-section-catalog');this.titleEl.setText('分组总览');this.titleEl.createDiv({cls:'ts-catalog-subtitle',text:'从分组回到材料，沿着线索继续思考'});
  const toolbar=this.contentEl.createDiv('ts-catalog-toolbar');this.input=toolbar.createEl('input',{type:'search',attr:{placeholder:'搜索组名、文本、笔记标题或路径…','aria-label':'搜索白板分组'}});this.input.oninput=()=>{this.limit=24;this.render();};
  const sort=toolbar.createEl('select',{attr:{'aria-label':'分组排序'}});for(const [value,text]of [['position','空间顺序'],['name','名称排序'],['size','内容最多']])sort.createEl('option',{value,text});sort.onchange=()=>{this.sort=sort.value as SectionSort;this.limit=24;this.render();};
  this.button(toolbar,'刷新分组','refresh-cw',()=>this.refresh()).addClass('ts-catalog-icon');
  const filters=this.contentEl.createDiv('ts-catalog-filters'),label=filters.createEl('label'),check=label.createEl('input',{type:'checkbox'});label.createSpan({text:'只看空分组'});check.onchange=()=>{this.empty=check.checked;this.limit=24;this.render();};this.count=filters.createSpan({cls:'ts-catalog-count',attr:{role:'status','aria-live':'polite'}});
  this.list=this.contentEl.createDiv('ts-catalog-list');
  const foot=this.contentEl.createDiv('ts-catalog-footer');foot.createSpan({text:'按边框包含范围统计 · 搜索不读取笔记正文'});this.button(foot,'复制分组目录','list-tree',async()=>{this.entries=sectionCatalog(this.host.board());const entries=this.filtered();if(!entries.length){new Notice('没有可复制的分组');return;}await navigator.clipboard.writeText(sectionDirectory(entries,id=>this.host.link(id)));new Notice(`已复制 ${entries.length} 个分组的 Markdown 定位目录`);});
  this.refresh();
 }
 private filtered(){return selectSections(this.entries,this.input.value,this.sort,this.empty);}
 private refresh(){this.entries=sectionCatalog(this.host.board());this.limit=24;this.render();}
 private render(){if(this.closed)return;const entries=this.filtered();this.count.setText(`${entries.length} / ${this.entries.length} 个分组`);this.list.empty();
  if(!entries.length){this.list.createDiv({cls:'ts-catalog-empty',text:this.entries.length?'没有匹配的分组，试试其他关键词。':'还没有分组。回到白板，使用“分组框”框住卡片和文本。'});return;}
  for(const e of entries.slice(0,this.limit)){const card=this.list.createDiv({cls:'ts-catalog-card',attr:{'data-section':e.section.id}});const open=this.button(card,e.section.title||'未命名分组','',async()=>{if(this.busy)return;this.busy=true;try{await this.host.focus(e.section.id);this.close();}finally{this.busy=false;}});open.addClass('ts-catalog-open');open.firstElementChild?.remove();const preview=open.createDiv('ts-catalog-preview');open.prepend(preview);this.preview(preview,e);
   const info=card.createDiv('ts-catalog-info');info.createSpan({text:`${e.members.length} 项内容`});info.createSpan({text:[e.notes&&`${e.notes} 笔记`,e.texts&&`${e.texts} 文本`,e.images&&`${e.images} 图片`,e.boards&&`${e.boards} 白板`].filter(Boolean).join(' · ')||'空分组'});
   const actions=card.createDiv('ts-catalog-actions');actions.createSpan({text:e.section.locked?'已锁定':'点击预览定位'});this.button(actions,'复制分组链接','link',async()=>{await navigator.clipboard.writeText(this.host.link(e.section.id));new Notice('已复制分组定位链接');}).addClass('ts-catalog-icon');
  }
  if(entries.length>this.limit)this.button(this.list,`继续显示（剩余 ${entries.length-this.limit}）`,'chevron-down',()=>{this.limit+=24;this.render();}).addClass('ts-catalog-more');
 }
 private preview(el:HTMLElement,e:SectionEntry){const ns='http://www.w3.org/2000/svg',svg=el.ownerDocument.createElementNS(ns,'svg'),s=e.section;svg.setAttribute('viewBox',`${s.x} ${s.y} ${s.width} ${s.height}`);svg.setAttribute('aria-hidden','true');svg.style.color=cardFillHex[s.color];for(const n of e.members.slice(0,60)){const rect=el.ownerDocument.createElementNS(ns,'rect');for(const [k,v]of Object.entries({x:n.x,y:n.y,width:n.width,height:n.height,rx:5,fill:cardFillHex[n.color]}))rect.setAttribute(k,String(v));svg.appendChild(rect);}el.appendChild(svg);if(e.members.length>60)el.createSpan({cls:'ts-catalog-preview-note',text:'显示前 60 项'});}
 onClose(){this.closed=true;this.entries=[];this.contentEl.empty();}
}
