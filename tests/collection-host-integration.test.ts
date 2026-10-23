/// <reference types="obsidian" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as recovery from '../src/collection-recovery';
import * as journalStore from '../src/collection-journal-store';
import * as model from '../src/collection-model';
import * as collectionSearch from '../src/collection-search';
import * as collectionJsonStore from '../src/collection-json-store';
import * as collectionSavedFilters from '../src/collection-saved-filters';
import * as collectionBatch from '../src/collection-batch';
import * as collectionTasks from '../src/collection-tasks';
import * as markdownContext from '../src/markdown-context';
import * as markdownLiterals from '../src/markdown-literals';
import * as excerptSources from '../src/excerpt-sources';
import {paragraphLink} from '../src/paragraph-card';
import * as tags from '../src/native-tags';
import * as workspaceFiles from '../src/workspace';
import type {CollectionViewHost,CollectionTarget,CollectionRecord} from '../src/collection-view';

// Execute the shipped host + discovery modules, not a copy of their algorithms.
// Only Obsidian's storage/identity, metadata and workspace event boundaries are
// replaced. Native DOM/keyboard handling remains the isolated app QA's job.
const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:(source:string)=>unknown}).load;
class Component {registerEvent(_ref:unknown){} }
class TFile {
 stat={ctime:1,mtime:1,size:1};
 constructor(public path:string){}
 get name(){return this.path.split('/').at(-1)!;}
 get extension(){return this.name.split('.').at(-1)!;}
 get basename(){return this.name.replace(/\.[^.]+$/,'');}
}
class TFolder {}
class MarkdownView {}
class FuzzySuggestModal {
 containerEl:{ownerDocument:unknown};
 constructor(app:any){this.containerEl={ownerDocument:app.workspace.getMostRecentLeaf().view.containerEl.ownerDocument};app.collectionPickers.push(this);}
 setPlaceholder(_text:string){}
 onOpen(){}
 onClose(){}
 open(){this.onOpen();}
 close(){this.onClose();}
}
type AttachmentPicker=FuzzySuggestModal&{getItems:()=>TFile[];onChooseItem:(file:TFile)=>void};
const obsidian={Component,TFile,TFolder,MarkdownView,FuzzySuggestModal,normalizePath:(path:string)=>path.replace(/\\/g,'/').replace(/\/+/g,'/').replace(/\/$/,''),parseYaml,parseLinktext:(link:string)=>{const index=link.indexOf('#');return index<0?{path:link,subpath:''}:{path:link.slice(0,index),subpath:link.slice(index)};},getAllTags:(cache:any)=>Array.isArray(cache.frontmatter?.tags)?cache.frontmatter.tags.map((tag:string)=>`#${tag}`):[]};
function load<T>(path:string,dependencies:Record<string,unknown>):T {
 const module={exports:{}};
 const code=transformSync(readFileSync(path,'utf8'),{loader:'ts',format:'cjs'}).code;
 new Function('require','module','exports',code)((name:string)=>{if(!Object.hasOwn(dependencies,name))throw Error(`Unmocked dependency: ${name}`);return dependencies[name];},module,module.exports);
 return module.exports as T;
}
const libraryModule=load<typeof import('../src/collection-library')>('src/collection-library.ts',{'obsidian':obsidian,'./collection-model':model,'./collection-search':collectionSearch,'./collection-tasks':collectionTasks,'./workspace':workspaceFiles});
const contextModule=load<typeof import('../src/collection-context')>('src/collection-context.ts',{'obsidian':obsidian,'./collection-model':model,'./workspace':workspaceFiles});
const nativeNoteModule=load<typeof import('../src/native-note-state')>('src/native-note-state.ts',{'obsidian':obsidian});
const noteExportModule=load<typeof import('../src/collection-note-export')>('src/collection-note-export.ts',{'obsidian':obsidian,'./collection-model':model,'./collection-json-store':collectionJsonStore,'./native-note-state':nativeNoteModule,'./markdown-context':markdownContext,'./markdown-literals':markdownLiterals,'./excerpt-sources':excerptSources,'./paragraph-card':{paragraphLink}});
// The injected flag operation observes host arguments and cancellation only.
// Real YAML writes and verification are covered by collection-organize tests.
const hostModule=load<typeof import('../src/collection-host')>('src/collection-host.ts',{'obsidian':obsidian,'./collection-recovery':recovery,'./collection-model':model,'./collection-context':contextModule,'./collection-note-export':noteExportModule,'./collection-library':libraryModule,'./collection-search':collectionSearch,'./collection-json-store':collectionJsonStore,'./collection-saved-filters':collectionSavedFilters,'./collection-batch':collectionBatch,'./collection-organize':{setCollectionFlag:async(app:any,...args:unknown[])=>{if(typeof app.collectionFlagOperation!=='function')throw Error('flag mutation not mocked in legacy fixture');return app.collectionFlagOperation(app,...args);}},'./collection-journal-store':journalStore,'./native-tags':tags,'./workspace':workspaceFiles,'./board-modal-viewport':{bindBoardModalViewport:()=>()=>{}}});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
async function until(check:()=>boolean){for(let i=0;i<1000&&!check();i++)await Promise.resolve();assert.ok(check(),'asynchronous checkpoint reached');}
async function settleWrites(){for(let i=0;i<400;i++)await Promise.resolve();}
const target:CollectionTarget={key:'target-identity',title:'研究白板',path:'Boards/研究白板.md',groups:[{id:'group',title:'阅读'}],groupId:'group'};
const original='---\nunknown: native # keep this comment\ntags: [existing]\n---\n旧笔记正文\r\n';
const body='首行无需另填标题\r\n\n---\n自写正文 YAML: keep\n---\n\n**Markdown** 与 [[已有链接]]\r\n';
type Journal={version:number;draft:recovery.CollectionDraft;attempt?:recovery.CollectionAttempt};
function fixture(){
 const directory='.obsidian/plugins/thoughtspace',disk=new Map<string,string>(),files=new Map<string,TFile>(),metadata=new Map<TFile,unknown>(),folders=new Set<string>(['.obsidian','.obsidian/plugins',directory,'Notes','Images']);
 const boardDocs=new Map<TFile,any>();let boardReadGate:Promise<void>|undefined;
 const events=new Map<string,Set<(...args:any[])=>void>>(),adapterWrites:string[]=[],createdPaths:string[]=[],delivered:{session:string;file:TFile;target:CollectionTarget}[]=[],opened:TFile[]=[],links:{file:TFile;source:string}[]=[],pickers:AttachmentPicker[]=[];
 let uid=0,active:any,ensureCalls=0,creates=0,mutations=0,legacy=0,sourceReads=0;
 const control:{journalFailure?:(journal:Journal)=>boolean;partialWrite?:(path:string,source:string)=>boolean;processFailure?:'before'|'after'|'partial';processPhase?:recovery.CollectionPhase;processExternal?:string;processAfterReadFailure?:boolean;renameFailure?:'before'|'after';noOverwriteRename?:boolean;existsFailure?:(path:string)=>boolean;ensureFailure?:boolean;ensureGate?:ReturnType<typeof deferred>;createGate?:ReturnType<typeof deferred>;readGate?:ReturnType<typeof deferred>;afterRead?:()=>void;afterCreate?:(file:TFile)=>void;createFailure?:'before'|'after';lagFileCache?:boolean;lockDelivery?:boolean;deliveryFailure?:boolean;readJournalFailure?:boolean}={};
 const emit=(name:string,...args:any[])=>{for(const listener of events.get(name)||[])listener(...args);};
 const on=(name:string,callback:(...args:any[])=>void)=>{const listeners=events.get(name)||new Set();listeners.add(callback);events.set(name,listeners);return{name,callback};};
 const setFile=(path:string,source:string,cached=true)=>{const file=new TFile(path);file.stat.size=Buffer.byteLength(source);disk.set(path,source);if(cached)files.set(path,file);return file;};
 const native=setFile('Notes/旧笔记.md',original);
 const index=(file:TFile)=>{const header=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(disk.get(file.path)||'');metadata.set(file,{frontmatter:header?parseYaml(header[1]):undefined});emit('metadata-changed',file);};
 const app:any={
  collectionPickers:pickers,
  vault:{
   configDir:'.obsidian',getFiles:()=>[...files.values()],getMarkdownFiles:()=>[...files.values()].filter(file=>file.extension==='md'),getAbstractFileByPath:(path:string)=>files.get(path),on:(name:string,callback:any)=>on(`vault-${name}`,callback),offref:(ref:any)=>events.get(ref.name)?.delete(ref.callback),
   adapter:{
    exists:async(path:string)=>{if(control.existsFailure?.(path))throw Error('exists unavailable');return disk.has(path)||folders.has(path);},
    mkdir:async(path:string)=>{folders.add(path);},
    list:async(path:string)=>({files:[...disk.keys()].filter(key=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')),folders:[]}),
    read:async(path:string)=>{if(control.readJournalFailure&&path.endsWith('.json'))throw Error('journal read unavailable');if(!disk.has(path))throw Error('missing disk file');return disk.get(path)!;},
    write:async(path:string,source:string)=>{adapterWrites.push(path);if(control.partialWrite?.(path,source)){disk.set(path,source.slice(0,35));throw Error('partial temporary write');}if(control.journalFailure?.(JSON.parse(source) as Journal))throw Error('journal storage failed');disk.set(path,source);},
    process:async(path:string,change:(source:string)=>string)=>{if(control.processExternal!==undefined)disk.set(path,control.processExternal);if(!disk.has(path))throw Error('process target missing');const next=change(disk.get(path)!);const fail=!control.processPhase||(JSON.parse(next) as Journal).attempt?.phase===control.processPhase;if(fail&&control.processFailure==='before')throw Error('process write rejected');if(fail&&control.processFailure==='partial'){disk.set(path,next.slice(0,35));throw Error('adapter left partial canonical');}disk.set(path,next);if(control.processAfterReadFailure)control.readJournalFailure=true;if(fail&&control.processFailure==='after')throw Error('process response lost');return next;},
    copy:async(from:string,to:string)=>{if(!disk.has(from))throw Error('copy source missing');if(disk.has(to))throw Error('copy destination already exists');disk.set(to,disk.get(from)!);},
    rename:async(from:string,to:string)=>{if(control.renameFailure==='before')throw Error('rename rejected');if(!disk.has(from))throw Error('rename source missing');if(control.noOverwriteRename&&disk.has(to))throw Error('rename cannot replace existing target');disk.set(to,disk.get(from)!);disk.delete(from);if(control.renameFailure==='after')throw Error('rename response lost');},
    remove:async(path:string)=>{disk.delete(path);},
   },
   read:async(file:TFile)=>{sourceReads++;await control.readGate?.promise;control.afterRead?.();if(!disk.has(file.path))throw Error('native note missing');return disk.get(file.path)!;},
   create:async(path:string,source:string)=>{creates++;createdPaths.push(path);await control.createGate?.promise;if(control.createFailure==='before')throw Error('native create rejected');if(disk.has(path))throw Error('native create collision');const file=setFile(path,source,!control.lagFileCache);emit('vault-create',file);control.afterCreate?.(file);if(control.createFailure==='after'||control.lagFileCache)throw Error('native create response lost');return file;},
   modify:async()=>{mutations++;throw Error('Unexpected native modify');},process:async()=>{mutations++;throw Error('Unexpected native process');},rename:async()=>{mutations++;throw Error('Unexpected native rename');},
  },
  metadataCache:{getFileCache:(file:TFile)=>metadata.get(file),on:(name:string,callback:any)=>on(`metadata-${name}`,callback),offref:(ref:any)=>events.get(ref.name)?.delete(ref.callback)},
  fileManager:{generateMarkdownLink:(file:TFile,source:string)=>{links.push({file,source});return`[[${file.path}]]`;},processFrontMatter:async()=>{mutations++;throw Error('Unexpected property rewrite');}},
  workspace:{get activeLeaf(){return active;},getMostRecentLeaf:()=>active,on,offref:(ref:any)=>events.get(ref.name)?.delete(ref.callback)},
 };
 const bridge:any={
  directory,folder:()=> 'Notes',newId:()=>String(++uid).padStart(8,'0'),
  ensureFolder:async(path:string)=>{ensureCalls++;await control.ensureGate?.promise;if(control.ensureFailure)throw Error('folder creation failed');folders.add(path);},
  pickTarget:(_doc:unknown,current:()=>boolean)=>({result:Promise.resolve(current()?target:undefined),close(){}}),
  deliver:async(session:string,file:TFile,destination:CollectionTarget,current:()=>boolean,beforeStage?:()=>void)=>{assert.ok(current());beforeStage?.();delivered.push({session,file,target:destination});if(control.deliveryFailure){control.lockDelivery=true;throw Error('board failed');}control.lockDelivery=false;return{added:1};},
  deliveryLocked:()=>!!control.lockDelivery,
  openNote:async(file:TFile)=>{opened.push(file);},occurrences:()=>{},legacyInbox:()=>{legacy++;},
 };
 let library=new libraryModule.CollectionLibrary(app,{isBoardFile:file=>boardDocs.has(file as unknown as TFile),readBoard:async file=>{await boardReadGate;return boardDocs.get(file as unknown as TFile);}});
 library.onload();let workspace=new hostModule.CollectionWorkspace(app,library,bridge);
 const window=()=>({closed:false});
 const open=async(win=window())=>{const leaf:any={view:{containerEl:{isConnected:true,ownerDocument:{defaultView:win}}}};active=leaf;emit('active-leaf-change',leaf);const host=workspace.host(leaf);await host.ready();return{leaf,host,window:win};};
 const journalPath=(host:CollectionViewHost)=>`${directory}/collection-drafts/${host.sessionId()}.json`;
 const journal=(host:CollectionViewHost)=>{const raw=disk.get(journalPath(host));return raw?JSON.parse(raw) as Journal:undefined;};
 return{boardDocs,setBoardReadGate:(gate:Promise<void>|undefined)=>{boardReadGate=gate;},emit,app,bridge,control,disk,files,metadata,folders,native,links,adapterWrites,createdPaths,delivered,opened,setFile,index,open,journal,journalPath,directory,window,pickers,
  eventCounts:()=>Object.fromEntries([...events].filter(([,listeners])=>listeners.size).map(([name,listeners])=>[name,listeners.size])),
  library:()=>library,workspace:()=>workspace,
  counts:()=>({creates,mutations,ensureCalls,legacy,sourceReads}),
  activate:(leaf:any)=>{active=leaf;emit('active-leaf-change',leaf);},
  rename:(file:TFile,path:string)=>{const oldPath=file.path,source=disk.get(file.path)!;files.delete(file.path);disk.delete(file.path);file.path=path;files.set(path,file);disk.set(path,source);emit('vault-rename',file,oldPath);},
  restart:()=>{workspace.onunload();library=new libraryModule.CollectionLibrary(app,{isBoardFile:()=>false,readBoard:async()=>{throw Error('No fixture board');}});library.onload();workspace=new hostModule.CollectionWorkspace(app,library,bridge);},
 };
}

test('real host writes one native Markdown record, reuses tags/attachment links, and only journals in its session directory',async()=>{
 const f=fixture(),view=await f.open(),image=f.setFile('Images/示意图.png','binary-image');view.host.updateDraft({body,tags:'#阅读 #研究/记录 阅读',attachments:[{path:image.path,label:'示意图'}]});await view.host.submit(()=>true);
 const records=await view.host.list();assert.equal(records.length,1);const record=records[0],source=f.disk.get(record.path)!;assert.ok(record.path.endsWith('.md'));assert.equal(record.path.includes('首行无需另填标题'),true);
 assert.equal(model.collectionNoteBody(source,parseYaml,record),body+'\n\n![[Images/示意图.png]]');assert.deepEqual((parseYaml(source.match(/^---\n([\s\S]*?)\n---\n/)![1]) as any).tags,['阅读','研究/记录']);
 assert.deepEqual(f.links,[{file:image,source:record.path}]);assert.equal(f.disk.get(f.native.path),original);assert.equal(f.counts().mutations,0);assert.ok(f.adapterWrites.length>=4);assert.ok(f.adapterWrites.every(path=>journalStore.collectionJournalCanonical(path)===f.journalPath(view.host)));assert.equal(f.adapterWrites.includes(f.journalPath(view.host)),false);assert.equal(f.journal(view.host)!.draft.body,'');assert.equal(f.counts().creates,1);view.host.release?.();
});
test('creating-journal failure proves create was not started and safely resumes same ID on this host',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.journalFailure=journal=>journal.attempt?.phase==='creating';await assert.rejects(view.host.submit(()=>true),/journal storage failed/);assert.equal(f.counts().creates,0);const originalAttempt=f.journal(view.host)!.attempt!;assert.equal(originalAttempt.phase,'prepared');
 f.control.journalFailure=undefined;await view.host.submit(()=>true);const records=await view.host.list();assert.equal(records[0].id,originalAttempt.id);assert.equal(f.createdPaths[0],originalAttempt.path);assert.equal(f.counts().creates,1);view.host.release?.();
});
test('folder failure before native create remains positively absent and preserves editable text',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.ensureFailure=true;await assert.rejects(view.host.submit(()=>true),/folder creation failed/);assert.equal(f.counts().creates,0);assert.equal(view.host.draft().locked,false);f.control.ensureFailure=false;await view.host.submit(()=>true);assert.equal(f.counts().creates,1);view.host.release?.();
});
test('existence preflight read failure never calls native create and retries after read availability returns',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.existsFailure=path=>path.endsWith('.md');await assert.rejects(view.host.submit(()=>true),/exists unavailable/);assert.equal(f.counts().creates,0);assert.equal(view.host.draft().locked,true);f.control.existsFailure=undefined;await view.host.submit(()=>true);assert.equal(f.counts().creates,1);view.host.release?.();
});
test('confirmed rejected create retries the original identity; a missing old path after restart remains uncertain',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.createFailure='before';await assert.rejects(view.host.submit(()=>true),/native create rejected/);assert.equal(view.host.draft().locked,false);const attempt=f.journal(view.host)!.attempt!;f.control.createFailure=undefined;await view.host.submit(()=>true);assert.equal((await view.host.list())[0].id,attempt.id);assert.equal(f.counts().creates,2);view.host.release?.();
 const seed={version:1,draft:{body,tags:'',attachments:[]},attempt:{...attempt,id:'capture-restarted-original',path:'Notes/old-missing.md',phase:'creating'}};const id='session-restarted-original';f.disk.set(`${f.directory}/collection-drafts/${id}.json`,JSON.stringify(seed));f.restart();const restored=await f.open();await restored.host.setSessionId(id);await assert.rejects(restored.host.submit(()=>true),/尚未确认/);assert.equal(f.counts().creates,2);assert.equal(restored.host.draft().locked,true);restored.host.release?.();
});
test('native create success followed by thrown response is recovered by parsed identity without duplicate creation',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.createFailure='after';await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal((await view.host.list()).length,1);assert.equal(view.host.draft().body,'');view.host.release?.();
});
test('a written note absent from the Vault cache stays uncertain until the actual note becomes indexed',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.lagFileCache=true;await assert.rejects(view.host.submit(()=>true),/原保存路径存在其他内容/);const attempt=f.journal(view.host)!.attempt!;assert.equal(f.counts().creates,1);await assert.rejects(view.host.submit(()=>true));assert.equal(f.counts().creates,1);
 const file=new TFile(attempt.path);file.stat.size=Buffer.byteLength(f.disk.get(file.path)!);f.files.set(file.path,file);f.index(file);f.control.lagFileCache=false;await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal((await view.host.list()).length,1);view.host.release?.();
});
test('duplicate collection IDs remain ambiguous and existing body bytes are never rewritten',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.createFailure='after';f.control.readGate=deferred();const request=view.host.submit(()=>true);await until(()=>f.counts().creates===1);const path=f.createdPaths[0],source=f.disk.get(path)!;const duplicate=f.setFile('Notes/同标识副本.md',source);f.index(duplicate);f.control.readGate.resolve();await assert.rejects(request,/重复的收集标识/);await assert.rejects(view.host.submit(()=>true),/重复的收集标识/);assert.equal(f.counts().creates,1);assert.equal(f.disk.get(path),source);assert.equal(f.disk.get(duplicate.path),source);assert.equal(f.counts().mutations,0);view.host.release?.();
});
test('created record renamed and edited in the native editor is resolved by stable ID on retry',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body,target});f.control.deliveryFailure=true;await assert.rejects(view.host.submit(()=>true),/board failed/);const record=(await view.host.list())[0],file=f.files.get(record.path)!;f.index(file);f.rename(file,'Notes/用户改名.md');const modified=f.disk.get(file.path)!.replace('---\n','---\nuser_native_property: keep # verbatim\n')+'\n原生继续输入\r\n';f.disk.set(file.path,modified);f.index(file);f.control.deliveryFailure=false;await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal(f.disk.get(file.path),modified);assert.equal(f.delivered.at(-1)!.file,file);assert.equal(f.counts().mutations,0);view.host.release?.();
});
test('navigation away and back during folder creation revokes that invocation permanently',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body,target});f.control.ensureGate=deferred();const request=view.host.submit(()=>true);await until(()=>f.counts().ensureCalls===1);const other=await f.open();f.activate(view.leaf);f.control.ensureGate.resolve();await assert.rejects(request,/页面已变化/);assert.equal(f.counts().creates,0);assert.equal(f.delivered.length,0);assert.equal(view.host.draft().body,body);await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal(f.delivered.length,1);view.host.release?.();other.host.release?.();
});
test('closing a popout during native create retains late note and recovers without delivering or clearing input',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body,target});f.control.createGate=deferred();const request=view.host.submit(()=>true);await until(()=>f.counts().creates===1);view.window.closed=true;view.host.release?.();f.control.createGate.resolve();await assert.rejects(request,/当前位置已变化/);assert.equal(f.delivered.length,0);assert.equal(f.journal(view.host)!.draft.body,body);assert.equal(f.journal(view.host)!.attempt!.phase,'created');
 const next=await f.open();await next.host.setSessionId(view.host.sessionId());next.host.updateDraft({target:null});await next.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal((await next.host.list()).length,1);next.host.release?.();
});
test('a restored layout session already owned by another window gets an independent journal and draft',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body:'第一窗口草稿'});const second=await f.open();await second.host.setSessionId(first.host.sessionId());assert.notEqual(first.host.sessionId(),second.host.sessionId());assert.equal(second.host.draft().body,'');second.host.updateDraft({body:'第二窗口草稿'});await second.host.submit(()=>true);assert.equal(first.host.draft().body,'第一窗口草稿');assert.equal(f.journal(first.host)!.draft.body,'第一窗口草稿');assert.notEqual(f.journalPath(first.host),f.journalPath(second.host));assert.equal(f.counts().creates,1);first.host.release?.();second.host.release?.();
});
test('released owner can be explicitly recovered while another active session is not stolen',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body:'recover me'});const id=first.host.sessionId();first.host.release?.();await until(()=>!!f.journal(first.host));assert.equal(await f.workspace().recoverableSession(),id);const next=await f.open();await next.host.setSessionId(id);assert.equal(next.host.draft().body,'recover me');assert.equal(await f.workspace().recoverableSession(),undefined);next.host.release?.();
});
test('full-page and docked hosts share records while closing and reopening preserves their independent drafts',async()=>{
 const f=fixture(),window=f.window(),page=await f.open(window),sidebar=await f.open(window),notices:string[]=[];
 // Both leaves belong to the same document, as a right sidebar and a main tab do.
 sidebar.leaf.view.containerEl.ownerDocument=page.leaf.view.containerEl.ownerDocument;
 page.host.subscribe(kind=>{if(kind==='records')notices.push('page');});
 sidebar.host.subscribe(kind=>{if(kind==='records')notices.push('sidebar');});
 page.host.updateDraft({body:'完整页面尚未提交的草稿',tags:'#保留'});
 sidebar.host.updateDraft({body:'侧边栏保存的记录'});await sidebar.host.submit(()=>true);
 assert.deepEqual(await page.host.list(),await sidebar.host.list());
 assert.equal((await page.host.list()).length,1);assert.ok(notices.includes('page'));assert.ok(notices.includes('sidebar'));
 assert.equal(page.host.draft().body,'完整页面尚未提交的草稿');assert.equal(sidebar.host.draft().body,'');
 sidebar.host.updateDraft({body:'关闭后继续的侧边栏草稿',tags:'#稍后'});const session=sidebar.host.sessionId();
 sidebar.host.release?.();sidebar.leaf.view.containerEl.isConnected=false;await settleWrites();
 assert.equal(await f.workspace().recoverableSession(),session);
 const reopened=await f.open(window);await reopened.host.setSessionId(session);
 assert.equal(reopened.host.draft().body,'关闭后继续的侧边栏草稿');assert.equal(reopened.host.draft().tags,'#稍后');
 assert.equal(page.host.draft().body,'完整页面尚未提交的草稿');assert.equal(page.host.draft().tags,'#保留');
 assert.equal(await f.workspace().recoverableSession(),undefined,'the active full-page draft is not offered for recovery');
 await reopened.host.submit(()=>true);assert.equal((await page.host.list()).length,2);
 assert.equal(f.counts().creates,2);assert.equal(f.disk.get(f.native.path),original);assert.equal(f.counts().mutations,0);
 page.host.release?.();reopened.host.release?.();
});
test('invalid session IDs cannot escape the journal directory or replace another file',async()=>{
 const f=fixture(),view=await f.open(),id=view.host.sessionId();for(const invalid of ['../outside','session-../../outside','session-/absolute','session-bad.json','session-'])await view.host.setSessionId(invalid);assert.equal(view.host.sessionId(),id);view.host.updateDraft({body});await view.host.submit(()=>true);assert.ok(f.adapterWrites.every(path=>journalStore.collectionJournalCanonical(path)===`${f.directory}/collection-drafts/${id}.json`));assert.equal(f.disk.get(f.native.path),original);view.host.release?.();
});
test('corrupt journal is surfaced without overwrite and cannot be silently replaced by an empty draft',async()=>{
 const f=fixture(),id='session-corrupt-existing',path=`${f.directory}/collection-drafts/${id}.json`,source='{"version":1,"draft": broken';f.folders.add(`${f.directory}/collection-drafts`);f.disk.set(path,source);assert.equal(await f.workspace().recoverableSession(),id);const view=await f.open();await view.host.setSessionId(id);assert.equal(view.host.draft().locked,true);assert.match(view.host.draft().status!,/原文件未改动/);await assert.rejects(view.host.submit(()=>true));assert.equal(f.disk.get(path),source);assert.equal(f.adapterWrites.includes(path),false);view.host.release?.();
});
test('collection library never backfills metadata into legacy notes and native user edits remain canonical',async()=>{
 const f=fixture(),view=await f.open();f.index(f.native);assert.deepEqual(await view.host.list(),[]);view.host.openLegacyInbox();assert.equal(f.counts().legacy,1);view.host.updateDraft({body});await view.host.submit(()=>true);const record=(await view.host.list())[0],file=f.files.get(record.path)!;const edited=f.disk.get(file.path)!.replace('---\n','---\nuser-key: [one, two] # exact\n')+'\nChanged natively';f.disk.set(file.path,edited);f.index(file);assert.equal(await view.host.readBody(record),body+'\nChanged natively');await view.host.openNote(record);assert.deepEqual(f.opened,[file]);assert.equal(f.disk.get(f.native.path),original);assert.equal(f.disk.get(file.path),edited);assert.equal(f.counts().mutations,0);view.host.release?.();
});
test('prepared journal restored after restart still handles pre-create failure without losing positive absence proof',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body});f.control.journalFailure=journal=>journal.attempt?.phase==='creating';await assert.rejects(first.host.submit(()=>true));const old=f.journal(first.host)!.attempt!,id=first.host.sessionId();assert.equal(old.phase,'prepared');first.host.release?.();for(let i=0;i<200;i++)await Promise.resolve();f.control.journalFailure=undefined;f.restart();
 const view=await f.open();await view.host.setSessionId(id);f.control.ensureFailure=true;await assert.rejects(view.host.submit(()=>true),/folder creation failed/);assert.equal(f.counts().creates,0);assert.equal(view.host.draft().locked,false);f.control.ensureFailure=false;await view.host.submit(()=>true);assert.equal((await view.host.list())[0].id,old.id);assert.equal(f.counts().creates,1);view.host.release?.();
});
test('attachment-only draft remains discoverable after full workspace restart and saves as a native link note',async()=>{
 const f=fixture(),first=await f.open(),image=f.setFile('Images/仅附件.png','image bytes');first.host.updateDraft({attachments:[{path:image.path,label:image.name}]});const id=first.host.sessionId();first.host.release?.();await until(()=>!!f.journal(first.host)?.draft.attachments.length);f.restart();assert.equal(await f.workspace().recoverableSession(),id);
 const view=await f.open();await view.host.setSessionId(id);assert.equal(view.host.draft().body,'');assert.equal(view.host.draft().attachments[0].path,image.path);await view.host.submit(()=>true);const record=(await view.host.list())[0];assert.equal(model.collectionNoteBody(f.disk.get(record.path)!,parseYaml,record),'![[Images/仅附件.png]]');assert.equal(f.counts().creates,1);view.host.release?.();
});
test('journal read failure surfaces storage error and preserves its existing bytes',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body});first.host.release?.();await until(()=>!!f.journal(first.host));const id=first.host.sessionId(),path=f.journalPath(first.host),saved=f.disk.get(path)!,writes=f.adapterWrites.length;f.restart();f.control.readJournalFailure=true;const view=await f.open();await view.host.setSessionId(id);
 assert.match(view.host.draft().status!,/journal read unavailable/);assert.equal(view.host.draft().locked,true);await assert.rejects(view.host.submit(()=>true));assert.equal(f.disk.get(path),saved);assert.equal(f.adapterWrites.length,writes);assert.equal(f.counts().creates,0);view.host.release?.();
});
test('native removal of collection properties removes the record from the stream without writing the note',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});await view.host.submit(()=>true);const record=(await view.host.list())[0],file=f.files.get(record.path)!;const edited='---\nuser-property: only-native\n---\nAn ordinary native note now\r\n';f.disk.set(file.path,edited);f.index(file);assert.deepEqual(await view.host.list(),[]);await assert.rejects(view.host.readBody(record),/更改收集属性/);assert.equal(f.disk.get(file.path),edited);assert.equal(f.counts().mutations,0);view.host.release?.();
});
test('source reading that completes after away-and-return cannot open a note in the previous window',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});await view.host.submit(()=>true);const record=(await view.host.list())[0];f.control.readGate=deferred();const before=f.counts().sourceReads,request=view.host.openNote(record);await until(()=>f.counts().sourceReads>before);const other=await f.open();f.activate(view.leaf);f.control.readGate.resolve();await request;assert.deepEqual(f.opened,[]);view.host.release?.();other.host.release?.();
});
test('create response loss plus immediate rename before metadata indexing cannot create a duplicate record',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.createFailure='after';let renamed:TFile|undefined;f.control.afterCreate=file=>{renamed=file;f.rename(file,'Notes/即时改名但尚未索引.md');};
 let completed=false;try{await view.host.submit(()=>true);completed=true;}catch{assert.equal(view.host.draft().locked,true,'missing the former path is not proof that a created record does not exist');}
 assert.equal(f.counts().creates,1);
 if(!completed){try{await view.host.submit(()=>true);completed=true;}catch{assert.equal(view.host.draft().locked,true);}assert.equal(f.counts().creates,1);}
 f.index(renamed!);f.control.createFailure=undefined;f.control.afterCreate=undefined;if(!completed)await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal((await view.host.list()).length,1);assert.equal(model.collectionNoteBody(f.disk.get(renamed!.path)!,parseYaml),body);view.host.release?.();
});
test('an observed create followed by native identity removal and rename stays uncertain without overwriting or duplicating it',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.createFailure='after';let changed:TFile|undefined;const nativeEdit='---\nuser-native-property: preserved\n---\nNative text after creation\r\n';f.control.afterCreate=file=>{changed=file;f.disk.set(file.path,nativeEdit);f.rename(file,'Notes/创建后已改属性.md');};
 await assert.rejects(view.host.submit(()=>true));assert.equal(view.host.draft().locked,true);assert.equal(f.counts().creates,1);await assert.rejects(view.host.submit(()=>true));assert.equal(f.counts().creates,1);assert.equal(f.disk.get(changed!.path),nativeEdit);assert.equal(f.counts().mutations,0);view.host.release?.();
});
test('absence proved for a rejected create expires before retry writes then renames with a temporarily unreadable result',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body});f.control.createFailure='before';await assert.rejects(view.host.submit(()=>true),/native create rejected/);const identity=f.journal(view.host)!.attempt!;assert.equal(view.host.draft().locked,false);assert.equal(f.counts().creates,1);
 let renamed:TFile|undefined,readFailed=false;f.control.createFailure='after';f.control.afterCreate=file=>{renamed=file;f.rename(file,'Notes/第二次已落盘但未索引.md');};f.control.afterRead=()=>{if(!readFailed){readFailed=true;throw Error('confirmation temporarily unavailable');}};
 await assert.rejects(view.host.submit(()=>true),/尚未确认|待核对/);assert.equal(readFailed,true);assert.equal(f.counts().creates,2);assert.equal(view.host.draft().locked,true);assert.equal(f.journal(view.host)!.attempt!.phase,'creating');assert.equal(f.journal(view.host)!.attempt!.id,identity.id);
 await assert.rejects(view.host.submit(()=>true),/尚未确认|待核对/);assert.equal(f.counts().creates,2,'uncertain retry must not issue a third native create');assert.equal(view.host.draft().locked,true);
 f.index(renamed!);f.control.createFailure=undefined;f.control.afterCreate=undefined;f.control.afterRead=undefined;await view.host.submit(()=>true);assert.equal(f.counts().creates,2);const records=await view.host.list();assert.equal(records.length,1);assert.equal(records[0].id,identity.id);assert.equal(records[0].path,renamed!.path);assert.equal(model.collectionNoteBody(f.disk.get(renamed!.path)!,parseYaml,identity),body);assert.equal(f.disk.get(f.native.path),original);assert.equal(f.counts().mutations,0);view.host.release?.();
});

test('partial temporary draft write preserves the last confirmed draft across a completely new controller',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body:'confirmed A'});await settleWrites();const id=first.host.sessionId(),path=f.journalPath(first.host),confirmed=f.disk.get(path)!;
 f.control.partialWrite=(path,source)=>path.endsWith('.tmp')&&(JSON.parse(source) as Journal).draft.body==='unconfirmed B';first.host.updateDraft({body:'unconfirmed B'});await until(()=>first.host.draft().status?.includes('partial temporary write')===true);assert.equal(f.disk.get(path),confirmed);assert.equal(first.host.draft().body,'unconfirmed B');
 first.host.release?.();await settleWrites();const damaged=[...f.disk].filter(([name])=>name.endsWith('.tmp'));assert.ok(damaged.length);f.restart();assert.equal(await f.workspace().recoverableSession(),id);const restored=await f.open();await restored.host.setSessionId(id);assert.equal(restored.host.draft().body,'confirmed A');assert.equal(restored.host.draft().locked,false);assert.equal(f.disk.get(path),confirmed);for(const[name,bytes]of damaged)assert.equal(f.disk.get(name),bytes);assert.equal(f.counts().creates,0);restored.host.release?.();
});
test('process rejection preserves canonical bytes and can retry the current draft after storage returns',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body:'confirmed A'});await settleWrites();const path=f.journalPath(view.host),confirmed=f.disk.get(path)!;f.control.processFailure='before';view.host.updateDraft({body:'pending B'});await until(()=>view.host.draft().status?.includes('process write rejected')===true);assert.equal(f.disk.get(path),confirmed);assert.ok([...f.disk.keys()].some(name=>name.includes('.previous-')));assert.equal(view.host.draft().body,'pending B');assert.equal(f.counts().creates,0);
 f.control.processFailure=undefined;await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal(model.collectionNoteBody(f.disk.get((await view.host.list())[0].path)!,parseYaml),'pending B');view.host.release?.();
});
test('process success with a lost response is confirmed by exact readback and saves only one note',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body:'confirmed A'});await settleWrites();f.control.processFailure='after';view.host.updateDraft({body});await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal(view.host.draft().body,'');assert.equal(f.journal(view.host)!.draft.body,'');assert.equal((await view.host.list()).length,1);view.host.release?.();
});
test('adapter process callback refuses an external canonical edit without overwriting its bytes',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body:'confirmed A'});await settleWrites();const external=JSON.stringify({version:1,draft:{body:'external edit',tags:'',attachments:[]}});f.control.processExternal=external;view.host.updateDraft({body:'local B'});await until(()=>view.host.draft().status?.includes('同时发生变化')===true);assert.equal(f.disk.get(f.journalPath(view.host)),external);await assert.rejects(view.host.submit(()=>true),/其他操作更改/);assert.equal(f.counts().creates,0);assert.equal(f.disk.get(f.journalPath(view.host)),external);view.host.release?.();
});
test('partial canonical failure recovers the verified previous draft as locked and retains all damaged material',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body:'confirmed A'});await settleWrites();const id=first.host.sessionId(),path=f.journalPath(first.host);f.control.processFailure='partial';first.host.updateDraft({body:'partial B'});await until(()=>first.host.draft().status?.includes('partial canonical')===true);first.host.release?.();await settleWrites();const broken=f.disk.get(path)!,materials=new Map([...f.disk].filter(([name])=>name.startsWith(path+'.')));assert.equal(recovery.isCollectionJournalSource(broken),false);assert.ok([...materials.keys()].some(name=>name.includes('.previous-')));
 f.control.processFailure=undefined;f.restart();assert.equal(await f.workspace().recoverableSession(),id);const restored=await f.open();await restored.host.setSessionId(id);assert.equal(restored.host.draft().body,'confirmed A');assert.equal(restored.host.draft().locked,true);assert.equal(restored.host.draft().canSubmit,false);assert.match(restored.host.draft().status!,/上一份已确认草稿/);await assert.rejects(restored.host.submit(()=>true),/旧检查点不会用于再次创建/);assert.equal(f.counts().creates,0);assert.equal(f.disk.get(path),broken);for(const[name,bytes]of materials)assert.equal(f.disk.get(name),bytes);restored.host.release?.();
});
for(const phase of ['creating','created'] as const){
 test(`${phase} checkpoint process rejection restarts from canonical and never duplicates native creation`,async()=>{
  const f=fixture(),first=await f.open();first.host.updateDraft({body});await settleWrites();f.control.processPhase=phase;f.control.processFailure='before';await assert.rejects(first.host.submit(()=>true),/process write rejected/);const before=f.journal(first.host)!.attempt!,id=first.host.sessionId();assert.equal(before.phase,phase==='creating'?'prepared':'creating');assert.equal(f.counts().creates,phase==='creating'?0:1);first.host.release?.();await settleWrites();f.control.processFailure=undefined;f.restart();const restored=await f.open();await restored.host.setSessionId(id);await restored.host.submit(()=>true);assert.equal(f.counts().creates,1);const records=await restored.host.list();assert.equal(records.length,1);assert.equal(records[0].id,before.id);assert.equal(f.counts().mutations,0);restored.host.release?.();
 });
 test(`${phase} partial checkpoint falls back locked and cannot use previous prepared state to recreate`,async()=>{
  const f=fixture(),first=await f.open();first.host.updateDraft({body});await settleWrites();f.control.processPhase=phase;f.control.processFailure='partial';await assert.rejects(first.host.submit(()=>true),/partial canonical/);const id=first.host.sessionId(),path=f.journalPath(first.host),broken=f.disk.get(path)!;assert.equal(f.counts().creates,phase==='creating'?0:1);first.host.release?.();await settleWrites();f.control.processFailure=undefined;f.restart();assert.equal(await f.workspace().recoverableSession(),id);const restored=await f.open();await restored.host.setSessionId(id);assert.equal(restored.host.draft().body,body);assert.equal(restored.host.draft().locked,true);assert.equal(restored.host.draft().canSubmit,false);await assert.rejects(restored.host.submit(()=>true),/旧检查点不会用于再次创建/);await assert.rejects(restored.host.submit(()=>true));assert.equal(f.counts().creates,phase==='creating'?0:1);assert.equal(f.disk.get(path),broken);assert.equal(f.counts().mutations,0);restored.host.release?.();
 });
}
test('missing canonical with a verified previous snapshot discovers its original session and locks recovery',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body:'previous A'});await settleWrites();first.host.updateDraft({body:'confirmed B'});await settleWrites();const id=first.host.sessionId(),path=f.journalPath(first.host);first.host.release?.();await settleWrites();f.disk.delete(path);f.restart();assert.equal(await f.workspace().recoverableSession(),id);const restored=await f.open();await restored.host.setSessionId(id);assert.equal(restored.host.draft().body,'previous A');assert.equal(restored.host.draft().locked,true);await assert.rejects(restored.host.submit(()=>true));assert.equal(f.disk.has(path),false);assert.equal(f.counts().creates,0);restored.host.release?.();
});
test('confirmed empty canonical takes priority over previous completed snapshots after a full restart',async()=>{
 const f=fixture(),first=await f.open();first.host.updateDraft({body});await first.host.submit(()=>true);assert.equal(f.journal(first.host)!.draft.body,'');assert.ok([...f.disk.keys()].some(path=>path.includes('.previous-')));first.host.release?.();await settleWrites();f.restart();assert.equal(await f.workspace().recoverableSession(),undefined);assert.equal(f.counts().creates,1);
});
test('first journal rename that commits then loses its response is confirmed without discarding the draft',async()=>{
 const f=fixture(),view=await f.open();f.control.renameFailure='after';view.host.updateDraft({body});await settleWrites();assert.equal(f.journal(view.host)!.draft.body,body);assert.doesNotMatch(view.host.draft().status!,/未确认/);await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal(view.host.draft().body,'');view.host.release?.();
});
test('a mobile-style adapter that refuses rename replacement uses process for subsequent canonical writes',async()=>{
 const f=fixture(),view=await f.open();f.control.noOverwriteRename=true;view.host.updateDraft({body:'A'});await settleWrites();view.host.updateDraft({body:'B'});await settleWrites();assert.equal(f.journal(view.host)!.draft.body,'B');await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal(view.host.draft().body,'');view.host.release?.();
});
test('older adapter without process fails closed when replacement rename is unsupported',async()=>{
 const f=fixture(),view=await f.open();delete f.app.vault.adapter.process;f.control.noOverwriteRename=true;view.host.updateDraft({body:'confirmed A'});await settleWrites();const path=f.journalPath(view.host),confirmed=f.disk.get(path)!;view.host.updateDraft({body:'unconfirmed B'});await until(()=>view.host.draft().status?.includes('rename cannot replace')===true);assert.equal(f.disk.get(path),confirmed);assert.equal(view.host.draft().body,'unconfirmed B');await assert.rejects(view.host.submit(()=>true));assert.equal(f.counts().creates,0);assert.equal(f.disk.get(path),confirmed);assert.ok([...f.disk.keys()].some(name=>name.includes('.previous-')));view.host.release?.();
});
test('journal readback unavailable after process commit reconciles exact committed bytes on retry',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body:'A'});await settleWrites();f.control.processAfterReadFailure=true;view.host.updateDraft({body:'B'});await until(()=>view.host.draft().status?.includes('journal read unavailable')===true);assert.equal(f.journal(view.host)!.draft.body,'B');assert.equal(f.counts().creates,0);f.control.processAfterReadFailure=false;f.control.readJournalFailure=false;await view.host.submit(()=>true);assert.equal(f.counts().creates,1);assert.equal(model.collectionNoteBody(f.disk.get((await view.host.list())[0].path)!,parseYaml),'B');view.host.release?.();
});
test('cleanup retains foreign temporary material and an owned previous file whose contents changed externally',async()=>{
 const f=fixture(),view=await f.open();view.host.updateDraft({body:'A'});await settleWrites();view.host.updateDraft({body:'B'});await settleWrites();const path=f.journalPath(view.host),previous=[...f.disk.keys()].find(name=>name.startsWith(path+'.previous-'))!;assert.ok(previous);
 const foreign=new Map([[previous,'external replacement of formerly owned material'],[path+'.pending-external-owner.tmp','external partial material'],[path+'.previous-999999999999-external-owner.json','invalid external previous material']]);for(const[name,source]of foreign)f.disk.set(name,source);
 view.host.updateDraft({body:'C'});await settleWrites();assert.equal(f.journal(view.host)!.draft.body,'C');await view.host.submit(()=>true);assert.equal(f.counts().creates,1);for(const[name,source]of foreign)assert.equal(f.disk.get(name),source);assert.equal(f.disk.get(f.native.path),original);view.host.release?.();
});

test('attachment picker accepts native close-before-choose order and persists the chosen existing file',async()=>{
 const f=fixture(),view=await f.open(),image=f.setFile('Images/原生选择.png','image bytes');const result=view.host.pickAttachment(()=>true),picker=f.pickers.at(-1)!;assert.deepEqual(picker.getItems(),[image]);picker.close();picker.onChooseItem(image);const selected=await result;assert.deepEqual(selected,{path:image.path,label:image.name});view.host.updateDraft({attachments:[selected!]});await view.host.submit(()=>true);const note=(await view.host.list())[0];assert.equal(model.collectionNoteBody(f.disk.get(note.path)!,parseYaml,note),'![[Images/原生选择.png]]');assert.equal(f.disk.get(image.path),'image bytes');assert.equal(f.counts().creates,1);view.host.release?.();
});
test('attachment picker cancellation settles empty and ignores a later stale choose callback',async()=>{
 const f=fixture(),view=await f.open(),image=f.setFile('Images/取消.png','image bytes');const result=view.host.pickAttachment(()=>true),picker=f.pickers.at(-1)!;picker.close();assert.equal(await result,undefined);picker.onChooseItem(image);assert.equal(await result,undefined);assert.equal(view.host.draft().attachments.length,0);assert.equal(f.counts().creates,0);view.host.release?.();
});
test('attachment picker permanently rejects selection after navigation away and back in the same turn',async()=>{
 const f=fixture(),view=await f.open(),image=f.setFile('Images/导航.png','image bytes');const result=view.host.pickAttachment(()=>true),picker=f.pickers.at(-1)!;picker.close();f.activate({});f.activate(view.leaf);picker.onChooseItem(image);assert.equal(await result,undefined);assert.equal(view.host.draft().attachments.length,0);assert.equal(f.counts().creates,0);view.host.release?.();
});
test('attachment picker repeated close and choose callbacks resolve once with only the first attachment',async()=>{
 const f=fixture(),view=await f.open(),first=f.setFile('Images/第一张.png','one'),second=f.setFile('Images/第二张.png','two');let resolutions=0;const result=view.host.pickAttachment(()=>true).then(selected=>{resolutions++;if(selected)view.host.updateDraft({attachments:[selected]});return selected;});const picker=f.pickers.at(-1)!;picker.close();picker.onChooseItem(first);picker.onChooseItem(second);picker.close();assert.equal((await result)?.path,first.path);await settleWrites();assert.equal(resolutions,1);assert.deepEqual(view.host.draft().attachments,[{path:first.path,label:first.name}]);assert.equal(f.journal(view.host)!.draft.attachments.length,1);view.host.release?.();
});
for(const interrupted of ['closed-window','released-owner','cancelled-invocation'] as const){
 test(`attachment picker ignores close-before-choose after ${interrupted}`,async()=>{
  const f=fixture(),view=await f.open(),image=f.setFile('Images/迟到.png','image bytes');let current=true;const result=view.host.pickAttachment(()=>current),picker=f.pickers.at(-1)!;picker.close();if(interrupted==='closed-window')view.window.closed=true;else if(interrupted==='released-owner')view.host.release?.();else current=false;picker.onChooseItem(image);assert.equal(await result,undefined);assert.equal(view.host.draft().attachments.length,0);assert.equal(f.counts().creates,0);view.host.release?.();
 });
}

const boardNode=(id:string,path:string)=>({id,kind:'card',file:path,x:0,y:0,width:100,height:80,color:'slate'});
async function boardFixture(){const f=fixture(),view=await f.open();view.host.updateDraft({body});await view.host.submit(()=>true);const record=(await view.host.list())[0],a=f.setFile('Boards/A.md','board-a'),b=f.setFile('Boards/B.md','board-b');f.boardDocs.set(a,{nodes:[boardNode('a1',record.path),boardNode('a2',record.path)]});f.boardDocs.set(b,{nodes:[boardNode('b1',record.path)]});f.library().invalidate();return{...f,view,record,a,b};}
test('lightweight collection membership indexes each physical card without reading any note body',async()=>{const f=await boardFixture(),before=f.counts().sourceReads,records=await f.view.host.list();assert.deepEqual(records[0].placements?.map(item=>[item.boardPath,item.nodeId]),[['Boards/A.md','a1'],['Boards/A.md','a2'],['Boards/B.md','b1']]);assert.equal(records[0].inBoard,true);assert.equal(f.counts().sourceReads,before);assert.equal(f.counts().mutations,0);});
test('reference and board deletion refresh membership independently while preserving the original record',async()=>{const f=await boardFixture();f.boardDocs.set(f.a,{nodes:[boardNode('a2',f.record.path)]});f.emit('vault-modify',f.a);let current=(await f.view.host.list())[0];assert.deepEqual(current.placements?.map(item=>item.nodeId),['a2','b1']);f.files.delete(f.b.path);f.emit('vault-delete',f.b);current=(await f.view.host.list())[0];assert.deepEqual(current.placements?.map(item=>item.nodeId),['a2']);f.boardDocs.set(f.a,{nodes:[]});f.emit('vault-modify',f.a);current=(await f.view.host.list())[0];assert.equal(current.inBoard,false);assert.equal(current.path,f.record.path);assert.equal(f.counts().creates,1);});
test('renamed boards receive new display paths and stale chip cannot target a replacement at the old path',async()=>{const f=await boardFixture(),before=(await f.view.host.list())[0].placements![0];assert.equal(f.library().referenceFile(before),f.a);f.rename(f.a,'Boards/Renamed.md');const current=(await f.view.host.list())[0];assert.ok(current.placements?.some(item=>item.boardTitle==='Renamed'));assert.equal(f.library().referenceFile(before),undefined);const replacement=f.setFile(before.boardPath,'replacement');f.boardDocs.set(replacement,{nodes:[boardNode('a1',f.record.path)]});f.library().invalidate();await f.view.host.list();assert.equal(f.library().referenceFile(before),undefined);});
test('a board changed while scanning cannot publish stale membership',async()=>{const f=await boardFixture(),gate=deferred();f.setBoardReadGate(gate.promise);const list=f.view.host.list();f.boardDocs.set(f.a,{nodes:[]});f.files.delete(f.b.path);f.emit('vault-delete',f.b);gate.resolve();const records=await list;assert.equal(records[0].placements?.length,0);assert.equal(records[0].inBoard,false);});
test('handwriting documents never advertise native card placements',async()=>{const f=await boardFixture();f.boardDocs.set(f.a,{presentation:'handwriting',nodes:[boardNode('a1',f.record.path)]});f.files.delete(f.b.path);f.emit('vault-modify',f.a);const record=(await f.view.host.list())[0];assert.equal(record.inBoard,false);assert.equal(record.placements?.length,0);});
test('locate bridge receives original note and exact board object and ignores an away-return delayed read',async()=>{const f=await boardFixture(),record=(await f.view.host.list())[0],reference=record.placements![1],calls:any[]=[];f.bridge.locateBoard=(...args:any[])=>calls.push(args);await f.view.host.locateBoard!(record,reference);assert.equal(calls[0][0],f.files.get(record.path));assert.equal(calls[0][1],f.a);assert.equal(calls[0][2],'a2');f.control.readGate=deferred();const late=f.view.host.locateBoard!(record,reference);await settleWrites();const other=await f.open();f.activate(f.view.leaf);f.control.readGate.resolve();await late;assert.equal(calls.length,1);other.host.release?.();f.view.host.release?.();});
test('resolving a record rejects a replaced native file after an awaited body read',async()=>{const f=await boardFixture();f.control.afterRead=()=>{const old=f.files.get(f.record.path)!;const replacement=new TFile(old.path);f.files.set(old.path,replacement);};await assert.rejects(f.library().resolve(f.record,f.record.path),/移除|替换/);});
test('a focused Collection moved to a native sidebar can save and open while mostRecentLeaf stays on the main editor',async()=>{
 const f=fixture(),view=await f.open(),mainLeaf={view:{containerEl:{isConnected:true,ownerDocument:view.leaf.view.containerEl.ownerDocument}}};f.app.workspace.getMostRecentLeaf=()=>mainLeaf;
 assert.equal(f.app.workspace.activeLeaf,view.leaf);assert.notEqual(f.app.workspace.getMostRecentLeaf(),view.leaf);view.host.updateDraft({body});await view.host.submit(()=>true);const record=(await view.host.list())[0];await view.host.openNote(record);assert.equal(f.counts().creates,1);assert.equal(f.opened.length,1);assert.equal(f.opened[0],f.files.get(record.path));view.host.release?.();
});
for(const action of ['openNote','showOccurrences','locateBoard'] as const)test(`main Collection ${action} is permanently cancelled by sidebar focus before a late identity read`,async()=>{
 const f=await boardFixture(),record=(await f.view.host.list())[0],reference=record.placements![0],calls:any[]=[];f.app.workspace.getMostRecentLeaf=()=>f.view.leaf;f.bridge.occurrences=(...args:any[])=>calls.push(args);f.bridge.locateBoard=(...args:any[])=>calls.push(args);f.control.readGate=deferred();
 const work=action==='locateBoard'?f.view.host.locateBoard!(record,reference):f.view.host[action](record);await settleWrites();const sidebar={view:{containerEl:{isConnected:true,ownerDocument:f.view.leaf.view.containerEl.ownerDocument}}};f.activate(sidebar);
 assert.equal(f.app.workspace.getMostRecentLeaf(),f.view.leaf);assert.equal(f.app.workspace.activeLeaf,sidebar);f.activate(f.view.leaf);f.control.readGate.resolve();await work;assert.equal(f.opened.length,0);assert.equal(calls.length,0);f.view.host.release?.();
});

test('Collection hosts read current plugin appearance per call without mutating private drafts or source files',async()=>{
 const f=fixture();let appearance={accent:'blue',density:'compact'};f.bridge.accent=()=>appearance.accent;f.bridge.density=()=>appearance.density;
 const a=await f.open(),b=await f.open(f.window());a.host.updateDraft({body:'主窗口草稿'});b.host.updateDraft({body:'另一窗口草稿'});await settleWrites();const before=new Map(f.disk),writes=f.adapterWrites.length;
 assert.deepEqual([a.host.accent?.(),a.host.density?.(),b.host.accent?.(),b.host.density?.()],['blue','compact','blue','compact']);appearance={accent:'amber',density:'comfortable'};
 assert.deepEqual([a.host.accent?.(),a.host.density?.(),b.host.accent?.(),b.host.density?.()],['amber','comfortable','amber','comfortable']);assert.equal(a.host.draft().body,'主窗口草稿');assert.equal(b.host.draft().body,'另一窗口草稿');assert.notEqual(a.host.sessionId(),b.host.sessionId());assert.equal(f.adapterWrites.length,writes);assert.deepEqual(f.disk,before);assert.equal(f.counts().mutations,0);a.host.release?.();b.host.release?.();
});

async function flagHostFixture(){
 const f=fixture(),view=await f.open();view.host.updateDraft({body});await view.host.submit(()=>true);const record=(await view.host.list())[0],file=f.files.get(record.path)!;f.index(file);return{...f,view,record,file};
}
async function contextHostFixture(){
 const f=await flagHostFixture(),attachment=f.setFile('Images/native-context.pdf','fixture attachment');
 f.app.metadataCache.resolvedLinks={};
 f.app.metadataCache.getFirstLinkpathDest=(path:string)=>f.files.get(path)||null;
 const cached=f.metadata.get(f.file) as any;
 cached.links=[{link:attachment.path,original:attachment.path}];
 return{...f,attachment,cached};
}
test('host context and attachment pages use the real metadata service without body reads or writes',async()=>{
 const f=await contextHostFixture(),before=f.counts(),context=await f.view.host.inspectContext!(f.record,()=>true);
 assert.equal(context.attachments.length,1);assert.equal(context.attachments[0].path,f.attachment.path);
 const page=await f.view.host.attachmentPage!({},()=>true);assert.equal(page.total,1);assert.equal(page.items[0].source.id,f.record.id);
 const opens:any[]=[];f.bridge.openRelated=async(...args:any[])=>{assert.equal(args[2](),true);opens.push(args);};
 await f.view.host.openContext!(f.record,context.attachments[0],()=>true);assert.equal(opens[0][0],f.attachment);assert.equal(opens[0][1],f.record);
 assert.deepEqual(f.counts(),before);f.view.host.release?.();
});
for(const change of ['relationship removed','target replaced','source edited','navigation left and returned','view released'] as const)test(`host queued native context open rejects ${change}`,async()=>{
 const f=await contextHostFixture(),item=(await f.view.host.inspectContext!(f.record,()=>true)).attachments[0],gate=deferred();
 let entered=false,opened=false,retained:()=>boolean=()=>true;
 f.bridge.openRelated=async(_target:unknown,_source:unknown,current:()=>boolean)=>{entered=true;retained=current;await gate.promise;if(!current())throw Error('queued context changed');opened=true;};
 const pending=f.view.host.openContext!(f.record,item,()=>true);await until(()=>entered);
 if(change==='relationship removed')f.cached.links=[];
 if(change==='target replaced')f.files.set(f.attachment.path,new TFile(f.attachment.path));
 if(change==='source edited')f.emit('vault-modify',f.file);
 if(change==='navigation left and returned'){const other=await f.open();f.activate(f.view.leaf);other.host.release?.();}
 if(change==='view released')f.view.host.release?.();
 assert.equal(retained(),false);gate.resolve();await assert.rejects(pending,/queued context changed/);assert.equal(opened,false);f.view.host.release?.();
});
test('host refuses copied navigation items before entering the native open bridge',async()=>{
 const f=await contextHostFixture(),item=(await f.view.host.inspectContext!(f.record,()=>true)).attachments[0];let entered=0;
 f.bridge.openRelated=async()=>{entered++;};
 await assert.rejects(f.view.host.openContext!(f.record,{...item},()=>true),/已变化/);assert.equal(entered,0);f.view.host.release?.();
});
for(const flag of ['pinned','archived'] as const)for(const previous of [undefined,false,true] as const)test(`setFlag wires ${flag} with expected ${String(previous)} to the exact native field and source`,async()=>{
 const f=await flagHostFixture(),record={...f.record,[flag]:previous},before=new Map(f.disk),events=f.eventCounts();let calls=0,retainedCurrent:()=>boolean=()=>true;
 f.app.collectionFlagOperation=async(app:unknown,file:unknown,identity:unknown,field:unknown,value:unknown,current:()=>boolean,expected:unknown)=>{
  calls++;assert.equal(app,f.app);assert.equal(file,f.file);assert.equal(identity,record);assert.equal(field,flag==='pinned'?'thoughtspace_pinned':'thoughtspace_archived');assert.equal(value,previous!==true);assert.equal(expected,previous===true);assert.equal(current(),true);retainedCurrent=current;
 };
 await f.view.host.setFlag!(record,flag,previous!==true,()=>true);assert.equal(calls,1);assert.equal(retainedCurrent(),false,'completed operation releases its identity proof');assert.deepEqual(f.eventCounts(),events,'all scoped identity/event listeners are released');assert.deepEqual(f.disk,before,'injected operation verifies wiring only, never native write behavior');assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
test('same stable identity is locked across views and alternate displayed paths until a failed operation releases it',async()=>{
 const f=await flagHostFixture(),gate=deferred(),events=f.eventCounts();let calls=0,firstCurrent:()=>boolean=()=>false;
 f.app.collectionFlagOperation=async(_app:unknown,_file:unknown,_identity:unknown,_field:unknown,_value:unknown,current:()=>boolean)=>{calls++;if(calls===1){firstCurrent=current;await gate.promise;throw Error('injected flag failure');}assert.equal(current(),true);};
 const first=f.view.host.setFlag!(f.record,'pinned',true,()=>true);const firstRejected=assert.rejects(first,/injected flag failure/);await until(()=>calls===1);assert.equal(firstCurrent(),true);
 const second=await f.open(f.window());assert.equal(firstCurrent(),false,'navigation invalidation does not prematurely release the in-flight identity lock');await assert.rejects(second.host.setFlag!({...f.record,path:'Notes/stale-display-path.md'},'archived',true,()=>true),/正在更新/);assert.equal(calls,1);
 gate.resolve();await firstRejected;assert.deepEqual(f.eventCounts(),events);await second.host.setFlag!(f.record,'archived',true,()=>true);assert.equal(calls,2,'the failed operation releases the lock for another owning view');assert.deepEqual(f.eventCounts(),events);assert.equal(f.counts().mutations,0);second.host.release?.();f.view.host.release?.();
});
test('failure before the injected writer is reached releases the identity lock and watcher',async()=>{
 const f=await flagHostFixture(),events=f.eventCounts();let calls=0;f.app.collectionFlagOperation=async()=>{calls++;};f.control.readGate=deferred();const before=f.counts().sourceReads;
 const cancelled=f.view.host.setFlag!(f.record,'pinned',true,()=>true),rejection=assert.rejects(cancelled,/页面已变化/);await until(()=>f.counts().sourceReads>before);const other=await f.open();f.activate(f.view.leaf);f.control.readGate.resolve();await rejection;assert.equal(calls,0);assert.deepEqual(f.eventCounts(),events);
 f.control.readGate=undefined;await f.view.host.setFlag!(f.record,'pinned',true,()=>true);assert.equal(calls,1);assert.deepEqual(f.eventCounts(),events);other.host.release?.();f.view.host.release?.();
});
test('duplicate native create before metadata indexing permanently invalidates a delayed flag callback',async()=>{
 const f=await flagHostFixture(),gate=deferred(),events=f.eventCounts(),source=f.disk.get(f.file.path)!;let entered=false,committed=0,current:()=>boolean=()=>false;
 f.app.collectionFlagOperation=async(_app:unknown,_file:unknown,_identity:unknown,_field:unknown,_value:unknown,valid:()=>boolean)=>{entered=true;current=valid;assert.equal(current(),true);await gate.promise;if(!current())throw Error('injected delayed callback cancelled');committed++;};
 const pending=f.view.host.setFlag!(f.record,'archived',true,()=>true),rejection=assert.rejects(pending,/delayed callback cancelled/);await until(()=>entered);
 const duplicate=f.setFile('Notes/unindexed-duplicate.md',source);assert.equal(f.app.metadataCache.getFileCache(duplicate),undefined);assert.equal(f.library().identityForFile(duplicate as any),undefined);f.emit('vault-create',duplicate);assert.equal(current(),false,'Vault create revokes the proof before a duplicate has cached identity');
 f.files.delete(duplicate.path);f.disk.delete(duplicate.path);assert.equal(current(),false,'removing the duplicate cannot revive a queued callback');gate.resolve();await rejection;assert.equal(committed,0);assert.equal(f.disk.get(f.file.path),source);assert.equal(f.counts().mutations,0);assert.deepEqual(f.eventCounts(),events);f.view.host.release?.();
});
for(const phase of ['resolving','writer-callback'] as const)test(`workspace unload revokes setFlag while ${phase} and releases watcher resources`,async()=>{
 const f=await flagHostFixture(),events=f.eventCounts(),source=f.disk.get(f.file.path)!,gate=deferred();let calls=0,committed=0,current:()=>boolean=()=>false;
 f.app.collectionFlagOperation=async(_app:unknown,_file:unknown,_identity:unknown,_field:unknown,_value:unknown,valid:()=>boolean)=>{calls++;current=valid;await gate.promise;if(!current())throw Error('injected unloaded callback cancelled');committed++;};
 const before=f.counts().sourceReads;if(phase==='resolving')f.control.readGate=gate;
 const pending=f.view.host.setFlag!(f.record,'pinned',true,()=>true),rejection=assert.rejects(pending,phase==='resolving'?/页面已变化/:/unloaded callback cancelled/);await until(()=>phase==='resolving'?f.counts().sourceReads>before:calls===1);if(phase==='writer-callback')assert.equal(current(),true);
 f.workspace().onunload();if(phase==='writer-callback')assert.equal(current(),false);gate.resolve();await rejection;assert.equal(calls,phase==='resolving'?0:1);assert.equal(committed,0);assert.equal(f.disk.get(f.file.path),source);assert.deepEqual(f.eventCounts(),events);
 await assert.rejects(f.view.host.setFlag!(f.record,'pinned',true,()=>true),/页面已变化/);assert.equal(calls,phase==='resolving'?0:1);assert.deepEqual(f.eventCounts(),events);f.view.host.release?.();
});

const filtersPath=(f:ReturnType<typeof fixture>)=>`${f.directory}/collection-library/saved-filters.json`;
const batchDirectory=(f:ReturnType<typeof fixture>)=>`${f.directory}/collection-library/batches`;
function batchJournals(f:ReturnType<typeof fixture>){
 return [...f.disk].filter(([path])=>path.startsWith(batchDirectory(f)+'/')&&/^batch-[A-Za-z0-9_-]+\.json$/.test(path.slice(batchDirectory(f).length+1)))
  .map(([path,source])=>({path,value:JSON.parse(source) as collectionBatch.CollectionBatchJournal}));
}
async function batchHostFixture(count=3){
 const f=fixture();
 for(let i=0;i<count;i++){
  const file=f.setFile(`Notes/batch-${i}.md`,model.collectionNoteSource({id:`capture-batch-${String(i).padStart(4,'0')}`,createdAt:'2026-10-13T00:00:00.000Z',body:`独立测试记录 ${i}\r\n正文不得进入批次日志`,tags:['测试']}));f.index(file);
 }
 const view=await f.open(),records=[...await view.host.list()].sort((a,b)=>a.path.localeCompare(b.path));
 assert.equal(records.length,count);return{...f,view,records};
}

test('saved filters synchronize across owning views, survive reopen, and never read note bodies',async()=>{
 const f=fixture(),a=await f.open(),b=await f.open(f.window()),notices:string[]=[];
 a.host.subscribe(kind=>{if(kind==='filters')notices.push('a');});b.host.subscribe(kind=>{if(kind==='filters')notices.push('b');});
 const reads=f.counts().sourceReads,options={query:'#研究 "小屏幕"',includeBody:true,scope:'unplaced' as const,pinnedOnly:true,since:'2026-10-01',until:'2026-10-13'};
 const saved=await b.host.saveFilter!('  研究阅读  ',options,()=>true);options.query='调用者后改';
 assert.deepEqual(notices,['a','b']);assert.equal(saved.name,'研究阅读');assert.equal(saved.options.query,'#研究 "小屏幕"');
 assert.deepEqual((await a.host.savedFilters!()).filters,[saved]);assert.deepEqual((await b.host.savedFilters!()).filters,[saved]);
 saved.options.query='返回对象后改';assert.equal((await a.host.savedFilters!()).filters[0].options.query,'#研究 "小屏幕"');
 const path=filtersPath(f),source=f.disk.get(path)!;assert.deepEqual(Object.keys(JSON.parse(source)),['version','filters']);assert.equal(f.counts().sourceReads,reads);assert.equal(f.counts().creates,0);assert.equal(f.counts().mutations,0);
 a.host.release?.();b.host.release?.();await settleWrites();f.restart();const reopened=await f.open();
 const list=await reopened.host.savedFilters!();assert.equal(list.warning,undefined);assert.equal(list.filters[0].id,saved.id);assert.equal(list.filters[0].options.includeBody,true);assert.equal(f.disk.get(path),source);assert.equal(f.counts().sourceReads,reads);
 await reopened.host.deleteFilter!(saved.id,()=>true);assert.deepEqual((await reopened.host.savedFilters!()).filters,[]);assert.equal(f.counts().sourceReads,reads);reopened.host.release?.();
});
test('saved filter duplicate names and foreign canonical edits are rejected without overwriting either value',async()=>{
 const f=fixture(),view=await f.open(),saved=await view.host.saveFilter!('已有筛选',{query:'one'},()=>true),path=filtersPath(f),confirmed=f.disk.get(path)!;
 await assert.rejects(view.host.saveFilter!('已有筛选',{query:'two'},()=>true),/同名/);assert.equal(f.disk.get(path),confirmed);
 const foreign=JSON.stringify({version:1,filters:[{...saved,name:'外部编辑',options:{query:'external'}}]});f.disk.set(path,foreign);
 await assert.rejects(view.host.saveFilter!('本窗口更新',{query:'mine'},()=>true,saved.id),/其他操作更改|同时发生变化/);
 const list=await view.host.savedFilters!();assert.deepEqual(list.filters,[saved]);assert.match(list.warning!,/仅供查看|更改/);assert.equal(f.disk.get(path),foreign);
 await assert.rejects(view.host.deleteFilter!(saved.id,()=>true),/其他操作更改|同时发生变化/);assert.equal(f.disk.get(path),foreign);assert.equal(f.counts().sourceReads,0);view.host.release?.();
});
test('saved filter first-create collision is exclusive and preserves the competing file',async()=>{
 const f=fixture(),view=await f.open(),path=filtersPath(f),copy=f.app.vault.adapter.copy,foreign=JSON.stringify({version:1,filters:[]});let copies=0;
 f.app.vault.adapter.copy=async(from:string,to:string)=>{copies++;assert.equal(to,path);f.disk.set(to,foreign);return copy(from,to);};
 await assert.rejects(view.host.saveFilter!('竞争创建',{query:'mine'},()=>true),/不一致|already exists/);assert.equal(copies,1);assert.equal(f.disk.get(path),foreign);
 assert.match((await view.host.savedFilters!()).warning!,/核对|变化/);assert.equal(f.counts().sourceReads,0);assert.equal(f.counts().mutations,0);view.host.release?.();
});
test('saved filter atomic callback catches a late foreign edit and never overwrites it',async()=>{
 const f=fixture(),view=await f.open(),saved=await view.host.saveFilter!('确认筛选',{query:'first'},()=>true),path=filtersPath(f);
 const foreign=JSON.stringify({version:1,filters:[{...saved,options:{query:'external-last-moment'}}]});f.control.processExternal=foreign;
 await assert.rejects(view.host.saveFilter!('确认筛选',{query:'local-late'},()=>true,saved.id),/原子更新前变化|不一致/);assert.equal(f.disk.get(path),foreign);assert.equal(f.counts().sourceReads,0);view.host.release?.();
});
test('saved filter navigation before the atomic write preserves the last confirmed selection',async()=>{
 const f=fixture(),view=await f.open(),saved=await view.host.saveFilter!('导航筛选',{query:'before'},()=>true),path=filtersPath(f),before=f.disk.get(path),process=f.app.vault.adapter.process;
 f.app.vault.adapter.process=async(file:string,change:(source:string)=>string)=>{if(file===path){f.activate({});f.activate(view.leaf);}return process(file,change);};
 await assert.rejects(view.host.saveFilter!('导航筛选',{query:'after'},()=>true,saved.id),/页面或操作已变化/);assert.equal(f.disk.get(path),before);assert.equal(f.counts().sourceReads,0);view.host.release?.();
});
test('first saved-filter preparation cancelled before canonical creation leaves no owned pending file that can lock reopening',async()=>{
 const f=fixture(),view=await f.open(),path=filtersPath(f),write=f.app.vault.adapter.write;let pendingPath:string|undefined;
 f.app.vault.adapter.write=async(file:string,source:string)=>{await write(file,source);if(file.startsWith(path+'.pending-')){pendingPath=file;f.activate({});f.activate(view.leaf);}};
 await assert.rejects(view.host.saveFilter!('首次取消',{query:'not-saved'},()=>true),/页面或操作已变化/);assert.ok(pendingPath);assert.equal(f.disk.has(path),false);assert.equal(f.disk.has(pendingPath),false,'verified owned temporary is removable only because canonical creation was never attempted');
 view.host.release?.();await settleWrites();f.restart();const reopened=await f.open(),list=await reopened.host.savedFilters!();assert.deepEqual(list.filters,[]);assert.equal(list.warning,undefined);
 f.app.vault.adapter.write=write;await reopened.host.saveFilter!('明确重试',{query:'saved-now'},()=>true);assert.equal((await reopened.host.savedFilters!()).filters[0].name,'明确重试');assert.equal(f.counts().sourceReads,0);reopened.host.release?.();
});
test('first saved-filter cancellation removes only its verified temporary and preserves unrelated pending material for read-only review',async()=>{
 const f=fixture(),view=await f.open(),path=filtersPath(f),write=f.app.vault.adapter.write,foreign=path+'.pending-external-owner.tmp';let pendingPath:string|undefined;
 f.app.vault.adapter.write=async(file:string,source:string)=>{await write(file,source);if(file.startsWith(path+'.pending-')){pendingPath=file;f.disk.set(foreign,'foreign unconfirmed bytes');f.activate({});f.activate(view.leaf);}};
 await assert.rejects(view.host.saveFilter!('首次取消',{query:'not-saved'},()=>true),/页面或操作已变化/);assert.ok(pendingPath);assert.equal(f.disk.has(pendingPath),false);assert.equal(f.disk.get(foreign),'foreign unconfirmed bytes');assert.equal(f.disk.has(path),false);
 view.host.release?.();await settleWrites();f.restart();const reopened=await f.open(),before=new Map(f.disk),list=await reopened.host.savedFilters!();assert.deepEqual(list.filters,[]);assert.match(list.warning!,/没有可确认的数据/);assert.deepEqual(f.disk,before);reopened.host.release?.();
});
test('saved filter update and removal notify the other view, while a throwing observer cannot report a confirmed save as failure',async()=>{
 const f=fixture(),a=await f.open(),b=await f.open(f.window());let noticed=0;
 a.host.subscribe(kind=>{if(kind==='filters')throw Error('detached observer');});b.host.subscribe(kind=>{if(kind==='filters')noticed++;});
 const saved=await b.host.saveFilter!('跨窗口条件',{query:'old'},()=>true);assert.equal(noticed,1);
 f.activate(a.leaf);const updated=await a.host.saveFilter!('跨窗口条件',{query:'new',scope:'archived'},()=>true,saved.id);assert.equal(updated.id,saved.id);assert.equal(noticed,2);assert.deepEqual((await b.host.savedFilters!()).filters,[updated]);
 await a.host.deleteFilter!(saved.id,()=>true);assert.equal(noticed,3);assert.deepEqual((await b.host.savedFilters!()).filters,[]);assert.equal(f.counts().sourceReads,0);assert.equal(f.counts().creates,0);a.host.release?.();b.host.release?.();
});

test('batch host confirms each running journal before its serial executor and records each receipt before the next item',async()=>{
 const f=await batchHostFixture(),gate=deferred(),progress:collectionBatch.CollectionBatchReport[]=[],calls:string[]=[];let concurrent=0,maximum=0;
 f.app.collectionFlagOperation=async(_app:unknown,file:TFile,identity:CollectionRecord,field:string,value:boolean,current:()=>boolean,expected:boolean)=>{
  concurrent++;maximum=Math.max(maximum,concurrent);const index=calls.length;calls.push(file.path);
  const entries=batchJournals(f);assert.equal(entries.length,1);assert.equal(entries[0].value.phase,'running');
  assert.deepEqual(entries[0].value.items.map(item=>item.status),Array.from({length:3},(_,at)=>at<index?'confirmed':at===index?'running':'not-started'));
  assert.equal(identity.id,f.records[index].id);assert.equal(field,'thoughtspace_archived');assert.equal(value,true);assert.equal(expected,false);assert.equal(current(),true);
  if(index===0)await gate.promise;concurrent--;return{changed:true};
 };
 const pending=f.view.host.batch!({items:f.records,operation:'archive'},()=>true,report=>progress.push(report));
 await until(()=>calls.length===1);await settleWrites();assert.equal(calls.length,1);gate.resolve();const report=await pending;
 assert.equal(maximum,1);assert.deepEqual(calls,f.records.map(record=>record.path));assert.equal(report.phase,'completed');assert.equal(report.counts.confirmed,3);assert.equal(report.readOnly,true);assert.equal(report.journalConfirmed,true);
 assert.deepEqual(batchJournals(f)[0].value.items.map(item=>item.status),['confirmed','confirmed','confirmed']);assert.ok(progress.some(item=>item.counts.running===1));
 const raw=f.disk.get(batchJournals(f)[0].path)!;assert.doesNotMatch(raw,/正文不得进入|"body"|"tags"|"key"/);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
test('batch freezes source identity and target group before any await and persists only target diagnostics',async()=>{
 const f=await batchHostFixture(1),originalRecord={...f.records[0],tags:[...f.records[0].tags]},items=[{...originalRecord,tags:[...originalRecord.tags]}],destination={...target,duplicate:'allow' as const,groups:target.groups.map(group=>({...group}))},seen:{file:TFile;destination:CollectionTarget}[]=[];
 f.bridge.deliver=async(_session:string,file:TFile,chosen:CollectionTarget,current:()=>boolean,beforeStage:()=>void)=>{assert.equal(current(),true);beforeStage();seen.push({file,destination:chosen});return{added:1};};
 const pending=f.view.host.batch!({items,operation:'deliver',target:destination},()=>true,()=>{});
 items[0].path='Notes/changed.md';items[0].id='capture-mutated-after-start';items[0].title='changed';items[0].tags.push('changed');items.length=0;
 destination.key='replacement-token';destination.path='Boards/other.md';destination.title='other';destination.groupId='other';destination.groups[0].id='other';destination.groups[0].title='other';
 const report=await pending;assert.equal(report.phase,'completed');assert.equal(seen.length,1);assert.equal(seen[0].file,f.files.get(originalRecord.path));assert.deepEqual(seen[0].destination,{...target,duplicate:undefined});assert.equal(report.items[0].source.id,originalRecord.id);assert.equal(report.items[0].source.path,originalRecord.path);
 assert.deepEqual(report.target,{name:target.title,path:target.path,groupId:'group',groupName:'阅读'});assert.doesNotMatch(f.disk.get(batchJournals(f)[0].path)!,/target-identity|replacement-token|"key"|"groups"|"tags"/);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
for(const cancellation of ['explicit-stop','navigate-away-return','view-release','workspace-unload'] as const)test(`batch ${cancellation} retains a started receipt and never starts the next record`,async()=>{
 const f=await batchHostFixture(),gate=deferred();let calls=0,valid=true,writerCurrent:()=>boolean=()=>false;
 f.app.collectionFlagOperation=async(_app:unknown,_file:TFile,_record:CollectionRecord,_field:string,_value:boolean,current:()=>boolean)=>{calls++;writerCurrent=current;await gate.promise;return{changed:true};};
 const pending=f.view.host.batch!({items:f.records,operation:'archive'},()=>valid,()=>{});await until(()=>calls===1);assert.equal(writerCurrent(),true);
 if(cancellation==='explicit-stop')valid=false;else if(cancellation==='navigate-away-return'){f.activate({});f.activate(f.view.leaf);}else if(cancellation==='view-release')f.view.host.release?.();else f.workspace().onunload();
 assert.equal(writerCurrent(),false);gate.resolve();const report=await pending;assert.equal(calls,1);assert.equal(report.phase,'cancelled');assert.equal(report.journalConfirmed,true);assert.deepEqual(report.items.map(item=>item.status),['confirmed','not-started','not-started']);assert.deepEqual(batchJournals(f)[0].value.items,report.items);f.view.host.release?.();
});
for(const outcome of ['not-written','unknown','untyped'] as const)test(`batch flag ${outcome} error is preserved and stops the remaining queue`,async()=>{
 const f=await batchHostFixture();let calls=0;
 f.app.collectionFlagOperation=async()=>{calls++;if(calls===1)return{changed:true};const error=Error('injected flag result');if(outcome!=='untyped')Object.assign(error,{outcome});throw error;};
 const report=await f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{}),status=outcome==='not-written'?'not-written':'unknown';
 assert.equal(calls,2);assert.deepEqual(report.items.map(item=>item.status),['confirmed',status,'not-started']);assert.equal(report.phase,status==='unknown'?'review-required':'stopped');assert.equal(report.journalConfirmed,true);assert.equal(report.items[1].message,'injected flag result');f.view.host.release?.();
});
test('batch restore passes the frozen expected archived flag and distinguishes already-present receipts',async()=>{
 const f=await batchHostFixture(2),items=f.records.map(record=>({...record,archived:true}));let calls=0;
 f.app.collectionFlagOperation=async(_app:unknown,_file:TFile,_record:CollectionRecord,field:string,value:boolean,current:()=>boolean,expected:boolean)=>{calls++;assert.equal(field,'thoughtspace_archived');assert.equal(value,false);assert.equal(expected,true);assert.equal(current(),true);return{changed:calls!==1};};
 const report=await f.view.host.batch!({items,operation:'restore'},()=>true,()=>{});assert.deepEqual(report.items.map(item=>item.status),['already-present','confirmed']);assert.equal(report.phase,'completed');assert.ok(report.items.every(item=>item.source.expectedArchived));f.view.host.release?.();
});
for(const changed of ['rename','missing','same-path-replacement'] as const)test(`batch preflight ${changed} cannot reach a writer or retarget a frozen record`,async()=>{
 const f=await batchHostFixture(),first=f.records[0],file=f.files.get(first.path)!;let calls=0;f.app.collectionFlagOperation=async()=>{calls++;return{changed:true};};
 const pending=f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{});
 if(changed==='rename')f.rename(file,'Notes/renamed-after-selection.md');else if(changed==='missing'){f.files.delete(first.path);f.disk.delete(first.path);f.emit('vault-delete',file);}else{
  // Replace during the awaited native identity read, not before the initial
  // lookup; the same original text cannot legitimize a different TFile.
  f.control.afterRead=()=>{f.setFile(first.path,f.disk.get(first.path)!);};
 }
 const report=await pending;assert.equal(calls,0);assert.deepEqual(report.items.map(item=>item.status),['not-written','not-started','not-started']);assert.equal(report.phase,'stopped');assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
test('pending delivery is unknown before any bridge call and reopening history never retries it',async()=>{
 const f=await batchHostFixture();f.control.lockDelivery=true;
 const report=await f.view.host.batch!({items:f.records,operation:'deliver',target},()=>true,()=>{});assert.deepEqual(report.items.map(item=>item.status),['unknown','not-started','not-started']);assert.equal(f.delivered.length,0);assert.match(report.items[0].message!,/尚未确认/);
 f.view.host.release?.();await settleWrites();f.restart();const reopened=await f.open(),before=new Map(f.disk),reads=f.counts().sourceReads;
 const history=await reopened.host.batchReports!();assert.equal(history.reports.length,1);assert.equal(history.reports[0].id,report.id);assert.equal(history.reports[0].readOnly,true);assert.deepEqual(history.reports[0].items,report.items);assert.deepEqual(f.disk,before);assert.equal(f.counts().sourceReads,reads);assert.equal(f.delivered.length,0);reopened.host.release?.();
});
for(const stage of ['before-stage','after-stage'] as const)test(`delivery rejection ${stage} uses the synchronous bridge boundary to classify its outcome`,async()=>{
 const f=await batchHostFixture();let calls=0;
 f.bridge.deliver=async(_session:string,_file:TFile,_destination:CollectionTarget,current:()=>boolean,beforeStage:()=>void)=>{calls++;assert.equal(current(),true);if(stage==='after-stage')beforeStage();throw Error('injected delivery rejection');};
 const report=await f.view.host.batch!({items:f.records,operation:'deliver',target},()=>true,()=>{});assert.equal(calls,1);assert.deepEqual(report.items.map(item=>item.status),[stage==='before-stage'?'not-written':'unknown','not-started','not-started']);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
for(const timing of ['during-identity-read','before-stage'] as const)test(`delivery source modify ${timing} revokes stale proof even with unchanged stat and metadata`,async()=>{
 const f=await batchHostFixture(),file=f.files.get(f.records[0].path)!,cached=f.metadata.get(file),stat={...file.stat},changed=f.disk.get(file.path)!+'\r\n原生继续输入';let bridgeCalls=0,staged=0;
 const modify=()=>{f.disk.set(file.path,changed);f.emit('vault-modify',file);assert.deepEqual(file.stat,stat);assert.equal(f.metadata.get(file),cached);};
 if(timing==='during-identity-read')f.control.afterRead=()=>{f.control.afterRead=undefined;modify();};
 f.bridge.deliver=async(_session:string,_file:TFile,_destination:CollectionTarget,current:()=>boolean,beforeStage:()=>void)=>{bridgeCalls++;assert.equal(current(),true);if(timing==='before-stage')modify();beforeStage();staged++;return{added:1};};
 const report=await f.view.host.batch!({items:f.records,operation:'deliver',target},()=>true,()=>{});assert.equal(bridgeCalls,timing==='during-identity-read'?0:1);assert.equal(staged,0);assert.deepEqual(report.items.map(item=>item.status),['not-written','not-started','not-started']);assert.equal(f.disk.get(file.path),changed);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
test('running-journal failure prevents the external operation and leaves every item not-started',async()=>{
 const f=await batchHostFixture(),process=f.app.vault.adapter.process;let calls=0;f.app.collectionFlagOperation=async()=>{calls++;return{changed:true};};
 f.app.vault.adapter.process=async(path:string,change:(source:string)=>string)=>{const next=change(f.disk.get(path)!);if(path.startsWith(batchDirectory(f)+'/')&&JSON.parse(next).items[0].status==='running')throw Error('running log rejected');return process(path,()=>next);};
 const report=await f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{});assert.equal(calls,0);assert.equal(report.journalConfirmed,false);assert.equal(report.readOnly,true);assert.deepEqual(report.items.map(item=>item.status),['not-started','not-started','not-started']);assert.equal(batchJournals(f)[0].value.phase,'prepared');f.view.host.release?.();
});
test('a batch cancelled after running-log confirmation does not enter the external writer',async()=>{
 const f=await batchHostFixture(),process=f.app.vault.adapter.process;let calls=0;
 f.app.collectionFlagOperation=async()=>{calls++;return{changed:true};};
 f.app.vault.adapter.process=async(path:string,change:(source:string)=>string)=>{const next=await process(path,change);if(path.startsWith(batchDirectory(f)+'/')&&JSON.parse(next).items[0].status==='running'){f.activate({});f.activate(f.view.leaf);}return next;};
 const report=await f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{});assert.equal(calls,0);assert.equal(report.phase,'cancelled');assert.equal(report.journalConfirmed,true);assert.deepEqual(report.items.map(item=>item.status),['not-started','not-started','not-started']);assert.deepEqual(batchJournals(f)[0].value.items,report.items);f.view.host.release?.();
});
test('lost journal acknowledgements with exact readback do not repeat any external operation',async()=>{
 const f=await batchHostFixture(2);let calls=0;f.app.collectionFlagOperation=async()=>{calls++;return{changed:true};};f.control.processFailure='after';
 const report=await f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{});assert.equal(calls,2);assert.equal(report.phase,'completed');assert.equal(report.journalConfirmed,true);assert.deepEqual(report.items.map(item=>item.status),['confirmed','confirmed']);assert.deepEqual(batchJournals(f)[0].value.items,report.items);f.view.host.release?.();
});
test('already-present delivery remains a success without invoking archive or rewriting source notes',async()=>{
 const f=await batchHostFixture(2),beforeNotes=new Map(f.disk);let calls=0;
 f.app.collectionFlagOperation=async()=>{assert.fail('delivery must not archive records');};
 f.bridge.deliver=async(_session:string,_file:TFile,_destination:CollectionTarget,current:()=>boolean,beforeStage:()=>void)=>{assert.equal(current(),true);beforeStage();calls++;return{added:0};};
 const report=await f.view.host.batch!({items:f.records,operation:'deliver',target},()=>true,()=>{});assert.equal(calls,2);assert.equal(report.phase,'completed');assert.equal(report.counts['already-present'],2);for(const[path,source]of beforeNotes)assert.equal(f.disk.get(path),source);assert.equal(f.counts().creates,0);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
for(const invalid of ['missing-path','missing-group'] as const)test(`delivery batch rejects ${invalid} before creating a journal`,async()=>{
 const f=await batchHostFixture(1),destination={...target,...(invalid==='missing-path'?{path:undefined}:{groupId:'missing'})};
 await assert.rejects(f.view.host.batch!({items:f.records,operation:'deliver',target:destination},()=>true,()=>{}),/重新选择有效/);assert.equal(batchJournals(f).length,0);assert.equal(f.delivered.length,0);assert.equal(f.counts().sourceReads,0);f.view.host.release?.();
});
test('receipt-journal failure retains the live confirmed receipt but reopening the on-disk running item is unknown and read-only',async()=>{
 const f=await batchHostFixture(),process=f.app.vault.adapter.process;let calls=0;f.app.collectionFlagOperation=async()=>{calls++;return{changed:true};};
 f.app.vault.adapter.process=async(path:string,change:(source:string)=>string)=>{const next=change(f.disk.get(path)!);if(path.startsWith(batchDirectory(f)+'/')&&JSON.parse(next).items[0].status==='confirmed')throw Error('receipt log rejected');return process(path,()=>next);};
 const report=await f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{});assert.equal(calls,1);assert.equal(report.journalConfirmed,false);assert.equal(report.items[0].status,'confirmed');assert.equal(report.phase,'review-required');assert.equal(batchJournals(f)[0].value.items[0].status,'running');
 f.view.host.release?.();await settleWrites();f.restart();const reopened=await f.open(),before=new Map(f.disk),history=await reopened.host.batchReports!();
 assert.equal(history.reports.length,1);assert.equal(history.reports[0].items[0].status,'unknown');assert.equal(history.reports[0].readOnly,true);assert.match(history.warning!,/不会恢复执行|待核对/);assert.equal(calls,1);assert.deepEqual(f.disk,before);reopened.host.release?.();
});
test('batch history discovers a missing canonical via confirmed previous material without writing or resuming',async()=>{
 const f=await batchHostFixture(1);let calls=0;f.app.collectionFlagOperation=async()=>{calls++;return{changed:true};};
 const report=await f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{}),path=batchJournals(f)[0].path;
 assert.equal(report.phase,'completed');assert.ok([...f.disk.keys()].some(key=>key.startsWith(path+'.previous-')));f.disk.delete(path);
 f.view.host.release?.();await settleWrites();f.restart();const reopened=await f.open(),before=new Map(f.disk),history=await reopened.host.batchReports!();
 assert.equal(history.reports.length,1);assert.equal(history.reports[0].id,report.id);assert.equal(history.reports[0].readOnly,true);assert.equal(history.reports[0].journalConfirmed,false);assert.equal(history.reports[0].items[0].status,'unknown');assert.match(history.warning!,/最后确认材料/);assert.equal(calls,1);assert.deepEqual(f.disk,before);assert.equal(f.disk.has(path),false);reopened.host.release?.();
});
test('batch history reports pending-only material as a warning and does not promote it or create a canonical',async()=>{
 const f=await batchHostFixture(1),directory=batchDirectory(f),path=`${directory}/batch-1760313600000-00000099.json`;f.folders.add(directory);f.disk.set(path+'.pending-00000099-1.tmp','{"unconfirmed":"retained"}');
 const before=new Map(f.disk),history=await f.view.host.batchReports!();assert.deepEqual(history.reports,[]);assert.match(history.warning!,/没有可确认的数据/);assert.deepEqual(f.disk,before);assert.equal(f.delivered.length,0);f.view.host.release?.();
});
test('a second view cannot begin a new batch while the first receipt is pending, but can start a separate journal afterward',async()=>{
 const f=await batchHostFixture(1),gate=deferred();let calls=0;f.app.collectionFlagOperation=async()=>{calls++;if(calls===1)await gate.promise;return{changed:true};};
 const pending=f.view.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{});await until(()=>calls===1);const other=await f.open(f.window());
 await assert.rejects(other.host.batch!({items:f.records,operation:'archive'},()=>true,()=>{}),/另一批整理仍在执行/);assert.equal(batchJournals(f).length,1);gate.resolve();const first=await pending;
 const second=await other.host.batch!({items:f.records,operation:'restore'},()=>true,()=>{});assert.equal(calls,2);assert.notEqual(first.id,second.id);assert.equal(batchJournals(f).length,2);assert.equal(first.items[0].status,'confirmed');other.host.release?.();f.view.host.release?.();
});
for(const result of ['confirmed','unknown','cancelled'] as const)test(`batch ${result} broadcasts fresh read-only history to another view even when an observer throws`,async()=>{
 const f=await batchHostFixture(),other=await f.open(f.window()),gate=deferred();let calls=0,valid=true,notifications=0,reloaded:ReturnType<NonNullable<CollectionViewHost['batchReports']>>|undefined;
 f.view.host.subscribe(kind=>{if(String(kind)==='batches')throw Error('detached batch observer');});
 other.host.subscribe(kind=>{if(String(kind)==='batches'){notifications++;reloaded=other.host.batchReports!();}});f.activate(f.view.leaf);
 f.app.collectionFlagOperation=async()=>{calls++;if(calls===1)await gate.promise;if(result==='unknown')throw Object.assign(Error('uncertain flag'),{outcome:'unknown'});return{changed:true};};
 const pending=f.view.host.batch!({items:f.records,operation:'archive'},()=>valid,()=>{});await until(()=>calls===1);
 const during=await other.host.batchReports!();assert.equal(during.reports[0].items[0].status,'unknown','loading a live running journal is observational and must not claim its receipt');
 if(result==='cancelled')valid=false;gate.resolve();const report=await pending;assert.equal(notifications,1);assert.ok(reloaded);
 const history=await reloaded;assert.equal(history.reports.length,1);assert.equal(history.reports[0].readOnly,true);assert.deepEqual(history.reports[0].items,report.items);assert.equal(history.reports[0].phase,report.phase);assert.equal(calls,result==='confirmed'?3:1);other.host.release?.();f.view.host.release?.();
});

async function pendingSingleDeliveryFixture(){
 const f=await batchHostFixture(1),record=f.records[0],file=f.files.get(record.path)!;
 f.control.deliveryFailure=true;await assert.rejects(f.view.host.deliver(record,target,()=>true),/board failed/);
 assert.equal(f.delivered.length,1);assert.equal(f.control.lockDelivery,true);f.control.deliveryFailure=false;
 return{...f,record,file};
}
test('explicit single-record pending delivery retry follows a verified same-identity rename and preserves its session and source',async()=>{
 const f=await pendingSingleDeliveryFixture(),source=f.disk.get(f.file.path)!,oldPath=f.record.path,sessions:string[]=[];
 f.rename(f.file,'Notes/用户在失败保存后改名.md');f.bridge.deliveryLocked=(session:string)=>{sessions.push(session);return session===`record:${f.record.id}`&&f.control.lockDelivery===true;};
 const result=await f.view.host.deliver(f.record,target,()=>true);assert.deepEqual(result,{added:1});assert.equal(f.delivered.length,2);assert.equal(f.delivered[1].session,`record:${f.record.id}`);assert.equal(f.delivered[1].file,f.file);assert.equal(f.delivered[1].target,target);
 assert.equal(f.record.path,oldPath,'the stale displayed record is not rewritten to authorize a different operation');assert.equal(f.delivered[1].file.path,'Notes/用户在失败保存后改名.md');assert.deepEqual(sessions,[`record:${f.record.id}`]);assert.equal(f.disk.get(f.file.path),source);assert.equal(f.disk.has(oldPath),false);assert.equal(f.control.lockDelivery,false);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
for(const pending of ['none','other-session'] as const)test(`single delivery with ${pending} pending receipt still rejects a stale renamed card path`,async()=>{
 const f=await batchHostFixture(1),record=f.records[0],file=f.files.get(record.path)!,before=f.disk.get(file.path);
 f.rename(file,'Notes/普通卡片旧路径.md');f.bridge.deliveryLocked=(session:string)=>pending==='other-session'&&session==='record:capture-some-other-record';
 await assert.rejects(f.view.host.deliver(record,target,()=>true),/原笔记已变化/);assert.equal(f.delivered.length,0);assert.equal(f.disk.get(file.path),before);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
for(const change of ['identity-id','identity-created-at','duplicate','duplicate-id-different-time'] as const)test(`pending single retry rejects ${change} after rename without invoking the bridge again`,async()=>{
 const f=await pendingSingleDeliveryFixture();f.rename(f.file,'Notes/待确认原笔记改名.md');const source=f.disk.get(f.file.path)!;
 if(change==='identity-id'){f.disk.set(f.file.path,source.replace(f.record.id,'capture-replaced-identity'));f.index(f.file);}
 else if(change==='identity-created-at'){f.disk.set(f.file.path,source.replace(f.record.createdAt,'2026-10-12T00:00:00.000Z'));f.index(f.file);}
 else{const duplicate=f.setFile('Notes/待确认标识副本.md',change==='duplicate'?source:source.replace(f.record.createdAt,'2026-10-12T00:00:00.000Z'));f.index(duplicate);}
 const before=new Map(f.disk);await assert.rejects(f.view.host.deliver(f.record,target,()=>true),/原笔记|重复的收集标识/);assert.equal(f.delivered.length,1);assert.equal(f.control.lockDelivery,true);assert.deepEqual(f.disk,before);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
for(const change of ['rename-again','source-modify','same-path-replacement'] as const)test(`pending renamed single retry rejects ${change} during awaited identity resolution`,async()=>{
 const f=await pendingSingleDeliveryFixture();f.rename(f.file,'Notes/初次改名.md');f.control.readGate=deferred();const reads=f.counts().sourceReads;
 const request=f.view.host.deliver(f.record,target,()=>true),rejected=assert.rejects(request,/原笔记|移除|替换/);await until(()=>f.counts().sourceReads>reads);
 if(change==='rename-again')f.rename(f.file,'Notes/解析期间再次改名.md');else if(change==='source-modify'){f.disk.set(f.file.path,f.disk.get(f.file.path)!+'\r\n原生同步保存的新文字');f.emit('vault-modify',f.file);}else{const replacement=f.setFile(f.file.path,f.disk.get(f.file.path)!);f.index(replacement);}
 const before=new Map(f.disk);f.control.readGate.resolve();await rejected;assert.equal(f.delivered.length,1);assert.equal(f.control.lockDelivery,true);assert.deepEqual(f.disk,before);assert.equal(f.counts().mutations,0);f.view.host.release?.();
});
test('a renamed record with a pending single receipt stays unknown in batch and never retries the delivery bridge',async()=>{
 const f=await pendingSingleDeliveryFixture();f.rename(f.file,'Notes/待确认批量不得重试.md');const calls=f.delivered.length,reads=f.counts().sourceReads,before=f.disk.get(f.file.path);
 const report=await f.view.host.batch!({items:[f.record],operation:'deliver',target},()=>true,()=>{});assert.equal(report.phase,'review-required');assert.equal(report.items[0].status,'unknown');assert.match(report.items[0].message!,/尚未确认的投递/);assert.equal(f.delivered.length,calls);assert.equal(f.counts().sourceReads,reads,'pending batch stops before source resolution or writing');assert.equal(f.control.lockDelivery,true);assert.equal(f.disk.get(f.file.path),before);f.view.host.release?.();
});

type DeliveryFixture=Awaited<ReturnType<typeof batchHostFixture>>;
async function deliveryWithAwaitedEvent(mode:'single'|'batch',event:(f:DeliveryFixture)=>void,allowed:boolean){
 const f=await batchHostFixture(1),reads=f.counts().sourceReads;f.control.readGate=deferred();
 const operation=mode==='single'?f.view.host.deliver(f.records[0],target,()=>true):f.view.host.batch!({items:f.records,operation:'deliver',target},()=>true,()=>{});
 const observed=operation.then(result=>({result,error:undefined}),error=>({result:undefined,error}));
 await until(()=>f.counts().sourceReads>reads);event(f);const afterEvent=new Map(f.disk);f.control.readGate.resolve();const outcome=await observed;
 if(mode==='single'){
  if(allowed){assert.equal(outcome.error,undefined);assert.deepEqual(outcome.result,{added:1});}
  else{assert.ok(outcome.error instanceof Error);assert.match(outcome.error.message,/原笔记|页面已变化|移除|替换/);}
 }else{
  assert.equal(outcome.error,undefined);const report=outcome.result as collectionBatch.CollectionBatchReport;
  assert.equal(report.phase,allowed?'completed':'stopped');assert.equal(report.items[0].status,allowed?'confirmed':'not-written');assert.equal(report.journalConfirmed,true);
 }
 assert.equal(f.delivered.length,allowed?1:0);assert.equal(f.counts().mutations,0);for(const[path,source]of afterEvent)if(!path.startsWith(batchDirectory(f)+'/'))assert.equal(f.disk.get(path),source);f.view.host.release?.();
}
for(const mode of ['single','batch'] as const){
 for(const directory of ['ThoughtSpace/白板搜索','ThoughtSpace-plugin-backups/20261013'] as const){
  for(const kind of ['create','modify','metadata'] as const)test(`${mode} delivery ignores excluded ${directory} Markdown ${kind} during source resolution`,async()=>{
   await deliveryWithAwaitedEvent(mode,f=>{
    // Backups can contain the same capture envelope. Their identity is excluded
    // from discovery and must not revoke an unrelated native source proof.
    const record=f.records[0],file=f.setFile(`${directory}/索引或备份.md`,f.disk.get(record.path)!);
    f.metadata.set(file,{frontmatter:{thoughtspace_capture:record.id,thoughtspace_created:record.createdAt}});
    f.emit(kind==='metadata'?'metadata-changed':`vault-${kind}`,file);
   },true);
  });
 }
 for(const path of ['ThoughtSpace/白板搜索','ThoughtSpace/白板搜索/新子目录','ThoughtSpace-plugin-backups','ThoughtSpace-plugin-backups/20261013'] as const)test(`${mode} delivery ignores excluded folder creation ${path} during source resolution`,async()=>{
  await deliveryWithAwaitedEvent(mode,f=>{f.folders.add(path);f.emit('vault-create',{path});},true);
 });
 for(const kind of ['create','modify','metadata'] as const)test(`${mode} delivery still rejects ordinary user Markdown ${kind} during source resolution`,async()=>{
  await deliveryWithAwaitedEvent(mode,f=>{const file=f.setFile('Notes/普通用户笔记.md','原生笔记正文');f.emit(kind==='metadata'?'metadata-changed':`vault-${kind}`,file);},false);
 });
 test(`${mode} delivery still rejects an ordinary user folder creation during source resolution`,async()=>{
  await deliveryWithAwaitedEvent(mode,f=>{f.folders.add('Notes/用户新文件夹');f.emit('vault-create',{path:'Notes/用户新文件夹'});},false);
 });
 for(const directory of ['ThoughtSpace/白板搜索','ThoughtSpace-plugin-backups/20261013'] as const){
  test(`${mode} delivery rejects excluded Markdown renamed from ${directory} into the workspace`,async()=>{
   await deliveryWithAwaitedEvent(mode,f=>{const file=f.setFile(`${directory}/移入笔记.md`,'原生正文');f.rename(file,'Notes/后台移入的笔记.md');},false);
  });
  test(`${mode} delivery rejects excluded folder renamed from ${directory} into the workspace`,async()=>{
   await deliveryWithAwaitedEvent(mode,f=>{f.emit('vault-rename',{path:'Notes/从内部移入的文件夹'},`${directory}/内部目录`);},false);
  });
  test(`${mode} delivery rejects its source renamed into excluded ${directory} during resolution`,async()=>{
   await deliveryWithAwaitedEvent(mode,f=>{f.rename(f.files.get(f.records[0].path)!,`${directory}/原记录移入.md`);},false);
  });
 }
}
