/** Search-to-results navigation stays inside the sidebar. Native Enter/click
 * handlers retain ownership of opening a board, locating an object or adding a note. */
export function sidebarSearchNavigation(search:HTMLInputElement,list:HTMLElement,ready:()=>boolean){
 const selector='.ts-tree-title,.ts-outline-title,.ts-library-card';
 const entries=()=>Array.from(list.querySelectorAll<HTMLElement>(selector)).filter(el=>el.getClientRects().length>0&&!el.matches(':disabled,[aria-disabled="true"]'));
 const plain=(e:KeyboardEvent)=>!e.isComposing&&e.keyCode!==229&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey;
 const focus=(el:HTMLElement,e:KeyboardEvent)=>{e.preventDefault();e.stopPropagation();el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest'});};
 const fromSearch=(e:KeyboardEvent)=>{
  if(!plain(e)||!ready()||!['ArrowDown','ArrowUp'].includes(e.key))return;
  const items=entries(),next=e.key==='ArrowDown'?items[0]:items.at(-1);if(next)focus(next,e);
 };
 const fromList=(e:KeyboardEvent)=>{
  if(!plain(e)||!ready()||!['ArrowDown','ArrowUp','Escape'].includes(e.key))return;
  const target=e.target as HTMLElement;
  // Do not steal keys from selects, checkboxes or auxiliary row buttons.
  if(!target.matches(selector))return;
  const items=entries(),at=items.indexOf(target);if(at<0)return;
  if(e.key==='Escape'||e.key==='ArrowUp'&&at===0){e.preventDefault();e.stopPropagation();search.focus({preventScroll:true});return;}
  const next=items[Math.max(0,Math.min(items.length-1,at+(e.key==='ArrowDown'?1:-1)))];if(next)focus(next,e);
 };
 search.addEventListener('keydown',fromSearch);list.addEventListener('keydown',fromList);
 return()=>{search.removeEventListener('keydown',fromSearch);list.removeEventListener('keydown',fromList);};
}
