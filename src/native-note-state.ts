import {App,MarkdownView,TFile} from 'obsidian';

function editors(app:App,file:TFile):MarkdownView[]{
 return app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).filter((view):view is MarkdownView=>view instanceof MarkdownView&&view.file===file&&view.getMode()==='source');
}
/** A native view may contain newer text than the Vault while auto-save is pending. */
export function assertNativeNoteUnchanged(app:App,file:TFile,expected:string){
 if(editors(app,file).some(view=>view.editor.getValue()!==expected))throw Error('原生笔记有新的编辑，未覆盖。请复制草稿后重新编辑');
}
export async function readCurrentNativeNote(app:App,file:TFile):Promise<string>{
 const views=editors(app,file),values=new Set(views.map(view=>view.editor.getValue()));
 if(values.size>1)throw Error('多个笔记窗口内容尚未同步，请稍后再打开卡片编辑');
 for(const view of views)if(view.file===file)await view.save();
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
