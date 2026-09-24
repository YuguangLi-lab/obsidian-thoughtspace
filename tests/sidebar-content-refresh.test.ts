import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {boardLinks,emptyBoard,extractTasks,type Board} from '../src/model';
import {isWorkspaceFile,libraryFiles,noteExcerpt} from '../src/workspace';
import {firstNoteReferences} from '../src/sidebar-content';
import {taskSummary,visibleTasks} from '../src/navigation';
import {outlineTree} from '../src/group-organizer';
import {readingTitle} from '../src/reading-desk';

// Exercise the registered content events, both schedulers and real sidebar
// builders. Vault reads/DOM publication are boundaries, not substituted filters.
const source=readFileSync(process.env.SIDEBAR_SOURCE||'src/main.ts','utf8');
function take(a:string,b:string){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const eventStart=source.indexOf("    this.registerEvent(this.app.vault.on('modify', f => { if (f instanceof TFile && ['md','pdf']");
assert.ok(eventStart>=0);const events=source.slice(eventStart,source.indexOf('\n  }',eventStart));
const methods=take('  private renderSidebar()', '  private async populateSidebar()')
 +take('  private async buildSidebar(', '  private async exportCanvas(')
 +take('  private paint =', '  private renderSaveStatus(')
 +take('  private scheduleRender(', '  private clearNodes(');
class File {
 extension:string;basename:string;stat={mtime:1};parent={path:'Notes'};
 constructor(readonly path:string){this.extension=path.split('.').pop()!;this.basename=path.split('/').pop()!.replace(/\.[^.]+$/,'');}
}
type ElementOptions={text?:string;cls?:string;attr?:Record<string,string>};
class Element {
 children:Element[]=[];style={paddingLeft:'',setProperty(){}};dataset:Record<string,string>={};attrs=new Map<string,string>();text='';cls='';onclick?:()=>unknown;
 createEl(_tag='div',options:ElementOptions={}){const child=new Element();child.text=options.text||'';child.cls=options.cls||'';for(const[name,value]of Object.entries(options.attr||{}))child.setAttribute(name,value);this.children.push(child);return child;}
 createDiv(options:ElementOptions|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}createSpan(options:ElementOptions|string={}){return this.createEl('span',typeof options==='string'?{cls:options}:options);}
 toggleClass(){}setAttribute(name:string,value:string){this.attrs.set(name,value);}getAttribute(name:string){return this.attrs.get(name);}addEventListener(){}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 get childElementCount(){return this.children.length;}
}
type Tab='boards'|'outline'|'library'|'tasks';
function fixture(tab:Tab){
 let now=0,next=0;const timers=new Map<number,{at:number;fn:()=>void}>(),frames=new Map<number,()=>void>(),pending:Promise<unknown>[]=[];
 const listeners={vault:new Map<string,((file:File)=>void)[]>(),metadata:new Map<string,((file:File)=>void)[]>()};
 let lastList=new Element();
 const calls={build:0,readBoard:0,readNote:0,canvas:0,status:0},files=Array.from({length:30},(_,i)=>new File(`Boards/${i}.thoughtspace`));
 const note=new File('Notes/Note.md'),unrelated=new File('Notes/Unrelated.md'),pdf=new File('Books/Book.pdf');files.push(note,unrelated,pdf);
 const window={setTimeout(fn:()=>void,delay:number){const id=++next;timers.set(id,{at:now+delay,fn});return id;},clearTimeout(id:number){timers.delete(id);},requestAnimationFrame(fn:()=>void){const id=++next;frames.set(id,fn);return id;},cancelAnimationFrame(id:number){frames.delete(id);}};
 const on=(surface:'vault'|'metadata',event:string,fn:(file:File)=>void)=>{const handlers=listeners[surface].get(event)||[];handlers.push(fn);listeners[surface].set(event,handlers);};
 const deps={window,TFile:File,EXT:'thoughtspace',isWorkspaceFile,libraryFiles,noteExcerpt,firstNoteReferences,outlineTree,taskSummary,visibleTasks,extractTasks,
  act:(run:()=>unknown)=>{pending.push(Promise.resolve().then(run));},button:(host:Element,title:string,_icon:string,run:()=>unknown,cls='')=>{const button=host.createEl('button',{text:title,cls,attr:{'aria-label':title}});button.onclick=run;return button;},setIcon(){},getAllTags:()=>[],readingTitle};
 const View=new Function(...Object.keys(deps),transformSync(`class View{init(){${events}}${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const Plugin=new Function('isWorkspaceFile','boardLinks','EXT',transformSync(`class Plugin{${take('  async boardGraph()', '  /** 所有由本插件创建')}};return Plugin`,{loader:'ts'}).code)(isWorkspaceFile,boardLinks,'thoughtspace');
 const plugin=new Plugin(),view=new View(),board:Board={...emptyBoard(),nodes:[{id:'note',kind:'card',file:note.path,color:'sand',x:0,y:0,width:300,height:180}]};
 const vault={getFiles:()=>files,getMarkdownFiles:()=>files.filter(f=>f.extension==='md'),getAbstractFileByPath:(path:string)=>files.find(f=>f.path===path),cachedRead:async()=>{calls.readNote++;return '- [ ] Current task';},on:(event:string,fn:(file:File)=>void)=>on('vault',event,fn)};
 plugin.app={vault};plugin.settings={favoriteBoards:[],cardFolder:'Notes'};plugin.readBoard=async()=>{calls.readBoard++;return emptyBoard();};
 Object.assign(view,{sidebarRun:0,renderFrame:0,viewportOnlyRender:true,tab,boardScope:'spaces',boardSort:'title',query:'',tag:'',outlineKind:'all',libraryScope:'vault',librarySort:'updated',taskScope:'board',taskFilter:'all',selected:new Set(),collapsedBoards:new Set(),outlineCollapsed:new Set(),file:files[0],session:{board},plugin,
  app:{vault,metadataCache:{on:(event:string,fn:(file:File)=>void)=>on('metadata',event,fn),getFileCache:()=>({})}},registerEvent(){},matches:()=>true,
  renderBoard(){calls.canvas++;},renderSaveStatus(){calls.status++;},populateSidebar(){calls.build++;lastList=new Element();return view.buildSidebar(lastList,view.sidebarRun);}});
 view.init();
 const emit=(surface:'vault'|'metadata',event:string,file=unrelated)=>{for(const fn of listeners[surface].get(event)||[])fn(file);};
 async function advance(ms=100){now+=ms;for(const[id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}for(const[id,fn]of [...frames]){frames.delete(id);fn();}await Promise.all(pending.splice(0));}
 return {view,plugin,board,calls,files,note,unrelated,pdf,emit,advance,timers,frames,get list(){return lastList;}};
}

for(const tab of ['boards','outline'] as const)test(`${tab}: unrelated note/PDF content events do not rebuild the sidebar`,async()=>{
 const f=fixture(tab);for(const file of [f.unrelated,f.pdf]){f.emit('vault','modify',file);await f.advance(150);f.emit('metadata','changed',file);await f.advance();}
 assert.deepEqual(f.calls,{build:0,readBoard:0,readNote:0,canvas:0,status:0});assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);
});

for(const tab of ['library','tasks'] as const)test(`${tab}: content and later metadata changes still rebuild current note data`,async()=>{
 const f=fixture(tab);f.emit('vault','modify');await f.advance(150);assert.equal(f.calls.build,1);assert.ok(f.calls.readNote>0);const readBefore=f.calls.readNote;
 f.emit('metadata','changed');await f.advance();assert.equal(f.calls.build,2);assert.ok(f.calls.readNote>readBefore);assert.equal(f.calls.canvas,0);
 const builds=f.calls.build;f.emit('vault','modify');f.emit('metadata','changed');await f.advance();assert.equal(f.calls.build,builds+1,'same-burst content notifications still coalesce');
});

test('referenced Markdown and PDF events still refresh the canvas while the board tree stays stable',async()=>{
 const f=fixture('boards');f.board.nodes.push({...f.board.nodes[0],id:'pdf',kind:'pdf',file:f.pdf.path});
 for(const file of [f.note,f.pdf]){const before=f.calls.canvas;f.emit('vault','modify',file);f.emit('metadata','changed',file);await f.advance();assert.equal(f.calls.canvas,before+1);}
 assert.equal(f.calls.build,0);assert.equal(f.calls.readBoard,0);
});

test('create, delete and rename still refresh both canvas and every sidebar page',async()=>{
 for(const tab of ['boards','outline','library','tasks'] as const)for(const event of ['create','delete','rename']){
  const f=fixture(tab);f.emit('vault',event);await f.advance();assert.equal(f.calls.canvas,1,`${tab}/${event}`);assert.equal(f.calls.build,1,`${tab}/${event}`);if(tab==='boards')assert.equal(f.calls.readBoard,30);
 }
});

test('whiteboard file changes keep navigation refresh and linked sub-board preview behavior',async()=>{
 for(const tab of ['boards','outline','library','tasks'] as const){
  const f=fixture(tab),child=f.files[1];f.emit('vault','modify',child);await f.advance();assert.equal(f.calls.build,1);assert.equal(f.calls.canvas,0);
  f.board.nodes.push({...f.board.nodes[0],id:'child',kind:'board',file:child.path});f.emit('vault','modify',child);await f.advance();assert.equal(f.calls.build,2);assert.equal(f.calls.canvas,1);
  f.emit('vault','modify',f.view.file);await f.advance();assert.equal(f.calls.build,2,'own board content is delivered by Session.paint');assert.equal(f.calls.canvas,1);
 }
});

test('session board events still rebuild all sidebars while save status updates stay narrow',async()=>{
 for(const tab of ['boards','outline','library','tasks'] as const){const f=fixture(tab);f.view.paint('board');await f.advance();assert.equal(f.calls.build,1);assert.equal(f.calls.canvas,1);f.view.paint('status');await f.advance();assert.equal(f.calls.build,1);assert.equal(f.calls.canvas,1);assert.equal(f.calls.status,1);}
});

test('metadata keeps the existing gesture and marquee canvas guards without suppressing content writes',async()=>{
 for(const guard of ['gesture','marquee'] as const)for(const tab of ['boards','library'] as const){
  const f=fixture(tab);f.view[guard]={};f.emit('metadata','changed',f.note);await f.advance();assert.equal(f.calls.canvas,0);assert.equal(f.calls.build,tab==='library'?1:0);
  f.emit('vault','modify',f.note);await f.advance();assert.equal(f.calls.canvas,1,'vault writes keep their existing scheduling path');f.view[guard]=undefined;f.emit('metadata','changed',f.note);await f.advance();assert.equal(f.calls.canvas,2);
 }
});

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

test('superseded sidebar scan stops after its current read, then a fresh search scans completely',async()=>{
 const f=fixture('boards'),gate=deferred<Board>(),list=new Element();let reads=0;
 f.plugin.readBoard=()=>{reads++;return reads===1?gate.promise:Promise.resolve(emptyBoard());};
 const stale=f.view.buildSidebar(list,f.view.sidebarRun),before=list.childElementCount;assert.equal(reads,1);
 f.view.query='boards/2';f.view.renderSidebar();gate.resolve(emptyBoard());await stale;
 assert.equal(reads,1,'an obsolete search must not read the remaining 29 boards');assert.equal(list.childElementCount,before);
 const fresh=new Element();await f.view.buildSidebar(fresh,f.view.sidebarRun);assert.equal(reads,31);assert.ok(fresh.childElementCount>before);
});

test('closing or changing the owning board cancels a pending sidebar scan',async()=>{
 for(const change of ['closed','owner'] as const){
  const f=fixture('boards'),gate=deferred<Board>(),list=new Element();let reads=0;f.plugin.readBoard=()=>{reads++;return reads===1?gate.promise:Promise.resolve(emptyBoard());};
  const stale=f.view.buildSidebar(list,f.view.sidebarRun),before=list.childElementCount;
  if(change==='closed')f.view.closed=true;else f.view.session={board:emptyBoard()};
  gate.resolve(emptyBoard());await stale;assert.equal(reads,1,change);assert.equal(list.childElementCount,before,change);
 }
});

test('a superseded failed read stops without reading more boards or drawing partial results',async()=>{
 const f=fixture('boards'),gate=deferred<Board>(),list=new Element();let reads=0;
 f.plugin.readBoard=()=>{reads++;return reads===1?gate.promise:Promise.resolve(emptyBoard());};
 const stale=f.view.buildSidebar(list,f.view.sidebarRun),before=list.childElementCount;f.view.tab='tasks';f.view.renderSidebar();gate.reject(Error('file removed during old scan'));await stale;
 assert.equal(reads,1);assert.equal(list.childElementCount,before);
});

test('an old delayed scan does not cancel or replace a newer completed scan',async()=>{
 const f=fixture('boards'),gate=deferred<Board>(),oldList=new Element();let reads=0;
 f.plugin.readBoard=()=>{reads++;return reads===1?gate.promise:Promise.resolve(emptyBoard());};
 const old=f.view.buildSidebar(oldList,f.view.sidebarRun),before=oldList.childElementCount;f.view.renderSidebar();const fresh=new Element();await f.view.buildSidebar(fresh,f.view.sidebarRun);
 assert.equal(reads,31);const freshCount=fresh.childElementCount;gate.resolve(emptyBoard());await old;
 assert.equal(reads,31);assert.equal(oldList.childElementCount,before);assert.equal(fresh.childElementCount,freshCount);assert.ok(freshCount>before);
});

test('graph cancellation returns no partial graph, while unscoped validation still returns all links and errors',async()=>{
 const f=fixture('boards');let reads=0;
 f.plugin.readBoard=async(file:File)=>{reads++;if(file===f.files[2])throw Error('bad board');const b=emptyBoard();if(file===f.files[0])b.nodes=[{id:'child',kind:'board',file:f.files[1].path,x:0,y:0,width:300,height:180,color:'sand'}];return b;};
 assert.equal(await f.plugin.boardGraph(()=>false),undefined);assert.equal(reads,0);
 assert.equal(await f.plugin.boardGraph(()=>reads<3),undefined);assert.equal(reads,3);
 reads=0;const result=await f.plugin.boardGraph();assert.equal(reads,30);assert.equal(result.graph.size,29);assert.deepEqual([...result.errors],[f.files[2].path]);assert.deepEqual(result.graph.get(f.files[0].path),[f.files[1].path]);
});


function nestedOutline(){const f=fixture('outline');const note=f.board.nodes[0];Object.assign(note,{x:100,y:100});f.board.nodes.unshift({id:'outer',kind:'section',title:'Outer',x:0,y:0,width:1000,height:800,color:'blue'},{id:'inner',kind:'section',title:'Inner',x:50,y:50,width:450,height:400,color:'green'});f.board.nodes.push({id:'loose',kind:'text',text:'Loose text',x:1200,y:50,width:160,height:100,color:'sand'});return f;}
const outlineRows=(list:Element)=>list.all().filter(el=>el.getAttribute('role')==='treeitem');
const rowIds=(list:Element)=>outlineRows(list).map(row=>row.getAttribute('data-outline-id'));
function click(list:Element,label:string){const button=list.all().find(el=>el.getAttribute('aria-label')===label);assert.ok(button?.onclick,`expected actionable ${label}`);button.onclick();}
test('real sidebar outline disclosure preserves parent levels and board geometry while refreshing only the list',async()=>{const f=nestedOutline(),before=JSON.stringify(f.board);f.view.renderSidebar();await f.advance();assert.deepEqual(rowIds(f.list),['outer','inner','note','loose']);assert.deepEqual(outlineRows(f.list).map(row=>row.getAttribute('aria-level')),['1','2','3','1']);click(f.list,'收起大纲 · Inner');await f.advance();assert.deepEqual(rowIds(f.list),['outer','inner','loose']);assert.equal(outlineRows(f.list)[1].getAttribute('aria-expanded'),'false');click(f.list,'展开大纲 · Inner');await f.advance();assert.deepEqual(rowIds(f.list),['outer','inner','note','loose']);click(f.list,'收起大纲分组');await f.advance();assert.deepEqual(rowIds(f.list),['outer','loose']);click(f.list,'展开大纲分组');await f.advance();assert.deepEqual(rowIds(f.list),['outer','inner','note','loose']);assert.equal(JSON.stringify(f.board),before);assert.equal(f.calls.canvas,0);assert.equal(f.calls.readNote,0);});
test('real sidebar filtered outline exposes ancestors of matches and restores disclosure after clearing search',async()=>{const f=nestedOutline();f.view.outlineCollapsed=new Set(['outer','inner']);f.view.renderSidebar();await f.advance();assert.deepEqual(rowIds(f.list),['outer','loose']);f.view.query='Note';f.view.outlineKind='card';f.view.renderSidebar();await f.advance();assert.deepEqual(rowIds(f.list),['outer','inner','note']);assert.deepEqual(outlineRows(f.list).slice(0,2).map(row=>row.getAttribute('aria-expanded')),['true','true']);assert.deepEqual([...f.view.outlineCollapsed],['outer','inner']);f.view.query='no such content';f.view.renderSidebar();await f.advance();assert.deepEqual(rowIds(f.list),[]);f.view.query='';f.view.outlineKind='all';f.view.renderSidebar();await f.advance();assert.deepEqual(rowIds(f.list),['outer','loose']);assert.equal(f.calls.canvas,0);assert.equal(f.calls.readNote,0);});
