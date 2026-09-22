import {Card} from './model';
export interface DragTarget{id:string;index:number;}
/** Build once per gesture, then touch only the objects being moved or resized. */
export function dragTargets(nodes:readonly Card[],ids:ReadonlySet<string>,resize?:string):DragTarget[]{
 const result:DragTarget[]=[];for(let index=0;index<nodes.length;index++){const n=nodes[index];if(resize?n.id===resize:ids.has(n.id))result.push({id:n.id,index});}return result;
}
/** Resolve live objects, including replacements or reordering during an update. */
export function* activeDragTargets(nodes:readonly Card[],targets:readonly DragTarget[]){
 for(const target of targets){const n=nodes[target.index]?.id===target.id?nodes[target.index]:nodes.find(n=>n.id===target.id);if(n&&!n.locked)yield n;}
}
