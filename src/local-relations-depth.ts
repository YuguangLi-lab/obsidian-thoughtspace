import type {Board} from './model';
import {localRelationMatches,localRelationNode,supportsLocalRelations,type LocalRelationFilters,type LocalRelationKind,type LocalRelationNode,type NativeLocalEvidence,type NativeLocalRelation} from './local-relations';

export interface LocalDepthVia {
 sourceId:string;kind:LocalRelationKind;edgeIds:string[];labels:string[];viaParentIds:string[];
 nativeEvidence:NativeLocalEvidence[];nativeEvidenceTotal:number;
}
export interface LocalDepthItem extends LocalRelationNode {
 /** Existing center / first-layer objects are return references, never new tree nodes. */
 placement:'new'|'center'|'first-layer';via:LocalDepthVia[];shared:boolean;
}
export interface LocalDepthBranch {
 source:LocalRelationNode;total:number;matched:number;shown:number;page:number;pages:number;pageSize:8;
 hasPrevious:boolean;hasNext:boolean;items:LocalDepthItem[];
}
export interface LocalRelationDepthOptions extends LocalRelationFilters {
 query?:string;kindFilters?:readonly LocalRelationKind[];
 /** Actual currently displayed first-layer object IDs. Unrelated IDs are rejected. */
 visibleFirstLayerIds:readonly string[];
 /** Reuse the center's native snapshot; no provider call is needed for it. */
 centerNativeRelations?:readonly NativeLocalRelation[];
 /** Called once per accepted expanded source, never recursively or for hidden sources. */
 nativeFor?:(sourceId:string)=>readonly NativeLocalRelation[];
 pageBySource?:Readonly<Record<string,number>>;
}
export interface LocalRelationDepth {
 centerId:string;firstLayerIds:string[];expandedIds:string[];branches:LocalDepthBranch[];
 /** At most 24 distinct new targets. Shared branch rows reference the same object. */
 nodes:LocalDepthItem[];invalidBranches:boolean;
}
const pageNumber=(value:number|undefined)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.floor(value)):0;

/** A bounded second layer, built only after the user expands a visible first-layer
 * object. Relationships retain their original direction/category: this is not a
 * recursive tree layout, and no board geometry or metadata is modified.
 *
 * Counts are distinct targets of each expanded source. They include return links
 * to the center/first layer. Filtering applies per relation before target merging.
 * Shared target evidence includes every matching route through accepted expanded
 * sources, even when another source's route is on a different page. */
export function localRelationDepth(board:Board,centerId:string,expandedIds:readonly string[],options:LocalRelationDepthOptions):LocalRelationDepth {
 const first=localRelationMatches(board,centerId,{nativeRelations:options.centerNativeRelations}),result:LocalRelationDepth={centerId,firstLayerIds:first.neighborIds,expandedIds:[],branches:[],nodes:[],invalidBranches:first.invalidBranches};
 if(!first.center)return result;
 const byId=new Map(board.nodes.filter(supportsLocalRelations).map(node=>[node.id,node])),firstLayer=new Set(first.neighborIds),visible=new Set(options.visibleFirstLayerIds),accepted=new Set<string>();
 for(const id of expandedIds){if(accepted.size===3)break;if(id!==centerId&&visible.has(id)&&firstLayer.has(id)&&byId.has(id))accepted.add(id);}
 result.expandedIds=[...accepted];const allItems=new Map<string,LocalDepthItem>(),candidates:{source:LocalRelationNode;total:number;ids:string[]}[]=[];
 for(const sourceId of accepted){
  const matches=localRelationMatches(board,sourceId,{query:options.query,queryField:options.queryField,kindFilter:options.kindFilter,tag:options.tag,tagsByNode:options.tagsByNode,kindFilters:options.kindFilters,nativeRelations:options.nativeFor?.(sourceId)}),ids=new Set<string>();
  result.invalidBranches ||= matches.invalidBranches;
  for(const group of matches.groups)for(const relation of group.items){
   ids.add(relation.id);let item=allItems.get(relation.id);
   if(!item){item={id:relation.id,title:relation.title,kind:relation.kind,path:relation.path,detail:relation.detail,placement:relation.id===centerId?'center':firstLayer.has(relation.id)?'first-layer':'new',via:[],shared:false};allItems.set(relation.id,item);}
   item.via.push({sourceId,kind:group.kind,edgeIds:relation.edgeIds,labels:relation.labels,viaParentIds:relation.viaParentIds,nativeEvidence:relation.nativeEvidence,nativeEvidenceTotal:relation.nativeEvidenceTotal});
  }
  // Reuse the board's stable object order rather than favoring a relation category.
  candidates.push({source:localRelationNode(byId.get(sourceId)!),total:matches.neighborIds.length,ids:[...byId.keys()].filter(id=>ids.has(id))});
 }
 for(const item of allItems.values())item.shared=new Set(item.via.map(via=>via.sourceId)).size>1;
 const shown=new Set<string>();
 for(const candidate of candidates){
  const matched=candidate.ids.length,pages=Math.max(1,Math.ceil(matched/8)),page=Math.min(pageNumber(options.pageBySource?.[candidate.source.id]),pages-1),items=candidate.ids.slice(page*8,(page+1)*8).map(id=>allItems.get(id)!);
  result.branches.push({source:candidate.source,total:candidate.total,matched,shown:items.length,page,pages,pageSize:8,hasPrevious:page>0,hasNext:page+1<pages,items});
  for(const item of items)if(item.placement==='new'&&!shown.has(item.id)){shown.add(item.id);result.nodes.push(item);}
 }
 return result;
}
