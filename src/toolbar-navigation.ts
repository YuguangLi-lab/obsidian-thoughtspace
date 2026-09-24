import {revealToolbarControl} from './toolbar-scroll';

const navigationRows=new WeakSet<HTMLElement>();

/** Arrow navigation is confined to buttons; selects and application shortcuts keep native behavior. */
export function toolbarNavigation(row:HTMLElement){
 navigationRows.add(row);
 const move=(event:KeyboardEvent)=>{
  if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const target=event.target as HTMLElement;if(target.tagName!=='BUTTON')return;
  // A nested Markdown group shares the enclosing command bar's navigation,
  // including sibling controls such as the appearance toggle.
  for(let parent=row.parentElement;parent;parent=parent.parentElement)if(navigationRows.has(parent))return;
  const buttons=Array.from(row.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(b=>b.getClientRects().length>0),at=buttons.indexOf(target as HTMLButtonElement);
  if(at<0||!buttons.length)return;
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(at+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;
  event.preventDefault();event.stopPropagation();if(next!==at)buttons[next].focus({preventScroll:true});revealToolbarControl(buttons[next],row);
 };
 row.addEventListener('keydown',move);
 return()=>{navigationRows.delete(row);row.removeEventListener('keydown',move);};
}
