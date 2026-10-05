import {createHash} from 'crypto';
import type {Card} from './model';
import {textFitsContent} from './text-sizing';
import {hasAsciiControl,isFiniteNumber,isRecord,isUnknownArray} from './value-guards';

export interface RelationGeometrySource {path:string;mtime:number;size:number;ctime?:number}
export interface RelationGeometryEntry {id:string;shape:string;textStamp?:string;source?:RelationGeometrySource}
/** Sizing intent only: the node remains the sole owner of its saved geometry and text. */
export interface RelationGeometryCheckpoint {version:1;entries:RelationGeometryEntry[]}

/** Match the inputs used by the live Session guard; position and relation changes do not resize content. */
export function relationGeometryShape(node:Card):string {
 const path=node.paragraphQuote?.path||node.file;
 return JSON.stringify([node.kind,path,node.title,node.paragraphQuote?.mode,node.paragraphQuote?.subpath,node.width,node.height,node.autoFit,node.preferredWidth,node.collapsed,node.branchFolded,node.sectionFolded,node.locked,node.autoSize,node.topic,node.textAutoHeight,node.textMaxWidth,node.cardStyle,node.fontFamily,node.fontSize,node.borderWidth,node.textAlign,node.imageUrl,node.pdfPage,node.webUrl]);
}
/** A digest avoids copying long standalone text or paragraph bodies into the checkpoint. */
export function relationGeometryTextStamp(text:string|undefined):string|undefined {
 return text===undefined?undefined:createHash('sha256').update(text).digest('hex');
}
export function canPersistRelationGeometry(node:Card):boolean {
 return node.kind==='card'?node.autoFit===true:node.kind==='image'||node.kind==='pdf'||textFitsContent(node);
}

const validStat=(value:unknown):value is number=>isFiniteNumber(value)&&value>=0;
function validSource(value:unknown):value is RelationGeometrySource {
 if(!isRecord(value)||typeof value.path!=='string'||!value.path||value.path.length>2048||hasAsciiControl(value.path)||value.path.includes('\\')||/^\/|^[a-z][\w+.-]*:/i.test(value.path)||value.path.split('/').some(part=>!part||part==='.'||part==='..'))return false;
 return validStat(value.mtime)&&validStat(value.size)&&Number.isSafeInteger(value.size)&&(value.ctime===undefined||validStat(value.ctime));
}
/** Invalid optional cache data is discarded by parseBoard, never a reason to reject a board.
 * Live source identity/stat and shape equality are checked again by the owning Session. */
export function validRelationGeometryCheckpoint(value:unknown,nodes:readonly Card[]):value is RelationGeometryCheckpoint {
 if(!isRecord(value)||value.version!==1||!isUnknownArray(value.entries)||value.entries.length>Math.min(nodes.length,100000))return false;
 const live=new Map(nodes.map(node=>[node.id,node])),seen=new Set<string>();let total=0;
 for(const entry of value.entries){
  if(!isRecord(entry)||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2048||seen.has(entry.id)||typeof entry.shape!=='string'||!entry.shape||entry.shape.length>65536)return false;
  const node=live.get(entry.id);if(!node||!canPersistRelationGeometry(node))return false;
  if(entry.textStamp!==undefined&&(typeof entry.textStamp!=='string'||!/^[a-f0-9]{64}$/.test(entry.textStamp)))return false;
  if(entry.source!==undefined&&!validSource(entry.source))return false;
  total+=entry.shape.length;if(total>8000000)return false;seen.add(entry.id);
 }
 return true;
}
