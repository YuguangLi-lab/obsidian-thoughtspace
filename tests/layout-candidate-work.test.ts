import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Board,type Card} from '../src/model';
import {applyLayout,planLayout,resolveLayoutScope,type LayoutOptions} from '../src/layout-planner';
import {branchState} from '../src/mindmap';
import {readingTitle} from '../src/reading-desk';

const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:`# Topic ${id}\nbody\nnext`,x,y,width:140,height:80,color:'green',...extra});
const board=(nodes:Card[]):Board=>({...emptyBoard(),version:3,nodes});
const options:LayoutOptions={mode:'grid',columns:4,gap:32,sort:'title',anchor:'corner'};
function countTitleSplits(run:()=>void){const original=String.prototype.split;let calls=0;
 String.prototype.split=function(this:string,separator:unknown,limit?:number){if(separator==='\n'&&this.startsWith('# Topic '))calls++;return Reflect.apply(original,this,[separator,limit]) as string[];};
 try{run();}finally{String.prototype.split=original;}return calls;
}

test('title layout resolves each cloned title once while the source signature remains independent',()=>{
 const b=board(Array.from({length:100},(_,i)=>node(`n${i}`,i*180,0,{text:`# Topic ${String(i*37%100).padStart(3,'0')}\n`+'body\n'.repeat(100)}))),ids=new Set(b.nodes.map(n=>n.id)),saved=JSON.stringify(b);
 const expected=[...b.nodes].sort((a,b)=>readingTitle(a).localeCompare(readingTitle(b))||a.id.localeCompare(b.id)).map(n=>n.id);
 const reads=countTitleSplits(()=>assert.deepEqual(planLayout(b,ids,options).items.map(n=>n.id),expected));
 assert.equal(reads,200,'100 sorting titles plus 100 independently computed source signature titles');
 assert.equal(countTitleSplits(()=>planLayout(b,ids,{...options,sort:'position'})),100,'position sorting performs no extra title work');assert.equal(JSON.stringify(b),saved);
});

test('title reuse is by object and ends before a new proposal or stale application',()=>{
 const b=board([node('same',0,0,{text:'# Topic Z'}),node('same',500,0,{text:'# Topic A'}),node('other',1000,0,{text:'# Topic M'})]);
 assert.deepEqual(planLayout(b,new Set(['same','other']),options).items.map(n=>n.text),['# Topic A','# Topic M','# Topic Z'],'same-ID objects retain distinct titles');
 b.nodes[1].id='unique';const ids=new Set(b.nodes.map(n=>n.id)),old=planLayout(b,ids,options);b.nodes[0]={...b.nodes[0],text:'# Topic 0'};const changed=JSON.stringify(b);
 assert.throws(()=>applyLayout(b,old),/已变化/);assert.equal(JSON.stringify(b),changed);assert.equal(planLayout(b,ids,options).items[0].id,'same');
 b.nodes[0].title='ZZZ';assert.equal(planLayout(b,ids,options).items.at(-1)!.id,'same');
});

test('invalid options and too few movable nodes reject before title extraction',()=>{
 const b=board([node('a'),node('b',300)]),ids=new Set(['a','b']);
 assert.equal(countTitleSplits(()=>assert.throws(()=>planLayout(b,ids,{...options,columns:0}),/设置/)),0);
 assert.equal(countTitleSplits(()=>assert.throws(()=>planLayout(b,new Set(['a']),options),/请选择/)),0);
 b.nodes[1].locked=true;assert.equal(countTitleSplits(()=>assert.throws(()=>planLayout(b,ids,options),/请选择/)),0);
});

test('visible scope tests group membership only for viewport candidates',()=>{
 const b=board(Array.from({length:1000},(_,i)=>node(`n${i}`,i<20?i%5*180:20000+i*200,Math.floor(i/5)*120)));let frameReads=0;
 for(let i=0;i<200;i++){const frame=node(`f${i}`,1000000+i*400,0,{kind:'section',width:350,height:500});for(const key of ['x','y','width','height'] as const){const value=frame[key];Object.defineProperty(frame,key,{enumerable:true,get(){frameReads++;return value;}});}b.nodes.push(frame);}
 const scope=resolveLayoutScope(b,'visible',new Set(),{x:0,y:0,width:900,height:700});assert.deepEqual([...scope.ids],Array.from({length:20},(_,i)=>`n${i}`));
 assert.ok(frameReads<=4400,`offscreen group containment work must be absent; observed ${frameReads} reads`);
 frameReads=0;assert.equal(resolveLayoutScope(b,'visible',new Set()).ids.size,0);assert.equal(frameReads,0,'a missing viewport needs no frame geometry');
});

// The previous complete composition is an independent oracle for logical folds,
// inclusive frame membership and strict viewport intersection boundaries.
function oldVisible(b:Board,viewport?:{x:number;y:number;width:number;height:number}){
 const frames=b.nodes.filter(n=>n.kind==='section'),hidden=branchState(b).hidden;
 return b.nodes.filter(n=>!hidden.has(n.id)&&n.kind!=='section'&&!frames.some(f=>n.id!==f.id&&n.x>=f.x&&n.y>=f.y&&n.x+n.width<=f.x+f.width&&n.y+n.height<=f.y+f.height)).filter(n=>viewport&&n.x<viewport.x+viewport.width&&n.x+n.width>viewport.x&&n.y<viewport.y+viewport.height&&n.y+n.height>viewport.y).map(n=>n.id);
}

test('visible scope preserves folded groups, hidden external branches and viewport boundary semantics',()=>{
 const b=board([node('outer',0,0,{kind:'section',width:600,height:500,sectionFolded:true}),node('inner',40,70,{kind:'section',width:250,height:220}),node('material',80,110),node('linked',900,0,{kind:'section',width:300,height:200}),node('linked-material',930,60),node('folded',1400,0,{branchFolded:true}),node('child',1700,0),node('touch-right',2000,0),node('loose',650,0),node('collapsed',650,200,{collapsed:true})]);
 b.edges=[{id:'a',from:'inner',to:'linked',kind:'branch',label:''},{id:'b',from:'folded',to:'child',kind:'branch',label:''}];const saved=JSON.stringify(b);
 for(const viewport of [undefined,{x:600,y:0,width:1400,height:500},{x:650,y:0,width:0,height:0},{x:-Infinity,y:0,width:Infinity,height:500},{x:NaN,y:0,width:2000,height:500}])assert.deepEqual([...resolveLayoutScope(b,'visible',new Set(),viewport).ids],oldVisible(b,viewport));
 assert.equal(JSON.stringify(b),saved);
});

test('scope membership refreshes after movement, folds and same-ID object replacement',()=>{
 const b=board([node('a'),node('b',300),node('frame',2000,0,{kind:'section',width:900,height:500})]),viewport={x:-1,y:-1,width:1000,height:600};
 assert.deepEqual([...resolveLayoutScope(b,'visible',new Set(),viewport).ids],['a','b']);b.nodes[2].x=0;assert.deepEqual([...resolveLayoutScope(b,'visible',new Set(),viewport).ids],[]);
 b.nodes[2]={...b.nodes[2],x:2000};assert.deepEqual([...resolveLayoutScope(b,'visible',new Set(),viewport).ids],['a','b']);b.nodes[0].branchFolded=true;b.edges.push({id:'branch',from:'a',to:'b',kind:'branch',label:''});assert.deepEqual([...resolveLayoutScope(b,'visible',new Set(),viewport).ids],['a']);
 b.nodes[0].branchFolded=false;assert.deepEqual([...resolveLayoutScope(b,'loose',new Set()).ids],['a','b']);assert.equal(resolveLayoutScope(b,'selection',new Set(['frame'])).sectionId,'frame');
});
