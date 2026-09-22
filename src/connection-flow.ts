import type {Board,Card,Edge} from './model';
import {connectionAnchor,connectionSides,Side} from './connections';
export type Point={x:number;y:number};
export function nearestSide(node:Card,p:Point):Side{
 const sides:Side[]=['top','right','bottom','left'];let best=sides[0],distance=Infinity;
 for(const side of sides){const a=connectionAnchor(node,side),d=Math.hypot(a.x-p.x,a.y-p.y);if(d<distance){distance=d;best=side;}}return best;
}
/** Actual hits beat adjacent snap halos. In a gap choose the nearest rectangle;
 * equal distances keep drawing order. The halo remains twenty screen pixels. */
export function connectionTarget(nodes:readonly Card[],point:Point,exclude:string,zoom:number,eligible?:(node:Card)=>boolean){
 if(!Number.isFinite(zoom)||zoom<=0||!Number.isFinite(point.x)||!Number.isFinite(point.y))return undefined;
 // Allow only floating-point rounding at the twenty-pixel boundary (not a wider halo).
 const radius=(20+1e-7)/zoom,limit=radius*radius;let best:Card|undefined,bestDistance=Infinity;
 for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(n.id===exclude||n.kind==='section')continue;
  // Most mounted objects are far away. Keep their rejection to cheap comparisons;
  // only nearby candidates need the rounded-corner distance and eligibility check.
  if(point.x<n.x-radius||point.x>n.x+n.width+radius||point.y<n.y-radius||point.y>n.y+n.height+radius)continue;
  const dx=Math.max(n.x-point.x,0,point.x-n.x-n.width),dy=Math.max(n.y-point.y,0,point.y-n.y-n.height),distance=dx*dx+dy*dy;
  if(distance>limit||distance>=bestDistance||eligible&&!eligible(n))continue;
  if(distance===0)return{id:n.id,side:nearestSide(n,point)};
  best=n;bestDistance=distance;
 }
 return best?{id:best.id,side:nearestSide(best,point)}:undefined;
}
export function duplicateConnection(board:Board,edge:Pick<Edge,'from'|'to'|'fromSide'|'toSide'>,ignore?:string){
 const a=board.nodes.find(n=>n.id===edge.from),b=board.nodes.find(n=>n.id===edge.to);if(!a||!b)return false;
 const sides=connectionSides(a,b,edge);return board.edges.some(e=>e.id!==ignore&&e.from===edge.from&&e.to===edge.to&&JSON.stringify(connectionSides(a,b,e))===JSON.stringify(sides));
}
export function reconnectEdge(board:Board,id:string,end:'from'|'to',target:string,side:Side,expected:string){
 const edge=board.edges.find(e=>e.id===id);if(!edge||JSON.stringify(edge)!==expected||!board.nodes.some(n=>n.id===target))return false;
 const next={...edge,[end]:target,[end==='from'?'fromSide':'toSide']:side};
 if(next.from===next.to||duplicateConnection(board,next,id)||JSON.stringify(next)===JSON.stringify(edge))return false;
 // Reconnecting a mind-map branch creates an ordinary relationship.
 if(next.from!==edge.from||next.to!==edge.to)delete next.kind;
 Object.assign(edge,next);if(next.kind===undefined)delete edge.kind;return true;
}
