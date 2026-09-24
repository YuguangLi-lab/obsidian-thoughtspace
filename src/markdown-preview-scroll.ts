const blocks='.ts-text-markdown table,.ts-text-markdown pre,.ts-text-markdown .math-block';
const scrollable=(overflow:string)=>overflow==='auto'||overflow==='scroll'||overflow==='overlay';
const extent=(full:number,visible:number)=>Number.isFinite(full)&&Number.isFinite(visible)&&visible>0&&full>visible?full-visible:0;
const finite=(value:number)=>Number.isFinite(value)?value:0;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function pixels(value:number,mode:number,page:number):number{
 const delta=finite(value),unit=mode===1?16:mode===2&&Number.isFinite(page)&&page>0?Math.min(page,100000):mode===2?100:1;
 // Bound before multiplication so malformed/extreme wheel input cannot poison scroll state.
 return Math.sign(delta)*Math.min(Math.abs(delta),100000/unit)*unit;
}
/** Scroll overflow inside Markdown without moving the board, including at a block's edge. */
export function consumeMarkdownPreviewWheel(event:WheelEvent):boolean{
 if(event.ctrlKey||event.metaKey||event.defaultPrevented)return false;
 const target=event.target as Node|null,start=target?.nodeType===1?target as Element:target?.parentElement;
 let block=start?.closest<HTMLElement>(blocks);
 const rawX=finite(event.deltaX)||(event.shiftKey?finite(event.deltaY):0),rawY=event.shiftKey?0:finite(event.deltaY);
 if(!rawX&&!rawY)return false;
 while(block){
  const style=block.ownerDocument.defaultView?.getComputedStyle(block);
  if(style){
   const maxX=scrollable(style.overflowX)?extent(block.scrollWidth,block.clientWidth):0,maxY=scrollable(style.overflowY)?extent(block.scrollHeight,block.clientHeight):0;
   const dx=maxX&&rawX?pixels(rawX,event.deltaMode,block.clientWidth):0,dy=maxY&&rawY?pixels(rawY,event.deltaMode,block.clientHeight):0;
   if(dx||dy){
    if(dx){const rtl=style.direction==='rtl';block.scrollLeft=clamp(finite(block.scrollLeft)+dx,rtl?-maxX:0,rtl?0:maxX);}
    if(dy)block.scrollTop=clamp(finite(block.scrollTop)+dy,0,maxY);
    event.preventDefault();event.stopPropagation();return true;
   }
  }
  block=block.parentElement?.closest<HTMLElement>(blocks);
 }
 return false;
}
