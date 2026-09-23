function toolbarScrollParent(host:HTMLElement){
 for(let parent=host.parentElement;parent&&parent!==host.ownerDocument.body;parent=parent.parentElement){
  if(parent.matches('.ts-commandbar'))return parent;
  if(parent.scrollWidth>parent.clientWidth&&/^(auto|scroll|hidden)$/.test(host.ownerDocument.defaultView?.getComputedStyle(parent).overflowX||''))return parent;
 }
 return null;
}

/** Keep toolbar scroll stable; restore only focus lost by replacing its controls. */
export function preserveToolbarFocus(host:HTMLElement){
 const doc=host.ownerDocument,previous=doc.activeElement as HTMLElement|null;
 const focused=previous&&host.contains(previous)?previous:null;
 const label=focused?.getAttribute('aria-label'),tag=focused?.tagName,type=focused?.getAttribute('type'),scroll=host.scrollLeft;
 const scrollParent=toolbarScrollParent(host),parentScroll=scrollParent?.scrollLeft??0;
 return()=>{
  if(!host.isConnected)return;
  if(label&&focused&&!focused.isConnected&&(doc.activeElement===doc.body||doc.activeElement===focused)){
   const next=Array.from(host.querySelectorAll<HTMLElement>('[aria-label]')).find(el=>el.tagName===tag&&el.getAttribute('aria-label')===label&&el.getAttribute('type')===type&&!el.matches(':disabled,[hidden]'));
   next?.focus({preventScroll:true});
  }
  host.scrollLeft=scroll;
  if(scrollParent?.isConnected&&scrollParent.contains(host))scrollParent.scrollLeft=parentScroll;
 };
}
