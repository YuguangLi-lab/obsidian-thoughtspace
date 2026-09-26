import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as sections from '../src/sections';
import * as flow from '../src/mindmap-flow';
import * as sizing from '../src/mindmap-sizing';

function commands(){
 let validations=0;
 const load=(name:string,deps:Record<string,unknown>,instrument=false)=>{const m={exports:{} as any};let text=readFileSync(`src/${name}.ts`,'utf8');if(instrument)text=text.replace('export function validateBranches(b:Board){','export function validateBranches(b:Board){ countValidation();');new Function('require','module','exports','countValidation',transformSync(text,{loader:'ts',format:'cjs'}).code)((id:string)=>deps[id],m,m.exports,()=>validations++);return m.exports;};
 const mindmap=load('mindmap',{'./sections':sections},true),deps={'./model':model,'./mindmap':mindmap,'./mindmap-sizing':sizing,'./mindmap-flow':flow};
 const editor=load('mindmap-editor',deps);return{branches:load('mindmap-branches',{...deps,'./mindmap-editor':editor}),auto:load('mindmap-auto',{...deps,'./mindmap-editor':editor}),validations:()=>validations};
}
const node=(id:string,extra:Partial<model.Card>={}):model.Card=>({id,kind:'text',text:id,x:0,y:0,width:100,height:80,color:'blue',...extra});
function tree(){const b=model.emptyBoard();b.version=3;b.nodes=Array.from({length:1200},(_,i)=>node('n'+i));b.edges=b.nodes.slice(1).map((n,i)=>({id:'e'+i,from:'n'+Math.floor(i/3),to:n.id,kind:'branch',label:''}));return b;}

test('branch-depth command shares one pre-layout forest validation across root and subtree rows',t=>{
 const f=commands(),b=tree(),before=model.clone(b),next=f.branches.arrangeBranchDepth(b,'n1','2');t.diagnostic(`${f.validations()} command/layout validations (final parse validation remains separate)`);assert.equal(f.validations(),2);assert.equal(next.root,'n0');assert.equal(next.selected,'n1');assert.deepEqual(b,before);
});

test('automatic tree setup shares root and row validation before sizing and final layout',t=>{
 const f=commands(),b=tree(),next=f.auto.configureAutomaticTree(b,'n1',true);t.diagnostic(`${f.validations()} command/layout validations`);assert.equal(f.validations(),2);assert.equal(next.board.nodes[0].mindmapRules.automatic,true);assert.equal(b.nodes[0].mindmapRules,undefined);
});

test('adding a relation shares validated tree identity without revalidating it to collect rows',t=>{
 const f=commands(),b=tree(),next=f.branches.saveTopicRelation(b,'n1',{target:'n2',label:'证据',direction:'both'},()=> 'relation');t.diagnostic(`${f.validations()} command validations`);assert.equal(f.validations(),1);assert.equal(next.board.edges.at(-1).id,'relation');assert.equal(b.edges.length,1199);
});

test('template sizing accepts a very tall existing text without spread-argument overflow',()=>{
 const n=node('many-lines',{text:'a\n'.repeat(150000)});assert.doesNotThrow(()=>sizing.sizeTemplateTopic(n));assert.equal(n.width,80);assert.equal(n.height,Math.ceil(150001*16*1.7+30));
 const b=model.emptyBoard();b.version=3;b.nodes=[node('many-lines',{text:n.text})];const next=commands().auto.configureAutomaticTree(b,n.id,true);assert.equal(next.board.nodes[0].height,n.height);assert.equal(b.nodes[0].width,100);
});

test('shared topic commands retain missing, locked and cyclic-tree refusals before source writes',()=>{
 const f=commands(),b=tree();b.nodes[2].locked=true;const before=model.clone(b);assert.throws(()=>f.branches.arrangeBranchDepth(b,'n1','all'),/锁定/);assert.throws(()=>f.auto.configureAutomaticTree(b,'n1',false),/锁定/);assert.throws(()=>f.branches.saveTopicRelation(b,'n1',{target:'n2',label:'',direction:'forward'}),/解锁/);assert.deepEqual(b,before);
 const missing=tree();assert.throws(()=>f.branches.arrangeBranchDepth(missing,'gone','all'),/不存在/);missing.edges.push({id:'cycle',from:'n1',to:'n0',kind:'branch',label:''});assert.throws(()=>f.auto.configureAutomaticTree(missing,'n1',false),/循环/);
});

test('automatic layout still validates fitted draft geometry after reusing the initial forest',()=>{
 const b=tree(),before=model.clone(b);assert.throws(()=>commands().auto.configureAutomaticTree(b,'n1',true,(n:model.Card)=>{if(n.id==='n0')n.width=Infinity;}),/节点数据不完整/);assert.deepEqual(b,before);
});
