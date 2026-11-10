import {libraryTypeNames,type LibraryCardType} from './card-library-model';
import {statuses} from './database';
import {emptyLibraryQuery,filterLibraryCards,libraryBoardChoices,libraryKanban,libraryList,libraryTable,libraryTagChoices,type LibraryCardRecord,type LibraryLayout,type LibraryPlacement,type LibraryViewQuery} from './card-property-views';

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
 jump?(path:string):void;
 choiceOptions?:readonly string[];
 setChoice?(path:string,value:string):Promise<void>;
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
 if(record.highlight&&handlers.jump)button(row,'回到来源',()=>handlers.jump!(record.path));
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
 if(handlers.choiceOptions?.length)select(filters,'分类',[['', '全部分类'],...handlers.choiceOptions.map(option=>[option,option] as [string,string])],query.choice,choice=>handlers.setQuery({...query,choice}));
 const search=filters.createEl('input',{attr:{type:'search','aria-label':'搜索卡片库',placeholder:'搜索标题、标签、属性或白板…'}});
 search.value=query.query;
 search.onchange=()=>handlers.setQuery({...query,query:search.value});
 root.createDiv({cls:'ts-db-count',text:`${shown.length} 张卡片 · 正文在笔记里，白板只保存引用`});
 const results=root.createDiv({cls:'ts-db-results',attr:{'data-library-view':query.view}});
 if(!shown.length){results.createDiv({cls:'ts-sidebar-empty',text:'没有匹配的卡片。'});return;}
 if(query.view==='table'){
  const table=libraryTable(shown),grid=results.createEl('table',{cls:'ts-db-table'});
  const head=grid.createEl('tr');
  for(const column of table.columns)head.createEl('th',{text:column});
  for(const row of table.rows){
   const line=grid.createEl('tr',{attr:{'data-note-path':row.path}});
   for(const cell of row.cells)line.createEl('td',{text:cell});
   const tools=line.createEl('td');
   actions(tools,shown.find(record=>record.path===row.path)!,handlers);
  }
  return;
 }
 if(query.view==='kanban'){
  const board=results.createDiv('ts-db-kanban');
  for(const column of libraryKanban(shown)){
   const lane=board.createDiv({cls:'ts-db-lane',attr:{'data-status':column.id}});
   lane.createDiv({cls:'ts-db-lane-title',text:`${column.label} · ${column.cards.length}`});
   for(const card of column.cards){
    const item=lane.createDiv({cls:'ts-library-card',attr:{'data-note-path':card.path}});
    item.createDiv({cls:'ts-library-title',text:card.title});
    item.createDiv({cls:'ts-library-tags',text:[libraryTypeNames[card.type],...card.tags].join(' ')});
    actions(item,card,handlers);
   }
  }
  return;
 }
 for(const item of libraryList(shown)){
  const card=results.createDiv({cls:'ts-library-card',attr:{'data-note-path':item.path}});
  card.createDiv({cls:'ts-library-title',text:item.title});
  card.createDiv({cls:'ts-library-excerpt',text:item.detail});
  const record=shown.find(entry=>entry.path===item.path)!;
  if(Object.keys(record.custom).length)card.createDiv({cls:'ts-library-path',text:Object.entries(record.custom).map(([key,value])=>`${key}：${value}`).join('  ')});
  actions(card,record,handlers);
 }
}