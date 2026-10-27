import {sha256} from './portable-sha256';
export interface WritingSourceCheck {version:1;id:string;nodeId:string;kind:'note'|'text';path:string;ctime:number;from:number;to:number;sourceHash:string;selectionHash:string;preview:string;quote:string;createdAt:string;}
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function validWritingSourceChecks(value:unknown):value is WritingSourceCheck[]{
 if(!Array.isArray(value)||value.length>500)return false;
 const ids=new Set<string>();let bytes=0;
 return value.every((v:unknown)=>{
  if(!v||typeof v!=='object'||Array.isArray(v))return false;const r=v as Record<string,unknown>;
  if(r.version!==1||typeof r.id!=='string'||!r.id||r.id.length>120||ids.has(r.id)||typeof r.nodeId!=='string'||r.nodeId.length>256||!['note','text'].includes(String(r.kind))||typeof r.path!=='string'||!r.path||r.path.length>4096||r.path.startsWith('/')||r.path.includes('\\')||r.path.split('/').some(p=>p==='.'||p==='..')||typeof r.ctime!=='number'||!Number.isFinite(r.ctime)||r.ctime<0||!Number.isSafeInteger(r.from)||!Number.isSafeInteger(r.to)||Number(r.from)<0||Number(r.to)<=Number(r.from)||Number(r.to)>1000000||!hash(r.sourceHash)||!hash(r.selectionHash)||typeof r.preview!=='string'||r.preview.length>2000||typeof r.quote!=='string'||!r.quote||r.quote.length>1000000||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt)))return false;
  ids.add(r.id);bytes+=r.quote.length+r.preview.length;return bytes<=2200000;
 });
}
export function makeWritingSourceCheck(source:{nodeId:string;kind:'note'|'text';path:string;ctime:number},raw:string,from:number,to:number,quote:string):WritingSourceCheck {
 const result:WritingSourceCheck={version:1,id:crypto.randomUUID(),...source,from,to,sourceHash:sha256(raw),selectionHash:sha256(raw.slice(from,to)),preview:raw.slice(from,to).slice(0,2000),quote,createdAt:new Date().toISOString()};
 if(raw.length>1000000||to>raw.length||!validWritingSourceChecks([result]))throw Error('来源检查基线无效或超过范围');return result;
}
export function appendWritingSourceChecks(previous:readonly WritingSourceCheck[]=[],next:readonly WritingSourceCheck[]=[]){
 const values=[...previous];for(const item of next)if(!values.some(v=>v.path===item.path&&v.nodeId===item.nodeId&&v.sourceHash===item.sourceHash&&v.quote===item.quote))values.push(item);
 if(!validWritingSourceChecks(values))throw Error('来源检查记录超过上限，请分章写作；现有记录未移除');return values;
}
function compareSource(check:WritingSourceCheck,raw:string,ctime:number,manuscript:string,fingerprint:()=>string){
 if(!validWritingSourceChecks([check]))throw Error('来源基线无法确认');
 if(!manuscript.includes(check.quote))return {state:'detached',label:'正文中的原引用已改写或移除；本记录仅供核对',current:''};
 if(check.kind==='note'&&ctime!==check.ctime)return {state:'unknown',label:'来源的创建时间已变化，可能已替换或同步；不推测其身份',current:''};
 const current=raw.slice(check.from,check.to).slice(0,2000);
 if(fingerprint()===check.sourceHash)return {state:'same',label:'已落盘来源与引用时相同',current};
 return {state:'changed',label:sha256(raw.slice(check.from,check.to))===check.selectionHash?'来源文件有变化，原区间文字仍相同':'来源已变化；下方对照原区间现内容，需人工核对位置',current};
}
export function compareWritingSource(check:WritingSourceCheck,raw:string,ctime:number,manuscript:string){return compareSource(check,raw,ctime,manuscript,()=>sha256(raw));}
/** One immutable read snapshot, scoped to a check pass; never a persisted or cross-run cache. */
export function writingSourceComparator(raw:string,ctime:number){let fingerprint:string|undefined;return(check:WritingSourceCheck,manuscript:string)=>compareSource(check,raw,ctime,manuscript,()=>fingerprint??=sha256(raw));}

/** Exclude the outer Properties envelope from whole-material comparison previews. */
export function writingSourceBodyStart(raw:string){return /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(raw)?.[0].length||0;}
