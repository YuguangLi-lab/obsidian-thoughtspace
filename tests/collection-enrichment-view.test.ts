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
async function fixture(initialRecords:any[]=[],appearance:{accent?:string;density?:string}={}){
 let records=initialRecords,session='session-shortcut';
 const doc=new Doc();doc.body=new El('ROOT',doc);const content=doc.body.createDiv(),outside=doc.body.createEl('input'),parent=new Scope();let nativeEffects=0,calls=0,released=0;
 parent.register(['Mod'],'Enter',event=>{nativeEffects++;event.preventDefault();event.stopPropagation();return false;});
 const handlers=new Map<string,(...args:any[])=>void>();const leaf:any={contentEl:content},workspace={active:leaf,get activeLeaf(){return this.active;},getMostRecentLeaf(){return this.active;},requestSaveLayout(){},on:(name:string,fn:(...args:any[])=>void)=>{handlers.set(name,fn);return{};}};leaf.app={scope:parent,workspace};
 const draft={body:'待记录正文',tags:'',attachments:[],busy:false,locked:false,canSubmit:true};let finish:(()=>void)|undefined;
 const host={accent:()=>appearance.accent,density:()=>appearance.density,ready:async()=>{},sessionId:()=>session,setSessionId:async(id:string)=>{session=id;},draft:()=>draft,updateDraft:(patch:any)=>Object.assign(draft,patch),subscribe:()=>()=>{},list:async()=>records,readBody:async()=> 'shared native body',release:()=>{released++;},
  submit:async(current:()=>boolean)=>{assert.equal(current(),true);calls++;await new Promise<void>(resolve=>{finish=resolve;});draft.body='';draft.canSubmit=false;}};
 const view=new View(leaf,host);await view.onOpen();view.bodyInput.focus();
 const event=(patch:Partial<Event>={}):Event=>({key:'Enter',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,keyCode:13,defaultPrevented:false,stopped:false,target:doc.activeElement!,view:doc.defaultView,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...patch});
 const dispatch=(input:Event)=>{const result=view.scope.dispatch(input);if(!input.stopped)view.root.listeners.get('keydown')?.(input);return result;};
 return{handlers,view,doc,content,outside,leaf,workspace,draft,host,parent,event,dispatch,setRecords:(next:any[])=>{records=next;},finish:()=>finish?.(),calls:()=>calls,native:()=>nativeEffects,released:()=>released};
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

test('combined controls preserve explicit tags and query across all four scopes, body scanning starts off',async()=>{
 const f=await fixture([record(1)]),calls=pendingSearch(f),composer=f.view.bodyInput;
 assert.equal(f.view.bodySearchToggle.checked,false);f.view.query='blue -#later';f.view.tag='#topic';f.view.since='2026-10-01';f.view.until='2026-10-13';f.view.pinnedOnly=true;f.view.changeFilter('placed');
 assert.deepEqual(calls[0].options,{query:'#topic blue -#later',scope:'placed',pinnedOnly:true,includeBody:false,since:'2026-10-01',until:'2026-10-13'});
 f.view.changeFilter('archived');assert.equal(calls[0].current(),false);assert.equal(calls[1].options.query,'#topic blue -#later');assert.equal(f.view.bodyInput,composer);assert.equal(f.draft.body,'待记录正文');
 calls[1].pending.resolve(result([]));await settle();assert.equal(f.view.root.dataset.collectionSearchState,'complete');await f.view.onClose();
});
test('typed queries cancel old callbacks immediately, wait 200ms, and publish only the newest epoch',async()=>{
 const a=record(1),b=record(2),f=await fixture([a,b]),calls=pendingSearch(f);f.view.query='old';f.view.requestSearch();
 f.view.search.value='new';f.view.search.oninput();assert.equal(calls[0].current(),false);assert.equal(f.view.root.dataset.collectionSearchState,'pending');assert.equal(calls.length,1);assert.equal(f.view.cards.length,0);
 calls[0].progress({scanned:99,total:100,unread:0});calls[0].pending.resolve(result([a]));await settle();assert.equal(f.view.cards.length,0);assert.doesNotMatch(f.view.searchFeedback.text,/99/);
 await wait(220);assert.equal(calls.length,2);assert.equal(calls[1].options.query,'new');calls[1].pending.resolve(result([b]));await settle();assert.equal(f.view.root.dataset.collectionSearchState,'complete');assert.deepEqual(f.view.cards.map((card:any)=>card.record.id),[b.id]);await f.view.onClose();
});
test('IME composition and legacy keyCode 229 cannot submit a partial search or move focus',async()=>{
 const f=await fixture([record(1)]),calls=pendingSearch(f);f.view.search.focus();f.view.search.listeners.get('compositionstart')();f.view.search.value='拼';f.view.search.oninput();await wait(220);assert.equal(calls.length,0);
 const key={key:'Enter',isComposing:false,keyCode:229,preventDefault(){throw Error('must not consume IME Enter');}};f.view.search.listeners.get('keydown')(key);assert.equal(f.doc.activeElement,f.view.search);assert.equal(calls.length,0);
 f.view.search.value='拼音';f.view.search.listeners.get('compositionend')();await wait(220);assert.equal(calls.length,1);assert.equal(calls[0].options.query,'拼音');calls[0].pending.resolve(result([]));await settle();await f.view.onClose();
});
for(const reason of ['cancel','navigation','close','clear'] as const)test(`${reason} permanently invalidates an outstanding search and progress`,async()=>{
 const f=await fixture([record(1)]),calls=pendingSearch(f);f.view.query='body';f.view.requestSearch();const first=calls[0];
 if(reason==='cancel')action(f.view.searchPanel,'cancel-search').onclick!();if(reason==='navigation')f.handlers.get('active-leaf-change')!({});if(reason==='close')await f.view.onClose();if(reason==='clear')f.view.clearFilters();
 assert.equal(first.current(),false);first.progress({scanned:4,total:4,unread:0});first.pending.resolve(result([record(1)]));await settle();assert.equal(f.view.cards.length,0);
 if(reason==='clear'){assert.equal(f.view.query,'');assert.equal(f.view.tag,'');calls[1].pending.resolve(result([]));await settle();}if(reason!=='close')await f.view.onClose();
});
test('host invalidation cancellation is displayed as cancellation rather than a false empty result',async()=>{
 const f=await fixture([record(1)]),calls=pendingSearch(f);f.view.requestSearch();calls[0].pending.resolve(result([],{cancelled:true}));await settle();
 assert.equal(f.view.root.dataset.collectionSearchState,'stopped');assert.match(f.view.searchFeedback.text,/取消/);assert.equal(f.view.feed.querySelector('.ts-collection-empty'),undefined);assert.doesNotMatch(f.view.feedStatus.text,/^0 条/);await f.view.onClose();
});
test('unread body counts remain visible and do not claim complete empty results',async()=>{
 const f=await fixture([record(1)]),calls=pendingSearch(f);f.view.includeBody=true;f.view.requestSearch();calls[0].progress({scanned:1,total:2,unread:1});assert.match(f.view.searchFeedback.text,/1 \/ 2 条正文.*1 条未能读取/);
 calls[0].pending.resolve(result([],{scanned:2,total:2,unread:2}));await settle();assert.match(f.view.searchFeedback.text,/2 条正文未能读取.*不完整/);assert.match(f.view.feedStatus.text,/不完整/);assert.match(f.view.feed.querySelector('.ts-collection-empty').children[1].text,/暂未找到/);assert.equal(f.view.retrySearchButton.hidden,false);await f.view.onClose();
});
test('date validation failure retains inputs and is visible with retry, without touching the draft',async()=>{
 const f=await fixture([record(1)]),calls=pendingSearch(f),input=f.view.bodyInput;f.view.since='2026-10-13';f.view.until='2026-10-01';f.view.requestSearch();calls[0].pending.reject(Error('开始日期不能晚于结束日期'));await settle();
 assert.match(f.view.searchFeedback.text,/开始日期/);assert.equal(f.view.since,'2026-10-13');assert.equal(f.view.until,'2026-10-01');assert.equal(f.view.bodyInput,input);assert.equal(f.draft.body,'待记录正文');assert.equal(f.view.retrySearchButton.hidden,false);await f.view.onClose();
});
test('snippet text and mark nodes cannot inject HTML or mutate rendered Markdown',async()=>{
 const item=record(1),f=await fixture([item]),calls=pendingSearch(f);f.view.requestSearch();const text='<script>alert(1)</script> & [[link]]';calls[0].pending.resolve(result([],{hits:[{record:item,snippet:{text,ranges:[{start:0,end:8},{start:1,end:4},{start:NaN,end:99},{start:24,end:999}]}}]}));await settle();
 const card=f.view.cards[0],snippet=card.row.querySelector('.ts-collection-match-snippet');assert.equal(snippet.children.map((el:El)=>el.text).join(''),text);assert.deepEqual(snippet.children.map((el:El)=>el.tagName),['MARK','SPAN','MARK']);assert.equal(card.body.contains(snippet),false);assert.equal(snippet.querySelector('script'),undefined);await f.view.onClose();
});
test('body search result pages and a hidden archived reveal use one result set and at most 25 mounted cards',async()=>{
 const items=Array.from({length:2000},(_,i)=>record(i)),hidden=record(3000,{archived:true}),f=await fixture([...items,hidden]),calls=pendingSearch(f);f.view.query='bodyword';f.view.includeBody=true;f.view.requestSearch();calls[0].pending.resolve(result(items.slice(0,55)));await settle();
 assert.equal(f.view.cards.length,24);f.view.page=1;f.view.renderFeed();const selected=f.view.cards[3];action(selected.row,'more').focus();f.view.main.scrollTop=333;
 await f.view.revealRecord(hidden,()=>true);assert.equal(f.view.cards.length,25);assert.equal(f.view.cards[0].record.id,hidden.id);assert.equal(f.view.query,'bodyword');assert.equal(f.view.searchResult.value.hits.length,55);await f.view.dismissLocated();assert.equal(f.view.cards.length,24);assert.equal(f.view.page,1);assert.equal(f.view.main.scrollTop,333);assert.equal(f.doc.activeElement?.closest('[data-collection-id]')?.dataset.collectionId,selected.record.id);await f.view.onClose();
});
test('pin and archive use explicit non-optimistic writes, guard repeated presses, and expose save failures',async()=>{
 const item=record(1),f=await fixture([item]);let writes=0,current!:()=>boolean;const pending=deferred<void>();(f.host as any).setFlag=async(_record:any,flag:string,value:boolean,valid:()=>boolean)=>{writes++;current=valid;assert.equal(flag,'archived');assert.equal(value,true);await pending.promise;};f.view.renderFeed();
 const card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions'),button=action(actions,'archive');button.onclick!();button.onclick!();assert.equal(writes,1);assert.equal(current(),true);assert.equal(card.record.archived,undefined);assert.equal(actions.dataset.pending,'true');assert.match(actions.querySelector('[data-collection-flag-status]').text,/保存/);
 pending.reject(Error('磁盘保存失败，原笔记保留'));await settle();assert.equal(card.record.archived,undefined);assert.equal(actions.dataset.pending,'false');assert.equal(button.disabled,false);assert.equal(actions.querySelector('[data-collection-flag-status]').text,'');assert.equal(actions.querySelector('[data-collection-flag-status]').hidden,true);assert.match(f.view.browseNotice.text,/保存失败/);await f.view.onClose();
});
test('successful archiving exits active scope without changing draft or native placements, and can be restored',async()=>{
 let item=record(1,{inBoard:true,placements:[{key:'one',boardPath:'B.md',boardTitle:'Board',nodeId:'n',nodeTitle:'Card'}]});const f=await fixture([item]),composer=f.view.bodyInput;let writes=0;(f.host as any).search=async(options:any)=>result(options.scope==='archived'?(item.archived?[item]:[]):item.archived?[]:[item]);(f.host as any).setFlag=async(_record:any,flag:string,value:boolean,current:()=>boolean)=>{assert.equal(current(),true);writes++;item={...item,[flag]:value};f.setRecords([item]);};await f.view.refreshRecords();
 await f.view.changeFlag(f.view.cards[0],f.view.cards[0].row.querySelector('.ts-collection-card-actions'),'archived',true,f.view.renderEpoch);assert.equal(f.view.cards.length,0);assert.match(f.view.browseNotice.text,/已归档/);assert.equal(item.placements.length,1);assert.equal(f.view.bodyInput,composer);assert.equal(f.draft.body,'待记录正文');
 f.view.changeFilter('archived');await settle();assert.equal(f.view.cards.length,1);assert.ok(action(f.view.cards[0].row,'restore'));await f.view.changeFlag(f.view.cards[0],f.view.cards[0].row.querySelector('.ts-collection-card-actions'),'archived',false,f.view.renderEpoch);assert.equal(f.view.cards.length,0);assert.equal(item.archived,false);assert.equal(writes,2);await f.view.onClose();
});
test('late flag completion after a filter change cannot render success or take focus',async()=>{
 const item=record(1),f=await fixture([item]),pending=deferred<void>();let current!:()=>boolean;(f.host as any).setFlag=async(_record:any,_flag:string,_value:boolean,valid:()=>boolean)=>{current=valid;await pending.promise;};f.view.renderFeed();
 const changing=f.view.changeFlag(f.view.cards[0],f.view.cards[0].row.querySelector('.ts-collection-card-actions'),'pinned',true,f.view.renderEpoch);f.view.changeFilter('archived');f.view.search.focus();assert.equal(current(),false);pending.resolve();await changing;assert.equal(f.doc.activeElement,f.view.search);assert.equal(f.view.cards.length,0);assert.equal(f.view.browseMessage,'');await f.view.onClose();
});
test('renamed records use the fresh card identity when native opening or locating',async()=>{
 const item=record(1),f=await fixture([item]);let opened='',located='';(f.host as any).openNote=(record:any)=>{opened=record.path;};(f.host as any).showOccurrences=(record:any)=>{located=record.path;};f.setRecords([{...item,path:'Notes/Renamed.md'}]);await f.view.refreshMembership();action(f.view.cards[0].row,'open').onclick!();action(f.view.cards[0].row,'occurrences').onclick!();assert.equal(opened,'Notes/Renamed.md');assert.equal(located,'Notes/Renamed.md');await f.view.onClose();
});
test('completed refresh preserves newly changed focus and manual scroll instead of restoring stale browse state',async()=>{
 const item=record(1),f=await fixture([item]),calls=pendingSearch(f);f.view.bodyInput.focus();f.view.main.scrollTop=400;const refresh=f.view.refreshRecords();await settle();f.outside.focus();f.view.main.listeners.get('wheel')?.({});f.view.main.scrollTop=22;calls[0].pending.resolve(result([item]));await refresh;assert.equal(f.doc.activeElement,f.outside);assert.equal(f.view.main.scrollTop,22);await f.view.onClose();
});
for(const reason of ['保存响应丢失，请先核对原笔记','未知属性验证失败，请核对原笔记'] as const)test(`${reason}: metadata rebuilding before rejection cannot erase the warning`,async()=>{
 let item=record(1),f=await fixture([item]);const pending=deferred<void>();(f.host as any).setFlag=async()=>pending.promise;(f.host as any).search=async(options:any)=>result(options.scope==='archived'?(item.archived?[item]:[]):item.archived?[]:[item]);await f.view.refreshRecords();
 const card=f.view.cards[0],writing=f.view.changeFlag(card,card.row.querySelector('.ts-collection-card-actions'),'archived',true,f.view.renderEpoch);item={...item,archived:true};f.setRecords([item]);await f.view.refreshMembership();assert.equal(f.view.cards.length,0);pending.reject(Error(reason));await writing;assert.equal(f.view.browseNotice.text,reason);assert.equal(f.view.browseNotice.hidden,false);
 await f.view.refreshRecords();assert.equal(f.view.browseNotice.text,reason);assert.equal(f.draft.body,'待记录正文');f.view.changeFilter('archived');await settle();assert.equal(f.view.browseNotice.hidden,true);assert.equal(f.view.cards.length,1);await f.view.onClose();
});
test('a confirmed pin reconciles complete hits after a native metadata gap restores the missing identity',async()=>{
 const original=Array.from({length:4},(_,index)=>record(index+1)),primary=original[0],f=await fixture(original),composer=f.view.bodyInput;let indexed=original,searches=0,bodyReads=0;
 (f.host as any).search=async(options:any,current:()=>boolean)=>{searches++;const snapshot=[...indexed];return searchCollectionRecords(snapshot,options,{current,readBody:async()=>{bodyReads++;throw Error('metadata reconciliation must not scan bodies');}});};
 f.view.query='Note -#skip';f.view.tag='#topic';f.view.filter='unplaced';f.view.since='2026-10-01';f.view.until='2026-10-31';await f.view.refreshRecords();assert.equal(f.view.cards.length,4);
 const written=deferred<void>();(f.host as any).setFlag=async(_record:any,flag:string,value:boolean)=>{assert.equal(flag,'pinned');assert.equal(value,true);indexed=original.slice(1);f.setRecords(indexed);await written.promise;};
 const card=f.view.cards.find((item:any)=>item.record.id===primary.id),saving=f.view.changeFlag(card,card.row.querySelector('.ts-collection-card-actions'),'pinned',true,f.view.renderEpoch);written.resolve();await saving;
 assert.equal(f.view.root.dataset.collectionSearchState,'complete');assert.equal(f.view.records.length,3);assert.equal(f.view.searchResult.value.hits.length,3);assert.equal(f.view.cards.length,3);assert.match(f.view.browseNotice.text,/已置顶/);
 indexed=[{...primary,pinned:true},...original.slice(1)];f.setRecords(indexed);const indexedReady=deferred<void>();f.host.list=async()=>{await indexedReady.promise;return indexed;};
 f.draft.body='仍在输入，不能被重建';composer.value=f.draft.body;composer.focus();f.view.main.scrollTop=173;const membership=f.view.refreshMembership();await settle();assert.equal(f.view.cards.length,3);indexedReady.resolve();await membership;
 assert.equal(f.view.records.length,4);assert.equal(f.view.searchResult.value.hits.length,4);assert.equal(f.view.cards.length,4);assert.equal(f.view.cards[0].record.id,primary.id);assert.equal(f.view.cards[0].record.pinned,true);assert.equal(f.view.cards[0].row.dataset.collectionPinned,'true');assert.equal(searches,3);assert.equal(bodyReads,0);
 assert.equal(f.view.bodyInput,composer);assert.equal(composer.value,'仍在输入，不能被重建');assert.equal(f.doc.activeElement,composer);assert.equal(f.view.main.scrollTop,173);assert.equal(f.view.query,'Note -#skip');assert.equal(f.view.tag,'#topic');assert.equal(f.view.filter,'unplaced');assert.equal(f.view.since,'2026-10-01');assert.equal(f.view.until,'2026-10-31');assert.match(f.view.browseNotice.text,/已置顶/);await f.view.onClose();
});
test('a completed body search whose metadata membership changes requires explicit retry',async()=>{
 const primary=record(1),other=record(2),f=await fixture([other]),calls=pendingSearch(f);f.view.query='body term';f.view.includeBody=true;f.view.requestSearch();calls[0].pending.resolve(result([other]));await settle();
 f.setRecords([{...primary,pinned:true},other]);await f.view.refreshMembership();assert.equal(f.view.records.length,2);assert.equal(calls.length,1,'membership repair does not launch another body scan');assert.equal(f.view.searchResult.value.hits.length,1);assert.match(f.view.searchFeedback.text,/上次搜索结果.*重试/);assert.equal(f.view.retrySearchButton.hidden,false);
 const retry=f.view.refreshRecords();await settle();assert.equal(calls.length,2);calls[1].pending.resolve(result([{...primary,pinned:true},other]));await retry;assert.equal(f.view.cards.length,2);await f.view.onClose();
});
test('a cancelled body scan stays cancelled when a missing identity returns',async()=>{
 const primary=record(1),other=record(2),f=await fixture([other]),calls=pendingSearch(f);f.view.query='body term';f.view.includeBody=true;f.view.requestSearch();action(f.view.searchPanel,'cancel-search').onclick!();
 f.setRecords([{...primary,pinned:true},other]);await f.view.refreshMembership();calls[0].pending.resolve(result([primary,other]));await settle();assert.equal(calls.length,1);assert.equal(f.view.cards.length,0);assert.equal(f.view.searchResult,undefined);assert.equal(f.view.root.dataset.collectionSearchState,'stopped');assert.match(f.view.searchFeedback.text,/取消/);await f.view.onClose();
});
test('an older metadata membership read cannot restart a superseding query',async()=>{
 const old=record(1),added=record(2),f=await fixture([old]),calls=pendingSearch(f);f.view.query='old';f.view.requestSearch();calls[0].pending.resolve(result([old]));await settle();
 const gate=deferred<void>();f.host.list=async()=>{await gate.promise;return[old,added];};const membership=f.view.refreshMembership();f.view.query='new';f.view.requestSearch();calls[1].pending.resolve(result([added]));await settle();gate.resolve();await membership;
 assert.equal(calls.length,2);assert.equal(f.view.query,'new');assert.equal(f.view.searchResult.value.hits.length,1);assert.equal(f.view.cards[0].record.id,added.id);await f.view.onClose();
});
for(const state of ['complete','pending','cancelled'] as const)test(`restoring the same session leaves a ${state} search untouched`,async()=>{
 const item=record(1),f=await fixture([item]),calls=pendingSearch(f);f.view.query='existing query';f.view.requestSearch();if(state==='complete'){calls[0].pending.resolve(result([item]));await settle();}if(state==='cancelled'){action(f.view.searchPanel,'cancel-search').onclick!();}
 const epoch=f.view.searchEpoch,stateEpoch=f.view.stateEpoch,search=f.view.searchResult,row=f.view.cards[0]?.row,message=f.view.searchMessage,status=f.view.root.dataset.collectionSearchState;let changes=0;f.host.setSessionId=async()=>{changes++;};
 await f.view.setState({collectionSession:f.host.sessionId()},{});assert.equal(changes,0);assert.equal(f.view.searchEpoch,epoch);assert.equal(f.view.stateEpoch,stateEpoch);assert.equal(f.view.searchResult,search);assert.equal(f.view.cards[0]?.row,row);assert.equal(f.view.searchMessage,message);assert.equal(f.view.root.dataset.collectionSearchState,status);assert.equal(calls.length,1);if(state==='pending'){assert.equal(calls[0].current(),true);calls[0].pending.resolve(result([item]));await settle();}await f.view.onClose();
});
test('a different session restored after initial rendering establishes a fresh complete metadata result',async()=>{
 const items=Array.from({length:7},(_,i)=>record(i)),f=await fixture(items),calls=pendingSearch(f);f.view.requestSearch();calls[0].pending.resolve(result(items));await settle();const composer=f.view.bodyInput;composer.focus();f.view.main.scrollTop=111;
 const gate=deferred<void>(),setSession=f.host.setSessionId;f.host.setSessionId=async id=>{await gate.promise;await setSession(id);};const restoring=f.view.setState({collectionSession:'session-restored-native'},{});assert.equal(f.view.preparing,true);assert.equal(f.view.searchResult,undefined);assert.equal(f.view.cards.length,7,'rendered cards alone cannot prove a completed search');gate.resolve();await settle();assert.equal(calls.length,2);assert.equal(calls[1].options.includeBody,false);calls[1].pending.resolve(result(items));await restoring;
 assert.equal(f.view.root.dataset.collectionSearchState,'complete');assert.equal(f.view.searchResult.value.hits.length,7);assert.equal(f.view.cards.length,7);assert.equal(f.host.sessionId(),'session-restored-native');assert.equal(f.view.preparing,false);assert.equal(f.view.bodyInput,composer);assert.equal(f.doc.activeElement,composer);assert.equal(f.view.main.scrollTop,111);assert.equal(f.draft.body,'待记录正文');await f.view.onClose();
});
test('a later session restore owns startup when onOpen is still awaiting the old session',async()=>{
 const item=record(1),f=await fixture([item]);await f.view.onClose();const ready=deferred<void>();f.host.ready=async()=>ready.promise;let searches=0;(f.host as any).search=async(options:any,current:()=>boolean)=>{searches++;return searchCollectionRecords([item],options,{current,readBody:async()=>{throw Error('unexpected body read');}});};
 const view=new View(f.leaf,f.host),opening=view.onOpen();await settle();assert.equal(view.preparing,true);await view.setState({collectionSession:'session-restored-during-open'},{});assert.equal(view.root.dataset.collectionSearchState,'complete');assert.equal(view.cards.length,1);assert.equal(searches,1);const row=view.cards[0].row;ready.resolve();await opening;assert.equal(searches,1,'superseded onOpen must not cancel or rerun the restored query');assert.equal(view.cards[0].row,row);assert.equal(view.preparing,false);await view.onClose();
});
test('changing the session cancels an old body scan and requires an explicit retry',async()=>{
 const item=record(1),f=await fixture([item]),calls=pendingSearch(f);f.view.includeBody=true;f.view.query='body term';f.view.requestSearch();await f.view.setState({collectionSession:'session-restored-body-query'},{});assert.equal(calls[0].current(),false);calls[0].pending.resolve(result([item]));await settle();assert.equal(calls.length,1);assert.equal(f.view.searchResult,undefined);assert.equal(f.view.cards.length,0);assert.equal(f.view.root.dataset.collectionSearchState,'stopped');assert.match(f.view.searchFeedback.text,/正文搜索请重试/);assert.equal(f.view.retrySearchButton.hidden,false);
 const retry=f.view.refreshRecords();await settle();assert.equal(calls.length,2);calls[1].pending.resolve(result([item]));await retry;assert.equal(f.view.root.dataset.collectionSearchState,'complete');await f.view.onClose();
});
for(const newer of ['query','cancel'] as const)test(`session restore completion respects a newer ${newer} made while its journal loads`,async()=>{
 const item=record(1),f=await fixture([item]),calls=pendingSearch(f),gate=deferred<void>(),setSession=f.host.setSessionId;f.host.setSessionId=async id=>{await gate.promise;await setSession(id);};const restoring=f.view.setState({collectionSession:'session-restored-user-interaction'},{});
 f.view.query='newer query';f.view.requestSearch();if(newer==='cancel')action(f.view.searchPanel,'cancel-search').onclick!();else{calls[0].pending.resolve(result([item]));await settle();}
 const epoch=f.view.searchEpoch,state=f.view.root.dataset.collectionSearchState,search=f.view.searchResult;gate.resolve();await restoring;assert.equal(calls.length,1);assert.equal(f.view.searchEpoch,epoch);assert.equal(f.view.searchResult,search);assert.equal(f.view.root.dataset.collectionSearchState,state);assert.equal(f.view.query,'newer query');await f.view.onClose();
});
test('generic Collection text-field styles exclude native checkbox and radio inputs at every responsive size',()=>{
 const css=readFileSync('src/collection-view.css','utf8'),selectors=css.match(/\.ts-collection input[^,{]*/g)||[];assert.ok(selectors.length>=8);
 for(const selector of selectors)assert.ok(selector.startsWith('.ts-collection input:not([type=checkbox]):not([type=radio])'),selector);
 assert.match(css,/\.ts-collection \.ts-collection-check-field>input\[type=checkbox\]\{[^}]*width:16px;[^}]*height:16px;[^}]*min-height:16px/);assert.match(css,/\.ts-collection-search-fields>\.ts-collection-check-field\{min-height:44px\}/);
});

for(const change of ['rename','title','membership'] as const)test(`a failed single delivery retains its real panel and retry invocation after a source ${change}`,async()=>{
 let item=record(1),searches=0;const f=await fixture([item]),attempts:any[]=[],first=deferred<{added:number}>(),second=deferred<{added:number}>();let pickerCurrent!:()=>boolean;
 (f.host as any).search=async(options:any,current:()=>boolean)=>{searches++;return searchCollectionRecords([item],options,{current,readBody:async()=> 'bodytoken'});};
 (f.host as any).pickTarget=async(current:()=>boolean)=>{pickerCurrent=current;return{key:'verified-board',title:'研究白板',groups:[{id:'group-one',title:'组一'}],groupId:'group-one'};};
 (f.host as any).deliver=async(source:any,target:any,current:()=>boolean)=>{attempts.push({source,target,current});return attempts.length===1?first.promise:second.promise;};
 await f.view.refreshRecords();const card=f.view.cards[0],row=card.row,actions=row.querySelector('.ts-collection-card-actions'),composer=f.view.bodyInput;await f.view.beginDelivery(card,actions,f.view.renderEpoch);const panel=actions.querySelector('.ts-collection-delivery'),confirm=action(panel,'confirm-delivery');confirm.onclick!();first.reject(Error('保存未确认，请重试原目标'));await settle();assert.equal(attempts.length,1);assert.equal(attempts[0].current(),true);assert.equal(confirm.disabled,false);const epoch=f.view.renderEpoch,searchEpoch=f.view.searchEpoch,priorSearches=searches;
 item={...item,...(change==='rename'?{path:'Notes/Renamed source.md'}:change==='title'?{title:'Renamed title'}:{inBoard:true}),placements:[{key:'ref',boardPath:'Boards/source.canvas',boardTitle:'所在白板',nodeId:'node-one',nodeTitle:'记录'}]};f.setRecords([item]);await f.view.refreshMembership();
 assert.equal(f.view.renderEpoch,epoch);assert.equal(f.view.searchEpoch,searchEpoch);assert.equal(searches,priorSearches);assert.equal(f.view.cards[0],card);assert.equal(card.row,row);assert.equal(actions.querySelector('.ts-collection-delivery'),panel);assert.equal(panel.isConnected,true);assert.equal(pickerCurrent(),true);assert.equal(attempts[0].current(),true);assert.equal(card.record,item);assert.equal(row.dataset.path,item.path);assert.equal(card.placements.querySelectorAll('[data-collection-action]').length,1);assert.equal(f.view.stale,true);assert.match(f.view.searchFeedback.text,/当前投递操作已保留/);assert.equal(f.view.bodyInput,composer);assert.equal(f.draft.body,'待记录正文');
 confirm.onclick!();assert.equal(attempts.length,2);assert.equal(attempts[1].source.path,item.path);assert.equal(attempts[1].target.key,'verified-board');assert.equal(attempts[1].target.groupId,'group-one');assert.equal(attempts[1].current(),true);second.resolve({added:1});await settle();await f.view.onClose();
});
for(const browse of ['refresh','query','filter','page','navigation'] as const)test(`explicit ${browse} still invalidates a delivery panel retained across metadata changes`,async()=>{
 let item=record(1),other=record(2);const f=await fixture([item,other]);let current!:()=>boolean;(f.host as any).search=async()=>result([item,other]);(f.host as any).pickTarget=async(valid:()=>boolean)=>{current=valid;return{key:'board',title:'白板',groups:[]};};await f.view.refreshRecords();const card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions');await f.view.beginDelivery(card,actions,f.view.renderEpoch);const panel=actions.querySelector('.ts-collection-delivery');item={...item,path:'Notes/Renamed.md'};f.setRecords([item,other]);await f.view.refreshMembership();assert.equal(current(),true);assert.equal(panel.isConnected,true);
 if(browse==='refresh')await f.view.refreshRecords();if(browse==='query'){f.view.search.value='new';f.view.search.oninput();}if(browse==='filter')f.view.changeFilter('placed');if(browse==='page'){f.view.page=1;f.view.renderFeed();}if(browse==='navigation')f.handlers.get('active-leaf-change')!({});assert.equal(current(),false);if(browse!=='navigation')assert.equal(panel.isConnected,false);await f.view.onClose();
});
test('background metadata refresh preserves a mounted delivery without implicitly rerunning its body search',async()=>{
 let item=record(1),searches=0,bodyReads=0;const f=await fixture([item]);let current!:()=>boolean;(f.host as any).search=async(options:any,valid:()=>boolean)=>{searches++;return searchCollectionRecords([item],options,{current:valid,readBody:async()=>{bodyReads++;return 'bodytoken';}});};(f.host as any).pickTarget=async(valid:()=>boolean)=>{current=valid;return{key:'board',title:'白板',groups:[]};};f.view.includeBody=true;f.view.query='bodytoken';await f.view.refreshRecords();assert.equal(bodyReads,1);const card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions');await f.view.beginDelivery(card,actions,f.view.renderEpoch);const panel=actions.querySelector('.ts-collection-delivery');item={...item,path:'Notes/Body renamed.md',title:'Updated title',inBoard:true};f.setRecords([item]);await f.view.refreshMembership();assert.equal(searches,1);assert.equal(bodyReads,1);assert.equal(current(),true);assert.equal(actions.querySelector('.ts-collection-delivery'),panel);assert.equal(card.record,item);assert.equal(f.view.stale,true);await f.view.onClose();
});
for(const finish of ['confirm-target','change-query'] as const)test(`a pending delivery target picker survives background rename until ${finish}`,async()=>{
 let item=record(1),searches=0;const f=await fixture([item]),picked=deferred<any>();let current!:()=>boolean;(f.host as any).search=async()=>{searches++;return result([item]);};(f.host as any).pickTarget=async(valid:()=>boolean)=>{current=valid;return picked.promise;};await f.view.refreshRecords();const card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions'),epoch=f.view.renderEpoch,selecting=f.view.beginDelivery(card,actions,epoch);assert.equal(actions.dataset.pending,'true');assert.equal(actions.dataset.deliveryPicking,'true');assert.equal(actions.querySelector('.ts-collection-delivery'),undefined);
 item={...item,path:'Notes/Renamed during picker.md'};f.setRecords([item]);await f.view.refreshMembership();assert.equal(current(),true);assert.equal(f.view.renderEpoch,epoch);assert.equal(searches,1);assert.equal(card.record,item);assert.equal(f.view.stale,true);
 if(finish==='change-query'){f.view.query='changed';f.view.requestSearch();assert.equal(current(),false);}picked.resolve({key:'board',title:'白板',groups:[]});await selecting;assert.equal(actions.dataset.deliveryPicking,'false');assert.equal(!!actions.querySelector('.ts-collection-delivery'),finish==='confirm-target');if(finish==='confirm-target')assert.equal(current(),true);await f.view.onClose();
});
for(const stage of ['list','search'] as const)test(`opening a real delivery panel supersedes an already awaiting background ${stage} reconciliation`,async()=>{
 let item=record(1),searches=0;const f=await fixture([item]),gate=deferred<any>();let current!:()=>boolean;(f.host as any).search=async()=>{searches++;return result([item]);};(f.host as any).pickTarget=async(valid:()=>boolean)=>{current=valid;return{key:'board',title:'白板',groups:[]};};await f.view.refreshRecords();const card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions'),epoch=f.view.renderEpoch;item={...item,path:'Notes/Changed before picker.md'};f.setRecords([item]);
 let lists=0;f.host.list=async()=>{lists++;return stage==='list'&&lists===2?gate.promise:[item];};if(stage==='search')(f.host as any).search=async()=>{searches++;return gate.promise;};
 const membership=f.view.refreshMembership();await settle();assert.equal(lists,2);assert.equal(f.view.indexBusy,true);assert.equal(stage==='search'?f.view.searchBusy:!f.view.searchBusy,true);await f.view.beginDelivery(card,actions,f.view.renderEpoch);const panel=actions.querySelector('.ts-collection-delivery');assert.ok(panel);assert.equal(current(),true);assert.equal(f.view.stale,true);assert.equal(f.view.indexBusy,false);gate.resolve(stage==='list'?[item]:result([item]));await membership;
 assert.equal(f.view.renderEpoch,epoch);assert.equal(f.view.cards[0],card);assert.equal(panel.isConnected,true);assert.equal(actions.querySelector('.ts-collection-delivery'),panel);assert.equal(card.record.path,item.path);assert.equal(current(),true);assert.equal(f.view.searchBusy,false);assert.equal(searches,stage==='list'?1:2);assert.match(f.view.searchFeedback.text,/当前投递操作已保留/);await f.view.onClose();
});
