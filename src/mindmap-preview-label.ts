import type {Card} from './model';
import {topicLabel} from './mindmap-editor';
import {textFontFamily} from './text-tools';
/** Match canvas text wrapping without estimating a character count or dropping later lines. */
export function updateTopicPreviewLabel(label:SVGForeignObjectElement,node:Card){
 for(const key of ['x','y','width','height'] as const)label.setAttribute(key,String(node[key]));
 label.setAttribute('pointer-events','none');let body=label.firstElementChild as HTMLElement|null;
 if(!body){body=label.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml','div');label.append(body);}
 Object.assign(body.style,{boxSizing:'border-box',width:'100%',height:'100%',padding:'14px 16px',border:`${node.borderWidth??1}px solid transparent`,fontFamily:textFontFamily(node.fontFamily),fontSize:`${node.fontSize||16}px`,fontWeight:node.topic?'500':'400',lineHeight:'1.7',letterSpacing:'normal',whiteSpace:'pre-wrap',overflowWrap:'anywhere',overflow:'hidden',color:'var(--text-normal)',textAlign:node.textAlign||'left'});
 body.textContent=topicLabel(node);
}
export function createTopicPreviewLabel(svg:SVGElement,node:Card){const label=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','foreignObject');label.dataset.topicLabel=node.id;updateTopicPreviewLabel(label,node);svg.append(label);return label;}
