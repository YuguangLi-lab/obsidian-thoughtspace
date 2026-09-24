import {App,Modal,setIcon} from 'obsidian';
import {Board,clone,uid} from './model';
import {themeSurface} from './ui-tokens';
import {SavedView,addSavedView,renameSavedView,removeSavedView,reorderSavedView,savedViewOrderStamp,savedViewStamp,savedViewViewport,updateSavedView} from './saved-views';

interface SavedViewsHost{board:()=>Board;commit:(edit:(board:Board)=>void)=>void;restore:(id:string)=>void;}
let savedViewPreviewScene=0;
/** Named camera locations, never a snapshot or restore of note content. */
export class SavedViewsModal extends Modal{
 private selected?:string;private search!:HTMLInputElement;private list!:HTMLElement;private detail!:HTMLElement;private feedback!:HTMLElement;private closed=false;
 constructor(app:App,private host:SavedViewsHost){super(app);}
 private action(host:HTMLElement,label:string,icon:string,run:()=>void,cls=''){
  const button=host.createEl('button',{cls,attr:{'aria-label':label,title:label}});setIcon(button.createSpan(),icon);if(!cls.includes('ts-view-icon'))button.createSpan({text:label});
  button.onclick=()=>this.run(run);return button;
 }
 private run(fn:()=>void){if(this.closed)return;try{fn();if(!this.closed)this.feedback.empty();}catch(error){if(!this.closed)this.feedback.setText(error instanceof Error?error.message:String(error));}}
 onOpen(){
  this.closed=false;themeSurface(this.modalEl);this.modalEl.addClass('ts-saved-views');this.titleEl.setText('常用视角');
  this.contentEl.createDiv({cls:'ts-view-intro',text:'保存常看的位置，在白板的不同区域间快速切换。'});
  const toolbar=this.contentEl.createDiv('ts-view-toolbar');this.search=toolbar.createEl('input',{type:'search',attr:{placeholder:'搜索视角…','aria-label':'搜索视角'}});
  this.search.oninput=()=>this.run(()=>this.render());
  this.action(toolbar,'刷新视角','refresh-cw',()=>this.render(),'ts-view-icon');
  this.action(toolbar,'保存当前视角','bookmark-plus',()=>{let id='';this.host.commit(b=>{id=uid();addSavedView(b,id,`视角 ${(b.savedViews?.length||0)+1}`);});if(this.closed)return;this.selected=id;this.search.value='';this.render();const input=this.detail.querySelector<HTMLInputElement>('input');input?.focus();input?.select();},'mod-cta');
  const body=this.contentEl.createDiv('ts-view-body');this.list=body.createDiv({cls:'ts-view-list',attr:{role:'listbox','aria-label':'已保存视角'}});this.detail=body.createDiv('ts-view-detail');
  this.feedback=this.contentEl.createDiv({cls:'ts-view-feedback',attr:{role:'status','aria-live':'polite'}});
  this.contentEl.createDiv({cls:'ts-view-footer',text:'仅保存位置和缩放；不会覆盖笔记内容。管理操作可以在白板中撤销。'});
  this.list.onkeydown=e=>{if(this.closed||e.isComposing||e.keyCode===229||e.shiftKey||e.altKey||e.ctrlKey||e.metaKey)return;const buttons=Array.from(this.list.querySelectorAll<HTMLButtonElement>('[role=option]'));const i=buttons.indexOf(e.target as HTMLButtonElement);if(i<0)return;const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?Math.min(i+1,buttons.length-1):e.key==='ArrowUp'?Math.max(0,i-1):-1;if(next<0)return;e.preventDefault();e.stopPropagation();buttons[next].click();this.list.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus({preventScroll:true});};
  this.run(()=>this.render());
 }
 private render(){
  if(this.closed)return;
  const board=this.host.board(),all=board.savedViews||[],query=this.search.value.trim().toLocaleLowerCase(),views=all.filter(v=>v.name.toLocaleLowerCase().includes(query));
  if(!views.some(v=>v.id===this.selected))this.selected=views[0]?.id;
  this.list.empty();this.detail.empty();
  for(const view of views){const row=this.list.createEl('button',{cls:'ts-view-row',attr:{role:'option','aria-selected':String(view.id===this.selected),'aria-label':view.name,'data-view-id':view.id}});row.tabIndex=view.id===this.selected?0:-1;setIcon(row.createSpan('ts-view-row-icon'),'scan');const label=row.createDiv('ts-view-row-copy');label.createSpan({text:view.name});label.createSpan({cls:'ts-view-row-meta',text:`${Math.round(view.viewport.zoom*100)}% · 视角 ${all.indexOf(view)+1}`});row.onclick=()=>this.run(()=>this.select(view.id));const expected=savedViewStamp(view);row.ondblclick=()=>this.run(()=>this.restore(view.id,expected));}
  const view=views.find(v=>v.id===this.selected);
  if(!view){const empty=this.detail.createDiv('ts-view-empty');setIcon(empty.createSpan(),'scan');empty.createEl('h3',{text:query?'没有匹配的视角':'把常用位置留在这里'});empty.createEl('p',{text:query?'换个关键词，或清空搜索。':'先移动到想保存的位置，再点击“保存当前视角”。'});return;}
  this.renderDetail(board,view);
 }
 /** Keep row elements in place so native double-click and keyboard focus survive. */
 private select(id:string){const board=this.host.board(),view=board.savedViews?.find(item=>item.id===id);if(!view)throw Error('视角已移除，请刷新列表');this.selected=id;
  for(const row of Array.from(this.list.querySelectorAll<HTMLButtonElement>('[role=option]'))){const selected=row.getAttribute('data-view-id')===id;row.setAttribute('aria-selected',String(selected));row.tabIndex=selected?0:-1;}
  this.detail.empty();this.renderDetail(board,view);
 }
 private restore(id:string,expected:string){savedViewViewport(this.host.board(),id,expected);this.host.restore(id);if(!this.closed)this.close();}
 private renderDetail(board:Board,view:SavedView){
  const expected=savedViewStamp(view),expectedOrder=savedViewOrderStamp(board),all=board.savedViews||[];
  this.preview(board,view);
  const label=this.detail.createEl('label',{cls:'ts-view-name'});label.createSpan({text:'视角名称'});const name=label.createEl('input',{type:'text',value:view.name,attr:{'aria-label':'视角名称',maxlength:'100'}});
  const actions=this.detail.createDiv('ts-view-detail-actions');
  this.action(actions,'定位到这里','focus',()=>this.restore(view.id,expected),'mod-cta');
  const rename=()=>{this.host.commit(b=>renameSavedView(b,view.id,name.value,expected));this.render();};this.action(actions,'保存名称','check',rename);
  name.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){e.preventDefault();this.run(rename);}};
  this.action(this.detail,'用当前白板位置更新','refresh-cw',()=>{const viewport=clone(this.host.board().viewport);this.host.commit(b=>updateSavedView(b,view.id,viewport,expected));this.render();},'ts-view-update');
  const bottom=this.detail.createDiv('ts-view-bottom');bottom.createSpan({text:'排列顺序'});
  const up=this.action(bottom,'上移视角','arrow-up',()=>{this.host.commit(b=>reorderSavedView(b,view.id,-1,expectedOrder));this.render();},'ts-view-icon');up.disabled=all[0]?.id===view.id;
  const down=this.action(bottom,'下移视角','arrow-down',()=>{this.host.commit(b=>reorderSavedView(b,view.id,1,expectedOrder));this.render();},'ts-view-icon');down.disabled=all.at(-1)?.id===view.id;
  this.action(bottom,'移除视角','trash-2',()=>{this.host.commit(b=>removeSavedView(b,view.id,expected));this.render();},'ts-view-delete');
 }
 private preview(board:Board,view:SavedView){
  const titleId=`ts-saved-view-preview-${++savedViewPreviewScene}`,wrap=this.detail.createDiv('ts-view-preview'),svg=wrap.createSvg('svg',{attr:{viewBox:'0 0 420 240',role:'img','aria-labelledby':titleId}});svg.createSvg('title',{attr:{id:titleId}}).textContent=`${view.name}的白板位置示意`;
  const viewport={x:-view.viewport.x/view.viewport.zoom,y:-view.viewport.y/view.viewport.zoom,width:1000/view.viewport.zoom,height:650/view.viewport.zoom};
  const nodes=board.nodes.slice(0,400),x=Math.min(viewport.x,...nodes.map(n=>n.x)),y=Math.min(viewport.y,...nodes.map(n=>n.y));
  const right=Math.max(viewport.x+viewport.width,...nodes.map(n=>n.x+n.width)),bottom=Math.max(viewport.y+viewport.height,...nodes.map(n=>n.y+n.height));const scale=Math.min(388/Math.max(1,right-x),208/Math.max(1,bottom-y));
  for(const node of nodes)svg.createSvg('rect',{cls:node.kind==='section'?'ts-view-mini-section':'ts-view-mini-node',attr:{x:String(16+(node.x-x)*scale),y:String(16+(node.y-y)*scale),width:String(Math.max(2,node.width*scale)),height:String(Math.max(2,node.height*scale)),rx:'2'}});
  svg.createSvg('rect',{cls:'ts-view-mini-camera',attr:{x:String(16+(viewport.x-x)*scale),y:String(16+(viewport.y-y)*scale),width:String(viewport.width*scale),height:String(viewport.height*scale),rx:'4'}});
  wrap.createSpan({cls:'ts-view-preview-label',text:`${Math.round(view.viewport.zoom*100)}% · 位置示意${board.nodes.length>400?'（显示前 400 个对象）':''}`});
 }
 onClose(){this.closed=true;this.contentEl.empty();}
}
