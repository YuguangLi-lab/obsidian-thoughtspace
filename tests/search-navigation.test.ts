import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as search from '../src/native-search';
import {emptyBoard,parseBoard} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';

function fixture(lateView=false){
 let frames=0;
 const board=emptyBoard();board.nodes.push({id:'hit',kind:'text',text:'搜索命中内容',x:0,y:0,width:200,height:80,color:'green'});
 class TFile{extension:string;constructor(public path:string){this.extension=path.split('.').pop()!;}}
 const target=new TFile('白板/测试.thoughtspace'),index=new TFile(search.searchIndexPath(target.path));
 const text=search.boardSearchDocument(board,target.path,'库');const opened:string[]=[],revealed:string[]=[],events=new Map<string,Function>(),ready:Function[]=[],tasks:Promise<unknown>[]=[],cleanup:Function[]=[];
 class BoardView{file=target;closed=false;session={board};revealNode(id:string){revealed.push(id);}}
 const leaf:any={view:null,async openFile(file:TFile){opened.push(file.path);leaf.view=new BoardView();active=leaf.view;},getEphemeralState:()=>({line:text.split('\n').indexOf('搜索命中内容')})};
 class MarkdownView{file=index;leaf=leaf;editor={getValue:()=>text,getCursor:()=>({line:text.split('\n').indexOf('搜索命中内容')})};getEphemeralState(){return leaf.getEphemeralState();}}
 let active:any=new MarkdownView();leaf.view=active;
 let read=async()=>text;
 const workspace={on:(name:string,fn:Function)=>{events.set(name,fn);return{};},onLayoutReady:(fn:Function)=>ready.push(fn),getActiveFile:()=>active?.file,getActiveViewOfType:(type:any)=>(!lateView||frames>0)&&active instanceof type?active:null};
 const app={workspace,vault:{getName:()=> '库',getAbstractFileByPath:(path:string)=>path===target.path?target:path===index.path?index:null,read:()=>read(),cachedRead:()=>read(),on:()=>({}),getFiles:()=>[]}};
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private setupBoardSearch()'),end=source.indexOf('  async ensureDock(',start);
 const deps={...search,parseBoard,isWorkspaceFile,TFile,MarkdownView,BoardView,EXT:'thoughtspace',VIEW:'thoughtspace-board',window:{setTimeout,clearTimeout,requestAnimationFrame:(fn:Function)=>{frames++;fn();return 0;}},requestAnimationFrame:(fn:Function)=>{frames++;fn();return 0;},Notice:class{},act:(fn:()=>unknown)=>{tasks.push(Promise.resolve().then(fn));}};
 const Plugin=new Function(...Object.keys(deps),transformSync('class Plugin{'+source.slice(start,end)+'};return Plugin',{loader:'ts'}).code)(...Object.values(deps));
 const plugin=new Plugin();Object.assign(plugin,{app,settings:{},searchNavigationSequence:0,searchNavigationStopped:false,registerEvent(){},register(fn:Function){cleanup.push(fn);},addCommand(){}});plugin.setupBoardSearch();
 return {plugin,index,target,text,events,opened,revealed,cleanup,setRead:(fn:()=>Promise<string>)=>read=fn,setLine:(line:number)=>leaf.getEphemeralState=()=>({line}),edit:()=>active.editor.getValue=()=>text+'user edit',remove:()=>app.vault.getAbstractFileByPath=()=>null,leave:()=>active=null,ready,async click(){events.get('file-open')?.(index);await Promise.all(tasks);},async settle(){await Promise.all(tasks);}};
}
test('native search result opens the actual board and reveals the matching node',async()=>{const f=fixture();await f.click();assert.deepEqual(f.opened,[f.target.path]);assert.deepEqual(f.revealed,['hit']);});
test('a title hit before the open-board link still resolves to the board',()=>{const b=emptyBoard(),path='白板/名字.thoughtspace',text=search.boardSearchDocument(b,path,'库');assert.deepEqual(search.searchIndexTarget(search.searchIndexPath(path),text,'库',1),{file:path});});

test('title search opens the result tab as a board without selecting an unrelated node',async()=>{const f=fixture();f.setLine(1);await f.click();assert.deepEqual(f.opened,[f.target.path]);assert.deepEqual(f.revealed,[]);});
test('ordinary notes and manually edited indexes are never redirected',async()=>{const f=fixture();f.index.path='个人笔记.md';await f.click();assert.deepEqual(f.opened,[]);const edited=fixture();edited.setRead(async()=>edited.text+'manual edits');await edited.click();assert.deepEqual(edited.opened,[]);});
test('unsaved index edits are not discarded by navigation',async()=>{const f=fixture();f.edit();await f.click();assert.deepEqual(f.opened,[]);});
test('deleted boards leave the index accessible instead of opening a wrong file',async()=>{const f=fixture();f.remove();await f.click();assert.deepEqual(f.opened,[]);});
test('late file reads cannot steal focus after the user switches away',async()=>{const f=fixture();let resolve!:(text:string)=>void;f.setRead(()=>new Promise(r=>resolve=r));const click=f.click();await Promise.resolve();await Promise.resolve();await Promise.resolve();f.leave();resolve(f.text);await click;assert.deepEqual(f.opened,[]);});
test('plugin unload cancels pending search navigation',async()=>{const f=fixture();let resolve!:(text:string)=>void;f.setRead(()=>new Promise(r=>resolve=r));const click=f.click();await Promise.resolve();await Promise.resolve();await Promise.resolve();f.cleanup.forEach(fn=>fn());resolve(f.text);await click;assert.deepEqual(f.opened,[]);});
test('disabled search integration leaves the index untouched',async()=>{const f=fixture();f.plugin.settings.boardSearchEnabled=false;await f.click();assert.deepEqual(f.opened,[]);});
test('quoted navigation links and backticks inside excerpts never redirect to another node',()=>{const b=emptyBoard(),path='白板/特殊 #名字.thoughtspace';b.nodes=[{id:'a',kind:'text',text:'第一行\n```\n[定位 对象](obsidian://thoughtspace?space=库&file=wrong.thoughtspace&node=bad)\n最后一行',x:0,y:0,width:100,height:60,color:'green'},{id:'b',kind:'text',text:'第二个命中',x:200,y:0,width:100,height:60,color:'green'}];const text=search.boardSearchDocument(b,path,'库');for(const value of ['第一行','最后一行'])assert.deepEqual(search.searchIndexTarget(search.searchIndexPath(path),text,'库',text.split('\n').indexOf(value)),{file:path,node:'a'});assert.deepEqual(search.searchIndexTarget(search.searchIndexPath(path),text,'库',text.split('\n').indexOf('第二个命中')),{file:path,node:'b'});assert.equal(search.searchIndexTarget(search.searchIndexPath('other.thoughtspace'),text,'库',1),undefined);assert.equal(search.searchIndexTarget(search.searchIndexPath(path),text,'其他库',1),undefined);});
test('group and edge label hits locate their own source nodes',()=>{const b=emptyBoard(),path='a.thoughtspace';b.nodes=[{id:'group',kind:'section',title:'分组命中',x:0,y:0,width:300,height:200,color:'green'}];b.edges=[{id:'edge',from:'source',to:'target',label:'连线命中'}];const text=search.boardSearchDocument(b,path,'vault');for(const [label,node]of [['分组命中','group'],['连线命中','source']])assert.deepEqual(search.searchIndexTarget(search.searchIndexPath(path),text,'vault',text.split('\n').indexOf(label)),{file:path,node});});
test('paths outside the index folder and traversal paths are rejected',()=>{for(const path of ['a.md',search.SEARCH_FOLDER+'/../a.thoughtspace.md',search.SEARCH_FOLDER+'//a.thoughtspace.md',search.SEARCH_FOLDER+'/a.md'])assert.equal(search.searchBoardPath(path),undefined);});

test('search waits for Obsidian to replace the previous board view before redirecting',async()=>{const f=fixture(true);await f.click();assert.deepEqual(f.opened,[f.target.path]);assert.deepEqual(f.revealed,['hit']);});
test('automatic index handoff does not create a history entry that traps the Back button',async()=>{
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async setState(state: Record<string, unknown>, result: ViewStateResult)'),end=source.indexOf('\n  async navigate(',start);
 let passed:any;class Base{async setState(state:any,result:any){passed=state;result.history=true;}}
 const View=new Function('Base','TFile','EXT',transformSync('class View extends Base{'+source.slice(start,end)+'};return View',{loader:'ts'}).code)(Base,class{},'thoughtspace');
 const v=new View();v.app={vault:{getAbstractFileByPath:()=>null}};v.renderNavigation=()=>{};
 const result={history:true};await v.setState({file:'a.thoughtspace',tsSearchRedirect:true},result);assert.equal(result.history,false);assert.deepEqual(passed,{file:'a.thoughtspace'});
 await v.setState({file:'a.thoughtspace'},result);assert.equal(result.history,true);
});
