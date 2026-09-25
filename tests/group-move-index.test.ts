import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Card} from '../src/model';
import {planGroupMove} from '../src/group-organizer';

const frame=(id:string,x:number):Card=>({id,kind:'section',title:id,x,y:0,width:1000,height:500,color:'blue',sectionFolded:true});
function fixture(count=64){
 const board={...emptyBoard(),version:3 as const};
 for(let i=0;i<count;i++){
  board.nodes.push(frame(`g${i}`,i*1200));
  for(let j=0;j<4;j++)board.nodes.push({id:`n${i}-${j}`,kind:'text',text:'**Markdown**\n- [ ] preserve',x:i*1200+30+j*220,y:80,width:120,height:80,color:'green'});
 }
 board.nodes.push({...frame('target',count*1200+10000),sectionFolded:false});
 return board;
}
const plan=(board:ReturnType<typeof fixture>)=>planGroupMove(board,new Set(['g0']),'target');

test('group move checks many external folded units without repeatedly rebuilding whole-board geometry indexes',()=>{
 const board=fixture(),before=clone(board);let xReads=0;
 board.nodes=board.nodes.map(node=>new Proxy(node,{get(target,key,receiver){if(key==='x')xReads++;return Reflect.get(target,key,receiver);}}));
 const result=plan(board);
 assert.ok(xReads<board.nodes.length*160,`${xReads} x reads for ${board.nodes.length} nodes repeat whole-board indexing`);
 assert.deepEqual(result.ids,['g0','n0-0','n0-1','n0-2','n0-3']);assert.deepEqual(board,before);
});
test('successive group proposals immediately observe moved and newly added folded frames',()=>{
 const board=fixture(12);assert.doesNotThrow(()=>plan(board));
 const external=board.nodes.find(node=>node.id==='g1')!;external.x=-100;external.width=500;const before=clone(board);
 assert.throws(()=>plan(board),/其他折叠分支/);assert.deepEqual(board,before);
 external.x=1200;external.width=1000;assert.doesNotThrow(()=>plan(board));
 board.nodes.push({...frame('new-fold',-100),width:500});assert.throws(()=>plan(board),/其他折叠分支/);
});
test('successive group proposals rebuild branch membership after new edges and changed folds',()=>{
 const board=fixture(12);board.nodes.push({id:'external',kind:'text',text:'External root',x:-2000,y:0,width:120,height:80,color:'green',branchFolded:true});
 assert.doesNotThrow(()=>plan(board));board.edges.push({id:'new-branch',from:'external',to:'n0-0',kind:'branch',label:''});
 assert.throws(()=>plan(board),/其他折叠分支/);board.nodes.at(-1)!.branchFolded=false;assert.doesNotThrow(()=>plan(board));
 board.nodes.at(-1)!.branchFolded=true;assert.throws(()=>plan(board),/其他折叠分支/);
});
test('group proposals never share a membership index across boards with the same IDs',()=>{
 const first=fixture(12),second=clone(first),external=second.nodes.find(node=>node.id==='g1')!;external.x=-100;external.width=500;
 assert.doesNotThrow(()=>plan(first));assert.throws(()=>plan(second),/其他折叠分支/);assert.doesNotThrow(()=>plan(first));
});
