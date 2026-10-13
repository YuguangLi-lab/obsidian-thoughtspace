import {bindBoardHostInset} from './board-chrome';
import {renderBoardSaveFeedback,type BoardSaveFeedback,type BoardSaveFeedbackAction} from './board-save-feedback';
import {BrainBranchIndex,BrainDescendantPager,type BrainDescendantPage} from './brain-board-descendants';
import {Component,Menu,setIcon,type App,type MenuItem} from 'obsidian';
import type {Board,Card} from './model';
import {createBoardMindmapState,updateBoardMindmapState,supportsBoardMindmapTarget,type BoardMindmapAction,type BoardMindmapState} from './board-mindmap';
import type {BoardMindmapHost,BoardMindmapSource} from './board-mindmap-view';
import {localRelationNode,searchLocalCenters,type LocalRelationNode,type LocalRelationKind} from './local-relations';
import type {NativeLocalRelation,NativeLocalRelations} from './local-relations-native';
import {brainBoardLayout,brainBoardDescendantLayout,type BrainBoardLayout} from './brain-board-layout';
import {BrainRefreshCache} from './brain-refresh-cache';
import {LocalRelationMotion} from './local-relations-motion';
import {brainRelationLabels,type BrainRelationSide} from './brain-board-create';
import type {BrainRelationCommandTarget} from './brain-relation-commands';
import {cleanBrainColors,brainColorsStamp,brainStateInk,type BrainColors} from './brain-colors';
import {captureBrainReadingPosition,type BrainReadingPositionState} from './brain-reading-positions';

export interface BrainBoardSnapshot {board:Board;path:string;key?:object;readOnly?:boolean;saveFeedback?:BoardSaveFeedback;graphRevision?:number;nativeRevision?:number;native?:(id:string)=>NativeLocalRelations|readonly NativeLocalRelation[];}
export interface BrainBoardViewportIntent {key?:object;path:string;board:Board;value:{x:number;y:number;zoom:number};}
export interface BrainBoardHost {
 container?:HTMLElement;
 saveFeedbackAction?:(action:BoardSaveFeedbackAction)=>void;
 snapshot:()=>BrainBoardSnapshot|undefined;change:(next:BoardMindmapState)=>void;
 source:BoardMindmapHost['source'];open:BoardMindmapHost['open'];preview:BoardMindmapHost['preview'];
 fileMenu?:BoardMindmapHost['fileMenu'];relate?:BoardMindmapHost['relate'];shortcut?:BoardMindmapHost['shortcut'];
 add:()=>void;addObject?:(kind:'section'|'board')=>void;rename?:()=>void;settings?:()=>void;isActive?:()=>boolean;activate?:()=>void;viewport?:(value:{x:number;y:number;zoom:number})=>void;
 background?:(anchor:HTMLElement)=>void;colors?:()=>void;nativeProperties?:()=>unknown;
 readingPositions?:(current:()=>boolean)=>void;
 /** Notify real departure synchronously; returning to the leaf cannot revive issued leases. */
 subscribeNavigation?:(invalidate:()=>void)=>(()=>void);
 organizeIdea?:(id:string,current:()=>boolean)=>void;
 associateExisting?:(id:string,current:()=>boolean)=>void;
 renameNode?:(id:string,current:()=>boolean)=>void;
 finalizeViewport?:(intent:BrainBoardViewportIntent)=>void;
 createRelation?:(id:string,side:BrainRelationSide,current:()=>boolean,initial?:'board')=>unknown;
}
interface NodeElement {root:HTMLElement;pill:HTMLElement;title:HTMLButtonElement;label:HTMLElement;status:HTMLElement;scope:Component;}
interface SelectionControls {root:HTMLElement;name:HTMLElement;center:HTMLButtonElement;expand:HTMLButtonElement;open:HTMLButtonElement;menu:HTMLButtonElement;relations:HTMLElement;relationsToggle:HTMLButtonElement;anchors:HTMLButtonElement[];expandIcon?:string;}
interface Preview {body:HTMLElement;scope:Component;stamp:string;}
const roleLabels:Record<LocalRelationKind,string>={parents:'上级',children:'下级',siblings:'同级',associated:'关联',incoming:'引用此对象',outgoing:'此对象引用'};
let brainSvgSequence=0;
const clampZoom=(value:number)=>Math.max(.15,Math.min(2.5,value));
/** A separate, full-canvas projection. Node coordinates and native sources are never
 * written by rendering, searching, resizing or previewing. Only explicit intents save. */
export class BrainBoardView extends Component {
 private readonly markerId=`ts-brain-arrow-${++brainSvgSequence}`;
 private alive=false;private generation=0;private renders=0;private nodeSequence=0;private context?:object|string;private boardPath?:string;private document?:Document;private center?:string;private error='';
 private shell!:HTMLElement;private topbar!:HTMLElement;private title!:HTMLElement;private stage!:HTMLElement;private scene!:HTMLElement;private svg!:SVGSVGElement;private labels!:HTMLElement;private empty!:HTMLElement;private status!:HTMLElement;private recent!:HTMLElement;private pager!:HTMLElement;
 private input!:HTMLInputElement;private search!:HTMLElement;private searchResults!:HTMLElement;private back!:HTMLButtonElement;private forward!:HTMLButtonElement;private more!:HTMLButtonElement;private colorButton?:HTMLButtonElement;private zoomLabel!:HTMLButtonElement;
 private footer!:HTMLElement;private historyButton!:HTMLButtonElement;private zoom!:HTMLElement;private stopHostInset?:()=>void;
 private searchVisible=false;private query='';private searchPage=0;private searchIndex=0;private searchIds:string[]=[];private page=0;private layout?:ReturnType<typeof brainBoardLayout>;private nativePending=false;private composing=false;private compositionDocument?:Document;private compositionScope?:Component;
 private searchRender?:{key?:object;path:string;doc:Document;signature:string};
 private revealId?:string;
 private activeNodeId?:string;private selectionEpoch=0;private selection!:SelectionControls;
 private branchCache?:{board:Board;revision?:number;fallback?:string;index:BrainBranchIndex};private descendants?:BrainDescendantPager;private descendantPage?:BrainDescendantPage;
 private nodes=new Map<string,NodeElement>();private previews=new Map<string,Preview>();private activeMenu?:Menu;private observer?:ResizeObserver;
 private camera={x:0,y:0,zoom:1};private cameraReady=false;private cameraStored='';private cameraBoard?:Board;private fitCamera=true;private fitAll=false;private viewportTimer=0;private viewportWindow?:Window;private viewportIntent?:BrainBoardViewportIntent;
 private readonly motion=new LocalRelationMotion(true);
 private stageSize={width:0,height:0};private paneSize={width:0,height:0};
 private readonly refreshCache=new BrainRefreshCache();
 private projection?:{resolved:ReturnType<BrainRefreshCache['resolve']>;page?:BrainDescendantPage;stamp:string;layout:BrainBoardLayout};
 private statusHint='';
 private paintStamp='';private historyStamp='';private transformStamp='';
 private refreshSources?:Map<string,BoardMindmapSource>;
 private colorPreview?:{key:object|string;path:string;stamp:string;value:BrainColors};
 private colorFrame=0;private colorWindow?:Window;
 private touchPoints=new Map<number,{x:number;y:number}>();private touchMoved=false;private pinch?:{x:number;y:number;distance:number;camera:{x:number;y:number;zoom:number}};
 private resizeFrame=0;private resizeWindow?:Window;private cameraFrame=0;private cameraWindow?:Window;private pan?:{id:number;x:number;y:number;startX:number;startY:number;moved:boolean};
 constructor(_app:App,private readonly el:HTMLElement,private readonly host:BrainBoardHost){super();}
 onload(){
  this.alive=true;this.shell=this.el.createDiv({cls:'ts-brain-shell',attr:{tabindex:'0','aria-label':'脑图白板'}});this.topbar=this.shell.createDiv('ts-brain-topbar');
  const brand=this.topbar.createDiv('ts-brain-brand'),icon=brand.createSpan('ts-brain-brand-icon');setIcon(icon,'network');this.title=brand.createSpan({text:'脑图白板'});
  const navigation=this.topbar.createDiv('ts-brain-navigation');this.back=this.button(navigation,'arrow-left','后退',()=>{this.update({type:'history',direction:'back'});this.focusNode();},'back');this.forward=this.button(navigation,'arrow-right','前进',()=>{this.update({type:'history',direction:'forward'});this.focusNode();},'forward');
  this.search=this.topbar.createDiv('ts-brain-search');setIcon(this.search.createSpan('ts-brain-search-icon'),'search');this.input=this.search.createEl('input',{cls:'ts-brain-query',type:'search',attr:{placeholder:'搜索节点…','aria-label':'搜索本板节点',role:'combobox','aria-autocomplete':'list','aria-expanded':'false'}});this.search.createSpan({cls:'ts-brain-search-shortcut',text:'⌘K / Ctrl K'});
  this.searchResults=this.search.createDiv({cls:'ts-brain-search-results',attr:{id:`${this.markerId}-search-panel`,role:'group','aria-label':'节点搜索结果'}});this.searchResults.hidden=true;this.input.setAttribute('aria-controls',`${this.markerId}-search`);
  this.registerDomEvent(this.input,'focus',()=>this.toggleSearch(true));this.registerDomEvent(this.input,'input',()=>{this.query=this.input.value;this.searchPage=0;this.searchIndex=0;this.toggleSearch(true);});this.registerDomEvent(this.input,'keydown',event=>this.searchKey(event));
  this.registerDomEvent(this.search,'focusout',event=>{const next=event.relatedTarget as Node|null;if(!next||next.ownerDocument!==this.search.ownerDocument||!this.search.contains(next))this.toggleSearch(false);});
  const actions=this.topbar.createDiv('ts-brain-top-actions');if(this.host.colors){this.colorButton=this.button(actions,'palette','脑图配色',()=>this.openColors(),'colors');this.colorButton.setAttribute('aria-haspopup','dialog');}this.more=this.button(actions,'ellipsis','脑图菜单',event=>this.boardMenu(event),'more');this.more.setAttribute('aria-haspopup','menu');this.button(actions,'settings-2','脑图设置',()=>{if(this.host.settings)this.host.settings();else this.boardMenu(undefined);},'settings');
  this.stage=this.shell.createDiv({cls:'ts-brain-stage',attr:{'aria-label':'节点关系图'}});this.stage.createDiv({cls:'ts-brain-pan-surface',attr:{'aria-hidden':'true'}});this.scene=this.stage.createDiv('ts-brain-scene');this.svg=this.scene.createSvg('svg',{cls:'ts-brain-links',attr:{'aria-hidden':'true'}});this.labels=this.scene.createDiv('ts-brain-labels');this.empty=this.stage.createDiv('ts-brain-empty');
  this.status=this.stage.createDiv({cls:'ts-brain-status',attr:{role:'status','aria-live':'polite'}});this.pager=this.stage.createDiv('ts-brain-pager');
  const zoom=this.zoom=this.stage.createDiv('ts-brain-zoom');if(this.host.background)this.button(zoom,'palette','白板背景',event=>this.host.background?.(event.currentTarget as HTMLElement),'background');this.button(zoom,'layers','关系显示层级',()=>this.showDepthMenu(),'depth');zoom.createSpan({cls:'ts-brain-object-count'});this.button(zoom,'minus','缩小',()=>this.zoomAt(this.camera.zoom/1.2),'zoom-out');this.zoomLabel=this.button(zoom,'','恢复 100% 缩放',()=>this.zoomAt(1),'zoom-reset');this.button(zoom,'plus','放大',()=>this.zoomAt(this.camera.zoom*1.2),'zoom-in');this.button(zoom,'maximize','适应画布',()=>this.fitToCanvas(),'fit');this.button(zoom,'search','节点导航',()=>this.focusSearch(),'navigate');
  this.createSelectionControls();
  this.footer=this.shell.createDiv({cls:'ts-brain-footer',attr:{id:`${this.markerId}-history`,role:'region','aria-label':'最近浏览'}});this.footer.hidden=true;this.recent=this.footer.createDiv('ts-brain-recent');
  const controls=this.shell.createDiv('ts-brain-controls');this.historyButton=this.button(controls,'history','最近浏览',event=>this.toggleHistory(this.footer.hidden,event.detail===0),'history');this.historyButton.setAttribute('aria-controls',`${this.markerId}-history`);this.historyButton.setAttribute('aria-expanded','false');controls.appendChild(this.pager);controls.appendChild(zoom);
  this.registerDomEvent(this.shell,'keydown',event=>this.keydown(event));this.registerDomEvent(this.shell,'dblclick',event=>{if(!(event.target as HTMLElement)?.closest('.ts-brain-preview'))event.stopPropagation();});this.registerDomEvent(this.shell,'click',event=>{if(!(event.target as HTMLElement)?.closest('.ts-brain-preview'))event.stopPropagation();});
  this.registerDomEvent(this.shell,'pointerdown',event=>{if(event.isTrusted)this.host.activate?.();if(!(event.target as HTMLElement)?.closest('.ts-brain-preview'))event.stopPropagation();if(!this.search.contains(event.target as Node))this.toggleSearch(false);});
  this.registerDomEvent(this.stage,'pointerdown',event=>this.pointerDown(event));this.registerDomEvent(this.stage,'pointermove',event=>this.pointerMove(event));this.registerDomEvent(this.stage,'pointerup',event=>this.pointerEnd(event));this.registerDomEvent(this.stage,'pointercancel',event=>this.pointerEnd(event));this.registerDomEvent(this.stage,'lostpointercapture',event=>this.pointerEnd(event));
  this.registerDomEvent(this.stage,'wheel',event=>this.wheel(event),{passive:false});this.registerDomEvent(this.searchResults,'wheel',event=>event.stopPropagation(),{passive:true});this.registerDomEvent(this.recent,'wheel',event=>event.stopPropagation(),{passive:true});
  const unsubscribe=this.host.subscribeNavigation?.(()=>{if(this.alive){this.selectionEpoch++;this.closeMenu();}});if(unsubscribe)this.register(unsubscribe);
  this.observe();this.refresh();
 }
 onunload(){this.cancelPointers(true);this.motion.cancel();this.cancelCameraFrame();this.cancelColorFrame();this.colorPreview=undefined;this.alive=false;this.finalizeViewport();this.generation++;this.closeMenu();this.cancelResize();this.observer?.disconnect();this.observer=undefined;this.stopHostInset?.();this.stopHostInset=undefined;this.clearPreviews();for(const item of this.nodes.values())this.removeChild(item.scope);this.nodes.clear();this.branchCache=undefined;this.descendants=undefined;this.descendantPage=undefined;this.refreshCache.clear();this.projection=undefined;this.layout=undefined;this.refreshSources=undefined;this.transformLayout=undefined;this.shell?.remove();}
 refresh(){
  if(!this.alive)return;this.trackCommandComposition();this.cancelCameraFrame();this.cancelColorFrame();this.renders++;const snapshot=this.host.snapshot(),doc=this.el.ownerDocument;
  if(!snapshot||snapshot.board.presentation!=='brain'){this.cancelPointers();this.motion.cancel();this.generation++;this.closeMenu();this.clearPreviews();this.searchRender=undefined;this.refreshCache.clear();this.projection=undefined;this.paintStamp='';this.stage.hidden=true;this.activeNodeId=undefined;this.selectionEpoch++;this.selection.root.hidden=true;return;}
  this.stage.hidden=false;const state=snapshot.board.brain||createBoardMindmapState(),context=snapshot.key||snapshot.path,ownerChanged=this.context!==context||this.boardPath!==snapshot.path||this.document!==doc,centerChanged=this.center!==state.centerId;
  if(this.colorPreview&&(snapshot.readOnly||this.colorPreview.key!==context||this.colorPreview.path!==snapshot.path||this.colorPreview.stamp!==brainColorsStamp(snapshot.board.brainColors)))this.colorPreview=undefined;
  const motion= centerChanged&&!ownerChanged?this.motion.capture(this.scene):undefined;if(ownerChanged)this.motion.cancel();
  if(ownerChanged||centerChanged){this.toggleRelations(false);if(ownerChanged)this.toggleHistory(false);this.cancelPointers();this.generation++;this.closeMenu();this.page=0;if(ownerChanged){this.searchRender=undefined;this.clearPreviews();this.cancelViewport();this.cameraReady=false;this.fitCamera=true;this.fitAll=false;if(this.document!==doc){this.cancelResize();this.observe();}}this.context=context;this.boardPath=snapshot.path;this.document=doc;this.center=state.centerId;this.activeNodeId=state.centerId;this.selectionEpoch++;this.error='';}
  // Re-read saved cameras after an owner rename, undo or external replacement.
  if(ownerChanged||this.cameraBoard!==snapshot.board){this.cancelViewport();this.cancelPointers();this.cameraBoard=snapshot.board;this.cameraStored='';}
  if(!this.visible()){this.cancelPointers(true);this.motion.cancel();this.generation++;this.selectionEpoch++;this.closeMenu();this.clearPreviews();return;}
  // Read the viewport before history, SVG and node writes; fit shares this one refresh snapshot.
  const pane=this.host.container??this.el,previousPane=this.paneSize,paneSize={width:pane.clientWidth,height:pane.clientHeight},paneResized=previousPane.width>0&&previousPane.height>0&&(previousPane.width!==paneSize.width||previousPane.height!==paneSize.height);this.paneSize=paneSize;
  const previousSize=this.stageSize,stageSize={width:this.stage.clientWidth,height:this.stage.clientHeight},resized=previousSize.width>0&&previousSize.height>0&&(previousSize.width!==stageSize.width||previousSize.height!==stageSize.height);
  if(resized)this.cancelPointers(true);this.stageSize=stageSize;
  this.title.title=snapshot.path;this.shell.classList.toggle('is-readonly',!!snapshot.readOnly);this.back.disabled=!!snapshot.readOnly||state.history.index<=0;this.forward.disabled=!!snapshot.readOnly||state.history.index>=state.history.entries.length-1;if(this.colorButton)this.colorButton.disabled=!!snapshot.readOnly;
  const stored=JSON.stringify(snapshot.board.brainViewport);let restoredCamera=false;if(!this.viewportIntent&&stored!==this.cameraStored){this.cameraStored=stored;const viewport=snapshot.board.brainViewport;if(viewport){this.camera={...viewport,zoom:clampZoom(viewport.zoom)};this.cameraReady=true;this.fitCamera=false;restoredCamera=true;}else{this.cameraReady=false;this.fitCamera=true;this.fitAll=false;}}
  this.renderSearch();
  const resolved=this.refreshCache.resolve(snapshot,state.centerId||''),matches=resolved.matches;this.nativePending=resolved.nativePending;
  const depth=state.descendantDepth??1;
  const branchFallback=snapshot.graphRevision===undefined?JSON.stringify([snapshot.board.nodes,snapshot.board.edges]):undefined;
  if(!this.branchCache||this.branchCache.fallback!==branchFallback||this.branchCache.board.nodes!==snapshot.board.nodes||this.branchCache.board.edges!==snapshot.board.edges||this.branchCache.revision!==snapshot.graphRevision){this.branchCache={board:snapshot.board,revision:snapshot.graphRevision,fallback:branchFallback,index:new BrainBranchIndex(snapshot.board)};this.descendants=undefined;}
  if(ownerChanged||centerChanged||this.descendants?.depth!==depth)this.descendants=undefined;
  if(depth>1){this.descendants??=new BrainDescendantPager(this.branchCache.index,state.centerId||'',depth);this.descendantPage=this.descendants.current;}else this.descendantPage=undefined;
  this.refreshSources=new Map();const expandedIds=state.expandedIds.filter(id=>this.source(id).available),projectionStamp=JSON.stringify([stageSize,depth,this.page,expandedIds,this.revealId]);
  const previousLayout=this.layout,previous=this.projection;
  if(previous&&previous.resolved===resolved&&previous.page===this.descendantPage&&previous.stamp===projectionStamp)this.layout=previous.layout;
  else{this.layout=brainBoardLayout(matches,{width:depth>1?Math.max(1900,stageSize.width):stageSize.width||1600,height:stageSize.height||870,page:this.page,pageSize:18,expandedIds,associationSides:resolved.sides,revealId:this.revealId});if(this.descendantPage)this.layout=brainBoardDescendantLayout(this.layout,this.descendantPage,expandedIds);this.projection={resolved,page:this.descendantPage,stamp:projectionStamp,layout:this.layout};}
  // The native header and pager reflow inside the owning leaf container. Only
  // an actual leaf resize may compensate an already restored camera.
  if(resized&&paneResized&&!restoredCamera&&!ownerChanged&&!centerChanged&&this.cameraReady&&!this.fitCamera&&previousLayout)this.preserveResizeCamera(previousLayout,previousSize,stageSize);
  this.revealId=undefined;this.page=this.layout.page;
  this.statusHint=matches.invalidBranches?'父子关系无效，已隐藏无法核实的分支':this.nativePending?'原生引用索引更新中':'';this.refreshSaveFeedback(snapshot);
  const paintStamp=JSON.stringify([state,!!snapshot.readOnly,snapshot.nativeRevision,snapshot.path,brainColorsStamp(snapshot.board.brainColors),this.colorPreview?.value,this.error]);
  if(!ownerChanged&&previousLayout===this.layout&&this.paintStamp===paintStamp){this.renderSelection(snapshot,state);this.refreshSources=undefined;if(!this.cameraReady||this.fitCamera)this.fit(stageSize);else this.transform();return;}
  this.paintStamp=paintStamp;const historyStamp=JSON.stringify([state.history,state.centerId,!!snapshot.readOnly,snapshot.graphRevision,snapshot.path]);if(ownerChanged||snapshot.graphRevision===undefined||historyStamp!==this.historyStamp){this.historyStamp=historyStamp;this.renderHistory(snapshot,state);}
  this.shell.querySelector('.ts-brain-object-count')?.setText(`${snapshot.board.nodes.length} 个对象`);
  if(!centerChanged&&this.motion.active&&JSON.stringify(previousLayout?.nodes)!==JSON.stringify(this.layout.nodes))this.motion.cancel();
  if(ownerChanged||previousLayout!==this.layout){
  this.scene.style.width=`${this.layout.width}px`;this.scene.style.height=`${this.layout.height}px`;this.svg.setAttribute('width',String(this.layout.width));this.svg.setAttribute('height',String(this.layout.height));this.svg.setAttribute('viewBox',`0 0 ${this.layout.width} ${this.layout.height}`);this.svg.dataset.relationMotionId=`brain-links-${state.centerId||'empty'}`;this.labels.dataset.relationMotionId=`brain-labels-${state.centerId||'empty'}`;this.svg.replaceChildren();
  const defs=this.svg.createSvg('defs'),marker=defs.createSvg('marker',{attr:{id:this.markerId,viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'6',markerHeight:'6',orient:'auto-start-reverse'}});marker.createSvg('path',{attr:{d:'M 1 1 L 9 5 L 1 9 Z'}});
  for(const link of this.layout.links){const path=this.svg.createSvg('path',{cls:link.dashed?'is-associated':'',attr:{d:link.path,'data-brain-from':link.from,'data-brain-to':link.to,'data-brain-role':link.role,'data-brain-edge-ids':JSON.stringify(link.edgeIds||[]),'data-brain-direction':link.direction||''}});if(link.direction==='both')path.setAttribute('marker-start',`url(#${this.markerId})`);if(link.direction==='both'||link.direction==='forward'||link.role==='incoming'||link.role==='outgoing')path.setAttribute('marker-end',`url(#${this.markerId})`);}
  this.labels.empty();for(const label of this.layout.labels){const el=this.labels.createSpan({text:label.text});if(/^下级 · 第 [1-5] 层$/.test(label.text))el.dataset.brainLabelAlign='end';el.style.left=`${label.x}px`;el.style.top=`${label.y}px`;}
  }
  const descriptors=new Map<string,LocalRelationNode>();for(const id of this.descendantPage?.ids||[]){const node=this.branchCache?.index.nodes.get(id);if(node)descriptors.set(id,localRelationNode(node));}if(matches.center)descriptors.set(matches.center.id,matches.center);const roles=new Map<string,string[]>();for(const group of matches.groups)for(const item of group.items){descriptors.set(item.id,item);const values=roles.get(item.id)||[];values.push(roleLabels[group.kind]);roles.set(item.id,values);}
  const visible=new Set<string>();for(const position of this.layout.nodes){const descriptor=descriptors.get(position.id);if(!descriptor)continue;visible.add(position.id);const item=this.node(descriptor,position.role,snapshot,state,roles.get(position.id)||[]);if(position.depth!==undefined){item.root.dataset.brainDepth=String(position.depth);item.title.setAttribute('aria-description',`距中心 ${position.depth} 跳关系`);}else delete item.root.dataset.brainDepth;item.root.style.left=`${position.x}px`;item.root.style.top=`${position.y}px`;item.root.style.width=`${position.width}px`;item.pill.style.height=`${position.height}px`;const previewWidth=position.previewWidth?`${position.previewWidth}px`:'';if(item.root.style.getPropertyValue('--brain-preview-width')!==previewWidth)item.root.style.setProperty('--brain-preview-width',previewWidth);}
  for(const [id,item]of this.nodes)if(!visible.has(id)){this.dropPreview(id);this.removeChild(item.scope);item.root.remove();this.nodes.delete(id);}
  for(const [id]of this.previews)if(!visible.has(id)||!state.expandedIds.includes(id)||!this.source(id).available)this.dropPreview(id);
  this.empty.hidden=!!matches.center;if(!matches.center){this.empty.empty();setIcon(this.empty.createDiv('ts-brain-empty-icon'),'network');this.empty.createEl('h3',{text:state.centerId?'中心节点已移除':'从已有知识开始'});this.empty.createEl('p',{text:state.centerId?'后退或搜索本板节点，继续浏览。':'引用仓库中的笔记或子白板，也可新建笔记与分组；第一个节点将成为中心。'});const label=state.centerId?'添加节点':'添加知识节点',button=this.button(this.empty,'plus',label,()=>this.host.add(),'add');button.createSpan({text:label});button.disabled=!!snapshot.readOnly;}
  this.refreshSaveFeedback(snapshot);this.pager.empty();this.pager.hidden=this.layout.pages<=1&&!this.descendantPage;if(this.layout.pages>1){this.button(this.pager,'chevron-left','上一页关系',()=>{this.page--;this.refresh();},'previous-page').disabled=this.layout.page===0;this.pager.createSpan({text:`${this.layout.page+1} / ${this.layout.pages} · ${this.layout.total} 个关系节点`});this.button(this.pager,'chevron-right','下一页关系',()=>{this.page++;this.refresh();},'next-page').disabled=this.layout.page===this.layout.pages-1;}
  if(this.descendantPage){
   const page=this.descendantPage,paged=page.hasNext||page.page>0;
   this.pager.createSpan({text:`关系 ${depth} 层${paged?` · 第 ${page.page+1} 段`:''} · 显示 ${this.layout.nodes.length}/${this.branchCache.index.nodes.size} 个节点`});
   if(paged){this.button(this.pager,'chevron-left','上一段关系',()=>this.pageDescendants('previous'),'previous-branches').disabled=page.page===page.firstPage;this.button(this.pager,'chevron-right','继续浏览关系',()=>this.pageDescendants('next'),'next-branches').disabled=!page.hasNext;if(page.page>0)this.button(this.pager,'rotate-ccw','返回首段关系',()=>this.pageDescendants('reset'),'reset-branches');}
  }
  if(!this.activeNodeId||!visible.has(this.activeNodeId)){this.activeNodeId=visible.has(state.centerId||'')?state.centerId:undefined;this.selectionEpoch++;this.closeMenu();}
  this.renderSelection(snapshot,state);
  this.applyColors(this.colorPreview?.value??snapshot.board.brainColors);
  if(!this.cameraReady||this.fitCamera)this.fit(stageSize);else this.transform();
  if(motion)this.motion.play(this.scene,motion);
  this.refreshSources=undefined;
 }
 /** Save acknowledgements update this status alone, preserving graph and camera DOM. */
 refreshSaveFeedback(snapshot=this.host.snapshot()){
  if(!this.alive||!snapshot||!this.status)return;
  const supplied=snapshot.saveFeedback,feedback:BoardSaveFeedback=supplied&&supplied.state!=='saved'?{...supplied,detail:[supplied.detail,this.error].filter(Boolean).join(' · ')||undefined}:{state:this.error?'error':snapshot.readOnly?'paused':'saved',text:this.error||(snapshot.readOnly?'此脑图只读':this.statusHint)};
  const key=snapshot.key,path=snapshot.path;
  renderBoardSaveFeedback(this.status,feedback,action=>{const live=this.host.snapshot();if(!this.visible()||!live||live.key!==key||live.path!==path||live.saveFeedback?.action?.kind!==action)return;this.host.saveFeedbackAction?.(action);});
  this.status.hidden=!feedback.text;
 }
 /** Draft paint only: no projection, source rendering, history or camera writes. */
 previewColors(value:BrainColors|null){
  const snapshot=this.host.snapshot();if(!this.alive||!snapshot)return;
  if(value!==null&&snapshot.readOnly)return;
  this.colorPreview=value===null?undefined:{key:snapshot.key||snapshot.path,path:snapshot.path,stamp:brainColorsStamp(snapshot.board.brainColors),value:cleanBrainColors(value)};
  if(value===null){this.cancelColorFrame();this.applyColors(snapshot.board.brainColors);return;}
  const win=this.el.ownerDocument.defaultView;if(!win||this.colorFrame)return;
  this.colorWindow=win;this.colorFrame=win.requestAnimationFrame(()=>{this.colorFrame=0;this.colorWindow=undefined;const current=this.host.snapshot();if(!this.alive||!current)return;const preview=this.colorPreview;if(preview&&(current.readOnly||preview.key!==(current.key||current.path)||preview.path!==current.path||preview.stamp!==brainColorsStamp(current.board.brainColors)))this.colorPreview=undefined;this.applyColors(this.colorPreview?.value??current.board.brainColors);});
 }
 private cancelColorFrame(){if(this.colorFrame)this.colorWindow?.cancelAnimationFrame(this.colorFrame);this.colorFrame=0;this.colorWindow=undefined;}
 private applyColors(raw:unknown){
  const colors=cleanBrainColors(raw);
  const set=(el:HTMLElement|SVGSVGElement,name:string,value:string)=>{if(el.style.getPropertyValue(name)!==value)el.style.setProperty(name,value);};
  // Non-inheriting tokens stay on their consumers, avoiding a recascade through
  // ports, controls, previews and the entire scene on every color input.
  set(this.stage,'--brain-custom-background',colors.background||'');set(this.svg,'--brain-custom-line',colors.line||'');set(this.labels,'--brain-custom-text',colors.text||'');
  for(const key of ['node','border','line','background'] as const)this.shell.classList.toggle(`has-custom-${key}`,!!colors[key]);
  this.shell.classList.toggle('is-color-preview',!!this.colorPreview);
  const ink=colors.node?brainStateInk(colors.node):'';for(const item of this.nodes.values()){set(item.pill,'--brain-custom-node',colors.node||'');set(item.pill,'--brain-custom-border',colors.border||'');set(item.title,'--brain-custom-text',colors.text||'');set(item.pill,'--brain-state-ink',ink);set(item.title,'--brain-state-ink',ink);}for(const preview of this.previews.values())set(preview.body,'--brain-custom-border',colors.border||'');
 }
 /** Read the rendered surfaces, including the existing paper/image background. */
 colorSamples():Record<'background'|'node'|'border'|'text'|'line',string>{
  const doc=this.el.ownerDocument,win=doc.defaultView!,probe=this.stage.createSpan({cls:'ts-brain-color-probe'});
  const node=[...this.nodes.values()].find(item=>item.root.dataset.brainRole!=='center')||this.nodes.values().next().value,nodeStyle=node?win.getComputedStyle(node.pill):undefined;
  const style=win.getComputedStyle(probe),samples={background:win.getComputedStyle(this.stage).backgroundColor,node:nodeStyle?.backgroundColor||style.backgroundColor,border:nodeStyle?.borderTopColor||style.borderBottomColor,text:style.color,line:style.borderTopColor};probe.remove();return samples;
 }
 private pageDescendants(action:'previous'|'next'|'reset'){if(!this.descendants||!this.visible())return;this.cancelPointers(true);this.motion.cancel();this.descendants[action]();this.fitCamera=true;this.fitAll=false;this.refresh();this.queueViewport();}
 showDepthMenu(){const snapshot=this.host.snapshot();if(!snapshot)return;const menu=this.makeMenu();this.fillDepthMenu(menu,snapshot,this.boardMenuCurrent(snapshot));this.showMenu(menu,undefined,this.shell.querySelector<HTMLElement>('[data-brain-action="depth"]')||this.more);}
 private openColors(){const snapshot=this.host.snapshot();if(this.alive&&this.visible()&&snapshot?.board.presentation==='brain'&&!snapshot.readOnly)this.host.colors?.();}
 focusSearch(){if(!this.visible())return;this.cancelPointers(true);this.input.focus({preventScroll:true});if(!this.searchVisible)this.toggleSearch(true);}
 revealRelation(id:string,originId?:string){
  const snapshot=this.host.snapshot();
  if(originId){
   // The host calls this only after its creation transaction has saved. Failed
   // saves retain the original selection/navigation so their dialog can retry.
   if(snapshot?.readOnly||!snapshot?.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node))||!this.current(originId)())return;
   if(originId!==snapshot?.board.brain?.centerId){this.update({type:'center',id:originId});if(this.host.snapshot()?.board.brain?.centerId!==originId)return;}
  }
  this.cancelPointers(true);this.revealId=id;this.fitCamera=true;this.fitAll=true;this.refresh();this.queueViewport();
 }
 fitToCanvas(){this.cancelPointers(true);this.motion.cancel();this.fitCamera=true;this.fitAll=true;this.fit();this.queueViewport();}
 resetZoom(){this.zoomAt(1);}
 flushPendingViewport(){this.flushViewport();}
 captureReadingPosition():BrainReadingPositionState {
  const snapshot=this.host.snapshot();if(!this.alive||!this.visible()||!snapshot||snapshot.board.presentation!=='brain'||snapshot.readOnly||!this.cameraReady)throw Error('当前脑图不可保存阅读位置');
  return captureBrainReadingPosition(snapshot.board,this.camera);
 }
 /** Cancel old asynchronous camera writes before the host restores state and
  * camera together. A delayed pan must never replace the reviewed location. */
 prepareReadingPositionRestore(){this.cancelPointers(false);this.motion.cancel();this.cancelCameraFrame();this.cancelViewport();this.cameraStored='';}
 private trackCommandComposition(){
  const doc=this.el.ownerDocument;if(this.compositionDocument===doc)return;
  if(this.compositionScope)this.removeChild(this.compositionScope);
  this.composing=false;this.compositionDocument=doc;const scope=this.compositionScope=this.addChild(new Component());
  scope.registerDomEvent(doc,'compositionstart',()=>{this.composing=true;},{capture:true});scope.registerDomEvent(doc,'compositionend',()=>{this.composing=false;},{capture:true});
  if(doc.defaultView)scope.registerDomEvent(doc.defaultView,'blur',()=>{this.composing=false;this.selectionEpoch++;this.closeMenu();this.cancelPointers(true);});
 }
 relationCommandTarget(checking=false):BrainRelationCommandTarget|undefined{
  const snapshot=this.host.snapshot(),doc=this.el.ownerDocument,id=this.activeNodeId,epoch=this.selectionEpoch,center=snapshot?.board.brain?.centerId;
  if(!snapshot||!id||snapshot.board.presentation!=='brain'||!this.alive||!this.visible()||!this.host.createRelation)return;
  this.trackCommandComposition();
  // Palette enumeration must remain discoverable while its native prompt is
  // focused. Execution rechecks after the palette closes; other inputs keep
  // their user shortcuts and never open a relationship dialog.
  const editing=(enumerating=checking)=>this.composing||!!doc.activeElement&&!!doc.activeElement.closest('input,textarea,select,[contenteditable]:not([contenteditable=false])')&&!(enumerating&&doc.activeElement.closest('.prompt'));
  const canRun=()=>{
   const live=this.host.snapshot();
   return !editing()&&this.alive&&this.visible()&&this.el.ownerDocument===doc&&!doc.defaultView?.closed&&doc.hasFocus()&&(this.host.isActive?.()??true)&&!!live&&!live.readOnly&&live.key===snapshot.key&&live.path===snapshot.path&&live.board.presentation==='brain'&&live.board.brain?.centerId===center&&this.activeNodeId===id&&this.selectionEpoch===epoch&&live.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node)&&!node.locked);
  };
  return{editing:editing(),canRun,run:side=>{if(canRun()&&!editing(false))this.createRelation(id,side);}};
 }
 focusNode(id=this.host.snapshot()?.board.brain?.centerId){
  if(!this.visible())return;this.cancelPointers(true);if(this.center!==this.host.snapshot()?.board.brain?.centerId)this.refresh();
  const item=id?this.nodes.get(id):undefined,position=this.layout?.nodes.find(node=>node.id===id);
  if(item&&position){
   // Keep the visibility guard and verify dimensions for standalone focus or a
   // resize not delivered by ResizeObserver yet. Pill bounds need no DOM read.
   const width=this.stage.clientWidth,height=this.stage.clientHeight;if(width!==this.stageSize.width||height!==this.stageSize.height)this.stageSize={width,height};
   const {x,y,zoom}=this.camera,left=x+position.x*zoom,top=y+position.y*zoom;
   if(left<12||left+position.width*zoom>width-12||top<12||top+position.height*zoom>height-12){this.camera={zoom,x:width/2-(position.x+position.width/2)*zoom,y:height/2-(position.y+position.height/2)*zoom};this.fitCamera=false;this.transform();this.queueViewport();}
  }
  if(item&&id)this.selectNode(id);
  (item?.title||this.shell).focus({preventScroll:true});
 }
 /** Reused toolbar buttons keep the node lease from press through activation. A
  * pointer/keyboard press cannot silently retarget after another node is selected. */
 private selectionButton(parent:HTMLElement,icon:string,label:string,fn:(id:string,event:MouseEvent)=>unknown,action:string){
  let pressed:{id?:string;epoch:number;current:()=>boolean}|undefined;
  const arm=()=>{const id=this.activeNodeId;pressed={id,epoch:this.selectionEpoch,current:id?this.current(id):()=>false};};
  const button=this.button(parent,icon,label,event=>{const lease=pressed;pressed=undefined;const id=lease?lease.id:this.activeNodeId;if(!id||lease&&(lease.epoch!==this.selectionEpoch||!lease.current())||!this.current(id)())return;fn(id,event);},action);
  this.registerDomEvent(button,'pointerdown',arm);this.registerDomEvent(button,'pointercancel',()=>{pressed={id:this.activeNodeId,epoch:-1,current:()=>false};});
  this.registerDomEvent(button,'keydown',event=>{if(event.key==='Enter'||event.key===' ')arm();});return button;
 }
 private createSelectionControls(){
  const root=this.shell.createDiv({cls:'ts-brain-selection',attr:{role:'group','aria-label':'选中节点操作'}}),name=root.createSpan('ts-brain-selection-name'),actions=root.createDiv('ts-brain-selection-actions');
  const center=this.selectionButton(actions,'focus','设为中心',id=>{this.update({type:'center',id});if(this.host.snapshot()?.board.brain?.centerId===id)this.focusNode(id);},'center');
  const expand=this.selectionButton(actions,'chevron-down','展开正文',id=>this.update({type:'expand',id}),'expand'),open=this.selectionButton(actions,'arrow-up-right','打开来源',id=>this.open(id),'open'),menu=this.selectionButton(actions,'ellipsis','节点菜单',(id,event)=>this.nodeMenu(id,event),'node-menu');
  const relationsToggle=this.button(actions,'plus','新建关系',()=>this.toggleRelations(this.selection.relations.hidden),'relations-toggle');relationsToggle.createSpan({text:'新建关系'});actions.insertBefore(relationsToggle,menu);relationsToggle.setAttribute('aria-expanded','false');relationsToggle.setAttribute('aria-controls',`${this.markerId}-relations`);
  const relations=root.createDiv({cls:'ts-brain-selection-relations',attr:{id:`${this.markerId}-relations`,role:'group','aria-label':'为选中节点新建关系'}}),anchors:HTMLButtonElement[]=[];relations.hidden=true;
  for(const [side,icon,label]of [['top','arrow-up','上方 · 父节点'],['bottom','arrow-down','下方 · 子节点'],['left','arrow-left','左侧 · 关联'],['right','arrow-right','右侧 · 关联']] as const){const anchor=this.selectionButton(relations,icon,brainRelationLabels[side],id=>this.createRelation(id,side),`add-${side}`);anchor.setAttribute('aria-haspopup','dialog');anchor.createSpan({cls:'ts-brain-selection-direction',text:label.split(' · ')[1]});anchors.push(anchor);}
  menu.setAttribute('aria-haspopup','menu');this.selection={root,name,center,expand,open,menu,relations,relationsToggle,anchors};root.hidden=true;
 }
 private toggleHistory(show:boolean,keyboard=false){this.footer.hidden=!show;this.historyButton.setAttribute('aria-expanded',String(show));const doc=this.el.ownerDocument;if(show&&keyboard&&doc.activeElement===this.historyButton&&doc.hasFocus()&&(this.host.isActive?.()??true)&&this.visible())Array.from(this.recent.querySelectorAll<HTMLButtonElement>('[data-brain-recent-id]')).find(button=>!button.disabled&&button.getClientRects().length)?.focus({preventScroll:true});}
 private toggleRelations(show:boolean){this.selection.relations.hidden=!show;this.selection.relationsToggle.setAttribute('aria-expanded',String(show));}
 private selectNode(id:string){
  const snapshot=this.host.snapshot();if(!snapshot||this.activeNodeId!==id&&!this.visible()||this.document!==this.el.ownerDocument||this.context!==(snapshot.key||snapshot.path)||this.boardPath!==snapshot.path||this.center!==snapshot.board.brain?.centerId||snapshot.board.presentation!=='brain'||!this.nodes.has(id)||!snapshot.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node)))return;
  this.cancelPointers(true);if(this.activeNodeId!==id){this.activeNodeId=id;this.selectionEpoch++;this.closeMenu();this.toggleRelations(false);}
  this.renderSelection(snapshot,snapshot.board.brain||createBoardMindmapState());
 }
 private renderSelection(snapshot:BrainBoardSnapshot,state:BoardMindmapState){
  const id=this.activeNodeId,node=snapshot.board.nodes.find(node=>node.id===id&&supportsBoardMindmapTarget(node)),controls=this.selection;
  controls.root.hidden=!node||!id||!this.nodes.has(id);controls.root.dataset.brainSelectedId=id||'';
  for(const [key,item]of this.nodes){const selected=key===id;if(item.root.classList.contains('is-selected')!==selected)item.root.classList.toggle('is-selected',selected);if(item.title.getAttribute('aria-pressed')!==String(selected))item.title.setAttribute('aria-pressed',String(selected));}
  if(controls.root.hidden||!node)return;
  const descriptor=localRelationNode(node),source=this.source(node.id),expanded=state.expandedIds.includes(node.id),label=this.contentLabel(node.kind),readOnly=!!snapshot.readOnly;
  const caption=`选中：${descriptor.title}`;if(controls.name.textContent!==caption)controls.name.setText(caption);controls.name.title=descriptor.title;
  controls.center.disabled=readOnly;controls.center.setAttribute('aria-label',node.id===state.centerId?'定位当前中心':`设为中心：${descriptor.title}`);controls.center.title=controls.center.getAttribute('aria-label')!;
  controls.expand.disabled=readOnly||!expanded&&!source.available;controls.expand.title=expanded?`收起${label}`:source.available?`展开${label}`:source.reason||'来源不可用';controls.expand.setAttribute('aria-label',`${expanded?'收起':'展开'}${label}：${descriptor.title}`);controls.expand.setAttribute('aria-expanded',String(expanded));const icon=expanded?'chevron-up':'chevron-down';if(controls.expandIcon!==icon){setIcon(controls.expand,icon);controls.expand.createSpan({text:expanded?'收起':'展开'});controls.expandIcon=icon;}
  controls.open.disabled=!source.available;controls.open.title=source.available?this.openLabel(node.kind,source):source.reason||'来源不可用';controls.open.setAttribute('aria-label',controls.open.title);
  for(const anchor of controls.anchors){anchor.hidden=!this.host.createRelation;anchor.disabled=readOnly||!!node.locked;}
  controls.relationsToggle.hidden=!this.host.createRelation;controls.relationsToggle.disabled=readOnly||!!node.locked;if(controls.relationsToggle.hidden||controls.relationsToggle.disabled)this.toggleRelations(false);
 }
 private node(descriptor:LocalRelationNode,role:string,snapshot:BrainBoardSnapshot,state:BoardMindmapState,roles:string[]){
  const {id}=descriptor;let item=this.nodes.get(id);if(!item){const root=this.scene.createDiv('ts-brain-node');root.dataset.brainNodeId=id;root.dataset.relationMotionId=id;const pill=root.createDiv('ts-brain-pill'),title=this.button(pill,'',descriptor.title,()=>{this.selectNode(id);title.focus({preventScroll:true});});title.classList.add('ts-brain-node-title');const label=title.createSpan({cls:'ts-brain-node-label',attr:{id:`${this.markerId}-title-${++this.nodeSequence}`}}),status=root.createDiv('ts-brain-source-status'),scope=this.addChild(new Component());item={root,pill,title,label,status,scope};this.nodes.set(id,item);
   scope.registerDomEvent(title,'focus',()=>this.selectNode(id));scope.registerDomEvent(root,'focusin',()=>this.selectNode(id));
   scope.registerDomEvent(root,'contextmenu',event=>{event.preventDefault();event.stopPropagation();this.selectNode(id);this.nodeMenu(id,event);});scope.registerDomEvent(root,'keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();event.stopPropagation();this.selectNode(id);this.nodeMenu(id,undefined,title);}else if(event.key==='ArrowDown'&&event.altKey&&event.target===title){event.preventDefault();event.stopPropagation();this.selectNode(id);[this.selection.center,this.selection.expand,this.selection.open,this.selection.menu].find(button=>!button.disabled)?.focus();}});
  }
  const expanded=state.expandedIds.includes(id),source=this.source(id),label=this.contentLabel(descriptor.kind);item.root.dataset.relationMotionCenter=String(role==='center');item.root.dataset.brainRole=role;item.root.dataset.kind=descriptor.kind;item.root.dataset.brainRoles=roles.join('、');item.root.classList.toggle('is-center',role==='center');item.root.classList.toggle('is-expanded',expanded);item.root.classList.toggle('is-missing',!source.available);item.root.classList.toggle('is-pinned',state.pins.includes(id));item.root.classList.toggle('has-long-title',descriptor.title.length>12);item.root.classList.toggle('has-extended-title',descriptor.title.length>20);if(item.label.textContent!==descriptor.title)item.label.setText(descriptor.title);item.title.disabled=false;item.title.title=`${descriptor.title}\n${descriptor.detail}${roles.length?'\n关系：'+roles.join('、'):''}\n单击选择 · 工具栏设为中心`;item.title.setAttribute('aria-current',String(role==='center'));item.title.setAttribute('aria-label',`选择${role==='center'?'当前中心':''}节点：${descriptor.title}`);item.title.setAttribute('aria-keyshortcuts','Alt+ArrowDown');item.title.setAttribute('aria-description',`${roles.join('、')}；Alt+下方向键进入选中节点操作`);item.status.setText(source.available?'':source.reason||'来源已失效');item.status.hidden=source.available;
  if(expanded&&source.available){const stamp=JSON.stringify([source.path,source.stamp,descriptor.kind]);let preview=this.previews.get(id);if(preview?.stamp!==stamp){this.dropPreview(id);const scope=this.addChild(new Component()),body=item.root.createDiv({cls:'ts-brain-preview',attr:{tabindex:'0',role:'region','aria-labelledby':item.label.getAttribute('id')!,'aria-description':label}});preview={body,scope,stamp};this.previews.set(id,preview);const record=preview,doc=this.el.ownerDocument,key=snapshot.key,path=snapshot.path;const current=()=>{const now=this.host.snapshot();return this.alive&&this.el.ownerDocument===doc&&this.visible()&&now?.key===key&&now?.path===path&&now.board.presentation==='brain'&&this.previews.get(id)===record&&body.isConnected&&!!now.board.brain?.expandedIds.includes(id)&&now.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node))&&this.source(id).available&&JSON.stringify([this.source(id).path,this.source(id).stamp,descriptor.kind])===stamp;};try{this.host.preview(id,body,scope,current);}catch(error){if(current())body.setText(this.message(error));}}}
  return item;
 }
 private update(action:BoardMindmapAction){const snapshot=this.host.snapshot();if(!snapshot||snapshot.readOnly||!this.visible())return;try{const hadFeedback=!!this.error||!!this.status.textContent;this.error='';const state=snapshot.board.brain||createBoardMindmapState(),next=updateBoardMindmapState(state,action,snapshot.board.nodes),changed=JSON.stringify(next)!==JSON.stringify(state);if(!changed&&!hadFeedback)return;const render=this.renders;if(changed)this.host.change(next);if(this.renders===render)this.refresh();}catch(error){this.showError(error);}}
 private source(id:string):BoardMindmapSource{const cached=this.refreshSources?.get(id);if(cached)return cached;let source:BoardMindmapSource;try{source=this.host.source(id);}catch(error){source={label:'来源',available:false,reason:this.message(error)};}this.refreshSources?.set(id,source);return source;}
 private createRelation(id:string,side:BrainRelationSide,initial?:'board'){const current=this.current(id),snapshot=this.host.snapshot();if(!current()||snapshot?.readOnly||snapshot?.board.nodes.find(node=>node.id===id)?.locked||!this.host.createRelation)return;try{void Promise.resolve(this.host.createRelation(id,side,current,initial)).catch(error=>{if(current())this.showError(error);});}catch(error){if(current())this.showError(error);}}
 private current(id:string){const snapshot=this.host.snapshot(),generation=this.generation,epoch=this.selectionEpoch,doc=this.el.ownerDocument,key=snapshot?.key,path=snapshot?.path,center=snapshot?.board.brain?.centerId;let valid=true;return()=>{const now=this.host.snapshot();valid=valid&&this.alive&&this.generation===generation&&this.selectionEpoch===epoch&&this.activeNodeId===id&&this.el.ownerDocument===doc&&this.document===doc&&this.visible()&&doc.hasFocus()&&(this.host.isActive?.()??true)&&!!now&&now.key===key&&this.context===(now.key||now.path)&&this.boardPath===now.path&&this.center===now.board.brain?.centerId&&now?.path===path&&now?.board.presentation==='brain'&&now.board.brain?.centerId===center&&!!now.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node));return valid;};}
 private open(id:string,edit=false){const current=this.current(id);if(!current())return;try{void Promise.resolve(this.host.open(id,current,edit)).catch(error=>{if(current())this.showError(error);});}catch(error){if(current())this.showError(error);}}
 private submenu(menu:Menu,title:string,icon:string,fill:(menu:Menu)=>void){
  menu.addItem(item=>{item.setTitle(title).setIcon(icon);fill((item as MenuItem&{setSubmenu:()=>Menu}).setSubmenu().setUseNativeMenu(false));});
 }
 private nodeMenu(id:string,event?:MouseEvent,anchor?:HTMLElement){
  const snapshot=this.host.snapshot(),node=snapshot?.board.nodes.find(node=>node.id===id&&supportsBoardMindmapTarget(node));if(!snapshot||!node||!this.current(id)())return;
  const state=snapshot.board.brain||createBoardMindmapState(),source=this.source(id),current=this.current(id),readOnly=!!snapshot.readOnly,menu=this.makeMenu();
  const add=(target:Menu,title:string,icon:string,enabled:boolean,run:()=>unknown,reason?:string)=>target.addItem(item=>item.setTitle(!enabled&&reason?`${title}（${reason}）`:title).setIcon(icon).setDisabled(!enabled).onClick(()=>{if(current())run();}));
  add(menu,'设为中心','focus',!readOnly,()=>this.update({type:'center',id}));
  add(menu,`${state.expandedIds.includes(id)?'收起':'展开'}${this.contentLabel(node.kind)}`,'chevrons-up-down',!readOnly&&(source.available||state.expandedIds.includes(id)),()=>this.update({type:'expand',id}),source.reason);
  add(menu,this.openLabel(node.kind,source),'arrow-up-right',source.available,()=>this.open(id),source.reason);
  if(this.host.renameNode)add(menu,node.brainIdea?'重命名想法':node.kind==='section'?'重命名分组':node.kind==='board'?'重命名来源白板':'重命名来源笔记','pencil-line',!readOnly&&!node.locked&&(!node.file||source.available),()=>this.host.renameNode?.(id,current));
  if(node.brainIdea&&this.host.organizeIdea)add(menu,'整理成笔记','file-plus',!readOnly&&!node.locked,()=>this.host.organizeIdea?.(id,current));
  else add(menu,'编辑实际笔记','pencil',source.available&&!!source.canEdit,()=>this.open(id,true),source.available?source.editReason||'此对象没有独立笔记正文':source.reason);
  if(this.host.associateExisting)add(menu,'关联已有笔记…','file-input',!readOnly&&!node.locked,()=>{try{this.host.associateExisting?.(id,current);}catch(error){if(current())this.showError(error);}});
  if(this.host.createRelation)this.submenu(menu,'新建节点','plus',sub=>{
   for(const side of ['top','bottom','left','right'] as const)add(sub,brainRelationLabels[side],'plus',!readOnly&&!node.locked,()=>this.createRelation(id,side));
   sub.addSeparator();add(sub,'新建白板…','panels-top-left',!readOnly&&!node.locked,()=>this.createRelation(id,'bottom','board'));
  });
  this.submenu(menu,'关系与固定','git-branch',sub=>{
   const roles=this.nodes.get(id)?.root.dataset.brainRoles;if(roles)add(sub,`关系：${roles}`,'info',false,()=>{});
   add(sub,state.pins.includes(id)?'取消固定':'固定节点','pin',!readOnly,()=>this.update({type:'pin',id}));
   if(this.host.relate){sub.addSeparator();for(const [kind,label]of [['child','添加子级关系'],['parent','添加父级关系'],['associate','添加关联'],['remove','移除本板关系']] as const)add(sub,label,kind==='remove'?'unlink':'git-branch',!readOnly,()=>{try{void Promise.resolve(this.host.relate!(id,kind,current)).catch(error=>{if(current())this.showError(error);});}catch(error){if(current())this.showError(error);}});}
  });
  if(node.file&&source.available&&this.host.fileMenu)this.submenu(menu,'文件操作','file-cog',sub=>this.host.fileMenu?.(sub,id));
  this.showMenu(menu,event,anchor||this.selection.menu||this.more);
 }
 private boardMenuCurrent(snapshot:BrainBoardSnapshot){
  const generation=this.generation,epoch=this.selectionEpoch,key=snapshot.key,path=snapshot.path;
  return()=>{const now=this.host.snapshot();return this.alive&&this.visible()&&this.generation===generation&&this.selectionEpoch===epoch&&now?.key===key&&now?.path===path&&now.board.presentation==='brain';};
 }
 private fillDepthMenu(menu:Menu,snapshot:BrainBoardSnapshot,current:()=>boolean){
  if(this.descendantPage){
   const page=this.descendantPage;menu.addItem(item=>item.setTitle(`已浏览 ${page.visited} 个节点 · 本板共 ${this.branchCache?.index.nodes.size??0} 个${page.hasNext?' · 仍有关系待浏览':''}`).setIcon('info').setDisabled(true));
   const hidden=this.layout&&'hiddenEdges'in this.layout?this.layout.hiddenEdges:0;if(typeof hidden==='number'&&hidden>0)menu.addItem(item=>item.setTitle(`${hidden} 条可见端点关系未绘制；节点菜单可查看本板关系`).setIcon('info').setDisabled(true));
   menu.addSeparator();
  }
  for(let depth=1;depth<=5;depth++)menu.addItem(item=>item.setTitle(`显示 ${depth} 层${(snapshot.board.brain?.descendantDepth??1)===depth?' ✓':''}`).setIcon('layers').setDisabled(!!snapshot.readOnly).onClick(()=>{if(current()){this.motion.cancel();this.update({type:'depth',value:depth});}}));
 }
 private boardMenu(event?:MouseEvent){
  const snapshot=this.host.snapshot();if(!snapshot)return;const menu=this.makeMenu(),current=this.boardMenuCurrent(snapshot),readOnly=!!snapshot.readOnly;
  const add=(target:Menu,title:string,icon:string,run:()=>void,disabled=readOnly)=>target.addItem(item=>item.setTitle(title).setIcon(icon).setDisabled(disabled).onClick(()=>{if(current())run();}));
  add(menu,'添加节点','plus',()=>this.host.add());
  if(this.host.addObject)this.submenu(menu,'添加其他对象','shapes',sub=>{add(sub,'添加分组','group',()=>this.host.addObject?.('section'));add(sub,'引用子白板','panels-top-left',()=>this.host.addObject?.('board'));});
  if(this.host.rename)add(menu,'重命名白板','pencil',()=>this.host.rename?.());
  menu.addSeparator();
  add(menu,'适应画布','maximize',()=>this.fitToCanvas(),false);
  this.submenu(menu,'关系显示层级','layers',sub=>this.fillDepthMenu(sub,snapshot,current));
  if(this.host.readingPositions)add(menu,'脑图阅读位置…','bookmark',()=>{if(!this.host.snapshot()?.readOnly)this.host.readingPositions?.(current);});
  const state=snapshot.board.brain;
  if(state?.pins.length)this.submenu(menu,'固定节点','pin',sub=>{for(const id of state.pins){const node=snapshot.board.nodes.find(node=>node.id===id&&supportsBoardMindmapTarget(node));add(sub,node?`固定：${localRelationNode(node).title}`:'清理失效固定','pin',()=>this.update(node?{type:'center',id}:{type:'pin',id,pinned:false}));}});
  if(this.host.background||this.host.colors)this.submenu(menu,'外观','palette',sub=>{if(this.host.background)add(sub,'白板背景','image',()=>this.host.background?.(this.more));if(this.host.colors)add(sub,'脑图配色…','palette',()=>this.openColors());});
  menu.addSeparator();
  if(this.host.settings)add(menu,'脑图设置','settings-2',()=>this.host.settings?.(),false);
  if(this.host.nativeProperties&&/\.md$/i.test(snapshot.path))add(menu,'原生属性与 Markdown','file-pen-line',()=>{if(!this.host.snapshot()?.readOnly)this.host.nativeProperties?.();});
  const staleExpanded=state?.expandedIds.filter(id=>!snapshot.board.nodes.some(node=>node.id===id&&supportsBoardMindmapTarget(node)))||[];
  if(staleExpanded.length)this.submenu(menu,'清理失效展开','list-restart',sub=>{for(const id of staleExpanded)add(sub,`清理失效展开：${id}`,'x',()=>this.update({type:'expand',id,expanded:false}));});
  this.showMenu(menu,event,this.more);
 }
 private renderHistory(snapshot:BrainBoardSnapshot,state:BoardMindmapState){const active=this.el.ownerDocument.activeElement,focusedId=this.recent.contains(active)?(active as HTMLElement).dataset.brainRecentId:undefined;this.recent.empty();const ids=[...new Set([...state.history.entries].reverse())];for(const id of ids){const node=snapshot.board.nodes.find(node=>node.id===id&&supportsBoardMindmapTarget(node)),name=node?localRelationNode(node).title:'已移除节点';const button=this.button(this.recent,'',name,()=>{this.update({type:'center',id});this.toggleHistory(false);this.focusNode(id);});button.setText(name);button.dataset.brainRecentId=id;button.classList.toggle('is-active',id===state.centerId);button.setAttribute('aria-current',String(id===state.centerId));button.disabled=!!snapshot.readOnly||!node;}if(focusedId&&this.visible()&&this.el.ownerDocument.hasFocus()&&(this.host.isActive?.()??true))Array.from(this.recent.querySelectorAll<HTMLButtonElement>('[data-brain-recent-id]')).find(button=>button.dataset.brainRecentId===focusedId)?.focus({preventScroll:true});}
 private toggleSearch(show:boolean){this.searchVisible=show;this.searchResults.hidden=!show;this.input.setAttribute('aria-expanded',String(show));if(show)this.renderSearch();else this.input.removeAttribute('aria-activedescendant');}
 private renderSearch(){
  if(!this.searchVisible)return;const snapshot=this.host.snapshot();if(!snapshot)return;
  // Every input searches the current board. Only identical displayed DOM is
  // retained; descriptors, paging, write permission and owner changes invalidate it.
  const result=searchLocalCenters(snapshot.board,this.query,{page:this.searchPage,pageSize:10});this.searchPage=result.page;this.searchIds=result.items.map(node=>node.id);this.searchIndex=Math.min(this.searchIndex,Math.max(0,result.items.length-1));
  const signature=JSON.stringify([result.items,result.matched,result.page,result.pages,!!snapshot.readOnly]),doc=this.el.ownerDocument,previous=this.searchRender;
  if(previous&&previous.key===snapshot.key&&previous.path===snapshot.path&&previous.doc===doc&&previous.signature===signature){this.selectSearchRow();return;}
  this.searchRender={key:snapshot.key,path:snapshot.path,doc,signature};this.searchResults.empty();this.searchResults.createDiv({cls:'ts-brain-search-count',text:result.matched?`${result.matched} 个节点`:'没有匹配的节点，试试其他名称或路径',attr:{role:'status','aria-live':'polite'}});const list=this.searchResults.createDiv({attr:{id:`${this.markerId}-search`,role:'listbox','aria-label':'本板节点'}});
  for(const [index,node]of result.items.entries()){const button=this.button(list,node.kind==='section'?'group':node.kind==='board'?'network':'file-text',node.title,()=>this.chooseSearch(node.id));button.classList.add('ts-brain-search-result');button.classList.toggle('is-active',index===this.searchIndex);button.setAttribute('role','option');button.setAttribute('id',`${this.markerId}-search-row-${index}`);button.setAttribute('aria-selected',String(index===this.searchIndex));button.disabled=!!snapshot.readOnly;button.createSpan({text:node.title});button.title=node.detail;}
  if(result.pages>1){const pager=this.searchResults.createDiv('ts-brain-search-pager');this.button(pager,'chevron-left','搜索上一页',()=>this.pageSearch(-1)).disabled=result.page===0;pager.createSpan({text:`${result.page+1} / ${result.pages}`});this.button(pager,'chevron-right','搜索下一页',()=>this.pageSearch(1)).disabled=result.page+1===result.pages;}
  this.selectSearchRow();
 }
 private pageSearch(direction:-1|1){
  const snapshot=this.host.snapshot(),doc=this.el.ownerDocument,active=doc.activeElement,restore=!!snapshot&&this.alive&&!!active&&this.searchResults.contains(active)&&doc.hasFocus()&&(this.host.isActive?.()??true);
  // The query survives rebuilding. Hand off internal focus before removing the
  // pager so Chromium's removal focusout(null) cannot close these results.
  if(restore)this.input.focus({preventScroll:true});this.searchPage+=direction;this.searchIndex=0;this.renderSearch();
  const current=this.host.snapshot();if(!restore||!snapshot||!current||!this.alive||this.el.ownerDocument!==doc||!doc.hasFocus()||!(this.host.isActive?.()??true)||!this.searchVisible||doc.activeElement!==this.input||current.key!==snapshot.key||current.path!==snapshot.path)return;
  const buttons=Array.from(this.searchResults.querySelector('.ts-brain-search-pager')?.querySelectorAll<HTMLButtonElement>('button')||[]),label=direction<0?'搜索上一页':'搜索下一页';
  (buttons.find(button=>!button.disabled&&button.getAttribute('aria-label')===label)||buttons.find(button=>!button.disabled))?.focus({preventScroll:true});
 }
 private selectSearchRow(scroll=false){
  let selected:HTMLElement|undefined;this.searchResults.querySelectorAll<HTMLElement>('.ts-brain-search-result').forEach((row,index)=>{const active=index===this.searchIndex;if(row.classList.contains('is-active')!==active){row.classList.toggle('is-active',active);row.setAttribute('aria-selected',String(active));}if(active)selected=row;});
  // Keep keyboard navigation local: scrollIntoView can also scroll the clipped leaf.
  if(selected){this.input.setAttribute('aria-activedescendant',selected.getAttribute('id')!);if(scroll){const viewport=this.searchResults.getBoundingClientRect(),row=selected.getBoundingClientRect(),top=viewport.top+this.searchResults.clientTop,bottom=top+this.searchResults.clientHeight;if(row.top<top)this.searchResults.scrollTop+=row.top-top;else if(row.bottom>bottom)this.searchResults.scrollTop+=row.bottom-bottom;}}else this.input.removeAttribute('aria-activedescendant');
 }
 private chooseSearch(id:string){this.update({type:'center',id});this.toggleSearch(false);this.focusNode(id);}
 private searchKey(event:KeyboardEvent){if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.toggleSearch(false);this.focusNode();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();const id=this.searchIds[this.searchIndex];if(id)this.chooseSearch(id);}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();this.searchIndex=Math.max(0,Math.min(this.searchIds.length-1,this.searchIndex+(event.key==='ArrowDown'?1:-1)));if(!this.searchVisible)this.toggleSearch(true);this.selectSearchRow(true);}}
 private keydown(event:KeyboardEvent){if(event.isComposing)return;const editing=!!(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]');if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&(!editing||event.target===this.input)){event.preventDefault();event.stopPropagation();this.focusSearch();return;}if(editing)return;if(event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();event.stopPropagation();this.update({type:'history',direction:event.key==='ArrowLeft'?'back':'forward'});this.focusNode();return;}if(event.key==='Escape'){this.closeMenu();this.toggleSearch(false);const doc=this.el.ownerDocument,restoreFocus=this.shell.contains(doc.activeElement)&&doc.hasFocus()&&(this.host.isActive?.()??true);if(!this.selection.relations.hidden){this.toggleRelations(false);if(restoreFocus)this.selection.relationsToggle.focus({preventScroll:true});}else if(!this.footer.hidden){this.toggleHistory(false);if(restoreFocus)this.historyButton.focus({preventScroll:true});}event.stopPropagation();return;}if(this.host.shortcut?.(event)){event.preventDefault();event.stopPropagation();return;}event.stopPropagation();}
 private pointerDown(event:PointerEvent){
  if(event.button!==0)return;
  if((event.target as HTMLElement)?.closest('button,input,textarea,select,a,[contenteditable],.ts-brain-preview,.ts-brain-pager,.ts-brain-zoom')){this.cancelPointers(true);return;}
  if(event.pointerType==='touch'){
   if(this.pan&&!this.touchPoints.has(this.pan.id)||this.touchPoints.has(event.pointerId)||this.touchPoints.size>=2)return;
   event.preventDefault();this.touchPoints.set(event.pointerId,{x:event.clientX,y:event.clientY});this.stage.setPointerCapture?.(event.pointerId);
   if(this.touchPoints.size===1){this.touchMoved=false;this.pan={id:event.pointerId,x:event.clientX,y:event.clientY,startX:this.camera.x,startY:this.camera.y,moved:false};}
   else{const [a,b]=[...this.touchPoints.values()];this.pan=undefined;this.pinch={x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),camera:{...this.camera}};}
   return;
  }
  if(this.touchPoints.size||this.pan)return;
  event.preventDefault();this.shell.focus({preventScroll:true});this.pan={id:event.pointerId,x:event.clientX,y:event.clientY,startX:this.camera.x,startY:this.camera.y,moved:false};this.stage.setPointerCapture?.(event.pointerId);
 }
 private pointerMove(event:PointerEvent){
  if(this.touchPoints.has(event.pointerId)){
   event.preventDefault();
   this.touchPoints.set(event.pointerId,{x:event.clientX,y:event.clientY});
   if(this.pinch&&this.touchPoints.size===2){
    const [a,b]=[...this.touchPoints.values()],pinch=this.pinch,rect=this.stage.getBoundingClientRect(),zoom=clampZoom(pinch.camera.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance),scale=zoom/pinch.camera.zoom;
    this.camera={x:(a.x+b.x)/2-rect.left-(pinch.x-rect.left-pinch.camera.x)*scale,y:(a.y+b.y)/2-rect.top-(pinch.y-rect.top-pinch.camera.y)*scale,zoom};this.touchMoved=true;this.stage.classList.add('is-panning');this.motion.cancel();this.fitCamera=false;this.cameraReady=true;this.queueCameraFrame();return;
   }
  }
  if(!this.pan||this.pan.id!==event.pointerId)return;const dx=event.clientX-this.pan.x,dy=event.clientY-this.pan.y;if(Math.abs(dx)+Math.abs(dy)<3&&!this.pan.moved)return;if(!this.pan.moved)this.stage.classList.add('is-panning');this.motion.cancel();this.pan.moved=true;this.touchMoved=this.touchMoved||this.touchPoints.has(event.pointerId);this.fitCamera=false;this.camera={...this.camera,x:this.pan.startX+dx,y:this.pan.startY+dy};this.queueCameraFrame();
 }
 private pointerEnd(event:PointerEvent){
  if(this.touchPoints.has(event.pointerId)){
   const moved=this.touchMoved;if(event.type==='pointercancel'||event.type==='lostpointercapture'){this.cancelPointers();}
   else{this.touchPoints.delete(event.pointerId);if(this.pan?.id===event.pointerId)this.pan=undefined;this.pinch=undefined;if(this.stage.hasPointerCapture?.(event.pointerId))this.stage.releasePointerCapture(event.pointerId);if(this.touchPoints.size)return;this.touchMoved=false;this.stage.classList.remove('is-panning');}
   if(moved){this.cancelCameraFrame();this.transform();this.queueViewport();}return;
  }
  if(!this.pan||this.pan.id!==event.pointerId)return;const moved=this.pan.moved;this.pan=undefined;this.stage.classList.remove('is-panning');if(this.stage.hasPointerCapture?.(event.pointerId))this.stage.releasePointerCapture(event.pointerId);if(moved){this.cancelCameraFrame();this.transform();this.queueViewport();}
 }
 private cancelPointers(save=false){
  const ids=new Set([...this.touchPoints.keys(),...(this.pan?[this.pan.id]:[])]),moved=this.touchMoved||!!this.pan?.moved;
  // Clear ownership before releasing capture: lostpointercapture can be delivered
  // synchronously and must not end a surviving finger or enqueue a second save.
  this.touchPoints.clear();this.pan=undefined;this.pinch=undefined;this.touchMoved=false;this.stage?.classList.remove('is-panning');for(const id of ids)if(this.stage?.hasPointerCapture?.(id))this.stage.releasePointerCapture(id);
  if(!moved)return;this.cancelCameraFrame();const snapshot=this.host.snapshot();
  if(save&&this.alive&&snapshot&&snapshot.board===this.cameraBoard&&(snapshot.key||snapshot.path)===this.context&&snapshot.path===this.boardPath&&snapshot.board.presentation==='brain'){this.transform();this.queueViewport();}
 }
 private wheel(event:WheelEvent){event.stopPropagation();if((event.target as HTMLElement)?.closest('.ts-brain-preview')&&!event.metaKey&&!event.ctrlKey)return;event.preventDefault();this.cancelPointers(true);this.motion.cancel();const factor=event.deltaMode===1?16:event.deltaMode===2?this.stage.clientHeight:1;if(event.ctrlKey||event.metaKey){const rect=this.stage.getBoundingClientRect();this.zoomAt(this.camera.zoom*Math.exp(-event.deltaY*factor*.002),event.clientX-rect.left,event.clientY-rect.top,true);return;}this.fitCamera=false;this.camera.x-=event.deltaX*factor;this.camera.y-=event.deltaY*factor;this.queueCameraFrame();this.queueViewport();}
 private zoomAt(zoom:number,x=this.stage.clientWidth/2,y=this.stage.clientHeight/2,defer=false){this.cancelPointers(true);this.motion.cancel();const next=clampZoom(zoom),scale=next/this.camera.zoom;this.camera={x:x-(x-this.camera.x)*scale,y:y-(y-this.camera.y)*scale,zoom:next};this.fitCamera=false;this.cameraReady=true;if(defer)this.queueCameraFrame();else{this.cancelCameraFrame();this.transform();}this.queueViewport();}
 // Inputs update the logical camera immediately; only the DOM projection is
 // coalesced. A later input in the same frame therefore keeps its exact anchor
 // and accumulated delta. Only the scene projects once per frame; selection
 // controls stay outside the camera and keep their screen-space geometry.
 private queueCameraFrame(){const win=this.el.ownerDocument.defaultView;if(this.cameraFrame||!win)return;this.cameraWindow=win;this.cameraFrame=win.requestAnimationFrame(()=>{this.cameraFrame=0;this.cameraWindow=undefined;if(this.alive&&this.el.ownerDocument.defaultView===win)this.transform();});}
 private cancelCameraFrame(){if(this.cameraFrame)this.cameraWindow?.cancelAnimationFrame(this.cameraFrame);this.cameraFrame=0;this.cameraWindow=undefined;}
 private preserveResizeCamera(previous:BrainBoardLayout,size:{width:number;height:number},next:{width:number;height:number}){
  if(!this.layout||next.width<=0||next.height<=0)return;
  // Keep the closest displayed node at the same offset from the viewport center.
  // Intrinsic layout dimensions also change on a wide pane, so merely retaining
  // camera x/y would shift the relationship the user was reading.
  const distance=(node:BrainBoardLayout['nodes'][number])=>Math.hypot(this.camera.x+(node.x+node.width/2)*this.camera.zoom-size.width/2,this.camera.y+(node.y+node.height/2)*this.camera.zoom-size.height/2);
  const anchor=previous.nodes.reduce<BrainBoardLayout['nodes'][number]|undefined>((best,node)=>!best||distance(node)<distance(best)?node:best,undefined),target=anchor?this.layout.nodes.find(node=>node.id===anchor.id):undefined;
  const dx=anchor&&target?target.x+target.width/2-anchor.x-anchor.width/2:(this.layout.width-previous.width)/2,dy=anchor&&target?target.y+target.height/2-anchor.y-anchor.height/2:(this.layout.height-previous.height)/2;
  this.camera={...this.camera,x:this.camera.x+(next.width-size.width)/2-dx*this.camera.zoom,y:this.camera.y+(next.height-size.height)/2-dy*this.camera.zoom};
  if(this.viewportIntent)this.viewportIntent.value={...this.camera};
 }
 // Selection, history and paging controls sit outside the measured stage.
 private fit(size?:{width:number;height:number}){if(!this.layout)return;const width=(size?.width??this.stage.clientWidth)||this.layout.width,height=(size?.height??this.stage.clientHeight)||this.layout.height;const fitted=Math.min(1,width/this.layout.width,height/this.layout.height),zoom=clampZoom(this.fitAll?fitted:Math.max(.72,fitted));this.stageSize={width,height};const center=!this.fitAll&&this.layout.nodes.some(node=>(node.depth??0)>1)?this.layout.nodes.find(node=>node.role==='center'):undefined;this.camera=center?{x:width/2-(center.x+center.width/2)*zoom,y:height*.35-(center.y+center.height/2)*zoom,zoom}:{x:(width-this.layout.width*zoom)/2,y:(height-this.layout.height*zoom)/2,zoom};this.cameraReady=true;this.transform();}
 private transform(){
  const stamp=JSON.stringify([this.camera,this.stageSize]);if(this.transformStamp===stamp&&this.transformLayout===this.layout)return;this.transformStamp=stamp;this.transformLayout=this.layout;
  this.scene.style.transform=`translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.zoom})`;const label=`${Math.round(this.camera.zoom*100)}%`;if(this.zoomLabel.textContent!==label)this.zoomLabel.setText(label);
 }
 private transformLayout?:BrainBoardLayout;
 private queueViewport(){const snapshot=this.host.snapshot(),win=this.el.ownerDocument.defaultView;if(!snapshot||snapshot.readOnly||!this.host.viewport||!win)return;this.cancelViewport();this.viewportIntent={key:snapshot.key,path:snapshot.path,board:snapshot.board,value:{...this.camera}};this.viewportWindow=win;this.viewportTimer=win.setTimeout(()=>this.flushViewport(),160);}
 flushViewport(){const intent=this.viewportIntent,snapshot=this.host.snapshot();this.cancelViewport();if(!intent||!snapshot||snapshot.readOnly||snapshot.key!==intent.key||snapshot.path!==intent.path||snapshot.board!==intent.board||snapshot.board.presentation!=='brain')return;try{this.host.viewport?.(intent.value);this.cameraStored=JSON.stringify(intent.value);}catch(error){this.showError(error);}}
 private finalizeViewport(){
  if(!this.host.finalizeViewport){this.flushViewport();return;}const intent=this.viewportIntent;this.cancelViewport();if(!intent)return;
  // Obsidian detaches the component before BoardView.onClose. Only this formal
  // unload path may ask the host to validate an intent without connected DOM.
  try{this.host.finalizeViewport(intent);}catch(error){this.showError(error);}
 }
 private cancelViewport(){if(this.viewportTimer)this.viewportWindow?.clearTimeout(this.viewportTimer);this.viewportTimer=0;this.viewportWindow=undefined;this.viewportIntent=undefined;}
 private observe(){this.observer?.disconnect();this.stopHostInset?.();this.stopHostInset=bindBoardHostInset(this.shell,this.zoom,()=>{});const win=this.el.ownerDocument.defaultView as (Window&{ResizeObserver?:typeof ResizeObserver})|null;if(win?.ResizeObserver){this.observer=new win.ResizeObserver(()=>{if(this.resizeFrame)return;this.resizeWindow=win;this.resizeFrame=win.requestAnimationFrame(()=>{this.resizeFrame=0;this.resizeWindow=undefined;if(this.alive&&this.el.ownerDocument.defaultView===win)this.refresh();});});this.observer.observe(this.stage);}}
 private cancelResize(){if(this.resizeFrame)this.resizeWindow?.cancelAnimationFrame(this.resizeFrame);this.resizeFrame=0;this.resizeWindow=undefined;}
 private dropPreview(id:string){const preview=this.previews.get(id);if(preview){this.removeChild(preview.scope);preview.body.remove();this.previews.delete(id);}}
 private clearPreviews(){for(const id of this.previews.keys())this.dropPreview(id);}
 private makeMenu(){this.closeMenu();const menu=new Menu().setUseNativeMenu(false);this.activeMenu=menu;menu.onHide(()=>{if(this.activeMenu===menu)this.activeMenu=undefined;});return menu;}
 private closeMenu(){const menu=this.activeMenu;this.activeMenu=undefined;try{menu?.hide();}catch{/* Owning popout may already be closing. */}}
 private showMenu(menu:Menu,event:MouseEvent|undefined,anchor:HTMLElement){if(event)menu.showAtMouseEvent(event);else{const rect=anchor.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom},this.el.ownerDocument);}}
 private button(parent:HTMLElement,icon:string,label:string,run:(event:MouseEvent)=>unknown,action?:string){
  const button=parent.createEl('button',{cls:'clickable-icon',attr:{type:'button','aria-label':label,title:label}});if(action)button.dataset.brainAction=action;if(icon)setIcon(button,icon);
  // A held press belongs to the navigation/selection that issued it. Property
  // handlers leave discarded search, history and node buttons collectible.
  let pressedEpoch:number|undefined;const arm=()=>{pressedEpoch=this.selectionEpoch;};button.onpointerdown=arm;button.onpointercancel=()=>{pressedEpoch=-1;};button.onkeydown=event=>{if(event.key==='Enter'||event.key===' ')arm();};
  button.onclick=event=>{event.stopPropagation();const epoch=pressedEpoch;pressedEpoch=undefined;if(!this.alive||epoch!==undefined&&epoch!==this.selectionEpoch)return;this.cancelPointers(true);run(event);};return button;
 }
 private contentLabel(kind:Card['kind']){return kind==='text'?'想法': kind==='section'?'分组内容':kind==='board'?'子白板概览':'正文';}
 private openLabel(kind:Card['kind'],source:BoardMindmapSource){return kind==='section'?'查看分组内容':/^(打开|定位)/.test(source.label)?source.label:`打开 ${source.label}`;}
 private visible(){const win=this.el.ownerDocument.defaultView;return this.alive&&this.el.isConnected&&!!this.el.getClientRects().length&&!!win&&!win.closed;}
 private showError(error:unknown){this.error=this.message(error);this.refreshSaveFeedback();}
 private message(error:unknown){return error instanceof Error?error.message:String(error);}
}
