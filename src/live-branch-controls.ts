import {setIcon} from 'obsidian';
import type {BranchControlsOptions} from './branch-controls';
interface LiveBranchHooks {current:()=>boolean;canAct:()=>boolean;invalidate:(group:HTMLElement)=>void;fallbackFocus:()=>HTMLElement|null|undefined}
interface LiveBranchRecord {update:(options:BranchControlsOptions)=>boolean;dispose:()=>void}
const records=new WeakMap<HTMLElement,LiveBranchRecord>();

/** Keep the exact group/buttons while a playing media node updates relations.
 * The ordinary context lease can borrow this group without breaking updates. */
export function mountLiveBranchControls(host:HTMLElement,initial:BranchControlsOptions,hooks:LiveBranchHooks):()=>void {
 if(records.has(host))throw Error('Live branch controls already mounted for this host');
 let doc=host.ownerDocument,win=doc.defaultView,stopWindow:(()=>void)|undefined;
 const group=host.createDiv({cls:'ts-branch-controls',attr:{role:'group','aria-label':'子节点展开与折叠','data-live-branch':''}});
 let options=initial,disposed=false,listening=false,space:HTMLButtonElement|null=null,spaceInvalid=false;
 const held=new Map<number,HTMLButtonElement>(),invalid=new Map<number,HTMLButtonElement>();
 const current=()=>!disposed&&host.isConnected&&group.isConnected&&host.ownerDocument===doc&&group.ownerDocument===doc&&hooks.current();
 const stop=(event:Event)=>event.stopPropagation();group.onpointerdown=stop;group.ondblclick=stop;
 const make=(cls:string)=>{const b=group.createEl('button',{cls,attr:{type:'button'}});b.onpointerdown=stop;b.ondblclick=stop;return b;};
 const toggle=make('ts-branch-toggle'),toggleIcon=toggle.createSpan({cls:'ts-branch-icon',attr:{'aria-hidden':'true'}}),count=toggle.createSpan({cls:'ts-branch-count',attr:{'aria-hidden':'true'}});
 const menu=make('ts-branch-menu'),menuIcon=menu.createSpan({cls:'ts-branch-icon',attr:{'aria-hidden':'true'}});setIcon(menuIcon,'chevron-down');menu.setAttribute('aria-haspopup','menu');
 let lastIcon='';
 const staleHeld=(button:HTMLButtonElement)=>space===button&&spaceInvalid||Array.from(held).some(([id,target])=>target===button&&invalid.get(id)===button);
 const syncDisabled=()=>{const available=options.count>0||options.candidates>0;for(const[b,enabled]of [[toggle,available],[menu,options.count>0]] as const){b.disabled=disposed||options.disabled||!enabled||staleHeld(b);b.setAttribute('aria-disabled',String(b.disabled));}};
 const unlisten=()=>{if(!listening)return;listening=false;doc.removeEventListener('pointerup',up,true);doc.removeEventListener('pointercancel',up,true);doc.removeEventListener('keyup',keyUp,true);win?.removeEventListener('blur',blur);};
 const listen=()=>{if(listening)return;listening=true;doc.addEventListener('pointerup',up,true);doc.addEventListener('pointercancel',up,true);doc.addEventListener('keyup',keyUp,true);win?.addEventListener('blur',blur);};
 const invalidate=()=>{for(const[id,button]of held)invalid.set(id,button);if(space)spaceInvalid=true;syncDisabled();hooks.invalidate(group);};
 const blur=(event:Event)=>{if(event.currentTarget!==win)return;invalidate();held.clear();space=null;unlisten();syncDisabled();};
 function up(event:PointerEvent){if(event.currentTarget!==doc||!held.delete(event.pointerId))return;if(!held.size&&!space)unlisten();syncDisabled();}
 const syncOwner=()=>{
  if(disposed)return false;const next=host.ownerDocument;if(next===doc)return true;
  // Adoption keeps original nodes; old-window input can never become a new
  // window activation. Do not move or recreate the media/native elements.
  invalidate();held.clear();space=null;unlisten();syncDisabled();
  if(!host.isConnected||!group.isConnected||group.ownerDocument!==next||!hooks.current())return false;
  doc=next;win=doc.defaultView;return true;
 };
 const down=(event:PointerEvent)=>{
  const target=event.target as Node|null,button=target&&toggle.contains(target)?toggle:target&&menu.contains(target)?menu:undefined;
  if(!syncOwner()||!button||button.disabled||event.view&&event.view.document!==doc||!current()||!hooks.canAct())return;
  // A fresh press owns a fresh gesture; a stale release/click stays rejected
  // after update until this press. No pointer listener is global while idle.
  invalid.delete(event.pointerId);held.set(event.pointerId,button);
  listen();
 };
 const activate=(button:HTMLButtonElement)=>{
  if(!current()||!hooks.canAct()||button.disabled||button.hidden||group.hidden||options.disabled)return;
  if(button===toggle){if(options.count>0||options.candidates>0)options.onToggle();}
  else if(options.count>0)options.onMenu(button);
 };
 const keyDown=(event:KeyboardEvent)=>{
  if(!syncOwner()||event.key!==' '||event.view&&event.view.document!==doc||event.defaultPrevented||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const button=event.target===toggle?toggle:event.target===menu?menu:null;
  if(!button||doc.activeElement!==button||button.disabled||button.hidden||group.hidden||!current()||!hooks.canAct())return;
  // Own the Space default action for this exact press. Preventing both halves
  // avoids a late native click on an unchanged button with replacement options.
  // Independent AT/Enter clicks remain ordinary click actions.
  event.preventDefault();event.stopPropagation();
  if(event.repeat||space)return;
  space=button;spaceInvalid=false;listen();
 };
 function keyUp(event:KeyboardEvent){
  if(event.currentTarget!==doc||event.key!==' '||!space)return;
  const button=space,allowed=!spaceInvalid&&!event.defaultPrevented&&!event.isComposing&&event.keyCode!==229&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.target===button&&doc.activeElement===button&&doc.hasFocus();
  event.preventDefault();event.stopPropagation();space=null;if(!held.size)unlisten();syncDisabled();
  if(allowed)activate(button);
 }
 const focusOut=(event:FocusEvent)=>{if(space&&event.target===space){spaceInvalid=true;syncDisabled();}};
 const action=(button:HTMLButtonElement,event:MouseEvent)=>{
  event.stopPropagation();if(!syncOwner()||event.view&&event.view.document!==doc||!current()||!hooks.canAct()||button.disabled||button.hidden||group.hidden||options.disabled)return;
  const pointerId=(event as PointerEvent).pointerId;
  if(event.detail!==0&&(Number.isFinite(pointerId)?invalid.has(pointerId):Array.from(invalid.values()).includes(button)))return;
  activate(button);
 };
 toggle.onclick=event=>action(toggle,event);menu.onclick=event=>action(menu,event);group.addEventListener('pointerdown',down,true);group.addEventListener('keydown',keyDown,true);group.addEventListener('focusout',focusOut,true);
 const record:LiveBranchRecord={
  update(next){
   if(!syncOwner()||!current())return false;
   const focused=doc.activeElement as HTMLElement|null;options=next;
   // Invalidate before changing labels, availability or callbacks. Context
   // pending navigation may release after this synchronous update, never here.
   invalidate();if(!current())return false;
   const established=options.count>0,available=established||options.candidates>0;
   const label=established?(options.folded?`展开下一层 · ${options.count} 个子节点`:`折叠子节点 · ${options.count} 个子节点`):'设为子节点并折叠 · 可撤销';
   toggle.title=label;toggle.setAttribute('aria-label',label);toggle.classList.toggle('ts-branch-setup',!established);
   if(established)toggle.setAttribute('aria-expanded',String(!options.folded));else toggle.removeAttribute('aria-expanded');
   count.textContent=String(established?options.count:options.candidates);
   const icon=established?(options.folded?'plus':'minus'):'git-branch';if(icon!==lastIcon){lastIcon=icon;setIcon(toggleIcon,icon);}
   menu.title='子节点展开与折叠菜单';menu.setAttribute('aria-label',menu.title);group.setAttribute('aria-disabled',String(options.disabled));
   syncDisabled();if(available){group.hidden=false;toggle.hidden=false;}if(established)menu.hidden=false;
   const hiding=focused===menu&&!established||focused===toggle&&!available;
   if(hiding&&doc.activeElement===focused&&doc.hasFocus()&&current()&&hooks.canAct()){
    const target=available&&!toggle.disabled?toggle:hooks.fallbackFocus();
    if(target&&target!==focused&&target.ownerDocument===doc&&target.isConnected&&!target.hidden&&!(target as HTMLButtonElement).disabled&&target.getClientRects().length&&doc.activeElement===focused&&current()&&hooks.canAct())target.focus({preventScroll:true});
   }
   menu.hidden=!established;toggle.hidden=!available;group.hidden=!available;
   return true;
  },
  dispose(){if(disposed)return;disposed=true;stopWindow?.();stopWindow=undefined;invalidate();held.clear();invalid.clear();space=null;unlisten();toggle.disabled=menu.disabled=true;toggle.onclick=menu.onclick=null;group.removeEventListener('pointerdown',down,true);group.removeEventListener('keydown',keyDown,true);group.removeEventListener('focusout',focusOut,true);if(records.get(host)===record)records.delete(host);}
 };
 records.set(host,record);if(typeof host.onWindowMigrated==='function')stopWindow=host.onWindowMigrated(syncOwner);record.update(initial);return record.dispose;
}
/** Missing/disposed original hosts cannot create a new group or player. */
export function updateLiveBranchControls(host:HTMLElement,options:BranchControlsOptions):boolean{return records.get(host)?.update(options)??false;}
