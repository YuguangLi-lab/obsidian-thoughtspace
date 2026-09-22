/** Publish a complete sidebar without losing same-context scroll or an identifiable control. */
export function replaceSidebarContents(host:HTMLElement,draft:HTMLElement,preserve:boolean){
 const top=preserve?host.scrollTop:0,active=host.ownerDocument.activeElement;
 const focused=preserve&&active instanceof (host.ownerDocument.defaultView?.HTMLElement??HTMLElement)&&host.contains(active)?active:undefined;
 const label=focused?.getAttribute('aria-label'),row=focused?.closest<HTMLElement>('[data-board-path],[data-outline-id]');
 const rowPath=row?.dataset.boardPath,rowId=row?.dataset.outlineId;
 host.replaceChildren(...Array.from(draft.childNodes));
 if(label){const candidates=Array.from(host.querySelectorAll<HTMLElement>('[aria-label]')).filter(el=>el.getAttribute('aria-label')===label&&(!rowPath||el.closest<HTMLElement>('[data-board-path]')?.dataset.boardPath===rowPath)&&(!rowId||el.closest<HTMLElement>('[data-outline-id]')?.dataset.outlineId===rowId));if(candidates.length===1)candidates[0].focus({preventScroll:true});}
 host.scrollTop=top;
}
