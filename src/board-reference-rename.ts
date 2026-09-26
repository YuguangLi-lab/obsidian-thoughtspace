import type {Board} from './model';
import {rebaseReuseSources} from './board-reuse';
import {hasAsciiControl} from './value-guards';

export interface BoardReferenceRenameSnapshot<F> {newPath:string;files:{file:F;path:string;extension:string}[]}
/** TFile.path mutates in place; queued migrations need event-time strings and stable identities. */
export function captureBoardReferenceRename<F extends {path:string;extension:string}>(newPath:string,files:readonly F[]):BoardReferenceRenameSnapshot<F>{
 return{newPath,files:files.map(file=>({file,path:file.path,extension:file.extension}))};
}

const inPath=(path:string,root:string)=>path===root||path.startsWith(root+'/');
function normalizePath(path:string,base=''):string|undefined {
 if(!path||hasAsciiControl(path)||path.startsWith('/')||path.includes('\\')||/^[a-z][a-z\d+.-]*:/i.test(path))return;
 const parts=base?base.split('/'):[];
 for(const part of path.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return;parts.pop();}else parts.push(part);}
 return parts.join('/')||undefined;
}
const encodePath=(path:string)=>encodeURIComponent(path).replace(/%2F/gi,'/').replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());

/** Keep display labels, wiki aliases and the original encoded/unencoded subpath bytes. */
function sourceTarget(link:string):{path:string;replace:(path:string)=>string}|undefined {
 if(link.startsWith('[[')&&link.endsWith(']]')){
  const body=link.slice(2,-2),alias=body.indexOf('|'),target=alias<0?body:body.slice(0,alias),hash=target.indexOf('#');
  return{path:hash<0?target:target.slice(0,hash),replace:path=>'[['+path+(hash<0?'':target.slice(hash))+(alias<0?'':body.slice(alias))+']]'};
 }
 const markdown=/^(\[[^\n]*?\]\()(.+)(\))$/.exec(link);if(!markdown)return;
 const angle=markdown[2].startsWith('<')&&markdown[2].endsWith('>'),raw=angle?markdown[2].slice(1,-1):markdown[2];
 let decoded:string;try{decoded=decodeURIComponent(raw);}catch{return;}
 const hash=decoded.indexOf('#'),rawHash=raw.search(/#|%23/i),fragment=rawHash<0?'':raw.slice(rawHash);
 return{path:hash<0?decoded:decoded.slice(0,hash),replace:path=>markdown[1]+(angle?'<':'')+encodePath(path)+fragment+(angle?'>':'')+markdown[3]};
}

/** Build the pre-rename namespace once. Ambiguous short links remain untouched;
 * only existing, uniquely identified destinations may have their generated sources rewritten. */
export function createBoardReferenceRenamer(oldPath:string,newPath:string,currentPaths:readonly string[]){
 const move=(path:string)=>inPath(path,oldPath)?newPath+path.slice(oldPath.length):path;
 const previous=(path:string)=>inPath(path,newPath)?oldPath+path.slice(newPath.length):path;
 const destinations=new Map<string,Set<string>>(),byName=new Map<string,Set<string>>(),cache=new Map<string,string|undefined>();
 for(const path of currentPaths){
  const old=previous(path),name=old.slice(old.lastIndexOf('/')+1),targets=destinations.get(old)||new Set<string>();targets.add(path);destinations.set(old,targets);
  const names=byName.get(name)||new Set<string>();names.add(old);byName.set(name,names);
 }
 const resolve=(link:string,boardPath:string):string|undefined=>{
  const folder=boardPath.slice(0,Math.max(0,boardPath.lastIndexOf('/'))),key=folder+'\0'+link;if(cache.has(key))return cache.get(key);
  const candidates=new Set<string>(),variants=/\.(md|pdf)$/i.test(link)?[link]:[link,link+'.md'];
  const finish=()=>{
   const old=candidates.size===1?[...candidates][0]:undefined,targets=old?destinations.get(old):undefined;
   const result=targets?.size===1?[...targets][0]:undefined;cache.set(key,result);return result;
  };
  if(/^\.{1,2}\//.test(link)){
   for(const value of variants){const relative=normalizePath(value,folder);if(relative&&destinations.has(relative))candidates.add(relative);}return finish();
  }
  // Obsidian prefers a complete vault path over a same-named nested suffix.
  for(const value of variants){const rooted=normalizePath(value);if(rooted&&destinations.has(rooted))candidates.add(rooted);}
  if(candidates.size)return finish();
  // A spelled-out old source path must not be rescued by an unrelated suffix.
  if(variants.some(value=>{const rooted=normalizePath(value);return rooted!==undefined&&inPath(rooted,oldPath);}))return finish();
  for(const value of variants){
   const relative=normalizePath(value,folder);if(relative&&destinations.has(relative))candidates.add(relative);
   const rooted=normalizePath(value);if(!rooted)continue;
   const name=rooted.slice(rooted.lastIndexOf('/')+1);for(const path of byName.get(name)||[])if(path===rooted||path.endsWith('/'+rooted))candidates.add(path);
  }
  return finish();
 };
 return(board:Board,boardPath:string):Board|undefined=>{
  const oldBoard=previous(boardPath);let changed=false;
  const nodes=board.nodes.map(node=>{
   const file=node.file?move(node.file):undefined,note=node.videoCapture?move(node.videoCapture.note):undefined;
   const text=node.kind==='text'&&node.text?rebaseReuseSources(node.text,link=>{
    const target=sourceTarget(link);if(!target)return link;const destination=resolve(target.path,oldBoard);if(!destination)return link;
    // A board move can also change the meaning of a relative source link.
    if(previous(destination)===destination&&oldBoard===boardPath)return link;
    return target.replace(destination);
   }):node.text;
   if(file===node.file&&note===node.videoCapture?.note&&text===node.text)return node;
   changed=true;return{...node,...(file!==node.file?{file}:{}),...(note!==node.videoCapture?.note&&node.videoCapture?{videoCapture:{...node.videoCapture,note:note!}}:{}),...(text!==node.text?{text}:{})};
  });
  const draft=board.writing?.draftPath,draftPath=draft?move(draft):draft;
  if(draftPath!==draft)changed=true;
  return changed?{...board,nodes,...(draftPath!==draft&&board.writing?{writing:{...board.writing,draftPath}}:{})}:undefined;
 };
}
