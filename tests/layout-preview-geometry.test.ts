import {test} from 'node:test';import assert from 'node:assert/strict';import {comparisonPreviewBounds,previewConnection,previewViewBox,rebasePreviewCamera,zoomPreviewAt,focusPreviewRect} from '../src/layout-preview-geometry';
const rect=(x:number,y:number,width=100,height=60)=>({x,y,width,height});
test('preview curves start and end on horizontal card boundaries',()=>{assert.equal(previewConnection(rect(0,0),rect(300,0)),'M100,30C200,30 200,30 300,30');});
test('vertical preview curves respect different card sizes',()=>{assert.equal(previewConnection(rect(0,0),rect(0,300)),'M50,60C50,180 50,180 50,300');});
test('overlapping and coincident cards do not produce inverted preview connections',()=>{assert.equal(previewConnection(rect(0,0),rect(20,0)),'');assert.equal(previewConnection(rect(0,0),rect(0,0)),'');});
test('diagonal and reverse connections have finite cubic geometry',()=>{for(const [a,b]of [[rect(0,0),rect(300,180)],[rect(300,180),rect(0,0)]]){const p=previewConnection(a,b);assert.ok(p.includes('C'));assert.ok(!/NaN|Infinity/.test(p));}});
test('pointer zoom preserves screen position of its world anchor',()=>{const base=rect(-100,50,1000,700),camera={zoom:2,pan:{x:40,y:-20}},point={x:600,y:250},next=zoomPreviewAt(base,camera,1.5,point);for(const axis of ['x','y'] as const){const center=base[axis]+(axis==='x'?base.width:base.height)/2;assert.ok(Math.abs((point[axis]-center-camera.pan[axis])*camera.zoom-(point[axis]-center-next.pan[axis])*next.zoom)<1e-9);}});
test('center zoom preserves panning and clamps both limits',()=>{const base=rect(0,0,1000,700),camera={zoom:2,pan:{x:40,y:-20}};assert.deepEqual(zoomPreviewAt(base,camera,2),{zoom:4,pan:camera.pan});assert.equal(zoomPreviewAt(base,camera,100).zoom,32);assert.equal(zoomPreviewAt(base,camera,.01).zoom,1);});

test('finding an object centers it and accounts for letterboxing on long rows',()=>{const b=rect(0,0,12000,200),n=rect(5000,20,200,80),c=focusPreviewRect(b,n,1.5);assert.equal(b.x+b.width/2+c.pan.x,n.x+n.width/2);assert.equal(b.y+b.height/2+c.pan.y,n.y+n.height/2);assert.equal(c.zoom,32);});


test('one comparison framing includes original cards, final cards and generated frames',()=>{
 const before=[rect(-400,20,400,90),rect(500,300)],after=[rect(-300,-120,360,500),rect(1000,100,160,250)];
 const base=comparisonPreviewBounds(before,after);
 assert.deepEqual(base,{x:-430,y:-195,width:1620,height:610});
 for(const item of [...before,...after]){
  assert.ok(item.x>=base.x&&item.y>=base.y);
  assert.ok(item.x+item.width<=base.x+base.width&&item.y+item.height<=base.y+base.height);
 }
});
test('changing layout parameters keeps the world center and absolute scale of a manually adjusted preview',()=>{
 const base=rect(-100,0,900,300),next=rect(-300,-100,1100,780),camera={zoom:2,pan:{x:40,y:-20}},aspect=1.5;
 const a=previewViewBox(base,camera),b=previewViewBox(next,rebasePreviewCamera(base,next,camera,aspect));
 assert.equal(a.x+a.width/2,b.x+b.width/2);
 assert.ok(Math.abs(a.y+a.height/2-b.y-b.height/2)<1e-9);
 assert.ok(Math.abs(Math.max(a.width,a.height*aspect)-Math.max(b.width,b.height*aspect))<1e-9);
 assert.deepEqual(rebasePreviewCamera(base,next,{zoom:1,pan:{x:0,y:0}},aspect),{zoom:1,pan:{x:0,y:0}},'untouched previews fit the new comparison');
});
