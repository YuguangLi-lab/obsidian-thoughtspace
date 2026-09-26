import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,History,type Board} from '../src/model';
import {isWorkspaceFile} from '../src/workspace';
import {isPdfFile,pdfCard,pdfDropReference,pdfPage} from '../src/pdf-card';
import {resolveNativeNoteDrop,type NativeNoteReference} from '../src/native-note-drop';

const source=readFileSync('src/main.ts','utf8');
function method(start:string){
 const at=source.indexOf(start);assert.ok(at>=0,`Missing production method: ${start}`);
 const tail=source.slice(at+start.length),next=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(tail);
 assert.ok(next,`Missing end of production method: ${start}`);return source.slice(at,at+start.length+next.index);
}
const methods=method('  private handleBoardDrop(')+method('  private async insertDroppedNotes(')+method('  private requireOwner(');
const MATERIAL_DRAG='text/x-thoughtspace-fragment',EXT='thoughtspace';
class TFile {
 constructor(public path:string){}
 get extension(){return this.path.split('.').at(-1)||'';}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
}
type Point={x:number;y:number};
function fixture(){
 let sequence=0;
 const files=new Map<string,TFile>(),tasks:Promise<unknown>[]=[],errors:unknown[]=[],history=new History();
 const calls={changes:0,sourceWrites:0,selection:0,focus:0,materials:[] as unknown[][],attachments:[] as unknown[][],boards:[] as unknown[][],pdfs:[] as unknown[][],files:[] as unknown[][]};
 const deps={resolveNativeNoteDrop,isWorkspaceFile,isPdfFile,pdfCard,pdfDropReference,pdfPage,TFile,MATERIAL_DRAG,EXT,
  parseLinktext:(link:string)=>{const hash=link.indexOf('#');return{path:hash<0?link:link.slice(0,hash),subpath:hash<0?'':link.slice(hash)};},
  uid:()=>`drop-${++sequence}`,clone:structuredClone,
  act:(run:()=>unknown)=>{try{const pending=Promise.resolve(run());tasks.push(pending);void pending.catch(error=>errors.push(error));}catch(error){errors.push(error);}},
  Notice:class {constructor(message:string){errors.push(new Error(message));}}
 };
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View(),owner={board:{...emptyBoard(),version:3 as const,viewport:{x:47,y:-31,zoom:.65}} as Board,file:new TFile('Boards/current.thoughtspace'),blocked:false,
  change(run:(board:Board)=>void){const before=structuredClone(this.board);try{run(this.board);}catch(error){this.board=before;throw error;}history.push(before);calls.changes++;}}
 const add=(path='Notes/Alpha.md')=>{const file=new TFile(path);files.set(path,file);return file;};
 const position=(x:number,y:number):Point=>({x:(x-100-owner.board.viewport.x)/owner.board.viewport.zoom,y:(y-50-owner.board.viewport.y)/owner.board.viewport.zoom});
 const resolve=(link:string,sourcePath:string)=>{
  const path=link.split('#')[0],folder=sourcePath.slice(0,sourcePath.lastIndexOf('/')+1);
  return files.get(path)||files.get(path+'.md')||files.get(folder+path)||files.get(folder+path+'.md');
 };
 const forbidWrite=()=>{calls.sourceWrites++;throw Error('Source note writes are forbidden during reference insertion');};
 Object.assign(view,{session:owner,file:owner.file,closed:false,selected:new Set(['previous']),selectedEdge:'previous-edge',contextOpen:true,
  app:{dragManager:{draggable:null},vault:{getName:()=> 'demo-vault',getAbstractFileByPath:(path:string)=>files.get(path),getFileByPath:(path:string)=>files.get(path),modify:forbidWrite,process:forbidWrite,create:forbidWrite,createBinary:forbidWrite},metadataCache:{getFirstLinkpathDest:resolve}},
  plugin:{settings:{defaultCardWidth:300},receiveMaterial:(...args:unknown[])=>calls.materials.push(args)},
  point:position,materialDropPoint:position,stage:{focus:()=>calls.focus++},updateSelection:()=>calls.selection++,renderBoard(){},
  importBoardAttachments:(...args:unknown[])=>calls.attachments.push(args),addBoard:(...args:unknown[])=>calls.boards.push(args),
  insertPdfCard:(...args:unknown[])=>calls.pdfs.push(args),addFile:(...args:unknown[])=>calls.files.push(args),
 });
 const event=(data:Record<string,string>={},external:unknown[]=[])=>{
  let prevented=0,stopped=0;const transfer={types:[...Object.keys(data),...(external.length?['Files']:[])],files:external,dropEffect:'none',getData:(type:string)=>data[type]||''};
  const value={clientX:520,clientY:310,dataTransfer:transfer,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;prevented++;},stopPropagation(){stopped++;}};
  return{value:value as unknown as DragEvent,data,transfer,handled:()=>({prevented,stopped})};
 };
 const refs=(items:TFile[]):NativeNoteReference<TFile>[]=>items.map(file=>({file,path:file.path,page:1}));
 const drain=async()=>{await Promise.allSettled(tasks);if(errors.length)throw errors[0];};
 return{view,owner,files,calls,history,errors,tasks,add,event,refs,drain,position};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>resolve=done);return{promise,resolve};}

test('native drop is accepted synchronously before saving an existing draft and allows native cleanup',async()=>{
 const f=fixture(),file=f.add(),saved=deferred<boolean>(),e=f.event();let commits=0;
 f.view.inline={commit:()=>{commits++;return saved.promise;}};f.view.app.dragManager.draggable={type:'file',file};
 f.view.handleBoardDrop(e.value);assert.equal(e.value.defaultPrevented,true);assert.equal(e.handled().stopped,0);assert.equal(commits,1);assert.equal(f.owner.board.nodes.length,0);
 // Obsidian clears this state immediately after bubbling drop; insertion owns its snapshot.
 f.view.app.dragManager.draggable=null;saved.resolve(true);await f.drain();
 assert.equal(f.owner.board.nodes.length,1);assert.equal(f.owner.board.nodes[0].file,file.path);assert.equal(f.calls.sourceWrites,0);
});

test('multiple native references insert as one undoable grid without changing viewport or source notes',async()=>{
 const f=fixture(),files=Array.from({length:5},(_,index)=>f.add(`Notes/Note ${index}.md`)),camera=f.owner.board.viewport,before=structuredClone(f.owner.board);
 await f.view.insertDroppedNotes(f.refs(files),{x:600,y:300},f.owner);
 const nodes=f.owner.board.nodes;assert.equal(f.calls.changes,1);assert.equal(nodes.length,5);assert.deepEqual(nodes.map(node=>node.file),files.map(file=>file.path));assert.ok(nodes.every(node=>node.kind==='card'&&node.autoFit===true));
 assert.equal(new Set(nodes.map(node=>node.x)).size,3);assert.equal(new Set(nodes.map(node=>node.y)).size,2);assert.equal(nodes[0].y,nodes[2].y);assert.ok(nodes[3].y>nodes[0].y);assert.equal(nodes[0].x,nodes[3].x);
 assert.deepEqual([...f.view.selected],nodes.map(node=>node.id));assert.equal(f.view.selectedEdge,undefined);assert.equal(f.owner.board.viewport,camera);assert.deepEqual(camera,before.viewport);assert.equal(f.calls.sourceWrites,0);
 f.owner.board=f.history.undo(f.owner.board)!;assert.deepEqual(f.owner.board,before);
});

test('real native decoder resolves extensionless encoded Obsidian URIs and preserves multi-select order',async()=>{
 const f=fixture(),files=[f.add('Notes/中文 Alpha.md'),f.add('Notes/Beta.md')];
 const text=files.map(file=>'obsidian://open?vault=demo-vault&file='+encodeURIComponent(file.path.replace(/\.md$/,''))).join('\n'),e=f.event({'text/plain':text,'text/uri-list':text});
 f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,true);assert.equal(e.handled().stopped,0);assert.deepEqual(f.owner.board.nodes.map(node=>node.file),files.map(file=>file.path));assert.equal(f.calls.changes,1);
});

test('a rejected cross-vault URI cannot be rescued by a same-name local PDF display payload',async()=>{
 const f=fixture(),pdf=f.add('Papers/local.pdf'),before=structuredClone(f.owner.board),e=f.event({'text/uri-list':'obsidian://open?vault=other-vault&file='+encodeURIComponent(pdf.path),'text/plain':`[[${pdf.path}#page=7]]`});
 f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,false);assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);assert.equal(f.calls.attachments.length,0);assert.equal(f.calls.sourceWrites,0);assert.deepEqual([...f.view.selected],['previous']);
});

test('an unsupported native draggable cannot be rescued by unrelated PDF text',async()=>{
 for(const kind of ['image','folder','unknown']){
  const f=fixture(),pdf=f.add('Papers/local.pdf'),image=f.add('Images/figure.png'),before=structuredClone(f.owner.board),e=f.event({'text/plain':`[[${pdf.path}#page=7]]`});
  f.view.app.dragManager.draggable=kind==='image'?{type:'file',file:image}:kind==='folder'?{type:'folder',file:{path:'Papers'}}:{type:'unknown'};
  f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,false,kind);assert.deepEqual(f.owner.board,before,kind);assert.equal(f.calls.changes,0,kind);assert.equal(f.calls.sourceWrites,0,kind);assert.deepEqual([...f.view.selected],['previous'],kind);
 }
});

test('material drops keep highest priority over native files, custom MIME and external attachments',async()=>{
 const f=fixture(),file=f.add(),external={name:'scan.pdf'},e=f.event({[MATERIAL_DRAG]:'owned-token','text/x-thoughtspace-note':file.path},[external]);f.view.app.dragManager.draggable={type:'file',file};
 f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,true);assert.equal(f.calls.materials.length,1);assert.equal(f.calls.materials[0][0],e.value);assert.equal(f.calls.materials[0][1],f.view);assert.deepEqual(f.calls.materials[0][2],f.position(520,310));assert.equal(f.calls.attachments.length,0);assert.equal(f.calls.changes,0);
});

test('legacy custom note and board MIME keep their original target and drop coordinates',async()=>{
 for(const kind of ['note','board']){
  const f=fixture(),file=f.add(kind==='note'?'Notes/Legacy.md':'Boards/Child.thoughtspace'),e=f.event({[`text/x-thoughtspace-${kind}`]:file.path});
  f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,true);
  if(kind==='board'){assert.equal(f.calls.boards.length,1);assert.equal(f.calls.boards[0][0],file);assert.deepEqual(f.calls.boards[0][1],f.position(520,310));}
  else{const point=f.position(520,310);assert.equal(f.owner.board.nodes.length,1);assert.equal(f.owner.board.nodes[0].file,file.path);assert.deepEqual([f.owner.board.nodes[0].x,f.owner.board.nodes[0].y],[point.x-150,point.y-70]);assert.equal(f.calls.changes,1);}
  assert.equal(f.calls.sourceWrites,0);
 }
});

test('external attachments remain delegated to attachment import',async()=>{
 const f=fixture(),attachments=[{name:'scan.pdf'},{name:'figure.png'}],e=f.event({},attachments);
 f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,true);assert.equal(f.calls.attachments.length,1);assert.deepEqual(f.calls.attachments[0],[attachments,f.position(520,310)]);assert.equal(f.calls.changes,0);
});

test('legacy PDF references retain their page while native PDF references stay in the batch transaction',async()=>{
 const f=fixture(),pdf=f.add('Papers/example.pdf'),e=f.event({'text/plain':'[[Papers/example.pdf#page=7]]'});f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,true);
 const point=f.position(520,310);assert.equal(f.owner.board.nodes.length,1);assert.equal(f.owner.board.nodes[0].file,pdf.path);assert.equal(f.owner.board.nodes[0].pdfPage,7);assert.deepEqual([f.owner.board.nodes[0].x,f.owner.board.nodes[0].y],[point.x-150,point.y-70]);assert.equal(f.calls.changes,1);
 const next=fixture(),note=next.add(),other=next.add('Papers/other.pdf');await next.view.insertDroppedNotes([{file:note,path:note.path,page:1},{file:other,path:other.path,page:4}],{x:600,y:300},next.owner);
 assert.equal(next.calls.changes,1);assert.deepEqual(next.owner.board.nodes.map(node=>[node.kind,node.file,node.pdfPage]),[['card',note.path,undefined],['pdf',other.path,4]]);assert.equal(next.calls.sourceWrites,0);
});

test('empty native references report missing files without changing selection or history',async()=>{
 const f=fixture(),before=structuredClone(f.owner.board);await assert.rejects(f.view.insertDroppedNotes([],{x:0,y:0},f.owner),/文件|笔记|删除|移|未找到|不存在/);assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);assert.deepEqual([...f.view.selected],['previous']);
});

test('an unsaved editor conflict cancels the entire insert and retains its current state',async()=>{
 const f=fixture(),file=f.add(),before=structuredClone(f.owner.board),editor={commit:async()=>false};f.view.inline=editor;
 await f.view.insertDroppedNotes(f.refs([file]),{x:0,y:0},f.owner);assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);assert.equal(f.view.inline,editor);assert.deepEqual([...f.view.selected],['previous']);
});

test('switching or blocking the owner while inline save awaits cannot mutate either board',async()=>{
 for(const state of ['switched','blocked','closed']){
  const f=fixture(),file=f.add(),saved=deferred<boolean>(),before=structuredClone(f.owner.board);f.view.inline={commit:()=>saved.promise};
  const pending=f.view.insertDroppedNotes(f.refs([file]),{x:0,y:0},f.owner),other={board:emptyBoard(),blocked:false};
  if(state==='switched')f.view.session=other;else if(state==='blocked')f.owner.blocked=true;else f.view.closed=true;saved.resolve(true);
  await assert.rejects(pending,/切换|暂停|关闭|变化|改变/);assert.deepEqual(f.owner.board,before);assert.deepEqual(other.board,emptyBoard());assert.equal(f.calls.changes,0);
 }
});

test('deletion, path changes or replacement during inline save reject the whole native batch',async()=>{
 for(const state of ['deleted','moved','replaced']){
  const f=fixture(),files=[f.add('Notes/First.md'),f.add('Notes/Second.md')],refs=f.refs(files),saved=deferred<boolean>(),before=structuredClone(f.owner.board);f.view.inline={commit:()=>saved.promise};
  const pending=f.view.insertDroppedNotes(refs,{x:0,y:0},f.owner);
  if(state==='deleted')f.files.delete(files[1].path);else if(state==='replaced')f.add(files[1].path);else{const previous=files[1].path;f.files.delete(previous);files[1].path='Moved/Second.md';f.files.set(files[1].path,files[1]);}
  saved.resolve(true);await assert.rejects(pending,/文件|笔记|删除|移|变化|改变/);assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);assert.equal(f.calls.sourceWrites,0);
 }
});

test('unsupported and protected files cannot enter a native batch, and unrelated text remains unclaimed',async()=>{
 for(const path of ['image.png','Boards/other.thoughtspace','ThoughtSpace-plugin-backups/Old.md','ThoughtSpace/白板搜索/Index.md']){
  const f=fixture(),valid=f.add(),invalid=f.add(path);await assert.rejects(f.view.insertDroppedNotes(f.refs([valid,invalid]),{x:0,y:0},f.owner),/支持|文件|笔记|备份|删除|移|变化|改变/);assert.equal(f.calls.changes,0);assert.equal(f.owner.board.nodes.length,0);
 }
 const f=fixture(),e=f.event({'text/plain':'ordinary text without a file link'});f.view.handleBoardDrop(e.value);await f.drain();assert.equal(e.value.defaultPrevented,false);assert.equal(f.calls.changes,0);assert.equal(f.calls.attachments.length,0);
});
