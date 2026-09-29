import {selectionExpansion,type Board,type Card} from './model';
import {branchState,branchTopology} from './mindmap';
import {sectionContains,sectionDisplayNode} from './sections';

const gap=24;
interface Rect {x:number;y:number;width:number;height:number}
interface Unit {root:Card;members:Card[];original:Rect;fixed:boolean;active:boolean;unsafe:boolean;tree?:boolean;probes?:Card[]}
const intersects=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const unfolds=(node:Card,old:Card)=>!!(old.collapsed&&!node.collapsed||old.branchFolded&&!node.branchFolded||old.sectionFolded&&!node.sectionFolded);
function bounds(nodes:readonly Card[]):Rect {
 let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
 for(const node of nodes){const n=sectionDisplayNode(node);x=Math.min(x,n.x);y=Math.min(y,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}
 return{x,y,width:right-x,height:bottom-y};
}

/** Repair only expansion-related collisions; transactions retain ownership of undo. */
export function reflowExpandedContent(board:Board,before:Board):void {
 let oldNodes:Map<string,Card>|undefined;
 const oldAt=(node:Card,index:number)=>{const old=before.nodes[index];return old?.id===node.id?old:!old&&!oldNodes?undefined:(oldNodes??=new Map(before.nodes.map(n=>[n.id,n]))).get(node.id);};
 let managedGrowth:Set<string>|undefined;
 const grows=(node:Card,old:Card)=>{
  if(node.kind==='section'||node.width<=old.width&&node.height<=old.height)return false;
  if(node.x===old.x&&node.y===old.y)return true;
  // Native automatic layout runs first and may recenter a growing leaf. Only
  // those managed trees may combine movement and growth in this repair pass.
  if(!managedGrowth){managedGrowth=new Set();const roots=board.nodes.filter(n=>n.mindmapRules?.automatic);if(roots.length){const {parents,children}=branchTopology(board),index=new Map(board.nodes.map(n=>[n.id,n]));for(const root of roots)if(!parents.has(root.id)){const tree=[root];for(let i=0;i<tree.length;i++)for(const id of children.get(tree[i].id)||[]){const child=index.get(id);if(child)tree.push(child);}if(!tree.some(n=>n.locked||n.kind==='section'))for(const n of tree)managedGrowth.add(n.id);}}}
  return managedGrowth.has(node.id);
 };
 // Ordinary changes keep node order, so no index, group scan or visibility pass
 // is needed for typing without growth, styling, shrinking, adding or dragging.
 const possible=board.nodes.some((n,i)=>{const old=oldAt(n,i);return!!old&&(grows(n,old)||unfolds(n,old));});
 if(!possible)return;
 oldNodes??=new Map(before.nodes.map(n=>[n.id,n]));
 const oldHidden=branchState(before).hidden,hidden=branchState(board).hidden,sources=new Set<string>(),revealed=new Set<string>();
 for(const n of board.nodes){const old=oldNodes.get(n.id);if(!old||hidden.has(n.id))continue;const a=sectionDisplayNode(old),b=sectionDisplayNode(n),opening=oldHidden.has(n.id)||unfolds(n,old);if(opening)revealed.add(n.id);if(oldHidden.has(n.id)||(opening||grows(n,old))&&(b.width>a.width||b.height>a.height))sources.add(n.id);}
 if(!sources.size)return;

 const nodes=new Map(board.nodes.map(n=>[n.id,n])),groups=board.nodes.filter(n=>n.kind==='section');
 const frozen=new Map(board.nodes.map(n=>[n.id,oldNodes!.get(n.id)||{...n}]));
 const owner=new Map<string,string>(),members=new Map(groups.map(g=>[g.id,new Set<string>()])),ambiguous=new Set<string>();
 const originalGroup=(g:Card)=>frozen.get(g.id)!;
 for(const n of board.nodes){
  const owners=groups.filter(g=>sectionContains(originalGroup(g),frozen.get(n.id)!)).sort((a,b)=>originalGroup(a).width*originalGroup(a).height-originalGroup(b).width*originalGroup(b).height||a.id.localeCompare(b.id));
  if(owners.length)owner.set(n.id,owners[0].id);
  for(const group of owners)members.get(group.id)!.add(n.id);
  for(let i=0;i<owners.length;i++)for(let j=i+1;j<owners.length;j++)if(!sectionContains(originalGroup(owners[i]),originalGroup(owners[j]))&&!sectionContains(originalGroup(owners[j]),originalGroup(owners[i]))){ambiguous.add(n.id);ambiguous.add(owners[i].id);ambiguous.add(owners[j].id);}
 }
 const depth=(id:string)=>{let level=0,at=owner.get(id);while(at!==undefined){level++;at=owner.get(at);}return level;};
 let expansion:ReturnType<typeof selectionExpansion>|undefined;
 const materials=new Map<string,Card[]>();
 const material=(root:Card):Card[]=>{
  const known=materials.get(root.id);if(known)return known;
  const ids=new Set([root.id,...(members.get(root.id)||[])]);
  // Capture complete hidden movement units before any position changes. Group
  // containment itself always comes from the pre-expansion geometry above.
  for(const id of [...ids])if(nodes.get(id)?.branchFolded||nodes.get(id)?.sectionFolded){expansion??=selectionExpansion(board,true);for(const child of expansion.expand(new Set([id])))ids.add(child);}
  const result=[...ids].map(id=>nodes.get(id)!).filter(Boolean);materials.set(root.id,result);return result;
 };
 for(const n of board.nodes)if(n.kind==='section'||n.branchFolded)material(n);

 const automatic=new Map<string,Card[]>();
 if(board.nodes.some(n=>n.mindmapRules)){
  const {parents,children}=branchTopology(board);
  for(const root of board.nodes)if(root.mindmapRules&&!parents.has(root.id)){
   const tree=[root];for(let i=0;i<tree.length;i++)for(const id of children.get(tree[i].id)||[]){const child=nodes.get(id);if(child)tree.push(child);}
   // The native automatic reflow deliberately excludes mixed section trees.
   if(tree.some(n=>n.kind==='section'))continue;
   for(const n of tree)automatic.set(n.id,tree);
  }
 }
 const rect=(unit:Unit)=>bounds(unit.members.filter(n=>!hidden.has(n.id)));
 const ensure=(unit:Unit)=>{
  if(unit.unsafe||unit.members.some(n=>ambiguous.has(n.id)))throw Error('展开范围包含共享或重叠分组，无法自动让位；请先整理重叠分组');
  if(unit.tree&&unit.active&&unit.fixed){const visible=unit.members.filter(n=>n.locked&&!hidden.has(n.id));for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++)if((revealed.has(visible[i].id)||revealed.has(visible[j].id))&&intersects(sectionDisplayNode(visible[i]),sectionDisplayNode(visible[j])))throw Error('导图内部展开后锁定对象重叠，请先调整或解锁导图对象');}
 };
 const inheritedActivity=new Map<string,Card[]>();
 const makeUnit=(root:Card,items:Card[],tree=false):Unit=>{
  const oldVisible=items.map(n=>oldNodes!.get(n.id)).filter((n):n is Card=>!!n&&!oldHidden.has(n.id));
  const scope=owner.get(root.id),allowed=members.get(root.id);
  return{root,members:items,tree,original:bounds(oldVisible.length?oldVisible:items.filter(n=>!hidden.has(n.id))),fixed:items.some(n=>n.locked),active:root.kind==='section'?sources.has(root.id)||inheritedActivity.has(root.id):items.some(n=>sources.has(n.id)),probes:root.kind==='section'&&!sources.has(root.id)?inheritedActivity.get(root.id):undefined,unsafe:items.some(n=>n.id!==root.id&&(root.kind==='section'?!allowed?.has(n.id)&&(!hidden.has(n.id)||owner.get(n.id)!==scope):owner.get(n.id)!==scope))};
 };
 const scopes:[string|undefined,Card[]][]=[...groups].sort((a,b)=>depth(b.id)-depth(a.id)||a.id.localeCompare(b.id)).map(group=>[group.id,board.nodes.filter(n=>owner.get(n.id)===group.id)]);
 scopes.push([undefined,board.nodes.filter(n=>!owner.has(n.id))]);
 for(const [scope,candidates]of scopes){
  if(scope!==undefined&&hidden.has(scope))continue;
  const units:Unit[]=[],seen=new Set<string>();
  for(const node of candidates){
   if(hidden.has(node.id)||seen.has(node.id))continue;
   const tree=automatic.get(node.id),root=tree?.[0]||node;
   if(tree&&tree.some(n=>owner.get(n.id)!==owner.get(root.id))){const unit=makeUnit(node,[node],true);unit.fixed=true;unit.unsafe=true;units.push(unit);seen.add(node.id);continue;}
   const items=tree||material(root);for(const n of items)seen.add(n.id);units.push(makeUnit(root,items,!!tree));
  }
  const active=units.filter(unit=>unit.active);if(!active.length)continue;
  for(const unit of active)ensure(unit);
  const shared=new Map<string,Unit>();
  for(const unit of units)for(const n of unit.members){const other=shared.get(n.id);if(other&&other!==unit){unit.unsafe=true;other.unsafe=true;}else shared.set(n.id,unit);}
  const order=(a:Unit,b:Unit)=>a.original.y-b.original.y||a.original.x-b.original.x||a.root.id.localeCompare(b.root.id);
  const pending=[...active].sort(order),queued=new Set(pending),limit=units.length*(units.length+1)*4;
  let moves=0;
  for(let index=0;index<pending.length;index++){
   const unit=pending[index];queued.delete(unit);ensure(unit);
   for(const other of units){
    if(other===unit||!intersects(rect(unit),rect(other))||unit.probes&&!unit.probes.some(n=>!hidden.has(n.id)&&intersects(sectionDisplayNode(n),rect(other))))continue;
    let moving:Unit,stationary:Unit;
    if(unit.fixed&&other.fixed)throw Error('展开后的内容与锁定对象重叠，无法自动让位；请先调整或解锁对象');
    if(other.fixed||!unit.fixed&&order(unit,other)>0){moving=unit;stationary=other;}else{moving=other;stationary=unit;}
    ensure(moving);ensure(stationary);
    const current=rect(moving),obstacle=rect(stationary);let bottom=obstacle.y+obstacle.height;
    // Folded frames still own their full logical area. Landing just below a
    // compact heading could silently move the source into that hidden group.
    for(const frame of stationary.members)if(frame.kind==='section'&&frame.x<current.x+current.width&&frame.x+frame.width>current.x)bottom=Math.max(bottom,frame.y+frame.height);
    const dy=bottom+gap-current.y;
    if(!Number.isFinite(dy)||dy<=0||++moves>limit)throw Error('展开范围过于复杂，未完成自动让位；请先整理附近布局');
    for(const n of moving.members)n.y+=dy;moving.active=true;moving.probes=undefined;
    if(!queued.has(moving)){queued.add(moving);pending.push(moving);}
   }
  }
  if(scope!==undefined){
   // Even a roomy frame must pass its changed content footprint upward. Keeping
   // that footprint avoids disturbing old, unrelated overlaps at another edge.
   inheritedActivity.set(scope,[...new Set(units.filter(unit=>unit.active).flatMap(unit=>unit.probes||unit.members.filter(n=>!hidden.has(n.id))))]);
   const group=nodes.get(scope)!,old=frozen.get(scope)!,inside=[...(members.get(scope)||[])].map(id=>nodes.get(id)!).filter(Boolean);
   if(inside.some(n=>n.x<group.x||n.y<group.y))throw Error('展开后的内容超出分组上方或左侧，无法在保留布局时自动让位');
   if(inside.length){
    const original=inside.map(n=>frozen.get(n.id)!);
    const oldRight=Math.max(...original.map(n=>n.x+n.width)),oldBottom=Math.max(...original.map(n=>n.y+n.height));
    const paddingX=Math.min(30,Math.max(0,old.x+old.width-oldRight)),paddingY=Math.min(30,Math.max(0,old.y+old.height-oldBottom));
    const width=Math.max(group.width,Math.max(...inside.map(n=>n.x+n.width))+paddingX-group.x),height=Math.max(group.height,Math.max(...inside.map(n=>n.y+n.height))+paddingY-group.y);
    if(width>group.width||height>group.height){
     ensure(makeUnit(group,material(group)));
     if(group.locked)throw Error('锁定分组没有足够空间容纳展开内容，请先扩大或解锁分组');
     group.width=width;group.height=height;sources.add(group.id);
    }
   }
  }
 }
 // Geometry defines group ownership in this file format. Never let an automatic
 // move or frame expansion silently acquire external content or lose a member.
 for(const group of groups){
  const expected=members.get(group.id)!;
  for(const node of board.nodes)if(node.id!==group.id&&sectionContains(group,node)!==expected.has(node.id))throw Error('自动让位会改变分组归属，布局未保存；请先腾出分组周围空间');
 }
}
