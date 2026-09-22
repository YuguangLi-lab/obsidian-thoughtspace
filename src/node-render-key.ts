import type {Card} from './model';
/** Coordinates affect placement, not rendered Markdown or node event handlers. */
export function nodeRenderKey(node:Card,context:readonly unknown[]):string{const {x,y,...content}=node;return JSON.stringify([content,...context]);}
/** Patch only changed geometry; typing must not restyle every mounted card. */
export function syncNodeGeometry(node:Card,element:HTMLElement,preserveSize=false){
 const style=element.style,values={left:`${node.x}px`,top:`${node.y}px`,...(!preserveSize?{width:`${node.width}px`,height:`${node.height}px`}:{})};
 for(const [key,value]of Object.entries(values))if(style[key as 'left']!==value)style[key as 'left']=value;
}
