import {Board,Card,contained} from './model';
import {sectionMemberQuery} from './sections';
export interface SectionEntry{section:Card;members:Card[];notes:number;texts:number;images:number;boards:number;search:string;}
export type SectionSort='position'|'name'|'size';
/** A temporary, metadata-only index. No vault reads or duplicated note bodies. */
export function sectionCatalog(board:Board):SectionEntry[]{
 const sections=board.nodes.filter(n=>n.kind==='section'),query=sections.length>8?sectionMemberQuery(board.nodes):undefined;
 const order=query?new Map(board.nodes.map((n,i)=>[n,i])):undefined;
 return sections.map(section=>{
  // Spatial queries are local to this refresh; the catalog and its thumbnail
  // still follow original board order, not the index's coordinate order.
  const members=query?query(section).filter(n=>n.kind!=='section').sort((a,b)=>order!.get(a)!-order!.get(b)!):board.nodes.filter(n=>contained(section,n));
  let notes=0,texts=0,images=0,boards=0;const content=[section.title||'未命名分组'];
  for(const n of members){if(n.kind==='card')notes++;else if(n.kind==='text')texts++;else if(n.kind==='image')images++;else if(n.kind==='board')boards++;content.push(`${n.title||''} ${n.file||''} ${n.text||''}`);}
  return{section,members,notes,texts,images,boards,search:content.join('\n').toLocaleLowerCase()};
 });
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
