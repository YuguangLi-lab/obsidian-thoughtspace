interface PillRect {left:number;top:number;width:number;height:number;}
interface Pill {element:HTMLElement;id:string;priority:number;}
export interface LocalRelationMotionSnapshot {
 readonly root:HTMLElement;
 readonly document:Document;
 readonly window:Window;
 readonly rects:ReadonlyMap<string,PillRect>;
 readonly ghosts?:ReadonlyMap<string,HTMLElement>;
}

const limit=60;
const duration=480;

/** A view-only transition. Saved board coordinates, native focus and scrolling
 * remain entirely outside this helper; unsupported animation degrades to a cut. */
export class LocalRelationMotion {
 constructor(private readonly fadeDepartures=false){}
 private ghosts=new Set<HTMLElement>();
 get active(){return this.animations.size>0;}
 private pending?:LocalRelationMotionSnapshot;
 private animations=new Set<Animation>();
 private completion?:{callback?:()=>void;building:boolean};

 capture(root:HTMLElement):LocalRelationMotionSnapshot|undefined {
  let snapshot:LocalRelationMotionSnapshot|undefined;
  try{
   const doc=root.ownerDocument,win=doc.defaultView;
   if(win&&this.ready(root,doc,win)){
    const rects=new Map<string,PillRect>(),ghosts=new Map<string,HTMLElement>();
    // Read the currently displayed positions before cancelling an interrupted
    // transition, so a rapid second click does not jump back to its old origin.
    for(const pill of this.pills(root)){
     if(rects.has(pill.id))continue;
     const rect=this.rect(pill.element);if(rect){rects.set(pill.id,rect);if(this.fadeDepartures&&typeof pill.element.cloneNode==='function')ghosts.set(pill.id,pill.element.cloneNode(true) as HTMLElement);}
     if(rects.size===limit)break;
    }
    snapshot={root,document:doc,window:win,rects,...(this.fadeDepartures?{ghosts}:{})};
   }
  }catch{/* A closing popout can invalidate DOM access between these reads. */}
  this.cancel();this.pending=snapshot;return snapshot;
 }

 play(root:HTMLElement,snapshot:LocalRelationMotionSnapshot|undefined,onFinish?:()=>void):void {
  if(!snapshot){this.finish(onFinish);return;}
  // A stale completion must not cancel a newer capture or its animation.
  if(snapshot!==this.pending)return;
  this.pending=undefined;
  try{
   if(root!==snapshot.root||!this.attached(root,snapshot.document,snapshot.window))return;
   if(!this.ready(root,snapshot.document,snapshot.window)){this.finish(onFinish);return;}
   const rootRect=root.offsetWidth>0||root.offsetHeight>0?root.getBoundingClientRect():undefined;
   const ratio=(screen:number|undefined,local:number)=>screen&&local>0&&Number.isFinite(screen/local)&&screen/local>0?screen/local:1;
   const scaleX=ratio(rootRect?.width,root.offsetWidth),scaleY=ratio(rootRect?.height,root.offsetHeight);
   const completion:{callback?:()=>void;building:boolean}={callback:onFinish,building:true};this.completion=completion;
   for(const pill of this.pills(root).slice(0,limit)){
    if(!this.ready(root,snapshot.document,snapshot.window)){this.cancel();return;}
    const next=this.rect(pill.element);if(!next||typeof pill.element.animate!=='function')continue;
    const old=snapshot.rects.get(pill.id);let frames:Keyframe[];
    if(old){
     const x=old.left-next.left,y=old.top-next.top,sx=old.width/next.width,sy=old.height/next.height;
     if(![x,y,sx,sy].every(Number.isFinite))continue;
     if(Math.abs(x)<.5&&Math.abs(y)<.5&&Math.abs(old.width-next.width)<.5&&Math.abs(old.height-next.height)<.5)continue;
     // Rectangle deltas are screen pixels; a board's scaled world transforms CSS
     // pixels again. Convert back to local coordinates to preserve the old origin.
     frames=[{transformOrigin:'0 0',transform:`translate(${x/scaleX}px, ${y/scaleY}px) scale(${sx}, ${sy})`},{transformOrigin:'0 0',transform:'none'}];
    }else frames=[{opacity:0},{opacity:1}];
    try{
     const animation=pill.element.animate(frames,{duration,easing:'cubic-bezier(0.22, 1, 0.36, 1)',fill:'none'});
     this.animations.add(animation);
     animation.onfinish=()=>{this.animations.delete(animation);animation.onfinish=null;animation.oncancel=null;if(this.completion===completion&&!completion.building&&!this.animations.size){this.completion=undefined;this.finish(completion.callback);}};
     animation.oncancel=()=>{if(this.completion===completion)this.cancel();};
     if(!this.ready(root,snapshot.document,snapshot.window)){this.cancel();return;}
    }catch{/* One unsupported or detached pill must not block other navigation. */}
   }
   if(snapshot.ghosts){
    const visible=new Set(this.pills(root).map(pill=>pill.id));
    for(const [id,ghost] of snapshot.ghosts){
     const old=snapshot.rects.get(id);if(visible.has(id)||!old||!rootRect||typeof ghost.animate!=='function')continue;
     ghost.removeAttribute('id');for(const child of Array.from(ghost.querySelectorAll('[id]')))child.removeAttribute('id');
     ghost.removeAttribute('data-relation-motion-id');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
     Object.assign(ghost.style,{position:'absolute',left:`${(old.left-rootRect.left)/scaleX}px`,top:`${(old.top-rootRect.top)/scaleY}px`,width:`${old.width/scaleX}px`,height:`${old.height/scaleY}px`,transform:'none',pointerEvents:'none'});
     root.appendChild(ghost);this.ghosts.add(ghost);
     const animation=ghost.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'});this.animations.add(animation);
     animation.onfinish=()=>{this.animations.delete(animation);this.ghosts.delete(ghost);ghost.remove();animation.onfinish=null;animation.oncancel=null;if(this.completion===completion&&!completion.building&&!this.animations.size){this.completion=undefined;this.finish(completion.callback);}};
     animation.oncancel=()=>{if(this.completion===completion)this.cancel();};
    }
   }
   completion.building=false;
   if(this.completion===completion&&!this.animations.size){this.completion=undefined;this.finish(completion.callback);}
  }catch{this.cancel();this.finish(onFinish);}
 }

 cancel():void {
  this.pending=undefined;this.completion=undefined;
  for(const ghost of this.ghosts)ghost.remove();this.ghosts.clear();
  const animations=[...this.animations];this.animations.clear();
  for(const animation of animations){try{animation.onfinish=null;animation.oncancel=null;animation.cancel();}catch{/* The old document may already have closed. */}}
 }

 private finish(callback?:()=>void){try{callback?.();}catch{/* Visual cleanup cannot interrupt navigation. */}}
 private attached(root:HTMLElement,doc:Document,win:Window):boolean {
  return root.isConnected&&root.ownerDocument===doc&&doc.defaultView===win&&!win.closed&&root.getClientRects().length>0;
 }
 private ready(root:HTMLElement,doc:Document,win:Window):boolean {
  return this.attached(root,doc,win)&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 }
 private pills(root:HTMLElement):Pill[] {
  const active=root.ownerDocument.activeElement;
  return Array.from(root.querySelectorAll<HTMLElement>('[data-relation-motion-id]')).filter(element=>element.isConnected&&root.contains(element)&&!!element.dataset.relationMotionId).map(element=>({element,id:element.dataset.relationMotionId!,priority:active&&element.contains(active)?2:element.dataset.relationMotionCenter==='true'?1:0})).sort((a,b)=>b.priority-a.priority);
 }
 private rect(element:HTMLElement):PillRect|undefined {
  if(!element.isConnected||!element.getClientRects().length||element.checkVisibility?.()===false)return;
  // Chromium can retain a layout rectangle for content hidden by <details>.
  // Keep the native summary visible, including on hosts without checkVisibility.
  for(let parent=element.parentElement;parent;parent=parent.parentElement){
   if(parent.tagName==='DETAILS'&&!(parent as HTMLDetailsElement).open){
    const summary=Array.from(parent.children).find(child=>child.tagName==='SUMMARY');
    if(!summary?.contains(element))return;
   }
  }
  const {left,top,width,height}=element.getBoundingClientRect();
  if([left,top,width,height].every(Number.isFinite)&&width>0&&height>0)return{left,top,width,height};
 }
}
