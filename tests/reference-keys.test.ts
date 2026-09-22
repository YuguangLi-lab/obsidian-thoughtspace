import test from 'node:test';import assert from 'node:assert/strict';import {canEnterReference} from '../src/reference-keys';
test('right arrow preserves editing in middle of query',()=>{assert.equal(canEnterReference('alpha',2,2),false);assert.equal(canEnterReference('alpha',1,3),false);});
test('right arrow can enter note from query end or whole selected phrase',()=>{assert.equal(canEnterReference('alpha',5,5),true);assert.equal(canEnterReference('alpha',0,5),true);});
test('unknown selection positions do not steal right arrow',()=>assert.equal(canEnterReference('alpha',null,null),false));
