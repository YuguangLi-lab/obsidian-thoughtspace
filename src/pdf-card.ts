import type {PdfDocumentPool,PdfDocumentProxy,PdfApi,PdfLoadingTask,PdfPageProxy} from './pdf-document-pool';
import type {Card} from './model';
export const isPdfFile=(path:string)=>/\.pdf$/i.test(path);
export function pdfPage(value=1){if(!Number.isSafeInteger(value)||value<1)throw Error('PDF 页码必须是正整数');return value;}
export const pdfSubpath=(page=1)=>`#page=${pdfPage(page)}`;
/** Only a single vault PDF link is accepted; prose/URLs remain normal text. */
export function pdfDropReference(text:string):{path:string;page:number}|undefined {
 const raw=text.trim();if(/[\r\n]/.test(raw))return;
 const wrapped=/^!?\[\[([^\]]+)\]\]$/.exec(raw),link=(wrapped?wrapped[1].split('|')[0]:raw);
 const match=/^(.+\.pdf)(?:#page=(\d+))?$/i.exec(link);if(!match||/^[a-z]+:\/\//i.test(link))return;
 const page=Number(match[2]||1);if(!Number.isSafeInteger(page)||page<1)return;
 return{path:match[1],page};
}
export function pdfCard(id:string,file:string,x:number,y:number,width=320):Card {
 if(!isPdfFile(file)||/(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(file))throw Error('请选择仓库中的 PDF');
 return{id,kind:'pdf',file,pdfPage:1,x:x-width/2,y:y-70,width,height:400,color:'slate'};
}
/** Bounded canvases; an optional short-lived document pool avoids reparsing on each flip. */
export async function renderPdfThumbnail(options:{host:HTMLElement;src:string;page:number;load:()=>Promise<PdfApi>;register:(dispose:()=>void)=>void;alive:()=>boolean;pool?:PdfDocumentPool;onSize?:(size:{width:number;height:number})=>void}) {
 const {host,src,load,register,alive}=options,requested=pdfPage(options.page);
 let disposed=false,complete=false,timedOut=false,task:PdfLoadingTask|undefined,render:ReturnType<PdfPageProxy['render']>|undefined,canvas:HTMLCanvasElement|undefined,pageResource:PdfPageProxy|undefined;let lease:ReturnType<PdfDocumentPool['acquire']>|undefined;
 const stopped=Symbol('PDF preview cancelled');let stop!:()=>void;
 const cancelled=new Promise<typeof stopped>(resolve=>{stop=()=>resolve(stopped);});
 const destroy=()=>{const shared=lease;lease=undefined;shared?.release();const worker=task;task=undefined;if(worker){try{void worker.destroy().catch(()=>undefined);}catch{/* A failed worker must not block another thumbnail. */}}};
 const releaseCanvas=()=>{const output=canvas;canvas=undefined;if(output){output.width=0;output.height=0;output.remove();}};
 const cancelRender=()=>{const pending=render;render=undefined;try{pending?.cancel();}catch{/* The render may already have finished. */}};
 // PDF.js defers page cleanup while any same-page render is active. Release
 // operator/image resources without discarding the reusable pooled document.
 const releasePage=()=>{const page=pageResource;pageResource=undefined;try{page?.cleanup?.();}catch{/* Optional page cleanup must not strand the canvas or document lease. */}};
 register(()=>{if(disposed)return;disposed=true;stop();cancelRender();releasePage();destroy();releaseCanvas();});
 const live=()=>!disposed&&alive();
 // A thumbnail is optional: cap its entire pipeline, rather than resetting the
 // budget per phase. Do not wait for a worker's cancellation/destroy acknowledgement.
 const win=host.ownerDocument.defaultView||window;let deadline:number|undefined;
 try {
  if(!live())return;
  const budget=new Promise<never>((_,reject)=>{deadline=win.setTimeout(()=>{timedOut=true;reject(Error('PDF 预览超时，请重试或在右侧阅读'));},15000);});
  const wait=<T>(promise:Promise<T>)=>Promise.race([promise,cancelled,budget]);
  let document:PdfDocumentProxy;
  if(options.pool){lease=options.pool.acquire(src);const loaded=await wait(lease.document);if(loaded===stopped||!live())return;document=loaded;}
  else {const pdfjs=await wait(load());if(pdfjs===stopped||!live())return;task=pdfjs.getDocument({url:src});const loaded=await wait(task.promise);if(loaded===stopped||!live())return;document=loaded;}
  if(!live())return;
  const total=document.numPages;if(!Number.isSafeInteger(total)||total<1)throw Error('PDF 页数无效');
  if(requested>total)throw Error(`PDF 共 ${total} 页，请重新选择页码`);
  const page=await wait(document.getPage(requested).then(loaded=>{pageResource=loaded;if(timedOut||!live())releasePage();return loaded;}));if(page===stopped||!live())return;
  const original=page.getViewport({scale:1});
  if(!Number.isFinite(original.width)||!Number.isFinite(original.height)||original.width<=0||original.height<=0)throw Error('PDF 页面尺寸无效');
  const viewport=page.getViewport({scale:Math.min(600/original.width,900/original.height,2)});
  canvas=host.ownerDocument.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`PDF 第 ${requested} 页缩略图`);canvas.setAttribute('role','img');
  const context=canvas.getContext('2d');if(!context)throw Error('无法创建 PDF 缩略图');
  render=page.render({canvasContext:context,viewport});const rendered=await wait(render.promise);if(rendered===stopped||!live())return;render=undefined;
  host.replaceChildren(canvas);options.onSize?.(original);complete=true;return{page:requested,total};
 } catch(error){if(live())throw error;}finally{if(deadline!==undefined)win.clearTimeout(deadline);stop();if(!complete){cancelRender();releaseCanvas();}releasePage();if(timedOut)lease?.retire();destroy();}
}

/** PDF shortcuts only consume paging keys; arrows remain available for node navigation. */
export function pdfPageKey(key:string,current:number,total?:number){
 if(key==='PageUp')return Math.max(1,current-1);
 if(key==='PageDown')return total?Math.min(total,current+1):undefined;
 if(key==='Home')return 1;
 if(key==='End')return total;
 return undefined;
}
