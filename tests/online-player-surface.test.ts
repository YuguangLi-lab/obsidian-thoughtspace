import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';

const bili='https://www.bilibili.com/video/BV1p5Yg6JEzR/',youtube='https://www.youtube.com/watch?v=M7lc1UVf-VE';
const compiled=transformSync(readFileSync('src/online-player-surface.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
const script=runInNewContext(compiled+'\nmodule.exports.onlinePlayerSurface.toString()',{module:{exports:{}}}) as string;
class Element{
 attributes=new Map<string,string>();classes=new Set<string>();classList={contains:(name:string)=>this.classes.has(name)};isConnected=true;parentElement:Element|null=null;
 style={display:'block',visibility:'visible',opacity:'1'};box={left:16,top:40,width:668,height:422};focusedBox?:typeof this.box;textContent='';children:Element[]=[];video?:Element;button?:Element;content?:Element;container?:Element;clicks=0;clickAction?:()=>void;
 get offsetWidth(){return this.box.width;}get offsetHeight(){return this.box.height;}
 getBoundingClientRect(){return this.attributes.has('data-thoughtspace-player')&&this.focusedBox?this.focusedBox:this.box;}getAttribute(key:string){return this.attributes.get(key)??null;}setAttribute(key:string,value:string){this.attributes.set(key,value);}removeAttribute(key:string){this.attributes.delete(key);}
 appendChild(element:Element){this.children.push(element);element.parentElement=this;return element;}
 remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(item=>item!==this);}
 querySelector(selector:string){return selector==='video'?this.video??null:selector==='.bpx-player-ctrl-web'?this.button??null:selector==='.bili-mini-content-wp'?this.content??null:selector==='.bpx-player-container'?this.container??null:null;}
 click(){this.clicks++;this.clickAction?.();}
}
function fixture(provider='bilibili'){
 const root=new Element(),body=new Element(),head=new Element(),ancestor=new Element(),player=new Element(),video=new Element(),button=new Element();root.appendChild(body);body.appendChild(ancestor);ancestor.appendChild(player);player.video=video;player.button=button;
 player.focusedBox={left:0,top:0,width:526,height:296};
 video.box={left:0,top:0,width:526,height:296};
 const env={target:player as Element|undefined,overlays:[] as Element[],created:[] as Element[],resizes:0};
 button.clickAction=()=>{if(player.classes.has('mode-webscreen')){player.classes.delete('mode-webscreen');player.box={left:16,top:40,width:668,height:422};}else{player.classes.add('mode-webscreen');player.box={left:0,top:0,width:526,height:296};}};
 const observers:Observer[]=[],timers=new Map<number,{fn:()=>void;delay:number}>(),events=new Map<string,Set<()=>void>>();let nextTimer=0;
 class Observer{disconnected=false;options?:{attributeFilter:string[]};constructor(readonly callback:()=>void){observers.push(this);}observe(_target:unknown,options:{attributeFilter:string[]}){this.options=options;}disconnect(){this.disconnected=true;}}
 class Sheet{textContent='';replaceSync(css:string){this.textContent=css;}}
 const globals={URL,Event,CSSStyleSheet:Sheet,location:{href:provider==='bilibili'?bili:youtube},innerWidth:526,innerHeight:296,getComputedStyle:(element:Element)=>element.style,
  window:{frameElement:null as Element|null,setTimeout:(fn:()=>void,delay:number)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:(id:number)=>timers.delete(id),
   addEventListener:(event:string,handler:()=>void)=>{if(!events.has(event))events.set(event,new Set());events.get(event)!.add(handler);},removeEventListener:(event:string,handler:()=>void)=>events.get(event)?.delete(handler),dispatchEvent:(event:Event)=>{if(event.type==='resize')env.resizes++;for(const fn of events.get(event.type)??[])fn();}},
  document:{adoptedStyleSheets:[] as Sheet[],documentElement:root,body,head,querySelector:()=>env.target??null,querySelectorAll:()=>env.overlays},MutationObserver:Observer};
 const run=(action='install',source=provider==='bilibili'?bili:youtube)=>runInNewContext(`(${script})(...${JSON.stringify([provider,source,action])})`,globals) as {applied:boolean;ready?:boolean;reason?:string};
 const flush=(delay=150)=>{for(const[id,timer]of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}};
 const mutate=(attribute?:string)=>{for(const observer of observers)if(!observer.disconnected&&(!attribute||observer.options?.attributeFilter.includes(attribute)))observer.callback();};
 return{run,flush,mutate,globals,player,ancestor,button,env,head,root,observers,timers,events};
}
test('serialized Bilibili surface requests official webscreen once and keeps the original video and controls',()=>{
 const f=fixture(),video=f.player.video;assert.equal(f.run().applied,true);assert.equal(f.button.clicks,1);assert.equal(f.player.video,video);assert.equal(f.player.button,f.button);assert.equal(f.env.created.length,0);
 for(let i=0;i<100;i++)f.mutate();assert.equal(f.timers.size,1,'mutation bursts schedule only one bounded callback');f.flush();assert.equal(f.button.clicks,1);f.run();assert.equal(f.observers.length,1);f.run('dispose');assert.equal(f.button.clicks,2);assert.equal(f.timers.size,0);assert.equal(f.observers[0].disconnected,true);
});
test('Bilibili already in official webscreen or filling the viewport is never toggled off',()=>{
 for(const mode of ['class','geometry']){const f=fixture();if(mode==='class')f.player.classes.add('mode-webscreen');else f.player.box={left:0,top:0,width:526,height:296};f.run();f.mutate();f.flush();f.run('dispose');assert.equal(f.button.clicks,0);}
});
test('native Bilibili mini mode is recovered even when the outer wrapper already fills the viewport',()=>{
 const f=fixture(),container=new Element(),controls=new Element(),ad=new Element();f.player.container=container;container.children=[controls,ad];container.setAttribute('data-screen','mini');container.box={left:122,top:67,width:320,height:180};f.player.box={left:0,top:0,width:526,height:296};
 f.button.clickAction=()=>{container.setAttribute('data-screen','web');container.box={left:0,top:0,width:526,height:296};};
 assert.equal(f.run().ready,true);assert.equal(f.button.clicks,1);assert.equal(container.getAttribute('data-screen'),'web');assert.deepEqual(container.children,[controls,ad]);
 const css=f.globals.document.adoptedStyleSheets[0].textContent;
 assert.match(css,/\[data-thoughtspace-player\] \.bpx-player-container\{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important/);
 assert.match(css,/#mirror-vdcon > \.fixed-sidenav-storage/);assert.doesNotMatch(css,/bpx-player-control|bpx-player-mini|bpx-player-dialog|ad-showing/);
 f.mutate('data-screen');f.flush();assert.equal(f.button.clicks,1,'the successful official switch must not be toggled back');
});
test('a later Bilibili mini transition receives one bounded official recovery after the initial webscreen request',()=>{
 const f=fixture(),container=new Element();f.player.container=container;container.setAttribute('data-screen','normal');
 f.button.clickAction=()=>{container.setAttribute('data-screen','web');container.box={left:0,top:0,width:526,height:296};};f.run();assert.equal(f.button.clicks,1);
 container.setAttribute('data-screen','mini');f.mutate('data-screen');f.flush();assert.equal(f.button.clicks,2);assert.equal(container.getAttribute('data-screen'),'web');
 container.setAttribute('data-screen','mini');f.button.clickAction=()=>undefined;for(let i=0;i<20;i++){f.mutate('data-screen');f.flush();}assert.equal(f.button.clicks,2,'failed or repeated mini transitions must not create an endless toggle loop');
});
test('Bilibili ready requires its real internal container to fit and never toggles an official web or full mode off',()=>{
 for(const mode of ['mini','web','full']){
  const f=fixture(),container=new Element();f.player.container=container;container.setAttribute('data-screen',mode);container.box={left:122,top:67,width:320,height:180};f.button.clickAction=()=>undefined;
  assert.equal(f.run().ready,false);assert.equal(f.button.clicks,mode==='mini'?1:0);container.box={left:0,top:0,width:526,height:296};assert.equal(f.run().ready,true);
 }
});
test('YouTube focuses the whole player without deleting its video, controls or ad children',()=>{
 const f=fixture('youtube'),controls=new Element(),ad=new Element();f.player.children.push(controls,ad);const video=f.player.video;f.run();
 assert.equal(f.player.attributes.has('data-thoughtspace-player'),true);assert.equal(f.ancestor.attributes.has('data-thoughtspace-player-parent'),true);assert.deepEqual(f.player.children,[controls,ad]);assert.equal(f.player.video,video);
 assert.match(f.globals.document.adoptedStyleSheets[0].textContent,/100vw/);assert.doesNotMatch(f.globals.document.adoptedStyleSheets[0].textContent,/opacity|ytp-chrome|ad-showing/);assert.equal(f.env.resizes,1);
 f.run('dispose');assert.equal(f.globals.document.adoptedStyleSheets.length,0);assert.equal(f.player.attributes.size,0);assert.equal(f.ancestor.attributes.size,0);assert.equal(f.root.attributes.size,0);
});
test('YouTube gives the real video container a definite height and rejects zero-height video readiness',()=>{
 const f=fixture('youtube'),video=f.player.video!;video.box={left:1,top:0,width:526,height:0};assert.equal(f.run().ready,false);
 const css=f.globals.document.adoptedStyleSheets[0].textContent;
 assert.match(css,/\.html5-video-container\{position:absolute!important;inset:0!important;width:100%!important;height:100%!important/);
 assert.match(css,/\.html5-video-container video\{left:0!important;top:0!important/);
 video.box={left:0,top:0,width:526,height:296};assert.equal(f.run().ready,true);
});
test('visible consent dialogs stay above a continuously focused player without exposing the whole site',()=>{
 for(const provider of ['bilibili','youtube']){
  const f=fixture(provider);f.run();const modal=new Element();f.env.overlays.push(modal);f.mutate();f.flush();
  assert.equal(f.player.attributes.has('data-thoughtspace-player'),true);assert.equal(modal.attributes.get('data-thoughtspace-dialog'),'dialog');assert.equal(f.globals.document.adoptedStyleSheets.length,2);if(provider==='bilibili')assert.equal(f.button.clicks,1,'the modal must not exit webscreen or toggle playback');
  f.env.overlays=[];f.mutate();f.flush();assert.equal(f.globals.document.adoptedStyleSheets.length,1);assert.equal(f.player.attributes.has('data-thoughtspace-player'),true);
 }
});
test('login, foreign hosts, different videos, ambiguous parts and subframes receive no surface',()=>{
 for(const href of ['https://passport.bilibili.com/login','https://www.bilibili.com.attacker.test/video/BV1p5Yg6JEzR/',bili+'?p=2',bili+'?p=1&p=2']){const f=fixture();f.globals.location.href=href;assert.equal(f.run().applied,false);assert.equal(f.observers.length,0);assert.equal(f.button.clicks,0);}
 const f=fixture();f.globals.window.frameElement=new Element();assert.equal(f.run().applied,false);assert.equal(f.observers.length,0);
});
test('source change disposes layout and observation rather than styling the next video with stale identity',()=>{
 const f=fixture('youtube');f.run();f.globals.location.href='https://www.youtube.com/watch?v=dQw4w9WgXcQ';f.mutate();f.flush();assert.equal(f.globals.document.adoptedStyleSheets.length,0);assert.equal(f.player.attributes.size,0);assert.equal(f.observers[0].disconnected,true);assert.equal(f.timers.size,0);
});
test('initial player discovery expires after thirty seconds and pagehide cleans an installed observer',()=>{
 const f=fixture();f.env.target=undefined;f.run();assert.equal(f.timers.size,1);f.flush(30000);assert.equal(f.observers[0].disconnected,true);assert.equal(f.timers.size,0);
 const ready=fixture('youtube');ready.run();ready.globals.window.dispatchEvent(new Event('pagehide'));assert.equal(ready.globals.document.adoptedStyleSheets.length,0);assert.equal(ready.observers[0].disconnected,true);assert.equal(ready.timers.size,0);
});
test('Bilibili failed official toggle still receives fixed player CSS and does not retry-toggle forever',()=>{
 const f=fixture();f.button.clickAction=()=>undefined;assert.equal(f.run().ready,true);assert.equal(f.player.attributes.has('data-thoughtspace-player'),true);f.mutate();f.flush();assert.equal(f.button.clicks,1);
});
test('actual native Bilibili login dimensions fit the whole official form including close and agreement',()=>{
 const f=fixture(),mask=new Element(),content=new Element();mask.classes.add('bili-mini-mask');content.box={left:-154.5,top:-90,width:820,height:460};mask.content=content;mask.appendChild(content);f.env.overlays=[mask];
 f.run();assert.equal(mask.attributes.get('data-thoughtspace-dialog'),'mask');assert.equal(content.attributes.has('data-thoughtspace-dialog-content'),true);assert.equal(f.player.attributes.has('data-thoughtspace-player'),true);
 const css=f.globals.document.adoptedStyleSheets.map(sheet=>sheet.textContent).join('\n'),scale=Number(css.match(/transform:scale\(([\d.]+)\)/)?.[1]);assert.ok(scale>0&&scale<=1);assert.ok(820*scale<=526-16);assert.ok(460*scale<=296-16);assert.equal(f.button.clicks,1);
});
test('hidden modal ancestors are ignored and role/aria-modal changes trigger fitting',()=>{
 for(const value of ['none','hidden','0']){const f=fixture('youtube'),modal=new Element(),parent=new Element();parent.appendChild(modal);if(value==='none')parent.style.display=value;else if(value==='hidden')parent.style.visibility=value;else parent.style.opacity=value;f.env.overlays=[modal];f.run();assert.equal(modal.attributes.size,0);assert.equal(f.globals.document.adoptedStyleSheets.length,1);}
 const f=fixture('youtube');f.run();const modal=new Element();f.env.overlays.push(modal);f.mutate('aria-modal');f.flush();assert.equal(modal.attributes.has('data-thoughtspace-dialog'),true);assert.ok(f.observers[0].options?.attributeFilter.includes('role'));
});
test('surface ready means a viewport-sized player or accessible modal, not just an installed observer',()=>{
 const f=fixture('youtube');f.player.focusedBox=undefined;assert.equal(f.run().ready,false);f.player.focusedBox={left:0,top:0,width:526,height:296};assert.equal(f.run().ready,true);
 const empty=fixture('youtube');empty.env.target=undefined;assert.equal(empty.run().ready,false);
});
test('late old-source disposal cannot clear a newer same-document surface',()=>{
 const f=fixture('youtube');f.run();const next='https://www.youtube.com/watch?v=dQw4w9WgXcQ';f.globals.location.href=next;f.run('install',next);const sheets=f.globals.document.adoptedStyleSheets.length;f.run('dispose',youtube);assert.equal(f.globals.document.adoptedStyleSheets.length,sheets);assert.equal(f.player.attributes.has('data-thoughtspace-player'),true);
});
