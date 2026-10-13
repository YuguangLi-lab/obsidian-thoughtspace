import {History,type Board} from './model';
import {validInkData,type InkStroke} from './ink-model';

interface StoredStroke {key:number;stroke:InkStroke;metadata:string;bytes:number;}
interface Snapshot {metadata:string;inkMetadata?:string;strokes?:number[];bytes:number;}

/** Conservative retained-object accounting, including tuples and collection refs.
 * This is a storage budget, not an engine-specific heap measurement. */
export function retainedInkStrokeBytes(stroke:InkStroke,metadata=strokeMetadata(stroke)){
 let fields=64;const values:unknown[]=[];
 for(const [key,value]of Object.entries(stroke))if(key!=='points'){fields+=32+key.length*2;values.push(value);}
 while(values.length){
  const value=values.pop();
  if(typeof value==='string')fields+=32+value.length*2;
  else if(Array.isArray(value)){fields+=64+value.length*16;for(const child of value)values.push(child);}
  else if(value&&typeof value==='object'){
   fields+=64;for(const [key,child]of Object.entries(value)){fields+=32+key.length*2;values.push(child);}
  }else fields+=16;
 }
 return 256+metadata.length*2+fields+stroke.points.length*96;
}
function strokeMetadata(stroke:InkStroke){const {points: _points,...rest}=stroke;return JSON.stringify(rest);}
function equalPoints(a:InkStroke,b:InkStroke){
 if(a.points.length!==b.points.length)return false;
 for(let i=0;i<a.points.length;i++){const p=a.points[i],q=b.points[i];if(p[0]!==q[0]||p[1]!==q[1]||p[2]!==q[2])return false;}
 return true;
}
function freezeTree(value:unknown):void {
 const pending=[value];
 while(pending.length){const next=pending.pop();if(next&&typeof next==='object'&&!Object.isFrozen(next)){
  for(const child of Object.values(next))pending.push(child);Object.freeze(next);
 }}
}

/**
 * Drop-in bounded history for ink boards. Public stack strings are opaque tokens;
 * their identity remains stable for asynchronous undo ownership checks.
 * Ordinary/complex board fields keep JSON snapshot semantics. Exact immutable ink
 * samples are stored once across both stacks, rather than once per whole board.
 */
export class HandwritingHistory extends History {
 private serial=0;
 private snapshots=new Map<string,Snapshot>();
 private strokes=new Map<number,StoredStroke>();
 private byId=new Map<string,StoredStroke[]>();
 private known=new WeakMap<InkStroke,number>();

 override get bytes(){this.collect();let bytes=0;for(const entry of this.snapshots.values())bytes+=entry.bytes;for(const entry of this.strokes.values())bytes+=entry.bytes;return bytes;}
 get retainedSamples(){this.collect();let count=0;for(const entry of this.strokes.values())count+=entry.stroke.points.length;return count;}
 get retainedStrokes(){this.collect();return this.strokes.size;}

 private collect(){
  const tokens=new Set([...this.undoStack,...this.redoStack]),keys=new Set<number>();
  for(const [token,snapshot]of this.snapshots){if(!tokens.has(token))this.snapshots.delete(token);else for(const key of snapshot.strokes||[])keys.add(key);}
  for(const key of this.strokes.keys())if(!keys.has(key))this.strokes.delete(key);
  this.byId.clear();for(const entry of this.strokes.values()){const bucket=this.byId.get(entry.stroke.id)||[];bucket.push(entry);this.byId.set(entry.stroke.id,bucket);}
 }
 private storeStroke(stroke:InkStroke):number {
  const knownKey=this.known.get(stroke),known=knownKey===undefined?undefined:this.strokes.get(knownKey);
  // Only history-owned objects are trusted by identity. Foreign mutable input
  // is compared exactly even when the same object was seen in an earlier push.
  if(known?.stroke===stroke)return known.key;
  const metadata=strokeMetadata(stroke);
  if(known&&known.metadata===metadata&&equalPoints(stroke,known.stroke))return known.key;
  const matching=this.byId.get(stroke.id)?.find(entry=>entry.metadata===metadata&&equalPoints(stroke,entry.stroke));
  if(matching){this.known.set(stroke,matching.key);return matching.key;}
  const owned={...JSON.parse(metadata) as Omit<InkStroke,'points'>,points:stroke.points.map(point=>[...point] as typeof point)};
  freezeTree(owned);
  const key=++this.serial,entry={key,stroke:owned,metadata,bytes:retainedInkStrokeBytes(owned,metadata)};
  this.strokes.set(key,entry);const bucket=this.byId.get(stroke.id)||[];bucket.push(entry);this.byId.set(stroke.id,bucket);
  this.known.set(stroke,key);this.known.set(owned,key);return key;
 }
 private capture(board:Board):string {
  const token=`ink-history:${++this.serial}`;
  if(board.ink&&validInkData(board.ink)){
   const {ink,...rest}=board,{strokes,...inkRest}=ink,metadata=JSON.stringify(rest),inkMetadata=JSON.stringify(inkRest),keys=strokes.map(stroke=>this.storeStroke(stroke));
   this.snapshots.set(token,{metadata,inkMetadata,strokes:keys,bytes:192+(metadata.length+inkMetadata.length)*4+keys.length*16+token.length*2});
  }else{
   const metadata=JSON.stringify(board);this.snapshots.set(token,{metadata,bytes:192+metadata.length*4+token.length*2});
  }
  return token;
 }
 private restore(token:string,current:Board):Board|undefined {
  const snapshot=this.snapshots.get(token);if(!snapshot)return undefined;
  const board=JSON.parse(snapshot.metadata) as Board;
  if(snapshot.strokes){
   const currentById=new Map(current.ink?.strokes.map(stroke=>[stroke.id,stroke])||[]);
   const strokes=snapshot.strokes.map(key=>{
    const saved=this.strokes.get(key)!;const candidate=currentById.get(saved.stroke.id);
    // Preserve render-cache identity without ever retaining this mutable input
    // in the snapshot. A later caller mutation cannot rewrite either stack.
    return candidate&&(candidate===saved.stroke||(strokeMetadata(candidate)===saved.metadata&&equalPoints(candidate,saved.stroke)))?candidate:saved.stroke;
   });
   board.ink={...JSON.parse(snapshot.inkMetadata!) as {version:1},strokes};
  }
  return board;
 }
 private trimBudget(){
  while(this.undoStack.length+this.redoStack.length>0&&(this.bytes>this.maxBytes||this.undoStack.length+this.redoStack.length>this.maxEntries)){
   // Remove the most distant past/future, retaining the immediately available
   // operation whenever it fits. Unlike generic History, never retain an
   // oversized single snapshot above the configured byte budget.
   if(this.undoStack.length>1)this.undoStack.shift();else if(this.redoStack.length>1)this.redoStack.shift();else if(this.undoStack.length)this.undoStack.shift();else this.redoStack.shift();
  }
  this.collect();
 }
 override push(before:Board){
  this.collect();const token=this.capture(before);this.undoStack.push(token);this.redoStack=[];this.trimBudget();
 }
 override undo(current:Board){return this.travel(current,false);}
 override redo(current:Board){return this.travel(current,true);}
 private travel(current:Board,redo:boolean):Board|undefined {
  this.collect();const from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack,token=from.at(-1);if(!token)return undefined;
  const result=this.restore(token,current);if(!result)return undefined;
  const reverse=this.capture(current);from.pop();to.push(reverse);this.trimBudget();return result;
 }
}
