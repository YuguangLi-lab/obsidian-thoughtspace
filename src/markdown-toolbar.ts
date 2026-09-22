import {toolbarNavigation} from './toolbar-navigation';
import {setIcon,Notice} from 'obsidian';

import {MarkdownCommand,markdownActive} from './markdown-edit';

export interface MarkdownToolbarState {text:string;start:number;end:number;disabledReason?:string;busy?:boolean;}
export interface MarkdownToolbarEditor {
 /** Note bindings already publish at paint time; avoid scheduling a second frame. */
 readonly updatesBatched?:boolean;
 input:EventTarget & {readonly value:string;readonly selectionStart:number;readonly selectionEnd:number};
 format(command:MarkdownCommand|{color:string;background?:boolean}):void;
 snapshot?:()=>MarkdownToolbarState;
 linkNote?:()=>void;
 findText?:()=>void;
 history(redo?:boolean):void;commit?:()=>Promise<unknown>;
 replaceToolbar(dispose?:()=>void):void;
}

/** Editing Toolbar-inspired groups, using native controls and the existing draft. */
export function markdownToolbar(host:HTMLElement,editor:MarkdownToolbarEditor){
 let disposed=false,frame:number|undefined;
 const win=host.ownerDocument.defaultView!;
 const row=host.createDiv({cls:'ts-markdown-tools',attr:{role:'group','aria-label':'Markdown 编辑'}}),toggles=new Map<MarkdownCommand,HTMLButtonElement>();
 const group=(name:string)=>row.createDiv({cls:'ts-md-group',attr:{role:'group','aria-label':name,title:name}});
 const action=(parent:HTMLElement,label:string,icon:string,run:()=>void,text?:string)=>{const b=parent.createEl('button',{cls:'ts-md-button',attr:{type:'button','aria-label':label,title:label}});if(text)b.setText(text);else setIcon(b,icon);b.onmousedown=e=>e.preventDefault();b.onclick=()=>{if(!disposed&&!b.disabled)run();};return b;};
 const busyAction=(parent:HTMLElement,label:string,icon:string,run:()=>void)=>{const b=action(parent,label,icon,run);b.dataset.busyAction='true';return b;};
 const command=(parent:HTMLElement,id:MarkdownCommand,label:string,icon:string,text?:string)=>{const b=action(parent,label,icon,()=>{editor.format(id);update();},text);b.dataset.command=id;if(['bold','italic','strike','highlight','underline','code','task','quote','h2','h3'].includes(id)){toggles.set(id,b);b.setAttribute('aria-pressed','false');}return b;};
 const select=(parent:HTMLElement,label:string,options:[string,string][],icon?:string)=>{const wrap=parent.createDiv('ts-md-dropdown');if(icon){wrap.addClass('is-icon');setIcon(wrap.createSpan('ts-md-dropdown-icon'),icon);}const el=wrap.createEl('select',{cls:'ts-md-select',attr:{'aria-label':label,title:label}});el.createEl('option',{value:'',text:label});for(const[value,text]of options)el.createEl('option',{value,text});el.onchange=()=>{if(disposed||el.disabled)return;const value=el.value;el.value='';if(value){editor.format(value as MarkdownCommand);update();}};return el;};
 const history=group('撤销与清理');busyAction(history,'撤销输入','undo-2',()=>{editor.history();update();});busyAction(history,'重做输入','redo-2',()=>{editor.history(true);update();});command(history,'clear','清除文字格式','remove-formatting');
 if(editor.findText)busyAction(history,'查找与替换','search',()=>{try{editor.findText?.();}catch(e){new Notice(String(e));}});
 const headings=group('段落标题');command(headings,'h2','二级标题','heading-2','H₂');command(headings,'h3','三级标题','heading-3','H₃');
 const headingSelect=select(headings,'标题',[['paragraph','正文'],...Array.from({length:6},(_,i)=>['h'+(i+1),`H${i+1} · ${i+1} 级标题`] as [string,string])]);
 const emphasis=group('文字格式');
 for(const[id,label,icon]of [['bold','加粗 · ⌘/Ctrl+B','bold'],['italic','斜体 · ⌘/Ctrl+I','italic'],['underline','下划线','underline'],['strike','删除线 · ⌘/Ctrl+Shift+X','strikethrough'],['highlight','高亮','highlighter'],['code','行内代码','code']] as const)command(emphasis,id,label,icon);
 const blocks=group('段落与列表');command(blocks,'task','任务列表','list-checks');const listSelect=select(blocks,'列表',[['bullet','无序列表'],['ordered','有序列表'],['task','任务列表']],'list');command(blocks,'quote','引用','quote');command(blocks,'outdent','减少缩进','outdent');command(blocks,'indent','增加缩进','indent');
 const insert=group('插入内容');const noteLink=editor.linkNote?action(insert,'选中文字创建或关联笔记','file-symlink',()=>{try{editor.linkNote?.();}catch(e){new Notice(String(e));}}):undefined;command(insert,'link','链接 · ⌘/Ctrl+K','link');command(insert,'table','插入表格','table-2');command(insert,'image','图片链接','image');select(insert,'插入',[['wikilink','双链 [[笔记]]'],['image','图片链接'],['codeblock','代码块'],['table','表格'],['callout','提示块'],['rule','分隔线'],['sup','上标'],['sub','下标'],['math','行内公式'],['comment','隐藏注释']],'circle-plus');
 const colors=group('颜色与高亮'),colorInputs:HTMLInputElement[]=[];colors.addClass('ts-md-colors');
 for(const background of [false,true]){const label=background?'选中文字背景色':'选中文字颜色',wrap=colors.createEl('label',{cls:'ts-md-color',attr:{title:label}});setIcon(wrap.createSpan(),background?'paint-bucket':'a-large-small');const input=wrap.createEl('input',{type:'color',attr:{'aria-label':label,title:label}});input.value=background?'#fff1a8':'#3478c6';wrap.style.setProperty('--ts-md-color',input.value);input.onchange=()=>{if(disposed||input.disabled)return;wrap.style.setProperty('--ts-md-color',input.value);editor.format({color:input.value,background});update();};colorInputs.push(input);}
 if(editor.commit){const finish=group('完成编辑');busyAction(finish,'保存 Markdown','check',()=>{void editor.commit?.();}).addClass('ts-md-done');}
 let previous:MarkdownToolbarState|undefined,listLabel='列表',listIcon='list';const disposeNavigation=toolbarNavigation(row);
 const formatControls=Array.from(row.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('[data-command],select'));
 const busyControls=Array.from(row.querySelectorAll<HTMLButtonElement>('[data-busy-action]'));
 const update=()=>{
  if(frame!==undefined){win.cancelAnimationFrame(frame);frame=undefined;}
  if(disposed)return;
  const input=editor.input,state:MarkdownToolbarState=editor.snapshot?.()??{text:input.value,start:input.selectionStart,end:input.selectionEnd};
  if(previous&&previous.text===state.text&&previous.start===state.start&&previous.end===state.end&&previous.disabledReason===state.disabledReason&&previous.busy===state.busy)return;
  if(!previous||previous.disabledReason!==state.disabledReason){
   for(const control of formatControls){control.disabled=!!state.disabledReason;control.title=state.disabledReason||control.ariaLabel||'';}
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
  const listTitle=state.disabledReason||(listLabel==='列表'?'列表':listLabel+' · 更改列表类型');if(listSelect.title!==listTitle)listSelect.title=listTitle;
  const hasSelection=state.start!==state.end&&!state.disabledReason;
  if(noteLink){noteLink.disabled=!hasSelection||!!state.busy;noteLink.title=state.disabledReason||(hasSelection?'选中文字创建或关联笔记':'请先选择一个概念或短语');}
  if(colors.classList.contains('has-text-selection')!==!!hasSelection)colors.classList.toggle('has-text-selection',!!hasSelection);
  for(const inputColor of colorInputs){
   const disabled=!!state.disabledReason||state.start===state.end;
   if(inputColor.disabled!==disabled){inputColor.disabled=disabled;inputColor.parentElement?.classList.toggle('is-disabled',disabled);}
   const title=state.disabledReason||(state.start===state.end?'请先选择文字':inputColor.ariaLabel||'');
   if(inputColor.title!==title){inputColor.title=title;inputColor.parentElement!.title=title;}
  }
  previous=state;
 };
 // Content and selection can emit several events before one paint. Read the latest
 // state once per frame; explicit actions still update synchronously above.
 const schedule=()=>{if(disposed)return;if(editor.updatesBatched){update();return;}if(frame!==undefined)return;frame=win.requestAnimationFrame(()=>{frame=undefined;update();});};
 for(const event of ['input','select','keyup','mouseup'])editor.input.addEventListener(event,schedule);
 editor.replaceToolbar(()=>{disposed=true;if(frame!==undefined){win.cancelAnimationFrame(frame);frame=undefined;}disposeNavigation();for(const event of ['input','select','keyup','mouseup'])editor.input.removeEventListener(event,schedule);});
 update();
}
