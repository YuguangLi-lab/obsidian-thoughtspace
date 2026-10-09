import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeRecentBoard,type RecentBoardHost} from '../src/recent-board';

function fixture(paths=['deleted','ordinary','damaged','valid']){
 const files=new Map(paths.filter(path=>path!=='deleted').map(path=>[path,{path}])),opened:string[]=[],visited:string[]=[];
 let alive=true;const host:RecentBoardHost<{path:string}>={current:()=>alive,resolve:path=>files.get(path),valid:file=>file.path!=='ordinary',open:async file=>{if(file.path==='damaged')throw Error('invalid board');opened.push(file.path);return true;},visited:async file=>{visited.push(file.path);}};
 return{host,files,opened,visited,paths:paths.map(path=>({path})),cancel:()=>{alive=false;}};
}
test('resume skips missing, ordinary and unreadable records and opens latest valid board once',async()=>{
 const f=fixture(),result=await resumeRecentBoard(f.paths,f.host);
 assert.deepEqual(result,{status:'opened',path:'valid',skipped:3});assert.deepEqual(f.opened,['valid']);assert.deepEqual(f.visited,['valid']);
});
test('empty or invalid history returns an explicit empty result without creating a file',async()=>{
 for(const paths of [[],['deleted','ordinary','damaged']]){const f=fixture(paths),result=await resumeRecentBoard(f.paths,f.host);assert.equal(result.status,'empty');assert.equal(result.skipped,paths.length);assert.deepEqual(f.opened,[]);assert.deepEqual(f.visited,[]);}
});
test('recent order remains visitation order, deduplicates paths and stops after the first success',async()=>{
 const f=fixture(['a','b']);f.paths=[{path:'deleted'},{path:'deleted'},{path:'b'},{path:'a'}];assert.deepEqual(await resumeRecentBoard(f.paths,f.host),{status:'opened',path:'b',skipped:1});assert.deepEqual(f.opened,['b']);
});
test('new navigation cancels after a pending open without updating recent history or falling back',async()=>{
 const f=fixture(['a','b']);let resolve!:(opened:boolean)=>void;f.host.open=()=>new Promise<boolean>(done=>{resolve=done;});
 const work=resumeRecentBoard(f.paths,f.host);await Promise.resolve();f.cancel();resolve(false);
 assert.deepEqual(await work,{status:'cancelled',skipped:0});assert.deepEqual(f.visited,[]);
});
test('an open cancelled by the host never advances to another recent file',async()=>{
 const f=fixture(['a','b']);f.host.open=async()=>false;assert.deepEqual(await resumeRecentBoard(f.paths,f.host),{status:'cancelled',skipped:0});assert.deepEqual(f.visited,[]);
});
test('an identity that changes while checking eligibility is not opened',async()=>{
 const f=fixture(['a','b']);f.host.valid=file=>{if(file.path==='a')f.files.delete('a');return true;};
 assert.deepEqual(await resumeRecentBoard(f.paths,f.host),{status:'opened',path:'b',skipped:1});assert.deepEqual(f.opened,['b']);
});
test('failure to persist a visit does not open a different board after successful navigation',async()=>{
 const f=fixture(['a','b']);f.host.visited=async()=>{throw Error('settings unavailable');};
 await assert.rejects(resumeRecentBoard(f.paths,f.host),/settings unavailable/);assert.deepEqual(f.opened,['a']);
});
