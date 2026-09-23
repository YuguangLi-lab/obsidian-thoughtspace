/** Arrow navigation is confined to buttons; selects and application shortcuts keep native behavior. */
export function toolbarNavigation(row:HTMLElement){
 const move=(event:KeyboardEvent)=>{
  if(event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const target=event.target as HTMLElement;if(target.tagName!=='BUTTON')return;
  const buttons=Array.from(row.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(b=>b.getClientRects().length>0),at=buttons.indexOf(target as HTMLButtonElement);
  if(at<0||!buttons.length)return;
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(at+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;
  event.preventDefault();event.stopPropagation();buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView({block:'nearest',inline:'nearest'});
 };
 row.addEventListener('keydown',move);
 return()=>row.removeEventListener('keydown',move);
}
