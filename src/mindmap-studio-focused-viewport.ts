/** Keep the user's existing Studio text focus visible after a keyboard resize.
 * This changes scroll position only: never focus, selection, values or drafts. */
export function bindStudioFocusedViewport(root:HTMLElement):()=>void {
 const doc=root.ownerDocument,win=doc.defaultView;
 if(!win||typeof win.requestAnimationFrame!=='function')return()=>{};
 const viewport=win.visualViewport;
 let first=0,second=0,third=0,stopped=false,pending:HTMLElement|null=null;
 const current=():HTMLElement|null=>{
  const active=doc.activeElement as HTMLElement|null;
  return active&&root.contains(active)&&active.matches('textarea,input:not([type]),input[type=text],input[type=search],input[type=url],input[type=email],input[type=tel],input[type=number],[contenteditable=true]')?active:null;
 };
 const owns=(input:HTMLElement|null):input is HTMLElement=>!stopped&&root.isConnected&&!!input?.isConnected&&current()===input&&input.ownerDocument===doc&&(!viewport||Math.abs(viewport.scale-1)<=.05);
 const geometry=(input:HTMLElement)=>{
  const rect=input.getBoundingClientRect();
  if(!input.getClientRects().length||rect.width<=0||rect.height<=0)return;
  const top=viewport?.offsetTop??0,left=viewport?.offsetLeft??0;
  const clip={top,left,right:left+(viewport?.width??win.innerWidth),bottom:top+(viewport?.height??win.innerHeight)};
  for(let node=input.parentElement;node;node=node.parentElement){
   const css=win.getComputedStyle(node),box=node.getBoundingClientRect();
   if(/^(auto|scroll|hidden|clip)$/.test(css.overflowX)){clip.left=Math.max(clip.left,box.left+node.clientLeft);clip.right=Math.min(clip.right,box.left+node.clientLeft+node.clientWidth);}
   if(/^(auto|scroll|hidden|clip)$/.test(css.overflowY)){clip.top=Math.max(clip.top,box.top+node.clientTop);clip.bottom=Math.min(clip.bottom,box.top+node.clientTop+node.clientHeight);}
   if(node===root)break;
  }
  return{visible:rect.left>=clip.left&&rect.right<=clip.right&&rect.top>=clip.top&&rect.bottom<=clip.bottom,fits:rect.width<=clip.right-clip.left&&rect.height<=clip.bottom-clip.top};
 };
 const reveal=()=>{
  second=0;const input=pending;pending=null;
  // Pinch zoom is a separate user gesture, not a keyboard layout request.
  if(!owns(input))return;
  const before=geometry(input);if(!before||before.visible)return;
  input.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  if(!owns(input))return;
  // Native nearest scrolling can leave an input against an ancestor's clipping
  // boundary. Verify actual layout one frame later; never assume the request
  // itself proved visibility. At most one centered fallback, with no focus or
  // draft changes and no retry loop if the viewport cannot fit this input.
  third=win.requestAnimationFrame(()=>{
   third=0;if(!owns(input))return;
   const after=geometry(input);
   if(after&&!after.visible&&after.fits)input.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  });
 };
 const queue=()=>{
  if(stopped)return;
  pending=current();if(third){win.cancelAnimationFrame(third);third=0;}if(!pending||first||second)return;
  // bindBoardModalViewport writes its CSS height in the first frame; measure
  // after the resulting layout, in the input's own document.
  first=win.requestAnimationFrame(()=>{first=0;if(!stopped)second=win.requestAnimationFrame(reveal);});
 };
 viewport?.addEventListener('resize',queue);viewport?.addEventListener('scroll',queue);
 win.addEventListener('resize',queue);root.addEventListener('focusin',queue);
 const Observer=(win as Window&{ResizeObserver?:typeof ResizeObserver}).ResizeObserver;
 const observer=Observer?new Observer(queue):undefined;observer?.observe(root);
 queue();
 return()=>{
  if(stopped)return;stopped=true;pending=null;win.cancelAnimationFrame(first);win.cancelAnimationFrame(second);win.cancelAnimationFrame(third);observer?.disconnect();
  viewport?.removeEventListener('resize',queue);viewport?.removeEventListener('scroll',queue);
  win.removeEventListener('resize',queue);root.removeEventListener('focusin',queue);
 };
}
