import test from 'node:test';import assert from 'node:assert/strict';import {buildSync} from 'esbuild';
const code=buildSync({entryPoints:['src/task-planner.ts'],bundle:true,write:false,format:'cjs',platform:'node',external:['obsidian']}).outputFiles[0].text;
const deferred=()=>{let resolve!:(v?:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function host(){
 class TFile{path='T.md';extension='md';stat={mtime:1,size:14};}class Component{registerEvent(){} }
 const module={exports:{} as any};new Function('require','module','exports',code)((id:string)=>{if(id==='obsidian')return{Component,TFile};throw Error(id);},module,module.exports);
 const file=new TFile(),events=new Map<string,Function[]>();let body='- [ ] OLD TASK',reads=0;
 const vault={getAbstractFileByPath:(path:string)=>path===file.path?file:null,getMarkdownFiles:()=>[file],cachedRead:async()=>body,read:async()=>{reads++;return body;},process:async(_f:any,fn:Function)=>{body=fn(body);for(const f of events.get('modify')||[])f(file);},on:(name:string,fn:Function)=>{events.set(name,[...(events.get(name)||[]),fn]);return{};}};
 const p=new module.exports.TaskPlanner({vault},()=> 'D');
 // Explicit flushes drive the same event invalidation without installing timers in Node.
 p.schedule=()=>{};p.onload();return {p,vault,file,read:()=>body,write:(next:string)=>{body=next;for(const f of events.get('modify')||[])f(file);},readCount:()=>reads};
}
test('modify event invalidates an equal-mtime equal-size cache entry',async()=>{const h=host();await h.p.ready();h.write('- [ ] NEW TASK');await h.p.flush();assert.equal(h.p.all()[0].text,'NEW TASK');});
test('100 rapid native-style writes and undo maintain cache/file consistency',async()=>{const h=host();await h.p.ready();for(let i=0;i<100;i++){const t=h.p.all()[0];await h.p.update(t,{checked:!t.checked});assert.equal(h.p.all()[0].source,h.read());}await h.p.undoLast();assert.equal(h.p.all()[0].checked,true);assert.equal(h.p.all()[0].source,h.read());});
test('a stale read failure cannot erase the successful newer index',async()=>{const h=host();await h.p.ready();const entered=deferred(),gate=deferred(),read=h.vault.read;let first=true;h.vault.read=async()=>{if(first){first=false;entered.resolve();return gate.promise;}return read();};const scan=h.p.rescan();await entered.promise;await h.p.update(h.p.all()[0],{content:'NEW TASK'});gate.reject(Error('old read failed'));await scan;assert.equal(h.p.all()[0].text,'NEW TASK');assert.equal(h.p.failures.size,0);});
test('a modification during an in-flight scan is picked up even with an unchanged timestamp',async()=>{const h=host();await h.p.ready();const entered=deferred(),gate=deferred(),read=h.vault.read;let first=true;h.vault.read=async()=>{if(first){first=false;const old=h.read();entered.resolve();await gate.promise;return old;}return read();};const scan=h.p.rescan();await entered.promise;h.write('- [ ] NEW TASK');gate.resolve();await scan;assert.equal(h.p.all()[0].source,h.read());});
test('reading unchanged ready state does not rescan the vault',async()=>{const h=host();await h.p.ready();const reads=h.readCount();for(let i=0;i<20;i++)await h.p.ready();assert.equal(h.readCount(),reads);});
test('a late modify notification during the post-write read must settle before update resolves',async()=>{const h=host();await h.p.ready();const read=h.vault.read;let once=true;h.vault.read=async()=>{const snapshot=await read();if(once){once=false;h.write(snapshot);}return snapshot;};await h.p.update(h.p.all()[0],{checked:true});assert.equal(h.p.all()[0].source,h.read());});
test('real update path stamps completion day, reopens cleanly, and undo restores original source',async()=>{
 const h=host();await h.p.ready();const original=h.read(),today=new Date(),day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 await h.p.update(h.p.all()[0],{checked:true});assert.equal(h.p.all()[0].completedOn,day);
 const completed=h.read();await h.p.update(h.p.all()[0],{checked:true});assert.equal(h.read(),completed);
 await h.p.update(h.p.all()[0],{checked:false});assert.equal(h.read(),original);assert.equal(h.p.all()[0].completedOn,undefined);
 await h.p.undoLast();assert.equal(h.read(),completed);
});
