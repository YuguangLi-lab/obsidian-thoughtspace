import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {applyLayout,planLayout,type LayoutOptions,type LayoutPlan} from '../src/layout-planner';

const card=(id:string,x:number,y:number,extra:Partial<Card>={}):Card=>({id,kind:'text',text:'**Markdown**\n- [ ] preserve',x,y,width:120,height:80,color:'green',...extra});
const options:LayoutOptions={mode:'grid',columns:3,gap:40,sort:'position',anchor:'corner'};
function fixture(count=12){
 const board:Board={...emptyBoard(),version:3};
 for(let i=0;i<count;i++){
  board.nodes.push(card(`root${i}`,i*350,-2000,{branchFolded:true}),card(`child${i}`,i*350+150,-2000),card(`leaf${i}`,i*350+180,-1850));
  board.edges.push({id:`c${i}`,from:`root${i}`,to:`child${i}`,kind:'branch',label:''},{id:`l${i}`,from:`child${i}`,to:`leaf${i}`,kind:'branch',label:''});
  board.nodes.push(card(`frame${i}`,i*1200,0,{kind:'section',title:'Folded frame',width:1100,height:500,sectionFolded:true}),card(`inside${i}`,i*1200+40,100));
 }
 return board;
}
const ids=(board:Board)=>new Set(board.nodes.map(node=>node.id));

for(const phase of ['preview','apply'] as const)test(`layout ${phase} resolves branch movement once while preserving hidden descendants and frames`,()=>{
 const board=fixture(),before=clone(board),selected=ids(board),existing=phase==='apply'?planLayout(board,selected,options):undefined;let kindReads=0,operationReads=0;
 board.edges=board.edges.map(edge=>new Proxy(edge,{get(target,key,receiver){if(key==='kind')kindReads++;return Reflect.get(target,key,receiver);}}));
 if(existing){
  applyLayout(board,existing);operationReads=kindReads;
  for(const node of board.nodes){const old=before.nodes.find(n=>n.id===node.id)!;
   if(node.id.startsWith('frame')||node.id.startsWith('inside'))assert.deepEqual(node,old);
   else{const index=node.id.replace(/\D/g,''),root=board.nodes.find(n=>n.id===`root${index}`)!,oldRoot=before.nodes.find(n=>n.id===root.id)!;assert.equal(node.x-root.x,old.x-oldRoot.x);assert.equal(node.y-root.y,old.y-oldRoot.y);assert.equal(node.text,old.text);}
  }
 }else{const plan=planLayout(board,selected,options);operationReads=kindReads;assert.equal(plan.ids.length,12);assert.deepEqual(board,before);}
 assert.ok(operationReads<=board.edges.length,`${operationReads} branch reads for ${board.edges.length} edges repeat the movement traversal`);
});

test('signed previews recheck hidden geometry, locks, folds, new edges and folded-frame containment before any write',()=>{
 const mutations:((board:Board)=>void)[]=[
  board=>{board.nodes.find(n=>n.id==='child0')!.x++;},
  board=>{board.nodes.find(n=>n.id==='child0')!.locked=true;},
  board=>{board.nodes.find(n=>n.id==='root0')!.branchFolded=false;},
  board=>{board.nodes.push(card('new-child',-500,-2000));board.edges.push({id:'new-edge',from:'root0',to:'new-child',kind:'branch',label:''});},
  board=>{const frame=board.nodes.find(n=>n.id==='frame0')!;frame.x=-10;frame.y=-2010;frame.width=500;},
 ];
 for(const mutate of mutations){const board=fixture(),plan=planLayout(board,ids(board),options);mutate(board);const before=clone(board);assert.throws(()=>applyLayout(board,plan),/折叠分支或锁定状态已变化/);assert.deepEqual(board,before);}
});

test('unsigned legacy previews preserve cheap validation before traversing branches',()=>{
 const mutations:((plan:LayoutPlan)=>void)[]=[
  plan=>{plan.signature+='stale';},plan=>{plan.items[0].x=NaN;},plan=>{plan.ids.push('missing');},
  plan=>{const frame=card('frame',0,0,{kind:'section',title:'Frame'});plan.section={original:frame,next:{...frame,x:NaN},members:''};},
 ];
 for(const mutate of mutations){const board=fixture(),plan=planLayout(board,ids(board),options);delete plan.movement;mutate(plan);const before=clone(board.nodes);let reads=0;
  Object.defineProperty(board,'edges',{get(){reads++;throw Error('premature fold traversal');}});
  assert.throws(()=>applyLayout(board,plan),/对象已变化|布局预览无效|分组布局无效/);assert.equal(reads,0);assert.deepEqual(board.nodes,before);
 }
});

test('successive previews immediately observe newly unfolded and locked descendants',()=>{
 const board=fixture(),selected=ids(board),first=planLayout(board,selected,options);
 board.nodes.find(n=>n.id==='root0')!.branchFolded=false;const unfolded=planLayout(board,selected,options);assert.equal(unfolded.ids.length,first.ids.length+2);assert.ok(unfolded.ids.includes('child0'));
 board.nodes.find(n=>n.id==='root0')!.branchFolded=true;board.nodes.find(n=>n.id==='child0')!.locked=true;const pinned=planLayout(board,selected,options);assert.equal(pinned.ids.length,first.ids.length-1);assert.ok(!pinned.ids.includes('root0'));
});

test('application resolves current objects and never reuses movement units from another board or preview',()=>{
 const original=fixture(),plan=planLayout(original,ids(original),options),before=clone(original),replacement=clone(original);
 const detached=original.nodes;original.nodes=clone(original.nodes);applyLayout(original,plan);assert.notDeepEqual(original.nodes,before.nodes);assert.deepEqual(detached,before.nodes);
 replacement.nodes.find(n=>n.id==='child0')!.locked=true;const unchanged=clone(replacement);assert.throws(()=>applyLayout(replacement,plan),/折叠分支或锁定状态已变化/);assert.deepEqual(replacement,unchanged);
});
