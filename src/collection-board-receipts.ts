import {CollectionJsonStore,type CollectionJsonAdapter} from './collection-json-store';
import {readCollectionIdentity,type CollectionIdentity} from './collection-model';

export interface CollectionBoardReceipt {
 operationId:string;sourceId:string;sourceCreatedAt:string;sourcePath:string;
 boardId:string;boardPath:string;groupId?:string;nodeIds:string[];added:number;
 duplicate:boolean;status:'prepared'|'confirmed'|'not-written';createdAt:string;confirmedAt?:string;
}
export interface CollectionBoardDeliveryResult {added:number;existingNodeIds?:string[];boardId?:string;receipt?:CollectionBoardReceipt;}
interface ReceiptDocument {version:1;sourceId:string;sourceCreatedAt:string;receipts:CollectionBoardReceipt[];}
export interface CollectionBoardReceiptHistory {receipts:readonly CollectionBoardReceipt[];warning?:string;}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const token=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const control=(value:string)=>Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127);
const nodeId=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=4096&&!control(value);
const path=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=4096&&!value.startsWith('/')&&!/[\\:]/.test(value)&&!control(value)&&value.split('/').every(part=>!!part&&part!=='.'&&part!=='..');
const time=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function identity(id:unknown,createdAt:unknown){return readCollectionIdentity({thoughtspace_capture:id,thoughtspace_created:createdAt});}
export function isCollectionBoardReceipt(value:unknown):value is CollectionBoardReceipt {
 if(!object(value)||Object.keys(value).some(key=>!['operationId','sourceId','sourceCreatedAt','sourcePath','boardId','boardPath','groupId','nodeIds','added','duplicate','status','createdAt','confirmedAt'].includes(key)))return false;
 return token(value.operationId)&&!!identity(value.sourceId,value.sourceCreatedAt)&&path(value.sourcePath)&&typeof value.boardId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value.boardId)&&path(value.boardPath)&&(value.groupId===undefined||nodeId(value.groupId))&&
  Array.isArray(value.nodeIds)&&value.nodeIds.length>0&&value.nodeIds.length<=10000&&value.nodeIds.every(nodeId)&&new Set(value.nodeIds).size===value.nodeIds.length&&Number.isInteger(value.added)&&Number(value.added)>=0&&Number(value.added)<=1&&Number(value.added)<=value.nodeIds.length&&
  typeof value.duplicate==='boolean'&&typeof value.status==='string'&&['prepared','confirmed','not-written'].includes(value.status)&&time(value.createdAt)&&(value.status==='confirmed'?time(value.confirmedAt)&&value.confirmedAt>=value.createdAt:value.confirmedAt===undefined);
}
export function isCollectionBoardReceiptDocument(value:unknown):value is ReceiptDocument {
 if(!object(value)||Object.keys(value).length!==4||value.version!==1||!identity(value.sourceId,value.sourceCreatedAt)||!Array.isArray(value.receipts)||value.receipts.length>512)return false;
 return value.receipts.every(receipt=>isCollectionBoardReceipt(receipt)&&receipt.sourceId===value.sourceId&&receipt.sourceCreatedAt===value.sourceCreatedAt)&&new Set(value.receipts.map(receipt=>(receipt as CollectionBoardReceipt).operationId)).size===value.receipts.length;
}
/** A prepared receipt is durable before a board can change. It is never
 * automatically replayed after restart; only exact disk node IDs can confirm it. */
export class CollectionBoardReceipts {
 private store:CollectionJsonStore<ReceiptDocument>;
 constructor(adapter:CollectionJsonAdapter,directory:string,readonly source:CollectionIdentity,newId:()=>string){
  if(!identity(source.id,source.createdAt))throw Error('收集来源标识无效');
  this.store=new CollectionJsonStore(adapter,`${directory}/${source.id}.json`,newId,isCollectionBoardReceiptDocument);
 }
 async history():Promise<CollectionBoardReceiptHistory>{
  const read=await this.store.read();
  if(read.value&&(read.value.sourceId!==this.source.id||read.value.sourceCreatedAt!==this.source.createdAt))return{receipts:[],warning:'收集来源标识冲突；投递回执已保留，请先核对'};
  return{receipts:read.value?.receipts||[],...(read.blocked?{warning:read.blocked}:{})};
 }
 async put(receipt:CollectionBoardReceipt,current:()=>boolean):Promise<void>{
  const history=await this.history();if(history.warning)throw Error(history.warning);
  if(receipt.sourceId!==this.source.id||receipt.sourceCreatedAt!==this.source.createdAt)throw Error('回执来源不一致');
  const old=history.receipts.find(item=>item.operationId===receipt.operationId);
  if(old){
   if(old.boardId!==receipt.boardId||old.boardPath!==receipt.boardPath||old.groupId!==receipt.groupId||old.duplicate!==receipt.duplicate||old.added!==receipt.added||JSON.stringify(old.nodeIds)!==JSON.stringify(receipt.nodeIds)||old.createdAt!==receipt.createdAt)throw Error('原投递意图已变化，回执未覆盖');
   if(old.status!=='prepared'&&JSON.stringify(old)!==JSON.stringify(receipt))throw Error('已结束的投递回执不能重写');
  }else if(receipt.status!=='prepared'||history.receipts.some(item=>item.status==='prepared'))throw Error('上次投递尚未确认，请先核对原白板');
  const receipts=old?history.receipts.map(item=>item.operationId===receipt.operationId?receipt:item):[...history.receipts,receipt];
  if(receipts.length>512)throw Error('投递历史已达上限，原回执已保留');
  await this.store.write({version:1,sourceId:this.source.id,sourceCreatedAt:this.source.createdAt,receipts},current);
 }
}
