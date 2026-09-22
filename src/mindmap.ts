import type { Board, Card, Edge } from './model';
/** 分支是单父级森林，普通关系线不参与树结构。 */
export function validateBranches(b:Board){
  const nodes=new Map(b.nodes.map(n=>[n.id,n])),parents=new Map<string,string>();
  for(const e of b.edges.filter(e=>e.kind==='branch')){
    if(!nodes.has(e.from)||!nodes.has(e.to)||nodes.get(e.from)!.kind==='section'||nodes.get(e.to)!.kind==='section'||parents.has(e.to))throw new Error('导图分支必须连接内容节点，每个主题只能有一个父级');
    parents.set(e.to,e.from);
  }
  const done=new Set<string>();
  for(const id of parents.keys()){
    let current:string|undefined=id;const path=new Set<string>();
    while(current!==undefined&&!done.has(current)){if(path.has(current))throw new Error('导图分支不能形成循环');path.add(current);current=parents.get(current);}
    path.forEach(n=>done.add(n));
  }
  return parents;
}
export function mindmapRoot(b:Board,id:string){const parents=validateBranches(b);while(parents.has(id))id=parents.get(id)!;return id;}
/** 只整理所选主题所在的树；保留其他白板对象的位置。 */
export type MindmapLayout='right'|'left'|'down'|'bilateral';
/** Transaction-local index: never cache mutable board references across edits or undo. */
function layoutIndex(b:Board){
 const parents=validateBranches(b),nodes=new Map(b.nodes.map(n=>[n.id,n])),children=new Map<string,Card[]>(),incoming=new Map<string,Edge>();
 for(const e of b.edges)if(e.kind==='branch'){const list=children.get(e.from)||[];list.push(nodes.get(e.to)!);children.set(e.from,list);incoming.set(e.to,e);}
 return{parents,nodes,children,incoming};
}
export function layoutMindmap(b:Board,id:string,direction?:MindmapLayout){return layoutIndexedMindmap(b,id,layoutIndex(b),direction);}
function layoutIndexedMindmap(b:Board,id:string,index:ReturnType<typeof layoutIndex>,direction?:MindmapLayout){
  const {parents,nodes,children,incoming}=index;let rootId=id;while(parents.has(rootId))rootId=parents.get(rootId)!;const root=nodes.get(rootId);
  if(!root||root.kind==='section')throw Error('请选择一个主题、卡片或图片');
  direction??=root.mindmapRules?.layout||b.mindmapLayout||b.mindmapDirection||'right';
  const all=[root];for(let i=0;i<all.length;i++)all.push(...children.get(all[i].id)||[]);
  if(all.some(n=>n.locked))throw Error('导图中有锁定对象，请先解锁再整理');
  const density=root.mindmapRules?.density||b.mindmapDensity||'standard',gap=density==='compact'?18:density==='relaxed'?56:32,distance=density==='compact'?64:density==='relaxed'?144:100;
  const down=direction==='down',size=(n:Card)=>down?n.width:n.height,visibleKids=(n:Card)=>n.branchFolded?[]:children.get(n.id)||[],spans=new Map<string,number>();
  for(let i=all.length-1;i>=0;i--){const n=all[i],kids=visibleKids(n);spans.set(n.id,Math.max(size(n),kids.reduce((s,k)=>s+spans.get(k.id)!,0)+Math.max(0,kids.length-1)*gap));}
  const sides=new Map<string,'left'|'right'>();let left=0,right=0,branchIndex=0;
  for(const n of visibleKids(root)){const side=direction==='left'?'left':direction==='bilateral'&&(root.mindmapRules?.automatic?branchIndex%2===1:left<right)?'left':'right';branchIndex++;sides.set(n.id,side);if(side==='left')left+=spans.get(n.id)!+gap;else right+=spans.get(n.id)!+gap;}
  const original=new Map(all.map(n=>[n.id,{x:n.x,y:n.y}]));
  const queue=[root];
  for(let i=0;i<queue.length;i++){
    const n=queue[i],kids=visibleKids(n),groups=n===root&&direction==='bilateral'?[kids.filter(k=>sides.get(k.id)==='left'),kids.filter(k=>sides.get(k.id)==='right')]:[kids];
    for(const group of groups){const total=group.reduce((s,k)=>s+spans.get(k.id)!,0)+Math.max(0,group.length-1)*gap;let pos=(down?n.x+n.width/2:n.y+n.height/2)-total/2;
      for(const k of group){const side=n===root?sides.get(k.id)!:sides.get(n.id)!;sides.set(k.id,side);
        if(down){k.y=n.y+n.height+distance-10;k.x=pos+(spans.get(k.id)!-k.width)/2;}
        else{k.x=side==='left'?n.x-distance-k.width:n.x+n.width+distance;k.y=pos+(spans.get(k.id)!-k.height)/2;}
        pos+=spans.get(k.id)!+gap;queue.push(k);
      }
    }
  }
  // Carry every hidden node by its nearest visible ancestor's displacement, once.
  const visible=new Set(queue.map(n=>n.id)),shifts=new Map<string,{x:number;y:number}>();
  for(const n of all){const before=original.get(n.id)!;if(visible.has(n.id))shifts.set(n.id,{x:n.x-before.x,y:n.y-before.y});for(const k of children.get(n.id)||[])if(!visible.has(k.id)){const shift=shifts.get(n.id)!;k.x+=shift.x;k.y+=shift.y;shifts.set(k.id,shift);}}
  for(const n of queue){const e=incoming.get(n.id);if(!e||!visible.has(e.from))continue;
    e.fromSide=down?'bottom':sides.get(e.to)==='left'?'left':'right';e.toSide=down?'top':sides.get(e.to)==='left'?'right':'left';
  }
  b.version=3;b.mode='mindmap';if(root.mindmapRules)root.mindmapRules.layout=direction;b.mindmapLayout=direction;b.mindmapDirection=down?'down':'right';root.topic=true;
}

/** Isolated live geometry: index once, copy only the edited tree, never cache mutable drafts. */
export function previewMindmapSize(board:Board,id:string,width:number,height:number):Board|undefined{
 const index=layoutIndex(board);let rootId=id;while(index.parents.has(rootId))rootId=index.parents.get(rootId)!;
 const root=index.nodes.get(rootId);if(!root?.mindmapRules?.automatic)return;
 const all=[root];for(let i=0;i<all.length;i++)all.push(...index.children.get(all[i].id)||[]);
 if(all.some(n=>n.locked))return;
 const nodes=new Map(all.map(n=>[n.id,{...n,...(n.mindmapRules?{mindmapRules:{...n.mindmapRules}}:{}),...(n.id===id?{width,height}:{})}]));
 const children=new Map<string,Card[]>(),incoming=new Map<string,Edge>();
 for(const n of all){const kids=index.children.get(n.id);if(kids)children.set(n.id,kids.map(k=>nodes.get(k.id)!));const edge=index.incoming.get(n.id);if(edge)incoming.set(n.id,{...edge});}
 const display={...board};layoutIndexedMindmap(display,rootId,{parents:index.parents,nodes,children,incoming},root.mindmapRules.layout);
 display.nodes=board.nodes.map(n=>nodes.get(n.id)||n);display.edges=board.edges.map(e=>e.kind==='branch'?incoming.get(e.to)||e:e);
 return display;
}

/** Derived in O(nodes + edges); no descendant copies are stored in the document. */
export function branchState(b:Board){
 const children=new Map<string,string[]>(),parents=new Map<string,string>();
 for(const e of b.edges)if(e.kind==='branch'){const list=children.get(e.from)||[];list.push(e.to);children.set(e.from,list);parents.set(e.to,e.from);}
 const hidden=new Set<string>(),pending=b.nodes.filter(n=>n.branchFolded).flatMap(n=>children.get(n.id)||[]);
 while(pending.length){const id=pending.pop()!;if(hidden.has(id))continue;hidden.add(id);pending.push(...(children.get(id)||[]));}
 return{children,parents,hidden};
}
export function branchDescendants(b:Board,roots:ReadonlySet<string>){
 const {children}=branchState(b),ids=new Set<string>(),pending=[...roots];
 while(pending.length){const id=pending.pop()!;for(const child of children.get(id)||[])if(!ids.has(child)){ids.add(child);pending.push(child);}}
 return ids;
}
export function visibleBranchBoard(b:Board):Board{if(!b.nodes.some(n=>n.branchFolded))return b;const {hidden}=branchState(b);return hidden.size?{...b,nodes:b.nodes.filter(n=>!hidden.has(n.id)),edges:b.edges.filter(e=>!hidden.has(e.from)&&!hidden.has(e.to))}:b;}
export function unfoldAncestors(b:Board,id:string){const {parents}=branchState(b),nodes=new Map(b.nodes.map(n=>[n.id,n])),seen=new Set<string>();let parent=parents.get(id);while(parent&&!seen.has(parent)){seen.add(parent);const node=nodes.get(parent);if(node)delete node.branchFolded;parent=parents.get(parent);}}

/** A folded branch is one movement unit. Locked descendants pin the complete unit. */
export function foldedMoveUnits(board:Board,ids:ReadonlySet<string>){
 const {hidden,children}=branchState(board),byId=new Map(board.nodes.map(n=>[n.id,n]));
 return board.nodes.filter(n=>ids.has(n.id)&&!hidden.has(n.id)&&!n.locked&&n.kind!=='section').flatMap(root=>{
  const members=[root];if(root.branchFolded){const seen=new Set([root.id]);for(let i=0;i<members.length;i++)for(const id of children.get(members[i].id)||[]){const child=byId.get(id);if(child&&!seen.has(id)){seen.add(id);members.push(child);}}}
  return members.some(n=>n.locked)?[]:[{root,members}];
 });
}
export function moveFoldedUnit(unit:{root:Card;members:Card[]},x:number,y:number){const dx=x-unit.root.x,dy=y-unit.root.y;for(const n of unit.members){n.x+=dx;n.y+=dy;}}
/** Reflow changed automatic trees once per transaction; positional drags remain untouched. */
export function reflowAutomaticMindmaps(board:Board,before:Board){
 if(!board.nodes.some(n=>n.mindmapRules?.automatic))return;
 const nodes=new Map(board.nodes.map(n=>[n.id,n])),oldNodes=new Map(before.nodes.map(n=>[n.id,n])),{parents}=branchState(board),oldParents=branchState(before).parents,roots=new Map<string,string>(),affected=new Set<string>();
 const rootOf=(id:string)=>{const path:string[]=[];let at=id;while(parents.has(at)&&!roots.has(at)){path.push(at);at=parents.get(at)!;}const root=roots.get(at)||at;for(const p of path)roots.set(p,root);roots.set(id,root);return root;};
 const mark=(id:string|undefined)=>{if(id&&nodes.has(id))affected.add(rootOf(id));};
 for(const n of board.nodes){const old=oldNodes.get(n.id);if(!old||n.width!==old.width||n.height!==old.height||n.branchFolded!==old.branchFolded||JSON.stringify(n.mindmapRules)!==JSON.stringify(old.mindmapRules))mark(n.id);if(parents.get(n.id)!==oldParents.get(n.id)){mark(n.id);mark(oldParents.get(n.id));}}
 for(const old of before.nodes)if(!nodes.has(old.id))mark(oldParents.get(old.id));
 // Explicit sibling-order changes are also structural changes.
 const order=(b:Board)=>{const map=new Map<string,string[]>();for(const e of b.edges)if(e.kind==='branch'){const list=map.get(e.from)||[];list.push(e.to);map.set(e.from,list);}return map;},oldOrder=order(before),newOrder=order(board);for(const parent of new Set([...oldOrder.keys(),...newOrder.keys()]))if(JSON.stringify(oldOrder.get(parent))!==JSON.stringify(newOrder.get(parent)))mark(parent);
 const locked=new Set(board.nodes.filter(n=>n.locked).map(n=>rootOf(n.id)));
 const targets=[...affected].filter(id=>nodes.get(id)?.mindmapRules?.automatic&&!locked.has(id));
 if(targets.length){const index=layoutIndex(board);for(const rootId of targets)layoutIndexedMindmap(board,rootId,index,nodes.get(rootId)!.mindmapRules!.layout);}
}
