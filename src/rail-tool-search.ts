import {setIcon} from 'obsidian';

type RailToolSearch={open:()=>void;dispose:()=>void};
const installedSearches=new WeakMap<HTMLElement,{tools:HTMLElement;binding:RailToolSearch}>();

/** Filter the existing tool buttons in place, retaining their actions and state. */
export function installRailToolSearch(panel:HTMLElement,tools:HTMLElement){
 const installed=installedSearches.get(panel);if(installed?.tools===tools)return installed.binding;installed?.binding.dispose();
 const header=panel.createDiv({cls:'ts-rail-search',attr:{role:'search','aria-label':'搜索白板工具'}});panel.insertBefore(header,tools);
 const field=header.createDiv('ts-rail-search-field');setIcon(field.createSpan({attr:{'aria-hidden':'true'}}),'search');
 const input=field.createEl('input',{cls:'ts-rail-search-input',type:'search',placeholder:'搜索工具…',attr:{'aria-label':'搜索白板工具',spellcheck:'false'}});
 const clear=field.createEl('button',{cls:'ts-rail-search-clear',attr:{type:'button','aria-label':'清除工具搜索',title:'清除搜索'}});setIcon(clear,'x');clear.hidden=true;
 const status=header.createDiv({cls:'ts-rail-search-status',attr:{role:'status','aria-live':'polite','aria-atomic':'true'}});
 const empty=panel.createDiv({cls:'ts-rail-empty',text:'没有匹配的工具，试试“分组”“PDF”或“整理”。'});empty.hidden=true;
 const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().trim();
 const groups=Array.from(tools.querySelectorAll<HTMLElement>('.ts-tool-cluster')).map(element=>({element,hidden:element.hidden,appliedHidden:element.hidden}));
 const entries=Array.from(tools.querySelectorAll<HTMLButtonElement>('button')).map(element=>({element,hidden:element.hidden,appliedHidden:element.hidden,group:element.closest<HTMLElement>('.ts-tool-cluster'),label:normalize([element.getAttribute('aria-label'),element.title,element.closest('.ts-tool-cluster')?.getAttribute('aria-label')].filter(Boolean).join(' '))}));
 // Recent shortcuts are local to this panel; the original buttons remain the source of actions and state.
 const recent=tools.createDiv({cls:'ts-rail-recent',attr:{role:'group','aria-label':'最近使用'}});tools.insertBefore(recent,tools.children[0]);
 recent.createDiv({cls:'ts-rail-recent-title',text:'最近使用'});const recentActions=recent.createDiv('ts-rail-recent-actions');
 let history:HTMLButtonElement[]=[];const shortcuts=new Map<HTMLButtonElement,HTMLButtonElement>();
 let disposed=false,composing=false;
 const eligible=(element:HTMLButtonElement)=>tools.contains(element)&&!element.disabled&&element.getAttribute('aria-disabled')!=='true'&&!element.hidden&&element.getClientRects().length>0;
 const renderRecent=()=>{
  shortcuts.clear();for(const child of Array.from(recentActions.children))child.remove();recent.hidden=!!normalize(input.value);
  if(recent.hidden)return;
  history=history.filter(element=>tools.contains(element));
  for(const original of history.filter(eligible)){
   const label=original.getAttribute('aria-label')||original.textContent?.trim()||original.title;
   const shortcut=recentActions.createEl('button',{cls:`${original.className} ts-button ts-rail-recent-button`,attr:{type:'button','aria-label':label,title:original.title||label}});
   for(const name of ['aria-pressed','aria-expanded','aria-haspopup']){const value=original.getAttribute(name);if(value!==null)shortcut.setAttribute(name,value);}
   setIcon(shortcut.createSpan({attr:{'aria-hidden':'true'}}),'history');shortcut.createSpan({text:label});shortcuts.set(shortcut,original);
  }
  recent.hidden=!shortcuts.size;
 };
 const retainExternalVisibility=()=>{for(const item of [...entries,...groups])if(item.element.hidden!==item.appliedHidden)item.hidden=item.element.hidden;};
 const refresh=()=>{
  if(disposed)return;retainExternalVisibility();const tokens=normalize(input.value).split(/\s+/u).filter(Boolean);let count=0;
  for(const entry of entries){const hidden=entry.hidden||groups.some(group=>group.element===entry.group&&group.hidden)||!tokens.every(token=>entry.label.includes(token));if(entry.element.hidden!==hidden)entry.element.hidden=hidden;entry.appliedHidden=hidden;if(!hidden&&tools.contains(entry.element))count++;}
  for(const group of groups){const hidden=group.hidden||!entries.some(entry=>entry.group===group.element&&!entry.element.hidden&&tools.contains(entry.element));if(group.element.hidden!==hidden)group.element.hidden=hidden;group.appliedHidden=hidden;}
  renderRecent();
  clear.hidden=!input.value;empty.hidden=count>0;const label=tokens.length?`${count} 项工具 · ↑↓ 选择 · Enter 执行`:'↑↓ 选择 · Enter 执行';if(status.textContent!==label)status.setText(label);tools.scrollTop=0;
 };
 const visible=()=>Array.from(tools.querySelectorAll<HTMLButtonElement>('button')).filter(eligible);
 const onClick=(event:MouseEvent)=>{
  if(disposed)return;const target=(event.target as Element).closest<HTMLButtonElement>('button');if(!target)return;
  const original=shortcuts.get(target);
  if(original){event.preventDefault();event.stopPropagation();if(!recent.hidden&&eligible(target)&&eligible(original))original.click();else renderRecent();return;}
  if(!entries.some(entry=>entry.element===target)||!eligible(target))return;
  history=[target,...history.filter(element=>element!==target)].slice(0,3);renderRecent();
 };
 const reset=()=>{if(disposed)return;input.value='';refresh();input.focus({preventScroll:true});};
 const onInput=()=>{if(!composing)refresh();},onStart=()=>{composing=true;},onEnd=()=>{composing=false;refresh();};
 const keys=(event:KeyboardEvent)=>{
  if(disposed||event.defaultPrevented||composing||event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  if(event.target===input){
   if(event.key==='Escape'&&input.value){event.preventDefault();event.stopPropagation();reset();return;}
   if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
   const items=visible(),item=event.key==='ArrowUp'?items.at(-1):items[0];event.preventDefault();event.stopPropagation();
   if(event.key==='Enter'){if(!event.repeat)item?.click();}else if(item){item.focus({preventScroll:true});tools.scrollTop=event.key==='ArrowUp'?tools.scrollHeight:0;}
  }else if(event.key==='ArrowUp'&&event.target===visible()[0]){event.preventDefault();event.stopPropagation();input.focus({preventScroll:true});}
 };
 input.addEventListener('input',onInput);input.addEventListener('compositionstart',onStart);input.addEventListener('compositionend',onEnd);clear.addEventListener('click',reset);panel.addEventListener('keydown',keys,true);tools.addEventListener('click',onClick);refresh();
 const binding={open:reset,dispose:()=>{if(disposed)return;retainExternalVisibility();disposed=true;input.removeEventListener('input',onInput);input.removeEventListener('compositionstart',onStart);input.removeEventListener('compositionend',onEnd);clear.removeEventListener('click',reset);panel.removeEventListener('keydown',keys,true);tools.removeEventListener('click',onClick);header.remove();empty.remove();recent.remove();shortcuts.clear();history=[];for(const entry of entries)entry.element.hidden=entry.hidden;for(const group of groups)group.element.hidden=group.hidden;installedSearches.delete(panel);}};
 installedSearches.set(panel,{tools,binding});return binding;
}
