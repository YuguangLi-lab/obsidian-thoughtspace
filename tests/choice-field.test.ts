import test from 'node:test';
import assert from 'node:assert/strict';
import {choiceKey,choiceValue,cleanChoiceField,defaultChoiceOptions} from '../src/choice-field';
import {buildLibraryRecords,filterLibraryCards,emptyLibraryQuery} from '../src/card-property-views';
import {readProperties} from '../src/database';
import {libraryIndexFiles} from '../src/card-library-model';
import {firstSessionDismissed,firstSessionSteps,persistFirstSessionDismissal} from '../src/first-session';

test('the select field is one property with a short option list',()=>{
 const field=cleanChoiceField({options:[' 证据 ','证据','主张','']});
 assert.deepEqual(field.options,['证据','主张']);
 assert.equal(choiceValue({[choiceKey]:'证据'},field),'证据');
 assert.equal(choiceValue({[choiceKey]:'其他'},field),'');
 const typed=cleanChoiceField({options:['1','true','主张']});
 assert.equal(choiceValue({[choiceKey]:1,thoughtspace_status:'active'},typed),'1');
 assert.equal(choiceValue({[choiceKey]:true},typed),'true');
 assert.equal(choiceValue({[choiceKey]:false},typed),'');
 assert.equal(choiceValue({[choiceKey]:1.5},cleanChoiceField({options:['1.5']})),'1.5');
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
 const both=filterLibraryCards(records,{...emptyLibraryQuery(),choice:'证据',status:'inbox'});
 assert.deepEqual(both.map(record=>record.path),['Cards/A.md']);
 assert.equal(readProperties(records.find(record=>record.path==='Cards/A.md')?{thoughtspace_status:'active',thoughtspace_choice:'不是选项'}:{}).status,'active');
 assert.equal(choiceValue({thoughtspace_status:'active',thoughtspace_priority:'high',thoughtspace_due:'2026-01-02',thoughtspace_choice:'不是选项'},field),'');
 const reversed=Array.from({length:201},(_,i)=>({path:`Boards/${String(200-i).padStart(3,'0')}.md`}));
 const indexed=libraryIndexFiles(reversed);
 assert.equal(indexed.limited,true);assert.equal(indexed.files.length,200);assert.equal(indexed.files[0].path,'Boards/000.md');assert.equal(indexed.files.at(-1)?.path,'Boards/199.md');
 assert.equal(indexed.files.some(file=>file.path==='Boards/200.md'),false);
 assert.deepEqual(indexed.omitted.map(file=>file.path),['Boards/200.md']);
 const active=buildLibraryRecords([
  {path:'Cards/C.md',title:'同时',tags:[],properties:{thoughtspace_status:'active',thoughtspace_priority:'high',thoughtspace_due:'2026-01-02',[choiceKey]:'证据'}},
  {path:'Cards/D.md',title:'无效',tags:[],properties:{thoughtspace_status:'active',thoughtspace_priority:'low',thoughtspace_due:'2026-02-02',[choiceKey]:'不是选项'}},
 ],[],field);
 assert.deepEqual(filterLibraryCards(active,{...emptyLibraryQuery(),status:'active',choice:'证据'}).map(record=>record.path),['Cards/C.md']);
 assert.equal(active.find(record=>record.path==='Cards/D.md')?.status,'active');
 assert.equal(active.find(record=>record.path==='Cards/D.md')?.priority,'low');
 assert.equal(active.find(record=>record.path==='Cards/D.md')?.due,'2026-02-02');
});

test('the first session can be dismissed without removing its explanation',async()=>{
 assert.equal(firstSessionDismissed(undefined),false);
 assert.equal(firstSessionDismissed(true),true);
 assert.ok(firstSessionSteps.some(step=>step.body.includes('列表')));
 assert.ok(firstSessionSteps.some(step=>step.body.includes('看板')));
 const state={dismissed:false};
 await persistFirstSessionDismissal(async()=>{},value=>{state.dismissed=value;});
 assert.equal(state.dismissed,true);
 state.dismissed=true;
 await assert.rejects(persistFirstSessionDismissal(async()=>{throw Error('disk');},value=>{state.dismissed=value;}),/下次仍会显示/);
 assert.equal(state.dismissed,false);
});
