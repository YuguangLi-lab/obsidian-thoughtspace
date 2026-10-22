import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollectionBoardReceipts,isCollectionBoardReceipt,isCollectionBoardReceiptDocument,type CollectionBoardReceipt} from '../src/collection-board-receipts';
import type {CollectionJsonAdapter} from '../src/collection-json-store';
const source={id:'capture-receipts-001',createdAt:'2026-10-20T12:00:00.000Z'},directory='.obsidian/plugins/thoughtspace/collection-library/board-deliveries';
const prepared=(operationId='operation-1'):CollectionBoardReceipt=>({operationId,sourceId:source.id,sourceCreatedAt:source.createdAt,sourcePath:'Notes/Source.md',boardId:'board-1',boardPath:'Boards/Target.thoughtspace',nodeIds:['card-1'],added:1,duplicate:true,status:'prepared',createdAt:source.createdAt});
function fixture(){const files=new Map<string,string>();let n=0;const adapter:CollectionJsonAdapter={exists:async path=>path===directory||files.has(path),list:async()=>({files:[...files.keys()]}),read:async path=>{if(!files.has(path))throw Error('missing');return files.get(path)!;},write:async(path,text)=>{files.set(path,text);},copy:async(from,to)=>{if(files.has(to))throw Error('exists');files.set(to,files.get(from)!);},process:async(path,change)=>{const text=change(files.get(path)!);files.set(path,text);return text;},remove:async path=>{files.delete(path);}};return{files,adapter,open:()=>new CollectionBoardReceipts(adapter,directory,source,()=>`token-${++n}`)};}
test('receipt schema rejects unknown fields, unsafe identity/path and invalid completion facts',()=>{
 assert.equal(isCollectionBoardReceipt(prepared()),true);assert.equal(isCollectionBoardReceipt({...prepared(),groupId:'分组 一',nodeIds:['原卡片 一']}),true);
 for(const patch of [{extra:1},{operationId:'../x'},{sourceId:'nope'},{boardId:'bad_id'},{boardPath:'../other'},{nodeIds:[]},{nodeIds:['same','same']},{added:2},{status:'confirmed'},{confirmedAt:source.createdAt}])assert.equal(isCollectionBoardReceipt({...prepared(),...patch}),false,JSON.stringify(patch));
 assert.equal(isCollectionBoardReceiptDocument({version:1,sourceId:source.id,sourceCreatedAt:source.createdAt,receipts:[prepared(),prepared()]}),false);
});
test('history is read-only before the first explicit operation and confirmed receipts survive restart',async()=>{
 const f=fixture(),store=f.open();assert.deepEqual(await store.history(),{receipts:[]});assert.equal(f.files.size,0);
 const receipt=prepared();await store.put(receipt,()=>true);await store.put({...receipt,status:'confirmed',confirmedAt:source.createdAt},()=>true);
 const reopened=await f.open().history();assert.equal(reopened.receipts.length,1);assert.equal(reopened.receipts[0].status,'confirmed');assert.equal(reopened.warning,undefined);
});
test('a prepared operation blocks new operations and cannot change its board or allocated node IDs',async()=>{
 const f=fixture(),store=f.open(),receipt=prepared();await store.put(receipt,()=>true);
 await assert.rejects(store.put(prepared('another'),()=>true),/尚未确认/);
 for(const patch of [{boardPath:'Boards/Replacement.thoughtspace'},{boardId:'other'},{nodeIds:['other']},{duplicate:false}])await assert.rejects(store.put({...receipt,...patch},()=>true),/意图/);
 assert.equal((await f.open().history()).receipts[0].status,'prepared');
});
test('known not-written permits a fresh explicit operation but completed receipts stay immutable',async()=>{
 const f=fixture(),store=f.open(),receipt=prepared();await store.put(receipt,()=>true);await store.put({...receipt,status:'not-written'},()=>true);await store.put(prepared('next'),()=>true);
 await assert.rejects(store.put({...receipt,status:'confirmed',confirmedAt:source.createdAt},()=>true),/结束/);assert.equal((await store.history()).receipts.length,2);
});
test('same capture ID with changed creation identity is blocked without journal overwrite',async()=>{
 const f=fixture(),store=f.open();await store.put(prepared(),()=>true);const before=new Map(f.files),other=new CollectionBoardReceipts(f.adapter,directory,{...source,createdAt:'2026-10-21T12:00:00.000Z'},()=> 'token');
 assert.match((await other.history()).warning!,/标识冲突/);await assert.rejects(other.put({...prepared(),sourceCreatedAt:'2026-10-21T12:00:00.000Z'},()=>true),/冲突/);assert.deepEqual(f.files,before);
});
test('corrupt receipt stays read-only and source flags never appear in the stored schema',async()=>{
 const f=fixture(),path=`${directory}/${source.id}.json`;f.files.set(path,'{broken');const store=f.open();assert.ok((await store.history()).warning);await assert.rejects(store.put(prepared(),()=>true));assert.equal(f.files.get(path),'{broken');assert.equal(isCollectionBoardReceipt({...prepared(),archived:true}),false);
});
