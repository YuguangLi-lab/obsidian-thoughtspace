import type {InkBounds} from './ink-model';
import type {HandwritingRect,HandwritingViewport} from './handwriting-input';

export interface InkActionViewport {offsetLeft:number;offsetTop:number;width:number;height:number}
export interface InkActionSafeArea {left:number;top:number;right:number;bottom:number}
export interface InkActionPosition {left:number;top:number}
const finite=(values:readonly number[])=>values.every(Number.isFinite);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Screen-sized controls belong to the visible part of their own stage/window,
 * never to the zoomed ink world. A hidden/offscreen selection has no actions. */
export function inkSelectionActionPosition(stage:HandwritingRect,selection:InkBounds,camera:HandwritingViewport,size:{width:number;height:number},visible:InkActionViewport,safe:InkActionSafeArea={left:0,top:0,right:0,bottom:0}):InkActionPosition|undefined {
 if(!finite([stage.left,stage.top,stage.width,stage.height,selection.x,selection.y,selection.width,selection.height,camera.x,camera.y,camera.zoom,size.width,size.height,visible.offsetLeft,visible.offsetTop,visible.width,visible.height,safe.left,safe.top,safe.right,safe.bottom])||camera.zoom<=0||stage.width<=0||stage.height<=0||selection.width<0||selection.height<0||size.width<=0||size.height<=0||visible.width<=0||visible.height<=0)return;
 const gap=8,left=Math.max(stage.left,visible.offsetLeft+Math.max(0,safe.left))+gap,top=Math.max(stage.top,visible.offsetTop+Math.max(0,safe.top))+gap;
 const right=Math.min(stage.left+stage.width,visible.offsetLeft+visible.width-Math.max(0,safe.right))-gap,bottom=Math.min(stage.top+stage.height,visible.offsetTop+visible.height-Math.max(0,safe.bottom))-gap;
 if(right-left<size.width||bottom-top<size.height)return;
 const x=stage.left+camera.x+selection.x*camera.zoom,y=stage.top+camera.y+selection.y*camera.zoom,width=selection.width*camera.zoom,height=selection.height*camera.zoom;
 if(!finite([x,y,width,height])||x+width<left||x>right||y+height<top||y>bottom)return;
 const center=(Math.max(x,left)+Math.min(x+width,right))/2;
 const above=y-gap-size.height,below=y+height+gap;
 const preferred=above>=top?above:below+size.height<=bottom?below:clamp(above,top,bottom-size.height);
 return{left:clamp(center-size.width/2,left,right-size.width)-stage.left,top:clamp(preferred,top,bottom-size.height)-stage.top};
}
