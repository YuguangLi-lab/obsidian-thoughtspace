import type {Card} from './model';
/** Placement and paint-only fields are patched in place. Measurement-dependent
 * dimensions and behavior stay keyed because preview callbacks capture nodes. */
export function nodeRenderKey(node:Card,context:readonly unknown[]):string{
 const content:Record<string,unknown>={},paint=node.kind==='card'||node.kind==='text'||node.kind==='image'||node.kind==='pdf';
 // Fixed Markdown previews reflow with CSS and have no auto-fit callbacks.
 // Switching autoFit or any content/behavior still replaces the old renderer.
 const fixed=node.kind==='card'&&!node.autoFit;
 // Build the final shape directly instead of cloning and deleting 8–10 fields
 // for every mounted card. Own-key order and unknown content fields stay intact.
 for(const key of Object.keys(node)){
  if(key==='x'||key==='y'||fixed&&(key==='width'||key==='height')||paint&&(key==='color'||key==='fillColor'||key==='transparent'||key==='textColor'||key==='customBorder'||key==='borderStyle'))continue;
  const value=node[key as keyof Card];
  if(key==='__proto__')Object.defineProperty(content,key,{value,enumerable:true});else content[key]=value;
 }
 return JSON.stringify([content,...context]);
}
/** Patch only changed geometry; typing must not restyle every mounted card. */
export function syncNodeGeometry(node:Card,element:HTMLElement,preserveSize=false){
 // Called for every mounted node during interaction. Keep scalar comparison
 // local instead of allocating an object and entry arrays for each patch.
 const style=element.style;let value=`${node.x}px`;if(style.left!==value)style.left=value;
 value=`${node.y}px`;if(style.top!==value)style.top=value;
 if(preserveSize)return;
 value=`${node.width}px`;if(style.width!==value)style.width=value;
 value=`${node.height}px`;if(style.height!==value)style.height=value;
}
