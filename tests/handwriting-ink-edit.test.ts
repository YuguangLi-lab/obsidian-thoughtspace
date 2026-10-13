import test from 'node:test';
import assert from 'node:assert/strict';
import {applyInkEdit,selectInkLasso,hitSelectedInk} from '../src/handwriting-ink-edit';
import {MAX_INK_STROKES,MAX_INK_COORDINATE,type InkData,type InkStroke,type InkPoint} from '../src/ink-model';
const stroke=(id:string,points:InkPoint[]=[[0,0,.2],[10,10,.9]],width=3):InkStroke=>({id,color:'#315e9b',width,points});
const data=(...strokes:InkStroke[]):InkData=>({version:1,strokes});

test('ink commands share untouched objects, preserve exact samples and future metadata',()=>{
 const a=stroke('a'),b=stroke('b'),ink=Object.assign(data(a,b),{future:{value:'kept'}}),source=JSON.stringify(ink);
 const next=applyInkEdit(ink,{kind:'translate',ids:['a'],dx:.123456789,dy:-23.987654321});
 assert.notEqual(next,ink);assert.notEqual(next.strokes,ink.strokes);assert.notEqual(next.strokes[0],a);assert.equal(next.strokes[1],b);
 assert.deepEqual(next.strokes[0].points,[[.123456789,-23.987654321,.2],[10.123456789,-13.987654321,.9]]);
 assert.equal((next as typeof ink).future,ink.future);assert.equal(JSON.stringify(ink),source);
 const removed=applyInkEdit(ink,{kind:'remove',ids:['a']});assert.equal(removed.strokes[0],b);
 assert.equal(applyInkEdit(ink,{kind:'translate',ids:['a'],dx:0,dy:0}),ink);assert.equal(applyInkEdit(ink,{kind:'remove',ids:['missing']}),ink);
});

test('append owns incoming samples and duplicate requires fresh valid IDs for the whole selection',()=>{
 const a=stroke('a'),b=stroke('b'),ink=data(a,b),incoming=stroke('new'),next=applyInkEdit(ink,{kind:'append',stroke:incoming});
 incoming.points[0][0]=999;assert.equal(next.strokes[2].points[0][0],0);assert.equal(next.strokes[0],a);
 const copied=applyInkEdit(ink,{kind:'duplicate',ids:['b','a'],newIds:['b-copy','a-copy'],dx:24,dy:-8});
 assert.deepEqual(copied.strokes.map(stroke=>stroke.id),['a','b','a-copy','b-copy']);assert.equal(copied.strokes[0],a);assert.deepEqual(copied.strokes[2].points,[[24,-8,.2],[34,2,.9]]);
 for(const newIds of [['a','copy'],['same','same'],['only']])assert.throws(()=>applyInkEdit(ink,{kind:'duplicate',ids:['a','b'],newIds,dx:0,dy:0}));
 assert.throws(()=>applyInkEdit(ink,{kind:'duplicate',ids:['a','missing'],newIds:['one','two'],dx:0,dy:0}));
});

test('invalid coordinates and collection limits reject all of an edit without touching its input',()=>{
 const ink=data(stroke('edge',[[MAX_INK_COORDINATE,0,.5]])),before=JSON.stringify(ink);
 for(const dx of [1,NaN,Infinity])assert.throws(()=>applyInkEdit(ink,{kind:'translate',ids:['edge'],dx,dy:0}));assert.equal(JSON.stringify(ink),before);
 const full=data(...Array.from({length:MAX_INK_STROKES},(_,i)=>stroke(String(i),[[i,0,.5]]))),exact=JSON.stringify(full);
 assert.throws(()=>applyInkEdit(full,{kind:'duplicate',ids:['0'],newIds:['overflow'],dx:0,dy:0}));assert.equal(JSON.stringify(full),exact);
});

test('lasso selects real whole-stroke geometry including sparse crossings and pressure disks',()=>{
 const square:InkPoint[]=[[-5,-5,1],[5,-5,1],[5,5,1],[-5,5,1]];
 const ink=data(stroke('inside',[[0,0,.5]]),stroke('cross',[[-100,0,.5],[100,0,.5]]),stroke('edge',[[7,0,1]],6),stroke('outside',[[7,7,.5]]),stroke('bbox-only',[[-20,20,.5],[20,20,.5]]));
 assert.deepEqual(selectInkLasso(ink,square),['inside','cross','edge']);
 assert.equal(hitSelectedInk(ink,['cross'],20,0,0),true);assert.equal(hitSelectedInk(ink,['inside'],4,4,0),false);
 assert.deepEqual(selectInkLasso(ink,[[0,0,1],[1,1,1]]),[]);assert.deepEqual(selectInkLasso(ink,[[NaN,0,1],[1,1,1],[2,2,1]]),[]);
});

test('concave even-odd selection excludes the empty notch rather than using a box',()=>{
 const shape:InkPoint[]=[[0,0,1],[10,0,1],[10,3,1],[3,3,1],[3,10,1],[0,10,1]];
 assert.deepEqual(selectInkLasso(data(stroke('inside',[[1,8,.1]],.5),stroke('notch',[[8,8,.1]],.5)),shape),['inside']);
});

test('indexed polygon queries agree with independent even-odd containment on long contours',()=>{
 const polygon:InkPoint[]=Array.from({length:1024},(_,i)=>{const t=i/1024*Math.PI*2,r=60+8*Math.sin(t*7);return[Math.cos(t)*r,Math.sin(t)*r,1];});
 const inside=(x:number,y:number)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 const strokes:InkStroke[]=[];for(let x=-80;x<=80;x+=8)for(let y=-80;y<=80;y+=8)if(Math.abs(Math.hypot(x,y)-(60+8*Math.sin(Math.atan2(y,x)*7)))>2)strokes.push(stroke(`${x},${y}`,[[x,y,0]],.5));
 assert.deepEqual(selectInkLasso(data(...strokes),polygon),strokes.filter(s=>inside(s.points[0][0],s.points[0][1])).map(s=>s.id));
});
