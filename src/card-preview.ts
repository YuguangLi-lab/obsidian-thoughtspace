import {type App,type TFile,Component,MarkdownRenderer} from 'obsidian';
import {releaseEditorResource} from './editor-cleanup';
import {excerptPresentation,type ExcerptSource} from './excerpt-sources';
import {markdownPreview} from './rendering';

interface CardPreviewOptions {
 app:App;file:TFile;preview:HTMLElement;scope:Component;
 enqueue:(alive:()=>boolean,run:()=>Promise<void>)=>void;
 sources:(sources:ExcerptSource[])=>void;ready:()=>void;error:()=>void;
}
const generations=new WeakMap<HTMLElement,{stop:()=>void}>();
/** A detached or stalled note preview must release its shared rendering slot. */
export function renderCardPreview({app,file,preview,scope,enqueue,sources,ready,error}:CardPreviewOptions){
 generations.get(preview)?.stop();
 const win=preview.ownerDocument.win as Window&{createDiv:typeof createDiv};let disposed=false,close!:()=>void,renderScope:Component|undefined,output:HTMLElement|undefined;
 const cancelled=new Promise<undefined>(resolve=>{close=()=>resolve(undefined);});
 const release=()=>{const element=output;output=undefined;element?.remove();const child=renderScope;renderScope=undefined;if(child)releaseEditorResource('card preview renderer',()=>scope.removeChild(child));};
 const generation={stop:()=>{if(disposed)return;disposed=true;close();release();}};
 generations.set(preview,generation);scope.register(generation.stop);
 const alive=()=>!disposed&&preview.isConnected&&generations.get(preview)===generation;
 const finishLoading=()=>{preview.classList.remove('ts-preview-pending');preview.removeAttribute('aria-label');preview.setAttribute('aria-busy','false');};
 enqueue(alive,async()=>{
  if(!alive())return;let deadline:number|undefined,complete=false;
  try{
   const budget=new Promise<never>((_,reject)=>{deadline=win.setTimeout(()=>reject(Error('Card preview timed out')),5000);});
   const content=await Promise.race([app.vault.cachedRead(file),cancelled,budget]);if(!alive()||content===undefined)return;
   const presentation=excerptPresentation(content);if(presentation.sources.length)sources(presentation.sources);
   if(!alive())return;
   // Mermaid and other native processors need an attached target to finish before
   // sizing. Keep their own root (including overflow/dir/listeners) after success;
   // cancellation detaches only that generation's output before any late writes.
   const rendered=output=win.createDiv();rendered.className='ts-card-preview-content markdown-rendered';preview.replaceChildren(rendered);
   const child=renderScope=new Component();scope.addChild(child);
   await Promise.race([MarkdownRenderer.render(app,markdownPreview(presentation.body),rendered,file.path,child),cancelled,budget]);if(!alive())return;
   rendered.querySelectorAll('input').forEach(input=>{input.disabled=true;});
   rendered.querySelectorAll('p').forEach(p=>{if(Array.from(p.childNodes).every(node=>node.nodeType===3?!node.textContent?.trim():node.nodeType===1&&(node as Element).matches('a.tag')))p.remove();});
   finishLoading();complete=true;ready();
  }catch{release();if(alive())error();}
  finally{
   if(deadline!==undefined)win.clearTimeout(deadline);
   if(!complete)release();
   if(!complete&&alive())finishLoading();
  }
 });
}
