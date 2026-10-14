import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {createMarkdownBoardDocument,isMarkdownBoardFrontmatter,readBoardDocument,type YamlParser} from '../src/board-document';
import {cleanHubPreferences,defaultHubFilter,hubIndex,hubResults,summarizeBoard} from '../src/space-hub';
import {setUiFeedback,clearUiFeedback} from '../src/ui-feedback';

const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:YamlParser}).load;
const source=readFileSync('src/space-hub-view.ts','utf8'),begin=source.indexOf('  async load(){'),end=source.indexOf('  private renderMetrics()',begin);
assert.ok(begin>=0&&end>begin,'actual knowledge-space load method must be available');
const errorBegin=source.indexOf('  private error('),errorEnd=source.indexOf('  private file(',errorBegin),closeBegin=source.indexOf('  onClose(){');
assert.ok(errorBegin>=0&&errorEnd>errorBegin&&closeBegin>=0&&closeBegin<begin,'actual error and close callers must be available');
class File{extension:string;basename:string;stat={mtime:5,size:100};constructor(public path:string,public raw:string){const name=path.split('/').pop()!;this.extension=name.split('.').pop()!;this.basename=name.slice(0,-this.extension.length-1);}}
class TagSelect{value='';options:{value:string;text:string}[]=[];empty(){this.options=[];}createEl(_tag:string,option:{value:string;text:string}){this.options.push(option);return option;}querySelector(selector:string){return this.options.find(option=>selector===`option[value="${option.value}"]`);}}
function frontmatter(file:File){const match=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(file.raw);try{return match?parseYaml(match[1]):undefined;}catch{return undefined;}}
function classify(file:File){return file.extension==='thoughtspace'||file.extension.toLowerCase()==='md'&&isMarkdownBoardFrontmatter(frontmatter(file));}
function fixture(useClassifier=true){
 const files:File[]=[],readPaths:string[]=[],classified:string[]=[],errors:unknown[]=[],states:string[]=[],feedbacks:(string|undefined)[]=[];let reader=(file:File):Promise<Board>=>Promise.resolve(readBoardDocument(file.raw,file.extension,parseYaml).board),unloads=0,clears=0,footerRenders=0;
 const View=new Function('isWorkspaceFile','getAllTags','summarizeBoard','hubIndex','CSS','setUiFeedback','clearUiFeedback','Notice',transformSync('class View{'+source.slice(errorBegin,errorEnd)+source.slice(closeBegin,begin)+source.slice(begin,end)+'};return View;',{loader:'ts'}).code)(isWorkspaceFile,()=>['#原生标签'],summarizeBoard,hubIndex,{escape:(text:string)=>text},setUiFeedback,clearUiFeedback,class{});
 const view=new View(),host:{journalFolder:string;readBoard:(file:File)=>Promise<Board>;isBoardFile?:(file:File)=>boolean}={journalFolder:'日记',readBoard:async file=>{readPaths.push(file.path);return reader(file);}};
 if(useClassifier)host.isBoardFile=file=>{classified.push(file.path);return classify(file);};
 const realError=view.error.bind(view),state={dataset:{} as Record<string,string>,text:'',setText(text:string){this.text=text;states.push(text);feedbacks.push(this.dataset.feedback);},empty(){this.setText('');}};
 Object.assign(view,{host,app:{vault:{getFiles:()=>files},metadataCache:{getFileCache:(file:File)=>({frontmatter:frontmatter(file)})}},generation:0,changes:0,active:true,busy:false,loaded:false,index:hubIndex([],[]),selected:new Set<string>(),filter:{...defaultHubFilter},tag:new TagSelect(),refreshButton:{disabled:false},state,error:(error:unknown)=>{errors.push(error);realError(error);},life:{unload(){unloads++;}},contentEl:{empty(){clears++;}},action(){},renderMetrics(){},renderNav(){},renderResults(){},renderDetail(){},renderFooter(){footerRenders++;}});
 const add=(path:string,raw:string)=>{const file=new File(path,raw);files.push(file);return file;};
 return {view,host,files,add,classified,readPaths,errors,states,feedbacks,state,get unloads(){return unloads;},get clears(){return clears;},get footerRenders(){return footerRenders;},setReader:(next:(file:File)=>Promise<Board>)=>{reader=next;}};
}

test('knowledge-space discovery puts marked Markdown boards in boards and ordinary Markdown in notes',async()=>{
 const f=fixture(),md=f.add('白板/新.md',createMarkdownBoardDocument(emptyBoard(),'新白板')),legacy=f.add('旧.thoughtspace',JSON.stringify(emptyBoard())),note=f.add('材料/普通.md','# Native note');await f.view.load();assert.deepEqual(new Set(f.view.index.boards.map((board:{path:string})=>board.path)),new Set([md.path,legacy.path]));assert.deepEqual(f.view.index.notes.map((item:{path:string})=>item.path),[note.path]);assert.deepEqual(new Set(f.readPaths),new Set([md.path,legacy.path]));assert.equal(f.view.refreshButton.disabled,false);assert.deepEqual(f.errors,[]);
});
test('without the optional classifier the existing legacy discovery remains compatible',async()=>{
 const f=fixture(false),legacy=f.add('旧.thoughtspace',JSON.stringify(emptyBoard())),md=f.add('新.md',createMarkdownBoardDocument(emptyBoard(),'新'));await f.view.load();assert.deepEqual(f.view.index.boards.map((board:{path:string})=>board.path),[legacy.path]);assert.deepEqual(f.view.index.notes.map((note:{path:string})=>note.path),[md.path]);assert.deepEqual(f.readPaths,[legacy.path]);
});
test('a Markdown board with a missing or unsupported layout follows the existing index-error recovery flow',async()=>{
 for(const raw of ['---\nthoughtspace: board\n---\n\n# Missing layout',createMarkdownBoardDocument(emptyBoard(),'未知封装').replace('"version": 1','"version": 99')]){
  const f=fixture(),broken=f.add('坏.md',raw),note=f.add('材料.md','# Native note');await f.view.load();assert.equal(f.view.index.boards.length,0);assert.deepEqual(f.view.index.notes.map((item:{path:string})=>item.path),[note.path]);assert.equal(f.view.index.errors.length,1);assert.equal(f.view.index.errors[0].path,broken.path);assert.ok(f.states.at(-1)?.includes('1 张白板无法索引'));assert.equal(hubResults(f.view.index,{...defaultHubFilter,scope:'inbox'},cleanHubPreferences(null),new Set()).length,0);assert.deepEqual(f.errors,[]);assert.equal(f.view.busy,false);
 }
});
test('unrelated Markdown properties do not promote ordinary notes to knowledge-space boards',async()=>{
 const f=fixture();for(const [i,yaml]of ['thoughtspace: other','thoughtspace: [board]','nested: {thoughtspace: board}','thoughtspace: true'].entries())f.add(`普通${i}.md`,`---\n${yaml}\n---\n\nText`);await f.view.load();assert.equal(f.view.index.notes.length,4);assert.equal(f.view.index.boards.length,0);assert.deepEqual(f.readPaths,[]);assert.deepEqual(f.view.index.errors,[]);
});
test('discovery classifies each workspace file once and excludes search mirrors and plugin backups',async()=>{
 const f=fixture(),board=f.add('新.md',createMarkdownBoardDocument(emptyBoard(),'新')),note=f.add('普通.md','普通');f.add('ThoughtSpace/白板搜索/新.md.md','Generated search excerpt');f.add('ThoughtSpace-plugin-backups/旧.thoughtspace','Backup');await f.view.load();assert.deepEqual(new Set(f.classified),new Set([board.path,note.path]));assert.equal(f.classified.length,2);assert.deepEqual(f.readPaths,[board.path]);assert.equal(f.view.index.notes.length,1);
});
test('the classifier result is authoritative rather than falling back when it returns false',async()=>{
 const f=fixture(),legacy=f.add('旧.thoughtspace',JSON.stringify(emptyBoard()));f.host.isBoardFile=()=>false;await f.view.load();assert.deepEqual(f.readPaths,[]);assert.equal(f.view.index.boards.length,0);assert.equal(f.view.index.notes.length,0);assert.equal(legacy.raw,JSON.stringify(emptyBoard()));
});
test('refresh reclassifies Markdown after its board marker is removed without keeping a duplicate board',async()=>{
 const f=fixture(),file=f.add('变化.md',createMarkdownBoardDocument(emptyBoard(),'变化'));await f.view.load();assert.equal(f.view.index.boards.length,1);assert.equal(f.view.index.notes.length,0);file.raw='# Ordinary note';await f.view.load();assert.equal(f.view.index.boards.length,0);assert.deepEqual(f.view.index.notes.map((note:{path:string})=>note.path),[file.path]);assert.deepEqual(f.view.index.errors,[]);
});
test('fixing a marked Markdown layout clears its index error on a later refresh',async()=>{
 const f=fixture(),file=f.add('恢复.md','---\nthoughtspace: board\n---\n\nBroken layout');await f.view.load();assert.equal(f.view.index.errors.length,1);file.raw=createMarkdownBoardDocument(emptyBoard(),'恢复');await f.view.load();assert.equal(f.view.index.errors.length,0);assert.equal(f.view.index.boards.length,1);assert.equal(f.view.index.notes.length,0);assert.deepEqual(f.errors,[]);
});
test('a closed modal does not publish an asynchronously read Markdown board index',async()=>{
 const f=fixture();f.add('慢.md',createMarkdownBoardDocument(emptyBoard(),'慢'));let finish!:(board:Board)=>void;f.setReader(()=>new Promise(resolve=>{finish=resolve;}));const loading=f.view.load();f.view.onClose();finish(emptyBoard());await loading;assert.equal(f.view.loaded,false);assert.equal(f.view.index.boards.length,0);assert.deepEqual(f.errors,[]);assert.deepEqual(f.feedbacks,['loading']);assert.equal(f.unloads,1);assert.equal(f.clears,1);
});

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

test('real hub feedback clears recovered partial index warning without repeating the search placeholder',async()=>{
 const f=fixture(),file=f.add('恢复.md','---\nthoughtspace: board\n---\n\nBroken layout');
 await f.view.load();assert.equal(f.state.dataset.feedback,'warning');assert.match(f.state.text,/无法索引/);
 file.raw=createMarkdownBoardDocument(emptyBoard(),'恢复');await f.view.load();
 assert.equal(f.state.dataset.feedback,undefined);assert.equal(f.state.text,'');
 assert.deepEqual(f.feedbacks,['loading','warning','loading',undefined]);assert.equal(f.view.index.errors.length,0);
});

test('real hub marks changes observed during an in-flight index as warning',async()=>{
 const f=fixture(),read=deferred<Board>();f.add('慢.md',createMarkdownBoardDocument(emptyBoard(),'慢'));f.setReader(()=>read.promise);
 const operation=f.view.load();assert.equal(f.state.dataset.feedback,'loading');assert.equal(f.view.refreshButton.disabled,true);
 f.view.changes++;read.resolve(emptyBoard());await operation;
 assert.equal(f.state.dataset.feedback,'warning');assert.equal(f.state.text,'资料在索引期间发生变化，请刷新后核对。');
 assert.equal(f.view.busy,false);assert.equal(f.view.refreshButton.disabled,false);
});

test('late successful and rejected hub reads cannot replace the newer index or feedback',async()=>{
 for(const oldFails of [false,true])for(const latestFails of [false,true]){
  const f=fixture(),first=deferred<Board>(),second=deferred<Board>();f.add('反序.md',createMarkdownBoardDocument(emptyBoard(),'反序'));let call=0;f.setReader(()=>call++===0?first.promise:second.promise);
  const old=f.view.load(),latest=f.view.load();
  if(latestFails)second.reject(Error('latest read failed'));else second.resolve(emptyBoard());await latest;
  const index=f.view.index,text=f.state.text,feedback=f.state.dataset.feedback,writes=f.states.length,footers=f.footerRenders;
  assert.equal(feedback,latestFails?'warning':undefined);assert.equal(f.view.busy,false);assert.equal(f.view.refreshButton.disabled,false);
  if(oldFails)first.reject(Error('old read failed'));else first.resolve(emptyBoard());await old;
  assert.equal(f.view.index,index);assert.equal(f.state.text,text);assert.equal(f.state.dataset.feedback,feedback);assert.equal(f.states.length,writes);assert.equal(f.footerRenders,footers);
 }
});

test('closing hub while a read later rejects suppresses warning and leaves removed-state feedback untouched',async()=>{
 const f=fixture(),read=deferred<Board>();f.add('慢.md',createMarkdownBoardDocument(emptyBoard(),'慢'));f.setReader(()=>read.promise);
 const operation=f.view.load();f.view.onClose();const text=f.state.text,feedback=f.state.dataset.feedback,writes=f.states.length;
 read.reject(Error('closed read failed'));await operation;
 assert.equal(f.state.text,text);assert.equal(f.state.dataset.feedback,feedback);assert.equal(f.states.length,writes);
 assert.equal(f.view.loaded,false);assert.equal(f.unloads,1);assert.equal(f.clears,1);assert.equal(f.footerRenders,0);
});

test('real hub fatal index failure displays error then refresh clears it without changing discovery',async()=>{
 const f=fixture(),original=f.view.app.vault.getFiles;f.view.app.vault.getFiles=()=>{throw Error('fixture index failure');};
 await f.view.load();assert.equal(f.state.dataset.feedback,'error');assert.equal(f.state.text,'fixture index failure');assert.equal(f.errors.length,1);
 f.view.app.vault.getFiles=original;await f.view.load();assert.equal(f.state.dataset.feedback,undefined);assert.equal(f.state.text,'');assert.equal(f.view.index.boards.length,0);
 assert.deepEqual(f.feedbacks,['loading','error','loading',undefined]);assert.equal(f.view.refreshButton.disabled,false);
});

test('first hub load renders the result region while the production board read is pending',async()=>{
 const f=fixture(),read=deferred<Board>(),renders:{busy:boolean;loaded:boolean}[]=[];f.add('慢.md',createMarkdownBoardDocument(emptyBoard(),'慢'));f.setReader(()=>read.promise);f.view.renderResults=()=>renders.push({busy:f.view.busy,loaded:f.view.loaded});
 const operation=f.view.load();assert.deepEqual(renders,[{busy:true,loaded:false}]);assert.equal(f.state.dataset.feedback,'loading');read.resolve(emptyBoard());await operation;assert.deepEqual(renders,[{busy:true,loaded:false},{busy:true,loaded:true}]);assert.equal(f.view.busy,false);assert.equal(f.view.index.boards.length,1);
});

test('fatal first hub load refreshes the unloaded result region after becoming idle while preserving the error',async()=>{
 const f=fixture(),original=f.view.app.vault.getFiles,renders:{busy:boolean;loaded:boolean}[]=[];f.view.renderResults=()=>renders.push({busy:f.view.busy,loaded:f.view.loaded});f.view.app.vault.getFiles=()=>{throw Error('fixture index failure');};
 await f.view.load();assert.deepEqual(renders,[{busy:true,loaded:false},{busy:false,loaded:false}]);assert.equal(f.state.dataset.feedback,'error');assert.equal(f.state.text,'fixture index failure');assert.equal(f.view.refreshButton.disabled,false);f.view.app.vault.getFiles=original;await f.view.load();assert.equal(f.state.dataset.feedback,undefined);assert.equal(f.view.loaded,true);assert.deepEqual(renders.slice(2),[{busy:true,loaded:false},{busy:true,loaded:true}]);
});
