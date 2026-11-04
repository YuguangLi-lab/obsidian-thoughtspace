import type {Board} from './model';
/** Paths a board paints or would refresh when the vault file changes. */
export function collectReferencedPaths(board:Board):Set<string>{
 const paths=new Set<string>();
 for(const node of board.nodes){
  if(node.file)paths.add(node.file);
  if(node.paragraphQuote?.path)paths.add(node.paragraphQuote.path);
  if(node.pdfExcerpt?.path)paths.add(node.pdfExcerpt.path);
  if(node.pdfQuote?.sourcePath)paths.add(node.pdfQuote.sourcePath);
 }
 return paths;
}
const under=(path:string,root:string)=>path===root||path.startsWith(root.endsWith('/')?root:root+'/');
/** A vault path, its previous name, or a folder prefix of either. */
export function pathTouches(paths:ReadonlySet<string>,path:string,oldPath?:string):boolean{
 if(paths.has(path)||(oldPath!==undefined&&paths.has(oldPath)))return true;
 for(const item of paths)if(under(item,path)||(oldPath!==undefined&&under(item,oldPath)))return true;
 return false;
}
