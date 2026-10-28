import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasFramePosition,type CanvasBox} from '../src/media-canvas';
test('canvas shots form three columns in board coordinates without overlap',()=>{
 const source={x:80,y:100,width:400,height:225},objects:CanvasBox[]=[source],shots:CanvasBox[]=[];
 for(let i=0;i<6;i++){const next=canvasFramePosition(source,objects,{width:1600,height:900});objects.push(next);shots.push(next);}
 assert.equal(shots[0].y,shots[1].y);assert.equal(shots[1].y,shots[2].y);assert.ok(shots[3].y>shots[0].y);assert.equal(shots[0].x,shots[3].x);
 for(let i=0;i<shots.length;i++)for(const other of shots.slice(i+1))assert.ok(shots[i].x+shots[i].width<=other.x||other.x+other.width<=shots[i].x||shots[i].y+shots[i].height<=other.y||other.y+other.height<=shots[i].y);
});
test('authored objects reserve space and extreme aspect ratios remain valid board geometry',()=>{
 const source={x:0,y:0,width:400,height:225},first=canvasFramePosition(source,[source],{width:1600,height:900});const next=canvasFramePosition(source,[source,first],{width:100000,height:1});assert.notEqual(next.x,first.x);assert.ok(next.imageHeight>=60);assert.throws(()=>canvasFramePosition(source,[],{width:0,height:1}));
});
