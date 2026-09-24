import {yingjianTextParts} from './yingjian';
import {textExcerptPresentation} from './excerpt-sources';
import { Card, Color, colors, colorNames } from './model';
export type TextInk = 'default' | Color;
export const textInks: TextInk[] = ['default', ...colors];
export const inkLabels: Record<TextInk, string> = {...colorNames,default:'跟随主题',sand:'琥珀',blue:'海蓝',green:'森林',rose:'莓红',purple:'紫罗兰'};
export const textFontFamily=(family:Card['fontFamily'],fallback='var(--font-text)',monospace='var(--font-monospace)')=>family==='serif'?'Georgia, "Songti SC", serif':family==='mono'?monospace:fallback;
/** 在未缩放的 DOM 中测量，与实际文本的字体、换行和内边距保持一致。 */
export function fitTextNode(node: Card, host: HTMLElement, renderedBody?:HTMLElement): void {
  if (node.kind !== 'text' || node.collapsed) return;
  const doc=host.ownerDocument;const probe = doc.createElement('div');
  const fontSize = node.fontSize || 16;
  Object.assign(probe.style, {position:'fixed',left:'-100000px',top:'0',visibility:'hidden',pointerEvents:'none',
    boxSizing:'border-box',fontFamily:textFontFamily(node.fontFamily,getComputedStyle(host).getPropertyValue('--font-text')||getComputedStyle(host).fontFamily,getComputedStyle(host).getPropertyValue('--font-monospace')||'monospace'),fontSize:`${fontSize}px`,fontWeight:node.topic?'500':'400',
    lineHeight:'1.7',letterSpacing:'normal',whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'14px 16px',border:`${node.borderWidth??1}px solid transparent`,
    width:node.autoSize===false?`${node.width}px`:'max-content',maxWidth:node.autoSize===false?'none':`${node.textMaxWidth||520}px`,minWidth:'80px',minHeight:'60px'});
  const presentation=textExcerptPresentation(node.text||''),text=presentation.sources.length?presentation.body.trimEnd():presentation.body;
  const sourceSlot=()=>{const source=probe.appendChild(doc.createElement('span'));Object.assign(source.style,{display:'inline-block',boxSizing:'border-box',width:'20px',minWidth:'20px',maxWidth:'20px',height:'20px',marginLeft:'5px',verticalAlign:'-3px'});};
  const rendered=renderedBody?.dataset.mathStatus==='ready';
  if(rendered){const actual=getComputedStyle(renderedBody);for(const key of ['paddingTop','paddingRight','paddingBottom','paddingLeft','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'] as const)if(actual[key])probe.style[key]=actual[key];for(const child of Array.from(renderedBody.childNodes)){if(child.nodeType===1&&(child as Element).classList.contains('ts-source-trigger'))sourceSlot();else probe.appendChild(child.cloneNode(true));}if(text.endsWith('\n'))probe.appendChild(doc.createTextNode('\u200b'));}
  else probe.textContent = yingjianTextParts(text).map(p=>p.text).join('') + (text.endsWith('\n') ? '\u200b' : '');
  if(!rendered&&presentation.sources.length){probe.appendChild(doc.createTextNode('\u2060'));sourceSlot();}
  doc.body.appendChild(probe);
  try {const rect=probe.getBoundingClientRect();node.width=Math.ceil(rect.width);node.height=Math.ceil(rect.height);}
  finally {probe.remove();}
  node.autoSize ??= true;
}
