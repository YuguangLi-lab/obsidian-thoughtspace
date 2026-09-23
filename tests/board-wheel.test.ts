import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardWheelIntent,BoardWheelEvent} from '../src/board-wheel';
import {BoardPreferences} from '../src/board-experience';

const event=(patch:Partial<BoardWheelEvent>={}):BoardWheelEvent=>({deltaX:0,deltaY:100,deltaMode:0,ctrlKey:false,metaKey:false,shiftKey:false,...patch});
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} differs from ${expected}`);

test('default wheel zoom retains the current factor and pointer anchor',()=>{
 const result=boardWheelIntent(event(),{},1000,700);assert.equal(result.kind,'zoom');
 if(result.kind==='zoom'){close(result.factor,Math.exp(-.2));assert.equal(result.atPointer,true);}
 assert.deepEqual(boardWheelIntent(event({deltaX:100,deltaY:0}),{},1000,700),{kind:'zoom',factor:1,atPointer:true});
});

test('pan normalizes both axes independently for pixel, line and page deltas',()=>{
 assert.deepEqual(boardWheelIntent(event({deltaX:12,deltaY:-25}),{wheelMode:'pan'},1000,700),{kind:'pan',dx:12,dy:-25});
 assert.deepEqual(boardWheelIntent(event({deltaX:2,deltaY:-3,deltaMode:1}),{wheelMode:'pan'},1000,700),{kind:'pan',dx:32,dy:-48});
 assert.deepEqual(boardWheelIntent(event({deltaX:.5,deltaY:-.25,deltaMode:2}),{wheelMode:'pan'},400,800),{kind:'pan',dx:200,dy:-200});
 assert.deepEqual(boardWheelIntent(event({deltaX:2,deltaY:-3,deltaMode:2}),{wheelMode:'pan'},50,40),{kind:'pan',dx:200,dy:-300});
});

test('Shift pan sends the normalized vertical delta to X and leaves Y still',()=>{
 assert.deepEqual(boardWheelIntent(event({deltaX:9,deltaY:3,deltaMode:1,shiftKey:true}),{wheelMode:'pan'},1000,700),{kind:'pan',dx:48,dy:0});
 assert.deepEqual(boardWheelIntent(event({deltaX:20,deltaY:0,shiftKey:true}),{wheelMode:'pan'},1000,700),{kind:'pan',dx:0,dy:0});
});

test('pan speed and reversal apply after delta normalization without altering zoom behavior',()=>{
 const e=event({deltaX:2,deltaY:-3,deltaMode:1});
 assert.deepEqual(boardWheelIntent(e,{wheelMode:'pan',panSpeed:1.5},1000,700),{kind:'pan',dx:48,dy:-72});
 assert.deepEqual(boardWheelIntent(e,{wheelMode:'pan',panSpeed:1.5,reverseWheelPan:true,reverseWheelZoom:true},1000,700),{kind:'pan',dx:-48,dy:72});
 assert.deepEqual(boardWheelIntent(event({deltaY:0}),{wheelMode:'pan',reverseWheelPan:true},1000,700),{kind:'pan',dx:0,dy:0});
 assert.deepEqual(boardWheelIntent(event(),{reverseWheelPan:true,panSpeed:3},1000,700),boardWheelIntent(event(),{},1000,700));
});

for(const modifier of ['ctrlKey','metaKey'] as const)test(`${modifier} always zooms, including Shift and configured pan mode`,()=>{
 const e=event({[modifier]:true,shiftKey:true,deltaX:35}),settings={wheelMode:'pan' as const,panSpeed:3,reverseWheelPan:true};
 const result=boardWheelIntent(e,settings,1000,700);assert.equal(result.kind,'zoom');
 if(result.kind==='zoom'){close(result.factor,Math.exp(-.2));assert.equal(result.atPointer,true);}
});

test('zoom speed, direction and anchor are independent preferences',()=>{
 for(const zoomAnchor of ['pointer','center'] as const){
  const normal=boardWheelIntent(event(),{zoomSpeed:1.5,zoomAnchor},1000,700),reverse=boardWheelIntent(event(),{zoomSpeed:1.5,zoomAnchor,reverseWheelZoom:true},1000,700);
  assert.equal(normal.kind,'zoom');assert.equal(reverse.kind,'zoom');
  if(normal.kind==='zoom'&&reverse.kind==='zoom'){close(normal.factor,Math.exp(-.3));close(reverse.factor,Math.exp(.3));close(normal.factor*reverse.factor,1);assert.equal(normal.atPointer,zoomAnchor==='pointer');assert.equal(reverse.atPointer,normal.atPointer);}
 }
});

test('speeds clamp finite outliers and default invalid numbers without poisoning the camera',()=>{
 for(const [panSpeed,expected] of [[-10,.3],[0,.3],[100,3],[NaN,1],[Infinity,1],[-Infinity,1]] as const){
  const result=boardWheelIntent(event({deltaX:10,deltaY:20}),{wheelMode:'pan',panSpeed},1000,700);
  assert.deepEqual(result,{kind:'pan',dx:10*expected,dy:20*expected});
 }
 for(const [zoomSpeed,expected] of [[-10,.3],[0,.3],[100,2],[NaN,1],[Infinity,1],[-Infinity,1]] as const){
  const result=boardWheelIntent(event(),{zoomSpeed},1000,700);assert.equal(result.kind,'zoom');if(result.kind==='zoom')close(result.factor,Math.exp(-.2*expected));
 }
 const malformed={wheelMode:'unexpected',zoomSpeed:'2',zoomAnchor:'unexpected',reverseWheelZoom:'true',reverseWheelPan:'true'} as unknown as Partial<BoardPreferences>;
 assert.deepEqual(boardWheelIntent(event(),malformed,1000,700),boardWheelIntent(event(),{},1000,700));
});

test('nonfinite deltas become zero and unusable page dimensions fall back safely',()=>{
 for(const invalid of [NaN,Infinity,-Infinity]){
  assert.deepEqual(boardWheelIntent(event({deltaX:invalid,deltaY:invalid}),{wheelMode:'pan'},1000,700),{kind:'pan',dx:0,dy:0});
  assert.deepEqual(boardWheelIntent(event({deltaY:invalid}),{},1000,700),{kind:'zoom',factor:1,atPointer:true});
 }
 for(const size of [NaN,Infinity,-Infinity,0,-300])assert.deepEqual(boardWheelIntent(event({deltaX:1,deltaY:-1,deltaMode:2}),{wheelMode:'pan'},size,size),{kind:'pan',dx:100,dy:-100});
 assert.deepEqual(boardWheelIntent(event({deltaX:2,deltaY:3,deltaMode:99}),{wheelMode:'pan'},1000,700),{kind:'pan',dx:2,dy:3});
});

test('extreme finite wheel values cannot overflow a pan delta or zoom factor',()=>{
 for(const value of [Number.MAX_VALUE,-Number.MAX_VALUE,Number.MIN_VALUE])for(const deltaMode of [0,1,2]){
  const e=event({deltaX:value,deltaY:value,deltaMode});
  const pan=boardWheelIntent(e,{wheelMode:'pan',panSpeed:Number.MAX_VALUE},Number.MAX_VALUE,Number.MAX_VALUE);
  const zoom=boardWheelIntent(e,{zoomSpeed:Number.MAX_VALUE},Number.MAX_VALUE,Number.MAX_VALUE);
  assert.equal(pan.kind,'pan');if(pan.kind==='pan'){assert.ok(Number.isFinite(pan.dx)&&Number.isFinite(pan.dy));assert.ok(Math.abs(pan.dx)<=1800&&Math.abs(pan.dy)<=1800);}
  assert.equal(zoom.kind,'zoom');if(zoom.kind==='zoom'){assert.ok(Number.isFinite(zoom.factor)&&zoom.factor>0);assert.ok(zoom.factor>=Math.exp(-4)&&zoom.factor<=Math.exp(4));}
 }
});

test('calculating an intent leaves the event and preferences untouched',()=>{
 const e=Object.freeze(event({deltaX:10})),settings=Object.freeze({wheelMode:'pan' as const,panSpeed:2,reverseWheelPan:true,zoomAnchor:'center' as const});
 const before={...e},prefs={...settings};boardWheelIntent(e,settings,1000,700);
 assert.deepEqual(e,before);assert.deepEqual(settings,prefs);
});
