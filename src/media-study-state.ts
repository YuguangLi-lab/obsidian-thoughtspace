import {isRecord,hasAsciiControl} from './value-guards';

export type MediaStudyMode='notes'|'board';
export interface MediaStudyState {enabled:boolean;mode:MediaStudyMode;id:string;title?:string;board?:string;noteLeaf?:string;boardLeaf?:string;ratio:number}
export interface MediaStudyReference {id:string;note:string;board?:string}
export interface MediaImportSelection {title:string;board?:string}
export const newMediaStudy=():MediaStudyState=>({enabled:false,mode:'notes',id:'',ratio:60});
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&!hasAsciiControl(v)&&!v.includes('\u007f')?v:undefined;
export function cleanMediaStudy(value:unknown):MediaStudyState{
 const clean=newMediaStudy();if(!isRecord(value))return clean;
 clean.enabled=value.enabled===true;clean.mode=value.mode==='board'?'board':'notes';clean.id=text(value.id,100)||'';
 if(clean.enabled&&!clean.id)clean.id=crypto.randomUUID();
 for(const key of ['title','board','noteLeaf','boardLeaf'] as const){const v=text(value[key],key==='title'?160:1000);if(v)clean[key]=v;}
 if(typeof value.ratio==='number'&&Number.isFinite(value.ratio))clean.ratio=Math.max(38,Math.min(70,value.ratio));return clean;
}
/** A ticket belongs to one explicit pause/record action, never a restored draft. */
export interface MediaResumeTicket {source:string;draft:string;generation:number;time:number}
export function canResumeMedia(ticket:MediaResumeTicket|undefined,current:{source:string;draft:string;generation:number;time:number;active:boolean;paused:boolean}){
 return !!ticket&&current.active&&current.paused&&ticket.source===current.source&&ticket.draft===current.draft&&ticket.generation===current.generation&&Number.isFinite(current.time)&&Math.abs(ticket.time-current.time)<.5;
}
export function mediaRecordKey(event:Pick<KeyboardEvent,'key'|'repeat'|'isComposing'|'altKey'|'ctrlKey'|'metaKey'|'shiftKey'|'defaultPrevented'>&{keyCode?:number},editable:boolean){
 return !event.defaultPrevented&&!event.repeat&&!event.isComposing&&event.keyCode!==229&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!editable&&event.key.toLowerCase()==='m';
}
