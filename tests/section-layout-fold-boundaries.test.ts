import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,History,parseBoard,type Board,type Card} from '../src/model';
import {applyLayout,planSectionLayout,type LayoutOptions} from '../src/layout-planner';
import {sectionContains} from '../src/sections';

const node=(id:string,x:number,y:number,patch:Partial<Card>={}):Card=>({id,kind:'text',title:id,text:id,x,y,width:120,height:80,color:'blue',...patch});
const options:LayoutOptions={mode:'row',columns:2,gap:40,sort:'position',anchor:'corner'};
function folded():Board{return {...emptyBoard(),version:3,nodes:[node('frame',0,0,{kind:'section',width:1000,height:900}),node('root',40,70,{branchFolded:true}),node('child',700,700),node('other',200,250)],edges:[{id:'edge',from:'root',to:'child',kind:'branch',label:''}]};}
function row():Board{return {...emptyBoard(),version:3,nodes:[node('frame',0,0,{kind:'section',width:800,height:200}),node('a',40,70),node('b',250,70),node('c',500,70)]};}

for(const location of ['inside','outside-before-root'] as const)test(`section layout bounds include every folded descendant (${location}) and preserve history`,()=>{
 const b=folded();if(location==='outside-before-root'){b.nodes[2].x=-500;b.nodes[2].y=-500;}
 const before=clone(b),history=new History(),plan=planSectionLayout(b,'frame',options);assert.deepEqual(b,before);history.push(b);applyLayout(b,plan);
 for(const n of b.nodes.slice(1))assert.ok(sectionContains(b.nodes[0],n),`frame must contain ${n.id}`);
 assert.deepEqual([b.nodes[2].x-b.nodes[1].x,b.nodes[2].y-b.nodes[1].y],[before.nodes[2].x-before.nodes[1].x,before.nodes[2].y-before.nodes[1].y]);
 assert.deepEqual(parseBoard(JSON.stringify(b)),b);assert.deepEqual(history.undo(b),before);
});
test('section layout retains a pinned folded root when only other contents can be arranged',()=>{
 const b=folded();b.nodes[1].x=800;b.nodes[2].x=1400;b.nodes[2].locked=true;b.nodes.push(node('third',400,250));const before=clone(b);
 const plan=planSectionLayout(b,'frame',{...options,mode:'column'});applyLayout(b,plan);
 assert.deepEqual(b.nodes.slice(1,3),before.nodes.slice(1,3));assert.ok(sectionContains(b.nodes[0],b.nodes[1]));
});
test('section layout refuses to capture unrelated locked stationary contents when expanding',()=>{
 const b=row();b.nodes.push(node('outside',50,280,{locked:true}));const before=clone(b);
 assert.throws(()=>planSectionLayout(b,'frame',{...options,mode:'column'}),/其他对象|空间/);assert.deepEqual(b,before);
});
test('section layout rechecks destination obstacles changed after preview before any write',()=>{
 const b=row();b.nodes.push(node('outside',2000,280,{locked:true}));const plan=planSectionLayout(b,'frame',{...options,mode:'column'});b.nodes[4].x=50;const before=clone(b);
 assert.throws(()=>applyLayout(b,plan),/其他对象|空间|变化/);assert.deepEqual(b,before);
});
test('section layout refuses expansion outside its enclosing frame',()=>{
 const b=row();b.nodes.push(node('outer',-20,-20,{kind:'section',width:850,height:260}));const before=clone(b);
 assert.throws(()=>planSectionLayout(b,'frame',{...options,mode:'column'}),/上级分组|超出/);assert.deepEqual(b,before);
});
