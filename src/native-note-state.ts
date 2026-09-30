import {App,MarkdownView,TFile} from 'obsidian';

function editors(app:App,file:TFile):MarkdownView[]{
 return app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).filter((view):view is MarkdownView=>view instanceof MarkdownView&&view.file===file&&view.getMode()==='source');
}
// TextFileView.save() returns immediately when a previous save is in flight,
// and its saveAgain follow-up is not part of that returned Promise. Keep this
// host detail isolated; an unknown host retains the strict source checks below.
function nativeSavePending(view:MarkdownView){return Object.getOwnPropertyDescriptor(view,'saving')?.value===true;}
async function finishPendingNativeSave(app:App,file:TFile,views:MarkdownView[],expected:string|undefined,path:string){
 if(!views.some(nativeSavePending))return;
 // A source popout can close during this wait and destroy its pending timers.
 // The workspace clock must remain able to reject that departed source view.
 const win=app.workspace.containerEl.ownerDocument.defaultView||window;
 for(let attempt=0;;attempt++){
  if(file.path!==path||app.vault.getAbstractFileByPath(path)!==file)throw Error('原笔记已移动或删除，请重新打开卡片编辑');
  const current=editors(app,file);
  if(views.some(view=>!current.includes(view)))throw Error('原生笔记窗口已切换，请重新打开卡片编辑');
  if(expected!==undefined)assertNativeNoteUnchanged(app,file,expected);
  if(!views.some(nativeSavePending))return;
  if(attempt>=40)throw Error('原生笔记仍在保存，请稍后再打开卡片编辑');
  await new Promise<void>(resolve=>win.setTimeout(resolve,25));
 }
}
/** A native view may contain newer text than the Vault while auto-save is pending. */
export function assertNativeNoteUnchanged(app:App,file:TFile,expected:string){
 if(editors(app,file).some(view=>view.editor.getValue()!==expected))throw Error('原生笔记有新的编辑，未覆盖。请复制草稿后重新编辑');
}
export async function readCurrentNativeNote(app:App,file:TFile):Promise<string>{
 const views=editors(app,file),values=new Set(views.map(view=>view.editor.getValue())),path=file.path;
 if(values.size>1)throw Error('多个笔记窗口内容尚未同步，请稍后再打开卡片编辑');
 for(const view of views)if(view.file===file)await view.save();
 await finishPendingNativeSave(app,file,views,values.values().next().value,path);
 const text=await app.vault.read(file);assertNativeNoteUnchanged(app,file,text);return text;
}

/** Revalidate the card at the atomic write boundary, after any queued Vault work. */
export async function writeNativeNoteDraft(app:App,file:TFile,expected:string,value:string,validate:()=>void):Promise<void>{
 validate();assertNativeNoteUnchanged(app,file,expected);
 await app.vault.process(file,text=>{
  validate();assertNativeNoteUnchanged(app,file,expected);
  if(text!==expected)throw Error('原笔记已变化，未覆盖。请复制草稿后重新编辑');
  return value;
 });
}
