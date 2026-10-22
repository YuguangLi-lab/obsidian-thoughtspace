export interface CollectionTaskSummary {total:number;done:number;}
export type CollectionTaskFilter='all'|'any'|'todo'|'done'|'none';
type NativeTaskCache={listItems?:readonly {task?:string}[]};

/** Use the host's Markdown index, which already distinguishes nested task
 * items from plain lists, frontmatter and code. No body reader or text parser. */
export function collectionTaskSummary(cache:NativeTaskCache|null|undefined):CollectionTaskSummary|undefined {
 if(!cache)return;
 let total=0,done=0;
 for(const item of cache.listItems||[]){
  if(typeof item.task!=='string')continue;
  total++;if(item.task==='x'||item.task==='X')done++;
 }
 return{total,done};
}
export function isCollectionTaskFilter(value:unknown):value is CollectionTaskFilter {
 return typeof value==='string'&&['all','any','todo','done','none'].includes(value);
}
/** Missing or malformed metadata is unknown, never "no tasks" or "finished".
 * A custom task marker remains unfinished until the native marker is x/X. */
export function matchesCollectionTasks(summary:CollectionTaskSummary|undefined,filter:CollectionTaskFilter):boolean {
 if(filter==='all')return true;
 if(!summary||!Number.isSafeInteger(summary.total)||!Number.isSafeInteger(summary.done)||summary.total<0||summary.done<0||summary.done>summary.total)return false;
 if(filter==='none')return summary.total===0;
 if(filter==='any')return summary.total>0;
 if(filter==='todo')return summary.total>summary.done;
 return filter==='done'&&summary.total>0&&summary.done===summary.total;
}
