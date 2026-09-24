import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,clone,parseBoard,History,type Board,type Card} from '../src/model';
import {branchState,visibleBranchBoard,validateBranches} from '../src/mindmap';
import {discloseBranches,makeChildConnection,makeChildConnections} from '../src/branch-disclosure';

const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('  foldBranches('),end=source.indexOf('  async openMindmapStudio()',start);
assert.ok(start>=0&&end>start);
const notices:string[]=[];
const View=new Function('branchState','discloseBranches','makeChildConnections','Notice',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(branchState,discloseBranches,makeChildConnections,class{constructor(message:string){notices.push(message);}});
function node(id:string,kind:Card['kind']='text'):Card{return{id,kind,...(kind==='text'?{text:id}:{}),...(['board','card','pdf'].includes(kind)?{file:`${id}.${kind==='board'?'thoughtspace':kind==='card'?'md':'pdf'}`} :{}),title:id,x:0,y:0,width:200,height:120,color:'green'};}
function fixture(){
 notices.length=0;
 const board:Board={...emptyBoard(),version:3,nodes:[node('portal','board'),node('child'),node('grand','pdf'),node('last','card'),node('ordinary','card')],edges:[
  {id:'pc',from:'portal',to:'child',label:'',kind:'branch'},
  {id:'cg',from:'child',to:'grand',label:'',kind:'branch'},
  {id:'gl',from:'grand',to:'last',label:'',kind:'branch'},
  {id:'relation',from:'portal',to:'ordinary',label:'ordinary',direction:'forward'},
 ]};
 const v=new View(),history=new History();let renders=0,cancels=0;
 const owner={board,blocked:false,change(fn:(b:Board)=>void){const before=clone(this.board);fn(this.board);validateBranches(this.board);parseBoard(JSON.stringify(this.board));history.push(before);}};
 Object.assign(v,{session:owner,selected:new Set(['portal','child','ordinary']),selectedEdge:'cg',contextOpen:true,positions:new Map(),
  requireOwner:()=>owner,cancelConnection(){cancels++;},renderBoard(){renders++;}});
 return{v,board,owner,history,notices,stats:()=>({renders,cancels})};
}
const hidden=(b:Board)=>[...branchState(b).hidden].sort();

test('actual branch fold hides linked descendants of a subboard portal without hiding ordinary relations',async()=>{
 const{v,board}=fixture(),before=clone(board);await v.foldBranches(new Set(['portal']),true,'collapse');
 assert.deepEqual(hidden(board),['child','grand','last']);
 assert.deepEqual(visibleBranchBoard(board).nodes.map(n=>n.id),['portal','ordinary']);
 assert.deepEqual(visibleBranchBoard(board).edges.map(e=>e.id),['relation']);
 assert.deepEqual(board.edges,before.edges);assert.equal(board.nodes.length,before.nodes.length);
 assert.equal(board.nodes[0].collapsed,undefined,'portal preview folding and branch folding are separate');
});
test('actual fold removes hidden selections and a selected hidden edge while preserving visible selection',async()=>{
 const{v,board}=fixture();await v.foldBranches(new Set(['portal']),true,'collapse');
 assert.deepEqual([...v.selected],['portal','ordinary']);assert.equal(v.selectedEdge,undefined);assert.equal(v.contextOpen,false);
 assert.equal(board.nodes[0].branchFolded,true);
});
test('actual fold preserves a selected relation whose two endpoints remain visible',async()=>{
 const{v}=fixture();v.selectedEdge='relation';await v.foldBranches(new Set(['portal']),true,'collapse');assert.equal(v.selectedEdge,'relation');
});
test('actual consecutive one-level expansion reveals one frontier at a time',async()=>{
 const{v,board}=fixture();await v.foldBranches(new Set(['portal']),true,'collapse');
 for(const expected of [['grand','last'],['last'],[]]){await v.foldBranches(new Set(['portal']),false,'level');assert.deepEqual(hidden(board),expected);}
});
test('actual expand-all reveals every descendant and roundtrips saved state',async()=>{
 const{v,board}=fixture();await v.foldBranches(new Set(['portal','child']),true,'collapse');
 await v.foldBranches(new Set(['portal']),false,'all');assert.deepEqual(hidden(board),[]);assert.deepEqual(parseBoard(JSON.stringify(board)),board);
});
test('a plain arrow does not become a collapsible branch until explicitly converted',async()=>{
 const{v,board}=fixture();delete board.edges[0].kind;await v.foldBranches(new Set(['portal']),true,'collapse');assert.deepEqual(hidden(board),[]);
 makeChildConnection(board,'pc');await v.foldBranches(new Set(['portal']),true,'collapse');assert.deepEqual(hidden(board),['child','grand','last']);
});
test('branch parentage comes from endpoints, regardless of arrow decoration',()=>{
 for(const direction of ['forward','both','none'] as const){const{board}=fixture();board.edges[0].direction=direction;discloseBranches(board,new Set(['portal']),'collapse');assert.equal(branchState(board).parents.get('child'),'portal');assert.deepEqual(hidden(board),['child','grand','last']);}
});
test('leaf and ordinary-relation nodes cannot create phantom folded subtrees',async()=>{
 const{v,board,stats}=fixture();await v.foldBranches(new Set(['last','ordinary','missing']),true,'collapse');assert.deepEqual(hidden(board),[]);assert.deepEqual(stats(),{renders:0,cancels:0});
});
test('branch fold and unfold can be undone without deleting note paths or child hierarchy',async()=>{
 const{v,board,history}=fixture(),before=clone(board);await v.foldBranches(new Set(['portal']),true,'collapse');
 const undo=history.undo(board)!;assert.deepEqual(undo,before);const redo=history.redo(undo)!;assert.deepEqual(hidden(redo),['child','grand','last']);assert.deepEqual(redo.edges,before.edges);
});
test('conversion accepts a section parent without changing board material',()=>{
 const{board}=fixture();board.nodes.push(node('frame','section'));board.edges.push({id:'frame-child',from:'frame',to:'ordinary',label:''});const before=clone(board);makeChildConnection(board,'frame-child');assert.equal(validateBranches(board).get('ordinary'),'frame');assert.deepEqual(board.nodes,before.nodes);assert.deepEqual(parseBoard(JSON.stringify(board)),board);
});

for(const kind of ['inline text','title input','save conflict'] as const)test(`fold refuses to hide an active ${kind}, preserving its draft and current selection`,()=>{
 const f=fixture(),v=f.v,editor={dirty:true,saveError:kind==='save conflict'?'conflicting file':undefined,commit(){assert.fail('folding must not commit or discard a draft');}},input={value:'unsaved title'};
 if(kind==='title input')v.positions.set('last',{querySelector:(s:string)=>s==='.ts-card-title-input'?input:null});
 else Object.assign(v,{inlineId:'child',inlineTarget:'child',inline:editor});
 const before=clone(f.board),selected=[...v.selected],edge=v.selectedEdge;
 assert.equal(v.foldBranches(new Set(['portal']),true,'collapse'),undefined);
 assert.deepEqual(f.board,before);assert.deepEqual([...v.selected],selected);assert.equal(v.selectedEdge,edge);assert.equal(v.contextOpen,true);
 assert.deepEqual(f.stats(),{renders:0,cancels:0});assert.deepEqual(f.notices,['请先完成子节点编辑，再折叠分支']);
 if(kind==='title input')assert.equal(v.positions.get('last').querySelector('.ts-card-title-input'),input);else assert.equal(v.inline,editor);
});
test('editing a different branch does not block a synchronous fold',()=>{
 const{v,board,notices}=fixture();v.inlineId='ordinary';v.inlineTarget='ordinary';
 assert.equal(v.foldBranches(new Set(['portal']),true,'collapse'),undefined);assert.deepEqual(hidden(board),['child','grand','last']);assert.deepEqual(notices,[]);
});
test('editing a branch root does not block hiding its descendants',()=>{
 const{v,board,notices}=fixture();v.inlineId='child';v.inlineTarget='child';
 v.foldBranches(new Set(['child']),true,'collapse');assert.deepEqual(hidden(board),['grand','last']);assert.deepEqual(notices,[]);
});
test('an inline editor still being mounted is protected before inlineId is assigned',()=>{
 const{v,board,notices}=fixture();v.inlineTarget='child';const before=clone(board);
 v.foldBranches(new Set(['portal']),true,'collapse');assert.deepEqual(board,before);assert.equal(notices.length,1);
});
test('one-level expansion cannot leave a deeper editor hidden by its newly folded frontier',()=>{
 const{v,board,notices}=fixture();board.nodes[0].branchFolded=true;v.inlineId='last';v.inlineTarget='last';const before=clone(board);
 v.foldBranches(new Set(['portal']),false,'level');assert.deepEqual(board,before);assert.equal(notices.length,1);
});
test('expand-all is allowed when it reveals the active editor',()=>{
 const{v,board,notices}=fixture();board.nodes[0].branchFolded=true;v.inlineId='last';v.inlineTarget='last';
 v.foldBranches(new Set(['portal']),false,'all');assert.deepEqual(hidden(board),[]);assert.deepEqual(notices,[]);
});
test('legacy collapse entry point also refuses to hide an active editor',()=>{
 const{v,board,notices}=fixture();v.inlineId='child';const before=clone(board);
 v.foldBranches(new Set(['portal']),true);assert.deepEqual(board,before);assert.equal(notices.length,1);
});

test('one-click setup converts ordinary children and folds in one undo step without moving cards',()=>{
 const{v,board,history}=fixture();delete board.edges[0].kind;const before=clone(board);
 v.foldBranches(new Set(['portal']),true,'collapse',true);
 assert.deepEqual(hidden(board),['child','grand','last','ordinary']);
 assert.deepEqual(board.nodes.map(({branchFolded,...n})=>n),before.nodes);
 assert.deepEqual(board.edges.map(({kind,direction,...e})=>e),before.edges.map(({kind,direction,...e})=>e));
 const undo=history.undo(board)!;assert.deepEqual(undo,before);assert.equal(history.undo(undo),undefined);
 v.foldBranches(new Set(['portal']),false,'level');assert.deepEqual(hidden(board),['grand','last']);
});
test('setup does not change edges when an active child editor prevents folding',()=>{
 const{v,board,stats,notices}=fixture();delete board.edges[0].kind;v.inlineTarget='ordinary';const before=clone(board);
 v.foldBranches(new Set(['portal']),true,'collapse',true);
 assert.deepEqual(board,before);assert.deepEqual(stats(),{renders:0,cancels:0});assert.equal(notices.length,1);
});
test('setup rejects conflicting parentage atomically and preserves selected objects',()=>{
 const{v,board,stats}=fixture();board.edges.push({id:'conflict',from:'ordinary',to:'child',kind:'branch',label:''});delete board.edges[0].kind;const before=clone(board);
 assert.throws(()=>v.foldBranches(new Set(['portal']),true,'collapse',true));assert.deepEqual(board,before);assert.deepEqual(stats(),{renders:0,cancels:0});
});
test('setup ignores bidirectional and undirected relations',()=>{
 for(const direction of ['both','none'] as const){const{v,board}=fixture();board.edges[3].direction=direction;
 v.foldBranches(new Set(['portal']),true,'collapse',true);assert.deepEqual(hidden(board),['child','grand','last']);assert.equal(board.edges[3].kind,undefined);}
});
test('setup rejects a locked endpoint without partially converting other children',()=>{
 const{v,board}=fixture();board.nodes[4].locked=true;const before=clone(board);
 assert.throws(()=>v.foldBranches(new Set(['portal']),true,'collapse',true),/解锁/);assert.deepEqual(board,before);
});
test('setup rejects cycles without mutating live board',()=>{
 const{v,board}=fixture();board.edges.push({id:'back',from:'last',to:'portal',label:''});const before=clone(board);
 assert.throws(()=>v.foldBranches(new Set(['last']),true,'collapse',true));assert.deepEqual(board,before);
});

test('actual group fold hides linked group material in one undo transaction',()=>{
 const f=fixture(),{v,board,history}=f;
 board.nodes=[node('parent','section'),{...node('child','section'),x:600},{...node('material'),x:620,y:30,width:100,height:60}];
 board.edges=[{id:'groups',from:'parent',to:'child',label:'分组关系',direction:'forward'}];v.selected=new Set(['parent','child']);v.selectedEdge='groups';const before=clone(board);
 v.foldBranches(new Set(['parent']),true,'collapse',true);
 assert.deepEqual(hidden(board),['child','material']);assert.deepEqual([...v.selected],['parent']);assert.equal(v.selectedEdge,undefined);
 assert.deepEqual(board.nodes.map(({branchFolded,...n})=>n),before.nodes);assert.deepEqual(parseBoard(JSON.stringify(board)),board);
 assert.deepEqual(history.undo(board),before);
});
test('actual group folding refuses to hide an editor inside a linked child frame',()=>{
 const f=fixture(),{v,board}=f;
 board.nodes=[node('parent','section'),{...node('child','section'),x:600},{...node('material'),x:620,y:30,width:100,height:60}];
 board.edges=[{id:'groups',from:'parent',to:'child',label:'分组关系',direction:'forward'}];v.selected=new Set(['parent']);v.inlineTarget='material';const before=clone(board);
 v.foldBranches(new Set(['parent']),true,'collapse',true);
 assert.deepEqual(board,before);assert.deepEqual(f.stats(),{renders:0,cancels:0});assert.deepEqual(f.notices,['请先完成子节点编辑，再折叠分支']);
});
test('actual fold refuses a locked root and preserves selection, geometry and children',()=>{
 const {v,board,notices,stats}=fixture();board.nodes[0].locked=true;const before=clone(board),selected=[...v.selected];
 v.foldBranches(new Set(['portal']),true,'collapse');assert.deepEqual(board,before);assert.deepEqual([...v.selected],selected);assert.deepEqual(stats(),{renders:0,cancels:0});assert.deepEqual(notices,['请先解锁分支根节点，再修改折叠状态']);
});
