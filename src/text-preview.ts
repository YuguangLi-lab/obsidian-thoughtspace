import {type App,type Component,MarkdownRenderer,finishRenderMath} from 'obsidian';
import {releaseEditorResource} from './editor-cleanup';
import {PreviewRenderScope} from './preview-render-scope';
import {parseYingjianLink} from './yingjian';

export interface TextPreviewContext {app:App;sourcePath:string;}
const generations=new WeakMap<HTMLElement,{stop:()=>void}>();
/** Use the same Markdown renderer as native notes; commit only this preview's owned content. */
export function renderTextPreview(body:HTMLElement,text:string,scope:Component,onReady:(()=>void)|undefined,enqueue:((alive:()=>boolean,run:()=>Promise<void>)=>void)|undefined,context:TextPreviewContext):void{
 // The source control belongs to the board, not the native renderer being unloaded.
 const previousSource=body.querySelector<HTMLElement>(':scope > .ts-text-markdown')?.querySelector<HTMLElement>('.ts-source-trigger');
 if(previousSource){const spacer=previousSource.previousSibling;if(spacer?.nodeType===3&&spacer.textContent==='\u2060')body.appendChild(spacer);body.appendChild(previousSource);}
 generations.get(body)?.stop();
 const doc=body.ownerDocument,win=doc.win as Window&{createDiv:typeof createDiv};let disposed=false,close!:()=>void,renderScope:Component|undefined,rendered:HTMLElement|undefined,complete=false;
 const cancelled=new Promise<void>(resolve=>{close=resolve;});
 const output=win.createDiv();output.className='ts-text-markdown markdown-rendered';output.textContent=text;
 const release=()=>{const element=rendered;rendered=undefined;if(!complete&&element?.parentElement===body)element.replaceWith(output);const child=renderScope;renderScope=undefined;if(child)releaseEditorResource('text preview renderer',()=>scope.removeChild(child));};
 const generation={stop:()=>{if(disposed)return;disposed=true;close();release();}};generations.set(body,generation);scope.register(generation.stop);
 const previous=body.querySelector<HTMLElement>(':scope > .ts-text-markdown');
 if(previous)previous.replaceWith(output);else body.appendChild(output);
 body.classList.add('markdown-rendered');body.dataset.markdownStatus='pending';body.dataset.mathStatus='pending';body.setAttribute('aria-busy','true');
 const alive=()=>!disposed&&body.isConnected&&generations.get(body)===generation;
 const notify=()=>{if(alive())onReady?.();};
 const run=async()=>{if(!alive())return;let deadline:number|undefined;
  try{
   // Native processors can wait for an attached target. Retain that exact root on
   // success; on cancellation/failure detach it and restore this generation's source.
   const native=rendered=win.createDiv();native.className=output.className;output.replaceWith(native);
   const child=renderScope=new PreviewRenderScope();scope.addChild(child);
   // A stuck third-party postprocessor must not retain the shared preview queue slot.
   const budget=new Promise<never>((_,reject)=>{deadline=win.setTimeout(()=>reject(new Error('Text preview timed out')),5000);});
   await Promise.race([MarkdownRenderer.render(context.app,text,native,context.sourcePath,child),cancelled,budget]);if(!alive())return;
   if(native.querySelector('.math')||native.querySelector('mjx-container'))await Promise.race([finishRenderMath(),cancelled,budget]);if(!alive())return;
   // Markdown previews are read-only. Editing is handled by the board's native editor.
   native.querySelectorAll<HTMLInputElement>('input').forEach(input=>{input.disabled=true;});
   for(const link of Array.from(native.querySelectorAll<HTMLAnchorElement>('a[href]'))){
    const href=link.getAttribute('href')||'';if(!parseYingjianLink(href))continue;
    link.classList.add('ts-video-timestamp');link.title='在影笺回看 '+(link.textContent||'此片段');
    const pointer=(event:PointerEvent)=>event.stopPropagation(),click=(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();if(alive())doc.defaultView?.open(href,'_blank','noopener,noreferrer');};
    link.addEventListener('pointerdown',pointer);link.addEventListener('click',click);child.register(()=>{link.removeEventListener('pointerdown',pointer);link.removeEventListener('click',click);});
   }
   // Root appends its source control immediately after starting render. Keep the actual
   // control (and its listeners), moving it after the final paragraph instead of cloning it.
   const source=body.querySelector<HTMLElement>(':scope > .ts-source-trigger'),last=native.lastElementChild;
   if(source&&last?.matches('p')){const spacer=source.previousSibling;if(spacer?.nodeType===3&&spacer.textContent==='\u2060')last.appendChild(spacer);last.appendChild(source);}
   body.dataset.markdownStatus='ready';body.dataset.mathStatus='ready';body.setAttribute('aria-busy','false');
   for(const image of Array.from(native.querySelectorAll<HTMLImageElement>('img'))){if(image.complete)continue;image.addEventListener('load',notify,{once:true});image.addEventListener('error',notify,{once:true});child.register(()=>{image.removeEventListener('load',notify);image.removeEventListener('error',notify);});}
   const fonts=doc.fonts;if(fonts&&fonts.status==='loading')void fonts.ready.then(notify,()=>{});
   complete=true;notify();
  }catch{release();if(!alive())return;body.dataset.markdownStatus='error';body.dataset.mathStatus='error';body.setAttribute('aria-busy','false');notify();}
  finally{close();if(deadline!==undefined)win.clearTimeout(deadline);if(!complete)release();}
 };
 if(enqueue)enqueue(alive,run);else void run();
}
