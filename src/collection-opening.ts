import type {Workspace,WorkspaceLeaf} from 'obsidian';
import {SerialOpen} from './view-opening';

export type CollectionPlacement='page'|'sidebar';

/** The existing view owns drafts; this helper only chooses and opens a leaf. */
export class CollectionOpener {
 private readonly opening={page:new Map<Document,{current:()=>boolean;work:Promise<void>}>(),sidebar:new Map<Document,{current:()=>boolean;work:Promise<void>}>()};
 private readonly allocations=new SerialOpen<'collection',void>();
 private readonly watches=new Set<()=>void>();
 private stopped=false;
 constructor(private readonly workspace:Workspace,private readonly viewType:string,private readonly recoverableSession:()=>Promise<string|undefined>){}
 dispose(){this.stopped=true;for(const stop of this.watches)stop();}
 open(placement:CollectionPlacement='page'):Promise<void>{
  if(this.stopped)return Promise.resolve();
  const workspace=this.workspace,source=workspace.activeLeaf,view=source?.view;
  const doc=source?.getContainer().doc||workspace.containerEl.ownerDocument;
  // Obsidian exposes one main-window sidedock, not a popout-specific right leaf.
  if(placement==='sidebar'&&doc!==workspace.containerEl.ownerDocument)return Promise.reject(Error('独立窗口不支持收集侧边栏，请在主窗口运行此命令。'));
  const pending=this.opening[placement].get(doc);if(pending?.current())return pending.work;
  let cancelled=false,allocating=false,reusedSource=false,target:WorkspaceLeaf|undefined;
  const sourceFile=(view as {file?:unknown}|undefined)?.file;
  const current=(target?:WorkspaceLeaf)=>!cancelled&&!this.stopped&&!doc.defaultView?.closed&&
   (workspace.activeLeaf===source||!!target&&workspace.activeLeaf===target)&&
   (!source||source.getContainer().doc===doc&&(
    source.view===view&&(view as {file?:unknown}|undefined)?.file===sourceFile&&view?.containerEl.isConnected!==false||
    reusedSource&&source===target&&source.getViewState().type===this.viewType&&!(source.view as {file?:unknown}).file&&source.view.containerEl.isConnected!==false
   ));
  // Observed navigation cannot be revived by returning to the original tab.
  // Synchronous allocation may focus its own new placeholder; validate it below.
  const observe=()=>{if(!allocating&&!current(target))cancelled=true;};
  const refs=[workspace.on('active-leaf-change',observe),workspace.on('file-open',observe)];
  const stop=()=>{cancelled=true;for(const ref of refs)workspace.offref(ref);this.watches.delete(stop);};this.watches.add(stop);
  // Serialize recovery and allocation across placements/windows so two opens
  // cannot both claim a released draft before its new view has taken ownership.
  const work=this.allocations.run('collection',async()=>{
   if(!current())return;
   let leaf=this.find(doc,placement);target=leaf;
   if(!leaf){
    const session=await this.recoverableSession();if(!current())return;
    leaf=this.find(doc,placement);target=leaf;
    if(!leaf){
     const before=new Set<WorkspaceLeaf>();workspace.iterateAllLeaves(item=>before.add(item));
     let created:WorkspaceLeaf|null;
     allocating=true;try{created=placement==='sidebar'?workspace.getRightLeaf(false):workspace.getLeaf('tab');}finally{allocating=false;}
     if(!created)throw Error('当前无法新建收集侧边栏，请稍后重试。');
     const allocated=!before.has(created);
     if(!allocated&&(created.getViewState().type!=='empty'||(created.view as {file?:unknown}).file))throw Error('未获得新的收集标签页，已有页面保持不变。');
     reusedSource=!allocated&&created===source;
     leaf=created;target=created;
     const empty=created.view;
     // The container is authoritative before a popout view's DOM is mounted.
     if(created.getContainer().doc!==doc||this.isSidebar(created)!==(placement==='sidebar')){
      if(allocated&&created.view===empty&&created.getViewState().type==='empty')created.detach();
      throw Error('收集目标不在请求的窗口或区域，已有页面保持不变。');
     }
     if(!current(created)){
      if(allocated&&created.view===empty&&created.getViewState().type==='empty')created.detach();
      return;
     }
     try{await created.setViewState({type:this.viewType,active:false,state:session?{collectionSession:session}:{}});}
     catch(error){
      // Only remove our still-empty placeholder. A view that already mounted
      // may own a draft and must remain available to its normal recovery path.
      if(allocated&&created.view===empty&&created.getViewState().type==='empty')created.detach();
      throw error;
     }
    }
   }
   if(!current(leaf)||!this.matches(leaf,doc,placement))return;
   await leaf.loadIfDeferred();
   if(!current(leaf)||!this.matches(leaf,doc,placement))return;
   await workspace.revealLeaf(leaf);
   if(current(leaf)&&this.matches(leaf,doc,placement))workspace.setActiveLeaf(leaf,{focus:true});
  }).finally(()=>{stop();if(this.opening[placement].get(doc)?.work===work)this.opening[placement].delete(doc);});
  this.opening[placement].set(doc,{current:()=>current(target),work});return work;
 }
 private isSidebar(leaf:WorkspaceLeaf){const root=leaf.getRoot();return root===this.workspace.leftSplit||root===this.workspace.rightSplit;}
 private matches(leaf:WorkspaceLeaf,doc:Document,placement:CollectionPlacement){
  return leaf.getContainer().doc===doc&&this.isSidebar(leaf)===(placement==='sidebar')&&
   this.workspace.getLeavesOfType(this.viewType).includes(leaf);
 }
 private find(doc:Document,placement:CollectionPlacement){return this.workspace.getLeavesOfType(this.viewType).find(leaf=>this.matches(leaf,doc,placement));}
}
