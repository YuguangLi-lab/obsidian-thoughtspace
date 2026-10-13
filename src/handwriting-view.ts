import {setIcon} from 'obsidian';
import {uid,type Board} from './model';
import {assertInkData,inkBounds,strokePath,hitInkStrokePath,hitInkStroke,type InkData,type InkStroke,type InkPoint,type InkBounds} from './ink-model';
import {selectInkLasso,hitSelectedInk,type InkEdit} from './handwriting-ink-edit';
import {inkSelectionActionPosition,type InkActionViewport} from './ink-selection-actions';
import {bindBoardHostInset} from './board-chrome';
import {InkPathCache} from './ink-path-cache';
import {VisibleInkPath,visibleInkWorldRect,INK_VECTOR_BATCH_POINTS,INK_VECTOR_ASYNC_POINTS,type InkProjectionCursor} from './visible-ink-path';
import {HandwritingInputController,DEFAULT_HANDWRITING_TOOL,type HandwritingDraft,type HandwritingTool,type HandwritingViewport,type HandwritingPoint} from './handwriting-input';

export interface HandwritingSnapshot {key:unknown;board:Board;readOnly:boolean}
export interface HandwritingHost {
 snapshot():HandwritingSnapshot|undefined;
 commitStroke(stroke:InkStroke,key:unknown):void|Promise<void>;
 commitErase(ids:readonly string[],key:unknown):void|Promise<void>;
 commitInk?(edit:InkEdit,key:unknown,expectedInk:InkData):void|Promise<void>;
 export?():void|Promise<void>;
 camera(viewport:HandwritingViewport,key:unknown,persist:boolean):void|Promise<void>;
 undo(redo:boolean):void;
 notice(message:string):void;
}
interface Owner {key:unknown;board:Board}
interface CameraPreview {owner:Owner;source:HandwritingViewport;viewport:HandwritingViewport}
interface InkContext {owner:Owner;ink?:InkData;start:HandwritingPoint;ids:string[];move:boolean}
interface InkRenderBasis {owner:Owner;ink?:InkData;viewport:HandwritingViewport;clip?:InkBounds;selection:string;dx:number;dy:number;sources?:{stroke:InkStroke;id:string;color:string;token:object}[]}
type SelectionAction='duplicate'|'remove'|'cancel';
interface SelectionPress {owner:Owner;ink:InkData;ids:string[];epoch:number;viewport:HandwritingViewport;rect:{left:number;top:number;width:number;height:number};visible:InkActionViewport;button:HTMLButtonElement;pointerId:number;pointerType:string;clientX:number;clientY:number;released:boolean;cancelled:boolean}
const sameViewport=(a:HandwritingViewport,b:HandwritingViewport)=>a.x===b.x&&a.y===b.y&&a.zoom===b.zoom;
const palette=[['#222222','石墨'],['#315e9b','蓝色'],['#b34643','红色'],['#467153','绿色'],['#795c9a','紫色']] as const;
const toolKeys:Readonly<Record<string,HandwritingTool['kind']>>={b:'pen',e:'eraser',l:'lasso',h:'pan'};
const svgNamespace='http://www.w3.org/2000/svg';

/** Dedicated ink surface. No ordinary-board pointer handler is mounted here. */
export class HandwritingView {
 private readonly element:HTMLElement;private readonly stage:HTMLElement;private readonly world:HTMLElement;
 private readonly svg:SVGSVGElement;private readonly canvas:HTMLCanvasElement;private readonly context:CanvasRenderingContext2D|null;
 private readonly hint:HTMLElement;private readonly hintTitle:HTMLElement;private readonly hintDetail:HTMLElement;private readonly mixed:HTMLElement;private readonly status:HTMLElement;
 private readonly currentTool:HTMLElement;private readonly penSummary:HTMLElement;private readonly penPreview:HTMLElement;
 private readonly controller:HandwritingInputController;private readonly resizeObserver:ResizeObserver;
 private readonly win:Window;private readonly removeListeners:(()=>void)[]=[];
 private readonly paths=new Map<string,{stroke:InkStroke;element:SVGPathElement;path?:string;cursor?:InkProjectionCursor}>();
 private readonly pathCache=new InkPathCache();
 private readonly visiblePaths=new VisibleInkPath(this.pathCache);private renderFrame?:number;private renderGeneration=0;private renderBasis?:InkRenderBasis;private rendering=false;private refreshing=false;
 private readonly tools=new Map<HandwritingTool['kind'],HTMLButtonElement>();private readonly colors=new Map<string,HTMLButtonElement>();
 private readonly editActions:HTMLButtonElement[]=[];private readonly width:HTMLSelectElement;private readonly fingerButton:HTMLButtonElement;
 private readonly settings:HTMLElement;private readonly more:HTMLElement;private readonly settingsButton:HTMLButtonElement;private readonly moreButton:HTMLButtonElement;
 private readonly selectionActions:HTMLButtonElement[]=[];private readonly selectionGroup:SVGGElement;private readonly selectionRect:SVGRectElement;private readonly lassoPath:SVGPathElement;
 private readonly selectionBar:HTMLElement;private readonly nearbyActions=new Map<HTMLButtonElement,SelectionAction>();private selectionBounds?:InkBounds;
 private selectionEpoch=0;private selectionPress?:SelectionPress;private readonly stagePointers=new Set<number>();private readonly actionPointers=new Set<number>();private inputBusy=false;
 private selected:string[]=[];private selectionInk?:InkData;private selectionDelta={x:0,y:0};private menuOwner?:Owner;
 private readonly draftGroup:SVGGElement;private owner?:Owner;private disposed=false;
 private tool:HandwritingTool={...DEFAULT_HANDWRITING_TOOL};private drawn=0;private draft?:HandwritingDraft;
 private fingerWriting=false;
 private pointerRepeat?:{key:unknown;clientX:number;clientY:number;pointerType:string;until:number};
 private size={width:0,height:0,dpr:1};
 private cameraPreview?:CameraPreview;private sharedCamera?:{owner:Owner;viewport:HandwritingViewport};

 constructor(private root:HTMLElement,private host:HandwritingHost){
  const doc=root.ownerDocument,win=doc.defaultView;if(!win)throw Error('手写页面尚未就绪');this.win=win;
  root.addClass('ts-handwriting-board');this.element=root.createDiv({cls:'ts-handwriting',attr:{'aria-label':'手写白板'}});
  const toolbar=this.element.createDiv({cls:'ts-handwriting-toolbar',attr:{role:'toolbar','aria-label':'手写工具'}});
  const modes=toolbar.createDiv({cls:'ts-handwriting-tools',attr:{role:'group','aria-label':'工具'}});
  for(const [kind,label,icon]of [['pen','笔','pen-tool'],['eraser','整笔擦除','eraser']] as const){
   const button=this.button(modes,label,icon,()=>this.setTool({kind}),kind);this.tools.set(kind,button);this.editActions.push(button);
  }
  this.editActions.push(this.button(modes,'撤销','undo-2',()=>this.undo(false),'undo'));
  const summary=toolbar.createDiv({cls:'ts-handwriting-summary',attr:{'aria-label':'当前工具与笔迹设置'}});
  this.currentTool=summary.createSpan('ts-handwriting-current-tool');
  this.penPreview=summary.createSpan({cls:'ts-handwriting-pen-preview',attr:{'aria-hidden':'true'}});
  this.penSummary=summary.createSpan('ts-handwriting-pen-summary');
  const actions=toolbar.createDiv({cls:'ts-handwriting-actions',attr:{role:'group','aria-label':'更多操作'}});
  this.settingsButton=this.button(actions,'笔设置','sliders-horizontal',()=>this.toggleMenu('settings'),'pen-settings');
  this.moreButton=this.button(actions,'更多','ellipsis',()=>this.toggleMenu('more'),'more');this.editActions.push(this.settingsButton,this.moreButton);
  this.settingsButton.setAttribute('aria-haspopup','dialog');this.moreButton.setAttribute('aria-haspopup','dialog');
  this.settingsButton.setAttribute('aria-expanded','false');this.moreButton.setAttribute('aria-expanded','false');
  this.settings=this.element.createDiv({cls:'ts-handwriting-popover ts-handwriting-pen-settings',attr:{role:'dialog','aria-label':'笔设置'}});this.settings.hidden=true;
  this.more=this.element.createDiv({cls:'ts-handwriting-popover ts-handwriting-more',attr:{role:'dialog','aria-label':'更多手写操作'}});this.more.hidden=true;
  for(const [kind,label,icon]of [['lasso','套索选笔迹','lasso'],['pan','移动','hand']] as const){const button=this.button(this.more,label,icon,()=>this.setTool({kind}),kind);this.tools.set(kind,button);this.editActions.push(button);}
  this.fingerButton=this.button(this.more,'手指书写','fingerprint',()=>this.setFingerWriting(!this.fingerWriting),'finger');this.editActions.push(this.fingerButton);
  this.fingerButton.title='开启后单指书写或擦除，双指仍移动与缩放；关闭可避免触摸意外留下笔迹。';
  this.settings.createDiv({cls:'ts-handwriting-panel-heading',text:'笔迹颜色'});
  const colors=this.settings.createDiv({cls:'ts-handwriting-colors',attr:{role:'group','aria-label':'笔迹颜色'}});
  for(const [color,label]of palette){const button=this.button(colors,label,'',()=>this.setTool({color,kind:'pen'}));button.addClass('ts-handwriting-color');button.dataset.inkColor=color;button.style.setProperty('--ink-color',color);this.colors.set(color,button);this.editActions.push(button);}
  const widthLabel=this.settings.createEl('label',{cls:'ts-handwriting-width'});widthLabel.createSpan({text:'粗细'});
  this.width=widthLabel.createEl('select',{attr:{'aria-label':'笔迹粗细'}});
  for(const [value,label]of [[1.5,'纤细'],[3,'细'],[5,'中'],[8,'粗']] as const)this.width.createEl('option',{text:`${label} · ${value} px`,attr:{value:String(value)}});
  this.width.value=String(this.tool.width);this.listen(this.width,'change',()=>this.setTool({width:Number(this.width.value)}));
  this.editActions.push(this.button(this.more,'重做','redo-2',()=>this.undo(true),'redo'),this.button(this.more,'居中笔迹','scan',()=>{this.closeMenus(true);this.fit();},'fit'));
  this.selectionActions.push(this.button(this.more,'复制选中笔迹','copy',()=>this.selectionAction('duplicate'),'duplicate-selection'),this.button(this.more,'删除选中笔迹','trash-2',()=>this.selectionAction('remove'),'delete-selection'));
  this.editActions.push(...this.selectionActions,this.button(this.more,'导出 / 插入笔记…','image',()=>{this.closeMenus();this.cancelInput('leave');const work=this.host.export?.();if(work)void work.catch(error=>this.host.notice(error instanceof Error?error.message:String(error)));},'export'));
  this.stage=this.element.createDiv({cls:'ts-handwriting-stage',attr:{tabindex:'0','aria-label':'手写画布 · 笔写字，双指移动与缩放'}});
  this.world=this.stage.createDiv('ts-handwriting-world');
  this.svg=doc.createElementNS(svgNamespace,'svg');this.svg.classList.add('ts-handwriting-ink');this.svg.setAttribute('aria-hidden','true');this.world.appendChild(this.svg);
  this.draftGroup=doc.createElementNS(svgNamespace,'g');this.draftGroup.classList.add('ts-handwriting-draft-fallback');this.svg.appendChild(this.draftGroup);
  this.selectionGroup=doc.createElementNS(svgNamespace,'g');this.selectionGroup.classList.add('ts-handwriting-selection');this.svg.appendChild(this.selectionGroup);
  this.selectionRect=doc.createElementNS(svgNamespace,'rect');this.selectionGroup.appendChild(this.selectionRect);this.selectionGroup.setAttribute('display','none');
  this.lassoPath=doc.createElementNS(svgNamespace,'path');this.lassoPath.classList.add('ts-handwriting-lasso');this.svg.appendChild(this.lassoPath);
  this.canvas=this.stage.createEl('canvas',{cls:'ts-handwriting-draft',attr:{'aria-hidden':'true'}});this.context=this.canvas.getContext('2d');
  this.hint=this.stage.createDiv('ts-handwriting-empty');
  this.hintTitle=this.hint.createDiv({cls:'ts-handwriting-empty-title',text:'写下第一笔'});
  this.hintDetail=this.hint.createDiv('ts-handwriting-empty-detail');
  this.selectionBar=this.stage.createDiv({cls:'ts-handwriting-selection-actions',attr:{role:'toolbar','aria-label':'选中笔迹操作'}});this.selectionBar.hidden=true;
  for(const [kind,label,icon]of [['duplicate','复制','copy'],['remove','删除','trash-2'],['cancel','取消','x']] as const){
   const button=this.button(this.selectionBar,label,icon,event=>this.nearbySelectionAction(kind,button,event),`${kind}-nearby-selection`);this.nearbyActions.set(button,kind);
  }
  const footer=this.element.createDiv('ts-handwriting-footer');this.status=footer.createSpan({attr:{role:'status','aria-live':'polite'}});
  footer.createSpan({cls:'ts-handwriting-navigation-hint',text:'双指移动与缩放'});
  this.mixed=this.element.createDiv({cls:'ts-handwriting-mixed',attr:{role:'status'}});this.mixed.hidden=true;
  this.controller=new HandwritingInputController({
   state:()=>{const snapshot=this.snapshot(),rect=this.stage.getBoundingClientRect();return{owner:snapshot?this.token(snapshot):undefined,writable:!!snapshot&&!snapshot.readOnly&&this.root.isConnected,canBeginInk:!this.rendering,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},viewport:snapshot?this.viewport(snapshot):{x:0,y:0,zoom:1}};},
   capture:id=>{try{this.stage.setPointerCapture(id);}catch{/* Document release listeners remain available. */}},
   release:id=>{try{if(this.stage.hasPointerCapture(id))this.stage.releasePointerCapture(id);}catch{/* The host can release capture before disposal. */}},
   requestFrame:callback=>this.win.requestAnimationFrame(callback),cancelFrame:frame=>this.win.cancelAnimationFrame(frame),
   preview:draft=>this.preview(draft),
   beginInk:(point,tool,owner)=>this.beginInk(point,tool,owner),commitStroke:(points,tool,owner,context)=>this.commitStroke(points,tool,owner,context),
   hitStrokeIds:(points,tool)=>this.eraseHits(points,tool),commitErase:(ids,owner,context)=>this.commitErase(ids,owner,context),commitSelection:(points,context,owner)=>this.commitSelection(points,context,owner),
   previewCamera:viewport=>this.previewCamera(viewport),commitCamera:(viewport,owner)=>this.commitCamera(viewport,owner),
   restoreCamera:()=>this.clearCameraPreview(),notice:message=>this.host.notice(message)
  },this.tool);
  const pointer=(run:(event:PointerEvent)=>boolean)=>(event:Event)=>{if(run(event as PointerEvent)){event.preventDefault();event.stopPropagation();}};
  this.listen(this.stage,'pointerdown',pointer(event=>{
   // A control's events never enter the ink controller, including a click on
   // its padding or a retargeted terminal event after it has been hidden.
   if(event.target&&this.selectionBar.contains(event.target as Node))return true;
   if(this.actionPointers.size){this.actionPointers.add(event.pointerId);this.invalidateSelectionPress();if(this.selectionPress)this.selectionPress.cancelled=true;return true;}
   if(this.suppressedPointerDown(event))return true;
   this.closeMenus();
   const consumed=this.controller.down(event),snapshot=this.snapshot();
   if(consumed){this.stagePointers.add(event.pointerId);this.invalidateSelectionPress();this.updateSelectionActions();}
   if(consumed&&(event.pointerType==='pen'||event.pointerType==='mouse')&&snapshot&&!snapshot.readOnly)this.stage.focus({preventScroll:true});
   return consumed;
  }));
  this.listen(this.stage,'pointermove',pointer(event=>this.controller.move(event)));
  this.listen(this.stage,'pointerup',pointer(event=>this.controller.up(event)));
  this.listen(this.stage,'pointercancel',pointer(event=>this.controller.cancel(event)));
  this.listen(this.stage,'lostpointercapture',pointer(event=>this.controller.lostCapture(event)));
  // Observe only this controller's active pointer IDs; document releases should
  // not suppress another view's own click or pointer handlers.
  this.listen(doc,'pointerup',event=>{const point=event as PointerEvent;this.stagePointers.delete(point.pointerId);this.actionPointers.delete(point.pointerId);if(this.selectionPress?.pointerId===point.pointerId){this.selectionPress.released=true;if(Math.hypot(point.clientX-this.selectionPress.clientX,point.clientY-this.selectionPress.clientY)>8)this.selectionPress.cancelled=true;}this.controller.up(point);this.updateSelectionActions();},true);
  this.listen(doc,'pointercancel',event=>{const point=event as PointerEvent;this.stagePointers.delete(point.pointerId);this.actionPointers.delete(point.pointerId);if(this.selectionPress?.pointerId===point.pointerId)this.selectionPress.cancelled=true;this.controller.cancel(point);this.updateSelectionActions();},true);
  this.listen(this.stage,'contextmenu',event=>{event.preventDefault();event.stopPropagation();});
  this.listen(this.stage,'dblclick',event=>{event.preventDefault();event.stopPropagation();});
  this.listen(this.stage,'keydown',event=>{
   const key=event as KeyboardEvent;if(key.isComposing||key.defaultPrevented)return;
   if(key.key==='Escape'){key.preventDefault();key.stopPropagation();this.closeMenus(true);this.cancelInput('leave');this.clearSelection();}
   else if((key.metaKey||key.ctrlKey)&&!key.altKey&&['z','y'].includes(key.key.toLowerCase())){key.preventDefault();key.stopPropagation();this.undo(key.shiftKey||key.key.toLowerCase()==='y');}
   else if(!key.metaKey&&!key.ctrlKey&&!key.altKey&&['Delete','Backspace'].includes(key.key)&&this.tool.kind==='lasso'&&this.selected.length){key.preventDefault();key.stopPropagation();this.selectionAction('remove');}
   else if(!key.metaKey&&!key.ctrlKey&&!key.altKey){const kind=toolKeys[key.key.toLowerCase()];if(kind){key.preventDefault();key.stopPropagation();this.setTool({kind});}}
  });
  this.listen(toolbar,'pointerdown',event=>event.stopPropagation());
  this.listen(this.selectionBar,'pointerdown',event=>this.pressSelectionAction(event as PointerEvent));
  for(const type of ['pointermove','pointerup','pointercancel','click','dblclick','contextmenu'])this.listen(this.selectionBar,type,event=>{event.stopPropagation();if(type==='pointermove'){const point=event as PointerEvent;if(this.selectionPress?.pointerId===point.pointerId&&Math.hypot(point.clientX-this.selectionPress.clientX,point.clientY-this.selectionPress.clientY)>8)this.selectionPress.cancelled=true;}if(type==='dblclick'||type==='contextmenu')event.preventDefault();});
  this.listen(this.selectionBar,'keydown',event=>{
   const key=event as KeyboardEvent;if(key.isComposing||key.defaultPrevented)return;
   if(['Enter',' '].includes(key.key)&&!this.actionPointers.size)this.selectionPress=undefined;
   if(key.key==='Escape'){key.preventDefault();key.stopPropagation();this.selectionPress=undefined;this.nearbySelectionAction('cancel',undefined);}
   else if(['ArrowLeft','ArrowRight','Home','End'].includes(key.key)){
    key.preventDefault();key.stopPropagation();const buttons=[...this.nearbyActions.keys()],index=buttons.indexOf(doc.activeElement as HTMLButtonElement),next=key.key==='Home'?0:key.key==='End'?buttons.length-1:(index+(key.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus({preventScroll:true});
   }
  });
  for(const panel of [this.settings,this.more]){
   this.listen(panel,'pointerdown',event=>event.stopPropagation());
   this.listen(panel,'keydown',event=>{const key=event as KeyboardEvent;if(key.key==='Escape'&&!key.isComposing){key.preventDefault();key.stopPropagation();this.closeMenus(true);}});
  }
  this.listen(doc,'pointerdown',event=>{
   const point=event as PointerEvent,target=event.target as Node|null;
   if(this.selectionPress&&!this.selectionPress.released&&point.pointerId!==this.selectionPress.pointerId){this.selectionPress.cancelled=true;this.invalidateSelectionPress();}
   if(target&&!this.selectionBar.contains(target)&&!this.stage.contains(target))this.invalidateSelectionPress();
   if(this.settings.hidden&&this.more.hidden)return;if(target&&![this.settings,this.more,this.settingsButton,this.moreButton].some(element=>element.contains(target)))this.closeMenus();
  },true);
  // Native keyboard dialogs can open without a pointer event or window blur.
  // A held control must not execute after that focus/navigation round-trip.
  this.listen(doc,'focusin',event=>{const target=event.target as Node|null;if(this.selectionPress&&!this.selectionPress.released&&target&&!this.selectionBar.contains(target))this.invalidateSelectionPress();},true);
  this.listen(doc,'keydown',event=>{const key=event as KeyboardEvent;if(this.selectionPress&&!this.selectionPress.released&&!['Shift','Control','Alt','Meta'].includes(key.key))this.invalidateSelectionPress();},true);
  this.listen(this.win,'blur',()=>{this.cancelInput('blur');this.hideSelectionActions(false);});
  this.listen(doc,'visibilitychange',()=>{if(doc.hidden){this.cancelInput('leave');this.hideSelectionActions(false);}});
  this.listen(this.win,'resize',()=>this.resize());
  if(this.win.visualViewport){this.listen(this.win.visualViewport,'resize',()=>this.resize());this.listen(this.win.visualViewport,'scroll',()=>this.resize());}
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.stage);
  this.removeListeners.push(bindBoardHostInset(this.element,footer,()=>{}));
  this.resize();this.refresh();
 }

 private listen(target:EventTarget,type:string,callback:EventListener,capture=false){target.addEventListener(type,callback,{capture,passive:false});this.removeListeners.push(()=>target.removeEventListener(type,callback,capture));}
 private button(parent:HTMLElement,label:string,icon:string,run:(event?:MouseEvent)=>void,action?:string){
  const button=parent.createEl('button',{cls:'ts-handwriting-button',attr:{type:'button','aria-label':label,title:label}});
  if(icon)setIcon(button.createSpan({cls:'ts-handwriting-icon',attr:{'aria-hidden':'true'}}),icon);
  if(action)button.dataset.inkAction=action;
  button.createSpan({text:label,cls:'ts-handwriting-caption'});this.listen(button,'click',event=>{if(!this.disposed&&!button.disabled)try{run(event as MouseEvent);}catch(error){this.host.notice(error instanceof Error?error.message:String(error));}});return button;
 }
 private toggleMenu(which:'settings'|'more'){
  const panel=which==='settings'?this.settings:this.more,button=which==='settings'?this.settingsButton:this.moreButton,open=panel.hidden;
  this.closeMenus();if(!open)return;this.cancelInput('leave');panel.hidden=false;this.updateSelectionActions();button.setAttribute('aria-expanded','true');this.menuOwner=this.owner;panel.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
 }
 private closeMenus(focus=false){const anchor=!this.settings.hidden?this.settingsButton:!this.more.hidden?this.moreButton:undefined;this.settings.hidden=true;this.more.hidden=true;this.settingsButton.setAttribute('aria-expanded','false');this.moreButton.setAttribute('aria-expanded','false');this.menuOwner=undefined;if(focus)anchor?.focus({preventScroll:true});this.updateSelectionActions();}
 private snapshot(){return this.disposed?undefined:this.host.snapshot();}
 private pointerNow(){return this.win.performance?.now()??Date.now();}
 /** A closing modal's next tap must not become a stroke on the surface below.
  * This belongs only to this view and exact session, without a global listener. */
 suppressPointerRepeat(point:{clientX:number;clientY:number;pointerType:string}):void {
  if(this.disposed)return;this.cancelInput('leave');this.pointerRepeat=undefined;
  const snapshot=this.snapshot();if(!snapshot||snapshot.readOnly||!Number.isFinite(point?.clientX)||!Number.isFinite(point?.clientY)||!['mouse','touch','pen'].includes(point?.pointerType))return;
  this.pointerRepeat={key:snapshot.key,clientX:point.clientX,clientY:point.clientY,pointerType:point.pointerType,until:this.pointerNow()+600};
 }
 private suppressedPointerDown(point:PointerEvent):boolean {
  const guard=this.pointerRepeat;if(!guard)return false;const snapshot=this.snapshot(),now=this.pointerNow();
  if(!snapshot||snapshot.readOnly||!this.root.isConnected||snapshot.key!==guard.key||now>=guard.until||point.pointerType!==guard.pointerType||!Number.isFinite(point.clientX)||!Number.isFinite(point.clientY)||Math.hypot(point.clientX-guard.clientX,point.clientY-guard.clientY)>24){this.pointerRepeat=undefined;return false;}
  guard.until=now+600;return true;
 }
 private token(snapshot:HandwritingSnapshot):Owner {if(!this.owner||this.owner.key!==snapshot.key||this.owner.board!==snapshot.board)this.owner={key:snapshot.key,board:snapshot.board};return this.owner;}
 private currentOwner(token:unknown){const snapshot=this.snapshot(),owner=this.owner;return snapshot&&owner&&!snapshot.readOnly&&this.root.isConnected&&token===owner&&owner.key===snapshot.key&&owner.board===snapshot.board?snapshot:undefined;}
 private viewport(snapshot:HandwritingSnapshot):HandwritingViewport {
  const preview=this.cameraPreview;return preview&&preview.owner===this.token(snapshot)&&sameViewport(preview.source,snapshot.board.viewport)?preview.viewport:snapshot.board.viewport;
 }
 private clearCameraPreview(){this.cameraPreview=undefined;this.inputBusy=false;const snapshot=this.snapshot();if(snapshot)this.transform(snapshot.board.viewport);}
 private cancelInput(reason:'owner'|'resize'|'blur'|'leave'){this.invalidateSelectionPress();this.stagePointers.clear();this.inputBusy=false;this.controller.reset(reason);this.clearCameraPreview();}
 private previewCamera(viewport:HandwritingViewport){
  this.invalidateSelectionPress();this.inputBusy=true;this.hideSelectionActions(false);
  const snapshot=this.currentOwner(this.owner);if(!snapshot)return;const owner=this.token(snapshot),preview=this.cameraPreview;
  if(preview&&(preview.owner!==owner||!sameViewport(preview.source,snapshot.board.viewport))){this.clearCameraPreview();return;}
  this.cameraPreview={owner,source:preview?.source||{...snapshot.board.viewport},viewport:{...viewport}};this.transform(viewport);
 }
 private commitCamera(viewport:HandwritingViewport,token:unknown){
  this.inputBusy=false;
  const snapshot=this.currentOwner(token),preview=this.cameraPreview;this.cameraPreview=undefined;
  if(!snapshot||preview&&(preview.owner!==token||!sameViewport(preview.source,snapshot.board.viewport))){this.refresh();return;}
  // A synchronous shared commit emits back to this view. Mark its camera as
  // already observed so that echo preserves remaining captured touch contacts.
  this.sharedCamera={owner:this.token(snapshot),viewport:{...viewport}};
  try{const work=this.host.camera({...viewport},snapshot.key,true);this.refresh();return work?.catch(error=>{this.refresh();throw error;});}
  catch(error){this.refresh();throw error;}
 }
 private camera(viewport:HandwritingViewport){
  const snapshot=this.snapshot(),owner=this.owner;if(!snapshot||!owner||snapshot.readOnly||!this.root.isConnected||owner.key!==snapshot.key||owner.board!==snapshot.board)return;
  try{const work=this.commitCamera(viewport,owner);if(work)void work.catch(error=>this.host.notice(error instanceof Error?error.message:String(error)));}
  catch(error){this.host.notice(error instanceof Error?error.message:String(error));}
 }
 private beginInk(point:HandwritingPoint,tool:Readonly<HandwritingTool>,token:unknown):InkContext|undefined {
  this.invalidateSelectionPress();this.inputBusy=true;this.hideSelectionActions(false);
  const snapshot=this.currentOwner(token);if(!snapshot||this.rendering)return;
  const ink=snapshot.board.ink,ids=this.selectionInk===ink?[...this.selected]:[];
  return{owner:this.token(snapshot),ink,start:{...point},ids,move:tool.kind==='lasso'&&!!ink&&hitSelectedInk(ink,ids,point.x,point.y,6/this.viewport(snapshot).zoom)};
 }
 private inkContext(context:unknown,token:unknown):InkContext|undefined {
  const value=context as InkContext|undefined,snapshot=this.currentOwner(token);
  return value&&snapshot&&value.owner===token&&value.ink===snapshot.board.ink?value:undefined;
 }
 private commitStroke(points:readonly HandwritingPoint[],tool:Readonly<HandwritingTool>,token:unknown,context?:unknown){
  const snapshot=this.currentOwner(token);if(!snapshot)return;
  const captured=this.inkContext(context,token);if(!captured)return;
  const stroke:InkStroke={id:uid(),color:tool.color,width:tool.width,points:points.map(point=>[point.x,point.y,point.pressure])};
  assertInkData({version:1,strokes:[...(snapshot.board.ink?.strokes||[]),stroke]});return this.host.commitInk&&captured.ink?this.host.commitInk({kind:'append',stroke},snapshot.key,captured.ink):this.host.commitStroke(stroke,snapshot.key);
 }
 private commitErase(ids:readonly string[],token:unknown,context?:unknown){const snapshot=this.currentOwner(token),captured=this.inkContext(context,token);if(!snapshot||!captured)return;return this.host.commitInk&&captured.ink?this.host.commitInk({kind:'remove',ids},snapshot.key,captured.ink):this.host.commitErase(ids,snapshot.key);}
 private commitSelection(points:readonly HandwritingPoint[],context:unknown,token:unknown){
  const captured=this.inkContext(context,token),snapshot=this.currentOwner(token);if(!captured||!snapshot||!captured.ink||!points.length)return;
  if(captured.move){
   const last=points[points.length-1],dx=last.x-captured.start.x,dy=last.y-captured.start.y;if(!dx&&!dy)return;
   if(!this.host.commitInk){this.host.notice('当前视图暂不支持移动笔迹');return;}
   const work=this.host.commitInk({kind:'translate',ids:captured.ids,dx,dy},snapshot.key,captured.ink);
   if(this.currentOwner(token)){this.selected=captured.ids;this.selectionInk=this.snapshot()?.board.ink;this.refresh();}return work;
  }
  const polygon:InkPoint[]=points.map(point=>[point.x,point.y,point.pressure]),span=Math.max(...points.map(point=>Math.hypot(point.x-captured.start.x,point.y-captured.start.y)))*this.viewport(snapshot).zoom;
  this.selected=points.length>=3&&span>=6?selectInkLasso(captured.ink,polygon):captured.ink.strokes.filter(stroke=>hitInkStroke(stroke,captured.start.x,captured.start.y,6/this.viewport(snapshot).zoom)).map(stroke=>stroke.id);
  this.selectionInk=captured.ink;this.drawSelection();this.refresh();
 }
 private clearSelection(){this.invalidateSelectionPress();this.selected=[];this.selectionInk=undefined;this.selectionDelta={x:0,y:0};this.drawSelection();}
 private drawSelection(){
  const ink=this.snapshot()?.board.ink,ids=new Set(this.selected),bounds=ink&&inkBounds({version:1,strokes:ink.strokes.filter(stroke=>ids.has(stroke.id))});
  for(const [id,row]of this.paths){const selected=String(ids.has(id)),transform=ids.has(id)&&(this.selectionDelta.x!==0||this.selectionDelta.y!==0)?`translate(${this.selectionDelta.x} ${this.selectionDelta.y})`:'';if(row.element.getAttribute('data-ink-selected')!==selected)row.element.setAttribute('data-ink-selected',selected);if(row.element.getAttribute('transform')!==transform)row.element.setAttribute('transform',transform);}
  this.selectionBounds=bounds;this.selectionGroup.setAttribute('display',bounds?'inline':'none');if(bounds){for(const [key,value]of Object.entries(bounds))this.selectionRect.setAttribute(key,String(value));this.selectionGroup.setAttribute('transform',`translate(${this.selectionDelta.x} ${this.selectionDelta.y})`);}
  for(const button of this.selectionActions)button.disabled=!ids.size||!this.host.commitInk||!!this.snapshot()?.readOnly;
  this.updateSelectionActions();
  if(!this.refreshing&&this.owner)this.renderInk();
 }
 private invalidateSelectionPress(){this.selectionEpoch++;}
 private actionViewport():InkActionViewport {
  const visible=this.win.visualViewport,rect=this.stage.getBoundingClientRect();
  return{offsetLeft:visible?.offsetLeft??0,offsetTop:visible?.offsetTop??0,width:visible?.width??this.win.innerWidth??rect.left+rect.width,height:visible?.height??this.win.innerHeight??rect.top+rect.height};
 }
 private validSelection(){
  const snapshot=this.currentOwner(this.owner),ink=snapshot?.board.ink;
  if(!snapshot||!ink||ink!==this.selectionInk||!this.selected.length||!this.host.commitInk||this.tool.kind!=='lasso'||this.rendering)return;
  const live=new Set(ink.strokes.map(stroke=>stroke.id));return this.selected.every(id=>live.has(id))?{snapshot,ink,owner:this.owner!}:undefined;
 }
 private hideSelectionActions(focus=true){
  this.selectionBar.hidden=true;
  const active=this.root.ownerDocument.activeElement;
  if(focus&&active&&this.selectionBar.contains(active)&&this.currentOwner(this.owner)&&!this.root.ownerDocument.hidden&&this.settings.hidden&&this.more.hidden)this.stage.focus({preventScroll:true});
 }
 private updateSelectionActions(){
  if(!this.selectionBar)return;
  const valid=this.validSelection();
  if(this.disposed||!valid||!this.selectionBounds||this.inputBusy||this.draft||this.cameraPreview||this.stagePointers.size||!this.settings.hidden||!this.more.hidden||this.root.ownerDocument.hidden){this.hideSelectionActions();return;}
  this.selectionBar.hidden=false;
  const rect=this.stage.getBoundingClientRect(),size=this.selectionBar.getBoundingClientRect(),computed=typeof this.win.getComputedStyle==='function'?this.win.getComputedStyle(this.selectionBar):undefined;
  const inset=(side:string)=>Math.max(0,Number.parseFloat(computed?.getPropertyValue(`--ts-ink-safe-${side}`)||'0')||0);
  const position=inkSelectionActionPosition(rect,this.selectionBounds,this.viewport(valid.snapshot),size,this.actionViewport(),{left:inset('left'),top:inset('top'),right:inset('right'),bottom:inset('bottom')});
  if(!position){this.hideSelectionActions();return;}
  this.selectionBar.style.left=`${position.left}px`;this.selectionBar.style.top=`${position.top}px`;
 }
 private pressSelectionAction(event:PointerEvent){
  event.preventDefault();event.stopPropagation();
  const target=event.target as Node|null,button=[...this.nearbyActions.keys()].find(button=>target&&button.contains(target)),valid=this.validSelection();
  this.invalidateSelectionPress();
  if(!button||!valid||this.selectionBar.hidden||this.stagePointers.size||!['mouse','touch','pen'].includes(event.pointerType)||(event.button??0)!==0||event.ctrlKey||![event.pointerId,event.clientX,event.clientY].every(Number.isFinite))return;
  this.actionPointers.add(event.pointerId);
  if(this.actionPointers.size!==1){if(this.selectionPress)this.selectionPress.cancelled=true;return;}
  const rect=this.stage.getBoundingClientRect();
  this.selectionPress={owner:valid.owner,ink:valid.ink,ids:[...this.selected],epoch:this.selectionEpoch,viewport:{...this.viewport(valid.snapshot)},rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},visible:this.actionViewport(),button,pointerId:event.pointerId,pointerType:event.pointerType,clientX:event.clientX,clientY:event.clientY,released:false,cancelled:false};
  button.focus({preventScroll:true});
 }
 private nearbySelectionAction(kind:SelectionAction,button?:HTMLButtonElement,event?:MouseEvent){
  event?.preventDefault();event?.stopPropagation();
  const valid=this.validSelection(),press=this.selectionPress;
  this.selectionPress=undefined;
  if(!valid||this.selectionBar.hidden||this.inputBusy||this.stagePointers.size||this.actionPointers.size||!this.settings.hidden||!this.more.hidden)return;
  if(event&&(event.detail??0)>0&&!press)return;
  if(press){
   const rect=this.stage.getBoundingClientRect(),visible=this.actionViewport();
   if(press.cancelled||!press.released||press.button!==button||press.epoch!==this.selectionEpoch||press.owner!==valid.owner||press.ink!==valid.ink||press.ids.length!==this.selected.length||press.ids.some((id,index)=>id!==this.selected[index])||!sameViewport(press.viewport,this.viewport(valid.snapshot))||['left','top','width','height'].some(key=>Reflect.get(rect,key)!==Reflect.get(press.rect,key))||['offsetLeft','offsetTop','width','height'].some(key=>Reflect.get(visible,key)!==Reflect.get(press.visible,key)))return;
  }
  try{if(kind==='cancel'){this.cancelInput('leave');this.clearSelection();this.stage.focus({preventScroll:true});}else this.selectionAction(kind);}
  finally{
   // The disappearing control must not turn a fast second tap into ink or a
   // new lasso gesture. Reuse the exact-session, exact-point scoped guard.
   if(press&&this.snapshot()?.key===press.owner.key)this.suppressPointerRepeat(press);
  }
 }
 private selectionAction(kind:'duplicate'|'remove'){
  const token=this.owner,snapshot=this.currentOwner(token),ink=snapshot?.board.ink;if(!snapshot||!ink||!this.selected.length||this.selectionInk!==ink||!this.host.commitInk||!token||this.rendering)return;
  const ids=[...this.selected];this.closeMenus(true);this.cancelInput('leave');
  const edit:InkEdit=kind==='remove'?{kind,ids}:{kind,ids,dx:24,dy:24,newIds:ids.map(()=>uid())};
  const work=this.host.commitInk(edit,snapshot.key,ink);this.clearSelection();if(work)void work.catch(error=>this.host.notice(error instanceof Error?error.message:String(error)));this.refresh();
 }
 private eraseHits(points:readonly HandwritingPoint[],_tool:Readonly<HandwritingTool>):readonly string[]{
  const snapshot=this.snapshot();if(!snapshot||snapshot.readOnly)return[];const radius=12/this.viewport(snapshot).zoom;
  const path:InkPoint[]=points.map(point=>[point.x,point.y,point.pressure]);
  return(snapshot.board.ink?.strokes||[]).filter(stroke=>hitInkStrokePath(stroke,path,radius)).map(stroke=>stroke.id);
 }
 private setTool(next:Partial<HandwritingTool>){this.closeMenus(true);this.controller.setTool(next);this.clearCameraPreview();this.tool={...this.tool,...next};if(this.tool.kind!=='lasso')this.clearSelection();this.refresh();}
 private setFingerWriting(enabled:boolean){this.closeMenus(true);this.controller.setTouchWriting(enabled);this.clearCameraPreview();this.fingerWriting=enabled;this.refresh();}
 private syncTools(){
  this.stage.dataset.tool=this.tool.kind;
  for(const [kind,button]of this.tools){button.setAttribute('aria-pressed',String(kind===this.tool.kind));button.toggleClass('is-active',kind===this.tool.kind);}
  for(const [color,button]of this.colors)button.setAttribute('aria-pressed',String(color===this.tool.color));
  this.width.value=String(this.tool.width);
  const color=palette.find(([value])=>value===this.tool.color)?.[1]||this.tool.color;
  this.currentTool.setText(this.tool.kind==='pen'?(this.fingerWriting?'手指 / 笔':'笔'):this.tool.kind==='eraser'?'整笔擦除':this.tool.kind==='lasso'?'套索':'移动');
  this.penSummary.setText(`${color} · ${this.tool.width} px`);
  this.penPreview.style.setProperty('--ink-color',this.tool.color);this.penPreview.style.setProperty('--ink-width',`${this.tool.width}px`);
  this.settingsButton.title=`笔设置 · ${color} · ${this.tool.width} px`;
  this.fingerButton.setAttribute('aria-pressed',String(this.fingerWriting));this.fingerButton.toggleClass('is-active',this.fingerWriting);
  this.moreButton.setAttribute('aria-pressed',String(this.tool.kind==='lasso'||this.tool.kind==='pan'));this.moreButton.dataset.fingerWriting=String(this.fingerWriting);
  this.stage.setAttribute('aria-label',this.tool.kind==='lasso'?'手写画布 · 圈选整笔，拖动选中笔迹，双指移动与缩放':this.fingerWriting?'手写画布 · 单指或笔书写，双指移动与缩放':'手写画布 · 笔写字，双指移动与缩放');
 }
 private undo(redo:boolean){const snapshot=this.snapshot();if(!snapshot||snapshot.readOnly||!this.root.isConnected)return;this.closeMenus(true);this.cancelInput('leave');this.clearSelection();this.host.undo(redo);this.refresh();}
 fit():void {
  const snapshot=this.snapshot();if(!snapshot||snapshot.readOnly)return;this.cancelInput('leave');
  const bounds=snapshot.board.ink&&inkBounds(snapshot.board.ink);if(!bounds){this.host.notice('还没有笔迹可居中');return;}
  const rect=this.stage.getBoundingClientRect(),zoom=Math.max(.15,Math.min(2.5,(Math.max(1,rect.width-80))/Math.max(1,bounds.width),(Math.max(1,rect.height-80))/Math.max(1,bounds.height)));
  const viewport={x:rect.width/2-(bounds.x+bounds.width/2)*zoom,y:rect.height/2-(bounds.y+bounds.height/2)*zoom,zoom};
  this.camera(viewport);
 }
 private transform(viewport:HandwritingViewport){this.world.style.transform=`translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;this.stage.style.setProperty('--ink-grid-step',`${24*viewport.zoom}px`);this.stage.style.backgroundPosition=`${viewport.x}px ${viewport.y}px`;this.updateSelectionActions();if(!this.refreshing&&this.owner)this.renderInk();}
 private cancelInkRender(){if(this.renderFrame!==undefined)this.win.cancelAnimationFrame(this.renderFrame);this.renderFrame=undefined;this.renderGeneration++;this.renderBasis=undefined;this.rendering=false;}
 private syncStatus(){
  const snapshot=this.snapshot();if(!snapshot)return;
  this.stage.setAttribute('aria-busy',String(this.rendering));this.stage.dataset.inkRenderState=this.rendering?'loading':'ready';
  for(const button of this.selectionActions)button.disabled=this.rendering||snapshot.readOnly||!this.selected.length||!this.host.commitInk;
  this.status.setText(this.rendering?snapshot.readOnly?'只读 · 正在显示笔迹':'正在显示笔迹 · 可移动、缩放或导出':snapshot.readOnly?'只读 · 内容已保护':this.tool.kind==='lasso'?this.selected.length?`已选 ${this.selected.length} 笔 · 拖动笔迹移动`:'圈选整笔 · 双指移动':this.tool.kind==='eraser'?'擦除整条笔迹':this.tool.kind==='pan'?'鼠标拖动 · 双指移动':this.fingerWriting?'手指或笔写字 · 双指移动与缩放':'笔写字 · 双指移动与缩放');
 }
 private renderInk(force=false){
  const snapshot=this.snapshot();if(!snapshot||!this.root.isConnected||!this.owner)return;
  if(this.root.ownerDocument.defaultView!==this.win||this.win.closed){this.cancelInkRender();this.syncStatus();return;}
  const viewport={...this.viewport(snapshot)},rect=this.stage.getBoundingClientRect(),clip=visibleInkWorldRect(rect,viewport,this.actionViewport()),selection=this.selected.join('\0'),dx=this.selectionDelta.x,dy=this.selectionDelta.y;
  const strokes=snapshot.board.ink?.strokes||[],points=strokes.reduce((sum,stroke)=>sum+stroke.points.length,0),large=points>INK_VECTOR_ASYNC_POINTS;
  const sources=large?strokes.map(stroke=>({stroke,id:stroke.id,color:stroke.color,token:this.visiblePaths.sourceToken(stroke)})):undefined;
  const next:InkRenderBasis={owner:this.token(snapshot),ink:snapshot.board.ink,viewport,clip,selection,dx,dy,sources},previous=this.renderBasis;
  const sameClip=(!previous?.clip&&!clip)||!!previous?.clip&&!!clip&&['x','y','width','height'].every(key=>Reflect.get(previous.clip!,key)===Reflect.get(clip,key));
  const sameSource=!!sources&&!!previous?.sources&&sources.length===previous.sources.length&&sources.every((source,index)=>{const before=previous.sources![index];return before.stroke===source.stroke&&before.id===source.id&&before.color===source.color&&before.token===source.token;});
  if((!force&&!large||sameSource)&&previous&&previous.owner===next.owner&&previous.ink===next.ink&&sameViewport(previous.viewport,viewport)&&sameClip&&previous.selection===selection&&previous.dx===dx&&previous.dy===dy){this.syncStatus();return;}
  this.cancelInkRender();this.renderBasis=next;const generation=this.renderGeneration,ids=new Set(this.selected);
  this.stage.dataset.inkSourcePoints=String(points);let index=0,projected=0;this.rendering=large;this.syncStatus();this.updateSelectionActions();
  const current=()=>{
   const value=this.snapshot();if(generation!==this.renderGeneration||this.renderBasis!==next||!value||this.owner!==next.owner||this.root.ownerDocument.defaultView!==this.win||this.win.closed||!this.root.isConnected||value.key!==next.owner.key||value.board!==next.owner.board||value.board.ink!==next.ink||!sameViewport(this.viewport(value),viewport)||this.selected.join('\0')!==selection||this.selectionDelta.x!==dx||this.selectionDelta.y!==dy)return false;
   const freshClip=visibleInkWorldRect(this.stage.getBoundingClientRect(),viewport,this.actionViewport());
   return !clip&&!freshClip||!!clip&&!!freshClip&&['x','y','width','height'].every(key=>Reflect.get(clip,key)===Reflect.get(freshClip,key));
  };
  const batch=()=>{
   if(!current()){if(generation===this.renderGeneration){this.cancelInkRender();this.refresh();}return;}this.renderFrame=undefined;
   const started=this.pointerNow();let changedPoints=0;
   while(index<strokes.length){
    const stroke=strokes[index++],selected=ids.has(stroke.id);let row=this.paths.get(stroke.id);
    // Translation is a display transform. Query source fragments in the
    // translated camera so a selected stroke entering the view is not culled.
    const effective=selected&&(dx||dy)?visibleInkWorldRect(rect,{x:viewport.x+dx*viewport.zoom,y:viewport.y+dy*viewport.zoom,zoom:viewport.zoom},this.actionViewport()):clip;
    const projection=this.visiblePaths.project(stroke,effective,row?.cursor,large);projected+=projection.projectedSamples;
    if(!row){const element=this.root.ownerDocument.createElementNS(svgNamespace,'path');element.setAttribute('fill-rule','nonzero');element.setAttribute('data-ink-id',stroke.id);element.setAttribute('data-ink-selected',String(selected));element.setAttribute('transform',selected&&(dx||dy)?`translate(${dx} ${dy})`:'');element.setAttribute('fill',stroke.color);this.svg.insertBefore(element,this.draftGroup);row={stroke,element};this.paths.set(stroke.id,row);}
    if(projection.path!==undefined){if(projection.cursor||row.path!==projection.path)row.element.setAttribute('d',projection.path);row.path=projection.cursor?undefined:projection.path;changedPoints+=projection.projectedSamples;}
    row.cursor=projection.cursor;if(row.stroke!==stroke||row.element.getAttribute('fill')!==stroke.color){row.stroke=stroke;row.element.setAttribute('fill',stroke.color);}
    if(large&&index<strokes.length&&(changedPoints>=INK_VECTOR_BATCH_POINTS||this.pointerNow()-started>=8))break;
   }
   this.stage.dataset.inkProjectedPoints=String(projected);
   if(index<strokes.length){this.rendering=true;this.renderFrame=this.win.requestAnimationFrame(batch);}else{this.rendering=false;this.syncStatus();this.drawSelection();}
  };
  // Large cold sources yield before encoding or constructing thousands of SVG
  // nodes. Small boards retain their immediate edit/read behavior.
  if(large)this.renderFrame=this.win.requestAnimationFrame(batch);else batch();
 }
 refresh():void {
  if(this.disposed)return;this.refreshing=true;try{const snapshot=this.snapshot();
  if(!snapshot){this.cancelInkRender();this.pointerRepeat=undefined;this.cancelInput('owner');this.clearSelection();this.closeMenus();this.pathCache.clear();this.visiblePaths.clear();this.owner=undefined;this.sharedCamera=undefined;this.element.hidden=true;return;}this.element.hidden=false;
  if(snapshot.readOnly||this.pointerRepeat&&this.pointerRepeat.key!==snapshot.key)this.pointerRepeat=undefined;
  if(this.owner&&(this.owner.key!==snapshot.key||this.owner.board!==snapshot.board)){this.cancelInkRender();this.cancelInput('owner');this.clearSelection();this.closeMenus();if(this.owner.key!==snapshot.key){this.pathCache.clear();this.visiblePaths.clear();}}const owner=this.token(snapshot);
  const shared=this.sharedCamera,preview=this.cameraPreview;
  if(shared?.owner===owner&&!sameViewport(shared.viewport,snapshot.board.viewport)||preview&&(preview.owner!==owner||!sameViewport(preview.source,snapshot.board.viewport)))this.cancelInput('owner');
  this.sharedCamera={owner,viewport:{...snapshot.board.viewport}};
  if(snapshot.readOnly){this.cancelInput('owner');this.clearSelection();this.closeMenus();}else if(this.menuOwner&&this.menuOwner!==owner)this.closeMenus();
  this.element.toggleClass('is-readonly',snapshot.readOnly);for(const action of this.editActions)action.disabled=snapshot.readOnly;this.width.disabled=snapshot.readOnly;
  const exportButton=this.editActions.find(button=>button.dataset.inkAction==='export');if(exportButton)exportButton.disabled=snapshot.readOnly||!this.host.export;
  const strokes=snapshot.board.ink?.strokes||[],live=new Set(strokes.map(stroke=>stroke.id));
  if(this.selectionInk&&this.selectionInk!==snapshot.board.ink){const previous=new Map(this.selectionInk.strokes.map(stroke=>[stroke.id,stroke]));if(this.selected.some(id=>previous.get(id)!==strokes.find(stroke=>stroke.id===id)))this.clearSelection();else this.selectionInk=snapshot.board.ink;}
  for(const [id,row]of this.paths)if(!live.has(id)){row.element.remove();this.paths.delete(id);}
  this.drawSelection();this.hint.hidden=!!strokes.length||!!this.draft||snapshot.readOnly;
  this.hintTitle.setText(this.tool.kind==='pen'?'写下第一笔':'纸上还没有笔迹');
  this.hintDetail.setText(this.tool.kind!=='pen'?'选择工具栏中的笔，开始书写。':this.fingerWriting?'用手指、笔或鼠标书写；双指移动与缩放。':'用笔或鼠标书写。触屏可在“更多”中开启手指书写。');
  const hidden=snapshot.board.nodes.length+snapshot.board.edges.length;this.mixed.hidden=!hidden;if(hidden)this.mixed.setText(`文件还保留 ${snapshot.board.nodes.length} 个卡片、${snapshot.board.edges.length} 条连线；手写页面暂不显示这些内容。`);
  this.transform(this.viewport(snapshot));this.syncTools();this.renderInk(true);
  }finally{this.refreshing=false;}
 }
 private resize(){
  if(this.disposed)return;this.invalidateSelectionPress();const rect=this.stage.getBoundingClientRect(),dpr=Math.max(1,Math.min(4,this.win.devicePixelRatio||1));
  const resized=rect.width!==this.size.width||rect.height!==this.size.height||dpr!==this.size.dpr;
  if(resized){this.size={width:rect.width,height:rect.height,dpr};this.canvas.width=Math.max(1,Math.round(rect.width*dpr));this.canvas.height=Math.max(1,Math.round(rect.height*dpr));this.drawn=0;this.draftGroup.replaceChildren();}
  this.controller.layoutChanged();
  if(resized&&!this.draft)this.preview(null);
  this.updateSelectionActions();
  if(this.owner&&!this.refreshing)this.renderInk();
 }
 private preview(draft:HandwritingDraft|null){
  if(this.disposed)return;const ctx=this.context,snapshot=this.snapshot(),viewport=snapshot?this.viewport(snapshot):{x:0,y:0,zoom:1},dpr=this.size.dpr;
  const clear=()=>{ctx?.setTransform(1,0,0,1,0,0);ctx?.clearRect(0,0,this.canvas.width,this.canvas.height);this.draftGroup.replaceChildren();this.drawn=0;};
  if(!draft){clear();this.inputBusy=false;this.draft=undefined;this.lassoPath.setAttribute('d','');this.selectionDelta={x:0,y:0};this.drawSelection();this.hint.hidden=!!this.snapshot()?.board.ink?.strokes.length||!!this.snapshot()?.readOnly;return;}
  this.hint.hidden=true;
  if(draft.tool.kind==='lasso'){
   clear();this.draft=draft;const context=this.inkContext(draft.context,this.owner);if(!context){this.cancelInput('owner');return;}
   if(context.move){const last=draft.points.at(-1);this.selectionDelta={x:last?last.x-context.start.x:0,y:last?last.y-context.start.y:0};this.drawSelection();}
   else this.lassoPath.setAttribute('d',draft.points.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join('')+'Z');return;
  }
  if(!this.draft||draft.tool.kind!==this.draft.tool.kind||draft.points.length<this.drawn)clear();this.draft=draft;
  if(draft.tool.kind==='eraser'){
   clear();const last=draft.points.at(-1);if(ctx&&last){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.beginPath();ctx.arc(last.x*viewport.zoom+viewport.x,last.y*viewport.zoom+viewport.y,12,0,Math.PI*2);ctx.strokeStyle='#777';ctx.lineWidth=1;ctx.stroke();}return;
  }
  const PathType=Reflect.get(this.win,'Path2D') as typeof Path2D|undefined;
  let fallback='';
  if(ctx&&PathType){ctx.setTransform(dpr*viewport.zoom,0,0,dpr*viewport.zoom,dpr*viewport.x,dpr*viewport.y);ctx.fillStyle=draft.tool.color;}
  for(let i=this.drawn;i<draft.points.length;i++){
   const first=draft.points[Math.max(0,i-1)],last=draft.points[i],points:InkPoint[]=i?[[first.x,first.y,first.pressure],[last.x,last.y,last.pressure]]:[[last.x,last.y,last.pressure]];
   const path=strokePath({id:'draft',color:draft.tool.color,width:draft.tool.width,points});
   if(ctx&&PathType)ctx.fill(new PathType(path));else fallback+=path;
  }
  if(fallback){const path=this.root.ownerDocument.createElementNS(svgNamespace,'path');path.setAttribute('d',fallback);path.setAttribute('fill',draft.tool.color);path.setAttribute('fill-rule','nonzero');this.draftGroup.appendChild(path);}
  this.drawn=draft.points.length;
 }
 dispose():void {
  if(this.disposed)return;this.disposed=true;this.cancelInkRender();this.invalidateSelectionPress();this.selectionPress=undefined;this.stagePointers.clear();this.actionPointers.clear();this.pointerRepeat=undefined;this.controller.dispose();this.clearCameraPreview();this.resizeObserver.disconnect();for(const remove of this.removeListeners.splice(0))remove();this.paths.clear();this.pathCache.clear();this.visiblePaths.clear();this.element.remove();this.root.removeClass('ts-handwriting-board');this.owner=undefined;this.sharedCamera=undefined;
 }
}
