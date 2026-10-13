import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as search from '../src/native-search';
import {emptyBoard,clone,type Board} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {isBoardPath} from '../src/board-path';
import {createMarkdownBoardDocument,isMarkdownBoardFrontmatter,readBoardDocument,type YamlParser} from '../src/board-document';

const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:YamlParser}).load;
const vaultName='原生库',sourcePath='白板/可检索材料.md';
function value(){const board=emptyBoard();board.version=3;board.nodes=[{id:'hit',kind:'text',text:'节点命中内容',x:0,y:0,width:200,height:80,color:'green'}];return board;}
function fixture(){
 const source=readFileSync('src/main.ts','utf8'),begin=source.indexOf('  private setupBoardSearch()'),end=source.indexOf('  async ensureDock(',begin),readBegin=source.indexOf('  async readBoard(file: TFile)'),readEnd=source.indexOf('\n  async boardGraph(',readBegin),classification=source.slice(source.indexOf('function isBoardFile('),source.indexOf('\nconst report ='));
 assert.ok(begin>0&&end>begin&&readBegin>0&&readEnd>readBegin,'actual main search and source validation methods must be available');
 let fileClock=0;
 class TFile{extension:string;stat:{mtime:number};constructor(public path:string){this.extension=path.split('.').pop()!;this.stat={mtime:++fileClock};}}
 const files=new Map<string,TFile>(),content=new Map<string,string>(),tasks:Promise<unknown>[]=[],errors:unknown[]=[],notices:string[]=[],warnings:unknown[][]=[],opened:string[]=[],revealed:string[]=[],states:unknown[]=[],writes:string[]=[],removed:string[]=[],reads:string[]=[],cleanup:(()=>void)[]=[],vaultEvents=new Map<string,Function>(),workspaceEvents=new Map<string,Function>(),ready:Function[]=[];
 const missingCache=new Map<TFile,null|undefined>(),metadataEvents=new Map<string,Function>(),timers=new Set<number>();
 const subscribe=(events:Map<string,Function>,name:string,fn:Function)=>{events.set(name,fn);return{dispose:()=>{if(events.get(name)===fn)events.delete(name);}};};
 let frames=0,timerId=0,active:any,plugin:any,readHook:((file:TFile)=>Promise<string>)|undefined;
 const add=(path:string,text:string)=>{const file=new TFile(path);files.set(path,file);content.set(path,text);return file;};
 const disk=(file:TFile)=>{const text=content.get(file.path);if(text===undefined)throw Error('File disappeared');return text;};
 const frontmatter=(file:TFile)=>{const match=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(content.get(file.path)||'');try{return match?parseYaml(match[1]):undefined;}catch{return undefined;}};
 class BoardView{closed=false;constructor(public file:TFile,public session:{board:Board}){}revealNode(id:string){revealed.push(id);}}
 const leaf:any={view:null,async setViewState(state:{type:string;state:{file:string;tsSearchRedirect?:boolean}}){states.push(state);opened.push(state.state.file);const file=files.get(state.state.file);assert.ok(file);active=new BoardView(file,{board:await plugin.readBoard(file)});leaf.view=active;}};
 class MarkdownView{leaf=leaf;draft:string;constructor(public file:TFile,public line:number){this.draft=disk(file);}editor={getValue:()=>this.draft,getCursor:()=>({line:this.line})};getEphemeralState(){return{line:this.line};}}
 const app={
  metadataCache:{getFileCache:(file:TFile)=>missingCache.has(file)?missingCache.get(file):{frontmatter:frontmatter(file)},on:(name:string,fn:Function)=>subscribe(metadataEvents,name,fn)},
  workspace:{on:(name:string,fn:Function)=>subscribe(workspaceEvents,name,fn),onLayoutReady:(fn:Function)=>ready.push(fn),getActiveFile:()=>active?.file,getActiveViewOfType:(type:any)=>active instanceof type?active:null},
  vault:{getName:()=>vaultName,getAbstractFileByPath:(path:string)=>files.get(path),getFiles:()=>[...files.values()],on:(name:string,fn:Function)=>subscribe(vaultEvents,name,fn),read:async(file:TFile)=>{reads.push(file.path);return disk(file);},cachedRead:async(file:TFile)=>{reads.push(file.path);return readHook?readHook(file):disk(file);},process:async(file:TFile,fn:(text:string)=>string)=>{content.set(file.path,fn(disk(file)));file.stat.mtime=++fileClock;writes.push(file.path);},create:async(path:string,text:string)=>{assert.equal(files.has(path),false);const file=add(path,text);writes.push(path);return file;}},
  fileManager:{trashFile:async(file:TFile)=>{removed.push(file.path);files.delete(file.path);content.delete(file.path);}}
 };
 const act=(run:()=>unknown)=>{tasks.push(Promise.resolve().then(run).catch(error=>{errors.push(error);}));};
 const deps={...search,readBoardDocument,isMarkdownBoardFrontmatter,isBoardPath,isWorkspaceFile,parseYaml,clone,TFile,MarkdownView,BoardView,EXT:'thoughtspace',VIEW:'thoughtspace-board',window:{setTimeout:()=>{timers.add(++timerId);return timerId;},clearTimeout:(id:number)=>timers.delete(id),requestAnimationFrame:(fn:()=>void)=>{frames++;fn();return frames;}},Notice:class{constructor(message:string){notices.push(message);}},console:{warn:(...args:unknown[])=>warnings.push(args)},act};
 const Plugin=new Function(...Object.keys(deps),transformSync(classification+'\nclass Plugin{'+source.slice(readBegin,readEnd)+source.slice(begin,end)+'};return Plugin',{loader:'ts'}).code)(...Object.values(deps));
 plugin=new Plugin();Object.assign(plugin,{app,settings:{},sessions:new Map(),searchNavigationSequence:0,searchNavigationStopped:false,registerEvent(ref:{dispose:()=>void}){cleanup.push(ref.dispose);},register(fn:()=>void){cleanup.push(fn);},addCommand(){},folder:async()=>{}});plugin.setupBoardSearch();
 const setActive=(file:TFile,line=1)=>{active=new MarkdownView(file,line);leaf.view=active;return active as MarkdownView;};
 async function settle(){let complete=0;while(complete<tasks.length){const batch=tasks.slice(complete);complete=tasks.length;await Promise.all(batch);}await plugin.searchSync.flush();}
 async function click(file:TFile,line=1){setActive(file,line);workspaceEvents.get('file-open')?.(file);await settle();}
 async function emit(name:string,file:TFile,old?:string){vaultEvents.get(name)?.(file,old);await plugin.searchSync.flush();await settle();}
 function notifyMetadataChanged(file:TFile){missingCache.delete(file);metadataEvents.get('changed')?.(file);}
 async function metadataChanged(file:TFile){notifyMetadataChanged(file);await plugin.searchSync.flush();await settle();}
 function rename(file:TFile,path:string){const old=file.path,text=disk(file);files.delete(old);content.delete(old);file.path=path;file.extension=path.split('.').pop()!;files.set(path,file);content.set(path,text);return old;}
 return {plugin,add,files,content,errors,notices,warnings,opened,revealed,states,writes,removed,reads,cleanup,ready,setActive,click,emit,metadataChanged,notifyMetadataChanged,settle,rename,metadataSubscribed:()=>metadataEvents.has('changed'),timerCount:()=>timers.size,frames:()=>frames,leave:()=>{active=undefined;},setMissingCache:(file:TFile,cache:null|undefined)=>{missingCache.set(file,cache);},setReadHook:(hook:((file:TFile)=>Promise<string>)|undefined)=>{readHook=hook;},delete:(file:TFile)=>{files.delete(file.path);content.delete(file.path);}};
}
function withBoard(board=value()){
 const f=fixture(),source=f.add(sourcePath,createMarkdownBoardDocument(board,'材料')),text=search.boardSearchDocument(board,source.path,vaultName),index=f.add(search.searchIndexPath(source.path),text);
 return {...f,source,index,text,line:text.split('\n').indexOf('节点命中内容')};
}

test('ordinary Markdown search hits keep the native Markdown view and perform no board read',async()=>{
 const f=fixture(),note=f.add('笔记/普通.md','---\ntags: [材料]\n---\n\n正文 thoughtspace: board 不构成白板');await f.click(note);assert.deepEqual(f.opened,[]);assert.deepEqual(f.reads,[]);assert.equal(f.frames(),0);assert.deepEqual(f.errors,[]);
});
test('real marked Markdown source search hits stay in the native Markdown view',async()=>{
 const f=withBoard();await f.click(f.source);assert.deepEqual(f.opened,[]);assert.deepEqual(f.reads,[]);assert.equal(f.frames(),0);
});
test('verified derived Markdown mirrors open the source board and reveal the matching node',async()=>{
 const f=withBoard();await f.click(f.index,f.line);assert.deepEqual(f.opened,[f.source.path]);assert.deepEqual(f.revealed,['hit']);assert.deepEqual(f.states,[{type:'thoughtspace-board',state:{file:f.source.path,tsSearchRedirect:true}}]);assert.deepEqual(f.errors,[]);
});
test('an empty Markdown board mirror resolves the board without an unrelated node selection',async()=>{
 const f=withBoard(emptyBoard());await f.click(f.index,1);assert.deepEqual(f.opened,[sourcePath]);assert.deepEqual(f.revealed,[]);assert.deepEqual(f.errors,[]);
});
test('ordinary notes named like derived mirrors are neither redirected nor recycled',async()=>{
 const f=fixture(),note=f.add(`${search.SEARCH_FOLDER}/ordinary.md.md`,'---\nthoughtspace: board\n---\n\nAn ordinary Markdown file without a generated mirror marker');await f.click(note);f.plugin.rebuildBoardSearch();await f.settle();assert.deepEqual(f.opened,[]);assert.deepEqual(f.removed,[]);assert.deepEqual(f.writes,[]);assert.equal(f.files.get(note.path),note);
});
test('copied, modified and unsaved derived Markdown mirrors cannot redirect native search',async()=>{
 const copied=withBoard(),wrong=copied.add(search.searchIndexPath('白板/另一份.md'),copied.text);await copied.click(wrong);assert.deepEqual(copied.opened,[]);
 const edited=withBoard();edited.content.set(edited.index.path,edited.text+'manual edit');await edited.click(edited.index);assert.deepEqual(edited.opened,[]);
 const unsaved=withBoard(),view=unsaved.setActive(unsaved.index,unsaved.line);view.draft+='unsaved';await unsaved.plugin.openSearchResult(unsaved.index);assert.deepEqual(unsaved.opened,[]);
});
test('a source converted to ordinary Markdown is not opened as a board through its old mirror',async()=>{
 const f=withBoard();f.content.set(f.source.path,'# 普通材料\n\n原正文');await f.click(f.index,f.line);assert.deepEqual(f.opened,[]);assert.equal(f.errors.length,1);assert.match(String(f.errors[0]),/YAML|thoughtspace/);assert.equal(f.content.get(f.source.path),'# 普通材料\n\n原正文');
});
test('marked Markdown with damaged layout preserves its mirror and fails navigation safely',async()=>{
 const f=withBoard(),broken=f.content.get(f.source.path)!.replace('<!-- thoughtspace-board-layout:end -->','<!-- thoughtspace-board-layout:broken -->');f.content.set(f.source.path,broken);await f.click(f.index,f.line);await f.emit('modify',f.source);assert.deepEqual(f.opened,[]);assert.equal(f.errors.length,1);assert.equal(f.warnings.length,1);assert.equal(f.content.get(f.index.path),f.text);assert.equal(f.content.get(f.source.path),broken);assert.deepEqual(f.removed,[]);assert.deepEqual(f.writes,[]);
});
test('an already loaded source session does not bypass current damaged Markdown layout validation',async()=>{
 const f=withBoard(),broken=f.content.get(f.source.path)!.replace('<!-- thoughtspace-board-layout:end -->','<!-- thoughtspace-board-layout:broken -->');f.plugin.sessions.set(f.source,Promise.resolve({board:value()}));f.content.set(f.source.path,broken);await f.click(f.index,f.line);assert.deepEqual(f.opened,[]);assert.equal(f.errors.length,1);assert.equal(f.content.get(f.source.path),broken);
});
test('a loaded session cannot redirect a source whose Markdown board marker was removed',async()=>{
 const f=withBoard(),ordinary='# 普通 Markdown\n\n已经移除白板属性';f.plugin.sessions.set(f.source,Promise.resolve({board:value()}));f.content.set(f.source.path,ordinary);await f.click(f.index,f.line);assert.deepEqual(f.opened,[]);assert.equal(f.errors.length,1);assert.equal(f.content.get(f.source.path),ordinary);
});
test('deleted source navigation keeps the mirror accessible and reports the missing board',async()=>{
 const f=withBoard();f.delete(f.source);await f.click(f.index,f.line);assert.deepEqual(f.opened,[]);assert.equal(f.notices.length,1);assert.match(f.notices[0],/移动或删除/);assert.equal(f.files.get(f.index.path),f.index);
});
test('search rebuild creates both board formats and leaves ordinary Markdown source text intact',async()=>{
 const f=fixture(),md=f.add(sourcePath,createMarkdownBoardDocument(value(),'材料')),legacy=f.add('白板/旧.thoughtspace',JSON.stringify(value())),note=f.add('普通.md','# Native note');f.plugin.rebuildBoardSearch();await f.settle();assert.ok(search.isManagedSearchIndex(f.content.get(search.searchIndexPath(md.path))!));assert.ok(search.isManagedSearchIndex(f.content.get(search.searchIndexPath(legacy.path))!));assert.equal(f.files.has(search.searchIndexPath(note.path)),false);assert.equal(f.content.get(note.path),'# Native note');assert.deepEqual(f.errors,[]);
});
test('creating and modifying ordinary Markdown never creates a generated mirror',async()=>{
 const f=fixture(),note=f.add('普通.md','正文');await f.emit('create',note);f.content.set(note.path,'最新正文');await f.emit('modify',note);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);assert.equal(f.content.get(note.path),'最新正文');assert.equal(f.files.has(search.searchIndexPath(note.path)),false);
});
test('renaming a marked Markdown source recycles its old mirror and binds a new mirror to the new path',async()=>{
 const f=withBoard(),original=f.content.get(f.source.path),old=f.rename(f.source,'白板/重命名材料.md');await f.emit('rename',f.source,old);assert.deepEqual(f.removed,[search.searchIndexPath(old)]);const target=search.searchIndexPath(f.source.path),text=f.content.get(target)!;assert.equal(search.searchBoardPath(target,text),f.source.path);assert.equal(f.content.get(f.source.path),original);assert.deepEqual(f.warnings,[]);assert.deepEqual(f.errors,[]);
});
test('deletion recycles a managed Markdown mirror and preserves a manually edited mirror',async()=>{
 const managed=withBoard();managed.delete(managed.source);await managed.emit('delete',managed.source);assert.deepEqual(managed.removed,[managed.index.path]);
 const edited=withBoard();edited.content.set(edited.index.path,edited.text+'manual edit');edited.delete(edited.source);await edited.emit('delete',edited.source);assert.deepEqual(edited.removed,[]);assert.equal(edited.content.get(edited.index.path),edited.text+'manual edit');assert.equal(edited.warnings.length,1);
});
test('rebuild cleans a verified Markdown orphan and retains an unverified mirror-looking note',async()=>{
 const f=withBoard();f.delete(f.source);const ordinary=f.add(`${search.SEARCH_FOLDER}/plain.md.md`,'ordinary note');f.plugin.rebuildBoardSearch();await f.settle();assert.deepEqual(f.removed,[f.index.path]);assert.equal(f.content.get(ordinary.path),'ordinary note');assert.deepEqual(f.errors,[]);
});
test('removing the board marker recycles its old mirror while preserving the converted note',async()=>{
 const f=withBoard(),ordinary=f.content.get(f.source.path)!.replace('thoughtspace: board','thoughtspace: archive');f.content.set(f.source.path,ordinary);await f.emit('modify',f.source);assert.deepEqual(f.removed,[f.index.path]);assert.equal(f.content.get(f.source.path),ordinary);assert.deepEqual(f.writes,[]);
});
test('disabled Markdown search integration neither redirects nor writes or recycles mirrors',async()=>{
 const f=withBoard();f.plugin.settings.boardSearchEnabled=false;await f.click(f.index,f.line);f.plugin.rebuildBoardSearch();await f.emit('modify',f.source);assert.deepEqual(f.opened,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);
});
test('late source validation cannot steal focus after leaving a generated Markdown search result',async()=>{
 const f=withBoard();let begin!:()=>void,finish!:(text:string)=>void;const reached=new Promise<void>(resolve=>{begin=resolve;});f.setReadHook(async file=>{if(file!==f.source)return f.content.get(file.path)!;begin();return new Promise(resolve=>{finish=resolve;});});const click=f.click(f.index,f.line);await reached;f.leave();finish(f.content.get(f.source.path)!);await click;assert.deepEqual(f.opened,[]);assert.deepEqual(f.errors,[]);
});
test('a source deleted during asynchronous Markdown validation is not routed to a missing file',async()=>{
 const f=withBoard(),original=f.content.get(f.source.path)!;let begin!:()=>void,finish!:(text:string)=>void;const reached=new Promise<void>(resolve=>{begin=resolve;});f.setReadHook(async file=>{if(file!==f.source)return f.content.get(file.path)!;begin();return new Promise(resolve=>{finish=resolve;});});const click=f.click(f.index,f.line);await reached;f.delete(f.source);f.setReadHook(undefined);finish(original);await click;assert.deepEqual(f.opened,[]);assert.equal(f.content.get(f.index.path),f.text);
});

for(const cache of [null,undefined])test(`a ${String(cache)} Markdown cache preserves mirror bytes, checksum, mtime and identity until metadata changed`,async()=>{
 const f=withBoard(),mtime=f.index.stat.mtime,checksum=f.text.split('\n')[0],updated=value();updated.nodes[0].text='保存后的新节点内容';const document=createMarkdownBoardDocument(updated,'材料');
 f.content.set(f.source.path,document);f.setMissingCache(f.source,cache);await f.emit('modify',f.source);await f.plugin.searchSync.flush();
 assert.equal(f.files.get(f.index.path),f.index);assert.equal(f.content.get(f.index.path),f.text);assert.equal(f.content.get(f.index.path)!.split('\n')[0],checksum);assert.equal(f.index.stat.mtime,mtime);assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);assert.deepEqual(f.warnings,[]);
 await f.metadataChanged(f.source);const text=f.content.get(f.index.path)!;
 assert.equal(f.files.get(f.index.path),f.index);assert.equal(text,search.boardSearchDocument(updated,f.source.path,vaultName));assert.notEqual(text.split('\n')[0],checksum);assert.ok(search.isManagedSearchIndex(text));assert.ok(f.index.stat.mtime>mtime);assert.deepEqual(f.writes,[f.index.path]);assert.deepEqual(f.removed,[]);assert.equal(f.content.get(f.source.path),document);assert.deepEqual(f.errors,[]);
});

test('startup rebuild preserves an existing mirror while the source metadata is unavailable',async()=>{
 const f=withBoard(),mtime=f.index.stat.mtime;f.setMissingCache(f.source,null);for(const callback of f.ready)callback();await f.settle();
 assert.equal(f.files.get(f.index.path),f.index);assert.equal(f.content.get(f.index.path),f.text);assert.equal(f.index.stat.mtime,mtime);assert.ok(search.isManagedSearchIndex(f.content.get(f.index.path)!));assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);assert.deepEqual(f.warnings,[]);assert.deepEqual(f.errors,[]);
 await f.metadataChanged(f.source);assert.equal(f.content.get(f.index.path),f.text);assert.equal(f.index.stat.mtime,mtime);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);
});

test('a newly created uncached Markdown board waits for metadata changed before creating its mirror',async()=>{
 const f=fixture(),document=createMarkdownBoardDocument(value(),'材料'),source=f.add(sourcePath,document),target=search.searchIndexPath(source.path);f.setMissingCache(source,null);await f.emit('create',source);
 assert.equal(f.files.has(target),false);assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);
 await f.metadataChanged(source);assert.ok(search.isManagedSearchIndex(f.content.get(target)!));assert.equal(search.searchBoardPath(target,f.content.get(target)),source.path);assert.deepEqual(f.writes,[target]);assert.equal(f.content.get(source.path),document);
});

test('metadata changed confirms conversion to ordinary Markdown and recycles the old managed mirror',async()=>{
 const f=withBoard(),ordinary='# 已转换为普通笔记\n\n原生正文';f.content.set(f.source.path,ordinary);f.setMissingCache(f.source,null);await f.emit('modify',f.source);
 assert.equal(f.content.get(f.index.path),f.text);assert.deepEqual(f.removed,[]);
 await f.metadataChanged(f.source);assert.deepEqual(f.removed,[f.index.path]);assert.equal(f.files.has(f.index.path),false);assert.equal(f.content.get(f.source.path),ordinary);assert.deepEqual(f.writes,[]);assert.deepEqual(f.warnings,[]);
});

test('confirmed source deletion still recycles a managed mirror despite missing prior metadata',async()=>{
 const f=withBoard();f.setMissingCache(f.source,null);f.delete(f.source);await f.emit('delete',f.source);
 assert.deepEqual(f.removed,[f.index.path]);assert.equal(f.files.has(f.index.path),false);assert.deepEqual(f.writes,[]);assert.deepEqual(f.warnings,[]);
});

test('metadata changed for a generated mirror never recursively indexes or recycles it',async()=>{
 const f=withBoard(),mtime=f.index.stat.mtime;await f.metadataChanged(f.index);
 assert.equal(f.content.get(f.index.path),f.text);assert.equal(f.index.stat.mtime,mtime);assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);
});

test('legacy boards remain indexable without Markdown metadata',async()=>{
 const f=fixture(),document=JSON.stringify(value()),source=f.add('白板/旧.thoughtspace',document),target=search.searchIndexPath(source.path);f.setMissingCache(source,null);await f.emit('create',source);
 assert.ok(search.isManagedSearchIndex(f.content.get(target)!));assert.deepEqual(f.writes,[target]);assert.equal(f.content.get(source.path),document);assert.deepEqual(f.removed,[]);assert.deepEqual(f.warnings,[]);
});

test('unload detaches metadata changed and cancels queued retries without touching the mirror',async()=>{
 const f=withBoard(),mtime=f.index.stat.mtime,updated=value();updated.nodes[0].text='卸载前已保存的节点';f.content.set(f.source.path,createMarkdownBoardDocument(updated,'材料'));f.setMissingCache(f.source,null);
 assert.equal(f.metadataSubscribed(),true);f.notifyMetadataChanged(f.source);assert.equal(f.timerCount(),1);
 for(const dispose of f.cleanup)dispose();assert.equal(f.metadataSubscribed(),false);assert.equal(f.timerCount(),0);
 await f.metadataChanged(f.source);assert.equal(f.timerCount(),0);assert.equal(f.files.get(f.index.path),f.index);assert.equal(f.content.get(f.index.path),f.text);assert.equal(f.index.stat.mtime,mtime);assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removed,[]);assert.deepEqual(f.warnings,[]);assert.deepEqual(f.errors,[]);
});
