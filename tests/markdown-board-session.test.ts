import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import {reflowReadingContent} from '../src/expansion-reading-state';

const parseYaml=(yaml:string)=>yaml.includes('thoughtspace: board')?{thoughtspace:'board'}:{};
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const deps={...model,...mindmap,...documents,reflowReadingContent,parseYaml,Notice:class{},EXT:'thoughtspace',report:()=>{},
 hasNativeBoardEditor:(app:{nativeOpen:boolean})=>app.nativeOpen,
 assertBoardEditorOwnership:(app:{nativeOpen:boolean})=>{if(app.nativeOpen)throw Error('原生 Markdown 已打开 · 白板仅查看');}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 let disk=documents.createMarkdownBoardDocument(model.emptyBoard(),'Synthetic board');
 const original=disk,writes:Array<()=>void>=[],recovered:Array<{extension:string;raw:string}>=[];
 const plugin={app:{nativeOpen:false,vault:{read:async()=>disk,process:async(_file:unknown,change:(raw:string)=>string)=>{await new Promise<void>(resolve=>writes.push(resolve));disk=change(disk);}}},
  createUnique:async(_folder:string,_title:string,extension:string,raw:string)=>{recovered.push({extension,raw});return{path:'recovery.'+extension};}};
 const file={path:'Synthetic.md',extension:'md',basename:'Synthetic',parent:{path:''}};
 const session=new Session(plugin,file,disk);
 return {session,plugin,file,original,writes,recovered,disk:()=>disk,external:(raw:string)=>disk=raw,
  replace:(board:model.Board)=>documents.replaceBoardDocumentLayout(disk,documents.readBoardDocument(disk,'md',parseYaml),board,parseYaml).source};
}

test('Markdown sessions load layout while retaining the complete native document baseline',()=>{
 const f=fixture();assert.deepEqual(f.session.board,model.emptyBoard());assert.equal(f.session.baseline,f.original);
});

test('atomic layout save preserves metadata, comments and body changed while the write was queued',async()=>{
 const f=fixture();f.session.change((b:model.Board)=>b.viewport.x=100);await tick();
 const external=f.disk().replace('thoughtspace: board','thoughtspace: board\nstatus: reviewed # retain this comment')+'\nExternal body.\n';f.external(external);
 f.writes[0]();await f.session.flush();
 assert(f.disk().includes('status: reviewed # retain this comment'));assert(f.disk().endsWith('External body.\n'));
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,100);
 assert.equal(f.session.baseline,f.disk());assert.equal(f.session.blocked,false);
});

test('metadata-only external updates retain board identity and undo/redo history',async()=>{
 const f=fixture();f.session.change((b:model.Board)=>b.viewport.x=100);await tick();f.writes[0]();await f.session.flush();
 const board=f.session.board,history=f.session.history;
 f.external(f.disk().replace('thoughtspace: board','thoughtspace: board\nstatus: native-update')+'\nNative body.\n');await f.session.externalUpdate();
 assert.equal(f.session.board,board);assert.equal(f.session.history,history);assert.equal(history.undoStack.length,1);assert.equal(f.session.baseline,f.disk());
 f.session.undo();await tick();f.writes[1]();await f.session.flush();
 assert(f.disk().includes('status: native-update'));assert(f.disk().endsWith('Native body.\n'));
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,60);
});

test('a competing layout leaves external source intact and saves a separate Markdown recovery',async()=>{
 const f=fixture();f.session.change((b:model.Board)=>b.viewport.x=100);await tick();
 const changed=model.emptyBoard();changed.viewport.x=900;const external=f.replace(changed);f.external(external);
 f.writes[0]();await f.session.flush();
 assert.equal(f.disk(),external);assert.equal(f.session.blocked,true);assert.equal(f.recovered.length,1);
 assert.equal(f.recovered[0].extension,'md');assert.equal(documents.readBoardDocument(f.recovered[0].raw,'md',parseYaml).board.viewport.x,100);
});

test('native editor ownership appearing inside the queued write is checked at the atomic boundary',async()=>{
 const f=fixture();f.session.change((b:model.Board)=>b.viewport.x=100);await tick();f.plugin.app.nativeOpen=true;
 f.writes[0]();await f.session.flush();assert.equal(f.disk(),f.original);assert.equal(f.recovered.length,1);assert.equal(f.session.blocked,true);
});

test('an open native Markdown editor prevents board mutations before they enter history',()=>{
 const f=fixture();f.plugin.app.nativeOpen=true;f.session.change((b:model.Board)=>b.viewport.x=100);
 assert.equal(f.session.board.viewport.x,60);assert.equal(f.session.history.undoStack.length,0);assert.equal(f.writes.length,0);assert.equal(f.session.blocked,true);
});

test('external metadata can refresh after native ownership ends without resetting board history',async()=>{
 const f=fixture();const history=f.session.history;
 f.plugin.app.nativeOpen=true;f.session.refreshNativeEditing();f.external(f.disk().replace('thoughtspace: board','thoughtspace: board\nstatus: completed'));
 f.plugin.app.nativeOpen=false;f.session.refreshNativeEditing();await f.session.externalUpdate();
 assert.equal(f.session.blocked,false);assert.equal(f.session.history,history);assert.equal(f.session.baseline,f.disk());
});

test('external metadata updates preserve a camera gesture which has not yet reached pointer release',async()=>{
 const f=fixture();f.session.board.viewport.x=125;f.external(f.disk()+'\nOutside edit.\n');await f.session.externalUpdate();
 assert.equal(f.session.board.viewport.x,125);assert(f.session.baseline.endsWith('Outside edit.\n'));assert.equal(f.session.blocked,false);
 f.session.persist();await tick();f.writes[0]();await f.session.flush();
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,125);assert(f.disk().endsWith('Outside edit.\n'));
});
