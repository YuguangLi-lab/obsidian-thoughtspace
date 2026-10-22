import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindStudioFocusedViewport} from '../src/mindmap-studio-focused-viewport';

function fixture(){
 const events=new Map<string,Set<()=>void>>(),frames=new Map<number,()=>void>();let next=0,observed=false,disconnected=false;
 const emitter=(scope:string)=>({addEventListener:(name:string,fn:()=>void)=>{const key=scope+name;if(!events.has(key))events.set(key,new Set());events.get(key)!.add(fn);},removeEventListener:(name:string,fn:()=>void)=>events.get(scope+name)?.delete(fn)});
 const viewport={...emitter('viewport:'),height:844,width:390,offsetTop:0,offsetLeft:0,scale:1};
 const win={...emitter('window:'),visualViewport:viewport,innerWidth:390,innerHeight:844,requestAnimationFrame:(fn:()=>void)=>{frames.set(++next,fn);return next;},cancelAnimationFrame:(id:number)=>frames.delete(id),getComputedStyle:(e:any)=>e.css,ResizeObserver:class{constructor(_callback:()=>void){}observe(){observed=true;}disconnect(){disconnected=true;}}};
 const doc={defaultView:win,activeElement:null as any};
 const box=(left:number,top:number,width:number,height:number)=>({left,top,right:left+width,bottom:top+height,width,height});
 const root={...emitter('root:'),ownerDocument:doc,isConnected:true,css:{overflowX:'auto',overflowY:'auto'},clientTop:0,clientLeft:0,clientWidth:366,clientHeight:780,getBoundingClientRect:()=>box(12,12,366,root.clientHeight),parentElement:null,contains:(e:unknown)=>e===input||e===replacement};
 const body={ownerDocument:doc,css:{overflowX:'auto',overflowY:'auto'},clientTop:0,clientLeft:0,clientWidth:315,clientHeight:540,getBoundingClientRect:()=>box(30,201.390625,315,body.clientHeight),parentElement:root};
 let inputBox=box(42,616.6875,291,69.1875);const scrolls:any[]=[];
 const input={ownerDocument:doc,isConnected:true,parentElement:body,matches:()=>true,getBoundingClientRect:()=>inputBox,getClientRects:()=>[inputBox],get value(){return'中文草稿\n第二段';},set value(_v:string){throw Error('Must not replace the draft');},get selectionStart(){return 2;},set selectionStart(_v:number){throw Error('Must not replace selection');},get selectionEnd(){return 5;},set selectionEnd(_v:number){throw Error('Must not replace selection');},focus(){throw Error('Must not focus');},scrollIntoView:(options:unknown)=>{scrolls.push(options);inputBox=box(42,220,291,69.1875);}};
 const replacement={...input};doc.activeElement=input;
 const emit=(name:string)=>{for(const fn of events.get(name)||[])fn();};
 const tick=()=>{const batch=[...frames.entries()];for(const[id,fn]of batch){frames.delete(id);fn();}};
 return{root,body,input,replacement,doc,win,viewport,scrolls,events,frames,emit,tick,get observed(){return observed;},get disconnected(){return disconnected;},setRect:(r:ReturnType<typeof box>)=>{inputBox=r;},box};
}

test('keyboard regression reveals the same 69px editor after layout instead of certifying the old 56px port',()=>{
 const f=fixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.viewport.height=390;f.root.clientHeight=364;f.body.clientHeight=56;
 f.emit('viewport:resize');f.tick();assert.equal(f.scrolls.length,0,'first frame belongs to layout');
 // The scoped short-layout rule provides the whole content scrollport; this
 // pure test verifies behavior against the resulting geometry, not CSS rendering.
 f.body.clientHeight=160;f.tick();assert.deepEqual(f.scrolls,[{block:'nearest',inline:'nearest',behavior:'instant'}]);
 assert.equal(f.doc.activeElement,f.input);assert.equal(f.input.value,'中文草稿\n第二段');assert.deepEqual([f.input.selectionStart,f.input.selectionEnd],[2,5]);
 f.emit('viewport:resize');f.tick();f.tick();assert.equal(f.scrolls.length,1,'visible input must not be scrolled again');release();
});
test('an input already inside all visible ancestor clips does not jump',()=>{
 const f=fixture();f.setRect(f.box(42,230,291,69));const release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();assert.deepEqual(f.scrolls,[]);release();
});
test('outside focus, cancellation or replacement before the second frame never redirects scrolling',()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.doc.activeElement={};},(f:ReturnType<typeof fixture>)=>{f.root.isConnected=false;},(f:ReturnType<typeof fixture>)=>{f.input.isConnected=false;f.doc.activeElement=f.replacement;}]){
  const f=fixture();f.viewport.height=390;const release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();change(f);f.tick();assert.deepEqual(f.scrolls,[]);release();
 }
});
test('resizing during a pinch gesture does not fight the user viewport',()=>{
 const f=fixture();f.viewport.height=390;f.viewport.scale=2;const release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();assert.deepEqual(f.scrolls,[]);release();
});
test('input focus in the owned modal is revealed, while non-text controls are ignored',()=>{
 const f=fixture();f.doc.activeElement={};const release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);assert.equal(f.frames.size,0);
 f.doc.activeElement=f.input;f.input.matches=()=>false;f.emit('root:focusin');assert.equal(f.frames.size,0);
 f.input.matches=()=>true;f.viewport.height=390;f.emit('root:focusin');f.tick();f.tick();assert.equal(f.scrolls.length,1);release();
});
test('offset visual viewport and nested clipping determine visibility in the owner document',()=>{
 const f=fixture();f.viewport.offsetTop=220;f.viewport.height=200;f.body.clientHeight=250;f.setRect(f.box(42,210,291,69));const release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();assert.equal(f.scrolls.length,1);release();
});
test('close disposes both queued frames, observer and all local listeners without subsequent writes',()=>{
 for(const first of [false,true]){const f=fixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);assert.equal(f.observed,true);if(first)f.tick();release();release();f.emit('viewport:resize');f.emit('root:focusin');f.tick();f.tick();assert.equal(f.frames.size,0);assert.equal([...f.events.values()].reduce((n,s)=>n+s.size,0),0);assert.equal(f.disconnected,true);assert.deepEqual(f.scrolls,[]);}
});
test('the actual Studio close method disposes visibility before destroying editor DOM',()=>{
 const source=readFileSync(new URL('../src/mindmap-studio-view.ts',import.meta.url),'utf8'),start=source.indexOf(' onClose(){'),end=source.indexOf('\n',start),method=source.slice(start,end).trim();
 const close=new Function('return function '+method)(),events:string[]=[];
 const host={unbindFocusedViewport:()=>events.push('focused-dispose'),unbindViewport:()=>events.push('viewport-dispose'),toolPanel:{},presentationBar:{},searchTimer:9,contentEl:{win:{clearTimeout:(id:number)=>events.push('timer:'+id)},empty:()=>events.push('dom-empty')}};
 close.call(host);assert.deepEqual(events,['focused-dispose','viewport-dispose','timer:9','dom-empty']);host.unbindFocusedViewport();host.unbindViewport();assert.equal(events.length,4);assert.equal(host.toolPanel,undefined);assert.equal(host.presentationBar,undefined);
});

function boundaryFixture(){
 // Frozen G organization report: actual focused textarea and clipped bounds.
 // See qa-ui-editorial-20261021/native/editorial-g-core-ui-organization/report.json.
 const observed={"box":{"left":42,"top":292.6875,"right":337,"bottom":361.875,"width":295,"height":69.1875},"clip":{"left":42,"top":292.6875,"right":337,"bottom":360.796875},"focused":true,"points":[{"x":101,"y":306.309375,"hit":true},{"x":101,"y":326.7421875,"hit":true},{"x":101,"y":347.175,"hit":true},{"x":189.5,"y":306.309375,"hit":true},{"x":189.5,"y":326.7421875,"hit":true},{"x":189.5,"y":347.175,"hit":true},{"x":278,"y":306.309375,"hit":true},{"x":278,"y":326.7421875,"hit":true},{"x":278,"y":347.175,"hit":true}]};
 assert.equal(observed.box.bottom-observed.clip.bottom,1.078125);
 assert.equal(observed.focused,true);assert.equal(observed.points.length,9);assert.ok(observed.points.every((p:any)=>p.hit));
 const f=fixture();f.viewport.height=390;f.root.clientHeight=364;f.body.clientHeight=267;
 // Reproduce the observed final clipping boundary. The report does not contain
 // every ancestor rectangle; this is a behavioral geometry regression, not a
 // claim that the mock reconstructs the full native CSS layout engine.
 f.body.getBoundingClientRect=()=>f.box(30,observed.clip.bottom-267,315,267);
 f.input.scrollIntoView=(options:any)=>{
  f.scrolls.push(options);
  f.setRect(options.block==='nearest'?observed.box:f.box(observed.box.left,190,observed.box.width,observed.box.height));
 };
 return{...f,observed};
}
test('G real 1.078125px residual after nearest gets one next-frame centered fallback',()=>{
 const f=boundaryFixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();assert.equal(f.scrolls.length,1);assert.equal(f.input.getBoundingClientRect().bottom-f.observed.clip.bottom,1.078125);
 f.tick();assert.deepEqual(f.scrolls,[{block:'nearest',inline:'nearest',behavior:'instant'},{block:'center',inline:'nearest',behavior:'instant'}]);assert.equal(f.frames.size,0);
 assert.equal(f.doc.activeElement,f.input);assert.equal(f.input.value,'中文草稿\n第二段');assert.deepEqual([f.input.selectionStart,f.input.selectionEnd],[2,5]);
 f.tick();f.tick();assert.equal(f.scrolls.length,2,'no automatic retry loop');release();
});
test('a successful nearest result is verified without a centered jump',()=>{
 const f=fixture();f.viewport.height=390;const release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();f.tick();assert.equal(f.scrolls.length,1);assert.equal(f.frames.size,0);release();
});
test('next-frame fallback cannot act on replaced, foreign, blurred or disconnected input',()=>{
 for(const change of [(f:ReturnType<typeof boundaryFixture>)=>{f.doc.activeElement=f.replacement;},(f:ReturnType<typeof boundaryFixture>)=>{f.doc.activeElement={};},(f:ReturnType<typeof boundaryFixture>)=>{f.input.isConnected=false;},(f:ReturnType<typeof boundaryFixture>)=>{f.root.isConnected=false;},(f:ReturnType<typeof boundaryFixture>)=>{f.input.ownerDocument={...f.doc};}]){
  const f=boundaryFixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();change(f);f.tick();assert.equal(f.scrolls.length,1);release();
 }
});
test('pinch begun after nearest cancels the centered fallback',()=>{
 const f=boundaryFixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();f.viewport.scale=2;f.tick();assert.equal(f.scrolls.length,1);release();
});
test('closing between nearest and fallback disposes the third frame without any later scroll',()=>{
 const f=boundaryFixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();assert.equal(f.frames.size,1);release();f.tick();assert.equal(f.frames.size,0);assert.equal(f.scrolls.length,1);assert.equal([...f.events.values()].reduce((sum,e)=>sum+e.size,0),0);
});
test('an input larger than the available clipping port does not trigger a futile centered loop',()=>{
 const f=boundaryFixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();f.body.clientHeight=40;f.body.getBoundingClientRect=()=>f.box(30,300,315,40);f.tick();assert.equal(f.scrolls.length,1);assert.equal(f.frames.size,0);release();
});
test('a newer layout request cancels the older pending fallback before remeasurement',()=>{
 const f=boundaryFixture(),release=bindStudioFocusedViewport(f.root as unknown as HTMLElement);f.tick();f.tick();f.emit('viewport:resize');f.setRect(f.box(42,190,295,69.1875));f.tick();f.tick();f.tick();assert.equal(f.scrolls.length,1);assert.equal(f.frames.size,0);release();
});
