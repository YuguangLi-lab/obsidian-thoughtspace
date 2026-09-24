import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board} from '../src/model';
import {studioDraft} from '../src/board-studio';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,`Missing actual method: ${start}`);return source.slice(a,b);}
const methods=take('  async openGroupOrganizer(','  openReadingDesk(')
 +take('  private requireOwner(','  private canCreateBlankText(')
 +take('  async onLoadFile(file: TFile)','  private point(');
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const entries=[['openGroupOrganizer','groupOrganizer'],['openSavedViews','savedViewsModal'],['openLayoutPlanner','layoutPlannerModal']] as const;
function fixture(){
 const calls={created:0,opened:0,closed:0,committed:0,restored:[] as string[]},modals:Modal[]=[];
 class Modal{constructor(_app:unknown,readonly host:{board:()=>Board;ids?:Set<string>;commit:(edit:(board:Board)=>void)=>void;restore?:(id:string)=>void}){calls.created++;modals.push(this);}open(){calls.opened++;}close(){calls.closed++;}}
 const hostWindow={cancelAnimationFrame(){},clearTimeout(){}};
 const deps={GroupOrganizerModal:Modal,SavedViewsModal:Modal,LayoutPlannerModal:Modal,studioDraft,BoardView:class{},window:hostWindow,act:(fn:()=>unknown)=>fn(),report:(error:unknown)=>{throw error;},fitTextNode(){}};
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}}return View;`,{loader:'ts'}).code)(...Object.values(deps));
 const commit=deferred<boolean>(),navigation=deferred<void>(),acquisition=deferred<ReturnType<typeof session>>(),view=new View();
 function session(){const value={board:{...emptyBoard(),version:3 as const},blocked:false,listeners:new Set(),flush:async()=>{},change:(edit:(board:Board)=>void)=>{calls.committed++;edit(value.board);}};return value;}
 const owner=session(),next=session();owner.board.nodes.push({id:'chosen',kind:'text',text:'Unchanged',x:100,y:100,width:160,height:100,color:'green'});
 Object.assign(view,{dialogEpoch:0,session:owner,closed:false,selected:new Set(['chosen']),outlineCollapsed:new Set(),renderFrame:0,sidebarRun:0,inline:{commit:()=>commit.promise},
  blankClicks:{cancel(){}},viewTrail:{clear(){}},svg:{isConnected:true},stage:{removeClass(){}},
  contentEl:{ownerDocument:{defaultView:hostWindow},querySelectorAll:()=>[]},app:{workspace:{getActiveViewOfType:()=>undefined}},
  plugin:{session:()=>acquisition.promise,ensureDock:async()=>{},refreshDock(){},release:async()=>{}},
  finishInlineForNavigation:()=>navigation.promise,finishMarquee(){},setSectionTool(){},syncSelectionTool(){},clearNodes(){},clearCanvasGesture(){},paint(){},restoreView:(id:string)=>calls.restored.push(id),
 });
 return{view,owner,next,calls,modals,commit,navigation,acquisition};
}
for(const [entry,field]of entries){
 test(`${entry}: opens once only after the editor commits successfully`,async()=>{const f=fixture(),before=JSON.stringify(f.owner.board);let oldClosed=0;f.view[field]={close:()=>oldClosed++};const opening=f.view[entry]();assert.equal(f.calls.created,0);assert.equal(oldClosed,0);f.commit.resolve(true);await opening;assert.equal(f.calls.created,1);assert.equal(f.calls.opened,1);assert.equal(oldClosed,1);assert.equal(f.view[field],f.modals[0]);assert.equal(f.modals[0].host.board(),f.owner.board);assert.equal(JSON.stringify(f.owner.board),before);if(entry==='openGroupOrganizer'||entry==='openLayoutPlanner'){assert.deepEqual([...f.modals[0].host.ids!],['chosen']);f.view.selected.clear();assert.deepEqual([...f.modals[0].host.ids!],['chosen']);}});
 test(`${entry}: a declined or failed editor save retains the existing dialog and never opens another`,async()=>{for(const failure of ['declined','rejected']){const f=fixture();let closed=0;const previous={close:()=>closed++};f.view[field]=previous;const opening=f.view[entry]();if(failure==='declined'){f.commit.resolve(false);await opening;}else{f.commit.reject(Error('save conflict'));await assert.rejects(opening,/save conflict/);}assert.equal(f.calls.created,0);assert.equal(f.calls.opened,0);assert.equal(closed,0);assert.equal(f.view[field],previous);}});
 for(const lifecycle of ['onClose','onUnloadFile','onLoadFile'] as const)test(`${entry}: ${lifecycle} invalidates a pending opening before navigation finishes`,async()=>{
  const f=fixture(),opening=f.view[entry](),transition=f.view[lifecycle]({path:'Next.thoughtspace'});
  // Both legacy owner guards still pass here. The lifecycle epoch must cancel
  // the dialog while file acquisition / editor navigation is still pending.
  assert.equal(f.view.closed,false);assert.equal(f.view.session,f.owner);
  f.commit.resolve(true);await opening;assert.equal(f.calls.created,0);assert.equal(f.calls.opened,0);assert.equal(f.view[field],undefined);
  if(lifecycle==='onLoadFile')f.acquisition.resolve(f.next);else f.navigation.resolve();await transition;assert.equal(f.calls.created,0);assert.equal(f.calls.opened,0);
 });
 for(const lifecycle of ['onClose','onUnloadFile','onLoadFile'] as const)test(`${entry}: ${lifecycle} immediately closes an already opened dialog`,async()=>{const f=fixture();f.commit.resolve(true);await f.view[entry]();assert.equal(f.calls.opened,1);const transition=f.view[lifecycle]({path:'Next.thoughtspace'});assert.equal(f.calls.closed,1);assert.equal(f.view[field],undefined);if(lifecycle==='onLoadFile')f.acquisition.resolve(f.next);else f.navigation.resolve();await transition;assert.equal(f.calls.closed,1);assert.equal(f.calls.opened,1);});
 test(`${entry}: callbacks cannot mutate the old board after a session change`,async()=>{const f=fixture();f.commit.resolve(true);await f.view[entry]();const modal=f.modals[0],before=JSON.stringify(f.owner.board);f.view.session=f.next;assert.throws(()=>modal.host.board(),/白板已切换/);assert.throws(()=>modal.host.commit(board=>{board.nodes=[];}),/白板已切换/);if(modal.host.restore)assert.throws(()=>modal.host.restore!('old-view'),/白板已切换/);assert.equal(f.calls.committed,0);assert.equal(f.calls.restored.length,0);assert.equal(JSON.stringify(f.owner.board),before);});
}
