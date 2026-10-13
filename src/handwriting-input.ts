/** Pure pointer controller. DOM binding and persistence belong to its host. */
export type HandwritingPoint = {x:number;y:number;pressure:number;time:number};
export type HandwritingViewport = {x:number;y:number;zoom:number};
export type HandwritingRect = {left:number;top:number;width:number;height:number};
export type HandwritingTool = {kind:'pen'|'eraser'|'pan'|'lasso';color:string;width:number;pressure:boolean};
export type HandwritingDraft = {points:readonly HandwritingPoint[];tool:Readonly<HandwritingTool>;context?:unknown};
export type HandwritingState = {owner:unknown;writable:boolean;canBeginInk?:boolean;rect:HandwritingRect;viewport:HandwritingViewport};
export type HandwritingPointerEvent = {
 pointerId:number;pointerType:string;clientX:number;clientY:number;
 button?:number;buttons?:number;pressure?:number;timeStamp?:number;ctrlKey?:boolean;
 getCoalescedEvents?:()=>readonly HandwritingPointerEvent[];
};
export interface HandwritingInputHost {
 state():HandwritingState;
 capture(pointerId:number):void;
 release(pointerId:number):void;
 requestFrame(callback:()=>void):number;
 cancelFrame(frame:number):void;
 preview(draft:HandwritingDraft|null):void;
 beginInk?(point:HandwritingPoint,tool:Readonly<HandwritingTool>,owner:unknown):unknown;
 commitStroke(points:readonly HandwritingPoint[],tool:Readonly<HandwritingTool>,owner:unknown,context?:unknown):void|Promise<void>;
 hitStrokeIds?(points:readonly HandwritingPoint[],tool:Readonly<HandwritingTool>):readonly string[];
 commitErase?(ids:readonly string[],owner:unknown,context?:unknown):void|Promise<void>;
 commitSelection?(points:readonly HandwritingPoint[],context:unknown,owner:unknown):void|Promise<void>;
 previewCamera(viewport:HandwritingViewport):void;
 commitCamera(viewport:HandwritingViewport,owner:unknown):void|Promise<void>;
 restoreCamera(viewport:HandwritingViewport):void;
 notice(message:string):void;
}
export const HANDWRITING_MAX_POINTS=8192;
export const DEFAULT_HANDWRITING_TOOL:Readonly<HandwritingTool>={kind:'pen',color:'#222222',width:3,pressure:true};
type Basis={owner:unknown;rect:HandwritingRect;viewport:HandwritingViewport};
type Ink={basis:Basis;id:number;pointerType:string;points:HandwritingPoint[];tool:HandwritingTool;context?:unknown};
type Contact={x:number;y:number};
type Camera={basis:Basis;origin:HandwritingViewport;kind:'touch'|'mouse';ids:number[];centroid:Contact;last:Contact;distance:number;current:HandwritingViewport;projected:HandwritingViewport};
const finite=(value:number)=>Number.isFinite(value);
const sameViewport=(a:HandwritingViewport,b:HandwritingViewport)=>a.x===b.x&&a.y===b.y&&a.zoom===b.zoom;
const sameRect=(a:HandwritingRect,b:HandwritingRect)=>a.left===b.left&&a.top===b.top&&a.width===b.width&&a.height===b.height;
const availableState=(state:HandwritingState)=>state.writable&&[state.rect.left,state.rect.top,state.rect.width,state.rect.height,state.viewport.x,state.viewport.y,state.viewport.zoom].every(finite)&&state.rect.width>=0&&state.rect.height>=0&&state.viewport.zoom>0;
const validState=(state:HandwritingState)=>availableState(state)&&state.rect.width>0&&state.rect.height>0;
const basis=(state:HandwritingState):Basis=>({owner:state.owner,rect:{...state.rect},viewport:{...state.viewport}});
const contact=(event:HandwritingPointerEvent):Contact=>({x:event.clientX,y:event.clientY});
const midpoint=(a:Contact,b:Contact):Contact=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const distance=(a:Contact,b:Contact)=>Math.hypot(a.x-b.x,a.y-b.y);

export class HandwritingInputController {
 private tool:HandwritingTool;
 private ink?:Ink;
 private camera?:Camera;
 private touches=new Map<number,Contact>();
 private touchBasis?:Basis;
 private quarantine=false;
 private captured=new Set<number>();
 private frame?:number;
 private generation=0;
 private disposed=false;
 private touchWriting=false;
 constructor(private host:HandwritingInputHost,tool:Partial<HandwritingTool>={}){this.tool=this.cleanTool(tool);}
 private cleanTool(tool:Partial<HandwritingTool>):HandwritingTool{
  const current=this.tool??DEFAULT_HANDWRITING_TOOL;
  return{kind:tool.kind==='pen'||tool.kind==='eraser'||tool.kind==='pan'||tool.kind==='lasso'?tool.kind:current.kind,color:typeof tool.color==='string'&&tool.color?tool.color:current.color,width:typeof tool.width==='number'&&finite(tool.width)?Math.max(.1,Math.min(100,tool.width)):current.width,pressure:typeof tool.pressure==='boolean'?tool.pressure:current.pressure};
 }
 private current(b:Basis,viewport=b.viewport):boolean{
  const state=this.host.state();return availableState(state)&&state.owner===b.owner&&sameViewport(state.viewport,viewport);
 }
 private validActive():boolean{
  const b=this.ink?.basis??this.camera?.basis??this.touchBasis;
  return !b||this.current(b,this.camera?.projected??b.viewport);
 }
 private check():boolean{
  if(this.disposed)return false;
  if(!this.validActive()){this.reset();return false;}
  const b=this.ink?.basis??this.camera?.basis??this.touchBasis;
  if(b&&!sameRect(this.host.state().rect,b.rect))this.layoutChanged();
  return true;
 }
 /** Geometry changes are local: keep sampled world points and the camera,
  * then rebase subsequent client coordinates onto the newly placed surface. */
 layoutChanged():void{
  if(this.disposed)return;
  if(!this.validActive()){this.reset();return;}
  const state=this.host.state();
  // Ink drawing is rebased, but a selection gesture is deliberately cancelled
  // on surface geometry change: a late release must not move saved strokes.
  if(this.ink?.tool.kind==='lasso'&&!sameRect(state.rect,this.ink.basis.rect))this.endInk(false);
  if(!validState(state))return;
  const camera=this.camera;
  if(camera&&!sameRect(state.rect,camera.basis.rect)){
   this.projectCamera(camera);
   if(this.camera!==camera||!this.current(camera.basis,camera.projected))return;
   camera.basis={owner:camera.basis.owner,rect:{...state.rect},viewport:{...camera.current}};
   camera.centroid={...camera.last};
   if(camera.kind==='touch')camera.distance=Math.max(1,distance(this.touches.get(camera.ids[0])!,this.touches.get(camera.ids[1])!));
  }
  if(this.ink){this.ink.basis.rect={...state.rect};this.host.preview({points:this.ink.points,tool:this.ink.tool,context:this.ink.context});}
  if(this.touchBasis)this.touchBasis.rect={...state.rect};
 }
 private capture(id:number):boolean{
  if(this.captured.has(id))return true;
  try{this.host.capture(id);this.captured.add(id);return true;}catch{this.reset();this.host.notice('无法捕获输入，这一笔未保存。请抬笔后重试。');return false;}
 }
 private release(id:number):void{
  if(!this.captured.delete(id))return;
  try{this.host.release(id);}catch{/* DOM or window may already be gone. */}
 }
 private cancelFrame():void{if(this.frame!==undefined)this.host.cancelFrame(this.frame);this.frame=undefined;this.generation++;}
 private queue():void{
  if(this.frame!==undefined)return;
  const generation=this.generation;
  this.frame=this.host.requestFrame(()=>{
   if(generation!==this.generation||this.disposed)return;
   this.frame=undefined;
   if(!this.check()||!validState(this.host.state()))return;
   if(this.ink)this.host.preview({points:this.ink.points,tool:this.ink.tool,context:this.ink.context});
   else if(this.camera)this.projectCamera(this.camera);
  });
 }
 private projectCamera(camera:Camera):void{
  this.host.previewCamera({...camera.current});camera.projected={...camera.current};
 }
 private save(run:()=>void|Promise<void>):void{
  try{const result=run();if(result&&typeof result.then==='function')void result.catch(error=>this.host.notice(`保存失败：${String(error).replace(/^Error: /,'')}`));}
  catch(error){this.host.notice(`保存失败：${String(error).replace(/^Error: /,'')}`);}
 }
 down(event:HandwritingPointerEvent):boolean{
  if(this.disposed)return false;
  const touch=event.pointerType==='touch',pen=event.pointerType==='pen',mouse=event.pointerType==='mouse';
  if(!touch&&!pen&&!mouse||!touch&&((event.button??0)!==0||event.ctrlKey))return false;
  if(!finite(event.clientX)||!finite(event.clientY)||!finite(event.pointerId))return false;
  this.check();
  const state=this.host.state();if(!validState(state))return touch||pen||mouse;
  // A rejected new pen tap must not preempt an in-progress camera or draft.
  if(!touch&&state.canBeginInk===false&&!(mouse&&this.tool.kind==='pan'))return true;
  if(touch){
   if(this.touches.has(event.pointerId))return true;
   if(!this.touches.size)this.touchBasis=basis(state);
   this.touches.set(event.pointerId,contact(event));
   // A second finger changes an explicitly enabled finger stroke into camera
   // navigation. Discard its tentative ink before interpreting the fixed pair.
   if(this.ink?.pointerType==='touch'&&this.touches.size===2){
    this.endInk(false);this.quarantine=false;
    for(const id of this.touches.keys())if(!this.capture(id))return true;
   }
   if(this.ink||this.camera?.kind==='mouse')this.quarantine=true;
   if(!this.capture(event.pointerId))return true;
   if(state.canBeginInk!==false&&(this.touchWriting||this.tool.kind==='lasso')&&!this.ink&&!this.camera&&!this.quarantine&&this.touches.size===1&&this.tool.kind!=='pan'){
    this.ink={basis:basis(state),id:event.pointerId,pointerType:'touch',points:[],tool:{...this.tool}};
    this.append(event,false);this.beginInk();if(this.ink)this.queue();return true;
   }
   if(!this.ink&&!this.camera&&!this.quarantine&&this.touches.size===2){
    const ids=[...this.touches.keys()],a=this.touches.get(ids[0])!,b=this.touches.get(ids[1])!,d=distance(a,b);
    if(d<1){this.quarantine=true;return true;}
    this.camera={basis:basis(state),origin:{...state.viewport},kind:'touch',ids,centroid:midpoint(a,b),last:midpoint(a,b),distance:d,current:{...state.viewport},projected:{...state.viewport}};
   }
   return true;
  }
  if(pen&&this.tool.kind==='pan')return false;
  if(this.ink){
   if(this.ink.id===event.pointerId)return true;
   if(!pen||this.ink.pointerType==='pen')return false;
   this.endInk(false);
  }
  if(this.camera){if(!pen)return false;this.endCamera(true);}
  if(this.touches.size)this.quarantine=true;
  const fresh=this.host.state();if(!validState(fresh))return true;
  // Display loading blocks only a new edit. Existing drafts keep their lease,
  // and mouse/two-finger camera navigation remains available.
  if(fresh.canBeginInk===false&&!(mouse&&this.tool.kind==='pan'))return true;
  if(mouse&&this.tool.kind==='pan')this.camera={basis:basis(fresh),origin:{...fresh.viewport},kind:'mouse',ids:[event.pointerId],centroid:contact(event),last:contact(event),distance:1,current:{...fresh.viewport},projected:{...fresh.viewport}};
  else this.ink={basis:basis(fresh),id:event.pointerId,pointerType:event.pointerType,points:[],tool:{...this.tool}};
  if(!this.capture(event.pointerId))return true;
  if(this.ink){this.append(event,false);this.beginInk();if(this.ink)this.queue();}
  return true;
 }
 private beginInk():void {
  const ink=this.ink;if(!ink||!ink.points.length||!this.host.beginInk)return;
  try{ink.context=this.host.beginInk({...ink.points[0]},ink.tool,ink.basis.owner);}
  catch(error){this.endInk(false);this.host.notice(String(error).replace(/^Error: /,''));}
 }
 private append(event:HandwritingPointerEvent,terminal:boolean):void{
  const ink=this.ink;if(!ink)return;
  let samples:readonly HandwritingPointerEvent[]=[];
  try{samples=event.getCoalescedEvents?.()??[];}catch{/* Feature may be unavailable in this context. */}
  const valid=samples.filter(sample=>sample.pointerId===ink.id&&sample.pointerType===ink.pointerType&&finite(sample.clientX)&&finite(sample.clientY));
  for(const sample of valid.length?valid:[event]){
   if(!finite(sample.clientX)||!finite(sample.clientY))continue;
   const previous=ink.points.at(-1),v=ink.basis.viewport,r=ink.basis.rect;
   const x=(sample.clientX-r.left-v.x)/v.zoom,y=(sample.clientY-r.top-v.y)/v.zoom;
   if(!finite(x)||!finite(y))continue;
   let raw=typeof sample.pressure==='number'&&finite(sample.pressure)&&sample.pressure>=0&&sample.pressure<=1?sample.pressure:.5;
   if(terminal&&raw===0)raw=previous?.pressure??.5;
   raw=ink.tool.pressure?Math.max(.05,raw):.5;
   const pressure=previous&&!terminal?previous.pressure+(raw-previous.pressure)*.35:raw;
   if(previous&&previous.x===x&&previous.y===y&&(terminal||Math.abs(previous.pressure-pressure)<1e-8))continue;
   if(ink.points.length>=HANDWRITING_MAX_POINTS){this.endInk(false);this.host.notice(`已达到单笔 ${HANDWRITING_MAX_POINTS} 点采样上限，这一整笔未保存。请抬笔后继续新的一笔。`);return;}
   const time=typeof sample.timeStamp==='number'&&finite(sample.timeStamp)?Math.max(previous?.time??0,sample.timeStamp):previous?.time??0;
   ink.points.push({x,y,pressure,time});
  }
 }
 move(event:HandwritingPointerEvent):boolean{
  const ownsInk=this.ink?.id===event.pointerId,ownsCamera=this.camera?.ids.includes(event.pointerId)??false,ownsTouch=this.touches.has(event.pointerId);
  if(!ownsInk&&!ownsCamera&&!ownsTouch)return false;
  if(!this.check())return true;
  if(!validState(this.host.state()))return true;
  if(finite(event.clientX)&&finite(event.clientY)&&ownsTouch)this.touches.set(event.pointerId,contact(event));
  if(ownsInk){
   if(event.buttons===0){this.endInk(false);return true;}
   this.append(event,false);if(this.ink)this.queue();return true;
  }
  const camera=this.camera;if(!camera||!ownsCamera)return true;
  if(camera.kind==='mouse'&&event.buttons===0){this.endCamera(false);return true;}
  if(!finite(event.clientX)||!finite(event.clientY))return true;
  let c:Contact,z=camera.basis.viewport.zoom;
  if(camera.kind==='mouse')c=contact(event);
  else{
   const a=this.touches.get(camera.ids[0])!,b=this.touches.get(camera.ids[1])!;c=midpoint(a,b);
   z=Math.max(.15,Math.min(2.5,z*distance(a,b)/camera.distance));
  }
  const start=camera.centroid,v=camera.basis.viewport,r=camera.basis.rect;
  camera.last={...c};
  camera.current=camera.kind==='mouse'?{x:v.x+c.x-start.x,y:v.y+c.y-start.y,zoom:z}:{x:c.x-r.left-(start.x-r.left-v.x)/v.zoom*z,y:c.y-r.top-(start.y-r.top-v.y)/v.zoom*z,zoom:z};
  if([camera.current.x,camera.current.y,camera.current.zoom].every(finite))this.queue();else this.endCamera(false);
  return true;
 }
 private endInk(commit:boolean):void{
  const ink=this.ink;if(!ink)return;
  const current=this.current(ink.basis);this.ink=undefined;this.cancelFrame();const generation=this.generation;this.host.preview(null);
  // A cancelled finger stroke can become a pinch or be preempted by a pen.
  // Keep that held contact captured until its own terminal event arrives.
  if(commit||!this.touches.has(ink.id))this.release(ink.id);
  if(this.touches.size)this.quarantine=true;
  if(!commit||!current||!ink.points.length)return;
  // Recheck after host preview/release hooks: either may acquire a save lock.
  if(generation!==this.generation||!this.current(ink.basis))return;
  const points=ink.points.map(point=>({...point})),tool={...ink.tool};
  if(tool.kind==='lasso'){
   if(this.host.commitSelection)this.save(()=>this.host.commitSelection!(points,ink.context,ink.basis.owner));
  }else if(tool.kind==='eraser'){
   try{const ids=[...new Set(this.host.hitStrokeIds?.(points,tool)??[])];if(ids.length&&this.host.commitErase&&generation===this.generation&&this.current(ink.basis))this.save(()=>this.host.commitErase!(ids,ink.basis.owner,ink.context));}
   catch(error){this.host.notice(`擦除失败：${String(error).replace(/^Error: /,'')}`);}
  }else this.save(()=>this.host.commitStroke(points,tool,ink.basis.owner,ink.context));
 }
 private endCamera(commit:boolean):void{
  const camera=this.camera;if(!camera)return;
  const current=this.current(camera.basis,camera.projected);this.camera=undefined;this.cancelFrame();const generation=this.generation;
  if(camera.kind==='touch'&&this.touches.size)this.quarantine=true;
  // Held touch contacts keep capture until their own up/cancel, so quarantine
  // also clears when the remaining finger lifts outside the drawing surface.
  if(camera.kind==='mouse')for(const id of camera.ids)this.release(id);
  if(commit&&current&&generation===this.generation&&this.current(camera.basis,camera.projected)){
   this.projectCamera(camera);
   if(generation===this.generation&&this.current(camera.basis,camera.current)&&!sameViewport(camera.current,camera.origin))this.save(()=>this.host.commitCamera({...camera.current},camera.basis.owner));
   // Pending contacts now belong to the camera just projected, not its origin.
   if(this.touches.size)this.touchBasis=basis(this.host.state());
  }else if(this.host.state().owner===camera.basis.owner&&sameViewport(this.host.state().viewport,camera.projected)){this.host.restoreCamera({...camera.origin});if(this.touches.size)this.touchBasis=basis(this.host.state());}
 }
 up(event:HandwritingPointerEvent):boolean{
  const ownsInk=this.ink?.id===event.pointerId,ownsCamera=this.camera?.ids.includes(event.pointerId)??false,ownsTouch=this.touches.has(event.pointerId);
  if(!ownsInk&&!ownsCamera&&!ownsTouch)return false;
  if(!this.check())return true;
  if(ownsInk){if(validState(this.host.state()))this.append(event,true);this.endInk(true);if(ownsTouch)this.finishTouch(event.pointerId);return true;}
  if(ownsCamera){
   // DOM PointerEvent properties are prototype accessors, so spreading an event
   // loses its coordinates and ID. Consume terminal coordinates explicitly.
   this.move({pointerId:event.pointerId,pointerType:event.pointerType,clientX:event.clientX,clientY:event.clientY,buttons:event.pointerType==='mouse'?1:event.buttons});
   if(ownsTouch)this.release(event.pointerId);
   this.endCamera(true);
  }
  if(ownsTouch)this.finishTouch(event.pointerId);
  return true;
 }
 cancel(event:HandwritingPointerEvent):boolean{
  if(this.ink?.id===event.pointerId){this.endInk(false);if(this.touches.has(event.pointerId))this.finishTouch(event.pointerId);return true;}
  if(this.camera?.ids.includes(event.pointerId))this.endCamera(false);
  else if(!this.touches.has(event.pointerId))return false;
  this.finishTouch(event.pointerId);
  return true;
 }
 lostCapture(event:HandwritingPointerEvent):boolean{
  if(!this.captured.has(event.pointerId))return false;
  return this.cancel(event);
 }
 setTool(tool:Partial<HandwritingTool>):void{this.reset();this.tool=this.cleanTool(tool);}
 setTouchWriting(enabled:boolean):void{if(enabled===this.touchWriting)return;this.reset();this.touchWriting=enabled;}
 private finishTouch(id:number):void{this.touches.delete(id);this.release(id);if(!this.touches.size){this.quarantine=false;this.touchBasis=undefined;}}
 reset(_reason:'owner'|'resize'|'blur'|'leave'='owner'):void{
  if(_reason==='resize'){this.layoutChanged();return;}
  const camera=this.camera;this.ink=undefined;this.camera=undefined;this.touches.clear();this.touchBasis=undefined;this.quarantine=false;this.cancelFrame();this.host.preview(null);
  const captures=[...this.captured];for(const id of captures)this.release(id);
  if(camera&&this.host.state().owner===camera.basis.owner&&sameViewport(this.host.state().viewport,camera.projected))this.host.restoreCamera({...camera.origin});
 }
 dispose():void{if(this.disposed)return;this.disposed=true;this.reset('leave');}
}
