import {EditorSearchModal} from './editor-search-view';
import {SelectionNoteModal,CreateLinkedNote} from './selection-note-view';
import {sameNoteSelection} from './selection-note';
import {App,TFile,setIcon,Notice} from 'obsidian';
import {releaseEditorResource} from './editor-cleanup';
import {toolbarNavigation} from './toolbar-navigation';
import {allowsReadOnlyKey} from './inline-editor-keys';
import {DraftInput,NativeMarkdownDraft} from './native-markdown-editor';
import {planMarkdownEdit,MarkdownCommand} from './markdown-edit';
export interface InlineEditorOptions {
 createLinkedNote?:CreateLinkedNote;app:App;file?:TFile;value:string;label:string;placeholder:string;dispose?:()=>void;markdown?:boolean;focusWithin?:(element:Element|null)=>boolean;
 selectAll?:boolean;continueTopic?:(sibling:boolean)=>Promise<void>;
 save:(value:string)=>Promise<void>;cancel:()=>void;resize:(value:string,input:DraftInput,appearanceChanged?:boolean)=>void;
}
/** One inline draft owns its content until an atomic save succeeds. */
export class InlineNodeEditor {
 readonly el:HTMLElement;readonly input:DraftInput;private native?:NativeMarkdownDraft;private status:HTMLElement;private pending?:Promise<boolean>;private backingUp=false;private disposed=false;private observer:ResizeObserver;private body:HTMLElement;private composing=false;private toolbarDispose?:()=>void;private actionNavigationDispose?:()=>void;
 private layoutFrame?:number;private focusTimer?:number;private lastLayoutValue?:string;private geometry='';private appearanceChanged=false;private badge:HTMLElement;private actions:HTMLButtonElement[]=[];private fallback=false;private headerKey='';private saveError?:string;private layoutFailures=new Set<'size'|'geometry'>();private layoutHint:HTMLElement;private commandHint?:HTMLElement;private selectionCount=1;private textSelected=false;private retryIcon=false;
 constructor(private node:HTMLElement,private options:InlineEditorOptions){
  this.body=node.querySelector<HTMLElement>('.ts-text-body,.ts-card-preview')!;
  node.addClass('is-inline-editing');this.el=node.createDiv('ts-inline-editor');
  const bar=this.el.createDiv({cls:'ts-inline-editor-bar',attr:{role:'toolbar','aria-label':options.markdown?'卡片编辑操作':'文本编辑操作'}});const label=bar.createSpan({cls:'ts-inline-editor-label',attr:{title:options.label}});setIcon(label.createSpan('ts-inline-editor-kind'),options.markdown?'file-text':'type');label.createSpan({text:options.markdown?'笔记编辑':options.continueTopic?'主题编辑':'文本编辑'});if(options.continueTopic)label.title='Tab 添加子主题 · Enter 添加同级主题 · Shift+Enter 换行';this.badge=bar.createSpan({cls:'ts-inline-editor-badge',attr:{role:'status','aria-live':'polite','aria-atomic':'true'}});
  const layoutLabel='尺寸暂未更新，可继续编辑和保存；修改文字或字号后自动重试';
  this.layoutHint=bar.createSpan({cls:'ts-inline-layout-hint',attr:{title:layoutLabel,'aria-label':layoutLabel,role:'img',tabindex:'0'}});setIcon(this.layoutHint,'scan-line');this.layoutHint.hidden=true;
  const commandLabel='内容或选区已变化，本次操作未执行。请确认后重试。';
  this.commandHint=bar.createSpan({cls:'ts-inline-command-hint',attr:{title:commandLabel,'aria-label':commandLabel,role:'status','aria-live':'polite',tabindex:'0'}});setIcon(this.commandHint,'mouse-pointer-2');this.commandHint.hidden=true;
  const button=(label:string,icon:string,run:()=>unknown)=>{const b=bar.createEl('button',{attr:{'aria-label':label,title:label}});setIcon(b,icon);b.onmousedown=e=>e.preventDefault();b.onclick=()=>{if(!this.disposed&&!b.disabled)run();};this.actions.push(b);return b;};
  button('保存并退出编辑 · Ctrl / ⌘ + Enter','check',()=>this.commit());button('取消本次编辑 · Esc','x',()=>this.cancel());button('复制编辑草稿','copy',()=>{void this.el.ownerDocument.defaultView!.navigator.clipboard.writeText(this.input.value).then(()=>{if(!this.disposed)this.feedback('草稿已复制');},()=>{if(!this.disposed)this.feedback('复制失败，请选中文字后复制');});});
  if(!options.markdown)button('查找与替换','search',()=>{try{this.findText();}catch(e){new Notice(String(e));}});
  this.actionNavigationDispose=toolbarNavigation(bar);
  let fallback=false;
  if(options.markdown){try{this.native=new NativeMarkdownDraft(options.app,this.el,options.value,options.file);}catch(e){console.warn('ThoughtSpace live editor unavailable; using source editor',e);fallback=true;}}
  if(this.native)this.input=this.native;else{const input=this.el.createEl('textarea',{cls:'ts-inline-input',attr:{'aria-label':options.label,placeholder:options.placeholder,spellcheck:'false'}});input.value=options.value;this.input=input;}
  const style=getComputedStyle(this.body);for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','paddingTop','paddingRight','paddingBottom','paddingLeft'] as const)this.input.style[key]=key==='fontFamily'?(this.body.style.fontFamily||'var(--font-text)'):style[key];
  this.observer=new ResizeObserver(()=>this.scheduleLayout());this.observer.observe(node);this.observer.observe(this.body);this.syncGeometry();
  this.status=this.el.createDiv({cls:'ts-inline-editor-status',attr:{role:'status','aria-live':'polite'}});
  if(fallback)this.status.setText('当前 Obsidian 不支持内嵌实时预览，已切换为 Markdown 源码编辑');
  this.fallback=fallback;
  this.input.addEventListener('input',()=>{if(this.disposed)return;this.showCommandHint(false);if(!this.el.hasClass('has-error')){const text=this.fallback?'当前使用 Markdown 源码编辑，实时预览不可用':'';if(this.status.textContent!==text)this.status.setText(text);}this.updateState();if(!this.composing)this.scheduleLayout();});
  this.input.addEventListener('select',()=>{
   if(this.disposed)return;
   const count=this.input.selectionCount??1,selected=count===1&&this.input.selectionStart<this.input.selectionEnd;
   if(selected!==this.textSelected){this.textSelected=selected;this.el.classList.toggle('has-text-selection',selected);}
   if(count!==this.selectionCount){this.selectionCount=count;this.updateState();}
  });
  this.input.addEventListener('compositionstart',()=>{if(this.disposed)return;this.composing=true;this.updateState();});this.input.addEventListener('compositionend',()=>{if(this.disposed)return;this.composing=false;this.updateState();this.scheduleLayout();this.checkFocus();});
  this.el.addEventListener('keydown',e=>{
   if(this.disposed||e.isComposing||e.keyCode===229||this.composing)return;
   let handled=true;
   if(this.pending){
    // Leave Tab to browser focus traversal, not native Markdown indentation.
    if(e.key==='Tab'&&!options.continueTopic){e.stopPropagation();return;}
    handled=!allowsReadOnlyKey(e);
   }
   else if(options.continueTopic&&!options.markdown&&e.target===this.input&&!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='Tab'||e.key==='Enter')){if(!e.repeat)void options.continueTopic(e.key==='Enter').catch(error=>new Notice(String(error)));}
   else if(e.key==='Escape'){this.cancel();}
   else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){void this.commit();}
   else if(options.markdown&&(e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase(),command:MarkdownCommand|undefined=key==='b'?'bold':key==='i'?'italic':key==='k'?'link':e.shiftKey&&key==='x'?'strike':undefined;if(command){if(this.native&&(this.input.selectionCount??1)>1)handled=false;else this.format(command);}else handled=false;}
   else handled=false;
   if(handled){e.preventDefault();e.stopPropagation();}
  },true);
  this.el.addEventListener('keydown',e=>e.stopPropagation());
  for(const type of ['pointerdown','dblclick','contextmenu','wheel','paste','copy','cut','dragstart'])this.el.addEventListener(type,e=>e.stopPropagation());
  for(const type of ['pointerdown','keydown','beforeinput'])this.el.addEventListener(type,()=>this.showCommandHint(false),true);
  this.el.addEventListener('focusout',()=>this.checkFocus());
  this.flushLayout();this.updateState();this.input.focus({preventScroll:true});this.input.setSelectionRange(options.selectAll?0:this.input.value.length,this.input.value.length);
 }
 private get win(){return this.el.ownerDocument.defaultView!;}
 checkFocus(){if(this.disposed)return;if(this.focusTimer!==undefined)this.win.clearTimeout(this.focusTimer);this.focusTimer=this.win.setTimeout(()=>{this.focusTimer=undefined;const active=this.el.ownerDocument.activeElement;if(!this.disposed&&!this.composing&&!this.saveError&&!this.el.contains(active)&&!this.options.focusWithin?.(active)&&!this.linkDialog?.modalEl.isConnected&&!this.searchDialog?.modalEl.isConnected)void this.commit();},0);}
 private feedback(message:string){this.status.setText(this.saveError?this.saveError+'\n'+message:message);}
 private scheduleLayout(){if(this.disposed||this.composing||this.layoutFrame!==undefined)return;this.layoutFrame=this.win.requestAnimationFrame(()=>{this.layoutFrame=undefined;this.flushLayout();});}
 private flushLayout(){if(this.layoutFrame!==undefined){this.win.cancelAnimationFrame(this.layoutFrame);this.layoutFrame=undefined;}if(this.disposed)return;const value=this.input.value;if(value!==this.lastLayoutValue||this.appearanceChanged){const appearance=this.appearanceChanged;this.appearanceChanged=false;this.lastLayoutValue=value;this.measureLayout('size',()=>this.options.resize(value,this.input,appearance));}this.syncGeometry();}
 /** Presentation is optional: a failed measurement must never prevent content persistence. */
 private measureLayout(part:'size'|'geometry',measure:()=>void){
  try{measure();this.layoutFailures.delete(part);}catch(error){if(!this.layoutFailures.has(part))console.warn('ThoughtSpace inline '+part+' measurement failed',error);this.layoutFailures.add(part);}
  const hidden=this.layoutFailures.size===0;if(this.layoutHint.hidden!==hidden)this.layoutHint.hidden=hidden;
 }
 private updateState(){
  if(this.disposed)return;
  const saving=!!this.pending,busy=saving||this.composing,state=saving?(this.backingUp?'recovering':'saving'):this.composing?'composing':this.el.hasClass('has-error')?'error':(this.input.selectionCount??1)>1?'multiselect':'editing';
  const label=saving?(this.backingUp?'备份中':'保存中'):this.composing?'输入中':state==='error'?'未保存':state==='multiselect'?`${this.input.selectionCount} 个选区`:this.dirty?'未保存':'编辑中';
  const saveLabel=this.composing?'请先完成文字输入':this.saveError?'重试保存 · Ctrl / ⌘ + Enter':'保存并退出编辑 · Ctrl / ⌘ + Enter';
  const key=[state,label,busy,saveLabel].join('|');
  if(key!==this.headerKey){
   this.headerKey=key;this.el.dataset.state=state;this.el.setAttribute('aria-busy',String(busy));
   if(this.badge.textContent!==label)this.badge.setText(label);
   this.badge.title=saving?'正在'+(this.backingUp?'备份':'保存')+'，可用快捷键选择和复制草稿':state==='multiselect'?'多光标编辑中，请保留一个选区后设置格式':label;
   for(const b of [...this.actions.slice(0,2),...this.actions.slice(3)])b.disabled=busy;
   this.actions[0].setAttribute('aria-label',saveLabel);this.actions[0].title=saveLabel;
   const retry=!!this.saveError;if(retry!==this.retryIcon){this.retryIcon=retry;setIcon(this.actions[0],retry?'rotate-ccw':'check');}
   const copyLabel=this.saveError?'复制保留的草稿':'复制编辑草稿';this.actions[2].title=copyLabel;this.actions[2].setAttribute('aria-label',copyLabel);
  }
  // Text and selection changes still reach the formatting toolbar even when status is unchanged.
  this.input.dispatchEvent(new Event('select'));
 }
 snapshot(){return{text:this.input.value,start:this.input.selectionStart,end:this.input.selectionEnd,busy:this.composing||!!this.pending,disabledReason:this.pending?(this.backingUp?'正在备份草稿':'正在保存'):this.composing?'输入法组字中':(this.input.selectionCount??1)>1?'多光标编辑中，请保留一个选区后设置格式':undefined};}
 replaceToolbar(dispose?:()=>void){
  const closed=this.disposed,previous=this.toolbarDispose;this.toolbarDispose=closed?undefined:dispose;
  releaseEditorResource('formatting toolbar',previous);
  // A late toolbar attachment is immediately released; never revive a closed draft.
  if(closed)releaseEditorResource('late formatting toolbar',dispose);
 }
 private showCommandHint(show:boolean){if(!this.disposed&&this.commandHint&&this.commandHint.hidden===show)this.commandHint.hidden=!show;}
 /** Focus callbacks may edit or close this draft; validate before creating a transaction. */
 private focusUnchanged(text:string,selection?:{from:number;to:number}){
  const input=this.input,active=input.ownerDocument.activeElement;
  if(active!==(input as unknown as Element)&&!this.native?.host.contains(active))input.focus({preventScroll:true});
  if(this.disposed)return false;
  if(this.pending||this.composing||input.readOnly||input.value!==text||selection&&((input.selectionCount??1)>1||input.selectionStart!==selection.from||input.selectionEnd!==selection.to)){
   this.showCommandHint(true);return false;
  }
  this.showCommandHint(false);return true;
 }
 format(command:MarkdownCommand|{color:string;background?:boolean}){
  if(this.disposed||this.pending||this.composing||!this.options.markdown||(this.input.selectionCount??1)>1)return;
  const input=this.input,previous=input.value,selection={from:input.selectionStart,to:input.selectionEnd};
  if(!this.focusUnchanged(previous,selection))return;
  const result=planMarkdownEdit(previous,selection.from,selection.to,command);
  if(!result.change||result.text===previous){this.feedback('请在正文中选择文字或放置光标');return;}
  // Keep toolbar commands in the active editor's own undo history.
  const {from,to,text}=result.change;
  if(this.native)this.native.replaceFormatted(text,from,to,result.start,result.end);
  else{input.setSelectionRange(from,to);const done=input.ownerDocument.execCommand('insertText',false,text);if(!done){input.setRangeText(text,from,to,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}input.setSelectionRange(result.start,result.end);}
  this.scheduleLayout();
 }
 private searchDialog?:EditorSearchModal;
 findText(){if(this.searchDialog?.modalEl.isConnected)return;
  const read=()=>this.disposed?{text:'',start:0,end:0,disabledReason:'编辑器已关闭'}:this.snapshot();
  const modal:EditorSearchModal=new EditorSearchModal(this.options.app,{read,apply:(expected,change)=>{
   if(read().disabledReason||!this.focusUnchanged(expected)||this.searchDialog!==modal||!modal.modalEl.isConnected)throw Error('编辑内容已变化，请刷新后重试');
   const end=change.from+change.text.length;if(this.native)this.native.replaceFormatted(change.text,change.from,change.to,end,end);else{this.input.setSelectionRange(change.from,change.to);if(!this.input.ownerDocument.execCommand('insertText',false,change.text)){this.input.setRangeText(change.text,change.from,change.to,'end');this.input.dispatchEvent(new Event('input',{bubbles:true}));}}this.scheduleLayout();
  },locate:(expected,match)=>{if(read().disabledReason||!this.focusUnchanged(expected)||this.searchDialog!==modal||!modal.modalEl.isConnected)throw Error('编辑内容已变化，请刷新后重试');this.input.setSelectionRange(match.from,match.to);}},()=>{this.searchDialog=undefined;if(!this.disposed)this.input.focus({preventScroll:true});});this.searchDialog=modal;modal.open();
 }
 private linkDialog?:SelectionNoteModal;
 linkNote(){if(!this.options.markdown||!this.options.file||!this.options.createLinkedNote)throw Error('请在 Markdown 笔记中使用此功能');if(this.linkDialog?.modalEl.isConnected)return;
  const read=()=>this.disposed?{text:'',start:0,end:0,disabledReason:'编辑器已关闭'}:this.snapshot();
  const modal=new SelectionNoteModal(this.options.app,{file:this.options.file,read,replace:(expected,link)=>{
   if(!sameNoteSelection(expected,read())||!this.focusUnchanged(expected.text,{from:expected.start,to:expected.end}))throw Error('编辑器内容或选区已变化，未插入链接');
   const end=expected.start+link.length;if(this.native)this.native.replaceFormatted(link,expected.start,expected.end,end,end);else{this.input.setSelectionRange(expected.start,expected.end);if(!this.input.ownerDocument.execCommand('insertText',false,link)){this.input.setRangeText(link,expected.start,expected.end,'end');this.input.dispatchEvent(new Event('input',{bubbles:true}));}}this.scheduleLayout();
  }},this.options.createLinkedNote,()=>{this.linkDialog=undefined;if(!this.disposed)this.input.focus({preventScroll:true});});this.linkDialog=modal;modal.open();
 }
 history(redo=false){if(this.disposed||this.pending||this.composing||!this.focusUnchanged(this.input.value))return;if(this.native)this.native.history(redo);else this.input.ownerDocument.execCommand(redo?'redo':'undo');}
 /** Refresh presentation without replacing the draft or touching native undo/selection. */
 syncAppearance(remeasure=true){
  if(this.disposed)return;
  const style=getComputedStyle(this.body);let changed=false;
  for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','paddingTop','paddingRight','paddingBottom','paddingLeft'] as const)if(this.input.style[key]!==(key==='fontFamily'?(this.body.style.fontFamily||'var(--font-text)'):style[key])){this.input.style[key]=key==='fontFamily'?(this.body.style.fontFamily||'var(--font-text)'):style[key];changed=true;}
  if(remeasure){this.appearanceChanged=true;this.scheduleLayout();}if(changed||remeasure)this.measureLayout('geometry',()=>this.native?.resize());
 }
 syncGeometry(){if(this.disposed)return;const b=this.body,left=b.offsetLeft,top=b.offsetTop,width=b.offsetWidth,height=b.offsetHeight,key=[left,top,width,height].join(':');if(key===this.geometry)return;this.geometry=key;this.measureLayout('geometry',()=>{Object.assign(this.input.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});this.native?.resize();});}
 get saving(){return !!this.pending;}
 get value(){return this.input.value;}
 get dirty(){return this.input.value!==this.options.value;}
 commit():Promise<boolean>{return this.persist(this.options.save);}
 /** Recovery is a separate file write; keep the captured draft stable until it completes. */
 backup(save:(value:string)=>Promise<void>):Promise<boolean>{return this.persist(save,true);}
 private async persist(save:(value:string)=>Promise<void>,recovery=false):Promise<boolean>{
  if(this.disposed)return true;if(this.pending)return this.pending;
  if(this.composing&&!recovery){this.feedback('请先完成当前文字输入');return false;}
  // Claim ownership before layout/read-only callbacks can synchronously reenter.
  let value='',preparationFailed=false,preparationError:unknown;
  this.backingUp=recovery;
  this.pending=Promise.resolve().then(()=>{
   if(preparationFailed)throw preparationError;
   if(this.disposed)throw Error('编辑器已关闭，未执行保存');
   return save(value);
  }).then(()=>true,e=>{
   if(!this.disposed){this.saveError=(recovery?'草稿备份失败：':'')+(String(e).replace(/^Error(?:: |$)/,'')||'保存未完成');this.feedback(recovery?'草稿仍在当前编辑器，可复制后重试退出。':'草稿已保留，可先复制；处理冲突后点击重试保存。');this.el.addClass('has-error');}return false;
  }).finally(()=>{
   // Unlock callbacks also belong to this operation, not to a second save.
   if(!this.disposed)releaseEditorResource('draft unlocking',()=>{this.input.readOnly=false;});
   this.pending=undefined;this.backingUp=false;if(!this.disposed)this.updateState();
  });
  try{
   if(!recovery)this.flushLayout();
   if(this.disposed)throw Error('编辑器已关闭，未执行保存');
   this.input.readOnly=true;
   if(this.disposed)throw Error('编辑器已关闭，未执行保存');
   value=this.input.value;this.saveError=undefined;this.el.removeClass('has-error');this.status.setText('');this.updateState();
  }catch(error){preparationFailed=true;preparationError=error;}
  return this.pending;
 }
 cancel(){if(this.disposed||this.pending||this.composing)return;this.options.cancel();}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.searchDialog?.close();this.searchDialog=undefined;this.linkDialog?.close();this.linkDialog=undefined;
  const frame=this.layoutFrame,timer=this.focusTimer,native=this.native,navigation=this.actionNavigationDispose,measurement=this.options.dispose;
  this.layoutFrame=undefined;this.focusTimer=undefined;this.native=undefined;this.actionNavigationDispose=undefined;this.options.dispose=undefined;
  releaseEditorResource('layout frame',()=>{if(frame!==undefined)this.win.cancelAnimationFrame(frame);});
  releaseEditorResource('focus timer',()=>{if(timer!==undefined)this.win.clearTimeout(timer);});
  this.replaceToolbar();releaseEditorResource('editor keyboard navigation',navigation);
  releaseEditorResource('size observer',()=>this.observer.disconnect());
  releaseEditorResource('native draft',()=>native?.dispose());
  releaseEditorResource('draft measurement',measurement);
  releaseEditorResource('editing outline',()=>this.node.removeClass('is-inline-editing'));
  releaseEditorResource('editor surface',()=>this.el.remove());
 }
}
