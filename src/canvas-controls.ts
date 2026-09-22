import {Board} from './model';
export const gridSteps=[8,16,24,32,48,64] as const;
/** The preview and the final snap share the same anchor and delta. */
export function gridLanding(board:Board,ids:ReadonlySet<string>,step:number,excludeAxes?:ReadonlySet<'x'|'y'>){
 if(!Number.isFinite(step)||step<=0)throw Error('网格间距必须为正数');
 const anchor=board.nodes.find(n=>ids.has(n.id)&&!n.locked);if(!anchor)return;
 const x=excludeAxes?.has('x')?anchor.x:Math.round(anchor.x/step)*step,y=excludeAxes?.has('y')?anchor.y:Math.round(anchor.y/step)*step;
 return {x,y,dx:x-anchor.x,dy:y-anchor.y};
}
/** Show aligned major lines when zoomed out; snapping still uses the base step. */
export function visibleGridSize(step:number,zoom:number){
 if(!Number.isFinite(step)||step<=0||!Number.isFinite(zoom)||zoom<=0)return 16;
 const pixels=step*zoom;
 return pixels*Math.pow(2,Math.max(0,Math.ceil(Math.log2(12/pixels))));
}
