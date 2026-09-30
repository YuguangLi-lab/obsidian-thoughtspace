import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

function fixture(){
 const timers=new Map<number,()=>void>(),delays:number[]=[],jobs:Array<{value:string;finish:(failed?:boolean)=>void}>=[];
 const sourceTimers=new Set<number>();let timerId=0,source='原文',reads=0,saves=0,workspaceTimers=0;
 const schedule=(run:()=>void,delay:number)=>{delays.push(delay);timers.set(++timerId,run);return timerId;};
 const file={path:'note.md'},files=new Map([[file.path,file]]);
 class MarkdownView {
  file:typeof file|null=file;mode='source';value='最新原生正文';saving=false;saveAgain=false;
  containerEl={ownerDocument:{defaultView:{setTimeout:(run:()=>void,delay:number)=>{const id=schedule(run,delay);sourceTimers.add(id);return id;}}}};
  editor={getValue:()=>this.value};getMode(){return this.mode;}
  async save(){
   saves++;if(this.saving){this.saveAgain=true;return;}
   if(this.file!==file||source===this.value)return;
   const value=this.value;this.saving=true;this.saveAgain=false;
   await new Promise<void>(resolve=>jobs.push({value,finish:failed=>{if(!failed)source=value;this.saving=false;if(this.saveAgain){this.saveAgain=false;void this.save();}resolve();}}));
  }
 }
 const view=new MarkdownView(),views=[view],module={exports:{} as any};
 new Function('require','module','exports',transformSync(readFileSync('src/native-note-state.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView}),module,module.exports);
 const app={workspace:{containerEl:{ownerDocument:{defaultView:{setTimeout:(run:()=>void,delay:number)=>{workspaceTimers++;return schedule(run,delay);}}}},getLeavesOfType:()=>views.map(view=>({view}))},vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>{reads++;return source;}}};
 const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 const advance=async()=>{const batch=[...timers.values()];timers.clear();for(const run of batch)run();await tick();};
 return{view,views,file,files,timers,delays,jobs,tick,advance,read:()=>module.exports.readCurrentNativeNote(app,file) as Promise<string>,disk:(value:string)=>{source=value;},closeSourceClock:()=>{for(const id of sourceTimers)timers.delete(id);views.length=0;},workspaceTimerCount:()=>workspaceTimers,counts:()=>({reads,saves})};
}

test('opening an inline note waits for an already running native save instead of misreporting a conflict',async()=>{
 const f=fixture(),saving=f.view.save();let settled=false;
 const reading=f.read().then(value=>{settled=true;return{value};},error=>{settled=true;return{error};});await f.tick();
 assert.equal(settled,false,'the host save() returns early while its first write is still in flight');
 f.jobs[0].finish();await saving;await f.advance();assert.deepEqual(await reading,{value:'最新原生正文'});
 assert.equal(f.timers.size,0);assert.equal(f.counts().reads,1);
});

test('a native saveAgain chain finishes before the inline draft captures its baseline',async()=>{
 const f=fixture();f.view.value='第一版';const saving=f.view.save();f.view.value='第二版';
 const reading=f.read();void reading.catch(()=>{});await f.tick();f.jobs[0].finish();await saving;await f.advance();
 assert.equal(f.jobs[1].value,'第二版');assert.equal(f.counts().reads,0);
 f.jobs[1].finish();await f.advance();assert.equal(await reading,'第二版');assert.equal(f.timers.size,0);
});

test('a settled native editor starts an inline draft without a polling delay',async()=>{
 const f=fixture();f.disk(f.view.value);assert.equal(await f.read(),f.view.value);assert.equal(f.timers.size,0);assert.deepEqual(f.counts(),{reads:1,saves:1});
});

test('divergent native panes are rejected before either pane is saved',async()=>{
 const f=fixture(),second=Object.assign(Object.create(Object.getPrototypeOf(f.view)),f.view,{value:'不同的正文',editor:{getValue:()=> '不同的正文'}});f.views.push(second);
 await assert.rejects(f.read(),/多个笔记窗口/);assert.equal(f.counts().saves,0);assert.equal(f.timers.size,0);
});

for(const mutation of ['edit','close','switch','preview','rename','delete','replace'] as const)test(`a ${mutation} during a pending native save cannot become a stale inline baseline`,async()=>{
 const f=fixture();void f.view.save();const reading=f.read();void reading.catch(()=>{});await f.tick();
 if(mutation==='edit')f.view.value='后到的原生编辑';else if(mutation==='close')f.views.length=0;
 else if(mutation==='switch')f.view.file={path:'other.md'};else if(mutation==='preview')f.view.mode='preview';
 else if(mutation==='rename')f.file.path='renamed.md';else if(mutation==='delete')f.files.delete(f.file.path);
 else f.files.set(f.file.path,{path:f.file.path});
 // Completion in this interval must not skip the final revalidation.
 f.view.saveAgain=false;f.jobs[0].finish();await f.advance();
 await assert.rejects(reading,/原生笔记有新的编辑|窗口已切换|移动或删除/);assert.equal(f.counts().reads,0);assert.equal(f.timers.size,0);
});

test('a failed awaited native save propagates its error without reading a draft baseline',async()=>{
 const f=fixture();f.view.save=async()=>{throw Error('磁盘暂不可写');};
 await assert.rejects(f.read(),/磁盘暂不可写/);assert.equal(f.counts().reads,0);assert.equal(f.timers.size,0);
});

test('an unsuccessful already running native write cannot return older disk text as the baseline',async()=>{
 const f=fixture();void f.view.save();const reading=f.read();void reading.catch(()=>{});await f.tick();
 f.view.saveAgain=false;f.jobs[0].finish(true);await f.advance();
 await assert.rejects(reading,/原生笔记有新的编辑/);assert.equal(f.timers.size,0);
});

test('an unresponsive native save yields within one second without reading or overwriting the file',async()=>{
 const f=fixture();void f.view.save();const reading=f.read();void reading.catch(()=>{});await f.tick();
 for(let i=0;i<45;i++)await f.advance();await assert.rejects(reading,/仍在保存/);
 assert.equal(f.delays.reduce((sum,delay)=>sum+delay,0),1000);assert.equal(f.counts().reads,0);assert.equal(f.timers.size,0);
});

test('disk changes remain protected when a host does not expose its pending-save flag',async()=>{
 const f=fixture();delete (f.view as Partial<typeof f.view>).saving;f.view.save=async()=>{};
 await assert.rejects(f.read(),/原生笔记有新的编辑/);assert.equal(f.timers.size,0);
});

test('closing the source popout cannot strand a pending read on that destroyed window clock',async()=>{
 const f=fixture();void f.view.save();let result:{value?:string;error?:unknown}|undefined;
 const reading=f.read().then(value=>{result={value};},error=>{result={error};});await f.tick();
 f.closeSourceClock();await f.advance();
 assert.ok(result,'the workspace clock must finish validation even after source-window timers disappear');
 assert.match(String(result.error),/窗口已切换/);await reading;
 assert.equal(f.workspaceTimerCount(),1);assert.equal(f.counts().reads,0);assert.equal(f.timers.size,0);
});
