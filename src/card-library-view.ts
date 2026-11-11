import {libraryTypeNames,type LibraryCardType} from './card-library-model';
import {statuses} from './database';
import {highlightLocation,highlightReturnLabel} from './highlight-note';
import {emptyLibraryQuery,filterLibraryCards,libraryBoardChoices,libraryKanban,libraryStatusLabel,libraryTable,libraryTagChoices,uncategorizedChoice,type LibraryCardRecord,type LibraryLayout,type LibraryPlacement,type LibraryViewQuery} from './card-property-views';

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
}
export interface LibraryViewState {indexing?:boolean;limitNote?:string}
/** The modal must forward every library action. A rejected action stays visible to the caller. */
export function libraryModalHandlers(host:Omit<LibraryViewHandlers,'setQuery'>,setQuery:(next:LibraryViewQuery)=>void,notice:(error:unknown)=>void,refresh:()=>void):LibraryViewHandlers{
 const report=(run:()=>unknown)=>Promise.resolve().then(run).then(()=>refresh()).catch(error=>{notice(error);refresh();});
 const now=(run:()=>unknown)=>{try{run();refresh();}catch(error){notice(error);}};
 return {setQuery,place:path=>now(()=>host.place(path)),open:path=>{void Promise.resolve().then(()=>host.open(path)).catch(notice);},unlink:path=>now(()=>host.unlink(path)),setStatus:host.setStatus?(path,status)=>report(()=>host.setStatus!(path,status)):undefined,locate:host.locate?placement=>{void report(()=>host.locate!(placement));}:undefined,jump:host.jump?path=>{void report(()=>host.jump!(path));}:undefined,setChoice:host.setChoice?(path,value)=>report(()=>host.setChoice!(path,value)):undefined,choiceOptions:host.choiceOptions,searchUnindexed:host.searchUnindexed?path=>report(()=>host.searchUnindexed!(path)):undefined};
}
const layouts:readonly [LibraryLayout,string][]=[['list','列表'],['table','表格'],['kanban','看板']];
const types:readonly [''|LibraryCardType,string][]=[['','全部类型'],['note','笔记'],['pdf','PDF'],['image','图片'],['audio','音频'],['video','视频']];
const filterKeys=['type','tag','board','status','choice'] as const;
type FilterKey=typeof filterKeys[number];
type Options=readonly (readonly [string,string])[];
const filterLabels:Record<FilterKey,string>={type:'卡片类型',tag:'标签',board:'白板',status:'状态',choice:'分类'};
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
function moreActions(panel:LibraryElement,record:LibraryCardRecord,handlers:LibraryViewHandlers){
 panel.createDiv({cls:'ts-library-more-heading',text:record.title,attr:{title:record.title}});
 const options=panel.createDiv('ts-library-more-actions');
 const jump=jumpAction(record,handlers);
 if(jump)button(options,'放置到当前白板',()=>handlers.place(record.path));
 if(record.placements.length===1&&handlers.locate)button(options,'在白板中打开',()=>handlers.locate!(record.placements[0]));
 else if(record.placements.length>1&&handlers.locate){
  const totals=new Map<string,number>(),seen=new Map<string,number>();
  for(const place of record.placements)totals.set(place.boardTitle,(totals.get(place.boardTitle)||0)+1);
  const menu=selectOptions(options,'所在白板 '+record.title,[['','选择白板'],...record.placements.map((place,index)=>{
   const n=(seen.get(place.boardTitle)||0)+1;seen.set(place.boardTitle,n);
   return [String(index),totals.get(place.boardTitle)!>1?place.boardTitle+' · '+n:place.boardTitle] as const;
  })],'',value=>{
   if(!/^\d+$/.test(value))return;
   const place=record.placements[Number(value)];
   if(place)handlers.locate!(place);
   menu.value='';
  });
 }
 if(record.indexIncomplete&&handlers.searchUnindexed)button(options,'查找其余白板',()=>{void handlers.searchUnindexed!(record.path);});
 if(handlers.setStatus)selectOptions(options,'状态 '+record.title,Object.entries(statuses),record.status in statuses?record.status:'inbox',value=>{void handlers.setStatus!(record.path,value);});
 if(handlers.choiceOptions?.length&&handlers.setChoice)selectOptions(options,'分类 '+record.title,[['','未分类'],...handlers.choiceOptions.map(option=>[option,option] as const)],record.choice,value=>{void handlers.setChoice!(record.path,value);});
 button(options,'从白板移除引用',()=>handlers.unlink(record.path),'ts-library-unlink');
}

/** Keep search and filters mounted: IME input, caret, and keyboard focus survive result updates. */
export function mountCardLibrary(root:LibraryElement,handlers:LibraryViewHandlers){
 root.empty();
 let query=emptyLibraryQuery(),composing=false,optionRecords:readonly LibraryCardRecord[]|undefined,optionLabels:Record<FilterKey,Options>;
 let moreAnchor:LibraryElement|undefined;
 const positions=new Map<LibraryLayout,{top:number;left:number}>();
 const header=root.createDiv('ts-library-header');
 const searchRow=header.createDiv('ts-library-search-row');
 const search=searchRow.createEl('input',{cls:'ts-library-search-input',attr:{type:'search','aria-label':'搜索卡片库',placeholder:'搜索标题、标签、属性或白板…'}});
 const submitSearch=()=>{if(!composing&&search.value!==query.query)handlers.setQuery({...query,query:search.value});};
 search.addEventListener('input',event=>{if(!(event as InputEvent).isComposing)submitSearch();});
 search.addEventListener('compositionstart',()=>{composing=true;});
 search.addEventListener('compositionend',()=>{composing=false;submitSearch();});
 search.onchange=submitSearch;
 const tabs=searchRow.createDiv({cls:'ts-db-tabs',attr:{role:'group','aria-label':'卡片库视图'}});
 const switches=layouts.map(([view,label])=>[view,button(tabs,label,()=>{if(query.view!==view)handlers.setQuery({...query,view});})] as const);
 const refinements=header.createEl('details',{cls:'ts-library-filters'});
 const summary=refinements.createEl('summary',{cls:'ts-library-filters-summary',text:'筛选'});
 const fields=refinements.createDiv('ts-library-filter-fields');
 const filterOptions=new Map<FilterKey,LibraryElement>();
 for(const key of filterKeys){
  if(key==='choice'&&!handlers.choiceOptions?.length)continue;
  const field=fields.createEl('label',{cls:'ts-library-filter-field'});
  field.createSpan({text:filterLabels[key]});
  const control=select(field,filterLabels[key],'',value=>handlers.setQuery({...query,[key]:value}));
  filterOptions.set(key,control);
 }
 const chips=header.createDiv({cls:'ts-library-active-filters',attr:{hidden:''}});
 const summaryLine=root.createDiv('ts-library-summary-line');
 const count=summaryLine.createDiv({cls:'ts-db-count',attr:{role:'status'}});
 const indexStatus=summaryLine.createDiv({cls:'ts-library-index-status',attr:{role:'status',hidden:''}});
 const results=root.createDiv({cls:'ts-db-results ts-library-results',attr:{'data-library-view':query.view,tabindex:'0','aria-label':'卡片库结果'}});
 const panel=root.createDiv({cls:'ts-library-more-menu',attr:{popover:'auto',role:'dialog','aria-label':'卡片操作',hidden:''}});
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
 function showMore(record:LibraryCardRecord,anchor:LibraryElement){
  const alreadyOpen=moreAnchor===anchor;
  closeMore();
  if(alreadyOpen)return;
  panel.empty();
  moreActions(panel,record,handlers);
  panel.setAttribute('aria-label','卡片操作：'+record.title);
  moreAnchor=anchor;
  anchor.setAttribute('aria-expanded','true');
  if(typeof popover.showPopover!=='function'){
   panel.removeAttribute('popover');panel.removeAttribute('hidden');
   button(panel,'收起操作',()=>closeMore(true),'ts-library-filter-reset');
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
 function recordActions(parent:LibraryElement,record:LibraryCardRecord){
  const row=parent.createDiv('ts-library-card-actions');
  const main=jumpAction(record,handlers)??{label:'放置到当前白板',run:()=>handlers.place(record.path)};
  button(row,main.label,main.run,'ts-library-main-action',{'data-library-focus':focusKey(record.path,'primary'),title:main.label});
  const more=button(row,'⋯',()=>showMore(record,more),'ts-library-more-trigger',{'aria-label':'更多操作：'+record.title,'aria-haspopup':'dialog','aria-expanded':'false','data-library-focus':focusKey(record.path,'more'),title:'更多操作'});
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
   optionRecords=records;
   optionLabels={type:types,tag:[['','全部标签'],...libraryTagChoices(records).map(tag=>[tag,'#'+tag] as const)],board:[['','全部白板'],...libraryBoardChoices(records).map(board=>[board.path,board.title] as const)],status:[['','全部状态'],...Object.entries(statuses)],choice:[['','全部分类'],[uncategorizedChoice,'未分类'],...(handlers.choiceOptions??[]).map(option=>[option,option] as const)]};
   for(const [key,control] of filterOptions)setOptions(control,optionLabels[key],query[key]);
  }
  for(const [key,control] of filterOptions)if(control.value!==query[key])control.value=query[key];
  const active=filterKeys.filter(key=>!!query[key]);
  summary.textContent=active.length?'筛选 · '+active.length:'筛选';
  chips.empty();
  if(active.length||query.query){
   for(const key of active){
    const value=query[key],label=optionLabels[key].find(([v])=>v===value)?.[1]??value;
    button(chips,filterLabels[key]+'：'+label+' ×',()=>handlers.setQuery({...query,[key]:''}),'ts-library-filter-chip',{'aria-label':'清除'+filterLabels[key]+'：'+label,'data-library-focus':focusKey('filter',key)});
   }
   if(query.query)button(chips,'搜索：'+query.query+' ×',()=>handlers.setQuery({...query,query:''}),'ts-library-filter-chip',{'aria-label':'清除搜索','data-library-focus':focusKey('filter','search')});
   button(chips,'清除全部',reset,'ts-library-filter-reset',{'data-library-focus':focusKey('filter','reset')});
   chips.removeAttribute('hidden');
  }else chips.setAttribute('hidden','');
 }
 function update(records:readonly LibraryCardRecord[],next:LibraryViewQuery,state:LibraryViewState={}){
  const doc=surface.ownerDocument,active=doc?.activeElement as HTMLElement|undefined;
  // An asynchronous index refresh should restore the specific row control, not focus the modal.
  const menuAnchor=moreAnchor&&active&&popover.contains(active)?dom(moreAnchor):undefined;
  const focus=(menuAnchor??active)?.getAttribute('data-library-focus');
  const contained=active&&dom(root).contains(active);
  const wasInResults=active&&surface.contains(active);
  if(doc)positions.set(query.view,{top:surface.scrollTop,left:surface.scrollLeft});
  query=next;
  closeMore();
  paintFilters(records);
  const shown=filterLibraryCards(records,query);
  count.textContent=shown.length+' 张卡片'+(query.selected.length?' · 已选 '+query.selected.length:'');
  const indexText=state.indexing?'正在索引白板引用…':state.limitNote??'';
  indexStatus.textContent=indexText;
  if(indexText)indexStatus.removeAttribute('hidden');
  else indexStatus.setAttribute('hidden','');
  results.empty();
  results.setAttribute('data-library-view',query.view);
  if(!shown.length){
   const empty=results.createDiv({cls:'ts-sidebar-empty ts-library-empty'});
   empty.createDiv({text:query.choice===uncategorizedChoice?'没有符合条件的未分类卡片。':records.length?'没有匹配的卡片。':'还没有卡片。'});
   if(query.query||filterKeys.some(key=>query[key]))button(empty,'清除筛选',reset,'ts-library-filter-reset',{'data-library-focus':focusKey('filter','empty-reset')});
  }else paintResults(shown,state.indexing===true);
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
  const byPath=new Map(shown.map(record=>[record.path,record])),picked=new Set(query.selected);
  const selectedCls=(path:string)=>picked.has(path)?' is-selected':'';
  const toggle=(path:string)=>{
   const next=new Set(query.selected);
   if(next.has(path))next.delete(path);else next.add(path);
   handlers.setQuery({...query,selected:[...next]});
  };
  const bindSelect=(element:LibraryElement,path:string)=>{element.onclick=event=>{
   const target=(event as {target?:{closest?:(selector:string)=>unknown}}|null)?.target;
   if(!target?.closest?.('button,select,input,textarea,a,summary,label'))toggle(path);
  };};
  const selectCard=(parent:LibraryElement,record:LibraryCardRecord)=>button(parent,picked.has(record.path)?'✓':'',()=>toggle(record.path),'ts-library-select'+(picked.has(record.path)?' ts-library-selected-mark':''),{'aria-label':'选择卡片：'+record.title,'aria-pressed':String(picked.has(record.path)),'data-library-focus':focusKey(record.path,'select')});
  const openCard=(parent:LibraryElement,record:LibraryCardRecord)=>button(parent,record.title,()=>{void handlers.open(record.path);},'ts-library-title',{'aria-label':'打开源卡片：'+record.title,title:record.title,'data-library-focus':focusKey(record.path,'open')});
  const category=(record:LibraryCardRecord)=>handlers.choiceOptions?.length?record.choice||'未分类':'';
  if(query.view==='table'){
   const table=libraryTable(shown,!!handlers.choiceOptions?.length,indexing);
   const grid=results.createEl('table',{cls:'ts-db-table'}),head=grid.createEl('thead').createEl('tr');
   for(const column of [...table.columns,'操作'])head.createEl('th',{text:column,attr:{scope:'col'}});
   const body=grid.createEl('tbody');
   for(const row of table.rows){
    const record=byPath.get(row.path)!;
    const line=body.createEl('tr',{cls:selectedCls(row.path).trim(),attr:{'data-note-path':row.path}});bindSelect(line,row.path);
    const title=line.createEl('td',{cls:'ts-library-title-cell'}).createDiv('ts-library-title-group');
    selectCard(title,record);openCard(title,record);
    for(const cell of row.cells.slice(1))line.createEl('td',{text:cell});
    recordActions(line.createEl('td',{cls:'ts-library-table-actions'}),record);
   }
   return;
  }
  const card=(parent:LibraryElement,record:LibraryCardRecord,kanban=false)=>{
   const row=parent.createDiv({cls:'ts-library-card'+selectedCls(record.path),attr:{'data-note-path':record.path}});bindSelect(row,record.path);
   const info=row.createDiv('ts-library-card-info'),title=info.createDiv('ts-library-title-group');
   selectCard(title,record);openCard(title,record);
   const detail=info.createDiv(kanban?'ts-library-tags':'ts-library-excerpt');
   if(!kanban)detail.createSpan({cls:'ts-library-chip ts-library-status-chip',text:libraryStatusLabel(record.status),attr:{'data-status':record.status}});
   const choice=category(record);
   if(choice)detail.createSpan({cls:'ts-library-chip',text:choice});
   const boardNames=record.boards.map(board=>board.title).join('、');
   const boardText=indexing&&!boardNames?'':record.indexIncomplete?(boardNames?boardNames+' · 其余白板未索引':'引用位置未索引完'):boardNames||'未放置在白板';
   const meta=[libraryTypeNames[record.type],record.highlight?highlightLocation(record.highlight):'',boardText,record.tags.join(' ')].filter(Boolean).join(' · ');
   if(meta)detail.createSpan({cls:'ts-library-card-meta-text',text:meta,attr:{title:meta}});
   if(!kanban&&Object.keys(record.custom).length){
    const properties=Object.entries(record.custom).map(([key,value])=>key+'：'+value).join('  ');
    info.createDiv({cls:'ts-library-path',text:properties,attr:{title:properties}});
   }
   recordActions(row,record);
  };
  if(query.view==='kanban'){
   const board=results.createDiv('ts-db-kanban');
   for(const column of libraryKanban(shown)){
    const lane=board.createDiv({cls:'ts-db-lane',attr:{'data-status':column.id}});
    lane.createDiv({cls:'ts-db-lane-title',text:column.label+' · '+column.cards.length});
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
