import {collectionCalendarDays,collectionHeatmap,collectionLocalDay,parseCollectionDay,shiftCollectionDay} from './collection-calendar';

type HeatmapRecord={path:string;createdAt:string;archived?:boolean};
export interface CollectionHeatmapSelection {since:string;until:string;}
export interface CollectionHeatmapActions {onSelectDay:(day:string)=>void;onClearDates:()=>void;onCalendarContextChange?:()=>void;}
type Day=ReturnType<typeof collectionCalendarDays>[number];
const WEEKDAYS=['一','二','三','四','五','六','日'];
const EMPTY:readonly HeatmapRecord[]=[];

/** Metadata-only calendar. Its DOM is isolated from the composer and feed. */
export class CollectionHeatmapView {
 private readonly root:HTMLDivElement;private readonly disclosure:HTMLDetailsElement;private readonly summaryCount:HTMLSpanElement;
 private readonly yearSelect:HTMLSelectElement;private readonly monthLabel:HTMLSpanElement;private readonly previous:HTMLButtonElement;private readonly next:HTMLButtonElement;
 private readonly grid:HTMLDivElement;private readonly weekdays:HTMLDivElement;private readonly monthNames:HTMLDivElement;private readonly detail:HTMLParagraphElement;private readonly caption:HTMLParagraphElement;
 private readonly filter:HTMLDivElement;private readonly filterText:HTMLSpanElement;private readonly note:HTMLParagraphElement;
 private readonly win:Window|null;private readonly media?:MediaQueryList;private observer?:ResizeObserver;private timer?:number;
 private readonly cells=new Map<string,HTMLButtonElement>();private records:readonly HeatmapRecord[]=EMPTY;private model=collectionHeatmap(EMPTY);
 private selection:CollectionHeatmapSelection={since:'',until:''};private year:number;private month:number;private yearsKey='';private today='';private clockKey='';private zoneKey='';
 private mode:'year'|'month'='month';private monthColumns=7;private calendarKey='';private focusDay='';private detailDay='';private dead=false;

 constructor(private readonly parent:HTMLElement,private readonly actions:CollectionHeatmapActions,mount:HTMLElement=parent){
  this.win=parent.ownerDocument.defaultView;const now=new Date();this.year=now.getFullYear();this.month=now.getMonth()+1;
  this.root=mount.createDiv('ts-collection-heatmap');
  this.disclosure=this.root.createEl('details',{cls:'ts-collection-heatmap-disclosure'});
  const summary=this.disclosure.createEl('summary',{cls:'ts-collection-heatmap-summary'});summary.createSpan({text:'记录热力图'});this.summaryCount=summary.createSpan('ts-collection-heatmap-summary-count');
  const body=this.disclosure.createDiv('ts-collection-heatmap-body');
  const tools=body.createDiv('ts-collection-heatmap-tools');
  this.yearSelect=tools.createEl('select',{attr:{'aria-label':'收集日历年份','data-heatmap-action':'year'}});
  this.yearSelect.addEventListener('change',()=>{this.year=Number(this.yearSelect.value);this.render();});
  const months=tools.createDiv('ts-collection-heatmap-month-navigation');
  this.previous=this.button(months,'‹','prev-month',()=>this.moveMonth(-1));this.previous.setAttribute('aria-label','上个月');
  this.monthLabel=months.createSpan('ts-collection-heatmap-month-label');
  this.next=this.button(months,'›','next-month',()=>this.moveMonth(1));this.next.setAttribute('aria-label','下个月');
  this.button(tools,'今天','today',()=>{const date=parseCollectionDay(this.today);if(!date)return;this.year=date.getFullYear();this.month=date.getMonth()+1;this.focusDay=this.detailDay=this.today;this.render();this.focusCell(this.today);});
  this.caption=body.createEl('p',{cls:'ts-collection-heatmap-caption'});
  const calendar=body.createDiv('ts-collection-heatmap-calendar');
  this.monthNames=calendar.createDiv({cls:'ts-collection-heatmap-month-names',attr:{'aria-hidden':'true'}});for(let month=1;month<=12;month++)this.monthNames.createSpan({text:`${month}月`});
  this.weekdays=calendar.createDiv({cls:'ts-collection-heatmap-weekdays',attr:{'aria-hidden':'true'}});for(const day of WEEKDAYS)this.weekdays.createSpan({text:day});
  this.grid=calendar.createDiv({cls:'ts-collection-heatmap-grid',attr:{role:'group','aria-label':'收集日期'}});
  this.detail=body.createEl('p',{cls:'ts-collection-heatmap-detail',attr:{role:'status','aria-live':'polite','aria-atomic':'true'}});
  const legend=body.createDiv({cls:'ts-collection-heatmap-legend',attr:{'aria-label':'颜色从浅到深表示新增收集数量：0、1、2 到 3、4 到 7、8 条以上'}});legend.createSpan({text:'少'});for(let level=0;level<5;level++)legend.createSpan({cls:'ts-collection-heatmap-swatch',attr:{'data-level':String(level),'aria-hidden':'true'}});legend.createSpan({text:'多'});
  this.note=body.createEl('p',{cls:'ts-collection-heatmap-note',text:'含归档 · 不受筛选影响 · 按本地创建日期。没有有效收集时间的旧笔记不计入。'});
  this.filter=this.root.createDiv('ts-collection-heatmap-filter');this.filterText=this.filter.createSpan();
  this.button(this.filter,'清除日期','clear-dates',()=>this.actions.onClearDates());
  this.disclosure.addEventListener('toggle',()=>{if(!this.dead&&this.disclosure.open){this.refreshClock();this.resize();}});
  if(this.win){
   this.media=this.win.matchMedia?.('(any-pointer: coarse)');this.media?.addEventListener('change',this.resize);
   this.win.addEventListener('resize',this.resize);this.win.addEventListener('focus',this.refreshClock);
   parent.ownerDocument.addEventListener('visibilitychange',this.refreshClock);
   const Resize=(this.win as Window&{ResizeObserver?:typeof ResizeObserver}).ResizeObserver;if(Resize){const observer=new Resize(this.resize);observer.observe(parent);observer.observe(this.root);this.observer=observer;}
   this.timer=this.win.setInterval(this.refreshClock,60_000);
  }
  this.refreshClock();this.resize();this.render();
 }

 update(records:readonly HeatmapRecord[],selection:CollectionHeatmapSelection){
  if(this.dead)return;
  const changed=selection.since!==this.selection.since||selection.until!==this.selection.until;
  this.selection={...selection};
  if(records!==this.records){this.records=records;this.model=collectionHeatmap(records);}
  if(changed){const chosen=parseCollectionDay(selection.since||selection.until);if(chosen){this.year=chosen.getFullYear();this.month=chosen.getMonth()+1;this.detailDay=collectionLocalDay(chosen);}}
  this.refreshClock();this.render();
 }

 destroy(){
  if(this.dead)return;this.dead=true;this.observer?.disconnect();this.media?.removeEventListener('change',this.resize);
  this.win?.removeEventListener('resize',this.resize);this.win?.removeEventListener('focus',this.refreshClock);
  this.parent.ownerDocument.removeEventListener('visibilitychange',this.refreshClock);
  if(this.timer!==undefined)this.win?.clearInterval(this.timer);
  this.root.remove();this.cells.clear();
 }

 private button(parent:HTMLElement,text:string,action:string,run:()=>void){const button=parent.createEl('button',{text,attr:{type:'button','data-heatmap-action':action}});button.addEventListener('click',()=>{if(!this.dead)run();});return button;}
 private refreshClock=()=>{
  if(this.dead||this.parent.ownerDocument.visibilityState==='hidden')return;
  const now=new Date(),today=collectionLocalDay(now),zone=`${now.getTimezoneOffset()}/${Intl.DateTimeFormat().resolvedOptions().timeZone}`,key=`${today}/${zone}`;
  if(key===this.clockKey)return;
  const zoneChanged=!!this.zoneKey&&zone!==this.zoneKey;
  this.today=today;this.clockKey=key;this.zoneKey=zone;this.model=collectionHeatmap(this.records);this.render();
  if(zoneChanged)this.actions.onCalendarContextChange?.();
 };
 private resize=()=>{
  if(this.dead)return;
  const width=this.grid.clientWidth||this.root.clientWidth,mode=this.parent.clientWidth>=900&&!this.media?.matches?'year':'month';
  const columns=mode==='month'&&width<320?Math.max(1,Math.min(4,Math.floor((width+2)/46))):7;
  if(mode===this.mode&&columns===this.monthColumns)return;
  const active=this.activeDay();if(active&&mode==='month'){const date=parseCollectionDay(active);if(date)this.month=date.getMonth()+1;}
  this.mode=mode;this.monthColumns=columns;this.render();
 };
 private activeDay(){const active=this.parent.ownerDocument.activeElement;for(const [day,cell] of this.cells)if(active===cell)return day;return undefined;}
 private availableYears(){return [...new Set([...this.model.years,Number(this.today.slice(0,4)),this.year])].sort((a,b)=>a-b);}
 private moveMonth(delta:number){
  const year=this.year+(this.month+delta<1?-1:this.month+delta>12?1:0);if(year<0||year>9999)return;
  this.year=year;this.month=this.month+delta<1?12:this.month+delta>12?1:this.month+delta;this.render();
 }
 private inSelection(day:string){const {since,until}=this.selection;if(!since&&!until||since&&!parseCollectionDay(since)||until&&!parseCollectionDay(until)||since&&until&&since>until)return false;return(!since||day>=since)&&(!until||day<=until);}
 private render(){
  if(this.dead)return;
  const scroll=this.parent.scrollTop,active=this.activeDay(),compact=this.mode==='month'&&this.monthColumns<7;
  const years=this.availableYears(),yearsKey=years.join(',');
  if(yearsKey!==this.yearsKey){this.yearsKey=yearsKey;this.yearSelect.empty();for(const year of years)this.yearSelect.createEl('option',{text:`${year} 年`,value:String(year)});}
  this.yearSelect.value=String(this.year);this.monthLabel.setText(`${this.month} 月`);
  this.previous.hidden=this.next.hidden=this.monthLabel.hidden=this.mode==='year';this.weekdays.hidden=this.mode==='year'||compact;this.monthNames.hidden=this.mode!=='year';
  this.previous.disabled=this.year===0&&this.month===1;this.next.disabled=this.year===9999&&this.month===12;
  this.root.dataset.mode=this.mode;this.grid.dataset.mode=this.mode;this.root.dataset.layout=this.grid.dataset.layout=compact?'compact':'week';this.root.dataset.columns=this.grid.dataset.columns=String(this.monthColumns);
  this.summaryCount.setText(`${this.model.total} 条`);
  this.caption.setText(this.mode==='year'?`${this.year} 年 · 每列一周，周一在上`:`${this.year} 年 ${this.month} 月 · ${compact?`按日期顺序 · ${this.monthColumns} 列`:'点击日期查看记录'}`);
  this.grid.setAttribute('aria-label',`${this.year} 年${this.mode==='month'?` ${this.month} 月`:''}收集日期${compact?`，按日期顺序，${this.monthColumns} 列`:''}`);
  const days=collectionCalendarDays(this.year).filter(day=>this.mode==='year'||day.month===this.month),key=`${this.mode}/${this.year}/${this.mode==='month'?this.month:''}/${this.monthColumns}`;
  if(key!==this.calendarKey){
   this.calendarKey=key;this.grid.empty();this.cells.clear();
   const offset=days.length&&!compact?(days[0].weekday+6)%7:0;
   for(let i=0;i<offset;i++)this.grid.createSpan({cls:'ts-collection-heatmap-spacer',attr:{'aria-hidden':'true'}});
   for(const day of days){
    const cell=this.grid.createEl('button',{cls:'ts-collection-heatmap-day',attr:{type:'button','data-date':day.key}});
    cell.createSpan({cls:'ts-collection-heatmap-day-number',text:String(day.day),'attr':{'aria-hidden':'true'}});
    const weekday=cell.createSpan({cls:'ts-collection-heatmap-day-weekday',text:`周${WEEKDAYS[(day.weekday+6)%7]}`,attr:{'aria-hidden':'true'}});weekday.hidden=!compact;
    cell.addEventListener('click',()=>{if(this.dead||cell.disabled)return;this.focusDay=this.detailDay=day.key;this.syncCells(days);this.renderDetail();this.actions.onSelectDay(day.key);});
    cell.addEventListener('focus',()=>{if(this.dead||cell.disabled)return;this.focusDay=this.detailDay=day.key;this.syncCells(days);this.renderDetail();});
    cell.addEventListener('keydown',event=>this.keydown(event,day));this.cells.set(day.key,cell);
   }
  }
  const reachable=(day:string)=>this.cells.has(day)&&!!parseCollectionDay(day);
  if(!reachable(this.focusDay))this.focusDay=active&&reachable(active)?active:reachable(this.selection.since)?this.selection.since:reachable(this.today)?this.today:days.find(day=>reachable(day.key))?.key||'';
  if(!reachable(this.detailDay))this.detailDay=this.focusDay;
  this.syncCells(days);this.renderDetail();
  const {since,until}=this.selection;this.filter.hidden=!since&&!until;
  this.filterText.setText(since===until&&since?`日期筛选：${since}`:`日期筛选：${since||'不限'} — ${until||'不限'}`);
  this.note.setText(`含归档 · 不受筛选影响 · 按本地创建日期。没有有效收集时间的旧笔记不计入。${this.model.ignored?` ${this.model.ignored} 条无效时间记录未计入。`:''}`);
  if(active){const restore=reachable(active)?active:this.focusDay;if(this.parent.ownerDocument.activeElement!==this.cells.get(restore))this.focusCell(restore);}
  this.parent.scrollTop=scroll;
 }
 private syncCells(days:readonly Day[]){
  for(const day of days){const cell=this.cells.get(day.key);if(!cell)continue;const value=this.model.days.get(day.key),count=value?.count||0,archived=value?.archived||0;
   const valid=!!parseCollectionDay(day.key),today=valid&&day.key===this.today,selected=valid&&this.inSelection(day.key),level=count===0?0:count===1?1:count<4?2:count<8?3:4;
   cell.disabled=!valid;cell.setAttribute('aria-disabled',String(!valid));cell.dataset.count=String(count);cell.dataset.archived=String(archived);cell.dataset.level=String(level);cell.tabIndex=valid&&day.key===this.focusDay?0:-1;
   cell.setAttribute('aria-pressed',String(selected));cell.toggleClass('is-today',today);cell.toggleClass('is-selected',selected);
   if(today)cell.setAttribute('aria-current','date');else cell.removeAttribute('aria-current');
   const label=valid?`${day.key}，星期${WEEKDAYS[(day.weekday+6)%7]}，${count?`${count} 条新增收集`:'无新增收集'}${archived?`，其中 ${archived} 条已归档`:''}${today?'，今天':''}${selected?'，在日期筛选内':''}`:`${day.key}，本地不存在日期，不可选择`;
   cell.setAttribute('aria-label',label);cell.title=label;
  }
 }
 private renderDetail(){const day=this.detailDay||this.focusDay||this.today,value=this.model.days.get(day);this.detail.setText(`${day} · ${value?.count||0} 条收集（归档 ${value?.archived||0} 条）。点击后保留其他筛选，列表可能更少。`);}
 private focusCell(day:string){const cell=this.cells.get(day);if(cell&&!cell.disabled)cell.focus({preventScroll:true});}
 private keydown(event:KeyboardEvent,day:Day){
  if(this.dead||!parseCollectionDay(day.key)||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
  let target:string|undefined;
  const delta=this.mode==='year'?{ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1}:{ArrowLeft:-1,ArrowRight:1,ArrowUp:-this.monthColumns,ArrowDown:this.monthColumns};
  if(event.key in delta)target=shiftCollectionDay(day.key,delta[event.key as keyof typeof delta]);
  else if(event.key==='Home'||event.key==='End'){const days=collectionCalendarDays(this.year).filter(value=>(this.mode==='year'||value.month===this.month)&&!!parseCollectionDay(value.key));target=(event.key==='Home'?days[0]:days.at(-1))?.key;}
  else if(event.key==='PageUp'||event.key==='PageDown'){
   const direction=event.key==='PageUp'?-1:1,step=this.mode==='year'||event.shiftKey?12:1,monthIndex=day.month-1+direction*step,year=this.year+Math.floor(monthIndex/12),month=(monthIndex%12+12)%12+1;
   if(year>=0&&year<=9999){const days=collectionCalendarDays(year).filter(value=>value.month===month&&!!parseCollectionDay(value.key));target=(direction>0?days.find(value=>value.day>=day.day)||days.at(-1):days.filter(value=>value.day<=day.day).at(-1)||days[0])?.key;}
  }else return;
  event.preventDefault();event.stopPropagation();if(!target)return;
  const date=parseCollectionDay(target);if(!date)return;
  this.year=date.getFullYear();this.month=date.getMonth()+1;this.focusDay=this.detailDay=target;this.render();this.focusCell(target);
 }
}
