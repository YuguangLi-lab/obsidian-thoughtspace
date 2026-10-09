import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

function fixture(mode='source'){
 const timers=new Map<number,{run:()=>void;delay:number}>(),jobs:Array<{value:string;finish:(failed?:boolean)=>void}>=[];
 let timerId=0,source='Saved document',reads=0,saves=0,time=0;
 const clock={setTimeout:(run:()=>void,delay:number)=>{timers.set(++timerId,{run,delay});return timerId;},clearTimeout:(id:number)=>timers.delete(id)};
 const file={path:'Boards/Document.md',extension:'md'},files=new Map([[file.path,file]]);
 class MarkdownView {
  file:typeof file|null=file;mode=mode;value=source;saving=false;saveAgain=false;
  editor={getValue:()=>this.value};getViewData(){return this.value;}getMode(){return this.mode;}
  async save(){
   saves++;if(this.saving){this.saveAgain=true;return;}
   if(this.file!==file||source===this.value)return;
   const value=this.value;this.saving=true;this.saveAgain=false;
   await new Promise<void>(resolve=>jobs.push({value,finish:failed=>{if(!failed)source=value;this.saving=false;if(this.saveAgain){this.saveAgain=false;void this.save();}resolve();}}));
  }
 }
 const view=new MarkdownView(),leaf={view,isDeferred:false,getViewState:()=>({type:'markdown',state:{file:file.path}})},leaves:any[]=[leaf];
 const module={exports:{} as any};
 new Function('require','module','exports',transformSync(readFileSync('src/board-editor-ownership.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView}),module,module.exports);
 const app={workspace:{containerEl:{ownerDocument:{defaultView:clock}},getLeavesOfType:(type:string)=>type==='markdown'?leaves:[]},vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>{reads++;return source;}}};
 const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
 const advance=async()=>{
  if(!timers.size){await tick();return;}
  const delay=Math.min(...[...timers.values()].map(timer=>timer.delay));time+=delay;
  const due:[number,{run:()=>void;delay:number}][]=[];
  for(const [id,timer]of timers){timer.delay-=delay;if(timer.delay<=0)due.push([id,timer]);}
  for(const [id,timer]of due){if(timers.delete(id))timer.run();}await tick();
 };
 return{api:module.exports,app,file,files,view,leaf,leaves,MarkdownView,timers,jobs,tick,advance,
  disk:(value:string)=>{source=value;},source:()=>source,counts:()=>({reads,saves,time}),
  settle:()=>module.exports.settleNativeBoardEditor(app,file,leaf) as Promise<void>};
}

for(const mode of ['source','preview'])test(`a ${mode} native page owns the file even with no unsaved text`,()=>{
 const f=fixture(mode);assert.deepEqual(f.api.nativeBoardEditorLeaves(f.app,f.file),[f.leaf]);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);
 assert.throws(()=>f.api.assertBoardEditorOwnership(f.app,f.file),/原生.*Markdown|原生.*属性/);
});
test('all native pages are returned while unrelated files and non-Markdown views are ignored',()=>{
 const f=fixture(),second={view:new f.MarkdownView(),isDeferred:false},other={view:Object.assign(new f.MarkdownView(),{file:{path:'Other.md'}}),isDeferred:false};
 f.leaves.push(second,other,{view:{file:f.file},isDeferred:false});assert.deepEqual(f.api.nativeBoardEditorLeaves(f.app,f.file),[f.leaf,second]);
});
test('a deferred Markdown page locks by state without loading its file',()=>{
 const f=fixture();let loads=0;const deferred={view:{file:null},isDeferred:true,getViewState:()=>({type:'markdown',state:{file:f.file.path}}),loadIfDeferred:()=>{loads++;}};
 f.leaves.splice(0,1,deferred);assert.deepEqual(f.api.nativeBoardEditorLeaves(f.app,f.file),[deferred]);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);assert.equal(loads,0);
 assert.throws(()=>f.api.assertBoardEditorOwnership(f.app,f.file),/原生/);
});
test('removing every native page releases ownership without retaining file state',()=>{
 const f=fixture();f.leaves.length=0;assert.deepEqual(f.api.nativeBoardEditorLeaves(f.app,f.file),[]);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);assert.doesNotThrow(()=>f.api.assertBoardEditorOwnership(f.app,f.file));
});
test('a non-deferred old state for a different file does not lock this document',()=>{
 const f=fixture();f.view.file={path:'Other.md',extension:'md'};assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),false);
});

for(const mode of ['source','preview'])test(`a settled ${mode} page completes the explicit save barrier`,async()=>{
 const f=fixture(mode);await f.settle();assert.equal(f.counts().saves,mode==='preview'?0:1);assert.equal(f.timers.size,0);assert.equal(f.leaf.view,f.view);assert.equal(f.api.hasNativeBoardEditor(f.app,f.file),true);
});
test('explicit source conversion saves the current editor text before returning',async()=>{
 const f=fixture();f.view.value='Latest source document';let finished=false;const settling=f.settle().then(()=>finished=true);await f.tick();
 assert.equal(finished,false);assert.equal(f.jobs.length,1);f.jobs[0].finish();await f.tick();if(f.timers.size)await f.advance();await settling;
 assert.equal(f.source(),f.view.value);assert.equal(f.timers.size,0);
});
test('an already running save and its saveAgain follow-up both finish before conversion',async()=>{
 const f=fixture();f.view.value='First';const prior=f.view.save();f.view.value='Latest';const settling=f.settle();void settling.catch(()=>{});await f.tick();
 f.jobs[0].finish();await prior;await f.advance();assert.equal(f.jobs.length,2);assert.equal(f.jobs[1].value,'Latest');
 let done=false;void settling.then(()=>done=true);await f.tick();assert.equal(done,false);f.jobs[1].finish();await f.advance();await settling;assert.equal(f.source(),'Latest');assert.equal(f.timers.size,0);
});
test('reading mode never saves a stale cached document over newer Properties',async()=>{
 const f=fixture('preview');f.disk('New native Properties');await assert.rejects(f.settle(),/阅读|同步|缓存/);
 assert.equal(f.counts().saves,0);assert.equal(f.source(),'New native Properties');assert.equal(f.timers.size,0);
});
test('Properties changed after a reading preflight cannot be overwritten by the helper',async()=>{
 const f=fixture('preview');let first=true;f.app.vault.read=async()=>{const current=f.source();if(first){first=false;f.disk('Later Properties');}return current;};
 await assert.rejects(f.settle(),/保存完成|同步/);assert.equal(f.source(),'Later Properties');assert.equal(f.counts().saves,0);assert.equal(f.timers.size,0);
});
test('source editor and public view data disagreement prevents a save',async()=>{
 const f=fixture();f.view.getViewData=()=> 'Different public text';await assert.rejects(f.settle(),/原生|同步/);assert.equal(f.counts().saves,0);
});
for(const state of ['missing','accessor','wrong-type'] as const)test(`an unknown ${state} native saving state refuses conversion`,async()=>{
 const f=fixture();if(state==='missing')delete (f.view as Partial<typeof f.view>).saving;
 else if(state==='accessor')Object.defineProperty(f.view,'saving',{get:()=>false});else Object.defineProperty(f.view,'saving',{value:'false'});
 await assert.rejects(f.settle(),/保存状态|保存完成/);assert.equal(f.counts().saves,0);assert.equal(f.timers.size,0);
});
for(const other of ['loaded','deferred'] as const)test(`another ${other} native page refuses conversion before saving either page`,async()=>{
 const f=fixture();f.leaves.push(other==='loaded'?{view:new f.MarkdownView(),isDeferred:false}:{view:{},isDeferred:true,getViewState:()=>({type:'markdown',state:{file:f.file.path}})});
 await assert.rejects(f.settle(),/其他|多个|另一个/);assert.equal(f.counts().saves,0);assert.equal(f.timers.size,0);
});
for(const mutation of ['edit','close','switch','mode','rename','delete','replace','another','unknown-saving'] as const)test(`a ${mutation} during saving cancels conversion and retains the native page`,async()=>{
 const f=fixture();f.view.value='Draft';const settling=f.settle();void settling.catch(()=>{});await f.tick();assert.equal(f.jobs.length,1);
 if(mutation==='edit')f.view.value='Later input';else if(mutation==='close')f.leaves.length=0;
 else if(mutation==='switch')f.leaf.view=new f.MarkdownView();else if(mutation==='mode')f.view.mode='preview';
 else if(mutation==='rename')f.file.path='Boards/Renamed.md';else if(mutation==='delete')f.files.clear();
 else if(mutation==='replace')f.files.set(f.file.path,{...f.file});else if(mutation==='another')f.leaves.push({view:new f.MarkdownView(),isDeferred:false});
 else delete (f.view as Partial<typeof f.view>).saving;
 f.jobs[0].finish();if(mutation==='unknown-saving')delete (f.view as Partial<typeof f.view>).saving;
 await f.tick();await f.advance();await assert.rejects(settling,/原生|移动|删除|变化|其他|保存状态/);assert.equal(f.timers.size,0);
});
test('failed native save propagates without changing the view or file',async()=>{
 const f=fixture();f.view.save=async()=>{throw Error('Native disk unavailable');};await assert.rejects(f.settle(),/Native disk unavailable/);assert.equal(f.source(),'Saved document');assert.equal(f.leaf.view,f.view);assert.equal(f.timers.size,0);
});
test('a native save that resolves without persisting its draft refuses conversion',async()=>{
 const f=fixture();f.view.value='Draft';f.view.save=async()=>{};await assert.rejects(f.settle(),/未保存|同步|保存完成/);assert.equal(f.source(),'Saved document');assert.equal(f.timers.size,0);
});
test('an unresponsive public save has a bounded timeout and no remaining poll timers',async()=>{
 const f=fixture();f.view.value='Draft';f.view.save=()=>new Promise<void>(()=>{});const settling=f.settle();void settling.catch(()=>{});await f.tick();
 for(let i=0;i<45&&f.timers.size;i++)await f.advance();await assert.rejects(settling,/超时|仍在保存/);assert(f.counts().time<=1200);assert.equal(f.timers.size,0);assert.equal(f.source(),'Saved document');
});
test('an unresponsive disk read shares the bounded deadline',async()=>{
 const f=fixture('preview');f.app.vault.read=()=>new Promise<string>(()=>{});const settling=f.settle();void settling.catch(()=>{});await f.tick();
 for(let i=0;i<45&&f.timers.size;i++)await f.advance();await assert.rejects(settling,/超时|仍在保存/);assert(f.counts().time<=1200);assert.equal(f.counts().saves,0);assert.equal(f.timers.size,0);
});
test('late rejection after timeout cannot become an unhandled rejection or resume conversion',async()=>{
 const f=fixture();let reject!:(error:Error)=>void;f.view.save=()=>new Promise<void>((_,fail)=>reject=fail);const settling=f.settle();void settling.catch(()=>{});await f.tick();
 for(let i=0;i<45&&f.timers.size;i++)await f.advance();await assert.rejects(settling,/超时|仍在保存/);reject(Error('Late native failure'));await f.tick();assert.equal(f.timers.size,0);assert.equal(f.leaf.view,f.view);
});
test('a change during final disk read is rejected before a native page can be detached',async()=>{
 const f=fixture();f.app.vault.read=async()=>{f.view.value='New input during read';return f.source();};await assert.rejects(f.settle(),/原生|变化/);assert.equal(f.leaf.view,f.view);assert.equal(f.timers.size,0);
});
test('a deferred target is never loaded or saved by the conversion barrier',async()=>{
 const f=fixture();f.leaf.isDeferred=true;await assert.rejects(f.settle(),/延迟|原生|就绪/);assert.equal(f.counts().saves,0);assert.equal(f.timers.size,0);
});
test('after a refused reading-cache conversion, a synchronized retry succeeds',async()=>{
 const f=fixture('preview');f.disk('New Properties');await assert.rejects(f.settle(),/阅读|同步|缓存/);f.view.value=f.source();await f.settle();assert.equal(f.counts().saves,0);assert.equal(f.timers.size,0);
});
