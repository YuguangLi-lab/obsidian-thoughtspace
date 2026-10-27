import test from 'node:test';
import assert from 'node:assert/strict';
import {readCollectionReview,isReviewDue,reviewDayAfter,REVIEW_ON,REVIEW_VERSION} from '../src/collection-review';
import {collectionDuplicateValue,findCollectionDuplicates} from '../src/collection-duplicates';
import type {CollectionRecord} from '../src/collection-view';
const record=(id:string):CollectionRecord=>({id,path:id+'.md',title:id,createdAt:'2026-10-26T00:00:00.000Z',tags:[],inBoard:false});
test('review dates require an explicit recognized namespace version and do not adopt arbitrary properties',()=>{
 assert.deepEqual(readCollectionReview({due:'2026-10-26',review_on:'2026-10-26'}),{});
 assert.ok(readCollectionReview({[REVIEW_ON]:'2026-10-26'}).issue);
 for(const value of [2,'1',true,null])assert.ok(readCollectionReview({[REVIEW_VERSION]:value,[REVIEW_ON]:'2026-10-26'}).issue);
 for(const value of ['2026-02-30','2026-2-03','2026-10-26T12:00:00Z',true,{}])assert.ok(readCollectionReview({[REVIEW_VERSION]:1,[REVIEW_ON]:value}).issue);
 assert.deepEqual(readCollectionReview({[REVIEW_VERSION]:1,[REVIEW_ON]:'2026-10-26'}),{on:'2026-10-26'});
 assert.deepEqual(readCollectionReview({[REVIEW_VERSION]:1,[REVIEW_ON]:new Date('2026-10-26T00:00:00Z')}),{on:'2026-10-26'});
});
test('due review includes today and overdue but not future, missing or damaged dates',()=>{
 for(const on of ['2026-10-25','2026-10-26'])assert.equal(isReviewDue({reviewOn:on},'2026-10-26'),true);
 for(const on of [undefined,'bad','2026-10-27'])assert.equal(isReviewDue({reviewOn:on},'2026-10-26'),false);
 assert.equal(isReviewDue({reviewOn:'2026-10-25',reviewIssue:'unknown version'},'2026-10-26'),false);
 assert.equal(reviewDayAfter(new Date(2026,11,31,23),1),'2027-01-01');assert.throws(()=>reviewDayAfter(new Date(),-1));
});
test('duplicates preserve exact text and URL semantics including fragments and query values',()=>{
 assert.equal(collectionDuplicateValue('https://x.test/a?q=1#t'),collectionDuplicateValue(' https://x.test/a?q=1#t '));
 assert.notEqual(collectionDuplicateValue('https://x.test/a?q=1'),collectionDuplicateValue('https://x.test/a?q=2'));
 assert.notEqual(collectionDuplicateValue('text'),collectionDuplicateValue('text '));
 assert.notEqual(collectionDuplicateValue('first https://x.test'),collectionDuplicateValue('second https://x.test'));
 assert.equal(collectionDuplicateValue('  '),undefined);
});
test('duplicate scanning keeps at most two reads active, reports unread sources and never mutates records',async()=>{
 const records=Array.from({length:8},(_,i)=>record(String(i)));let active=0,maximum=0;
 const result=await findCollectionDuplicates(records,'identical',async r=>{active++;maximum=Math.max(maximum,active);await Promise.resolve();active--;if(r.id==='3')throw Error('offline');return r.id==='5'?'identical':'other';},()=>true);
 assert.equal(maximum,2);assert.equal(result.unread,1);assert.equal(result.scanned,8);assert.deepEqual(result.matches.map(r=>r.id),['5']);assert.equal(records[5].path,'5.md');
});
test('cancelled duplicate scans discard late matching results',async()=>{
 let current=true;const result=await findCollectionDuplicates([record('one'),record('two')],'same',async()=>{current=false;return 'same';},()=>current);
 assert.equal(result.cancelled,true);assert.deepEqual(result.matches,[]);
});
