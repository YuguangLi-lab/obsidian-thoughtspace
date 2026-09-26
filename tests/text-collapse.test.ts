import test from 'node:test';
import assert from 'node:assert/strict';
import {assertBoardGeometry,clone,emptyBoard,History,parseBoard,type Card} from '../src/model';
import {foldCards} from '../src/board-tools';
import {fitTextNode} from '../src/text-tools';
const text=():Card=>({id:'text',kind:'text',text:'保留全文\n$x^2$\n第三行',x:40,y:60,width:320,height:240,color:'green',autoSize:true});
test('text collapse restores the exact expanded size, body, styling and undo history',()=>{
 const board=emptyBoard();board.version=3;board.nodes=[text()];const before=clone(board),history=new History();history.push(board);foldCards(board,new Set(['text']),true);assert.equal(board.nodes[0].height,72);assert.equal(board.nodes[0].expandedHeight,240);assert.equal(board.nodes[0].text,before.nodes[0].text);
 const loaded=parseBoard(JSON.stringify(board));foldCards(loaded,new Set(['text']),true);assert.equal(loaded.nodes[0].expandedHeight,240);foldCards(loaded,new Set(['text']),false);assert.deepEqual(loaded,before);assert.deepEqual(history.undo(board),before);
});
test('compact text survives collapse, reload, expand and undo with its exact manual height',()=>{
 for(const height of [40,40.5,59]){
  const board=emptyBoard();board.version=3;board.nodes=[{...text(),height,autoSize:false,textAutoHeight:false}];
  const before=clone(board),history=new History();history.push(board);foldCards(board,new Set(['text']),true);
  assert.equal(board.nodes[0].height,72);assert.equal(board.nodes[0].expandedHeight,height);assertBoardGeometry(board);
  const loaded=parseBoard(JSON.stringify(board));foldCards(loaded,new Set(['text']),false);
  assertBoardGeometry(loaded);assert.deepEqual(parseBoard(JSON.stringify(loaded)),before);
  assert.deepEqual(history.undo(board),before);
 }
});
test('folded text rejects undersized restoration while other foldable kinds retain their 60px minimum',()=>{
 const board=emptyBoard();board.version=3;
 for(const kind of ['text','card','board','pdf'] as const){
  const minimum=kind==='text'?40:60;
  board.nodes=[{...text(),kind,height:72,collapsed:true,expandedHeight:minimum,...(kind==='text'?{}:{file:`source.${kind==='card'?'md':kind==='board'?'thoughtspace':'pdf'}`})}];
  assert.doesNotThrow(()=>parseBoard(JSON.stringify(board)),kind);
  board.nodes[0].expandedHeight=minimum-.01;
  assert.throws(()=>parseBoard(JSON.stringify(board)),/卡片折叠数据不完整/,kind);
 }
});
test('locked text and non-text objects are not modified by text collapse',()=>{
 const board=emptyBoard();board.version=3;board.nodes=[{...text(),locked:true},{...text(),id:'image',kind:'image',file:'image.png'},{...text(),id:'section',kind:'section',title:'分组'}];const before=clone(board);foldCards(board,new Set(board.nodes.map(n=>n.id)),true);assert.deepEqual(board,before);
});
test('collapsed text never accesses the DOM, auto-fits or loses its saved expanded height',()=>{
 const node={...text(),collapsed:true,height:72,expandedHeight:240},before=clone(node);fitTextNode(node,undefined as unknown as HTMLElement);assert.deepEqual(node,before);
});

test('automatic text height preference survives collapse, persistence and expand',()=>{
 for(const value of [true,false,undefined]){const board=emptyBoard();board.version=3;board.nodes=[{...text(),textAutoHeight:value}];foldCards(board,new Set(['text']),true);
 const reloaded=parseBoard(JSON.stringify(board));foldCards(reloaded,new Set(['text']),false);assert.equal(reloaded.nodes[0].textAutoHeight,value);assert.equal(reloaded.nodes[0].height,240);assert.equal(reloaded.nodes[0].text,text().text);}
});
test('text height preference rejects invalid types and never leaks into non-text nodes',()=>{
 for(const value of ['true',1,null]){const board=emptyBoard();board.version=3;board.nodes=[{...text(),textAutoHeight:value as any}];assert.throws(()=>parseBoard(JSON.stringify(board)),/文本样式/);}
 const board=emptyBoard();board.version=3;board.nodes=[{...text(),kind:'card',file:'note.md',textAutoHeight:true}];assert.throws(()=>parseBoard(JSON.stringify(board)),/文本样式/);
});
