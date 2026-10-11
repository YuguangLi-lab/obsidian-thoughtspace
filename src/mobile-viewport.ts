interface VisibleViewport {height:number;offsetTop:number;scale:number}

/** The keyboard/viewport belongs to this view's window, including pop-outs. */
export function mobileViewportLayout(top:number,windowHeight:number,viewport?:VisibleViewport,editing=false){
 const height=viewport&&Number.isFinite(viewport.height)?Math.max(0,viewport.height):Math.max(0,windowHeight);
 const offset=viewport&&Number.isFinite(viewport.offsetTop)?Math.max(0,viewport.offsetTop):0;
 const visibleHeight=Math.max(0,Math.floor(offset+height-Math.max(offset,Number.isFinite(top)?top:0)));
 const keyboard=editing&&Math.abs((viewport?.scale??1)-1)<.05&&windowHeight-height-offset>120;
 return {visibleHeight,keyboard};
}

/** Layout only: never re-render editors, change a document, or reset a gesture. */
export function bindMobileViewport(root:HTMLElement):()=>void {
 const doc=root.ownerDocument,win=doc?.defaultView;
 if(!win||typeof win.requestAnimationFrame!=='function')return()=>{};
 const viewport=win.visualViewport;
 let frame=0,stopped=false;
 const properties=['--ts-visible-height'];
 const previous=properties.map(key=>root.style.getPropertyValue(key));
 const oldKeyboard=root.getAttribute('data-ts-keyboard'),oldCompact=root.getAttribute('data-ts-compact');
 const refresh=()=>{
  frame=0;if(stopped)return;
  const rect=root.getBoundingClientRect(),active=doc.activeElement;
  const editing=!!active&&root.contains(active)&&!!active.closest('input,textarea,[contenteditable="true"],.cm-editor');
  const layout=mobileViewportLayout(rect.top,win.innerHeight,viewport??undefined,editing);
  const value=layout.visibleHeight+'px';
  if(root.style.getPropertyValue(properties[0])!==value)root.style.setProperty(properties[0],value);
  const keyboard=String(layout.keyboard),compact=String(rect.width<=900);
  if(root.dataset.tsKeyboard!==keyboard)root.dataset.tsKeyboard=keyboard;
  if(root.dataset.tsCompact!==compact)root.dataset.tsCompact=compact;
 };
 const queue=()=>{if(!stopped&&!frame)frame=win.requestAnimationFrame(refresh);};
 viewport?.addEventListener('resize',queue);viewport?.addEventListener('scroll',queue);
 win.addEventListener('resize',queue);doc.addEventListener('focusin',queue);doc.addEventListener('focusout',queue);
 const WindowObserver=(win as Window&{ResizeObserver?:typeof ResizeObserver}).ResizeObserver;
 const observer=WindowObserver?new WindowObserver(queue):undefined;observer?.observe(root);
 refresh();
 return()=>{
  if(stopped)return;stopped=true;win.cancelAnimationFrame(frame);observer?.disconnect();
  viewport?.removeEventListener('resize',queue);viewport?.removeEventListener('scroll',queue);
  win.removeEventListener('resize',queue);doc.removeEventListener('focusin',queue);doc.removeEventListener('focusout',queue);
  properties.forEach((key,i)=>previous[i]?root.style.setProperty(key,previous[i]):root.style.removeProperty(key));
  if(oldKeyboard===null)root.removeAttribute('data-ts-keyboard');else root.setAttribute('data-ts-keyboard',oldKeyboard);
  if(oldCompact===null)root.removeAttribute('data-ts-compact');else root.setAttribute('data-ts-compact',oldCompact);
 };
}
