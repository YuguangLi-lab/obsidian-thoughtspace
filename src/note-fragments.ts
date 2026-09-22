/** Native metadata provides anchors; source text is used only for a bounded preview. */
export interface NoteFragment { subpath:string; title:string; kind:'heading'|'block'; preview:string; }
interface Position {start:{offset:number};end:{offset:number};}
export function noteFragments(text:string,cache?:{headings?:{heading:string;position:Position}[];blocks?:Record<string,{id:string;position:Position}>}|null|undefined):NoteFragment[]{
 const out:NoteFragment[]=[],headings=cache?.headings||[],counts=new Map<string,number>();
 for(const h of headings)counts.set(h.heading,(counts.get(h.heading)||0)+1);
 const preview=(start:number,end:number)=>text.slice(start,Math.min(end,start+800)).trim().slice(0,240);
 const valid=(p:Position)=>Number.isInteger(p.start.offset)&&Number.isInteger(p.end.offset)&&p.start.offset>=0&&p.end.offset>=p.start.offset&&p.end.offset<=text.length;
 for(let i=0;i<headings.length;i++){const h=headings[i];if(!valid(h.position)||!text.slice(h.position.start.offset,h.position.end.offset).includes(h.heading)||counts.get(h.heading)!==1||!h.heading.trim()||/[\r\n#\[\]|]/.test(h.heading))continue;
  out.push({subpath:'#'+h.heading,title:h.heading,kind:'heading',preview:preview(h.position.end.offset,headings[i+1]?.position.start.offset??text.length)});
 }
 for(const b of Object.values(cache?.blocks||{})){if(!valid(b.position)||!b.id||!/^[\w-]+$/.test(b.id)||!new RegExp('(?:^|\\s)\\^'+b.id+'\\s*$').test(text.slice(b.position.start.offset,b.position.end.offset)))continue;out.push({subpath:'#^'+b.id,title:'^'+b.id,kind:'block',preview:preview(b.position.start.offset,b.position.end.offset)});}
 return out;
}
export function fragmentMatches(fragment:NoteFragment,query:string){return query.trim().toLocaleLowerCase().split(/\s+/).every(w=>(fragment.title+' '+fragment.preview).toLocaleLowerCase().includes(w));}
/** Search never silently keeps an anchor that is hidden from the current list. */
export function fragmentSearchSelection(parts:NoteFragment[],query:string,current:string){
 const matches=parts.filter(p=>fragmentMatches(p,query));
 if(!query.trim())return {subpath:current,empty:false};
 return {subpath:matches.some(p=>p.subpath===current)?current:(matches[0]?.subpath||''),empty:matches.length===0};
}
export function steppedIndex(index:number,length:number,delta:number){return length?((index+delta)%length+length)%length:-1;}
