interface Point {x:number;y:number}
const eventTarget=(event:PointerEvent)=>(event.type==='pointerleave'?event.relatedTarget:event.target) as Element|null;
type Rect=Pick<DOMRect,'left'|'top'|'right'|'bottom'|'width'|'height'>;
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const corners=(r:Rect):Point[]=>[{x:r.left-6,y:r.top-6},{x:r.right+6,y:r.top-6},{x:r.right+6,y:r.bottom+6},{x:r.left-6,y:r.bottom+6}];
const valid=(r:Rect)=>r.width>0&&r.height>0&&[r.left,r.top,r.right,r.bottom,r.width,r.height].every(Number.isFinite);

/** The convex bridge is geometry only: no overlay can intercept a link port. */
function inBridge(point:Point,body:Rect,dock:Rect):boolean {
  if(!valid(body)||!valid(dock))return false;
  const points=[...corners(body),...corners(dock)].sort((a,b)=>a.x-b.x||a.y-b.y);
  const half=(points:Point[])=>{const hull:Point[]=[];for(const p of points){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p);}return hull;};
  const lower=half(points),upper=half([...points].reverse());lower.pop();upper.pop();const hull=[...lower,...upper];
  return hull.every((p,i)=>cross(p,hull[(i+1)%hull.length],point)>=0);
}

/** Mount after a node's actions are built; register the returned cleanup with
 * its render scope. Geometry uses actual screen bounds, including inverse zoom
 * and viewport-driven dock relocation. Only an active node listens globally.
 */
export function mountCardControlHover(node:HTMLElement):()=>void {
  const doc=node.ownerDocument,view=doc.defaultView;
  const docks=Array.from(node.querySelectorAll<HTMLElement>(':scope > .ts-card-actions, :scope > .ts-compact-fold-row > .ts-compact-actions')).filter(dock=>dock.childElementCount>0);
  if(!view||!docks.length)return()=>{};
  let disposed=false,active=false,frame:number|undefined,timer:number|undefined;
  let latest:PointerEvent|undefined;
  const cancelTimer=()=>{if(timer!==undefined)view.clearTimeout(timer);timer=undefined;};
  const stop=()=>{
    cancelTimer();if(frame!==undefined)view.cancelAnimationFrame(frame);frame=undefined;latest=undefined;
    if(!active)return;active=false;node.classList.remove('is-control-hover');
    doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointercancel',stop);
    doc.removeEventListener('visibilitychange',visibility);view.removeEventListener('blur',stop);view.removeEventListener('pointerout',out);
  };
  const dismiss=()=>{if(timer===undefined)timer=view.setTimeout(()=>{timer=undefined;stop();},180);};
  const refresh=()=>{
    frame=undefined;const event=latest;latest=undefined;
    if(disposed||!active||!event)return;
    if(!node.isConnected||event.pointerType==='touch'||event.buttons){stop();return;}
    const target=eventTarget(event);
    if(target&&node.contains(target)){cancelTimer();return;}
    // A corridor must never keep a previous card open while approaching another.
    if(target?.closest?.('.ts-node')){stop();return;}
    const point={x:event.clientX,y:event.clientY},body=node.getBoundingClientRect();
    if(Number.isFinite(point.x)&&Number.isFinite(point.y)&&docks.some(dock=>dock.isConnected&&inBridge(point,body,dock.getBoundingClientRect())))cancelTimer();
    else dismiss();
  };
  function move(event:PointerEvent){
    if(!active||disposed)return;
    const target=eventTarget(event);
    if(event.buttons||event.pointerType==='touch'||target?.closest?.('.ts-node')&&!node.contains(target)){stop();return;}
    latest=event;if(frame===undefined)frame=view!.requestAnimationFrame(refresh);
  }
  function visibility(){if(doc.visibilityState==='hidden')stop();}
  function out(event:PointerEvent){if(!event.relatedTarget)stop();}
  const enter=(event:PointerEvent)=>{
    if(disposed||!node.isConnected||event.pointerType==='touch'||event.buttons)return;
    cancelTimer();if(active)return;active=true;node.classList.add('is-control-hover');
    doc.addEventListener('pointermove',move,{capture:true,passive:true});doc.addEventListener('pointercancel',stop);
    doc.addEventListener('visibilitychange',visibility);view.addEventListener('blur',stop);view.addEventListener('pointerout',out);
  };
  // Blur or a held-pointer move clears the lifecycle, but a later release or
  // window return inside the same node need not emit another pointerenter.
  const resume=(event:PointerEvent)=>{
    if(active||disposed||!node.isConnected||event.pointerType==='touch'||event.buttons)return;
    const inside=(rect:DOMRect)=>valid(rect)&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
    // Captured releases can still target this node while physically outside it.
    if(inside(node.getBoundingClientRect())||docks.some(dock=>dock.isConnected&&inside(dock.getBoundingClientRect())))enter(event);
  };
  node.addEventListener('pointerenter',enter);node.addEventListener('pointerleave',move);
  node.addEventListener('pointermove',resume,{passive:true});node.addEventListener('pointerup',resume,{passive:true});
  return()=>{if(disposed)return;disposed=true;stop();node.removeEventListener('pointerenter',enter);node.removeEventListener('pointerleave',move);node.removeEventListener('pointermove',resume);node.removeEventListener('pointerup',resume);};
}
