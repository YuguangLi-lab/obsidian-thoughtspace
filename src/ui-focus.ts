/** Restore a rebuilt task filter only while focus is still vacant. */
export function preserveTaskFilterFocus(root:HTMLElement){
 const doc=root.ownerDocument,active=doc.activeElement as HTMLInputElement|HTMLSelectElement|null;
 if(!active||!root.contains(active)||!active.matches('.ts-task-tools input,.ts-task-tools select,.ts-task-group-select'))return ()=>{};
 const label=active.getAttribute('aria-label'),tag=active.tagName;
 const start=tag==='INPUT'?(active as HTMLInputElement).selectionStart:null,end=tag==='INPUT'?(active as HTMLInputElement).selectionEnd:null;
 const direction=tag==='INPUT'?(active as HTMLInputElement).selectionDirection:null;
 return ()=>{
  if(!label||active.isConnected||doc.activeElement!==doc.body)return;
  const next=Array.from(root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input[aria-label],select[aria-label]')).find(el=>el.tagName===tag&&el.getAttribute('aria-label')===label);
  if(!next||next.disabled||next.closest('details:not([open])')||!next.getClientRects().length)return;
  next.focus({preventScroll:true});if(tag==='INPUT'&&start!==null&&end!==null)(next as HTMLInputElement).setSelectionRange(start,end,direction||undefined);
 };
}
