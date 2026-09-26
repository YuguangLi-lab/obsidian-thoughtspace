import {toolbarNavigation} from './toolbar-navigation';
import {setIcon,Notice} from 'obsidian';

import {MarkdownCommand,markdownActive} from './markdown-edit';

export interface MarkdownToolbarState {text:string;start:number;end:number;disabledReason?:string;busy?:boolean;}
export interface MarkdownToolbarEditor {
 /** Note bindings already publish at paint time; avoid scheduling a second frame. */
 readonly updatesBatched?:boolean;
 readonly canLinkNote?:boolean;
 input:EventTarget & {readonly value:string;readonly selectionStart:number;readonly selectionEnd:number};
 format(command:MarkdownCommand|{color:string;background?:boolean}):void;
 snapshot?:()=>MarkdownToolbarState;
 linkNote?:()=>void;
 findText?:()=>void;
 history(redo?:boolean):void;commit?:()=>Promise<unknown>;
 replaceToolbar(dispose?:()=>void):void;
}

/** Editing Toolbar-inspired groups, using native controls and the existing draft. */
export function markdownToolbar(host:HTMLElement,editor:MarkdownToolbarEditor,disposeOuter?:()=>void){
 let disposed=false,frame:number|undefined;
 const win=host.ownerDocument.defaultView!;
 const row=host.createDiv({cls:'ts-markdown-tools',attr:{role:'group','aria-label':'Markdown 编辑'}}),toggles=new Map<MarkdownCommand,HTMLButtonElement>();
 row.dataset.layout='compact';
 const readState=():MarkdownToolbarState=>editor.snapshot?.()??{text:editor.input.value,start:editor.input.selectionStart,end:editor.input.selectionEnd};
 const group=(name:string,key:string)=>{const el=row.createDiv({cls:'ts-md-group',attr:{role:'group','aria-label':name,title:name}});el.dataset.mdGroup=key;return el;};
 const action=(parent:HTMLElement,label:string,icon:string,run:()=>void,text?:string)=>{
  const b=parent.createEl('button',{cls:'ts-md-button',attr:{type:'button','aria-label':label,title:label}});
  if(text)b.setText(text);else setIcon(b,icon);
  b.onmousedown=e=>e.preventDefault();
  b.onclick=()=>{if(!disposed&&row.isConnected&&!b.disabled)run();};return b;
 };
 const format=(command:MarkdownCommand|{color:string;background?:boolean})=>{
  // Composition or a pending save may begin before the next scheduled paint.
  const state=readState();if(state.busy||state.disabledReason){update();return;}
  editor.format(command);update();
 };
 const busyAction=(parent:HTMLElement,label:string,icon:string,run:()=>void)=>{
  const b=action(parent,label,icon,()=>{if(readState().busy){update();return;}run();});b.dataset.busyAction='true';return b;
 };
 const command=(parent:HTMLElement,id:MarkdownCommand,label:string,icon:string,text?:string)=>{
  const b=action(parent,label,icon,()=>format(id),text);b.dataset.command=id;
  if(['bold','italic','highlight','task','quote'].includes(id)){toggles.set(id,b);b.setAttribute('aria-pressed','false');}return b;
 };
 const select=(parent:HTMLElement,label:string,key:string,options:[MarkdownCommand,string][],icon?:string)=>{
  const wrap=parent.createDiv('ts-md-dropdown');wrap.dataset.mdMenu=key;
  if(icon){wrap.addClass('is-icon');setIcon(wrap.createSpan('ts-md-dropdown-icon'),icon);}
  const el=wrap.createEl('select',{cls:'ts-md-select',attr:{'aria-label':label,title:label}}),allowed=new Set<string>();
  el.createEl('option',{value:'',text:label});
  for(const[value,text]of options){el.createEl('option',{value,text});allowed.add(value);}
  el.onchange=()=>{if(disposed||!row.isConnected||el.disabled)return;const value=el.value;el.value='';if(allowed.has(value))format(value as MarkdownCommand);};return el;
 };
 const headings=group('段落标题','paragraph');
 const headingSelect=select(headings,'标题','heading',[['paragraph','正文'],...Array.from({length:6},(_,i)=>['h'+(i+1),`H${i+1} · ${i+1} 级标题`] as [MarkdownCommand,string])]);
 const emphasis=group('常用文字格式','emphasis');
 for(const[id,label,icon]of [['bold','加粗 · ⌘/Ctrl+B','bold'],['italic','斜体 · ⌘/Ctrl+I','italic'],['highlight','高亮','highlighter']] as const)command(emphasis,id,label,icon);
 const blocks=group('段落与列表','blocks');
 const listSelect=select(blocks,'列表','list',[['bullet','无序列表'],['ordered','有序列表'],['task','任务列表']],'list');
 command(blocks,'task','任务列表','list-checks');command(blocks,'quote','引用','quote');
 const insert=group('链接与插入','insert');
 command(insert,'link','链接 · ⌘/Ctrl+K','link');command(insert,'table','插入表格','table-2');
 const noteLink=editor.linkNote&&editor.canLinkNote!==false?action(insert,'选中文字创建或关联笔记','file-symlink',()=>{
  const state=readState();if(state.busy||state.disabledReason||state.start===state.end){update();return;}
  try{editor.linkNote?.();}catch(e){new Notice(String(e));}
 }):undefined;
 select(insert,'插入内容','insert',[['wikilink','双链 [[笔记]]'],['image','图片链接'],['codeblock','代码块'],['callout','提示块'],['rule','分隔线'],['math','行内公式'],['mathblock','独立公式块'],['comment','隐藏注释']],'circle-plus');
 const colors=group('颜色与高亮','colors'),colorInputs:HTMLInputElement[]=[];colors.addClass('ts-md-colors');
 for(const background of [false,true]){
  const label=background?'选中文字背景色':'选中文字颜色',wrap=colors.createEl('label',{cls:'ts-md-color',attr:{title:label}});
  setIcon(wrap.createSpan(),background?'paint-bucket':'a-large-small');
  const input=wrap.createEl('input',{type:'color',attr:{'aria-label':label,title:label}});input.value=background?'#fff1a8':'#3478c6';wrap.style.setProperty('--ts-md-color',input.value);
  input.onchange=()=>{
   if(disposed||!row.isConnected||input.disabled)return;
   const state=readState();if(state.busy||state.disabledReason||state.start===state.end){update();return;}
   if(!/^#[a-f\d]{6}$/i.test(input.value))return;
   wrap.style.setProperty('--ts-md-color',input.value);format({color:input.value,background});
  };colorInputs.push(input);
 }
 const more=group('更多格式','more');
 select(more,'更多格式','format',[['underline','下划线'],['strike','删除线 · ⌘/Ctrl+Shift+X'],['code','行内代码'],['sup','上标'],['sub','下标'],['indent','增加缩进'],['outdent','减少缩进'],['clear','清除文字格式']],'ellipsis');
 const history=group('编辑历史','history');
 busyAction(history,'撤销输入','undo-2',()=>{editor.history();update();});busyAction(history,'重做输入','redo-2',()=>{editor.history(true);update();});
 if(editor.findText)busyAction(history,'查找与替换','search',()=>{try{editor.findText?.();}catch(e){new Notice(String(e));}});
 if(editor.commit){const finish=group('完成编辑','finish');busyAction(finish,'保存 Markdown','check',()=>{void editor.commit?.();}).addClass('ts-md-done');}
 let previous:MarkdownToolbarState|undefined,listLabel='列表',listIcon='list';const disposeNavigation=toolbarNavigation(row);
 const formatControls=Array.from(row.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('[data-command],select'));
 const busyControls=Array.from(row.querySelectorAll<HTMLButtonElement>('[data-busy-action]'));
 const update=()=>{
  if(frame!==undefined){win.cancelAnimationFrame(frame);frame=undefined;}
  if(disposed)return;
  const state=readState();
  if(previous&&previous.text===state.text&&previous.start===state.start&&previous.end===state.end&&previous.disabledReason===state.disabledReason&&previous.busy===state.busy)return;
  if(!previous||previous.disabledReason!==state.disabledReason||previous.busy!==state.busy){
   for(const control of formatControls){control.disabled=!!state.disabledReason||!!state.busy;control.title=state.disabledReason||(state.busy?'编辑器忙碌中':control.ariaLabel||'');}
  }
  if(!previous||previous.busy!==state.busy||previous.disabledReason!==state.disabledReason){
   row.setAttribute('aria-busy',String(!!state.busy));
   for(const control of busyControls){control.disabled=!!state.busy;control.title=state.busy?state.disabledReason||'编辑器忙碌中':control.ariaLabel||'';}
  }
  if(!previous||previous.text!==state.text||previous.start!==state.start||previous.end!==state.end){
   const active=markdownActive(state.text,state.start,state.end);
   for(const[id,b]of toggles){const on=active.has(id);if(b.getAttribute('aria-pressed')!==String(on)){b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));}}
   const heading=[...active].find(id=>/^h[1-6]$/.test(id)),label=heading?heading.toUpperCase():'正文';
   if(headingSelect.options[0].text!==label)headingSelect.options[0].text=label;
   const list=active.has('task')?['任务列表','list-checks']:active.has('ordered')?['有序列表','list-ordered']:active.has('bullet')?['无序列表','list']:['列表','list'];
   if(listLabel!==list[0]){listLabel=list[0];listSelect.options[0].text=listLabel;listSelect.parentElement!.classList.toggle('has-list-style',listLabel!=='列表');}
   if(listIcon!==list[1]){listIcon=list[1];setIcon(listSelect.parentElement!.querySelector<HTMLElement>('.ts-md-dropdown-icon')!,listIcon);}
  }
  const listTitle=state.disabledReason||(state.busy?'编辑器忙碌中':undefined)||(listLabel==='列表'?'列表':listLabel+' · 更改列表类型');if(listSelect.title!==listTitle)listSelect.title=listTitle;
  const hasSelection=state.start!==state.end&&!state.disabledReason&&!state.busy;
  if(noteLink){const disabled=!hasSelection||!!state.busy,title=state.disabledReason||(hasSelection?'选中文字创建或关联笔记':'请先选择一个概念或短语');if(noteLink.disabled!==disabled)noteLink.disabled=disabled;if(noteLink.title!==title)noteLink.title=title;}
  if(colors.classList.contains('has-text-selection')!==!!hasSelection)colors.classList.toggle('has-text-selection',!!hasSelection);
  for(const inputColor of colorInputs){
   const disabled=!!state.disabledReason||!!state.busy||state.start===state.end;
   if(inputColor.disabled!==disabled){inputColor.disabled=disabled;inputColor.parentElement?.classList.toggle('is-disabled',disabled);}
   const title=state.disabledReason||(state.busy?'编辑器忙碌中':state.start===state.end?'请先选择文字':inputColor.ariaLabel||'');
   if(inputColor.title!==title){inputColor.title=title;inputColor.parentElement!.title=title;}
  }
  previous=state;
 };
 // Content and selection can emit several events before one paint. Read the latest
 // state once per frame; explicit actions still update synchronously above.
 const schedule=()=>{if(disposed)return;if(editor.updatesBatched){update();return;}if(frame!==undefined)return;frame=win.requestAnimationFrame(()=>{frame=undefined;update();});};
 for(const event of ['input','select','keyup','mouseup'])editor.input.addEventListener(event,schedule);
 editor.replaceToolbar(()=>{disposed=true;if(frame!==undefined){win.cancelAnimationFrame(frame);frame=undefined;}disposeNavigation();for(const event of ['input','select','keyup','mouseup'])editor.input.removeEventListener(event,schedule);disposeOuter?.();});
 update();
}
