import {clone,assertBoardGeometry,type Board,type Card} from './model';
import {reflowAutomaticMindmaps} from './mindmap';
import {reflowExpandedContent} from './expansion-layout';
import {textFitsContent} from './text-sizing';
import {foldKeys,readingGeometry,readingSignature,sameReadingGeometry,validReadingCheckpoint,type ReadingLayoutCheckpoint} from './expansion-checkpoint';

export interface ReadingReflowOptions {measurement?:boolean}
const opens=(now:Card,old:Card)=>foldKeys.some(key=>old[key]&&!now[key]);
const closes=(now:Card,old:Card)=>foldKeys.some(key=>!old[key]&&now[key]);
const automaticTextEdit=(now:Card,old:Card)=>now.text!==old.text&&textFitsContent(now);

function restoreReference(board:Board,state:ReadingLayoutCheckpoint):Board{
 const reference:Board={...board,nodes:board.nodes.map((node,i)=>{
  const old=state.base[i],copy={...node,x:old.x,y:old.y,width:old.width,height:old.height};
  for(const key of foldKeys){delete copy[key];if(old[key])copy[key]=true;}
  delete copy.expandedHeight;if(old.expandedHeight!==undefined)copy.expandedHeight=old.expandedHeight;
  return copy;
 })};
 delete reference.readingLayout;return reference;
}
function onlyReadingChanges(board:Board,before:Board,measurement:boolean):boolean{
 if(readingSignature(board)!==readingSignature(before))return false;
 return board.nodes.every((n,i)=>{
  const old=before.nodes[i];if(n.x!==old.x||n.y!==old.y)return false;
  if(n.width===old.width&&n.height===old.height)return true;
  if((measurement||automaticTextEdit(n,old))&&n.kind!=='section'&&!n.collapsed)return true;
  return n.width===old.width&&n.kind!=='section'&&!!n.collapsed!==!!old.collapsed&&
   (n.collapsed?n.height===72&&n.expandedHeight===old.height:n.height===old.expandedHeight);
 });
}
function layout(board:Board,before:Board):void{
 reflowAutomaticMindmaps(board,before);reflowExpandedContent(board,before);
}
/** Recover only automatically displaced geometry. Replaying from one baseline
 * handles overlapping reading sessions without pulling still-open cards together. */
export function reflowReadingContent(board:Board,before:Board,options:ReadingReflowOptions={}):void{
 const saved=before.readingLayout;
 let oldNodes:Map<string,Card>|undefined;
 const oldAt=(n:Card,i:number)=>before.nodes[i]?.id===n.id?before.nodes[i]:(oldNodes??=new Map(before.nodes.map(node=>[node.id,node]))).get(n.id);
 const opening=board.nodes.some((n,i)=>{const old=oldAt(n,i);return!!old&&opens(n,old);});
 const automaticGrowth=board.nodes.some((n,i)=>{const old=oldAt(n,i);return!!old&&n.kind!=='section'&&!n.collapsed&&(n.width>old.width||n.height>old.height)&&(options.measurement||automaticTextEdit(n,old));});
 // Typing, dragging and styling outside a reading cycle need no checkpoint
 // serialization or full-board geometry snapshot.
 if(!saved&&!opening&&!automaticGrowth){delete board.readingLayout;layout(board,before);return;}
 const eligible=onlyReadingChanges(board,before,!!options.measurement);
 let state=validReadingCheckpoint(saved,before.nodes)&&saved.signature===readingSignature(before)&&sameReadingGeometry(before.nodes,saved.applied)&&eligible?saved:undefined;
 const closing=board.nodes.some((n,i)=>{const old=oldAt(n,i);return!!old&&closes(n,old);});
 delete board.readingLayout;
 let recovered=false;
 if(state&&closing){
  const reference=restoreReference(board,state),candidate=clone(board);
  for(let i=0;i<candidate.nodes.length;i++){
   const node=candidate.nodes[i],base=state.base[i];node.x=base.x;node.y=base.y;
   if(node.kind==='section'){node.width=base.width;node.height=base.height;}
  }
  try{
   reflowAutomaticMindmaps(candidate,reference);
   const active=new Set(candidate.nodes.filter((n,i)=>opens(n,reference.nodes[i])||n.kind!=='section'&&(n.width>reference.nodes[i].width||n.height>reference.nodes[i].height)).map(n=>n.id));
   reflowExpandedContent(candidate,reference,{forcedSources:active,ownershipReference:reference});
   assertBoardGeometry(candidate);
   for(let i=0;i<board.nodes.length;i++){
    const node=board.nodes[i],next=candidate.nodes[i];node.x=next.x;node.y=next.y;
    if(node.kind==='section'){node.width=next.width;node.height=next.height;}
   }
   recovered=true;
  }catch{
   // Recovery is optional. Never reject a normal collapse because an old
   // location has become unsafe; keep the current layout and discard its cache.
   state=undefined;
  }
 }
 if(!recovered)layout(board,before);
 const displacedByGrowth=eligible&&automaticGrowth&&board.nodes.some((n,i)=>{const old=before.nodes[i];return n.x!==old.x||n.y!==old.y||n.kind==='section'&&(n.width!==old.width||n.height!==old.height);});
 if(!state&&eligible&&(opening||displacedByGrowth)){
  state={version:1,signature:readingSignature(board),base:readingGeometry(before.nodes),applied:[]};
 }
 if(state){
  const base=state.base;
  const open=board.nodes.some((n,i)=>foldKeys.some(key=>base[i][key]&&!n[key]));
  const displaced=board.nodes.some((n,i)=>n.x!==base[i].x||n.y!==base[i].y||n.kind==='section'&&(n.width!==base[i].width||n.height!==base[i].height));
  if(open||displaced)board.readingLayout={version:1,signature:readingSignature(board),base,applied:readingGeometry(board.nodes)};
 }
}
