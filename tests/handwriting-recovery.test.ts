import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import * as geometry from '../src/relation-geometry-checkpoint';
import {createHandwritingBoard,isHandwritingBoard} from '../src/handwriting-board';
import {reflowReadingContent} from '../src/expansion-reading-state';
import type {InkStroke} from '../src/ink-model';
import {HandwritingHistory} from '../src/handwriting-history';
import {applyInkEdit} from '../src/handwriting-ink-edit';

const parseYaml=(raw:string)=>raw.includes('thoughtspace: board')?{thoughtspace:'board'}:{};
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const deps={...model,...mindmap,...documents,...geometry,reflowReadingContent,isHandwritingBoard,HandwritingHistory,applyInkEdit,parseYaml,Notice:class{},EXT:'thoughtspace',report:()=>{},
 hasNativeBoardEditor:(app:{nativeOpen:boolean})=>app.nativeOpen,
 assertBoardEditorOwnership:(app:{nativeOpen:boolean})=>{if(app.nativeOpen)throw Error('Native editor owns this document');}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const sample:InkStroke={id:'ink-1',color:'#222222',width:3,points:[[1,2,.5],[40,80,.8]]};
function fixture(format:'md'|'thoughtspace'){
 const board=createHandwritingBoard(),file={path:`Synthetic.${format}`,extension:String(format),basename:'Synthetic',parent:{path:''}};
 let disk=format==='md'?documents.createMarkdownBoardDocument(board,'Synthetic').replace('thoughtspace: board','thoughtspace: board\nuser_property: preserved')+'\nUser Markdown body\n':JSON.stringify(board,null,2),writeFailure='',recoveryFailure='';
 const files=new Map<string,typeof file>([[file.path,file]]),recovered:{file:typeof file;raw:string}[]=[];
 const plugin={app:{nativeOpen:false,vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>disk,process:async(_file:unknown,edit:(raw:string)=>string)=>{if(writeFailure)throw Error(writeFailure);disk=edit(disk);}}},
  createUnique:async(_folder:string,_name:string,extension:string,raw:string)=>{if(recoveryFailure)throw Error(recoveryFailure);const copy={...file,path:`Synthetic-recovery.${extension}`,extension};files.set(copy.path,copy);recovered.push({file:copy,raw});return copy;}};
 const session=new Session(plugin,file,disk);
 return{session,plugin,file,recovered,disk:()=>disk,writeFails:()=>{writeFailure='Synthetic storage offline';},recoveryFails:()=>{recoveryFailure='Synthetic recovery storage full';},reopen:(value=disk,nextFile=file)=>new Session(plugin,nextFile,value)};
}
function writeInk(f:ReturnType<typeof fixture>){f.session.changeHandwritingInk({kind:'append',stroke:sample});f.session.changeHandwritingViewport({x:125,y:-70,zoom:.6});}

for(const format of ['md','thoughtspace'] as const){
 test(`${format} handwriting fully reopens with exact ink and camera after saving`,async()=>{
  const f=fixture(format);writeInk(f);await f.session.flush();assert.equal(f.session.blocked,false);assert.equal(f.session.saveFeedback.state,'saved');
  const reopened=f.reopen();assert.deepEqual(reopened.board.ink,f.session.board.ink);assert.deepEqual(reopened.board.viewport,{x:125,y:-70,zoom:.6});assert.equal(isHandwritingBoard(reopened.board),true);
  if(format==='md'){assert.match(f.disk(),/user_property: preserved/);assert.match(f.disk(),/User Markdown body/);}
 });
 test(`${format} handwriting storage failure leaves original bytes and reopens its complete recovery copy`,async()=>{
  const f=fixture(format),original=f.disk();f.writeFails();writeInk(f);await f.session.flush();assert.equal(f.disk(),original);assert.equal(f.session.blocked,true);assert.equal(f.recovered.length,1);
  const recovery=f.recovered[0],reopened=f.reopen(recovery.raw,recovery.file);assert.equal(f.session.saveFeedback.recoveryPath,recovery.file.path);assert.equal(f.session.saveFeedback.action?.kind,'open-recovery');
  assert.deepEqual(reopened.board.ink,{version:1,strokes:[sample]});assert.deepEqual(reopened.board.viewport,{x:125,y:-70,zoom:.6});
  if(format==='md'){assert.match(recovery.raw,/user_property: preserved/);assert.match(recovery.raw,/User Markdown body/);}
 });
 test(`${format} handwriting offers a complete copy source when both saving and recovery creation fail`,async()=>{
  const f=fixture(format),original=f.disk();f.writeFails();f.recoveryFails();writeInk(f);await f.session.flush();assert.equal(f.disk(),original);assert.equal(f.recovered.length,0);assert.equal(f.session.blocked,true);
  assert.match(f.session.saveFeedback.detail,/Synthetic storage offline/);assert.match(f.session.saveFeedback.detail,/Synthetic recovery storage full/);assert.equal(f.session.saveFeedback.action?.kind,'copy-local-draft');
  const exported=documents.readBoardDocument(f.session.localDraftSource(),format,parseYaml).board;assert.deepEqual(exported.ink,{version:1,strokes:[sample]});assert.deepEqual(exported.viewport,{x:125,y:-70,zoom:.6});
 });
}

test('native Markdown editing keeps saved handwriting and its camera protected without new layout writes',async()=>{
 const f=fixture('md');writeInk(f);await f.session.flush();const saved=f.disk();f.plugin.app.nativeOpen=true;f.session.refreshNativeEditing();
 assert.equal(f.session.blocked,true);assert.equal(f.session.saveFeedback.state,'paused');assert.throws(()=>f.session.changeHandwritingViewport({x:999,y:0,zoom:1}),/暂停/);await f.session.flush();assert.equal(f.disk(),saved);assert.deepEqual(f.session.board.ink,{version:1,strokes:[sample]});
});

for(const format of ['md','thoughtspace'] as const){
 test(`${format} lasso translate is one shared-stroke save transaction with exact undo and redo`,async()=>{
  const f=fixture(format);f.session.changeHandwritingInk({kind:'append',stroke:sample});
  f.session.changeHandwritingInk({kind:'append',stroke:{...sample,id:'untouched',points:[[200,240,.2]]}});await f.session.flush();
  const before=f.session.board.ink,untouched=before.strokes[1],history=f.session.history.undoStack.length;
  let updates=0;f.session.listeners.add((kind:string)=>{if(kind==='board')updates++;});
  f.session.changeHandwritingInk({kind:'translate',ids:['ink-1'],dx:12.125,dy:-7.875},before);
  assert.equal(updates,1);assert.equal(f.session.history.undoStack.length,history+1);
  assert.equal(f.session.board.ink.strokes[1],untouched);assert.notEqual(f.session.board.ink.strokes[0],before.strokes[0]);
  assert.deepEqual(before.strokes[0].points,sample.points);assert.deepEqual(f.session.board.ink.strokes[0].points,[[13.125,-5.875,.5],[52.125,72.125,.8]]);
  const moved=f.session.board.ink;await f.session.flush();assert.deepEqual(f.reopen().board.ink,moved);
  f.session.undo();assert.deepEqual(f.session.board.ink,before);f.session.undo(true);assert.deepEqual(f.session.board.ink,moved);
  await f.session.flush();assert.deepEqual(f.reopen().board.ink,moved);
 });
 test(`${format} stale selection, cancelled no-op and invalid commands leave ink, history and saved bytes intact`,async()=>{
  const f=fixture(format);f.session.changeHandwritingInk({kind:'append',stroke:sample});await f.session.flush();
  const ink=f.session.board.ink,saved=f.disk(),history=f.session.history.undoStack.length;let updates=0;f.session.listeners.add(()=>updates++);
  assert.throws(()=>f.session.changeHandwritingInk({kind:'translate',ids:['ink-1'],dx:2,dy:3},{...ink}),/笔迹已变化/);
  f.session.changeHandwritingInk({kind:'remove',ids:['missing']},ink);f.session.changeHandwritingInk({kind:'translate',ids:['ink-1'],dx:0,dy:0},ink);
  assert.throws(()=>f.session.changeHandwritingInk({kind:'append',stroke:sample}),/数据无效/);
  assert.throws(()=>f.session.changeHandwritingInk({kind:'translate',ids:['ink-1'],dx:NaN,dy:0}),/无效/);
  await f.session.flush();assert.equal(f.session.board.ink,ink);assert.equal(f.session.history.undoStack.length,history);assert.equal(updates,0);assert.equal(f.disk(),saved);
 });
 test(`${format} history keeps eight separate small edits through the actual Session and native ownership rejects new ink`,async()=>{
  const f=fixture(format);for(let i=0;i<8;i++)f.session.changeHandwritingInk({kind:'append',stroke:{...sample,id:`step-${i}`}});
  assert.equal(f.session.history.undoStack.length,8);await f.session.flush();
  for(let i=7;i>=0;i--){f.session.undo();assert.equal(f.session.board.ink.strokes.length,i);}
  for(let i=1;i<=8;i++){f.session.undo(true);assert.equal(f.session.board.ink.strokes.length,i);}
  await f.session.flush();assert.deepEqual(f.reopen().board.ink,f.session.board.ink);
  if(format==='md'){const ink=f.session.board.ink,saved=f.disk();f.plugin.app.nativeOpen=true;assert.throws(()=>f.session.changeHandwritingInk({kind:'remove',ids:['step-0']}),/暂停/);await f.session.flush();assert.equal(f.session.board.ink,ink);assert.equal(f.disk(),saved);}
 });
}
