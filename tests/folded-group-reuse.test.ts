import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,parseBoard,type Board,type Card} from '../src/model';
import {reuseBundle,reusePlan} from '../src/board-reuse';
import {branchState} from '../src/mindmap';

const node=(id:string,x:number,y:number,patch:Partial<Card>={}):Card=>({id,kind:'text',title:id,text:id,x,y,width:120,height:80,color:'blue',...patch});
const fixture=():Board=>({...emptyBoard(),version:3,nodes:[node('outer',0,0,{kind:'section',width:700,height:600,sectionFolded:true}),node('inner',50,100,{kind:'section',width:400,height:300}),node('content',100,170,{kind:'card',file:'Notes/evidence.md'}),node('external',1000,100),node('unrelated',1600,100)],edges:[{id:'edge',from:'inner',to:'external',kind:'branch',label:''},{id:'ordinary',from:'content',to:'unrelated',label:'reference'}]});

for(const branches of [false,true])test(`reusing a folded group preserves hidden nested frames and their branches with include branches=${branches}`,()=>{
 const b=fixture(),before=clone(b),bundle=reuseBundle(b,new Set(['outer']),branches);
 assert.deepEqual(bundle.nodes.map(n=>n.id),['outer','inner','content','external']);assert.deepEqual(bundle.edges,[b.edges[0]]);assert.equal(bundle.externalEdges,1);assert.deepEqual(b,before);
 let id=0;const plan=reusePlan(bundle,emptyBoard(),{branches,placement:'right',frame:''},()=>`copy-${id++}`),target={...emptyBoard(),version:3 as const,nodes:plan.nodes,edges:plan.edges};
 assert.deepEqual(parseBoard(JSON.stringify(target)),target);assert.equal(target.nodes.find(n=>n.kind==='card')!.file,'Notes/evidence.md');
 const hidden=branchState(target).hidden;assert.deepEqual(target.nodes.filter(n=>hidden.has(n.id)).map(n=>n.title),['inner','content','external']);
});
test('open group reuse keeps existing flat containment and optional outward branch semantics',()=>{
 const b=fixture();delete b.nodes[0].sectionFolded;
 assert.deepEqual(reuseBundle(b,new Set(['outer']),false).nodes.map(n=>n.id),['outer','content']);
 b.nodes[2].branchFolded=true;b.edges.push({id:'folded-card',from:'content',to:'external',kind:'branch',label:''});
 assert.deepEqual(reuseBundle(b,new Set(['outer']),false).nodes.map(n=>n.id),['outer','content','external']);
});
