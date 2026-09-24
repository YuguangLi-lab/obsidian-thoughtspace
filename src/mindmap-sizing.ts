import type {Card} from './model';
/** Fallback size before a DOM is available. The gallery measures again using the actual font. */
export function sizeTemplateTopic(node:Card){
 if(node.kind!=='text')return;node.autoSize=true;node.textMaxWidth=node.fontSize===24?360:280;
 // Keep a folded preview at its fixed height; it is measured after reopening.
 if(node.collapsed)return;
 const font=node.fontSize||16,max=node.textMaxWidth,padding=34,lines=(node.text||'').split('\n').map(line=>[...line].reduce((w,c)=>w+(c.charCodeAt(0)<=127?.62:1)*font,0));
 node.width=Math.ceil(Math.max(80,Math.min(max,Math.max(0,...lines)+padding)));node.height=Math.ceil(Math.max(60,lines.reduce((n,w)=>n+Math.max(1,Math.ceil(w/(node.width-padding))),0)*font*1.7+30));
}
