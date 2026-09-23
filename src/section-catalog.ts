import {Board,Card,contained} from './model';
export interface SectionEntry{section:Card;members:Card[];notes:number;texts:number;images:number;boards:number;search:string;}
export type SectionSort='position'|'name'|'size';
/** A temporary, metadata-only index. No vault reads or duplicated note bodies. */
export function sectionCatalog(board:Board):SectionEntry[]{
 return board.nodes.filter(n=>n.kind==='section').map(section=>{const members=board.nodes.filter(n=>contained(section,n));return {section,members,notes:members.filter(n=>n.kind==='card').length,texts:members.filter(n=>n.kind==='text').length,images:members.filter(n=>n.kind==='image').length,boards:members.filter(n=>n.kind==='board').length,search:[section.title||'未命名分组',...members.map(n=>`${n.title||''} ${n.file||''} ${n.text||''}`)].join('\n').toLocaleLowerCase()};});
}
export function selectSections(entries:readonly SectionEntry[],query='',sort:SectionSort='position',empty=false){
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>(!empty||!e.members.length)&&words.every(w=>e.search.includes(w))).sort((a,b)=>{
  const position=a.section.y-b.section.y||a.section.x-b.section.x||a.section.id.localeCompare(b.section.id);
  return sort==='name'?(a.section.title||'未命名分组').localeCompare(b.section.title||'未命名分组','zh-CN')||position:sort==='size'?b.members.length-a.members.length||position:position;
 });
}
export function sectionDirectory(entries:readonly SectionEntry[],link:(id:string)=>string){
 const escape=(s:string)=>s.replace(/[\r\n]+/g,' ').replace(/[\\[\]*_`]/g,'\\$&');
 return entries.map(e=>`- [${escape(e.section.title||'未命名分组')}](${link(e.section.id)}) · ${e.members.length} 项内容`).join('\n')+'\n';
}
