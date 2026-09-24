import type {Board,Card,Edge} from './model';
import {branchState,validateBranches} from './mindmap';
export type BranchDisclosure='collapse'|'level'|'all';
/** Reveal one frontier per action. Existing hidden descendants are not expanded en masse. */
export function discloseBranches(board:Board,roots:ReadonlySet<string>,mode:BranchDisclosure){
 const {children}=branchState(board),byId=new Map(board.nodes.map(n=>[n.id,n]));
 const queue=[...roots].filter(id=>children.has(id)&&byId.has(id)),seen=new Set<string>();
 if(mode==='collapse'){for(const id of queue)byId.get(id)!.branchFolded=true;}
 else if(mode==='all'){for(let i=0;i<queue.length;i++){const id=queue[i];if(seen.has(id))continue;seen.add(id);delete byId.get(id)!.branchFolded;queue.push(...(children.get(id)||[]));}}
 else {for(let i=0;i<queue.length;i++){const id=queue[i];if(seen.has(id))continue;seen.add(id);const node=byId.get(id)!;
  if(node.branchFolded){delete node.branchFolded;for(const child of children.get(id)||[])if(children.has(child)){byId.get(child)!.branchFolded=true;seen.add(child);}}
  else queue.push(...(children.get(id)||[]));
 }}
 board.version=3;
}
/** A relation becomes a collapsible child link only if the resulting forest is valid. */
export function makeChildConnection(board:Board,edgeId:string){
 const edge=board.edges.find(e=>e.id===edgeId);if(!edge)throw Error('连线已不存在');
 if(board.nodes.some(n=>(n.id===edge.from||n.id===edge.to)&&n.locked))throw Error('请先解锁连线两端');
 const candidate={...board,version:3 as const,edges:board.edges.map(e=>e.id===edgeId?{...e,kind:'branch' as const}:e)};
 validateBranches(candidate);board.version=3;edge.kind='branch';edge.direction='forward';
}

function isChildRelation(edge:Edge){return edge.kind!=='branch'&&(!edge.direction||edge.direction==='forward')&&edge.from!==edge.to;}
function childNodes(board:Board){return new Map<string,Card>(board.nodes.map(node=>[node.id,node]));}
/** Transaction-local index; scope it to visible/selected roots instead of retaining stale candidates. */
export function childConnectionCandidates(board:Board,roots?:ReadonlySet<string>):Map<string,string[]> {
 const result=new Map<string,string[]>();if(roots&&!roots.size)return result;
 let nodes:Map<string,Card>|undefined;
 for(const edge of board.edges){
  if((roots&&!roots.has(edge.from))||!isChildRelation(edge))continue;
  nodes??=childNodes(board);if(!nodes.has(edge.from)||!nodes.has(edge.to))continue;
  const ids=result.get(edge.from);if(ids)ids.push(edge.id);else result.set(edge.from,[edge.id]);
 }
 return result;
}
/** Validate the whole conversion before changing anything, including on conflicts. */
export function makeChildConnections(board:Board,roots:ReadonlySet<string>){
 if(!roots.size)return;
 let nodes:Map<string,Card>|undefined,edges:Edge[]|undefined;
 for(let i=0;i<board.edges.length;i++){
  const edge=board.edges[i];if(!roots.has(edge.from)||!isChildRelation(edge))continue;
  nodes??=childNodes(board);const from=nodes.get(edge.from),to=nodes.get(edge.to);if(!from||!to)continue;
  if(from.locked||to.locked)throw Error('请先解锁连线两端');
  edges??=board.edges.slice();edges[i]={...edge,kind:'branch',direction:'forward'};
 }
 if(!edges)return;
 validateBranches({...board,version:3,edges});
 board.version=3;board.edges=edges;
}
