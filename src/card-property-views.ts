import {propertyKeys,readProperties,statuses} from './database';
import {libraryCardType,libraryTypeNames,type LibraryCardType} from './card-library-model';

export interface LibrarySourceNote {path:string;title:string;tags:string[];properties:Record<string,unknown>}
export interface LibraryBoardSource {path:string;title:string;files:string[]}
export interface LibraryBoardRef {path:string;title:string}
export interface LibraryCardRecord {
 path:string;title:string;type:LibraryCardType;tags:string[];
 status:string;priority:string;due:string;
 custom:Record<string,string>;boards:LibraryBoardRef[];
}
export type LibraryLayout='table'|'kanban'|'list';
export interface LibraryViewQuery {type:''|LibraryCardType;tag:string;board:string;status:string;query:string;view:LibraryLayout}
export const emptyLibraryQuery=():LibraryViewQuery=>({type:'',tag:'',board:'',status:'',query:'',view:'list'});
const hiddenKeys=new Set(['position','tags','aliases','cssclasses','tag',...Object.values(propertyKeys)]);
export function libraryTagKey(tag:string){return tag.trim().replace(/^#/,'').toLocaleLowerCase();}
function displayValue(value:unknown):string{
 if(typeof value==='string')return value;
 if(typeof value==='number'||typeof value==='boolean')return String(value);
 if(Array.isArray(value))return value.map(displayValue).filter(Boolean).join('、');
 return '';
}
function customProperties(properties:Record<string,unknown>):Record<string,string>{
 const custom:Record<string,string>={};
 for(const [key,value] of Object.entries(properties)){
  if(hiddenKeys.has(key)||key.startsWith('__'))continue;
  const text=displayValue(value);
  if(text)custom[key]=text;
 }
 return custom;
}
export function libraryRecord(note:LibrarySourceNote):LibraryCardRecord{
 const props=readProperties(note.properties);
 return {path:note.path,title:note.title,type:libraryCardType(note.path),tags:[...note.tags],status:props.status||'inbox',priority:props.priority,due:props.due,custom:customProperties(note.properties),boards:[]};
}
/** Notes are the card library. Board entries only record where each file is referenced. */
export function buildLibraryRecords(notes:readonly LibrarySourceNote[],boards:readonly LibraryBoardSource[]):LibraryCardRecord[]{
 const byPath=new Map<string,LibraryCardRecord>();
 for(const note of notes){if(!note.path||byPath.has(note.path))continue;byPath.set(note.path,libraryRecord(note));}
 for(const board of boards){
  for(const file of board.files){
   let record=byPath.get(file);
   if(!record){record={path:file,title:file.split('/').pop()?.replace(/\.[^.]+$/,'')||file,type:libraryCardType(file),tags:[],status:'inbox',priority:'',due:'',custom:{},boards:[]};byPath.set(file,record);}
   if(!record.boards.some(item=>item.path===board.path))record.boards.push({path:board.path,title:board.title||board.path});
  }
 }
 for(const record of byPath.values())record.boards.sort((a,b)=>a.title.localeCompare(b.title)||a.path.localeCompare(b.path));
 return [...byPath.values()].sort((a,b)=>a.title.localeCompare(b.title)||a.path.localeCompare(b.path));
}
export function mergeBoardSources(scanned:readonly LibraryBoardSource[],live:readonly LibraryBoardSource[]):LibraryBoardSource[]{
 const byPath=new Map(scanned.map(board=>[board.path,board]));
 for(const board of live)byPath.set(board.path,{...board,files:[...board.files]});
 return [...byPath.values()];
}
export function filterLibraryCards(records:readonly LibraryCardRecord[],query:LibraryViewQuery):LibraryCardRecord[]{
 const tag=libraryTagKey(query.tag),text=query.query.trim().toLocaleLowerCase();
 return records.filter(record=>{
  if(query.type&&record.type!==query.type)return false;
  if(query.status&&record.status!==query.status)return false;
  if(query.board&&!record.boards.some(board=>board.path===query.board))return false;
  if(tag&&!record.tags.some(item=>libraryTagKey(item)===tag||libraryTagKey(item).startsWith(tag+'/')))return false;
  if(!text)return true;
  const haystack=[record.title,record.path,record.status,statuses[record.status]||'',record.priority,record.due,...record.tags,...record.boards.map(board=>`${board.title} ${board.path}`),...Object.entries(record.custom).flat()].join(' ').toLocaleLowerCase();
  return text.split(/\s+/).every(word=>haystack.includes(word));
 });
}
export function libraryStatusLabel(status:string){return statuses[status]||status||'未设置';}
export interface LibraryKanbanColumn {id:string;label:string;cards:LibraryCardRecord[]}
export function libraryKanban(records:readonly LibraryCardRecord[]):LibraryKanbanColumn[]{
 const known=['inbox','active','done'];
 const extra=[...new Set(records.map(record=>record.status).filter(status=>!known.includes(status)))].sort();
 return [...known,...extra].map(id=>({id,label:libraryStatusLabel(id),cards:records.filter(record=>record.status===id)}));
}
export interface LibraryTable {columns:string[];rows:{path:string;cells:string[]}[]}
export function libraryTable(records:readonly LibraryCardRecord[]):LibraryTable{
 const custom=[...new Set(records.flatMap(record=>Object.keys(record.custom)))].sort();
 const columns=['笔记','类型','标签','状态','白板',...custom];
 const rows=records.map(record=>({path:record.path,cells:[record.title,libraryTypeNames[record.type],record.tags.join(' '),libraryStatusLabel(record.status),record.boards.map(board=>board.title).join('、')||'未放置',...custom.map(key=>record.custom[key]||'')]}));
 return {columns,rows};
}
export function libraryList(records:readonly LibraryCardRecord[]):{path:string;title:string;detail:string}[]{
 return records.map(record=>({path:record.path,title:record.title,detail:[libraryTypeNames[record.type],libraryStatusLabel(record.status),record.tags.join(' '),record.boards.map(board=>board.title).join('、')||'未放置在白板'].filter(Boolean).join(' · ')}));
}
export function libraryTagChoices(records:readonly LibraryCardRecord[]):string[]{
 return [...new Set(records.flatMap(record=>record.tags.map(libraryTagKey)).filter(Boolean))].sort();
}
export function libraryBoardChoices(records:readonly LibraryCardRecord[]):LibraryBoardRef[]{
 const boards=new Map<string,LibraryBoardRef>();
 for(const record of records)for(const board of record.boards)if(!boards.has(board.path))boards.set(board.path,board);
 return [...boards.values()].sort((a,b)=>a.title.localeCompare(b.title)||a.path.localeCompare(b.path));
}
