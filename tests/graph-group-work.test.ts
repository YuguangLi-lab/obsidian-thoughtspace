import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Card,clone} from '../src/model';
import {sectionCatalog,selectSections,sectionDirectory} from '../src/section-catalog';
import {planGroupMove,applyGroupMove} from '../src/group-organizer';
const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:100,height:80,color:'green',...extra});
function fixture(){const b=emptyBoard();b.version=3;for(let i=0;i<64;i++){b.nodes.push(node(`g${i}`,i*1000,0,{kind:'section',width:800,height:500,sectionFolded:true}));for(let j=0;j<16;j++)b.nodes.push(node(`n${i}-${j}`,i*1000+30+j%4*150,60+Math.floor(j/4)*90));}return b;}
function counted(nodes:Card[]){let geometry=0;return{nodes:nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='x'||key==='y'||key==='width'||key==='height')geometry++;return Reflect.get(target,key,receiver);}})),reads:()=>geometry};}

test('catalog queries only nearby material while retaining source order and input references',t=>{
 const b=fixture();b.nodes.reverse();const before=clone(b),count=counted(b.nodes);b.nodes=count.nodes;const entries=sectionCatalog(b),work=count.reads();t.diagnostic(`${work} geometry reads for 64 groups / 1088 nodes`);assert.ok(work<65000,'catalog still scans the whole board per group');
 assert.equal(entries.length,64);assert.deepEqual(entries[0].members.map(n=>n.id),Array.from({length:16},(_,i)=>`n63-${15-i}`));assert.equal(entries[0].members[0],b.nodes[0]);assert.equal(entries[0].texts,16);assert.deepEqual(b,before);
 assert.equal(selectSections(entries,'n63-15')[0].section.id,'g63');assert.ok(sectionDirectory(entries,id=>id).startsWith('- [未命名分组](g63)'));
});

test('catalog keeps exact-boundary, overlapping and coincident membership without including frames',()=>{
 const b=fixture();b.nodes.push(node('same',0,0,{kind:'section',width:800,height:500}),node('inner',30,60,{kind:'section',width:300,height:250}),node('boundary',0,0,{width:800,height:500}),node('partial',799,499),node('note',50,90,{kind:'card',file:'研究/材料.md'}),node('image',60,100,{kind:'image'}));
 const entries=sectionCatalog(b),same=entries.find(e=>e.section.id==='same')!,original=entries.find(e=>e.section.id==='g0')!;
 assert.deepEqual(same.members,original.members);assert.ok(same.members.some(n=>n.id==='boundary'));assert.ok(!same.members.some(n=>n.kind==='section'||n.id==='partial'));assert.equal(same.notes,1);assert.equal(same.images,1);assert.equal(selectSections(entries,'研究 材料').length,3);
});

test('moving into a group resolves folded-board visibility once instead of repeating its geometry scan',t=>{
 const b=fixture();b.nodes.push(node('moving',0,1000),node('target',70000,1000,{kind:'section',width:800,height:600}));const before=clone(b),count=counted(b.nodes);b.nodes=count.nodes;
 const plan=planGroupMove(b,new Set(['moving']),'target'),work=count.reads();t.diagnostic(`${work} geometry reads for a move on a 64-folded-group board`);assert.ok(work<73000,'movement resolves the same folded board more than once');assert.deepEqual(plan.ids,['moving']);assert.deepEqual(b,before);applyGroupMove(b,plan);assert.equal(b.nodes.at(-2)!.x,plan.items[0].x);
});

test('open groups retain folded branches and nested linked groups outside the source bounds',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[node('source',0,0,{kind:'section',width:600,height:500}),node('root',30,60,{branchFolded:true}),node('child',700,0),node('linked',900,0,{kind:'section',width:500,height:400}),node('material',940,70),node('target',3000,0,{kind:'section',width:500,height:400})];b.edges=[{id:'a',from:'root',to:'child',kind:'branch',label:''},{id:'b',from:'child',to:'linked',kind:'branch',label:''}];
 const plan=planGroupMove(b,new Set(['source']),'target');assert.deepEqual(plan.ids,['source','root','child','linked','material']);b.nodes[4].locked=true;const before=clone(b);assert.throws(()=>planGroupMove(b,new Set(['source']),'target'),/锁定/);assert.deepEqual(b,before);
});
