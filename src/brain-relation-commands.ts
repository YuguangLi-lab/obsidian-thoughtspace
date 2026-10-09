import type {Command} from 'obsidian';
import {brainRelationLabels,type BrainRelationSide} from './brain-board-create';

export interface BrainRelationCommandTarget {
 editing:boolean;
 canRun:(side:BrainRelationSide)=>boolean;
 run:(side:BrainRelationSide)=>void;
}
/** Obsidian owns shortcut bindings; no defaults or document keyboard handlers. */
export function brainRelationCommands(resolve:(checking:boolean)=>BrainRelationCommandTarget|undefined):Command[]{
 const definitions:readonly [BrainRelationSide,string][]=[['top','parent'],['bottom','child'],['left','left-associated'],['right','right-associated']];
 return definitions.map(([side,id])=>({id:`brain-add-${id}`,name:`脑图：${brainRelationLabels[side]}`,icon:'plus',checkCallback:checking=>{
  const target=resolve(checking);if(!target||target.editing||!target.canRun(side))return false;
  if(!checking)target.run(side);return true;
 }}));
}
