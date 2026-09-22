import test from 'node:test';import assert from 'node:assert/strict';import {resultPage} from '../src/result-page';
test('result pages cover all items without overlap',()=>{const items=Array.from({length:125},(_,i)=>i);assert.deepEqual([0,1,2].flatMap(p=>resultPage(items,p,60).items),items);});
test('page request is clamped after search narrows results',()=>{const p=resultPage([1,2],10,30);assert.equal(p.page,0);assert.deepEqual(p.items,[1,2]);});
test('empty, negative and nonfinite pages are safe',()=>{assert.equal(resultPage([],2,30).pages,1);assert.deepEqual(resultPage([1],-2,30).items,[1]);assert.equal(resultPage([1],NaN,30).page,0);});
test('invalid window sizes reject and source items are not mutated',()=>{assert.throws(()=>resultPage([],0,0));const a=[1,2];resultPage(a,0,1).items.push(3);assert.deepEqual(a,[1,2]);});
