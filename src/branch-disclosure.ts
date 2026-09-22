import type {Board} from './model';
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
