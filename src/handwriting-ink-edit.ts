import {assertInkData,hitInkStroke,hitInkStrokePath,inkBounds,type InkData,type InkStroke,type InkPoint} from './ink-model';

/** Persistent editing contract. Previews never call this function. */
export type InkEdit=
 |{kind:'append';stroke:InkStroke}
 |{kind:'remove';ids:readonly string[]}
 |{kind:'translate';ids:readonly string[];dx:number;dy:number}
 |{kind:'duplicate';ids:readonly string[];dx:number;dy:number;newIds:readonly string[]};

/** Share only untouched strokes; reject an invalid edit as a whole. */
export function applyInkEdit(ink:InkData,edit:InkEdit):InkData {
 assertInkData(ink);
 let strokes:InkStroke[];
 if(edit.kind==='append')strokes=[...ink.strokes,{...edit.stroke,points:edit.stroke.points.map(point=>[...point] as InkPoint)}];
 else{
  const ids=new Set(edit.ids),selected=ink.strokes.filter(stroke=>ids.has(stroke.id));
  if(!selected.length)return ink;
  if(edit.kind==='remove')strokes=ink.strokes.filter(stroke=>!ids.has(stroke.id));
  else{
   if(!Number.isFinite(edit.dx)||!Number.isFinite(edit.dy))throw Error('笔迹移动距离无效，已阻止写入');
   if(edit.kind==='translate'&&edit.dx===0&&edit.dy===0)return ink;
   const moved=(stroke:InkStroke,id=stroke.id):InkStroke=>({...stroke,id,points:stroke.points.map(([x,y,p])=>[x+edit.dx,y+edit.dy,p])});
   if(edit.kind==='translate')strokes=ink.strokes.map(stroke=>ids.has(stroke.id)?moved(stroke):stroke);
   else{
    if(ids.size!==edit.ids.length||selected.length!==edit.ids.length||edit.newIds.length!==selected.length)throw Error('笔迹复制选区已变化，请重新选择');
    const names=new Map(edit.ids.map((id,index)=>[id,edit.newIds[index]]));
    strokes=[...ink.strokes,...selected.map(stroke=>moved(stroke,names.get(stroke.id)))];
   }
  }
 }
 const next:InkData={...ink,strokes};assertInkData(next);return next;
}

interface PolygonTree {from:number;to:number;top:number;bottom:number;right:number;left?:PolygonTree;next?:PolygonTree}
function polygonTree(polygon:readonly InkPoint[],from=0,to=polygon.length):PolygonTree {
 let top=Infinity,bottom=-Infinity,right=-Infinity;
 for(let i=from;i<to;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];top=Math.min(top,a[1],b[1]);bottom=Math.max(bottom,a[1],b[1]);right=Math.max(right,a[0],b[0]);}
 const node:PolygonTree={from,to,top,bottom,right};if(to-from>16){const middle=Math.floor((from+to)/2);node.left=polygonTree(polygon,from,middle);node.next=polygonTree(polygon,middle,to);}return node;
}
const complexLasso=()=>Error('套索边界过于复杂，请缩短圈选范围后重试');
function insidePolygon(x:number,y:number,polygon:readonly InkPoint[],tree:PolygonTree,work:{value:number}):boolean {
 let inside=false;const pending=[tree];
 while(pending.length){const node=pending.pop()!;if(y<node.top||y>=node.bottom||x>=node.right)continue;
  if(node.left&&node.next){pending.push(node.left,node.next);continue;}
  for(let i=node.from;i<node.to;i++){
   if(++work.value>4_000_000)throw complexLasso();const a=polygon[i],b=polygon[(i+1)%polygon.length];
   if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
 }
 return inside;
}

/** Whole-stroke selection: even-odd interior or pressure-outline boundary contact. */
export function selectInkLasso(ink:InkData,polygon:readonly InkPoint[]):string[] {
 if(polygon.length<3||polygon.some(point=>!Number.isFinite(point[0])||!Number.isFinite(point[1])))return[];
 const boundary=[...polygon,polygon[0]],xs=polygon.map(point=>point[0]),ys=polygon.map(point=>point[1]);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const tree=polygonTree(polygon),work={value:0};let boundaryWork=0;
 return ink.strokes.filter(stroke=>{
  const bounds=inkBounds({version:1,strokes:[stroke]});
  if(!bounds||bounds.x>right||bounds.x+bounds.width<left||bounds.y>bottom||bounds.y+bounds.height<top)return false;
  if(stroke.points.some(([x,y])=>insidePolygon(x,y,polygon,tree,work)))return true;
  // This is a transient selection budget, never a saved-ink truncation. A
  // complex boundary is refused completely instead of partially selecting.
  boundaryWork+=stroke.points.length*boundary.length;if(boundaryWork>20_000_000)throw complexLasso();
  return hitInkStrokePath(stroke,boundary,0);
 }).map(stroke=>stroke.id);
}

/** A tap uses visible ink rather than the empty gaps of a selection rectangle. */
export function hitSelectedInk(ink:InkData,ids:readonly string[],x:number,y:number,radius:number):boolean {
 const selected=new Set(ids);return ink.strokes.some(stroke=>selected.has(stroke.id)&&hitInkStroke(stroke,x,y,radius));
}
