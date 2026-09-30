import type {Card} from './model';

export type SectionResizeEdge='top'|'right'|'bottom'|'left';
/** Resize the frame only. Its opposite edge and every child keep their position. */
export function resizedSection(original:Card,dx:number,dy:number,edge:SectionResizeEdge){
 const unchanged={x:original.x,y:original.y,width:original.width,height:original.height};
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return unchanged;
 const next={...unchanged},minWidth=Math.min(180,original.width),minHeight=Math.min(100,original.height);
 if(edge==='left'){next.width=Math.max(minWidth,original.width-dx);next.x=original.x+original.width-next.width;}
 else if(edge==='right')next.width=Math.max(minWidth,original.width+dx);
 else if(edge==='top'){next.height=Math.max(minHeight,original.height-dy);next.y=original.y+original.height-next.height;}
 else if(edge==='bottom')next.height=Math.max(minHeight,original.height+dy);
 return Object.values(next).every(Number.isFinite)?next:unchanged;
}

/** Call with visible nodes. Prefer the innermost frame; the last painted wins ties.
 * A locked frame is still a hit, so double-click cannot create a note through it. */
export function sectionAtPoint(nodes:readonly Card[],point:{x:number;y:number}):Card|undefined{
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
 let found:Card|undefined;
 for(const node of nodes){
  if(node.kind!=='section'||node.collapsed||node.branchFolded||node.sectionFolded)continue;
  if(point.x<node.x||point.y<node.y||point.x>node.x+node.width||point.y>node.y+node.height)continue;
  if(!found||node.width*node.height<=found.width*found.height)found=node;
 }
 return found;
}
