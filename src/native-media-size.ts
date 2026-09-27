import {mediaDimensions} from './media-geometry';
import {isNativeImagePath} from './native-note-drop';

export interface ImageDimensions {width:number;height:number}
export type DroppedImageLoader=(source:string,document:Document,signal:AbortSignal)=>Promise<ImageDimensions|undefined>;
export interface DroppedImageOptions {load?:DroppedImageLoader;timeoutMs?:number}

/** Decode an existing vault resource in the board's owning window, then release it. */
const loadImage:DroppedImageLoader=(source,document,signal)=>new Promise(resolve=>{
 if(signal.aborted){resolve(undefined);return;}
 const window=document.defaultView;if(!window){resolve(undefined);return;}
 const image=new window.Image();let finished=false;
 const finish=(size?:ImageDimensions)=>{
  if(finished)return;finished=true;image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort);
  image.removeAttribute('src');resolve(size);
 };
 const abort=()=>finish();
 const loaded=()=>finish(image.naturalWidth>0&&image.naturalHeight>0?{width:image.naturalWidth,height:image.naturalHeight}:undefined);
 image.onload=loaded;image.onerror=()=>finish();signal.addEventListener('abort',abort,{once:true});
 try{image.src=source;if(image.complete&&image.naturalWidth>0)loaded();}catch{finish();}
});

/** Measure existing image references without creating, modifying or uploading files.
 * A shared deadline bounds the entire batch, including queues of unreadable images.
 * The board renderer may refine fallback dimensions when a resource later loads. */
export async function measureDroppedImages<F>(entries:ReadonlyArray<{file:F;path:string}>,width:number,document:Document,resourcePath:(file:F)=>string,isCurrent:()=>boolean,options:DroppedImageOptions={}):Promise<Map<string,ImageDimensions>>{
 const result=new Map<string,ImageDimensions>(),fallback=mediaDimensions(width,4,3);
 if(!fallback)throw Error('图片尺寸无效');
 const current=()=>{try{return isCurrent();}catch{return false;}};
 if(!current())return result;
 const images=entries.filter(entry=>{if(!isNativeImagePath(entry.path)||result.has(entry.path))return false;result.set(entry.path,{...fallback});return true;});
 if(!images.length)return result;
 const controller=new AbortController(),signal=controller.signal,load=options.load||loadImage;
 const window=document.defaultView,close=()=>controller.abort();
 window?.addEventListener('pagehide',close,{once:true});window?.addEventListener('unload',close,{once:true});
 let next=0,expired=false;
 const requested=options.timeoutMs??1200,timeout=Number.isFinite(requested)?Math.max(1,Math.min(5000,requested)):1200;
 let releaseAbort!:()=>void;
 const aborted=new Promise<undefined>(resolve=>{releaseAbort=()=>resolve(undefined);signal.addEventListener('abort',releaseAbort,{once:true});});
 const clearDeadline=timer(document,()=>{expired=true;controller.abort();},timeout,false);
 const clearOwnerCheck=timer(document,()=>{if(!current())controller.abort();},40,true);
 const worker=async()=>{
  while(!signal.aborted&&current()){
   const entry=images[next++];if(!entry)return;
   let size:ImageDimensions|undefined;
   try{size=await Promise.race([Promise.resolve(load(resourcePath(entry.file),document,signal)).catch(()=>undefined),aborted]);}catch{/* Keep the existing reference with fallback dimensions. */}
   if(!current()){controller.abort();return;}if(expired||signal.aborted)return;
   const fitted=size&&mediaDimensions(width,size.width,size.height);if(fitted)result.set(entry.path,fitted);
  }
 };
 try{await Promise.all(Array.from({length:Math.min(3,images.length)},()=>worker()));return current()?result:new Map();}
 finally{clearDeadline();clearOwnerCheck();window?.removeEventListener('pagehide',close);window?.removeEventListener('unload',close);signal.removeEventListener('abort',releaseAbort);controller.abort();}
}
function timer(document:Document,callback:()=>void,ms:number,repeat:boolean):()=>void{
 const window=document.defaultView;
 if(window){const id=repeat?window.setInterval(callback,ms):window.setTimeout(callback,ms);return()=>{if(repeat)window.clearInterval(id);else window.clearTimeout(id);};}
 // A detached or already closed document has no usable decoder window.
 callback();return()=>{};
}
