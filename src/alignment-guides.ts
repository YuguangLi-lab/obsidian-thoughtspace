import {Card} from './model';
export interface Bounds{x:number;y:number;width:number;height:number;}
interface Anchor{value:number;bounds:Bounds;}
export interface Guide{axis:'x'|'y';value:number;start:number;end:number;}
export interface AlignmentIndex{x:Anchor[];y:Anchor[];bounds:Bounds;}
export function alignmentIndex(nodes:readonly Card[],moving:ReadonlySet<string>,visible?:Bounds):AlignmentIndex|undefined{
 const selected=nodes.filter(n=>moving.has(n.id)&&!n.locked);if(!selected.length)return;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const n of selected){left=Math.min(left,n.x);top=Math.min(top,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}
 const x:Anchor[]=[],y:Anchor[]=[];
 for(const n of nodes){if(moving.has(n.id)||n.kind==='section'||visible&&(n.x+n.width<visible.x||n.y+n.height<visible.y||n.x>visible.x+visible.width||n.y>visible.y+visible.height))continue;
  for(const value of [n.x,n.x+n.width/2,n.x+n.width])x.push({value,bounds:n});
  for(const value of [n.y,n.y+n.height/2,n.y+n.height])y.push({value,bounds:n});
 }
 x.sort((a,b)=>a.value-b.value);y.sort((a,b)=>a.value-b.value);
 return {x,y,bounds:{x:left,y:top,width:right-left,height:bottom-top}};
}
function nearest(anchors:Anchor[],points:number[],threshold:number){
 let best:{anchor:Anchor;distance:number}|undefined;
 for(const point of points){let lo=0,hi=anchors.length;while(lo<hi){const mid=(lo+hi)>>>1;if(anchors[mid].value<point)lo=mid+1;else hi=mid;}
  for(const i of [lo-1,lo]){const anchor=anchors[i];if(!anchor)continue;const distance=anchor.value-point;if(Math.abs(distance)<=threshold&&(!best||Math.abs(distance)<Math.abs(best.distance))){best={anchor,distance};if(distance===0)return best;}}
 }return best;
}
/** The threshold stays six screen pixels at every zoom. One shared delta preserves a multi-selection. */
export function alignDrag(index:AlignmentIndex,dx:number,dy:number,zoom:number,lockedAxis?:'x'|'y'){
 const b=index.bounds,threshold=6/Math.max(.05,zoom),x=b.x+dx,y=b.y+dy;
 const sx=lockedAxis==='x'?undefined:nearest(index.x,[x,x+b.width/2,x+b.width],threshold);
 const sy=lockedAxis==='y'?undefined:nearest(index.y,[y,y+b.height/2,y+b.height],threshold);
 const guides:Guide[]=[];dx+=sx?.distance||0;dy+=sy?.distance||0;
 if(sx)guides.push({axis:'x',value:sx.anchor.value,start:Math.min(b.y+dy,sx.anchor.bounds.y),end:Math.max(b.y+dy+b.height,sx.anchor.bounds.y+sx.anchor.bounds.height)});
 if(sy)guides.push({axis:'y',value:sy.anchor.value,start:Math.min(b.x+dx,sy.anchor.bounds.x),end:Math.max(b.x+dx+b.width,sy.anchor.bounds.x+sy.anchor.bounds.width)});
 return {dx,dy,guides};
}
