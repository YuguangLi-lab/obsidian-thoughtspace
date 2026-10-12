import {BOARD_MINDMAP_EXPANDED_LIMIT} from './board-mindmap';
import {hasAsciiControl,isFiniteNumber,isRecord,isUnknownArray} from './value-guards';

export const BRAIN_READING_POSITIONS_LIMIT=50;
export interface BrainReadingPositionState {
 version:1;centerId:string;expandedIds:string[];depth:number;viewport:{x:number;y:number;zoom:number};
}
export interface BrainReadingPosition extends BrainReadingPositionState {id:string;name:string;}
declare module './model' {interface Board {brainReadingPositions?:BrainReadingPosition[];}}

const identifier=(value:unknown):value is string=>typeof value==='string'&&!!value&&value.length<=256&&value.trim()===value&&!hasAsciiControl(value)&&!value.includes(String.fromCharCode(127));
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));
export function validBrainReadingPositionState(value:unknown,named=false):value is BrainReadingPositionState {
 if(!isRecord(value)||!keys(value,named?['version','id','name','centerId','expandedIds','depth','viewport']:['version','centerId','expandedIds','depth','viewport'])||value.version!==1||!identifier(value.centerId)||!isUnknownArray(value.expandedIds)||value.expandedIds.length>BOARD_MINDMAP_EXPANDED_LIMIT||!value.expandedIds.every(identifier)||new Set(value.expandedIds).size!==value.expandedIds.length||!isFiniteNumber(value.depth)||!Number.isInteger(value.depth)||value.depth<1||value.depth>5)return false;
 const camera=value.viewport;if(!isRecord(camera)||!keys(camera,['x','y','zoom'])||![camera.x,camera.y,camera.zoom].every(isFiniteNumber)||!isFiniteNumber(camera.zoom)||camera.zoom<.15||camera.zoom>2.5)return false;
 return !named||identifier(value.id)&&typeof value.name==='string'&&!!value.name.trim()&&value.name.trim()===value.name&&value.name.length<=100&&!hasAsciiControl(value.name);
}
/** Missing node references survive deletions. Resolution, rather than parsing,
 * decides how to recover a saved place without changing note content. */
export function validBrainReadingPositions(value:unknown):value is BrainReadingPosition[] {
 return isUnknownArray(value)&&value.length<=BRAIN_READING_POSITIONS_LIMIT&&value.every(item=>validBrainReadingPositionState(item,true))&&new Set(value.map(item=>(item as BrainReadingPosition).id)).size===value.length;
}
