/** Use this pane's actual height, including native pop-outs and split panes.
 * Only chrome responds; the native editor and its selection are not rebuilt. */
export function syncWritingPaneHeight(root:HTMLElement){
 const height=root.getBoundingClientRect().height,short=Number.isFinite(height)&&height>0&&height<=450;
 const value=String(short);if(root.dataset.writingShort!==value)root.dataset.writingShort=value;
 return short;
}

/** Transfer only responsive mode controls or the duplicate rebuilding action
 * to their visible entry. Editor focus, selection and composition stay untouched. */
export function bindWritingModeFocus(root:HTMLElement,trigger:HTMLButtonElement,current:()=>HTMLButtonElement|null){
 const doc=root.ownerDocument,win=doc.defaultView;if(!win)return()=>{};
 let frame=0,disposed=false,lastMode:HTMLElement|null=null;const previousShort=root.getAttribute('data-writing-short');
 const isMode=(el:Element|null):el is HTMLElement=>!!el&&(el===trigger||el.matches('.ts-writing-switch [data-article-mode]'))&&root.contains(el);
 const isAssembly=(el:Element|null):el is HTMLElement=>!!el&&el.matches('.ts-writing-assembly>.ts-writing-button')&&root.contains(el);
 const tracked=(el:Element|null):el is HTMLElement=>isMode(el)||isAssembly(el);
 const remember=()=>{lastMode=root.ownerDocument===doc&&tracked(doc.activeElement)?doc.activeElement:null;};
 const pointer=()=>{lastMode=null;};
 const refresh=()=>{
  frame=0;if(disposed)return;syncWritingPaneHeight(root);
  // A native move keeps this view but adopts its nodes into another document.
  // Old-document body focus is not evidence that the popup lost a control.
  const currentDoc=root.ownerDocument;if(currentDoc!==doc)lastMode=null;
  const active=currentDoc.activeElement,previous=tracked(active)?active:currentDoc===doc&&active===doc.body?lastMode:null;
  if(!previous||!previous.isConnected||previous.getClientRects().length)return;
  const next=isAssembly(previous)?root.querySelector<HTMLButtonElement>('.ts-writing-options'):trigger.getClientRects().length?trigger:current();
  if(next?.isConnected&&next.getClientRects().length){next.focus();lastMode=next;}
 };
 const schedule=()=>{if(!disposed&&!frame)frame=win.requestAnimationFrame(refresh);};
 const observer=win.ResizeObserver?new win.ResizeObserver(schedule):undefined,attributes=win.MutationObserver?new win.MutationObserver(schedule):undefined;
 observer?.observe(root);attributes?.observe(root,{attributes:true,attributeFilter:['data-ts-keyboard','data-writing-mode','data-writing-short']});
 win.addEventListener('resize',schedule);win.visualViewport?.addEventListener('resize',schedule);doc.addEventListener('focusin',remember);doc.addEventListener('pointerdown',pointer,true);syncWritingPaneHeight(root);remember();
 return()=>{if(disposed)return;disposed=true;win.cancelAnimationFrame(frame);observer?.disconnect();attributes?.disconnect();win.removeEventListener('resize',schedule);win.visualViewport?.removeEventListener('resize',schedule);doc.removeEventListener('focusin',remember);doc.removeEventListener('pointerdown',pointer,true);if(previousShort===null)root.removeAttribute('data-writing-short');else root.setAttribute('data-writing-short',previousShort);};
}
