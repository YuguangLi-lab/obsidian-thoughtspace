import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,clone,type Card,type Board} from '../src/model';
import {reusePlan,type ReuseBundle} from '../src/board-reuse';
import {planLayout,resolveLayoutScope,applyLayout,type LayoutOptions} from '../src/layout-planner';
const node=(id:string,x=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y:0,width:120,height:80,color:'sand',...extra});
const options:LayoutOptions={mode:'kind',columns:4,gap:40,sort:'position',anchor:'corner',createSections:true};
const ids=(b:Board)=>new Set(b.nodes.map(n=>n.id));

test('reuse preview counts existing shared notes with one target-path pass',t=>{
 let reads=0,serial=0;const target={...emptyBoard(),nodes:Array.from({length:1200},(_,i)=>{const n=node('t'+i,i*150,{kind:'card',file:'Notes/'+i+'.md'});return new Proxy(n,{get(o,k,r){if(k==='file')reads++;return Reflect.get(o,k,r);}});})};
 const bundle:ReuseBundle={nodes:Array.from({length:600},(_,i)=>node('s'+i,i*150,{kind:'card',file:'New/'+i+'.md'})),edges:[],externalEdges:0};
 const plan=reusePlan(bundle,target,{branches:false,placement:'right',frame:''},()=>`new-${serial++}`);assert.equal(plan.reusedNotes,0);assert.equal(plan.nodes.length,600);t.diagnostic(`target file reads ${reads}`);assert.equal(reads,1200);
});
test('reuse counting preserves repeated references, excludes non-notes and uses live target paths',()=>{
 const target={...emptyBoard(),nodes:[node('a',0,{kind:'card',file:'A.md'}),node('image',0,{kind:'image',file:'B.md'})]};const bundle:ReuseBundle={nodes:[node('s0',0,{kind:'card',file:'A.md'}),node('s1',0,{kind:'card',file:'A.md'}),node('s2',0,{kind:'card',file:'B.md'}),node('text')],edges:[],externalEdges:0};
 let serial=0;const plan=()=>reusePlan(bundle,target,{branches:false,placement:'below',frame:'Group'},()=>`new-${serial++}`);
 assert.equal(plan().reusedNotes,2);target.nodes[0].file='B.md';assert.equal(plan().reusedNotes,1);target.nodes[0].kind='text';assert.equal(plan().reusedNotes,0);
 const before=clone(target);bundle.nodes=bundle.nodes.filter(n=>n.kind==='text');assert.equal(plan().reusedNotes,0);assert.deepEqual(target,before);
});
test('small reuse selections retain early matching and text-only selections never inspect target paths',()=>{
 let reads=0,serial=0;const target={...emptyBoard(),nodes:Array.from({length:1200},(_,i)=>new Proxy(node('t'+i,0,{kind:'card',file:'Notes/'+i+'.md'}),{get(o,k,r){if(k==='file')reads++;return Reflect.get(o,k,r);}}))};
 const bundle:ReuseBundle={nodes:[node('source',0,{kind:'card',file:'Notes/0.md'})],edges:[],externalEdges:0},plan=()=>reusePlan(bundle,target,{branches:false,placement:'right',frame:''},()=>`new-${serial++}`);
 assert.equal(plan().reusedNotes,1);assert.equal(reads,1);bundle.nodes=[node('text')];assert.equal(plan().reusedNotes,0);assert.equal(reads,1);bundle.nodes=Array.from({length:600},(_,i)=>node('repeat'+i,0,{kind:'card',file:'Notes/0.md'}));assert.equal(plan().reusedNotes,600);assert.equal(reads,2);
});
test('automatic grouping does not repeatedly scan all loose cards to find nonexistent frames',t=>{
 let reads=0;const board:Board={...emptyBoard(),version:3,nodes:Array.from({length:500},(_,i)=>new Proxy(node('n'+i,i*150),{get(o,k,r){if(k==='kind')reads++;return Reflect.get(o,k,r);}}))};
 const plan=planLayout(board,ids(board),options);t.diagnostic(`loose grouping kind reads ${reads}`);assert.equal(plan.ids.length,500);assert.ok(plan.newSections?.length);assert.ok(reads<10000,`Read kinds ${reads} times`);applyLayout(board,plan);assert.equal(board.nodes.filter(n=>n.kind==='section').length,1);
});
function grouped(){let reads=0;const nodes:Card[]=[];for(let g=0;g<64;g++){nodes.push(node('g'+g,g*2000,{kind:'section',title:'G'+g,width:800,height:600}));for(let i=0;i<16;i++)nodes.push(node('n'+g+'-'+i,g*2000+(i%4)*160,{y:Math.floor(i/4)*100}));}for(let i=0;i<64;i++)nodes.push(node('loose'+i,i*2000+1000));const board:Board={...emptyBoard(),version:3,nodes:nodes.map(n=>new Proxy(n,{get(o,k,r){if(['x','y','width','height'].includes(String(k)))reads++;return Reflect.get(o,k,r);}}))};return{board,reads:()=>reads};}
test('loose layout scope uses nearby group membership without changing original order',t=>{
 const f=grouped(),expected=Array.from({length:64},(_,i)=>'loose'+i);const scope=resolveLayoutScope(f.board,'loose',new Set());assert.deepEqual([...scope.ids],expected);t.diagnostic(`grouped scope geometry reads ${f.reads()}`);assert.ok(f.reads()<85000,`Read geometry ${f.reads()} times`);
 f.board.nodes.reverse();assert.deepEqual([...resolveLayoutScope(f.board,'visible',new Set(),{x:-10,y:-10,width:200000,height:1000}).ids],expected.reverse());
});
test('layout scope follows moved frames, strict viewport intersection and folded descendants',()=>{
 const f=grouped(),b=f.board;const first=b.nodes.find(n=>n.id==='loose0')!;first.x=20;assert.ok(!resolveLayoutScope(b,'loose',new Set()).ids.has(first.id));first.x=1000;first.branchFolded=true;b.edges=[{id:'branch',from:first.id,to:'loose1',kind:'branch',label:''}];assert.ok(!resolveLayoutScope(b,'loose',new Set()).ids.has('loose1'));
 assert.deepEqual([...resolveLayoutScope(b,'visible',new Set(),{x:1120,y:0,width:1,height:80}).ids],[]);assert.deepEqual([...resolveLayoutScope(b,'visible',new Set()).ids],[]);assert.equal(resolveLayoutScope(b,'selection',new Set(['g0'])).sectionId,'g0');
});
test('densely overlapping groups keep the direct first-containing-frame path',t=>{
 let reads=0;const nodes=[...Array.from({length:64},(_,i)=>node('g'+i,0,{kind:'section',title:'G',width:50000,height:1000})),...Array.from({length:500},(_,i)=>node('n'+i,i*40))];const board={...emptyBoard(),nodes:nodes.map(n=>new Proxy(n,{get(o,k,r){if(['x','y','width','height'].includes(String(k)))reads++;return Reflect.get(o,k,r);}}))};
 assert.equal(resolveLayoutScope(board,'loose',new Set()).ids.size,0);t.diagnostic(`dense scope geometry reads ${reads}`);assert.ok(reads<10000,`Read geometry ${reads} times`);
});
test('an outlier frame cannot force repeated scans of already assigned overlapping content',t=>{
 let reads=0;const nodes=[...Array.from({length:64},(_,i)=>node('g'+i,i===63?1e8:0,{kind:'section',title:'G',width:50000,height:1000})),...Array.from({length:1024},(_,i)=>node('n'+i,i*40)),...Array.from({length:64},(_,i)=>node('loose'+i,1e6+i*150))];const board={...emptyBoard(),nodes:nodes.map(n=>new Proxy(n,{get(o,k,r){if(['x','y','width','height'].includes(String(k)))reads++;return Reflect.get(o,k,r);}}))};
 assert.deepEqual([...resolveLayoutScope(board,'loose',new Set()).ids],Array.from({length:64},(_,i)=>'loose'+i));t.diagnostic(`outlier overlap geometry reads ${reads}`);assert.ok(reads<100000,`Read geometry ${reads} times`);
});
test('grouping rejection and stale-preview checks remain atomic',()=>{
 const board:Board={...emptyBoard(),version:3,nodes:[node('a'),node('b',200),node('frame',-20,{kind:'section',title:'Frame',y:-20,width:500,height:300})]};const before=clone(board);assert.throws(()=>planLayout(board,new Set(['a','b']),options),/散卡/);assert.deepEqual(board,before);
 board.nodes.pop();const plan=planLayout(board,ids(board),options);board.nodes[0].locked=true;const changed=clone(board);assert.throws(()=>applyLayout(board,plan),/变化/);assert.deepEqual(board,changed);
});
