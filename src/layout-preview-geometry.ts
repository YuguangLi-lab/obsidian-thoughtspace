export interface PreviewRect{x:number;y:number;width:number;height:number}
export interface PreviewCamera{zoom:number;pan:{x:number;y:number}}
export const MAX_PREVIEW_ZOOM=32;
/** Both scenes share the union, so a toggle cannot rescale an unchanged card. */
export function comparisonPreviewBounds(before:readonly PreviewRect[],after:readonly PreviewRect[]):PreviewRect{
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const scene of [before,after])for(const rect of scene){
  left=Math.min(left,rect.x);top=Math.min(top,rect.y);
  right=Math.max(right,rect.x+rect.width);bottom=Math.max(bottom,rect.y+rect.height);
 }
 if(left===Infinity)return {x:0,y:0,width:1,height:1};
 // Leave room for lane labels above the objects and the shared viewport controls.
 return {x:left-30,y:top-75,width:right-left+60,height:bottom-top+110};
}
export function previewViewBox(base:PreviewRect,camera:PreviewCamera):PreviewRect{
 const width=base.width/camera.zoom,height=base.height/camera.zoom;
 return {x:base.x+(base.width-width)/2+camera.pan.x,y:base.y+(base.height-height)/2+camera.pan.y,width,height};
}
/** Rebase a manually panned/zoomed view without moving its world center. */
export function rebasePreviewCamera(base:PreviewRect,next:PreviewRect,camera:PreviewCamera,aspect:number):PreviewCamera{
 if(camera.zoom===1&&camera.pan.x===0&&camera.pan.y===0)return camera;
 const ratio=Number.isFinite(aspect)&&aspect>0?aspect:1;
 const fit=(r:PreviewRect)=>Math.max(r.width,r.height*ratio);
 return {
  zoom:Math.max(1,Math.min(MAX_PREVIEW_ZOOM,camera.zoom*fit(next)/fit(base))),
  pan:{x:camera.pan.x+base.x+base.width/2-next.x-next.width/2,y:camera.pan.y+base.y+base.height/2-next.y-next.height/2}
 };
}
/** One corner per changed item works for both individual SVG cards and batch paths. */
export function previewMoveCorner(rect:PreviewRect):string{
 const side=Math.min(16,rect.width/4,rect.height/4);
 return `M${rect.x+3},${rect.y+3+side}v${-side}h${side}`;
}
export function focusPreviewRect(base:PreviewRect,target:PreviewRect,aspect:number):PreviewCamera{
 const ratio=Number.isFinite(aspect)&&aspect>0?aspect:1;
 const width=Math.max(base.width,base.height*ratio),height=Math.max(base.height,base.width/ratio);
 return {zoom:Math.max(1,Math.min(MAX_PREVIEW_ZOOM,width/(target.width+80),height/(target.height+80))),pan:{x:target.x+target.width/2-base.x-base.width/2,y:target.y+target.height/2-base.y-base.height/2}};
}
/** Keep the world point under the pointer fixed when zooming. */
export function zoomPreviewAt(base:PreviewRect,camera:PreviewCamera,factor:number,point?:{x:number;y:number}):PreviewCamera{
 const zoom=Math.max(1,Math.min(MAX_PREVIEW_ZOOM,camera.zoom*factor));
 const center={x:base.x+base.width/2,y:base.y+base.height/2};
 const target=point||{x:center.x+camera.pan.x,y:center.y+camera.pan.y};
 const ratio=camera.zoom/zoom;
 return {zoom,pan:{x:target.x+(center.x+camera.pan.x-target.x)*ratio-center.x,y:target.y+(center.y+camera.pan.y-target.y)*ratio-center.y}};
}
/** Preview-only curves: clip endpoints to object bounds without modifying real edges. */
export function previewConnection(a:PreviewRect,b:PreviewRect):string{
 const ax=a.x+a.width/2,ay=a.y+a.height/2,bx=b.x+b.width/2,by=b.y+b.height/2,dx=bx-ax,dy=by-ay;
 if(!dx&&!dy)return '';
 const t=(r:PreviewRect)=>Math.min(dx?r.width/2/Math.abs(dx):Infinity,dy?r.height/2/Math.abs(dy):Infinity);
 const ta=t(a),tb=t(b);if(ta+tb>=1)return ''; // Overlapping boxes have no visible gap.
 const x1=ax+dx*ta,y1=ay+dy*ta,x2=bx-dx*tb,y2=by-dy*tb;
 if(Math.abs(dx)>=Math.abs(dy)){const mid=(x1+x2)/2;return `M${x1},${y1}C${mid},${y1} ${mid},${y2} ${x2},${y2}`;}
 const mid=(y1+y2)/2;return `M${x1},${y1}C${x1},${mid} ${x2},${mid} ${x2},${y2}`;
}
