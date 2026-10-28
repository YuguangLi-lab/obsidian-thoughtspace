export interface CanvasBox {x:number;y:number;width:number;height:number}
/** Place shots beside their source, three columns at a time, without covering
 * authored objects. Coordinates stay in board space and do not depend on zoom. */
export function canvasFramePosition(source:CanvasBox,objects:readonly CanvasBox[],image:{width:number;height:number}){
 if(![source.x,source.y,source.width,image.width,image.height].every(Number.isFinite)||image.width<=0||image.height<=0)throw Error('截图尺寸无效');
 const width=Math.min(320,Math.max(160,source.width*.65)),height=Math.max(60,width*image.height/image.width),caption=72,gap=24;
 for(let slot=0;slot<objects.length*6+100;slot++){
  const box={x:source.x+source.width+48+slot%3*(width+gap),y:source.y+Math.floor(slot/3)*(height+caption+gap),width,height:height+caption};
  if(!objects.some(other=>other.x<box.x+box.width+8&&other.x+other.width>box.x-8&&other.y<box.y+box.height+8&&other.y+other.height>box.y-8))return {...box,imageHeight:height};
 }
 throw Error('截图附近空间不足，请移动部分对象后重试');
}
