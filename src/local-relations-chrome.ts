import {boardHostBottomInset} from './board-chrome';

interface Rect {left:number;right:number;top:number;bottom:number}

/** Test each visible control, never the blank space between history pills. */
export function localRelationsBottomInset(root:Rect,controls:readonly Rect[],bar?:Rect){
 return controls.reduce((inset,control)=>bar&&control.right>control.left&&control.bottom>control.top&&control.bottom>bar.top&&control.top<bar.bottom?Math.max(inset,boardHostBottomInset(root,control,bar)):inset,0);
}

/** Bound only floating chrome; graph layout and scroll stay untouched. */
export function bindLocalRelationsChrome(root:HTMLElement,recent:HTMLElement){
 const doc=root.ownerDocument,win=doc.defaultView;if(!win)return()=>{};
 const property='--ts-relations-bottom-lift',previous=recent.style.getPropertyValue(property),popoverProperty='--ts-relations-popover-bottom-inset',previousPopover=root.style.getPropertyValue(popoverProperty);
 const popovers=Array.from(root.querySelectorAll<HTMLElement>('.ts-local-relations-picker,.ts-local-relations-filter-panel,.ts-local-relations-more-panel'));let disposed=false,frame=0,bar:HTMLElement|null=null;
 const schedule=()=>{if(!disposed&&!frame)frame=win.requestAnimationFrame(refresh);};
 const sizes=win.ResizeObserver?new win.ResizeObserver(schedule):undefined;
 const barAttributes=win.MutationObserver?new win.MutationObserver(schedule):undefined;
 const refresh=()=>{
  frame=0;if(disposed||root.ownerDocument!==doc)return;
  const next=doc.querySelector<HTMLElement>('.status-bar');
  if(next!==bar){if(bar)sizes?.unobserve(bar);barAttributes?.disconnect();bar=next;if(bar){sizes?.observe(bar);barAttributes?.observe(bar,{attributes:true,attributeFilter:['class','style','hidden']});}}
  const rootBox=root.getBoundingClientRect(),style=bar?win.getComputedStyle(bar):undefined,visible=bar&&bar.getClientRects().length&&style?.display!=='none'&&style?.visibility!=='hidden',lift=parseFloat(recent.style.getPropertyValue(property))||0;
  const controls=recent.hidden||!recent.getClientRects().length?[]:Array.from(recent.querySelectorAll<HTMLButtonElement>('button')).flatMap(control=>{
   const style=win.getComputedStyle(control);if(!control.getClientRects().length||style.display==='none'||style.visibility==='hidden')return[];
   const box=control.getBoundingClientRect(),clip=control.parentElement?.classList.contains('ts-local-relations-recent-list')?control.parentElement.getBoundingClientRect():rootBox;
   // Measure original flow coordinates so the previous translation cannot make
   // successive resize/scroll observations alternate between zero and lifted.
   return[{left:Math.max(box.left,clip.left,rootBox.left),right:Math.min(box.right,clip.right,rootBox.right),top:box.top+lift,bottom:box.bottom+lift}];
  });
  const barBox=visible?bar?.getBoundingClientRect():undefined,inset=localRelationsBottomInset(rootBox,controls,barBox),value=`${inset}px`;
  if(recent.style.getPropertyValue(property)!==value)recent.style.setProperty(property,value);
  // Popovers can fill the pane while recent history is hidden. Their actual
  // horizontal span, rather than the history controls, owns this height bound.
  const popoverInset=popovers.reduce((inset,panel)=>{
   const style=win.getComputedStyle(panel);return panel.hidden||!panel.getClientRects().length||style.display==='none'||style.visibility==='hidden'?inset:Math.max(inset,boardHostBottomInset(rootBox,panel.getBoundingClientRect(),barBox));
  },0),popoverValue=`${popoverInset}px`;
  if(root.style.getPropertyValue(popoverProperty)!==popoverValue)root.style.setProperty(popoverProperty,popoverValue);
 };
 const contents=win.MutationObserver?new win.MutationObserver(schedule):undefined,host=win.MutationObserver?new win.MutationObserver(schedule):undefined,popoverChanges=win.MutationObserver?new win.MutationObserver(schedule):undefined;
 contents?.observe(recent,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});
 host?.observe(doc.body,{childList:true,attributes:true,attributeFilter:['class','style']});
 for(const panel of popovers){sizes?.observe(panel);popoverChanges?.observe(panel,{attributes:true,attributeFilter:['class','style','hidden']});}
 sizes?.observe(root);sizes?.observe(recent);recent.addEventListener('scroll',schedule,true);win.addEventListener('resize',schedule);win.visualViewport?.addEventListener('resize',schedule);win.visualViewport?.addEventListener('scroll',schedule);refresh();
 return()=>{if(disposed)return;disposed=true;win.cancelAnimationFrame(frame);sizes?.disconnect();barAttributes?.disconnect();contents?.disconnect();host?.disconnect();popoverChanges?.disconnect();recent.removeEventListener('scroll',schedule,true);win.removeEventListener('resize',schedule);win.visualViewport?.removeEventListener('resize',schedule);win.visualViewport?.removeEventListener('scroll',schedule);if(previous)recent.style.setProperty(property,previous);else recent.style.removeProperty(property);if(previousPopover)root.style.setProperty(popoverProperty,previousPopover);else root.style.removeProperty(popoverProperty);};
}
