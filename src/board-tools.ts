import {branchState} from './mindmap';
import { Board, Card, contained, selectionMemberships, movableSelection } from './model';
export interface Rect { x:number; y:number; width:number; height:number; }
export function selectionRect(a:{x:number;y:number},b:{x:number;y:number}):Rect { return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)}; }
/** 卡片相交即可选中；分组框必须被完整框住，避免意外选中覆盖整个场景的分组。 */
export function marqueeSelection(nodes:readonly Card[],r:Rect):Set<string> {
  if(!r.width||!r.height)return new Set();
  return new Set(nodes.filter(n=>n.kind==='section' ? n.x>=r.x&&n.y>=r.y&&n.x+n.width<=r.x+r.width&&n.y+n.height<=r.y+r.height : n.x<r.x+r.width&&n.x+n.width>r.x&&n.y<r.y+r.height&&n.y+n.height>r.y).map(n=>n.id));
}
export function foldCards(board:Board,ids:ReadonlySet<string>,fold:boolean){
  for(const n of board.nodes)if((n.kind==='card'||n.kind==='pdf'||n.kind==='board')&&!n.locked&&ids.has(n.id)){
    if(fold&&!n.collapsed){n.expandedHeight=n.height;n.height=72;n.collapsed=true;}
    else if(!fold&&n.collapsed){n.height=n.expandedHeight!;delete n.expandedHeight;delete n.collapsed;}
  }
}
export function moveSelection(board:Board,ids:Set<string>,dx:number,dy:number){const expanded=movableSelection(board,ids);for(const n of board.nodes)if(expanded.has(n.id)&&!n.locked){n.x+=dx;n.y+=dy;}}
export type Alignment='left'|'center-x'|'right'|'top'|'center-y'|'bottom'|'distribute-x'|'distribute-y';
export const alignmentLabels:Record<Alignment,string>={left:'左对齐','center-x':'水平居中',right:'右对齐',top:'顶端对齐','center-y':'垂直居中',bottom:'底端对齐','distribute-x':'水平等距分布','distribute-y':'垂直等距分布'};
export function alignSelection(board:Board,ids:ReadonlySet<string>,action:Alignment){
  const {hidden,parents}=branchState(board),selected=board.nodes.filter(n=>ids.has(n.id)&&!n.locked&&!hidden.has(n.id));
  const pinned=new Set<string>();for(const n of board.nodes)if(n.locked){let id=parents.get(n.id);while(id!==undefined&&!pinned.has(id)){pinned.add(id);id=parents.get(id);}}

  const sections=selected.filter(n=>n.kind==='section');
  const units=selected.filter(n=>!(n.branchFolded&&pinned.has(n.id))).filter(n=>!sections.some(s=>s.id!==n.id&&contained(s,n)));
  if(units.length<(action.startsWith('distribute')?3:2))throw new Error(action.startsWith('distribute')?'请至少选择三个独立对象':'请至少选择两个独立对象');
  const memberships=selectionMemberships(board,units);for(const[id,members]of memberships)memberships.set(id,members.filter(n=>!n.locked));
  const seen=new Set<string>();
  for(const unit of units)for(const member of [unit,...memberships.get(unit.id)!]){if(seen.has(member.id))throw new Error('选中的分组含有重叠成员，请分别调整');seen.add(member.id);}
  const left=Math.min(...units.map(n=>n.x)),right=Math.max(...units.map(n=>n.x+n.width)),top=Math.min(...units.map(n=>n.y)),bottom=Math.max(...units.map(n=>n.y+n.height));
  const targets=new Map<string,{x:number;y:number}>();
  if(action.startsWith('distribute')){
    const horizontal=action==='distribute-x',pos=horizontal?'x':'y',size=horizontal?'width':'height';
    const ordered=[...units].sort((a,b)=>a[pos]-b[pos]||a.id.localeCompare(b.id));
    const start=ordered[0][pos],end=ordered.at(-1)![pos]+ordered.at(-1)![size];
    const gap=(end-start-ordered.reduce((sum,n)=>sum+n[size],0))/(ordered.length-1);let cursor=start;
    for(const n of ordered){targets.set(n.id,{x:horizontal?cursor:n.x,y:horizontal?n.y:cursor});cursor+=n[size]+gap;}
  }else for(const n of units){let x=n.x,y=n.y;
    if(action==='left')x=left;if(action==='center-x')x=(left+right-n.width)/2;if(action==='right')x=right-n.width;
    if(action==='top')y=top;if(action==='center-y')y=(top+bottom-n.height)/2;if(action==='bottom')y=bottom-n.height;
    targets.set(n.id,{x,y});
  }
  for(const unit of units){const target=targets.get(unit.id)!,dx=target.x-unit.x,dy=target.y-unit.y;for(const n of [unit,...memberships.get(unit.id)!]){n.x+=dx;n.y+=dy;}}
}
