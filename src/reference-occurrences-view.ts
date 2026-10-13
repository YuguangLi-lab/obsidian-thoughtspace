import {Component,Notice,setIcon} from 'obsidian';
import {referenceOccurrenceGroups,type ReferenceOccurrenceTrail} from './reference-occurrences';

export interface ReferenceOccurrenceNavigationHost {
 showList?():void;
 closed?():void;
 /** Existing board toolbars can reserve room without changing canvas geometry. */
 insets?():{top?:number;bottom?:number};
 /** Current brain stage; null hides a temporarily unavailable stage. Undefined
  * keeps the ordinary/handwriting content-box policy. Never capture an old stage. */
 bounds?():HTMLElement|null|undefined;
 /** Actual creation rails in the current ordinary/handwriting view. */
 rails?():readonly HTMLElement[];
}
/** Root mounts this outside the transformed canvas in the current owned window.
 * Unmounting a bar does not cancel its trail: a cross-board hop replaces the UI. */
export class ReferenceOccurrenceNavigation extends Component {
 private element?:HTMLElement;private description?:HTMLElement;private status?:HTMLElement;
 private previous?:HTMLButtonElement;private next?:HTMLButtonElement;private back?:HTMLButtonElement;
 private stopped=false;private frame=0;
 private resizeObserver?:ResizeObserver;private observed=new Set<Element>();
 private attributesObserver?:MutationObserver;private attributeTargets=new Set<Element>();
 constructor(private readonly container:HTMLElement,private readonly trail:ReferenceOccurrenceTrail,private readonly host:ReferenceOccurrenceNavigationHost={}){super();}
 onload(){
  const doc=this.container.ownerDocument,win=doc.defaultView;if(!win||win.closed||!this.container.isConnected)return;
  this.stopped=false;this.element=this.container.createDiv({cls:'ts-reference-navigation',attr:{role:'group','aria-label':'笔记引用位置导航'}});
  this.description=this.element.createDiv({cls:'ts-reference-navigation-description',attr:{'aria-live':'polite'}});
  this.status=this.element.createDiv({cls:'ts-reference-navigation-status',attr:{role:'status'}});
  const buttons=this.element.createDiv('ts-reference-navigation-actions');
  this.previous=this.button(buttons,'上一处','chevron-left',()=>this.trail.go(this.trail.index-1),true);
  this.next=this.button(buttons,'下一处','chevron-right',()=>this.trail.go(this.trail.index+1),true);
  this.back=this.button(buttons,'返回出发位置','undo-2',()=>this.trail.returnToOrigin());
  if(this.host.showList)this.button(buttons,'引用位置列表','list',()=>this.host.showList?.(),true);
  this.button(buttons,'关闭引用导航','x',()=>{this.trail.cancel();this.host.closed?.();this.unload();},true,true);
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'] as const)this.registerDomEvent(this.element,type,event=>event.stopPropagation());
  for(const type of ['wheel','touchstart','touchmove','touchend','touchcancel'] as const)this.registerDomEvent(this.element,type,event=>event.stopPropagation(),{passive:true});
  this.registerDomEvent(this.element,'click',event=>event.stopPropagation());
  this.registerDomEvent(this.element,'keydown',event=>event.stopPropagation());
  this.register(this.trail.subscribe(()=>this.render()));
  const queue=()=>{if(!this.stopped&&!this.frame)this.frame=win.requestAnimationFrame(()=>{this.frame=0;this.layout();});};
  // Element scroll does not bubble. Capture also sees programmatic scrolling
  // of overflow:hidden shells and ancestors whose dimensions stay unchanged.
  const viewport=win.visualViewport;win.addEventListener('resize',queue);win.addEventListener('scroll',queue,true);viewport?.addEventListener('resize',queue);viewport?.addEventListener('scroll',queue);
  const Observer=(win as Window&{ResizeObserver?:typeof ResizeObserver}).ResizeObserver;this.resizeObserver=Observer?new Observer(queue):undefined;
  const Mutation=(win as Window&{MutationObserver?:typeof MutationObserver}).MutationObserver,tree=Mutation?new Mutation(records=>{if(records.some(record=>!this.element?.contains(record.target)))queue();}):undefined;this.attributesObserver=Mutation?new Mutation(queue):undefined;
  // Scene transforms and selected-node attributes are frequent: observe only
  // structural replacement below the root, plus mode/visibility on the root.
  tree?.observe(this.container,{childList:true,subtree:true});
  this.register(()=>{win.cancelAnimationFrame(this.frame);this.frame=0;win.removeEventListener('resize',queue);win.removeEventListener('scroll',queue,true);viewport?.removeEventListener('resize',queue);viewport?.removeEventListener('scroll',queue);this.resizeObserver?.disconnect();this.resizeObserver=undefined;this.observed.clear();tree?.disconnect();this.attributesObserver?.disconnect();this.attributesObserver=undefined;this.attributeTargets.clear();});
  this.render();this.layout();
 }
 private button(parent:HTMLElement,label:string,icon:string,action:()=>unknown,iconOnly=false,cancel=false){
  const button=parent.createEl('button',{attr:{type:'button','aria-label':label,title:label}});setIcon(button.createSpan(),icon);if(!iconOnly)button.createSpan({text:label});
  button.onclick=()=>{if(this.trail.pending&&!cancel||this.stopped||!this.element?.isConnected)return;this.status?.setText('');
   try{Promise.resolve(action()).catch(error=>this.error(error));}catch(error){this.error(error);}
  };return button;
 }
 private error(error:unknown){if(this.stopped||!this.element?.isConnected)return;const text=error instanceof Error?error.message:String(error);this.status?.setText(text);new Notice(text);this.render();}
 private render(){
  if(this.stopped||!this.element)return;
  if(!this.trail.active){this.unload();return;}
  const item=this.trail.items[this.trail.index];this.description?.setText(`${this.trail.index+1} / ${this.trail.items.length} · ${item.boardTitle} · ${item.nodeTitle} · ${referenceOccurrenceGroups(item)}`);
  const pending=this.trail.pending;this.element.setAttribute('aria-busy',String(pending));
  for(const button of Array.from(this.element.querySelectorAll<HTMLButtonElement>('button')))button.disabled=pending;
  // Close always remains available to cancel an awaited navigation.
  const close=this.element.querySelector<HTMLButtonElement>('button[aria-label="关闭引用导航"]');if(close)close.disabled=false;
  if(this.previous)this.previous.disabled=pending||this.trail.index===0;
  if(this.next)this.next.disabled=pending||this.trail.index+1>=this.trail.items.length;
  if(this.back)this.back.disabled=pending;
 }
 private layout(){
  if(this.stopped||!this.element)return;const doc=this.container.ownerDocument,win=doc.defaultView;if(!win||win.closed||!this.container.isConnected){this.element.hidden=true;return;}
  // Hidden elements have no offsetParent. Expose before measurement within this
  // frame, then hide again if the current stage still has no usable slice.
  this.element.hidden=false;
  const bounds=this.host.bounds?.(),positionedElement=this.element.offsetParent,owns=(element:HTMLElement)=>element.ownerDocument===doc&&element.isConnected&&this.container.contains(element),owned=!!bounds&&owns(bounds),rails=bounds===undefined?(this.host.rails?.()??[]).filter(owns):[];
  const targets=new Set<Element>([this.container,...rails]);if(positionedElement)targets.add(positionedElement);if(owned)targets.add(bounds);
  for(const target of this.observed)if(!targets.has(target))this.resizeObserver?.unobserve(target);for(const target of targets)if(!this.observed.has(target))this.resizeObserver?.observe(target);this.observed=targets;
  const attributes=new Set<Element>([this.container,...rails]);if(attributes.size!==this.attributeTargets.size||[...attributes].some(target=>!this.attributeTargets.has(target))){this.attributesObserver?.disconnect();for(const target of attributes)this.attributesObserver?.observe(target,{attributes:true,attributeFilter:['class','hidden','style','aria-orientation']});this.attributeTargets=attributes;}
  if(bounds!==undefined){
   if(!owned||!bounds?.getClientRects().length){this.element.hidden=true;return;}
   const rect=this.container.getBoundingClientRect(),stage=bounds.getBoundingClientRect(),viewport=win.visualViewport,vx=viewport?.offsetLeft??0,vy=viewport?.offsetTop??0;
   const left=Math.max(rect.left,stage.left,vx),right=Math.min(rect.right,stage.right,vx+(viewport?.width??win.innerWidth)),top=Math.max(rect.top,stage.top,vy),bottom=Math.min(rect.bottom,stage.bottom,vy+(viewport?.height??win.innerHeight)),width=right-left,height=bottom-top;
   if(width<44||height<44){this.element.hidden=true;return;}
   const gapX=Math.min(12,(width-44)/2),gapY=Math.min(12,(height-44)/2),positioned=positionedElement??this.container,box=positioned.getBoundingClientRect(),x=box.left+positioned.clientLeft,y=box.top+positioned.clientTop;
   this.element.hidden=false;this.element.classList.toggle('is-stage-compact',height-2*gapY<64||width-2*gapX<68);
   this.element.style.left=left+gapX-x+positioned.scrollLeft+'px';this.element.style.right=x+positioned.clientWidth-right+gapX-positioned.scrollLeft+'px';
   this.element.style.bottom=y+positioned.clientHeight-bottom+gapY-positioned.scrollTop+'px';this.element.style.maxHeight=height-2*gapY+'px';return;
  }
  // Measure with the current wrapping lane intact. A captured internal scroll
  // must not temporarily widen the bar and clamp its scrollTop to a shorter row.
  const rect=this.container.getBoundingClientRect(),viewport=win.visualViewport,top=Math.max(rect.top,viewport?.offsetTop??0),bottom=Math.min(rect.bottom,(viewport?.offsetTop??0)+(viewport?.height??win.innerHeight));
  const insets=this.host.insets?.()??{},available=Math.max(0,bottom-top),reserve=Math.max(0,insets.bottom??76);
  // Collapse to the visible bottom when the keyboard leaves little height.
  const room=available>=180?Math.min(reserve,Math.max(0,available-140)):0;
  // The host's content box may be shorter than its positioned ancestor after
  // keyboard/viewport adaptation. Absolute bottom uses that actual ancestor.
  const positioned=positionedElement?.getBoundingClientRect()??rect,finalBottom=Math.max(12,positioned.bottom-bottom+room+12),maxHeight=Math.max(44,available-room-Math.max(0,insets.top??0)-24);
  const vx=viewport?.offsetLeft??0,navBottom=positioned.bottom-finalBottom,navTop=navBottom-maxHeight;let left=Math.max(rect.left,vx),right=Math.min(rect.right,vx+(viewport?.width??win.innerWidth)),avoided=false,compact=false,hidden=false,finalLeft:string|undefined,finalRight:string|undefined;
  for(const rail of rails){
   if(!rail.getClientRects().length)continue;const box=rail.getBoundingClientRect(),orientation=rail.getAttribute('aria-orientation');
   if(!(box.width>0&&box.height>0)||orientation==='horizontal'||!orientation&&box.width>box.height||box.bottom<=navTop||box.top>=navBottom||box.right<=left||box.left>=right)continue;
   // Side comes from its actual placement, so a moved/right-hand rail uses the
   // same exclusion policy without hard-coded rail dimensions or direction.
   if(box.left+box.right<=rect.left+rect.right)left=Math.max(left,box.right);else right=Math.min(right,box.left);avoided=true;
  }
  if(avoided){const width=right-left;hidden=width<44;if(!hidden){
   const gap=Math.min(12,(width-44)/2),parent=positionedElement??this.container,box=parent.getBoundingClientRect(),x=box.left+parent.clientLeft;
   compact=width-2*gap<68||maxHeight<64;finalLeft=left+gap-x+parent.scrollLeft+'px';finalRight=x+parent.clientWidth-right+gap-parent.scrollLeft+'px';
  }}
  // Apply only the final geometry after all layout reads. No-rail mode still
  // restores its established horizontal CSS and ordinary vertical insets.
  this.element.style.bottom=finalBottom+'px';this.element.style.maxHeight=maxHeight+'px';
  if(finalLeft===undefined){this.element.style.removeProperty('left');this.element.style.removeProperty('right');}else{this.element.style.left=finalLeft;this.element.style.right=finalRight!;}
  if(compact)this.element.classList.toggle('is-stage-compact',true);else this.element.classList.remove('is-stage-compact');this.element.hidden=hidden;
 }
 onunload(){this.stopped=true;this.element?.remove();this.element=undefined;}
}
