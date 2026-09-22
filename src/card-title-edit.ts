export interface CardTitleOptions {getTitle:()=>string;started?:()=>void;canEdit:()=>void;save:(value:string)=>Promise<void>;finished:()=>void;}
/** A title input owns its draft until saved/cancelled; no keyboard events leak into the board. */
export function bindCardTitle(title:HTMLElement,options:CardTitleOptions):()=>void {
 let input:HTMLInputElement|undefined,error:HTMLElement|undefined,disposed=false,saving=false,composing=false;
 title.classList.add('ts-card-note-title');title.tabIndex=0;title.setAttribute('role','button');title.title='双击修改卡片标题，不修改笔记文件名；清空可恢复默认标题';title.setAttribute('aria-label','修改卡片标题');
 const fail=(e:unknown)=>{if(disposed)return;if(!error){error=title.ownerDocument.createElement('span');error.className='ts-card-title-error';error.setAttribute('role','alert');title.append(error);}error.textContent=e instanceof Error?e.message:String(e);input?.setAttribute('aria-invalid','true');};
 const finish=()=>{input=undefined;error=undefined;title.classList.remove('is-editing-title');title.textContent=options.getTitle();options.finished();};
 const save=async()=>{if(!input||saving||disposed||composing)return;const value=input.value;saving=true;input.readOnly=true;try{options.canEdit();await options.save(value);if(!disposed)finish();}catch(e){if(!disposed){input!.readOnly=false;fail(e);}}finally{saving=false;}};
 const begin=(event:Event)=>{event.preventDefault();event.stopPropagation();if(input||disposed)return;try{options.canEdit();options.started?.();}catch(e){fail(e);return;}error=undefined;title.replaceChildren();title.classList.add('is-editing-title');input=title.ownerDocument.createElement('input');input.className='ts-card-title-input';input.type='text';input.value=options.getTitle();input.setAttribute('aria-label','编辑卡片标题');title.append(input);input.onpointerdown=e=>e.stopPropagation();input.onclick=e=>e.stopPropagation();input.ondblclick=e=>e.stopPropagation();input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
  input.onkeydown=e=>{e.stopPropagation();if(e.isComposing||composing)return;if(e.key==='Enter'){e.preventDefault();void save();}else if(e.key==='Escape'){e.preventDefault();if(!saving)finish();}};input.onblur=()=>void save();input.focus();input.select();};
 const key=(e:KeyboardEvent)=>{if(e.target===title&&(e.key==='Enter'||e.key==='F2'))begin(e);};
 title.addEventListener('dblclick',begin);title.addEventListener('keydown',key);
 return()=>{disposed=true;title.removeEventListener('dblclick',begin);title.removeEventListener('keydown',key);if(input)input.onblur=null;};
}
