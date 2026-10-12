import {colors,nodeMinimumHeight,type Board} from './schema/model';
import {MAX_INK_COORDINATE,MAX_INK_POINTS,MAX_INK_STROKES,MAX_STROKE_POINTS} from './schema/ink-model';
import {supportsBoardMindmapTarget} from './schema/board-mindmap';
import {isBoardPath} from './schema/board-path';
import {isVaultMediaPath,mediaKind} from './schema/media-source';
import type {Diagnostic} from './types';

export const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const escape=(key:string)=>key.replaceAll('~','~0').replaceAll('/','~1');
export const pointer=(base:string,key:string|number)=>base+'/'+escape(String(key));
export function causeText(error:unknown):string {
 if(!(error instanceof Error))return String(error);
 let text=error.name+': '+error.message;const seen=new Set<unknown>([error]);let cause=error.cause;
 while(cause!==undefined&&!seen.has(cause)){seen.add(cause);text+=' <- '+(cause instanceof Error?cause.name+': '+cause.message:String(cause));cause=cause instanceof Error?cause.cause:undefined;}
 return text;
}
export function deepestMessage(error:unknown):string {
 let current=error;const seen=new Set<unknown>();
 while(current instanceof Error&&current.cause instanceof Error&&!seen.has(current)){seen.add(current);current=current.cause;}
 return current instanceof Error?current.message:String(current);
}

function inkLocation(raw:unknown,base:string):{pointer:string;relatedPointers?:string[]} {
 if(!record(raw))return{pointer:base};
 if(raw.version!==1)return{pointer:pointer(base,'version')};
 const strokes=raw.strokes,sp=pointer(base,'strokes');if(!Array.isArray(strokes)||strokes.length>MAX_INK_STROKES)return{pointer:sp};
 const seen=new Map<string,number>();let total=0;
 for(let i=0;i<strokes.length;i++){
  const s:unknown=strokes[i],p=pointer(sp,i);if(!record(s))return{pointer:p};
  if(typeof s.id!=='string'||!s.id.trim()||s.id.length>256||/[\u0000-\u001f\u007f]/.test(s.id))return{pointer:pointer(p,'id')};
  if(seen.has(s.id))return{pointer:pointer(p,'id'),relatedPointers:[pointer(pointer(sp,seen.get(s.id)!),'id')]};seen.set(s.id,i);
  if(typeof s.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(s.color))return{pointer:pointer(p,'color')};
  if(!finite(s.width)||s.width<.5||s.width>24)return{pointer:pointer(p,'width')};
  if(!Array.isArray(s.points)||!s.points.length||s.points.length>MAX_STROKE_POINTS)return{pointer:pointer(p,'points')};
  total+=s.points.length;if(total>MAX_INK_POINTS)return{pointer:sp,relatedPointers:[pointer(p,'points')]};
  for(let j=0;j<s.points.length;j++){
   const point:unknown=s.points[j],pp=pointer(pointer(p,'points'),j);if(!Array.isArray(point)||point.length!==3)return{pointer:pp};
   for(const k of [0,1])if(!finite(point[k])||Math.abs(point[k])>MAX_INK_COORDINATE)return{pointer:pointer(pp,k)};
   if(!finite(point[2])||point[2]<0||point[2]>1)return{pointer:pointer(pp,2)};
  }
 }
 return{pointer:base};
}

/** Locations supplement a failure already returned by the real parser, not its verdict.
 * Match only supported guard families; other guards honestly retain object/root locations. */
export function boardErrorLocation(raw:unknown,base:string,message:string):{pointer:string;relatedPointers?:string[]} {
 if(!record(raw))return{pointer:base};
 if(message==='不支持的白板格式或版本'){
  if(![1,2,3].includes(raw.version as number))return{pointer:pointer(base,'version')};
  return{pointer:pointer(base,Array.isArray(raw.nodes)?'edges':'nodes')};
 }
 if(message.startsWith('手写笔迹数据无效'))return inkLocation(raw.ink,pointer(base,'ink'));
 if(message==='手写白板版本无效')return{pointer:pointer(base,'version')};
 if(message==='手写笔迹只能保存在手写白板')return{pointer:pointer(base,'ink')};
 const nodes=Array.isArray(raw.nodes)?raw.nodes:[],ids=new Map<string,number>();
 if(message==='白板节点数据不完整')for(let i=0;i<nodes.length;i++){
  const n:unknown=nodes[i],p=pointer(pointer(base,'nodes'),i);if(!record(n))return{pointer:p};
  if(typeof n.id!=='string'||!n.id.trim())return{pointer:pointer(p,'id')};
  if(ids.has(n.id))return{pointer:pointer(p,'id'),relatedPointers:[pointer(pointer(pointer(base,'nodes'),ids.get(n.id)!),'id')]};ids.set(n.id,i);
  const kinds=raw.version===3?['card','section','board','mindmap','text','image','pdf','audio','video']:raw.version===2?['card','section','board']:['card','section'];
  if(typeof n.kind!=='string'||!kinds.includes(n.kind))return{pointer:pointer(p,'kind')};
  for(const key of ['x','y','width','height'])if(!finite(n[key]))return{pointer:pointer(p,key)};
  if((n.width as number)<80)return{pointer:pointer(p,'width')};
  if((n.height as number)<nodeMinimumHeight(n.kind as Board['nodes'][number]['kind']))return{pointer:pointer(p,'height')};
  if(!colors.includes(n.color as typeof colors[number]))return{pointer:pointer(p,'color')};
  if(['card','board','image','pdf','audio','video'].includes(n.kind)){
   const file=n.file,valid=typeof file==='string'&&!/(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(file)&&(n.kind==='audio'||n.kind==='video'?isVaultMediaPath(file)&&mediaKind(file)===n.kind:n.kind==='pdf'?/\.pdf$/i.test(file):n.kind==='image'?/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file):n.kind==='board'?isBoardPath(file):/\.md$/i.test(file));
   if(!valid)return{pointer:pointer(p,'file')};
  }
  if(n.kind==='section'&&typeof n.title!=='string')return{pointer:pointer(p,'title')};
  for(const key of ['file','title','text'])if(n[key]!==undefined&&typeof n[key]!=='string')return{pointer:pointer(p,key)};
 }
 if(message==='白板连线数据不完整'){
  const nodeIds=new Set(nodes.filter(record).map(n=>n.id)),seen=new Map<string,number>(),edges=Array.isArray(raw.edges)?raw.edges:[];
  for(let i=0;i<edges.length;i++){
   const e:unknown=edges[i],p=pointer(pointer(base,'edges'),i);if(!record(e))return{pointer:p};
   if(typeof e.id!=='string'||!e.id.trim())return{pointer:pointer(p,'id')};
   if(seen.has(e.id))return{pointer:pointer(p,'id'),relatedPointers:[pointer(pointer(pointer(base,'edges'),seen.get(e.id)!),'id')]};seen.set(e.id,i);
   if(typeof e.from!=='string'||!nodeIds.has(e.from))return{pointer:pointer(p,'from')};
   if(typeof e.to!=='string'||!nodeIds.has(e.to)||e.from===e.to)return{pointer:pointer(p,'to')};
   if(typeof e.label!=='string')return{pointer:pointer(p,'label')};
  }
 }
 if(message==='白板视口数据不完整'){
  const vp=raw.viewport,p=pointer(base,'viewport');if(!record(vp))return{pointer:p};
  for(const key of ['x','y','zoom'])if(!finite(vp[key]))return{pointer:pointer(p,key)};
  return{pointer:pointer(p,'zoom')};
 }
 const objects:Record<string,string>={'脑图白板状态无效':'brain','脑图阅读位置数据无效':'brainReadingPositions','脑图白板视口无效':'brainViewport','白板展示模式无效':'presentation','连线样式不完整':'edges','分支端点必须存在，每个对象只能有一个父级':'edges','导图分支不能形成循环':'edges','分组父子关系与包含关系不能形成循环':'edges'};
 return{pointer:objects[message]?pointer(base,objects[message]):base};
}

export function normalizationDiagnostics(raw:unknown,normalized:Board,base:string):{diagnostics:Diagnostic[];count:number} {
 const pending:{before:unknown;after:unknown;path:string}[]=[{before:raw,after:normalized,path:base}],diagnostics:Diagnostic[]=[];let count=0;
 while(pending.length){
  const entry=pending.pop()!;if(Object.is(entry.before,entry.after))continue;
  if(record(entry.before)&&record(entry.after)){
   for(const key of new Set([...Object.keys(entry.before),...Object.keys(entry.after)])){
    if(Object.hasOwn(entry.before,key)!==Object.hasOwn(entry.after,key)){count++;if(diagnostics.length<100)diagnostics.push({severity:'normalized',code:'parser-normalization',message:'真实解析器新增或移除了此字段',pointer:pointer(entry.path,key)});}
    else pending.push({before:entry.before[key],after:entry.after[key],path:pointer(entry.path,key)});
   }continue;
  }
  if(Array.isArray(entry.before)&&Array.isArray(entry.after)&&entry.before.length===entry.after.length){for(let i=entry.before.length-1;i>=0;i--)pending.push({before:entry.before[i],after:entry.after[i],path:pointer(entry.path,i)});continue;}
  count++;if(diagnostics.length<100)diagnostics.push({severity:'normalized',code:'parser-normalization',message:'真实解析器归一化了此值；输入文件未改写',pointer:entry.path});
 }
 return{diagnostics,count};
}

export function recoverableBrainDiagnostics(board:Board,base:string):Diagnostic[] {
 const available=new Set(board.nodes.filter(supportsBoardMindmapTarget).map(n=>n.id)),diagnostics:Diagnostic[]=[];
 const check=(id:string,p:string)=>{if(!available.has(id))diagnostics.push({severity:'recoverable',code:'brain-reference-unavailable',message:'保存的脑图引用已缺失或目标不再支持；真实解析器允许保留，工具没有恢复或删除该状态',pointer:p});};
 const state=(brain:NonNullable<Board['brain']>,p:string)=>{
  if(brain.centerId!==undefined)check(brain.centerId,pointer(p,'centerId'));
  for(const key of ['expandedIds','pins'] as const)brain[key].forEach((id,i)=>check(id,pointer(pointer(p,key),i)));
  brain.history.entries.forEach((id,i)=>check(id,pointer(pointer(pointer(p,'history'),'entries'),i)));
 };
 if(board.brain)state(board.brain,pointer(base,'brain'));
 board.nodes.forEach((n,i)=>{if(n.mindmap)state(n.mindmap,pointer(pointer(pointer(base,'nodes'),i),'mindmap'));});
 board.brainReadingPositions?.forEach((position,i)=>{const p=pointer(pointer(base,'brainReadingPositions'),i);check(position.centerId,pointer(p,'centerId'));position.expandedIds.forEach((id,j)=>check(id,pointer(pointer(p,'expandedIds'),j)));});
 return diagnostics;
}
