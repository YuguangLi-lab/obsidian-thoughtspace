type PointerPosition={pointerId:number;clientX:number;clientY:number};
type PointerPress=PointerPosition&{button:number};

/** Use the browser's click count while retaining drag history across pointer capture. */
export class BlankDoubleClick {
 private press?:PointerPosition&{eligible:boolean;threshold:number;moved:boolean};
 private lastClean=false;
 private firstClean=false;
 private ready=false;

 down(event:PointerPress,eligible:boolean,threshold:number){
  if(event.button!==0){this.cancel();return;}
  if(this.press&&this.press.pointerId!==event.pointerId)return;
  this.ready=false;this.lastClean=false;
  this.press={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,
   eligible:eligible&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY),
   threshold:Number.isFinite(threshold)?Math.max(2,Math.min(12,threshold)):4,moved:false};
 }

 move(event:PointerPosition){
  const press=this.press;if(!press||press.pointerId!==event.pointerId)return;
  const distance=Math.hypot(event.clientX-press.clientX,event.clientY-press.clientY);
  if(!Number.isFinite(distance)||distance>=press.threshold)press.moved=true;
 }

 up(event:PointerPosition,cancelled=false){
  const press=this.press;if(!press||press.pointerId!==event.pointerId)return;
  this.move(event);
  this.lastClean=!cancelled&&press.eligible&&!press.moved;
  this.press=undefined;
 }

 click(event:{detail:number}){
  const clean=this.lastClean;this.lastClean=false;this.ready=false;
  if(event.detail===1){this.firstClean=clean;return;}
  if(event.detail===2)this.ready=this.firstClean&&clean;
  this.firstClean=false;
 }

 consume(){const ready=this.ready;this.ready=false;return ready;}

 cancel(){this.press=undefined;this.lastClean=false;this.firstClean=false;this.ready=false;}
}
