import {strokePath,type InkStroke} from './ink-model';
import {retainedInkStrokeBytes} from './handwriting-history';

interface CachedPath {path:string;width:number;points:Float64Array;immutable:boolean;bytes:number;}
/** Bounded exact-content SVG cache; IDs alone never identify geometry. */
export class InkPathCache {
 private entries=new Map<InkStroke,CachedPath>();
 private retainedBytes=0;
 encodings=0;
 hits=0;
 constructor(readonly maxBytes=32*1024*1024){}
 get bytes(){return this.retainedBytes;}
 clear(){this.entries.clear();this.retainedBytes=0;}
 get(stroke:InkStroke):string {
  const cached=this.entries.get(stroke);
  if(cached&&this.matches(stroke,cached)){
   this.hits++;this.entries.delete(stroke);this.entries.set(stroke,cached);return cached.path;
  }
  if(cached){this.entries.delete(stroke);this.retainedBytes-=cached.bytes;}
  const path=strokePath(stroke);this.encodings++;
  const immutable=Object.isFrozen(stroke)&&Object.isFrozen(stroke.points)&&stroke.points.every(Object.isFrozen);
  const points=immutable?new Float64Array(0):Float64Array.from(stroke.points.flat());
  // Include retained input samples even if another owner also holds them. This
  // bounds the cache independently of the history budget and weak ownership.
  const bytes=128+path.length*2+points.byteLength+retainedInkStrokeBytes(stroke);
  if(bytes<=this.maxBytes){
   while(this.entries.size&&this.retainedBytes+bytes>this.maxBytes){const key=this.entries.keys().next().value!;this.retainedBytes-=this.entries.get(key)!.bytes;this.entries.delete(key);}
   this.entries.set(stroke,{path,width:stroke.width,points,immutable,bytes});this.retainedBytes+=bytes;
  }
  return path;
 }
 private matches(stroke:InkStroke,cached:CachedPath){
  if(cached.immutable)return true;
  if(stroke.width!==cached.width||stroke.points.length*3!==cached.points.length)return false;
  for(let i=0;i<stroke.points.length;i++){const point=stroke.points[i],at=i*3;if(point[0]!==cached.points[at]||point[1]!==cached.points[at+1]||point[2]!==cached.points[at+2])return false;}
  return true;
 }
}
