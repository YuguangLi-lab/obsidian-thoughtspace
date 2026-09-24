import type {Board,Edge} from './model';
import {branchState} from './mindmap';
/** Recompute endpoint eligibility without indexing an unfolded board's branches. */
function edgeEditable(board:Board,edge:Edge):boolean{
 if(edge.from===edge.to)return false;
 let from=false,to=false,hasFolds=false;
 for(const node of board.nodes){
  if(!node.locked){if(node.id===edge.from)from=true;if(node.id===edge.to)to=true;}
  if(node.branchFolded||node.sectionFolded)hasFolds=true;
 }
 if(!from||!to)return false;
 if(!hasFolds)return true;
 const {hidden}=branchState(board);return !hidden.has(edge.from)&&!hidden.has(edge.to);
}
/** Geometry and note content do not change format controls. Keep open native menus alive during pan. */
export function selectionFormatKey(board:Board|undefined,selected:ReadonlySet<string>,edgeId:string|undefined,blocked=false,batch?:{target:'nodes'|'edges';scope:'internal'|'connected';edges:readonly Edge[]}):string{
 const edge=edgeId?board?.edges.find(e=>e.id===edgeId):undefined;
 if(edge&&board)return JSON.stringify([blocked,'edge',edge,edgeEditable(board,edge)]);
 if(!selected.size)return JSON.stringify([blocked,'nodes',[]]);
 const nodes=board?.nodes.filter(n=>selected.has(n.id)).map(n=>[n.id,n.kind,n.file,n.locked,n.fontFamily,n.fontSize,n.textColor,n.textAlign,n.color,n.fillColor,n.transparent,n.customBorder,n.borderStyle,n.borderWidth])||[];
 return JSON.stringify(batch?[blocked,'nodes',nodes,batch.target,batch.scope,batch.edges.map(e=>[e.id,e.style,e.direction,e.dashed,e.color])]:[blocked,'nodes',nodes]);
}
