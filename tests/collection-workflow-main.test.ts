import * as reviewFeature from '../src/collection-review';
import * as duplicateFeature from '../src/collection-duplicates';
/// <reference types="obsidian" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as recovery from '../src/collection-recovery';
import * as journalStore from '../src/collection-journal-store';
import * as collectionModel from '../src/collection-model';
import * as collectionSearch from '../src/collection-search';
import * as collectionTasks from '../src/collection-tasks';
import {CollectionBoardReceipts} from '../src/collection-board-receipts';
import {readBoardDocument} from '../src/board-document';
import * as collectionJsonStore from '../src/collection-json-store';
import * as collectionSavedFilters from '../src/collection-saved-filters';
import * as collectionBatch from '../src/collection-batch';
import * as nativeTags from '../src/native-tags';
import * as workspaceFiles from '../src/workspace';
import {emptyBoard,type Board} from '../src/model';
import {planCaptureReferences} from '../src/capture-reference-placement';
import {planCollectionReferenceRename} from '../src/collection-placement-recovery';
import {applyDefaultCardStyle} from '../src/card-style';
import type {CollectionRecord,CollectionTarget} from '../src/collection-view';

// Real collection host/library, batch journal, main delivery methods and planner.
// Only Obsidian events/storage and the Session mutation/save boundary are mocked;
// actual Session CAS/native ownership is exercised by capture-main-integration.
const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:(source:string)=>unknown}).load;
class Component {registerEvent(_ref:unknown){} }
class TFile {
 stat={mtime:1,size:100,ctime:1};
 constructor(public path:string){}
 get extension(){return this.path.split('.').at(-1)!;}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
}
const obsidian={Component,TFile,FuzzySuggestModal:class{},normalizePath:(path:string)=>path.replace(/\\/g,'/').replace(/\/+/g,'/').replace(/\/$/,''),parseYaml,getAllTags:()=>[]};
function load<T>(path:string,dependencies:Record<string,unknown>):T {
 const module={exports:{}},code=transformSync(readFileSync(path,'utf8'),{loader:'ts',format:'cjs'}).code;
 new Function('require','module','exports',code)((name:string)=>{assert.ok(Object.hasOwn(dependencies,name),`Unexpected dependency ${name}`);return dependencies[name];},module,module.exports);
 return module.exports as T;
}
const libraryModule=load<typeof import('../src/collection-library')>('src/collection-library.ts',{'obsidian':obsidian,'./collection-model':collectionModel,'./collection-review':reviewFeature,'./collection-duplicates':duplicateFeature,'./collection-review-host':{setCollectionReview:async()=>{throw Error('review write not provided by this fixture');}},'./collection-search':collectionSearch,'./collection-tasks':collectionTasks,'./workspace':workspaceFiles});
const contextModule=load<typeof import('../src/collection-context')>('src/collection-context.ts',{'obsidian':obsidian,'./collection-model':collectionModel,'./workspace':workspaceFiles});
const hostModule=load<typeof import('../src/collection-host')>('src/collection-host.ts',{'obsidian':obsidian,'./collection-recovery':recovery,'./collection-model':collectionModel,'./collection-library':libraryModule,'./collection-context':contextModule,'./collection-note-export':{CollectionNoteExporter:class{constructor(){throw Error('Unexpected note export');}}},'./collection-json-store':collectionJsonStore,'./collection-saved-filters':collectionSavedFilters,'./collection-batch':collectionBatch,'./collection-duplicates':duplicateFeature,'./collection-review-host':{setCollectionReview:async()=>{throw Error('review write not provided by this fixture');}},'./collection-organize':{setCollectionFlag:()=>{throw Error('Unexpected flag write');}},'./collection-journal-store':journalStore,'./native-tags':nativeTags,'./workspace':workspaceFiles,'./board-modal-viewport':{bindBoardModalViewport:()=>()=>{}}});
const main=readFileSync('src/main.ts','utf8');
function take(from:string,to:string){const start=main.indexOf(from),end=main.indexOf(to,start+from.length);assert.ok(start>=0&&end>start,from);return main.slice(start,end);}
const methods=take('  private async deliverCollection(','  private captureDraft:')+take('  private validateCaptureDestination(','  private captureDestinationPicker(');
let nextNode=0;
const Plugin=new Function('uid','isWorkspaceFile','planCaptureReferences','applyDefaultCardStyle','CollectionBoardReceipts','readBoardDocument','parseYaml',transformSync('class Plugin{'+methods+'};return Plugin;',{loader:'ts'}).code)(()=> `reference-workflow-${++nextNode}`,workspaceFiles.isWorkspaceFile,planCaptureReferences,applyDefaultCardStyle,CollectionBoardReceipts,readBoardDocument,parseYaml);

async function fixture(){
 const directory='.obsidian/plugins/thoughtspace',disk=new Map<string,string>(),files=new Map<string,TFile>(),metadata=new Map<TFile,unknown>(),folders=new Set<string>(['.obsidian','.obsidian/plugins',directory]);
 const events=new Map<string,Set<(...args:any[])=>void>>();let id=0,changes=0,saves=0;
 const on=(name:string,callback:(...args:any[])=>void)=>{const listeners=events.get(name)||new Set();listeners.add(callback);events.set(name,listeners);return{name,callback};};
 const offref=(ref:any)=>events.get(ref.name)?.delete(ref.callback),emit=(name:string,...args:any[])=>{for(const callback of events.get(name)||[])callback(...args);};
 const records:CollectionRecord[]=Array.from({length:2},(_,index)=>({id:`capture-workflow-${index}`,createdAt:'2026-10-13T12:00:00.000Z',path:`Notes/Source-${index}.md`,title:`Source ${index}`,tags:[],archived:false,inBoard:false}));
 for(const record of records){const file=new TFile(record.path),text=collectionModel.collectionNoteSource({...record,body:'Native source body',tags:[]});files.set(file.path,file);disk.set(file.path,text);metadata.set(file,{frontmatter:{thoughtspace_capture:record.id,thoughtspace_created:record.createdAt}});}
 const source=files.get(records[0].path)!,boardFile=new TFile('Boards/Target.thoughtspace');files.set(boardFile.path,boardFile);
 const document={defaultView:{closed:false}},leaf:any={view:{containerEl:{isConnected:true,ownerDocument:document}}};
 const app:any={workspace:{activeLeaf:leaf,containerEl:{ownerDocument:document},on,offref},vault:{
  getFiles:()=>[...files.values()],getMarkdownFiles:()=>[...files.values()].filter(file=>file.extension==='md'),getAbstractFileByPath:(path:string)=>files.get(path),on:(name:string,callback:any)=>on(`vault-${name}`,callback),offref,
  read:async(file:TFile)=>{assert.ok(disk.has(file.path));return disk.get(file.path)!;},
  adapter:{exists:async(path:string)=>disk.has(path)||folders.has(path),mkdir:async(path:string)=>{folders.add(path);},list:async(path:string)=>({files:[...disk.keys()].filter(key=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')),folders:[]}),
   read:async(path:string)=>{assert.ok(disk.has(path));return disk.get(path)!;},write:async(path:string,text:string)=>{disk.set(path,text);},copy:async(from:string,to:string)=>{assert.ok(!disk.has(to));disk.set(to,disk.get(from)!);},process:async(path:string,change:(text:string)=>string)=>{const text=change(disk.get(path)!);disk.set(path,text);return text;},remove:async(path:string)=>{disk.delete(path);}},
 },metadataCache:{getFileCache:(file:TFile)=>metadata.get(file),on:(name:string,callback:any)=>on(`metadata-${name}`,callback),offref}};
 const control:{beforeValidate?:()=>void;saveFailure?:boolean;saveThenThrow?:boolean;beforeSave?:()=>void}={};
 const owner={file:boardFile,board:{...emptyBoard(),nodes:[{id:'group',kind:'section',title:'Group',x:0,y:0,width:900,height:1800,color:'sand'}]} as Board,nativeEditingPaused:false,blocked:false,
  retryCollectionReferenceRename:async(stamp:string,renames:{id:string;path:string;nextPath:string}[],current:()=>boolean)=>{assert.ok(current());owner.board=planCollectionReferenceRename(owner.board,stamp,renames)||owner.board;return JSON.stringify(owner.board);},
  refreshNativeEditing:()=>{control.beforeValidate?.();},change:(fn:()=>void)=>{changes++;fn();},retryCaptureSave:async()=>{saves++;control.beforeSave?.();if(control.saveFailure)throw Error('Injected native save failure');disk.set(boardFile.path,JSON.stringify(owner.board));if(control.saveThenThrow)throw Error('Injected late save failure');}};
 disk.set(boardFile.path,JSON.stringify(owner.board));
 const target:CollectionTarget={key:'live-target',title:'Target',path:boardFile.path,groups:[{id:'group',title:'Group'}],groupId:'group'};
 const plugin=new Plugin();Object.assign(plugin,{app,manifest:{id:'thoughtspace',dir:directory},settings:{defaultCardWidth:300,defaultCardStyle:'transparent'},nativeBoardTransitions:new Set(),collectionTargets:new Map([[target.key,{title:target.title,pathSnapshot:boardFile.path,target:{file:boardFile,path:boardFile.path,owner},groups:target.groups}]]),collectionPlacements:new Map()});
 const bridge:any={directory,newId:()=>`workflow-${++id}`,folder:()=> 'Notes',ensureFolder:async()=>{},deliver:(...args:unknown[])=>plugin.deliverCollection(...args),deliveryLocked:(session:string)=>plugin.collectionPlacements.has(session)};
 const library=new libraryModule.CollectionLibrary(app,{isBoardFile:file=>file.path===boardFile.path,readBoard:async()=>owner.board});library.onload();plugin.collectionLibrary=library;
 const workspace=new hostModule.CollectionWorkspace(app,library,bridge),host=workspace.host(leaf);await host.ready();
 return{app,disk,files,metadata,emit,records,source,boardFile,owner,target,plugin,control,host,counts:()=>({changes,saves}),run:()=>host.batch!({operation:'deliver',items:records,target},()=>true,()=>{}),close:()=>{host.release?.();workspace.onunload();library.onunload();}};
}

for(const reason of ['deleted-target','locked-group','native-paused'] as const)test(`batch delivery ${reason} is positively not-written before staging`,async()=>{
 const f=await fixture();
 try{
  const source=f.disk.get(f.source.path);
  if(reason==='deleted-target')f.files.delete(f.boardFile.path);
  else if(reason==='locked-group')f.owner.board.nodes[0].locked=true;
  else f.owner.nativeEditingPaused=true;
  const report=await f.run();assert.equal(report.items[0].status,'not-written');assert.equal(report.items[1].status,'not-started');assert.equal(report.phase,'stopped');
  assert.deepEqual(f.counts(),{changes:0,saves:0});assert.equal(f.plugin.collectionPlacements.size,0);assert.equal(f.disk.get(f.source.path),source);
 }finally{f.close();}
});
test('batch delivery save failure after staging is unknown and retains the exact pending receipt',async()=>{
 const f=await fixture();
 try{
  f.control.saveFailure=true;const report=await f.run();assert.equal(report.items[0].status,'unknown');assert.equal(report.items[1].status,'not-started');assert.equal(report.phase,'review-required');
  assert.deepEqual(f.counts(),{changes:1,saves:1});assert.equal(f.plugin.collectionPlacements.size,1);
  const pending=f.plugin.collectionPlacements.get(`record:${f.records[0].id}`);assert.equal(pending.file,f.source);assert.equal(pending.receipt.destination.target.file,f.boardFile);assert.equal(pending.receipt.references[0].file,f.source);
 }finally{f.close();}
});
test('identity invalidated inside destination validation is rejected by beforeStage without changing the board',async()=>{
 const f=await fixture();
 try{
  f.control.beforeValidate=()=>{f.metadata.set(f.source,{frontmatter:{thoughtspace_capture:'capture-replaced888',thoughtspace_created:f.records[0].createdAt}});f.emit('metadata-changed',f.source);};
  const report=await f.run();assert.equal(report.items[0].status,'not-written');assert.equal(report.items[1].status,'not-started');assert.deepEqual(f.counts(),{changes:0,saves:0});assert.equal(f.plugin.collectionPlacements.size,0);
 }finally{f.close();}
});
for(const mode of ['single','batch'] as const)test(`${mode} delivery rejects a source modify during an old read despite unchanged stat and stale metadata`,async()=>{
 const f=await fixture();
 try{
  const record=f.records[0],stat={...f.source.stat},cached=f.metadata.get(f.source),read=f.app.vault.read;let changed=false;
  f.app.vault.read=async(file:TFile)=>{
   if(file!==f.source||changed)return read(file);
   const old=f.disk.get(file.path)!;changed=true;
   // The read began against the old identity. Native/sync writes the same TFile
   // before that result is consumed, without a fresh metadata entry or stat.
   f.disk.set(file.path,old.replace(record.id,'capture-replaced888'));f.emit('vault-modify',file);return old;
  };
  if(mode==='single')await assert.rejects(f.host.deliver(record,f.target,()=>true),/变化|取消/);
  else{const report=await f.run();assert.equal(report.items[0].status,'not-written');assert.equal(report.items[1].status,'not-started');}
  assert.equal(changed,true);assert.deepEqual(f.source.stat,stat);assert.equal(f.metadata.get(f.source),cached);
  assert.equal(collectionModel.collectionNoteBody(f.disk.get(f.source.path)!,parseYaml,record),undefined,'actual source no longer has the selected identity');
  assert.deepEqual(f.counts(),{changes:0,saves:0});assert.equal(f.plugin.collectionPlacements.size,0);
 }finally{f.close();}
});

function anotherTarget(f:Awaited<ReturnType<typeof fixture>>,key:string,duplicate?:'allow'){
 f.plugin.collectionTargets.set(key,f.plugin.collectionTargets.get(f.target.key));return{...f.target,key,...(duplicate?{duplicate}:{})};
}
function restartDelivery(f:Awaited<ReturnType<typeof fixture>>){f.plugin.collectionPlacements.clear();f.plugin.collectionBoardReceiptStores=undefined;f.plugin.collectionDeliveryLocks=undefined;f.owner.board=readBoardDocument(f.disk.get(f.boardFile.path)!,f.boardFile.extension,parseYaml).board;}
test('single delivery persists stable target and receipt, default skip reports existing IDs and source bytes remain exact',async()=>{
 const f=await fixture();try{
  const before=f.disk.get(f.source.path),first=await f.host.deliver(f.records[0],f.target,()=>true);assert.equal(first.added,1);
  assert.ok(first.boardId);assert.equal(first.receipt?.status,'confirmed');assert.equal(first.receipt?.sourceId,f.records[0].id);
  const next=await f.host.deliver(f.records[0],anotherTarget(f,'second-target'),()=>true);assert.equal(next.added,0);assert.deepEqual(next.existingNodeIds,first.receipt!.nodeIds);
  assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,1);assert.equal(f.disk.get(f.source.path),before);
  const receipts=await f.plugin.collectionDeliveryReceipts(f.records[0]);assert.equal(receipts.receipts.length,2);assert.ok(receipts.receipts.every((receipt:any)=>receipt.status==='confirmed'));
 }finally{f.close();}
});
test('explicit allow creates exactly one additional card, same-key retry and restart never create a third',async()=>{
 const f=await fixture();try{
  await f.host.deliver(f.records[0],f.target,()=>true);const target=anotherTarget(f,'allow-target','allow');
  const added=await f.host.deliver(f.records[0],target,()=>true);assert.equal(added.added,1);assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,2);
  const count=f.counts();const again=await f.host.deliver(f.records[0],target,()=>true);assert.equal(again.added,0);assert.deepEqual(again.existingNodeIds,added.receipt!.nodeIds);assert.deepEqual(f.counts(),count);
  restartDelivery(f);const reopened=await f.host.deliver(f.records[0],target,()=>true);assert.equal(reopened.added,0);assert.deepEqual(f.counts(),count);assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,2);
 }finally{f.close();}
});
test('legacy board containing the source gets its missing stable ID only in the explicit skip transaction',async()=>{
 const f=await fixture();try{
  const existing=planCaptureReferences(f.owner.board,[f.source.path],undefined,300,()=> 'old-card');f.owner.board=existing.board;f.disk.set(f.boardFile.path,JSON.stringify(f.owner.board));assert.equal(f.owner.board.spaceId,undefined);
  const result=await f.host.deliver(f.records[0],f.target,()=>true);assert.equal(result.added,0);assert.deepEqual(result.existingNodeIds,['old-card']);assert.ok(result.boardId);assert.deepEqual(f.counts(),{changes:1,saves:1});assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,1);
 }finally{f.close();}
});
test('save failure reuses the staged card while a confirmed disk write with lost acknowledgment needs no second save',async()=>{
 for(const late of [false,true]){
  const f=await fixture();try{
   f.control.saveFailure=!late;f.control.saveThenThrow=late;await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true),/save failure/);
   assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,1);f.control.saveFailure=false;f.control.saveThenThrow=false;
   const result=await f.host.deliver(f.records[0],f.target,()=>true);assert.equal(result.added,late?0:1);assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,1);assert.deepEqual(f.counts(),{changes:1,saves:late?1:2});
  }finally{f.close();}
 }
});
test('restart with a prepared unconfirmed disk write blocks both the original and fresh duplicate intent',async()=>{
 const f=await fixture();try{
  f.control.saveFailure=true;await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true));restartDelivery(f);f.control.saveFailure=false;const count=f.counts();
  await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true),/停止重复创建/);
  await assert.rejects(f.host.deliver(f.records[0],anotherTarget(f,'new-allow','allow'),()=>true),/选项已变化/);
  assert.deepEqual(f.counts(),count);assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,0);
 }finally{f.close();}
});
test('restart with a prepared but disk-confirmed duplicate resolves its original node IDs',async()=>{
 const f=await fixture();try{
  const target={...f.target,duplicate:'allow' as const};f.control.saveThenThrow=true;await assert.rejects(f.host.deliver(f.records[0],target,()=>true));const ids=f.owner.board.nodes.filter(node=>node.file===f.source.path).map(node=>node.id);restartDelivery(f);f.control.saveThenThrow=false;const count=f.counts();
  const result=await f.host.deliver(f.records[0],target,()=>true);assert.equal(result.added,0);assert.deepEqual(result.existingNodeIds,ids);assert.equal(result.receipt?.status,'confirmed');assert.deepEqual(f.counts(),count);
 }finally{f.close();}
});
test('known duplicate board IDs fail before receipt preparation or card mutation',async()=>{
 const f=await fixture();try{
  f.owner.board.spaceId='duplicate-space';const other=new TFile('Boards/Copy.thoughtspace');f.files.set(other.path,other);f.plugin.collectionTargets.set('other',{target:{file:other,owner:{board:{...emptyBoard(),spaceId:'duplicate-space'}}}});
  await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true),/相同标识/);assert.deepEqual(f.counts(),{changes:0,saves:0});assert.deepEqual(await f.plugin.collectionDeliveryReceipts(f.records[0]),{receipts:[]});
 }finally{f.close();}
});
for(const change of ['replace','rename','node-removed','identity-changed'] as const)test(`confirmed delivery retry refuses ${change} without creating another card`,async()=>{
 const f=await fixture();try{
  await f.host.deliver(f.records[0],f.target,()=>true);const count=f.counts();
  if(change==='replace')f.files.set(f.boardFile.path,new TFile(f.boardFile.path));
  if(change==='rename'){f.files.delete(f.boardFile.path);f.boardFile.path='Boards/Renamed.thoughtspace';f.files.set(f.boardFile.path,f.boardFile);}
  if(change==='node-removed'){f.owner.board.nodes=f.owner.board.nodes.filter(node=>node.file!==f.source.path);f.disk.set(f.boardFile.path,JSON.stringify(f.owner.board));}
  if(change==='identity-changed'){f.owner.board.spaceId='different-space';f.disk.set(f.boardFile.path,JSON.stringify(f.owner.board));}
  await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true));assert.deepEqual(f.counts(),count);
 }finally{f.close();}
});
test('receipt preparation failure leaves the board untouched and confirmation failure retains a recoverable placement',async()=>{
 for(const after of [false,true]){
  const f=await fixture();try{
   if(after)f.control.beforeSave=()=>{f.app.vault.adapter.process=async()=>{throw Error('Receipt update denied');};};
   else f.app.vault.adapter.copy=async()=>{throw Error('Receipt creation denied');};
   await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true),/Receipt/);
   assert.deepEqual(f.counts(),after?{changes:1,saves:1}:{changes:0,saves:0});assert.equal(f.plugin.collectionPlacements.size,after?1:0);
   if(after){const process=(path:string,change:(raw:string)=>string)=>{const next=change(f.disk.get(path)!);f.disk.set(path,next);return Promise.resolve(next);};f.app.vault.adapter.process=process;f.control.beforeSave=undefined;restartDelivery(f);const result=await f.host.deliver(f.records[0],f.target,()=>true);assert.equal(result.added,0);assert.equal(result.receipt?.status,'confirmed');}
  }finally{f.close();}
 }
});
test('an older confirmed operation cannot discard a newer pending duplicate receipt',async()=>{
 const f=await fixture();try{
  await f.host.deliver(f.records[0],f.target,()=>true);const target=anotherTarget(f,'later-duplicate','allow');f.control.saveFailure=true;await assert.rejects(f.host.deliver(f.records[0],target,()=>true));
  const pending=f.plugin.collectionPlacements.get(`record:${f.records[0].id}`);await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true),/选项已变化/);assert.equal(f.plugin.collectionPlacements.get(`record:${f.records[0].id}`),pending);
  f.control.saveFailure=false;await f.host.deliver(f.records[0],target,()=>true);assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,2);
 }finally{f.close();}
});
test('same live pending source file may follow a native rename without allocating another card',async()=>{
 const f=await fixture();try{
  f.control.saveFailure=true;await assert.rejects(f.host.deliver(f.records[0],f.target,()=>true));const ids=f.owner.board.nodes.filter(node=>node.file===f.source.path).map(node=>node.id),old=f.source.path;
  f.source.path='Notes/Renamed.md';f.files.delete(old);f.files.set(f.source.path,f.source);f.disk.set(f.source.path,f.disk.get(old)!);f.disk.delete(old);f.emit('vault-rename',f.source,old);f.control.saveFailure=false;
  const result=await f.host.deliver(f.records[0],f.target,()=>true);assert.equal(result.added,1);assert.deepEqual(result.receipt!.nodeIds,ids);assert.equal(result.receipt!.sourcePath,f.source.path);assert.equal(f.owner.board.nodes.filter(node=>node.file===f.source.path).length,1);assert.equal(f.counts().changes,1);
 }finally{f.close();}
});
test('batch delivery creates independently confirmed receipts for every source under the shared target key',async()=>{
 const f=await fixture();try{const report=await f.run();assert.deepEqual(report.items.map(item=>item.status),['confirmed','confirmed']);assert.equal(f.owner.board.nodes.filter(node=>node.kind==='card').length,2);const receipts=await Promise.all(f.records.map(record=>f.plugin.collectionDeliveryReceipts(record)));assert.ok(receipts.every(history=>history.receipts[0].status==='confirmed'));assert.notDeepEqual(receipts[0].receipts[0].nodeIds,receipts[1].receipts[0].nodeIds);}finally{f.close();}
});
