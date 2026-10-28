import {canvasFramePosition} from '../src/media-canvas';
import {readBoardDocument} from '../src/board-document';
import {applyDefaultCardStyle} from '../src/card-style';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as mediaSource from '../src/media-source';
import * as guards from '../src/value-guards';
import {emptyBoard,type Board} from '../src/model';

const main=readFileSync('src/main.ts','utf8');
function method(start:string){
 const at=main.indexOf(start);assert.ok(at>=0,`Missing ${start}`);const tail=main.slice(at+start.length);
 const next=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(tail);assert.ok(next);return main.slice(at,at+start.length+next.index);
}
const methods=[method('  private async captureMediaFrame('),method('  private requireOwner(')].join('\n');
const nodeRequire=createRequire(import.meta.url),externalModule={exports:{}},runtimeModule={exports:{}};
const desktopHost={Platform:{isDesktop:true,resourcePathPrefix:'app://runtime-id/'}};
new Function('require','module','exports',transformSync(readFileSync('src/platform-runtime.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='obsidian'?desktopHost:nodeRequire(name),runtimeModule,runtimeModule.exports);
new Function('require','module','exports',transformSync(readFileSync('src/external-media.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
 if(name==='obsidian')return desktopHost;
 if(name==='./platform-runtime')return runtimeModule.exports;
 if(name==='./media-source')return mediaSource;
 if(name==='./value-guards')return guards;
 return nodeRequire(name);
},externalModule,externalModule.exports);
const external=externalModule.exports as typeof import('../src/external-media');
class TFile {
 stat={mtime:1,size:100};parent={path:'Boards'};
 constructor(public path:string){}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
 get extension(){return this.path.split('.').at(-1)!;}
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve};}
async function fixture(t:{after:(fn:()=>Promise<void>)=>void}){
 const folder=await mkdtemp(join(tmpdir(),'thoughtspace-board-frame-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 const originalPath=join(folder,'external #100%.mp4'),originalBytes='Original media remains outside the vault';await writeFile(originalPath,originalBytes);
 const descriptor=await external.createExternalMediaReference(originalPath),file=new TFile('References/lesson.tsvideo');file.stat.size=Buffer.byteLength(descriptor.content);
 const files=new Map([[file.path,file]]),binaries:{path:string;bytes:ArrayBuffer}[]=[],notes:{file:TFile;body:string}[]=[],notices:string[]=[];
 const noteStarted=deferred(),noteGate=deferred();let changes=0,sequence=0;
 const node=mediaSource.mediaCard('source',file.path,200,200),owner={file:new TFile('Boards/board.thoughtspace'),blocked:false,refreshNativeEditing(){},board:{...emptyBoard(),version:3 as const,nodes:[node]} as Board,change(fn:(board:Board)=>void){changes++;fn(this.board);},async flush(){}};
 const deps={applyDefaultCardStyle,canvasFramePosition,readBoardDocument,parseYaml:()=>({}),TFile,mediaTime:mediaSource.mediaTime,mediaClock:mediaSource.mediaClock,mediaSourceMarkdown:mediaSource.mediaSourceMarkdown,uid:()=>`new-${++sequence}`,Notice:class{constructor(text:string){notices.push(text);}}};
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),getName:()=> 'test-vault',read:async(target:TFile)=>target===owner.file?JSON.stringify(owner.board):descriptor.content,readBinary:async(target:TFile)=>binaries.find(item=>item.path===target.path)!.bytes,createBinary:async(path:string,bytes:ArrayBuffer)=>{binaries.push({path,bytes});const image=new TFile(path);files.set(path,image);noteStarted.resolve();await noteGate.promise;return image;}},fileManager:{getAvailablePathForAttachment:async()=> 'Attachments/frame.png',generateMarkdownLink:()=> '[frame](Attachments/frame.png)'}};
 const retained:{id:string;blob:Blob}[]=[],finished:string[]=[];const view=new View();Object.assign(view,{canvasFrameReceipts:new Map(),session:owner,closed:false,app,updateSelection:()=>{},plugin:{retainCanvasFrame:async(_file:TFile,id:string,blob:Blob)=>{retained.push({id,blob});},finishCanvasFrame:async(id:string)=>{finished.push(id);},settings:{defaultEdgeStyle:'curve'},mediaWorkspace:{validateResource:async(source:TFile)=>{await external.resolveMediaResource(app as any,source as any);}},createUnique:async(_folder:string,_title:string,_ext:string,body:string)=>{
  const note=new TFile('Boards/frame.md');notes.push({file:note,body});files.set(note.path,note);noteStarted.resolve();await noteGate.promise;return note;
 }}});
 const bytes=new Uint8Array(24),png=new DataView(bytes.buffer);png.setUint32(0,0x89504e47);png.setUint32(4,0x0d0a1a0a);png.setUint32(12,0x49484452);png.setUint32(16,16);png.setUint32(20,9);const blob=new Blob([bytes],{type:'image/png'}),capture=()=>view.captureMediaFrame(node.id,blob,12.125,owner) as Promise<void>;
 return{view,owner,node,file,files,binaries,notes,notices,noteStarted,noteGate,retained,finished,originalPath,originalBytes,capture,get changes(){return changes;}};
}

test('external screenshot inserts a direct image and time source, while preserving the original media',async t=>{
 const f=await fixture(t);f.noteGate.resolve();await f.capture();assert.equal(f.changes,1);assert.equal(f.binaries.length,1);assert.equal(f.binaries[0].bytes.byteLength,24);assert.equal(f.notes.length,0);assert.equal(f.owner.board.nodes.filter(node=>node.kind==='image').length,1);assert.equal(f.owner.board.edges[0].from,f.node.id);assert.equal(f.owner.board.edges[0].label,'0:12');const caption=f.owner.board.nodes.find(node=>node.kind==='text')!.text!,match=/\]\((obsidian:\/\/thoughtspace-media[^)]+)\)/.exec(caption);assert.ok(match);assert.deepEqual(mediaSource.parseMediaSourceUrl(match[1]),{vault:'test-vault',board:f.owner.file.path,node:f.node.id,file:f.file.path,time:12.125});assert.equal(await readFile(f.originalPath,'utf8'),f.originalBytes);assert.ok(!caption.includes(f.originalPath));assert.equal(f.retained.length,1);assert.equal(f.finished.length,1);
});
for(const mutation of ['external media','reference modified','reference deleted','reference replaced','board switched','board closed','board blocked'] as const)test(`${mutation} during screenshot write preserves PNG and recovery draft without inserting stale objects`,async t=>{
 const f=await fixture(t),pending=f.capture();const rejected=assert.rejects(pending);await f.noteStarted.promise;
 if(mutation==='external media')await writeFile(f.originalPath,'Changed external video');
 if(mutation==='reference modified')f.file.stat.mtime++;
 if(mutation==='reference deleted')f.files.delete(f.file.path);
 if(mutation==='reference replaced')f.files.set(f.file.path,new TFile(f.file.path));
 if(mutation==='board switched')f.view.session={...f.owner,board:emptyBoard()};
 if(mutation==='board closed')f.view.closed=true;
 if(mutation==='board blocked')f.owner.blocked=true;
 f.noteGate.resolve();await rejected;assert.equal(f.changes,0);assert.equal(f.owner.board.nodes.length,1);assert.equal(f.owner.board.edges.length,0);assert.equal(f.binaries.length,1);assert.equal(f.notes.length,0);assert.ok(f.files.has('Attachments/frame.png'));assert.equal(f.retained.length,1);assert.equal(f.finished.length,0);
});
test('retry after a layout write failure reuses its image and object identities',async t=>{
 const f=await fixture(t);f.noteGate.resolve();let failed=true;f.owner.flush=async()=>{if(failed)throw Error('disk unavailable');};await assert.rejects(f.capture(),/disk unavailable/);const ids=f.owner.board.nodes.map(node=>node.id);failed=false;await f.capture();assert.equal(f.binaries.length,1);assert.equal(f.changes,1);assert.deepEqual(f.owner.board.nodes.map(node=>node.id),ids);assert.equal(f.finished.length,1);
});
