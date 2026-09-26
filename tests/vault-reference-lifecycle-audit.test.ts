import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,parseBoard,History,type Board,type Card} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {textExcerptPresentation,sourceLinkTarget} from '../src/excerpt-sources';
import {createBoardReferenceRenamer,captureBoardReferenceRename} from '../src/board-reference-rename';
import {remapFavorites} from '../src/navigation';

const main=readFileSync('src/main.ts','utf8'),start=main.indexOf('  async renameReferences('),end=main.indexOf('\n  async databaseDemo(',start);
const registrationStart=main.indexOf("    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {"),registrationEnd=main.indexOf('\n    }));',registrationStart)+'\n    }));'.length;
const Rename=new Function('parseBoard','History','isWorkspaceFile','report','EXT','createBoardReferenceRenamer','captureBoardReferenceRename','remapFavorites','remapHubPaths','act',transformSync(`class Rename{install(){${main.slice(registrationStart,registrationEnd)}}${main.slice(start,end)}};return Rename;`,{loader:'ts'}).code)(parseBoard,History,isWorkspaceFile,(error:unknown)=>{throw error;},'thoughtspace',createBoardReferenceRenamer,captureBoardReferenceRename,remapFavorites,(hub:unknown)=>hub,(run:()=>unknown)=>{try{void Promise.resolve(run()).catch(()=>{});}catch{}});
class TFile {constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}}
const writing=readFileSync('src/writing-view.ts','utf8'),openStart=writing.indexOf(' async openDraft()'),openEnd=writing.indexOf('\n async generate()',openStart);
const Writer=new Function('TFile',transformSync(`class Writer{${writing.slice(openStart,openEnd)}};return Writer;`,{loader:'ts'}).code)(TFile);
const node=(id:string,extra:Partial<Card>):Card=>({id,kind:'text',text:id,x:0,y:0,width:240,height:120,color:'sand',...extra});

function fixture(board:Board,loaded:boolean,boardPath='Boards/Study.thoughtspace'){
 const boardFile=new TFile(boardPath),backupFile=new TFile('ThoughtSpace-plugin-backups/Saved.thoughtspace'),files=new Map([[boardFile.path,boardFile],[backupFile.path,backupFile]]),writes:string[]=[],events=new Map<string,(file:{path:string},oldPath:string)=>void>();
 let disk=JSON.stringify(board,null,2),backup=JSON.stringify(board,null,2);
 const session={board:structuredClone(board),history:new History(),blocked:false,change(edit:(board:Board)=>void){edit(this.board);},async flush(){writes.push(boardFile.path);disk=JSON.stringify(this.board,null,2);}};
 const plugin=new Rename();plugin.sessions=new Map(loaded?[[boardFile,Promise.resolve(session)]]:[]);Object.assign(plugin,{referenceQueue:Promise.resolve(),settings:{hub:{},favoriteBoards:[boardFile.path]},registerEvent(){},saveData:async()=>{},savePreferences:async()=>{}});
 plugin.app={vault:{on:(event:string,run:(file:{path:string},oldPath:string)=>void)=>events.set(event,run),getFiles:()=>[...files.values()],getAbstractFileByPath:(path:string)=>files.get(path),async process(file:TFile,update:(raw:string)=>string){assert.equal(file,boardFile,'Only the active board document may be changed');const next=update(disk);if(next!==disk)writes.push(file.path);disk=next;}}};plugin.install();
 const add=(path:string)=>{const file=new TFile(path);files.set(path,file);return file;};
 const move=(oldPath:string,newPath:string)=>{const moved=files.get(oldPath)||{path:oldPath},children=[...files].filter(([path])=>path===oldPath||path.startsWith(oldPath+'/'));for(const [path,file]of children){files.delete(path);file.path=newPath+path.slice(oldPath.length);files.set(file.path,file);}moved.path=newPath;events.get('rename')!(moved,oldPath);};
 return{plugin,files,add,move,session,writes,boardFile,board:()=>loaded?session.board:parseBoard(disk),backup:()=>backup};
}

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve};}

test('blocked loaded boards keep generated sources and last-draft paths unchanged when rename is refused',async()=>{
 const oldPath='Sources',newPath='Archive/Sources',b:Board={...emptyBoard(),version:3,nodes:[node('excerpt',{text:'Quote\n\n> 来源：[[Sources/paper.pdf#page=4]] · PDF 第 4 页'})],writing:{title:'Article',order:[],draftPath:'Sources/Draft.md'}},before=structuredClone(b),f=fixture(b,true),history=f.session.history;
 f.add(newPath+'/paper.pdf');f.add(newPath+'/Draft.md');f.session.blocked=true;await assert.rejects(f.plugin.renameReferences({path:newPath},oldPath),/暂停写入/);assert.deepEqual(f.board(),before);assert.equal(f.session.history,history);assert.deepEqual(f.writes,[]);
});

for(const loaded of [false,true]){
 const mode=loaded?'loaded':'unloaded';
 test(`${mode}: folder moves update direct note/PDF/image/board and video paths while preserving group layout and backups`,async()=>{
  const b:Board={...emptyBoard(),version:3,nodes:[node('group',{kind:'section',title:'Sources',width:1000,height:800}),node('note',{kind:'card',file:'Sources/note.md'}),node('pdf',{kind:'pdf',file:'Sources/paper.pdf',pdfPage:4}),node('image',{kind:'image',file:'Sources/figure.png'}),node('child',{kind:'board',file:'Sources/Child.thoughtspace'}),node('video',{videoCapture:{id:'11111111-2222-3333-4444-555555555555',note:'Sources/video.md'}})],edges:[]};
  const f=fixture(b,loaded),backup=f.backup();await f.plugin.renameReferences({path:'Archive/Sources'},'Sources');const next=f.board();
  assert.deepEqual(next.nodes.slice(1,5).map(n=>n.file),['Archive/Sources/note.md','Archive/Sources/paper.pdf','Archive/Sources/figure.png','Archive/Sources/Child.thoughtspace']);assert.equal(next.nodes[5].videoCapture?.note,'Archive/Sources/video.md');assert.equal(next.nodes[2].pdfPage,4);assert.deepEqual(next.nodes[0],b.nodes[0]);assert.equal(f.backup(),backup);assert.deepEqual(f.writes,[f.boardFile.path]);
 });

 test(`${mode}: moving an excerpt source folder keeps PDF page and note line source buttons linked`,async()=>{
  const sample='```md\n> 来源：[[Sources/paper.pdf#page=3]] · PDF 第 3 页\n```',b:Board={...emptyBoard(),version:3,nodes:[node('pdf-excerpt',{text:sample+'\n\n> 来源：[[Sources/paper.pdf#page=3]] · PDF 第 3 页'}),node('note-excerpt',{text:'Quoted text\n\n> 来源：[Note](Sources/Note%20One.md#Section) · 第 2–4 行 · Section'})],edges:[]};
  const f=fixture(b,loaded);f.add('Archive/Sources/paper.pdf');f.add('Archive/Sources/Note One.md');await f.plugin.renameReferences({path:'Archive/Sources'},'Sources');
  const sources=f.board().nodes.flatMap(n=>textExcerptPresentation(n.text||'').sources);assert.deepEqual(sources.map(s=>sourceLinkTarget(s.link)),['Archive/Sources/paper.pdf#page=3','Archive/Sources/Note One.md#Section']);assert.deepEqual(sources.map(s=>s.location),['PDF 第 3 页','第 2–4 行 · Section']);assert.ok(f.board().nodes[0].text!.startsWith(sample),'Code samples are not generated source references');assert.ok(f.writes.every(path=>path===f.boardFile.path));
 });

 test(`${mode}: renaming the exported draft keeps Open Last Draft attached to that same existing file`,async()=>{
  const oldPath='ThoughtSpace/草稿/Article.md',b:Board={...emptyBoard(),writing:{title:'Article',order:[],draftPath:oldPath}},f=fixture(b,loaded),draft=f.add('Manuscripts/Final.md'),opened:TFile[]=[];
  await f.plugin.renameReferences(draft,oldPath);const writer=new Writer();Object.assign(writer,{
   commitFields(){},state:()=>f.board().writing,ensure:()=>({board:f.board()}),pinNativeReference:async()=>{},
   app:{vault:{getAbstractFileByPath:(path:string)=>f.files.get(path)},workspace:{getLeaf:()=>({openFile:async(file:TFile)=>{opened.push(file);}})}}
  });
  await assert.doesNotReject(writer.openDraft());assert.deepEqual(opened,[draft]);assert.equal(f.board().writing?.draftPath,draft.path);assert.ok(f.writes.every(path=>path===f.boardFile.path));
 });

 test(`${mode}: queued folder then source moves retain the original file instead of a later suffix match`,async()=>{
  const b=boardForQueue(),f=fixture(b,loaded,'Sources/Study.thoughtspace'),gate=deferred();f.add('Sources/Note.md');f.add('Other/Sources/Note.md');f.plugin.referenceQueue=gate.promise;
  f.move('Sources','Archive');f.move('Archive/Note.md','Later/Note.md');gate.resolve();await f.plugin.referenceQueue;
  assert.equal(sourceLinkTarget(textExcerptPresentation(f.board().nodes[0].text!).sources[0].link),'Later/Note.md');assert.deepEqual(f.plugin.settings.favoriteBoards,['Archive/Study.thoughtspace']);
 });
 test(`${mode}: queued board moves use each event's board location for relative source links`,async()=>{
  const b=boardForQueue('[[../Sources/Note]]'),f=fixture(b,loaded,'Boards/Study.thoughtspace'),gate=deferred();f.add('Sources/Note.md');f.plugin.referenceQueue=gate.promise;
  f.move('Boards','Archive/Boards');f.move('Archive/Boards','Later/Boards');gate.resolve();await f.plugin.referenceQueue;
  assert.equal(sourceLinkTarget(textExcerptPresentation(f.board().nodes[0].text!).sources[0].link),'Sources/Note.md');assert.deepEqual(f.plugin.settings.favoriteBoards,['Later/Boards/Study.thoughtspace']);
 });
 for(const state of ['deleted','replaced'])test(`${mode}: a ${state} board is never written through a queued rename snapshot`,async()=>{
  const b=boardForQueue(),f=fixture(b,loaded),gate=deferred();f.add('Sources/Note.md');f.plugin.referenceQueue=gate.promise;f.move('Sources/Note.md','Sources/New.md');
  f.files.delete(f.boardFile.path);if(state==='replaced')f.add(f.boardFile.path);gate.resolve();await f.plugin.referenceQueue;assert.deepEqual(f.writes,[]);assert.deepEqual(f.board(),b);
 });
}

function boardForQueue(link='[[Sources/Note]]'):Board{return{...emptyBoard(),version:3,nodes:[node('excerpt',{text:'Quote\n\n> 来源：'+link+' · 第 1–2 行'})],edges:[]};}
