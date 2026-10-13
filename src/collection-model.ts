import {normalizeNativeTags,suggestedNoteName} from './native-tags';
import {isRecord} from './value-guards';

export interface CollectionIdentity {id:string;createdAt:string;}
export interface CollectionInput extends CollectionIdentity {body:string;tags:string[];}
export interface CollectionEntry extends CollectionIdentity {path:string;title:string;tags:string[];mtime:number;}
export interface CollectionFilter {query:string;tag:string;unplaced:boolean;}

function validIdentity(id:unknown,createdAt:unknown):id is string {
 if(typeof id!=='string'||id.length<12||id.length>120||!id.startsWith('capture-')||/[^A-Za-z0-9_-]/.test(id))return false;
 if(typeof createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt))return false;
 const time=Date.parse(createdAt);
 return Number.isFinite(time)&&new Date(time).toISOString()===createdAt;
}

/** Only explicitly identified new records belong to the collection stream. */
export function readCollectionIdentity(frontmatter:unknown):CollectionIdentity|undefined {
 if(!isRecord(frontmatter)||!Object.hasOwn(frontmatter,'thoughtspace_capture')||!Object.hasOwn(frontmatter,'thoughtspace_created'))return;
 const id=frontmatter.thoughtspace_capture,createdAt=frontmatter.thoughtspace_created;
 if(validIdentity(id,createdAt)&&typeof createdAt==='string')return{id,createdAt};
}

/** The envelope owns the only frontmatter block. Body bytes, including an
 * apparent YAML block, are retained as Markdown rather than merged into it. */
export function collectionNoteSource(input:CollectionInput):string {
 if(!validIdentity(input.id,input.createdAt))throw Error('收集标识或创建时间无效');
 if(typeof input.body!=='string'||!input.body.trim())throw Error('请先写下一条记录');
 if(input.body.length>100000)throw Error('一次最多收集 100,000 个字符，请在原生笔记中继续');
 if(!Array.isArray(input.tags)||input.tags.some(tag=>typeof tag!=='string'))throw Error('标签格式无效');
 const tags=normalizeNativeTags(input.tags.join(' '));
 return `---\nthoughtspace_capture: ${JSON.stringify(input.id)}\nthoughtspace_created: ${JSON.stringify(input.createdAt)}\n${tags.length?`tags: ${JSON.stringify(tags)}\n`:''}---\n${input.body}`;
}

/** Parse only the outer envelope with the host's YAML implementation. This
 * accepts native property edits without rewriting them or parsing body YAML. */
export function collectionNoteBody(source:string,parseYaml:(yaml:string)=>unknown,expected?:CollectionIdentity):string|undefined {
 const header=/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source);
 if(!header)return;
 let identity:CollectionIdentity|undefined;
 try{identity=readCollectionIdentity(parseYaml(header[1]));}catch{return;}
 if(!identity||expected&&(identity.id!==expected.id||identity.createdAt!==expected.createdAt))return;
 return source.slice(header[0].length);
}

/** A suggestion only: neither deriving this label nor filtering edits a note. */
export function collectionTitle(body:string):string {
 const title=Array.from(suggestedNoteName(body),char=>{
  const code=char.charCodeAt(0);return code<32||code===127?' ':char;
 }).join('').replace(/[\uD800-\uDBFF]$/u,'').trim();
 return title||'未命名笔记';
}

function tagMatches(tags:readonly string[],query:string):boolean {
 return !!query&&tags.some(tag=>{const value=tag.replace(/^#/,'').toLocaleLowerCase();return value===query||value.startsWith(query+'/');});
}

/** Creating time remains stable when body, tags, path or board usage changes.
 * Incomplete board indexing cannot prove that a record has no references. */
export function filterCollectionEntries(entries:readonly CollectionEntry[],filter:CollectionFilter,usage:ReadonlySet<string>,usageKnown:boolean):CollectionEntry[] {
 if(filter.unplaced&&!usageKnown)return[];
 const wantedTag=filter.tag.trim().replace(/^#/,'').toLocaleLowerCase();
 const tokens=filter.query.trim().split(/\s+/).filter(Boolean).map(token=>({tag:token.startsWith('#'),value:(token.startsWith('#')?token.slice(1):token).toLocaleLowerCase()}));
 return entries.filter(entry=>{
  if(!validIdentity(entry.id,entry.createdAt)||filter.unplaced&&usage.has(entry.path)||wantedTag&&!tagMatches(entry.tags,wantedTag))return false;
  let text:string|undefined;
  return tokens.every(token=>token.tag?tagMatches(entry.tags,token.value):(text??=`${entry.title} ${entry.path}`.toLocaleLowerCase()).includes(token.value));
 }).sort((a,b)=>a.createdAt===b.createdAt?(a.path<b.path?-1:a.path>b.path?1:0):(a.createdAt>b.createdAt?-1:1));
}
