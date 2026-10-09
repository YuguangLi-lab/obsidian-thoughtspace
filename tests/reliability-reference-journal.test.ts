import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as documents from '../src/board-document';
import * as references from '../src/board-reference-rename';
import * as pending from '../src/pending-board-references';
import {emptyBoard,type Board} from '../src/model';
import {cleanPluginSettings,type ThoughtSpacePreferences} from '../src/plugin-settings';
import {isWorkspaceFile} from '../src/workspace';
import {isBoardPath} from '../src/board-path';
import {remapFavorites} from '../src/navigation';
import {remapHubPaths} from '../src/space-hub';
import {remapLocalRelationsPreferences} from '../src/local-relations-state';

const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('  private editReferenceJournal('),end=source.indexOf('\n  async databaseDemo()',start);
const eventStart=source.indexOf("this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {"),bodyStart=source.indexOf('(file, oldPath) => {',eventStart),eventEnd=source.indexOf('\n    }));',bodyStart);
assert(start>=0&&end>start&&eventStart>=0&&eventEnd>bodyStart,'execute the production journal flow and real source-rename event');
const parseYaml=createRequire(import.meta.url)('js-yaml').load;
const clone=<T>(value:T):T=>structuredClone(value);
class File {constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}}
interface HostApp {native:Set<File>;vault:{getAbstractFileByPath:(path:string)=>File|undefined;getFiles:()=>File[];read:(file:File)=>Promise<string>;process:(file:File,change:(raw:string)=>string)=>Promise<void>};}
const rawByApp=new WeakMap<HostApp,Map<File,string>>();
const reports:unknown[]=[];let nextId=0;
const dependencies={...documents,...references,...pending,parseYaml,TFile:File,uid:()=>`reliability-operation-${++nextId}`,
 Notice:class{},report:(error:unknown)=>reports.push(error),isWorkspaceFile,isBoardPath,remapFavorites,remapHubPaths,remapLocalRelationsPreferences,
 isBoardFile:(app:HostApp,file:File)=>isWorkspaceFile(file)&&isBoardPath(file.path)&&documents.isMarkdownBoardFrontmatter(parseYaml(/^---\n([\s\S]*?)\n---/.exec(rawByApp.get(app)?.get(file)||'')?.[1]||'')),
 hasNativeBoardEditor:(app:HostApp,file:File)=>app.native.has(file),assertBoardEditorOwnership:(app:HostApp,file:File)=>{if(app.native.has(file))throw Error('Native Markdown owns this document');}};
const Host=new Function(...Object.keys(dependencies),transformSync('class Host{'+source.slice(start,end)+'};return Host',{loader:'ts'}).code)(...Object.values(dependencies));
const act=(run:()=>unknown)=>{Promise.resolve().then(run).catch(dependencies.report);};
const renameEvent=new Function(...Object.keys(dependencies),'act',transformSync('return '+source.slice(bodyStart,eventEnd).replace('(file, oldPath) => {','function(file, oldPath) {')+'\n}',{loader:'ts'}).code)(...Object.values(dependencies),act) as (this:Flow,file:File,oldPath:string)=>void;
interface Flow {settings:ThoughtSpacePreferences;referenceQueue:Promise<void>;flushPendingBoardReferences:(file:File)=>Promise<void>;retryPendingBoardReferences:()=>Promise<void>;}

function fixture(){
 const boardFile=new File('Boards/Study.md'),note=new File('Notes/A.md'),files=new Map([[boardFile.path,boardFile],[note.path,note]]);
 const board=emptyBoard();board.version=3;board.nodes.push({id:'source',kind:'card',file:note.path,x:0,y:0,width:200,height:100,color:'blue'},
  {id:'local',kind:'text',text:'Keep this content',x:300,y:0,width:200,height:100,color:'green'});
 board.edges.push({id:'parent',from:'source',to:'local',kind:'branch',label:'Parent'},{id:'association',from:'source',to:'local',direction:'both',label:'Association'});
 const original=documents.createMarkdownBoardDocument(board,'Reliability')+'\nExternal native prose.\n',raw=new Map([[boardFile,original],[note,'Source note']]);
 let durable=cleanPluginSettings({}),failProcesses=0,processCalls=0;
 const app:HostApp={native:new Set([boardFile]),vault:{getAbstractFileByPath:path=>files.get(path),getFiles:()=>[...files.values()],read:async file=>raw.get(file)!,process:async(file,change)=>{
  processCalls++;if(failProcesses){failProcesses--;throw Error('Synthetic transient Vault.process failure');}raw.set(file,change(raw.get(file)!));
 }}};rawByApp.set(app,raw);
 const flow:Flow=Object.assign(new Host(),{app,settings:cleanPluginSettings({}),sessions:new Map(),nativeBoardTransitions:new Set(),referenceQueue:Promise.resolve(),referenceJournalQueue:Promise.resolve(),referenceJournalDirty:false,
  saveData:async(settings:ThoughtSpacePreferences)=>{durable=clone(settings);},savePreferences:async()=>{durable=clone(flow.settings);}});
 const rename=async(path:string)=>{const old=note.path;files.delete(old);note.path=path;files.set(path,note);renameEvent.call(flow,note,old);await flow.referenceQueue;};
 const disk=()=>raw.get(boardFile)!,decoded=()=>documents.readBoardDocument(disk(),'md',parseYaml).board;
 return{flow,app,boardFile,note,original,disk,decoded,rename,durable:()=>clone(durable),failProcess:()=>{failProcesses++;},processCalls:()=>processCalls};
}
function assertUnchangedGraph(board:Board){assert.deepEqual(board.nodes.map(node=>node.id),['source','local']);assert.deepEqual(board.edges.map(edge=>edge.id),['parent','association']);assert.equal(board.edges[1].direction,'both');}

test('control: a saved native rename journal replays after its owner closes',async()=>{
 const f=fixture();await f.rename('Notes/B.md');assert.equal(f.disk(),f.original);assert.equal(f.processCalls(),0);
 f.app.native.clear();await f.flow.retryPendingBoardReferences();assert.equal(f.decoded().nodes[0].file,'Notes/B.md');assertUnchangedGraph(f.decoded());
 assert(f.disk().endsWith('External native prose.\n'));assert.deepEqual(f.durable().pendingBoardReferences,[]);
});

test('a later source rename survives when an earlier durable journal replay failed and native ownership already closed',async()=>{
 const f=fixture();await f.rename('Notes/B.md');assert.equal(f.durable().pendingBoardReferences?.length,1);
 f.app.native.clear();f.failProcess();await assert.rejects(f.flow.flushPendingBoardReferences(f.boardFile),/transient Vault.process failure/);
 assert.equal(f.disk(),f.original,'the failed atomic write leaves the layout referencing A');assert.equal(f.durable().pendingBoardReferences?.length,1);
 await f.rename('Notes/C.md');await f.flow.retryPendingBoardReferences();
 assert.equal(f.note.path,'Notes/C.md');
 assert.equal(f.decoded().nodes[0].file,f.note.path,'replaying A to B must not leave a reference to retired B after the accepted B to C event');
 assertUnchangedGraph(f.decoded());assert(f.disk().endsWith('External native prose.\n'));assert.deepEqual(f.durable().pendingBoardReferences,[]);
});
