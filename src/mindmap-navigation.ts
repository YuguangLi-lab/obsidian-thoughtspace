import type {Board,Card} from './model';
import {branchState} from './mindmap';

export type TopicDirection='left'|'right'|'up'|'down';
type EligibleTopic=(node:Card)=>boolean;

/** Read-only navigation uses logical visibility, not which nodes the viewport has mounted. */
export function mindmapParent(board:Board,id:string,eligible?:EligibleTopic):string|undefined {
 const {parents,hidden}=branchState(board),parent=parents.get(id);
 if(!parent||hidden.has(parent))return;
 const node=board.nodes.find(n=>n.id===parent);
 return node&&node.kind!=='section'&&(!eligible||eligible(node))?node.id:undefined;
}

/** Follow visible spatial neighbors in the same topic tree; ordinary relations are ignored. */
export function mindmapNavigation(board:Board,id:string,direction:TopicDirection,eligible?:EligibleTopic):string|undefined {
 const {parents,children,hidden}=branchState(board),nodes=new Map(board.nodes.map(n=>[n.id,n])),origin=nodes.get(id);
 if(!origin||origin.kind==='section'||hidden.has(id))return;
 let root=id;const ancestors=new Set<string>();
 while(parents.has(root)){if(ancestors.has(root))return;ancestors.add(root);root=parents.get(root)!;}
 const horizontal=direction==='left'||direction==='right',sign=direction==='left'||direction==='up'?-1:1;
 const pending=[root],seen=new Set<string>();let best:string|undefined,score=Infinity;
 for(let i=0;i<pending.length;i++){
  const current=pending[i];if(seen.has(current)||hidden.has(current))continue;seen.add(current);
  const node=nodes.get(current);if(!node)continue;
  if(!node.branchFolded)pending.push(...children.get(current)||[]);
  if(current===id||node.kind==='section'||eligible&&!eligible(node))continue;
  const dx=node.x+node.width/2-origin.x-origin.width/2,dy=node.y+node.height/2-origin.y-origin.height/2;
  const along=(horizontal?dx:dy)*sign,cross=Math.abs(horizontal?dy:dx);if(along<=.5)continue;
  const distance=along+cross*2;if(distance<score){score=distance;best=current;}
 }
 return best;
}
