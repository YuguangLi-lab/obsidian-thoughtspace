import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board} from '../src/model';
import {planLayout,applyLayout,type LayoutOptions} from '../src/layout-planner';

const options:LayoutOptions={mode:'connections',columns:4,gap:32,sort:'position',anchor:'corner'};
function fixture(nodes=100,edges=1200):Board{
 const b=emptyBoard();b.version=3;
 for(let i=0;i<nodes;i++)b.nodes.push({id:`n${i}`,kind:'text',text:`Topic ${i}`,x:i*200,y:0,width:160,height:80,color:'green'});
 for(let i=0;i<edges;i++)b.edges.push({id:`e${i}`,from:`n${i%nodes}`,to:`n${(i+1)%nodes}`,label:'Relation'});return b;
}
const ids=(b:Board)=>new Set(b.nodes.map(n=>n.id));
function trackPairs(run:()=>void){const original=JSON.stringify;let calls=0;
 JSON.stringify=function(value:unknown,...rest:unknown[]){if(Array.isArray(value)&&value.length===2&&value.every(x=>typeof x==='string'&&/^n\d+$/.test(x)))calls++;return Reflect.apply(original,JSON,[value,...rest]);} as typeof original;
 try{run();}finally{JSON.stringify=original;}return calls;
}

test('connection layout serializes each internal edge once for clustering and its stale-plan signature',()=>{
 const b=fixture(),before=clone(b);let plan!:ReturnType<typeof planLayout>;
 const calls=trackPairs(()=>{plan=planLayout(b,ids(b),options);});assert.equal(calls,b.edges.length,'one canonical endpoint pass must serve both consumers');
 assert.equal(plan.lanes.length,1);assert.equal(plan.lanes[0].ids.length,b.nodes.length);assert.equal(JSON.parse(plan.connections!).length,b.nodes.length);assert.deepEqual(b,before);
});
test('invalid layout options and too-small selections reject before endpoint serialization',()=>{
 const b=fixture();assert.equal(trackPairs(()=>assert.throws(()=>planLayout(b,ids(b),{...options,columns:0}),/1–12/)),0);
 assert.equal(trackPairs(()=>assert.throws(()=>planLayout(b,new Set(['n0']),options),/2–1000/)),0);
 assert.equal(trackPairs(()=>planLayout(b,ids(b),{...options,mode:'color'})),0,'other layouts need no connection signature');
});
test('canonical connection signatures stay fresh after mutations while duplicates and reversals remain equivalent',()=>{
 const b=fixture(4,1),selected=ids(b),first=planLayout(b,selected,options);
 b.edges.push({id:'reverse',from:'n1',to:'n0',label:'duplicate',direction:'both'});assert.deepEqual(planLayout(b,selected,options),first);
 b.edges.push({id:'new',from:'n1',to:'n2',label:''});const before=clone(b);assert.throws(()=>applyLayout(b,first),/连线关系已变化/);assert.deepEqual(b,before);
 const next=planLayout(b,selected,options);assert.notEqual(next.connections,first.connections);assert.equal(next.lanes[0].ids.length,3);applyLayout(b,next);
 const other=fixture(4,0);assert.equal(planLayout(other,ids(other),options).connections,'[]');
});
test('folded descendants do not enter the movable endpoint signature or split generated groups',()=>{
 const b=fixture(4,0);b.nodes[0].branchFolded=true;b.edges=[{id:'branch',from:'n0',to:'n1',label:'',kind:'branch'},{id:'relation',from:'n0',to:'n2',label:''},{id:'hidden',from:'n1',to:'n3',label:''}];
 const plan=planLayout(b,ids(b),{...options,createSections:true});
 assert.deepEqual(JSON.parse(plan.connections!),['["n0","n2"]']);assert.deepEqual(plan.ids,['n0','n2','n3']);
 const group=plan.newSections!.find(g=>g.ids.includes('n0'))!;assert(group.ids.includes('n1'));assert(group.ids.includes('n2'));assert(!group.ids.includes('n3'));
});
