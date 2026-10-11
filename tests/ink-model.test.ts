import test from 'node:test';
import assert from 'node:assert/strict';
import {
 validInkData,assertInkData,inkBounds,strokePath,hitInkStroke,hitInkStrokePath,pressureRadius,
 MAX_STROKE_POINTS,MAX_INK_POINTS,MAX_INK_STROKES,MAX_INK_COORDINATE,INK_DISPLAY_PADDING,
 type InkData,type InkPoint,type InkStroke,
} from '../src/ink-model';

const stroke=(points:InkPoint[]=[[10,20,.5]],patch:Partial<InkStroke>={}):InkStroke=>({id:'stroke-1',color:'#123abc',width:8,points,...patch});
const data=(strokes:InkStroke[]=[stroke()]):InkData=>({version:1,strokes});
const clone=<T>(value:T):T=>structuredClone(value);
const close=(actual:number,expected:number)=>assert(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);

test('empty ink and complete pen data round-trip without normalization or mutation',()=>{
 assert(validInkData(data([])));assert.equal(inkBounds(data([])),undefined);
 const saved=data([stroke([[0,0,0],[-123.456,789.123,.5],[MAX_INK_COORDINATE,-MAX_INK_COORDINATE,1]],{color:'#ABCDEF',width:24})]),before=clone(saved);
 assert(validInkData(saved));assert.doesNotThrow(()=>assertInkData(saved));assert.deepEqual(saved,before);
 assert.deepEqual(JSON.parse(JSON.stringify(saved)),before);
});

test('validation and geometry are pure with deeply frozen input',()=>{
 const point=Object.freeze([10,20,.5]),points=Object.freeze([point]),saved=Object.freeze({version:1,strokes:Object.freeze([Object.freeze({...stroke(),points})])});
 assert(validInkData(saved));assert.doesNotThrow(()=>assertInkData(saved));
 assert.deepEqual(inkBounds(saved),{x:7.5-INK_DISPLAY_PADDING,y:17.5-INK_DISPLAY_PADDING,width:5+2*INK_DISPLAY_PADDING,height:5+2*INK_DISPLAY_PADDING});
 const path=strokePath(saved.strokes[0]);assert(path);assert(hitInkStroke(saved.strokes[0],10,20,0));
 assert.deepEqual(point,[10,20,.5]);
});

test('malformed envelopes and stroke fields fail explicitly rather than discarding ink',()=>{
 const invalid:unknown[]=[null,[],false,{}, {version:2,strokes:[]},{version:'1',strokes:[]},{version:1,strokes:null},{version:1,strokes:[null]},
  ...['',' ','\n','a\u0000b','x'.repeat(257)].map(id=>data([stroke(undefined,{id})])),
  ...['red','123abc','#123ab','#123abcd','#123abg',12,null].map(color=>({version:1,strokes:[{...stroke(),color}]})),
  ...[0,-1,.49,24.01,NaN,Infinity,-Infinity,'8',null].map(width=>({version:1,strokes:[{...stroke(),width}]})),
  data([stroke([])]),{version:1,strokes:[{...stroke(),points:null}]},data([stroke(),stroke()]),
 ];
 for(const value of invalid){assert.equal(validInkData(value),false);assert.throws(()=>assertInkData(value),/笔迹/);}
});

test('samples require exact numeric triples with bounded finite world coordinates and pressure',()=>{
 const invalid:unknown[]=[null,{},[],[1,2],[1,2,.5,4],['1',2,.5],[1,'2',.5],[1,2,'0.5'],[NaN,2,.5],[1,Infinity,.5],
  [MAX_INK_COORDINATE+.001,0,.5],[-MAX_INK_COORDINATE-.001,0,.5],[0,MAX_INK_COORDINATE+1,.5],[0,-MAX_INK_COORDINATE-1,.5],
  [1,2,-.001],[1,2,1.001],[1,2,NaN],[1,2,Infinity],new Array(3),
 ];
 for(const point of invalid){const value={version:1,strokes:[{...stroke(),points:[point]}]};assert.equal(validInkData(value),false);assert.throws(()=>assertInkData(value));}
 for(const width of [.5,24])for(const p of [0,1])assert(validInkData(data([stroke([[-MAX_INK_COORDINATE,MAX_INK_COORDINATE,p]],{width})])));
});

test('sparse point and stroke arrays cannot bypass validation',()=>{
 assert.equal(validInkData({version:1,strokes:new Array(1)}),false);
 assert.equal(validInkData(data([stroke(new Array(1))])),false);
});

test('stroke point limit accepts its exact bound and rejects the next sample without truncating',()=>{
 const points=Array.from({length:MAX_STROKE_POINTS},()=>[0,0,.5] as InkPoint),saved=data([stroke(points)]);
 assert.equal(MAX_STROKE_POINTS,8192);assert(validInkData(saved));points.push([1,2,.5]);
 assert.equal(validInkData(saved),false);assert.throws(()=>assertInkData(saved));assert.equal(points.length,MAX_STROKE_POINTS+1);
});

test('whole-board point budget is shared across strokes and rejects one extra point',()=>{
 assert.equal(MAX_INK_POINTS,65536);
 const saved=data(Array.from({length:MAX_INK_POINTS/MAX_STROKE_POINTS},(_,i)=>stroke(Array.from({length:MAX_STROKE_POINTS},()=>[0,0,.5] as InkPoint),{id:'stroke-'+i})));
 assert(validInkData(saved));saved.strokes.push(stroke([[0,0,.5]],{id:'extra'}));
 assert.equal(validInkData(saved),false);assert.throws(()=>assertInkData(saved));assert.equal(saved.strokes.at(-1)!.id,'extra');
});

test('stroke budget accepts two thousand unique strokes and rejects one extra or duplicate',()=>{
 assert.equal(MAX_INK_STROKES,2000);const saved=data(Array.from({length:MAX_INK_STROKES},(_,i)=>stroke(undefined,{id:'stroke-'+i})));
 assert(validInkData(saved));saved.strokes.push(stroke(undefined,{id:'extra'}));assert.equal(validInkData(saved),false);
 saved.strokes.pop();saved.strokes[1999].id='stroke-0';assert.equal(validInkData(saved),false);
});

test('pressure has a positive floor and a shared documented maximum radius',()=>{
 close(pressureRadius(8,0),1);close(pressureRadius(8,.5),2.5);close(pressureRadius(8,1),4);
 const dot=stroke([[0,0,0]],{width:.5});assert(hitInkStroke(dot,.06,0,0));assert(!hitInkStroke(dot,.063,0,0));
});

test('bounds union pressure disks and remain finite at coordinate limits',()=>{
 const saved=data([stroke([[0,0,0],[100,0,1]]),stroke([[-20,40,.5]],{id:'other',width:4})]);
 assert.deepEqual(inkBounds(saved),{x:-21.25-INK_DISPLAY_PADDING,y:-4-INK_DISPLAY_PADDING,width:125.25+2*INK_DISPLAY_PADDING,height:45.25+2*INK_DISPLAY_PADDING});
 const extreme=inkBounds(data([stroke([[-MAX_INK_COORDINATE,MAX_INK_COORDINATE,1]],{width:24})]))!;
 assert.deepEqual(extreme,{x:-MAX_INK_COORDINATE-12-INK_DISPLAY_PADDING,y:MAX_INK_COORDINATE-12-INK_DISPLAY_PADDING,width:24+2*INK_DISPLAY_PADDING,height:24+2*INK_DISPLAY_PADDING});
 assert(Object.values(extreme).every(Number.isFinite));
});

test('one-point and stationary strokes render filled dots with no invalid path values',()=>{
 const dot=stroke([[10,20,1]]),path=strokePath(dot);
 assert.match(path,/^M/);assert.equal((path.match(/A/gi)||[]).length,2);assert.match(path,/Z$/);assert.doesNotMatch(path,/NaN|Infinity/);
 assert(hitInkStroke(dot,14,20,0));assert(!hitInkStroke(dot,14.01,20,0));
 const repeated=stroke([[10,20,0],[10,20,1],[10,20,.5]]);
 assert.doesNotMatch(strokePath(repeated),/NaN|Infinity/);assert(hitInkStroke(repeated,13.9,20,0));assert(!hitInkStroke(repeated,14.1,20,0));
});

test('pressure outline keeps finite round joins for corners, reversals, crossings and short tapers',()=>{
 for(const points of [
  [[0,0,.5],[20,0,1],[20,20,0]],[[0,0,1],[20,0,.5],[0,0,0]],
  [[0,0,.5],[20,20,1],[0,20,.5],[20,0,0]],[[0,0,0],[.01,0,1]],
 ] as InkPoint[][]){const s=stroke(points),before=clone(s);assert.doesNotMatch(strokePath(s),/NaN|Infinity|undefined/);assert.match(strokePath(s),/Z$/);assert.deepEqual(s,before);}
});

test('whole-stroke hit follows the varying radius rather than over-erasing its thin end',()=>{
 const s=stroke([[0,0,0],[100,0,1]]);
 assert(hitInkStroke(s,0,1,0));assert(!hitInkStroke(s,10,2,0));assert(hitInkStroke(s,90,3.6,0));
 assert(hitInkStroke(s,104,0,0));assert(!hitInkStroke(s,104.0001,0,0));
 assert(hitInkStroke(s,50,3.4,1));assert(!hitInkStroke(s,50,3.7,1));
 const tangent=2.5/Math.sqrt(1-.03**2);assert(hitInkStroke(s,50,tangent,0));assert(!hitInkStroke(s,50,tangent+.0001,0));
});

test('constant-width segments support exact round caps and point-to-segment hits',()=>{
 const s=stroke([[0,0,1],[100,0,1]]);
 assert(hitInkStroke(s,50,4,0));assert(!hitInkStroke(s,50,4.001,0));assert(hitInkStroke(s,-4,0,0));assert(!hitInkStroke(s,-4.001,0,0));
 assert(hitInkStroke(s,50,7,3));assert(!hitInkStroke(s,50,7.001,3));
 assert(!hitInkStroke(s,NaN,0,1));assert(!hitInkStroke(s,0,Infinity,1));assert(!hitInkStroke(s,0,0,-1));assert(!hitInkStroke(s,0,0,NaN));
});

test('bounds and eraser hits obey translation and scale in world space',()=>{
 const s=stroke([[10,20,0],[80,60,1],[90,40,.5]],{width:4}),translated=stroke(s.points.map(([x,y,p])=>[x+300,y-200,p]),{width:4});
 const b=inkBounds(data([s]))!,t=inkBounds(data([translated]))!;close(t.x,b.x+300);close(t.y,b.y-200);close(t.width,b.width);close(t.height,b.height);
 const scale=3,scaled=stroke(s.points.map(([x,y,p])=>[x*scale,y*scale,p]),{width:s.width*scale}),scaledBounds=inkBounds(data([scaled]))!;
 for(const key of ['x','y'] as const)close(scaledBounds[key]+INK_DISPLAY_PADDING,(b[key]+INK_DISPLAY_PADDING)*scale);
 for(const key of ['width','height'] as const)close(scaledBounds[key]-2*INK_DISPLAY_PADDING,(b[key]-2*INK_DISPLAY_PADDING)*scale);
 for(const [x,y,r] of [[40,37,2],[0,0,0],[90,40,1],[82,64,1]]){
  assert.equal(hitInkStroke(s,x,y,r),hitInkStroke(translated,x+300,y-200,r));
  assert.equal(hitInkStroke(s,x,y,r),hitInkStroke(scaled,x*scale,y*scale,r*scale));
 }
});

test('every generated outline endpoint and arc stays within conservative stroke bounds',()=>{
 const s=stroke([[0,0,0],[10,3,1],[10,3,.1],[-8,5,.5],[MAX_INK_COORDINATE,0,1]]),bounds=inkBounds(data([s]))!,tokens=strokePath(s).match(/[MLAZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)!;
 let at=0,lastX=0,lastY=0;while(at<tokens.length){const command=tokens[at++];if(command==='Z')continue;
  const count=command.toUpperCase()==='A'?7:2,values=tokens.slice(at,at+count).map(Number);at+=count;
  assert(values.every(Number.isFinite));let [x,y]=command.toUpperCase()==='A'?values.slice(5):values;
  if(command==='a'){x+=lastX;y+=lastY;}lastX=x;lastY=y;
  assert(x>=bounds.x-1e-8&&x<=bounds.x+bounds.width+1e-8);assert(y>=bounds.y-1e-8&&y<=bounds.y+bounds.height+1e-8);
  if(command.toUpperCase()==='A'){assert(values[0]>0&&values[1]>0);assert.equal(values[4],1,'all disks use the same winding');}
 }
});

test('empty temporary stroke helpers remain harmless while persistence rejects the empty stroke',()=>{
 const s=stroke([]);assert.equal(strokePath(s),'');assert.equal(hitInkStroke(s,0,0,10),false);assert.equal(inkBounds(data([s])),undefined);assert.equal(validInkData(data([s])),false);
});

test('continuous eraser sweep hits crossing ink even when neither sampled endpoint touches it',()=>{
 const s=stroke([[0,-100,1],[0,100,1]]),eraser:InkPoint[]=[[-100,0,.5],[100,0,.5]];
 assert(!hitInkStroke(s,-100,0,1));assert(!hitInkStroke(s,100,0,1));assert(hitInkStrokePath(s,eraser,1));
 assert(hitInkStrokePath(stroke([[0,0,.5]]),eraser,0));assert(!hitInkStrokePath(stroke([[0,10,.5]]),eraser,1));
});

test('eraser sweeps preserve tapered thickness, round caps and stationary samples',()=>{
 const s=stroke([[0,0,0],[100,0,1]]);
 assert(!hitInkStrokePath(s,[[10,2,0],[10,20,0]],0));assert(hitInkStrokePath(s,[[90,3.6,0],[90,20,0]],0));
 assert(hitInkStrokePath(s,[[-1,0,0],[-1,0,0]],0));assert(!hitInkStrokePath(s,[[-1.001,0,0],[-1.001,0,0]],0));
 assert(hitInkStrokePath(s,[[20,5,0],[80,5,0]],2));assert(!hitInkStrokePath(s,[[20,8,0],[80,8,0]],2));
 const repeated=stroke([[10,20,0],[10,20,1],[10,20,.5]]);
 assert(hitInkStrokePath(repeated,[[0,20,0],[20,20,0]],0));assert(!hitInkStrokePath(repeated,[[0,25,0],[20,25,0]],0));
});

test('eraser path accepts a single sample and remains pure, finite and bounded for far misses',()=>{
 const s=stroke([[0,0,1],[100,0,1]]),points:InkPoint[]=[[50,4,0]],before=clone(points);
 assert.equal(hitInkStrokePath(s,points,0),hitInkStroke(s,50,4,0));assert.deepEqual(points,before);
 assert(!hitInkStrokePath(s,[],1));assert(!hitInkStrokePath(s,[[NaN,0,0]],1));assert(!hitInkStrokePath(s,[[0,0,0]],-1));
 const maximum=stroke(Array.from({length:MAX_STROKE_POINTS},(_,i)=>[i*.1,Math.sin(i/40),.5] as InkPoint)),far=Array.from({length:MAX_STROKE_POINTS},(_,i)=>[i*.1,1000,.5] as InkPoint);
 assert(!hitInkStrokePath(maximum,far,10));assert(!hitInkStrokePath(stroke([]),far,10));
});

test('continuous sweep is direction-independent and includes tangency in world coordinates',()=>{
 const s=stroke([[0,0,0],[100,0,1]]),eraser:InkPoint[]=[[20,7,0],[80,7,0]];
 assert.equal(hitInkStrokePath(s,eraser,3),hitInkStrokePath(s,eraser.slice().reverse(),3));
 const dot=stroke([[0,0,1]]);assert(hitInkStrokePath(dot,[[-10,5,0],[10,5,0]],1));assert(!hitInkStrokePath(dot,[[-10,5.001,0],[10,5.001,0]],1));
});

test('SVG compaction reduces display bytes without changing persisted full-precision samples',()=>{
 const s=stroke(Array.from({length:MAX_STROKE_POINTS},(_,i)=>[300+i*.3,150+Math.sin(i/20)*16,.5+.3*Math.sin(i/61)] as InkPoint)),before=clone(s);
 const path=strokePath(s);assert(path.length<1_500_000);assert.deepEqual(s,before);assert.doesNotMatch(path,/NaN|Infinity/);
});

test('near-parallel long segments remain numerically stable at world coordinate limits',()=>{
 const s=stroke([[-MAX_INK_COORDINATE,0,0],[MAX_INK_COORDINATE,0,0]],{width:.5});
 assert(hitInkStrokePath(s,[[-MAX_INK_COORDINATE,-.1,0],[MAX_INK_COORDINATE,.1,0]],0));
 assert(!hitInkStrokePath(s,[[-MAX_INK_COORDINATE,.1,0],[MAX_INK_COORDINATE,.101,0]],0));
});
