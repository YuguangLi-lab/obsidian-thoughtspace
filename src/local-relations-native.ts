import type {Board} from './model';
import {supportsLocalRelations} from './local-relations';

export interface NativeLocalEvidence {
 id:string;kind:'link'|'embed'|'property'|'indexed';sourcePath:string;targetPath:string;subpath:string;
 /** Native cache lines are zero-based. No source block IDs are inserted. */
 line?:number;property?:string;original?:string;count?:number;
}
export interface NativeLocalRelation {nodeId:string;kind:'incoming'|'outgoing';evidence:NativeLocalEvidence[];evidenceTotal:number;}
export interface NativeLocalReference {link:string;original?:string;position?:{start:{line:number;col?:number;offset?:number}};}
export interface NativeLocalMetadata {
 links?:readonly NativeLocalReference[];embeds?:readonly NativeLocalReference[];
 frontmatterLinks?:readonly (NativeLocalReference&{key:string})[];
}
export interface NativeLocalHost {
 exists:(path:string)=>boolean;
 resolved:(path:string)=>Readonly<Record<string,number>>|undefined;
 cache:(path:string)=>NativeLocalMetadata|null;
 /** Resolve a complete linktext relative to its source note using the native resolver. */
 resolve:(linktext:string,sourcePath:string)=>{path:string;subpath?:string}|undefined;
 tags?:(path:string)=>readonly string[];
}
export interface NativeLocalRelations {relations:NativeLocalRelation[];tagsByNode:Map<string,readonly string[]>;pendingPaths:string[];}

/** Reads only caller-provided native metadata for source notes represented on this board.
 * It never enumerates the vault, reads note bodies, recurses into sub-boards, or writes data.
 * Path relations expand to every matching board object; shared sources alone do not form links. */
export function nativeLocalRelations(board:Board,centerId:string,host:NativeLocalHost):NativeLocalRelations {
 const result:NativeLocalRelations={relations:[],tagsByNode:new Map(),pendingPaths:[]},nodes=board.nodes.filter(supportsLocalRelations),center=nodes.find(node=>node.id===centerId);
 if(!center)return result;
 const byPath=new Map<string,string[]>(),cardPaths=new Set<string>(),exists=new Map<string,boolean>(),tags=new Map<string,readonly string[]>();
 const available=(path:string)=>{let valid=exists.get(path);if(valid===undefined){valid=host.exists(path);exists.set(path,valid);}return valid;};
 for(const node of nodes){const path=node.file;if(!path||node.kind==='section'||!available(path))continue;const ids=byPath.get(path)||[];if(!ids.includes(node.id))ids.push(node.id);byPath.set(path,ids);
  if(node.kind==='card'){cardPaths.add(path);let values=tags.get(path);if(!values){values=[...new Set(host.tags?.(path)||[])];tags.set(path,values);}result.tagsByNode.set(node.id,values);}
 }
 const centerPath=center.file;if(center.kind==='section'||!centerPath||!byPath.has(centerPath))return result;
 const proofs=new Map<string,Map<string,NativeLocalEvidence[]>>();
 const fromSource=(sourcePath:string)=>{
  let cached=proofs.get(sourcePath);if(cached)return cached;cached=new Map();proofs.set(sourcePath,cached);
  const metadata=host.cache(sourcePath),indexed=host.resolved(sourcePath)||{};if(!metadata)result.pendingPaths.push(sourcePath);
  const add=(proof:NativeLocalEvidence)=>{const rows=cached.get(proof.targetPath)||[];rows.push(proof);cached.set(proof.targetPath,rows);};
  // Only current-board endpoints are admitted. An external reference cannot become
  // an intermediate object or an inferred relationship with another local card.
  const references:[NativeLocalEvidence['kind'],readonly NativeLocalReference[]][]=[['link',metadata?.links||[]],['embed',metadata?.embeds||[]],['property',metadata?.frontmatterLinks||[]]];
  for(const [kind,refs]of references)for(let index=0;index<refs.length;index++){
   const ref=refs[index],target=host.resolve(ref.link,sourcePath);if(!target||target.path===sourcePath||!byPath.has(target.path))continue;
   if(sourcePath!==centerPath&&target.path!==centerPath)continue;
   const property=kind==='property'&&'key'in ref&&typeof ref.key==='string'?ref.key:undefined,cachedLine=ref.position?.start.line,line=typeof cachedLine==='number'&&Number.isSafeInteger(cachedLine)&&cachedLine>=0?cachedLine:undefined,subpath=target.subpath||'';
   const id=JSON.stringify([kind,sourcePath,target.path,subpath,property,line,ref.position?.start.col,ref.position?.start.offset,index]);
   add({id,kind,sourcePath,targetPath:target.path,subpath,...(line===undefined?{}:{line}),...(property===undefined?{}:{property}),...(ref.original===undefined?{}:{original:ref.original})});
  }
  // The native aggregate can include a reference whose positional cache has not
  // arrived yet. Preserve that link as explicitly unattributed index evidence.
  for(const targetPath of sourcePath===centerPath?byPath.keys():[centerPath]){
   if(targetPath===sourcePath||sourcePath!==centerPath&&targetPath!==centerPath)continue;
   const count=indexed[targetPath];if(!Number.isFinite(count)||count<=0)continue;const known=cached.get(targetPath)?.length||0;
   if(count>known)add({id:JSON.stringify(['indexed',sourcePath,targetPath]),kind:'indexed',sourcePath,targetPath,subpath:'',count:count-known});
  }
  return cached;
 };
 if(center.kind==='card')for(const [path,evidence]of fromSource(centerPath))for(const nodeId of byPath.get(path)||[])if(nodeId!==centerId)result.relations.push({nodeId,kind:'outgoing',evidence,evidenceTotal:evidence.length});
 for(const path of cardPaths){if(path===centerPath)continue;const evidence=fromSource(path).get(centerPath);if(!evidence?.length)continue;for(const nodeId of byPath.get(path)||[])if(nodeId!==centerId)result.relations.push({nodeId,kind:'incoming',evidence,evidenceTotal:evidence.length});}
 return result;
}
