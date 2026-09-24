import type {Card} from './model';
/** Placement and paint-only fields are patched in place. Measurement-dependent
 * dimensions and behavior stay keyed because preview callbacks capture nodes. */
export function nodeRenderKey(node:Card,context:readonly unknown[]):string{
 const content:Partial<Card>={...node};delete content.x;delete content.y;
 if(['card','text','image','pdf'].includes(node.kind)){
  for(const field of ['color','fillColor','transparent','textColor','customBorder','borderStyle'] as const)delete content[field];
 }
 // Fixed Markdown previews reflow with CSS and have no auto-fit callbacks.
 // Switching autoFit or any content/behavior still replaces the old renderer.
 if(node.kind==='card'&&!node.autoFit){delete content.width;delete content.height;}
 return JSON.stringify([content,...context]);
}
/** Patch only changed geometry; typing must not restyle every mounted card. */
export function syncNodeGeometry(node:Card,element:HTMLElement,preserveSize=false){
 const style=element.style,values={left:`${node.x}px`,top:`${node.y}px`,...(!preserveSize?{width:`${node.width}px`,height:`${node.height}px`}:{})};
 for(const [key,value]of Object.entries(values))if(style[key as 'left']!==value)style[key as 'left']=value;
}
