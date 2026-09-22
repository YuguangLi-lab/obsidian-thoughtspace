import type {PdfDocumentPool,PdfDocumentProxy} from './pdf-document-pool';
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
export async function renderPdfThumbnail(options:{host:HTMLElement;src:string;page:number;load:()=>Promise<any>;register:(dispose:()=>void)=>void;alive:()=>boolean;pool?:PdfDocumentPool;onSize?:(size:{width:number;height:number})=>void}) {
 const {host,src,load,register,alive}=options,requested=pdfPage(options.page);
 let disposed=false,task:any,render:any,canvas:HTMLCanvasElement|undefined,destroyed=false;let lease:ReturnType<PdfDocumentPool['acquire']>|undefined;
 const destroy=async()=>{lease?.release();if(task&&!destroyed){destroyed=true;try{await task.destroy();}catch{/* Cancellation can race a failed worker. */}}};
 register(()=>{disposed=true;try{render?.cancel();}catch{}void destroy();if(canvas){canvas.width=0;canvas.height=0;canvas.remove();}});
 const live=()=>!disposed&&alive();
 try {
  let document:PdfDocumentProxy;
  if(options.pool){lease=options.pool.acquire(src);document=await lease.document;}
  else {const pdfjs=await load();if(!live())return;task=pdfjs.getDocument({url:src});document=await task.promise;}
  if(!live())return;
  const total=document.numPages;if(!Number.isSafeInteger(total)||total<1)throw Error('PDF 页数无效');
  if(requested>total)throw Error(`PDF 共 ${total} 页，请重新选择页码`);
  const page=await document.getPage(requested);if(!live())return;
  const original=page.getViewport({scale:1});
  if(!Number.isFinite(original.width)||!Number.isFinite(original.height)||original.width<=0||original.height<=0)throw Error('PDF 页面尺寸无效');
  const viewport=page.getViewport({scale:Math.min(600/original.width,900/original.height,2)});
  canvas=host.ownerDocument.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`PDF 第 ${requested} 页缩略图`);canvas.setAttribute('role','img');
  const context=canvas.getContext('2d');if(!context)throw Error('无法创建 PDF 缩略图');
  render=page.render({canvasContext:context,viewport});await render.promise;if(!live())return;
  host.replaceChildren(canvas);options.onSize?.(original);return{page:requested,total};
 } catch(error){if(live())throw error;}finally{await destroy();}
}

/** PDF shortcuts only consume paging keys; arrows remain available for node navigation. */
export function pdfPageKey(key:string,current:number,total?:number){
 if(key==='PageUp')return Math.max(1,current-1);
 if(key==='PageDown')return total?Math.min(total,current+1):undefined;
 if(key==='Home')return 1;
 if(key==='End')return total;
 return undefined;
}
