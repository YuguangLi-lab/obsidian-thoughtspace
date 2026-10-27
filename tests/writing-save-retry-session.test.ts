import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import * as geometry from '../src/relation-geometry-checkpoint';
import {reflowReadingContent} from '../src/expansion-reading-state';

const parseYaml=(text:string)=>text.includes('thoughtspace: board')?{thoughtspace:'board'}:{};
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const dependencies={...model,...mindmap,...documents,...geometry,reflowReadingContent,parseYaml,Notice:class{},EXT:'thoughtspace',report:()=>{},
 hasNativeBoardEditor:(app:{nativeOpen:boolean})=>app.nativeOpen,
 assertBoardEditorOwnership:(app:{nativeOpen:boolean})=>{if(app.nativeOpen)throw Error('native editor owns this file');}};
const Session=new Function(...Object.keys(dependencies),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(dependencies));
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
async function until(check:()=>boolean){for(let i=0;i<200&&!check();i++)await Promise.resolve();assert.ok(check(),'async checkpoint reached');}
const manuscript='完整写作正文\n\n**格式**与[[链接]]，结尾保留。';
async function fixture(){
 const file={path:'Synthetic.md',extension:'md',basename:'Synthetic',parent:{path:''}};
 const original=documents.createMarkdownBoardDocument(model.emptyBoard(),'Synthetic').replace('thoughtspace: board','thoughtspace: board\nuser_property: keep')+'\nNative note body.\n';
 let disk=original,fail=true,identity:unknown=file,writes=0,reads=0,readGate:ReturnType<typeof deferred>|undefined;
 const plugin={nativeBoardTransitions:new Set(),app:{nativeOpen:false,vault:{
  getAbstractFileByPath:()=>identity,
  read:async()=>{reads++;await readGate?.promise;return disk;},
  process:async(_file:unknown,change:(text:string)=>string)=>{writes++;if(fail)throw Error('synthetic disk full');disk=change(disk);},
 }},createUnique:async()=>{throw Error('synthetic recovery disk full');}};
 const session=new Session(plugin,file,disk);
 session.change((board:model.Board)=>{board.writing={title:'合成文章',order:[],manuscript};});await session.flush();
 assert.equal(session.blocked,true);assert.equal(disk,original);
 return{session,plugin,file,original,stamp:()=>JSON.stringify(session.board),disk:()=>disk,writes:()=>writes,reads:()=>reads,
  allowWrites:()=>{fail=false;},external:(text:string)=>{disk=text;},replaceFile:()=>{identity={...file};},setReadGate:(gate:ReturnType<typeof deferred>)=>{readGate=gate;}};
}

test('writing retry confirms a retained manuscript on disk and preserves native note properties',async()=>{
 const f=await fixture();f.allowWrites();await f.session.retryWritingSave(f.stamp(),()=>true);
 assert.equal(f.session.blocked,false);assert.equal(f.session.status,'已保存');
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.writing?.manuscript,manuscript);
 assert.match(f.disk(),/user_property: keep/);assert.ok(f.disk().endsWith('Native note body.\n'));assert.equal(f.writes(),2);
});

test('writing retry rejects a competing disk layout without overwriting it',async()=>{
 const f=await fixture(),board=model.emptyBoard();board.viewport.x=900;
 const external=documents.replaceBoardDocumentLayout(f.original,documents.readBoardDocument(f.original,'md',parseYaml),board,parseYaml).source;
 f.external(external);f.allowWrites();await assert.rejects(f.session.retryWritingSave(f.stamp(),()=>true),/磁盘布局已变化/);
 assert.equal(f.disk(),external);assert.equal(f.writes(),1);assert.equal(f.session.blocked,true);
});

for(const reason of ['native-owner','file-replaced','navigation','memory-changed'] as const)test(`writing retry guards ${reason} before any replacement write`,async()=>{
 const f=await fixture(),expected=f.stamp();f.allowWrites();let current=true;
 if(reason==='native-owner')f.plugin.app.nativeOpen=true;
 if(reason==='file-replaced')f.replaceFile();
 if(reason==='navigation')current=false;
 if(reason==='memory-changed')f.session.board.writing.manuscript='newer input';
 await assert.rejects(f.session.retryWritingSave(expected,()=>current));assert.equal(f.writes(),1);assert.equal(f.disk(),f.original);
});

test('navigation during the disk baseline check cannot complete an obsolete writing retry',async()=>{
 const f=await fixture(),gate=deferred();f.allowWrites();f.setReadGate(gate);let current=true;
 const retry=f.session.retryWritingSave(f.stamp(),()=>current);await until(()=>f.reads()===1);current=false;gate.resolve();
 await assert.rejects(retry,/页面或写作草稿已变化/);assert.equal(f.writes(),1);assert.equal(f.disk(),f.original);
});

test('a second failed write stays blocked and does not report the manuscript as saved',async()=>{
 const f=await fixture();await assert.rejects(f.session.retryWritingSave(f.stamp(),()=>true),/写作仍未落盘/);
 assert.equal(f.session.blocked,true);assert.equal(f.disk(),f.original);assert.equal(f.session.board.writing.manuscript,manuscript);assert.notEqual(f.session.status,'已保存');
});
