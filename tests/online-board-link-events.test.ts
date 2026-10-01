import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {parseOnlineSource} from '../src/online-platform';
import {onlinePlayerUrl,parseOnlinePlayerUrl} from '../src/online-media-notes';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('    const openOnlineBoardLink='),end=source.indexOf('    const openStageLink=',start);
assert.ok(start>=0&&end>start);
const compiled=transformSync(source.slice(start,end),{loader:'ts'}).code;
const bili='https://www.bilibili.com/video/BV1p5Yg6JEzR/';
type Options={href?:string;video?:string;vault?:string;boundary?:string;modifier?:boolean;button?:number;prevented?:boolean;excerpt?:string;missingLink?:boolean};
function fixture(options:Options={}){
 const calls={routes:[] as unknown[][],native:0,bubble:0,prevent:0,stop:0},registrations:{target:unknown;type:string;listener:(event:unknown)=>void;capture:boolean}[]=[],stage={};
 const link={getAttribute:(name:string)=>name==='href'?options.href??onlinePlayerUrl('Vault',bili,12.875):null,
  closest:(selector:string)=>selector==='[data-id]'?options.excerpt===undefined?null:{getAttribute:()=>options.excerpt}:options.boundary&&selector.includes(options.boundary)?{}:null};
 const event={button:options.button??0,defaultPrevented:!!options.prevented,stopped:false,
  target:{closest:(selector:string)=>selector==='a'&&!options.missingLink?link:null},
  preventDefault(){this.defaultPrevented=true;calls.prevent++;},stopPropagation(){this.stopped=true;calls.stop++;}};
 const view={stage,session:{board:{nodes:[{id:'video',webUrl:options.video??bili}]}},app:{vault:{getName:()=>options.vault??'Vault'}},
  plugin:{openBoardMediaTimestamp:(href:string,_view:unknown,excerpt?:string)=>{const parsed=parseOnlinePlayerUrl(href)!;calls.routes.push([parsed.source,parsed.time,excerpt]);}},
  registerDomEvent(target:unknown,type:string,listener:(event:unknown)=>void,settings?:{capture?:boolean}){registrations.push({target,type,listener,capture:!!settings?.capture});}};
 new Function('Keymap','parseOnlinePlayerUrl','parseOnlineSource','act',compiled).call(view,{isModEvent:()=>!!options.modifier},parseOnlinePlayerUrl,parseOnlineSource,(run:()=>unknown)=>run());
 // Dispatch in DOM order: the production registration determines whether it
 // precedes a native Markdown target handler that consumes protocol links.
 const dispatch=()=>{
  for(const registration of registrations)if(registration.capture)registration.listener(event);
  if(event.stopped)return;
  calls.native++;event.defaultPrevented=true;
  for(const registration of registrations)if(!registration.capture)registration.listener(event);
  if(!event.stopped)calls.bubble++;
 };
 return{calls,event,registrations,stage,dispatch};
}
test('online board links intercept in capture phase before native protocol handlers and preserve excerpt identity',()=>{
 const f=fixture({excerpt:'online-capture-42'});f.dispatch();
 assert.equal(f.registrations.length,1);assert.equal(f.registrations[0].target,f.stage);assert.equal(f.registrations[0].type,'click');assert.equal(f.registrations[0].capture,true);
 assert.deepEqual(f.calls.routes,[[bili,12.875,'online-capture-42']]);assert.equal(f.calls.native,0);assert.equal(f.calls.bubble,0);assert.equal(f.calls.prevent,1);assert.equal(f.calls.stop,1);
});
test('canonical Bilibili parts and YouTube aliases route only to their matching board video',()=>{
 for(const [video,canonical]of [[bili+'?p=2&t=90&spm_id_from=share',bili+'?p=2'],['https://youtu.be/M7lc1UVf-VE?t=90','https://www.youtube.com/watch?v=M7lc1UVf-VE']]){
  const f=fixture({video,href:onlinePlayerUrl('Vault',canonical,4.125)});f.dispatch();assert.deepEqual(f.calls.routes,[[canonical,4.125,undefined]]);assert.equal(f.calls.native,0);
 }
 for(const video of [bili,bili+'?p=3']){const f=fixture({video,href:onlinePlayerUrl('Vault',bili+'?p=2',4)});f.dispatch();assert.deepEqual(f.calls.routes,[[bili+'?p=2',4,undefined]]);assert.equal(f.calls.native,0);}
});
test('different vaults, missing source cards, malformed links and non-link clicks retain native handling',()=>{
 for(const options of [{vault:'Other Vault'},{href:'obsidian://thoughtspace-online-player?source=bad'},{href:'https://example.com/'},{missingLink:true}]){
  const f=fixture(options);f.dispatch();assert.deepEqual(f.calls.routes,[]);assert.equal(f.calls.prevent,0);assert.equal(f.calls.stop,0);assert.equal(f.calls.native,1);
 }
});
test('modifier, nonprimary and already-prevented clicks cannot issue a board seek',()=>{
 for(const options of [{modifier:true},{button:1},{button:2},{prevented:true}]){
  const f=fixture(options);f.dispatch();assert.deepEqual(f.calls.routes,[]);assert.equal(f.calls.prevent,0);assert.equal(f.calls.stop,0);
 }
});
for(const boundary of ['.ts-inline-editor','.cm-editor','.is-editing-title'])test(`online links inside ${boundary} remain owned by the native editor or embed`,()=>{
 const f=fixture({boundary});f.dispatch();assert.deepEqual(f.calls.routes,[]);assert.equal(f.calls.native,1);assert.equal(f.calls.prevent,0);assert.equal(f.calls.stop,0);
});

for(const boundary of ['.markdown-embed','.internal-embed'])test(`online timestamp in ${boundary} shares the board router`,()=>{const f=fixture({boundary});f.dispatch();assert.equal(f.calls.routes.length,1);assert.equal(f.calls.native,0);});
