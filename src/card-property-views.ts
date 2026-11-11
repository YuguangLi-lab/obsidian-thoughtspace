import {propertyKeys,readProperties,statuses} from './database';
import {choiceKey,choiceValue,type ChoiceField} from './choice-field';
import {highlightLocation,parseHighlight,type HighlightAnchor} from './highlight-note';
import {libraryCardType,libraryTypeNames,type LibraryCardType} from './card-library-model';

export interface LibrarySourceNote {path:string;title:string;tags:string[];properties:Record<string,unknown>}
export interface LibraryBoardSource {path:string;title:string;files:string[];placements?:readonly {id:string;file:string}[]}
export interface LibraryBoardRef {path:string;title:string}
export interface LibraryPlacement {boardPath:string;boardTitle:string;nodeId:string}
export interface LibraryCardRecord {
 path:string;title:string;type:LibraryCardType;tags:string[];
 status:string;priority:string;due:string;choice:string;
 custom:Record<string,string>;boards:LibraryBoardRef[];placements:LibraryPlacement[];
 highlight?:HighlightAnchor;
 /** The eager index did not read every board, so an empty placement list is not proof the card is unplaced. */
 indexIncomplete?:true;
}
export type LibraryLayout='table'|'kanban'|'list';
export interface LibraryViewQuery {type:''|LibraryCardType;tag:string;board:string;status:string;choice:string;query:string;view:LibraryLayout;selected:readonly string[]}
export const emptyLibraryQuery=():LibraryViewQuery=>({type:'',tag:'',board:'',status:'',choice:'',query:'',view:'list',selected:[]});
/** Longer than a saved option, so this filter cannot collide with a real thoughtspace_choice value. */
export const uncategorizedChoice='thoughtspace-library-filter:only-uncategorized';
const hiddenKeys=new Set(['position','tags','aliases','cssclasses','tag',choiceKey,...Object.values(propertyKeys)]);
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
export function libraryRecord(note:LibrarySourceNote,field:ChoiceField={options:[]}):LibraryCardRecord{
 const props=readProperties(note.properties),highlight=parseHighlight(note.properties);
 return {path:note.path,title:note.title,type:libraryCardType(note.path),tags:[...note.tags],status:props.status||'inbox',priority:props.priority,due:props.due,choice:field.options.length?choiceValue(note.properties,field):'',custom:customProperties(note.properties),boards:[],placements:[],...(highlight?{highlight}:{})};
}
/** Notes are the card library. Board entries only record where each file is referenced. */
export function buildLibraryRecords(notes:readonly LibrarySourceNote[],boards:readonly LibraryBoardSource[],field:ChoiceField={options:[]},indexIncomplete=false):LibraryCardRecord[]{
 const byPath=new Map<string,LibraryCardRecord>();
 const ensure=(file:string)=>{let record=byPath.get(file);if(!record){record={path:file,title:file.split('/').pop()?.replace(/\.[^.]+$/,'')||file,type:libraryCardType(file),tags:[],status:'inbox',priority:'',due:'',choice:'',custom:{},boards:[],placements:[],...(indexIncomplete?{indexIncomplete:true as const}:{})};byPath.set(file,record);}return record;};
 for(const note of notes){if(!note.path||byPath.has(note.path))continue;const record=libraryRecord(note,field);if(indexIncomplete)record.indexIncomplete=true;byPath.set(note.path,record);}
 for(const board of boards){
  for(const file of board.files){
   const record=ensure(file);
   if(!record.boards.some(item=>item.path===board.path))record.boards.push({path:board.path,title:board.title||board.path});
  }
  for(const place of board.placements||[]){
   if(!place.id||!place.file)continue;
   const record=ensure(place.file);
   if(!record.boards.some(item=>item.path===board.path))record.boards.push({path:board.path,title:board.title||board.path});
   if(!record.placements.some(item=>item.boardPath===board.path&&item.nodeId===place.id))record.placements.push({boardPath:board.path,boardTitle:board.title||board.path,nodeId:place.id});
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
function librarySearchText(record:LibraryCardRecord):string{
 return [record.title,record.path,record.status,statuses[record.status]||'',record.priority,record.due,record.choice,...record.tags,...record.boards.map(board=>`${board.title} ${board.path}`),...Object.entries(record.custom).flat()].join(' ').toLocaleLowerCase();
}
function filterWithSearchText(records:readonly LibraryCardRecord[],query:LibraryViewQuery,searchText:(record:LibraryCardRecord)=>string):LibraryCardRecord[]{
 const tag=libraryTagKey(query.tag),words=query.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(record=>{
  if(query.type&&record.type!==query.type)return false;
  if(query.status&&record.status!==query.status)return false;
  if(query.choice===uncategorizedChoice){if(record.choice)return false;}
  else if(query.choice&&record.choice!==query.choice)return false;
  if(query.board&&!record.boards.some(board=>board.path===query.board))return false;
  if(tag&&!record.tags.some(item=>libraryTagKey(item)===tag||libraryTagKey(item).startsWith(tag+'/')))return false;
  if(!words.length)return true;
  const haystack=searchText(record);
  return words.every(word=>haystack.includes(word));
 });
}
export function filterLibraryCards(records:readonly LibraryCardRecord[],query:LibraryViewQuery):LibraryCardRecord[]{
 return filterWithSearchText(records,query,librarySearchText);
}
/** A mounted library owns this filter for one immutable records snapshot. */
export function createLibraryCardFilter(records:readonly LibraryCardRecord[]){
 const haystacks=new WeakMap<LibraryCardRecord,string>();
 // Custom properties may be large. Bound retained search text, not search results.
 let remainingCharacters=2_000_000;
 const searchText=(record:LibraryCardRecord)=>{
  const cached=haystacks.get(record);
  if(cached!==undefined)return cached;
  const text=librarySearchText(record);
  if(text.length<=remainingCharacters){haystacks.set(record,text);remainingCharacters-=text.length;}
  return text;
 };
 let lastKey:string|undefined,lastMatches:readonly LibraryCardRecord[]=[];
 return (query:LibraryViewQuery)=>{
  // Layout and selection do not affect which cards match.
  const key=JSON.stringify([query.type,query.tag,query.board,query.status,query.choice,query.query]);
  if(key!==lastKey){lastMatches=filterWithSearchText(records,query,searchText);lastKey=key;}
  return lastMatches;
 };
}
export function libraryStatusLabel(status:string){return statuses[status]||status||'未设置';}
export interface LibraryKanbanColumn {id:string;label:string;cards:LibraryCardRecord[]}
export function libraryKanban(records:readonly LibraryCardRecord[]):LibraryKanbanColumn[]{
 const known=['inbox','active','done'];
 const extra=[...new Set(records.map(record=>record.status).filter(status=>!known.includes(status)))].sort();
 return [...known,...extra].map(id=>({id,label:libraryStatusLabel(id),cards:records.filter(record=>record.status===id)}));
}
export interface LibraryTable {columns:string[];rows:{path:string;cells:string[]}[]}
export function libraryTable(records:readonly LibraryCardRecord[],showChoice=false,indexing=false):LibraryTable{
 const custom=[...new Set(records.flatMap(record=>Object.keys(record.custom)))].sort(),choices=showChoice||records.some(record=>record.choice),hasSource=records.some(record=>record.highlight);
 const columns=['笔记','类型','标签','状态',...(choices?['分类']:[]),...(hasSource?['来源']:[]),'白板',...custom];
 const rows=records.map(record=>({path:record.path,cells:[record.title,libraryTypeNames[record.type],record.tags.join(' '),libraryStatusLabel(record.status),...(choices?[record.choice||'未分类']:[]),...(hasSource?[record.highlight?highlightLocation(record.highlight):'']:[]),indexing&&!record.boards.length?'正在索引':libraryBoardLabel(record,false),...custom.map(key=>record.custom[key]||'')]}));
 return {columns,rows};
}
export function libraryList(records:readonly LibraryCardRecord[]):{path:string;title:string;detail:string}[]{
 return records.map(record=>({path:record.path,title:record.title,detail:[libraryTypeNames[record.type],libraryStatusLabel(record.status),record.highlight?highlightLocation(record.highlight):'',record.tags.join(' '),libraryBoardLabel(record,true)].filter(Boolean).join(' · ')}));
}
function libraryBoardLabel(record:LibraryCardRecord,list:boolean):string{
 const names=record.boards.map(board=>board.title).join('、');
 if(!names)return record.indexIncomplete?'引用位置未索引完':list?'未放置在白板':'未放置';
 return record.indexIncomplete?`${names} · 其余白板未索引`:names;
}
export function libraryTagChoices(records:readonly LibraryCardRecord[]):string[]{
 return [...new Set(records.flatMap(record=>record.tags.map(libraryTagKey)).filter(Boolean))].sort();
}
export function libraryBoardChoices(records:readonly LibraryCardRecord[]):LibraryBoardRef[]{
 const boards=new Map<string,LibraryBoardRef>();
 for(const record of records)for(const board of record.boards)if(!boards.has(board.path))boards.set(board.path,board);
 return [...boards.values()].sort((a,b)=>a.title.localeCompare(b.title)||a.path.localeCompare(b.path));
}
