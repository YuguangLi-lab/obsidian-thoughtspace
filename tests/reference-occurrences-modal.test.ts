import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {nativeRelations} from '../src/native-bridge';
import {isWorkspaceFile} from '../src/workspace';
import {boardReferenceOccurrences,type ReferenceOccurrence} from '../src/reference-occurrences';
import {emptyBoard} from '../src/model';

const source=readFileSync('src/native-bridge-view.ts','utf8');
function method(start:string,end:string){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,`shipped method ${start}`);return source.slice(from,to);}
const methods=[method('  private current(){','  private markStale('),method('  private markStale(','  private action('),method('  async refresh(){','  /** Reopen'),method('  private async locate(','  private render(){'),method('  onClose(){','\n}')].join('\n');
const notices:string[]=[];
class File {basename:string;extension='md';constructor(public path:string){this.basename=path.split('/').pop()!.replace(/\.md$/,'');}}
class Box {texts:string[]=[];buttons:{disabled:boolean}[]=[{disabled:false},{disabled:false}];emptyCount=0;empty(){this.emptyCount++;}setText(text:string){this.texts.push(text);}querySelector(){return undefined;}querySelectorAll(){return this.buttons;}}
const View=new Function('nativeRelations','isWorkspaceFile','Notice',transformSync('class View{'+methods+'};return View;',{loader:'ts'}).code)(nativeRelations,isWorkspaceFile,class {constructor(message:string){notices.push(message);}});
const note=new File('Sources/A.md');
const occurrences=()=>boardReferenceOccurrences({...emptyBoard(),nodes:[{id:'a',kind:'card',file:note.path,x:0,y:0,width:100,height:80,color:'slate'},{id:'b',kind:'card',file:note.path,x:200,y:0,width:100,height:80,color:'slate'}]},'Boards/B.md','B',note.path,path=>path);
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
function fixture(){
 const view=new View(),doc={defaultView:{closed:false}},files:File[]=[new File('Sources/A.md')];let epoch=0,renders=0,closed=0,unloaded=0,unbound=0,legacyReads=0,occurrenceReads=0;
 const content=new Box(),state=new Box(),nav=new Box(),list=new Box(),footer=new Box();
 const attributes=new Map<string,string>();
 const host={current:()=>epoch===0,document:doc,closed:()=>closed++,usages:async()=>{legacyReads++;return {files:[],errors:0};},occurrences:async()=>{occurrenceReads++;return {items:occurrences(),errors:0};},locateOccurrence:async(_item:ReferenceOccurrence,_items:readonly ReferenceOccurrence[],_current:()=>boolean)=>{}};
 Object.assign(view,{host,file:files[0],active:true,generation:0,locating:false,closedReported:false,selected:new Set(),boards:[],occurrences:[],errors:0,relations:{incoming:[],outgoing:[],unresolved:[]},page:0,state,nav,list,footer,contentEl:content,containerEl:{isConnected:true,ownerDocument:doc},modalEl:{setAttribute:(key:string,value:string)=>attributes.set(key,value),removeAttribute:(key:string)=>attributes.delete(key)},viewport:()=>unbound++,life:{unload:()=>unloaded++},app:{vault:{getAbstractFileByPath:(path:string)=>files.find(file=>file.path===path),getMarkdownFiles:()=>files},metadataCache:{resolvedLinks:{},unresolvedLinks:{}}},render:()=>renders++,close:()=>view.onClose()});
 return {view,host,files,doc,content,state,nav,list,footer,attributes,renders:()=>renders,closed:()=>closed,unloaded:()=>unloaded,unbound:()=>unbound,legacyReads:()=>legacyReads,occurrenceReads:()=>occurrenceReads,awayReturn:()=>{epoch++;}};
}
test('shipped modal loads exact occurrences instead of board-file-only results',async()=>{
 const f=fixture();await f.view.refresh();assert.equal(f.occurrenceReads(),1);assert.equal(f.legacyReads(),0);assert.deepEqual(f.view.occurrences.map((item:ReferenceOccurrence)=>item.nodeId),['a','b']);assert.equal(f.renders(),1);assert.equal(f.files[0].path,'Sources/A.md');
});
test('legacy native bridge host stays compatible when no occurrence provider is supplied',async()=>{
 const f=fixture();delete (f.host as {occurrences?:unknown}).occurrences;await f.view.refresh();assert.equal(f.legacyReads(),1);assert.equal(f.occurrenceReads(),0);assert.equal(f.renders(),1);
});
test('newer refresh wins without publishing an older completed scan',async()=>{
 const f=fixture(),first=deferred<{items:ReferenceOccurrence[];errors:number}>(),second=deferred<{items:ReferenceOccurrence[];errors:number}>();let calls=0;
 f.host.occurrences=()=>++calls===1?first.promise:second.promise;const a=f.view.refresh(),b=f.view.refresh();second.resolve({items:[occurrences()[1]],errors:2});await b;first.resolve({items:[occurrences()[0]],errors:0});await a;
 assert.deepEqual(f.view.occurrences.map((item:ReferenceOccurrence)=>item.nodeId),['b']);assert.equal(f.view.errors,2);assert.equal(f.renders(),1);
});
test('closing an asynchronously reading modal releases viewport/listeners and blocks late publication',async()=>{
 const f=fixture(),read=deferred<{items:ReferenceOccurrence[];errors:number}>();let guard!:()=>boolean;f.host.occurrences=(_file?:File,current?:()=>boolean)=>{guard=current!;return read.promise;};const loading=f.view.refresh();f.view.onClose();assert.equal(guard(),false);read.resolve({items:occurrences(),errors:0});await loading;
 assert.deepEqual(f.view.occurrences,[]);assert.equal(f.renders(),0);assert.equal(f.closed(),1);assert.equal(f.unloaded(),1);assert.equal(f.unbound(),1);f.view.onClose();assert.equal(f.closed(),1);
});
test('origin navigation away and return cannot resurrect an old asynchronous result',async()=>{
 const f=fixture(),read=deferred<{items:ReferenceOccurrence[];errors:number}>();f.host.occurrences=()=>read.promise;const loading=f.view.refresh();f.awayReturn();read.resolve({items:occurrences(),errors:0});await loading;assert.deepEqual(f.view.occurrences,[]);assert.equal(f.renders(),0);assert.equal(f.view.current(),false);
});
test('source file rename during scan rejects the old path even when TFile identity survives',async()=>{
 const f=fixture(),read=deferred<{items:ReferenceOccurrence[];errors:number}>();f.host.occurrences=()=>read.promise;const loading=f.view.refresh();f.files[0].path='Moved/A.md';read.resolve({items:occurrences(),errors:0});await loading;assert.deepEqual(f.view.occurrences,[]);assert.equal(f.renders(),0);
});
test('replacement source file at the same path cannot inherit an in-flight scan',async()=>{
 const f=fixture(),read=deferred<{items:ReferenceOccurrence[];errors:number}>();f.host.occurrences=()=>read.promise;const loading=f.view.refresh();f.files[0]=new File('Sources/A.md');read.resolve({items:occurrences(),errors:0});await loading;assert.deepEqual(f.view.occurrences,[]);assert.equal(f.renders(),0);
});
test('rename/delete invalidation removes stale locations and invalidates pending callback',async()=>{
 const f=fixture(),read=deferred<{items:ReferenceOccurrence[];errors:number}>();let guard!:()=>boolean;f.host.occurrences=(_file?:File,current?:()=>boolean)=>{guard=current!;return read.promise;};const loading=f.view.refresh();f.view.markStale('文件路径已变化，请刷新关联。',true);assert.equal(guard(),false);read.resolve({items:occurrences(),errors:0});await loading;assert.deepEqual(f.view.occurrences,[]);assert.equal(f.renders(),1);assert.ok(f.state.texts.at(-1)?.includes('文件路径已变化'));
});
test('read failure preserves source and gives no invented empty success count',async()=>{
 const f=fixture();f.host.occurrences=async()=>{throw Error('unreadable board');};await f.view.refresh();assert.ok(f.state.texts.at(-1)?.includes('unreadable board'));assert.equal(f.renders(),0);assert.equal(f.files[0].path,'Sources/A.md');assert.equal(f.list.emptyCount,1);
});
test('repeated clicks launch one exact locate and close only after success',async()=>{
 const f=fixture(),jump=deferred<void>(),items=occurrences();let calls=0,seen:ReferenceOccurrence|undefined;f.host.locateOccurrence=async(item:ReferenceOccurrence)=>{calls++;seen=item;await jump.promise;};const first=f.view.locate(items[1],items),second=f.view.locate(items[0],items);assert.equal(calls,1);assert.equal(f.view.locating,true);assert.equal(f.closed(),0);assert.ok(f.content.buttons.every(button=>button.disabled));jump.resolve();await Promise.all([first,second]);assert.equal(seen?.nodeId,'b');assert.equal(f.closed(),1);assert.equal(f.view.active,false);
});
test('closing pending exact locate cancels the host guard and does not publish a late hop',async()=>{
 const f=fixture(),jump=deferred<void>(),items=occurrences();let current!:()=>boolean,hops=0;f.host.locateOccurrence=async(_item:ReferenceOccurrence,_items:readonly ReferenceOccurrence[],guard:()=>boolean)=>{current=guard;await jump.promise;if(guard())hops++;};const first=f.view.locate(items[0],items);f.view.onClose();assert.equal(current(),false);jump.resolve();await first;assert.equal(hops,0);assert.equal(f.closed(),1);
});
test('a failed target keeps the panel open and restores controls for refresh/retry',async()=>{
 const f=fixture(),items=occurrences();f.host.locateOccurrence=async()=>{throw Error('node was removed');};await f.view.locate(items[1],items);assert.equal(f.closed(),0);assert.equal(f.view.active,true);assert.equal(f.view.locating,false);assert.ok(f.content.buttons.every(button=>!button.disabled));assert.ok(f.state.texts.at(-1)?.includes('node was removed'));assert.equal(f.renders(),1);
});
test('window closing or wrong owner document blocks reads and navigation',async()=>{
 const f=fixture();f.doc.defaultView.closed=true;await f.view.refresh();await f.view.locate(occurrences()[0],occurrences());assert.equal(f.occurrenceReads(),0);assert.equal(f.renders(),0);f.doc.defaultView.closed=false;f.view.containerEl.ownerDocument={defaultView:{closed:false}};assert.equal(f.view.current(),false);
});

const bar=readFileSync('src/reference-occurrences-view.ts','utf8'),buttonFrom=bar.indexOf(' private button('),buttonTo=bar.indexOf(' private error(',buttonFrom);assert.ok(buttonFrom>0&&buttonTo>buttonFrom);
const Bar=new Function('setIcon',transformSync('class Bar{'+bar.slice(buttonFrom,buttonTo)+'};return Bar;',{loader:'ts'}).code)(()=>{});
function buttonFixture(){let cancelCalls=0,navigateCalls=0;const bar=new Bar(),button={disabled:false,onclick:undefined as (()=>void)|undefined,createSpan:()=>({})};Object.assign(bar,{trail:{pending:true},stopped:false,element:{isConnected:true},status:{setText:()=>{}},error:(e:unknown)=>{throw e;}});const parent={createEl:()=>button};return {bar,button,parent,cancel:()=>cancelCalls++,navigate:()=>navigateCalls++,cancelCalls:()=>cancelCalls,navigateCalls:()=>navigateCalls};}
test('the shipped toolbar close button cancels an awaited navigation while other actions stay blocked',()=>{
 const close=buttonFixture();close.bar.button(close.parent,'关闭引用导航','x',close.cancel,true,true);close.button.onclick!();assert.equal(close.cancelCalls(),1);const next=buttonFixture();next.bar.button(next.parent,'下一处','chevron-right',next.navigate,true);next.button.onclick!();assert.equal(next.navigateCalls(),0);
});

test('a direct collection placement scans then locates the exact requested instance through the shared host',async()=>{const f=fixture();let selected:string|undefined;(f.host as any).initialOccurrence={boardPath:'Boards/B.md',nodeId:'b'};f.host.locateOccurrence=async item=>{selected=item.nodeId;};await f.view.refresh();assert.equal(selected,'b');assert.equal(f.closed(),1);assert.equal((f.host as any).initialOccurrence,undefined);});
test('a removed direct placement reports unavailable instead of opening another instance',async()=>{const f=fixture();let calls=0;(f.host as any).initialOccurrence={boardPath:'Boards/B.md',nodeId:'gone'};f.host.locateOccurrence=async()=>{calls++;};await f.view.refresh();assert.equal(calls,0);assert.match(f.state.texts.at(-1)!,/移除|确认/);assert.equal(f.closed(),0);});
