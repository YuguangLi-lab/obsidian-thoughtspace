import type {Board,Card} from './model';
import {boardUsages,type BoardUsage} from './board-usage';
import {sectionContains} from './sections';

export interface ReferenceOccurrence {
 key:string;boardPath:string;boardTitle:string;nodeId:string;nodeTitle:string;sourcePath:string;
 /** Exact reference-bearing fields; moving/resizing a card never changes its identity. */
 nodeStamp:string;usages:BoardUsage[];groupIds:string[];groupPaths:string[][];
}
export interface ReferenceOccurrenceLimits {nodes:number;characters:number;groupWork:number;}
const defaultLimits:ReferenceOccurrenceLimits={nodes:20000,characters:8*1024*1024,groupWork:2000000};
export class ReferenceOccurrenceLimitError extends Error {
 constructor(){super('引用位置过多或内容过大，未完整读取。请从较小的白板查看；不会显示不完整的引用计数。');this.name='ReferenceOccurrenceLimitError';}
}
/** Does not cache native note bodies, geometry, or a mutable node reference. */
export function referenceOccurrenceStamp(node:Card):string {
 return JSON.stringify([node.id,node.kind,node.file??null,node.kind==='text'?node.text??'':null,node.paragraphQuote??null]);
}
function sectionTitle(node:Card){return node.title?.trim()||'未命名分组';}
function groupPaths(groups:Card[],work:()=>void):string[][] {
 const parent=new Map<string,Card>();
 for(const child of groups){let best:Card|undefined;for(const candidate of groups){work();if(sectionContains(candidate,child)&&(!best||candidate.width*candidate.height<best.width*best.height||candidate.width*candidate.height===best.width*best.height&&candidate.id.localeCompare(best.id)<0))best=candidate;}if(best)parent.set(child.id,best);}
 const parents=new Set([...parent.values()].map(node=>node.id));
 return groups.filter(group=>!parents.has(group.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(leaf=>{
  const path=[sectionTitle(leaf)];let node=leaf;
  // Strict containment cannot cycle; cap depth defensively for caller-supplied boards.
  for(let depth=0;depth<groups.length;depth++){const next=parent.get(node.id);if(!next)break;path.unshift(sectionTitle(next));node=next;}
  return path;
 });
}
/** One result per physical card, even if that card cites several headings/ranges.
 * BoardUsage already excludes ordinary outgoing links and code/comment examples.
 * Oversized queries fail explicitly; they never silently truncate the list. */
export function boardReferenceOccurrences(board:Board,boardPath:string,boardTitle:string,sourcePath:string,resolve:(path:string,context:string)=>string|undefined,cardTexts?:ReadonlyMap<string,string>,limits:ReferenceOccurrenceLimits=defaultLimits):ReferenceOccurrence[] {
 if(board.nodes.length>limits.nodes)throw new ReferenceOccurrenceLimitError();
 let characters=0;for(const node of board.nodes){characters+=(node.text?.length??0)+(node.file?.length??0);if(characters>limits.characters)throw new ReferenceOccurrenceLimitError();}
 if(cardTexts)for(const value of cardTexts.values()){characters+=value.length;if(characters>limits.characters)throw new ReferenceOccurrenceLimitError();}
 const byNode=new Map<string,BoardUsage[]>();
 for(const usage of boardUsages(board,boardPath,resolve,cardTexts))if(usage.path===sourcePath){const list=byNode.get(usage.nodeId)??[];list.push({...usage});byNode.set(usage.nodeId,list);}
 const sections=board.nodes.filter(node=>node.kind==='section'),items:ReferenceOccurrence[]=[];let workCount=0;
 const work=()=>{if(++workCount>limits.groupWork)throw new ReferenceOccurrenceLimitError();};
 for(const node of board.nodes){const usages=byNode.get(node.id);if(!usages)continue;
  const groups=sections.filter(section=>{work();return sectionContains(section,node);});
  items.push({key:JSON.stringify([boardPath,node.id,sourcePath]),boardPath,boardTitle,nodeId:node.id,nodeTitle:usages[0].title,sourcePath,nodeStamp:referenceOccurrenceStamp(node),usages,groupIds:groups.map(group=>group.id),groupPaths:groupPaths(groups,work)});
 }
 return items;
}
/** The host must additionally check the original TFile identity and native owner.
 * Recheck after every awaited read/open, before revealing the node. */
export function validateReferenceOccurrence(board:Board,occurrence:ReferenceOccurrence,sourcePath:string,resolve:(path:string,context:string)=>string|undefined,cardTexts?:ReadonlyMap<string,string>):boolean {
 if(sourcePath!==occurrence.sourcePath)return false;
 const node=board.nodes.find(item=>item.id===occurrence.nodeId);
 if(!node||referenceOccurrenceStamp(node)!==occurrence.nodeStamp)return false;
 const usages=boardUsages({...board,nodes:[node],edges:[]},occurrence.boardPath,resolve,cardTexts).filter(usage=>usage.path===sourcePath);
 const expected=new Set(occurrence.usages.map(usage=>usage.identity));
 return usages.length===expected.size&&usages.every(usage=>expected.has(usage.identity));
}
export function referenceOccurrenceGroups(occurrence:ReferenceOccurrence):string {
 return occurrence.groupPaths.length?occurrence.groupPaths.map(path=>path.join(' › ')).join('；'):'未分组';
}

export interface ReferenceOccurrenceTrailHost {
 /** Monotonic ownership guard: an away-and-return must still invalidate this run. */
 current():boolean;
 /** Revalidate file identity + occurrence stamp immediately before navigation. */
 locate(item:ReferenceOccurrence,index:number,current:()=>boolean):Promise<void>;
 returnToOrigin(current:()=>boolean):Promise<void>;
}
export class ReferenceOccurrenceNavigationCancelled extends Error {
 constructor(){super('页面或引用已变化，已取消跳转。请重新查看引用位置。');this.name='ReferenceOccurrenceNavigationCancelled';}
}
/** Serial, cancelable read/navigation coordinator; no source or editor writes. */
export class ReferenceOccurrenceTrail {
 private alive=true;private busy=false;private generation=0;private position:number;
 private listeners=new Set<()=>void>();
 readonly items:readonly ReferenceOccurrence[];
 constructor(items:readonly ReferenceOccurrence[],index:number,private readonly host:ReferenceOccurrenceTrailHost){
  if(!items.length||index<0||index>=items.length||!Number.isInteger(index))throw Error('引用位置无效');
  this.items=items.map(item=>({...item,usages:item.usages.map(usage=>({...usage})),groupIds:[...item.groupIds],groupPaths:item.groupPaths.map(path=>[...path])}));this.position=index;
 }
 get index(){return this.position;}
 get pending(){return this.busy;}
 get active(){return this.alive;}
 current(){return this.alive&&this.host.current();}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 private changed(){for(const listener of this.listeners)listener();}
 cancel(){this.alive=false;this.generation++;this.changed();}
 async go(index:number):Promise<boolean>{
  if(this.busy)return false;
  if(!Number.isInteger(index)||index<0||index>=this.items.length)return false;
  return this.run(async current=>{await this.host.locate(this.items[index],index,current);if(!current())throw new ReferenceOccurrenceNavigationCancelled();this.position=index;});
 }
 async returnToOrigin():Promise<boolean>{return this.run(async current=>{await this.host.returnToOrigin(current);if(!current())throw new ReferenceOccurrenceNavigationCancelled();this.cancel();});}
 private async run(action:(current:()=>boolean)=>Promise<void>):Promise<boolean>{
  if(this.busy)return false;
  if(!this.current()){this.cancel();throw new ReferenceOccurrenceNavigationCancelled();}
  const generation=++this.generation,current=()=>this.alive&&generation===this.generation&&this.host.current();this.busy=true;this.changed();
  try{await action(current);return true;}finally{this.busy=false;this.changed();}
 }
}
