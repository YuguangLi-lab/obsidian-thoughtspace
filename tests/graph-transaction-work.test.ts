import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {branchDescendants,branchState,layoutMindmap,reflowAutomaticMindmaps,unfoldAncestors} from '../src/mindmap';
import {topicRows} from '../src/mindmap-editor';
import {unfoldRelationAncestors} from '../src/graph-navigation';

const node=(id:string,x=-1000,y=-1000,extra:Partial<Card>={}):Card=>({id,kind:'text',text:`${id} **original**`,x,y,width:120,height:80,color:'green',...extra});
function fixture(){
 const b:Board={...emptyBoard(),version:3,nodes:[node('root',-1000,-1000,{branchFolded:true}),node('child',-700,-1000,{branchFolded:true}),node('leaf',-400,-1000)],edges:[{id:'rc',from:'root',to:'child',kind:'branch',label:''},{id:'cl',from:'child',to:'leaf',kind:'branch',label:''}]};
 for(let i=0;i<32;i++)b.nodes.push(node(`frame${i}`,i*1000,0,{kind:'section',width:900,height:500,sectionFolded:true}),node(`material${i}`,i*1000+40,100));
 return b;
}
function geometryReads(b:Board){let count=0;b.nodes=b.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='x'||key==='y'||key==='width'||key==='height')count++;return Reflect.get(target,key,receiver);}}));return()=>count;}

test('outline rows retain folded descendants without scanning unrelated folded-frame geometry',()=>{
 const b=fixture(),before=clone(b),reads=geometryReads(b),rows=topicRows(b,'root');
 assert.equal(reads(),0,'outline topology must not calculate visibility');assert.deepEqual(rows.map(r=>[r.node.id,r.depth,r.parent]),[['root',0,undefined],['child',1,'root'],['leaf',2,'child']]);assert.deepEqual(b,before);
});

test('branch selection expands links without calculating unrelated folded-frame visibility',()=>{
 const b=fixture(),before=clone(b),reads=geometryReads(b),ids=branchDescendants(b,new Set(['root']));
 assert.equal(reads(),0,'branch selection only needs containment for actual child groups');assert.deepEqual([...ids],['child','leaf']);assert.deepEqual(b,before);
});

test('relation ancestor reveal opens parent links without touching folded frames',()=>{
 const b=fixture(),before=clone(b),reads=geometryReads(b);assert.equal(unfoldRelationAncestors(b,new Set(['leaf','child'])),2);
 assert.equal(reads(),0,'relation reveal does not use visibility');assert.ok(b.nodes.slice(0,2).every(n=>!n.branchFolded));assert.deepEqual(b.nodes.slice(3),before.nodes.slice(3));
});

test('ancestor reveal checks enclosing groups once without resolving all folded material first',()=>{
 const b=fixture(),before=clone(b),reads=geometryReads(b);unfoldAncestors(b,'leaf');const work=reads();
 assert.ok(work<=128,`${work} geometry reads exceeded one containment pass over 32 groups`);
 assert.ok(b.nodes.slice(0,2).every(n=>!n.branchFolded));assert.deepEqual(b.nodes.slice(3),before.nodes.slice(3));assert.deepEqual(b.edges,before.edges);
});

test('ancestor reveal retains nested frame and linked parent semantics with current geometry',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:[node('parent',-1000,0,{branchFolded:true}),node('outer',0,0,{kind:'section',width:900,height:700,sectionFolded:true,branchFolded:true}),node('inner',40,60,{kind:'section',width:500,height:400,sectionFolded:true}),node('target',80,100),node('sibling-frame',1400,0,{kind:'section',width:500,height:400,sectionFolded:true}),node('sibling-material',1450,100)],edges:[{id:'po',from:'parent',to:'outer',kind:'branch',label:''}]};
 const before=clone(b);unfoldAncestors(b,'target');assert.equal(branchState(b).hidden.has('target'),false);assert.equal(b.nodes[0].branchFolded,undefined);assert.equal(b.nodes[1].branchFolded,true,'revealing contained material does not unfold unrelated child links of that frame');assert.equal(b.nodes[1].sectionFolded,undefined);assert.equal(b.nodes[2].sectionFolded,undefined);assert.deepEqual(b.nodes.slice(4),before.nodes.slice(4));
 assert.deepEqual(b.nodes.map(n=>[n.x,n.y,n.width,n.height]),before.nodes.map(n=>[n.x,n.y,n.width,n.height]));
 b.nodes[1].sectionFolded=false;unfoldAncestors(b,'target');assert.equal(b.nodes[1].sectionFolded,false,'an explicit unfolded flag survives reveal');
 b.nodes[3]={...b.nodes[3],x:1450,y:100};unfoldAncestors(b,'target');assert.equal(b.nodes[4].sectionFolded,undefined,'a new action observes changed containment');
});

function automaticChain(count:number):Board{const b:Board={...emptyBoard(),version:3};for(let i=0;i<count;i++){b.nodes.push(node(`n${i}`,i*260,i%3*150,i?{}:{mindmapRules:{layout:'right',density:'standard',automatic:true}}));if(i)b.edges.push({id:`e${i}`,from:`n${i-1}`,to:`n${i}`,kind:'branch',label:''});}return b;}

test('automatic reflow change detection compares rules and sibling order without serializing the graph',()=>{
 const b=automaticChain(1500),before=clone(b);b.nodes[1].x+=.125;const expected=clone(b),stringify=JSON.stringify;let calls=0;
 JSON.stringify=((...args:Parameters<typeof JSON.stringify>)=>{calls++;return Reflect.apply(stringify,JSON,args);}) as typeof JSON.stringify;
 try{reflowAutomaticMindmaps(b,before);}finally{JSON.stringify=stringify;}
 assert.equal(calls,0,`${calls} serialization calls in position-only automatic reflow detection`);assert.deepEqual(b,expected);
});

test('automatic reflow preserves canonical sibling ordering and each effective rule change',()=>{
 for(const change of ['order','layout','density','automatic','remove','insert'] as const){
  const b=automaticChain(3);b.edges[1].from='n0';layoutMindmap(b,'n0');const before=clone(b);
  if(change==='order')b.edges.reverse();else if(change==='layout')b.nodes[0].mindmapRules!.layout='up';else if(change==='density')b.nodes[0].mindmapRules!.density='relaxed';else if(change==='automatic'){before.nodes[0].mindmapRules!.automatic=false;b.nodes[1].y+=123;}else if(change==='remove'){b.nodes.pop();b.edges.pop();}else{b.nodes.push(node('new',5,5));b.edges.push({id:'en',from:'n0',to:'new',kind:'branch',label:''});}
  const expected=clone(b);layoutMindmap(expected,'n0');reflowAutomaticMindmaps(b,before);assert.deepEqual(b,expected,change);
 }
});

test('automatic rule property order is not a layout edit and locked or mixed trees keep their positions',()=>{
 const b=automaticChain(3),before=clone(b);b.nodes[0].mindmapRules={automatic:true,density:'standard',layout:'right'};b.nodes[1].x+=.125;const expected=clone(b);reflowAutomaticMindmaps(b,before);assert.deepEqual(b,expected);
 for(const variant of ['locked','mixed'] as const){const c=automaticChain(3),old=clone(c);if(variant==='locked')c.nodes[2].locked=true;else{c.nodes[2].kind='section';c.nodes[2].width=900;c.nodes[2].height=500;}c.nodes[1].width+=100;const saved=clone(c);reflowAutomaticMindmaps(c,old);assert.deepEqual(c,saved);}
});
