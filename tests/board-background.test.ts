import test from 'node:test';
import assert from 'node:assert/strict';
import {boardBackground,cleanBoardBackground} from '../src/board-background';
import {emptyBoard,parseBoard,clone} from '../src/model';
import {createBrainBoard} from '../src/brain-board';

test('old boards inherit existing defaults; overriding one board leaves other boards and global preferences intact',()=>{
 const defaults=cleanBoardBackground({canvasBackground:'grid',paperTexture:28}),a=emptyBoard(),b=emptyBoard();
 assert.deepEqual(boardBackground(a,defaults),defaults);const before=JSON.stringify(defaults);
 a.background=cleanBoardBackground({...defaults,canvasBackground:'paper'});
 assert.equal(boardBackground(a,defaults).canvasBackground,'paper');assert.equal(boardBackground(b,defaults).canvasBackground,'grid');assert.equal(JSON.stringify(defaults),before);
 delete a.background;assert.deepEqual(boardBackground(a,defaults),defaults);
});
for(const canvasBackground of ['dots','grid','plain','paper','image'] as const)test(`background ${canvasBackground} survives native board parsing and ordinary/brain conversion`,()=>{
 const board=createBrainBoard();board.background=cleanBoardBackground({canvasBackground,paperPreset:'custom',paperColor:'#123456',paperTexture:39,backgroundImagePath:'assets/background.png',backgroundImageFit:'tile',backgroundImageOpacity:61});
 const loaded=parseBoard(JSON.stringify(board)),ordinary=clone(loaded);delete ordinary.presentation;delete ordinary.brain;delete ordinary.brainViewport;
 assert.deepEqual(parseBoard(JSON.stringify(ordinary)).background,board.background);
 ordinary.presentation='brain';ordinary.brain=loaded.brain;assert.deepEqual(parseBoard(JSON.stringify(ordinary)).background,board.background);
});
test('malformed appearance overrides are sanitized without allowing unsafe native image paths',()=>{
 const board=emptyBoard(),raw={...board,background:{canvasBackground:'unknown',paperTexture:500,backgroundImagePath:'../private.png'}};
 const result=parseBoard(JSON.stringify(raw));assert.equal(result.background?.canvasBackground,'dots');assert.equal(result.background?.backgroundImagePath,'');assert(result.background!.paperTexture<=100);
});
