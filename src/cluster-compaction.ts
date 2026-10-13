import {Board,Card,assertBoardGeometry,selectionExpansion} from './model';
import {branchState} from './mindmap';
import {sectionContains} from './sections';

export interface PreservedClusters {context:string;groups:string[][]}

/** This option owns exactly the selected objects. A hidden unit cannot enlarge it. */
export function clusterCompactionSource(board:Board,ids:ReadonlySet<string>):Card[]{
 assertBoardGeometry(board);
 const selected=board.nodes.filter(n=>ids.has(n.id));
 if(selected.length!==ids.size)throw Error('所选对象已删除，请重新选择');
 if(selected.length<2||selected.length>1000)throw Error('请选择 2–1000 个内容对象');
 if(selected.some(n=>n.kind==='section'))throw Error('保留簇内位置不移动分组框，请选择框内内容或内层分组范围');
 if(selected.some(n=>n.locked))throw Error('选区含锁定对象；保留簇内位置需先解锁或取消选择锁定对象');
 const frames=board.nodes.filter(n=>n.kind==='section');
 if(frames.some(frame=>frame.locked&&selected.some(n=>sectionContains(frame,n))))throw Error('选区位于锁定分组内，请先解锁该分组');
 const {hidden}=branchState(board),ownedHidden=new Set<string>();let expansion:ReturnType<typeof selectionExpansion>|undefined;
 for(const root of selected)if(root.branchFolded&&!hidden.has(root.id)){
  expansion??=selectionExpansion(board);const complete=expansion.expand(new Set([root.id]));
  if([...complete].some(id=>!ids.has(id)))throw Error('折叠分支未完整选中，请先展开并选择全部成员；不会自动移动未选内容');
  for(const id of complete)ownedHidden.add(id);
 }
 if(selected.some(n=>hidden.has(n.id)&&!ownedHidden.has(n.id)))throw Error('所选内容被分组或其他分支折叠，请先展开后整理');
 return selected;
}

/** The complete geometry/fold/topology context guards spatial group membership,
 * outside selection edges and asynchronously resized obstacles before any write. */
export function clusterCompactionContext(board:Board):string{
 return JSON.stringify([board.nodes.map(n=>[n.id,n.kind,n.x,n.y,n.width,n.height,!!n.locked,!!n.branchFolded,!!n.sectionFolded,!!n.collapsed,n.file,n.paragraphQuote?.path,n.paragraphQuote?.subpath]),board.edges.map(e=>JSON.stringify([e.id,e.from,e.to,e.kind||'',e.direction||''])).sort()]);
}

/** Cross-selection edges remain intact, but only selected endpoints form a cluster. */
export function clusterComponents(board:Board,nodes:readonly Card[]):string[][]{
 const parent=new Map(nodes.map(n=>[n.id,n.id]));
 const root=(id:string)=>{let at=id;while(parent.get(at)!==at)at=parent.get(at)!;while(id!==at){const next=parent.get(id)!;parent.set(id,at);id=next;}return at;};
 for(const e of board.edges)if(parent.has(e.from)&&parent.has(e.to)){const a=root(e.from),b=root(e.to);if(a!==b)parent.set(b,a);}
 const groups=new Map<string,string[]>();for(const n of nodes){const key=root(n.id),group=groups.get(key)||[];group.push(n.id);groups.set(key,group);}return [...groups.values()];
}

/** Existing frames never acquire or lose a selected member. A selected frame
 * scope is separately fitted and checked by the planner's group transaction. */
export function validateClusterMembership(board:Board,items:readonly Card[],fittedFrameId?:string):void{
 const originals=new Map(board.nodes.map(n=>[n.id,n]));
 for(const frame of board.nodes)if(frame.kind==='section'&&frame.id!==fittedFrameId)for(const next of items){
  const original=originals.get(next.id)!;
  if(sectionContains(frame,original)!==sectionContains(frame,next))throw Error('整理会改变分组归属，请选择内层分组范围或调整选区/间距');
 }
}

/** Validate all cluster translations, not just a partial prefix of the preview. */
export function validatePreservedClusters(board:Board,ids:ReadonlySet<string>,items:readonly Card[],proof:PreservedClusters,fittedFrameId?:string):void{
 if(clusterCompactionContext(board)!==proof.context)throw Error('白板位置、尺寸、锁定、分组或连线已变化，请重新预览');
 const source=clusterCompactionSource(board,ids),canonical=(groups:string[][])=>JSON.stringify(groups.map(group=>[...group].sort()).sort((a,b)=>a[0].localeCompare(b[0])));
 if(canonical(clusterComponents(board,source))!==canonical(proof.groups))throw Error('连接簇预览无效，请重新生成');
 const originals=new Map(source.map(n=>[n.id,n])),nextById=new Map(items.map(n=>[n.id,n]));
 if(nextById.size!==source.length||items.length!==source.length||items.some(n=>!originals.has(n.id)||![n.x,n.y,n.width,n.height].every(Number.isFinite)))throw Error('连接簇预览无效，请重新生成');
 for(const group of proof.groups){let dx:number|undefined,dy:number|undefined;for(const id of group){const old=originals.get(id)!,next=nextById.get(id)!;
  if(next.kind!==old.kind||next.width!==old.width||next.height!==old.height)throw Error('连接簇尺寸已变化，请重新预览');
  const x=next.x-old.x,y=next.y-old.y;if(dx===undefined){dx=x;dy=y;}else if(Math.abs(x-dx)>1e-6||Math.abs(y-dy!)>1e-6)throw Error('连接簇内部位置已变化，请重新预览');
 }}
 validateClusterMembership(board,items,fittedFrameId);
}
