import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

type Note={path:string;extension:string};
type ViewState={type:string;state:Record<string,unknown>;pinned?:boolean};
type OpenOptions={state?:{mode:string};eState?:{subpath:string}};
class MarkdownView {
 state:Record<string,unknown>={};
 focused=0;
 containerEl={closest:(selector:string)=>selector==='.mod-right-split'?{}:null};
 editor={focus:()=>{this.focused++;}};
 getMode(){return this.state.mode||'source';}
 getState(){return {...this.state};}
}
class BoardView {
 prepareNoteOpen:(_file:Note)=>Promise<void>=async()=>{};
}
class Leaf {
 view=new MarkdownView();
 type='empty';
 isDeferred=false;
 loaded=0;
 opened:{file:Note;options:OpenOptions}[]=[];
 states:ViewState[]=[];
 ephemeral:{subpath:string}[]=[];
 beforeOpen?:(_file:Note)=>Promise<void>;
 constructor(readonly id:string){}
 getViewState():ViewState{return {type:this.type,state:{...this.view.state},pinned:false};}
 async openFile(file:Note,options:OpenOptions){
  this.opened.push({file,options});
  await this.beforeOpen?.(file);
  this.type='markdown';this.view.state={file:file.path,...options.state};
 }
 async setViewState(state:ViewState){this.states.push(state);this.type=state.type;this.view.state={...state.state};}
 async loadIfDeferred(){this.loaded++;this.isDeferred=false;}
 setEphemeralState(state:{subpath:string}){this.ephemeral.push(state);}
}
const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('  openNoteInSidebar('),end=source.indexOf('\n  async waitNoteTags(',start);
assert.ok(start>=0&&end>start,'extract the production note sidebar method');
const Host=new Function('BoardView','MarkdownView','VIEW','isPdfFile','workspaceLeafId',
 transformSync(`class Host {${source.slice(start,end)}};return Host`,{loader:'ts'}).code,
)(BoardView,MarkdownView,'thoughtspace',(path:string)=>path.endsWith('.pdf'),(leaf:Leaf)=>leaf.id);
function fixture(){
 const a:Note={path:'Notes/A.md',extension:'md'},b:Note={path:'Notes/B.md',extension:'md'};
 const files=new Map([a,b].map(file=>[file.path,file]));
 const leaves:Leaf[]=[],board=new BoardView(),prepared:string[]=[],revealed:string[]=[],active:Leaf[]=[],saved:string[]=[];
 const host=new Host();host.noteQueue=Promise.resolve();host.settings={} as {notePaneLeafId?:string};
 board.prepareNoteOpen=async file=>{prepared.push(file.path);};
 host.saveData=async(settings:{notePaneLeafId?:string})=>{saved.push(settings.notePaneLeafId!);};
 host.app={vault:{getAbstractFileByPath:(path:string)=>files.get(path)},workspace:{
  getLeavesOfType:(type:string)=>type==='thoughtspace'?[{view:board}]:leaves.filter(leaf=>leaf.type===type),
  getLeafById:(id:string)=>leaves.find(leaf=>leaf.id===id),
  getRightLeaf:()=>{const leaf=new Leaf(`leaf-${leaves.length+1}`);leaves.push(leaf);return leaf;},
  revealLeaf:async(leaf:Leaf)=>{revealed.push(String(leaf.view.state.file));},
  setActiveLeaf:(leaf:Leaf)=>{active.push(leaf);},
 }};
 const existing=(file:Note,mode='source',extra:Record<string,unknown>={})=>{
  const leaf=new Leaf(`leaf-${leaves.length+1}`);leaf.type='markdown';leaf.view.state={file:file.path,mode,...extra};leaves.push(leaf);return leaf;
 };
 return {host,a,b,board,leaves,prepared,revealed,active,saved,existing};
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}

test('explicit reading opens a new sidebar leaf in preview mode without editor focus',async()=>{
 const f=fixture(),leaf:Leaf=await f.host.openNoteInSidebar(f.a,'#Methods',false,true);
 assert.equal(f.leaves.length,1);
 assert.deepEqual(leaf.opened,[{file:f.a,options:{state:{mode:'preview'},eState:{subpath:'#Methods'}}}]);
 assert.deepEqual(f.prepared,[f.a.path]);assert.deepEqual(f.revealed,[f.a.path]);
 assert.deepEqual(f.saved,[leaf.id]);assert.equal(f.host.settings.notePaneLeafId,leaf.id);
 assert.equal(leaf.view.focused,0);assert.deepEqual(f.active,[]);
});

test('explicit reading reuses a deferred matching leaf and preserves its other state',async()=>{
 const f=fixture(),leaf=f.existing(f.a,'source',{scroll:42});leaf.isDeferred=true;
 assert.equal(await f.host.openNoteInSidebar(f.a,'#Results',false,true),leaf);
 assert.equal(f.leaves.length,1);assert.equal(leaf.loaded,1);assert.equal(leaf.opened.length,0);
 assert.deepEqual(leaf.view.state,{file:f.a.path,mode:'preview',scroll:42});
 assert.equal(leaf.states.length,1);assert.deepEqual(leaf.ephemeral,[{subpath:'#Results'}]);
 assert.equal(leaf.view.focused,0);
});

test('reading an existing preview leaves its view state untouched',async()=>{
 const f=fixture(),leaf=f.existing(f.a,'preview',{scroll:17});
 assert.equal(await f.host.openNoteInSidebar(f.a,undefined,false,true),leaf);
 assert.equal(leaf.states.length,0);assert.equal(leaf.opened.length,0);
 assert.deepEqual(leaf.view.state,{file:f.a.path,mode:'preview',scroll:17});
});

test('explicit reading reuses the remembered note pane for a different file',async()=>{
 const f=fixture(),leaf=f.existing(f.a);f.host.settings.notePaneLeafId=leaf.id;
 assert.equal(await f.host.openNoteInSidebar(f.b,undefined,false,true),leaf);
 assert.equal(f.leaves.length,1);assert.equal(leaf.opened.length,1);
 assert.deepEqual(leaf.opened[0],{file:f.b,options:{state:{mode:'preview'},eState:undefined}});
 assert.equal(leaf.view.state.file,f.b.path);assert.equal(leaf.view.getMode(),'preview');
});

test('queued reading of A then B does not race or create duplicate sidebar leaves',async()=>{
 const f=fixture(),leaf=f.existing(f.b),started=deferred(),release=deferred();
 f.host.settings.notePaneLeafId=leaf.id;
 leaf.beforeOpen=async file=>{if(file===f.a){started.resolve();await release.promise;}};
 const first=f.host.openNoteInSidebar(f.a,undefined,false,true),second=f.host.openNoteInSidebar(f.b,undefined,false,true);
 await started.promise;
 assert.deepEqual(f.prepared,[f.a.path]);assert.deepEqual(leaf.opened.map(call=>call.file.path),[f.a.path]);
 assert.deepEqual(f.saved,[]);assert.deepEqual(f.revealed,[]);
 release.resolve();assert.deepEqual(await Promise.all([first,second]),[leaf,leaf]);
 assert.equal(f.leaves.length,1);assert.deepEqual(f.prepared,[f.a.path,f.b.path]);
 assert.deepEqual(f.revealed,[f.a.path,f.b.path]);assert.deepEqual(leaf.opened.map(call=>call.options.state),[{mode:'preview'},{mode:'preview'}]);
 assert.equal(leaf.view.state.file,f.b.path);assert.equal(leaf.view.getMode(),'preview');
});

test('the default opening path does not force a mode for either new or reused files',async()=>{
 const f=fixture(),leaf:Leaf=await f.host.openNoteInSidebar(f.a);
 assert.deepEqual(leaf.opened[0].options,{state:undefined,eState:undefined});
 leaf.view.state={file:f.a.path,mode:'source',scroll:8};
 assert.equal(await f.host.openNoteInSidebar(f.a),leaf);
 assert.equal(leaf.states.length,0);assert.equal(leaf.opened.length,1);
 assert.deepEqual(leaf.view.state,{file:f.a.path,mode:'source',scroll:8});
});

for(const reuse of [false,true])test(`editing wins over reading for a ${reuse?'reused':'new'} leaf`,async()=>{
 const f=fixture(),existing=reuse?f.existing(f.a,'preview'):undefined;
 const leaf:Leaf=await f.host.openNoteInSidebar(f.a,undefined,true,true);
 if(existing){assert.equal(leaf,existing);assert.equal(leaf.opened.length,0);assert.equal(leaf.states.length,1);}
 else assert.deepEqual(leaf.opened[0].options.state,{mode:'source'});
 assert.equal(leaf.view.getMode(),'source');assert.deepEqual(f.active,[leaf]);assert.equal(leaf.view.focused,1);
});

test('an inline draft conflict prevents reading from replacing the sidebar file or mode and the queue recovers',async()=>{
 const f=fixture(),leaf=f.existing(f.a,'source',{scroll:29});f.host.settings.notePaneLeafId=leaf.id;
 const before=leaf.getViewState();f.board.prepareNoteOpen=async()=>{throw Error('草稿冲突，不能打开笔记');};
 await assert.rejects(f.host.openNoteInSidebar(f.b,undefined,false,true),/草稿冲突/);
 assert.equal(f.leaves.length,1);assert.deepEqual(leaf.getViewState(),before);
 assert.equal(leaf.opened.length,0);assert.equal(leaf.states.length,0);
 assert.deepEqual(f.saved,[]);assert.deepEqual(f.revealed,[]);assert.deepEqual(f.active,[]);
 f.board.prepareNoteOpen=async()=>{};
 assert.equal(await f.host.openNoteInSidebar(f.b,undefined,false,true),leaf);
 assert.equal(leaf.view.state.file,f.b.path);assert.equal(leaf.view.getMode(),'preview');
});
