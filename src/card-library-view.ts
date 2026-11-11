import {libraryTypeNames,type LibraryCardType} from './card-library-model';
import {statuses} from './database';
import {highlightLocation,highlightReturnLabel} from './highlight-note';
import {emptyLibraryQuery,filterLibraryCards,libraryBoardChoices,libraryKanban,libraryList,libraryTable,libraryTagChoices,uncategorizedChoice,type LibraryCardRecord,type LibraryLayout,type LibraryPlacement,type LibraryViewQuery} from './card-property-views';

export interface LibraryElementOptions {text?:string;cls?:string;value?:string;attr?:Record<string,string>}
export interface LibraryElement {
 empty():void;
 createDiv(options?:LibraryElementOptions|string):LibraryElement;
 createEl(tag:string,options?:LibraryElementOptions):LibraryElement;
 createSpan(options?:LibraryElementOptions|string):LibraryElement;
 onclick:((event:unknown)=>void)|null;
 onchange:((event:unknown)=>void)|null;
 value:string;
 disabled:boolean;
 textContent:string|null;
}
export interface LibraryViewHandlers {
 setQuery(next:LibraryViewQuery):void;
 place(path:string):void;
 open(path:string):void;
 unlink(path:string):void;
 setStatus?(path:string,status:string):Promise<void>;
 locate?(placement:LibraryPlacement):void;
 searchUnindexed?(path:string):Promise<void>;
 jump?(path:string):void;
 choiceOptions?:readonly string[];
 setChoice?(path:string,value:string):Promise<void>;
}
/** The modal must forward every library action. A rejected action stays visible to the caller. */
export function libraryModalHandlers(host:Omit<LibraryViewHandlers,'setQuery'>,setQuery:(next:LibraryViewQuery)=>void,notice:(error:unknown)=>void,refresh:()=>void):LibraryViewHandlers{
 const report=(run:()=>unknown)=>Promise.resolve(run()).then(()=>refresh()).catch(error=>{notice(error);refresh();});
 const now=(run:()=>unknown)=>{try{run();refresh();}catch(error){notice(error);}};
 return {setQuery,place:path=>now(()=>host.place(path)),open:path=>host.open(path),unlink:path=>now(()=>host.unlink(path)),setStatus:host.setStatus?(path,status)=>report(()=>host.setStatus!(path,status)):undefined,locate:host.locate?placement=>{void report(()=>host.locate!(placement));}:undefined,jump:host.jump?path=>{void report(()=>host.jump!(path));}:undefined,setChoice:host.setChoice?(path,value)=>report(()=>host.setChoice!(path,value)):undefined,choiceOptions:host.choiceOptions,searchUnindexed:host.searchUnindexed?path=>report(()=>host.searchUnindexed!(path)):undefined};
}
const layouts:readonly [LibraryLayout,string][]=[['list','列表'],['table','表格'],['kanban','看板']];
const types:readonly [''|LibraryCardType,string][]=[['','全部类型'],['note','笔记'],['pdf','PDF'],['image','图片'],['audio','音频'],['video','视频']];
function button(parent:LibraryElement,label:string,run:()=>void,cls=''){
 const control=parent.createEl('button',{text:label,cls,attr:{type:'button','aria-label':label,'aria-pressed':cls.includes('is-active')?'true':'false'}});
 control.onclick=()=>run();
 return control;
}
function select(parent:LibraryElement,label:string,options:readonly [string,string][],value:string,change:(value:string)=>void){
 const control=parent.createEl('select',{attr:{'aria-label':label,title:label}});
 for(const [key,text] of options)control.createEl('option',{value:key,text});
 control.value=value;
 control.onchange=()=>change(control.value);
 return control;
}
function actions(parent:LibraryElement,record:LibraryCardRecord,handlers:LibraryViewHandlers){
 const row=parent.createDiv('ts-library-card-actions');
 button(row,'打开源卡片',()=>handlers.open(record.path));
 button(row,'放置到当前白板',()=>handlers.place(record.path));
 button(row,'从白板移除引用',()=>handlers.unlink(record.path));
 if(handlers.setStatus){
  select(row,'状态 '+record.title,Object.entries(statuses),record.status in statuses?record.status:'inbox',value=>{void handlers.setStatus!(record.path,value);});
 }
 if(handlers.choiceOptions?.length&&handlers.setChoice){
  select(row,'分类 '+record.title,[['', '未分类'],...handlers.choiceOptions.map(option=>[option,option] as [string,string])],record.choice,value=>{void handlers.setChoice!(record.path,value);});
 }
 if(record.highlight&&handlers.jump)button(row,highlightReturnLabel(record.highlight),()=>handlers.jump!(record.path));
 if(record.indexIncomplete&&handlers.searchUnindexed)button(row,'查找其余白板',()=>{void handlers.searchUnindexed!(record.path);});
 if(record.placements.length===1&&handlers.locate)button(row,'在白板中打开',()=>handlers.locate!(record.placements[0]));
 else if(record.placements.length>1&&handlers.locate){
  const labels=record.placements.map(place=>place.boardTitle),seen=new Map<string,number>();
  const menu=select(row,'所在白板 '+record.title,[['', '选择白板'],...record.placements.map(place=>{const n=(seen.get(place.boardTitle)||0)+1;seen.set(place.boardTitle,n);const text=labels.filter(label=>label===place.boardTitle).length>1?`${place.boardTitle} · ${n}`:place.boardTitle;return [JSON.stringify([place.boardPath,place.nodeId]),text] as [string,string];})],'',value=>{try{const parsed:unknown=JSON.parse(value);if(!Array.isArray(parsed)||parsed.length!==2)return;const place=record.placements.find(item=>item.boardPath===parsed[0]&&item.nodeId===parsed[1]);if(place)handlers.locate!(place);}catch{/* ignore a damaged menu value */}menu.value='';});
 }
}
/** Paint the card library. The note body is never rendered from the board. */
export function paintCardLibrary(root:LibraryElement,records:readonly LibraryCardRecord[],query:LibraryViewQuery=emptyLibraryQuery(),handlers:LibraryViewHandlers){
 root.empty();
 const shown=filterLibraryCards(records,query);
 const bar=root.createDiv('ts-db-top');
 const tabs=bar.createDiv({cls:'ts-db-tabs',attr:{role:'tablist','aria-label':'卡片库视图'}});
 for(const [view,label] of layouts)button(tabs,label,()=>handlers.setQuery({...query,view}),query.view===view?'is-active':'');
 const filters=root.createDiv('ts-db-filters');
 select(filters,'卡片类型',types,query.type,type=>handlers.setQuery({...query,type:type as LibraryViewQuery['type']}));
 select(filters,'标签',[['', '全部标签'],...libraryTagChoices(records).map(tag=>[tag,`#${tag}`] as [string,string])],query.tag,tag=>handlers.setQuery({...query,tag}));
 select(filters,'白板',[['', '全部白板'],...libraryBoardChoices(records).map(board=>[board.path,board.title] as [string,string])],query.board,board=>handlers.setQuery({...query,board}));
 select(filters,'状态',[['', '全部状态'],...Object.entries(statuses)],query.status,status=>handlers.setQuery({...query,status}));
 if(handlers.choiceOptions?.length)select(filters,'分类',[['', '全部分类'],[uncategorizedChoice,'未分类'],...handlers.choiceOptions.map(option=>[option,option] as [string,string])],query.choice,choice=>handlers.setQuery({...query,choice}));
 const search=filters.createEl('input',{attr:{type:'search','aria-label':'搜索卡片库',placeholder:'搜索标题、标签、属性或白板…'}});
 search.value=query.query;
 search.onchange=()=>handlers.setQuery({...query,query:search.value});
 root.createDiv({cls:'ts-db-count',text:`${shown.length} 张卡片 · 正文在笔记里，白板只保存引用`});
 const results=root.createDiv({cls:'ts-db-results',attr:{'data-library-view':query.view}});
 if(!shown.length){results.createDiv({cls:'ts-sidebar-empty',text:query.choice===uncategorizedChoice?'没有符合条件的未分类卡片。':'没有匹配的卡片。'});return;}
 const category=(record:LibraryCardRecord)=>handlers.choiceOptions?.length?record.choice||'未分类':'';
 const picked=(path:string)=>(query.selected||[]).includes(path);
 const selectedCls=(path:string)=>picked(path)?' is-selected':'';
 const mark=(parent:LibraryElement)=>{if(parent)parent.createEl('span',{cls:'ts-library-selected-mark',text:'✓',attr:{'aria-hidden':'true'}});};
 const bindSelect=(el:LibraryElement,path:string)=>{el.onclick=event=>{const target=(event as {target?:{closest?:(selector:string)=>unknown}}|null)?.target;if(target?.closest?.('button,select,input,textarea,a'))return;const next=new Set(query.selected||[]);if(next.has(path))next.delete(path);else next.add(path);handlers.setQuery({...query,selected:[...next]});};};
 if(query.view==='table'){
  const table=libraryTable(shown,!!handlers.choiceOptions?.length),grid=results.createEl('table',{cls:'ts-db-table'});
  const head=grid.createEl('tr');
  for(const column of table.columns)head.createEl('th',{text:column});
  for(const row of table.rows){
   const line=grid.createEl('tr',{cls:selectedCls(row.path).trim(),attr:{'data-note-path':row.path}});bindSelect(line,row.path);
   row.cells.forEach((cell,index)=>{const title=index===0;line.createEl('td',title?{text:cell,cls:'ts-library-title-cell',attr:{title:cell,tabindex:'0','aria-label':cell}}:{text:cell});});
   const tools=line.createEl('td');
   actions(tools,shown.find(record=>record.path===row.path)!,handlers);
   if(picked(row.path))mark(tools);
  }
  return;
 }
 if(query.view==='kanban'){
  const board=results.createDiv('ts-db-kanban');
  for(const column of libraryKanban(shown)){
   const lane=board.createDiv({cls:'ts-db-lane',attr:{'data-status':column.id}});
   lane.createDiv({cls:'ts-db-lane-title',text:`${column.label} · ${column.cards.length}`});
   for(const card of column.cards){
    const item=lane.createDiv({cls:'ts-library-card'+selectedCls(card.path),attr:{'data-note-path':card.path}});bindSelect(item,card.path);
    item.createDiv({cls:'ts-library-title',text:card.title});
    item.createDiv({cls:'ts-library-tags',text:[libraryTypeNames[card.type],category(card),card.highlight?highlightLocation(card.highlight):'',...card.tags].filter(Boolean).join(' ')});
    if(picked(card.path))mark(item);
    actions(item,card,handlers);
   }
  }
  return;
 }
 for(const item of libraryList(shown)){
  const record=shown.find(entry=>entry.path===item.path)!;
  const card=results.createDiv({cls:'ts-library-card'+selectedCls(item.path),attr:{'data-note-path':item.path}});bindSelect(card,item.path);
  card.createDiv({cls:'ts-library-title',text:item.title});
  card.createDiv({cls:'ts-library-excerpt',text:[item.detail,category(record)].filter(Boolean).join(' · ')});
  if(Object.keys(record.custom).length)card.createDiv({cls:'ts-library-path',text:Object.entries(record.custom).map(([key,value])=>`${key}：${value}`).join('  ')});
  if(picked(item.path))mark(card);
  actions(card,record,handlers);
 }
}