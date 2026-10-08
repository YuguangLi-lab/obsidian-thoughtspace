import type {BrainBoardLayout} from './brain-board-layout';
import type {BrainRelationSide} from './brain-board-create';

export interface BrainScreenRect {x:number;y:number;width:number;height:number}
type Rect=BrainScreenRect;
const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
/** Screen-space hit targets stay outside native titles and reading bodies at every
 * zoom. This bounded projection uses cached layout data, never layout reads on pan. */
export function brainScreenObstacles(layout:BrainBoardLayout,camera:{x:number;y:number;zoom:number}):BrainScreenRect[]{
 const z=camera.zoom,rect=(x:number,y:number,width:number,height:number):Rect=>({x:camera.x+x*z,y:camera.y+y*z,width:width*z,height:height*z});
 return layout.nodes.flatMap(node=>[rect(node.x,node.y,node.width,node.height),...(node.previewWidth?[rect(node.x+node.width/2-node.previewWidth/2,node.y+node.height+12,node.previewWidth,200)]:[])]);
}
export function brainPortPositions(layout:BrainBoardLayout,camera:{x:number;y:number;zoom:number},size:{width:number;height:number},obstacles:readonly BrainScreenRect[]=brainScreenObstacles(layout,camera)){
 const center=layout.nodes.find(node=>node.role==='center'),result=new Map<BrainRelationSide,{x:number;y:number}>();
 if(!center)return result;
 const z=camera.zoom;
 const width=Math.max(center.width,center.previewWidth||0),left=camera.x+(center.x+center.width/2-width/2)*z,right=left+width*z;
 const top=camera.y+center.y*z,bottom=top+(center.height+(center.previewWidth?212:0))*z,cx=(left+right)/2,cy=top+center.height*z/2;
 const used:Rect[]=[];
 for(const side of ['top','bottom','left','right'] as const){
  let target:Rect|undefined;
  for(const distance of [0,8,24,48,80,128]){
   for(const shift of [0,-36,36,-72,72]){
    const candidate={x:side==='left'?left-34-distance:side==='right'?right+2+distance:cx-16+shift,y:side==='top'?top-34-distance:side==='bottom'?bottom+2+distance:cy-16+shift,width:32,height:32};
    if(candidate.x<2||candidate.y<2||candidate.x+32>size.width-2||candidate.y+32>size.height-2)continue;
    if(obstacles.some(value=>overlaps(candidate,value))||used.some(value=>overlaps(candidate,value)))continue;
    target=candidate;break;
   }
   if(target)break;
  }
  if(target){used.push(target);result.set(side,{x:(target.x-camera.x)/z-center.x,y:(target.y-camera.y)/z-center.y});}
 }
 return result;
}
