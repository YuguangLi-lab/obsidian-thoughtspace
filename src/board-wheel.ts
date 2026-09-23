import {wheelDelta,type BoardPreferences} from './board-experience';

export type BoardWheelEvent=Pick<WheelEvent,'deltaX'|'deltaY'|'deltaMode'|'ctrlKey'|'metaKey'|'shiftKey'>;
export type BoardWheelIntent={kind:'pan';dx:number;dy:number}|{kind:'zoom';factor:number;atPointer:boolean};
const speed=(value:unknown,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(.3,Math.min(max,value)):1;
const dimension=(value:number)=>Number.isFinite(value)&&value>0?value:100;
const delta=(value:number,mode:number,page:number)=>wheelDelta(Number.isFinite(value)?value:0,mode,dimension(page));

/** Pan deltas use scroll direction: the caller subtracts them from the viewport.
 * Ctrl/Meta (including trackpad pinch) always zoom. Page units use each axis's
 * viewport size; normalization and bounded speeds keep all output finite.
 */
export function boardWheelIntent(event:BoardWheelEvent,settings:Partial<BoardPreferences>,width:number,height:number):BoardWheelIntent{
 const dx=delta(event.deltaX,event.deltaMode,width),dy=delta(event.deltaY,event.deltaMode,height);
 if(settings.wheelMode==='pan'&&!event.ctrlKey&&!event.metaKey){
  const scale=speed(settings.panSpeed,3)*(settings.reverseWheelPan===true?-1:1);
  const scaled=(value:number)=>value===0?0:value*scale;
  return{kind:'pan',dx:scaled(event.shiftKey?dy:dx),dy:event.shiftKey?0:scaled(dy)};
 }
 const exponent=-dy*.002*speed(settings.zoomSpeed,2)*(settings.reverseWheelZoom===true?-1:1);
 // The final bound also protects zoom if input normalization changes later.
 return{kind:'zoom',factor:Math.exp(Math.max(-4,Math.min(4,exponent))),atPointer:settings.zoomAnchor!=='center'};
}
