import {branchState,foldedMoveUnits,moveFoldedUnit} from './mindmap';
import {Board,Card,colorNames} from './model';
import {sectionBounds} from './sections';
import {readingTitle,reviewLabels} from './reading-desk';
export const layoutModes={grid:'整齐网格',row:'横向排列',column:'纵向排列',masonry:'紧凑瀑布流',kind:'按类型分栏',color:'按颜色分栏',review:'按阅读状态分栏',connections:'按连线聚类',distributeX:'横向等距',distributeY:'纵向等距',alignLeft:'左对齐',alignCenter:'水平居中',alignRight:'右对齐',alignTop:'顶端对齐',alignMiddle:'垂直居中',alignBottom:'底端对齐'} as const;
export interface LayoutOptions{mode:keyof typeof layoutModes;columns:number;gap:number;sort:'position'|'title';anchor:'corner'|'center'}
export interface LayoutPlan{movement?:string;originals:Card[];items:Card[];signature:string;ids:string[];skipped:number;lanes:{label:string;x:number;y?:number;width:number}[];connections?:string;bounds:{x:number;y:number;width:number;height:number};section?:{original:Card;next:Card;members:string}}
/** Only topology within the movable selection affects clustering; direction and duplicate edges do not. */
function connectionPairs(board:Board,ids:ReadonlySet<string>){return [...new Set(board.edges.filter(e=>e.from!==e.to&&ids.has(e.from)&&ids.has(e.to)).map(e=>JSON.stringify([e.from,e.to].sort())))].sort();}
function connectedGroups(board:Board,nodes:Card[]){
 const links=new Map(nodes.map(n=>[n.id,new Set<string>()]));
 for(const pair of connectionPairs(board,new Set(links.keys()))){const[a,b]=JSON.parse(pair) as string[];links.get(a)!.add(b);links.get(b)!.add(a);}
 const visited=new Set<string>(),byId=new Map(nodes.map(n=>[n.id,n])),rank=new Map(nodes.map((n,i)=>[n.id,i])),groups:Card[][]=[],isolated:Card[]=[];
 for(const n of nodes){if(visited.has(n.id))continue;visited.add(n.id);if(!links.get(n.id)!.size){isolated.push(n);continue;}
  const queue=[n.id],group:Card[]=[];for(let i=0;i<queue.length;i++){const id=queue[i];group.push(byId.get(id)!);for(const next of links.get(id)!)if(!visited.has(next)){visited.add(next);queue.push(next);}}
  group.sort((a,b)=>rank.get(a.id)!-rank.get(b.id)!);groups.push(group);
 }
 return [...groups.map((items,i)=>({items,label:`关联组 ${i+1} · ${items.length} 项`})),...(isolated.length?[{items:isolated,label:`未连接 · ${isolated.length} 项`}]:[])];
}
export const layoutSignature=(nodes:Card[])=>JSON.stringify(nodes.map(n=>[n.id,n.kind,n.x,n.y,n.width,n.height,n.locked,n.color,n.review,readingTitle(n)]));
const movementSignature=(board:Board,ids:ReadonlySet<string>)=>JSON.stringify(foldedMoveUnits(board,ids).map(unit=>[unit.root.id,unit.members.map(n=>[n.id,n.x,n.y,n.width,n.height,!!n.locked,!!n.branchFolded])]));
export function layoutBounds(nodes:Card[]){const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));return {x,y,width:Math.max(...nodes.map(n=>n.x+n.width))-x,height:Math.max(...nodes.map(n=>n.y+n.height))-y};}
export function planLayout(board:Board,ids:ReadonlySet<string>,options:LayoutOptions):LayoutPlan{
 if(!Object.hasOwn(layoutModes,options.mode)||(['grid','masonry','connections'].includes(options.mode)&&(!Number.isInteger(options.columns)||options.columns<1||options.columns>12))||(!options.mode.startsWith('align')&&(!Number.isFinite(options.gap)||options.gap<8||options.gap>240))||!['position','title'].includes(options.sort)||!['corner','center'].includes(options.anchor))throw Error('请设置 1–12 列和 8–240 的间距');
 const selected=board.nodes.filter(n=>ids.has(n.id)),source=foldedMoveUnits(board,ids).map(unit=>unit.root);
 if(source.length<2||source.length>1000)throw Error('请选择 2–1000 个未锁定的内容对象');
 const nodes=source.map(n=>({...n})).sort(options.sort==='title'?(a,b)=>readingTitle(a).localeCompare(readingTitle(b))||a.id.localeCompare(b.id):(a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
 const original=layoutBounds(source),lanes:LayoutPlan['lanes']=[],gap=options.gap;
 if(options.mode.startsWith('align')){
  for(const n of nodes){if(options.mode==='alignLeft')n.x=original.x;else if(options.mode==='alignCenter')n.x=original.x+(original.width-n.width)/2;else if(options.mode==='alignRight')n.x=original.x+original.width-n.width;else if(options.mode==='alignTop')n.y=original.y;else if(options.mode==='alignMiddle')n.y=original.y+(original.height-n.height)/2;else n.y=original.y+original.height-n.height;}
 }else if(options.mode==='distributeX'||options.mode==='distributeY'){
  const horizontal=options.mode==='distributeX';nodes.sort((a,b)=>horizontal?a.x-b.x||a.y-b.y||a.id.localeCompare(b.id):a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));let cursor=horizontal?original.x:original.y;
  for(const n of nodes){if(horizontal){n.x=cursor;cursor+=n.width+gap;}else{n.y=cursor;cursor+=n.height+gap;}}
 }else if(options.mode==='connections'){
  const groups=connectedGroups(board,nodes),blocks=groups.map(group=>{const cols=Math.min(options.columns,group.items.length),width=Math.max(...group.items.map(n=>n.width));let y=0;
   for(let i=0;i<group.items.length;i+=cols){const row=group.items.slice(i,i+cols);row.forEach((n,j)=>{n.x=j*(width+gap);n.y=y;});y+=Math.max(...row.map(n=>n.height))+gap;}
   return {...group,bounds:layoutBounds(group.items)};
  });
  const cols=Math.ceil(Math.sqrt(blocks.length));let y=original.y;
  for(let i=0;i<blocks.length;i+=cols){const row=blocks.slice(i,i+cols);let x=original.x;for(const block of row){for(const n of block.items){n.x+=x;n.y+=y;}lanes.push({label:block.label,x,y,width:block.bounds.width});x+=block.bounds.width+gap*2+32;}y+=Math.max(...row.map(g=>g.bounds.height))+gap*2+56;}
 }else if(options.mode==='row'||options.mode==='column'){let x=original.x,y=original.y;for(const n of nodes){n.x=x;n.y=y;if(options.mode==='row')x+=n.width+gap;else y+=n.height+gap;}}
 else if(options.mode==='grid'||options.mode==='masonry'){
  const cols=Math.min(options.columns,nodes.length),width=Math.max(...nodes.map(n=>n.width)),bottoms=Array.from({length:cols},()=>original.y);let rowY=original.y;
  if(options.mode==='grid')for(let i=0;i<nodes.length;i+=cols){const row=nodes.slice(i,i+cols);row.forEach((n,j)=>{n.x=original.x+j*(width+gap);n.y=rowY;});rowY+=Math.max(...row.map(n=>n.height))+gap;}
  else for(const n of nodes){const column=bottoms.indexOf(Math.min(...bottoms));n.x=original.x+column*(width+gap);n.y=bottoms[column];bottoms[column]+=n.height+gap;}
 }else{
  const kinds:Record<string,string>={card:'笔记',text:'文本',image:'图片',pdf:'PDF',board:'子白板'},groups=new Map<string,Card[]>();
  for(const n of nodes){const label=options.mode==='kind'?kinds[n.kind]:options.mode==='color'?colorNames[n.color]:n.kind==='board'?'子白板':reviewLabels[n.review||'later'];const group=groups.get(label)||[];group.push(n);groups.set(label,group);}
  let x=original.x;for(const [label,group]of groups){const width=Math.max(...group.map(n=>n.width));let y=original.y;for(const n of group){n.x=x;n.y=y;y+=n.height+gap;}lanes.push({label,x,width});x+=width+gap;}
 }
 const packed=layoutBounds(nodes),keepCenter=options.anchor==='center'&&!options.mode.startsWith('align'),dx=keepCenter?(original.width-packed.width)/2:0,dy=keepCenter?(original.height-packed.height)/2:0;
 for(const n of nodes){n.x+=dx;n.y+=dy;}for(const lane of lanes){lane.x+=dx;if(lane.y!==undefined)lane.y+=dy;}
 return {originals:source.map(n=>({...n})),items:nodes,signature:layoutSignature(source),movement:movementSignature(board,new Set(source.map(n=>n.id))),ids:source.map(n=>n.id),skipped:selected.length-source.length,lanes,bounds:layoutBounds(nodes),...(options.mode==='connections'?{connections:JSON.stringify(connectionPairs(board,new Set(source.map(n=>n.id))))}:{})};
}
/** Validate the whole proposal before any write, including asynchronous auto-fit or newly locked objects. */
export function applyLayout(board:Board,plan:LayoutPlan){
 const ids=new Set(plan.ids);if(plan.movement!==undefined&&movementSignature(board,ids)!==plan.movement)throw Error('折叠分支或锁定状态已变化，请重新预览');const current=board.nodes.filter(n=>ids.has(n.id));if(layoutSignature(current)!==plan.signature)throw Error('对象已变化，请重新生成布局预览');
 if(plan.connections!==undefined&&JSON.stringify(connectionPairs(board,ids))!==plan.connections)throw Error('连线关系已变化，请重新生成布局预览');
 if(plan.section&&(![plan.section.next.x,plan.section.next.y,plan.section.next.width,plan.section.next.height].every(Number.isFinite)||plan.section.next.width<=0||plan.section.next.height<=0))throw Error('分组布局无效，请重新预览');
 if(plan.section){const section=board.nodes.find(n=>n.id===plan.section!.original.id);if(!section||layoutSignature([section])!==layoutSignature([plan.section.original])||sectionMembersSignature(board,section)!==plan.section.members)throw Error('分组或框内内容已变化，请重新预览');}
 const positions=new Map(plan.items.map(n=>[n.id,n]));if(positions.size!==ids.size||[...ids].some(id=>!positions.has(id))||plan.items.some(n=>!Number.isFinite(n.x)||!Number.isFinite(n.y)))throw Error('布局预览无效，请重新生成');
 const units=foldedMoveUnits(board,ids);if(units.length!==ids.size)throw Error('折叠分支或锁定状态已变化，请重新预览');for(const unit of units){const next=positions.get(unit.root.id)!;moveFoldedUnit(unit,next.x,next.y);}
 if(plan.section){const n=board.nodes.find(n=>n.id===plan.section!.original.id)!;const next=plan.section.next;Object.assign(n,{x:next.x,y:next.y,width:next.width,height:next.height});}
}

const inside=(section:Card,n:Card)=>n.id!==section.id&&n.x>=section.x&&n.y>=section.y&&n.x+n.width<=section.x+section.width&&n.y+n.height<=section.y+section.height;
const sectionMembersSignature=(board:Board,section:Card)=>layoutSignature(board.nodes.filter(n=>inside(section,n)));
/** A selected frame is a layout scope: move its content and fit the frame atomically. */
export function planSectionLayout(board:Board,sectionId:string,options:LayoutOptions):LayoutPlan{
 const section=board.nodes.find(n=>n.id===sectionId&&n.kind==='section');
 if(!section||section.locked)throw Error('请先选择一个未锁定的分组框');
 const members=board.nodes.filter(n=>inside(section,n));
 if(members.some(n=>n.kind==='section'))throw Error('分组内还有子分组，请先选择内层分组整理');
 // Fixed objects are obstacles. Keeping the original section avoids moving a locked card indirectly.
 if(members.some(n=>n.locked))throw Error('分组内有锁定对象，请先解锁后整理分组');
 const plan=planLayout(board,new Set(members.map(n=>n.id)),{...options,anchor:'corner'});
 const dx=section.x+30-plan.bounds.x,dy=section.y+60-plan.bounds.y;
 for(const n of plan.items){n.x+=dx;n.y+=dy;}for(const lane of plan.lanes){lane.x+=dx;if(lane.y!==undefined)lane.y+=dy;}
 plan.bounds=layoutBounds(plan.items);const next={...section,...sectionBounds(plan.items)!};
 plan.section={original:{...section},next,members:sectionMembersSignature(board,section)};
 return plan;
}

export type LayoutScope='selection'|'loose'|'visible'|`section:${string}`;
export type LayoutViewport={x:number;y:number;width:number;height:number};
/** Broad scopes leave framed content alone. A frame is explicitly arranged as a unit. */
export function resolveLayoutScope(board:Board,scope:LayoutScope,selection:ReadonlySet<string>,viewport?:LayoutViewport){
 const sections=board.nodes.filter(n=>n.kind==='section');
 if(scope.startsWith('section:')){const id=scope.slice(8);const frame=sections.find(n=>n.id===id);if(!frame)throw Error('分组已删除，请选择其他范围');return{ids:new Set([id]),sectionId:id,label:frame.title||'未命名分组'};}
 if(scope==='selection'){const chosen=board.nodes.filter(n=>selection.has(n.id));return{ids:new Set(chosen.map(n=>n.id)),sectionId:chosen.length===1&&chosen[0].kind==='section'?chosen[0].id:undefined,label:'当前选择'};}
 const hidden=branchState(board).hidden;const loose=board.nodes.filter(n=>!hidden.has(n.id)&&n.kind!=='section'&&!sections.some(frame=>inside(frame,n)));
 const items=scope==='visible'?loose.filter(n=>viewport&&n.x<viewport.x+viewport.width&&n.x+n.width>viewport.x&&n.y<viewport.y+viewport.height&&n.y+n.height>viewport.y):loose;
 return{ids:new Set(items.map(n=>n.id)),sectionId:undefined,label:scope==='visible'?'当前视野中的散卡':'白板全部散卡'};
}
export function layoutChanges(plan:LayoutPlan){const old=new Map(plan.originals.map(n=>[n.id,n]));return plan.items.filter(n=>{const before=old.get(n.id)!;return Math.abs(n.x-before.x)>.001||Math.abs(n.y-before.y)>.001;}).length;}

/** Frame resizing also counts as a change even when its members already align. */
export function layoutHasChanges(plan:LayoutPlan){return layoutChanges(plan)>0||!!plan.section&&(['x','y','width','height'] as const).some(key=>Math.abs(plan.section!.original[key]-plan.section!.next[key])>.001);}
