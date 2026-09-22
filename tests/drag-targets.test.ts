import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dragTargets,activeDragTargets} from '../src/drag-targets';
import {Card} from '../src/model';
const node=(id:string,locked=false):Card=>({id,kind:'text',x:0,y:0,width:100,height:80,color:'green',locked});
test('drag resolves only selected objects and skips locked objects',()=>{const nodes=[node('a'),node('b',true),node('c')];assert.deepEqual([...activeDragTargets(nodes,dragTargets(nodes,new Set(['a','b'])))].map(n=>n.id),['a']);});
test('resize targets only its handle even with multi-selection',()=>{const nodes=[node('a'),node('b')];assert.deepEqual([...activeDragTargets(nodes,dragTargets(nodes,new Set(['a','b']),'b'))].map(n=>n.id),['b']);});
test('drag uses replacement objects and survives reorder or removal',()=>{const nodes=[node('a'),node('b')],targets=dragTargets(nodes,new Set(['a','b'])),replacement={...node('a'),x:50};assert.equal([...activeDragTargets([replacement,nodes[1]],targets)][0],replacement);assert.deepEqual([...activeDragTargets([nodes[1],replacement],targets)],[replacement,nodes[1]]);assert.deepEqual([...activeDragTargets([nodes[1]],targets)],[nodes[1]]);});
test('moving one of 1200 objects avoids scanning unrelated objects each frame',()=>{const nodes=Array.from({length:1200},(_,i)=>node(String(i))),targets=dragTargets(nodes,new Set(['1199']));let reads=0;const live=new Proxy(nodes,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});assert.equal([...activeDragTargets(live,targets)].length,1);assert.ok(reads<=2,`Read ${reads} nodes`);});
