import {brainIdeaNode} from './brain-board-idea';
import {type Board,parseBoard} from './model';
import {captureLocalRelationEdit,planLocalRelationEdit,type LocalRelationEditSnapshot} from './local-relations-edit';

export type BrainRelationSide='top'|'bottom'|'left'|'right';
export const brainRelationLabels:Record<BrainRelationSide,string>={top:'添加父节点',bottom:'添加子节点',left:'添加左侧关联节点',right:'添加右侧关联节点'};

/** One board transaction: reference a native Markdown note and connect it to the
 * original center. Left/right are associations, never inferred sibling branches. */
export function planBrainNoteRelation(board:Board,centerId:string,path:string,side:BrainRelationSide,nodeId:string,edgeId:string,expected:LocalRelationEditSnapshot,ideaTitle?:string,fileKind:'card'|'board'='card'){
 if(board.presentation!=='brain'||!board.brain||!Object.hasOwn(brainRelationLabels,side))throw Error('脑图关系操作已失效');
 if(ideaTitle===undefined&&(typeof path!=='string'||!path.trim()||!path.toLowerCase().endsWith(fileKind==='board'?'.thoughtspace':'.md')))throw Error(fileKind==='board'?'请选择 ThoughtSpace 白板':'请选择 Markdown 笔记');
 const center=captureLocalRelationEdit(board,[centerId]);
 if(!expected?.nodes||expected.nodes[centerId]!==center.nodes[centerId])throw Error('中心节点已变化，请重新添加关系');
 let target=ideaTitle===undefined?board.nodes.find(node=>node.kind===fileKind&&node.file===path):undefined;
 const added=!target;
 if(!target){
  const x=board.nodes.reduce((right,node)=>Math.max(right,node.x+node.width),0)+400;
  target=ideaTitle===undefined?{id:nodeId,kind:fileKind,file:path,x,y:0,width:320,height:240,color:fileKind==='board'?'green':'slate'}:brainIdeaNode(nodeId,ideaTitle,x);
 }
 const draft:Board={...board,nodes:added?[...board.nodes,target]:board.nodes};
 const parent=side==='top',associated=side==='left'||side==='right';
 const plan=planLocalRelationEdit(draft,{action:'create',centerId,value:{from:parent?target.id:centerId,to:parent?centerId:target.id,kind:associated?'ordinary':'branch',direction:associated?'both':'forward',label:''},expected:captureLocalRelationEdit(draft,[centerId,target.id])},edgeId);
 // Reuse native board edge ports as display hints; no separate relation store.
 const edge=plan.board.edges.find(value=>value.id===edgeId)!;
 const next={...edge,fromSide:associated?side:'bottom',toSide:associated?(side==='left'?'right':'left'):'top'} as Board['edges'][number];
 const result={...plan.board,edges:plan.board.edges.map(value=>value.id===edgeId?next:value)};
 parseBoard(JSON.stringify(result));
 return{board:result,nodeId:target.id,added};
}

/** Port hints affect placement only. Actual shared-parent sibling evidence still
 * wins in the layout, and associations remain ordinary bidirectional edges. */
export function brainAssociationSides(board:Board,centerId:string){
 const result=new Map<string,'left'|'right'>();
 for(const edge of board.edges){
  if(edge.kind==='branch'||!['both','none'].includes(edge.direction||'')||edge.from!==centerId&&edge.to!==centerId)continue;
  const id=edge.from===centerId?edge.to:edge.from,side=edge.from===centerId?edge.fromSide:edge.toSide;
  if((side==='left'||side==='right')&&!result.has(id))result.set(id,side);
 }
 return result;
}
