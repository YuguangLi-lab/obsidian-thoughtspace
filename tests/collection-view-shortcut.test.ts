import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as density from '../src/workspace-density';
import * as collectionSearch from '../src/collection-search';
import * as calendar from '../src/collection-calendar';
class HeatmapStub {
 records:readonly any[]=[];dates:any={};destroyed=false;
 constructor(readonly parent:any,readonly callbacks:any){}
 update(records:readonly any[],dates:any){this.records=records;this.dates={...dates};}
 destroy(){this.destroyed=true;}
}

class Doc {
 activeElement:El|null=null;body!:El;defaultView={closed:false};
}
class El {
 children:El[]=[];parentElement?:El;classes=new Set<string>();attrs:Record<string,string>={};dataset:Record<string,string>={};
 value='';text='';disabled=false;hidden=false;visible=true;scrollTop=0;clientWidth=800;style={};listeners=new Map<string,(event:any)=>void>();onclick?:()=>void;
 constructor(readonly tagName:string,readonly ownerDocument:Doc,options:any={}){if(typeof options==='string')options={cls:options};this.text=options.text||'';for(const name of(options.cls||'').split(' ').filter(Boolean))this.classes.add(name);for(const[key,value]of Object.entries(options.attr||{}))this.setAttribute(key,String(value));}
 get classList(){return{contains:(name:string)=>this.classes.has(name)};}
 getBoundingClientRect(){return{top:this.tagName==='ARTICLE'?100:0};}
 closest(selector:string):El|undefined{return this.matches(selector)?this:this.parentElement?.closest(selector);}
 get isConnected():boolean{return this.tagName==='ROOT'||!!this.parentElement?.isConnected;}
 get options(){return this.children;}
 createEl(tag:string,options:any={}){const child=new El(tag.toUpperCase(),this.ownerDocument,options);child.parentElement=this;this.children.push(child);return child;}
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
 if(name==='./collection-search')return collectionSearch;
 if(name==='./collection-calendar')return calendar;
 if(name==='./collection-heatmap-view')return{CollectionHeatmapView:HeatmapStub};
 if(name==='./collection-attachment-browser')return{CollectionAttachmentBrowser:class {open(){}close(){}}};
 if(name==='./collection-note-export-modal')return{CollectionNoteExportModal:class {open(){}close(){}}};
 if(name==='./mobile-viewport')return{bindMobileViewport:()=>()=>{}};
 throw Error('Unexpected dependency: '+name);
},module,module.exports);
const View=module.exports.CollectionView;
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function fixture(initialRecords:any[]=[],appearance:{accent?:string;density?:string}={}){
 let records=initialRecords;
 const doc=new Doc();doc.body=new El('ROOT',doc);const content=doc.body.createDiv(),outside=doc.body.createEl('input'),parent=new Scope();let nativeEffects=0,calls=0,released=0;
 parent.register(['Mod'],'Enter',event=>{nativeEffects++;event.preventDefault();event.stopPropagation();return false;});
 const leaf:any={contentEl:content},workspace={active:leaf,get activeLeaf(){return this.active;},getMostRecentLeaf(){return this.active;},requestSaveLayout(){},on:()=>({})};leaf.app={scope:parent,workspace};
 const draft={body:'待记录正文',tags:'',attachments:[],busy:false,locked:false,canSubmit:true};let finish:(()=>void)|undefined;
 const host={accent:()=>appearance.accent,density:()=>appearance.density,ready:async()=>{},sessionId:()=> 'session-shortcut',setSessionId:async()=>{},draft:()=>draft,updateDraft:(patch:any)=>Object.assign(draft,patch),subscribe:()=>()=>{},list:async()=>records,readBody:async()=> 'shared native body',release:()=>{released++;},
  submit:async(current:()=>boolean)=>{assert.equal(current(),true);calls++;await new Promise<void>(resolve=>{finish=resolve;});draft.body='';draft.canSubmit=false;}};
 const view=new View(leaf,host);await view.onOpen();view.bodyInput.focus();
 const event=(patch:Partial<Event>={}):Event=>({key:'Enter',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,keyCode:13,defaultPrevented:false,stopped:false,target:doc.activeElement!,view:doc.defaultView,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...patch});
 const dispatch=(input:Event)=>{const result=view.scope.dispatch(input);if(!input.stopped)view.root.listeners.get('keydown')?.(input);return result;};
 return{view,doc,content,outside,leaf,workspace,draft,host,parent,event,dispatch,setRecords:(next:any[])=>{records=next;},finish:()=>finish?.(),calls:()=>calls,native:()=>nativeEffects,released:()=>released};
}

for(const modifier of ['metaKey','ctrlKey'] as const)test(`view scope saves ${modifier}+Enter before the native parent consumes it`,async()=>{
 const f=await fixture(),event=f.event({metaKey:false,[modifier]:true});
 assert.equal(f.view.scope.parent,f.parent);assert.equal(f.dispatch(event),false);assert.equal(f.calls(),1);assert.equal(f.native(),0);assert.equal(event.defaultPrevented,true);
 f.view.root.listeners.get('keydown')?.(event);assert.equal(f.calls(),1,'the same prevented event must not submit twice through DOM fallback');
 f.finish();await settle();assert.equal(f.draft.body,'');assert.equal(f.doc.activeElement,f.view.bodyInput,'submission never moves focus');
});
test('a held shortcut and fresh repeated presses cannot submit a second pending note',async()=>{
 const f=await fixture();f.dispatch(f.event());f.dispatch(f.event({repeat:true}));f.dispatch(f.event());assert.equal(f.calls(),1);f.finish();await settle();
});
for(const reason of ['event-ime','legacy-ime','view-ime','other-field','other-window-target','other-window-event','other-leaf','hidden','closed-window','prevented','alt','shift','repeat','plain-enter'] as const)test(`shortcut does not submit while ${reason}`,async()=>{
 const f=await fixture(),event=f.event();
 if(reason==='event-ime')event.isComposing=true;if(reason==='legacy-ime')event.keyCode=229;if(reason==='view-ime')f.view.composing=true;
 if(reason==='other-field'){f.outside.focus();event.target=f.outside;}
 if(reason==='other-window-target'){const other=new Doc();event.target=new El('ROOT',other);}
 if(reason==='other-window-event')event.view=new Doc().defaultView;
 if(reason==='other-leaf')f.workspace.active={};if(reason==='hidden')f.view.root.visible=false;if(reason==='closed-window')f.doc.defaultView.closed=true;
 if(reason==='prevented')event.defaultPrevented=true;if(reason==='alt')event.altKey=true;if(reason==='shift')event.shiftKey=true;if(reason==='repeat')event.repeat=true;if(reason==='plain-enter')event.metaKey=false;
 const before=f.draft.body;f.dispatch(event);await settle();assert.equal(f.calls(),0);assert.equal(f.draft.body,before);
});
test('two owner windows dispatch only the focused collection session',async()=>{
 const a=await fixture(),b=await fixture();const event=b.event();a.view.scope.dispatch(event);assert.equal(a.calls(),0);
 // A separate native window starts a separate dispatch; its event was not used
 // by the other view even when its own input still retains document focus.
 b.dispatch(b.event());assert.equal(b.calls(),1);b.finish();await settle();assert.equal(a.draft.body,'待记录正文');
});
test('closing unregisters the native handler and the retained callback cannot save',async()=>{
 const f=await fixture(),scope=f.view.scope,handler=scope.handlers[0];assert.equal(scope.handlers.length,1);
 await f.view.onClose();assert.equal(scope.handlers.length,0);assert.equal(f.released(),1);handler.func(f.event());assert.equal(f.calls(),0);
});

const record=(index:number,extra:any={})=>({id:`capture-record-${index}`,path:`Notes/${index}.md`,title:`Note ${index}`,createdAt:new Date(Date.UTC(2026,9,13,0,index)).toISOString(),tags:['#topic'],inBoard:false,placements:[],...extra});
test('return to a filtered-out record retains filters and restores original page, scroll and focus',async()=>{
 const items=Array.from({length:55},(_,i)=>record(i)),f=await fixture(items);f.view.filter='unplaced';f.view.tag='#topic';f.view.query='Note';f.view.page=1;f.view.renderFeed();f.view.main.scrollTop=432;
 const original=f.view.cards[2];const control=original.row.querySelectorAll('[data-collection-action]').find((button:El)=>button.dataset.collectionAction==='more');control.focus();
 const target=record(80,{inBoard:true,tags:['#hidden']});f.setRecords([...items,target]);await f.view.revealRecord(target,()=>true);
 assert.equal(f.view.filter,'unplaced');assert.equal(f.view.tag,'#topic');assert.equal(f.view.query,'Note');assert.equal(f.view.cards[0].record.id,target.id);assert.equal(f.doc.activeElement,f.view.cards[0].row);assert.equal(f.view.cards.length,25,'one explicit temporary result plus one bounded page');
 assert.match(f.view.feed.querySelector('.ts-collection-return-banner').children[0].text,/临时展示/);await f.view.dismissLocated();assert.equal(f.view.page,1);assert.equal(f.view.main.scrollTop,432);assert.equal(f.doc.activeElement?.dataset.collectionAction,'more');assert.equal(f.doc.activeElement?.closest('[data-collection-id]')?.dataset.collectionId,original.record.id);
});
test('return to a matching record finds its exact page without resetting query and tag',async()=>{
 const items=Array.from({length:70},(_,i)=>record(i)),f=await fixture(items);f.view.query='Note';f.view.tag='#topic';await f.view.revealRecord(items[2],()=>true);assert.equal(f.view.page,2);assert.equal(f.view.query,'Note');assert.equal(f.view.tag,'#topic');assert.equal(f.doc.activeElement?.dataset.collectionId,items[2].id);assert.equal(f.view.cards.length,22);
});
test('cancelled or duplicate identity resolution cannot focus or replace the current feed',async()=>{
 const item=record(1),f=await fixture([item]);const before=f.view.cards[0].row;await f.view.revealRecord(item,()=>false);assert.equal(f.view.cards[0].row,before);assert.equal(f.view.located,undefined);
 f.setRecords([item,{...item,path:'Notes/copy.md'}]);await assert.rejects(f.view.revealRecord(item,()=>true),/重复/);assert.equal(f.view.cards[0].row,before);f.setRecords([]);await assert.rejects(f.view.revealRecord(item,()=>true),/移除/);
});
test('membership refresh updates exact instances without rebuilding composer, previews or focus',async()=>{
 const item=record(1),f=await fixture([item]),input=f.view.bodyInput,row=f.view.cards[0].row;input.focus();const placements=[{key:'a',boardPath:'Boards/A.md',boardTitle:'Alpha',nodeId:'one',nodeTitle:'Card one'},{key:'b',boardPath:'Boards/A.md',boardTitle:'Alpha',nodeId:'two',nodeTitle:'Card two'}];
 f.setRecords([{...item,inBoard:true,placements}]);await f.view.refreshMembership();assert.equal(f.view.bodyInput,input);assert.equal(f.view.cards[0].row,row);assert.equal(f.doc.activeElement,input);const details=row.querySelector('.ts-collection-placement-list');assert.equal(details.children[0].text,'所在白板 · 2 处');assert.deepEqual(details.children.slice(1).map((button:El)=>button.dataset.collectionNode),['one','two']);
 f.setRecords([{...item,path:'Notes/renamed.md',placements:[],inBoard:false}]);await f.view.refreshMembership();assert.equal(f.view.cards[0].row,row);assert.equal(row.dataset.path,'Notes/renamed.md');assert.equal(row.querySelector('.ts-collection-placements').children.length,0);
});
test('many instances remain bounded and expose the shared complete occurrence picker',async()=>{
 const placements=Array.from({length:1000},(_,i)=>({key:String(i),boardPath:'B.md',boardTitle:'Board',nodeId:String(i),nodeTitle:'Card'})),f=await fixture([record(1,{placements,inBoard:true})]);const details=f.view.cards[0].row.querySelector('.ts-collection-placement-list');assert.equal(details.children.length,10);assert.equal(details.children.at(-1).dataset.collectionAction,'occurrences');assert.match(details.children[0].text,/1000/);
});
test('position restore waits for actual preview readiness before repairing a clamped scroll offset',async()=>{
 const f=await fixture(Array.from({length:8},(_,i)=>record(i)));await settle();const card=f.view.cards[3];let ready!:()=>void;card.previewReady=new Promise<void>(resolve=>{ready=resolve;});let height=100,position=0;
 Object.defineProperty(f.view.main,'scrollTop',{get:()=>position,set:(value:number)=>{position=Math.min(height,Math.max(0,value));},configurable:true});card.row.getBoundingClientRect=()=>({top:600-position,bottom:750-position});f.view.main.getBoundingClientRect=()=>({top:0,bottom:400});
 const location={page:0,scroll:550,anchorId:card.record.id,anchorOffset:50,recordId:card.record.id};const restoring=f.view.restoreCollectionLocation(location,()=>true);assert.equal(position,100,'short placeholders clamp the first scroll attempt');height=1200;ready();await restoring;assert.equal(position,550);assert.equal(card.row.getBoundingClientRect().top,50);assert.equal(f.doc.activeElement,card.row);
});
test('manual scrolling during awaited preview prevents late scroll repair and focus takeover',async()=>{
 const f=await fixture([record(1)]);await settle();const card=f.view.cards[0];let ready!:()=>void;card.previewReady=new Promise<void>(resolve=>{ready=resolve;});const restoring=f.view.restoreCollectionLocation({page:0,scroll:550,recordId:card.record.id,anchorId:card.record.id,anchorOffset:50},()=>true);f.view.main.listeners.get('wheel')?.({});f.view.main.scrollTop=123;f.outside.focus();ready();await restoring;assert.equal(f.view.main.scrollTop,123);assert.equal(f.doc.activeElement,f.outside);
});
test('changed membership keeps its focused instance and removing the last reference retains card focus',async()=>{
 const item=record(1,{inBoard:true,placements:[{key:'a',boardPath:'A.md',boardTitle:'A',nodeId:'a',nodeTitle:'Card'}]}),f=await fixture([item]);let button=f.view.cards[0].placements.querySelector('button');button.focus();f.setRecords([{...item,placements:[{...item.placements[0],nodeTitle:'Renamed card'}]}]);await f.view.refreshMembership();button=f.view.cards[0].placements.querySelector('button');assert.equal(f.doc.activeElement,button);assert.match(button.attrs.title,/Renamed card/);f.setRecords([{...item,inBoard:false,placements:[]}]);await f.view.refreshMembership();assert.equal(f.doc.activeElement,f.view.cards[0].row);
});
test('focused sidebar Collection dispatches its save shortcut independently of most recent main leaf',async()=>{
 const f=await fixture(),mainLeaf={};f.workspace.getMostRecentLeaf=()=>mainLeaf;assert.equal(f.workspace.activeLeaf,f.leaf);assert.notEqual(f.workspace.getMostRecentLeaf(),f.leaf);f.dispatch(f.event());assert.equal(f.calls(),1);f.finish();await settle();assert.equal(f.draft.body,'');
});
test('a main Collection does not capture a shortcut after focus moves to a sidebar even if mostRecentLeaf is unchanged',async()=>{
 const f=await fixture();f.workspace.getMostRecentLeaf=()=>f.leaf;f.workspace.active={};f.dispatch(f.event());assert.equal(f.calls(),0);assert.equal(f.draft.body,'待记录正文');
});
test('sidebar membership refresh restores the exact focused placement control using the actual active leaf',async()=>{
 const item=record(1,{inBoard:true,placements:[{key:'a',boardPath:'A.md',boardTitle:'A',nodeId:'a',nodeTitle:'Card'}]}),f=await fixture([item]);f.workspace.getMostRecentLeaf=()=>({});f.view.cards[0].placements.querySelector('button').focus();f.setRecords([{...item,placements:[{...item.placements[0],nodeTitle:'Changed'}]}]);await f.view.refreshMembership();assert.equal(f.doc.activeElement,f.view.cards[0].placements.querySelector('button'));
});
test('changing left navigation search cancels a pending browse restoration without resetting its new focus or scroll',async()=>{
 const f=await fixture([record(1),record(2)]);await settle();const card=f.view.cards[0];let ready!:()=>void;card.previewReady=new Promise<void>(resolve=>{ready=resolve;});const restoring=f.view.restoreCollectionLocation({page:0,scroll:550,recordId:card.record.id,anchorId:card.record.id,anchorOffset:50},()=>true);
 f.view.search.focus();f.view.search.value='Note 1';f.view.search.oninput();f.view.main.scrollTop=21;ready();await restoring;assert.equal(f.view.query,'Note 1');assert.equal(f.view.main.scrollTop,21);assert.equal(f.doc.activeElement,f.view.search);assert.deepEqual(f.view.cards.map((item:any)=>item.record.id),['capture-record-1']);
});
test('changing left navigation search cancels a pending record reveal after its body has been requested',async()=>{
 const f=await fixture([record(1),record(2)]);await settle();let ready!:()=>void;const wait=new Promise<void>(resolve=>{ready=resolve;});f.host.readBody=async()=>{await wait;return 'Delayed native preview';};const revealing=f.view.revealRecord(record(2),()=>true);await settle();
 f.view.search.focus();f.view.search.value='Note 1';f.view.search.oninput();f.view.main.scrollTop=21;ready();await revealing;assert.equal(f.view.query,'Note 1');assert.equal(f.view.main.scrollTop,21);assert.equal(f.doc.activeElement,f.view.search);
});
test('changing a filter while record metadata loads cancels the older reveal before it rebuilds the feed',async()=>{
 const f=await fixture([record(1),record(2)]);let ready!:()=>void;const wait=new Promise<void>(resolve=>{ready=resolve;});f.host.list=async()=>{await wait;return[record(1),record(2)];};const revealing=f.view.revealRecord(record(2),()=>true);f.view.changeFilter('unplaced');const before=f.view.cards[0].row;f.view.main.scrollTop=21;f.view.search.focus();ready();await revealing;assert.equal(f.view.cards[0].row,before);assert.equal(f.view.located,undefined);assert.equal(f.view.main.scrollTop,21);assert.equal(f.doc.activeElement,f.view.search);
});

for(const accent of ['forest','blue','amber','rose'])test(`Collection applies chosen ${accent} accent and compact density on its first open`,async()=>{
 const f=await fixture([],{accent,density:'compact'});assert.equal(f.content.dataset.accent,accent);assert.equal(f.content.dataset.density,'compact');assert.equal(f.draft.body,'待记录正文');assert.equal(f.calls(),0);await f.view.onClose();
});
test('Collection preference refresh changes only appearance and keeps reading, editing and owned session state',async()=>{
 const appearance={accent:'forest',density:'comfortable'},f=await fixture([record(1),record(2)],appearance);await settle();
 const input=f.view.bodyInput,card=f.view.cards[0],scope=card.scope,session=f.view.getState(),draft={...f.draft};f.view.main.scrollTop=321;f.view.query='Note';f.view.tag='#topic';input.value='尚在编辑的原生输入';input.focus();const render=f.view.renderEpoch;let writes=0;f.host.updateDraft=()=>{writes++;};
 appearance.accent='rose';appearance.density='compact';f.view.applyPreferences();
 assert.equal(f.content.dataset.accent,'rose');assert.equal(f.content.dataset.density,'compact');assert.equal(f.view.bodyInput,input);assert.equal(input.value,'尚在编辑的原生输入');assert.equal(f.doc.activeElement,input);assert.equal(f.view.cards[0],card);assert.equal(card.scope,scope);assert.equal(f.view.renderEpoch,render);assert.equal(f.view.main.scrollTop,321);assert.equal(f.view.query,'Note');assert.equal(f.view.tag,'#topic');assert.deepEqual(f.view.getState(),session);assert.deepEqual(f.draft,draft);assert.equal(writes,0);assert.equal(f.calls(),0);
 appearance.accent='blue';appearance.density='comfortable';f.view.applyPreferences();assert.equal(f.content.dataset.accent,'blue');assert.equal(f.content.dataset.density,'comfortable');await f.view.onClose();
});
test('Collection appearance is read from its own host in separate documents without seeking an active board',async()=>{
 const a=await fixture([],{accent:'amber',density:'compact'}),b=await fixture([],{accent:'blue',density:'comfortable'});assert.notEqual(a.doc,b.doc);a.workspace.active={};b.workspace.active={};a.view.applyPreferences();b.view.applyPreferences();assert.deepEqual([a.content.dataset.accent,a.content.dataset.density],['amber','compact']);assert.deepEqual([b.content.dataset.accent,b.content.dataset.density],['blue','comfortable']);await a.view.onClose();await b.view.onClose();
});
test('Collection uses established workspace defaults and normalizes an unsupported density',async()=>{
 const f=await fixture([],{density:'unexpected'});assert.equal(f.content.dataset.accent,'forest');assert.equal(f.content.dataset.density,'comfortable');await f.view.onClose();
});
