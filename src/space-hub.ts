import {isRecord,isUnknownArray,isFiniteNumber,isOneOf} from './value-guards';
import {Board, Card, Color} from './model';

export type HubScope = 'boards'|'favorites'|'recent'|'notes'|'inbox'|'shared';
export type HubSort = 'updated'|'title'|'size';
export interface HubFilter {scope:HubScope;query:string;tag:string;sort:HubSort;includeJournals:boolean}
export interface SavedHubFilter {id:string;name:string;filter:HubFilter}
export interface HubPreferences {view:'gallery'|'list';saved:SavedHubFilter[];recent:{path:string;at:number}[]}
export const defaultHubFilter:HubFilter={scope:'boards',query:'',tag:'',sort:'updated',includeJournals:false};
const scopes=['boards','favorites','recent','notes','inbox','shared'] as const;
export function cleanHubFilter(raw:unknown):HubFilter {
  const value=isRecord(raw)?raw:{};
  return {scope:isOneOf(value.scope,scopes)?value.scope:'boards',query:typeof value.query==='string'?value.query.slice(0,200):'',tag:typeof value.tag==='string'?value.tag.slice(0,100):'',sort:isOneOf(value.sort,['updated','title','size'] as const)?value.sort:'updated',includeJournals:value.includeJournals===true};
}
export function cleanHubPreferences(raw:unknown):HubPreferences {
  const value=isRecord(raw)?raw:{},saved:SavedHubFilter[]=[],recent:HubPreferences['recent']=[];
  for(const item of isUnknownArray(value.saved)?value.saved:[]){if(saved.length===20)break;if(isRecord(item)&&typeof item.id==='string'&&item.id.length<=80&&typeof item.name==='string'&&item.name.trim()&&!saved.some(s=>s.id===item.id))saved.push({id:item.id,name:item.name.trim().slice(0,50),filter:cleanHubFilter(item.filter)});}
  for(const item of isUnknownArray(value.recent)?value.recent:[]){if(recent.length===24)break;if(isRecord(item)&&typeof item.path==='string'&&item.path.endsWith('.thoughtspace')&&isFiniteNumber(item.at)&&item.at>0&&!recent.some(s=>s.path===item.path))recent.push({path:item.path,at:item.at});}
  return {view:value.view==='list'?'list':'gallery',saved,recent};
}
export function rememberBoard(prefs:HubPreferences,path:string,at=Date.now()):HubPreferences {return {...prefs,recent:[{path,at},...prefs.recent.filter(x=>x.path!==path)].slice(0,24)};}
export function remapHubPaths(prefs:HubPreferences,oldPath:string,newPath?:string):HubPreferences {
  return {...prefs,recent:prefs.recent.flatMap(x=>x.path===oldPath||x.path.startsWith(oldPath+'/')?(newPath?[{...x,path:newPath+x.path.slice(oldPath.length)}]:[]):[x])};
}
export function saveHubFilter(prefs:HubPreferences,name:string,filter:HubFilter,id:string):HubPreferences {
  name=name.trim();if(!name||name.length>50)throw Error('筛选名称需要 1–50 个字符');
  if(prefs.saved.some(s=>s.name===name&&s.id!==id))throw Error('已有同名筛选');
  if(prefs.saved.length>=20&&!prefs.saved.some(s=>s.id===id))throw Error('最多保存 20 个筛选');
  return {...prefs,saved:[...prefs.saved.filter(s=>s.id!==id),{id,name,filter:cleanHubFilter(filter)}]};
}
export interface HubNote {path:string;title:string;mtime:number;tags:string[];journal:boolean}
export interface HubBoard {path:string;title:string;mtime:number;objects:number;edges:number;notes:string[];children:string[];missing:string[];tags:string[];preview:{x:number;y:number;width:number;height:number;color:Color}[]}
export interface HubIndex {boards:HubBoard[];notes:HubNote[];usage:Map<string,HubBoard[]>;errors:{path:string;message:string}[]}
export function summarizeBoard(path:string,title:string,mtime:number,board:Board,notes:Map<string,HubNote>,exists:(path:string)=>boolean):HubBoard {
  const files=new Set<string>(),children=new Set<string>(),missing=new Set<string>(),tags=new Set<string>();const geometry=board.nodes.filter(n=>n.kind!=='section');
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const n of geometry){left=Math.min(left,n.x);top=Math.min(top,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);if(n.file&&!exists(n.file))missing.add(n.file);if(n.kind==='card'&&n.file){files.add(n.file);for(const tag of notes.get(n.file)?.tags||[])tags.add(tag);}if(n.kind==='board'&&n.file)children.add(n.file);}
  const scale=geometry.length?Math.min(260/Math.max(1,right-left),116/Math.max(1,bottom-top)):1,dx=20+(260-(right-left)*scale)/2,dy=12+(116-(bottom-top)*scale)/2;
  return {path,title,mtime,objects:geometry.length,edges:board.edges.length,notes:[...files],children:[...children],missing:[...missing],tags:[...tags].sort(),preview:geometry.slice(0,80).map(n=>({x:dx+(n.x-left)*scale,y:dy+(n.y-top)*scale,width:Math.max(2,n.width*scale),height:Math.max(2,n.height*scale),color:n.color}))};
}
export function hubIndex(boards:HubBoard[],notes:HubNote[],errors:HubIndex['errors']=[]):HubIndex {const usage=new Map<string,HubBoard[]>();for(const board of boards)for(const path of board.notes){const list=usage.get(path)||[];list.push(board);usage.set(path,list);}return {boards,notes,usage,errors};}
const tagMatches=(tags:string[],query:string)=>tags.some(t=>{const value=t.replace(/^#/,'').toLocaleLowerCase();return value===query||value.startsWith(query+'/');});
/** Prepare once per result refresh; no normalized content survives an edit. */
function hubMatcher(query:string,tag:string){
 const wantedTag=tag.replace(/^#/,'').toLocaleLowerCase(),tokens=query.trim().split(/\s+/).filter(Boolean).map(token=>({tag:token.startsWith('#'),value:(token.startsWith('#')?token.slice(1):token).toLocaleLowerCase()}));
 return (item:{title:string;path:string;tags:string[]})=>{
  if(tag&&!tagMatches(item.tags,wantedTag))return false;
  let text:string|undefined;
  return tokens.every(token=>token.tag?tagMatches(item.tags,token.value):(text??=`${item.title} ${item.path}`.toLocaleLowerCase()).includes(token.value));
 };
}
export function hubMatches(item:{title:string;path:string;tags:string[]},query:string,tag:string){return hubMatcher(query,tag)(item);}
export function hubResults(index:HubIndex,filter:HubFilter,prefs:HubPreferences,favorites:ReadonlySet<string>):(HubBoard|HubNote)[] {
  const boardMode=['boards','favorites','recent'].includes(filter.scope),recent=new Map(prefs.recent.map(x=>[x.path,x.at]));
  const result:(HubBoard|HubNote)[]=boardMode?index.boards.filter(b=>(filter.scope!=='favorites'||favorites.has(b.path))&&(filter.scope!=='recent'||recent.has(b.path))):index.notes.filter(n=>(filter.includeJournals||!n.journal)&&(filter.scope!=='inbox'||(index.errors.length===0&&!index.usage.has(n.path)))&&(filter.scope!=='shared'||(index.usage.get(n.path)?.length||0)>1));
  return result.filter(hubMatcher(filter.query,filter.tag)).sort((a,b)=>{const delta=filter.scope==='recent'?(recent.get(b.path)||0)-(recent.get(a.path)||0):filter.sort==='updated'?b.mtime-a.mtime:filter.sort==='size'?('objects'in b?b.objects:index.usage.get(b.path)?.length||0)-('objects'in a?a.objects:index.usage.get(a.path)?.length||0):0;return delta||a.title.localeCompare(b.title,'zh-CN')||a.path.localeCompare(b.path);});
}
/** A single draft, one undo. Sources are only referenced; repeated paths are skipped. */
export function addHubNotes(board:Board,paths:readonly string[],position:{x:number;y:number},width:number,makeId:()=>string):string[] {
  const unique=[...new Set(paths)];if(!unique.length||unique.length>100)throw Error('一次选择 1–100 篇笔记');
  if(!Number.isFinite(position.x)||!Number.isFinite(position.y)||!Number.isFinite(width)||width<220||width>520)throw Error('放置参数无效');
  if(unique.some(p=>!p.endsWith('.md')||/(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(p)))throw Error('笔记路径无效');
  const existing=new Set(board.nodes.filter(n=>n.kind==='card').map(n=>n.file)),fresh=unique.filter(p=>!existing.has(p));const ids:string[]=[];const nodes:Card[]=fresh.map((file,i)=>{const id=makeId();ids.push(id);return {id,kind:'card',transparent:true,file,x:position.x+i%3*(width+32),y:position.y+Math.floor(i/3)*252,width,height:220,preferredWidth:width,autoFit:true,color:'blue'};});
  const generated=new Set(ids);
  if(generated.size!==ids.length||generated.size>0&&board.nodes.some(n=>generated.has(n.id)))throw Error('对象标识冲突');
  if(nodes.length){board.version=3;board.nodes.push(...nodes);}return ids;
}
