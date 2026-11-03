import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as documents from '../src/board-document';
import * as mermaid from '../src/mermaid-card';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {applyDefaultCardStyle} from '../src/card-style';

// Execute the production view commands and Session save/history queue. Only the
// modal and host application are substituted; native rendering has separate QA.
const source=readFileSync('src/main.ts','utf8');
const syntax=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true);
const viewClass=syntax.statements.find((node):node is ts.ClassDeclaration=>ts.isClassDeclaration(node)&&node.name?.text==='BoardView')!;
function method(name:string){
 const node=viewClass.members.find(member=>ts.isMethodDeclaration(member)&&member.name.getText(syntax)===name);
 assert.ok(node,`Production BoardView.${name} exists`);return node.getText(syntax);
}
const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:documents.YamlParser}).load;
const sessionStart=source.indexOf('class Session {'),sessionEnd=source.indexOf('\nexport default class ThoughtSpace',sessionStart);
const sessionDependencies={...model,...mindmap,...documents,reflowReadingContent,parseYaml,Notice:class{},EXT:'thoughtspace',report:()=>{},hasNativeBoardEditor:()=>false,assertBoardEditorOwnership:()=>{}};
const Session=new Function(...Object.keys(sessionDependencies),transformSync(source.slice(sessionStart,sessionEnd)+';return Session',{loader:'ts'}).code)(...Object.values(sessionDependencies));

interface ModalOptions {source:string;sourcePath:string;onSave:(source:string)=>Promise<void>;onClosed?:()=>void}
function fixture(format:'thoughtspace'|'md'='thoughtspace',initial:model.Board=model.emptyBoard()){
 const modals:MockModal[]=[];
 class MockModal {
  opened=false;closed=false;
  modalEl={isConnected:false};
  constructor(_app:unknown,readonly options:ModalOptions){modals.push(this);}
  open(){this.opened=true;this.modalEl.isConnected=true;}
  close(){this.closed=true;this.modalEl.isConnected=false;this.options.onClosed?.();}
  async save(value:string){await this.options.onSave(value);this.close();}
 }
 let sequence=0;
 const dependencies={...mermaid,applyDefaultCardStyle,MermaidEditorModal:MockModal,uid:()=>`mermaid-${++sequence}`,Notice:class{}};
 const View=new Function(...Object.keys(dependencies),transformSync('class View{'+['requireOwner','newMermaid','editMermaid','startInlineEdit'].map(method).join('\n')+'};return View',{loader:'ts'}).code)(...Object.values(dependencies));
 let disk=format==='md'?documents.createMarkdownBoardDocument(initial,'Test')+'\nUnrelated prose stays intact.\n':JSON.stringify(initial,null,2);
 const file={path:`Test.${format}`,basename:'Test',extension:format};
 const plugin={settings:{defaultTextSize:18,defaultCardStyle:'paper'},app:{vault:{process:async(_file:unknown,edit:(raw:string)=>string)=>{disk=edit(disk);},read:async()=>disk}},nativeBoardEditorStatus:()=>({open:0,pending:0})};
 const session=new Session(plugin,file,disk),view=new View();
 Object.assign(view,{plugin,app:plugin.app,session,inlineStart:0,selected:new Set(),point:()=>({x:200,y:100}),updateSelection(){},renderBoard(){},revealNode(){},clearCanvasGesture(){}});
 return{view,session,modals,before:model.clone(initial),disk:()=>disk,reopen:()=>new Session(plugin,file,disk)};
}
function diagramBoard():model.Board {
 return{...model.emptyBoard(),version:3,nodes:[
  {id:'diagram',kind:'text',text:mermaid.mermaidMarkdown('flowchart LR\n A --> B'),x:20,y:30,width:460,height:280,color:'sand',cardStyle:'paper',autoSize:false,textAutoHeight:false},
  {id:'note',kind:'text',text:'Ordinary text',x:600,y:30,width:240,height:80,color:'blue'}
 ],edges:[{id:'edge',from:'diagram',to:'note',label:'context',direction:'both'}]};
}

test('canceling new Mermaid leaves no node, disk change or undo entry',async()=>{
 const f=fixture(),before=f.disk();await f.view.newMermaid();assert.equal(f.modals.length,1);assert.equal(f.modals[0].options.source,mermaid.DEFAULT_MERMAID_SOURCE);
 f.modals[0].close();await f.session.flush();assert.equal(f.session.board.nodes.length,0);assert.equal(f.disk(),before);
 f.session.undo();await f.session.flush();assert.equal(f.disk(),before);
});

for(const format of ['thoughtspace','md'] as const)test(`Mermaid saves as existing text data and reopens with reversible history in ${format}`,async()=>{
 const f=fixture(format),value='sequenceDiagram\n Alice->>Bob: Hello';await f.view.newMermaid({x:200,y:100});
 assert.equal(f.modals[0].options.sourcePath,`Test.${format}`);await f.modals[0].save(value);await f.session.flush();
 assert.equal(f.session.blocked,false);const saved=f.reopen().board,node=saved.nodes[0];assert.equal(node.kind,'text');assert.equal(mermaid.mermaidSource(node.text!),value);assert.equal(node.autoSize,false);assert.equal(node.textAutoHeight,false);assert.deepEqual([...f.view.selected],[node.id]);
 assert.equal(saved.nodes.length,1);assert.equal(saved.edges.length,0);assert.doesNotThrow(()=>model.parseBoard(JSON.stringify(saved)));
 if(format==='md')assert.ok(f.disk().endsWith('\nUnrelated prose stays intact.\n'));
 f.session.undo();await f.session.flush();assert.deepEqual(f.reopen().board,f.before);
 f.session.undo(true);await f.session.flush();assert.deepEqual(f.reopen().board,saved);
});

test('an unsaved inline conflict prevents opening a new Mermaid draft',async()=>{
 const f=fixture();f.view.inline={commit:async()=>false};await f.view.newMermaid();assert.equal(f.modals.length,0);assert.equal(f.session.board.nodes.length,0);
});

test('board switching during inline commit cannot create or open on either board',async()=>{
 const f=fixture();f.view.inline={commit:async()=>{f.view.session={board:model.emptyBoard()};return true;}};
 await assert.rejects(f.view.newMermaid(),/白板已切换/);assert.equal(f.modals.length,0);assert.equal(f.session.board.nodes.length,0);assert.equal(f.view.session.board.nodes.length,0);
});

test('a pending creation cannot save after its board changes or becomes read-only',async()=>{
 for(const change of ['switch','blocked','closed'] as const){
  const f=fixture();await f.view.newMermaid();const before=f.disk();
  if(change==='switch')f.view.session={board:model.emptyBoard()};else if(change==='blocked')f.session.blocked=true;else f.view.closed=true;
  await assert.rejects(f.modals[0].save('flowchart LR\n A-->B'));assert.equal(f.session.board.nodes.length,0);assert.equal(f.disk(),before);
 }
});

test('repeated insert or edit requests keep a single active Mermaid draft',async()=>{
 const f=fixture('thoughtspace',diagramBoard());await f.view.newMermaid();await f.view.newMermaid();f.view.editMermaid('diagram');
 assert.equal(f.modals.length,1);assert.equal(f.session.board.nodes.length,2);
 f.modals[0].close();assert.equal(f.view.mermaidEditor,undefined);f.view.editMermaid('diagram');assert.equal(f.modals.length,2);
});

test('retry after an interrupted flush does not duplicate a new diagram or its history',async()=>{
 const f=fixture(),flush=f.session.flush.bind(f.session);let fail=true;
 f.session.flush=async()=>{await flush();if(fail){fail=false;throw Error('interrupted acknowledgement');}};
 await f.view.newMermaid();const value='flowchart TD\n A-->B';await assert.rejects(f.modals[0].save(value),/interrupted acknowledgement/);
 assert.equal(f.modals[0].closed,false);const id=f.session.board.nodes[0].id;await f.modals[0].save(value);
 assert.equal(f.reopen().board.nodes.length,1);assert.equal(f.reopen().board.nodes[0].id,id);
 f.session.undo();await f.session.flush();assert.deepEqual(f.reopen().board,f.before);
});

test('opening then canceling an existing Mermaid preserves source, geometry and connections',async()=>{
 const f=fixture('thoughtspace',diagramBoard()),before=f.disk();f.view.editMermaid('diagram');assert.equal(f.modals[0].options.source,'flowchart LR\n A --> B');
 f.modals[0].close();await f.session.flush();assert.deepEqual(f.session.board,f.before);assert.equal(f.disk(),before);
});

test('saving an edited diagram preserves current geometry and edges and supports undo/redo',async()=>{
 const f=fixture('thoughtspace',diagramBoard());f.view.editMermaid('diagram');
 // Moving or resizing in another view need not invalidate an unchanged source.
 f.session.change((board:model.Board)=>{Object.assign(board.nodes[0],{x:75,y:90,width:610,height:360});});await f.session.flush();
 const before=model.clone(f.session.board);await f.modals[0].save('flowchart TD\n A-->C');await f.session.flush();
 const saved=f.reopen().board;assert.deepEqual({...saved.nodes[0],text:before.nodes[0].text},before.nodes[0]);assert.deepEqual(saved.edges,before.edges);assert.deepEqual(saved.nodes[1],before.nodes[1]);
 f.session.undo();await f.session.flush();assert.deepEqual(f.reopen().board,before);
 f.session.undo(true);await f.session.flush();assert.deepEqual(f.reopen().board,saved);
});

test('unchanged source preserves existing fence bytes and the redo history',async()=>{
 const board=diagramBoard();board.nodes[0].text='\r\n  ~~~~mermaid\r\nflowchart LR\r\n A --> B\r\n  ~~~~\r\n';const f=fixture('thoughtspace',board);
 f.session.change((current:model.Board)=>{current.nodes[1].text='Redo survives';});await f.session.flush();f.session.undo();await f.session.flush();const before=f.disk();
 f.view.editMermaid('diagram');await f.modals[0].save(f.modals[0].options.source);assert.equal(f.disk(),before);
 f.session.undo(true);await f.session.flush();assert.equal(f.reopen().board.nodes[1].text,'Redo survives');assert.equal(f.reopen().board.nodes[0].text,board.nodes[0].text);
});

test('stale diagram edits never overwrite changed, deleted, converted or locked nodes',async()=>{
 for(const change of ['text','delete','kind','lock','web'] as const){
  const f=fixture('thoughtspace',diagramBoard());f.view.editMermaid('diagram');
  if(change==='text')f.session.board.nodes[0].text='Other editor draft';
  else if(change==='delete'){f.session.board.nodes.shift();f.session.board.edges=[];}
  else if(change==='kind'){f.session.board.nodes[0].kind='card';f.session.board.nodes[0].file='Note.md';}
  else if(change==='lock')f.session.board.nodes[0].locked=true;
  else f.session.board.nodes[0].webUrl='https://example.org/';
  const before=model.clone(f.session.board);await assert.rejects(f.modals[0].save('flowchart LR\n A-->C'));assert.deepEqual(f.session.board,before,change);
 }
});

test('standard editor entry routes standalone Mermaid into its draft modal',async()=>{
 const f=fixture('thoughtspace',diagramBoard());await f.view.startInlineEdit('diagram');assert.equal(f.modals.length,1);assert.equal(f.view.inline,undefined);assert.deepEqual(f.session.board,f.before);
});

test('a failed save is rejected and leaves the source recoverable in the active draft',async()=>{
 const f=fixture('thoughtspace',diagramBoard());f.view.editMermaid('diagram');
 f.session.plugin.app.vault.process=async()=>{throw Error('simulated disk failure');};
 await assert.rejects(f.modals[0].save('flowchart LR\n A-->D'),/保存|写入|暂停/);assert.equal(f.modals[0].closed,false);assert.equal(f.session.blocked,true);assert.equal(mermaid.mermaidSource(f.session.board.nodes[0].text),'flowchart LR\n A-->D');
 assert.deepEqual(f.reopen().board,f.before);
});
