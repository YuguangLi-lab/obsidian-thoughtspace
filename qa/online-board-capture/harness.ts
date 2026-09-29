import {mountOnlineBoardPlayer} from '../../src/online-board-player';
import {renderWebCard,webCard} from '../../src/web-card';
import {parseOnlineSource,type OnlineState} from '../../src/online-platform';

declare global {interface Window {fixture:any}}
const prototype=HTMLElement.prototype as any;
prototype.createEl=function(tag:string,options:any={}){const el=document.createElement(tag);if(typeof options==='string')el.className=options;else{if(options.cls)el.className=options.cls;if(options.text)el.textContent=options.text;for(const [key,value]of Object.entries(options.attr||{}))el.setAttribute(key,String(value));}this.appendChild(el);return el;};
prototype.createDiv=function(options:any){return this.createEl('div',options);};
prototype.createSpan=function(options:any){return this.createEl('span',options);};
prototype.addClass=function(...values:string[]){this.classList.add(...values);};
prototype.removeClass=function(...values:string[]){this.classList.remove(...values);};
prototype.setText=function(value:string){this.textContent=value;};
prototype.empty=function(){this.replaceChildren();};
if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`});
let sequence=0;
const fixture=window.fixture={loads:0,saves:[],failSave:false,failures:0,release:0,dispose:0};
const host=document.querySelector<HTMLElement>('#card')!;
const url='https://www.bilibili.com/video/BV1xx411c7mD/?p=1',source=parseOnlineSource(url)!;
let notify:(state:OnlineState)=>void;
const state:OnlineState={sourcePath:source.path,available:true,closed:false,time:41.25,duration:3600,paused:true,status:'synced'};
let surface:HTMLElement|undefined;
const playerOptions={alive:()=>true,onCapture:async(moment:any)=>{fixture.saves.push({id:moment.id,time:moment.time,image:!!moment.image});if(fixture.failSave){fixture.failures++;throw Error('模拟保存失败：磁盘暂时不可写，原始截图与时间戳保留，可重试保存。');}},createPlatform:(listener:typeof notify)=>{
 notify=listener;
 return {mount:(el:HTMLElement)=>{surface=el;return()=>{fixture.release++;};},open:()=>{
  fixture.loads++;let frame=surface!.querySelector<HTMLElement>('.test-video-frame');if(!frame){frame=document.createElement('div');frame.className='test-video-frame';frame.innerHTML='<strong>TEST VIDEO FIXTURE</strong><span>Engineering QA only</span><span>Not live Bilibili or YouTube media</span>';surface!.appendChild(frame);}notify({...state});return source;
 },command:async(_path:string,action:string,value?:number)=>{if(action==='pause')state.paused=true;if(action==='toggle')state.paused=!state.paused;if(action==='seek')state.time=value!;notify({...state});return true;},position:async()=>state.time,capture:async()=>({bytes:new Uint8Array([137,80,78,71,13,10,26,10]),time:state.time}),dispose:()=>{fixture.dispose++;}};
}};
renderWebCard(host,webCard(url,'fixture-card',{x:320,y:230}),{open(){},edit(){},fold(){},copy(){},disabled:false,register(){},online:{open(){},mount:(el)=>{const player=mountOnlineBoardPlayer(el,url,playerOptions);fixture.player=player;return()=>player.dispose();}}});
