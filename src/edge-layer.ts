import type {Board,Card,Edge} from './model';import {connectionPath} from './connections';import {viewportRect,type Rect} from './rendering';
const NS='http://www.w3.org/2000/svg';let handleTitle=0;
function attr(el:Element,key:string,value:string|number|undefined){if(value===undefined){if(el.hasAttribute(key))el.removeAttribute(key);}else if(el.getAttribute(key)!==String(value))el.setAttribute(key,String(value));}
function svg<K extends keyof SVGElementTagNameMap>(parent:Element,tag:K,cls:string){const el=parent.ownerDocument.createElementNS(NS,tag);if(cls)el.setAttribute('class',cls);parent.appendChild(el);return el;}
type Caption={group:SVGGElement;bg:SVGRectElement;text:SVGTextElement;title:SVGTitleElement;width:number;source?:string};
type Geometry=readonly[number,number,number,number,number,number,number,number,Edge['fromSide'],Edge['toSide'],Edge['style']];
type Style=readonly[Edge['color'],Edge['direction'],Edge['dashed']];
// Row keys copy scalar values only; every render still reads the live endpoints and edge.
function sameGeometry(g:Geometry|undefined,a:Card,b:Card,e:Edge){return !!g&&g[0]===a.x&&g[1]===a.y&&g[2]===a.width&&g[3]===a.height&&g[4]===b.x&&g[5]===b.y&&g[6]===b.width&&g[7]===b.height&&g[8]===e.fromSide&&g[9]===e.toSide&&g[10]===e.style;}
/** Short-circuit far edges, retaining edgeBounds + intersects arithmetic exactly. */
function edgeInView(a:Card,b:Card,view:Rect){
 const x=Math.min(a.x,b.x)-240;if(!(x<=view.x+view.width))return false;
 const width=Math.max(a.x+a.width,b.x+b.width)+240-x;if(!(x+width>=view.x))return false;
 const y=Math.min(a.y,b.y)-240;if(!(y<=view.y+view.height))return false;
 const height=Math.max(a.y+a.height,b.y+b.height)+240-y;return y+height>=view.y;
}
type Row={group:SVGGElement;path:SVGPathElement;hit:SVGPathElement;label?:Caption;labelKey?:string;handles?:SVGGElement;geometry?:Geometry;style?:Style;route?:ReturnType<typeof connectionPath>;selected?:boolean;singleSelected?:boolean;unrelated?:boolean;labelSource?:string;handleZoom?:number};
/** Stable keyed SVG rows: pointer motion changes paths, not entire DOM subtrees. */
export class EdgeLayer{
 private rows=new Map<string,Row>();private markers=new Set<string>();private defs:SVGDefsElement;
 constructor(readonly root:SVGSVGElement,private prefix:string,private edit:(id:string)=>void){this.defs=svg(root,'defs','');}
 clear(){for(const row of this.rows.values())row.group.remove();this.rows.clear();this.defs.remove();this.markers.clear();this.defs=svg(this.root,'defs','');}
 render(board:Board,width:number,height:number,selected?:string,focus?:ReadonlySet<string>,batchSelected?:ReadonlySet<string>){
  // With no visible connections there is nothing to index or cull. Preserve
  // marker definitions for reuse, just as normal row eviction does.
  if(!board.edges.length){for(const row of this.rows.values())row.group.remove();this.rows.clear();return;}
  const nodes=new Map<string,Card>();for(const node of board.nodes)nodes.set(node.id,node);
  const view=viewportRect(board.viewport,width,height),live=new Set<string>();
  for(const edge of board.edges){const a=nodes.get(edge.from),b=nodes.get(edge.to);if(!a||!b||!edgeInView(a,b,view))continue;live.add(edge.id);
   let row=this.rows.get(edge.id);if(!row){const group=svg(this.root,'g','ts-edge-group');group.dataset.edge=edge.id;group.ondblclick=e=>{e.stopPropagation();this.edit(edge.id);};row={group,path:svg(group,'path','ts-edge'),hit:svg(group,'path','ts-edge-hit')};for(const el of [row.path,row.hit]){el.dataset.edge=edge.id;el.setAttribute('vector-effect','non-scaling-stroke');}this.rows.set(edge.id,row);}
   const geometryMatches=sameGeometry(row.geometry,a,b,edge);
   const styleMatches=!!row.style&&row.style[0]===edge.color&&row.style[1]===edge.direction&&row.style[2]===edge.dashed,isSingleSelected=selected===edge.id,isSelected=isSingleSelected||!!batchSelected?.has(edge.id),isUnrelated=!!focus&&(!focus.has(edge.from)||!focus.has(edge.to));
   // Keep unchanged visible rows alive without touching SVG. Compare values: callers
   // may mutate selection/focus sets in place. Only a directly selected edge owns
   // reconnect handles; entering/leaving batch selection must invalidate that state.
   if(geometryMatches&&styleMatches&&row.labelSource===edge.label&&row.selected===isSelected&&row.singleSelected===isSingleSelected&&row.unrelated===isUnrelated&&(!isSingleSelected||row.handleZoom===board.viewport.zoom))continue;
   const geometry=geometryMatches&&row.route?row.route:connectionPath(a,b,edge);row.route=geometry;
   if(!geometryMatches){attr(row.path,'d',geometry.path);attr(row.hit,'d',geometry.path);row.geometry=[a.x,a.y,a.width,a.height,b.x,b.y,b.width,b.height,edge.fromSide,edge.toSide,edge.style];}
   const markerId=this.prefix+'-'+(edge.color||'default'),color=edge.color?'var(--ts-tone)':'var(--text-muted)';
   if(!this.markers.has(markerId)){this.markers.add(markerId);const m=svg(this.defs,'marker',edge.color?'ts-color-'+edge.color:'');for(const[k,v]of Object.entries({id:markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'}))attr(m,k,v);const path=svg(m,'path','');attr(path,'d','M 0 0 L 10 5 L 0 10 z');attr(path,'fill',color);}
   const restyle=!styleMatches;
   if(restyle){attr(row.group,'class','ts-edge-group'+(edge.color?' ts-color-'+edge.color:''));row.path.style.setProperty('--ts-edge-ink',color);attr(row.path,'marker-end',edge.direction==='none'?undefined:`url(#${markerId})`);attr(row.path,'marker-start',edge.direction==='both'?`url(#${markerId})`:undefined);attr(row.path,'stroke-dasharray',edge.dashed?'7 5':undefined);row.style=[edge.color,edge.direction,edge.dashed];}
   // Restyling replaces the group class, so restore focus even when its state is unchanged.
   if(restyle||row.unrelated!==isUnrelated)row.group.classList.toggle('is-unrelated',isUnrelated);if(row.selected!==isSelected)row.path.classList.toggle('is-selected',isSelected);
   const labelKey=edge.label+'|'+geometry.label.x+'|'+geometry.label.y;
   if(row.labelKey!==labelKey){
    if(edge.label){
     if(!row.label){const group=svg(row.group,'g','ts-edge-caption');row.label={group,bg:svg(group,'rect','ts-edge-label-bg'),text:svg(group,'text','ts-edge-label'),title:svg(group,'title',''),width:0};attr(row.label.bg,'height',26);attr(row.label.bg,'rx',6);attr(row.label.text,'text-anchor','middle');}
     const caption=row.label;
     // A drag changes the anchor, not the caption. Keep bounded text metrics and
     // element references with the visible row; eviction/clear releases them.
     if(caption.source!==edge.label){const label=edge.label.length>80?edge.label.slice(0,79)+'…':edge.label;caption.width=Math.min(900,Array.from(label).reduce((n,c)=>n+(/[\u3000-\uffff]/.test(c)?12:6.5),0)+18);attr(caption.bg,'width',caption.width);if(caption.text.textContent!==label)caption.text.textContent=label;caption.title.textContent=edge.label;caption.source=edge.label;}
     attr(caption.bg,'x',geometry.label.x-caption.width/2);attr(caption.bg,'y',geometry.label.y-13);attr(caption.text,'x',geometry.label.x);attr(caption.text,'y',geometry.label.y+4);
    }else{row.label?.group.remove();row.label=undefined;}
    row.labelKey=labelKey;
   }
   if(isSingleSelected){if(!row.handles){row.handles=svg(row.group,'g','ts-edge-handles');for(const end of ['from','to'] as const){const h=svg(row.handles,'circle','ts-edge-handle');h.dataset.edgeEnd=end;h.dataset.edge=edge.id;attr(h,'role','button');const title=svg(h,'title',''),titleId=`${this.prefix}-handle-title-${++handleTitle}`;attr(title,'id',titleId);title.textContent=end==='from'?'拖动重接起点':'拖动重接终点';attr(h,'aria-labelledby',titleId);}}for(const h of Array.from(row.handles.children)){const pt=geometry[(h as SVGElement).dataset.edgeEnd as 'from'|'to'];attr(h,'cx',pt.x);attr(h,'cy',pt.y);attr(h,'r',6/board.viewport.zoom);}}
   else {row.handles?.remove();row.handles=undefined;}
   row.labelSource=edge.label;row.selected=isSelected;row.singleSelected=isSingleSelected;row.unrelated=isUnrelated;row.handleZoom=board.viewport.zoom;
  }
  for(const[id,row]of this.rows)if(!live.has(id)){row.group.remove();this.rows.delete(id);}
 }
}
