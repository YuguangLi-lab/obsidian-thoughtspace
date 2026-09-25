import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {boardLinks,clone,emptyBoard,parseBoard,type Board} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async readBoard('),end=source.indexOf('  /** 所有由本插件创建',start);
function fixture(){
 const counts={clones:0,reads:0},files=[{path:'A.thoughtspace',extension:'thoughtspace'},{path:'B.thoughtspace',extension:'thoughtspace'}];
 const Plugin=new Function('clone','parseBoard','boardLinks','isWorkspaceFile','EXT',transformSync(`class Plugin{${source.slice(start,end)}};return Plugin`,{loader:'ts'}).code)((b:Board)=>{counts.clones++;return clone(b);},parseBoard,boardLinks,isWorkspaceFile,'thoughtspace');
 const host=new Plugin(),disk=new Map(files.map(f=>[f.path,JSON.stringify(emptyBoard())]));host.sessions=new Map();host.app={vault:{getFiles:()=>files,cachedRead:async(f:typeof files[number])=>{counts.reads++;return disk.get(f.path)!;}}};
 return{host,counts,files,disk};
}
const node=(id:string,kind:'text'|'board'='text',file?:string)=>({id,kind,file,text:'Large body '.repeat(200),x:0,y:0,width:200,height:100,color:'sand' as const});
test('graph extraction from an open board does not clone note bodies or geometry',async()=>{
 const f=fixture(),b:Board={...emptyBoard(),version:3 as const,nodes:[...Array.from({length:1200},(_,i)=>node('n'+i)),node('child','board',f.files[1].path)]};let bodyReads=0;
 Object.defineProperty(b.nodes[0],'text',{get(){bodyReads++;return 'Existing draft';},enumerable:true});f.host.sessions.set(f.files[0],Promise.resolve({board:b}));
 const result=await f.host.boardGraph();assert.deepEqual(result.graph.get(f.files[0].path),[f.files[1].path]);assert.equal(f.counts.clones,0);assert.equal(bodyReads,0);assert.equal(f.counts.reads,1);
});
test('ordinary readBoard still returns an independent editable copy',async()=>{
 const f=fixture(),b={...emptyBoard(),version:3 as const,nodes:[node('n')]};f.host.sessions.set(f.files[0],Promise.resolve({board:b}));const copy=await f.host.readBoard(f.files[0]);copy.nodes[0].text='Changed';assert.notEqual(copy.nodes[0].text,b.nodes[0].text);assert.equal(f.counts.clones,1);
});
test('live graph changes and caller mutations never reuse or alter prior links',async()=>{
 const f=fixture(),b={...emptyBoard(),version:3 as const,nodes:[node('c','board',f.files[1].path),node('duplicate','board',f.files[1].path)]};f.host.sessions.set(f.files[0],Promise.resolve({board:b}));const first=await f.host.boardGraph();first.graph.get(f.files[0].path).push('injected.thoughtspace');b.nodes[0].file='C.thoughtspace';const next=await f.host.boardGraph();assert.deepEqual(next.graph.get(f.files[0].path),['C.thoughtspace',f.files[1].path]);assert.equal(b.nodes.length,2);
});
test('cancellation around a pending loaded session skips link extraction and later disk reads',async()=>{
 const f=fixture();let release!:(s:unknown)=>void,current=true,kinds=0;const b={...emptyBoard(),version:3 as const,nodes:[node('c','board',f.files[1].path)]};Object.defineProperty(b.nodes[0],'kind',{get(){kinds++;return 'board';}});f.host.sessions.set(f.files[0],new Promise(r=>release=r));const task=f.host.boardGraph(()=>current);current=false;release({board:b});assert.equal(await task,undefined);assert.equal(f.counts.reads,0);assert.equal(kinds,0);
});
test('failed loaded sessions and invalid files remain errors instead of empty roots',async()=>{
 const f=fixture();f.host.sessions.set(f.files[0],Promise.reject(Error('session failed')));f.disk.set(f.files[1].path,'broken');const r=await f.host.boardGraph();assert.equal(r.graph.size,0);assert.deepEqual([...r.errors],f.files.map(f=>f.path));assert.equal(f.counts.reads,1);
});
test('unopened file parsing, workspace exclusions and link order remain intact',async()=>{
 const f=fixture();f.files.push({path:'ThoughtSpace-plugin-backups/old.thoughtspace',extension:'thoughtspace'},{path:'Note.md',extension:'md'});const b={...emptyBoard(),version:3 as const,nodes:[node('b','board','B.thoughtspace'),node('c','board','C.thoughtspace'),node('b2','board','B.thoughtspace')]};f.disk.set(f.files[0].path,JSON.stringify(b));const r=await f.host.boardGraph();assert.deepEqual(r.graph.get('A.thoughtspace'),['B.thoughtspace','C.thoughtspace']);assert.equal(f.counts.reads,2);assert.equal(r.graph.size,2);
});
