/** Keep the format toolbar's scroll affordances local to its Obsidian window. */
export function installToolbarOverflow(shell:HTMLElement,scroller:HTMLElement,previous:HTMLButtonElement,next:HTMLButtonElement):()=>void{
 const view=scroller.ownerDocument.defaultView;
 let disposed=false,frame:number|undefined;
 const setControl=(control:HTMLButtonElement,hidden:boolean)=>{
  if(control.hidden!==hidden)control.hidden=hidden;
  const ariaHidden=String(hidden);if(control.getAttribute('aria-hidden')!==ariaHidden)control.setAttribute('aria-hidden',ariaHidden);
 };
 const refresh=()=>{
  frame=undefined;if(disposed)return;
  const style=view?.getComputedStyle(shell),padding=(parseFloat(style?.paddingLeft||'0')||0)+(parseFloat(style?.paddingRight||'0')||0);
  // Measure the width available WITHOUT arrows, so revealing them cannot make
  // overflow persist after the content would fit into the full shell again.
  const available=Math.max(0,shell.clientWidth-padding);
  const overflowing=available>0&&scroller.clientWidth>0&&scroller.scrollWidth>available+1;
  shell.classList.toggle('ts-toolbar-overflowing',overflowing);
  setControl(previous,!overflowing);setControl(next,!overflowing);
  const maximum=overflowing?Math.max(0,scroller.scrollWidth-scroller.clientWidth):0,left=scroller.scrollLeft;
  const atStart=!overflowing||left<=1,atEnd=!overflowing||left>=maximum-1;
  if(previous.disabled!==atStart)previous.disabled=atStart;if(next.disabled!==atEnd)next.disabled=atEnd;
 };
 const schedule=()=>{if(!disposed&&view&&frame===undefined)frame=view.requestAnimationFrame(refresh);};
 const move=(direction:number)=>{
  if(disposed)return;
  const width=scroller.clientWidth,maximum=Math.max(0,scroller.scrollWidth-width);
  if(width<=0||maximum<=1)return;
  const current=Math.max(0,Math.min(maximum,scroller.scrollLeft)),left=Math.max(0,Math.min(maximum,current+direction*width*.75));
  if(left===current)return;
  scroller.scrollTo({left,behavior:view?.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});schedule();
 };
 const backward=()=>move(-1),forward=()=>move(1);
 const resize=view?.ResizeObserver?new view.ResizeObserver(schedule):undefined;
 const mutations=view?.MutationObserver?new view.MutationObserver(schedule):undefined;
 resize?.observe(shell);resize?.observe(scroller);
 mutations?.observe(scroller,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});
 scroller.addEventListener('scroll',schedule,{passive:true});view?.addEventListener('resize',schedule);
 previous.addEventListener('click',backward);next.addEventListener('click',forward);refresh();
 return()=>{
  if(disposed)return;disposed=true;
  if(frame!==undefined)view?.cancelAnimationFrame(frame);frame=undefined;
  resize?.disconnect();mutations?.disconnect();scroller.removeEventListener('scroll',schedule);view?.removeEventListener('resize',schedule);
  previous.removeEventListener('click',backward);next.removeEventListener('click',forward);
 };
}
