/// <reference types="obsidian" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as brain from '../src/brain-board';
import * as documents from '../src/board-document';
import * as relationGeometry from '../src/relation-geometry-checkpoint';
import {HandwritingHistory} from '../src/handwriting-history';
import {isHandwritingBoard} from '../src/handwriting-board';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {isWorkspaceFile} from '../src/workspace';
import {isBoardPath} from '../src/board-path';
import {planCaptureReferences} from '../src/capture-reference-placement';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';
import {CaptureDeliveryOperation,CaptureCreationUnconfirmedError,newCaptureDraft,captureNoteSource} from '../src/capture-delivery';

// Shipped root coordinator + real Session/change/persist/history and document
// replacement. Obsidian windows, native picker and Vault storage are boundaries;
// actual rendering and device interaction remain the isolated native QA's job.
const source=readFileSync('src/main.ts','utf8');
function take(from:string,to:string){const start=source.indexOf(from),end=source.indexOf(to,start+from.length);assert.ok(start>=0&&end>start,from);return source.slice(start,end);}
function compile(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const yaml=(text:string)=>text.includes('thoughtspace: board')?{thoughtspace:'board'}:{};
class TFile {
 stat={mtime:1,size:100,ctime:1};parent={path:'Boards'};
 constructor(public path:string,public board=false){}
 get extension(){return this.path.split('.').at(-1)!;}get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
}
class Element {
 isConnected=true;focuses=0;
 constructor(public ownerDocument:any){}
 querySelector(){return{focus:()=>this.focuses++};}
 appendChild(child:Element){child.ownerDocument=this.ownerDocument;return child;}
}
class FileView {containerEl:Element;constructor(public file:TFile,doc:any){this.containerEl=new Element(doc);}}
class BoardView extends FileView {
 closed=false;isClosing=false;locationRestores=0;locationCaptures=0;prepares=0;
 constructor(file:TFile,doc:any,public session:any){super(file,doc);}
 captureConvenienceLocation(){this.locationCaptures++;return{viewport:{...this.session.board.viewport},selected:['origin-selected']};}
 async restoreConvenienceLocation(value:any,current:()=>boolean){assert.ok(current());this.locationRestores++;this.session.board.viewport={...value.viewport};}
 async prepareVideoBridge(){this.prepares++;}
}
class CaptureModal {
 modalEl:Element;operation:CaptureDeliveryOperation<any,any,any>;opened=false;closeCount=0;
 constructor(_app:unknown,public host:any){this.modalEl=new Element(host.document);this.modalEl.isConnected=false;this.operation=new CaptureDeliveryOperation(host.draft,host);}
 open(){this.opened=true;this.modalEl.isConnected=true;}
 close(){this.closeCount++;this.modalEl.isConnected=false;this.operation.cancel();this.host.closed?.();}
}
function fixture(markdown=true){
 const doc:any={defaultView:{closed:false,addEventListener(){},removeEventListener(){}}};doc.body=new Element(doc);
 const initial={...model.emptyBoard(),version:3 as const,nodes:[{id:'group',kind:'section' as const,title:'Research',x:0,y:0,width:900,height:1600,color:'sand' as const},{id:'untouched',kind:'text' as const,text:'Existing text',x:1300,y:45,width:240,height:100,color:'sand' as const}]};
 const boardFile=new TFile(markdown?'Boards/Target.md':'Boards/Target.thoughtspace',true),nativeNote=new TFile('Notes/Native.md');
 const files=new Map<string,TFile>([[boardFile.path,boardFile],[nativeNote.path,nativeNote]]),texts=new Map<TFile,string>();
 const raw=markdown?documents.createMarkdownBoardDocument(initial,'Target').replace('thoughtspace: board','thoughtspace: board\nunknown: retained # comment')+'\nNative body untouched.\n':JSON.stringify(initial,null,2);
 texts.set(boardFile,raw);texts.set(nativeNote,'---\nunknown: native\n---\nNever overwrite native body\n');
 const events=new Map<string,Set<()=>void>>(),errors:unknown[]=[],notices:string[]=[],pickers:any[]=[],bindings:any[]=[],sessionCalls:TFile[]=[];
 let creates=0,processCalls=0,recoveries=0,failProcess=false,failCreate=false,createCommittedFailure=false,createAmbiguousFailure=false,createCacheLag=false,current=true,nextId=0,active:any,owner:any,folderGate:ReturnType<typeof deferred>|undefined,createGate:ReturnType<typeof deferred>|undefined,readGate:ReturnType<typeof deferred>|undefined,processGate:ReturnType<typeof deferred>|undefined,sessionGate:ReturnType<typeof deferred>|undefined;
 const hooks:{afterRead?:()=>void;beforeCreate?:()=>void;changeNativeOnValidation?:boolean;nativeChecks?:number}={};
 const app:any={nativeOpen:false,workspace:{containerEl:new Element(doc),get activeLeaf(){return active;},getMostRecentLeaf:()=>active,getActiveViewOfType:(type:any)=>active?.view instanceof type?active.view:null,getLeavesOfType:()=>active?[active]:[],on:(name:string,callback:()=>void)=>{const set=events.get(name)||new Set();set.add(callback);events.set(name,set);return{name,callback};},offref:(ref:any)=>events.get(ref.name)?.delete(ref.callback),revealLeaf:async(leaf:any)=>{active=leaf;for(const callback of events.get('active-leaf-change')||[])callback();},setActiveLeaf:(leaf:any)=>{active=leaf;for(const callback of events.get('active-leaf-change')||[])callback();}},vault:{
  getAbstractFileByPath:(path:string)=>files.get(path),adapter:{exists:async(path:string)=>files.has(path)||[...texts.keys()].some(file=>file.path===path)},
  read:async(file:TFile)=>{await readGate?.promise;hooks.afterRead?.();if(!texts.has(file))throw Error('Read failed');return texts.get(file)!;},
  create:async(path:string,body:string)=>{creates++;hooks.beforeCreate?.();await createGate?.promise;if(failCreate)throw Error('Create rejected');const file=new TFile(path);if(!createCacheLag)files.set(path,file);texts.set(file,createAmbiguousFailure?'Competing native source':body);if(createCommittedFailure||createAmbiguousFailure||createCacheLag)throw Error('Create result lost');return file;},
  process:async(file:TFile,change:(source:string)=>string)=>{processCalls++;await processGate?.promise;if(failProcess)throw Error('Disk unavailable');const result=change(texts.get(file)!);texts.set(file,result);}
 }};
 const nativeOwnership=(app:any)=>{hooks.nativeChecks=(hooks.nativeChecks||0)+1;if(hooks.changeNativeOnValidation&&hooks.nativeChecks===2)app.nativeOpen=true;if(app.nativeOpen)throw Error('Native ownership active');};
 const shared={...model,...mindmap,...brain,...documents,...relationGeometry,reflowReadingContent,HandwritingHistory,isHandwritingBoard,parseYaml:yaml,EXT:'thoughtspace',Notice:class{constructor(message:string){notices.push(message);}},report:(error:unknown)=>errors.push(error),hasNativeBoardEditor:(app:any)=>app.nativeOpen,assertBoardEditorOwnership:nativeOwnership};
 const Session=compile(take('class Session {','\ntype BoardGraph=')+';return Session',shared);
 class BoardPicker {
  containerEl=new Element(doc);closed=false;placeholder='';
  constructor(_app:unknown,_current:unknown,public pick:(file:TFile)=>unknown){pickers.push(this);}
  onOpen(){}onClose(){}open(){this.onOpen();}close(){this.closed=true;this.onClose();}setPlaceholder(text:string){this.placeholder=text;}onChooseItem(file:TFile){void Promise.resolve(this.pick(file)).catch(error=>errors.push(error));}
 }
 const Plugin=compile('class CapturePlugin{'+take('  private captureDraft:','  async createFromTemplate(')+'};return CapturePlugin',{
  ...shared,TFile,FileView,BoardView,BoardPicker,CaptureDeliveryModal:CaptureModal,ConvenienceNavigationLease,newCaptureDraft,captureNoteSource,CaptureCreationUnconfirmedError,planCaptureReferences,isWorkspaceFile,isBoardPath,isBoardFile:(_app:any,file:TFile)=>file.board,
  uid:()=>`delivery-0000000${++nextId}`,VIEW:'thoughtspace-board',normalizePath:(path:string)=>path.replace(/\/+/g,'/').replace(/^\//,''),applyDefaultCardStyle:(node:model.Card)=>node,
  bindBoardModalViewport:(root:any)=>{const binding={root,disposed:0};bindings.push(binding);return()=>binding.disposed++;}
 });
 const plugin=new Plugin();Object.assign(plugin,{app,settings:{cardFolder:'Notes',defaultCardWidth:320,defaultCardStyle:{},hub:{recent:[]}},nativeBoardTransitions:new Set(),boardOpeningNavigation:new Set(),folder:async()=>{await folderGate?.promise;},createUnique:async(_folder:string,_title:string,extension:string,body:string)=>{recoveries++;const file=new TFile(`Recovery/Recovered-${recoveries}.${extension}`);files.set(file.path,file);texts.set(file,body);return file;},session:async(file:TFile)=>{sessionCalls.push(file);await sessionGate?.promise;return owner;},nativeBoardEditorStatus:()=>({open:app.nativeOpen?1:0,pending:0})});
 owner=new Session(plugin,boardFile,raw);const view=new BoardView(boardFile,doc,owner),leaf={view,getViewState:()=>({type:'thoughtspace-board',state:{file:view.file.path}})};active=leaf;
 const emit=(name:string)=>{for(const callback of events.get(name)||[])callback();};
 const open=(realOrigin=false)=>{if(!realOrigin)plugin.convenienceOrigin=()=>({document:doc,current:()=>current,watch:()=>()=>{},stop:()=>{current=false;},returnToOrigin:async(ready:()=>boolean)=>{assert.ok(current&&ready());}});return plugin.quickCapture() as CaptureModal;};
 const destination=(groupId?:string)=>({key:boardFile.path,title:'Target',pathSnapshot:boardFile.path,target:{file:boardFile,path:boardFile.path,owner,view},groups:[{id:'group',title:'Research'}],groupId});
 return{plugin,app,owner,view,leaf,files,texts,boardFile,nativeNote,raw,doc,pickers,bindings,sessionCalls,hooks,errors,notices,open,destination,counts:()=>({creates,processCalls,recoveries}),stop:()=>{current=false;},resume:()=>{current=true;},failProcess:(value=true)=>failProcess=value,failCreate:()=>failCreate=true,committedCreateFailure:()=>createCommittedFailure=true,ambiguousCreateFailure:()=>createAmbiguousFailure=true,cacheLagCreate:()=>createCacheLag=true,gateCreate:()=>{createGate=deferred();return createGate;},gateFolder:()=>{folderGate=deferred();return folderGate;},gateRead:()=>{readGate=deferred();return readGate;},gateProcess:()=>{processGate=deferred();return processGate;},gateSession:()=>{sessionGate=deferred();return sessionGate;},navigateAway:()=>{const other=new FileView(nativeNote,doc);active={view:other,getViewState:()=>({type:'markdown',state:{file:nativeNote.path}})};emit('active-leaf-change');},navigateBack:()=>{active=leaf;emit('active-leaf-change');}};
}
function fill(modal:CaptureModal,destination?:unknown){modal.operation.setContent('Captured title','Exact captured body\r\n');if(destination)modal.operation.selectDestination(destination as any);}

test('shipped deterministic create uses capture ID, preserves user source and performs one reference/history transaction',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination('group'));const original=model.clone(f.owner.board),result=await modal.operation.run();
 assert.equal(result.file.path,'Notes/Captured title-00000001.md');assert.equal(f.texts.get(result.file),'# Captured title\n\nExact captured body\r\n');assert.equal(f.texts.get(f.nativeNote),'---\nunknown: native\n---\nNever overwrite native body\n');assert.deepEqual(f.owner.history.undoStack.length,1);assert.equal(f.owner.board.nodes.find((node:model.Card)=>node.file===result.file.path)?.id,'capture-delivery-00000001');assert.deepEqual(f.owner.board.nodes.find((node:model.Card)=>node.id==='untouched'),original.nodes[1]);assert.match(f.texts.get(f.boardFile)!,/unknown: retained # comment/);assert.ok(f.texts.get(f.boardFile)!.endsWith('Native body untouched.\n'));
});
test('create API rejection after confirmed exact-byte creation returns that same file without a second create',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.committedCreateFailure();const result=await modal.operation.run();assert.equal(f.counts().creates,1);assert.equal(f.files.get(result.file.path),result.file);assert.equal(f.owner.board.nodes.filter((node:model.Card)=>node.file===result.file.path).length,1);await modal.operation.run();assert.equal(f.counts().creates,1);
});
test('ambiguous committed create retains conflicting source and blocks duplicate retry',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.ambiguousCreateFailure();await assert.rejects(modal.operation.run(),CaptureCreationUnconfirmedError);await assert.rejects(modal.operation.run(),/无法确认/);assert.equal(f.counts().creates,1);assert.equal([...f.files.values()].filter(file=>file.path.includes('Captured title')).length,1);assert.equal([...f.texts.values()].filter(raw=>raw==='Competing native source').length,1);assert.equal(f.owner.history.undoStack.length,0);
});
test('preexisting deterministic path is never overwritten even when body happens to match',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());const file=new TFile('Notes/Captured title-00000001.md'),body=captureNoteSource({title:'Captured title',body:'Exact captured body\r\n'});f.files.set(file.path,file);f.texts.set(file,body);await assert.rejects(modal.operation.run(),CaptureCreationUnconfirmedError);assert.equal(f.counts().creates,0);assert.equal(f.texts.get(file),body);assert.equal(f.owner.history.undoStack.length,0);
});
test('committed create with lagging Vault cache remains uncertain and cannot restart under a new capture ID',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.cacheLagCreate();await assert.rejects(modal.operation.run(),CaptureCreationUnconfirmedError);assert.equal(f.counts().creates,1);assert.throws(()=>modal.operation.setContent('Different title','new body'),/不能覆盖/);await assert.rejects(modal.operation.run());assert.equal(f.counts().creates,1);assert.equal([...f.texts.keys()].filter(file=>file.path.includes('Captured title')).length,1);assert.equal(f.owner.history.undoStack.length,0);
});
test('creation rejection with confirmed storage absence remains editable and preserves source input',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failCreate();await assert.rejects(modal.operation.run(),/Create rejected/);assert.equal(modal.operation.contentLocked,false);modal.operation.setContent('Updated title','Retained body');assert.equal(modal.host.draft.title,'Updated title');assert.equal(modal.host.draft.body,'Retained body');assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.counts().creates,1);
});
test('existing disk file absent from Vault cache blocks preflight without writing or adopting it',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());const file=new TFile('Notes/Captured title-00000001.md');f.texts.set(file,'External uncached file');await assert.rejects(modal.operation.run(),CaptureCreationUnconfirmedError);assert.equal(f.counts().creates,0);assert.equal(f.texts.get(file),'External uncached file');assert.equal(modal.operation.contentLocked,true);
});
for(const unavailable of ['read-error','unsupported'] as const)test(`creation preflight ${unavailable} remains uncertain rather than writing blindly`,async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.app.vault.adapter.exists=unavailable==='read-error'?async()=>{throw Error('Cannot confirm disk state');}:undefined;
 await assert.rejects(modal.operation.run(),CaptureCreationUnconfirmedError);assert.equal(f.counts().creates,0);assert.equal(modal.operation.contentLocked,true);assert.equal(modal.host.draft.body,'Exact captured body\r\n');
});
test('failed create followed by unavailable absence check locks the original capture identity',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failCreate();let checks=0;f.app.vault.adapter.exists=async()=>{if(++checks===1)return false;throw Error('Cannot check create outcome');};await assert.rejects(modal.operation.run(),CaptureCreationUnconfirmedError);assert.equal(checks,2);assert.equal(f.counts().creates,1);assert.equal(modal.operation.contentLocked,true);await assert.rejects(modal.operation.run());assert.equal(f.counts().creates,1);
});
test('cancel during existence preflight never proceeds to native create',async()=>{
 const f=fixture(),modal=f.open(),gate=deferred<boolean>();fill(modal,f.destination());f.app.vault.adapter.exists=()=>gate.promise;const request=modal.operation.run();await tick();modal.close();gate.resolve(false);await assert.rejects(request,/创建已取消/);assert.equal(f.counts().creates,0);assert.equal(f.owner.history.undoStack.length,0);
});
test('cancel during exact-byte confirmation after failed create retains the confirmed file without reference or navigation',async()=>{
 const f=fixture(),modal=f.open(),gate=f.gateRead();fill(modal,f.destination());f.committedCreateFailure();const request=modal.operation.run();await tick();modal.close();gate.resolve(undefined);await assert.rejects(request,/原位置已变化/);assert.ok(modal.host.draft.attempt.file);assert.equal(f.counts().creates,1);assert.equal(f.owner.history.undoStack.length,0);
});
test('cancel before folder resolution causes no create and retains input',async()=>{
 const f=fixture(),modal=f.open(),gate=f.gateFolder();fill(modal,f.destination());const pending=modal.operation.run();await tick();modal.close();gate.resolve(undefined);await assert.rejects(pending,/取消/);assert.equal(f.counts().creates,0);assert.equal(modal.host.draft.body,'Exact captured body\r\n');
});
test('cancel after native create starts retains late file but makes no board edit; reopen uses same file',async()=>{
 const f=fixture(),modal=f.open(),gate=f.gateCreate();fill(modal,f.destination());const pending=modal.operation.run();await tick();modal.close();gate.resolve(undefined);await assert.rejects(pending,/原位置已变化/);assert.ok(modal.host.draft.attempt?.file);assert.equal(f.owner.history.undoStack.length,0);f.resume();const reopened=f.open();await reopened.operation.run();assert.equal(f.counts().creates,1);assert.equal(f.owner.history.undoStack.length,1);
});
for(const change of ['target-close','target-rename','target-replace','session-replace','group-delete','group-lock','native-open','native-transition'] as const)test(`shipped destination rejects ${change} before any creation`,async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination('group'));
 if(change==='target-close')f.view.closed=true;if(change==='target-rename')f.boardFile.path='Boards/Renamed.md';if(change==='target-replace')f.files.set(f.boardFile.path,new TFile(f.boardFile.path,true));if(change==='session-replace')f.view.session={};if(change==='group-delete')f.owner.board.nodes=f.owner.board.nodes.filter((node:model.Card)=>node.id!=='group');if(change==='group-lock')f.owner.board.nodes[0].locked=true;if(change==='native-open')f.app.nativeOpen=true;if(change==='native-transition')f.plugin.nativeBoardTransitions.add(f.boardFile);
 await assert.rejects(modal.operation.run());assert.equal(f.counts().creates,0);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.texts.get(f.boardFile),f.raw);
});
test('loading target Session is non-navigating and revalidates target after asynchronous return',async()=>{
 const f=fixture(),gate=f.gateSession(),request=f.plugin.captureDestination(f.boardFile,()=>true);await tick();f.view.closed=true;gate.resolve(undefined);await assert.rejects(request,/页面已变化/);assert.equal(f.sessionCalls.length,1);assert.equal(f.view.locationRestores,0);
});
test('destination contains only unlocked real section groups',async()=>{
 const f=fixture();f.owner.board.nodes.push({id:'locked',kind:'section',title:'Locked',locked:true,x:0,y:1800,width:500,height:500,color:'sand'});const destination=await f.plugin.captureDestination(f.boardFile,()=>true,'当前白板');assert.deepEqual(destination.groups,[{id:'group',title:'Research'}]);assert.equal(destination.target.file,f.boardFile);assert.equal(destination.target.owner,f.owner);assert.equal(destination.target.view,f.view);
});
for(const markdown of [true,false])test(`failed ${markdown?'Markdown':'legacy'} save retries exact receipt without note/card/history duplication`,async()=>{
 const f=fixture(markdown),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run(),/未保存/);const attempt=modal.host.draft.attempt,stamp=attempt.placement.stamp,note=attempt.file,receipt=attempt.placement;assert.equal(attempt.placed,true);assert.equal(f.owner.blocked,true);assert.equal(f.texts.get(f.boardFile),f.raw);assert.ok(f.counts().recoveries>=1);f.failProcess(false);await modal.operation.run();assert.equal(modal.host.draft.attempt.file,note);assert.equal(modal.host.draft.attempt.placement,receipt);assert.equal(JSON.stringify(f.owner.board),stamp);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.owner.board.nodes.filter((node:model.Card)=>node.file===note.path).length,1);assert.equal(f.counts().creates,1);assert.equal(f.owner.blocked,false);
});
test('failed-write retry preserves external native YAML/body changes when layout baseline remains exact',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run());f.failProcess(false);const outside=f.raw.replace('unknown: retained # comment','unknown: native-new # exact\ncustom: [keep, this]')+'\nExternal native body.\r\n';f.texts.set(f.boardFile,outside);await modal.operation.run();const saved=f.texts.get(f.boardFile)!;assert.match(saved,/unknown: native-new # exact\ncustom: \[keep, this\]/);assert.ok(saved.endsWith('External native body.\r\n'));assert.equal(f.owner.history.undoStack.length,1);
});
test('failed-write retry refuses competing layout without overwriting disk or clearing input',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run());f.failProcess(false);const external=model.clone(documents.readBoardDocument(f.raw,'md',yaml).board);external.viewport.x=900;const outside=documents.replaceBoardDocumentLayout(f.raw,documents.readBoardDocument(f.raw,'md',yaml),external,yaml).source;f.texts.set(f.boardFile,outside);await assert.rejects(modal.operation.run(),/磁盘布局已变化/);assert.equal(f.texts.get(f.boardFile),outside);assert.equal(f.owner.blocked,true);assert.equal(f.counts().creates,1);assert.equal(modal.host.draft.body,'Exact captured body\r\n');
});
test('equal parsed layout with changed envelope bytes still fails at atomic baseline and preserves external extras',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run());f.failProcess(false);const outside=f.raw.replace('"format": "thoughtspace-board",','"unknownEnvelope": "outside",\n  "format": "thoughtspace-board",');f.texts.set(f.boardFile,outside);await assert.rejects(modal.operation.run(),/未保存/);assert.equal(f.texts.get(f.boardFile),outside);assert.equal(f.owner.blocked,true);assert.equal(f.counts().creates,1);
});
for(const reason of ['native-open','transition','draft-change','file-replacement'] as const)test(`retry never bypasses ${reason}`,async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run());f.failProcess(false);
 if(reason==='native-open')f.app.nativeOpen=true;if(reason==='transition')f.plugin.nativeBoardTransitions.add(f.boardFile);if(reason==='draft-change')f.owner.board.viewport.x+=1;if(reason==='file-replacement')f.files.set(f.boardFile.path,new TFile(f.boardFile.path,true));
 await assert.rejects(modal.operation.run());assert.equal(f.texts.get(f.boardFile),f.raw);assert.equal(f.counts().creates,1);assert.equal(f.owner.blocked,true);
});
test('cancellation while disk baseline read is pending cannot unblock or persist the old request',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run());f.failProcess(false);const gate=f.gateRead(),request=modal.operation.run();await tick();modal.close();gate.resolve(undefined);await assert.rejects(request,/页面或投递草稿已变化/);assert.equal(f.owner.blocked,true);assert.equal(f.texts.get(f.boardFile),f.raw);assert.equal(f.counts().creates,1);
});
test('native ownership acquired during retry read leaves original source untouched',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run());f.failProcess(false);f.hooks.afterRead=()=>{f.app.nativeOpen=true;};await assert.rejects(modal.operation.run(),/原生编辑尚未完成/);assert.equal(f.texts.get(f.boardFile),f.raw);assert.equal(f.owner.blocked,true);assert.equal(f.counts().creates,1);
});
test('actual root origin lease revokes away-and-return and releases event/unload ownership',()=>{
 const f=fixture(),scope=f.plugin.convenienceOrigin();let invalidated=0;scope.watch(()=>invalidated++);assert.equal(scope.current(),true);f.navigateAway();f.navigateBack();assert.equal(scope.current(),false);assert.equal(invalidated,1);assert.equal(f.plugin.boardOpeningNavigation.size,0);scope.stop();assert.equal(invalidated,1);
});
test('actual root return restores original camera when origin stays current and refuses renamed origin',async()=>{
 const f=fixture(),scope=f.plugin.convenienceOrigin(),camera={...f.owner.board.viewport};f.owner.board.viewport.x=777;await scope.returnToOrigin(()=>true);assert.deepEqual(f.owner.board.viewport,camera);assert.equal(f.view.locationRestores,1);f.boardFile.path='Boards/Moved.md';await assert.rejects(scope.returnToOrigin(()=>true),/页面已关闭或变化/);assert.equal(f.view.locationRestores,1);
});
test('owned picker cancellation settles once, late Session result cannot replace canceled choice',async()=>{
 const f=fixture(),gate=f.gateSession(),request=f.plugin.captureDestinationPicker(f.doc,()=>true),picker=f.pickers.at(-1);picker.onChooseItem(f.boardFile);await tick();request.close();gate.resolve(undefined);assert.equal(await request.result,undefined);await tick();assert.equal(picker.closed,true);
});
test('existing active capture modal is focused instead of opening concurrent coordinator',()=>{
 const f=fixture(),first=f.open(),second=f.plugin.quickCapture();assert.equal(first,second);assert.equal(first.modalEl.focuses,1);assert.equal(f.counts().creates,0);
});
test('default destination loading never silently overrides an explicitly chosen inbox',async()=>{
 const f=fixture(),modal=f.open(),gate=f.gateSession(),request=modal.host.destinations();await tick();modal.operation.selectDestination();gate.resolve(undefined);await request;assert.equal(modal.host.draft.destination,undefined,'late default discovery must preserve the user chosen inbox');
});
test('post-flush receipt verification rejects card replacement that happened during await',async()=>{
 const f=fixture(),modal=f.open(),file=new TFile('Notes/Placed.md');f.files.set(file.path,file);f.texts.set(file,'Kept source');
 const staged=modal.host.placeReference(file,f.destination(),'exact',()=>true);await f.owner.flush();
 f.owner.retryCaptureSave=async()=>{await Promise.resolve();f.owner.board.nodes=f.owner.board.nodes.map((node:model.Card)=>node.id==='capture-exact'?{...node,file:f.nativeNote.path}:node);};
 await assert.rejects(modal.host.flushPlacement(staged,()=>true),/卡片.*变化/);assert.equal(f.texts.get(file),'Kept source');assert.equal(f.texts.get(f.nativeNote),'---\nunknown: native\n---\nNever overwrite native body\n');
});
test('silent Session.change decline on a newly acquired native lock does not publish a false placement receipt',()=>{
 const f=fixture(),modal=f.open(),file=new TFile('Notes/Placed.md');f.files.set(file.path,file);f.texts.set(file,'Kept source');
 const original=f.owner.change.bind(f.owner);f.owner.change=(...args:any[])=>{f.app.nativeOpen=true;return original(...args);};
 assert.throws(()=>modal.host.placeReference(file,f.destination(),'exact',()=>true),/暂停|提交|变化|添加|卡片/);assert.equal(f.owner.board.nodes.some((node:model.Card)=>node.id==='capture-exact'),false);assert.equal(f.owner.history.undoStack.length,0);
});
test('batch receipt validates every source and card instance before persistence retry',async()=>{
 const f=fixture(),first=new TFile('Notes/First.md'),second=new TFile('Notes/Second.md');for(const file of [first,second]){f.files.set(file.path,file);f.texts.set(file,`Kept ${file.basename}`);}let id=0;
 const receipt=f.plugin.stageCaptureReferences([first,second],f.destination(),()=>`batch-${++id}`,()=>true);await f.owner.flush();assert.equal(receipt.references.length,2);assert.equal(f.owner.history.undoStack.length,1);
 f.owner.board.nodes=f.owner.board.nodes.filter((node:model.Card)=>node.id!=='batch-2');await assert.rejects(f.plugin.flushCapturePlacement(receipt,()=>true),/卡片或来源已变化/);assert.equal(f.texts.get(first),'Kept First');assert.equal(f.texts.get(second),'Kept Second');
});
test('batch receipt checks second source identity again after asynchronous flush',async()=>{
 const f=fixture(),first=new TFile('Notes/First.md'),second=new TFile('Notes/Second.md');for(const file of [first,second]){f.files.set(file.path,file);f.texts.set(file,`Kept ${file.basename}`);}let id=0;
 const receipt=f.plugin.stageCaptureReferences([first,second],f.destination(),()=>`batch-${++id}`,()=>true);await f.owner.flush();
 f.owner.retryCaptureSave=async()=>{await Promise.resolve();f.files.set(second.path,new TFile(second.path));};await assert.rejects(f.plugin.flushCapturePlacement(receipt,()=>true),/卡片或来源已变化/);assert.equal(f.owner.history.undoStack.length,1);assert.equal(f.texts.get(second),'Kept Second');
});
test('receipt refuses a source rename after the card instance was staged rather than silently retargeting it',async()=>{
 const f=fixture(),modal=f.open(),file=new TFile('Notes/First.md');f.files.set(file.path,file);f.texts.set(file,'Native edited after create');
 const receipt=modal.host.placeReference(file,f.destination(),'exact',()=>true);await f.owner.flush();f.files.delete(file.path);file.path='Notes/Renamed.md';f.files.set(file.path,file);
 await assert.rejects(modal.host.flushPlacement(receipt,()=>true),/卡片或来源已变化/);assert.equal(f.texts.get(file),'Native edited after create');assert.equal(f.owner.history.undoStack.length,1);
});
test('native body edits to the captured note survive board-save retry unchanged',async()=>{
 const f=fixture(),modal=f.open();fill(modal,f.destination());f.failProcess();await assert.rejects(modal.operation.run());const note=modal.host.draft.attempt.file;f.texts.set(note,'---\nnew-native-property: true\n---\nNative editor continued this source\r\n');f.failProcess(false);await modal.operation.run();assert.equal(f.texts.get(note),'---\nnew-native-property: true\n---\nNative editor continued this source\r\n');assert.equal(f.counts().creates,1);assert.equal(f.owner.history.undoStack.length,1);
});
test('native destination picker adopts requested document before viewport binding and releases binding',async()=>{
 const f=fixture(),other:any={defaultView:{closed:false}};other.body=new Element(other);const request=f.plugin.captureDestinationPicker(other,()=>true),picker=f.pickers.at(-1),binding=f.bindings.at(-1);assert.equal(picker.containerEl.ownerDocument,other);assert.equal(binding.root,picker.containerEl);assert.equal(binding.root.ownerDocument,other);request.close();await request.result;assert.equal(binding.disposed,1);
});
test('nested locked group rejects delivery without moving existing objects or losing newly captured note',async()=>{
 const f=fixture(),modal=f.open();f.owner.board.nodes.push({id:'locked-parent',kind:'section',title:'Locked parent',x:-100,y:-100,width:1100,height:1800,color:'sand',locked:true});fill(modal,f.destination('group'));const before=model.clone(f.owner.board);await assert.rejects(modal.operation.run(),/分组已锁定/);assert.deepEqual(f.owner.board,before);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.counts().creates,1);assert.ok(modal.host.draft.attempt?.file);assert.equal(modal.host.draft.attempt.placed,false);modal.operation.selectDestination();await modal.operation.run();assert.equal(f.counts().creates,1);
});
