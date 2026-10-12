import type {Card} from './model';
import {hasAsciiControl,isRecord,isUnknownArray} from './value-guards';

export const BOARD_MINDMAP_HISTORY_LIMIT=40;
export const BOARD_MINDMAP_PINS_LIMIT=6;
export const BOARD_MINDMAP_EXPANDED_LIMIT=8;
export interface BoardMindmapState {
 version:1;descendantDepth?:number;centerId?:string;expandedIds:string[];pins:string[];history:{entries:string[];index:number};
}
export type BoardMindmapAction=
 |{type:'depth';value:number}
 |{type:'center';id:string}
 |{type:'expand';id:string;expanded?:boolean}
 |{type:'pin';id:string;pinned?:boolean}
 |{type:'history';direction:'back'|'forward'};

const validId=(value:unknown):value is string=>typeof value==='string'&&!!value&&value.length<=256&&value.trim()===value&&!hasAsciiControl(value)&&!value.includes(String.fromCharCode(127));
const keysWithin=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).every(key=>keys.includes(key));
function validIds(value:unknown,limit:number,unique=true):value is string[]{
 return isUnknownArray(value)&&value.length<=limit&&value.every(validId)&&(!unique||new Set(value).size===value.length);
}
/** References stay local to the owning board. Containers and standalone text cannot become centers. */
export function supportsBoardMindmapTarget(node:Pick<Card,'kind'|'brainIdea'>):boolean {
 return node.kind==='card'||node.kind==='board'||node.kind==='section'||node.kind==='text'&&node.brainIdea===true;
}
/** Missing referenced objects are meaningful saved state, not corrupt board data. */
export function validBoardMindmapState(value:unknown):value is BoardMindmapState {
 if(!isRecord(value)||!keysWithin(value,['version','centerId','expandedIds','pins','history','descendantDepth'])||value.descendantDepth!==undefined&&(typeof value.descendantDepth!=='number'||!Number.isInteger(value.descendantDepth)||value.descendantDepth<1||value.descendantDepth>5)||value.version!==1||value.centerId!==undefined&&!validId(value.centerId)||!validIds(value.expandedIds,BOARD_MINDMAP_EXPANDED_LIMIT)||!validIds(value.pins,BOARD_MINDMAP_PINS_LIMIT)||!isRecord(value.history)||!keysWithin(value.history,['entries','index']))return false;
 const history=value.history;if(!validIds(history.entries,BOARD_MINDMAP_HISTORY_LIMIT,false)||typeof history.index!=='number'||!Number.isInteger(history.index))return false;
 const entries=history.entries;if(!entries.length)return history.index===-1&&value.centerId===undefined;
 return history.index>=0&&history.index<entries.length&&value.centerId===entries[history.index]&&entries.every((id,index)=>!index||id!==entries[index-1]);
}
export function createBoardMindmapState(centerId?:string):BoardMindmapState {
 if(centerId!==undefined&&!validId(centerId))throw Error('脑图对象标识无效');
 return{version:1,...(centerId===undefined?{}:{centerId}),expandedIds:[],pins:[],history:{entries:centerId===undefined?[]:[centerId],index:centerId===undefined?-1:0}};
}
function copyState(state:BoardMindmapState):BoardMindmapState {
 if(!validBoardMindmapState(state))throw Error('脑图容器状态无效');
 return{version:1,...(state.descendantDepth===undefined?{}:{descendantDepth:state.descendantDepth}),...(state.centerId===undefined?{}:{centerId:state.centerId}),expandedIds:[...state.expandedIds],pins:[...state.pins],history:{entries:[...state.history.entries],index:state.history.index}};
}
/** Pure intent changes. The host commits only this state through the board's normal history. */
export function updateBoardMindmapState(state:BoardMindmapState,action:BoardMindmapAction,nodes:readonly Card[]):BoardMindmapState {
 const next=copyState(state);
 if(action.type==='depth'){if(!Number.isInteger(action.value)||action.value<1||action.value>5)throw Error('子节点显示深度须为 1–5 层');if(action.value===1)delete next.descendantDepth;else next.descendantDepth=action.value;return next;}
 if(action.type==='history'){
  const index=next.history.index+(action.direction==='back'?-1:1);
  if(index>=0&&index<next.history.entries.length){next.history.index=index;next.centerId=next.history.entries[index];}
  return next;
 }
 if(!validId(action.id))throw Error('脑图对象标识无效');
 const requireTarget=()=>{if(!nodes.some(node=>node.id===action.id&&supportsBoardMindmapTarget(node)))throw Error('此对象已移除或不支持脑图，请选择本板笔记卡片、子白板或分组');};
 if(action.type==='center'){
  requireTarget();if(next.centerId===action.id)return next;
  const entries=next.history.entries.slice(0,next.history.index+1);entries.push(action.id);
  next.history.entries=entries.slice(-BOARD_MINDMAP_HISTORY_LIMIT);next.history.index=next.history.entries.length-1;next.centerId=action.id;return next;
 }
 const list=action.type==='expand'?next.expandedIds:next.pins,limit=action.type==='expand'?BOARD_MINDMAP_EXPANDED_LIMIT:BOARD_MINDMAP_PINS_LIMIT,index=list.indexOf(action.id),enabled=action.type==='expand'?action.expanded??index<0:action.pinned??index<0;
 if(!enabled){if(index>=0)list.splice(index,1);return next;}
 if(index>=0)return next;requireTarget();
 if(list.length>=limit)throw Error(action.type==='expand'?'最多同时展开 8 个对象，请先收起其他对象':'最多固定 6 个对象，请先取消其他固定');
 list.push(action.id);return next;
}
/** Same-board copies follow copied targets; references outside the copied set retain their IDs. */
export function remapBoardMindmapState(state:BoardMindmapState,replacements:ReadonlyMap<string,string>):BoardMindmapState {
 const next=copyState(state),map=(id:string)=>{const result=replacements.get(id)??id;if(!validId(result))throw Error('复制后的脑图对象标识无效');return result;};
 next.expandedIds=[...new Set(next.expandedIds.map(map))];next.pins=[...new Set(next.pins.map(map))];
 const entries:string[]=[];let index=-1;
 for(let at=0;at<next.history.entries.length;at++){const id=map(next.history.entries[at]);if(entries.at(-1)!==id)entries.push(id);if(at<=next.history.index)index=entries.length-1;}
 next.history={entries,index};if(index>=0)next.centerId=entries[index];else delete next.centerId;
 return next;
}

/** Canvas has no embedded mindmap type. Export readable references without cloning their bodies. */
export function boardMindmapSummary(node:Pick<Card,'title'|'mindmap'>,nodes:readonly Card[]):string {
 const plain=(value:string)=>value.replace(/[\r\n]+/g,' ').replace(/[\\`*_{}[\]<>#|]/g,'\\$&'),state=node.mindmap;
 const lines=['# '+plain((node.title||'脑图容器').slice(0,160)),'','本板脑图引用摘要；交互状态保留在原 ThoughtSpace 白板中。'];
 if(!state)return lines.join('\n');
 const byId=new Map(nodes.map(item=>[item.id,item])),label=(id:string)=>{const item=byId.get(id);return item&&supportsBoardMindmapTarget(item)?plain((item.title||item.file||'分组').slice(0,300))+' · ID '+plain(id):'对象不可用 · ID '+plain(id);};
 lines.push('',state.centerId?'中心：'+label(state.centerId):'中心：尚未选择');
 for(const [title,ids]of [['展开',state.expandedIds],['固定',state.pins]] as const)if(ids.length)lines.push('',title+'：',...ids.map(id=>'- '+label(id)));
 return lines.join('\n');
}
