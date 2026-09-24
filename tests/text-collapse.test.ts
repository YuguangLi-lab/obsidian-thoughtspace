import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,History,parseBoard,type Card} from '../src/model';
import {foldCards} from '../src/board-tools';
import {fitTextNode} from '../src/text-tools';
const text=():Card=>({id:'text',kind:'text',text:'保留全文\n$x^2$\n第三行',x:40,y:60,width:320,height:240,color:'green',autoSize:true});
test('text collapse restores the exact expanded size, body, styling and undo history',()=>{
 const board=emptyBoard();board.version=3;board.nodes=[text()];const before=clone(board),history=new History();history.push(board);foldCards(board,new Set(['text']),true);assert.equal(board.nodes[0].height,72);assert.equal(board.nodes[0].expandedHeight,240);assert.equal(board.nodes[0].text,before.nodes[0].text);
 const loaded=parseBoard(JSON.stringify(board));foldCards(loaded,new Set(['text']),true);assert.equal(loaded.nodes[0].expandedHeight,240);foldCards(loaded,new Set(['text']),false);assert.deepEqual(loaded,before);assert.deepEqual(history.undo(board),before);
});
test('locked text and non-text objects are not modified by text collapse',()=>{
 const board=emptyBoard();board.version=3;board.nodes=[{...text(),locked:true},{...text(),id:'image',kind:'image',file:'image.png'},{...text(),id:'section',kind:'section',title:'分组'}];const before=clone(board);foldCards(board,new Set(board.nodes.map(n=>n.id)),true);assert.deepEqual(board,before);
});
test('collapsed text never accesses the DOM, auto-fits or loses its saved expanded height',()=>{
 const node={...text(),collapsed:true,height:72,expandedHeight:240},before=clone(node);fitTextNode(node,undefined as unknown as HTMLElement);assert.deepEqual(node,before);
});
