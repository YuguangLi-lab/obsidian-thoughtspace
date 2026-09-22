import {Board,Card,contained} from './model';
import {branchState} from './mindmap';
export const searchKinds:Record<Card['kind'],string>={card:'笔记',text:'文本',image:'图片',pdf:'PDF',section:'分组',board:'子白板'};
export interface SearchMetadata{title?:string;tags?:string[];headings?:string[];body?:string;}
export interface BoardSearchEntry{id:string;kind:Card['kind'];color:Card['color'];title:string;path:string;groups:{id:string;title:string}[];body:string;search:string;hidden:boolean;}
export interface BoardSearchFilter{query:string;kind:string;group:string;color:string;}
/** Temporary index; plain strings only, with one entry per on-board instance. */
export function boardSearchIndex(board:Board,metadata:(n:Card)=>SearchMetadata=()=>({})):BoardSearchEntry[]{
 const groups=board.nodes.filter(n=>n.kind==='section').sort((a,b)=>b.width*b.height-a.width*a.height),hidden=branchState(board).hidden;
 return board.nodes.map(n=>{const m=metadata(n),title=n.title||m.title||n.text?.split(/\r?\n/).find(s=>s.trim())?.slice(0,120)||n.file?.split('/').pop()||`未命名${searchKinds[n.kind]}`,path=n.file||'',location=groups.filter(g=>contained(g,n)).map(g=>({id:g.id,title:g.title||'未命名分组'})),body=n.kind==='text'?n.text||'':m.body||m.headings?.join('\n')||'';
 return{id:n.id,kind:n.kind,color:n.color,title,path,groups:location,body,hidden:hidden.has(n.id),search:[title,m.title||'',path,body,...location.map(g=>g.title),...(m.tags||[])].join('\n').toLocaleLowerCase()};});
}
export function searchBoard(entries:readonly BoardSearchEntry[],f:BoardSearchFilter):BoardSearchEntry[]{
 const words=f.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return entries.filter(e=>(!f.kind||e.kind===f.kind)&&(!f.color||e.color===f.color)&&(!f.group||(f.group===':none'?e.groups.length===0:e.groups.some(g=>g.id===f.group)))&&words.every(w=>e.search.includes(w)));
}
export function searchExcerpt(entry:BoardSearchEntry,query:string,limit=140){
 const body=entry.body.replace(/\s+/g,' ').trim(),lower=body.toLocaleLowerCase(),words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),positions=words.map(w=>lower.indexOf(w)).filter(i=>i>=0),start=Math.max(0,(positions.length?Math.min(...positions):0)-32);
 return (start?'…':'')+body.slice(start,start+limit)+(body.length>start+limit?'…':'');
}
export function searchDirectory(entries:readonly BoardSearchEntry[],link:(id:string)=>string){const escape=(s:string)=>s.replace(/[\r\n]+/g,' ').replace(/[\\\[\]*_`]/g,'\\$&');return entries.map(e=>`- [${escape(e.title)}](${link(e.id)}) · ${searchKinds[e.kind]} · ${escape(e.groups.map(g=>g.title).join(' / ')||'未分组')}`).join('\n')+'\n';}
