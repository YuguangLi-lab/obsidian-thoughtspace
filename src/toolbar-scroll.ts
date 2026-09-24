/** Mouse wheels reach clipped tools without capturing editor or native picker gestures. */
export function installToolbarWheel(scroller:HTMLElement):()=>void{
 const wheel=(event:WheelEvent)=>{
  if(event.defaultPrevented||!event.cancelable||event.ctrlKey||event.metaKey||event.altKey)return;
  const target=event.target as Element|null;
  if(target?.closest('select,input,textarea,[contenteditable="true"]'))return;
  const width=scroller.clientWidth,maximum=scroller.scrollWidth-width;if(width<=0||maximum<=1)return;
  const style=scroller.ownerDocument.defaultView?.getComputedStyle(scroller),rtl=style?.direction==='rtl';
  const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY);
  const delta=(horizontal?event.deltaX:event.deltaY*(rtl?-1:1))*(event.deltaMode===1?(parseFloat(style?.lineHeight||'')||16):event.deltaMode===2?width:1);
  const minimum=rtl?-maximum:0,limit=rtl?0:maximum,current=scroller.scrollLeft,left=Math.max(minimum,Math.min(limit,current+delta));
  if(!Number.isFinite(left)||Math.abs(left-current)<.01)return;
  event.preventDefault();event.stopPropagation();scroller.scrollLeft=left;
 };
 scroller.addEventListener('wheel',wheel,{passive:false});
 return()=>scroller.removeEventListener('wheel',wheel);
}

/** Reveal a keyboard target inside its toolbar; never scroll the surrounding note or canvas. */
export function revealToolbarControl(control:HTMLElement,row:HTMLElement){
 const boundary=row.closest<HTMLElement>('[role="toolbar"]')||row,view=row.ownerDocument.defaultView;
 for(let parent=control.parentElement;parent;parent=parent.parentElement){
  const width=parent.clientWidth;
  if(width>0&&parent.scrollWidth>width+1&&/^(auto|scroll|hidden)$/.test(view?.getComputedStyle(parent).overflowX||'')){
   const viewport=parent.getBoundingClientRect(),target=control.getBoundingClientRect(),scale=parent.offsetWidth>0?viewport.width/parent.offsetWidth:1;
   if(scale>0){
    const left=viewport.left+parent.clientLeft*scale,right=left+width*scale;
    const delta=target.left<left?target.left-left:target.right>right?target.right-right:0;
    if(delta)parent.scrollLeft+=delta/scale;
   }
   return;
  }
  if(parent===boundary)break;
 }
}
