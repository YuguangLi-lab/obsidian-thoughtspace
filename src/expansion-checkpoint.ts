import type {Board,Card} from './model';
import {isRecord,isUnknownArray,isFiniteNumber} from './value-guards';

export const foldKeys=['collapsed','branchFolded','sectionFolded'] as const;
const geometryKeys=['x','y','width','height'] as const;
export interface ReadingGeometry {
 id:string;x:number;y:number;width:number;height:number;
 collapsed?:boolean;expandedHeight?:number;branchFolded?:boolean;sectionFolded?:boolean;
}
/** Only layout data is retained; note bodies and attachments are never duplicated. */
export interface ReadingLayoutCheckpoint {
 version:1;signature:string;base:ReadingGeometry[];applied:ReadingGeometry[];
}
export function readingGeometry(nodes:readonly Card[]):ReadingGeometry[]{
 return nodes.map(n=>({id:n.id,x:n.x,y:n.y,width:n.width,height:n.height,
  ...(n.collapsed?{collapsed:true,expandedHeight:n.expandedHeight}:{}),
  ...(n.branchFolded?{branchFolded:true}:{}),...(n.sectionFolded?{sectionFolded:true}:{})}));
}
export function sameReadingGeometry(nodes:readonly Card[],saved:readonly ReadingGeometry[]):boolean{
 return nodes.length===saved.length&&nodes.every((n,i)=>{const old=saved[i];return n.id===old.id&&geometryKeys.every(key=>n[key]===old[key])&&foldKeys.every(key=>!!n[key]===!!old[key])&&n.expandedHeight===old.expandedHeight;});
}
/** Layout-affecting edits invalidate recovery; content and visual styles do not. */
export function readingSignature(board:Board):string{
 return JSON.stringify([board.mode,board.mindmapDirection,board.mindmapLayout,board.mindmapDensity,
  board.nodes.map(n=>[n.id,n.kind,n.file,n.webUrl,!!n.locked,n.mindmapRules,n.autoFit,n.autoSize,n.textAutoHeight]),
  board.edges.map(e=>[e.id,e.from,e.to,e.kind])]);
}
/** A stale/invalid optional checkpoint must never make an otherwise valid board unreadable. */
export function validReadingCheckpoint(value:unknown,nodes:readonly Card[]):value is ReadingLayoutCheckpoint{
 if(!isRecord(value)||value.version!==1||typeof value.signature!=='string'||value.signature.length>8000000)return false;
 for(const entries of [value.base,value.applied]){
  if(!isUnknownArray(entries)||entries.length!==nodes.length)return false;
  for(let i=0;i<entries.length;i++){
   const n=entries[i],kind=nodes[i].kind;
   if(!isRecord(n)||n.id!==nodes[i].id||!geometryKeys.every(key=>isFiniteNumber(n[key]))||Number(n.width)<80||Number(n.height)<(kind==='text'?40:60))return false;
   if(foldKeys.some(key=>n[key]!==undefined&&typeof n[key]!=='boolean'))return false;
   if(n.collapsed&&(n.height!==72||!isFiniteNumber(n.expandedHeight)||n.expandedHeight<(kind==='text'?40:60)))return false;
   if(!n.collapsed&&n.expandedHeight!==undefined)return false;
  }
 }
 return true;
}
