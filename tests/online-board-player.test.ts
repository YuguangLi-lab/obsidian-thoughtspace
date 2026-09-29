import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as onlinePlatform from '../src/online-platform';
import * as mediaSource from '../src/media-source';
import type {OnlineState} from '../src/online-platform';
import type {OnlineBoardMoment,OnlineBoardPlayerHandle} from '../src/online-board-player';

class Element {
 children:Element[]=[];parentElement?:Element;className='';textContent='';hidden=false;disabled=false;connected=true;
 attributes=new Map<string,string>();listeners=new Map<string,((event:any)=>unknown)[]>();
 onclick?:((event:any)=>unknown)|null;onpointerdown?:((event:any)=>unknown)|null;ondblclick?:((event:any)=>unknown)|null;
 get isConnected():boolean{return this.parentElement?this.parentElement.isConnected:this.connected;}
 createEl(tag:string,options?:{cls?:string;text?:string;attr?:Record<string,string>}|string){
  const child=new Element();child.parentElement=this;child.attributes.set('tag',tag);
  if(typeof options==='string')child.className=options;
  else if(options){child.className=options.cls||'';child.textContent=options.text||'';for(const[key,value]of Object.entries(options.attr||{}))child.setAttribute(key,value);}
  this.children.push(child);return child;
 }
 createDiv(options?:{cls?:string;text?:string;attr?:Record<string,string>}|string){return this.createEl('div',options);}
 createSpan(options?:{cls?:string;text?:string;attr?:Record<string,string>}|string){return this.createEl('span',options);}
 setAttribute(key:string,value:string){this.attributes.set(key,String(value));}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 addClass(...names:string[]){this.className+=" "+names.join(' ');}
 setText(value:string){this.textContent=value;}
 empty(){for(const child of this.children){child.parentElement=undefined;child.connected=false;}this.children=[];this.textContent='';}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=undefined;this.connected=false;}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 addEventListener(type:string,listener:(event:any)=>unknown){this.listeners.set(type,[...this.listeners.get(type)||[],listener]);}
 removeEventListener(type:string,listener:(event:any)=>unknown){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==listener));}
 click(){if(this.disabled)return;const event={target:this,preventDefault(){},stopPropagation(){}};this.onclick?.(event);for(const listener of this.listeners.get('click')||[])listener(event);}
}
const source=onlinePlatform.parseOnlineSource('https://www.bilibili.com/video/BV1xx411c7mD/?p=1')!;
const other=onlinePlatform.parseOnlineSource('https://www.bilibili.com/video/BV1xx411c7mD/?p=2')!;
const compiled=transformSync(readFileSync('src/online-board-player.ts','utf8'),{loader:'ts',format:'cjs'}).code;
const module={exports:{}};let ids=0;
new Function('require','module','exports',compiled)((name:string)=>{
 if(name==='obsidian')return{setIcon:(el:Element,icon:string)=>el.setAttribute('data-icon',icon)};
 if(name==='./online-platform')return onlinePlatform;
 if(name==='./media-source')return mediaSource;
 if(name==='./model')return{uid:()=>`board-moment-${++ids}`};
 throw Error(`Unexpected dependency: ${name}`);
},module,module.exports);
const {mountOnlineBoardPlayer}=module.exports as {mountOnlineBoardPlayer:(host:HTMLElement,url:string,options:any)=>OnlineBoardPlayerHandle};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function settle(){await new Promise<void>(resolve=>setImmediate(resolve));}
function fixture(disabled=false){
 const host=new Element(),opens:{path:string;time:number}[]=[],commands:{path:string;action:string;value?:number}[]=[],saves:OnlineBoardMoment[]=[],states:OnlineState[]=[];
 let notify!:(state:OnlineState)=>void,alive=true,mounts=0,releases=0,disposed=0,positions=0,frames=0,plays=0;
 let position=async()=>41.25,capture:()=>Promise<{bytes:Uint8Array;time:number}>=async()=>({bytes:new Uint8Array([1,2,3]),time:42.5}),save=async(_moment:OnlineBoardMoment)=>{};
 const platform={mount:()=>{mounts++;return()=>{releases++;};},open:(path:string,time:number)=>{opens.push({path,time});return source;},command:async(path:string,action:string,value?:number)=>{commands.push({path,action,value});return true;},position:async()=>{positions++;return position();},capture:async()=>{frames++;return capture();},dispose:()=>{disposed++;}};
 const handle=mountOnlineBoardPlayer(host as unknown as HTMLElement,source.path,{disabled,alive:()=>alive,onState:(state:OnlineState)=>states.push(state),onPlay:()=>{plays++;},onCapture:async(moment:OnlineBoardMoment)=>{saves.push(moment);await save(moment);},createPlatform:(listener:(state:OnlineState)=>void)=>{notify=listener;return platform;}});
 const publish=(patch:Partial<OnlineState>={})=>notify({sourcePath:source.path,available:true,closed:false,time:10,duration:100,paused:false,status:'synced',...patch});
 const button=(label:string)=>{const element=host.all().find(node=>node.attributes.get('tag')==='button'&&node.getAttribute('aria-label')===label);assert.ok(element,`button ${label}`);return element;};
 const status=()=>host.all().find(node=>node.className.split(' ').includes('ts-online-board-player__status'))?.textContent||'';
 return{host,handle,opens,commands,saves,states,publish,button,status,setAlive:(value:boolean)=>{alive=value;},setPosition:(fn:typeof position)=>{position=fn;},setCapture:(fn:typeof capture)=>{capture=fn;},setSave:(fn:typeof save)=>{save=fn;},get mounts(){return mounts;},get releases(){return releases;},get disposed(){return disposed;},get positions(){return positions;},get frames(){return frames;},get plays(){return plays;}};
}

test('mounting a board player never loads or plays a remote page; capture controls are always visible',()=>{
 const f=fixture();assert.equal(f.mounts,1);assert.equal(f.opens.length,0);assert.deepEqual(f.commands,[]);
 assert.equal(f.button('记下此刻').disabled,true);assert.equal(f.button('截取画面').disabled,true);
 f.button('加载视频').click();assert.equal(f.opens.length,1);assert.equal(f.opens[0].path,source.path);
 f.handle.dispose();assert.equal(f.releases,1);assert.equal(f.disposed,1);
});

test('timestamp action uses a fresh position and saves without pausing or navigating',async()=>{
 const f=fixture();f.button('加载视频').click();f.publish();
 assert.equal(f.button('记下此刻').disabled,false);f.button('记下此刻').click();await settle();
 assert.equal(f.positions,1);assert.equal(f.saves.length,1);assert.equal(f.saves[0].time,41.25);assert.equal(f.saves[0].text,'');assert.ok(f.saves[0].id);
 assert.equal(f.commands.some(command=>command.action==='pause'),false);f.handle.dispose();
});

test('screenshot saves the actual frame time and the same image/id on save retry',async()=>{
 const f=fixture();let attempts=0;f.setSave(async()=>{if(attempts++===0)throw Error('磁盘繁忙');});
 f.button('加载视频').click();f.publish();f.button('截取画面').click();await settle();
 assert.equal(f.frames,1);assert.equal(f.saves[0].time,42.5);assert.equal(f.saves[0].image?.type,'image/png');assert.match(f.status(),/磁盘繁忙/);
 assert.equal(f.button('记下此刻').disabled,true);assert.equal(f.button('截取画面').disabled,true);
 f.button('重试保存').click();await settle();assert.equal(f.frames,1);assert.equal(f.saves.length,2);assert.equal(f.saves[0],f.saves[1]);
 assert.equal(f.button('截取画面').disabled,false);f.handle.dispose();
});

test('a source/part change disables acquisition and stale acquired frames never reach notes',async()=>{
 const f=fixture(),gate=deferred<{bytes:Uint8Array;time:number}>();f.setCapture(()=>gate.promise);
 f.button('加载视频').click();f.publish();f.button('截取画面').click();f.publish({available:false,status:'source-changed',candidate:other});
 assert.equal(f.button('记下此刻').disabled,true);f.publish();gate.resolve({bytes:new Uint8Array([1]),time:12});await settle();
 assert.equal(f.saves.length,0);f.publish({sourcePath:other.path});assert.equal(f.button('截取画面').disabled,true);f.handle.dispose();
});

test('disposal during acquisition prevents late saves and releases the exact player once',async()=>{
 const f=fixture(),gate=deferred<{bytes:Uint8Array;time:number}>();f.setCapture(()=>gate.promise);
 f.button('加载视频').click();f.publish();f.button('截取画面').click();f.handle.dispose();f.handle.dispose();gate.resolve({bytes:new Uint8Array([1]),time:12});await settle();
 assert.equal(f.saves.length,0);assert.equal(f.releases,1);assert.equal(f.disposed,1);
});

test('blocked board controls cannot capture after synchronization',async()=>{
 const f=fixture(true);f.button('加载视频').click();f.publish();
 f.button('记下此刻').click();f.button('截取画面').click();await settle();assert.equal(f.positions,0);assert.equal(f.frames,0);f.handle.dispose();
});

test('seek loads lazily, then uses the owning player; play notification fires once per transition',async()=>{
 const f=fixture();await f.handle.seek(35);assert.deepEqual(f.opens,[{path:source.path,time:35}]);
 f.publish();f.publish({time:11});assert.equal(f.plays,1);await f.handle.seek(40);assert.deepEqual(f.commands.at(-1),{path:source.path,action:'seek',value:40});
 f.publish({paused:true});f.publish({paused:false});assert.equal(f.plays,2);f.handle.pause();await settle();assert.equal(f.commands.at(-1)?.action,'pause');f.handle.dispose();
});

test('recovering a changed part or closed guest reopens the original source at its last verified time',async()=>{
 for(const patch of [{available:false,candidate:other},{available:false,closed:true},{sourcePath:other.path}]){
  const f=fixture();f.button('加载视频').click();f.publish({time:38.25});f.publish(patch);
  f.button('重新加载视频').click();await settle();
  assert.deepEqual(f.opens.at(-1),{path:source.path,time:38.25});assert.equal(f.opens.length,2);assert.equal(f.commands.length,0);f.handle.dispose();
 }
});
