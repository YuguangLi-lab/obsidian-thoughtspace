import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {layoutMindmap,previewMindmapSize,validateBranches} from '../src/mindmap';

const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:120,height:80,color:'green',...extra});
function groups(){
 const b:Board={...emptyBoard(),version:3,nodes:[node('parent',-2000,-1000)],edges:[{id:'entry',from:'parent',to:'group0',kind:'branch',label:''}]};
 for(let i=0;i<64;i++){b.nodes.push(node(`group${i}`,i*1200,0,{kind:'section',width:900,height:500}));for(let j=0;j<16;j++)b.nodes.push(node(`material${i}-${j}`,i*1200+30+(j%4)*180,40+Math.floor(j/4)*100));}
 return b;
}

test('mixed-branch validation resolves only groups reachable from branch targets',()=>{
 const b=groups(),before=clone(b);let unrelated=0;b.nodes=b.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(target.kind==='section'&&target.id!=='group0'&&(key==='width'||key==='height'))unrelated++;return Reflect.get(target,key,receiver);}}));
 assert.equal(validateBranches(b).get('group0'),'parent');assert.equal(unrelated,0,'unrelated group rectangles need no containment expansion');assert.deepEqual(b,before);
});

test('lazy mixed-branch validation rejects direct and indirect cycles outside the first target',()=>{
 for(const indirect of [false,true]){const b=groups();if(indirect){b.edges.push({id:'a',from:'material63-0',to:'material62-0',kind:'branch',label:''},{id:'b',from:'material62-0',to:'group63',kind:'branch',label:''});}else b.edges.push({id:'cycle',from:'material63-0',to:'group63',kind:'branch',label:''});const before=clone(b);assert.throws(()=>validateBranches(b),/分组父子关系与包含关系不能形成循环/);assert.deepEqual(b,before);}
});

test('lazy validation retains strict nested containment, coincident frames and unique-parent checks',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:[node('a',0,0,{kind:'section',width:900,height:500}),node('coincident',0,0,{kind:'section',width:900,height:500}),node('inner',10,10,{kind:'section',width:800,height:400}),node('material',40,40)],edges:[{id:'ca',from:'coincident',to:'a',kind:'branch',label:''}]};assert.doesNotThrow(()=>validateBranches(b));
 b.edges.push({id:'cycle',from:'material',to:'coincident',kind:'branch',label:''});assert.throws(()=>validateBranches(b),/包含关系/);b.edges.pop();
 b.edges.push({id:'duplicate',from:'material',to:'a',kind:'branch',label:''});assert.throws(()=>validateBranches(b),/一个父级/);b.edges.pop();b.edges.push({id:'missing',from:'a',to:'missing',kind:'branch',label:''});assert.throws(()=>validateBranches(b),/端点/);
});

function tree(count=1200):Board{const b:Board={...emptyBoard(),version:3};for(let i=0;i<count;i++){b.nodes.push(node(`n${i}`,i*2.125,i%13*.75));if(i)b.edges.push({id:`e${i}`,from:`n${Math.floor((i-1)/3)}`,to:`n${i}`,kind:'branch',label:''});}return b;}
function coordinateMapEntries(run:()=>unknown){const Original=globalThis.Map;let entries=0;class CountedMap<K,V>extends Original<K,V>{set(key:K,value:V){if(value&&typeof value==='object'&&Object.keys(value).length===2&&Object.hasOwn(value,'x')&&Object.hasOwn(value,'y'))entries++;return super.set(key,value);}}globalThis.Map=CountedMap;try{run();return entries;}finally{globalThis.Map=Original;}}

test('unfolded layout skips original-coordinate and hidden-shift maps',()=>{
 const b=tree();const entries=coordinateMapEntries(()=>layoutMindmap(b,'n0','up'));assert.equal(entries,0,'no hidden geometry needs displacement snapshots');assert.equal(b.mindmapLayout,'up');assert.ok(b.nodes.slice(1).every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
});

test('folded leaves do not allocate hidden-subtree displacement maps',()=>{
 const b=tree(4);b.nodes[1].branchFolded=true;const entries=coordinateMapEntries(()=>layoutMindmap(b,'n0','bilateral'));assert.equal(entries,0,'a folded leaf has no hidden descendants');assert.equal(b.nodes[1].branchFolded,true);
});

test('live automatic preview skips hidden displacement snapshots and leaves source geometry intact',()=>{
 const b=tree();b.nodes[0].mindmapRules={layout:'right',density:'standard',automatic:true};const before=clone(b);let preview:Board|undefined;const entries=coordinateMapEntries(()=>{preview=previewMindmapSize(b,'n1',260,400);});assert.equal(entries,0);assert.deepEqual(b,before);assert.equal(preview?.nodes[1].width,260);assert.equal(preview?.nodes[1].height,400);
});

test('folded descendants retain exact ancestor displacement in every layout and density',()=>{
 for(const direction of ['left','right','up','down','bilateral'] as const)for(const density of ['compact','standard','relaxed'] as const){const b=tree(40);b.nodes[0].mindmapRules={layout:direction,density,automatic:true};b.nodes[1].branchFolded=true;b.nodes[4].branchFolded=true;const before=clone(b);layoutMindmap(b,'n0',direction);const ancestor=b.nodes[1],old=before.nodes[1];for(const id of ['n4','n5','n6','n13','n14','n15']){const n=b.nodes.find(n=>n.id===id)!,p=before.nodes.find(n=>n.id===id)!;assert.equal(n.x,p.x+(ancestor.x-old.x));assert.equal(n.y,p.y+(ancestor.y-old.y));}assert.equal(b.nodes[4].branchFolded,true);}
});

test('layout still rejects hidden locked objects and grouped topics before moving geometry',()=>{
 for(const kind of ['locked','group'] as const){const b=tree(12);b.nodes[1].branchFolded=true;if(kind==='locked')b.nodes[4].locked=true;else b.nodes[4].kind='section';const before=clone(b);assert.throws(()=>layoutMindmap(b,'n0','up'),kind==='locked'?/锁定/:/分组/);assert.deepEqual(b,before);}
});
