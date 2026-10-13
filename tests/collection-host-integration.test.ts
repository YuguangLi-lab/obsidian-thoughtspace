/// <reference types="obsidian" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as recovery from '../src/collection-recovery';
import * as journalStore from '../src/collection-journal-store';
import * as model from '../src/collection-model';
import * as tags from '../src/native-tags';
import * as workspaceFiles from '../src/workspace';
import type {CollectionViewHost,CollectionTarget} from '../src/collection-view';

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
const obsidian={Component,TFile,FuzzySuggestModal,normalizePath:(path:string)=>path.replace(/\\/g,'/').replace(/\/+/g,'/').replace(/\/$/,''),parseYaml,getAllTags:(cache:any)=>Array.isArray(cache.frontmatter?.tags)?cache.frontmatter.tags.map((tag:string)=>`#${tag}`):[]};
function load<T>(path:string,dependencies:Record<string,unknown>):T {
 const module={exports:{}};
 const code=transformSync(readFileSync(path,'utf8'),{loader:'ts',format:'cjs'}).code;
 new Function('require','module','exports',code)((name:string)=>{if(!Object.hasOwn(dependencies,name))throw Error(`Unmocked dependency: ${name}`);return dependencies[name];},module,module.exports);
 return module.exports as T;
}
const libraryModule=load<typeof import('../src/collection-library')>('src/collection-library.ts',{'obsidian':obsidian,'./collection-model':model,'./workspace':workspaceFiles});
const hostModule=load<typeof import('../src/collection-host')>('src/collection-host.ts',{'obsidian':obsidian,'./collection-recovery':recovery,'./collection-model':model,'./collection-library':libraryModule,'./collection-journal-store':journalStore,'./native-tags':tags,'./workspace':workspaceFiles,'./board-modal-viewport':{bindBoardModalViewport:()=>()=>{}}});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
async function until(check:()=>boolean){for(let i=0;i<1000&&!check();i++)await Promise.resolve();assert.ok(check(),'asynchronous checkpoint reached');}
async function settleWrites(){for(let i=0;i<400;i++)await Promise.resolve();}
const target:CollectionTarget={key:'target-identity',title:'研究白板',groups:[{id:'group',title:'阅读'}],groupId:'group'};
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
    rename:async(from:string,to:string)=>{if(control.renameFailure==='before')throw Error('rename rejected');if(!disk.has(from))throw Error('rename source missing');if(control.noOverwriteRename&&disk.has(to))throw Error('rename cannot replace existing target');disk.set(to,disk.get(from)!);disk.delete(from);if(control.renameFailure==='after')throw Error('rename response lost');},
    remove:async(path:string)=>{disk.delete(path);},
   },
   read:async(file:TFile)=>{sourceReads++;await control.readGate?.promise;control.afterRead?.();if(!disk.has(file.path))throw Error('native note missing');return disk.get(file.path)!;},
   create:async(path:string,source:string)=>{creates++;createdPaths.push(path);await control.createGate?.promise;if(control.createFailure==='before')throw Error('native create rejected');if(disk.has(path))throw Error('native create collision');const file=setFile(path,source,!control.lagFileCache);emit('vault-create',file);control.afterCreate?.(file);if(control.createFailure==='after'||control.lagFileCache)throw Error('native create response lost');return file;},
   modify:async()=>{mutations++;throw Error('Unexpected native modify');},process:async()=>{mutations++;throw Error('Unexpected native process');},rename:async()=>{mutations++;throw Error('Unexpected native rename');},
  },
  metadataCache:{getFileCache:(file:TFile)=>metadata.get(file),on:(name:string,callback:any)=>on(`metadata-${name}`,callback)},
  fileManager:{generateMarkdownLink:(file:TFile,source:string)=>{links.push({file,source});return`[[${file.path}]]`;},processFrontMatter:async()=>{mutations++;throw Error('Unexpected property rewrite');}},
  workspace:{get activeLeaf(){return active;},getMostRecentLeaf:()=>active,on,offref:(ref:any)=>events.get(ref.name)?.delete(ref.callback)},
 };
 const bridge:any={
  directory,folder:()=> 'Notes',newId:()=>String(++uid).padStart(8,'0'),
  ensureFolder:async(path:string)=>{ensureCalls++;await control.ensureGate?.promise;if(control.ensureFailure)throw Error('folder creation failed');folders.add(path);},
  pickTarget:(_doc:unknown,current:()=>boolean)=>({result:Promise.resolve(current()?target:undefined),close(){}}),
  deliver:async(session:string,file:TFile,destination:CollectionTarget,current:()=>boolean)=>{assert.ok(current());delivered.push({session,file,target:destination});if(control.deliveryFailure){control.lockDelivery=true;throw Error('board failed');}control.lockDelivery=false;return{added:1};},
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
