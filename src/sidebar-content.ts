import type {Card} from './model';

/** Build once per library refresh. Duplicate references preserve the first
 * canvas location, matching the existing click-to-locate behavior. */
export function firstNoteReferences(nodes:readonly Card[]){
 const references=new Map<string,Card>();
 for(const node of nodes)if(node.kind==='card'&&node.file&&!references.has(node.file))references.set(node.file,node);
 return references;
}

/** Publish a complete sidebar without losing same-context scroll or an identifiable control. */
export function replaceSidebarContents(host:HTMLElement,draft:HTMLElement,preserve:boolean){
 const top=preserve?host.scrollTop:0,active=host.ownerDocument.activeElement;
 const focused=preserve&&active instanceof (host.ownerDocument.defaultView?.HTMLElement??HTMLElement)&&host.contains(active)?active:undefined;
 const label=focused?.getAttribute('aria-label'),row=focused?.closest<HTMLElement>('[data-board-path],[data-outline-id],[data-note-path]');
 const rowPath=row?.dataset.boardPath,rowId=row?.dataset.outlineId,notePath=row?.dataset.notePath;
 host.replaceChildren(...Array.from(draft.childNodes));
 if(label){const candidates=Array.from(host.querySelectorAll<HTMLElement>('[aria-label]')).filter(el=>el.getAttribute('aria-label')===label&&(!rowPath||el.closest<HTMLElement>('[data-board-path]')?.dataset.boardPath===rowPath)&&(!rowId||el.closest<HTMLElement>('[data-outline-id]')?.dataset.outlineId===rowId)&&(!notePath||el.closest<HTMLElement>('[data-note-path]')?.dataset.notePath===notePath));if(candidates.length===1)candidates[0].focus({preventScroll:true});}
 host.scrollTop=top;
}
