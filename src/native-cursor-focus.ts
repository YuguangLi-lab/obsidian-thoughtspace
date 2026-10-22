/** Narrow compatibility guard for the owned embedded editor's native cursor
 * association measurement. Obsidian 1.14.4 can run this measurement after blur;
 * its DOM Selection.collapse/modify then focuses the editing body again.
 * Keep this measurement inside its actual focus owner without changing the
 * logical selection, explicit focus commands, or any other native method. */
interface CursorFocusOwner {
 readonly contentDOM:HTMLElement;
 readonly root:DocumentOrShadowRoot;
 readonly hasFocus:boolean;
}
function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object';}
export function protectNativeCursorAssociation(view:CursorFocusOwner):()=>void {
 const content=view.contentDOM,docView:unknown=Reflect.get(view,'docView');
 if(!record(docView)||docView.view!==view||typeof docView.enforceCursorAssoc!=='function')throw Error('Native cursor association boundary unavailable');
 const original=docView.enforceCursorAssoc,descriptor=Object.getOwnPropertyDescriptor(docView,'enforceCursorAssoc');
 if(descriptor&&(!descriptor.configurable||!('value' in descriptor)||descriptor.value!==original))throw Error('Native cursor association boundary is not independently owned');
 let active=true;
 const guarded=function(this:unknown,...args:unknown[]):unknown {
  if(!active||this!==docView||docView.view!==view||Reflect.get(view,'docView')!==docView||view.contentDOM!==content||!content.isConnected||view.root.activeElement!==content||!view.hasFocus)return;
  // A leaf can be adopted into another window before CM.setRoot catches up.
  // Keep the exact editor identity, but validate its current DOM ownership.
  const document=content.ownerDocument,root=content.getRootNode();
  if(!Object.is(view.root,root)||(root!==document&&root.ownerDocument!==document))return;
  return Reflect.apply(original,docView,args);
 };
 Object.defineProperty(docView,'enforceCursorAssoc',{value:guarded,writable:true,configurable:true,enumerable:descriptor?.enumerable??false});
 return()=>{if(!active)return;active=false;
  // Do not remove another adapter's later replacement or modify a prototype.
  if(Object.getOwnPropertyDescriptor(docView,'enforceCursorAssoc')?.value!==guarded)return;
  if(descriptor)Object.defineProperty(docView,'enforceCursorAssoc',descriptor);else delete docView.enforceCursorAssoc;
 };
}
