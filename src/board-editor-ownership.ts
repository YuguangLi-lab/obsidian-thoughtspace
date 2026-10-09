import {MarkdownView,type App,type TFile,type WorkspaceLeaf} from 'obsidian';

interface NativeEditorTracking {
 owners:Map<TFile,Set<MarkdownView>>;waiting:Set<TFile>;
 listeners:Set<(file:TFile)=>void>;timer?:number;clock?:Window;
}
const tracking=new WeakMap<App,NativeEditorTracking>();
interface RetiredNativeEditor {file:WeakRef<TFile>;view:WeakRef<MarkdownView>;}
// A plugin reload replaces this module while a closed host editor can still be
// saving. Keep only weak identities on the workspace window, never document text,
// listeners, timers or strong references to the App, file or retired view.
const reloadBridgeKey=Symbol.for('thoughtspace.native-editor-reload-bridge.v1');
function retiredEditorBridge(app:App):WeakMap<App,Set<RetiredNativeEditor>>{
 const scope=app.workspace.containerEl.ownerDocument.defaultView||window;
 const existing:unknown=Reflect.get(scope,reloadBridgeKey);if(existing instanceof WeakMap)return existing as WeakMap<App,Set<RetiredNativeEditor>>;
 const bridge=new WeakMap<App,Set<RetiredNativeEditor>>();Reflect.set(scope,reloadBridgeKey,bridge);return bridge;
}
function editorTracking(app:App):NativeEditorTracking{
 let state=tracking.get(app);if(!state){
  state={owners:new Map(),waiting:new Set(),listeners:new Set()};tracking.set(app,state);
  const reloadBridge=retiredEditorBridge(app),retired=reloadBridge.get(app);reloadBridge.delete(app);
  for(const entry of retired||[]){const file=entry.file.deref(),view=entry.view.deref();if(!file||!view)continue;const live=currentNativeLeaves(app,file).some(leaf=>!leaf.isDeferred&&leaf.view===view&&view.file===file);if(fullySaved(view)&&!live)continue;let owners=state.owners.get(file);if(!owners){owners=new Set();state.owners.set(file,owners);}owners.add(view);if(!live)state.waiting.add(file);}
 }return state;
}
function descriptorFlag(view:MarkdownView,key:'saving'|'saveAgain'):boolean|undefined{
 const value:unknown=Object.getOwnPropertyDescriptor(view,key)?.value;return typeof value==='boolean'?value:undefined;
}
function fullySaved(view:MarkdownView):boolean{return descriptorFlag(view,'saving')===false&&descriptorFlag(view,'saveAgain')===false;}
function currentNativeLeaves(app:App,file:TFile):WorkspaceLeaf[]{
 return app.workspace.getLeavesOfType('markdown').filter(leaf=>
  leaf.view instanceof MarkdownView&&leaf.view.file===file||
  leaf.isDeferred&&leaf.getViewState().state?.file===file.path);
}
function pollNativeSaves(app:App,state:NativeEditorTracking){
 if(state.timer!==undefined)return;
 state.clock=app.workspace.containerEl.ownerDocument.defaultView||window;
 state.timer=state.clock.setTimeout(()=>{state.timer=undefined;if(tracking.get(app)===state)reconcileNativeSaves(app,state);},25);
}
function reconcileNativeSaves(app:App,state:NativeEditorTracking){
 const leaves=app.workspace.getLeavesOfType('markdown'),live=new Set(leaves.filter(leaf=>!leaf.isDeferred&&leaf.view instanceof MarkdownView).map(leaf=>leaf.view));
 let pending=false;const drained:TFile[]=[];
 for(const [file,owners]of state.owners){
  for(const view of owners){if(live.has(view)&&view.file===file)continue;if(fullySaved(view))owners.delete(view);else{pending=true;state.waiting.add(file);}}
  if(!owners.size)state.owners.delete(file);
 }
 for(const file of state.waiting)if(!state.owners.has(file)&&!currentNativeLeaves(app,file).length){state.waiting.delete(file);drained.push(file);}
 if(pending)pollNativeSaves(app,state);else if(state.timer!==undefined){state.clock?.clearTimeout(state.timer);state.timer=undefined;}
 for(const file of drained)for(const notify of [...state.listeners])notify(file);
}

/** A closed native leaf can still have a save/saveAgain buffer writing to disk.
 * Keep that view's original TFile identity until both host flags settle. Never
 * call its save/getViewData after close, nor assume an unknown flag is safe. */
export function subscribeNativeBoardEditorDrains(app:App,notify:(file:TFile)=>void):()=>void{
 const state=editorTracking(app);state.listeners.add(notify);reconcileNativeSaves(app,state);return()=>state.listeners.delete(notify);
}
export function clearNativeBoardEditorTracking(app:App):void{
 const state=tracking.get(app);if(!state)return;if(state.timer!==undefined)state.clock?.clearTimeout(state.timer);state.timer=undefined;state.clock=undefined;
 const retired=new Set<RetiredNativeEditor>();for(const [file,owners]of state.owners)for(const view of owners)retired.add({file:new WeakRef(file),view:new WeakRef(view)});
 const reloadBridge=retiredEditorBridge(app);if(retired.size)reloadBridge.set(app,retired);else reloadBridge.delete(app);
 state.listeners.clear();state.owners.clear();state.waiting.clear();tracking.delete(app);
}

/** Callers apply this ownership rule to Markdown boards, including native reading
 * pages with Properties. Deferred leaves must remain deferred during discovery. */
export function nativeBoardEditorLeaves(app:App,file:TFile):WorkspaceLeaf[]{
 const leaves=currentNativeLeaves(app,file),state=editorTracking(app);
 for(const leaf of leaves)if(!leaf.isDeferred&&leaf.view instanceof MarkdownView&&leaf.view.file===file){let owners=state.owners.get(file);if(!owners){owners=new Set();state.owners.set(file,owners);}owners.add(leaf.view);}
 reconcileNativeSaves(app,state);return leaves;
}
/** Discovery does not load deferred pages or read/save editor buffers. */
export function nativeBoardEditorStatus(app:App,file:TFile):{open:number;pending:number}{
 const leaves=nativeBoardEditorLeaves(app,file),live=new Set(leaves.filter(leaf=>!leaf.isDeferred&&leaf.view instanceof MarkdownView&&leaf.view.file===file).map(leaf=>leaf.view));
 let pending=0;for(const owner of tracking.get(app)?.owners.get(file)||[])if(!live.has(owner))pending++;
 return{open:leaves.length,pending};
}
export function hasNativeBoardEditor(app:App,file:TFile):boolean{return nativeBoardEditorLeaves(app,file).length>0||!!tracking.get(app)?.owners.get(file)?.size;}
export function assertBoardEditorOwnership(app:App,file:TFile):void{
 if(hasNativeBoardEditor(app,file))throw Error('此 Markdown 白板仍在原生编辑、阅读或属性页打开，白板暂时仅供查看。请保存并关闭原生页，或从原生页返回白板后重试；当前内容保留。');
}

// TextFileView.save() may resolve while an earlier save and its saveAgain follow-up
// are still running. This is the same isolated host detail used by native-note-state.
// An unknown host cannot be treated as having a reliable completed-save barrier.
function savingState(view:MarkdownView):boolean{
 const value:unknown=Object.getOwnPropertyDescriptor(view,'saving')?.value;
 if(typeof value!=='boolean')throw Error('无法确认原生笔记的保存状态，已保留原生页。请先保存并关闭原生页，再重新打开白板。');
 return value;
}
function nativeText(view:MarkdownView):string{
 const text=view.getViewData();
 if(view.getMode()==='source'&&view.editor.getValue()!==text)throw Error('原生编辑器内容尚未同步，已保留原生页。请保存后重试返回白板。');
 return text;
}

/** Save only the explicitly chosen native leaf. This does not switch or close it.
 * After success the caller must await setViewState/native onUnloadFile, re-read
 * the document, and check ownership again before making the board writable. */
export async function settleNativeBoardEditor(app:App,file:TFile,leaf:WorkspaceLeaf):Promise<void>{
 const view=leaf.view,path=file.path;
 if(leaf.isDeferred||!(view instanceof MarkdownView)||view.file!==file)throw Error('原生笔记页尚未就绪或已切换，请从当前原生页重试返回白板。');
 const mode=view.getMode(),text=nativeText(view);
 let stopped=false,poll:number|undefined,resumePoll:(()=>void)|undefined;
 const ensure=()=>{
  if(stopped)throw Error('原生保存确认已取消，原生页与内容保留。');
  if(file.path!==path||app.vault.getAbstractFileByPath(path)!==file)throw Error('白板文件已移动、删除或替换，已取消返回白板；原生内容保留。');
  const native=nativeBoardEditorLeaves(app,file);
  if(leaf.view!==view||leaf.isDeferred||view.file!==file||!native.includes(leaf))throw Error('原生笔记页已关闭或切换，已取消返回白板。');
  if(native.some(other=>other!==leaf)||[...(tracking.get(app)?.owners.get(file)||[])].some(other=>other!==view))throw Error('此文件还在其他原生 Markdown 页打开或旧页面仍在保存。请先保存并关闭其他原生页，再重试返回白板。');
  if(view.getMode()!==mode||nativeText(view)!==text)throw Error('原生笔记在保存期间有新的编辑或模式变化，已保留原生页；请保存最新内容后重试。');
  savingState(view);
 };
 ensure();
 // Use the workspace clock: a source popout may close and destroy its own timers.
 const clock=app.workspace.containerEl.ownerDocument.defaultView||window;
 let deadline:number|undefined;
 const expired=new Promise<never>((_,reject)=>{deadline=clock.setTimeout(()=>reject(Error('原生笔记仍在保存或读取超时，已保留原生页。请稍后保存完成，再重试返回白板。')),1000);});
 const wait=()=>new Promise<void>(resolve=>{resumePoll=resolve;poll=clock.setTimeout(()=>{poll=undefined;resumePoll=undefined;resolve();},25);});
 const settling=(async()=>{
  if(mode==='preview'){
   // Reading-mode getViewData can lag a native Properties update. Never call
   // save with that stale full-document cache, even when there is no draft.
   while(savingState(view)){ensure();await wait();}
   ensure();const disk=await app.vault.read(file);ensure();
   if(disk!==text)throw Error('原生阅读页缓存尚未同步最新属性，未调用保存。请等待同步后重试返回白板，原文件保留。');
  }
  ensure();let saved=mode==='preview',saveFailed=false,saveError:unknown;
  // Reading mode has no source draft to commit. Its full-document cache must
  // never be written by this helper, even if Properties changes after the read.
  // Attach both source-save handlers immediately; a timeout can reject later.
  if(mode!=='preview')void Promise.resolve(view.save()).then(()=>{saved=true;},error=>{saveFailed=true;saveError=error;saved=true;});
  await Promise.resolve();
  for(;;){
   ensure();if(saveFailed)throw saveError;
   if(saved&&!savingState(view))break;
   await wait();
  }
  ensure();const disk=await app.vault.read(file);ensure();
  if(savingState(view)||disk!==text)throw Error('无法确认原生最新内容已保存完成，已保留原生页。请保存或检查同步后重试返回白板。');
 })();
 try{await Promise.race([settling,expired]);}
 finally{
  stopped=true;if(deadline!==undefined)clock.clearTimeout(deadline);
  if(poll!==undefined)clock.clearTimeout(poll);resumePoll?.();
 }
}
