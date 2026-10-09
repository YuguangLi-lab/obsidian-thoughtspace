import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import * as references from '../src/board-reference-rename';
import * as pending from '../src/pending-board-references';
import {cleanPluginSettings,type ThoughtSpacePreferences} from '../src/plugin-settings';
import {isWorkspaceFile} from '../src/workspace';
import {isBoardPath} from '../src/board-path';
import {remapFavorites} from '../src/navigation';
import {remapHubPaths} from '../src/space-hub';
import {remapLocalRelationsPreferences} from '../src/local-relations-state';
import {reflowReadingContent} from '../src/expansion-reading-state';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const parseYaml=(yaml:string)=>/^thoughtspace: board$/m.test(yaml)?{thoughtspace:'board'}:{};
class File {
 extension='md';parent={path:'Boards'};stat={mtime:1,size:1};
 constructor(public path:string){}
 get basename(){return this.path.slice(this.path.lastIndexOf('/')+1).replace(/\.md$/i,'');}
}
const source=readFileSync('src/main.ts','utf8');
const sessionStart=source.indexOf('class Session {'),sessionEnd=source.indexOf('\nexport default class ThoughtSpace',sessionStart);
const journalStart=source.indexOf('  private editReferenceJournal('),flowStart=journalStart<0?source.indexOf('  private nativeReferenceRuns='):journalStart,flowEnd=source.indexOf('\n  async databaseDemo()',flowStart);
assert(sessionStart>=0&&sessionEnd>sessionStart&&flowStart>=0&&flowEnd>flowStart,'extract the production Session and pending-reference methods');
const reports:unknown[]=[],notices:string[]=[];let nextId=0;
interface App {native:Set<File>;vault:{getAbstractFileByPath:(path:string)=>File|undefined;getFiles:()=>File[];read:(file:File)=>Promise<string>;process:(file:File,change:(raw:string)=>string)=>Promise<void>};}
const deps={...model,...mindmap,...documents,...references,...pending,reflowReadingContent,parseYaml,TFile:File,EXT:'thoughtspace',uid:()=>`operation-${++nextId}`,
 Notice:class{constructor(text:string){notices.push(text);}},report:(error:unknown)=>reports.push(error),
 hasNativeBoardEditor:(app:App,file:File)=>app.native.has(file),assertBoardEditorOwnership:(app:App,file:File)=>{if(app.native.has(file))throw Error('Native Markdown owns this document');},
 isWorkspaceFile,isBoardPath,isBoardFile:(app:App,file:File)=>isWorkspaceFile(file)&&isBoardPath(file.path)&&/^thoughtspace: board$/m.test(appFiles.get(app)?.get(file)||''),
 remapFavorites,remapHubPaths,remapLocalRelationsPreferences};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(sessionStart,sessionEnd)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const ReferenceFlow=new Function(...Object.keys(deps),transformSync('class ReferenceFlow {\n'+source.slice(flowStart,flowEnd)+'\n};return ReferenceFlow',{loader:'ts'}).code)(...Object.values(deps));
const renameStart=source.indexOf("this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {"),renameBodyStart=source.indexOf('(file, oldPath) => {',renameStart),renameEnd=source.indexOf('\n    }));',renameBodyStart);
assert(renameStart>=0&&renameEnd>renameBodyStart,'extract the real vault rename event callback');
const actStart=source.indexOf('const act ='),actEnd=source.indexOf('\nfunction button(',actStart);
const act=new Function('report',transformSync(source.slice(actStart,actEnd)+';return act',{loader:'ts'}).code)(deps.report) as (run:()=>unknown)=>void;
const renameEvent=new Function(...Object.keys(deps),'act',transformSync('return '+source.slice(renameBodyStart,renameEnd).replace('(file, oldPath) => {','function(file, oldPath) {')+'\n}',{loader:'ts'}).code)(...Object.values(deps),act) as (this:Flow,file:File,oldPath:string)=>void;
const appFiles=new WeakMap<App,Map<File,string>>();
interface SessionState {board:model.Board;baseline:string;blocked:boolean;nativeEditingPaused:boolean;status:string;history:model.History;listeners:Set<(kind:string)=>void>;refreshNativeEditing:()=>void;externalUpdate:()=>Promise<void>;flush:()=>Promise<void>;change:(mutate:(board:model.Board)=>void)=>void;}
interface Flow {settings:ThoughtSpacePreferences;app:App;sessions:Map<File,Promise<SessionState>>;nativeBoardTransitions:Set<File>;referenceQueue:Promise<void>;referenceJournalQueue:Promise<void>;referenceJournalDirty:boolean;saveData:(settings:ThoughtSpacePreferences)=>Promise<void>;savePreferences:()=>Promise<void>;createUnique:(folder:string,title:string,extension:string,raw:string)=>Promise<{path:string}>;
 deferBoardReference:(file:File,oldPath:string,snapshot:references.BoardReferenceRenameSnapshot<File>,boardPath:string)=>Promise<void>;
 flushPendingBoardReferences:(file:File)=>Promise<void>;retryPendingBoardReferences:()=>Promise<void>;renameReferences:(file:File,oldPath:string,snapshot?:references.BoardReferenceRenameSnapshot<File>)=>Promise<void>;}
function board(){
 const value=model.emptyBoard();value.version=3;
 value.nodes.push({id:'source',kind:'card',file:'Notes/A.md',title:'Original source',x:0,y:0,width:200,height:100,color:'blue'},
  {id:'local',kind:'text',text:'Unchanged local content',x:300,y:0,width:200,height:100,color:'green'});
 value.edges.push({id:'parent',from:'source',to:'local',kind:'branch',label:'Parent'},
  {id:'relation',from:'source',to:'local',direction:'both',label:'Association'});
 return value;
}
function fixture(saved?:ThoughtSpacePreferences,shared?:{files:Map<string,File>;raw:Map<File,string>;boardFile:File;sourceFile:File}){
 const boardFile=shared?.boardFile||new File('Boards/Study.md'),sourceFile=shared?.sourceFile||new File('Notes/A.md');
 const files=shared?.files||new Map([[boardFile.path,boardFile],[sourceFile.path,sourceFile]]),raw=shared?.raw||new Map([[boardFile,documents.createMarkdownBoardDocument(board(),'Study')],[sourceFile,'Synthetic source note']]);
 let durable=clone(saved||cleanPluginSettings({})),failSaves=0,saveAttempts=0,beforeProcess:((file:File)=>Promise<void>)|undefined,processCalls=0,changes=0;
 const app:App={native:new Set([boardFile]),vault:{getAbstractFileByPath:path=>files.get(path),getFiles:()=>[...files.values()],read:async file=>{const result=raw.get(file);if(result===undefined)throw Error('Deleted file');return result;},process:async(file,change)=>{
  processCalls++;await beforeProcess?.(file);const current=raw.get(file);if(current===undefined)throw Error('Deleted file');const next=change(current);if(next!==current)changes++;raw.set(file,next);
 }}};appFiles.set(app,raw);
 const flow:Flow=Object.assign(new ReferenceFlow(),{settings:cleanPluginSettings(saved||{}),app,sessions:new Map(),nativeBoardTransitions:new Set(),referenceQueue:Promise.resolve(),referenceJournalQueue:Promise.resolve(),referenceJournalDirty:false,
  saveData:async(settings:ThoughtSpacePreferences)=>{saveAttempts++;if(failSaves){failSaves--;throw Error('Synthetic settings write failed');}durable=clone(settings);},
  savePreferences:async()=>flow.saveData(flow.settings),createUnique:async()=>({path:'Recovery.md'})});
 const disk=()=>raw.get(boardFile)!;
 const decoded=()=>documents.readBoardDocument(disk(),'md',parseYaml).board;
 const rename=async(path:string)=>{const old=sourceFile.path;files.delete(old);sourceFile.path=path;files.set(path,sourceFile);await flow.renameReferences(sourceFile,old,references.captureBoardReferenceRename(path,[...files.values()]));};
 const load=()=>{const session:SessionState=new Session(flow,boardFile,disk());flow.sessions.set(boardFile,Promise.resolve(session));return session;};
 const nativeEdit=()=>{const current=decoded();current.nodes.push({id:'native',kind:'text',text:'Source editor added this node',x:600,y:0,width:200,height:100,color:'rose'});current.viewport.y=321;
  const next=documents.replaceBoardDocumentLayout(disk(),documents.readBoardDocument(disk(),'md',parseYaml),current,parseYaml).source.replace('thoughtspace: board','thoughtspace: board\nstatus: reviewed # native comment')+'\nNative prose and [[Other.md#Anchor]].\n';raw.set(boardFile,next);return next;};
 return{flow,app,files,raw,boardFile,sourceFile,disk,decoded,rename,load,nativeEdit,durable:()=>clone(durable),saveAttempts:()=>saveAttempts,failSettings:(count=1)=>{failSaves=count;},
  beforeProcess:(fn?:typeof beforeProcess)=>{beforeProcess=fn;},counts:()=>({processCalls,changes}),shared:{files,raw,boardFile,sourceFile}};
}
function assertGraph(value:model.Board){assert.deepEqual(value.nodes.map(node=>node.id),['source','local']);assert.deepEqual(value.edges.map(edge=>edge.id),['parent','relation']);assert.equal(value.edges[1].direction,'both');}

test('an open native page delays a source rename in durable settings without writing the Markdown layout',async()=>{
 const f=fixture(),original=f.disk();await f.rename('Notes/B.md');
 assert.equal(f.disk(),original);assert.deepEqual(f.counts(),{processCalls:0,changes:0});assertGraph(f.decoded());
 const journal=f.durable().pendingBoardReferences!;assert.equal(journal.length,1);assert.equal(journal[0].oldPath,'Notes/A.md');assert.equal(journal[0].newPath,'Notes/B.md');assert.equal(journal[0].board,'Boards/Study.md');
 assert.equal(Object.hasOwn(journal[0],'raw'),false);assert.equal(Object.hasOwn(journal[0],'boardContent'),false);
});

test('closing native ownership retries against the latest YAML, body and layout and refreshes an already loaded Session',async()=>{
 const f=fixture(),session=f.load();await f.rename('Notes/B.md');const latest=f.nativeEdit();f.app.native.clear();await f.flow.retryPendingBoardReferences();
 const next=f.decoded();assert.equal(next.nodes[0].file,'Notes/B.md');assert.deepEqual(next.nodes.map(node=>node.id),['source','local','native']);assert.deepEqual(next.edges,board().edges);assert.equal(next.viewport.y,321);
 assert(f.disk().includes('status: reviewed # native comment'));assert(f.disk().endsWith('Native prose and [[Other.md#Anchor]].\n'));assert.notEqual(f.disk(),latest);
 assert.deepEqual(f.flow.settings.pendingBoardReferences,[]);assert.deepEqual(f.durable().pendingBoardReferences,[]);
 assert.equal(session.blocked,false,'successful replay must release the native Session lock only after fresh read');assert.equal(session.baseline,f.disk());assert.equal(session.board.nodes[0].file,'Notes/B.md');assert.equal(session.board.nodes[2].id,'native');
});

test('plugin reconstruction cleans and replays the persisted journal without cached note or layout content',async()=>{
 const before=fixture();await before.rename('Notes/B.md');before.nativeEdit();
 const rebuilt=fixture(JSON.parse(JSON.stringify(before.durable())),before.shared);rebuilt.app.native.clear();await rebuilt.flow.retryPendingBoardReferences();
 assert.equal(rebuilt.decoded().nodes[0].file,'Notes/B.md');assert.deepEqual(rebuilt.decoded().nodes.map(node=>node.id),['source','local','native']);assert.deepEqual(rebuilt.decoded().edges,board().edges);
 assert(rebuilt.disk().includes('status: reviewed # native comment'));assert(rebuilt.disk().endsWith('Native prose and [[Other.md#Anchor]].\n'));assert.deepEqual(rebuilt.durable().pendingBoardReferences,[]);
});

test('consecutive A to B to C source renames remain chronological and preserve every graph identity',async()=>{
 const f=fixture();await f.rename('Notes/B.md');await f.rename('Notes/C.md');
 assert.deepEqual(f.durable().pendingBoardReferences!.map(operation=>[operation.oldPath,operation.newPath]),[['Notes/A.md','Notes/B.md'],['Notes/B.md','Notes/C.md']]);
 f.app.native.clear();await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/C.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('a later rename arriving while replay is in progress is drained before the loaded Session becomes editable',async()=>{
 const f=fixture(),session=f.load();await f.rename('Notes/B.md');f.app.native.clear();
 let enter!:()=>void,release!:()=>void,first=true;const entered=new Promise<void>(resolve=>enter=resolve),waiting=new Promise<void>(resolve=>release=resolve);
 f.beforeProcess(async()=>{if(first){first=false;enter();await waiting;}});
 const replay=f.flow.retryPendingBoardReferences();await entered;await f.rename('Notes/C.md');release();await replay;
 assert.equal(f.decoded().nodes[0].file,'Notes/C.md','a rename accepted during the replay must not remain stale until an unrelated workspace event');assertGraph(f.decoded());
 assert.deepEqual(f.flow.settings.pendingBoardReferences,[]);assert.deepEqual(f.durable().pendingBoardReferences,[]);assert.equal(session.blocked,false);assert.equal(session.board.nodes[0].file,'Notes/C.md');
});

test('the real rename event moves a pending board address while retaining its event-time reference namespace',async()=>{
 const f=fixture();await f.rename('Notes/B.md');const old=f.boardFile.path;f.files.delete(old);f.boardFile.path='Moved/Study.md';f.boardFile.parent.path='Moved';f.files.set(f.boardFile.path,f.boardFile);
 renameEvent.call(f.flow,f.boardFile,old);await f.flow.referenceQueue;
 const operations=f.flow.settings.pendingBoardReferences!;assert(operations.every(operation=>operation.board==='Moved/Study.md'));assert.equal(operations[0].boardPath,'Boards/Study.md');
 f.app.native.clear();await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('a malformed source layout keeps the journal and leaves the latest Markdown bytes untouched',async()=>{
 const f=fixture();await f.rename('Notes/B.md');const valid=f.disk();f.raw.set(f.boardFile,valid.replace('"format": "thoughtspace-board"','"format": "unknown-format"'));const malformed=f.disk();f.app.native.clear();
 await assert.rejects(f.flow.flushPendingBoardReferences(f.boardFile));assert.equal(f.disk(),malformed);assert.equal(f.flow.settings.pendingBoardReferences!.length,1);assert.equal(f.durable().pendingBoardReferences!.length,1);
 f.raw.set(f.boardFile,valid);await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('one malformed board does not starve the pending references of a later healthy board',async()=>{
 const f=fixture(),healthy=new File('Boards/Healthy.md');f.files.set(healthy.path,healthy);f.raw.set(healthy,documents.createMarkdownBoardDocument(board(),'Healthy'));f.app.native.add(healthy);
 await f.rename('Notes/B.md');assert.equal(f.durable().pendingBoardReferences!.length,2);
 f.raw.set(f.boardFile,f.disk().replace('"format": "thoughtspace-board"','"format": "unknown-format"'));const invalid=f.disk();f.app.native.clear();
 await f.flow.retryPendingBoardReferences().catch(()=>{});
 assert.equal(f.disk(),invalid);assert.equal(documents.readBoardDocument(f.raw.get(healthy)!,'md',parseYaml).board.nodes[0].file,'Notes/B.md','an earlier malformed board must not stop healthy boards from replaying');
 assert.deepEqual(f.flow.settings.pendingBoardReferences!.map(operation=>operation.board),['Boards/Study.md']);assert.deepEqual(f.durable().pendingBoardReferences!.map(operation=>operation.board),['Boards/Study.md']);
});

test('a failed journal completion save retains a retryable in-memory record after an idempotent layout update',async()=>{
 const f=fixture();await f.rename('Notes/B.md');f.app.native.clear();f.failSettings();await assert.rejects(f.flow.flushPendingBoardReferences(f.boardFile),/settings write failed/);
 assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertGraph(f.decoded());assert.equal(f.durable().pendingBoardReferences!.length,1);
 assert.equal(f.flow.settings.pendingBoardReferences!.length,1,'unsaved completion must not discard the in-memory replay record');
 await f.flow.retryPendingBoardReferences();assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);assert.deepEqual(f.flow.settings.pendingBoardReferences,[]);
});

test('a failed completion transaction cannot overwrite a later queued source rename',async()=>{
 const f=fixture();await f.rename('Notes/B.md');f.app.native.clear();
 const save=f.flow.saveData;let enter!:()=>void,release!:()=>void,first=true;const entered=new Promise<void>(resolve=>enter=resolve),waiting=new Promise<void>(resolve=>release=resolve);
 f.flow.saveData=async settings=>{if(first){first=false;enter();await waiting;throw Error('Synthetic completion save failed');}await save(settings);};
 const replay=f.flow.flushPendingBoardReferences(f.boardFile);await entered;const later=f.rename('Notes/C.md');await tick();release();await assert.rejects(replay,/completion save failed/);await later;
 assert.deepEqual(f.flow.settings.pendingBoardReferences!.map(operation=>[operation.oldPath,operation.newPath]),[['Notes/A.md','Notes/B.md'],['Notes/B.md','Notes/C.md']]);
 assert.deepEqual(f.durable().pendingBoardReferences,f.flow.settings.pendingBoardReferences);await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/C.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('a board move during a failed completion transaction retargets the restored journal before retry',async()=>{
 const f=fixture();await f.rename('Notes/B.md');f.app.native.clear();
 const save=f.flow.saveData;let enter!:()=>void,release!:()=>void,first=true;const entered=new Promise<void>(resolve=>enter=resolve),waiting=new Promise<void>(resolve=>release=resolve);
 f.flow.saveData=async settings=>{if(first){first=false;enter();await waiting;throw Error('Synthetic completion save failed');}await save(settings);};
 const replay=f.flow.flushPendingBoardReferences(f.boardFile);await entered;
 const old=f.boardFile.path;f.files.delete(old);f.boardFile.path='Moved/Study.md';f.boardFile.parent.path='Moved';f.files.set(f.boardFile.path,f.boardFile);renameEvent.call(f.flow,f.boardFile,old);
 await tick();release();await assert.rejects(replay,/completion save failed/);await f.flow.referenceQueue;
 const original=f.flow.settings.pendingBoardReferences!.find(operation=>operation.oldPath==='Notes/A.md');assert(original);assert.equal(original.board,'Moved/Study.md','a rolled-back operation must follow the moved board identity');assert.equal(original.boardPath,'Boards/Study.md','reference resolution retains its historical namespace');
 assert.deepEqual(f.durable().pendingBoardReferences,f.flow.settings.pendingBoardReferences);await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('a failed board-address journal save retains the actual new address so the pending operation can be retried',async()=>{
 const f=fixture();await f.rename('Notes/B.md');const old=f.boardFile.path,newPath='Moved/Study.md',save=f.flow.saveData;let failed=false;
 f.flow.saveData=async settings=>{if(!failed&&settings.pendingBoardReferences?.some(operation=>operation.board===newPath)){failed=true;throw Error('Synthetic board-address save failed');}await save(settings);};
 f.files.delete(old);f.boardFile.path=newPath;f.boardFile.parent.path='Moved';f.files.set(newPath,f.boardFile);renameEvent.call(f.flow,f.boardFile,old);await f.flow.referenceQueue.catch(()=>{});
 assert.equal(failed,true);const original=f.flow.settings.pendingBoardReferences!.find(operation=>operation.oldPath==='Notes/A.md');assert(original);assert.equal(original.board,newPath,'a failed durable address update must not restore the physically retired path');
 f.app.native.clear();await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('a failed rename-event journal save does not discard a later source rename before its deferred operation is recorded',async()=>{
 const f=fixture();await f.rename('Notes/B.md');const originalJournal=f.flow.settings.pendingBoardReferences,save=f.flow.saveData;let failed=false;
 f.flow.saveData=async settings=>{if(!failed&&settings.pendingBoardReferences!==originalJournal){failed=true;throw Error('Synthetic rename-event journal save failed');}await save(settings);};
 const old=f.sourceFile.path;f.files.delete(old);f.sourceFile.path='Notes/C.md';f.files.set(f.sourceFile.path,f.sourceFile);renameEvent.call(f.flow,f.sourceFile,old);await f.flow.referenceQueue.catch(()=>{});assert.equal(failed,true);
 assert(f.flow.settings.pendingBoardReferences?.some(operation=>operation.oldPath==='Notes/B.md'&&operation.newPath==='Notes/C.md'),'the source event must survive journal persistence failure');
 f.app.native.clear();await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/C.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('a failed initial journal save reports failure and retains the operation for a later durable retry',async()=>{
 const f=fixture(),original=f.disk(),beforeReports=reports.length;f.failSettings();await f.rename('Notes/B.md');
 assert.equal(f.disk(),original);assert.equal(f.flow.settings.pendingBoardReferences?.length||0,1,'an initial journal write failure must retain the accepted rename for retry');assert.equal(f.durable().pendingBoardReferences?.length||0,0);assert.equal(reports.length,beforeReports+1);
 f.app.native.clear();await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertGraph(f.decoded());assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('an identical deferred rename retries a previously failed journal save before claiming the record is durable',async()=>{
 const f=fixture(),original=f.disk(),beforeNotices=notices.length;f.failSettings();await f.rename('Notes/B.md');
 assert.equal(f.saveAttempts(),1);assert.equal(f.durable().pendingBoardReferences?.length||0,0);assert.equal(f.flow.settings.pendingBoardReferences!.length,1);assert.equal(notices.length,beforeNotices,'the failed first attempt cannot claim a persisted waiting record');
 await f.flow.deferBoardReference(f.boardFile,'Notes/A.md',references.captureBoardReferenceRename('Notes/B.md',[...f.files.values()]),'Boards/Study.md');
 assert.equal(f.saveAttempts(),2,'a same-value edit must retry persistence when the retained journal is not durable');assert.equal(f.durable().pendingBoardReferences!.length,1);assert.deepEqual(f.durable().pendingBoardReferences,f.flow.settings.pendingBoardReferences);
 assert.equal(notices.length,beforeNotices+1);assert.equal(f.disk(),original);assert.deepEqual(f.counts(),{processCalls:0,changes:0});
});

test('native ownership reappearing inside the atomic callback retains the journal and prevents any layout write',async()=>{
 const f=fixture();await f.rename('Notes/B.md');const original=f.disk();f.app.native.clear();f.beforeProcess(async()=>{f.app.native.add(f.boardFile);});
 await assert.rejects(f.flow.flushPendingBoardReferences(f.boardFile),/owns this document/);assert.equal(f.disk(),original);assert.equal(f.flow.settings.pendingBoardReferences!.length,1);assert.equal(f.durable().pendingBoardReferences!.length,1);assert.equal(f.flow.nativeBoardTransitions.size,0);
 f.beforeProcess();f.app.native.clear();await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertGraph(f.decoded());
});

test('a replacement board identity during replay cannot receive the retired board layout',async()=>{
 const f=fixture();await f.rename('Notes/B.md');const original=f.disk();f.app.native.clear();f.beforeProcess(async()=>{f.files.set(f.boardFile.path,new File(f.boardFile.path));});
 await assert.rejects(f.flow.flushPendingBoardReferences(f.boardFile),/变化|替换/);assert.equal(f.disk(),original);assert.equal(f.flow.settings.pendingBoardReferences!.length,1);assert.equal(f.durable().pendingBoardReferences!.length,1);assert.equal(f.flow.nativeBoardTransitions.size,0);
});
