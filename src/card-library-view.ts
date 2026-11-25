import {libraryTypeNames,type LibraryCardType} from './card-library-model';
import {statuses} from './database';
import {highlightLocation,highlightReturnLabel} from './highlight-note';
import {createLibraryCardFilter,emptyLibraryQuery,libraryBoardChoices,libraryKanban,libraryStatusLabel,libraryTable,libraryTagChoices,uncategorizedChoice,type LibraryCardRecord,type LibraryLayout,type LibraryPlacement,type LibraryViewQuery} from './card-property-views';
import {cardLibraryLabels} from './ui-i18n';
import type {SettingsLanguage} from './settings-preferences';

export interface LibraryElementOptions {text?:string;cls?:string;value?:string;attr?:Record<string,string>}
export interface LibraryElement {
 empty():void;
 createDiv(options?:LibraryElementOptions|string):LibraryElement;
 createEl(tag:string,options?:LibraryElementOptions):LibraryElement;
 createSpan(options?:LibraryElementOptions|string):LibraryElement;
 setAttribute(name:string,value:string):void;
 removeAttribute(name:string):void;
 addEventListener(type:string,listener:(event:Event)=>void):void;
 onclick:((event:unknown)=>void)|null;
 onchange:((event:unknown)=>void)|null;
 value:string;
 disabled:boolean;
 textContent:string|null;
}
export interface LibraryViewHandlers {
 setQuery(next:LibraryViewQuery):void;
 place(path:string):void;
 open(path:string):unknown;
 unlink(path:string):void;
 setStatus?(path:string,status:string):Promise<void>;
 locate?(placement:LibraryPlacement):void;
 searchUnindexed?(path:string):Promise<void>;
 jump?(path:string):void;
 choiceOptions?:readonly string[];
 setChoice?(path:string,value:string):Promise<void>;
 language?:SettingsLanguage;
}
export interface LibraryViewState {indexing?:boolean;limitNote?:string}
/** The modal must forward every library action. A rejected action stays visible to the caller. */
export function libraryModalHandlers(host:Omit<LibraryViewHandlers,'setQuery'>,setQuery:(next:LibraryViewQuery)=>void,notice:(error:unknown)=>void,refresh:()=>void):LibraryViewHandlers{
 const report=(run:()=>unknown)=>Promise.resolve().then(run).then(()=>refresh()).catch(error=>{notice(error);refresh();});
 const now=(run:()=>unknown)=>{try{run();refresh();}catch(error){notice(error);}};
 return {setQuery,place:path=>now(()=>host.place(path)),open:path=>{void Promise.resolve().then(()=>host.open(path)).catch(notice);},unlink:path=>now(()=>host.unlink(path)),setStatus:host.setStatus?(path,status)=>report(()=>host.setStatus!(path,status)):undefined,locate:host.locate?placement=>{void report(()=>host.locate!(placement));}:undefined,jump:host.jump?path=>{void report(()=>host.jump!(path));}:undefined,setChoice:host.setChoice?(path,value)=>report(()=>host.setChoice!(path,value)):undefined,choiceOptions:host.choiceOptions,searchUnindexed:host.searchUnindexed?path=>report(()=>host.searchUnindexed!(path)):undefined,language:host.language};
}
const filterKeys=['type','tag','board','status','choice'] as const;
type FilterKey=typeof filterKeys[number];
type Options=readonly (readonly [string,string])[];
const focusKey=(...parts:string[])=>JSON.stringify(parts);
const dom=(el:LibraryElement)=>el as unknown as HTMLElement;
function button(parent:LibraryElement,label:string,run:()=>void,cls='',attrs:Record<string,string>={}){
 const control=parent.createEl('button',{text:label,cls,attr:{type:'button',...attrs}});
 control.onclick=run;
 return control;
}
function select(parent:LibraryElement,label:string,value:string,change:(value:string)=>void,attrs:Record<string,string>={}){
 const control=parent.createEl('select',{attr:{'aria-label':label,title:label,...attrs}});
 control.onchange=()=>change(control.value);
 control.value=value;
 return control;
}
function setOptions(control:LibraryElement,options:Options,value:string){
 control.empty();
 for(const [key,text] of options)control.createEl('option',{value:key,text});
 control.value=value;
}
function selectOptions(parent:LibraryElement,label:string,options:Options,value:string,change:(value:string)=>void){
 const control=select(parent,label,value,change);
 setOptions(control,options,value);
 return control;
}
function jumpAction(record:LibraryCardRecord,handlers:LibraryViewHandlers){
 return record.highlight&&handlers.jump?{label:highlightReturnLabel(record.highlight),run:()=>handlers.jump!(record.path)}:undefined;
}

/** Keep search and filters mounted: IME input, caret, and keyboard focus survive result updates. */
export function mountCardLibrary(root:LibraryElement,handlers:LibraryViewHandlers){
 root.empty();
 const lang=handlers.language??'zh-CN',i18n=cardLibraryLabels(lang);
 const layouts:readonly [LibraryLayout,string][]=[['list',i18n.views.list],['table',i18n.views.table],['kanban',i18n.views.kanban]];
 const types:readonly [''|LibraryCardType,string][]=[['',i18n.allTypes],['note',i18n.typeNames.note],['pdf',i18n.typeNames.pdf],['image',i18n.typeNames.image],['audio',i18n.typeNames.audio],['video',i18n.typeNames.video]];
 const statusEntries:readonly (readonly [string,string])[]=lang==='en'?Object.keys(statuses).map((k):readonly [string,string]=>[k,i18n.statusNames[k]??statuses[k as keyof typeof statuses]]):Object.entries(statuses);
 const statusLabel=(status:string)=>lang==='en'?(i18n.statusNames[status]??libraryStatusLabel(status)):libraryStatusLabel(status);
 const typeLabel=(type:LibraryCardType)=>lang==='en'?i18n.typeNames[type]:libraryTypeNames[type];

 let query=emptyLibraryQuery(),composing=false,optionRecords:readonly LibraryCardRecord[]|undefined,optionLabels:Record<FilterKey,Options>;
 let filterCards=createLibraryCardFilter([]),moreAnchor:LibraryElement|undefined,draggedPath:string|undefined,draggedStatus:string|undefined;
 let shownCount=0,renderedIndexing=false,selected=new Set<string>();
 const collapsedLanes=new Set<string>();
 const selectionRows=new Map<string,{row:LibraryElement;control:LibraryElement;baseClass:string}>();
 const positions=new Map<LibraryLayout,{top:number;left:number}>();

 const header=root.createDiv('ts-library-header');
 const searchRow=header.createDiv('ts-library-search-row');
 const search=searchRow.createEl('input',{cls:'ts-library-search-input',attr:{type:'search','aria-label':i18n.searchAria,placeholder:i18n.searchPlaceholder}});
 const submitSearch=()=>{if(!composing&&search.value!==query.query)handlers.setQuery({...query,query:search.value});};
 search.addEventListener('input',event=>{if(!(event as InputEvent).isComposing)submitSearch();});
 search.addEventListener('compositionstart',()=>{composing=true;});
 search.addEventListener('compositionend',()=>{composing=false;submitSearch();});
 search.onchange=submitSearch;
 const tabs=searchRow.createDiv({cls:'ts-db-tabs',attr:{role:'group','aria-label':i18n.viewsGroupAria}});
 const switches=layouts.map(([view,label])=>[view,button(tabs,label,()=>{if(query.view!==view)handlers.setQuery({...query,view});})] as const);
 const refinements=header.createEl('details',{cls:'ts-library-filters'});
 const summary=refinements.createEl('summary',{cls:'ts-library-filters-summary',text:i18n.filterSummary(0)});
 const fields=refinements.createDiv('ts-library-filter-fields');
 const filterOptions=new Map<FilterKey,LibraryElement>();
 for(const key of filterKeys){
  if(key==='choice'&&!handlers.choiceOptions?.length)continue;
  const field=fields.createEl('label',{cls:'ts-library-filter-field'});
  field.createSpan({text:i18n.filters[key]});
  const control=select(field,i18n.filters[key],'',value=>handlers.setQuery({...query,[key]:value}));
  filterOptions.set(key,control);
 }
 const chips=header.createDiv({cls:'ts-library-active-filters',attr:{hidden:''}});
 const summaryLine=root.createDiv('ts-library-summary-line');
 const count=summaryLine.createDiv({cls:'ts-db-count',attr:{role:'status'}});
 const indexStatus=summaryLine.createDiv({cls:'ts-library-index-status',attr:{role:'status',hidden:''}});
 const results=root.createDiv({cls:'ts-db-results ts-library-results',attr:{'data-library-view':query.view,tabindex:'0','aria-label':i18n.resultsAria}});
 const panel=root.createDiv({cls:'ts-library-more-menu',attr:{popover:'auto',role:'dialog','aria-label':i18n.actionsDialogAria,hidden:''}});
 const popover=dom(panel),surface=dom(results);

 function closeMore(returnFocus=false){
  const anchor=moreAnchor;moreAnchor=undefined;
  anchor?.setAttribute('aria-expanded','false');
  if(typeof popover.hidePopover==='function'&&popover.matches(':popover-open'))popover.hidePopover();
  panel.setAttribute('hidden','');
  if(returnFocus&&anchor&&dom(anchor).isConnected)dom(anchor).focus({preventScroll:true});
 }
 panel.addEventListener('toggle',event=>{
  if((event as ToggleEvent).newState==='closed'&&moreAnchor&&!popover.matches(':popover-open'))closeMore();
 });
 panel.addEventListener('keydown',event=>{
  if((event as KeyboardEvent).key==='Escape'){event.preventDefault();event.stopPropagation();closeMore(true);}
 });
 results.addEventListener('scroll',()=>{if(moreAnchor)closeMore();});

 function openPopoverAt(anchor:LibraryElement,ariaLabel:string,populate:()=>void){
  const alreadyOpen=moreAnchor===anchor;
  closeMore();
  if(alreadyOpen)return;
  panel.empty();
  populate();
  panel.setAttribute('aria-label',ariaLabel);
  moreAnchor=anchor;
  anchor.setAttribute('aria-expanded','true');
  if(typeof popover.showPopover!=='function'){
   panel.removeAttribute('popover');panel.removeAttribute('hidden');
   button(panel,i18n.collapseActions,()=>closeMore(true),'ts-library-filter-reset');
   popover.querySelector?.<HTMLElement>('button,select')?.focus({preventScroll:true});
   return;
  }
  const buttonEl=dom(anchor),box=buttonEl.getBoundingClientRect(),win=buttonEl.ownerDocument.defaultView;
  if(!win)return;
  popover.hidden=false;
  popover.showPopover();
  const width=popover.offsetWidth,height=popover.offsetHeight;
  const left=Math.min(Math.max(8,box.right-width),Math.max(8,win.innerWidth-width-8));
  const top=box.bottom+height+6<=win.innerHeight?box.bottom+6:Math.max(8,box.top-height-6);
  popover.style.setProperty('--ts-library-menu-left',left+'px');
  popover.style.setProperty('--ts-library-menu-top',top+'px');
  popover.querySelector<HTMLElement>('button,select')?.focus({preventScroll:true});
 }

 function moreActions(record:LibraryCardRecord){
  panel.createDiv({cls:'ts-library-more-heading',text:record.title,attr:{title:record.title}});
  const options=panel.createDiv('ts-library-more-actions');
  const jump=jumpAction(record,handlers);
  if(jump)button(options,i18n.placeOnBoard,()=>handlers.place(record.path));
  if(record.placements.length===1&&handlers.locate)button(options,i18n.openInBoard,()=>handlers.locate!(record.placements[0]));
  else if(record.placements.length>1&&handlers.locate){
   const totals=new Map<string,number>(),seen=new Map<string,number>();
   for(const place of record.placements)totals.set(place.boardTitle,(totals.get(place.boardTitle)||0)+1);
   const menu=selectOptions(options,i18n.boardPickerAria(record.title),[['',i18n.chooseBoard],...record.placements.map((place,index)=>{
    const n=(seen.get(place.boardTitle)||0)+1;seen.set(place.boardTitle,n);
    return [String(index),totals.get(place.boardTitle)!>1?place.boardTitle+' · '+n:place.boardTitle] as const;
   })],'',value=>{
    if(!/^\d+$/.test(value))return;
    const place=record.placements[Number(value)];
    if(place)handlers.locate!(place);
    menu.value='';
   });
  }
  if(record.indexIncomplete&&handlers.searchUnindexed)button(options,i18n.searchRemainingBoards,()=>{void handlers.searchUnindexed!(record.path);});
  if(handlers.setStatus)selectOptions(options,i18n.statusPickerAria(record.title),statusEntries,record.status in statuses?record.status:'inbox',value=>{void handlers.setStatus!(record.path,value);});
  if(handlers.choiceOptions?.length&&handlers.setChoice)selectOptions(options,i18n.choicePickerAria(record.title),[['',i18n.uncategorized],...handlers.choiceOptions.map(option=>[option,option] as const)],record.choice,value=>{void handlers.setChoice!(record.path,value);});
  button(options,i18n.unlinkFromBoard,()=>handlers.unlink(record.path),'ts-library-unlink');
 }

 function showMore(record:LibraryCardRecord,anchor:LibraryElement){
  openPopoverAt(anchor,i18n.cardActionsAria(record.title),()=>moreActions(record));
 }

 function showQuickPicker(anchor:LibraryElement,heading:string,ariaLabel:string,choices:Options,current:string,pick:(value:string)=>void){
  openPopoverAt(anchor,ariaLabel,()=>{
   panel.createDiv({cls:'ts-library-more-heading',text:heading,attr:{title:heading}});
   const list=panel.createDiv('ts-library-more-actions');
   for(const [val,text] of choices){
    const active=val===current;
    button(list,text,()=>{closeMore(true);if(!active)pick(val);},active?'ts-library-quick-option is-active':'ts-library-quick-option',{'aria-pressed':String(active)});
   }
  });
 }

 function recordActions(parent:LibraryElement,record:LibraryCardRecord){
  const row=parent.createDiv('ts-library-card-actions');
  const main=jumpAction(record,handlers)??{label:i18n.placeOnBoard,run:()=>handlers.place(record.path)};
  button(row,main.label,main.run,'ts-library-main-action',{'data-library-focus':focusKey(record.path,'primary'),title:main.label});
  const more=button(row,'⋯',()=>showMore(record,more),'ts-library-more-trigger',{'aria-label':i18n.moreActionsAria(record.title),'aria-haspopup':'dialog','aria-expanded':'false','data-library-focus':focusKey(record.path,'more'),title:i18n.moreActionsTitle});
 }
 function reset(){
  handlers.setQuery({...emptyLibraryQuery(),view:query.view,selected:query.selected});
 }
 function paintFilters(records:readonly LibraryCardRecord[]){
  if(!composing&&search.value!==query.query)search.value=query.query;
  for(const [view,control] of switches){
   const active=query.view===view;
   control.setAttribute('class',active?'is-active':'');
   control.setAttribute('aria-pressed',String(active));
  }
  if(optionRecords!==records){
   optionRecords=records;filterCards=createLibraryCardFilter(records);
   optionLabels={type:types,tag:[['',i18n.allTags],...libraryTagChoices(records).map(tag=>[tag,'#'+tag] as const)],board:[['',i18n.allBoards],...libraryBoardChoices(records).map(board=>[board.path,board.title] as const)],status:[['',i18n.allStatuses],...statusEntries],choice:[['',i18n.allChoices],[uncategorizedChoice,i18n.uncategorized],...(handlers.choiceOptions??[]).map(option=>[option,option] as const)]};
   for(const [key,control] of filterOptions)setOptions(control,optionLabels[key],query[key]);
  }
  for(const [key,control] of filterOptions)if(control.value!==query[key])control.value=query[key];
  const active=filterKeys.filter(key=>!!query[key]);
  summary.textContent=i18n.filterSummary(active.length);
  chips.empty();
  if(active.length||query.query){
   for(const key of active){
    const value=query[key],label=optionLabels[key].find(([v])=>v===value)?.[1]??value;
    button(chips,i18n.filters[key]+(lang==='en'?': ':'：')+label+' ×',()=>handlers.setQuery({...query,[key]:''}),'ts-library-filter-chip',{'aria-label':i18n.clearFilterAria(i18n.filters[key],label),'data-library-focus':focusKey('filter',key)});
   }
   if(query.query)button(chips,i18n.searchChip(query.query),()=>handlers.setQuery({...query,query:''}),'ts-library-filter-chip',{'aria-label':i18n.clearSearchAria,'data-library-focus':focusKey('filter','search')});
   button(chips,i18n.clearAll,reset,'ts-library-filter-reset',{'aria-label':i18n.clearAll,'data-library-focus':focusKey('filter','reset')});
   chips.removeAttribute('hidden');
  }else chips.setAttribute('hidden','');
 }
 function paintSummary(state:LibraryViewState){
  const label=i18n.cardCount(shownCount,query.selected.length);
  if(count.textContent!==label)count.textContent=label;
  const indexText=state.indexing?i18n.indexingStatus:state.limitNote??'';
  if(indexStatus.textContent!==indexText){
   indexStatus.textContent=indexText;
   if(indexText)indexStatus.removeAttribute('hidden');
   else indexStatus.setAttribute('hidden','');
  }
 }
 function patchSelection(path:string,picked:boolean){
  const item=selectionRows.get(path);
  if(!item)return;
  const {row,control,baseClass}=item;
  row.setAttribute('class',picked?(baseClass?baseClass+' ':'')+'is-selected':baseClass);
  control.setAttribute('class',picked?'ts-library-select ts-library-selected-mark':'ts-library-select');
  control.setAttribute('aria-pressed',String(picked));
  control.textContent=picked?'✓':'';
 }
 function update(records:readonly LibraryCardRecord[],next:LibraryViewQuery,state:LibraryViewState={}){
  const indexing=state.indexing===true,nextSelection=new Set(next.selected);
  if(optionRecords===records&&renderedIndexing===indexing&&query.view===next.view&&query.query===next.query&&filterKeys.every(key=>query[key]===next[key])){
   query={...next};
   for(const path of selected)if(!nextSelection.has(path))patchSelection(path,false);
   for(const path of nextSelection)if(!selected.has(path))patchSelection(path,true);
   selected=nextSelection;
   paintSummary(state);
   return;
  }
  const doc=surface.ownerDocument,active=doc?.activeElement as HTMLElement|undefined;
  const menuAnchor=moreAnchor&&active&&popover.contains(active)?dom(moreAnchor):undefined;
  const focus=(menuAnchor??active)?.getAttribute('data-library-focus');
  const contained=active&&dom(root).contains(active);
  const wasInResults=active&&surface.contains(active);
  if(doc)positions.set(query.view,{top:surface.scrollTop,left:surface.scrollLeft});
  query={...next};
  selected=nextSelection;
  renderedIndexing=indexing;
  closeMore();
  paintFilters(records);
  const shown=filterCards(query);
  shownCount=shown.length;
  paintSummary(state);
  selectionRows.clear();
  results.empty();
  results.setAttribute('data-library-view',query.view);
  if(!shown.length){
   const empty=results.createDiv({cls:'ts-sidebar-empty ts-library-empty'});
   empty.createDiv({text:query.choice===uncategorizedChoice?i18n.emptyUncategorized:records.length?i18n.emptyFiltered:i18n.emptyLibrary});
   if(query.query||filterKeys.some(key=>query[key]))button(empty,i18n.clearFilters,reset,'ts-library-filter-reset',{'data-library-focus':focusKey('filter','empty-reset')});
  }else paintResults(shown,indexing);
  if(doc){
   const position=positions.get(query.view);
   surface.scrollTop=position?.top??0;surface.scrollLeft=position?.left??0;
   if(contained&&active&&(menuAnchor||!active.isConnected)){
    const match=focus&&Array.from(dom(root).querySelectorAll<HTMLElement>('[data-library-focus]')).find(element=>element.dataset.libraryFocus===focus);
    (match||(wasInResults?surface:dom(search))).focus({preventScroll:true});
   }
  }
 }
 function paintResults(shown:readonly LibraryCardRecord[],indexing:boolean){
  const toggle=(path:string)=>{
   const next=new Set(selected);
   if(next.has(path))next.delete(path);else next.add(path);
   handlers.setQuery({...query,selected:[...next]});
  };
  const bindSelect=(element:LibraryElement,path:string)=>{element.onclick=event=>{
   const target=(event as {target?:{closest?:(selector:string)=>unknown}}|null)?.target;
   if(!target?.closest?.('button,select,input,textarea,a,summary,label'))toggle(path);
  };};
  const selectCard=(row:LibraryElement,parent:LibraryElement,record:LibraryCardRecord,baseClass:string)=>{
   const {path,title}=record;
   const control=button(parent,'',()=>toggle(path),'ts-library-select',{'aria-label':i18n.selectCardAria(title),'aria-pressed':'false','data-library-focus':focusKey(path,'select')});
   selectionRows.set(path,{row,control,baseClass});
   if(selected.has(path))patchSelection(path,true);
  };
  const openCard=(parent:LibraryElement,record:LibraryCardRecord)=>button(parent,record.title,()=>{void handlers.open(record.path);},'ts-library-title',{'aria-label':i18n.openSourceAria(record.title),title:record.title,'data-library-focus':focusKey(record.path,'open')});
  const category=(record:LibraryCardRecord)=>handlers.choiceOptions?.length?record.choice||i18n.uncategorized:'';
  if(query.view==='table'){
   const byPath=new Map(shown.map(record=>[record.path,record]));
   const table=libraryTable(shown,!!handlers.choiceOptions?.length,indexing);
   const grid=results.createEl('table',{cls:'ts-db-table'}),head=grid.createEl('thead').createEl('tr');
   for(const column of [...table.columns,i18n.actionColumn])head.createEl('th',{text:column,attr:{scope:'col'}});
   const body=grid.createEl('tbody');
   for(const row of table.rows){
    const record=byPath.get(row.path)!;
    const line=body.createEl('tr',{attr:{'data-note-path':row.path}});bindSelect(line,row.path);
    const title=line.createEl('td',{cls:'ts-library-title-cell'}).createDiv('ts-library-title-group');
    selectCard(line,title,record,'');openCard(title,record);
    for(const cell of row.cells.slice(1))line.createEl('td',{text:cell});
    recordActions(line.createEl('td',{cls:'ts-library-table-actions'}),record);
   }
   return;
  }
  const card=(parent:LibraryElement,record:LibraryCardRecord,kanban=false)=>{
   const row=parent.createDiv({cls:'ts-library-card',attr:{'data-note-path':record.path}});bindSelect(row,record.path);
   if(kanban&&handlers.setStatus){
    row.setAttribute('draggable','true');
    row.addEventListener('dragstart',event=>{
     draggedPath=record.path;
     draggedStatus=record.status in statuses?record.status:'inbox';
     const transfer=(event as DragEvent).dataTransfer;
     transfer?.setData('text/plain',record.path);
     if(transfer)transfer.effectAllowed='move';
    });
    row.addEventListener('dragend',()=>{draggedPath=undefined;draggedStatus=undefined;});
   }
   const info=row.createDiv('ts-library-card-info'),title=info.createDiv('ts-library-title-group');
   selectCard(row,title,record,'ts-library-card');openCard(title,record);
   const detail=info.createDiv(kanban?'ts-library-tags':'ts-library-excerpt');
   if(!kanban){
    const sText=statusLabel(record.status),currentStatus=record.status in statuses?record.status:'inbox';
    if(handlers.setStatus){
     const chip=button(detail,sText,()=>showQuickPicker(chip,record.title,i18n.quickStatusAria(record.title),statusEntries,currentStatus,val=>{void handlers.setStatus!(record.path,val);}),'ts-library-chip ts-library-status-chip is-interactive',{'data-status':record.status,'aria-label':i18n.quickStatusAria(record.title),'aria-haspopup':'dialog','aria-expanded':'false','data-library-focus':focusKey(record.path,'status-chip')});
    }else detail.createSpan({cls:'ts-library-chip ts-library-status-chip',text:sText,attr:{'data-status':record.status}});
   }
   const choice=category(record);
   if(choice){
    if(handlers.setChoice&&handlers.choiceOptions?.length){
     const choiceOpts:Options=[['',i18n.uncategorized],...handlers.choiceOptions.map(o=>[o,o] as const)];
     const chip=button(detail,choice,()=>showQuickPicker(chip,record.title,i18n.quickChoiceAria(record.title),choiceOpts,record.choice,val=>{void handlers.setChoice!(record.path,val);}),'ts-library-chip ts-library-choice-chip is-interactive',{'aria-label':i18n.quickChoiceAria(record.title),'aria-haspopup':'dialog','aria-expanded':'false','data-library-focus':focusKey(record.path,'choice-chip')});
    }else detail.createSpan({cls:'ts-library-chip',text:choice});
   }
   const boardNames=record.boards.map(board=>board.title).join(lang==='en'?', ':'、');
   const boardText=indexing&&!boardNames?'':record.indexIncomplete?(boardNames?boardNames+' · '+i18n.restUnindexed:i18n.indexIncomplete):boardNames||i18n.unplaced;
   const meta=[typeLabel(record.type),record.highlight?highlightLocation(record.highlight):'',boardText,record.tags.join(' ')].filter(Boolean).join(' · ');
   if(meta)detail.createSpan({cls:'ts-library-card-meta-text',text:meta,attr:{title:meta}});
   if(!kanban&&Object.keys(record.custom).length){
    const properties=Object.entries(record.custom).map(([key,value])=>key+(lang==='en'?': ':'：')+value).join('  ');
    info.createDiv({cls:'ts-library-path',text:properties,attr:{title:properties}});
   }
   recordActions(row,record);
  };
  if(query.view==='kanban'){
   const board=results.createDiv('ts-db-kanban');
   for(const column of libraryKanban(shown)){
    const isCollapsed=collapsedLanes.has(column.id);
    const lane=board.createDiv({cls:isCollapsed?'ts-db-lane is-collapsed':'ts-db-lane',attr:{'data-status':column.id}});
    const headingText=(lang==='en'?statusLabel(column.id):column.label)+' · '+column.cards.length;
    const laneHead=lane.createDiv('ts-db-lane-title');
    laneHead.createSpan({cls:'ts-db-lane-dot',attr:{'data-status':column.id,'aria-hidden':'true'}});
    const laneBtn=button(laneHead,headingText,()=>{
     const nextCollapsed=!collapsedLanes.has(column.id);
     if(nextCollapsed)collapsedLanes.add(column.id);else collapsedLanes.delete(column.id);
     lane.setAttribute('class',nextCollapsed?'ts-db-lane is-collapsed':'ts-db-lane');
     laneBtn.setAttribute('aria-expanded',String(!nextCollapsed));
     laneBtn.setAttribute('aria-label',i18n.laneToggleAria(headingText,!nextCollapsed));
    },'ts-db-lane-toggle',{'aria-expanded':String(!isCollapsed),'aria-label':i18n.laneToggleAria(headingText,!isCollapsed),'data-library-focus':focusKey('lane',column.id)});
    if(handlers.setStatus){
     lane.addEventListener('dragover',event=>{
      if(!draggedPath)return;
      (event as DragEvent).preventDefault?.();
      lane.setAttribute('data-drop-target','true');
     });
     lane.addEventListener('dragleave',event=>{
      const related=(event as DragEvent|undefined)?.relatedTarget as Node|null|undefined,hostEl=dom(lane);
      if(related&&typeof hostEl.contains==='function'&&hostEl.contains(related))return;
      lane.removeAttribute('data-drop-target');
     });
     lane.addEventListener('drop',event=>{
      (event as DragEvent).preventDefault?.();
      lane.removeAttribute('data-drop-target');
      const path=draggedPath,status=draggedStatus;draggedPath=undefined;draggedStatus=undefined;
      if(path&&status!==column.id)void handlers.setStatus!(path,column.id);
     });
    }
    for(const record of column.cards)card(lane,record,true);
   }
  }else for(const record of shown)card(results,record);
 }
 return {update,close:()=>closeMore(),dismissActions:()=>{
  if(!moreAnchor)return false;
  closeMore(true);return true;
 }};
}
/** Single-paint adapter for standalone tests and callers without a mounted modal. */
export function paintCardLibrary(root:LibraryElement,records:readonly LibraryCardRecord[],query:LibraryViewQuery,handlers:LibraryViewHandlers){
 mountCardLibrary(root,handlers).update(records,query);
}
