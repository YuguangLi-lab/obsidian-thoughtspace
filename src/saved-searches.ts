import type {Board} from './model';
import {hasAsciiControl,isOneOf,isRecord,isUnknownArray} from './value-guards';
/** Board-owned criteria only. Results and note bodies are recomputed on opening. */
export interface SavedSearchQuery{query:string;kind:string;group:string;color:string;review:string;full:boolean;}
export interface SavedSearch{id:string;name:string;query:SavedSearchQuery;}
const queryKeys=['query','kind','group','color','review','full'];
function validQuery(value:unknown):value is SavedSearchQuery{return isRecord(value)&&Object.keys(value).every(key=>queryKeys.includes(key))&&typeof value.query==='string'&&value.query.length<=2000&&isOneOf(value.kind,['','card','text','image','pdf','audio','video','section','board','mindmap'])&&typeof value.group==='string'&&value.group.length<=200&&isOneOf(value.color,['','sand','blue','green','rose','purple','orange','red','teal','cyan','lime','slate','brown'])&&isOneOf(value.review,['','later','reading','done'])&&typeof value.full==='boolean';}
export function validSavedSearches(value:unknown):value is SavedSearch[]{if(!isUnknownArray(value)||value.length>50)return false;const seen=new Set<string>();for(const item of value){if(!isRecord(item)||Object.keys(item).some(key=>!['id','name','query'].includes(key))||typeof item.id!=='string'||!item.id.trim()||item.id.length>200||seen.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>100||hasAsciiControl(item.name)||!validQuery(item.query))return false;seen.add(item.id);}return true;}
function nameValue(name:string){const value=name.trim();if(!value||value.length>100||hasAsciiControl(value))throw Error('材料清单名称需要 1–100 个字符');return value;}
function queryValue(query:SavedSearchQuery){if(!validQuery(query))throw Error('材料清单筛选无效，关键词最多 2,000 字符');return {...query};}
export function savedSearchStamp(value:SavedSearch){return JSON.stringify(value);}
function current(board:Board,id:string,expected?:string){const item=board.savedSearches?.find(s=>s.id===id);if(!item)throw Error('材料清单已移除，请刷新后重试');if(expected!==undefined&&savedSearchStamp(item)!==expected)throw Error('材料清单已变化，请刷新后重试');return item;}
export function savedSearchQuery(board:Board,id:string,expected?:string){return queryValue(current(board,id,expected).query);}
export function addSavedSearch(board:Board,id:string,name:string,query:SavedSearchQuery){const value=nameValue(name),criteria=queryValue(query);if(!id.trim()||id.length>200||board.savedSearches?.some(s=>s.id===id))throw Error('材料清单标识冲突，请重试');if((board.savedSearches?.length||0)>=50)throw Error('最多保存 50 个材料清单，请先移除旧清单');board.version=3;(board.savedSearches||=[]).push({id,name:value,query:criteria});}
export function renameSavedSearch(board:Board,id:string,name:string,expected?:string){const value=nameValue(name);current(board,id,expected).name=value;}
export function removeSavedSearch(board:Board,id:string,expected?:string){current(board,id,expected);board.savedSearches=board.savedSearches!.filter(s=>s.id!==id);}
