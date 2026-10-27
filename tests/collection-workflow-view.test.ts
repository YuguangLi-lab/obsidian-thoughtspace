import * as reviewFeature from '../src/collection-review';
import * as duplicateFeature from '../src/collection-duplicates';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as density from '../src/workspace-density';
import * as collectionSearch from '../src/collection-search';
import * as collectionBackground from '../src/collection-background';
import * as calendar from '../src/collection-calendar';
class HeatmapStub {
 records:readonly any[]=[];dates:any={};destroyed=false;
 constructor(readonly parent:any,readonly callbacks:any){}
 update(records:readonly any[],dates:any){this.records=records;this.dates={...dates};}
 destroy(){this.destroyed=true;}
}
import {searchCollectionRecords} from '../src/collection-search';

class Doc {
 activeElement:El|null=null;body!:El;defaultView={closed:false,setTimeout,clearTimeout};
}
class El {
 children:El[]=[];parentElement?:El;classes=new Set<string>();attrs:Record<string,string>={};dataset:Record<string,string>={};
 value='';text='';checked=false;disabled=false;hidden=false;visible=true;scrollTop=0;clientWidth=800;style={};listeners=new Map<string,(event:any)=>void>();onclick?:()=>void;
 constructor(readonly tagName:string,readonly ownerDocument:Doc,options:any={}){if(typeof options==='string')options={cls:options};this.text=options.text||'';for(const name of(options.cls||'').split(' ').filter(Boolean))this.classes.add(name);for(const[key,value]of Object.entries(options.attr||{}))this.setAttribute(key,String(value));}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 get classList(){return{contains:(name:string)=>this.classes.has(name)};}
 getBoundingClientRect(){return{top:this.tagName==='ARTICLE'?100:0};}
 closest(selector:string):El|undefined{return this.matches(selector)?this:this.parentElement?.closest(selector);}
 get isConnected():boolean{return this.tagName==='ROOT'||!!this.parentElement?.isConnected;}
 get options(){return this.children;}
 createEl(tag:string,options:any={}){const child=new El(tag.toUpperCase(),this.ownerDocument,options);child.parentElement=this;this.children.push(child);return child;}
 setCssProps(values:Record<string,string>){Object.assign(this.style,values);}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 setAttribute(key:string,value:string){this.attrs[key]=value;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase())]=value;}
 addClass(...names:string[]){names.forEach(name=>this.classes.add(name));}removeClass(name:string){this.classes.delete(name);}toggleClass(name:string,enabled:boolean){if(enabled)this.classes.add(name);else this.classes.delete(name);}setText(value:string){this.text=value;}
 contains(element:El|null):boolean{return !!element&&(element===this||this.children.some(child=>child.contains(element)));}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];}
 getClientRects(){return this.visible?[{}]:[];}
 addEventListener(name:string,listener:(event:any)=>void){this.listeners.set(name,listener);}
 focus(){this.ownerDocument.activeElement=this;}
 matches(selector:string){if(selector.startsWith('[')&&selector.endsWith(']'))return selector.slice(1,-1) in this.attrs;if(selector.startsWith('.'))return this.classes.has(selector.slice(1));if(selector==='span:last-child')return this.tagName==='SPAN'&&this.parentElement?.children.at(-1)===this;return this.tagName===selector.toUpperCase();}
 querySelectorAll(selector:string):El[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
}
type Event={key:string;metaKey:boolean;ctrlKey:boolean;altKey:boolean;shiftKey:boolean;repeat:boolean;isComposing:boolean;keyCode:number;defaultPrevented:boolean;stopped:boolean;target:El;view:Doc['defaultView'];preventDefault:()=>void;stopPropagation:()=>void};
type Handler={modifiers:string[];key:string;func:(event:Event)=>unknown};
class Scope {
 handlers:Handler[]=[];
 constructor(readonly parent?:Scope){}
 register(modifiers:string[],key:string,func:Handler['func']){const handler={modifiers,key,func};this.handlers.push(handler);return handler;}
 unregister(handler:Handler){this.handlers=this.handlers.filter(item=>item!==handler);}
 /** A host shortcut is dispatched in capture, before bubbling reaches a view. */
 dispatch(event:Event):unknown {
  for(const handler of this.handlers)if(handler.key===event.key&&handler.modifiers.includes('Mod')&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&handler.func(event)===false)return false;
  return this.parent?.dispatch(event);
 }
}
class ItemView {
 contentEl:El;app:any;
 constructor(readonly leaf:any){this.contentEl=leaf.contentEl;this.app=leaf.app;}
 registerDomEvent(element:El,name:string,listener:(event:any)=>void){element.addEventListener(name,listener);}registerEvent(){}
}
class Component {load(){}unload(){}}
const source=readFileSync('src/collection-view.ts','utf8'),compiled=transformSync(source,{loader:'ts',format:'cjs'}).code;
const module={exports:{} as {CollectionView:new(leaf:any,host:any)=>any}};
new Function('require','module','exports',compiled)((name:string)=>{
 if(name==='obsidian')return{ItemView,Component,Scope,MarkdownRenderer:{render:async()=>{}},setIcon:()=>{}};
 if(name==='./workspace-density')return density;
 if(name==='./collection-review')return reviewFeature;
 if(name==='./collection-search')return collectionSearch;
 if(name==='./collection-background')return collectionBackground;
 if(name==='./collection-calendar')return calendar;
 if(name==='./collection-heatmap-view')return{CollectionHeatmapView:HeatmapStub};
 if(name==='./collection-attachment-browser')return{CollectionAttachmentBrowser:class {open(){}close(){}}};
 if(name==='./collection-note-export-modal')return{CollectionNoteExportModal:class {open(){}close(){}}};
 if(name==='./mobile-viewport')return{bindMobileViewport:()=>()=>{}};
 throw Error('Unexpected dependency: '+name);
},module,module.exports);
const View=module.exports.CollectionView;
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function fixture(initialRecords:any[]=[],appearance:{accent?:string;density?:string}={},features:Record<string,any>={}){
 let records=initialRecords,session='session-shortcut';
 const doc=new Doc();doc.body=new El('ROOT',doc);const content=doc.body.createDiv(),outside=doc.body.createEl('input'),parent=new Scope();let nativeEffects=0,calls=0,released=0;
 parent.register(['Mod'],'Enter',event=>{nativeEffects++;event.preventDefault();event.stopPropagation();return false;});
 const handlers=new Map<string,(...args:any[])=>void>();const leaf:any={contentEl:content},workspace={active:leaf,get activeLeaf(){return this.active;},getMostRecentLeaf(){return this.active;},requestSaveLayout(){},on:(name:string,fn:(...args:any[])=>void)=>{handlers.set(name,fn);return{};}};leaf.app={scope:parent,workspace};
 const draft={body:'待记录正文',tags:'',attachments:[],busy:false,locked:false,canSubmit:true};let finish:(()=>void)|undefined;
 let listener:((kind?:string)=>void)|undefined;
 const host={accent:()=>appearance.accent,density:()=>appearance.density,ready:async()=>{},sessionId:()=>session,setSessionId:async(id:string)=>{session=id;},draft:()=>draft,updateDraft:(patch:any)=>Object.assign(draft,patch),subscribe:(fn:(kind?:string)=>void)=>{listener=fn;return()=>{listener=undefined;};},list:async()=>records,readBody:async()=> 'shared native body',release:()=>{released++;},
  submit:async(current:()=>boolean)=>{assert.equal(current(),true);calls++;await new Promise<void>(resolve=>{finish=resolve;});draft.body='';draft.canSubmit=false;}};
 Object.assign(host,features);const view=new View(leaf,host);await view.onOpen();view.bodyInput.focus();
 const event=(patch:Partial<Event>={}):Event=>({key:'Enter',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,keyCode:13,defaultPrevented:false,stopped:false,target:doc.activeElement!,view:doc.defaultView,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...patch});
 const dispatch=(input:Event)=>{const result=view.scope.dispatch(input);if(!input.stopped)view.root.listeners.get('keydown')?.(input);return result;};
 return{emit:(kind='records')=>listener?.(kind),handlers,view,doc,content,outside,leaf,workspace,draft,host,parent,event,dispatch,setRecords:(next:any[])=>{records=next;},finish:()=>finish?.(),calls:()=>calls,native:()=>nativeEffects,released:()=>released};
}

const record=(index:number,extra:any={})=>({id:`capture-record-${index}`,path:`Notes/${index}.md`,title:`Note ${index}`,createdAt:new Date(Date.UTC(2026,9,13,0,index)).toISOString(),tags:['#topic'],inBoard:false,placements:[],...extra});
const result=(records:any[],extra:any={})=>({hits:records.map(record=>({record})),scanned:0,total:0,unread:0,cancelled:false,...extra});
const deferred=<T,>()=>{let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function pendingSearch(f:Awaited<ReturnType<typeof fixture>>){
 const calls:Array<{options:any;current:()=>boolean;progress:(value:any)=>void;pending:ReturnType<typeof deferred<any>>}>=[];
 (f.host as any).search=(options:any,current:()=>boolean,progress:(value:any)=>void)=>{const pending=deferred<any>();calls.push({options,current,progress,pending});return pending.promise;};return calls;
}
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const action=(root:El,name:string)=>root.querySelectorAll('[data-collection-action]').find(el=>el.dataset.collectionAction===name)!;

test('duplicate warning is advisory: cancel retains input and save-anyway confirms exactly once',async()=>{
 let scans=0;const f=await fixture([record(1)],{}, {checkDuplicates:async()=>{scans++;return{matches:[record(1)],unread:0,scanned:1,cancelled:false};}});
 await f.view.submit();assert.equal(f.calls(),0);assert.equal(scans,1);action(f.view.duplicatePanel,'duplicate-cancel').onclick!();assert.equal(f.draft.body,'待记录正文');assert.equal(f.view.duplicatePanel,undefined);
 await f.view.submit();action(f.view.duplicatePanel,'duplicate-save-anyway').onclick!();await settle();assert.equal(f.calls(),1);assert.equal(scans,2);f.finish();await settle();await f.view.onClose();
});
for(const reason of ['cancel','edit','navigation','close'] as const)test(`duplicate ${reason} invalidates a late scan without saving or reviving its warning`,async()=>{
 const pending=deferred<any>();let current!:()=>boolean;const f=await fixture([record(1)],{}, {checkDuplicates:async(_body:string,valid:()=>boolean)=>{current=valid;return pending.promise;}});const work=f.view.submit();assert.equal(current(),true);
 if(reason==='cancel')action(f.view.duplicatePanel,'duplicate-cancel').onclick!();if(reason==='edit')f.view.patch({body:'new input'});if(reason==='navigation')f.handlers.get('active-leaf-change')!({});if(reason==='close')await f.view.onClose();assert.equal(current(),false);
 pending.resolve({matches:[record(1)],unread:0,scanned:1,cancelled:false});await work;assert.equal(f.calls(),0);assert.equal(f.view.duplicatePanel,undefined);if(reason!=='close')await f.view.onClose();
});
test('duplicate unread sources demand explicit confirmation and a changed draft cannot reuse old approval',async()=>{
 const f=await fixture([],{}, {checkDuplicates:async()=>({matches:[],unread:1,scanned:1,cancelled:false})});await f.view.submit();const old=action(f.view.duplicatePanel,'duplicate-save-anyway');assert.equal(f.calls(),0);f.view.patch({body:'revised'});old.onclick!();await settle();assert.equal(f.calls(),0);assert.equal(f.view.duplicatePanel,undefined);await f.view.onClose();
});

test('heatmap date selection retains other conditions and composer while cancelling old search and batch selection',async()=>{
 const records=[record(1),record(2,{archived:true})],f=await fixture(records,{}, {search:search(records),batch:async()=>report(records)});
 const heatmap=f.view.heatmap as HeatmapStub,composer=f.view.bodyInput;
 f.view.query='needle';f.view.tag='#topic';f.view.filter='archived';f.view.pinnedOnly=true;f.view.page=3;f.view.appliedFilterId='old-filter';
 f.view.selected.set('old',records[0]);f.view.selectionMode=true;
 const calls=pendingSearch(f);f.view.requestSearch();const old=calls[0];assert.equal(old.current(),true);
 heatmap.callbacks.onSelectDay('2026-10-13');
 assert.equal(old.current(),false);assert.equal(f.view.selected.size,0);assert.equal(f.view.page,0);assert.equal(f.view.appliedFilterId,undefined);
 assert.deepEqual(calls.at(-1)!.options,{query:'#topic needle',includeBody:false,scope:'archived',pinnedOnly:true,since:'2026-10-13',until:'2026-10-13'});
 assert.equal(f.view.bodyInput,composer);assert.equal(f.draft.body,'待记录正文');assert.equal(f.doc.activeElement,composer);
 assert.equal(heatmap.records.length,2);assert.deepEqual(heatmap.dates,{since:'2026-10-13',until:'2026-10-13'});await f.view.onClose();
});
test('heatmap date selection and clear never silently restart a body scan',async()=>{
 const records=[record(1)],f=await fixture(records,{}, {search:search(records)}),calls=pendingSearch(f),heatmap=f.view.heatmap as HeatmapStub;
 f.view.query='body needle';f.view.includeBody=true;f.view.manualBodyMode=false;
 heatmap.callbacks.onSelectDay('2026-10-13');assert.equal(calls.length,0);assert.equal(f.view.bodyAwaitingStart,true);assert.equal(f.view.root.dataset.collectionSearchState,'awaiting-start');
 action(f.view.searchPanel,'start-search').onclick!();assert.equal(calls.length,1);assert.equal(calls[0].options.since,'2026-10-13');
 heatmap.callbacks.onClearDates();assert.equal(calls[0].current(),false);assert.equal(calls.length,1);assert.equal(f.view.bodyAwaitingStart,true);assert.equal(f.view.query,'body needle');assert.equal(f.view.includeBody,true);
 assert.deepEqual(heatmap.dates,{since:'',until:''});await f.view.onClose();
});
test('heatmap metadata refresh includes archived records while a body filter waits and preserves draft selection and scroll',async()=>{
 const initial=[record(1)],f=await fixture(initial,{}, {search:search(initial)}),calls=pendingSearch(f),heatmap=f.view.heatmap as HeatmapStub;
 f.view.includeBody=true;f.view.manualBodyMode=true;f.view.requestSearch();
 const composer=f.view.bodyInput;composer.selectionStart=2;composer.selectionEnd=4;f.view.main.scrollTop=253;
 const next=[record(1,{path:'Renamed.md',archived:true}),record(2)];f.setRecords(next);await f.view.refreshMembership();
 assert.equal(heatmap.records,next);assert.equal(calls.length,0);assert.equal(f.view.bodyAwaitingStart,true);assert.equal(f.view.bodyInput,composer);
 assert.deepEqual([composer.selectionStart,composer.selectionEnd],[2,4]);assert.equal(f.view.main.scrollTop,253);assert.equal(f.doc.activeElement,composer);assert.equal(f.draft.body,'待记录正文');await f.view.onClose();
});
test('saved filter dates and date inputs synchronize the heatmap without changing its aggregate source',async()=>{
 const records=[record(1),record(2,{archived:true})],entry={id:'saved-day',name:'一天',options:{query:'',since:'2026-10-13',until:'2026-10-13',scope:'all'}},f=await fixture(records,{}, {search:search(records),savedFilters:async()=>({filters:[entry]})}),heatmap=f.view.heatmap as HeatmapStub;
 await settle();f.view.applySavedFilter(entry);await settle();assert.equal(action(f.view.savedList,'apply-filter').attrs['aria-pressed'],'true');
 assert.deepEqual(heatmap.dates,{since:'2026-10-13',until:'2026-10-13'});assert.equal(heatmap.records.length,2);
 f.view.sinceInput.value='2026-10-12';f.view.sinceInput.onchange();assert.equal(heatmap.dates.since,'2026-10-12');
 heatmap.callbacks.onClearDates();assert.equal(f.view.sinceInput.value,'');assert.equal(f.view.untilInput.value,'');assert.equal(heatmap.records.length,2);assert.equal(action(f.view.savedList,'apply-filter').attrs['aria-pressed'],'false');await f.view.onClose();
});
test('metadata-only fallback applies the selected local day and retains archive scope',async()=>{
 const first=record(1,{createdAt:new Date(2026,9,13,12).toISOString()}),other=record(2,{createdAt:new Date(2026,9,14,12).toISOString()}),archived=record(3,{createdAt:first.createdAt,archived:true});
 const f=await fixture([first,other,archived]);f.view.heatmap.callbacks.onSelectDay('2026-10-13');assert.deepEqual(f.view.filteredRecords().map((r:any)=>r.path),[first.path]);
 f.view.changeFilter('archived');assert.deepEqual(f.view.filteredRecords().map((r:any)=>r.path),[archived.path]);await f.view.onClose();
});
test('invalid heatmap dates cause no navigation or query mutation and closing destroys its observers',async()=>{
 const f=await fixture([record(1)]),heatmap=f.view.heatmap as HeatmapStub,epoch=f.view.searchEpoch;
 for(const day of ['2026-02-30','nonsense','2026-1-1'])heatmap.callbacks.onSelectDay(day);
 assert.equal(f.view.searchEpoch,epoch);assert.equal(f.view.since,'');await f.view.onClose();assert.equal(heatmap.destroyed,true);assert.equal(f.view.heatmap,undefined);
});
test('timezone changes invalidate date results without restarting body scans or disturbing an undated query',async()=>{
 const records=[record(1)],f=await fixture(records,{}, {search:search(records)}),heatmap=f.view.heatmap as HeatmapStub,calls=pendingSearch(f);
 heatmap.callbacks.onCalendarContextChange();assert.equal(calls.length,0);
 heatmap.callbacks.onSelectDay('2026-10-13');assert.equal(calls.length,1);
 const old=calls[0];heatmap.callbacks.onCalendarContextChange();assert.equal(old.current(),false);assert.equal(calls.length,2);assert.equal(calls[1].options.since,'2026-10-13');
 f.view.includeBody=true;f.view.manualBodyMode=false;f.view.requestSearch(0,true);assert.equal(calls.length,3);const pending=calls[2];
 heatmap.callbacks.onCalendarContextChange();assert.equal(pending.current(),false);assert.equal(calls.length,3);assert.equal(f.view.bodyAwaitingStart,true);assert.equal(f.draft.body,'待记录正文');await f.view.onClose();
});
test('metadata-only fallback explains a reversed date range and calendar clear recovers it',async()=>{
 const f=await fixture([record(1)]),composer=f.view.bodyInput;
 f.view.sinceInput.value='2026-10-14';f.view.sinceInput.onchange();f.view.untilInput.value='2026-10-13';
 assert.doesNotThrow(()=>f.view.untilInput.onchange());assert.match(f.view.searchFeedback.text,/开始日期不能晚于结束日期/);assert.equal(f.view.filteredRecords().length,0);
 f.view.heatmap.callbacks.onClearDates();assert.equal(f.view.filteredRecords().length,1);assert.equal(f.view.searchFeedback.text,'');assert.equal(f.view.bodyInput,composer);await f.view.onClose();
});

const saved=(includeBody=false)=>({id:'saved-research',name:'研究线索',options:{query:'blue #topic -#later',includeBody,scope:'unplaced',pinnedOnly:true,since:'2026-10-01',until:'2026-10-13'}});
const report=(records:any[],statuses:string[]=records.map(()=> 'confirmed'),extra:any={})=>{const counts:any={'not-started':0,running:0,confirmed:0,'already-present':0,'not-written':0,unknown:0};for(const status of statuses)counts[status]++;return{version:1,id:'batch-ui-1',createdAt:'2026-10-13T12:00:00.000Z',operation:'archive',items:records.map((record,index)=>({source:{id:record.id,createdAt:record.createdAt,path:record.path,title:record.title,expectedArchived:!!record.archived},status:statuses[index]})),phase:'completed',readOnly:true,journalConfirmed:true,counts,...extra};};
const search=(records:any[])=>async(options:any,current:()=>boolean)=>searchCollectionRecords(records,options,{current,readBody:async()=> 'blue body'});

test('saving current conditions persists the effective tag query without searching or rebuilding the draft',async()=>{
 const records=[record(1)],filters:any[]=[],saves:any[]=[],f=await fixture(records,{}, {savedFilters:async()=>({filters}),saveFilter:async(name:string,options:any,current:()=>boolean)=>{assert.equal(current(),true);saves.push({name,options});const value={id:'saved-new',name,options};filters.push(value);return value;}});await settle();const composer=f.view.bodyInput,calls=pendingSearch(f);
 f.view.query='blue -#later';f.view.tag='#topic';f.view.filter='unplaced';f.view.includeBody=true;f.view.pinnedOnly=true;f.view.since='2026-10-01';f.view.until='2026-10-13';action(f.view.nav,'show-save-filter').onclick!();f.view.savedName.value='研究';await f.view.saveCurrentFilter();
 assert.deepEqual(saves,[{name:'研究',options:{query:'#topic blue -#later',scope:'unplaced',includeBody:true,pinnedOnly:true,since:'2026-10-01',until:'2026-10-13'}}]);assert.equal(calls.length,0);assert.equal(f.view.saved.length,1);assert.equal(f.view.bodyInput,composer);assert.equal(f.draft.body,'待记录正文');assert.equal(f.view.savedForm.hidden,true);await f.view.onClose();
});
test('applying a body saved filter waits for explicit Start, edits disarm it, and IME never authorizes a scan',async()=>{
 const f=await fixture([record(1)],{}, {savedFilters:async()=>({filters:[saved(true)]})});await settle();const calls=pendingSearch(f),composer=f.view.bodyInput;f.view.applySavedFilter(saved(true));
 assert.equal(calls.length,0);assert.equal(f.view.tag,'');assert.equal(f.view.query,'blue #topic -#later');assert.equal(f.view.bodySearchToggle.checked,true);assert.equal(f.view.sinceInput.value,'2026-10-01');assert.equal(f.view.root.dataset.collectionSearchState,'awaiting-start');assert.equal(action(f.view.searchPanel,'start-search').hidden,false);
 f.view.search.listeners.get('keydown')({key:'Enter',isComposing:false,keyCode:229,preventDefault(){throw Error('IME');}});assert.equal(calls.length,0);
 action(f.view.searchPanel,'start-search').onclick!();assert.equal(calls.length,1);assert.equal(calls[0].options.includeBody,true);calls[0].pending.resolve(result([]));await settle();
 f.view.search.value='new';f.view.search.oninput();await wait(220);assert.equal(calls.length,1);assert.equal(f.view.root.dataset.collectionSearchState,'awaiting-start');
 f.view.search.listeners.get('compositionstart')();f.view.search.value='新的';f.view.search.oninput();f.view.search.listeners.get('compositionend')();await wait(220);assert.equal(calls.length,1);
 f.view.search.listeners.get('keydown')({key:'Enter',isComposing:false,keyCode:13,preventDefault(){}});assert.equal(calls.length,2);calls[1].pending.resolve(result([]));await settle();await f.view.refreshRecords();assert.equal(calls.length,2);assert.equal(f.view.root.dataset.collectionSearchState,'awaiting-start');assert.equal(f.view.bodyInput,composer);await f.view.onClose();
});
test('a direct body checkbox remains explicit authorization outside saved-filter manual mode',async()=>{
 const f=await fixture([record(1)]),calls=pendingSearch(f);f.view.bodySearchToggle.checked=true;f.view.bodySearchToggle.onchange();assert.equal(calls.length,1);assert.equal(calls[0].options.includeBody,true);calls[0].pending.resolve(result([]));await settle();await f.view.onClose();
});
test('saved filter warnings are read-only and do not trigger searches on load or filter events',async()=>{
 let writes=0;const f=await fixture([record(1)],{}, {savedFilters:async()=>({filters:[saved(true)],warning:'文件损坏，保留原文件'}),saveFilter:async()=>{writes++;},deleteFilter:async()=>{writes++;}});await settle();const calls=pendingSearch(f);assert.equal(f.view.savedSave.disabled,true);assert.equal(action(f.view.savedList,'delete-filter').disabled,true);await f.view.saveCurrentFilter();await f.view.deleteSavedFilter('saved-research');f.emit('filters');await settle();assert.equal(writes,0);assert.equal(calls.length,0);assert.match(f.view.savedStatus.text,/保留原文件/);await f.view.onClose();
});
test('delete confirmation removes only the saved filter and retains the applied conditions and results',async()=>{
 let filters:any[]=[saved(false)],deletes=0;const f=await fixture([record(1)],{}, {savedFilters:async()=>({filters}),deleteFilter:async(id:string,current:()=>boolean)=>{assert.equal(current(),true);deletes++;filters=filters.filter(item=>item.id!==id);}});await settle();f.view.applySavedFilter(filters[0]);const before=f.view.searchOptions();action(f.view.savedList,'delete-filter').onclick!();assert.equal(deletes,0);action(f.view.savedList,'confirm-delete-filter').onclick!();await settle();assert.equal(deletes,1);assert.deepEqual(f.view.searchOptions(),before);assert.equal(f.view.saved.length,0);await f.view.onClose();
});
test('selection is explicit, limited to the 24 current-page results, and never selects the hidden reveal extra',async()=>{
 const records=Array.from({length:26},(_,i)=>record(i)),hidden=record(30,{archived:true});const f=await fixture([...records,hidden],{}, {search:search([...records,hidden]),batch:async()=>report([])});await settle();assert.equal(f.view.selected.size,0);assert.equal(f.view.cards.length,24);action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();assert.equal(f.view.selected.size,24);
 action(f.view.pagination,'next').onclick!();assert.equal(f.view.selected.size,0);assert.equal(f.view.selectionMode,false);assert.equal(f.view.cards.length,2);
 await f.view.revealRecord(hidden,()=>true);assert.equal(f.view.cards.length,3);action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();assert.equal(f.view.selected.size,2);assert.equal(f.view.cards.find((card:any)=>card.record.id===hidden.id).row.querySelector('[data-collection-select]'),undefined);await f.view.onClose();
});
for(const reason of ['query','filter','date','navigation','session','reveal','external'] as const)test(`${reason} clears selection and invalidates a delayed target picker`,async()=>{
 const records=[record(1),record(2)],target=deferred<any>();let pickerCurrent!:()=>boolean;const f=await fixture(records,{}, {search:search(records),batch:async()=>report(records),pickTarget:async(current:()=>boolean)=>{pickerCurrent=current;return target.promise;}});action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();const prepare=f.view.prepareBatch('deliver');assert.equal(pickerCurrent(),true);
 if(reason==='query'){f.view.search.value='new';f.view.search.oninput();}if(reason==='filter')f.view.changeFilter('archived');if(reason==='date'){f.view.sinceInput.value='2026-10-02';f.view.sinceInput.onchange();}if(reason==='navigation')f.handlers.get('active-leaf-change')!({});if(reason==='session')await f.view.setState({collectionSession:'new-session'});if(reason==='reveal')await f.view.revealRecord(records[0],()=>true);if(reason==='external')f.emit();
 assert.equal(pickerCurrent(),false);target.resolve({key:'board',title:'目标',path:'Boards/test.canvas',groups:[]});await prepare;assert.equal(f.view.batchReview,undefined);assert.equal(f.view.selected.size,0);await f.view.onClose();
});
test('delivery review shows the exact selected notes and target group, and confirmation freezes the request',async()=>{
 const records=[record(1),record(2)],requests:any[]=[],pending=deferred<any>();const f=await fixture(records,{}, {search:search(records),pickTarget:async()=>({key:'opaque-board',title:'研究板',path:'Boards/research.canvas',groups:[{id:'group-a',title:'读书'}]}),batch:async(request:any)=>{requests.push(request);return pending.promise;}});action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();await f.view.prepareBatch('deliver');assert.equal(requests.length,0);const panel=f.view.batchPanel.querySelector('[data-collection-batch-review]');assert.equal(panel.querySelectorAll('li').length,2);const group=panel.querySelector('[data-collection-batch-group]');group.value='group-a';group.onchange();action(panel,'confirm-batch').onclick!();action(panel,'confirm-batch').onclick!();assert.equal(requests.length,1);assert.equal(requests[0].target.groupId,'group-a');assert.equal(requests[0].target.key,'opaque-board');assert.equal(requests[0].items.length,2);assert.equal(f.view.selected.size,0);pending.resolve(report(records));await settle();assert.equal(f.view.batchRunning,false);await f.view.onClose();
});
test('a frozen batch survives its own index refreshes and preserves success, unknown and unstarted separately',async()=>{
 const records=[record(1),record(2),record(3)],pending=deferred<any>();let current!:()=>boolean,progress!:(report:any)=>void;const f=await fixture(records,{}, {search:search(records),batch:async(_request:any,valid:()=>boolean,onProgress:(value:any)=>void)=>{current=valid;progress=onProgress;return pending.promise;}});const composer=f.view.bodyInput;action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();await f.view.prepareBatch('archive');const run=f.view.confirmBatch();progress(report(records,['confirmed','running','not-started'],{phase:'running',readOnly:false}));f.emit();await wait(100);assert.equal(current(),true);assert.equal(f.view.batchRunning,true);assert.equal(f.view.bodyInput,composer);
 const stopped=report(records,['confirmed','unknown','not-started'],{phase:'review-required'});pending.resolve(stopped);await run;assert.equal(f.view.batchReport.counts.confirmed,1);assert.equal(f.view.batchReport.counts.unknown,1);assert.equal(f.view.batchReport.counts['not-started'],1);assert.equal(f.view.batchPanel.querySelectorAll('[data-collection-batch-item]').length,3);assert.equal(action(f.view.batchPanel,'batch-inspect').dataset.collectionAction,'batch-inspect');await f.view.onClose();
});
for(const reason of ['stop','query','page','navigation','session','close'] as const)test(`${reason} stops not-started batch work but retains an in-flight confirmed receipt`,async()=>{
 const records=Array.from({length:25},(_,i)=>record(i)),pending=deferred<any>();let current!:()=>boolean;const f=await fixture(records,{}, {search:search(records),batch:async(_request:any,valid:()=>boolean)=>{current=valid;return pending.promise;}});action(f.view.selectionBar,'select-mode').onclick!();f.view.selectRecord(f.view.cards[0].record,true);await f.view.prepareBatch('restore');const run=f.view.confirmBatch();assert.equal(current(),true);
 if(reason==='stop')action(f.view.batchPanel,'stop-batch').onclick!();if(reason==='query'){f.view.search.value='Note';f.view.search.oninput();}if(reason==='page')action(f.view.pagination,'next').onclick!();if(reason==='navigation')f.handlers.get('active-leaf-change')!({});if(reason==='session')await f.view.setState({collectionSession:'new-batch-session'});if(reason==='close')await f.view.onClose();assert.equal(current(),false);pending.resolve(report([records[24]],['confirmed'],{phase:'cancelled'}));await run;if(reason!=='close'){assert.equal(f.view.batchReport.counts.confirmed,1);assert.equal(f.view.batchRunning,false);await f.view.onClose();}
});
test('reopened batch reports are read-only and never restore selections, target or execute actions',async()=>{
 const records=[record(1)],history=report(records,['unknown'],{phase:'review-required',readOnly:true,warning:'上次结果待核对'});let executions=0;const f=await fixture(records,{}, {batch:async()=>{executions++;return history;},batchReports:async()=>({reports:[history]})});await settle();assert.equal(executions,0);assert.equal(f.view.selected.size,0);assert.equal(f.view.batchReview,undefined);assert.equal(f.view.batchRunning,false);const box=f.view.batchPanel.querySelector('[data-collection-batch-report]');assert.equal(box.dataset.collectionBatchReadonly,'true');assert.equal(action(box,'confirm-batch'),undefined);assert.equal(action(box,'stop-batch'),undefined);assert.deepEqual(f.view.getState(),{collectionSession:'session-shortcut'});await f.view.setState({collectionSession:'session-shortcut'});assert.equal(executions,0);await f.view.onClose();
});
test('own checkbox accent selectors are scoped away from Markdown task checkboxes',()=>{
 const css=readFileSync('src/collection-view.css','utf8');assert.match(css,/\.ts-collection-check-field>input\[type=checkbox\]:checked\{background-color:var\(--ts-c-accent\);border-color:var\(--ts-c-accent\)\}/);assert.doesNotMatch(css,/\.ts-collection input\[type=checkbox\]:checked/);
});
test('partial, cancelled, stale or superseded results cannot enter selection mode',async()=>{
 const records=[record(1)],f=await fixture(records,{}, {search:async()=>result(records,{unread:1}),batch:async()=>report(records)});assert.equal(f.view.root.dataset.collectionSearchState,'complete');assert.equal(f.view.canSelect(),false);action(f.view.selectionBar,'select-mode').onclick!();assert.equal(f.view.selectionMode,false);assert.match(f.view.selectModeButton.attrs.title,/未能读取/);
 f.view.searchResult.value.unread=0;assert.equal(f.view.canSelect(),true);f.view.searchResult.value.cancelled=true;assert.equal(f.view.canSelect(),false);f.view.searchResult.value.cancelled=false;f.view.stale=true;assert.equal(f.view.canSelect(),false);f.view.stale=false;f.view.searchEpoch++;assert.equal(f.view.canSelect(),false);await f.view.onClose();
});
for(const operation of ['deliver','archive','restore'] as const)test(`${operation} describes already-present receipts in the operation's own terms`,async()=>{
 const records=[record(1)],f=await fixture(records,{}, {batch:async()=>report(records)});f.view.batchReport=report(records,['already-present'],{operation});f.view.renderBatchPanel();const box=f.view.batchPanel.querySelector('[data-collection-batch-report]'),text=box.querySelectorAll('p')[0].text,badge=box.querySelector('.ts-collection-state-badge').text;assert.match(text,operation==='deliver'?/已有引用 1/:/状态已符合 1/);assert.equal(badge,operation==='deliver'?'已有引用':'状态已符合');await f.view.onClose();
});
test('a batch archive that removes the last page does not stop itself during internal focus restoration',async()=>{
 let records=Array.from({length:25},(_,i)=>record(i));const pending=deferred<any>();let current!:()=>boolean;const f=await fixture(records,{}, {search:async(options:any,valid:()=>boolean)=>search(records)(options,valid),batch:async(_request:any,valid:()=>boolean)=>{current=valid;return pending.promise;}});action(f.view.pagination,'next').onclick!();assert.equal(f.view.page,1);action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();await f.view.prepareBatch('archive');const run=f.view.confirmBatch();f.view.bodyInput.focus();records=records.slice(1);f.setRecords(records);f.emit();await wait(110);assert.equal(f.view.page,0);assert.equal(current(),true);assert.equal(f.doc.activeElement,f.view.bodyInput);pending.resolve(report([record(0)]));await run;await f.view.onClose();
});
test('another view batch notification reloads only read-only history without changing selection, draft or body authorization',async()=>{
 const records=[record(1)],own=report(records,['confirmed'],{id:'batch-own'});let reports:any[]=[],reads=0,searches=0,executions=0;const f=await fixture(records,{}, {search:async(options:any,current:()=>boolean)=>{searches++;return search(records)(options,current);},batch:async()=>{executions++;return own;},batchReports:async()=>{reads++;return{reports};}});await settle();
 f.view.batchReport=own;f.view.renderBatchPanel();action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();const selectionEpoch=f.view.selectionEpoch,selected=[...f.view.selected.keys()],searchEpoch=f.view.searchEpoch,composer=f.view.bodyInput,beforeSearches=searches;let draftSyncs=0;f.view.syncDraft=()=>{draftSyncs++;};
 reports=[report(records,['unknown'],{id:'batch-other-view',phase:'review-required',readOnly:true})];const beforeReads=reads;f.emit('batches');await settle();assert.equal(reads,beforeReads+1);assert.equal(f.view.batchReport,own);assert.deepEqual([...f.view.selected.keys()],selected);assert.equal(f.view.selectionEpoch,selectionEpoch);assert.equal(f.view.searchEpoch,searchEpoch);assert.equal(searches,beforeSearches);assert.equal(draftSyncs,0);assert.equal(f.view.bodyInput,composer);assert.equal(f.draft.body,'待记录正文');assert.equal(executions,0);
 const history=f.view.batchPanel.querySelector('[data-collection-batch-history]');assert.equal(history.querySelector('[data-collection-batch-report]').dataset.collectionBatchReadonly,'true');assert.equal(action(history,'confirm-batch'),undefined);
 f.view.applySavedFilter(saved(true));const waitingEpoch=f.view.searchEpoch;f.emit('batches');await settle();assert.equal(f.view.manualBodyMode,true);assert.equal(f.view.bodyAwaitingStart,true);assert.equal(f.view.root.dataset.collectionSearchState,'awaiting-start');assert.equal(f.view.searchEpoch,waitingEpoch);assert.equal(searches,beforeSearches);assert.equal(draftSyncs,0);assert.equal(executions,0);await f.view.onClose();
});
test('batch history notification does not replace or invalidate an in-flight local batch report',async()=>{
 const records=[record(1)],pending=deferred<any>(),live=report(records,['running'],{id:'batch-live',phase:'running',readOnly:false});let current!:()=>boolean,progress!:(report:any)=>void,executions=0;const f=await fixture(records,{}, {search:search(records),batch:async(_request:any,valid:()=>boolean,onProgress:(value:any)=>void)=>{current=valid;progress=onProgress;executions++;return pending.promise;},batchReports:async()=>({reports:[report(records,['confirmed'],{id:'batch-elsewhere'})]})});await settle();action(f.view.selectionBar,'select-mode').onclick!();action(f.view.selectionBar,'select-page').onclick!();await f.view.prepareBatch('archive');const run=f.view.confirmBatch();progress(live);const epoch=f.view.batchEpoch;f.emit('batches');await settle();assert.equal(f.view.batchReport,live);assert.equal(f.view.batchEpoch,epoch);assert.equal(f.view.batchRunning,true);assert.equal(current(),true);assert.equal(executions,1);pending.resolve(report(records,['confirmed'],{id:'batch-live'}));await run;await f.view.onClose();
});
