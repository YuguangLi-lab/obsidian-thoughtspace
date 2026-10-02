import type {ViewportInsets} from './viewport-fit';
export interface ScreenBox{x:number;y:number;width:number;height:number}
export function overlapsMinimap(a:ScreenBox,b:ScreenBox){return a.x+a.width>b.x-8&&a.x<b.x+b.width+8&&a.y+a.height>b.y-8&&a.y<b.y+b.height+8;}
/** Latch until the current edit/drag ends; crossing the edge never flickers. */
export class MinimapAvoidance {
 private interaction:unknown;private collided=false;private revealed=false;
 hidden=false;
 update(interaction:unknown,overlap:boolean){if(interaction!==this.interaction){this.interaction=interaction;this.collided=false;this.revealed=false;}if(interaction&&overlap)this.collided=true;this.hidden=!!interaction&&this.collided&&!this.revealed;return this.hidden;}
 reveal(){if(this.interaction)this.revealed=true;this.hidden=false;}
}
/** Reserve the less costly edge band for a corner overlay during explicit camera commands. */
export function minimapInsets(width:number,height:number,insets:ViewportInsets,map?:ScreenBox):ViewportInsets{
 if(!map||map.width<=0||map.height<=0)return insets;
 const right=Math.max(insets.right,width-map.x+12),bottom=Math.max(insets.bottom,height-map.y+12);
 const rightArea=Math.max(0,width-insets.left-right)*Math.max(0,height-insets.top-insets.bottom);
 const bottomArea=Math.max(0,width-insets.left-insets.right)*Math.max(0,height-insets.top-bottom);
 return rightArea>=bottomArea?{...insets,right}:{...insets,bottom};
}
