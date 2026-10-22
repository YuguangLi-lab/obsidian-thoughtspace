import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private renameBoard() {'),end=source.indexOf('\n  async onOpen()',start);
assert(start>=0&&end>start);
// The production method is extracted unchanged. These are only native filename
// and Prompt boundaries; root TFolder.path is '/', unlike vault file paths.
const normalizePath=(value:string)=>value.replace(/\\/g,'/').replace(/\/+/g,'/').replace(/^\/+|\/+$/g,'');
function fixture(folder='/'){
 const prefix=folder==='/'?'':folder+'/',file={path:prefix+'原名.md',basename:'原名',parent:{path:folder},extension:'md'},files=new Map<string,unknown>([[file.path,file]]),calls:string[]=[],prompts:any[]=[];
 class Prompt {constructor(_app:unknown,_title:string,_initial:string,readonly submit:(name:string)=>Promise<void>){prompts.push(this);}open(){}}
 const Board=new Function('Prompt','normalizePath','safeName',transformSync('class Board{'+source.slice(start,end)+'};return Board;',{loader:'ts'}).code)(Prompt,normalizePath,(value:string)=>value.trim());
 const board=new Board(),owner={blocked:false,flush:async()=>{calls.push('flush');}};
 board.file=file;board.session=owner;board.requireOwner=(wanted:unknown)=>{if(board.session!==wanted||owner.blocked)throw Error('stale owner');return owner;};
 board.app={vault:{getAbstractFileByPath:(value:string)=>files.get(value)},fileManager:{renameFile:async(target:typeof file,path:string)=>{calls.push('rename:'+path);files.delete(target.path);target.path=path;files.set(path,target);}}};
 const submit=async(name:string)=>{board.renameBoard();assert.equal(prompts.length,1);await prompts[0].submit(name);};
 return{board,file,files,calls,prompts,owner,submit,prefix};
}
for(const folder of ['/','资料/散步']){
 test('actual board rename rejects a duplicate before flush or native rename in '+folder,async()=>{const f=fixture(folder);f.files.set(f.prefix+'同名.md',{});await assert.rejects(f.submit('同名'),/已有同名白板/);assert.deepEqual(f.calls,[]);assert.equal(f.file.path,f.prefix+'原名.md');});
 test('actual board rename with unchanged title is a no-op in '+folder,async()=>{const f=fixture(folder);await f.submit('原名');assert.deepEqual(f.calls,[]);assert.equal(f.files.get(f.file.path),f.file);});
 test('actual board rename flushes before native rename and keeps the exact folder in '+folder,async()=>{const f=fixture(folder);await f.submit('雨后的观察');assert.deepEqual(f.calls,['flush','rename:'+f.prefix+'雨后的观察.md']);assert.equal(f.files.get(f.file.path),f.file);});
}
test('rename rejects stale owner before making a native write',async()=>{const f=fixture();f.board.renameBoard();f.board.session={};await assert.rejects(f.prompts[0].submit('新名'),/stale owner/);assert.deepEqual(f.calls,[]);});
for(const change of ['owner','path','identity'] as const)test('rename rechecks '+change+' after real asynchronous flush',async()=>{const f=fixture();let release!:()=>void;f.owner.flush=async()=>{f.calls.push('flush');await new Promise<void>(r=>release=r);};const work=f.submit('新名');await Promise.resolve();if(change==='owner')f.board.session={};if(change==='path')f.file.path='已移动.md';if(change==='identity')f.files.set(f.file.path,{});release();await assert.rejects(work,/stale owner|移动或删除/);assert.deepEqual(f.calls,['flush']);});
test('blocked board owner does not even open a rename prompt',()=>{const f=fixture();f.owner.blocked=true;f.board.renameBoard();assert.equal(f.prompts.length,0);assert.deepEqual(f.calls,[]);});
