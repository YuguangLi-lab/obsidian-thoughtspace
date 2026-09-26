export interface ToolPaletteEntry{
 panel:HTMLElement;
 trigger:HTMLElement;
 actions:HTMLElement;
 onOpen?:()=>void;
}
export interface ToolPaletteBinding{
 open(panel:HTMLElement):void;
 toggle(panel:HTMLElement):void;
 close(restoreFocus?:boolean):void;
 dispose():void;
}

let paletteId=0;
const visibleButtons=(area:HTMLElement)=>Array.from(area.querySelectorAll<HTMLButtonElement>('button')).filter(button=>!button.disabled&&button.getAttribute('aria-disabled')!=='true'&&!button.hidden&&button.getClientRects().length>0);

/** Prefer the adjoining row/column; DOM order also works for unmeasurable or irregular groups. */
function adjacent(buttons:HTMLButtonElement[],index:number,key:string){
 if(key==='Home')return buttons[0];if(key==='End')return buttons[buttons.length-1];
 const horizontal=key==='ArrowLeft'||key==='ArrowRight',forward=key==='ArrowRight'||key==='ArrowDown';
 const current=buttons[index].getBoundingClientRect();
 if(current.width>0&&current.height>0){
  const center={x:current.left+current.width/2,y:current.top+current.height/2};
  const candidates=buttons.filter((_,at)=>at!==index).map(button=>{
   const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2-center.x,y=rect.top+rect.height/2-center.y;
   const distance=(horizontal?x:y)*(forward?1:-1),cross=Math.abs(horizontal?y:x);
   return{button,distance,cross,aligned:cross<(horizontal?current.height+rect.height:current.width+rect.width)/2,valid:rect.width>0&&rect.height>0};
  }).filter(item=>item.valid&&item.distance>1);
  candidates.sort((a,b)=>Number(b.aligned)-Number(a.aligned)||a.distance-b.distance||a.cross-b.cross);
  if(candidates.length)return candidates[0].button;
 }
 return buttons[(index+(forward?1:-1)+buttons.length)%buttons.length];
}

/** Keep keyboard movement inside its local scroller, without scrolling the canvas or note. */
function reveal(control:HTMLElement,area:HTMLElement){
 if(area.scrollHeight<=area.clientHeight+1&&area.scrollWidth<=area.clientWidth+1)return;
 const viewport=area.getBoundingClientRect(),target=control.getBoundingClientRect();
 if(area.clientHeight>0&&area.scrollHeight>area.clientHeight+1){
  const scale=area.offsetHeight>0?viewport.height/area.offsetHeight:1;
  if(scale>0){const top=viewport.top+area.clientTop*scale,bottom=top+area.clientHeight*scale;area.scrollTop+=(target.top<top?target.top-top:target.bottom>bottom?target.bottom-bottom:0)/scale;}
 }
 if(area.clientWidth>0&&area.scrollWidth>area.clientWidth+1){
  const scale=area.offsetWidth>0?viewport.width/area.offsetWidth:1;
  if(scale>0){const left=viewport.left+area.clientLeft*scale,right=left+area.clientWidth*scale;area.scrollLeft+=(target.left<left?target.left-left:target.right>right?target.right-right:0)/scale;}
 }
}

/** Section shortcuts reuse the actual command, never scroll a parent canvas. */
export function focusToolSection(area:HTMLElement,section:HTMLElement){
 if(!area.contains(section)||section.hidden)return false;
 const first=visibleButtons(section)[0];if(!first)return false;
 first.focus({preventScroll:true});
 const viewport=area.getBoundingClientRect(),target=section.getBoundingClientRect();
 const scale=area.offsetHeight>0?viewport.height/area.offsetHeight:1;
 if(scale>0&&area.clientHeight>0)area.scrollTop+=(target.top-viewport.top)/scale-area.clientTop-8;
 reveal(first,area);return true;
}

/** Mutually exclusive rail palettes, with local keyboard ownership and disposable outside listeners. */
export function installToolPalettes(main:HTMLElement,rail:HTMLElement,entries:ToolPaletteEntry[]):ToolPaletteBinding{
 const doc=main.ownerDocument,view=doc.defaultView,cleanup:(()=>void)[]=[];
 let active:ToolPaletteEntry|undefined,disposed=false,focusTimer:number|undefined;
 const cancelFocus=()=>{if(focusTimer!==undefined){view?.clearTimeout(focusTimer);focusTimer=undefined;}};
 const owns=(entry:ToolPaletteEntry,target:Node|null)=>!!target&&(entry.panel.contains(target)||entry.trigger.contains(target));
 const close=(restoreFocus=false)=>{
  cancelFocus();const previous=active;active=undefined;if(!previous)return;
  previous.panel.hidden=true;previous.trigger.setAttribute('aria-expanded','false');
  if(restoreFocus&&!disposed)previous.trigger.focus({preventScroll:true});
 };
 const open=(panel:HTMLElement)=>{
  if(disposed)return;const entry=entries.find(item=>item.panel===panel);if(!entry||active===entry)return;
  close();active=entry;entry.panel.hidden=false;entry.trigger.setAttribute('aria-expanded','true');
  if(entry.onOpen)entry.onOpen();else{
   entry.actions.scrollTop=0;const first=visibleButtons(entry.actions)[0];
   if(first){first.focus({preventScroll:true});reveal(first,entry.actions);}
  }
 };
 const toggle=(panel:HTMLElement)=>{if(disposed)return;if(active?.panel===panel)close();else open(panel);};
 const checkFocus=()=>{focusTimer=undefined;if(!disposed&&active&&!owns(active,doc.activeElement))close();};
 const focusout=()=>{if(disposed||!active)return;cancelFocus();if(view)focusTimer=view.setTimeout(checkFocus,0);else checkFocus();};
 const outside=(event:PointerEvent)=>{if(active&&!owns(active,event.target as Node|null))close();};
 const keys=(event:KeyboardEvent,area:HTMLElement,entry?:ToolPaletteEntry)=>{
  // These controls own their keys; board delete, typing and navigation must not run underneath.
  event.stopPropagation();
  if(disposed||event.defaultPrevented||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(event.key==='Escape'){if(active){event.preventDefault();close(true);}return;}
  if(entry&&active!==entry)return;
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  const target=event.target as HTMLElement|null;if(target?.tagName!=='BUTTON'||target.isContentEditable)return;
  const buttons=visibleButtons(area),index=buttons.indexOf(target as HTMLButtonElement);if(index<0)return;
  const next=adjacent(buttons,index,event.key);event.preventDefault();next.focus({preventScroll:true});reveal(next,area);
 };
 const railKeys=(event:KeyboardEvent)=>keys(event,rail);
 rail.addEventListener('keydown',railKeys);rail.addEventListener('focusout',focusout);
 cleanup.push(()=>{rail.removeEventListener('keydown',railKeys);rail.removeEventListener('focusout',focusout);});
 for(const entry of entries){
  let id=entry.panel.getAttribute('id');if(!id){do{id=`ts-tool-palette-${++paletteId}`;}while(doc.getElementById(id));entry.panel.setAttribute('id',id);}
  entry.panel.hidden=true;entry.trigger.setAttribute('aria-expanded','false');entry.trigger.setAttribute('aria-haspopup','dialog');entry.trigger.setAttribute('aria-controls',id);
  const trigger=()=>toggle(entry.panel),keydown=(event:KeyboardEvent)=>keys(event,entry.actions,entry);
  const activate=(event:MouseEvent)=>{
   const button=(event.target as Element|null)?.closest<HTMLButtonElement>('button');
   if(active===entry&&button&&entry.actions.contains(button)&&!button.disabled&&button.getAttribute('aria-disabled')!=='true')close();
  };
  entry.trigger.addEventListener('click',trigger);entry.panel.addEventListener('keydown',keydown);entry.panel.addEventListener('focusout',focusout);entry.panel.addEventListener('click',activate);
  cleanup.push(()=>{entry.trigger.removeEventListener('click',trigger);entry.panel.removeEventListener('keydown',keydown);entry.panel.removeEventListener('focusout',focusout);entry.panel.removeEventListener('click',activate);});
 }
 doc.addEventListener('pointerdown',outside,true);cleanup.push(()=>doc.removeEventListener('pointerdown',outside,true));
 return{open,toggle,close,dispose:()=>{if(disposed)return;disposed=true;close();for(const remove of cleanup)remove();}};
}
