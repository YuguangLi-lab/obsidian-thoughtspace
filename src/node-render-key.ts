import type {Card} from './model';
interface LongTextKey {text:string;stamp:string;key:string;size:number}
// Weak ownership avoids retaining old board/undo objects. A generation is also
// bounded: offscreen nodes can remain alive in a large board long after rendering.
let longTextKeys=new WeakMap<Card,LongTextKey>(),longTextCount=0,longTextSize=0;
const maxLongTextKeys=128,maxLongTextSize=16*1024*1024;
const scalar=(value:unknown)=>value===null||typeof value!=='object'&&typeof value!=='function';
function forgetLongText(node:Card){
 const cached=longTextKeys.get(node);if(!cached)return;
 longTextCount--;longTextSize-=cached.size;longTextKeys.delete(node);
}
/** Placement and paint-only fields are patched in place. Measurement-dependent
 * dimensions and behavior stay keyed because preview callbacks capture nodes. */
export function nodeRenderKey(node:Card,context:readonly unknown[]):string{
 const content:Record<string,unknown>={},paint=node.kind==='card'||node.kind==='text'||node.kind==='image'||node.kind==='pdf'||node.kind==='audio'||node.kind==='video';
 // Fixed Markdown previews and native players reflow with CSS. Dimensions and
 // fixed-note surface styles do not invalidate content or its reading position.
 // Auto-fit notes keep surface styles keyed so their header is measured again.
 // Switching autoFit or any content/behavior still replaces the old renderer.
 const fixed=!!node.webUrl||node.kind==='card'&&!node.autoFit||node.kind==='audio'||node.kind==='video';
 // Build the final shape directly instead of cloning and deleting 8–10 fields
 // for every mounted card. Own-key order and unknown content fields stay intact.
 for(const key of Object.keys(node)){
  if(key==='x'||key==='y'||fixed&&(key==='width'||key==='height'||node.kind==='card'&&key==='cardStyle')||paint&&(key==='color'||key==='fillColor'||key==='transparent'||key==='textColor'||key==='customBorder'||key==='borderStyle'))continue;
  const value=node[key as keyof Card];
  if(key==='__proto__')Object.defineProperty(content,key,{value,enumerable:true});else content[key]=value;
 }
 const text=content.text,payload=[content,...context];
 if(typeof text!=='string'||text.length<4096||!Object.values(content).every(scalar)||!payload.every((value,index)=>index===0||scalar(value))){
  // Complex fields may own getters/toJSON with observable call counts. Keep
  // their exact single-pass JSON semantics instead of inspecting them twice.
  forgetLongText(node);return JSON.stringify(payload);
 }
 // Keep the text property's position in the stamp, preserving own-key ordering
 // and the existing JSON key format even for unknown fields and replacements.
 content.text='';const stamp=JSON.stringify(payload);let cached=longTextKeys.get(node);
 if(cached?.text===text&&cached.stamp===stamp)return cached.key;
 content.text=text;const key=JSON.stringify(payload),size=stamp.length+key.length;
 if(size>maxLongTextSize){forgetLongText(node);return key;}
 if(!cached&&longTextCount>=maxLongTextKeys||longTextSize-(cached?.size||0)+size>maxLongTextSize){
  longTextKeys=new WeakMap();longTextCount=0;longTextSize=0;cached=undefined;
 }
 longTextCount+=cached?0:1;longTextSize+=size-(cached?.size||0);
 longTextKeys.set(node,{text,stamp,key,size});return key;
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
