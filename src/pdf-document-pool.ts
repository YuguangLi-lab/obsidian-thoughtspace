export interface PdfPageProxy {getViewport(options:{scale:number}):{width:number;height:number};render(options:{canvasContext:CanvasRenderingContext2D;viewport:{width:number;height:number}}):{promise:Promise<unknown>;cancel():void};cleanup?():void;}
export interface PdfDocumentProxy {numPages:number;getPage(page:number):Promise<PdfPageProxy>;}
export interface PdfLoadingTask {promise:Promise<PdfDocumentProxy>;destroy():Promise<void>;}
export interface PdfApi {getDocument(options:{url:string}):PdfLoadingTask;}
type Entry={promise:Promise<PdfDocumentProxy>;task?:PdfLoadingTask;refs:number;expired:boolean;timer?:number};
/** At most two idle documents; active leases cannot evict one another. No canvas cache. */
export class PdfDocumentPool {
 private entries=new Map<string,Entry>();private retired=new Map<Entry,string>();private closed=false;
 constructor(private load:()=>Promise<PdfApi>,private timers:{set(fn:()=>void,ms:number):number;clear(id:number):void},private limit=2,private ttl=20000){}
 acquire(src:string){
  if(this.closed)throw Error('PDF 阅读器已关闭');
  let entry=this.entries.get(src);
  if(!entry){const current:Entry={refs:0,expired:false,promise:this.load().then(api=>{if(current.expired)throw Error('PDF 加载已取消');current.task=api.getDocument({url:src});return current.task.promise;}).catch((error:unknown)=>{this.drop(src,current);throw error;})};entry=current;this.entries.set(src,current);
  }
  const current=entry;current.refs++;if(current.timer!==undefined)this.timers.clear(current.timer);current.timer=undefined;
  this.entries.delete(src);this.entries.set(src,current);this.trim();let released=false;
  return{document:current.promise,retire:()=>this.retire(src,current),release:()=>{if(released)return;released=true;current.refs--;if(current.refs||current.expired)return;if(this.retired.has(current)){this.drop(src,current);return;}current.timer=this.timers.set(()=>this.drop(src,current),this.ttl);this.trim();}};
 }
 // New attempts must not reuse a timed-out task; existing leases still own it.
 private retire(key:string,entry:Entry){if(entry.expired||this.retired.has(entry))return;if(this.entries.get(key)===entry)this.entries.delete(key);this.retired.set(entry,key);if(!entry.refs)this.drop(key,entry);}
 private trim(){for(const [key,entry]of this.entries){if(this.entries.size<=this.limit)break;if(!entry.refs)this.drop(key,entry);}}
 private drop(key:string,entry:Entry){if(entry.expired)return;entry.expired=true;if(entry.timer!==undefined)this.timers.clear(entry.timer);if(this.entries.get(key)===entry)this.entries.delete(key);this.retired.delete(entry);const task=entry.task;entry.task=undefined;try{void task?.destroy().catch(()=>undefined);}catch{/* Continue releasing other documents when a failed worker throws synchronously. */}}
 clear(){this.closed=true;for(const[key,entry]of this.entries)this.drop(key,entry);for(const[entry,key]of this.retired)this.drop(key,entry);}
}
