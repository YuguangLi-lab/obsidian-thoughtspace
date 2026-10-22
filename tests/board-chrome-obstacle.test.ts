import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardChromeObstacle} from '../src/board-chrome';
const stage={left:98,top:84,right:390,bottom:817};
test('reserved compact rail sharing the stage edge contributes no phantom obstacle',()=>{
 assert.equal(boardChromeObstacle(stage,{left:44,top:84,right:98,bottom:817},6),undefined);
});
test('format dock is translated once from screen to shifted stage coordinates',()=>{
 assert.deepEqual(boardChromeObstacle(stage,{left:106,top:92,right:382,bottom:220},4),{x:4,y:4,width:284,height:136});
});
test('a real overlay straddling stage edge remains an obstacle',()=>{
 assert.deepEqual(boardChromeObstacle(stage,{left:80,top:100,right:140,bottom:144},6),{x:-24,y:10,width:72,height:56});
});
test('all detached/hidden/zero and nonintersecting chrome stays absent',()=>{
 for(const r of [undefined,{left:10,top:10,right:30,bottom:30},{left:390,top:84,right:420,bottom:817},{left:98,top:817,right:390,bottom:840},{left:98,top:0,right:390,bottom:84},{left:98,top:84,right:98,bottom:817}])assert.equal(boardChromeObstacle(stage,r),undefined);
});
test('native detached window origin and stage top are independently translated',()=>{
 assert.deepEqual(boardChromeObstacle({left:500,top:260,right:1300,bottom:900},{left:510,top:270,right:800,bottom:320}),{x:10,y:10,width:290,height:50});
});
