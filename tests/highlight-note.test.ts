import test from 'node:test';
import assert from 'node:assert/strict';
import {highlightJump,highlightMarkdown,parseHighlight} from '../src/highlight-note';
import {placeExistingCard} from '../src/card-library-model';
import {emptyBoard,parseBoard} from '../src/model';

test('a PDF highlight is a Markdown note and the board stores only its path',()=>{
 const body=highlightMarkdown({kind:'pdf',source:'Papers/Shade.pdf',page:2,endPage:3},'林荫降低路面温度。','林荫摘录');
 assert.match(body,/thoughtspace_highlight: pdf/);
 assert.match(body,/thoughtspace_page: 2/);
 assert.match(body,/\[\[Papers\/Shade.pdf#page=2\]\]/);
 const anchor=parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/Shade.pdf',thoughtspace_page:2,thoughtspace_end_page:3});
 assert.deepEqual(highlightJump(anchor!),{path:'Papers/Shade.pdf',page:2,time:undefined});
 const board=emptyBoard();placeExistingCard(board,'Cards/林荫摘录.md',{x:200,y:120},'a');
 assert.equal(board.nodes[0].kind,'card');assert.equal(board.nodes[0].text,undefined);assert.equal(JSON.stringify(board).includes('林荫降低'),false);
 assert.equal(parseBoard(JSON.stringify(board)).nodes[0].file,'Cards/林荫摘录.md');
});

test('a video highlight keeps the timestamp in the note, not on the board',()=>{
 const body=highlightMarkdown({kind:'video',source:'Media/Walk.mp4',time:12.5},'回到 12 秒。','步行');
 assert.match(body,/thoughtspace_time: 12.5/);
 assert.deepEqual(parseHighlight({thoughtspace_highlight:'video',thoughtspace_source:'Media/Walk.mp4',thoughtspace_time:12.5}),{kind:'video',source:'Media/Walk.mp4',time:12.5});
 assert.equal(parseHighlight({thoughtspace_highlight:'video',thoughtspace_source:'../Walk.mp4',thoughtspace_time:1}),undefined);
 assert.equal(parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Notes/A.md',thoughtspace_page:1}),undefined);
});
