interface ChromeRect {left:number;right:number;top:number;bottom:number}

export function compactBoardChrome(width:number,coarse:boolean){return width>0&&(width<=600||coarse&&width<=900);}
export function boardFooterReserve(main:ChromeRect,footer?:ChromeRect){return footer&&footer.bottom>footer.top?Math.max(0,main.bottom-footer.top)+12:28;}

/** Only reserve a visible bottom overlay which intersects this dock horizontally.
 * A different pane, popout or keyboard-reduced canvas must not inherit its gap. */
export function boardHostBottomInset(main:ChromeRect,dock:ChromeRect,bar?:ChromeRect){
 if(!bar||bar.right<=bar.left||bar.bottom<=bar.top||bar.top>=main.bottom||bar.bottom<main.bottom-1||bar.top<main.top||bar.bottom-bar.top>(main.bottom-main.top)/2)return 0;
 if(Math.min(dock.right,bar.right)<=Math.max(dock.left,bar.left))return 0;
 return Math.max(0,Math.ceil(main.bottom-bar.top));
}

/** Keep actual rail commands authoritative; proxies share their busy and mode state. */
export function bindBoardToolProxy(source:HTMLButtonElement,target:HTMLButtonElement,changed?:()=>void){
 const sync=()=>{
  const active=source.classList.contains('is-active');target.classList.toggle('is-active',active);target.disabled=source.disabled;
  for(const name of ['aria-disabled','aria-busy','aria-expanded','aria-haspopup','aria-controls']){const value=source.getAttribute(name);if(value===null)target.removeAttribute(name);else target.setAttribute(name,value);}
  if(source.hasAttribute('aria-pressed')||source.getAttribute('aria-label')==='连线')target.setAttribute('aria-pressed',String(active));
  changed?.();
 };
 const Observer=source.ownerDocument.defaultView?.MutationObserver,observer=Observer?new Observer(sync):undefined;
 observer?.observe(source,{attributes:true,attributeFilter:['class','disabled','aria-disabled','aria-busy','aria-pressed','aria-expanded','aria-haspopup','aria-controls']});sync();
 return()=>observer?.disconnect();
}

/** Read only this window's host chrome. Never resize the stage or modify the host. */
export function bindBoardHostInset(main:HTMLElement,dock:HTMLElement,changed:()=>void,panels:readonly HTMLElement[]=[]){
 const doc=main.ownerDocument,win=doc.defaultView;if(!win)return()=>{};
 const property='--ts-host-bottom-inset',previous=main.style.getPropertyValue(property),panelProperty='--ts-palette-host-inset';
 const surfaces=Array.from(new Set(panels)).map(panel=>({panel,previous:panel.style.getPropertyValue(panelProperty)}));let disposed=false,frame=0,bar:HTMLElement|null=null;
 const schedule=()=>{if(!disposed&&!frame)frame=win.requestAnimationFrame(refresh);};
 const observer=win.ResizeObserver?new win.ResizeObserver(schedule):undefined;
 const barAttributes=win.MutationObserver?new win.MutationObserver(schedule):undefined;
 const refresh=()=>{
  frame=0;if(disposed)return;
  const next=doc.querySelector<HTMLElement>('.status-bar');
  if(next!==bar){if(bar)observer?.unobserve(bar);barAttributes?.disconnect();bar=next;if(bar){observer?.observe(bar);barAttributes?.observe(bar,{attributes:true,attributeFilter:['class','style','hidden']});}}
  const style=bar?win.getComputedStyle(bar):undefined,visible=bar&&bar.getClientRects().length&&style?.display!=='none'&&style?.visibility!=='hidden';
  const bounds=main.getBoundingClientRect(),barBounds=visible?bar?.getBoundingClientRect():undefined,value=`${boardHostBottomInset(bounds,dock.getBoundingClientRect(),barBounds)}px`;let updated=false;
  if(main.style.getPropertyValue(property)!==value){main.style.setProperty(property,value);updated=true;}
  // Short palettes hide the dock. Each visible panel therefore owns its own
  // horizontal projection, independent of the hidden dock or another palette.
  // Keep the stable main bottom as the reference after the panel is shortened.
  for(const {panel}of surfaces){
   const own=panel.ownerDocument===doc&&panel.isConnected&&!panel.hidden,style=own?win.getComputedStyle(panel):undefined;
   const rect=own&&panel.getClientRects().length&&style?.display!=='none'&&style?.visibility!=='hidden'?panel.getBoundingClientRect():undefined;
   const inset=rect&&rect.bottom>rect.top?boardHostBottomInset(bounds,rect,barBounds):0,panelValue=`${inset}px`;
   if(panel.style.getPropertyValue(panelProperty)!==panelValue){panel.style.setProperty(panelProperty,panelValue);updated=true;}
  }
  if(updated)changed();
 };
 // A status bar may be added to or removed from a newly opened owner window.
 const host=win.MutationObserver?new win.MutationObserver(schedule):undefined;
 host?.observe(doc.body,{childList:true,attributes:true,attributeFilter:['class','style']});
 const panelChanges=surfaces.length&&win.MutationObserver?new win.MutationObserver(schedule):undefined;
 for(const {panel}of surfaces){observer?.observe(panel);panelChanges?.observe(panel,{attributes:true,attributeFilter:['hidden','class','style']});}
 observer?.observe(main);observer?.observe(dock);win.addEventListener('resize',schedule);win.visualViewport?.addEventListener('resize',schedule);win.visualViewport?.addEventListener('scroll',schedule);refresh();
 return()=>{if(disposed)return;disposed=true;win.cancelAnimationFrame(frame);observer?.disconnect();barAttributes?.disconnect();host?.disconnect();panelChanges?.disconnect();win.removeEventListener('resize',schedule);win.visualViewport?.removeEventListener('resize',schedule);win.visualViewport?.removeEventListener('scroll',schedule);if(previous)main.style.setProperty(property,previous);else main.style.removeProperty(property);for(const {panel,previous}of surfaces){if(previous)panel.style.setProperty(panelProperty,previous);else panel.style.removeProperty(panelProperty);}};
}
