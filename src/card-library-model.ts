import type {Board,Card} from './model';
import {removeNodes} from './model';
import {mediaKind} from './media-source';

/** A library card is a normal Markdown note. Boards store a reference, never a copy of the body. */
export function isLibraryCard(node:Card):node is Card&{kind:'card';file:string}{
 return node.kind==='card'&&typeof node.file==='string'&&/\.md$/i.test(node.file)&&!node.webUrl;
}
/** Legacy note cards omit `library` and are still references. New placements set the flag. */
export function isExplicitLibraryReference(node:Card):boolean{return isLibraryCard(node)&&(node.library===undefined||node.library===true);}
export function libraryPath(value:string):string{
 const path=value.trim();
 if(!path||path.length>8192||path!==value.trim()||!/\.md$/i.test(path)||/^[a-z][a-z\d+.-]*:/i.test(path)||path.startsWith('/')||path.includes('\\')||path.split('/').some(part=>part===''||part==='.'||part==='..'))throw Error('请选择仓库中的 Markdown 笔记');
 return path;
}
/** Place a reference. The note body is not copied onto the board. */
export function placeExistingCard(board:Board,path:string,position:{x:number;y:number},id:string,width=320):Card{
 const file=libraryPath(path);
 if(!id.trim()||![position.x,position.y,width].every(Number.isFinite)||width<80)throw Error('卡片位置无效');
 const node:Card={id,kind:'card',library:true,file,transparent:true,x:position.x-width/2,y:position.y-70,width,height:270,color:'slate',autoFit:true,preferredWidth:width};
 board.nodes.push(node);
 if(board.version<3)board.version=3;
 return node;
}
/** Remove whiteboard references. The returned paths are the notes that stay in the vault. */
export function unlinkLibraryCards(board:Board,ids:ReadonlySet<string>):string[]{
 const paths:string[]=[];
 for(const id of ids){
  const node=board.nodes.find(item=>item.id===id);
  if(!node||!isLibraryCard(node))throw Error('只能移除笔记卡片的白板引用');
  if(node.locked)throw Error('请先解锁对象再移出');
  paths.push(node.file);
 }
 removeNodes(board,new Set(ids));
 return paths;
}
export const libraryIndexLimit=200;
/** Stable order, then the first 200. The rest stay listed so a later search can open them. */
export function libraryIndexFiles<T extends {path:string}>(files:readonly T[],limit=libraryIndexLimit):{files:T[];omitted:T[];limited:boolean}{
 const sorted=[...files].sort((a,b)=>a.path.localeCompare(b.path)||0);
 return {files:sorted.slice(0,limit),omitted:sorted.slice(limit),limited:sorted.length>limit};
}
/** What to tell the user after searching boards the first pass did not index. */
export function librarySearchMessage(found:boolean,unread:number):string|undefined{
 if(found)return;
 return unread?`其余白板里没有找到这张卡片。还有 ${unread} 块白板未能读取。`:'其余白板里没有这张卡片';
}
export function libraryPlacements(nodes:readonly Pick<Card,'id'|'kind'|'file'>[]):{id:string;file:string}[]{
 const places:{id:string;file:string}[]=[];
 for(const node of nodes)if(node.id&&node.kind==='card'&&node.file&&/\.md$/i.test(node.file))places.push({id:node.id,file:node.file});
 return places;
}
export function libraryFilesOnBoard(nodes:readonly Pick<Card,'kind'|'file'>[]):string[]{
 const files=new Set<string>();
 for(const node of nodes)if(node.file&&(node.kind==='card'&&/\.md$/i.test(node.file)||node.kind==='pdf'||node.kind==='image'||node.kind==='audio'||node.kind==='video'))files.add(node.file);
 return [...files];
}
export type LibraryCardType='note'|'pdf'|'image'|'audio'|'video';
export function libraryCardType(path:string):LibraryCardType{
 if(/\.pdf$/i.test(path))return 'pdf';
 if(/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(path))return 'image';
 const media=mediaKind(path);
 if(media==='audio'||media==='video')return media;
 return 'note';
}
export const libraryTypeNames:Record<LibraryCardType,string>={note:'笔记',pdf:'PDF',image:'图片',audio:'音频',video:'视频'};
