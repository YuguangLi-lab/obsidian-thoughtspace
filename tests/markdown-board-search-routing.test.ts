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
 class TFile{extension:string;constructor(public path:string){this.extension=path.split('.').pop()!;}}
 const files=new Map<string,TFile>(),content=new Map<string,string>(),tasks:Promise<unknown>[]=[],errors:unknown[]=[],notices:string[]=[],warnings:unknown[][]=[],opened:string[]=[],revealed:string[]=[],states:unknown[]=[],writes:string[]=[],removed:string[]=[],reads:string[]=[],cleanup:(()=>void)[]=[],vaultEvents=new Map<string,Function>(),workspaceEvents=new Map<string,Function>(),ready:Function[]=[];
 let frames=0,timerId=0,active:any,plugin:any,readHook:((file:TFile)=>Promise<string>)|undefined;
 const add=(path:string,text:string)=>{const file=new TFile(path);files.set(path,file);content.set(path,text);return file;};
 const disk=(file:TFile)=>{const text=content.get(file.path);if(text===undefined)throw Error('File disappeared');return text;};
 const frontmatter=(file:TFile)=>{const match=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(content.get(file.path)||'');try{return match?parseYaml(match[1]):undefined;}catch{return undefined;}};
 class BoardView{closed=false;constructor(public file:TFile,public session:{board:Board}){}revealNode(id:string){revealed.push(id);}}
 const leaf:any={view:null,async setViewState(state:{type:string;state:{file:string;tsSearchRedirect?:boolean}}){states.push(state);opened.push(state.state.file);const file=files.get(state.state.file);assert.ok(file);active=new BoardView(file,{board:await plugin.readBoard(file)});leaf.view=active;}};
 class MarkdownView{leaf=leaf;draft:string;constructor(public file:TFile,public line:number){this.draft=disk(file);}editor={getValue:()=>this.draft,getCursor:()=>({line:this.line})};getEphemeralState(){return{line:this.line};}}
 const app={
  metadataCache:{getFileCache:(file:TFile)=>({frontmatter:frontmatter(file)})},
  workspace:{on:(name:string,fn:Function)=>{workspaceEvents.set(name,fn);return{};},onLayoutReady:(fn:Function)=>ready.push(fn),getActiveFile:()=>active?.file,getActiveViewOfType:(type:any)=>active instanceof type?active:null},
  vault:{getName:()=>vaultName,getAbstractFileByPath:(path:string)=>files.get(path),getFiles:()=>[...files.values()],on:(name:string,fn:Function)=>{vaultEvents.set(name,fn);return{};},read:async(file:TFile)=>{reads.push(file.path);return disk(file);},cachedRead:async(file:TFile)=>{reads.push(file.path);return readHook?readHook(file):disk(file);},process:async(file:TFile,fn:(text:string)=>string)=>{content.set(file.path,fn(disk(file)));writes.push(file.path);},create:async(path:string,text:string)=>{assert.equal(files.has(path),false);const file=add(path,text);writes.push(path);return file;}},
  fileManager:{trashFile:async(file:TFile)=>{removed.push(file.path);files.delete(file.path);content.delete(file.path);}}
 };
 const act=(run:()=>unknown)=>{tasks.push(Promise.resolve().then(run).catch(error=>{errors.push(error);}));};
 const deps={...search,readBoardDocument,isMarkdownBoardFrontmatter,isBoardPath,isWorkspaceFile,parseYaml,clone,TFile,MarkdownView,BoardView,EXT:'thoughtspace',VIEW:'thoughtspace-board',window:{setTimeout:()=>++timerId,clearTimeout:()=>{},requestAnimationFrame:(fn:()=>void)=>{frames++;fn();return frames;}},Notice:class{constructor(message:string){notices.push(message);}},console:{warn:(...args:unknown[])=>warnings.push(args)},act};
 const Plugin=new Function(...Object.keys(deps),transformSync(classification+'\nclass Plugin{'+source.slice(readBegin,readEnd)+source.slice(begin,end)+'};return Plugin',{loader:'ts'}).code)(...Object.values(deps));
 plugin=new Plugin();Object.assign(plugin,{app,settings:{},sessions:new Map(),searchNavigationSequence:0,searchNavigationStopped:false,registerEvent(){},register(fn:()=>void){cleanup.push(fn);},addCommand(){},folder:async()=>{}});plugin.setupBoardSearch();
 const setActive=(file:TFile,line=1)=>{active=new MarkdownView(file,line);leaf.view=active;return active as MarkdownView;};
 async function settle(){let complete=0;while(complete<tasks.length){const batch=tasks.slice(complete);complete=tasks.length;await Promise.all(batch);}await plugin.searchSync.flush();}
 async function click(file:TFile,line=1){setActive(file,line);workspaceEvents.get('file-open')?.(file);await settle();}
 async function emit(name:string,file:TFile,old?:string){vaultEvents.get(name)?.(file,old);await plugin.searchSync.flush();await settle();}
 function rename(file:TFile,path:string){const old=file.path,text=disk(file);files.delete(old);content.delete(old);file.path=path;file.extension=path.split('.').pop()!;files.set(path,file);content.set(path,text);return old;}
 return {plugin,add,files,content,errors,notices,warnings,opened,revealed,states,writes,removed,reads,cleanup,ready,setActive,click,emit,settle,rename,frames:()=>frames,leave:()=>{active=undefined;},setReadHook:(hook:((file:TFile)=>Promise<string>)|undefined)=>{readHook=hook;},delete:(file:TFile)=>{files.delete(file.path);content.delete(file.path);}};
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
