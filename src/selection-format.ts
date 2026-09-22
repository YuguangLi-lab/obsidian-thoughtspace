import type {Board} from './model';
/** Geometry and note content do not change format controls. Keep open native menus alive during pan. */
export function selectionFormatKey(board:Board|undefined,selected:ReadonlySet<string>,edgeId:string|undefined,blocked=false):string{
 const edge=edgeId?board?.edges.find(e=>e.id===edgeId):undefined;
 if(edge)return JSON.stringify([blocked,'edge',edge]);
 if(!selected.size)return JSON.stringify([blocked,'nodes',[]]);
 const nodes=board?.nodes.filter(n=>selected.has(n.id)).map(n=>[n.id,n.kind,n.file,n.locked,n.fontFamily,n.fontSize,n.textColor,n.textAlign,n.color,n.fillColor,n.transparent,n.customBorder,n.borderStyle,n.borderWidth])||[];
 return JSON.stringify([blocked,'nodes',nodes]);
}
