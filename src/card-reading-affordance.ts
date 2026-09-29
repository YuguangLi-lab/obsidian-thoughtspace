const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Mount in the card host, outside the preview, with a bottom inset above metadata. */
export function mountCardReadingAffordance(preview:HTMLElement,host:HTMLElement):()=>void {
  const view=preview.ownerDocument.defaultView;
  if(!view)return()=>{};
  // Native owner-document creation keeps this helper independent of Obsidian DOM extensions.
  const button=preview.ownerDocument.createElement('button');
  button.className='ts-card-reading-affordance';button.type='button';button.textContent='↓ 继续阅读';
  button.hidden=true;button.disabled=true;button.setAttribute('aria-label','继续阅读');button.setAttribute('aria-hidden','true');
  if(preview.id)button.setAttribute('aria-controls',preview.id);
  host.append(button);
  let disposed=false,frame:number|undefined,content:Element|null=null,resize:ResizeObserver|undefined;
  const alive=()=>!disposed&&preview.isConnected&&host.isConnected&&button.isConnected;
  const contentRoot=()=>preview.querySelector(':scope > .ts-card-preview-content');
  const state=()=>{
    // Error paths also clear aria-busy. Only the renderer's completed content
    // root can advertise reading; placeholders must never look like long notes.
    if(preview.getAttribute('aria-busy')!=='false'||!contentRoot())return;
    const overflow=view.getComputedStyle(preview).overflowY;
    if(overflow!=='auto'&&overflow!=='scroll'&&overflow!=='overlay')return;
    const height=preview.clientHeight,full=preview.scrollHeight;
    if(!Number.isFinite(height)||!Number.isFinite(full)||height<=0||full-height<=1)return;
    const maximum=full-height,raw=preview.scrollTop,position=clamp(Number.isFinite(raw)?raw:0,0,maximum);
    return{height,remaining:maximum-position,progress:position/maximum};
  };
  const refresh=()=>{
    frame=undefined;if(!alive())return;
    const next=contentRoot();
    if(next!==content){if(content)resize?.unobserve(content);content=next;if(content)resize?.observe(content);}
    const reading=state(),hidden=!reading||reading.remaining<=1;
    if(reading){
      const hostHeight=host.offsetHeight,previewBottom=preview.offsetTop+preview.offsetHeight;
      if(Number.isFinite(hostHeight)&&hostHeight>0&&Number.isFinite(previewBottom)){
        const bottom=`${Math.max(8,hostHeight-previewBottom+8)}px`;
        if(button.style.bottom!==bottom)button.style.bottom=bottom;
      }
    }
    if(button.hidden!==hidden)button.hidden=hidden;
    if(button.disabled!==hidden)button.disabled=hidden;
    const ariaHidden=String(hidden);if(button.getAttribute('aria-hidden')!==ariaHidden)button.setAttribute('aria-hidden',ariaHidden);
    const progress=reading?(hidden?100:Math.min(99,Math.floor(reading.progress*100))):undefined;
    const label=progress===undefined?'继续阅读':`继续阅读，已读 ${progress}%`;
    if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
    if(button.title!==label)button.title=label;
  };
  const schedule=()=>{if(alive()&&frame===undefined)frame=view.requestAnimationFrame(refresh);};
  const read=()=>{
    if(!alive())return;
    const reading=state();if(!reading||reading.remaining<=1){schedule();return;}
    preview.scrollBy({top:Math.min(reading.height*.75,reading.remaining),behavior:view.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    schedule();
  };
  const stopGesture=(event:Event)=>event.stopPropagation();
  button.addEventListener('pointerdown',stopGesture);button.addEventListener('dblclick',stopGesture);button.addEventListener('click',read);
  resize=view.ResizeObserver?new view.ResizeObserver(schedule):undefined;
  const mutations=view.MutationObserver?new view.MutationObserver(schedule):undefined;
  resize?.observe(preview);resize?.observe(host);
  mutations?.observe(preview,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-busy','class','style']});
  preview.addEventListener('scroll',schedule,{passive:true});
  // Image load does not bubble. Observe it in capture as well as the rendered
  // content root's height, which can change while the preview frame stays fixed.
  preview.addEventListener('load',schedule,true);view.addEventListener('resize',schedule);schedule();
  return()=>{
    if(disposed)return;disposed=true;
    if(frame!==undefined)view.cancelAnimationFrame(frame);frame=undefined;
    resize?.disconnect();mutations?.disconnect();
    preview.removeEventListener('scroll',schedule);preview.removeEventListener('load',schedule,true);view.removeEventListener('resize',schedule);
    button.removeEventListener('pointerdown',stopGesture);button.removeEventListener('dblclick',stopGesture);button.removeEventListener('click',read);button.remove();
  };
}
