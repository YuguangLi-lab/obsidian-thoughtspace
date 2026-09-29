import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import type {MediaSnapshot,CaptureIdentity} from '../src/online-platform/online-page.mjs';

const source='https://www.youtube.com/watch?v=M7lc1UVf-VE';
// Exercise the shipped ES2022 function after serialization, without tsx's
// test-only __name helper or any closure shared with the host process.
const compiled=transformSync(readFileSync('src/online-platform/online-page.mjs','utf8'),{loader:'js',format:'cjs',target:'es2022'}).code;
const pageScript=runInNewContext(compiled+'\nmodule.exports.onlinePageAction.toString()',{module:{exports:{}}}) as string;
type Box={left:number;top:number;width:number;height:number};
class PageElement {
 parentElement:PageElement|null=null;style={display:'block',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible',transform:'none'};
 constructor(public box:Box={left:-20.3,top:30.2,width:640.8,height:360.8}){}
 getBoundingClientRect(){return{...this.box,right:this.box.left+this.box.width,bottom:this.box.top+this.box.height};}
}
class Video extends PageElement {
 currentSrc='blob:actual-video';src='';currentTime=14.25;duration=120;paused=true;playbackRate=1;readyState=4;seeking=false;videoWidth=1280;videoHeight=720;plays=0;pauses=0;mediaKeys:object|null=null;
 events=new Map<string,(()=>void)[]>();
 async play(){this.plays++;this.paused=false;}pause(){this.pauses++;this.paused=true;}
 addEventListener(name:string,listener:()=>void){this.events.set(name,[...(this.events.get(name)||[]),listener]);}
 dispatch(name:string){for(const listener of this.events.get(name)||[])listener();}
}
function fixture(){
 const video=new Video(),player=new PageElement({left:0,top:0,width:700,height:400});video.parentElement=player;
 const environment={videos:[video],overlays:[] as PageElement[],hit:video as PageElement,ad:false,noContext:false,drawError:null as Error|null,encodeError:null as Error|null,dataUrl:undefined as string|undefined,onDraw:undefined as (()=>void)|undefined,onEncode:undefined as (()=>void)|undefined};
 const draws:{video:Video;args:number[]}[]=[],mimes:string[]=[],canvases:{width:number;height:number}[]=[];
 const globals={location:{href:source},innerWidth:600,innerHeight:400,window:{frameElement:null as PageElement|null},crypto:{randomUUID:()=> '12345678-1234-4234-8234-123456789abc'},
  document:{querySelector:()=>environment.ad?{}:null,querySelectorAll:(selector:string)=>selector.endsWith('video')?environment.videos:environment.overlays,elementFromPoint:()=>environment.hit,
   createElement:(tag:string)=>{assert.equal(tag,'canvas');const canvas={width:0,height:0,getContext:(kind:string)=>{assert.equal(kind,'2d');return environment.noContext?null:{drawImage:(target:Video,...args:number[])=>{if(environment.drawError)throw environment.drawError;draws.push({video:target,args});environment.onDraw?.();}};},toDataURL:(mime:string)=>{mimes.push(mime);if(environment.encodeError)throw environment.encodeError;environment.onEncode?.();return environment.dataUrl??'data:image/png;base64,iVBORw0KGgo=';}};canvases.push(canvas);return canvas;}},
  getComputedStyle:(element:PageElement)=>element.style};
 const run=(action='capture',expectedMedia:string|null=null,expectedCapture:CaptureIdentity|null=null)=>runInNewContext(`(${pageScript})(...${JSON.stringify(['youtube',source,action,0,expectedMedia,expectedCapture])})`,globals) as Promise<Partial<MediaSnapshot>&{reason?:string}>;
 return{video,player,globals,environment,run,draws,mimes,canvases};
}
test('serialized guest draws the decoded video at natural size and samples time immediately before drawing',async()=>{
 const f=fixture();f.environment.onDraw=()=>{f.video.currentTime=14.3;};f.environment.onEncode=()=>{f.video.currentTime=14.4;};
 const snapshot=await f.run();assert.equal(snapshot.time,14.25);assert.equal(snapshot.media,f.video.currentSrc);assert.equal(snapshot.capture?.seekRevision,0);
 assert.equal(f.draws[0].video,f.video);assert.deepEqual(f.draws[0].args,[0,0,1280,720]);assert.deepEqual(f.mimes,['image/png']);
 assert.equal(snapshot.frame?.width,1280);assert.equal(snapshot.frame?.height,720);assert.match(snapshot.frame?.dataUrl??'',/^data:image\/png;base64,/);
 assert.deepEqual(f.canvases.map(c=>[c.width,c.height]),[[0,0]],'release backing pixels after encoding');assert.equal(f.video.plays,0);assert.equal(f.video.pauses,0);
});
test('read and capture probes register no canvas work and repeated probes share one seek observer',async()=>{
 const f=fixture();assert.equal((await f.run('read')).capture,undefined);assert.equal(f.video.events.size,0);
 const first=await f.run('capture-probe'),second=await f.run('capture-probe');assert.equal(first.capture?.token,second.capture?.token);assert.equal(f.video.events.get('seeking')?.length,1);assert.equal(f.canvases.length,0);
});
test('large decoded frames downscale proportionally to 1920 pixels and small frames never upscale',async()=>{
 for(const [width,height,expected] of [[3840,2160,[1920,1080]],[2160,3840,[1080,1920]],[320,180,[320,180]]] as const){
  const f=fixture();f.video.videoWidth=width;f.video.videoHeight=height;const snapshot=await f.run();assert.deepEqual([snapshot.frame?.width,snapshot.frame?.height],expected);assert.deepEqual(f.draws[0].args,[0,0,...expected]);
 }
});
test('player controls, login overlays, CSS cropping, rotation and scale never contaminate or block a video frame',async()=>{
 const f=fixture();f.environment.overlays=[new PageElement({left:200,top:80,width:140,height:120})];f.environment.hit=new PageElement();
 f.player.box={left:50,top:50,width:400,height:250};f.player.style.overflowX='hidden';f.player.style.overflowY='auto';f.video.style.transform='matrix(0, 2, -2, 0, 0, 0)';
 const snapshot=await f.run();assert.equal(snapshot.reason,undefined);assert.deepEqual(f.draws[0].args,[0,0,1280,720]);assert.equal('rect' in snapshot.capture!,false);assert.equal('viewport' in snapshot.capture!,false);
 f.globals.innerWidth=300;f.globals.innerHeight=200;f.video.box={left:-20,top:10,width:160,height:90};assert((await f.run()).frame);assert.equal(f.draws[1].video,f.video);
});
test('native seeks and replaced elements reject a stale capture token before drawing',async()=>{
 const f=fixture(),before=await f.run('capture-probe');f.video.dispatch('seeking');f.video.dispatch('seeking');
 assert.match((await f.run('capture',null,before.capture)).reason||'',/播放位置已变化/);assert.equal(f.draws.length,0);assert.equal((await f.run('capture-probe')).capture?.seekRevision,2);
 const replacement=new Video();replacement.parentElement=f.player;f.environment.videos=[replacement];f.globals.crypto.randomUUID=()=> '12345678-1234-4234-8234-123456789def';
 assert.match((await f.run('capture',null,before.capture)).reason||'',/视频元素/);assert.equal(f.draws.length,0);
});
test('source, media, element replacement and native seek changes during encoding discard the image',async()=>{
 for(const change of ['source','media','element','seeking'] as const){
  const f=fixture();f.environment.onEncode=()=>{if(change==='source')f.globals.location.href=source+'&other=1';else if(change==='media')f.video.currentSrc='blob:other';else if(change==='element')f.environment.videos=[new Video()];else f.video.dispatch('seeking');};
  const snapshot=await f.run();assert.match(snapshot.reason??'',/来源或播放位置已变化/,change);assert.equal(snapshot.frame,undefined);assert.equal(f.canvases[0].width,0);
 }
});
test('unready, seeking, DRM, hidden, ambiguous and advertising video states never draw',async()=>{
 for(const state of ['nested','loading','seeking','empty','drm','hidden','ambiguous','ad'] as const){
  const f=fixture();if(state==='nested')f.globals.window.frameElement=new PageElement();if(state==='loading')f.video.readyState=1;if(state==='seeking')f.video.seeking=true;if(state==='empty')f.video.videoWidth=0;if(state==='drm')f.video.mediaKeys={};if(state==='hidden')f.player.style.display='none';if(state==='ambiguous')f.environment.videos.push(new Video());if(state==='ad')f.environment.ad=true;
  const snapshot=await f.run();assert(snapshot.reason,state);if(state==='drm')assert.match(snapshot.reason,/DRM/);assert.equal(snapshot.frame,undefined);assert.equal(f.draws.length,0);assert.equal(f.video.plays,0);assert.equal(f.video.pauses,0);
 }
});
test('CORS SecurityError surfaces explicitly without alternate capture or cross-origin changes',async()=>{
 for(const stage of ['drawError','encodeError'] as const){
  const f=fixture(),error=new Error('Tainted canvas');error.name='SecurityError';f.environment[stage]=error;
  const snapshot=await f.run();assert.match(snapshot.reason??'',/CORS/);assert.equal(snapshot.frame,undefined);assert.equal(f.canvases.length,1);assert.equal(f.canvases[0].width,0);assert.equal('crossOrigin' in f.video,false);assert.equal(f.video.currentSrc,'blob:actual-video');
 }
});
test('missing canvas context and ordinary drawing or encoding failures release pixel storage and report errors',async()=>{
 for(const stage of ['noContext','drawError','encodeError'] as const){
  const f=fixture();if(stage==='noContext')f.environment.noContext=true;else f.environment[stage]=new Error('canvas failed');
  const snapshot=await f.run();assert(snapshot.reason);assert.equal(snapshot.frame,undefined);assert.equal(f.canvases[0].width,0);assert.equal(f.canvases[0].height,0);
 }
});
test('oversized decoded frames and invalid or oversized encoded images cannot cross the guest boundary',async()=>{
 const f=fixture();f.video.videoWidth=5000;f.video.videoHeight=5000;assert.match((await f.run()).reason??'',/1600 万像素/);assert.equal(f.canvases.length,0);
 f.video.videoWidth=1280;f.video.videoHeight=720;for(const encoded of ['data:,','data:image/jpeg;base64,YQ==','data:image/png;base64,'+'A'.repeat(Math.ceil(16*1024*1024/3)*4+2)]){f.environment.dataUrl=encoded;const snapshot=await f.run();assert.match(snapshot.reason??'',/编码失败|16 MB/);assert.equal(snapshot.frame,undefined);}
});
test('expected source and media identities are required before creating the canvas',async()=>{
 const f=fixture();await assert.rejects(f.run('capture','blob:other-video'),/文件已变化/);f.globals.location.href=source+'&other=1';await assert.rejects(f.run(),/页面已切换/);assert.equal(f.canvases.length,0);
});
