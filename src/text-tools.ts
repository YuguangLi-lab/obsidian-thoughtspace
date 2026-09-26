import {yingjianTextParts} from './yingjian';
import {textExcerptPresentation} from './excerpt-sources';
import { Card, Color, colors, colorNames } from './model';
export type TextInk = 'default' | Color;
export const textInks: TextInk[] = ['default', ...colors];
export const inkLabels: Record<TextInk, string> = {...colorNames,default:'跟随主题',sand:'琥珀',blue:'海蓝',green:'森林',rose:'莓红',purple:'紫罗兰'};
export const textFontFamily=(family:Card['fontFamily'],fallback='var(--font-text)',monospace='var(--font-monospace)')=>family==='serif'?'Georgia, "Songti SC", serif':family==='mono'?monospace:fallback;
/** Explicit one-shot fit, also used at creation before automatic fitting is enabled.
 * Measure unscaled Markdown in the same CSS context, including late math/images and source badges. */
export function fitTextNode(node: Card, host: HTMLElement, renderedBody?:HTMLElement): void {
 if(node.kind!=='text'||node.collapsed)return;
 // A pending render must not overwrite an already rendered size with raw Markdown metrics.
 if(renderedBody?.dataset.markdownStatus==='pending')return;
 const doc=host.ownerDocument,win=doc.win as Window&{createDiv:typeof createDiv;createSpan:typeof createSpan},view=doc.defaultView,styleOf=(element:Element)=>view?.getComputedStyle(element)||getComputedStyle(element),hostStyle=styleOf(host);
 const context=win.createDiv();context.className='ts-root ts-text-fit-context';
 Object.assign(context.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',pointerEvents:'none',display:'block',width:'max-content',height:'auto',minWidth:'0',minHeight:'0',transform:'none',contain:'layout style'});
 // Theme and user font variables may be scoped to this view, not the document body.
 for(let i=0;i<hostStyle.length;i++){const key=hostStyle[i];if(key.startsWith('--'))context.style.setProperty(key,hostStyle.getPropertyValue(key));}
 const frame=win.createDiv();frame.className='ts-text ts-text-fit-probe'+(node.topic?' ts-topic':'');
 const rendered=renderedBody?.dataset.markdownStatus==='ready'||renderedBody?.dataset.mathStatus==='ready';
 const probe=rendered?renderedBody.cloneNode(true) as HTMLElement:win.createDiv();if(!rendered)probe.className='ts-text-body';
 const manual=node.textAutoHeight===true||node.autoSize===false,fontSize=node.fontSize||16;
 Object.assign(frame.style,{position:'relative',display:'block',boxSizing:'border-box',width:manual?`${node.width}px`:'max-content',maxWidth:manual?'none':`${node.textMaxWidth||520}px`,minWidth:manual?'0':'80px',minHeight:'60px',height:'auto',border:`${node.borderWidth??1}px solid transparent`,transform:'none',overflow:'visible'});
 Object.assign(probe.style,{position:'static',display:'block',boxSizing:'border-box',width:'auto',maxWidth:'none',height:'auto',minHeight:'0',minWidth:'0',flex:'none',overflow:'visible',fontFamily:textFontFamily(node.fontFamily,hostStyle.getPropertyValue('--font-text')||hostStyle.fontFamily,hostStyle.getPropertyValue('--font-monospace')||'monospace'),fontSize:`${fontSize}px`,fontWeight:node.topic?'500':'400',lineHeight:'1.7',letterSpacing:'normal',whiteSpace:rendered?'normal':'pre-wrap',overflowWrap:'anywhere',padding:'14px 16px'});
 const presentation=textExcerptPresentation(node.text||''),text=presentation.sources.length?presentation.body.trimEnd():presentation.body;
 const sourceSlot=()=>{const source=win.createSpan();Object.assign(source.style,{display:'inline-block',boxSizing:'border-box',width:'20px',minWidth:'20px',maxWidth:'20px',height:'20px',marginLeft:'5px',verticalAlign:'-3px'});return source;};
 if(rendered){
  const actual=styleOf(renderedBody);for(const key of ['paddingTop','paddingRight','paddingBottom','paddingLeft','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign'] as const)if(actual[key])probe.style[key]=actual[key];
  // Clones must not duplicate MathJax/Markdown IDs or retain a popover's extra content.
  probe.removeAttribute('id');for(const element of Array.from(probe.querySelectorAll('[id]')))element.removeAttribute('id');
  const sources=Array.from(probe.querySelectorAll('.ts-source-trigger'));for(const source of sources)source.replaceWith(sourceSlot());
  if(presentation.sources.length&&!sources.length){const content=probe.querySelector('.ts-text-markdown'),last=content?.lastElementChild,target=last?.matches('p')?last:probe;target.appendChild(doc.createTextNode('\u2060'));target.appendChild(sourceSlot());}
  for(const popover of Array.from(probe.querySelectorAll('.ts-source-popover')))popover.remove();
 }else{probe.textContent=yingjianTextParts(text).map(p=>p.text).join('')+(text.endsWith('\n')?'\u200b':'');if(presentation.sources.length){probe.appendChild(doc.createTextNode('\u2060'));probe.appendChild(sourceSlot());}}
 frame.appendChild(probe);context.appendChild(frame);doc.body.appendChild(context);
 try{const rect=frame.getBoundingClientRect();if(Number.isFinite(rect.width)&&Number.isFinite(rect.height)&&rect.width>0&&rect.height>0){if(!manual)node.width=Math.ceil(rect.width);node.height=Math.ceil(rect.height);node.autoSize??=true;}}
 finally{context.remove();}
}
