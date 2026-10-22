import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {syncCardPortTabStops} from '../src/card-control-context';

const main=readFileSync(process.env.BOARD_SEARCH_MAIN_SOURCE||'src/main.ts','utf8'),search=readFileSync(process.env.BOARD_SEARCH_MODAL_SOURCE||'src/board-search-view.ts','utf8');
function take(source:string,from:string,to:string){const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,from);return source.slice(a,b);}
const sync=new Function('root','syncCardPortTabStops',transformSync(take(main,'    const syncPorts=()=>{','    this.syncPortTabStops=syncPorts;')+'return syncPorts;',{loader:'ts'}).code);
function fixture(){
 const calls:string[]=[],doc:any={body:{name:'body'},focused:true,hasFocus(){return this.focused;}},board={nodes:[{id:'old'},{id:'next'}],edges:[],viewport:{x:0,y:0,zoom:.5}},file={path:'owned.md',basename:'owned'},owner={file,board,blocked:false};
 let view:any,afterClose:()=>void=()=>{};
 const stage:any={ownerDocument:doc,isConnected:true,focus(){calls.push('stage');doc.activeElement=stage;view.syncPortTabStops();}},oldPort:any={name:'oldPort'},nextPort:any={name:'nextPort'},header={name:'header'},foreign={name:'foreign'};
 const container={contains:(el:any)=>[stage,oldPort,nextPort,header].includes(el)};
 class Modal{
  modalEl={isConnected:false,querySelector:()=>null};closed=false;busy=false;mutationBusy=false;previous:any;host:any;
  constructor(_app:any,host:any){this.host=host;}
  open(){this.previous=doc.activeElement;this.modalEl.isConnected=true;doc.activeElement={name:'search-input'};view.syncPortTabStops();}
  // The copied Obsidian Modal.close restores launch focus before returning.
  close(){calls.push('close');this.closed=true;this.modalEl.isConnected=false;doc.activeElement=this.previous;view.syncPortTabStops();calls.push('restore-launch');afterClose();}
  updateBusy(){}
 }
 const Search=new Function('Modal',transformSync('return class Search extends Modal{'+take(search,' private async activate(',' private updateBusy(')+'}',{loader:'ts'}).code)(Modal);
 const View=new Function('BoardSearchModal','isBrainBoard','BoardView',transformSync('return class View{'+take(main,'  findOnBoard() {','  locateFile(')+'}',{loader:'ts'}).code)(Search,()=>false,class BoardView{});
 view=new View();const leaf={view};Object.assign(view,{session:owner,file,stage,containerEl:container,dialogEpoch:3,selected:new Set(['old']),mode:'select',leaf,app:{workspace:{activeLeaf:leaf,getActiveViewOfType(){return this.activeLeaf?.view;}}},positions:new Map(),
  requireOwner(expected:any){if(this.session!==expected||this.file!==expected.file)throw Error('owner changed');return expected;},
  revealNode(id:string){view.selected=new Set([id]);view.syncPortTabStops();stage.focus();}
 });
 for(const [id,focused]of [['old',oldPort],['next',nextPort]] as const){const ports=Array.from({length:4},(_,i)=>i===0?focused:{name:id+i});for(const p of ports)p.tabIndex=0;view.positions.set(id,{ports,querySelectorAll:()=>ports,contains:(el:any)=>ports.includes(el)});}
 view.syncPortTabStops=sync.call(view,{ownerDocument:doc},syncCardPortTabStops);doc.activeElement=oldPort;const modal=view.findOnBoard();
 const eligible=()=>[...view.positions].flatMap(([id,card]:any)=>card.ports.filter((p:any)=>p.tabIndex>=0).map(()=>id));
 return{view,owner,file,board,doc,stage,oldPort,nextPort,header,foreign,modal,calls,eligible,afterClose:(fn:()=>void)=>afterClose=fn};
}

test('successful search location focuses its stage after native launch restoration and exposes only new ports',async()=>{
 const f=fixture(),before=structuredClone(f.board);await f.modal.activate({id:'next',kind:'text'});
 assert.deepEqual(f.calls,['stage','close','restore-launch','stage']);assert.equal(f.doc.activeElement,f.stage);assert.deepEqual(f.eligible(),Array(4).fill('next'));assert.deepEqual([...f.view.selected],['next']);assert.deepEqual(f.board,before);
});
test('failed locate leaves the modal open and never runs the completion focus',async()=>{
 const f=fixture();f.modal.host.locate=async()=>{throw Error('save failed');};await assert.rejects(f.modal.activate({id:'next',kind:'text'}),/save failed/);assert.deepEqual(f.calls,[]);assert.equal(f.modal.closed,false);assert.equal(f.modal.busy,false);assert.equal(f.doc.activeElement.name,'search-input');
});
test('cancel while location awaits prevents a late completion focus',async()=>{
 const f=fixture();let release!:()=>void;f.modal.host.locate=()=>new Promise<void>(resolve=>release=resolve);const pending=f.modal.activate({id:'next',kind:'text'});f.modal.close();f.calls.length=0;release();await pending;assert.deepEqual(f.calls,[]);assert.equal(f.doc.activeElement,f.oldPort);
});
test('opening a note in the sidebar never takes focus back to the board',async()=>{
 const f=fixture();f.modal.host.open=async()=>{f.calls.push('side-open');};await f.modal.activate({id:'next',kind:'card'},true);assert.deepEqual(f.calls,['side-open','close','restore-launch']);assert.equal(f.doc.activeElement,f.oldPort);
});
for(const change of ['owner','file','rename','epoch','modal','stage','document','disconnect','view','leaf','blur','selection','closed','closing','blocked','foreign-focus'] as const)test(`successful close cannot steal focus after ${change}`,async()=>{
 const f=fixture();f.afterClose(()=>{
  if(change==='owner')f.view.session={...f.owner};else if(change==='file')f.view.file={...f.file};else if(change==='rename')f.file.path='renamed.md';else if(change==='epoch')f.view.dialogEpoch++;
  else if(change==='modal')f.view.searchModal={};else if(change==='stage')f.view.stage={};else if(change==='document')f.stage.ownerDocument={};else if(change==='disconnect')f.stage.isConnected=false;
  else if(change==='view')f.view.leaf.view={};else if(change==='leaf')f.view.app.workspace.activeLeaf={};else if(change==='blur')f.doc.focused=false;else if(change==='selection')f.view.selected=new Set(['old']);
  else if(change==='closed')f.view.closed=true;else if(change==='closing')f.view.closing=true;else if(change==='blocked')f.owner.blocked=true;else f.doc.activeElement=f.foreign;
 });
 await f.modal.activate({id:'next',kind:'text'});assert.deepEqual(f.calls,['stage','close','restore-launch']);assert.notEqual(f.doc.activeElement,f.stage);
});
for(const target of ['body','header'] as const)test(`successful return accepts the host's ${target} fallback in the same document and leaf`,async()=>{const f=fixture();f.afterClose(()=>{f.doc.activeElement=target==='body'?f.doc.body:f.header;});await f.modal.activate({id:'next',kind:'text'});assert.equal(f.doc.activeElement,f.stage);assert.deepEqual(f.eligible(),Array(4).fill('next'));});
test('existing actual-focus preservation policy is retained outside successful navigation',()=>{const f=fixture();f.view.selected=new Set(['next']);f.doc.activeElement=f.oldPort;f.view.syncPortTabStops();assert.deepEqual(f.eligible(),[...Array(4).fill('old'),...Array(4).fill('next')]);});
