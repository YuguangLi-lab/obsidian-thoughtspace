import type {CardControlRect,CardControlViewport} from './card-control-layout';
interface FoldNode extends CardControlRect {id:string;kind?:string}
/** Project only nearby mounted objects; never scan the full board on hover.
 * Group interiors remain usable. Their frame edges still reserve hit space.
 */
export function foldControlObstacles(node:FoldNode,nodes:ReadonlyArray<FoldNode>,view:CardControlViewport):CardControlRect[]{
 const z=view.zoom;if(!Number.isFinite(z)||z<=0)return [];
 const x=node.x*z+view.x,y=node.y*z+view.y,w=node.width*z,h=node.height*z,margin=8;
 const result:CardControlRect[]=[];
 for(const other of nodes){
  if(other.id===node.id)continue;
  const rect={x:other.x*z+view.x-margin,y:other.y*z+view.y-margin,width:other.width*z+margin*2,height:other.height*z+margin*2};
  if(!Object.values(rect).every(Number.isFinite)||rect.width<=0||rect.height<=0)continue;
  if(rect.x>x+w+280||rect.x+rect.width<x-280||rect.y>y+h+180||rect.y+rect.height<y-180)continue;
  if(other.kind==='section'&&other.x<=node.x&&other.y<=node.y&&other.x+other.width>=node.x+node.width&&other.y+other.height>=node.y+node.height){
   result.push({...rect,height:margin*2},{...rect,y:rect.y+rect.height-margin*2,height:margin*2},{...rect,width:margin*2},{...rect,x:rect.x+rect.width-margin*2,width:margin*2});
  }else result.push(rect);
 }
 return result;
}
