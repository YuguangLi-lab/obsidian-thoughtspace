import {Component,Menu,setIcon,type App} from 'obsidian';
import type {Board,Card} from './model';
import {updateBoardMindmapState,supportsBoardMindmapTarget,type BoardMindmapAction,type BoardMindmapState} from './board-mindmap';
import {localNeighborhood,localRelationMatches,localRelationNode,searchLocalCenters,type LocalRelationKind,type LocalRelationNode} from './local-relations';
import type {NativeLocalRelation,NativeLocalRelations} from './local-relations-native';
import {LocalRelationMotion} from './local-relations-motion';

export interface BoardMindmapSnapshot {
 board:Board;container:Card;path:string;key?:object;readOnly?:boolean;
 native?:(id:string)=>NativeLocalRelations|readonly NativeLocalRelation[];
}
export interface BoardMindmapSource {label:string;path?:string;stamp?:string;available:boolean;reason?:string;canEdit?:boolean;editReason?:string;}
export interface BoardMindmapHost {
 snapshot:()=>BoardMindmapSnapshot|undefined;
 change:(next:BoardMindmapState)=>void;
 source:(id:string)=>BoardMindmapSource;
 open:(id:string,current:()=>boolean,edit?:boolean)=>Promise<unknown>;
 preview:(id:string,body:HTMLElement,scope:Component,current:()=>boolean)=>void;
 select:()=>void;fold:()=>void;
 canvasGesture?:(event:PointerEvent)=>boolean;
 shortcut?:(event:KeyboardEvent)=>boolean;
 relate?:(id:string,kind:'child'|'parent'|'associate'|'remove',current:()=>boolean)=>unknown;
 fileMenu?:(menu:Menu,id:string)=>void;
}
interface NodeElements {root:HTMLElement;scope:Component;pill:HTMLElement;title:HTMLButtonElement;expand:HTMLButtonElement;open:HTMLButtonElement;menu:HTMLButtonElement;status:HTMLElement;}
interface Preview {body:HTMLElement;scope:Component;stamp:string;}
const labels:Record<LocalRelationKind,string>={parents:'父级',children:'子级',siblings:'同级',incoming:'引用此对象',outgoing:'此对象引用',associated:'关联'};
const leftKinds=new Set<LocalRelationKind>(['parents','incoming','siblings']);
const rolePriority:LocalRelationKind[]=['parents','children','associated','siblings','incoming','outgoing'];

/** A bounded projection of real board objects. Only explicit intents reach the
 * host; mounting, reading, searching and drawing never mutate board geometry. */
export class BoardMindmapView extends Component {
 private alive=false;private generation=0;private renders=0;private context?:object|string;private boardPath?:string;private center?:string;private document?:Document;private error='';private activeMenu?:Menu;
 private shell!:HTMLElement;private header!:HTMLElement;private heading!:HTMLElement;private stage!:HTMLElement;private layout!:HTMLElement;private left!:HTMLElement;private right!:HTMLElement;private centerEl!:HTMLElement;private svg!:SVGSVGElement;
 private back!:HTMLButtonElement;private forward!:HTMLButtonElement;private fold!:HTMLButtonElement;private searchButton!:HTMLButtonElement;private searchBox!:HTMLElement;private input!:HTMLInputElement;private searchResults!:HTMLElement;private pins!:HTMLElement;private status!:HTMLElement;
 private query='';private searchPage=0;private searchVisible=false;private pages:Partial<Record<LocalRelationKind,number>>={};
 private items=new Map<string,NodeElements>();private groups=new Map<LocalRelationKind,HTMLElement>();private previews=new Map<string,Preview>();private rendered=new Set<string>();private previewed=new Set<string>();
 private motion=new LocalRelationMotion();private motionEpoch=0;private motionActive=false;private frame=0;private frameWindow?:Window;private observer?:ResizeObserver;
 constructor(_app:App,private readonly el:HTMLElement,private readonly host:BoardMindmapHost){super();}
 onload(){
  this.alive=true;this.shell=this.el.createDiv('ts-mindmap-shell');this.header=this.shell.createDiv('ts-mindmap-header');
  this.back=this.button(this.header,'arrow-left','后退',()=>this.update({type:'history',direction:'back'}),'back');
  this.forward=this.button(this.header,'arrow-right','前进',()=>this.update({type:'history',direction:'forward'}),'forward');
  this.heading=this.header.createDiv({cls:'ts-mindmap-heading',attr:{title:'拖动标题栏移动脑图容器'}});
  this.searchButton=this.button(this.header,'search','搜索本板对象',()=>this.toggleSearch(),'search');
  this.fold=this.button(this.header,'chevrons-up','折叠脑图容器',()=>{if(!this.readOnly())this.host.fold();},'fold');
  this.searchBox=this.shell.createDiv('ts-mindmap-search');this.searchBox.dataset.mindmapInteractive='true';
  this.input=this.header.createEl('input',{cls:'ts-mindmap-query',type:'search',attr:{placeholder:'搜索本板对象标题','aria-label':'搜索本板对象'}});this.input.dataset.mindmapInteractive='true';this.header.insertBefore(this.input,this.searchButton);
  this.input.oninput=()=>{this.query=this.input.value;this.searchPage=0;this.renderSearch();};
  this.input.onkeydown=event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();this.toggleSearch(false);}else if(event.key==='Enter'&&!event.isComposing){const first=this.searchResults.querySelector<HTMLButtonElement>('.ts-mindmap-search-result');first?.click();}};
  this.searchResults=this.searchBox.createDiv('ts-mindmap-search-results');this.pins=this.shell.createDiv('ts-mindmap-pins');this.pins.dataset.mindmapInteractive='true';
  this.status=this.shell.createDiv({cls:'ts-mindmap-status',attr:{role:'status','aria-live':'polite'}});
  this.stage=this.shell.createDiv('ts-mindmap-stage');this.stage.dataset.mindmapInteractive='true';
  this.svg=this.stage.createSvg('svg',{cls:'ts-mindmap-links',attr:{'aria-hidden':'true'}});
  this.layout=this.stage.createDiv('ts-mindmap-layout');this.left=this.layout.createDiv('ts-mindmap-side');this.left.dataset.side='left';this.centerEl=this.layout.createDiv('ts-mindmap-center');this.right=this.layout.createDiv('ts-mindmap-side');this.right.dataset.side='right';
  for(const body of [this.stage,this.searchBox,this.pins]){
   this.registerDomEvent(body,'pointerdown',event=>{if(event.button===0&&!this.host.canvasGesture?.(event)){event.stopPropagation();this.host.select();}});
   this.registerDomEvent(body,'click',event=>event.stopPropagation());this.registerDomEvent(body,'dblclick',event=>event.stopPropagation());
   this.registerDomEvent(body,'keydown',event=>this.keydown(event));
   this.registerDomEvent(body,'wheel',event=>this.wheel(event),{passive:false});
  }
  this.registerDomEvent(this.stage,'scroll',()=>this.queueLines(),{capture:true,passive:true});
  this.observe();
  this.refresh();
 }
 onunload(){this.alive=false;this.generation++;this.motionEpoch++;this.closeMenu();this.motion.cancel();this.cancelFrame();this.observer?.disconnect();this.observer=undefined;for(const record of this.previews.values())this.removeChild(record.scope);this.previews.clear();this.items.clear();this.groups.clear();this.shell?.remove();}
 refresh(){
  if(!this.alive)return;this.renders++;
  const snapshot=this.host.snapshot(),state=snapshot?.container.mindmap,doc=this.el.ownerDocument;
  if(!snapshot||snapshot.container.kind!=='mindmap'||!state){this.generation++;this.closeMenu();this.cancelMotion();this.stage.hidden=true;this.status.setText('脑图容器已不可用');this.clearPreviews();return;}
  const context=snapshot.key||`${snapshot.path}\0${snapshot.container.id}`,changed=this.context!==context||this.boardPath!==snapshot.path||this.document!==doc||this.center!==state.centerId;
  const transition=changed&&this.context===context&&this.boardPath===snapshot.path&&this.document===doc&&!snapshot.container.collapsed?this.motion.capture(this.stage):undefined;
  if(changed){if(!transition)this.cancelMotion();if(this.context!==context||this.boardPath!==snapshot.path||this.document!==doc){this.clearPreviews();if(this.document&&this.document!==doc){this.cancelFrame();this.observe();}}this.closeMenu();this.generation++;this.pages={};this.context=context;this.boardPath=snapshot.path;this.document=doc;this.center=state.centerId;}
  if(!this.visible()){this.generation++;this.closeMenu();this.cancelMotion();this.cancelFrame();this.clearPreviews();return;}
  if(snapshot.container.collapsed){this.generation++;this.closeMenu();this.cancelMotion();}
  const readOnly=this.readOnly(snapshot),collapsed=!!snapshot.container.collapsed;
  this.shell.classList.toggle('is-collapsed',collapsed);this.shell.classList.toggle('is-readonly',readOnly);
  this.heading.setText(snapshot.container.title?.trim()||'脑图');this.heading.title=collapsed?`展开脑图 · ${this.nodeTitle(state.centerId,snapshot)}`:'拖动标题栏移动脑图容器';
  this.heading.onclick=collapsed?event=>{event.stopPropagation();if(!this.readOnly())this.host.fold();}:null;
  this.back.disabled=readOnly||state.history.index<=0;this.forward.disabled=readOnly||state.history.index>=state.history.entries.length-1;
  this.fold.disabled=readOnly;this.fold.title=collapsed?'展开脑图容器':'折叠脑图容器';this.fold.setAttribute('aria-label',this.fold.title);setIcon(this.fold,collapsed?'chevrons-down':'chevrons-up');
  this.searchButton.disabled=collapsed;this.searchButton.setAttribute('aria-expanded',String(this.searchVisible&&!collapsed));this.searchBox.hidden=!this.searchVisible||collapsed;this.input.hidden=this.searchBox.hidden;this.heading.hidden=!this.searchBox.hidden;this.stage.hidden=collapsed;this.pins.hidden=collapsed;
  this.renderPins(snapshot);this.renderSearch();this.rendered.clear();this.previewed.clear();
  if(collapsed){this.status.setText(this.nodeTitle(state.centerId,snapshot));this.clearPreviews();this.motion.cancel();return;}
  const native=state.centerId?snapshot.native?.(state.centerId):undefined;
  const nativeData=native&&!Array.isArray(native)?native as NativeLocalRelations:undefined;
  const neighborhood=state.centerId?localNeighborhood(snapshot.board,state.centerId,{pageSize:10,pageByKind:this.pages,nativeRelations:nativeData?.relations||native as readonly NativeLocalRelation[]|undefined}):undefined;
  const center=neighborhood?.center;
  if(center)this.reconcile(this.centerEl,[this.node(center,'center',snapshot)]);else{this.centerEl.empty();this.centerEl.createDiv({cls:'ts-mindmap-empty',text:state.centerId?'中心对象已移除或不支持脑图，请后退或搜索其他对象。':'搜索并选择本板笔记卡片、分组或子白板作为中心。'});}
  const sides:{left:HTMLElement[];right:HTMLElement[]}={left:[],right:[]};
  // Placement uses the current pages so every paged object remains reachable.
  // Descriptions retain all its roles, including evidence on another page.
  const roles=new Map<string,LocalRelationKind[]>();for(const group of neighborhood?.groups||[])for(const item of group.items){const values=roles.get(item.id)||[];values.push(group.kind);roles.set(item.id,values);}
  for(const values of roles.values())values.sort((a,b)=>rolePriority.indexOf(a)-rolePriority.indexOf(b));
  const allRoles=new Map<string,LocalRelationKind[]>();
  if(center)for(const group of localRelationMatches(snapshot.board,center.id,{nativeRelations:nativeData?.relations||native as readonly NativeLocalRelation[]|undefined}).groups)for(const item of group.items)if(roles.has(item.id)){const values=allRoles.get(item.id)||[];values.push(group.kind);allRoles.set(item.id,values);}
  for(const values of allRoles.values())values.sort((a,b)=>rolePriority.indexOf(a)-rolePriority.indexOf(b));
  for(const group of neighborhood?.groups||[]){
   const items=group.items.filter(item=>roles.get(item.id)?.[0]===group.kind);
   if(!group.total||!items.length&&group.pages<=1)continue;let el=this.groups.get(group.kind);if(!el){el=this.layout.createDiv('ts-mindmap-group');el.dataset.relationKind=group.kind;this.groups.set(group.kind,el);el.createDiv('ts-mindmap-group-heading');el.createDiv('ts-mindmap-items');el.createDiv('ts-mindmap-pagination');}
   const heading=el.querySelector<HTMLElement>('.ts-mindmap-group-heading')!;heading.setText(labels[group.kind]);heading.title=`${labels[group.kind]} · ${group.total} 个关系对象`;
   this.reconcile(el.querySelector<HTMLElement>('.ts-mindmap-items')!,items.map(item=>{const el=this.node(item,group.kind,snapshot),related=allRoles.get(item.id)||roles.get(item.id)!,description=related.map(kind=>labels[kind]).join('、');el.dataset.mindmapRoles=description;el.querySelector<HTMLElement>('.ts-mindmap-title')!.setAttribute('aria-description',`关系：${description}`);if(related.length>1)el.querySelector<HTMLElement>('.ts-mindmap-title')!.title=`${item.detail}\n关系：${description}`;return el;}));
   const pager=el.querySelector<HTMLElement>('.ts-mindmap-pagination')!;pager.empty();pager.hidden=group.pages<=1;
   if(group.pages>1){this.button(pager,'chevron-left',`${labels[group.kind]}上一页`,()=>{this.pages[group.kind]=group.page-1;this.refresh();}).disabled=!group.hasPrevious;pager.createSpan({text:`${group.page+1} / ${group.pages}`});this.button(pager,'chevron-right',`${labels[group.kind]}下一页`,()=>{this.pages[group.kind]=group.page+1;this.refresh();}).disabled=!group.hasNext;}
   sides[leftKinds.has(group.kind)?'left':'right'].push(el);
  }
  this.reconcile(this.left,sides.left);this.reconcile(this.right,sides.right);
  this.left.hidden=!sides.left.length;this.right.hidden=!sides.right.length;
  for(const [key,item]of this.items)if(!this.rendered.has(key)){this.removeChild(item.scope);item.root.remove();this.items.delete(key);}
  for(const [id,record]of this.previews)if(!this.previewed.has(id)){this.removeChild(record.scope);record.body.remove();this.previews.delete(id);}
  const missing=state.expandedIds.filter(id=>!snapshot.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node)));
  this.status.empty();this.status.setText(this.error||(readOnly?'此脑图只读':neighborhood?.invalidBranches?'父子关系无效，已隐藏无法核实的分支':nativeData?.pendingPaths.length?'原生引用索引更新中':center&&!neighborhood?.total?'此对象暂无本板关系':''));
  for(const id of missing)this.button(this.status,'x',`清理失效展开 ${id}`,()=>this.update({type:'expand',id,expanded:false})).disabled=readOnly;
  this.drawLines();if(transition){const epoch=++this.motionEpoch;this.motionActive=true;this.svg.classList.add('is-transitioning');this.motion.play(this.stage,transition,()=>{if(this.alive&&epoch===this.motionEpoch&&this.el.ownerDocument===doc){this.motionActive=false;this.svg.classList.remove('is-transitioning');this.drawLines();}});}else if(!this.motionActive)this.svg.classList.remove('is-transitioning');
 }
 private node(descriptor:LocalRelationNode,role:string,snapshot:BoardMindmapSnapshot):HTMLElement {
  const {id}=descriptor,key=`${role}:${id}`,state=snapshot.container.mindmap!;this.rendered.add(key);let item=this.items.get(key);
  if(!item){const root=this.layout.createDiv('ts-mindmap-item');root.dataset.mindmapNodeId=id;root.dataset.mindmapRole=role;const pill=root.createDiv('ts-mindmap-pill');pill.dataset.relationMotionId=id;if(role==='center')pill.dataset.relationMotionCenter='true';
   const title=this.button(pill,'',descriptor.title,()=>this.update({type:'center',id}));title.classList.add('ts-mindmap-title');const actions=pill.createDiv('ts-mindmap-node-actions');
   const expand=this.button(actions,'chevron-down','展开正文',()=>this.update({type:'expand',id}),'expand');const open=this.button(actions,'arrow-up-right','打开来源',()=>this.open(id),'open');const menu=this.button(actions,'ellipsis','对象菜单',event=>this.menu(id,event),'menu');
   const status=root.createDiv('ts-mindmap-source-status'),scope=this.addChild(new Component());item={root,scope,pill,title,expand,open,menu,status};this.items.set(key,item);
   scope.registerDomEvent(root,'contextmenu',event=>{event.preventDefault();event.stopPropagation();this.menu(id,event);});
   scope.registerDomEvent(root,'keydown',event=>{if(event.key==='F10'&&event.shiftKey||event.key==='ContextMenu'){event.preventDefault();event.stopPropagation();this.menu(id,undefined,item!.menu);}});
  }
  const source=this.source(id),expanded=state.expandedIds.includes(id),readOnly=this.readOnly(snapshot),content=this.contentLabel(descriptor.kind);item.root.classList.toggle('is-center',role==='center');item.root.classList.toggle('is-pinned',state.pins.includes(id));item.root.classList.toggle('is-expanded',expanded);item.root.dataset.kind=descriptor.kind;
  item.title.setText(descriptor.title);item.title.title=descriptor.detail;item.title.setAttribute('aria-label',`${role==='center'?'当前中心':'设为中心'}：${descriptor.title}`);item.title.disabled=readOnly;item.title.setAttribute('aria-current',role==='center'?'true':'false');
  item.expand.disabled=readOnly||!expanded&&!source.available;item.expand.title=expanded?`收起${content}`:source.available?`展开${content}`:source.reason||'来源不可用';item.expand.setAttribute('aria-label',`${expanded?'收起':'展开'}${content}：${descriptor.title}`);item.expand.setAttribute('aria-expanded',String(expanded));setIcon(item.expand,expanded?'chevron-up':'chevron-down');
  item.open.disabled=!source.available;item.open.title=source.available?this.openLabel(descriptor.kind,source):source.reason||'来源不可用';item.open.setAttribute('aria-label',item.open.title);
  item.status.setText(source.available?'':source.reason||'来源已失效');item.status.hidden=source.available;
  if(expanded&&source.available&&!this.previewed.has(id)){
   this.previewed.add(id);const stamp=JSON.stringify([source.path,source.stamp,descriptor.kind]);let preview=this.previews.get(id);
   if(preview?.stamp!==stamp){if(preview){this.removeChild(preview.scope);preview.body.remove();}const scope=this.addChild(new Component()),body=item.root.createDiv('ts-mindmap-preview');body.dataset.mindmapInteractive='true';preview={body,scope,stamp};this.previews.set(id,preview);const record=preview,doc=this.el.ownerDocument,context=this.context,path=snapshot.path,containerId=snapshot.container.id,ownerKey=snapshot.key;
    this.observer?.observe(body);scope.register(()=>this.observer?.unobserve(body));
    const current=()=>{const now=this.host.snapshot();return this.alive&&this.context===context&&this.el.ownerDocument===doc&&now?.key===ownerKey&&now?.path===path&&now?.container.id===containerId&&record===this.previews.get(id)&&record.body.isConnected&&this.visible()&&!now?.container.collapsed&&!!now?.container.mindmap?.expandedIds.includes(id)&&now.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node))&&JSON.stringify([this.source(id).path,this.source(id).stamp,descriptor.kind])===stamp;};
    try{this.host.preview(id,body,scope,current);}catch(error){if(current())body.setText(this.message(error));}
   }else if(preview.body.parentElement!==item.root)item.root.appendChild(preview.body);
  }
  return item.root;
 }
 private source(id:string):BoardMindmapSource {try{return this.host.source(id);}catch(error){return{label:'来源',available:false,reason:this.message(error)};}}
 private update(action:BoardMindmapAction){const snapshot=this.host.snapshot();if(!snapshot?.container.mindmap||this.readOnly(snapshot)||!this.visible())return;try{this.error='';const next=updateBoardMindmapState(snapshot.container.mindmap,action,snapshot.board.nodes),render=this.renders;if(JSON.stringify(next)!==JSON.stringify(snapshot.container.mindmap))this.host.change(next);if(this.renders===render)this.refresh();}catch(error){this.error=this.message(error);this.status.setText(this.error);}}
 private open(id:string,edit=false){const current=this.current(id);if(!current())return;this.error='';try{void Promise.resolve(this.host.open(id,current,edit)).catch(error=>{if(current()){this.error=this.message(error);this.status.setText(this.error);}});}catch(error){if(current()){this.error=this.message(error);this.status.setText(this.error);}}}
 private current(id:string):()=>boolean {const snapshot=this.host.snapshot(),generation=this.generation,doc=this.el.ownerDocument,win=doc.defaultView,center=snapshot?.container.mindmap?.centerId,key=snapshot?.key,path=snapshot?.path,containerId=snapshot?.container.id;let valid=true;return()=>{const now=this.host.snapshot();valid=valid&&this.alive&&generation===this.generation&&doc===this.el.ownerDocument&&doc.defaultView===win&&!!win&&!win.closed&&this.visible()&&!now?.container.collapsed&&now?.key===key&&now?.path===path&&now?.container.id===containerId&&now?.container.mindmap?.centerId===center&&!!now?.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node));return valid;};}
 private menu(id:string,event?:MouseEvent,anchor?:HTMLElement){
  const snapshot=this.host.snapshot(),node=snapshot?.board.nodes.find(node=>node.id===id&&supportsBoardMindmapTarget(node));if(!snapshot||!node)return;
  this.closeMenu();const state=snapshot.container.mindmap!,source=this.source(id),readOnly=this.readOnly(snapshot),current=this.current(id),menu=new Menu().setUseNativeMenu(false);this.activeMenu=menu;menu.onHide(()=>{if(this.activeMenu===menu)this.activeMenu=undefined;});
  const roles=[...this.items.values()].find(item=>item.root.dataset.mindmapNodeId===id)?.root.dataset.mindmapRoles;if(roles?.includes('、'))menu.addItem(item=>item.setTitle(`关系：${roles}`).setDisabled(true));
  const add=(title:string,icon:string,enabled:boolean,run:()=>unknown,reason?:string)=>menu.addItem(item=>item.setTitle(!enabled&&reason?`${title}（${reason}）`:title).setIcon(icon).setDisabled(!enabled).onClick(()=>{if(current())run();}));
  add('设为中心','focus',!readOnly,()=>this.update({type:'center',id}),readOnly?'脑图只读':undefined);add(`${state.expandedIds.includes(id)?'收起':'展开'}${this.contentLabel(node.kind)}`,'chevrons-up-down',!readOnly&&(source.available||state.expandedIds.includes(id)),()=>this.update({type:'expand',id}),readOnly?'脑图只读':source.reason);
  add(this.openLabel(node.kind,source),'arrow-up-right',source.available,()=>this.open(id),source.reason);add('编辑实际笔记','pencil',source.available&&!!source.canEdit,()=>this.open(id,true),source.available?source.editReason||'此对象没有独立笔记正文':source.reason);add(state.pins.includes(id)?'取消固定':'固定对象','pin',!readOnly,()=>this.update({type:'pin',id}),readOnly?'脑图只读':undefined);
  if(this.host.relate){menu.addSeparator();for(const [kind,title]of [['child','添加子级关系'],['parent','添加父级关系'],['associate','添加关联'],['remove','移除本板关系']] as const)add(title,kind==='remove'?'unlink':'git-branch',!readOnly,()=>{try{void Promise.resolve(this.host.relate!(id,kind,current)).catch(error=>{if(current())this.status.setText(this.message(error));});}catch(error){if(current())this.status.setText(this.message(error));}});}
  this.host.fileMenu?.(menu,id);if(event)menu.showAtMouseEvent(event);else{const rect=(anchor||this.items.get(`center:${id}`)?.menu||this.heading).getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom},this.el.ownerDocument);}
 }
 private renderPins(snapshot:BoardMindmapSnapshot){this.pins.empty();for(const id of snapshot.container.mindmap!.pins){const node=snapshot.board.nodes.find(node=>node.id===id&&supportsBoardMindmapTarget(node)),button=this.button(this.pins,'pin',node?localRelationNode(node).title:`已移除：${id}`,()=>node?this.update({type:'center',id}):this.update({type:'pin',id,pinned:false}));button.createSpan({text:node?localRelationNode(node).title:'清理失效固定'});button.disabled=this.readOnly(snapshot);button.dataset.mindmapPinnedId=id;}this.pins.hidden=!!snapshot.container.collapsed||!snapshot.container.mindmap!.pins.length;}
 private toggleSearch(force?:boolean){this.searchVisible=force??!this.searchVisible;const active=this.el.ownerDocument.activeElement;if(!this.searchVisible&&(active===this.input||this.searchBox.contains(active))&&this.visible())this.searchButton.focus({preventScroll:true});this.searchBox.hidden=!this.searchVisible;this.input.hidden=!this.searchVisible;this.heading.hidden=this.searchVisible;this.searchButton.setAttribute('aria-expanded',String(this.searchVisible));this.renderSearch();if(this.searchVisible&&this.visible())this.input.focus();}
 private renderSearch(){if(!this.alive||!this.searchResults)return;this.searchResults.empty();if(!this.searchVisible)return;const snapshot=this.host.snapshot();if(!snapshot)return;const found=searchLocalCenters(snapshot.board,this.query,{page:this.searchPage,pageSize:10,queryField:'title'});this.searchResults.createDiv({cls:'ts-mindmap-search-count',text:`${found.matched} 个对象`});for(const node of found.items){const button=this.button(this.searchResults,'',node.title,()=>this.update({type:'center',id:node.id}));button.classList.add('ts-mindmap-search-result');button.setText(node.title);button.title=node.detail;button.disabled=this.readOnly(snapshot);}if(found.pages>1){const pager=this.searchResults.createDiv('ts-mindmap-pagination');this.button(pager,'chevron-left','搜索上一页',()=>{this.searchPage=found.page-1;this.renderSearch();}).disabled=found.page===0;pager.createSpan({text:`${found.page+1} / ${found.pages}`});this.button(pager,'chevron-right','搜索下一页',()=>{this.searchPage=found.page+1;this.renderSearch();}).disabled=found.page===found.pages-1;}}
 private button(parent:HTMLElement,icon:string,label:string,run:(event:MouseEvent)=>unknown,action?:string):HTMLButtonElement {const button=parent.createEl('button',{cls:'clickable-icon',attr:{type:'button','aria-label':label,title:label}});button.dataset.mindmapInteractive='true';if(action)button.dataset.mindmapAction=action;if(icon)setIcon(button,icon);button.onclick=event=>{event.stopPropagation();this.host.select();run(event);};button.onpointerdown=event=>{if(event.button===0&&!this.host.canvasGesture?.(event))event.stopPropagation();};return button;}
 private contentLabel(kind:Card['kind']){return kind==='section'?'分组内容':kind==='board'?'子白板概览':'正文';}
 private openLabel(kind:Card['kind'],source:BoardMindmapSource){return kind==='section'?'定位原分组':/^(打开|定位)/.test(source.label)?source.label:`打开 ${source.label}`;}
 private closeMenu(){const menu=this.activeMenu;this.activeMenu=undefined;try{menu?.hide();}catch{/* A closing owner window can already have detached its menu. */}}
 private keydown(event:KeyboardEvent){const target=event.target as HTMLElement|null,editing=!!target?.closest('input, textarea, select, [contenteditable="true"]');if(!editing&&!event.isComposing&&this.host.shortcut?.(event)){event.preventDefault();event.stopPropagation();return;}if(!editing&&(event.ctrlKey||event.metaKey)&&/^[zy]$/i.test(event.key))return;if(!editing&&event.key===' '&&!target?.closest('button'))return;event.stopPropagation();}
 private observe(){this.observer?.disconnect();this.observer=undefined;const win=this.el.ownerDocument.defaultView as (Window&{ResizeObserver?:typeof ResizeObserver})|null;if(win?.ResizeObserver){this.observer=new win.ResizeObserver(()=>this.queueLines());this.observer.observe(this.stage);this.observer.observe(this.layout);}}
 private cancelMotion(){this.motionEpoch++;this.motionActive=false;this.motion.cancel();this.svg?.classList.remove('is-transitioning');}
 private readOnly(snapshot=this.host.snapshot()){return !snapshot||!!snapshot.readOnly||!!snapshot.container.locked;}
 private nodeTitle(id:string|undefined,snapshot:BoardMindmapSnapshot){const node=snapshot.board.nodes.find(node=>node.id===id&&supportsBoardMindmapTarget(node));return node?localRelationNode(node).title:id?'中心对象已移除':'尚未选择中心';}
 private visible(){const win=this.el.ownerDocument.defaultView;return this.alive&&this.el.isConnected&&this.el.getClientRects().length>0&&!!win&&!win.closed;}
 private message(error:unknown){return error instanceof Error?error.message:String(error);}
 private reconcile(parent:HTMLElement,children:HTMLElement[]){for(let i=0;i<children.length;i++)if(parent.children[i]!==children[i])parent.insertBefore(children[i],parent.children[i]||null);for(const child of Array.from(parent.children))if(!children.includes(child as HTMLElement))child.remove();}
 private clearPreviews(){for(const record of this.previews.values()){this.removeChild(record.scope);record.body.remove();}this.previews.clear();}
 private wheel(event:WheelEvent){if(event.ctrlKey||event.metaKey)return;let node=event.target as HTMLElement|null;if(this.searchBox.contains(node)){event.stopPropagation();return;}const dy=event.deltaY,dx=event.deltaX;while(node&&this.shell.contains(node)){if(dy<0&&node.scrollTop>0||dy>0&&node.scrollTop+node.clientHeight<node.scrollHeight-1||dx<0&&node.scrollLeft>0||dx>0&&node.scrollLeft+node.clientWidth<node.scrollWidth-1){event.stopPropagation();return;}node=node.parentElement;}}
 private cancelFrame(){if(this.frame&&this.frameWindow){try{this.frameWindow.cancelAnimationFrame(this.frame);}catch{/* Popout already closed. */}}this.frame=0;this.frameWindow=undefined;}
 private queueLines(){const win=this.el.ownerDocument.defaultView;if(this.frameWindow&&this.frameWindow!==win)this.cancelFrame();if(this.frame||!win||win.closed||!this.alive)return;this.frameWindow=win;const id=win.requestAnimationFrame(()=>{if(this.frame!==id||this.frameWindow!==win)return;this.frame=0;this.frameWindow=undefined;if(this.alive&&this.el.ownerDocument.defaultView===win)this.drawLines();});this.frame=id;}
 private drawLines(){
  if(!this.alive||this.stage.hidden||!this.visible())return;this.svg.replaceChildren();const center=this.centerEl.querySelector<HTMLElement>('.ts-mindmap-pill');if(!center)return;
  const stage=this.stage.getBoundingClientRect(),scale=stage.width/(this.stage.clientWidth||stage.width);if(!Number.isFinite(scale)||scale<=0)return;
  const width=Math.max(this.stage.clientWidth,this.stage.scrollWidth),height=Math.max(this.stage.clientHeight,this.stage.scrollHeight);this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);this.svg.setAttribute('width',String(width));this.svg.setAttribute('height',String(height));
  const point=(el:HTMLElement,side:'left'|'right')=>{const rect=el.getBoundingClientRect();return{x:((side==='left'?rect.left:rect.right)-stage.left)/scale+this.stage.scrollLeft,y:(rect.top+rect.height/2-stage.top)/scale+this.stage.scrollTop};};
  for(const side of [this.left,this.right])for(const pill of Array.from(side.querySelectorAll<HTMLElement>('.ts-mindmap-pill'))){if(!pill.getClientRects().length)continue;const left=side===this.left,a=point(center,left?'left':'right'),b=point(pill,left?'right':'left'),mid=(a.x+b.x)/2;this.svg.createSvg('path',{attr:{d:`M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`}});}
 }
}
