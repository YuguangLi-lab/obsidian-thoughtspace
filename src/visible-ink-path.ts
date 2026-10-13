import {inkBounds,INK_DISPLAY_PADDING,type InkBounds,type InkStroke} from './ink-model';
import type {HandwritingRect,HandwritingViewport} from './handwriting-input';
import type {InkPathCache} from './ink-path-cache';
import {retainedInkStrokeBytes} from './handwriting-history';

export const INK_VECTOR_FRAGMENT_POINTS=512;
export const INK_VECTOR_CULL_MIN_POINTS=1024;
export const INK_VECTOR_BATCH_POINTS=4096;
export const INK_VECTOR_ASYNC_POINTS=8192;
export interface InkVisibleViewport {offsetLeft:number;offsetTop:number;width:number;height:number}
export interface InkProjectionCursor {readonly plan:object;readonly ranges:string}
export interface InkPathProjection {path?:string;cursor?:InkProjectionCursor;fragmentCount:number;projectedSamples:number;allVisible:boolean}
interface Fragment {stroke:InkStroke;bounds:InkBounds;from:number;to:number}
interface Plan {token:object;width:number;points:Float64Array;immutable:boolean;bytes:number;bounds?:InkBounds;fragments?:Fragment[]}
const overlaps=(a:InkBounds,b:InkBounds)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
const contains=(a:InkBounds,b:InkBounds)=>a.x<=b.x&&a.y<=b.y&&a.x+a.width>=b.x+b.width&&a.y+a.height>=b.y+b.height;

/** A screen-pixel margin also covers antialiasing at the stage/keyboard edge. */
export function visibleInkWorldRect(stage:HandwritingRect,camera:HandwritingViewport,visible?:InkVisibleViewport):InkBounds|undefined {
 if(![stage.left,stage.top,stage.width,stage.height,camera.x,camera.y,camera.zoom].every(Number.isFinite)||stage.width<=0||stage.height<=0||camera.zoom<=0)return;
 if(visible&&(![visible.offsetLeft,visible.offsetTop,visible.width,visible.height].every(Number.isFinite)||visible.width<=0||visible.height<=0))return;
 const left=Math.max(stage.left,visible?.offsetLeft??stage.left),top=Math.max(stage.top,visible?.offsetTop??stage.top);
 const right=Math.min(stage.left+stage.width,visible?visible.offsetLeft+visible.width:stage.left+stage.width),bottom=Math.min(stage.top+stage.height,visible?visible.offsetTop+visible.height:stage.top+stage.height);
 if(right<=left||bottom<=top)return;
 const margin=1/camera.zoom+INK_DISPLAY_PADDING;
 return{x:(left-stage.left-camera.x)/camera.zoom-margin,y:(top-stage.top-camera.y)/camera.zoom-margin,width:(right-left)/camera.zoom+2*margin,height:(bottom-top)/camera.zoom+2*margin};
}

/** Exact display projection. The model, whole-stroke hit tests and export retain
 * every original sample. Fragments share the existing bounded path cache. */
export class VisibleInkPath {
 private plans=new Map<InkStroke,Plan>();private retainedBytes=0;
 constructor(private cache:Pick<InkPathCache,'get'>,readonly maxPlanBytes=16*1024*1024){}
 get bytes(){return this.retainedBytes;}
 clear(){this.plans.clear();this.retainedBytes=0;}
 /** Tokens retain no sample arrays. Pending/ready source refreshes can check
  * exact mutable geometry without restarting an unchanged rendering job. */
 sourceToken(stroke:InkStroke){return this.plan(stroke).token;}
 private matches(stroke:InkStroke,plan:Plan){
  if(plan.immutable)return true;
  if(plan.width!==stroke.width||plan.points.length!==stroke.points.length*3)return false;
  for(let i=0;i<stroke.points.length;i++){const p=stroke.points[i],at=i*3;if(p[0]!==plan.points[at]||p[1]!==plan.points[at+1]||p[2]!==plan.points[at+2])return false;}
  return true;
 }
 private plan(stroke:InkStroke){
  let plan=this.plans.get(stroke);if(plan&&this.matches(stroke,plan)){this.plans.delete(stroke);this.plans.set(stroke,plan);return plan;}
  if(plan){this.plans.delete(stroke);this.retainedBytes-=plan.bytes;}
  const immutable=Object.isFrozen(stroke)&&Object.isFrozen(stroke.points)&&stroke.points.every(Object.isFrozen),points=immutable?new Float64Array(0):new Float64Array(stroke.points.length*3);
  if(!immutable)for(let i=0;i<stroke.points.length;i++){const p=stroke.points[i],at=i*3;points[at]=p[0];points[at+1]=p[1];points[at+2]=p[2];}
  // Charge retained source objects as well as XYZ comparison samples and the
  // worst-case fragment arrays before constructing them. This is conservative
  // object accounting, separate from the unchanged 32 MiB SVG path budget.
  const bytes=256+retainedInkStrokeBytes(stroke)+points.byteLength+stroke.points.length*16+Math.ceil(stroke.points.length/INK_VECTOR_FRAGMENT_POINTS)*256;
  plan={token:{},width:stroke.width,points,immutable,bytes,bounds:inkBounds({version:1,strokes:[stroke]})};
  if(bytes<=this.maxPlanBytes){while(this.plans.size&&this.retainedBytes+bytes>this.maxPlanBytes){const first=this.plans.keys().next().value!;this.retainedBytes-=this.plans.get(first)!.bytes;this.plans.delete(first);}this.plans.set(stroke,plan);this.retainedBytes+=bytes;}
  return plan;
 }
 private fragments(stroke:InkStroke,plan:Plan){
  if(plan.fragments)return plan.fragments;
  const fragments:Fragment[]=[];
  for(let from=0;from<stroke.points.length;from+=INK_VECTOR_FRAGMENT_POINTS){
   const to=Math.min(stroke.points.length,from+INK_VECTOR_FRAGMENT_POINTS);
   // Include the predecessor: the original segment crossing a boundary must
   // retain both its tangent quadrilateral and pressure-dependent end disks.
   const fragment:InkStroke={id:stroke.id,color:stroke.color,width:stroke.width,points:stroke.points.slice(Math.max(0,from-1),to)},bounds=inkBounds({version:1,strokes:[fragment]});
   if(!bounds)continue;
   if(plan.immutable){Object.freeze(fragment.points);Object.freeze(fragment);}
   fragments.push({stroke:fragment,bounds,from,to});
  }
  plan.fragments=fragments;return fragments;
 }
 project(stroke:InkStroke,clip:InkBounds|undefined,previous?:InkProjectionCursor,virtualizeShort=false):InkPathProjection {
  // Short strokes keep the established single-path/cache behavior without a
  // planning scan or extra sample snapshot.
  if(!virtualizeShort&&stroke.points.length<=INK_VECTOR_CULL_MIN_POINTS)return{path:this.cache.get(stroke),fragmentCount:1,projectedSamples:stroke.points.length,allVisible:true};
  const plan=this.plan(stroke),intersects=!!clip&&!!plan.bounds&&overlaps(plan.bounds,clip),full=intersects&&(stroke.points.length<=INK_VECTOR_CULL_MIN_POINTS||contains(clip,plan.bounds!));
  // Fully visible and fully hidden strokes need no fragmented sample arrays.
  const fragments=intersects&&!full?this.fragments(stroke,plan).filter(part=>overlaps(part.bounds,clip)):[],allVisible=full||intersects&&fragments.length===plan.fragments?.length;
  const ranges=allVisible?'all':fragments.map(part=>part.from).join(','),cursor={plan:plan.token,ranges};
  const projectedSamples=allVisible?stroke.points.length:fragments.reduce((sum,part)=>sum+part.to-part.from,0),fragmentCount=allVisible?1:fragments.length;
  // Keep only a membership cursor in the view. Joined megabyte strings are not
  // retained in a second cache; unchanged membership needs no new SVG value.
  if(previous?.plan===plan.token&&previous.ranges===ranges)return{cursor,fragmentCount,projectedSamples,allVisible};
  // All-visible/fit uses the unchanged full encoder and its existing budget.
  // Concatenated fragments remain one nonzero-filled SVG path, so duplicate
  // boundary disks cannot compound selection opacity or create paint seams.
  const path=allVisible?this.cache.get(stroke):fragments.map(part=>this.cache.get(part.stroke)).join('');
  return{path,cursor,fragmentCount,projectedSamples,allVisible};
 }
}
