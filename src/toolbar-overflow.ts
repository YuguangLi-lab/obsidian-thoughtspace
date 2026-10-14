import {revealToolbarControl} from './toolbar-scroll';

/** Keep the format toolbar's scroll affordances local to its Obsidian window. */
export function installToolbarOverflow(shell:HTMLElement,scroller:HTMLElement,previous:HTMLButtonElement,next:HTMLButtonElement):()=>void{
 const view=scroller.ownerDocument.defaultView;
 let disposed=false,frame:number|undefined,lastWidth:number|undefined,pointerFocus:HTMLButtonElement|undefined;
 // Chromium starts RTL scrollers at zero and uses negative offsets toward later tools.
 const scrollDirection=()=>view?.getComputedStyle(scroller).direction==='rtl'?-1:1;
 const setControl=(control:HTMLButtonElement,hidden:boolean)=>{
  if(control.hidden!==hidden)control.hidden=hidden;
  const ariaHidden=String(hidden);if(control.getAttribute('aria-hidden')!==ariaHidden)control.setAttribute('aria-hidden',ariaHidden);
 };
 const refresh=()=>{
  frame=undefined;if(disposed)return;
  const doc=scroller.ownerDocument,active=doc.activeElement,arrow=active===previous?previous:active===next?next:undefined;
  // Disabling a keyboard-focused native button blurs it to BODY. Capture its
  // local intent before hidden/disabled writes; pointer activation keeps the
  // editor's existing focus contract, even if Chrome retained focus-visible.
  const focusedArrow=arrow&&arrow!==pointerFocus&&arrow.matches(':focus-visible')?arrow:undefined;
  const style=view?.getComputedStyle(shell),padding=(parseFloat(style?.paddingLeft||'0')||0)+(parseFloat(style?.paddingRight||'0')||0);
  // Measure the width available WITHOUT arrows, so revealing them cannot make
  // overflow persist after the content would fit into the full shell again.
  const available=Math.max(0,shell.clientWidth-padding);
  const overflowing=available>0&&scroller.clientWidth>0&&scroller.scrollWidth>available+1;
  shell.classList.toggle('ts-toolbar-overflowing',overflowing);
  setControl(previous,!overflowing);setControl(next,!overflowing);
  const width=scroller.clientWidth;
  if(width!==lastWidth){
   lastWidth=width;
   // Keep the focused property visible when an Obsidian split gets narrower.
   // Do this only on width changes, never undo a user's deliberate scrolling.
   const active=scroller.ownerDocument.activeElement;
   if(width>0&&active&&scroller.contains(active))revealToolbarControl(active as HTMLElement,scroller);
  }
  const maximum=overflowing?Math.max(0,scroller.scrollWidth-scroller.clientWidth):0,left=scroller.scrollLeft*scrollDirection();
  const atStart=!overflowing||left<=1,atEnd=!overflowing||left>=maximum-1;
  if(previous.disabled!==atStart)previous.disabled=atStart;if(next.disabled!==atEnd)next.disabled=atEnd;
  if(focusedArrow&&(focusedArrow.hidden||focusedArrow.disabled)&&shell.isConnected&&scroller.isConnected&&shell.contains(scroller)&&(doc.activeElement===focusedArrow||doc.activeElement===doc.body)){
   const controls=Array.from(scroller.querySelectorAll<HTMLElement>('button,input:not([type="hidden"]),select,[tabindex]:not([tabindex="-1"])')).filter(el=>el.isConnected&&!el.matches(':disabled,[hidden],[aria-disabled="true"]')&&!el.closest('[hidden],[inert]')&&el.getClientRects().length>0);
   const target=focusedArrow===previous?controls[0]:controls.at(-1);
   target?.focus({preventScroll:true});if(target&&doc.activeElement===target)revealToolbarControl(target,scroller);
  }
 };
 const schedule=()=>{if(!disposed&&view&&frame===undefined)frame=view.requestAnimationFrame(refresh);};
 const move=(direction:number)=>{
  if(disposed)return;
  const width=scroller.clientWidth,maximum=Math.max(0,scroller.scrollWidth-width);
  if(width<=0||maximum<=1)return;
  const sign=scrollDirection(),current=Math.max(0,Math.min(maximum,scroller.scrollLeft*sign)),target=Math.max(0,Math.min(maximum,current+direction*width*.75));
  if(target===current)return;
  const left=target===0?0:target*sign;
  scroller.scrollTo({left,behavior:view?.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});schedule();
 };
 const backward=(event?:MouseEvent)=>{pointerFocus=event?.detail?previous:undefined;move(-1);},forward=(event?:MouseEvent)=>{pointerFocus=event?.detail?next:undefined;move(1);};
 const keyboardFocus=()=>{pointerFocus=undefined;};
 const resize=view?.ResizeObserver?new view.ResizeObserver(schedule):undefined;
 const mutations=view?.MutationObserver?new view.MutationObserver(schedule):undefined;
 resize?.observe(shell);resize?.observe(scroller);
 mutations?.observe(scroller,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});
 scroller.addEventListener('scroll',schedule,{passive:true});view?.addEventListener('resize',schedule);
 previous.addEventListener('keydown',keyboardFocus);next.addEventListener('keydown',keyboardFocus);
 previous.addEventListener('focusin',keyboardFocus);next.addEventListener('focusin',keyboardFocus);
 previous.addEventListener('click',backward);next.addEventListener('click',forward);refresh();
 return()=>{
  if(disposed)return;disposed=true;
  if(frame!==undefined)view?.cancelAnimationFrame(frame);frame=undefined;
  resize?.disconnect();mutations?.disconnect();scroller.removeEventListener('scroll',schedule);view?.removeEventListener('resize',schedule);
  previous.removeEventListener('click',backward);next.removeEventListener('click',forward);
  previous.removeEventListener('keydown',keyboardFocus);next.removeEventListener('keydown',keyboardFocus);
  previous.removeEventListener('focusin',keyboardFocus);next.removeEventListener('focusin',keyboardFocus);
 };
}
