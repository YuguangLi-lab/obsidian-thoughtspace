import {setIcon} from 'obsidian';

export interface BranchControlsOptions {
 count:number;
 candidates:number;
 folded:boolean;
 disabled:boolean;
 group:boolean;
 onToggle:()=>void;
 onMenu:(anchor:HTMLElement)=>void;
}

/** Keep connected children distinct from the content fold in a group heading. */
export function renderBranchControls(host:HTMLElement,options:BranchControlsOptions):HTMLElement|null {
 const {count,candidates,folded,disabled,group}=options;
 if(count<=0&&candidates<=0)return null;
 const established=count>0;
 const controls=host.createDiv({cls:`ts-branch-controls${group?' ts-branch-controls-group':''}`,attr:{role:'group','aria-label':'子节点展开与折叠','aria-disabled':String(disabled)}});
 const stop=(event:Event)=>event.stopPropagation();
 controls.onpointerdown=stop;
 controls.ondblclick=stop;
 const control=(cls:string,label:string,icon:string,run:(button:HTMLButtonElement)=>void)=>{
  const button=controls.createEl('button',{cls,attr:{type:'button',title:label,'aria-label':label,'aria-disabled':String(disabled)}});
  button.disabled=disabled;
  button.onpointerdown=stop;
  button.ondblclick=stop;
  button.onclick=event=>{event.stopPropagation();if(!disabled&&!button.disabled)run(button);};
  const glyph=button.createSpan({cls:'ts-branch-icon',attr:{'aria-hidden':'true'}});
  setIcon(glyph,icon);
  return button;
 };
 const label=established?(folded?`展开下一层 · ${count} 个子节点`:`折叠子节点 · ${count} 个子节点`):'设为子节点并折叠 · 可撤销';
 const toggle=control(`ts-branch-toggle${established?'':' ts-branch-setup'}`,label,established?(folded?'plus':'minus'):'git-branch',()=>options.onToggle());
 if(established)toggle.setAttribute('aria-expanded',String(!folded));
 if(group)toggle.createSpan({cls:'ts-branch-label',text:'子节点',attr:{'aria-hidden':'true'}});
 toggle.createSpan({cls:'ts-branch-count',text:String(established?count:candidates),attr:{'aria-hidden':'true'}});
 if(established){
  const menu=control('ts-branch-menu','子节点展开与折叠菜单','chevron-down',anchor=>options.onMenu(anchor));
  menu.setAttribute('aria-haspopup','menu');
 }
 return controls;
}
