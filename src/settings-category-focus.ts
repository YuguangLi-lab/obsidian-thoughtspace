/** Preserve only an already focused category control when its responsive peer
 * replaces it. Other inputs and the host Settings navigation keep their focus. */
export function bindSettingsCategoryFocus(root:HTMLElement,picker:HTMLSelectElement,activeButton:()=>HTMLElement|undefined){
 const doc=root.ownerDocument;let previous:HTMLElement|null=null,disposed=false;
 const category=(target:EventTarget|null):HTMLElement|null=>{const element=target as HTMLElement|null;return element&&typeof element.matches==='function'&&root.contains(element)&&element.matches('.ts-settings-category-picker,.ts-settings-nav button')?element:null;};
 const visible=(element:HTMLElement)=>element.isConnected&&element.getClientRects().length>0;
 const restore=()=>{
  if(disposed||!root.isConnected||!previous||visible(previous))return;
  const focused=doc.activeElement;
  if(focused!==previous&&focused!==doc.body){previous=null;return;}
  const next=visible(picker)?picker:activeButton();if(!next||!visible(next))return;
  previous=next;next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',inline:'nearest'});
 };
 const focusIn=(event:FocusEvent)=>{previous=category(event.target);};
 const focusOut=(event:FocusEvent)=>{if(!previous||previous!==event.target)return;if(visible(previous))previous=null;else queueMicrotask(restore);};
 doc.addEventListener('focusin',focusIn,true);doc.addEventListener('focusout',focusOut,true);
 const observer=new ResizeObserver(restore);observer.observe(root);
 return()=>{disposed=true;previous=null;observer.disconnect();doc.removeEventListener('focusin',focusIn,true);doc.removeEventListener('focusout',focusOut,true);};
}
