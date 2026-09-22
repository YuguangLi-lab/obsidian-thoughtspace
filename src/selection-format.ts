import type {Board,Edge} from './model';
/** Geometry and note content do not change format controls. Keep open native menus alive during pan. */
export function selectionFormatKey(board:Board|undefined,selected:ReadonlySet<string>,edgeId:string|undefined,blocked=false,batch?:{target:'nodes'|'edges';scope:'internal'|'connected';edges:readonly Edge[]}):string{
 const edge=edgeId?board?.edges.find(e=>e.id===edgeId):undefined;
 if(edge)return JSON.stringify([blocked,'edge',edge]);
 if(!selected.size)return JSON.stringify([blocked,'nodes',[]]);
 const nodes=board?.nodes.filter(n=>selected.has(n.id)).map(n=>[n.id,n.kind,n.file,n.locked,n.fontFamily,n.fontSize,n.textColor,n.textAlign,n.color,n.fillColor,n.transparent,n.customBorder,n.borderStyle,n.borderWidth])||[];
 return JSON.stringify(batch?[blocked,'nodes',nodes,batch.target,batch.scope,batch.edges.map(e=>[e.id,e.style,e.direction,e.dashed,e.color])]:[blocked,'nodes',nodes]);
}
