import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone,emptyBoard,expandedSelection,History,movableSelection,parseBoard,uid,type Board,type Card} from '../src/model';
import {branchDescendants,branchState,foldedMoveUnits,layoutMindmap,moveFoldedUnit,previewMindmapSize,reflowAutomaticMindmaps,validateBranches,visibleBranchBoard} from '../src/mindmap';
import {childConnectionCandidates,discloseBranches,makeChildConnection,makeChildConnections} from '../src/branch-disclosure';
import {connectionSides} from '../src/connections';
import {duplicateConnection} from '../src/connection-flow';
import {sectionDisplayNode} from '../src/sections';
import {alignSelection,moveSelection} from '../src/board-tools';
import {inlineDisplayBoard} from '../src/inline-geometry';

// Exercise the real port -> ordinary connection -> one-click branch-fold path.
const source=readFileSync('src/main.ts','utf8');
function take(from:string,to:string){const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const methods=take('  private addPorts(','  private cancelConnection(')+take('  private createConnection(','  sectionNavigator(')+take('  foldBranches(','  async openMindmapStudio(');
const notices:string[]=[];
const deps={uid,connectionSides,duplicateConnection,sectionDisplayNode,branchState,discloseBranches,makeChildConnections,act:(fn:()=>unknown)=>fn(),Notice:class{constructor(message:string){notices.push(message);}}};
const View=new Function(...Object.keys(deps),transformSync(`return class View{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
function node(id:string,kind:Card['kind'],x:number,y=100):Card{return{id,kind,title:id,...(kind==='text'?{text:`${id} original text`}:{}),...(kind==='card'?{file:`notes/${id}.md`}:{}),x,y,width:120,height:80,color:'green'};}
function group(id:string,x:number):Card{return{...node(id,'section',x,0),width:360,height:320,color:'blue'};}
function fixture(kind:'text'|'card'='text'){
 const board:Board={...emptyBoard(),version:3,mode:'free',nodes:[group('group',0),node('material','card',30),node('ordinary',kind,600),node('unrelated','text',1000)]};
 const v=new View(),history=new History(),stats={renders:0,cancels:0};notices.length=0;
 const owner={board,blocked:false,change(fn:(b:Board)=>void){const before=clone(this.board);fn(this.board);parseBoard(JSON.stringify(this.board));history.push(before);}};
 Object.assign(v,{session:owner,mode:'select',selected:new Set(),positions:new Map(),contextOpen:true,plugin:{settings:{defaultEdgeStyle:'elbow',defaultEdgeDirection:'forward'}},stage:{toggleClass(){},focus(){}},requireOwner:()=>owner,setSectionTool(){},syncSelectionTool(){},updateSelection(){},scheduleRender(){},renderBoard(){stats.renders++;},cancelConnection(){stats.cancels++;v.mode='select';v.connectFrom=undefined;v.connectSide=undefined;}});
 const ports=new Map<string,any[]>();for(const n of board.nodes){const entries:any[]=[];v.addPorts({createEl(_tag:string,options:unknown){const port={...options as object};entries.push(port);return port;}},n.id);ports.set(n.id,entries);}
 const connect=(from:string,to:string)=>{const event={detail:0,stopPropagation(){}};ports.get(from)![1].onclick(event);ports.get(to)![3].onclick(event);assert.equal(board.edges.at(-1)?.from,from);assert.equal(board.edges.at(-1)?.to,to);return board.edges.at(-1)!;};
 return{v,board,history,stats,connect};
}
const hidden=(board:Board)=>[...branchState(board).hidden].sort();
const geometry=(board:Board)=>board.nodes.map(({branchFolded,...n})=>n);

for(const kind of ['text','card'] as const)test(`group port -> ${kind} port -> one-click fold creates a child branch without hiding the parent group's material`,()=>{
 const{v,board,history,connect}=fixture(kind),edge=connect('group','ordinary'),before=clone(board);
 assert.equal(edge.kind,undefined);
 assert.deepEqual(childConnectionCandidates(board,new Set(['group'])).get('group'),[edge.id]);
 v.selected=new Set(['group','ordinary']);v.foldBranches(new Set(['group']),true,'collapse',true);
 assert.equal(board.edges[0].kind,'branch');assert.equal(validateBranches(board).get('ordinary'),'group');assert.deepEqual(hidden(board),['ordinary']);
 assert.deepEqual(visibleBranchBoard(board).nodes.map(n=>n.id),['group','material','unrelated']);assert.deepEqual([...v.selected],['group']);assert.equal(v.selectedEdge,undefined);
 assert.deepEqual(geometry(board),before.nodes);assert.deepEqual(board.edges[0],{...before.edges[0],kind:'branch'});assert.deepEqual(parseBoard(JSON.stringify(board)),board);
 assert.deepEqual(history.undo(board),before,'conversion and folding are one undo action');
});

for(const kind of ['text','card'] as const)test(`${kind} port -> group port -> one-click fold preserves and reveals the entire child group`,()=>{
 const{v,board,history,connect}=fixture(kind),edge=connect('ordinary','group'),before=clone(board);
 v.selected=new Set(['ordinary','group','material']);v.foldBranches(new Set(['ordinary']),true,'collapse',true);
 assert.equal(board.edges[0].kind,'branch');assert.equal(validateBranches(board).get('group'),'ordinary');assert.deepEqual(hidden(board),['group','material']);assert.deepEqual([...v.selected],['ordinary']);
 assert.deepEqual(geometry(board),before.nodes);assert.deepEqual(board.edges[0],{...edge,kind:'branch'});assert.deepEqual(parseBoard(JSON.stringify(board)),board);
 assert.deepEqual(history.undo(board),before);
 v.foldBranches(new Set(['ordinary']),false,'level');assert.deepEqual(hidden(board),[]);assert.deepEqual(geometry(board),before.nodes);
});

test('mixed group -> text -> group chain reveals one branch frontier and retains every group member',()=>{
 const{v,board,connect}=fixture();board.nodes.push(group('child-group',1300),node('child-material','card',1330));
 connect('group','ordinary');v.createConnection('ordinary','child-group','right','left');const before=clone(board);
 makeChildConnection(board,board.edges[1].id);v.foldBranches(new Set(['group']),true,'collapse',true);
 assert.deepEqual(hidden(board),['child-group','child-material','ordinary']);
 v.foldBranches(new Set(['group']),false,'level');assert.deepEqual(hidden(board),['child-group','child-material']);
 v.foldBranches(new Set(['group']),false,'all');assert.deepEqual(hidden(board),[]);assert.deepEqual(geometry(board),before.nodes);assert.deepEqual(parseBoard(JSON.stringify(board)),board);
});

test('expanding a child group preserves its independent content-fold state',()=>{
 const{v,board,connect}=fixture();board.nodes[0].sectionFolded=true;connect('ordinary','group');
 v.foldBranches(new Set(['ordinary']),true,'collapse',true);assert.deepEqual(hidden(board),['group','material']);
 v.foldBranches(new Set(['ordinary']),false,'all');assert.deepEqual(hidden(board),['material']);assert.equal(board.nodes[0].sectionFolded,true);
});

test('explicit mixed edge conversion accepts both directions and roundtrips saved hierarchy',()=>{
 for(const [from,to] of [['group','ordinary'],['ordinary','group']]){const{board,connect}=fixture(),edge=connect(from,to);makeChildConnection(board,edge.id);assert.equal(validateBranches(board).get(to),from);assert.deepEqual(parseBoard(JSON.stringify(board)),board);}
});

test('a mixed branch cycle is rejected before any ordinary relation is converted',()=>{
 const{board,connect}=fixture();connect('group','ordinary');connect('ordinary','group');const before=clone(board);
 assert.throws(()=>makeChildConnections(board,new Set(['group','ordinary'])),/循环/);assert.deepEqual(board,before);
});

test('mixed child groups and ordinary children retain a single parent across atomic conversion',()=>{
 for(const child of ['group','ordinary']){const{board,connect}=fixture(),other=child==='group'?'ordinary':'group';connect(other,child);connect('unrelated',child);const before=clone(board);
  assert.throws(()=>makeChildConnections(board,new Set([other,'unrelated'])),/一个父级/);assert.deepEqual(board,before);
 }
});

test('a group cannot become a descendant of material inside itself',()=>{
 const{board,connect}=fixture();const edge=connect('material','group'),before=clone(board);
 assert.throws(()=>makeChildConnection(board,edge.id),/包含|循环/);assert.deepEqual(board,before);
});

test('containment cycles through external content nodes reject the complete batch',()=>{
 const{board,connect}=fixture();connect('material','ordinary');connect('ordinary','group');const before=clone(board);
 assert.throws(()=>makeChildConnections(board,new Set(['material','ordinary'])),/包含|循环/);assert.deepEqual(board,before);
});

test('a contained object can also be an explicit child without treating containment as a second parent',()=>{
 const{board,connect}=fixture(),edge=connect('group','material');makeChildConnection(board,edge.id);assert.equal(validateBranches(board).get('material'),'group');assert.deepEqual(parseBoard(JSON.stringify(board)),board);
});

test('mixed branch folding protects an active editor inside the child group before converting its edge',()=>{
 const{v,board,connect,history}=fixture();connect('ordinary','group');v.inlineTarget='material';v.selected=new Set(['ordinary','material']);const before=clone(board),undoCount=history.undoStack.length;
 v.foldBranches(new Set(['ordinary']),true,'collapse',true);
 assert.deepEqual(board,before);assert.deepEqual([...v.selected],['ordinary','material']);assert.equal(history.undoStack.length,undoCount);assert.deepEqual(notices,['请先完成子节点编辑，再折叠分支']);
});

function foldedMixedFixture(){const f=fixture();f.connect('ordinary','group');f.board.edges[0].kind='branch';f.board.nodes[2].branchFolded=true;return f;}
test('moving a folded ordinary parent carries its child frame and all material exactly once',()=>{
 const{board}=foldedMixedFixture(),before=clone(board);assert.deepEqual([...expandedSelection(board,new Set(['ordinary']))].sort(),['group','material','ordinary']);
 moveSelection(board,new Set(['ordinary','group','material']),35,-20);
 for(let i=0;i<3;i++)assert.deepEqual([board.nodes[i].x,board.nodes[i].y],[before.nodes[i].x+35,before.nodes[i].y-20]);assert.deepEqual(board.nodes[3],before.nodes[3]);
});
test('layout movement units carry a folded child group with its card contents',()=>{
 const{board}=foldedMixedFixture(),before=clone(board),units=foldedMoveUnits(board,new Set(['ordinary']));assert.equal(units.length,1);assert.deepEqual(units[0].members.map(n=>n.id).sort(),['group','material','ordinary']);
 moveFoldedUnit(units[0],635,80);for(let i=0;i<3;i++)assert.deepEqual([board.nodes[i].x,board.nodes[i].y],[before.nodes[i].x+35,before.nodes[i].y-20]);assert.deepEqual(board.nodes[3],before.nodes[3]);
});
test('locked material pins a folded ordinary parent in dragging, alignment and layout movement',()=>{
 const{board}=foldedMixedFixture();board.nodes[1].locked=true;const before=clone(board);
 assert.equal(movableSelection(board,new Set(['ordinary','group','material'])).size,0);assert.equal(foldedMoveUnits(board,new Set(['ordinary'])).length,0);
 moveSelection(board,new Set(['ordinary']),35,-20);assert.throws(()=>alignSelection(board,new Set(['ordinary','unrelated']),'right'),/至少选择两个/);assert.deepEqual(board,before);
});
test('explicit topic layout rejects a group anywhere in the tree before moving frames or cards',()=>{
 const{board}=foldedMixedFixture();delete board.nodes[2].branchFolded;const before=clone(board);
 assert.throws(()=>layoutMindmap(board,'ordinary'),/分组/);assert.deepEqual(board,before);
});
test('mixed automatic trees preserve frame material positions during draft size preview and committed reflow',()=>{
 const{board}=foldedMixedFixture();delete board.nodes[2].branchFolded;board.nodes[2].mindmapRules={automatic:true,layout:'right',density:'standard'};const before=clone(board);
 assert.equal(previewMindmapSize(board,'ordinary',220,180),undefined);
 const display=inlineDisplayBoard(board,{id:'ordinary',width:220,height:180});assert.deepEqual(display.nodes.map(n=>[n.x,n.y]),before.nodes.map(n=>[n.x,n.y]));assert.equal(display.nodes[2].width,220);assert.deepEqual(board,before);
 board.nodes[2].width=220;board.nodes[2].height=180;const resized=clone(board);reflowAutomaticMindmaps(board,before);assert.deepEqual(board,resized);
});

test('explicit descendants already encountered as group material still carry their own child branches',()=>{
 const{board}=foldedMixedFixture();board.nodes.push(node('external','text',1500),node('leaf','text',1800));
 board.edges.push({id:'group-external',from:'group',to:'external',kind:'branch',label:''},{id:'external-material',from:'external',to:'material',kind:'branch',label:''},{id:'material-leaf',from:'material',to:'leaf',kind:'branch',label:''});
 const expected=['external','group','leaf','material'];assert.doesNotThrow(()=>validateBranches(board));assert.deepEqual([...branchDescendants(board,new Set(['ordinary']))].sort(),expected);
 assert.deepEqual(foldedMoveUnits(board,new Set(['ordinary']))[0].members.map(n=>n.id).sort(),[...expected,'ordinary']);
});
