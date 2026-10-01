import {test} from 'node:test';import assert from 'node:assert/strict';
import {alignmentIndex,alignDrag} from '../src/alignment-guides';import {Card} from '../src/model';
const n=(id:string,x:number,y:number):Card=>({id,kind:'text',text:id,x,y,width:100,height:80,color:'green'});
test('snaps left edge and center and gives bounded guide segments',()=>{const i=alignmentIndex([n('a',0,0),n('b',200,200)],new Set(['a']))!;const r=alignDrag(i,197,115,1);assert.equal(r.dx,200);assert.equal(r.dy,120);assert.deepEqual(r.guides.map(g=>g.axis),['x','y']);assert.equal(r.guides[0].value,200);});
test('threshold stays constant on screen at different zoom levels',()=>{const i=alignmentIndex([n('a',0,0),n('b',200,200)],new Set(['a']))!;assert.equal(alignDrag(i,190,0,.5).dx,200);assert.equal(alignDrag(i,190,0,1).dx,190);assert.equal(alignDrag(i,197,0,2).dx,200);assert.equal(alignDrag(i,196,0,2).dx,196);});
test('selected objects do not snap to each other and multi-selection uses one bounding box',()=>{const nodes=[n('a',0,0),n('b',120,0),n('target',400,200)];const i=alignmentIndex(nodes,new Set(['a','b']))!;assert.equal(i.x.length,3);assert.equal(i.bounds.width,220);assert.equal(alignDrag(i,177,0,1).dx,180);});
test('locked axis stays fixed while other axis can snap',()=>{const i=alignmentIndex([n('a',0,0),n('b',4,200)],new Set(['a']))!;const r=alignDrag(i,0,197,1,'x');assert.equal(r.dx,0);assert.equal(r.dy,200);assert.equal(r.guides.length,1);});
test('offscreen objects and container frames do not attract a drag',()=>{const i=alignmentIndex([n('a',0,0),n('far',2000,0),{...n('s',200,0),kind:'section',title:'s'}],new Set(['a']),{x:0,y:0,width:500,height:500})!;assert.equal(i.x.length,0);assert.equal(alignDrag(i,197,0,1).guides.length,0);});
test('locked objects can guide but cannot be included in moving bounds',()=>{const i=alignmentIndex([n('a',0,0),{...n('locked',200,200),locked:true}],new Set(['a']))!;assert.equal(alignDrag(i,197,0,1).dx,200);assert.equal(alignmentIndex([{...n('a',0,0),locked:true}],new Set(['a'])),undefined);});
test('alignment does not modify source geometry and returns deterministic nearest result',()=>{const nodes=[n('a',0,0),n('b',200,200),n('c',204,300)],before=JSON.stringify(nodes),i=alignmentIndex(nodes,new Set(['a']))!;assert.deepEqual(alignDrag(i,203,0,1),alignDrag(i,203,0,1));assert.equal(alignDrag(i,203,0,1).dx,204);assert.equal(JSON.stringify(nodes),before);});
test('third card extends equal horizontal spacing and exposes both measured gaps',()=>{
 const i=alignmentIndex([n('moving',0,0),n('a',200,0),n('b',350,0)],new Set(['moving']))!,r=alignDrag(i,497,0,1);
 assert.equal(r.dx,500);assert.deepEqual(r.guides.filter(g=>g.spacing!==undefined).map(g=>[g.start,g.end,g.spacing]),[[300,350,50],[450,500,50]]);
});
test('equal spacing supports insertion, vertical rows, locked axes and screen tolerance',()=>{
 const i=alignmentIndex([n('moving',0,0),n('a',200,0),n('b',500,0)],new Set(['moving']))!;
 assert.equal(alignDrag(i,347,0,1).dx,350);assert.equal(alignDrag(i,347,0,1,'x').dx,347);assert.equal(alignDrag(i,340,0,1).dx,340);assert.equal(alignDrag(i,340,0,.5).dx,350);
 const v=alignmentIndex([n('moving',0,0),n('a',0,200),n('b',0,330)],new Set(['moving']))!;assert.equal(alignDrag(v,0,456,1).dy,460);
});
test('unrelated rows and overlapping reference cards cannot supply equal gaps',()=>{
 for(const nodes of [[n('a',200,300),n('b',350,300)],[n('a',200,0),n('b',250,0)]]){const i=alignmentIndex([n('moving',0,0),...nodes],new Set(['moving']))!;assert.equal(alignDrag(i,497,0,1).guides.some(g=>g.spacing!==undefined),false);}
});
