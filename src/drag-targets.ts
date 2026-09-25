import {Card} from './model';
export interface DragTarget{id:string;index:number;}
/** Build once per gesture, then touch only the objects being moved or resized. */
export function dragTargets(nodes:readonly Card[],ids:ReadonlySet<string>,resize?:string):DragTarget[]{
 const result:DragTarget[]=[];for(let index=0;index<nodes.length;index++){const n=nodes[index];if(resize?n.id===resize:ids.has(n.id))result.push({id:n.id,index});}return result;
}
/** Resolve live objects, including replacements or reordering during an update. */
export function* activeDragTargets(nodes:readonly Card[],targets:readonly DragTarget[]){
 for(const target of targets){
  // Refresh the hint after a reorder, but validate it and read the live object every time.
  if(nodes[target.index]?.id!==target.id)target.index=nodes.findIndex(n=>n.id===target.id);
  const n=nodes[target.index];if(n&&!n.locked)yield n;
 }
}
