import {imageMarkdown} from './image-host';
import {fileReference} from './journal-links-model';
import type {Board,Card} from './model';
import {validateBranches} from './mindmap';
/** Iterative subtree order follows visual sibling order; ordinary links are not children. */
export function branchOutline(board:Board,rootId:string){
 validateBranches(board);const nodes=new Map(board.nodes.map(n=>[n.id,n])),root=nodes.get(rootId);if(!root||root.kind==='section')throw Error('请选择一个导图主题');
 const children=new Map<string,Card[]>();for(const e of board.edges)if(e.kind==='branch'){const list=children.get(e.from)||[];list.push(nodes.get(e.to)!);children.set(e.from,list);}
 if(!board.mindmapLayout)for(const list of children.values())list.sort((a,b)=>board.mindmapDirection==='down'?a.x-b.x||a.y-b.y:a.y-b.y||a.x-b.x);
 const rows:{node:Card;depth:number}[]=[],stack=[{node:root,depth:0}];while(stack.length){const row=stack.pop()!;rows.push(row);if(rows.length>2000||row.depth>100)throw Error('分支过大，请选择较小的子分支（最多 2,000 个主题、100 层）');for(const node of [...(children.get(row.node.id)||[])].reverse())stack.push({node,depth:row.depth+1});}return rows;
}
export function branchMarkdown(board:Board,rootId:string){
 const rows=branchOutline(board,rootId),parts:string[]=[];let size=0;
 for(const {node,depth} of rows){const raw=node.kind==='image'&&node.imageUrl?imageMarkdown(node.imageUrl):node.kind==='text'?node.text||'未命名主题':node.file?`${node.kind==='image'?'!':''}${fileReference(node.file)}`:node.title||'未命名主题';
  const lines=raw.replace(/\r\n?/g,'\n').trim().split('\n'),indent='  '.repeat(depth),text=lines.map((line,i)=>indent+(i?'  ':'- ')+line).join('\n');size+=text.length;if(size>500000)throw Error('分支内容超过 500,000 字符，请分段整理');parts.push(text);
 }
 return parts.join('\n')+'\n';
}
export function reparentBranch(board:Board,rootId:string,parentId:string|undefined,newEdgeId:string){
 const parents=validateBranches(board),nodes=new Map(board.nodes.map(n=>[n.id,n])),root=nodes.get(rootId),oldParent=parents.get(rootId);
 if(!root||root.kind==='section'||root.locked||oldParent&&nodes.get(oldParent)?.locked)throw Error('请先解锁主题及原父主题');
 if(parentId===oldParent)return false;
 if(parentId!==undefined){const parent=nodes.get(parentId);if(!parent||parent.kind==='section'||parent.locked)throw Error('新父主题不可用或已锁定');let p:string|undefined=parentId;while(p){if(p===rootId)throw Error('不能移动到自身或子主题下');p=parents.get(p);}}
 const incoming=board.edges.find(e=>e.kind==='branch'&&e.to===rootId);
 if(parentId!==undefined&&!incoming&&board.edges.some(e=>e.id===newEdgeId))throw Error('连线标识已存在');
 if(parentId===undefined)board.edges=board.edges.filter(e=>e!==incoming);
 else if(incoming){incoming.from=parentId;delete incoming.fromSide;}
 else board.edges.push({id:newEdgeId,from:parentId,to:rootId,kind:'branch',label:'',direction:'none',style:'curve',color:root.color});
 board.version=3;root.topic=true;if(parentId)nodes.get(parentId)!.topic=true;return true;
}
