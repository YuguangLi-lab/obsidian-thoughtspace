import {localRelationKinds,type LocalRelationKind} from './local-relations';
import {hasAsciiControl,isRecord} from './value-guards';

export const LOCAL_RELATIONS_STATE_VERSION=1;
export const HISTORY_LIMIT=80;
export const PINS_LIMIT=6;
export const RECENT_LIMIT=40;
export const RECENT_VISIBLE_LIMIT=14;
export const LENSES_LIMIT=8;
export const SAVED_BOARDS_LIMIT=30;
export type LocalRelationsFollow='board'|'note'|'locked';
export type LocalRelationsQueryField='all'|'name'|'tag'|'type'|'title'|'path'|'id'|'label';
export interface LocalRelationsFilter {
 query:string;queryField:LocalRelationsQueryField;kindFilter:'all'|'card'|'board'|'section';tag:string;kindFilters:LocalRelationKind[];
}
export interface LocalRelationsLens extends LocalRelationsFilter {name:string;}
export interface LocalRelationsSavedState extends LocalRelationsFilter {
 version:1;center?:string;history:{entries:string[];index:number};pins:string[];recent:string[];follow:LocalRelationsFollow;
 settings:{density:'compact'|'comfortable';showPaths:boolean};lenses:LocalRelationsLens[];
}
export interface LocalRelationsWorkspaceState extends Record<string,unknown> {version:1;boardPath?:string;originLeafId?:string;state:LocalRelationsSavedState;}
export type LocalRelationsPreferences=Record<string,LocalRelationsSavedState>;

const queryFields:readonly LocalRelationsQueryField[]=['all','name','tag','type','title','path','id','label'];
const hasControl=(value:string)=>hasAsciiControl(value)||value.includes(String.fromCharCode(127));
const identifier=(raw:unknown):string|undefined=>typeof raw==='string'&&raw.length>0&&raw.length<=256&&raw.trim()===raw&&!hasControl(raw)?raw:undefined;
function text(raw:unknown,limit:number):string {
 if(typeof raw!=='string')return'';let clean='';
 for(let i=0;i<Math.min(raw.length,limit*2)&&clean.length<limit;i++){const code=raw.charCodeAt(i);if(code!==127&&(code>=32||code===9||code===10||code===13))clean+=raw[i];}return clean;
}
function path(raw:unknown,board=false):string|undefined {
 if(typeof raw!=='string'||!raw||raw.length>1024||raw.trim()!==raw||hasControl(raw)||raw.startsWith('/')||raw.includes('\\')||raw.includes(':'))return;
 if(raw.split('/').some(part=>!part||part==='.'||part==='..')||board&&!raw.endsWith('.thoughtspace'))return;
 return raw;
}
export function localRelationsBoardPath(raw:unknown):string|undefined {return path(raw,true);}
function ids(raw:unknown,limit:number):string[] {
 if(!Array.isArray(raw))return[];const seen=new Set<string>(),out:string[]=[];
 for(const item of raw.slice(0,limit*8)){const id=identifier(item);if(!id||seen.has(id))continue;seen.add(id);out.push(id);if(out.length===limit)break;}
 return out;
}
function filter(raw:Record<string,unknown>):LocalRelationsFilter {
 const wanted=raw.kindFilters,kinds=Array.isArray(wanted)?localRelationKinds.filter(kind=>wanted.slice(0,48).includes(kind)):[...localRelationKinds];
 return{query:text(raw.query,1000),queryField:queryFields.includes(raw.queryField as LocalRelationsQueryField)?raw.queryField as LocalRelationsQueryField:'all',kindFilter:raw.kindFilter==='card'||raw.kindFilter==='board'||raw.kindFilter==='section'?raw.kindFilter:'all',tag:text(raw.tag,200).trim(),kindFilters:kinds};
}
function history(raw:unknown):LocalRelationsSavedState['history'] {
 if(!isRecord(raw)||!Array.isArray(raw.entries))return{entries:[],index:-1};
 const cursor=typeof raw.index==='number'&&Number.isInteger(raw.index)?Math.min(raw.entries.length-1,Math.max(-1,raw.index)):raw.entries.length-1;
 const entries:string[]=[];let index=-1;
 for(let at=Math.max(0,raw.entries.length-HISTORY_LIMIT*8);at<raw.entries.length;at++){const id=identifier(raw.entries[at]);if(!id)continue;if(entries.at(-1)!==id)entries.push(id);if(at<=cursor)index=entries.length-1;}
 if(entries.length>HISTORY_LIMIT){const removed=entries.length-HISTORY_LIMIT;entries.splice(0,removed);index-=removed;}
 return{entries,index:entries.length?Math.max(0,Math.min(entries.length-1,index)):-1};
}
export function cleanLocalRelationsState(raw:unknown):LocalRelationsSavedState {
 const saved=isRecord(raw)&&raw.version===LOCAL_RELATIONS_STATE_VERSION?raw:{},options=isRecord(saved.settings)?saved.settings:{},lenses:LocalRelationsLens[]=[],names=new Set<string>();
 if(Array.isArray(saved.lenses))for(const candidate of saved.lenses.slice(0,LENSES_LIMIT*8)){if(!isRecord(candidate))continue;const name=text(candidate.name,80).trim();if(!name||names.has(name))continue;names.add(name);lenses.push({...filter(candidate),name});if(lenses.length===LENSES_LIMIT)break;}
 return{version:1,...filter(saved),center:identifier(saved.center),history:history(saved.history),pins:ids(saved.pins,PINS_LIMIT),recent:ids(saved.recent,RECENT_LIMIT),follow:saved.follow==='note'||saved.follow==='locked'?saved.follow:'board',settings:{density:options.density==='comfortable'?'comfortable':'compact',showPaths:typeof options.showPaths==='boolean'?options.showPaths:true},lenses};
}
export function cleanLocalRelationsWorkspaceState(raw:unknown):LocalRelationsWorkspaceState {
 const saved=isRecord(raw)&&raw.version===LOCAL_RELATIONS_STATE_VERSION?raw:{},boardPath=localRelationsBoardPath(saved.boardPath);
 return{version:1,boardPath,originLeafId:boardPath?identifier(saved.originLeafId):undefined,state:cleanLocalRelationsState(boardPath?saved.state:undefined)};
}
export function cleanLocalRelationsPreferences(raw:unknown):LocalRelationsPreferences {
 if(!isRecord(raw))return{};const entries:[string,LocalRelationsSavedState][]=[];
 for(const [key,value]of Object.entries(raw).slice(-SAVED_BOARDS_LIMIT*4)){const boardPath=localRelationsBoardPath(key);if(!boardPath||!isRecord(value)||value.version!==LOCAL_RELATIONS_STATE_VERSION)continue;entries.push([boardPath,cleanLocalRelationsState(value)]);}
 return Object.fromEntries(entries.slice(-SAVED_BOARDS_LIMIT));
}
/** The most recently changed board is last. Live views keep their own history cursors. */
export function rememberLocalRelationsState(raw:unknown,boardPath:string,state:unknown):LocalRelationsPreferences {
 const saved=cleanLocalRelationsPreferences(raw);if(!localRelationsBoardPath(boardPath))return saved;
 delete saved[boardPath];saved[boardPath]=cleanLocalRelationsState(state);return cleanLocalRelationsPreferences(saved);
}
/** Rename a file/folder, or delete its exact path and descendants. Existing destinations win. */
export function remapLocalRelationsPreferences(raw:unknown,oldPath:string,newPath?:string):LocalRelationsPreferences {
 const saved=cleanLocalRelationsPreferences(raw),from=path(oldPath),to=newPath===undefined?undefined:path(newPath);if(!from||newPath!==undefined&&!to)return saved;
 const result:LocalRelationsPreferences={},moved:[string,LocalRelationsSavedState][]=[];
 for(const [key,state]of Object.entries(saved)){if(key!==from&&!key.startsWith(from+'/'))result[key]=state;else if(to){const target=to+key.slice(from.length);if(localRelationsBoardPath(target))moved.push([target,state]);}}
 for(const [key,state]of moved)if(!Object.hasOwn(result,key))result[key]=state;return cleanLocalRelationsPreferences(result);
}
/** MRU is separate from the browser-style history; newest IDs come first. */
export function rememberLocalRelation(recent:readonly string[],id:string):string[] {
 const next=identifier(id);return ids(next?[next,...recent]:recent,RECENT_LIMIT);
}
export function displayLocalRelationRecent(recent:readonly string[]):string[] {return ids(recent,RECENT_VISIBLE_LIMIT);}
