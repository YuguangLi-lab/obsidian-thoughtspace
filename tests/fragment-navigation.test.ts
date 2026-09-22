import test from 'node:test';import assert from 'node:assert/strict';import {fragmentSearchSelection,steppedIndex,NoteFragment} from '../src/note-fragments';
const parts:NoteFragment[]=[{subpath:'#A',title:'A',kind:'heading',preview:'apple'},{subpath:'#B',title:'B',kind:'block',preview:'banana'}];
test('search replaces a hidden selection with its visible match',()=>assert.deepEqual(fragmentSearchSelection(parts,'banana','#A'),{subpath:'#B',empty:false}));
test('matching selected fragment remains selected',()=>assert.equal(fragmentSearchSelection(parts,'apple','#A').subpath,'#A'));
test('empty search result prevents implicit whole-note insertion',()=>assert.deepEqual(fragmentSearchSelection(parts,'pear','#A'),{subpath:'',empty:true}));
test('clearing query preserves chosen location',()=>assert.deepEqual(fragmentSearchSelection(parts,'','#B'),{subpath:'#B',empty:false}));
test('keyboard index wraps and tolerates empty results',()=>{assert.equal(steppedIndex(0,2,-1),1);assert.equal(steppedIndex(1,2,1),0);assert.equal(steppedIndex(0,0,1),-1);});
