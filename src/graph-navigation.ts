import type {Board,Card,Edge} from './model';
import {branchState} from './mindmap';
export type RelationDirection='upstream'|'downstream'|'connected';
/** Rebuild a small adjacency index per action: no persistent graph copy or content cache. */
function adjacency(board:Board,direction:RelationDirection){
 const nodes=new Set(board.nodes.filter(n=>n.kind!=='section').map(n=>n.id)),links=new Map<string,{node:string;edge:string}[]>();
 const add=(from:string,to:string,edge:string)=>{const list=links.get(from)||[];list.push({node:to,edge});links.set(from,list);};
 for(const e of board.edges){if(!nodes.has(e.from)||!nodes.has(e.to))continue;
  if(direction==='connected'||e.kind!=='branch'&&(e.direction==='both'||e.direction==='none')){add(e.from,e.to,e.id);add(e.to,e.from,e.id);}
  else if(direction==='upstream')add(e.to,e.from,e.id);else add(e.from,e.to,e.id);
 }
 return{nodes,links};
}
export function relationSelection(board:Board,seeds:ReadonlySet<string>,direction:RelationDirection,maxDepth=Infinity){
 if(maxDepth!==Infinity&&(!Number.isInteger(maxDepth)||maxDepth<0))throw Error('关系层数必须为非负整数');
 const {nodes,links}=adjacency(board,direction),found=new Set([...seeds].filter(id=>nodes.has(id))),queue=[...found],depth=new Map(queue.map(id=>[id,0]));
 for(let i=0;i<queue.length;i++){if(depth.get(queue[i])!>=maxDepth)continue;for(const next of links.get(queue[i])||[])if(!found.has(next.node)){found.add(next.node);depth.set(next.node,depth.get(queue[i])!+1);queue.push(next.node);}}
 return found;
}
/** Fewest connections between two objects, ignoring arrow direction; ties follow edge order. */
export function shortestRelationPath(board:Board,from:string,to:string){
 const {nodes,links}=adjacency(board,'connected');if(!nodes.has(from)||!nodes.has(to))return;
 const previous=new Map<string,{node:string;edge:string}>(),seen=new Set([from]),queue=[from];
 for(let i=0;i<queue.length&&!seen.has(to);i++)for(const next of links.get(queue[i])||[])if(!seen.has(next.node)){seen.add(next.node);previous.set(next.node,{node:queue[i],edge:next.edge});queue.push(next.node);if(next.node===to)break;}
 if(!seen.has(to))return;const path=[to],edges:string[]=[];let current=to;
 while(current!==from){const p=previous.get(current)!;path.push(p.node);edges.push(p.edge);current=p.node;}
 return{nodes:path.reverse(),edges:edges.reverse()};
}
/** Walk shared ancestor chains once, even when revealing thousands of descendants. */
export function unfoldRelationAncestors(board:Board,ids:ReadonlySet<string>){
 const {parents}=branchState(board),ancestors=new Set<string>();
 for(const id of ids){let p=parents.get(id);while(p&&!ancestors.has(p)){ancestors.add(p);p=parents.get(p);}}
 let changed=0;for(const n of board.nodes)if(ancestors.has(n.id)&&n.branchFolded){delete n.branchFolded;changed++;}return changed;
}
export function insertBetween(board:Board,edgeId:string,node:Card,newEdgeId:string,expected?:string){
 const edge=board.edges.find(e=>e.id===edgeId),nodes=new Map(board.nodes.map(n=>[n.id,n]));
 if(!edge||expected!==undefined&&JSON.stringify(edge)!==expected)throw Error('连线已变化，请重新选择');
 if(nodes.get(edge.from)?.locked||nodes.get(edge.to)?.locked)throw Error('请先解锁连线两端');
 if(node.kind!=='text'||!node.text?.trim()||nodes.has(node.id)||board.edges.some(e=>e.id===newEdgeId))throw Error('插入的文本或标识无效');
 const first:Edge={...edge,to:node.id},second:Edge={...edge,id:newEdgeId,from:node.id,label:''};delete first.toSide;delete second.fromSide;
 if(edge.kind==='branch')node.topic=true;
 board.version=3;board.nodes.push(node);board.edges=board.edges.flatMap(e=>e.id===edgeId?[first,second]:[e]);return node.id;
}
export function disconnectInternal(board:Board,ids:ReadonlySet<string>){
 const locked=new Set(board.nodes.filter(n=>n.locked).map(n=>n.id));const before=board.edges.length;
 board.edges=board.edges.filter(e=>!ids.has(e.from)||!ids.has(e.to)||e.kind==='branch'||locked.has(e.from)||locked.has(e.to));return before-board.edges.length;
}
/** Prefer the connection midpoint, then nearby free slots without moving existing content. */
export function insertionPosition(board:Board,edgeId:string,size:{width:number;height:number}){
 const edge=board.edges.find(e=>e.id===edgeId),a=board.nodes.find(n=>n.id===edge?.from),b=board.nodes.find(n=>n.id===edge?.to);if(!a||!b)throw Error('连线已不存在');
 const center={x:(a.x+a.width/2+b.x+b.width/2-size.width)/2,y:(a.y+a.height/2+b.y+b.height/2-size.height)/2},nodes=board.nodes.filter(n=>n.kind!=='section');
 const free=(p:{x:number;y:number})=>nodes.every(n=>p.x+size.width+16<=n.x||p.x>=n.x+n.width+16||p.y+size.height+16<=n.y||p.y>=n.y+n.height+16);
 if(free(center))return center;const vertical=Math.abs(a.y-b.y)>Math.abs(a.x-b.x);
 for(let ring=1;ring<=32;ring++){const dx=ring*(size.width+32),dy=ring*(size.height+32),offsets=vertical?[[dx,0],[-dx,0],[0,dy],[0,-dy]]:[[0,dy],[0,-dy],[dx,0],[-dx,0]];for(const[x,y]of offsets){const p={x:center.x+x,y:center.y+y};if(free(p))return p;}}
 throw Error('附近没有足够空间，请先移动两端对象');
}
