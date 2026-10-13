import type {Board} from './model';
import {BOARD_MINDMAP_EXPANDED_LIMIT,supportsBoardMindmapTarget,updateBoardMindmapState,validBoardMindmapState} from './board-mindmap';
import {hasAsciiControl,isFiniteNumber,isRecord,isUnknownArray} from './value-guards';

export const BRAIN_READING_POSITIONS_LIMIT=50;
export interface BrainReadingPositionState {
 version:1;centerId:string;expandedIds:string[];depth:number;viewport:{x:number;y:number;zoom:number};
}
export interface BrainReadingPosition extends BrainReadingPositionState {id:string;name:string;}
declare module './model' {interface Board {brainReadingPositions?:BrainReadingPosition[];}}

const identifier=(value:unknown):value is string=>typeof value==='string'&&!!value&&value.length<=256&&value.trim()===value&&!hasAsciiControl(value)&&!value.includes(String.fromCharCode(127));
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));
export function validBrainReadingPositionState(value:unknown,named=false):value is BrainReadingPositionState {
 if(!isRecord(value)||!keys(value,named?['version','id','name','centerId','expandedIds','depth','viewport']:['version','centerId','expandedIds','depth','viewport'])||value.version!==1||!identifier(value.centerId)||!isUnknownArray(value.expandedIds)||value.expandedIds.length>BOARD_MINDMAP_EXPANDED_LIMIT||!value.expandedIds.every(identifier)||new Set(value.expandedIds).size!==value.expandedIds.length||!isFiniteNumber(value.depth)||!Number.isInteger(value.depth)||value.depth<1||value.depth>5)return false;
 const camera=value.viewport;if(!isRecord(camera)||!keys(camera,['x','y','zoom'])||![camera.x,camera.y,camera.zoom].every(isFiniteNumber)||!isFiniteNumber(camera.zoom)||camera.zoom<.15||camera.zoom>2.5)return false;
 return !named||identifier(value.id)&&typeof value.name==='string'&&!!value.name.trim()&&value.name.trim()===value.name&&value.name.length<=100&&!hasAsciiControl(value.name);
}
/** Missing node references survive deletions. Resolution, rather than parsing,
 * decides how to recover a saved place without changing note content. */
export function validBrainReadingPositions(value:unknown):value is BrainReadingPosition[] {
 return isUnknownArray(value)&&value.length<=BRAIN_READING_POSITIONS_LIMIT&&value.every(item=>validBrainReadingPositionState(item,true))&&new Set(value.map(item=>(item as BrainReadingPosition).id)).size===value.length;
}
function requireBrain(board:Board){if(board.presentation!=='brain'||board.version!==3||!validBoardMindmapState(board.brain))throw Error('此白板不支持脑图阅读位置');if(board.brainReadingPositions!==undefined&&!validBrainReadingPositions(board.brainReadingPositions))throw Error('脑图阅读位置数据无效，未修改白板');return board.brain;}
function name(value:string){const result=value.trim();if(!result||result.length>100||hasAsciiControl(result))throw Error('阅读位置名称需要 1–100 个字符');return result;}
function copy(value:BrainReadingPositionState):BrainReadingPositionState{return{version:1,centerId:value.centerId,expandedIds:[...value.expandedIds],depth:value.depth,viewport:{...value.viewport}};}
export function brainReadingPositionStamp(value:BrainReadingPosition){return JSON.stringify(value);}
export function brainReadingPositionStateStamp(value:BrainReadingPositionState){return JSON.stringify(copy(value));}
function find(board:Board,id:string,expected?:string){requireBrain(board);const value=board.brainReadingPositions?.find(position=>position.id===id);if(!value)throw Error('阅读位置已移除，请刷新列表');if(expected!==undefined&&brainReadingPositionStamp(value)!==expected)throw Error('阅读位置已变化，请刷新后重试');return value;}
/** The view supplies its logical camera, including inputs whose DOM frame has
 * not yet painted. Navigation history and pins remain independent live state. */
export function captureBrainReadingPosition(board:Board,viewport:BrainReadingPositionState['viewport']):BrainReadingPositionState {
 const brain=requireBrain(board);if(!brain.centerId||!board.nodes.some(node=>node.id===brain.centerId&&supportsBoardMindmapTarget(node)))throw Error('请先选择一个可用的中心节点');
 const value:BrainReadingPositionState={version:1,centerId:brain.centerId,expandedIds:[...brain.expandedIds],depth:brain.descendantDepth??1,viewport:{...viewport}};
 if(!validBrainReadingPositionState(value))throw Error('当前脑图位置无效，请调整镜头后重试');return value;
}
export function addBrainReadingPosition(board:Board,id:string,title:string,state:BrainReadingPositionState){
 requireBrain(board);const label=name(title);if(!identifier(id)||board.brainReadingPositions?.some(position=>position.id===id))throw Error('阅读位置标识冲突，请重试');if((board.brainReadingPositions?.length??0)>=BRAIN_READING_POSITIONS_LIMIT)throw Error('最多保存 50 个脑图阅读位置，请先移除旧位置');if(!validBrainReadingPositionState(state))throw Error('脑图阅读位置无效');
 (board.brainReadingPositions??=[]).push({...copy(state),id,name:label});
}
export function renameBrainReadingPosition(board:Board,id:string,title:string,expected?:string){const label=name(title);find(board,id,expected).name=label;}
export function updateBrainReadingPosition(board:Board,id:string,state:BrainReadingPositionState,expected?:string){if(!validBrainReadingPositionState(state))throw Error('脑图阅读位置无效');const value=find(board,id,expected);Object.assign(value,copy(state));}
export function removeBrainReadingPosition(board:Board,id:string,expected?:string){find(board,id,expected);board.brainReadingPositions=board.brainReadingPositions!.filter(position=>position.id!==id);}
export interface BrainReadingRestoreResult {degraded:boolean;reason?:string;centerId?:string;}
/** Apply once inside the normal Session transaction. Keep regular navigation
 * history/pins; the saved object cannot recursively retain earlier journeys. */
export function applyBrainReadingPosition(board:Board,position:BrainReadingPositionState):BrainReadingRestoreResult {
 const state=requireBrain(board);if(!validBrainReadingPositionState(position))throw Error('脑图阅读位置无效');
 const available=new Set(board.nodes.filter(supportsBoardMindmapTarget).map(node=>node.id));
 const exact=available.has(position.centerId),centerId=exact?position.centerId:state.centerId&&available.has(state.centerId)?state.centerId:board.nodes.find(supportsBoardMindmapTarget)?.id;
 let next=centerId?updateBoardMindmapState(state,{type:'center',id:centerId},board.nodes):{...state,expandedIds:[...state.expandedIds],pins:[...state.pins],history:{entries:[...state.history.entries],index:state.history.index}};
 next.expandedIds=position.expandedIds.filter(id=>available.has(id));if(position.depth===1)delete next.descendantDepth;else next.descendantDepth=position.depth;
 board.brain=next;if(exact)board.brainViewport={...position.viewport};else delete board.brainViewport;
 const missingExpanded=next.expandedIds.length!==position.expandedIds.length;
 return{degraded:!exact||missingExpanded,...(centerId?{centerId}:{}),...(!exact?{reason:centerId?'保存的中心节点已移除，已保留可用中心并重新适应关系图':'保存的中心节点已移除，本板暂时没有可用的中心节点'}:missingExpanded?{reason:'部分展开节点已移除，已恢复其余阅读位置'}:{})};
}
export function restoreBrainReadingPosition(board:Board,id:string,expected?:string){const value=find(board,id,expected);return applyBrainReadingPosition(board,copy(value));}
