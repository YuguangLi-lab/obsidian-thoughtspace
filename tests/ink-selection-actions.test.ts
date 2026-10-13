import test from 'node:test';
import assert from 'node:assert/strict';
import {inkSelectionActionPosition} from '../src/ink-selection-actions';

const size={width:216,height:54},selection={x:0,y:0,width:30,height:30};
for(const width of [360,390,430,768,820,1024])for(const height of [300,380,800])for(const zoom of [.15,1,2.5])test(`nearby action geometry remains screen-sized in ${width}×${height} at ${zoom}`,()=>{
 const stage={left:30,top:68,width:width-60,height:height-104},visible={offsetLeft:0,offsetTop:0,width,height},camera={x:stage.width/2,y:stage.height/2,zoom};
 const position=inkSelectionActionPosition(stage,selection,camera,size,visible);assert.ok(position);
 assert.ok(position.left>=8);assert.ok(position.left+size.width<=stage.width-8);assert.ok(position.top>=8);assert.ok(position.top+size.height<=stage.height-8);
});

test('placement prefers above the selected strokes and otherwise below, without changing world coordinates',()=>{
 const stage={left:200,top:100,width:600,height:500},visible={offsetLeft:0,offsetTop:0,width:1000,height:800};
 assert.deepEqual(inkSelectionActionPosition(stage,selection,{x:200,y:200,zoom:1},size,visible),{left:107,top:138});
 assert.deepEqual(inkSelectionActionPosition(stage,selection,{x:200,y:0,zoom:1},size,visible),{left:107,top:38});
 assert.deepEqual(selection,{x:0,y:0,width:30,height:30});
});

test('stage and visualViewport intersection respects keyboard, pop-out offsets, safe-area and all four edges',()=>{
 const stage={left:50,top:70,width:820,height:900},visible={offsetLeft:70,offsetTop:110,width:500,height:300},safe={left:25,top:20,right:30,bottom:18};
 for(const x of [40,480])for(const y of [70,280]){
  const position=inkSelectionActionPosition(stage,selection,{x,y,zoom:1},size,visible,safe);assert.ok(position);
  assert.ok(stage.left+position.left>=visible.offsetLeft+safe.left+8);assert.ok(stage.left+position.left+size.width<=visible.offsetLeft+visible.width-safe.right-8);
  assert.ok(stage.top+position.top>=visible.offsetTop+safe.top+8);assert.ok(stage.top+position.top+size.height<=visible.offsetTop+visible.height-safe.bottom-8);
 }
});

test('partially visible or very large selections anchor at their visible portion, while fully offscreen ones hide',()=>{
 const stage={left:0,top:0,width:390,height:380},visible={offsetLeft:0,offsetTop:0,width:390,height:300};
 assert.ok(inkSelectionActionPosition(stage,{x:-600,y:-700,width:1200,height:1400},{x:0,y:0,zoom:1},size,visible));
 for(const [x,y]of [[-1000,10],[1000,10],[10,-1000],[10,1000]])assert.equal(inkSelectionActionPosition(stage,selection,{x,y,zoom:1},size,visible),undefined);
});

test('never shrink touch controls into an unusable sliver or place them outside a tiny/hidden stage',()=>{
 const visible={offsetLeft:0,offsetTop:0,width:390,height:300};
 for(const [width,height]of [[220,300],[390,68],[0,100],[100,0]])assert.equal(inkSelectionActionPosition({left:0,top:0,width,height},selection,{x:20,y:20,zoom:1},size,visible),undefined);
});

test('malformed camera, geometry and viewport values are rejected rather than overflowing the UI',()=>{
 const stage={left:0,top:0,width:390,height:300},visible={offsetLeft:0,offsetTop:0,width:390,height:300},camera={x:60,y:60,zoom:1};
 for(const value of [NaN,Infinity,-Infinity]){
  assert.equal(inkSelectionActionPosition(stage,selection,{...camera,x:value},size,visible),undefined);
  assert.equal(inkSelectionActionPosition(stage,{...selection,width:value},camera,size,visible),undefined);
  assert.equal(inkSelectionActionPosition(stage,selection,camera,size,{...visible,offsetTop:value}),undefined);
 }
 assert.equal(inkSelectionActionPosition(stage,selection,{...camera,zoom:0},size,visible),undefined);
 assert.equal(inkSelectionActionPosition(stage,selection,{...camera,zoom:-1},size,visible),undefined);
 assert.equal(inkSelectionActionPosition(stage,{...selection,width:-1},camera,size,visible),undefined);
});
