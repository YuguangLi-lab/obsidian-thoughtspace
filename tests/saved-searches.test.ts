import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,parseBoard,History,type Board,type Card} from '../src/model';
import {boardSearchIndex,searchBoard} from '../src/board-search';
import {addSavedSearch,renameSavedSearch,removeSavedSearch,savedSearchStamp,savedSearchQuery,type SavedSearchQuery} from '../src/saved-searches';
const query:SavedSearchQuery={query:'evidence',kind:'pdf',group:'',color:'',review:'later',full:false};
const pdf=(id:string,extra:Partial<Card>={}):Card=>({id,kind:'pdf',title:'evidence '+id,file:id+'.pdf',x:20,y:20,width:120,height:100,color:'green',...extra});
test('saved material lists persist only filters and do not snapshot results or note bodies',()=>{
 const board={...emptyBoard(),version:3 as const,nodes:[pdf('a')]};addSavedSearch(board,'list','待读 PDF',query);
 const stored=JSON.parse(JSON.stringify(board)).savedSearches[0];assert.deepEqual(Object.keys(stored).sort(),['id','name','query']);assert.deepEqual(stored.query,query);assert.deepEqual(parseBoard(JSON.stringify(board)).savedSearches,board.savedSearches);
 query.query='changed';assert.equal(board.savedSearches![0].query.query,'evidence');query.query='evidence';const copy=savedSearchQuery(board,'list');copy.query='different';assert.equal(board.savedSearches![0].query.query,'evidence');
});
test('reopening saved queries recomputes current reading states and new or removed material',()=>{
 const board:Board={...emptyBoard(),version:3,nodes:[pdf('a'),pdf('b',{review:'done'})]};addSavedSearch(board,'list','待读 PDF',query);
 const results=()=>searchBoard(boardSearchIndex(board),savedSearchQuery(board,'list')).map(e=>e.id);assert.deepEqual(results(),['a']);
 board.nodes[0].review='done';board.nodes.push(pdf('c'));assert.deepEqual(results(),['c']);board.nodes=board.nodes.filter(n=>n.id!=='c');assert.deepEqual(results(),[]);
});
test('removed group criteria stay explicit and empty instead of widening a material list',()=>{
 const board:Board={...emptyBoard(),version:3,nodes:[{id:'group',kind:'section',title:'Evidence',x:0,y:0,width:400,height:300,color:'sand'},pdf('a'),pdf('b',{x:600})]};
 addSavedSearch(board,'list','组内 PDF',{...query,group:'group'});assert.deepEqual(searchBoard(boardSearchIndex(board),savedSearchQuery(board,'list')).map(e=>e.id),['a']);
 board.nodes=board.nodes.filter(n=>n.id!=='group');assert.deepEqual(searchBoard(boardSearchIndex(board),savedSearchQuery(board,'list')),[]);assert.equal(board.savedSearches![0].query.group,'group');
});
test('renaming and deleting saved searches are board scoped and undo redo restores them',()=>{
 const board=emptyBoard(),other=emptyBoard(),history=new History();history.push(board);addSavedSearch(board,'list','待读 PDF',query);history.push(board);renameSavedSearch(board,'list','PDF 工作清单');
 assert.equal(other.savedSearches,undefined);const restored=history.undo(board)!;assert.equal(restored.savedSearches![0].name,'待读 PDF');const redone=history.redo(restored)!;assert.equal(redone.savedSearches![0].name,'PDF 工作清单');
 removeSavedSearch(redone,'list');assert.deepEqual(redone.savedSearches,[]);assert.equal(other.savedSearches,undefined);
});
test('stale reviewed saved-query controls reject conflicting changes without mutating content',()=>{
 const board=emptyBoard();addSavedSearch(board,'list','资料',query);const stamp=savedSearchStamp(board.savedSearches![0]);renameSavedSearch(board,'list','新资料');const before=JSON.stringify(board);
 assert.throws(()=>renameSavedSearch(board,'list','旧窗口名称',stamp),/已变化/);assert.throws(()=>removeSavedSearch(board,'list',stamp),/已变化/);assert.equal(JSON.stringify(board),before);
 removeSavedSearch(board,'list');assert.throws(()=>savedSearchQuery(board,'list'),/已移除/);
});
test('saved-query validation bounds payload and rejects unsupported state, bodies and duplicates',()=>{
 const board=emptyBoard();addSavedSearch(board,'list','资料',query);
 for(const bad of [{...query,review:'unknown'},{...query,full:'yes'},{...query,query:'a'.repeat(2001)},{...query,body:'entire note'},{...query,kind:'unknown'}])assert.throws(()=>parseBoard(JSON.stringify({...board,savedSearches:[{id:'list',name:'资料',query:bad}]})),/材料清单/);
 assert.throws(()=>parseBoard(JSON.stringify({...board,savedSearches:[board.savedSearches![0],board.savedSearches![0]]})),/材料清单/);
 for(let i=1;i<50;i++)addSavedSearch(board,String(i),'资料 '+i,query);assert.throws(()=>addSavedSearch(board,'extra','超额',query),/50/);
});
