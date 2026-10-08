import type {Board} from './model';
import {localRelationMatches} from './local-relations';
import {brainAssociationSides} from './brain-board-create';
import type {NativeLocalRelation,NativeLocalRelations} from './local-relations-native';

interface Input {board:Board;key?:object;path:string;graphRevision?:number;nativeRevision?:number;native?:(id:string)=>NativeLocalRelations|readonly NativeLocalRelation[];}
interface Resolved {matches:ReturnType<typeof localRelationMatches>;sides:ReturnType<typeof brainAssociationSides>;nativePending:boolean;}
/** One active projection per view, bounded by the current graph. Callers with no
 * revision contract recompute. Source/index events and graph edits invalidate;
 * viewport and presentation state share the immutable graph references. */
export class BrainRefreshCache {
 private cached?:{owner:object|string;path:string;nodes:Board['nodes'];edges:Board['edges'];graph:number;native:number;center:string;value:Resolved};
 resolve(input:Input,center:string):Resolved {
  const owner=input.key||input.path,previous=this.cached,known=input.graphRevision!==undefined&&input.nativeRevision!==undefined;
  if(known&&previous&&previous.owner===owner&&previous.path===input.path&&previous.nodes===input.board.nodes&&previous.edges===input.board.edges&&previous.graph===input.graphRevision&&previous.native===input.nativeRevision&&previous.center===center)return previous.value;
  const native=input.native?.(center),data=native&&!Array.isArray(native)?native as NativeLocalRelations:undefined;
  const value:Resolved={matches:localRelationMatches(input.board,center,{nativeRelations:data?.relations||native as readonly NativeLocalRelation[]|undefined}),sides:brainAssociationSides(input.board,center),nativePending:!!data?.pendingPaths.length};
  this.cached=known?{owner,path:input.path,nodes:input.board.nodes,edges:input.board.edges,graph:input.graphRevision!,native:input.nativeRevision!,center,value}:undefined;
  return value;
 }
 clear(){this.cached=undefined;}
}
