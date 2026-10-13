import {readBoardDocument,type YamlParser} from './board-document';
import {isRecord} from './value-guards';

export type BoardConflictSourceKind='original'|'local'|'recovery';
export interface BoardConflictCompareSource {
 kind:BoardConflictSourceKind;path:string;extension:string;source?:string;identity?:object;mtime?:number;error?:string;
}
export interface BoardConflictCompareInput {
 original:BoardConflictCompareSource;local:BoardConflictCompareSource;recovery?:BoardConflictCompareSource;
}
export interface BoardConflictFile {path:string;extension:string;stat?:{mtime:number}}
export interface BoardConflictVault {
 getAbstractFileByPath(path:string):object|null|undefined;read(file:BoardConflictFile):Promise<string>;
}
export interface BoardConflictCounts {nodes:number;edges:number;strokes:number;points:number}
export interface BoardConflictSourceSummary {kind:BoardConflictSourceKind;status:'readable'|'unavailable'|'invalid';counts?:BoardConflictCounts;error?:string}
export interface BoardConflictFieldChange {field:string;before:string;after:string}
export interface BoardConflictItemChange {id:string;label:string;fields:BoardConflictFieldChange[]}
export interface BoardConflictCollectionDiff {
 added:number;removed:number;modified:number;orderChanged:boolean;
 additions:string[];removals:string[];changes:BoardConflictItemChange[];
}
export interface BoardConflictPairDiff {
 target:BoardConflictSourceKind;available:boolean;sameBytes:boolean;sameContent:boolean;
 nodes?:BoardConflictCollectionDiff;edges?:BoardConflictCollectionDiff;strokes?:BoardConflictCollectionDiff;
 settings:BoardConflictFieldChange[];envelope:BoardConflictFieldChange[];
 yaml?:BoardConflictFieldChange;body?:BoardConflictFieldChange;error?:string;
}
export interface BoardConflictComparison {sources:BoardConflictSourceSummary[];pairs:BoardConflictPairDiff[]}
interface ParsedSource {summary:BoardConflictSourceSummary;data?:Record<string,unknown>;yaml?:string;body?:string;envelope?:Record<string,unknown>}
const PREVIEW_ITEMS=12,PREVIEW_TEXT=100;
const shorten=(text:string)=>text.length>PREVIEW_TEXT?text.slice(0,PREVIEW_TEXT)+'…':text;
function stable(value:unknown):string {
 const result=JSON.stringify(value,(_key:string,current:unknown)=>isRecord(current)?Object.fromEntries(Object.keys(current).sort().map(key=>[key,current[key]])):current);
 return result===undefined?'（不存在）':result;
}
function preview(value:unknown):string {return value===undefined?'（不存在）':shorten(typeof value==='string'?value:stable(value));}
function pointDifference(before:unknown,after:unknown):BoardConflictFieldChange|undefined {
 if(!Array.isArray(before)||!Array.isArray(after))return;
 const length=Math.max(before.length,after.length);
 for(let i=0;i<length;i++)if(stable(before[i])!==stable(after[i]))return{field:`points · 首个差异点 ${i+1}`,before:`${before.length} 点；${preview(before[i])}`,after:`${after.length} 点；${preview(after[i])}`};
 return;
}
function fields(before:Record<string,unknown>,after:Record<string,unknown>,omit:ReadonlySet<string>=new Set()):BoardConflictFieldChange[] {
 const changes:BoardConflictFieldChange[]=[];
 for(const key of [...new Set([...Object.keys(before),...Object.keys(after)])].sort()){
  if(omit.has(key)||stable(before[key])===stable(after[key]))continue;
  changes.push(key==='points'?(pointDifference(before[key],after[key])??{field:key,before:preview(before[key]),after:preview(after[key])}):{field:key,before:preview(before[key]),after:preview(after[key])});
 }
 return changes;
}
function label(item:Record<string,unknown>){const value=[item.title,item.file,item.text,item.label].find(value=>typeof value==='string'&&value.length);return typeof value==='string'?shorten(value):typeof item.id==='string'?item.id:'未命名项目';}
function items(value:unknown):Record<string,unknown>[] {return Array.isArray(value)?value.filter(isRecord):[];}
function collection(before:unknown,after:unknown):BoardConflictCollectionDiff {
 const left=items(before),right=items(after),previous=new Map(left.map(item=>[String(item.id),item])),next=new Map(right.map(item=>[String(item.id),item]));
 const result:BoardConflictCollectionDiff={added:0,removed:0,modified:0,orderChanged:false,additions:[],removals:[],changes:[]};
 for(const item of right){const old=previous.get(String(item.id));if(!old){result.added++;if(result.additions.length<PREVIEW_ITEMS)result.additions.push(label(item));}else{const changed=fields(old,item);if(changed.length){result.modified++;if(result.changes.length<PREVIEW_ITEMS)result.changes.push({id:String(item.id),label:label(item),fields:changed});}}}
 for(const item of left)if(!next.has(String(item.id))){result.removed++;if(result.removals.length<PREVIEW_ITEMS)result.removals.push(label(item));}
 // Comparing the relative order of shared IDs catches layer changes separately
 // from additions/removals, which naturally shift indices.
 result.orderChanged=stable(left.filter(item=>next.has(String(item.id))).map(item=>item.id))!==stable(right.filter(item=>previous.has(String(item.id))).map(item=>item.id));
 return result;
}
function parse(source:BoardConflictCompareSource,parseYaml:YamlParser):ParsedSource {
 const summary:BoardConflictSourceSummary={kind:source.kind,status:'unavailable'};
 if(source.error||source.source===undefined){summary.error=source.error||'此版本无法读取';return{summary};}
 try{
  const document=readBoardDocument(source.source,source.extension,parseYaml);
  let data:Record<string,unknown>,yaml:string|undefined,body:string|undefined,envelope:Record<string,unknown>={};
  if(document.format==='markdown'){
   const payload=/```json[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```/.exec(document.layoutSource);if(!payload)throw Error('布局区无法对照');
   const raw:unknown=JSON.parse(payload[1]);if(!isRecord(raw)||!isRecord(raw.board))throw Error('布局区无法对照');
   data=raw.board;envelope={...raw};delete envelope.board;
   const frontmatter=/^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?^---[ \t]*(?:\r?\n|$)/m.exec(source.source);if(!frontmatter)throw Error('属性区无法对照');
   yaml=frontmatter[0];body=source.source.slice(frontmatter[0].length,document.layoutStart)+source.source.slice(document.layoutEnd);
  }else{const raw:unknown=JSON.parse(source.source.replace(/^\uFEFF/,''));if(!isRecord(raw))throw Error('布局区无法对照');data=raw;}
  const strokes=items(isRecord(data.ink)?data.ink.strokes:undefined);
  summary.status='readable';summary.counts={nodes:document.board.nodes.length,edges:document.board.edges.length,strokes:strokes.length,points:strokes.reduce((count,stroke)=>count+(Array.isArray(stroke.points)?stroke.points.length:0),0)};
  return{summary,data,yaml,body,envelope};
 }catch(error){summary.status='invalid';summary.error=error instanceof Error?error.message:String(error);return{summary};}
}
function textDifference(field:string,before:string|undefined,after:string|undefined):BoardConflictFieldChange|undefined {
 if(before===after)return;
 if(before===undefined||after===undefined)return{field,before:preview(before),after:preview(after)};
 const left=before.split('\n'),right=after.split('\n'),length=Math.max(left.length,right.length);
 for(let i=0;i<length;i++)if(left[i]!==right[i])return{field:`${field} · 首个差异行 ${i+1}`,before:preview(left[i]),after:preview(right[i])};
 return;
}
const changed=(diff:BoardConflictCollectionDiff)=>!!(diff.added||diff.removed||diff.modified||diff.orderChanged);
function pair(original:BoardConflictCompareSource,target:BoardConflictCompareSource,left:ParsedSource,right:ParsedSource):BoardConflictPairDiff {
 const result:BoardConflictPairDiff={target:target.kind,available:!!left.data&&!!right.data,sameBytes:original.source!==undefined&&original.source===target.source,sameContent:false,settings:[],envelope:[]};
 if(!left.data||!right.data){result.error=[left.summary.error,right.summary.error].filter(Boolean).join(' · ');return result;}
 result.nodes=collection(left.data.nodes,right.data.nodes);result.edges=collection(left.data.edges,right.data.edges);
 result.strokes=collection(isRecord(left.data.ink)?left.data.ink.strokes:undefined,isRecord(right.data.ink)?right.data.ink.strokes:undefined);
 result.settings=fields(left.data,right.data,new Set(['nodes','edges','ink']));
 result.settings.push(...fields(isRecord(left.data.ink)?left.data.ink:{},isRecord(right.data.ink)?right.data.ink:{},new Set(['strokes'])).map(change=>({...change,field:`ink.${change.field}`})));
 result.envelope=fields(left.envelope??{},right.envelope??{});result.yaml=textDifference('原生 YAML',left.yaml,right.yaml);result.body=textDifference('原生 Markdown 正文',left.body,right.body);
 result.sameContent=![result.nodes,result.edges,result.strokes].some(changed)&&!result.settings.length&&!result.envelope.length&&!result.yaml&&!result.body;
 return result;
}
/** Read-only, byte-preserving comparison; never proposes a merged Board. */
export function compareBoardConflictVersions(input:BoardConflictCompareInput,parseYaml:YamlParser):BoardConflictComparison {
 const original=parse(input.original,parseYaml),local=parse(input.local,parseYaml),recovery=input.recovery&&parse(input.recovery,parseYaml);
 return{sources:[original.summary,local.summary,...(recovery?[recovery.summary]:[])],pairs:[pair(input.original,input.local,original,local),...(input.recovery&&recovery?[pair(input.original,input.recovery,original,recovery)]:[])]};
}
export function sameBoardConflictSnapshot(before:BoardConflictCompareInput,after:BoardConflictCompareInput):boolean {
 const equal=(left:BoardConflictCompareSource|undefined,right:BoardConflictCompareSource|undefined)=>left===undefined||right===undefined?left===right:left.kind===right.kind&&left.path===right.path&&left.extension===right.extension&&left.identity===right.identity&&left.source===right.source&&left.mtime===right.mtime&&left.error===right.error;
 return equal(before.original,after.original)&&equal(before.local,after.local)&&equal(before.recovery,after.recovery);
}
/** Snapshot the exact file object. Replacement, rename, or a read-time write is
 * unavailable rather than silently presented as the earlier version. */
export async function readBoardConflictFile(vault:BoardConflictVault,file:BoardConflictFile,kind:'original'|'recovery'):Promise<BoardConflictCompareSource> {
 const path=file.path,extension=file.extension,mtime=file.stat?.mtime;
 const result:BoardConflictCompareSource={kind,path,extension,identity:file};
 try{
  if(vault.getAbstractFileByPath(path)!==file)throw Error('文件已移除或被替换');
  const source=await vault.read(file);
  if(file.path!==path||file.extension!==extension||vault.getAbstractFileByPath(path)!==file)throw Error('文件在读取期间移除、改名或被替换');
  if(file.stat?.mtime!==mtime)throw Error('文件在读取期间发生变化，请重新读取');
  return{...result,source,...(Number.isFinite(mtime)?{mtime}:{} )};
 }catch(error){return{...result,error:error instanceof Error?error.message:String(error)};}
}
/** Host calls this immediately before native opening, after its ownership check.
 * No write or fallback to another object at the same path is permitted. */
export async function validateBoardConflictOpen(vault:BoardConflictVault,snapshot:BoardConflictCompareSource,current:()=>boolean):Promise<boolean> {
 if(!current()||snapshot.kind==='local'||snapshot.source===undefined||snapshot.error||!snapshot.identity)return false;
 const file=vault.getAbstractFileByPath(snapshot.path);if(file!==snapshot.identity||!isRecord(file)||typeof file.path!=='string'||typeof file.extension!=='string')return false;
 const fresh=await readBoardConflictFile(vault,file as unknown as BoardConflictFile,snapshot.kind);
 return current()&&!fresh.error&&fresh.source===snapshot.source&&fresh.path===snapshot.path&&fresh.extension===snapshot.extension&&fresh.identity===snapshot.identity&&fresh.mtime===snapshot.mtime;
}
