import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dragTargets,activeDragTargets} from '../src/drag-targets';
import {Card} from '../src/model';
const node=(id:string,locked=false):Card=>({id,kind:'text',x:0,y:0,width:100,height:80,color:'green',locked});
test('drag resolves only selected objects and skips locked objects',()=>{const nodes=[node('a'),node('b',true),node('c')];assert.deepEqual([...activeDragTargets(nodes,dragTargets(nodes,new Set(['a','b'])))].map(n=>n.id),['a']);});
test('resize targets only its handle even with multi-selection',()=>{const nodes=[node('a'),node('b')];assert.deepEqual([...activeDragTargets(nodes,dragTargets(nodes,new Set(['a','b']),'b'))].map(n=>n.id),['b']);});
test('drag uses replacement objects and survives reorder or removal',()=>{const nodes=[node('a'),node('b')],targets=dragTargets(nodes,new Set(['a','b'])),replacement={...node('a'),x:50};assert.equal([...activeDragTargets([replacement,nodes[1]],targets)][0],replacement);assert.deepEqual([...activeDragTargets([nodes[1],replacement],targets)],[replacement,nodes[1]]);assert.deepEqual([...activeDragTargets([nodes[1]],targets)],[nodes[1]]);});
test('moving one of 1200 objects avoids scanning unrelated objects each frame',()=>{const nodes=Array.from({length:1200},(_,i)=>node(String(i))),targets=dragTargets(nodes,new Set(['1199']));let reads=0;const live=new Proxy(nodes,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});assert.equal([...activeDragTargets(live,targets)].length,1);assert.ok(reads<=2,`Read ${reads} nodes`);});

test('a shared reorder refreshes the validated drag index instead of scanning every later frame',t=>{
 const nodes=Array.from({length:1200},(_,i)=>node(String(i))),targets=dragTargets(nodes,new Set(['0'])),selected=nodes.shift()!;nodes.push(selected);let reads=0;
 const live=new Proxy(nodes,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});
 for(let frame=0;frame<120;frame++)assert.equal([...activeDragTargets(live,targets)][0],selected);
 t.diagnostic(`120 reordered drag frames / 1200 nodes: ${reads} live node reads`);assert.ok(reads<=1440,`Read ${reads} nodes after one reorder`);assert.equal(targets[0].index,1199);
});

test('rediscovered indexes continue to read current replacements, locking, deletion and reinsertion',()=>{
 const a=node('a'),b=node('b'),targets=dragTargets([a,b],new Set(['a']));assert.deepEqual([...activeDragTargets([b,a],targets)],[a]);assert.equal(targets[0].index,1);
 const replacement={...a,color:'rose' as const,text:'live shared text',x:75};assert.equal([...activeDragTargets([b,replacement],targets)][0],replacement);
 replacement.locked=true;assert.deepEqual([...activeDragTargets([b,replacement],targets)],[]);replacement.locked=false;
 assert.deepEqual([...activeDragTargets([b],targets)],[]);assert.equal(targets[0].index,-1);
 const restored={...replacement,x:100};assert.equal([...activeDragTargets([restored,b],targets)][0],restored);assert.equal(targets[0].index,0);
});

test('revalidated multi-selection targets match fresh live lookup through 1800 shared updates',()=>{
 for(let seed=0;seed<30;seed++){
  let nodes=Array.from({length:20},(_,i)=>node('n'+i));const ids=['n0','n3','n7','n19'],targets=dragTargets(nodes,new Set(ids));
  for(let frame=0;frame<60;frame++){
   const op=(seed+frame)%6;
   if(op===0)nodes.reverse();else if(op===1)nodes=nodes.map((n,i)=>i===frame%nodes.length?{...n,x:frame}:n);
   else if(op===2){const n=nodes[frame%nodes.length];if(n)n.locked=!n.locked;}else if(op===3)nodes=nodes.filter(n=>n.id!=='n3');
   else if(op===4&&!nodes.some(n=>n.id==='n3'))nodes.push(node('n3'));else if(op===5&&nodes.length)nodes.push(nodes.shift()!);
   const expected=ids.map(id=>nodes.find(n=>n.id===id)).filter((n):n is Card=>!!n&&!n.locked),actual=[...activeDragTargets(nodes,targets)];assert.equal(actual.length,expected.length);actual.forEach((n,i)=>assert.equal(n,expected[i]));
  }
 }
});
