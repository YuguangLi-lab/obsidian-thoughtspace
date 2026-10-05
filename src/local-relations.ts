import type {Board,Card,Edge} from './model';
import {branchTopology,validateBranches} from './mindmap';
import type {NativeLocalEvidence,NativeLocalRelation} from './local-relations-native';
export type {NativeLocalEvidence,NativeLocalRelation,NativeLocalRelations} from './local-relations-native';

export const localRelationKinds=['parents','children','siblings','incoming','outgoing','associated'] as const;
export type LocalRelationKind=typeof localRelationKinds[number];
export interface LocalRelationNode {id:string;title:string;kind:Card['kind'];brainIdea?:true;path:string;detail:string}
export type LocalRelationQueryField='all'|'name'|'title'|'path'|'id'|'label'|'tag'|'type';
export type LocalRelationNodeKind='all'|'card'|'board'|'section';
export interface LocalRelationItem extends LocalRelationNode {edgeIds:string[];labels:string[];viaParentIds:string[];nativeEvidence:NativeLocalEvidence[];nativeEvidenceTotal:number}
export interface LocalRelationGroup {kind:LocalRelationKind;items:LocalRelationItem[];total:number;matched:number;shown:number;page:number;pageSize:number;pages:number;hasPrevious:boolean;hasNext:boolean}
export interface LocalRelationFilters {queryField?:LocalRelationQueryField;kindFilter?:LocalRelationNodeKind;tag?:string;tagsByNode?:ReadonlyMap<string,readonly string[]>;}
export interface LocalNeighborhoodOptions extends LocalRelationFilters {query?:string;pageSize?:number;pageByKind?:Partial<Record<LocalRelationKind,number>>;kindFilters?:readonly LocalRelationKind[];nativeRelations?:readonly NativeLocalRelation[];}
export interface LocalCenterSearchOptions extends LocalRelationFilters {page?:number;pageSize?:number;}
export interface LocalCenterSearch {items:LocalRelationNode[];total:number;matched:number;page:number;pages:number;pageSize:number;}
/** Counts describe category rows: a node with different relation kinds can occur in several groups. */
export interface LocalNeighborhood {center?:LocalRelationNode;groups:LocalRelationGroup[];total:number;matched:number;shown:number;invalidBranches:boolean}
export interface LocalRelationMatchGroup {kind:LocalRelationKind;items:LocalRelationItem[];total:number;matched:number;}
export interface LocalRelationMatches {center?:LocalRelationNode;groups:LocalRelationMatchGroup[];total:number;matched:number;invalidBranches:boolean;neighborIds:string[];}
/** Only durable note, sub-board and group objects participate in this navigation mode. */
export function supportsLocalRelations(node:Pick<Card,'kind'|'brainIdea'>):boolean {return node.kind==='card'||node.kind==='board'||node.kind==='section'||node.kind==='text'&&node.brainIdea===true;}
const unnamed:Record<Card['kind'],string>={card:'未命名笔记卡片',section:'未命名分组',board:'未命名白板',text:'未命名文本',image:'未命名图片',pdf:'未命名 PDF',audio:'未命名音频',video:'未命名视频',mindmap:'未命名脑图'};
/** Resolve display text from this board snapshot only; note contents and vault metadata are never read. */
export function localRelationNode(node:Card):LocalRelationNode {
 const path=node.file||'',line=node.text?.match(/\S[^\r\n]{0,159}/)?.[0],title=(node.title?.trim()||line||path.split('/').pop()?.replace(/\.[^.]+$/,'')||unnamed[node.kind]).replace(/\s+/g,' ').slice(0,160);
 return{id:node.id,title,kind:node.kind,...(node.brainIdea?{brainIdea:true as const}:{}),path,detail:path?`${path} · ${node.id}`:node.id};
}

const normalized=(value:string)=>value.trim().toLocaleLowerCase();
const typeNames:Record<Card['kind'],string>={card:'card note 笔记 卡片',board:'board sub-board 子白板 白板',section:'section group 分组',text:'text 文本',image:'image 图片',pdf:'pdf',audio:'audio 音频',video:'video 视频',mindmap:'mindmap 脑图'};
const positivePage=(value:number|undefined)=>Number.isFinite(value)?Math.max(0,Math.floor(value!)):0;
interface PreparedLocalQuery {text:string;parts:string[];tag:string}
const prepareLocalQuery=(query:string,options:LocalRelationFilters):PreparedLocalQuery=>{const text=normalized(query);return{text,parts:text?text.split(/\s+/):[],tag:normalized(options.tag||'').replace(/^#/,'')};};
const nodeText=(node:LocalRelationNode)=>({title:normalized(node.title),path:normalized(node.path),id:normalized(node.id)});
function nodeMatches(node:LocalRelationNode,query:PreparedLocalQuery,options:LocalRelationFilters,labels:readonly string[]=[],parents:readonly string[]=[],text?:ReturnType<typeof nodeText>){
 if(options.kindFilter&&options.kindFilter!=='all'&&node.kind!==options.kindFilter)return false;
 const tags=options.tagsByNode?.get(node.id)||[];
 if(query.tag&&!tags.some(value=>normalized(value).replace(/^#/,'')===query.tag))return false;
 if(!query.text)return true;
 const fields=text||nodeText(node);let values:readonly string[];
 switch(options.queryField||'all'){
  case'all':values=[fields.title,fields.path,fields.id,...labels.map(normalized),...parents.map(normalized),...tags.map(normalized),typeNames[node.kind]];break;
  case'name':values=[fields.title,normalized(node.path.split('/').pop()||'')];break;
  case'title':values=[fields.title];break;
  case'path':values=[fields.path];break;
  case'id':values=[fields.id];break;
  case'label':values=labels.map(normalized);break;
  case'tag':values=tags.map(normalized);break;
  case'type':values=[typeNames[node.kind]];break;
 }
 return query.parts.every(part=>values.some(value=>value.includes(part)));
}

/** Search every supported object on the current board, including isolated objects.
 * Ranking is deterministic and local; neither titles nor source paths replace object IDs. */
export function searchLocalCenters(board:Board,query='',options:LocalCenterSearchOptions={}):LocalCenterSearch {
 const prepared=prepareLocalQuery(query,options),q=prepared.text,seen=new Set<string>(),matches:{node:LocalRelationNode;score:number;order:number}[]=[];let total=0;
 for(const card of board.nodes){if(!supportsLocalRelations(card)||seen.has(card.id))continue;seen.add(card.id);total++;const node=localRelationNode(card),text=q?nodeText(node):undefined;if(!nodeMatches(node,prepared,options,[],[],text))continue;
  const score=!text?0:text.title===q?0:text.title.startsWith(q)?1:text.title.includes(q)?2:text.path===q?3:text.path.includes(q)?4:text.id===q?5:text.id.includes(q)?6:7;
  matches.push({node,score,order:total});
 }
 matches.sort((a,b)=>a.score-b.score||a.order-b.order);
 const pageSize=Number.isFinite(options.pageSize)?Math.max(1,Math.min(60,Math.floor(options.pageSize!))):20,pages=Math.max(1,Math.ceil(matches.length/pageSize)),page=Math.min(positivePage(options.page),pages-1);
 return{items:matches.slice(page*pageSize,(page+1)*pageSize).map(row=>row.node),total,matched:matches.length,page,pages,pageSize};
}

/** One operation over the current board; no retained mutable topology or external I/O.
 * Invalid branch forests are withheld rather than presented as inferred parents or ordinary edges.
 * Unpaged matches are for bounded second-layer aggregation, not direct DOM rendering. */
export function localRelationMatches(board:Board,centerId:string,options:LocalNeighborhoodOptions={}):LocalRelationMatches {
 const nodes=new Map<string,Card>();for(const node of board.nodes)if(supportsLocalRelations(node)&&!nodes.has(node.id))nodes.set(node.id,node);
 const groups:LocalRelationMatchGroup[]=localRelationKinds.map(kind=>({kind,items:[],total:0,matched:0}));
 const result:LocalRelationMatches={center:nodes.has(centerId)?localRelationNode(nodes.get(centerId)!):undefined,groups,total:0,matched:0,invalidBranches:false,neighborIds:[]};
 if(!result.center)return result;
 const relations=new Map(localRelationKinds.map(kind=>[kind,new Map<string,{edges:Set<string>;parents:Set<string>;native:Map<string,NativeLocalEvidence>}>()]));
 const edges=new Map<string,Edge>(),edgeOrder=new Map<string,number>();for(const edge of board.edges)if(!edges.has(edge.id)){edgeOrder.set(edge.id,edges.size);edges.set(edge.id,edge);}
 const add=(kind:LocalRelationKind,id:string,evidence:readonly string[],parents:readonly string[]=[],native:readonly NativeLocalEvidence[]=[])=>{
  if(id===centerId||!nodes.has(id))return;const bucket=relations.get(kind)!;let row=bucket.get(id);if(!row){row={edges:new Set(),parents:new Set(),native:new Map()};bucket.set(id,row);}for(const id of evidence)row.edges.add(id);for(const id of parents)row.parents.add(id);for(const proof of native)if(!row.native.has(proof.id))row.native.set(proof.id,proof);
 };
 let topology:ReturnType<typeof branchTopology>|undefined;
 try{validateBranches(board);topology=branchTopology(board);}catch{result.invalidBranches=true;}
 if(topology){
  const parent=topology.parents.get(centerId),centerBranch=board.edges.find(edge=>edge.kind==='branch'&&edge.to===centerId);
  if(parent&&nodes.has(parent)&&centerBranch){add('parents',parent,[centerBranch.id]);
   for(const edge of board.edges)if(edge.kind==='branch'&&edge.from===parent&&edge.to!==centerId)add('siblings',edge.to,[centerBranch.id,edge.id],[parent]);
  }
  for(const edge of board.edges)if(edge.kind==='branch'&&edge.from===centerId)add('children',edge.to,[edge.id]);
 }
 for(const edge of board.edges){
  if(edge.kind==='branch'||edge.from===edge.to||!nodes.has(edge.from)||!nodes.has(edge.to))continue;
  if(edge.from!==centerId&&edge.to!==centerId)continue;
  const associated=edge.direction==='both'||edge.direction==='none';
  add(associated?'associated':edge.to===centerId?'incoming':'outgoing',edge.from===centerId?edge.to:edge.from,[edge.id]);
 }
 for(const relation of options.nativeRelations||[])if(relation.kind==='incoming'||relation.kind==='outgoing')add(relation.kind,relation.nodeId,[],[],relation.evidence);
 result.neighborIds=[...nodes.keys()].filter(id=>localRelationKinds.some(kind=>relations.get(kind)!.has(id)));
 const query=prepareLocalQuery(options.query||'',options);
 for(const group of groups){
  const rows=relations.get(group.kind)!,matched:LocalRelationItem[]=[];group.total=rows.size;
  if(!options.kindFilters||options.kindFilters.includes(group.kind))for(const [id,node]of nodes){
   const relation=rows.get(id);if(!relation)continue;
   const descriptor=localRelationNode(node),edgeIds=[...relation.edges].sort((a,b)=>edgeOrder.get(a)!-edgeOrder.get(b)!),nativeEvidence=[...relation.native.values()],labels=[...new Set([...edgeIds.map(id=>edges.get(id)!.label.trim()),...nativeEvidence.map(proof=>proof.property||'')].filter(Boolean))],viaParentIds=[...relation.parents];
   if(!nodeMatches(descriptor,query,options,labels,viaParentIds))continue;
   matched.push({...descriptor,edgeIds,labels,viaParentIds,nativeEvidence,nativeEvidenceTotal:nativeEvidence.length});
  }
  group.items=matched;group.matched=matched.length;result.total+=group.total;result.matched+=group.matched;
 }
 return result;
}

/** String/limit calls retain the original bounded preview. Options enable complete
 * per-category paging; the displayed model always contains at most sixty rows. */
export function localNeighborhood(board:Board,centerId:string,queryOrOptions:string|LocalNeighborhoodOptions='',limit=12):LocalNeighborhood {
 const legacy=typeof queryOrOptions==='string',options:LocalNeighborhoodOptions=legacy?{query:queryOrOptions}:queryOrOptions;
 const perGroup=legacy?(Number.isNaN(limit)?12:Math.max(0,Math.min(12,Math.floor(limit)))):Number.isFinite(options.pageSize)?Math.max(1,Math.min(10,Math.floor(options.pageSize!))):10;
 const matched=localRelationMatches(board,centerId,options);let remaining=60;
 const groups:LocalRelationGroup[]=matched.groups.map(group=>{
  const pages=perGroup?Math.max(1,Math.ceil(group.matched/perGroup)):1,page=legacy?0:Math.min(positivePage(options.pageByKind?.[group.kind]),pages-1),items=group.items.slice(page*perGroup,page*perGroup+Math.min(perGroup,remaining));remaining-=items.length;
  return{kind:group.kind,items,total:group.total,matched:group.matched,shown:items.length,page,pageSize:perGroup,pages,hasPrevious:page>0,hasNext:page+1<pages};
 });
 return{center:matched.center,groups,total:matched.total,matched:matched.matched,shown:60-remaining,invalidBranches:matched.invalidBranches};
}

/** Session-local node navigation, separate from board edits and camera undo. */
export class LocalRelationHistory {
 private entries:string[]=[];private index=-1;private readonly capacity:number;
 constructor(maxEntries=80){this.capacity=Number.isFinite(maxEntries)?Math.max(1,Math.floor(maxEntries)):80;}
 get current(){return this.entries[this.index] as string|undefined;}
 get canBack(){return this.index>0;}
 get canForward(){return this.index>=0&&this.index<this.entries.length-1;}
 snapshot(){return{entries:[...this.entries],index:this.index};}
 restore(raw:{entries:string[];index:number}){
  const entries:string[]=[];let cursor=-1;const requested=Number.isFinite(raw.index)?Math.floor(raw.index):-1;
  for(let i=0;i<raw.entries.length;i++){const id=raw.entries[i];if(typeof id!=='string'||!id.trim())continue;if(entries.at(-1)!==id)entries.push(id);if(i<=requested)cursor=entries.length-1;}
  const overflow=Math.max(0,entries.length-this.capacity);this.entries=entries.slice(overflow);this.index=this.entries.length?Math.max(0,Math.min(this.entries.length-1,cursor-overflow)):-1;
 }
 visit(id:string){if(!id.trim()||id===this.current)return this.current;this.entries.splice(this.index+1);this.entries.push(id);if(this.entries.length>this.capacity)this.entries.splice(0,this.entries.length-this.capacity);this.index=this.entries.length-1;return this.current;}
 back(){if(this.canBack)this.index--;return this.current;}
 forward(){if(this.canForward)this.index++;return this.current;}
 reconcile(validIds:Iterable<string>){
  const valid=new Set(validIds),next:string[]=[];let previous=-1;
  for(let i=0;i<this.entries.length;i++){const id=this.entries[i];if(!valid.has(id))continue;if(next.at(-1)!==id)next.push(id);if(i<=this.index)previous=next.length-1;}
  this.entries=next;this.index=next.length?Math.max(0,previous):-1;return this.current;
 }
 clear(){this.entries=[];this.index=-1;}
}

/** IDs only: rename display is always resolved from the current board snapshot. */
export class LocalRelationPins {
 private values:string[]=[];
 get ids():string[]{return [...this.values];}
 restore(ids:readonly string[]){this.values=[...new Set(ids.filter(id=>typeof id==='string'&&id.trim()))].slice(0,6);}
 toggle(id:string):'added'|'removed'|'full' {
  const at=this.values.indexOf(id);if(at>=0){this.values.splice(at,1);return'removed';}
  if(this.values.length>=6||!id.trim())return'full';this.values.push(id);return'added';
 }
 reconcile(validIds:Iterable<string>){const valid=new Set(validIds);this.values=this.values.filter(id=>valid.has(id));return this.ids;}
 clear(){this.values=[];}
}
