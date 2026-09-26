export interface NativeNoteFile {path:string;extension:string}
export interface NativeNoteReference<F> {file:F;path:string;page:number}
export interface NativeNoteDropLookup<F extends NativeNoteFile> {
 vaultName:string;
 getFile:(path:string)=>F|undefined;
 resolve:(link:string,sourcePath:string)=>F|undefined;
 isFile:(value:unknown)=>value is F;
}
export interface NativeNoteDropResult<F> {handled:boolean;references:NativeNoteReference<F>[]}
type DropTarget={link:string;page:number;kind:'wiki'|'uri'|'path'};

function linkTarget(raw:string,kind:DropTarget['kind']):DropTarget|undefined {
 const link=(kind==='wiki'?raw.split('|')[0]:raw).trim(),hash=link.indexOf('#'),path=hash<0?link:link.slice(0,hash),fragment=hash<0?'':link.slice(hash);
 if(!path||hasAsciiControl(link)||/^[a-z][a-z\d+.-]*:/i.test(path)||path.startsWith('/')||path.includes('\\')||path.includes('[')||path.includes(']'))return;
 let page=1;
 if(/\.pdf$/i.test(path)&&fragment){const match=/^#page=(\d+)$/.exec(fragment);if(!match)return;page=Number(match[1]);if(!Number.isSafeInteger(page)||page<1)return;}
 return{link:path,page,kind};
}
function wikiTargets(raw:string):DropTarget[]|undefined {
 const targets:DropTarget[]=[],pattern=/!?\[\[([^[\]\r\n]+)\]\]/g;let end=0;
 for(const match of raw.matchAll(pattern)){
  if(raw.slice(end,match.index).trim())return;
  const target=linkTarget(match[1],'wiki');if(!target)return;targets.push(target);end=match.index+match[0].length;
 }
 return targets.length&&!raw.slice(end).trim()?targets:undefined;
}
function nativeLinkTarget(value:unknown):DropTarget|undefined {
 if(typeof value!=='string')return;const raw=value.trim();
 if(raw.startsWith('[[')||raw.startsWith('![[')){const targets=wikiTargets(raw);return targets?.length===1?targets[0]:undefined;}
 return linkTarget(raw,'wiki');
}
function uriTargets(raw:string,vaultName:string):DropTarget[]|undefined {
 const targets:DropTarget[]=[];
 for(const line of raw.split(/\r\n?|\n/).map(value=>value.trim()).filter(Boolean)){
  if(/\s/.test(line))return;
  let url:URL;try{url=new URL(line);}catch{return;}
  if(url.protocol!=='obsidian:'||url.hostname!=='open'||url.pathname&&url.pathname!=='/'||url.username||url.password||url.port)return;
  const files=url.searchParams.getAll('file'),vaults=url.searchParams.getAll('vault');
  if(files.length!==1||vaults.length>1||vaults.length===1&&vaults[0]!==vaultName)return;
  // URLSearchParams already decoded the path once. A second decode changes literal % names.
  if(url.hash&&files[0].includes('#'))return;
  const target=linkTarget(files[0]+url.hash,'uri');if(!target)return;targets.push(target);
 }
 return targets.length?targets:undefined;
}
function transferTargets(transfer:Pick<DataTransfer,'getData'>|null,vaultName:string):DropTarget[]|undefined {
 const read=(type:string)=>{try{return transfer?.getData(type).trim()||'';}catch{return '';}};
 // An explicit URI payload is authoritative over a display label in text/plain.
 const uris=read('text/uri-list');if(uris)return uriTargets(uris,vaultName);
 const text=read('text/plain');if(!text)return;
 if(/^obsidian:/i.test(text))return uriTargets(text,vaultName);
 if(text.startsWith('[[')||text.startsWith('![['))return wikiTargets(text);
 const targets:DropTarget[]=[];
 for(const line of text.split(/\r\n?|\n/).map(value=>value.trim()).filter(Boolean)){
  const target=linkTarget(line,'path');if(!target||!/\.(md|pdf)$/i.test(target.link))return;targets.push(target);
 }
 return targets.length?targets:undefined;
}

/** Resolve existing current-vault note references without creating files or inspecting a board.
 * Exact native file identities are authoritative, including stale supported files; fallback
 * text must consist entirely of references so ordinary prose remains ordinary text. */
export function resolveNativeNoteDrop<F extends NativeNoteFile>(lookup:NativeNoteDropLookup<F>,transfer:Pick<DataTransfer,'getData'>|null,draggable:unknown,sourcePath:string):NativeNoteDropResult<F> {
 const references:NativeNoteReference<F>[]=[],seen=new Set<string>();
 const supported=(value:unknown):value is F=>lookup.isFile(value)&&/^(md|pdf)$/i.test(value.extension);
 const add=(value:unknown,page=1)=>{
  if(!supported(value)||lookup.getFile(value.path)!==value)return;
  if(value.extension.toLowerCase()!=='pdf')page=1;
  const key=value.path+'\0'+page;if(seen.has(key))return;seen.add(key);references.push({file:value,path:value.path,page});
 };
 const result=(handled=references.length>0):NativeNoteDropResult<F>=>({handled,references});
 if(draggable!==undefined&&draggable!==null){
  if(!isRecord(draggable))return result(false);
  if(draggable.type==='file'){const handled=supported(draggable.file);if(handled)add(draggable.file);return result(handled);}
  if(draggable.type==='files'){
   if(!isUnknownArray(draggable.files))return result(false);let handled=false;
   for(const file of draggable.files)if(supported(file)){handled=true;add(file);}return result(handled);
  }
  if(draggable.type!=='link')return result(false);
  const target=nativeLinkTarget(draggable.linktext);
  if(draggable.file!==undefined&&draggable.file!==null){const handled=supported(draggable.file);if(handled)add(draggable.file,target?.page);return result(handled);}
  if(!target)return result(false);
  add(lookup.resolve(target.link,typeof draggable.sourcePath==='string'?draggable.sourcePath:sourcePath),target.page);return result();
 }
 const targets=transferTargets(transfer,lookup.vaultName);if(!targets)return result(false);
 if(targets[0].kind==='path'){
  // Plain paths have no link delimiters; require every line to name a real note.
  const files=targets.map(target=>lookup.getFile(target.link));if(files.some(file=>!supported(file)))return result(false);
  files.forEach((file,index)=>add(file,targets[index].page));return result();
 }
 for(const target of targets){
  const file=target.kind==='wiki'?lookup.resolve(target.link,sourcePath):target.kind==='uri'?(lookup.getFile(target.link)||lookup.getFile(target.link+'.md')||lookup.resolve(target.link,sourcePath)):lookup.getFile(target.link);
  add(file,target.page);
 }
 return result();
}
import {hasAsciiControl,isRecord,isUnknownArray} from './value-guards';
