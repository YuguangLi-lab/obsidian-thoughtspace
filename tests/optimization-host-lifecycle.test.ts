import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {createHandwritingBoard,isHandwritingBoard} from '../src/handwriting-board';
import {readBoardConflictFile,validateBoardConflictOpen} from '../src/board-conflict-compare-model';

const source=readFileSync('src/main.ts','utf8');
const take=(start:string,end:string)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
class File {stat={mtime:1};constructor(public path:string,public extension:string){} }
function fixture(extension='md'){
 const file=new File(`Source.${extension}`,extension),board=createHandwritingBoard(),doc={defaultView:{closed:false}},refs=new Map<()=>void,string>(),modals:any[]=[],copies:any[]=[],opened:File[]=[],actions:string[]=[],exports:any[]=[],notices:string[]=[];
 let active:any,disk='disk snapshot',flush=Promise.resolve(),copyFailure='';
 const owner={file,board,blocked:false,saveFeedback:{state:'error'},recoveryFile:undefined,localDraftSource:()=>'local snapshot',flush:()=>flush};
 const vault={getAbstractFileByPath:(path:string)=>path===file.path?file:undefined,read:async()=>disk};
 const app={vault,workspace:{getActiveViewOfType:()=>active,on:(name:string,fn:()=>void)=>{const ref=()=>fn();refs.set(ref,name);return ref;},offref:(fn:()=>void)=>refs.delete(fn)}};
 class Compare {closed=false;constructor(_app:unknown,public host:any){modals.push(this);}open(){}close(){if(this.closed)return;this.closed=true;this.host.closed();}}
 class Copy {closed=false;constructor(_app:unknown,public host:any){if(copyFailure)throw Error(copyFailure);copies.push(this);}open(){}close(){if(this.closed)return;this.closed=true;this.host.closed();}}
 const deps={View:class{},TFile:File,isHandwritingBoard,readBoardConflictFile,validateBoardConflictOpen,BoardConflictCompareModal:Compare,BoardLocalDraftCopyModal:Copy,act:(run:()=>unknown)=>run(),Notice:class{constructor(message:string){notices.push(message);}},isWorkspaceFile:()=>true,isBoardFile:()=>false,
  openHandwritingExport:(_app:unknown,host:any)=>{const modal={host,close(){host.closed();}};exports.push(modal);return modal;}};
 const methods=take('  private async compareSaveVersions(){','  private scheduleRender(')+take('  private async exportHandwriting(','  private renderHandwritingBoard(){');
 const Host=new Function(...Object.keys(deps),transformSync('class Host{'+methods+'};return Host',{loader:'ts'}).code)(...Object.values(deps));
 const host=new Host();Object.assign(host,{app,session:owner,file,contentEl:{ownerDocument:doc,isConnected:true},leaf:{},plugin:{nativeBoardTransitions:new Set(),openBoardNativeMarkdown:async(target:File)=>{opened.push(target);}},closed:false,closing:false,saveFeedbackSequence:0,saveFeedbackPending:false,requireOwner:()=>{},runSaveFeedbackAction:async(action:string)=>actions.push(action)});host.leaf.view=host;active=host;
 const navigate=(next:any)=>{active=next;for(const [fn,name]of [...refs])if(name==='active-leaf-change')fn();};
 return{host,owner,file,board,doc,refs,modals,copies,exports,opened,actions,notices,navigate,setCopyFailure:()=>copyFailure='Synthetic modal construction failed',setDisk:(raw:string)=>disk=raw,setFlush:(value:Promise<void>)=>flush=value};
}
test('export host invalidates a pending flush after navigation away and back',async()=>{
 const f=fixture();let resolve!:()=>void;f.setFlush(new Promise<void>(done=>resolve=done));
 const pending=f.host.exportHandwriting();f.navigate({});f.navigate(f.host);resolve();await pending;
 assert.equal(f.exports.length,0);assert.equal(f.refs.size,0);
});
test('export host releases navigation listeners on close and refuses a stale ink snapshot',async()=>{
 const f=fixture();await f.host.exportHandwriting();assert.equal(f.refs.size,2);const first=f.exports[0];assert.equal(first.host.current(),true);first.close();assert.equal(f.refs.size,0);assert.equal(first.host.current(),false);
 await f.host.exportHandwriting();const second=f.exports[1];f.owner.board={...f.board,ink:{...f.board.ink}};assert.equal(second.host.current(),false);second.close();assert.equal(f.refs.size,0);
});
test('export dismissal quarantines only the exact current handwriting view before releasing its lifetime',async()=>{
 for(const changed of ['none','view','navigation','ink']){
  const f=fixture(),points:unknown[]=[],point={clientX:120,clientY:240,pointerType:'mouse'};
  f.host.handwritingView={suppressPointerRepeat:(value:unknown)=>points.push(value)};await f.host.exportHandwriting();const modal=f.exports[0];
  if(changed==='view')f.host.handwritingView={suppressPointerRepeat:()=>assert.fail('replacement view must not be gated')};
  if(changed==='navigation')f.navigate({});if(changed==='ink')f.owner.board={...f.board,ink:{...f.board.ink}};
  modal.host.closed(point);assert.deepEqual(points,changed==='none'?[point]:[],changed);assert.equal(f.refs.size,0);assert.equal(modal.host.current(),false);
 }
});
test('compare host opens an exact Markdown disk version through a separate native leaf and retains protected local state',async()=>{
 const f=fixture();await f.host.compareSaveVersions();const modal=f.modals[0],input=await modal.host.read();assert.equal(input.local.source,'local snapshot');assert.equal(input.original.source,'disk snapshot');
 await modal.host.open(input.original);assert.deepEqual(f.opened,[f.file]);assert.equal(f.owner.localDraftSource(),'local snapshot');assert.equal(f.owner.saveFeedback.state,'error');assert.equal(f.host.session,f.owner);assert.equal(f.refs.size,0);
});
test('compare host rejects a disk version changed after reading and permanently cancels on navigation',async()=>{
 const f=fixture();await f.host.compareSaveVersions();const modal=f.modals[0],input=await modal.host.read();f.setDisk('new disk snapshot');await assert.rejects(modal.host.open(input.original),/版本已变化/);assert.equal(f.opened.length,0);
 f.navigate({});f.navigate(f.host);assert.equal(modal.closed,true);assert.equal(modal.host.current(),false);assert.equal(f.refs.size,0);assert.equal(f.host.saveFeedbackPending,false);
});
test('legacy comparison opens the disk snapshot read-only and its copy surface has its own permanent navigation guard',async()=>{
 const f=fixture('thoughtspace');await f.host.compareSaveVersions();const modal=f.modals[0],input=await modal.host.read();await modal.host.open(input.original);
 assert.equal(f.opened.length,0);assert.equal(f.copies.length,1);const copy=f.copies[0];assert.equal(copy.host.source,'disk snapshot');assert.match(copy.host.title,/磁盘当前版/);assert.equal(copy.host.current(),true);assert.equal(f.refs.size,2);
 f.navigate({});f.navigate(f.host);assert.equal(copy.closed,true);assert.equal(copy.host.current(),false);assert.equal(f.refs.size,0);assert.equal(f.host.saveFeedbackPending,false);
});
test('compare local copy continues only while the originating session and window still own the source',async()=>{
 const f=fixture();await f.host.compareSaveVersions();const modal=f.modals[0];modal.close();modal.host.copyLocal();assert.deepEqual(f.actions,['copy-local-draft']);f.doc.defaultView.closed=true;modal.host.copyLocal();assert.equal(f.actions.length,1);
});

test('native version opening failure remains visible after closing comparison without unlocking or overwriting its source',async()=>{
 const f=fixture();f.host.plugin.openBoardNativeMarkdown=async()=>{throw Error('Synthetic native leaf unavailable');};
 await f.host.compareSaveVersions();const modal=f.modals[0],input=await modal.host.read();
 await assert.rejects(modal.host.open(input.original),/Synthetic native leaf unavailable/);
 assert.equal(modal.closed,true);assert.match(f.notices[0],/未能打开版本.*Synthetic native leaf unavailable/);
 assert.equal(f.owner.localDraftSource(),'local snapshot');assert.equal(f.owner.saveFeedback.state,'error');assert.equal(f.refs.size,0);
});

test('legacy comparison construction failure releases its pending action and navigation listeners',async()=>{
 const f=fixture('thoughtspace');f.setCopyFailure();await f.host.compareSaveVersions();const modal=f.modals[0],input=await modal.host.read();
 await assert.rejects(modal.host.open(input.original),/Synthetic modal construction failed/);
 assert.equal(f.refs.size,0);assert.equal(f.host.saveFeedbackPending,false);assert.equal(f.host.saveFeedbackCopyModal,undefined);assert.match(f.notices[0],/未能打开版本/);
 assert.equal(f.owner.localDraftSource(),'local snapshot');assert.equal(f.owner.saveFeedback.state,'error');
});
