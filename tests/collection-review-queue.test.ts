// Execute the production collection view against isolated native DOM/host boundaries.
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
class NoteExportStub {
 closed=false;
 constructor(readonly app:any,readonly doc:any,readonly host:any){}
 open(){}
 close(){this.closed=true;this.host.closed();}
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
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 setAttribute(key:string,value:string){this.attrs[key]=value;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase())]=value;}
 addClass(...names:string[]){names.forEach(name=>this.classes.add(name));}removeClass(name:string){this.classes.delete(name);}toggleClass(name:string,enabled:boolean){if(enabled)this.classes.add(name);else this.classes.delete(name);}setText(value:string){this.text=value;}
 contains(element:El|null):boolean{return !!element&&(element===this||this.children.some(child=>child.contains(element)));}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];}
 getClientRects(){return this.visible?[{}]:[];}
 addEventListener(name:string,listener:(event:any)=>void){this.listeners.set(name,listener);}
 focus(){this.ownerDocument.activeElement=this;}
 matches(selector:string):boolean {if(selector.includes(','))return selector.split(',').some(part=>this.matches(part));if(selector==='[contenteditable=true]')return this.attrs.contenteditable==='true';if(selector.startsWith('[')&&selector.endsWith(']'))return selector.slice(1,-1) in this.attrs;if(selector.startsWith('.'))return this.classes.has(selector.slice(1));if(selector==='span:last-child')return this.tagName==='SPAN'&&this.parentElement?.children.at(-1)===this;return this.tagName===selector.toUpperCase();}
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
 if(name==='./collection-note-export-modal')return{CollectionNoteExportModal:NoteExportStub};
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

const start=(f:Awaited<ReturnType<typeof fixture>>)=>{const button=action(f.view.organizingMenu,'review-start');assert.equal(button.disabled,false);button.onclick!();};
const invoke=(f:Awaited<ReturnType<typeof fixture>>,name:string)=>{const button=action(f.view.reviewPanel,name);assert.ok(button,`rendered ${name}`);assert.equal(button.disabled,false);button.onclick!();};
const queueKey=(f:Awaited<ReturnType<typeof fixture>>,patch:Partial<Event>={})=>{
 const event=f.event({key:'ArrowRight',metaKey:false,target:f.view.cards[0]?.row||f.view.reviewPanel,...patch});
 f.view.reviewPanel.parentElement.listeners.get('keydown')!(event);return event;
};
const allText=(el:El):string=>el.text+' '+el.children.map(allText).join(' ');
const destination={key:'opaque-board',path:'Boards/Target.md',title:'目标白板',groups:[]};

test('review is an explicit disclosure and freezes at most 500 exact source identities',async()=>{
 const records=Array.from({length:503},(_,index)=>record(index)),f=await fixture(records),expected=f.view.filteredRecords().slice(0,500);
 assert.ok(f.view.organizingMenu.querySelector('summary'));assert.equal(f.view.review,undefined);assert.equal(f.view.reviewPanel.hidden,true);
 start(f);const original=f.view.review;
 assert.equal(original.items.length,500);assert.equal(f.view.reviewPanel.dataset.collectionReviewCount,'500');assert.equal(f.view.reviewPanel.dataset.collectionReviewIndex,'0');
 assert.deepEqual(original.items.map((item:any)=>[item.id,item.createdAt,item.path]),expected.map((item:any)=>[item.id,item.createdAt,item.path]));
 assert.equal(Object.isFrozen(original.items),true);assert.equal(Object.isFrozen(original.items[0]),true);assert.equal(Object.isFrozen(original.items[0].tags),true);
 f.view.startReview();assert.equal(f.view.review,original);assert.equal(f.view.cards.length,1);assert.equal(f.view.pagination.children.length,0);
 await f.view.onClose();
});
test('skip, previous, next and exit never mutate records or the in-progress draft',async()=>{
 let writes=0;const f=await fixture([record(1),record(2)],{}, {setFlag:async()=>{writes++;},deliver:async()=>{writes++;return{added:1};}});
 f.draft.tags='#keep';f.view.query='Note';f.view.search.value='Note';f.view.main.scrollTop=209;
 const composer=f.view.bodyInput;composer.selectionStart=2;composer.selectionEnd=4;composer.focus();const body=f.draft.body;start(f);
 const first=f.view.review.items[0];invoke(f,'review-skip');assert.equal(f.view.review.index,1);assert.equal(f.view.review.outcomes.get(f.view.recordKey(first)),'稍后处理');
 invoke(f,'review-previous');assert.equal(f.view.review.index,0);assert.match(allText(f.view.reviewPanel),/稍后处理/);
 invoke(f,'review-next');invoke(f,'review-next');assert.equal(f.view.review.index,2);assert.equal(action(f.view.reviewPanel,'review-next').disabled,true);assert.equal(action(f.view.reviewPanel,'review-skip').disabled,true);
 await f.view.exitReview();assert.equal(f.view.review,undefined);assert.equal(f.view.query,'Note');assert.equal(f.view.search.value,'Note');assert.equal(f.draft.body,body);assert.equal(f.draft.tags,'#keep');assert.equal(f.view.bodyInput,composer);assert.equal(f.doc.activeElement,composer);assert.equal(composer.selectionStart,2);assert.equal(composer.selectionEnd,4);assert.equal(f.view.main.scrollTop,209);assert.equal(writes,0);await f.view.onClose();
});
test('new metadata members cannot enter an already frozen review scope',async()=>{
 const records=[record(1),record(2)],f=await fixture(records);start(f);const frozen=f.view.review.items;
 f.setRecords([...records,record(3)]);await f.view.refreshMembership();assert.equal(f.view.review.items,frozen);assert.equal(f.view.review.items.length,2);
 invoke(f,'review-next');assert.ok(frozen.some((item:any)=>item.id===f.view.cards[0].record.id));await f.view.onClose();
});
test('archive needs explicit confirmation and cancelling it performs no write',async()=>{
 let writes=0;const f=await fixture([record(1)],{}, {setFlag:async()=>{writes++;}});start(f);
 assert.equal(action(f.view.cards[0].row,'archive'),undefined);await f.view.archiveReview();assert.equal(writes,0);
 invoke(f,'review-archive');assert.equal(writes,0);assert.ok(action(f.view.reviewPanel,'review-archive-confirm'));
 invoke(f,'review-archive-cancel');assert.equal(action(f.view.reviewPanel,'review-archive-confirm'),undefined);await f.view.archiveReview();assert.equal(writes,0);await f.view.onClose();
});
test('double archive confirmation enters one host write, then advances only after success',async()=>{
 const gate=deferred<void>(),calls:any[]=[];const f=await fixture([record(1),record(2)],{}, {setFlag:async(...args:any[])=>{calls.push(args);await gate.promise;}});
 start(f);const first=f.view.review.items[0];invoke(f,'review-archive');const confirm=action(f.view.reviewPanel,'review-archive-confirm');confirm.onclick!();confirm.onclick!();
 assert.equal(calls.length,1);assert.equal(calls[0][0].id,first.id);assert.equal(calls[0][1],'archived');assert.equal(calls[0][2],true);assert.equal(calls[0][3](),true);assert.equal(f.view.review.index,0);
 assert.equal(action(f.view.reviewPanel,'review-next').disabled,true);f.view.moveReview(1);assert.equal(f.view.review.index,0);
 gate.resolve(undefined);await settle();assert.equal(f.view.review.index,1);assert.match(f.view.review.outcomes.get(f.view.recordKey(first)),/已归档/);assert.equal(f.draft.body,'待记录正文');await f.view.onClose();
});
test('failed archive stays on the same record and requires a new confirmation',async()=>{
 const f=await fixture([record(1)],{}, {setFlag:async()=>{throw Error('native write not confirmed');}});start(f);invoke(f,'review-archive');await f.view.archiveReview();
 assert.equal(f.view.review.index,0);assert.equal(f.view.review.confirmArchive,false);assert.match(allText(f.view.reviewPanel),/native write not confirmed/);assert.equal(action(f.view.reviewPanel,'review-archive-confirm'),undefined);await f.view.onClose();
});
for(const reason of ['exit','away and return','close'] as const)test(`pending archive loses its invocation on ${reason}`,async()=>{
 const gate=deferred<void>();let check:()=>boolean=()=>false,writes=0;
 const f=await fixture([record(1),record(2)],{}, {setFlag:async(_record:any,_flag:any,_value:any,current:()=>boolean)=>{check=current;await gate.promise;if(!current())throw Error('cancelled');writes++;}});
 start(f);const queue=f.view.review;invoke(f,'review-archive');const pending=f.view.archiveReview();assert.equal(check(),true);
 if(reason==='exit')await f.view.exitReview();
 if(reason==='away and return'){f.handlers.get('active-leaf-change')!({});f.handlers.get('active-leaf-change')!(f.leaf);}
 if(reason==='close')await f.view.onClose();
 assert.equal(check(),false);gate.resolve(undefined);await pending;assert.equal(writes,0);assert.equal(queue.index,0);assert.equal(f.draft.body,'待记录正文');await f.view.onClose();
});
test('successful board delivery retains the source and does not advance or archive the review',async()=>{
 let writes=0,delivered=0;const f=await fixture([record(1),record(2)],{}, {setFlag:async()=>{writes++;},pickTarget:async()=>destination,deliver:async(_source:any,_target:any,current:()=>boolean)=>{assert.equal(current(),true);delivered++;return{added:1};}});
 start(f);const card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions');await f.view.beginDelivery(card,actions,f.view.renderEpoch);action(actions,'confirm-delivery').onclick!();await settle();
 assert.equal(delivered,1);assert.equal(writes,0);assert.equal(f.view.review.index,0);assert.equal(f.view.review.items.length,2);assert.equal(f.view.cards[0].record.archived,undefined);assert.match(allText(actions),/记录仍保留/);await f.view.onClose();
});
for(const kind of ['rename','removed','duplicate identity','createdAt changed'] as const)test(`frozen review disables stale actions after source ${kind}`,async()=>{
 const records=[record(1),record(2)],f=await fixture(records,{}, {setFlag:async()=>{},pickTarget:async()=>destination,deliver:async()=>({added:1})});start(f);
 const frozen=f.view.review.items[0],card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions');
 // A mounted delivery panel deliberately survives ordinary metadata refreshes.
 await f.view.beginDelivery(card,actions,f.view.renderEpoch);
 const next=records.flatMap(item=>item.id!==frozen.id?[item]:kind==='removed'?[]:kind==='rename'?[{...item,path:'Renamed.md'}]:kind==='createdAt changed'?[{...item,createdAt:'2026-10-20T11:00:00.000Z'}]:[item,{...item,path:'Duplicate.md'}]);
 f.setRecords(next);await f.view.refreshMembership();
 assert.equal(f.view.review.items[0].path,frozen.path);assert.equal(f.view.reviewRecord(),undefined);
 assert.equal(f.view.cards.length,0,'invalid frozen record must not leave an actionable mounted card');
 assert.equal(action(f.view.reviewPanel,'review-archive'),undefined);assert.match(allText(f.view.reviewPanel),/移动|移除|身份/);await f.view.onClose();
});
test('pending archive current predicate rejects a source renamed during native metadata refresh',async()=>{
 const records=[record(1),record(2)],gate=deferred<void>();let check:()=>boolean=()=>false;
 const f=await fixture(records,{}, {setFlag:async(_record:any,_flag:any,_value:any,current:()=>boolean)=>{check=current;await gate.promise;if(!current())throw Error('cancelled');}});
 start(f);const frozen=f.view.review.items[0];invoke(f,'review-archive');const pending=f.view.archiveReview();
 f.setRecords(records.map(item=>item.id===frozen.id?{...item,path:'Renamed.md'}:item));await f.view.refreshMembership();
 const afterRename=check();f.setRecords(records);await f.view.refreshMembership();const afterRestore=check();
 gate.resolve(undefined);await pending;
 try{assert.equal(afterRename,false,'host write callback must lose review authority after identity/path changes');assert.equal(afterRestore,false,'restoring the old path must not revive the previous write');assert.equal(f.view.review.index,0);}finally{await f.view.onClose();}
});
test('an open note export cannot retain authority after the frozen review source is renamed',async()=>{
 const records=[record(1),record(2)],features={pickNote:async()=>undefined,noteHeadings:async()=>[],prepareNote:async()=>({}),commitNote:async()=>({}),discardNote:()=>{},inspectNote:async()=>({}),noteHistory:async()=>({items:[]}),openNotePath:async()=>{}};
 const f=await fixture(records,{},features);start(f);const frozen=f.view.review.items[0];f.view.openNoteExport(f.view.cards[0].record);
 const modal=f.view.noteExport as NoteExportStub;assert.equal(modal.host.current(),true);
 f.setRecords(records.map(item=>item.id===frozen.id?{...item,path:'Renamed.md'}:item));await f.view.refreshMembership();
 const afterRename=modal.closed||!modal.host.current();f.setRecords(records);await f.view.refreshMembership();
 try{assert.equal(afterRename,true,'source change must close the old modal or revoke its callback');assert.equal(modal.closed||!modal.host.current(),true,'restoring the source cannot revive the old preview');}finally{await f.view.onClose();}
});
test('moving to the next record cancels an unresolved board picker',async()=>{
 const gate=deferred<any>();let check:()=>boolean=()=>false,delivered=0;
 const f=await fixture([record(1),record(2)],{}, {pickTarget:async(current:()=>boolean)=>{check=current;return gate.promise;},deliver:async()=>{delivered++;return{added:1};}});
 start(f);const card=f.view.cards[0],actions=card.row.querySelector('.ts-collection-card-actions'),pending=f.view.beginDelivery(card,actions,f.view.renderEpoch);assert.equal(check(),true);
 invoke(f,'review-next');assert.equal(check(),false);gate.resolve(destination);await pending;assert.equal(f.view.feed.querySelector('.ts-collection-delivery'),undefined);assert.equal(delivered,0);await f.view.onClose();
});
for(const tag of ['input','textarea','select','button','a','summary','contenteditable'])test(`review arrow keys do not intercept ${tag}`,async()=>{
 const f=await fixture([record(1),record(2)]);start(f);const target=f.view.cards[0].row.createEl(tag==='contenteditable'?'div':tag,tag==='contenteditable'?{attr:{contenteditable:'true'}}:{});
 const event=queueKey(f,{target});assert.equal(f.view.review.index,0);assert.equal(event.defaultPrevented,false);await f.view.onClose();
});
for(const patch of [{isComposing:true},{keyCode:229},{defaultPrevented:true},{metaKey:true},{ctrlKey:true},{altKey:true},{shiftKey:true}])test(`review keyboard ignores protected event ${JSON.stringify(patch)}`,async()=>{
 const f=await fixture([record(1),record(2)]);start(f);queueKey(f,patch);assert.equal(f.view.review.index,0);await f.view.onClose();
});
test('review keyboard navigates only within the review and leaves composer input untouched',async()=>{
 const f=await fixture([record(1),record(2)]);start(f);
 queueKey(f,{target:f.view.bodyInput});assert.equal(f.view.review.index,0);
 const next=queueKey(f);assert.equal(next.defaultPrevented,true);assert.equal(f.view.review.index,1);
 queueKey(f,{key:'ArrowLeft'});assert.equal(f.view.review.index,0);queueKey(f,{key:'Escape'});await settle();assert.equal(f.view.review,undefined);assert.equal(f.draft.body,'待记录正文');await f.view.onClose();
});
test('returning to a different attachment source exits review and reveals that source without changing query or draft',async()=>{
 const records=[record(1),record(2)],f=await fixture(records);f.view.query='Note 2';f.view.search.value='Note 2';start(f);
 assert.equal(f.view.review.items.length,1);const destination=records[0];await f.view.revealRecord(destination,()=>true);
 assert.equal(f.view.review,undefined);assert.equal(f.view.located.id,destination.id);assert.ok(f.view.cards.some((card:any)=>card.record.path===destination.path));
 assert.equal(f.view.query,'Note 2');assert.equal(f.view.search.value,'Note 2');assert.equal(f.draft.body,'待记录正文');assert.equal(f.doc.activeElement?.dataset.collectionId,destination.id);await f.view.onClose();
});
test('returning to the current exact record preserves its review position; cancelled return changes nothing',async()=>{
 const f=await fixture([record(1),record(2)]);start(f);const queue=f.view.review;
 await f.view.revealRecord(queue.items[0],()=>true);assert.equal(f.view.review,queue);assert.equal(queue.index,0);
 await f.view.revealRecord(queue.items[1],()=>false);assert.equal(f.view.review,queue);assert.equal(queue.index,0);await f.view.onClose();
});
for(const flag of ['stale','searchBusy','searchComposing','bodyAwaitingStart','batchRunning','batchChoosing'])test(`review cannot freeze results while ${flag}`,async()=>{
 const f=await fixture([record(1),record(2)]);f.view[flag]=true;f.view.startReview();assert.equal(f.view.review,undefined);f.view[flag]=false;await f.view.onClose();
});
