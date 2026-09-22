import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseFilter, DatabaseRow, databaseCsv, dateValid, filterRows, isOverdue, propertyPatch, readProperties } from '../src/database';
const options:DatabaseFilter={query:'',tag:'',status:'',priority:'',overdue:false,sort:'updated',today:'2026-09-07'};
const rows:DatabaseRow[]=[
 {path:'Cards/A.md',title:'A',mtime:1,tags:['#研究/证据'],props:{status:'active',priority:'high',due:'2026-09-06'}},
 {path:'Cards/B.md',title:'B',mtime:3,tags:['#研究'],props:{status:'done',priority:'medium',due:'2026-09-05'}},
 {path:'Cards/C.md',title:'C',mtime:2,tags:[],props:{status:'inbox',priority:'',due:''}},
];
test('Missing properties default in memory without mutating source',()=>{const fm={tags:['research'],status:'legacy'};assert.deepEqual(readProperties(fm),{status:'inbox',priority:'',due:''});assert.deepEqual(fm,{tags:['research'],status:'legacy'});});
test('Existing custom values remain visible',()=>assert.deepEqual(readProperties({thoughtspace_status:'Review',thoughtspace_priority:5,thoughtspace_due:'invalid'}),{status:'Review',priority:'5',due:'invalid'}));
test('Date validation handles leap years and rejects overflow and malformed values',()=>{assert.equal(dateValid('2024-02-29'),true);for(const s of ['2025-02-29','2026-02-30','2026-13-01','2026-9-01','2026-09-07T00:00:00Z'])assert.equal(dateValid(s),false);});
test('Property edits validate allowed values and clear only requested field',()=>{assert.equal(propertyPatch('due',''),undefined);assert.equal(propertyPatch('priority',''),undefined);assert.equal(propertyPatch('status','done'),'done');assert.throws(()=>propertyPatch('status','arbitrary'));assert.throws(()=>propertyPatch('due','2026-02-30'));});
test('Completed notes and today due dates are not overdue',()=>{assert.equal(isOverdue(rows[0].props,options.today),true);assert.equal(isOverdue(rows[1].props,options.today),false);assert.equal(isOverdue({...rows[0].props,due:options.today},options.today),false);});
test('Filters combine query tag status priority and overdue',()=>assert.deepEqual(filterRows(rows,{...options,query:'CARDS',tag:'#研究/证据',status:'active',priority:'high',overdue:true}).map(r=>r.title),['A']));
test('Tag filter matches exact nested tag',()=>assert.deepEqual(filterRows(rows,{...options,tag:'#研究'}).map(r=>r.title),['B']));
test('Date sorting puts missing dates last and does not mutate source',()=>{assert.deepEqual(filterRows(rows,{...options,sort:'due'}).map(r=>r.title),['B','A','C']);assert.equal(rows[0].title,'A');});
test('Priority and update sorts order meaningful records first',()=>{assert.deepEqual(filterRows(rows,{...options,sort:'priority'}).map(r=>r.title),['A','B','C']);assert.deepEqual(filterRows(rows,options).map(r=>r.title),['B','C','A']);});

test('CSV exports all rows with quoted Unicode cells and formula protection',()=>{
 const csv=databaseCsv([{...rows[0],title:'=SUM(1,2)\n"注释"'},...rows]);
 assert.ok(csv.startsWith('\uFEFF"笔记"'));assert.ok(csv.includes(`"'=SUM(1,2)\n""注释"""`));
 assert.ok(csv.includes('"进行中","高优先级"'));assert.ok(csv.includes('Cards/C.md'));
});
