import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';
import {boardReferenceOccurrences} from '../src/reference-occurrences';
import {emptyBoard} from '../src/model';

// Native d33 observed Modal.close restoring the visible sidebar opener after
// target activation. Model that documented selection switch, keeping the real
// modal methods and irreversible navigation lease. No app or window is started.
class Doc {
 defaultView={closed:false};activeElement?:El;body:El;
 constructor(readonly name:string){this.body=new El(this,'body');}
}
class El {
 children:El[]=[];parent?:El;attrs=new Map<string,string>();text='';disabled=false;connected=false;onfocus?:()=>void;
 constructor(public ownerDocument:Doc,readonly tag='div'){}
 get isConnected():boolean{return this.connected||!!this.parent?.isConnected;}
 createEl(tag:string,options?:string|{text?:string;attr?:Record<string,string>}){const el=new El(this.ownerDocument,tag);if(typeof options==='object'){el.text=options.text||'';for(const[k,v]of Object.entries(options.attr||{}))el.attrs.set(k,v);}this.appendChild(el);return el;}
 createDiv(options?:string|{text?:string;attr?:Record<string,string>}){return this.createEl('div',options);}
 createSpan(options?:string|{text?:string;attr?:Record<string,string>}){return this.createEl('span',options);}
 appendChild(el:El){el.parent=this;el.ownerDocument=this.ownerDocument;this.children.push(el);return el;}
 addClass(){}
 setText(value:string){this.text=value;}
 setAttribute(key:string,value:string){this.attrs.set(key,value);}
 removeAttribute(key:string){this.attrs.delete(key);}
 empty(){this.children=[];}
 querySelectorAll(tag:string):El[]{return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)]);}
 querySelector(tag:string){return this.querySelectorAll(tag)[0];}
 focus(){this.ownerDocument.activeElement=this;this.onfocus?.();}
}
class Component {
 private cleanups:(()=>void)[]=[];
 load(){}
 register(cleanup:()=>void){this.cleanups.push(cleanup);}
 registerEvent(_event:unknown){}
 unload(){for(const cleanup of this.cleanups.splice(0))cleanup();}
}
class Modal {
 shouldRestoreSelection=true;containerEl:El;modalEl:El;contentEl:El;titleEl:El;
 closeCalls=0;restoredSelections=0;opener?:El;
 constructor(readonly app:{doc:Doc}){this.containerEl=new El(app.doc);this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();this.titleEl=this.modalEl.createDiv();}
 open(){this.opener=this.app.doc.activeElement;this.containerEl.connected=true;(this as any).onOpen();}
 close(){this.closeCalls++;(this as any).onClose();this.containerEl.connected=false;if(this.shouldRestoreSelection&&this.opener){this.restoredSelections++;this.opener.focus();}}
}
class File {extension='md';basename='Source';constructor(public path:string){}}
const notices:string[]=[];
const compiled:{exports:{NativeBridgeModal?:any}}={exports:{}};
const imports:Record<string,unknown>={
 obsidian:{Component,Modal,TFile:File,Notice:class{constructor(message:string){notices.push(message);}},setIcon:()=>{},getAllTags:()=>[]},
 './native-bridge':{nativeRelations:()=>({outgoing:[],incoming:[],unresolved:[]})},
 './ui-tokens':{themeSurface:()=>{}},'./workspace':{isWorkspaceFile:()=>true},
 './board-modal-viewport':{bindBoardModalViewport:()=>()=>{}},
 './reference-occurrences':{referenceOccurrenceGroups:()=>''}
};
new Function('require','module','exports',transformSync(readFileSync('src/native-bridge-view.ts','utf8'),{loader:'ts',format:'cjs'}).code)((id:string)=>{assert.ok(id in imports,'Only explicitly supplied view dependencies');return imports[id];},compiled,compiled.exports);
const View=compiled.exports.NativeBridgeModal!;
const items=boardReferenceOccurrences({...emptyBoard(),nodes:[{id:'a2',kind:'card',file:'Source.md',x:0,y:0,width:100,height:80,color:'slate'}]},'Board.md','Board','Source.md',path=>path);
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
function fixture(kind='sidebar',doc=new Doc('owned-window')){
 const file=new File('Source.md'),opener=new El(doc,'button'),stage=new El(doc),newer=new El(doc,'textarea');let active=kind,transferred=false,bar=false,closed=0,rendered=0;
 const lease=new ConvenienceNavigationLease(()=>active===kind);lease.watch(()=>{bar=false;});
 opener.onfocus=()=>{active=kind;lease.observe();};stage.onfocus=()=>{active='board';lease.observe();};newer.onfocus=()=>{active='newer';lease.observe();};opener.focus();
 const host={document:doc,current:()=>lease.current(),watchCurrent:(invalidate:()=>void)=>lease.watch(invalidate),closed:()=>{closed++;if(!transferred)lease.stop();},occurrences:async()=>({items,errors:0}),usages:async()=>({files:[],errors:0}),open:()=>{},add:()=>{},openBoard:()=>{},locateOccurrence:async(_item:unknown,_items:unknown,current:()=>boolean)=>{assert.equal(current(),true);}};
 const app={doc,vault:{getAbstractFileByPath:(path:string)=>file.path===path?file:undefined,getMarkdownFiles:()=>[file],on:()=>({})},metadataCache:{on:()=>({})}};
 const view=new View(app,file,host),refresh=view.refresh.bind(view);view.refresh=async()=>{};view.render=()=>{rendered++;};view.open();
 const handoff=()=>{lease.bind(()=>active===kind||active==='board');stage.focus();lease.bind(()=>active==='board');transferred=true;bar=true;};
 return{view,host,doc,opener,stage,newer,lease,handoff,refresh,active:()=>active,bar:()=>bar,closed:()=>closed,rendered:()=>rendered};
}

test('fixture models native selection restoration cancelling a target-only lease',()=>{
 const f=fixture();f.handoff();f.view.close();assert.equal(f.active(),'sidebar');assert.equal(f.view.restoredSelections,1);assert.equal(f.lease.current(),false);assert.equal(f.bar(),false);
});
for(const origin of ['sidebar','main','popup'])test(`${origin} successful locate closes without reviving opener or cancelling target trail`,async()=>{
 const f=fixture(origin,new Doc(origin==='popup'?'owned-popup':'owned-main')),flush=deferred();let calls=0;
 f.host.locateOccurrence=async(_item,_items,current)=>{calls++;assert.equal(current(),true);f.handoff();await flush.promise;assert.equal(current(),true);};
 const first=f.view.locate(items[0],items);await f.view.locate(items[0],items);
 assert.equal(calls,1);assert.equal(f.view.closeCalls,0);assert.equal(f.view.shouldRestoreSelection,true);assert.equal(f.bar(),true);
 flush.resolve();await first;
 assert.equal(f.view.closeCalls,1);assert.equal(f.view.restoredSelections,0);assert.equal(f.doc.activeElement,f.stage);assert.equal(f.active(),'board');assert.equal(f.lease.current(),true);assert.equal(f.bar(),true);assert.equal(f.closed(),1);
});
test('failed locate leaves native cancel restoration and panel retry intact',async()=>{
 const f=fixture();f.host.locateOccurrence=async()=>{throw Error('save failed');};await f.view.locate(items[0],items);
 assert.equal(f.view.closeCalls,0);assert.equal(f.view.active,true);assert.equal(f.view.shouldRestoreSelection,true);assert.equal(f.view.locating,false);assert.ok(f.view.contentEl.querySelectorAll('button').every((button:El)=>!button.disabled));assert.equal(f.rendered(),1);
 assert.match(f.view.state.text,/save failed/);f.view.close();assert.equal(f.view.restoredSelections,1);assert.equal(f.doc.activeElement,f.opener);
});
test('retry after a failed locate transfers only when target work resolves',async()=>{
 const f=fixture();f.host.locateOccurrence=async()=>{throw Error('save failed');};await f.view.locate(items[0],items);
 f.host.locateOccurrence=async()=>{f.handoff();};await f.view.locate(items[0],items);
 assert.equal(f.view.closeCalls,1);assert.equal(f.view.restoredSelections,0);assert.equal(f.active(),'board');assert.equal(f.bar(),true);
});
test('new user navigation revokes pending modal without restoring its old opener',async()=>{
 const f=fixture(),read=deferred();let hops=0,guard!:()=>boolean;
 f.host.locateOccurrence=async(_item,_items,current)=>{guard=current;await read.promise;if(current()){hops++;f.handoff();}};
 const pending=f.view.locate(items[0],items);f.newer.focus();
 assert.equal(f.view.closeCalls,1);assert.equal(f.view.restoredSelections,0);assert.equal(f.doc.activeElement,f.newer);assert.equal(guard(),false);
 read.resolve();await pending;assert.equal(hops,0);assert.equal(f.view.closeCalls,1);assert.equal(f.active(),'newer');assert.equal(f.doc.activeElement,f.newer);
});
test('explicit pending cancellation keeps native selection restoration but cannot resume navigation',async()=>{
 const f=fixture(),read=deferred();let hops=0;
 f.host.locateOccurrence=async(_item,_items,current)=>{await read.promise;if(current()){hops++;f.handoff();}};
 const pending=f.view.locate(items[0],items);f.view.close();assert.equal(f.view.restoredSelections,1);assert.equal(f.doc.activeElement,f.opener);
 const newer=fixture('new-window',new Doc('new-window'));read.resolve();await pending;
 assert.equal(hops,0);assert.equal(f.view.closeCalls,1);assert.equal(newer.view.closeCalls,0);assert.equal(newer.doc.activeElement,newer.opener);assert.equal(newer.lease.current(),true);
});
test('late completion from a closed generation cannot close or enable a reopened modal',async()=>{
 const f=fixture(),old=deferred(),fresh=deferred();let call=0,available=true;
 f.host.current=()=>available;f.host.closed=()=>{};f.host.locateOccurrence=async()=>{await(++call===1?old.promise:fresh.promise);};
 const pending=f.view.locate(items[0],items);f.view.close();f.view.open();const next=f.view.locate(items[0],items);
 old.resolve();await pending;assert.equal(f.view.closeCalls,1);assert.equal(f.view.locating,true);assert.equal(f.view.active,true);assert.equal(f.view.shouldRestoreSelection,true);assert.equal(f.view.modalEl.attrs.get('aria-busy'),'true');assert.ok(f.view.contentEl.querySelectorAll('button').every((button:El)=>button.disabled));
 available=false;fresh.resolve();await next;assert.equal(f.view.closeCalls,1);assert.equal(f.view.shouldRestoreSelection,true);
});
test('same-open metadata invalidation releases busy state and permits a fresh scan',async()=>{
 const f=fixture(),read=deferred();let hops=0,guard!:()=>boolean;
 f.host.locateOccurrence=async(_item,_items,current)=>{guard=current;await read.promise;if(current())hops++;};
 const pending=f.view.locate(items[0],items);f.view.markStale('文件路径已变化，请刷新关联。',true);assert.equal(guard(),false);
 read.resolve();await pending;assert.equal(hops,0);assert.equal(f.view.active,true);assert.equal(f.view.closeCalls,0);assert.equal(f.view.locating,false);assert.equal(f.view.modalEl.attrs.has('aria-busy'),false);assert.ok(f.view.contentEl.querySelectorAll('button').every((button:El)=>!button.disabled));
 await f.refresh();assert.deepEqual(f.view.occurrences,items);assert.equal(f.view.shouldRestoreSelection,true);
});
test('reopening after pending cancellation clears busy before a new request',async()=>{
 const f=fixture(),read=deferred();f.host.current=()=>true;f.host.closed=()=>{};f.host.locateOccurrence=async()=>{await read.promise;};
 const pending=f.view.locate(items[0],items);f.view.close();f.view.open();assert.equal(f.view.locating,false);assert.equal(f.view.modalEl.attrs.has('aria-busy'),false);assert.equal(f.view.shouldRestoreSelection,true);
 const rendered=f.rendered();read.resolve();await pending;assert.equal(f.view.closeCalls,1);assert.equal(f.view.active,true);assert.equal(f.view.modalEl.attrs.has('aria-busy'),false);assert.equal(f.rendered(),rendered);
});
test('an already revoked origin at open never restores an old selection',()=>{
 const f=fixture();f.host.current=()=>false;f.view.open();assert.equal(f.view.closeCalls,1);assert.equal(f.view.restoredSelections,0);
});
test('closed owner window invalidates open without selecting its previous opener',()=>{
 const f=fixture();f.doc.defaultView.closed=true;f.view.open();assert.equal(f.view.closeCalls,1);assert.equal(f.view.restoredSelections,0);
});
