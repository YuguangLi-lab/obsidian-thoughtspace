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
const nodeRequire=createRequire(import.meta.url),externalModule={exports:{}};
new Function('require','module','exports',transformSync(readFileSync('src/external-media.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
 if(name==='obsidian')return{Platform:{resourcePathPrefix:'app://runtime-id/'}};
 if(name==='./media-source')return mediaSource;
 if(name==='./value-guards')return guards;
 return nodeRequire(name);
},externalModule,externalModule.exports);
const external=externalModule.exports as typeof import('../src/external-media');
class TFile {
 stat={mtime:1,size:100};parent={path:'Boards'};
 constructor(public path:string){}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve};}
async function fixture(t:{after:(fn:()=>Promise<void>)=>void}){
 const folder=await mkdtemp(join(tmpdir(),'thoughtspace-board-frame-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 const originalPath=join(folder,'external #100%.mp4'),originalBytes='Original media remains outside the vault';await writeFile(originalPath,originalBytes);
 const descriptor=await external.createExternalMediaReference(originalPath),file=new TFile('References/lesson.tsvideo');file.stat.size=Buffer.byteLength(descriptor.content);
 const files=new Map([[file.path,file]]),binaries:{path:string;bytes:ArrayBuffer}[]=[],notes:{file:TFile;body:string}[]=[],notices:string[]=[];
 const noteStarted=deferred(),noteGate=deferred();let changes=0,sequence=0;
 const node=mediaSource.mediaCard('source',file.path,200,200),owner={file:new TFile('Boards/board.thoughtspace'),blocked:false,refreshNativeEditing(){},board:{...emptyBoard(),version:3 as const,nodes:[node]} as Board,change(fn:(board:Board)=>void){changes++;fn(this.board);}};
 const deps={applyDefaultCardStyle,TFile,mediaTime:mediaSource.mediaTime,mediaClock:mediaSource.mediaClock,mediaSourceMarkdown:mediaSource.mediaSourceMarkdown,uid:()=>`new-${++sequence}`,Notice:class{constructor(text:string){notices.push(text);}}};
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),getName:()=> 'test-vault',read:async()=>descriptor.content,createBinary:async(path:string,bytes:ArrayBuffer)=>{binaries.push({path,bytes});const image=new TFile(path);files.set(path,image);return image;}},fileManager:{getAvailablePathForAttachment:async()=> 'Attachments/frame.png',generateMarkdownLink:()=> '[frame](Attachments/frame.png)'}};
 const view=new View();Object.assign(view,{session:owner,closed:false,app,updateSelection:()=>{},plugin:{settings:{defaultEdgeStyle:'curve'},mediaWorkspace:{validateResource:async(source:TFile)=>{await external.resolveMediaResource(app as any,source as any);}},createUnique:async(_folder:string,_title:string,_ext:string,body:string)=>{
  const note=new TFile('Boards/frame.md');notes.push({file:note,body});files.set(note.path,note);noteStarted.resolve();await noteGate.promise;return note;
 }}});
 const capture=()=>view.captureMediaFrame(node.id,new Blob(['PNG'],{type:'image/png'}),12.125,owner) as Promise<void>;
 return{view,owner,node,file,files,binaries,notes,notices,noteStarted,noteGate,originalPath,originalBytes,capture,get changes(){return changes;}};
}

test('external screenshot inserts a note card with exact timestamp and only copies the PNG attachment',async t=>{
 const f=await fixture(t);f.noteGate.resolve();await f.capture();
 assert.equal(f.changes,1);assert.equal(f.binaries.length,1);assert.equal(f.binaries[0].bytes.byteLength,3);assert.equal(f.notes.length,1);
 assert.equal(f.owner.board.nodes.filter(node=>node.kind==='card').length,1);assert.equal(f.owner.board.edges[0].from,f.node.id);assert.equal(f.owner.board.edges[0].label,'0:12');
 const match=/\]\((obsidian:\/\/thoughtspace-media[^)]+)\)/.exec(f.notes[0].body);assert.ok(match);
 assert.deepEqual(mediaSource.parseMediaSourceUrl(match[1]),{vault:'test-vault',board:f.owner.file.path,node:f.node.id,file:f.file.path,time:12.125});
 assert.equal(await readFile(f.originalPath,'utf8'),f.originalBytes);assert.ok(!f.notes[0].body.includes(f.originalPath));
});

for(const mutation of ['external media','reference modified','reference deleted','reference replaced','board switched','board closed','board blocked'] as const)test(`${mutation} during note creation preserves PNG and Markdown without inserting a stale card`,async t=>{
 const f=await fixture(t),pending=f.capture();await f.noteStarted.promise;
 if(mutation==='external media')await writeFile(f.originalPath,'Changed external video');
 if(mutation==='reference modified')f.file.stat.mtime++;
 if(mutation==='reference deleted')f.files.delete(f.file.path);
 if(mutation==='reference replaced')f.files.set(f.file.path,new TFile(f.file.path));
 if(mutation==='board switched')f.view.session={...f.owner,board:emptyBoard()};
 if(mutation==='board closed')f.view.closed=true;
 if(mutation==='board blocked')f.owner.blocked=true;
 f.noteGate.resolve();await pending;
 assert.equal(f.changes,0);assert.equal(f.owner.board.nodes.length,1);assert.equal(f.owner.board.edges.length,0);
 assert.equal(f.binaries.length,1);assert.equal(f.notes.length,1);assert.ok(f.files.has('Attachments/frame.png'));assert.ok(f.files.has('Boards/frame.md'));
 assert.match(f.notices.join('\n'),/截图笔记已保留.*未插入卡片/);assert.ok(!f.notices.some(text=>text.includes('视频截图已保存为')));
});
