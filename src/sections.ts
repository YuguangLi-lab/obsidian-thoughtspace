import {Card} from './model';
export interface SectionRect {x:number;y:number;width:number;height:number;}
export function validSectionRect(r:SectionRect):boolean{return [r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>=80&&r.height>=60;}
// One pass: no membership cache or per-frame observers; membership follows geometry.
export function sectionBounds(nodes:readonly Card[]):SectionRect|undefined{
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const n of nodes){if(n.kind==='section')continue;left=Math.min(left,n.x);top=Math.min(top,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}
 return left===Infinity?undefined:{x:left-30,y:top-60,width:right-left+60,height:bottom-top+90};
}
