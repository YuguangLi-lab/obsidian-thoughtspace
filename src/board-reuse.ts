import {Board,Card,Edge,clone,contained} from './model';
import {branchDescendants} from './mindmap';
import {markdownRows} from './markdown-context';
import {textExcerptPresentation} from './excerpt-sources';
export interface ReuseBundle{nodes:Card[];edges:Edge[];externalEdges:number;}
export interface ReuseOptions{branches:boolean;placement:'right'|'below';frame:string;}
export function reuseBundle(board:Board,selected:ReadonlySet<string>,branches=true):ReuseBundle{
 const byId=new Map(board.nodes.map(n=>[n.id,n]));if(!selected.size||[...selected].some(id=>!byId.has(id)))throw Error('所选内容已变化，请重新选择');
 const ids=new Set(selected);let previous=-1;
 while(previous!==ids.size){previous=ids.size;for(const n of board.nodes)if(n.kind==='section'&&ids.has(n.id))for(const child of board.nodes)if(contained(n,child))ids.add(child.id);const roots=new Set(board.nodes.filter(n=>ids.has(n.id)&&(branches||n.branchFolded)).map(n=>n.id));branchDescendants(board,roots).forEach(id=>ids.add(id));}
 return {nodes:clone(board.nodes.filter(n=>ids.has(n.id))),edges:clone(board.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))),externalEdges:board.edges.filter(e=>ids.has(e.from)!==ids.has(e.to)).length};
}
export function reuseStamp(board:Board){return JSON.stringify({nodes:board.nodes,edges:board.edges});}
export function reuseBounds(nodes:readonly Card[]){let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const n of nodes){x=Math.min(x,n.x);y=Math.min(y,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}return nodes.length?{x,y,width:right-x,height:bottom-y}:{x:0,y:0,width:0,height:0};}
/** Build a detached addition. Existing nodes, references, metadata and viewport remain untouched. */
export function reusePlan(bundle:ReuseBundle,target:Board,options:ReuseOptions,id:()=>string){
 if(!bundle.nodes.length)throw Error('没有可复用的内容');if(options.frame.length>100)throw Error('分组名称最多 100 个字符');
 const used=new Set([...target.nodes,...target.edges].map(n=>n.id)),fresh=()=>{const next=id();if(!next||used.has(next))throw Error('对象标识冲突，请重试');used.add(next);return next;},map=new Map(bundle.nodes.map(n=>[n.id,fresh()]));
 const source=reuseBounds(bundle.nodes),existing=reuseBounds(target.nodes),margin=options.frame.trim()?32:0;
 const x=target.nodes.length?(options.placement==='right'?existing.x+existing.width+96:existing.x):60,y=target.nodes.length?(options.placement==='below'?existing.y+existing.height+96:existing.y):60;
 const nodes=bundle.nodes.map(n=>({...clone(n),id:map.get(n.id)!,x:n.x-source.x+x+margin,y:n.y-source.y+y+(margin?60:0)}));
 const edges=bundle.edges.map(e=>({...clone(e),id:fresh(),from:map.get(e.from)!,to:map.get(e.to)!}));
 if(edges.some(e=>!e.from||!e.to))throw Error('所选连线包含失效对象');
 if(options.frame.trim())nodes.unshift({id:fresh(),kind:'section',title:options.frame.trim(),x,y,width:Math.max(80,source.width+64),height:Math.max(60,source.height+92),color:'green'});
 if(nodes.some(n=>![n.x,n.y,n.width,n.height].every(Number.isFinite)))throw Error('对象位置超出有效范围');
 // Batch previews resolve target references once. Small selections retain
 // early-exit lookup, counting each independent source card instance.
 const notes=bundle.nodes.filter(n=>n.kind==='card');let reusedNotes=0;
 if(notes.length<=8)reusedNotes=notes.filter(n=>target.nodes.some(t=>t.kind==='card'&&t.file===n.file)).length;
 else{
  const counts=new Map<Card['file'],number>();for(const n of notes)counts.set(n.file,(counts.get(n.file)||0)+1);
  const notePaths=counts.size>8?new Set(target.nodes.filter(t=>t.kind==='card').map(t=>t.file)):undefined;
  for(const [file,count]of counts)if(notePaths?notePaths.has(file):target.nodes.some(t=>t.kind==='card'&&t.file===file))reusedNotes+=count;
 }
 return {nodes,edges,reusedNotes};
}
/** Rebase recognized citation lines only. Code/prose containing the same literal stay unchanged. */
export function rebaseReuseSources(text:string,link:(source:string)=>string){
 const lines=text.split('\n'),rows=[...markdownRows(text)];textExcerptPresentation(text,(index,source,literalTail)=>{const row=rows[index];if(!literalTail&&(row.code||!row.visible.trim()))return;lines[index]=row.source.replace(source.link,()=>link(source.link));});return lines.join('\n');
}
