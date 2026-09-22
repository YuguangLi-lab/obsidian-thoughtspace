import type { Card, Edge } from './model';
export type Side = 'top'|'right'|'bottom'|'left';
const vectors={top:[0,-1],right:[1,0],bottom:[0,1],left:[-1,0]} as const;
export function connectionSides(a:Card,b:Card,e:Partial<Edge>={}) {
  const dx=b.x+b.width/2-a.x-a.width/2,dy=b.y+b.height/2-a.y-a.height/2;
  const horizontal=Math.abs(dx)/(a.width+b.width)>=Math.abs(dy)/(a.height+b.height);
  return {fromSide:e.fromSide|| (horizontal?(dx>=0?'right':'left'):(dy>=0?'bottom':'top')) as Side,
    toSide:e.toSide|| (horizontal?(dx>=0?'left':'right'):(dy>=0?'top':'bottom')) as Side};
}
export const connectionAnchor=(n:Pick<Card,'x'|'y'|'width'|'height'>,s:Side)=>({x:n.x+(s==='left'?0:s==='right'?n.width:n.width/2),y:n.y+(s==='top'?0:s==='bottom'?n.height:n.height/2)});
export function connectionPath(a:Card,b:Card,e:Partial<Edge>={}) {
  const sides=connectionSides(a,b,e);
  const p=connectionAnchor(a,sides.fromSide),q=connectionAnchor(b,sides.toSide);
  if(e.style==='straight')return{...sides,path:`M ${p.x} ${p.y} L ${q.x} ${q.y}`,label:{x:(p.x+q.x)/2,y:(p.y+q.y)/2},from:p,to:q};
  const v=vectors[sides.fromSide],w=vectors[sides.toSide];
  if(e.style==='elbow'){
    const stub=Math.min(32,Math.max(12,Math.hypot(q.x-p.x,q.y-p.y)/4));
    const u={x:p.x+v[0]*stub,y:p.y+v[1]*stub},t={x:q.x+w[0]*stub,y:q.y+w[1]*stub};
    const points=[p,u];
    if(v[0]!==0&&w[0]!==0){const x=(u.x+t.x)/2;points.push({x,y:u.y},{x,y:t.y});}
    else if(v[1]!==0&&w[1]!==0){const y=(u.y+t.y)/2;points.push({x:u.x,y},{x:t.x,y});}
    else points.push(v[0]!==0?{x:t.x,y:u.y}:{x:u.x,y:t.y});
    points.push(t,q);const unique=points.filter((pt,i)=>!i||pt.x!==points[i-1].x||pt.y!==points[i-1].y);
    let path=`M ${p.x} ${p.y}`,label={x:(p.x+q.x)/2,y:(p.y+q.y)/2};
    for(let i=1;i<unique.length-1;i++){const prev=unique[i-1],cur=unique[i],next=unique[i+1],a=Math.hypot(cur.x-prev.x,cur.y-prev.y),b=Math.hypot(next.x-cur.x,next.y-cur.y),r=Math.min(12,a/2,b/2);const before={x:cur.x+(prev.x-cur.x)*r/a,y:cur.y+(prev.y-cur.y)*r/a},after={x:cur.x+(next.x-cur.x)*r/b,y:cur.y+(next.y-cur.y)*r/b};path+=` L ${before.x} ${before.y} Q ${cur.x} ${cur.y} ${after.x} ${after.y}`;}
    path+=` L ${q.x} ${q.y}`;
    const lengths=unique.slice(1).map((pt,i)=>Math.hypot(pt.x-unique[i].x,pt.y-unique[i].y));let half=lengths.reduce((a,b)=>a+b,0)/2;
    for(let i=0;i<lengths.length;i++){if(half<=lengths[i]){const t=lengths[i]?half/lengths[i]:0;label={x:unique[i].x+(unique[i+1].x-unique[i].x)*t,y:unique[i].y+(unique[i+1].y-unique[i].y)*t};break;}half-=lengths[i];}
    return {...sides,path,label,from:p,to:q};
  }
  const bend=Math.max(40,Math.min(240,Math.hypot(q.x-p.x,q.y-p.y)*.4));
  const c={x:p.x+v[0]*bend,y:p.y+v[1]*bend},d={x:q.x+w[0]*bend,y:q.y+w[1]*bend};
  return {...sides,path:`M ${p.x} ${p.y} C ${c.x} ${c.y} ${d.x} ${d.y} ${q.x} ${q.y}`,label:{x:(p.x+3*c.x+3*d.x+q.x)/8,y:(p.y+3*c.y+3*d.y+q.y)/8},from:p,to:q};
}
