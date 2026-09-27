import test from 'node:test';
import assert from 'node:assert/strict';
import {measureDroppedImages,type ImageDimensions,type DroppedImageLoader} from '../src/native-media-size';

const windowEvents=new EventTarget();
const windowTimers={setTimeout,clearTimeout,setInterval,clearInterval,addEventListener:windowEvents.addEventListener.bind(windowEvents),removeEventListener:windowEvents.removeEventListener.bind(windowEvents)};
const document={defaultView:windowTimers} as unknown as Document;
const files=(names:string[])=>names.map(path=>({path,file:{path}}));
const resource=({path}:{path:string})=>'app://vault/'+path;
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('media sizing preserves source proportions and does not load Markdown or PDF entries',async()=>{
 const entries=files(['笔记.md','图.png','论文.pdf','纵向.jpg']),seen:string[]=[];
 const result=await measureDroppedImages(entries,300,document,resource,()=>true,{load:async src=>{seen.push(src);return src.endsWith('.png')?{width:1200,height:600}:{width:600,height:1200};}});
 assert.deepEqual([...result],[['图.png',{width:300,height:150}],['纵向.jpg',{width:300,height:600}]]);
 assert.deepEqual(seen,['app://vault/图.png','app://vault/纵向.jpg']);
});

test('media sizing caps parallel reads at three and measures duplicate files only once',async()=>{
 let active=0,max=0,calls=0;
 const result=await measureDroppedImages(files([...Array.from({length:10},(_,i)=>i+'.png'),'1.png']),300,document,resource,()=>true,{load:async()=>{active++;calls++;max=Math.max(max,active);await delay(5);active--;return{width:400,height:200};}});
 assert.equal(max,3);assert.equal(active,0);assert.equal(calls,10);assert.equal(result.size,10);
});

test('decode errors, empty dimensions and resource failures retain safe fallback cards',async()=>{
 const result=await measureDroppedImages(files(['broken.png','zero.jpg','throw.bmp','url.webp']),300,document,file=>{if(file.path==='url.webp')throw Error('gone');return file.path;},()=>true,{load:async src=>{if(src==='throw.bmp')throw Error('decode');return src==='zero.jpg'?{width:0,height:100}:undefined;}});
 assert.equal(result.size,4);for(const value of result.values())assert.deepEqual(value,{width:300,height:225});
});

test('a shared short deadline prevents unreadable large batches from multiplying wait time',async()=>{
 let calls=0,aborts=0;
 const result=await measureDroppedImages(files(Array.from({length:100},(_,i)=>i+'.png')),300,document,resource,()=>true,{timeoutMs:20,load:async(_src,_doc,signal)=>{calls++;signal.addEventListener('abort',()=>aborts++,{once:true});return new Promise<ImageDimensions|undefined>(()=>{});}});
 assert.equal(calls,3);assert.equal(aborts,3);assert.equal(result.size,100);assert.ok([...result.values()].every(size=>size.width===300&&size.height===225));
});

test('owner changes cancel active loaders, stop subsequent requests and discard dimensions',async()=>{
 let current=true,calls=0,aborts=0;
 const pending=measureDroppedImages(files(Array.from({length:9},(_,i)=>i+'.png')),300,document,resource,()=>current,{load:async(_src,_doc,signal)=>{calls++;signal.addEventListener('abort',()=>aborts++,{once:true});return new Promise<ImageDimensions|undefined>(()=>{});}});
 current=false;const result=await pending;assert.equal(result.size,0);assert.equal(calls,3);assert.equal(aborts,3);
});

test('already closed owners and invalid requested geometry do not load resources',async()=>{
 let calls=0;const load:DroppedImageLoader=async()=>{calls++;return{width:1,height:1};};
 assert.equal((await measureDroppedImages(files(['1.png']),300,document,resource,()=>false,{load})).size,0);
 await assert.rejects(measureDroppedImages(files(['1.png']),NaN,document,resource,()=>true,{load}),/尺寸/);
 assert.equal(calls,0);
});

function browserFixture(mode:'load'|'error'|'never'|'cached'){
 const nodes:{onload:(()=>void)|null;onerror:(()=>void)|null;src:string;naturalWidth:number;naturalHeight:number;complete:boolean;removed:boolean;removeAttribute:(name:string)=>void}[]=[];
 const document={defaultView:{...windowTimers,Image:function(){let src='';const node={onload:null as (()=>void)|null,onerror:null as (()=>void)|null,get src(){return src;},set src(value:string){src=value;if(mode==='load'||mode==='error')queueMicrotask(()=>mode==='load'?node.onload?.():node.onerror?.());},naturalWidth:800,naturalHeight:400,complete:mode==='cached',removed:false,removeAttribute(name:string){assert.equal(name,'src');node.removed=true;src='';}};nodes.push(node);return node;}}} as unknown as Document;
 return{document,nodes};
}
test('default loader uses the supplied owner document and releases image handlers/source after load',async()=>{
 for(const mode of ['load','cached'] as const){const f=browserFixture(mode),result=await measureDroppedImages(files(['1.png']),300,f.document,resource,()=>true);assert.deepEqual(result.get('1.png'),{width:300,height:150});assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].onload,null);assert.equal(f.nodes[0].onerror,null);assert.equal(f.nodes[0].removed,true);}
});
test('default loader clears source and listeners on decode failure and timeout',async()=>{
 for(const mode of ['error','never'] as const){const f=browserFixture(mode),result=await measureDroppedImages(files(['1.png']),300,f.document,resource,()=>true,{timeoutMs:15});assert.deepEqual(result.get('1.png'),{width:300,height:225});assert.equal(f.nodes[0].onload,null);assert.equal(f.nodes[0].onerror,null);assert.equal(f.nodes[0].removed,true);}
});


test('closing the owner window aborts decoding even when its timers are about to be destroyed',async()=>{
 let current=true,aborted=false;
 const pending=measureDroppedImages(files(['1.png']),300,document,resource,()=>current,{load:async(_src,_document,signal)=>{signal.addEventListener('abort',()=>aborted=true,{once:true});return new Promise<ImageDimensions|undefined>(()=>{});}});
 current=false;windowEvents.dispatchEvent(new Event('pagehide'));assert.equal((await pending).size,0);assert.equal(aborted,true);
});
