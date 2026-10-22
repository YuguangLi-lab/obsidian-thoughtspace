import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionTaskSummary,isCollectionTaskFilter,matchesCollectionTasks,type CollectionTaskFilter} from '../src/collection-tasks';

test('missing native task index remains unknown while an indexed empty note has zero tasks',()=>{
 assert.equal(collectionTaskSummary(undefined),undefined);assert.equal(collectionTaskSummary(null),undefined);
 assert.deepEqual(collectionTaskSummary({}),{total:0,done:0});assert.deepEqual(collectionTaskSummary({listItems:[]}),{total:0,done:0});
});
test('native list items count unchecked, nested and custom markers without parsing body text',()=>{
 // Native metadata includes actual list/task items only. Markdown task-looking
 // text in a code fence or frontmatter is absent from this host-provided array.
 const items=[{task:' ',parent:-1},{task:'x',parent:0},{task:'X',parent:0},{task:'/',parent:-1},{task:'-',parent:-1},{parent:-1}];
 const cache={listItems:items},before=JSON.stringify(cache);
 assert.deepEqual(collectionTaskSummary(cache),{total:5,done:2});assert.equal(JSON.stringify(cache),before);
});
test('task filters distinguish none, unfinished and fully finished and preserve unknown only for all',()=>{
 const states=[undefined,{total:0,done:0},{total:3,done:0},{total:3,done:2},{total:3,done:3}];
 const expected:Record<CollectionTaskFilter,boolean[]>={all:[true,true,true,true,true],any:[false,false,true,true,true],todo:[false,false,true,true,false],done:[false,false,false,false,true],none:[false,true,false,false,false]};
 for(const [filter,wanted] of Object.entries(expected))assert.deepEqual(states.map(state=>matchesCollectionTasks(state,filter as CollectionTaskFilter)),wanted,filter);
});
test('invalid task values fail validation and malformed summaries never imply an indexed state',()=>{
 for(const value of [undefined,null,'','Todo','completed',1,{},['todo']])assert.equal(isCollectionTaskFilter(value),false);
 for(const value of ['all','any','todo','done','none'])assert.equal(isCollectionTaskFilter(value),true);
 for(const summary of [{total:-1,done:0},{total:1,done:2},{total:1,done:-1},{total:1.5,done:1},{total:Infinity,done:0},{total:1,done:NaN}])
  for(const filter of ['any','todo','done','none'] as const)assert.equal(matchesCollectionTasks(summary,filter),false);
});
