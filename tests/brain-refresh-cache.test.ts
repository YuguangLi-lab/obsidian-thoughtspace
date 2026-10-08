import test from 'node:test';
import assert from 'node:assert/strict';
import {BrainRefreshCache} from '../src/brain-refresh-cache';
import {createBrainBoard} from '../src/brain-board';
import type {NativeLocalRelations} from '../src/local-relations-native';
const fixture=()=>{const board=createBrainBoard('a');board.nodes=['a','b','c'].map(id=>({id,kind:'card',file:`${id}.md`,title:id,x:0,y:0,width:300,height:180,color:'sand'}));board.edges=[{id:'ab',from:'a',to:'b',kind:'branch',label:'child'},{id:'ac',from:'a',to:'c',direction:'both',label:'association'}];return board;};
test('unchanged graph, owner and native revision reuse the resolved projection across camera wrappers',()=>{
 const cache=new BrainRefreshCache(),board=fixture(),key={};let reads=0;const native=()=>{reads++;return{relations:[],tagsByNode:new Map(),pendingPaths:[]} satisfies NativeLocalRelations;};
 const input={board,key,path:'Board',graphRevision:0,nativeRevision:0,native};const first=cache.resolve(input,'a');
 for(let i=0;i<50;i++)assert.equal(cache.resolve({...input,board:{...board,brainViewport:{x:i,y:0,zoom:1}}},'a'),first);
 assert.equal(reads,1);
});
test('graph edits, native references, center, owner and path changes each invalidate',()=>{
 const cache=new BrainRefreshCache(),board=fixture();let reads=0;const native=()=>{reads++;return{relations:[],tagsByNode:new Map(),pendingPaths:[]};};let input={board,key:{},path:'Board',graphRevision:0,nativeRevision:0,native};
 let previous=cache.resolve(input,'a');
 for(const mutate of [()=>input.graphRevision++,()=>input.nativeRevision++,()=>input.key={},()=>input.path='Renamed',()=>input.board={...board,nodes:[...board.nodes]},()=>input.board={...board,edges:[...board.edges]}]){mutate();const next=cache.resolve(input,'a');assert.notEqual(next,previous);previous=next;}
 assert.notEqual(cache.resolve(input,'b'),previous);assert.equal(reads,8);
});
test('native index readiness and a changed source do not leave stale relationship evidence',()=>{
 const cache=new BrainRefreshCache(),board=fixture();let native:NativeLocalRelations={relations:[],tagsByNode:new Map(),pendingPaths:['a.md']};const input={board,key:{},path:'Board',graphRevision:0,nativeRevision:0,native:()=>native};
 assert.equal(cache.resolve(input,'a').nativePending,true);
 native={relations:[{nodeId:'b',kind:'outgoing',evidence:[{id:'new',kind:'link',sourcePath:'a.md',targetPath:'b.md',subpath:'#Heading'}],evidenceTotal:1}],tagsByNode:new Map(),pendingPaths:[]};input.nativeRevision++;
 const next=cache.resolve(input,'a');assert.equal(next.nativePending,false);assert.equal(next.matches.groups.find(g=>g.kind==='outgoing')!.items[0].nativeEvidence[0].subpath,'#Heading');
 board.edges=[];input.graphRevision++;assert.equal(cache.resolve(input,'a').matches.groups.find(g=>g.kind==='children')!.items.length,0);
});
test('missing revision contracts recompute conservatively and clear releases active references',()=>{
 const cache=new BrainRefreshCache(),board=fixture();let reads=0;const input={board,path:'Board',native:()=>{reads++;return[];}};
 assert.notEqual(cache.resolve(input,'a'),cache.resolve(input,'a'));assert.equal(reads,2);
 const known={...input,graphRevision:0,nativeRevision:0};const first=cache.resolve(known,'a');cache.clear();assert.notEqual(cache.resolve(known,'a'),first);assert.equal(reads,4);
});
