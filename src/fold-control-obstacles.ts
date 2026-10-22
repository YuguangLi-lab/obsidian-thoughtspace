import type {CardControlRect,CardControlViewport} from './card-control-layout';
interface FoldNode extends CardControlRect {id:string;kind?:string;borderWidth?:number}
/** Project mounted objects; never scan the full board on hover. When a stage
 * is supplied, reserve every visible neighbour: a dock can move beyond its
 * subject's immediate neighbourhood while looking for an unobstructed slot.
 * Group interiors remain usable. Their frame edges still reserve hit space.
 */
export function foldControlObstacles(node:FoldNode,nodes:ReadonlyArray<FoldNode>,view:CardControlViewport,stage?:{width:number;height:number}):CardControlRect[]{
 const z=view.zoom;if(!Number.isFinite(z)||z<=0)return [];
 const x=node.x*z+view.x,y=node.y*z+view.y,w=node.width*z,h=node.height*z,margin=8;
 const result:CardControlRect[]=[];
 for(const other of nodes){
  if(other.id===node.id)continue;
  const rect={x:other.x*z+view.x-margin,y:other.y*z+view.y-margin,width:other.width*z+margin*2,height:other.height*z+margin*2};
  if(!Object.values(rect).every(Number.isFinite)||rect.width<=0||rect.height<=0)continue;
  const border=Number.isFinite(other.borderWidth)?Math.max(0,other.borderWidth!):2;
  const radius=15*z/Math.min(1,Math.max(.05,z))+Math.max(2,border*z);
  if(stage){
   const extra=Math.max(0,radius-margin);
   if(rect.x-extra>stage.width||rect.x+rect.width+extra<0||rect.y-extra>stage.height||rect.y+rect.height+extra<0)continue;
  }else if(rect.x>x+w+280||rect.x+rect.width<x-280||rect.y>y+h+180||rect.y+rect.height<y-180)continue;
  const containingGroup=other.kind==='section'&&other.x<=node.x&&other.y<=node.y&&other.x+other.width>=node.x+node.width&&other.y+other.height>=node.y+node.height;
  if(containingGroup){
   result.push({...rect,height:margin*2},{...rect,y:rect.y+rect.height-margin*2,height:margin*2},{...rect,width:margin*2},{...rect,x:rect.x+rect.width-margin*2,width:margin*2});
  }else result.push(rect);
  // Invisible connection buttons still receive pointer input. Their 30 px
  // CSS box stays screen-sized below 100%, then grows with the canvas. Match
  // applyViewport's --ts-port-scale and allow for the containing border.
  const left=other.x*z+view.x,top=other.y*z+view.y,right=left+other.width*z,bottom=top+other.height*z,cx=(left+right)/2,cy=(top+bottom)/2;
  if(containingGroup){
   for(const [x,y] of [[cx,top],[cx,bottom],[left,cy],[right,cy]])result.push({x:x-radius,y:y-radius,width:radius*2,height:radius*2});
  }else{
   // The body already blocks these strips' interiors. Two strips represent
   // the four external port bounds without four extra placement obstacles.
   if(right-left>=radius*2||bottom-top<=radius*2)result.push({x:cx-radius,y:top-radius,width:radius*2,height:bottom-top+radius*2});
   else for(const y of [top,bottom])result.push({x:cx-radius,y:y-radius,width:radius*2,height:radius*2});
   if(bottom-top>=radius*2||right-left<=radius*2)result.push({x:left-radius,y:cy-radius,width:right-left+radius*2,height:radius*2});
   else for(const x of [left,right])result.push({x:x-radius,y:cy-radius,width:radius*2,height:radius*2});
  }
 }
 return result;
}
