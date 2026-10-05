import type {Board,Card,Edge} from './model';
import {supportsLocalRelations} from './local-relations';

export const BRAIN_DESCENDANT_NODES=48;
export const BRAIN_RENDER_NODES=72;
export const BRAIN_RENDER_EDGES=128;
export const BRAIN_DESCENDANT_WORK=2400;
const retainedPages=16;
export interface BrainDescendantPage {ids:string[];depths:ReadonlyMap<string,number>;parents?:ReadonlyMap<string,string>;lanes?:ReadonlyMap<string,'children'|'left'|'right'>;steps?:ReadonlyMap<string,Edge>;links:Edge[];hiddenEdges:number;page:number;firstPage:number;hasNext:boolean;visited:number;work:number;}

/** Branches traverse parent to child; ordinary associations traverse both ends.
 * Rebuilt on graph edits, never camera frames. Original edge kinds survive. */
export class BrainBranchIndex {
 readonly nodes=new Map<string,Card>();
 readonly children=new Map<string,string[]>();
 readonly neighbors=new Map<string,string[]>();
 readonly pairs=new Map<string,Map<string,Edge[]>>();
 constructor(board:Board){
  for(const node of board.nodes)if(supportsLocalRelations(node)&&!this.nodes.has(node.id))this.nodes.set(node.id,node);
  const seen=new Set<string>(),associations=new Map<string,Set<string>>();
  for(const edge of board.edges){
   if(seen.has(edge.id)||!this.nodes.has(edge.from)||!this.nodes.has(edge.to))continue;
   seen.add(edge.id);let targets=this.pairs.get(edge.from);if(!targets){targets=new Map();this.pairs.set(edge.from,targets);}
   let edges=targets.get(edge.to);if(!edges){edges=[];targets.set(edge.to,edges);}edges.push(edge);
   if(edge.kind==='branch'){const children=this.children.get(edge.from)||[];if(!children.includes(edge.to))children.push(edge.to);this.children.set(edge.from,children);}
   else for(const [from,to]of [[edge.from,edge.to],[edge.to,edge.from]]){let values=associations.get(from);if(!values){values=new Set();associations.set(from,values);}values.add(to);}
  }
  for(const id of this.nodes.keys())this.neighbors.set(id,[...new Set([...(this.children.get(id)||[]),...(associations.get(id)||[])])]);
 }
 step(from:string,to:string){const forward=this.pairs.get(from)?.get(to)||[];return forward.find(edge=>edge.kind==='branch')||forward[0]||this.pairs.get(to)?.get(from)?.[0];}
}

/** Incremental BFS: each request has fixed node and work budgets. Every emitted
 * target carries its original discovery path so later pages remain connected.
 * The discovery path is display bookkeeping; all visible original edges survive.
 * Old page bodies are bounded; restart/search keeps earlier sources reachable. */
export class BrainDescendantPager {
 private queue:{id:string;depth:number;at:number}[]=[];private head=0;
 private depths=new Map<string,number>();private parents=new Map<string,string>();
 private lanes=new Map<string,'children'|'left'|'right'>();private steps=new Map<string,Edge>();
 private pages:BrainDescendantPage[]=[];private currentPage=0;private sequence=0;
 constructor(readonly index:BrainBranchIndex,readonly center:string,readonly depth:number){this.reset();}
 reset(){this.queue=this.index.nodes.has(this.center)?[{id:this.center,depth:0,at:0}]:[];this.head=0;this.depths=new Map([[this.center,0]]);this.parents.clear();this.lanes.clear();this.steps.clear();this.pages=[];this.currentPage=0;this.sequence=0;return this.next();}
 get current(){return this.pages[this.currentPage];}
 previous(){if(this.currentPage>0)this.currentPage--;return this.current;}
 next():BrainDescendantPage {
  if(this.currentPage+1<this.pages.length){this.currentPage++;return this.current;}
  if(this.pages.length&&!this.current.hasNext)return this.current;
  const ids=new Set<string>(this.index.nodes.has(this.center)?[this.center]:[]);let work=0;
  while(this.head<this.queue.length&&work<BRAIN_DESCENDANT_WORK){
   const source=this.queue[this.head],children=this.index.neighbors.get(source.id)||[];
   if(source.depth>=Math.max(1,Math.min(5,this.depth))||source.at>=children.length){this.head++;work++;continue;}
   const target=children[source.at];
   if(this.depths.has(target)){source.at++;work++;continue;}
   const path=[target];let parent:string|undefined=source.id;
   for(let step=0;parent!==undefined&&step<6;step++){path.push(parent);parent=this.parents.get(parent);}
   if(new Set([...ids,...path]).size>BRAIN_DESCENDANT_NODES)break;
   source.at++;work++;this.depths.set(target,source.depth+1);this.parents.set(target,source.id);this.queue.push({id:target,depth:source.depth+1,at:0});for(const id of path)ids.add(id);
   const edge=this.index.step(source.id,target);if(edge){this.steps.set(target,edge);const previous=this.lanes.get(source.id),hint=edge.from===source.id?edge.fromSide:edge.toSide;this.lanes.set(target,previous&&previous!=='children'?previous:edge.kind==='branch'?'children':hint==='right'?'right':'left');}
  }
  const links:Edge[]=[];let hiddenEdges=0;
  for(const from of ids)for(const to of ids)for(const edge of this.index.pairs.get(from)?.get(to)||[]){if(links.length<BRAIN_RENDER_EDGES)links.push(edge);else hiddenEdges++;}
  const page:BrainDescendantPage={ids:[...ids],depths:new Map([...ids].map(id=>[id,this.depths.get(id)!])),parents:new Map([...ids].flatMap(id=>this.parents.has(id)?[[id,this.parents.get(id)!] as const]:[])),lanes:new Map([...ids].flatMap(id=>this.lanes.has(id)?[[id,this.lanes.get(id)!] as const]:[])),steps:new Map([...ids].flatMap(id=>this.steps.has(id)?[[id,this.steps.get(id)!] as const]:[])),links,hiddenEdges,page:this.sequence++,firstPage:this.pages[0]?.page??0,hasNext:this.head<this.queue.length,visited:Math.max(0,this.depths.size-1),work};
  this.pages.push(page);if(this.pages.length>retainedPages)this.pages.shift();this.currentPage=this.pages.length-1;
  for(const value of this.pages)value.firstPage=this.pages[0].page;
  return page;
 }
}
