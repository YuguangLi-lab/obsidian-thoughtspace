import {App,Component,MarkdownView,Notice,TFile,View,WorkspaceLeaf,type WorkspaceItem} from 'obsidian';

/** Expand only the native sidebar which actually owns this leaf. Public parent
 * identities also keep popout returns from opening an unrelated main sidebar. */
export function expandLocalRelationPane(app:App,leaf:WorkspaceLeaf):void {
 const seen=new Set<WorkspaceItem>(),sides=[app.workspace.leftSplit,app.workspace.rightSplit];
 for(let parent:WorkspaceItem|undefined=leaf.parent;parent&&!seen.has(parent);parent=parent.parent){
  seen.add(parent);for(const side of sides)if(parent===side){if(side.collapsed)side.expand();return;}
 }
}

const returnLabel='返回脑图（原生自动保存，不关闭笔记）';
interface ReturnRequest {cancelled:boolean;}
interface EditorReturnBinding {
 graph:View;graphLeaf:WorkspaceLeaf;leaf:WorkspaceLeaf;editor:MarkdownView;file:TFile;path:string;
 doc:Document;win:Window;context:()=>boolean;action?:HTMLElement;removeKeydown?:()=>void;pending?:ReturnRequest;
}

/** A return action on a real native file view, never an embedded editor or draft.
 * Add this component as a plugin child before attaching editing sessions. */
export class LocalRelationsEditorReturn extends Component {
 private alive=false;private bindings=new Set<EditorReturnBinding>();
 constructor(private app:App){super();}
 onload(){
  this.alive=true;
  this.registerEvent(this.app.workspace.on('file-open',()=>this.prune()));
  this.registerEvent(this.app.workspace.on('layout-change',()=>this.prune()));
  this.registerEvent(this.app.workspace.on('active-leaf-change',()=>{
   this.prune();const active=this.app.workspace.getActiveViewOfType(View);
   // A temporary visit to a third page also invalidates the pending return.
   for(const binding of this.bindings)if(binding.pending&&active!==binding.editor&&active!==binding.graph)binding.pending.cancelled=true;
  }));
  this.registerEvent(this.app.vault.on('rename',()=>this.prune()));
  this.registerEvent(this.app.vault.on('delete',()=>this.prune()));
 }
 onunload(){this.alive=false;for(const binding of [...this.bindings])this.remove(binding);}
 attach(graph:View,editorLeaf:WorkspaceLeaf,file:TFile,context:()=>boolean):HTMLElement|undefined {
  this.prune();const editor=editorLeaf.view,doc=graph.containerEl.ownerDocument,win=doc.defaultView;
  if(!this.alive||!(editor instanceof MarkdownView)||!win||editor===graph)return;
  const candidate:EditorReturnBinding={graph,graphLeaf:graph.leaf,leaf:editorLeaf,editor,file,path:file.path,doc,win,context};
  if(!this.valid(candidate))return;
  for(const binding of [...this.bindings]){
   if(binding.graph===graph&&binding.leaf===editorLeaf&&binding.editor===editor&&binding.file===file){
    // A fresh request owns the context, while repeated attachment reuses native chrome.
    if(binding.pending)binding.pending.cancelled=true;
    binding.context=context;return binding.action;
   }
   if(binding.graph===graph||binding.leaf===editorLeaf)this.remove(binding);
  }
  this.bindings.add(candidate);
  try{
   const action=editor.addAction('network',returnLabel,()=>{void this.returnToGraph(candidate);});candidate.action=action;
   action.setAttribute('data-relation-editor-return','');action.setAttribute('aria-label',returnLabel);action.setAttribute('role','button');action.tabIndex=0;
   action.setAttribute('aria-disabled','false');action.setAttribute('aria-busy','false');
   const keydown=(event:KeyboardEvent)=>{
    if(event.defaultPrevented||event.isComposing||Reflect.get(event,'keyCode')===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['Enter',' '].includes(event.key))return;
    event.preventDefault();event.stopPropagation();if(!event.repeat)void this.returnToGraph(candidate);
   };
   action.addEventListener('keydown',keydown,true);candidate.removeKeydown=()=>action.removeEventListener('keydown',keydown,true);
   if(!this.valid(candidate)){this.remove(candidate);return;}return action;
  }catch(error){this.remove(candidate);throw error;}
 }
 /** Call after a host context change that does not emit a workspace event. */
 prune(){for(const binding of [...this.bindings])if(!this.valid(binding))this.remove(binding);}
 private valid(binding:EditorReturnBinding){
  const {graph,graphLeaf,leaf,editor,file,path,doc,win,action}=binding;
  if(!this.alive||graph.leaf!==graphLeaf||graphLeaf.view!==graph||graphLeaf.isDeferred||leaf.view!==editor||leaf.isDeferred||editor.file!==file||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file||!graph.containerEl.isConnected||!editor.containerEl.isConnected||graph.containerEl.ownerDocument!==doc||editor.containerEl.ownerDocument!==doc||doc.defaultView!==win||win.closed||action&&(!action.isConnected||action.ownerDocument!==doc))return false;
  try{return binding.context();}catch{return false;}
 }
 private remove(binding:EditorReturnBinding){
  this.bindings.delete(binding);if(binding.pending)binding.pending.cancelled=true;
  binding.removeKeydown?.();binding.removeKeydown=undefined;binding.action?.remove();
 }
 private async returnToGraph(binding:EditorReturnBinding){
  if(!this.bindings.has(binding)||!this.valid(binding)){this.remove(binding);return;}
  const active=this.app.workspace.getActiveViewOfType(View);if(binding.pending||active!==binding.editor&&active!==binding.graph)return;
  const request:ReturnRequest={cancelled:false};binding.pending=request;
  const current=()=>!request.cancelled&&binding.pending===request&&this.bindings.has(binding)&&this.valid(binding);
  const action=binding.action!;action.setAttribute('aria-disabled','true');action.setAttribute('aria-busy','true');
  try{
   // Coalesce activation from the native action and its keyboard handler. The
   // captured graph is already loaded: revealLeaf could asynchronously foreground
   // it after the user has moved elsewhere, and exposes no cancellation API.
   await Promise.resolve();
   if(!current())return;const latest=this.app.workspace.getActiveViewOfType(View);
   if(latest!==binding.editor&&latest!==binding.graph)return;
   expandLocalRelationPane(this.app,binding.graphLeaf);
   if(!current())return;const expandedActive=this.app.workspace.getActiveViewOfType(View);
   if(expandedActive!==binding.editor&&expandedActive!==binding.graph)return;
   this.app.workspace.setActiveLeaf(binding.graphLeaf,{focus:true});
  }catch(error){if(current())new Notice('无法返回脑图：'+String(error));}
  finally{
   if(binding.pending===request)binding.pending=undefined;
   if(this.bindings.has(binding)&&this.valid(binding)){action.setAttribute('aria-disabled','false');action.setAttribute('aria-busy','false');}else this.remove(binding);
  }
 }
}
