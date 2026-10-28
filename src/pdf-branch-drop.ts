import {clone,type Board,type Card} from './model';
import {validateBranches,branchState} from './mindmap';
import {reparentBranch} from './mindmap-flow';
export interface PdfBranchLanding {target:string;relation:'child'|'before'|'after';stamp:string}
export const pdfBranchStamp=(board:Board)=>JSON.stringify([board.nodes.map(n=>[n.id,n.kind,n.locked,n.x,n.y,n.width,n.height]),board.edges.filter(e=>e.kind==='branch')]);
export function pdfBranchLanding(board:Board,point:{x:number;y:number},exclude:ReadonlySet<string>=new Set()):PdfBranchLanding|undefined{
 const hidden=branchState(board).hidden;
 for(const n of [...board.nodes].reverse()){if(n.kind==='section'||hidden.has(n.id)||exclude.has(n.id)||point.x<n.x||point.x>n.x+n.width||point.y<n.y||point.y>n.y+n.height)continue;const fraction=(point.y-n.y)/n.height;return{target:n.id,relation:fraction<.2?'before':fraction>.8?'after':'child',stamp:pdfBranchStamp(board)};}
}
/** One draft contains insertion/reparenting and all geometry; callers commit once. */
export function applyPdfBranch(board:Board,node:Card,landing:PdfBranchLanding,edgeId:string,existing=false){
 if(pdfBranchStamp(board)!==landing.stamp)throw Error('分支或对象位置已变化，请重新拖动');const before=clone(board),parents=validateBranches(board),target=board.nodes.find(n=>n.id===landing.target);if(!target||target.locked||target.id===node.id||target.kind==='section')throw Error('目标分支不可用');
 const parent=landing.relation==='child'?target.id:parents.get(target.id);if(parent&&board.nodes.find(n=>n.id===parent)?.locked)throw Error('父主题已锁定');
 if(!existing){if(board.nodes.some(n=>n.id===node.id))throw Error('摘录标识重复');board.nodes.push(node);}else if(board.nodes.find(n=>n.id===node.id)!==node)throw Error('被移动节点已变化');
 try{reparentBranch(board,node.id,parent,edgeId);node.topic=true;if(landing.relation==='child'){if(!existing){node.x=target.x+target.width+48;node.y=target.y+target.height+24;}}else{if(!existing){node.x=target.x;node.y=landing.relation==='before'?target.y-node.height-24:target.y+target.height+24;}const ref=board.edges.find(e=>e.kind==='branch'&&e.to===target.id),own=board.edges.find(e=>e.kind==='branch'&&e.to===node.id);if(ref&&own&&ref!==own){board.edges=board.edges.filter(e=>e!==own);board.edges.splice(board.edges.indexOf(ref)+(landing.relation==='after'?1:0),0,own);}}
  validateBranches(board);board.version=3;
 }catch(error){Object.assign(board,before);throw error;}
}
