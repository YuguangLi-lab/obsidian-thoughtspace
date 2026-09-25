import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,expandedSelection,movableSelection,type Board,type Card} from '../src/model';
import {discloseBranches} from '../src/branch-disclosure';
import {moveSelection} from '../src/board-tools';

const node=(id:string,x:number,y:number,extra:Partial<Card>={}):Card=>({id,kind:'text',text:'**Markdown**\n- [ ] preserve',x,y,width:120,height:80,color:'green',...extra});
function fixture(){
 const board:Board={...emptyBoard(),version:3,nodes:[node('root',-1000,-1000,{branchFolded:true}),node('child',-700,-1000),node('leaf',-400,-1000)],edges:[{id:'rc',from:'root',to:'child',kind:'branch',label:''},{id:'cl',from:'child',to:'leaf',kind:'branch',label:''}]};
 for(let i=0;i<32;i++)board.nodes.push(node(`frame${i}`,i*1000,0,{kind:'section',title:'Folded frame',width:900,height:500,sectionFolded:true}),node(`material${i}`,i*1000+40,100));
 return board;
}
function countGeometry(board:Board){let reads=0;board.nodes=board.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='x'||key==='y'||key==='width'||key==='height')reads++;return Reflect.get(target,key,receiver);}}));return()=>reads;}

for(const mode of ['collapse','level','all'] as const)test(`branch ${mode} does not resolve unrelated folded-frame geometry`,()=>{
 const board=fixture(),before=clone(board),reads=countGeometry(board);
 discloseBranches(board,new Set(['root']),mode);const operationReads=reads();
 assert.equal(operationReads,0,`${operationReads} geometry reads in a topology-only disclosure`);
 assert.equal(!!board.nodes[0].branchFolded,mode==='collapse');assert.equal(!!board.nodes[1].branchFolded,mode==='level');
 assert.deepEqual(board.edges,before.edges);assert.deepEqual(board.nodes.slice(3),before.nodes.slice(3));
 assert.deepEqual(board.nodes.map(n=>[n.x,n.y,n.width,n.height,n.text]),before.nodes.map(n=>[n.x,n.y,n.width,n.height,n.text]));
});

test('expanding a folded text selection does not resolve unrelated folded-frame visibility',()=>{
 const board=fixture(),before=clone(board),reads=countGeometry(board),ids=expandedSelection(board,new Set(['root'])),operationReads=reads();
 assert.equal(operationReads,0,`${operationReads} geometry reads in a topology-only selection`);
 assert.deepEqual([...ids],['root','child','leaf']);assert.deepEqual(board,before);
});

test('successive disclosure and selection expansion read current links and keep boards independent',()=>{
 const board=fixture();assert.deepEqual([...expandedSelection(board,new Set(['root']))],['root','child','leaf']);
 board.nodes.push(node('new-child',-200,-1000));board.edges.push({id:'new-edge',from:'leaf',to:'new-child',kind:'branch',label:''});
 assert.ok(expandedSelection(board,new Set(['root'])).has('new-child'));
 discloseBranches(board,new Set(['root']),'level');assert.equal(board.nodes[1].branchFolded,true);
 discloseBranches(board,new Set(['root']),'level');assert.equal(board.nodes[2].branchFolded,true);
 const other=clone(board);other.edges=other.edges.filter(e=>e.id!=='new-edge');other.nodes[0].branchFolded=true;
 assert.ok(!expandedSelection(other,new Set(['root'])).has('new-child'));board.nodes[0].branchFolded=true;assert.ok(expandedSelection(board,new Set(['root'])).has('new-child'));
});

test('linked folded groups still carry their material and locked hidden members pin movement',()=>{
 const board=fixture();board.edges.push({id:'linked-frame',from:'leaf',to:'frame0',kind:'branch',label:''});
 const expanded=expandedSelection(board,new Set(['root']));assert.deepEqual(new Set(expanded),new Set(['root','child','leaf','frame0','material0']));
 board.nodes.find(n=>n.id==='material0')!.locked=true;const before=clone(board);assert.equal(movableSelection(board,new Set(['root'])).size,0);moveSelection(board,new Set(['root']),20,30);assert.deepEqual(board,before);
 discloseBranches(board,new Set(['root']),'all');assert.equal(board.nodes.find(n=>n.id==='frame0')!.sectionFolded,true);assert.equal(board.nodes.find(n=>n.id==='material0')!.locked,true);
});

test('disclosure and selection retain iterative cycle guards for transient cyclic links',()=>{
 const board=fixture();board.edges.push({id:'cycle',from:'leaf',to:'root',kind:'branch',label:''});
 assert.deepEqual(new Set(expandedSelection(board,new Set(['root']))),new Set(['root','child','leaf']));
 discloseBranches(board,new Set(['root']),'all');assert.ok(board.nodes.slice(0,3).every(n=>!n.branchFolded));
 board.nodes[0].branchFolded=true;discloseBranches(board,new Set(['root']),'level');assert.equal(board.nodes[1].branchFolded,true);
});
