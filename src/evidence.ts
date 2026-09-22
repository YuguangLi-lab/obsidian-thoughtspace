import {Board,Card} from './model';
import {branchState} from './mindmap';
export type MaterialPoint={x:number;y:number;targetId?:string};
/** Reverse paint order, excluding folded descendants. A locked target is rejected, not bypassed. */
export function evidenceTarget(board:Board,point:{x:number;y:number}):Card|undefined{
 const hidden=branchState(board).hidden;
 // Non-note objects occlude notes too; only section frames are painted behind them.
 for(let i=board.nodes.length-1;i>=0;i--){
  const n=board.nodes[i];
  if(n.kind==='section'||hidden.has(n.id)||point.x<n.x||point.x>n.x+n.width||point.y<n.y||point.y>n.y+n.height)continue;
  return n.kind==='card'?n:undefined;
 }
 return undefined;
}
export function appendEvidence(raw:string,evidence:string){
 if(!evidence.trim())throw Error('摘录为空');if(evidence.length>500000)throw Error('单次证据过长，请分段拖入');
 const eol=raw.includes('\r\n')?'\r\n':'\n',block='> [!quote] 证据摘录'+eol+evidence.replace(/\r\n?/g,'\n').split('\n').map(line=>'> '+line).join(eol);
 return raw+(raw.endsWith(eol+eol)?'':raw.endsWith(eol)?eol:eol+eol)+block+eol;
}
