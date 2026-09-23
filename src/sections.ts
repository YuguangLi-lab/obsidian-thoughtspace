import type {Board,Card} from './model';
export interface SectionRect {x:number;y:number;width:number;height:number;}
export function validSectionRect(r:SectionRect):boolean{return [r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>=80&&r.height>=60;}
// One pass: no membership cache or per-frame observers; membership follows geometry.
export function sectionBounds(nodes:readonly Card[]):SectionRect|undefined{
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const n of nodes){if(n.kind==='section')continue;left=Math.min(left,n.x);top=Math.min(top,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}
 return left===Infinity?undefined:{x:left-30,y:top-60,width:right-left+60,height:bottom-top+90};
}

export const SECTION_FOLDED_HEIGHT=72;
/** Logical bounds retain membership while a folded frame displays only its heading.
 * Strict nesting keeps coincident frames independent and cannot create a cycle. */
export function sectionContains(section:Card,node:Card):boolean{
 if(section.kind!=='section'||section.id===node.id||node.x<section.x||node.y<section.y||node.x+node.width>section.x+section.width||node.y+node.height>section.y+section.height)return false;
 return node.kind!=='section'||node.x>section.x||node.y>section.y||node.x+node.width<section.x+section.width||node.y+node.height<section.y+section.height;
}
/** A locked hidden member pins its folded frame as one movement unit. */
export function sectionMovementPinned(section:Card,nodes:readonly Card[]):boolean{return section.kind==='section'&&!!section.sectionFolded&&nodes.some(node=>node.locked&&sectionContains(section,node));}
/** Only the frame flag changes; nested frame/card folds and all geometry survive. */
export function foldSections(board:Board,ids:ReadonlySet<string>,folded:boolean):void{
 for(const node of board.nodes)if(node.kind==='section'&&!node.locked&&ids.has(node.id)){
  if(folded&&!node.sectionFolded){node.sectionFolded=true;board.version=3;}
  else if(!folded&&node.sectionFolded){delete node.sectionFolded;board.version=3;}
 }
}
/** Transaction-local visibility. Outer folds prune nested frames before scanning
 * their members; nothing is cached across movement, undo or changed containment. */
export function sectionFoldState(board:Board){
 const folded=board.nodes.filter(node=>node.kind==='section'&&node.sectionFolded),hidden=new Set<string>();
 if(!folded.length)return{folded,hidden};
 const outerFirst=[...folded].sort((a,b)=>b.width*b.height-a.width*a.height);
 // Many separate folded groups should not rescan every board object per frame.
 // Index the wider coordinate axis once; exact rectangle containment still decides.
 let axis:'x'|'y'='x',candidates=board.nodes;
 if(folded.length>8){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const node of board.nodes){minX=Math.min(minX,node.x);maxX=Math.max(maxX,node.x);minY=Math.min(minY,node.y);maxY=Math.max(maxY,node.y);}
  axis=maxY-minY>maxX-minX?'y':'x';candidates=[...board.nodes].sort((a,b)=>a[axis]-b[axis]);
 }
 const lowerBound=(value:number)=>{let left=0,right=candidates.length;while(left<right){const middle=(left+right)>>>1;if(candidates[middle][axis]<value)left=middle+1;else right=middle;}return left;};
 for(const section of outerFirst){
  if(hidden.has(section.id))continue;
  const indexed=candidates!==board.nodes,end=section[axis]+(axis==='x'?section.width:section.height);
  for(let i=indexed?lowerBound(section[axis]):0;i<candidates.length;i++){
   const node=candidates[i];if(indexed&&node[axis]>end)break;
   if(!hidden.has(node.id)&&sectionContains(section,node))hidden.add(node.id);
  }
 }
 return{folded,hidden};
}
/** Rendering projection only. Never persist it or derive group membership from it. */
export function sectionDisplayNode(node:Card):Card{return node.kind==='section'&&node.sectionFolded?{...node,width:Math.min(node.width,320),height:SECTION_FOLDED_HEIGHT}:node;}
/** Revealing a nested member opens every enclosing folded frame, not sibling folds. */
export function unfoldSectionAncestors(board:Board,id:string):void{
 const node=board.nodes.find(item=>item.id===id);if(!node)return;
 for(const section of board.nodes)if(section.sectionFolded&&sectionContains(section,node))delete section.sectionFolded;
}
