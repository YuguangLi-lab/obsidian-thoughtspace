const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** A separate footer owns reading controls; the preview remains the native scrollport. */
export function mountCardReadingAffordance(preview:HTMLElement,host:HTMLElement):()=>void {
  const view=preview.ownerDocument.defaultView;
  if(!view)return()=>{};
  // Native owner-document creation keeps this helper independent of Obsidian DOM extensions.
  const button=preview.ownerDocument.createElement('button');
  button.className='ts-card-reading-affordance';button.type='button';button.textContent='↓ 继续阅读';
  button.hidden=true;button.disabled=true;button.setAttribute('aria-label','继续阅读');button.setAttribute('aria-hidden','true');
  if(preview.id)button.setAttribute('aria-controls',preview.id);
  const footer=preview.ownerDocument.createElement('div');footer.className='ts-card-reading-footer';footer.hidden=true;
  footer.append(button);preview.after(footer);
  let disposed=false,frame:number|undefined,content:Element|null=null,resize:ResizeObserver|undefined;
  const alive=()=>!disposed&&preview.isConnected&&host.isConnected&&footer.isConnected&&button.isConnected;
  const contentRoot=()=>preview.querySelector(':scope > .ts-card-preview-content');
  const state=()=>{
    // Error paths also clear aria-busy. Only the renderer's completed content
    // root can advertise reading; placeholders must never look like long notes.
    if(!host.classList.contains('is-fixed-reading')||host.classList.contains('is-inline-editing')||preview.getAttribute('aria-busy')!=='false'||!contentRoot())return;
    const overflow=view.getComputedStyle(preview).overflowY;
    if(overflow!=='auto'&&overflow!=='scroll'&&overflow!=='overlay')return;
    const height=preview.clientHeight,full=preview.scrollHeight;
    // Measure the original available body space, including our existing reservation.
    // A footer must never create the overflow that keeps itself mounted.
    const unreserved=height+(footer.hidden?0:footer.offsetHeight);
    const style=view.getComputedStyle(host),touch=host.dataset.touchControls==='true',parsed=Number.parseFloat(style.getPropertyValue('--ts-control-scale'));
    const scale=touch&&Number.isFinite(parsed)&&parsed>0?parsed:1,portParsed=Number.parseFloat(style.getPropertyValue('--ts-port-scale'));
    const portScale=Number.isFinite(portParsed)&&portParsed>0?portParsed:1;
    // Edge ports retain their full 30px target, including its inward half.
    // Match the CSS bottom/right gutter and keep the minimum body capacity below.
    const edgeInset=Math.max(8*scale,16*portScale);
    const rowHeight=Math.ceil((touch?52:34)*scale+edgeInset),minimumBody=(touch?44:28)*scale,minimumWidth=(touch?96:72)*scale+2*edgeInset;
    if(!Number.isFinite(height)||!Number.isFinite(full)||height<=0||full-unreserved<=1||unreserved<rowHeight+minimumBody||host.clientWidth<minimumWidth)return;
    const maximum=full-height,raw=preview.scrollTop,position=clamp(Number.isFinite(raw)?raw:0,0,maximum);
    return{height,remaining:maximum-position,progress:position/maximum,rowHeight};
  };
  const refresh=()=>{
    frame=undefined;if(!alive())return;
    const next=contentRoot();
    if(next!==content){if(content)resize?.unobserve(content);content=next;if(content)resize?.observe(content);}
    const reading=state(),hidden=!reading,complete=!!reading&&reading.remaining<=1;
    if(reading){const height=`${reading.rowHeight}px`;if(footer.style.height!==height)footer.style.height=height;}
    if(footer.hidden!==hidden)footer.hidden=hidden;
    if(button.hidden!==hidden)button.hidden=hidden;
    const disabled=hidden||complete;if(button.disabled!==disabled)button.disabled=disabled;
    const text=complete?'已读完':'↓ 继续阅读';if(button.textContent!==text)button.textContent=text;
    const ariaHidden=String(hidden);if(button.getAttribute('aria-hidden')!==ariaHidden)button.setAttribute('aria-hidden',ariaHidden);
    const progress=reading?(complete?100:Math.min(99,Math.floor(reading.progress*100))):undefined;
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
  mutations?.observe(host,{attributes:true,attributeFilter:['class','style','data-touch-controls']});
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
    button.removeEventListener('pointerdown',stopGesture);button.removeEventListener('dblclick',stopGesture);button.removeEventListener('click',read);footer.remove();
  };
}
