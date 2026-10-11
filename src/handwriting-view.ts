import {setIcon} from 'obsidian';
import {uid,type Board} from './model';
import {assertInkData,inkBounds,strokePath,hitInkStrokePath,type InkStroke,type InkPoint} from './ink-model';
import {HandwritingInputController,DEFAULT_HANDWRITING_TOOL,type HandwritingDraft,type HandwritingTool,type HandwritingViewport,type HandwritingPoint} from './handwriting-input';

export interface HandwritingSnapshot {key:unknown;board:Board;readOnly:boolean}
export interface HandwritingHost {
 snapshot():HandwritingSnapshot|undefined;
 commitStroke(stroke:InkStroke,key:unknown):void|Promise<void>;
 commitErase(ids:readonly string[],key:unknown):void|Promise<void>;
 camera(viewport:HandwritingViewport,key:unknown,persist:boolean):void|Promise<void>;
 undo(redo:boolean):void;
 notice(message:string):void;
}
interface Owner {key:unknown;board:Board}
interface CameraPreview {owner:Owner;source:HandwritingViewport;viewport:HandwritingViewport}
const sameViewport=(a:HandwritingViewport,b:HandwritingViewport)=>a.x===b.x&&a.y===b.y&&a.zoom===b.zoom;
const palette=[['#222222','石墨'],['#315e9b','蓝色'],['#b34643','红色'],['#467153','绿色'],['#795c9a','紫色']] as const;
const svgNamespace='http://www.w3.org/2000/svg';

/** Dedicated ink surface. No ordinary-board pointer handler is mounted here. */
export class HandwritingView {
 private readonly element:HTMLElement;private readonly stage:HTMLElement;private readonly world:HTMLElement;
 private readonly svg:SVGSVGElement;private readonly canvas:HTMLCanvasElement;private readonly context:CanvasRenderingContext2D|null;
 private readonly hint:HTMLElement;private readonly mixed:HTMLElement;private readonly status:HTMLElement;
 private readonly controller:HandwritingInputController;private readonly resizeObserver:ResizeObserver;
 private readonly win:Window;private readonly removeListeners:(()=>void)[]=[];
 private readonly paths=new Map<string,{stroke:InkStroke;element:SVGPathElement}>();
 private readonly tools=new Map<HandwritingTool['kind'],HTMLButtonElement>();private readonly colors=new Map<string,HTMLButtonElement>();
 private readonly editActions:HTMLButtonElement[]=[];private readonly width:HTMLSelectElement;private readonly fingerButton:HTMLButtonElement;
 private readonly draftGroup:SVGGElement;private owner?:Owner;private disposed=false;
 private tool:HandwritingTool={...DEFAULT_HANDWRITING_TOOL};private drawn=0;private draft?:HandwritingDraft;
 private fingerWriting=false;
 private size={width:0,height:0,dpr:1};
 private cameraPreview?:CameraPreview;private sharedCamera?:{owner:Owner;viewport:HandwritingViewport};

 constructor(private root:HTMLElement,private host:HandwritingHost){
  const doc=root.ownerDocument,win=doc.defaultView;if(!win)throw Error('手写页面尚未就绪');this.win=win;
  root.addClass('ts-handwriting-board');this.element=root.createDiv({cls:'ts-handwriting',attr:{'aria-label':'手写白板'}});
  const toolbar=this.element.createDiv({cls:'ts-handwriting-toolbar',attr:{role:'toolbar','aria-label':'手写工具'}});
  const modes=toolbar.createDiv({cls:'ts-handwriting-tools',attr:{role:'group','aria-label':'工具'}});
  for(const [kind,label,icon]of [['pen','笔','pen-tool'],['eraser','整笔擦除','eraser'],['pan','移动','hand']] as const){
   const button=this.button(modes,label,icon,()=>this.setTool({kind}));this.tools.set(kind,button);this.editActions.push(button);
  }
  this.fingerButton=this.button(modes,'手指书写','fingerprint',()=>this.setFingerWriting(!this.fingerWriting));this.editActions.push(this.fingerButton);
  this.fingerButton.title='开启后单指书写或擦除，双指仍移动与缩放；关闭可避免触摸意外留下笔迹。';
  const colors=toolbar.createDiv({cls:'ts-handwriting-colors',attr:{role:'group','aria-label':'笔迹颜色'}});
  for(const [color,label]of palette){const button=this.button(colors,label,'',()=>this.setTool({color,kind:'pen'}));button.addClass('ts-handwriting-color');button.style.setProperty('--ink-color',color);this.colors.set(color,button);this.editActions.push(button);}
  const widthLabel=toolbar.createEl('label',{cls:'ts-handwriting-width'});widthLabel.createSpan({text:'粗细'});
  this.width=widthLabel.createEl('select',{attr:{'aria-label':'笔迹粗细'}});
  for(const value of [1.5,3,5,8])this.width.createEl('option',{text:String(value),attr:{value:String(value)}});
  this.width.value=String(this.tool.width);this.listen(this.width,'change',()=>this.setTool({width:Number(this.width.value)}));
  const actions=toolbar.createDiv({cls:'ts-handwriting-actions',attr:{role:'group','aria-label':'笔迹操作'}});
  this.editActions.push(this.button(actions,'撤销','undo-2',()=>this.undo(false)),this.button(actions,'重做','redo-2',()=>this.undo(true)),this.button(actions,'居中笔迹','scan',()=>this.fit()));
  this.stage=this.element.createDiv({cls:'ts-handwriting-stage',attr:{tabindex:'0','aria-label':'手写画布 · 笔写字，双指移动与缩放'}});
  this.world=this.stage.createDiv('ts-handwriting-world');
  this.svg=doc.createElementNS(svgNamespace,'svg');this.svg.classList.add('ts-handwriting-ink');this.svg.setAttribute('aria-hidden','true');this.world.appendChild(this.svg);
  this.draftGroup=doc.createElementNS(svgNamespace,'g');this.draftGroup.classList.add('ts-handwriting-draft-fallback');this.svg.appendChild(this.draftGroup);
  this.canvas=this.stage.createEl('canvas',{cls:'ts-handwriting-draft',attr:{'aria-hidden':'true'}});this.context=this.canvas.getContext('2d');
  this.hint=this.stage.createDiv({cls:'ts-handwriting-empty',text:'用笔写下第一笔'});
  const footer=this.element.createDiv('ts-handwriting-footer');this.status=footer.createSpan({attr:{role:'status','aria-live':'polite'}});
  footer.createSpan({cls:'ts-handwriting-navigation-hint',text:'双指移动与缩放'});
  this.mixed=this.element.createDiv({cls:'ts-handwriting-mixed',attr:{role:'status'}});this.mixed.hidden=true;
  this.controller=new HandwritingInputController({
   state:()=>{const snapshot=this.snapshot(),rect=this.stage.getBoundingClientRect();return{owner:snapshot?this.token(snapshot):undefined,writable:!!snapshot&&!snapshot.readOnly&&this.root.isConnected,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},viewport:snapshot?this.viewport(snapshot):{x:0,y:0,zoom:1}};},
   capture:id=>{try{this.stage.setPointerCapture(id);}catch{/* Document release listeners remain available. */}},
   release:id=>{try{if(this.stage.hasPointerCapture(id))this.stage.releasePointerCapture(id);}catch{/* The host can release capture before disposal. */}},
   requestFrame:callback=>this.win.requestAnimationFrame(callback),cancelFrame:frame=>this.win.cancelAnimationFrame(frame),
   preview:draft=>this.preview(draft),
   commitStroke:(points,tool,owner)=>this.commitStroke(points,tool,owner),
   hitStrokeIds:(points,tool)=>this.eraseHits(points,tool),commitErase:(ids,owner)=>{const snapshot=this.currentOwner(owner);if(snapshot)return this.host.commitErase(ids,snapshot.key);},
   previewCamera:viewport=>this.previewCamera(viewport),commitCamera:(viewport,owner)=>this.commitCamera(viewport,owner),
   restoreCamera:()=>this.clearCameraPreview(),notice:message=>this.host.notice(message)
  },this.tool);
  const pointer=(run:(event:PointerEvent)=>boolean)=>(event:Event)=>{if(run(event as PointerEvent)){event.preventDefault();event.stopPropagation();}};
  this.listen(this.stage,'pointerdown',pointer(event=>{
   const consumed=this.controller.down(event),snapshot=this.snapshot();
   if(consumed&&(event.pointerType==='pen'||event.pointerType==='mouse')&&snapshot&&!snapshot.readOnly)this.stage.focus({preventScroll:true});
   return consumed;
  }));
  this.listen(this.stage,'pointermove',pointer(event=>this.controller.move(event)));
  this.listen(this.stage,'pointerup',pointer(event=>this.controller.up(event)));
  this.listen(this.stage,'pointercancel',pointer(event=>this.controller.cancel(event)));
  this.listen(this.stage,'lostpointercapture',pointer(event=>this.controller.lostCapture(event)));
  // Observe only this controller's active pointer IDs; document releases should
  // not suppress another view's own click or pointer handlers.
  this.listen(doc,'pointerup',event=>{this.controller.up(event as PointerEvent);},true);
  this.listen(doc,'pointercancel',event=>{this.controller.cancel(event as PointerEvent);},true);
  this.listen(this.stage,'contextmenu',event=>{event.preventDefault();event.stopPropagation();});
  this.listen(this.stage,'dblclick',event=>{event.preventDefault();event.stopPropagation();});
  this.listen(this.stage,'keydown',event=>{
   const key=event as KeyboardEvent;if(key.isComposing||key.defaultPrevented)return;
   if(key.key==='Escape'){key.preventDefault();key.stopPropagation();this.cancelInput('leave');}
   else if((key.metaKey||key.ctrlKey)&&!key.altKey&&['z','y'].includes(key.key.toLowerCase())){key.preventDefault();key.stopPropagation();this.undo(key.shiftKey||key.key.toLowerCase()==='y');}
  });
  this.listen(toolbar,'pointerdown',event=>event.stopPropagation());
  this.listen(this.win,'blur',()=>this.cancelInput('blur'));
  this.listen(doc,'visibilitychange',()=>{if(doc.hidden)this.cancelInput('leave');});
  if(this.win.visualViewport){this.listen(this.win.visualViewport,'resize',()=>this.resize());this.listen(this.win.visualViewport,'scroll',()=>this.resize());}
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.stage);
  this.resize();this.refresh();
 }

 private listen(target:EventTarget,type:string,callback:EventListener,capture=false){target.addEventListener(type,callback,{capture,passive:false});this.removeListeners.push(()=>target.removeEventListener(type,callback,capture));}
 private button(parent:HTMLElement,label:string,icon:string,run:()=>void){
  const button=parent.createEl('button',{cls:'ts-handwriting-button',attr:{type:'button','aria-label':label,title:label}});
  if(icon)setIcon(button.createSpan({cls:'ts-handwriting-icon',attr:{'aria-hidden':'true'}}),icon);
  button.createSpan({text:label,cls:'ts-handwriting-caption'});this.listen(button,'click',()=>{if(!this.disposed&&!button.disabled)try{run();}catch(error){this.host.notice(error instanceof Error?error.message:String(error));}});return button;
 }
 private snapshot(){return this.disposed?undefined:this.host.snapshot();}
 private token(snapshot:HandwritingSnapshot):Owner {if(!this.owner||this.owner.key!==snapshot.key||this.owner.board!==snapshot.board)this.owner={key:snapshot.key,board:snapshot.board};return this.owner;}
 private currentOwner(token:unknown){const snapshot=this.snapshot(),owner=this.owner;return snapshot&&owner&&!snapshot.readOnly&&this.root.isConnected&&token===owner&&owner.key===snapshot.key&&owner.board===snapshot.board?snapshot:undefined;}
 private viewport(snapshot:HandwritingSnapshot):HandwritingViewport {
  const preview=this.cameraPreview;return preview&&preview.owner===this.token(snapshot)&&sameViewport(preview.source,snapshot.board.viewport)?preview.viewport:snapshot.board.viewport;
 }
 private clearCameraPreview(){this.cameraPreview=undefined;const snapshot=this.snapshot();if(snapshot)this.transform(snapshot.board.viewport);}
 private cancelInput(reason:'owner'|'resize'|'blur'|'leave'){this.controller.reset(reason);this.clearCameraPreview();}
 private previewCamera(viewport:HandwritingViewport){
  const snapshot=this.currentOwner(this.owner);if(!snapshot)return;const owner=this.token(snapshot),preview=this.cameraPreview;
  if(preview&&(preview.owner!==owner||!sameViewport(preview.source,snapshot.board.viewport))){this.clearCameraPreview();return;}
  this.cameraPreview={owner,source:preview?.source||{...snapshot.board.viewport},viewport:{...viewport}};this.transform(viewport);
 }
 private commitCamera(viewport:HandwritingViewport,token:unknown){
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
 private commitStroke(points:readonly HandwritingPoint[],tool:Readonly<HandwritingTool>,token:unknown){
  const snapshot=this.currentOwner(token);if(!snapshot)return;
  const stroke:InkStroke={id:uid(),color:tool.color,width:tool.width,points:points.map(point=>[point.x,point.y,point.pressure])};
  assertInkData({version:1,strokes:[...(snapshot.board.ink?.strokes||[]),stroke]});return this.host.commitStroke(stroke,snapshot.key);
 }
 private eraseHits(points:readonly HandwritingPoint[],_tool:Readonly<HandwritingTool>):readonly string[]{
  const snapshot=this.snapshot();if(!snapshot||snapshot.readOnly)return[];const radius=12/this.viewport(snapshot).zoom;
  const path:InkPoint[]=points.map(point=>[point.x,point.y,point.pressure]);
  return(snapshot.board.ink?.strokes||[]).filter(stroke=>hitInkStrokePath(stroke,path,radius)).map(stroke=>stroke.id);
 }
 private setTool(next:Partial<HandwritingTool>){this.controller.setTool(next);this.clearCameraPreview();this.tool={...this.tool,...next};this.refresh();}
 private setFingerWriting(enabled:boolean){this.controller.setTouchWriting(enabled);this.clearCameraPreview();this.fingerWriting=enabled;this.refresh();}
 private syncTools(){
  this.stage.dataset.tool=this.tool.kind;
  for(const [kind,button]of this.tools){button.setAttribute('aria-pressed',String(kind===this.tool.kind));button.toggleClass('is-active',kind===this.tool.kind);}
  for(const [color,button]of this.colors)button.setAttribute('aria-pressed',String(color===this.tool.color));
  this.width.value=String(this.tool.width);
  this.fingerButton.setAttribute('aria-pressed',String(this.fingerWriting));this.fingerButton.toggleClass('is-active',this.fingerWriting);
  this.stage.setAttribute('aria-label',this.fingerWriting?'手写画布 · 单指或笔书写，双指移动与缩放':'手写画布 · 笔写字，双指移动与缩放');
 }
 private undo(redo:boolean){const snapshot=this.snapshot();if(!snapshot||snapshot.readOnly||!this.root.isConnected)return;this.cancelInput('leave');this.host.undo(redo);this.refresh();}
 fit():void {
  const snapshot=this.snapshot();if(!snapshot||snapshot.readOnly)return;this.cancelInput('leave');
  const bounds=snapshot.board.ink&&inkBounds(snapshot.board.ink);if(!bounds){this.host.notice('还没有笔迹可居中');return;}
  const rect=this.stage.getBoundingClientRect(),zoom=Math.max(.15,Math.min(2.5,(Math.max(1,rect.width-80))/Math.max(1,bounds.width),(Math.max(1,rect.height-80))/Math.max(1,bounds.height)));
  const viewport={x:rect.width/2-(bounds.x+bounds.width/2)*zoom,y:rect.height/2-(bounds.y+bounds.height/2)*zoom,zoom};
  this.camera(viewport);
 }
 private transform(viewport:HandwritingViewport){this.world.style.transform=`translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;this.stage.style.setProperty('--ink-grid-step',`${24*viewport.zoom}px`);this.stage.style.backgroundPosition=`${viewport.x}px ${viewport.y}px`;}
 refresh():void {
  if(this.disposed)return;const snapshot=this.snapshot();
  if(!snapshot){this.cancelInput('owner');this.owner=undefined;this.sharedCamera=undefined;this.element.hidden=true;return;}this.element.hidden=false;
  if(this.owner&&(this.owner.key!==snapshot.key||this.owner.board!==snapshot.board))this.cancelInput('owner');const owner=this.token(snapshot);
  const shared=this.sharedCamera,preview=this.cameraPreview;
  if(shared?.owner===owner&&!sameViewport(shared.viewport,snapshot.board.viewport)||preview&&(preview.owner!==owner||!sameViewport(preview.source,snapshot.board.viewport)))this.cancelInput('owner');
  this.sharedCamera={owner,viewport:{...snapshot.board.viewport}};
  if(snapshot.readOnly)this.cancelInput('owner');
  this.element.toggleClass('is-readonly',snapshot.readOnly);for(const action of this.editActions)action.disabled=snapshot.readOnly;this.width.disabled=snapshot.readOnly;
  const strokes=snapshot.board.ink?.strokes||[],live=new Set(strokes.map(stroke=>stroke.id));
  for(const [id,row]of this.paths)if(!live.has(id)){row.element.remove();this.paths.delete(id);}
  for(const stroke of strokes){
   let row=this.paths.get(stroke.id);if(!row){const element=this.root.ownerDocument.createElementNS(svgNamespace,'path');element.setAttribute('fill-rule','nonzero');element.setAttribute('data-ink-id',stroke.id);this.svg.insertBefore(element,this.draftGroup);row={stroke,element};this.paths.set(stroke.id,row);element.setAttribute('d',strokePath(stroke));element.setAttribute('fill',stroke.color);}
   else if(row.stroke!==stroke){row.stroke=stroke;row.element.setAttribute('d',strokePath(stroke));row.element.setAttribute('fill',stroke.color);}
  }
  this.hint.hidden=!!strokes.length||!!this.draft||snapshot.readOnly;this.hint.setText(this.fingerWriting?'用手指或笔写下第一笔':'用笔写下第一笔');this.status.setText(snapshot.readOnly?'只读 · 内容已保护':this.tool.kind==='eraser'?'擦除整条笔迹':this.tool.kind==='pan'?'鼠标拖动 · 双指移动':this.fingerWriting?'手指或笔写字 · 双指移动与缩放':'笔写字 · 双指移动与缩放');
  const hidden=snapshot.board.nodes.length+snapshot.board.edges.length;this.mixed.hidden=!hidden;if(hidden)this.mixed.setText(`文件还保留 ${snapshot.board.nodes.length} 个卡片、${snapshot.board.edges.length} 条连线；手写页面暂不显示这些内容。`);
  this.transform(this.viewport(snapshot));this.syncTools();
 }
 private resize(){
  if(this.disposed)return;const rect=this.stage.getBoundingClientRect(),dpr=Math.max(1,Math.min(4,this.win.devicePixelRatio||1));
  const resized=rect.width!==this.size.width||rect.height!==this.size.height||dpr!==this.size.dpr;
  if(resized){this.size={width:rect.width,height:rect.height,dpr};this.canvas.width=Math.max(1,Math.round(rect.width*dpr));this.canvas.height=Math.max(1,Math.round(rect.height*dpr));this.drawn=0;this.draftGroup.replaceChildren();}
  this.controller.layoutChanged();
  if(resized&&!this.draft)this.preview(null);
 }
 private preview(draft:HandwritingDraft|null){
  if(this.disposed)return;const ctx=this.context,snapshot=this.snapshot(),viewport=snapshot?this.viewport(snapshot):{x:0,y:0,zoom:1},dpr=this.size.dpr;
  const clear=()=>{ctx?.setTransform(1,0,0,1,0,0);ctx?.clearRect(0,0,this.canvas.width,this.canvas.height);this.draftGroup.replaceChildren();this.drawn=0;};
  if(!draft){clear();this.draft=undefined;this.hint.hidden=!!this.snapshot()?.board.ink?.strokes.length||!!this.snapshot()?.readOnly;return;}
  this.hint.hidden=true;
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
  if(this.disposed)return;this.controller.dispose();this.clearCameraPreview();this.disposed=true;this.resizeObserver.disconnect();for(const remove of this.removeListeners.splice(0))remove();this.paths.clear();this.element.remove();this.root.removeClass('ts-handwriting-board');this.owner=undefined;this.sharedCamera=undefined;
 }
}
