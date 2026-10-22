import test from 'node:test';
import assert from 'node:assert/strict';
import {CollectionHeatmapView} from '../src/collection-heatmap-view';
import {collectionLocalDay,parseCollectionDay,shiftCollectionDay} from '../src/collection-calendar';

type Listener=(event:any)=>void;
class Events {
 listeners=new Map<string,Set<Listener>>();
 addEventListener(name:string,listener:Listener){let listeners=this.listeners.get(name);if(!listeners)this.listeners.set(name,listeners=new Set());listeners.add(listener);}
 removeEventListener(name:string,listener:Listener){this.listeners.get(name)?.delete(listener);}
 emit(name:string,event:any={}){for(const listener of this.listeners.get(name)||[])listener(event);}
}
class Doc extends Events {activeElement:El|null=null;visibilityState='visible';defaultView!:Win;}
class Win extends Events {
 media=Object.assign(new Events(),{matches:false});intervals=new Map<number,()=>void>();observers:Array<{callback:()=>void;disconnected:boolean}>=[];
 ResizeObserver:typeof ResizeObserver;
 constructor(){super();const observers=this.observers;this.ResizeObserver=class {disconnected=false;constructor(readonly callback:()=>void){observers.push(this);}observe(){}disconnect(){this.disconnected=true;}} as any;}
 matchMedia(){return this.media;}setInterval(fn:()=>void){const key=this.intervals.size+1;this.intervals.set(key,fn);return key;}clearInterval(key:number){this.intervals.delete(key);}
}
class El extends Events {
 children:El[]=[];parent?:El;attrs:Record<string,string>={};dataset:Record<string,string>={};classes=new Set<string>();text='';value='';title='';tabIndex=0;hidden=false;disabled=false;open=false;scrollTop=0;scrollLeft=0;clientWidth=800;
 constructor(readonly tag:string,readonly ownerDocument:Doc,options:any={}){super();if(typeof options==='string')options={cls:options};this.text=options.text||'';for(const value of(options.cls||'').split(' ').filter(Boolean))this.classes.add(value);for(const[key,value]of Object.entries(options.attr||{}))this.setAttribute(key,String(value));this.value=options.value||this.attrs.value||'';}
 createEl(tag:string,options:any={}){const child=new El(tag,this.ownerDocument,options);child.parent=this;this.children.push(child);return child;}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 setText(value:string){this.text=value;}setAttribute(name:string,value:string){this.attrs[name]=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,value:string)=>value.toUpperCase())]=value;}
 removeAttribute(name:string){delete this.attrs[name];}toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
 empty(){for(const child of this.children){if(child.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=null;child.parent=undefined;}this.children=[];}
 contains(el:El|null):boolean{return el===this||this.children.some(child=>child.contains(el));}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
 focus(){this.ownerDocument.activeElement=this;this.emit('focus');}
 all(predicate:(el:El)=>boolean):El[]{return this.children.flatMap(child=>[...(predicate(child)?[child]:[]),...child.all(predicate)]);}
 findClass(cls:string){return this.all(el=>el.classes.has(cls))[0];}
 action(name:string){return this.all(el=>el.dataset.heatmapAction===name)[0];}
 day(key:string){return this.all(el=>el.dataset.date===key)[0];}
}
function fixture(width=800,onCalendarContextChange?:()=>void,heatmapWidth=width,gridWidth=heatmapWidth){
 const doc=new Doc(),win=new Win();doc.defaultView=win;const parent=new El('main',doc);parent.clientWidth=width;
 const editor=parent.createEl('textarea');editor.value='Unfinished draft';editor.focus();const selected:string[]=[];let clears=0;
 const view=new CollectionHeatmapView(parent as any,{onSelectDay:day=>selected.push(day),onClearDates:()=>clears++,onCalendarContextChange});
 const root=parent.findClass('ts-collection-heatmap'),grid=root.findClass('ts-collection-heatmap-grid');root.clientWidth=heatmapWidth;grid.clientWidth=gridWidth;win.emit('resize');return{doc,win,parent,editor,view,root,grid,selected,clears:()=>clears};
}
function record(path:string,day:string,archived=false){return{path,createdAt:parseCollectionDay(day)!.toISOString(),archived};}
function open(f:ReturnType<typeof fixture>){const details=f.root.findClass('ts-collection-heatmap-disclosure');details.open=true;details.emit('toggle');return details;}
function key(cell:El,value:string,extra:any={}){const event={key:value,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,isComposing:false,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};cell.emit('keydown',event);return event;}
const blank={since:'',until:''};

test('collapsed metadata calendar counts archived records, explains scope, and never selects implicitly',()=>{
 const f=fixture();f.view.update([record('A','2026-10-12'),record('B','2026-10-12',true),record('C','2026-10-13')],blank);
 assert.equal(f.root.findClass('ts-collection-heatmap-disclosure').open,false);assert.equal(f.root.findClass('ts-collection-heatmap-summary-count').text,'3 条');
 assert.match(f.root.findClass('ts-collection-heatmap-note').text,/含归档.*不受筛选影响.*本地创建日期/);assert.deepEqual(f.selected,[]);assert.equal(f.doc.activeElement,f.editor);assert.equal(f.editor.value,'Unfinished draft');f.view.destroy();
});
test('single-day selection callback and clear callback are exact and external state controls range highlighting',()=>{
 const f=fixture();const records=[record('A','2026-02-10'),record('B','2026-02-10',true)];f.view.update(records,{since:'2026-02-01',until:'2026-02-12'});open(f);
 const day=f.root.day('2026-02-10');assert.equal(day.dataset.count,'2');assert.equal(day.dataset.archived,'1');assert.equal(day.attrs['aria-pressed'],'true');assert.equal(f.root.day('2026-02-13').attrs['aria-pressed'],'false');
 day.emit('click');assert.deepEqual(f.selected,['2026-02-10']);assert.match(f.root.findClass('ts-collection-heatmap-detail').text,/2 条收集（归档 1 条）.*保留其他筛选/);
 f.view.update(records,{since:'2026-02-10',until:'2026-02-10'});assert.equal(f.root.day('2026-02-09').attrs['aria-pressed'],'false');
 f.root.action('clear-dates').emit('click');assert.equal(f.clears(),1);f.view.update(records,blank);assert.equal(f.root.findClass('ts-collection-heatmap-filter').hidden,true);assert.equal(day.attrs['aria-pressed'],'false');f.view.destroy();
});
test('today and zero-record days remain visible, accessible, and selectable',()=>{
 const f=fixture(),today=collectionLocalDay(new Date());f.view.update([],blank);open(f);const day=f.root.day(today);
 assert.equal(day.attrs['aria-current'],'date');assert.match(day.attrs['aria-label'],/无新增收集.*今天/);assert.equal(day.dataset.level,'0');day.emit('click');assert.deepEqual(f.selected,[today]);f.view.destroy();
});
test('metadata updates preserve composer, collapse, day-node identity, focus and scroll while changing archived count',()=>{
 const f=fixture();f.view.update([record('A','2026-02-10',true)],{since:'2026-02-10',until:'2026-02-10'});const details=open(f),day=f.root.day('2026-02-10');day.focus();f.parent.scrollTop=271;
 f.view.update([record('renamed/A','2026-02-10',false),record('B','2026-02-10')],{since:'2026-02-10',until:'2026-02-10'});
 assert.equal(f.root.day('2026-02-10'),day);assert.equal(day.dataset.count,'2');assert.equal(day.dataset.archived,'0');assert.equal(f.doc.activeElement,day);assert.equal(f.parent.scrollTop,271);assert.equal(details.open,true);assert.equal(f.editor.value,'Unfinished draft');f.view.destroy();
});
test('month keyboard arrows, Home/End and PageUp/Down cross leap months without selecting',()=>{
 const f=fixture();f.view.update([],{since:'2024-02-28',until:'2024-02-28'});open(f);f.root.day('2024-02-28').focus();
 assert.equal(key(f.doc.activeElement!,'ArrowRight').prevented,true);assert.equal(f.doc.activeElement?.dataset.date,'2024-02-29');key(f.doc.activeElement!,'ArrowRight');assert.equal(f.doc.activeElement?.dataset.date,'2024-03-01');
 key(f.doc.activeElement!,'ArrowDown');assert.equal(f.doc.activeElement?.dataset.date,'2024-03-08');key(f.doc.activeElement!,'Home');assert.equal(f.doc.activeElement?.dataset.date,'2024-03-01');key(f.doc.activeElement!,'End');assert.equal(f.doc.activeElement?.dataset.date,'2024-03-31');
 key(f.doc.activeElement!,'PageUp');assert.equal(f.doc.activeElement?.dataset.date,'2024-02-29');key(f.doc.activeElement!,'PageDown',{shiftKey:true});assert.equal(f.doc.activeElement?.dataset.date,'2025-02-28');assert.deepEqual(f.selected,[]);f.view.destroy();
});
test('year keyboard navigates week columns and year edges with one day tabstop',()=>{
 const f=fixture(1200);f.view.update([],{since:'2024-12-24',until:'2024-12-24'});open(f);assert.equal(f.root.dataset.mode,'year');f.root.day('2024-12-24').focus();
 key(f.doc.activeElement!,'ArrowRight');assert.equal(f.doc.activeElement?.dataset.date,'2024-12-31');key(f.doc.activeElement!,'ArrowDown');assert.equal(f.doc.activeElement?.dataset.date,'2025-01-01');
 key(f.doc.activeElement!,'PageUp');assert.equal(f.doc.activeElement?.dataset.date,'2024-01-01');key(f.doc.activeElement!,'End');assert.equal(f.doc.activeElement?.dataset.date,'2024-12-31');
 assert.equal(f.root.all(el=>!!el.dataset.date&&el.tabIndex===0).length,1);assert.deepEqual(f.selected,[]);f.view.destroy();
});
test('resize changes to a touch-sized monthly calendar and preserves the focused day without stealing editor focus',()=>{
 const f=fixture(1200);f.view.update([],{since:'2026-07-11',until:'2026-07-11'});open(f);f.root.day('2026-09-18').focus();f.parent.scrollTop=600;
 f.parent.clientWidth=390;f.win.emit('resize');assert.equal(f.root.dataset.mode,'month');assert.equal(f.doc.activeElement?.dataset.date,'2026-09-18');assert.equal(f.parent.scrollTop,600);
 f.editor.focus();f.parent.clientWidth=1200;f.win.emit('resize');assert.equal(f.root.dataset.mode,'year');assert.equal(f.doc.activeElement,f.editor);
 f.win.media.matches=true;f.win.media.emit('change');assert.equal(f.root.dataset.mode,'month');assert.equal(f.doc.activeElement,f.editor);f.view.destroy();
});
for(const [width,columns] of [[44,1],[89,1],[90,2],[135,2],[136,3],[181,3],[182,4],[269,4],[319,4],[320,7]])test(`actual heatmap width ${width} uses ${columns} touch columns and matching keyboard movement`,()=>{
 const f=fixture(800,undefined,width);f.view.update([],{since:'2024-02-21',until:'2024-02-21'});open(f);const grid=f.root.findClass('ts-collection-heatmap-grid'),compact=columns<7;
 assert.equal(f.root.dataset.mode,'month');assert.equal(f.root.dataset.layout,compact?'compact':'week');assert.equal(grid.dataset.columns,String(columns));
 assert.equal(f.root.findClass('ts-collection-heatmap-weekdays').hidden,compact);assert.equal(grid.children.filter(el=>el.classes.has('ts-collection-heatmap-spacer')).length,compact?0:3);
 const day=f.root.day('2024-02-21'),weekday=day.findClass('ts-collection-heatmap-day-weekday');assert.equal(weekday.text,'周三');assert.equal(weekday.hidden,!compact);
 if(compact){assert.match(grid.attrs['aria-label'],new RegExp(`按日期顺序，${columns} 列`));assert.match(f.root.findClass('ts-collection-heatmap-caption').text,new RegExp(`${columns} 列`));}
 day.focus();key(day,'ArrowDown');assert.equal(f.doc.activeElement?.dataset.date,shiftCollectionDay('2024-02-21',columns));key(f.doc.activeElement!,'ArrowUp');assert.equal(f.doc.activeElement?.dataset.date,'2024-02-21');
 key(f.doc.activeElement!,'ArrowRight');assert.equal(f.doc.activeElement?.dataset.date,'2024-02-22');assert.deepEqual(f.selected,[]);f.view.destroy();
});
test('actual heatmap width resize preserves focus, disclosure, scroll and draft when changing compact columns',()=>{
 const f=fixture(800,undefined,320);f.view.update([],{since:'2024-02-21',until:'2024-02-21'});const disclosure=open(f);f.root.day('2024-02-21').focus();f.parent.scrollTop=300;
 for(const [width,columns] of [[319,4],[269,4],[181,3],[90,2],[44,1],[320,7]]){
  f.root.clientWidth=width;f.grid.clientWidth=width;f.win.observers[0].callback();assert.equal(f.root.dataset.columns,String(columns));assert.equal(f.doc.activeElement?.dataset.date,'2024-02-21');assert.equal(f.parent.scrollTop,300);assert.equal(disclosure.open,true);assert.equal(f.editor.value,'Unfinished draft');
 }
 f.editor.focus();f.root.clientWidth=269;f.grid.clientWidth=269;f.win.observers[0].callback();assert.equal(f.doc.activeElement,f.editor);assert.equal(f.root.dataset.layout,'compact');assert.deepEqual(f.selected,[]);f.view.destroy();
});
test('padded roots from 320 to 341 pixels use four sequential columns when their actual grid is below 320',()=>{
 for(let width=320;width<=341;width++){
  const f=fixture(800,undefined,width,width-22);f.view.update([],{since:'2024-02-21',until:'2024-02-21'});open(f);
  assert.equal(f.grid.dataset.columns,'4',`root ${width}, grid ${width-22}`);assert.equal(f.root.dataset.layout,'compact');
  assert.equal(f.root.findClass('ts-collection-heatmap-weekdays').hidden,true);assert.equal(f.grid.children.filter(el=>el.classes.has('ts-collection-heatmap-spacer')).length,0);
  assert.match(f.grid.attrs['aria-label'],/按日期顺序，4 列/);const day=f.root.day('2024-02-21');day.focus();key(day,'ArrowDown');assert.equal(f.doc.activeElement?.dataset.date,'2024-02-25');
  assert.deepEqual(f.selected,[]);assert.equal(f.editor.value,'Unfinished draft');f.view.destroy();
 }
});
test('a grid with at least 320 available pixels uses the seven weekday columns even inside a padded root',()=>{
 for(const width of [320,321,338,408]){
  const f=fixture(800,undefined,width+22,width);f.view.update([],{since:'2024-02-21',until:'2024-02-21'});open(f);
  assert.equal(f.grid.dataset.columns,'7');assert.equal(f.root.dataset.layout,'week');assert.equal(f.root.findClass('ts-collection-heatmap-weekdays').hidden,false);
  assert.equal(f.grid.children.filter(el=>el.classes.has('ts-collection-heatmap-spacer')).length,3);const day=f.root.day('2024-02-21');day.focus();key(day,'ArrowDown');assert.equal(f.doc.activeElement?.dataset.date,'2024-02-28');f.view.destroy();
 }
});
test('a collapsed zero-width grid falls back to its root then remeasures the inner width on opening',()=>{
 for(const [width,columns] of [[319,4],[320,7],[341,7]]){
  const f=fixture(800,undefined,width,0);f.view.update([],{since:'2024-02-21',until:'2024-02-21'});
  assert.equal(f.root.findClass('ts-collection-heatmap-disclosure').open,false);assert.equal(f.grid.dataset.columns,String(columns));
  f.grid.clientWidth=width-22;open(f);assert.equal(f.grid.dataset.columns,'4');assert.equal(f.root.dataset.layout,'compact');
  assert.equal(f.doc.activeElement,f.editor);assert.equal(f.editor.value,'Unfinished draft');assert.deepEqual(f.selected,[]);f.view.destroy();
 }
});
test('year options are bounded to recorded, current, and explicitly navigated years',()=>{
 const f=fixture(1200);f.view.update([record('ancient','0000-01-15'),record('future','9999-01-15')],blank);const years=f.root.action('year');
 assert.equal(years.children.length,3);assert.equal(years.children[0].value,'0');assert.equal(years.children.at(-1)?.value,'9999');
 years.value='9999';years.emit('change');f.root.day('9999-12-31').focus();key(f.doc.activeElement!,'ArrowDown');assert.equal(f.doc.activeElement?.dataset.date,'9999-12-31');key(f.doc.activeElement!,'PageDown');assert.equal(f.doc.activeElement?.dataset.date,'9999-12-31');
 years.value='0';years.emit('change');f.root.day('0000-01-01').focus();key(f.doc.activeElement!,'ArrowUp');assert.equal(f.doc.activeElement?.dataset.date,'0000-01-01');f.view.destroy();
});
test('selection invalidity is visible without falsely marking calendar days',()=>{
 const f=fixture();f.view.update([],{since:'2026-02-12',until:'2026-02-01'});assert.match(f.root.findClass('ts-collection-heatmap-filter').children[0].text,/2026-02-12.*2026-02-01/);assert.ok(f.root.all(el=>!!el.dataset.date).every(el=>el.attrs['aria-pressed']==='false'));
 f.view.update([],{since:'2026-02-30',until:''});assert.ok(f.root.all(el=>!!el.dataset.date).every(el=>el.attrs['aria-pressed']==='false'));f.view.destroy();
});
test('month and year navigation detail always describes a day in the displayed calendar',()=>{
 const f=fixture();f.view.update([],{since:'2026-02-10',until:'2026-02-10'});open(f);f.root.action('next-month').emit('click');
 assert.match(f.root.findClass('ts-collection-heatmap-detail').text,/^2026-03-01/);assert.equal(f.root.day('2026-02-10'),undefined);
 const years=f.root.action('year');years.value='2025';years.emit('change');assert.match(f.root.findClass('ts-collection-heatmap-detail').text,/^2025-03-01/);assert.deepEqual(f.selected,[]);f.view.destroy();
});
test('a thousand-record metadata snapshot is reused for filter-only updates and recollected on replacement',()=>{
 const f=fixture();let reads=0;const createdAt=parseCollectionDay('2026-05-04')!.toISOString(),records=Array.from({length:1000},(_,index)=>({path:`${index}.md`,get createdAt(){reads++;return createdAt;}}));
 f.view.update(records,{since:'2026-05-04',until:'2026-05-04'});const first=reads;assert.equal(first,1000);assert.equal(f.root.day('2026-05-04').dataset.count,'1000');
 for(let i=0;i<20;i++)f.view.update(records,i%2?blank:{since:'2026-05-04',until:'2026-05-04'});assert.equal(reads,first);
 f.view.update([...records],blank);assert.equal(reads,first*2);f.view.destroy();
});
test('a time-zone change recomputes metadata and notifies once, allowing a reentrant parent update',()=>{
 const old=process.env.TZ;let f:ReturnType<typeof fixture>|undefined,calls=0;
 try{
  process.env.TZ='UTC';const records=[{path:'near-midnight',createdAt:'2026-01-01T00:30:00.000Z'}];
  f=fixture(1200,()=>{calls++;f!.view.update(records,blank);});assert.equal(calls,0);f.view.update(records,{since:'2026-01-01',until:'2026-01-01'});assert.equal(f.root.day('2026-01-01').dataset.count,'1');
  process.env.TZ='America/New_York';f.win.emit('focus');assert.equal(calls,1);f.win.emit('focus');assert.equal(calls,1);
  f.view.update(records,{since:'2025-12-31',until:'2025-12-31'});assert.equal(f.root.day('2025-12-31').dataset.count,'1');assert.equal(calls,1);
 }finally{f?.view.destroy();if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('midnight refresh changes today without invalidating an absolute-date query',()=>{
 const old=process.env.TZ,RealDate=Date;let now=Date.parse('2026-10-14T23:59:00.000Z'),f:ReturnType<typeof fixture>|undefined,calls=0;
 class ClockDate extends RealDate {constructor(value?:string|number){super(value===undefined?now:value);}static now(){return now;}}
 try{
  process.env.TZ='UTC';globalThis.Date=ClockDate as DateConstructor;f=fixture(800,()=>calls++);open(f);assert.equal(f.root.day('2026-10-14').attrs['aria-current'],'date');
  now+=120_000;for(const refresh of f.win.intervals.values())refresh();assert.equal(calls,0);assert.equal(f.root.day('2026-10-14').attrs['aria-current'],undefined);assert.equal(f.root.day('2026-10-15').attrs['aria-current'],'date');
 }finally{f?.view.destroy();globalThis.Date=RealDate;if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
for(const width of [800,1200])test(`Apia skipped civil date is disabled and absent from keyboard navigation at width ${width}`,()=>{
 const old=process.env.TZ;let f:ReturnType<typeof fixture>|undefined;
 try{
  process.env.TZ='Pacific/Apia';assert.equal(parseCollectionDay('2011-12-30'),undefined);f=fixture(width);f.view.update([],{since:'2011-12-29',until:'2011-12-31'});open(f);
  const missing=f.root.day('2011-12-30');assert.equal(missing.disabled,true);assert.equal(missing.tabIndex,-1);assert.equal(missing.attrs['aria-pressed'],'false');assert.match(missing.attrs['aria-label'],/本地不存在日期.*不可选择/);
  missing.emit('click');assert.deepEqual(f.selected,[]);f.root.day('2011-12-29').focus();key(f.doc.activeElement!,width===800?'ArrowRight':'ArrowDown');assert.equal(f.doc.activeElement?.dataset.date,'2011-12-31');
  key(f.doc.activeElement!,width===800?'ArrowLeft':'ArrowUp');assert.equal(f.doc.activeElement?.dataset.date,'2011-12-29');assert.equal(f.root.all(el=>!!el.dataset.date&&el.tabIndex===0).length,1);assert.deepEqual(f.selected,[]);
  if(width===800){
   f.view.update([],{since:'2011-11-30',until:'2011-11-30'});f.root.day('2011-11-30').focus();key(f.doc.activeElement!,'PageDown');assert.equal(f.doc.activeElement?.dataset.date,'2011-12-31');
   f.view.update([],{since:'2012-01-30',until:'2012-01-30'});f.root.day('2012-01-30').focus();key(f.doc.activeElement!,'PageUp');assert.equal(f.doc.activeElement?.dataset.date,'2011-12-29');
  }
 }finally{f?.view.destroy();if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('time-zone refresh moves a now-unavailable calendar focus without rebuilding or selecting the draft',()=>{
 const old=process.env.TZ;let f:ReturnType<typeof fixture>|undefined;
 try{
  process.env.TZ='UTC';f=fixture();f.view.update([],{since:'2011-12-29',until:'2011-12-31'});open(f);const missing=f.root.day('2011-12-30');missing.focus();
  process.env.TZ='Pacific/Apia';f.win.emit('focus');assert.equal(f.root.day('2011-12-30'),missing);assert.equal(missing.disabled,true);assert.notEqual(f.doc.activeElement,missing);assert.ok(parseCollectionDay(f.doc.activeElement!.dataset.date));assert.equal(f.editor.value,'Unfinished draft');assert.deepEqual(f.selected,[]);
 }finally{f?.view.destroy();if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('modifier and composition keys are not consumed and teardown detaches all active listeners and timers',()=>{
 const f=fixture(),today=collectionLocalDay(new Date());open(f);const day=f.root.day(today);day.focus();
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true}])assert.equal(key(day,'ArrowRight',extra).prevented,false);
 const previous=shiftCollectionDay(today,-1)!;f.view.destroy();f.view.destroy();assert.equal(f.win.intervals.size,0);assert.equal(f.win.observers.every(observer=>observer.disconnected),true);assert.equal([...f.win.listeners.values()].every(set=>set.size===0),true);assert.equal([...f.doc.listeners.values()].every(set=>set.size===0),true);
 f.view.update([record('late',previous)],blank);day.emit('click');assert.deepEqual(f.selected,[]);assert.equal(f.parent.children.length,1);assert.equal(f.editor.value,'Unfinished draft');
});
