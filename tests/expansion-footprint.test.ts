import test from 'node:test';
import assert from 'node:assert/strict';
import {reflowExpandedContent} from '../src/expansion-layout';
import {branchState} from '../src/mindmap';
import {clone,emptyBoard,type Board,type Card} from '../src/model';

const node=(id:string,x:number,y:number,width=200,height=80,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width,height,color:'blue',...extra});
const at=(board:Board,id:string)=>board.nodes.find(n=>n.id===id)!;
function tree(automatic:boolean,y=0):Board {
 return {...emptyBoard(),version:3,nodes:[node('root',0,y,200,80,{mindmapRules:{layout:'right',density:'standard',automatic}}),node('child',600,y)],edges:[{id:'branch',from:'root',to:'child',kind:'branch',label:''}]};
}
function grow(board:Board,id:string,height:number){const before=clone(board);at(board,id).height=height;reflowExpandedContent(board,before);return before;}
function samePositions(board:Board,before:Board,ids:readonly string[]){for(const id of ids)assert.deepEqual([at(board,id).x,at(board,id).y],[at(before,id).x,at(before,id).y],`${id} must retain its position`);}

for(const automatic of [false,true]) {
 const name=automatic?'automatic':'manual';
 test(`${name} tree growth leaves a side card in the empty space between its members unchanged`,()=>{
  const board=tree(automatic);board.nodes.push(node('gap-card',300,100));
  const before=grow(board,'root',240);
  assert.deepEqual(at(board,'gap-card'),at(before,'gap-card'));
  samePositions(board,before,['root','child']);
 });
 test(`a growing card inside a ${name} tree's empty bounds does not displace the tree`,()=>{
  const board=tree(automatic,150);board.nodes.push(node('source',300,0));
  const before=grow(board,'source',300);
  samePositions(board,before,['source','root','child']);
 });
 test(`a real member collision still moves a complete ${name} tree by one translation`,()=>{
  const board=tree(automatic,150);board.nodes.push(node('source',0,0,800));
  const before=grow(board,'source',300),dy=at(board,'root').y-at(before,'root').y;
  assert.equal(dy,174);
  for(const id of ['root','child']){
   assert.equal(at(board,id).x,at(before,id).x);
   assert.equal(at(board,id).y-at(before,id).y,dy);
  }
  samePositions(board,before,['source']);
 });
}

test('hidden descendants create no collision footprint but still travel with their tree',()=>{
 const board=tree(false);at(board,'child').branchFolded=true;
 board.nodes.push(node('hidden',300,100,200,400),node('gap-card',300,100));
 board.edges.push({id:'hidden-branch',from:'child',to:'hidden',kind:'branch',label:''});
 const before=grow(board,'root',240);
 assert(branchState(board).hidden.has('hidden'));
 assert.deepEqual(at(board,'gap-card'),at(before,'gap-card'));
 board.nodes.push(node('source',0,-200));
 const beforeCollision=grow(board,'source',500),dy=at(board,'root').y-at(beforeCollision,'root').y;
 assert.equal(dy,324);
 for(const id of ['root','child','hidden'])assert.equal(at(board,id).y-at(beforeCollision,id).y,dy);
 assert.deepEqual(at(board,'gap-card'),at(beforeCollision,'gap-card'));
});

test('an empty section remains a rectangular obstacle rather than only a list of content footprints',()=>{
 const board:Board={...emptyBoard(),version:3,nodes:[node('source',350,0,100),node('frame',300,100,300,300,{kind:'section',title:'empty frame'})]};
 grow(board,'source',150);
 assert.equal(at(board,'frame').y,174);
 assert.equal(at(board,'source').y,0);
});

test('inherited group probes do not collide with empty space inside another tree bounds',()=>{
 const board=tree(false,150);at(board,'root').x=-200;at(board,'root').width=100;
 board.nodes.unshift(node('frame',0,0,400,400,{kind:'section',title:'roomy frame'}),node('source',300,60,80));
 const before=grow(board,'source',200);
 samePositions(board,before,['root','child','frame']);
 assert.equal(at(board,'frame').height,400);
});

test('an inherited group probe hitting a real tree member clears the complete frame',()=>{
 const board=tree(false,350);at(board,'root').x=300;
 board.nodes.unshift(node('frame',0,0,400,500,{kind:'section',title:'roomy frame'}),node('source',300,60,80));
 const before=grow(board,'source',320),dy=at(board,'root').y-at(before,'root').y;
 assert.equal(at(board,'root').y,524);
 assert.equal(at(board,'child').y-at(before,'child').y,dy);
 assert.equal(at(board,'frame').height,500);
});
