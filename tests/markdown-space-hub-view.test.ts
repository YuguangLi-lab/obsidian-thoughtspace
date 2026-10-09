import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {createMarkdownBoardDocument,isMarkdownBoardFrontmatter,readBoardDocument,type YamlParser} from '../src/board-document';
import {cleanHubPreferences,defaultHubFilter,hubIndex,hubResults,summarizeBoard} from '../src/space-hub';

const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:YamlParser}).load;
const source=readFileSync('src/space-hub-view.ts','utf8'),begin=source.indexOf('  async load(){'),end=source.indexOf('  private renderMetrics()',begin);
assert.ok(begin>=0&&end>begin,'actual knowledge-space load method must be available');
class File{extension:string;basename:string;stat={mtime:5,size:100};constructor(public path:string,public raw:string){const name=path.split('/').pop()!;this.extension=name.split('.').pop()!;this.basename=name.slice(0,-this.extension.length-1);}}
class TagSelect{value='';options:{value:string;text:string}[]=[];empty(){this.options=[];}createEl(_tag:string,option:{value:string;text:string}){this.options.push(option);return option;}querySelector(selector:string){return this.options.find(option=>selector===`option[value="${option.value}"]`);}}
function frontmatter(file:File){const match=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(file.raw);try{return match?parseYaml(match[1]):undefined;}catch{return undefined;}}
function classify(file:File){return file.extension==='thoughtspace'||file.extension.toLowerCase()==='md'&&isMarkdownBoardFrontmatter(frontmatter(file));}
function fixture(useClassifier=true){
 const files:File[]=[],readPaths:string[]=[],classified:string[]=[],errors:unknown[]=[],states:string[]=[];let reader=(file:File):Promise<Board>=>Promise.resolve(readBoardDocument(file.raw,file.extension,parseYaml).board);
 const View=new Function('isWorkspaceFile','getAllTags','summarizeBoard','hubIndex','CSS',transformSync('class View{'+source.slice(begin,end)+'};return View;',{loader:'ts'}).code)(isWorkspaceFile,()=>['#原生标签'],summarizeBoard,hubIndex,{escape:(text:string)=>text});
 const view=new View(),host:{journalFolder:string;readBoard:(file:File)=>Promise<Board>;isBoardFile?:(file:File)=>boolean}={journalFolder:'日记',readBoard:async file=>{readPaths.push(file.path);return reader(file);}};
 if(useClassifier)host.isBoardFile=file=>{classified.push(file.path);return classify(file);};
 Object.assign(view,{host,app:{vault:{getFiles:()=>files},metadataCache:{getFileCache:(file:File)=>({frontmatter:frontmatter(file)})}},generation:0,changes:0,active:true,busy:false,loaded:false,index:hubIndex([],[]),selected:new Set<string>(),filter:{...defaultHubFilter},tag:new TagSelect(),refreshButton:{disabled:false},state:{setText:(text:string)=>states.push(text)},error:(error:unknown)=>errors.push(error),action(){},renderMetrics(){},renderNav(){},renderResults(){},renderDetail(){},renderFooter(){}});
 const add=(path:string,raw:string)=>{const file=new File(path,raw);files.push(file);return file;};
 return {view,host,files,add,classified,readPaths,errors,states,setReader:(next:(file:File)=>Promise<Board>)=>{reader=next;}};
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
 const f=fixture();f.add('慢.md',createMarkdownBoardDocument(emptyBoard(),'慢'));let finish!:(board:Board)=>void;f.setReader(()=>new Promise(resolve=>{finish=resolve;}));const loading=f.view.load();f.view.active=false;f.view.generation++;finish(emptyBoard());await loading;assert.equal(f.view.loaded,false);assert.equal(f.view.index.boards.length,0);assert.deepEqual(f.errors,[]);
});
