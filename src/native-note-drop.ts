export interface NativeNoteFile {path:string;extension:string}
export interface NativeNoteReference<F> {file:F;path:string;page:number}
export interface NativeNoteDropLookup<F extends NativeNoteFile> {
 vaultName:string;
 getFile:(path:string)=>F|undefined;
 resolve:(link:string,sourcePath:string)=>F|undefined;
 isFile:(value:unknown)=>value is F;
}
export interface NativeNoteDropResult<F> {handled:boolean;references:NativeNoteReference<F>[]}
type DropTarget={link:string;page:number;kind:'wiki'|'uri'|'path';literal?:{path:string;page:number};legacyPage?:{path:string;page:number};exactOnly?:boolean};

function linkTarget(raw:string,kind:DropTarget['kind']):DropTarget|undefined {
 const link=(kind==='wiki'?raw.split('|')[0]:raw).trim();
 if(!link||hasAsciiControl(link)||/^[a-z][a-z\d+.-]*:/i.test(link)||link.startsWith('/')||link.includes('\\'))return;
 // A PDF page suffix belongs to the final #, not a # inside the filename.
 const pdf=/^(.+\.pdf)#page=(\d+)$/i.exec(link),hash=pdf?pdf[1].length:link.indexOf('#'),path=hash<0?link:link.slice(0,hash),fragment=hash<0?'':link.slice(hash);
 if(!path)return;
 let page=1;
 if(/\.pdf$/i.test(path)&&fragment){const match=/^#page=(\d+)$/.exec(fragment);if(!match)return;page=Number(match[1]);if(!Number.isSafeInteger(page)||page<1)return;}
 // Existing exact names are authoritative before treating # as a heading.
 // This also allows embedded media named e.g. “Figure [1] #2.png”.
 return{link:path,page,kind,...(/[#[\]]/.test(link)?{literal:{path:link,page:1}}:{})};
}
function wikiTargets(raw:string):DropTarget[]|undefined {
 const targets:DropTarget[]=[];let cursor=0;
 while(cursor<raw.length){
  while(cursor<raw.length&&/\s/.test(raw[cursor]))cursor++;
  if(cursor===raw.length)break;if(raw[cursor]==='!')cursor++;
  if(raw.slice(cursor,cursor+2)!=='[[')return;
  const end=raw.indexOf(']]',cursor+2);if(end<0)return;
  const body=raw.slice(cursor+2,end);if(/[\r\n]/.test(body)||body.includes('[['))return;
  const target=linkTarget(body,'wiki');if(!target)return;targets.push(target);cursor=end+2;
 }
 return targets.length?targets:undefined;
}
function markdownTargets(raw:string):DropTarget[]|undefined {
 const targets:DropTarget[]=[];let end=0;
 for(const range of markdownLinkRanges(raw)){
  const prefix=raw.slice(end,range.from).trim();if(prefix&&prefix!=='!')return;
  let cursor=range.from+1,depth=1;
  for(;cursor<range.to&&depth;cursor++){if(raw[cursor]==='\\'){cursor++;continue;}if(raw[cursor]==='[')depth++;else if(raw[cursor]===']')depth--;}
  if(depth||raw[cursor]!=='('||raw[range.to-1]!==')')return;
  let destination=raw.slice(cursor+1,range.to-1).trim();
  if(destination.startsWith('<')&&destination.endsWith('>'))destination=destination.slice(1,-1);
  else if(/\s/.test(destination))return;
  // Markdown escapes and URI encoding each have exactly one decoding step.
  destination=destination.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g,'$1');
  try{destination=decodeURIComponent(destination);}catch{return;}
  const target=linkTarget(destination,'wiki');if(!target)return;targets.push(target);end=range.to;
 }
 return targets.length&&!raw.slice(end).trim()?targets:undefined;
}
function nativeLinkTarget(value:unknown):DropTarget|undefined {
 if(typeof value!=='string')return;const raw=value.trim();
 if(raw.startsWith('[[')||raw.startsWith('![[')){const targets=wikiTargets(raw);return targets?.length===1?targets[0]:undefined;}
 if(raw.startsWith('[')||raw.startsWith('![')){const targets=markdownTargets(raw);if(targets)return targets.length===1?targets[0]:undefined;}
 return linkTarget(raw,'wiki');
}
function uriTargets(raw:string,vaultName:string,comments=false):DropTarget[]|undefined {
 const targets:DropTarget[]=[];
 for(const line of raw.split(/\r\n?|\n/).map(value=>value.trim()).filter(Boolean)){
  // RFC 2483: text/uri-list uses whole-line # comments, unlike text/plain.
  if(comments&&line.startsWith('#'))continue;
  if(/\s/.test(line))return;
  let url:URL;try{url=new URL(line);}catch{return;}
  if(url.protocol!=='obsidian:'||url.hostname!=='open'||url.pathname&&url.pathname!=='/'||url.username||url.password||url.port)return;
  const files=url.searchParams.getAll('file'),vaults=url.searchParams.getAll('vault');
  if(files.length!==1||vaults.length>1||vaults.length===1&&vaults[0]!==vaultName)return;
  // URLSearchParams already decoded the path once. A second decode changes literal % names.
  const path=files[0];let literal:DropTarget['literal'],legacyPage:DropTarget['legacyPage'];
  // URI parameters encode file names independently of URL fragments. A # or
  // bracket in the actual file name must not be reparsed as wiki syntax.
  if(/[#[\]]/.test(path)&&!hasAsciiControl(path)&&!/^([a-z][a-z\d+.-]*:|\/)/i.test(path)&&!path.includes('\\')){
   let page=1;
   if(/\.pdf$/i.test(path)&&url.hash){const match=/^#page=(\d+)$/.exec(url.hash);if(!match)return;page=Number(match[1]);if(!Number.isSafeInteger(page)||page<1)return;}
   literal={path,page};
   // Older URI producers encode the PDF page suffix inside the file parameter.
   // Resolve an actual complete filename first, then this exact PDF fallback.
   const match=!url.hash&&/^(.+\.pdf)#page=(\d+)$/i.exec(path);
   if(match){const page=Number(match[2]);if(Number.isSafeInteger(page)&&page>0)legacyPage={path:match[1],page};}
  }
  const target=url.hash&&path.includes('#')?undefined:linkTarget(path+url.hash,'uri');
  if(!target&&!literal)return;
  targets.push({...target||{link:path,page:1,kind:'uri',exactOnly:true},...(literal?{literal}:{}),...(legacyPage?{legacyPage}:{})});
 }
 return targets.length?targets:undefined;
}
function transferTargets(transfer:Pick<DataTransfer,'getData'>|null,vaultName:string):DropTarget[]|undefined {
 const read=(type:string)=>{try{return transfer?.getData(type).trim()||'';}catch{return '';}};
 // An explicit URI payload is authoritative over a display label in text/plain.
 const uris=read('text/uri-list');if(uris)return uriTargets(uris,vaultName,true);
 const text=read('text/plain');if(!text)return;
 if(/^obsidian:/i.test(text))return uriTargets(text,vaultName);
 if(text.startsWith('[[')||text.startsWith('![['))return wikiTargets(text);
 if(text.startsWith('[')||text.startsWith('![')){const targets=markdownTargets(text);if(targets)return targets;}
 const targets:DropTarget[]=[];
 for(const line of text.split(/\r\n?|\n/).map(value=>value.trim()).filter(Boolean)){
  const target=linkTarget(line,'path');if(!target||!isSupportedPath(target.link)&&!isSupportedPath(target.literal?.path||''))return;targets.push(target);
 }
 return targets.length?targets:undefined;
}

/** Resolve existing current-vault note/media references without creating files or inspecting a board.
 * Exact native file identities are authoritative, including stale supported files; fallback
 * text must consist entirely of references so ordinary prose remains ordinary text. */
export function resolveNativeNoteDrop<F extends NativeNoteFile>(lookup:NativeNoteDropLookup<F>,transfer:Pick<DataTransfer,'getData'>|null,draggable:unknown,sourcePath:string):NativeNoteDropResult<F> {
 const references:NativeNoteReference<F>[]=[],seen=new Set<string>();
 const supported=(value:unknown):value is F=>lookup.isFile(value)&&isSupportedPath('.'+value.extension);
 const add=(value:unknown,page=1)=>{
  if(!supported(value)||lookup.getFile(value.path)!==value)return false;
  if(value.extension.toLowerCase()!=='pdf')page=1;
  const key=value.path+'\0'+page;if(!seen.has(key)){seen.add(key);references.push({file:value,path:value.path,page});}return true;
 };
 const result=(handled=references.length>0):NativeNoteDropResult<F>=>({handled,references});
 const resolveTarget=(target:DropTarget,path:string):NativeNoteReference<F>|undefined=>{
  if(target.literal){
   const literal=target.literal.path,folder=path.slice(0,path.lastIndexOf('/')+1);
   const relative=target.kind==='wiki'?vaultRelativePath(folder+literal):undefined;
   const file=lookup.getFile(literal)||(target.kind!=='path'?lookup.getFile(literal+'.md'):undefined)
    ||(relative?(lookup.getFile(relative)||lookup.getFile(relative+'.md')):undefined);
   if(supported(file))return{file,path:file.path,page:target.literal.page};
  }
  if(target.legacyPage){const file=lookup.getFile(target.legacyPage.path);if(supported(file))return{file,path:file.path,page:target.legacyPage.page};}
  if(target.exactOnly)return;
  const relative=target.kind==='wiki'?vaultRelativePath(path.slice(0,path.lastIndexOf('/')+1)+target.link):undefined;
  const file=target.kind==='wiki'?(lookup.getFile(target.link)||(relative?lookup.getFile(relative):undefined)||lookup.resolve(target.link,path)):target.kind==='uri'?(lookup.getFile(target.link)||lookup.getFile(target.link+'.md')||lookup.resolve(target.link,path)):lookup.getFile(target.link);
  if(supported(file))return{file,path:file.path,page:target.page};
 };
 if(draggable!==undefined&&draggable!==null){
  if(!isRecord(draggable))return result(false);
  if(draggable.type==='file'){const handled=supported(draggable.file);if(handled)add(draggable.file);return result(handled);}
  if(draggable.type==='files'){
   if(!isUnknownArray(draggable.files))return result(false);const handled=draggable.files.some(supported);
   // Multi-select is one user operation: do not silently skip an invalid file.
   for(const file of draggable.files)if(!add(file)){references.length=0;return result(handled);}return result(handled);
  }
  if(draggable.type!=='link')return result(false);
  const target=nativeLinkTarget(draggable.linktext);
  if(draggable.file!==undefined&&draggable.file!==null){const handled=supported(draggable.file);if(handled)add(draggable.file,target?.page);return result(handled);}
  if(!target)return result(false);
  const ref=resolveTarget(target,typeof draggable.sourcePath==='string'?draggable.sourcePath:sourcePath);if(ref)add(ref.file,ref.page);return result();
 }
 const targets=transferTargets(transfer,lookup.vaultName);if(!targets)return result(false);
 for(const target of targets){
  const ref=resolveTarget(target,sourcePath);
  if(!ref||!add(ref.file,ref.page)){references.length=0;return result(false);}
 }
 return result();
}
// Keep the pure decoder aligned with content-tools.isImage without loading Obsidian UI.
export function isNativeImagePath(path:string){return /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(path);}
function isSupportedPath(path:string){return /\.(md|pdf)$/i.test(path)||isNativeImagePath(path);}
function vaultRelativePath(path:string):string|undefined{
 const segments:string[]=[];
 for(const segment of path.split('/')){if(!segment||segment==='.')continue;if(segment==='..'){if(!segments.length)return;segments.pop();}else segments.push(segment);}
 return segments.join('/');
}
import {hasAsciiControl,isRecord,isUnknownArray} from './value-guards';
import {markdownLinkRanges} from './markdown-links';
