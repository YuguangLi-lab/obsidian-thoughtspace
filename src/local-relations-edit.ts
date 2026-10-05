import {parseBoard,type Board,type Card,type Edge} from './model';
import {supportsLocalRelations} from './local-relations';

export interface LocalRelationValue {
 from:string;to:string;label:string;kind:'ordinary'|'branch';direction:'forward'|'both'|'none';
}
/** A detached, JSON-serializable optimistic precondition. Geometry is validated
 * against the latest board, but ordinary camera/size changes do not stale a form. */
export interface LocalRelationEditSnapshot {nodes:Record<string,string>;edge?:string;}
export type LocalRelationMutation=
 |{action:'create';centerId:string;value:LocalRelationValue;expected:LocalRelationEditSnapshot}
 |{action:'update';centerId:string;edgeId:string;value:LocalRelationValue;expected:LocalRelationEditSnapshot}
 |{action:'remove';centerId:string;edgeId:string;expected:LocalRelationEditSnapshot};
export interface LocalRelationEditResult {changed:boolean;edgeId?:string;}
export interface LocalRelationEditPlan extends LocalRelationEditResult {board:Board;edgeId:string;}
/** The edge edit is already in the session/undo stack; retrying the mutation could
 * duplicate it. The host throws this only when the subsequent disk save fails. */
export class LocalRelationEditSaveError extends Error {
 readonly committed=true;
 constructor(message:string){super(message);this.name='LocalRelationEditSaveError';}
}
function endpoint(board:Board,id:string):Card {
 if(typeof id!=='string'||!id.trim())throw Error('关系对象标识无效');const matches=board.nodes.filter(node=>node.id===id);
 if(matches.length!==1)throw Error('关系对象已删除或标识冲突，请重新打开关系编辑');
 const node=matches[0];if(!supportsLocalRelations(node))throw Error('关系编辑仅支持笔记卡片、子白板和分组');return node;
}
function edgeById(board:Board,id:string):Edge {
 if(typeof id!=='string'||!id.trim())throw Error('连线标识无效');const matches=board.edges.filter(edge=>edge.id===id);
 if(matches.length!==1)throw Error('这条本板连线已删除或标识冲突，请重新选择');return matches[0];
}
// Include every source identity used by native navigation. Paragraph/video
// provenance is currently restricted to other node kinds, but must not silently
// become a fresh form's target if a legacy/imported object changes underneath it.
const nodeStamp=(node:Card)=>JSON.stringify([node.id,node.kind,node.file??null,node.title??null,node.locked===true,node.paragraphQuote??null,node.videoCapture?.note??null]);
/** Capture at form/target selection time, never replace this with a fresh snapshot
 * immediately before committing: doing so would conceal a concurrent edit. */
export function captureLocalRelationEdit(board:Board,endpointIds:readonly string[],edgeId?:string):LocalRelationEditSnapshot {
 const edge=edgeId===undefined?undefined:edgeById(board,edgeId),ids=new Set([...endpointIds,...(edge?[edge.from,edge.to]:[])]),nodes:Record<string,string>=Object.create(null) as Record<string,string>;
 for(const id of ids)nodes[id]=nodeStamp(endpoint(board,id));return{nodes,...(edge?{edge:JSON.stringify(edge)}:{})};
}
function valueOf(raw:LocalRelationValue,current?:Edge):LocalRelationValue {
 if(!raw||typeof raw.from!=='string'||typeof raw.to!=='string'||typeof raw.label!=='string'||raw.label.length>200&&raw.label!==current?.label||!['ordinary','branch'].includes(raw.kind)||!['forward','both','none'].includes(raw.direction))throw Error('关系名称最多 200 字，类型和方向须有效');
 if(raw.from===raw.to)throw Error('请选择两个不同的关系对象');
 if(raw.kind==='branch'&&raw.direction!=='forward')throw Error('父子分支须使用父节点指向子节点的单向关系');
 // Accepting a legacy label is not a textual edit. Preserve it byte-for-byte;
 // normalize only newly entered or actually changed text.
 return{from:raw.from,to:raw.to,label:current?.label===raw.label?raw.label:raw.label.trim(),kind:raw.kind,direction:raw.direction};
}
function duplicateOrdinary(board:Board,value:LocalRelationValue,except?:string){
 return board.edges.some(edge=>edge.id!==except&&edge.kind!=='branch'&&(
  edge.from===value.from&&edge.to===value.to||
  (value.direction!=='forward'||edge.direction==='both'||edge.direction==='none')&&edge.from===value.to&&edge.to===value.from
 ));
}
/** Validate and plan only. The host owns session identity, undo, save and busy
 * guards, and must re-plan against the live board immediately inside its change.
 * This never edits Markdown/native references or normalizes unrelated edge data. */
export function planLocalRelationEdit(board:Board,request:LocalRelationMutation,newEdgeId?:string):LocalRelationEditPlan {
 if(!request||!['create','update','remove'].includes(request.action))throw Error('关系操作无效');
 if(!request.expected||!request.expected.nodes||typeof request.expected.nodes!=='object'||Array.isArray(request.expected.nodes))throw Error('关系快照已失效，请重新打开关系编辑');
 const current=request.action==='create'?undefined:edgeById(board,request.edgeId),value=request.action==='remove'?undefined:valueOf(request.value,current);
 if(current&&(typeof request.expected.edge!=='string'||JSON.stringify(current)!==request.expected.edge))throw Error('这条连线已被修改，请重新打开关系编辑');
 const ids=new Set([request.centerId,...(current?[current.from,current.to]:[]),...(value?[value.from,value.to]:[])]);
 for(const id of ids){const node=endpoint(board,id);if(!Object.hasOwn(request.expected.nodes,id)||request.expected.nodes[id]!==nodeStamp(node))throw Error('关系对象已变化，请重新打开关系编辑');if(node.locked)throw Error('请先解锁连线两端');}
 if(current&&current.from!==request.centerId&&current.to!==request.centerId||value&&value.from!==request.centerId&&value.to!==request.centerId)throw Error('请选择当前中心的本板连线');
 let edgeId:string,next:Edge|undefined,edges:Edge[];
 if(request.action==='remove'){
  edgeId=current!.id;edges=board.edges.filter(edge=>edge!==current);
 }else{
  const chosen=value!;edgeId=current?.id||newEdgeId||'';
  if(!current&&(typeof edgeId!=='string'||!edgeId.trim()||board.nodes.some(node=>node.id===edgeId)||board.edges.some(edge=>edge.id===edgeId)))throw Error('新连线标识缺失或冲突');
  // Existing parallel edges remain individually editable/removable. Only a new
  // pair or a conversion into ordinary links is prevented from adding duplicates.
  const samePair=current?.kind!=='branch'&&chosen.kind==='ordinary'&&current?.from===chosen.from&&current?.to===chosen.to;
  if(chosen.kind==='ordinary'&&!samePair&&duplicateOrdinary(board,chosen,current?.id))throw Error('已存在这条关联线，请选择具体的已有连线编辑');
  next={...(current||{id:edgeId,...(board.defaultEdgeStyle?{style:board.defaultEdgeStyle}:{})}),from:chosen.from,to:chosen.to,label:chosen.label,direction:chosen.direction};
  if(chosen.kind==='branch')next.kind='branch';else delete next.kind;
  // Retain an implicit forward direction when its existing relationship kind is
  // unchanged, so accepting an untouched legacy form is a genuine no-op.
  if(current&&current.direction===undefined&&chosen.direction==='forward'&&(current.kind==='branch')===(chosen.kind==='branch'))delete next.direction;
  if(current&&JSON.stringify(next)===JSON.stringify(current))return{board,edgeId,changed:false};
  edges=current?board.edges.map(edge=>edge===current?next!:edge):[...board.edges,next];
 }
 const candidate:Board={...board,version:request.action==='remove'?board.version:3,edges};
 // Reuse the complete native board and branch validation, including single-parent
 // forests and mixed branch/group-containment cycles. Parsing only inspects a
 // serialized candidate; it cannot mutate caller-owned nodes or source strings.
 parseBoard(JSON.stringify(candidate));
 return{board:candidate,edgeId,changed:true};
}
