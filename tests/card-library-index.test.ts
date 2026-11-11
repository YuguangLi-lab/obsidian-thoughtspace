import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryBoardReader} from '../src/card-library-index';
import type {LibraryBoardSource} from '../src/card-property-views';

const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
const board=(path:string):LibraryBoardSource=>({path,title:path,files:[path+'.md']});
const paths=(count:number,prefix='白板')=>Array.from({length:count},(_,i)=>prefix+' '+i+'.thoughtspace');

function deferredReader(){
 const pending=new Map<string,{resolve:(source:LibraryBoardSource)=>void;reject:(error:Error)=>void}>();
 const started:string[]=[];
 let peak=0;
 const read=(path:string)=>new Promise<LibraryBoardSource>((resolve,reject)=>{
  assert.equal(pending.has(path),false);
  started.push(path);
  pending.set(path,{resolve,reject});
  peak=Math.max(peak,pending.size);
 });
 const settle=(path:string,fail=false)=>{
  const wait=pending.get(path);
  assert.ok(wait);
  pending.delete(path);
  if(fail)wait.reject(Error('Unreadable board'));else wait.resolve(board(path));
 };
 return {read,pending,started,settle,peak:()=>peak};
}

test('eager indexing overlaps 200 reads in 50 I/O turns without reordering boards',async()=>{
 const files=paths(200),io=deferredReader(),scan=createLibraryBoardReader(io.read);
 const result=scan(files,()=>true);
 let turns=0,completed=0;
 await turn();
 while(completed<files.length){
  const batch=[...io.pending.keys()].reverse();
  assert.ok(batch.length);
  for(const path of batch)io.settle(path);
  completed+=batch.length;turns++;
  await turn();
 }
 assert.equal(io.peak(),4);
 assert.equal(turns,50);
 assert.deepEqual(io.started,files);
 const indexed=await result;
 assert.deepEqual(indexed?.boards.map(item=>item.path),files);
 assert.deepEqual(indexed?.failed,[]);
});

test('failed files remain in the retry list in input order and do not stop successful reads',async()=>{
 const files=paths(9),io=deferredReader(),scan=createLibraryBoardReader(io.read);
 const failures=[files[1],files[3],files[8]];
 const result=scan(files,()=>true);
 await turn();
 while(io.pending.size){
  for(const path of [...io.pending.keys()].reverse())io.settle(path,failures.includes(path));
  await turn();
 }
 assert.deepEqual(await result,{boards:files.filter(path=>!failures.includes(path)).map(board),failed:failures});
 const retry=scan(failures,()=>true);
 await turn();
 for(const path of failures)io.settle(path);
 assert.deepEqual(await retry,{boards:failures.map(board),failed:[]});
});

test('a superseded modal releases read slots as they finish and never returns a partial index',async()=>{
 const oldFiles=paths(12,'旧版'),newFiles=paths(5,'新版'),io=deferredReader(),scan=createLibraryBoardReader(io.read);
 let current=true;
 const old=scan(oldFiles,()=>current);
 await turn();
 assert.deepEqual(io.started,oldFiles.slice(0,4));
 current=false;
 const latest=scan(newFiles,()=>true);
 await turn();
 assert.deepEqual([...io.pending.keys()],oldFiles.slice(0,4));
 io.settle(oldFiles[2],true);
 await turn();
 assert.deepEqual(io.started,[...oldFiles.slice(0,4),newFiles[0]]);
 for(const path of [oldFiles[3],oldFiles[1],oldFiles[0]])io.settle(path);
 await turn();
 assert.equal(await old,undefined);
 while(io.pending.size){
  for(const path of [...io.pending.keys()].reverse())io.settle(path);
  await turn();
 }
 assert.equal(io.peak(),4);
 assert.deepEqual(io.started,[...oldFiles.slice(0,4),...newFiles]);
 assert.deepEqual(await latest,{boards:newFiles.map(board),failed:[]});
});

test('a modal that closes before readers start never issues a read',async()=>{
 const io=deferredReader(),scan=createLibraryBoardReader(io.read);
 let current=true;
 const result=scan(paths(12),()=>current);
 current=false;
 assert.equal(await result,undefined);
 assert.deepEqual(io.started,[]);
});
