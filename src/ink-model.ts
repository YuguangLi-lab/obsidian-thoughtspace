/** Persistent samples use world coordinates; transient pointer events stay in the view. */
export type InkPoint=[number,number,number];
export interface InkStroke {id:string;color:string;width:number;points:InkPoint[];}
export interface InkData {version:1;strokes:InkStroke[];}
export interface InkBounds {x:number;y:number;width:number;height:number;}

export const MAX_STROKE_POINTS=8192;
export const MAX_INK_POINTS=65536;
export const MAX_INK_STROKES=2000;
export const MAX_INK_COORDINATE=1_000_000;
/** Display only; saved samples retain their full precision. */
export const INK_DISPLAY_PADDING=.002;

function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function finite(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value);}
function control(value:string){for(let i=0;i<value.length;i++){const code=value.charCodeAt(i);if(code<32||code===127)return true;}return false;}
function svgNumber(value:number){return String(Math.round(value*1000)/1000);}

/** Reject the complete invalid collection; never truncate or silently discard a stroke. */
export function validInkData(raw:unknown):raw is InkData {
 if(!record(raw)||raw.version!==1||!Array.isArray(raw.strokes)||raw.strokes.length>MAX_INK_STROKES)return false;
 const ids=new Set<string>();let total=0;
 for(const stroke of raw.strokes as unknown[]){
  if(!record(stroke)||typeof stroke.id!=='string'||!stroke.id.trim()||stroke.id.length>256||control(stroke.id)||ids.has(stroke.id)
   ||typeof stroke.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(stroke.color)||!finite(stroke.width)||stroke.width<.5||stroke.width>24
   ||!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>MAX_STROKE_POINTS)return false;
  ids.add(stroke.id);total+=stroke.points.length;if(total>MAX_INK_POINTS)return false;
  for(const point of stroke.points as unknown[]){
   if(!Array.isArray(point)||point.length!==3||!finite(point[0])||!finite(point[1])||Math.abs(point[0])>MAX_INK_COORDINATE||Math.abs(point[1])>MAX_INK_COORDINATE
    ||!finite(point[2])||point[2]<0||point[2]>1)return false;
  }
 }
 return true;
}

export function assertInkData(raw:unknown):asserts raw is InkData {
 if(!validInkData(raw))throw Error('手写笔迹数据无效或超出保存上限，已阻止写入');
}

/** A pressure of zero remains visible; neutral device fallback is supplied by input. */
export function pressureRadius(width:number,pressure:number):number{return width*(.25+.75*pressure)/2;}

/** Endpoint disk bounds also contain every tapered segment joining those disks. */
export function inkBounds(data:InkData):InkBounds|undefined {
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const stroke of data.strokes)for(const [x,y,pressure] of stroke.points){
  const radius=pressureRadius(stroke.width,pressure);
  left=Math.min(left,x-radius);top=Math.min(top,y-radius);right=Math.max(right,x+radius);bottom=Math.max(bottom,y+radius);
 }
 // Compact path coordinates can move an arc by at most a few thousandths.
 return left===Infinity?undefined:{x:left-INK_DISPLAY_PADDING,y:top-INK_DISPLAY_PADDING,width:right-left+INK_DISPLAY_PADDING*2,height:bottom-top+INK_DISPLAY_PADDING*2};
}

/**
 * A filled outline is the union of sample disks and their tapered tangent hulls.
 * All subpaths have the same winding: render with fill=color and fill-rule=nonzero.
 * The construction has no miter spikes and preserves dots and stationary pressure.
 */
export function strokePath(stroke:InkStroke):string {
 const paths:string[]=[];
 const circle=(x:number,y:number,r:number)=>{
  const displayX=Math.round(x*1000)/1000,displayR=Math.round(r*1000)/1000,value=svgNumber(displayR),diameter=svgNumber(displayR*2);
  // Relative diameters keep each pair of arcs exactly semicircular after rounding.
  return `M${svgNumber(displayX+displayR)} ${svgNumber(y)}a${value} ${value} 0 1 1 -${diameter} 0a${value} ${value} 0 1 1 ${diameter} 0Z`;
 };
 for(let i=0;i<stroke.points.length;i++){
  const [x,y,pressure]=stroke.points[i],radius=pressureRadius(stroke.width,pressure);
  paths.push(circle(x,y,radius));if(!i)continue;
  const [ax,ay,ap]=stroke.points[i-1],ar=pressureRadius(stroke.width,ap),dx=x-ax,dy=y-ay,distance=Math.hypot(dx,dy);
  // Equal centers or a disk contained in the other need no tangent quadrilateral.
  if(distance<=Math.abs(radius-ar))continue;
  const ux=dx/distance,uy=dy/distance,k=(ar-radius)/distance,h=Math.sqrt(Math.max(0,1-k*k));
  const nx=k*ux+h*uy,ny=k*uy-h*ux,rx=k*ux-h*uy,ry=k*uy+h*ux;
  paths.push(`M${svgNumber(ax+ar*nx)} ${svgNumber(ay+ar*ny)}L${svgNumber(x+radius*nx)} ${svgNumber(y+radius*ny)}L${svgNumber(x+radius*rx)} ${svgNumber(y+radius*ry)}L${svgNumber(ax+ar*rx)} ${svgNumber(ay+ar*ry)}Z`);
 }
 return paths.join('');
}

/**
 * Hit the same swept disks used by the outline, expanded by a world-space eraser.
 * Minimize distance² - radius(t)² over each segment; maximum-radius tests would
 * erase untouched thin ends. Convex quadratics need their interior minimum too.
 */
export function hitInkStroke(stroke:InkStroke,x:number,y:number,radius:number):boolean {
 if(!finite(x)||!finite(y)||!finite(radius)||radius<0)return false;
 if(stroke.points.length===1){const [px,py,p]=stroke.points[0];return inside(x-px,y-py,pressureRadius(stroke.width,p)+radius);}
 for(let i=1;i<stroke.points.length;i++){
  const a=stroke.points[i-1],b=stroke.points[i];
  if(taperHit(a,b,pressureRadius(stroke.width,a[2]),pressureRadius(stroke.width,b[2]),x,y,radius))return true;
 }
 return false;
}

function inside(dx:number,dy:number,radius:number){return Math.hypot(dx,dy)<=radius+1e-9;}
function taperHit(a:InkPoint,b:InkPoint,ar:number,br:number,x:number,y:number,radius:number){
 if(inside(x-a[0],y-a[1],ar+radius)||inside(x-b[0],y-b[1],br+radius))return true;
 const dx=b[0]-a[0],dy=b[1]-a[1],qx=x-a[0],qy=y-a[1],dr=br-ar,quadratic=dx*dx+dy*dy-dr*dr;
 if(quadratic<=0)return false; // Concave segments have their minimum at an endpoint.
 const t=(qx*dx+qy*dy+(ar+radius)*dr)/quadratic;
 return t>0&&t<1&&inside(qx-t*dx,qy-t*dy,ar+radius+t*dr);
}

interface SweepPiece {a:InkPoint;b:InkPoint;ar:number;br:number;bounds:InkBounds;}
interface SweepTree {bounds:InkBounds;from:number;to:number;left?:SweepTree;right?:SweepTree;}
function overlaps(a:InkBounds,b:InkBounds){return a.x<=b.x+b.width+1e-9&&a.x+a.width+1e-9>=b.x&&a.y<=b.y+b.height+1e-9&&a.y+a.height+1e-9>=b.y;}
function union(a:InkBounds,b:InkBounds):InkBounds {const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};}
function pointSegmentHit(x:number,y:number,a:InkPoint,b:InkPoint,radius:number){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;
 return inside(x-a[0]-t*dx,y-a[1]-t*dy,radius);
}
function sweepHit(piece:SweepPiece,c:InkPoint,d:InkPoint,radius:number){
 const {a,b,ar,br}=piece;
 // Four rectangle edges in the two-segment parameter space include caps and dots.
 if(taperHit(a,b,ar,br,c[0],c[1],radius)||taperHit(a,b,ar,br,d[0],d[1],radius)
  ||pointSegmentHit(a[0],a[1],c,d,ar+radius)||pointSegmentHit(b[0],b[1],c,d,br+radius))return true;
 const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],wx=a[0]-c[0],wy=a[1]-c[1],dr=br-ar;
 const length=ex*ex+ey*ey,crossD=dx*ey-dy*ex,crossW=wx*ey-wy*ex,det=crossD*crossD-dr*dr*length;
 // An indefinite quadratic reaches its minimum on one of the checked edges.
 // Cross products avoid subtracting almost equal length products for parallel lines.
 if(!length||det<=0)return false;
 const t=((ar+radius)*dr*length-crossW*crossD)/det,s=(wx*ex+wy*ey+t*(dx*ex+dy*ey))/length;
 return t>0&&t<1&&s>0&&s<1&&inside(wx+t*dx-s*ex,wy+t*dy-s*ey,ar+radius+t*dr);
}
function sweepTree(pieces:SweepPiece[],from:number,to:number):SweepTree {
 if(to-from<=16){let bounds=pieces[from].bounds;for(let i=from+1;i<to;i++)bounds=union(bounds,pieces[i].bounds);return{bounds,from,to};}
 const middle=Math.floor((from+to)/2),left=sweepTree(pieces,from,middle),right=sweepTree(pieces,middle,to);
 return{bounds:union(left.bounds,right.bounds),from,to,left,right};
}

/** Continuous whole-stroke erasing: sparse input samples cannot skip crossed ink. */
export function hitInkStrokePath(stroke:InkStroke,points:readonly InkPoint[],radius:number):boolean {
 if(!points.length||!stroke.points.length||!finite(radius)||radius<0)return false;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const point of points){if(!point||!finite(point[0])||!finite(point[1]))return false;left=Math.min(left,point[0]-radius);top=Math.min(top,point[1]-radius);right=Math.max(right,point[0]+radius);bottom=Math.max(bottom,point[1]+radius);}
 const bounds=inkBounds({version:1,strokes:[stroke]});
 if(!bounds||!overlaps(bounds,{x:left,y:top,width:right-left,height:bottom-top}))return false;
 if(points.length===1)return hitInkStroke(stroke,points[0][0],points[0][1],radius);
 const pieces:SweepPiece[]=[];
 for(let i=0;i<Math.max(1,stroke.points.length-1);i++){
  const a=stroke.points[i],b=stroke.points[Math.min(i+1,stroke.points.length-1)],ar=pressureRadius(stroke.width,a[2]),br=pressureRadius(stroke.width,b[2]);
  const x=Math.min(a[0]-ar,b[0]-br),y=Math.min(a[1]-ar,b[1]-br);
  pieces.push({a,b,ar,br,bounds:{x,y,width:Math.max(a[0]+ar,b[0]+br)-x,height:Math.max(a[1]+ar,b[1]+br)-y}});
 }
 // A transient tree follows contiguous pieces; no mutable Board references are cached.
 const tree=sweepTree(pieces,0,pieces.length);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],x=Math.min(a[0],b[0])-radius,y=Math.min(a[1],b[1])-radius,query={x,y,width:Math.abs(b[0]-a[0])+2*radius,height:Math.abs(b[1]-a[1])+2*radius};
  const stack=[tree];while(stack.length){const node=stack.pop()!;if(!overlaps(node.bounds,query))continue;
   if(node.left&&node.right){stack.push(node.right,node.left);continue;}
   for(let j=node.from;j<node.to;j++)if(overlaps(pieces[j].bounds,query)&&sweepHit(pieces[j],a,b,radius))return true;
  }
 }
 return false;
}
