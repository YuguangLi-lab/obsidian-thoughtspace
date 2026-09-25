import {branchState,foldedMoveUnits,moveFoldedUnit} from './mindmap';
import {Board,Card,colorNames,colors,uid} from './model';
import {sectionBounds,sectionContains} from './sections';
import {readingTitle,reviewLabels} from './reading-desk';
export const layoutModes={grid:'整齐网格',row:'横向排列',column:'纵向排列',masonry:'紧凑瀑布流',kind:'按类型分栏',color:'按颜色分栏',review:'按阅读状态分栏',connections:'按连线聚类',distributeX:'横向等距',distributeY:'纵向等距',alignLeft:'左对齐',alignCenter:'水平居中',alignRight:'右对齐',alignTop:'顶端对齐',alignMiddle:'垂直居中',alignBottom:'底端对齐'} as const;
export interface LayoutOptions{mode:keyof typeof layoutModes;columns:number;gap:number;sort:'position'|'title';anchor:'corner'|'center';createSections?:boolean}
export interface LayoutSection {title:string;color:Card['color'];ids:string[];x:number;y:number;width:number;height:number}
export const sectionLayoutModes=new Set<LayoutOptions['mode']>(['kind','color','review','connections']);
export interface LayoutPlan{newSections?:LayoutSection[];sectionContext?:string;movement?:string;originals:Card[];items:Card[];signature:string;ids:string[];skipped:number;lanes:{label:string;x:number;y?:number;width:number;ids:string[]}[];connections?:string;bounds:{x:number;y:number;width:number;height:number};section?:{original:Card;next:Card;members:string}}
/** Only topology within the movable selection affects clustering; direction and duplicate edges do not. */
function connectionPairs(board:Board,ids:ReadonlySet<string>){return [...new Set(board.edges.filter(e=>e.from!==e.to&&ids.has(e.from)&&ids.has(e.to)).map(e=>JSON.stringify([e.from,e.to].sort())))].sort();}
function connectedGroups(nodes:Card[],pairs:readonly string[]){
 const links=new Map(nodes.map(n=>[n.id,new Set<string>()]));
 for(const pair of pairs){const[a,b]=JSON.parse(pair) as string[];links.get(a)!.add(b);links.get(b)!.add(a);}
 const visited=new Set<string>(),byId=new Map(nodes.map(n=>[n.id,n])),rank=new Map(nodes.map((n,i)=>[n.id,i])),groups:Card[][]=[],isolated:Card[]=[];
 for(const n of nodes){if(visited.has(n.id))continue;visited.add(n.id);if(!links.get(n.id)!.size){isolated.push(n);continue;}
  const queue=[n.id],group:Card[]=[];for(let i=0;i<queue.length;i++){const id=queue[i];group.push(byId.get(id)!);for(const next of links.get(id)!)if(!visited.has(next)){visited.add(next);queue.push(next);}}
  group.sort((a,b)=>rank.get(a.id)!-rank.get(b.id)!);groups.push(group);
 }
 return [...groups.map((items,i)=>({items,label:`关联组 ${i+1} · ${items.length} 项`})),...(isolated.length?[{items:isolated,label:`未连接 · ${isolated.length} 项`}]:[])];
}
export const layoutSignature=(nodes:Card[])=>JSON.stringify(nodes.map(n=>[n.id,n.kind,n.x,n.y,n.width,n.height,n.locked,n.color,n.review,readingTitle(n)]));
const movementSignature=(units:ReturnType<typeof foldedMoveUnits>)=>JSON.stringify(units.map(unit=>[unit.root.id,unit.members.map(n=>[n.id,n.x,n.y,n.width,n.height,!!n.locked,!!n.branchFolded])]));
export function layoutBounds(nodes:Card[]){const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));return {x,y,width:Math.max(...nodes.map(n=>n.x+n.width))-x,height:Math.max(...nodes.map(n=>n.y+n.height))-y};}
export function planLayout(board:Board,ids:ReadonlySet<string>,options:LayoutOptions):LayoutPlan{
 if(!Object.hasOwn(layoutModes,options.mode)||(['grid','masonry','connections'].includes(options.mode)&&(!Number.isInteger(options.columns)||options.columns<1||options.columns>12))||(!options.mode.startsWith('align')&&(!Number.isFinite(options.gap)||options.gap<8||options.gap>240))||!['position','title'].includes(options.sort)||!['corner','center'].includes(options.anchor))throw Error('请设置 1–12 列和 8–240 的间距');
 if(options.createSections!==undefined&&typeof options.createSections!=='boolean')throw Error('自动分组设置无效');
 const selected=board.nodes.filter(n=>ids.has(n.id)),units=foldedMoveUnits(board,ids),source=units.map(unit=>unit.root);
 const createSections=!!options.createSections&&sectionLayoutModes.has(options.mode);
 if(createSections&&units.some(unit=>unit.members.some(n=>board.nodes.some(frame=>frame.kind==='section'&&sectionContains(frame,n)))))throw Error('自动分组仅适用于散卡，请先将内容移出原分组，或关闭生成分组框');
 if(source.length<2||source.length>1000)throw Error('请选择 2–1000 个未锁定的内容对象');
 // Keep sorting titles local to these draft objects; the source signature stays fresh.
 const nodes=source.map(n=>({...n})),titles=options.sort==='title'?new Map(nodes.map(n=>[n,readingTitle(n)])):undefined;
 nodes.sort(titles?(a,b)=>titles.get(a)!.localeCompare(titles.get(b)!)||a.id.localeCompare(b.id):(a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
 const original=layoutBounds(source),lanes:LayoutPlan['lanes']=[],gap=options.gap;let connections:string[]|undefined;
 if(options.mode.startsWith('align')){
  for(const n of nodes){if(options.mode==='alignLeft')n.x=original.x;else if(options.mode==='alignCenter')n.x=original.x+(original.width-n.width)/2;else if(options.mode==='alignRight')n.x=original.x+original.width-n.width;else if(options.mode==='alignTop')n.y=original.y;else if(options.mode==='alignMiddle')n.y=original.y+(original.height-n.height)/2;else n.y=original.y+original.height-n.height;}
 }else if(options.mode==='distributeX'||options.mode==='distributeY'){
  const horizontal=options.mode==='distributeX';nodes.sort((a,b)=>horizontal?a.x-b.x||a.y-b.y||a.id.localeCompare(b.id):a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));let cursor=horizontal?original.x:original.y;
  for(const n of nodes){if(horizontal){n.x=cursor;cursor+=n.width+gap;}else{n.y=cursor;cursor+=n.height+gap;}}
 }else if(options.mode==='connections'){
  // Clustering and the stale-preview signature share this call's canonical pairs.
  const groups=connectedGroups(nodes,connections=connectionPairs(board,new Set(nodes.map(n=>n.id)))),blocks=groups.map(group=>{const cols=Math.min(options.columns,group.items.length),width=Math.max(...group.items.map(n=>n.width));let y=0;
   for(let i=0;i<group.items.length;i+=cols){const row=group.items.slice(i,i+cols);row.forEach((n,j)=>{n.x=j*(width+gap);n.y=y;});y+=Math.max(...row.map(n=>n.height))+gap;}
   return {...group,bounds:layoutBounds(group.items)};
  });
  const cols=Math.ceil(Math.sqrt(blocks.length));let y=original.y;
  for(let i=0;i<blocks.length;i+=cols){const row=blocks.slice(i,i+cols);let x=original.x;for(const block of row){for(const n of block.items){n.x+=x;n.y+=y;}lanes.push({label:block.label,x,y,width:block.bounds.width,ids:block.items.map(n=>n.id)});x+=block.bounds.width+gap*2+32;}y+=Math.max(...row.map(g=>g.bounds.height))+gap*2+56;}
 }else if(options.mode==='row'||options.mode==='column'){let x=original.x,y=original.y;for(const n of nodes){n.x=x;n.y=y;if(options.mode==='row')x+=n.width+gap;else y+=n.height+gap;}}
 else if(options.mode==='grid'||options.mode==='masonry'){
  const cols=Math.min(options.columns,nodes.length),width=Math.max(...nodes.map(n=>n.width)),bottoms=Array.from({length:cols},()=>original.y);let rowY=original.y;
  if(options.mode==='grid')for(let i=0;i<nodes.length;i+=cols){const row=nodes.slice(i,i+cols);row.forEach((n,j)=>{n.x=original.x+j*(width+gap);n.y=rowY;});rowY+=Math.max(...row.map(n=>n.height))+gap;}
  else for(const n of nodes){const column=bottoms.indexOf(Math.min(...bottoms));n.x=original.x+column*(width+gap);n.y=bottoms[column];bottoms[column]+=n.height+gap;}
 }else{
  const kinds:Record<string,string>={card:'笔记',text:'文本',image:'图片',pdf:'PDF',board:'子白板'},groups=new Map<string,Card[]>();
  for(const n of nodes){const label=options.mode==='kind'?kinds[n.kind]:options.mode==='color'?colorNames[n.color]:n.kind==='board'?'子白板':reviewLabels[n.review||'later'];const group=groups.get(label)||[];group.push(n);groups.set(label,group);}
  let x=original.x;for(const [label,group]of groups){const width=Math.max(...group.map(n=>n.width));let y=original.y;for(const n of group){n.x=x;n.y=y;y+=n.height+gap;}lanes.push({label,x,width,ids:group.map(n=>n.id)});x+=width+gap;}
 }
 const packed=layoutBounds(nodes),keepCenter=options.anchor==='center'&&!options.mode.startsWith('align'),dx=keepCenter?(original.width-packed.width)/2:0,dy=keepCenter?(original.height-packed.height)/2:0;
 for(const n of nodes){n.x+=dx;n.y+=dy;}for(const lane of lanes){lane.x+=dx;if(lane.y!==undefined)lane.y+=dy;}
 const newSections=createSections?planNewSections(board,nodes,lanes,units,options):undefined;
 return {...(newSections?{newSections,sectionContext:sectionContext(board)}:{}),originals:source.map(n=>({...n})),items:nodes,signature:layoutSignature(source),movement:movementSignature(units),ids:source.map(n=>n.id),skipped:selected.length-source.length,lanes,bounds:layoutBounds(newSections?[...nodes,...newSections.map((s,i)=>({...s,id:`preview-section-${i}`,kind:'section' as const}))]:nodes),...(options.mode==='connections'?{connections:JSON.stringify(connections)}:{})};
}
/** Outside geometry is part of a grouping proposal because containment is spatial. */
const sectionContext=(board:Board)=>JSON.stringify(board.nodes.map(n=>[n.id,n.kind,n.x,n.y,n.width,n.height,!!n.locked,!!n.branchFolded,!!n.sectionFolded]));
const overlaps=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function projectedMembers(nodes:Card[],units:ReturnType<typeof foldedMoveUnits>){const positions=new Map(nodes.map(n=>[n.id,n]));return units.flatMap(unit=>{const next=positions.get(unit.root.id)!;return unit.members.map(n=>({...n,x:n.x+next.x-unit.root.x,y:n.y+next.y-unit.root.y}));});}
function planNewSections(board:Board,nodes:Card[],lanes:LayoutPlan['lanes'],units:ReturnType<typeof foldedMoveUnits>,options:LayoutOptions):LayoutSection[]{
 const positions=new Map(nodes.map(n=>[n.id,n])),members=new Map(units.map(unit=>[unit.root.id,unit.members.map(n=>n.id)])),projected=new Map(projectedMembers(nodes,units).map(n=>[n.id,n]));
 const groups=lanes.map((lane,index)=>{const ids=lane.ids.flatMap(id=>members.get(id)!);return{title:lane.label,color:options.mode==='color'?positions.get(lane.ids[0])!.color:colors[index%colors.length],ids,...sectionBounds(ids.map(id=>projected.get(id)!))!};});
 // Pack complete logical frames, including hidden descendants and the title gutter.
 const original=layoutBounds(nodes),cols=options.mode==='connections'?Math.ceil(Math.sqrt(groups.length)):groups.length;let y=original.y-60;
 for(let i=0;i<groups.length;i+=cols){const row=groups.slice(i,i+cols);let x=original.x-30;for(let j=0;j<row.length;j++){const group=row[j],lane=lanes[i+j],dx=x-group.x,dy=y-group.y;group.x=x;group.y=y;for(const id of lane.ids){const n=positions.get(id)!;n.x+=dx;n.y+=dy;}lane.x=x+30;lane.y=y+60;lane.width=group.width-60;x+=group.width+options.gap;}y+=Math.max(...row.map(g=>g.height))+options.gap;}
 let bounds=layoutBounds(groups.map((g,i)=>({...g,id:String(i),kind:'section' as const})));const dx=options.anchor==='center'?original.x+original.width/2-bounds.x-bounds.width/2:original.x-30-bounds.x,dy=options.anchor==='center'?original.y+original.height/2-bounds.y-bounds.height/2:original.y-60-bounds.y;
 const shift=(x:number,y:number)=>{for(const n of nodes){n.x+=x;n.y+=y;}for(const g of groups){g.x+=x;g.y+=y;}for(const lane of lanes){lane.x+=x;lane.y=(lane.y||0)+y;}};shift(dx,dy);
 const moved=new Set(groups.flatMap(g=>g.ids)),obstacles=board.nodes.filter(n=>!moved.has(n.id));
 if(groups.some(g=>obstacles.some(n=>overlaps(g,n)))){bounds=layoutBounds(groups.map((g,i)=>({...g,id:String(i),kind:'section' as const})));shift(Math.max(...obstacles.map(n=>n.x+n.width))+options.gap-bounds.x,0);}
 return groups;
}
function validateNewSections(board:Board,plan:LayoutPlan,units:ReturnType<typeof foldedMoveUnits>){
 if(!plan.newSections)return;
 if(plan.section||!plan.newSections.length||plan.newSections.length>1000||plan.sectionContext!==sectionContext(board))throw Error('分组或周围内容已变化，请重新预览');
 const projected=projectedMembers(plan.items,units),byId=new Map(projected.map(n=>[n.id,n])),seen=new Set<string>(),obstacles=board.nodes.filter(n=>!byId.has(n.id));
 for(const group of plan.newSections){
  if(!group.title.trim()||group.title.length>100||!colors.includes(group.color)||![group.x,group.y,group.width,group.height].every(Number.isFinite)||group.width<80||group.height<60||!group.ids.length)throw Error('自动分组预览无效，请重新预览');
  for(const id of group.ids){const n=byId.get(id);if(!n||seen.has(id)||n.x<group.x+30-.001||n.y<group.y+60-.001||n.x+n.width>group.x+group.width-30+.001||n.y+n.height>group.y+group.height-30+.001)throw Error('分组成员或边界已变化，请重新预览');seen.add(id);}
  if(obstacles.some(n=>overlaps(group,n)))throw Error('分组范围与其他内容重叠，请重新预览');
 }
 if(seen.size!==byId.size||plan.newSections.some((g,i)=>plan.newSections!.slice(i+1).some(other=>overlaps(g,other))))throw Error('分组成员或边界无效，请重新预览');
}
/** Validate the whole proposal before any write, including asynchronous auto-fit or newly locked objects. */
export function applyLayout(board:Board,plan:LayoutPlan){
 const ids=new Set(plan.ids);let units:ReturnType<typeof foldedMoveUnits>|undefined;if(plan.movement!==undefined&&movementSignature(units=foldedMoveUnits(board,ids))!==plan.movement)throw Error('折叠分支或锁定状态已变化，请重新预览');const current=board.nodes.filter(n=>ids.has(n.id));if(layoutSignature(current)!==plan.signature)throw Error('对象已变化，请重新生成布局预览');
 if(plan.connections!==undefined&&JSON.stringify(connectionPairs(board,ids))!==plan.connections)throw Error('连线关系已变化，请重新生成布局预览');
 if(plan.section&&(![plan.section.next.x,plan.section.next.y,plan.section.next.width,plan.section.next.height].every(Number.isFinite)||plan.section.next.width<=0||plan.section.next.height<=0))throw Error('分组布局无效，请重新预览');
 if(plan.section){const section=board.nodes.find(n=>n.id===plan.section!.original.id);if(!section||layoutSignature([section])!==layoutSignature([plan.section.original])||sectionMembersSignature(board,section)!==plan.section.members)throw Error('分组或框内内容已变化，请重新预览');}
 const positions=new Map(plan.items.map(n=>[n.id,n]));if(positions.size!==ids.size||[...ids].some(id=>!positions.has(id))||plan.items.some(n=>!Number.isFinite(n.x)||!Number.isFinite(n.y)))throw Error('布局预览无效，请重新生成');
 units??=foldedMoveUnits(board,ids);if(units.length!==ids.size)throw Error('折叠分支或锁定状态已变化，请重新预览');validateNewSections(board,plan,units);for(const unit of units){const next=positions.get(unit.root.id)!;moveFoldedUnit(unit,next.x,next.y);}
 if(plan.newSections){board.version=3;board.nodes.push(...plan.newSections.map(frame=>({id:uid(),kind:'section' as const,title:frame.title,color:frame.color,x:frame.x,y:frame.y,width:frame.width,height:frame.height})));}
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
 const plan=planLayout(board,new Set(members.map(n=>n.id)),{...options,anchor:'corner',createSections:false});
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
 // Offscreen objects cannot enter the visible scope, so skip their frame membership scans.
 const hidden=branchState(board).hidden,candidates=scope==='visible'?board.nodes.filter(n=>!hidden.has(n.id)&&n.kind!=='section'&&viewport&&n.x<viewport.x+viewport.width&&n.x+n.width>viewport.x&&n.y<viewport.y+viewport.height&&n.y+n.height>viewport.y):board.nodes;
 const items=candidates.filter(n=>!hidden.has(n.id)&&n.kind!=='section'&&!sections.some(frame=>inside(frame,n)));
 return{ids:new Set(items.map(n=>n.id)),sectionId:undefined,label:scope==='visible'?'当前视野中的散卡':'白板全部散卡'};
}
export function layoutChanges(plan:LayoutPlan){const old=new Map(plan.originals.map(n=>[n.id,n]));return plan.items.filter(n=>{const before=old.get(n.id)!;return Math.abs(n.x-before.x)>.001||Math.abs(n.y-before.y)>.001;}).length;}

/** Frame resizing also counts as a change even when its members already align. */
export function layoutHasChanges(plan:LayoutPlan){return !!plan.newSections?.length||layoutChanges(plan)>0||!!plan.section&&(['x','y','width','height'] as const).some(key=>Math.abs(plan.section!.original[key]-plan.section!.next[key])>.001);}
