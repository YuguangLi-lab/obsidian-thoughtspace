import {isBoardPath} from './board-path';
import {hasAsciiControl,isRecord} from './value-guards';

export const PENDING_BOARD_REFERENCE_LIMIT=1000;
export const PENDING_BOARD_REFERENCE_PATH_LIMIT=10000;
/** These are event-time names only. No Board, TFile, YAML or note content is kept. */
export interface PendingBoardReference {id:string;board:string;oldPath:string;newPath:string;boardPath:string;paths:string[];}
export interface PendingBoardReferenceCounts {invalid:number;duplicates:number;overflow:number;}
const INPUT_SCAN_LIMIT=PENDING_BOARD_REFERENCE_LIMIT*8,PATH_LENGTH_LIMIT=4096;
const fields=['id','board','oldPath','newPath','boardPath','paths'] as const;

/** Deliberately validate journal paths without changing existing file-format or
 * reference parsing rules. Do not decode percent bytes or resolve dot segments. */
function path(value:unknown,board=false):value is string{
 if(typeof value!=='string'||!value||value.length>PATH_LENGTH_LIMIT||value.trim()!==value||hasAsciiControl(value)||value.includes(String.fromCharCode(127))||value.startsWith('/')||value.includes('\\')||value.includes(':'))return false;
 return !value.split('/').some(part=>!part||part==='.'||part==='..')&&(!board||isBoardPath(value));
}
function identifier(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!hasAsciiControl(value)&&!value.includes(String.fromCharCode(127));}
function operation(value:unknown):PendingBoardReference|undefined{
 try{
  if(!isRecord(value)||!fields.every(field=>Object.hasOwn(value,field)))return;
  const {id,board,oldPath,newPath,boardPath,paths}=value;
  if(!identifier(id)||!path(board,true)||!path(oldPath)||!path(newPath)||oldPath===newPath||!path(boardPath,true)||!Array.isArray(paths)||paths.length>PENDING_BOARD_REFERENCE_PATH_LIMIT)return;
  // Dropping just one namespace path could change an ambiguous source resolver.
  // Reject the whole operation rather than silently changing its event snapshot.
  const saved:string[]=[];for(const item of paths){if(!path(item))return;saved.push(item);}
  return{id,board,oldPath,newPath,boardPath,paths:saved};
 }catch{return;}
}
function key(op:PendingBoardReference):string{return JSON.stringify([op.board,op.oldPath,op.newPath,op.boardPath,op.paths]);}

/** Keep chronological operations and their first stable ID. Scan at most 8000
 * input entries; anything beyond the scan/output budget is counted as overflow.
 * The caller can report rejected/capped data instead of claiming it was replayed. */
export function cleanPendingBoardReferences(value:unknown,report?:(counts:PendingBoardReferenceCounts)=>void):PendingBoardReference[]{
 const counts:PendingBoardReferenceCounts={invalid:0,duplicates:0,overflow:0},out:PendingBoardReference[]=[],ids=new Set<string>(),keys=new Set<string>();
 if(value!==undefined&&!Array.isArray(value))counts.invalid++;
 else if(Array.isArray(value)){
  const limit=Math.min(value.length,INPUT_SCAN_LIMIT);counts.overflow=value.length-limit;
  for(let i=0;i<limit;i++){
   if(out.length===PENDING_BOARD_REFERENCE_LIMIT){counts.overflow+=limit-i;break;}
   const op=operation(value[i]);if(!op){counts.invalid++;continue;}
   const stamp=key(op);if(keys.has(stamp)){counts.duplicates++;continue;}
   if(ids.has(op.id)){counts.invalid++;continue;}
   keys.add(stamp);ids.add(op.id);out.push(op);
  }
 }
 report?.(counts);return out;
}
function validJournal(ops:readonly PendingBoardReference[]):PendingBoardReference[]{
 let rejected=false;const clean=cleanPendingBoardReferences(ops,counts=>{rejected=counts.invalid>0||counts.overflow>0;});
 if(rejected)throw Error('待处理引用记录无效或超出上限，未丢弃已有记录');return clean;
}
/** A full queue never evicts an older unresolved rename. Root must retain the
 * current operation and report failure if settings persistence is unavailable. */
export function appendPendingBoardReference(ops:readonly PendingBoardReference[],value:PendingBoardReference):PendingBoardReference[]{
 const clean=validJournal(ops),op=operation(value);if(!op)throw Error('待处理引用记录或路径无效，未修改已有记录');
 const stamp=key(op);if(clean.some(saved=>key(saved)===stamp))return clean;
 if(clean.some(saved=>saved.id===op.id))throw Error('待处理引用记录标识 ID 冲突，未修改已有记录');
 if(clean.length===PENDING_BOARD_REFERENCE_LIMIT)throw Error('待处理引用记录已达到 1000 条上限，未淘汰已有记录');
 return [...clean,op];
}
/** Remove only an explicitly completed stable ID, preserving later renames. */
export function removePendingBoardReference(ops:readonly PendingBoardReference[],id:string):PendingBoardReference[]{return validJournal(ops).filter(op=>op.id!==id);}
