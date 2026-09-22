/** Restore only focus lost by replacing this toolbar, never focus moved elsewhere by the user. */
export function preserveToolbarFocus(host:HTMLElement){
 const doc=host.ownerDocument,previous=doc.activeElement as HTMLElement|null;
 if(!previous||!host.contains(previous))return()=>{};
 const label=previous.getAttribute('aria-label'),tag=previous.tagName,type=previous.getAttribute('type'),scroll=host.scrollLeft;
 return()=>{
  if(!label||previous.isConnected||!host.isConnected||(doc.activeElement!==doc.body&&doc.activeElement!==previous))return;
  const next=Array.from(host.querySelectorAll<HTMLElement>('[aria-label]')).find(el=>el.tagName===tag&&el.getAttribute('aria-label')===label&&el.getAttribute('type')===type&&!el.matches(':disabled,[hidden]'));
  if(next){next.focus({preventScroll:true});host.scrollLeft=scroll;}
 };
}
