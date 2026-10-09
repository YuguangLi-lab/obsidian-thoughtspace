import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import {emptyBoard} from '../src/model';
import * as documents from '../src/board-document';
import {isWorkspaceFile} from '../src/workspace';

// Execute the production handoff and ownership barrier. Only the host leaf/file
// boundary is substituted; no cancellation or restoration logic is copied.
const source=readFileSync('src/main.ts','utf8');
const ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='ThoughtSpace');
assert(declaration&&ts.isClassDeclaration(declaration));
const method=declaration.members.find(node=>ts.isMethodDeclaration(node)&&node.body&&node.name.getText(ast)==='openCurrentMarkdownBoard');
assert(method&&ts.isMethodDeclaration(method));
const methodText=method.getText(ast);
const parseYaml=createRequire(import.meta.url)('js-yaml').load;

class File {constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}}
class MarkdownView {
 file:File|null;leaf:any;saving=false;saveAgain=false;mode='source';value:string;saves=0;
 editor={getValue:()=>this.value};
 constructor(file:File,value:string){this.file=file;this.value=value;}
 getMode(){return this.mode;}getViewData(){return this.value;}
 async save(){this.saves++;}
}
class BoardView {
 session={blocked:false,externalUpdate:async()=>{}};
 constructor(public file:File){}
}

type Transition='none'|'rename'|'delete'|'replace'|'non-markdown'|'backup-scope'|'index-scope';
function fixture(transition:Transition='none'){
 const file=new File('Boards/Original.md'),raw=documents.createMarkdownBoardDocument(emptyBoard(),'Synthetic');
 const files=new Map([[file.path,file]]),states:any[]=[],focus:any[]=[],disk=new Map([[file,raw]]);
 let replacement:File|undefined;
 const native=new MarkdownView(file,raw),leaf:any={view:native,isDeferred:false,state:{type:'markdown',state:{file:file.path}},getViewState(){return this.state;}};
 native.leaf=leaf;
 leaf.setViewState=async(state:any)=>{
  states.push(structuredClone(state));leaf.state=state;
  if(state.type==='thoughtspace-board'){
   native.file=null;leaf.view=new BoardView(file);
   if(transition!=='none'){
    files.delete(file.path);
    if(transition==='replace'){replacement=new File(file.path);files.set(replacement.path,replacement);disk.set(replacement,'Unrelated replacement note.');}
    else if(transition!=='delete'){
     file.path=transition==='rename'?'Moved/Renamed.md':transition==='non-markdown'?'Moved/Renamed.thoughtspace':transition==='backup-scope'?'ThoughtSpace-plugin-backups/Renamed.md':'ThoughtSpace/白板搜索/Renamed.md';
     files.set(file.path,file);
    }
   }
  }else{
   // Recording the actual requested path is sufficient to detect a stale
   // restoration target; host behavior for a nonexistent path is not assumed.
   const target=files.get(state.state.file)||file;leaf.view=new MarkdownView(target,disk.get(target)!);
  }
 };
 const app={workspace:{containerEl:{ownerDocument:{defaultView:globalThis}},
  getActiveViewOfType:(type:unknown)=>leaf.view instanceof (type as typeof MarkdownView)?leaf.view:undefined,
  getLeavesOfType:(type:string)=>type==='markdown'&&leaf.view instanceof MarkdownView?[leaf]:[],
  setActiveLeaf:(target:unknown)=>focus.push(target)},
  vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async(target:File)=>disk.get(target)!}};
 const module={exports:{} as any};
 new Function('require','module','exports',transformSync(readFileSync('src/board-editor-ownership.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView}),module,module.exports);
 const deps={...documents,...module.exports,parseYaml,MarkdownView,BoardView,VIEW:'thoughtspace-board',window:globalThis,
  isBoardFile:()=>true,isWorkspaceFile};
 const Host=new Function(...Object.keys(deps),transformSync('class Host{'+methodText+'};return Host',{loader:'ts'}).code)(...Object.values(deps));
 const host=new Host();Object.assign(host,{app,nativeBoardTransitions:new Set(),referenceQueue:Promise.resolve(),
  refreshMarkdownBoardOwnership(){module.exports.hasNativeBoardEditor(app,file);},flushPendingBoardReferences:async()=>{}});
 return{host,file,files,states,focus,disk,native,leaf,raw,replacement:()=>replacement,dispose:()=>module.exports.clearNativeBoardEditorTracking(app)};
}

test('the production native handoff completes against an unchanged saved file',async()=>{
 const f=fixture();try{
  await f.host.openCurrentMarkdownBoard();
  assert(f.leaf.view instanceof BoardView);assert.deepEqual(f.states.map(s=>s.type),['thoughtspace-board']);
  assert.equal(f.disk.get(f.file),f.raw);assert.equal(f.native.saves,1);assert.deepEqual(f.focus,[f.leaf]);
  assert.equal(f.host.nativeBoardTransitions.size,0);
 }finally{f.dispose();}
});

test('a board renamed during native handoff restores the current TFile path when cancelling',async()=>{
 const f=fixture('rename');try{
  await assert.rejects(f.host.openCurrentMarkdownBoard(),/移动|交接/);
  assert.equal(f.file.path,'Moved/Renamed.md');assert.equal(f.files.get(f.file.path),f.file);
  assert.equal(f.disk.get(f.file),f.raw,'the fixture proves no disk data loss; this is a stale restoration target');
  assert.equal(f.states.at(-1).type,'markdown');
  assert.equal(f.states.at(-1).state.file,f.file.path,'cancel must restore the same surviving file identity at its current path');
  assert.equal(f.host.nativeBoardTransitions.size,0);
 }finally{f.dispose();}
});

for(const transition of ['delete','replace','non-markdown','backup-scope','index-scope'] as const)test(`a ${transition} during native handoff never restores a retired or disallowed target`,async()=>{
 const f=fixture(transition);try{
  await assert.rejects(f.host.openCurrentMarkdownBoard(),/移动|交接/);
  assert.deepEqual(f.states.map(s=>s.type),['thoughtspace-board'],'cancel must not send Markdown restoration to a deleted, replacement or disallowed target');
  assert.equal(f.disk.get(f.file),f.raw,'the original bytes remain intact; no host last-writer behavior is simulated');
  if(transition==='replace')assert.equal(f.disk.get(f.replacement()!),'Unrelated replacement note.');
  assert.equal(f.host.nativeBoardTransitions.size,0);assert.deepEqual(f.focus,[]);
 }finally{f.dispose();}
});
