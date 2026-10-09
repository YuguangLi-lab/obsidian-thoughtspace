import {FuzzySuggestModal,type App,type WorkspaceLeaf} from 'obsidian';
/** Select a real existing page; cancellation never closes or saves that page. */
export class NativeBoardEditorPicker extends FuzzySuggestModal<WorkspaceLeaf>{
 private completed=false;
 constructor(app:App,private readonly leaves:readonly WorkspaceLeaf[],private readonly source:Document,private readonly done:(leaf?:WorkspaceLeaf)=>void,private readonly current:()=>boolean=()=>true,private readonly failed?:(error:unknown)=>void){super(app);this.setPlaceholder('选择要定位的原生 Markdown 页');}
 onOpen(){if(!this.current()||!this.source.defaultView||this.source.defaultView.closed){this.close();return;}if(this.containerEl.ownerDocument!==this.source)this.source.body.appendChild(this.containerEl);try{void Promise.resolve(super.onOpen()).catch(error=>{this.close();this.failed?.(error);});}catch(error){this.close();this.failed?.(error);}}
 getItems(){return [...this.leaves];}
 getItemText(leaf:WorkspaceLeaf){const index=this.leaves.indexOf(leaf)+1,path=leaf.getViewState().state?.file;return `原生页 ${index} · ${leaf.getContainer().doc===this.source?'当前窗口':'其他窗口'} · ${typeof path==='string'?path:''}`;}
 onChooseItem(leaf:WorkspaceLeaf){if(this.completed)return;this.completed=true;this.done(leaf);}
 onClose(){super.onClose();queueMicrotask(()=>{if(!this.completed){this.completed=true;this.done();}});}
}
