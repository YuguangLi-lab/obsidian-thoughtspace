import test from 'node:test';
import assert from 'node:assert/strict';
import {choiceKey,choiceValue,cleanChoiceField,defaultChoiceOptions} from '../src/choice-field';
import {buildLibraryRecords,filterLibraryCards,emptyLibraryQuery} from '../src/card-property-views';
import {firstSessionDismissed,firstSessionSteps} from '../src/first-session';

test('the select field is one property with a short option list',()=>{
 const field=cleanChoiceField({options:[' 证据 ','证据','主张','']});
 assert.deepEqual(field.options,['证据','主张']);
 assert.equal(choiceValue({[choiceKey]:'证据'},field),'证据');
 assert.equal(choiceValue({[choiceKey]:'其他'},field),'');
 assert.deepEqual(cleanChoiceField(null).options,[...defaultChoiceOptions]);
});

test('library filters use the property and can open a real card placement',()=>{
 const field=cleanChoiceField({});
 const records=buildLibraryRecords([
  {path:'Cards/A.md',title:'林荫',tags:[],properties:{[choiceKey]:'证据',thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:2}},
  {path:'Cards/B.md',title:'热岛',tags:[],properties:{[choiceKey]:'主张'}},
 ],[{path:'Boards/City.md',title:'城市降温',files:['Cards/A.md'],placements:[{id:'card-1',file:'Cards/A.md'}]}],field);
 assert.deepEqual(filterLibraryCards(records,{...emptyLibraryQuery(),choice:'证据'}).map(record=>record.path),['Cards/A.md']);
 const shade=records.find(record=>record.path==='Cards/A.md')!,other=records.find(record=>record.path==='Cards/B.md')!;
 assert.equal(shade.highlight?.page,2);
 assert.deepEqual(shade.placements,[{boardPath:'Boards/City.md',boardTitle:'城市降温',nodeId:'card-1'}]);
 assert.equal(other.placements.length,0);
});

test('the first session can be dismissed without removing its explanation',()=>{
 assert.equal(firstSessionDismissed(undefined),false);
 assert.equal(firstSessionDismissed(true),true);
 assert.ok(firstSessionSteps.some(step=>step.body.includes('列表')));
 assert.ok(firstSessionSteps.some(step=>step.body.includes('看板')));
});
