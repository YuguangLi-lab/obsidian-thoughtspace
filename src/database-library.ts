import {hasAsciiControl,isFiniteNumber,isOneOf,isRecord,isUnknownArray} from './value-guards';

export type LibraryScalar=string|number|boolean;
export interface LibraryCondition {key:string;op:'eq'|'empty';value?:LibraryScalar}
export interface LibraryCriteria {scope:'vault'|'cards'|'board';boardPath?:string;folder:string;includeSubfolders:boolean;tags:string[];tagMode:'all'|'any';conditions:LibraryCondition[];query:string;fullText:boolean;sort:'updated'|'title'}
/** All rules intersect. A temporary refinement can never replace an intrinsic box rule. */
export interface LibraryCollection {id:string;name:string;rules:LibraryCriteria[]}
export interface LibraryPreferences {version:1;collections:LibraryCollection[]}
export interface LibraryNote {path:string;title:string;mtime:number;ctime:number;size:number;tags:string[];properties:Record<string,unknown>}
export interface LibraryScopeContext {cardFolder:string;boardPath?:string;boardPaths:ReadonlySet<string>}
export const defaultLibraryCriteria=():LibraryCriteria=>({scope:'vault',folder:'',includeSubfolders:true,tags:[],tagMode:'all',conditions:[],query:'',fullText:false,sort:'updated'});
export const emptyLibraryPreferences=():LibraryPreferences=>({version:1,collections:[]});
export const libraryEmpty=(value:unknown)=>value==null||typeof value==='string'&&!value.trim()||Array.isArray(value)&&value.length===0;
export const libraryScalar=(value:unknown):value is LibraryScalar=>typeof value==='string'||typeof value==='boolean'||isFiniteNumber(value);
export const libraryValueId=(value:LibraryScalar)=>JSON.stringify([typeof value,value]);
export const libraryTag=(value:string)=>value.trim().replace(/^#/,'').toLocaleLowerCase();
export function validLibraryFolder(value:string){return value.length<=1000&&!value.startsWith('/')&&!hasAsciiControl(value)&&!value.includes('\\')&&!value.split('/').some(part=>part==='.'||part==='..'||part.startsWith('.'));}
export function validLibraryProperty(value:string){return !!value.trim()&&value===value.trim()&&value.length<=80&&!hasAsciiControl(value)&&!['__proto__','constructor','prototype','position','tags'].includes(value);}
export function parseLibraryCriteria(value:unknown):LibraryCriteria|undefined{
 if(!isRecord(value)||!isOneOf(value.scope,['vault','cards','board'] as const)||typeof value.folder!=='string'||!validLibraryFolder(value.folder)||typeof value.includeSubfolders!=='boolean'||!isUnknownArray(value.tags)||value.tags.length>20||!value.tags.every(t=>typeof t==='string'&&!!libraryTag(t)&&t.length<=200&&!hasAsciiControl(t))||!isOneOf(value.tagMode,['all','any'] as const)||!isUnknownArray(value.conditions)||value.conditions.length>12||typeof value.query!=='string'||value.query.length>2000||value.query.trim().split(/\s+/).filter(Boolean).length>32||typeof value.fullText!=='boolean'||!isOneOf(value.sort,['updated','title'] as const))return;
 const conditions:LibraryCondition[]=[];
 for(const c of value.conditions){if(!isRecord(c)||typeof c.key!=='string'||!validLibraryProperty(c.key)||!isOneOf(c.op,['eq','empty'] as const)||c.op==='eq'&&(!libraryScalar(c.value)||typeof c.value==='string'&&c.value.length>2000))return;conditions.push(c.op==='empty'?{key:c.key,op:c.op}:{key:c.key,op:c.op,value:c.value as LibraryScalar});}
 if(value.scope==='board'&&(typeof value.boardPath!=='string'||!value.boardPath||value.boardPath.length>1000||hasAsciiControl(value.boardPath)))return;
 return {scope:value.scope,...(value.scope==='board'?{boardPath:value.boardPath as string}:{}),folder:value.folder.replace(/\/$/,''),includeSubfolders:value.includeSubfolders,tags:[...new Set(value.tags.map(t=>libraryTag(t as string)))],tagMode:value.tagMode,conditions,query:value.query,fullText:value.fullText,sort:value.sort};
}
/** Invalid rules drop the complete collection, never weaken it into an unfiltered view. */
export function cleanLibraryPreferences(value:unknown):LibraryPreferences{
 const clean=emptyLibraryPreferences();if(!isRecord(value)||value.version!==1||!isUnknownArray(value.collections))return clean;
 const ids=new Set<string>();
 for(const c of value.collections){if(clean.collections.length>=50)break;if(!isRecord(c)||typeof c.id!=='string'||!c.id||c.id.length>100||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||hasAsciiControl(c.name)||!isUnknownArray(c.rules)||!c.rules.length||c.rules.length>8)continue;const rules=c.rules.map(parseLibraryCriteria);if(rules.some(r=>!r))continue;ids.add(c.id);clean.collections.push({id:c.id,name:c.name.trim(),rules:rules as LibraryCriteria[]});}
 return clean;
}
export function libraryPreferencesStamp(value:LibraryPreferences){return JSON.stringify(value);}
/** Shared by every library window. Compare-and-save is serialized, and a failed
 * write can roll back only the exact value owned by that operation. */
export class LibraryPreferenceStore {
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private host:{read:()=>LibraryPreferences|undefined;write:(value:LibraryPreferences|undefined)=>void;persist:()=>Promise<void>;changed:()=>void}){}
 save(next:LibraryPreferences,expected:string){const reviewed=structuredClone(next);const operation=this.queue.catch(()=>{}).then(async()=>{const candidate=cleanLibraryPreferences(reviewed);if(libraryPreferencesStamp(candidate)!==libraryPreferencesStamp(reviewed))throw Error('卡片盒规则无效，未保存');const previous=this.host.read();if(libraryPreferencesStamp(cleanLibraryPreferences(previous))!==expected)throw Error('卡片盒已在其他窗口变化，请关闭此窗口并重新保存');this.host.write(candidate);try{await this.host.persist();}catch(error){if(this.host.read()===candidate)this.host.write(previous);this.host.changed();throw error;}this.host.changed();});this.queue=operation;return operation;}
}
export function libraryFolderMatches(path:string,folder:string,children=true){if(!folder)return true;const parent=path.slice(0,Math.max(0,path.lastIndexOf('/')));return parent===folder||children&&parent.startsWith(folder+'/');}
export function libraryTagMatches(tags:readonly string[],tag:string){const needle=libraryTag(tag);return tags.some(t=>{const value=libraryTag(t);return value===needle||value.startsWith(needle+'/');});}
export function libraryConditionMatches(properties:Record<string,unknown>,c:LibraryCondition){const value=Object.hasOwn(properties,c.key)?properties[c.key]:undefined;if(c.op==='empty')return libraryEmpty(value);return Array.isArray(value)?value.some(v=>libraryScalar(v)&&v===c.value):value===c.value;}
export function libraryMetadataMatches(note:LibraryNote,c:LibraryCriteria,context:LibraryScopeContext){return(c.scope==='vault'||c.scope==='cards'&&libraryFolderMatches(note.path,context.cardFolder)||c.scope==='board'&&c.boardPath===context.boardPath&&context.boardPaths.has(note.path))&&libraryFolderMatches(note.path,c.folder,c.includeSubfolders)&&(!c.tags.length||(c.tagMode==='all'?c.tags.every(t=>libraryTagMatches(note.tags,t)):c.tags.some(t=>libraryTagMatches(note.tags,t))))&&c.conditions.every(condition=>libraryConditionMatches(note.properties,condition));}
export function librarySearchBody(body:string){const front=body.match(/^---\r?\n[\s\S]*?^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m);return front?.index===0?body.slice(front[0].length):body;}
export function libraryTextMatches(note:LibraryNote,rules:readonly LibraryCriteria[],body?:string){const metadata=[note.title,note.path,...note.tags].join('\n').toLocaleLowerCase();let lower:string|undefined;return rules.every(c=>c.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every(word=>metadata.includes(word)||c.fullText&&body!==undefined&&(lower??=librarySearchBody(body).toLocaleLowerCase()).includes(word)));}
export function libraryResults(notes:readonly LibraryNote[],rules:readonly LibraryCriteria[],context:LibraryScopeContext,bodies:ReadonlyMap<string,string>=new Map(),sort:'updated'|'title'='updated'){return notes.filter(n=>rules.every(c=>libraryMetadataMatches(n,c,context))&&libraryTextMatches(n,rules,bodies.get(n.path))).sort((a,b)=>(sort==='title'?a.title.localeCompare(b.title):b.mtime-a.mtime)||a.path.localeCompare(b.path));}
export interface LibraryValueFacet {id:string;value:LibraryScalar;count:number}
export function libraryPropertyFacet(notes:readonly LibraryNote[],key:string,selected?:LibraryScalar){const values=new Map<string,LibraryValueFacet>();let missing=0;for(const note of notes){const v=Object.hasOwn(note.properties,key)?note.properties[key]:undefined;if(libraryEmpty(v)){missing++;continue;}const unique=new Map<string,LibraryScalar>();for(const item of Array.isArray(v)?v:[v])if(libraryScalar(item)&&!(typeof item==='string'&&!item.trim()))unique.set(libraryValueId(item),item);for(const [id,value]of unique){const f=values.get(id);if(f)f.count++;else values.set(id,{id,value,count:1});}}if(selected!==undefined&&!values.has(libraryValueId(selected)))values.set(libraryValueId(selected),{id:libraryValueId(selected),value:selected,count:0});return {values:[...values.values()].sort((a,b)=>String(a.value).localeCompare(String(b.value))),missing};}
export function libraryTagFacets(notes:readonly LibraryNote[],selected:readonly string[]=[]){const counts=new Map<string,number>();for(const note of notes){const tags=new Set<string>();for(const t of note.tags){const parts=libraryTag(t).split('/');for(let i=1;i<=parts.length;i++)tags.add(parts.slice(0,i).join('/'));}for(const t of tags)counts.set(t,(counts.get(t)||0)+1);}for(const t of selected)if(!counts.has(t))counts.set(t,0);return [...counts].sort((a,b)=>a[0].localeCompare(b[0]));}
export interface LibrarySnippet {text:string;line:number;from:number;to:number}
/** Literal source offsets, no rendered-HTML offsets and no regex from user input. */
export function librarySnippets(body:string,query:string,max=2):LibrarySnippet[]{const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),hits:LibrarySnippet[]=[];if(!words.length)return hits;const header=body.length-librarySearchBody(body).length;let from=0,line=0;while(from<body.length&&hits.length<max){const newline=body.indexOf('\n',from),end=newline<0?body.length:newline,raw=body.slice(from,end).replace(/\r$/,'');if(from>=header&&raw.trim()&&words.some(w=>raw.toLocaleLowerCase().includes(w))){const earliest=Math.min(...words.map(w=>raw.toLocaleLowerCase().indexOf(w)).filter(n=>n>=0)),start=from+Math.max(0,Math.min(raw.length,earliest)-48),stop=Math.min(end,start+220);hits.push({text:(start>from?'…':'')+body.slice(start,stop)+(stop<end?'…':''),line,from:start,to:stop});}if(newline<0)break;from=newline+1;line++;}return hits;}
export function libraryFileStamp(file:{path:string;stat:{mtime:number;ctime:number;size:number}}){return JSON.stringify([file.path,file.stat.ctime,file.stat.mtime,file.stat.size]);}

export interface LibraryReadable {path:string;stat:{mtime:number;ctime:number;size:number}}
/** One read queue per overview. Cancelled generations cannot populate the next query. */
export class LibraryBodyReader<F extends LibraryReadable>{
 private generation=0;private queue:Promise<unknown>=Promise.resolve();
 constructor(private read:(file:F)=>Promise<string>,private current:(file:F)=>boolean,private yieldUI:()=>Promise<void>){ }
 cancel(){this.generation++;}
 scan(files:readonly F[],onProgress?:(done:number,total:number)=>void){const generation=++this.generation,stale=()=>generation!==this.generation;const task=this.queue.catch(()=>{}).then(async()=>{const bodies=new Map<string,string>(),stamps=new Map<string,string>();let bytes=0,skipped=0;if(stale())return;for(let i=0;i<files.length;i++){if(stale())return;const file=files[i],stamp=libraryFileStamp(file),size=file.stat.size;if(!this.current(file)||size>2000000||size<0||bytes+size>20000000){skipped++;continue;}try{const body=await this.read(file);if(stale())return;if(!this.current(file)||libraryFileStamp(file)!==stamp||body.length>2000000||bytes+Math.max(size,body.length*2)>20000000){skipped++;continue;}bytes+=Math.max(size,body.length*2);bodies.set(file.path,body);stamps.set(file.path,stamp);}catch{skipped++;}if(i%16===0){onProgress?.(i+1,files.length);await this.yieldUI();}}if(stale())return;return {bodies,stamps,skipped,bytes};});this.queue=task;return task;}
}
