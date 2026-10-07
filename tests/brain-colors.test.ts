import test from 'node:test';
import assert from 'node:assert/strict';
import {brainColor,cleanBrainColors,brainContrast,brainStateInk} from '../src/brain-colors';
import {createBrainBoard} from '../src/brain-board';
import {parseBoard,emptyBoard,clone,type Board} from '../src/model';
import {History} from '../src/model';

test('hex input normalizes shorthand and rejects CSS injection, alpha and named colors',()=>{
 assert.equal(brainColor(' #AbC '),'#aabbcc');assert.equal(brainColor('#FEDCBA'),'#fedcba');
 for(const value of ['',null,4,'red','var(--text-normal)','#ffffff00','url(file:///private)','#fff; color:red','#12','rgb(1,2,3)'])assert.equal(brainColor(value),undefined);
});
test('legacy boards preserve theme following; unsafe keys are ignored without rejecting readable graph data',()=>{
 assert.equal(parseBoard(JSON.stringify(createBrainBoard())).brainColors,undefined);
 const board=createBrainBoard(),raw={...board,brainColors:{background:'bad',node:'#FFF',text:'#012345',line:4,unknown:'#ff0000'}};
 assert.deepEqual(parseBoard(JSON.stringify(raw)).brainColors,{node:'#ffffff',text:'#012345'});
 assert.equal(parseBoard(JSON.stringify({...board,brainColors:'red'})).brainColors,undefined);
});
test('colors survive save/parse and ordinary conversion while other boards and background modes stay independent',()=>{
 const a:Board=createBrainBoard(),b=createBrainBoard(),ordinary=emptyBoard();a.brainColors={background:'#112233',node:'#445566',border:'#bcdeff',text:'#ffffff',line:'#abcdef'};
 a.background={canvasBackground:'paper',paperPreset:'custom',paperColor:'#fedcba',paperTexture:23,backgroundImagePath:'',backgroundImageFit:'cover',backgroundImageOpacity:30};
 const before=clone(a);assert.deepEqual(parseBoard(JSON.stringify(a)).brainColors,a.brainColors);delete a.presentation;delete a.brain;assert.deepEqual(parseBoard(JSON.stringify(a)).brainColors,before.brainColors);
 assert.equal(b.brainColors,undefined);assert.equal(ordinary.brainColors,undefined);assert.deepEqual(a.background,before.background);
});
test('confirm and reset create independent undo/redo snapshots',()=>{
 const h=new History(),board=createBrainBoard();h.push(board);board.brainColors={node:'#ffffff',border:'#00aacc'};
 const old=h.undo(board)!;assert.equal(old.brainColors,undefined);const redone=h.redo(old)!;assert.deepEqual(redone.brainColors,{node:'#ffffff',border:'#00aacc'});
 h.push(redone);const reset=clone(redone);delete reset.brainColors;assert.deepEqual(h.undo(reset)!.brainColors,{node:'#ffffff',border:'#00aacc'});
});
test('a new border override round trips independently and never changes legacy node or line colors',()=>{
 const board=createBrainBoard();board.brainColors={node:'#e4eef0',line:'#343434'};
 const before=clone(board);assert.equal(parseBoard(JSON.stringify(before)).brainColors?.border,undefined);
 board.brainColors={...board.brainColors,border:'#AbC'};
 assert.deepEqual(parseBoard(JSON.stringify(board)).brainColors,{node:'#e4eef0',border:'#aabbcc',line:'#343434'});
 delete board.brainColors.border;assert.deepEqual(parseBoard(JSON.stringify(board)),before);
 assert.deepEqual(cleanBrainColors({...board.brainColors,border:'url(https://invalid.example)'}),before.brainColors);
});
test('contrast advice and interaction ink do not alter chosen colors',()=>{
 const colors=cleanBrainColors({node:'#000000',text:'#000000',line:'#ffffff',background:'#ffffff'}),before=JSON.stringify(colors);
 assert.equal(brainContrast(colors.node!,colors.text!),1);assert.equal(brainContrast('#000000','#ffffff'),21);
 assert.equal(brainStateInk('#000000'),'#ffffff');assert.equal(brainStateInk('#ffffff'),'#202020');assert.equal(JSON.stringify(colors),before);
});
