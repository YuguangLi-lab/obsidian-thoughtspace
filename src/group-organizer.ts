import {Board,Card,assertBoardGeometry,expandedSelection} from './model';
import {branchState,foldedMoveUnits,validateBranches} from './mindmap';
import {SectionRect,sectionContains,sectionMemberQuery} from './sections';

export interface OutlineRow {node:Card;depth:number;parentId?:string;childCount:number;descendantCount:number;expanded:boolean;matched:boolean;}
export interface OutlineOptions {query?:string;kind?:Card['kind']|'all';collapsed?:ReadonlySet<string>;name?:(node:Card)=>string;}
const spatialOrder=(a:Card,b:Card)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id);
const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().trim();
export const groupNodeName=(node:Card)=>node.title||node.text?.split(/\r?\n/).find(line=>line.trim())?.replace(/^#+\s*/,'').slice(0,100)||node.file?.split('/').pop()||'未命名分组';

/** Each object appears exactly once. Strict geometric containment excludes coincident
 * frame cycles; the smallest frame owns an overlapping object deterministically. */
export function outlineTree(board:Board,options:OutlineOptions={}):OutlineRow[]{
 const groups=board.nodes.filter(node=>node.kind==='section').sort((a,b)=>a.width*a.height-b.width*b.height||spatialOrder(a,b));
 const children=new Map<string,Card[]>(),parents=new Map<string,string>(),roots:Card[]=[];
 for(const node of board.nodes){const parent=groups.find(group=>sectionContains(group,node));if(parent){parents.set(node.id,parent.id);const list=children.get(parent.id)||[];list.push(node);children.set(parent.id,list);}else roots.push(node);}
 roots.sort(spatialOrder);for(const list of children.values())list.sort(spatialOrder);
 const query=normalize(options.query||''),tokens=query.split(/\s+/).filter(Boolean),filtering=!!query||!!options.kind&&options.kind!=='all';
 const matches=new Set<string>(),included=new Set<string>(),totals=new Map<string,number>(),order:Card[]=[],pending=[...roots].reverse();
 while(pending.length){const node=pending.pop()!;order.push(node);const list=children.get(node.id)||[];for(let i=list.length-1;i>=0;i--)pending.push(list[i]);
  const haystack=tokens.length?normalize([options.name?.(node)||groupNodeName(node),node.file||'',node.text||''].join('\n')):'';
  if((!options.kind||options.kind==='all'||node.kind===options.kind)&&tokens.every(token=>haystack.includes(token))){matches.add(node.id);included.add(node.id);}
 }
 // A single reverse pass retains matching ancestors and counts all descendants.
 for(let i=order.length-1;i>=0;i--){const node=order[i],parent=parents.get(node.id);if(parent){totals.set(parent,(totals.get(parent)||0)+(totals.get(node.id)||0)+1);if(included.has(node.id))included.add(parent);}}
 const rows:OutlineRow[]=[],stack=roots.slice().reverse().map(node=>({node,depth:0}));
 while(stack.length){const {node,depth}=stack.pop()!;if(filtering&&!included.has(node.id))continue;const list=children.get(node.id)||[],expanded=!!list.length&&(filtering||!options.collapsed?.has(node.id));
  rows.push({node,depth,parentId:parents.get(node.id),childCount:list.length,descendantCount:totals.get(node.id)||0,expanded,matched:matches.has(node.id)});
  if(expanded)for(let i=list.length-1;i>=0;i--)stack.push({node:list[i],depth:depth+1});
 }
 return rows;
}

export interface GroupMovePlan {targetId:string;selection:string[];ids:string[];originals:Card[];items:Card[];target:{original:Card;next:Card};signature:string;delta:{x:number;y:number};expanded:boolean;}
const geometrySignature=(board:Board)=>JSON.stringify([board.nodes.map(n=>[n.id,n.kind,n.x,n.y,n.width,n.height,!!n.locked,!!n.branchFolded,!!n.sectionFolded]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),board.edges.filter(e=>e.kind==='branch').map(e=>[e.from,e.to]).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]))]);
function bounds(nodes:readonly Card[]):SectionRect {let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const n of nodes){x=Math.min(x,n.x);y=Math.min(y,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}return{x,y,width:right-x,height:bottom-y};}

/** Open groups carry nested frames too. A folded branch is indivisible, including
 * linked descendants outside its frame. No ordinary relation edge expands selection. */
function movementIds(board:Board,selection:ReadonlySet<string>):Set<string>{
 const nodes=new Map(board.nodes.map(n=>[n.id,n])),{children,hidden}=branchState(board),members=sectionMemberQuery(board.nodes),ids=new Set<string>(),seen=new Map<string,boolean>();
 const pending=[...selection].filter(id=>!hidden.has(id)).map(id=>({id,branch:false}));
 // Reuse the shared folded-content movement semantics for visible content roots.
 for(const unit of foldedMoveUnits(board,selection))for(const node of unit.members)pending.push({id:node.id,branch:false});
 while(pending.length){const entry=pending.pop()!,node=nodes.get(entry.id);if(!node)throw Error('所选对象已删除，请重新选择');
  const branch=entry.branch||!!node.branchFolded,previous=seen.get(node.id);if(previous===true||previous===false&&!branch)continue;seen.set(node.id,branch);ids.add(node.id);
  if(node.locked)throw Error('所选对象或分组内容已锁定，请先解锁');
  if(node.kind==='section')for(const member of members(node))pending.push({id:member.id,branch:(branch||!!node.sectionFolded)&&member.kind==='section'});
  if(branch)for(const id of children.get(node.id)||[])pending.push({id,branch:true});
 }
 if([...selection].some(id=>!ids.has(id)))throw Error('所选内容已隐藏，请先展开分组或选择整个折叠分支');
 // Overlapping open frames can contain only part of somebody else's hidden unit.
 // Moving that frame must not split the folded branch through geometry alone.
 if([...ids].some(id=>hidden.has(id)))for(const root of board.nodes)if(!ids.has(root.id)&&(root.branchFolded||root.sectionFolded)){
  const unit=expandedSelection(board,new Set([root.id]));if([...ids].some(id=>unit.has(id)))throw Error('分组与其他折叠分支重叠，请先展开该分支后再移动');
 }
 return ids;
}

function validateDestination(board:Board,moving:Set<string>,target:Card,next:Card,items:Card[]){
 const positions=new Map(items.map(n=>[n.id,n])),stationary=board.nodes.filter(n=>!moving.has(n.id)&&n.id!==target.id);
 for(const node of stationary)if(sectionContains(next,node)&&!sectionContains(target,node))throw Error('分组扩容会包含其他对象，请先腾出目标分组下方或右侧空间');
 for(const group of stationary.filter(n=>n.kind==='section')){
  if(sectionContains(group,target)&&!sectionContains(group,next))throw Error('目标分组扩容会超出上级分组，请先扩大上级分组');
  for(const node of items)if(sectionContains(group,node)&&!sectionContains(group,next))throw Error('移动后会进入其他分组，请先腾出目标分组周围空间');
 }
 // Moving a frame must not acquire unrelated stationary content at its destination.
 for(const group of items.filter(n=>n.kind==='section'))for(const node of stationary)if(sectionContains(group,node))throw Error('移动后的分组会包含其他对象，请先腾出目标分组周围空间');
 const preview={...board,nodes:board.nodes.map(n=>n.id===target.id?next:positions.get(n.id)||n)};assertBoardGeometry(preview);validateBranches(preview);
}

/** Keep the selected arrangement as one block and append below/right of existing
 * target contents. A proposal never mutates the board or the camera. */
export function planGroupMove(board:Board,selection:ReadonlySet<string>,targetId:string):GroupMovePlan {
 if(!selection.size)throw Error('请先选择要移入分组的对象');assertBoardGeometry(board);validateBranches(board);
 const target=board.nodes.find(n=>n.id===targetId&&n.kind==='section');if(!target)throw Error('目标分组已删除，请重新选择');if(target.locked)throw Error('目标分组已锁定，请先解锁');
 const moving=movementIds(board,selection);if(moving.has(targetId))throw Error('不能移入自身或自己的子分组');
 const originals=board.nodes.filter(n=>moving.has(n.id)).map(n=>({...n})),originalBounds=bounds(originals),existing=board.nodes.filter(n=>!moving.has(n.id)&&sectionContains(target,n));
 if(originals.every(node=>sectionContains(target,node)))throw Error('所选内容已在该分组内');
 let right=target.x+30,bottom=target.y+60;for(const node of existing){right=Math.max(right,node.x+node.width+32);bottom=Math.max(bottom,node.y+node.height+32);}
 const candidates=[{x:target.x+30,y:bottom},{x:right,y:target.y+60}].map(point=>{
  const delta={x:point.x-originalBounds.x,y:point.y-originalBounds.y},items=originals.map(n=>({...n,x:n.x+delta.x,y:n.y+delta.y}));
  const next={...target,width:Math.max(target.width,point.x-target.x+originalBounds.width+30),height:Math.max(target.height,point.y-target.y+originalBounds.height+30)};return{delta,items,next};
 }).sort((a,b)=>a.next.width*a.next.height-b.next.width*b.next.height);
 let failure:unknown;for(const candidate of candidates){try{validateDestination(board,moving,target,candidate.next,candidate.items);return{targetId,selection:[...selection].sort(),ids:originals.map(n=>n.id),originals,items:candidate.items,target:{original:{...target},next:candidate.next},signature:geometrySignature(board),delta:candidate.delta,expanded:candidate.next.width!==target.width||candidate.next.height!==target.height};}catch(e){failure=e;}}
 throw failure;
}

/** Recompute every safety condition before the first write. Changes to any frame,
 * obstacle, fold or branch invalidate a preview, including asynchronous auto-fit. */
export function applyGroupMove(board:Board,plan:GroupMovePlan):void{
 if(geometrySignature(board)!==plan.signature)throw Error('白板位置、尺寸或锁定状态已变化，请刷新预览后再应用');
 const current=planGroupMove(board,new Set(plan.selection),plan.targetId);
 const proposal=(p:GroupMovePlan)=>JSON.stringify([p.ids,p.items.map(n=>[n.id,n.x,n.y,n.width,n.height]),[p.target.next.x,p.target.next.y,p.target.next.width,p.target.next.height]]);
 if(proposal(current)!==proposal(plan))throw Error('移动预览无效，请重新生成');
 const positions=new Map(current.items.map(n=>[n.id,n]));for(const node of board.nodes){const next=positions.get(node.id);if(next){node.x=next.x;node.y=next.y;}else if(node.id===current.targetId){node.width=current.target.next.width;node.height=current.target.next.height;}}
}
