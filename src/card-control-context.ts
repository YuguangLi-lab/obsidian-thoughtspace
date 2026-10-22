export interface CardControlContextTarget {
 owner:object;
 card:HTMLElement;
 label:string;
 current:()=>boolean;
}
interface BorrowedControl {element:HTMLElement;anchor:Comment}
interface ContextLease extends CardControlContextTarget {controls:BorrowedControl[]}

/** The compact selection borrows the original controls, never their callbacks.
 * Its host stays outside the frequently rebuilt format headings. */
export class CardControlContext {
 private lease?:ContextLease;
 private pending?:{target?:CardControlContextTarget;preserveFocus:boolean};
 private pointers=new Map<number,Node>();
 private retiredPointers=new Map<number,Node>();
 private frame=0;
 private frameEpoch=0;
 private disposed=false;
 private mutating=false;
 private invalidated=false;
 private focusSerial=0;
 private label:HTMLElement;
 private actions:HTMLElement;
 private doc:Document;
 private listenerDoc?:Document;
 private stopWindow?:()=>void;
 constructor(readonly host:HTMLElement,private changed:()=>void){
  this.doc=host.ownerDocument;
  // Use the exact native owner document; this helper also runs without host DOM extensions.
  this.label=this.doc.createElement('span');this.label.className='ts-card-context-label';
  this.actions=this.doc.createElement('div');this.actions.className='ts-card-context-actions';this.actions.setAttribute('role','toolbar');
  host.append(this.label,this.actions);host.hidden=true;
  this.listen(this.doc);
  if(typeof host.onWindowMigrated==='function')this.stopWindow=host.onWindowMigrated(()=>this.syncOwner());
  host.addEventListener('click',this.click,true);
 }
 owns(card:HTMLElement){return !this.invalidated&&this.lease?.card===card;}
 contains(card:HTMLElement,target:Node|null){return !!target&&this.owns(card)&&this.actions.contains(target);}
 first(card:HTMLElement){return this.owns(card)?this.actions.querySelector<HTMLButtonElement>('button:not(:disabled)'):null;}
 matches(card:HTMLElement,target:Element|null,selector:string){return !!target&&this.contains(card,target)&&!!target.closest(selector);}
 update(target?:CardControlContextTarget,preserveFocus=false){
  if(this.disposed||!this.syncOwner())return;
  if(this.pointers.size||this.mutating){this.pending={target,preserveFocus};return;}
  this.mutating=true;
  try{
  this.pending=undefined;
  if(target&&(!target.current()||target.card.ownerDocument!==this.doc||this.host.ownerDocument!==this.doc||!target.card.isConnected))target=undefined;
  if(target&&this.lease?.owner===target.owner&&this.lease.card===target.card){
   this.lease.current=target.current;this.setLabel(target.label);return;
  }
  this.release(preserveFocus);
  if(!target)return;
  const controls=Array.from(target.card.querySelectorAll<HTMLElement>(':scope > .ts-card-actions, :scope > .ts-compact-fold-row > .ts-compact-actions, :scope > .ts-compact-fold-row > .ts-compact-inline-unfold'));
  // Every direct group now shares its owning render scope. Media updates keep
  // that same group and both buttons alive while they are borrowed here.
  controls.push(...Array.from(target.card.querySelectorAll<HTMLElement>(':scope > .ts-branch-controls')));
  if(!controls.length)return;
  const focusSerial=this.focusSerial,focused=this.doc.activeElement as HTMLElement|null,retain=!!focused&&controls.some(el=>el===focused||el.contains(focused));
  const borrowed=controls.map(element=>{const anchor=this.doc.createComment('thoughtspace-control-return');element.before(anchor);return{element,anchor};});
  const lease={...target,controls:borrowed};this.lease=lease;
  for(const {element}of borrowed){this.actions.append(element);if(this.invalidated||this.disposed||this.lease!==lease)return;}
  if(!target.current()){this.release(false);return;}
  target.card.dataset.controlContext='true';this.host.dataset.controlOwner=target.card.dataset.id||'';this.host.hidden=false;this.setLabel(target.label);
  if(retain&&focused)this.restoreFocus(focused,focusSerial,target.current);
  this.changed();
  }finally{if(this.invalidated){this.pending=undefined;this.release(false);this.invalidated=false;}this.mutating=false;this.syncOwner();if(this.pending&&!this.pointers.size&&!this.disposed)this.schedulePending();}
 }
 /** Removal/owner change invalidates held input immediately, without waiting
  * for a pointer release which may never arrive after native navigation. */
 clear(card?:HTMLElement){
  if(card&&this.lease?.card!==card){if(this.pending?.target?.card===card)this.pending=undefined;return;}
  this.pending=undefined;this.pointers.clear();this.cancelFrame();if(this.mutating){this.invalidated=true;return;}
  this.mutating=true;this.invalidated=true;
  try{this.release(false);}finally{this.pending=undefined;this.invalidated=false;this.mutating=false;this.cancelFrame();}
 }
 /** A live control update invalidates only input held on that control. The
  * group and its anchor stay leased; unrelated pressed actions remain held. */
 invalidateControl(control:HTMLElement){
  for(const[id,target]of this.pointers)if(control===target||control.contains(target))this.pointers.delete(id);
  if(!this.pointers.size&&this.pending&&!this.disposed)this.schedulePending();
 }
 private setLabel(label:string){
  if(this.label.textContent!==label)this.label.textContent=label;
  this.label.title=label;this.actions.setAttribute('aria-label',label+' · 对象操作');
 }
 private release(preserveFocus:boolean){
  const lease=this.lease;if(!lease)return;this.lease=undefined;
  const focusSerial=this.focusSerial,focused=this.doc.activeElement as HTMLElement|null,retain=preserveFocus&&!!focused&&this.actions.contains(focused)&&lease.current();
  for(const {element,anchor}of lease.controls){if(anchor.parentNode){anchor.replaceWith(element);}else if(this.actions.contains(element))element.remove();}
  delete lease.card.dataset.controlContext;delete this.host.dataset.controlOwner;this.host.hidden=true;this.label.textContent='';
  if(retain&&focused)this.restoreFocus(focused,focusSerial,lease.current);
  this.changed();
 }
 private listen(doc:Document){
  if(this.listenerDoc===doc)return;this.unlisten();this.listenerDoc=doc;
  doc.addEventListener('pointerdown',this.down,true);doc.addEventListener('focusin',this.focusChanged,true);doc.addEventListener('click',this.retiredClick,true);
  doc.addEventListener('pointerup',this.up,true);doc.addEventListener('pointercancel',this.up,true);doc.defaultView?.addEventListener('blur',this.cancelPointers);
 }
 private unlisten(){
  const doc=this.listenerDoc;if(!doc)return;this.listenerDoc=undefined;
  doc.removeEventListener('pointerdown',this.down,true);doc.removeEventListener('focusin',this.focusChanged,true);doc.removeEventListener('click',this.retiredClick,true);
  doc.removeEventListener('pointerup',this.up,true);doc.removeEventListener('pointercancel',this.up,true);doc.defaultView?.removeEventListener('blur',this.cancelPointers);
 }
 /** The host moves the original view into a native window. Retain every lease
  * node/anchor, discard old-window input, and bind only after the exact lease
  * and complete context have reached the same document. Never focus on move. */
 private syncOwner=()=>{
  if(this.disposed)return false;const next=this.host.ownerDocument;
  if(next===this.doc){this.listen(next);return true;}
  this.pending=undefined;for(const[id,target]of this.pointers)this.retiredPointers.set(id,target);this.pointers.clear();this.cancelFrame();this.unlisten();this.focusSerial++;
  if(this.mutating){this.invalidated=true;return false;}
  if(!this.host.isConnected||this.label.ownerDocument!==next||this.actions.ownerDocument!==next||this.lease&&this.lease.card.ownerDocument!==next)return false;
  const retire=!!this.lease&&!this.lease.current();
  if(retire&&!this.lease!.controls.every(({element,anchor})=>element.ownerDocument===next&&anchor.ownerDocument===next&&!!anchor.parentNode&&this.lease!.card.contains(anchor)))return false;
  this.doc=next;this.listen(next);
  // Selection can change while the same native view is moving. Return only
  // provably original in-document anchors, then permit its new valid selection.
  if(retire)this.clear();return !this.disposed;
 };
 private focusChanged=(event:FocusEvent)=>{if(event.currentTarget===this.doc)this.focusSerial++;};
 private restoreFocus(focused:HTMLElement,serial:number,current:()=>boolean){
  const active=this.doc.activeElement;
  // DOM removal can blur to the document. A deliberate focus move made by a
  // native handler belongs to that new target, even if our card is still live.
  if(active===focused||this.invalidated||this.disposed||serial!==this.focusSerial||active&&active!==this.doc.body&&active!==this.doc.documentElement||!current()||!focused.isConnected||focused.ownerDocument!==this.doc||!this.doc.hasFocus())return;
  focused.focus({preventScroll:true});
 }
 private down=(event:PointerEvent)=>{
  if(event.currentTarget!==this.doc||this.host.ownerDocument!==this.doc)return;
  // A new press is a new gesture, including a primary button already returned
  // to its card. Only the original stale target is guarded between presses.
  this.retiredPointers.delete(event.pointerId);const target=event.target as Node|null;
  if(this.lease?.current()&&target&&this.actions.contains(target)){const button=(target as Element).closest?.('button');this.pointers.set(event.pointerId,button&&this.actions.contains(button)?button:target);}
 };
 private up=(event:PointerEvent)=>{if(event.currentTarget!==this.doc||!this.pointers.delete(event.pointerId)||this.pointers.size||!this.pending)return;this.schedulePending();};
 private cancelPointers=()=>{this.pointers.clear();if(this.pending)this.schedulePending();};
 private schedulePending(){if(!this.frame){const epoch=this.frameEpoch;this.frame=this.doc.defaultView!.requestAnimationFrame(()=>{if(epoch!==this.frameEpoch||this.disposed)return;this.frame=0;const next=this.pending;if(next)this.update(next.target,next.preserveFocus);});}}
 private cancelFrame(){this.frameEpoch++;if(this.frame)this.doc.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;}
 private isRetiredClick(event:MouseEvent){
  const id=(event as PointerEvent).pointerId,target=event.target as Node|null;
  const originals=Number.isFinite(id)?[this.retiredPointers.get(id)]:Array.from(this.retiredPointers.values());
  return event.detail!==0&&!!target&&originals.some(old=>old?.isConnected&&old.ownerDocument===this.doc&&(old===target||old.contains(target)));
 }
 private retiredClick=(event:MouseEvent)=>{if(!this.disposed&&event.currentTarget===this.doc&&this.host.ownerDocument===this.doc&&this.isRetiredClick(event)){event.preventDefault();event.stopImmediatePropagation();}};
 private click=(event:MouseEvent)=>{
  const owner=this.syncOwner();
  if(!owner||this.isRetiredClick(event)||event.view&&event.view.document!==this.doc||this.invalidated||!this.lease?.current()||this.lease.card.ownerDocument!==this.doc||this.host.ownerDocument!==this.doc){event.preventDefault();event.stopImmediatePropagation();}
 };
 dispose(){if(this.disposed)return;this.disposed=true;this.stopWindow?.();this.stopWindow=undefined;this.clear();this.retiredPointers.clear();this.unlisten();this.host.removeEventListener('click',this.click,true);}
}

/** Keep unrelated invisible ports out of normal sequential navigation. The
 * explicit connect mode retains the original keyboard target route. */
export function syncCardPortTabStops(card:HTMLElement,enabled:boolean){
 for(const port of Array.from(card.querySelectorAll<HTMLButtonElement>(':scope > .ts-connect-port'))){const value=enabled?0:-1;if(port.tabIndex!==value)port.tabIndex=value;}
}
