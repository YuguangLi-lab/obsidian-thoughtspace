import test from 'node:test';
import assert from 'node:assert/strict';
import {BlankDoubleClick} from '../src/blank-double-click';

const point=(clientX=20,clientY=30,pointerId=1)=>({clientX,clientY,pointerId});
const press=(clientX=20,clientY=30,pointerId=1,button=0)=>({...point(clientX,clientY,pointerId),button});
function click(guard:BlankDoubleClick,detail:number,eligible=true){
 guard.down(press(),eligible,4);guard.up(point());guard.click({detail});
}

test('two clean blank clicks allow exactly one double-click consumption',()=>{
 const guard=new BlankDoubleClick();click(guard,1);assert.equal(guard.consume(),false);
 click(guard,2);assert.equal(guard.consume(),true);assert.equal(guard.consume(),false);
});

test('movement below the configured threshold remains a clean click',()=>{
 const guard=new BlankDoubleClick();
 for(const detail of [1,2]){guard.down(press(),true,6);guard.move(point(23,33));guard.up(point(24,33));guard.click({detail});}
 assert.equal(guard.consume(),true);
});

test('dragging either press blocks a browser double-click retargeted to the canvas',()=>{
 for(const dragged of [1,2]){
  const guard=new BlankDoubleClick();
  for(const detail of [1,2]){guard.down(press(),true,4);guard.up(point(detail===dragged?24:20));guard.click({detail});}
  assert.equal(guard.consume(),false,`drag on click ${dragged}`);
 }
});

test('out-and-back movement cannot become a clean release',()=>{
 for(const dragged of [1,2]){
  const guard=new BlankDoubleClick();
  for(const detail of [1,2]){guard.down(press(),true,4);if(detail===dragged)guard.move(point(40,50));guard.up(point());guard.click({detail});}
  assert.equal(guard.consume(),false);
 }
});

test('a node or control press remains ineligible if its click is retargeted to canvas',()=>{
 for(const ineligible of [1,2]){
  const guard=new BlankDoubleClick();click(guard,1,ineligible!==1);click(guard,2,ineligible!==2);
  assert.equal(guard.consume(),false);
 }
});

test('cancelled release and explicit cancellation prevent creation',()=>{
 const guard=new BlankDoubleClick();click(guard,1);guard.down(press(),true,4);guard.up(point(),true);guard.click({detail:2});
 assert.equal(guard.consume(),false);
 click(guard,1);guard.down(press(),true,4);guard.cancel();guard.up(point());guard.click({detail:2});assert.equal(guard.consume(),false);
 click(guard,1);click(guard,2);guard.cancel();assert.equal(guard.consume(),false);
});

test('foreign pointer movement, press and release cannot replace the active press',()=>{
 const guard=new BlankDoubleClick();
 for(const detail of [1,2]){
  guard.down(press(),true,4);guard.down(press(100,100,2),false,4);guard.move(point(100,100,2));guard.up(point(100,100,2),true);
  guard.up(point());guard.click({detail});
 }
 assert.equal(guard.consume(),true);
});

test('right and middle presses invalidate a pending click sequence',()=>{
 for(const button of [1,2]){
  const guard=new BlankDoubleClick();click(guard,1);guard.down(press(20,30,1,button),true,4);guard.up(point());click(guard,2);
  assert.equal(guard.consume(),false);
 }
});

test('a fresh double-click immediately works after a rejected drag sequence',()=>{
 const guard=new BlankDoubleClick();guard.down(press(),true,4);guard.move(point(40));guard.up(point());guard.click({detail:1});click(guard,2);
 assert.equal(guard.consume(),false);click(guard,1);click(guard,2);assert.equal(guard.consume(),true);
 click(guard,1);click(guard,2);assert.equal(guard.consume(),true);
});

test('untracked clicks, keyboard clicks and extra click counts cannot reuse a clean release',()=>{
 const guard=new BlankDoubleClick();guard.click({detail:1});guard.click({detail:2});assert.equal(guard.consume(),false);
 click(guard,1);guard.click({detail:2});assert.equal(guard.consume(),false);
 click(guard,1);click(guard,0);click(guard,2);assert.equal(guard.consume(),false);
 click(guard,1);click(guard,2);click(guard,3);assert.equal(guard.consume(),false);
});

test('threshold normalization matches board preferences and invalid coordinates fail closed',()=>{
 for(const [threshold,distance] of [[NaN,4],[Infinity,4],[0,2],[99,12]]){
  const guard=new BlankDoubleClick();
  for(const detail of [1,2]){guard.down(press(),true,threshold);guard.up(point(20+distance));guard.click({detail});}
  assert.equal(guard.consume(),false,`threshold ${threshold}`);
 }
 for(const invalid of [NaN,Infinity,-Infinity]){
  const guard=new BlankDoubleClick();guard.down(press(invalid),true,4);guard.up(point());guard.click({detail:1});click(guard,2);assert.equal(guard.consume(),false);
  click(guard,1);guard.down(press(),true,4);guard.move(point(invalid));guard.up(point());guard.click({detail:2});assert.equal(guard.consume(),false);
 }
});
