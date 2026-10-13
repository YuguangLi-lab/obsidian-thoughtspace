import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import {createHandwritingBoard,isHandwritingBoard} from '../src/handwriting-board';
import {HandwritingHistory} from '../src/handwriting-history';
import {applyInkEdit} from '../src/handwriting-ink-edit';
import {reflowReadingContent} from '../src/expansion-reading-state';

const parseYaml=(text:string)=>text.includes('thoughtspace: board')?{thoughtspace:'board'}:{};
const source=readFileSync('src/main.ts','utf8');
const sessionStart=source.indexOf('class Session {'),sessionEnd=source.indexOf('\nexport default class ThoughtSpace',sessionStart);
const deps={...model,...mindmap,...documents,reflowReadingContent,isHandwritingBoard,HandwritingHistory,applyInkEdit,parseYaml,Notice:class{},EXT:'thoughtspace',report:()=>{},
 hasNativeBoardEditor:(app:{nativeOpen:boolean})=>app.nativeOpen,
 assertBoardEditorOwnership:(app:{nativeOpen:boolean})=>{if(app.nativeOpen)throw Error('Native Markdown owns the document');}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(sessionStart,sessionEnd)+';return Session',{loader:'ts'}).code)(...Object.values(deps));

/** Execute the actual explicit handoff read, ownership/leaf guard, and focus action.
 * The earlier native save barrier has already completed in these fixtures. */
const handoffStart=source.indexOf('  async openCurrentMarkdownBoard(){'),handoffEnd=source.indexOf('\n  promptSaveBoardAs(',handoffStart);
const handoffSource=source.slice(handoffStart,handoffEnd),readStart=handoffSource.search(/await owner\.(?:settleExternalUpdate|externalUpdate)\(\)/),readEnd=handoffSource.indexOf('\n    }catch(error)',readStart);
assert.ok(handoffStart>=0&&handoffEnd>handoffStart&&readStart>=0&&readEnd>readStart);
const completeHandoff=new Function('owner','leaf','opened','file','return (async()=>{'+handoffSource.slice(readStart,readEnd)+'})();');
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
interface Read {resolve:(raw:string)=>void;reject:(error:Error)=>void;}

function fixture(){
 const board=createHandwritingBoard();board.ink.strokes.push({id:'old',color:'#222222',width:3,points:[[0,0,.5]]});
 const original=documents.createMarkdownBoardDocument(board,'Native handoff');
 const file={path:'Handwriting.md',extension:'md',basename:'Handwriting'},reads:Read[]=[];
 let writes=0,recoveries=0,focus=0;
 const plugin={nativeBoardTransitions:new Set(),app:{nativeOpen:true,vault:{getAbstractFileByPath:()=>file,
  read:()=>new Promise<string>((resolve,reject)=>reads.push({resolve,reject})),process:async()=>{writes++;}}},
  createUnique:async()=>{recoveries++;throw Error('Unexpected recovery');}};
 const session=new Session(plugin,file,original);assert.equal(session.blocked,true);
 plugin.app.nativeOpen=false;
 const opened={file,session},leaf={view:opened},host={app:{workspace:{setActiveLeaf(){focus++;}}}};
 const returnBoard=()=>completeHandoff.call(host,session,leaf,opened,file) as Promise<void>;
 const latest=model.clone(board);latest.ink.strokes.push({id:'new-native',color:'#315e9b',width:5,points:[[30,40,.8]]});
 const latestRaw=documents.replaceBoardDocumentLayout(original,documents.readBoardDocument(original,'md',parseYaml),latest,parseYaml).source+'\nLatest native body.\n';
 return{session,plugin,file,reads,original,latestRaw,returnBoard,stats:()=>({writes,recoveries,focus})};
}

test('explicit native return waits for a superseding read and preserves its latest body and ink',async()=>{
 const f=fixture();let done=false;const returning=f.returnBoard().then(()=>{done=true;});
 await tick();assert.equal(f.reads.length,1);
 const background=f.session.externalUpdate();await tick();assert.equal(f.reads.length,2);
 f.reads[0].resolve(f.original);await tick();
 assert.equal(done,false,'the obsolete read cannot complete the explicit return');assert.equal(f.session.blocked,true);assert.equal(f.stats().focus,0);
 f.reads[1].resolve(f.latestRaw);await Promise.all([returning,background]);
 assert.equal(done,true);assert.equal(f.session.blocked,false);assert.equal(f.session.baseline,f.latestRaw);
 assert.deepEqual(f.session.board.ink.strokes.map((stroke: {id:string})=>stroke.id),['old','new-native']);
 assert.deepEqual(f.stats(),{writes:0,recoveries:0,focus:1});
});

test('explicit native return keeps waiting when another read supersedes its current latest read',async()=>{
 const f=fixture();let done=false;const returning=f.returnBoard().then(()=>{done=true;});await tick();
 const second=f.session.externalUpdate();await tick();f.reads[0].resolve(f.original);await tick();
 const third=f.session.externalUpdate();await tick();assert.equal(f.reads.length,3);
 f.reads[1].resolve(f.original);await tick();assert.equal(done,false);assert.equal(f.session.blocked,true);
 f.reads[2].resolve(f.latestRaw);await Promise.all([returning,second,third]);
 assert.equal(f.session.blocked,false);assert.equal(f.session.baseline,f.latestRaw);assert.equal(f.stats().focus,1);
});

test('a new native owner during the latest read still rejects the explicit return without unlocking',async()=>{
 const f=fixture(),returning=f.returnBoard(),rejected=assert.rejects(returning,/交接已取消或保存仍受保护/);await tick();
 const background=f.session.externalUpdate();await tick();f.reads[0].resolve(f.original);await tick();
 f.plugin.app.nativeOpen=true;f.reads[1].resolve(f.latestRaw);await Promise.all([rejected,background]);
 assert.equal(f.session.blocked,true);assert.equal(f.session.baseline,f.original);assert.deepEqual(f.stats(),{writes:0,recoveries:0,focus:0});
});

test('a failed latest read preserves the lock and refuses focus instead of treating completion as success',async()=>{
 const f=fixture(),returning=f.returnBoard(),rejected=assert.rejects(returning,/交接已取消或保存仍受保护/);await tick();
 const background=f.session.externalUpdate();await tick();f.reads[0].resolve(f.original);await tick();
 f.reads[1].reject(Error('Latest read failed'));await Promise.all([rejected,background]);
 assert.equal(f.session.blocked,true);assert.equal(f.session.baseline,f.original);assert.match(f.session.status,/读取失败/);
 assert.deepEqual(f.stats(),{writes:0,recoveries:0,focus:0});
});
