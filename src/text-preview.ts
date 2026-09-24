import {type Component,loadMathJax,renderMath,finishRenderMath} from 'obsidian';
import {textMathParts} from './text-math';
import {yingjianTextParts} from './yingjian';
let loading:Promise<void>|undefined;
const mathReady=()=>loading??=(loadMathJax().catch(error=>{loading=undefined;throw error;}));
/** Render formulas with Obsidian's own MathJax while preserving literal whiteboard text and source badges. */
export function renderTextPreview(body:HTMLElement,text:string,scope:Component,onReady?:()=>void,enqueue?:(alive:()=>boolean,run:()=>Promise<void>)=>void):void{
 const parts=textMathParts(text),formulas:{element:HTMLElement;source:string;display:boolean}[]=[];
 const appendText=(value:string)=>{for(const part of yingjianTextParts(value)){
  if(!part.link){body.appendText(part.text);continue;}
  const a=body.createEl('a',{cls:'ts-video-timestamp',text:part.text,href:part.link,attr:{title:'在影笺回看 '+part.text}});
  a.onpointerdown=event=>event.stopPropagation();a.onclick=event=>{event.preventDefault();event.stopPropagation();if(part.link)body.ownerDocument.defaultView?.open(part.link,'_blank','noopener,noreferrer');};
 }};
 for(const part of parts){if(part.kind==='text'){appendText(part.text);continue;}const element=body.createSpan({cls:part.display?'ts-text-math is-display':'ts-text-math',text:part.text});formulas.push({element,source:part.source,display:part.display});}
 body.dataset.mathStatus=formulas.length?'pending':'none';if(!formulas.length)return;
 let disposed=false;scope.register(()=>{disposed=true;});
 const alive=()=>!disposed&&body.isConnected;
 const run=async()=>{if(!alive())return;try{
  await mathReady();if(disposed||!body.isConnected)return;
  const rendered=formulas.map(formula=>renderMath(formula.source,formula.display));
  await finishRenderMath();if(disposed||!body.isConnected)return;for(let index=0;index<formulas.length;index++)formulas[index].element.replaceChildren(rendered[index]);body.dataset.mathStatus='ready';onReady?.();
 }catch{if(disposed||!body.isConnected)return;body.dataset.mathStatus='error';onReady?.();}};
 if(enqueue)enqueue(alive,run);else void run();
}
