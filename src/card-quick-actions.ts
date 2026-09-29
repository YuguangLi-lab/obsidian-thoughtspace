type QuickAction=()=>unknown;

export interface CardQuickActionsOptions {
  kind:'card'|'text';
  /** Uses the host's icon renderer and error-handling button factory. */
  add:(label:string,icon:string,callback:QuickAction,className:string)=>HTMLButtonElement;
  edit?:QuickAction;
  read?:QuickAction;
  preview?:QuickAction;
  toggleAutoFit?:QuickAction;
  fold:QuickAction;
  autoFit:boolean;
  collapsed?:boolean;
  locked?:boolean;
  readOnly?:boolean;
}

export interface CardQuickActionControls {
  edit?:HTMLButtonElement;
  read?:HTMLButtonElement;
  preview?:HTMLButtonElement;
  autoFit?:HTMLButtonElement;
  fold:HTMLButtonElement;
}

/** Mount once on a fresh dock. Callbacks must revalidate the current card/session. */
export function mountCardQuickActions(actions:HTMLElement,options:CardQuickActionsOptions):CardQuickActionControls {
  const text=options.kind==='text',disabled=!!(options.locked||options.readOnly);
  actions.setAttribute('role','group');
  actions.setAttribute('aria-label',text?'文本卡片操作':'笔记卡片操作');
  // Includes dock padding and gaps, while preserving native focus and button clicks.
  const stopGesture=(event:Event)=>event.stopPropagation();
  actions.addEventListener('pointerdown',stopGesture);
  actions.addEventListener('dblclick',stopGesture);

  const add=(name:string,label:string,icon:string,callback:QuickAction,mutates=true,className='')=>{
    const control=options.add(label,icon,callback,`ts-icon-button ts-card-quick-${name}${className?` ${className}`:''}`);
    control.type='button';
    control.title=label;
    control.setAttribute('aria-label',label);
    control.disabled=mutates&&disabled;
    return control;
  };
  const edit=options.edit?add('edit',text?'编辑文本':'编辑笔记','pencil',options.edit,true,'ts-card-action-primary'):undefined;
  if(edit?.lastElementChild)edit.lastElementChild.textContent='编辑';
  const read=options.read?add('read','在右侧阅读笔记','panel-right-open',options.read,false,'ts-card-action-primary'):undefined;
  if(read?.lastElementChild)read.lastElementChild.textContent='阅读';
  const preview=options.preview?add('preview','阅读与关联','eye',options.preview,false):undefined;
  const sizingLabel=options.autoFit
    ?`关闭自动适应${text?'高度':'大小'}（保留当前尺寸）`
    :text?'自动适应高度（保持宽度，随正文增减）':'自动适应大小（按内容调整，长文可滚动）';
  const autoFit=options.toggleAutoFit?add('auto-fit',sizingLabel,text?'move-vertical':'scan-text',options.toggleAutoFit,true,text?'ts-text-auto-height':'ts-card-auto-fit'):undefined;
  if(autoFit){
    autoFit.setAttribute('aria-pressed',String(options.autoFit));
    autoFit.classList.toggle('is-active',options.autoFit);
  }
  const fold=add('fold',`${options.collapsed?'展开':'折叠'}${text?'文本':'卡片'}`,options.collapsed?'chevron-down':'chevron-up',options.fold);
  fold.setAttribute('aria-expanded',String(!options.collapsed));
  return{edit,read,preview,autoFit,fold};
}
