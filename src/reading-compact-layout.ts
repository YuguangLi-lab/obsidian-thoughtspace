/** Arrange the existing navigation nodes; Markdown content keeps its identity. */
export function bindReadingCompactLayout(parts:{root:HTMLElement;details:HTMLDetailsElement;summary:HTMLElement;panel:HTMLElement;body:HTMLElement;aside:HTMLElement;reader:HTMLElement;page:HTMLElement;command:HTMLElement;footer:HTMLElement;pageIdentity:()=>unknown}){
 const {root,details,summary,panel,body,aside,reader,page,command,footer}=parts,doc=root.ownerDocument,win=doc.defaultView??doc.win;
 let stopped=false,compact:boolean|undefined,shortOpen=false,frame=0,pageScroll=0,pageIdentity:unknown;
 const moved=[aside,command,footer];
 const focus=(target:Element|null)=>{if(target?.isConnected&&target.ownerDocument===doc&&target.getClientRects().length)(target as HTMLElement).focus({preventScroll:true});};
 const syncOpen=()=>{
  if(stopped||root.ownerDocument!==doc||!compact)return;
  shortOpen=details.open;root.dataset.readingNavigationOpen=String(shortOpen);
  if(shortOpen){if(!body.hidden){pageScroll=page.scrollTop;pageIdentity=parts.pageIdentity();}body.hidden=true;}
  else{const wasHidden=body.hidden;body.hidden=false;if(wasHidden&&pageIdentity===parts.pageIdentity())page.scrollTop=pageScroll;else if(!wasHidden){pageScroll=page.scrollTop;pageIdentity=parts.pageIdentity();}if(panel.contains(doc.activeElement))focus(summary);}
 };
 const refresh=()=>{
  if(stopped||root.ownerDocument!==doc)return;
  const rect=root.getBoundingClientRect(),next=rect.width>0&&rect.width<=600&&rect.height>0&&rect.height<=580;
  if(next===compact)return;
  const active=doc.activeElement,owned=!!active&&moved.some(node=>node.contains(active)),summaryFocused=active===summary,readingFocused=!!active&&reader.contains(active)&&!command.contains(active);
  const scrolls=moved.flatMap(node=>[node,...Array.from(node.querySelectorAll<HTMLElement>('*'))]).filter(node=>node.scrollTop||node.scrollLeft).map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
  if(!body.hidden){pageScroll=page.scrollTop;pageIdentity=parts.pageIdentity();}
  if(compact)shortOpen=details.open;
  compact=next;root.dataset.readingCompact=String(next);
  if(next){details.hidden=false;details.open=owned||(!readingFocused&&shortOpen);for(const node of moved)panel.append(node);syncOpen();}
  else{body.hidden=false;root.dataset.readingNavigationOpen='false';body.insertBefore(aside,reader);reader.insertBefore(command,page);body.parentElement!.append(footer);details.hidden=true;if(pageIdentity===parts.pageIdentity())page.scrollTop=pageScroll;}
  for(const {node,top,left} of scrolls){node.scrollTop=top;node.scrollLeft=left;}
  // Reparenting may blur an owned input. Restore only that synchronous blur;
  // never replace another control, Markdown selection or external focus.
  if(owned&&(doc.activeElement===doc.body||doc.activeElement===active))focus(active);
  else if(!next&&summaryFocused&&(doc.activeElement===doc.body||doc.activeElement===summary))focus(aside.querySelector('input,button,select,summary'));
 };
 const queue=()=>{if(!stopped&&!frame)frame=win.requestAnimationFrame(()=>{frame=0;refresh();});};
 const observer=new ResizeObserver(queue);observer.observe(root);details.addEventListener('toggle',syncOpen);win.addEventListener('resize',queue);refresh();
 return{revealPage:()=>{if(stopped||root.ownerDocument!==doc||!compact||!details.open)return false;details.open=false;syncOpen();return true;},dispose:()=>{if(stopped)return;stopped=true;if(frame)win.cancelAnimationFrame(frame);observer.disconnect();details.removeEventListener('toggle',syncOpen);win.removeEventListener('resize',queue);}};
}
