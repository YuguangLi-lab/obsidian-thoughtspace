import type {Board,Card} from './model';
import {readingOrder} from './board-studio';
import {sectionMemberQuery} from './sections';
import {writingItems,writingOrder,writingParts} from './writing';

/** One synchronous list refresh. Never retain this across a board edit or undo. */
export function writingListData(board:Board){
 const items=writingItems(board),byId=new Map(items.map(node=>[node.id,node]));
 const order=writingOrder(board),parts=writingParts(board),used=new Set(parts.map(part=>part.node.id));
 const chapters=new Map((board.writing?.chapters||[]).map(chapter=>[chapter.id,chapter]));
 const summaries=new Map<string,{children:Card[];included:number}>();
 let members:ReturnType<typeof sectionMemberQuery>|undefined;
 const group=(id:string)=>{
  const cached=summaries.get(id);if(cached)return cached;
  const node=byId.get(id),seen=new Set([id]);
  const children=node?.kind==='section'?readingOrder((members??=sectionMemberQuery(board.nodes))(node).filter(child=>child.kind==='card'||child.kind==='text'||child.kind==='image')).filter(child=>{if(seen.has(child.id))return false;seen.add(child.id);return true;}):[];
  const included=board.writing?.options?.[id]?.excluded?0:children.filter(child=>!board.writing?.options?.[child.id]?.excluded).length;
  const summary={children,included};summaries.set(id,summary);return summary;
 };
 return {items,byId,order,parts,used,chapters,group};
}
