import {Card} from './model';
export interface Bounds{x:number;y:number;width:number;height:number;}
interface Anchor{value:number;bounds:Bounds;}
export interface Guide{axis:'x'|'y';value:number;start:number;end:number;spacing?:number;}
export interface AlignmentIndex{x:Anchor[];y:Anchor[];bounds:Bounds;neighbors:Bounds[];}
export function alignmentIndex(nodes:readonly Card[],moving:ReadonlySet<string>,visible?:Bounds):AlignmentIndex|undefined{
 const selected=nodes.filter(n=>moving.has(n.id)&&!n.locked);if(!selected.length)return;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const n of selected){left=Math.min(left,n.x);top=Math.min(top,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}
 const x:Anchor[]=[],y:Anchor[]=[],neighbors:Bounds[]=[];
 for(const n of nodes){if(moving.has(n.id)||n.kind==='section'||visible&&(n.x+n.width<visible.x||n.y+n.height<visible.y||n.x>visible.x+visible.width||n.y>visible.y+visible.height))continue;
  neighbors.push(n);for(const value of [n.x,n.x+n.width/2,n.x+n.width])x.push({value,bounds:n});
  for(const value of [n.y,n.y+n.height/2,n.y+n.height])y.push({value,bounds:n});
 }
 x.sort((a,b)=>a.value-b.value);y.sort((a,b)=>a.value-b.value);
 return {x,y,neighbors,bounds:{x:left,y:top,width:right-left,height:bottom-top}};
}
/** Inspect only visible neighbors; keep the closest two on either side. No
 * pairwise index or per-frame sort grows quadratically with board size. */
function equalSpacing(index:AlignmentIndex,axis:'x'|'y',x:number,y:number,threshold:number,zoom:number){
 const horizontal=axis==='x',size=horizontal?'width':'height',cross=horizontal?'y':'x',crossSize=horizontal?'height':'width',at=horizontal?x:y,other=horizontal?y:x,length=index.bounds[size],breadth=index.bounds[crossSize];
 const before:Bounds[]=[],after:Bounds[]=[];
 for(let i=0;i<index.neighbors.length;i++){const n=index.neighbors[i];if(n[cross]+n[crossSize]<=other||n[cross]>=other+breadth)continue;
  if(n[axis]+n[size]<=at+threshold){before.push(n);before.sort((a,b)=>b[axis]+b[size]-a[axis]-a[size]);if(before.length>2)before.pop();}
  else if(n[axis]>=at+length-threshold){after.push(n);after.sort((a,b)=>a[axis]-b[axis]);if(after.length>2)after.pop();}
 }
 let best:{distance:number;guides:Guide[]}|undefined;
 const offer=(position:number,gap:number,segments:[number,number][])=>{const distance=position-at;if(gap<0||Math.abs(distance)>threshold||best&&Math.abs(best.distance)<=Math.abs(distance))return;best={distance,guides:segments.map(([start,end])=>({axis,value:other+breadth+12/zoom,start,end,spacing:gap}))};};
 if(before.length===2){const [b,a]=before,gap=b[axis]-a[axis]-a[size],position=b[axis]+b[size]+gap;offer(position,gap,[[a[axis]+a[size],b[axis]],[b[axis]+b[size],position]]);}
 if(after.length===2){const [a,b]=after,gap=b[axis]-a[axis]-a[size],position=a[axis]-gap-length;offer(position,gap,[[position+length,a[axis]],[a[axis]+a[size],b[axis]]]);}
 if(before.length&&after.length){const a=before[0],b=after[0],gap=(b[axis]-a[axis]-a[size]-length)/2,position=a[axis]+a[size]+gap;offer(position,gap,[[a[axis]+a[size],position],[position+length,b[axis]]]);}
 return best;
}
function nearest(anchors:Anchor[],start:number,middle:number,end:number,threshold:number){
 let best:{anchor:Anchor;distance:number}|undefined;
 for(let at=0;at<3;at++){const point=at===0?start:at===1?middle:end;let lo=0,hi=anchors.length;while(lo<hi){const mid=(lo+hi)>>>1;if(anchors[mid].value<point)lo=mid+1;else hi=mid;}
  for(let i=lo-1;i<=lo;i++){const anchor=anchors[i];if(!anchor)continue;const distance=anchor.value-point;if(Math.abs(distance)<=threshold&&(!best||Math.abs(distance)<Math.abs(best.distance))){best={anchor,distance};if(distance===0)return best;}}
 }return best;
}
/** The threshold stays six screen pixels at every zoom. One shared delta preserves a multi-selection. */
export function alignDrag(index:AlignmentIndex,dx:number,dy:number,zoom:number,lockedAxis?:'x'|'y'){
 const b=index.bounds,threshold=6/Math.max(.05,zoom),x=b.x+dx,y=b.y+dy;
 const sx=lockedAxis==='x'?undefined:nearest(index.x,x,x+b.width/2,x+b.width,threshold);
 const sy=lockedAxis==='y'?undefined:nearest(index.y,y,y+b.height/2,y+b.height,threshold);
 const gx=lockedAxis==='x'||sx?undefined:equalSpacing(index,'x',x,y,threshold,zoom),gy=lockedAxis==='y'||sy?undefined:equalSpacing(index,'y',x,y,threshold,zoom);
 const useX=!!gx&&(!sx||Math.abs(gx.distance)<Math.abs(sx.distance)),useY=!!gy&&(!sy||Math.abs(gy.distance)<Math.abs(sy.distance));
 const guides:Guide[]=[];dx+=useX?gx.distance:sx?.distance||0;dy+=useY?gy.distance:sy?.distance||0;
 if(useX)guides.push(...gx.guides);else if(sx)guides.push({axis:'x',value:sx.anchor.value,start:Math.min(b.y+dy,sx.anchor.bounds.y),end:Math.max(b.y+dy+b.height,sx.anchor.bounds.y+sx.anchor.bounds.height)});
 if(useY)guides.push(...gy.guides);else if(sy)guides.push({axis:'y',value:sy.anchor.value,start:Math.min(b.x+dx,sy.anchor.bounds.x),end:Math.max(b.x+dx+b.width,sy.anchor.bounds.x+sy.anchor.bounds.width)});
 return {dx,dy,guides};
}
