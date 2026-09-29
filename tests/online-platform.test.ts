import assert from 'node:assert/strict';
import test from 'node:test';
import {OnlinePlatform,parseOnlineSource,resolveOnlineSource} from '../src/online-platform';
import {resolveOnlineVideo,type RedirectFetcher} from '../src/online-platform/online-resolver.mjs';
import {allowsOnlineNavigation,isBilibiliShortLink,strictOnlineUrl} from '../src/online-platform/online-video.mjs';
import type {OnlineController} from '../src/online-platform/online-controller.mjs';

function positionFixture(){
 const path='https://www.bilibili.com/video/BV1p5Yg6JEzR/',host={isConnected:true} as HTMLElement;
 let samples=0,stops=0,sample=async()=>42.125;
 const platform=new OnlinePlatform(()=>undefined),controller={position:async(sourcePath:string)=>{assert.equal(sourcePath,path);samples++;return sample();},stop:()=>{stops++;}} as OnlineController;
 const internal=platform as unknown as {controller:OnlineController;activeHost:HTMLElement;activePath:string;activeLease:unknown;mounted:unknown};internal.controller=controller;internal.activeHost=host;internal.activePath=path;
 const release=platform.mount(host,path);internal.activeLease=internal.mounted;
 return{platform,path,host,release,internal,get samples(){return samples;},get stops(){return stops;},setSample(next:()=>Promise<number>){sample=next;}};
}

test('position requires the active connected source and returns the controller fresh sample',async()=>{
 const f=positionFixture();assert.equal(await f.platform.position(f.path),42.125);assert.equal(f.samples,1);
 await assert.rejects(f.platform.position(f.path+'?p=2'),/来源/);assert.equal(f.samples,1);
 (f.host as unknown as {isConnected:boolean}).isConnected=false;await assert.rejects(f.platform.position(f.path),/插件内/);assert.equal(f.samples,1);f.platform.dispose();
});
test('position cancels delivery when the panel lease, source, connection or ownership changes',async()=>{
 for(const change of ['lease','path','detached','released','stopped'] as const){
  const f=positionFixture();let resolve!:(time:number)=>void;f.setSample(()=>new Promise(done=>{resolve=done;}));
  const pending=f.platform.position(f.path),rejected=assert.rejects(pending,/切换|关闭/);
  if(change==='lease')f.platform.mount(f.host,f.path);
  else if(change==='path')f.internal.activePath=f.path+'?p=2';
  else if(change==='detached')(f.host as unknown as {isConnected:boolean}).isConnected=false;
  else if(change==='released')f.release();else f.platform.stop();
  resolve(99);await rejected;f.platform.dispose();
 }
});
test('position cannot sample a speculative destination before its player is active',async()=>{
 const f=positionFixture();f.platform.mount({isConnected:true} as HTMLElement,f.path);await assert.rejects(f.platform.position(f.path),/切换/);assert.equal(f.samples,0);f.platform.dispose();
});

test('parsing and construction work without loading an Electron playback runtime',()=>{
 const platform=new OnlinePlatform(()=>{throw Error('No playback should begin');});platform.stop();platform.dispose();platform.dispose();
 for(const link of ['https://youtu.be/M7lc1UVf-VE?t=1m2s','https://m.youtube.com/watch?v=M7lc1UVf-VE&t=62','https://www.youtube.com/shorts/M7lc1UVf-VE?start=62','https://www.youtube.com/live/M7lc1UVf-VE?t=62']){
  assert.deepEqual(parseOnlineSource(link),{kind:'online',provider:'youtube',path:'https://www.youtube.com/watch?v=M7lc1UVf-VE',name:'YouTube · M7lc1UVf-VE',initialTime:62});
 }
 assert.throws(()=>platform.open('https://youtu.be/M7lc1UVf-VE'),/已关闭/);
});
test('source resolution retains share-link start time instead of returning only canonical path',async()=>{
 const source=await resolveOnlineSource('分享 https://www.bilibili.com/video/BV1p5Yg6JEzR/?p=2&t=90.5&spm_id_from=track');
 assert.equal(source.path,'https://www.bilibili.com/video/BV1p5Yg6JEzR/?p=2');assert.equal(source.initialTime,90.5);assert.match(source.name,/P2/);assert.equal('mediaUrl' in source,false);
 assert.notEqual(source.path,parseOnlineSource('https://www.bilibili.com/video/BV1p5Yg6JEzR/')?.path);
});
test('unsupported schemes, fake hosts, credentials, ports and unsupported pages are rejected',()=>{
 for(const link of ['javascript:alert(1)','http://youtu.be/M7lc1UVf-VE','https://youtu.be.attacker.test/M7lc1UVf-VE','https://secret@www.bilibili.com/video/BV1p5Yg6JEzR/','https://www.youtube.com:8443/watch?v=M7lc1UVf-VE','https://www.youtube.com/@channel','https://b23.tv/abc','https://www.bilibili.com/video/BV1p5Yg6JEzR/?p=-1'])assert.equal(parseOnlineSource(link),undefined,link);
 assert.equal(allowsOnlineNavigation('youtube','https://accounts.google.com/ServiceLogin'),true);
 assert.equal(allowsOnlineNavigation('youtube','https://www.bilibili.com/'),false);
});
test('Bilibili redirect resolution preserves part identity and time while omitting credentials',async()=>{
 const calls:{url:string;options:Parameters<RedirectFetcher>[1]}[]=[],cancelled:string[]=[];
 const result=await resolveOnlineVideo('分享 https://b23.tv/abc123',async(url,options)=>{
  calls.push({url,options});return{status:302,headers:{get:()=>calls.length===1?'/next':'https://www.bilibili.com/video/BV1p5Yg6JEzR/?p=3&t=1m2s'},body:{cancel:async()=>{cancelled.push(url);}}};
 });
 assert.equal(result.path,'https://www.bilibili.com/video/BV1p5Yg6JEzR/?p=3');assert.equal(result.initialTime,62);assert.equal(calls.length,2);assert.equal(cancelled.length,2);
 assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.signal instanceof AbortSignal,true);
});
test('short redirects cannot reach private addresses, non-Bilibili pages, ports or more than five hops',async()=>{
 for(const target of ['http://b23.tv/abc','https://127.0.0.1/a','https://www.bilibili.com.attacker.test/a','https://pan.baidu.com/s/1test','https://www.bilibili.com:99/','https://www.bilibili.com/read/cv1']){
  let calls=0;await assert.rejects(resolveOnlineVideo('https://b23.tv/abc',async()=>{calls++;return{status:302,headers:{get:()=>target}};}));assert.equal(calls,1);
 }
 let calls=0;await assert.rejects(resolveOnlineVideo('https://b23.tv/abc',async()=>{calls++;return{status:302,headers:{get:()=>'/abc'}};}),/次数过多/);assert.equal(calls,5);
});
test('a short link without an HTTP redirect gives an actionable failure',async()=>{
 await assert.rejects(resolveOnlineVideo('https://b23.tv/abc',async()=>({status:200,headers:{get:()=>null}})),/完整视频地址/);
});
test('ambiguous identity and start-time parameters cannot silently select one video or part',()=>{
 const youtube='https://www.youtube.com/watch?v=M7lc1UVf-VE',bili='https://www.bilibili.com/video/BV1p5Yg6JEzR/';
 for(const input of [youtube+'&v=dQw4w9WgXcQ',youtube+'&v=M7lc1UVf-VE',youtube+'&%76=M7lc1UVf-VE',bili+'?p=2&p=3',bili+'?p=2&p=2',youtube+'&t=1&t=99',youtube+'&start=1&start=99',youtube+'&t=1&start=99','https://pan.baidu.com/play/video?fsid=1&fsid=2','https://pan.baidu.com/disk/main#/video?fsid=1&fsid=2'])assert.equal(parseOnlineSource(input),undefined,input);
 for(const t of ['', '-1','NaN','Infinity','0x10','1e2','10seconds','864001','99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'])assert.equal(parseOnlineSource(youtube+'&t='+t),undefined,t);
 assert.equal(parseOnlineSource(youtube+'&t=864000')?.initialTime,864000);
});
test('raw address checks run before normalization erases ports, dot paths or malformed characters',()=>{
 const id='M7lc1UVf-VE';
 for(const input of [
  `https://www.youtube.com:443/watch?v=${id}`,`https://www.youtube.com:0443/watch?v=${id}`,`https://www.youtube.com/a/../watch?v=${id}`,`https://www.youtube.com/%2e%2e/watch?v=${id}`,
  `https://%77ww.youtube.com/watch?v=${id}`,`https://@www.youtube.com/watch?v=${id}`,`https://www.youtube.com\\watch?v=${id}`,`https://www.youtube.com/watch?v=${id}\n&t=99`,
  `https://www.youtube.com/watch?v=${id}\t`,`https://www.youtube.com/watch?v=${id}&tracking=%zz`,`https://www.youtube.com/watch?v=${id}&tracking=%FF`,
  `https://www.youtube.com/watch?v=${id} https://youtu.be/dQw4w9WgXcQ`
 ])assert.equal(parseOnlineSource(input),undefined,input);
 for(const input of ['https://b23.tv:443/abc','https://b23.tv/a/../abc','https://b23.tv/%2E%2E/abc','https://b23.tv/abc\n','https://@b23.tv/abc'])assert.equal(isBilibiliShortLink(input),false,input);
 assert.equal(allowsOnlineNavigation('youtube',`https://www.youtube.com:443/watch?v=${id}`),false);
 assert.equal(allowsOnlineNavigation('youtube',`https://www.youtube.com/../watch?v=${id}`),false);
 assert.equal(allowsOnlineNavigation('youtube','https://consent.google.com/m?continue=https%3A%2F%2Fwww.youtube.com%2F'),true);
});
test('redirect Locations cannot lose unsafe syntax through URL normalization',async()=>{
 for(const target of ['https://b23.tv:443/next','//b23.tv:443/next','https://@www.bilibili.com/video/BV1p5Yg6JEzR/','https://www.bilibili.com/a/../video/BV1p5Yg6JEzR/','/%2e%2e/abc','https://www.bilibili.com\\video/BV1p5Yg6JEzR/','/abc\n','/abc?bad=%zz']){
  let calls=0;await assert.rejects(resolveOnlineVideo('https://b23.tv/abc',async()=>{calls++;return{status:302,headers:{get:()=>target}};}));assert.equal(calls,1,target);
 }
 assert.equal(strictOnlineUrl('/next','https://b23.tv/abc').href,'https://b23.tv/next');
 assert.equal(strictOnlineUrl('?target=1','https://b23.tv/abc').href,'https://b23.tv/abc?target=1');
});
