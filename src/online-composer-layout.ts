/** Reorder metadata only. The textarea never detaches, so selection and IME
 * ownership remain native while the actual pane becomes narrow or short. */
export function bindOnlineComposerLayout(parts:{root:HTMLElement;composer:HTMLElement;details:HTMLDetailsElement;summary:HTMLElement;panel:HTMLElement;heading:HTMLElement;time:HTMLElement;input:HTMLTextAreaElement;actions:HTMLElement;hint:HTMLElement;positions:HTMLElement;switcher:HTMLElement;ready:()=>boolean;composing:()=>boolean}){
 const {root,composer,details,summary,panel,heading,time,input,actions,hint,positions,switcher}=parts,doc=root.ownerDocument,win=doc.defaultView??doc.win;
 let stopped=false,frame=0,compact:boolean|undefined,positionsInside:boolean|undefined,lastReady:boolean|undefined,metadataComposing=false,rememberedOpen=root.dataset.onlineShort==='true'?details.open:false;
 const focus=(target:Element|null)=>{if(target?.isConnected&&target.ownerDocument===doc&&target.getClientRects().length)(target as HTMLElement).focus({preventScroll:true});};
 const alive=()=>!stopped&&root.ownerDocument===doc;
 const syncToggle=()=>{if(alive()&&compact)rememberedOpen=details.open;};
 const refresh=()=>{
  if(!alive())return;
  const r=root.getBoundingClientRect(),next=r.width>0&&r.height>0&&(r.width<=480||r.width<=780&&r.height<=620),inside=next&&root.dataset.panel==='compose',ready=parts.ready();
  if(compact===next&&positionsInside===inside&&lastReady===ready)return;
  // Metadata moves can interrupt composition in its time field. Wait until the
  // native compositionend callback explicitly refreshes; never detach input.
  if(parts.composing()||metadataComposing)return;
  const active=doc.activeElement,owned=!!active&&(details.contains(active)||positions.contains(active)||hint.contains(active)),summaryFocused=active===summary;
  const scrolls=[details,panel,positions].map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
  if(compact)rememberedOpen=details.open;
  if(compact!==next||next&&lastReady!==ready){
   compact=next;root.dataset.onlineShort=String(next);summary.hidden=!next;
   if(next){details.open=owned||(!ready||rememberedOpen)&&active!==input;if(ready)composer.append(details);else composer.insertBefore(details,input);panel.append(hint);summary.append(time);}
   else{details.open=true;composer.insertBefore(details,input);actions.insertBefore(hint,actions.firstChild);heading.append(time);}
  }
  lastReady=ready;
  if(positionsInside!==inside){positionsInside=inside;if(inside)panel.append(positions);else root.insertBefore(positions,switcher);}
  for(const {node,top,left}of scrolls){node.scrollTop=top;node.scrollLeft=left;}
  if(!next&&summaryFocused&&(doc.activeElement===doc.body||doc.activeElement===summary))focus(parts.ready()?input:Array.from(panel.querySelectorAll('input:not(:disabled),button:not(:disabled)')).find(node=>node.getClientRects().length)||Array.from(panel.querySelectorAll('summary')).find(node=>node.getClientRects().length)||null);
  else if(owned&&(doc.activeElement===doc.body||doc.activeElement===active))focus(active);
 };
 const queue=()=>{if(alive()&&!frame)frame=win.requestAnimationFrame(()=>{frame=0;refresh();});};
 const compositionStart=(event:CompositionEvent)=>{if(alive()&&event.target instanceof (win as Window&{Node:typeof Node}).Node&&panel.contains(event.target))metadataComposing=true;};
 const compositionEnd=()=>{if(metadataComposing){metadataComposing=false;queue();}};
 const Observer=(win as Window&{ResizeObserver?:typeof ResizeObserver}).ResizeObserver,observer=Observer?new Observer(queue):undefined;
 observer?.observe(root);win.addEventListener('resize',queue);details.addEventListener('toggle',syncToggle);panel.addEventListener('compositionstart',compositionStart);panel.addEventListener('compositionend',compositionEnd);refresh();
 return{refresh,revealComposer:()=>{if(!alive())return;refresh();if(compact){rememberedOpen=false;details.open=false;}},dispose:()=>{if(stopped)return;stopped=true;win.cancelAnimationFrame(frame);observer?.disconnect();win.removeEventListener('resize',queue);details.removeEventListener('toggle',syncToggle);panel.removeEventListener('compositionstart',compositionStart);panel.removeEventListener('compositionend',compositionEnd);}};
}
