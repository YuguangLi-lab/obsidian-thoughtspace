import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandwritingBoard,isHandwritingBoard} from '../src/handwriting-board';
import {emptyBoard,parseBoard,assertBoardGeometry,clone,History,canvasExport,uid} from '../src/model';
import {cleanBoardCreationPreferences} from '../src/board-creation';
const stroke={id:'stroke-1',color:'#202020',width:4,points:[[10,20,.5],[30,40,1]]};
test('third creation type persists both formats while old ordinary boards stay ordinary',()=>{
 assert.deepEqual(cleanBoardCreationPreferences({presentation:'handwriting',format:'markdown'}),{presentation:'handwriting',format:'markdown'});
 assert.deepEqual(cleanBoardCreationPreferences({presentation:'handwriting',format:'legacy'}),{presentation:'handwriting',format:'legacy'});
 const b=createHandwritingBoard();assert.equal(b.version,3);assert(isHandwritingBoard(parseBoard(JSON.stringify(b))));assert(!isHandwritingBoard(emptyBoard()));
 assert.deepEqual(b.ink,{version:1,strokes:[]});
});
test('ink survives history, copies and reopen',()=>{
 const b=createHandwritingBoard(),h=new History();h.push(b);b.ink.strokes.push(stroke as any);const reopened=parseBoard(JSON.stringify(b));assert.deepEqual(reopened.ink,b.ink);assert.deepEqual(clone(b).ink,b.ink);
 const previous=h.undo(b);assert(previous);assert.deepEqual(previous.ink,{version:1,strokes:[]});assert.deepEqual(h.redo(previous)?.ink,b.ink);
});
test('malformed ink rejected at read and mutation boundaries; no ordinary or brain ink',()=>{
 const b=createHandwritingBoard();for(const points of [[[NaN,0,.5]],[[0,0,2]],[[0,0,.5,4]]]){b.ink.strokes=[{...stroke,points} as any];assert.throws(()=>assertBoardGeometry(b));assert.throws(()=>parseBoard(JSON.stringify(b)));}
 b.ink.strokes=[stroke as any];for(const presentation of [undefined,'brain'])assert.throws(()=>parseBoard(JSON.stringify({...b,presentation})));
 assert.throws(()=>parseBoard(JSON.stringify({...b,ink:undefined})));assert.throws(()=>parseBoard(JSON.stringify({...b,version:1})));
});
test('Canvas export cannot silently drop handwriting',()=>{const b=createHandwritingBoard();b.ink.strokes.push(stroke as any);assert.throws(()=>canvasExport(b,'test'),/手写/);});

test('secure UUID fallback works in a host without randomUUID',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:(bytes:Uint8Array)=>bytes.fill(0x12)}});
  assert.equal(uid(),'12121212-1212-4212-9212-121212121212');
 }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else Reflect.deleteProperty(globalThis,'crypto');}
});
