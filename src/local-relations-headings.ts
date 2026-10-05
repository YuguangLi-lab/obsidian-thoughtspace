import type {Card} from './model';
import {isRecord} from './value-guards';

export interface LocalNativeHeading {
 heading:string;level:number;
 position?:{start?:{line?:number;col?:number;offset?:number};end?:{line?:number;col?:number;offset?:number}};
}
export interface LocalHeadingMetadata {headings?:readonly LocalNativeHeading[];}
export interface LocalHeadingTarget {
 id:string;sourcePath:string;mtime:number;heading:string;level:number;line:number;col:number;offset?:number;
}
/** A native heading location, separate from the board's durable Card nodes. */
export interface LocalHeadingItem {
 id:string;heading:string;level:number;line:number;col:number;offset?:number;
 parentId?:string;depth:number;childIds:string[];target:LocalHeadingTarget;
}
export type LocalHeadingStatus='unsupported'|'missing'|'pending'|'ready';
export interface LocalHeadingTree {status:LocalHeadingStatus;sourcePath?:string;mtime?:number;roots:string[];items:LocalHeadingItem[];total:number;}
export interface LocalHeadingInput {kind:Card['kind'];path?:string;mtime?:number;available:boolean;metadata?:LocalHeadingMetadata|null;}
export interface LocalHeadingPageOptions {query?:string;collapsed?:ReadonlySet<string>;page?:number;pageSize?:number;}
export interface LocalHeadingPage {
 status:LocalHeadingStatus;items:LocalHeadingItem[];total:number;matched:number;visible:number;shown:number;hiddenByCollapse:number;
 page:number;pageCount:number;pageSize:number;
}
export const LOCAL_HEADING_PAGE_SIZE=30;
export const LOCAL_HEADING_PAGE_LIMIT=40;

function position(value:unknown):value is number {return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function timestamp(value:unknown):value is number {return typeof value==='number'&&Number.isFinite(value)&&value>=0;}
type HeadingLocation={heading:string;level:number;line:number;col:number;offset?:number};
function headingLocation(raw:unknown):HeadingLocation|undefined {
 if(!isRecord(raw)||typeof raw.heading!=='string'||typeof raw.level!=='number'||!Number.isInteger(raw.level)||raw.level<1||raw.level>6)return;
 const start=isRecord(raw.position)&&isRecord(raw.position.start)?raw.position.start:undefined;if(!position(start?.line))return;
 return{heading:raw.heading,level:raw.level,line:start.line,col:position(start.col)?start.col:0,...(position(start.offset)?{offset:start.offset}:{})};
}
function headingId(path:string,location:HeadingLocation) {
 return JSON.stringify([path,location.line,location.heading,location.level,location.offset??null]);
}
/** Metadata only: hierarchy follows the nearest earlier heading with a lower level.
 * A level jump never invents intermediate headings. The supplied cache is not mutated. */
export function localHeadingTree(input:LocalHeadingInput):LocalHeadingTree {
 const tree:LocalHeadingTree={status:'unsupported',sourcePath:input.path,mtime:input.mtime,roots:[],items:[],total:0};
 if(input.kind!=='card'||typeof input.path!=='string'||!input.path.toLowerCase().endsWith('.md'))return tree;
 if(!input.available){tree.status='missing';return tree;}
 if(!input.metadata||!timestamp(input.mtime)){tree.status='pending';return tree;}
 tree.status='ready';const headings=Array.isArray(input.metadata.headings)?input.metadata.headings:[],ordered=headings.map((raw,index)=>({location:headingLocation(raw),index})).filter((entry):entry is {location:NonNullable<ReturnType<typeof headingLocation>>;index:number}=>!!entry.location);
 ordered.sort((a,b)=>a.location.line-b.location.line||a.location.col-b.location.col||(a.location.offset??0)-(b.location.offset??0)||a.index-b.index);
 const ancestors:LocalHeadingItem[]=[],seen=new Set<string>();
 for(const {location}of ordered){const id=headingId(input.path,location);if(seen.has(id))continue;seen.add(id);
  while(ancestors.length&&ancestors[ancestors.length-1].level>=location.level)ancestors.pop();
  const parent=ancestors[ancestors.length-1],target:LocalHeadingTarget={id,sourcePath:input.path,mtime:input.mtime,...location},item:LocalHeadingItem={id,...location,parentId:parent?.id,depth:ancestors.length,childIds:[],target};
  if(parent)parent.childIds.push(id);else tree.roots.push(id);tree.items.push(item);ancestors.push(item);
 }
 tree.total=tree.items.length;return tree;
}
/** Search examines every native heading; collapsed ancestors cannot conceal a match.
 * Without a query, only descendants are hidden. Pagination bounds the rendered rows. */
export function localHeadingPage(tree:LocalHeadingTree,options:LocalHeadingPageOptions={}):LocalHeadingPage {
 const requested=options.pageSize,pageSize=typeof requested==='number'&&Number.isFinite(requested)?Math.max(1,Math.min(LOCAL_HEADING_PAGE_LIMIT,Math.floor(requested))):LOCAL_HEADING_PAGE_SIZE;
 const query=(options.query||'').trim().toLocaleLowerCase(),hidden=new Set<string>(),eligible:LocalHeadingItem[]=[];let matched=0;
 for(const item of tree.items){const match=!query||item.heading.toLocaleLowerCase().includes(query);if(match)matched++;
  const folded=!!item.parentId&&(hidden.has(item.parentId)||options.collapsed?.has(item.parentId)===true);if(folded)hidden.add(item.id);
  if(match&&(query||!folded))eligible.push(item);
 }
 const visible=eligible.length,pageCount=Math.ceil(visible/pageSize),page=typeof options.page==='number'&&Number.isFinite(options.page)?Math.max(0,Math.min(Math.max(0,pageCount-1),Math.floor(options.page))):0,items=eligible.slice(page*pageSize,(page+1)*pageSize);
 return{status:tree.status,items,total:tree.total,matched,visible,shown:items.length,hiddenByCollapse:query?0:hidden.size,page,pageCount,pageSize};
}
/** A changed cache location is rejected, never guessed from a duplicate title.
 * Cache identity does not prove freshness against editor text; the host verifies that separately. */
export function validateLocalHeadingTarget(metadata:LocalHeadingMetadata|null|undefined,path:string,mtime:number,target:LocalHeadingTarget):boolean {
 if(!metadata||!target||target.sourcePath!==path||!timestamp(mtime)||target.mtime!==mtime||!Array.isArray(metadata.headings))return false;
 if(typeof target.heading!=='string'||!Number.isInteger(target.level)||target.level<1||target.level>6||!position(target.line)||!position(target.col)||target.offset!==undefined&&!position(target.offset))return false;
 if(target.id!==headingId(path,target))return false;
 return metadata.headings.some(raw=>{const current=headingLocation(raw);return !!current&&current.heading===target.heading&&current.level===target.level&&current.line===target.line&&current.col===target.col&&current.offset===target.offset&&headingId(path,current)===target.id;});
}

/** A conservative final check against the already-open native editor.
 * This validates a cached ATX/single-line Setext location; it does not discover headings.
 * Quoted/list-nested headings and other unsupported literal forms fail closed. */
export function localHeadingTextMatches(text:string,target:LocalHeadingTarget):boolean {
 if(typeof text!=='string'||!target||typeof target.heading!=='string'||!position(target.line)||!position(target.col)||!Number.isInteger(target.level)||target.level<1||target.level>6)return false;
 const lines=text.split('\n');if(target.line>=lines.length)return false;
 let fence:{marker:string;length:number}|undefined,frontmatter=lines[0]?.replace(/\r$/,'')==='---',offset=0;
 for(let line=0;line<target.line;line++){
  const raw=lines[line].replace(/\r$/,'');offset+=lines[line].length+1;
  if(frontmatter){if(line>0&&/^(?:---|\.\.\.)\s*$/.test(raw))frontmatter=false;continue;}
  const match=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(raw);if(!match)continue;
  if(fence){if(match[1][0]===fence.marker&&match[1].length>=fence.length&&!match[2].trim())fence=undefined;}
  else if(match[1][0]!=='`'||!match[2].includes('`'))fence={marker:match[1][0],length:match[1].length};
 }
 // Native cache offsets can retain CRLF while the public editor returns LF.
 // Permit only that exact one-character-per-line difference, never a range.
 const editorOffset=offset+target.col,offsetMatches=target.offset===undefined||target.offset===editorOffset||!text.includes('\r')&&target.offset===editorOffset+target.line;
 if(frontmatter||fence||!offsetMatches)return false;
 const current=lines[target.line].replace(/\r$/,''),expected=target.heading.trim(),atx=/^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/.exec(current);
 if(atx){if(atx[1].length!==target.level)return false;const raw=atx[2]||'',title=/^#+[ \t]*$/.test(raw)?'':raw.replace(/[ \t]+#+[ \t]*$/,'').trim();return title===expected;}
 if(target.level>2||!/^ {0,3}\S/.test(current)||/^ {0,3}(?:>|[-+*]\s|\d+[.)]\s)/.test(current))return false;
 const underline=lines[target.line+1]?.replace(/\r$/,''),marker=target.level===1?'=':'-';return underline!==undefined&&new RegExp('^ {0,3}'+marker+'+[ \\t]*$').test(underline)&&current.trim()===expected;
}
