import {markdownToolbar,MarkdownToolbarEditor} from './markdown-toolbar';
import {planMarkdownEdit} from './markdown-edit';
import {DraftInput,NativeMarkdownDraft} from './native-markdown-editor';

/** Bind the shared toolbar to one draft; never redirect a command to an active note. */
export function writingFormatToolbar(parent:HTMLElement,input:DraftInput,native:NativeMarkdownDraft|undefined,blocked:()=>boolean,feedback:(message:string)=>void){
 const bar=parent.createDiv({cls:'ts-writing-formatbar ts-note-markdown-toolbar',attr:{role:'toolbar','aria-label':'写作 Markdown 编辑工具栏'}});parent.prepend(bar);
 let disposed=false,composing=false,cleanup:(()=>void)|undefined;
 const snapshot=()=>({text:input.value,start:input.selectionStart,end:input.selectionEnd,busy:disposed||composing||input.readOnly||blocked(),disabledReason:disposed?'编辑器已关闭':composing?'输入法组字中':blocked()||input.readOnly?'编辑器暂不可写':(input.selectionCount??1)>1?'请保留一个选区后设置格式':undefined});
 const focus=()=>{
  const before=snapshot();if(before.disabledReason)return;
  input.focus({preventScroll:true});const after=snapshot();
  if(after.disabledReason||before.text!==after.text||before.start!==after.start||before.end!==after.end){feedback('内容或选区已变化，请重试');return;}
  return before;
 };
 const binding:MarkdownToolbarEditor={input,snapshot,
  format(command){try{const state=focus();if(!state)return;const edit=planMarkdownEdit(state.text,state.start,state.end,command);if(!edit.change)return;const {text,from,to}=edit.change;
   if(native)native.replaceFormatted(text,from,to,edit.start,edit.end);
   else{input.setSelectionRange(from,to);const inserted=input.ownerDocument.execCommand('insertText',false,text);if(!inserted){input.setRangeText(text,from,to,'end');input.dispatchEvent(new Event('input'));}input.setSelectionRange(edit.start,edit.end);}
  }catch(error){feedback(String(error));}},
  history(redo=false){try{if(!focus())return;if(native)native.history(redo);else input.ownerDocument.execCommand(redo?'redo':'undo');}catch(error){feedback(String(error));}},
  replaceToolbar(dispose){cleanup?.();cleanup=dispose;}
 };
 const start=()=>{composing=true;input.dispatchEvent(new Event('select'));},end=()=>{composing=false;input.dispatchEvent(new Event('select'));};
 input.addEventListener('compositionstart',start);input.addEventListener('compositionend',end);
 const key=(event:KeyboardEvent)=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();input.focus();}};bar.addEventListener('keydown',key);
 markdownToolbar(bar,binding);
 return ()=>{if(disposed)return;disposed=true;cleanup?.();input.removeEventListener('compositionstart',start);input.removeEventListener('compositionend',end);bar.removeEventListener('keydown',key);bar.remove();};
}
