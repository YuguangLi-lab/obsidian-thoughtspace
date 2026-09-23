import type {Board} from './model';import {connectionPath} from './connections';import {viewportRect,edgeBounds,intersects} from './rendering';
const NS='http://www.w3.org/2000/svg';let handleTitle=0;
function attr(el:Element,key:string,value:string|number|undefined){if(value===undefined){if(el.hasAttribute(key))el.removeAttribute(key);}else if(el.getAttribute(key)!==String(value))el.setAttribute(key,String(value));}
function svg<K extends keyof SVGElementTagNameMap>(parent:Element,tag:K,cls:string){const el=parent.ownerDocument.createElementNS(NS,tag);if(cls)el.setAttribute('class',cls);parent.appendChild(el);return el;}
type Row={group:SVGGElement;path:SVGPathElement;hit:SVGPathElement;label?:SVGGElement;labelKey?:string;handles?:SVGGElement;geometry?:string;style?:string;route?:ReturnType<typeof connectionPath>;selected?:boolean;singleSelected?:boolean;unrelated?:boolean;labelSource?:string;handleZoom?:number};
/** Stable keyed SVG rows: pointer motion changes paths, not entire DOM subtrees. */
export class EdgeLayer{
 private rows=new Map<string,Row>();private markers=new Set<string>();private defs:SVGDefsElement;
 constructor(readonly root:SVGSVGElement,private prefix:string,private edit:(id:string)=>void){this.defs=svg(root,'defs','');}
 clear(){for(const row of this.rows.values())row.group.remove();this.rows.clear();this.defs.remove();this.markers.clear();this.defs=svg(this.root,'defs','');}
 render(board:Board,width:number,height:number,selected?:string,focus?:ReadonlySet<string>,batchSelected?:ReadonlySet<string>){
  const nodes=new Map(board.nodes.map(n=>[n.id,n])),view=viewportRect(board.viewport,width,height),live=new Set<string>();
  for(const edge of board.edges){const a=nodes.get(edge.from),b=nodes.get(edge.to);if(!a||!b||!intersects(edgeBounds(a,b),view))continue;live.add(edge.id);
   let row=this.rows.get(edge.id);if(!row){const group=svg(this.root,'g','ts-edge-group');group.dataset.edge=edge.id;group.ondblclick=e=>{e.stopPropagation();this.edit(edge.id);};row={group,path:svg(group,'path','ts-edge'),hit:svg(group,'path','ts-edge-hit')};for(const el of [row.path,row.hit]){el.dataset.edge=edge.id;el.setAttribute('vector-effect','non-scaling-stroke');}this.rows.set(edge.id,row);}
   const geometryKey=[a.x,a.y,a.width,a.height,b.x,b.y,b.width,b.height,edge.fromSide,edge.toSide,edge.style].join('|');
   const style=[edge.color,edge.direction,edge.dashed].join('|'),isSingleSelected=selected===edge.id,isSelected=isSingleSelected||!!batchSelected?.has(edge.id),isUnrelated=!!focus&&(!focus.has(edge.from)||!focus.has(edge.to));
   // Keep unchanged visible rows alive without touching SVG. Compare values: callers
   // may mutate selection/focus sets in place. Only a directly selected edge owns
   // reconnect handles; entering/leaving batch selection must invalidate that state.
   if(row.geometry===geometryKey&&row.style===style&&row.labelSource===edge.label&&row.selected===isSelected&&row.singleSelected===isSingleSelected&&row.unrelated===isUnrelated&&(!isSingleSelected||row.handleZoom===board.viewport.zoom))continue;
   const geometry=row.geometry===geometryKey&&row.route?row.route:connectionPath(a,b,edge);row.route=geometry;
   if(row.geometry!==geometryKey){attr(row.path,'d',geometry.path);attr(row.hit,'d',geometry.path);row.geometry=geometryKey;}
   const markerId=this.prefix+'-'+(edge.color||'default'),color=edge.color?'var(--ts-tone)':'var(--text-muted)';
   if(!this.markers.has(markerId)){this.markers.add(markerId);const m=svg(this.defs,'marker',edge.color?'ts-color-'+edge.color:'');for(const[k,v]of Object.entries({id:markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'}))attr(m,k,v);const path=svg(m,'path','');attr(path,'d','M 0 0 L 10 5 L 0 10 z');attr(path,'fill',color);}
   if(row.style!==style){attr(row.group,'class','ts-edge-group'+(edge.color?' ts-color-'+edge.color:''));row.path.style.setProperty('--ts-edge-ink',color);attr(row.path,'marker-end',edge.direction==='none'?undefined:`url(#${markerId})`);attr(row.path,'marker-start',edge.direction==='both'?`url(#${markerId})`:undefined);attr(row.path,'stroke-dasharray',edge.dashed?'7 5':undefined);row.style=style;}
   row.group.classList.toggle('is-unrelated',isUnrelated);row.path.classList.toggle('is-selected',isSelected);
   const labelKey=edge.label+'|'+geometry.label.x+'|'+geometry.label.y;
   if(row.labelKey!==labelKey){if(edge.label){if(!row.label)row.label=svg(row.group,'g','ts-edge-caption');let bg=row.label.querySelector('rect')||svg(row.label,'rect','ts-edge-label-bg'),text=row.label.querySelector('text')||svg(row.label,'text','ts-edge-label');const label=edge.label.length>80?edge.label.slice(0,79)+'…':edge.label,w=Math.min(900,Array.from(label).reduce((n,c)=>n+(/[\u3000-\uffff]/.test(c)?12:6.5),0)+18);for(const[k,v]of Object.entries({x:geometry.label.x-w/2,y:geometry.label.y-13,width:w,height:26,rx:6}))attr(bg,k,v);attr(text,'x',geometry.label.x);attr(text,'y',geometry.label.y+4);attr(text,'text-anchor','middle');if(text.textContent!==label)text.textContent=label;const title=row.label.querySelector('title')||svg(row.label,'title','');title.textContent=edge.label;}else{row.label?.remove();row.label=undefined;}row.labelKey=labelKey;}
   if(isSingleSelected){if(!row.handles){row.handles=svg(row.group,'g','ts-edge-handles');for(const end of ['from','to'] as const){const h=svg(row.handles,'circle','ts-edge-handle');h.dataset.edgeEnd=end;h.dataset.edge=edge.id;attr(h,'role','button');const title=svg(h,'title',''),titleId=`${this.prefix}-handle-title-${++handleTitle}`;attr(title,'id',titleId);title.textContent=end==='from'?'拖动重接起点':'拖动重接终点';attr(h,'aria-labelledby',titleId);}}for(const h of Array.from(row.handles.children)){const pt=geometry[(h as SVGElement).dataset.edgeEnd as 'from'|'to'];attr(h,'cx',pt.x);attr(h,'cy',pt.y);attr(h,'r',6/board.viewport.zoom);}}
   else {row.handles?.remove();row.handles=undefined;}
   row.labelSource=edge.label;row.selected=isSelected;row.singleSelected=isSingleSelected;row.unrelated=isUnrelated;row.handleZoom=board.viewport.zoom;
  }
  for(const[id,row]of this.rows)if(!live.has(id)){row.group.remove();this.rows.delete(id);}
 }
}
