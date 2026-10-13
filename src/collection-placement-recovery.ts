import {clone,type Board} from './model';

function validNotePath(path:string):boolean {
 return typeof path==='string'&&path.length>0&&path.length<=4096&&!path.startsWith('/')&&!path.includes('\\')&&!/^[a-z][a-z\d+.-]*:/i.test(path)&&
  !Array.from(path).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)&&!path.split('/').some(part=>!part||part==='.'||part==='..')&&/\.md$/i.test(path);
}

/** Plan only the retained receipt's source renames. The caller separately proves
 * live TFile/owner identities, native ownership and the unchanged disk baseline.
 * A stale receipt is an error; undefined means a fully checked no-op. */
export function planCollectionReferenceRename(board:Board,expectedStamp:string,refs:readonly {id:string;path:string;nextPath:string}[]):Board|undefined {
 if(JSON.stringify(board)!==expectedStamp)throw Error('投递草稿已变化，不能自动更新引用路径');
 const ids=new Set<string>(),updates=new Map<number,string>();
 for(const reference of refs){
  if(typeof reference.id!=='string'||!reference.id||ids.has(reference.id))throw Error('投递引用标识无效或重复，请核对原卡片');
  ids.add(reference.id);
  if(!validNotePath(reference.path)||!validNotePath(reference.nextPath))throw Error('投递引用路径无效，请核对原笔记');
  const matches=board.nodes.flatMap((node,index)=>node.id===reference.id?[index]:[]);
  if(matches.length!==1)throw Error('投递卡片已移除或标识重复，请核对原卡片');
  const index=matches[0],node=board.nodes[index];
  if(node.kind!=='card'||node.file!==reference.path)throw Error('投递卡片或来源已变化，请核对原卡片');
  if(reference.nextPath!==reference.path)updates.set(index,reference.nextPath);
 }
 if(!updates.size)return;
 const draft=clone(board);
 for(const[index,path]of updates)draft.nodes[index].file=path;
 return draft;
}
