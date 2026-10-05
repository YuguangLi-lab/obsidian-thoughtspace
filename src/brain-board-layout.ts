import {supportsLocalRelations,type LocalRelationItem,type LocalRelationKind,type LocalRelationMatches} from './local-relations';
import {BRAIN_RENDER_EDGES,BRAIN_RENDER_NODES,type BrainDescendantPage} from './brain-board-descendants';

export type BrainBoardLayoutRole='center'|LocalRelationKind;
export interface BrainBoardLayoutNode {id:string;role:BrainBoardLayoutRole;x:number;y:number;width:number;height:number;depth?:number;/** Expanded reading body; pill geometry stays unchanged. */previewWidth?:number}
export interface BrainBoardLayoutLink {from:string;to:string;path:string;dashed:boolean;role:LocalRelationKind}
export interface BrainBoardLayout {width:number;height:number;nodes:BrainBoardLayoutNode[];links:BrainBoardLayoutLink[];labels:{text:string;x:number;y:number}[];page:number;pages:number;/** Unique supported neighbors, rather than duplicated relation-category rows. */total:number}
export interface BrainBoardLayoutOptions {width?:number;height?:number;page?:number;/** Upper bound; individual spatial zones have smaller readability limits. */pageSize?:number;/** In-place previews reserve space without changing source-node geometry. */expandedIds?:readonly string[];associationSides?:ReadonlyMap<string,'left'|'right'>;revealId?:string}

type Choice={item:LocalRelationItem;role:LocalRelationKind};
const priority:LocalRelationKind[]=['parents','children','siblings','associated','incoming','outgoing'];
const finite=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,Math.floor(value!))):fallback;
const point=(value:number)=>Math.round(value*100)/100;
const cx=(node:BrainBoardLayoutNode)=>node.x+node.width/2;
const cy=(node:BrainBoardLayoutNode)=>node.y+node.height/2;
const coordinate=(x:number,y:number)=>`${point(x)} ${point(y)}`;
const previewSpace=212;
function vertical(from:BrainBoardLayoutNode,to:BrainBoardLayoutNode,clearance=0){
 const x1=cx(from),y1=from.y+from.height,x2=cx(to),y2=to.y;
 if(x1===x2)return `M ${coordinate(x1,y1)} V ${point(y2)}`;
 // Keep the endpoint on its pill, but turn only after leaving its reading body.
 const clearY=Math.max(y1+(from.previewWidth?previewSpace:0),clearance),middle=(clearY+y2)/2,sign=Math.sign(x2-x1),radius=Math.min(40,Math.abs(x2-x1)/2,Math.max(0,y2-clearY)/4);
 return `M ${coordinate(x1,y1)} V ${point(middle-radius)} Q ${coordinate(x1,middle)} ${coordinate(x1+sign*radius,middle)} H ${point(x2-sign*radius)} Q ${coordinate(x2,middle)} ${coordinate(x2,middle+radius)} V ${point(y2)}`;
}
function horizontal(from:BrainBoardLayoutNode,to:BrainBoardLayoutNode){
 const right=cx(from)<cx(to),x1=right?from.x+from.width:from.x,x2=right?to.x:to.x+to.width,y1=cy(from),y2=cy(to),middle=(x1+x2)/2;
 return `M ${coordinate(x1,y1)} C ${coordinate(middle,y1)} ${coordinate(middle,y2)} ${coordinate(x2,y2)}`;
}
/** The bend begins at the actual shared parent, never at the center's side. */
function siblingPath(parent:BrainBoardLayoutNode,sibling:BrainBoardLayoutNode,targets:readonly BrainBoardLayoutNode[]){
 const x1=parent.x+parent.width,y1=cy(parent),x2=sibling.x,y2=cy(sibling);
 if(x2<=x1||Math.abs(y2-y1)<2)return horizontal(parent,sibling);
 const bend=x1+(x2-x1)*.71,sign=y2>=y1?1:-1,radius=Math.min(64,(x2-x1)*.25,Math.abs(y2-y1)/2);
 // Paths sharing a parent and vertical direction must leave along exactly the
 // same turn; a closer sibling must not draw a second, slightly smaller stem.
 const trunkRadius=Math.min(radius,...targets.filter(target=>target.x>x1&&Math.abs(cy(target)-y1)>=2&&Math.sign(cy(target)-y1)===sign).map(target=>Math.min(64,(target.x-x1)*.25,Math.abs(cy(target)-y1)/2)));
 return `M ${coordinate(x1,y1)} H ${point(bend-trunkRadius)} Q ${coordinate(bend,y1)} ${coordinate(bend,y1+sign*trunkRadius)} V ${point(y2-sign*radius)} Q ${coordinate(bend,y2)} ${coordinate(bend+radius,y2)} H ${point(x2)}`;
}

/** Pure, bounded display projection of an already resolved local neighborhood.
 * Source geometry, titles, relationship evidence, and board state are not mutated.
 * A real shared parent stays visible on every page; all other unique neighbors are
 * paged in balanced spatial zones, including when the caller requests one per page.
 */
export function brainBoardLayout(matches:LocalRelationMatches,options:BrainBoardLayoutOptions={}):BrainBoardLayout {
 const width=finite(options.width,1600,1000,6000),baseHeight=finite(options.height,870,650,4000),pageSize=finite(options.pageSize,20,1,30),requested=finite(options.page,0,0,Number.MAX_SAFE_INTEGER);
 const result:BrainBoardLayout={width,height:baseHeight,nodes:[],links:[],labels:[],page:0,pages:1,total:0};
 if(!matches.center||!supportsLocalRelations(matches.center))return result;
 const seen=new Set([matches.center.id]),choices:Choice[]=[];
 for(const role of priority)for(const group of matches.groups){if(group.kind!==role)continue;for(const item of group.items){if(seen.has(item.id)||!supportsLocalRelations(item))continue;seen.add(item.id);choices.push({item,role});}}
 result.total=choices.length;
 const pinnedParent=choices.find(choice=>choice.role==='parents');
 // Direct children stay in one row so a rear link cannot look like a child branch.
 const zones=[
  choices.filter(choice=>choice!==pinnedParent&&choice.role==='parents'),
  choices.filter(choice=>choice.role==='children'),
  choices.filter(choice=>choice.role==='siblings'),
  choices.filter(choice=>choice.role==='associated'||choice.role==='incoming'||choice.role==='outgoing')
 ],caps=[4,4,6,6],offsets=[0,0,0,0];
 let remaining=choices.length-(pinnedParent?1:0),cursor=0,page=0,selected:Choice[]=[],last:Choice[]=[],revealedPage:number|undefined;
 while(remaining){
  const rows:Choice[]=[],counts=[0,0,0,0];let skipped=0;
  while(rows.length<pageSize&&remaining&&skipped<zones.length){
   const zone=cursor;cursor=(cursor+1)%zones.length;
   if(offsets[zone]>=zones[zone].length||counts[zone]>=caps[zone]){skipped++;continue;}
   rows.push(zones[zone][offsets[zone]++]);counts[zone]++;remaining--;skipped=0;
  }
  if(options.revealId&&rows.some(row=>row.item.id===options.revealId)){selected=rows;revealedPage=page;}
  else if(page===requested&&revealedPage===undefined)selected=rows;last=rows;page++;
 }
 result.pages=Math.max(1,page);result.page=revealedPage??Math.min(requested,result.pages-1);if(revealedPage===undefined&&requested>=result.pages)selected=last;
 if(pinnedParent)selected=[pinnedParent,...selected];
 const parents=selected.filter(row=>row.role==='parents'),children=selected.filter(row=>row.role==='children'),siblings=selected.filter(row=>row.role==='siblings'),associated=selected.filter(row=>row.role==='associated'||row.role==='incoming'||row.role==='outgoing');
 const leftAssociated=associated.filter(row=>row.role!=='associated'||options.associationSides?.get(row.item.id)!=='right'),rightAssociated=associated.filter(row=>row.role==='associated'&&options.associationSides?.get(row.item.id)==='right'),rightColumn=[...siblings,...rightAssociated];
 const childRows=Math.ceil(children.length/4),sideCount=Math.max(leftAssociated.length,rightColumn.length),sideSpan=(sideCount-1)*(sideCount<=3?128:64)/2;
 // Leave a clear horizontal lane above the child grid, even at the narrow intrinsic width.
 const sideHeight=children.length&&sideCount>1?Math.ceil((sideSpan+71)/(.712644-.475)):650;
 const height=Math.max(baseHeight,childRows>1?720:650,sideHeight);result.height=height;
 const center:BrainBoardLayoutNode={id:matches.center.id,role:'center',x:width/2-120,y:height*.475-36,width:240,height:72};result.nodes.push(center);
 const place=(row:Choice,x:number,y:number)=>{const node:BrainBoardLayoutNode={id:row.item.id,role:row.role,x:point(x-89),y:point(y-24.5),width:178,height:49};result.nodes.push(node);return node;};
 const grid=(rows:Choice[],baseY:number,upward=false)=>{
  const rowCount=Math.ceil(rows.length/4),columns=Math.ceil(rows.length/Math.max(1,rowCount)),gap=Math.min(228,(width-418)/Math.max(1,columns-1));
  for(let row=0;row<rowCount;row++){const items=rows.slice(row*columns,(row+1)*columns),y=baseY+(upward?row-rowCount+1:row)*78;items.forEach((item,i)=>place(item,width/2+(i-(items.length-1)/2)*gap,y));}
 };
 grid(parents,height*.233333,true);grid(children,height*.712644);
 const side=(rows:Choice[],x:number)=>{
  const available=children.length?2*(height*.712644-65-cy(center)-6):height-330;
  const gap=Math.min(128,Math.max(56,available/Math.max(1,rows.length-1)));
  rows.forEach((row,i)=>place(row,x,cy(center)+6+(i-(rows.length-1)/2)*gap));
 };
 side(leftAssociated,width*.2075);side(rightColumn,width*.7925);
 const nodes=new Map(result.nodes.map(node=>[node.id,node]));
 const expanded=new Set((options.expandedIds||[]).filter(id=>nodes.has(id)));
 // Reading bodies reserve 200px plus their 12px gap. Keep the approved pill
 // coordinates; wider bodies use only the clear space in their existing lane.
 for(const node of result.nodes)if(expanded.has(node.id)){
  if(node.role==='center')node.previewWidth=340;
  else if(node.role==='parents'||node.role==='children'){
   const gap=Math.min(...result.nodes.filter(other=>other!==node&&other.role===node.role&&other.y===node.y).map(other=>Math.abs(cx(other)-cx(node))));
   node.previewWidth=Math.max(node.width,Math.floor(Math.min(280,gap-16)));
  }else node.previewWidth=Math.max(node.width,Math.floor(Math.min(280,2*(Math.abs(cx(node)-cx(center))-170-16))));
 }
 const occupied=(node:BrainBoardLayoutNode)=>{const width=node.previewWidth??node.width;return{x:cx(node)-width/2,y:node.y,width,bottom:node.y+node.height+(expanded.has(node.id)?previewSpace:0)};};
 if(expanded.size){
  const shiftRows=(items:BrainBoardLayoutNode[])=>{
   const rows=new Map<number,BrainBoardLayoutNode[]>();for(const item of items){const row=rows.get(item.y)||[];row.push(item);rows.set(item.y,row);}
   let offset=0;for(const [,row]of [...rows].sort(([a],[b])=>a-b)){for(const item of row)item.y+=offset;if(row.some(item=>expanded.has(item.id)))offset+=previewSpace+10;}return offset;
  };
  const parentOffset=shiftRows(parents.map(row=>nodes.get(row.item.id)!));
  for(const node of result.nodes)if(node.role!=='parents')node.y+=parentOffset;
  const childNodes=children.map(row=>nodes.get(row.item.id)!);
  if(expanded.has(center.id))for(const child of childNodes)child.y+=previewSpace+10;
  for(const column of [leftAssociated,rightColumn]){
   let bottom=-Infinity;for(const node of column.map(row=>nodes.get(row.item.id)!).sort((a,b)=>a.y-b.y)){node.y=Math.max(node.y,bottom+12);bottom=occupied(node).bottom;}
  }
  shiftRows(childNodes);
  // A long side preview must not cover a child sharing its horizontal lane.
  let childOffset=0;for(const side of [...associated,...siblings]){const sideBox=occupied(nodes.get(side.item.id)!);for(const child of childNodes){const box=occupied(child);if(box.x<sideBox.x+sideBox.width&&sideBox.x<box.x+box.width)childOffset=Math.max(childOffset,sideBox.bottom+40-box.y);}}
  for(const child of childNodes)child.y+=childOffset;
  result.height=Math.max(height,...result.nodes.map(node=>occupied(node).bottom+128));
 }
 // Delay the shared child fork until it has cleared every side lane it crosses.
 // The child pills already fit; only a crowded turn needs a little more room.
 const childNodes=children.map(row=>nodes.get(row.item.id)!),sourceClearY=center.y+center.height+(center.previewWidth?previewSpace:0);let childClearance=0;
 for(const child of childNodes){
  const x1=cx(center),x2=cx(child);if(x1===x2)continue;
  const turnStart=(sourceClearY+child.y)/2-Math.min(40,Math.abs(x2-x1)/2,Math.max(0,child.y-sourceClearY)/4);
  for(const side of [...associated,...siblings]){const box=occupied(nodes.get(side.item.id)!);if(Math.min(x1,x2)<box.x+box.width&&box.x<Math.max(x1,x2)&&turnStart<box.bottom+8)childClearance=Math.max(childClearance,box.bottom+8);}
 }
 if(childClearance){
  const offset=Math.max(0,Math.max(sourceClearY,childClearance)+32-Math.min(...childNodes.map(node=>node.y)));
  if(offset){for(const child of childNodes)child.y=point(child.y+offset);result.height=Math.max(result.height,...childNodes.map(node=>occupied(node).bottom+128));}
 }
 const siblingTargets=new Map<string,BrainBoardLayoutNode[]>();
 for(const {item}of siblings)for(const parentId of new Set(item.viaParentIds)){const targets=siblingTargets.get(parentId)||[];targets.push(nodes.get(item.id)!);siblingTargets.set(parentId,targets);}
 for(const {item,role}of selected){
  const node=nodes.get(item.id)!;
  if(role==='siblings'){
   for(const parentId of new Set(item.viaParentIds)){const parent=nodes.get(parentId);if(parent?.role==='parents')result.links.push({from:parent.id,to:node.id,path:siblingPath(parent,node,siblingTargets.get(parentId)!),dashed:false,role});}
  }else{
   const from=role==='parents'||role==='incoming'||role==='associated'?node:center,to=from===center?node:center;
   result.links.push({from:from.id,to:to.id,path:role==='parents'||role==='children'?vertical(from,to,role==='children'?childClearance:0):horizontal(from,to),dashed:role==='associated'||role==='incoming'||role==='outgoing',role});
  }
 }
 const top=(rows:Choice[])=>Math.min(...rows.map(row=>nodes.get(row.item.id)!.y));
 if(parents.length)result.labels.push({text:'上级',x:width/2,y:Math.max(28,point(top(parents)-70))});
 if(leftAssociated.length)result.labels.push({text:'关联',x:point(width*.2075),y:Math.max(28,point(top(leftAssociated)-70))});
 if(rightColumn.length)result.labels.push({text:siblings.length?rightAssociated.length?'同级 · 关联':'同级':'关联',x:point(width*.7925),y:Math.max(28,point(top(rightColumn)-70))});
 if(children.length)result.labels.push({text:'下级',x:width/2,y:Math.min(result.height-32,point(Math.max(...children.map(row=>occupied(nodes.get(row.item.id)!).bottom))+78))});
 return result;
}

/** Child rows retain their downward composition; association paths extend
 * sideways. Discovery only places unique nodes: every visible original edge,
 * including cycles and shared endpoints, is drawn with its actual semantics. */
export function brainBoardDescendantLayout(base:BrainBoardLayout,page:BrainDescendantPage,expandedIds:readonly string[]):BrainBoardLayout&{hiddenEdges:number} {
 const nodes=base.nodes.filter(node=>node.role!=='children'&&(!['associated','incoming','outgoing'].includes(node.role)||!page.ids.includes(node.id))).map(node=>({...node})),center=nodes.find(node=>node.role==='center');
 const result={...base,nodes,links:base.links.filter(link=>link.role!=='children'),labels:base.labels.filter(label=>label.text!=='下级'),hiddenEdges:page.hiddenEdges};
 if(!center)return result;
 const byId=new Map(nodes.map(node=>[node.id,node])),expanded=new Set(expandedIds),labels=new Set<string>();
 for(const node of nodes)if(page.depths.has(node.id))node.depth=page.depths.get(node.id);
 const occupied=(node:BrainBoardLayoutNode)=>({left:cx(node)-(node.previewWidth??node.width)/2,right:cx(node)+(node.previewWidth??node.width)/2,top:node.y,bottom:node.y+node.height+(node.previewWidth?previewSpace:0)});
 let y=Math.max(...nodes.map(node=>occupied(node).bottom))+100;
 for(let depth=1;depth<=5;depth++){
  const ids=page.ids.filter(id=>page.depths.get(id)===depth&&!byId.has(id)&&(page.lanes?.get(id)||'children')==='children');
  if(ids.length){result.labels.push({text:`下级 · 第 ${depth} 层`,x:cx(center),y:y-30});
   for(let offset=0;offset<ids.length;offset+=8){const row=ids.slice(offset,offset+8);let body=false;
    for(let at=0;at<row.length&&nodes.length<BRAIN_RENDER_NODES;at++){const id=row[at],node:BrainBoardLayoutNode={id,role:'children',depth,x:point(cx(center)+(at-(row.length-1)/2)*218-89),y,width:178,height:49};if(expanded.has(id)){node.previewWidth=202;body=true;}nodes.push(node);byId.set(id,node);}
    y+=body?previewSpace+85:85;
   }y+=60;
  }
  for(const id of page.ids.filter(id=>page.depths.get(id)===depth&&!byId.has(id))){
   if(nodes.length>=BRAIN_RENDER_NODES)break;
   const parentId=page.parents?.get(id)||'',parent=byId.get(parentId)||center,edge=page.steps?.get(id),branch=edge?.kind==='branch',lane=page.lanes?.get(id),peers=page.ids.filter(value=>page.depths.get(value)===depth&&page.parents?.get(value)===parentId&&page.lanes?.get(value)===lane&&page.steps?.get(value)?.kind!=='branch'),at=peers.indexOf(id),column=Math.floor(at/8),rows=Math.min(8,peers.length-column*8),gap=peers.some(value=>expanded.has(value))?previewSpace+85:85,node:BrainBoardLayoutNode={id,role:branch?'children':edge?.direction==='forward'?(edge.from===id?'incoming':'outgoing'):'associated',depth,x:branch?parent.x:point(parent.x+(lane==='right'?1:-1)*(360+column*218)),y:branch?occupied(parent).bottom+100:parent.y+(at%8-(rows-1)/2)*gap,width:178,height:49};
   if(expanded.has(id))node.previewWidth=202;
   while(nodes.some(other=>{const a=occupied(node),b=occupied(other);return a.left<b.right+20&&b.left<a.right+20&&a.top<b.bottom+24&&b.top<a.bottom+24;}))node.y+=node.previewWidth?previewSpace+85:85;
   nodes.push(node);byId.set(id,node);
   if(!branch){const label=`${parentId}:${depth}:${lane}:${column}`;if(!labels.has(label)){labels.add(label);result.labels.push({text:`关联 · 第 ${depth} 层`,x:cx(node),y:node.y-30});}}
  }
 }
 const minX=Math.min(0,...nodes.map(node=>occupied(node).left-40)),shift=-minX;
 if(shift){for(const node of nodes)node.x+=shift;for(const label of result.labels)label.x+=shift;}
 result.width=Math.max(base.width+shift,...nodes.map(node=>occupied(node).right+40));
 result.links=result.links.filter(link=>byId.has(link.from)&&byId.has(link.to)&&link.role==='siblings');
 // Rebuild contextual parent links after shifting, then add all original edges.
 const pairs=new Set<string>();
 for(const edge of page.links){const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to)continue;
  if(result.links.length>=BRAIN_RENDER_EDGES){result.hiddenEdges++;continue;}
  const key=`${edge.from}\0${edge.to}`;if(pairs.has(key))continue;pairs.add(key);
  const branch=edge.kind==='branch',associated=edge.direction!=='forward'&&edge.direction!==undefined;
  result.links.push({from:edge.from,to:edge.to,path:branch?vertical(from,to):horizontal(from,to),dashed:!branch,role:branch?'children':associated?'associated':'outgoing'});
 }
 for(const link of base.links.filter(link=>link.role==='parents')){const from=byId.get(link.from),to=byId.get(link.to);if(from&&to&&!pairs.has(`${link.from}\0${link.to}`)){if(result.links.length<BRAIN_RENDER_EDGES)result.links.push({...link,path:vertical(from,to)});else result.hiddenEdges++;}}
 // Sibling curves refer to the same real shared parent, even after shifting.
 for(const link of result.links.filter(link=>link.role==='siblings')){const from=byId.get(link.from),to=byId.get(link.to);if(from&&to)link.path=horizontal(from,to);}
 result.height=Math.max(base.height,y+60,...nodes.map(node=>occupied(node).bottom+60));return result;
}
