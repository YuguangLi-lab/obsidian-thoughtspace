import type {Board,Card} from './model';
/** Only these fields belong to a drag; note content and styling always stay live. */
export function dragGeometry(node:Card,resize=false):Partial<Card>{
 return resize?{width:node.width,height:node.height,autoSize:node.autoSize,autoFit:node.autoFit}:{x:node.x,y:node.y};
}
export function dragDisplayBoard(board:Board,drafts?:ReadonlyMap<string,Card>,resize=false):Board{
 if(!drafts?.size)return board;
 return {...board,nodes:board.nodes.map(n=>{const draft=drafts.get(n.id);return draft&&!n.locked?{...n,...dragGeometry(draft,resize)}:n;})};
}
/** Validate all targets before committing anything; a shared edit must not be overwritten. */
export function dragCommitChanges(board:Board,originals:ReadonlyMap<string,Card>,drafts:ReadonlyMap<string,Card>,resize=false){
 const changes=new Map<string,Partial<Card>>(),found=new Set<string>();
 for(const node of board.nodes){const draft=drafts.get(node.id);if(!draft)continue;found.add(node.id);const original=originals.get(node.id);
  if(!original||node.locked||node.kind!==original.kind||['x','y','width','height'].some(key=>node[key as keyof Card]!==original[key as keyof Card])||resize&&(node.autoFit!==original.autoFit||node.autoSize!==original.autoSize))throw Error('对象的位置、尺寸或锁定状态已改变，本次拖动已取消');
  const patch=dragGeometry(draft,resize);if(Object.entries(patch).some(([key,value])=>node[key as keyof Card]!==value))changes.set(node.id,patch);
 }
 if(found.size!==drafts.size)throw Error('拖动对象已被移除，本次拖动已取消');
 return changes;
}

/** Gesture input only. Card/Edge fields are scalar; copy records while sharing immutable strings.
 * Board writing/history metadata is unrelated to geometry and is never restored from this snapshot. */
export function dragStartSnapshot(board:Board):Board{
 return {version:board.version,mode:board.mode,mindmapDirection:board.mindmapDirection,nodes:board.nodes.map(n=>({...n})),edges:board.edges.map(e=>({...e})),viewport:{...board.viewport}};
}
