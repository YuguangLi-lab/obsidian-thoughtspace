import {createGlassLensMap} from './glass-lens-map';

export const liquidGlassSurfaceSelector='.ts-root .ts-main > .ts-rail-popover, .ts-root .ts-footer .ts-view-dock, .ts-handwriting .ts-handwriting-popover, .ts-ui-menu';
const excluded='.ts-calendar-plugin,.markdown-rendered,.markdown-preview-view,.markdown-source-view,.cm-editor,.pdf-container,.pdf-viewer';
const paneSelector='.ts-root,.ts-handwriting,.ts-writing,.ts-media-workspace,.ts-online-workspace,.ts-settings,.ts-materials-panel,.ts-materials-modal';
const svgNamespace='http://www.w3.org/2000/svg',htmlNamespace='http://www.w3.org/1999/xhtml';
const attributes=['data-ts-glass-optics','data-ts-glass-active','data-ts-glass-pressed'] as const;
const properties=['--ts-glass-filter','--ts-glass-x','--ts-glass-y','--ts-glass-radius'] as const;
const maxSurfaces=3,maxArea=240_000;
let filterSequence=0;
const surfaceOwners=new WeakMap<HTMLElement,{dispose:()=>void}>();

/** Conservative desktop Chromium eligibility, not proof of rendered output.
 * 132 is our supported host floor, not the first version with SVG backdrops.
 * Chrome documents URL/SVG support: https://web.dev/articles/backdrop-filter
 * CSS.supports remains a syntax guard; the content shield stays readable even
 * when a compatible engine or graphics configuration cannot render the lens. */
export function isGlassLensEngineCandidate(userAgent:string):boolean{
 const version=/\b(?:HeadlessChrome|Chrome|Chromium)\/(\d+)\./.exec(userAgent)?.[1];
 return Number(version)>=132&&!/Android|Mobile|iPhone|iPad/i.test(userAgent);
}

export interface LiquidGlassRuntime {refresh:(root?:Element)=>void;dispose:()=>void}
interface Geometry {width:number;height:number;left:number;top:number;radius:number;pane:HTMLElement}
interface Surface {
 element:HTMLElement;geometry:Geometry;filter:SVGFilterElement;image:SVGFEImageElement;displacement:SVGFEDisplacementMapElement;shield:HTMLElement;
 attributes:(string|null)[];properties:{value:string;priority:string}[];
 hover:boolean;focused:boolean;pressed:boolean;pointer?:{x:number;y:number};owner:{dispose:()=>void};
}

/** A bounded, event-driven enhancement for owned floating chrome. No page pixels
 * are captured: the only canvas writes encode a procedural displacement field. */
export function createLiquidGlassRuntime(doc:Document):LiquidGlassRuntime{
 const win=doc.defaultView;
 const idle:LiquidGlassRuntime={refresh:()=>{},dispose:()=>{}};
 if(!win||!isGlassLensEngineCandidate(win.navigator?.userAgent??'')||typeof win.matchMedia!=='function'||typeof win.ResizeObserver!=='function'||typeof win.requestAnimationFrame!=='function')return idle;
 const navigator=win.navigator as Navigator&{deviceMemory?:number};
 if((navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4)||(typeof navigator.deviceMemory==='number'&&navigator.deviceMemory<4))return idle;
 if(!win.CSS?.supports('backdrop-filter','url("#ts-glass-probe")'))return idle;
 const fine=win.matchMedia('(pointer:fine) and (hover:hover)');
 const reductions=['(any-pointer:coarse)','(prefers-reduced-motion:reduce)','(prefers-reduced-transparency:reduce)','(prefers-contrast:more)','(forced-colors:active)'].map(query=>win.matchMedia(query));
 const surfaces=new Map<HTMLElement,Surface>(),paneUses=new Map<HTMLElement,number>();
 let svg:SVGSVGElement|undefined,defs:SVGDefsElement|undefined,frame=0,layoutPending=false,stopped=false,renderingUnavailable=false;
 const allowed=()=>!stopped&&!renderingUnavailable&&!win.closed&&doc.visibilityState!=='hidden'&&win.innerWidth>760&&fine.matches&&!reductions.some(query=>query.matches);
 const observer=new win.ResizeObserver(()=>queue(true));
 const createSvg=<K extends keyof SVGElementTagNameMap>(tag:K)=>doc.createElementNS(svgNamespace,tag);
 function observePane(pane:HTMLElement){const count=paneUses.get(pane)??0;if(!count)observer.observe(pane);paneUses.set(pane,count+1);}
 function unobservePane(pane:HTMLElement){const count=paneUses.get(pane)??0;if(count<=1){observer.unobserve(pane);paneUses.delete(pane);}else paneUses.set(pane,count-1);}
 function geometry(element:HTMLElement):Geometry|undefined{
  if(!allowed()||element.ownerDocument!==doc||!element.isConnected||!element.matches(liquidGlassSurfaceSelector)||element.closest(excluded)||element.closest('[hidden]')||!element.getClientRects().length)return;
  const pane=element.closest<HTMLElement>(paneSelector)??doc.querySelector<HTMLElement>(`.workspace-leaf.mod-active :is(${paneSelector})`)??doc.querySelector<HTMLElement>(paneSelector);
  if(!pane||pane.ownerDocument!==doc||!pane.isConnected||pane.getBoundingClientRect().width<=680)return;
  const rect=element.getBoundingClientRect(),style=win!.getComputedStyle(element);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||rect.width<24||rect.height<24||rect.width*rect.height>maxArea)return;
  // The inset content shield belongs to this element's scrollable contents.
  // Keep scrollable surfaces opaque so scrolling cannot uncover their text.
  if(element.scrollWidth-element.clientWidth>1||element.scrollHeight-element.clientHeight>1)return;
  const width=Math.round(rect.width*100)/100,height=Math.round(rect.height*100)/100;
  const radius=parseFloat(style.borderTopLeftRadius);
  return{width,height,left:rect.left,top:rect.top,radius:Math.min(width/2,height/2,Math.max(0,Number.isFinite(radius)?radius:16)),pane};
 }
 function totalArea(except?:Surface){let total=0;for(const surface of surfaces.values())if(surface!==except)total+=surface.geometry.width*surface.geometry.height;return total;}
 function release(element:HTMLElement){
  const surface=surfaces.get(element);if(!surface)return;
  surfaces.delete(element);observer.unobserve(element);unobservePane(surface.geometry.pane);
  if(surfaceOwners.get(element)===surface.owner)surfaceOwners.delete(element);
  attributes.forEach((name,index)=>{const previous=surface.attributes[index];if(previous===null)element.removeAttribute(name);else element.setAttribute(name,previous);});
  properties.forEach((name,index)=>{const previous=surface.properties[index];if(previous.value)element.style.setProperty(name,previous.value,previous.priority);else element.style.removeProperty(name);});
  surface.shield.remove();surface.filter.remove();
  if(!surfaces.size){svg?.remove();svg=undefined;defs=undefined;}
 }
 function clear(){for(const element of [...surfaces.keys()])release(element);if(frame)win!.cancelAnimationFrame(frame);frame=0;layoutPending=false;}
 function ensureDefinitions(){
  if(defs)return defs;
  svg=createSvg('svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.setAttribute('data-ts-glass-definitions','true');
  svg.classList.add('ts-glass-filter-definitions');
  defs=createSvg('defs');svg.appendChild(defs);(doc.body??doc.documentElement).appendChild(svg);return defs;
 }
 function paintMap(surface:Surface,next:Geometry){
  const map=createGlassLensMap({width:next.width,height:next.height,radius:next.radius});
  const canvas=doc.createElementNS(htmlNamespace,'canvas') as HTMLCanvasElement;canvas.width=map.mapW;canvas.height=map.mapH;
  const context=canvas.getContext('2d');if(!context)throw Error('Procedural lens canvas unavailable');
  const pixels=context.createImageData(map.mapW,map.mapH);pixels.data.set(map.data);context.putImageData(pixels,0,0);
  surface.image.setAttribute('href',canvas.toDataURL('image/png'));
  // Percentages resolve against the zero-size definitions SVG in some engines.
  surface.image.setAttribute('width',String(next.width));surface.image.setAttribute('height',String(next.height));
  surface.displacement.setAttribute('scale',String(map.scale));surface.element.style.setProperty('--ts-glass-radius',`${next.radius}px`);
 }
 function state(surface:Surface){
  surface.element.setAttribute('data-ts-glass-active',String(surface.hover||surface.focused));surface.element.setAttribute('data-ts-glass-pressed',String(surface.pressed));
 }
 function add(element:HTMLElement,interactive=false):Surface|undefined{
  if(surfaces.has(element))return surfaces.get(element);
  const next=geometry(element);if(!next)return;
  // A menu may have moved to a pop-out since construction. Retire its old SVG
  // references before snapshotting attributes in the actual owning document.
  surfaceOwners.get(element)?.dispose();
  if(interactive)for(const surface of [...surfaces.values()]){
   if(surfaces.size<maxSurfaces&&totalArea()+next.width*next.height<=maxArea)break;
   if(!surface.hover&&!surface.focused)release(surface.element);
  }
  if(surfaces.size>=maxSurfaces||totalArea()+next.width*next.height>maxArea)return;
  const filter=createSvg('filter'),image=createSvg('feImage'),displacement=createSvg('feDisplacementMap'),id=`ts-glass-lens-${++filterSequence}`;
  filter.id=id;filter.setAttribute('x','0');filter.setAttribute('y','0');filter.setAttribute('width','100%');filter.setAttribute('height','100%');filter.setAttribute('filterUnits','objectBoundingBox');filter.setAttribute('primitiveUnits','userSpaceOnUse');filter.setAttribute('color-interpolation-filters','sRGB');
  image.setAttribute('x','0');image.setAttribute('y','0');image.setAttribute('preserveAspectRatio','none');image.setAttribute('result','lens');
  displacement.setAttribute('in','SourceGraphic');displacement.setAttribute('in2','lens');displacement.setAttribute('xChannelSelector','R');displacement.setAttribute('yChannelSelector','G');filter.append(image,displacement);
  const shield=doc.createElementNS(htmlNamespace,'span');shield.classList.add('ts-glass-content-shield');shield.setAttribute('aria-hidden','true');
  const owner={dispose:()=>release(element)};
  const surface:Surface={element,geometry:next,filter,image,displacement,shield,attributes:attributes.map(name=>element.getAttribute(name)),properties:properties.map(name=>({value:element.style.getPropertyValue(name),priority:element.style.getPropertyPriority(name)})),hover:false,focused:!!doc.activeElement&&element.contains(doc.activeElement),pressed:false,owner};
  surfaces.set(element,surface);surfaceOwners.set(element,owner);
  try{paintMap(surface,next);ensureDefinitions().appendChild(filter);element.appendChild(shield);element.style.setProperty('--ts-glass-filter',`url("#${id}")`);element.style.setProperty('--ts-glass-x',`${next.width/2}px`);element.style.setProperty('--ts-glass-y',`${next.height/2}px`);element.setAttribute('data-ts-glass-optics','true');state(surface);observer.observe(element);observePane(next.pane);}
  catch{renderingUnavailable=true;clear();return;}
  return surface;
 }
 function reconcile(){
  if(!allowed()){clear();return;}
  for(const surface of [...surfaces.values()]){
   const next=geometry(surface.element);
   if(!next||totalArea(surface)+next.width*next.height>maxArea){release(surface.element);continue;}
   if(next.pane!==surface.geometry.pane){unobservePane(surface.geometry.pane);observePane(next.pane);}
   if(next.width!==surface.geometry.width||next.height!==surface.geometry.height||next.radius!==surface.geometry.radius){try{paintMap(surface,next);}catch{renderingUnavailable=true;clear();return;}}
   surface.geometry=next;
  }
 }
 function flush(){
  frame=0;if(stopped)return;
  if(layoutPending){layoutPending=false;reconcile();}
  for(const surface of surfaces.values())if(surface.pointer){
   const {x,y}=surface.pointer;surface.pointer=undefined;
   surface.element.style.setProperty('--ts-glass-x',`${Math.max(0,Math.min(surface.geometry.width,x-surface.geometry.left))}px`);
   surface.element.style.setProperty('--ts-glass-y',`${Math.max(0,Math.min(surface.geometry.height,y-surface.geometry.top))}px`);
  }
 }
 function queue(layout=false){if(stopped)return;layoutPending||=layout;if(!frame)frame=win!.requestAnimationFrame(flush);}
 function target(event:Event){const element=event.target as Element|null;return typeof element?.closest==='function'?element.closest<HTMLElement>(liquidGlassSurfaceSelector):null;}
 function over(event:PointerEvent){
  if(event.pointerType==='touch'||!allowed())return;reconcile();const element=target(event);if(!element)return;
  const surface=add(element,true);if(!surface)return;surface.hover=true;surface.pointer={x:event.clientX,y:event.clientY};state(surface);queue();
 }
 function move(event:PointerEvent){const element=target(event),surface=element?surfaces.get(element):undefined;if(!surface||event.pointerType==='touch'||!allowed())return;surface.pointer={x:event.clientX,y:event.clientY};queue();}
 function out(event:PointerEvent){
  const element=target(event),surface=element?surfaces.get(element):undefined;if(!surface)return;
  if(event.relatedTarget&&surface.element.contains(event.relatedTarget as Node))return;
  surface.hover=false;surface.pressed=false;surface.pointer=undefined;surface.element.style.setProperty('--ts-glass-x',`${surface.geometry.width/2}px`);surface.element.style.setProperty('--ts-glass-y',`${surface.geometry.height/2}px`);state(surface);
 }
 function focus(event:FocusEvent){
  if(!allowed())return;reconcile();const element=target(event);if(event.type==='focusin'&&element)add(element,true);
  for(const surface of surfaces.values()){surface.focused=event.type==='focusin'?!!doc.activeElement&&surface.element.contains(doc.activeElement):!!event.relatedTarget&&surface.element.contains(event.relatedTarget as Node);state(surface);}
 }
 function press(event:PointerEvent){if(event.pointerType!=='mouse'||event.button!==0||!event.isPrimary||!allowed())return;const element=target(event),surface=element?add(element,true):undefined;if(surface){surface.pressed=true;state(surface);}}
 function resetPress(){for(const surface of surfaces.values()){surface.pressed=false;state(surface);}}
 function blur(){for(const surface of surfaces.values()){surface.hover=false;surface.focused=false;surface.pointer=undefined;}resetPress();}
 function refresh(root?:Element){
  if(stopped)return;reconcile();if(!allowed()||root?.ownerDocument&&root.ownerDocument!==doc)return;
  if(root?.matches(liquidGlassSurfaceSelector))add(root as HTMLElement);
  for(const element of Array.from((root??doc).querySelectorAll<HTMLElement>(liquidGlassSurfaceSelector))){if(surfaces.size>=maxSurfaces)break;add(element);}
 }
 const resize=()=>queue(true),conditions=()=>refresh();
 const pointerOptions={passive:true};
 doc.addEventListener('pointerover',over,pointerOptions);doc.addEventListener('pointermove',move,pointerOptions);doc.addEventListener('pointerout',out,pointerOptions);
 doc.addEventListener('pointerdown',press,pointerOptions);doc.addEventListener('pointerup',resetPress,pointerOptions);doc.addEventListener('pointercancel',resetPress,pointerOptions);
 doc.addEventListener('focusin',focus);doc.addEventListener('focusout',focus);doc.addEventListener('visibilitychange',conditions);doc.addEventListener('scroll',resize,{capture:true,passive:true});
 win.addEventListener('resize',resize);win.addEventListener('blur',blur);for(const query of [fine,...reductions])query.addEventListener('change',conditions);
 refresh();
 return{refresh,dispose(){if(stopped)return;stopped=true;clear();observer.disconnect();
  doc.removeEventListener('pointerover',over);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerout',out);doc.removeEventListener('pointerdown',press);doc.removeEventListener('pointerup',resetPress);doc.removeEventListener('pointercancel',resetPress);
  doc.removeEventListener('focusin',focus);doc.removeEventListener('focusout',focus);doc.removeEventListener('visibilitychange',conditions);doc.removeEventListener('scroll',resize,true);win.removeEventListener('resize',resize);win.removeEventListener('blur',blur);for(const query of [fine,...reductions])query.removeEventListener('change',conditions);
 }};
}
