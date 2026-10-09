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
 assertBoardEditorOwnership:(app:{nativeOpen:boolean})=>{if(app.nativeOpen)throw Error('Native Markdown owns this document');}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(afterWrite=false){
 let disk=documents.createMarkdownBoardDocument(model.emptyBoard(),'Synthetic board');
 const writes:Array<()=>void>=[],recovered:Array<{extension:string;raw:string}>=[];
 const file={path:'Synthetic.md',extension:'md',basename:'Synthetic',parent:{path:''}},files=new Map([[file.path,file]]);
 const plugin={nativeBoardTransitions:new Set<typeof file>(),app:{nativeOpen:false,vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>disk,process:async(_file:unknown,change:(raw:string)=>string)=>{
  if(afterWrite)disk=change(disk);
  await new Promise<void>(resolve=>writes.push(resolve));
  if(!afterWrite)disk=change(disk);
 }}},createUnique:async(_folder:string,_title:string,extension:string,raw:string)=>{recovered.push({extension,raw});return{path:'recovery.'+extension};}};
 const session=new Session(plugin,file,disk);
 return{session,plugin,file,files,writes,recovered,disk:()=>disk,external:(board:model.Board)=>{disk=documents.replaceBoardDocumentLayout(disk,documents.readBoardDocument(disk,'md',parseYaml),board,parseYaml).source;}};
}

test('external layout changes keep the disk camera as baseline until a local camera gesture is persisted',async()=>{
 const f=fixture(),external=model.emptyBoard();external.version=3;external.viewport.x=700;external.nodes.push({id:'external',kind:'text',text:'External layout',x:0,y:0,width:240,height:120,color:'sand'});
 f.session.board.viewport.x=125;f.external(external);await f.session.externalUpdate();
 assert.equal(f.session.board.viewport.x,125);assert.equal(f.session.board.nodes[0].id,'external');
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,700);
 f.session.persist();await tick();assert.equal(f.writes.length,1,'the unsaved local camera must reach an actual write');
 f.writes[0]();await f.session.flush();assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,125);
});

test('native ownership cannot silently discard a queued layout after an earlier write has already reached disk',async()=>{
 const f=fixture(true);f.session.change((board:model.Board)=>board.viewport.x=100);await tick();
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,100);
 f.session.change((board:model.Board)=>board.viewport.x=200);f.plugin.app.nativeOpen=true;f.session.refreshNativeEditing();
 f.writes[0]();await f.session.flush();
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,100);
 assert.equal(f.recovered.length,1,'the latest queued layout must be preserved outside an evictable session');
 assert.equal(documents.readBoardDocument(f.recovered[0].raw,'md',parseYaml).board.viewport.x,200);
});

test('a queued save follows the same file identity when that Markdown board is renamed',async()=>{
 const f=fixture();f.session.change((board:model.Board)=>board.viewport.x=200);await tick();
 f.files.delete(f.file.path);f.file.path='Renamed.md';f.files.set(f.file.path,f.file);
 f.writes[0]();await f.session.flush();assert.equal(f.session.blocked,false);assert.equal(f.recovered.length,0);
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,200);
});

for(const transition of ['delete','replace'] as const)test(`a ${transition} while saving is queued cannot write through the retired file identity`,async()=>{
 const f=fixture(),original=f.disk();f.session.change((board:model.Board)=>board.viewport.x=200);await tick();
 f.files.delete(f.file.path);if(transition==='replace')f.files.set(f.file.path,{...f.file});
 f.writes[0]();await f.session.flush();assert.equal(f.disk(),original,'the original or replacement bytes must remain intact');
 assert.equal(f.session.blocked,true);assert.equal(f.recovered.length,1);
 assert.equal(documents.readBoardDocument(f.recovered[0].raw,'md',parseYaml).board.viewport.x,200);
});

for(const transition of ['delete','replace'] as const)test(`a ${transition} during an external read cannot attach another document to the retired session`,async()=>{
 const f=fixture(),external=model.emptyBoard();external.viewport.x=700;f.external(external);const snapshot=f.disk();
 let release!:(raw:string)=>void;f.plugin.app.vault.read=()=>new Promise<string>(resolve=>release=resolve);
 const reading=f.session.externalUpdate();await tick();f.files.delete(f.file.path);if(transition==='replace')f.files.set(f.file.path,{...f.file});
 release(snapshot);await reading;assert.equal(f.session.board.viewport.x,60,'late bytes cannot own the retired session');assert.equal(f.session.blocked,true);
});

test('a handoff transition remains an atomic write lock after the native leaf has departed',async()=>{
 const f=fixture(),original=f.disk();f.session.change((board:model.Board)=>board.viewport.x=200);await tick();
 f.plugin.nativeBoardTransitions.add(f.file);f.session.refreshNativeEditing();f.writes[0]();await f.session.flush();
 assert.equal(f.disk(),original,'the transition lock must apply at the atomic write boundary');assert.equal(f.recovered.length,1);
 assert.equal(documents.readBoardDocument(f.recovered[0].raw,'md',parseYaml).board.viewport.x,200);
});

test('a rejected obsolete external read cannot block a newer valid read',async()=>{
 const f=fixture(),external=model.emptyBoard();external.viewport.x=700;f.external(external);const current=f.disk();
 const reads:Array<{resolve:(raw:string)=>void;reject:(error:Error)=>void}>=[];
 f.plugin.app.vault.read=()=>new Promise<string>((resolve,reject)=>reads.push({resolve,reject}));
 const old=f.session.externalUpdate();await tick();const newer=f.session.externalUpdate();await tick();
 reads[0].reject(Error('Obsolete failed read'));await old;reads[1].resolve(current);await newer;
 assert.equal(f.session.blocked,false);assert.equal(f.session.board.viewport.x,700);
});

test('a rejected read started before a newer local save cannot block the saved session',async()=>{
 const f=fixture();let reject!:(error:Error)=>void;f.plugin.app.vault.read=()=>new Promise<string>((_,fail)=>reject=fail);
 const old=f.session.externalUpdate();await tick();f.session.change((board:model.Board)=>board.viewport.x=200);await tick();f.writes[0]();await f.session.flush();
 reject(Error('Failed read from before local save'));await old;assert.equal(f.session.blocked,false);assert.equal(f.session.status,'已保存');
 assert.equal(documents.readBoardDocument(f.disk(),'md',parseYaml).board.viewport.x,200);
});
