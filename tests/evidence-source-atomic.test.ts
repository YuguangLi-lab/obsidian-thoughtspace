import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as materials from '../src/materials';
import {appendEvidence} from '../src/evidence';
import {excerptPresentation} from '../src/excerpt-sources';
import {emptyBoard} from '../src/model';

class TFile {
 stat={mtime:1,size:100};
 constructor(public path:string,readonly basename=path,readonly extension=path.split('.').at(-1)){}
}
class MarkdownView {}
const native={exports:{} as Record<string,unknown>};
new Function('require','module','exports',transformSync(readFileSync('src/native-note-state.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView,TFile}),native,native.exports);
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async appendCardEvidence('),end=source.indexOf('  private branchDisclosureMenu(',start);
assert.ok(start>0&&end>start);
const deps={...materials,...native.exports,appendEvidence,excerptPresentation,TFile,VIEW:'thoughtspace-board',Notice:class{}};
const BoardView=new Function(...Object.keys(deps),transformSync('class BoardView{'+source.slice(start,end)+'};return BoardView',{loader:'ts'}).code)(...Object.values(deps));
type Kind='markdown'|'pdf';
type Boundary='prepare'|'read'|'process';
function gate(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};}

// Exercise the production import, evidence append, native read and atomic draft
// transform. Only Vault timing and host leaves are controlled by the fixture.
function fixture(kind:Kind,boundary:Boundary){
 const view=new BoardView(),sourceFile=new TFile(kind==='pdf'?'Source.pdf':'Source.md'),target=new TFile('Target.md'),raw='原始正文中的证据片段，需要保留可用的来源引用。';
 const files=new Map([[sourceFile.path,sourceFile],[target.path,target]]),blocked=gate(),entered=gate();
 let text='目标笔记的现有内容。',writes=0;
 const pause=async()=>{entered.resolve();await blocked.promise;};
 const board=emptyBoard();board.nodes=[{id:'note',kind:'card',file:target.path,x:0,y:0,width:300,height:220,color:'sand'}];
 const owner={file:new TFile('Board.thoughtspace'),board,blocked:false};
 Object.assign(view,{session:owner,requireOwner:(expected=owner)=>{assert.equal(expected,owner);return owner;},renderBoard(){},plugin:{settings:{cardFolder:'Cards',defaultCardWidth:300}},materialPoint:()=>({x:0,y:0}),
  prepareNoteOpen:async()=>{if(boundary==='prepare')await pause();},
  app:{workspace:{getLeavesOfType:(type:string)=>type==='thoughtspace-board'&&boundary==='prepare'?[{view}]:[]},
   vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async(file:TFile)=>{if(file===target){if(boundary==='read')await pause();return text;}return raw;},process:async(_file:TFile,transform:(current:string)=>string)=>{if(boundary==='process')await pause();text=transform(text);writes++;}},
   metadataCache:{getFileCache:()=>({}),getFirstLinkpathDest:()=>undefined},fileManager:{generateMarkdownLink:(file:TFile)=>'[['+file.path+']]'}},
 });
 const startImport=()=>kind==='pdf'?view.importPdfExcerpt(sourceFile,raw,2,2,{x:0,y:0,targetId:'note'},{...sourceFile.stat}):view.importExcerpts(sourceFile,raw,materials.extractFragments(raw).fragments,false,false,owner,{position:{x:0,y:0,targetId:'note'}});
 return{sourceFile,files,startImport,entered:entered.promise,release:blocked.resolve,text:()=>text,writes:()=>writes};
}

for(const kind of ['markdown','pdf'] as const)for(const boundary of ['prepare','read','process'] as const)for(const change of ['removed','replaced','renamed','edited','resized'] as const)test(kind+' evidence refuses '+change+' source at '+boundary+' boundary',async()=>{
 const f=fixture(kind,boundary),pending=f.startImport();await f.entered;
 if(change==='removed')f.files.delete(f.sourceFile.path);
 if(change==='replaced')f.files.set(f.sourceFile.path,new TFile(f.sourceFile.path));
 if(change==='renamed'){f.files.delete(f.sourceFile.path);f.sourceFile.path='Renamed.'+(kind==='pdf'?'pdf':'md');f.files.set(f.sourceFile.path,f.sourceFile);}
 if(change==='edited')f.sourceFile.stat.mtime++;
 if(change==='resized')f.sourceFile.stat.size++;
 f.release();await assert.rejects(pending,/原文.*变化|PDF.*变化/);
 assert.equal(f.writes(),0);assert.equal(f.text(),'目标笔记的现有内容。');
});

for(const kind of ['markdown','pdf'] as const)for(const boundary of ['prepare','read','process'] as const)test(kind+' evidence still appends unchanged sources at '+boundary+' boundary',async()=>{
 const f=fixture(kind,boundary),pending=f.startImport();await f.entered;f.release();const result=await pending;
 assert.equal(f.writes(),1);assert.ok(f.text().startsWith('目标笔记的现有内容。'));assert.ok(f.text().includes('来源：[['+f.sourceFile.path));assert.deepEqual(result.ids,['note']);
});
