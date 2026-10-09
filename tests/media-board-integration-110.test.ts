import {applyDefaultCardStyle} from '../src/card-style';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,History,parseBoard,type Board,type Card} from '../src/model';
import {mediaCard,mediaKind,mediaClock,mediaTime,mediaSourceMarkdown,parseMediaSourceUrl,type MediaSource} from '../src/media-source';
import {foldCards} from '../src/board-tools';
import {isWorkspaceFile} from '../src/workspace';
import {isPdfFile,pdfCard,pdfPage} from '../src/pdf-card';
import {isNativeImagePath as isImage,type NativeNoteReference} from '../src/native-note-drop';
import type {MediaCardOptions,MediaCardState} from '../src/media-card-player';
import {MediaPlayback} from '../src/media-playback';

const source=readFileSync('src/main.ts','utf8');
function method(start:string){
 const at=source.indexOf(start);assert.ok(at>=0,`Missing production method ${start}`);
 const tail=source.slice(at+start.length),next=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(tail);
 assert.ok(next,`Missing end of production method ${start}`);return source.slice(at,at+start.length+next.index);
}
const methods=['  private async insertDroppedNotes(','  private requireOwner(','  seekMediaSource(','  private async captureMedia(','  private renderMediaCard('].map(method).join('\n');
class TFile {
 stat={mtime:100,size:1000};constructor(public path:string){}
 get extension(){return this.path.split('.').at(-1)!;}get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
}
class Element {
 isConnected=true;children:Element[]=[];text='';disabled=false;
 createSpan(value?:{text?:string}|string){const child=new Element();if(value&&typeof value==='object')child.text=value.text||'';this.children.push(child);return child;}
 createDiv(value?:{text?:string}|string){return this.createSpan(value);}
 addClass(){}setAttribute(){}
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>resolve=done);return{promise,resolve};}
function fixture(){
 let sequence=0;const files=new Map<string,TFile>(),history=new History(),mounts:{options:MediaCardOptions;disposed:number;pauses:number;seeks:number[]}[]=[],notices:string[]=[];
 const calls={changes:0,writes:0,selected:0,focus:0,render:0,revealed:[] as string[],edited:[] as unknown[][]};
 let measure=async()=>new Map<string,{width:number;height:number}>();
 const deps={applyDefaultCardStyle,TFile,mediaCard,mediaKind,mediaClock,mediaTime,mediaSourceMarkdown,foldCards,isWorkspaceFile,isPdfFile,pdfCard,pdfPage,isImage,clone:structuredClone,
  uid:()=>`generated-${++sequence}`,measureDroppedImages:()=>measure(),setIcon:()=>{},hostPlugin:()=>undefined,yingjianPlayerConnection:()=>({nativePlayback:false}),
  button:()=>new Element(),Notice:class{constructor(message:string){notices.push(message);}},
  mountMediaCard:(_host:unknown,options:MediaCardOptions)=>{const mounted={options,disposed:0,pauses:0,seeks:[] as number[]};let state:MediaCardState={time:options.initialTime||0,rate:1,volume:1,...options.state};mounts.push(mounted);return{dispose:()=>mounted.disposed++,pause:()=>mounted.pauses++,seek:(time:number)=>{mounted.seeks.push(time);state={...state,time};},getState:()=>({...state}),play:()=>options.onPlay?.()};}
 };
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const owner={board:{...emptyBoard(),version:3 as const,viewport:{x:47,y:-31,zoom:.65}} as Board,file:new TFile('Boards/current.thoughtspace'),blocked:false,refreshNativeEditing(){},
  change(run:(board:Board)=>void){const before=structuredClone(this.board);try{run(this.board);parseBoard(JSON.stringify(this.board));}catch(error){this.board=before;throw error;}history.push(before);calls.changes++;}};
 const view=new View(),forbid=()=>{calls.writes++;throw Error('Reference operations must not write source files');};
 Object.assign(view,{session:owner,file:owner.file,closed:false,selected:new Set(['previous']),selectedEdge:'previous-edge',contextOpen:true,mediaStates:new Map<string,MediaCardState>(),mediaIdentities:new Map<string,string>(),mediaPlayers:new Map(),
  app:{vault:{getName:()=> 'demo-vault',getAbstractFileByPath:(path:string)=>files.get(path),getResourcePath:(file:TFile)=>'app://vault/'+file.path,modify:forbid,process:forbid,create:forbid,createBinary:forbid}},
  plugin:{settings:{defaultCardWidth:320,defaultTextSize:18,defaultEdgeStyle:'curve',detailZoom:.5},openNoteInSidebar:()=>{},openMediaWorkspace:()=>{},mediaWorkspace:{validateResource:async()=>{},resolveResource:(file:TFile)=>'app://vault/'+file.path,playback:new MediaPlayback(),identity:(file:TFile)=>({path:file.path,mtime:file.stat.mtime,size:file.stat.size})}},
  stage:{ownerDocument:{},focus:()=>calls.focus++},updateSelection:()=>calls.selected++,renderBoard:()=>calls.render++,revealNode:(id:string)=>calls.revealed.push(id),startInlineEdit:async(...args:unknown[])=>{calls.edited.push(args);return true;}
 });
 const addFile=(path:string)=>{const file=new TFile(path);files.set(path,file);return file;};
 const addMedia=(id='source',path='媒体/片段 #[一] 100%2F.mp4')=>{const file=addFile(path),node=mediaCard(id,path,200,150);owner.board.nodes.push(node);return{node,file};};
 const link=(node:Card,time=12.125):MediaSource=>({vault:'demo-vault',board:owner.file.path,node:node.id,file:node.file!,time});
 const render=(node:Card)=>{const element=new Element(),header=new Element(),disposals:(()=>void)[]=[];view.renderMediaCard(node,element,header,{register:(fn:()=>void)=>disposals.push(fn)});return{element,header,disposals,mounted:mounts.at(-1)!};};
 return{view,owner,files,history,calls,mounts,notices,addFile,addMedia,link,render,setMeasure:(next:typeof measure)=>{measure=next;}};
}

test('mixed audio/video drop is one undoable transaction preserving camera and file references',async()=>{
 const f=fixture(),paths=['音频/录音.mp3','视频/课程.mp4','论文.pdf','笔记.md','图片.png'],files=paths.map(f.addFile),refs:NativeNoteReference<TFile>[]=files.map(file=>({file,path:file.path,page:file.extension==='pdf'?4:1,...(mediaKind(file.path)?{start:12.125}:{})}));
 const before=structuredClone(f.owner.board),camera=f.owner.board.viewport;await f.view.insertDroppedNotes(refs,{x:600,y:300},f.owner);
 assert.equal(f.calls.changes,1);assert.equal(f.calls.writes,0);assert.equal(f.history.undoStack.length,1);assert.equal(f.owner.board.viewport,camera);assert.deepEqual(camera,before.viewport);
 assert.deepEqual(f.owner.board.nodes.map(n=>[n.kind,n.file]),[['audio',paths[0]],['video',paths[1]],['pdf',paths[2]],['card',paths[3]],['image',paths[4]]]);
 assert.deepEqual(f.owner.board.nodes.slice(0,2).map(n=>n.mediaStart),[12.125,12.125]);assert.equal(f.owner.board.nodes[2].pdfPage,4);
 assert.ok(f.owner.board.nodes[3].y>=Math.max(...f.owner.board.nodes.slice(0,3).map(n=>n.y+n.height))+32);assert.deepEqual([...f.view.selected],f.owner.board.nodes.map(n=>n.id));assert.equal(f.view.selectedEdge,undefined);
 assert.deepEqual(f.history.undo(f.owner.board),before);
});
test('audio/video insertion revalidates stale owners and exact file identity after asynchronous work',async()=>{
 for(const state of ['switched','blocked','closed','deleted','replaced','renamed']){
  const f=fixture(),file=f.addFile('clip.mp4'),gate=deferred<Map<string,{width:number;height:number}>>(),before=structuredClone(f.owner.board);f.setMeasure(()=>gate.promise);
  const pending=f.view.insertDroppedNotes([{file,path:file.path,page:1,start:2}],{x:0,y:0},f.owner);
  if(state==='switched')f.view.session={board:emptyBoard()};if(state==='blocked')f.owner.blocked=true;if(state==='closed')f.view.closed=true;if(state==='deleted')f.files.delete(file.path);if(state==='replaced')f.addFile(file.path);if(state==='renamed')file.path='other.mp4';
  gate.resolve(new Map());await assert.rejects(pending,state);assert.equal(f.calls.changes,0,state);assert.equal(f.calls.writes,0,state);assert.deepEqual(f.owner.board,before,state);
 }
});
test('capture records exact time backlink and source edge in one camera-preserving transaction',async()=>{
 const f=fixture(),{node}=f.addMedia(),mounted=f.render(node).mounted,before=structuredClone(f.owner.board),camera=f.owner.board.viewport;
 await f.view.captureMedia(node.id,72.125,f.owner);
 assert.equal(f.calls.changes,1);assert.equal(f.calls.writes,0);assert.equal(f.history.undoStack.length,1);assert.equal(mounted.pauses,1);assert.equal(f.owner.board.viewport,camera);assert.deepEqual(camera,before.viewport);
 const text=f.owner.board.nodes.find(n=>n.kind==='text')!;assert.ok(text);assert.match(text.text!,/^\n\n\[/);const url=/\]\((obsidian:\/\/thoughtspace-media[^)]+)\)/.exec(text.text!)?.[1];assert.ok(url);assert.deepEqual(parseMediaSourceUrl(url),f.link(node,72.125));
 assert.deepEqual(f.owner.board.edges.map(e=>[e.from,e.to,e.label,e.direction]),[[node.id,text.id,'1:12','forward']]);assert.deepEqual([...f.view.selected],[text.id]);assert.deepEqual(f.calls.edited,[[text.id,false,true]]);assert.deepEqual(f.history.undo(f.owner.board),before);
});
test('capture cancelled by inline editor conflict preserves selection and history',async()=>{
 const f=fixture(),{node}=f.addMedia(),before=structuredClone(f.owner.board);f.view.inline={commit:async()=>false};await f.view.captureMedia(node.id,5,f.owner);
 assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);assert.deepEqual([...f.view.selected],['previous']);assert.deepEqual(f.calls.edited,[]);
});
test('capture rejects invalid time before saving inline input or changing board',async()=>{
 for(const time of [-1,NaN,Infinity,100000001]){const f=fixture(),{node}=f.addMedia();let commits=0;f.view.inline={commit:async()=>{commits++;return true;}};
  await assert.rejects(f.view.captureMedia(node.id,time,f.owner));assert.equal(commits,0);assert.equal(f.calls.changes,0);assert.equal(f.calls.writes,0);
 }
});
test('capture refuses stale owner after a pending inline save',async()=>{
 for(const state of ['switched','blocked','closed']){const f=fixture(),{node}=f.addMedia(),gate=deferred<boolean>(),before=structuredClone(f.owner.board);f.view.inline={commit:()=>gate.promise};const pending=f.view.captureMedia(node.id,5,f.owner);
  if(state==='switched')f.view.session={board:emptyBoard()};if(state==='blocked')f.owner.blocked=true;if(state==='closed')f.view.closed=true;gate.resolve(true);await assert.rejects(pending);assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);assert.equal(f.calls.writes,0);
 }
});
test('capture rejects source rebind or deletion while inline save is pending',async()=>{
 for(const state of ['rebound','deleted-node','deleted-file','replaced-file','changed-file','resized-file']){const f=fixture(),{node,file}=f.addMedia(),gate=deferred<boolean>();f.view.inline={commit:()=>gate.promise};const pending=f.view.captureMedia(node.id,5,f.owner);
  if(state==='rebound')node.file=f.addFile('replacement.mp4').path;if(state==='deleted-node')f.owner.board.nodes=[];if(state==='deleted-file')f.files.delete(file.path);if(state==='replaced-file')f.addFile(file.path);if(state==='changed-file')file.stat.mtime++;if(state==='resized-file')file.stat.size++;const before=structuredClone(f.owner.board);
  gate.resolve(true);await assert.rejects(pending,state);assert.equal(f.calls.changes,0,state);assert.deepEqual(f.owner.board,before,state);
 }
});
test('valid time backlink seeks the retained player without board edits or autoplay',()=>{
 const f=fixture(),{node}=f.addMedia(),mounted=f.render(node).mounted,before=structuredClone(f.owner.board);f.view.mediaStates.set(node.id,{time:2,rate:1.5,volume:.4});f.view.seekMediaSource(f.link(node,31.25));
 assert.deepEqual(mounted.seeks,[31.25]);assert.deepEqual(f.view.mediaStates.get(node.id),{time:31.25,rate:1.5,volume:.4});assert.equal(f.calls.changes,0);assert.deepEqual(f.owner.board,before);assert.deepEqual(f.calls.revealed,[node.id]);assert.equal(f.calls.render,1);
});
test('time backlink rejects changed, removed, missing, or non-media source before reveal',()=>{
 for(const state of ['rebound','deleted-node','deleted-file','wrong-kind','wrong-board']){const f=fixture(),{node,file}=f.addMedia(),link=f.link(node),mounted=f.render(node).mounted;
  if(state==='rebound')node.file=f.addFile('other.mp4').path;if(state==='deleted-node')f.owner.board.nodes=[];if(state==='deleted-file')f.files.delete(file.path);if(state==='wrong-kind')node.kind='card';if(state==='wrong-board')link.board='Other.thoughtspace';
  assert.throws(()=>f.view.seekMediaSource(link),state);assert.equal(f.calls.changes,0,state);assert.deepEqual(f.calls.revealed,[],state);assert.deepEqual(mounted.seeks,[],state);
 }
});
test('backlink unfolds an unlocked media card in one reversible change and rejects locked fold',()=>{
 for(const locked of [false,true]){const f=fixture(),{node}=f.addMedia();foldCards(f.owner.board,new Set([node.id]),true);node.locked=locked;const before=structuredClone(f.owner.board);
  if(locked){assert.throws(()=>f.view.seekMediaSource(f.link(node)),/解锁/);assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);}
  else{f.view.seekMediaSource(f.link(node));assert.equal(node.collapsed,undefined);assert.equal(f.calls.changes,1);assert.deepEqual(f.history.undo(f.owner.board),before);}
 }
});
for(const state of ['live','folded','detached','switched','closed','rebound','deleted-node','wrong-kind','deleted-file','replaced-file','changed-file','resized-file'])test(`media onState protects exact source identity: ${state}`,()=>{const f=fixture(),{node,file}=f.addMedia(),rendered=f.render(node),mounted=rendered.mounted,previous={time:1,rate:1,volume:1};f.view.mediaStates.set(node.id,previous);
  if(state==='folded')node.collapsed=true;if(state==='detached')rendered.element.isConnected=false;
  if(state==='switched')f.view.session={board:emptyBoard()};if(state==='closed')f.view.closed=true;if(state==='rebound')node.file='other.mp4';if(state==='deleted-node')f.owner.board.nodes=[];if(state==='wrong-kind')node.kind='card';if(state==='deleted-file')f.files.delete(file.path);if(state==='replaced-file')f.addFile(file.path);if(state==='changed-file')file.stat.mtime++;if(state==='resized-file')file.stat.size++;
  const next={time:12.25,rate:1.25,volume:.6};mounted.options.onState(next);assert.deepEqual(f.view.mediaStates.get(node.id),['live','folded','detached'].includes(state)?next:previous,state);assert.equal(f.calls.changes,0,state);
});
test('obsolete scope cleanup disposes its own player without removing a newer mounted handle',()=>{
 const f=fixture(),{node}=f.addMedia(),first=f.render(node),old=f.view.mediaPlayers.get(node.id),second=f.render(node),current=f.view.mediaPlayers.get(node.id);assert.notEqual(old,current);
 first.disposals.forEach(dispose=>dispose());assert.equal(first.mounted.disposed,1);assert.equal(second.mounted.disposed,0);assert.equal(f.view.mediaPlayers.get(node.id),current);
 second.disposals.forEach(dispose=>dispose());assert.equal(second.mounted.disposed,1);assert.equal(f.view.mediaPlayers.has(node.id),false);
});

test('an external source validation failure never changes board history or selection',async()=>{
 const f=fixture(),{node}=f.addMedia('outside','References/lecture.tsvideo'),before=structuredClone(f.owner.board);
 f.view.plugin.mediaWorkspace.validateResource=async()=>{throw Error('原文件已变化，请重新关联');};
 await assert.rejects(f.view.captureMedia(node.id,12,f.owner),/已变化/);
 assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);assert.deepEqual([...f.view.selected],['previous']);
});
test('external media is revalidated after an asynchronous inline edit before appending an excerpt',async()=>{
 const f=fixture(),{node}=f.addMedia('outside','References/lecture.tsvideo'),before=structuredClone(f.owner.board);let changed=false,checks=0;
 f.view.plugin.mediaWorkspace.validateResource=async()=>{checks++;if(changed)throw Error('原文件已变化');};
 f.view.inline={commit:async()=>{changed=true;return true;}};
 await assert.rejects(f.view.captureMedia(node.id,12,f.owner),/已变化/);assert.equal(checks,2);assert.deepEqual(f.owner.board,before);assert.equal(f.calls.changes,0);
});
